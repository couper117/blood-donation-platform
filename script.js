/* ============================================================
   Blood Donation Centre - Rwanda. JavaScript for all pages.
   All data lives on the server (see server.js); this file renders
   pages and calls the DB.* API client in db.js.
   ============================================================ */

const REQUEST_MAX_DAYS = 30;
const REQUEST_MAX_MS = REQUEST_MAX_DAYS * 24 * 60 * 60 * 1000;

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function tierBadge(plan) {
  const p = (plan || "none").toLowerCase();
  const label = p === "none" ? "Not subscribed" : plan;
  return '<span class="tier-chip tier-' + p + '">' + label + '</span>';
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = "form-message show " + type;
}

/* ------------------------------------------------------------
   Shared payment flow. Works with whichever provider the server has:
   - Paypack: ask for the customer's Mobile Money number, the provider
     pushes an approval prompt to their phone, and we poll the server
     until the money is confirmed (or fails).
   - Flutterwave: redirect to the hosted checkout page.
   `onSuccessUrl` is where the browser goes after a confirmed Paypack
   payment (with ?payment=success so the page shows the banner).
   ------------------------------------------------------------ */
function askMomoNumber(amountLabel, cb) {
  const body =
    '<p class="muted" style="margin-bottom:12px">Enter the MTN or Airtel Mobile Money number to charge <strong>' + esc(amountLabel) + '</strong>. ' +
    'A prompt will appear on that phone to approve the payment.</p>' +
    '<div class="field"><label for="momoNum">Mobile Money number</label>' +
    '<input type="tel" id="momoNum" placeholder="078xxxxxxx" autocomplete="tel" /></div>' +
    '<div class="form-actions" style="margin-top:14px"><button class="btn btn-primary btn-lg" id="momoGo">Send payment request</button></div>';
  const overlay = widgetOverlay("Pay with Mobile Money", body);
  const input = overlay.querySelector("#momoNum");
  input.focus();
  function go() {
    const v = input.value.trim();
    if (v.replace(/[^\d]/g, "").length < 9) { input.style.borderColor = "var(--red)"; return; }
    overlay.remove();
    cb(v);
  }
  overlay.querySelector("#momoGo").addEventListener("click", go);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
}

async function payFlow(intent, msgEl, onSuccessUrl) {
  const cfg = await DB.paymentsConfig();
  if (!cfg.configured) {
    showMsg(msgEl, "Online payment is not configured yet - the site owner must add Paypack keys to the server's .env file. No payment was taken.", "error");
    return;
  }
  if (cfg.provider === "flutterwave") {
    showMsg(msgEl, "Taking you to the secure payment page...", "success");
    try { await DB.startPayment(intent); } catch (e) { showMsg(msgEl, e.message, "error"); }
    return;
  }
  // Paypack (Mobile Money push)
  const label = "RWF " + (intent.amount ? intent.amount.toLocaleString("en-US") : "the amount due");
  askMomoNumber(label, async function (phone) {
    showMsg(msgEl, "Sending the payment request to " + phone + "...", "success");
    let out;
    try {
      out = await DB.initiatePayment(Object.assign({ phone }, intent));
    } catch (e) { showMsg(msgEl, e.message, "error"); return; }
    showMsg(msgEl, "Now check the phone (" + phone + ") and approve the Mobile Money prompt. Waiting for confirmation...", "success");
    let tries = 0;
    const iv = setInterval(async function () {
      tries++;
      try {
        const st = await DB.paymentStatus(out.txRef);
        if (st.status === "success") {
          clearInterval(iv);
          showMsg(msgEl, "Payment received and verified!", "success");
          if (onSuccessUrl) window.location.href = onSuccessUrl;
        } else if (st.status === "failed") {
          clearInterval(iv);
          showMsg(msgEl, "The payment failed or was declined on the phone - nothing was activated. You can try again.", "error");
        } else if (tries > 40) { // ~2 minutes
          clearInterval(iv);
          showMsg(msgEl, "Still waiting for the approval. If you approved it, give it a minute and refresh this page - the payment completes automatically once confirmed.", "error");
        }
      } catch (e) { /* transient - keep polling */ }
    }, 3000);
  });
}

/* Reads ?payment=success|failed|cancelled from the URL (after a real
   payment redirect) and shows it in the given message element. */
function handlePaymentReturn(msgEl) {
  const p = new URLSearchParams(window.location.search).get("payment");
  if (!p || !msgEl) return p;
  if (p === "success") showMsg(msgEl, "Payment received and verified - thank you! Everything you paid for is now active.", "success");
  else if (p === "cancelled") showMsg(msgEl, "Payment was cancelled - nothing was charged.", "error");
  else showMsg(msgEl, "The payment could not be verified, so nothing was activated. If money left your account, contact support with your transaction reference.", "error");
  history.replaceState(null, "", window.location.pathname + window.location.hash);
  return p;
}

/* ------------------------------------------------------------
   Header: mobile hamburger menu (injected so every page gets it
   without editing each header) + login state in the nav.
   ------------------------------------------------------------ */
function initMobileNav() {
  const header = document.querySelector(".site-header");
  const nav = header && header.querySelector(".nav");
  if (!nav || header.querySelector(".nav-toggle")) return;
  const btn = document.createElement("button");
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "Open menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = "<span></span><span></span><span></span>";
  btn.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
  // Close the menu after choosing a page.
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { nav.classList.remove("open"); btn.classList.remove("open"); }
  });
  header.appendChild(btn);
}

/* ------------------------------------------------------------
   Show/hide password toggle - added to EVERY password field on the
   site automatically. Keyboard and screen-reader accessible, and
   password managers keep working (the input itself is untouched).
   ------------------------------------------------------------ */
const EYE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function initPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    if (input.closest(".pw-wrap")) return; // already wired
    const wrap = document.createElement("div");
    wrap.className = "pw-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-eye";
    btn.setAttribute("aria-label", "Show password");
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = EYE_SVG;
    btn.addEventListener("click", function () {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.setAttribute("aria-pressed", String(show));
      btn.innerHTML = show ? EYE_OFF_SVG : EYE_SVG;
      input.focus();
    });
    wrap.appendChild(btn);
  });
}

function initHeaderAccount() {
  const link = document.getElementById("accountLink");
  if (link) {
    const s = DB.currentSession();
    if (s && s.displayName) {
      link.textContent = "Hi, " + (s.role === "donor" ? s.displayName.split(" ")[0] : s.displayName);
    }
  }
  applyRoleNav();
}

/* ------------------------------------------------------------
   Role-focused navigation: a logged-in person only sees the menu
   items dedicated to their role, plus a "View full site" button
   that switches the complete menu back on (and back again).
   Logged-out visitors always see the full menu.
   ------------------------------------------------------------ */
const NAV_MODE_KEY = "bdc_navmode"; // "focused" (default when logged in) | "full"
const ROLE_NAV = {
  donor:    ["donate.html", "directory.html", "map.html", "medicines.html", "health.html", "dashboard.html", "settings.html"],
  hospital: ["directory.html", "map.html", "services.html", "subscribe.html", "dashboard.html", "settings.html"],
  pharmacy: ["medicines.html", "directory.html", "subscribe.html", "dashboard.html", "settings.html"],
  admin:    ["dashboard.html", "settings.html"]
};

function applyRoleNav() {
  const nav = document.querySelector(".site-header .nav");
  if (!nav) return;
  const s = DB.currentSession();
  const links = Array.from(nav.querySelectorAll("a"));
  let toggle = nav.querySelector(".nav-mode-toggle");

  if (!s || !ROLE_NAV[s.role]) {
    // Logged out: full menu, no toggle.
    links.forEach(a => { a.style.display = ""; });
    if (toggle) toggle.remove();
    return;
  }

  const mode = localStorage.getItem(NAV_MODE_KEY) === "full" ? "full" : "focused";
  const allowed = ROLE_NAV[s.role];
  links.forEach(a => {
    const href = (a.getAttribute("href") || "").split("#")[0];
    a.style.display = (mode === "full" || allowed.indexOf(href) >= 0) ? "" : "none";
  });

  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-mode-toggle";
    toggle.addEventListener("click", function () {
      localStorage.setItem(NAV_MODE_KEY,
        localStorage.getItem(NAV_MODE_KEY) === "full" ? "focused" : "full");
      applyRoleNav();
    });
    nav.appendChild(toggle);
  }
  toggle.textContent = mode === "focused" ? "View full site" : "Show my menu only";
  toggle.title = mode === "focused"
    ? "Show every page of the site" : "Show only the pages for your account";
}

/* ------------------------------------------------------------
   1. Donation session timer (donate page)
   ------------------------------------------------------------ */
function initTimer() {
  const display = document.getElementById("timerDisplay");
  if (!display) return;

  const minutesInput = document.getElementById("timerMinutes");
  const startBtn = document.getElementById("startTimer");
  const pauseBtn = document.getElementById("pauseTimer");
  const resetBtn = document.getElementById("resetTimer");
  const note = document.getElementById("timerNote");

  let remaining = 10 * 60;
  let ticker = null;

  function format(t) {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function render() { display.textContent = format(remaining); }
  function stop() { clearInterval(ticker); ticker = null; }

  startBtn.addEventListener("click", function () {
    if (ticker) return;
    note.textContent = "Session running...";
    note.className = "timer-note";
    ticker = setInterval(function () {
      if (remaining > 0) { remaining--; render(); }
      else { stop(); note.textContent = "Time is up. Rest, drink water and have a snack."; note.className = "timer-note done"; }
    }, 1000);
  });
  pauseBtn.addEventListener("click", function () {
    stop(); note.textContent = "Paused."; note.className = "timer-note";
  });
  resetBtn.addEventListener("click", function () {
    stop();
    let mins = parseInt(minutesInput.value, 10);
    if (isNaN(mins) || mins < 1) mins = 10;
    if (mins > 30) mins = 30;
    remaining = mins * 60;
    render(); note.textContent = ""; note.className = "timer-note";
  });
  render();
}

/* ------------------------------------------------------------
   2. Donor registration (donate page) - creates a real account
   ------------------------------------------------------------ */
function setError(field, message) {
  const el = document.querySelector('[data-error-for="' + field + '"]');
  if (el) el.textContent = message || "";
}

/* Donate page: submit a DONATION OFFER. Deliberately does NOT create an
   account or log anyone in - it just publishes the offer on the Request
   Board for 30 days. Account creation is a separate flow in My Account. */
function initOfferForm() {
  const form = document.getElementById("offerForm");
  if (!form) return;

  let picked = null, picker = null;
  const locText = document.getElementById("offLocText");
  const pmap = createRwandaMap("offMap", { zoom: 7.5 });
  if (pmap) {
    picker = makePicker(pmap, function (lat, lng) {
      picked = { lat, lng };
      if (locText) locText.textContent = "Location pinned: " + lat.toFixed(4) + ", " + lng.toFixed(4);
    });
    const geoBtn = document.getElementById("offUseLocation");
    if (geoBtn) geoBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { locText.textContent = "Geolocation is not supported by your browser."; return; }
      locText.textContent = "Locating you...";
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          picker.place(pos.coords.longitude, pos.coords.latitude);
          pmap.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
        },
        function () { locText.textContent = "Could not get your location. Please click on the map instead."; }
      );
    });
  }

  const msgBox = document.getElementById("offerMessage");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await DB.submitOffer({
        fullName: document.getElementById("offName").value.trim(),
        bloodGroup: document.getElementById("offGroup").value,
        contact: document.getElementById("offContact").value.trim(),
        city: document.getElementById("offCity").value.trim(),
        note: document.getElementById("offNote").value.trim(),
        lat: picked ? picked.lat : null,
        lng: picked ? picked.lng : null
      });
      form.reset();
      picked = null;
      if (picker) picker.remove();
      if (locText) locText.textContent = "";
      showMsg(msgBox,
        "Thank you! Your donation offer is now on the Request Board for 30 days, where hospitals can see it and contact you. " +
        "No account was created - if you also want a donor account with a profile and history, use My Account > Create donor account.",
        "success");
    } catch (err) {
      showMsg(msgBox, err.message, "error");
    }
  });
}

