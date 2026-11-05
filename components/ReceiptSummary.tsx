import { formatCents } from "@/lib/money";
import type { PublicReceipt } from "@/lib/types";

export function formatPurchaseDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

// The already-paid purchase, shown at the top of the receipt-specific tipping page.
export function ReceiptSummary({ receipt }: { receipt: PublicReceipt }) {
  return (
    <section
      aria-labelledby="receipt-summary-h"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(31_42_39/0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="receipt-summary-h" className="text-sm font-semibold text-muted">
            Your purchase
          </h2>
          <p className="mt-0.5 font-display text-lg leading-snug font-semibold">{receipt.cafeName}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-50 px-2.5 py-1 text-sm font-semibold text-sage-800 ring-1 ring-sage-200">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 10.5 3 3 7-7" />
          </svg>
          Paid
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        <dt className="text-muted">Receipt</dt>
        <dd className="text-right font-mono">{receipt.reference}</dd>
        <dt className="text-muted">Purchased</dt>
        <dd className="text-right">{formatPurchaseDate(receipt.purchasedAt)}</dd>
        <dt className="self-center text-muted">Amount paid</dt>
        <dd className="text-right text-lg font-semibold">{formatCents(receipt.totalCents)}</dd>
      </dl>
    </section>
  );
}
