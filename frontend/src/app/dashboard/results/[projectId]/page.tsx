"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { downloadResult, fetchResult } from "@/lib/api-client";

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["project-result", projectId, token],
    queryFn: () => fetchResult(projectId, token as string),
    enabled: !!token && Number.isFinite(projectId),
  });

  const summaryEntries = useMemo(
    () =>
      data
        ? Object.entries(data.summary).map(([discipline, total]) => ({
            discipline,
            total,
          }))
        : [],
    [data]
  );

  const handleDownload = async () => {
    if (!token) return;
    try {
      const blob = await downloadResult(projectId, token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `takeoff-${projectId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    }
  };

  if (!token) {
    return (
      <DashboardShell>
        <p className="text-sm text-slate-400">Faça login para visualizar os resultados.</p>
      </DashboardShell>
    );
  }

  if (isLoading || !data) {
    return (
      <DashboardShell>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <h1 className="text-3xl font-semibold text-white">Resultado #{projectId}</h1>
            <p className="text-sm text-slate-400">Resumo do takeoff e itens contabilizados.</p>
          </div>
          <Button className="gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryEntries.map((entry) => (
            <Card
              key={entry.discipline}
              title={<p className="text-sm uppercase tracking-[0.3em] text-slate-400">{entry.discipline}</p>}
            >
              <p className="text-4xl font-semibold text-white">{entry.total.toFixed(2)}</p>
            </Card>
          ))}
        </div>

        <Card title="Itens contabilizados">
          <div className="max-h-[480px] overflow-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-4 py-3">Disciplina</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Qtd.</th>
                  <th className="px-4 py-3">Layer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                      {item.discipline ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{item.description}</td>
                    <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                    <td className="px-4 py-3 text-white">{item.quantity.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-400">{item.layer ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
