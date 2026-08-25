/* ============================================================
   Lightweight client-side translations (English / French /
   Kinyarwanda). Covers shared navigation, the Settings page and
   the Home page hero - the highest-traffic UI. Long-form content
   elsewhere is intentionally left in English rather than risk an
   inaccurate machine-style translation of medical text; a small
   notice says so whenever French or Kinyarwanda is selected.
   ============================================================ */

const I18N = {
  en: {
    "nav.home": "Home", "nav.donate": "Donate", "nav.directory": "Directory", "nav.map": "Live Map",
    "nav.medicines": "Medicines", "nav.health": "Health", "nav.services": "Services",
    "nav.subscribe": "Subscribe", "nav.account": "My Account",

    "settings.title": "Settings",
    "settings.lead": "The essentials: your language and your theme.",
    "settings.appearance.title": "Appearance",
    "settings.dark.label": "Dark mode", "settings.dark.desc": "Switch the whole site to a dark colour scheme.",
    "settings.language.title": "Language", "settings.language.desc": "Choose the language for menus and key pages.",
    "settings.i18nNote": "Detailed page content is currently shown in English only; full translation for this section is coming soon.",

    "home.badge": "Every drop counts · Serving all of Rwanda",
    "home.h1": "Give blood, save lives across Rwanda",
    "home.cta1": "Become a donor", "home.cta2": "See the live map",

    "donate.title": "Offer to donate blood",
    "donate.timer.title": "Donation session timer",
    "directory.title": "Directory",
    "directory.lead": "Blood requests, registered donors, and every hospital and pharmacy across Rwanda - all in one place.",
    "board.title": "Request Board",
    "map.title": "Live map of Rwanda",
    "medicines.title": "Medicines",
    "health.title": "Health routines, advice and treatment",
    "services.title": "Services",
    "services.lead": "Track blood-supply drones across Rwanda, and support the blood service with a real financial donation.",
    "subscribe.title": "Subscription plans",
    "dashboard.title": "My Account",
    "dashboard.lead": "Log in as a donor, hospital or pharmacy to see your dashboard - your profile, your information and your tools."
  },
  fr: {
    "nav.home": "Accueil", "nav.donate": "Faire un don", "nav.directory": "Annuaire", "nav.map": "Carte en direct",
    "nav.medicines": "Médicaments", "nav.health": "Santé", "nav.services": "Services",
    "nav.subscribe": "S'abonner", "nav.account": "Mon compte",

    "settings.title": "Paramètres",
    "settings.lead": "L'essentiel : votre langue et votre thème.",
    "settings.appearance.title": "Apparence",
    "settings.dark.label": "Mode sombre", "settings.dark.desc": "Passer tout le site en thème sombre.",
    "settings.language.title": "Langue", "settings.language.desc": "Choisissez la langue des menus et des pages principales.",
    "settings.i18nNote": "Le contenu détaillé de cette page est actuellement affiché en anglais uniquement ; la traduction complète arrive bientôt.",

    "home.badge": "Chaque don compte · Au service de tout le Rwanda",
    "home.h1": "Donnez votre sang, sauvez des vies partout au Rwanda",
    "home.cta1": "Devenir donneur", "home.cta2": "Voir la carte en direct",

    "donate.title": "Proposer un don de sang",
    "donate.timer.title": "Minuteur de la séance de don",
    "directory.title": "Annuaire",
    "directory.lead": "Demandes de sang, donneurs enregistrés, et tous les hôpitaux et pharmacies du Rwanda - au même endroit.",
    "board.title": "Tableau des demandes",
    "map.title": "Carte du Rwanda en direct",
    "medicines.title": "Médicaments",
    "health.title": "Routines, conseils et traitements de santé",
    "services.title": "Services",
    "services.lead": "Suivez les drones de transport de sang à travers le Rwanda et soutenez le service par un don financier réel.",
    "subscribe.title": "Formules d'abonnement",
    "dashboard.title": "Mon compte",
    "dashboard.lead": "Connectez-vous en tant que donneur, hôpital ou pharmacie pour voir votre tableau de bord - votre profil, vos informations et vos outils."
  },
  rw: {
    "nav.home": "Ahabanza", "nav.donate": "Gutanga amaraso", "nav.directory": "Urutonde", "nav.map": "Ikarita",
    "nav.medicines": "Imiti", "nav.health": "Ubuzima", "nav.services": "Serivisi",
    "nav.subscribe": "Kwiyandikisha", "nav.account": "Konti yanjye",

    "settings.title": "Igenamiterere",
    "settings.lead": "Iby'ingenzi: ururimi rwawe n'isura y'urubuga.",
    "settings.appearance.title": "Isura",
    "settings.dark.label": "Uburyo bw'umwijima", "settings.dark.desc": "Hindura urubuga rwose rube n'ibara ryijimye.",
    "settings.language.title": "Ururimi", "settings.language.desc": "Hitamo ururimi rw'ibiro n'amapaji y'ingenzi.",
    "settings.i18nNote": "Ibirimo birambuye kuri iyi paji biracyagaragara mu Cyongereza gusa; ubuhinduzi bwuzuye buzaza vuba.",

    "home.badge": "Buri gitonyanga kirafasha · Dukorera u Rwanda rwose",
    "home.h1": "Tanga amaraso, ukize ubuzima mu Rwanda hose",
    "home.cta1": "Ba umutanga w'amaraso", "home.cta2": "Reba ikarita ihoraho",

    "donate.title": "Saba gutanga amaraso",
    "donate.timer.title": "Isaha y'igikorwa cyo gutanga amaraso",
    "directory.title": "Urutonde",
    "directory.lead": "Ibisabwa by'amaraso, abatanga biyandikishije, n'ibitaro na farumasi byose byo mu Rwanda - hamwe.",
    "board.title": "Urubaho rw'ibisabwa",
    "map.title": "Ikarita y'u Rwanda ihoraho",
    "medicines.title": "Imiti",
    "health.title": "Gahunda, inama n'ubuvuzi by'ubuzima",
    "services.title": "Serivisi",
    "services.lead": "Kurikirana za drone zitwara amaraso mu Rwanda, kandi ushyigikire serivisi y'amaraso n'impano y'amafaranga nyayo.",
    "subscribe.title": "Gahunda zo kwiyandikisha",
    "dashboard.title": "Konti yanjye",
    "dashboard.lead": "Injira nk'umutanga w'amaraso, ibitaro cyangwa farumasi urebe ikibaho cyawe - umwirondoro wawe, amakuru yawe n'ibikoresho byawe."
  }
};

function translatePage(lang) {
  lang = lang || "en";
  const dict = I18N[lang] || I18N.en;
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    const key = el.getAttribute("data-i18n");
    const text = dict[key] || I18N.en[key];
    if (text) el.textContent = text;
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const lang = (typeof getSettings === "function") ? getSettings().language : "en";
  translatePage(lang);
});
