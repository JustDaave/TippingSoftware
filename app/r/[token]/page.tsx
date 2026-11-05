import { notFound } from "next/navigation";
import { findPublicReceipt } from "@/lib/server/receipts";
import { ConfigError } from "@/lib/server/env";
import { isWellFormedToken } from "@/lib/tokens";
import { TipExperience } from "@/components/TipExperience";
import { NotConnected } from "@/components/NotConnected";
import { PageShell } from "@/components/ui";
import type { PublicReceipt } from "@/lib/types";

export const metadata = { title: "Optional tip · QuietTip" };

// Opened by scanning the QR code on a printed receipt. The token is a bearer link:
// whoever holds it can see this one receipt's limited details and choose to tip.
export default async function ReceiptTipPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const { tip } = await searchParams;
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

  return (
    <PageShell>
      <TipExperience key={receipt.token} receipt={receipt} returnedFromCanceledPayment={tip === "canceled"} />
    </PageShell>
  );
}
