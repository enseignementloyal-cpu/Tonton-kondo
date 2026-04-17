/* ═══════════════════════════════════════════════════
   TK_ADMIN.JS — Interface Administration
   Modifier ici: refreshAdmin, directeurs, caissiers,
   borlette admin, jackpot, paramètres, session restore
   ═══════════════════════════════════════════════════ */

function refreshAdmin(){
  loadAdminDiffs && loadAdminDiffs();
  const j=gJ(),dirs=gDirs(),caiss=gCaiss(),bets=gB(),st=gSt(),at=gAT();
  const tSol=Object.values(j).reduce((a,x)=>a+(x.solde||0),0);
  const pending=bets.filter(b=>b.statut==='En attente');
  const el=n=>document.getElementById(n);

  if(el('admin-stats'))el('admin-stats').innerHTML=[
    {v:Object.keys(dirs).length,l:'Directeurs',c:'sblue'},
    {v:Object.keys(caiss).length,l:'Caissiers',c:'spurp'},
    {v:Object.keys(j).length,l:'Joueurs',c:'sgreen'},
    {v:tSol+' Gd',l:'Solde joueurs',c:'sgold'},
    {v:pending.length,l:'Paris en attente',c:'sblue'},
  ].map(s=>`<div class="statcard"><div class="sv ${s.c}">${s.v}</div><div class="sl">${s.l}</div></div>`).join('');

  // Performance par directeur
  const pb=el('adm-dirs-perf');
  if(pb)pb.innerHTML=Object.values(dirs).map(d=>{
    const mc=Object.values(caiss).filter(c=>c.dirCode===d.code).length;
    const mj=Object.values(j).filter(jj=>jj.dirCode===d.code).length;
    const myAt=at.filter(t=>t.dirCode===d.code);
    const dep=myAt.filter(t=>t.montant>0).reduce((a,t)=>a+t.montant,0);
    const pay=myAt.filter(t=>t.montant<0).reduce((a,t)=>a+Math.abs(t.montant),0);
    return`<tr><td><b>${d.name}</b></td><td>${d.zone}</td><td>${mc}</td><td>${mj}</td><td style="color:var(--green2)">${dep} Gd</td><td style="color:${dep-pay>=0?'var(--green2)':'var(--red)'}">${dep-pay} Gd</td></tr>`;
  }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:12px">Aucun directeur</td></tr>';

  // Directeurs table with reset MDP + diff
  const db=el('adm-dirs-body');
  if(db)db.innerHTML=Object.values(dirs).map(d=>{
    const cnt=Object.values(caiss).filter(c=>c.dirCode===d.code).length;
    return`<tr>
      <td><b>${d.name}</b></td><td>${d.zone}</td>
      <td><code style="color:var(--gold)">${d.code}</code></td>
      <td style="color:var(--muted)">${d.phone||'—'}</td>
      <td><span style="filter:blur(3px);cursor:pointer" onclick="this.style.filter='none'">${d.pwd}</span></td>
      <td>${cnt}</td>
      <td>
        <button class="tbtn b" onclick="resetMdpDir('${d.code}')">🔑 MdP</button>
        <button class="tbtn r" onclick="admSuppDir('${d.code}')">✕</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:12px">Aucun directeur</td></tr>';

  // Caissiers table with reset MDP
  const cb=el('adm-caiss-body');
  if(cb)cb.innerHTML=Object.values(caiss).map(c=>{
    const dir=Object.values(dirs).find(d=>d.code===c.dirCode);
    return`<tr>
      <td><b>${c.name}</b></td>
      <td><code style="color:var(--gold)">${c.code}</code></td>
      <td style="color:var(--muted)">${c.phone||'—'}</td>
      <td><span style="filter:blur(3px);cursor:pointer" onclick="this.style.filter='none'">${c.pwd}</span></td>
      <td>${JEU_LABELS[c.jeu]||c.jeu}</td>
      <td>${dir?dir.name:'—'}</td>
      <td>${c.zone||'—'}</td>
      <td>
        <button class="tbtn b" onclick="resetMdpCaiss('${c.code}')">🔑 MdP</button>
        <button class="tbtn r" onclick="admSuppCaiss('${c.code}')">✕</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:12px">Aucun caissier</td></tr>';

  // Joueurs table with reset MDP
  const jb=el('tadm-joueurs-body');
  if(jb)jb.innerHTML=Object.values(j).map(jj=>{
    const dir=Object.values(dirs).find(d=>d.code===jj.dirCode);
    return`<tr>
      <td>${jj.name}</td><td>${jj.phone}</td>
      <td style="color:var(--gold)">${jj.solde||0} Gd</td>
      <td style="font-size:10px">${jj.createdAt||'—'}</td>
      <td>${dir?dir.name:'—'}</td>
      <td><button class="tbtn b" onclick="resetMdpJoueur('${jj.phone}')">🔑 MdP</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted)">Aucun joueur</td></tr>';

  // Bets
  const tw=bets.reduce((a,b)=>a+b.mise,0);
  const tp=bets.filter(b=>b.statut==='Gagné').reduce((a,b)=>a+b.gainPotentiel,0);
  const bsEl=el('admin-bets-stats');
  if(bsEl)bsEl.innerHTML=[{v:bets.length,l:'Total paris',c:'sblue'},{v:tw+' Gd',l:'Total misé',c:'sgold'},{v:tp+' Gd',l:'Gains payés',c:'sgreen'},{v:pending.length,l:'En attente',c:'spurp'}].map(s=>`<div class="statcard"><div class="sv ${s.c}">${s.v}</div><div class="sl">${s.l}</div></div>`).join('');
  const bBody=el('tadm-bets-body');
  if(bBody)bBody.innerHTML=bets.map(b=>`<tr>
    <td style="font-size:10px">${b.date}</td><td><b>${b.joueurName}</b></td>
    <td style="font-size:11px">${b.match}</td><td><b>${b.selection}</b></td>
    <td style="color:var(--gold)">${b.odd?.toFixed(2)||'—'}</td><td>${b.mise} Gd</td>
    <td style="color:var(--green2)">${b.gainPotentiel} Gd</td>
    <td><span class="sbadge ${b.statut==='En attente'?'sbp':b.statut==='Gagné'?'sbw':'sbl'}">${b.statut}</span>
    ${b.statut==='En attente'?`<br><button class="tbtn g" onclick="resoudrePari('${b.id}','Gagné')">✔</button><button class="tbtn r" onclick="resoudrePari('${b.id}','Perdu')">✘</button>`:''}
    </td></tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:12px">Aucun pari</td></tr>';

  // Transactions
  const tBody=el('tadm-trans-body');
  if(tBody)tBody.innerHTML=at.slice(0,100).map(t=>`<tr>
    <td style="font-size:10px">${t.date}</td><td><b>${t.joueurName}</b></td>
    <td><span class="sbadge ${t.montant>0?'sbd':'sbr'}">${t.type}</span></td>
    <td style="${t.montant>0?'color:var(--green2)':'color:var(--red)'}">${t.montant>0?'+':''}${t.montant} Gd</td>
    <td>${t.soldeApres} Gd</td><td>${t.caissName||'—'}</td>
  </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:12px">Aucune transaction</td></tr>';

  refreshAdminComptes();
  renderDirDiffList();
}

// ============================================================
// PATCH: admSuppDir + admSuppCaiss
// ============================================================
function admSuppDir(code){
  if(!confirm('Supprimer le directeur '+code+' ?')) return;
  const dirs=gDirs(); delete dirs[code]; sDirs(dirs);
  showNotif('Directeur supprimé','ok'); refreshAdmin();
}
function admSuppCaiss(code){
  if(!confirm('Supprimer le caissier '+code+' ?')) return;
  const caiss=gCaiss(); delete caiss[code]; sCaiss(caiss);
  showNotif('Caissier supprimé','ok'); refreshAdmin();
}

// ============================================================
// PATCH: Admin comptes HTML - add maison gains section
// ============================================================
function refreshAdminComptesExtra(){
  const stats = getMaisonStats();
  const mb = document.getElementById('adm-maison-block');
  if(mb){
    mb.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px">
        <div style="background:rgba(40,176,78,.1);border:2px solid rgba(40,176,78,.4);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.3em;margin-bottom:4px">💸</div>
          <div style="font-size:12px;font-weight:800;color:var(--green2)">Mises perdues (gains maison)</div>
          <div style="font-size:1.2em;font-weight:900;color:#fff" id="adm-mises-perdues">${stats.misesPerdues.toLocaleString('fr-FR')} Gd</div>
        </div>
        <div style="background:rgba(230,57,70,.1);border:2px solid rgba(230,57,70,.4);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.3em;margin-bottom:4px">🏆</div>
          <div style="font-size:12px;font-weight:800;color:var(--red)">Gains payés aux joueurs</div>
          <div style="font-size:1.2em;font-weight:900;color:#fff" id="adm-gains-paies">${stats.gainsPaies.toLocaleString('fr-FR')} Gd</div>
        </div>
        <div style="background:rgba(245,200,0,.1);border:2px solid rgba(245,200,0,.4);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.3em;margin-bottom:4px">📊</div>
          <div style="font-size:12px;font-weight:800;color:var(--gold)">Bénéfice NET maison</div>
          <div style="font-size:1.2em;font-weight:900" id="adm-benefice" style="color:${stats.beneficeMaison>=0?'var(--green2)':'var(--red)'}">${stats.beneficeMaison.toLocaleString('fr-FR')} Gd</div>
        </div>
      </div>`;
  }
}

// ======================================================
// ROULETTE AMÉRICAINE — Version complète corrigée
// ======================================================
let rouletteBets = {};
let rouletteSpinning = false;
let rouletteSelChip = 5;
let rouletteCanvas = null;
let rouletteCtx = null;
let rouletteAngle = 0;
let rouletteVelocity = 0;
let rouletteAnimId = null;

const ROULETTE_RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const WHEEL_ORDER = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,
  '00',27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2,0];

function rouletteNumColor(n){
  if(n===0||n==='00') return 'green';
  return ROULETTE_RED.includes(parseInt(n)) ? 'red' : 'black';
}

function initRoulette(){
  rouletteCanvas = document.getElementById('roulette-canvas');
  if(!rouletteCanvas) return;
  rouletteCtx = rouletteCanvas.getContext('2d');
  rouletteAngle = 0; rouletteVelocity = 0;
  rouletteBets = {};
  renderRouletteBets();
  drawRouletteWheel(rouletteAngle);
}

function drawRouletteWheel(angle){
  const canvas = rouletteCanvas;
  const ctx = rouletteCtx;
  if(!canvas||!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2, R = W/2 - 4;
  ctx.clearRect(0,0,W,H);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx,cy,R+3,0,2*Math.PI);
  ctx.fillStyle = '#8a6820';
  ctx.fill();

  const slots = WHEEL_ORDER.length;
  const slotAngle = (2*Math.PI)/slots;

  for(let i=0;i<slots;i++){
    const n = WHEEL_ORDER[i];
    const startA = angle + i*slotAngle - slotAngle/2;
    const endA = startA + slotAngle;
    const col = rouletteNumColor(n);

    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,startA,endA);
    ctx.closePath();
    ctx.fillStyle = col==='red' ? '#b81c2c' : col==='green' ? '#1a6b2a' : '#111';
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Number text
    const midA = startA + slotAngle/2;
    const tx = cx + (R*0.75)*Math.cos(midA);
    const ty = cy + (R*0.75)*Math.sin(midA);
    ctx.save();
    ctx.translate(tx,ty);
    ctx.rotate(midA + Math.PI/2);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 7px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }

  // Inner circle (hub)
  ctx.beginPath();
  ctx.arc(cx,cy,R*0.28,0,2*Math.PI);
  const grd = ctx.createRadialGradient(cx-3,cy-3,1,cx,cy,R*0.28);
  grd.addColorStop(0,'#f0d080');
  grd.addColorStop(1,'#5a3f10');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ball indicator line
  ctx.beginPath();
  ctx.moveTo(cx, cy - R*0.28);
  ctx.lineTo(cx, cy - R*0.92);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function animateRouletteWheel(){
  rouletteAngle += rouletteVelocity;
  rouletteVelocity *= 0.985;
  drawRouletteWheel(rouletteAngle);
  if(rouletteVelocity > 0.002){
    rouletteAnimId = requestAnimationFrame(animateRouletteWheel);
  } else {
    rouletteSpinning = false;
    // Determine landed number
    const slots = WHEEL_ORDER.length;
    const slotAngle = (2*Math.PI)/slots;
    const norm = ((rouletteAngle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    const idx = Math.round((2*Math.PI - norm) / slotAngle) % slots;
    const landed = WHEEL_ORDER[((idx % slots)+slots)%slots];
    showRouletteResult(landed);
  }
}

function spinRoulette(){
  if(rouletteSpinning) return;
  if(!rouletteCanvas){ initRoulette(); }
  const totalBet = Object.values(rouletteBets).reduce((a,b)=>a+b,0);
  if(totalBet === 0){ showNotif('Plas yon mise sou tab la !','err'); return; }
  if(CJ && totalBet > getSolde()){ showNotif('Solde insuffisant !','err'); return; }
  if(CJ){ deduireJ(totalBet,'Roulette','Mise roulette: '+totalBet+' Gd'); }
  rouletteSpinning = true;
  const btn = document.getElementById('spin-btn');
  if(btn) btn.disabled = true;
  rouletteVelocity = 0.18 + Math.random()*0.12;
  if(rouletteAnimId) cancelAnimationFrame(rouletteAnimId);
  animateRouletteWheel();
}

function showRouletteResult(landed){
  const resultEl = document.getElementById('roulette-result');
  const col = rouletteNumColor(landed);
  if(resultEl){
    resultEl.textContent = landed;
    resultEl.className = 'roulette-result ' + col;
  }
  const btn = document.getElementById('spin-btn');
  if(btn) btn.disabled = false;

  // Calculate winnings
  let totalWin = 0;
  const landedStr = String(landed);
  const landedNum = parseInt(landed);
  Object.entries(rouletteBets).forEach(([key, amt]) => {
    if(!amt) return;
    let win = 0;
    if(key === landedStr){ win = amt * 35; }
    else if(key==='red'   && col==='red')  { win = amt*2; }
    else if(key==='black' && col==='black'){ win = amt*2; }
    else if(key==='green' && col==='green'){ win = amt*17; }
    else if(key==='even'  && landedNum>0 && !isNaN(landedNum) && landedNum%2===0){ win = amt*2; }
    else if(key==='odd'   && !isNaN(landedNum) && landedNum%2===1){ win = amt*2; }
    else if(key==='1to18' && landedNum>=1 && landedNum<=18){ win = amt*2; }
    else if(key==='19to36'&& landedNum>=19 && landedNum<=36){ win = amt*2; }
    else if(key==='1st12' && landedNum>=1 && landedNum<=12){ win = amt*3; }
    else if(key==='2nd12' && landedNum>=13&& landedNum<=24){ win = amt*3; }
    else if(key==='3rd12' && landedNum>=25&& landedNum<=36){ win = amt*3; }
    totalWin += win;
  });

  if(totalWin > 0){
    if(CJ){ crediterJ(totalWin,'Gain Roulette','Roulette: '+landed+' — gain '+totalWin+' Gd'); }
    showNotif('🎉 '+landed+' — Gain: +'+totalWin+' Gd !','ok');
  } else {
    showNotif('😔 '+landed+' — Perdu.','err');
  }
  updateAppBar();
}

function placeRouletteBet(key, el){
  if(rouletteSpinning) return;
  if(CJ && Object.values(rouletteBets).reduce((a,b)=>a+b,0) + rouletteSelChip > getSolde()){
    showNotif('Solde insuffisant','err'); return;
  }
  if(!rouletteBets[key]) rouletteBets[key] = 0;
  rouletteBets[key] += rouletteSelChip;
  renderRouletteBets();
  if(el) el.classList.add('has-bet');
}

function clearRouletteBets(){
  rouletteBets = {};
  renderRouletteBets();
  document.querySelectorAll('.r-cell').forEach(c=>{
    c.classList.remove('has-bet');
    const ov = c.querySelector('.bet-chip-overlay');
    if(ov) ov.remove();
  });
}

function renderRouletteBets(){
  document.querySelectorAll('.r-cell').forEach(cell=>{
    const k = cell.dataset.key;
    const ov = cell.querySelector('.bet-chip-overlay');
    if(ov) ov.remove();
    cell.classList.remove('has-bet');
    if(rouletteBets[k] && rouletteBets[k]>0){
      cell.classList.add('has-bet');
      const chip = document.createElement('div');
      chip.className = 'bet-chip-overlay';
      chip.textContent = rouletteBets[k];
      cell.appendChild(chip);
    }
  });
  const totalEl = document.getElementById('roulette-bets-display');
  if(totalEl){
    const total = Object.values(rouletteBets).reduce((a,b)=>a+b,0);
    totalEl.innerHTML = total > 0
      ? `<span style="color:var(--gold);font-weight:700">Mise totale: ${total} Gd</span>`
      : '<span style="color:var(--muted)">Aucune mise</span>';
  }
}

function selectChip(val){
  rouletteSelChip = val;
  document.querySelectorAll('.chip-val').forEach(c=>c.classList.remove('selected'));
  const el = document.querySelector(`.chip-val[data-val="${val}"]`);
  if(el) el.classList.add('selected');
  const disp = document.getElementById('chip-display');
  if(disp) disp.textContent = 'G '+val;
}
// ======================================================

// Match details modals
function openMkt(matchId){
  const m=MATCHES.find(x=>x.id===matchId);
  if(!m){showNotif('Match introuvable','err');return;}
  const modal=document.getElementById('mov-sports');
  if(!modal)return;
  document.getElementById('mov-sports-title').textContent=m.t1+' vs '+m.t2;
  const body=document.getElementById('mov-sports-body');
  // Generate extra markets based on match
  const mkts=[
    {g:'Résultat final',bets:[
      {l:'1 - '+m.t1,v:(m.odds[0]*1.05).toFixed(2)},
      {l:'Match nul',v:(m.odds[1]*1.05).toFixed(2)},
      {l:'2 - '+m.t2,v:(m.odds[2]*1.05).toFixed(2)},
    ]},
    {g:'Double Chance',bets:[
      {l:'1X ('+m.t1+' ou nul)',v:(m.odds[0]*0.6).toFixed(2)},
      {l:'X2 (nul ou '+m.t2+')',v:(m.odds[2]*0.6).toFixed(2)},
      {l:'12 ('+m.t1+' ou '+m.t2+')',v:'1.35'},
    ]},
    {g:'Mi-temps/Final',bets:[
      {l:'1/1',v:'3.50'},{l:'1/X',v:'7.00'},{l:'1/2',v:'9.00'},
      {l:'X/1',v:'4.50'},{l:'X/X',v:'3.80'},{l:'X/2',v:'4.50'},
    ]},
    {g:'Total Buts',bets:[
      {l:'Moins de 1.5',v:'2.80'},{l:'Plus de 1.5',v:'1.40'},
      {l:'Moins de 2.5',v:'1.65'},{l:'Plus de 2.5',v:'2.15'},
      {l:'Moins de 3.5',v:'1.30'},{l:'Plus de 3.5',v:'3.20'},
    ]},
  ];
  body.innerHTML=mkts.map(mk=>`
    <div class="mktgrp">
      <div class="mktgrp-title">${mk.g}</div>
      <div class="mktgrid">
        ${mk.bets.map(b=>`
          <div class="mbt" onclick="addBetMkt(${matchId},'${b.l}',${b.v},'${(m.t1+' vs '+m.t2).replace(/'/g,'\'')}',this)">
            <div class="ml">${b.l}</div>
            <div class="mv">${b.v}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
  modal.classList.add('on');
}

function addBetMkt(matchId,result,odd,matchName,el){
  if(!CJ){showNotif('Connectez-vous pour parier !','err');return;}
  const ex=betSlip.findIndex(b=>b.matchId===matchId);
  if(ex>=0) betSlip.splice(ex,1);
  betSlip.push({matchId,result,odd:parseFloat(odd),matchName});
  document.querySelectorAll('.mbt.sel').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  renderCP();updateCPBar();
  showNotif(result+' @ '+odd+' ajouté','info');
}

function openH2H(matchId){
  const m=MATCHES.find(x=>x.id===matchId);
  if(!m)return;
  const modal=document.getElementById('mov-sports');
  if(!modal)return;
  document.getElementById('mov-sports-title').textContent='H2H: '+m.t1+' vs '+m.t2;
  const body=document.getElementById('mov-sports-body');
  // Generate H2H data
  const recent=[
    {date:'15/03/2025',score:'2 - 1',winner:0},
    {date:'28/11/2024',score:'0 - 0',winner:2},
    {date:'05/08/2024',score:'1 - 3',winner:1},
    {date:'12/04/2024',score:'2 - 2',winner:2},
    {date:'20/01/2024',score:'1 - 0',winner:0},
  ];
  const form1=['W','W','D','L','W'];
  const form2=['L','D','W','W','L'];
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px">${m.t1}</div>
        <div style="display:flex;gap:3px;justify-content:center;">${form1.map(r=>`<span class="fb ${r==='W'?'W':r==='D'?'D':'L'}">${r}</span>`).join('')}</div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px">${m.t2}</div>
        <div style="display:flex;gap:3px;justify-content:center;">${form2.map(r=>`<span class="fb ${r==='W'?'W':r==='D'?'D':'L'}">${r}</span>`).join('')}</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">5 dernières confrontations</div>
    ${recent.map(r=>`
      <div class="h2hrow">
        <span class="h2hdt">${r.date}</span>
        <span class="h2htm">${m.t1}</span>
        <span class="h2hsc ${r.winner===0?'w1':r.winner===1?'w2':'dr'}">${r.score}</span>
        <span class="h2htm">${m.t2}</span>
      </div>`).join('')}
  `;
  modal.classList.add('on');
}

function closeSportsMov(){
  const m=document.getElementById('mov-sports');
  if(m)m.classList.remove('on');
}

// ===== PENALTY =====

/* ══════════════════════════
   DONNÉES JOUEURS
   photo : nom du fichier image à placer dans le même dossier
══════════════════════════ */
const PLAYERS = [
  { id:'messi',   name:'Messi',   flag:'🇦🇷', num:'10', skill:.82, kit:'#6cb4e4', skin:'#f5cba7', hair:'#222', photo:'messi.png' },
  { id:'ronaldo', name:'Ronaldo', flag:'🇵🇹', num:'7',  skill:.85, kit:'#e53935', skin:'#d4a574', hair:'#111', photo:'ronaldo.png' },
  { id:'mbappe',  name:'Mbappé',  flag:'🇫🇷', num:'9',  skill:.80, kit:'#1565c0', skin:'#8B5A2B', hair:'#111', photo:'mbappe.png' },
  { id:'neymar',  name:'Neymar',  flag:'🇧🇷', num:'10', skill:.78, kit:'#ffd600', skin:'#c8945a', hair:'#111', photo:'neymar.png' },
  { id:'haaland', name:'Haaland', flag:'🇳🇴', num:'9',  skill:.83, kit:'#43a047', skin:'#f0d5b0', hair:'#e8c068',photo:'haaland.png' },
  { id:'salah',   name:'Salah',   flag:'🇪🇬', num:'11', skill:.81, kit:'#c62828', skin:'#8B5A2B', hair:'#111', photo:'salah.png' },
];
const KEEPERS = [
  { id:'alisson',  name:'Alisson',  flag:'🇧🇷', skill:.82, kit:'#ff7043', skin:'#c8945a', hair:'#111', photo:'alisson.png' },
  { id:'courtois', name:'Courtois', flag:'🇧🇪', skill:.85, kit:'#4caf50', skin:'#f0d5b0', hair:'#8B6914',photo:'courtois.png' },
  { id:'neuer',    name:'Neuer',    flag:'🇩🇪', skill:.83, kit:'#9c27b0', skin:'#f5cba7', hair:'#222', photo:'neuer.png' },
  { id:'ederson',  name:'Ederson',  flag:'🇧🇷', skill:.79, kit:'#1565c0', skin:'#8B5A2B', hair:'#111', photo:'ederson.png' },
  { id:'lloris',   name:'Lloris',   flag:'🇫🇷', skill:.80, kit:'#37474f', skin:'#d4a574', hair:'#111', photo:'lloris.png' },
];

/* ══════════════════════════
   SVG AVATAR FALLBACK
══════════════════════════ */
function svgAvatar(p, isGK=false){
  const k=p.kit, s=p.skin, h=p.hair;
  const sh=darken(k,25);
  const gv=isGK;
  return `
    <ellipse cx="30" cy="118" rx="13" ry="3.5" fill="rgba(0,0,0,.22)"/>
    <rect x="21" y="86" width="8" height="22" rx="3" fill="${sh}"/>
    <rect x="31" y="86" width="8" height="22" rx="3" fill="${sh}"/>
    <rect x="21" y="100" width="8" height="10" rx="2" fill="rgba(255,255,255,.75)"/>
    <rect x="31" y="100" width="8" height="10" rx="2" fill="rgba(255,255,255,.75)"/>
    <ellipse cx="25" cy="112" rx="5.5" ry="3.8" fill="#111"/>
    <ellipse cx="35" cy="112" rx="5.5" ry="3.8" fill="#111"/>
    <rect x="18" y="52" width="24" height="35" rx="5" fill="${k}"/>
    <rect x="27" y="52" width="6" height="35" rx="2" fill="rgba(255,255,255,.1)"/>
    <rect x="7"  y="54" width="12" height="7" rx="4" fill="${k}"/>
    <rect x="41" y="54" width="12" height="7" rx="4" fill="${k}"/>
    ${gv?`<ellipse cx="10" cy="54" rx="6" ry="5" fill="#ffd600"/><ellipse cx="50" cy="54" rx="6" ry="5" fill="#ffd600"/>`:''}
    <rect x="26" y="43" width="8" height="12" rx="3" fill="${s}"/>
    <ellipse cx="30" cy="33" rx="13" ry="14" fill="${s}"/>
    <ellipse cx="17" cy="34" rx="2.8" ry="3.5" fill="${s}"/>
    <ellipse cx="43" cy="34" rx="2.8" ry="3.5" fill="${s}"/>
    <ellipse cx="30" cy="21" rx="13" ry="9" fill="${h}"/>
    <rect x="17" y="21" width="26" height="8" rx="4" fill="${h}"/>
    <ellipse cx="25" cy="33" rx="2.5" ry="2.5" fill="white"/>
    <ellipse cx="35" cy="33" rx="2.5" ry="2.5" fill="white"/>
    <ellipse cx="25.5" cy="33.5" rx="1.3" ry="1.3" fill="#333"/>
    <ellipse cx="35.5" cy="33.5" rx="1.3" ry="1.3" fill="#333"/>
    <path d="M26 39 Q30 42 34 39" stroke="#a0522d" stroke-width="1" fill="none" stroke-linecap="round"/>
    <text x="30" y="74" text-anchor="middle" font-size="8" fill="white" font-family="Arial Black" opacity=".9">${isGK?'1':p.num||'10'}</text>
  `;
}
function darken(hex,a){
  const c=parseInt(hex.replace('#',''),16);
  const r=Math.max(0,((c>>16)&255)-a);
  const g=Math.max(0,((c>>8)&255)-a);
  const b=Math.max(0,(c&255)-a);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

/* ══════════════════════════
   IMAGE LOADER
   Essaie plusieurs extensions : png, jpg, jpeg, webp
   Si aucune ne charge → affiche le SVG fallback
══════════════════════════ */
function tryLoadImage(baseName, imgEl, svgFallbackEl, onLoad, onFail){
  const exts = ['png','jpg','jpeg','webp'];
  const base = baseName.replace(/\.[^.]+$/,'');
  let idx=0;
  function next(){
    if(idx>=exts.length){
      // Aucune image trouvée — garder le SVG fallback visible
      if(typeof onFail==='function') onFail();
      return;
    }
    const ext=exts[idx++];
    const src=base+'.'+ext;
    const tst=new Image();
    tst.onload=()=>{
      imgEl.src=src;
      imgEl.style.display='block';
      svgFallbackEl.style.display='none';
      if(typeof onLoad==='function') onLoad();
    };
    tst.onerror=next;
    tst.src=src;
  }
  next();
}

/* ══════════════════════════
   ZONES (3×3)
   1 2 3 = Haut
   4 5 6 = Milieu
   7 8 9 = Bas
══════════════════════════ */
const ZONE_NAMES=['','Haut G','Haut C','Haut D','Mil G','Centre','Mil D','Bas G','Bas C','Bas D'];
const ZONE_ODDS =[0, 4.5, 3.0, 4.5, 3.5, 2.5, 3.5, 4.0, 2.8, 4.0];

function zoneCenter(n){ // retourne {x,y} en 0..1 dans le but
  const col=(n-1)%3, row=Math.floor((n-1)/3);
  return {x:(col+.5)/3, y:(row+.5)/3};
}

/* ══════════════════════════
   STATE
══════════════════════════ */
let shooter=PLAYERS[0], keeper=KEEPERS[0];
let pickedZone=null, betZone=null;
let shots=[], scGoal=0, scSaved=0, busy=false, penaltyTotalWon=0;


/* ══════════════════════════
   BUILD PLAYER CARDS
══════════════════════════ */
function buildGrids(){
  buildRow('shooterGrid', PLAYERS, false);
  buildRow('gkGrid', KEEPERS, true);
}
function buildRow(containerId, arr, isGK){
  const wrap=document.getElementById(containerId);
  wrap.innerHTML='';
  arr.forEach(p=>{
    const active=isGK?(p.id===keeper.id?'gkact':''):(p.id===shooter.id?'act':'');
    const card=document.createElement('div');
    card.className='pcard '+active;

    // Avatar container
    const av=document.createElement('div');
    av.className='pavatar';

    // Real image
    const img=document.createElement('img');
    img.style.cssText='width:100%;height:100%;object-fit:cover;object-position:top center;display:none;border-radius:50%;';

    // SVG fallback
    const svgEl=document.createElement('svg');
    svgEl.setAttribute('viewBox','0 0 60 120');
    svgEl.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svgEl.style.cssText='width:100%;height:100%;position:absolute;top:0;left:0;';
    svgEl.innerHTML=svgAvatar(p,isGK);

    av.appendChild(img);
    av.appendChild(svgEl);

    // Try real image
    tryLoadImage(p.photo, img, svgEl, null, null);

    const nameDiv=document.createElement('div');
    nameDiv.className='pname';
    nameDiv.innerHTML=`<span class="pflag">${p.flag}</span> ${p.name}`;

    const bar=document.createElement('div');
    bar.className='skill-bar';
    bar.innerHTML=`<div class="skill-fill" style="width:${p.skill*100}%;background:${isGK?'#42a5f5':'var(--gold)'}"></div>`;

    card.appendChild(av);
    card.appendChild(nameDiv);
    card.appendChild(bar);
    card.onclick=()=>{
      if(isGK) keeper=p; else shooter=p;
      buildGrids(); refreshField(); refreshScoreboard();
    };
    wrap.appendChild(card);
  });
}

/* ══════════════════════════
   REFRESH FIELD PLAYERS
══════════════════════════ */
function refreshField(){
  // Shooter
  const sImg=document.getElementById('shooterImg');
  const sSvg=document.getElementById('shooterSvgFb');
  sSvg.innerHTML=svgAvatar(shooter,false);
  sImg.style.display='none'; sSvg.style.display='block';
  tryLoadImage(shooter.photo, sImg, sSvg, null, null);
  document.getElementById('slbl').textContent=shooter.name;

  // GK
  const gkImg=document.getElementById('gkImg');
  const gkSvg=document.getElementById('gkSvgFb');
  gkSvg.innerHTML=svgAvatar(keeper,true);
  gkImg.style.display='none'; gkSvg.style.display='block';
  tryLoadImage(keeper.photo, gkImg, gkSvg, null, null);
  document.getElementById('gklbl').textContent=keeper.name;
}

function refreshScoreboard(){
  document.getElementById('sbSName').textContent=shooter.name;
  document.getElementById('sbGName').textContent=keeper.name;
  // mini avatars
  setMiniAvatar('sbSMini', shooter, false);
  setMiniAvatar('sbGMini', keeper, true);
}
function setMiniAvatar(id, p, isGK){
  const el=document.getElementById(id);
  el.innerHTML='';
  const img=document.createElement('img');
  img.style.cssText='width:100%;height:100%;object-fit:cover;object-position:top center;display:none;border-radius:50%;';
  const svgEl=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svgEl.setAttribute('viewBox','0 0 60 120');
  svgEl.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
  svgEl.innerHTML=svgAvatar(p,isGK);
  el.appendChild(img);
  el.appendChild(svgEl);
  tryLoadImage(p.photo, img, svgEl, null, null);
}

/* ══════════════════════════
   NET SVG
══════════════════════════ */
function drawNet(){
  const svg=document.getElementById('netSvg');
  const {width:W,height:H}=svg.getBoundingClientRect();
  if(!W){setTimeout(drawNet,100);return;}
  let s='';
  for(let c=0;c<=12;c++){const x=(c/12)*W;s+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(255,255,255,.14)" stroke-width="1"/>`;}
  for(let r=0;r<=8;r++){const y=(r/8)*H;s+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,.14)" stroke-width="1"/>`;}
  for(let c=0;c<=12;c++){const x=(c/12)*W;s+=`<line x1="${x}" y1="${H}" x2="${W/2}" y2="${H*.04}" stroke="rgba(255,255,255,.06)" stroke-width=".8"/>`;}
  svg.innerHTML=s;
}
drawNet();
window.addEventListener('resize',drawNet);

/* ══════════════════════════
   ZONE GRID (GOAL)
══════════════════════════ */
function buildZoneGrid(){
  const g=document.getElementById('zoneGrid');
  g.innerHTML='';
  for(let n=1;n<=9;n++){
    const d=document.createElement('div');
    d.className='zc'+(n===pickedZone?' selected':'');
    d.innerHTML=`<div class="zc-num">${n}</div>`;
    d.onclick=()=>{ if(busy)return; pickedZone=n; buildZoneGrid(); updateHint(); };
    g.appendChild(d);
  }
}

/* ══════════════════════════
   BET GRID
══════════════════════════ */
function buildBetGrid(){
  const g=document.getElementById('betGrid');
  g.innerHTML='';
  for(let n=1;n<=9;n++){
    const d=document.createElement('div');
    d.className='bet-zone'+(n===betZone?' bsel':'');
    d.innerHTML=`<div class="znum">${n}</div><div class="zpos">${ZONE_NAMES[n]}</div>`;
    d.onclick=()=>{ betZone=n; buildBetGrid(); updateOdd(); };
    g.appendChild(d);
  }
}
function updateOdd(){
  document.getElementById('oddVal').textContent=betZone?`×${ZONE_ODDS[betZone]}`:'—';
}
function setBet(v){document.getElementById('betAmt').value=v;}
function setMax(){document.getElementById('betAmt').value=Math.min(wallet,99999);}
function updatePenaltyWallet(){
  const we=document.getElementById("penalty-walletVal");
  const we2=document.getElementById("penalty-totalWon");
  if(we)we.textContent=getSolde().toLocaleString();
  if(we2)we2.textContent=(penaltyTotalWon>=0?"+":"")+penaltyTotalWon.toLocaleString();
}
function _oldUpdateWallet(){
  document.getElementById('penalty-walletVal').textContent=wallet.toLocaleString();
  document.getElementById('penalty-totalWon').textContent=totalWon>=0?'+'+totalWon.toLocaleString():totalWon.toLocaleString();
}

/* ══════════════════════════
   HINT
══════════════════════════ */
function updateHint(){
  if(pickedZone){
    document.getElementById('shootBtn').style.display='inline-block';
    document.getElementById('hintText').innerHTML=
      `✅ <strong>${shooter.name}</strong> tire au casier <strong>${pickedZone}</strong>${betZone?` · Pari casier <strong>${betZone}</strong> (×${ZONE_ODDS[betZone]})`:''}`;
  } else {
    document.getElementById('shootBtn').style.display='none';
    document.getElementById('hintText').innerHTML=
      `👆 Cliquez un <strong>numéro dans le but</strong> pour choisir où tirer`;
  }
}

/* ══════════════════════════
   SHOOT
══════════════════════════ */
function shoot(){
  if(busy||!pickedZone)return;
  // Auth gate only if player has a bet placed
  if(betZone&&!CJ){
    showNotif("Konekte pou plase yon paryaj","err");
    return;
  }
  busy=true;
  document.getElementById('shootBtn').style.display='none';
  document.getElementById('winMsg').className='win-msg';

  // Mise
  const rawAmt=parseInt(document.getElementById('betAmt').value)||50;
  const betAmt=Math.min(Math.max(10,rawAmt),getSolde()&&CJ?getSolde():rawAmt);
  if(betZone&&CJ){deduireJ(betAmt,"Penalty","Mise penalty zone "+betZone);let st=gSt();st.dep+=betAmt;sSt(st);}
  updatePenaltyWallet();

  // Fade shooter
  document.getElementById('shooter').style.opacity='.2';

  // Target : centre du casier + petit offset aléatoire
  const {x:tx,y:ty}=zoneCenter(pickedZone);
  const fx=Math.min(.96,Math.max(.04, tx+(Math.random()-.5)*.2/3));
  const fy=Math.min(.96,Math.max(.04, ty+(Math.random()-.5)*.2/3));

  // Ball animation
  const ball=document.getElementById('ball');
  const field=document.querySelector('.field');
  const go=document.getElementById('goalOuter');
  const gk=document.getElementById('goalkeeper');
  const fr=field.getBoundingClientRect();
  const gr=go.getBoundingClientRect();
  const gl=(gr.left-fr.left)/fr.width*100;
  const gt=(gr.top-fr.top)/fr.height*100;
  const gw=gr.width/fr.width*100;
  const gh=gr.height/fr.height*100;

  ball.classList.add('fly');
  ball.style.left=(gl+fx*gw)+'%';
  ball.style.bottom=(100-(gt+fy*gh)-1)+'%';
  ball.style.width='1.5%';
  ball.style.opacity='.35';

  // GK dive (colonne du casier)
  const col=(pickedZone-1)%3;
  const gkL=col===0?'11%':col===2?'73%':'44%';
  setTimeout(()=>{
    gk.style.transition=`left ${.2+(1-keeper.skill)*.09}s cubic-bezier(.4,0,.2,1)`;
    gk.style.left=gkL;
  }, Math.max(0,(1-keeper.skill)*160));

  setTimeout(()=>{
    const res=calcResult(col,gkL);
    showResult(res, fx, fy, betAmt);
  }, 430);
}

function calcResult(col, gkL){
  const gkCol=gkL==='11%'?0:gkL==='73%'?2:1;
  const dist=Math.abs(col-gkCol);
  // Plus le gardien est proche, plus il a de chance d'arrêter
  const baseP=dist===0?.38:dist===1?.13:.03;
  const saveP=baseP*(keeper.skill/shooter.skill);
  return Math.random()<saveP?'saved':'goal';
}

function showResult(res, fx, fy, betAmt){
  // Impact marker
  const imp=document.getElementById('impact');
  imp.style.left=(fx*100)+'%';
  imp.style.top=(fy*100)+'%';
  imp.style.display='block';
  imp.style.animation='none'; void imp.offsetWidth; imp.style.animation='';

  // Highlight zone
  const cells=document.querySelectorAll('#zoneGrid .zc');
  cells.forEach((c,i)=>{
    if(i===pickedZone-1) c.className='zc '+(res==='goal'?'hit-goal':'hit-saved');
  });

  // Banner
  const ban=document.getElementById('banner');
  if(res==='goal'){
    ban.className='show goal';
    ban.textContent=`⚽ BUT ! Casier ${pickedZone}`;
    scGoal++;
    document.getElementById('scGoal').textContent=scGoal;
    // Résultat pari
    if(betZone){
      const wm=document.getElementById('winMsg');
      if(betZone===pickedZone){
        const gain=Math.round(betAmt*ZONE_ODDS[betZone]);
        if(CJ){crediterJ(gain,"Gain Penalty","Penalty zone "+pickedZone+" x"+ZONE_ODDS[betZone]);} penaltyTotalWon+=(gain-betAmt);
        updatePenaltyWallet();
        wm.className='win-msg won';
        wm.textContent=`🎉 GAGNÉ ! +${gain} pts (×${ZONE_ODDS[betZone]})`;
      } else {
        wm.className='win-msg lost';
        wm.textContent=`❌ But casier ${pickedZone} — vous aviez parié le casier ${betZone}`;
      }
    }
  } else {
    ban.className='show saved';
    ban.textContent=`🧤 Arrêté par ${keeper.name} !`;
    scSaved++;
    document.getElementById('scSaved').textContent=scSaved;
    if(betZone){
      const wm=document.getElementById('winMsg');
      wm.className='win-msg lost';
      wm.textContent=`❌ Tir arrêté — mise de ${betAmt} pts perdue`;
    }
  }

  shots.push(res);
  updateDots();
  document.getElementById('resetBtn').style.display='inline-block';
  document.getElementById('hintText').innerHTML=
    res==='goal'?`🎉 <strong>${shooter.name}</strong> marque au casier <strong>${pickedZone}</strong> !`:
    `👏 <strong>${keeper.name}</strong> arrête le tir !`;
}

function updateDots(){
  const w=document.getElementById('hdots');
  w.innerHTML='';
  const rec=shots.slice(-7);
  for(let i=0;i<7;i++){
    const d=document.createElement('div');
    d.className='hdot '+(rec[i]||'');
    w.appendChild(d);
  }
}

/* ══════════════════════════
   RESET
══════════════════════════ */
function resetShot(){
  busy=false; pickedZone=null;
  const ball=document.getElementById('ball');
  ball.classList.remove('fly');
  ball.style.cssText='position:absolute;bottom:13%;left:50%;transform:translateX(-50%);width:3.5%;aspect-ratio:1;z-index:10;pointer-events:none;transition:none;';
  document.getElementById('shooter').style.opacity='1';
  document.getElementById('goalkeeper').style.left='50%';
  document.getElementById('banner').className='';
  document.getElementById('banner').textContent='';
  document.getElementById('impact').style.display='none';
  document.getElementById('winMsg').className='win-msg';
  document.getElementById('resetBtn').style.display='none';
  buildZoneGrid();
  updateHint();
  if(wallet<50){ wallet=1000; updatePenaltyWallet(); }
}

/* ══════════════════════════
   INIT
══════════════════════════ */
// auto_removed: buildGrids();
// auto_removed: refreshField();
// auto_removed: refreshScoreboard();
// auto_removed: buildZoneGrid();
// auto_removed: buildBetGrid();
// auto_removed: updateOdd();
// auto_removed: updatePenaltyWallet();
// auto_removed: updateHint();

function initPenaltyGame(){
  scGoal=0; scSaved=0; shots=[]; busy=false; pickedZone=null; betZone=null;
  buildGrids();
  setTimeout(()=>{
    refreshField();
    refreshScoreboard();
    buildZoneGrid();
    buildBetGrid();
    updateOdd();
    updatePenaltyWallet();
    updateHint();
    drawNet();
  }, 80);
}


// ===== ADMIN: Ticker & Notifications =====
function saveAdminMessages(){
  const ticker=document.getElementById('admin-ticker-msg')?.value.trim();
  const notifText=document.getElementById('admin-notif-text-input')?.value.trim();
  const notifIcon=document.getElementById('admin-notif-icon-input')?.value.trim()||'🔔';
  const notifBg=document.getElementById('admin-notif-bg')?.value||'rgba(26,58,143,.3)';
  if(ticker) localStorage.setItem('tk_ticker_msg', ticker);
  else localStorage.removeItem('tk_ticker_msg');
  if(notifText){
    localStorage.setItem('tk_admin_notif', JSON.stringify({text:notifText,icon:notifIcon,bg:notifBg}));
  } else {
    localStorage.removeItem('tk_admin_notif');
  }
  showNotif('✅ Messages sauvegardés','ok');
}
function clearAdminMessages(){
  localStorage.removeItem('tk_ticker_msg');
  localStorage.removeItem('tk_admin_notif');
  const fields=['admin-ticker-msg','admin-notif-text-input','admin-notif-icon-input'];
  fields.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  showNotif('Messages effacés','info');
}
function loadAdminMessageFields(){
  const ticker=localStorage.getItem('tk_ticker_msg');
  const notif=localStorage.getItem('tk_admin_notif');
  const ta=document.getElementById('admin-ticker-msg');
  if(ta&&ticker) ta.value=ticker;
  if(notif){
    try{
      const n=JSON.parse(notif);
      const ti=document.getElementById('admin-notif-text-input');
      const ii=document.getElementById('admin-notif-icon-input');
      if(ti) ti.value=n.text||'';
      if(ii) ii.value=n.icon||'🔔';
    }catch(e){}
  }
}

// ===== MAIN TAB SWITCHER =====
function switchToTab(el){
  const tab = el.dataset.tab;
  document.querySelectorAll('#sc-app .atab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('#sc-app .asec').forEach(s=>s.classList.remove('on'));
  const sec = document.getElementById('tab-'+tab);
  if(sec) sec.classList.add('on');
  // Game inits
  if(tab==='roulette') setTimeout(initRoulette, 80);
  if(tab==='penalty')  setTimeout(()=>{initPenaltyGame();updatePenaltyWallet();}, 80);
  if(tab==='borlette') renderJoueurDraws && renderJoueurDraws();
  if(tab==='sports')   renderSports && renderSports();
  // Game init on tab switch (for roulette in pending game)
  document.querySelectorAll('#sc-app .atab[data-tab]').forEach(t=>{
    if(t.dataset.tab==='roulette') t.addEventListener('click',()=>setTimeout(initRoulette,100),{once:true});
  });
}

// ===== INFO MODAL for staff pages =====
function ouvrirInfo(){
  const m = document.getElementById('info-modal');
  if(m) m.classList.add('on');
}
function fermerInfo(){
  const m = document.getElementById('info-modal');
  if(m) m.classList.remove('on');
}

// ============================================================
// BORLETTE ADMIN — Gestion complète localStorage
// ============================================================
const BOR_KEY_RES    = 'tk_bor_resultats';    // résultats publiés
const BOR_KEY_BLOCK  = 'tk_bor_blocked_nums'; // numéros bloqués
const BOR_KEY_LIMITS = 'tk_bor_limits';       // limites de mise
const BOR_KEY_DRAWS  = 'tk_bor_blocked_draws';// tirages bloqués

const gBorRes    = () => JSON.parse(localStorage.getItem(BOR_KEY_RES))||[];
const sBorRes    = v  => localStorage.setItem(BOR_KEY_RES, JSON.stringify(v));
const gBorBlock  = () => JSON.parse(localStorage.getItem(BOR_KEY_BLOCK))||[];
const sBorBlock  = v  => localStorage.setItem(BOR_KEY_BLOCK, JSON.stringify(v));
const gBorLimits = () => JSON.parse(localStorage.getItem(BOR_KEY_LIMITS))||[];
const sBorLimits = v  => localStorage.setItem(BOR_KEY_LIMITS, JSON.stringify(v));
const gBorDraws  = () => JSON.parse(localStorage.getItem(BOR_KEY_DRAWS))||[];
const sBorDraws  = v  => localStorage.setItem(BOR_KEY_DRAWS, JSON.stringify(v));

function loadBorletteAdmin(){
  borRefreshResultats();
  borRefreshBlocked();
  borRefreshLimits();
  borRefreshDraws();
  borRefreshStats();
}

// === PUBLIER RÉSULTAT ===
function borPublierResultat(){
  const draw   = document.getElementById('bor-draw-select').value;
  const lotto3 = document.getElementById('bor-lotto3').value.trim();
  const lot2   = document.getElementById('bor-lot2').value.trim();
  const lot3   = document.getElementById('bor-lot3').value.trim();
  const msg    = document.getElementById('bor-publish-msg');
  if(!lotto3||lotto3.length!==3){
    msg.style.display='block';msg.style.background='rgba(230,57,70,.15)';msg.style.color='var(--red)';
    msg.textContent='❌ Lotto 3 doit avoir exactement 3 chiffres'; return;
  }
  const lot1 = lotto3.slice(-2); // 2 derniers chiffres
  const res = gBorRes();
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleString('fr-FR'),
    draw,
    lotto3,
    lot1, lot2: lot2||'—', lot3: lot3||'—',
    publishedBy: 'Admin'
  };
  res.unshift(entry);
  sBorRes(res);
  // Notify joueurs via localStorage event
  localStorage.setItem('tk_bor_last_result', JSON.stringify(entry));
  msg.style.display='block';msg.style.background='rgba(40,176,78,.15)';msg.style.color='var(--green2)';
  msg.textContent='✅ Résultat publié: '+draw.toUpperCase()+' — Lot1: '+lot1+' | Lot2: '+(lot2||'—')+' | Lot3: '+(lot3||'—');
  // Clear fields
  ['bor-lotto3','bor-lot2','bor-lot3'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  setTimeout(()=>{msg.style.display='none';},5000);
  borRefreshResultats();
  borRefreshStats();
  // Resolve borlette bets
  borResolveAllBets(entry);
}

function borResolveAllBets(res){
  const allBets = gB();
  const DRAW_MAP = {tunisia:'Tunisia',florida:'Florida',newyork:'New York',georgia:'Georgia',texas:'Texas'};
  const drawName = DRAW_MAP[res.draw]||res.draw;
  let updated = false;
  allBets.forEach(b => {
    if(b.statut !== 'En attente') return;
    if(b.type !== 'borlette' && b.type !== 'Borlette') return;
    if(b.draw && b.draw !== drawName && b.draw !== res.draw) return;
    // Check win
    let won = false;
    const sel = String(b.selection);
    if(b.subType === 'borlette' && sel === res.lot1) won = true;
    if(b.subType === 'lotto3' && sel === res.lotto3) won = true;
    if(b.subType === 'lotto2' && sel === res.lot2) won = true;
    if(b.subType === 'lotto3b' && sel === res.lot3) won = true;
    if(won){
      b.statut = 'Gagné';
      const gain = Math.round(b.mise * (b.cote||50));
      b.gainPotentiel = gain;
      // Credit joueur
      const j = gJ();
      if(j[b.joueurPhone]){
        crediterJ && crediterJ(gain,'Gain Borlette','Borlette '+drawName+': '+sel+' — Gain '+gain+' Gd');
      }
    } else {
      b.statut = 'Perdu';
    }
    updated = true;
  });
  if(updated){ sB(allBets); }
}

// === AFFICHER RÉSULTATS ===
function borRefreshResultats(){
  const tbody = document.getElementById('bor-resultats-body');
  if(!tbody) return;
  const res = gBorRes();
  if(!res.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--muted)">Aucun résultat publié</td></tr>';
    return;
  }
  tbody.innerHTML = res.slice(0,30).map(r=>`
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px;font-size:11px;color:var(--muted)">${r.date}</td>
      <td style="padding:7px;font-weight:700;text-transform:uppercase">${r.draw}</td>
      <td style="padding:7px;text-align:center"><span style="background:var(--blue);color:#fff;padding:2px 8px;border-radius:6px;font-weight:900">${r.lot1}</span></td>
      <td style="padding:7px;text-align:center">${r.lot2||'—'}</td>
      <td style="padding:7px;text-align:center">${r.lot3||'—'}</td>
      <td style="padding:7px"><button onclick="borSupprimerResultat(${r.id})" style="background:none;border:1px solid var(--red);color:var(--red);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">✕</button></td>
    </tr>
  `).join('');
}

function borSupprimerResultat(id){
  if(!confirm('Supprimer ce résultat ?')) return;
  const res = gBorRes().filter(r=>r.id!==id);
  sBorRes(res);
  borRefreshResultats();
}

// === BLOQUER NUMÉRO ===
function borBloquerNumero(){
  const num  = document.getElementById('bor-block-num').value.trim().padStart(2,'0');
  const draw = document.getElementById('bor-block-draw').value;
  if(!num||num.length>2){ showNotif('Numéro invalide (00-99)','err'); return; }
  const list = gBorBlock();
  const key  = draw ? draw+':'+num : 'all:'+num;
  if(!list.includes(key)){
    list.push(key);
    sBorBlock(list);
  }
  document.getElementById('bor-block-num').value='';
  borRefreshBlocked();
  showNotif('✅ Numéro '+num+' bloqué'+(draw?' pour '+draw:''),'ok');
}

function borRefreshBlocked(){
  const el = document.getElementById('bor-blocked-list');
  if(!el) return;
  const list = gBorBlock();
  if(!list.length){ el.innerHTML='<span style="color:var(--muted)">Aucun numéro bloqué</span>'; return; }
  el.innerHTML = list.map(k=>{
    const [draw,num] = k.split(':');
    const label = draw==='all'?'Tous — '+num:draw+' — '+num;
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(230,57,70,.15);border:1px solid var(--red);border-radius:6px;padding:3px 8px;margin:2px;font-size:12px;font-weight:700;">
      🚫 ${label}
      <button onclick="borDebloquerNum('${k}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 2px;">✕</button>
    </span>`;
  }).join('');
}

function borDebloquerNum(key){
  const list = gBorBlock().filter(k=>k!==key);
  sBorBlock(list);
  borRefreshBlocked();
}

// === LIMITES ===
function borSetLimite(){
  const num  = document.getElementById('bor-limit-num').value.trim().padStart(2,'0');
  const amt  = parseInt(document.getElementById('bor-limit-amt').value);
  const draw = document.getElementById('bor-limit-draw').value;
  if(!num||!amt||amt<=0){ showNotif('Numéro et montant requis','err'); return; }
  const list  = gBorLimits();
  const key   = draw ? draw+':'+num : 'all:'+num;
  const exist = list.findIndex(l=>l.key===key);
  if(exist>=0) list[exist].amt=amt;
  else list.push({key,num,draw,amt});
  sBorLimits(list);
  document.getElementById('bor-limit-num').value='';
  document.getElementById('bor-limit-amt').value='';
  borRefreshLimits();
  showNotif('✅ Limite '+amt+' Gd pour numéro '+num,'ok');
}

function borRefreshLimits(){
  const el = document.getElementById('bor-limits-list');
  if(!el) return;
  const list = gBorLimits();
  if(!list.length){ el.innerHTML='<span style="color:var(--muted)">Aucune limite définie</span>'; return; }
  el.innerHTML = list.map(l=>`
    <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(26,58,143,.2);border:1px solid var(--blue);border-radius:6px;padding:3px 8px;margin:2px;font-size:12px;font-weight:700;">
      💰 ${l.draw||'Tous'}:${l.num} max ${l.amt} Gd
      <button onclick="borSupprLimite('${l.key}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 2px;">✕</button>
    </span>`
  ).join('');
}

function borSupprLimite(key){
  sBorLimits(gBorLimits().filter(l=>l.key!==key));
  borRefreshLimits();
}

// === BLOQUER TIRAGE ===
function borBloquerTirage(){
  const draw = document.getElementById('bor-toggle-draw').value;
  const list = gBorDraws();
  if(!list.includes(draw)){ list.push(draw); sBorDraws(list); }
  borRefreshDraws();
  showNotif('🔒 Tirage '+draw+' bloqué','ok');
}
function borDebloquerTirage(){
  const draw = document.getElementById('bor-toggle-draw').value;
  sBorDraws(gBorDraws().filter(d=>d!==draw));
  borRefreshDraws();
  showNotif('🔓 Tirage '+draw+' débloqué','ok');
}
function borRefreshDraws(){
  const el = document.getElementById('bor-blocked-draws');
  if(!el) return;
  const list = gBorDraws();
  if(!list.length){ el.textContent='Aucun tirage bloqué'; return; }
  el.innerHTML = '🔒 Bloqués: '+list.map(d=>`<span style="background:rgba(230,57,70,.15);border:1px solid var(--red);padding:2px 8px;border-radius:6px;margin:2px;font-size:12px;font-weight:700;">${d}</span>`).join('');
}

// === STATS ===
function borRefreshStats(){
  const bets = gB().filter(b=>b.type==='borlette'||b.type==='Borlette');
  const total  = bets.length;
  const mise   = bets.reduce((s,b)=>s+b.mise,0);
  const pay    = bets.filter(b=>b.statut==='Gagné').reduce((s,b)=>s+(b.gainPotentiel||0),0);
  const net    = mise - pay;
  const el = n => document.getElementById(n);
  if(el('bor-stat-total'))  el('bor-stat-total').textContent  = total;
  if(el('bor-stat-mise'))   el('bor-stat-mise').textContent   = mise.toLocaleString('fr-FR')+' Gd';
  if(el('bor-stat-pay'))    el('bor-stat-pay').textContent    = pay.toLocaleString('fr-FR')+' Gd';
  if(el('bor-stat-net'))    el('bor-stat-net').textContent    = net.toLocaleString('fr-FR')+' Gd';
}

// === CHECK if number is blocked (used by borlette game) ===
function isBorNumBlocked(num, draw){
  const list = gBorBlock();
  const n = String(num).padStart(2,'0');
  const drawKey = draw ? draw.toLowerCase().replace(' ','') : '';
  return list.includes('all:'+n) || (drawKey && list.includes(drawKey+':'+n));
}
function isBorDrawBlocked(draw){
  const drawKey = draw ? draw.toLowerCase().replace(' ','') : '';
  return gBorDraws().includes(drawKey);
}
function getBorLimit(num, draw){
  const list = gBorLimits();
  const n = String(num).padStart(2,'0');
  const drawKey = draw ? draw.toLowerCase().replace(' ','') : '';
  const specific = list.find(l=>l.key===drawKey+':'+n);
  const global   = list.find(l=>l.key==='all:'+n);
  return specific ? specific.amt : global ? global.amt : null;
}

// ============================================================
// JACKPOT SYSTEM
// 5% of weekly sales accumulate per directeur
// Admin decides when to award it
// ============================================================
const JK_KEY = 'tk_jackpots'; // {dirCode: {amount, weekMises, lastReset, history}}
const gJK = () => JSON.parse(localStorage.getItem(JK_KEY))||{};
const sJK = v  => localStorage.setItem(JK_KEY, JSON.stringify(v));

// Called when a bet is placed - accumulate 5% to jackpot of that dir
function jackpotAccumuler(mise, dirCode){
  if(!dirCode) dirCode = CCaiss?.dirCode || CDir?.code || '';
  if(!dirCode) return;
  const jk = gJK();
  if(!jk[dirCode]) jk[dirCode]={amount:0, weekMises:0, lastReset:new Date().toISOString(), history:[]};
  const contribution = Math.round(mise * 0.05);
  jk[dirCode].amount += contribution;
  jk[dirCode].weekMises += mise;
  sJK(jk);
}

// Admin: attribute jackpot to a random ticket
function jackpotAttribuer(dirCode){
  const jk = gJK();
  if(!jk[dirCode]||jk[dirCode].amount<=0){
    showNotif('Jackpot vide pour ce directeur','err'); return;
  }
  const amount = jk[dirCode].amount;
  // Pick a random player from that director
  const j = gJ();
  const players = Object.values(j).filter(p=>p.dirCode===dirCode);
  if(!players.length){ showNotif('Aucun joueur pour ce directeur','err'); return; }
  const winner = players[Math.floor(Math.random()*players.length)];
  // Credit winner
  const jj = gJ();
  if(jj[winner.phone]){
    jj[winner.phone].solde = (jj[winner.phone].solde||0) + amount;
    sJ(jj);
  }
  // Record and reset
  jk[dirCode].history.unshift({
    date: new Date().toLocaleString(),
    amount,
    winner: winner.name,
    winnerPhone: winner.phone
  });
  jk[dirCode].amount = 0;
  jk[dirCode].weekMises = 0;
  jk[dirCode].lastReset = new Date().toISOString();
  sJK(jk);
  showNotif('🎉 Jackpot '+amount+' Gd attribué à '+winner.name,'ok');
  renderAdminJackpot();
}

// Admin: manually set jackpot amount
function jackpotSetManuel(dirCode){
  const amt = parseInt(document.getElementById('jk-manual-'+dirCode)?.value||'0');
  if(!amt||amt<=0){ showNotif('Montant invalide','err'); return; }
  const jk = gJK();
  if(!jk[dirCode]) jk[dirCode]={amount:0,weekMises:0,lastReset:new Date().toISOString(),history:[]};
  jk[dirCode].amount = amt;
  sJK(jk);
  showNotif('✅ Jackpot défini: '+amt+' Gd','ok');
  renderAdminJackpot();
}

// Render admin jackpot panel
function renderAdminJackpot(){
  const el = document.getElementById('admin-jackpot-list');
  if(!el) return;
  const dirs = gDirs();
  const jk = gJK();
  const list = Object.values(dirs);
  if(!list.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px">Aucun directeur</div>'; return; }
  el.innerHTML = list.map(d=>{
    const djk = jk[d.code]||{amount:0,weekMises:0};
    const bgColor = djk.amount > 50000 ? 'rgba(245,200,0,.15)' : 'var(--bg2)';
    const borderColor = djk.amount > 50000 ? 'rgba(245,200,0,.5)' : 'var(--border)';
    return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <div style="font-weight:800;color:var(--gold);font-size:15px">${d.name}</div>
          <div style="font-size:11px;color:var(--muted)">${d.zone} · Code: ${d.code}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:2em;font-weight:900;color:#f5c800;text-shadow:0 0 10px rgba(245,200,0,.5);">
            ${djk.amount.toLocaleString('fr-FR')} Gd
          </div>
          <div style="font-size:10px;color:var(--muted)">JACKPOT</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Ventes cette semaine: <strong style="color:var(--text)">${(djk.weekMises||0).toLocaleString('fr-FR')} Gd</strong>
        · 5% accumulé: <strong style="color:var(--gold)">${Math.round((djk.weekMises||0)*0.05).toLocaleString('fr-FR')} Gd</strong>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button onclick="jackpotAttribuer('${d.code}')" style="background:linear-gradient(135deg,var(--gold),#d4a800);color:#000;border:none;padding:8px 14px;border-radius:7px;font-weight:800;font-size:12px;cursor:pointer;${djk.amount<=0?'opacity:.4;cursor:not-allowed':''}"
          ${djk.amount<=0?'disabled':''}>🎉 Attribuer à un joueur</button>
        <input type="number" id="jk-manual-${d.code}" placeholder="Montant manuel" style="width:130px;padding:7px 10px;background:var(--bg);color:#fff;border:1px solid var(--border);border-radius:7px;font-size:12px;outline:none;">
        <button onclick="jackpotSetManuel('${d.code}')" style="background:var(--blue);color:#fff;border:none;padding:8px 12px;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;">Définir</button>
        <button onclick="jackpotReset('${d.code}')" style="background:var(--red);color:#fff;border:none;padding:8px 12px;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;">🔄 Réinitialiser</button>
        <button onclick="jackpotOuvrirEcran('${d.code}')" style="background:rgba(26,58,143,.6);border:1px solid var(--blue);color:#fff;padding:8px 12px;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;">🖥️ Écran Extérieur</button>
      </div>
    </div>`;
  }).join('');
}

function jackpotReset(dirCode){
  if(!confirm('Réinitialiser le jackpot de ce directeur ?')) return;
  const jk = gJK();
  if(jk[dirCode]){ jk[dirCode].amount=0; jk[dirCode].weekMises=0; sJK(jk); }
  renderAdminJackpot();
  showNotif('Jackpot réinitialisé','ok');
}

// Get jackpot for current director (shown to dir + players)
function getJackpotDir(){
  const dirCode = CDir?.code || CCaiss?.dirCode || '';
  if(!dirCode) return 0;
  const jk = gJK();
  return jk[dirCode]?.amount || 0;
}

// Jackpot display widget for player screen
function renderJackpotWidget(){
  const el = document.getElementById('jackpot-display');
  if(!el) return;
  const amount = getJackpotDir();
  if(amount <= 0){ el.style.display='none'; return; }
  el.style.display='block';
  const amtEl = document.getElementById('jackpot-amount');
  if(amtEl) amtEl.textContent = amount.toLocaleString('fr-FR')+' Gd';
}

// ============================================================
// JACKPOT ECRAN EXTÉRIEUR
// Ouvrir dans un nouvel onglet pour afficher sur écran TV/moniteur
// ============================================================
function jackpotOuvrirEcran(dirCode){
  const jk=gJK();
  const dirs=gDirs();
  const d=dirs[dirCode];
  if(!d){showNotif('Directeur introuvable','err');return;}
  const amount=(jk[dirCode]?.amount||0).toLocaleString('fr-FR');
  const html=`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Jackpot — ${d.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;color:#fff;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;font-family:'Barlow Condensed',sans-serif;}
.bg{position:fixed;inset:0;background:radial-gradient(ellipse at center,#1a0d40 0%,#000 70%);z-index:0;}
.stars{position:fixed;inset:0;z-index:1;}
.content{position:relative;z-index:2;text-align:center;padding:40px;}
.logo-wrap{margin-bottom:30px;}
.logo-wrap img{width:100px;height:100px;border-radius:50%;border:4px solid #f5c800;box-shadow:0 0 30px rgba(245,200,0,.5);}
.label{font-size:clamp(20px,3vw,32px);color:rgba(255,255,255,.6);letter-spacing:6px;text-transform:uppercase;margin-bottom:10px;}
.bureau{font-size:clamp(24px,4vw,40px);color:#f5c800;letter-spacing:4px;margin-bottom:30px;}
@keyframes pulse{0%,100%{text-shadow:0 0 20px rgba(245,200,0,.5),0 0 40px rgba(245,200,0,.3)}50%{text-shadow:0 0 40px rgba(245,200,0,.9),0 0 80px rgba(245,200,0,.6),0 0 120px rgba(245,200,0,.3)}}
.amount{font-size:clamp(60px,12vw,140px);font-weight:900;color:#f5c800;animation:pulse 2s ease-in-out infinite;line-height:1;}
.currency{font-size:clamp(30px,5vw,60px);color:#f5c800;margin-top:10px;}
@keyframes scroll{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
.ticker{position:fixed;bottom:0;left:0;right:0;background:rgba(245,200,0,.15);border-top:2px solid #f5c800;padding:10px 0;overflow:hidden;}
.ticker-inner{white-space:nowrap;animation:scroll 20s linear infinite;font-size:20px;color:#f5c800;letter-spacing:2px;}
.refresh{position:fixed;top:10px;right:15px;font-size:12px;color:rgba(255,255,255,.3);}
</style>
</head>
<body>
<div class="bg"></div>
<div class="content">
  <div class="logo-wrap"><img src="logo.png" onerror="this.style.display='none'" alt="TK"></div>
  <div class="label">🎰 JACKPOT EN JEU</div>
  <div class="bureau">Bureau: ${d.name} — ${d.zone}</div>
  <div class="amount">${amount}</div>
  <div class="currency">GOURDES HAÏTIENS</div>
</div>
<div class="ticker"><div class="ticker-inner">🎰 JACKPOT TONTON KONDO — Bureau ${d.name} — ${amount} Gd — Chak tikè ka genyen jackpot la! &nbsp;&nbsp;&nbsp; 🎰 JACKPOT TONTON KONDO — Bureau ${d.name} — ${amount} Gd — Chak tikè ka genyen jackpot la!</div></div>
<div class="refresh">Rafraîchi chaque 30s</div>
</body></html>`;
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  window.open(url,'_blank');
}

// Jackpot screen via URL parameter (for external display)
function jackpotCheckURLParam(){
  const params=new URLSearchParams(window.location.search);
  const dirCode=params.get('jackpot');
  if(dirCode){
    // Redirect to jackpot display
    jackpotOuvrirEcran(dirCode);
  }
}

// ===== SESSION RESTORE =====
(function(){
  const role = localStorage.getItem('tk_session_role');
  const phone = localStorage.getItem('tk_session_phone');
  const code = localStorage.getItem('tk_session_code');
  if(!role){ window.location.href='index.html'; return; }
  if(role==='joueur'&&phone){
    const j=gJ();
    if(j[phone]){ CJ=j[phone]; MODE='compte'; goTo('sc-app'); updateAppBar(); initKeno(); initLucky6(); initCourse(); renderSports(); renderJHist(); setTimeout(renderJackpotWidget,200); if(typeof renderJoueurDraws==='function') renderJoueurDraws(); }
    else { window.location.href='index.html'; }
  } else if(role==='admin'){
    refreshAdmin(); goTo('sc-admin');
  } else if(role==='directeur'&&code){
    const dirs=gDirs();
    const found=Object.values(dirs).find(d=>d.code===code);
    if(found){ CDir=found; document.getElementById('dir-zone-name').textContent=found.zone; refreshDir(); goTo('sc-dir'); setTimeout(()=>{const jk=gJK();const djk=jk[found.code];const el=document.getElementById('jackpot-display-dir');const amt=document.getElementById('jackpot-amount-dir');if(el&&djk&&djk.amount>0){el.style.display='block';if(amt)amt.textContent=djk.amount.toLocaleString('fr-FR')+' Gd';}},300); }
    else { window.location.href='index.html'; }
  } else if(role==='caissier'&&code){
    const caiss=gCaiss();
    const found=Object.values(caiss).find(c=>c.code===code);
    if(found){ CCaiss=found; document.getElementById('caiss-name-display').textContent=found.name; document.getElementById('caiss-jeu-label').textContent=JEU_LABELS[found.jeu]||found.jeu; goTo('sc-sec'); }
    else { window.location.href='index.html'; }
  } else { window.location.href='index.html'; }

  // Game init on tab switch
  document.querySelectorAll('.atab[data-tab]').forEach(tab=>{
    tab.addEventListener('click',()=>{
      if(tab.dataset.tab==='roulette') setTimeout(initRoulette, 100);
      if(tab.dataset.tab==='penalty') { setTimeout(initPenaltyGame, 100); setTimeout(updatePenaltyWallet, 200); }
    });
  });
})();
