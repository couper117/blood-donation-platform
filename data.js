/* ============================================================
   Blood Donation Centre - shared data for Rwanda.
   Loaded by every page in the browser AND by server.js in Node
   (see the module.exports at the bottom), so the catalogue and
   seed accounts exist in exactly one place.
   Coordinates are approximate (city / neighbourhood level).
   ============================================================ */

/* Hospitals across all of Rwanda - referral, provincial and district
   hospitals in every province, with approximate GPS coordinates and
   contact numbers. Used by the map, the Directory's Hospitals tab
   and the drone delivery routes. */
const RW_HOSPITALS = [
  /* --- Kigali City --- */
  { name: "CHUK - University Teaching Hospital of Kigali", city: "Kigali (Nyarugenge)", lat: -1.9536, lng: 30.0606, phone: "+250 252 575 555", type: "Referral hospital", blood: true },
  { name: "King Faisal Hospital", city: "Kigali (Gasabo)", lat: -1.9430, lng: 30.0710, phone: "+250 252 588 888", type: "Referral hospital", blood: true },
  { name: "Rwanda Military Hospital", city: "Kigali (Kanombe)", lat: -1.9707, lng: 30.1348, phone: "+250 252 641 400", type: "Referral hospital", blood: true },
  { name: "Kibagabaga District Hospital", city: "Kigali (Gasabo)", lat: -1.9370, lng: 30.1170, phone: "+250 252 587 474", type: "District hospital", blood: true },
  { name: "Masaka District Hospital", city: "Kigali (Kicukiro)", lat: -2.0170, lng: 30.1400, phone: "+250 252 580 020", type: "District hospital", blood: false },
  { name: "Muhima District Hospital", city: "Kigali (Nyarugenge)", lat: -1.9420, lng: 30.0570, phone: "+250 252 575 285", type: "District hospital", blood: true },
  { name: "Kacyiru Police Hospital", city: "Kigali (Kacyiru)", lat: -1.9330, lng: 30.0900, phone: "+250 252 584 741", type: "Specialised hospital", blood: false },

  /* --- Eastern Province --- */
  { name: "Nyagatare District Hospital", city: "Nyagatare (Eastern Province)", lat: -1.2930, lng: 30.3270, phone: "+250 252 567 890", type: "District hospital", blood: false },
  { name: "Gahini District Hospital", city: "Kayonza (Eastern Province)", lat: -1.8440, lng: 30.4620, phone: "+250 252 567 231", type: "District hospital", blood: false },
  { name: "Rwinkwavu District Hospital", city: "Kayonza (Eastern Province)", lat: -2.1720, lng: 30.6180, phone: "+250 252 566 149", type: "District hospital", blood: true },
  { name: "Kibungo Referral Hospital", city: "Ngoma (Eastern Province)", lat: -2.1600, lng: 30.5420, phone: "+250 252 566 015", type: "Referral hospital", blood: true },
  { name: "Kirehe District Hospital", city: "Kirehe (Eastern Province)", lat: -2.2260, lng: 30.7050, phone: "+250 252 566 302", type: "District hospital", blood: false },
  { name: "Rwamagana Provincial Hospital", city: "Rwamagana (Eastern Province)", lat: -1.9490, lng: 30.4340, phone: "+250 252 567 005", type: "Provincial hospital", blood: true },
  { name: "Nyamata District Hospital", city: "Bugesera (Eastern Province)", lat: -2.1500, lng: 30.0940, phone: "+250 252 566 700", type: "District hospital", blood: true },
  { name: "Ngarama District Hospital", city: "Gatsibo (Eastern Province)", lat: -1.5540, lng: 30.3320, phone: "+250 252 567 410", type: "District hospital", blood: false },
  { name: "Kiziguro District Hospital", city: "Gatsibo (Eastern Province)", lat: -1.7620, lng: 30.4110, phone: "+250 252 567 512", type: "District hospital", blood: false },

  /* --- Northern Province --- */
  { name: "Ruhengeri Referral Hospital", city: "Musanze (Northern Province)", lat: -1.4990, lng: 29.6350, phone: "+250 252 546 216", type: "Referral hospital", blood: true },
  { name: "Butaro District Hospital", city: "Burera (Northern Province)", lat: -1.4180, lng: 29.8390, phone: "+250 252 546 655", type: "District hospital", blood: true },
  { name: "Byumba District Hospital", city: "Gicumbi (Northern Province)", lat: -1.5770, lng: 30.0670, phone: "+250 252 564 003", type: "District hospital", blood: true },
  { name: "Nemba District Hospital", city: "Gakenke (Northern Province)", lat: -1.5410, lng: 29.7590, phone: "+250 252 546 810", type: "District hospital", blood: false },
  { name: "Ruli District Hospital", city: "Gakenke (Northern Province)", lat: -1.6720, lng: 29.8580, phone: "+250 252 546 912", type: "District hospital", blood: false },
  { name: "Rutongo District Hospital", city: "Rulindo (Northern Province)", lat: -1.8330, lng: 30.0350, phone: "+250 252 564 210", type: "District hospital", blood: false },
  { name: "Kinihira Provincial Hospital", city: "Rulindo (Northern Province)", lat: -1.6710, lng: 30.0630, phone: "+250 252 564 118", type: "Provincial hospital", blood: true },

  /* --- Southern Province --- */
  { name: "CHUB - University Teaching Hospital of Butare", city: "Huye (Southern Province)", lat: -2.6078, lng: 29.7460, phone: "+250 252 530 022", type: "Referral hospital", blood: true },
  { name: "Kabgayi District Hospital", city: "Muhanga (Southern Province)", lat: -2.0800, lng: 29.7560, phone: "+250 252 530 200", type: "District hospital", blood: true },
  { name: "Kabutare District Hospital", city: "Huye (Southern Province)", lat: -2.6120, lng: 29.7420, phone: "+250 252 530 313", type: "District hospital", blood: false },
  { name: "Nyanza Provincial Hospital", city: "Nyanza (Southern Province)", lat: -2.3510, lng: 29.7400, phone: "+250 252 532 030", type: "Provincial hospital", blood: true },
  { name: "Gitwe District Hospital", city: "Ruhango (Southern Province)", lat: -2.2540, lng: 29.6720, phone: "+250 252 532 415", type: "District hospital", blood: false },
  { name: "Ruhango Provincial Hospital", city: "Ruhango (Southern Province)", lat: -2.2270, lng: 29.7780, phone: "+250 252 532 209", type: "Provincial hospital", blood: true },
  { name: "Remera-Rukoma District Hospital", city: "Kamonyi (Southern Province)", lat: -2.0550, lng: 29.9130, phone: "+250 252 530 508", type: "District hospital", blood: false },
  { name: "Kigeme District Hospital", city: "Nyamagabe (Southern Province)", lat: -2.5330, lng: 29.5590, phone: "+250 252 535 021", type: "District hospital", blood: false },
  { name: "Kaduha District Hospital", city: "Nyamagabe (Southern Province)", lat: -2.4180, lng: 29.5620, phone: "+250 252 535 116", type: "District hospital", blood: false },
  { name: "Munini District Hospital", city: "Nyaruguru (Southern Province)", lat: -2.6870, lng: 29.5340, phone: "+250 252 535 244", type: "District hospital", blood: false },
  { name: "Gisagara District Hospital", city: "Gisagara (Southern Province)", lat: -2.6210, lng: 29.8430, phone: "+250 252 530 622", type: "District hospital", blood: false },

  /* --- Western Province --- */
  { name: "Gisenyi District Hospital", city: "Rubavu (Western Province)", lat: -1.7050, lng: 29.2570, phone: "+250 252 540 137", type: "District hospital", blood: true },
  { name: "Kibuye Referral Hospital", city: "Karongi (Western Province)", lat: -2.0600, lng: 29.3480, phone: "+250 252 568 118", type: "Referral hospital", blood: true },
  { name: "Mugonero District Hospital", city: "Karongi (Western Province)", lat: -2.1780, lng: 29.4020, phone: "+250 252 568 342", type: "District hospital", blood: false },
  { name: "Murunda District Hospital", city: "Rutsiro (Western Province)", lat: -1.8720, lng: 29.3320, phone: "+250 252 568 430", type: "District hospital", blood: false },
  { name: "Shyira District Hospital", city: "Nyabihu (Western Province)", lat: -1.5980, lng: 29.5210, phone: "+250 252 540 322", type: "District hospital", blood: false },
  { name: "Kabaya District Hospital", city: "Ngororero (Western Province)", lat: -1.6580, lng: 29.4340, phone: "+250 252 540 415", type: "District hospital", blood: false },
  { name: "Kibogora District Hospital", city: "Nyamasheke (Western Province)", lat: -2.3910, lng: 29.1240, phone: "+250 252 538 027", type: "District hospital", blood: true },
  { name: "Bushenge Provincial Hospital", city: "Nyamasheke (Western Province)", lat: -2.4430, lng: 29.0530, phone: "+250 252 538 140", type: "Provincial hospital", blood: true },
  { name: "Gihundwe District Hospital", city: "Rusizi (Western Province)", lat: -2.4780, lng: 28.9070, phone: "+250 252 538 233", type: "District hospital", blood: true },
  { name: "Mibilizi District Hospital", city: "Rusizi (Western Province)", lat: -2.6220, lng: 28.9840, phone: "+250 252 538 316", type: "District hospital", blood: false }
];

