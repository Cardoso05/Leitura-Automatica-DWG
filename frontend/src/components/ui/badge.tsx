import { cn } from "@/lib/utils";

/* ── Status badges ── */
const statusStyles: Record<string, string> = {
  completed:      "bg-[#ECFDF5] text-[#059669] border border-[#059669]/20",
  processing:     "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20",
  waiting_layers: "bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20",
  uploaded:       "bg-[#F1F5F9] text-[#64748B] border border-[#64748B]/20",
  failed:         "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20",
  pending:        "bg-[#F1F5F9] text-[#64748B] border border-[#64748B]/20",
};

/* ── Discipline badges ── */
const disciplineStyles: Record<string, string> = {
  eletrica:   "bg-[rgba(255,107,53,0.10)] text-[#FF6B35] border border-[rgba(255,107,53,0.25)]",
  electrical: "bg-[rgba(255,107,53,0.10)] text-[#FF6B35] border border-[rgba(255,107,53,0.25)]",
  hidraulica: "bg-[rgba(59,130,246,0.10)] text-[#3B82F6] border border-[rgba(59,130,246,0.25)]",
  plumbing:   "bg-[rgba(59,130,246,0.10)] text-[#3B82F6] border border-[rgba(59,130,246,0.25)]",
  rede:       "bg-[rgba(139,92,246,0.10)] text-[#8B5CF6] border border-[rgba(139,92,246,0.25)]",
  networking: "bg-[rgba(139,92,246,0.10)] text-[#8B5CF6] border border-[rgba(139,92,246,0.25)]",
  hvac:       "bg-[rgba(6,182,212,0.10)] text-[#06B6D4] border border-[rgba(6,182,212,0.25)]",
  incendio:   "bg-[rgba(239,68,68,0.10)] text-[#EF4444] border border-[rgba(239,68,68,0.25)]",
  fire:       "bg-[rgba(239,68,68,0.10)] text-[#EF4444] border border-[rgba(239,68,68,0.25)]",
  gas:        "bg-[rgba(245,158,11,0.10)] text-[#F59E0B] border border-[rgba(245,158,11,0.25)]",
  spda:       "bg-[rgba(234,179,8,0.10)] text-[#EAB308] border border-[rgba(234,179,8,0.25)]",
  generic:    "bg-[rgba(100,116,139,0.10)] text-[#64748B] border border-[rgba(100,116,139,0.25)]",
};

const statusLabels: Record<string, string> = {
  completed:      "Concluído",
  processing:     "Processando",
  waiting_layers: "Aguardando layers",
  uploaded:       "Enviado",
  failed:         "Erro",
  pending:        "Pendente",
};

export function Badge({
  label,
  tone = "uploaded",
  variant = "status",
}: {
  label?: string;
  tone?: string;
  variant?: "status" | "discipline";
}) {
  const styles = variant === "discipline" ? disciplineStyles : statusStyles;
  const displayLabel = label ?? (variant === "status" ? (statusLabels[tone] ?? tone) : tone);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] px-[10px] py-[4px]",
        "font-[family-name:var(--font-body)] text-[11px] font-semibold",
        styles[tone] ?? (variant === "status" ? statusStyles.uploaded : disciplineStyles.rede)
      )}
    >
      {displayLabel}
    </span>
  );
}
