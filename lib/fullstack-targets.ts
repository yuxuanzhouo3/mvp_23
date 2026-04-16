import type { Region } from "@/lib/project-workspace"

export type DeploymentTarget =
  | "vercel"
  | "cloudbase"
  | "railway"
  | "render"
  | "self_hosted"

export type DatabaseTarget =
  | "sqlite"
  | "supabase_postgres"
  | "cloudbase_document"
  | "neon_postgres"
  | "mysql"
  | "mongodb"

export type DeploymentOption = {
  id: DeploymentTarget
  nameCn: string
  nameEn: string
  runtime: "node" | "docker"
  dockerRequired: boolean
  defaultRegions: Region[]
  descriptionCn: string
  descriptionEn: string
}

export type DatabaseOption = {
  id: DatabaseTarget
  nameCn: string
  nameEn: string
  engine: "sqlite" | "postgres" | "document" | "mysql" | "mongodb"
  defaultRegions: Region[]
  descriptionCn: string
  descriptionEn: string
}

export const DEPLOYMENT_OPTIONS: DeploymentOption[] = [
  {
    id: "vercel",
    nameCn: "Vercel Node",
    nameEn: "Vercel Node",
    runtime: "node",
    dockerRequired: false,
    defaultRegions: ["intl"],
    descriptionCn: "国际版默认部署环境，直接支持 Next.js / Node。",
    descriptionEn: "Default international deployment target with direct Next.js and Node support.",
  },
  {
    id: "cloudbase",
    nameCn: "CloudBase 云托管",
    nameEn: "CloudBase Hosting",
    runtime: "docker",
    dockerRequired: true,
    defaultRegions: ["cn"],
    descriptionCn: "国内版默认环境，适合接 CloudBase 云托管与文档型数据库。",
    descriptionEn: "Default China deployment target for CloudBase hosting and document databases.",
  },
  {
    id: "railway",
    nameCn: "Railway",
    nameEn: "Railway",
    runtime: "node",
    dockerRequired: false,
    defaultRegions: [],
    descriptionCn: "适合快速部署全栈 Node 服务与独立数据库实例。",
    descriptionEn: "Good for quickly shipping full-stack Node services with managed databases.",
  },
  {
    id: "render",
    nameCn: "Render",
    nameEn: "Render",
    runtime: "docker",
    dockerRequired: true,
    defaultRegions: [],
    descriptionCn: "适合 Docker 化部署，方便接自定义运行时和稳定预发环境。",
    descriptionEn: "Useful for Dockerized full-stack deployments and stable staging environments.",
  },
  {
    id: "self_hosted",
    nameCn: "自托管 Docker",
    nameEn: "Self-hosted Docker",
    runtime: "docker",
    dockerRequired: true,
    defaultRegions: [],
    descriptionCn: "适合私有化交付、企业内网或独立服务器部署。",
    descriptionEn: "Designed for private delivery, internal networks, or dedicated servers.",
  },
]

export const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    id: "sqlite",
    nameCn: "SQLite 本地预览库",
    nameEn: "SQLite Local Preview",
    engine: "sqlite",
    defaultRegions: ["cn", "intl"],
    descriptionCn: "本地预览默认数据库，零配置即可启动生成应用。",
    descriptionEn: "Default local preview database so generated apps can boot without external infrastructure.",
  },
  {
    id: "supabase_postgres",
    nameCn: "Supabase Postgres",
    nameEn: "Supabase Postgres",
    engine: "postgres",
    defaultRegions: ["intl"],
    descriptionCn: "国际版默认数据库，适合登录、权限和关系型业务表。",
    descriptionEn: "Default international database for auth, permissions, and relational app data.",
  },
  {
    id: "cloudbase_document",
    nameCn: "CloudBase 文档数据库",
    nameEn: "CloudBase Document DB",
    engine: "document",
    defaultRegions: ["cn"],
    descriptionCn: "国内版默认数据库，适合 CloudBase 文档型数据与云托管配套。",
    descriptionEn: "Default China database for CloudBase document-style data and managed hosting.",
  },
  {
    id: "neon_postgres",
    nameCn: "Neon Postgres",
    nameEn: "Neon Postgres",
    engine: "postgres",
    defaultRegions: [],
    descriptionCn: "适合 serverless Postgres 与预览分支数据库。",
    descriptionEn: "Good for serverless Postgres and preview-branch databases.",
  },
  {
    id: "mysql",
    nameCn: "MySQL / MariaDB",
    nameEn: "MySQL / MariaDB",
    engine: "mysql",
    defaultRegions: [],
    descriptionCn: "适合传统关系型业务与现有 MySQL 体系迁移。",
    descriptionEn: "Fits traditional relational business systems and existing MySQL stacks.",
  },
  {
    id: "mongodb",
    nameCn: "MongoDB",
    nameEn: "MongoDB",
    engine: "mongodb",
    defaultRegions: [],
    descriptionCn: "适合文档型结构、动态 schema 和高频内容数据。",
    descriptionEn: "Works well for document-oriented models, dynamic schema, and content-heavy apps.",
  },
]

export function getDefaultDeploymentTarget(region: Region): DeploymentTarget {
  return region === "cn" ? "cloudbase" : "vercel"
}

export function getDefaultDatabaseTarget(region: Region): DatabaseTarget {
  return "sqlite"
}

export function normalizeDeploymentTarget(value: string, region: Region): DeploymentTarget {
  const safe = String(value ?? "").trim() as DeploymentTarget
  return DEPLOYMENT_OPTIONS.some((item) => item.id === safe) ? safe : getDefaultDeploymentTarget(region)
}

export function normalizeDatabaseTarget(value: string, region: Region): DatabaseTarget {
  const safe = String(value ?? "").trim() as DatabaseTarget
  return DATABASE_OPTIONS.some((item) => item.id === safe) ? safe : getDefaultDatabaseTarget(region)
}

export function getDeploymentOption(target: DeploymentTarget) {
  return DEPLOYMENT_OPTIONS.find((item) => item.id === target) ?? DEPLOYMENT_OPTIONS[0]
}

export function getDatabaseOption(target: DatabaseTarget) {
  return DATABASE_OPTIONS.find((item) => item.id === target) ?? DATABASE_OPTIONS[0]
}

export function getDeploymentEnvGuide(target: DeploymentTarget) {
  switch (target) {
    case "cloudbase":
      return ["CLOUDBASE_ENV_ID", "CLOUDBASE_MONGODB_URL"]
    case "railway":
      return ["RAILWAY_PROJECT_ID", "RAILWAY_STATIC_URL"]
    case "render":
      return ["RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL"]
    case "self_hosted":
      return ["SELF_HOSTED_BASE_URL", "SELF_HOSTED_SSH_TARGET"]
    default:
      return ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL"]
  }
}

export function getDatabaseEnvGuide(target: DatabaseTarget) {
  switch (target) {
    case "sqlite":
      return ["DATABASE_URL"]
    case "cloudbase_document":
      return ["CLOUDBASE_MONGODB_URL", "CN_DATABASE_URL"]
    case "supabase_postgres":
      return ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"]
    case "neon_postgres":
      return ["NEON_DATABASE_URL"]
    case "mysql":
      return ["MYSQL_DATABASE_URL"]
    case "mongodb":
      return ["MONGODB_DATABASE_URL"]
    default:
      return ["DATABASE_URL"]
  }
}
