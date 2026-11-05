import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { findPublicReceipt } from "@/lib/server/receipts";
import { ConfigError } from "@/lib/server/env";
import { siteUrl } from "@/lib/server/site-url";
import { isWellFormedToken } from "@/lib/tokens";
import { formatCents } from "@/lib/money";
import { formatPurchaseDate } from "@/components/ReceiptSummary";
import { NotConnected } from "@/components/NotConnected";
import { PageShell } from "@/components/ui";
import { PrintButton } from "./PrintButton";
import type { PublicReceipt } from "@/lib/types";

export const metadata = { title: "Printable receipt · QuietTip" };

// Printable stand-in for the receipt a customer would get at the counter.
// Its QR code is a working link to this receipt's tipping page.
export default async function PrintReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isWellFormedToken(token)) notFound();

  let receipt: PublicReceipt | null;
  try {
    receipt = await findPublicReceipt(token);
  } catch (err) {
    if (err instanceof ConfigError) {
      return (
        <PageShell>
          <NotConnected what="This receipt" />
        </PageShell>
      );
    }
    throw err;
  }
  if (!receipt) notFound();

  const tipUrl = `${await siteUrl()}/r/${receipt.token}`;
  const qrSvg = await QRCode.toString(tipUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 176 });
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(tipUrl);

  return (
    <main id="main" className="mx-auto w-full max-w-sm px-4 py-8 print:py-0">
      <div className="no-print mb-6 space-y-3">
        <p className="text-sm text-muted">
          Prototype printout of a fictional, already-paid receipt. Print it or show it on another screen, then scan the
          QR code with a phone camera.
        </p>
        {isLocal && (
          <p role="note" className="rounded-xl border border-warn-700/40 bg-warn-50 px-3 py-2 text-sm text-warn-700">
            This QR code points to {new URL(tipUrl).host}, which a phone cannot reach. Set NEXT_PUBLIC_SITE_URL to your
            deployed URL (or your computer&apos;s network address) for scanning.
          </p>
        )}
        <PrintButton />
      </div>

      <article
        aria-label="Printed receipt"
        className="rounded-sm border border-dashed border-ink/40 bg-white px-5 py-6 font-mono text-sm text-ink"
      >
        <header className="text-center">
          <p className="text-base font-bold uppercase">{receipt.cafeName}</p>
          <p className="text-xs">Fictional cafe · prototype receipt</p>
          <p className="mt-2">{formatPurchaseDate(receipt.purchasedAt)}</p>
          <p>Receipt {receipt.reference}</p>
        </header>

        <hr className="my-3 border-dashed border-ink/40" />
        <table className="w-full">
          <caption className="sr-only">Items purchased</caption>
          <tbody>
            {receipt.items.map((item, i) => (
              <tr key={i}>
                <td className="py-0.5">
                  {item.qty > 1 ? `${item.qty} × ` : ""}
                  {item.name}
                </td>
                <td className="py-0.5 text-right">{formatCents(item.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-3 border-dashed border-ink/40" />
        <dl className="grid grid-cols-2 gap-y-0.5">
          <dt>Subtotal</dt>
          <dd className="text-right">{formatCents(receipt.subtotalCents)}</dd>
          <dt>Tax</dt>
          <dd className="text-right">{formatCents(receipt.taxCents)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold">{formatCents(receipt.totalCents)}</dd>
          <dt>Payment</dt>
          <dd className="text-right">PAID</dd>
        </dl>
        <hr className="my-3 border-dashed border-ink/40" />

        <section className="text-center" aria-labelledby="tip-later">
          <h2 id="tip-later" className="font-bold">
            Optional: leave a tip later
          </h2>
          <p className="mt-1 font-sans text-xs">
            Your purchase is complete. If you want to tip after your visit, scan this code with your phone camera.
          </p>
          <div
            role="img"
            aria-label="QR code that opens this receipt's optional tipping page"
            className="mx-auto mt-3 w-44"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-2 font-sans text-xs">No tip is expected. Tips are a separate, optional payment.</p>
        </section>
      </article>
    </main>
  );
}
