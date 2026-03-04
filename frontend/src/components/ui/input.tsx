import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[10px] border bg-sheet px-4 py-3",
        "font-[family-name:var(--font-body)] text-sm text-text-primary",
        "placeholder:text-[#94A3B8]",
        "transition-all duration-200 outline-none",
        hasError
          ? "border-red-flag shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
          : "border-grid-line focus:border-electric focus:shadow-[0_0_0_3px_rgba(0,212,170,0.15)]",
        className
      )}
      {...props}
    />
  );
});
