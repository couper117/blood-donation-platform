/* ============================================================
   Quick-help chatbot knowledge base - 100% client-side JavaScript,
   no network calls, no server, no API key. Works the instant the
   HTML files are opened, online or offline.

   Matching approach: each intent lists keyword/phrase patterns.
   For a user's message we score every intent by how many of its
   patterns appear in the message, weighting longer/more specific
   phrases higher, and reply with the best-scoring intent above a
   small threshold. This is a lot more forgiving than "first
   keyword that matches" - e.g. "how often can I give blood" and
   "how many days between donations" both land on the same intent.
   ============================================================ */

const BOT_INTENTS = [
  // ---------- Site features ----------
  { id: "donate", patterns: ["how do i donate", "become a donor", "register as a donor", "donate blood", "give blood", "sign up to donate", "gutanga amaraso", "faire un don"],
    responses: ["To become a donor: open the Donate page, fill in your details, pin your location on the map, and upload your blood screening certificate. That also creates your account so you can log in from My Account afterwards."] },
  { id: "request", patterns: ["request blood", "need blood", "post a request", "blood needed", "ask for blood", "besoin de sang", "nkeneye amaraso"],
    responses: ["Only HOSPITALS with an active subscription can post blood requests, on the Directory page's Blood requests tab. Individuals cannot request blood on this platform - if a patient needs blood, contact the nearest hospital (Directory > Hospitals). Requests stay up for 30 days and donors can book them."] },
  { id: "book-request", patterns: ["book a request", "booked", "claim a request", "fulfilled request", "open request", "unbooked"],
    responses: ["Every blood request in the Directory shows a status: Open (green), Booked (amber, once a donor or hospital has claimed it), or removed once Fulfilled. Click \"Book this request\" on an open one to claim it."] },
  { id: "subscribe", patterns: ["subscription", "subscribe", "plan", "pricing", "how much does it cost", "premium plan", "basic plan", "standard plan", "abonnement", "kwiyandikisha"],
    responses: ["Hospitals and pharmacies subscribe on the Subscribe page. Three tiers - Basic, Standard and Premium - each with different features (Premium gives the unlimited experience, including priority drone delivery for hospitals). Pick a plan, fill in your details and choose a payment method; it activates for 30 days."] },
  { id: "payment", patterns: ["payment method", "how do i pay", "mobile money", "momo", "bank transfer", "pay by card", "kwishyura"],
    responses: ["Payments are REAL and processed securely by Flutterwave: MTN/Airtel Mobile Money or card, in RWF. Subscriptions, medicine purchases and fund donations all use it. What you paid for activates only after the payment is verified by the server."] },
  { id: "hospital-account", patterns: ["register a hospital", "hospital account", "hospital login", "sign up my hospital"],
    responses: ["Open My Account, choose the \"Hospital\" tab, and register with your hospital's name, email and a password. You'll then want to pick a subscription plan on the Subscribe page to post/request blood or use drone delivery."] },
  { id: "pharmacy-account", patterns: ["register a pharmacy", "pharmacy account", "pharmacy login", "sign up my pharmacy", "farumasi"],
    responses: ["Open My Account, choose the \"Pharmacy\" tab, and register with your pharmacy's name, email and a password. Pharmacies get the same kind of account as hospitals (profile, subscription plans, sales tracking) but never post or request blood."] },
  { id: "drone", patterns: ["drone", "drone delivery", "how does drone delivery work", "priority delivery"],
    responses: ["Open Services > Drone delivery to track a live simulated delivery flight. Hospitals with an active Premium subscription can also request priority drone delivery of blood right there - it's the demo's model for real drone blood delivery used in Rwanda."] },
  { id: "verification", patterns: ["verify", "verification", "certificate", "screening document", "approved by hospital", "verified badge"],
    responses: ["After you upload your screening certificate on Donate, it's marked \"pending\". A hospital account reviews it from their dashboard's Verification Queue and approves or rejects it - once approved you get a \"Verified\" badge on your profile and in the Directory."] },
  { id: "medicines", patterns: ["medicine", "medication", "buy medicine", "where can i buy", "prescription", "imiti", "medicament"],
    responses: ["The Medicines page only sells medicines for the cases this site covers: anemia & blood support, diabetes, hypertension, asthma, heart health and obesity. Medicines marked 'Prescription needed' require you to upload your doctor's prescription before buying. You can pay online (Mobile Money/card) or reserve and pay at the pharmacy."] },
  { id: "pharmacy-directory", patterns: ["pharmacy near me", "find a pharmacy", "list of pharmacies", "pharmacie", "farumasi"],
    responses: ["Open Directory > Pharmacies for a map and list of real pharmacies across Rwanda, plus the pharmacies registered on this platform with their subscription tier."] },
  { id: "map", patterns: ["map", "rotate the map", "zoom the map", "live map", "navigate the map", "ikarita"],
    responses: ["The Live Map is a real, navigable map: drag to pan, scroll or pinch to zoom, right-click-drag to rotate and tilt. It shows every hospital in Rwanda, pharmacies, donors and district supply/demand. Note: a signed-in donor sees only hospitals with an active subscription."] },
  { id: "hospitals", patterns: ["find a hospital", "nearest hospital", "hospital near me", "hospital list", "ibitaro"],
    responses: ["Open Directory > Hospitals for every referral, provincial and district hospital across Rwanda with phone numbers - \"Find hospitals near me\" sorts them by distance from you."] },
  { id: "emergency", patterns: ["emergency", "ambulance", "912", "urgent help", "call an ambulance", "urgence", "ubutabazi"],
    responses: ["For a real emergency, use the red Emergency button in the bottom-left corner of any page - it can call 912 (Rwanda's real ambulance number) directly, or find and call the nearest hospital using your location."] },
  { id: "settings", patterns: ["dark mode", "theme", "settings", "igenamiterere"],
    responses: ["Open Settings (the gear icon in the menu) for the essentials: your language (English, French or Kinyarwanda) and dark mode."] },
  { id: "language", patterns: ["change language", "kinyarwanda", "french", "francais", "ururimi", "langue"],
    responses: ["Settings (the gear icon) > Language lets you switch the menus and key pages between English, French and Kinyarwanda. Deep page content is still English-only in some places - that's noted right there."] },
  { id: "account", patterns: ["my account", "dashboard", "profile", "log in", "log out", "login", "logout", "konti"],
    responses: ["My Account (top-right of the menu) is where donors, hospitals and pharmacies log in and see their profile: donation history for donors, blood/drone requests and the verification queue for hospitals, medicines and sales for pharmacies."] },
  { id: "next-eligible", patterns: ["next eligible", "when can i donate again", "how often can i donate", "days between donations", "56 days"],
    responses: ["Most healthy adults can donate whole blood again 56 days after their last donation. Your My Account page shows your own next-eligible date once you've recorded a donation."] },
  { id: "funds", patterns: ["donate money", "funds", "fundraising", "financial donation", "imfashanyo"],
    responses: ["Open Services > Donate funds to support the blood service financially (testing kits, cold storage, drone operations, outreach). It's a real payment via Mobile Money or card, and the community fundraising bar updates once your payment is verified."] },
  { id: "privacy", patterns: ["is my data private", "where is my data stored", "data privacy", "who can see my information"],
    responses: ["Your account data is stored in this site's own database on its server, protected by your password. Public pages only show what the directory needs (donor name, blood group, area, contact); your screening certificate is only visible to hospitals reviewing verifications."] },

  // ---------- Health-page conditions ----------
  { id: "diabetes", patterns: ["diabetes", "blood sugar", "insulin"],
    responses: ["Diabetes is high blood sugar from problems with insulin. General routine: check blood sugar as advised, eat at regular times, stay active, take medication on schedule. See the Health page's Diabetes tab for fuller advice - this isn't medical advice, just a general guide."] },
  { id: "hypertension", patterns: ["hypertension", "high blood pressure", "blood pressure"],
    responses: ["Hypertension is blood pressure that stays higher than healthy. General advice: reduce salt, eat more fruit and vegetables, limit alcohol, don't smoke, and take any prescribed medicine on schedule. See the Health page's Hypertension tab for more."] },
  { id: "asthma", patterns: ["asthma", "inhaler", "wheezing"],
    responses: ["Asthma narrows the airways and makes breathing harder. Reliever inhalers ease symptoms; preventer inhalers are taken daily; avoid triggers like smoke and dust. See the Health page's Asthma tab for the fuller guide."] },
  { id: "anemia", patterns: ["anemia", "anaemia", "low iron", "iron deficiency"],
    responses: ["Anemia means not enough healthy red blood cells - it's the condition most directly tied to blood donation and iron levels. Iron-rich foods and, if prescribed, iron supplements help; the Medicines page lists iron, folic acid and B12 options. See the Health page's Anemia tab for more."] },
  { id: "obesity", patterns: ["obesity", "overweight", "lose weight", "weight management"],
    responses: ["Obesity is excess body fat that raises other health risks. General advice: balanced meals, regular activity, more vegetables and fibre, and realistic goals. See the Health page's Obesity tab for the fuller guide."] },
  { id: "heart", patterns: ["heart health", "cholesterol", "heart disease", "cardiovascular"],
    responses: ["Heart health centres on blood pressure, cholesterol and weight - regular activity, a heart-healthy diet, not smoking, and knowing your numbers all help. See the Health page's Heart health tab for more."] },

  // ---------- General blood-donation knowledge ----------
  { id: "eligibility", patterns: ["who can donate", "can i donate blood", "am i eligible", "eligibility", "requirements to donate", "age to donate", "weight to donate"],
    responses: ["General guidelines (always confirmed by screening on the day): most healthy adults aged 18-65 who weigh enough and feel well can donate. Certain illnesses, medications, recent tattoos/piercings, pregnancy or recent donation can mean waiting - the screening on the Donate page and hospital staff make the final call."] },
  { id: "blood-types", patterns: ["blood type", "blood group compatibility", "universal donor", "universal recipient", "which blood type", "o negative", "ab positive"],
    responses: ["O- is the universal red-cell donor (can give to any blood group), and AB+ is the universal recipient (can receive from any group). Otherwise A can give to A/AB, B can give to B/AB, and each group is safest matched to itself or a compatible group - hospitals always confirm compatibility before a transfusion."] },
  { id: "donation-pain", patterns: ["does it hurt", "is donating blood painful", "side effects of donating", "is it safe to donate"],
    responses: ["Most people feel a brief pinch when the needle goes in and little else. Afterwards some feel light-headed briefly - that's why the Donate page has a session timer and why resting with a snack and water afterwards is recommended. Donating whole blood is generally safe for healthy, eligible donors."] },
  { id: "before-donating", patterns: ["before donating", "how to prepare to donate", "what to eat before donating"],
    responses: ["Before donating: eat a good meal, drink plenty of water, and get a normal night's sleep. Avoid donating on an empty stomach."] },
  { id: "after-donating", patterns: ["after donating", "recovery after donating", "what to do after giving blood"],
    responses: ["After donating: rest for a few minutes, drink extra fluids, avoid heavy lifting or intense exercise for the rest of the day, and eat iron-rich foods over the following days."] },
  { id: "why-donate", patterns: ["why donate blood", "benefits of donating", "why should i give blood"],
    responses: ["One donation can help up to three patients, blood can't be manufactured (only donors provide it), and Rwanda's blood service - including drone delivery to remote hospitals - depends entirely on volunteer donors."] },

  // ---------- Conversational ----------
  { id: "greeting", patterns: ["hello", "hi", "hey", "good morning", "good afternoon", "muraho", "bonjour", "salut"],
    responses: ["Hello! I can help with donating, requesting blood, subscriptions, pharmacies, medicines, verification, health topics, or emergencies. What do you need?"] },
  { id: "thanks", patterns: ["thank you", "thanks", "murakoze", "merci"],
    responses: ["You're welcome - stay safe!"] },
  { id: "bye", patterns: ["bye", "goodbye", "see you", "au revoir"],
    responses: ["Goodbye! Come back any time you have a question."] },
  { id: "who-are-you", patterns: ["who are you", "what can you do", "what is this", "help me"],
    responses: ["I'm the built-in quick-help assistant for the Rwanda Blood Donation Centre site - ask me about donating, requesting blood, hospital/pharmacy accounts, subscriptions and payment, drone delivery, verification, medicines, the map, settings, health topics, or emergencies."] },
  { id: "how-are-you", patterns: ["how are you", "how's it going"],
    responses: ["Doing well, thanks for asking! What can I help you with on the site?"] }
];

/* Score every intent against the message and return the best match's
   response, or a helpful fallback if nothing scores highly enough. */
function getBotResponse(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "Go ahead and ask me something - about donating, requesting blood, subscriptions, pharmacies, medicines, verification, health topics or emergencies.";

  let best = null, bestScore = 0;
  for (const intent of BOT_INTENTS) {
    let score = 0;
    for (const pattern of intent.patterns) {
      if (t.indexOf(pattern) >= 0) score += pattern.split(" ").length; // longer/more specific phrases count more
    }
    if (score > bestScore) { bestScore = score; best = intent; }
  }

  if (best && bestScore > 0) {
    const options = best.responses;
    return options[Math.floor(Math.random() * options.length)];
  }

  return "I'm a simple built-in helper, so I'm not sure about that one. Try asking about donating, requesting blood, subscriptions, hospitals, pharmacies, medicines, verification, health topics (diabetes, hypertension, asthma, anemia, obesity, heart health), the map, settings, or emergencies.";
}
