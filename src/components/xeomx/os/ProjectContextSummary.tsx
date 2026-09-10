import { useProjectContext } from "./ProjectContextProvider";
import { m } from "@/paraglide/messages.js";

export function ProjectContextSummary() {
  const { context } = useProjectContext();
  return (
    <aside className="rounded-lg border p-3 text-sm text-start" aria-label={m.p0_context_title()}>
      <p>{m.p0_context_title()}</p>
      <p className="break-all text-muted-foreground">{context.projectId ?? m.p0_context_empty()}</p>
    </aside>
  );
}
