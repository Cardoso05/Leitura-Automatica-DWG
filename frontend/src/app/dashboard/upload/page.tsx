"use client";

import { Loader2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { UploadWizard } from "@/components/upload-wizard";
import { useAuth } from "@/context/auth-context";

export default function UploadPage() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <p>Faça login para enviar novos arquivos.</p>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Novo Takeoff</p>
          <h1 className="text-3xl font-semibold text-white">Upload de DWG/DXF</h1>
          <p className="text-sm text-slate-400">
            Complete o fluxo em três etapas: upload, mapeamento e resultado.
          </p>
        </div>
        <UploadWizard />
      </div>
    </DashboardShell>
  );
}
