import { Link } from "@tanstack/react-router";
import { Search, Sparkles, LogOut, LayoutDashboard, Settings, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/xeomx/LanguageSwitcher";
import { Logo } from "@/components/xeomx/Logo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header({ onSearch, query }: { onSearch?: (v: string) => void; query?: string }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "You";
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground transition hover:border-magenta/40 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-border bg-background p-0 rtl:[&]:!inset-y-0 rtl:[&]:!right-0 rtl:[&]:!left-auto rtl:[&]:border-l-0 rtl:[&]:border-r">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="flex flex-col gap-1 p-4 pt-10">
              <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }} activeOptions={{ exact: true }}>{m.nav_discover()}</Link>
              <Link to="/feed" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_feed()}</Link>
              <Link to="/collections" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_collections()}</Link>
              <Link to="/creators" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_creators()}</Link>
              <Link to="/explore" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_explore()}</Link>
              <Link to="/studio" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_studio()}</Link>
              <Link to="/magazine" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_magazine()}</Link>
              <Link
                to="/xeomx-ai"
                onClick={() => setMobileOpen(false)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)", color: "#fff" }}
              >
                <Sparkles className="h-3.5 w-3.5" /> {m.nav_xeomx_ai()}
              </Link>
              <Link to="/pricing" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>{m.nav_pricing()}</Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center" aria-label="XEOMX — Home">
          <Logo variant="full" size={32} ariaLabel="XEOMX" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link to="/" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }} activeOptions={{ exact: true }}>
            {m.nav_discover()}
          </Link>
          <Link to="/feed" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_feed()}
          </Link>
          <Link to="/collections" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_collections()}
          </Link>
          <Link to="/creators" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_creators()}
          </Link>
          <Link to="/explore" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_explore()}
          </Link>
          <Link to="/studio" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_studio()}
          </Link>
          <Link to="/magazine" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_magazine()}
          </Link>
          <Link
            to="/xeomx-ai"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition"
            style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)", color: "#fff" }}
            activeProps={{ className: "ring-2 ring-magenta/50" }}
          >
            <Sparkles className="h-3.5 w-3.5" /> {m.nav_xeomx_ai()}
          </Link>
          <Link to="/pricing" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            {m.nav_pricing()}
          </Link>
        </nav>

        <div className="ms-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:flex-none sm:gap-3">
          <label className="group relative hidden w-full items-center sm:flex sm:w-80">
            <Search className="absolute start-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder={m.search_placeholder()}
              aria-label={m.search_placeholder()}
              type="search"
              className="w-full rounded-full border border-border bg-surface/60 py-2 ps-9 pe-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-magenta/50 focus:outline-none focus:ring-2 focus:ring-magenta/30"
            />
          </label>
          <LanguageSwitcher />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-surface/60 p-1 pe-3 transition hover:border-magenta/40">
                  {avatar ? (
                    <img src={avatar} alt={name} width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: "var(--gradient-magenta)" }}>
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden text-sm text-foreground sm:inline">{name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> {m.nav_dashboard()}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" /> {m.nav_settings()}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                  <LogOut className="h-4 w-4" /> {m.nav_sign_out()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ next: undefined }}
                className="inline-flex shrink-0 rounded-full border border-border bg-surface/60 px-2.5 py-2 text-xs text-foreground transition hover:border-magenta/40 sm:px-4 sm:text-sm"
              >
                {m.nav_sign_in()}
              </Link>
              <Link
                to="/auth"
                search={{ next: undefined }}
                className="hidden shrink-0 rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:inline-flex"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
              >
                {m.nav_go_pro()}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}