/* ============================================================
   GLOBAL language system (English / French / Kinyarwanda).

   Two layers:
   1. Key-based: elements marked data-i18n="key" (nav, headings).
   2. WHOLE-PAGE string engine: every text node, placeholder, title
      and aria-label on the page is checked against the translation
      table below and swapped - including content that JavaScript
      renders later (a MutationObserver translates new content the
      moment it appears). Originals are remembered, so switching
      language - in any direction - always re-translates from the
      English source. Anything missing from the table falls back to
      English rather than breaking.

   Kinyarwanda is a careful best-effort translation - have a native
   speaker review it before high-stakes real-world use.
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
    "settings.language.title": "Language", "settings.language.desc": "Choose the language for the whole website.",
    "settings.i18nNote": "Some detailed text may still appear in English; it falls back automatically when no translation exists.",
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
    "settings.language.title": "Langue", "settings.language.desc": "Choisissez la langue de tout le site.",
    "settings.i18nNote": "Certains textes détaillés peuvent encore apparaître en anglais ; l'anglais sert de repli automatique.",
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
    "settings.language.title": "Ururimi", "settings.language.desc": "Hitamo ururimi rw'urubuga rwose.",
    "settings.i18nNote": "Amwe mu makuru arambuye ashobora kugaragara mu Cyongereza; Icyongereza ni cyo gisimbura mu buryo bwikora.",
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

/* ============================================================
   WHOLE-PAGE STRING TABLE: exact English text -> {fr, rw}.
   Grouped by area. Add a row here and it translates everywhere
   that exact text appears - in HTML or JS-rendered content.
   ============================================================ */
