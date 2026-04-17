import { NextResponse } from "next/server"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import { getProject, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildPreviewBase(projectId: string) {
  return `/api/preview-runtime/${encodeURIComponent(projectId)}`
}

function rewriteHtmlForSandboxPreview(html: string, projectId: string) {
  const previewBase = buildPreviewBase(projectId)
  const fallbackBase = `/preview/${encodeURIComponent(projectId)}`
  let next = html
  next = next.replace(/(href|src|action)=("|')\/(?!\/)/g, `$1=$2${previewBase}/`)
  next = next.replace(/(["'])\/_next\//g, `$1${previewBase}/_next/`)
  next = next.replace(/(["'])\/favicon/g, `$1${previewBase}/favicon`)
  next = next.replace(/url\(\/(?!\/)/g, `url(${previewBase}/`)
  if (next.includes("</head>")) {
    next = next.replace("</head>", `${buildPreviewRuntimeShim(previewBase, fallbackBase)}</head>`)
  }
  return next
}

function buildPreviewRuntimeShim(previewBase: string, fallbackBase: string) {
  const escapedBase = JSON.stringify(previewBase)
  const escapedFallbackBase = JSON.stringify(fallbackBase)
  return `<script>
;(() => {
  const previewBase = ${escapedBase};
  const fallbackBase = ${escapedFallbackBase};
  const sameOriginAbsolute = /^\\/(?!\\/)/;
  const shouldProxy = (value) =>
    typeof value === "string" &&
    sameOriginAbsolute.test(value) &&
    value !== previewBase &&
    !value.startsWith(previewBase + "/");
  const proxyUrl = (value) => {
    if (!shouldProxy(value)) return value;
    return previewBase + value;
  };

  window.__MORNSTACK_PREVIEW_BASE__ = previewBase;
  window.__MORNSTACK_CANONICAL_PREVIEW_BASE__ = fallbackBase;

  let fallbackScheduled = false;
  const currentPreviewSuffix = () => {
    const pathname = window.location.pathname || "";
    if (!pathname.startsWith(previewBase)) return "";
    return pathname.slice(previewBase.length).replace(/^\\/+/, "");
  };
  const buildFallbackUrl = () => {
    const suffix = currentPreviewSuffix();
    const path = suffix && !suffix.startsWith("_next/") ? fallbackBase + "/" + suffix : fallbackBase;
    return path + window.location.search + window.location.hash;
  };
  const looksLikeFatalClientError = () => {
    const text = document.body?.innerText || "";
    return /Application error|client-side exception|Hydration failed|Minified React error/i.test(text);
  };
  const scheduleFallback = () => {
    if (!fallbackBase || fallbackScheduled) return;
    fallbackScheduled = true;
    window.setTimeout(() => {
      if (looksLikeFatalClientError()) {
        window.location.replace(buildFallbackUrl());
      } else {
        fallbackScheduled = false;
      }
    }, 700);
  };

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = (input, init) => {
      if (typeof input === "string") {
        return nativeFetch(proxyUrl(input), init);
      }
      if (input instanceof Request) {
        const parsed = new URL(input.url);
        if (parsed.origin === window.location.origin && shouldProxy(parsed.pathname)) {
          const nextUrl = proxyUrl(parsed.pathname + parsed.search + parsed.hash);
          return nativeFetch(new Request(nextUrl, input), init);
        }
      }
      return nativeFetch(input, init);
    };
  }

  if (window.XMLHttpRequest?.prototype?.open) {
    const nativeOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      return nativeOpen.call(this, method, proxyUrl(url), ...rest);
    };
  }

  window.addEventListener("error", scheduleFallback);
  window.addEventListener("unhandledrejection", scheduleFallback);

  if (window.MutationObserver) {
    const observer = new MutationObserver(() => {
      if (looksLikeFatalClientError()) scheduleFallback();
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  for (const method of ["pushState", "replaceState"]) {
    const nativeMethod = window.history?.[method];
    if (typeof nativeMethod !== "function") continue;
    window.history[method] = function(state, title, url) {
      return nativeMethod.call(this, state, title, typeof url === "string" ? proxyUrl(url) : url);
    };
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (shouldProxy(href)) {
      anchor.setAttribute("href", proxyUrl(href));
    }
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form?.getAttribute) return;
    const action = form.getAttribute("action");
    if (shouldProxy(action)) {
      form.setAttribute("action", proxyUrl(action));
    }
  }, true);
})();
</script>`
}

export async function handlePreviewRuntimeRequest(req: Request, projectIdRaw: string, pathSegments: string[]) {
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  const fallback = buildCanonicalPreviewUrl(project?.projectSlug || projectId, pathSegments.join("/"))
  const sandboxUrl = String(project?.sandboxRuntime?.url ?? "").trim()

  if (!project || project.sandboxRuntime?.status !== "running" || !sandboxUrl) {
    return NextResponse.redirect(new URL(fallback, req.url))
  }

  const target = new URL(sandboxUrl)
  const suffix = pathSegments.join("/")
  target.pathname = suffix ? `/${suffix.replace(/^\/+/, "")}` : "/"
  target.search = new URL(req.url).search

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      duplex: "half",
    } as RequestInit)

    if (!upstream.ok && req.method === "GET") {
      return NextResponse.redirect(new URL(fallback, req.url))
    }

    const headers = new Headers(upstream.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    headers.set("cache-control", "no-store")
    const location = headers.get("location")
    const previewBase = buildPreviewBase(projectId)
    if (location?.startsWith("/") && !location.startsWith("//") && !location.startsWith(`${previewBase}/`)) {
      headers.set("location", `${previewBase}${location}`)
    }

    const contentType = headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      const html = await upstream.text()
      return new NextResponse(rewriteHtmlForSandboxPreview(html, projectId), {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      })
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  } catch {
    return NextResponse.redirect(new URL(fallback, req.url))
  }
}

export async function GET(req: Request, context: { params: Promise<{ projectId: string; path?: string[] }> }) {
  const { projectId, path } = await context.params
  return handlePreviewRuntimeRequest(req, projectId, path ?? [])
}

export async function POST(req: Request, context: { params: Promise<{ projectId: string; path?: string[] }> }) {
  const { projectId, path } = await context.params
  return handlePreviewRuntimeRequest(req, projectId, path ?? [])
}
