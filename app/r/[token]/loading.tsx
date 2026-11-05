import { DemoBanner, Skeleton, Spinner } from "@/components/ui";

// Shown while the receipt is looked up. Mirrors the tipping page layout so nothing jumps.
export default function Loading() {
  return (
    <>
      <DemoBanner />
      <div className="border-b border-line bg-surface/70">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      </div>
      <main id="main" className="mx-auto w-full max-w-xl space-y-6 px-4 pb-16 pt-6 sm:pt-10">
        <p role="status" className="flex items-center gap-2 font-medium text-muted">
          <Spinner />
          Loading your receipt…
        </p>
        <div className="space-y-2">
          <Skeleton className="h-8 w-11/12" />
          <Skeleton className="h-8 w-2/3" />
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </main>
    </>
  );
}
