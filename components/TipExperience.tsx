"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Alert, Button, Card, FieldError, StepHeading } from "./ui";
import { ReceiptSummary } from "./ReceiptSummary";
import { DistributionPreview } from "./DistributionPreview";
import { CompletionFlow } from "./CompletionFlow";
import {
  MIN_TIP_CENTS,
  formatCents,
  parseCustomAmount,
  selectedTipCents,
  selectionFromCents,
  splitCents,
  type TipSelection,
} from "@/lib/money";
import type { PublicReceipt } from "@/lib/types";

// Where keyboard focus goes when the choose step appears.
type ChooseFocus = "none" | "heading" | "where-tips-go" | "selected-option";

type Step =
  | { name: "choose"; focus: ChooseFocus }
  | { name: "distribution" }
  | { name: "review"; tipCents: number }
  | { name: "complete"; outcome: "skipped" | "canceled"; focusFeedback: boolean };

const OPTIONS: { value: Exclude<TipSelection, null>; label: string }[] = [
  { value: "none", label: "No tip" },
  { value: "100", label: "$1" },
  { value: "200", label: "$2" },
  { value: "300", label: "$3" },
  { value: "custom", label: "Custom" },
];

// The whole customer experience for ONE receipt. The page mounts it with key={token},
// so a different receipt never reuses this state.
export function TipExperience({
  receipt,
  returnedFromCanceledPayment,
  restoreTipCents = null,
}: {
  receipt: PublicReceipt;
  returnedFromCanceledPayment: boolean;
  /** Amount the customer had reviewed before canceling on Stripe's page, if any. */
  restoreTipCents?: number | null;
}) {
  const restored = selectionFromCents(restoreTipCents);
  // Nothing is selected on a first visit. Only a returning customer gets their own choice back.
  const [step, setStep] = useState<Step>({ name: "choose", focus: "none" });
  const [selection, setSelection] = useState<TipSelection>(restored.selection);
  const [customText, setCustomText] = useState(restored.customText);

  if (step.name === "complete") {
    return (
      <CompletionFlow
        token={receipt.token}
        summary={
          <p>
            {step.outcome === "canceled" ? "The tip was canceled before payment. " : ""}No tip was added. Your purchase
            is complete.
          </p>
        }
        focusFeedback={step.focusFeedback}
      />
    );
  }

  if (step.name === "distribution") {
    return (
      <DistributionStep
        receipt={receipt}
        tipCents={selectedTipCents(selection, customText)}
        onBack={() => setStep({ name: "choose", focus: "where-tips-go" })}
      />
    );
  }

  if (step.name === "review") {
    return (
      <ReviewStep
        receipt={receipt}
        tipCents={step.tipCents}
        onEdit={() => setStep({ name: "choose", focus: "selected-option" })}
        onCancel={() => setStep({ name: "complete", outcome: "canceled", focusFeedback: false })}
      />
    );
  }

  return (
    <ChooseStep
      receipt={receipt}
      focus={step.focus}
      selection={selection}
      customText={customText}
      onSelection={setSelection}
      onCustomText={setCustomText}
      notice={returnedFromCanceledPayment}
      onReview={(tipCents) => setStep({ name: "review", tipCents })}
      onDistribution={() => setStep({ name: "distribution" })}
      onFinishWithoutTip={(focusFeedback) => setStep({ name: "complete", outcome: "skipped", focusFeedback })}
    />
  );
}

// Moves focus to the new step's heading so keyboard and screen reader users land at the top.
function useStepHeading(enabled = true) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!enabled) return;
    window.scrollTo({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [enabled]);
  return ref;
}

// ---------------------------------------------------------------- choose

