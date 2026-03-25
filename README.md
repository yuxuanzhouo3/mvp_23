# MVP 23 - AI App Builder Dashboard

<p align="center">
  <a href="#-中文">中文</a> | <a href="#-english">English</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.1.6-000000?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Rights" src="https://img.shields.io/badge/Rights-All%20rights%20reserved-red" />
</p>

---

## 中文

版权声明：`Copyright (c) 2024 yuxuan zhou @mornscience All rights reserved.`

一个本地可运行的 AI 应用生成与迭代控制台：
输入 Prompt 即可生成子项目，支持启动预览、继续迭代、快速回滚。

### 目录

- [项目亮点](#项目亮点)
- [快速开始](#快速开始)
- [核心接口](#核心接口)
- [架构与流程](#架构与流程)
- [项目结构](#项目结构)
- [截图占位](#截图占位)

### 项目亮点

- Prompt 一键生成项目（`/api/generate`）
- 迭代修改并自动构建校验（`/api/iterate`）
- 项目运行控制（`/api/projects/[id]/run`）
- 一键回滚最近一次迭代（`/api/projects/[id]/revert`）
- AI 健康检查（`/api/ai-health`）

### 快速开始

```bash
npm install
cp .env.example .env.local
npm run dev
```

访问：`http://localhost:3000`

`.env.local` 至少配置一个 Key，推荐使用通用 OpenAI-compatible 配置：

```bash
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
# or INTERNAL_AI_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY
```

### 核心接口

- `GET /api/ai-health` AI 连通性检测
- `POST /api/generate` 新建并生成项目
- `GET /api/generate?jobId=...` 查询任务状态
- `POST /api/iterate` 对已有项目做增量改动
- `GET /api/projects` 查询项目列表
- `POST /api/projects/[id]/run` start/stop/restart
- `POST /api/projects/[id]/revert` 回滚最近迭代

### 架构与流程

```text
Dashboard UI
   -> API Layer (/generate /iterate /projects /run /revert /ai-health)
      -> Core Services (ai-provider / project-workspace / generate-tasks)
         -> Local FS (workspaces/project_xxx + json stores)
```

### 项目结构

```text
app/            页面与 API
components/     业务组件 + shadcn/ui
lib/            AI 调用、项目工作区、任务存储
workspaces/     生成项目与元数据
docs/           文档
```

### 截图占位

> 建议替换为你的真实截图。

```md
![Dashboard](./docs/screenshots/dashboard.png)
![Generate Result](./docs/screenshots/generate-result.png)
![Workspace Runtime](./docs/screenshots/runtime.png)
```

---

## English

Copyright notice: `Copyright (c) 2024 yuxuan zhou @mornscience All rights reserved.`

Local AI app builder dashboard for generation + iteration:
Prompt -> generate project -> run preview -> iterate -> revert.

### Highlights

- Generate app from prompt (`/api/generate`)
- Iterative edits with build validation (`/api/iterate`)
- Runtime control start/stop/restart (`/api/projects/[id]/run`)
- Revert last iterate change (`/api/projects/[id]/revert`)
- AI health check (`/api/ai-health`)

### Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

Set at least one key in `.env.local`, preferably the generic OpenAI-compatible set:

```bash
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
# or INTERNAL_AI_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY
```

### API Overview

- `GET /api/ai-health`
- `POST /api/generate`
- `GET /api/generate?jobId=...`
- `POST /api/iterate`
- `GET /api/projects`
- `POST /api/projects/[id]/run`
- `POST /api/projects/[id]/revert`

### License

MIT (or your repository policy).
