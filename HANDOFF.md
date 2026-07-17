# Handoff — 2026-07-15

## Status
BuildConnect Pro — a construction leads/bidding marketplace. The original 12,099-line single-file React app has been fully restructured into a real Vite project at `app-scaffold/`, and it now runs on a live Supabase backend (schema, auth, and most core data flows are real — no more localStorage demo data for the pieces listed below).

### App restructuring (complete)
- `app-scaffold/` is a proper Vite + React project: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`.
- Original monolith fully split into `constants.js`, `utils.js`, `demoData.js`, `components/ui.jsx`, `lib/` (Supabase client, auth wrappers, DB↔app mappers), and ~29 files under `tabs/`.
- Verified via bracket-balance checks, an import-completeness audit script, and a reassembled-into-one-file browser preview (React + Babel via CDN — no real bundler in this sandbox).
- **Known limitation, still true**: `npm install`/`npm run build` have never actually been run — this sandbox has no npm registry access. Needs to happen on a machine with internet access before deploying.

### Supabase backend (schema complete, data-layer rewiring mostly done)
- Live project: **Build Connect Pro**, ref `jfegqanjqloliyxvheiv`, region us-west-1. All schema work done directly against the real project via the Supabase MCP connector.
- **Schema — all core tables built, RLS on every table, verified clean with security + performance advisors at each step**: `profiles`, `consumer_profiles`, `contractor_profiles`, `leads`, `bids`, `message_threads`, `messages`, `projects`, `estimates`, `invoices`, `work_orders`, `reviews`.
- `accept_bid(p_bid_id)` — a `SECURITY DEFINER` Postgres function that atomically accepts a bid, declines the others, marks the lead awarded, and creates the `projects` + `work_orders` rows (with a computed 30/40/30 payment schedule). Needed because the consumer's own RLS permissions can't directly create rows owned by the contractor.
- **Real Supabase Auth** now powers login/signup, replacing the old fake `DEMO_ACCOUNTS` system. `src/lib/auth.js` has `signUp`/`signIn`/`signOut`; `LoginPage`, `ConsumerSignup`, and `ContractorSignup` all call it directly.
- **Data-layer rewiring from localStorage → real Supabase queries, done slice by slice, each verified live**:
  - Leads, bids, projects (including `acceptBid`/`declineBid`/`deleteLead`)
  - Messages / message threads
  - Work orders
  - Contractor & consumer profiles
- `src/lib/mappers.js` holds all the camelCase (app) ↔ snake_case (DB) conversion functions, so most UI components didn't need to change shape.
- Real issues caught and fixed along the way: an over-exposed signup trigger function (was callable directly via the API), a missing DELETE policy on `message_threads`, missing columns on `leads` and `consumer_profiles` that the forms actually collected, missing foreign-key indexes.

### Bug fixes (cumulative)
- All fixes from the original restructuring pass (emoji icons, bid auto-calc, message thread/project/schedule linking bugs, timezone bug via `todayLocal()`/`toLocalDateStr()`, scroll-to-top on navigation) — still in place, unaffected by the Supabase work.
- **New today**: contractor directory star rating showed a literal text fragment "1/2" next to the stars for any half-star rating (e.g. a 4.5 rating rendered as `****1/2`). Root cause was `tabs/MatchedContractorsView.jsx` line ~178 concatenating the string `"1/2"` instead of rendering another star character. Fixed by rendering one more `"*"` for the half-star case, matching the plain-asterisk style already used everywhere else on the page.

## Open decisions
- **Hosting platform**: Vercel recommended (simplest Vite auto-detect, common Supabase pairing) — not yet formally chosen/set up.
- **Domain**: not purchased — not required to go live.
- **Real build verification**: still needs `npm install && npm run build` on a machine with internet access.

## Not yet wired to real data (tables exist, still deferred)
- Invoices / estimates
- Reviews
- Schedule, expenses, and deeper project-manager data (crew, materials, permits, subcontractors, project photos) — these need new child tables that haven't been designed yet
- Contractor portfolio photos — currently stored as base64 in a text column, not a real Storage bucket

## Next steps
1. Wire invoices/estimates and reviews to real Supabase queries (tables already exist).
2. Design and build tables for schedule, expenses, and deeper project data; wire those tabs.
3. Move contractor photos to a real Supabase Storage bucket.
4. Run `npm install && npm run build` on a machine with internet access to confirm the split codebase actually compiles.
5. Pick a hosting platform (Vercel recommended) and deploy.
6. Optional: purchase and connect a custom domain.

## Working notes for whoever picks this up
- Standing rules from the user, still in force: always preview cosmetic/functional changes before touching code; keep every fix as simple as possible, no over-engineering; ask permission before deleting any file; never use/expose the Supabase `service_role` key — only the `anon`/publishable key (`sb_publishable_Hu90IdW6dGiwiwYTcbNs2Q_A1N2j1iE`) is safe client-side.
- The user triggers a handoff refresh by typing "EOD" — update this file's Status/Open decisions/Next steps at that point.
- This project now lives at a permanent path (`Downloads/BuildConnectPro`) so it can be reconnected as a folder in any new Cowork session — no longer tied to one session's temp storage.
