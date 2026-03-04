"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import {
  downloadResult,
  fetchLayers,
  processProject,
  uploadProject,
} from "@/lib/api-client";
import type { Discipline, LayerInfo, TakeoffResult } from "@/lib/types";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

const disciplineOptions: { label: string; value: Discipline }[] = [
  { label: "Elétrica", value: "electrical" },
  { label: "Hidráulica", value: "plumbing" },
  { label: "Rede / Dados", value: "networking" },
  { label: "Incêndio", value: "fire" },
  { label: "HVAC", value: "hvac" },
  { label: "Genérico", value: "generic" },
];

const stepLabels = ["Upload", "Mapeamento", "Resultado"];

export function UploadWizard() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isBusy, setIsBusy] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [layerMap, setLayerMap] = useState<Record<string, Discipline>>({});
  const [scaleRatio, setScaleRatio] = useState("1");
  const [result, setResult] = useState<TakeoffResult | null>(null);

  const handleLayerChange = (layerName: string, discipline: Discipline) => {
    setLayerMap((prev) => ({ ...prev, [layerName]: discipline }));
  };

  const handleUpload = async (file?: File | null) => {
    if (!token) { toast.error("Você precisa estar logado para enviar um arquivo."); return; }
    if (!file) { toast.error("Selecione um arquivo DWG ou DXF."); return; }
    setIsBusy(true);
    try {
      const response = await uploadProject(file, token);
      setProjectId(response.project_id);
      const detectedLayers = await fetchLayers(response.project_id, token);
      setLayers(detectedLayers);
      const initialMap = detectedLayers.reduce<Record<string, Discipline>>((acc, layer) => {
        acc[layer.name] = (layer.suggested_discipline ?? "generic") as Discipline;
        return acc;
      }, {});
      setLayerMap(initialMap);
      setStep(2);
      toast.success("Upload concluído! Mapeie as disciplinas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleProcess = async () => {
    if (!token || !projectId) return;
    setIsBusy(true);
    try {
      const numericScale = Number(scaleRatio);
      const parsedScale = Number.isFinite(numericScale) ? numericScale : undefined;
      const takeoff = await processProject(projectId, layerMap, token, parsedScale);
      setResult(takeoff);
      setStep(3);
      toast.success("Takeoff concluído!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar projeto.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!token || !projectId) return;
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
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar.");
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: return <UploadStep onUpload={handleUpload} loading={isBusy} />;
      case 2:
        return (
          <LayerMappingStep
            layers={layers}
            layerMap={layerMap}
            onChange={handleLayerChange}
            onProcess={handleProcess}
            scaleRatio={scaleRatio}
            setScaleRatio={setScaleRatio}
            loading={isBusy}
          />
        );
      case 3:
        return (
          <ResultStep
            result={result}
            onDownload={handleDownload}
            onViewDetail={() => router.push(`/dashboard/results/${projectId}`)}
          />
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((item) => {
          const active = item <= step;
          const current = item === step;
          return (
            <div key={item} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200",
                    current
                      ? "border-electric bg-electric text-blueprint-800"
                      : active
                      ? "border-electric/50 text-electric"
                      : "border-grid-line text-text-muted",
                  ].join(" ")}
                >
                  {item}
                </span>
                <span
                  className={[
                    "text-sm font-medium hidden sm:block",
                    current ? "text-blueprint-800" : active ? "text-electric/70" : "text-text-muted",
                  ].join(" ")}
                >
                  {stepLabels[item - 1]}
                </span>
              </div>
              {item < 3 && (
                <div
                  className="h-px w-8 sm:w-16 transition-all duration-300"
                  style={{ backgroundColor: item < step ? "#00D4AA" : "#E2E8F0" }}
                />
              )}
            </div>
          );
        })}
      </div>
      {renderStepContent()}
    </div>
  );
}

function UploadStep({
  onUpload,
  loading,
}: {
  onUpload: (file?: File | null) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Card
      title="Upload DWG/DXF"
      description="Aceitamos arquivos de até 50MB. Conversão para DXF é feita automaticamente."
    >
      <label
        className={[
          "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-16 text-center transition-all duration-200",
          isDragging || selected
            ? "border-electric bg-[rgba(0,212,170,0.05)]"
            : "border-grid-line bg-surface hover:border-electric/50 hover:bg-[rgba(0,212,170,0.03)]",
        ].join(" ")}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) setSelected(file);
        }}
      >
        <input
          type="file"
          className="hidden"
          accept=".dwg,.dxf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setSelected(file ?? null);
          }}
        />
        <div className={["mb-4 transition-transform duration-300", isDragging ? "scale-110" : ""].join(" ")}>
          <Upload className="h-10 w-10 text-electric/60" />
        </div>
        <p className="font-[family-name:var(--font-display)] text-base font-bold text-blueprint-800">
          {selected ? selected.name : "Arraste ou clique para selecionar"}
        </p>
        {selected ? (
          <p className="text-xs text-text-muted mt-1">
            {(selected.size / 1024 / 1024).toFixed(2)} MB
          </p>
        ) : (
          <p className="text-xs text-text-muted mt-1">Formatos suportados: DWG R12-R2018 e DXF</p>
        )}
      </label>
      <Button className="mt-5 w-full" disabled={loading} onClick={() => onUpload(selected)}>
        {loading ? "Enviando..." : "Analisar Planta"}
      </Button>
    </Card>
  );
}

