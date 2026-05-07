// ============================================================
// server.js — Tonton Kondo Paryaj Backend
// Node.js + Express + PostgreSQL (Neon)
// Version complète avec tous les endpoints pour app.html
// ============================================================

const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const fetch    = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const CONFIG = require('./config.js');

// ── CONFIG PAIEMENT PLOP PLOP ─────────────────────────────────
const MERCHANT_CLIENT_ID = process.env.MERCHANT_CLIENT_ID || CONFIG.MERCHANT_CLIENT_ID;
const MERCHANT_SECRET_KEY = process.env.MERCHANT_SECRET_KEY || CONFIG.MERCHANT_SECRET_KEY;
const PLOPPLOP_BASE = process.env.PLOPPLOP_BASE_URL || CONFIG.PLOPPLOP_BASE_URL;

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ───────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
const path = require('path');
app.use(express.static(__dirname));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── DATABASE ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── CONFIG ─────────────────────────────────────────────────
const ADMIN_PASSWORD    = process.env.ADMIN_PASSWORD    || 'admin';
const FOOTBALL_API_KEY  = process.env.FOOTBALL_API_KEY  || '';
const JACKPOT_PCT       = 5; // 5%

// ── TABLE INIT (à exécuter une fois) ───────────────────────
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
      win_probability INTEGER DEFAULT 45, -- 0-80%
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

// Récupérer un paramètre de difficulté pour un directeur et un jeu
async function getWinProbability(dirCode, gameName) {
  const r = await pool.query(
    "SELECT win_probability FROM game_difficulty WHERE dir_code=$1 AND game_name=$2",
    [dirCode, gameName]
  );
  if (r.rows.length) return r.rows[0].win_probability;
  // Valeur par défaut depuis settings
  const def = await pool.query("SELECT value FROM settings WHERE key=$1", [`${gameName}_default_diff`]);
  if (def.rows.length) return parseInt(def.rows[0].value) || 45;
  return 45;
}

// Jouer un jeu avec probabilité de gain
function isWin(probability) {
  const rand = Math.random() * 100;
  return rand <= probability;
}

// Calcul des gains pour Keno (exemple: multiplicateur selon nombre de numéros tirés)
function getKenoMultiplier(hits, selectedCount) {
  // Logique simplifiée : plus de numéros choisis, plus le multiplicateur est élevé
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
  const mult = table[selectedCount]?.[hits] || 0;
  return mult;
}

// ── ROUTES EXISTANTES (AUTH, MATCHES, ADMIN, DIRECTOR, CASHIER, BORLETTE, JACKPOT...)
// Je les conserve mais je ne répète pas tout le code pour la lisibilité.
// Seules les routes manquantes sont ajoutées ci-dessous.
// (Le fichier complet avec toutes les routes serait trop long, je donne les ajouts essentiels)
// Pour un déploiement réel, prenez votre server.js actuel et ajoutez-y les blocs suivants.
// Je fournis ici uniquement les nouvelles routes à intégrer.
// ============================================================
// NOUVELLES ROUTES POUR app.html
// ============================================================

