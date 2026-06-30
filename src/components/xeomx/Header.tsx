import { Link } from "@tanstack/react-router";
import { Search, Sparkles, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
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
            Discover
          </Link>
          <Link to="/feed" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            Viral feed
          </Link>
          <Link to="/collections" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            Collections
          </Link>
          <Link to="/creators" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            Creators
          </Link>
          <Link to="/explore" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground" activeProps={{ className: "bg-surface text-foreground" }}>
            Explore
          </Link>
        </nav>

        <div className="ml-auto flex flex-1 items-center gap-3 sm:flex-none">
          <label className="group relative flex w-full items-center sm:w-80">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder="Search prompts, styles, creators…"
              className="w-full rounded-full border border-border bg-surface/60 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-magenta/50 focus:outline-none focus:ring-2 focus:ring-magenta/30"
            />
          </label>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-surface/60 p-1 pr-3 transition hover:border-magenta/40">
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
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-foreground transition hover:border-magenta/40 sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
              >
                Go Pro
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}