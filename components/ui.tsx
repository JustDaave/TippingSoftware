import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

// ---------------------------------------------------------------- buttons

type Variant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold " +
  "transition-[color,background-color,border-color,transform] duration-150 " +
  "motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 sm:w-auto";

const variants: Record<Variant, string> = {
  // Disabled primary keeps readable text (white on sage-600 is 5.6:1) instead of fading it out.
  primary: "bg-sage-700 text-white shadow-sm hover:bg-sage-800 disabled:bg-sage-600 disabled:shadow-none",
  secondary:
    "border-2 border-sage-700 bg-surface text-sage-800 hover:bg-sage-50 disabled:border-line-strong disabled:text-muted",
  quiet: "border border-line-strong bg-surface text-ink hover:border-sage-600 hover:bg-sage-50 disabled:text-muted",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  busy = false,
  busyLabel,
  className = "",
  children,
  buttonRef,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  busy?: boolean;
  busyLabel?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      {...props}
      ref={buttonRef}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className)}
    >
      {busy && <Spinner />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>;
}

// ---------------------------------------------------------------- loading

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

// Placeholder block for loading screens. Decorative only: pair it with a text status.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`qt-skeleton rounded-lg bg-line/70 ${className}`} />;
}

// ---------------------------------------------------------------- messages

type Tone = "info" | "success" | "error" | "warning";

const tones: Record<Tone, string> = {
  info: "border-sage-200 bg-sage-50 text-ink",
  success: "border-sage-600 bg-sage-50 text-ink",
  error: "border-danger bg-danger-50 text-ink",
  warning: "border-warn-700/40 bg-warn-50 text-ink",
};

const toneTitle: Record<Tone, string> = {
  info: "text-sage-800",
  success: "text-sage-800",
  error: "text-danger",
  warning: "text-warn-700",
};

function ToneIcon({ tone }: { tone: Tone }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 20 20",
    className: `mt-0.5 size-5 shrink-0 ${toneTitle[tone]}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (tone === "error" || tone === "warning") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4.5M10 13.5v.01" />
      </svg>
    );
  }
  if (tone === "success") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="m6.5 10.2 2.3 2.3 4.7-4.9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v4.5M10 6.5v.01" />
    </svg>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  role,
  id,
  alertRef,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  role?: "alert" | "status";
  id?: string;
  alertRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={alertRef}
      id={id}
      role={role}
      tabIndex={alertRef ? -1 : undefined}
      className={`flex gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
    >
      <ToneIcon tone={tone} />
      <div className="min-w-0">
        {title && <p className={`font-semibold ${toneTitle[tone]}`}>{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}

// Inline message under a form field. Referenced by the field's aria-describedby.
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.9 4h1.8v5.2H9.1V6Zm0 6.6h1.8v1.8H9.1v-1.8Z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

// Full-panel error with a recovery action, for pages that could not load.
export function ErrorPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="qt-step space-y-5">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      <Alert tone="error" role="alert">
        {children}
      </Alert>
      {action && <ButtonRow>{action}</ButtonRow>}
    </div>
  );
}

// ---------------------------------------------------------------- layout

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(31_42_39/0.04)] sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function StepHeading({
  children,
  headingRef,
  eyebrow,
}: {
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  eyebrow?: string;
}) {
  return (
    <div>
      {eyebrow && <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-sage-700">{eyebrow}</p>}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-[1.75rem] leading-tight font-semibold text-balance sm:text-4xl"
      >
        {children}
      </h1>
    </div>
  );
}

export function DemoBanner() {
  return (
    <p role="note" className="no-print bg-sage-800 px-4 py-2 text-center text-sm text-white">
      Prototype with a fictional cafe. Payments use Stripe test mode. No real money is charged.
    </p>
  );
}

function CafeMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-700 text-white"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 21V9" />
        <path d="M12 13c-3.5 0-5.5-2.2-5.5-5.5C10 7.5 12 9.7 12 13Z" />
        <path d="M12 10c3.5 0 5.5-2.2 5.5-5.5C14 4.5 12 6.7 12 10Z" />
        <path d="M12 17c3 0 4.8-1.9 4.8-4.8-3 0-4.8 1.9-4.8 4.8Z" />
      </svg>
    </span>
  );
}

// Cafe identity at the top of every customer page.
export function CafeHeader({ cafeName }: { cafeName: string }) {
  return (
    <header className="border-b border-line bg-surface/70">
      <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
        <CafeMark />
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight font-semibold">{cafeName}</p>
          <p className="text-xs text-muted">Fictional cafe · optional tipping</p>
        </div>
      </div>
    </header>
  );
}

export function PageShell({ children, cafeName }: { children: ReactNode; cafeName?: string }) {
  return (
    <>
      <DemoBanner />
      {cafeName && <CafeHeader cafeName={cafeName} />}
      <main id="main" className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        {children}
      </main>
    </>
  );
}
