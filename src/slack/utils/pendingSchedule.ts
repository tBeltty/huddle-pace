import { randomBytes } from "node:crypto";

const TTL_MS = 15 * 60_000;

/**
 * Short-lived holder for a validated schedule form while the user decides on the time
 * conflict notice. The full form can exceed Slack's private_metadata limit, so the notice
 * only carries a token.
 */
const pending = new Map<string, { value: unknown; expiresAt: number }>();

function sweep(now: number) {
  for (const [token, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(token);
  }
}

export function stashPendingSchedule<T>(value: T): string {
  const now = Date.now();
  sweep(now);
  const token = randomBytes(8).toString("hex");
  pending.set(token, { value, expiresAt: now + TTL_MS });
  return token;
}

export function peekPendingSchedule<T>(token: string): T | undefined {
  const entry = pending.get(token);
  if (!entry || entry.expiresAt <= Date.now()) {
    pending.delete(token);
    return undefined;
  }
  return entry.value as T;
}

export function takePendingSchedule<T>(token: string): T | undefined {
  const value = peekPendingSchedule<T>(token);
  pending.delete(token);
  return value;
}
