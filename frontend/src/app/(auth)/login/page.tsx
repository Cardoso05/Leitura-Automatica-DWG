"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { fetchProfile, loginUser } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      const token = await loginUser({ email, password });
      const profile = await fetchProfile(token);
      setSession(token, profile);
      toast.success("Login realizado com sucesso");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/5 bg-slate-900/60 p-8 backdrop-blur">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">TAKEOFF.AI</p>
          <h1 className="text-3xl font-semibold text-white">Bem-vindo de volta</h1>
          <p className="text-sm text-slate-400">Acesse o dashboard para iniciar novos takeoffs.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">E-mail</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="engenheiro@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Senha</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-400">
          Ainda não tem conta?{" "}
          <Link href="/register" className="text-emerald-300 hover:text-emerald-200">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
