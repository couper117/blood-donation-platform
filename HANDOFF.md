# HANDOFF

## Current Task
Major platform upgrade of the Rwanda Blood Donation Centre, explicitly requested by the
user on 2026-08-22: a real backend with login dashboards, hospital-only blood requests,
medicine-page overflow fixes, merged pages (smaller top bar), prescription upload before
buying medicines, REAL payments, a real AI in Quick Help, settings reduced to essentials,
all Rwandan hospitals on the map (donors only see subscribed ones), and a medicine
catalogue limited to the site's own health cases.

**The old "100% static, zero setup" locked decision is SUPERSEDED.** The user explicitly
asked for "a functional and excellent backend" and "true payment", which cannot exist
without a server. The site now runs via `npm install` + `npm start` at
http://localhost:3000 (auto-falls-forward to the next port if busy - the user has a
Next.js app already occupying 3000). Opening the HTML files directly no longer works and
shows a red banner explaining how to run the server.

## Architecture
- `server.js` - Express + `node:sqlite` (built into Node 24, zero native deps).
  DB file `bdc.sqlite` (delete to reset; seeds re-create). Uploads in `uploads/`.
  - Auth: scrypt password hashing, bearer session tokens in a sessions table.
  - Server-enforced rules: blood requests = hospitals with active subscription ONLY;
    Rx medicines need `prescriptionUrl`; GET /api/hospitals filters to subscribed
    hospitals when the caller is a donor; drone requests = Premium hospitals; stock
    updates = subscribed pharmacies.
  - REAL payments: Flutterwave hosted checkout (`FLW_SECRET_KEY` in .env) with
    server-to-server verification at /payment/callback before activating anything
    (subscription / medicine order / fund donation). No key = clear 503, nothing faked.
  - REAL AI: /api/chat -> Anthropic SDK, model claude-opus-5, with server-side refusal
    fallbacks (`betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"`) and a
    cached system prompt describing the site. No key = `{configured:false}` and the
    client falls back to the offline keyword bot (chatbot.js).
  - Seeds: 6 hospital + 6 pharmacy demo accounts (password demo1234) with active
    subscriptions and stock, so donor-map filtering and verification are demoable.
- `db.js` - rewritten as a fetch-based API client keeping the old `DB.*` method names.
  Session cached in localStorage (`bdc_session_v3`) for instant header rendering.
- `data.js` - shared browser+Node module (module.exports at bottom): ~43 real Rwandan
  hospitals (all provinces), 17 pharmacies, 14 case-limited medicines (caseId + rx
  flags), seed accounts, PLAN_PRICES (server-side price authority).
- Pages: hospitals.html + pharmacy.html merged INTO directory.html (tabs: requests /
  donors / hospitals / pharmacies); drone.html + funds.html merged into services.html
  (tabs). Old URLs 301-redirect server-side with #hash deep links (initPageTabs reads
  location.hash). Nav is now 9 links + settings gear.
- settings reduced to Language + Dark mode (settings.html/settings.js/i18n.js all
  trimmed; old accessibility attributes removed from CSS, prefers-reduced-motion kept).
- Donors now have passwords (added to donate.html form + dashboard login). Re-registering
  an existing contact requires the existing password (anti-takeover, tested).
- Medicine cards: overflow fixed (min-width:0, full-width selects with ellipsis, wrapping
  chips), Rx upload box, two buy buttons: "Pay online" (Flutterwave) and "Reserve & pay
  at pharmacy" (order with payment:"pay-at-pharmacy"). Rx purchase requires login (so the
  upload is authenticated and traceable).
- Dashboard: per-role cover colours (profile-donor/-hospital/-pharmacy), bio editor,
  avatar upload via /api/upload, hospital verification queue with "View certificate"
  links, pharmacy Orders & prescriptions tab.

