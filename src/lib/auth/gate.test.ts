import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/repo";
import { testDb } from "@/test/db";
import { ALLOWED_AUTH_PATHS, authPath, clientIp, gateSignIn, gateSignUp } from "./gate";

// SPEC §17 and AC-18 to AC-20: the sign-in and sign-up gate, with rate limits and generic errors.
let db: Db;
const NOW = new Date("2026-10-30T12:00:00Z");

beforeEach(async () => {
  db = await testDb();
});

function signInRequest(username: string, password: string, ip = "203.0.113.1"): Request {
  return new Request("http://localhost/api/auth/sign-in/username", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ username, password }),
  });
}

function signUpRequest(username: string, password: string, ip = "203.0.113.2"): Request {
  return new Request("http://localhost/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ username, password }),
  });
}

const ok = () => new Response("{}", { status: 200 });
const wrong = () => new Response("{}", { status: 401 });

describe("routes", () => {
  it("allows only the sign-in, sign-up, sign-out and session paths", () => {
    expect(authPath("/api/auth/sign-in/username")).toBe("/sign-in/username");
    expect([...ALLOWED_AUTH_PATHS]).toEqual(["/get-session", "/sign-in/username", "/sign-up/email", "/sign-out"]);
    expect(ALLOWED_AUTH_PATHS as readonly string[]).not.toContain("/request-password-reset");
    expect(ALLOWED_AUTH_PATHS as readonly string[]).not.toContain("/verify-email");
  });

  it("takes the client IP from the forwarded header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("gateSignIn", () => {
  it("answers a wrong password with the generic message, never saying which part was wrong", async () => {
    const response = await gateSignIn(db, signInRequest("ada", "wrong-password"), async () => wrong(), NOW);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "invalid_credentials", message: "Invalid username or password" } });
  });

  it("blocks a username after 5 failures without calling Better Auth, even with the right password", async () => {
    for (let i = 0; i < 5; i++) {
      await gateSignIn(db, signInRequest("ada", "wrong-password"), async () => wrong(), NOW);
    }
    const handle = vi.fn(async () => ok());
    const response = await gateSignIn(db, signInRequest("ada", "correct-password-1"), handle, NOW);
    expect(response.status).toBe(429);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
    expect(handle).not.toHaveBeenCalled();
  });

  it("limits sign-in attempts per IP to 20 in 15 minutes", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await gateSignIn(db, signInRequest(`user${i}`, "x"), async () => ok(), NOW)).status).toBe(200);
    }
    const blocked = await gateSignIn(db, signInRequest("another", "x"), async () => ok(), NOW);
    expect(blocked.status).toBe(429);
  });

  it("a success clears the failures for that username", async () => {
    for (let i = 0; i < 4; i++) await gateSignIn(db, signInRequest("ada", "bad"), async () => wrong(), NOW);
    expect((await gateSignIn(db, signInRequest("ada", "good-password-1"), async () => ok(), NOW)).status).toBe(200);
    for (let i = 0; i < 4; i++) await gateSignIn(db, signInRequest("ada", "bad"), async () => wrong(), NOW);
    expect((await gateSignIn(db, signInRequest("ada", "good-password-1"), async () => ok(), NOW)).status).toBe(200);
  });
});

describe("gateSignUp", () => {
  it("refuses a short password before Better Auth is called", async () => {
    const handle = vi.fn(async () => ok());
    const response = await gateSignUp(db, signUpRequest("ada_1", "short"), handle, NOW);
    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it("passes a placeholder address and the username to Better Auth", async () => {
    const handle = vi.fn(async () => ok());
    await gateSignUp(db, signUpRequest("Ada_1", "lowercase only phrase"), handle, NOW);
    expect(handle).toHaveBeenCalledWith({
      email: "ada_1@users.invalid",
      password: "lowercase only phrase",
      name: "Ada_1",
      username: "Ada_1",
    });
  });

  it("reports a taken username next to the field", async () => {
    const taken = async () => new Response("{}", { status: 422 });
    const response = await gateSignUp(db, signUpRequest("ada_1", "lowercase only phrase"), taken, NOW);
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("username_taken");
  });

  it("limits new accounts per IP to 5 in an hour", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await gateSignUp(db, signUpRequest(`user_${i}`, "lowercase only phrase"), async () => ok(), NOW)).status).toBe(200);
    }
    expect((await gateSignUp(db, signUpRequest("user_six", "lowercase only phrase"), async () => ok(), NOW)).status).toBe(429);
  });
});
