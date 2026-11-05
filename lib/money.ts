// Money helpers. All amounts are integer cents; never do arithmetic on dollar floats.

export const PRESET_TIPS_CENTS = [100, 200, 300] as const;

// Stripe's minimum charge for USD is $0.50, so smaller custom tips cannot be paid.
export const MIN_TIP_CENTS = 50;
// Upper bound for this prototype, to catch typos such as 2000 instead of 20.00.
export const MAX_TIP_CENTS = 10000;

export type TipSelection = null | "none" | "100" | "200" | "300" | "custom";

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${rest}`;
}

// Splits cents into `count` shares that differ by at most one cent.
// Leftover cents go to the first shares in order, so the shares always add up exactly.
export function splitCents(cents: number, count: number): number[] {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("cents must be a non-negative integer");
  if (!Number.isInteger(count) || count <= 0) throw new Error("count must be a positive integer");
  const base = Math.floor(cents / count);
  const leftover = cents % count;
  return Array.from({ length: count }, (_, i) => base + (i < leftover ? 1 : 0));
}

export type ParseResult = { ok: true; cents: number } | { ok: false; error: string };

// Parses a customer-typed dollar amount without going through floating point.
export function parseCustomAmount(text: string): ParseResult {
  const value = text.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (value === "") {
    return { ok: false, error: "Enter a custom amount, or choose a different option." };
  }
  if (value.startsWith("-")) {
    return { ok: false, error: "The amount cannot be negative. Enter an amount greater than $0." };
  }
  const match = /^(\d+)?(?:\.(\d{0,2}))?$/.exec(value);
  if (!match || (match[1] === undefined && !match[2])) {
    return { ok: false, error: "Use numbers only, with up to two decimal places (for example 2 or 2.50)." };
  }
  const whole = match[1] ?? "0";
  if (whole.length > 6) {
    return { ok: false, error: `The maximum tip in this prototype is ${formatCents(MAX_TIP_CENTS)}.` };
  }
  const cents = Number(whole) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents <= 0) {
    return { ok: false, error: 'The amount must be greater than $0. To skip tipping, choose "No tip".' };
  }
  if (cents < MIN_TIP_CENTS) {
    return {
      ok: false,
      error: `The smallest tip the payment provider accepts is ${formatCents(MIN_TIP_CENTS)}. To skip tipping, choose "No tip".`,
    };
  }
  if (cents > MAX_TIP_CENTS) {
    return { ok: false, error: `The maximum tip in this prototype is ${formatCents(MAX_TIP_CENTS)}.` };
  }
  return { ok: true, cents };
}

// The positive tip for the current selection, or null when there is none (or custom is invalid).
export function selectedTipCents(selection: TipSelection, customText: string): number | null {
  if (selection === null || selection === "none") return null;
  if (selection === "custom") {
    const parsed = parseCustomAmount(customText);
    return parsed.ok ? parsed.cents : null;
  }
  return Number(selection);
}

// Server-side check for amounts arriving from the browser.
export function isValidTipCents(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_TIP_CENTS &&
    value <= MAX_TIP_CENTS
  );
}
