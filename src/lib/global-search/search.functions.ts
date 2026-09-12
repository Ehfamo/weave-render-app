import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateQuery } from "./service";
export const globalSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateQuery)
  .handler(async ({ data }) => {
    const token =
      getRequest()
        .headers.get("authorization")
        ?.replace(/^Bearer /, "") ?? "";
    const { createSearchService } = await import("./runtime.server");
    try {
      return await (await createSearchService(token)).search(data);
    } catch {
      throw new Error("SEARCH_UNAVAILABLE");
    }
  });
