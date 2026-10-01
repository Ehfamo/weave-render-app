import type { GovernanceService } from "./service.ts";
import { object } from "../memory/service.ts";
/** An external adapter must consume canonical approval authority, then freshly check scope/revocation. */
export function connectorAuthority(
  service: Pick<GovernanceService, "command">,
  binding: {
    projectId: string;
    connectorId: string;
    scope: string;
    host: string;
  },
  approval: { consume(): Promise<void> },
) {
  return {
    async authorize(projectId: string, signal?: AbortSignal) {
      if (projectId !== binding.projectId || signal?.aborted) throw Error("CONNECTOR_SCOPE_DENIED");
      const before = object(await service.command("connector_check", binding));
      if (!before.allowed) throw Error("CONNECTOR_SCOPE_DENIED");
      await approval.consume();
      const fresh = object(await service.command("connector_check", binding));
      if (!fresh.allowed || signal?.aborted) throw Error("CONNECTOR_SCOPE_DENIED");
    },
  };
}
