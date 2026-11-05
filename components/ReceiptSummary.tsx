import { formatCents } from "@/lib/money";
import type { PublicReceipt } from "@/lib/types";

export function formatPurchaseDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

// Compact header shown at the top of the receipt-specific tipping page.
export function ReceiptSummary({ receipt }: { receipt: PublicReceipt }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">{receipt.cafeName} (fictional)</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Receipt</dt>
        <dd className="text-right font-mono">{receipt.reference}</dd>
        <dt className="text-muted">Purchased</dt>
        <dd className="text-right">{formatPurchaseDate(receipt.purchasedAt)}</dd>
        <dt className="text-muted">Amount paid</dt>
        <dd className="text-right font-semibold">
          {formatCents(receipt.totalCents)} <span className="font-normal text-sage-700">· Paid</span>
        </dd>
      </dl>
    </div>
  );
}
