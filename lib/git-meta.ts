import { execFile as execFileCallback } from "child_process"
import { promisify } from "util"

export type GitMeta = {
  branch: string
  commit: string
}

const execFile = promisify(execFileCallback)

async function runGit(args: string[], repoRoot: string) {
  try {
    const { stdout } = await execFile("git", ["-C", repoRoot, ...args], {
      timeout: 2000,
    })
    return String(stdout ?? "").trim()
  } catch {
    return ""
  }
}

export async function readGitMeta(repoRoot = process.cwd()): Promise<GitMeta | null> {
  const envBranch =
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    process.env.GIT_BRANCH?.trim() ||
    process.env.BRANCH_NAME?.trim() ||
    ""
  const envCommit =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    process.env.COMMIT_SHA?.trim() ||
    ""

  const branch = envBranch || (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot))
  const commit = (envCommit || (await runGit(["rev-parse", "--short=12", "HEAD"], repoRoot))).slice(0, 12)

  if (!branch && !commit) return null

  return {
    branch: branch && branch !== "HEAD" ? branch : "detached",
    commit,
  }
}
