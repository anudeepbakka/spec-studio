import { expect, test, type Page } from "@playwright/test";

// SPEC §13 and AC-18 to AC-25: guest flow, sign-up, sign-in, the user menu, claiming guest specs, and account deletion.
// One account is created per run (sign-up is rate limited per IP). It is deleted at the end of the run.
const stamp = Date.now().toString(36);
const username = `e2e_${stamp}`;
const password = `e2e-password-${stamp}`;

// Each test gets a fresh browser context, so a test that needs the account signs in first.
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: username })).toBeVisible();
}

test.describe.serial("accounts", () => {
  test("a guest sees the guest banner and a sign-in link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Guest mode" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("sign-up needs the no-reset acknowledgement", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Tick the box");
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("sign-up creates the account and signs in", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: username })).toBeVisible();
  });

  test("the user menu opens My specs, and sign-out returns to guest", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: username }).click();
    await page.getByRole("menuitem", { name: "My specs" }).click();
    await expect(page).toHaveURL(/\/history$/);

    await page.getByRole("button", { name: username }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password gets the generic message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Invalid username or password");
  });

  test("the right password signs in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: username })).toBeVisible();
  });

  test("a guest's spec can be kept after signing in, and keeping again changes nothing", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    // Creates a guest spec under this browser's cookie.
    const created = await page.request.post("/api/specs", {
      data: { rawRequest: "Let customers download their invoices as PDF files from the account page." },
    });
    expect(created.status()).toBe(201);

    await page.goto("/sign-in");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Keep my 1 guest spec in this account?")).toBeVisible();

    await page.getByRole("button", { name: "Keep them" }).click();
    await expect(page.getByText("Kept 1 spec in your account.")).toBeVisible();

    const again = await page.request.post("/api/account/claim-guest-specs");
    expect(await again.json()).toEqual({ moved: 0 });
    await context.close();
  });

  test("deleting the account removes it and signs out", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: username }).click();
    await page.getByRole("menuitem", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Delete my account and all my specs" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await page.goto("/sign-in");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Invalid username or password");
  });
});
