// ============================================================
// server.js — Tonton Kondo Paryaj Backend
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
const JACKPOT_PCT       = 5; // 5%

// ── TABLE INIT (création automatique des tables) ───────────
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      user_code TEXT,
      user_phone TEXT,
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
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
      sub_type TEXT,
      selection TEXT,
      mise REAL,
      cote REAL,
      gain_potentiel REAL,
      draw TEXT,
      match_id TEXT,
      match_name TEXT,
      statut TEXT DEFAULT 'en_attente',
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
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
      dir_code TEXT REFERENCES directors(code),
      game_name TEXT NOT NULL,
      win_probability INTEGER DEFAULT 45,
      UNIQUE(dir_code, game_name)
    );
  `);
  console.log('✅ Tables vérifiées/créées');
})();

// ── HELPERS ────────────────────────────────────────────────
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getSession(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const r = await pool.query(
    "SELECT * FROM sessions WHERE id=$1 AND expires_at > NOW()",
    [token]
  );
  return r.rows[0] || null;
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
  const r = await pool.query(
    "SELECT win_probability FROM game_difficulty WHERE dir_code=$1 AND game_name=$2",
    [dirCode, gameName]
  );
  if (r.rows.length) return r.rows[0].win_probability;
  const def = await pool.query("SELECT value FROM settings WHERE key=$1", [`${gameName}_default_diff`]);
  if (def.rows.length) return parseInt(def.rows[0].value) || 45;
  return 45;
}

function isWin(probability) {
  const rand = Math.random() * 100;
  return rand <= probability;
}

function getKenoMultiplier(hits, selectedCount) {
  const table = {
    1: {1: 3},
    2: {2: 5},
    3: {3: 8},
    4: {4: 12},
    5: {5: 18},
    6: {6: 25, 5: 5, 4: 2},
    7: {7: 40, 6: 10, 5: 3},
    8: {8: 60, 7: 15, 6: 5},
    9: {9: 100, 8: 20, 7: 8},
    10: {10: 150, 9: 30, 8: 12}
  };
  return table[selectedCount]?.[hits] || 0;
}

async function callPlopPlop(endpoint, body) {
  const auth = Buffer.from(`${MERCHANT_CLIENT_ID}:${MERCHANT_SECRET_KEY}`).toString('base64');
  const response = await fetch(`${PLOPPLOP_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

// ============================================================
// ROUTES API (toutes commençant par /api)
// ============================================================

// ── SANTÉ ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ── AUTHENTIFICATION ──────────────────────────────────────
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { pwd } = req.body;
    if (pwd !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query("INSERT INTO sessions (id, role) VALUES ($1, 'admin')", [token]);
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
    await pool.query("INSERT INTO sessions (id, role, user_code) VALUES ($1, 'directeur', $2)", [token, dir.code]);
    res.json({ token, role: 'directeur', code: dir.code, name: dir.name, zone: dir.zone, pct: dir.pct });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/cashier', async (req, res) => {
  try {
    const { code, pwd } = req.body;
    const r = await pool.query(
      "SELECT c.*, d.name AS dir_name FROM cashiers c LEFT JOIN directors d ON c.dir_code=d.code WHERE c.code=$1 AND c.active=TRUE",
      [code.toUpperCase()]
    );
    const caiss = r.rows[0];
    if (!caiss) return res.status(401).json({ error: 'Code introuvable' });
    const ok = await bcrypt.compare(pwd, caiss.pwd_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query("INSERT INTO sessions (id, role, user_code) VALUES ($1, 'caissier', $2)", [token, caiss.code]);
    res.json({ token, role: 'caissier', code: caiss.code, name: caiss.name, dirCode: caiss.dir_code, jeu: caiss.jeu });
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
    await pool.query("INSERT INTO sessions (id, role, user_phone) VALUES ($1, 'joueur', $2)", [token, player.phone]);
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
const COMPETITIONS = ['PL','PD','BL1','SA','FL1','CL','ELC','PPL','DED','BSA','CLI'];
const COMP_LABELS = {
  PL:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', PD:'🇪🇸 La Liga', BL1:'🇩🇪 Bundesliga',
  SA:'🇮🇹 Serie A', FL1:'🇫🇷 Ligue 1', CL:'🏆 Champions League',
  ELC:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', PPL:'🇵🇹 Primeira Liga',
  DED:'🇳🇱 Eredivisie', BSA:'🇧🇷 Brasileirão', CLI:'🌎 Copa Libertadores',
};

function formatMatch(match, compCode) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name || '?';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || '?';
  const status = match.status;
  const isLive = ['IN_PLAY','PAUSED'].includes(status);
  const score = match.score?.fullTime || match.score?.halfTime || {home:0,away:0};
  return {
    id: match.id,
    lk: compCode.toLowerCase(),
    lg: COMP_LABELS[compCode] || compCode,
    t1: home,
    t2: away,
    s1: score.home || 0,
    s2: score.away || 0,
    time: isLive ? 'LIVE' : (match.utcDate ? new Date(match.utcDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''),
    live: isLive,
    status: status,
    utcDate: match.utcDate,
    odds: [2.00, 3.20, 3.50],
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
    const in7 = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
    for (const comp of COMPETITIONS) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${today}&dateTo=${in7}`;
        const r = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
        if (!r.ok) continue;
        const data = await r.json();
        if (data.matches) allMatches.push(...data.matches.map(m => formatMatch(m, comp)));
      } catch (e) { console.error(`Failed ${comp}:`, e.message); }
    }
    allMatches.sort((a,b) => {
      if (a.live && !b.live) return -1;
      if (!a.live && b.live) return 1;
      return new Date(a.utcDate||0) - new Date(b.utcDate||0);
    });
    matchCache = { data: allMatches, updatedAt: now };
    res.json({ matches: allMatches, count: allMatches.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const reference_id = `TK_${phone}_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const plopData = await callPlopPlop('/api/paiement-marchand', {
      client_id: MERCHANT_CLIENT_ID,
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
    const verifyData = await callPlopPlop('/api/paiement-verify', { client_id: MERCHANT_CLIENT_ID, refference_id: referenceId });
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

app.get('/api/admin/cashiers', requireAdmin, async (req, res) => {
  const r = await pool.query("SELECT c.*, d.name AS dir_name FROM cashiers c LEFT JOIN directors d ON c.dir_code=d.code ORDER BY c.created_at");
  res.json({ cashiers: r.rows });
});

app.post('/api/admin/cashiers', requireAdmin, async (req, res) => {
  const { name, code, dir_code, phone, pwd, jeu } = req.body;
  if (!name||!code||!pwd) return res.status(400).json({ error: 'Champs obligatoires' });
  const hash = await bcrypt.hash(pwd, 10);
  const r = await pool.query("INSERT INTO cashiers (name,code,dir_code,phone,pwd_hash,jeu) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [name, code.toUpperCase(), dir_code, phone||'', hash, jeu||'all']);
  res.json({ success: true, cashier: r.rows[0] });
});

app.delete('/api/admin/cashiers/:code', requireAdmin, async (req, res) => {
  await pool.query("UPDATE cashiers SET active=FALSE WHERE code=$1", [req.params.code]);
  res.json({ success: true });
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

app.post('/api/admin/settings/game-diff', requireAdmin, async (req, res) => {
  const { dir_code, game_name, win_probability } = req.body;
  if (!game_name || win_probability === undefined) return res.status(400).json({ error: 'Données manquantes' });
  if (dir_code) {
    await pool.query(`INSERT INTO game_difficulty (dir_code, game_name, win_probability) VALUES ($1, $2, $3) ON CONFLICT (dir_code, game_name) DO UPDATE SET win_probability=$3`, [dir_code, game_name, win_probability]);
  } else {
    await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2`, [`${game_name}_default_diff`, win_probability.toString()]);
  }
  res.json({ success: true });
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
app.post('/api/games/keno/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { numbers, mise } = req.body;
    const phone = req.session.user_phone;
    if (!numbers || !numbers.length || numbers.length > 10) throw new Error('Sélection invalide');
    if (mise <= 0) throw new Error('Mise invalide');
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    const proba = await getWinProbability(dirCode, 'keno');
    const gainPossible = isWin(proba);
    const allNumbers = Array.from({length: 80}, (_,i) => i+1);
    const shuffled = [...allNumbers];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const winningNumbers = shuffled.slice(0, 20);
    const hits = numbers.filter(n => winningNumbers.includes(parseInt(n))).length;
    const multiplier = getKenoMultiplier(hits, numbers.length);
    const gain = gainPossible ? mise * multiplier : 0;
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)", [phone, dirCode, -mise, `Mise Keno`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)", [phone, dirCode, gain, `Gain Keno (${hits} numéros)`]);
    await client.query("INSERT INTO bets (player_phone, dir_code, type, selection, mise, gain_potentiel, statut) VALUES ($1, $2, 'keno', $3, $4, $5, $6)", [phone, dirCode, numbers.join(','), mise, gain, gain > 0 ? 'gagne' : 'perdu']);
    if (dirCode) {
      await client.query(`INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`, [dirCode, mise * JACKPOT_PCT / 100, mise]);
    }
    const newBalance = player.rows[0].solde - mise + gain;
    res.json({ success: true, newBalance, message: gain > 0 ? `Félicitations ! ${hits} numéros trouvés, gain de ${gain} Gd` : `Dommage, aucun gain cette fois.`, gain, winningNumbers });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/lucky6/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { numbers, mise } = req.body;
    const phone = req.session.user_phone;
    if (!numbers || numbers.length !== 6) throw new Error('Sélectionnez exactement 6 numéros');
    if (mise <= 0) throw new Error('Mise invalide');
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    const proba = await getWinProbability(dirCode, 'lucky6');
    const won = isWin(proba);
    const all = Array.from({length: 48}, (_,i) => i+1);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const winningNumbers = all.slice(0, 6);
    const hits = numbers.filter(n => winningNumbers.includes(parseInt(n))).length;
    let gain = 0;
    if (won && hits >= 3) {
      if (hits === 3) gain = mise * 2;
      else if (hits === 4) gain = mise * 10;
      else if (hits === 5) gain = mise * 50;
      else if (hits === 6) gain = mise * 200;
    }
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)", [phone, dirCode, -mise, `Mise Lucky6`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)", [phone, dirCode, gain, `Gain Lucky6 (${hits} numéros)`]);
    await client.query("INSERT INTO bets (player_phone, dir_code, type, selection, mise, gain_potentiel, statut) VALUES ($1, $2, 'lucky6', $3, $4, $5, $6)", [phone, dirCode, numbers.join(','), mise, gain, gain > 0 ? 'gagne' : 'perdu']);
    if (dirCode) {
      await client.query(`INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`, [dirCode, mise * JACKPOT_PCT / 100, mise]);
    }
    const newBalance = player.rows[0].solde - mise + gain;
    res.json({ success: true, newBalance, message: gain > 0 ? `Bravo ! ${hits} numéros, gain ${gain} Gd` : `Perdu... vous avez ${hits} bon(s) numéro(s).`, gain, winningNumbers });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/games/course/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { carId, mise } = req.body;
    const phone = req.session.user_phone;
    if (!carId) throw new Error('Choisissez une voiture');
    if (mise <= 0) throw new Error('Mise invalide');
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');
    const dirCode = player.rows[0].dir_code;
    const proba = await getWinProbability(dirCode, 'course');
    const won = isWin(proba);
    const odds = {1: 2.10, 2: 1.75, 3: 2.50, 4: 3.20, 5: 4.00, 6: 5.50};
    const cote = odds[carId] || 2.0;
    const gain = won ? mise * cote : 0;
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)", [phone, dirCode, -mise, `Mise Course voiture ${carId}`]);
    if (gain > 0) await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)", [phone, dirCode, gain, `Gain Course (cote ${cote})`]);
    await client.query("INSERT INTO bets (player_phone, dir_code, type, selection, mise, cote, gain_potentiel, statut) VALUES ($1, $2, 'course', $3, $4, $5, $6, $7)", [phone, dirCode, `Voiture ${carId}`, mise, cote, gain, gain > 0 ? 'gagne' : 'perdu']);
    if (dirCode) {
      await client.query(`INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`, [dirCode, mise * JACKPOT_PCT / 100, mise]);
    }
    const newBalance = player.rows[0].solde - mise + gain;
    const ranking = [
      { id: 1, name: "🔴 Ferrari SF-23" }, { id: 2, name: "🔵 Red Bull RB19" }, { id: 3, name: "⚫ Mercedes W14" },
      { id: 4, name: "🟠 McLaren MCL60" }, { id: 5, name: "🟢 Aston Martin" }, { id: 6, name: "🩵 Alpine A523" }
    ];
    const winnerIndex = won ? ranking.findIndex(r => r.id == carId) : Math.floor(Math.random() * ranking.length);
    const winner = ranking[winnerIndex];
    ranking.splice(winnerIndex, 1);
    ranking.unshift(winner);
    res.json({ success: true, newBalance, message: gain > 0 ? `Votre voiture a gagné ! Gain ${gain} Gd` : `Pas de chance, votre voiture n'a pas gagné.`, gain, ranking });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// Hélicoptère – sessions en mémoire
let helicoSessions = new Map();
app.post('/api/games/helico/start', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { mise } = req.body;
    const phone = req.session.user_phone;
    if (!mise || mise <= 0) throw new Error('Mise invalide');
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    await client.query("INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)", [phone, player.rows[0].dir_code, -mise, `Mise Hélicoptère`]);
    const dirCode = player.rows[0].dir_code;
    const sessionId = crypto.randomBytes(16).toString('hex');
    helicoSessions.set(sessionId, { phone, mise, dirCode, altitude: 0, crashed: false });
    const newBalance = player.rows[0].solde - mise;
    res.json({ success: true, sessionId, newBalance, message: 'Décollage ! Montez et encaissez avant le crash.' });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
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

app.post('/api/games/helico/update', requireAuth, async (req, res) => {
  const { sessionId, altitude } = req.body;
  const session = helicoSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session introuvable' });
  if (session.crashed) return res.json({ crashed: true });
  const crashProb = Math.min(0.8, altitude / 150);
  const crash = Math.random() < crashProb;
  if (crash) {
    session.crashed = true;
    helicoSessions.delete(sessionId);
    return res.json({ crashed: true, altitude: session.altitude });
  }
  session.altitude = altitude;
  res.json({ crashed: false, altitude: session.altitude });
});

// ── AUTRES ROUTES API ──────────────────────────────────────
app.get('/api/bets', requireAuth, async (req, res) => {
  let query = `SELECT b.*, p.name AS player_name FROM bets b LEFT JOIN players p ON b.player_phone = p.phone`;
  let params = [];
  if (req.session.role === 'joueur') { query += ` WHERE b.player_phone = $1`; params.push(req.session.user_phone); }
  query += ` ORDER BY b.created_at DESC LIMIT 200`;
  const r = await pool.query(query, params);
  res.json({ bets: r.rows });
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  let q, params = [];
  if (req.session.role === 'joueur') {
    q = "SELECT * FROM transactions WHERE player_phone=$1 ORDER BY created_at DESC LIMIT 200";
    params = [req.session.user_phone];
  } else {
    q = "SELECT t.*, p.name AS player_name FROM transactions t LEFT JOIN players p ON t.player_phone=p.phone ORDER BY t.created_at DESC LIMIT 300";
  }
  const r = await pool.query(q, params);
  res.json({ transactions: r.rows });
});

app.get('/api/player/solde', requireAuth, async (req, res) => {
  if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
  const r = await pool.query("SELECT solde FROM players WHERE phone=$1", [req.session.user_phone]);
  res.json({ solde: parseFloat(r.rows[0]?.solde||0) });
});

// ── BORLETTE: BLOCAGES ────────────────────────────────────
app.get('/api/borlette/blocked', requireAuth, async (req, res) => {
  try { const r = await pool.query("SELECT * FROM borlette_blocked ORDER BY created_at DESC"); res.json({ blocked: r.rows }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/borlette/block', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  const { number, draw } = req.body;
  await pool.query("INSERT INTO borlette_blocked (number,draw) VALUES ($1,$2) ON CONFLICT (number,draw) DO NOTHING", [String(number).padStart(2,'0'), draw||'']);
  res.json({ success: true });
});
app.delete('/api/borlette/block/:id', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  await pool.query("DELETE FROM borlette_blocked WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ── BORLETTE: LIMITES ─────────────────────────────────────
app.get('/api/borlette/limits', requireAuth, async (req, res) => {
  try { const r = await pool.query("SELECT * FROM borlette_limits ORDER BY number"); res.json({ limits: r.rows }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/borlette/limit', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  const { number, draw, max_amount } = req.body;
  await pool.query("INSERT INTO borlette_limits (number,draw,max_amount) VALUES ($1,$2,$3) ON CONFLICT (number,draw) DO UPDATE SET max_amount=$3,updated_at=NOW()", [String(number).padStart(2,'0'), draw||'', max_amount]);
  res.json({ success: true });
});
app.delete('/api/borlette/limit/:id', requireAuth, async (req, res) => {
  if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
  await pool.query("DELETE FROM borlette_limits WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ── BORLETTE: PUBLIER RÉSULTAT (ADMIN) ───────────────────
app.post('/api/borlette/publish', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','directeur','caissier'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { draw, lotto3, lot2, lot3 } = req.body;
    if (!draw || !lotto3 || lotto3.length !== 3) return res.status(400).json({ error: 'draw et lotto3 (3 chiffres) requis' });
    const lot1 = lotto3.slice(1); // 2 derniers chiffres
    await client.query('BEGIN');
    await client.query(`INSERT INTO borlette_results (draw,lotto3,lot1,lot2,lot3,resolved_by,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [draw, lotto3, lot1, lot2||'', lot3||'', req.session.user_phone||req.session.user_code]);
    const MULTS = { bolet_lot1:50, bolet_lot2:25, bolet_lot3:10, lotto3:500, lotto2:80 };
    const betsQ = await client.query(`SELECT bb.*, bt.player_phone, p.dir_code FROM borlette_bets bb
      JOIN borlette_tickets bt ON bb.ticket_id=bt.id
      JOIN players p ON bt.player_phone=p.phone
      WHERE bb.draw=$1 AND bb.statut='actif'`, [draw]);
    let totalPaid=0, resolved=0;
    for (const bet of betsQ.rows) {
      const n = bet.numero, m = parseFloat(bet.montant);
      let gain = 0;
      if (bet.type_jeu==='bolet') {
        if (n===lot1) gain = m * MULTS.bolet_lot1;
        else if (lot2 && n===lot2.padStart(2,'0')) gain = m * MULTS.bolet_lot2;
        else if (lot3 && n===lot3.padStart(2,'0')) gain = m * MULTS.bolet_lot3;
      } else if (bet.type_jeu==='lotto3' && n===lotto3) { gain = m * MULTS.lotto3; }
      else if (bet.type_jeu==='lotto2' && lot2 && n===lot2.padStart(2,'0')) { gain = m * MULTS.lotto2; }
      await client.query("UPDATE borlette_bets SET statut=$1,gain=$2 WHERE id=$3", [gain>0?'gagne':'perdu', gain, bet.id]);
      if (gain>0) {
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, bet.player_phone]);
        await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain_borlette',$3,$4)",
          [bet.player_phone, bet.dir_code, gain, `Gain borlette ${draw} #${n} ×${gain/m}`]);
        totalPaid += gain;
      }
      resolved++;
    }
    await client.query("UPDATE borlette_tickets SET statut='clos' WHERE draw=$1 AND statut='actif'", [draw]);
    await client.query('COMMIT');
    res.json({ success:true, draw, lot1, lot2:lot2||'', lot3:lot3||'', lotto3, resolved, totalPaid });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/borlette/results', async (req, res) => {
  try {
    const draw = req.query.draw;
    let q = "SELECT * FROM borlette_results", params=[];
    if (draw) { q += " WHERE draw=$1"; params.push(draw); }
    q += " ORDER BY created_at DESC LIMIT 50";
    res.json({ results: (await pool.query(q,params)).rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RETRAITS JOUEUR ───────────────────────────────────────
app.post('/api/retraits/demande', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role !== 'joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { montant, methode, numero_mobile } = req.body;
    if (!montant || montant < 50) return res.status(400).json({ error: 'Minimum 50 Gourdes' });
    if (!['moncash','natcash','cash'].includes(methode)) return res.status(400).json({ error: 'Méthode invalide' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(pr.rows[0].solde) < montant) throw new Error('Solde insuffisant');
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [montant, phone]);
    const r = await client.query("INSERT INTO retraits (player_phone,dir_code,montant,methode,numero_mobile,statut) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id",
      [phone, pr.rows[0].dir_code, montant, methode, numero_mobile||phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'retrait_demande',$3,$4)",
      [phone, pr.rows[0].dir_code, -montant, `Demande retrait ${methode} — en attente`]);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde;
    res.json({ success:true, retrait_id:r.rows[0].id, newSolde:parseFloat(newSolde) });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/retraits', requireAuth, async (req, res) => {
  let q = "SELECT rt.*,p.name AS player_name FROM retraits rt LEFT JOIN players p ON rt.player_phone=p.phone WHERE 1=1";
  const params = [];
  if (req.session.role==='joueur') { params.push(req.session.user_phone); q += ` AND rt.player_phone=$${params.length}`; }
  else if (req.session.role==='directeur') { params.push(req.session.user_code); q += ` AND rt.dir_code=$${params.length}`; }
  q += " ORDER BY rt.created_at DESC LIMIT 100";
  res.json({ retraits: (await pool.query(q,params)).rows });
});

app.post('/api/retraits/:id/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM retraits WHERE id=$1 AND statut='pending' FOR UPDATE", [req.params.id]);
    if (!r.rows.length) throw new Error('Retrait introuvable');
    await client.query("UPDATE retraits SET statut='approved',updated_at=NOW() WHERE id=$1", [req.params.id]);
    await client.query('COMMIT');
    res.json({ success:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/retraits/:id/reject', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','caissier','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM retraits WHERE id=$1 AND statut='pending' FOR UPDATE", [req.params.id]);
    if (!r.rows.length) throw new Error('Retrait introuvable');
    const rt = r.rows[0];
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [rt.montant, rt.player_phone]);
    await client.query("UPDATE retraits SET statut='rejected',updated_at=NOW() WHERE id=$1", [req.params.id]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'remboursement',$3,'Retrait rejeté — remboursé')",
      [rt.player_phone, rt.dir_code, rt.montant]);
    await client.query('COMMIT');
    res.json({ success:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── CAISSIER: RECHARGE / RETRAIT CASH ────────────────────
app.post('/api/cashier/recharge', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['caissier','directeur','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { player_phone, montant, methode, note } = req.body;
    if (!player_phone || !montant || montant<=0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [player_phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    const caiss_code = req.session.role==='caissier' ? req.session.user_code : null;
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [montant, player_phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,caiss_code,type,montant,note) VALUES ($1,$2,$3,'depot',$4,$5)",
      [player_phone, pr.rows[0].dir_code, caiss_code, montant, note||`Rechargement ${methode||'cash'}`]);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[player_phone])).rows[0].solde;
    res.json({ success:true, newSolde:parseFloat(newSolde) });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/cashier/retrait', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['caissier','directeur','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { player_phone, montant, note } = req.body;
    if (!player_phone || !montant || montant<=0) return res.status(400).json({ error: 'Données invalides' });
    await client.query('BEGIN');
    const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [player_phone]);
    if (!pr.rows.length) throw new Error('Joueur introuvable');
    if (parseFloat(pr.rows[0].solde) < montant) throw new Error('Solde insuffisant');
    const caiss_code = req.session.role==='caissier' ? req.session.user_code : null;
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [montant, player_phone]);
    await client.query("INSERT INTO transactions (player_phone,dir_code,caiss_code,type,montant,note) VALUES ($1,$2,$3,'retrait',$4,$5)",
      [player_phone, pr.rows[0].dir_code, caiss_code, -montant, note||'Retrait cash bureau']);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[player_phone])).rows[0].solde;
    res.json({ success:true, newSolde:parseFloat(newSolde) });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── JEUX CASINO ───────────────────────────────────────────
async function deductMise(client, phone, mise, type, note) {
  const pr = await client.query("SELECT solde,dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
  if (!pr.rows.length) throw new Error('Joueur introuvable');
  if (parseFloat(pr.rows[0].solde) < mise) throw new Error('Solde insuffisant');
  await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);
  await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'mise',$3,$4)",
    [phone, pr.rows[0].dir_code, -mise, note]);
  return pr.rows[0].dir_code;
}
async function creditGain(client, phone, dirCode, gain, note) {
  if (gain<=0) return;
  await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, phone]);
  await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,$4)",
    [phone, dirCode, gain, note]);
}

// KENO
app.post('/api/games/keno/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { numbers, mise } = req.body;
    if (!numbers||!numbers.length||!mise||mise<=0) return res.status(400).json({ error: 'Données invalides' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', `Keno ${numbers.length} numéros`);
    const pool80 = Array.from({length:80},(_,i)=>i+1);
    for (let i=pool80.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[pool80[i],pool80[j]]=[pool80[j],pool80[i]]; }
    const winningNumbers = pool80.slice(0,20);
    const hits = numbers.filter(n=>winningNumbers.includes(n)).length;
    const payouts = {1:{1:3},2:{1:1,2:9},3:{2:2,3:16},4:{2:2,3:6,4:40},5:{3:4,4:12,5:75},
      6:{3:3,4:8,5:25,6:150},7:{4:6,5:15,6:50,7:300},8:{4:5,5:10,6:30,7:100,8:700},
      9:{4:4,5:6,6:20,7:60,8:250,9:2000},10:{5:5,6:15,7:40,8:150,9:500,10:5000}};
    const mult = (payouts[numbers.length]||{})[hits]||0;
    const gain = mise * mult;
    if (gain>0) await creditGain(client, phone, dirCode, gain, `Gain Keno ${hits}/${numbers.length}`);
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,numeros_tires,statut) VALUES ($1,$2,'keno',$3,$4,$5,$6,$7)",
      [phone,dirCode,mise,gain,JSON.stringify(numbers),JSON.stringify(winningNumbers),gain>0?'gagne':'perdu']);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ winningNumbers, hits, gain, newBalance, message: gain>0?`🎉 ${hits}/${numbers.length} hits — Gain: ${gain} Gd`:`😔 ${hits}/${numbers.length} hits — Perdu` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// LUCKY 6
app.post('/api/games/lucky6/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { numbers, mise } = req.body;
    if (!numbers||numbers.length!==6||!mise||mise<=0) return res.status(400).json({ error: '6 numéros requis' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', 'Lucky6 6 numéros');
    const p48 = Array.from({length:48},(_,i)=>i+1);
    for (let i=p48.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[p48[i],p48[j]]=[p48[j],p48[i]]; }
    const winningNumbers = p48.slice(0,35);
    let hits=0, lastPos=-1;
    for (let i=0;i<winningNumbers.length;i++) {
      if (numbers.includes(winningNumbers[i])) { hits++; lastPos=i; }
      if (hits===6) break;
    }
    const gain = hits===6 ? Math.round(mise*Math.max(2,36-lastPos)) : 0;
    if (gain>0) await creditGain(client, phone, dirCode, gain, `Gain Lucky6 pos.${lastPos+1}`);
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,numeros_tires,statut) VALUES ($1,$2,'lucky6',$3,$4,$5,$6,$7)",
      [phone,dirCode,mise,gain,JSON.stringify(numbers),JSON.stringify(winningNumbers),hits===6?'gagne':'perdu']);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ winningNumbers, hits, gain, newBalance, message: hits===6?`🎉 Tous trouvés ! Gain: ${gain} Gd`:`😔 ${hits}/6 trouvés — Perdu` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// COURSE AUTO
app.post('/api/games/course/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { carId, mise } = req.body;
    if (!carId||!mise||mise<=0) return res.status(400).json({ error: 'Données invalides' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', `Course voiture #${carId}`);
    const cars = [1,2,3,4,5,6];
    for (let i=cars.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[cars[i],cars[j]]=[cars[j],cars[i]]; }
    const ranking = cars.map((id,pos)=>({id,position:pos+1}));
    const gagne = ranking[0].id === parseInt(carId);
    const gain = gagne ? Math.round(mise*3.5) : 0;
    if (gain>0) await creditGain(client, phone, dirCode, gain, `Gain Course voiture #${carId}`);
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,numeros_tires,statut) VALUES ($1,$2,'course',$3,$4,$5,$6,$7)",
      [phone,dirCode,mise,gain,JSON.stringify([carId]),JSON.stringify(ranking.map(r=>r.id)),gagne?'gagne':'perdu']);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    const pos = ranking.findIndex(r=>r.id===parseInt(carId))+1;
    res.json({ ranking, gagne, gain, newBalance, message: gagne?`🏆 Voiture #${carId} gagne ! +${gain} Gd`:`😔 Voiture #${carId} — ${pos}ème` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// PENALTY
app.post('/api/games/penalty/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { direction, mise } = req.body;
    if (!direction||!mise||mise<=0) return res.status(400).json({ error: 'Données invalides' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', `Penalty ${direction}`);
    const dirs = ['gauche','centre','droite'];
    const goalieDir = dirs[Math.floor(Math.random()*3)];
    const gagne = direction !== goalieDir;
    const gain = gagne ? Math.round(mise*1.9) : 0;
    if (gain>0) await creditGain(client, phone, dirCode, gain, `Gain Penalty BUT ${direction}`);
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,numeros_tires,statut) VALUES ($1,$2,'penalty',$3,$4,$5,$6,$7)",
      [phone,dirCode,mise,gain,JSON.stringify([direction]),JSON.stringify([goalieDir]),gagne?'gagne':'perdu']);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ goalieDir, gagne, gain, newBalance, message: gagne?`⚽ BUT ! +${gain} Gd`:`🧤 Arrêté ! Gardien → ${goalieDir}` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ROULETTE
app.post('/api/games/roulette/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { betType, betValue, mise } = req.body;
    if (!betType||betValue===undefined||!mise||mise<=0) return res.status(400).json({ error: 'Données invalides' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', `Roulette ${betType}:${betValue}`);
    const result = Math.floor(Math.random()*37);
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const color = result===0?'vert':reds.includes(result)?'rouge':'noir';
    const parity = result===0?'zero':result%2===0?'pair':'impair';
    const dozen = result===0?0:result<=12?1:result<=24?2:3;
    const column = result===0?0:(result%3===0?3:result%3);
    let mult=0;
    if (betType==='number'&&parseInt(betValue)===result) mult=36;
    else if (betType==='color'&&betValue===color) mult=2;
    else if (betType==='parity'&&betValue===parity) mult=2;
    else if (betType==='dozen'&&parseInt(betValue)===dozen) mult=3;
    else if (betType==='column'&&parseInt(betValue)===column) mult=3;
    const gain = mult>0 ? Math.round(mise*mult) : 0;
    if (gain>0) await creditGain(client, phone, dirCode, gain, `Gain Roulette ${result}(${color}) ×${mult}`);
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,numeros_tires,statut) VALUES ($1,$2,'roulette',$3,$4,$5,$6,$7)",
      [phone,dirCode,mise,gain,JSON.stringify([betValue]),JSON.stringify([result]),gain>0?'gagne':'perdu']);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ result, color, parity, dozen, column, gain, newBalance, message: gain>0?`🎉 ${result} (${color}) — +${gain} Gd`:`😔 ${result} (${color}) — Perdu` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// PARIS SPORTIFS
app.post('/api/sports/bet', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.session.role!=='joueur') return res.status(403).json({ error: 'Joueurs seulement' });
    const { matchId, homeTeam, awayTeam, competition, prediction, cote, mise } = req.body;
    if (!matchId||!prediction||!mise||mise<=0||!cote) return res.status(400).json({ error: 'Données invalides' });
    const phone = req.session.user_phone;
    await client.query('BEGIN');
    const dirCode = await deductMise(client, phone, mise, 'mise', `Sport: ${homeTeam} vs ${awayTeam} → ${prediction}`);
    const gainPotentiel = Math.round(mise*parseFloat(cote)*100)/100;
    await client.query("INSERT INTO bets (player_phone,dir_code,game_type,mise,gain_potentiel,numeros_joues,statut,match_id,match_info) VALUES ($1,$2,'sport',$3,$4,$5,'en_attente',$6,$7)",
      [phone,dirCode,mise,gainPotentiel,JSON.stringify([prediction]),matchId,JSON.stringify({homeTeam,awayTeam,competition,prediction,cote})]);
    await client.query('COMMIT');
    const newBalance = parseFloat((await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde);
    res.json({ success:true, gainPotentiel, newBalance, message:`Paris enregistré — Gain potentiel: ${gainPotentiel} Gd` });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/bets/:id/resolve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!['admin','directeur'].includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    const { statut } = req.body;
    if (!['gagne','perdu'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
    await client.query('BEGIN');
    const br = await client.query("SELECT * FROM bets WHERE id=$1 AND statut='en_attente' FOR UPDATE", [req.params.id]);
    if (!br.rows.length) throw new Error('Pari introuvable');
    const bet = br.rows[0];
    await client.query("UPDATE bets SET statut=$1,resolved_at=NOW() WHERE id=$2", [statut, bet.id]);
    if (statut==='gagne') {
      const gain = parseFloat(bet.gain_potentiel)||0;
      if (gain>0) {
        await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [gain, bet.player_phone]);
        await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'gain',$3,'Gain pari sportif')", [bet.player_phone, bet.dir_code, gain]);
      }
    }
    await client.query('COMMIT');
    res.json({ success:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── ADMIN ─────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [players, bets, retraits] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COALESCE(SUM(solde),0) as solde_total FROM players WHERE role='joueur'"),
      pool.query("SELECT COUNT(*) as total, COALESCE(SUM(mise),0) as total_mise FROM bets WHERE created_at>NOW()-INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) as total FROM retraits WHERE statut='pending'"),
    ]);
    res.json({
      players: { total:parseInt(players.rows[0].total), solde_total:parseFloat(players.rows[0].solde_total) },
      bets_24h: { total:parseInt(bets.rows[0].total), total_mise:parseFloat(bets.rows[0].total_mise) },
      retraits_pending: parseInt(retraits.rows[0].total),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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
    await client.query("INSERT INTO transactions (player_phone,dir_code,type,montant,note) VALUES ($1,$2,'credit_admin',$3,$4)",
      [phone, pr.rows[0].dir_code, montant, note||'Crédit administrateur']);
    await client.query('COMMIT');
    const newSolde = (await pool.query("SELECT solde FROM players WHERE phone=$1",[phone])).rows[0].solde;
    res.json({ success:true, newSolde:parseFloat(newSolde) });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// ── TABLES AUTO-CREATE SUPPLÉMENTAIRES ────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS borlette_results (
        id SERIAL PRIMARY KEY, draw TEXT NOT NULL, lotto3 TEXT,
        lot1 TEXT NOT NULL, lot2 TEXT DEFAULT '', lot3 TEXT DEFAULT '',
        resolved_by TEXT, updated_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS borlette_tickets (
        id SERIAL PRIMARY KEY, player_phone TEXT, dir_code TEXT, draw TEXT,
        ticket_ref TEXT UNIQUE, total_mise REAL, statut TEXT DEFAULT 'actif',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS borlette_bets (
        id SERIAL PRIMARY KEY, ticket_id INTEGER, player_phone TEXT, dir_code TEXT,
        numero TEXT NOT NULL, type_jeu TEXT DEFAULT 'bolet', montant REAL NOT NULL,
        gain REAL DEFAULT 0, draw TEXT DEFAULT '', statut TEXT DEFAULT 'actif',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS borlette_blocked (
        id SERIAL PRIMARY KEY, number TEXT NOT NULL, draw TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(), UNIQUE(number,draw)
      );
      CREATE TABLE IF NOT EXISTS borlette_limits (
        id SERIAL PRIMARY KEY, number TEXT NOT NULL, draw TEXT DEFAULT '',
        max_amount REAL NOT NULL, updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(number,draw)
      );
      CREATE TABLE IF NOT EXISTS retraits (
        id SERIAL PRIMARY KEY, player_phone TEXT, dir_code TEXT,
        montant REAL NOT NULL, methode TEXT NOT NULL, numero_mobile TEXT,
        statut TEXT DEFAULT 'pending', note TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP
      );
    `);
    console.log('✅ Tables supplémentaires OK');
  } catch(e) { console.error('❌ Tables supplémentaires:', e.message); }
})();

// ── CATCH-ALL SPA ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Tonton Kondo API running on port ${PORT}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL missing'}`);
  console.log(`   Football API: ${FOOTBALL_API_KEY ? '✅ Set' : '❌ Missing'}`);
});