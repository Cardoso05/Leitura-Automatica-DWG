"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import {
  downloadResult,
  fetchLayers,
  fetchResult,
  processProject,
  uploadProject,
  uploadProjectBatch,
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
  const [scaleRatio, setScaleRatio] = useState("");
  const [result, setResult] = useState<TakeoffResult | null>(null);

  // Multi-file batch state
  const [batchMode, setBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    done: number;
    errors: string[];
  } | null>(null);

  const handleLayerChange = (layerName: string, discipline: Discipline) => {
    setLayerMap((prev) => ({ ...prev, [layerName]: discipline }));
  };

  const handleUpload = async (file?: File | null) => {
    if (!token) { toast.error("Você precisa estar logado."); return; }
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

  const handleBatchUpload = async (files: File[]) => {
    if (!token) { toast.error("Você precisa estar logado."); return; }
    if (files.length === 0) { toast.error("Selecione pelo menos um arquivo."); return; }

    setIsBusy(true);
    setBatchProgress({ total: files.length, done: 0, errors: [] });

    try {
      const result = await uploadProjectBatch(files, token);

      setBatchProgress({
        total: files.length,
        done: result.total_success,
        errors: result.errors.map((e) => `${e.filename}: ${e.error}`),
      });

      if (result.total_success > 0) {
        toast.success(
          `${result.total_success} planta${result.total_success > 1 ? "s" : ""} enviada${result.total_success > 1 ? "s" : ""} com sucesso!`
        );
      }
      if (result.total_errors > 0) {
        toast.error(`${result.total_errors} arquivo${result.total_errors > 1 ? "s" : ""} com erro.`);
      }

      // Se só 1 arquivo deu certo, segue para mapeamento
      if (result.total_success === 1) {
        const p = result.uploaded[0];
        setProjectId(p.project_id);
        const detectedLayers = await fetchLayers(p.project_id, token);
        setLayers(detectedLayers);
        const initialMap = detectedLayers.reduce<Record<string, Discipline>>((acc, layer) => {
          acc[layer.name] = (layer.suggested_discipline ?? "generic") as Discipline;
          return acc;
        }, {});
        setLayerMap(initialMap);
        setBatchMode(false);
        setStep(2);
        return;
      }

      // Múltiplos: redirecionar ao dashboard para ver todos
      if (result.total_success > 1) {
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload em lote.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleProcess = async () => {
    if (!token || !projectId) return;
    setIsBusy(true);
    try {
      const numericScale = scaleRatio.trim() ? Number(scaleRatio) : NaN;
      const parsedScale = Number.isFinite(numericScale) && numericScale > 0 ? numericScale : undefined;
      await processProject(projectId, layerMap, token, parsedScale);

      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          const takeoff = await fetchResult(projectId, token);
          if (takeoff.items && takeoff.items.length > 0) {
            setResult(takeoff);
            setStep(3);
            toast.success("Takeoff concluído!");
            return;
          }
        } catch {
          // resultado ainda não está pronto
        }
      }
      toast.error("Processamento demorou mais que o esperado. Verifique em seus projetos.");
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
      case 1:
        return (
          <UploadStep
            onUploadSingle={handleUpload}
            onUploadBatch={handleBatchUpload}
            loading={isBusy}
            batchProgress={batchProgress}
          />
        );
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
  onUploadSingle,
  onUploadBatch,
  loading,
  batchProgress,
}: {
  onUploadSingle: (file?: File | null) => void;
  onUploadBatch: (files: File[]) => void;
  loading: boolean;
  batchProgress: { total: number; done: number; errors: string[] } | null;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter(
      (f) => f.name.toLowerCase().endsWith(".dwg") || f.name.toLowerCase().endsWith(".dxf")
    );
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const unique = newFiles.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const isSingle = selectedFiles.length === 1;

  const handleSubmit = () => {
    if (isSingle) {
      onUploadSingle(selectedFiles[0]);
    } else {
      onUploadBatch(selectedFiles);
    }
  };

  return (
    <Card
      title="Upload DWG/DXF"
      description="Envie uma ou várias plantas de uma vez. Conversão para DXF é automática."
    >
      <label
        className={[
          "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-12 text-center transition-all duration-200",
          isDragging
            ? "border-electric bg-[rgba(0,212,170,0.05)]"
            : selectedFiles.length > 0
            ? "border-electric/40 bg-[rgba(0,212,170,0.03)]"
            : "border-grid-line bg-surface hover:border-electric/50 hover:bg-[rgba(0,212,170,0.03)]",
        ].join(" ")}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          className="hidden"
          accept=".dwg,.dxf"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div className={["mb-3 transition-transform duration-300", isDragging ? "scale-110" : ""].join(" ")}>
          {selectedFiles.length > 1 ? (
            <FileUp className="h-10 w-10 text-electric/60" />
          ) : (
            <Upload className="h-10 w-10 text-electric/60" />
          )}
        </div>
        <p className="text-base font-bold text-blueprint-800">
          {selectedFiles.length === 0
            ? "Arraste ou clique para selecionar"
            : `${selectedFiles.length} arquivo${selectedFiles.length > 1 ? "s" : ""} selecionado${selectedFiles.length > 1 ? "s" : ""}`}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {selectedFiles.length === 0
            ? "Formatos: DWG R12-R2018 e DXF — selecione vários de uma vez"
            : `${(totalSize / 1024 / 1024).toFixed(1)} MB total`}
        </p>
      </label>

      {selectedFiles.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-grid-line divide-y divide-grid-line">
          {selectedFiles.map((file, idx) => (
            <div key={file.name + idx} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-surface/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 inline-block w-9 text-center text-[10px] uppercase font-semibold tracking-wider rounded-md px-1.5 py-0.5 bg-electric/10 text-electric">
                  {file.name.split(".").pop()}
                </span>
                <span className="text-text-primary truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-text-muted">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); removeFile(idx); }}
                  className="p-0.5 rounded hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {batchProgress && batchProgress.total > 0 && (
        <div className="mt-3 space-y-1">
          <div className="h-2 rounded-full bg-grid-line overflow-hidden">
            <div
              className="h-full rounded-full bg-electric transition-all duration-500"
              style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            {batchProgress.done} de {batchProgress.total} processados
            {batchProgress.errors.length > 0 && (
              <span className="text-red-500 ml-1">
                ({batchProgress.errors.length} erro{batchProgress.errors.length > 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
      )}

      <Button
        className="mt-5 w-full"
        disabled={loading || selectedFiles.length === 0}
        onClick={handleSubmit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </span>
        ) : selectedFiles.length > 1 ? (
          `Enviar ${selectedFiles.length} plantas`
        ) : (
          "Analisar Planta"
        )}
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
            placeholder="Auto"
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
