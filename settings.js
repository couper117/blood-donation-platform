/* ============================================================
   Site-wide settings - reduced to the essentials: language and
   dark mode. Kept in localStorage so they apply before first
   paint (see the small inline script in every page's <head>).
   ============================================================ */

const SETTINGS_KEY = "bdc_settings";
const DEFAULT_SETTINGS = { theme: "light", language: "en" };

function getSettings() {
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
  catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}

function applySettings(s) {
  const r = document.documentElement;
  if (s.theme === "dark") r.setAttribute("data-theme", "dark"); else r.removeAttribute("data-theme");
  r.lang = s.language || "en";
}

function saveSettings(patch) {
  const merged = Object.assign(getSettings(), patch);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  applySettings(merged);
  if (typeof translatePage === "function") translatePage(merged.language);
  return merged;
}

applySettings(getSettings());

/* ------------------------------------------------------------
   Settings page controls (only present on settings.html)
   ------------------------------------------------------------ */
function initSettingsPage() {
  const page = document.getElementById("settingsPage");
  if (!page) return;

  const s = getSettings();
  const themeToggle = document.getElementById("optTheme");
  const langSelect = document.getElementById("optLanguage");

  if (themeToggle) themeToggle.checked = s.theme === "dark";
  if (langSelect) langSelect.value = s.language;

  function toast(msg) {
    const el = document.getElementById("settingsToast");
    if (!el) return;
    el.textContent = msg;
    el.className = "form-message show success";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = "form-message"; }, 2200);
  }

  if (themeToggle) themeToggle.addEventListener("change", function () {
    saveSettings({ theme: themeToggle.checked ? "dark" : "light" });
    toast("Theme updated.");
  });
  if (langSelect) langSelect.addEventListener("change", function () {
    saveSettings({ language: langSelect.value });
    toast("Language updated.");
    updateI18nNote(langSelect.value);
  });
  updateI18nNote(s.language);
}

function updateI18nNote(lang) {
  const note = document.getElementById("i18nNote");
  if (!note) return;
  note.style.display = lang === "en" ? "none" : "block";
}

document.addEventListener("DOMContentLoaded", initSettingsPage);
