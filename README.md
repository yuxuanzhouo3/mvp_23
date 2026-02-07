# mornFullStack MVP 23

> **One word to a full-stack app.**

mornFullStack is a no-code platform that instantly generates a complete, production-ready full-stack application (frontend, backend, database) from a single descriptive prompt or keyword.

**Live:** [mornhub.app](https://mornhub.app) → mornFullStack mvp_23

---

## Project Overview

- **Concept:** Describe your idea. Instantly generate a complete, deployable MVP. No code, no configuration, just your vision.
- **Target users:** Developers, founders, and product teams who want to build prototypes or MVPs instantly.
- **Tech stack:** Next.js | React | Node.js | PostgreSQL | Tailwind | Vercel

---

## Features

| Feature | Description |
|--------|-------------|
| **Modern Frontend** | Responsive React/Next.js UI with Tailwind CSS. Clean, fast, customizable. |
| **Production Backend** | Secure Node.js API with Express.js. Pre-built routes, middleware, business logic. |
| **Managed Database** | Live PostgreSQL database with auto-generated schema from your prompt. |
| **One-Click Deploy** | Deploy to Vercel/Netlify and Railway with a single click. Real, shareable URLs. |

---

## Build Your MVP in 30 Seconds

1. **Describe** — Type your app idea. e.g. `"Task manager with kanban"`, `"AI content analyzer"`.
2. **Generate** — AI assembles the full-stack code, architecture, and UI.
3. **Deploy & Customize** — Your app is live. Edit the code in our online editor or clone the GitHub repo.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

---

## Deploy to Vercel (yuxuanzhouo3 Account)

### Deploy under the yuxuanzhouo3 Vercel account

1. Log in to [vercel.com](https://vercel.com) with the **yuxuanzhouo3** account.
2. Import this project:
   - Click **Add New** → **Project**
   - Connect your GitHub and select the `mvp_23` (or `mvp23`) repository
3. Configure:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
4. Add domain (optional): Configure `mornhub.app` as a custom domain in Vercel project settings.
5. Deploy.

### Via Vercel CLI

```bash
# Ensure you're logged in as yuxuanzhouo3
vercel login

# Link to yuxuanzhouo3 team/account
vercel link

# Deploy
vercel --prod
```

> **Note:** Account switching is done in the Vercel dashboard or via `vercel switch` — project code does not store which Vercel account is used.

---

## GitHub

- **Repo:** Push this project to `mvp23` or `mvp_23` as needed.
- **Branch:** `main` is the default production branch.

```bash
git init
git add .
git commit -m "mornFullStack mvp_23 landing page"
git branch -M main
git remote add origin https://github.com/yuxuanzhouo3/mvp23.git
git push -u origin main
```

---

## License

© 2025 mornFullStack MVP. From idea to deployed app.
