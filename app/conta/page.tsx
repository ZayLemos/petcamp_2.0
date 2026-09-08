import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { getCurrentUser, getNotifications, getSession, getUnreadCount } from "@/lib/data"

export default async function AccountPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const employee = await getCurrentUser()
  if (!employee) redirect("/sign-in")

  const [notifications, unread] = await Promise.all([
    getNotifications(employee.id),
    getUnreadCount(employee.id),
  ])

  return (
    <main className="min-h-dvh bg-background pb-20">
      <AppHeader title="Minha conta" subtitle="Seus dados de acesso" notifications={notifications} unread={unread} />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-primary-foreground">
              {employee.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-extrabold">{employee.name}</h2>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Informações do acesso</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Setor</dt>
              <dd className="font-bold text-right">{employee.sector ?? "Não definido"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Permissão</dt>
              <dd className="font-bold text-right">{employee.role === "manager" ? "Gerente" : "Colaborador"}</dd>
            </div>
          </dl>
        </section>
        {employee.role !== "manager" && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h2 className="text-lg font-extrabold">Acesso de gerente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Para criar uma conta com permissão de gerente, use o código autorizado no cadastro de uma nova conta.
            </p>
            <p className="mt-3 rounded-xl bg-background px-4 py-3 text-center font-mono text-sm font-bold tracking-wide">
              petcamp-gerente
            </p>
          </section>
        )}
      </div>
      <BottomNav isManager={employee.role === "manager"} />
    </main>
  )
}
