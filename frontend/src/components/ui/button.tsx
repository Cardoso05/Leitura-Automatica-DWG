import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-emerald-500 text-white hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300",
  secondary:
    "bg-slate-800 text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500",
  outline:
    "border border-slate-600 text-slate-100 hover:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-slate-400",
  ghost: "text-slate-300 hover:bg-white/5",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
