import Link from "next/link";
import { notFound } from "next/navigation";
import { getTipResult, type TipResult } from "@/lib/server/tips";
import { ConfigError } from "@/lib/server/env";
import { formatCents } from "@/lib/money";
import { CompletionFlow } from "@/components/CompletionFlow";
import { NotConnected } from "@/components/NotConnected";
import { Alert, ErrorPanel, PageShell, StepHeading, buttonClass } from "@/components/ui";
import { CheckAgainButton } from "./CheckAgainButton";

export const metadata = { title: "Tip status · QuietTip" };
export const dynamic = "force-dynamic";

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
        <ErrorPanel title="We could not check your tip" action={<CheckAgainButton />}>
          A server problem stopped us from confirming the tip status. Do not pay again. Your purchase is complete
          either way. Please check again in a moment.
        </ErrorPanel>
      </PageShell>
    );
  }
  if (result.kind === "not_found") notFound();

  const amount = formatCents(result.amountCents);

  if (result.status === "pending") {
    return (
      <PageShell cafeName={result.cafeName}>
        <div className="qt-step space-y-5">
          <StepHeading eyebrow="Tip status">Confirming your tip…</StepHeading>
          <Alert tone="info" role="status" title="Not confirmed yet">
            We have not received confirmation of the {amount} test-mode tip from Stripe yet, so we cannot say it went
            through. Do not pay again. Your purchase is complete either way. This usually takes a few seconds.
          </Alert>
          <CheckAgainButton />
        </div>
      </PageShell>
    );
  }

  const paid = result.status === "paid";
  return (
    <PageShell cafeName={result.cafeName}>
      <CompletionFlow
        token={token}
        feedbackAlreadySaved={result.feedbackSaved}
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
