"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { createCheckout } from "@/lib/api-client";
import type { PlanType } from "@/lib/types";

import { Button } from "./ui/button";
import { Card } from "./ui/card";

const planCopy: Record<PlanType, { title: string; description: string }> = {
  free: {
    title: "Plano Free",
    description: "3 projetos/mês, ideal para validação imediata.",
  },
  pro: {
    title: "Plano Pro",
    description: "Projetos ilimitados, todas as disciplinas liberadas.",
  },
  business: {
    title: "Business",
    description: "Times colaborativos, API e integrações SINAPI/ASAAS.",
  },
};

export function PlanUsageCard({ plan }: { plan: PlanType | undefined }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (type: "pro" | "business" | "pay_per_use") => {
    if (!token) {
      toast.error("Faça login para gerar um checkout.");
      return;
    }
    setLoading(true);
    try {
      const checkout = await createCheckout(type, token);
      toast.success("Checkout ASAAS gerado. Abrindo link...");
      if (checkout.invoice_url) {
        window.open(checkout.invoice_url, "_blank");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar checkout.");
    } finally {
      setLoading(false);
    }
  };

  const activePlan = plan ?? "free";
  const copy = planCopy[activePlan];

  return (
    <Card
      title={copy.title}
      description={
        <div>
          <p className="text-sm text-slate-400">{copy.description}</p>
          {activePlan === "free" && (
            <p className="mt-2 text-xs text-slate-500">Limite: 3 projetos/mês</p>
          )}
        </div>
      }
    >
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" disabled={loading} onClick={() => handleUpgrade("pay_per_use")}>
          {loading ? "Gerando pagamento..." : "Pagar por projeto (R$19,90)"}
        </Button>
        {activePlan !== "pro" && (
          <Button variant="outline" onClick={() => handleUpgrade("pro")} disabled={loading}>
            Upgrade Pro
          </Button>
        )}
        {activePlan !== "business" && (
          <Button variant="ghost" onClick={() => handleUpgrade("business")} disabled={loading}>
            Business
          </Button>
        )}
      </div>
    </Card>
  );
}