/* My Account page: CREATE A DONOR ACCOUNT (the deliberate, separate
   flow - profile, password, screening certificate, donation history). */
function initDonorRegisterForm() {
  const form = document.getElementById("donorRegisterForm");
  if (!form) return;

  const showBtn = document.getElementById("showDonorRegister");
  const panel = document.getElementById("donorRegisterPanel");
  let picked = null, picker = null;
  if (showBtn) showBtn.addEventListener("click", function () {
    panel.style.display = "block";
    const el = document.getElementById("drMap");
    if (el && !el._maplibreInit) {
      el._maplibreInit = true;
      const m = createRwandaMap("drMap", { zoom: 7 });
      if (m) picker = makePicker(m, function (lat, lng) {
        picked = { lat, lng };
        const t = document.getElementById("drLocText");
        if (t) t.textContent = "Location pinned: " + lat.toFixed(4) + ", " + lng.toFixed(4);
      });
    }
  });

  const fileInput = document.getElementById("drScreening");
  const fileInfo = document.getElementById("drFileInfo");
  let screeningFile = null;
  if (fileInput) fileInput.addEventListener("change", function () {
    fileInfo.textContent = "";
    screeningFile = null;
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { fileInfo.textContent = "File is larger than 5 MB - choose a smaller one."; fileInput.value = ""; return; }
    screeningFile = file;
    fileInfo.textContent = "Selected: " + file.name + " (" + Math.round(file.size / 1024) + " KB)";
  });

  const msg = document.getElementById("drMsg");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const fullName = document.getElementById("drName").value.trim();
    const age = parseInt(document.getElementById("drAge").value, 10);
    const bloodGroup = document.getElementById("drGroup").value;
    const contact = document.getElementById("drContact").value.trim();
    const password = document.getElementById("drPassword").value;
    const city = document.getElementById("drCity").value.trim();
    const consent = document.getElementById("drConsent").checked;

    if (fullName.length < 2 || !bloodGroup || contact.length < 5 || password.length < 4 || city.length < 2) {
      showMsg(msg, "Please fill in your name, blood group, contact, city, and a password of at least 4 characters.", "error");
      return;
    }
    if (isNaN(age) || age < 18 || age > 65) { showMsg(msg, "Donors must be between 18 and 65.", "error"); return; }
    if (!consent) { showMsg(msg, "Please tick the consent box to continue.", "error"); return; }

    try {
      await DB.registerDonor({
        fullName, age, bloodGroup, contact, password, city,
        lat: picked ? picked.lat : null, lng: picked ? picked.lng : null,
        lastDonation: document.getElementById("drLastDonation").value || null
      });
      if (screeningFile) {
        showMsg(msg, "Account created - uploading your screening certificate...", "success");
        const up = await DB.upload(screeningFile, "screening");
        await DB.updateProfile({ screeningUrl: up.url, screeningName: screeningFile.name });
      }
      location.reload(); // dashboard re-opens showing the new donor profile
    } catch (err) {
      showMsg(msg, err.message, "error");
    }
  });
}

/* ------------------------------------------------------------
   3. Live Rwanda map (map page)
   Hospitals rule: a signed-in donor only sees hospitals with an
   active subscription (the server enforces the filtering).
   ------------------------------------------------------------ */
async function initRwandaMap() {
  const map = createRwandaMap("rwMap");
  if (!map) return;

  const info = document.getElementById("mapInfo");
  addAreaLayer(map, RW_AREAS, function (area) {
    const s = STATUS_INFO[area.status];
    if (info) info.innerHTML =
      '<h3>' + esc(area.name) + '</h3>' +
      '<span class="info-status" style="background:' + s.color + '">' + s.label + '</span>' +
      '<div class="info-row"><span>Units available</span><span>' + area.available + '</span></div>' +
      '<div class="info-row"><span>Units needed</span><span>' + area.needed + '</span></div>' +
      '<div class="info-row"><span>Difference</span><span>' + (area.available - area.needed) + '</span></div>' +
      '<p class="muted" style="margin-top:12px">' +
        (area.status === "demand" ? "This area needs donors. Please consider donating here."
          : area.status === "supply" ? "This area has enough blood for now."
          : "Supply and demand are about equal here.") + '</p>';
  });

  const note = document.getElementById("mapHospitalNote");
  try {
    const { donorView, hospitals } = await DB.getHospitalAccounts();
    if (donorView) {
      // Donor: ONLY subscribed hospital accounts.
      addHospitalMarkers(map, hospitals.map(h => ({
        name: h.name, city: h.city, lat: h.lat, lng: h.lng, phone: h.phone,
        tier: h.subscriptionPlan, blood: true
      })).filter(h => typeof h.lat === "number"));
      if (note) note.textContent = "You are signed in as a donor, so the map shows only the " +
        hospitals.length + " hospital(s) with an active subscription on this platform.";
    } else {
      // Everyone else: all hospitals in Rwanda + registered accounts get a tier badge.
      const accByName = {};
      hospitals.forEach(h => { accByName[h.name] = h; });
      addHospitalMarkers(map, RW_HOSPITALS.map(h => Object.assign({}, h, {
        tier: accByName[h.name] && accByName[h.name].subscriptionStatus === "active"
          ? accByName[h.name].subscriptionPlan : null
      })));
      const extra = hospitals.filter(h => typeof h.lat === "number" && !RW_HOSPITALS.some(s => s.name === h.name));
      addHospitalMarkers(map, extra.map(h => ({ name: h.name, city: h.city, lat: h.lat, lng: h.lng, phone: h.phone, tier: h.subscriptionPlan })));
      if (note) note.textContent = "Showing all " + RW_HOSPITALS.length + " hospitals across Rwanda.";
    }
  } catch (e) {
    addHospitalMarkers(map, RW_HOSPITALS);
  }

  addPharmacyMarkers(map, RW_PHARMACIES);

  try {
    const donors = (await DB.getDonors()).filter(d => typeof d.lat === "number");
    addDonorMarkers(map, donors);
    const count = document.getElementById("donorCount");
    if (count) count.textContent = donors.length;
  } catch (e) { /* server offline - map still shows static data */ }
}

/* ------------------------------------------------------------
   4. Hospitals tab (Directory page)
   ------------------------------------------------------------ */
function renderHospitalList(userLoc) {
  const list = document.getElementById("hospitalList");
  if (!list) return;
  let items = RW_HOSPITALS.slice();
  if (userLoc) {
    items.forEach(h => h._dist = haversine(userLoc.lat, userLoc.lng, h.lat, h.lng));
    items.sort((a, b) => a._dist - b._dist);
  }
  list.innerHTML = items.map(function (h) {
    return '<div class="hosp-card">' +
      '<div class="hosp-top"><h3>' + esc(h.name) + '</h3>' +
        (h.blood ? '<span class="tag tag-blood">Blood bank</span>' : '') + '</div>' +
      '<p class="muted">' + esc(h.type) + ' &middot; ' + esc(h.city) + '</p>' +
      (h._dist != null ? '<p class="dist">About ' + h._dist.toFixed(1) + ' km from you</p>' : '') +
      '<div class="hosp-actions">' +
        '<a class="btn btn-primary btn-sm" href="tel:' + h.phone.replace(/\s/g, "") + '">Call ' + h.phone + '</a>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" ' +
          'href="https://www.openstreetmap.org/?mlat=' + h.lat + '&mlon=' + h.lng + '#map=15/' + h.lat + '/' + h.lng + '">View on map</a>' +
      '</div></div>';
  }).join("");
}

function initHospitalsSection() {
  const list = document.getElementById("hospitalList");
  if (!list) return;

  const m = createRwandaMap("hospMap", { zoom: 7 });
  if (m) addHospitalMarkers(m, RW_HOSPITALS);

  renderHospitalList(null);

  const btn = document.getElementById("findNearby");
  const status = document.getElementById("nearbyStatus");
  if (btn) btn.addEventListener("click", function () {
    if (!navigator.geolocation) { status.textContent = "Geolocation is not supported by your browser."; return; }
    status.textContent = "Finding hospitals near you...";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        status.textContent = "Sorted by distance from your current location.";
        renderHospitalList({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      function () { status.textContent = "Could not get your location. Showing all hospitals."; }
    );
  });
}

/* ------------------------------------------------------------
   5. Drone tracking + Premium drone requests (Services page)
   ------------------------------------------------------------ */
function initDronePage() {
  const map = createRwandaMap("droneMap", { center: [29.9, -2.0], zoom: 7.5 });
  if (!map) return;

  const base = DRONE_BASES[0];
  const dest = RW_HOSPITALS.find(h => h.name.indexOf("Ruhengeri") >= 0) || RW_HOSPITALS[0];

  simpleMarker(map, base.lng, base.lat, "base-pin", "B", "<strong>" + base.name + "</strong><br>Drone launch site");
  simpleMarker(map, dest.lng, dest.lat, "hosp-pin", "H", "<strong>" + dest.name + "</strong><br>Delivery destination");
  addRoute(map, [[base.lng, base.lat], [dest.lng, dest.lat]], "bdc-drone-route");
  const drone = simpleMarker(map, base.lng, base.lat, "drone-pin");

  const totalKm = haversine(base.lat, base.lng, dest.lat, dest.lng);
  const cruiseKmh = 100;
  let t = 0;
  const stepPer = 0.0035;

  const elStatus = document.getElementById("droneStatus");
  const elProg = document.getElementById("droneProgress");
  const elEta = document.getElementById("droneEta");
  const elDist = document.getElementById("droneDist");
  const elSpeed = document.getElementById("droneSpeed");
  const elPayload = document.getElementById("dronePayload");

  if (elDist) elDist.textContent = totalKm.toFixed(1) + " km";
  if (elSpeed) elSpeed.textContent = cruiseKmh + " km/h";
  if (elPayload) elPayload.textContent = "2 units O- red cells";

  function tick() {
    t += stepPer;
    if (t >= 1) {
      drone.setLngLat([dest.lng, dest.lat]);
      if (elStatus) { elStatus.textContent = "Delivered - releasing package by parachute"; elStatus.className = "drone-badge delivered"; }
      if (elProg) elProg.style.width = "100%";
      if (elEta) elEta.textContent = "Arrived";
      setTimeout(function () { t = 0; }, 2500);
      return;
    }
    const lat = base.lat + (dest.lat - base.lat) * t;
    const lng = base.lng + (dest.lng - base.lng) * t;
    drone.setLngLat([lng, lat]);
    const remainKm = totalKm * (1 - t);
    const etaMin = Math.max(0, Math.round(remainKm / cruiseKmh * 60));
    if (elStatus) { elStatus.textContent = "In flight - en route to " + dest.city; elStatus.className = "drone-badge flying"; }
    if (elProg) elProg.style.width = Math.round(t * 100) + "%";
    if (elEta) elEta.textContent = etaMin + " min";
  }

  tick();
  setInterval(tick, 250);

  initDroneRequestBox();
}

async function initDroneRequestBox() {
  const box = document.getElementById("droneRequestBox");
  if (!box) return;

  const account = await DB.currentAccount();
  if (!account || account.role !== "hospital") {
    box.innerHTML = '<div class="locked-panel"><div class="lock-ico">&#128274;</div>' +
      '<p><strong>Log in as a hospital to request drone delivery.</strong></p>' +
      '<p class="muted"><a href="dashboard.html">Log in or register your hospital</a> first.</p></div>';
    return;
  }
  const h = account.record;
  const isPremium = h.subscriptionPlan === "Premium" && h.subscriptionStatus === "active";
  if (!isPremium) {
    box.innerHTML = '<div class="locked-panel"><div class="lock-ico">&#128274;</div>' +
      '<p><strong>Drone delivery requests are a Premium feature.</strong></p>' +
      '<p class="muted">' + esc(h.name) + ' currently has the ' + tierBadge(h.subscriptionPlan) + ' plan. ' +
      '<a href="subscribe.html">Upgrade to Premium</a> for unlimited priority drone delivery.</p></div>';
    return;
  }

  box.innerHTML =
    '<form id="droneReqForm" class="form-grid" novalidate>' +
      '<div class="field"><label for="drBlood">Blood group needed</label>' +
        '<select id="drBlood"><option>A+</option><option>A-</option><option>B+</option><option>B-</option>' +
        '<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>' +
      '<div class="field"><label for="drUnits">Units needed</label><input type="number" id="drUnits" min="1" max="20" value="2" /></div>' +
      '<div class="field field-wide"><label for="drUrgency">Urgency</label>' +
        '<select id="drUrgency"><option>Standard</option><option>Emergency</option></select></div>' +
      '<div class="field field-wide form-actions"><button type="submit" class="btn btn-primary btn-lg">Request drone delivery</button></div>' +
      '<div id="drMsg" class="form-message"></div>' +
    '</form>' +
    '<div class="hosp-grid" id="droneReqList" style="margin-top:16px"></div>';

  async function renderList() {
    try {
      const list = await DB.getDroneRequests();
      const box2 = document.getElementById("droneReqList");
      if (!box2) return;
      box2.innerHTML = list.length ? list.slice().reverse().map(d =>
        '<div class="hosp-card"><div class="hosp-top"><h3>' + d.bloodGroup + ' &middot; ' + d.units + ' unit(s)</h3>' +
        '<span class="tag ' + (d.status === "delivered" ? "tag-ok" : "tag-warn") + '">' + d.status + '</span></div>' +
        '<p class="muted">' + d.urgency + ' &middot; requested ' + new Date(d.createdOn).toLocaleString() + '</p></div>'
      ).join("") : '<p class="muted">No drone requests yet.</p>';
    } catch (e) { /* ignore transient errors */ }
  }
  renderList();
  setInterval(renderList, 5000); // statuses progress server-side: queued -> in-flight -> delivered

  document.getElementById("droneReqForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("drMsg");
    try {
      const dr = await DB.addDroneRequest({
        bloodGroup: document.getElementById("drBlood").value,
        units: parseInt(document.getElementById("drUnits").value, 10) || 1,
        urgency: document.getElementById("drUrgency").value
      });
      showMsg(msg, "Drone delivery requested: " + dr.units + " unit(s) of " + dr.bloodGroup + ".", "success");
      document.getElementById("droneReqForm").reset();
      renderList();
    } catch (err) {
      showMsg(msg, err.message, "error");
    }
  });
}