/* Blood supply / demand by area (real Rwandan districts). */
const RW_AREAS = [
  { name: "Kigali City",   lat: -1.9441, lng: 30.0619, status: "demand",   available: 30, needed: 120 },
  { name: "Musanze",       lat: -1.4990, lng: 29.6350, status: "balanced", available: 42, needed: 40  },
  { name: "Huye",          lat: -2.6078, lng: 29.7460, status: "supply",   available: 60, needed: 25  },
  { name: "Rubavu",        lat: -1.7050, lng: 29.2570, status: "demand",   available: 15, needed: 55  },
  { name: "Nyagatare",     lat: -1.2930, lng: 30.3270, status: "balanced", available: 28, needed: 26  },
  { name: "Muhanga",       lat: -2.0800, lng: 29.7560, status: "supply",   available: 50, needed: 20  },
  { name: "Rusizi",        lat: -2.4846, lng: 28.9070, status: "demand",   available: 10, needed: 48  }
];

/* The National Blood Transfusion Centre / Zipline drone nests
   that deliver blood by drone in Rwanda. */
const DRONE_BASES = [
  { name: "Muhanga Distribution Centre", lat: -2.0800, lng: 29.7560 },
  { name: "Kayonza Distribution Centre", lat: -1.8800, lng: 30.6200 }
];

