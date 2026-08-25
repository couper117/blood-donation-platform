/* ============================================================
   Site-wide floating widgets, injected on every page:
     1. Emergency button - real tel:912 call + nearest hospital.
     2. Quick-help chat + voice assistant.
        The chat uses the REAL AI (Anthropic Claude, via the
        backend's /api/chat) when the server has an API key, and
        automatically falls back to the built-in offline helper in
        chatbot.js when it doesn't. Voice input needs a secure
        context (https:// or http://localhost) - satisfied now that
        the site runs from the local server.
   ============================================================ */

function widgetOverlay(titleHtml, bodyHtml, onClose) {
  const overlay = document.createElement("div");
  overlay.className = "widget-overlay";
  overlay.innerHTML =
    '<div class="widget-modal">' +
      '<div class="widget-head"><h3>' + titleHtml + '</h3><button class="widget-close" aria-label="Close">&times;</button></div>' +
      '<div class="widget-body">' + bodyHtml + '</div>' +
    '</div>';
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  overlay.querySelector(".widget-close").addEventListener("click", close);
  function close() { overlay.remove(); if (onClose) onClose(); }
  document.body.appendChild(overlay);
  return overlay;
}

/* ------------------------------------------------------------
   1. Emergency ambulance button
   ------------------------------------------------------------ */
function initEmergencyButton() {
  const btn = document.createElement("button");
  btn.className = "fab emergency-fab";
  btn.innerHTML = "&#128680; Emergency";
  btn.setAttribute("aria-label", "Emergency - call ambulance");
  document.body.appendChild(btn);

  btn.addEventListener("click", async function () {
    const body =
      '<a class="emg-action emg-call" href="tel:912">&#9742; Call ambulance now - 912</a>' +
      '<p class="muted" style="text-align:center;margin-bottom:16px">912 is Rwanda\'s real emergency ambulance number.</p>' +
      '<div id="emgHospitalBox"><button class="emg-action emg-hospital" id="emgFindHospital" style="cursor:pointer">&#128205; Find &amp; call the nearest hospital</button></div>';
    const overlay = widgetOverlay("Emergency", body);

    if (typeof DB !== "undefined") DB.logEmergency({ note: "Emergency panel opened" });

    const findBtn = overlay.querySelector("#emgFindHospital");
    findBtn.addEventListener("click", function () {
      const box = overlay.querySelector("#emgHospitalBox");
      if (!navigator.geolocation) {
        box.innerHTML = '<p class="muted">Geolocation is not available - please call any hospital from the <a href="directory.html#hospitals">Hospitals tab</a>.</p>';
        return;
      }
      box.innerHTML = '<p class="muted" style="text-align:center">Locating you...</p>';
      navigator.geolocation.getCurrentPosition(function (pos) {
        let nearest = null, best = Infinity;
        (typeof RW_HOSPITALS !== "undefined" ? RW_HOSPITALS : []).forEach(function (h) {
          const d = haversine(pos.coords.latitude, pos.coords.longitude, h.lat, h.lng);
          if (d < best) { best = d; nearest = h; }
        });
        if (!nearest) { box.innerHTML = '<p class="muted">Could not find a hospital list.</p>'; return; }
        box.innerHTML = '<a class="emg-action emg-hospital" href="tel:' + nearest.phone.replace(/\s/g, "") + '">' +
          '&#9742; Call ' + nearest.name + '</a><p class="muted" style="text-align:center">About ' + best.toFixed(1) + ' km away &middot; ' + nearest.phone + '</p>';
        if (typeof DB !== "undefined") DB.logEmergency({ lat: pos.coords.latitude, lng: pos.coords.longitude, nearestHospital: nearest.name });
      }, function () {
        box.innerHTML = '<p class="muted">Could not get your location - please call any hospital from the <a href="directory.html#hospitals">Hospitals tab</a>.</p>';
      });
    });
  });
}

/* ------------------------------------------------------------
   2. Quick-help chat + voice assistant (real AI with fallback)
   ------------------------------------------------------------ */
