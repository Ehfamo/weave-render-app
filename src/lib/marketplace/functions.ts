import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { object, uuid } from "../memory/service.ts";
import type { CatalogEntry } from "./catalog.ts";
const value = (x: unknown, n = 500) => {
  if (typeof x !== "string" || x.length > n) throw Error("INVALID_INPUT");
  return x;
};
async function service() {
  return (await import("./runtime.server.ts")).marketplaceForRequest(
    getRequest().headers.get("authorization"),
  );
}
async function safely<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, data: await run() };
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNAVAILABLE";
    return {
      ok: false as const,
      error: [
        "NOT_CONFIGURED",
        "AUTH_REQUIRED",
        "REAPPROVAL_REQUIRED",
        "MARKETPLACE_APPROVAL_REQUIRED",
        "PRIVATE_CONTEXT_APPROVAL_REQUIRED",
        "TRIAL_UNAVAILABLE",
        "REVIEW_NOT_ELIGIBLE",
        "INTEGRITY_MISMATCH",
      ].includes(code)
        ? code
        : "UNAVAILABLE",
    };
  }
}
// POST keeps search/task/private context out of query strings and request URLs.
export const marketplaceDiscoverFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    return {
      goal: x.goal ? value(x.goal) : undefined,
      type: x.type ? value(x.type, 40) : undefined,
      category: x.category ? value(x.category, 80) : undefined,
      locale: x.locale ? value(x.locale, 10) : undefined,
      compatibleOnly: x.compatibleOnly === true,
      freeOnly: x.freeOnly === true,
    };
  })
  .handler(({ data }) => safely(async () => (await service()).discover(data)));
export const marketplaceDetailFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => uuid(object(v).id))
  .handler(({ data }) => safely(async () => (await service()).details(data)));
export const marketplaceRecommendFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    if (x.kind !== "job" && x.kind !== "conversation") throw Error("INVALID_INPUT");
    return {
      id: uuid(x.id),
      kind: x.kind as "job" | "conversation",
      locale: x.locale ? value(x.locale, 10) : undefined,
    };
  })
  .handler(({ data }) =>
    safely(async () => (await service()).recommend(data.id, data.kind, data.locale)),
  );
export const marketplaceTrialFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    return {
      id: uuid(x.id),
      versionId: uuid(x.versionId),
      projectId: x.projectId ? uuid(x.projectId) : undefined,
      usePrivateContext: x.usePrivateContext === true,
      allowNetwork: x.allowNetwork === true,
      approvedPermissionIds: Array.isArray(x.approvedPermissionIds)
        ? x.approvedPermissionIds.map((p) => value(p, 100))
        : [],
    };
  })
  .handler(({ data }) => safely(async () => (await service()).trial(data)));
export const marketplaceReadinessFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    return { id: uuid(x.id), projectId: uuid(x.projectId) };
  })
  .handler(({ data }) => safely(async () => (await service()).readiness(data.id, data.projectId)));
export const marketplaceApproveFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    return {
      id: uuid(x.id),
      projectId: uuid(x.projectId),
      digest: value(x.digest, 64),
      permissions: Array.isArray(x.permissions) ? x.permissions.map((p) => value(p, 100)) : [],
    };
  })
  .handler(({ data }) =>
    safely(async () =>
      (await service()).approvePermissions(data.id, data.projectId, data.digest, data.permissions),
    ),
  );
export const marketplaceReviewFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    return {
      id: uuid(x.id),
      dimensions: object(x.dimensions) as Record<string, number>,
      text: value(x.text, 2000),
    };
  })
  .handler(({ data }) =>
    safely(async () => (await service()).review(data.id, data.dimensions, data.text)),
  );
export const marketplacePublishFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => {
    const x = object(v);
    uuid(x.id);
    if (JSON.stringify(x).length > 72000) throw Error("INVALID_INPUT");
    return x as unknown as CatalogEntry;
  })
  .handler(({ data }) => safely(async () => (await service()).publish(data)));
