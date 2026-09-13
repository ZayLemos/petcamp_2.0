"use client"

import { useEffect, useMemo, useState } from "react"
import { ImagePlus, MessageCircle, RefreshCw, Send } from "lucide-react"

type Update = { id: number; ids?: number[]; taskId: number; sector: string; updateText: string; employeeName: string | null; photoPath: string | null; createdAt: string; managerReadAt: string | null; approvedAt?: string | null }
type Reply = { id: number; updateId: number; authorName: string; message: string; photoPath: string | null; createdAt: string }

export function TaskUpdatesChat() {
  const [updates, setUpdates] = useState<Update[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [isManager, setIsManager] = useState(false)

  async function load() {
    const response = await fetch("/api/task-updates", { cache: "no-store" })
    if (!response.ok) return
    const data = await response.json()
    setUpdates(data.updates)
    setReplies(data.replies)
    setIsManager(data.isManager === true)
    if (selected === null && data.updates[0]) setSelected(data.updates[0].id)
  }
  useEffect(() => { load() }, [])
  const currentReplies = useMemo(() => replies.filter((reply) => reply.updateId === selected), [replies, selected])
  async function sendReply(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !message.trim()) return
    setLoading(true)
    const form = new FormData()
    form.set("updateId", String(selected)); form.set("message", message)
    if (photo) form.set("photo", photo)
    const response = await fetch("/api/task-updates", { method: "POST", body: form })
    if (response.ok) { setMessage(""); setPhoto(null); await load() }
    setLoading(false)
  }
  async function markRead(id: number) {
    await fetch("/api/task-updates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updateId: id }) })
    setUpdates((items) => items.map((item) => item.id === id ? { ...item, managerReadAt: new Date().toISOString() } : item))
  }
  async function approve(update: Update) {
    await fetch("/api/task-updates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updateId: update.ids || [update.id], action: "approve" }) })
    setUpdates((items) => items.filter((item) => item.id !== update.id)); setSelected(null)
  }

  return <section className="rounded-2xl border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" /><div><h2 className="font-extrabold">Atualizações das tarefas</h2><p className="text-sm text-muted-foreground">Conclusões agrupadas por conjunto do dia.</p></div></div><button onClick={load} className="rounded-lg border p-2" aria-label="Atualizar"><RefreshCw className="size-4" /></button></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><div className="max-h-[420px] space-y-2 overflow-auto">{updates.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nenhuma atualização pendente.</p> : updates.map((update) => <button key={update.id} onClick={() => { setSelected(update.id); if (!update.managerReadAt) markRead(update.id) }} className={`w-full rounded-xl border p-3 text-left ${selected === update.id ? "border-primary bg-primary/5" : "bg-muted/50"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{update.employeeName || "Funcionário"}</p><p className="text-xs text-muted-foreground">{update.sector} · conjunto de {new Date(update.createdAt).toLocaleDateString("pt-BR")}</p></div>{!update.managerReadAt && <span className="size-2 rounded-full bg-primary" />}</div><p className="mt-2 text-sm">{update.updateText}</p></button>)}</div>
      <div className="rounded-xl border bg-background p-4"><div className="max-h-[280px] space-y-3 overflow-auto">{currentReplies.map((reply) => <div key={reply.id} className="rounded-xl bg-muted p-3"><p className="text-xs font-bold text-primary">{reply.authorName}</p><p className="mt-1 text-sm">{reply.message}</p>{reply.photoPath && <img src={`/api/task-updates/photo?pathname=${encodeURIComponent(reply.photoPath)}`} alt="Foto da conversa" className="mt-2 max-h-48 rounded-lg object-cover" />}</div>)}</div>{selected && <><form onSubmit={sendReply} className="mt-4 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva uma atualização..." className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm" /><label className="cursor-pointer rounded-xl border p-2" aria-label="Adicionar foto"><ImagePlus className="size-5" /><input type="file" accept="image/*" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label><button disabled={loading} className="rounded-xl bg-primary p-2 text-primary-foreground" aria-label="Enviar"><Send className="size-5" /></button></form>{isManager && <button onClick={() => approve(updates.find((item) => item.id === selected)!)} className="mt-3 w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Aprovar conjunto do dia e encerrar</button>}</>}</div></div>
  </section>
}