/* ------------------------------------------------------------
   6. Health guide tabs (health page) + generic tab bars
   ------------------------------------------------------------ */
function initHealthTabs() {
  const tabBar = document.getElementById("healthTabs");
  if (!tabBar) return;
  const tabs = tabBar.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(tab.getAttribute("data-tab"));
      if (target) target.classList.add("active");
    });
  });
}

/* Tab bars that switch sibling panels (Directory and Services pages).
   Supports deep links: #hospitals opens the hospitals tab, etc. */
function initPageTabs(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const tabs = bar.querySelectorAll(".tab");
  function activate(name) {
    tabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-tab") === name));
    document.querySelectorAll("[data-tab-panel]").forEach(p =>
      p.style.display = p.getAttribute("data-tab-panel") === name ? "block" : "none");
    // Maps inside a hidden panel render at zero size - poke them on reveal.
    window.dispatchEvent(new Event("resize"));
  }
  tabs.forEach(t => t.addEventListener("click", function () {
    activate(t.getAttribute("data-tab"));
    history.replaceState(null, "", "#" + t.getAttribute("data-tab"));
  }));
  const wanted = window.location.hash.replace("#", "");
  const names = Array.from(tabs).map(t => t.getAttribute("data-tab"));
  activate(names.indexOf(wanted) >= 0 ? wanted : names[0]);
}

/* ------------------------------------------------------------
   7. Funds (Services page) - REAL money via Flutterwave
   ------------------------------------------------------------ */
async function initFundsPage() {
  const form = document.getElementById("fundForm");
  if (!form) return;

  const bar = document.getElementById("fundBar");
  const raisedEl = document.getElementById("fundRaised");
  const goalEl = document.getElementById("fundGoal");
  const msg = document.getElementById("fundMessage");

  function fmt(n) { return "RWF " + n.toLocaleString("en-US"); }
  async function render() {
    try {
      const f = await DB.getFunds();
      const pct = Math.min(100, Math.round(f.raised / f.goal * 100));
      if (bar) { bar.style.width = pct + "%"; bar.textContent = pct + "%"; }
      if (raisedEl) raisedEl.textContent = fmt(f.raised);
      if (goalEl) goalEl.textContent = fmt(f.goal);
    } catch (e) { /* server offline */ }
  }
  render();
  handlePaymentReturn(msg);

  document.querySelectorAll(".amount-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.getElementById("fundAmount").value = chip.getAttribute("data-amt");
    });
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("fundName").value.trim() || "Anonymous";
    const amt = parseInt(document.getElementById("fundAmount").value, 10);
    if (isNaN(amt) || amt < 500) { showMsg(msg, "Please enter an amount of at least RWF 500.", "error"); return; }
    payFlow({ kind: "fund", amount: amt, name }, msg, "services.html?payment=success#funds");
  });
}

/* ------------------------------------------------------------
   8. Subscriptions (subscribe page) - REAL payment
   ------------------------------------------------------------ */
function initSubscribePage() {
  const page = document.getElementById("subscribePage");
  if (!page) return;

  const statusBox = document.getElementById("subCurrentStatus");
  const hospitalPlans = document.getElementById("hospitalPlans");
  const pharmacyPlans = document.getElementById("pharmacyPlans");
  const paymentPanel = document.getElementById("paymentPanel");
  const chosenPlanLabel = document.getElementById("chosenPlanLabel");
  const chosenPriceLabel = document.getElementById("chosenPriceLabel");
  const accountFields = document.getElementById("subAccountFields");
  const msg = document.getElementById("subMessage");
  let currentRole = "hospital";
  let chosenPlan = null;
  let loggedInAccount = null;

  function price() { return PLAN_PRICES[currentRole][chosenPlan] || 0; }

  function switchRoleView(role) {
    currentRole = role;
    document.querySelectorAll("#subRoleSwitch .tab").forEach(t => t.classList.toggle("active", t.getAttribute("data-role") === role));
    hospitalPlans.style.display = role === "hospital" ? "grid" : "none";
    pharmacyPlans.style.display = role === "pharmacy" ? "grid" : "none";
    paymentPanel.style.display = "none";
    chosenPlan = null;
  }
  document.querySelectorAll("#subRoleSwitch .tab").forEach(function (tab) {
    tab.addEventListener("click", function () { switchRoleView(tab.getAttribute("data-role")); });
  });

  function renderStatus(record) {
    if (!record) { statusBox.style.display = "none"; return; }
    const plan = record.subscriptionPlan || "none";
    const active = record.subscriptionStatus === "active";
    let extra = "";
    if (!active && record.trialDaysLeft > 0) {
      extra = '<p class="form-message show success" style="text-align:left;margin-top:10px">Free trial active - ' +
        record.trialDaysLeft + ' day(s) left (ends ' + (record.trialEnd || "").slice(0, 10) + '). Subscribe below to continue seamlessly afterwards.</p>';
    } else if (active && record.subscriptionEnd) {
      const daysLeft = daysBetween(new Date(), new Date(record.subscriptionEnd));
      extra = '<p class="muted" style="margin-top:6px">Renews / expires in ' + daysLeft + ' day(s), on ' + record.subscriptionEnd.slice(0, 10) + '.</p>';
    } else if (record.subscriptionStatus === "expired") {
      extra = '<p class="form-message show error" style="text-align:left;margin-top:10px">This plan expired on ' + (record.subscriptionEnd || "").slice(0, 10) + '. Choose a plan below to renew.</p>';
    }
    statusBox.style.display = "block";
    statusBox.innerHTML = '<h2>Current plan for ' + esc(record.name) + '</h2>' +
      '<p style="margin-top:6px">' + tierBadge(plan) + (active ? ' <span class="tag tag-ok">Active</span>' : ' <span class="tag tag-warn">Inactive</span>') + '</p>' + extra;
  }

  DB.currentAccount().then(function (account) {
    if (account && (account.role === "hospital" || account.role === "pharmacy")) {
      loggedInAccount = account;
      switchRoleView(account.role);
      document.querySelectorAll("#subRoleSwitch .tab").forEach(t => t.disabled = t.getAttribute("data-role") !== account.role);
      renderStatus(account.record);
      accountFields.style.display = "none";
      const who = document.getElementById("subLoggedInAs");
      if (who) { who.style.display = "block"; who.textContent = "Paying as: " + account.record.name + " (" + account.record.email + ")"; }
      if (account.record.approved === false) {
        showMsg(msg, "Your " + account.role + " account is awaiting approval by the site administrator. You can pick a plan, but payment is blocked until the account is approved.", "error");
      }
    }
    handlePaymentReturn(msg);
    if (new URLSearchParams(window.location.search).get("payment") === "success" && account) {
      DB.currentAccount().then(a => a && renderStatus(a.record));
    }
  });

  document.querySelectorAll("[data-choose-plan]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      chosenPlan = btn.getAttribute("data-choose-plan");
      chosenPlanLabel.textContent = chosenPlan;
      chosenPriceLabel.textContent = "RWF " + price().toLocaleString("en-US");
      paymentPanel.style.display = "block";
      document.querySelectorAll(".plan-card").forEach(c => c.classList.remove("chosen"));
      btn.closest(".plan-card").classList.add("chosen");
      paymentPanel.scrollIntoView({ behavior: "smooth" });
    });
  });

  const form = document.getElementById("paymentForm");
  if (form) form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!chosenPlan) { showMsg(msg, "Please choose a plan above first.", "error"); return; }

    try {
      if (!loggedInAccount) {
        // Register (or log in) the organisation first, so the plan lands on a real account.
        const name = document.getElementById("subName").value.trim();
        const email = document.getElementById("subEmail").value.trim();
        const password = document.getElementById("subPassword").value;
        if (name.length < 2 || email.length < 5 || password.length < 4) {
          showMsg(msg, "Please fill in your " + currentRole + " name, email, and a password of at least 4 characters.", "error");
          return;
        }
        try {
          await DB.registerOrg({ role: currentRole, name, email, password });
        } catch (err) {
          // Account exists already - try logging in with the given password.
          await DB.loginWithPassword(currentRole, email, password);
        }
        initHeaderAccount();
      }
      await payFlow({ kind: "subscription", plan: chosenPlan, amount: price() }, msg, "subscribe.html?payment=success");
    } catch (err) {
      showMsg(msg, err.message, "error");
    }
  });
}

/* ------------------------------------------------------------
   9. My Account dashboard (dashboard page)
   ------------------------------------------------------------ */
/* Free-trial banner for hospital/pharmacy dashboards. The server sends
   trialDaysLeft and access computed from server time. */
function trialBanner(account) {
  const active = account.subscriptionStatus === "active";
  if (active) return "";
  if (account.trialDaysLeft > 0) {
    return '<p class="form-message show success" style="text-align:left">' +
      '<strong>Free trial:</strong> ' + account.trialDaysLeft + ' day(s) left (ends ' +
      (account.trialEnd || "").slice(0, 10) + '). You have full access - <a href="subscribe.html">subscribe</a> ' +
      'any time to continue without interruption.</p>';
  }
  if (account.trialEnd && account.access === false) {
    return '<p class="form-message show error" style="text-align:left">' +
      '<strong>Your free trial has ended.</strong> Your account and data are safe, but posting and listing are paused. ' +
      '<a href="subscribe.html">Choose a plan</a> to continue.</p>';
  }
  return "";
}

