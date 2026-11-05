"use client";

import { Button, DemoBanner, ErrorPanel } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <DemoBanner />
      <main id="main" className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        <ErrorPanel
          title="Something went wrong"
          action={
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
          }
        >
          This page could not load because of a server problem. Nothing was charged. Your purchase is not affected.
        </ErrorPanel>
      </main>
    </>
  );
}
