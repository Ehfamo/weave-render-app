import { m } from "@/paraglide/messages.js";
import { CapabilityPanel } from "@/components/xeomx/runtime/CapabilityPanel";
export function BusinessAgentsWorkspace() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 id="business-title" className="text-2xl font-semibold">
            {m.p5_title()}
          </h1>
        </header>
        <section aria-labelledby="business-title" className="grid gap-3 sm:grid-cols-1">
          <CapabilityPanel kind="business" />
        </section>
      </div>
    </main>
  );
}
