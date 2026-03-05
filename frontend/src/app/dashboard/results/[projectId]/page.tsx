"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Loader2,
  Clock,
  Zap,
  Ruler,
  Scale,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import {
  createBlockMapping,
  downloadResult,
  fetchResult,
  processProject,
  submitBlockFeedback,
} from "@/lib/api-client";
import type { TakeoffItem } from "@/lib/types";
import type { Discipline } from "@/lib/types";
import { API_BASE_URL } from "@/lib/config";

// ── Helpers de disciplina ────────────────────────────────────────────────────

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

// ── Categorização de itens ──────────────────────────────────────────────────

function isUnidentified(item: TakeoffItem): boolean {
  const d = item.description;
  return (
    d.startsWith("Bloco composto") ||
    d.startsWith("Bloco vazio") ||
    d.startsWith("Bloco não identificado") ||
    d.startsWith("*U") ||
    d.startsWith("zw$") ||
    d.startsWith("A$") ||
    d === (item.block_name ?? "") ||
    d === (item.resolved_name ?? "")
  );
}

function categorizeItems(items: TakeoffItem[]) {
  const identified: TakeoffItem[] = [];
  const linear: TakeoffItem[] = [];
  const unidentified: TakeoffItem[] = [];

  for (const item of items) {
    if (item.category === "linear") {
      linear.push(item);
    } else if (isUnidentified(item)) {
      unidentified.push(item);
    } else {
      identified.push(item);
    }
  }

  identified.sort((a, b) => b.quantity - a.quantity);
  linear.sort((a, b) => b.quantity - a.quantity);
  unidentified.sort((a, b) => b.quantity - a.quantity);

  return { identified, linear, unidentified };
}

// ── Preview autenticado do bloco ─────────────────────────────────────────────

