import "server-only";

// Thrown when an integration is not configured. Callers show an honest "not connected"
// state instead of pretending the action worked.
export class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing environment variables: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

function read(names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new ConfigError(missing);
  return Object.fromEntries(names.map((n) => [n, process.env[n] as string]));
}

export function supabaseEnv() {
  const e = read(["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  return { url: e.SUPABASE_URL, secretKey: e.SUPABASE_SECRET_KEY };
}

export function stripeEnv() {
  const e = read(["STRIPE_SECRET_KEY"]);
  // Refuse live keys: this prototype must only ever use Stripe's test environment.
  if (!e.STRIPE_SECRET_KEY.startsWith("sk_test_") && !e.STRIPE_SECRET_KEY.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a TEST mode key (sk_test_...). Live keys are not allowed.");
  }
  return { secretKey: e.STRIPE_SECRET_KEY };
}

export function stripeWebhookSecret() {
  return read(["STRIPE_WEBHOOK_SECRET"]).STRIPE_WEBHOOK_SECRET;
}

// Salt for hashing IP addresses in rate-limit keys. Falls back to the Supabase key so
// local setup has one fewer variable; set RATE_LIMIT_SALT in production.
export function rateLimitSalt() {
  return process.env.RATE_LIMIT_SALT || supabaseEnv().secretKey;
}
