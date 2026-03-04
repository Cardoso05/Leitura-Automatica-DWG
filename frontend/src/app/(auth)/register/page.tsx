"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { fetchProfile, loginUser, registerUser } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await registerUser(form);
      const token = await loginUser({ email: form.email, password: form.password });
      const profile = await fetchProfile(token);
      setSession(token, profile);
      toast.success("Conta criada com sucesso");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-xl space-y-8 rounded-3xl border border-white/5 bg-slate-900/60 p-8 backdrop-blur">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">TAKEOFF.AI</p>
          <h1 className="text-3xl font-semibold text-white">Crie sua conta</h1>
          <p className="text-sm text-slate-400">
            Valide o MVP Free (3 projetos/mês) e desbloqueie planos Pro/Business quando precisar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-slate-300">Nome completo</label>
            <Input name="full_name" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Empresa</label>
            <Input name="company" value={form.company} onChange={handleChange} placeholder="DELMAT Engenharia" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">E-mail</label>
            <Input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="orcamentos@exemplo.com"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-slate-300">Senha</label>
            <Input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <Button type="submit" className="md:col-span-2" disabled={loading}>
            {loading ? "Criando conta..." : "Começar"}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-400">
          Já usa o TAKEOFF.AI?{" "}
          <Link href="/login" className="text-emerald-300 hover:text-emerald-200">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
