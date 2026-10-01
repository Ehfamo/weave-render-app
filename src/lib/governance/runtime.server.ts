import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { GovernanceService } from "./service.ts";
import { runtimeGovernance } from "./runtime.ts";

export function governanceForClient(client: SupabaseClient) {
  return new GovernanceService({
    async command(action, data) {
      const result = await client.rpc("xeomx_governance", { p_action: action, p_data: data });
      if (result.error) throw Error("GOVERNANCE_BLOCKED");
      return result.data;
    },
  });
}
export function governanceForRun(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  runId: string,
) {
  let creativeHost: string | undefined;
  try {
    creativeHost = new URL(process.env.XEOMX_CREATIVE_ENDPOINT ?? "").hostname;
  } catch {
    /* NOT_CONFIGURED */
  }
  return runtimeGovernance({
    policy: governanceForClient(client),
    userId,
    projectId,
    runId,
    providerHosts: { groq: "api.groq.com", "creative-http": creativeHost },
    meter: {
      async command(action, data) {
        const result = await (supabaseAdmin as unknown as SupabaseClient).rpc(
          "xeomx_governance_meter",
          {
            p_actor: userId,
            p_action: action,
            p_data: data,
          },
        );
        if (result.error)
          throw Error(
            /BUDGET_STOPPED|CONCURRENCY_LIMIT|COST_UNKNOWN/.test(result.error.message)
              ? "BUDGET_STOPPED"
              : "GOVERNANCE_BLOCKED",
          );
        return result.data;
      },
    },
  });
}
