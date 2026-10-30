import { defineConfig, devices } from "@playwright/test";

// SPEC §13: end-to-end tests run against a production build, so the real pages and API routes are exercised.
// They use the database in .env.local. Sign-up is limited per IP (SPEC §17), so keep runs few per hour.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  // Sign-up hashes the password and writes several rows to a remote database, so it can take several seconds.
  expect: { timeout: 45_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Better Auth checks the request origin against BETTER_AUTH_URL, so it must match the port used here.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}` },
  },
});
