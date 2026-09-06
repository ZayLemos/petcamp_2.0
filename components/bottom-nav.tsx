"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, LayoutDashboard, ShieldCheck, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav({ isManager }: { isManager: boolean }) {
  const pathname = usePathname()

  const items = [
    { href: "/painel", label: "Painel", icon: LayoutDashboard },
    { href: "/calendario", label: "Calendário", icon: CalendarDays },
    ...(isManager ? [{ href: "/gerente", label: "Gerente", icon: ShieldCheck }] : []),
    { href: "/conta", label: "Conta", icon: User },
  ]

  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.6 : 2} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
