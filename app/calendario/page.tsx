import { redirect } from "next/navigation"
import { toggleTaskCompletion } from "@/app/actions/account"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { CalendarView } from "@/components/calendar-view"
import { getAllTasks, getCurrentUser, getNotifications, getSession, getTasksForSector, getUnreadCount } from "@/lib/data"

export default async function CalendarPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const employee = await getCurrentUser()
  if (!employee) redirect("/sign-in")

  const [tasks, notifications, unread] = await Promise.all([
    employee.role === "manager" ? getAllTasks() : getTasksForSector(employee.sector ?? ""),
    getNotifications(employee.id),
    getUnreadCount(employee.id),
  ])

  return (
    <main className="min-h-dvh bg-background pb-20">
      <AppHeader
        title="Calendário"
        subtitle="Promoções e verificações agendadas"
        notifications={notifications}
        unread={unread}
      />
      <CalendarView tasks={tasks} sector={employee.sector} isManager={employee.role === "manager"} toggleTaskCompletion={toggleTaskCompletion} />
      <BottomNav isManager={employee.role === "manager"} />
    </main>
  )
}