function subscriptionExpiryBanner(account) {
  if (!account.subscriptionEnd || account.subscriptionStatus === "none") return "";
  const daysLeft = daysBetween(new Date(), new Date(account.subscriptionEnd));
  if (account.subscriptionStatus === "expired" || daysLeft < 0) {
    return '<p class="form-message show error" style="text-align:left">Your subscription has expired. ' +
      '<a href="subscribe.html">Renew now</a> to keep using ' + (account.role === "pharmacy" ? "the pharmacy listing" : "blood request / drone") + ' features.</p>';
  }
  if (daysLeft <= 7) {
    return '<p class="form-message show error" style="text-align:left;background:#fff8e6;color:#806100;border-color:#f2e0a8">' +
      'Your ' + account.subscriptionPlan + ' plan expires in ' + daysLeft + ' day(s). <a href="subscribe.html">Renew now</a>.</p>';
  }
  return "";
}

function setAvatarBox(el, name, url) {
  if (!el) return;
  if (url) {
    el.innerHTML = '<img src="' + esc(url) + '" alt="Profile photo" />';
    el.classList.add("has-photo");
    el.title = "Click to view the full photo";
    el.onclick = function () {
      if (typeof widgetOverlay === "function") {
        widgetOverlay("Profile photo", '<img class="avatar-full" src="' + esc(url) + '" alt="Profile photo" />');
      }
    };
  } else {
    el.innerHTML = esc((name || "?").charAt(0).toUpperCase());
    el.classList.remove("has-photo");
    el.title = "";
    el.onclick = null;
  }
}

/* Shared bio editor: a small textarea + save button. */
function wireBioEditor(areaId, saveId, current, afterSave) {
  const area = document.getElementById(areaId);
  const save = document.getElementById(saveId);
  if (!area || !save) return;
  area.value = current || "";
  save.onclick = async function () {
    save.textContent = "Saving...";
    try {
      const rec = await DB.updateProfile({ bio: area.value.trim() });
      save.textContent = "Saved";
      setTimeout(() => { save.textContent = "Save bio"; }, 1500);
      if (afterSave) afterSave(rec);
    } catch (e) {
      save.textContent = "Save bio";
      alert(e.message);
    }
  };
}

