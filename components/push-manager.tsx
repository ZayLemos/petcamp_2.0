"use client"

import { useEffect, useState } from "react"
import { BellRing, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { savePushSubscription, removePushSubscription } from "@/app/actions/account"
import { toast } from "sonner"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

export function PushManager() {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false)
      return
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    if (!vapidKey) {
      toast.error("As chaves de notificação ainda não foram configuradas.")
      return
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        toast.error("Permissão de notificações negada.")
        setBusy(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await savePushSubscription({ endpoint: json.endpoint, keys: json.keys })
      setEnabled(true)
      toast.success("Notificações ativadas!")
    } catch (e) {
      toast.error("Não foi possível ativar as notificações.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setEnabled(false)
      toast.success("Notificações desativadas.")
    } catch (e) {
      toast.error("Erro ao desativar.")
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu navegador não suporta notificações push. Para receber com o app fechado, instale o PetCamp na tela inicial.
      </p>
    )
  }

  return (
    <Button
      onClick={enabled ? disable : enable}
      disabled={busy}
      variant={enabled ? "outline" : "default"}
      className="w-full rounded-xl font-bold"
    >
      {enabled ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
      {enabled ? "Desativar notificações" : "Ativar notificações"}
    </Button>
  )
}
