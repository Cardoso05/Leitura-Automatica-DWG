import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
  processing: "bg-amber-500/15 text-amber-200 border-amber-400/40",
  waiting_layers: "bg-sky-500/15 text-sky-200 border-sky-400/40",
  uploaded: "bg-slate-500/15 text-slate-200 border-slate-400/40",
  failed: "bg-rose-500/15 text-rose-200 border-rose-400/40",
};

export function Badge({
  label,
  tone = "uploaded",
}: {
  label: string;
  tone?: keyof typeof colors;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium uppercase tracking-wide",
        colors[tone] ?? colors.uploaded
      )}
    >
      {label}
    </span>
  );
}
