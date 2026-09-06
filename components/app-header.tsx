import Image from "next/image"
import { NotificationBell } from "@/components/notification-bell"
import type { AppNotification } from "@/components/notification-bell"

export function AppHeader({
  title,
  subtitle,
  notifications,
  unread,
}: {
  title: string
  subtitle?: string
  notifications: AppNotification[]
  unread: number
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-secondary/20 bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-xl bg-primary/0">
            <Image src="/petcamp-logo.png" alt="PetCamp" width={40} height={40} />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold">{title}</h1>
            {subtitle && <p className="text-xs text-secondary-foreground/70">{subtitle}</p>}
          </div>
        </div>
        <NotificationBell notifications={notifications} unread={unread} />
      </div>
    </header>
  )
}
