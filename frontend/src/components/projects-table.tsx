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
      <div className="flex h-40 items-center justify-center rounded-2xl border border-white/5 bg-white/5">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-white">Comece seu primeiro takeoff</p>
        <p className="text-sm text-slate-400">
          Suba um DWG/DXF e gere o quantitativo em minutos.
        </p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/upload")}>
          Novo projeto
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <p className="text-lg font-semibold text-white">Projetos recentes</p>
          <p className="text-sm text-slate-400">
            Últimos arquivos enviados e status de processamento.
          </p>
        </div>
        <Button variant="ghost" className="gap-2 text-sm text-slate-300" onClick={refetch}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <th className="px-6 py-4">Projeto</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Criado em</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {projects.map((project) => {
              const info = statusLabels[project.status] ?? statusLabels.uploaded;
              return (
                <tr key={project.id} className="text-slate-200">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{project.name}</div>
                    <p className="text-xs text-slate-400">{project.original_filename}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge label={info.label} tone={info.tone} />
                  </td>
                  <td className="px-6 py-4">{formatDate(project.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    {project.status === "completed" ? (
                      <Button variant="ghost" className="gap-2" onClick={() => router.push(`/dashboard/results/${project.id}`)}>
                        <Eye className="h-4 w-4" />
                        Ver resultado
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">
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
