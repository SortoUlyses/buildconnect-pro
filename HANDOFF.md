# Handoff — 2026-07-19 (EOD)

## Status
The full core loop — contractor signup, bidding, bid accept/decline, messaging, invoicing, and reviews — is now tested end-to-end on the **live site**, with every step verified two ways: watching the real browser UI and cross-checking the Supabase rows it wrote. Two real bugs were found and fixed along the way, plus one deliberate UX change to invoice statuses and one data-model fix linking invoices to real projects. Everything below is deployed and confirmed live.

- **Live site**: https://buildconnect-pro-gamma.vercel.app/
- **GitHub**: https://github.com/SortoUlyses/buildconnect-pro (public repo)
- **Vercel project**: sortoulyses-projects/buildconnect-pro — root directory set to `app-scaffold`, auto-deploys from `main`
- **Supabase project**: Build Connect Pro, ref `jfegqanjqloliyxvheiv`, region us-west-1

### Critical bug found and fixed this session: guest project submission crashed
The "Submit Project" flow and the homepage's quick-lead form let a logged-out visitor fill out the entire 4-step project form, but hitting the final Submit button threw `TypeError: Cannot read properties of null (reading 'id')` before any network request even fired — `addLead()` in `App.jsx` read `auth.id` assuming someone was logged in. The error banner from an earlier session's fix displayed correctly (no longer silent), but the underlying flow was completely broken for anyone without an account.

Fixed with the design the user specifically wanted: **gate at the end, not the start**. A guest can still fill out all four steps freely (lower friction, more signups). Only on final submit, if there's no session, the filled-out form is stashed in a new `pendingLead` state and the user is routed to the existing login screen (which already links to signup). Once they log in or create an account, `goAfterAuth` picks up the pending lead, submits it automatically, and lands them on their project dashboard — no re-typing anything. Also hardened `addLead` itself to read the live Supabase session instead of trusting a possibly-stale `auth` closure, so it fails gracefully (returns `null`, no crash) rather than throwing, wherever it's called from. Updated the now-inaccurate "No fees or account required" tip copy to "Free for homeowners."

Verified live end-to-end: filled the form as a guest, hit submit, got routed to login, created a brand-new account (`sortoulyses+homeowner2@gmail.com`), and the saved project auto-submitted and appeared in My Projects immediately.

**Known related gap, not fixed**: `DirectProjectSubmit.jsx` (the "submit project directly to this contractor" flow off the Find Contractors directory) calls the same `addLead()` with no login gate either. Because `addLead` itself is now crash-proof, this path won't blow up anymore — but it also won't show any error to a logged-out user, since that component never checked the return value. It just silently does nothing. Worth applying the same gate-at-the-end pattern here if it comes up.

### Invoice status UX — changed twice this session, final version live
Started as a single colored status pill you clicked to cycle forward (Draft → Sent → Paid → Overdue → back to Draft), replacing an separate "Status" button that did the same cycling. The user then asked for something more direct: **all four statuses now show as small pills side by side** on every invoice row (Draft · Sent · Paid · Overdue), the active one filled in with its color, the rest outlined and muted. Clicking any pill sets the invoice to that status directly — no cycling — and clicking the already-active one is a no-op. Verified live both ways (jumping straight to a status, and confirming a repeat click doesn't change anything).

### Invoices now link to real projects, not just a text label
Invoices had a `project_id` column in the schema that was never actually used — the invoice form only ever collected a freeform "Project / Description" text field, so the ID sat null forever even when a matching project record existed. This meant the "Invoiced" total shown on a project's detail page (which works by text-matching the invoice's project label against the project title) technically worked, but there was no real link, and the column was dead weight.

Fixed narrowly: the "Project / Description" field on the invoice form is now a dropdown of the contractor's actual projects (falls back to the old free-text box if "Other / type manually" is picked). Selecting a real project sets both the text label *and* the real `project_id`. Nothing else changed — the "Invoiced" total, the "In Projects" button, and duplicate-invoice detection all still key off the same text label they always did, so none of that logic needed touching. Verified live: picked the project from the dropdown, saved, confirmed `project_id` in Supabase now points at the real project row, and confirmed the project detail page's "Invoiced" figure reflects it correctly.

