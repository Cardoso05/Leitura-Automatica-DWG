import { cn } from "@/lib/utils";

export function Card({
  title,
  description,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur", className)}>
      {(title || description) && (
        <div className="mb-4 space-y-1">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {description && <p className="text-sm text-slate-300">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
