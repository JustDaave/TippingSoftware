import { Alert, StepHeading } from "./ui";

// Honest state for when an integration's credentials are missing. Never pretends to work.
export function NotConnected({ what }: { what: string }) {
  return (
    <div className="qt-step space-y-5">
      <StepHeading>Demo not connected</StepHeading>
      <Alert tone="warning" role="alert" title={`${what} is not available`}>
        This prototype is not connected to its database or payment provider yet, so nothing can be shown, saved, or
        charged. The site owner needs to finish setup (see README.md).
      </Alert>
    </div>
  );
}
