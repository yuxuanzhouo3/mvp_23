"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function GoogleSignInButton({ callbackUrl = "/projects" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-14 w-full rounded-2xl border-slate-200 bg-white text-base font-medium text-slate-900 hover:bg-slate-50"
      onClick={() => signIn("google", { callbackUrl })}
    >
      Continue with Google
    </Button>
  )
}
