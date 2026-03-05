"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { fetchLayers, fetchResult, processProject } from "@/lib/api-client";
import type { Discipline, LayerInfo } from "@/lib/types";

const disciplineOptions: { label: string; value: Discipline }[] = [
  { label: "Elétrica", value: "electrical" },
  { label: "Hidráulica", value: "plumbing" },
  { label: "Rede / Dados", value: "networking" },
  { label: "Incêndio", value: "fire" },
  { label: "HVAC", value: "hvac" },
  { label: "Genérico", value: "generic" },
];

export default function ProjectProcessPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const { token } = useAuth();

  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [layerMap, setLayerMap] = useState<Record<string, Discipline>>({});
  const [scaleRatio, setScaleRatio] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token || !Number.isFinite(projectId)) return;

    setLoading(true);
    fetchLayers(projectId, token)
      .then((detected) => {
        setLayers(detected);
        const initial = detected.reduce<Record<string, Discipline>>((acc, l) => {
          acc[l.name] = (l.suggested_discipline ?? "generic") as Discipline;
          return acc;
        }, {});
        setLayerMap(initial);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar layers.");
      })
      .finally(() => setLoading(false));
  }, [token, projectId]);

  const handleProcess = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const scale = scaleRatio.trim() ? Number(scaleRatio) : NaN;
      const parsed = Number.isFinite(scale) && scale > 0 ? scale : undefined;
      await processProject(projectId, layerMap, token, parsed);

      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          const takeoff = await fetchResult(projectId, token);
          if (takeoff.items && takeoff.items.length > 0) {
            toast.success("Takeoff concluído!");
            router.push(`/dashboard/results/${projectId}`);
            return;
          }
        } catch {
          // ainda processando
        }
      }
      toast.error("Processamento demorou mais que o esperado.");
      router.push(`/dashboard/results/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar.");
    } finally {
      setProcessing(false);
    }
  };

  if (!token) {
    return (
      <DashboardShell>
        <p className="text-sm text-text-muted">Faça login para continuar.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-blueprint-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </button>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
            Processar Projeto #{projectId}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Confirme as disciplinas dos layers detectados e inicie o processamento.
          </p>
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-electric" />
          </div>
        ) : layers.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted py-8 text-center">
              Nenhum layer detectado neste projeto. O arquivo pode estar corrompido ou vazio.
            </p>
          </Card>
        ) : (
          <Card
            title={`${layers.length} layers detectados`}
            description="Ajuste as disciplinas se necessário e clique em Processar."
          >
            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-[10px] border border-grid-line">
              <table className="min-w-full divide-y divide-grid-line text-sm">
                <thead className="sticky top-0 bg-blueprint-800 z-10">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                      Layer
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                      Entidades
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                      Disciplina
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid-line bg-sheet">
                  {layers.map((layer, index) => (
                    <tr
                      key={layer.name}
                      style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] font-medium text-text-primary">
                        {layer.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-text-muted">
                        {layer.entity_count}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-[8px] border border-grid-line bg-sheet px-3 py-1.5 text-sm text-text-primary focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/15 transition-all duration-200"
                          value={layerMap[layer.name] ?? "generic"}
                          onChange={(e) =>
                            setLayerMap((prev) => ({
                              ...prev,
                              [layer.name]: e.target.value as Discipline,
                            }))
                          }
                        >
                          {disciplineOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Escala do desenho (multiplicador)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={scaleRatio}
                  onChange={(e) => setScaleRatio(e.target.value)}
                  placeholder="Auto"
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  className="w-full md:w-auto gap-2"
                  disabled={processing}
                  onClick={handleProcess}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Processar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
