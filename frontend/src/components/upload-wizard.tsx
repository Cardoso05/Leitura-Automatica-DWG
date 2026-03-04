"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
    if (!token) {
      toast.error("Você precisa estar logado para enviar um arquivo.");
      return;
    }
    if (!file) {
      toast.error("Selecione um arquivo DWG ou DXF.");
      return;
    }
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
      link.download = `takeoff-${projectId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar.");
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <UploadStep onUpload={handleUpload} loading={isBusy} />;
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
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm font-medium">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                item <= step ? "border-emerald-400 text-white" : "border-white/20 text-slate-500"
              }`}
            >
              {item}
            </span>
            {item < 3 && <span className="h-px w-12 bg-white/10" />}
          </div>
        ))}
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

  return (
    <Card
      title="1. Upload DWG/DXF"
      description="Aceitamos arquivos de até 50MB. Conversão para DXF é feita automaticamente."
    >
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-6 py-16 text-center text-slate-300 hover:border-emerald-400 hover:text-white">
        <input
          type="file"
          className="hidden"
          accept=".dwg,.dxf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setSelected(file ?? null);
          }}
        />
        <p className="text-lg font-semibold text-white">
          {selected ? selected.name : "Arraste ou clique para selecionar"}
        </p>
        <p className="text-xs text-slate-400">Formatos suportados: DWG R12-R2018 e DXF</p>
      </label>
      <Button className="mt-6 w-full" disabled={loading} onClick={() => onUpload(selected)}>
        {loading ? "Enviando..." : "Enviar arquivo"}
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
      title="2. Configure o mapeamento"
      description="Confirme as disciplinas antes de processar. Ajuste a escala se necessário."
    >
      <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <th className="px-4 py-3">Layer</th>
              <th className="px-4 py-3">Entidades</th>
              <th className="px-4 py-3">Disciplina</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {layers.map((layer) => (
              <tr key={layer.name}>
                <td className="px-4 py-3 font-medium text-white">{layer.name}</td>
                <td className="px-4 py-3 text-slate-400">{layer.entity_count}</td>
                <td className="px-4 py-3">
                  <select
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Escala do desenho (multiplicador)</label>
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
            {loading ? "Processando..." : "Processar takeoff"}
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
        ? Object.entries(result.summary).map(([discipline, total]) => ({
            discipline,
            total,
          }))
        : [],
    [result]
  );

  return (
    <Card
      title="3. Resultado pronto"
      description="Analise o resumo abaixo ou abra o dashboard para detalhar itens e exportar o Excel."
    >
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {summaryEntries.map((item) => (
          <div key={item.discipline} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{item.discipline}</p>
            <p className="text-2xl font-semibold text-white">{item.total.toFixed(2)}</p>
          </div>
        ))}
        {summaryEntries.length === 0 && (
          <p className="text-sm text-slate-400">Processamento concluído. Consulte os itens no dashboard.</p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onDownload}>Exportar Excel</Button>
        <Button variant="outline" onClick={onViewDetail}>
          Ver detalhes
        </Button>
      </div>
    </Card>
  );
}
