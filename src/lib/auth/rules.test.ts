import { describe, expect, it } from "vitest";
import { passwordProblem, placeholderEmail, usernameProblem } from "./rules";

// SPEC §17: credential rules.
describe("usernameProblem", () => {
  it("accepts letters, digits and underscore, 3 to 24 characters", () => {
    expect(usernameProblem("ada_lovelace1")).toBeNull();
    expect(usernameProblem("abc")).toBeNull();
    expect(usernameProblem("a".repeat(24))).toBeNull();
  });

  it("refuses too short and too long names", () => {
    expect(usernameProblem("ab")).toMatch(/at least 3/);
    expect(usernameProblem("a".repeat(25))).toMatch(/24 characters or fewer/);
  });

  it("refuses spaces and symbols", () => {
    expect(usernameProblem("bad name")).toMatch(/letters, digits and underscore/);
    expect(usernameProblem("dot.name")).toMatch(/letters, digits and underscore/);
  });
});

describe("passwordProblem", () => {
  it("needs 10 to 128 characters and has no composition rules", () => {
    expect(passwordProblem("short")).toMatch(/at least 10/);
    expect(passwordProblem("a".repeat(129))).toMatch(/128 characters or fewer/);
    expect(passwordProblem("lowercase only phrase")).toBeNull();
  });

  it("refuses a very common password, ignoring case", () => {
    expect(passwordProblem("Password123")).toMatch(/too common/);
  });
});

describe("placeholderEmail", () => {
  it("uses the reserved .invalid domain with the lower-case username", () => {
    expect(placeholderEmail("Ada_Lovelace")).toBe("ada_lovelace@users.invalid");
  });
});