const STATUS_INFO = {
  supply:   { label: "Supply - enough blood", color: "#2e9e5b" },
  balanced: { label: "Balanced",              color: "#e0a100" },
  demand:   { label: "Demand - blood needed", color: "#d7263d" }
};

/* Real pharmacies operating in Rwanda, sourced from the RwandaYP
   business directory and Rwanda FDA licensed-pharmacy lists. */
const RW_PHARMACIES = [
  { name: "Adrenaline Pharmacy", city: "Kigali (Kabeza)", lat: -1.9550, lng: 30.1080, phone: "+250 785 636 683" },
  { name: "Pharmacie Pharmalab", city: "Kigali (Nyarugenge)", lat: -1.9500, lng: 30.0580, phone: "+250 788 477 537" },
  { name: "Pharmacie Conseil", city: "Kigali", lat: -1.9470, lng: 30.0620, phone: "+250 788 380 066" },
  { name: "AfriChem Rwanda", city: "Kigali", lat: -1.9450, lng: 30.0650, phone: "+250 788 300 784" },
  { name: "Pharmacie Continentale", city: "Kigali (KG 1 Ave)", lat: -1.9490, lng: 30.0600, phone: "+250 788 306 878" },
  { name: "Kipharma", city: "Kigali (Nyarugenge)", lat: -1.9520, lng: 30.0590, phone: "+250 252 572 944" },
  { name: "Oazis Pharmacy", city: "Kigali", lat: -1.9560, lng: 30.0710, phone: "+250 781 958 800" },
  { name: "Biopharmacia", city: "Kigali (Nyarugenge)", lat: -1.9510, lng: 30.0570, phone: "+250 252 504 086" },
  { name: "Lifecare Pharmacy", city: "Kigali", lat: -1.9430, lng: 30.0640, phone: "+250 252 501 313" },
  { name: "Sara's Pharmacy", city: "Kigali", lat: -1.9410, lng: 30.0690, phone: "+250 252 573 414" },
  { name: "Moderne Pharmacy", city: "Kigali", lat: -1.9540, lng: 30.0660, phone: "+250 252 572 390" },
  { name: "Butare Ville Huye Pharmacy", city: "Huye (Southern Province)", lat: -2.5980, lng: 29.7400, phone: "+250 783 471 037" },
  { name: "BGK Pharmacy", city: "Musanze (Muhoza)", lat: -1.4970, lng: 29.6330, phone: "+250 788 302 354" },
  { name: "Iraguha Pharmacy", city: "Musanze", lat: -1.5010, lng: 29.6370, phone: "+250 783 117 737" },
  { name: "Pharmacie Ingenzi", city: "Rubavu", lat: -1.7030, lng: 29.2550, phone: "+250 788 551 095" },
  { name: "Lago Pharmacy", city: "Rubavu", lat: -1.7070, lng: 29.2590, phone: "+250 788 228 131" },
  { name: "Muhire Pharmacy", city: "Rubavu (near the district hospital)", lat: -1.7060, lng: 29.2530, phone: "+250 788 452 718" }
];

