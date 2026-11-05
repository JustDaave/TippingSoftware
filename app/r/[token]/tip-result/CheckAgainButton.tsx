"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Re-runs the server status check without a full page reload, with a visible busy state.
export function CheckAgainButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="primary"
      busy={pending}
      busyLabel="Checking tip status…"
      onClick={() => startTransition(() => router.refresh())}
    >
      Check tip status again
    </Button>
  );
}
