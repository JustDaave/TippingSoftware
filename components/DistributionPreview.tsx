import { formatCents, splitCents } from "@/lib/money";

const EXAMPLE_CENTS = 200;

// Shows how a tip would be split among the pooled employees.
// With no valid positive selection it shows a clearly labeled $2 example instead.
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
    <figure className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(31_42_39/0.04)] sm:p-6">
      <figcaption>
        <span className="inline-block rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-sage-800 ring-1 ring-sage-200">
          {isPreview ? "Preview · not submitted" : "Example"}
        </span>
        <span className="mt-2 block font-semibold">
          {isPreview
            ? `Preview of your selected tip: ${formatCents(cents)}. Nothing has been submitted.`
            : `Example: a ${formatCents(EXAMPLE_CENTS)} tip gives each of ${employeeCount} employees ${formatCents(shares[0])}.`}
        </span>
      </figcaption>

      <div className="mt-5 rounded-xl bg-sage-50 px-4 py-3 text-center ring-1 ring-sage-100">
        <p className="text-sm text-muted">Employee tip pool</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCents(cents)} <span className="text-sm font-normal text-muted">({tag})</span>
        </p>
      </div>

      <div aria-hidden="true" className="flex justify-center py-2 text-sage-600">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v15M6 13l6 6 6-6" />
        </svg>
      </div>
      <p className="sr-only">Divided among {employeeCount} employees:</p>

      <ul className="grid grid-cols-2 gap-2" aria-label={`Share for each of ${employeeCount} employees (${tag})`}>
        {shares.map((share, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <span
              aria-hidden="true"
              className="hidden size-8 shrink-0 items-center min-[400px]:flex justify-center rounded-full bg-sage-100 text-sm font-semibold text-sage-800"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-muted">Employee {i + 1}</span>
              <span className="block font-semibold tabular-nums">{formatCents(share)}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-center text-sm">
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
