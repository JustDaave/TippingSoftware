// Shapes shared between server and browser. Keep these minimal: only what the UI needs.

export type ReceiptItem = { name: string; qty: number; cents: number };

// What a receipt link (bearer token) reveals. No customer or payment details exist to expose.
export type PublicReceipt = {
  token: string;
  reference: string;
  purchasedAt: string; // ISO timestamp
  cafeName: string;
  items: ReceiptItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  employeeCount: number;
  policyText: string;
};

export type TipStatus = "pending" | "paid" | "expired" | "failed";

export type DemoTotals = {
  cafeName: string;
  employeeCount: number;
  startingPoolCents: number;
  confirmedTestTipsCents: number;
};

export type ApiError = { error: string };

// Saved state for one receipt, loaded on every visit so refreshing keeps it.
export type ReceiptState = {
  confirmedTipCents: number; // sum of confirmed (paid) tips; 0 when none
  feedbackSaved: boolean;
};
