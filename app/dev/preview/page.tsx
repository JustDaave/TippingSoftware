import { notFound } from "next/navigation";
import { TipExperience } from "@/components/TipExperience";
import { PageShell } from "@/components/ui";
import type { PublicReceipt } from "@/lib/types";

export const metadata = { title: "Design preview · QuietTip" };
export const dynamic = "force-dynamic";

// DEVELOPMENT ONLY. Renders the customer interface with a fictional receipt so layout,
// keyboard, and error states can be checked without Supabase or Stripe credentials.
// This token does not exist in any database, so payment and feedback requests go to the
// real API and fail honestly (503 when not connected, 404 once connected). Nothing is faked.
// Returns 404 in production builds.
const PREVIEW_RECEIPT: PublicReceipt = {
  token: "preview_preview_preview_preview_",
  reference: "JL-1042",
  purchasedAt: "2026-11-03T13:42:00.000Z",
  cafeName: "Juniper Lane Cafe",
  items: [
    { name: "Oat latte", qty: 1, cents: 450 },
    { name: "Turkey sandwich", qty: 1, cents: 1100 },
    { name: "Blueberry muffin", qty: 1, cents: 300 },
  ],
  subtotalCents: 1850,
  taxCents: 150,
  totalCents: 2000,
  employeeCount: 4,
  policyText:
    "All tips go to the employee pool. For this demonstration, pooled tips are divided equally among four employees who worked this shift. The business keeps none.",
};

export default async function DesignPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { tip, amount } = await searchParams;
  const canceled = tip === "canceled";
  const restoreTipCents = canceled && typeof amount === "string" && /^\d{1,5}$/.test(amount) ? Number(amount) : null;

  return (
    <>
      <p role="note" className="bg-warn-50 px-4 py-2 text-center text-sm font-medium text-warn-700">
        Development design preview. This receipt is not in the database, so nothing can be paid or saved here.
      </p>
      <PageShell cafeName={PREVIEW_RECEIPT.cafeName}>
        <TipExperience
          receipt={PREVIEW_RECEIPT}
          returnedFromCanceledPayment={canceled}
          restoreTipCents={restoreTipCents}
        />
      </PageShell>
    </>
  );
}
