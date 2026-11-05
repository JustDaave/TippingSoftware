import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold " +
  "transition-colors duration-150 disabled:cursor-not-allowed sm:w-auto";

const variants: Record<Variant, string> = {
  primary: "bg-sage-700 text-white hover:bg-sage-800 disabled:bg-sage-600/60",
  secondary: "border border-sage-700 bg-surface text-sage-800 hover:bg-sage-50 disabled:opacity-60",
  quiet: "border border-line bg-surface text-ink hover:bg-sage-50 disabled:opacity-60",
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className)}
    >
      {busy && <Spinner />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

type Tone = "info" | "success" | "error" | "warning";

const tones: Record<Tone, string> = {
  info: "border-sage-100 bg-sage-50 text-ink",
  success: "border-sage-600 bg-sage-50 text-ink",
  error: "border-danger bg-danger-50 text-danger",
  warning: "border-warn-700/40 bg-warn-50 text-warn-700",
};

export function Alert({
  tone = "info",
  title,
  children,
  role,
  id,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  role?: "alert" | "status";
  id?: string;
}) {
  return (
    <div id={id} role={role} className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function DemoBanner() {
  return (
    <p role="note" className="no-print bg-sage-800 px-4 py-2 text-center text-sm text-white">
      Prototype with a fictional cafe. Payments use Stripe test mode. No real money is charged.
    </p>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <main id="main" className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        {children}
      </main>
    </>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>;
}
