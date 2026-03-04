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
  const [form, setForm] = useState({ email: "", password: "", full_name: "", company: "" });
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
    <div className="flex min-h-screen font-[family-name:var(--font-body)]">
      {/* ── Lado Esquerdo (escuro) ── */}
      <div className="relative hidden lg:flex lg:w-[42%] flex-col items-center justify-center bg-blueprint-800 overflow-hidden">
        <div className="absolute inset-0 grid-pattern pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,212,170,0.1) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-8 px-10 text-center max-w-sm">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-xl leading-none">
                T
              </span>
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-white text-xl tracking-[-0.04em] uppercase">
              DWG<span className="text-electric">SCANNER</span>
              <span className="text-electric text-sm">.AI</span>
            </span>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white tracking-[-0.02em] leading-snug">
              Comece a economizar tempo hoje
            </h2>
            <p className="text-sm text-white/50 mt-3 leading-relaxed">
              Plano Free com 3 projetos/mês. Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-white/60 w-full text-left">
            {[
              "Upload de DWG/DXF até 50MB",
              "Exportação Excel pronta para compras",
              "Suporte a 6 disciplinas de engenharia",
              "Histórico de projetos no dashboard",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-electric text-base leading-none">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Lado Direito (branco) ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-sheet px-6 py-12">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-2">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-sm leading-none">T</span>
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-base tracking-[-0.04em] uppercase">
              DWG<span className="text-electric">SCANNER</span>
            </span>
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Crie sua conta
            </h1>
            <p className="text-sm text-text-muted mt-1.5">
              Valide o MVP Free (3 projetos/mês) e desbloqueie planos Pro/Business quando precisar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Nome completo</label>
              <Input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="João da Silva"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Empresa</label>
              <Input
                name="company"
                value={form.company}
                onChange={handleChange}
                placeholder="DELMAT Engenharia"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">E-mail</label>
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="orcamentos@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Senha</label>
              <Input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Criando conta..." : "Começar grátis"}
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted">
            Já usa o DWGScanner?{" "}
            <Link href="/login" className="font-semibold text-electric hover:text-electric-dark transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
