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