function BlockPreview({
  projectId,
  blockName,
  token,
}: {
  projectId: number;
  blockName: string;
  token: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(
      `${API_BASE_URL}/blocks/${projectId}/${encodeURIComponent(blockName)}/preview`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setSrc(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [projectId, blockName, token]);

  return (
    <div className="w-14 h-14 rounded border border-grid-line bg-blueprint-800 shrink-0 overflow-hidden flex items-center justify-center">
      {src ? (
        <img src={src} width={56} height={56} alt={`Preview ${blockName}`} />
      ) : (
        <div className="w-full h-full animate-pulse bg-blueprint-700" />
      )}
    </div>
  );
}

// ── Componente de linha para bloco não identificado ─────────────────────────

interface UnmappedBlockRowProps {
  item: TakeoffItem;
  projectId: number;
  token: string;
  onMapped: (blockName: string, description: string) => void;
}

function UnmappedBlockRow({ item, projectId, token, onMapped }: UnmappedBlockRowProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const blockNameForPreview = item.block_name ?? item.resolved_name ?? item.description;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createBlockMapping(
        {
          block_name_pattern: blockNameForPreview,
          material_description: name.trim(),
          unit: "un",
          discipline: (normalizeDiscipline(item.discipline) as Discipline),
          is_material: true,
          use_regex: false,
          category: null,
        },
        token
      );
      submitBlockFeedback(
        {
          block_name: blockNameForPreview,
          layer: item.layer ?? undefined,
          description: name.trim(),
          discipline: normalizeDiscipline(item.discipline),
        },
        token
      ).catch(() => {});
      setSaved(true);
      onMapped(blockNameForPreview, name.trim());
    } catch {
      toast.error("Erro ao salvar mapeamento.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) return null;

  return (
    <tr className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)] border-b border-grid-line last:border-b-0">
      <td className="px-3 py-2.5">
        <BlockPreview projectId={projectId} blockName={blockNameForPreview} token={token} />
      </td>
      <td className="px-3 py-2.5">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted block max-w-[200px] truncate">
          {blockNameForPreview}
        </span>
        {item.layer && (
          <span className="text-[10px] text-text-muted/60 mt-0.5 block">[{item.layer}]</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-[family-name:var(--font-display)] text-sm font-bold text-blueprint-800">
          {item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} un
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ex: Tomada 2P+T 20A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="border border-grid-line rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-electric focus:border-electric bg-white"
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-electric text-blueprint-900 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Estado local de mapeamentos adicionados na sessão (Opção A)
  const [sessionMappings, setSessionMappings] = useState<Record<string, string>>({});
  const [unmappedCollapsed, setUnmappedCollapsed] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project-result", projectId, token],
    queryFn: () => fetchResult(projectId, token as string),
    enabled: !!token && Number.isFinite(projectId),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || d.items.length === 0) return 3000;
      return false;
    },
    retry: (count, error) => count < 20,
    retryDelay: 3000,
  });

  const { identified, linear, unidentified, blockEntries, linearEntries, metadata } =
    useMemo(() => {
      if (!data) {
        return {
          identified: [],
          linear: [],
          unidentified: [],
          blockEntries: [],
          linearEntries: [],
          metadata: null,
        };
      }

      // Aplicar mapeamentos da sessão aos itens antes de categorizar
      const itemsWithSession = data.items.map((item) => {
        const key = item.block_name ?? item.resolved_name ?? item.description;
        const sessionDesc = sessionMappings[key];
        if (sessionDesc) return { ...item, description: sessionDesc };
        return item;
      });

      const { identified, linear, unidentified } = categorizeItems(itemsWithSession);

      // Sumário por disciplina (blocos + lineares) para os cards
      const blocks: Array<{ discipline: string; total: number }> = [];
      const lins: Array<{ discipline: string; total: number }> = [];

      Object.entries(data.summary).forEach(([key, total]) => {
        if (key.endsWith("_linear")) {
          lins.push({ discipline: key.replace("_linear", ""), total: total as number });
        } else {
          blocks.push({ discipline: key, total: total as number });
        }
      });

      blocks.sort((a, b) => b.total - a.total);
      lins.sort((a, b) => b.total - a.total);

      return {
        identified,
        linear,
        unidentified,
        blockEntries: blocks.filter((e) => e.total > 0),
        linearEntries: lins.filter((e) => e.total > 0),
        metadata: data.metadata || null,
      };
    }, [data, sessionMappings]);

  const totalBlocks = useMemo(
    () => blockEntries.reduce((sum, e) => sum + e.total, 0),
    [blockEntries]
  );

  const totalLinear = useMemo(
    () => linearEntries.reduce((sum, e) => sum + e.total, 0),
    [linearEntries]
  );

  const handleMapped = (blockName: string, description: string) => {
    setSessionMappings((prev) => ({ ...prev, [blockName]: description }));
    toast.success(`"${description}" mapeado com sucesso.`);
  };

  const handleReprocess = async () => {
    if (!token || !data) return;
    setReprocessing(true);
    try {
      await processProject(projectId, {}, token);
      await queryClient.invalidateQueries({ queryKey: ["project-result", projectId, token] });
      setSessionMappings({});
      toast.success("Projeto reprocessado com os novos mapeamentos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reprocessar.");
    } finally {
      setReprocessing(false);
    }
  };

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

  const buildDiagnosticReport = (): string => {
    const lines: string[] = [];
    const sep = "─".repeat(60);

    lines.push(`DIAGNÓSTICO TAKEOFF — Projeto #${projectId}`);
    lines.push(sep);

    if (metadata) {
      lines.push("## METADATA");
      if (metadata.parser_version) lines.push(`  Parser: v${metadata.parser_version}`);
      if (metadata.dxf_version) lines.push(`  DXF: ${metadata.dxf_version}${metadata.dxf_legacy ? " (LEGADO)" : ""}`);
      if (metadata.scale_detected || metadata.scale_factor) {
        const autoFactor = (metadata as Record<string, unknown>).scale_auto_factor;
        lines.push(`  Escala: ${metadata.scale_detected ?? "—"} (fator usado: ${metadata.scale_factor ?? "auto"}, auto: ${autoFactor ?? "?"}, fonte: ${metadata.scale_source ?? "?"})`);
      }
      if (metadata.total_layers !== undefined) lines.push(`  Layers: ${metadata.total_layers} processados, ${metadata.ignored_layers ?? 0} ignorados`);
      lines.push("");
    }

    lines.push("## RESUMO");
    lines.push(`  Identificados: ${identified.length} tipos`);
    lines.push(`  Metragens: ${linear.length} tipos`);
    lines.push(`  Não identificados: ${unidentified.length} blocos`);
    lines.push(`  Total blocos: ${totalBlocks}`);
    lines.push(`  Total linear: ${totalLinear.toFixed(2)} m`);
    lines.push("");

    if (blockEntries.length > 0) {
      lines.push("## BLOCOS POR DISCIPLINA");
      for (const e of blockEntries) {
        lines.push(`  ${getDisciplineLabel(e.discipline).padEnd(16)} ${e.total} un`);
      }
      lines.push("");
    }

    if (linearEntries.length > 0) {
      lines.push("## METRAGEM POR DISCIPLINA");
      for (const e of linearEntries) {
        lines.push(`  ${getDisciplineLabel(e.discipline).padEnd(16)} ${e.total.toFixed(2)} m`);
      }
      lines.push("");
    }

    if (identified.length > 0) {
      lines.push("## MATERIAIS IDENTIFICADOS");
      lines.push(`  ${"Descrição".padEnd(40)} ${"Qtd".padStart(8)}  ${"Un".padEnd(4)}  Layer`);
      lines.push("  " + "─".repeat(80));
      for (const item of identified) {
        const desc = item.description.length > 38 ? item.description.slice(0, 38) + ".." : item.description;
        const qty = item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
        lines.push(`  ${desc.padEnd(40)} ${qty.padStart(8)}  ${item.unit.padEnd(4)}  ${item.layer ?? "—"}`);
        if (item.block_name || item.resolved_name) {
          lines.push(`    blk=${item.block_name ?? "—"} → res=${item.resolved_name ?? "—"}`);
        }
      }
      lines.push("");
    }

    if (linear.length > 0) {
      lines.push("## METRAGENS");
      lines.push(`  ${"Descrição".padEnd(40)} ${"Valor".padStart(10)}  ${"Un".padEnd(4)}  Layer`);
      lines.push("  " + "─".repeat(80));
      for (const item of linear) {
        const desc = item.description.length > 38 ? item.description.slice(0, 38) + ".." : item.description;
        const qty = item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        lines.push(`  ${desc.padEnd(40)} ${qty.padStart(10)}  ${item.unit.padEnd(4)}  ${item.layer ?? "—"}`);
      }
      lines.push("");
    }

    if (unidentified.length > 0) {
      lines.push("## NÃO IDENTIFICADOS");
      lines.push(`  ${"Bloco (original)".padEnd(30)} ${"Resolvido".padEnd(25)} ${"Qtd".padStart(6)}  Layer`);
      lines.push("  " + "─".repeat(85));
      for (const item of unidentified) {
        const orig = (item.block_name ?? "—").length > 28 ? (item.block_name ?? "—").slice(0, 28) + ".." : (item.block_name ?? "—");
        const res = (item.resolved_name ?? "—").length > 23 ? (item.resolved_name ?? "—").slice(0, 23) + ".." : (item.resolved_name ?? "—");
        const qty = item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
        lines.push(`  ${orig.padEnd(30)} ${res.padEnd(25)} ${qty.padStart(6)}  ${item.layer ?? "—"}`);
      }
      lines.push("");
    }

    lines.push(sep);
    lines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);

    return lines.join("\n");
  };

  const handleCopyDiagnostic = async () => {
    const report = buildDiagnosticReport();
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Diagnóstico copiado para a área de transferência!");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Diagnóstico copiado!");
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
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handleCopyDiagnostic}>
              <ClipboardCopy className="h-4 w-4" />
              Copiar Diagnóstico
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleReprocess} disabled={reprocessing}>
              {reprocessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reprocessar
            </Button>
            <Button className="gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* ── Aviso de formato legado ── */}
        {metadata?.dxf_legacy && (
          <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
            <div>
              <span className="font-semibold">Arquivo em formato legado ({metadata.dxf_version} / R12–R14).</span>{" "}
              Este formato ASCII pode ser até 15× mais lento de processar. Para melhor desempenho,
              salve o DXF como <strong>R2004 (AC1018)</strong> ou superior no AutoCAD/ZWCAD antes de enviar.
            </div>
          </div>
        )}

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
            {metadata.dxf_version && (
              <span className={metadata.dxf_legacy ? "text-orange-600 font-medium" : ""}>
                DXF {metadata.dxf_version}
              </span>
            )}
            {metadata.total_layers !== undefined && (
              <span>{metadata.total_layers} layers processados</span>
            )}
            {metadata.ignored_layers !== undefined && Number(metadata.ignored_layers) > 0 && (
              <span className="text-text-muted/70">{metadata.ignored_layers} layers ignorados</span>
            )}
          </div>
        )}

        {/* ── Resumo rápido ── */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 text-center">
          <div className="rounded-lg border border-grid-line bg-white px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Identificados</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800">{identified.length}</p>
            <p className="text-xs text-text-muted">tipos de material</p>
          </div>
          <div className="rounded-lg border border-grid-line bg-white px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Metragens</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800">{linear.length}</p>
            <p className="text-xs text-text-muted">tipos de infraestrutura</p>
          </div>
          <div className="rounded-lg border border-grid-line bg-white px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Não identificados</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-orange-500">{unidentified.length}</p>
            <p className="text-xs text-text-muted">mapeie para incluir</p>
          </div>
          <div className="rounded-lg border border-grid-line bg-white px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Total blocos</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800">
              {totalBlocks.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-text-muted">unidades</p>
          </div>
        </div>

        {/* ── Summary Cards por disciplina ── */}
        {blockEntries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-xs text-text-muted mt-2">{blockEntries.length} disciplinas</p>
            </Card>

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
                {linearEntries.length > 0
                  ? `${linearEntries.length} tipos de infraestrutura`
                  : "Nenhuma metragem"}
              </p>
            </Card>

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
          </div>
        )}

        {/* ── Seção 1: Materiais Identificados ── */}
        {identified.length > 0 && (
          <Card title={`Materiais Identificados (${identified.length} tipos)`}>
            <div className="rounded-[10px] overflow-hidden border border-grid-line -mx-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-blueprint-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Disciplina</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Item</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80 text-right">Qtd.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Un.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Layer</th>
                  </tr>
                </thead>
                <tbody>
                  {identified.map((item, index) => {
                    const discKey = normalizeDiscipline(item.discipline);
                    return (
                      <tr
                        key={`${item.description}-${index}`}
                        className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)] border-b border-grid-line last:border-b-0"
                        style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                      >
                        <td className="px-4 py-3">
                          <Badge tone={discKey} variant="discipline" label={getDisciplineLabel(item.discipline ?? "generic")} />
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-text-primary">{item.description}</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800">
                          {item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
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
        )}

        {/* ── Seção 2: Metragens ── */}
        {linear.length > 0 && (
          <Card title={`Metragens (${linear.length} tipos)`}>
            <div className="rounded-[10px] overflow-hidden border border-grid-line -mx-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-blueprint-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Disciplina</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Item</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80 text-right">Valor</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Un.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Layer</th>
                  </tr>
                </thead>
                <tbody>
                  {linear.map((item, index) => {
                    const discKey = normalizeDiscipline(item.discipline);
                    return (
                      <tr
                        key={`${item.description}-${index}`}
                        className="transition-colors duration-150 hover:bg-[rgba(0,212,170,0.06)] border-b border-grid-line last:border-b-0"
                        style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                      >
                        <td className="px-4 py-3">
                          <Badge tone={discKey} variant="discipline" label={getDisciplineLabel(item.discipline ?? "generic")} />
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-text-primary">{item.description}</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800">
                          {item.quantity.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
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
        )}

        {/* ── Seção 3: Não Identificados ── */}
        {unidentified.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50/30">
            {/* Header da seção */}
            <button
              onClick={() => setUnmappedCollapsed((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="font-[family-name:var(--font-display)] font-semibold text-blueprint-800">
                  Não Identificados ({unidentified.length} blocos)
                </span>
                <span className="text-xs text-text-muted">— ordene pelos de maior quantidade</span>
              </div>
              {unmappedCollapsed ? (
                <ChevronRight className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-muted" />
              )}
            </button>

            {!unmappedCollapsed && (
              <div className="px-5 pb-5 space-y-3">
                <p className="text-xs text-text-muted">
                  Mapeie os blocos abaixo para incluí-los na lista de materiais. Mapeamentos salvos
                  serão aplicados automaticamente nos próximos processamentos.
                </p>
                <div className="rounded-[10px] overflow-hidden border border-orange-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-orange-50 border-b border-orange-200">
                        <th className="px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider w-[72px]">
                          Preview
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                          Bloco
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider w-24">
                          Qtd.
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                          Nomear
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidentified.map((item, index) => (
                        <UnmappedBlockRow
                          key={`${item.block_name ?? item.description}-${index}`}
                          item={item}
                          projectId={projectId}
                          token={token}
                          onMapped={handleMapped}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    className="gap-2 text-sm"
                    onClick={handleReprocess}
                    disabled={reprocessing}
                  >
                    {reprocessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Reprocessar com novos mapeamentos
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
