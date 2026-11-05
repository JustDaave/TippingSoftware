# QuietTip prompt log

This log records the prompts used to build QuietTip, what each one changed, what was
actually checked, and what is still unresolved. It never records invented feedback or test
results. If something was not checked, it says so.

- **Part I** – low-fidelity prototype (HTML/CSS/vanilla JS). Archived in
  [`archive/part1-lofi/`](../archive/part1-lofi/). The original log is preserved verbatim at
  the end of this file and in `archive/part1-lofi/feedbackandpromptslog.txt`.
- **Part II** – high-fidelity functional prototype (Next.js, Supabase, Stripe test mode).
  Entries below, newest last.

---

## Part II – High-fidelity prototype

### HF-1 · 2026-11-04 · Architecture and first build

**Prompt (summary; full text is entry "11/04/26 → 1." in the archived log):**
Upgrade the lo-fi prototype to a high-fidelity functional prototype. Archive the old files.
Customer journey starts from a printed receipt QR code that opens a receipt-specific tipping
page; no role selection, sign-up, or second checkout before it. Use Next.js App Router +
TypeScript, Tailwind, Supabase Postgres, Stripe-hosted Checkout (test mode), Vercel, GitHub.
Carry forward clear labels, optional feedback, distribution previews, and exact cent rounding.
Create `docs/prompt-log.md` and `docs/feedback-log.md`. Do not fake missing integrations.

**Note on prompts drafted ahead of time:** the original log already contained the text of
high-fidelity prompts "2." (customer interface) and "3." (Supabase backend) under 11/04/26.
At the time of HF-1 they had **not yet been run** as separate prompts. Some of their
requirements were built early as part of HF-1's architecture (listed below); they still need
their own pass and validation when run.

**Changes**
- Moved `index.html`, `styles.css`, `script.js`, `README.txt` to `archive/part1-lofi/` with
  `git mv` (history kept), and copied `feedbackandpromptslog.txt` there.
