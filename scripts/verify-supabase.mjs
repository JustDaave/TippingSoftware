// Checks the connected Supabase project (and optionally the running app) against QuietTip's
// access rules. Reads .env.local. Never prints keys or receipt tokens.
//
//   npm run verify:supabase                          read-only database checks
//   npm run verify:supabase -- --write               also writes and deletes test rows
//   npm run verify:supabase -- --app http://localhost:3000 [--write]
//                                                    also checks the running app's pages/APIs
//
// --write adds rows marked "[automated verification]" and deletes them at the end.
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const appIdx = args.indexOf("--app");
const APP = appIdx >= 0 ? args[appIdx + 1]?.replace(/\/+$/, "") : null;
const MARKER = "[automated verification - safe to delete]";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, opts);
const anon = SUPABASE_PUBLISHABLE_KEY ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, opts) : null;

let failed = 0;
let skipped = 0;
function pass(msg) {
  console.log(`  PASS  ${msg}`);
}
function fail(msg) {
  failed++;
  console.log(`  FAIL  ${msg}`);
}
function skip(msg) {
  skipped++;
  console.log(`  SKIP  ${msg}`);
}
const check = (ok, msg) => (ok ? pass(msg) : fail(msg));

// ------------------------------------------------------------ public key is blocked
console.log("\nPublic (publishable/anon) key");
if (!anon) {
  skip("SUPABASE_PUBLISHABLE_KEY not set, so public-key checks were not run");
} else {
  for (const t of ["cafes", "receipts", "tip_attempts", "feedback", "rate_limits", "employee_demo_totals"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    check(error || data.length === 0, `cannot list ${t}${error ? ` (${error.code ?? "error"})` : " (0 rows)"}`);
  }
  {
    const { error } = await anon.from("feedback").insert({ receipt_id: crypto.randomUUID(), worked_well: MARKER });
    check(!!error, "cannot insert feedback directly");
  }
  {
    const { data, error } = await anon
      .from("tip_attempts")
      .update({ status: "paid", confirmed_at: new Date().toISOString() })
      .not("id", "is", null)
      .select("id");
    check(error || data.length === 0, "cannot change tip payment status");
  }
  {
    const { data, error } = await anon.from("cafes").update({ starting_pool_cents: 999999 }).not("id", "is", null).select("id");
    check(error || data.length === 0, "cannot edit the starting pool / aggregate totals");
  }
  {
    const { error } = await anon.rpc("consume_rate_limit", { p_bucket: "x", p_limit: 1, p_window_seconds: 60 });
    check(!!error, "cannot call consume_rate_limit");
  }
  {
    const { error } = await anon.rpc("new_receipt_token");
    check(!!error, "cannot call new_receipt_token");
  }
}

// ------------------------------------------------------------ server key and seed
console.log("\nServer (secret key) and seed data");
const { data: totals, error: totalsErr } = await server
  .from("employee_demo_totals")
  .select("slug, starting_pool_cents, confirmed_test_tips_cents, employee_count");
check(!totalsErr && totals?.length === 1, "aggregate totals view returns one fictional cafe");
if (totals?.[0]) {
  check(totals[0].starting_pool_cents === 4000, "starting sample pool is $40.00");
  check(Number.isInteger(totals[0].confirmed_test_tips_cents), "confirmed test tips are whole cents");
}
const { data: receipts, error: rErr } = await server
  .from("receipts")
  .select("id, access_token, reference, is_fictional")
  .order("reference");
check(!rErr && receipts?.length >= 3, `seeded receipts present (${receipts?.length ?? 0})`);
check(receipts?.every((r) => /^[A-Za-z0-9_-]{32}$/.test(r.access_token)), "every receipt has a 32-character random token");
check(new Set(receipts?.map((r) => r.access_token)).size === receipts?.length, "tokens are unique");
check(receipts?.every((r) => r.is_fictional), "every receipt is marked fictional");

const target = receipts?.find((r) => r.reference === "JL-1044") ?? receipts?.[0];

// ------------------------------------------------------------ write round trip
console.log("\nPersistence (database)");
if (!WRITE || !target) {
  skip("write checks not run (add --write)");
} else {
  const { data: fb, error } = await server
    .from("feedback")
    .insert({ receipt_id: target.id, worked_well: MARKER })
    .select("id")
    .single();
  check(!error, "feedback insert succeeds with the secret key");
  if (fb) {
    const { data: back } = await server.from("feedback").select("worked_well").eq("id", fb.id).single();
    check(back?.worked_well === MARKER, "feedback reads back unchanged");
  }
  const { data: tip, error: tipErr } = await server
    .from("tip_attempts")
    .insert({ receipt_id: target.id, amount_cents: 50 })
    .select("id")
    .single();
  check(!tipErr, "pending tip attempt can be created by the server");
  if (tip) {
    const { error: amtErr } = await server.from("tip_attempts").update({ amount_cents: 9999 }).eq("id", tip.id);
    check(!!amtErr, "a tip's amount cannot be changed after creation");
    const { error: badErr } = await server.from("tip_attempts").insert({ receipt_id: target.id, amount_cents: 12.5 });
    check(!!badErr, "fractional cents are rejected");
    await server.from("tip_attempts").delete().eq("id", tip.id);
  }
}

// ------------------------------------------------------------ running app
console.log("\nRunning app");
if (!APP || !target) {
  skip("app checks not run (add --app <url>)");
} else {
  const others = receipts.filter((r) => r.id !== target.id);
  const page = await fetch(`${APP}/r/${target.access_token}`, { cache: "no-store" });
  const html = await page.text();
  check(page.status === 200 && html.includes(target.reference), "/r/<token> opens that receipt");
  check(!others.some((r) => html.includes(r.access_token) || html.includes(r.reference)), "page contains no other receipt");
  check(!html.includes(target.id), "page does not expose the internal receipt id");
  check(page.headers.get("referrer-policy") === "no-referrer", "Referrer-Policy is no-referrer");

  // The status can be 200 because the loading screen streams first; the content must be "not found".
  const bad = await fetch(`${APP}/r/${"A".repeat(32)}`);
  const badHtml = await bad.text();
  check(badHtml.includes("Receipt link not found") && !badHtml.includes("Already paid"), "unknown token shows not-found, no receipt");

  const demo = await fetch(`${APP}/api/demo/employee-totals`);
  const demoBody = await demo.json().catch(() => ({}));
  const allowed = ["fictional", "cafeName", "employeeCount", "startingPoolCents", "confirmedTestTipsCents"];
  check(demo.ok && Object.keys(demoBody).every((k) => allowed.includes(k)), "demo endpoint returns aggregate fields only");
  check(demoBody.fictional === true, "demo endpoint labels data as fictional");

  const post = (body) =>
    fetch(`${APP}/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  check((await post({ token: target.access_token, workedWell: "", couldImprove: "" })).status === 400, "empty feedback rejected");
  check((await post({ token: target.access_token, workedWell: "x".repeat(1001), couldImprove: "" })).status === 400, "over-long feedback rejected");
  check((await post({ token: "not-a-token", workedWell: "hi", couldImprove: "" })).status === 404, "malformed token rejected");
  {
    const res = await fetch(`${APP}/api/tips/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: target.access_token, amountCents: 12.5 }),
    });
    check(res.status === 400, "fractional tip amount rejected");
  }

  if (!WRITE) {
    skip("app write checks not run (add --write)");
  } else {
    const first = await post({ token: target.access_token, workedWell: MARKER, couldImprove: "" });
    check(first.status === 201, `feedback saved through the API (got ${first.status})`);
    const reload = await (await fetch(`${APP}/r/${target.access_token}`, { cache: "no-store" })).text();
    check(/feedbackSaved\\?"\s*:\s*true/.test(reload), "after reload, the page knows feedback was saved");
    let limited = false;
    for (let i = 0; i < 6 && !limited; i++) {
      limited = (await post({ token: target.access_token, workedWell: MARKER, couldImprove: "" })).status === 429;
    }
    check(limited, "feedback endpoint rate-limits repeated submissions");
  }
}

// ------------------------------------------------------------ cleanup
if (WRITE) {
  const { error } = await server.from("feedback").delete().eq("worked_well", MARKER);
  console.log(error ? `\nCleanup FAILED: ${error.message}` : "\nCleanup: verification rows deleted.");
  if (error) failed++;
}

console.log(`\n${failed ? `${failed} check(s) failed` : "All run checks passed"}${skipped ? `, ${skipped} skipped` : ""}.`);
process.exit(failed ? 1 : 0);
