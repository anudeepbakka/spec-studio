import { describe, expect, it } from "vitest";
import { resolveOwnerId } from "./owner";

const VALID = "11111111-1111-4111-8111-111111111111";

describe("resolveOwnerId", () => {
  it("keeps a valid UUID from the cookie", () => {
    expect(resolveOwnerId(VALID)).toEqual({ ownerId: VALID, isNew: false });
  });

  it("creates a new UUID when the cookie is missing", () => {
    const result = resolveOwnerId(undefined);

    expect(result.isNew).toBe(true);
    expect(result.ownerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("replaces a cookie that is not a UUID", () => {
    const result = resolveOwnerId("not-a-uuid");

    expect(result.isNew).toBe(true);
    expect(result.ownerId).not.toBe("not-a-uuid");
  });
});
