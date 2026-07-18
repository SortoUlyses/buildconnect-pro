# Handoff — 2026-07-17 (EOD)

## Status
BuildConnect Pro is now a fully wired, **live, publicly deployed** app — not just a codebase. Every major feature runs on real Supabase data, and the site is reachable at a real URL with auto-deploy on every push.

- **Live site**: https://buildconnect-pro-gamma.vercel.app/
- **GitHub**: https://github.com/SortoUlyses/buildconnect-pro (public repo)
- **Vercel project**: sortoulyses-projects/buildconnect-pro — root directory set to `app-scaffold`, auto-deploys from `main`
- **Supabase project**: Build Connect Pro, ref `jfegqanjqloliyxvheiv`, region us-west-1

### Fully wired to Supabase (complete — nothing major left)
- Leads, bids, projects (accept/decline/delete), messages, work orders, profiles — from earlier sessions
- Invoices, estimates, reviews — wired this session
- Schedule (`schedule_events`), expenses (`expenses`) — wired this session
- Deeper project data — crew, materials, project-level expenses, permit fees, subcontractors, permit documents, job-site photos — each got its own real child table (`project_crew`, `project_materials`, `project_expenses`, `project_permit_fees`, `project_subcontractors`, `project_permits`, `project_photos`), all FK'd to `projects`. The real `projects` table existed since an earlier session (created by `accept_bid`) but the app had never actually read from it — it was write-only. Now fully loaded and used, keyed locally by `bid_id` (bid-won jobs) or the project's own id (manual jobs) so every existing lookup across the app kept working unchanged.
- Photo storage — contractor profile headshot, portfolio Before/After gallery (new `contractor_photos` table), and expense receipt images all moved off base64-in-a-column to a real public Storage bucket (`contractor-photos`), with owner-scoped write policies.

### Deployment (complete)
- Local git repo pushed to GitHub (public, user's own account), connected to Vercel with root directory `app-scaffold`.
- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) set in Vercel.
- **`npm install && npm run build` now confirmed working for real** — Vercel's build servers have actual internet access, unlike this sandbox, so the long-standing "never actually build-tested" caveat is resolved.

### Critical bug found and fixed this session: RLS infinite recursion
`bids`' "Consumers can view bids on their leads" policy queried `leads`, and `leads`' "Contractors can view leads they bid on" policy queried `bids` right back — a circular reference. Postgres detects this and kills the query with a 500 error. This silently broke **almost every authenticated read/write in the app** — leads, bids, invoices, estimates, work_orders, message_threads, projects — for both consumer and contractor roles. It had likely been broken since these tables were first created; it was never caught earlier because verification always went through direct SQL (which bypasses RLS) rather than a real logged-in browser session.

It only surfaced because the user connected the Claude in Chrome extension mid-session and we reproduced their exact bug report live — watched the network tab, saw every Supabase query returning 500, traced it to the policy cycle. Fixed with two `SECURITY DEFINER` helper functions (`consumer_owns_lead`, `contractor_bid_on_lead`) that break the cycle by bypassing RLS internally on just that one lookup. Verified fixed end-to-end: the same submit-project flow that silently failed now succeeds with a real reference ID.

**Lesson for next time**: any time two tables' RLS policies reference each other, check for recursion before shipping, and test the actual authenticated browser path, not just direct SQL.

### Other bugs fixed this session
- **JoinPage.jsx** — the two role-choice cards' bottom CTA buttons weren't `box-sizing: border-box`, so they overflowed their card slightly (read as "shifted right"), and weren't anchored to the card bottom, so a card with less text left its button sitting higher than the other's. Fixed with border-box + flex-column + `margin-top: auto`.
- **ClientForm.jsx** (Submit Project flow) — the final submit button failed completely silently on error, no message, nothing visibly happening. Added a real try/catch, a visible red error banner, and a disabled "Submitting..." state. Caught a follow-on bug in this same fix during live testing: `submitting` never reset to `false` after a *successful* submit, so "Submit Another Project" left the button stuck showing "Submitting..." forever. Fixed by resetting it in both the success path and the reset handler.

## Open decisions
- **Custom domain**: not purchased, explicitly deprioritized by the user in favor of functional correctness first. Zero cost to add later — ~15 minutes in Vercel once purchased.
- **Repo visibility**: public on GitHub. Was going to be private, but a Vercel git-identity-verification quirk on the Hobby plan made public the simpler path. No secrets are committed (`.env` is gitignored), so no real downside.

## Next steps
1. **Keep testing live flows as a real user would.** Contractor signup was in progress when this handoff was written (see below) — pick that back up, then test bidding, accepting a bid, messaging, invoicing a completed job, and leaving a review, end to end with real browser sessions on both roles. Assume more silent-failure bugs like the ones found today are still lurking; the fix pattern is the same one used in `ClientForm.jsx` — never let an error just do nothing, always surface it.
2. Optional: purchase and connect a custom domain whenever convenient.
3. Optional, low-priority: Supabase security advisor flags two pre-existing warnings — leaked-password-protection is off, and `accept_bid` is a publicly-callable `SECURITY DEFINER` function (intentional, but worth a second look someday). Neither is a blocker.

## Working notes for whoever picks this up
- Standing rules from the user, still in force: always preview cosmetic/functional changes before touching code; keep every fix as simple as possible, no over-engineering; ask permission before deleting any file; never use/expose the Supabase `service_role` key — only the `anon`/publishable key (`sb_publishable_Hu90IdW6dGiwiwYTcbNs2Q_A1N2j1iE`) is safe client-side.
- **New operational rule, important**: `Downloads/BuildConnectPro` is now a live git repo on the user's own Mac, synced into this sandbox through a bridge that does not support git's file-locking model. Running *any* git command from Claude's side against this path — even a read-only one like `git status` — can leave a stray `.git/index.lock` file behind, and because the folder is genuinely shared (not just mirrored), that stray lock blocks the *user's own Terminal* from committing too. This actually happened this session. **Claude should not run git commands against this folder at all, ever.** Code changes happen via the normal file-edit tools; the user runs `git add / commit / push` themselves in their own Terminal. If a stray lock does appear, the fix is `rm -f .git/index.lock` (safe — deletes just that one file, not the repo).
- Live site: https://buildconnect-pro-gamma.vercel.app/ — auto-deploys on every push to `main`.
- GitHub: https://github.com/SortoUlyses/buildconnect-pro (public).
- A contractor test account was mid-onboarding when this handoff was written: `sortoulyses+contractor@gmail.com`, trades Electrical + Plumbing, Starter (free) plan, bio filled in, not yet finished/submitted. Pick that back up or redo it next session.
- The user triggers a handoff refresh by typing "EOD" — update this file's Status/Open decisions/Next steps at that point.
- This project lives at a permanent path (`Downloads/BuildConnectPro`) so it can be reconnected as a folder in any new Cowork session — no longer tied to one session's temp storage.