const S = {
  /* ---- Common UI ---- */
  "Log in": { fr: "Se connecter", rw: "Injira" },
  "Log out": { fr: "Se déconnecter", rw: "Sohoka" },
  "Register": { fr: "S'inscrire", rw: "Iyandikishe" },
  "Password": { fr: "Mot de passe", rw: "Ijambobanga" },
  "Email": { fr: "E-mail", rw: "Imeyili" },
  "Phone": { fr: "Téléphone", rw: "Telefoni" },
  "Phone or email": { fr: "Téléphone ou e-mail", rw: "Telefoni cyangwa imeyili" },
  "Your phone or email": { fr: "Votre téléphone ou e-mail", rw: "Telefoni cyangwa imeyili yawe" },
  "City / area": { fr: "Ville / quartier", rw: "Umujyi / agace" },
  "Full name": { fr: "Nom complet", rw: "Amazina yombi" },
  "Your full name": { fr: "Votre nom complet", rw: "Amazina yawe yombi" },
  "Age": { fr: "Âge", rw: "Imyaka" },
  "Blood group": { fr: "Groupe sanguin", rw: "Ubwoko bw'amaraso" },
  "Select": { fr: "Choisir", rw: "Hitamo" },
  "I don't know": { fr: "Je ne sais pas", rw: "Simbizi" },
  "Save bio": { fr: "Enregistrer la bio", rw: "Bika umwirondoro" },
  "Saved": { fr: "Enregistré", rw: "Byabitswe" },
  "Saving...": { fr: "Enregistrement...", rw: "Birimo kubikwa..." },
  "Change photo": { fr: "Changer la photo", rw: "Hindura ifoto" },
  "Change password": { fr: "Changer le mot de passe", rw: "Hindura ijambobanga" },
  "Current password": { fr: "Mot de passe actuel", rw: "Ijambobanga risanzwe" },
  "New password": { fr: "Nouveau mot de passe", rw: "Ijambobanga rishya" },
  "Update password": { fr: "Mettre à jour le mot de passe", rw: "Vugurura ijambobanga" },
  "Loading...": { fr: "Chargement...", rw: "Birimo gutegurwa..." },
  "Search": { fr: "Rechercher", rw: "Shakisha" },
  "Approve": { fr: "Approuver", rw: "Emeza" },
  "Reject": { fr: "Rejeter", rw: "Hakana" },
  "Rejected": { fr: "Rejeté", rw: "Byahakanywe" },
  "Verified": { fr: "Vérifié", rw: "Byemejwe" },
  "Pending": { fr: "En attente", rw: "Birategereje" },
  "Normal": { fr: "Normal", rw: "Bisanzwe" },
  "Urgent": { fr: "Urgent", rw: "Byihutirwa" },
  "Critical": { fr: "Critique", rw: "Bikomeye cyane" },
  "Open": { fr: "Ouvert", rw: "Birafunguye" },
  "Fulfilled": { fr: "Satisfait", rw: "Byarangiye" },
  "Settings": { fr: "Paramètres", rw: "Igenamiterere" },
  "Start": { fr: "Démarrer", rw: "Tangira" },
  "Pause": { fr: "Pause", rw: "Hagarara gato" },
  "Reset": { fr: "Réinitialiser", rw: "Subiza uko byari" },
  "Minutes": { fr: "Minutes", rw: "Iminota" },
  "Show password": { fr: "Afficher le mot de passe", rw: "Erekana ijambobanga" },
  "Hide password": { fr: "Masquer le mot de passe", rw: "Hisha ijambobanga" },
  "View on map": { fr: "Voir sur la carte", rw: "Reba ku ikarita" },
  "Use my current location": { fr: "Utiliser ma position actuelle", rw: "Koresha aho ndi ubu" },
  "Blood bank": { fr: "Banque de sang", rw: "Ububiko bw'amaraso" },
  "Referral hospital": { fr: "Hôpital de référence", rw: "Ibitaro bikuru byakira abarwayi boherejwe" },
  "District hospital": { fr: "Hôpital de district", rw: "Ibitaro by'akarere" },
  "Provincial hospital": { fr: "Hôpital provincial", rw: "Ibitaro by'intara" },
  "Specialised hospital": { fr: "Hôpital spécialisé", rw: "Ibitaro byihariye" },

  /* ---- Notifications bell ---- */
  "Notifications": { fr: "Notifications", rw: "Imenyesha" },
  "Mark all read": { fr: "Tout marquer comme lu", rw: "Byose nk'ibisomwe" },
  "No notifications yet. Updates about your requests, orders, subscription and account will appear here.":
    { fr: "Aucune notification pour l'instant. Les mises à jour de vos demandes, commandes, abonnement et compte apparaîtront ici.",
      rw: "Nta menyesha rirabaho. Amakuru y'ibisabwa byawe, ibyo watumije, ifatabuguzi na konti yawe azagaragara hano." },
  "just now": { fr: "à l'instant", rw: "ubu ngubu" },

  /* ---- Quick Help chat ---- */
  "Quick help": { fr: "Aide rapide", rw: "Ubufasha bwihuse" },
  "Help": { fr: "Aide", rw: "Ubufasha" },
  "Emergency": { fr: "Urgence", rw: "Ubutabazi" },
  "Ask me anything...": { fr: "Posez-moi une question...", rw: "Mbaza icyo ushaka..." },
  "AI assistant - ask me anything": { fr: "Assistant IA - posez-moi vos questions", rw: "Umufasha wa AI - mbaza icyo ushaka" },
  "Hi! Ask me anything - donating, requesting blood, subscriptions, hospitals, pharmacies, medicines, health topics or emergencies.":
    { fr: "Bonjour ! Posez-moi vos questions : don de sang, demandes de sang, abonnements, hôpitaux, pharmacies, médicaments, santé ou urgences.",
      rw: "Muraho! Mbaza icyo ushaka: gutanga amaraso, gusaba amaraso, ifatabuguzi, ibitaro, farumasi, imiti, ubuzima cyangwa ubutabazi." },
  "912 is Rwanda's real emergency ambulance number.": { fr: "Le 912 est le vrai numéro d'ambulance d'urgence du Rwanda.", rw: "912 ni nimero nyayo y'imbangukiragutabara mu Rwanda." },

  /* ---- Home page ---- */
  "What you can do here": { fr: "Ce que vous pouvez faire ici", rw: "Ibyo ushobora gukora hano" },
  "A brief tour of everything this website offers.": { fr: "Un tour d'horizon de tout ce que propose ce site.", rw: "Incamake y'ibyo urubuga rutanga byose." },
  "Register & pin your location": { fr: "Inscrivez-vous et placez votre position", rw: "Iyandikishe kandi ushyire aho uherereye" },
  "Live map of Rwanda": { fr: "Carte du Rwanda en direct", rw: "Ikarita y'u Rwanda ihoraho" },
  "Medicines with prescriptions": { fr: "Médicaments avec ordonnance", rw: "Imiti isaba urupapuro rwa muganga" },
  "Health guidelines & videos": { fr: "Conseils de santé et vidéos", rw: "Amabwiriza y'ubuzima n'amashusho" },
  "Services: drones & funds": { fr: "Services : drones et fonds", rw: "Serivisi: drone n'imfashanyo" },
  "Hospital & pharmacy subscriptions": { fr: "Abonnements hôpitaux et pharmacies", rw: "Ifatabuguzi ry'ibitaro na farumasi" },
  "Your account dashboard": { fr: "Votre tableau de bord", rw: "Ikibaho cya konti yawe" },
  "About this platform": { fr: "À propos de cette plateforme", rw: "Ibyerekeye uru rubuga" },
  "Donate now →": { fr: "Faire un don →", rw: "Tanga ubu →" },
  "Open the map →": { fr: "Ouvrir la carte →", rw: "Fungura ikarita →" },
  "Open the directory →": { fr: "Ouvrir l'annuaire →", rw: "Fungura urutonde →" },
  "Browse medicines →": { fr: "Voir les médicaments →", rw: "Reba imiti →" },
  "Read the guide →": { fr: "Lire le guide →", rw: "Soma amabwiriza →" },
  "Open services →": { fr: "Ouvrir les services →", rw: "Fungura serivisi →" },
  "See plans →": { fr: "Voir les formules →", rw: "Reba gahunda →" },
  "My Account →": { fr: "Mon compte →", rw: "Konti yanjye →" },
  "people will need blood in their life": { fr: "personnes auront besoin de sang dans leur vie", rw: "abantu bazakenera amaraso mu buzima bwabo" },
  "lives helped by one donation": { fr: "vies aidées par un seul don", rw: "ubuzima bufashwa n'itangwa rimwe" },
  "days between donations": { fr: "jours entre deux dons", rw: "iminsi hagati y'amatangwa" },
  "by drone to remote hospitals": { fr: "par drone vers les hôpitaux isolés", rw: "na drone ku bitaro bya kure" },

  /* ---- Donate page ---- */
  "Save lives near you": { fr: "Sauvez des vies près de chez vous", rw: "Kiza ubuzima hafi yawe" },
  "Why donate": { fr: "Pourquoi donner", rw: "Impamvu yo gutanga" },
  "One donation can help up to three patients.": { fr: "Un seul don peut aider jusqu'à trois patients.", rw: "Itangwa rimwe rishobora gufasha abarwayi batatu." },
  "Blood cannot be manufactured - it only comes from donors.": { fr: "Le sang ne se fabrique pas - il vient uniquement des donneurs.", rw: "Amaraso ntakorwa mu ruganda - ava gusa ku batanga." },
  "Most healthy adults can donate every 56 days.": { fr: "La plupart des adultes en bonne santé peuvent donner tous les 56 jours.", rw: "Abantu bakuru bafite ubuzima bwiza bashobora gutanga buri minsi 56." },
  "Your details stay private and secure.": { fr: "Vos informations restent privées et sécurisées.", rw: "Amakuru yawe aguma ari ibanga kandi arinzwe." },
  "Offer to donate": { fr: "Proposer un don", rw: "Saba gutanga" },
  "See where blood is needed": { fr: "Voir où le sang est nécessaire", rw: "Reba aho amaraso akenewe" },
  "A whole-blood donation usually takes about 8 to 10 minutes. Use this timer during your session.":
    { fr: "Un don de sang total prend généralement 8 à 10 minutes. Utilisez ce minuteur pendant votre séance.",
      rw: "Gutanga amaraso bisanzwe bitwara iminota 8 kugeza kuri 10. Koresha iyi saha mu gihe cy'igikorwa cyawe." },
  "Short note (optional)": { fr: "Petite note (facultatif)", rw: "Akandiko kagufi (si itegeko)" },
  "e.g. available on weekends": { fr: "ex. disponible le week-end", rw: "urugero: mboneka mu mpera z'icyumweru" },
  "How hospitals reach you": { fr: "Comment les hôpitaux vous joignent", rw: "Uko ibitaro bikugeraho" },
  "e.g. Kigali, Musanze, Huye": { fr: "ex. Kigali, Musanze, Huye", rw: "urugero: Kigali, Musanze, Huye" },
  "Pin your area on the map (optional)": { fr: "Placez votre zone sur la carte (facultatif)", rw: "Shyira agace kawe ku ikarita (si itegeko)" },
  "Helps nearby hospitals find you. Click to drop a pin or use the button.":
    { fr: "Aide les hôpitaux proches à vous trouver. Cliquez pour placer un repère ou utilisez le bouton.",
      rw: "Bifasha ibitaro biri hafi kukubona. Kanda ushyireho akamenyetso cyangwa ukoreshe buto." },
  "Post my donation offer (no account)": { fr: "Publier mon offre de don (sans compte)", rw: "Tangaza icyifuzo cyanjye cyo gutanga (nta konti)" },
  "Want a full donor account instead?": { fr: "Vous voulez plutôt un compte donneur complet ?", rw: "Wifuza konti yuzuye y'umutanga w'amaraso?" },
  "Create donor account / Log in": { fr: "Créer un compte donneur / Se connecter", rw: "Fungura konti y'umutanga / Injira" },

  /* ---- Directory / Request board ---- */
  "Blood requests": { fr: "Demandes de sang", rw: "Ibisabwa by'amaraso" },
  "Donors": { fr: "Donneurs", rw: "Abatanga amaraso" },
  "Hospitals": { fr: "Hôpitaux", rw: "Ibitaro" },
  "Pharmacies": { fr: "Pharmacies", rw: "Farumasi" },
  "All types": { fr: "Tous les types", rw: "Ubwoko bwose" },
  "Blood requests (hospitals)": { fr: "Demandes de sang (hôpitaux)", rw: "Ibisabwa by'amaraso (ibitaro)" },
  "Donation offers (volunteers)": { fr: "Offres de don (volontaires)", rw: "Ibyifuzo byo gutanga (abakorerabushake)" },
  "Any urgency": { fr: "Toute urgence", rw: "Ubwihutirwe ubwo ari bwo bwose" },
  "Search name, blood group, place...": { fr: "Rechercher nom, groupe sanguin, lieu...", rw: "Shakisha izina, ubwoko bw'amaraso, ahantu..." },
  "Registered donors": { fr: "Donneurs enregistrés", rw: "Abatanga biyandikishije" },
  "People who have registered to donate, with where they are and how to reach them.":
    { fr: "Les personnes inscrites pour donner, avec leur localisation et leurs coordonnées.",
      rw: "Abiyandikishije gutanga amaraso, aho baherereye n'uko babageraho." },
  "Register as a donor": { fr: "S'inscrire comme donneur", rw: "Iyandikishe nk'umutanga" },
  "Hospitals across Rwanda": { fr: "Les hôpitaux à travers le Rwanda", rw: "Ibitaro byo mu Rwanda hose" },
  "Find hospitals near me": { fr: "Trouver les hôpitaux près de moi", rw: "Shaka ibitaro biri hafi yanjye" },
  "Real pharmacies in Rwanda": { fr: "Vraies pharmacies du Rwanda", rw: "Farumasi nyazo zo mu Rwanda" },
  "Pharmacies on this platform": { fr: "Pharmacies sur cette plateforme", rw: "Farumasi ziri kuri uru rubuga" },
  "A reference directory - names, cities and phone numbers.": { fr: "Un annuaire de référence : noms, villes et numéros de téléphone.", rw: "Urutonde rw'ifashishwa: amazina, imijyi na nimero za telefoni." },
  "Accounts registered through My Account, with their subscription tier.": { fr: "Comptes créés via Mon compte, avec leur niveau d'abonnement.", rw: "Konti zanditswe muri Konti yanjye, hamwe n'urwego rw'ifatabuguzi ryazo." },
  "Post a blood request": { fr: "Publier une demande de sang", rw: "Tangaza icyifuzo cy'amaraso" },
  "Blood group needed": { fr: "Groupe sanguin recherché", rw: "Ubwoko bw'amaraso bukenewe" },
  "Units needed": { fr: "Unités nécessaires", rw: "Ingano ikenewe" },
  "Any compatible": { fr: "Tout groupe compatible", rw: "Ubwoko ubwo ari bwo bwose buhuye" },
  "Urgency": { fr: "Urgence", rw: "Ubwihutirwe" },
  "Only hospitals can post blood requests.": { fr: "Seuls les hôpitaux peuvent publier des demandes de sang.", rw: "Ibitaro byonyine ni byo bishobora gutangaza ibisabwa by'amaraso." },
  "Book this request": { fr: "Réserver cette demande", rw: "Emera iki cyifuzo" },
  "Fulfilled / remove": { fr: "Satisfait / retirer", rw: "Byarangiye / kura" },
  "Auto-deletes in": { fr: "Suppression auto dans", rw: "Bizisibura mu" },
  "Offer expires in": { fr: "L'offre expire dans", rw: "Icyifuzo kizarangira mu" },
  "Volunteer donor": { fr: "Donneur volontaire", rw: "Umutanga w'umukorerabushake" },
  "Contact details are visible to hospital accounts only": { fr: "Les coordonnées ne sont visibles que par les comptes hôpitaux", rw: "Aho babarizwa hagaragarira gusa konti z'ibitaro" },

  /* ---- Map page ---- */
  "Supply (enough blood)": { fr: "Offre (assez de sang)", rw: "Arahari (amaraso arahagije)" },
  "Balanced": { fr: "Équilibré", rw: "Biringaniye" },
  "Demand (blood needed)": { fr: "Demande (sang nécessaire)", rw: "Arakenewe (amaraso arakenewe)" },
  "Hospital": { fr: "Hôpital", rw: "Ibitaro" },
  "Pharmacy": { fr: "Pharmacie", rw: "Farumasi" },
  "Donor location": { fr: "Position d'un donneur", rw: "Aho umutanga aherereye" },
  "Area details": { fr: "Détails de la zone", rw: "Amakuru y'agace" },
  "Units available": { fr: "Unités disponibles", rw: "Ingano ihari" },
  "Difference": { fr: "Différence", rw: "Itandukaniro" },

  /* ---- Medicines ---- */
  "All": { fr: "Tous", rw: "Byose" },
  "Anemia & blood support": { fr: "Anémie et soutien sanguin", rw: "Amaraso make n'ubufasha bw'amaraso" },
  "Diabetes": { fr: "Diabète", rw: "Diyabete" },
  "Hypertension": { fr: "Hypertension", rw: "Umuvuduko w'amaraso" },
  "Asthma": { fr: "Asthme", rw: "Asima" },
  "Heart health": { fr: "Santé du cœur", rw: "Ubuzima bw'umutima" },
  "Obesity": { fr: "Obésité", rw: "Umubyibuho ukabije" },
  "Prescription needed": { fr: "Ordonnance requise", rw: "Bisaba urupapuro rwa muganga" },
  "No prescription": { fr: "Sans ordonnance", rw: "Ntibisaba urupapuro rwa muganga" },
  "Pay online": { fr: "Payer en ligne", rw: "Ishyura kuri interineti" },
  "Reserve & pay at pharmacy": { fr: "Réserver et payer en pharmacie", rw: "Gena hanyuma wishyurire kuri farumasi" },
  "Send order for pharmacist review": { fr: "Envoyer pour vérification du pharmacien", rw: "Ohereza bisuzumwe n'umufarumasiye" },
  "Quantity": { fr: "Quantité", rw: "Umubare" },
  "Sold at:": { fr: "Vendu à :", rw: "Bigurishwa kuri:" },
  "Upload your doctor's prescription (PDF or photo, max 5 MB)": { fr: "Téléversez l'ordonnance de votre médecin (PDF ou photo, max 5 Mo)", rw: "Ohereza urupapuro rwa muganga wawe (PDF cyangwa ifoto, ntarengwa 5 MB)" },
  "A pharmacist reviews your prescription before the sale - you pay after it is approved.":
    { fr: "Un pharmacien vérifie votre ordonnance avant la vente - vous payez après approbation.",
      rw: "Umufarumasiye asuzuma urupapuro rwawe mbere yo kugurishwa - wishyura nyuma yo kwemezwa." },
  "Not currently in stock at any registered pharmacy.": { fr: "Actuellement en rupture dans toutes les pharmacies enregistrées.", rw: "Ubu ntibihari muri farumasi ziyandikishije." },
  "Not currently in stock anywhere": { fr: "En rupture de stock partout", rw: "Ntibihari na hamwe ubu" },

  /* ---- Health page ---- */
  "Daily routine": { fr: "Routine quotidienne", rw: "Gahunda ya buri munsi" },
  "Advice": { fr: "Conseils", rw: "Inama" },
  "Usual treatment": { fr: "Traitement habituel", rw: "Ubuvuzi busanzwe" },
  "Health guideline videos": { fr: "Vidéos de conseils santé", rw: "Amashusho y'amabwiriza y'ubuzima" },
  "High blood sugar caused by problems with insulin.": { fr: "Taux de sucre élevé dû à des problèmes d'insuline.", rw: "Isukari nyinshi mu maraso iterwa n'ibibazo bya insuline." },
  "Excess body fat that can raise the risk of other illnesses.": { fr: "Excès de graisse corporelle qui augmente le risque d'autres maladies.", rw: "Ibinure byinshi mu mubiri bishobora kongera ibyago by'izindi ndwara." },
  "A condition where the airways narrow and make breathing hard.": { fr: "Une maladie où les voies respiratoires se rétrécissent et gênent la respiration.", rw: "Indwara ituma imiyoboro y'umwuka yifunga bigatuma guhumeka bigora." },
  "Blood pressure that stays higher than the healthy range.": { fr: "Une tension artérielle qui reste au-dessus des valeurs saines.", rw: "Umuvuduko w'amaraso uguma hejuru y'urugero rwiza." },
  "Hypertension (high blood pressure)": { fr: "Hypertension (tension artérielle élevée)", rw: "Umuvuduko w'amaraso (uri hejuru)" },
  "Anemia": { fr: "Anémie", rw: "Amaraso make" },

  /* ---- Services ---- */
  "Drone delivery": { fr: "Livraison par drone", rw: "Gutwara na drone" },
  "Donate funds": { fr: "Donner des fonds", rw: "Tanga imfashanyo" },
  "Live delivery": { fr: "Livraison en direct", rw: "Itwarwa ririmo kuba" },
  "Estimated arrival": { fr: "Arrivée estimée", rw: "Igihe giteganyijwe cyo kugera" },
  "Route distance": { fr: "Distance du trajet", rw: "Intera y'urugendo" },
  "Cruise speed": { fr: "Vitesse de croisière", rw: "Umuvuduko w'indege" },
  "Payload": { fr: "Chargement", rw: "Umutwaro" },
  "Request priority drone delivery": { fr: "Demander une livraison prioritaire par drone", rw: "Saba ko drone izana amaraso byihutirwa" },
  "Community fundraising goal": { fr: "Objectif de collecte communautaire", rw: "Intego y'ubufatanye mu gutanga imfashanyo" },
  "Donate now": { fr: "Donner maintenant", rw: "Tanga ubu" },
  "Amount (RWF)": { fr: "Montant (RWF)", rw: "Umubare w'amafaranga (RWF)" },
  "Your name (optional)": { fr: "Votre nom (facultatif)", rw: "Izina ryawe (si itegeko)" },
  "Anonymous": { fr: "Anonyme", rw: "Utaravuze izina" },
  "Donate securely (Mobile Money / card)": { fr: "Donner en toute sécurité (Mobile Money / carte)", rw: "Tanga mu mutekano (Mobile Money / ikarita)" },
  "Support blood services in Rwanda": { fr: "Soutenez les services de sang au Rwanda", rw: "Shyigikira serivisi z'amaraso mu Rwanda" },

  /* ---- Subscribe ---- */
  "I'm a Hospital": { fr: "Je suis un hôpital", rw: "Ndi ibitaro" },
  "I'm a Pharmacy": { fr: "Je suis une pharmacie", rw: "Ndi farumasi" },
  "Most popular": { fr: "Le plus populaire", rw: "Ikunzwe cyane" },
  "Choose Basic": { fr: "Choisir Basic", rw: "Hitamo Basic" },
  "Choose Standard": { fr: "Choisir Standard", rw: "Hitamo Standard" },
  "Choose Premium": { fr: "Choisir Premium", rw: "Hitamo Premium" },
  "/ month": { fr: "/ mois", rw: "/ ukwezi" },
  "Pay securely with Mobile Money / card": { fr: "Payer en toute sécurité (Mobile Money / carte)", rw: "Ishyura mu mutekano (Mobile Money / ikarita)" },
  "Email support": { fr: "Assistance par e-mail", rw: "Ubufasha kuri imeyili" },
  "Everything in Basic": { fr: "Tout ce qu'offre Basic", rw: "Ibyo Basic itanga byose" },
  "Unlimited donor matches": { fr: "Mises en relation illimitées avec les donneurs", rw: "Guhuzwa n'abatanga bidafite umupaka" },
  "Post your blood requests": { fr: "Publiez vos demandes de sang", rw: "Tangaza ibisabwa byawe by'amaraso" },
  "Active": { fr: "Actif", rw: "Birakora" },
  "Inactive": { fr: "Inactif", rw: "Ntibikora" },
  "Not subscribed": { fr: "Non abonné", rw: "Ntabwo yiyandikishije" },

  /* ---- Dashboard ---- */
  "Donor": { fr: "Donneur", rw: "Umutanga" },
  "Admin": { fr: "Admin", rw: "Umuyobozi" },
  "Donor log in": { fr: "Connexion donneur", rw: "Kwinjira k'umutanga" },
  "Hospital log in": { fr: "Connexion hôpital", rw: "Kwinjira kw'ibitaro" },
  "Pharmacy log in": { fr: "Connexion pharmacie", rw: "Kwinjira kwa farumasi" },
  "Create donor account": { fr: "Créer un compte donneur", rw: "Fungura konti y'umutanga" },
  "Create your donor account": { fr: "Créez votre compte donneur", rw: "Fungura konti yawe y'umutanga" },
  "Create my donor account": { fr: "Créer mon compte donneur", rw: "Fungura konti yanjye y'umutanga" },
  "Register your hospital": { fr: "Inscrire votre hôpital", rw: "Andikisha ibitaro byawe" },
  "Register your pharmacy": { fr: "Inscrire votre pharmacie", rw: "Andikisha farumasi yawe" },
  "Create hospital account": { fr: "Créer le compte hôpital", rw: "Fungura konti y'ibitaro" },
  "Create pharmacy account": { fr: "Créer le compte pharmacie", rw: "Fungura konti ya farumasi" },
  "Hospital name": { fr: "Nom de l'hôpital", rw: "Izina ry'ibitaro" },
  "Pharmacy name": { fr: "Nom de la pharmacie", rw: "Izina rya farumasi" },
  "Site administrator": { fr: "Administrateur du site", rw: "Umuyobozi w'urubuga" },
  "Admin password": { fr: "Mot de passe admin", rw: "Ijambobanga ry'umuyobozi" },
  "Log in as admin": { fr: "Se connecter comme admin", rw: "Injira nk'umuyobozi" },
  "About me": { fr: "À propos de moi", rw: "Ibinyerekeye" },
  "About this hospital": { fr: "À propos de cet hôpital", rw: "Ibyerekeye ibi bitaro" },
  "About this pharmacy": { fr: "À propos de cette pharmacie", rw: "Ibyerekeye iyi farumasi" },
  "donations": { fr: "dons", rw: "amatangwa" },
  "lives potentially helped": { fr: "vies potentiellement aidées", rw: "ubuzima bushobora kuba bwarafashijwe" },
  "next eligible": { fr: "prochain don possible", rw: "igihe uzasubira gutanga" },
  "I donated today": { fr: "J'ai donné aujourd'hui", rw: "Natanze uyu munsi" },
  "Update my details": { fr: "Mettre à jour mes informations", rw: "Vugurura amakuru yanjye" },
  "Contact": { fr: "Contact", rw: "Aho umubariza" },
  "Registered on": { fr: "Inscrit le", rw: "Yiyandikishije ku wa" },
  "Screening certificate": { fr: "Certificat de dépistage", rw: "Icyemezo cy'isuzuma ry'amaraso" },
  "Your donation history": { fr: "Historique de vos dons", rw: "Amateka y'amatangwa yawe" },
  "Your saved location": { fr: "Votre position enregistrée", rw: "Aho uherereye byabitswe" },
  "My medicine orders": { fr: "Mes commandes de médicaments", rw: "Ibyo natumije mu miti" },
  "No donations recorded yet.": { fr: "Aucun don enregistré pour l'instant.", rw: "Nta tangwa ryanditswe kugeza ubu." },
  "blood requests posted": { fr: "demandes de sang publiées", rw: "ibisabwa by'amaraso byatangajwe" },
  "drone requests": { fr: "demandes de drone", rw: "ibisabwa bya drone" },
  "verified donors on the platform": { fr: "donneurs vérifiés sur la plateforme", rw: "abatanga bemejwe kuri urubuga" },
  "Drone requests": { fr: "Demandes de drone", rw: "Ibisabwa bya drone" },
  "Verification queue": { fr: "File de vérification", rw: "Urutonde rw'ibisuzumwa" },
  "Manage subscription": { fr: "Gérer l'abonnement", rw: "Gucunga ifatabuguzi" },
  "medicines in catalogue": { fr: "médicaments au catalogue", rw: "imiti iri ku rutonde" },
  "units sold": { fr: "unités vendues", rw: "ibyagurishijwe" },
  "revenue": { fr: "revenus", rw: "amafaranga yinjiye" },
  "Stock": { fr: "Stock", rw: "Ububiko" },
  "Orders & prescriptions": { fr: "Commandes et ordonnances", rw: "Ibyatumijwe n'impapuro za muganga" },
  "Sales": { fr: "Ventes", rw: "Ibyacurujwe" },
  "Update stock": { fr: "Mettre à jour le stock", rw: "Vugurura ububiko" },
  "in stock": { fr: "en stock", rw: "biri mu bubiko" },
  "View prescription": { fr: "Voir l'ordonnance", rw: "Reba urupapuro rwa muganga" },
  "View certificate": { fr: "Voir le certificat", rw: "Reba icyemezo" },
  "View document": { fr: "Voir le document", rw: "Reba inyandiko" },
  "Paid online": { fr: "Payé en ligne", rw: "Byishyuwe kuri interineti" },
  "Pay at pharmacy": { fr: "À payer en pharmacie", rw: "Kwishyurirwa kuri farumasi" },
  "Prescription to review": { fr: "Ordonnance à vérifier", rw: "Urupapuro rugomba gusuzumwa" },
  "Awaiting pharmacist review": { fr: "En attente de vérification du pharmacien", rw: "Birategereje isuzuma ry'umufarumasiye" },
  "Rejected by pharmacist": { fr: "Rejeté par le pharmacien", rw: "Byahakanywe n'umufarumasiye" },
  "Pay online now": { fr: "Payer en ligne maintenant", rw: "Ishyura kuri interineti ubu" },
  "Platform overview": { fr: "Vue d'ensemble de la plateforme", rw: "Incamake y'urubuga" },
  "Awaiting approval": { fr: "En attente d'approbation", rw: "Bitegereje kwemezwa" },
  "Approved": { fr: "Approuvé", rw: "Byemejwe" },
  "Medical documents review": { fr: "Vérification des documents médicaux", rw: "Isuzuma ry'inyandiko z'ubuvuzi" },
  "All accounts": { fr: "Tous les comptes", rw: "Konti zose" },
  "Feedback": { fr: "Retours", rw: "Ibitekerezo" },
  "Audit log": { fr: "Journal d'audit", rw: "Igitabo cy'ibikorwa" },
  "Reset password": { fr: "Réinitialiser le mot de passe", rw: "Subiza ijambobanga" },
  "Revoke approval": { fr: "Retirer l'approbation", rw: "Kuraho ukwemezwa" },
  "Mark verified": { fr: "Marquer comme vérifié", rw: "Shyiraho ko byemejwe" },

  /* ---- Payments ---- */
  "Pay with Mobile Money": { fr: "Payer avec Mobile Money", rw: "Ishyura na Mobile Money" },
  "Mobile Money number": { fr: "Numéro Mobile Money", rw: "Nimero ya Mobile Money" },
  "Send payment request": { fr: "Envoyer la demande de paiement", rw: "Ohereza icyifuzo cyo kwishyura" },
  "Payment received and verified!": { fr: "Paiement reçu et vérifié !", rw: "Ubwishyu bwakiriwe kandi bwemejwe!" },
  "Payment received and verified - thank you! Everything you paid for is now active.":
    { fr: "Paiement reçu et vérifié - merci ! Tout ce que vous avez payé est maintenant actif.",
      rw: "Ubwishyu bwakiriwe kandi bwemejwe - murakoze! Ibyo wishyuye byose ubu birakora." },

  /* ---- Footers ---- */
  "Rwanda Blood Donation Centre - demonstration project. Not a real medical service.":
    { fr: "Centre de don de sang du Rwanda - projet de démonstration. Pas un vrai service médical.",
      rw: "Ikigo cyo gutanga amaraso mu Rwanda - umushinga w'icyitegererezo. Si serivisi y'ubuvuzi nyayo." },
  "Rwanda Blood Donation Centre - demonstration project. Prices are illustrative only.":
    { fr: "Centre de don de sang du Rwanda - projet de démonstration. Les prix sont indicatifs.",
      rw: "Ikigo cyo gutanga amaraso mu Rwanda - umushinga w'icyitegererezo. Ibiciro ni urugero gusa." },
  "Rwanda Blood Donation Centre - demonstration project.": {
    fr: "Centre de don de sang du Rwanda - projet de démonstration.",
    rw: "Ikigo cyo gutanga amaraso mu Rwanda - umushinga w'icyitegererezo." }
};