function initDashboard() {
  const wrap = document.getElementById("dashboard");
  if (!wrap) return;

  const loginCard = document.getElementById("loginCard");
  const donorPanel = document.getElementById("donorPanel");
  const hospitalPanel = document.getElementById("hospitalPanel");
  const pharmacyPanel = document.getElementById("pharmacyPanel");
  const adminPanel = document.getElementById("adminPanel");

  function hideAll() {
    loginCard.style.display = "none";
    donorPanel.style.display = "none";
    hospitalPanel.style.display = "none";
    pharmacyPanel.style.display = "none";
    if (adminPanel) adminPanel.style.display = "none";
  }

  handlePaymentReturn(document.getElementById("dashPayMsg"));

  /* Change-password forms (one per role panel, ids d/h/ph + PwForm). */
  ["d", "h", "ph"].forEach(function (prefix) {
    const form = document.getElementById(prefix + "PwForm");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const cur = document.getElementById(prefix + "PwCur");
      const nw = document.getElementById(prefix + "PwNew");
      const msg = document.getElementById(prefix + "PwMsg");
      try {
        await DB.changePassword(cur.value, nw.value);
        form.reset();
        showMsg(msg, "Password updated. Any other devices logged into this account have been logged out.", "success");
      } catch (err) {
        showMsg(msg, err.message, "error");
      }
    });
  });

  /* ---------- Role tabs on the logged-out view ---------- */
  const roleTabs = document.querySelectorAll("#roleTabs .tab");
  roleTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      roleTabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll("#loginCard .tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("role-" + tab.getAttribute("data-role")).classList.add("active");
    });
  });
  const showHospReg = document.getElementById("showHospitalRegister");
  if (showHospReg) showHospReg.addEventListener("click", function () {
    document.getElementById("hospitalRegisterPanel").style.display = "block";
    initOrgRegisterMap("hospital");
  });
  const showPharmReg = document.getElementById("showPharmacyRegister");
  if (showPharmReg) showPharmReg.addEventListener("click", function () {
    document.getElementById("pharmacyRegisterPanel").style.display = "block";
    initOrgRegisterMap("pharmacy");
  });

  /* Location pickers inside the register panels so hospitals/pharmacies
     appear at the right place on the maps. */
  const orgPicked = { hospital: null, pharmacy: null };
  function initOrgRegisterMap(role) {
    const elId = role === "hospital" ? "hRegMap" : "pRegMap";
    const el = document.getElementById(elId);
    if (!el || el._maplibreInit) return;
    el._maplibreInit = true;
    const m = createRwandaMap(elId, { zoom: 7 });
    if (m) makePicker(m, function (lat, lng) {
      orgPicked[role] = { lat, lng };
      const txt = document.getElementById(role === "hospital" ? "hRegLocText" : "pRegLocText");
      if (txt) txt.textContent = "Location pinned: " + lat.toFixed(4) + ", " + lng.toFixed(4);
    });
  }

  /* ---------- My medicine orders (buyer view, shown on the donor panel) ---------- */
  function purchaseStatus(o) {
    if (o.rxStatus === "pending") return '<span class="tag tag-warn">Awaiting pharmacist review</span>';
    if (o.rxStatus === "rejected") return '<span class="tag tag-blood">Rejected by pharmacist</span>';
    if (o.payment === "paid-online") return '<span class="tag tag-ok">Paid online</span>';
    if (o.rxStatus === "approved") return '<span class="tag tag-ok">Approved - pay online or at the pharmacy</span>';
    return '<span class="tag tag-ok">Reserved - pay at the pharmacy</span>';
  }
  async function renderPurchases(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return;
    let orders = [];
    try { orders = await DB.getPurchases(); } catch (e) { box.innerHTML = ""; return; }
    if (!orders.length) {
      box.innerHTML = '<p class="muted">No medicine orders yet. Order on the <a href="medicines.html">Medicines page</a> - prescription orders are reviewed by the pharmacist and tracked here.</p>';
      return;
    }
    const payable = o => o.payment !== "paid-online" && o.payment !== "cancelled" && o.rxStatus !== "pending" && o.rxStatus !== "rejected";
    box.innerHTML = '<div class="hosp-grid">' + orders.slice().reverse().map(o =>
      '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(o.medicineName || o.medicineId) + '</h3>' + purchaseStatus(o) + '</div>' +
      '<p class="muted">' + o.qty + ' unit(s) &middot; RWF ' + (o.total || 0).toLocaleString("en-US") +
        ' &middot; ' + esc(o.pharmacyName || "") + ' &middot; ' + new Date(o.date).toLocaleDateString() + '</p>' +
      (o.rxStatus === "rejected" && o.rxNote ? '<p class="muted" style="font-size:.88rem">Pharmacist\'s note: &ldquo;' + esc(o.rxNote) + '&rdquo;</p>' : '') +
      (payable(o) ? '<div class="hosp-actions"><button class="btn btn-primary btn-sm" data-pay-order="' + o.id + '">Pay online now</button></div>' : '') +
      '</div>').join("") + '</div>';
    box.querySelectorAll("[data-pay-order]").forEach(btn => btn.addEventListener("click", async function () {
      const card = btn.closest(".hosp-card");
      const msgEl = document.getElementById("dashPayMsg");
      try {
        await payFlow({ kind: "order-payment", orderId: parseInt(btn.getAttribute("data-pay-order"), 10) },
          msgEl, "dashboard.html?payment=success");
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) { alert(e.message); }
    }));
  }

  /* ---------- Donor ---------- */
  async function showDonor(donor) {
    hideAll();
    donorPanel.style.display = "block";

    let nextEligible = "Eligible now", statusClass = "ok";
    if (donor.lastDonation) {
      const next = new Date(new Date(donor.lastDonation).getTime() + 56 * 24 * 60 * 60 * 1000);
      const left = daysBetween(new Date(), next);
      if (left > 0) { nextEligible = "In " + left + " day(s)"; statusClass = "wait"; }
    }

    document.getElementById("dName").textContent = donor.fullName;
    document.getElementById("dSub").textContent = "Donor account · member since " + new Date(donor.registeredOn || Date.now()).toISOString().slice(0, 10);
    document.getElementById("dGroup").textContent = donor.bloodGroup;
    document.getElementById("dContact").textContent = donor.contact;
    document.getElementById("dCity").textContent = donor.city;
    document.getElementById("dAge").textContent = donor.age;
    document.getElementById("dRegistered").textContent = new Date(donor.registeredOn || Date.now()).toISOString().slice(0, 10);
    document.getElementById("dNextShort").textContent = statusClass === "ok" ? "Now" : nextEligible.replace("In ", "");

    const donations = donor.donations || [];
    document.getElementById("dHistory").innerHTML = donations.length
      ? donations.map(x => '<li><span>' + esc(x.date) + '</span><span>' + esc(x.place || "") + '</span></li>').join("")
      : '<li class="muted">No donations recorded yet.</li>';
    document.getElementById("dCount").textContent = donations.length;
    document.getElementById("dLives").textContent = donations.length * 3;

    const vEl = document.getElementById("dVerify");
    const v = donor.verificationStatus || "none";
    vEl.textContent = v === "approved" ? "Verified by " + (donor.verifiedBy || "a hospital")
      : v === "pending" ? "Pending hospital verification"
      : v === "rejected" ? "Verification rejected" : "No document on file";
    vEl.className = "pill " + (v === "approved" ? "ok" : v === "rejected" ? "danger" : "wait");

    setAvatarBox(document.getElementById("dAvatarBox"), donor.fullName, donor.avatarUrl);
    wireBioEditor("dBioArea", "dBioSave", donor.bio);
    renderPurchases("dPurchases");

    const mapEl = document.getElementById("dMap");
    if (typeof donor.lat === "number" && mapEl && !mapEl._maplibreInit) {
      mapEl._maplibreInit = true;
      const dm = createRwandaMap("dMap", { center: [donor.lng, donor.lat], zoom: 12 });
      if (dm) simpleMarker(dm, donor.lng, donor.lat, "donor-pin", "", "Your saved location");
    }
  }

  const loginForm = document.getElementById("loginForm");
  const loginMsg = document.getElementById("loginMsg");
  if (loginForm) loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      const donor = await DB.loginWithPassword("donor",
        document.getElementById("loginContact").value.trim(),
        document.getElementById("loginPassword").value);
      initHeaderAccount();
      showDonor(donor);
    } catch (err) {
      showMsg(loginMsg, err.message, "error");
    }
  });

  const recordBtn = document.getElementById("recordDonation");
  if (recordBtn) recordBtn.addEventListener("click", async function () {
    try { showDonor(await DB.recordDonation()); } catch (e) { alert(e.message); }
  });

  async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return null;
    const up = await DB.upload(file);
    return DB.updateProfile({ avatarUrl: up.url });
  }
  const dAvatarInput = document.getElementById("dAvatarInput");
  if (dAvatarInput) dAvatarInput.addEventListener("change", async function () {
    try { const rec = await uploadAvatar(dAvatarInput); if (rec) showDonor(rec); } catch (e) { alert(e.message); }
  });

  document.getElementById("logoutBtn").addEventListener("click", async function () { await DB.logout(); location.reload(); });

  /* ---------- Hospital ---------- */
  async function showHospital(h) {
    hideAll();
    hospitalPanel.style.display = "block";
    document.getElementById("hName").textContent = h.name;
    document.getElementById("hTierBadge").innerHTML = tierBadge(h.subscriptionPlan);
    document.getElementById("hSub").textContent = "Hospital account · " + (h.city || "");
    document.getElementById("hExpiryBanner").innerHTML =
      (h.approved === false
        ? '<p class="form-message show error" style="text-align:left;background:#fff8e6;color:#806100;border-color:#f2e0a8">' +
          'Your hospital account is <strong>awaiting approval</strong> by the site administrator. Once approved, your free 7-day trial starts automatically.</p>'
        : '') +
      trialBanner(h) +
      subscriptionExpiryBanner(Object.assign({ role: "hospital" }, h));
    setAvatarBox(document.getElementById("hAvatarBox"), h.name, h.avatarUrl);
    wireBioEditor("hBioArea", "hBioSave", h.bio);

    const allRequests = await DB.getRequests();
    const myRequests = allRequests.filter(r => r.hospitalEmail === h.email);
    document.getElementById("hStatRequests").textContent = myRequests.length;
    let droneReqs = [];
    try { droneReqs = await DB.getDroneRequests(); } catch (e) { /* not premium / none */ }
    document.getElementById("hStatDrones").textContent = droneReqs.length;
    const donors = await DB.getDonors();
    document.getElementById("hStatVerified").textContent = 0; // filled below from pending list refresh

    const reqList = document.getElementById("hospitalRequestList");
    reqList.innerHTML = myRequests.length
      ? myRequests.map(r => '<div class="hosp-card req-card"><div class="hosp-top"><h3>Needs ' + esc(r.bloodGroup) + '</h3>' + statusBadge(r) + '</div>' +
          '<p class="muted">' + (r.units || "?") + ' unit(s) &middot; ' + esc(r.place) + '</p></div>').join("")
      : '<p class="muted">You have not posted any blood requests yet. <a href="directory.html#requests">Post one</a> (requires an active subscription).</p>';

    const droneBox = document.getElementById("hospitalDroneBox");
    const isPremium = h.subscriptionPlan === "Premium" && h.subscriptionStatus === "active";
    droneBox.innerHTML = (isPremium
      ? '<p class="muted">Request priority drone delivery from the <a href="services.html#drone">Services page</a>.</p>'
      : '<div class="locked-panel"><div class="lock-ico">&#128274;</div><p><strong>Drone delivery requests are a Premium feature.</strong></p>' +
        '<p class="muted">Upgrade on the <a href="subscribe.html">Subscribe page</a> to unlock unlimited priority drone delivery.</p></div>') +
      (droneReqs.length ? '<div class="hosp-grid" style="margin-top:14px">' + droneReqs.map(d =>
        '<div class="hosp-card"><div class="hosp-top"><h3>' + d.bloodGroup + ' &middot; ' + d.units + ' unit(s)</h3>' +
        '<span class="tag ' + (d.status === "delivered" ? "tag-ok" : "tag-warn") + '">' + d.status + '</span></div>' +
        '<p class="muted">Requested ' + new Date(d.createdOn).toLocaleDateString() + '</p></div>').join("") + '</div>' : '');

    const verifyBox = document.getElementById("verifyQueueList");
    let pending = [];
    try { pending = await DB.getPendingVerifications(); } catch (e) { /* needs hospital login */ }
    document.getElementById("hStatVerified").textContent =
      donors.filter(d => d.verificationStatus === "approved").length;
    function docChip(d) {
      if (d.docStatus === "ai-passed") return '<span class="tag tag-ok" title="' + esc(d.docNote || "") + '">AI check: looks genuine</span>';
      if (d.docStatus === "needs-review") return '<span class="tag tag-blood" title="' + esc(d.docNote || "") + '">FLAGGED: ' + esc(d.docNote || "needs review") + '</span>';
      if (d.docStatus === "verified") return '<span class="tag tag-ok">Verified by admin</span>';
      if (d.docStatus === "rejected") return '<span class="tag tag-blood">Rejected by admin</span>';
      return d.docStatus ? '<span class="tag tag-warn">Check pending</span>' : '';
    }
    verifyBox.innerHTML = pending.length
      ? pending.map(d => '<div class="hosp-card verify-card">' +
          '<div class="hosp-top"><h3>' + esc(d.fullName) + '</h3><span class="tag tag-blood">' + esc(d.bloodGroup) + '</span></div>' +
          '<p class="muted">Contact: ' + esc(d.contact) + ' &middot; ' + esc(d.screeningName || "certificate uploaded") + ' ' + docChip(d) + '</p>' +
          '<div class="hosp-actions">' +
            (d.screeningUrl ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(DB.docUrl(d.screeningUrl)) + '">View certificate</a>' : '') +
            '<button class="btn btn-primary btn-sm" data-approve="' + esc(d.contact) + '">Approve</button>' +
            '<button class="btn btn-ghost btn-sm" data-reject="' + esc(d.contact) + '">Reject</button>' +
          '</div></div>').join("")
      : '<p class="muted">No donor documents are waiting for verification right now.</p>';
    verifyBox.querySelectorAll("[data-approve]").forEach(btn => btn.addEventListener("click", async function () {
      await DB.setVerification(btn.getAttribute("data-approve"), "approved", "");
      showHospital(h);
    }));
    verifyBox.querySelectorAll("[data-reject]").forEach(btn => btn.addEventListener("click", async function () {
      await DB.setVerification(btn.getAttribute("data-reject"), "rejected", "Certificate could not be confirmed.");
      showHospital(h);
    }));
  }

  const hospLoginForm = document.getElementById("hospitalLoginForm");
  if (hospLoginForm) hospLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("hLoginMsg");
    try {
      const h = await DB.loginWithPassword("hospital",
        document.getElementById("hLoginEmail").value.trim(),
        document.getElementById("hLoginPassword").value);
      initHeaderAccount();
      showHospital(h);
    } catch (err) { showMsg(msg, err.message, "error"); }
  });

  const hospRegForm = document.getElementById("hospitalRegisterForm");
  if (hospRegForm) hospRegForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("hRegMsg");
    try {
      const h = await DB.registerOrg({
        role: "hospital",
        name: document.getElementById("hRegName").value.trim(),
        city: document.getElementById("hRegCity").value.trim(),
        email: document.getElementById("hRegEmail").value.trim(),
        phone: document.getElementById("hRegPhone").value.trim(),
        password: document.getElementById("hRegPassword").value,
        lat: orgPicked.hospital ? orgPicked.hospital.lat : null,
        lng: orgPicked.hospital ? orgPicked.hospital.lng : null
      });
      initHeaderAccount();
      showHospital(h);
    } catch (err) { showMsg(msg, err.message, "error"); }
  });

  const hAvatarInput = document.getElementById("hAvatarInput");
  if (hAvatarInput) hAvatarInput.addEventListener("change", async function () {
    try { const rec = await uploadAvatar(hAvatarInput); if (rec) showHospital(rec); } catch (e) { alert(e.message); }
  });
  const hLogout = document.getElementById("hLogoutBtn");
  if (hLogout) hLogout.addEventListener("click", async function () { await DB.logout(); location.reload(); });

  /* ---------- Pharmacy ---------- */
  async function showPharmacy(p) {
    hideAll();
    pharmacyPanel.style.display = "block";
    document.getElementById("phName").textContent = p.name;
    document.getElementById("phTierBadge").innerHTML = tierBadge(p.subscriptionPlan);
    document.getElementById("phSub").textContent = "Pharmacy account · " + (p.city || "");
    document.getElementById("phExpiryBanner").innerHTML =
      (p.approved === false
        ? '<p class="form-message show error" style="text-align:left;background:#fff8e6;color:#806100;border-color:#f2e0a8">' +
          'Your pharmacy account is <strong>awaiting approval</strong> by the site administrator. Once approved, your free 7-day trial starts automatically.</p>'
        : '') +
      trialBanner(p) +
      subscriptionExpiryBanner(Object.assign({ role: "pharmacy" }, p));
    setAvatarBox(document.getElementById("phAvatarBox"), p.name, p.avatarUrl);
    wireBioEditor("phBioArea", "phBioSave", p.bio);

    const medicines = await DB.getMedicines();
    let orders = [];
    try { orders = await DB.getMyOrders(); } catch (e) { /* none */ }
    const totalUnits = orders.reduce((sum, o) => sum + (o.qty || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    document.getElementById("phStatMeds").textContent = medicines.length;
    document.getElementById("phStatUnits").textContent = totalUnits;
    document.getElementById("phStatRevenue").textContent = "RWF " + totalRevenue.toLocaleString("en-US");

    const stockRows = await DB.getAllStock();
    const myStock = {};
    stockRows.filter(s => s.pharmacyEmail === p.email).forEach(s => { myStock[s.medicineId] = s.qty; });

    const medList = document.getElementById("pharmacyMedList");
    // Paid subscription OR active free trial can list (server enforces too).
    const canList = p.subscriptionStatus === "active" || (p.trialEnd && new Date(p.trialEnd) > new Date());
    if (!canList) {
      medList.innerHTML = '<div class="locked-panel"><div class="lock-ico">&#128274;</div>' +
        '<p><strong>An active subscription is needed to list medicines.</strong></p>' +
        '<p class="muted">Choose a plan on the <a href="subscribe.html">Subscribe page</a> to start stocking medicines.</p></div>';
    } else {
      medList.innerHTML = medicines.map(m => {
        const stock = myStock[m.id] || 0;
        return '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(m.name) + '</h3><span class="tag tag-ok">' + stock + ' in stock</span></div>' +
          '<p class="muted">' + esc(m.category) + (m.rx ? ' &middot; <span class="tag tag-warn">Rx</span>' : '') + ' &middot; RWF ' + m.price.toLocaleString("en-US") + '</p>' +
          '<div class="hosp-actions">' +
            '<input type="number" min="0" value="' + stock + '" class="settings-select" style="width:90px" data-stock-input="' + m.id + '" />' +
            '<button class="btn btn-ghost btn-sm" data-save-stock="' + m.id + '">Update stock</button>' +
          '</div></div>';
      }).join("");
      medList.querySelectorAll("[data-save-stock]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          const id = btn.getAttribute("data-save-stock");
          const input = medList.querySelector('[data-stock-input="' + id + '"]');
          try {
            await DB.setStock(id, Math.max(0, parseInt(input.value, 10) || 0));
            showPharmacy(p);
          } catch (e) { alert(e.message); }
        });
      });
    }

    // Orders tab - pending prescriptions must be reviewed by the pharmacist
    // (Approve / Reject) before the buyer can pay or collect.
    const ordersBox = document.getElementById("pharmacyOrdersBox");
    if (ordersBox) {
      function orderChip(o) {
        if (o.rxStatus === "pending") return '<span class="tag tag-warn">Prescription to review</span>';
        if (o.rxStatus === "rejected") return '<span class="tag tag-blood">Rejected</span>';
        if (o.payment === "paid-online") return '<span class="tag tag-ok">Paid online</span>';
        return '<span class="tag tag-ok">Pay at pharmacy</span>';
      }
      ordersBox.innerHTML = orders.length
        ? '<div class="hosp-grid">' + orders.slice().reverse().map(o =>
            '<div class="hosp-card' + (o.rxStatus === "pending" ? ' verify-card' : '') + '">' +
            '<div class="hosp-top"><h3>' + esc(o.medicineName || o.medicineId) + '</h3>' + orderChip(o) + '</div>' +
            '<p class="muted">' + o.qty + ' unit(s) &middot; RWF ' + (o.total || 0).toLocaleString("en-US") +
              ' &middot; ' + new Date(o.date).toLocaleString() + '</p>' +
            '<p class="dist">Buyer: ' + esc(o.buyerName || "Guest") + (o.buyerContact ? " (" + esc(o.buyerContact) + ")" : "") + '</p>' +
            '<div class="hosp-actions">' +
              (o.prescriptionUrl
                ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(DB.docUrl(o.prescriptionUrl)) + '">View prescription</a>'
                : '') +
              (o.rxStatus === "pending"
                ? '<button class="btn btn-primary btn-sm" data-rx-approve="' + o.id + '">Approve</button>' +
                  '<button class="btn btn-ghost btn-sm" data-rx-reject="' + o.id + '">Reject</button>'
                : '') +
            '</div></div>').join("") + '</div>'
        : '<p class="muted">No orders yet. Orders (with any uploaded prescriptions) appear here.</p>';
      ordersBox.querySelectorAll("[data-rx-approve]").forEach(btn => btn.addEventListener("click", async function () {
        try { await DB.rxReview(parseInt(btn.getAttribute("data-rx-approve"), 10), true, ""); showPharmacy(p); }
        catch (e) { alert(e.message); }
      }));
      ordersBox.querySelectorAll("[data-rx-reject]").forEach(btn => btn.addEventListener("click", async function () {
        const note = prompt("Why is this prescription rejected? (shown to the buyer)") || "";
        try { await DB.rxReview(parseInt(btn.getAttribute("data-rx-reject"), 10), false, note); showPharmacy(p); }
        catch (e) { alert(e.message); }
      }));
    }

    const salesBox = document.getElementById("pharmacySalesBox");
    if (!orders.length) {
      salesBox.innerHTML = '<p class="muted">No sales recorded yet. Sales appear here once someone orders a medicine you stock.</p>';
    } else {
      const byMed = {};
      orders.forEach(o => { byMed[o.medicineId] = (byMed[o.medicineId] || 0) + o.qty; });
      const max = Math.max.apply(null, Object.values(byMed));
      salesBox.innerHTML = Object.keys(byMed).map(function (id) {
        const m = medicines.find(x => x.id === id);
        const pct = Math.round((byMed[id] / max) * 100);
        return '<div class="sales-row"><span>' + esc(m ? m.name : id) + '</span><span>' + byMed[id] + ' unit(s)</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
      }).join("");
    }
  }

  const pharmLoginForm = document.getElementById("pharmacyLoginForm");
  if (pharmLoginForm) pharmLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("pLoginMsg");
    try {
      const p = await DB.loginWithPassword("pharmacy",
        document.getElementById("pLoginEmail").value.trim(),
        document.getElementById("pLoginPassword").value);
      initHeaderAccount();
      showPharmacy(p);
    } catch (err) { showMsg(msg, err.message, "error"); }
  });

  const pharmRegForm = document.getElementById("pharmacyRegisterForm");
  if (pharmRegForm) pharmRegForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("pRegMsg");
    try {
      const p = await DB.registerOrg({
        role: "pharmacy",
        name: document.getElementById("pRegName").value.trim(),
        city: document.getElementById("pRegCity").value.trim(),
        email: document.getElementById("pRegEmail").value.trim(),
        phone: document.getElementById("pRegPhone").value.trim(),
        password: document.getElementById("pRegPassword").value,
        lat: orgPicked.pharmacy ? orgPicked.pharmacy.lat : null,
        lng: orgPicked.pharmacy ? orgPicked.pharmacy.lng : null
      });
      initHeaderAccount();
      showPharmacy(p);
    } catch (err) { showMsg(msg, err.message, "error"); }
  });

  const phAvatarInput = document.getElementById("phAvatarInput");
  if (phAvatarInput) phAvatarInput.addEventListener("change", async function () {
    try { const rec = await uploadAvatar(phAvatarInput); if (rec) showPharmacy(rec); } catch (e) { alert(e.message); }
  });
  const phLogout = document.getElementById("phLogoutBtn");
  if (phLogout) phLogout.addEventListener("click", async function () { await DB.logout(); location.reload(); });

  // Tab switching for the hospital and pharmacy profile tab bars.
  [document.getElementById("hospitalTabs"), document.getElementById("pharmacyTabs")].forEach(function (bar) {
    if (!bar) return;
    bar.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        bar.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        bar.parentElement.querySelectorAll(":scope > .tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.getAttribute("data-tab")).classList.add("active");
      });
    });
  });

  /* ---------- Administrator ---------- */
  async function showAdmin() {
    hideAll();
    if (!adminPanel) return;
    adminPanel.style.display = "block";

    // Platform analytics tiles.
    const statsBox = document.getElementById("adminStats");
    if (statsBox) {
      try {
        const st = await DB.adminStats();
        const tiles = [
          ["Donors", st.donors], ["Hospitals", st.hospitals], ["Pharmacies", st.pharmacies],
          ["Pending approvals", st.pendingApprovals], ["Active subscriptions", st.activeSubscriptions],
          ["On free trial", st.onTrial], ["Subs expiring in 7 days", st.expiringWithin7Days],
          ["Pending donor verifications", st.pendingVerifications], ["Flagged documents", st.flaggedDocuments],
          ["Open blood requests", st.openRequests], ["Open donation offers", st.openOffers], ["Medicine orders", st.orders]
        ];
        statsBox.innerHTML = tiles.map(t =>
          '<div class="dash-item"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div></div>').join("");
      } catch (e) { statsBox.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
    }

    // Medical document review queue.
    const docsBox = document.getElementById("adminDocs");
    if (docsBox) {
      try {
        const docs = await DB.adminDocuments();
        const needsFirst = docs.slice().sort((a, b) =>
          (b.docStatus === "needs-review") - (a.docStatus === "needs-review"));
        docsBox.innerHTML = docs.length ? needsFirst.slice(0, 30).map(d =>
          '<div class="hosp-card' + (d.docStatus === "needs-review" ? ' verify-card' : '') + '">' +
          '<div class="hosp-top"><h3 style="text-transform:capitalize">' + esc(d.kind) + '</h3>' +
            '<span class="tag ' + (d.docStatus === "needs-review" ? "tag-blood" : d.docStatus === "ai-passed" || d.docStatus === "verified" ? "tag-ok" : d.docStatus === "rejected" ? "tag-blood" : "tag-warn") + '">' + esc(d.docStatus || "pending") + '</span></div>' +
          '<p class="muted">' + esc(d.ownerRole) + ': ' + esc(d.ownerId) + ' &middot; ' + new Date(d.createdOn).toLocaleString() + '</p>' +
          (d.docNote ? '<p class="muted" style="font-size:.86rem">' + esc(d.docNote) + '</p>' : '') +
          '<div class="hosp-actions">' +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(DB.docUrl(d.url)) + '">View document</a>' +
            (d.docStatus !== "verified" && d.docStatus !== "rejected"
              ? '<button class="btn btn-primary btn-sm" data-doc-verify="' + esc(d.file) + '">Mark verified</button>' +
                '<button class="btn btn-ghost btn-sm" data-doc-reject="' + esc(d.file) + '">Reject</button>'
              : '') +
          '</div></div>').join("")
          : '<p class="muted">No medical documents uploaded yet.</p>';
        docsBox.querySelectorAll("[data-doc-verify]").forEach(btn => btn.addEventListener("click", async function () {
          try { await DB.adminReviewDocument(btn.getAttribute("data-doc-verify"), "verified", ""); showAdmin(); }
          catch (e) { alert(e.message); }
        }));
        docsBox.querySelectorAll("[data-doc-reject]").forEach(btn => btn.addEventListener("click", async function () {
          const note = prompt("Why is this document rejected? (shown to the uploader)") || "";
          try { await DB.adminReviewDocument(btn.getAttribute("data-doc-reject"), "rejected", note); showAdmin(); }
          catch (e) { alert(e.message); }
        }));
      } catch (e) { docsBox.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
    }

    // Audit trail.
    const auditBox = document.getElementById("adminAudit");
    if (auditBox) {
      try {
        const log = await DB.adminAudit();
        auditBox.innerHTML = log.length ? '<ul class="history-list">' + log.map(l =>
          '<li><span><strong>' + esc(l.action) + '</strong> ' + esc(JSON.stringify(l.details)) + '</span>' +
          '<span class="muted">' + new Date(l.at).toLocaleString() + '</span></li>').join("") + '</ul>'
          : '<p class="muted">No admin actions recorded yet.</p>';
      } catch (e) { auditBox.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
    }

    let data;
    try { data = await DB.adminAccounts(); }
    catch (e) { document.getElementById("adminPending").innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; return; }

    const orgs = data.hospitals.map(h => Object.assign({ _role: "hospital" }, h))
      .concat(data.pharmacies.map(p => Object.assign({ _role: "pharmacy" }, p)));

    function orgCard(o, showApprovalButtons) {
      return '<div class="hosp-card' + (o.approved === false ? ' verify-card' : '') + '">' +
        '<div class="hosp-top"><h3>' + esc(o.name) + '</h3>' +
          (o.approved === false ? '<span class="tag tag-warn">Awaiting approval</span>' : '<span class="tag tag-ok">Approved</span>') + '</div>' +
        '<p class="muted" style="text-transform:capitalize">' + o._role + ' &middot; ' + esc(o.city || "no city given") + '</p>' +
        '<p class="dist">' + esc(o.email) + (o.phone ? ' &middot; ' + esc(o.phone) : '') + '</p>' +
        '<p class="muted">' + tierBadge(o.subscriptionPlan) + '</p>' +
        '<div class="hosp-actions">' +
          (showApprovalButtons
            ? '<button class="btn btn-primary btn-sm" data-adm-approve="' + o._role + '|' + esc(o.email) + '">Approve</button>' +
              '<button class="btn btn-ghost btn-sm" data-adm-reject="' + o._role + '|' + esc(o.email) + '">Reject</button>'
            : '<button class="btn btn-ghost btn-sm" data-adm-unapprove="' + o._role + '|' + esc(o.email) + '">Revoke approval</button>') +
          '<button class="btn btn-ghost btn-sm" data-adm-reset="' + o._role + '|' + esc(o.email) + '">Reset password</button>' +
        '</div><p class="dist" data-adm-temp></p></div>';
    }

    const pending = orgs.filter(o => o.approved === false);
    document.getElementById("adminPending").innerHTML = pending.length
      ? pending.map(o => orgCard(o, true)).join("")
      : '<p class="muted">No hospitals or pharmacies are waiting for approval.</p>';

    document.getElementById("adminAccounts").innerHTML =
      orgs.filter(o => o.approved !== false).map(o => orgCard(o, false)).join("") +
      (data.donors.length
        ? data.donors.map(d => '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(d.fullName) + '</h3>' +
            '<span class="tag tag-blood">' + esc(d.bloodGroup || "?") + '</span></div>' +
            '<p class="dist">Donor &middot; ' + esc(d.contact) + '</p>' +
            '<div class="hosp-actions"><button class="btn btn-ghost btn-sm" data-adm-reset="donor|' + esc(d.contact) + '">Reset password</button></div>' +
            '<p class="dist" data-adm-temp></p></div>').join("")
        : '');

    try {
      const fb = await DB.adminFeedback();
      document.getElementById("adminFeedback").innerHTML = fb.length
        ? fb.slice().reverse().map(f => '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(f.name || "Anonymous") + '</h3>' +
            '<span class="tag tag-ok">' + esc(f.category || "Feedback") + '</span></div>' +
            '<p class="muted">' + esc(f.message) + '</p></div>').join("")
        : '<p class="muted">No feedback yet.</p>';
    } catch (e) { /* non-critical */ }

    function wire(attr, handler) {
      adminPanel.querySelectorAll("[" + attr + "]").forEach(btn => btn.addEventListener("click", function () {
        const [role, id] = btn.getAttribute(attr).split("|");
        handler(role, id, btn);
      }));
    }
    wire("data-adm-approve", async (role, id) => { await DB.adminSetApproval(role, id, true); showAdmin(); });
    wire("data-adm-reject", async (role, id) => {
      const note = prompt("Why is this account rejected? (optional)") || "";
      await DB.adminSetApproval(role, id, false, note); showAdmin();
    });
    wire("data-adm-unapprove", async (role, id) => {
      if (confirm("Revoke approval for " + id + "? They will disappear from public lists and lose posting rights.")) {
        await DB.adminSetApproval(role, id, false); showAdmin();
      }
    });
    wire("data-adm-reset", async (role, id, btn) => {
      if (!confirm("Reset the password for " + id + "? Their current password stops working immediately.")) return;
      try {
        const out = await DB.adminResetPassword(role, id);
        const slot = btn.closest(".hosp-card").querySelector("[data-adm-temp]");
        if (slot) slot.textContent = "Temporary password: " + out.tempPassword + " - give it to them privately; they should change it after logging in.";
      } catch (e) { alert(e.message); }
    });
  }

  const adminLoginForm = document.getElementById("adminLoginForm");
  if (adminLoginForm) adminLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("aLoginMsg");
    try {
      await DB.loginWithPassword("admin", "admin", document.getElementById("aLoginPassword").value);
      initHeaderAccount();
      showAdmin();
    } catch (err) { showMsg(msg, err.message, "error"); }
  });
  const aLogout = document.getElementById("aLogoutBtn");
  if (aLogout) aLogout.addEventListener("click", async function () { await DB.logout(); location.reload(); });

  // Auto-show whichever role is already logged in.
  DB.currentAccount().then(function (a) {
    if (!a) return;
    if (a.role === "donor") showDonor(a.record);
    else if (a.role === "hospital") showHospital(a.record);
    else if (a.role === "pharmacy") showPharmacy(a.record);
    else if (a.role === "admin") showAdmin();
  });
}

