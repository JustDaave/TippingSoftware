import "server-only";
import { db } from "./supabase";
import { isWellFormedToken } from "../tokens";
import type { PublicReceipt, ReceiptItem, ReceiptState } from "../types";

export type ReceiptRow = {
  id: string;
  access_token: string;
  reference: string;
  purchased_at: string;
  items: ReceiptItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  cafes: { name: string; employee_count: number; policy_text: string };
};

const RECEIPT_COLUMNS =
  "id, access_token, reference, purchased_at, items, subtotal_cents, tax_cents, total_cents, cafes!inner(name, employee_count, policy_text)";

// Looks up exactly one receipt by its bearer token. Returns null for malformed or unknown tokens.
export async function findReceiptRow(token: string): Promise<ReceiptRow | null> {
  if (!isWellFormedToken(token)) return null;
  const { data, error } = await db()
    .from("receipts")
    .select(RECEIPT_COLUMNS)
    .eq("access_token", token)
    .maybeSingle<ReceiptRow>();
  if (error) throw new Error(`Receipt lookup failed: ${error.message}`);
  return data;
}

export function toPublicReceipt(row: ReceiptRow): PublicReceipt {
  return {
    token: row.access_token,
    reference: row.reference,
    purchasedAt: row.purchased_at,
    cafeName: row.cafes.name,
    items: row.items.map((i) => ({ name: String(i.name), qty: Number(i.qty), cents: Number(i.cents) })),
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    employeeCount: row.cafes.employee_count,
    policyText: row.cafes.policy_text,
  };
}

export async function findPublicReceipt(token: string): Promise<PublicReceipt | null> {
  const row = await findReceiptRow(token);
  return row ? toPublicReceipt(row) : null;
}

// What this receipt already has, so a refresh does not forget a confirmed tip or saved
// feedback. Returns only a total and a yes/no: never feedback text or individual payments.
export async function getReceiptState(receiptId: string): Promise<ReceiptState> {
  const [tips, feedback] = await Promise.all([
    db().from("tip_attempts").select("amount_cents").eq("receipt_id", receiptId).eq("status", "paid"),
    db().from("feedback").select("id", { count: "exact", head: true }).eq("receipt_id", receiptId),
  ]);
  if (tips.error) throw new Error(`Tip state lookup failed: ${tips.error.message}`);
  if (feedback.error) throw new Error(`Feedback state lookup failed: ${feedback.error.message}`);
  return {
    confirmedTipCents: (tips.data as { amount_cents: number }[]).reduce((sum, t) => sum + t.amount_cents, 0),
    feedbackSaved: (feedback.count ?? 0) > 0,
  };
}
