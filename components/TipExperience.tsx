"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, ButtonRow, Card } from "./ui";
import { ReceiptSummary } from "./ReceiptSummary";
import { DistributionPreview } from "./DistributionPreview";
import { CompletionFlow } from "./CompletionFlow";
import {
  MIN_TIP_CENTS,
  formatCents,
  parseCustomAmount,
  selectedTipCents,
  type TipSelection,
} from "@/lib/money";
import type { PublicReceipt } from "@/lib/types";

type Step =
  | { name: "choose" }
  | { name: "distribution" }
  | { name: "review"; tipCents: number }
  | { name: "complete"; summary: string; focusFeedback?: boolean };

const OPTIONS: { value: Exclude<TipSelection, null>; label: string }[] = [
  { value: "none", label: "No tip" },
  { value: "100", label: "$1" },
  { value: "200", label: "$2" },
  { value: "300", label: "$3" },
  { value: "custom", label: "Custom" },
];

// The whole customer experience for ONE receipt. The page mounts it with key={token},
// so a different receipt never reuses this state.
export function TipExperience({ receipt, returnedFromCanceledPayment }: {
  receipt: PublicReceipt;
  returnedFromCanceledPayment: boolean;
}) {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [selection, setSelection] = useState<TipSelection>(null);
  const [customText, setCustomText] = useState("");

  if (step.name === "complete") {
    return (
      <CompletionFlow
        token={receipt.token}
        summary={<p>{step.summary}</p>}
        focusFeedback={step.focusFeedback}
      />
    );
  }

  if (step.name === "distribution") {
    return (
      <DistributionStep
        receipt={receipt}
        tipCents={selectedTipCents(selection, customText)}
        onBack={() => setStep({ name: "choose" })}
      />
    );
  }

  if (step.name === "review") {
    return (
      <ReviewStep
        receipt={receipt}
        tipCents={step.tipCents}
        onEdit={() => setStep({ name: "choose" })}
        onCancel={() =>
          setStep({ name: "complete", summary: "The tip was canceled. No tip was added. Your purchase is complete." })
        }
      />
    );
  }

  return (
    <ChooseStep
      receipt={receipt}
      selection={selection}
      customText={customText}
      onSelection={setSelection}
      onCustomText={setCustomText}
      notice={returnedFromCanceledPayment}
      onReview={(tipCents) => setStep({ name: "review", tipCents })}
      onDistribution={() => setStep({ name: "distribution" })}
      onFinishWithoutTip={(focusFeedback) =>
        setStep({ name: "complete", summary: "No tip was added. Your purchase is complete.", focusFeedback })
      }
    />
  );
}

function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);
  return ref;
}

// ---------------------------------------------------------------- choose

