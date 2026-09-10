"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function logout() {
    setLoading(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }
  return <button type="button" onClick={logout} disabled={loading} className="w-full rounded-xl border border-destructive/30 px-4 py-3 text-sm font-bold text-destructive disabled:opacity-60">{loading ? "Saindo..." : "Deslogar da conta"}</button>
}
