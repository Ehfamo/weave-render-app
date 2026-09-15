import type { RoutingMode } from "../model-gateway/contracts.ts";

export const PENDING_GOAL_KEY = "xeomx.pending-goal.v1";
export const PENDING_GOAL_TTL_MS = 10 * 60 * 1000;

export interface PendingGoal {
  version: 1;
  goal: string;
  idempotencyKey: string;
  quality?: RoutingMode;
  createdAt: number;
  expiresAt: number;
}

export interface HandoffStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_ID = /^[A-Za-z0-9:_-]{16,200}$/;
const isQuality = (value: unknown): value is RoutingMode =>
  value === "FAST" || value === "BALANCED" || value === "BEST";

export function createPendingGoal(
  goal: string,
  quality: RoutingMode | undefined,
  now = Date.now(),
  id = crypto.randomUUID(),
): PendingGoal {
  const normalized = goal.trim();
  if (normalized.length < 2 || normalized.length > 50_000 || !VALID_ID.test(id))
    throw new Error("INVALID_PENDING_GOAL");
  return {
    version: 1,
    goal: normalized,
    idempotencyKey: id,
    ...(quality ? { quality } : {}),
    createdAt: now,
    expiresAt: now + PENDING_GOAL_TTL_MS,
  };
}

export function savePendingGoal(storage: HandoffStorage, pending: PendingGoal): void {
  storage.setItem(PENDING_GOAL_KEY, JSON.stringify(pending));
}

/** Remove before returning so route remounts and auth callbacks cannot execute twice. */
export function consumePendingGoal(storage: HandoffStorage, now = Date.now()): PendingGoal | null {
  const raw = storage.getItem(PENDING_GOAL_KEY);
  storage.removeItem(PENDING_GOAL_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingGoal>;
    if (
      value.version !== 1 ||
      typeof value.goal !== "string" ||
      value.goal.trim().length < 2 ||
      value.goal.length > 50_000 ||
      typeof value.idempotencyKey !== "string" ||
      !VALID_ID.test(value.idempotencyKey) ||
      typeof value.createdAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= now ||
      value.expiresAt - value.createdAt !== PENDING_GOAL_TTL_MS ||
      (value.quality !== undefined && !isQuality(value.quality))
    )
      return null;
    return value as PendingGoal;
  } catch {
    return null;
  }
}