/* Prefix rules: for composed strings like "Contact: 0788...". */
const S_PREFIX = [
  { en: "Contact: ", fr: "Contact : ", rw: "Aho umubariza: " },
  { en: "Needs ", fr: "Besoin de ", rw: "Hakenewe " },
  { en: "Posted ", fr: "Publié le ", rw: "Byatangajwe " },
  { en: "Sold at: ", fr: "Vendu à : ", rw: "Bigurishwa kuri: " },
  { en: "Selected: ", fr: "Sélectionné : ", rw: "Ihitamo: " },
  { en: "Hi, ", fr: "Salut, ", rw: "Muraho, " }
];

/* ============================================================
   Engine
   ============================================================ */
const _i18nOrigText = new WeakMap();  // text node -> original English
const _i18nOrigAttr = new WeakMap();  // element -> {attr: original}
let _i18nLang = "en";
let _i18nObserver = null;
const I18N_ATTRS = ["placeholder", "title", "aria-label"];

function _i18nLookup(en, lang) {
  const row = S[en];
  if (row && row[lang]) return row[lang];
  for (const p of S_PREFIX) {
    if (en.indexOf(p.en) === 0 && p[lang]) return p[lang] + en.slice(p.en.length);
  }
  return null;
}

function _i18nTextNode(node, lang) {
  const original = _i18nOrigText.has(node) ? _i18nOrigText.get(node) : node.nodeValue;
  if (lang === "en") {
    if (_i18nOrigText.has(node)) node.nodeValue = original;
    return;
  }
  const trimmed = original.trim();
  if (!trimmed) return;
  const tr = _i18nLookup(trimmed, lang);
  if (tr) {
    if (!_i18nOrigText.has(node)) _i18nOrigText.set(node, node.nodeValue);
    node.nodeValue = original.replace(trimmed, tr);
  } else if (_i18nOrigText.has(node)) {
    node.nodeValue = original; // e.g. switching fr -> rw with no rw entry
  }
}

