import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { ManagerPanel } from "@/components/manager-panel"
import { getCurrentUser, getNotifications, getUnreadCount, getAllTasks } from "@/lib/data"

export default async function ManagerPage() {
  // Verifica se o usuário está autenticado no sistema
  const manager = await getCurrentUser()
  if (!manager) redirect("/sign-in")
  
  // Restringe o acesso apenas para usuários com a role de gerente (manager)
  if (manager.role !== "manager") redirect("/painel")
  
  // Busca em paralelo as tarefas, notificações e mensagens não lidas
  const [tasks, notifications, unread] = await Promise.all([
    getAllTasks(),
    getNotifications(manager.id),
    getUnreadCount(manager.id),
  ])

  return (
    <main className="min-h-dvh bg-background pb-20">
      {/* Cabeçalho superior com informações e sininho de notificações */}
      <AppHeader 
        title="Conta do gerente" 
        subtitle="Acompanhe a equipe e importe tarefas" 
        notifications={notifications} 
        unread={unread} 
      />
      
      {/* Painel centralizado que renderiza o componente de upload corrigido com accept="*/*" */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ManagerPanel tasks={tasks} />
      </div>
      
      {/* Barra de navegação inferior do gerente */}
      <BottomNav isManager />
    </main>
  )
}
