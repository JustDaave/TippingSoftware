import { PageShell, StepHeading } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <div className="qt-step space-y-4">
        <StepHeading>Receipt link not found</StepHeading>
        <p>
          We could not find this page. If you scanned a receipt, check that the whole QR code was in view and try
          again. Your purchase is not affected.
        </p>
      </div>
    </PageShell>
  );
}
