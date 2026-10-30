import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/repo";
import { rateLimit } from "../db/schema";

// SPEC §17: database-backed rate limits, so they hold across serverless instances. Best effort, not a security boundary.

export const SIGN_IN_IP_MAX = 20;
export const SIGN_IN_IP_WINDOW_MS = 15 * 60 * 1000;
export const SIGN_UP_IP_MAX = 5;
export const SIGN_UP_IP_WINDOW_MS = 60 * 60 * 1000;
export const USERNAME_LOCK_AFTER = 5;
export const USERNAME_LOCK_CAP_MINUTES = 60;

// Counts one attempt in a fixed window. Allowed while the count is within the maximum.
export async function hitWindow(
  db: Db,
  key: string,
  max: number,
  windowMs: number,
  now: Date,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const windowStart = new Date(now.getTime() - windowMs);
  // Raw SQL takes ISO strings: the driver does not serialise Date objects inside sql templates.
  const windowStartIso = windowStart.toISOString();
  const nowIso = now.toISOString();
  const [row] = await db
    .insert(rateLimit)
    .values({ key, failures: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        failures: sql`CASE WHEN ${rateLimit.windowStart} < ${windowStartIso}::timestamptz THEN 1 ELSE ${rateLimit.failures} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimit.windowStart} < ${windowStartIso}::timestamptz THEN ${nowIso}::timestamptz ELSE ${rateLimit.windowStart} END`,
      },
    })
    .returning({ failures: rateLimit.failures, windowStart: rateLimit.windowStart });
  if (!row) {
    throw new Error("rate_limit upsert returned no row");
  }
  return {
    allowed: row.failures <= max,
    retryAfterMs: Math.max(0, row.windowStart.getTime() + windowMs - now.getTime()),
  };
}

// Milliseconds until a username's lock ends, or 0 when it is not locked.
export async function lockRemainingMs(db: Db, key: string, now: Date): Promise<number> {
  const [row] = await db.select({ blockedUntil: rateLimit.blockedUntil }).from(rateLimit).where(eq(rateLimit.key, key));
  if (!row?.blockedUntil) return 0;
  return Math.max(0, row.blockedUntil.getTime() - now.getTime());
}

// Records a failed sign-in for a username. From the 5th consecutive failure, block for 1 minute, doubling on each
// further failure, capped at 60 minutes (SPEC §17).
export async function recordFailure(db: Db, key: string, now: Date): Promise<void> {
  const [row] = await db
    .insert(rateLimit)
    .values({ key, failures: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { failures: sql`${rateLimit.failures} + 1` },
    })
    .returning({ failures: rateLimit.failures });
  if (!row || row.failures < USERNAME_LOCK_AFTER) return;
  const minutes = Math.min(USERNAME_LOCK_CAP_MINUTES, 2 ** (row.failures - USERNAME_LOCK_AFTER));
  await db
    .update(rateLimit)
    .set({ blockedUntil: new Date(now.getTime() + minutes * 60 * 1000) })
    .where(eq(rateLimit.key, key));
}

// A successful sign-in resets the count (SPEC §17).
export async function clearFailures(db: Db, key: string): Promise<void> {
  await db.delete(rateLimit).where(eq(rateLimit.key, key));
}
