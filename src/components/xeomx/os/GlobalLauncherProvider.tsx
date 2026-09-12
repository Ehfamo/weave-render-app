import { isCommandShortcut } from "@/lib/command-center/actions";
import { lazy, Suspense, useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { m } from "@/paraglide/messages.js";
const GlobalLauncher = lazy(() =>
  import("@/components/xeomx/os/GlobalLauncher").then((module) => ({
    default: module.GlobalLauncher,
  })),
);

export function GlobalLauncherProvider() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isCommandShortcut(event)) {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <button
        data-command-trigger
        type="button"
        aria-label={m.cc_title()}
        onClick={() => setOpen(true)}
        className="fixed bottom-20 end-4 z-50 min-h-11 min-w-11 rounded-full border bg-background p-3 shadow"
      >
        <Menu aria-hidden className="h-5 w-5" />
      </button>
      {open ? (
        <Suspense
          fallback={
            <p role="status" className="fixed bottom-32 end-4 z-50 bg-background p-3">
              {m.common_loading()}
            </p>
          }
        >
          <GlobalLauncher open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
