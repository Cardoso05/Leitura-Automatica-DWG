"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Clock, Zap, Ruler, Scale } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { downloadResult, fetchResult } from "@/lib/api-client";

const disciplineMap: Record<string, string> = {
  eletrica: "electrical",
  elétrica: "electrical",
  electrical: "electrical",
  hidraulica: "plumbing",
  hidráulica: "plumbing",
  plumbing: "plumbing",
  rede: "networking",
  cabeamento: "networking",
  networking: "networking",
  hvac: "hvac",
  "ar-condicionado": "hvac",
  incendio: "fire",
  incêndio: "fire",
  fire: "fire",
  gas: "gas",
  gás: "gas",
  spda: "spda",
  generic: "generic",
};

const disciplineLabels: Record<string, string> = {
  electrical: "Elétrica",
  plumbing: "Hidráulica",
  networking: "Rede/Dados",
  hvac: "HVAC",
  fire: "Incêndio",
  gas: "Gás",
  spda: "SPDA",
  generic: "Outros",
};

function normalizeDiscipline(disc: string | null | undefined): string {
  if (!disc) return "generic";
  return disciplineMap[disc.toLowerCase()] ?? "generic";
}

function getDisciplineLabel(disc: string): string {
  const normalized = normalizeDiscipline(disc);
  return disciplineLabels[normalized] ?? disc;
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

  const { blockEntries, linearEntries, metadata } = useMemo(() => {
    if (!data) return { blockEntries: [], linearEntries: [], metadata: null };
    
    const blocks: Array<{ discipline: string; total: number }> = [];
    const linear: Array<{ discipline: string; total: number }> = [];
    
    Object.entries(data.summary).forEach(([key, total]) => {
      if (key.endsWith("_linear")) {
        const disc = key.replace("_linear", "");
        linear.push({ discipline: disc, total: total as number });
      } else {
        blocks.push({ discipline: key, total: total as number });
      }
    });
    
    blocks.sort((a, b) => b.total - a.total);
    linear.sort((a, b) => b.total - a.total);
    
    return { 
      blockEntries: blocks.filter(e => e.total > 0),
      linearEntries: linear.filter(e => e.total > 0),
      metadata: data.metadata || null
    };
  }, [data]);

  const totalBlocks = useMemo(
    () => blockEntries.reduce((sum, e) => sum + e.total, 0),
    [blockEntries]
  );

  const totalLinear = useMemo(
    () => linearEntries.reduce((sum, e) => sum + e.total, 0),
    [linearEntries]
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

        {/* ── Metadata Info ── */}
        {metadata && (
          <div className="flex flex-wrap gap-4 text-sm text-text-muted bg-blueprint-50/50 rounded-lg px-4 py-3 border border-grid-line">
            {metadata.scale_detected && (
              <span className="inline-flex items-center gap-1.5">
                <Scale className="h-4 w-4" />
                Escala: <strong className="text-blueprint-800">{metadata.scale_detected}</strong>
              </span>
            )}
            {metadata.parser_version && (
              <span>Parser v{metadata.parser_version}</span>
            )}
            {metadata.total_layers !== undefined && (
              <span>{metadata.total_layers} layers processados</span>
            )}
            {metadata.ignored_layers !== undefined && Number(metadata.ignored_layers) > 0 && (
              <span className="text-text-muted/70">{metadata.ignored_layers} layers ignorados</span>
            )}
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total de Blocos */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Total de Blocos
              </p>
              <span className="text-xs text-text-muted">unidades</span>
            </div>
            <p className="font-[family-name:var(--font-display)] text-[36px] font-bold text-blueprint-800 tracking-[-0.03em] leading-none">
              {totalBlocks.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-text-muted mt-2">
              {blockEntries.length} disciplinas
            </p>
          </Card>

          {/* Metragem Linear */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" />
                Metragem Linear
              </p>
              <span className="text-xs text-text-muted">metros</span>
            </div>
            <p className="font-[family-name:var(--font-display)] text-[36px] font-bold text-blueprint-800 tracking-[-0.03em] leading-none">
              {totalLinear.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-text-muted mt-2">
              {linearEntries.length > 0 ? `${linearEntries.length} tipos de infraestrutura` : "Nenhuma metragem"}
            </p>
          </Card>

          {/* Por disciplina - mostrar a principal */}
          {blockEntries.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                  Por Disciplina
                </p>
              </div>
              <div className="space-y-2">
                {blockEntries.slice(0, 4).map((entry) => {
                  const discKey = normalizeDiscipline(entry.discipline);
                  return (
                    <div key={entry.discipline} className="flex items-center justify-between">
                      <Badge tone={discKey} variant="discipline" label={getDisciplineLabel(entry.discipline)} />
                      <span className="font-[family-name:var(--font-display)] text-sm font-bold text-blueprint-800">
                        {entry.total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} un
                      </span>
                    </div>
                  );
                })}
                {blockEntries.length > 4 && (
                  <p className="text-xs text-text-muted">+{blockEntries.length - 4} outras disciplinas</p>
                )}
              </div>
            </Card>
          )}
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
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80 text-right">
                    Qtd.
                  </th>
                  <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                    Unidade
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
                  const isLinear = item.category === "linear";
                  return (
                    <tr
                      key={`${item.description}-${index}`}
                      className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)]"
                      style={{ backgroundColor: isEven ? "#FFFFFF" : "#F8FAFC" }}
                    >
                      <td className="px-4 py-3">
                        <Badge 
                          tone={discKey} 
                          variant="discipline" 
                          label={getDisciplineLabel(item.discipline ?? "generic")} 
                        />
                      </td>
                      <td className="px-4 py-3 font-[family-name:var(--font-body)] text-[13px] font-medium text-text-primary">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          isLinear 
                            ? "bg-blue-50 text-blue-700" 
                            : "bg-green-50 text-green-700"
                        }`}>
                          {isLinear ? "Linear" : "Bloco"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800">
                        {isLinear 
                          ? item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">{item.unit}</td>
                      <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-text-muted max-w-[200px] truncate" title={item.layer ?? ""}>
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
