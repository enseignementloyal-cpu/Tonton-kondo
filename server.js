// ============================================================
// server.js — J.A PARYAJ LOTTO Paryaj Backend
// Node.js + Express + PostgreSQL (Neon)
// Version complète avec tous les endpoints pour app.html
// ============================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path = require('path');

// Fichier de configuration optionnel (si vous utilisez des variables d'environnement via dotenv)
try {
  require('dotenv').config();
} catch(e) {}
let CONFIG = {};
try {
  CONFIG = require('./config.js');
} catch(e) {}

// ── CONFIG PAIEMENT PLOP PLOP ─────────────────────────────────
const MERCHANT_CLIENT_ID = process.env.MERCHANT_CLIENT_ID || CONFIG.MERCHANT_CLIENT_ID;
const MERCHANT_SECRET_KEY = process.env.MERCHANT_SECRET_KEY || CONFIG.MERCHANT_SECRET_KEY;
const PLOPPLOP_BASE = process.env.PLOPPLOP_BASE_URL || CONFIG.PLOPPLOP_BASE_URL;

const app = express();
const PORT = process.env.PORT || 3000;

// Attraper toutes les erreurs non gérées pour éviter crash silencieux
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// ── CORS & MIDDLEWARES ──────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));  // sert les fichiers statiques (HTML, CSS, JS)

// ── DATABASE ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── CONFIG ─────────────────────────────────────────────────
const ADMIN_PASSWORD    = process.env.ADMIN_PASSWORD    || 'admin';
const FOOTBALL_API_KEY  = process.env.FOOTBALL_API_KEY  || '';
const APISPORTS_KEY     = process.env.APISPORTS_KEY     || ''; // api-sports.io (basketball + tennis)

// Cache pour basketball et tennis
let basketballCache = { data: [], updatedAt: 0 };
let tennisCache     = { data: [], updatedAt: 0 };
const SPORTS_CACHE_TTL = 5 * 60 * 1000; // 5 min
const JACKPOT_PCT       = 5; // 5%

