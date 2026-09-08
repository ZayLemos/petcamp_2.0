"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { promoteToManager } from "@/app/actions/account"
import { SECTORS } from "@/lib/sectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sector, setSector] = useState<string>("")
  const [managerCode, setManagerCode] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        if (!sector) {
          toast.error("Selecione o seu setor.")
          setLoading(false)
          return
        }
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          // additionalFields
          sector,
        } as Parameters<typeof authClient.signUp.email>[0])
        if (error) {
          toast.error(error.message ?? "Não foi possível criar a conta.")
          setLoading(false)
          return
        }
        if (managerCode.trim()) {
          const res = await promoteToManager(managerCode)
          if (!res.ok) toast.error(res.error ?? "Código de gerente inválido.")
          else toast.success("Conta de gerente criada!")
        }
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) {
          toast.error("E-mail ou senha incorretos.")
          setLoading(false)
          return
        }
      }
      router.push("/")
      router.refresh()
    } catch (err) {
      toast.error("Algo deu errado. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 overflow-hidden rounded-3xl shadow-lg shadow-secondary/20">
          <Image src="/petcamp-logo.png" alt="PetCamp" width={84} height={84} priority />
        </div>
        <h1 className="text-2xl font-extrabold text-secondary">
          {isSignUp ? "Criar conta" : "Bem-vindo de volta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          {isSignUp
            ? "Cadastre-se para receber as promoções do seu setor."
            : "Entre para ver suas verificações de promoções."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="voce@petcamp.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        {isSignUp && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sector">Setor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Selecione seu setor" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="managerCode">
                Código de gerente <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="managerCode"
                value={managerCode}
                onChange={(e) => setManagerCode(e.target.value)}
                placeholder="Preencha apenas se for gerente"
              />
            </div>
          </>
        )}

        <Button type="submit" disabled={loading} className="mt-2 h-11 rounded-xl text-base font-bold">
          {loading ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? "Já tem conta? " : "Ainda não tem conta? "}
        <a
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          {isSignUp ? "Entrar" : "Criar conta"}
        </a>
      </p>
    </div>
  )
}
