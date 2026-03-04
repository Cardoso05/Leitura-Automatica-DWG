"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { downloadResult, fetchResult } from "@/lib/api-client";

const disciplineMap: Record<string, string> = {
  eletrica: "eletrica",
  elétrica: "eletrica",
  hidraulica: "hidraulica",
  hidráulica: "hidraulica",
  rede: "rede",
  cabeamento: "rede",
  hvac: "hvac",
  "ar-condicionado": "hvac",
  incendio: "incendio",
  incêndio: "incendio",
  gas: "gas",
  gás: "gas",
};

function normalizeDiscipline(disc: string | null | undefined): string {
  if (!disc) return "";
  return disciplineMap[disc.toLowerCase()] ?? "";
}

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
      link.download = `dwgscanner-${projectId}.xlsx`;
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
        <p className="text-sm text-text-muted">Faça login para visualizar os resultados.</p>
      </DashboardShell>
    );
  }

  if (isLoading || !data) {
    return (
      <DashboardShell>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-electric" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-7 font-[family-name:var(--font-body)]">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-blueprint-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Resultado #{projectId}
            </h1>
            <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Resumo do takeoff e itens contabilizados.
            </p>
          </div>
          <Button className="shrink-0 gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {summaryEntries.map((entry) => {
            const discKey = normalizeDiscipline(entry.discipline);
            return (
              <Card key={entry.discipline}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                    {entry.discipline}
                  </p>
                  {discKey && (
                    <Badge tone={discKey} variant="discipline" label={entry.discipline} />
                  )}
                </div>
                <p className="font-[family-name:var(--font-display)] text-[36px] font-bold text-blueprint-800 tracking-[-0.03em] leading-none">
                  {entry.total.toFixed(2)}
                </p>
              </Card>
            );
          })}
        </div>

        {/* ── Items Table ── */}
        <Card title="Itens contabilizados">
          <div className="rounded-[10px] overflow-hidden border border-grid-line -mx-1">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-blueprint-800 text-left">
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                    Disciplina
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                    Item
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                    Unidade
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80 text-right">
                    Qtd.
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                    Layer
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => {
                  const discKey = normalizeDiscipline(item.discipline);
                  const isEven = index % 2 === 0;
                  return (
                    <tr
                      key={`${item.description}-${index}`}
                      className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)]"
                      style={{ backgroundColor: isEven ? "#FFFFFF" : "#F8FAFC" }}
                    >
                      <td className="px-4 py-3">
                        {discKey ? (
                          <Badge tone={discKey} variant="discipline" label={item.discipline ?? discKey} />
                        ) : (
                          <span className="text-xs text-text-muted uppercase tracking-wide">
                            {item.discipline ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-[family-name:var(--font-body)] text-[13px] font-medium text-text-primary">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">{item.unit}</td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800">
                        {item.quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                        {item.layer ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
