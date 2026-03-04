"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
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
    const completed = data?.filter((project) => project.status === "completed").length ?? 0;
    const processing = data?.filter((project) => project.status === "processing").length ?? 0;
    return [
      { label: "Projetos totais", value: total },
      { label: "Concluídos", value: completed },
      { label: "Em processamento", value: processing },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-lg font-semibold">Você precisa estar logado para acessar o dashboard.</p>
        <div className="mt-4 flex gap-3">
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
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Dashboard</p>
            <h1 className="text-3xl font-semibold text-white">Olá, {user?.full_name || user?.email}</h1>
            <p className="text-sm text-slate-400">
              Acompanhe seus uploads, status de processamento e exporte resultados.
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/upload")}>Novo takeoff</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              title={<p className="text-sm uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>}
            >
              <p className="text-4xl font-semibold text-white">{stat.value}</p>
            </Card>
          ))}
        </div>

        <PlanUsageCard plan={user?.plan} />

        <ProjectsTable projects={data} isLoading={isLoading} refetch={refetch} />
      </div>
    </DashboardShell>
  );
}
