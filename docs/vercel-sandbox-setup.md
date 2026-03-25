# Vercel Sandbox Setup

This project now supports three preview layers:

- `static_ssr`: canonical in-site preview, default for Vercel
- `dynamic_runtime`: local / container runtime preview
- `sandbox_runtime`: optional high-fidelity runtime preview for Vercel Sandbox

## What is already wired in code

- Canonical preview route: `/preview/:projectId/:page?`
- Sandbox control API: `/api/projects/:id/sandbox`
- Sandbox proxy route: `/api/preview-runtime/:projectId/:page?`
- Workspace UI can switch between canonical preview and sandbox preview

## Environment variables

Add these in Vercel Project Settings when enabling sandbox preview:

```env
VERCEL_SANDBOX_ENABLED=true
VERCEL_SANDBOX_RUNTIME=node22
VERCEL_SANDBOX_TIMEOUT=30m
```

Use one of the following auth modes:

### Mode A: OIDC inside Vercel

Recommended when the app is running on Vercel and the runtime can access OIDC credentials.

Expected by the app:

```env
VERCEL=1
```

or a runtime-provided OIDC token:

```env
VERCEL_OIDC_TOKEN=...
```

### Mode B: Access token flow

Use this when you want explicit credentials:

```env
VERCEL_TOKEN=...
VERCEL_TEAM_ID=...
VERCEL_PROJECT_ID=...
```

## Dependency note

The sandbox runtime loader expects the Vercel Sandbox SDK to be available at runtime:

```bash
pnpm add @vercel/sandbox
```

If the SDK is missing, the app will keep canonical preview working and return a clear sandbox error instead of breaking default preview.

## Recommended rollout

1. Keep default preview as `static_ssr`
2. Deploy and verify `/preview/:projectId`
3. Add sandbox env vars
4. Install `@vercel/sandbox`
5. Use the workspace button: `Start Sandbox`
6. Confirm `/api/projects?projectId=...` shows:
   - `preview.supportsSandboxRuntime = true`
   - `preview.sandboxReadiness.supported = true`

## Current behavior

- If sandbox start succeeds:
  - project preview mode becomes `sandbox_runtime`
  - UI opens sandbox preview through the proxy entry
- If sandbox start fails:
  - project preview mode falls back to `static_ssr`
  - error is stored in `sandboxRuntime.lastError`
  - canonical preview remains available
