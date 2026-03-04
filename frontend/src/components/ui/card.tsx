import { cn } from "@/lib/utils";

type StatusBarColor = "completed" | "processing" | "failed" | "pending" | "none";

const statusBarColors: Record<StatusBarColor, string> = {
  completed: "bg-pipe-green",
  processing: "bg-caution",
  failed: "bg-red-flag",
  pending: "bg-grid-line",
  none: "hidden",
};

export function Card({
  title,
  description,
  children,
  className,
  statusBar = "none",
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  statusBar?: StatusBarColor;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[12px] border border-grid-line bg-sheet overflow-hidden",
        "shadow-[0_1px_4px_rgba(0,0,0,0.04)]",
        "transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {statusBar !== "none" && (
        <div
          className={cn("h-[3px] w-full rounded-t-[12px]", statusBarColors[statusBar])}
        />
      )}
      <div className="p-6">
        {(title || description) && (
          <div className="mb-4 space-y-1">
            {title && (
              <h3 className="font-[family-name:var(--font-display)] text-[15px] font-bold text-blueprint-800 leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <div className="font-[family-name:var(--font-body)] text-sm text-text-muted">
                {description}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
