/* ============================================================
   Rwanda Blood Donation Centre - backend server.

   Run with:   npm install   (first time only)
               npm start
   Then open:  http://localhost:3000

   What lives here:
   - A real database (SQLite, built into Node - the file bdc.sqlite
     appears next to this script; delete it to reset everything).
   - Accounts & login for donors, hospitals and pharmacies, with
     server-side password hashing and session tokens.
   - Server-enforced rules: ONLY hospitals with an active
     subscription can post blood requests; prescription medicines
     can only be ordered with an uploaded prescription; a signed-in
     donor is only shown subscribed hospitals.
   - REAL payments through Flutterwave (Mobile Money / card, RWF)
     when FLW_SECRET_KEY is set in .env. Nothing is ever faked:
     without a key, payment endpoints report "not configured".
   - REAL AI for the Quick Help chat through the Anthropic API when
     ANTHROPIC_API_KEY is set in .env; the site falls back to the
     built-in offline helper without it.
   ============================================================ */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* Friendly checks for the two most common setup mistakes, so people on
   any computer (Windows / Mac / Linux) get a clear message instead of a
   confusing crash. */
let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (e) {
  console.error("\n  Your Node.js is too old for this site (it needs the built-in SQLite database).");
  console.error("  Please install Node.js version 22 or newer from https://nodejs.org (choose the LTS installer),");
  console.error("  then run \"npm start\" again. Your current version: " + process.version + "\n");
  process.exit(1);
}
let express, Anthropic;
try {
  express = require("express");
  Anthropic = require("@anthropic-ai/sdk");
} catch (e) {
  console.error("\n  Dependencies are not installed yet. In this folder, run:");
  console.error("      npm install");
  console.error("  and then:");
  console.error("      npm start\n");
  process.exit(1);
}
const DATA = require("./data.js");

/* ---------------- .env loading (no extra package needed) ---------------- */
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

/* Where the database and uploaded files live. On hosting platforms
   (e.g. Railway with a mounted volume) set DATA_DIR to the volume path
   so data survives redeployments. Defaults to the project folder. */
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_URL = (process.env.PUBLIC_URL || "http://localhost:" + PORT).replace(/\/$/, "");
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_WEBHOOK_HASH = process.env.FLW_WEBHOOK_HASH || "";
const PAYPACK_CLIENT_ID = process.env.PAYPACK_CLIENT_ID || "";
const PAYPACK_CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET || "";
const PAYPACK_MODE = process.env.PAYPACK_MODE || "production";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
/* Which payment provider is active: Paypack wins if configured. */
const PAY_PROVIDER = (PAYPACK_CLIENT_ID && PAYPACK_CLIENT_SECRET) ? "paypack"
  : FLW_SECRET_KEY ? "flutterwave" : null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000; // sessions expire after 30 days
const FUNDS_BASELINE = 6450000; // RWF already raised before this site went live
const REQUEST_MAX_MS = 30 * 24 * 60 * 60 * 1000; // requests & offers archive after 30 days
const PLAN_DAYS = 30;
const TRIAL_DAYS = 7; // free trial for newly approved hospitals & pharmacies

