// ============================================================
// server.js — Tonton Kondo Paryaj Backend
// Node.js + Express + PostgreSQL (Neon)
// ============================================================

const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const fetch    = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ───────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── DATABASE ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

// ── CONFIG ─────────────────────────────────────────────────
const ADMIN_PASSWORD    = process.env.ADMIN_PASSWORD    || 'admin';
const SECRET_STAFF_CODE = process.env.SECRET_STAFF_CODE || 'TONTONKONDO12';
const FOOTBALL_API_KEY  = process.env.FOOTBALL_API_KEY  || '369f772ca235e44f4d4b743c2df1cac8';
const JACKPOT_PCT       = 5; // 5%

// Football-data.org competition codes (free tier)
const COMPETITIONS = ['PL','PD','BL1','SA','FL1','CL'];
const COMP_LABELS  = {
  PL:  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  PD:  '🇪🇸 La Liga',
  BL1: '🇩🇪 Bundesliga',
  SA:  '🇮🇹 Serie A',
  FL1: '🇫🇷 Ligue 1',
  CL:  '🏆 Champions League',
};

// ── HELPERS ────────────────────────────────────────────────
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getSession(req) {
  const token = req.headers['x-session-token'] || req.query.token;
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

function formatMatch(match, compCode) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name || '?';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || '?';
  const status = match.status; // SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED
  const isLive = ['IN_PLAY','PAUSED'].includes(status);
  const score = match.score?.fullTime || match.score?.halfTime || {home:0,away:0};
  const minute = match.minute || '';
  return {
    id:    match.id,
    lk:    compCode.toLowerCase(),
    lg:    COMP_LABELS[compCode] || compCode,
    t1:    home,
    t2:    away,
    f1:    '⚽',
    f2:    '⚽',
    s1:    score.home || 0,
    s2:    score.away || 0,
    time:  isLive ? (minute ? `${minute}'` : 'LIVE') : (match.utcDate ? new Date(match.utcDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''),
    live:  isLive,
    status: status,
    utcDate: match.utcDate,
    odds:  [2.00, 3.20, 3.50], // Default odds - real odds need premium API
    mkt:   12,
  };
}

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Tonton Kondo API', version: '1.0.0' });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================

// ── LOGIN ADMIN ────────────────────────────────────────────
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { pwd } = req.body;
    if (pwd !== ADMIN_PASSWORD)
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query(
      "INSERT INTO sessions (id, role) VALUES ($1, 'admin')",
      [token]
    );
    res.json({ token, role: 'admin', name: 'Administrateur' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LOGIN DIRECTEUR ────────────────────────────────────────
app.post('/api/auth/director', async (req, res) => {
  try {
    const { code, pwd } = req.body;
    const r = await pool.query(
      "SELECT * FROM directors WHERE code=$1 AND active=TRUE", [code.toUpperCase()]
    );
    const dir = r.rows[0];
    if (!dir) return res.status(401).json({ error: 'Code introuvable' });
    const ok = await bcrypt.compare(pwd, dir.pwd_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query(
      "INSERT INTO sessions (id, role, user_code) VALUES ($1, 'directeur', $2)",
      [token, dir.code]
    );
    res.json({ token, role: 'directeur', code: dir.code, name: dir.name, zone: dir.zone, pct: dir.pct });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LOGIN CAISSIER ─────────────────────────────────────────
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
    await pool.query(
      "INSERT INTO sessions (id, role, user_code) VALUES ($1, 'caissier', $2)",
      [token, caiss.code]
    );
    res.json({ token, role: 'caissier', code: caiss.code, name: caiss.name, dirCode: caiss.dir_code, jeu: caiss.jeu });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LOGIN JOUEUR ───────────────────────────────────────────
app.post('/api/auth/player', async (req, res) => {
  try {
    const { phone, pwd } = req.body;
    const r = await pool.query(
      "SELECT * FROM players WHERE phone=$1 AND active=TRUE", [phone]
    );
    const player = r.rows[0];
    if (!player) return res.status(401).json({ error: 'Numéro introuvable' });
    const ok = await bcrypt.compare(pwd, player.pwd_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = genToken();
    await pool.query(
      "INSERT INTO sessions (id, role, user_phone) VALUES ($1, 'joueur', $2)",
      [token, player.phone]
    );
    res.json({ token, role: 'joueur', phone: player.phone, name: player.name, solde: parseFloat(player.solde), dirCode: player.dir_code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── REGISTER JOUEUR ────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, pwd, dirCode, caissCode } = req.body;
    if (!name || !phone || !pwd)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
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

// ── LOGOUT ─────────────────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) await pool.query("DELETE FROM sessions WHERE id=$1", [token]);
  res.json({ success: true });
});

// ── VERIFY SESSION ─────────────────────────────────────────
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

// ============================================================
// FOOTBALL / SPORTS ROUTES
// ============================================================

// Cache pour éviter de dépasser les limites API
let matchCache = { data: [], updatedAt: 0 };
const CACHE_TTL = 60 * 1000; // 60 secondes

app.get('/api/matches', async (req, res) => {
  try {
    const now = Date.now();
    if (now - matchCache.updatedAt < CACHE_TTL && matchCache.data.length) {
      return res.json({ matches: matchCache.data, cached: true });
    }

    const allMatches = [];
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];

    // Fetch live + today's matches
    for (const comp of COMPETITIONS) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${today}&dateTo=${tomorrow}&status=SCHEDULED,IN_PLAY,LIVE,PAUSED`;
        const r = await fetch(url, {
          headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
          timeout: 5000,
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (data.matches) {
          const formatted = data.matches.map(m => formatMatch(m, comp));
          allMatches.push(...formatted);
        }
      } catch (e) {
        console.error(`Failed to fetch ${comp}:`, e.message);
      }
    }

    // Sort: live first, then by time
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

// Match details / H2H
app.get('/api/matches/:id/h2h', async (req, res) => {
  try {
    const url = `https://api.football-data.org/v4/matches/${req.params.id}/head2head?limit=5`;
    const r = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
    if (!r.ok) return res.status(r.status).json({ error: 'API error' });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// PLAYER ROUTES
// ============================================================

// Get player info + balance
app.get('/api/player/me', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'joueur')
      return res.status(403).json({ error: 'Joueur seulement' });
    const r = await pool.query(
      "SELECT name, phone, solde, dir_code, caiss_code, created_at FROM players WHERE phone=$1",
      [req.session.user_phone]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get player bet history
app.get('/api/player/bets', requireAuth, async (req, res) => {
  try {
    const phone = req.session.role === 'joueur'
      ? req.session.user_phone
      : req.query.phone;
    const limit = parseInt(req.query.limit) || 50;
    const r = await pool.query(
      "SELECT * FROM bets WHERE player_phone=$1 ORDER BY created_at DESC LIMIT $2",
      [phone, limit]
    );
    res.json({ bets: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get player transactions
app.get('/api/player/transactions', requireAuth, async (req, res) => {
  try {
    const phone = req.session.role === 'joueur'
      ? req.session.user_phone
      : req.query.phone;
    const r = await pool.query(
      "SELECT * FROM transactions WHERE player_phone=$1 ORDER BY created_at DESC LIMIT 100",
      [phone]
    );
    res.json({ transactions: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Place a bet
app.post('/api/bets/place', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, sub_type, selection, mise, cote, draw, match_id, match_name } = req.body;
    if (!type || !selection || !mise)
      return res.status(400).json({ error: 'Données manquantes' });

    let phone, dir_code, caiss_code;
    if (req.session.role === 'joueur') {
      phone = req.session.user_phone;
    } else if (req.session.role === 'caissier') {
      phone = req.body.player_phone;
      const c = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [req.session.user_code]);
      caiss_code = req.session.user_code;
      dir_code = c.rows[0]?.dir_code;
    } else {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await client.query('BEGIN');

    // Check player balance
    const pr = await client.query("SELECT solde, dir_code FROM players WHERE phone=$1 FOR UPDATE", [phone]);
    const player = pr.rows[0];
    if (!player) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Joueur introuvable' }); }
    if (parseFloat(player.solde) < parseFloat(mise))
      { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Solde insuffisant' }); }

    if (!dir_code) dir_code = player.dir_code;

    // Check borlette limits/blocked
    if (type === 'borlette') {
      const num = String(selection).padStart(2,'0');
      const drawKey = draw ? draw.toLowerCase().replace(/\s/g,'') : '';
      const blocked = await client.query(
        "SELECT id FROM borlette_blocked WHERE (number=$1 AND draw='' ) OR (number=$1 AND draw=$2)",
        [num, drawKey]
      );
      if (blocked.rows.length)
        { await client.query('ROLLBACK'); return res.status(400).json({ error: `Numéro ${num} bloqué` }); }

      const limits = await client.query(
        "SELECT max_amount FROM borlette_limits WHERE (number=$1 AND draw='') OR (number=$1 AND draw=$2) ORDER BY max_amount ASC LIMIT 1",
        [num, drawKey]
      );
      if (limits.rows.length && parseFloat(mise) > parseFloat(limits.rows[0].max_amount))
        { await client.query('ROLLBACK'); return res.status(400).json({ error: `Limite: max ${limits.rows[0].max_amount} Gd pour numéro ${num}` }); }
    }

    const gain_potentiel = Math.round(parseFloat(mise) * parseFloat(cote || 1));

    // Deduct balance
    await client.query("UPDATE players SET solde=solde-$1 WHERE phone=$2", [mise, phone]);

    // Record transaction
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'perte',$4,$5)",
      [phone, dir_code, caiss_code, -mise, `Mise ${type}: ${selection}`]
    );

    // Record bet
    const betResult = await client.query(
      "INSERT INTO bets (player_phone, dir_code, caiss_code, type, sub_type, selection, mise, cote, gain_potentiel, draw, match_id, match_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [phone, dir_code, caiss_code, type, sub_type||'', selection, mise, cote||1, gain_potentiel, draw||'', match_id||'', match_name||'']
    );

    // Accumulate jackpot (5% of mise to director's jackpot)
    if (dir_code) {
      await client.query(
        "INSERT INTO jackpots (dir_code, amount, week_sales) VALUES ($1, $2, $3) ON CONFLICT (dir_code) DO UPDATE SET amount = jackpots.amount + $2, week_sales = jackpots.week_sales + $3, updated_at = NOW()",
        [dir_code, Math.round(parseFloat(mise) * JACKPOT_PCT / 100), mise]
      );
    }

    await client.query('COMMIT');

    // Get updated balance
    const updated = await pool.query("SELECT solde FROM players WHERE phone=$1", [phone]);
    res.json({ success: true, bet: betResult.rows[0], newSolde: parseFloat(updated.rows[0].solde) });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ============================================================
// RECHARGES
// ============================================================

app.post('/api/recharges/request', requireAuth, async (req, res) => {
  try {
    const { montant, methode } = req.body;
    let phone, dir_code, caiss_code;
    if (req.session.role === 'joueur') {
      phone = req.session.user_phone;
      const p = await pool.query("SELECT dir_code FROM players WHERE phone=$1", [phone]);
      dir_code = p.rows[0]?.dir_code;
    } else if (req.session.role === 'caissier') {
      phone = req.body.player_phone;
      const c = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [req.session.user_code]);
      caiss_code = req.session.user_code;
      dir_code = c.rows[0]?.dir_code;
    }
    const r = await pool.query(
      "INSERT INTO recharges (player_phone, dir_code, caiss_code, montant, methode) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [phone, dir_code, caiss_code, montant, methode||'moncash']
    );
    res.json({ success: true, recharge: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/recharges/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { recharge_id } = req.body;
    if (!['admin','caissier','directeur'].includes(req.session.role))
      return res.status(403).json({ error: 'Non autorisé' });
    await client.query('BEGIN');
    const r = await client.query("SELECT * FROM recharges WHERE id=$1 AND statut='en_attente' FOR UPDATE", [recharge_id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Recharge introuvable' }); }
    const rch = r.rows[0];
    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [rch.montant, rch.player_phone]);
    await client.query("UPDATE recharges SET statut='approuve', updated_at=NOW() WHERE id=$1", [recharge_id]);
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, caiss_code, type, montant, note) VALUES ($1,$2,$3,'depot',$4,'Recharge approuvée')",
      [rch.player_phone, rch.dir_code, rch.caiss_code, rch.montant]
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

// ============================================================
// BORLETTE ADMIN ROUTES
// ============================================================

// Get borlette results
app.get('/api/borlette/results', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const draw = req.query.draw;
    let query = "SELECT * FROM borlette_results";
    let params = [];
    if (draw) { query += " WHERE draw=$1"; params.push(draw); }
    query += " ORDER BY created_at DESC LIMIT $" + (params.length+1);
    params.push(limit);
    const r = await pool.query(query, params);
    res.json({ results: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Publish borlette result (admin only)
app.post('/api/borlette/publish', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { draw, lotto3, lot2, lot3 } = req.body;
    if (!draw || !lotto3 || lotto3.length !== 3)
      return res.status(400).json({ error: 'Données invalides' });
    const lot1 = lotto3.slice(-2);
    await client.query('BEGIN');

    // Save result
    const r = await client.query(
      "INSERT INTO borlette_results (draw, lotto3, lot1, lot2, lot3) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [draw, lotto3, lot1, lot2||'', lot3||'']
    );

    // Resolve pending borlette bets for this draw
    const pending = await client.query(
      "SELECT * FROM bets WHERE type='borlette' AND statut='en_attente' AND (draw='' OR draw=$1)",
      [draw]
    );
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
        await client.query(
          "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,$4)",
          [bet.player_phone, bet.dir_code, gain, `Gain Borlette ${draw} ${sel}`]
        );
      } else {
        await client.query("UPDATE bets SET statut='perdu', resolved_at=NOW() WHERE id=$1", [bet.id]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, result: r.rows[0], resolved: pending.rows.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Blocked numbers
app.get('/api/borlette/blocked',  requireAuth, async (req, res) => {
  const r = await pool.query("SELECT * FROM borlette_blocked ORDER BY created_at DESC");
  res.json({ blocked: r.rows });
});
app.post('/api/borlette/block',   requireAdmin, async (req, res) => {
  try {
    const { number, draw } = req.body;
    const n = String(number).padStart(2,'0');
    await pool.query(
      "INSERT INTO borlette_blocked (number, draw) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [n, draw||'']
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/borlette/block/:id', requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM borlette_blocked WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Limits
app.get('/api/borlette/limits',  requireAuth, async (req, res) => {
  const r = await pool.query("SELECT * FROM borlette_limits ORDER BY number");
  res.json({ limits: r.rows });
});
app.post('/api/borlette/limit',  requireAdmin, async (req, res) => {
  try {
    const { number, draw, max_amount } = req.body;
    const n = String(number).padStart(2,'0');
    await pool.query(
      "INSERT INTO borlette_limits (number, draw, max_amount) VALUES ($1,$2,$3) ON CONFLICT (number,draw) DO UPDATE SET max_amount=$3, updated_at=NOW()",
      [n, draw||'', max_amount]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/borlette/limit/:id', requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM borlette_limits WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ============================================================
// JACKPOT ROUTES
// ============================================================

app.get('/api/jackpots', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT j.*, d.name AS dir_name, d.zone FROM jackpots j JOIN directors d ON j.dir_code=d.code ORDER BY j.amount DESC"
    );
    res.json({ jackpots: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/jackpots/:dirCode', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT j.amount, d.name AS dir_name FROM jackpots j JOIN directors d ON j.dir_code=d.code WHERE j.dir_code=$1",
      [req.params.dirCode]
    );
    res.json(r.rows[0] || { amount: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/jackpots/award', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { dir_code, player_phone } = req.body;
    await client.query('BEGIN');
    const jk = await client.query("SELECT amount FROM jackpots WHERE dir_code=$1 FOR UPDATE", [dir_code]);
    if (!jk.rows.length || parseFloat(jk.rows[0].amount) <= 0)
      { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Jackpot vide' }); }
    const amount = parseFloat(jk.rows[0].amount);

    // Get winner (random if not specified)
    let phone = player_phone;
    let winnerName = '';
    if (!phone) {
      const players = await client.query("SELECT phone, name FROM players WHERE dir_code=$1 AND active=TRUE", [dir_code]);
      if (!players.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Aucun joueur pour ce directeur' }); }
      const winner = players.rows[Math.floor(Math.random() * players.rows.length)];
      phone = winner.phone;
      winnerName = winner.name;
    } else {
      const wr = await client.query("SELECT name FROM players WHERE phone=$1", [phone]);
      winnerName = wr.rows[0]?.name || '';
    }

    await client.query("UPDATE players SET solde=solde+$1 WHERE phone=$2", [amount, phone]);
    await client.query("UPDATE jackpots SET amount=0, week_sales=0, last_reset=NOW(), updated_at=NOW() WHERE dir_code=$1", [dir_code]);
    await client.query(
      "INSERT INTO jackpot_history (dir_code, amount, winner_phone, winner_name) VALUES ($1,$2,$3,$4)",
      [dir_code, amount, phone, winnerName]
    );
    await client.query(
      "INSERT INTO transactions (player_phone, dir_code, type, montant, note) VALUES ($1,$2,'gain',$3,'🎰 JACKPOT GAGNÉ')",
      [phone, dir_code, amount]
    );
    await client.query('COMMIT');
    res.json({ success: true, amount, winner: winnerName, phone });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/jackpots/set', requireAdmin, async (req, res) => {
  try {
    const { dir_code, amount } = req.body;
    await pool.query(
      "INSERT INTO jackpots (dir_code, amount) VALUES ($1,$2) ON CONFLICT (dir_code) DO UPDATE SET amount=$2, updated_at=NOW()",
      [dir_code, amount]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/jackpots/reset', requireAdmin, async (req, res) => {
  try {
    const { dir_code } = req.body;
    await pool.query("UPDATE jackpots SET amount=0, week_sales=0, last_reset=NOW() WHERE dir_code=$1", [dir_code]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/jackpots/:dirCode/history', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM jackpot_history WHERE dir_code=$1 ORDER BY created_at DESC LIMIT 20",
      [req.params.dirCode]
    );
    res.json({ history: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// Dashboard stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [players, directors, cashiers, bets, trans, recharges] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt, SUM(solde) as total_solde FROM players WHERE active=TRUE"),
      pool.query("SELECT COUNT(*) as cnt FROM directors WHERE active=TRUE"),
      pool.query("SELECT COUNT(*) as cnt FROM cashiers WHERE active=TRUE"),
      pool.query("SELECT COUNT(*) as cnt, SUM(mise) as total_mise FROM bets"),
      pool.query("SELECT SUM(CASE WHEN montant>0 THEN montant ELSE 0 END) as entrees, SUM(CASE WHEN montant<0 THEN ABS(montant) ELSE 0 END) as sorties FROM transactions"),
      pool.query("SELECT COUNT(*) as cnt FROM recharges WHERE statut='en_attente'"),
    ]);
    res.json({
      players:    parseInt(players.rows[0].cnt),
      totalSolde: parseFloat(players.rows[0].total_solde)||0,
      directors:  parseInt(directors.rows[0].cnt),
      cashiers:   parseInt(cashiers.rows[0].cnt),
      totalBets:  parseInt(bets.rows[0].cnt),
      totalMise:  parseFloat(bets.rows[0].total_mise)||0,
      entrees:    parseFloat(trans.rows[0].entrees)||0,
      sorties:    parseFloat(trans.rows[0].sorties)||0,
      benefice:   (parseFloat(trans.rows[0].entrees)||0) - (parseFloat(trans.rows[0].sorties)||0),
      pendingRecharges: parseInt(recharges.rows[0].cnt),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all players
app.get('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT id,name,phone,solde,dir_code,caiss_code,active,created_at FROM players ORDER BY created_at DESC");
    res.json({ players: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all directors with profit share
app.get('/api/admin/directors', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, j.amount as jackpot,
        COALESCE((SELECT SUM(ABS(t.montant)) FROM transactions t WHERE t.dir_code=d.code AND t.type='perte'),0) as total_mise,
        COALESCE((SELECT SUM(t.montant) FROM transactions t WHERE t.dir_code=d.code AND t.type='gain'),0) as total_gains
      FROM directors d
      LEFT JOIN jackpots j ON j.dir_code = d.code
      ORDER BY d.created_at
    `);
    res.json({ directors: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create director
app.post('/api/admin/directors', requireAdmin, async (req, res) => {
  try {
    const { name, code, zone, phone, pwd, pct } = req.body;
    if (!name||!code||!zone||!pwd) return res.status(400).json({ error: 'Champs obligatoires' });
    const hash = await bcrypt.hash(pwd, 10);
    const r = await pool.query(
      "INSERT INTO directors (name,code,zone,phone,pwd_hash,pct) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, code.toUpperCase(), zone, phone||'', hash, pct||0]
    );
    // Init jackpot
    await pool.query("INSERT INTO jackpots (dir_code) VALUES ($1) ON CONFLICT DO NOTHING", [code.toUpperCase()]);
    res.json({ success: true, director: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete director
app.delete('/api/admin/directors/:code', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE directors SET active=FALSE WHERE code=$1", [req.params.code]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all cashiers
app.get('/api/admin/cashiers', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT c.*, d.name AS dir_name FROM cashiers c LEFT JOIN directors d ON c.dir_code=d.code ORDER BY c.created_at");
    res.json({ cashiers: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create cashier
app.post('/api/admin/cashiers', requireAdmin, async (req, res) => {
  try {
    const { name, code, dir_code, phone, pwd, jeu } = req.body;
    if (!name||!code||!pwd) return res.status(400).json({ error: 'Champs obligatoires' });
    const hash = await bcrypt.hash(pwd, 10);
    const r = await pool.query(
      "INSERT INTO cashiers (name,code,dir_code,phone,pwd_hash,jeu) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, code.toUpperCase(), dir_code, phone||'', hash, jeu||'all']
    );
    res.json({ success: true, cashier: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All bets
app.get('/api/admin/bets', requireAdmin, async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All transactions
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT t.*, p.name AS player_name FROM transactions t LEFT JOIN players p ON t.player_phone=p.phone ORDER BY t.created_at DESC LIMIT 200"
    );
    res.json({ transactions: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All recharges
app.get('/api/admin/recharges', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT r.*, p.name AS player_name FROM recharges r LEFT JOIN players p ON r.player_phone=p.phone ORDER BY r.created_at DESC LIMIT 100"
    );
    res.json({ recharges: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Settings
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM settings");
    const settings = {};
    r.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        "INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()",
        [key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// DIRECTOR ROUTES
// ============================================================

app.get('/api/director/stats', requireAuth, async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/director/players', requireAuth, async (req, res) => {
  try {
    const code = req.session.role === 'directeur' ? req.session.user_code : req.query.code;
    const r = await pool.query(
      "SELECT id,name,phone,solde,caiss_code,created_at FROM players WHERE dir_code=$1 AND active=TRUE ORDER BY created_at DESC",
      [code]
    );
    res.json({ players: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CASHIER ROUTES
// ============================================================

app.get('/api/cashier/players', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'caissier') return res.status(403).json({error:'Non autorisé'});
    const r = await pool.query(
      "SELECT id,name,phone,solde,created_at FROM players WHERE caiss_code=$1 AND active=TRUE ORDER BY name",
      [req.session.user_code]
    );
    res.json({ players: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create player (by cashier)
app.post('/api/cashier/players', requireAuth, async (req, res) => {
  try {
    if (!['caissier','directeur','admin'].includes(req.session.role))
      return res.status(403).json({ error: 'Non autorisé' });
    const { name, phone, pwd } = req.body;
    const hash = await bcrypt.hash(pwd || 'test123', 10);
    let dir_code, caiss_code;
    if (req.session.role === 'caissier') {
      const c = await pool.query("SELECT dir_code FROM cashiers WHERE code=$1", [req.session.user_code]);
      dir_code = c.rows[0]?.dir_code;
      caiss_code = req.session.user_code;
    }
    const r = await pool.query(
      "INSERT INTO players (name,phone,pwd_hash,dir_code,caiss_code) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,phone,solde",
      [name, phone, hash, dir_code, caiss_code]
    );
    res.json({ success: true, player: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Tonton Kondo API running on port ${PORT}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL missing'}`);
  console.log(`   Football API: ${FOOTBALL_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
