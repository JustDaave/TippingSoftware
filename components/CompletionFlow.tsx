"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, FieldError, StepHeading } from "./ui";
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
  feedbackAlreadySaved = false,
  extra,
}: {
  token: string;
  heading?: string;
  summary: React.ReactNode;
  focusFeedback?: boolean;
  /** True when the database already has feedback for this receipt (for example after a refresh). */
  feedbackAlreadySaved?: boolean;
  extra?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("complete");
  const [worked, setWorked] = useState("");
  const [improve, setImprove] = useState("");
  const [save, setSave] = useState<SaveState>(feedbackAlreadySaved ? { kind: "saved" } : { kind: "idle" });
  const [emptyError, setEmptyError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const finalRef = useRef<HTMLHeadingElement>(null);
  const workedRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const ids = useId();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (phase === "final") finalRef.current?.focus({ preventScroll: true });
    else if (focusFeedback) workedRef.current?.focus();
    else headingRef.current?.focus({ preventScroll: true });
  }, [phase, focusFeedback]);

  // Move focus only when a save finishes now, not when the page loads already saved.
  const initialSave = useRef(save.kind);
  useEffect(() => {
    if (save.kind === initialSave.current) return;
    initialSave.current = save.kind;
    if (save.kind === "saved") confirmRef.current?.focus();
    if (save.kind === "error") errorRef.current?.focus();
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
      // Only a 201 from the server means the feedback row was written.
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
      <div className="qt-step flex flex-col items-center gap-4 py-12 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-sage-100 text-sage-800">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 12.5 4 4 8-9" />
          </svg>
        </span>
        <h1 ref={finalRef} tabIndex={-1} className="font-display text-4xl font-semibold">
          All done.
        </h1>
        <p className="text-lg text-muted">You can close this page.</p>
      </div>
    );
  }

  const saving = save.kind === "saving";

  return (
    <div className="qt-step space-y-6">
      <div className="space-y-3">
        <StepHeading headingRef={headingRef}>{heading}</StepHeading>
        <div className="text-lg">{summary}</div>
      </div>

      {extra}

      {save.kind !== "saved" && (
        <div className="space-y-3">
          <p>You can finish now. Feedback below is optional.</p>
          <Button variant="primary" onClick={() => setPhase("final")} disabled={saving} className="sm:w-full">
            Finish without feedback
          </Button>
        </div>
      )}

      {save.kind === "saved" ? (
        <Card className="space-y-4">
          <p ref={confirmRef} tabIndex={-1} role="status" className="flex items-center gap-2 font-semibold text-sage-800">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <path d="m6.5 10.2 2.3 2.3 4.7-4.9" />
            </svg>
            Thank you. Your feedback was saved.
          </p>
          <Button variant="primary" onClick={() => setPhase("final")} className="sm:w-full">
            Finish
          </Button>
        </Card>
      ) : (
        <Card>
          <form
            onSubmit={onSubmit}
            noValidate
            aria-labelledby={`${ids}-h`}
            aria-busy={saving || undefined}
            className="space-y-5"
          >
            <div>
              <h2 id={`${ids}-h`} className="font-display text-xl font-semibold">
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
              onChange={(v) => {
                setWorked(v);
                setEmptyError(false);
              }}
              describedBy={`${ids}-warn${emptyError ? ` ${ids}-empty` : ""}`}
              disabled={saving}
              invalid={emptyError}
              textareaRef={workedRef}
            />
            <FeedbackField
              id={`${ids}-improve`}
              label="What could be improved? (optional)"
              value={improve}
              onChange={(v) => {
                setImprove(v);
                setEmptyError(false);
              }}
              describedBy={`${ids}-warn`}
              disabled={saving}
            />

            {emptyError && (
              <FieldError id={`${ids}-empty`}>
                Enter feedback in at least one field, or use “Finish without feedback.”
              </FieldError>
            )}
            {save.kind === "error" && (
              <Alert alertRef={errorRef} tone="error" role="alert" title="Feedback not saved">
                {save.message} Your text is still here.
              </Alert>
            )}

            <Button type="submit" variant="secondary" busy={saving} busyLabel="Saving feedback…" className="sm:w-full">
              {save.kind === "error" ? "Try saving again" : "Submit feedback"}
            </Button>
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
  const nearLimit = value.length > FEEDBACK_MAX_CHARS * 0.9;
  return (
    <div className="space-y-1.5">
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
        className={
          "block w-full rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-base transition-colors " +
          "focus-visible:border-sage-600 aria-[invalid=true]:border-danger disabled:bg-paper disabled:text-muted"
        }
      />
      <p id={`${id}-count`} className={`text-right text-xs ${nearLimit ? "font-semibold text-warn-700" : "text-muted"}`}>
        {value.length} / {FEEDBACK_MAX_CHARS} characters
      </p>
    </div>
  );
}
