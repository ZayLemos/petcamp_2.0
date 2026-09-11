import { redirect } from "next/navigation"
import { getSession } from "@/lib/data"

export default async function HomePage() {
  const session = await getSession()
  if (session?.user) redirect("/painel")
  redirect("/sign-in")
}
