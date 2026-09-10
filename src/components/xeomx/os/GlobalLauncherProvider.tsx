import { lazy, Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { m } from "@/paraglide/messages.js";
const GlobalLauncher = lazy(() =>
  import("@/components/xeomx/os/GlobalLauncher").then((module) => ({
    default: module.GlobalLauncher,
  })),
);

export function GlobalLauncherProvider() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={m.p0_navigation()}
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
