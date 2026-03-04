import Link from "next/link";
import { ArrowRight, CheckCircle, Zap, FileText, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";

const metrics = [
  { label: "Tempo médio", value: "37s", detail: "para gerar o quantitativo" },
  { label: "Precisão", value: "±3%", detail: "vs levantamento manual" },
  { label: "Disciplinas", value: "6", detail: "elétrica, hidráulica, HVAC e mais" },
];

const features = [
  {
    icon: FileText,
    title: "Upload inteligente de DWG/DXF",
    description:
      "Detectamos layers automaticamente, inclusive nomenclaturas brasileiras (ELET, HIDR, REDE). Suporte a arquivos até 50MB.",
  },
  {
    icon: Zap,
    title: "Motor de parsing com AI assistida",
    description:
      "Conta blocos, mede eletrodutos, interpreta textos e gera o quantitativo agrupado por disciplina com rastreabilidade.",
  },
  {
    icon: BarChart3,
    title: "Exportação pronta para compras",
    description:
      "Planilha Excel com metadados, filtros por disciplina e preparação para SINAPI/TCPO ou envio direto ao fornecedor.",
  },
];

const steps = [
  {
    number: "01",
    title: "Faça login",
    description: "Cadastre-se em segundos e controle seu plano (Free, Pro ou Business).",
  },
  {
    number: "02",
    title: "Suba a planta",
    description: "Arraste o DWG/DXF, mapeie layers e deixe o DWGScanner processar.",
  },
  {
    number: "03",
    title: "Exporte o resultado",
    description: "Receba o quantitativo, exporte Excel ou gere cobrança pay-per-use via ASAAS.",
  },
];

const plans = [
  {
    name: "Free",
    price: "R$0",
    note: "3 projetos/mês",
    perks: ["Upload DWG/DXF", "Export Excel", "1 disciplina por arquivo"],
    cta: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$97",
    note: "por mês",
    perks: ["Projetos ilimitados", "Todas disciplinas", "Histórico + dashboard"],
    cta: "/register",
    highlight: true,
  },
  {
    name: "Business",
    price: "R$247",
    note: "por mês",
    perks: ["Multiusuário", "API + ASAAS", "SINAPI integrado"],
    cta: "/register",
    highlight: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-body)] text-text-primary">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-blueprint-800/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-sm leading-none">
                T
              </span>
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-white text-base tracking-[-0.04em] uppercase">
              DWG<span className="text-electric">SCANNER</span>
              <span className="text-electric text-xs">.AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Entrar
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-blueprint-800">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 grid-pattern pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,170,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-electric/30 bg-electric/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-electric">
                MVP — Levantamento Inteligente
              </span>
              <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-[52px] leading-[1.1]">
                Transforme horas de contagem manual em{" "}
                <span className="text-electric">minutos</span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-xl">
                Upload de plantas DWG/DXF, parser assistido por AI, integração ASAAS e relatórios
                prontos para compras. Feito para orçamentistas, engenheiros MEP e construtoras
                brasileiras.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button size="lg" asChild>
                  <Link href="/register" className="gap-2">
                    Começar agora <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <Link href="/login">Já tenho conta</Link>
                </Button>
              </div>
            </div>

            {/* Metrics panel */}
            <div className="rounded-[16px] border border-white/10 bg-blueprint-900/60 p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-electric/80">
                Impacto real
              </p>
              <div className="mt-5 space-y-0 divide-y divide-white/5">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex items-center justify-between py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-white/70">{metric.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{metric.detail}</p>
                    </div>
                    <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-white tracking-[-0.03em]">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-electric mb-3">
              Funcionalidades
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Tudo que você precisa para levantamento automático
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[12px] border border-grid-line bg-sheet p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-electric/10">
                  <feature.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como Funciona ── */}
      <section className="bg-sheet py-20 border-y border-grid-line">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-electric mb-3">
              Processo
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Como funciona
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute top-6 left-[calc(50%+24px)] right-0 hidden h-[1px] bg-grid-line md:block" />
                )}
                <div className="rounded-[12px] border border-grid-line bg-surface p-6">
                  <span className="font-[family-name:var(--font-mono)] text-3xl font-bold text-electric/30 leading-none">
                    {step.number}
                  </span>
                  <h3 className="font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800 mt-3 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack Banner ── */}
      <section className="gradient-hero py-16">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="absolute inset-0 grid-pattern rounded-[16px] pointer-events-none" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-electric/80 mb-3">
                Deploy imediato
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white tracking-[-0.02em]">
                Railway + Vercel + ASAAS
              </h2>
              <p className="mt-2 text-white/60 text-sm max-w-lg leading-relaxed">
                Backend FastAPI preparado para o Railway com PostgreSQL/Redis, frontend Next.js
                pronto para o Vercel e billing ASAAS com checkout pay-per-use.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              {[
                "Upload DWG/DXF até 50MB",
                "Parsing ezdxf + mapeamento de blocos customizados",
                "Export Excel e histórico de projetos",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-electric shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-electric mb-3">
              Planos
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Escolha a forma de validação
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={[
                  "relative rounded-[12px] border p-6 flex flex-col",
                  "shadow-[0_1px_4px_rgba(0,0,0,0.04)]",
                  "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200",
                  plan.highlight
                    ? "border-electric bg-sheet"
                    : "border-grid-line bg-sheet",
                ].join(" ")}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-electric px-3 py-1 text-[11px] font-bold text-blueprint-800 uppercase tracking-wide shadow-[0_2px_8px_rgba(0,212,170,0.3)]">
                    Mais Popular
                  </span>
                )}
                <div className="mb-5">
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-blueprint-800 mb-3">
                    {plan.name}
                  </h3>
                  <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-blueprint-800 tracking-[-0.03em]">
                    {plan.price}
                  </p>
                  <p className="text-sm text-text-muted mt-1">{plan.note}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-text-primary">
                      <CheckCircle className="h-4 w-4 text-electric shrink-0" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? "primary" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link href={plan.cta}>Começar</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-blueprint-900 border-t border-white/5 px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-[10px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-xs leading-none">
                T
              </span>
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-white/60 text-sm tracking-[-0.04em] uppercase">
              DWG<span className="text-electric/60">SCANNER</span>
            </span>
          </Link>
          <p className="text-xs text-text-muted">
            Construído para DELMAT Engenharia · Março/2026 · Railway + Vercel
          </p>
        </div>
      </footer>
    </div>
  );
}