// ── TABLE INIT (création automatique des tables) ───────────
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      user_code TEXT,
      user_phone TEXT,
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
    );
    CREATE TABLE IF NOT EXISTS directors (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zone TEXT,
      phone TEXT,
      pwd_hash TEXT NOT NULL,
      pct REAL DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cashiers (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dir_code TEXT REFERENCES directors(code),
      phone TEXT,
      pwd_hash TEXT NOT NULL,
      jeu TEXT DEFAULT 'all',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      pwd_hash TEXT NOT NULL,
      solde REAL DEFAULT 0,
      dir_code TEXT REFERENCES directors(code),
      caiss_code TEXT REFERENCES cashiers(code),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      player_phone TEXT REFERENCES players(phone),
      dir_code TEXT REFERENCES directors(code),
      caiss_code TEXT REFERENCES cashiers(code),
      type TEXT NOT NULL,
      game_type TEXT,
      sub_type TEXT,
      selection TEXT,
      numeros_joues TEXT,
      mise REAL,
      cote REAL,
      gain_potentiel REAL,
      draw TEXT,
      match_id TEXT,
      match_name TEXT,
      match_info JSONB,
      statut TEXT DEFAULT 'en_attente',
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );
    -- Ajouter colonnes manquantes si table déjà existante
    DO $$ BEGIN
      BEGIN ALTER TABLE bets ADD COLUMN game_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bets ADD COLUMN numeros_joues TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bets ADD COLUMN match_info JSONB; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bets ADD COLUMN draw TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bets ADD COLUMN sub_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bets ADD COLUMN selection TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$;

    -- Tirages Keno publiés par l'admin
    CREATE TABLE IF NOT EXISTS keno_tirages (
      id SERIAL PRIMARY KEY,
      dir_code TEXT,
      numeros INT[] NOT NULL,
      statut TEXT DEFAULT 'ouvert',   -- ouvert | ferme | publie
      created_at TIMESTAMP DEFAULT NOW(),
      publie_at TIMESTAMP
    );

    -- Tirages Lucky 6 publiés par l'admin
    CREATE TABLE IF NOT EXISTS lucky6_tirages (
      id SERIAL PRIMARY KEY,
      dir_code TEXT,
      numeros INT[] NOT NULL,
      statut TEXT DEFAULT 'ouvert',
      created_at TIMESTAMP DEFAULT NOW(),
      publie_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      player_phone TEXT REFERENCES players(phone),
      dir_code TEXT REFERENCES directors(code),
      caiss_code TEXT REFERENCES cashiers(code),
      type TEXT,
      montant REAL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS recharges (
      id SERIAL PRIMARY KEY,
      player_phone TEXT REFERENCES players(phone),
      dir_code TEXT REFERENCES directors(code),
      caiss_code TEXT REFERENCES cashiers(code),
      montant REAL,
      methode TEXT,
      reference_id TEXT,
      transaction_id TEXT,
      statut TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS borlette_results (
      id SERIAL PRIMARY KEY,
      draw TEXT NOT NULL,
      lotto3 TEXT,
      lot1 TEXT,
      lot2 TEXT,
      lot3 TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS borlette_blocked (
      id SERIAL PRIMARY KEY,
      number TEXT NOT NULL,
      draw TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(number, draw)
    );
    CREATE TABLE IF NOT EXISTS borlette_limits (
      id SERIAL PRIMARY KEY,
      number TEXT NOT NULL,
      draw TEXT DEFAULT '',
      max_amount REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(number, draw)
    );
    CREATE TABLE IF NOT EXISTS jackpots (
      dir_code TEXT PRIMARY KEY REFERENCES directors(code),
      amount REAL DEFAULT 0,
      week_sales REAL DEFAULT 0,
      last_reset TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS jackpot_history (
      id SERIAL PRIMARY KEY,
      dir_code TEXT REFERENCES directors(code),
      amount REAL,
      winner_phone TEXT,
      winner_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS game_difficulty (
      id SERIAL PRIMARY KEY,
      dir_code TEXT,
      game_name TEXT NOT NULL,
      win_probability INTEGER DEFAULT 45
    );
    -- Index unique compatible toutes versions PostgreSQL
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_difficulty_unique
      ON game_difficulty (COALESCE(dir_code, ''), game_name);
  `);
  console.log('✅ Tables vérifiées/créées');
  // Nettoyage sessions expirées au démarrage
  await pool.query("DELETE FROM sessions WHERE expires_at < NOW()").catch(()=>{});
  // Nettoyage automatique toutes les 6 heures
  setInterval(() => {
    pool.query("DELETE FROM sessions WHERE expires_at < NOW()").catch(()=>{});
  }, 6 * 60 * 60 * 1000);
})();

// ── HELPERS ────────────────────────────────────────────────
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getSession(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const r = await pool.query("SELECT * FROM sessions WHERE id=$1 AND expires_at > NOW()", [token]);
  if (!r.rows.length) return null;
  // Renouveler automatiquement la session
  pool.query("UPDATE sessions SET expires_at=NOW() + INTERVAL '30 days' WHERE id=$1", [token]).catch(()=>{});
  return r.rows[0];
}

async function requireAuth(req, res, next) {
  const sess = await getSession(req);
  if (!sess) return res.status(401).json({ error: 'Non autorisé — connectez-vous' });
  req.session = sess;
  next();
}

async function requireAdmin(req, res, next) {
  const sess = await getSession(req);
  if (!sess || sess.role !== 'admin')
    return res.status(403).json({ error: 'Accès administrateur requis' });
  req.session = sess;
  next();
}

async function requireDirector(req, res, next) {
  const sess = await getSession(req);
  if (!sess || (sess.role !== 'admin' && sess.role !== 'directeur'))
    return res.status(403).json({ error: 'Accès directeur requis' });
  req.session = sess;
  next();
}

// Récupérer la probabilité de gain pour un jeu et un directeur
async function getWinProbability(dirCode, gameName) {
  // 1. Chercher spécifique au directeur
  if (dirCode) {
    const r = await pool.query(
      "SELECT win_probability FROM game_difficulty WHERE dir_code=$1 AND game_name=$2",
      [dirCode, gameName]
    );
    if (r.rows.length) return r.rows[0].win_probability;
  }
  // 2. Chercher la valeur globale dans game_difficulty (dir_code IS NULL)
  const rGlobal = await pool.query(
    "SELECT win_probability FROM game_difficulty WHERE dir_code IS NULL AND game_name=$1",
    [gameName]
  );
  if (rGlobal.rows.length) return rGlobal.rows[0].win_probability;
  // 3. Fallback settings table
  const def = await pool.query("SELECT value FROM settings WHERE key=$1", [`${gameName}_default_diff`]);
  if (def.rows.length) return parseInt(def.rows[0].value) || 45;
  return 45; // défaut absolu
}

function isWin(probability) {
  const rand = Math.random() * 100;
  return rand <= probability;
}

// Table de gains Keno selon le nombre de boules trouvées (hits)
// Le multiplicateur varie dans une fourchette selon la difficulté (difficulte: 0=facile, 100=difficile)
// Plus le jeu est "difficile", plus le multiplicateur tend vers le bas de la fourchette
function getKenoMultiplier(hits, selectedCount, difficulte) {
  if (hits < 5) return 0; // Sous 5 numéros trouvés: aucun gain
  // Fourchettes [min, max] de multiplicateur par nombre de hits
  const ranges = {
    5:  [1.5, 1.5],
    6:  [3,   34],
    7:  [4,   6],
    8:  [10,  15],
    9:  [16,  30],
    10: [16,  30],
  };
  const range = ranges[Math.min(hits,10)];
  if (!range) return 0;
  const [min, max] = range;
  if (min === max) return min;
  // difficulte 0 (facile) → proche du max ; difficulte 100 (difficile) → proche du min
  const d = (difficulte === undefined || difficulte === null) ? 50 : difficulte;
  const factor = 1 - (d / 100); // 1 = facile, 0 = difficile
  const mult = min + (max - min) * factor;
  return Math.round(mult * 100) / 100;
}

// Fonction générique pour les appels PlopPlop entrants (dépôts)

// Lit les credentials PlopPlop depuis la DB (settings) en priorité sur les env vars
async function getPlopConfig() {
  try {
    const r = await pool.query("SELECT key, value FROM settings WHERE key IN ('plopplop_client_id','plopplop_secret_key','plopplop_base_url')");
    const db = {};
    r.rows.forEach(row => { db[row.key] = row.value; });
    return {
      clientId:  db['plopplop_client_id']  || MERCHANT_CLIENT_ID  || '',
      secretKey: db['plopplop_secret_key'] || MERCHANT_SECRET_KEY || '',
      baseUrl:   db['plopplop_base_url']   || PLOPPLOP_BASE       || 'https://plopplop.solutionip.app',
    };
  } catch(e) {
    return {
      clientId:  MERCHANT_CLIENT_ID  || '',
      secretKey: MERCHANT_SECRET_KEY || '',
      baseUrl:   PLOPPLOP_BASE       || 'https://plopplop.solutionip.app',
    };
  }
}

async function callPlopPlop(endpoint, body) {
  const cfg = await getPlopConfig();
  const auth = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString('base64');
  const response = await fetch(`${cfg.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

// Fonction retrait PlopPlop - flux 3 étapes obligatoires
async function executerRetraitPlopPlop(montant, methode, recipient, reference) {
  const cfg = await getPlopConfig();
  const BASE = cfg.baseUrl;
  const MERCHANT_CLIENT_ID = cfg.clientId;
  const MERCHANT_SECRET_KEY = cfg.secretKey;

  // ── Vérification des credentials ────────────────────────
  if (!MERCHANT_CLIENT_ID || !MERCHANT_SECRET_KEY) {
    throw new Error("Jeton d'authentification manquant (MERCHANT_CLIENT_ID ou MERCHANT_SECRET_KEY non configure dans les variables Render)");
  }

  console.log(`[PlopPlop] Retrait ${montant} ${methode} → ${recipient} | BASE=${BASE} | client_id=${MERCHANT_CLIENT_ID?.slice(0,8)}...`);

  // Étape 1: Authentification → AUTH_TOKEN
  const authResp = await fetch(`${BASE}/api/auth/marchand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: MERCHANT_CLIENT_ID, client_secret: MERCHANT_SECRET_KEY })
  });
  const authRaw = await authResp.text();
  let authData;
  try { authData = JSON.parse(authRaw); } catch(e) { throw new Error(`PlopPlop auth réponse invalide (${authResp.status}): ${authRaw.slice(0,200)}`); }
  console.log('[PlopPlop] Étape 1 auth:', authResp.status, JSON.stringify(authData));
  const authToken = authData.token || authData.access_token || authData.auth_token || authData.jwt;
  if (!authToken) throw new Error(`PlopPlop auth échoué (${authResp.status}): ${authData.message || authData.error || JSON.stringify(authData)}`);

  // Étape 2: Générer withdrawal-token avec signature HMAC-SHA256 (obligatoire v1.3)
  const timestamp = Math.floor(Date.now() / 1000);
  const sigPayload = `${montant}|${methode}|${recipient}|${reference}|${timestamp}`;
  const withdrawalSignature = crypto.createHmac('sha256', MERCHANT_SECRET_KEY)
    .update(sigPayload)
    .digest('hex');

  const wtBody = { amount: montant, method: methode, recipient, reference, timestamp, withdrawal_signature: withdrawalSignature };
  console.log('[PlopPlop] Étape 2 body:', JSON.stringify(wtBody));
  // NOTE: PlopPlop étape 2 utilise X-Access-Token (pas Authorization: Bearer)
  const wtResp = await fetch(`${BASE}/api/auth/marchand/withdrawal-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': authToken },
    body: JSON.stringify(wtBody)
  });
  const wtRaw = await wtResp.text();
  let wtData;
  try { wtData = JSON.parse(wtRaw); } catch(e) { throw new Error(`PlopPlop withdrawal-token réponse invalide (${wtResp.status}): ${wtRaw.slice(0,200)}`); }
  console.log('[PlopPlop] Étape 2 withdrawal-token:', wtResp.status, JSON.stringify(wtData));
  const withdrawalToken = wtData.withdrawal_token || wtData.token || wtData.access_token || wtData.jwt;
  if (!withdrawalToken) throw new Error(`PlopPlop withdrawal-token échoué (${wtResp.status}): ${wtData.message || wtData.error || JSON.stringify(wtData)}`);

  // Étape 3: Exécuter le retrait avec X-Access-Token (withdrawal_token)
  const wBody = { amount: montant, method: methode, recipient, reference };
  console.log('[PlopPlop] Étape 3 body:', JSON.stringify(wBody));
  const wResp = await fetch(`${BASE}/api/withdraw/marchand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': withdrawalToken },
    body: JSON.stringify(wBody)
  });
  const wRaw = await wResp.text();
  let wData;
  try { wData = JSON.parse(wRaw); } catch(e) { throw new Error(`PlopPlop withdraw réponse invalide (${wResp.status}): ${wRaw.slice(0,200)}`); }
  console.log('[PlopPlop] Étape 3 résultat:', wResp.status, JSON.stringify(wData));
  if (!wResp.ok || wData.success === false) {
    const code = wData.error_code;
    if (code === 'WITHDRAWAL_COOLDOWN') throw new Error(`Cooldown: attendez ${wData.remaining_seconds||60}s avant un autre retrait`);
    if (code === 'TOKEN_ALREADY_USED') throw new Error('Token déjà utilisé, réessayez');
    if (code === 'PARAMETER_MISMATCH') throw new Error('Erreur paramètres PlopPlop');
    throw new Error(wData.message || 'Retrait PlopPlop échoué');
  }
  return wData;
}

// ============================================================
// ROUTES API (toutes commençant par /api)
// ============================================================

// ── SANTÉ ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      plopplop: {
        base: PLOPPLOP_BASE || 'https://plopplop.solutionip.app (défaut)',
        client_id: MERCHANT_CLIENT_ID ? `${MERCHANT_CLIENT_ID.slice(0,8)}... (✅ configuré)` : '❌ MANQUANT',
        secret: MERCHANT_SECRET_KEY ? `${MERCHANT_SECRET_KEY.slice(0,4)}... (✅ configuré)` : '❌ MANQUANT',
      }
    });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ── AUTHENTIFICATION ──────────────────────────────────────

// ── DIAGNOSTIC CAISSIER (à supprimer après résolution) ──
app.get('/api/diag/cashier/:code', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT code, name, dir_code, jeu, active, created_at, (pwd_hash IS NOT NULL AND LENGTH(pwd_hash)>0) AS has_hash, LENGTH(pwd_hash) AS hash_len FROM cashiers WHERE code=$1",
      [req.params.code.toUpperCase()]
    );
    if(!r.rows.length) return res.json({ found: false, code: req.params.code.toUpperCase() });
    res.json({ found: true, ...r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Test connexion caissier direct
app.post('/api/diag/cashier-login', async (req, res) => {
  try {
    const { code, pwd } = req.body;
    const r = await pool.query("SELECT code,name,active,LENGTH(pwd_hash) AS hl,pwd_hash FROM cashiers WHERE code=$1",[String(code).toUpperCase()]);
    if(!r.rows.length) return res.json({ step:'lookup', found:false });
    const row = r.rows[0];
    const ok  = await bcrypt.compare(String(pwd), row.pwd_hash);
    res.json({ step:'compare', found:true, active:row.active, hash_len:row.hl, compare_ok:ok, name:row.name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/admin', async (req, res) => {
  try {
    const { pwd } = req.body;
    if (pwd !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query("INSERT INTO sessions (id, role, expires_at) VALUES ($1, 'admin', NOW() + INTERVAL '30 days')", [token]);
    res.json({ token, role: 'admin', name: 'Administrateur' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/director', async (req, res) => {
  try {
    const { code, pwd } = req.body;
    const r = await pool.query("SELECT * FROM directors WHERE code=$1 AND active=TRUE", [code.toUpperCase()]);
    const dir = r.rows[0];
    if (!dir) return res.status(401).json({ error: 'Code introuvable' });
    const ok = await bcrypt.compare(pwd, dir.pwd_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query("INSERT INTO sessions (id, role, user_code, expires_at) VALUES ($1, 'directeur', $2, NOW() + INTERVAL '30 days')", [token, dir.code]);
    res.json({ token, role: 'directeur', code: dir.code, name: dir.name, zone: dir.zone, pct: dir.pct });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/player', async (req, res) => {
  try {
    const { phone, pwd } = req.body;
    const r = await pool.query("SELECT * FROM players WHERE phone=$1 AND active=TRUE", [phone]);
    const player = r.rows[0];
    if (!player) return res.status(401).json({ error: 'Numéro introuvable' });
    const ok = await bcrypt.compare(pwd, player.pwd_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query("INSERT INTO sessions (id, role, user_phone, expires_at) VALUES ($1, 'joueur', $2, NOW() + INTERVAL '30 days')", [token, player.phone]);
    res.json({ token, role: 'joueur', phone: player.phone, name: player.name, solde: parseFloat(player.solde), dirCode: player.dir_code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, pwd, dirCode, caissCode } = req.body;
    if (!name || !phone || !pwd) return res.status(400).json({ error: 'Champs obligatoires manquants' });
    const exists = await pool.query("SELECT id FROM players WHERE phone=$1", [phone]);
    if (exists.rows.length) return res.status(409).json({ error: 'Numéro déjà utilisé' });
    const hash = await bcrypt.hash(pwd, 10);
    const r = await pool.query(
      "INSERT INTO players (name, phone, pwd_hash, dir_code, caiss_code) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,phone,solde",
      [name, phone, hash, dirCode||null, caissCode||null]
    );
    res.json({ success: true, player: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) await pool.query("DELETE FROM sessions WHERE id=$1", [token]);
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const sess = await getSession(req);
    if (!sess) return res.status(401).json({ error: 'Session expirée' });
    if (sess.role === 'joueur') {
      const r = await pool.query("SELECT name,phone,solde,dir_code FROM players WHERE phone=$1", [sess.user_phone]);
      return res.json({ ...sess, ...r.rows[0] });
    }
    if (sess.role === 'directeur') {
      const r = await pool.query("SELECT name,code,zone,pct FROM directors WHERE code=$1", [sess.user_code]);
      return res.json({ ...sess, ...r.rows[0] });
    }
    if (sess.role === 'caissier') {
      const r = await pool.query("SELECT name,code,dir_code,jeu FROM cashiers WHERE code=$1", [sess.user_code]);
      return res.json({ ...sess, ...r.rows[0] });
    }
    res.json(sess);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── FOOTBALL / MATCHS ─────────────────────────────────────
let matchCache = { data: [], updatedAt: 0 };
const CACHE_TTL = 90 * 1000;
// Tous les championnats disponibles sur football-data.org
const COMPETITIONS = ['PL','PD','BL1','SA','FL1','CL','ELC','PPL','DED','BSA','WC','EC','CLI'];
const COMP_LABELS = {
  PL:  '🏴 Premier League',
  PD:  '🇪🇸 La Liga',
  BL1: '🇩🇪 Bundesliga',
  SA:  '🇮🇹 Serie A',
  FL1: '🇫🇷 Ligue 1',
  CL:  '🏆 Champions League',
  ELC: '🏴 Championship',
  PPL: '🇵🇹 Primeira Liga',
  DED: '🇳🇱 Eredivisie',
  BSA: '🇧🇷 Brasileirão',
  WC:  '🌍 Coupe du Monde',
  EC:  '🇪🇺 Euro',
  CLI: '🌎 Copa Libertadores',
};

// Calculer des cotes réalistes basées sur le nom des équipes
function calculateOdds(homeTeam, awayTeam, compCode) {
  // Équipes considérées "fortes" par compétition
  const STRONG = {
    PL:  ['Man City','Arsenal','Liverpool','Chelsea','Man Utd','Spurs','Newcastle'],
    PD:  ['Real Madrid','Barcelona','Atletico','Athletic','Real Sociedad','Villarreal'],
    BL1: ['Bayern','Dortmund','Leipzig','Leverkusen','Frankfurt','Union Berlin'],
    SA:  ['Napoli','Inter','Milan','Juventus','Roma','Lazio','Atalanta'],
    FL1: ['PSG','Marseille','Monaco','Lyon','Lens','Rennes'],
    CL:  ['Man City','Real Madrid','Bayern','PSG','Arsenal','Barcelona','Inter'],
  };
  const strong = STRONG[compCode] || [];
  const homeIsStrong = strong.some(s => homeTeam.includes(s) || s.includes(homeTeam));
  const awayIsStrong = strong.some(s => awayTeam.includes(s) || s.includes(awayTeam));

  let h, d, a;
  if (homeIsStrong && !awayIsStrong) {
    h = +(1.35 + Math.random()*0.30).toFixed(2);
    d = +(3.80 + Math.random()*0.60).toFixed(2);
    a = +(5.50 + Math.random()*2.00).toFixed(2);
  } else if (!homeIsStrong && awayIsStrong) {
    h = +(4.50 + Math.random()*2.00).toFixed(2);
    d = +(3.60 + Math.random()*0.60).toFixed(2);
    a = +(1.45 + Math.random()*0.35).toFixed(2);
  } else if (homeIsStrong && awayIsStrong) {
    h = +(1.90 + Math.random()*0.50).toFixed(2);
    d = +(3.20 + Math.random()*0.40).toFixed(2);
    a = +(3.00 + Math.random()*0.70).toFixed(2);
  } else {
    // Match équilibré — favoriser légèrement le domicile
    h = +(2.10 + Math.random()*0.70).toFixed(2);
    d = +(3.00 + Math.random()*0.50).toFixed(2);
    a = +(2.80 + Math.random()*0.80).toFixed(2);
  }
  return [h, d, a];
}

function formatMatch(match, compCode) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name || '?';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || '?';
  const status = match.status;
  const isLive = ['IN_PLAY','PAUSED'].includes(status);
  const score = match.score?.fullTime || match.score?.halfTime || {home:null,away:null};
  return {
    id: match.id,
    lk: compCode.toLowerCase(),
    lg: COMP_LABELS[compCode] || compCode,
    t1: home,
    t2: away,
    s1: score.home ?? null,
    s2: score.away ?? null,
    time: isLive ? 'LIVE' : (match.utcDate ? new Date(match.utcDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''),
    live: isLive,
    status: status,
    utcDate: match.utcDate,
    odds: calculateOdds(home, away, compCode),
    mkt: 12
  };
}

app.get('/api/matches', async (req, res) => {
  try {
    const now = Date.now();
    if (now - matchCache.updatedAt < CACHE_TTL && matchCache.data.length) {
      return res.json({ matches: matchCache.data, cached: true });
    }
    const allMatches = [];
    const today = new Date().toISOString().split('T')[0];
    const in7days = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
    for (const comp of COMPETITIONS) {
      try {
        // Matchs en cours et à venir
        const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${today}&dateTo=${in7days}`;
        const r = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
        if (!r.ok) continue;
        const data = await r.json();
        if (data.matches) {
          const formatted = data.matches.map(m => formatMatch(m, comp));
          allMatches.push(...formatted);
        }
      } catch (e) { console.error(`Failed ${comp}:`, e.message); }
    }
    allMatches.sort((a,b) => {
      if (a.live && !b.live) return -1;
      if (!a.live && b.live) return 1;
      return new Date(a.utcDate||0) - new Date(b.utcDate||0);
    });
    matchCache = { data: allMatches, updatedAt: now };
    res.json({ matches: allMatches, count: allMatches.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route pour les matchs d'un championnat spécifique
app.get('/api/matches/:comp', async (req, res) => {
  try {
    const comp = req.params.comp.toUpperCase();
    const today = new Date().toISOString().split('T')[0];
    const in7days = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
    const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${today}&dateTo=${in7days}`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });
    if (!r.ok) return res.status(502).json({ error: 'Compétition indisponible' });
    const data = await r.json();
    const matches = (data.matches||[]).map(m => formatMatch(m, comp));
    res.json({ matches, competition: COMP_LABELS[comp]||comp });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Route pour résultats récents (derniers 7 jours)
app.get('/api/results', async (req, res) => {
  try {
    const allResults = [];
    const ago7 = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    for (const comp of ['PL','PD','BL1','SA','FL1','CL']) {
      try {
        const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${ago7}&dateTo=${today}&status=FINISHED`, {
          headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (data.matches) allResults.push(...data.matches.map(m => formatMatch(m, comp)));
      } catch(e) {}
    }
    allResults.sort((a,b) => new Date(b.utcDate||0) - new Date(a.utcDate||0));
    res.json({ results: allResults });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BASKETBALL (api-sports.io) ─────────────────────────────
app.get('/api/basketball', async (req, res) => {
  try {
    const now = Date.now();
    if (now - basketballCache.updatedAt < SPORTS_CACHE_TTL && basketballCache.data.length) {
      return res.json({ games: basketballCache.data, cached: true });
    }
    if (!APISPORTS_KEY) return res.json({ games: [], error: 'Clé API-Sports non configurée' });

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];
    const r = await fetch(`https://v1.basketball.api-sports.io/games?date=${today}`, {
      headers: { 'x-rapidapi-key': APISPORTS_KEY, 'x-rapidapi-host': 'v1.basketball.api-sports.io' }
    });
    if (!r.ok) return res.status(502).json({ games: [], error: 'API Basketball indisponible' });
    const data = await r.json();
    const games = (data.response || []).map(g => ({
      id: 'bk_'+g.id,
      sport: 'basketball',
      league: g.league?.name || 'Basketball',
      leagueLogo: g.league?.logo || '',
      home: g.teams?.home?.name || '?',
      away: g.teams?.away?.name || '?',
      homeLogo: g.teams?.home?.logo || '',
      awayLogo: g.teams?.away?.logo || '',
      scoreHome: g.scores?.home?.total ?? null,
      scoreAway: g.scores?.away?.total ?? null,
      status: g.status?.short || 'NS',
      date: g.date || today,
      live: ['Q1','Q2','Q3','Q4','OT','HT'].includes(g.status?.short),
    })).filter(g => ['NBA','EuroLeague','Euroleague','FIBA'].some(l => g.league.includes(l)) || true);
    basketballCache = { data: games, updatedAt: now };
    res.json({ games });
  } catch(e) { res.status(500).json({ games: [], error: e.message }); }
});

// ── TENNIS (api-sports.io) ─────────────────────────────────
app.get('/api/tennis', async (req, res) => {
  try {
    const now = Date.now();
    if (now - tennisCache.updatedAt < SPORTS_CACHE_TTL && tennisCache.data.length) {
      return res.json({ games: tennisCache.data, cached: true });
    }
    if (!APISPORTS_KEY) return res.json({ games: [], error: 'Clé API-Sports non configurée' });

    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(`https://v1.tennis.api-sports.io/games?date=${today}`, {
      headers: { 'x-rapidapi-key': APISPORTS_KEY, 'x-rapidapi-host': 'v1.tennis.api-sports.io' }
    });
    if (!r.ok) return res.status(502).json({ games: [], error: 'API Tennis indisponible' });
    const data = await r.json();
    const games = (data.response || []).map(g => ({
      id: 'tn_'+g.id,
      sport: 'tennis',
      league: g.tournament?.name || 'Tennis',
      home: g.players?.home?.name || g.teams?.home?.name || '?',
      away: g.players?.away?.name || g.teams?.away?.name || '?',
      scoreHome: g.scores?.home || null,
      scoreAway: g.scores?.away || null,
      status: g.status?.short || 'NS',
      date: g.date || today,
      live: g.status?.short === 'IN_PLAY',
    }));
    tennisCache = { data: games, updatedAt: now };
    res.json({ games });
  } catch(e) { res.status(500).json({ games: [], error: e.message }); }
});

// ── JOUEUR ────────────────────────────────────────────────
app.get('/api/player/me', requireAuth, async (req, res) => {
  if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueur seulement' });
  const r = await pool.query("SELECT name, phone, solde, dir_code, caiss_code, created_at FROM players WHERE phone=$1", [req.session.user_phone]);
  res.json(r.rows[0]);
});

app.get('/api/player/bets', requireAuth, async (req, res) => {
  const phone = req.session.role === 'joueur' ? req.session.user_phone : req.query.phone;
  const limit = parseInt(req.query.limit) || 50;
  const r = await pool.query("SELECT * FROM bets WHERE player_phone=$1 ORDER BY created_at DESC LIMIT $2", [phone, limit]);
  res.json({ bets: r.rows });
});

app.get('/api/player/transactions', requireAuth, async (req, res) => {
  const phone = req.session.role === 'joueur' ? req.session.user_phone : req.query.phone;
  const r = await pool.query("SELECT * FROM transactions WHERE player_phone=$1 ORDER BY created_at DESC LIMIT 100", [phone]);
  res.json({ transactions: r.rows });
});

app.post('/api/bets/place', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, sub_type, selection, mise, cote, draw, match_id, match_name, player_phone } = req.body;
    if (!type || !selection || !mise) return res.status(400).json({ error: 'Données manquantes' });
    let phone, dir_code, caiss_code;
    if (req.session.role === 'joueur') {
      phone = req.session.user_phone;
    } else if (req.session.role === 'caissier') {
      phone = player_phone;
      const c = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [req.session.user_code]);
      caiss_code = req.session.user_code;
      dir_code = c.rows[0]?.dir_code;
    } else return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    const player = pr.rows[0];
    if (!player) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Joueur introuvable' }); }
    if (parseFloat(player.solde) < parseFloat(mise)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Solde insuffisant' }); }
    if (!dir_code) dir_code = player.dir_code;
    // Vérifications borlette si besoin
    if (type === 'borlette') {
      const num = String(selection).padStart(2,'0');
      const drawKey = draw ? draw.toLowerCase().replace(/\s/g,'') : '';
      const blocked = await client.query("SELECT id FROM borlette_blocked WHERE (number=$1 AND draw='') OR (number=$1 AND draw=$2)", [num, drawKey]);
      if (blocked.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Numéro ${num} bloqué` }); }
      const limits = await client.query("SELECT max_amount FROM borlette_limits WHERE (number=$1 AND draw='') OR (number=$1 AND draw=$2) ORDER BY max_amount ASC LIMIT 1", [num, drawKey]);
      if (limits.rows.length && parseFloat(mise) > parseFloat(limits.rows[0].max_amount)) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Limite: max ${limits.rows[0].max_amount} Gd pour numéro ${num}` }); }
    }
    const gain_potentiel = Math.round(parseFloat(mise) * parseFloat(cote || 1));
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'perte',$4,$5)", [phone, dir_code, caiss_code, -mise, `Mise ${type}: ${selection}`]);
    const betResult = await client.query(
      "INSERT INTO bets (player_phone, dir_code, caiss_code, type, sub_type, selection, mise, cote, gain_potentiel, draw, match_id, match_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [phone, dir_code, caiss_code, type, sub_type||'', selection, mise, cote||1, gain_potentiel, draw||'', match_id||'', match_name||'']
    );
    if (dir_code) {
      await client.query(
        "INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3",
        [dir_code, Math.round(parseFloat(mise) * JACKPOT_PCT / 100), mise]
      );
    }
    await client.query('COMMIT');
    const updated = await pool.query("SELECT solde FROM players WHERE phone=$1", [phone]);
    res.json({ success: true, bet: betResult.rows[0], newSolde: parseFloat(updated.rows[0].solde) });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── RECHARGES ─────────────────────────────────────────────
app.post('/api/recharges/initiate', requireAuth, async (req, res) => {
  try {
    const { montant, methode, player_phone } = req.body;
    if (!montant || montant < 20) return res.status(400).json({ error: 'Montant minimum 20 Gourdes' });
    if (!['moncash','natcash','kashpaw'].includes(methode)) return res.status(400).json({ error: 'Méthode invalide' });
    let phone;
    if (req.session.role === 'joueur') phone = req.session.user_phone;
    else if (req.session.role === 'caissier') phone = player_phone;
    else return res.status(403).json({ error: 'Non autorisé' });
    const player = await pool.query("SELECT phone, name FROM players WHERE phone=$1", [phone]);
    if (!player.rows.length) return res.status(404).json({ error: 'Joueur introuvable' });
    const cfg = await getPlopConfig();
    const reference_id = `TK_${phone}_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const plopData = await callPlopPlop('/api/paiement-marchand', {
      client_id: cfg.clientId,
      refference_id: reference_id,
      montant: montant,
      payment_method: methode
    });
    if (!plopData.status) throw new Error(plopData.message || 'Erreur paiement');
    await pool.query(
      `INSERT INTO recharges (player_phone, montant, methode, reference_id, transaction_id, statut) VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [phone, montant, methode, reference_id, plopData.transaction_id]
    );
    res.json({ success: true, url: plopData.url, reference_id, transaction_id: plopData.transaction_id });
  } catch(e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/recharges/status/:referenceId', requireAuth, async (req, res) => {
  try {
    const { referenceId } = req.params;
    const recharge = await pool.query("SELECT * FROM recharges WHERE reference_id=$1", [referenceId]);
    if (!recharge.rows.length) return res.status(404).json({ error: 'Recharge non trouvée' });
    const r = recharge.rows[0];
    if (req.session.role === 'joueur' && r.player_phone !== req.session.user_phone) return res.status(403).json({ error: 'Non autorisé' });
    if (r.statut === 'completed') return res.json({ status: 'completed', montant: r.montant });
    if (r.statut === 'failed') return res.json({ status: 'failed' });
    const cfg = await getPlopConfig();
    const verifyData = await callPlopPlop('/api/paiement-verify', { client_id: cfg.clientId, refference_id: referenceId });
    if (verifyData.trans_status === 'ok') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [r.montant, r.player_phone]);
        await client.query("UPDATE recharges SET statut='completed', updated_at=NOW() WHERE id=$1", [r.id]);
        await client.query("INSERT INTO transactions (player_phone, type, montant, note) VALUES ($1, 'depot', $2, $3)", [r.player_phone, r.montant, `Recharge ${r.methode} via Plop Plop`]);
        await client.query('COMMIT');
        res.json({ status: 'completed', montant: r.montant });
      } catch(err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    } else res.json({ status: 'pending' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recharges', requireAuth, async (req, res) => {
  try {
    let query = `SELECT r.*, p.name AS player_name FROM recharges r LEFT JOIN players p ON r.player_phone = p.phone`;
    let params = [];
    if (req.session.role === 'caissier') { query += ` WHERE r.caiss_code = $1 OR r.caiss_code IS NULL`; params.push(req.session.user_code); }
    else if (req.session.role === 'directeur') { query += ` WHERE r.dir_code = $1`; params.push(req.session.user_code); }
    query += ` ORDER BY r.created_at DESC LIMIT 200`;
    const r = await pool.query(query, params);
    res.json({ recharges: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/recharges/:id/validate', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM recharges WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Recharge introuvable' }); }
    const rch = r.rows[0];
    await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [rch.montant, rch.player_phone]);
    await client.query("UPDATE recharges SET statut='completed', updated_at=NOW() WHERE id=$1", [id]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'depot',$4,$5)", [rch.player_phone, rch.dir_code, rch.caiss_code, rch.montant, `Recharge ${rch.methode} validée`]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/recharges/:id/reject', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM recharges WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Recharge introuvable' }); }
    await client.query("UPDATE recharges SET statut='rejected', updated_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── BORLETTE ──────────────────────────────────────────────
app.get('/api/borlette/results', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const draw = req.query.draw;
  let query = "SELECT * FROM borlette_results";
  let params = [];
  if (draw) { query += " WHERE draw=$1"; params.push(draw); }
  query += " ORDER BY created_at DESC LIMIT $" + (params.length+1);
  params.push(limit);
  const r = await pool.query(query, params);
  res.json({ results: r.rows });
});

app.post('/api/borlette/publish', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { draw, lotto3, lot2, lot3 } = req.body;
    if (!draw || !lotto3 || lotto3.length !== 3) return res.status(400).json({ error: 'Données invalides' });
    const lot1 = lotto3.slice(-2);
    await client.query('BEGIN');
    const r = await client.query("INSERT INTO borlette_results (draw, lotto3, lot1, lot2, lot3) VALUES ($1,$2,$3,$4,$5) RETURNING *", [draw, lotto3, lot1, lot2||'', lot3||'']);
    const pending = await client.query("SELECT * FROM bets WHERE type='borlette' AND statut='en_attente' AND (draw='' OR draw=$1)", [draw]);
    for (const bet of pending.rows) {
      const sel = String(bet.selection);
      let won = false;
      if (bet.sub_type === 'borlette' && sel === lot1) won = true;
      if (bet.sub_type === 'lotto3'   && sel === lotto3) won = true;
      if (bet.sub_type === 'lotto2'   && sel === lot2) won = true;
      if (bet.sub_type === 'lotto3b'  && sel === lot3) won = true;
      if (won) {
        await client.query("UPDATE bets SET statut='gagne', resolved_at=NOW() WHERE id=$1", [bet.id]);
        const gain = Math.round(parseFloat(bet.mise) * parseFloat(bet.cote));
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, bet.player_phone]);
        await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,$4)", [bet.player_phone, bet.dir_code, gain, `Gain Borlette ${draw} ${sel}`]);
      } else {
        await client.query("UPDATE bets SET statut='perdu', resolved_at=NOW() WHERE id=$1", [bet.id]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, result: r.rows[0], resolved: pending.rows.length });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── JACKPOT ───────────────────────────────────────────────
app.get('/api/jackpots', requireAuth, async (req, res) => {
  const r = await pool.query("SELECT j.*, d.name AS dir_name, d.zone FROM jackpots j JOIN directors d ON j.dir_code=d.code ORDER BY j.amount DESC");
  res.json({ jackpots: r.rows });
});

app.get('/api/jackpots/:dirCode', async (req, res) => {
  const r = await pool.query("SELECT j.amount, d.name AS dir_name FROM jackpots j JOIN directors d ON j.dir_code=d.code WHERE j.dir_code=$1", [req.params.dirCode]);
  res.json(r.rows[0] || { amount: 0 });
});

app.post('/api/jackpots/award', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { dir_code, player_phone } = req.body;
    await client.query('BEGIN');
    const jk = await client.query("SELECT amount FROM jackpots WHERE dir_code=$1 FOR UPDATE", [dir_code]);
    if (!jk.rows.length || parseFloat(jk.rows[0].amount) <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Jackpot vide' }); }
    const amount = parseFloat(jk.rows[0].amount);
    let phone = player_phone;
    let winnerName = '';
    if (!phone) {
      const players = await client.query("SELECT phone, name FROM players WHERE dir_code=$1 AND active=TRUE", [dir_code]);
      if (!players.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Aucun joueur' }); }
      const winner = players.rows[Math.floor(Math.random() * players.rows.length)];
      phone = winner.phone;
      winnerName = winner.name;
    } else {
      const wr = await client.query("SELECT name FROM players WHERE phone=$1", [phone]);
      winnerName = wr.rows[0]?.name || '';
    }
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [amount, phone]);
    await client.query("UPDATE jackpots SET amount=0, week_sales=0, last_reset=NOW(), updated_at=NOW() WHERE dir_code=$1", [dir_code]);
    await client.query("INSERT INTO jackpot_history (dir_code, amount, winner_phone, winner_name) VALUES ($1,$2,$3,$4)", [dir_code, amount, phone, winnerName]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,'🎰 JACKPOT GAGNÉ')", [phone, dir_code, amount]);
    await client.query('COMMIT');
    res.json({ success: true, amount, winner: winnerName, phone });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── ADMIN ─────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [players, directors, cashiers, bets, trans, recharges] = await Promise.all([
    pool.query("SELECT COUNT(*) as cnt, SUM(solde) as total_solde FROM players WHERE active=TRUE"),
    pool.query("SELECT COUNT(*) as cnt FROM directors WHERE active=TRUE"),
    pool.query("SELECT COUNT(*) as cnt FROM cashiers WHERE active=TRUE"),
    pool.query("SELECT COUNT(*) as cnt, SUM(mise) as total_mise FROM bets"),
    pool.query("SELECT SUM(CASE WHEN montant>0 THEN montant ELSE 0 END) as entrees, SUM(CASE WHEN montant<0 THEN ABS(montant) ELSE 0 END) as sorties FROM transactions"),
    pool.query("SELECT COUNT(*) as cnt FROM recharges WHERE statut='pending'"),
  ]);
  res.json({
    players: parseInt(players.rows[0].cnt),
    totalSolde: parseFloat(players.rows[0].total_solde)||0,
    directors: parseInt(directors.rows[0].cnt),
    cashiers: parseInt(cashiers.rows[0].cnt),
    totalBets: parseInt(bets.rows[0].cnt),
    totalMise: parseFloat(bets.rows[0].total_mise)||0,
    entrees: parseFloat(trans.rows[0].entrees)||0,
    sorties: parseFloat(trans.rows[0].sorties)||0,
    benefice: (parseFloat(trans.rows[0].entrees)||0) - (parseFloat(trans.rows[0].sorties)||0),
    pendingRecharges: parseInt(recharges.rows[0].cnt),
  });
});

app.get('/api/admin/players', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT id,name,phone,solde,dir_code,caiss_code,active,created_at FROM players ORDER BY created_at DESC");
  res.json({ players: r.rows });
});

app.get('/api/admin/directors', requireAdmin, async (req, res) => {
  const r = await pool.query(`
    SELECT d.*, j.amount as jackpot,
      COALESCE((SELECT SUM(ABS(t.montant)) FROM transactions t WHERE t.dir_code=d.code AND t.type='perte'),0) as total_mise,
      COALESCE((SELECT SUM(t.montant) FROM transactions t WHERE t.dir_code=d.code AND t.type='gain'),0) as total_gains
    FROM directors d
    LEFT JOIN jackpots j ON j.dir_code = d.code
    ORDER BY d.created_at
  `);
  res.json({ directors: r.rows });
});

app.post('/api/admin/directors', requireAdmin, async (req, res) => {
  const { name, code, zone, phone, pwd, pct } = req.body;
  if (!name||!code||!zone||!pwd) return res.status(400).json({ error: 'Champs obligatoires' });
  const hash = await bcrypt.hash(pwd, 10);
  const r = await pool.query("INSERT INTO directors (name,code,zone,phone,pwd_hash,pct) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [name, code.toUpperCase(), zone, phone||'', hash, pct||0]);
  await pool.query("INSERT INTO jackpots (dir_code) VALUES ($1) ON CONFLICT DO NOTHING", [code.toUpperCase()]);
  res.json({ success: true, director: r.rows[0] });
});

app.delete('/api/admin/directors/:code', requireAdmin, async (req, res) => {
  await pool.query("UPDATE directors SET active=FALSE WHERE code=$1", [req.params.code]);
  res.json({ success: true });
});
app.post('/api/auth/cashier', async (req, res) => {
  try {
    const { code, pwd } = req.body;
    console.log('[auth/cashier] code='+JSON.stringify(code)+' pwd_len='+String(pwd||'').length);
    if (!code || !pwd) return res.status(400).json({ error: 'Code et mot de passe requis' });
    const codeUpper = String(code).trim().toUpperCase();
    const pwdClean  = String(pwd).trim();
    // Chercher avec ET sans active=TRUE pour diagnostiquer
    const rAll = await pool.query("SELECT code,name,dir_code,jeu,active,LENGTH(pwd_hash) AS hashlen FROM cashiers WHERE code=$1", [codeUpper]);
    console.log('[auth/cashier] rows all (sans filtre):', rAll.rows.length, rAll.rows.map(r=>({code:r.code,active:r.active,hashlen:r.hashlen})));
    const r = await pool.query("SELECT * FROM cashiers WHERE code=$1 AND active=TRUE", [codeUpper]);
    console.log('[auth/cashier] rows active=TRUE:', r.rows.length);
    if (!r.rows.length) {
      // Si existait mais inactive — réactiver automatiquement
      if (rAll.rows.length > 0) {
        console.log('[auth/cashier] caissier trouvé mais inactive — tentative réactivation');
        await pool.query("UPDATE cashiers SET active=TRUE WHERE code=$1", [codeUpper]);
        const r2 = await pool.query("SELECT * FROM cashiers WHERE code=$1", [codeUpper]);
        if(r2.rows.length) r.rows.push(r2.rows[0]);
      }
      if (!r.rows.length) return res.status(401).json({ error: 'Code introuvable: ' + codeUpper });
    }
    const caiss = r.rows[0];
    const ok = await bcrypt.compare(pwdClean, caiss.pwd_hash);
    console.log('[auth/cashier] compare result:', ok, 'hash_len:', caiss.pwd_hash?.length);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query(
      "INSERT INTO sessions (id, role, user_code, expires_at) VALUES ($1, 'caissier', $2, NOW() + INTERVAL '30 days')",
      [token, caiss.code]
    );
    res.json({ token, role: 'caissier', code: caiss.code, name: caiss.name, dirCode: caiss.dir_code, jeu: caiss.jeu||'all' });
  } catch(e) {
    console.error('[auth/cashier] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// CAISSIER — CRÉATION (directeur ou admin)
// ═══════════════════════════════════════════════════════════
app.post('/api/cashier/create', requireAuth, async (req, res) => {
  try {
    if (!['admin','directeur'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { name, code, phone, pwd, jeu } = req.body;
    if (!name || !code || !pwd) return res.status(400).json({ error: 'Nom, code et mot de passe obligatoires' });
    const codeUpper = code.toUpperCase();
    const dirCode = req.session.role === 'directeur' ? req.session.user_code : req.body.dir_code;
    // Vérifier doublon
    const ex = await pool.query("SELECT code FROM cashiers WHERE code=$1", [codeUpper]);
    if (ex.rows.length) return res.status(400).json({ error: 'Ce code existe déjà: ' + codeUpper });
    // Hasher le mot de passe
    const hash = await bcrypt.hash(String(pwd), 10);
    const r = await pool.query(
      "INSERT INTO cashiers (name, code, dir_code, phone, pwd_hash, jeu) VALUES ($1,$2,$3,$4,$5,$6) RETURNING code, name, dir_code, phone, jeu",
      [name.trim(), codeUpper, dirCode||null, (phone||'').trim(), hash, jeu||'all']
    );
    console.log('cashier/create: créé', codeUpper, 'pour dir', dirCode);
    res.json({ success: true, cashier: r.rows[0] });
  } catch(e) {
    console.error('cashier/create:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// CAISSIER — SUPPRESSION (directeur ou admin)
// ═══════════════════════════════════════════════════════════
app.post('/api/cashier/delete', requireAuth, async (req, res) => {
  try {
    if (!['admin','directeur'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code manquant' });
    const codeUpper = code.toUpperCase();
    if (req.session.role === 'directeur') {
      // Le directeur ne peut supprimer que ses propres caissiers
      await pool.query("UPDATE cashiers SET active=FALSE WHERE code=$1 AND dir_code=$2", [codeUpper, req.session.user_code]);
    } else {
      await pool.query("UPDATE cashiers SET active=FALSE WHERE code=$1", [codeUpper]);
    }
    console.log('cashier/delete:', codeUpper);
    res.json({ success: true });
  } catch(e) {
    console.error('cashier/delete:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// CAISSIER — RESET MOT DE PASSE (directeur ou admin)
// ═══════════════════════════════════════════════════════════
app.post('/api/cashier/reset-pwd', requireAuth, async (req, res) => {
  try {
    if (!['admin','directeur'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { code, new_pwd } = req.body;
    if (!code || !new_pwd) return res.status(400).json({ error: 'Code et nouveau mot de passe requis' });
    const codeUpper = code.toUpperCase();
    const hash = await bcrypt.hash(String(new_pwd), 10);
    if (req.session.role === 'directeur') {
      await pool.query("UPDATE cashiers SET pwd_hash=$1 WHERE code=$2 AND dir_code=$3 AND active=TRUE", [hash, codeUpper, req.session.user_code]);
    } else {
      await pool.query("UPDATE cashiers SET pwd_hash=$1 WHERE code=$2 AND active=TRUE", [hash, codeUpper]);
    }
    console.log('cashier/reset-pwd:', codeUpper);
    res.json({ success: true });
  } catch(e) {
    console.error('cashier/reset-pwd:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DIRECTEUR: Lister SES caissiers ──
app.get('/api/dir/cashiers', requireDirector, async (req, res) => {
  try {
    const dirCode = req.session.role === 'directeur' ? req.session.user_code : req.query.dir_code;
    console.log('/api/dir/cashiers - dirCode:', dirCode, 'role:', req.session.role);
    if (!dirCode) return res.json({ cashiers: [] });
    const r = await pool.query(
      `SELECT c.code, c.name, c.phone, c.jeu, c.active, c.created_at,
              (SELECT COUNT(*) FROM players p WHERE p.caiss_code=c.code AND p.active=TRUE) AS nb_joueurs
       FROM cashiers c
       WHERE c.dir_code=$1 AND c.active=TRUE
       ORDER BY c.created_at DESC`,
      [dirCode]
    );
    console.log('/api/dir/cashiers - trouvé:', r.rows.length, 'caissiers pour', dirCode);
    res.json({ cashiers: r.rows });
  } catch(e) {
    console.error('/api/dir/cashiers error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DIRECTEUR: Lister SES joueurs ──
app.get('/api/dir/players', requireDirector, async (req, res) => {
  try {
    const dirCode = req.session.role === 'directeur' ? req.session.user_code : req.query.dir_code;
    const r = await pool.query(
      "SELECT p.name, p.phone, p.solde, p.created_at, c.name AS caiss_name FROM players p LEFT JOIN cashiers c ON p.caiss_code=c.code WHERE p.dir_code=$1 AND p.active=TRUE ORDER BY p.created_at DESC LIMIT 200",
      [dirCode]
    );
    res.json({ players: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DIRECTEUR: Stats (paris, transactions, soldes) ──
app.get('/api/dir/stats', requireDirector, async (req, res) => {
  try {
    const dirCode = req.session.role === 'directeur' ? req.session.user_code : req.query.dir_code;
    let nb_caissiers=0, nb_joueurs=0, total_solde=0, total_mise=0, total_gain=0, transactions=[];
    try { const r=await pool.query("SELECT COUNT(*) FROM cashiers WHERE dir_code=$1 AND active=TRUE",[dirCode]); nb_caissiers=parseInt(r.rows[0].count)||0; } catch(e){console.warn('stats.cashiers:',e.message);}
    try { const r=await pool.query("SELECT COUNT(*),COALESCE(SUM(solde),0) AS ts FROM players WHERE dir_code=$1 AND active=TRUE",[dirCode]); nb_joueurs=parseInt(r.rows[0].count)||0; total_solde=parseFloat(r.rows[0].ts)||0; } catch(e){console.warn('stats.players:',e.message);}
    try { const r=await pool.query("SELECT COALESCE(SUM(mise),0) AS tm,COALESCE(SUM(gain_potentiel),0) AS tg FROM bets WHERE dir_code=$1",[dirCode]); total_mise=parseFloat(r.rows[0].tm)||0; total_gain=parseFloat(r.rows[0].tg)||0; } catch(e){console.warn('stats.bets:',e.message);}
    try {
      const r=await pool.query(
        `SELECT t.type,t.montant,t.note,t.created_at,p.name AS player_name,c.name AS caiss_name
         FROM transactions t
         LEFT JOIN players p ON t.player_phone=p.phone
         LEFT JOIN cashiers c ON t.caiss_code=c.code
         WHERE t.dir_code=$1 ORDER BY t.created_at DESC LIMIT 100`,[dirCode]);
      transactions=r.rows;
    } catch(e){console.warn('stats.transactions:',e.message);}
    res.json({nb_caissiers,nb_joueurs,total_solde,total_mise,total_gain,transactions});
  } catch(e) { console.error('/api/dir/stats:',e.message); res.status(500).json({ error: e.message }); }
});


app.get('/api/admin/bets', requireAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const type  = req.query.type;
  const statut= req.query.statut;
  let q = "SELECT b.*, p.name AS player_name FROM bets b LEFT JOIN players p ON b.player_phone=p.phone WHERE 1=1";
  const params = [];
  if (type)   { params.push(type);   q += ` AND b.type=$${params.length}`; }
  if (statut) { params.push(statut); q += ` AND b.statut=$${params.length}`; }
  params.push(limit);
  q += ` ORDER BY b.created_at DESC LIMIT $${params.length}`;
  const r = await pool.query(q, params);
  res.json({ bets: r.rows });
});

app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT t.*, p.name AS player_name FROM transactions t LEFT JOIN players p ON t.player_phone=p.phone ORDER BY t.created_at DESC LIMIT 200");
  res.json({ transactions: r.rows });
});

app.get('/api/admin/recharges', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT r.*, p.name AS player_name FROM recharges r LEFT JOIN players p ON r.player_phone=p.phone ORDER BY r.created_at DESC LIMIT 100");
  res.json({ recharges: r.rows });
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT * FROM settings");
  const settings = {};
  r.rows.forEach(row => { settings[row.key] = row.value; });
  res.json(settings);
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await pool.query("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()", [key, String(value)]);
  }
  res.json({ success: true });
});

app.post('/api/admin/reset-password', requireAdmin, async (req, res) => {
  const { role, code, newPwd } = req.body;
  if (!role || !code || !newPwd) return res.status(400).json({ error: 'Champs manquants' });
  const hash = await bcrypt.hash(newPwd, 10);
  if (role === 'director') await pool.query("UPDATE directors SET pwd_hash=$1 WHERE code=$2", [hash, code]);
  else if (role === 'cashier') await pool.query("UPDATE cashiers SET pwd_hash=$1 WHERE code=$2", [hash, code]);
  else return res.status(400).json({ error: 'Rôle invalide' });
  res.json({ success: true });
});

// GET: lire la difficulté d'un jeu (global ou par directeur)
// GET: récupérer toutes les difficultés (globales + par directeur) en une fois
app.get('/api/admin/settings/all-game-diffs', requireAdmin, async (req, res) => {
  try {
    const GAMES = ['keno','lucky6','luckyx','course','helico','roulette','penalty'];
    // Global depuis settings
    const global = {};
    for (const g of GAMES) {
      const r = await pool.query("SELECT value FROM settings WHERE key=$1", [`${g}_default_diff`]);
      global[g] = r.rows.length ? parseInt(r.rows[0].value) : 45;
    }
    // Par directeur depuis game_difficulty
    const perDir = {};
    const r2 = await pool.query("SELECT dir_code, game_name, win_probability FROM game_difficulty WHERE dir_code IS NOT NULL");
    r2.rows.forEach(row => {
      if (!perDir[row.dir_code]) perDir[row.dir_code] = {};
      perDir[row.dir_code][row.game_name] = row.win_probability;
    });
    res.json({ global, perDir });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/settings/game-diff', requireAdmin, async (req, res) => {
  try {
    const { game_name, dir_code } = req.query;
    if (!game_name) return res.status(400).json({ error: 'game_name requis' });
    if (dir_code) {
      const r = await pool.query(
        "SELECT win_probability FROM game_difficulty WHERE dir_code=$1 AND game_name=$2",
        [dir_code, game_name]
      );
      return res.json({ win_probability: r.rows[0]?.win_probability ?? 45 });
    }
    // Global: chercher dans settings
    const def = await pool.query("SELECT value FROM settings WHERE key=$1", [`${game_name}_default_diff`]);
    res.json({ win_probability: def.rows.length ? parseInt(def.rows[0].value) : 45 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST: sauvegarder la difficulté
app.post('/api/admin/settings/game-diff', requireAdmin, async (req, res) => {
  try {
    const { dir_code, game_name, win_probability } = req.body;
    if (!game_name || win_probability === undefined) return res.status(400).json({ error: 'Données manquantes' });
    if (dir_code) {
      await pool.query(
        `INSERT INTO game_difficulty (dir_code, game_name, win_probability) VALUES ($1, $2, $3)
         ON CONFLICT (dir_code, game_name) DO UPDATE SET win_probability=$3`,
        [dir_code, game_name, win_probability]
      );
    } else {
      // Global: sauvegarder dans settings ET dans game_difficulty (dir_code NULL)
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2`,
        [`${game_name}_default_diff`, win_probability.toString()]
      );
      // Aussi dans game_difficulty avec dir_code NULL pour compatibilité
      await pool.query(
        `INSERT INTO game_difficulty (dir_code, game_name, win_probability) VALUES (NULL, $1, $2)
         ON CONFLICT (dir_code, game_name) DO UPDATE SET win_probability=$2`,
        [game_name, win_probability]
      ).catch(() => {}); // ignore si contrainte NULL
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DIRECTEUR ─────────────────────────────────────────────
app.get('/api/director/stats', requireAuth, async (req, res) => {
  if (!['directeur','admin'].includes(req.session.role)) return res.status(403).json({error:'Non autorisé'});
  const code = req.session.role === 'directeur' ? req.session.user_code : req.query.code;
  const [players, cashiers, bets, jk] = await Promise.all([
    pool.query("SELECT COUNT(*) as cnt, SUM(solde) as total FROM players WHERE dir_code=$1 AND active=TRUE", [code]),
    pool.query("SELECT COUNT(*) as cnt FROM cashiers WHERE dir_code=$1 AND active=TRUE", [code]),
    pool.query("SELECT COUNT(*) as cnt, SUM(mise) as total_mise, SUM(CASE WHEN statut='gagne' THEN gain_potentiel ELSE 0 END) as total_gains FROM bets WHERE dir_code=$1", [code]),
    pool.query("SELECT amount, week_sales FROM jackpots WHERE dir_code=$1", [code]),
  ]);
  const totalMise  = parseFloat(bets.rows[0].total_mise)||0;
  const totalGains = parseFloat(bets.rows[0].total_gains)||0;
  res.json({
    players:    parseInt(players.rows[0].cnt),
    totalSolde: parseFloat(players.rows[0].total)||0,
    cashiers:   parseInt(cashiers.rows[0].cnt),
    totalBets:  parseInt(bets.rows[0].cnt),
    totalMise,
    totalGains,
    benefice:   totalMise - totalGains,
    jackpot:    parseFloat(jk.rows[0]?.amount||0),
    weekSales:  parseFloat(jk.rows[0]?.week_sales||0),
  });
});

app.get('/api/director/players', requireAuth, async (req, res) => {
  const code = req.session.role === 'directeur' ? req.session.user_code : req.query.code;
  const r = await pool.query("SELECT id,name,phone,solde,caiss_code,created_at FROM players WHERE dir_code=$1 AND active=TRUE ORDER BY created_at DESC", [code]);
  res.json({ players: r.rows });
});

// ── CAISSIER ──────────────────────────────────────────────
app.get('/api/cashier/players', requireAuth, async (req, res) => {
  if (req.session.role !== 'caissier') return res.status(403).json({error:'Non autorisé'});
  const r = await pool.query("SELECT id,name,phone,solde,created_at FROM players WHERE caiss_code=$1 AND active=TRUE ORDER BY name", [req.session.user_code]);
  res.json({ players: r.rows });
});

app.post('/api/cashier/players', requireAuth, async (req, res) => {
  if (!['caissier','directeur','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  const { name, phone, pwd } = req.body;
  const hash = await bcrypt.hash(pwd || 'test123', 10);
  let dir_code, caiss_code;
  if (req.session.role === 'caissier') {
    const c = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [req.session.user_code]);
    dir_code = c.rows[0]?.dir_code;
    caiss_code = req.session.user_code;
  }
  const r = await pool.query("INSERT INTO players (name,phone,pwd_hash,dir_code,caiss_code) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,phone,solde", [name, phone, hash, dir_code, caiss_code]);
  res.json({ success: true, player: r.rows[0] });
});

// ── JEUX DE CASINO ───────────────────────────────────────
// ── ADMIN: Gestion tirages Keno & Lucky6 ────────────────

// Créer un tirage Keno (admin/directeur)
app.post('/api/admin/keno/tirage', requireAuth, async (req, res) => {
  try {
    if (!['admin','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { numeros, dir_code } = req.body;
    if (!numeros || numeros.length !== 20) return res.status(400).json({ error: '20 numéros requis (1-80)' });
    const dirCode = dir_code || req.session.user_code || null;
    const r = await pool.query(
      "INSERT INTO keno_tirages (dir_code, numeros, statut) VALUES ($1, $2, 'publie') RETURNING *",
      [dirCode, numeros]
    );
    res.json({ success: true, tirage: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Obtenir le dernier tirage Keno actif
app.get('/api/keno/tirage/actif', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM keno_tirages WHERE statut='publie' ORDER BY created_at DESC LIMIT 1"
    );
    res.json({ tirage: r.rows[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Créer un tirage Lucky6 (admin/directeur)
app.post('/api/admin/lucky6/tirage', requireAuth, async (req, res) => {
  try {
    if (!['admin','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { numeros, dir_code } = req.body;
    if (!numeros || numeros.length !== 36) return res.status(400).json({ error: '36 numéros requis (1-90)' });
    const dirCode = dir_code || req.session.user_code || null;
    const r = await pool.query(
      "INSERT INTO lucky6_tirages (dir_code, numeros, statut) VALUES ($1, $2, 'publie') RETURNING *",
      [dirCode, numeros]
    );
    res.json({ success: true, tirage: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Obtenir le dernier tirage Lucky6 actif
app.get('/api/lucky6/tirage/actif', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM lucky6_tirages WHERE statut='publie' ORDER BY created_at DESC LIMIT 1"
    );
    res.json({ tirage: r.rows[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/games/keno/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { numbers, mise } = req.body;
    const phone = req.session.user_phone;
    if (!numbers || !numbers.length || numbers.length > 10 || !mise || mise <= 0) return res.status(400).json({ error: 'Données invalides' });
    const playerNums = numbers.map(Number);
    const nbJoues = playerNums.length;
    await client.query('BEGIN');
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;

    // Génération par difficulté (admin contrôle via le panneau difficulté)
    const difficulte = await getWinProbability(dirCode, 'keno'); // 0-100

    const pool80 = Array.from({length:80}, (_,i) => i+1);
    const joues = pool80.filter(n => playerNums.includes(n));
    const autres = pool80.filter(n => !playerNums.includes(n));
    for (let i=joues.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[joues[i],joues[j]]=[joues[j],joues[i]];}
    for (let i=autres.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[autres[i],autres[j]]=[autres[j],autres[i]];}

    let nbJouesDansTirage;
    if (difficulte >= 60) {
      const minHits = Math.min(5, nbJoues);
      nbJouesDansTirage = minHits + Math.floor(Math.random() * (nbJoues - minHits + 1));
    } else if (difficulte < 40) {
      const maxHits = Math.min(4, nbJoues);
      nbJouesDansTirage = 1 + Math.floor(Math.random() * maxHits);
    } else {
      nbJouesDansTirage = Math.round((difficulte / 100) * nbJoues);
    }
    nbJouesDansTirage = Math.max(0, Math.min(nbJouesDansTirage, Math.min(nbJoues, 20)));

    const tirageFavoris = joues.slice(0, nbJouesDansTirage);
    const tirageAutres = autres.slice(0, 20 - tirageFavoris.length);
    const winningNumbers = [...tirageFavoris, ...tirageAutres].sort((a,b)=>a-b);
    const hits = playerNums.filter(n => winningNumbers.includes(n)).length;

    // Table de gain selon hits (seuil minimum = 5 hits pour gagner)
    // Si facile: 5 hits → mise×1, 6 hits → ×3, 7 hits → ×6, 8 hits → ×9, 9 hits → ×12, 10 hits → ×15
    // Si <5 hits → perd toujours (mode difficile garantit ça)
    let mult = 0;
    if (hits >= 5) {
      const gainTable = {5:1, 6:3, 7:6, 8:9, 9:12, 10:15};
      mult = gainTable[hits] || 1;
    }
    const gain = Math.round(mise * mult);

    // Transactions
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,'Mise Keno')", [phone,dirCode,-mise]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)", [phone,dirCode,gain,`Gain Keno ${hits}/${nbJoues} hits ×${mult}`]);
    await client.query("INSERT INTO bets (player_phone,dir_code,type,selection,mise,gain_potentiel,statut) VALUES ($1,$2,'keno',$3,$4,$5,$6)", [phone,dirCode,playerNums.join(','),mise,gain,gain>0?'gagne':'perdu']);
    if (dirCode) await client.query("INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3", [dirCode,mise*JACKPOT_PCT/100,mise]);
    await client.query('COMMIT');
    const nb = await pool.query("SELECT solde FROM players WHERE phone=$1",[phone]);
    const newBalance = parseFloat(nb.rows[0].solde);
    const modeLabel = difficulte >= 60 ? '(Facile)' : difficulte < 40 ? '(Difficile)' : '(Moyen)';
    res.json({ success:true, winningNumbers, hits, gain, newBalance, multiplier: mult,
      message: gain>0 ? `🎉 ${hits}/${nbJoues} boules ${modeLabel} — ×${mult} — Gain: ${gain} Gd` : `😔 ${hits}/${nbJoues} boules ${modeLabel} — Perdu` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/lucky6/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { numbers, mise } = req.body;
    const phone = req.session.user_phone;
    if (!numbers || numbers.length !== 6 || !mise || mise <= 0) return res.status(400).json({ error: '6 numéros requis' });
    const playerNums = numbers.map(Number);
    await client.query('BEGIN');
    const player = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;

    // Génération par difficulté (admin contrôle via le panneau difficulté)
    const difficulte = await getWinProbability(dirCode, 'lucky6');

    const pool48 = Array.from({length:48},(_,i)=>i+1);
    const joues = pool48.filter(n => playerNums.includes(n));
    const autres = pool48.filter(n => !playerNums.includes(n));
    for (let i=joues.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[joues[i],joues[j]]=[joues[j],joues[i]];}
    for (let i=autres.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[autres[i],autres[j]]=[autres[j],autres[i]];}

    let jouesDansRangee = Array(6).fill(0);
    if (difficulte >= 60) {
      jouesDansRangee = [3, 2, 1, 0, 0, 0];
    } else if (difficulte >= 45) {
      jouesDansRangee = [2, 2, 1, 1, 0, 0];
    } else if (difficulte >= 35) {
      jouesDansRangee = [1, 1, 1, 1, 1, 1];
    } else {
      jouesDansRangee = [0, 0, 1, 1, 2, 2];
    }

    let jouesIdx = 0, autresIdx = 0;
    const rows = [];
    for (let r=0; r<6; r++) {
      const row = [];
      const nbJouesIci = jouesDansRangee[r];
      for (let k=0; k<nbJouesIci && jouesIdx<joues.length; k++) row.push(joues[jouesIdx++]);
      while (row.length < 6 && autresIdx < autres.length) row.push(autres[autresIdx++]);
      for (let i=row.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[row[i],row[j]]=[row[j],row[i]];}
      rows.push(row);
    }
    const winningNumbers = rows.flat();

    // Calculer hits par rangée et gain
    // Règles:
    //  - Tous 6 en rangée 1 → 10000× (jackpot ultime)
    //  - Les 6 en rangées 1-2 → 500×
    //  - Les 6 en rangées 1-3 → 100×
    //  - Les 6 en rangées 1-4 → 20×
    //  - Les 6 en rangées 1-5 → 5×
    //  - Toujours dans dernière rangée → perd
    //  - Partiel selon position: selon difficulté + proportion haute/basse
    let hitsParRangee = rows.map(row => row.filter(n => playerNums.includes(n)).length);
    let totalHits = hitsParRangee.reduce((a,b)=>a+b,0);
    let hitsHauts = hitsParRangee.slice(0,3).reduce((a,b)=>a+b,0); // rangées 1-3
    let hitsBas = hitsParRangee.slice(3).reduce((a,b)=>a+b,0);    // rangées 4-6

    let gain = 0;
    let gainLabel = '';

    // Trouver la rangée dans laquelle tous les 6 sont trouvés (si possible)
    let premierRangeeComplete = -1;
    let cumulHits = 0;
    for (let r=0; r<6; r++) {
      cumulHits += hitsParRangee[r];
      if (cumulHits >= 6) { premierRangeeComplete = r; break; }
    }

    if (totalHits >= 6) {
      // Tous les 6 numéros ont été trouvés — gain selon la rangée où le 6ème arrive
      if (premierRangeeComplete === 0) { gain = Math.round(mise * 10000); gainLabel = '🏆 JACKPOT RANGÉE 1 ! 10000×'; }
      else if (premierRangeeComplete === 1) { gain = Math.round(mise * 500); gainLabel = '🎉 6/6 rangée 2 — 500×'; }
      else if (premierRangeeComplete === 2) { gain = Math.round(mise * 100); gainLabel = '🎉 6/6 rangée 3 — 100×'; }
      else if (premierRangeeComplete === 3) { gain = Math.round(mise * 20); gainLabel = '✅ 6/6 rangée 4 — 20×'; }
      else if (premierRangeeComplete === 4) { gain = Math.round(mise * 5); gainLabel = '✅ 6/6 rangée 5 — 5×'; }
      else { gain = 0; gainLabel = '😔 6/6 mais en dernière rangée — Perdu'; }
    } else if (totalHits >= 4 && hitsHauts > hitsBas) {
      // Majorité dans le haut: petit gain
      gain = Math.round(mise * 2);
      gainLabel = `✅ ${totalHits}/6 (majorité haut) — 2×`;
    } else if (totalHits >= 5 && hitsHauts >= 3) {
      gain = Math.round(mise * 3);
      gainLabel = `✅ ${totalHits}/6 en haut — 3×`;
    } else {
      gain = 0;
      gainLabel = `😔 ${totalHits}/6 — Perdu`;
    }

    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,'Mise Lucky6')", [phone,dirCode,-mise]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)", [phone,dirCode,gain,`Gain Lucky6 ${totalHits}/6`]);
    await client.query("INSERT INTO bets (player_phone,dir_code,type,selection,mise,gain_potentiel,statut) VALUES ($1,$2,'lucky6',$3,$4,$5,$6)", [phone,dirCode,playerNums.join(','),mise,gain,gain>0?'gagne':'perdu']);
    if (dirCode) await client.query("INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3", [dirCode,mise*JACKPOT_PCT/100,mise]);
    await client.query('COMMIT');
    const nb = await pool.query("SELECT solde FROM players WHERE phone=$1",[phone]);
    const newBalance = parseFloat(nb.rows[0].solde);
    res.json({ success:true, winningNumbers, rows, hitsParRangee, hits: totalHits, gain, newBalance, message: gainLabel });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/course/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { carId, mise } = req.body;
    const phone = req.session.user_phone;
    if (!carId || !mise || mise <= 0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const player = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    // Difficulté: % chance que la voiture choisie gagne
    const difficulte = await getWinProbability(dirCode, 'course'); // 0-100
    const rand = Math.random() * 100;
    const gagne = rand <= difficulte;
    const odds = {1:2.10, 2:1.75, 3:2.50, 4:3.20, 5:4.00, 6:5.50};
    const cote = odds[parseInt(carId)] || 2.0;
    const gain = gagne ? Math.round(mise * cote) : 0;
    // Classement visuel biaisé
    const voitures = [1,2,3,4,5,6];
    const autres = voitures.filter(v => v !== parseInt(carId));
    for (let i=autres.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[autres[i],autres[j]]=[autres[j],autres[i]];}
    const ranking = gagne
      ? [parseInt(carId), ...autres]
      : [autres[0], ...autres.slice(1).filter(v=>v!==parseInt(carId)), parseInt(carId)];
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,$4)", [phone,dirCode,-mise,`Mise Course voiture ${carId}`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)", [phone,dirCode,gain,`Gain Course voiture ${carId} ×${cote}`]);
    await client.query("INSERT INTO bets (player_phone,dir_code,type,selection,mise,cote,gain_potentiel,statut) VALUES ($1,$2,'course',$3,$4,$5,$6,$7)", [phone,dirCode,`Voiture ${carId}`,mise,cote,gain,gain>0?'gagne':'perdu']);
    if (dirCode) await client.query("INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3", [dirCode,mise*JACKPOT_PCT/100,mise]);
    await client.query('COMMIT');
    const nb = await pool.query("SELECT solde FROM players WHERE phone=$1",[phone]);
    res.json({ success:true, ranking, gagne, gain, newBalance:parseFloat(nb.rows[0].solde),
      message: gagne?`🏆 Voiture #${carId} gagne ! +${gain} Gd`:`😔 Voiture #${carId} n'a pas gagné` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// Hélicoptère – sessions en mémoire
let helicoSessions = new Map();
app.post('/api/games/helico/start', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { mise } = req.body;
    const phone = req.session.user_phone;
    if (!mise || mise <= 0) throw new Error('Mise invalide');
    const player = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    // Difficulté: plus c'est haut, plus le crash est retardé (favorable au joueur)
    const difficulte = await getWinProbability(dirCode, 'helico'); // 0-100
    await client.query('BEGIN');
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,'Mise Hélicoptère')", [phone, dirCode, -mise]);
    await client.query('COMMIT');
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    // crashMultiplier: difficulte=50 → crash moyen à ×1.5, difficulte=80 → crash tard à ×2.5
    const crashAt = 1.0 + (difficulte / 100) * 3.0 + Math.random() * 1.5;
    helicoSessions.set(sessionId, { phone, mise, dirCode, altitude:0, crashed:false, crashAt });
    const newBalance = parseFloat(player.rows[0].solde) - mise;
    res.json({ success:true, sessionId, newBalance, message:'Décollage ! Encaissez avant le crash.' });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/helico/cashout', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.body;
    const session = helicoSessions.get(sessionId);
    if (!session) throw new Error('Session invalide');
    if (session.crashed) throw new Error('Déjà crashé');
    const gainMultiplier = 1 + (session.altitude / 100);
    const gain = Math.floor(session.mise * gainMultiplier);
    await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, session.phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)", [session.phone, session.dirCode, gain, `Gain Hélicoptère (altitude ${session.altitude}m)`]);
    await client.query("INSERT INTO bets (player_phone, dir_code, type, mise, gain_potentiel, statut) VALUES ($1, $2, 'helico', $3, $4, 'gagne')", [session.phone, session.dirCode, session.mise, gain]);
    if (session.dirCode) {
      await client.query(`INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`, [session.dirCode, session.mise * JACKPOT_PCT / 100, session.mise]);
    }
    helicoSessions.delete(sessionId);
    const newBalance = (await client.query("SELECT solde FROM players WHERE phone=$1", [session.phone])).rows[0].solde;
    res.json({ success: true, gain, newBalance, message: `Encaissé ! Gain ${gain} Gd` });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// Alias pour le frontend qui envoie gain+mise directement
app.post('/api/games/helico/encaisse', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { mise, altitude, cote, gain } = req.body;
    if (!gain||gain<=0) return res.status(400).json({ error: 'Gain invalide' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)",
      [phone, pr.rows[0].dir_code, gain, `Gain Hélicoptère encaissé à ${altitude}m (×${parseFloat(cote||1).toFixed(2)})`]);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ success:true, gain, newBalance });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/helico/update', requireAuth, async (req, res) => {
  const { sessionId, altitude } = req.body;
  const session = helicoSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session introuvable' });
  if (session.crashed) return res.json({ crashed: true });
  session.altitude = altitude || session.altitude;
  // Crash basé sur crashAt (multiplier courant vs seuil)
  const currentMult = 1.0 + (session.altitude / 100);
  const crash = currentMult >= session.crashAt;
  if (crash) {
    session.crashed = true;
    helicoSessions.delete(sessionId);
  }
  res.json({ crashed: crash, altitude: session.altitude, crashAt: session.crashAt });
});

// ── AUTRES ROUTES API (bets, transactions, etc.) ──────────
// ── CAISSIER: Derniers paris enregistrés par ce caissier ──
app.get('/api/cashier/bets', requireAuth, async (req, res) => {
  try {
    if (!['caissier','admin','directeur'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const limit = parseInt(req.query.limit) || 20;
    let rows;
    if (req.session.role === 'caissier') {
      const r = await pool.query(
        `SELECT b.id, b.type, b.game_type, b.sub_type, b.selection, b.mise, b.gain_potentiel, b.statut, b.draw, b.created_at,
                p.name AS player_name, p.phone AS player_phone
         FROM bets b
         LEFT JOIN players p ON b.player_phone = p.phone
         WHERE b.caiss_code = $1
         ORDER BY b.created_at DESC LIMIT $2`,
        [req.session.user_code, limit]
      );
      rows = r.rows;
    } else if (req.session.role === 'directeur') {
      const r = await pool.query(
        `SELECT b.id, b.type, b.game_type, b.sub_type, b.selection, b.mise, b.gain_potentiel, b.statut, b.draw, b.created_at,
                p.name AS player_name, p.phone AS player_phone, c.name AS caiss_name
         FROM bets b
         LEFT JOIN players p ON b.player_phone = p.phone
         LEFT JOIN cashiers c ON b.caiss_code = c.code
         WHERE b.dir_code = $1
         ORDER BY b.created_at DESC LIMIT $2`,
        [req.session.user_code, limit]
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT b.id, b.type, b.game_type, b.sub_type, b.selection, b.mise, b.gain_potentiel, b.statut, b.draw, b.created_at,
                p.name AS player_name, p.phone AS player_phone, c.name AS caiss_name
         FROM bets b
         LEFT JOIN players p ON b.player_phone = p.phone
         LEFT JOIN cashiers c ON b.caiss_code = c.code
         ORDER BY b.created_at DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows;
    }
    res.json({ bets: rows });
  } catch(e) {
    console.error('/api/cashier/bets:', e.message);
    res.status(500).json({ error: e.message });
  }
});



// ── CAISSE: LANCER JEU (enregistrement DB + calcul résultats) ──
app.post('/api/caisse/lancer', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['caissier','admin','directeur'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Accès réservé au personnel' });
    }
    const { paris, player_phone } = req.body;
    if (!paris || !paris.length) return res.status(400).json({ error: 'Panier vide' });

    // Récupérer caiss_code et dir_code selon le rôle
    let caiss_code = null;
    let dir_code   = null;

    if (req.session.role === 'caissier') {
      caiss_code = req.session.user_code;
      const cr = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [caiss_code]);
      dir_code = cr.rows[0]?.dir_code || null;
    } else if (req.session.role === 'directeur') {
      dir_code = req.session.user_code;
    } else if (req.session.role === 'admin') {
      caiss_code = null; // Admin n'a pas de code caissier
    }

    // Récupérer le joueur si fourni
    let phone = player_phone || null;
    if (phone && !dir_code) {
      const pr = await pool.query("SELECT dir_code FROM players WHERE phone=$1", [phone]);
      if (pr.rows.length) dir_code = pr.rows[0].dir_code;
    }

    await client.query('BEGIN');

    // Vérifier et déduire solde si joueur connecté
    const totalMise = paris.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    if (phone) {
      const pr = await client.query("SELECT solde FROM players WHERE phone=$1 FOR UPDATE", [phone]);
      if (!pr.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Joueur introuvable' }); }
      if (parseFloat(pr.rows[0].solde) < totalMise) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Solde insuffisant' }); }
      await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [totalMise, phone]);
      await client.query(
        "INSERT INTO transactions (player_phone,dir_code,caiss_code,type,montant,note) VALUES ($1,$2,$3,'mise',$4,$5)",
        [phone, dir_code, caiss_code, -totalMise, `Caisse — ${paris.length} paris`]
      );
    }

    const resultats = [];

    // Logique globale: combien de paris gagnent selon la difficulté
    // difficulte=0 → joueur gagne facilement; difficulte=100 → joueur perd souvent
    const nbParis = paris.length;
    const diffGlobal = await getWinProbability(dir_code, paris[0]?.jeuType || paris[0]?.game || 'keno');
    // Probabilité de gagner: 80% si diff=0, 0% si diff=100
    const probGain = diffGlobal >= 100 ? 0 : Math.max(0.05, Math.min(0.80, 1 - diffGlobal/100));

    let nbGagnants;
    if (diffGlobal >= 100) {
      // 100% difficulté = personne ne gagne, jamais
      nbGagnants = 0;
    } else if (nbParis <= 1) {
      nbGagnants = Math.random() < probGain ? 1 : 0;
    } else if (diffGlobal >= 70 && nbParis >= 6) {
      // Jeu difficile + beaucoup de tickets : 1 gagnant minimum (anti-découragement)
      nbGagnants = 1;
    } else {
      const maxGagnants = Math.max(0, Math.floor(nbParis * probGain));
      nbGagnants = maxGagnants <= 1 ? (Math.random() < probGain ? 1 : 0)
                 : 1 + Math.floor(Math.random() * Math.min(2, maxGagnants));
    }

    // Indices des paris qui vont gagner (aléatoires)
    // Détecter les numéros dupliqués entre tickets — ceux-là perdent toujours
    const numsSignatures = paris.map(p => {
      const nums = p.nums || (p.cleanNumber||'').split(',').map(n=>n.trim()).filter(Boolean).sort();
      return nums.join(',');
    });
    const sigCount = {};
    numsSignatures.forEach(s=>{ sigCount[s]=(sigCount[s]||0)+1; });
    const idxDuplicates = new Set(
      numsSignatures.map((s,i)=> sigCount[s]>1 ? i : -1).filter(i=>i>=0)
    );

    // Choisir les indices gagnants parmi les non-dupliqués
    const eligibles = paris.map((_,i)=>i).filter(i=>!idxDuplicates.has(i));
    const idxGagnants = new Set();
    const eligiblesShuffled = eligibles.sort(()=>Math.random()-.5);
    for(let i=0; i<Math.min(nbGagnants, eligiblesShuffled.length); i++){
      idxGagnants.add(eligiblesShuffled[i]);
    }
    console.log(`caisse/lancer: ${nbParis} paris, diff=${diffGlobal}%, probGain=${(probGain*100).toFixed(0)}%, gagnants=${idxGagnants.size}, dupes=${idxDuplicates.size}`);

    let pariIdx = 0;
    for (const pari of paris) {
      const jeuType = pari.jeuType || pari.game;
      const mise    = parseFloat(pari.amount || 0);
      let gain = 0, winData = {}, resultMsg = '';
      const shouldWin = idxGagnants.has(pariIdx);
      pariIdx++;

      // Récupérer la difficulté depuis la DB
      const difficulte = await getWinProbability(dir_code, jeuType);

      if (jeuType === 'keno') {
        const nums = pari.nums || pari.cleanNumber.split(',').map(Number);
        const nbJoues = nums.length;
        const pool80 = Array.from({length:80},(_,i)=>i+1);
        const autres = pool80.filter(n=>!nums.includes(n)).sort(()=>Math.random()-.5);
        const joues  = pool80.filter(n=>nums.includes(n)).sort(()=>Math.random()-.5);

        let nbHits;
        if (shouldWin) {
          // Gagnant: nombre de hits dépend de la difficulté, JAMAIS plus que nbJoues
          let target;
          if (difficulte >= 70) {
            target = Math.random() < 0.7 ? 5 : 6; // jeu très difficile: gain minimal
          } else if (difficulte >= 40) {
            target = 5 + Math.floor(Math.random() * 2); // 5-6
          } else {
            target = 5 + Math.floor(Math.random() * 6); // 5-10
          }
          // Plafonner au nombre de numéros joués (et au minimum 5 pour gagner)
          nbHits = Math.min(target, nbJoues);
          if (nbHits < 5) nbHits = Math.min(5, nbJoues); // si le joueur a joué <5, max possible
        } else {
          // Perdant: jamais 5+ hits (sinon le joueur gagnerait malgré shouldWin=false)
          // Difficulte haute → très peu de boules du joueur dans le tirage (1-2 max)
          // Difficulte basse → un peu plus (3-4 max) pour créer la tension "presque gagné"
          const maxHitsLose = difficulte >= 70 ? 2 : difficulte >= 40 ? 3 : 4;
          nbHits = Math.floor(Math.random() * (maxHitsLose + 1));
          // S'assurer que nbHits ne dépasse jamais nbJoues-1 (jamais toutes les boules)
          nbHits = Math.min(nbHits, Math.min(4, nbJoues - 1));
        }
        nbHits = Math.max(0, Math.min(nbHits, Math.min(nbJoues, 20)));

        const winNums = [...joues.slice(0,nbHits), ...autres.slice(0,20-nbHits)].sort((a,b)=>a-b);
        const hits = nums.filter(n=>winNums.includes(n)).length;
        const multBase = getKenoMultiplier(hits, nbJoues, difficulte);
        // Variation aléatoire ±20% pour que le gain ne soit jamais identique
        const variation = 0.8 + Math.random() * 0.4;
        const mult = multBase > 0 ? Math.round(multBase * variation * 100) / 100 : 0;
        gain = mult > 0 ? Math.round(mise * mult * 100) / 100 : 0;
        winData = { winningNumbers: winNums, hits, multiplier: mult };
        resultMsg = gain>0 ? `${hits}/${nbJoues} boules ×${mult} → +${gain} Gd` : `${hits}/${nbJoues} boules → Perdu`;
        console.log(`[keno] shouldWin=${shouldWin} difficulte=${difficulte} nbJoues=${nbJoues} nbHits_target=${nbHits} hits_reel=${hits} mult=${mult} gain=${gain}`);

      } else if (jeuType === 'luckyx') {
        // Lucky X - même logique que Lucky 6
        const nums = pari.nums || pari.cleanNumber.split(',').map(Number);
        const pool48 = Array.from({length:48},(_,i)=>i+1);
        const joues  = pool48.filter(n=>nums.includes(n)).sort(()=>Math.random()-.5);
        const autres = pool48.filter(n=>!nums.includes(n)).sort(()=>Math.random()-.5);
        const l6MaxLose = difficulte >= 70 ? 2 : difficulte >= 40 ? 3 : 4;
        const wantHits = shouldWin ? Math.min(nums.length, 6) : Math.floor(Math.random()*(l6MaxLose+1));
        const winNums = [...joues.slice(0,wantHits), ...autres.slice(0,35-wantHits)].sort((a,b)=>a-b);
        const hits = nums.filter(n=>winNums.includes(n)).length;
        const MULT_BASE = {3:1,4:2,5:5,6:10,7:50,8:200,9:1000,10:5000};
        const multLX = MULT_BASE[hits] || 0;
        const lxvar = 0.85 + Math.random()*0.3;
        gain = multLX > 0 ? Math.round(mise * multLX * lxvar) : 0;
        winData = { winningNumbers: winNums, hits, multiplier: mult };
        resultMsg = gain>0 ? `${hits}/${nums.length} → ×${mult} +${gain} Gd` : `${hits}/${nums.length} → Perdu`;

      } else if (jeuType === 'lucky6') {
        const nums = pari.nums || pari.cleanNumber.split(',').map(Number);
        const pool48 = Array.from({length:48},(_,i)=>i+1);
        const joues  = pool48.filter(n=>nums.includes(n)).sort(()=>Math.random()-.5);
        const autres = pool48.filter(n=>!nums.includes(n)).sort(()=>Math.random()-.5);
        const lxMaxLose = difficulte >= 70 ? 2 : difficulte >= 40 ? 3 : 4;
        const wantHits = shouldWin ? 6 : Math.floor(Math.random()*(lxMaxLose+1));
        const winNums = [...joues.slice(0,wantHits), ...autres.slice(0,35-wantHits)].sort((a,b)=>a-b);
        const hits = nums.filter(n=>winNums.includes(n)).length;
        const l6var = 0.85 + Math.random()*0.3; // variation ±15%
        gain = hits===6 ? Math.round(mise*30*l6var) : hits===5 ? Math.round(mise*5*l6var) : 0;
        winData = { winningNumbers: winNums, hits };
        resultMsg = gain>0 ? `${hits}/6 numéros → +${gain} Gd` : `${hits}/6 numéros → Perdu`;

      } else if (jeuType === 'course') {
        const carId = parseInt(pari.cleanNumber);
        const COTES = [0,2.10,1.75,2.50,3.20,4.00,5.50];
        const boost = shouldWin ? 0.85 : 0.1;
        const winner = Math.random()<boost ? carId : Math.ceil(Math.random()*6);
        const ranking = [winner, ...[1,2,3,4,5,6].filter(i=>i!==winner)];
        const courseVar = 0.9 + Math.random()*0.2;
        gain = winner===carId ? parseFloat((mise*(COTES[carId]||2)*courseVar).toFixed(2)) : 0;
        winData = { winner, ranking };
        resultMsg = gain>0 ? `Voiture #${winner} gagne → +${gain} Gd` : `Voiture #${winner} gagne → Perdu`;

      } else if (jeuType === 'roulette') {
        const ROUGE = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        const result = Math.floor(Math.random()*37); // 0-36
        const isRouge = ROUGE.includes(result);
        const bet = pari.cleanNumber;
        const COTES={rouge:2,noir:2,pair:2,impair:2,'1-18':2,'19-36':2,'1-12':3,'13-24':3,'25-36':3,numero:35};
        // Si shouldWin, forcer le résultat vers ce que le client a misé
        let result_final = result;
        if(shouldWin){
          if(bet==='rouge'){ const rouges=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]; result_final=rouges[Math.floor(Math.random()*rouges.length)]; }
          else if(bet==='noir'){ const noirs=[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]; result_final=noirs[Math.floor(Math.random()*noirs.length)]; }
          else if(bet==='pair'){ result_final=2*(1+Math.floor(Math.random()*18)); }
          else if(bet==='impair'){ result_final=1+2*Math.floor(Math.random()*18); }
          else if(bet==='1-18'){ result_final=1+Math.floor(Math.random()*18); }
          else if(bet==='19-36'){ result_final=19+Math.floor(Math.random()*18); }
          else if(bet==='1-12'){ result_final=1+Math.floor(Math.random()*12); }
          else if(bet==='13-24'){ result_final=13+Math.floor(Math.random()*12); }
          else if(bet==='25-36'){ result_final=25+Math.floor(Math.random()*12); }
          else if(bet==='numero'){ const n=parseInt(pari.number.replace('N°','')); result_final=isNaN(n)?result:n; }
        }
        const isRouge_f = ROUGE.includes(result_final);
        winData = { result: result_final, isRouge: isRouge_f };
        let gagne = false;
        if(bet==='rouge')     gagne = result_final>0 && isRouge_f;
        else if(bet==='noir') gagne = result>0 && !isRouge;
        else if(bet==='pair') gagne = result>0 && result%2===0;
        else if(bet==='impair') gagne = result%2===1;
        else if(bet==='1-18')  gagne = result>=1&&result<=18;
        else if(bet==='19-36') gagne = result>=19&&result<=36;
        else if(bet==='1-12')  gagne = result>=1&&result<=12;
        else if(bet==='13-24') gagne = result>=13&&result<=24;
        else if(bet==='25-36') gagne = result>=25&&result<=36;
        else if(bet==='numero'){ const n=parseInt(pari.number.replace('N°','')); gagne = result===n; }
        const cote = pari.cote || COTES[bet] || 2;
        gain = gagne ? Math.round(mise * cote) : 0;
        winData = { result, isRouge };
        resultMsg = gagne ? `Roulette: ${result}${isRouge?' Rouge':' Noir'} → +${gain} Gd` : `Roulette: ${result}${isRouge?' Rouge':' Noir'} → Perdu`;

      } else if (jeuType === 'penalty') {
        const ZONES = ['hg','hc','hd','mg','mc','md','bg','bc','bd'];
        const COTES_PEN = {hg:4,hc:2.5,hd:4,mg:2,mc:1.5,md:2,bg:3,bc:2,bd:3};
        const winnerZone = ZONES[Math.floor(Math.random()*ZONES.length)];
        const saveProb = difficulte < 40 ? 0.6 : difficulte < 60 ? 0.4 : 0.25;
        const saved = pari.cleanNumber === winnerZone && Math.random() < saveProb;
        const scored = !saved && (pari.cleanNumber === winnerZone || Math.random() > 0.3);
        const cote = pari.cote || COTES_PEN[pari.cleanNumber] || 2;
        gain = scored ? Math.round(mise * cote) : 0;
        winData = { winnerZone, scored };
        resultMsg = scored ? `⚽ But! Zone ${pari.number} → +${gain} Gd` : `🧤 Arrêt! → Perdu`;

      } else if (jeuType === 'football') {
        // Paris sportif football
        const pronostic = pari.cleanNumber; // home|draw|away
        const cote = parseFloat(pari.cote) || 2.5;
        // Résultat basé sur shouldWin + cote (cote élevée = moins probable)
        const baseProb = shouldWin ? Math.max(0.4, 1 - cote/10) : Math.min(0.2, 0.5 - difficulte/200);
        const gagne = Math.random() < (shouldWin ? 0.7 : 0.15);
        gain = gagne ? Math.round(mise * cote * 100) / 100 : 0;
        const resultLabel = pronostic==='home'?'Victoire Domicile':pronostic==='draw'?'Nul':'Victoire Extérieur';
        winData = { pronostic, gagne, cote };
        resultMsg = gagne ? `✅ ${resultLabel} → +${gain} Gd` : `❌ ${resultLabel} → Perdu`;

      } else {
        const mult = {borlette:60,lotto3:40,lotto4:30,lotto5:20,mariage:50}[pari.game||jeuType]||60;
        let tirage;
        if(shouldWin){
          tirage = String(pari.cleanNumber).padStart(2,'0'); // Le tirage correspond
        } else {
          do { tirage = Math.floor(Math.random()*100).toString().padStart(2,'0'); }
          while(tirage === String(pari.cleanNumber).padStart(2,'0'));
        }
        const gagne = String(pari.cleanNumber).padStart(2,'0') === tirage;
        gain = gagne ? Math.round(mise*mult) : 0;
        winData = { tirage };
        resultMsg = gain>0 ? `Tirage ${tirage} → GAGNÉ +${gain} Gd` : `Tirage ${tirage} → Perdu`;
      }

      // Créditer gain
      if (gain>0 && phone) {
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
        await client.query(
          "INSERT INTO transactions (player_phone,dir_code,caiss_code,type,montant,note) VALUES ($1,$2,$3,'gain',$4,$5)",
          [phone, dir_code, caiss_code, gain, `Gain Caisse ${jeuType}`]
        );
      }

      // Enregistrer pari en DB
      try {
        await client.query(
          `INSERT INTO bets (player_phone,dir_code,caiss_code,type,game_type,sub_type,selection,mise,gain_potentiel,statut,draw)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            phone||null, dir_code||null, caiss_code||null,
            String(jeuType||'keno'), String(pari.game||jeuType||'keno'),
            String(pari.ticketId||'').substring(0,50),
            String(pari.number||pari.cleanNumber||'?').substring(0,200),
            Number(mise)||0, Number(gain)||0,
            gain>0 ? 'gagne' : 'perdu',
            String(pari.drawId||'').substring(0,50)
          ]
        );
        console.log('[caisse/lancer] pari enregistré:', jeuType, 'gain:', gain);
      } catch(insertErr) {
        console.error('[caisse/lancer] INSERT ERREUR:', insertErr.message);
      }

      // Jackpot
      if (dir_code) {
        await pool.query(
          "INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3",
          [dir_code, mise*JACKPOT_PCT/100, mise]
        ).catch(()=>{});
      }

      resultats.push({ ticketId: pari.ticketId, jeuType, pari, gain, resultMsg, winData });
    }

    await client.query('COMMIT');

    let newSolde = null;
    if (phone) {
      const sr = await pool.query("SELECT solde FROM players WHERE phone=$1", [phone]);
      newSolde = parseFloat(sr.rows[0]?.solde || 0);
    }

    res.json({ success: true, resultats, newSolde });
  } catch(e) {
    try { await client.query('ROLLBACK'); } catch(_) {}
    console.error('/api/caisse/lancer:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});app.get('/api/bets', requireAuth, async (req, res) => {
  try {
    let conditions = [];
    let params = [];
    if (req.session.role === 'joueur') {
      params.push(req.session.user_phone);
      conditions.push(`b.player_phone = $${params.length}`);
    } else if (req.session.role === 'directeur') {
      params.push(req.session.user_code);
      conditions.push(`b.dir_code = $${params.length}`);
    }
    const gameType = req.query.game_type;
    if (gameType) {
      params.push(gameType);
      conditions.push(`(b.game_type = $${params.length} OR b.type = $${params.length})`);
    }
    let query = `SELECT b.*, p.name AS player_name FROM bets b LEFT JOIN players p ON b.player_phone = p.phone`;
    if (conditions.length) query += ` WHERE ` + conditions.join(' AND ');
    query += ` ORDER BY b.created_at DESC LIMIT 200`;
    const r = await pool.query(query, params);
    res.json({ bets: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    let q, params = [];
    if (req.session.role === 'joueur') {
      q = "SELECT * FROM transactions WHERE player_phone=$1 ORDER BY created_at DESC LIMIT 200";
      params = [req.session.user_phone];
    } else {
      q = "SELECT t.*, p.name AS player_name FROM transactions t LEFT JOIN players p ON t.player_phone=p.phone ORDER BY t.created_at DESC LIMIT 300";
    }
    const r = await pool.query(q, params);
    res.json({ transactions: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// ── BORLETTE BLOCKED & LIMITS (routes manquantes) ────────
app.get('/api/borlette/blocked', requireAuth, async (req, res) => {
  const r = await pool.query("SELECT * FROM borlette_blocked ORDER BY created_at DESC");
  res.json({ blocked: r.rows });
});

app.post('/api/borlette/block', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  const { number, draw } = req.body;
  if (!number) return res.status(400).json({ error: 'Numéro requis' });
  await pool.query("INSERT INTO borlette_blocked (number, draw) VALUES ($1, $2) ON CONFLICT (number, draw) DO NOTHING", [number.padStart(2,'0'), draw||'']);
  res.json({ success: true });
});

app.delete('/api/borlette/block/:id', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  await pool.query("DELETE FROM borlette_blocked WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

app.get('/api/borlette/limits', requireAuth, async (req, res) => {
  const r = await pool.query("SELECT * FROM borlette_limits ORDER BY number");
  res.json({ limits: r.rows });
});

app.post('/api/borlette/limit', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  const { number, draw, max_amount } = req.body;
  if (!number || !max_amount) return res.status(400).json({ error: 'Données manquantes' });
  await pool.query("INSERT INTO borlette_limits (number, draw, max_amount) VALUES ($1,$2,$3) ON CONFLICT (number, draw) DO UPDATE SET max_amount=$3, updated_at=NOW()", [number.padStart(2,'0'), draw||'', max_amount]);
  res.json({ success: true });
});

app.delete('/api/borlette/limit/:id', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  await pool.query("DELETE FROM borlette_limits WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ── RETRAITS JOUEUR (Moncash / Natcash / Cash) ────────────
// Table retraits
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS retraits (
      id SERIAL PRIMARY KEY,
      player_phone TEXT REFERENCES players(phone),
      dir_code TEXT REFERENCES directors(code),
      montant REAL NOT NULL,
      methode TEXT NOT NULL,
      numero_mobile TEXT,
      statut TEXT DEFAULT 'pending',
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
  `);
})();

app.post('/api/retraits/demande', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { montant, methode, numero_mobile } = req.body;
    if (!montant || montant < 50) return res.status(400).json({ error: 'Montant minimum 50 Gourdes' });
    if (!['moncash','natcash','cash','kashpaw'].includes(methode)) return res.status(400).json({ error: 'Méthode invalide' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(pr.rows[0].solde) < montant) throw new Error('Solde insuffisant');
    const dirCode = pr.rows[0].dir_code;
    // Déduire immédiatement
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [montant, phone]);

    let statut = 'pending';
    let apiRef = null;
    let apiMsg = 'En attente de traitement';

    // Traitement automatique via API pour Moncash, Natcash et Kashpaw
    if ((methode === 'moncash' || methode === 'natcash' || methode === 'kashpaw') && MERCHANT_CLIENT_ID && MERCHANT_SECRET_KEY && numero_mobile) {
      try {
        const reference = `TK_${phone.replace(/\D/g,'')}_${Date.now()}`;
        const methodApi = methode === 'moncash' ? 'moncash' : 'natcash';
        await executerRetraitPlopPlop(montant, methodApi, numero_mobile, reference);
        statut = 'approved';
        apiMsg = `✅ Retrait envoyé via ${methode} au ${numero_mobile}`;
      } catch(apiErr) {
        console.error('PlopPlop retrait error:', apiErr.message);
        if (apiErr.message.includes('Cooldown')) {
          // Rembourser et rejeter
          await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [montant, phone]);
          await client.query('ROLLBACK');
          return res.status(429).json({ error: apiErr.message });
        }
        // Autres erreurs → pending pour traitement manuel
        statut = 'pending';
        apiMsg = `⏳ Retrait en attente (${apiErr.message})`;
      }
    }

    const r = await client.query(
      "INSERT INTO retraits (player_phone,dir_code,montant,methode,numero_mobile,statut,note) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [phone, dirCode, montant, methode, numero_mobile||phone, statut, apiMsg]
    );
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'retrait',$3,$4)",
      [phone, dirCode, -montant, apiMsg]);
    await client.query('COMMIT');
    const newSolde = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({
      success: true,
      retrait_id: r.rows[0].id,
      newSolde,
      statut,
      message: statut === 'approved'
        ? `✅ Retrait de ${montant} Gd envoyé directement sur votre ${methode} !`
        : `⏳ Retrait de ${montant} Gd en cours de traitement.`
    });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/retraits', requireAuth, async (req, res) => {
  let q = "SELECT rt.*, p.name AS player_name FROM retraits rt LEFT JOIN players p ON rt.player_phone=p.phone WHERE 1=1";
  const params = [];
  if (req.session.role === 'joueur') { params.push(req.session.user_phone); q += ` AND rt.player_phone=$${params.length}`; }
  else if (req.session.role === 'directeur') { params.push(req.session.user_code); q += ` AND rt.dir_code=$${params.length}`; }
  q += " ORDER BY rt.created_at DESC LIMIT 100";
  const r = await pool.query(q, params);
  res.json({ retraits: r.rows });
});

app.post('/api/retraits/:id/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const id = parseInt(req.params.id);
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM retraits WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) throw new Error('Retrait introuvable ou déjà traité');
    const rt = r.rows[0];
    await client.query("UPDATE retraits SET statut='approved', updated_at=NOW(), note=$1 WHERE id=$2", [req.body.note||'Approuvé', id]);
    await client.query("UPDATE transactions SET note='Retrait '+$1+' approuvé' WHERE player_phone=$2 AND type='retrait_demande' AND note LIKE 'Demande retrait%' AND created_at=(SELECT MAX(created_at) FROM transactions WHERE player_phone=$2 AND type='retrait_demande')", [rt.methode, rt.player_phone]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/retraits/:id/reject', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const id = parseInt(req.params.id);
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM retraits WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) throw new Error('Retrait introuvable');
    const rt = r.rows[0];
    // Rembourser le solde
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [rt.montant, rt.player_phone]);
    await client.query("UPDATE retraits SET statut='rejected', updated_at=NOW() WHERE id=$1", [id]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'remboursement',$3,'Retrait rejeté — solde remboursé')", [rt.player_phone, rt.dir_code, rt.montant]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── CAISSIER: RECHARGE ET RETRAIT CASH DIRECT ────────────
app.post('/api/cashier/recharge', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['caissier','directeur','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { player_phone, montant, methode, note } = req.body;
    if (!player_phone || !montant || montant <= 0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [player_phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    let caiss_code = null, dir_code = pr.rows[0].dir_code;
    if (req.session.role === 'caissier') { caiss_code = req.session.user_code; }
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [montant, player_phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'depot',$4,$5)", [player_phone, dir_code, caiss_code, montant, note||`Rechargement ${methode||'cash'} par caissier`]);
    await client.query("INSERT INTO recharges (player_phone, dir_code, caiss_code, montant, methode, reference_id, statut) VALUES ($1,$2,$3,$4,$5,$6,'completed')", [player_phone, dir_code, caiss_code, montant, methode||'cash', `CASH_${Date.now()}`]);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[player_phone])).rows[0].solde;
    res.json({ success: true, newSolde });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/cashier/retrait', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['caissier','directeur','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { player_phone, montant, note } = req.body;
    if (!player_phone || !montant || montant <= 0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [player_phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(pr.rows[0].solde) < montant) throw new Error('Solde insuffisant');
    let caiss_code = req.session.role === 'caissier' ? req.session.user_code : null;
    const dir_code = pr.rows[0].dir_code;
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [montant, player_phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'retrait',$4,$5)", [player_phone, dir_code, caiss_code, -montant, note||'Retrait cash bureau']);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[player_phone])).rows[0].solde;
    res.json({ success: true, newSolde });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── MATH VEDETTE (résultats borlette) ────────────────────
// Table math_vedette
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS math_vedette (
      id SERIAL PRIMARY KEY,
      date_tirage DATE NOT NULL,
      draw TEXT NOT NULL,
      numero TEXT NOT NULL,
      occurrences INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
})();

app.get('/api/borlette/math-vedette', requireAuth, async (req, res) => {
  try {
    // Calculer les numéros les plus fréquents des 30 derniers résultats
    const r = await pool.query(`
      SELECT lot1 as num, COUNT(*) as cnt FROM borlette_results WHERE lot1 IS NOT NULL GROUP BY lot1
      UNION ALL
      SELECT lot2, COUNT(*) FROM borlette_results WHERE lot2 IS NOT NULL AND lot2!='' GROUP BY lot2
      UNION ALL
      SELECT lot3, COUNT(*) FROM borlette_results WHERE lot3 IS NOT NULL AND lot3!='' GROUP BY lot3
    `);
    // Agréger par numéro
    const counts = {};
    r.rows.forEach(row => {
      counts[row.num] = (counts[row.num]||0) + parseInt(row.cnt);
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,20).map(([num,cnt]) => ({ num, cnt }));
    res.json({ vedette: sorted });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RÉSOLUTION AUTOMATIQUE DES PARIS SPORTIFS ─────────────
app.post('/api/bets/:id/resolve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { statut } = req.body; // 'gagne' ou 'perdu'
    if (!['gagne','perdu'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
    await client.query('BEGIN');
    const br = await client.query("SELECT * FROM bets WHERE id=$1 AND statut='en_attente' FOR UPDATE", [req.params.id]);
    if (!br.rows.length) throw new Error('Pari introuvable ou déjà résolu');
    const bet = br.rows[0];
    await client.query("UPDATE bets SET statut=$1, resolved_at=NOW() WHERE id=$2", [statut, bet.id]);
    if (statut === 'gagne') {
      const gain = parseFloat(bet.gain_potentiel)||0;
      if (gain > 0) {
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, bet.player_phone]);
        await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,$4)", [bet.player_phone, bet.dir_code, gain, `Gain pari sportif résolu`]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── JOUEUR: SOLDE ET PROFIL ────────────────────────────────
app.get('/api/player/solde', requireAuth, async (req, res) => {
  if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
  const r = await pool.query("SELECT solde FROM players WHERE phone=$1", [req.session.user_phone]);
  res.json({ solde: parseFloat(r.rows[0]?.solde||0) });
});

// ── ADMIN: RETRAITS ────────────────────────────────────────
app.get('/api/admin/retraits', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT rt.*, p.name AS player_name FROM retraits rt LEFT JOIN players p ON rt.player_phone=p.phone ORDER BY rt.created_at DESC LIMIT 200");
  res.json({ retraits: r.rows });
});

// ── ADMIN: CRÉDITER SOLDE JOUEUR ──────────────────────────
app.post('/api/admin/players/:phone/credit', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { montant, note } = req.body;
    const phone = req.params.phone;
    if (!montant) return res.status(400).json({ error: 'Montant requis' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [montant, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'credit_admin',$3,$4)", [phone, pr.rows[0].dir_code, montant, note||'Crédit administrateur']);
    await client.query('COMMIT');
    const ns = (await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde;
    res.json({ success: true, newSolde: ns });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ============================================================
// ── ROUTES JEUX CASINO ──────────────────────────────────────
// ============================================================

// Helper: déduire mise + insérer transaction + MAJ solde
async function deductAndRecord(client, phone, mise, gameType, detail) {
  const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
  if (!pr.rows.length) throw new Error('Joueur introuvable');
  const solde = parseFloat(pr.rows[0].solde);
  if (solde < mise) throw new Error('Solde insuffisant');
  await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
  await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,$3,$4,$5)",
    [phone, pr.rows[0].dir_code, 'mise', -mise, `${gameType}: ${detail}`]);
  return { dirCode: pr.rows[0].dir_code, soldeBefore: solde };
}

// Helper: créditer gain
async function creditGain(client, phone, dirCode, gain, gameType, detail) {
  if (gain <= 0) return;
  await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
  await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,$4)",
    [phone, dirCode, gain, `Gain ${gameType}: ${detail}`]);
}

// ── PENALTY ───────────────────────────────────────────────
app.post('/api/games/penalty/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const phone = req.session.user_phone;
    const { direction, mise } = req.body;
    if (!direction || !mise || mise <= 0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const player = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    // Difficulté: % de chance que le gardien plonge du MAUVAIS côté (joueur marque)
    const difficulte = await getWinProbability(dirCode, 'penalty');
    const rand = Math.random() * 100;
    const gagne = rand <= difficulte;
    const dirs = ['gauche','centre','droite'];
    let goalieDir;
    if (gagne) {
      // Gardien plonge ailleurs
      goalieDir = dirs.filter(d => d !== direction)[Math.floor(Math.random()*2)];
    } else {
      // Gardien plonge du bon côté
      goalieDir = direction;
    }
    const gain = gagne ? Math.round(mise * 1.9) : 0;
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,$4)", [phone,dirCode,-mise,`Mise Penalty ${direction}`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)", [phone,dirCode,gain,`Gain Penalty BUT ${direction}`]);
    await client.query("INSERT INTO bets (player_phone,dir_code,type,selection,mise,gain_potentiel,statut) VALUES ($1,$2,'penalty',$3,$4,$5,$6)", [phone,dirCode,direction,mise,gain,gain>0?'gagne':'perdu']);
    if (dirCode) await client.query("INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3", [dirCode,mise*JACKPOT_PCT/100,mise]);
    await client.query('COMMIT');
    const nb = await pool.query("SELECT solde FROM players WHERE phone=$1",[phone]);
    res.json({ goalieDir, gagne, gain, newBalance:parseFloat(nb.rows[0].solde),
      message: gagne ? `⚽ BUT ! +${gain} Gd` : `🧤 Arrêté ! Gardien → ${goalieDir}` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/roulette/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const phone = req.session.user_phone;
    const { betType, betValue, mise } = req.body;
    if (!betType || betValue === undefined || !mise || mise <= 0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const player = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(player.rows[0].solde) < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    // Difficulté: % de chance que le résultat soit gagnant
    const difficulte = await getWinProbability(dirCode, 'roulette');
    const rand = Math.random() * 100;
    const playerWins = rand <= difficulte;
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    let result;
    if (playerWins) {
      // Générer un résultat qui fait gagner le joueur
      const allNums = Array.from({length:37},(_,i)=>i);
      const winning = allNums.filter(n => {
        const col = n===0?'vert':reds.includes(n)?'rouge':'noir';
        const par = n===0?'zero':n%2===0?'pair':'impair';
        const doz = n===0?0:n<=12?1:n<=24?2:3;
        const c   = n===0?0:(n%3===0?3:n%3);
        if (betType==='number') return parseInt(betValue)===n;
        if (betType==='color')  return betValue===col;
        if (betType==='parity') return betValue===par;
        if (betType==='dozen')  return parseInt(betValue)===doz;
        if (betType==='column') return parseInt(betValue)===c;
        return false;
      });
      result = winning.length > 0 ? winning[Math.floor(Math.random()*winning.length)] : Math.floor(Math.random()*37);
    } else {
      // Générer un résultat perdant
      const allNums = Array.from({length:37},(_,i)=>i);
      const losing = allNums.filter(n => {
        const col = n===0?'vert':reds.includes(n)?'rouge':'noir';
        const par = n===0?'zero':n%2===0?'pair':'impair';
        const doz = n===0?0:n<=12?1:n<=24?2:3;
        const c   = n===0?0:(n%3===0?3:n%3);
        if (betType==='number') return parseInt(betValue)!==n;
        if (betType==='color')  return betValue!==col;
        if (betType==='parity') return betValue!==par;
        if (betType==='dozen')  return parseInt(betValue)!==doz;
        if (betType==='column') return parseInt(betValue)!==c;
        return true;
      });
      result = losing.length > 0 ? losing[Math.floor(Math.random()*losing.length)] : 0;
    }
    const color = result===0?'vert':reds.includes(result)?'rouge':'noir';
    const parity = result===0?'zero':result%2===0?'pair':'impair';
    const dozen = result===0?0:result<=12?1:result<=24?2:3;
    const column = result===0?0:(result%3===0?3:result%3);
    let mult = 0;
    if (betType==='number' && parseInt(betValue)===result) mult=36;
    else if (betType==='color' && betValue===color) mult=2;
    else if (betType==='parity' && betValue===parity) mult=2;
    else if (betType==='dozen' && parseInt(betValue)===dozen) mult=3;
    else if (betType==='column' && parseInt(betValue)===column) mult=3;
    const gain = mult > 0 ? Math.round(mise * mult) : 0;
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,$4)", [phone,dirCode,-mise,`Mise Roulette ${betType}:${betValue}`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)", [phone,dirCode,gain,`Gain Roulette ${result}(${color}) ×${mult}`]);
    await client.query("INSERT INTO bets (player_phone,dir_code,type,selection,mise,gain_potentiel,statut) VALUES ($1,$2,'roulette',$3,$4,$5,$6)", [phone,dirCode,`${betType}:${betValue}`,mise,gain,gain>0?'gagne':'perdu']);
    if (dirCode) await client.query("INSERT INTO jackpots (dir_code,amount,week_sales) VALUES ($1,$2,$3) ON CONFLICT (dir_code) DO UPDATE SET amount=jackpots.amount+$2,week_sales=jackpots.week_sales+$3", [dirCode,mise*JACKPOT_PCT/100,mise]);
    await client.query('COMMIT');
    const nb = await pool.query("SELECT solde FROM players WHERE phone=$1",[phone]);
    res.json({ result, color, parity, dozen, column, gain, newBalance:parseFloat(nb.rows[0].solde),
      message: gain>0?`🎉 ${result} (${color}) — +${gain} Gd`:`😔 ${result} (${color}) — Perdu` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── BORLETTE: PLACER UN TICKET ────────────────────────────
app.post('/api/borlette/bet', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const phone = req.session.user_phone || req.session.user_code;
    const { numeros, types, montants, draw } = req.body;
    // numeros: ['12','34',...], types: ['bolet','mariage',...], montants: [50,100,...]
    if (!numeros || !numeros.length) return res.status(400).json({ error: 'Numéros requis' });

    await client.query('BEGIN');
    const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    const totalMise = montants.reduce((a,b)=>a+parseFloat(b),0);
    if (parseFloat(pr.rows[0].solde) < totalMise) throw new Error('Solde insuffisant');

    // Vérifier les numéros bloqués
    for (const num of numeros) {
      const bl = await client.query("SELECT id FROM borlette_blocked WHERE number=$1 AND (draw='' OR draw=$2)", [num.padStart(2,'0'), draw||'']);
      if (bl.rows.length) throw new Error(`Numéro ${num} bloqué pour ce tirage`);
    }
    // Vérifier les limites
    for (let i=0; i<numeros.length; i++) {
      const lim = await client.query("SELECT max_amount FROM borlette_limits WHERE number=$1 AND (draw='' OR draw=$2)", [numeros[i].padStart(2,'0'), draw||'']);
      if (lim.rows.length) {
        const totalSurNum = await client.query("SELECT COALESCE(SUM(b.montant),0) as tot FROM borlette_bets b WHERE b.numero=$1 AND b.draw=$2 AND b.statut!='annule'", [numeros[i].padStart(2,'0'), draw||'']);
        if (parseFloat(totalSurNum.rows[0].tot) + parseFloat(montants[i]) > parseFloat(lim.rows[0].max_amount))
          throw new Error(`Limite atteinte pour le numéro ${numeros[i]}`);
      }
    }

    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [totalMise, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'mise',$3,$4)",
      [phone, pr.rows[0].dir_code, -totalMise, `Borlette ${draw||''}: ${numeros.join(',')}`]);

    const ticketRef = 'BOR'+Date.now().toString(36).toUpperCase();
    const ticketId = (await client.query("INSERT INTO borlette_tickets (player_phone, dir_code, draw, ticket_ref, total_mise, statut) VALUES ($1,$2,$3,$4,$5,'actif') RETURNING id",
      [phone, pr.rows[0].dir_code, draw||'', ticketRef, totalMise])).rows[0].id;

    for (let i=0; i<numeros.length; i++) {
      await client.query("INSERT INTO borlette_bets (ticket_id, player_phone, dir_code, numero, type_jeu, montant, draw) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [ticketId, phone, pr.rows[0].dir_code, numeros[i].padStart(2,'0'), types[i]||'bolet', montants[i], draw||'']);
    }

    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ success: true, ticketRef, ticketId, newBalance });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── BORLETTE: RÉSOUDRE UN TIRAGE ─────────────────────────
app.post('/api/borlette/resolve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { draw, lot1, lot2, lot3 } = req.body;
    if (!draw || !lot1) return res.status(400).json({ error: 'Tirage et lot1 requis' });

    await client.query('BEGIN');
    // Sauvegarder résultat
    await client.query("INSERT INTO borlette_results (draw, lot1, lot2, lot3, resolved_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (draw) DO UPDATE SET lot1=$2,lot2=$3,lot3=$4,resolved_by=$5,updated_at=NOW()",
      [draw, lot1.padStart(2,'0'), lot2?lot2.padStart(2,'0'):'', lot3?lot3.padStart(2,'0'):'', req.session.user_phone||req.session.user_code]);

    // Multipliateurs standard borlette haïtienne
    const MULTS = { bolet_lot1:50, bolet_lot2:25, bolet_lot3:10, mariage_lot1_lot2:375, mariage_lot1_lot3:250, mariage_lot2_lot3:150, loto3chif:500 };

    // Récupérer tous les paris non résolus pour ce tirage
    const bets = await client.query("SELECT bb.*, bt.player_phone, p.dir_code FROM borlette_bets bb JOIN borlette_tickets bt ON bb.ticket_id=bt.id JOIN players p ON bt.player_phone=p.phone WHERE bb.draw=$1 AND bb.statut='actif'", [draw]);

    let totalPaid = 0;
    for (const bet of bets.rows) {
      let gain = 0;
      const n = bet.numero;
      if (bet.type_jeu === 'bolet') {
        if (n === lot1) gain = parseFloat(bet.montant) * MULTS.bolet_lot1;
        else if (n === lot2) gain = parseFloat(bet.montant) * MULTS.bolet_lot2;
        else if (n === lot3) gain = parseFloat(bet.montant) * MULTS.bolet_lot3;
      } else if (bet.type_jeu === 'mariage') {
        // mariage = 2 numéros dans même ticket (traité par ticket)
      }
      if (gain > 0) {
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, bet.player_phone]);
        await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain_borlette',$3,$4)",
          [bet.player_phone, bet.dir_code, gain, `Gain borlette ${draw}: #${n}`]);
        totalPaid += gain;
      }
      await client.query("UPDATE borlette_bets SET statut=$1, gain=$2 WHERE id=$3", [gain>0?'gagne':'perdu', gain, bet.id]);
    }
    // Clôturer les tickets
    await client.query("UPDATE borlette_tickets SET statut='clos' WHERE draw=$1", [draw]);
    await client.query('COMMIT');
    res.json({ success: true, draw, lot1, lot2, lot3, totalPaid, betsResolved: bets.rows.length });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── PARIS SPORTIFS: PLACER UN PARI ────────────────────────
app.post('/api/sports/bet', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const phone = req.session.user_phone;
    const { matchId, homeTeam, awayTeam, competition, prediction, cote, mise } = req.body;
    if (!matchId || !prediction || !mise || mise <= 0 || !cote) return res.status(400).json({ error: 'Données invalides' });

    await client.query('BEGIN');
    const { dirCode } = await deductAndRecord(client, phone, mise, 'Sport', `${homeTeam} vs ${awayTeam} → ${prediction}`);

    const gainPotentiel = Math.round(mise * parseFloat(cote) * 100) / 100;
    await client.query("INSERT INTO bets (player_phone, dir_code, type, game_type, mise, gain_potentiel, numeros_joues, statut, match_id, match_info) VALUES ($1,$2,'sport','sport',$3,$4,$5,'en_attente',$6,$7)",
      [phone, dirCode, mise, gainPotentiel, JSON.stringify([prediction]), matchId, JSON.stringify({homeTeam, awayTeam, competition, prediction, cote})]);

    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ success: true, gainPotentiel, newBalance, message: `Paris enregistré — Gain potentiel: ${gainPotentiel} Gd` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── JACKPOT: ÉTAT ET MISE À JOUR ──────────────────────────
app.get('/api/jackpot', async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM jackpot ORDER BY id DESC LIMIT 1");
    res.json({ jackpot: r.rows[0] || { montant: 0, last_winner: null } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ADMIN ───────────────────────────────────────────
// [DUPLICATE admin/stats supprimé]

// ── TABLES MANQUANTES (auto-create) ───────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS borlette_bets (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES borlette_tickets(id) ON DELETE CASCADE,
        player_phone TEXT,
        dir_code TEXT,
        numero TEXT NOT NULL,
        type_jeu TEXT DEFAULT 'bolet',
        montant REAL NOT NULL,
        gain REAL DEFAULT 0,
        draw TEXT DEFAULT '',
        statut TEXT DEFAULT 'actif',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS borlette_tickets (
        id SERIAL PRIMARY KEY,
        player_phone TEXT,
        dir_code TEXT,
        draw TEXT,
        ticket_ref TEXT UNIQUE,
        total_mise REAL,
        total_gain REAL DEFAULT 0,
        statut TEXT DEFAULT 'actif',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS borlette_blocked (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL,
        draw TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(number, draw)
      );
      CREATE TABLE IF NOT EXISTS borlette_limits (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL,
        draw TEXT DEFAULT '',
        max_amount REAL NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(number, draw)
      );
      CREATE TABLE IF NOT EXISTS jackpot (
        id SERIAL PRIMARY KEY,
        montant REAL DEFAULT 0,
        last_winner TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tables vérifiées/créées');
  } catch(e) { console.error('❌ Erreur création tables:', e.message); }
})();

// ============================================================
// ROUTE CATCH-ALL POUR LE FRONTEND (SPA) – À PLACER À LA FIN
// ============================================================
// ── DIAGNOSTIC retiré (flux retrait opérationnel) ──

// ── DÉMARRAGE SERVEUR ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});