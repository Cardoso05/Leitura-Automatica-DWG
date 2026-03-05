"use client";

import { useRouter } from "next/navigation";
import {
  Eye,
  Loader2,
  Play,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

import type { Project } from "@/lib/types";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type BadgeTone = Parameters<typeof Badge>[0]["tone"];

const statusLabels: Record<string, { label: string; tone: BadgeTone }> = {
  completed: { label: "Concluído", tone: "completed" },
  processing: { label: "Processando", tone: "processing" },
  waiting_layers: { label: "Aguardando mapeamento", tone: "waiting_layers" },
  uploaded: { label: "Arquivo recebido", tone: "uploaded" },
  failed: { label: "Falhou", tone: "failed" },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function getProjectRoute(project: Project): string {
  switch (project.status) {
    case "completed":
      return `/dashboard/results/${project.id}`;
    case "processing":
      return `/dashboard/results/${project.id}`;
    case "waiting_layers":
    case "uploaded":
      return `/dashboard/projects/${project.id}`;
    case "failed":
      return `/dashboard/projects/${project.id}`;
    default:
      return `/dashboard/projects/${project.id}`;
  }
}

export function ProjectsTable({
  projects,
  isLoading,
  refetch,
}: {
  projects: Project[] | undefined;
  isLoading: boolean;
  refetch: () => void;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[12px] border border-grid-line bg-sheet">
        <Loader2 className="h-6 w-6 animate-spin text-electric" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="rounded-[12px] border border-grid-line bg-sheet p-10 text-center">
        <p className="font-[family-name:var(--font-display)] text-base font-bold text-blueprint-800 mb-1">
          Comece seu primeiro takeoff
        </p>
        <p className="text-sm text-text-muted mb-5">
          Suba um DWG/DXF e gere o quantitativo em minutos.
        </p>
        <Button onClick={() => router.push("/dashboard/upload")}>
          Novo projeto
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-grid-line bg-sheet shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-grid-line px-6 py-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800">
            Projetos recentes
          </p>
          <p className="text-sm text-text-muted mt-0.5">
            Clique em um projeto para continuar ou ver resultados.
          </p>
        </div>
        <Button variant="ghost" className="gap-2 text-sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-grid-line text-sm">
          <thead>
            <tr className="bg-surface text-left">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Projeto
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Status
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Criado em
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted text-right">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid-line">
            {projects.map((project, index) => {
              const info = statusLabels[project.status] ?? statusLabels.uploaded;
              const route = getProjectRoute(project);
              return (
                <tr
                  key={project.id}
                  className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)] cursor-pointer group"
                  style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                  onClick={() => router.push(route)}
                >
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-bold text-blueprint-800 group-hover:text-electric transition-colors">
                      {project.name}
                    </div>
                    <p className="font-mono text-[11px] text-text-muted mt-0.5">
                      {project.original_filename}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge label={info.label} tone={info.tone} />
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">
                    {formatDate(project.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ProjectAction status={project.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectAction({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-electric">
          <Eye className="h-4 w-4" />
          Ver resultado
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-electric" />
          Processando...
        </span>
      );
    case "waiting_layers":
    case "uploaded":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600">
          <Play className="h-4 w-4" />
          Configurar e processar
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
          <AlertCircle className="h-4 w-4" />
          Tentar novamente
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
          Abrir
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </span>
      );
  }
}