/* ------------------------------------------------------------
   10. Directory: donors + blood requests (hospitals only)
   ------------------------------------------------------------ */
function contactButton(contact) {
  const c = (contact || "").trim();
  if (!c) return "";
  if (c.indexOf("@") >= 0) {
    return '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(c) + '">Email ' + esc(c) + '</a>';
  }
  return '<a class="btn btn-primary btn-sm" href="tel:' + esc(c.replace(/\s/g, "")) + '">Call ' + esc(c) + '</a>';
}

function mapButton(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" ' +
    'href="https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng +
    '#map=14/' + lat + '/' + lng + '">View on map</a>';
}

function locationText(city, lat, lng) {
  let t = city || "Location not given";
  if (typeof lat === "number" && typeof lng === "number") {
    t += " (" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")";
  }
  return t;
}

async function renderDonorDirectory() {
  const box = document.getElementById("donorList");
  if (!box) return;
  let donors = [];
  try { donors = await DB.getDonors(); } catch (e) {
    box.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; return;
  }
  const count = document.getElementById("donorTotal");
  if (count) count.textContent = donors.length;

  if (!donors.length) {
    box.innerHTML = '<p class="muted">No donors have registered yet. ' +
      'Be the first on the <a href="donate.html">Donate</a> page.</p>';
    return;
  }
  box.innerHTML = donors.map(function (d) {
    const v = d.verificationStatus === "approved"
      ? '<span class="tag tag-ok">&check; Verified</span>' : "";
    return '<div class="hosp-card">' +
      '<div class="hosp-top"><h3>' + esc(d.fullName) + '</h3>' +
        '<span class="tag tag-blood">' + esc(d.bloodGroup || "?") + '</span></div>' +
      '<p class="muted">Donor &middot; ' + esc(locationText(d.city, d.lat, d.lng)) + ' ' + v + '</p>' +
      '<p class="dist">' + (d.contact
        ? 'Contact: ' + esc(d.contact)
        : 'Contact details are visible to hospital accounts only') + '</p>' +
      '<div class="hosp-actions">' + contactButton(d.contact) + mapButton(d.lat, d.lng) + '</div>' +
    '</div>';
  }).join("");
}

