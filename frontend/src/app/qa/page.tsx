"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  Loader2,
  Server,
  ShieldCheck,
  Siren,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import {
  downloadResult,
  fetchLayers,
  fetchProfile,
  fetchResult,
  listProjects,
  processProject,
  uploadProject,
  createCheckout,
} from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";
import type { CheckoutType, Discipline, LayerInfo, TakeoffResult } from "@/lib/types";

const API_ROOT_URL = API_BASE_URL.replace(/\/api$/i, "");

type QaStatus = "idle" | "running" | "success" | "error";

type QaTest = {
  id: string;
  title: string;
  description: string;
  requiresAuth?: boolean;
  icon: React.ReactNode;
  run: (ctx: { token: string | null }) => Promise<string>;
};

const automatedTests: QaTest[] = [
  {
    id: "health",
    title: "Backend /health",
    description: "Valida se a API está respondendo no domínio configurado.",
    icon: <Server className="h-5 w-5 text-electric" />,
    run: async () => {
      const response = await fetch(`${API_ROOT_URL}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload.status !== "ok") {
        throw new Error(`Status inesperado: ${payload.status}`);
      }
      return "API respondeu 200 /health";
    },
  },
  {
    id: "profile",
    title: "Sessão autenticada",
    description: "Confere se o token atual consegue acessar /auth/me.",
    requiresAuth: true,
    icon: <ShieldCheck className="h-5 w-5 text-electric" />,
    run: async ({ token }) => {
      if (!token) throw new Error("Faça login antes de executar este teste.");
      const profile = await fetchProfile(token);
      return `Usuário autenticado: ${profile.email}`;
    },
  },
  {
    id: "projects",
    title: "Listagem de projetos",
    description: "Busca /projects e garante que o dashboard renderiza.",
    requiresAuth: true,
    icon: <Activity className="h-5 w-5 text-electric" />,
    run: async ({ token }) => {
      if (!token) throw new Error("Faça login antes de executar este teste.");
      const projects = await listProjects(token);
      return `${projects.length} projetos retornados`;
    },
  },
  {
    id: "results",
    title: "Fetch de resultado recente",
    description: "Carrega o takeoff mais recente (se existir) em /projects/{id}/result.",
    requiresAuth: true,
    icon: <FileCheck2 className="h-5 w-5 text-electric" />,
    run: async ({ token }) => {
      if (!token) throw new Error("Faça login antes de executar este teste.");
      const projects = await listProjects(token);
      const completed = projects.find((project) => project.status === "completed");
      if (!completed) {
        return "Nenhum projeto concluído ainda.";
      }
      const result = await fetchResult(completed.id, token);
      return `Projeto #${completed.id} retornou ${result.items.length} itens`;
    },
  },
];

type TestState = Record<
  string,
  {
    status: QaStatus;
    message?: string;
    durationMs?: number;
  }
>;

const disciplineFallback: Discipline = "generic";

function buildAutoLayerMap(layers: LayerInfo[]): Record<string, Discipline> {
  return layers.reduce<Record<string, Discipline>>((acc, layer) => {
    acc[layer.name] = (layer.suggested_discipline ?? disciplineFallback) as Discipline;
    return acc;
  }, {});
}

export default function QaPage() {
  const { token, loading } = useAuth();
  const [testStates, setTestStates] = useState<TestState>({});
  const [isRunningAll, setIsRunningAll] = useState(false);

  const [flowFile, setFlowFile] = useState<File | null>(null);
  const [flowStatus, setFlowStatus] = useState<QaStatus>("idle");
  const [flowLogs, setFlowLogs] = useState<string[]>([]);
  const [flowResult, setFlowResult] = useState<TakeoffResult | null>(null);
  const [flowScale, setFlowScale] = useState("1");

  const [billingType, setBillingType] = useState<CheckoutType>("pay_per_use");
  const [billingStatus, setBillingStatus] = useState<QaStatus>("idle");
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  const rootReady = useMemo(() => !!API_ROOT_URL, []);

  const runTest = async (test: QaTest) => {
    setTestStates((prev) => ({
      ...prev,
      [test.id]: { status: "running" },
    }));
    const start = performance.now();
    try {
      const message = await test.run({ token });
      setTestStates((prev) => ({
        ...prev,
        [test.id]: {
          status: "success",
          message,
          durationMs: performance.now() - start,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestStates((prev) => ({
        ...prev,
        [test.id]: {
          status: "error",
          message,
          durationMs: performance.now() - start,
        },
      }));
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (const test of automatedTests) {
      // eslint-disable-next-line no-await-in-loop
      await runTest(test);
    }
    setIsRunningAll(false);
  };

  const logFlow = (message: string) => {
    setFlowLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleFlowTest = async () => {
    if (!token) {
      toast.error("Faça login antes de rodar o fluxo completo.");
      return;
    }
    if (!flowFile) {
      toast.error("Selecione um arquivo DWG ou DXF para este teste.");
      return;
    }
    setFlowStatus("running");
    setFlowLogs([]);
    setFlowResult(null);
    try {
      logFlow(`Enviando ${flowFile.name} (${(flowFile.size / 1024 / 1024).toFixed(2)} MB)`);
      const uploadResponse = await uploadProject(flowFile, token);
      logFlow(`Upload concluído. project_id=${uploadResponse.project_id}`);

      const layers = await fetchLayers(uploadResponse.project_id, token);
      logFlow(`Layers detectados: ${layers.length}`);

      const layerMap = buildAutoLayerMap(layers);
      logFlow("Mapeamento automático aplicado. Processando projeto...");

      const numericScale = Number(flowScale);
      const parsedScale = Number.isFinite(numericScale) ? numericScale : undefined;

      const takeoff = await processProject(
        uploadResponse.project_id,
        layerMap,
        token,
        parsedScale
      );
      logFlow(
        `Processamento concluído com ${takeoff.items.length} itens e ${
          Object.keys(takeoff.summary).length
        } disciplinas.`
      );
      setFlowResult(takeoff);

      const blob = await downloadResult(uploadResponse.project_id, token);
      logFlow(`Excel exportado (${(blob.size / 1024).toFixed(1)} KB).`);

      setFlowStatus("success");
      toast.success("Fluxo completo executado com sucesso!");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFlowStatus("error");
      logFlow(`Erro: ${message}`);
      toast.error(message);
    }
  };

  const handleBillingTest = async () => {
    if (!token) {
      toast.error("Faça login para gerar o checkout.");
      return;
    }
    setBillingStatus("running");
    setBillingMessage(null);
    try {
      const response = await createCheckout(billingType, token);
      setBillingStatus("success");
      setBillingMessage(
        response.invoice_url
          ? `Pagamento ${response.payment_id} criado! Link: ${response.invoice_url}`
          : `Pagamento ${response.payment_id} criado sem link de invoice (verifique no ASAAS).`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBillingStatus("error");
      setBillingMessage(message);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-8 font-[family-name:var(--font-body)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-electric">
            <Siren className="h-4 w-4" />
            Painel de QA
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-blueprint-800 tracking-[-0.02em]">
            Verificador de Funcionalidades
          </h1>
          <p className="text-sm text-text-muted max-w-3xl">
            Abra esta página assim que o deploy estiver no ar para validar saúde da API, sessão,
            upload/processamento e billing ASAAS. Os testes abaixo executam chamadas reais; use uma
            conta de staging e arquivos exemplo.
          </p>
        </div>

        {!rootReady && (
          <Card statusBar="failed">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>
                Não foi possível detectar o domínio raiz da API. Verifique{" "}
                <code>NEXT_PUBLIC_API_URL</code>.
              </p>
            </div>
          </Card>
        )}

        {/* Automated checks */}
        <Card
          title="Testes rápidos"
          description="Executam endpoints críticos automaticamente. Clique em 'Rodar tudo' ou execute individualmente."
        >
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={runAllTests} disabled={isRunningAll || loading}>
              {isRunningAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Rodando...
                </>
              ) : (
                "Rodar tudo"
              )}
            </Button>
            <p className="text-xs text-text-muted">
              Usuário logado? {token ? "Sim" : "Não — faça login para testes autenticados."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {automatedTests.map((test) => {
              const state = testStates[test.id] ?? { status: "idle" as QaStatus };
              return (
                <div
                  key={test.id}
                  className="rounded-[12px] border border-grid-line bg-sheet p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    {test.icon}
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-base font-semibold text-blueprint-800">
                        {test.title}
                      </p>
                      <p className="text-xs text-text-muted">{test.description}</p>
                    </div>
                  </div>
                  {test.requiresAuth && !token && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Necessita login
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runTest(test)}
                      disabled={state.status === "running" || (test.requiresAuth && !token)}
                    >
                      {state.status === "running" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Testando
                        </>
                      ) : (
                        "Executar"
                      )}
                    </Button>
                    <StatusBadge status={state.status} duration={state.durationMs} />
                  </div>
                  {state.message && (
                    <p
                      className={`text-xs ${
                        state.status === "error" ? "text-red-600" : "text-text-muted"
                      }`}
                    >
                      {state.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Flow test */}
        <Card
          title="Fluxo completo (upload → processamento → export)"
          description="Executa todas as etapas com um arquivo real. Utilize DWG/DXF pequeno para evitar fila."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm font-medium text-text-primary">Arquivo DWG/DXF</label>
              <Input
                type="file"
                accept=".dwg,.dxf"
                onChange={(event) => setFlowFile(event.target.files?.[0] ?? null)}
              />
              <label className="text-sm font-medium text-text-primary">
                Escala (multiplicador opcional)
              </label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={flowScale}
                onChange={(event) => setFlowScale(event.target.value)}
              />
              <Button onClick={handleFlowTest} disabled={flowStatus === "running" || loading}>
                {flowStatus === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rodando fluxo
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" /> Executar fluxo
                  </>
                )}
              </Button>
              {flowResult && (
                <div className="rounded-[10px] border border-grid-line bg-surface p-3 text-xs text-text-muted space-y-1">
                  <p>
                    Projeto ID: <strong>{flowResult.project_id}</strong>
                  </p>
                  <p>Disciplinas: {Object.keys(flowResult.summary).length}</p>
                  <p>Itens: {flowResult.items.length}</p>
                </div>
              )}
            </div>
            <div className="rounded-[12px] border border-grid-line bg-surface p-4 max-h-80 overflow-y-auto text-xs font-mono text-text-muted space-y-1">
              {flowLogs.length === 0 ? (
                <p className="text-text-muted/70">Os logs do fluxo aparecerão aqui.</p>
              ) : (
                flowLogs.map((log) => <p key={log}>{log}</p>)
              )}
            </div>
          </div>
          <StatusBadge status={flowStatus} />
        </Card>

        {/* Billing test */}
        <Card
          title="Teste ASAAS / Billing"
          description="Gera um checkout real no ASAAS. Use apenas em ambiente de homologação."
          statusBar="processing"
        >
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Plano a validar</label>
              <select
                value={billingType}
                onChange={(event) => setBillingType(event.target.value as CheckoutType)}
                className="rounded-[8px] border border-grid-line bg-sheet px-3 py-2 text-sm"
              >
                <option value="pay_per_use">Pay-per-use (R$19,90)</option>
                <option value="pro">Pro (R$97)</option>
                <option value="business">Business (R$247)</option>
              </select>
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Este teste cria uma cobrança nova no ASAAS sandbox.
              </p>
            </div>
            <Button onClick={handleBillingTest} disabled={billingStatus === "running" || loading}>
              {billingStatus === "running" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando checkout
                </>
              ) : (
                "Gerar checkout"
              )}
            </Button>
            <StatusBadge status={billingStatus} />
            {billingMessage && (
              <p
                className={`text-sm ${
                  billingStatus === "error" ? "text-red-600" : "text-text-primary"
                }`}
              >
                {billingMessage}
              </p>
            )}
          </div>
        </Card>

        <Card
          title="O que este painel não cobre automaticamente?"
          description="Alguns cenários ainda exigem validação manual."
        >
          <ul className="list-disc pl-5 text-sm text-text-muted space-y-1">
            <li>Webhooks ASAAS (faça replay pelo painel ASAAS e monitore os logs do backend).</li>
            <li>
              Conversões DWG &gt; 50 MB e limites de plano (execute com contas Free para validar HTTP
              402).
            </li>
            <li>Fluxos de block mapping (criação/remoção) — testes de API podem ser feitos via Postman.</li>
            <li>Observabilidade (logs, métricas e alertas externos).</li>
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status, duration }: { status: QaStatus; duration?: number }) {
  const icon =
    status === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : status === "error" ? (
      <XCircle className="h-4 w-4 text-red-600" />
    ) : status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-electric" />
    ) : (
      <FileWarning className="h-4 w-4 text-text-muted" />
    );

  const label =
    status === "success"
      ? "OK"
      : status === "error"
      ? "Erro"
      : status === "running"
      ? "Rodando"
      : "Aguardando";

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      {icon}
      <span>{label}</span>
      {typeof duration === "number" && (
        <span className="text-[10px] text-text-muted/70">
          {duration.toFixed(0)}
          ms
        </span>
      )}
    </div>
  );
}
