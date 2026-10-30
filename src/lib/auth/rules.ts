// SPEC §17: credential rules. Plain words, so the forms can show them next to the field.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

// A small list of very common passwords (SPEC §17). It is a basic check, not a breach database.
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "1234567890",
  "12345678901",
  "123456789012",
  "qwertyuiop",
  "qwerty1234",
  "iloveyou12",
  "letmein123",
  "welcome123",
  "admin12345",
  "abc123abc123",
  "11111111111",
  "00000000000",
  "changeme12",
  "monkey1234",
  "dragon1234",
  "football12",
  "baseball12",
  "superman12",
  "trustno1xx",
  "sunshine12",
  "princess12",
  "starwars12",
  "passwordpassword",
]);

// Usernames are stored lower case (SPEC §17), so uniqueness is case-insensitive. The form shows them as typed.
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// Returns the message for the first rule the username breaks, or null when it is valid.
export function usernameProblem(username: string): string | null {
  const value = username.trim();
  if (value.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer.`;
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "Username can use letters, digits and underscore only.";
  return null;
}

// Returns the message for the first rule the password breaks, or null when it is valid. No composition rules.
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common. Choose another.";
  return null;
}

// The placeholder address Better Auth requires. It is never routable, and the app never sends mail to it (SPEC §17).
export function placeholderEmail(username: string): string {
  return `${normalizeUsername(username)}@users.invalid`;
}
