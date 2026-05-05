// ============================================================
// config.js — Configuration Tonton Kondo
// Mettez l'adresse de votre serveur ici
// ============================================================

const CONFIG = {

  // ── SERVEUR BACKEND ────────────────────────────────────────
  // Adresse de votre serveur Node.js déployé sur Render.com
  // Exemple: "https://tonton-kondo-api.onrender.com"
  SERVER_URL: "https://tonton-kondo-lry5.onrender.com",

  // ── API FOOTBALL ───────────────────────────────────────────
  // football-data.org - votre clé API
  FOOTBALL_API_KEY: "369f772ca235e44f4d4b743c2df1cac8",

  // ── ADMIN ──────────────────────────────────────────────────
  ADMIN_PASSWORD: "admin",       // Mot de passe admin
  SECRET_STAFF_CODE: "TONTONKONDO12",  // Code secret page d'accueil

  // ── SESSIONS ───────────────────────────────────────────────
  SESSION_DURATION_DAYS: 7,

  // ── JACKPOT ────────────────────────────────────────────────
  JACKPOT_PERCENT: 5,  // 5% de chaque mise va au jackpot

  // ── API PAIEMENT PLOP PLOP (PAY'M) ─────────────────────────
  MERCHANT_CLIENT_ID: "pp_79b43f97718b545fa525c8b450cf",
  MERCHANT_SECRET_KEY: "9990d0b7f4a8f2934f85b75231f3fa208e40312fee6f92fb461ba4443005086e",
  PLOPPLOP_BASE_URL: "https://plopplop.solutionip.app"

};

// NE PAS MODIFIER EN DESSOUS
if (typeof module !== 'undefined') module.exports = CONFIG;