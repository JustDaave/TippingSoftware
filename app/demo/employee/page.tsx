import { getDemoTotals } from "@/lib/server/demo-totals";
import { ConfigError } from "@/lib/server/env";
import { formatCents, splitCents } from "@/lib/money";
import { NotConnected } from "@/components/NotConnected";
import { Alert, Card, PageShell } from "@/components/ui";
import type { DemoTotals } from "@/lib/types";

export const metadata = { title: "Employee transparency demo · QuietTip" };
export const dynamic = "force-dynamic";

// Public DEMO of aggregate, fictional totals. Shows no receipts, tips, feedback, or identities.
export default async function EmployeeDemoPage() {
  let totals: DemoTotals | null;
  try {
    totals = await getDemoTotals();
  } catch (err) {
    if (err instanceof ConfigError) {
      return (
        <PageShell>
          <NotConnected what="The employee demo" />
        </PageShell>
      );
    }
    throw err;
  }

  if (!totals) {
    return (
      <PageShell>
        <Alert tone="warning" role="alert" title="No demo data">
          The fictional cafe has not been seeded yet. Run supabase/seed.sql.
        </Alert>
      </PageShell>
    );
  }

  const pool = totals.startingPoolCents + totals.confirmedTestTipsCents;
  const shares = splitCents(pool, totals.employeeCount);
  const even = pool % totals.employeeCount === 0;

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Employee transparency demo</h1>
          <p className="font-medium text-sage-800">All figures are fictional demonstration data.</p>
          <p>{totals.cafeName} (fictional) · aggregate totals for one sample shift. No login.</p>
        </div>

        <Card>
          <dl className="divide-y divide-line">
            <Row label="Starting sample pool" value={formatCents(totals.startingPoolCents)} />
            <Row label="Confirmed test-mode tips added" value={formatCents(totals.confirmedTestTipsCents)} />
            <Row label="Current sample pool" value={formatCents(pool)} strong />
            <Row label="Employees sharing the pool" value={String(totals.employeeCount)} />
            <Row
              label={even ? "Equal share per employee" : "Shares divided as evenly as possible"}
              value={even ? formatCents(shares[0]) : `${formatCents(shares[shares.length - 1])} to ${formatCents(shares[0])}`}
            />
          </dl>
        </Card>

        <ul className="grid grid-cols-2 gap-2" aria-label="Fictional share for each employee">
          {shares.map((s, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface px-3 py-2 text-center">
              <span className="block text-sm text-muted">Employee {i + 1}</span>
              <span className="block font-semibold">{formatCents(s)}</span>
            </li>
          ))}
        </ul>

        {!even && (
          <p className="text-sm text-muted">
            Rounding may create a one-cent difference. Leftover cents go to Employee 1 first, then Employee 2, and so
            on, so the shares add up exactly to the current sample pool.
          </p>
        )}

        <div className="space-y-2 text-muted">
          <p>
            The starting sample pool is fictional. Only tips confirmed by Stripe in test mode are added; canceled or
            unfinished payments are not counted. No real money or payouts are involved.
          </p>
          <p>Aggregate totals illustrate the concept only. They do not guarantee customer anonymity.</p>
          <p>This demo does not claim that tips replace wages or guarantee higher earnings.</p>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt>{label}</dt>
      <dd className={strong ? "text-lg font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}