### Fully wired to Supabase (carried over, unchanged)
- Leads, bids, projects (accept/decline/delete), messages, work orders, profiles, invoices, estimates, reviews, schedule, expenses, deeper project child tables (crew/materials/expenses/permit fees/subcontractors/permits/photos), photo storage — all real Supabase data, no mock/local-only state left anywhere in the app.

### Deployment (unchanged, still confirmed working)
- Vercel auto-deploys from `main` on every push. Verified multiple times this session by comparing the deployed JS bundle hash against a local build before and after each push.
- **New working note**: building inside the shared project folder (`npm run build`) can hit the same cross-platform file-lock quirk as git (`EPERM` trying to empty `dist/`). Workaround: build to an external directory instead, e.g. `npx vite build --outDir /tmp/some-check-dir`. Confirms the build compiles cleanly without touching the shared `dist/` folder at all.

## Open decisions
- **Custom domain**: still not purchased, still deprioritized in favor of functional correctness. Zero cost to add later — ~15 minutes in Vercel once purchased.
- **Repo visibility**: still public on GitHub, unchanged reasoning from last time. No secrets committed.

## Ideas for later — payments and trust/verification
Not started this session, just researched and discussed — worth having on record for when either becomes a priority.

**Stripe billing is 100% stubbed, not partially built.** The Professional/Elite billing step shows a "Prototype Mode" banner plus a card-details form (name, number, expiry, CVV, ZIP), but it's pure decoration — no Stripe SDK loaded, no Stripe Elements, no server endpoint, and the project has zero Supabase edge functions deployed. Whatever gets typed into those fields is thrown away on submit; nothing is charged, nothing is stored. Real integration would need Stripe Checkout or Elements on the frontend, a Supabase edge function to create the subscription and handle webhooks (payment succeeded, subscription canceled, etc.), and a way to tie that into the existing 5%/3.5%/0% commission tiers.

**License and insurance verification is pure self-report today.** "Licensed," "Insured," and "Background checked" are checkboxes the contractor ticks themselves; nothing is checked against any outside source. Cheapest-to-most-involved ways to improve it:
1. Split the badge into "Self-reported" vs. "Verified by BuildConnect Pro" so homeowners aren't misled by a checkbox implying real verification. Zero engineering, just copy and a status field.
2. California's CSLB runs a free public license lookup at cslb.ca.gov (search by license number, get back status/classifications/bond/workers' comp). Link each contractor's entered license number straight to their CSLB record and have a staff person spot-check before flipping the badge — no API needed, just a link-out and a manual review step. CSLB doesn't offer a first-party API, but does publish a public data portal, and third-party scrapers (Apify has a couple built for exactly this) exist if real-time automated checking is wanted later.
3. Replace the free-text "insurance provider" field with an actual Certificate of Insurance upload plus an expiration date (same storage pattern already used for permit documents), so the system can auto-flag lapsed policies instead of trusting a checkbox forever.
4. If a real background check is ever needed, a vendor like Checkr can run one and return pass/fail via webhook, replacing that checkbox too.

Suggested order if this gets picked up: badge honesty first (free), then CSLB link-out with manual review, then COI upload with expiration tracking, then automated real-time verification and background checks once there's enough contractor volume to justify a paid vendor.

## What it would take to make this a strong idea, not just a well-built one
Asked Claude to rate the business idea itself (separate from the code) — landed on a 6/10. Strong differentiation (no shared/sold leads, bundled business portal, price transparency data), and the technical execution is further along than most ideas at this stage, but held back by the classic two-sided marketplace cold-start problem, no working revenue engine yet (see Stripe above), and zero real-world proof — every account and transaction in the system right now is test data. Below is what would move it toward an 8 or 9. Mostly real-world work, not more code.

**Narrow hard before doing anything else.** The site currently spans eighteen trades across all of San Diego. Pick one or two trades — Electrical and Plumbing are already the ones built out in test data — and one or two neighborhoods, not the whole metro. Trying to be everything everywhere with zero supply or demand is the single biggest thing working against this right now.

**Recruit the first real contractors by hand.** Fifteen to twenty contractors in that narrow niche, ideally people already frustrated with Angi or Thumbtack reselling their leads to competitors — that complaint is real and public, and it's a genuine pitch: first leads free, never shared, keep more of what you earn. This is cold outreach and relationship-building, not an engineering task, and it's the unglamorous work every successful local marketplace had to grind through before anything scaled.