function ChooseStep({
  receipt,
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
  selection: TipSelection;
  customText: string;
  onSelection: (s: TipSelection) => void;
  onCustomText: (t: string) => void;
  notice: boolean;
  onReview: (tipCents: number) => void;
  onDistribution: () => void;
  onFinishWithoutTip: (focusFeedback: boolean) => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const [choiceError, setChoiceError] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const ids = useId();

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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selection === null) {
      setChoiceError(true);
      firstOptionRef.current?.focus();
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold sm:text-3xl">
          Optional tip
        </h1>
        <p className="text-lg">Your purchase is complete. Tipping is optional.</p>
      </div>

      <ReceiptSummary receipt={receipt} />

      {notice && (
        <Alert tone="info" role="status" title="Tip payment canceled">
          You were not charged for a tip. Your purchase is still complete. You can choose again or finish without
          tipping.
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <fieldset aria-describedby={choiceError ? `${ids}-choice-err` : undefined}>
          <legend className="mb-3 text-lg font-semibold">Tip amount</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {OPTIONS.map((opt, i) => (
              <label key={opt.value} className="relative block">
                <input
                  ref={i === 0 ? firstOptionRef : undefined}
                  type="radio"
                  name="tip"
                  value={opt.value}
                  checked={selection === opt.value}
                  onChange={() => {
                    onSelection(opt.value);
                    setChoiceError(false);
                    setCustomError(null);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={
                    "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-line bg-surface " +
                    "px-3 py-2 text-base font-semibold transition-colors hover:border-sage-600 " +
                    "peer-checked:border-sage-700 peer-checked:bg-sage-50 peer-checked:text-sage-800 " +
                    "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-600"
                  }
                >
                  {selection === opt.value && <span aria-hidden="true" className="mr-1">✓</span>}
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {selection === "custom" && (
          <div className="space-y-1">
            <label htmlFor={`${ids}-custom`} className="block font-medium">
              Custom tip amount (US dollars)
            </label>
            <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-sage-600 has-[[aria-invalid=true]]:border-danger">
              <span aria-hidden="true" className="pl-3 text-lg text-muted">
                $
              </span>
              <input
                ref={customRef}
                id={`${ids}-custom`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={customText}
                onChange={(e) => {
                  onCustomText(e.target.value);
                  setCustomError(null);
                }}
                aria-invalid={customError ? true : undefined}
                aria-describedby={`${ids}-hint${customError ? ` ${ids}-custom-err` : ""}`}
                className="min-h-12 w-full rounded-xl bg-transparent px-2 text-lg focus-visible:outline-none"
              />
            </div>
            <p id={`${ids}-hint`} className="text-sm text-muted">
              Enter at least {formatCents(MIN_TIP_CENTS)}, for example 2.50.
            </p>
            {customError && (
              <p id={`${ids}-custom-err`} role="alert" className="text-sm font-medium text-danger">
                {customError}
              </p>
            )}
          </div>
        )}

        {choiceError && (
          <p id={`${ids}-choice-err`} role="alert" className="font-medium text-danger">
            Choose an option to continue, or use “Finish without tipping.”
          </p>
        )}

        <p aria-live="polite" className="rounded-xl bg-sage-50 px-4 py-3">
          {summary}
        </p>

        <ButtonRow>
          <Button type="submit" variant="primary">
            {submitLabel}
          </Button>
        </ButtonRow>
      </form>

      <div className="space-y-3 border-t border-line pt-6">
        <ButtonRow>
          <Button variant="quiet" onClick={onDistribution}>
            Where tips go
          </Button>
          <Button variant="quiet" onClick={() => onFinishWithoutTip(true)}>
            Leave feedback without tipping
          </Button>
          <Button variant="secondary" onClick={() => onFinishWithoutTip(false)}>
            Finish without tipping
          </Button>
        </ButtonRow>
      </div>
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
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="space-y-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold sm:text-3xl">
        Where tips go
      </h1>
      <Card>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Sample policy (fictional)</p>
        <blockquote className="mt-2 border-l-4 border-sage-600 pl-4">{receipt.policyText}</blockquote>
      </Card>
      <DistributionPreview tipCents={tipCents} employeeCount={receipt.employeeCount} />
      <p className="text-muted">
        This is a sample policy written for this prototype. It is not a claim about how any real business handles
        tips.
      </p>
      <ButtonRow>
        <Button variant="primary" onClick={onBack}>
          Return to tip page
        </Button>
      </ButtonRow>
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
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold sm:text-3xl">
          Review tip
        </h1>
        <p>Check the amount before continuing. Nothing has been charged yet.</p>
      </div>

      <Card>
        <dl className="divide-y divide-line">
          <div className="flex items-baseline justify-between gap-4 pb-3">
            <dt>
              <span className="block font-medium">Already paid</span>
              <span className="text-sm text-muted">Purchase {receipt.reference}</span>
            </dt>
            <dd className="font-semibold">{formatCents(receipt.totalCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="block font-medium">Separate tip</span>
              <span className="text-sm text-muted">New payment, not added to your purchase</span>
            </dt>
            <dd className="text-lg font-semibold text-sage-800">{formatCents(tipCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="font-medium">Total including tip</dt>
            <dd className="font-semibold">{formatCents(receipt.totalCents + tipCents)}</dd>
          </div>
        </dl>
      </Card>

      <Alert tone="info" title="Test mode payment">
        You will continue to Stripe&apos;s secure checkout page to pay only the {formatCents(tipCents)} tip. This
        prototype uses Stripe test mode: use test card 4242 4242 4242 4242. No real money is charged.
      </Alert>

      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert tone="error" role="alert" title="Payment not started">
            {error}
          </Alert>
        </div>
      )}

      <ButtonRow>
        <Button variant="primary" onClick={pay} busy={submitting} busyLabel="Opening secure checkout…">
          Continue to pay {formatCents(tipCents)} tip
        </Button>
        <Button variant="quiet" onClick={onEdit} disabled={submitting}>
          Edit amount
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={submitting}>
          Cancel tip
        </Button>
      </ButtonRow>
    </div>
  );
}
