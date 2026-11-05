// Offline checks of the SQL migrations and seed, using PGlite (Postgres compiled to WASM).
// Supabase's roles and its default "grant everything to anon/authenticated" privileges are
// recreated first, so these tests prove the migrations take that access away again.
// This does not replace checking the real project: run `npm run verify:supabase` for that.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = join(__dirname, "..");
let db: PGlite;

const SUPABASE_LIKE_SETUP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function as<T = Record<string, unknown>>(role: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    // Inside an aborted transaction this fails; the later rollback undoes the role change.
    await db.exec("reset role").catch(() => {});
  }
}

async function denied(role: string, sql: string) {
  await expect(as(role, sql)).rejects.toThrow(/permission denied/);
}

async function receiptId(reference: string) {
  const rows = await as<{ id: string }>("service_role", "select id from public.receipts where reference = $1", [reference]);
  return rows[0].id;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_LIKE_SETUP);
  const migrations = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) await db.exec(readFileSync(join(dir, "migrations", file), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const TABLES = ["cafes", "receipts", "tip_attempts", "feedback", "rate_limits"];

describe("public roles (anon key / signed-in users)", () => {
  for (const role of ["anon", "authenticated"]) {
    it(`${role} cannot read any table or the totals view`, async () => {
      for (const t of [...TABLES, "employee_demo_totals"]) await denied(role, `select * from public.${t}`);
    });

    it(`${role} cannot write feedback, change tip status, or edit totals`, async () => {
      const id = await receiptId("JL-1042");
      await denied(role, `insert into public.feedback (receipt_id, worked_well) values ('${id}', 'x')`);
      await denied(role, `update public.tip_attempts set status = 'paid', confirmed_at = now()`);
      await denied(role, `update public.cafes set starting_pool_cents = 999999`);
      await denied(role, `insert into public.receipts (cafe_id, reference, purchased_at, subtotal_cents, tax_cents, total_cents)
                          select id, 'X', now(), 0, 0, 0 from public.cafes`);
      await denied(role, `delete from public.receipts`);
    });

    it(`${role} cannot call server functions`, async () => {
      await denied(role, `select public.consume_rate_limit('x', 1, 60)`);
      await denied(role, `select public.new_receipt_token()`);
    });
  }

  it("RLS is on for every table, with no policies, so a stray grant still returns no rows", async () => {
    const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    expect(rls.rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
    const policies = await db.query(`select 1 from pg_policies where schemaname = 'public'`);
    expect(policies.rows).toHaveLength(0);

    await db.exec("begin; grant select on public.receipts, public.feedback to anon;");
    try {
      expect(await as("anon", "select * from public.receipts")).toHaveLength(0);
      expect(await as("anon", "select * from public.feedback")).toHaveLength(0);
    } finally {
      await db.exec("rollback");
    }
  });

  it("tables created later in public are not granted to anon", async () => {
    await db.exec("begin; create table public.later_table (id int);");
    try {
      await denied("anon", "select * from public.later_table");
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("seed data", () => {
  it("is one fictional cafe with a separate starting pool and three fictional receipts", async () => {
    const cafes = await as<{ name: string; is_fictional: boolean; starting_pool_cents: number; employee_count: number }>(
      "service_role",
      "select name, is_fictional, starting_pool_cents, employee_count from public.cafes",
    );
    expect(cafes).toEqual([{ name: "Juniper Lane Cafe", is_fictional: true, starting_pool_cents: 4000, employee_count: 4 }]);

    const receipts = await as<{ access_token: string; is_fictional: boolean; total_cents: number }>(
      "service_role",
      "select access_token, is_fictional, total_cents from public.receipts",
    );
    expect(receipts).toHaveLength(3);
    for (const r of receipts) {
      expect(r.access_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(r.is_fictional).toBe(true);
      expect(Number.isInteger(r.total_cents)).toBe(true);
    }
    expect(new Set(receipts.map((r) => r.access_token)).size).toBe(3);
  });

  it("can be run twice without duplicating rows", async () => {
    await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
    expect(await as("service_role", "select 1 from public.receipts")).toHaveLength(3);
  });

  it("rejects totals that do not add up and non-fictional rows", async () => {
    await expect(
      as("service_role", `insert into public.receipts (cafe_id, reference, purchased_at, subtotal_cents, tax_cents, total_cents)
                          select id, 'BAD-1', now(), 100, 10, 999 from public.cafes`),
    ).rejects.toThrow(/check constraint/);
    await expect(as("service_role", "update public.cafes set is_fictional = false")).rejects.toThrow(/check constraint/);
  });
});

describe("tips, feedback, and totals (server role)", () => {
  it("counts only confirmed tips in the aggregate totals, separate from the starting pool", async () => {
    const id = await receiptId("JL-1043");
    await as("service_role", `insert into public.tip_attempts (receipt_id, amount_cents, stripe_checkout_session_id)
                              values ($1, 200, 'cs_test_paid1'), ($1, 300, 'cs_test_pending1')`, [id]);
    await as("service_role", `update public.tip_attempts set status = 'paid', confirmed_at = now()
                              where stripe_checkout_session_id = 'cs_test_paid1'`);
    const totals = await as<{ starting_pool_cents: number; confirmed_test_tips_cents: number }>(
      "service_role",
      "select starting_pool_cents, confirmed_test_tips_cents from public.employee_demo_totals",
    );
    expect(totals).toEqual([{ starting_pool_cents: 4000, confirmed_test_tips_cents: 200 }]);
  });

  it("keeps a confirmed tip final and its amount fixed", async () => {
    await expect(
      as("service_role", "update public.tip_attempts set status = 'failed', confirmed_at = null where stripe_checkout_session_id = 'cs_test_paid1'"),
    ).rejects.toThrow(/confirmed tip cannot change/);
    await expect(
      as("service_role", "update public.tip_attempts set amount_cents = 5000 where stripe_checkout_session_id = 'cs_test_pending1'"),
    ).rejects.toThrow(/cannot change/);
  });

  it("stores tips only as whole cents within limits", async () => {
    const id = await receiptId("JL-1044");
    for (const amount of [0, 49, 10001]) {
      await expect(
        as("service_role", "insert into public.tip_attempts (receipt_id, amount_cents) values ($1, $2)", [id, amount]),
      ).rejects.toThrow(/check constraint/);
    }
    await expect(
      as("service_role", "insert into public.tip_attempts (receipt_id, amount_cents) values ($1, 1.5)", [id]),
    ).rejects.toThrow();
  });

  it("saves feedback with or without a tip, and rejects empty feedback", async () => {
    const id = await receiptId("JL-1044"); // no tip on this receipt
    await as("service_role", "insert into public.feedback (receipt_id, worked_well) values ($1, 'Quick service')", [id]);
    expect(await as("service_role", "select 1 from public.feedback where receipt_id = $1", [id])).toHaveLength(1);
    await expect(
      as("service_role", "insert into public.feedback (receipt_id, worked_well, could_improve) values ($1, '  ', null)", [id]),
    ).rejects.toThrow(/check constraint/);
  });

  it("rate limit allows up to the limit in a window, then refuses", async () => {
    const hit = async () =>
      (await as<{ ok: boolean }>("service_role", "select public.consume_rate_limit('test:abc', 2, 600) as ok"))[0].ok;
    expect([await hit(), await hit(), await hit()]).toEqual([true, true, false]);
  });
});
