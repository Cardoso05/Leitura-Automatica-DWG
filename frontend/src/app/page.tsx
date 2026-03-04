import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const metrics = [
  { label: "Tempo médio", value: "37s", detail: "para gerar o quantitativo" },
  { label: "Precisão", value: "±3%", detail: "vs levantamento manual" },
  { label: "Disciplinas", value: "4", detail: "elétrica, hidráulica, rede, HVAC beta" },
];

const features = [
  {
    title: "Upload inteligente de DWG/DXF",
    description: "Detectamos layers automaticamente, inclusive nomenclaturas brasileiras (ELET, HIDR, REDE).",
  },
  {
    title: "Motor de parsing com AI assistida",
    description: "Conta blocos, mede eletrodutos, interpreta textos e gera o quantitativo agrupado por disciplina.",
  },
  {
    title: "Exportação pronta para compras",
    description: "Planilha Excel com metadados, filtros e preparação para SINAPI/TCPO ou envio ao fornecedor.",
  },
];

const steps = [
  { title: "1. Faça login", description: "Cadastre-se em segundos e controle seu plano (Free, Pro ou Business)." },
  { title: "2. Suba a planta", description: "Arraste o DWG/DXF, mapeie layers e deixe o TAKEOFF.AI processar." },
  { title: "3. Aprove propostas", description: "Receba o quantitativo, exporte ou gere cobrança pay-per-use (ASAAS)." },
];

const plans = [
  {
    name: "Free",
    price: "R$0",
    note: "3 projetos/mês",
    perks: ["Upload DWG/DXF", "Export Excel", "1 disciplina por arquivo"],
    cta: "/register",
  },
  {
    name: "Pro",
    price: "R$97",
    note: "por mês",
    perks: ["Projetos ilimitados", "Todas disciplinas", "Histórico + dashboard"],
    highlight: true,
    cta: "/register",
  },
  {
    name: "Business",
    price: "R$247",
    note: "por mês",
    perks: ["Multiusuário", "API + ASAAS", "SINAPI integrado"],
    cta: "/register",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link href="/" className="text-xl font-semibold tracking-tight text-white">
            TAKEOFF<span className="text-emerald-400">.AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
              Entrar
            </Link>
            <Button asChild>
              <Link href="/register">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <p className="inline-flex rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-emerald-300">
              MVP - Levantamento inteligente
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Transforme horas de contagem manual em minutos com o TAKEOFF.AI
            </h1>
            <p className="text-lg text-slate-300">
              Upload de plantas DWG/DXF, parser assistido por AI, integração ASAAS e relatórios prontos
              para compras. Feito para orçamentistas, engenheiros MEP e construtoras brasileiras.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="px-8" asChild>
                <Link href="/register">Começar agora</Link>
              </Button>
              <Button variant="outline" size="lg" className="px-8" asChild>
                <Link href="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Impacto real</p>
            <div className="mt-6 space-y-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-none">
                  <div>
                    <p className="text-sm text-slate-400">{metric.label}</p>
                    <p className="text-xs text-slate-500">{metric.detail}</p>
                  </div>
                  <p className="text-3xl font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} title={feature.title} description={feature.description} />
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} title={step.title} description={step.description} />
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/70">Deploy imediato</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Railway + Vercel + ASAAS</h2>
              <p className="mt-3 max-w-2xl text-slate-300">
                Backend FastAPI preparado para o Railway com PostgreSQL/Redis, frontend Next.js pronto
                para o Vercel e billing ASAAS com checkout pay-per-use. Basta configurar as variáveis de
                ambiente e publicar.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-300">
              <p>✅ Upload DWG/DXF até 50MB</p>
              <p>✅ Parsing ezdxf + mapeamento de blocos customizados</p>
              <p>✅ Export Excel e histórico de projetos</p>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-200/70">Planos</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Escolha a forma de validação</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                title={
                  <div className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    {plan.highlight && (
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
                        Mais vendido
                      </span>
                    )}
                  </div>
                }
                description={
                  <div className="space-y-1 text-white">
                    <p className="text-3xl font-semibold">{plan.price}</p>
                    <p className="text-sm text-slate-400">{plan.note}</p>
                  </div>
                }
              >
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {plan.perks.map((perk) => (
                    <li key={perk}>• {perk}</li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={plan.highlight ? "primary" : "outline"} asChild>
                  <Link href={plan.cta}>Começar</Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-4 py-6 text-center text-xs text-slate-500">
        Construído para DELMAT Engenharia · Março/2026 · Hospede no Railway + Vercel em minutos.
      </footer>
    </div>
  );
}
