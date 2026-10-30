import { describe, expect, it } from "vitest";
import { ownerFrom } from "./identity";

// SPEC §5 and §17: owner resolution. A session makes the caller a user; otherwise the guest cookie decides.
const COOKIE = "11111111-1111-4111-8111-111111111111";
const headers = new Headers();
const withSession = async () => ({ user: { id: "alice" } });
const noSession = async () => null;

describe("ownerFrom", () => {
  it("a signed-in session with the guest cookie is a user, keeping the cookie as owner", async () => {
    expect(await ownerFrom(headers, COOKIE, withSession)).toEqual({ kind: "user", userId: "alice", ownerId: COOKIE });
  });

  it("no session and a valid cookie is a guest", async () => {
    expect(await ownerFrom(headers, COOKIE, noSession)).toEqual({ kind: "guest", ownerId: COOKIE });
  });

  it("no session and no cookie has no owner yet", async () => {
    expect(await ownerFrom(headers, undefined, noSession)).toBeNull();
  });

  it("a session with no cookie still resolves to a user", async () => {
    const owner = await ownerFrom(headers, undefined, withSession);
    expect(owner?.kind).toBe("user");
    expect(owner && "userId" in owner ? owner.userId : null).toBe("alice");
  });
});