function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => (n < 10 ? "0" : "") + n;
  return d + "d " + pad(h) + ":" + pad(m) + ":" + pad(s);
}

function statusBadge(r) {
  const st = r.status || "open";
  if (st === "booked") return '<span class="tag tag-warn">Booked' + (r.bookedBy ? " by " + esc(r.bookedBy) : "") + '</span>';
  if (st === "fulfilled") return '<span class="tag tag-ok">Fulfilled</span>';
  return '<span class="tag tag-ok">Open</span>';
}

let _cachedRequests = null;
let _cachedOffers = null;

/* Reads the board filter controls (search text / type / urgency). */
function boardFilters() {
  const search = (document.getElementById("boardSearch") || {}).value || "";
  const type = (document.getElementById("boardType") || {}).value || "all";
  const urgency = (document.getElementById("boardUrgency") || {}).value || "all";
  return { search: search.trim().toLowerCase(), type, urgency };
}
function matchesSearch(text, search) {
  return !search || text.toLowerCase().indexOf(search) >= 0;
}

/* Volunteer donation-offer card (green accent). */
function renderOfferCard(o, now, session) {
  const msLeft = new Date(o.createdOn).getTime() + REQUEST_MAX_MS - now;
  const adminRemove = session && session.role === "admin"
    ? '<button class="btn btn-ghost btn-sm" data-remove-offer="' + esc(o.id) + '">Remove (admin)</button>' : "";
  return '<div class="hosp-card offer-card">' +
    '<div class="hosp-top"><h3>' + esc(o.fullName) + '</h3>' +
      '<span class="tag tag-ok">Offers to donate ' + esc(o.bloodGroup) + '</span></div>' +
    '<p class="muted">Volunteer donor &middot; ' + esc(o.city) + '</p>' +
    (o.note ? '<p class="muted" style="font-size:.9rem">&ldquo;' + esc(o.note) + '&rdquo;</p>' : '') +
    '<p class="dist">' + (o.contact ? 'Contact: ' + esc(o.contact) : 'Contact details are visible to hospital accounts only') + '</p>' +
    '<div class="countdown"><div class="count-row"><span>Offer expires in</span>' +
      '<strong class="count-value count-ok">' + formatCountdown(msLeft) + '</strong></div></div>' +
    '<div class="hosp-actions">' + contactButton(o.contact) + mapButton(o.lat, o.lng) + adminRemove + '</div>' +
  '</div>';
}

async function renderRequestDirectory(refetch) {
  const box = document.getElementById("requestList");
  if (!box) return;

  if (refetch || !_cachedRequests) {
    try {
      _cachedRequests = await DB.getRequests();
      _cachedOffers = await DB.getOffers();
    }
    catch (e) { box.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; return; }
  }
  const now = Date.now();
  const f = boardFilters();
  const session = DB.currentSession();

  let requests = _cachedRequests.filter(r => now - new Date(r.createdOn).getTime() < REQUEST_MAX_MS)
    .filter(r => f.type === "all" || f.type === "needs")
    .filter(r => f.urgency === "all" || (r.urgency || "Normal") === f.urgency)
    .filter(r => matchesSearch([r.requesterName, r.bloodGroup, r.place, r.note].join(" "), f.search));
  let offers = (_cachedOffers || []).filter(o => now - new Date(o.createdOn).getTime() < REQUEST_MAX_MS)
    .filter(() => f.type === "all" || f.type === "offers")
    .filter(() => f.urgency === "all") // urgency applies to blood needs only
    .filter(o => matchesSearch([o.fullName, o.bloodGroup, o.city, o.note].join(" "), f.search));

  const count = document.getElementById("requestTotal");
  if (count) count.textContent = requests.length;
  const offCount = document.getElementById("offerTotal");
  if (offCount) offCount.textContent = offers.length;

  if (!requests.length && !offers.length) {
    box.innerHTML = '<p class="muted">Nothing on the board matches right now. Hospitals post blood requests here, and volunteers can <a href="donate.html">offer to donate</a> without an account.</p>';
    return;
  }

  requests.sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));
  offers.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

  box.innerHTML = requests.map(function (r) {
    const created = new Date(r.createdOn).getTime();
    const msLeft = created + REQUEST_MAX_MS - now;
    const daysLeft = msLeft / (24 * 60 * 60 * 1000);
    const pctLeft = Math.max(0, Math.min(100, (msLeft / REQUEST_MAX_MS) * 100));

    let barClass = "count-ok";
    if (daysLeft <= 3) barClass = "count-danger";
    else if (daysLeft <= 10) barClass = "count-warn";

    const urgency = r.urgency || "Normal";
    const uClass = urgency === "Critical" ? "tag-blood"
      : urgency === "Urgent" ? "tag-warn" : "tag-ok";
    const bookAction = (r.status || "open") === "open" && session
      ? '<button class="btn btn-ghost btn-sm" data-book-req="' + esc(r.id) + '">Book this request</button>' : "";
    const removeAction = session && session.role === "hospital" && session.id === r.hospitalEmail
      ? '<button class="btn btn-ghost btn-sm" data-remove-req="' + esc(r.id) + '">Fulfilled / remove</button>' : "";

    return '<div class="hosp-card req-card">' +
      '<div class="hosp-top"><h3>' + esc(r.requesterName) + '</h3>' +
        '<span class="tag tag-blood">Needs ' + esc(r.bloodGroup || "?") + '</span></div>' +
      '<p class="muted">' +
        (r.units ? r.units + ' unit(s) &middot; ' : '') +
        '<span class="tag ' + uClass + '" style="margin-left:2px">' + esc(urgency) + '</span> ' + statusBadge(r) + '</p>' +
      '<p class="muted">' + esc(locationText(r.place, r.lat, r.lng)) + '</p>' +
      '<p class="dist">Contact: ' + esc(r.contact || "not given") + '</p>' +
      (r.note ? '<p class="muted" style="font-size:.9rem">&ldquo;' + esc(r.note) + '&rdquo;</p>' : '') +
      '<div class="countdown">' +
        '<div class="count-row"><span>Auto-deletes in</span>' +
          '<strong class="count-value ' + barClass + '">' + formatCountdown(msLeft) + '</strong></div>' +
        '<div class="count-track"><div class="count-fill ' + barClass + '" style="width:' + pctLeft + '%"></div></div>' +
        '<small class="hint">Posted ' + new Date(r.createdOn).toLocaleDateString() +
          ' &middot; requests may not exceed ' + REQUEST_MAX_DAYS + ' days</small>' +
      '</div>' +
      '<div class="hosp-actions">' + contactButton(r.contact) + mapButton(r.lat, r.lng) + bookAction + removeAction +
      '</div>' +
    '</div>';
  }).join("") + offers.map(o => renderOfferCard(o, now, session)).join("");

  box.querySelectorAll("[data-remove-req]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      try { await DB.removeRequest(btn.getAttribute("data-remove-req")); } catch (e) { alert(e.message); }
      renderRequestDirectory(true);
    });
  });
  box.querySelectorAll("[data-book-req]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      try { await DB.bookRequest(btn.getAttribute("data-book-req")); } catch (e) { alert(e.message); }
      renderRequestDirectory(true);
    });
  });
  box.querySelectorAll("[data-remove-offer]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      if (!confirm("Remove this donation offer from the board?")) return;
      try { await DB.adminRemoveOffer(btn.getAttribute("data-remove-offer")); } catch (e) { alert(e.message); }
      renderRequestDirectory(true);
    });
  });
}