## Verification done (curl against a live server, 2026-08-22)
Registered a donor; donor/anonymous blocked from posting requests (403); hospital
demo login posted + donor booked a request; Rx order without prescription rejected;
guest non-Rx order placed and stock decremented; upload -> pending queue -> hospital
approve worked; payment initiate without key returns honest 503; chat returns
configured:false; old-page redirects work; all pages serve 200; every
getElementById target cross-checked against HTML ids (all resolve); node --check clean
on all JS. NOT yet verified: real Flutterwave checkout (needs the user's merchant key),
real AI replies (needs ANTHROPIC_API_KEY), and a human browser click-through (the
Claude-in-Chrome extension is still not connected on this machine).

## Next step if resuming
Run `npm start`, open the printed URL, and click through: donor register (with password),
hospital demo login (info@chuk.rw / demo1234) -> post request -> verify a donor doc,
pharmacy demo login (info@kipharma.rw) -> stock/orders, medicines Rx flow, subscribe flow
(stops at the honest "payments not configured" message until keys are added), Quick Help
chat (offline fallback until ANTHROPIC_API_KEY is set), map as donor vs logged out.

## Round 2 (same day): "do the best" hardening batch
User asked for the best-practice fixes I had listed. All implemented and curl-tested:
1. Flutterwave WEBHOOK (/api/payments/webhook, verif-hash vs FLW_WEBHOOK_HASH in .env);
   settlement extracted into idempotent settlePayment() shared with the redirect callback.
2. Prescription review flow: Rx orders are created rxStatus:"pending"/payment:"unpaid";
   pharmacist approves/rejects from dashboard Orders tab (reject restores stock + note);
   buyer tracks orders in donor dashboard "My medicine orders" and can only pay
   (kind:"order-payment") after approval. Direct online pay (kind:"order") now rejects Rx.
   All orders require login (guest checkout removed).
3. Admin role: login via My Account > Admin tab, password ADMIN_PASSWORD in .env
   (default admin1234, printed at boot). Vets hospitals/pharmacies (approved flag - new
   orgs start approved:false and are blocked from subscribing/posting/selling and hidden
   from public lists), revokes approvals, resets passwords (temp password returned to
   admin, sessions killed), views feedback. Seeds are approved:true.
4. Donor privacy: /api/donors returns contact + exact coords only to hospitals/admin
   (public gets ~1km rounded coords, no contact). Medical docs (kind screening/
   prescription) now stored in private_uploads/ and served via /api/docs/:file with
   access checks (owner/hospital for screening, owner/pharmacy for prescription; token
   can come via ?token= query because plain links can't send headers - DB.docUrl()).
   Avatars stay public in uploads/.
5. Hardening: sessions expire after 30 days; login rate limiting (8 fails = 10 min lock,
   in-memory); ABO/Rh compatibility check blocks donors booking incompatible requests.
Payment initiate validates the request BEFORE the not-configured check so approval
errors surface without keys. All flows re-tested via curl (see chat log): approval
gating, admin approve/reset, doc ACLs (owner 200/pharmacy 200/hospital 403/anon 401),
Rx pending->approved->payable, reject restores stock, webhook 401 without hash.
Still needing real keys to verify: live Flutterwave checkout + webhook end-to-end, AI chat.

## Round 3: self-service password change
POST /api/auth/change-password (current + new password; keeps the calling session,
deletes all other sessions for that account). "Change password" collapsible added to
all three dashboard panels (ids d/h/phPwForm, wired by one loop in initDashboard).
Admin still changes their password via .env only. Curl-tested: wrong current rejected,
old password dead after change, other-device session revoked, changing device kept.

## Round 4: full visual redesign ("clean clinical" - user picked via question)
style.css fully rewritten as a design system: Google Fonts (Plus Jakarta Sans headings +
Inter body), new palette around #c8102e crimson with tint/border tokens per hue,
color-mix() used for focus rings/soft borders, refined dark slate theme, focus-visible
everywhere. ALL stock-photo backgrounds removed - home hero + fund hero are crafted
gradients with inline-SVG droplet patterns; body is plain --bg. Header is sticky with
backdrop-blur; script.js injects a hamburger (.nav-toggle, initMobileNav) and <=1020px
turns .nav into a dropdown panel. Active nav/tab states are soft crimson chips (not
solid red). Favicon (crimson SVG droplet data-URI) inserted into all 10 pages via perl.
All class hooks used by HTML/JS were preserved (verified: only unused legacy selectors
dropped). Old design's font-size/contrast/underline settings CSS is gone (settings were
already reduced). Not visually verified in a browser (extension still not connected) -
static checks only: CSS serves, all pages 200, node --check clean.

## Round 5: role-focused header menu
When logged in, applyRoleNav() (script.js, called from initHeaderAccount) hides nav links
not in ROLE_NAV[role] and appends a .nav-mode-toggle button ("View full site" <-> "Show my
menu only"; state in localStorage bdc_navmode, defaulted to "focused" on every login in
DB.saveSession, cleared on logout). Logged out = full menu, no toggle. Role menus:
donor: donate/directory/map/medicines/health/dashboard/settings; hospital: directory/map/
services/subscribe/dashboard/settings; pharmacy: medicines/directory/subscribe/dashboard/
settings; admin: dashboard/settings.

## Round 6 (2026-08-24): big spec implementation + Railway deploy readiness
User pasted a full production spec and said hosting will be Vercel+Railway. Implemented:
- NOTIFICATIONS: notifications table + notify()/notifyAdmin() service (dedupeKey),
  GET /api/notifications + POST /api/notifications/read, bell UI injected by widgets.js
  (badge, dropdown, mark read/all, click-through links, 60s poll). Emission points:
  org registration (->admin), approval/rejection (->org, trial start), donor verification,
  rx review, request booked (->hospital), payment settled (sub + order both sides),
  flagged documents (->admin), staged expiry reminders.
- 7-DAY TRIAL: trialStart/trialEnd set on FIRST admin approval; trialActive/hasAccess()
  replace hasActiveSub in gates (requests POST, stock PUT, donor map filter; drone =
  Premium OR trial). /api/auth/me returns trialDaysLeft+access. Banners in dashboards +
  subscribe. Hourly expirySweep(): staged notifications 7/3/1 days + expiry (deduped),
  also archives board items.
- OFFERS vs ACCOUNTS SPLIT: donate.html = public donation OFFER form (no account,
  POST /api/offers, per-IP rate limit, 30-day life, contact visible to hospitals only).
  Donor ACCOUNT creation moved to dashboard.html (donorRegisterPanel, initDonorRegisterForm).
- REQUEST BOARD: directory requests tab = board with search + type + urgency filters,
  needs (red) + offers (green) cards, admin remove button on offers. requests/offers now
  ARCHIVE (soft delete, archived flag) instead of hard delete; archiveExpired() runs on
  read + hourly.
- UPLOAD HARDENING: magic-byte sniffing (renamed files rejected), sha256 hash + cross-
  account duplicate flagging, docStatus/docNote/name/hash columns (additive ALTERs),
  AI plausibility check via anthropic (aiVerifyDocument, background, sets ai-passed/
  needs-review, notifies admin). Hospital verify queue shows docStatus chip. Admin doc
  review queue: GET /api/admin/documents + POST /:file/review (verified/rejected ->
  notifies owner). 
- ADMIN: /api/admin/stats (12 tiles rendered in adminStats), /api/admin/audit (audit()
  on approvals/resets/doc reviews/offer removals), sections added to dashboard.html.
- MISC: password show/hide eye toggles auto-injected on ALL password inputs
  (initPasswordToggles, accessible); chat is role-aware (second system block after the
  cached one) + honesty/not-a-doctor/escalate-to-admin instructions + platform-features
  update; i18n expanded (page titles/leads all pages, 3 languages); DATA_DIR env for
  Railway volume (sqlite+uploads paths); .env.example documents Urubuto Pay placeholders.
- URUBUTO PAY: researched - NO public API docs exist (BK TecHouse onboards merchants
  privately). Per the spec's no-fake-logic rule, did NOT invent endpoints: Flutterwave
  remains the active verified provider; env placeholders + instructions to obtain the
  spec from BK TecHouse are in .env.example. Wire the adapter when the user gets creds.
- Deployment: README has a Railway guide (single service + volume at /data). Vercel is
  NOT suitable for this backend (no persistent disk) - documented; static-front split
  possible later (needs CORS + absolute API URLs).
All tested via curl (offers privacy, trial start/access/map visibility, magic-byte
rejection, duplicate flagging, stats, notifications read, audit). DB reset after tests.

## Round 7 (2026-08-25): Paypack payments + free Gemini AI (user's choice via question)
- PAYMENTS: Paypack (docs.paypack.rw - verified public docs) is now the PRIMARY provider
  (PAYPACK_CLIENT_ID/SECRET in .env; PAY_PROVIDER auto-picks paypack > flutterwave > none).
  Flow: client payFlow() asks for the MoMo number in a modal (askMomoNumber), POST
  /api/payments/initiate does Paypack cashin {amount, number} (auth via /auth/agents/
  authorize, 10-min token cache), customer approves the USSD prompt on their phone, client
  polls GET /api/payments/status/:txRef every 3s; settlePaypack() verifies with
  /transactions/find/{ref} and applies idempotently. applyIntent() extracted from
  settlePayment so both providers share the same settlement + notifications. Hourly
  checkPendingPaypack() settles payments where the buyer closed the browser. Phone
  normalization to 07XXXXXXXX. Flutterwave redirect flow kept as fallback provider.
  All 4 pay call-sites (subscribe, funds, medicines, dashboard order) now use payFlow
  with ?payment=success redirects. Tested: config endpoint, honest 503 without keys,
  phone validation, honest auth failure with fake creds ("agent not found").
- FREE AI: Google Gemini is now the primary AI when GEMINI_API_KEY set (free tier,
  aistudio.google.com); Anthropic used only as fallback when no Gemini key. Boot-time
  model discovery via ListModels picks the best non-preview flash model (GEMINI_MODEL
  env can pin). geminiGenerate() helper; chat (system+roleLine as system_instruction,
  assistant->model role mapping) and aiVerifyDocument (inline_data for images AND PDFs)
  both support it. 429 -> friendly free-tier message; 400/401/403 -> configured:false.
- NOTE: the user has created a real .env (custom ADMIN_PASSWORD present; their
  ANTHROPIC_API_KEY appears invalid - chat returns configured:false). They will add
  GEMINI_API_KEY + Paypack keys next. README/.env.example updated accordingly.

## Round 7b: keys installed and LIVE-verified
User pasted real keys into .env.example; moved them to .env (git-ignored) and scrubbed
the template. Gemini discovery upgraded to a RANKED model list with automatic fallback
on overload (3.7-flash was busy -> 3.6-flash answered). LIVE-verified: Gemini chat gives
correct role-aware answers (single + multi-turn); Paypack auth accepted the credentials
(token received, no money moved). Remaining live test for the user: one real small MoMo
payment. ADMIN_PASSWORD in .env is still literally "admin1234" - flagged to change.

## Round 8: global language system
i18n.js rebuilt as a WHOLE-PAGE engine: alongside the key-based data-i18n layer there is
now a string table S (exact English -> {fr, rw}, ~250 entries covering nav, buttons,
forms, labels, statuses, board/dashboard/medicines/health/services/subscribe UI,
notification bell + chat UI, footers) plus S_PREFIX rules for composed strings
("Contact: ..."). Engine walks all text nodes + placeholder/title/aria-label attrs,
remembers originals in WeakMaps (so any-direction language switching re-translates from
English), and a MutationObserver translates JS-rendered content the moment it appears.
English is the automatic fallback for anything untranslated. The AI now replies in the
chosen language: client sends lang (db.js chat(messages, lang), widgets.js), server puts
a CRITICAL LANGUAGE RULE at the TOP of the system prompt (appending at the end was
ignored by Gemini Flash - tested). LIVE-verified: French + Kinyarwanda + English replies.
Known limits (documented to user): composed strings with numbers stay English, offline
fallback bot is English-only, Kinyarwanda is best-effort and should get native review.

## Round 9: mobile/responsive audit + fixes (CSS-only, ?v=3)
Chrome extension STILL not connectable - fixes come from a systematic CSS audit at
320/460/768px, not visual inspection; user must eyeball-verify. Fixed:
1. Header: space-between stranded the hamburger mid-header on phones once .nav collapsed.
   Now flex-start + .brand{margin-right:auto} + explicit flex order (nav 5, bell 6,
   hamburger 7) so controls cluster at the right on all screens regardless of JS
   injection order.
2. Profile: the <=460 media query was wiping profile-body's 58px top padding -> avatar
   overlapped the name. Restored + smaller 84px avatar + tighter stats on phones.
3. Audit log/history rows: flex-wrap + overflow-wrap:anywhere (long JSON details
   overflowed the card).
4. .hosp-card p overflow-wrap; .hosp-top flex-wrap (long names + chips).
5. .setting-row flex-wrap (Settings on narrow phones).
6. Mobile nav dropdown: max-height + overflow-y (short/landscape screens).
7. Board toolbar selects get flex-basis so filters form tidy rows on phones.
8. Phone grid tuning at <=460: hosp-grid/plan-grid 1 col, dash-grid/stats-row 2 cols,
   smaller h1/timer.
Cache-busted to style.css?v=3 across all pages. Not committed yet (user commits on ask).