/* Medicines catalogue - STRICTLY limited to the health cases this
   website works on (the Health page tabs: anemia / blood support,
   diabetes, hypertension, asthma, heart health, obesity). Nothing
   outside those cases is listed or sold here.
   `caseId` ties each medicine to its Health page tab.
   `rx: true` means a doctor's prescription must be uploaded before
   the medicine can be bought on this site. Prices are illustrative RWF. */
const MEDICINES = [
  /* Anemia / donor & recipient blood support */
  { id: "med-iron", name: "Ferrous Sulfate (Iron tablets)", category: "Anemia & blood support", caseId: "anemia", rx: false, price: 1500, icon: "Fe",
    description: "Iron supplement recommended after donating blood, or for people with low iron / anaemia, to help the body replace iron lost with red blood cells." },
  { id: "med-folic", name: "Folic Acid tablets", category: "Anemia & blood support", caseId: "anemia", rx: false, price: 1200, icon: "B9",
    description: "Supports healthy red blood cell production. Often taken together with iron by donors and by people recovering from blood loss." },
  { id: "med-b12", name: "Vitamin B12 tablets", category: "Anemia & blood support", caseId: "anemia", rx: false, price: 2500, icon: "B12",
    description: "Supports red blood cell formation and nerve health; a common recommendation for donors with low B12 levels." },
  { id: "med-multivit", name: "Multivitamin tablets", category: "Anemia & blood support", caseId: "anemia", rx: false, price: 3000, icon: "MV",
    description: "General nutritional support for regular donors and for patients recovering after receiving blood." },
  { id: "med-ors", name: "Oral Rehydration Salts (ORS)", category: "Anemia & blood support", caseId: "anemia", rx: false, price: 500, icon: "ORS",
    description: "Rehydration sachets useful after donating blood, or for anyone recovering from dehydration." },

  /* Diabetes */
  { id: "med-metformin", name: "Metformin 500mg", category: "Diabetes", caseId: "diabetes", rx: true, price: 2000, icon: "Met",
    description: "First-line oral medicine for type 2 diabetes, used alongside diet and exercise to help control blood sugar." },
  { id: "med-glibenclamide", name: "Glibenclamide 5mg", category: "Diabetes", caseId: "diabetes", rx: true, price: 1800, icon: "Glb",
    description: "An oral medicine that helps the pancreas release more insulin, prescribed for some people with type 2 diabetes." },

  /* Hypertension */
  { id: "med-amlodipine", name: "Amlodipine 5mg", category: "Hypertension", caseId: "hypertension", rx: true, price: 2200, icon: "Aml",
    description: "A calcium-channel blocker commonly prescribed to lower and control high blood pressure." },
  { id: "med-hctz", name: "Hydrochlorothiazide 25mg", category: "Hypertension", caseId: "hypertension", rx: true, price: 1600, icon: "HCT",
    description: "A 'water tablet' (diuretic) prescribed to lower blood pressure, alone or together with other blood pressure medicines." },

  /* Asthma */
  { id: "med-salbutamol", name: "Salbutamol Inhaler", category: "Asthma", caseId: "asthma", rx: true, price: 4500, icon: "Inh",
    description: "A reliever inhaler that quickly eases asthma symptoms such as wheezing and shortness of breath." },
  { id: "med-beclo", name: "Beclometasone Inhaler", category: "Asthma", caseId: "asthma", rx: true, price: 6500, icon: "Bec",
    description: "A daily preventer inhaler that reduces airway inflammation so asthma attacks happen less often." },

  /* Heart health */
  { id: "med-atorvastatin", name: "Atorvastatin 20mg", category: "Heart health", caseId: "heart", rx: true, price: 3500, icon: "Ator",
    description: "Lowers cholesterol and is often prescribed alongside blood pressure treatment to reduce heart-disease risk." },
  { id: "med-aspirin", name: "Aspirin 75mg (low dose)", category: "Heart health", caseId: "heart", rx: false, price: 900, icon: "Asp",
    description: "Low-dose aspirin, sometimes recommended by doctors to help protect the heart. Only take it daily if a doctor advises it." },

  /* Obesity */
  { id: "med-orlistat", name: "Orlistat 120mg", category: "Obesity", caseId: "obesity", rx: true, price: 6000, icon: "Orl",
    description: "Taken with meals to support weight management as part of a supervised diet and exercise plan for obesity." }
];

