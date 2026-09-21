import { m } from "@/paraglide/messages.js";
import { CapabilityPanel } from "@/components/xeomx/runtime/CapabilityPanel";
export function CreativeWorkspace() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold">{m.creative_title()}</h1>
      </header>
      <CapabilityPanel kind="creative" />
    </main>
  );
}
