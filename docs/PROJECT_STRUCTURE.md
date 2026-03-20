# mornFullStack MVP v23 — Project Structure

File tree of the mornFullStack dashboard application.

```
mvp_23/
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── components.json
│
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   │
│   └── (dashboard)/
│       ├── layout.tsx              # Dashboard shell (sidebar, topbar, right panel)
│       ├── page.tsx                # Dashboard home (/)
│       │
│       ├── projects/
│       │   └── page.tsx            # Projects list (/projects)
│       ├── templates/
│       │   └── page.tsx            # Templates (/templates)
│       ├── activity/
│       │   └── page.tsx            # Activity log (/activity)
│       ├── settings/
│       │   └── page.tsx            # Settings (/settings)
│       │
│       ├── cli/
│       │   └── page.tsx            # CLI Reference (/cli)
│       ├── api-docs/
│       │   └── page.tsx            # API Docs (/api-docs)
│       ├── sdk/
│       │   └── page.tsx            # SDK (/sdk)
│       ├── integrations/
│       │   └── page.tsx            # Integrations (/integrations)
│       │
│       ├── discord/
│       │   └── page.tsx            # Discord community (/discord)
│       ├── examples/
│       │   └── page.tsx            # Examples (/examples)
│       └── blog/
│           └── page.tsx            # Blog (/blog)
│
├── components/
│   ├── dashboard/
│   │   ├── sidebar-nav.tsx         # Left sidebar navigation
│   │   ├── mobile-sidebar.tsx      # Mobile drawer navigation
│   │   ├── top-bar.tsx             # Top header bar
│   │   ├── right-panel.tsx         # Getting started panel
│   │   ├── project-overview.tsx    # Project card (Dashboard)
│   │   ├── recent-generations.tsx  # Recent apps table
│   │   ├── quick-actions.tsx       # Quick action buttons
│   │   ├── terminal-demo.tsx       # Terminal mockup
│   │   └── ai-input-panel.tsx      # Generate prompt input
│   │
│   ├── theme-provider.tsx
│   │
│   └── ui/                         # shadcn/ui components
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── alert.tsx
│       ├── aspect-ratio.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── breadcrumb.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── carousel.tsx
│       ├── chart.tsx
│       ├── checkbox.tsx
│       ├── collapsible.tsx
│       ├── command.tsx
│       ├── context-menu.tsx
│       ├── dialog.tsx
│       ├── drawer.tsx
│       ├── dropdown-menu.tsx
│       ├── form.tsx
│       ├── hover-card.tsx
│       ├── input-otp.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── menubar.tsx
│       ├── navigation-menu.tsx
│       ├── pagination.tsx
│       ├── popover.tsx
│       ├── progress.tsx
│       ├── radio-group.tsx
│       ├── resizable.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── sonner.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── toggle-group.tsx
│       ├── toggle.tsx
│       ├── tooltip.tsx
│       ├── use-mobile.tsx
│       └── use-toast.ts
│
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
│
├── lib/
│   ├── nav-config.ts               # Sidebar navigation config
│   └── utils.ts
│
├── public/
│   ├── placeholder-logo.svg
│   └── placeholder.svg
│
├── styles/
│   └── globals.css
│
└── docs/
    ├── PROJECT_STRUCTURE.md        # This file
    └── local-test-guide.md
```

## Route Map

| Path        | Page           | Description                    |
|-------------|----------------|--------------------------------|
| `/`         | Dashboard      | Overview, generations, actions |
| `/projects` | Projects       | Project list and search        |
| `/templates`| Templates      | App templates                  |
| `/activity` | Activity Log   | Recent activity                |
| `/settings` | Settings       | Profile, notifications, billing|
| `/cli`      | CLI Reference  | Command-line docs              |
| `/api-docs` | API Docs       | REST API documentation         |
| `/sdk`      | SDK            | JavaScript/Python SDK          |
| `/integrations` | Integrations | GitHub, Vercel, Slack          |
| `/discord`  | Discord        | Community link                 |
| `/examples` | Examples       | Example prompts                |
| `/blog`     | Blog           | Blog posts                     |
