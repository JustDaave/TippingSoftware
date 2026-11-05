import "server-only";
import { db } from "./supabase";
import { isWellFormedToken } from "../tokens";
import type { PublicReceipt, ReceiptItem } from "../types";

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
