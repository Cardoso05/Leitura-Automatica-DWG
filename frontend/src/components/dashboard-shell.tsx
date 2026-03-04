"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Upload } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

const navLinks = [
  { href: "/dashboard", label: "Projetos" },
  { href: "/dashboard/upload", label: "Novo Takeoff" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
            TAKEOFF<span className="text-emerald-400">.AI</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium text-slate-400 transition hover:text-white",
                  pathname === link.href && "text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{user?.full_name || user?.email}</p>
              <p className="text-xs text-slate-400 uppercase">{user?.plan ?? "free"}</p>
            </div>
            <Button variant="ghost" onClick={logout}>
              Sair
            </Button>
            <Button
              variant="primary"
              className="gap-2"
              onClick={() => router.push("/dashboard/upload")}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
          <button
            className="md:hidden"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/5 bg-slate-900/80 px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium",
                    pathname === link.href ? "text-white" : "text-slate-400"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="ghost" onClick={logout}>
                Sair
              </Button>
              <Button onClick={() => router.push("/dashboard/upload")}>Novo Upload</Button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
