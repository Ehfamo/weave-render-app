import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NativeMemoryAdapter } from "./native-adapter.ts";
import { MemoryService } from "./service.ts";
export function governedMemory(userId: string, client: SupabaseClient) {
  return new MemoryService(
    new NativeMemoryAdapter(userId, { rpc: (name, args) => client.rpc(name, args) }),
    async (operation, scope, type) => {
      if (scope.kind === "user") return true; // User scope is not an invented global workspace.
      const r = await client.rpc("xeomx_memory_governance", {
        p_project: scope.projectId,
        p_operation: operation,
        p_type: type,
      });
      if (r.error) throw Error("MEMORY_ACCESS_DENIED");
      return r.data === true;
    },
  );
}