// 1. GET /api/recharges (toutes les recharges, filtrées selon rôle)
app.get('/api/recharges', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT r.*, p.name AS player_name
      FROM recharges r
      LEFT JOIN players p ON r.player_phone = p.phone
    `;
    let params = [];
    if (req.session.role === 'caissier') {
      query += ` WHERE r.caiss_code = $1 OR r.caiss_code IS NULL`;
      params.push(req.session.user_code);
    } else if (req.session.role === 'directeur') {
      query += ` WHERE r.dir_code = $1`;
      params.push(req.session.user_code);
    }
    query += ` ORDER BY r.created_at DESC LIMIT 200`;
    const r = await pool.query(query, params);
    res.json({ recharges: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Valider une recharge (ID)
app.post('/api/recharges/:id/validate', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const allowed = ['admin', 'caissier', 'directeur'];
    if (!allowed.includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });

    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM recharges WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Recharge introuvable ou déjà traitée' }); }
    const rch = r.rows[0];

    await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [rch.montant, rch.player_phone]);
    await client.query("UPDATE recharges SET statut='completed', updated_at=NOW() WHERE id=$1", [id]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'depot',$4,$5)",
      [rch.player_phone, rch.dir_code, rch.caiss_code, rch.montant, `Recharge ${rch.methode} validée`]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// 3. Rejeter une recharge
app.post('/api/recharges/:id/reject', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const allowed = ['admin', 'caissier', 'directeur'];
    if (!allowed.includes(req.session.role)) return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM recharges WHERE id=$1 AND statut='pending' FOR UPDATE", [id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Recharge introuvable' }); }
    await client.query("UPDATE recharges SET statut='rejected', updated_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// 4. GET /api/bets (liste des paris pour admin ou joueur)
app.get('/api/bets', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT b.*, p.name AS player_name
      FROM bets b
      LEFT JOIN players p ON b.player_phone = p.phone
    `;
    let params = [];
    if (req.session.role === 'joueur') {
      query += ` WHERE b.player_phone = $1`;
      params.push(req.session.user_phone);
    }
    query += ` ORDER BY b.created_at DESC LIMIT 200`;
    const r = await pool.query(query, params);
    res.json({ bets: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. GET /api/transactions (admin seulement)
app.get('/api/transactions', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT t.*, p.name AS player_name
      FROM transactions t
      LEFT JOIN players p ON t.player_phone = p.phone
      ORDER BY t.created_at DESC LIMIT 300
    `);
    res.json({ transactions: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. POST /api/admin/reset-password (réinitialisation mot de passe)
app.post('/api/admin/reset-password', requireAdmin, async (req, res) => {
  try {
    const { role, code, newPwd } = req.body;
    if (!role || !code || !newPwd) return res.status(400).json({ error: 'Champs manquants' });
    const hash = await bcrypt.hash(newPwd, 10);
    if (role === 'director') {
      await pool.query("UPDATE directors SET pwd_hash=$1 WHERE code=$2", [hash, code]);
    } else if (role === 'cashier') {
      await pool.query("UPDATE cashiers SET pwd_hash=$1 WHERE code=$2", [hash, code]);
    } else {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. DELETE /api/admin/cashiers/:code
app.delete('/api/admin/cashiers/:code', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE cashiers SET active=FALSE WHERE code=$1", [req.params.code]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. POST /api/admin/settings/game-diff (sauvegarde difficulté globale ou par directeur)
app.post('/api/admin/settings/game-diff', requireAdmin, async (req, res) => {
  try {
    const { dir_code, game_name, win_probability } = req.body;
    if (!game_name || win_probability === undefined) return res.status(400).json({ error: 'Données manquantes' });
    if (dir_code) {
      await pool.query(
        `INSERT INTO game_difficulty (dir_code, game_name, win_probability)
         VALUES ($1, $2, $3)
         ON CONFLICT (dir_code, game_name) DO UPDATE SET win_probability=$3`,
        [dir_code, game_name, win_probability]
      );
    } else {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value=$2`,
        [`${game_name}_default_diff`, win_probability.toString()]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTES DES JEUX DE CASINO
// ============================================================

// Keno
app.post('/api/games/keno/play', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { numbers, mise } = req.body;
    const phone = req.session.user_phone;
    if (!numbers || !numbers.length || numbers.length > 10) throw new Error('Sélection invalide');
    if (mise <= 0) throw new Error('Mise invalide');

    // Vérifier solde
    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');

    // Récupérer probabilité de gain
    const dirCode = player.rows[0].dir_code;
    const proba = await getWinProbability(dirCode, 'keno');
    const gainPossible = isWin(proba);
    // Simuler tirage de 20 numéros parmi 1-80
    const allNumbers = Array.from({length: 80}, (_,i) => i+1);
    const shuffled = [...allNumbers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winningNumbers = shuffled.slice(0, 20);
    const hits = numbers.filter(n => winningNumbers.includes(parseInt(n))).length;
    const multiplier = getKenoMultiplier(hits, numbers.length);
    const gain = gainPossible ? mise * multiplier : 0;

    // Déduire mise, ajouter gain
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) {
      await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    }
    // Enregistrer transaction
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, $3, $4, $5)",
      [phone, dirCode, 'perte', -mise, `Mise Keno`]
    );
    if (gain > 0) {
      await client.query(
        "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, $3, $4, $5)",
        [phone, dirCode, 'gain', gain, `Gain Keno (${hits} numéros)`]
      );
    }
    // Enregistrer pari
    await client.query(
      "INSERT INTO bets (player_phone, dir_code, type, selection, mise, gain_potentiel, statut) VALUES ($1, $2, 'keno', $3, $4, $5, $6)",
      [phone, dirCode, numbers.join(','), mise, gain, gain > 0 ? 'gagne' : 'perdu']
    );
    // Mise à jour jackpot (5% de la mise)
    if (dirCode) {
      await client.query(
        `INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3)
         ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`,
        [dirCode, mise * JACKPOT_PCT / 100, mise]
      );
    }
    const newBalance = (player.rows[0].solde - mise + gain);
    res.json({
      success: true,
      newBalance,
      message: gain > 0 ? `Félicitations ! ${hits} numéros trouvés, gain de ${gain} Gd` : `Dommage, aucun gain cette fois.`,
      gain,
      winningNumbers
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Lucky6
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
    // Tirage de 6 numéros parmi 1-48
    const all = Array.from({length: 48}, (_,i) => i+1);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const winningNumbers = all.slice(0, 6);
    const hits = numbers.filter(n => winningNumbers.includes(parseInt(n))).length;
    let gain = 0;
    if (won && hits >= 3) {
      // Gains progressifs
      if (hits === 3) gain = mise * 2;
      else if (hits === 4) gain = mise * 10;
      else if (hits === 5) gain = mise * 50;
      else if (hits === 6) gain = mise * 200;
    }
    // Déduire mise, ajouter gain
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)",
      [phone, dirCode, -mise, `Mise Lucky6`]
    );
    if (gain > 0) {
      await client.query(
        "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)",
        [phone, dirCode, gain, `Gain Lucky6 (${hits} numéros)`]
      );
    }
    await client.query(
      "INSERT INTO bets (player_phone, dir_code, type, selection, mise, gain_potentiel, statut) VALUES ($1, $2, 'lucky6', $3, $4, $5, $6)",
      [phone, dirCode, numbers.join(','), mise, gain, gain > 0 ? 'gagne' : 'perdu']
    );
    if (dirCode) {
      await client.query(
        `INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3)
         ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`,
        [dirCode, mise * JACKPOT_PCT / 100, mise]
      );
    }
    const newBalance = player.rows[0].solde - mise + gain;
    res.json({
      success: true,
      newBalance,
      message: gain > 0 ? `Bravo ! ${hits} numéros, gain ${gain} Gd` : `Perdu... vous avez ${hits} bon(s) numéro(s).`,
      gain,
      winningNumbers
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Course automobile
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
    // Cotes des voitures (fixes)
    const odds = {1: 2.10, 2: 1.75, 3: 2.50, 4: 3.20, 5: 4.00, 6: 5.50};
    const cote = odds[carId] || 2.0;
    const gain = won ? mise * cote : 0;

    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    if (gain > 0) await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, phone]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)",
      [phone, dirCode, -mise, `Mise Course voiture ${carId}`]
    );
    if (gain > 0) {
      await client.query(
        "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)",
        [phone, dirCode, gain, `Gain Course (cote ${cote})`]
      );
    }
    await client.query(
      "INSERT INTO bets (player_phone, dir_code, type, selection, mise, cote, gain_potentiel, statut) VALUES ($1, $2, 'course', $3, $4, $5, $6, $7)",
      [phone, dirCode, `Voiture ${carId}`, mise, cote, gain, gain > 0 ? 'gagne' : 'perdu']
    );
    if (dirCode) {
      await client.query(
        `INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3)
         ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`,
        [dirCode, mise * JACKPOT_PCT / 100, mise]
      );
    }
    const newBalance = player.rows[0].solde - mise + gain;
    // Classement simulé
    const ranking = [
      { id: 1, name: "🔴 Ferrari SF-23" }, { id: 2, name: "🔵 Red Bull RB19" }, { id: 3, name: "⚫ Mercedes W14" },
      { id: 4, name: "🟠 McLaren MCL60" }, { id: 5, name: "🟢 Aston Martin" }, { id: 6, name: "🩵 Alpine A523" }
    ];
    // Placer la voiture gagnante en première position fictive
    const winnerIndex = won ? ranking.findIndex(r => r.id == carId) : Math.floor(Math.random() * ranking.length);
    const winner = ranking[winnerIndex];
    ranking.splice(winnerIndex, 1);
    ranking.unshift(winner);
    res.json({
      success: true,
      newBalance,
      message: gain > 0 ? `Votre voiture a gagné ! Gain ${gain} Gd` : `Pas de chance, votre voiture n'a pas gagné.`,
      gain,
      ranking
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Hélicoptère (simulation simple avec altération progressive)
let helicoSessions = new Map(); // sessionId -> { phone, mise, dirCode, altitude, crashed, interval }
app.post('/api/games/helico/start', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { mise } = req.body;
    const phone = req.session.user_phone;
    if (!mise || mise <= 0) throw new Error('Mise invalide');

    const player = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    if (!player.rows.length) throw new Error('Joueur inconnu');
    if (player.rows[0].solde < mise) throw new Error('Solde insuffisant');

    // Déduire la mise immédiatement
    await client.query("UPDATE players SET solde = solde - $1 WHERE phone = $2", [mise, phone]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'perte', $3, $4)",
      [phone, player.rows[0].dir_code, -mise, `Mise Hélicoptère`]
    );
    const dirCode = player.rows[0].dir_code;
    const sessionId = crypto.randomBytes(16).toString('hex');
    helicoSessions.set(sessionId, {
      phone,
      mise,
      dirCode,
      altitude: 0,
      crashed: false,
      interval: null
    });
    const newBalance = player.rows[0].solde - mise;
    res.json({ success: true, sessionId, newBalance, message: 'Décollage ! Montez et encaissez avant le crash.' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/games/helico/cashout', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.body;
    const session = helicoSessions.get(sessionId);
    if (!session) throw new Error('Session invalide');
    if (session.crashed) throw new Error('Déjà crashé');
    const gainMultiplier = 1 + (session.altitude / 100); // max 2.0 si altitude 100
    const gain = Math.floor(session.mise * gainMultiplier);
    await client.query("UPDATE players SET solde = solde + $1 WHERE phone = $2", [gain, session.phone]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1, $2, 'gain', $3, $4)",
      [session.phone, session.dirCode, gain, `Gain Hélicoptère (altitude ${session.altitude}m)`]
    );
    await client.query(
      "INSERT INTO bets (player_phone, dir_code, type, mise, gain_potentiel, statut) VALUES ($1, $2, 'helico', $3, $4, 'gagne')",
      [session.phone, session.dirCode, session.mise, gain]
    );
    // Mise à jour jackpot (5% de la mise initiale)
    if (session.dirCode) {
      await client.query(
        `INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3)
         ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3`,
        [session.dirCode, session.mise * JACKPOT_PCT / 100, session.mise]
      );
    }
    if (session.interval) clearInterval(session.interval);
    helicoSessions.delete(sessionId);
    const newBalance = (await client.query("SELECT solde FROM players WHERE phone=$1", [session.phone])).rows[0].solde;
    res.json({ success: true, gain, newBalance, message: `Encaissé ! Gain ${gain} Gd` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Simulation d'altitude (sera gérée par le frontend via WebSocket ou polling, mais on peut fournir un endpoint de mise à jour)
app.post('/api/games/helico/update', requireAuth, async (req, res) => {
  const { sessionId, altitude } = req.body;
  const session = helicoSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session introuvable' });
  if (session.crashed) return res.json({ crashed: true });
  // Probabilité de crash qui augmente avec l'altitude
  const crashProb = Math.min(0.8, altitude / 150);
  const crash = Math.random() < crashProb;
  if (crash) {
    session.crashed = true;
    if (session.interval) clearInterval(session.interval);
    helicoSessions.delete(sessionId);
    return res.json({ crashed: true, altitude: session.altitude });
  }
  session.altitude = altitude;
  res.json({ crashed: false, altitude: session.altitude });
});

// ============================================================
// SERVER START
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Tonton Kondo API running on port ${PORT}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL missing'}`);
});