import { db } from "@/lib/server/supabase";
import { findReceiptRow } from "@/lib/server/receipts";
import { allowRequest } from "@/lib/server/rate-limit";
import { errorJson, failure, json, readJson } from "@/lib/server/http";
import { isWellFormedToken } from "@/lib/tokens";
import { FEEDBACK_MAX_CHARS } from "@/lib/feedback";

// Saves optional written feedback. Independent of whether the customer tipped.
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return errorJson("The request could not be read.", 400);

  const { token, workedWell, couldImprove } = body;
  if (!isWellFormedToken(token)) return errorJson("This receipt link is not valid.", 404);
  if (typeof workedWell !== "string" || typeof couldImprove !== "string") {
    return errorJson("Feedback must be text.", 400);
  }
  const worked = workedWell.trim();
  const improve = couldImprove.trim();
  if (!worked && !improve) {
    return errorJson("Enter feedback in at least one field, or finish without feedback.", 400);
  }
  if (worked.length > FEEDBACK_MAX_CHARS || improve.length > FEEDBACK_MAX_CHARS) {
    return errorJson(`Each answer can be up to ${FEEDBACK_MAX_CHARS} characters.`, 400);
  }

  try {
    if (!(await allowRequest(req, "feedback", 5, 600))) {
      return errorJson("Too many feedback submissions from this device. Please wait a few minutes and try again.", 429);
    }
    const receipt = await findReceiptRow(token);
    if (!receipt) return errorJson("This receipt link is not valid.", 404);

    const { error } = await db().from("feedback").insert({
      receipt_id: receipt.id,
      worked_well: worked || null,
      could_improve: improve || null,
    });
    if (error) throw new Error(`Feedback insert failed: ${error.message}`);
    return json({ saved: true }, 201);
  } catch (err) {
    return failure(err, "Saving feedback");
  }
}
