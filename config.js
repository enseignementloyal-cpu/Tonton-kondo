// ============================================================
// config.js — Configuration Tonton Kondo
// ============================================================

const CONFIG = {

  // ── SERVEUR BACKEND ────────────────────────────────────────
  SERVER_URL: "https://tonton-kondo-lry5.onrender.com",
// À remplacer par votre URL

  // ── API FOOTBALL ───────────────────────────────────────────
  FOOTBALL_API_KEY: "369f772ca235e44f4d4b743c2df1cac8",

  // ── ADMIN ──────────────────────────────────────────────────
  ADMIN_PASSWORD: "admin",
  SECRET_STAFF_CODE: "TONTONKONDO12",

  // ── SESSIONS ───────────────────────────────────────────────
  SESSION_DURATION_DAYS: 7,

  // ── JACKPOT ────────────────────────────────────────────────
  JACKPOT_PERCENT: 5,

  // ── API PAIEMENT PLOP PLOP (PAY'M) ─────────────────────────
  MERCHANT_CLIENT_ID: "pp_79b43f97718b545fa525c8b450cf",
  MERCHANT_SECRET_KEY: "9990d0b7f4a8f2934f85b75231f3fa208e40312fee6f92fb461ba4443005086e",
  PLOPPLOP_BASE_URL: "https://plopplop.solutionip.app"

};

if (typeof module !== 'undefined') module.exports = CONFIG;