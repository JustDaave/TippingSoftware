import { getDemoTotals } from "@/lib/server/demo-totals";
import { errorJson, failure, json } from "@/lib/server/http";

// Public, read-only, aggregate-only figures for the employee transparency DEMO.
export async function GET() {
  try {
    const totals = await getDemoTotals();
    if (!totals) return errorJson("Demo totals are not set up yet.", 404);
    return json({ fictional: true, ...totals });
  } catch (err) {
    return failure(err, "Loading demo totals");
  }
}