function _i18nElementAttrs(el, lang) {
  if (!el.getAttribute) return;
  let store = _i18nOrigAttr.get(el);
  for (const attr of I18N_ATTRS) {
    const current = el.getAttribute(attr);
    const original = store && attr in store ? store[attr] : current;
    if (!original) continue;
    if (lang === "en") {
      if (store && attr in store) el.setAttribute(attr, store[attr]);
      continue;
    }
    const tr = _i18nLookup(original.trim(), lang);
    if (tr) {
      if (!store) { store = {}; _i18nOrigAttr.set(el, store); }
      if (!(attr in store)) store[attr] = current;
      el.setAttribute(attr, tr);
    } else if (store && attr in store) {
      el.setAttribute(attr, store[attr]);
    }
  }
}

function _i18nWalk(root, lang) {
  if (root.nodeType === 3) { _i18nTextNode(root, lang); return; }
  if (root.nodeType !== 1) return;
  const tag = root.tagName;
  if (tag === "SCRIPT" || tag === "STYLE") return;
  _i18nElementAttrs(root, lang);
  for (let child = root.firstChild; child; child = child.nextSibling) _i18nWalk(child, lang);
}

function translatePage(lang) {
  _i18nLang = lang || "en";
  const dict = I18N[_i18nLang] || I18N.en;
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    const key = el.getAttribute("data-i18n");
    const text = dict[key] || I18N.en[key];
    if (text) el.textContent = text;
  });
  if (document.body) _i18nWalk(document.body, _i18nLang);

  // Translate content that JavaScript renders AFTER this point, the
  // moment it is added to the page.
  if (!_i18nObserver && window.MutationObserver && document.body) {
    _i18nObserver = new MutationObserver(function (mutations) {
      if (_i18nLang === "en") return;
      for (const m of mutations) {
        m.addedNodes && m.addedNodes.forEach(function (n) { _i18nWalk(n, _i18nLang); });
      }
    });
    _i18nObserver.observe(document.body, { childList: true, subtree: true });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const lang = (typeof getSettings === "function") ? getSettings().language : "en";
  translatePage(lang);
});
