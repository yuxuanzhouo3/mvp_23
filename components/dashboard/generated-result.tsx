"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type GenerateGetResp = {
  projectId?: string
  jobId: string
  status: "done" | "running" | "queued" | "error"
  logs?: string[]
  appUrl?: string
  repoUrl?: string
  error?: string
  localPath?: string
  runCommands?: string[]
}

export function GeneratedResult({ jobId }: { jobId: string }) {
  const [data, setData] = useState<GenerateGetResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>("")

  async function fetchOnce() {
    try {
      setErr("")
      const res = await fetch(`/api/generate?projectId=${encodeURIComponent(jobId)}`)
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt)
      }
      const json = (await res.json()) as GenerateGetResp
      setData(json)
    } catch (e: any) {
      setErr(e?.message || "请求失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let timer: any

    async function run() {
      await fetchOnce()

      // 如果还没 done，就每 1 秒轮询一次（后续可替换成异步任务）
      timer = setInterval(async () => {
        const res = await fetch(`/api/generate?projectId=${encodeURIComponent(jobId)}`)
        if (!res.ok) return
        const json = (await res.json()) as GenerateGetResp
        setData(json)
        if (json.status === "done" || json.status === "error") {
          clearInterval(timer)
        }
      }, 1000)
    }

    run()
    return () => timer && clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-semibold">生成结果</div>

      <div className="mt-2 text-xs text-muted-foreground">
        Job ID: <span className="font-mono">{jobId}</span>
      </div>

      {loading ? <div className="mt-3 text-sm">加载中...</div> : null}

      {err ? <div className="mt-3 text-sm text-red-500">错误: {err}</div> : null}

      {data ? (
        <>
          <div className="mt-3 text-sm">
            状态: <span className="font-semibold">{data.status}</span>
          </div>

          {data.appUrl || data.repoUrl ? (
            <div className="mt-3 space-y-2 text-sm">
              {data.appUrl ? (
                <div>
                  App URL:{" "}
                  <a className="underline" href={data.appUrl} target="_blank" rel="noreferrer">
                    {data.appUrl}
                  </a>
                </div>
              ) : null}
              {data.repoUrl ? (
                <div>
                  Repo: <span className="font-mono">{data.repoUrl}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {data.localPath ? (
            <div className="mt-2 text-sm">
              本地路径: <span className="font-mono">{data.localPath}</span>
            </div>
          ) : null}

          {data.runCommands?.length ? (
            <div className="mt-3">
              <div className="text-sm font-medium mb-2">如何运行</div>
              <pre className="text-xs whitespace-pre-wrap rounded-md bg-secondary p-3 border border-border">
                {data.runCommands.join("\n")}
              </pre>
            </div>
          ) : null}

          {data.logs?.length ? (
            <div className="mt-3">
              <div className="text-sm font-medium mb-2">Logs</div>
              <pre className="text-xs whitespace-pre-wrap rounded-md bg-secondary p-3 border border-border">
                {data.logs.join("\n")}
              </pre>
            </div>
          ) : null}

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={fetchOnce}>
              手动刷新
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
