import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import type { Db } from "../db/repo";
import { account, session, user, verification } from "../db/schema";
import { getDeps } from "../server/deps";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from "./rules";

// SPEC §17: Better Auth with email and password and the username plugin, on the same database. There is no email.
// Password reset and email verification are not configured, and the route wrapper in app/api/auth blocks those paths.
export function createAuth(db: Db) {
  return betterAuth({
    appName: "Spec Studio",
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment by the library.
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
    },
    plugins: [
      username({
        minUsernameLength: USERNAME_MIN,
        maxUsernameLength: USERNAME_MAX,
        displayUsername: false,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Built on first use, so importing this module never needs DATABASE_URL.
let auth: Auth | undefined;

export function getAuth(): Auth {
  if (!auth) {
    auth = createAuth(getDeps().db);
  }
  return auth;
}