- Installed Node.js LTS (v26.13.0) on the development machine with winget; it was not installed.
- New Next.js 16 (App Router, TypeScript, Tailwind CSS v4) project, set up by hand.
- `lib/money.ts`: integer-cent helpers carried over from the lo-fi script: `splitCents`
  (leftover cents to Employee 1, 2, … in order), `parseCustomAmount` (now parses digits
  directly instead of `parseFloat * 100`, which avoids float errors such as 1.13 → 112.99…),
  `selectedTipCents`, `formatCents`.
  - New rule: custom tips must be **at least $0.50** (Stripe's minimum USD charge) and at most
    $100 (prototype cap to catch typos). The validation message explains why.
- `supabase/migrations/20261104000000_initial_schema.sql`: `cafes`, `receipts` (random
  192-bit base64url `access_token`), `tip_attempts` (pending / paid / expired / failed, one
  per Stripe Checkout Session), `feedback`, `rate_limits` + `consume_rate_limit()`, and the
  aggregate view `employee_demo_totals`. RLS enabled on every table with no policies, and all
  privileges revoked from `anon`/`authenticated`. Money columns are integer cents.
- `supabase/seed.sql`: fictional "Juniper Lane Cafe", four-employee pooling policy, $40.00
  starting sample pool, three already-paid receipts (JL-1042 is the $20.00 order from Part I).
- Routes:
  - `/r/[token]` – receipt-specific tipping page, opened directly from the QR code.
    Steps: choose → (where tips go) → review → Stripe Checkout; or finish without tipping;
    or leave feedback without tipping.
  - `/r/[token]/tip-result` – Stripe return page. Shows status from the database only
    (webhook-updated, or confirmed by asking Stripe for the session). "Pending" is shown as
    pending, never as success.
  - `/r/[token]/print` – printable receipt with a working QR code to `/r/[token]`.
  - `/demo/employee` – aggregate-only, clearly fictional employee transparency demo.
  - `/` – short project page for evaluators (customers never pass through it).
  - API: `POST /api/tips/checkout`, `POST /api/stripe/webhook`, `POST /api/feedback`,
    `GET /api/demo/employee-totals`.
- Server code uses the Supabase secret key only on the server (`import "server-only"`).
  The app refuses Stripe keys that are not test keys and refuses live-mode sessions.
- Missing credentials produce a "Demo not connected" page or a 503 with
  "Nothing was saved or charged." No fake success states.
- Carried forward from Part I: nothing preselected; equal-size options (No tip, $1, $2, $3,
  Custom); dynamic submit label ("Choose an option to continue" / "Review tip" /
  "Finish without tipping"); selection summary ("Selected tip: $X.XX. Nothing has been
  submitted."); "Where tips go" with preview or labeled $2 example and the one-cent rounding
  note; selection kept when returning; review with "Already paid / Separate tip / Total
  including tip", "Edit amount", "Cancel tip"; neutral completion; "Finish without feedback";
  feedback confirmation only after the server saves it, with typed text kept on failure;
  "All done. You can close this page."; employee demo separates starting pool from confirmed
  test tips and uses "Shares divided as evenly as possible" when shares differ.
- Security headers: `Referrer-Policy: no-referrer` (so the receipt token is not leaked to
  Stripe or other sites via the Referer header), `X-Frame-Options: DENY`, `nosniff`.
- `.env.example`, `README.md` with setup steps, `scripts/receipt-links.mjs`
  (`npm run receipts:links`) to print the private receipt links.

**Validation actually performed (2026-11-04, on the development machine)**
- `npx vitest run`: 24 unit tests passed (cent splitting for 0–2000¢ always sums exactly and
  differs by ≤1¢; $2.00 → 4 × $0.50; $1.01 → $0.26/$0.25/$0.25/$0.25; custom-amount parsing
  including empty, negative, non-numeric, 3 decimals, below $0.50, above $100, and float cases).
- `npx tsc --noEmit`: no type errors.
- `npx next build`: production build succeeded.
- Ran `next start` **without any credentials** and checked with `curl`:
  - `/` returns 200.
  - `/r/<well-formed token>`, `/r/<token>/print`, `/demo/employee` show "Demo not connected".
  - `POST /api/tips/checkout` rejects 20¢ and 2.5¢ amounts (400) and returns 503
    "…not fully connected yet. Nothing was saved or charged." for a valid amount.
  - `POST /api/feedback` rejects blank feedback (400) and returns 503 for valid feedback.
  - `POST /api/stripe/webhook` rejects a missing signature (400).
  - Security headers present on `/`.

**Not yet checked (needs your Supabase and Stripe test accounts, or a browser/phone)**
- Any page or flow with real data: receipt lookup, tipping steps in a browser, Stripe Checkout,
  webhook confirmation, saving feedback, employee totals, rate limiting, RLS from the anon key.
- Visual layout at 360px and desktop, keyboard navigation, screen reader output.
- Scanning the printed QR code with a phone camera.
- Vercel deployment.

**Unresolved issues / follow-ups**
- An invalid receipt link (`/r/nope`) shows "Receipt link not found" but with HTTP status 200,
  because the route's loading screen starts streaming first. Content is correct; status is not.
- A tip attempt left in "pending" (customer closed Stripe without paying) stays pending until
  Stripe's session expires (24h) and the `checkout.session.expired` webhook arrives. Pending
  rows are never counted in totals.
- Rate limiting depends on `x-forwarded-for`, which Vercel sets; locally all requests share one key.
- The QR code uses `NEXT_PUBLIC_SITE_URL`; a `localhost` URL cannot be scanned from a phone.
  The print page warns about this.
- Prompts "2." and "3." from the original log still need to be run and validated.

### HF-2 · 2026-11-04 · High-fidelity customer interface

**Status:** run on 2026-11-04. This is prompt "2." from the original log.

**Prompt (full text):**

```text
Implement QuietTip's high-fidelity customer interface using the architecture already established.

Visual direction:
- Calm, professional cafe branding.
- Warm off-white background, dark readable text, restrained sage or teal accents.
- Consistent typography, spacing, borders, and subtle interaction feedback.
- Mobile-first layout, comfortably usable at 360px width and on desktop.
- Accessible contrast, visible keyboard focus, labeled controls, and touch targets approximately 44px or larger.
- Respect reduced-motion settings.

The receipt-specific tipping page must show:
- Cafe name.
- Receipt reference, purchase date, and original paid amount.
- "Your purchase is complete. Tipping is optional."
- Equal-size and equal-style options: No tip, $1, $2, $3, Custom.
- Nothing selected initially.
- A labeled custom dollar input.
- "Where tips go."
- "Leave feedback without tipping."
- A clearly visible "Finish without tipping."

Preserve these interaction rules:
- Selecting an amount never submits a payment.
- Positive selections lead to "Review tip."
- No tip leads to finishing without payment.
- Show a clear selection summary.
- The review screen distinguishes "Already paid," "Separate tip," and "Total including tip."
- Allow editing and canceling before payment.
- Keep completion language neutral for tipping and skipping.
- Feedback remains optional, with a clear "Finish without feedback."
- Final screen: "All done. You can close this page."

Show the fictional four-employee pooling policy and a preview of the selected tip's distribution. Use integer cents and distribute leftover cents consistently so shares add up exactly. Preserve the selection when returning.

Build real loading, validation, disabled/submitting, and error-state components. Do not claim data was saved or payment succeeded until the backend confirms it.

Check mobile and desktop layouts and keyboard navigation. Update the prompt log with what changed and what was actually checked.
```

**Changes**
- Design system (`app/globals.css`, `components/ui.tsx`):
  - Warmer off-white background (`#f8f5ef`), sage accents, a serif display face for the cafe
    name and headings, and a body font based on the system font.
  - Control borders darkened to `#8f8577` so they reach 3:1 against white. The earlier value
    measured 2.1:1.
  - Global base styles moved into `@layer base`. Without that, the global focus ring
    overrode component styles. Bug found during the browser check: the ring covered the "$"
    in the custom field and hid its red error border.
  - New shared parts: cafe header with a leaf mark (`CafeHeader`), `StepHeading`,
    `Skeleton`, `FieldError`, and `ErrorPanel`. Alerts now have icons. Buttons and tip
    options shrink slightly when pressed, only when the user has not asked for reduced
    motion. Steps fade in, and that is also turned off for reduced motion.
- Tipping page (`components/TipExperience.tsx`):
  - The heading is now "Your purchase is complete. Tipping is optional."
  - Receipt card shows cafe, reference, purchase date, amount paid, and a "Paid" badge.
  - The five options are equal in size and style: stacked under 480px wide, in one row at
    480px and up. A selected option shows a check badge, which doesn't change its size.
  - Added the help text "Choosing an amount does not charge you."
  - "Where tips go", "Leave feedback without tipping", and "Finish without tipping" are
    full-width buttons under "Other options".
  - Focus management:
    - First load: no focus jump.
    - Clicking "Custom" with a mouse or touch focuses the amount field. Arrow keys keep
      focus in the radio group.
    - Returning from "Where tips go" focuses that button again.
    - "Edit amount" focuses the selected option, or the custom field.
  - Review screen: the "Separate tip" row is highlighted, and a per-employee split line is
    added (for example "$0.50 each", or the uneven shares listed). After an error, the
    button reads "Try again: pay $X tip".
- Selection kept after canceling on Stripe:
  - The cancel link now includes the reviewed amount (`?tip=canceled&amount=…`), and the
    page restores that choice.
  - The amount is checked again in the browser (`selectionFromCents`, plus 3 new unit
    tests) and is never used to charge.
  - A first visit, or `amount` without `tip=canceled`, still starts with nothing selected.
- Completion and feedback (`components/CompletionFlow.tsx`):
  - Same neutral wording.
  - A "Feedback not saved" error now takes focus and says the typed text is kept.
  - The character counter warns near the limit.
  - "All done." screen restyled.
  - "Your feedback was saved" still only appears after a 201 from the server.
- Loading and error states:
  - Receipt loading screen uses skeletons that match the page layout, with a text status.
  - New loading screen for the Stripe return page.
  - Stripe return page shows the cafe header. "Check tip status again" now refreshes in
    place with a busy state, and the pending and error wording now says "Do not pay again".
  - Restyled error, not-found, and "Demo not connected" pages.
- `/dev/preview` and `/dev/preview/loading-state` added:
  - Development only: return 404 in a production build.
  - The fictional receipt they use is not in any database, so paying and saving feedback
    hit the real API and get its real error.
- README: routes table and how to open the preview.

**Validation actually performed (2026-11-04, on the development machine)**
- `npx tsc --noEmit`: no errors.
- `npx vitest run`: 27 tests passed (24 earlier + 3 for restoring a selection).
- `npx next build`: succeeded.
- Production server without credentials (`next start`, checked with `curl`):
  - `/dev/preview` and `/dev/preview/loading-state` return 404.
  - `/r/<token>` shows "Demo not connected".
  - `POST /api/tips/checkout` returns 503 "…Nothing was saved or charged."
- Browser checks: headless Chrome 156 driven by a Playwright script against `next dev` at
  `/dev/preview`, at 360×780 and 1280×900. The script lives outside the repo, in a temporary
  folder. Final run: **134/134 checks passed**.
  - First run: 132/134. The 2 failures were a mistake in the script itself: it expected a
    selected option to look identical to the others. The sizes were equal. The check now
    compares sizes only.
  - The first run's screenshots showed the focus-ring and wrapping problems listed under
    Changes. They were fixed before the final run.
  - Content: cafe name, JL-1042, purchase date, $20.00, the required sentence, and all three
    exits are present.
  - Initial state:
    - Nothing selected.
    - All five options measured equal size (286×48 on mobile, 92×48 on desktop) with
      identical colors, border, and font.
    - All five options stay equal in size after one is selected.
  - Layout:
    - No horizontal scrolling at 360px or desktop on the choose, where-tips-go, review,
      completion, and loading screens.
    - Every visible control is at least 44px tall and wide on the choose and review
      screens.
  - Interaction:
    - Selecting $2 sent no network request.
    - Labels and summaries are right for no selection, No tip, $2, and $1.01.
    - Empty submit shows a message and focuses "No tip".
    - $0.20 and "abc" are rejected inline, with `aria-invalid`.
    - Where tips go shows $1.01 as $0.26/$0.25/$0.25/$0.25 with the rounding note.
      Returning keeps "Custom 1.01" and puts focus back on "Where tips go".
    - Review shows Already paid $20.00, Separate tip, Total including tip $22.00, and
      $0.50 each.
    - "Edit amount" keeps the amount.
  - Submitting and error states (API responses delayed by about 1 second to observe them):
    - While paying, the pay button is busy and disabled, and "Edit amount" and
      "Cancel tip" are disabled.
    - The real 503 then shows "Payment not started … Nothing was saved or charged." The
      alert takes focus and the page stays on review.
    - Feedback: blank submit is rejected. While saving, the button shows "Saving…" and the
      fields are disabled. The real 503 shows "Feedback not saved", the typed text is kept,
      and no "saved" message appears.
  - Completion:
    - Cancel tip leads to a neutral "Visit complete".
    - "Finish without feedback" leads to "All done. You can close this page."
    - "Leave feedback without tipping" focuses the first feedback field.
  - Returning from Stripe's cancel page:
    - `?tip=canceled&amount=250` restores Custom $2.50.
    - `amount=300` restores $3.
    - `amount` without `tip=canceled` restores nothing.
  - Keyboard only:
    - Tab order: skip link, tip options, submit, Where tips go, Leave feedback without
      tipping, Finish without tipping.
    - The focused option shows a 3px sage ring.
    - Tabbing into the options selects nothing. Space and arrow keys select.
    - Arrowing onto Custom keeps focus in the group, and Tab reaches the amount field.
    - Enter goes to review. Review focuses its heading, and the next Tab is the pay
      button.
    - Edit amount, Finish without tipping, and Finish without feedback all work by
      keyboard.
  - Reduced motion: with `prefers-reduced-motion: reduce`, step animations and button
    transitions compute to 0.01ms.
- Contrast: calculated with a script from the color values, not measured in a browser. All
  15 pairs pass. Text is at least 5.8:1; the focus ring and control borders are at least
  3.3:1.
- I looked at screenshots of every step at both sizes.

**Not checked**
- Real screen readers (NVDA, VoiceOver, TalkBack). Only the ARIA structure was checked by
  script.
- Real phones, Safari/WebKit, and Firefox. Only Chrome's desktop engine at phone width was
  used.
- Anything that needs Supabase or Stripe: a real receipt link, Stripe Checkout, the cancel
  return with a real session, the confirmed-tip completion, a successful feedback save, and
  the pending and paid screens on the Stripe return page. Those pages compile and use the
  same components, but were not seen in a browser.
- 200% browser zoom and Windows high-contrast mode.

**Unresolved issues / follow-ups**
- `next dev` writes an `AGENTS.md` file into the project root (a Next.js 16 feature). It is
  not part of the app. Keep it, delete it, or turn it off with `agentRules: false` in
  `next.config.ts`.
- Issues from HF-1 still apply, including the HTTP 200 status for unknown receipt links.

---

### HF-3 · 2026-11-04 · Real Supabase backend

**Status:** run on 2026-11-04.

**Prompt (full text):**

```text
Implement the real Supabase backend for QuietTip.

Read the current official documentation before implementing:
https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
https://supabase.com/docs/guides/database/postgres/row-level-security

Create versioned SQL migrations and clearly labeled fictional seed data for:
- Cafe and its sample pooling policy.
- Receipts representing completed purchases.
- Tip payment attempts and confirmed statuses.
- Optional written feedback.
- Aggregate employee demonstration totals.

Requirements:
- Each receipt has a cryptographically random, unguessable access token.
- /r/[token] resolves the specific receipt and opens its tipping experience directly.
- Treat the receipt URL as a bearer link: anyone holding it can view its limited receipt information.
- Do not expose customer names, payment details, or unrelated receipts.
- Use server-side validation and minimal response fields.
- Enable RLS and prevent anonymous users from listing receipts, reading feedback, changing payment status, or editing aggregate totals.
- Keep privileged database keys server-side.
- Validate and rate-limit public write endpoints.
- Store money in integer cents.
- Save optional feedback to Supabase and show confirmation only after a successful write.
- Preserve typed feedback after a failed submission so it can be retried.
- Keep feedback independent of whether the customer tips.
- Refreshing must not erase confirmed tips or saved feedback.
- Starting a new receipt must not reuse another receipt's UI state.

No tip or "Finish without tipping" must never create a payment attempt or permanently prevent a later voluntary tip.

Create a public, clearly labeled employee transparency DEMO that reads only aggregate fictional totals through a restricted server endpoint. Show the starting sample pool separately from confirmed test tips. Do not expose individual receipts, tip transactions, feedback, or employee identities.

Provide .env.example with placeholders and exact Supabase setup instructions. Never put actual secrets in documentation, logs, or Git.

Verify persistence and access restrictions. Report any checks that require my connected Supabase project.
```

**What already existed (from HF-1) and was kept**
- Initial migration:
  - Tables for the cafe, receipts, tip attempts, feedback, and rate limits.
  - 192-bit random receipt tokens generated with `pgcrypto`.
  - Money in integer cents, with check constraints.
  - RLS on every table with no policies, and privileges revoked from `anon` and
    `authenticated`.
  - The aggregate `employee_demo_totals` view, with the starting pool kept apart from
    confirmed test tips.
- Fictional seed data.
- The server-only secret-key client.
- Validated, rate-limited `POST /api/feedback` and `POST /api/tips/checkout`.
- The aggregate-only demo endpoint and page.
- `key={token}`, so each receipt gets fresh UI state.

**Changes**
- Read both Supabase pages first. New migration
  `supabase/migrations/20261104010000_harden_access.sql`, based on them:
  - Explicit grants to `service_role`. The docs say some projects don't grant new tables
    automatically, and then the server could not read its own tables.
  - `consume_rate_limit` is no longer `SECURITY DEFINER`. The docs warn against those in an
    exposed schema, and only the server role can call it anyway. It now rejects bad
    arguments and occasionally deletes stale buckets.
  - A trigger makes a confirmed (paid) tip final. A tip's receipt, amount, and Stripe
    session can't change once set.
  - Default privileges are revoked, so tables and functions added to `public` later are not
    open to `anon` or `authenticated`.
  - A partial index for the per-receipt "already tipped?" lookup.
- Refresh no longer loses saved state:
  - `/r/[token]` loads `getReceiptState`: the receipt's confirmed tip total and whether
    feedback exists. It never loads feedback text.
  - A receipt with a confirmed tip reopens on "Visit complete" with that tip.
  - Saved feedback shows as saved on the receipt page and on the Stripe return page.
  - Focus does not jump when a page loads already saved.
  - "No tip" and "Finish without tipping" still save nothing. A refresh returns to fresh tip
    choices, so a later tip is still possible.
- `/dev/preview?saved=tip,feedback` (development only) shows those saved states without
  credentials.
- Verification tools:
  - `supabase/tests/schema.test.ts` (`npm run test:db`) runs both migrations and the seed in
    PGlite. It first recreates Supabase's roles and its default "grant all to anon"
    privileges. If the tests pass, the migrations really do remove that access. New dev
    dependency: `@electric-sql/pglite`.
  - `scripts/verify-supabase.mjs` (`npm run verify:supabase`) checks the real project.
    Optional flags: `--write` and `--app <url>`.
- `.env.example`:
  - Optional `SUPABASE_PUBLISHABLE_KEY`, used only by the verification script.
  - Comments say the keys are server-only.
- README:
  - Step-by-step Supabase setup: run both migrations in order, seed, check Data API, copy
    keys, verify.
  - The new scripts.
  - Privacy notes, including what a receipt link now reveals: its confirmed tip total and
    whether feedback exists.

**Validation actually performed (2026-11-04, on the development machine, no Supabase project)**
- `npx tsc --noEmit`: no errors.
- `npx next build`: succeeded.
- `npx vitest run`: 43 passed. That is the 27 existing tests plus 16 new database tests.
  The database tests ran in PGlite (Postgres 17 in WebAssembly), not Supabase.
  - `anon` and `authenticated` get "permission denied" when they try to:
    - read all five tables or the totals view;
    - insert feedback or receipts;
    - set a tip to paid;
    - change the starting pool;
    - delete receipts;
    - call either function.
  - RLS is on for every table with zero policies. Even with `select` deliberately granted
    to `anon`, it gets 0 rows.
  - A table created after the migrations is not readable by `anon`.
  - Seed data:
    - One fictional cafe with a $40.00 starting pool.
    - Three fictional receipts with unique 32-character tokens.
    - Running the seed again adds no duplicates.
    - A total that doesn't add up is rejected, and so is a non-fictional row.
  - Tips:
    - Only paid tips count in the totals view: $2.00 paid plus $3.00 pending shows
      $2.00.
    - A paid tip cannot be set to failed, and a tip's amount cannot be edited.
    - Amounts of 0, 49, 10001, and 1.5 cents are rejected.
  - Feedback:
    - Saves on a receipt with no tip.
    - Blank feedback is rejected.
  - The rate limit allows 2 calls, then refuses the 3rd.
- The first PGlite run had 1 failure, caused by a bug in the test helper, not the schema.
  Inside an aborted transaction, the helper's cleanup threw and hid the real "permission
  denied" error. I fixed the helper, not the assertion.
- Browser: headless Chrome, driven by `playwright-core` against `next dev` at
  `/dev/preview`, at 360×780. The script was in a temporary folder outside the repo.
  **14/14 checks passed.**
  - Confirmed tip: the page reopens on "Visit complete", still offers feedback, and shows no
    tip form.
  - Confirmed tip plus saved feedback: the saved confirmation shows with no form, and focus
    stays on the heading.
  - Saved feedback with no tip: the tip choices are still shown.
  - Canceling after a confirmed tip shows both notices.
  - No tip, then finish:
    - zero API POSTs;
    - a refresh shows fresh, unselected choices.
  - Failed feedback save (503, not connected):
    - the typed text is kept;
    - no false "saved" message;
    - no tip request was sent.
  - Screenshots checked.
- Production server without credentials (`next start` + `curl`):
  - The receipt page shows "not connected".
  - Feedback returns 503 "Nothing was saved".
  - Blank feedback and a 12.5-cent tip return 400.
  - The demo endpoint returns 503.
  - `/dev/preview` returns 404.
- The built client JavaScript (`.next/static`) contains no Supabase env names, table
  names, or `service_role`.

**Not checked (needs the connected Supabase project)**
- That the migrations and seed run in Supabase's SQL Editor. PGlite is close to Supabase's
  Postgres but is not Supabase.
- That the real publishable key is blocked through the Data API (PostgREST), and that the
  secret key works. Run `npm run verify:supabase`.
- A write and read-back, and the confirmed-tip trigger, on the real database. Run
  `npm run verify:supabase -- --write`.
- End to end through the app. Run
  `npm run verify:supabase -- --write --app http://localhost:3000` with `npm run dev`
  running. It checks that:
  - a real receipt link opens only its own receipt;
  - feedback returns 201 and is still saved after a reload;
  - the rate limit returns 429;
  - the demo endpoint returns aggregate fields only;
  - an unknown token shows the not-found page.
- A paid Stripe test tip showing on refresh and in the demo totals. This also needs Stripe
  test keys.
- The CLI setup route (`supabase link` / `db push`). The SQL Editor route is the main
  instruction.

**Unresolved issues / follow-ups**
- The demo page calls the same server-only function as `GET /api/demo/employee-totals`
  instead of fetching that endpoint over HTTP. Both return only the four aggregate figures.
- The rate limit is keyed by a hashed IP address, so people on a shared network share one
  limit.
- Issues from HF-1 and HF-2 still apply, including HTTP 200 for unknown receipt links. The
  page content is still "not found".

---

## Part I – Low-fidelity prototype (original log, verbatim)

The text below is copied unchanged from `feedbackandpromptslog.txt` (lines 1–194, everything
before the 11/04/26 high-fidelity entries).

```text
Build prompt: Build a functional, low-fidelity front-end prototype for my HCI class assignment.

PROJECT: QuietTip
A private, optional digital tip jar that customers access from a receipt after checkout. The design should balance customer comfort with transparent employee tipping.

TECHNICAL REQUIREMENTS
- Use only HTML, CSS, and vanilla JavaScript.
- Create index.html, styles.css, and script.js.
- It must work by opening index.html directly in a browser.
- Use grayscale, generic Arial/system fonts, simple borders, and clearly labeled placeholder images.
- No polished branding, colorful elements, animations, or decorative imagery.
- Make the layout usable on desktop and narrow phone screens.
- Front end only: no backend, database, API, login, authentication, analytics, or external services.
- Store temporary state only in JavaScript memory. Do not use localStorage, sessionStorage, IndexedDB, or cookies.
- Refreshing must reset all selections, feedback, and simulated transactions.
- Use one HTML file with JavaScript-controlled screens so refresh reliably returns to the beginning.
- Every visible button must work or be explicitly labeled as a placeholder.
- Use accessible labels, keyboard controls, visible focus states, and clear validation messages.
- Do not request real payment or personal information.

CONCEPT
The customer has already paid for a $20 order at a fictional counter-service café. Tipping is separate from checkout. No tip is selected by default. Choosing not to tip must be as easy and visually neutral as choosing to tip.

BUILD THESE SCREENS

1. Prototype start
- Explain briefly that this is a demonstration with no real payments.
- Buttons: "Customer experience" and "Employee transparency demo."
- These are prototype navigation choices, not login roles.

2. Completed purchase and receipt
- Heading: "Purchase complete."
- Show a sample café receipt with an order total of $20.
- Include a grayscale square labeled "QR code placeholder — not scannable."
- Beside it, provide a working button: "Open optional tip page."
- Explain: "In a real product, scanning the receipt would open this page on your phone."
- Include a working "Finish" button.
- Opening the tipping page must never be required to finish.

3. Optional tip page
- Show the café name and purchase amount.
- Explain: "Tipping is optional. Your purchase is already complete."
- Show equal-size, equal-style options: "No tip," "$1," "$2," "$3," and "Custom."
- Start with nothing selected.
- Custom reveals a labeled dollar-amount field.
- Do not use default percentages, emotional messages, rankings, tip counts, or suggested social norms.
- Include "Where tips go," "Leave feedback without tipping," and "Finish without tipping."
- Selecting an amount does not submit a tip. Continue to a review screen.
- Reject empty, negative, and nonnumeric custom amounts with an inline explanation.

4. Tip distribution
- Show this explicitly fictional policy:
  "All tips go to the employee pool. For this demonstration, pooled tips are divided equally among four employees who worked this shift. The business keeps none."
- Show a simple grayscale diagram or four equal boxes.
- Explain that this is a sample policy, not a claim about real businesses.
- Provide a working return button that preserves the customer's current selection.

5. Review tip
- Show purchase amount, chosen tip, and combined total, with the tip clearly identified as a separate simulated payment.
- Buttons: "Edit amount," "Confirm simulated tip," and "Cancel tip."
- State: "Demo only. No money will be charged."
- Do not collect card details or imitate a real Apple Pay/Venmo integration.
- Prevent repeated confirmation from counting the same tip twice.

6. Completion
- Use neutral language whether the customer tipped or skipped.
- Offer optional written feedback independently of tipping.
- Label it: "Do not include personal information. Demo feedback is kept only until refresh."
- Feedback fields must accept text and show a simulated submission confirmation.
- Include "Return to prototype start."

7. Employee transparency demo
- No login.
- Clearly label all figures as fictional demonstration data.
- Initially show $40 in pooled tips, four employees, and $10 per employee.
- Add confirmed simulated tips to that pool and update equal shares.
- Show aggregate totals only. Do not display customer names, order IDs, individual tip amounts, or a live transaction list.
- Explain that aggregate totals illustrate the concept and do not guarantee anonymity.
- Do not claim tips replace wages or guarantee higher earnings.
- Include a return button.

HCI OBJECTIVES
- Customer control: checkout is complete before tipping.
- Reduced pressure: no forced tip screen or preselected amount.
- Transparency: customers and employees can understand the sample distribution.
- Error prevention: review before confirming.
- Easy exit: customers can finish without tipping or giving feedback.

Also create a short README.txt with:
- How to open the prototype.
- A screen list.
- A statement that all transactions and employee data are simulated.
- A statement that everything resets on refresh.

After implementation, check navigation, custom input validation, canceling, feedback submission, tip-pool updates, and refresh reset. Report what you actually verified and anything I need to test manually. Do not add features beyond this assignment.


Feedback follow up prompts

1: Update the existing QuietTip prototype rather than rebuilding it.

User feedback: “I saw the QR code, but I wasn’t immediately sure why I would scan it or whether I had to do anything else.”

On the receipt screen:
- Add the heading “Optional: leave a tip later” above the existing QR section.
- Replace the explanation with: “Your purchase is complete. If you want to tip after your visit, scan the code on your receipt.”
- Keep a separate prototype instruction: “Demo: use the button below instead of scanning.”
- Rename “Open optional tip page” to “Try optional tipping.”
- Keep the QR placeholder clearly labeled as not scannable.
- Keep “Finish” visible and independent of tipping.
- Ensure the section wraps or stacks without horizontal overflow on phone screens.

Preserve the grayscale, low-fidelity appearance and all existing functionality. Keep everything front-end only with state in JavaScript memory and reset on refresh.

Check the receipt layout at desktop and phone widths and verify both navigation paths. Summarize the changes and what you actually checked.

2: Update the existing QuietTip prototype rather than rebuilding it.

User feedback: “The Continue button was vague. I wasn’t sure whether it would submit a tip or take me somewhere else, especially after selecting No tip.”

On the optional tip screen:
- When nothing is selected, label the submit button “Choose an option to continue.” Keep it enabled so activating it shows the existing helpful validation.
- When a positive preset or Custom is selected, label it “Review tip.”
- When No tip is selected, label it “Finish without tipping.”
- Show a short selection summary above the button.
- For a valid positive amount, show “Selected tip: $X.XX. Nothing has been submitted.”
- For No tip, show “No tip selected. Your purchase is already complete.”
- For an empty or invalid custom amount, ask the customer to enter a valid amount without displaying an incorrect dollar total.
- Keep the separate “Finish without tipping” exit available.
- Preserve equal sizing and styling of all five tip options.

Keep the existing review and confirmation flow. Do not submit anything when a radio option is selected.

Keep everything grayscale, front-end only, and reset on refresh. Check no selection, No tip, presets, and valid and invalid custom amounts. Summarize what changed.

3: Update the existing QuietTip prototype rather than rebuilding it.

User feedback: “The one-quarter shares made sense, but seeing actual dollar amounts would make the distribution easier to understand.”

Improve the existing “Where tips go” screen:
- Keep the fictional policy and four-employee diagram.
- If the customer has selected a valid positive tip, show how that amount would be divided among the four employees.
- If there is no valid positive selection, show a clearly labeled example: “Example: a $2 tip gives each of four employees $0.50.”
- Label any calculated amounts as a preview, not a submitted tip.
- Preserve the selected option and custom input when returning to the tip screen.
- Keep “Business share: none” and the sample-policy explanation.

For amounts that do not divide evenly into cents, distribute leftover cents deterministically among the four example shares so the displayed shares add up exactly to the tip. Explain briefly that shares can differ by one cent because of rounding.

Do not change the employee dashboard in this step.

Keep everything grayscale and front-end only with reset on refresh. Check $2, a custom $1.01 amount, and returning without losing the selection. Summarize the changes.

4: Update the existing QuietTip prototype rather than rebuilding it.

User feedback: “It said feedback was optional, but I only saw Submit feedback and Return to prototype start. I wanted a clear button to finish.”

Improve the completion screen:
- Add a “Finish without feedback” button before the feedback form.
- Make that button open a simple final screen saying “All done. You can close this page.”
- Include “Return to prototype start” on that final screen.
- After successful simulated feedback submission, hide the form and show the existing submission confirmation with a “Finish” button leading to the same final screen.
- Keep the feedback form available after tipping, skipping, or canceling a tip.
- Preserve the direct “Leave feedback without tipping” path and its focus behavior.
- Do not require feedback or personal information.
- Starting a new customer experience should show a fresh feedback form.

Use neutral completion language regardless of whether the customer tipped.

Keep everything grayscale, front-end only, and stored only in JavaScript memory. Check skipping feedback, submitting feedback, and starting another customer experience. Summarize what changed.

5: Update the existing QuietTip prototype rather than rebuilding it.

User feedback: “I couldn’t easily tell which money was already in the example pool and which money came from testing the tipping flow.”

Improve the employee transparency demo:
- Show “Starting sample pool: $40.00.”
- Show “Simulated tips added during this demo: $X.XX.”
- Show “Current sample pool: $X.XX.”
- Keep all figures clearly labeled as fictional.
- Explain that confirmed tips update these demonstration totals and refreshing resets them.
- Keep this an aggregate demonstration: do not add individual transactions, customer information, timestamps, or order identifiers.
- Preserve the explanation that aggregate totals do not guarantee anonymity.

Fix the existing share-rounding behavior:
- Calculate the four employee allocations in whole cents.
- Divide the pool as evenly as possible and assign leftover cents in a consistent order.
- Ensure the four displayed allocations add up exactly to the pool.
- If allocations differ, replace “Equal share per employee” with “Shares divided as evenly as possible.”
- Explain that rounding may create a one-cent difference.

Keep everything grayscale and front-end only. Check the initial $40 pool, adding a $2 tip, adding a $1.01 tip, and refreshing. Summarize what changed and what you actually verified.


```