**Manually match the first batch of homeowner requests.** Don't trust the matching to work perfectly cold — personally connect the first twenty or so homeowners to good contractors by phone or text if needed. That guarantees a good first experience, which produces the first real reviews instead of test data, and real reviews from real completed jobs do more for credibility than any feature could.

**Get Stripe actually working.** The revenue model depends on collecting a commission that currently has no mechanism to collect it. Can't prove unit economics on a business that can't take money.

**Fix trust and verification for real**, per the section above — "verified license, real reviews, exclusive lead" is a much stronger pitch than any one of those alone, and it defuses the biggest liability risk once real strangers are transacting through the platform.

**Lean into the price transparency tool as the actual moat.** Every real completed job adds a data point competitors can't just scrape or buy — it's proprietary transaction history. If it becomes the most accurate local home-project pricing source in San Diego, that's a real moat and a free organic acquisition channel, since "kitchen remodel cost San Diego" gets searched a lot and mostly returns vague national averages today.

**The actual test**: roughly twenty real contractors, fifty real completed jobs, real money changing hands, real reviews to show for it. That's the evidence that turns "well-built idea" into "proven small marketplace" — no feature moves that number, only real usage does.

## Next steps
1. **Core loop is done.** Contractor signup, bidding, bid accept/decline, messaging, invoicing, and leaving a review are all tested end-to-end on the live site and confirmed in the database. If more testing continues, good next candidates: the digital work order sign flow (appeared automatically after accepting a bid, not yet clicked through), the Estimates tab, Expenses tab, and Schedule tab — none of these were touched this session.
2. Optional: apply the same "gate at the end" login pattern to `DirectProjectSubmit.jsx` so a logged-out visitor submitting a project directly to one contractor gets the same smooth signup flow instead of a silent no-op.
3. Optional, low-priority, unchanged from before: Supabase security advisor flags leaked-password-protection being off, and `accept_bid` being a publicly-callable `SECURITY DEFINER` function (intentional, but worth a second look someday).
4. Optional: purchase and connect a custom domain whenever convenient.

## Working notes for whoever picks this up
- Standing rules from the user, still in force: always preview cosmetic/functional changes before touching code (a plain-text explanation or a mockup — this session used both); keep every fix as simple as possible, no over-engineering; ask permission before deleting any file; never use/expose the Supabase `service_role` key — only the `anon`/publishable key is safe client-side; no emojis, no end-of-sentence hyphens in written copy or commit messages.
- **Git rule, unchanged and important**: `Downloads/BuildConnectPro` is a live git repo on the user's own Mac, bridged into this sandbox in a way that doesn't support git's file-locking model. Claude should never run git commands against this folder — code changes happen via file-edit tools, the user runs `git add / commit / push` themselves in their own Terminal. (New this session: the same file-lock issue can also hit `npm run build`'s `dist/` folder — see the build note above for the workaround.)
- Live site: https://buildconnect-pro-gamma.vercel.app/ — auto-deploys on every push to `main`.
- GitHub: https://github.com/SortoUlyses/buildconnect-pro (public).
- **Test accounts now live in production data**, both created this session, password `TestPass123!` for both:
  - `sortoulyses+contractor@gmail.com` — contractor, "Sorto Electrical & Plumbing," Electrical + Plumbing trades, Starter (free) plan, San Diego. Has one completed project ($5,150, panel upgrade), one invoice (INV-22723), and a 5.0 average rating from the one review received.
  - `sortoulyses+homeowner2@gmail.com` — consumer, created through the new guest-submission-then-signup flow. Has one completed project with an accepted bid and a 5-star review left.
  - Older accounts `sortoulyses+homeowner@gmail.com` (created 2026-07-16) and the user's own `sortoulyses@gmail.com` still exist but their passwords aren't known to Claude — use the two accounts above for further testing unless the user provides those credentials.
- The user triggers a handoff refresh by typing "EOD" — update this file's Status/Open decisions/Next steps at that point.
- This project lives at a permanent path (`Downloads/BuildConnectPro`) so it can be reconnected as a folder in any new Cowork session — no longer tied to one session's temp storage.
