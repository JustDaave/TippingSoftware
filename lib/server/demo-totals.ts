import "server-only";
import { db } from "./supabase";
import type { DemoTotals } from "../types";

export const DEMO_CAFE_SLUG = "juniper-lane";

// Aggregate-only figures. Never returns individual receipts, tips, or feedback.
export async function getDemoTotals(): Promise<DemoTotals | null> {
  const { data, error } = await db()
    .from("employee_demo_totals")
    .select("name, employee_count, starting_pool_cents, confirmed_test_tips_cents")
    .eq("slug", DEMO_CAFE_SLUG)
    .maybeSingle<{
      name: string;
      employee_count: number;
      starting_pool_cents: number;
      confirmed_test_tips_cents: number;
    }>();
  if (error) throw new Error(`Totals lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    cafeName: data.name,
    employeeCount: data.employee_count,
    startingPoolCents: data.starting_pool_cents,
    confirmedTestTipsCents: data.confirmed_test_tips_cents,
  };
}