function initDirectoryPage() {
  const page = document.getElementById("directory");
  if (!page) return;

  initPageTabs("directoryTabs");
  renderDonorDirectory();
  renderRequestDirectory(true);
  initHospitalsSection();
  initPharmacySection();

  // Board search + filters re-render instantly from the cache.
  ["boardSearch", "boardType", "boardUrgency"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", function () { renderRequestDirectory(false); });
  });

  // Live countdowns (no refetch); refresh from the server every 30s.
  setInterval(() => renderRequestDirectory(false), 1000);
  setInterval(() => renderRequestDirectory(true), 30000);

  /* --- The request form: HOSPITALS ONLY (also enforced server-side) --- */
  const formPanel = document.getElementById("requestFormPanel");
  const lockedPanel = document.getElementById("requestLockedPanel");

  DB.currentAccount().then(function (account) {
    const isHosp = account && account.role === "hospital";
    const activeSub = isHosp && account.record.subscriptionStatus === "active";
    if (isHosp && activeSub) {
      formPanel.style.display = "block";
      lockedPanel.style.display = "none";
      const who = document.getElementById("reqPostingAs");
      if (who) who.textContent = "Posting as " + account.record.name + " - the request will show your hospital's name and contact.";
      initRequestForm(account);
    } else {
      formPanel.style.display = "none";
      lockedPanel.style.display = "block";
      lockedPanel.innerHTML =
        '<div class="locked-panel"><div class="lock-ico">&#127973;</div>' +
        '<p><strong>Only hospitals can post blood requests.</strong></p>' +
        '<p class="muted">' +
          (!account ? 'Individuals cannot request blood on this platform - please contact your nearest hospital (see the Hospitals tab). Hospital staff: <a href="dashboard.html">log in to your hospital account</a>' +
            ' and make sure you have an <a href="subscribe.html">active subscription</a>.'
          : account.role !== "hospital"
            ? 'You are signed in as a ' + account.role + '. Individuals and pharmacies cannot request blood - if a patient needs blood, contact the nearest hospital (see the Hospitals tab).'
            : 'Your hospital account needs an <a href="subscribe.html">active subscription</a> to post blood requests.') +
        '</p></div>';
    }
  });

  function initRequestForm(account) {
    let picked = null, picker = null;
    const locText = document.getElementById("reqLocText");

    const rmap = createRwandaMap("reqMap", { zoom: 7.5 });
    if (rmap) {
      picker = makePicker(rmap, function (lat, lng) {
        picked = { lat, lng };
        if (locText) locText.textContent = "Pinned: " + lat.toFixed(4) + ", " + lng.toFixed(4);
      });
      const geoBtn = document.getElementById("reqUseLocation");
      if (geoBtn) geoBtn.addEventListener("click", function () {
        if (!navigator.geolocation) { if (locText) locText.textContent = "Geolocation not supported."; return; }
        if (locText) locText.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            picker.place(pos.coords.longitude, pos.coords.latitude);
            rmap.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
          },
          function () { if (locText) locText.textContent = "Could not locate you. Click the map instead."; }
        );
      });
    }

    const form = document.getElementById("requestForm");
    const msg = document.getElementById("requestMessage");
    if (form) form.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await DB.addRequest({
          patient: document.getElementById("reqPatient").value.trim(),
          bloodGroup: document.getElementById("reqGroup").value,
          units: parseInt(document.getElementById("reqUnits").value, 10) || null,
          place: document.getElementById("reqPlace").value.trim(),
          contact: document.getElementById("reqContact").value.trim(),
          urgency: document.getElementById("reqUrgency").value,
          note: document.getElementById("reqNote").value.trim(),
          lat: picked ? picked.lat : null,
          lng: picked ? picked.lng : null
        });
        form.reset();
        picked = null;
        if (picker) picker.remove();
        if (locText) locText.textContent = "";
        showMsg(msg, "Request posted. It will stay listed for up to " + REQUEST_MAX_DAYS +
          " days and then delete itself automatically.", "success");
        renderRequestDirectory(true);
      } catch (err) {
        showMsg(msg, err.message, "error");
      }
    });
  }
}

/* ------------------------------------------------------------
   11. Pharmacies tab (Directory page)
   ------------------------------------------------------------ */
async function initPharmacySection() {
  const refList = document.getElementById("pharmacyRefList");
  if (!refList) return;

  const map = createRwandaMap("pharmMap", { zoom: 7.5 });
  if (map) addPharmacyMarkers(map, RW_PHARMACIES);

  refList.innerHTML = RW_PHARMACIES.map(function (ph) {
    return '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(ph.name) + '</h3></div>' +
      '<p class="muted">' + esc(ph.city) + '</p>' +
      '<div class="hosp-actions">' +
        '<a class="btn btn-primary btn-sm" href="tel:' + ph.phone.replace(/\s/g, "") + '">Call ' + ph.phone + '</a>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + ph.lat + '&mlon=' + ph.lng + '#map=15/' + ph.lat + '/' + ph.lng + '">View on map</a>' +
      '</div></div>';
  }).join("");

  const accBox = document.getElementById("pharmacyAccountList");
  try {
    const accounts = await DB.getPharmacies();
    accBox.innerHTML = accounts.length
      ? accounts.map(p => '<div class="hosp-card"><div class="hosp-top"><h3>' + esc(p.name) + '</h3>' + tierBadge(p.subscriptionPlan) + '</div>' +
          '<p class="muted">' + esc(p.city || "") + '</p></div>').join("")
      : '<p class="muted">No pharmacies have registered an account yet. <a href="dashboard.html">Register your pharmacy</a>.</p>';
  } catch (e) {
    accBox.innerHTML = '<p class="muted">' + esc(e.message) + '</p>';
  }
}

/* ------------------------------------------------------------
   12. Medicines: case-related catalogue, prescription upload,
       real online payment or reserve & pay at the pharmacy
   ------------------------------------------------------------ */
function renderMedicineCard(m, pharmacies, stockMap) {
  const withStock = pharmacies.map(p => ({ p, stock: stockMap[p.email + "|" + m.id] || 0 }));
  const available = withStock.filter(x => x.stock > 0);
  const options = available.length
    ? available.map(x => '<option value="' + esc(x.p.email) + '">' + esc(x.p.name) + ' (' + x.stock + ' in stock)</option>').join("")
    : '<option value="">Not currently in stock anywhere</option>';
  const sellerChips = available.length
    ? '<div class="seller-chips">' + available.map(x => '<span class="tag tag-blood">' + esc(x.p.name) + ' &middot; ' + x.stock + '</span>').join(" ") + '</div>'
    : '<p class="muted" style="font-size:0.85rem">Not currently in stock at any registered pharmacy.</p>';

  return '<div class="feature-card med-card" data-med-card="' + m.id + '">' +
    '<div class="med-top"><div class="med-icon">' + esc(m.icon) + '</div>' +
      '<div class="med-title"><h3>' + esc(m.name) + '</h3>' +
      '<div class="med-tags"><span class="tag tag-ok">' + esc(m.category) + '</span>' +
      (m.rx ? '<span class="tag tag-warn" title="Requires a doctor\'s prescription">Prescription needed</span>' : '<span class="tag tag-ok">No prescription</span>') +
      '</div></div></div>' +
    '<p class="med-desc">' + esc(m.description) + '</p>' +
    '<div class="med-price">RWF ' + m.price.toLocaleString("en-US") + '</div>' +
    '<p class="muted" style="font-size:0.82rem;margin-bottom:2px">Sold at:</p>' + sellerChips +
    '<div class="med-avail">' +
      '<label>Pharmacy<select data-pharm-select>' + options + '</select></label>' +
      '<label>Quantity<input type="number" min="1" max="50" value="1" data-qty /></label>' +
    '</div>' +
    (m.rx ?
      '<div class="med-rx-box">' +
        '<label class="med-rx-label">Upload your doctor\'s prescription (PDF or photo, max 5 MB)' +
        '<input type="file" data-rx-file accept=".pdf,.jpg,.jpeg,.png,.webp" /></label>' +
        '<p class="hint" data-rx-info>A pharmacist reviews your prescription before the sale - you pay after it is approved.</p>' +
      '</div>' +
      '<div class="med-buy-row">' +
        '<button class="btn btn-primary btn-sm" data-buy-reserve="' + m.id + '"' + (available.length ? '' : ' disabled') + '>Send order for pharmacist review</button>' +
      '</div>'
    :
      '<div class="med-buy-row">' +
        '<button class="btn btn-primary btn-sm" data-buy-online="' + m.id + '"' + (available.length ? '' : ' disabled') + '>Pay online</button>' +
        '<button class="btn btn-ghost btn-sm" data-buy-reserve="' + m.id + '"' + (available.length ? '' : ' disabled') + '>Reserve &amp; pay at pharmacy</button>' +
      '</div>') +
    '<div class="form-message" data-buy-msg></div>' +
  '</div>';
}

async function initMedicinesPage() {
  const grid = document.getElementById("medicineGrid");
  if (!grid) return;

  handlePaymentReturn(document.getElementById("medPayMsg"));

  let medicines = [], pharmacies = [], stockMap = {};
  try {
    medicines = await DB.getMedicines();
    // Sellers = pharmacies with paid OR trial access (the server computes this).
    pharmacies = (await DB.getPharmacies()).filter(p => p.access);
    (await DB.getAllStock()).forEach(s => { stockMap[s.pharmacyEmail + "|" + s.medicineId] = s.qty; });
  } catch (e) {
    grid.innerHTML = '<p class="muted">' + esc(e.message) + '</p>';
    return;
  }

  const categories = ["All"].concat(Array.from(new Set(medicines.map(m => m.category))));
  const filterBox = document.getElementById("medCategoryFilter");
  filterBox.innerHTML = categories.map((c, i) => '<button class="tab' + (i === 0 ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join("");

  function renderGrid(filter) {
    const list = filter && filter !== "All" ? medicines.filter(m => m.category === filter) : medicines;
    grid.innerHTML = list.map(m => renderMedicineCard(m, pharmacies, stockMap)).join("");
    wireBuyButtons();
  }

  async function buy(card, medId, online) {
    const med = medicines.find(m => m.id === medId);
    const pharmacyEmail = card.querySelector("[data-pharm-select]").value;
    const qty = Math.max(1, parseInt(card.querySelector("[data-qty]").value, 10) || 1);
    const msg = card.querySelector("[data-buy-msg]");
    if (!pharmacyEmail) { showMsg(msg, "This medicine is not in stock anywhere right now.", "error"); return; }

    if (!DB.currentSession()) {
      showMsg(msg, "Please log in first (or register on the Donate page) so the pharmacy can reach you about your order.", "error");
      return;
    }

    const stock = stockMap[pharmacyEmail + "|" + medId] || 0;
    if (qty > stock) { showMsg(msg, "Only " + stock + " unit(s) left at that pharmacy.", "error"); return; }

    let prescriptionUrl = null;
    if (med.rx) {
      const fileInput = card.querySelector("[data-rx-file]");
      const file = fileInput && fileInput.files[0];
      if (!file) { showMsg(msg, med.name + " needs a doctor's prescription - please upload it first.", "error"); return; }
      if (file.size > 5 * 1024 * 1024) { showMsg(msg, "The prescription file is larger than 5 MB.", "error"); return; }
      showMsg(msg, "Uploading your prescription...", "success");
      try {
        prescriptionUrl = (await DB.upload(file, "prescription")).url;
      } catch (e) { showMsg(msg, e.message, "error"); return; }
    }

    try {
      if (online) {
        await payFlow({ kind: "order", medicineId: medId, pharmacyEmail, qty, prescriptionUrl, amount: med.price * qty },
          msg, "medicines.html?payment=success");
      } else {
        const order = await DB.placeOrder({ medicineId: medId, pharmacyEmail, qty, prescriptionUrl });
        stockMap[pharmacyEmail + "|" + medId] = Math.max(0, stock - qty);
        showMsg(msg, med.rx
          ? "Order sent: " + qty + " x " + med.name + ". A pharmacist at " + order.pharmacyName +
            " will review your prescription - track it (and pay once approved) in My Account."
          : "Reserved: " + qty + " x " + med.name + " for RWF " + order.total.toLocaleString("en-US") +
            ". Pay when you collect it at " + order.pharmacyName + ", or pay online from My Account.", "success");
        const activeCat = filterBox.querySelector(".tab.active").getAttribute("data-cat");
        renderGrid(activeCat);
      }
    } catch (e) {
      showMsg(msg, e.message, "error");
    }
  }

  function wireBuyButtons() {
    grid.querySelectorAll("[data-rx-file]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        const info = inp.closest(".med-rx-box").querySelector("[data-rx-info]");
        const f = inp.files[0];
        if (info) info.textContent = f ? "Selected: " + f.name + " (" + Math.round(f.size / 1024) + " KB)" : "";
      });
    });
    grid.querySelectorAll("[data-buy-online]").forEach(btn =>
      btn.addEventListener("click", () => buy(btn.closest("[data-med-card]"), btn.getAttribute("data-buy-online"), true)));
    grid.querySelectorAll("[data-buy-reserve]").forEach(btn =>
      btn.addEventListener("click", () => buy(btn.closest("[data-med-card]"), btn.getAttribute("data-buy-reserve"), false)));
  }

  filterBox.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      filterBox.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderGrid(tab.getAttribute("data-cat"));
    });
  });

  renderGrid("All");
}

/* ------------------------------------------------------------
   Run the right code for whichever page is open
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  initHeaderAccount();
  initPasswordToggles();
  initTimer();
  initOfferForm();
  initDonorRegisterForm();
  initRwandaMap();
  initDronePage();
  initHealthTabs();
  initFundsPage();
  initSubscribePage();
  initDashboard();
  initDirectoryPage();
  initMedicinesPage();
  initPageTabs("servicesTabs");
});