function initChatWidget() {
  const btn = document.createElement("button");
  btn.className = "fab chat-fab";
  btn.innerHTML = "&#128172; Help";
  btn.setAttribute("aria-label", "Quick help chat");
  document.body.appendChild(btn);

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canSpeak = "speechSynthesis" in window;
  const secure = window.isSecureContext;

  // Conversation history for the AI ({role, content} pairs).
  const history = [];
  let aiAvailable = null; // null = unknown, true/false once the first reply comes back

  btn.addEventListener("click", function () {
    const body =
      '<div class="widget-status" id="chatStatus">Checking for the AI assistant...</div>' +
      '<div class="chat-log" id="chatLog"></div>' +
      (!SpeechRec ? '<p class="chat-note">This browser doesn\'t support voice input - typing always works.</p>'
        : !secure ? '<p class="chat-note">Voice input needs this page to be opened over https:// or http://localhost - typing always works either way.</p>' : '') +
      '<div class="chat-input-row">' +
        (SpeechRec && secure ? '<button class="chat-mic" id="chatMic" type="button" aria-label="Speak">&#127908;</button>' : '') +
        '<input type="text" id="chatInput" placeholder="Ask me anything..." autocomplete="off" />' +
        '<button class="chat-send" id="chatSend" type="button" aria-label="Send">&#10148;</button>' +
      '</div>';
    const overlay = widgetOverlay("Quick help", body);
    const log = overlay.querySelector("#chatLog");
    const input = overlay.querySelector("#chatInput");
    const statusEl = overlay.querySelector("#chatStatus");

    function setStatus(ai) {
      aiAvailable = ai;
      if (statusEl) statusEl.textContent = ai
        ? "AI assistant (Claude) - ask me anything"
        : "Built-in helper - works offline. (Add ANTHROPIC_API_KEY to .env for the full AI.)";
    }
    if (aiAvailable !== null) setStatus(aiAvailable);

    function addMsg(text, who) {
      const div = document.createElement("div");
      div.className = "chat-msg " + who;
      div.textContent = text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    }
    // Replay this session's conversation so reopening the widget keeps context.
    if (history.length) {
      history.forEach(m => addMsg(m.content, m.role === "user" ? "user" : "bot"));
    } else {
      addMsg("Hi! Ask me anything - donating, requesting blood, subscriptions, hospitals, pharmacies, medicines, health topics or emergencies.", "bot");
    }

    function speak(text) {
      if (canSpeak) speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }

    let busy = false;
    async function send(text, spoken) {
      text = (text || "").trim();
      if (!text || busy) return;
      busy = true;
      addMsg(text, "user");
      history.push({ role: "user", content: text });
      input.value = "";

      const typing = addMsg("...", "bot");
      let reply = null;
      try {
        const out = await DB.chat(history);
        if (out && out.configured && out.reply) { reply = out.reply; setStatus(true); }
        else setStatus(false);
      } catch (e) {
        if (aiAvailable === null) setStatus(false);
      }
      if (!reply) reply = getBotResponse(text); // offline fallback
      typing.textContent = reply;
      log.scrollTop = log.scrollHeight;
      history.push({ role: "assistant", content: reply });
      if (spoken) speak(reply);
      busy = false;
    }

    overlay.querySelector("#chatSend").addEventListener("click", function () { send(input.value, false); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(input.value, false); });
    input.focus();

    const mic = overlay.querySelector("#chatMic");
    if (mic) {
      const recognizer = new SpeechRec();
      const uiLang = (typeof getSettings === "function") ? getSettings().language : "en";
      // Browsers generally don't ship Kinyarwanda speech recognition; fall back to English for "rw".
      recognizer.lang = uiLang === "fr" ? "fr-FR" : "en-US";
      recognizer.interimResults = false;
      let listening = false;
      mic.addEventListener("click", function () {
        if (listening) { recognizer.stop(); return; }
        try { recognizer.start(); listening = true; mic.classList.add("listening"); }
        catch (e) { addMsg("Could not start the microphone - try again in a moment.", "bot"); }
      });
      recognizer.onresult = function (e) {
        const text = e.results[0][0].transcript;
        send(text, true);
      };
      recognizer.onend = function () { listening = false; mic.classList.remove("listening"); };
      recognizer.onerror = function (e) {
        listening = false; mic.classList.remove("listening");
        const reason = e && e.error;
        const msg = reason === "not-allowed" || reason === "service-not-allowed"
          ? "Microphone access was blocked - allow it for this page in your browser's site settings, then try again."
          : reason === "no-speech" ? "I didn't hear anything - try again a bit louder or closer to the mic."
          : reason === "audio-capture" ? "No microphone was found on this device."
          : "I couldn't hear that - please check microphone permission, or type instead.";
        addMsg(msg, "bot");
      };
    }
  });
}

