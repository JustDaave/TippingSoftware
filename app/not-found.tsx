import { PageShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Receipt link not found</h1>
        <p>
          We could not find this page. If you scanned a receipt, check that the whole QR code was in view and try
          again. Your purchase is not affected.
        </p>
      </div>
    </PageShell>
  );
}
