import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: [
    "text-blueprint-800 font-bold",
    "bg-gradient-to-br from-electric to-electric-dark",
    "shadow-[0_2px_12px_rgba(0,212,170,0.3)]",
    "hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(0,212,170,0.4)]",
    "focus-visible:ring-2 focus-visible:ring-electric/50",
  ].join(" "),

  secondary: [
    "bg-transparent text-blueprint-800 font-semibold",
    "border-2 border-blueprint-800",
    "hover:bg-blueprint-800/5",
    "focus-visible:ring-2 focus-visible:ring-blueprint-800/30",
  ].join(" "),

  upgrade: [
    "text-white font-bold",
    "bg-gradient-to-br from-hotwire to-hotwire-dark",
    "shadow-[0_2px_12px_rgba(255,107,53,0.3)]",
    "hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(255,107,53,0.4)]",
    "focus-visible:ring-2 focus-visible:ring-hotwire/50",
  ].join(" "),

  ghost: [
    "bg-transparent text-text-muted font-medium",
    "hover:bg-surface",
    "focus-visible:ring-2 focus-visible:ring-grid-line",
  ].join(" "),

  outline: [
    "bg-transparent text-blueprint-800 font-semibold",
    "border border-grid-line",
    "hover:bg-surface hover:border-blueprint-800/30",
    "focus-visible:ring-2 focus-visible:ring-electric/30",
  ].join(" "),
};

const sizes = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-sm",
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
        "inline-flex items-center justify-center rounded-[10px] font-[family-name:var(--font-body)] transition-all duration-200 focus-visible:outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-grid-line disabled:text-text-muted disabled:shadow-none disabled:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
