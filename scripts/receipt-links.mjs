// Prints the private links for the seeded fictional receipts.
// Usage: npm run receipts:links   (reads .env.local)
// Treat the output like a secret: anyone with a link can open that receipt's tipping page.
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data, error } = await db
  .from("receipts")
  .select("reference, access_token, total_cents")
  .order("reference");

if (error) {
  console.error(`Could not read receipts: ${error.message}`);
  process.exit(1);
}
if (!data.length) {
  console.error("No receipts found. Run supabase/seed.sql first.");
  process.exit(1);
}

for (const r of data) {
  console.log(`${r.reference}  ($${(r.total_cents / 100).toFixed(2)} paid, fictional)`);
  console.log(`  Tipping page:      ${base}/r/${r.access_token}`);
  console.log(`  Printable receipt: ${base}/r/${r.access_token}/print`);
}
