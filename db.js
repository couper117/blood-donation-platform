/* ============================================================
   Blood Donation Centre - client-side data layer.
   Talks to the real backend (server.js) over the REST API.
   Method names mirror the old IndexedDB version so pages keep
   working, but all data now lives in the server's database and
   all rules (who may post blood requests, prescription checks,
   payments) are enforced server-side.

   The session token is kept in localStorage so the header can
   render instantly; the server is the source of truth.
   ============================================================ */

const SESSION_KEY = "bdc_session_v3";

function apiHeaders(json) {
  const h = {};
  const s = DB.currentSession();
  if (s && s.token) h["Authorization"] = "Bearer " + s.token;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

/* Every API call goes through here. Throws Error(message) on failure. */
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: apiHeaders(!!body),
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new Error("Could not reach the server. Start it with \"npm start\" and open http://localhost:3000.");
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON response */ }
  if (!res.ok) throw new Error((data && data.error) || ("Request failed (" + res.status + ")"));
  return data;
}

/* Read a File/Blob and upload it to the server. Returns {url, name}. */
function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error("Could not read the file.")); };
    r.readAsDataURL(file);
  });
}

const DB = {
  ready: Promise.resolve(),

  /* ---------------- Session ---------------- */
  saveSession(role, id, token, displayName) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role, id, token, displayName }));
    // A fresh login always starts in the focused, role-only menu.
    localStorage.setItem("bdc_navmode", "focused");
  },
  currentSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  },
  async logout() {
    try { await api("POST", "/api/auth/logout"); } catch (e) { /* token may already be gone */ }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("bdc_navmode");
  },
  /* The logged-in account, verified against the server. Clears a stale session. */
  async currentAccount() {
    const s = this.currentSession();
    if (!s) return null;
    try {
      return await api("GET", "/api/auth/me");
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },
  async currentDonor() {
    const a = await this.currentAccount();
    return a && a.role === "donor" ? a.record : null;
  },

  /* ---------------- Auth ---------------- */
  async registerDonor(fields) {
    const out = await api("POST", "/api/auth/register-donor", fields);
    this.saveSession(out.role, out.record.contact, out.token, out.record.fullName);
    return out.record;
  },
  async registerOrg(fields) {
    const out = await api("POST", "/api/auth/register-org", fields);
    this.saveSession(out.role, out.record.email, out.token, out.record.name);
    return out.record;
  },
  async loginWithPassword(role, id, password) {
    const out = await api("POST", "/api/auth/login", { role, id, password });
    if (role === "admin") {
      this.saveSession("admin", "admin", out.token, "Admin");
      return out.record;
    }
    this.saveSession(out.role, out.record[role === "donor" ? "contact" : "email"], out.token,
      role === "donor" ? out.record.fullName : out.record.name);
    return out.record;
  },
  async updateProfile(patch) {
    const out = await api("PUT", "/api/profile", patch);
    return out.record;
  },
  async changePassword(currentPassword, newPassword) {
    return api("POST", "/api/auth/change-password", { currentPassword, newPassword });
  },
  async recordDonation() {
    const out = await api("POST", "/api/donations");
    return out.record;
  },

  /* ---------------- Uploads ----------------
     kind: "avatar" (public), "screening" or "prescription" (private
     medical documents, served only through /api/docs with an access
     check - see DB.docUrl for how to link to them). */
  async upload(file, kind) {
    const dataUrl = await fileToDataUrl(file);
    return api("POST", "/api/upload", { dataUrl, name: file.name, kind: kind || "avatar" });
  },
  /* Private documents need the session token as a query parameter,
     because a plain link or new tab cannot send an Authorization header. */
  docUrl(url) {
    if (!url || url.indexOf("/api/docs/") !== 0) return url;
    const s = this.currentSession();
    return s && s.token ? url + "?token=" + encodeURIComponent(s.token) : url;
  },

  /* ---------------- Donors ---------------- */
  async getDonors() { return api("GET", "/api/donors"); },
  async getPendingVerifications() { return api("GET", "/api/donors/pending"); },
  async setVerification(contact, status, note) {
    return api("POST", "/api/donors/" + encodeURIComponent(contact) + "/verification", { status, note });
  },

  /* ---------------- Hospitals & pharmacies ---------------- */
  /* Returns {donorView, hospitals}. When the viewer is a signed-in donor
     the server only returns hospitals with an active subscription. */
  async getHospitalAccounts() { return api("GET", "/api/hospitals"); },
  async getPharmacies() { return api("GET", "/api/pharmacies"); },

  /* ---------------- Blood requests (hospitals only) ---------------- */
  async getRequests() { return api("GET", "/api/requests"); },
  async addRequest(fields) { return api("POST", "/api/requests", fields); },
  async bookRequest(id) { return api("POST", "/api/requests/" + encodeURIComponent(id) + "/book"); },
  async removeRequest(id) { return api("DELETE", "/api/requests/" + encodeURIComponent(id)); },

  /* ---------------- Donation offers (no account needed) ---------------- */
  async submitOffer(fields) { return api("POST", "/api/offers", fields); },
  async getOffers() { return api("GET", "/api/offers"); },
  async adminRemoveOffer(id) { return api("DELETE", "/api/offers/" + encodeURIComponent(id)); },

  /* ---------------- Notifications ---------------- */
  async getNotifications() { return api("GET", "/api/notifications"); },
  async markNotificationsRead(ids) { return api("POST", "/api/notifications/read", ids ? { ids } : {}); },

  /* ---------------- Medicines, stock & orders ---------------- */
  async getMedicines() { return api("GET", "/api/medicines"); },
  async getAllStock() { return api("GET", "/api/stock"); },
  async setStock(medicineId, qty) { return api("PUT", "/api/stock", { medicineId, qty }); },
  async placeOrder(order) { return api("POST", "/api/orders", order); },
  async getMyOrders() { return api("GET", "/api/orders"); },           // pharmacy: incoming orders
  async getPurchases() { return api("GET", "/api/my-orders"); },       // buyer: own orders
  async rxReview(orderId, approve, note) {
    return api("POST", "/api/orders/" + orderId + "/rx-review", { approve, note });
  },

  /* ---------------- Drone requests ---------------- */
  async addDroneRequest(fields) { return api("POST", "/api/drone-requests", fields); },
  async getDroneRequests() { return api("GET", "/api/drone-requests"); },

  /* ---------------- Payments (real - Flutterwave) ---------------- */
  async paymentsConfigured() {
    try { return (await api("GET", "/api/payments/config")).configured; }
    catch (e) { return false; }
  },
  /* Starts a real payment and sends the browser to the secure checkout page. */
  async startPayment(intent) {
    const out = await api("POST", "/api/payments/initiate", intent);
    window.location.href = out.link;
  },

  /* ---------------- Funds / feedback / emergency ---------------- */
  async getFunds() { return api("GET", "/api/funds"); },
  async addFeedback(entry) { return api("POST", "/api/feedback", entry); },
  async logEmergency(entry) {
    try { return await api("POST", "/api/emergency-log", entry); } catch (e) { /* non-critical */ }
  },

  /* ---------------- Administrator ---------------- */
  async adminAccounts() { return api("GET", "/api/admin/accounts"); },
  async adminSetApproval(role, id, approved, note) {
    return api("POST", "/api/admin/accounts/" + role + "/" + encodeURIComponent(id) + "/approval", { approved, note });
  },
  async adminResetPassword(role, id) {
    return api("POST", "/api/admin/accounts/" + role + "/" + encodeURIComponent(id) + "/reset-password");
  },
  async adminFeedback() { return api("GET", "/api/admin/feedback"); },
  async adminStats() { return api("GET", "/api/admin/stats"); },
  async adminDocuments() { return api("GET", "/api/admin/documents"); },
  async adminReviewDocument(file, status, note) {
    return api("POST", "/api/admin/documents/" + encodeURIComponent(file) + "/review", { status, note });
  },
  async adminAudit() { return api("GET", "/api/admin/audit"); },

  /* ---------------- AI chat ---------------- */
  /* Returns {configured, reply}. configured:false = fall back to the offline helper. */
  async chat(messages) { return api("POST", "/api/chat", { messages }); }
};

/* Friendly warning if the site is opened by double-clicking the HTML
   file instead of through the server - the API cannot work that way. */
if (window.location.protocol === "file:") {
  document.addEventListener("DOMContentLoaded", function () {
    const bar = document.createElement("div");
    bar.style.cssText = "background:#d7263d;color:#fff;padding:12px 16px;text-align:center;font-weight:600";
    bar.textContent = "This site now has a real backend. Please run \"npm start\" in the project folder and open http://localhost:3000 instead of opening the file directly.";
    document.body.prepend(bar);
  });
}
