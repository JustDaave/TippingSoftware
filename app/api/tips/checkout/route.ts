import { createTipCheckout } from "@/lib/server/tips";
import { allowRequest } from "@/lib/server/rate-limit";
import { siteUrl } from "@/lib/server/site-url";
import { errorJson, failure, json, readJson } from "@/lib/server/http";
import { isValidTipCents, MAX_TIP_CENTS, MIN_TIP_CENTS, formatCents } from "@/lib/money";
import { isWellFormedToken } from "@/lib/tokens";

// Starts a separate tip payment on Stripe-hosted Checkout (test mode).
// Called only after the customer reviews a positive tip; "No tip" never reaches this route.
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return errorJson("The request could not be read.", 400);

  const { token, amountCents } = body;
  if (!isWellFormedToken(token)) return errorJson("This receipt link is not valid.", 404);
  if (!isValidTipCents(amountCents)) {
    return errorJson(`Tips must be between ${formatCents(MIN_TIP_CENTS)} and ${formatCents(MAX_TIP_CENTS)}.`, 400);
  }

  try {
    if (!(await allowRequest(req, "tip-checkout", 10, 600))) {
      return errorJson("Too many payment attempts from this device. Please wait a few minutes and try again.", 429);
    }
    const result = await createTipCheckout(token, amountCents, await siteUrl());
    if (result.kind === "not_found") return errorJson("This receipt link is not valid.", 404);
    return json({ url: result.url });
  } catch (err) {
    return failure(err, "Starting the tip payment");
  }
}