/* Seed pharmacy accounts (real names from RW_PHARMACIES) so the
   Medicines page shows genuine sellers with real stock from the first
   load. Password for every demo account: demo1234 */
const PHARMACY_SEED_ACCOUNTS = [
  { account: { name: "Adrenaline Pharmacy", email: "info@adrenalinepharmacy.rw", phone: "+250 785 636 683", city: "Kigali (Kabeza)", lat: -1.9550, lng: 30.1080 },
    stock: [{ medicineId: "med-iron", qty: 60 }, { medicineId: "med-folic", qty: 80 }, { medicineId: "med-ors", qty: 120 }, { medicineId: "med-metformin", qty: 40 }, { medicineId: "med-amlodipine", qty: 35 }] },
  { account: { name: "Pharmacie Conseil", email: "contact@pharmacieconseil.rw", phone: "+250 788 380 066", city: "Kigali", lat: -1.9470, lng: 30.0620 },
    stock: [{ medicineId: "med-b12", qty: 25 }, { medicineId: "med-multivit", qty: 50 }, { medicineId: "med-salbutamol", qty: 20 }, { medicineId: "med-atorvastatin", qty: 30 }, { medicineId: "med-aspirin", qty: 90 }] },
  { account: { name: "Kipharma", email: "info@kipharma.rw", phone: "+250 252 572 944", city: "Kigali (Nyarugenge)", lat: -1.9520, lng: 30.0590 },
    stock: [{ medicineId: "med-iron", qty: 45 }, { medicineId: "med-metformin", qty: 55 }, { medicineId: "med-amlodipine", qty: 40 }, { medicineId: "med-orlistat", qty: 15 }, { medicineId: "med-glibenclamide", qty: 25 }] },
  { account: { name: "Lifecare Pharmacy", email: "hello@lifecarepharmacy.rw", phone: "+250 252 501 313", city: "Kigali", lat: -1.9430, lng: 30.0640 },
    stock: [{ medicineId: "med-folic", qty: 70 }, { medicineId: "med-ors", qty: 100 }, { medicineId: "med-b12", qty: 30 }, { medicineId: "med-salbutamol", qty: 18 }, { medicineId: "med-hctz", qty: 40 }] },
  { account: { name: "BGK Pharmacy", email: "info@bgkpharmacy.rw", phone: "+250 788 302 354", city: "Musanze (Muhoza)", lat: -1.4970, lng: 29.6330 },
    stock: [{ medicineId: "med-multivit", qty: 40 }, { medicineId: "med-metformin", qty: 25 }, { medicineId: "med-atorvastatin", qty: 20 }, { medicineId: "med-iron", qty: 35 }, { medicineId: "med-beclo", qty: 10 }] },
  { account: { name: "Pharmacie Ingenzi", email: "contact@pharmacieingenzi.rw", phone: "+250 788 551 095", city: "Rubavu", lat: -1.7030, lng: 29.2550 },
    stock: [{ medicineId: "med-amlodipine", qty: 28 }, { medicineId: "med-ors", qty: 90 }, { medicineId: "med-orlistat", qty: 12 }, { medicineId: "med-folic", qty: 45 }, { medicineId: "med-aspirin", qty: 60 }] }
];

