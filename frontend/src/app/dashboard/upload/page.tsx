"use client";

import { Loader2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { UploadWizard } from "@/components/upload-wizard";
import { useAuth } from "@/context/auth-context";

export default function UploadPage() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-electric" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-center">
        <p className="text-sm text-text-muted">Faça login para enviar novos arquivos.</p>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-7 font-[family-name:var(--font-body)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-electric mb-1">
            Novo Takeoff
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
            Upload de DWG/DXF
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Complete o fluxo em três etapas: upload, mapeamento e resultado.
          </p>
        </div>
        <UploadWizard />
      </div>
    </DashboardShell>
  );
}
