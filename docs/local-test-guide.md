# Local Test Guide

How to run and test this project on your machine.

## Prerequisites

- **Node.js** **>= 20.9.0** (required for Next.js 16; check with `node -v`)
- **pnpm** (package manager used by this project)

Install pnpm if needed:

```bash
npm install -g pnpm
```

## Setup

1. **Clone and enter the project** (if not already):

   ```bash
   cd /path/to/mvp_23
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

## Running Locally

### Development server (hot reload)

```bash
pnpm dev
```

- App runs at **http://localhost:3000**
- Changes to code trigger automatic reload

### Production build (local)

```bash
pnpm build
pnpm start
```

- Builds the app, then serves it (default: http://localhost:3000)

## Quick Test Checklist

- [ ] **Home** – Open http://localhost:3000
- [ ] **Dashboard** – Visit `/dashboard` (or main dashboard route)
- [ ] **Navigation** – Use sidebar/nav (Projects, Settings, API Docs, etc.)
- [ ] **Responsiveness** – Resize window or use DevTools device toolbar
- [ ] **Theme** – Toggle light/dark if the app supports it

## Lint

```bash
pnpm lint
```

## Tech Stack (reference)

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS, Radix UI, shadcn/ui–style components
- **Package manager:** pnpm

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Node version error** (“Node.js >= 20.9.0 is required”) | Upgrade Node: use [nvm](https://github.com/nvm-sh/nvm) (`nvm install 20` then `nvm use 20`) or install Node 20+ from [nodejs.org](https://nodejs.org). |
| Port 3000 in use | Run `pnpm dev -- -p 3001` (or another port) |
| Module not found | Run `pnpm install` again |
| Build errors | Run `pnpm build` and fix reported TypeScript/ESLint errors |
