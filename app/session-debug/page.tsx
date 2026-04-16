import { auth } from "@/auth"

export default async function SessionDebugPage() {
  const session = await auth()

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Session Debug</h1>
      <pre className="mt-4 whitespace-pre-wrap rounded border p-4 text-sm">
        {JSON.stringify(session?.user ?? null, null, 2)}
      </pre>
    </main>
  )
}