/* ------------------------------------------------------------
   3. Notification bell (header) - shown when logged in.
   Unread badge, dropdown list, mark-as-read, click-through links.
   ------------------------------------------------------------ */
function initNotificationBell() {
  const header = document.querySelector(".site-header");
  if (!header || typeof DB === "undefined" || !DB.currentSession()) return;

  const wrap = document.createElement("div");
  wrap.className = "notif-wrap";
  wrap.innerHTML =
    '<button class="notif-bell" aria-label="Notifications" aria-expanded="false">' +
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      '<span class="notif-badge" style="display:none">0</span>' +
    '</button>' +
    '<div class="notif-panel" style="display:none">' +
      '<div class="notif-head"><strong>Notifications</strong>' +
        '<button class="btn btn-ghost btn-sm" id="notifMarkAll" type="button">Mark all read</button></div>' +
      '<div class="notif-list"><p class="muted" style="padding:14px">Loading...</p></div>' +
    '</div>';
  // Place the bell just before the mobile menu button / after the nav.
  header.appendChild(wrap);

  const bell = wrap.querySelector(".notif-bell");
  const badge = wrap.querySelector(".notif-badge");
  const panel = wrap.querySelector(".notif-panel");
  const listEl = wrap.querySelector(".notif-list");
  let items = [];

  function esc2(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function timeAgo(iso) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + " h ago";
    return Math.floor(hrs / 24) + " d ago";
  }

  function render() {
    if (!items.length) {
      listEl.innerHTML = '<p class="muted" style="padding:14px">No notifications yet. Updates about your requests, orders, subscription and account will appear here.</p>';
      return;
    }
    listEl.innerHTML = items.map(n =>
      '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-nid="' + n.id + '" data-link="' + esc2(n.link || "") + '" role="button" tabindex="0">' +
        '<div class="notif-title">' + esc2(n.title) + '</div>' +
        '<div class="notif-body">' + esc2(n.body || "") + '</div>' +
        '<div class="notif-time">' + timeAgo(n.createdOn) + '</div>' +
      '</div>').join("");
    listEl.querySelectorAll(".notif-item").forEach(el => {
      function open() {
        const id = parseInt(el.getAttribute("data-nid"), 10);
        DB.markNotificationsRead([id]).catch(function () {});
        const link = el.getAttribute("data-link");
        if (link) window.location.href = link;
        else { el.classList.remove("unread"); refresh(); }
      }
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  async function refresh() {
    try {
      const out = await DB.getNotifications();
      items = out.notifications;
      badge.textContent = out.unread > 99 ? "99+" : String(out.unread);
      badge.style.display = out.unread > 0 ? "flex" : "none";
      if (panel.style.display !== "none") render();
    } catch (e) { /* logged out or offline - keep quiet */ }
  }

  bell.addEventListener("click", function () {
    const open = panel.style.display === "none";
    panel.style.display = open ? "block" : "none";
    bell.setAttribute("aria-expanded", String(open));
    if (open) render();
  });
  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) { panel.style.display = "none"; bell.setAttribute("aria-expanded", "false"); }
  });
  wrap.querySelector("#notifMarkAll").addEventListener("click", async function () {
    try { await DB.markNotificationsRead(); refresh(); } catch (e) { /* ignore */ }
  });

  refresh();
  setInterval(refresh, 60000);
}

document.addEventListener("DOMContentLoaded", function () {
  initEmergencyButton();
  initChatWidget();
  initNotificationBell();
});
