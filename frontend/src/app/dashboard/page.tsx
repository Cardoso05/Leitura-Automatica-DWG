"use client";

import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { PlanUsageCard } from "@/components/plan-usage-card";
import { ProjectsTable } from "@/components/projects-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { listProjects } from "@/lib/api-client";

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["projects", token],
    queryFn: () => listProjects(token as string),
    enabled: !!token,
  });

  const stats = useMemo(() => {
    const total = data?.length ?? 0;
    const completed = data?.filter((p) => p.status === "completed").length ?? 0;
    const processing = data?.filter((p) => p.status === "processing").length ?? 0;
    return [
      { label: "Projetos totais", value: total },
      { label: "Concluídos", value: completed },
      { label: "Em processamento", value: processing },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-electric" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-blueprint-800">
          Você precisa estar logado para acessar o dashboard.
        </h2>
        <div className="mt-5 flex gap-3">
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-7 font-[family-name:var(--font-body)]">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-electric mb-1">
              Dashboard
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Olá, {user?.full_name?.split(" ")[0] || user?.email}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Acompanhe seus uploads, status de processamento e exporte resultados.
            </p>
          </div>
          <Button
            className="shrink-0 gap-2"
            onClick={() => router.push("/dashboard/upload")}
          >
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} statusBar="none">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
                {stat.label}
              </p>
              <p className="font-[family-name:var(--font-display)] text-[36px] font-bold text-blueprint-800 tracking-[-0.03em] leading-none animate-count">
                {stat.value}
              </p>
            </Card>
          ))}
        </div>

        {/* ── Plan Usage ── */}
        <PlanUsageCard plan={user?.plan} />

        {/* ── Projects Table ── */}
        <ProjectsTable projects={data} isLoading={isLoading} refetch={refetch} />
      </div>
    </DashboardShell>
  );
}
