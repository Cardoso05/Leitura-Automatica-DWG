"use client";

import { useRouter } from "next/navigation";
import { Eye, Loader2, RefreshCw } from "lucide-react";

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
            Últimos arquivos enviados e status de processamento.
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
              <th className="px-6 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Projeto
              </th>
              <th className="px-6 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Status
              </th>
              <th className="px-6 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Criado em
              </th>
              <th className="px-6 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-text-muted text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid-line">
            {projects.map((project, index) => {
              const info = statusLabels[project.status] ?? statusLabels.uploaded;
              return (
                <tr
                  key={project.id}
                  className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.04)]"
                  style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                >
                  <td className="px-6 py-4">
                    <div className="font-[family-name:var(--font-display)] text-[13px] font-bold text-blueprint-800">
                      {project.name}
                    </div>
                    <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted mt-0.5">
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
                    {project.status === "completed" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => router.push(`/dashboard/results/${project.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        Ver resultado
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted">
                        {project.status === "processing" ? "Processando..." : "Aguardando ações"}
                      </span>
                    )}
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
