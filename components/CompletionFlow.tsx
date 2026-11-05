"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, ButtonRow, Card } from "./ui";
import { FEEDBACK_MAX_CHARS } from "@/lib/feedback";

type Phase = "complete" | "final";
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// Completion screen with optional feedback, then the final "All done." screen.
// Used after skipping, canceling, or a confirmed tip, so the language stays neutral.
export function CompletionFlow({
  token,
  heading = "Visit complete",
  summary,
  focusFeedback = false,
  extra,
}: {
  token: string;
  heading?: string;
  summary: React.ReactNode;
  focusFeedback?: boolean;
  extra?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("complete");
  const [worked, setWorked] = useState("");
  const [improve, setImprove] = useState("");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [emptyError, setEmptyError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const finalRef = useRef<HTMLHeadingElement>(null);
  const workedRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const ids = useId();

  useEffect(() => {
    if (phase === "final") finalRef.current?.focus();
    else if (focusFeedback) workedRef.current?.focus();
    else headingRef.current?.focus();
  }, [phase, focusFeedback]);

  useEffect(() => {
    if (save.kind === "saved") confirmRef.current?.focus();
  }, [save.kind]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.kind === "saving") return;
    if (!worked.trim() && !improve.trim()) {
      setEmptyError(true);
      workedRef.current?.focus();
      return;
    }
    setEmptyError(false);
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, workedWell: worked, couldImprove: improve }),
      });
      if (res.status === 201) {
        setSave({ kind: "saved" });
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      // Keep the typed text so the customer can retry.
      setSave({ kind: "error", message: body?.error ?? "Your feedback was not saved. Please try again." });
    } catch {
      setSave({ kind: "error", message: "Your feedback was not saved because the connection failed. Please try again." });
    }
  }

  if (phase === "final") {
    return (
      <div className="space-y-4 py-10 text-center">
        <h1 ref={finalRef} tabIndex={-1} className="text-3xl font-semibold">
          All done.
        </h1>
        <p className="text-lg text-muted">You can close this page.</p>
      </div>
    );
  }

  const saving = save.kind === "saving";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold sm:text-3xl">
          {heading}
        </h1>
        <div className="text-lg">{summary}</div>
      </div>

      {extra}

      {save.kind !== "saved" && (
        <div className="space-y-3">
          <p>You can finish now. Feedback below is optional.</p>
          <ButtonRow>
            <Button variant="primary" onClick={() => setPhase("final")} disabled={saving}>
              Finish without feedback
            </Button>
          </ButtonRow>
        </div>
      )}

      {save.kind === "saved" ? (
        <Card className="space-y-4">
          <p ref={confirmRef} tabIndex={-1} role="status" className="font-semibold text-sage-800">
            Thank you. Your feedback was saved.
          </p>
          <ButtonRow>
            <Button variant="primary" onClick={() => setPhase("final")}>
              Finish
            </Button>
          </ButtonRow>
        </Card>
      ) : (
        <Card>
          <form onSubmit={onSubmit} noValidate aria-labelledby={`${ids}-h`} className="space-y-4">
            <div>
              <h2 id={`${ids}-h`} className="text-xl font-semibold">
                Optional feedback
              </h2>
              <p className="mt-1 text-muted">Feedback is separate from tipping.</p>
              <p id={`${ids}-warn`} className="mt-2 text-sm font-medium">
                Please do not include personal information such as your name, email, or phone number.
              </p>
            </div>

            <FeedbackField
              id={`${ids}-worked`}
              label="What worked well? (optional)"
              value={worked}
              onChange={setWorked}
              describedBy={`${ids}-warn`}
              disabled={saving}
              invalid={emptyError}
              textareaRef={workedRef}
            />
            <FeedbackField
              id={`${ids}-improve`}
              label="What could be improved? (optional)"
              value={improve}
              onChange={setImprove}
              describedBy={`${ids}-warn`}
              disabled={saving}
            />

            {emptyError && (
              <Alert tone="error" role="alert">
                Enter feedback in at least one field, or use “Finish without feedback.”
              </Alert>
            )}
            {save.kind === "error" && (
              <Alert tone="error" role="alert" title="Feedback not saved">
                {save.message}
              </Alert>
            )}

            <ButtonRow>
              <Button type="submit" variant="secondary" busy={saving} busyLabel="Saving feedback…">
                {save.kind === "error" ? "Try saving again" : "Submit feedback"}
              </Button>
            </ButtonRow>
          </form>
        </Card>
      )}
    </div>
  );
}

function FeedbackField({
  id,
  label,
  value,
  onChange,
  describedBy,
  disabled,
  invalid,
  textareaRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  describedBy: string;
  disabled: boolean;
  invalid?: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <textarea
        ref={textareaRef}
        id={id}
        rows={3}
        maxLength={FEEDBACK_MAX_CHARS}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={`${describedBy} ${id}-count`}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-xl border border-line bg-surface px-3 py-2 text-base aria-[invalid=true]:border-danger disabled:opacity-60"
      />
      <p id={`${id}-count`} className="text-right text-xs text-muted">
        {value.length} / {FEEDBACK_MAX_CHARS} characters
      </p>
    </div>
  );
}