function LayerMappingStep({
  layers,
  layerMap,
  onChange,
  onProcess,
  scaleRatio,
  setScaleRatio,
  loading,
}: {
  layers: LayerInfo[];
  layerMap: Record<string, Discipline>;
  onChange: (layerName: string, discipline: Discipline) => void;
  onProcess: () => void;
  scaleRatio: string;
  setScaleRatio: (value: string) => void;
  loading: boolean;
}) {
  return (
    <Card
      title="Configure o mapeamento"
      description="Confirme as disciplinas antes de processar. Ajuste a escala se necessário."
    >
      <div className="mt-4 max-h-80 overflow-y-auto rounded-[10px] border border-grid-line">
        <table className="min-w-full divide-y divide-grid-line text-sm">
          <thead className="sticky top-0 bg-blueprint-800">
            <tr className="text-left">
              <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                Layer
              </th>
              <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                Entidades
              </th>
              <th className="px-4 py-3 font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
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
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[12px] font-medium text-text-primary">
                  {layer.name}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[12px] text-text-muted">
                  {layer.entity_count}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="w-full rounded-[8px] border border-grid-line bg-sheet px-3 py-1.5 text-sm text-text-primary focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/15 transition-all duration-200"
                    value={layerMap[layer.name] ?? "generic"}
                    onChange={(event) => onChange(layer.name, event.target.value as Discipline)}
                  >
                    {disciplineOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
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
            onChange={(event) => setScaleRatio(event.target.value)}
            placeholder="1"
          />
        </div>
        <div className="flex items-end justify-end">
          <Button className="w-full md:w-auto" disabled={loading} onClick={onProcess}>
            {loading ? "Processando..." : "Processar"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ResultStep({
  result,
  onDownload,
  onViewDetail,
}: {
  result: TakeoffResult | null;
  onDownload: () => void;
  onViewDetail: () => void;
}) {
  const summaryEntries = useMemo(
    () =>
      result
        ? Object.entries(result.summary).map(([discipline, total]) => ({ discipline, total }))
        : [],
    [result]
  );

  return (
    <Card
      title="Resultado pronto"
      description="Analise o resumo abaixo ou abra o dashboard para detalhar itens e exportar o Excel."
      statusBar="completed"
    >
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {summaryEntries.map((item) => (
          <div
            key={item.discipline}
            className="rounded-[10px] border border-grid-line bg-surface p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted mb-1">
              {item.discipline}
            </p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
              {item.total.toFixed(2)}
            </p>
          </div>
        ))}
        {summaryEntries.length === 0 && (
          <p className="text-sm text-text-muted col-span-2">
            Processamento concluído. Consulte os itens no dashboard.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onDownload}>Exportar Excel</Button>
        <Button variant="outline" onClick={onViewDetail}>
          Ver detalhes
        </Button>
      </div>
    </Card>
  );
}
