import { DemoBanner, Skeleton, Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <DemoBanner />
      <main id="main" className="mx-auto w-full max-w-xl space-y-6 px-4 pb-16 pt-6 sm:pt-10">
        <p role="status" className="flex items-center gap-2 font-medium text-muted">
          <Spinner />
          Checking your tip status with the payment provider…
        </p>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
    </>
  );
}
