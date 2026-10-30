import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/repo";
import { account, session, specs, usage, user } from "../db/schema";

// SPEC §17: guest claiming and account deletion. Both run in one transaction where they change more than one table.

// Specs the guest cookie owns that no account has claimed yet. Shown as "Keep my N guest specs?" (SPEC §17).
export async function countClaimableSpecs(db: Db, guestOwnerId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(specs)
    .where(and(eq(specs.ownerId, guestOwnerId), isNull(specs.userId)));
  return Number(row?.total ?? 0);
}

// Moves the guest's unclaimed specs to the user. It sets user_id only where owner_id is the given cookie, so another
// guest's specs can never be claimed. A second claim moves nothing (idempotent, SPEC §17).
// The usage counter for the day becomes the larger of the user's and the guest's counts, so a claim never resets a limit.
export async function claimGuestSpecs(
  db: Db,
  userId: string,
  guestOwnerId: string,
  day: string,
): Promise<{ moved: number }> {
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(specs)
      .set({ userId })
      .where(and(eq(specs.ownerId, guestOwnerId), isNull(specs.userId)))
      .returning({ id: specs.id });

    const [guestUsage] = await tx
      .select({ specsStarted: usage.specsStarted })
      .from(usage)
      .where(and(eq(usage.subject, `guest:${guestOwnerId}`), eq(usage.day, day)));
    if (guestUsage) {
      await tx
        .insert(usage)
        .values({ subject: `user:${userId}`, day, specsStarted: guestUsage.specsStarted })
        .onConflictDoUpdate({
          target: [usage.subject, usage.day],
          set: { specsStarted: sql`GREATEST(${usage.specsStarted}, excluded.specs_started)` },
        });
    }
    return { moved: moved.length };
  });
}

// Deletes the account and everything it owns: specs, usage rows, sessions and the account itself (SPEC §17).
// Guest specs of the same browser are not affected.
export async function deleteAccountData(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(specs).where(eq(specs.userId, userId));
    await tx.delete(usage).where(eq(usage.subject, `user:${userId}`));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));
    await tx.delete(user).where(eq(user.id, userId));
  });
}