function ChooseStep({
  receipt,
  focus,
  selection,
  customText,
  onSelection,
  onCustomText,
  notice,
  onReview,
  onDistribution,
  onFinishWithoutTip,
}: {
  receipt: PublicReceipt;
  focus: ChooseFocus;
  selection: TipSelection;
  customText: string;
  onSelection: (s: TipSelection) => void;
  onCustomText: (t: string) => void;
  notice: boolean;
  onReview: (tipCents: number) => void;
  onDistribution: () => void;
  onFinishWithoutTip: (focusFeedback: boolean) => void;
}) {
  const headingRef = useStepHeading(focus === "heading");
  const optionRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customRef = useRef<HTMLInputElement>(null);
  const whereRef = useRef<HTMLButtonElement>(null);
  const [choiceError, setChoiceError] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const ids = useId();

  // Returning from another step: put focus back where the customer left off.
  useEffect(() => {
    if (focus === "where-tips-go") whereRef.current?.focus();
    if (focus === "selected-option") {
      const target = selection === "custom" ? customRef.current : optionRefs.current[selection ?? ""];
      target?.focus();
    }
    // Only on mount: later selection changes must not move focus.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tipCents = selectedTipCents(selection, customText);

  let submitLabel = "Review tip";
  let summary: string;
  if (selection === null) {
    submitLabel = "Choose an option to continue";
    summary = "No option selected yet.";
  } else if (selection === "none") {
    submitLabel = "Finish without tipping";
    summary = "No tip selected. Your purchase is already complete.";
  } else if (tipCents === null) {
    summary = "Enter a valid custom amount to review your tip.";
  } else {
    summary = `Selected tip: ${formatCents(tipCents)}. Nothing has been submitted.`;
  }

  function choose(value: Exclude<TipSelection, null>) {
    onSelection(value);
    setChoiceError(false);
    setCustomError(null);
  }

  // A pointer click on "Custom" moves focus to the amount field. Keyboard arrow keys also
  // fire click events (with detail 0); those keep focus in the radio group.
  function onOptionClick(e: MouseEvent<HTMLInputElement>, value: string) {
    if (value === "custom" && e.detail > 0) requestAnimationFrame(() => customRef.current?.focus());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selection === null) {
      setChoiceError(true);
      optionRefs.current.none?.focus();
      return;
    }
    if (selection === "none") {
      onFinishWithoutTip(false);
      return;
    }
    if (selection === "custom") {
      const parsed = parseCustomAmount(customText);
      if (!parsed.ok) {
        setCustomError(parsed.error);
        customRef.current?.focus();
        return;
      }
      onReview(parsed.cents);
      return;
    }
    onReview(Number(selection));
  }

  const positive = tipCents !== null;

  return (
    <div className="qt-step space-y-6">
      <StepHeading headingRef={headingRef} eyebrow="Optional tip">
        Your purchase is complete. Tipping is optional.
      </StepHeading>

      <ReceiptSummary receipt={receipt} />

      {notice && (
        <Alert tone="info" role="status" title="Tip payment canceled">
          You were not charged for a tip. Your purchase is still complete. You can choose again or finish without
          tipping.
        </Alert>
      )}

      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <fieldset aria-describedby={`${ids}-choice-help${choiceError ? ` ${ids}-choice-err` : ""}`}>
            <legend className="text-lg font-semibold">Tip amount</legend>
            <p id={`${ids}-choice-help`} className="mt-1 text-sm text-muted">
              Choosing an amount does not charge you. You can review it first.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[480px]:grid-cols-5">
              {OPTIONS.map((opt) => {
                const checked = selection === opt.value;
                return (
                  <label key={opt.value} className="relative block">
                    <input
                      ref={(el) => {
                        optionRefs.current[opt.value] = el;
                      }}
                      type="radio"
                      name="tip"
                      value={opt.value}
                      checked={checked}
                      onChange={() => choose(opt.value)}
                      onClick={(e) => onOptionClick(e, opt.value)}
                      aria-invalid={choiceError || undefined}
                      className="peer sr-only"
                    />
                    <span
                      className={
                        "flex min-h-12 cursor-pointer select-none items-center justify-center rounded-xl border-2 " +
                        "border-line-strong bg-surface px-3 py-2 text-base font-semibold " +
                        "transition-[color,background-color,border-color,transform] duration-150 " +
                        "hover:border-sage-600 hover:bg-sage-50/60 motion-safe:active:scale-[0.97] " +
                        "peer-checked:border-sage-700 peer-checked:bg-sage-50 peer-checked:text-sage-800 " +
                        "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-600"
                      }
                    >
                      {opt.label}
                    </span>
                    {checked && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-sage-700 text-white ring-2 ring-surface"
                      >
                        <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 10.5 3 3 7-7" />
                        </svg>
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selection === "custom" && (
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-custom`} className="block font-medium">
                Custom tip amount (US dollars)
              </label>
              <div
                className={
                  "flex items-center rounded-xl border-2 bg-surface transition-colors " +
                  "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-sage-600 " +
                  (customError ? "border-danger" : "border-line-strong focus-within:border-sage-600")
                }
              >
                <span aria-hidden="true" className="pl-3 text-lg text-muted">
                  $
                </span>
                <input
                  ref={customRef}
                  id={`${ids}-custom`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={customText}
                  onChange={(e) => {
                    onCustomText(e.target.value);
                    setCustomError(null);
                  }}
                  aria-invalid={customError ? true : undefined}
                  aria-describedby={`${ids}-hint${customError ? ` ${ids}-custom-err` : ""}`}
                  className="min-h-12 w-full rounded-xl bg-transparent px-2 text-lg tabular-nums placeholder:text-muted/70 focus:outline-none"
                />
              </div>
              <p id={`${ids}-hint`} className="text-sm text-muted">
                Enter at least {formatCents(MIN_TIP_CENTS)}, for example 2.50.
              </p>
              {customError && <FieldError id={`${ids}-custom-err`}>{customError}</FieldError>}
            </div>
          )}

          {choiceError && (
            <FieldError id={`${ids}-choice-err`}>Choose an option to continue, or use “Finish without tipping.”</FieldError>
          )}

          <div
            aria-live="polite"
            className={
              "flex items-start gap-2 rounded-xl px-4 py-3 transition-colors " +
              (positive ? "bg-sage-50 ring-1 ring-sage-200" : "bg-paper ring-1 ring-line")
            }
          >
            <p className="font-medium">{summary}</p>
          </div>

          <Button type="submit" variant="primary" className="sm:w-full">
            {submitLabel}
            {positive && (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h11M11 6l4 4-4 4" />
              </svg>
            )}
          </Button>
        </form>
      </Card>

      <section aria-labelledby={`${ids}-other`} className="space-y-3">
        <h2 id={`${ids}-other`} className="text-sm font-semibold text-muted">
          Other options
        </h2>
        <Button variant="quiet" onClick={onDistribution} buttonRef={whereRef} className="sm:w-full">
          Where tips go
        </Button>
        <Button variant="quiet" onClick={() => onFinishWithoutTip(true)} className="sm:w-full">
          Leave feedback without tipping
        </Button>
        <Button variant="secondary" onClick={() => onFinishWithoutTip(false)} className="sm:w-full">
          Finish without tipping
        </Button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- distribution

function DistributionStep({
  receipt,
  tipCents,
  onBack,
}: {
  receipt: PublicReceipt;
  tipCents: number | null;
  onBack: () => void;
}) {
  const headingRef = useStepHeading();
  return (
    <div className="qt-step space-y-6">
      <StepHeading headingRef={headingRef} eyebrow={receipt.cafeName}>
        Where tips go
      </StepHeading>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sample policy (fictional)</p>
        <blockquote className="mt-2 border-l-4 border-sage-600 pl-4 text-lg leading-relaxed">
          {receipt.policyText}
        </blockquote>
      </Card>

      <DistributionPreview tipCents={tipCents} employeeCount={receipt.employeeCount} />

      <p className="text-sm text-muted">
        This is a sample policy written for this prototype. It is not a claim about how any real business handles
        tips.
      </p>

      <Button variant="primary" onClick={onBack} className="sm:w-full">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 10H5M9 6l-4 4 4 4" />
        </svg>
        Return to tip page
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- review

function ReviewStep({
  receipt,
  tipCents,
  onEdit,
  onCancel,
}: {
  receipt: PublicReceipt;
  tipCents: number;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const headingRef = useStepHeading();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const shares = splitCents(tipCents, receipt.employeeCount);
  const even = shares.every((s) => s === shares[0]);

  // If the customer comes back from Stripe with the browser's Back button, the page can be
  // restored from cache with the button still busy. Reset it so they can try again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function pay() {
    if (submitting) return; // prevents double submission
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tips/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: receipt.token, amountCents: tipCents }),
      });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (res.ok && body?.url) {
        window.location.assign(body.url);
        return; // keep the busy state while the browser navigates
      }
      setError(body?.error ?? "The payment page could not be opened. You were not charged. Please try again.");
    } catch {
      setError("The payment page could not be opened because the connection failed. You were not charged.");
    }
    setSubmitting(false);
  }

  return (
    <div className="qt-step space-y-6">
      <div className="space-y-2">
        <StepHeading headingRef={headingRef} eyebrow="Optional tip">
          Review tip
        </StepHeading>
        <p>Check the amount before continuing. Nothing has been charged yet.</p>
      </div>

      <Card>
        <dl className="divide-y divide-line">
          <div className="flex items-baseline justify-between gap-4 pb-4">
            <dt>
              <span className="block font-medium">Already paid</span>
              <span className="text-sm text-muted">Purchase {receipt.reference}</span>
            </dt>
            <dd className="font-semibold tabular-nums">{formatCents(receipt.totalCents)}</dd>
          </div>
          <div className="-mx-5 flex items-baseline justify-between gap-4 bg-sage-50 px-5 py-4 sm:-mx-6 sm:px-6">
            <dt>
              <span className="block font-semibold text-sage-800">Separate tip</span>
              <span className="text-sm text-muted">New payment, not added to your purchase</span>
            </dt>
            <dd className="text-xl font-semibold text-sage-800 tabular-nums">{formatCents(tipCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <dt className="font-medium">Total including tip</dt>
            <dd className="font-semibold tabular-nums">{formatCents(receipt.totalCents + tipCents)}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          Shared by the fictional pooling policy among {receipt.employeeCount} employees:{" "}
          {even
            ? `${formatCents(shares[0])} each.`
            : `${shares.map(formatCents).join(", ")} (divided as evenly as possible).`}
        </p>
      </Card>

      <Alert tone="info" title="Test mode payment">
        You will continue to Stripe&apos;s secure checkout page to pay only the {formatCents(tipCents)} tip. This
        prototype uses Stripe test mode: use test card <span className="whitespace-nowrap font-mono">4242 4242 4242 4242</span>. No real money is charged.
      </Alert>

      {error && (
        <Alert alertRef={errorRef} tone="error" role="alert" title="Payment not started">
          {error}
        </Alert>
      )}

      <div className="space-y-3">
        <Button variant="primary" onClick={pay} busy={submitting} busyLabel="Opening secure checkout…" className="sm:w-full">
          {error ? `Try again: pay ${formatCents(tipCents)} tip` : `Continue to pay ${formatCents(tipCents)} tip`}
        </Button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="quiet" onClick={onEdit} disabled={submitting} className="sm:w-full">
            Edit amount
          </Button>
          <Button variant="quiet" onClick={onCancel} disabled={submitting} className="sm:w-full">
            Cancel tip
          </Button>
        </div>
      </div>
    </div>
  );
}
