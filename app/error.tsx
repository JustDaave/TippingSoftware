"use client";

import { Alert, Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <Alert tone="error" role="alert">
        This page could not load because of a server problem. Nothing was charged. Your purchase is not affected.
      </Alert>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
