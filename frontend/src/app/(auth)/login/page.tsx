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
    <div className="flex min-h-screen font-[family-name:var(--font-body)]">
      {/* ── Lado Esquerdo (escuro) ── */}
      <div className="relative hidden lg:flex lg:w-[42%] flex-col items-center justify-center bg-blueprint-800 overflow-hidden">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 grid-pattern pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,212,170,0.1) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-8 px-10 text-center max-w-sm">
          {/* Logo */}
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
              A planta que se lê sozinha
            </h2>
            <p className="text-sm text-white/50 mt-3 leading-relaxed">
              Levantamento automático de materiais a partir de plantas DWG/DXF para engenheiros e
              orçamentistas brasileiros.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full pt-2">
            {[
              { value: "37s", label: "Tempo médio" },
              { value: "±3%", label: "Precisão" },
              { value: "6", label: "Disciplinas" },
            ].map((m) => (
              <div key={m.label} className="rounded-[10px] border border-white/10 bg-white/5 p-3 text-center">
                <p className="font-[family-name:var(--font-display)] text-lg font-bold text-electric tracking-[-0.03em]">
                  {m.value}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lado Direito (branco) ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-sheet px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
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
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-text-muted mt-1.5">
              Acesse o dashboard para iniciar novos takeoffs.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">E-mail</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engenheiro@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Senha</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted">
            Ainda não tem conta?{" "}
            <Link href="/register" className="font-semibold text-electric hover:text-electric-dark transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
