import "server-only";
import type Stripe from "stripe";
import { db } from "./supabase";
import { stripe } from "./stripe";
import { findReceiptRow } from "./receipts";
import type { TipStatus } from "../types";

// Creates a pending tip attempt and a Stripe-hosted Checkout Session for it.
export async function createTipCheckout(token: string, amountCents: number, baseUrl: string) {
  const receipt = await findReceiptRow(token);
  if (!receipt) return { kind: "not_found" as const };

  const { data: attempt, error } = await db()
    .from("tip_attempts")
    .insert({ receipt_id: receipt.id, amount_cents: amountCents })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`Could not create tip attempt: ${error.message}`);

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        submit_type: "pay",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `Optional tip for ${receipt.cafes.name} (fictional)`,
                description: `Separate from purchase ${receipt.reference}, which is already paid. Test mode: no real money.`,
              },
            },
          },
        ],
        // Only internal IDs go to Stripe; the receipt token stays out of Stripe metadata.
        client_reference_id: attempt.id,
        metadata: { tip_attempt_id: attempt.id },
        payment_intent_data: { metadata: { tip_attempt_id: attempt.id } },
        success_url: `${baseUrl}/r/${token}/tip-result?session_id={CHECKOUT_SESSION_ID}`,
        // The amount only lets the tip page restore the customer's choice. It is never used to charge.
        cancel_url: `${baseUrl}/r/${token}?tip=canceled&amount=${amountCents}`,
      },
      { idempotencyKey: `tip-attempt-${attempt.id}` },
    );

    const { error: updateError } = await db()
      .from("tip_attempts")
      .update({ stripe_checkout_session_id: session.id, stripe_livemode: session.livemode })
      .eq("id", attempt.id);
    if (updateError) throw new Error(`Could not save checkout session: ${updateError.message}`);

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return { kind: "ok" as const, url: session.url };
  } catch (err) {
    await db().from("tip_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending");
    throw err;
  }
}

// Applies a Checkout Session's state to its tip attempt. Idempotent: only pending rows change,
// so webhook retries and the return page can both call this without double counting.
export async function syncCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.livemode) throw new Error("Refusing to record a live-mode payment.");
  let next: TipStatus | null = null;
  if (session.status === "complete" && session.payment_status === "paid") next = "paid";
  else if (session.status === "expired") next = "expired";
  if (!next) return;

  const { error } = await db()
    .from("tip_attempts")
    .update(next === "paid" ? { status: next, confirmed_at: new Date().toISOString() } : { status: next })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending");
  if (error) throw new Error(`Could not update tip status: ${error.message}`);
}

export type TipResult =
  | { kind: "not_found" }
  | { kind: "ok"; status: TipStatus; amountCents: number; cafeName: string };

// Reads a tip attempt for the return page. The session must belong to this receipt.
// If the webhook has not arrived yet, asks Stripe directly before reporting a status.
export async function getTipResult(token: string, sessionId: string): Promise<TipResult> {
  const receipt = await findReceiptRow(token);
  if (!receipt || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) return { kind: "not_found" };

  const load = async () => {
    const { data, error } = await db()
      .from("tip_attempts")
      .select("status, amount_cents")
      .eq("stripe_checkout_session_id", sessionId)
      .eq("receipt_id", receipt.id)
      .maybeSingle<{ status: TipStatus; amount_cents: number }>();
    if (error) throw new Error(`Tip lookup failed: ${error.message}`);
    return data;
  };

  let row = await load();
  if (!row) return { kind: "not_found" };
  if (row.status === "pending") {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    await syncCheckoutSession(session);
    row = (await load()) ?? row;
  }
  return { kind: "ok", status: row.status, amountCents: row.amount_cents, cafeName: receipt.cafes.name };
}
