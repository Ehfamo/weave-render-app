import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/xeomx/Logo";
import { LanguageSwitcher } from "@/components/xeomx/LanguageSwitcher";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { m } from "@/paraglide/messages.js";

const links = [
  ["/projects", () => m.p8_projects()],
  ["/marketplace", () => m.p8_marketplace()],
] as const;
export function Header(_: { onSearch?: (value: string) => void; query?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link to="/" aria-label="XEOMX — Home">
          <Logo variant="full" size={32} ariaLabel="XEOMX" />
        </Link>
        <nav aria-label={m.p8_primary_navigation()} className="hidden items-center gap-1 sm:flex">
          {links.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label()}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={m.p8_open_menu()}
                className="grid min-h-11 min-w-11 place-items-center rounded-lg border sm:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 rtl:[&]:!left-auto rtl:[&]:!right-0">
              <SheetTitle>{m.p8_primary_navigation()}</SheetTitle>
              <nav className="mt-6 flex flex-col gap-2">
                {links.map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-lg px-3 py-3 text-sm hover:bg-muted"
                  >
                    {label()}
                  </Link>
                ))}
                <Link
                  to="/xeomx-ai"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-lg px-3 py-3 text-sm hover:bg-muted"
                >
                  {m.p8_command_center()}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-lg px-3 py-3 text-sm hover:bg-muted"
                >
                  {m.p8_settings()}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
