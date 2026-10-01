import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { object } from "../memory/service.ts";
export const governanceCommandFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => {
    const data = object(v);
    return { action: String(data.action), input: data.input };
  })
  .handler(async ({ context, data }) => {
    try {
      const { governanceForClient } = await import("./runtime.server.ts");
      return {
        ok: true as const,
        data: await governanceForClient(context.supabase as SupabaseClient).command(
          data.action,
          data.input,
        ),
      };
    } catch {
      return { ok: false as const, error: "GOVERNANCE_BLOCKED" };
    }
  });
