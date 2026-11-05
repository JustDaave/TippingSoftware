# QuietTip – high-fidelity prototype

QuietTip is a private, optional way to tip **after** a purchase is already paid. The customer
scans the QR code on their printed receipt with their phone camera, and the browser opens the
tipping page for that receipt (`/r/<token>`). They can tip, finish without tipping, or leave
feedback on its own. There is no sign-in, role picker, or second checkout in front of it.

> **Everything is fictional except the payment API.** The cafe, receipts, purchases, and
> employee pooling policy are invented. Tips go through Stripe's real API **in test mode**, so
> no real money moves and no employee is paid. Seeded receipts stand in for already-paid
> purchases; there is no POS integration.

The low-fidelity Part I prototype is archived in [`archive/part1-lofi/`](archive/part1-lofi/).
Development history: [`docs/prompt-log.md`](docs/prompt-log.md) ·
feedback: [`docs/feedback-log.md`](docs/feedback-log.md).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Supabase Postgres · Stripe-hosted
Checkout (test mode) · Vercel · GitHub.

## Routes

| Route | Purpose |
|---|---|
| `/r/<token>` | Receipt-specific optional tipping page (what the QR code opens) |
| `/r/<token>/print` | Printable fictional receipt with a working QR code |
| `/r/<token>/tip-result` | Where Stripe returns the customer; shows the status saved in the database |
| `/demo/employee` | Aggregate-only, fictional employee transparency demo |
| `/` | Short project page for evaluators |
| `/dev/preview`, `/dev/preview/loading-state` | **Development only** (404 in production). Customer interface with a fictional receipt that is not in the database, for checking layout and keyboard use without credentials. Paying and saving feedback call the real API and fail honestly. |
| `POST /api/tips/checkout` | Creates a pending tip + Stripe Checkout Session |
| `POST /api/stripe/webhook` | Verified Stripe events mark tips paid / expired / failed |
| `POST /api/feedback` | Saves optional feedback |
| `GET /api/demo/employee-totals` | Aggregate fictional totals only |

## Setup

You need: Node.js 20+ (this machine has v26), a free Supabase account, a free Stripe account,
and (to deploy) Vercel and GitHub accounts.

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Go to <https://supabase.com/dashboard> → **New project**. Pick any name/region and save
   the database password in a password manager (not in this repo).
2. Create the tables. Either:
   - **Dashboard:** open **SQL Editor** → **New query**, paste all of
     `supabase/migrations/20261104000000_initial_schema.sql`, click **Run**. Then a new query
     with all of `supabase/migrations/20261104010000_harden_access.sql`, **Run**. Run them in
     that order, each once. (If you already ran the first one earlier, run only the second.)
   - **or CLI** (not tested in this repo): `npx supabase login`, then
     `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push`.
3. Load the fictional seed data: a new SQL Editor query with all of `supabase/seed.sql`,
   **Run** (safe to run again; it skips rows that exist). With the CLI:
   `npx supabase db push --include-seed`.
4. Check that **Integrations → Data API** is enabled (the server talks to the database
   through it). "Automatically expose new tables" can stay off: the migrations grant the
   server role what it needs and give public roles nothing.
5. **Project Settings → Data API** (or **Connect**): copy the **Project URL** into
   `SUPABASE_URL`.
6. **Project Settings → API Keys**: copy a **secret** key (`sb_secret_…`) into
   `SUPABASE_SECRET_KEY`. (The legacy `service_role` key also works.) Never put it in a
   `NEXT_PUBLIC_` variable, a screenshot, a commit, or a chat.
   Optionally copy the **publishable** key (`sb_publishable_…`) into
   `SUPABASE_PUBLISHABLE_KEY`. The app never uses it; only the verification script does.
7. Verify the project:
   ```bash
   npm run verify:supabase              # read-only: public key blocked, seed present
   npm run verify:supabase -- --write   # also a write/read round trip, then cleanup
   ```
   With `npm run dev` running in another terminal, add `--app http://localhost:3000` to
   also check receipt pages, the demo endpoint, validation, refresh, and rate limiting.
   (The `--write --app` run trips the feedback rate limit for your computer for 10 minutes.)
8. Print your private receipt links (tokens are random per project):
   ```bash
   npm run receipts:links
   ```

### 3. Stripe (test mode)

1. Go to <https://dashboard.stripe.com>, and make sure **Test mode** (or a **Sandbox**) is on.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
   The app refuses any key that is not a test key.
3. Webhook for local development, using the Stripe CLI
   (<https://docs.stripe.com/stripe-cli>):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the `whsec_…` value it prints into `STRIPE_WEBHOOK_SECRET`, and leave it running.
   (If the webhook is missing, the return page still asks Stripe directly for the session's
   status, so a paid tip is confirmed either way. Expired sessions need the webhook.)

### 4. Run locally

```bash
npm run dev
```

Without credentials you can still look at the customer interface at
<http://localhost:3000/dev/preview> (nothing can be paid or saved there).

Open a link from `npm run receipts:links`. Pay with test card `4242 4242 4242 4242`, any
future expiry date, any CVC, and any postal code.

To scan from a phone on the same Wi-Fi, set `NEXT_PUBLIC_SITE_URL` to your computer's
network address (for example `http://192.168.1.20:3000`), restart, and open
`/r/<token>/print`. A `localhost` QR code cannot be opened from a phone.

### 5. Deploy to Vercel

1. Push this repository to GitHub.
2. On <https://vercel.com/new>, import the repository (framework: Next.js, defaults are fine).
3. Under **Settings → Environment Variables**, add every variable from `.env.example`.
   Set `NEXT_PUBLIC_SITE_URL` to the production URL (for example
   `https://quiettip.vercel.app`) and use a new random `RATE_LIMIT_SALT`.
4. In Stripe (test mode) → **Developers → Webhooks** → **Add endpoint**:
   - URL: `https://<your-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copy its signing secret into Vercel's `STRIPE_WEBHOOK_SECRET` (it differs from the CLI one).
5. Redeploy so the new variables take effect, then run `npm run receipts:links` with
   `NEXT_PUBLIC_SITE_URL` set to the production URL and print a receipt.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (cent math, amount parsing) and offline database tests |
| `npm run test:db` | Only the database tests: migrations + seed in PGlite, with Supabase's roles |
| `npm run verify:supabase` | Checks your real Supabase project (see Setup step 2.7) |
| `npm run typecheck` | TypeScript check |
| `npm run receipts:links` | Prints private receipt links (treat them like secrets) |

## Privacy and security notes

- Receipt links are bearer links: anyone with the link can see that one receipt's limited
  details (cafe, reference, date, items, amounts) and tip. No customer names or card details
  are stored.
- A receipt link also shows whether that receipt already has a confirmed tip (and its total)
  and whether feedback was saved, so a refresh doesn't lose them. It never shows feedback
  text, other receipts, or individual payment records.
- The browser never talks to Supabase. All reads and writes go through server code with the
  secret key. RLS is on for every table with no policies, and table privileges are revoked
  from `anon` and `authenticated`, so the publishable key can read or change nothing.
- A confirmed tip cannot be changed back or edited, even by the server (database trigger).
- "No tip" and "Finish without tipping" save nothing, so the customer can still tip later.
- Public write endpoints validate input and are rate-limited per hashed IP address.
- Pages send `Referrer-Policy: no-referrer` so receipt tokens are not leaked to other sites.
