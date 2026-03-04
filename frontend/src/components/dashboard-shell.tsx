"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Upload, X, Menu, LogOut, ChevronRight } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

const navLinks = [
  { href: "/dashboard", label: "Projetos", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Novo Takeoff", icon: Upload },
];

const planBadgeColors: Record<string, string> = {
  free:     "bg-[#F1F5F9] text-[#64748B]",
  pro:      "bg-[rgba(0,212,170,0.15)] text-[#00B894]",
  business: "bg-[rgba(255,107,53,0.15)] text-[#FF6B35]",
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const plan = (user?.plan ?? "free").toLowerCase();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ── Sidebar Desktop ── */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col bg-blueprint-900 fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="px-6 pt-7 pb-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-base leading-none">
                T
              </span>
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-white text-base tracking-[-0.04em] uppercase">
              DWG<span className="text-electric">SCANNER</span>
              <span className="text-electric text-xs">.AI</span>
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-electric/10 text-electric"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-electric" : "")} />
                {label}
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-electric/60" />}
              </Link>
            );
          })}
        </nav>

        {/* CTA Upload */}
        <div className="px-3 pb-4">
          <button
            onClick={() => router.push("/dashboard/upload")}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-bold",
              "text-blueprint-800 transition-all duration-200",
              "bg-gradient-to-br from-electric to-electric-dark",
              "shadow-[0_2px_12px_rgba(0,212,170,0.3)] hover:shadow-[0_4px_20px_rgba(0,212,170,0.4)] hover:scale-[1.02]"
            )}
          >
            <Upload className="h-4 w-4" />
            Nova Planta
          </button>
        </div>

        {/* User Info */}
        <div className="border-t border-white/5 px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-electric/20 flex items-center justify-center shrink-0">
            <span className="text-electric text-xs font-bold uppercase">
              {(user?.full_name || user?.email || "U")[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.full_name || user?.email}
            </p>
            <span
              className={cn(
                "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] mt-0.5 uppercase tracking-wide",
                planBadgeColors[plan] ?? planBadgeColors.free
              )}
            >
              {plan}
            </span>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-blueprint-900 border-b border-white/5 flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-[10px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00D4AA, #00B894)" }}
          >
            <span className="font-[family-name:var(--font-display)] font-bold text-blueprint-800 text-sm leading-none">T</span>
          </div>
          <span className="font-[family-name:var(--font-display)] font-bold text-white text-sm tracking-[-0.04em] uppercase">
            DWG<span className="text-electric">SCANNER</span>
          </span>
        </Link>
        <button onClick={() => setMobileOpen((p) => !p)} className="text-white">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-blueprint-900/95 pt-16 px-4 flex flex-col gap-3">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-[10px] text-sm font-medium",
                pathname === href ? "bg-electric/10 text-electric" : "text-white/60 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <Button variant="primary" className="mt-2 w-full gap-2" onClick={() => { router.push("/dashboard/upload"); setMobileOpen(false); }}>
            <Upload className="h-4 w-4" />
            Nova Planta
          </Button>
          <Button variant="ghost" className="w-full" onClick={logout}>
            Sair
          </Button>
        </div>
      )}

      {/* ── Content Area ── */}
      <main className="flex-1 md:ml-[260px] pt-16 md:pt-0">
        <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
