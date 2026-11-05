import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <main id="main" className="mx-auto flex max-w-xl items-center gap-3 px-4 py-16" role="status">
      <Spinner />
      <span>Loading your receipt…</span>
    </main>
  );
}
