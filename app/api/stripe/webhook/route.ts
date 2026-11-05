import type Stripe from "stripe";
import { stripe } from "@/lib/server/stripe";
import { stripeWebhookSecret } from "@/lib/server/env";
import { syncCheckoutSession } from "@/lib/server/tips";
import { db } from "@/lib/server/supabase";
import { errorJson, failure, json } from "@/lib/server/http";

// Stripe calls this after Checkout finishes. The signature check proves the event came from
// Stripe; only then is a tip marked paid.
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return errorJson("Missing signature.", 400);

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, stripeWebhookSecret());
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") return failure(err, "Webhook handling");
    return errorJson("Invalid signature.", 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired":
        await syncCheckoutSession(event.data.object);
        break;
      case "checkout.session.async_payment_failed": {
        const { error } = await db()
          .from("tip_attempts")
          .update({ status: "failed" })
          .eq("stripe_checkout_session_id", event.data.object.id)
          .eq("status", "pending");
        if (error) throw new Error(error.message);
        break;
      }
      default:
        break; // Ignore unrelated events.
    }
    return json({ received: true });
  } catch (err) {
    // A 5xx makes Stripe retry later, which is what we want if the database was unavailable.
    return failure(err, "Webhook handling");
  }
}
