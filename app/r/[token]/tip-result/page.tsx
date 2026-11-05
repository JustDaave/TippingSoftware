import Link from "next/link";
import { notFound } from "next/navigation";
import { getTipResult, type TipResult } from "@/lib/server/tips";
import { ConfigError } from "@/lib/server/env";
import { formatCents } from "@/lib/money";
import { CompletionFlow } from "@/components/CompletionFlow";
import { NotConnected } from "@/components/NotConnected";
import { Alert, PageShell, buttonClass } from "@/components/ui";

export const metadata = { title: "Tip status · QuietTip" };

// Stripe sends the customer here after Checkout. The status shown comes from our database
// (updated by the verified webhook, or by asking Stripe directly), never from the URL alone.
export default async function TipResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const { session_id } = await searchParams;
  if (typeof session_id !== "string") notFound();

  let result: TipResult;
  try {
    result = await getTipResult(token, session_id);
  } catch (err) {
    if (err instanceof ConfigError) {
      return (
        <PageShell>
          <NotConnected what="Tip status" />
        </PageShell>
      );
    }
    console.error(err);
    return (
      <PageShell>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">We could not check your tip</h1>
          <Alert tone="error" role="alert">
            A server problem stopped us from confirming the tip status. Your purchase is complete either way. Please
            try again in a moment.
          </Alert>
          <Link href={`/r/${token}/tip-result?session_id=${encodeURIComponent(session_id)}`} className={buttonClass("primary")}>
            Check tip status again
          </Link>
        </div>
      </PageShell>
    );
  }
  if (result.kind === "not_found") notFound();

  const amount = formatCents(result.amountCents);

  if (result.status === "pending") {
    return (
      <PageShell>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Confirming your tip…</h1>
          <Alert tone="info" role="status">
            We have not received confirmation of the {amount} test-mode tip from Stripe yet. Your purchase is complete
            either way. This usually takes a few seconds.
          </Alert>
          <Link href={`/r/${token}/tip-result?session_id=${encodeURIComponent(session_id)}`} className={buttonClass("primary")}>
            Check tip status again
          </Link>
        </div>
      </PageShell>
    );
  }

  const paid = result.status === "paid";
  return (
    <PageShell>
      <CompletionFlow
        token={token}
        summary={
          paid ? (
            <p>
              Your separate {amount} tip was confirmed (Stripe test mode, no real money). Your purchase was already
              complete.
            </p>
          ) : (
            <p>The tip payment did not go through, so you were not charged. Your purchase is complete.</p>
          )
        }
        extra={
          !paid && (
            <Link href={`/r/${token}`} className={buttonClass("quiet")}>
              Return to tip options
            </Link>
          )
        }
      />
    </PageShell>
  );
}
