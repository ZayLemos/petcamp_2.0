import { redirect } from "next/navigation"
import { getSession } from "@/lib/data"
import { AuthForm } from "@/components/auth-form"

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect("/painel")
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-secondary/10 to-background px-4 py-10">
      <AuthForm mode="sign-up" />
    </main>
  )
}
