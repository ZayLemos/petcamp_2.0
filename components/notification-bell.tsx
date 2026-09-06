"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markAllRead } from "@/app/actions/notifications"
import { cn } from "@/lib/utils"

export type AppNotification = {
  id: number
  title: string
  body: string
  type: string
  read: boolean
  createdAt: Date
}

export function NotificationBell({ notifications, unread }: { notifications: AppNotification[]; unread: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full text-secondary-foreground hover:bg-white/10 hover:text-secondary-foreground"
        aria-label="Notificações"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-bold">Notificações</span>
              {unread > 0 && (
                <form action={markAllRead}>
                  <button type="submit" className="text-xs font-semibold text-primary hover:underline">
                    Marcar todas
                  </button>
                </form>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-border px-4 py-3 last:border-0",
                      !n.read && "bg-accent/50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                      <div className={cn(!n.read ? "" : "pl-4")}>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="text-sm text-muted-foreground text-pretty">{n.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
