import { formatCents, splitCents } from "@/lib/money";

const EXAMPLE_CENTS = 200;

// Shows how a tip would be split. With no valid selection it shows a labeled $2 example.
export function DistributionPreview({
  tipCents,
  employeeCount,
}: {
  tipCents: number | null;
  employeeCount: number;
}) {
  const isPreview = tipCents !== null;
  const cents = tipCents ?? EXAMPLE_CENTS;
  const shares = splitCents(cents, employeeCount);
  const uneven = cents % employeeCount !== 0;
  const tag = isPreview ? "preview" : "example";

  return (
    <figure className="rounded-2xl border border-line bg-surface p-5">
      <figcaption className="text-sm font-semibold text-sage-800">
        {isPreview
          ? `Preview of your selected tip: ${formatCents(cents)}. Nothing has been submitted.`
          : `Example: a ${formatCents(EXAMPLE_CENTS)} tip gives each of ${employeeCount} employees ${formatCents(shares[0])}.`}
      </figcaption>

      <div className="mt-4 rounded-xl bg-sage-50 px-4 py-3 text-center">
        <p className="text-sm text-muted">Employee tip pool</p>
        <p className="text-xl font-semibold">
          {formatCents(cents)} <span className="text-sm font-normal text-muted">({tag})</span>
        </p>
      </div>

      <p className="my-2 text-center text-sm text-muted" aria-hidden="true">
        ↓ divided among {employeeCount} employees ↓
      </p>

      <ul className="grid grid-cols-2 gap-2" aria-label={`Share for each of ${employeeCount} employees (${tag})`}>
        {shares.map((share, i) => (
          <li key={i} className="rounded-xl border border-line px-3 py-2 text-center">
            <span className="block text-sm text-muted">Employee {i + 1}</span>
            <span className="block font-semibold">{formatCents(share)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-2 text-center text-sm">
        Business share: <strong>none</strong>
      </p>

      {uneven && (
        <p className="mt-3 text-sm text-muted">
          Shares can differ by one cent because of rounding. Leftover cents go to Employee 1 first, then Employee 2,
          and so on, so the shares add up exactly to {formatCents(cents)}.
        </p>
      )}
    </figure>
  );
}