/* ---------------- Database ---------------- */
const db = new DatabaseSync(path.join(DATA_DIR, "bdc.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS donors     (contact TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS hospitals  (email TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS pharmacies (email TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS requests   (id TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS stock      (pharmacyEmail TEXT, medicineId TEXT, qty INTEGER,
                                         PRIMARY KEY (pharmacyEmail, medicineId));
  CREATE TABLE IF NOT EXISTS orders         (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS droneRequests  (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS emergencyLog   (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS feedback       (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS funds          (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions   (token TEXT PRIMARY KEY, role TEXT, id TEXT, createdOn TEXT);
  CREATE TABLE IF NOT EXISTS payments   (txRef TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS uploads    (file TEXT PRIMARY KEY, kind TEXT, ownerRole TEXT, ownerId TEXT, createdOn TEXT);
  CREATE TABLE IF NOT EXISTS offers        (id TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS auditLog      (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
`);
/* Safe, additive migrations for columns added after the first release.
   ALTER fails harmlessly if the column already exists. */
for (const col of ["hash TEXT", "docStatus TEXT", "docNote TEXT", "name TEXT"]) {
  try { db.exec("ALTER TABLE uploads ADD COLUMN " + col); } catch (e) { /* already there */ }
}

const ROLE_TABLE = { donor: "donors", hospital: "hospitals", pharmacy: "pharmacies" };
const ROLE_KEY = { donor: "contact", hospital: "email", pharmacy: "email" };

function getRecord(role, id) {
  if (!id) return null;
  const row = db.prepare(`SELECT json FROM ${ROLE_TABLE[role]} WHERE ${ROLE_KEY[role]} = ?`)
    .get(String(id).trim().toLowerCase());
  return row ? JSON.parse(row.json) : null;
}
function putRecord(role, record) {
  const key = String(record[ROLE_KEY[role]]).trim().toLowerCase();
  record[ROLE_KEY[role]] = key;
  db.prepare(`INSERT INTO ${ROLE_TABLE[role]} (${ROLE_KEY[role]}, json) VALUES (?, ?)
              ON CONFLICT(${ROLE_KEY[role]}) DO UPDATE SET json = excluded.json`)
    .run(key, JSON.stringify(record));
  return record;
}
function allRecords(role) {
  return db.prepare(`SELECT json FROM ${ROLE_TABLE[role]}`).all().map(r => JSON.parse(r.json));
}
function rowsJson(table) {
  return db.prepare(`SELECT id, json FROM ${table}`).all()
    .map(r => Object.assign(JSON.parse(r.json), { id: r.id }));
}
function insertJson(table, obj) {
  const res = db.prepare(`INSERT INTO ${table} (json) VALUES (?)`).run(JSON.stringify(obj));
  obj.id = Number(res.lastInsertRowid);
  return obj;
}

/* ---------------- Passwords & sessions ---------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("hex");
}
function checkPassword(pw, stored) {
  if (!stored || stored.indexOf("$") < 0) return false;
  const [salt, hash] = stored.split("$");
  const candidate = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}
function createSession(role, id) {
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, role, id, createdOn) VALUES (?, ?, ?, ?)")
    .run(token, role, id, new Date().toISOString());
  return token;
}
function sessionFor(req) {
  // Token comes from the Authorization header, or (for document links that
  // are opened as plain <a>/<img> and cannot send headers) a ?token= query.
  const auth = req.headers.authorization || "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token && typeof req.query.token === "string") token = req.query.token;
  if (!token) return null;
  const row = db.prepare("SELECT role, id, createdOn FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (Date.now() - new Date(row.createdOn).getTime() > SESSION_MAX_MS) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return { role: row.role, id: row.id, token };
}
function accountFor(req) {
  const s = sessionFor(req);
  if (!s) return null;
  if (s.role === "admin") return { role: "admin", record: { name: "Administrator" }, token: s.token };
  const record = getRecord(s.role, s.id);
  return record ? { role: s.role, record, token: s.token } : null;
}
function isAdmin(req) {
  const s = sessionFor(req);
  return !!(s && s.role === "admin");
}

/* Simple in-memory login rate limiting: 8 wrong passwords locks that
   account name out for 10 minutes. */
const loginFails = new Map();
function loginLocked(key) {
  const f = loginFails.get(key);
  return !!(f && f.count >= 8 && Date.now() < f.until);
}
function noteLoginFail(key) {
  const f = loginFails.get(key) || { count: 0, until: 0 };
  f.count += 1;
  f.until = Date.now() + 10 * 60 * 1000;
  loginFails.set(key, f);
}

/* Public view of a record: never leak the password hash. */
function publicView(record) {
  if (!record) return null;
  const copy = Object.assign({}, record);
  delete copy.passwordHash;
  return copy;
}
function hasActiveSub(rec) {
  return rec && rec.subscriptionStatus === "active" &&
    rec.subscriptionEnd && new Date(rec.subscriptionEnd) > new Date();
}
/* Mark expired subscriptions as expired whenever a record is read. */
function refreshSub(role, rec) {
  if (rec && rec.subscriptionStatus === "active" && rec.subscriptionEnd &&
      new Date(rec.subscriptionEnd) < new Date()) {
    rec.subscriptionStatus = "expired";
    putRecord(role, rec);
  }
  return rec;
}

/* ---------------- Free trial + access -----------------
   Newly approved hospitals/pharmacies get a 7-day trial with full
   access. After that they need a paid subscription. All checks are
   server-side, based on server time - the browser can't fake it. */
function trialActive(rec) {
  return !!(rec && rec.trialEnd && new Date(rec.trialEnd) > new Date() && rec.approved !== false);
}
function trialDaysLeft(rec) {
  if (!trialActive(rec)) return 0;
  return Math.max(0, Math.ceil((new Date(rec.trialEnd) - Date.now()) / 86400000));
}
/* Can this organisation use paid features right now? (active sub OR trial) */
function hasAccess(rec) {
  return hasActiveSub(rec) || trialActive(rec);
}

/* ---------------- Notifications -----------------
   One reusable service. dedupeKey prevents the same notification from
   ever being sent twice (used by the staged expiry reminders). */
function notify(role, accountId, n) {
  if (n.dedupeKey) {
    const dup = db.prepare("SELECT id FROM notifications WHERE json LIKE ?")
      .get('%"dedupeKey":"' + n.dedupeKey + '"%');
    if (dup) return null;
  }
  return insertJson("notifications", Object.assign({
    role, accountId, read: false, createdOn: new Date().toISOString()
  }, n));
}
function notifyAdmin(n) { return notify("admin", "admin", n); }

/* ---------------- Audit log for admin actions ---------------- */
function audit(action, details) {
  insertJson("auditLog", { action, details: details || {}, at: new Date().toISOString() });
}

/* ---------------- One-time seeding of demo accounts ---------------- */
function subWindow() {
  const now = new Date();
  return {
    subscriptionStatus: "active",
    subscriptionStart: now.toISOString(),
    subscriptionEnd: new Date(now.getTime() + PLAN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  };
}
function seed() {
  if (allRecords("pharmacy").length === 0) {
    for (const s of DATA.PHARMACY_SEED_ACCOUNTS) {
      putRecord("pharmacy", Object.assign({ role: "pharmacy", bio: "", avatarUrl: null, approved: true,
        passwordHash: hashPassword("demo1234"), subscriptionPlan: "Standard" }, subWindow(), s.account));
      for (const st of s.stock) {
        db.prepare(`INSERT INTO stock (pharmacyEmail, medicineId, qty) VALUES (?, ?, ?)
                    ON CONFLICT(pharmacyEmail, medicineId) DO UPDATE SET qty = excluded.qty`)
          .run(s.account.email.toLowerCase(), st.medicineId, st.qty);
      }
    }
    console.log("Seeded " + DATA.PHARMACY_SEED_ACCOUNTS.length + " demo pharmacy accounts (password: demo1234)");
  }
  if (allRecords("hospital").length === 0) {
    for (const h of DATA.HOSPITAL_SEED_ACCOUNTS) {
      putRecord("hospital", Object.assign({ role: "hospital", bio: "", avatarUrl: null, approved: true,
        passwordHash: hashPassword("demo1234"), subscriptionPlan: h.plan }, subWindow(), h, { plan: undefined }));
    }
    console.log("Seeded " + DATA.HOSPITAL_SEED_ACCOUNTS.length + " demo hospital accounts (password: demo1234)");
  }
}
seed();

/* ---------------- App setup ---------------- */
const app = express();
app.use(express.json({ limit: "12mb" }));

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

function fail(res, code, message) { return res.status(code).json({ error: message }); }

/* ============================================================
   AUTH
   ============================================================ */

/* Register a donor (from the Donate page). Creates the account and logs in. */
app.post("/api/auth/register-donor", (req, res) => {
  const b = req.body || {};
  const contact = String(b.contact || "").trim().toLowerCase();
  if (!b.fullName || b.fullName.length < 2) return fail(res, 400, "Please enter your full name.");
  if (!(b.age >= 18 && b.age <= 65)) return fail(res, 400, "Donors must be between 18 and 65.");
  if (!b.bloodGroup) return fail(res, 400, "Please select your blood group.");
  if (contact.length < 5) return fail(res, 400, "Please enter a phone number or email.");
  if (!b.password || String(b.password).length < 4) return fail(res, 400, "Please choose a password of at least 4 characters.");
  const existing = getRecord("donor", contact);
  if (existing) {
    // Only the logged-in owner of this account may overwrite it.
    const s = sessionFor(req);
    const isOwner = s && s.role === "donor" && s.id === contact;
    if (!isOwner && !checkPassword(b.password, existing.passwordHash)) {
      return fail(res, 409, "An account with that phone/email already exists. Log in from My Account, or use your existing password here to update your details.");
    }
  }
  const donor = Object.assign({
    verificationStatus: b.screeningUrl ? "pending" : "none",
    verifiedBy: null, verifiedOn: null, verificationNote: "",
    avatarUrl: null, bio: "", donations: [],
    registeredOn: new Date().toISOString()
  }, existing || {}, {
    fullName: b.fullName, age: b.age, bloodGroup: b.bloodGroup, contact,
    city: b.city || "", lat: b.lat, lng: b.lng,
    lastDonation: b.lastDonation || null,
    screeningUrl: b.screeningUrl || (existing && existing.screeningUrl) || null,
    screeningName: b.screeningName || (existing && existing.screeningName) || null,
    passwordHash: hashPassword(b.password),
    role: "donor"
  });
  if (b.screeningUrl) donor.verificationStatus = "pending";
  if (b.lastDonation && !(donor.donations || []).length) donor.donations = [{ date: b.lastDonation, place: donor.city }];
  putRecord("donor", donor);
  const token = createSession("donor", contact);
  res.json({ token, role: "donor", record: publicView(donor) });
});

/* Register a hospital or pharmacy. */
app.post("/api/auth/register-org", (req, res) => {
  const b = req.body || {};
  const role = b.role === "pharmacy" ? "pharmacy" : b.role === "hospital" ? "hospital" : null;
  if (!role) return fail(res, 400, "Unknown account type.");
  const email = String(b.email || "").trim().toLowerCase();
  if (!b.name || b.name.length < 2 || email.length < 5) return fail(res, 400, "Please fill in a name and a valid email.");
  if (!b.password || String(b.password).length < 4) return fail(res, 400, "Please choose a password of at least 4 characters.");
  if (getRecord(role, email)) return fail(res, 409, "An account with that email already exists. Please log in instead.");
  const rec = putRecord(role, {
    role, name: b.name, email, phone: b.phone || "", city: b.city || "",
    lat: typeof b.lat === "number" ? b.lat : null, lng: typeof b.lng === "number" ? b.lng : null,
    bio: "", avatarUrl: null,
    // New organisations start unapproved: an administrator must vet them
    // before they can subscribe, post blood requests or sell medicines.
    approved: false,
    subscriptionPlan: "none", subscriptionStatus: "none", subscriptionStart: null, subscriptionEnd: null,
    passwordHash: hashPassword(b.password)
  });
  const token = createSession(role, email);
  notifyAdmin({ type: "registration", title: "New " + role + " registered: " + rec.name,
    body: (rec.city || "No city given") + " - " + rec.email + ". Review and approve it from the admin panel.",
    link: "dashboard.html" });
  res.json({ token, role, record: publicView(rec) });
});

/* Log in (any role, including the site administrator). */
app.post("/api/auth/login", (req, res) => {
  const b = req.body || {};

  // Administrator login (role "admin"): password from .env (ADMIN_PASSWORD).
  if (b.role === "admin") {
    if (loginLocked("admin")) return fail(res, 429, "Too many wrong passwords - try again in 10 minutes.");
    if (String(b.password || "") !== ADMIN_PASSWORD) {
      noteLoginFail("admin");
      return fail(res, 401, "Incorrect admin password.");
    }
    loginFails.delete("admin");
    const token = createSession("admin", "admin");
    return res.json({ token, role: "admin", record: { name: "Administrator" } });
  }

  const role = ROLE_TABLE[b.role] ? b.role : null;
  if (!role) return fail(res, 400, "Unknown account type.");
  const key = role + ":" + String(b.id || "").trim().toLowerCase();
  if (loginLocked(key)) return fail(res, 429, "Too many wrong passwords for this account - try again in 10 minutes.");
  const rec = getRecord(role, b.id);
  if (!rec || !checkPassword(b.password || "", rec.passwordHash)) {
    noteLoginFail(key);
    return fail(res, 401, role === "donor"
      ? "Wrong phone/email or password. If you registered before this site had passwords, please register again on the Donate page."
      : "Incorrect email or password.");
  }
  loginFails.delete(key);
  refreshSub(role, rec);
  const token = createSession(role, rec[ROLE_KEY[role]]);
  res.json({ token, role, record: publicView(rec) });
});

/* Change your own password (any logged-in donor / hospital / pharmacy).
   Requires the current password; logs out every other device. */
app.post("/api/auth/change-password", (req, res) => {
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Log in first.");
  if (a.role === "admin") return fail(res, 400, "The admin password is set in the server's .env file (ADMIN_PASSWORD), not here.");
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) return fail(res, 400, "Please choose a new password of at least 4 characters.");
  if (!checkPassword(currentPassword || "", a.record.passwordHash)) return fail(res, 401, "Your current password is incorrect.");
  a.record.passwordHash = hashPassword(newPassword);
  putRecord(a.role, a.record);
  // Keep this session, log out all others (e.g. a stolen or shared login).
  const id = a.role === "donor" ? a.record.contact : a.record.email;
  db.prepare("DELETE FROM sessions WHERE role = ? AND id = ? AND token <> ?").run(a.role, id, a.token);
  res.json({ ok: true });
});

app.post("/api/auth/logout", (req, res) => {
  const s = sessionFor(req);
  if (s) db.prepare("DELETE FROM sessions WHERE token = ?").run(s.token);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Not logged in.");
  if (a.role !== "admin") refreshSub(a.role, a.record);
  const record = publicView(a.record);
  if (a.role === "hospital" || a.role === "pharmacy") {
    record.trialDaysLeft = trialDaysLeft(a.record);
    record.access = hasAccess(a.record);
  }
  res.json({ role: a.role, record });
});

/* Update own profile (bio, avatar, contact details, location). */
app.put("/api/profile", (req, res) => {
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Not logged in.");
  const allowed = a.role === "donor"
    ? ["bio", "avatarUrl", "city", "lat", "lng", "lastDonation", "donations", "screeningUrl", "screeningName", "fullName", "age", "bloodGroup"]
    : ["bio", "avatarUrl", "city", "lat", "lng", "phone", "name"];
  for (const k of allowed) if (k in req.body) a.record[k] = req.body[k];
  if (a.role === "donor" && req.body.screeningUrl) a.record.verificationStatus = "pending";
  putRecord(a.role, a.record);
  res.json({ record: publicView(a.record) });
});

/* Record "I donated today" for the logged-in donor. */
app.post("/api/donations", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "donor") return fail(res, 401, "Log in as a donor first.");
  const today = new Date().toISOString().slice(0, 10);
  a.record.donations = a.record.donations || [];
  a.record.donations.unshift({ date: today, place: a.record.city || "" });
  a.record.lastDonation = today;
  putRecord("donor", a.record);
  res.json({ record: publicView(a.record) });
});

/* ============================================================
   FILE UPLOADS
   - kind "avatar": public (shown in <img> tags all over the site).
   - kind "screening" / "prescription": MEDICAL documents. Stored in a
     private folder and served only through /api/docs/<file> with an
     access check (see below) - never publicly.
   ============================================================ */
const PRIVATE_DIR = path.join(DATA_DIR, "private_uploads");
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR);

const UPLOAD_KINDS = ["avatar", "screening", "prescription"];
const UPLOAD_TYPES = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf" };
const EXT_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" };

/* True file-type check: the first bytes of the file must match the
   claimed type, so a renamed/mislabelled file is rejected even if the
   browser lied about its MIME type. */
function sniffType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  return null;
}

app.post("/api/upload", (req, res) => {
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Log in first to upload a file.");
  const { dataUrl, name } = req.body || {};
  const kind = UPLOAD_KINDS.indexOf(req.body.kind) >= 0 ? req.body.kind : "avatar";
  const m = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) return fail(res, 400, "Invalid file upload.");
  const ext = UPLOAD_TYPES[m[1]];
  if (!ext) return fail(res, 400, "Only PNG, JPG, WEBP or PDF files are accepted.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 5 * 1024 * 1024) return fail(res, 400, "File is larger than 5 MB.");

  // The actual file content must match the claimed type.
  const realType = sniffType(buf);
  if (realType !== m[1]) {
    return fail(res, 400, "The file's content does not match its type - please upload a genuine PDF, PNG, JPG or WEBP file.");
  }

  const ownerId = a.role === "donor" ? a.record.contact : a.record.email;
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const isMedical = kind !== "avatar";

  // Duplicate detection: the exact same medical document uploaded by a
  // DIFFERENT account is suspicious (borrowed/reused certificates).
  let docStatus = isMedical ? "pending" : null;
  let docNote = "";
  if (isMedical) {
    const dup = db.prepare("SELECT file, ownerRole, ownerId FROM uploads WHERE hash = ? AND kind = ? AND ownerId <> ?")
      .get(hash, kind, ownerId);
    if (dup) {
      docStatus = "needs-review";
      docNote = "This exact file was already uploaded by a different account (" + dup.ownerId + ").";
      notifyAdmin({ type: "document", title: "Suspicious " + kind + " upload",
        body: ownerId + " uploaded a file identical to one from " + dup.ownerId + ". Review it in the admin panel.",
        link: "dashboard.html" });
    }
  }

  const fname = crypto.randomBytes(16).toString("hex") + ext;
  fs.writeFileSync(path.join(isMedical ? PRIVATE_DIR : UPLOAD_DIR, fname), buf);
  db.prepare("INSERT INTO uploads (file, kind, ownerRole, ownerId, createdOn, hash, docStatus, docNote, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(fname, kind, a.role, ownerId, new Date().toISOString(), hash, docStatus, docNote, String(name || fname).slice(0, 120));

  // AI-assisted plausibility check for medical documents (runs in the
  // background so the upload response stays fast). Its verdict is a
  // FLAG for humans, never absolute proof.
  if (isMedical && docStatus === "pending") {
    aiVerifyDocument(fname, kind, m[1], m[2]).catch(e => console.error("AI document check failed:", e.message));
  }

  res.json({ url: isMedical ? "/api/docs/" + fname : "/uploads/" + fname, name: name || fname });
});

/* Ask the AI whether the uploaded file plausibly looks like the expected
   document type. Sets docStatus to "ai-passed" or "needs-review"; any
   error leaves it "pending" for normal human review. */
async function aiVerifyDocument(fname, kind, mediaType, base64) {
  if (!GEMINI_KEY && !anthropic) return;
  const expected = kind === "screening"
    ? "a blood screening / laboratory blood test certificate"
    : "a doctor's medical prescription";
  const instruction =
    "You are screening an upload for a health platform. The uploader claims this is " + expected + ". " +
    "Judge only whether the document PLAUSIBLY matches that type and is readable. Do not try to verify medical facts. " +
    'Reply with ONLY this JSON: {"matches_type": true|false, "readable": true|false, "concerns": "<one short sentence, empty if none>"}';

  let text;
  if (GEMINI_KEY) {
    // Gemini reads images and PDFs the same way: inline base64 data.
    text = await geminiGenerate("You screen document uploads and reply with strict JSON only.", [{
      role: "user",
      parts: [{ inline_data: { mime_type: mediaType, data: base64 } }, { text: instruction }]
    }], 300);
  } else {
    const filePart = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 300, // a short structured verdict
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: [filePart, { type: "text", text: instruction }] }]
    });
    if (response.stop_reason === "refusal") return;
    text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  }
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (!jsonMatch) return;
  let verdict;
  try { verdict = JSON.parse(jsonMatch[0]); } catch (e) { return; }
  const ok = verdict.matches_type === true && verdict.readable !== false;
  const status = ok ? "ai-passed" : "needs-review";
  const note = ok ? "AI check: looks consistent with " + expected + "." : ("AI check: " + (verdict.concerns || "does not look like " + expected + "."));
  db.prepare("UPDATE uploads SET docStatus = ?, docNote = ? WHERE file = ? AND docStatus = 'pending'")
    .run(status, note, fname);
  if (!ok) {
    const row = db.prepare("SELECT ownerId, kind FROM uploads WHERE file = ?").get(fname);
    notifyAdmin({ type: "document", title: "Document flagged by AI check",
      body: "A " + (row ? row.kind : kind) + " uploaded by " + (row ? row.ownerId : "?") + " was flagged: " + note + " Review it in the admin panel.",
      link: "dashboard.html" });
  }
}

/* Serve a private medical document - with an access check.
   Screening certificates: the donor who owns it + hospital accounts + admin.
   Prescriptions: the buyer who owns it + pharmacy accounts + admin.
   The session token may come as ?token=... because plain links/tabs
   cannot send an Authorization header. */
app.get("/api/docs/:file", (req, res) => {
  const fname = path.basename(req.params.file);
  const meta = db.prepare("SELECT kind, ownerRole, ownerId FROM uploads WHERE file = ?").get(fname);
  const filePath = path.join(PRIVATE_DIR, fname);
  if (!meta || !fs.existsSync(filePath)) return fail(res, 404, "Document not found.");
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Log in to view this document.");
  const ownerId = a.role === "donor" ? a.record.contact : a.role === "admin" ? "admin" : a.record.email;
  const isOwner = a.role === meta.ownerRole && ownerId === meta.ownerId;
  const allowed = a.role === "admin" || isOwner ||
    (meta.kind === "screening" && a.role === "hospital") ||
    (meta.kind === "prescription" && a.role === "pharmacy");
  if (!allowed) return fail(res, 403, "You do not have access to this document.");
  res.setHeader("Content-Type", EXT_TYPES[path.extname(fname)] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

/* ============================================================
   DONORS (directory + verification by hospitals)
   ============================================================ */
/* Donor privacy: exact contact details and precise coordinates are only
   returned to hospital accounts (and the admin). Everyone else gets the
   name, blood group, city and a ~1 km rounded position for the map. */
app.get("/api/donors", (req, res) => {
  const a = accountFor(req);
  const trusted = !!(a && (a.role === "hospital" || a.role === "admin"));
  const round = v => typeof v === "number" ? Math.round(v * 100) / 100 : v;
  const list = allRecords("donor").map(d => ({
    fullName: d.fullName, bloodGroup: d.bloodGroup, city: d.city,
    contact: trusted ? d.contact : null,
    lat: trusted ? d.lat : round(d.lat), lng: trusted ? d.lng : round(d.lng),
    verificationStatus: d.verificationStatus, avatarUrl: d.avatarUrl
  }));
  res.json(list);
});

app.get("/api/donors/pending", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "hospital") return fail(res, 403, "Only hospital accounts can review verifications.");
  res.json(allRecords("donor").filter(d => d.verificationStatus === "pending").map(d => {
    const view = publicView(d);
    // Attach the AI/admin check status of the uploaded certificate so
    // the hospital sees flagged documents at a glance.
    if (d.screeningUrl && d.screeningUrl.indexOf("/api/docs/") === 0) {
      const row = db.prepare("SELECT docStatus, docNote FROM uploads WHERE file = ?")
        .get(path.basename(d.screeningUrl));
      if (row) { view.docStatus = row.docStatus; view.docNote = row.docNote; }
    }
    return view;
  }));
});

app.post("/api/donors/:contact/verification", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "hospital") return fail(res, 403, "Only hospital accounts can verify donors.");
  const donor = getRecord("donor", req.params.contact);
  if (!donor) return fail(res, 404, "Donor not found.");
  const status = req.body.status === "approved" ? "approved" : "rejected";
  donor.verificationStatus = status;
  donor.verifiedBy = a.record.name;
  donor.verifiedOn = new Date().toISOString();
  donor.verificationNote = req.body.note || "";
  putRecord("donor", donor);
  notify("donor", donor.contact, status === "approved"
    ? { type: "verification", title: "You are verified!", body: "Your screening certificate was approved by " + a.record.name + ". Your profile now shows the Verified badge.", link: "dashboard.html" }
    : { type: "verification", title: "Verification rejected", body: (donor.verificationNote || "Your certificate could not be confirmed.") + " You can upload a new certificate from your profile.", link: "dashboard.html" });
  res.json({ record: publicView(donor) });
});

/* ============================================================
   HOSPITALS & PHARMACIES (public lists)
   ============================================================ */

/* Registered hospital accounts. RULE: a signed-in DONOR is only shown
   hospitals with an active subscription - everyone else sees all. */
app.get("/api/hospitals", (req, res) => {
  const a = accountFor(req);
  // Unapproved (not yet vetted) hospitals never appear in public lists.
  let list = allRecords("hospital").map(h => refreshSub("hospital", h)).filter(h => h.approved !== false);
  const donorView = !!(a && a.role === "donor");
  // Donors only see organisations with paid access OR an active trial.
  if (donorView) list = list.filter(hasAccess);
  res.json({
    donorView,
    hospitals: list.map(h => ({
      name: h.name, email: h.email, phone: h.phone, city: h.city, lat: h.lat, lng: h.lng,
      subscriptionPlan: h.subscriptionPlan, subscriptionStatus: h.subscriptionStatus, avatarUrl: h.avatarUrl,
      access: hasAccess(h), trial: trialActive(h)
    }))
  });
});

app.get("/api/pharmacies", (req, res) => {
  res.json(allRecords("pharmacy").map(p => refreshSub("pharmacy", p)).filter(p => p.approved !== false).map(p => ({
    name: p.name, email: p.email, phone: p.phone, city: p.city, lat: p.lat, lng: p.lng,
    subscriptionPlan: p.subscriptionPlan, subscriptionStatus: p.subscriptionStatus, avatarUrl: p.avatarUrl,
    access: hasAccess(p), trial: trialActive(p)
  })));
});

/* ============================================================
   BLOOD REQUESTS - hospitals only (server-enforced)
   ============================================================ */
/* Requests and donation offers older than 30 days are ARCHIVED (soft
   delete - kept in the database for auditing, hidden from the public
   board and all API responses). Runs from the scheduled sweep AND on
   every read, so nothing expired can ever leak out. */
function archiveExpired() {
  const now = Date.now();
  for (const table of ["requests", "offers"]) {
    for (const row of db.prepare(`SELECT id, json FROM ${table}`).all()) {
      const r = JSON.parse(row.json);
      if (!r.archived && now - new Date(r.createdOn).getTime() >= REQUEST_MAX_MS) {
        r.archived = true;
        r.archivedOn = new Date().toISOString();
        db.prepare(`UPDATE ${table} SET json = ? WHERE id = ?`).run(JSON.stringify(r), row.id);
      }
    }
  }
}

app.get("/api/requests", (req, res) => {
  archiveExpired();
  res.json(db.prepare("SELECT json FROM requests").all().map(r => JSON.parse(r.json)).filter(r => !r.archived));
});

app.post("/api/requests", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "hospital") {
    return fail(res, 403, "Only hospital accounts can post blood requests. Individuals cannot request blood - please contact your nearest hospital.");
  }
  if (a.record.approved === false) {
    return fail(res, 403, "Your hospital account is still awaiting approval by the site administrator. You will be able to post blood requests once it is approved.");
  }
  refreshSub("hospital", a.record);
  if (!hasAccess(a.record)) {
    return fail(res, 402, "Your hospital's free trial or subscription has ended. Choose a plan on the Subscribe page to post blood requests.");
  }
  const b = req.body || {};
  if (!b.bloodGroup || !b.place || String(b.place).length < 2) {
    return fail(res, 400, "Please fill in the blood group needed and the location.");
  }
  const request = {
    id: "req-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
    requesterName: a.record.name,
    hospitalEmail: a.record.email,
    contact: b.contact || a.record.phone || a.record.email,
    patient: b.patient || "",
    bloodGroup: b.bloodGroup,
    units: b.units || null,
    place: b.place,
    lat: typeof b.lat === "number" ? b.lat : null,
    lng: typeof b.lng === "number" ? b.lng : null,
    urgency: b.urgency || "Normal",
    note: b.note || "",
    status: "open", bookedBy: null, bookedOn: null,
    postedByRole: "hospital",
    createdOn: new Date().toISOString()
  };
  db.prepare("INSERT INTO requests (id, json) VALUES (?, ?)").run(request.id, JSON.stringify(request));
  res.json(request);
});

/* Which recipient groups each donor group can safely give to. */
const CAN_GIVE_TO = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"]
};

app.post("/api/requests/:id/book", (req, res) => {
  const a = accountFor(req);
  if (!a) return fail(res, 401, "Log in as a donor or hospital to book a request.");
  const row = db.prepare("SELECT json FROM requests WHERE id = ?").get(req.params.id);
  if (!row) return fail(res, 404, "Request not found.");
  const r = JSON.parse(row.json);
  if (r.status !== "open") return fail(res, 409, "This request has already been booked.");
  // A donor with a known blood group can only book requests their blood can help.
  const donorGives = a.role === "donor" ? CAN_GIVE_TO[a.record.bloodGroup] : null;
  if (donorGives && r.bloodGroup && r.bloodGroup !== "Any compatible" && donorGives.indexOf(r.bloodGroup) < 0) {
    const compatibleDonors = Object.keys(CAN_GIVE_TO).filter(g => CAN_GIVE_TO[g].indexOf(r.bloodGroup) >= 0).join(", ");
    return fail(res, 409, "Your blood group (" + a.record.bloodGroup + ") is not compatible with this request (needs " +
      r.bloodGroup + ", which can receive from: " + compatibleDonors + ").");
  }
  r.status = "booked";
  r.bookedBy = a.role === "donor" ? a.record.fullName : a.record.name;
  r.bookedOn = new Date().toISOString();
  db.prepare("UPDATE requests SET json = ? WHERE id = ?").run(JSON.stringify(r), r.id);
  if (r.hospitalEmail) notify("hospital", r.hospitalEmail, {
    type: "request", title: "Your blood request was booked",
    body: r.bookedBy + " booked your request for " + r.bloodGroup + " (" + (r.units || "?") + " unit(s)) at " + r.place + ".",
    link: "dashboard.html"
  });
  res.json(r);
});

app.delete("/api/requests/:id", (req, res) => {
  const a = accountFor(req);
  const row = db.prepare("SELECT json FROM requests WHERE id = ?").get(req.params.id);
  if (!row) return fail(res, 404, "Request not found.");
  const r = JSON.parse(row.json);
  if (!a || a.role !== "hospital" || a.record.email !== r.hospitalEmail) {
    return fail(res, 403, "Only the hospital that posted a request can remove it.");
  }
  db.prepare("DELETE FROM requests WHERE id = ?").run(r.id);
  res.json({ ok: true });
});

/* ============================================================
   MEDICINES, STOCK, ORDERS (with prescription enforcement)
   ============================================================ */
app.get("/api/medicines", (req, res) => res.json(DATA.MEDICINES));

app.get("/api/stock", (req, res) => {
  res.json(db.prepare("SELECT pharmacyEmail, medicineId, qty FROM stock").all());
});

app.put("/api/stock", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "pharmacy") return fail(res, 403, "Only pharmacy accounts can update stock.");
  refreshSub("pharmacy", a.record);
  if (!hasAccess(a.record)) return fail(res, 402, "Your free trial or subscription has ended - an active subscription is needed to list medicines.");
  const { medicineId, qty } = req.body || {};
  if (!DATA.MEDICINES.find(m => m.id === medicineId)) return fail(res, 400, "Unknown medicine.");
  db.prepare(`INSERT INTO stock (pharmacyEmail, medicineId, qty) VALUES (?, ?, ?)
              ON CONFLICT(pharmacyEmail, medicineId) DO UPDATE SET qty = excluded.qty`)
    .run(a.record.email, medicineId, Math.max(0, parseInt(qty, 10) || 0));
  res.json({ ok: true });
});

function getStockQty(pharmacyEmail, medicineId) {
  const row = db.prepare("SELECT qty FROM stock WHERE pharmacyEmail = ? AND medicineId = ?")
    .get(pharmacyEmail, medicineId);
  return row ? row.qty : 0;
}

/* Validates an order and returns {med, pharmacy, total} or an error string. */
function validateOrder(b) {
  const med = DATA.MEDICINES.find(m => m.id === b.medicineId);
  if (!med) return "Unknown medicine.";
  const pharmacy = getRecord("pharmacy", b.pharmacyEmail);
  if (!pharmacy) return "Unknown pharmacy.";
  const qty = parseInt(b.qty, 10);
  if (!(qty >= 1 && qty <= 50)) return "Quantity must be between 1 and 50.";
  if (getStockQty(pharmacy.email, med.id) < qty) return "Not enough stock at that pharmacy.";
  if (med.rx && !b.prescriptionUrl) {
    return med.name + " is a prescription medicine - please upload your doctor's prescription first.";
  }
  return { med, pharmacy, qty, total: med.price * qty };
}

function placeOrder(v, b, buyer, paymentStatus, rxStatus) {
  db.prepare("UPDATE stock SET qty = MAX(0, qty - ?) WHERE pharmacyEmail = ? AND medicineId = ?")
    .run(v.qty, v.pharmacy.email, v.med.id);
  return insertJson("orders", {
    pharmacyEmail: v.pharmacy.email, pharmacyName: v.pharmacy.name,
    medicineId: v.med.id, medicineName: v.med.name,
    qty: v.qty, unitPrice: v.med.price, total: v.total,
    buyerName: buyer.name, buyerContact: buyer.contact,
    buyerRole: buyer.role, buyerId: buyer.id,
    prescriptionUrl: b.prescriptionUrl || null,
    payment: paymentStatus,
    rxStatus: rxStatus || null, rxNote: "",
    date: new Date().toISOString()
  });
}

/* Orders require a logged-in account, so the pharmacy always has a real
   person to contact and prescriptions are traceable. */
function buyerFrom(req) {
  const a = accountFor(req);
  if (!a || a.role === "admin") return null;
  return {
    role: a.role,
    id: a.role === "donor" ? a.record.contact : a.record.email,
    name: a.role === "donor" ? a.record.fullName : a.record.name,
    contact: a.role === "donor" ? a.record.contact : a.record.email
  };
}

/* Place an order.
   - Non-prescription medicine: reserved immediately (pay at the pharmacy,
     or pay online via /api/payments/initiate kind "order").
   - Prescription medicine: goes to the pharmacist for review first
     (rxStatus "pending"). Payment happens only after approval. */
app.post("/api/orders", (req, res) => {
  const buyer = buyerFrom(req);
  if (!buyer) return fail(res, 401, "Please log in (or register on the Donate page) before ordering, so the pharmacy can reach you.");
  const b = req.body || {};
  const v = validateOrder(b);
  if (typeof v === "string") return fail(res, 400, v);
  const order = v.med.rx
    ? placeOrder(v, b, buyer, "unpaid", "pending")
    : placeOrder(v, b, buyer, "pay-at-pharmacy", null);
  res.json(order);
});

/* The buyer's own orders (shown on their dashboard). */
app.get("/api/my-orders", (req, res) => {
  const buyer = buyerFrom(req);
  if (!buyer) return fail(res, 401, "Log in first.");
  res.json(rowsJson("orders").filter(o => o.buyerRole === buyer.role && o.buyerId === buyer.id));
});

/* The pharmacy's incoming orders. */
app.get("/api/orders", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "pharmacy") return fail(res, 403, "Only pharmacy accounts can see their orders.");
  res.json(rowsJson("orders").filter(o => o.pharmacyEmail === a.record.email));
});

/* Pharmacist reviews the prescription on a pending Rx order. */
app.post("/api/orders/:id/rx-review", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "pharmacy") return fail(res, 403, "Only pharmacy accounts can review prescriptions.");
  const order = rowsJson("orders").find(o => o.id === Number(req.params.id));
  if (!order || order.pharmacyEmail !== a.record.email) return fail(res, 404, "Order not found.");
  if (order.rxStatus !== "pending") return fail(res, 409, "This order has already been reviewed.");
  if (req.body.approve) {
    order.rxStatus = "approved";
    order.payment = "pay-at-pharmacy"; // buyer may also choose to pay online now
  } else {
    order.rxStatus = "rejected";
    order.payment = "cancelled";
    // Put the reserved units back in stock.
    db.prepare(`INSERT INTO stock (pharmacyEmail, medicineId, qty) VALUES (?, ?, ?)
                ON CONFLICT(pharmacyEmail, medicineId) DO UPDATE SET qty = qty + ?`)
      .run(order.pharmacyEmail, order.medicineId, order.qty, order.qty);
  }
  order.rxNote = String(req.body.note || "");
  order.rxReviewedOn = new Date().toISOString();
  db.prepare("UPDATE orders SET json = ? WHERE id = ?").run(JSON.stringify(order), order.id);
  if (order.buyerRole && order.buyerId) notify(order.buyerRole, order.buyerId, order.rxStatus === "approved"
    ? { type: "order", title: "Prescription approved", body: "The pharmacist at " + order.pharmacyName + " approved your prescription for " + order.medicineName + ". You can now pay online from My Account, or pay when you collect it.", link: "dashboard.html" }
    : { type: "order", title: "Prescription rejected", body: "The pharmacist at " + order.pharmacyName + " rejected the prescription for " + order.medicineName + (order.rxNote ? ': "' + order.rxNote + '"' : "."), link: "dashboard.html" });
  res.json(order);
});

/* ============================================================
   DRONE REQUESTS (Premium hospitals)
   Progress is computed from age: queued -> in-flight -> delivered.
   ============================================================ */
function droneStatus(dr) {
  const age = Date.now() - new Date(dr.createdOn).getTime();
  return age < 8000 ? "queued" : age < 25000 ? "in-flight" : "delivered";
}

app.post("/api/drone-requests", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "hospital") return fail(res, 403, "Only hospital accounts can request drone delivery.");
  refreshSub("hospital", a.record);
  // Premium subscribers and trial hospitals (trial = full access) may request drones.
  if (!((a.record.subscriptionPlan === "Premium" && hasActiveSub(a.record)) || trialActive(a.record))) {
    return fail(res, 402, "Drone delivery requests are a Premium feature. Upgrade on the Subscribe page.");
  }
  const b = req.body || {};
  const dr = insertJson("droneRequests", {
    hospitalEmail: a.record.email, hospitalName: a.record.name,
    bloodGroup: b.bloodGroup || "O-",
    units: Math.min(20, Math.max(1, parseInt(b.units, 10) || 1)),
    urgency: b.urgency === "Emergency" ? "Emergency" : "Standard",
    createdOn: new Date().toISOString()
  });
  dr.status = droneStatus(dr);
  res.json(dr);
});

app.get("/api/drone-requests", (req, res) => {
  const a = accountFor(req);
  if (!a || a.role !== "hospital") return fail(res, 403, "Log in as a hospital first.");
  res.json(rowsJson("droneRequests")
    .filter(d => d.hospitalEmail === a.record.email)
    .map(d => Object.assign(d, { status: droneStatus(d) })));
});

/* ============================================================
   FUNDS, FEEDBACK, EMERGENCY LOG
   ============================================================ */
app.get("/api/funds", (req, res) => {
  const donated = rowsJson("funds").reduce((sum, f) => sum + (f.amount || 0), 0);
  res.json({ raised: FUNDS_BASELINE + donated, goal: 10000000 });
});

app.post("/api/feedback", (req, res) => {
  const b = req.body || {};
  if (!b.message || b.message.length < 5) return fail(res, 400, "Please write a short message.");
  insertJson("feedback", { name: b.name || "Anonymous", email: b.email || "", category: b.category || "", message: b.message, createdOn: new Date().toISOString() });
  res.json({ ok: true });
});

app.post("/api/emergency-log", (req, res) => {
  insertJson("emergencyLog", Object.assign({}, req.body, { timestamp: new Date().toISOString() }));
  res.json({ ok: true });
});

/* ============================================================
   DONATION OFFERS (Request Board)
   Anyone may offer to donate blood WITHOUT creating an account -
   this is deliberately separate from account registration. The offer
   appears on the public Request Board and archives after 30 days.
   ============================================================ */
const offerSubmits = new Map(); // basic per-IP rate limiting for the public form
app.post("/api/offers", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?";
  const s = offerSubmits.get(ip) || { count: 0, since: Date.now() };
  if (Date.now() - s.since > 3600000) { s.count = 0; s.since = Date.now(); }
  if (s.count >= 5) return fail(res, 429, "Too many submissions from this connection - please try again later.");
  const b = req.body || {};
  if (!b.fullName || String(b.fullName).trim().length < 2) return fail(res, 400, "Please enter your full name.");
  if (!b.bloodGroup) return fail(res, 400, "Please select your blood group.");
  if (!b.contact || String(b.contact).trim().length < 5) return fail(res, 400, "Please enter a phone number or email so a hospital can reach you.");
  if (!b.city || String(b.city).trim().length < 2) return fail(res, 400, "Please enter your city or area.");
  s.count += 1; offerSubmits.set(ip, s);
  const offer = {
    id: "off-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
    kind: "offer",
    fullName: String(b.fullName).trim(),
    bloodGroup: b.bloodGroup,
    contact: String(b.contact).trim(),
    city: String(b.city).trim(),
    lat: typeof b.lat === "number" ? b.lat : null,
    lng: typeof b.lng === "number" ? b.lng : null,
    note: String(b.note || "").slice(0, 300),
    status: "open",
    createdOn: new Date().toISOString()
  };
  db.prepare("INSERT INTO offers (id, json) VALUES (?, ?)").run(offer.id, JSON.stringify(offer));
  res.json({ ok: true, id: offer.id });
});

/* Board listing. Privacy: the volunteer's contact is only shown to
   hospital accounts (who need to reach them) and the admin. */
app.get("/api/offers", (req, res) => {
  archiveExpired();
  const a = accountFor(req);
  const trusted = !!(a && (a.role === "hospital" || a.role === "admin"));
  res.json(db.prepare("SELECT json FROM offers").all().map(r => JSON.parse(r.json))
    .filter(o => !o.archived)
    .map(o => ({
      id: o.id, kind: "offer", fullName: o.fullName, bloodGroup: o.bloodGroup, city: o.city,
      lat: o.lat, lng: o.lng, note: o.note, status: o.status, createdOn: o.createdOn,
      contact: trusted ? o.contact : null
    })));
});

/* Moderation: the admin can remove an inappropriate offer. */
app.delete("/api/offers/:id", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const row = db.prepare("SELECT json FROM offers WHERE id = ?").get(req.params.id);
  if (!row) return fail(res, 404, "Offer not found.");
  const o = JSON.parse(row.json);
  o.archived = true;
  o.archivedOn = new Date().toISOString();
  o.removedByAdmin = true;
  db.prepare("UPDATE offers SET json = ? WHERE id = ?").run(JSON.stringify(o), o.id);
  audit("offer-removed", { id: o.id, name: o.fullName });
  res.json({ ok: true });
});

/* ============================================================
   NOTIFICATIONS (bell in the header)
   ============================================================ */
app.get("/api/notifications", (req, res) => {
  const s = sessionFor(req);
  if (!s) return fail(res, 401, "Log in first.");
  const mine = rowsJson("notifications")
    .filter(n => n.role === s.role && n.accountId === s.id)
    .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
  res.json({
    unread: mine.filter(n => !n.read).length,
    notifications: mine.slice(0, 50)
  });
});

app.post("/api/notifications/read", (req, res) => {
  const s = sessionFor(req);
  if (!s) return fail(res, 401, "Log in first.");
  const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
  for (const n of rowsJson("notifications")) {
    if (n.role !== s.role || n.accountId !== s.id || n.read) continue;
    if (ids && ids.indexOf(n.id) < 0) continue; // ids omitted = mark ALL read
    n.read = true;
    db.prepare("UPDATE notifications SET json = ? WHERE id = ?").run(JSON.stringify(n), n.id);
  }
  res.json({ ok: true });
});

/* ============================================================
   ADMINISTRATOR (vetting + account recovery)
   Log in from My Account > Admin with the ADMIN_PASSWORD from .env
   (default "admin1234" - change it!).
   ============================================================ */
app.get("/api/admin/accounts", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  res.json({
    hospitals: allRecords("hospital").map(publicView),
    pharmacies: allRecords("pharmacy").map(publicView),
    donors: allRecords("donor").map(publicView)
  });
});

app.post("/api/admin/accounts/:role/:id/approval", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const role = req.params.role;
  if (role !== "hospital" && role !== "pharmacy") return fail(res, 400, "Only hospitals and pharmacies are vetted.");
  const rec = getRecord(role, req.params.id);
  if (!rec) return fail(res, 404, "Account not found.");
  const wasApproved = rec.approved === true;
  rec.approved = !!req.body.approved;
  rec.approvalNote = String(req.body.note || "");
  // First approval starts the 7-day free trial (unless they already paid).
  if (rec.approved && !wasApproved && !rec.trialEnd && !hasActiveSub(rec)) {
    rec.trialStart = new Date().toISOString();
    rec.trialEnd = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  }
  putRecord(role, rec);
  audit("approval", { role, id: rec.email, approved: rec.approved, note: rec.approvalNote });
  notify(role, rec.email, rec.approved
    ? { type: "approval", title: "Your account is approved!",
        body: trialActive(rec)
          ? "Welcome! Your free " + TRIAL_DAYS + "-day trial with full access has started - it ends on " + rec.trialEnd.slice(0, 10) + ". Subscribe any time to continue without interruption."
          : "Welcome! Your account is now active.",
        link: "dashboard.html" }
    : { type: "approval", title: "Your account was not approved",
        body: rec.approvalNote || "Contact the platform administrator for details.", link: "dashboard.html" });
  res.json({ record: publicView(rec) });
});

/* Password recovery: the admin generates a temporary password and gives
   it to the account holder out-of-band (phone/in person). */
app.post("/api/admin/accounts/:role/:id/reset-password", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const role = ROLE_TABLE[req.params.role] ? req.params.role : null;
  if (!role) return fail(res, 400, "Unknown account type.");
  const rec = getRecord(role, req.params.id);
  if (!rec) return fail(res, 404, "Account not found.");
  const temp = "temp-" + crypto.randomBytes(4).toString("hex");
  rec.passwordHash = hashPassword(temp);
  putRecord(role, rec);
  // Log the account out everywhere so only the new password works.
  db.prepare("DELETE FROM sessions WHERE role = ? AND id = ?").run(role, rec[ROLE_KEY[role]]);
  audit("password-reset", { role, id: rec[ROLE_KEY[role]] });
  res.json({ tempPassword: temp });
});

app.get("/api/admin/feedback", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  res.json(rowsJson("feedback"));
});

/* Platform analytics for the admin dashboard. */
app.get("/api/admin/stats", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const hospitals = allRecords("hospital");
  const pharmacies = allRecords("pharmacy");
  const donors = allRecords("donor");
  const orgs = hospitals.concat(pharmacies);
  const soon = Date.now() + 7 * 86400000;
  const docs = db.prepare("SELECT docStatus FROM uploads WHERE kind <> 'avatar'").all();
  res.json({
    donors: donors.length,
    hospitals: hospitals.length,
    pharmacies: pharmacies.length,
    pendingApprovals: orgs.filter(o => o.approved === false).length,
    activeSubscriptions: orgs.filter(hasActiveSub).length,
    onTrial: orgs.filter(o => trialActive(o) && !hasActiveSub(o)).length,
    expiringWithin7Days: orgs.filter(o => hasActiveSub(o) && new Date(o.subscriptionEnd).getTime() < soon).length,
    pendingVerifications: donors.filter(d => d.verificationStatus === "pending").length,
    flaggedDocuments: docs.filter(d => d.docStatus === "needs-review").length,
    openRequests: db.prepare("SELECT json FROM requests").all().map(r => JSON.parse(r.json)).filter(r => !r.archived).length,
    openOffers: db.prepare("SELECT json FROM offers").all().map(o => JSON.parse(o.json)).filter(o => !o.archived).length,
    orders: db.prepare("SELECT COUNT(*) AS c FROM orders").get().c
  });
});

/* Medical document review queue. */
app.get("/api/admin/documents", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const rows = db.prepare("SELECT file, kind, ownerRole, ownerId, createdOn, docStatus, docNote, name FROM uploads WHERE kind <> 'avatar' ORDER BY createdOn DESC LIMIT 100").all();
  res.json(rows.map(r => Object.assign({}, r, { url: "/api/docs/" + r.file })));
});

app.post("/api/admin/documents/:file/review", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  const status = req.body.status === "verified" ? "verified" : "rejected";
  const fname = path.basename(req.params.file);
  const row = db.prepare("SELECT ownerRole, ownerId, kind FROM uploads WHERE file = ?").get(fname);
  if (!row) return fail(res, 404, "Document not found.");
  db.prepare("UPDATE uploads SET docStatus = ?, docNote = ? WHERE file = ?")
    .run(status, "Manual review: " + (req.body.note || status), fname);
  audit("document-review", { file: fname, kind: row.kind, owner: row.ownerId, status, note: req.body.note || "" });
  notify(row.ownerRole, row.ownerId, {
    type: "document",
    title: "Your " + row.kind + " document was " + status,
    body: req.body.note || ("An administrator reviewed your uploaded " + row.kind + " document."),
    link: "dashboard.html"
  });
  res.json({ ok: true });
});

/* Audit trail of admin actions. */
app.get("/api/admin/audit", (req, res) => {
  if (!isAdmin(req)) return fail(res, 403, "Administrator only.");
  res.json(rowsJson("auditLog").slice(-50).reverse());
});

/* ============================================================
   REAL PAYMENTS (Flutterwave - Mobile Money / card, RWF)

   Flow: POST /api/payments/initiate -> we create a payment intent,
   ask Flutterwave for a secure hosted checkout link, and the browser
   is redirected there. Flutterwave sends the customer back to
   /payment/callback, where we VERIFY the transaction server-to-server
   before activating anything. No key configured = clear error, never
   a fake success.
   ============================================================ */
const FLW_API = "https://api.flutterwave.com/v3";

/* ---------------- Paypack (paypack.rw) ----------------
   Rwandan mobile-money payments: we call "cashin" with the customer's
   MTN/Airtel number, they approve the prompt on their phone, and we
   poll the transaction until it is successful or failed. Docs:
   https://docs.paypack.rw  */
const PAYPACK_API = "https://payments.paypack.rw/api";
let _paypackToken = null;
let _paypackTokenAt = 0;

async function paypackToken() {
  // Tokens last ~15 minutes; re-authorise after 10 to stay safe.
  if (_paypackToken && Date.now() - _paypackTokenAt < 10 * 60 * 1000) return _paypackToken;
  const res = await fetch(PAYPACK_API + "/auth/agents/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ client_id: PAYPACK_CLIENT_ID, client_secret: PAYPACK_CLIENT_SECRET })
  });
  const data = await res.json();
  if (!res.ok || !data.access) {
    console.error("Paypack auth failed:", data.message || res.status);
    throw new Error("Could not connect to the payment provider.");
  }
  _paypackToken = data.access;
  _paypackTokenAt = Date.now();
  return _paypackToken;
}

async function paypackFetch(method, pathPart, body) {
  const token = await paypackToken();
  const res = await fetch(PAYPACK_API + pathPart, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Webhook-Mode": PAYPACK_MODE
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || ("Payment provider error " + res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

/* Accepts 078..., +250 78..., 25078... and returns 07XXXXXXXX (or null). */
function normalizeRwPhone(raw) {
  let p = String(raw || "").replace(/[^\d]/g, "");
  if (p.length === 12 && p.indexOf("250") === 0) p = "0" + p.slice(3);
  if (p.length === 9 && p[0] === "7") p = "0" + p;
  return /^07\d{8}$/.test(p) ? p : null;
}

app.get("/api/payments/config", (req, res) => {
  res.json({ configured: !!PAY_PROVIDER, provider: PAY_PROVIDER });
});

app.post("/api/payments/initiate", async (req, res) => {
  const b = req.body || {};
  const a = accountFor(req);
  let intent; // what to do once the money is verified

  if (b.kind === "subscription") {
    if (!a || (a.role !== "hospital" && a.role !== "pharmacy")) {
      return fail(res, 401, "Log in (or register) as a hospital or pharmacy first - the plan is activated on your account after payment.");
    }
    if (a.record.approved === false) {
      return fail(res, 403, "Your " + a.role + " account is still awaiting approval by the site administrator. No payment can be taken until it is approved.");
    }
    const price = (DATA.PLAN_PRICES[a.role] || {})[b.plan];
    if (!price) return fail(res, 400, "Unknown plan.");
    intent = { kind: "subscription", role: a.role, accountId: a.record.email, plan: b.plan,
               amount: price, returnPage: "/subscribe.html", label: b.plan + " plan - " + a.record.name };
  } else if (b.kind === "order") {
    // Direct online purchase - non-prescription medicines only. Prescription
    // medicines must first be approved by the pharmacist (see /api/orders).
    const buyer = buyerFrom(req);
    if (!buyer) return fail(res, 401, "Please log in before paying, so the pharmacy can reach you about your order.");
    const v = validateOrder(b);
    if (typeof v === "string") return fail(res, 400, v);
    if (v.med.rx) return fail(res, 400, v.med.name + " is a prescription medicine - send the order for pharmacist review first; you can pay once it is approved (from My Account).");
    intent = { kind: "order", order: b, buyer, amount: v.total, returnPage: "/medicines.html",
               label: v.qty + " x " + v.med.name + " (" + v.pharmacy.name + ")" };
  } else if (b.kind === "order-payment") {
    // Paying for an existing order of yours (e.g. an approved Rx order).
    const buyer = buyerFrom(req);
    if (!buyer) return fail(res, 401, "Log in first.");
    const order = rowsJson("orders").find(o => o.id === Number(b.orderId));
    if (!order || order.buyerRole !== buyer.role || order.buyerId !== buyer.id) return fail(res, 404, "Order not found.");
    if (order.payment === "paid-online") return fail(res, 409, "This order is already paid.");
    if (order.rxStatus === "pending") return fail(res, 409, "The pharmacist has not approved the prescription yet.");
    if (order.rxStatus === "rejected") return fail(res, 409, "This order was rejected by the pharmacist.");
    intent = { kind: "order-payment", orderId: order.id, amount: order.total, returnPage: "/dashboard.html",
               label: order.qty + " x " + order.medicineName + " (" + order.pharmacyName + ")" };
  } else if (b.kind === "fund") {
    const amount = parseInt(b.amount, 10);
    if (!(amount >= 500)) return fail(res, 400, "Please enter an amount of at least RWF 500.");
    intent = { kind: "fund", amount, donorName: b.name || "Anonymous", returnPage: "/services.html#funds",
               label: "Donation to blood services" };
  } else {
    return fail(res, 400, "Unknown payment type.");
  }

  // Everything about the request is valid - now the provider must be configured.
  if (!PAY_PROVIDER) {
    return res.status(503).json({
      configured: false,
      error: "Online payment is not configured yet. The site owner must add Paypack keys (PAYPACK_CLIENT_ID / PAYPACK_CLIENT_SECRET) or a Flutterwave key to the .env file (see .env.example). No payment was taken."
    });
  }

  const txRef = "bdc-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");

  if (PAY_PROVIDER === "paypack") {
    // Mobile-money push: the customer approves the prompt on their phone.
    const phone = normalizeRwPhone(b.phone);
    if (!phone) return fail(res, 400, "Please enter a valid Rwandan Mobile Money number (e.g. 078xxxxxxx).");
    try {
      const t = await paypackFetch("POST", "/transactions/cashin", { amount: intent.amount, number: phone });
      db.prepare("INSERT INTO payments (txRef, json) VALUES (?, ?)").run(txRef, JSON.stringify(Object.assign({
        status: "pending", provider: "paypack", providerRef: t.ref, phone,
        createdOn: new Date().toISOString()
      }, intent)));
      return res.json({ provider: "paypack", txRef, status: "pending",
        message: "Approve the Mobile Money prompt on " + phone + " to complete the payment of RWF " + intent.amount.toLocaleString("en-US") + "." });
    } catch (e) {
      console.error("Paypack cashin error:", e.message);
      return fail(res, 502, "The payment provider rejected the request: " + e.message);
    }
  }

  // Flutterwave hosted checkout (redirect) - the alternative provider.
  db.prepare("INSERT INTO payments (txRef, json) VALUES (?, ?)")
    .run(txRef, JSON.stringify(Object.assign({ status: "pending", provider: "flutterwave", createdOn: new Date().toISOString() }, intent)));
  try {
    const flwRes = await fetch(FLW_API + "/payments", {
      method: "POST",
      headers: { Authorization: "Bearer " + FLW_SECRET_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: intent.amount,
        currency: "RWF",
        redirect_url: PUBLIC_URL + "/payment/callback",
        customer: {
          email: (a && a.record.email) || b.email || "customer@example.com",
          name: (a && (a.record.name || a.record.fullName)) || b.name || "Customer"
        },
        customizations: { title: "Rwanda Blood Donation Centre", description: intent.label }
      })
    });
    const data = await flwRes.json();
    if (data.status !== "success" || !data.data || !data.data.link) {
      console.error("Flutterwave initiate failed:", data);
      return fail(res, 502, "The payment provider rejected the request: " + (data.message || "unknown error"));
    }
    res.json({ provider: "flutterwave", link: data.data.link, txRef });
  } catch (e) {
    console.error("Flutterwave initiate error:", e);
    fail(res, 502, "Could not reach the payment provider. Please try again.");
  }
});

/* Check one Paypack payment with the provider and settle it if the money
   is confirmed - idempotent. Returns "success" | "failed" | "pending". */
async function settlePaypack(txRef) {
  const row = db.prepare("SELECT json FROM payments WHERE txRef = ?").get(txRef);
  if (!row) return "failed";
  const intent = JSON.parse(row.json);
  if (intent.status === "verified") return "success";
  if (intent.status === "failed") return "failed";
  if (intent.provider !== "paypack" || !intent.providerRef) return "pending";
  const t = await paypackFetch("GET", "/transactions/find/" + encodeURIComponent(intent.providerRef));
  const st = String(t.status || "").toLowerCase();
  if (st === "successful" || st === "success") {
    applyIntent(intent);
    intent.status = "verified";
    db.prepare("UPDATE payments SET json = ? WHERE txRef = ?").run(JSON.stringify(intent), txRef);
    return "success";
  }
  if (st === "failed" || st === "cancelled") {
    intent.status = "failed";
    db.prepare("UPDATE payments SET json = ? WHERE txRef = ?").run(JSON.stringify(intent), txRef);
    return "failed";
  }
  return "pending";
}

/* Poll the status of a payment started with Paypack. Settlement (the
   actual activation of what was paid for) happens server-side only
   after the provider confirms the money. */
app.get("/api/payments/status/:txRef", async (req, res) => {
  const row = db.prepare("SELECT json FROM payments WHERE txRef = ?").get(req.params.txRef);
  if (!row) return fail(res, 404, "Unknown payment.");
  try {
    res.json({ status: await settlePaypack(req.params.txRef) });
  } catch (e) {
    console.error("Paypack status error:", e.message);
    res.json({ status: "pending" }); // transient - the client keeps polling
  }
});

/* Safety net: if a customer paid but closed the browser before polling
   finished, the hourly sweep settles their pending payment anyway. */
async function checkPendingPaypack() {
  if (PAY_PROVIDER !== "paypack") return;
  const dayAgo = Date.now() - 24 * 3600000;
  for (const row of db.prepare("SELECT txRef, json FROM payments").all()) {
    const p = JSON.parse(row.json);
    if (p.provider === "paypack" && p.status === "pending" && new Date(p.createdOn).getTime() > dayAgo) {
      try { await settlePaypack(row.txRef); } catch (e) { /* try again next sweep */ }
    }
  }
}

/* Apply what a VERIFIED payment paid for (subscription / order / fund)
   and send the matching notifications. Shared by every payment provider.
   Callers must have confirmed the money server-side first. */
function applyIntent(intent) {
  if (intent.kind === "subscription") {
    const rec = getRecord(intent.role, intent.accountId);
    if (rec) {
      Object.assign(rec, { subscriptionPlan: intent.plan }, subWindow());
      putRecord(intent.role, rec);
      notify(intent.role, intent.accountId, {
        type: "payment", title: "Payment received - " + intent.plan + " plan active",
        body: "RWF " + intent.amount.toLocaleString("en-US") + " received and verified. Your " + intent.plan +
          " plan is active until " + rec.subscriptionEnd.slice(0, 10) + ".",
        link: "subscribe.html"
      });
    }
  } else if (intent.kind === "order") {
    const val = validateOrder(intent.order);
    if (typeof val !== "string") placeOrder(val, intent.order, intent.buyer, "paid-online", null);
    else insertJson("orders", Object.assign({ payment: "paid-online-needs-review", note: val, date: new Date().toISOString() }, intent.order, intent.buyer));
  } else if (intent.kind === "order-payment") {
    const order = rowsJson("orders").find(o => o.id === intent.orderId);
    if (order) {
      order.payment = "paid-online";
      db.prepare("UPDATE orders SET json = ? WHERE id = ?").run(JSON.stringify(order), order.id);
      if (order.buyerRole && order.buyerId) notify(order.buyerRole, order.buyerId, {
        type: "payment", title: "Order paid",
        body: "Payment of RWF " + intent.amount.toLocaleString("en-US") + " for " + order.medicineName + " was received and verified. Collect it at " + order.pharmacyName + ".",
        link: "dashboard.html"
      });
      notify("pharmacy", order.pharmacyEmail, {
        type: "payment", title: "Order paid online",
        body: order.buyerName + " paid RWF " + intent.amount.toLocaleString("en-US") + " online for " + order.qty + " x " + order.medicineName + ".",
        link: "dashboard.html"
      });
    }
  } else if (intent.kind === "fund") {
    insertJson("funds", { amount: intent.amount, name: intent.donorName, date: new Date().toISOString() });
  }
}

/* Verify a transaction with Flutterwave (server-to-server) and, if the
   money is really there, apply what was paid for. Idempotent: a payment
   that was already settled is never applied twice. Called from BOTH the
   browser redirect (/payment/callback) and the webhook, so a customer
   who closes the browser after paying still gets what they paid for.
   Returns "success", "failed", or "unknown". */
async function settlePayment(txRef, transactionId) {
  const row = db.prepare("SELECT json FROM payments WHERE txRef = ?").get(txRef || "");
  if (!row) return "unknown";
  const intent = JSON.parse(row.json);
  if (intent.status === "verified") return "success"; // already settled

  const vRes = await fetch(FLW_API + "/transactions/" + encodeURIComponent(transactionId) + "/verify", {
    headers: { Authorization: "Bearer " + FLW_SECRET_KEY }
  });
  const v = await vRes.json();
  const t = v.data || {};
  const ok = v.status === "success" && t.status === "successful" &&
             t.tx_ref === txRef && t.currency === "RWF" && Number(t.amount) >= intent.amount;
  if (!ok) { console.error("Payment verification failed for", txRef, ":", v.message || v.status); return "failed"; }

  applyIntent(intent);
  intent.status = "verified";
  intent.transactionId = transactionId;
  db.prepare("UPDATE payments SET json = ? WHERE txRef = ?").run(JSON.stringify(intent), txRef);
  return "success";
}

/* Flutterwave sends the customer back here after checkout. */
app.get("/payment/callback", async (req, res) => {
  const { status, tx_ref, transaction_id } = req.query;
  const row = db.prepare("SELECT json FROM payments WHERE txRef = ?").get(tx_ref || "");
  const intent = row ? JSON.parse(row.json) : null;
  const backTo = (intent && intent.returnPage) || "/";
  function done(result) {
    const [pagePath, hash] = backTo.split("#");
    res.redirect(pagePath + "?payment=" + result + (hash ? "#" + hash : ""));
  }
  if (!intent) return done("failed");
  if (status !== "successful" || !transaction_id) {
    if (intent.status === "verified") return done("success");
    return done(status === "cancelled" ? "cancelled" : "failed");
  }
  try {
    done(await settlePayment(tx_ref, transaction_id) === "success" ? "success" : "failed");
  } catch (e) {
    console.error("Payment verify error:", e);
    done("failed");
  }
});

/* Flutterwave webhook: fires even if the customer never comes back to the
   site (closed the tab mid-payment). Configure it in the Flutterwave
   dashboard - Settings > Webhooks - with URL <your site>/api/payments/webhook
   and a secret hash, and put that same hash in .env as FLW_WEBHOOK_HASH. */
app.post("/api/payments/webhook", async (req, res) => {
  if (!FLW_WEBHOOK_HASH || req.headers["verif-hash"] !== FLW_WEBHOOK_HASH) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }
  const d = (req.body && req.body.data) || req.body || {};
  const txRef = d.tx_ref || d.txRef;
  const transactionId = d.id;
  if (txRef && transactionId && (d.status === "successful" || req.body.event === "charge.completed")) {
    try { await settlePayment(txRef, transactionId); }
    catch (e) { console.error("Webhook settle error:", e); }
  }
  res.json({ ok: true }); // always 200 so Flutterwave stops retrying
});

/* ============================================================
   REAL AI - Quick Help chat + document checks.
   Provider: Google Gemini (FREE tier - key from aistudio.google.com)
   when GEMINI_API_KEY is set; otherwise Anthropic Claude when
   ANTHROPIC_API_KEY is set; otherwise the client falls back to the
   built-in offline helper. Keys never leave the server.
   ============================================================ */
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
let geminiModels = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];

/* Ask Google which models this key can use and keep a RANKED LIST of
   free Flash models - if the best one is overloaded ("high demand"),
   we automatically fall through to the next. */
async function discoverGeminiModels() {
  if (!GEMINI_KEY || geminiModels.length) return;
  try {
    const res = await fetch(GEMINI_BASE + "/models?pageSize=100&key=" + encodeURIComponent(GEMINI_KEY));
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0)
      .map(m => m.name.replace(/^models\//, ""));
    const score = n => {
      const v = /gemini-(\d+(?:\.\d+)?)/.exec(n);
      return (v ? parseFloat(v[1]) : 0) * 100
        + (n.indexOf("flash") >= 0 ? 10 : 0)
        - (n.indexOf("lite") >= 0 ? 5 : 0)
        - (/preview|exp/.test(n) ? 50 : 0)
        - (n.indexOf("pro") >= 0 ? 8 : 0); // pro is not on the free tier
    };
    geminiModels = models.filter(n => n.indexOf("flash") >= 0).sort((a, b) => score(b) - score(a)).slice(0, 4);
    if (!geminiModels.length && models.length) geminiModels = [models[0]];
    if (geminiModels.length) console.log("  AI models: Gemini " + geminiModels.map(m => '"' + m + '"').join(", "));
    else console.error("  Gemini: no usable model found for this key.");
  } catch (e) {
    console.error("  Gemini model discovery failed:", e.message);
  }
}
if (GEMINI_KEY) discoverGeminiModels();

/* Is this error worth retrying on a different model? (overloaded/busy) */
function geminiRetriable(e) {
  return e.status === 429 || e.status === 503 || /high demand|overloaded|try again/i.test(e.message || "");
}

/* One Gemini call with automatic model fallback. `parts` items:
   {text} or {inline_data:{mime_type,data}}. Returns the reply text. */
async function geminiGenerate(systemText, contents, maxTokens) {
  if (!geminiModels.length) await discoverGeminiModels();
  if (!geminiModels.length) throw new Error("Gemini model unavailable");
  let lastErr;
  for (const model of geminiModels) {
    try {
      const res = await fetch(GEMINI_BASE + "/models/" + model + ":generateContent?key=" + encodeURIComponent(GEMINI_KEY), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens || 1024 }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data.error && data.error.message) || ("Gemini error " + res.status);
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      const cand = (data.candidates || [])[0];
      return cand && cand.content && cand.content.parts
        ? cand.content.parts.map(p => p.text || "").join("").trim()
        : "";
    } catch (e) {
      lastErr = e;
      if (!geminiRetriable(e)) throw e;
      console.log("  Gemini model \"" + model + "\" busy - trying the next one...");
    }
  }
  throw lastErr;
}

const CHAT_SYSTEM = `You are the Quick Help assistant for the Rwanda Blood Donation Centre website.
Be warm, clear and CONCISE (2-5 sentences unless more detail is truly needed). You answer any question,
but you are the expert on this site and on blood donation.

About the site (all pages are in the top menu):
- Donate: donor registration - details, password, map location pin, blood screening certificate upload. Donors must be 18-65. Whole blood can be given every 56 days.
- Directory: registered donors, open blood requests, all hospitals in Rwanda, and pharmacies. ONLY hospital accounts with an active subscription can post blood requests - individuals can never request blood themselves; they should contact a hospital. Requests auto-delete after 30 days and can be booked by donors.
- Live Map: interactive map of Rwanda (pan/zoom/rotate/tilt) with hospitals, donors and district blood supply/demand. A signed-in donor sees only hospitals that have an active subscription on the platform.
- Medicines: only medicines for the health cases this site covers (anemia & blood support, diabetes, hypertension, asthma, heart health, obesity), sold by registered pharmacies. Prescription (Rx) medicines require uploading a doctor's prescription before buying. Payment: online via Mobile Money/card, or reserve & pay at the pharmacy.
- Health: guides for diabetes, obesity, asthma, hypertension, anemia and heart health, plus videos.
- Services: live drone delivery tracking (Premium hospitals can request priority drone delivery of blood) and the fundraising page where anyone can donate money.
- Subscribe: hospitals (Basic RWF 50,000 / Standard 150,000 / Premium 400,000 per month) and pharmacies (Basic 30,000 / Standard 80,000 / Premium 180,000) pay monthly via Mobile Money or card. Hospitals need any active plan to post blood requests; Premium adds priority drone delivery. Pharmacies need an active plan to list medicines.
- My Account: role-based dashboard. Donors: profile, donation history, verification status. Hospitals: blood requests, drone requests, donor verification queue. Pharmacies: stock management, orders (with prescriptions), sales.
- Settings (gear icon): language (English / French / Kinyarwanda) and dark mode.
- Emergency: red button, bottom-left of every page - calls 912 (Rwanda's real ambulance number) or the nearest hospital.

Blood facts you may use: O- is the universal red-cell donor, AB+ the universal recipient. One donation can help up to 3 patients. Eat well, hydrate and rest around donation. Iron-rich food and (if advised) iron/folic acid/B12 supplements help recovery.

New hospitals/pharmacies: after registering they are vetted by the site administrator, then get a 7-day FREE trial with full access; after the trial they must subscribe. Everyone gets in-app notifications (the bell in the header): request updates, prescription reviews, payment confirmations, trial/subscription reminders.
Anyone can OFFER to donate blood on the Donate page WITHOUT creating an account (the offer appears on the Request Board for 30 days). Creating a full donor account (profile, history, verification) is done separately from My Account.

Medical questions: give general, safe education and always advise seeing a doctor or pharmacist for personal medical decisions - you are not a doctor and must not diagnose or prescribe. If you are not sure about something or it concerns a specific account/payment problem, say so plainly and point them to the site administrator (via the feedback/admin contact) instead of guessing. In an emergency tell them to call 912 immediately.`;

app.post("/api/chat", async (req, res) => {
  if (!GEMINI_KEY && !anthropic) return res.json({ configured: false });
  const history = Array.isArray(req.body.messages) ? req.body.messages.slice(-20) : [];
  const messages = history
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return fail(res, 400, "Send at least one user message.");
  }
  // Tailor guidance to who is asking (donor / hospital / pharmacy / admin).
  const a = accountFor(req);
  const roleLine = a
    ? "\n\nThe person you are talking to is logged in as a " + a.role +
      (a.record && (a.record.name || a.record.fullName) ? " (" + (a.record.name || a.record.fullName) + ")" : "") +
      ". Tailor your guidance to what a " + a.role + " can actually do on this platform."
    : "";

  try {
    if (GEMINI_KEY) {
      // FREE provider: Google Gemini.
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const reply = await geminiGenerate(CHAT_SYSTEM + roleLine, contents, 1024);
      return res.json({ configured: true, reply: reply || "Sorry, I could not come up with an answer - please try rephrasing." });
    }

    // Anthropic Claude.
    const system = [{ type: "text", text: CHAT_SYSTEM, cache_control: { type: "ephemeral" } }];
    if (roleLine) system.push({ type: "text", text: roleLine.trim() });
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048, // chat replies are deliberately short
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages
    });
    if (response.stop_reason === "refusal") {
      return res.json({ configured: true, reply: "I can't help with that request - but I'm happy to answer questions about blood donation, health topics or using this site." });
    }
    const reply = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    res.json({ configured: true, reply: reply || "Sorry, I could not come up with an answer - please try rephrasing." });
  } catch (e) {
    if (anthropic && e instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key is invalid.");
      return res.json({ configured: false });
    }
    if ((anthropic && e instanceof Anthropic.RateLimitError) || e.status === 429) {
      return res.json({ configured: true, reply: "I'm receiving too many questions right now (free-tier limit) - please try again in a minute." });
    }
    if (e.status === 400 || e.status === 401 || e.status === 403) {
      console.error("AI key/config problem:", e.message);
      return res.json({ configured: false });
    }
    console.error("Chat error:", e.message || e);
    fail(res, 502, "The AI assistant hit a problem - please try again.");
  }
});

/* ============================================================
   SCHEDULED SWEEP (runs at boot and every hour, server-side)
   - Archives requests/offers older than 30 days.
   - Sends staged trial & subscription expiry reminders
     (7 / 3 / 1 days before, and on expiry) - deduplicated, so no
     stage is ever sent twice for the same period.
   ============================================================ */
function expirySweep() {
  archiveExpired();
  const stages = [7, 3, 1];
  for (const role of ["hospital", "pharmacy"]) {
    for (const rec of allRecords(role)) {
      refreshSub(role, rec);
      const id = rec.email;

      if (hasActiveSub(rec)) {
        const daysLeft = Math.ceil((new Date(rec.subscriptionEnd) - Date.now()) / 86400000);
        for (const stage of stages) {
          if (daysLeft <= stage && daysLeft >= 0) {
            notify(role, id, {
              type: "subscription",
              dedupeKey: "sub-" + stage + "-" + id + "-" + rec.subscriptionEnd,
              title: "Subscription expires in " + daysLeft + " day(s)",
              body: "Your " + rec.subscriptionPlan + " plan expires on " + rec.subscriptionEnd.slice(0, 10) + ". Renew now to avoid any interruption.",
              link: "subscribe.html"
            });
          }
        }
      } else if (rec.subscriptionStatus === "expired" && rec.subscriptionEnd) {
        notify(role, id, {
          type: "subscription",
          dedupeKey: "sub-expired-" + id + "-" + rec.subscriptionEnd,
          title: "Your subscription has expired",
          body: "Your " + rec.subscriptionPlan + " plan expired on " + rec.subscriptionEnd.slice(0, 10) + ". Renew on the Subscribe page to regain full access. Your account and data are safe.",
          link: "subscribe.html"
        });
      }

      if (!hasActiveSub(rec) && rec.trialEnd) {
        if (trialActive(rec)) {
          const daysLeft = trialDaysLeft(rec);
          for (const stage of stages) {
            if (daysLeft <= stage && daysLeft >= 0) {
              notify(role, id, {
                type: "trial",
                dedupeKey: "trial-" + stage + "-" + id + "-" + rec.trialEnd,
                title: "Free trial ends in " + daysLeft + " day(s)",
                body: "Your free trial ends on " + rec.trialEnd.slice(0, 10) + ". Subscribe now to keep posting and using the platform without interruption.",
                link: "subscribe.html"
              });
            }
          }
        } else {
          notify(role, id, {
            type: "trial",
            dedupeKey: "trial-expired-" + id + "-" + rec.trialEnd,
            title: "Your free trial has ended",
            body: "Your " + TRIAL_DAYS + "-day free trial is over. Choose a plan on the Subscribe page to continue - your account and data are preserved.",
            link: "subscribe.html"
          });
        }
      }
    }
  }
}
expirySweep();
setInterval(function () {
  expirySweep();
  checkPendingPaypack().catch(e => console.error("Pending payment sweep:", e.message));
}, 60 * 60 * 1000);

/* ============================================================
   STATIC SITE + merged-page redirects
   ============================================================ */
app.get(["/hospitals.html", "/pharmacy.html"], (req, res) =>
  res.redirect(301, "/directory.html" + (req.path === "/pharmacy.html" ? "#pharmacies" : "#hospitals")));
app.get(["/drone.html", "/funds.html"], (req, res) =>
  res.redirect(301, "/services.html" + (req.path === "/funds.html" ? "#funds" : "#drone")));

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(__dirname, { extensions: ["html"] }));

/* Start listening. If the port is taken (e.g. another project is
   already on 3000), automatically try the next one. */
function listenOn(port, attemptsLeft) {
  const server = app.listen(port, () => {
    console.log("");
    console.log("  Rwanda Blood Donation Centre is running:  http://localhost:" + port);
    console.log("  Payments:  " + (PAY_PROVIDER === "paypack" ? "Paypack configured - REAL Mobile Money payments enabled"
      : PAY_PROVIDER === "flutterwave" ? "Flutterwave configured - REAL payments enabled"
      : "not configured (add PAYPACK_CLIENT_ID + PAYPACK_CLIENT_SECRET to .env)"));
    console.log("  AI chat:   " + (GEMINI_KEY ? "Google Gemini enabled (free tier)"
      : ANTHROPIC_KEY ? "Anthropic Claude enabled"
      : "not configured (add GEMINI_API_KEY to .env - it's free) - offline helper will be used"));
    console.log("  Demo logins (password demo1234): info@chuk.rw (hospital), info@kipharma.rw (pharmacy)");
    console.log("  Admin:     My Account > Admin, password " + (process.env.ADMIN_PASSWORD ? "from your .env" : '"admin1234" (default - set ADMIN_PASSWORD in .env to change it)'));
    console.log("");
  });
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log("  Port " + port + " is already in use - trying " + (port + 1) + "...");
      listenOn(port + 1, attemptsLeft - 1);
    } else {
      throw e;
    }
  });
}
listenOn(PORT, 10);
