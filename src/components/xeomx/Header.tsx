import { Link } from "@tanstack/react-router";
import { Search, Sparkles, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/xeomx/LanguageSwitcher";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";
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
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "You";
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--gradient-magenta)" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Xeom<span className="text-gradient-magenta">X</span>
          </span>
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
        </nav>

        <div className="ms-auto flex flex-1 items-center gap-3 sm:flex-none">
          <label className="group relative flex w-full items-center sm:w-80">
            <Search className="absolute start-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder={m.search_placeholder()}
              className="w-full rounded-full border border-border bg-surface/60 py-2 ps-9 pe-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-magenta/50 focus:outline-none focus:ring-2 focus:ring-magenta/30"
            />
          </label>
          <LanguageSwitcher />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-surface/60 p-1 pe-3 transition hover:border-magenta/40">
                  {avatar ? (
                    <img src={avatar} alt={name} className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
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
                className="inline-flex rounded-full border border-border bg-surface/60 px-3 py-2 text-xs text-foreground transition hover:border-magenta/40 sm:px-4 sm:text-sm"
              >
                {m.nav_sign_in()}
              </Link>
              <Link
                to="/auth"
                className="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
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