/* Seed hospital accounts (real hospitals from RW_HOSPITALS) with
   active subscriptions, so a signed-in donor's map view (which only
   shows subscribed hospitals) has real content from the first load,
   and so the Verification Queue can be tried immediately.
   Password for every demo account: demo1234 */
const HOSPITAL_SEED_ACCOUNTS = [
  { name: "CHUK - University Teaching Hospital of Kigali", email: "info@chuk.rw", phone: "+250 252 575 555", city: "Kigali (Nyarugenge)", lat: -1.9536, lng: 30.0606, plan: "Premium" },
  { name: "King Faisal Hospital", email: "info@kfh.rw", phone: "+250 252 588 888", city: "Kigali (Gasabo)", lat: -1.9430, lng: 30.0710, plan: "Premium" },
  { name: "Kibagabaga District Hospital", email: "info@kibagabaga.rw", phone: "+250 252 587 474", city: "Kigali (Gasabo)", lat: -1.9370, lng: 30.1170, plan: "Standard" },
  { name: "CHUB - University Teaching Hospital of Butare", email: "info@chub.rw", phone: "+250 252 530 022", city: "Huye (Southern Province)", lat: -2.6078, lng: 29.7460, plan: "Standard" },
  { name: "Ruhengeri Referral Hospital", email: "info@ruhengerihospital.rw", phone: "+250 252 546 216", city: "Musanze (Northern Province)", lat: -1.4990, lng: 29.6350, plan: "Basic" },
  { name: "Kibuye Referral Hospital", email: "info@kibuyehospital.rw", phone: "+250 252 568 118", city: "Karongi (Western Province)", lat: -2.0600, lng: 29.3480, plan: "Basic" }
];

/* Subscription prices (RWF / month) - used by the Subscribe page UI
   and by the server when creating a real payment, so the amount
   charged can never be tampered with from the browser. */
const PLAN_PRICES = {
  hospital: { Basic: 50000, Standard: 150000, Premium: 400000 },
  pharmacy: { Basic: 30000, Standard: 80000, Premium: 180000 }
};

/* Make the same data available to server.js in Node. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RW_HOSPITALS, RW_AREAS, DRONE_BASES, STATUS_INFO, RW_PHARMACIES,
    MEDICINES, PHARMACY_SEED_ACCOUNTS, HOSPITAL_SEED_ACCOUNTS, PLAN_PRICES
  };
}
