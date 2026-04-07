"use client"

import { useEffect, useMemo, useState } from "react"
import { CanonicalPreviewPage } from "@/components/preview/canonical-preview-page"
import {
  PREVIEW_SNAPSHOT_STORAGE_KEY,
  buildPreviewSnapshotAliases,
  slugifyPreviewKey,
  type PreviewSnapshot,
} from "@/lib/preview-snapshot"

type PreviewRouteClientProps = {
  routeParam: string
  page: string
  initialSnapshot: PreviewSnapshot | null
  initialLookup: {
    routeParam: string
    lookupKey: string
    projectId: string | null
    projectSlug: string | null
    projectName: string | null
    projectFound: boolean
    manifestKeys: string[]
    availableKeys: string[]
    storePath: string
  }
}

function readSnapshots() {
  if (typeof window === "undefined") return [] as PreviewSnapshot[]
  try {
    const raw = window.localStorage.getItem(PREVIEW_SNAPSHOT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PreviewSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function PreviewRouteClient({
  routeParam,
  page,
  initialSnapshot,
  initialLookup,
}: PreviewRouteClientProps) {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(initialSnapshot)
  const [lookupInfo, setLookupInfo] = useState(initialLookup)

  useEffect(() => {
    if (initialSnapshot) return

    const snapshots = readSnapshots()
    const normalizedParam = slugifyPreviewKey(routeParam) || routeParam
    const matched =
      snapshots.find((item) => buildPreviewSnapshotAliases(item).includes(routeParam)) ||
      snapshots.find((item) => buildPreviewSnapshotAliases(item).includes(normalizedParam))

    if (!matched) return

    setSnapshot(matched)
    setLookupInfo({
      routeParam,
      lookupKey: matched.projectSlug || matched.projectId,
      projectId: matched.projectId,
      projectSlug: matched.projectSlug,
      projectName: matched.presentation.displayName,
      projectFound: true,
      manifestKeys: snapshots.map((item) => item.projectSlug || item.projectId),
      availableKeys: snapshots.flatMap((item) => buildPreviewSnapshotAliases(item)),
      storePath: `${PREVIEW_SNAPSHOT_STORAGE_KEY} (localStorage)`,
    })
  }, [initialSnapshot, routeParam])

  const normalizedPage = useMemo(() => page || "dashboard", [page])

  if (snapshot) {
    return (
      <CanonicalPreviewPage
        projectId={snapshot.projectId}
        projectKey={snapshot.projectSlug || snapshot.projectId}
        region={snapshot.region}
        page={normalizedPage}
        spec={snapshot.spec}
        delivery={snapshot.delivery ?? null}
        presentation={snapshot.presentation}
        history={snapshot.history}
      />
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#f8fafc", padding: 24, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ borderRadius: 18, border: "1px solid rgba(248,113,113,0.22)", background: "rgba(127,29,29,0.16)", padding: 16, color: "#fca5a5", fontWeight: 700 }}>
          Project not found
        </div>
        <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "#151923", padding: 16, lineHeight: 1.8 }}>
          <div>projectId: {String(lookupInfo.projectId)}</div>
          <div>projectSlug: {String(lookupInfo.projectSlug)}</div>
          <div>projectName: {String(lookupInfo.projectName)}</div>
          <div>lookupKey: {lookupInfo.lookupKey}</div>
          <div>routeParam: {lookupInfo.routeParam}</div>
          <div>routePath: /preview/{routeParam}{normalizedPage && normalizedPage !== "dashboard" ? `/${normalizedPage}` : ""}</div>
          <div>projectFound: {String(lookupInfo.projectFound)}</div>
          <div>storePath: {lookupInfo.storePath}</div>
          <div>manifestKeys: {lookupInfo.manifestKeys.join(", ") || "none"}</div>
          <div>availableKeys: {lookupInfo.availableKeys.join(", ") || "none"}</div>
        </div>
      </div>
    </main>
  )
}
