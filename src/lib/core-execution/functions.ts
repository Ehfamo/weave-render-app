import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CoreExecutionResponse } from "./contracts.ts";
import { BoundedIdempotencyCache } from "./idempotency.ts";
import { validateCoreExecutionRequest } from "./service.ts";

const requests = new BoundedIdempotencyCache<CoreExecutionResponse>();

function safeFailure(goal = ""): CoreExecutionResponse {
  return {
    ok: false,
    data: {
      executionId: "unavailable",
      state: "FAILED",
      goal,
      errorCode: "INVALID_REQUEST",
      quality: { confidence: "NOT_INDEPENDENTLY_VERIFIED", findings: [], repairCount: 0 },
      nextAction: "RETURN_TO_GOAL",
    },
  };
}

export const executeGoalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<CoreExecutionResponse> => {
    let input;
    try {
      input = validateCoreExecutionRequest(data);
    } catch {
      return safeFailure();
    }
    const request = getRequest();
    const authorization = request?.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return safeFailure(input.goal);
    const key = `${context.userId}:${input.idempotencyKey}`;
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    try {
      return requests.run(key, hash, () =>
        import("./runtime.server.ts")
          .then(({ executeCoreRequest }) =>
            executeCoreRequest({ token, userId: context.userId, request: input, client: context.supabase }),
          )
          .catch(() => safeFailure(input.goal)),
      );
    } catch {
      return safeFailure(input.goal);
    }
  });
