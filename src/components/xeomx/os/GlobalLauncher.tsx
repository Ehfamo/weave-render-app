import { CommandCenter } from "@/components/xeomx/command-center/CommandCenter";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getClientPolicyHint,
  RECENT_ACTION_KEY,
  NAVIGATION_TARGETS,
  recentNavigation,
} from "@/lib/navigation-policy";
import { m } from "@/paraglide/messages.js";

/** Command Center entry with the existing preview navigation available under More. */
export function GlobalLauncher({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [legacy, setLegacy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      setRecent(recentNavigation(JSON.parse(sessionStorage.getItem(RECENT_ACTION_KEY) ?? "[]")));
    } catch {
      setRecent([]);
    }
  }, []);
  const policy = getClientPolicyHint("preview");
  const destinations = recentNavigation([...recent, ...NAVIGATION_TARGETS]);
  function navigate(to: string) {
    const next = recentNavigation([to, ...recent]);
    setRecent(next);
    try {
      sessionStorage.setItem(RECENT_ACTION_KEY, JSON.stringify(next));
    } catch {
      /* Navigation works without storage. */
    }
    onOpenChange(false);
  }
  if (!legacy)
    return (
      <CommandCenter open={open} onOpenChange={onOpenChange} onLegacy={() => setLegacy(true)} />
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto text-start">
        <DialogTitle>{m.p0_navigation()}</DialogTitle>
        <DialogDescription>{m.p0_preview_only()}</DialogDescription>
        <nav className="grid gap-2" data-execution-authorized={policy.executionAuthorized}>
          {destinations.map((to) => (
            <Link
              key={to}
              to={to}
              onClick={() => navigate(to)}
              className="min-h-11 rounded-lg border px-3 py-3 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {to}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
