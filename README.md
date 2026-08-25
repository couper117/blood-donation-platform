# Rwanda Blood Donation Centre

A blood-donation platform for Rwanda with a real Node.js backend: donor /
hospital / pharmacy accounts, hospital-only blood requests, a live map of every
hospital in Rwanda, case-related medicines with prescription upload, real
Mobile Money payments (Paypack) and a real AI helper (Google Gemini, free tier).

## How to run

```bash
npm install     # first time only
npm start
```

Then open **http://localhost:3000** (if port 3000 is busy, the server
automatically picks the next free port and prints it - read the terminal).

> Do NOT open the .html files by double-clicking them any more - the site needs
> its server. Always go through http://localhost:3000.

The database is the `bdc.sqlite` file next to `server.js`. Delete it to reset
everything (demo accounts are re-created on the next start). Uploaded files
(avatars, screening certificates, prescriptions) live in `uploads/`.

## Demo accounts (all passwords: `demo1234`)

- Hospitals: `info@chuk.rw`, `info@kfh.rw`, `info@kibagabaga.rw`, `info@chub.rw`, `info@ruhengerihospital.rw`, `info@kibuyehospital.rw`
- Pharmacies: `info@kipharma.rw`, `info@adrenalinepharmacy.rw`, `contact@pharmacieconseil.rw`, `hello@lifecarepharmacy.rw`, `info@bgkpharmacy.rw`, `contact@pharmacieingenzi.rw`
- Donors: register your own on the Donate page.

## Optional keys (`.env`)

Copy `.env.example` to `.env` and fill in what you have. Without keys the site
still runs; the two features below simply say "not configured".

| Key | Enables | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | **FREE** real AI for Quick Help + document checks (Google Gemini free tier, ~1,500 requests/day). | https://aistudio.google.com |
| `ANTHROPIC_API_KEY` | Alternative paid AI (Claude) - used only when no Gemini key is set. | https://console.anthropic.com |
| `PAYPACK_CLIENT_ID` + `PAYPACK_CLIENT_SECRET` | REAL payments in RWF via MTN/Airtel **Mobile Money** - the customer approves a prompt on their phone. Self-service signup. | https://payments.paypack.rw |
| `FLW_SECRET_KEY` | Alternative payments (Flutterwave, adds cards) - used only when no Paypack keys are set. | https://flutterwave.com |

Payments are never faked: with no keys, every pay button clearly reports that
payment is not configured, and nothing activates. With Paypack keys, the
customer approves a Mobile Money prompt on their phone and the server verifies
the transaction with Paypack before activating anything (idempotent - never
applied twice). Flutterwave works the same way via its hosted checkout.

## The rules the server enforces

- **Only approved hospitals with an active subscription can post blood requests.**
  Individuals can never request blood - they are pointed to the nearest hospital.
- **New hospitals and pharmacies must be vetted.** They register, then the site
  administrator approves them before they can subscribe, post requests or sell.
- **A signed-in donor sees only subscribed hospitals on the Live Map.**
  Everyone else sees all ~43 hospitals across Rwanda.
- **Prescription (Rx) medicines go through pharmacist review.** The buyer
  uploads the prescription, the pharmacist approves or rejects it from their
  dashboard, and payment/collection only happens after approval. Rejected
  orders return their stock automatically.
- **Medical documents are private.** Screening certificates are visible only to
  the donor who owns them and hospital accounts; prescriptions only to the buyer
  and pharmacies. Donor contact details and exact locations are shown only to
  hospitals - the public sees name, blood group, city and a ~1 km position.
- **Donors can only book blood requests their group can actually help**
  (full ABO/Rh compatibility check).
- **The medicine catalogue is limited to the cases this site covers**: anemia &
  blood support, diabetes, hypertension, asthma, heart health, obesity.
- Ordering a medicine requires being logged in, so the pharmacy can reach you.
- Passwords are hashed (scrypt); sessions are bearer tokens that expire after
  30 days; 8 wrong passwords lock an account's login for 10 minutes.

## The administrator

Log in from **My Account → Admin** with the password in `.env`
(`ADMIN_PASSWORD`; the default is `admin1234` - change it). The admin approves
or rejects new hospitals/pharmacies, revokes approvals, resets any account's
password (a temporary password is generated to hand over privately), and reads
feedback.

## Payment reliability

Besides the browser redirect, the server accepts a **Flutterwave webhook** at
`/api/payments/webhook`. Configure it in the Flutterwave dashboard (Settings →
Webhooks) with a secret hash, and set the same hash as `FLW_WEBHOOK_HASH` in
`.env`. Then a customer who pays but closes the browser mid-flow still gets
their subscription/order activated. Settlement is idempotent - nothing is ever
applied twice.

## Pages

Home · Donate · Directory (blood requests + donors + hospitals + pharmacies) ·
Live Map · Medicines · Health · Services (drone delivery + funds) · Subscribe ·
My Account · Settings (language + dark mode)

Old URLs (`hospitals.html`, `pharmacy.html`, `drone.html`, `funds.html`)
redirect to the merged pages.

## Free trial, notifications & the Request Board

- **7-day free trial**: when the admin approves a new hospital or pharmacy, a
  server-timed 7-day trial with full access starts automatically. When it ends
  without a subscription, posting/listing is paused (the account and data are
  preserved) until they subscribe. All checks are server-side.
- **Notifications**: the bell in the header shows role-specific notifications -
  request bookings, prescription reviews, payment confirmations, verification
  results, and staged trial/subscription expiry reminders (7 / 3 / 1 days
  before and on expiry, never duplicated).
- **Request Board** (Directory → Blood requests): hospital blood requests AND
  volunteer donation offers, with search and type/urgency filters. Anyone can
  post a donation offer from the Donate page **without creating an account**;
  a donor *account* (profile, history, verification) is a separate, deliberate
  flow in My Account. Everything on the board archives automatically after 30
  days via an hourly server job (soft delete - kept for auditing).
- **Document checks**: uploads are verified against their real file bytes (a
  renamed file is rejected), duplicate medical documents across accounts are
  flagged, and (when `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` is set) an AI plausibility check flags
  files that don't look like the claimed certificate/prescription. Flags are
  reviewed by the admin - the AI never decides alone.

## Deploying (Railway recommended)

This app is one Node.js server (Express + SQLite + uploaded files on disk), so
the simplest correct deployment is a **single Railway service**:

1. Push this folder to a GitHub repository (`.gitignore` already excludes
   secrets, the database and uploads).
2. In Railway: New Project → Deploy from GitHub repo. Railway detects Node and
   runs `npm install` + `npm start` automatically.
3. Add a **Volume** to the service, mounted at `/data`.
4. Set the environment variables (Service → Variables): `DATA_DIR=/data`,
   `PUBLIC_URL=https://<your-app>.up.railway.app`, `ADMIN_PASSWORD`,
   `GEMINI_API_KEY`, `PAYPACK_CLIENT_ID`, `PAYPACK_CLIENT_SECRET`.
5. (Only if using Flutterwave instead of Paypack: also set `FLW_SECRET_KEY`,
   `FLW_WEBHOOK_HASH`, and point the Flutterwave webhook at
   `https://<your-app>.up.railway.app/api/payments/webhook`.)

**About Vercel**: Vercel's serverless platform has no persistent disk, so the
SQLite database and uploads cannot live there - do not deploy the backend to
Vercel as-is. Either deploy everything to Railway (recommended, simplest), or,
if you specifically want Vercel in front, use it only as a static host and
point it at the Railway backend (requires code changes for absolute API URLs
and CORS - ask for this if you want it).
