/* ═══════════════════════════════════════════════════
   TK_GAMES.JS — Logique des jeux et interface joueur
   Modifier ici: Keno, Lucky6, Course, Hélico,
   Roulette, Penalty, Sports, Borlette joueur,
   Caissier, Directeur, Auth joueur
   ═══════════════════════════════════════════════════ */



// ===== STORAGE =====
const SK={j:'tk_joueurs',tix:'tk_tickets',stats:'tk_stats',bets:'tk_bets',diff:'tk_diff',allT:'tk_alltrans',dir:'tk_dirs',caiss:'tk_caiss',rch:'tk_recharges',caissBets:'tk_caisse_bets'};
const gJ=()=>JSON.parse(localStorage.getItem(SK.j))||{};
const sJ=v=>localStorage.setItem(SK.j,JSON.stringify(v));
const gSt=()=>JSON.parse(localStorage.getItem(SK.stats))||{dep:0,pay:0};
const sSt=v=>localStorage.setItem(SK.stats,JSON.stringify(v));
const gB=()=>JSON.parse(localStorage.getItem(SK.bets))||[];
const sB=v=>localStorage.setItem(SK.bets,JSON.stringify(v));
const gAT=()=>JSON.parse(localStorage.getItem(SK.allT))||[];
const sAT=v=>localStorage.setItem(SK.allT,JSON.stringify(v));
const gDirs=()=>JSON.parse(localStorage.getItem(SK.dir))||{};
const sDirs=v=>localStorage.setItem(SK.dir,JSON.stringify(v));
const gCaiss=()=>JSON.parse(localStorage.getItem(SK.caiss))||{};
const sCaiss=v=>localStorage.setItem(SK.caiss,JSON.stringify(v));
const gRch=()=>JSON.parse(localStorage.getItem(SK.rch))||[];
const sRch=v=>localStorage.setItem(SK.rch,JSON.stringify(v));
const gCB=()=>JSON.parse(localStorage.getItem(SK.caissBets))||[];
const sCB=v=>localStorage.setItem(SK.caissBets,JSON.stringify(v));
const getDiff=()=>localStorage.getItem(SK.diff)||'medium';
const setDiff=d=>localStorage.setItem(SK.diff,d);

const JEU_LABELS={keno:'🎯 Keno Lucky',lucky6:'🍀 Lucky 6',course:'🏎️ Course Auto',sports:'⚽ Paris Sportifs',helico:'🚁 Hélicoptère',all:'🎰 Tous les jeux'};

// ===== NAVIGATION =====
let curSc='sc-landing';
function goTo(id){
  const prev=document.getElementById(curSc);
  if(prev)prev.classList.remove('active');
  const next=document.getElementById(id);
  if(next){next.classList.add('active');window.scrollTo(0,0);}
  curSc=id;
  if(id==='sc-landing')renderLandingDirs();
}

// ===== LANDING DIRS =====
function renderLandingDirs(){
  const dirs=gDirs(),caiss=gCaiss(),j=gJ(),at=gAT();
  const grid=document.getElementById('landing-dirs-grid');
  const dlist=Object.values(dirs);
  if(!dlist.length){grid.innerHTML='<div style="color:var(--muted);font-size:13px;padding:10px">Aucun directeur configuré.</div>';return;}
  grid.innerHTML=dlist.map(d=>{
    const myCaiss=Object.values(caiss).filter(c=>c.dirCode===d.code).length;
    const myJ=Object.values(j).filter(jj=>jj.dirCode===d.code);
    const myAt=at.filter(t=>t.dirCode===d.code);
    const totalDep=myAt.filter(t=>t.montant>0).reduce((a,t)=>a+t.montant,0);
    const totalPay=myAt.filter(t=>t.montant<0).reduce((a,t)=>a+Math.abs(t.montant),0);
    const profit=totalDep-totalPay;
    return `<div class="dir-stat-card">
      <div class="dsc-name">${d.name}</div>
      <div class="dsc-zone">📍 ${d.zone}</div>
      <div class="dsc-stats">
        <div class="dsc-stat"><div class="v">${myCaiss}</div><div class="l">Caissiers</div></div>
        <div class="dsc-stat"><div class="v">${myJ.length}</div><div class="l">Joueurs</div></div>
        <div class="dsc-stat ${profit>=0?'green':'red'}"><div class="v">${profit>0?'+':''}${profit}Gd</div><div class="l">Profit</div></div>
      </div>
    </div>`;
  }).join('');
}

// ===== JOUEUR AUTH =====
let CJ=null, CT=null, MODE=null, CCaiss=null, CDir=null;

function showBox(id){
  ['box-login','box-reg'].forEach(b=>{
    const el=document.getElementById(b);
    if(el)el.style.display=b===id?'block':'none';
  });
}

function loginJoueur(){
  const phone=document.getElementById('lphone').value.trim();
  const pwd=document.getElementById('lpwd').value;
  const err=document.getElementById('lerr');
  err.classList.remove('show');
  const j=gJ();
  if(!j[phone]||j[phone].pwd!==pwd){err.textContent='Numéro ou mot de passe incorrect.';err.classList.add('show');return;}
  CJ=j[phone];MODE='compte';
  _entrerApp();
}

function registerJoueur(){
  const name=document.getElementById('rname').value.trim();
  const phone=document.getElementById('rphone').value.trim();
  const pwd=document.getElementById('rpwd').value;
  const pwd2=document.getElementById('rpwd2').value;
  const err=document.getElementById('rerr');
  err.classList.remove('show');
  if(!name||!phone||!pwd){err.textContent='Tous les champs sont obligatoires.';err.classList.add('show');return;}
  if(pwd!==pwd2){err.textContent='Mots de passe différents.';err.classList.add('show');return;}
  const j=gJ();
  if(j[phone]){err.textContent='Ce numéro est déjà utilisé.';err.classList.add('show');return;}
  j[phone]={name,phone,pwd,solde:0,dirCode:'',caissCode:'',createdAt:new Date().toLocaleString(),transactions:[]};
  sJ(j);
  showNotif('✅ Compte créé ! Connectez-vous.','ok');
  showBox('box-login');
}

function _entrerApp(){
  document.getElementById('tab-sports-btn').style.display='';
  document.getElementById('tab-hist-btn').style.display='';
  document.getElementById('sports-lock').style.display='none';
  document.getElementById('sports-content').style.display='block';
  updateAppBar();
  initKeno();initLucky6();initCourse();
  renderSports();renderJHist();
  document.querySelectorAll('.atab[data-tab]').forEach(t=>t.classList.remove('on'));
  document.querySelector('.atab[data-tab]').classList.add('on');
  document.querySelectorAll('.asec').forEach(s=>s.classList.remove('on'));
  document.getElementById('tab-casino').classList.add('on');
  clearSlip();
  goTo('sc-app');
}


function toggleComptes(el){
  const body = document.getElementById('comptes-body');
  const icon = document.getElementById('comptes-toggle-icon');
  if(!body) return;
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : 'block';
  if(icon) icon.textContent = visible ? '▼' : '▲';
}

function logoutAdmin(){
  localStorage.removeItem('tk_session_role');
  localStorage.removeItem('tk_session_code');
  localStorage.removeItem('tk_session_phone');
  window.location.href='index.html';
}
function logoutJoueur(){
  CJ=null;CT=null;MODE=null;clearSlip();
  document.getElementById('cpbar').classList.remove('on');
  document.getElementById('cppanel').classList.remove('on');
  showBox('box-login');
  if(CCaiss){goTo('sc-sec');refreshSec();}
  else goTo('sc-landing');
}

function updateAppBar(){
  if(!CJ)return;
  const j=gJ()[CJ.phone]||CJ;CJ=j;
  document.getElementById('abAv').textContent=j.name.charAt(0).toUpperCase();
  document.getElementById('abName').textContent=j.name;
  document.getElementById('abPhone').textContent=j.phone;
  document.getElementById('abSolde').textContent=(j.solde||0)+' Gd';
}

function getSolde(){if(CJ){return gJ()[CJ.phone]?.solde||0;}return 0;}

function addTx(phone,type,montant,details,soldeApres){
  const j=gJ();if(!j[phone])return;
  if(!j[phone].transactions)j[phone].transactions=[];
  const tx={date:new Date().toLocaleString(),type,montant,soldeApres:soldeApres||j[phone].solde,details};
  j[phone].transactions.unshift(tx);sJ(j);
  const at=gAT();
  at.unshift({...tx,joueurName:j[phone].name,phone,
    dirCode:j[phone].dirCode||'',caissCode:CCaiss?.code||'',caissName:CCaiss?.name||''});
  sAT(at);
}

function deduireJ(montant,type,details){
  if(CJ){
    const j=gJ();
    j[CJ.phone].solde=(j[CJ.phone].solde||0)-montant;
    sJ(j);addTx(CJ.phone,type,-montant,details,j[CJ.phone].solde);
    CJ=j[CJ.phone];
  }
  updateAppBar();
}

function crediterJ(montant,type,details){
  if(CJ){
    const j=gJ();
    j[CJ.phone].solde=(j[CJ.phone].solde||0)+montant;
    sJ(j);addTx(CJ.phone,type,montant,details,j[CJ.phone].solde);
    CJ=j[CJ.phone];
  }
  updateAppBar();
}



// APP TABS
document.querySelectorAll('.atab[data-tab]').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.atab[data-tab]').forEach(t=>t.classList.remove('on'));
    tab.classList.add('on');
    document.querySelectorAll('.asec').forEach(s=>s.classList.remove('on'));
    document.getElementById('tab-'+tab.dataset.tab).classList.add('on');
    if(tab.dataset.tab==='historique')renderJHist();
    if(tab.dataset.tab!=='sports'){document.getElementById('cpbar').classList.remove('on');document.getElementById('cppanel').classList.remove('on');}
    else updateCPBar();
  });
});

function selJeu(el,jeu){
  document.querySelectorAll('.jtab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  ['keno','lucky6','course','helico'].forEach(j=>{
    const el2=document.getElementById('jeu-'+j);
    if(el2)el2.style.display=j===jeu?'block':'none';
  });
  if(jeu==='helico')initHelico();
}

// ===== RECHARGE Moncash/Natcash =====

function showRechargeModal(method){goTo('sc-jauth');setTimeout(()=>{showBox('box-login');},100);}


// ===== CAISSIER AUTH =====
function authSec(){
  const cod=document.getElementById('scod').value.trim().toUpperCase();
  const pwd=document.getElementById('spwd').value;
  const err=document.getElementById('serr');err.classList.remove('show');
  const caiss=gCaiss();
  const found=Object.values(caiss).find(c=>c.code===cod&&c.pwd===pwd);
  if(!found){err.textContent='Code ou mot de passe incorrect.';err.classList.add('show');return;}
  CCaiss=found;
  document.getElementById('caiss-name-display').textContent=found.name;
  document.getElementById('caiss-jeu-display').textContent=JEU_LABELS[found.jeu]||found.jeu;
  document.getElementById('caiss-jeu-label').textContent=JEU_LABELS[found.jeu]||found.jeu;
  refreshSec();
  goTo('sc-sec');
}

function selSecTab(el){
  document.querySelectorAll('#sc-sec .ptab').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  document.querySelectorAll('#sc-sec .psec').forEach(s=>s.classList.remove('on'));
  const id='stab-'+el.dataset.ptab;
  const sec=document.getElementById(id);
  if(sec)sec.classList.add('on');
  if(el.dataset.ptab==='recharges')refreshRecharges();
  if(el.dataset.ptab==='caisse')refreshCaisseBets();
}

function refreshSec(){}

// -- Comptes Joueurs --
let curSP=null;
function rechercherCompte(){
  const phone=document.getElementById('search-phone').value.trim();
  const j=gJ();const res=document.getElementById('compte-result');
  if(!j[phone]){showNotif('Aucun compte pour ce numéro','err');res.classList.remove('on');return;}
  curSP=phone;const jj=j[phone];
  document.getElementById('res-av').textContent=jj.name.charAt(0).toUpperCase();
  document.getElementById('res-name').textContent=jj.name;
  document.getElementById('res-phone').textContent=jj.phone;
  document.getElementById('res-solde').textContent=(jj.solde||0)+' Gd';
  const hist=(jj.transactions||[]);
  document.getElementById('res-hist').innerHTML=hist.length
    ?hist.map(t=>`<div>${t.date} — <b>${t.type}</b>: ${t.montant>0?'+':''}${t.montant} Gd — ${t.details}</div>`).join('')
    :'<div style="color:var(--muted)">Aucune transaction.</div>';
  res.classList.add('on');
}
function rechargerCompte(){
  if(!curSP)return;
  const amt=parseInt(document.getElementById('trans-amount').value)||0;
  if(amt<=0){showNotif('Montant invalide','err');return;}
  const j=gJ();
  j[curSP].solde=(j[curSP].solde||0)+amt;
  sJ(j);addTx(curSP,'Dépôt',amt,'Rechargement caisse',j[curSP].solde);
  let st=gSt();st.dep+=amt;sSt(st);
  showNotif('+ '+amt+' Gd rechargés','ok');rechercherCompte();
  if(CJ&&CJ.phone===curSP){CJ=gJ()[curSP];updateAppBar();}
}
function retirerCompte(){
  if(!curSP)return;
  const amt=parseInt(document.getElementById('trans-amount').value)||0;
  const j=gJ();
  if(amt<=0||amt>(j[curSP].solde||0)){showNotif('Montant invalide','err');return;}
  j[curSP].solde-=amt;
  sJ(j);addTx(curSP,'Retrait',-amt,'Retrait caisse',j[curSP].solde);
  showNotif('- '+amt+' Gd retirés','ok');rechercherCompte();
  if(CJ&&CJ.phone===curSP){CJ=gJ()[curSP];updateAppBar();}
}

// -- Créer Joueur --
function caissCreerJoueur(){
  const name=document.getElementById('nj-name').value.trim();
  const phone=document.getElementById('nj-phone').value.trim();
  const solde=parseInt(document.getElementById('nj-solde').value)||0;
  const pwd=document.getElementById('nj-pwd').value;
  const err=document.getElementById('nj-err');err.classList.remove('show');
  if(!name||!phone||!pwd){err.textContent='Tous les champs sont obligatoires.';err.classList.add('show');return;}
  const j=gJ();
  if(j[phone]){err.textContent='Ce numéro existe déjà.';err.classList.add('show');return;}
  j[phone]={name,phone,pwd,solde,dirCode:CCaiss?.dirCode||'',caissCode:CCaiss?.code||'',caissName:CCaiss?.name||'',createdAt:new Date().toLocaleString(),transactions:[]};
  if(solde>0){
    j[phone].transactions.push({date:new Date().toLocaleString(),type:'Dépôt initial',montant:solde,soldeApres:solde,details:'Ouverture compte'});
    const at=gAT();
    at.unshift({date:new Date().toLocaleString(),type:'Dépôt initial',montant:solde,soldeApres:solde,details:'Ouverture compte',
      joueurName:name,phone,dirCode:CCaiss?.dirCode||'',caissCode:CCaiss?.code||'',caissName:CCaiss?.name||''});
    sAT(at);let st=gSt();st.dep+=solde;sSt(st);
  }
  sJ(j);
  showNotif('✅ Joueur créé: '+name,'ok');
  ['nj-name','nj-phone','nj-pwd'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('nj-solde').value='0';
}

// -- JEU EN CAISSE --

let caisseJoueur=null;


function showTicketsGagnants(jeu,joues,tirage,gain,mise){
  const overlay=document.getElementById('tickets-win-overlay');
  document.getElementById('tw-date').textContent=new Date().toLocaleString();
  let html='';
  if(jeu==='keno'||jeu==='lucky6'){
    const hits=joues.filter(n=>tirage.includes(n));
    html+=`<div class="ticket-win-item"><span class="name">Numéros joués</span><span style="color:var(--text);font-size:12px">${joues.join(', ')}</span></div>`;
    html+=`<div class="ticket-win-item"><span class="name">Numéros sortis</span><span style="color:var(--blue);font-size:12px">${tirage.slice(0,20).join(', ')}</span></div>`;
    html+=`<div class="ticket-win-item"><span class="name">✅ Correspondances</span><span class="gain">${hits.join(', ')||'Aucune'}</span></div>`;
  } else if(jeu==='course'){
    const VNAMES=['—','Ferrari SF-23','Red Bull RB19','Mercedes W14','McLaren MCL60','Aston Martin','Alpine A523'];
    html+=`<div class="ticket-win-item"><span class="name">Voiture pariée</span><span style="color:var(--text)">#${joues[0]} ${VNAMES[joues[0]]}</span></div>`;
    html+=`<div class="ticket-win-item"><span class="name">🏆 Vainqueur</span><span class="gain">#${tirage[0]} ${VNAMES[tirage[0]]||''}</span></div>`;
  }
  if(gain>0){
    html+=`<div class="ticket-win-item" style="background:rgba(40,176,78,.15);border:1px solid var(--green2)"><span class="name">💰 GAIN</span><span class="gain">+${gain} Gd</span></div>`;
  } else {
    html+=`<div class="ticket-win-item" style="background:rgba(230,57,70,.1)"><span class="name">❌ Perdu</span><span style="color:var(--red)">-${mise} Gd</span></div>`;
  }
  document.getElementById('tw-list').innerHTML=html;
  overlay.classList.add('on');
}

function afficherTicketsGagnants(){
  const cb=gCB().slice(0,5);
  if(!cb.length){showNotif('Aucun pari en caisse','info');return;}
  const overlay=document.getElementById('tickets-win-overlay');
  document.getElementById('tw-date').textContent='Derniers paris';
  document.getElementById('tw-list').innerHTML=cb.map(b=>`
    <div class="ticket-win-item">
      <span class="name">${b.joueurName} · ${JEU_LABELS[b.jeu]||b.jeu}</span>
      <span class="${b.gain>0?'gain':''}" style="${b.gain>0?'color:var(--gold)':'color:var(--red)'}">${b.gain>0?'+'+b.gain:'-'+b.mise} Gd</span>
    </div>`).join('');
  overlay.classList.add('on');
}

function refreshCaisseBets(){
  const cb=gCB().slice(0,20);
  const el=document.getElementById('caisse-last-bets');
  if(!el)return;
  el.innerHTML=cb.map(b=>`<div>${b.date} — <b>${b.joueurName}</b> · ${JEU_LABELS[b.jeu]||b.jeu} · Mise: ${b.mise} Gd · <span style="color:${b.gain>0?'var(--green2)':'var(--red)'}">${b.gain>0?'Gain: +'+b.gain+' Gd':'Perdu'}</span></div>`).join('')||'<div style="color:var(--muted)">Aucun pari.</div>';
}

// -- Recharges --




// ===== DIRECTEUR AUTH =====
function authDir(){
  const cod=document.getElementById('dcod').value.trim().toUpperCase();
  const pwd=document.getElementById('dpwd').value;
  const err=document.getElementById('derr');err.classList.remove('show');
  const dirs=gDirs();
  const found=Object.values(dirs).find(d=>d.code===cod&&d.pwd===pwd);
  if(!found){err.textContent='Code ou mot de passe incorrect.';err.classList.add('show');return;}
  CDir=found;
  document.getElementById('dir-zone-name').textContent=found.zone;
  refreshDir();
  goTo('sc-dir');
}

function selDirTab(el){
  document.querySelectorAll('#sc-dir .ptab').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  document.querySelectorAll('#sc-dir .psec').forEach(s=>s.classList.remove('on'));
  document.getElementById('dtab-'+el.dataset.ptab).classList.add('on');
  refreshDir();
}

function refreshDir(){
  if(!CDir)return;
  const caiss=gCaiss(),j=gJ(),at=gAT();
  const myCaiss=Object.values(caiss).filter(c=>c.dirCode===CDir.code);
  const myJ=Object.values(j).filter(jj=>jj.dirCode===CDir.code);
  const myAt=at.filter(t=>t.dirCode===CDir.code);
  const totalDep=myAt.filter(t=>t.montant>0).reduce((a,t)=>a+t.montant,0);
  const totalPay=myAt.filter(t=>t.montant<0).reduce((a,t)=>a+Math.abs(t.montant),0);

  document.getElementById('dir-stats').innerHTML=[
    {v:myCaiss.length,l:'Caissiers',c:'sblue'},{v:myJ.length,l:'Joueurs',c:'spurp'},
    {v:totalDep+' Gd',l:'Total dépôts',c:'sgreen'},{v:totalPay+' Gd',l:'Total payés',c:'sred'},
    {v:(totalDep-totalPay)+' Gd',l:'Profit',c:'sgold'},
  ].map(s=>`<div class="statcard"><div class="sv ${s.c}">${s.v}</div><div class="sl">${s.l}</div></div>`).join('');

  // Caissiers overview
  const tb1=document.querySelector('#dir-caissiers-table tbody');
  if(tb1)tb1.innerHTML=myCaiss.map(c=>{
    const nb=Object.values(j).filter(jj=>jj.caissCode===c.code).length;
    return`<tr><td>${c.name}</td><td>${JEU_LABELS[c.jeu]||c.jeu}</td><td><code style="color:var(--gold)">${c.code}</code></td><td>${nb}</td></tr>`;
  }).join('')||'<tr><td colspan="4" style="color:var(--muted);text-align:center">Aucun caissier</td></tr>';

  // Caissiers list
  const tb2=document.getElementById('dir-caiss-tbody');
  if(tb2)tb2.innerHTML=myCaiss.map(c=>`<tr>
    <td>${c.name}</td><td><code style="color:var(--gold)">${c.code}</code></td>
    <td>${JEU_LABELS[c.jeu]||c.jeu}</td>
    <td><button class="tbtn r" onclick="supprimerCaissier('${c.code}')">Supprimer</button></td>
  </tr>`).join('')||'<tr><td colspan="4" style="color:var(--muted);text-align:center">Aucun caissier</td></tr>';

  // Joueurs
  const tb3=document.getElementById('dir-joueurs-tbody');
  if(tb3)tb3.innerHTML=myJ.map(jj=>{
    const c=Object.values(caiss).find(c=>c.code===jj.caissCode);
    return`<tr><td>${jj.name}</td><td>${jj.phone}</td><td style="color:var(--gold)">${jj.solde||0} Gd</td><td>${c?c.name:'—'}</td></tr>`;
  }).join('')||'<tr><td colspan="4" style="color:var(--muted);text-align:center">Aucun joueur</td></tr>';

  // Transactions
  const tb4=document.getElementById('dir-trans-tbody');
  if(tb4)tb4.innerHTML=myAt.slice(0,50).map(t=>`<tr>
    <td style="font-size:10px">${t.date}</td><td>${t.joueurName}</td>
    <td><span class="sbadge ${t.montant>0?'sbd':'sbr'}">${t.type}</span></td>
    <td style="${t.montant>0?'color:var(--green2)':'color:var(--red)'}">${t.montant>0?'+':''}${t.montant} Gd</td>
    <td>${t.caissName||'—'}</td>
  </tr>`).join('')||'<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:14px">Aucune transaction</td></tr>';
}



function supprimerCaissier(code){
  if(!confirm('Supprimer ce caissier ?'))return;
  const caiss=gCaiss();delete caiss[code];sCaiss(caiss);
  refreshDir();showNotif('Caissier supprimé','ok');
}

// ===== ADMIN AUTH =====
function authAdmin(){
  const p=document.getElementById('apwd').value;
  const err=document.getElementById('aerr');err.classList.remove('show');
  if(p==='admin'){refreshAdmin();goTo('sc-admin');}
  else{err.textContent='Mot de passe incorrect.';err.classList.add('show');}
}










function resoudrePari(betId,statut){
  const bets=gB();const bet=bets.find(b=>b.id==betId);
  if(!bet||bet.statut!=='En attente')return;
  bet.statut=statut;
  if(statut==='Gagné'){
    const j=gJ();if(j[bet.phone]){
      j[bet.phone].solde=(j[bet.phone].solde||0)+bet.gainPotentiel;
      sJ(j);addTx(bet.phone,'Gain Sportif',bet.gainPotentiel,'Pari gagné: '+bet.match,j[bet.phone].solde);
      let st=gSt();st.pay+=bet.gainPotentiel;sSt(st);
      if(CJ&&CJ.phone===bet.phone){CJ=gJ()[bet.phone];updateAppBar();}
    }
  }
  sB(bets);refreshAdmin();showNotif(statut==='Gagné'?'✅ Gain crédité':'❌ Pari perdu','ok');
}

// ADMIN PARAMS
const DIFF_VALS=['easy','medium','hard','veryhard'];
const DIFF_PCTS={easy:'60%',medium:'45%',hard:'30%',veryhard:'10%'};


function loadAdminDiffs(){['keno','lucky6','course','helico'].forEach(game=>{const d=getGameDiff(game);const idx=DIFF_VALS.indexOf(d)+1;const r=document.getElementById(game+'-diff-range');if(r)r.value=idx||2;const l=document.getElementById(game+'-pct-lbl');if(l)l.textContent=DIFF_PCTS[d]||'45%';});}

// ===== UTILS =====
function selSport(el,s){document.querySelectorAll('.stab').forEach(x=>x.classList.remove('on'));el.classList.add('on');}
function actChip(el){document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));el.classList.add('on');}
function showNotif(msg,type){
  const n=document.getElementById('notif');
  n.textContent=msg;n.className='notif '+(type||'ok')+' on';
  clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('on'),3200);
}
function closeMov(id){document.getElementById(id).classList.remove('on');}
document.querySelectorAll('.mov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('on');}));

// ===== KENO =====
let kenoSel=[];
// Keno color zones: 1-20=Rouge, 21-40=Bleu, 41-60=Vert, 61-80=Or
const KENO_COLORS=[
  {min:1,max:20,name:'Rouge',css:'#c0152a',light:'#ff4466'},
  {min:21,max:40,name:'Bleu',css:'#1565c0',light:'#42a5f5'},
  {min:41,max:60,name:'Vert',css:'#1b5e20',light:'#66bb6a'},
  {min:61,max:80,name:'Or',css:'#8a6820',light:'#f5c800'},
];
function getKenoBallColor(n){return KENO_COLORS.find(c=>n>=c.min&&n<=c.max)||KENO_COLORS[0];}

function initKeno(){
  const g=document.getElementById('keno-grid');
  g.innerHTML=''; kenoSel=[];
  for(let i=1;i<=80;i++){
    const col=getKenoBallColor(i);
    const b=document.createElement('button');
    b.className='kbtn';b.id='kn'+i;
    b.style.cssText=`background:${col.css};border:1px solid ${col.light};color:#fff;`;
    b.textContent=i;
    b.onclick=()=>{
      if(kenoSel.includes(i)){
        kenoSel=kenoSel.filter(x=>x!==i);
        b.style.background=col.css;b.style.borderColor=col.light;b.style.transform='';
      } else if(kenoSel.length<10){
        kenoSel.push(i);
        b.style.background=col.light;b.style.borderColor='#fff';b.style.transform='scale(1.1)';
      } else showNotif('Maximum 10 numéros !','err');
    };
    g.appendChild(b);
  }
  // Color bet section
  renderKenoCouleurs();
}

function renderKenoCouleurs(){
  const el=document.getElementById('keno-couleurs');
  if(!el)return;
  el.innerHTML=KENO_COLORS.map(c=>`
    <div onclick="betKenoCouleur('${c.name}')"
      style="background:${c.css};border:2px solid ${c.light};border-radius:10px;padding:10px;text-align:center;cursor:pointer;transition:.2s;"
      id="kc-${c.name}">
      <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px">${c.name}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.1em;font-weight:900;color:#fff;">${c.min}–${c.max}</div>
      <div style="font-size:10px;color:${c.light};margin-top:2px">×4</div>
    </div>`).join('');
}

let kenoCouleurSel=null;
function betKenoCouleur(name){
  kenoCouleurSel=kenoCouleurSel===name?null:name;
  KENO_COLORS.forEach(c=>{
    const el=document.getElementById('kc-'+c.name);
    if(el)el.style.outline=kenoCouleurSel===c.name?'3px solid #fff':'none';
  });
}
async function jouerKeno(){
  if(!CJ){showNotif("Connectez-vous d'abord",'err');return;}
  if(!kenoSel.length){showNotif('Choisissez au moins 1 numéro','err');return;}
  const mise=parseInt(document.getElementById('keno-mise').value)||0;
  const sol=getSolde();
  if(mise<=0||mise>sol){showNotif('Mise invalide ou solde insuffisant','err');return;}
  deduireJ(mise,'Mise Casino',`Keno (${kenoSel.length} numéros)`);
  let st=gSt();st.dep+=mise;sSt(st);
  document.querySelectorAll('.kbtn').forEach(b=>b.classList.remove('win'));
  const tirage=[];
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,1500));
    let r;do{r=Math.floor(Math.random()*80)+1;}while(tirage.includes(r));
    tirage.push(r);
    const b=document.getElementById('kn'+r);if(b)b.classList.add('win');
  }
  let hits=kenoSel.filter(n=>tirage.includes(n)).length;
  const df={easy:1.5,medium:1.0,hard:0.5,veryhard:0.2}[getGameDiff('keno')]||1.0;
  hits=Math.min(kenoSel.length,Math.round(hits*df));
  const gain=mise*hits*2;
  if(gain>0){crediterJ(gain,'Gain Casino',`Keno: ${hits}/${kenoSel.length} trouvés`);st=gSt();st.pay+=gain;sSt(st);}
  document.getElementById('keno-status').textContent=gain>0?`${hits} trouvé(s) — Gain: ${gain} Gourdes`:`${hits} trouvé(s) — Perte: ${mise} Gourdes`;
}
document.getElementById('keno-play').addEventListener('click',jouerKeno);

// ===== LUCKY6 =====
let l6sel=[];
// Lucky6 color zones: 1-12=Rouge, 13-24=Bleu, 25-36=Vert, 37-48=Or
const L6_COLORS=[
  {min:1,max:12,name:'Rouge',css:'#c0152a',light:'#ff4466',hex:'#c0152a'},
  {min:13,max:24,name:'Bleu',css:'#1565c0',light:'#42a5f5',hex:'#1565c0'},
  {min:25,max:36,name:'Vert',css:'#1b5e20',light:'#66bb6a',hex:'#1b5e20'},
  {min:37,max:48,name:'Or',css:'#7a5800',light:'#f5c800',hex:'#7a5800'},
];
function getL6BallColor(n){return L6_COLORS.find(c=>n>=c.min&&n<=c.max)||L6_COLORS[0];}

function initLucky6(){
  const g=document.getElementById('lucky6-grid');
  g.innerHTML='';l6sel=[];
  for(let i=1;i<=48;i++){
    const col=getL6BallColor(i);
    const b=document.createElement('div');
    b.className='ball';b.id='l6n'+i;
    b.style.cssText=`background:radial-gradient(circle at 35% 35%,${col.light},${col.css});border:2px solid ${col.light};color:#fff;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,.4);`;
    b.textContent=i;
    b.onclick=()=>{
      if(l6sel.includes(i)){
        l6sel=l6sel.filter(x=>x!==i);
        b.style.background=`radial-gradient(circle at 35% 35%,${col.light},${col.css})`;
        b.style.transform='';b.style.boxShadow='0 2px 6px rgba(0,0,0,.4)';
      } else if(l6sel.length<6){
        l6sel.push(i);
        b.style.background=`radial-gradient(circle at 35% 35%,#fff,${col.light})`;
        b.style.transform='scale(1.15)';
        b.style.boxShadow=`0 0 12px ${col.light}`;
      }
    };
    g.appendChild(b);
  }
  // Color bet section for Lucky6
  renderL6Couleurs();
  // Reset tableau tirage
  document.getElementById('draw-container').innerHTML='';
  document.getElementById('draw-progress-txt').textContent='en attente';
  document.getElementById('draw-hits').textContent='0 / 6 trouvés';
}

function renderL6Couleurs(){
  const el=document.getElementById('l6-couleurs');
  if(!el)return;
  el.innerHTML=L6_COLORS.map(c=>`
    <div onclick="betL6Couleur('${c.name}')"
      style="background:radial-gradient(135deg,${c.light},${c.css});border:2px solid ${c.light};border-radius:10px;padding:9px;text-align:center;cursor:pointer;transition:.2s;"
      id="l6c-${c.name}">
      <div style="font-size:10px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1px">${c.name}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1em;font-weight:900;color:#fff;">${c.min}–${c.max}</div>
      <div style="font-size:10px;color:#fff;margin-top:1px">×4</div>
    </div>`).join('');
}

let l6CouleurSel=null;
function betL6Couleur(name){
  l6CouleurSel=l6CouleurSel===name?null:name;
  L6_COLORS.forEach(c=>{
    const el=document.getElementById('l6c-'+c.name);
    if(el)el.style.outline=l6CouleurSel===c.name?'3px solid #fff':'none';
  });
}

async function jouerLucky6(){
  if(!CJ){showNotif("Connectez-vous d'abord",'err');return;}
  if(l6sel.length!==6){showNotif('Sélectionnez exactement 6 numéros','err');return;}
  const mise=parseInt(document.getElementById('lucky6-mise').value)||0;
  const sol=getSolde();
  if(mise<=0||mise>sol){showNotif('Mise invalide','err');return;}

  document.getElementById('lucky6-play').disabled=true;
  deduireJ(mise,'Mise Casino','Lucky6');
  let st=gSt();st.dep+=mise;sSt(st);

  // Pool de tirage selon difficulté
  let pn=l6sel.slice(),on=Array.from({length:48},(_,i)=>i+1).filter(n=>!pn.includes(n));
  for(let i=on.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[on[i],on[j]]=[on[j],on[i]];}
  for(let i=pn.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pn[i],pn[j]]=[pn[j],pn[i]];}
  const diff=getGameDiff('lucky6');
  let fp = diff==='easy'    ? pn.concat(on)
         : diff==='medium'  ? pn.slice(0,3).concat(on,pn.slice(3))
         : diff==='hard'    ? pn.slice(0,2).concat(on,pn.slice(2))
         : pn.concat(on);
  if(diff==='veryhard'){for(let i=fp.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[fp[i],fp[j]]=[fp[j],fp[i]];}}

  // Tirage — affichage compact dans tableau
  const box=document.getElementById('draw-container');
  const prog=document.getElementById('draw-progress-txt');
  const hitsEl=document.getElementById('draw-hits');
  box.innerHTML='';
  let found=0,lastIdx=-1,total=Math.min(35,fp.length);

  for(let i=0;i<total;i++){
    await new Promise(r=>setTimeout(r,200)); // rapide — 200ms par boule
    const num=fp[i];
    const isHit=l6sel.includes(num);
    if(isHit){found++;lastIdx=i;}

    // Ajouter dans le mini-tableau
    const dn=document.createElement('span');
    dn.className='dn '+(isHit?'hit':'miss');
    dn.textContent=num;
    box.appendChild(dn);

    prog.textContent = `boule ${i+1} / ${total}`;
    hitsEl.textContent = `${found} / 6 trouvés`;
    hitsEl.style.color = found>0 ? 'var(--green)' : 'var(--gold)';

    if(found===6){
      prog.textContent='✅ Tous trouvés !';
      break;
    }
  }

  // Résultat
  const gain=found===6 ? mise*Math.max(1,36-(lastIdx+1)) : 0;
  if(gain>0){
    crediterJ(gain,'Gain Casino',`Lucky6 ${found}/6 — Position ${lastIdx+1}`);
    st=gSt();st.pay+=gain;sSt(st);
    hitsEl.style.color='var(--green)';
  }
  document.getElementById('lucky6-status').textContent =
    found===6 ? `🎉 GAGNÉ ! +${gain} Gourdes` : `😔 PERDU — ${found}/6 trouvés`;
  document.getElementById('lucky6-play').disabled=false;
}
document.getElementById('lucky6-play').addEventListener('click',jouerLucky6);

// =====================================================
// COURSE DE VOITURES
// =====================================================
const VOITURES=[
  {id:1, nom:'Ferrari SF-23',    pilote:'C. Leclerc',  emoji:'🔴', couleur:'#dc0000', cote:2.10},
  {id:2, nom:'Red Bull RB19',    pilote:'M. Verstappen',emoji:'🔵',couleur:'#0600ef', cote:1.75},
  {id:3, nom:'Mercedes W14',     pilote:'L. Hamilton',  emoji:'⚫', couleur:'#00d2be', cote:2.50},
  {id:4, nom:'McLaren MCL60',    pilote:'L. Norris',    emoji:'🟠', couleur:'#ff8700', cote:3.20},
  {id:5, nom:'Aston Martin AMR', pilote:'F. Alonso',    emoji:'🟢', couleur:'#006f62', cote:4.00},
  {id:6, nom:'Alpine A523',      pilote:'P. Gasly',     emoji:'🩵', couleur:'#0090ff', cote:5.50},
];

let selectedCar=null;
let raceRunning=false;

function initCourse(){
  // Piste réaliste avec numéros de course
  const lanesEl=document.getElementById('race-lanes');
  lanesEl.innerHTML=VOITURES.map((v,idx)=>`
    <div class="track-lane" id="lane-${v.id}" style="background:${idx%2===0?'rgba(255,255,255,.02)':'transparent'}">
      <div class="lane-bg" style="background:repeating-linear-gradient(90deg,transparent,transparent 30px,rgba(255,255,255,.03) 30px,rgba(255,255,255,.03) 32px)"></div>
      <div class="car-info">
        <div class="car-num" style="background:${v.couleur};color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)">${v.id}</div>
        <div>
          <div class="car-name">${v.nom}</div>
          <div class="car-driver">${v.pilote}</div>
        </div>
        <div class="car-cote">${v.cote.toFixed(2)}x</div>
      </div>
      <div class="car-bar"><div class="car-bar-fill" id="bar-${v.id}" style="background:linear-gradient(90deg,${v.couleur},${v.couleur}cc);width:0%"></div></div>
      <div class="car-emoji" id="car-${v.id}" style="left:128px">🏎️</div>
      <div class="car-pos" id="pos-${v.id}" style="display:none;background:rgba(0,0,0,.75);color:#fff"></div>
    </div>`).join('');

  // Cartes sélection
  const grid=document.getElementById('cars-grid');
  grid.innerHTML=VOITURES.map(v=>`
    <div class="car-card" id="cc-${v.id}" onclick="selVoiture(${v.id})">
      <div class="cc-num" style="background:${v.couleur}">${v.id}</div>
      <div class="cc-info">
        <div class="cc-name">${v.nom}</div>
        <div class="cc-driver">${v.pilote}</div>
      </div>
      <div class="cc-cote">${v.cote.toFixed(2)}x</div>
    </div>`).join('');
}

function selVoiture(id){
  if(raceRunning) return;
  selectedCar=id;
  document.querySelectorAll('.car-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('cc-'+id).classList.add('sel');
  const v=VOITURES.find(x=>x.id===id);
  document.getElementById('course-status').textContent=
    `🏎️ Voiture #${id} — ${v.nom} | Cote: ${v.cote.toFixed(2)} | Mise pour gagner`;
}

async function lancerCourse(){
  if(!CJ){showNotif("Connectez-vous d'abord",'err');return;}
  if(!selectedCar){showNotif('Choisissez une voiture !','err');return;}
  if(raceRunning){showNotif('Course en cours...','info');return;}

  const mise=parseInt(document.getElementById('course-mise').value)||0;
  const sol=getSolde();
  if(mise<=0||mise>sol){showNotif('Mise invalide ou solde insuffisant','err');return;}

  raceRunning=true;
  document.getElementById('course-play').disabled=true;
  document.getElementById('race-result').classList.remove('show');
  document.getElementById('course-status').textContent='🚦 Prêt... Partez !';
  deduireJ(mise,'Mise Casino',`Course Auto — Voiture #${selectedCar}`);
  let st=gSt();st.dep+=mise;sSt(st);

  // Reset piste
  VOITURES.forEach(v=>{
    document.getElementById('bar-'+v.id).style.width='0%';
    document.getElementById('car-'+v.id).style.left='118px';
    document.getElementById('pos-'+v.id).style.display='none';
  });
  document.getElementById('race-lap').textContent='0';

  // Vitesses aléatoires biaisées selon difficulté
  const diff=getGameDiff('course');
  const dfMap={easy:1.4,medium:1.0,hard:0.7,veryhard:0.4};
  const boost=dfMap[diff]||1.0;

  // Vitesse de base pour chaque voiture (aléatoire)
  let speeds=VOITURES.map(v=>({
    id:v.id,
    speed: Math.random()*2+1, // 1-3 de base
    progress:0,
    finished:false,
    position:0
  }));

  // Booster légèrement la voiture du joueur selon difficulté
  const playerSpeed=speeds.find(s=>s.id===selectedCar);
  if(playerSpeed) playerSpeed.speed*=boost;

  // Animation — 50 ticks, interval 120ms = ~6 secondes
  const TRACK_W=100; // pourcentage
  const TICKS=80;
  let finishOrder=[];
  let lap=0;

  for(let tick=0;tick<TICKS;tick++){
    await new Promise(r=>setTimeout(r,120));

    // Mettre à jour progression de chaque voiture
    speeds.forEach(s=>{
      if(s.finished) return;
      // Variation aléatoire de vitesse
      const variation=(Math.random()-0.45)*0.8;
      s.progress+=s.speed+variation;
      s.progress=Math.max(0,Math.min(s.progress,100));

      // Mettre à jour barre
      document.getElementById('bar-'+s.id).style.width=s.progress+'%';
      // Déplacer emoji voiture (de 118px à ~90% de la largeur disponible)
      const laneEl=document.getElementById('lane-'+s.id);
      const laneW=laneEl.offsetWidth;
      const carX=118 + (s.progress/100)*(laneW-160);
      document.getElementById('car-'+s.id).style.left=Math.max(118,carX)+'px';

      // Tour
      if(s.progress>=100 && !s.finished){
        s.finished=true;
        s.position=finishOrder.length+1;
        finishOrder.push(s.id);
        const posEl=document.getElementById('pos-'+s.id);
        posEl.style.display='flex';
        posEl.textContent='#'+s.position;
        posEl.style.background=s.position===1?'var(--gold)':s.position===2?'#aaa':s.position===3?'#cd7f32':'#333';
        posEl.style.color=s.position<=3?'#000':'#888';
      }
    });

    // Lap counter
    const avgProgress=speeds.reduce((a,s)=>a+s.progress,0)/speeds.length;
    const newLap=Math.min(5,Math.floor(avgProgress/20)+1);
    if(newLap!==lap){
      lap=newLap;
      document.getElementById('race-lap').textContent=lap;
    }

    // Si tout le monde a fini
    if(finishOrder.length===VOITURES.length) break;
  }

  // Forcer les non-finis dans l'ordre
  speeds.filter(s=>!s.finished).sort((a,b)=>b.progress-a.progress)
    .forEach(s=>{
      s.position=finishOrder.length+1;
      finishOrder.push(s.id);
      const posEl=document.getElementById('pos-'+s.id);
      posEl.style.display='flex';
      posEl.textContent='#'+s.position;
      posEl.style.background='#333';
      posEl.style.color='#888';
    });

  // Résultats
  const winner=finishOrder[0];
  const v=VOITURES.find(x=>x.id===selectedCar);
  const playerPos=finishOrder.indexOf(selectedCar)+1;
  const gagne=playerPos===1;
  const gain=gagne ? parseFloat((mise*v.cote).toFixed(2)) : 0;

  if(gagne){
    crediterJ(gain,'Gain Casino',`Course Auto — Voiture #${selectedCar} 1ère place`);
    st=gSt();st.pay+=gain;sSt(st);
  }

  // Afficher classement
  const resultList=document.getElementById('race-result-list');
  resultList.innerHTML=finishOrder.map((cid,idx)=>{
    const cv=VOITURES.find(x=>x.id===cid);
    const isPlayer=cid===selectedCar;
    const posClass=['pos1','pos2','pos3','pos-other','pos-other','pos-other'][idx]||'pos-other';
    return `<div class="result-row" style="${isPlayer?'background:rgba(245,166,35,.08);border-radius:6px;':''}">
      <div class="result-pos ${posClass}">${idx+1}</div>
      <div style="font-size:14px;margin-right:4px">${cv.emoji}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:${isPlayer?'var(--gold)':'var(--text)'}">${cv.nom} ${isPlayer?'← TOI':''}</div>
        <div style="font-size:10px;color:#888">${cv.pilote}</div>
      </div>
      ${idx===0?'<div style="font-size:11px;color:var(--gold);font-weight:700">🏆 VAINQUEUR</div>':''}
    </div>`;
  }).join('');

  document.getElementById('race-result').classList.add('show');

  if(gagne){
    document.getElementById('course-status').textContent=`🏆 VICTOIRE ! +${gain} Gourdes`;
    showNotif(`🏆 Voiture #${selectedCar} gagne ! +${gain} Gourdes`,'ok');
  } else {
    document.getElementById('course-status').textContent=`😔 Voiture #${selectedCar} termine ${playerPos}ème — Perdu`;
    showNotif(`😔 Voiture #${selectedCar} — ${playerPos}ème place`,'err');
  }

  raceRunning=false;
  selectedCar=null;
  document.querySelectorAll('.car-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('course-play').disabled=false;
}

document.getElementById('course-play').addEventListener('click',lancerCourse);

const HELICO_LEVELS=[
  {alt:50,  cote:1.20, label:'50m'},
  {alt:100, cote:1.50, label:'100m'},
  {alt:200, cote:2.00, label:'200m'},
  {alt:400, cote:3.00, label:'400m'},
  {alt:600, cote:4.50, label:'600m'},
  {alt:800, cote:6.00, label:'800m'},
  {alt:1000,cote:8.00, label:'1000m'},
  {alt:1500,cote:12.0, label:'1500m'},
  {alt:2000,cote:20.0, label:'2000m'},
];

let helicoRunning=false, helicoMise=0, helicoAlt=0, helicoCote=1.0;
let helicoTimer=null, helicoCtx=null, helicoFrame=0;
let helicoCrashed=false, helicoY=0, helicoVY=0;
let clouds=[];

function initHelico(){
  const canvas=document.getElementById('helico-canvas');
  canvas.width=canvas.offsetWidth||320;
  canvas.height=280;
  helicoCtx=canvas.getContext('2d');
  helicoRunning=false; helicoAlt=0; helicoCote=1.0; helicoFrame=0; helicoCrashed=false;
  helicoY=220; helicoVY=0;

  // Nuages aléatoires
  clouds=Array.from({length:6},()=>({
    x:Math.random()*canvas.width, y:Math.random()*180+20,
    w:40+Math.random()*60, speed:0.3+Math.random()*0.4
  }));

  // Paliers
  const levEl=document.getElementById('helico-levels');
  levEl.innerHTML=HELICO_LEVELS.map(l=>
    `<div class="helico-level" id="hlv-${l.alt}">${l.label} · ${l.cote}x</div>`
  ).join('');

  document.getElementById('helico-cash').style.display='none';
  document.getElementById('helico-start').style.display='inline-flex';
  document.getElementById('helico-status').textContent='Entrez votre mise et décollez !';
  document.getElementById('helico-alt').textContent='0m';
  document.getElementById('helico-cote').textContent='1.00x';
  document.getElementById('helico-danger-bar').style.width='0%';
  document.getElementById('helico-crash-msg').style.display='none';

  drawHelico();
}

function drawHelico(){
  const canvas=document.getElementById('helico-canvas');
  if(!canvas||!helicoCtx) return;
  const ctx=helicoCtx;
  const W=canvas.width, H=canvas.height;

  // Ciel dégradé
  const skyGrad=ctx.createLinearGradient(0,0,0,H);
  const altPct=Math.min(helicoAlt/2000,1);
  const r=Math.round(10+altPct*5), g=Math.round(14+altPct*20), b=Math.round(30+altPct*80);
  skyGrad.addColorStop(0,`rgb(${r},${g+20},${b+40})`);
  skyGrad.addColorStop(1,`rgb(${r},${g},${b})`);
  ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);

  // Étoiles (haute altitude)
  if(altPct>0.4){
    ctx.fillStyle=`rgba(255,255,255,${(altPct-0.4)*0.8})`;
    for(let i=0;i<30;i++){
      const sx=(i*137)%W, sy=(i*79)%120;
      ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill();
    }
  }

  // Nuages
  ctx.fillStyle=`rgba(255,255,255,${0.6-altPct*0.5})`;
  clouds.forEach(c=>{
    if(helicoRunning) c.x-=c.speed;
    if(c.x+c.w<0) c.x=W+c.w;
    ctx.beginPath();
    ctx.ellipse(c.x,c.y,c.w/2,12,0,0,Math.PI*2);
    ctx.fill();
    ctx.ellipse(c.x-c.w*0.2,c.y+4,c.w*0.35,9,0,0,Math.PI*2);
    ctx.fill();
    ctx.ellipse(c.x+c.w*0.2,c.y+5,c.w*0.3,8,0,0,Math.PI*2);
    ctx.fill();
  });

  // Sol avec montagne
  ctx.fillStyle='#1a3a1a';
  ctx.beginPath(); ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=20) ctx.lineTo(x,H-20+Math.sin(x*0.05+helicoFrame*0.02)*8);
  ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

  // Hélicoptère
  const hx=W*0.3, hy=helicoY;
  // Corps
  ctx.fillStyle=helicoCrashed?'#ff3d57':'#00c853';
  ctx.beginPath(); ctx.ellipse(hx,hy,28,12,0,0,Math.PI*2); ctx.fill();
  // Cockpit
  ctx.fillStyle=helicoCrashed?'#cc0000':'#00f2ff';
  ctx.beginPath(); ctx.ellipse(hx+10,hy-2,14,9,0.2,0,Math.PI*2); ctx.fill();
  // Queue
  ctx.strokeStyle=helicoCrashed?'#ff3d57':'#00c853'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(hx-28,hy); ctx.lineTo(hx-48,hy-10); ctx.stroke();
  // Rotor principal
  if(!helicoCrashed){
    ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=3;
    const angle=helicoFrame*0.25;
    ctx.beginPath();
    ctx.moveTo(hx+Math.cos(angle)*35,hy-12+Math.sin(angle)*4);
    ctx.lineTo(hx+Math.cos(angle+Math.PI)*35,hy-12+Math.sin(angle+Math.PI)*4);
    ctx.stroke();
    // Rotor queue
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(hx-48,hy-10+Math.cos(angle*1.5)*8);
    ctx.lineTo(hx-48,hy-10-Math.cos(angle*1.5)*8);
    ctx.stroke();
  } else {
    // Explosion
    ctx.fillStyle='rgba(255,100,0,0.8)';
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      ctx.beginPath(); ctx.arc(hx+Math.cos(a)*20,hy+Math.sin(a)*15,4,0,Math.PI*2); ctx.fill();
    }
  }

  // Altitude visuelle (ligne de ref)
  if(helicoRunning && helicoAlt>0){
    ctx.strokeStyle='rgba(0,200,83,0.3)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0,helicoY); ctx.lineTo(W,helicoY); ctx.stroke();
    ctx.setLineDash([]);
  }

  helicoFrame++;
  if(helicoRunning||helicoFrame<60) requestAnimationFrame(drawHelico);
}

async function demarrerHelico(){
  if(!CJ){showNotif("Connectez-vous d'abord",'err');return;}
  if(helicoRunning){return;}
  const mise=parseInt(document.getElementById('helico-mise').value)||0;
  const sol=getSolde();
  if(mise<=0||mise>sol){showNotif('Mise invalide ou solde insuffisant','err');return;}

  helicoMise=mise; helicoAlt=0; helicoCote=1.0; helicoCrashed=false;
  helicoRunning=true; helicoY=220; helicoVY=-1.5;

  deduireJ(mise,'Mise Casino','Hélicoptère');
  let st=gSt();st.dep+=mise;sSt(st);

  document.getElementById('helico-start').style.display='none';
  document.getElementById('helico-cash').style.display='inline-flex';
  document.getElementById('helico-cash').disabled=false;
  document.getElementById('helico-status').textContent='🚁 En vol ! Encaissez au bon moment !';
  document.getElementById('helico-crash-msg').style.display='none';
  HELICO_LEVELS.forEach(l=>document.getElementById('hlv-'+l.alt)?.classList.remove('reached','active'));

  // Difficulté — détermine hauteur max avant crash probable
  const diff=getGameDiff('helico');
  const maxAltMap={easy:1200,medium:700,hard:400,veryhard:200};
  const maxAlt=maxAltMap[diff]||700;
  // Crash aléatoire entre 50% et 100% de maxAlt
  const crashAlt=maxAlt*(0.5+Math.random()*0.5);

  requestAnimationFrame(drawHelico);

  helicoTimer=setInterval(()=>{
    if(!helicoRunning) return;

    // Montée progressive avec accélération
    helicoAlt+=8+Math.floor(helicoAlt/100);
    helicoCote=parseFloat((1+helicoAlt/200).toFixed(2));

    // Déplacer hélico visuellement vers le haut
    helicoY=Math.max(40, 220-(helicoAlt/2000)*180);

    document.getElementById('helico-alt').textContent=helicoAlt+'m';
    document.getElementById('helico-cote').textContent=helicoCote.toFixed(2)+'x';

    // Barre de danger
    const danger=Math.min(100,Math.round((helicoAlt/crashAlt)*100));
    document.getElementById('helico-danger-bar').style.width=danger+'%';
    document.getElementById('helico-danger-bar').style.background=
      danger<50?'var(--green)':danger<80?'var(--gold)':'var(--red)';

    // Mettre à jour paliers
    HELICO_LEVELS.forEach(l=>{
      const el=document.getElementById('hlv-'+l.alt);
      if(!el) return;
      if(helicoAlt>=l.alt) el.classList.add('reached');
      else el.classList.remove('reached','active');
    });
    const nextLv=HELICO_LEVELS.find(l=>helicoAlt<l.alt);
    if(nextLv) document.getElementById('hlv-'+nextLv.alt)?.classList.add('active');

    // CRASH ?
    if(helicoAlt>=crashAlt){
      crashHelico();
    }
  },300);
}

function encaisserHelico(){
  if(!helicoRunning) return;
  clearInterval(helicoTimer);
  helicoRunning=false;
  const gain=parseFloat((helicoMise*helicoCote).toFixed(2));
  crediterJ(gain,'Gain Casino',`Hélicoptère encaissé à ${helicoAlt}m · ${helicoCote.toFixed(2)}x`);
  let st=gSt();st.pay+=gain;sSt(st);
  document.getElementById('helico-status').textContent=`💰 Encaissé à ${helicoAlt}m ! Gain: +${gain} Gourdes`;
  document.getElementById('helico-cash').style.display='none';
  document.getElementById('helico-start').style.display='inline-flex';
  showNotif(`💰 Encaissé ! +${gain} Gd à ${helicoAlt}m`,'ok');
  setTimeout(initHelico,3000);
}

function crashHelico(){
  clearInterval(helicoTimer);
  helicoRunning=false; helicoCrashed=true;
  document.getElementById('helico-crash-msg').style.display='flex';
  document.getElementById('helico-cash').disabled=true;
  setTimeout(()=>{document.getElementById('helico-cash').style.display='none';},500);
  document.getElementById('helico-start').style.display='inline-flex';
  document.getElementById('helico-status').textContent=`💥 CRASH à ${helicoAlt}m ! Mise perdue (${helicoMise} Gd)`;
  document.getElementById('helico-danger-bar').style.width='100%';
  document.getElementById('helico-danger-bar').style.background='var(--red)';
  showNotif(`💥 Crash à ${helicoAlt}m !`,'err');
  requestAnimationFrame(drawHelico);
  setTimeout(initHelico,3500);
}

document.getElementById('helico-start').addEventListener('click',demarrerHelico);
document.getElementById('helico-cash').addEventListener('click',encaisserHelico);

// ===== SPORTS DATA =====
const MATCHES=[
  // ===== LIVE =====
  {id:1,lk:'ligue1',lg:'🇫🇷 Ligue 1',t1:'Paris Saint-Germain',t2:'AS Monaco',f1:'🔵',f2:'🔴',s1:2,s2:1,time:"67'",odds:[1.45,4.20,6.50],mkt:48,live:true},
  {id:2,lk:'premier',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',t1:'Arsenal',t2:'Manchester City',f1:'🔴',f2:'🔵',s1:1,s2:1,time:"43'",odds:[2.80,3.15,2.50],mkt:62,live:true},
  {id:3,lk:'laliga',lg:'🇪🇸 La Liga',t1:'Real Madrid',t2:'FC Barcelone',f1:'⚪',f2:'🔵',s1:0,s2:1,time:"28'",odds:[2.10,3.30,3.60],mkt:55,live:true},
  {id:4,lk:'bundesliga',lg:'🇩🇪 Bundesliga',t1:'Bayern Munich',t2:'Dortmund',f1:'🔴',f2:'🟡',s1:3,s2:1,time:"74'",odds:[1.65,3.80,5.00],mkt:60,live:true},
  {id:5,lk:'seriea',lg:'🇮🇹 Serie A',t1:'Inter Milan',t2:'Juventus',f1:'🔵',f2:'⚫',s1:1,s2:0,time:"55'",odds:[1.80,3.40,4.50],mkt:52,live:true},
  {id:6,lk:'ucl',lg:'🌍 Champions League',t1:'Manchester City',t2:'Real Madrid',f1:'🔵',f2:'⚪',s1:2,s2:2,time:"88'",odds:[2.50,3.30,2.80],mkt:70,live:true},

  // ===== FRANCE =====
  {id:101,lk:'ligue1',lg:'🇫🇷 Ligue 1',t1:'Marseille',t2:'Lyon',f1:'🔵',f2:'🔴',time:'19:00',odds:[2.00,3.10,3.70],mkt:41,live:false},
  {id:102,lk:'ligue1',lg:'🇫🇷 Ligue 1',t1:'RC Lens',t2:'Stade Rennais',f1:'🟡',f2:'🔴',time:'19:00',odds:[2.20,3.00,3.40],mkt:38,live:false},
  {id:103,lk:'ligue1',lg:'🇫🇷 Ligue 1',t1:'OGC Nice',t2:'Montpellier',f1:'🔴',f2:'🔵',time:'21:05',odds:[1.80,3.30,4.50],mkt:35,live:false},
  {id:104,lk:'ligue1',lg:'🇫🇷 Ligue 1',t1:'Strasbourg',t2:'Toulouse',f1:'🔵',f2:'🟣',time:'15:00',odds:[2.10,3.00,3.60],mkt:30,live:false},
  {id:105,lk:'ligue2',lg:'🇫🇷 Ligue 2',t1:'Auxerre',t2:'Grenoble',f1:'🔴',f2:'🔵',time:'20:00',odds:[2.30,3.10,3.20],mkt:22,live:false},
  {id:106,lk:'ligue2',lg:'🇫🇷 Ligue 2',t1:'Caen',t2:'Dunkerque',f1:'🔵',f2:'🔴',time:'20:00',odds:[1.95,3.20,4.00],mkt:20,live:false},

  // ===== ANGLETERRE =====
  {id:201,lk:'premier',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',t1:'Liverpool',t2:'Chelsea',f1:'🔴',f2:'🔵',time:'18:30',odds:[1.90,3.40,4.20],mkt:58,live:false},
  {id:202,lk:'premier',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',t1:'Manchester Utd',t2:'Newcastle',f1:'🔴',f2:'⚫',time:'16:00',odds:[2.10,3.20,3.50],mkt:52,live:false},
  {id:203,lk:'premier',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',t1:'Tottenham',t2:'Aston Villa',f1:'⚪',f2:'🟣',time:'14:00',odds:[2.40,3.10,2.90],mkt:48,live:false},
  {id:204,lk:'premier',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',t1:'Brighton',t2:'West Ham',f1:'🔵',f2:'🔵',time:'15:00',odds:[2.20,3.10,3.30],mkt:42,live:false},
  {id:205,lk:'championship',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',t1:'Leeds United',t2:'Sheffield Utd',f1:'⚪',f2:'🔴',time:'16:00',odds:[2.30,3.00,3.20],mkt:28,live:false},
  {id:206,lk:'championship',lg:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',t1:'Burnley',t2:'Middlesbrough',f1:'🔵',f2:'🔴',time:'19:00',odds:[1.80,3.30,4.40],mkt:25,live:false},

  // ===== ESPAGNE =====
  {id:301,lk:'laliga',lg:'🇪🇸 La Liga',t1:'Atlético Madrid',t2:'Séville FC',f1:'🔴',f2:'🔴',time:'20:00',odds:[1.75,3.50,5.00],mkt:50,live:false},
  {id:302,lk:'laliga',lg:'🇪🇸 La Liga',t1:'Real Sociedad',t2:'Athletic Bilbao',f1:'🔵',f2:'🔴',time:'22:00',odds:[2.30,3.10,3.20],mkt:42,live:false},
  {id:303,lk:'laliga',lg:'🇪🇸 La Liga',t1:'Valencia',t2:'Villarreal',f1:'🟠',f2:'🟡',time:'19:00',odds:[2.50,3.20,2.80],mkt:38,live:false},
  {id:304,lk:'laliga',lg:'🇪🇸 La Liga',t1:'Betis',t2:'Getafe',f1:'🟢',f2:'🔵',time:'17:00',odds:[1.85,3.40,4.30],mkt:32,live:false},
  {id:305,lk:'liga2',lg:'🇪🇸 Liga 2',t1:'Eibar',t2:'Mirandes',f1:'🔵',f2:'🔴',time:'20:00',odds:[2.00,3.10,3.70],mkt:20,live:false},

  // ===== ALLEMAGNE =====
  {id:401,lk:'bundesliga',lg:'🇩🇪 Bundesliga',t1:'Bayer Leverkusen',t2:'RB Leipzig',f1:'🔴',f2:'🔵',time:'19:30',odds:[2.00,3.20,3.80],mkt:44,live:false},
  {id:402,lk:'bundesliga',lg:'🇩🇪 Bundesliga',t1:'Freiburg',t2:'Wolfsburg',f1:'🔴',f2:'🟢',time:'17:30',odds:[2.30,3.10,3.20],mkt:36,live:false},
  {id:403,lk:'bundesliga',lg:'🇩🇪 Bundesliga',t1:'Eintracht Frankfurt',t2:'Mönchengladbach',f1:'🔴',f2:'🟢',time:'15:30',odds:[1.90,3.30,4.20],mkt:38,live:false},
  {id:404,lk:'bundesliga2',lg:'🇩🇪 Bundesliga 2',t1:'Hambourg SV',t2:'Kaiserslautern',f1:'🔵',f2:'🔴',time:'18:30',odds:[1.70,3.50,5.00],mkt:24,live:false},

  // ===== ITALIE =====
  {id:501,lk:'seriea',lg:'🇮🇹 Serie A',t1:'Juventus',t2:'AC Milan',f1:'⚫',f2:'🔴',time:'20:45',odds:[2.30,3.20,3.10],mkt:50,live:false},
  {id:502,lk:'seriea',lg:'🇮🇹 Serie A',t1:'Napoli',t2:'Fiorentina',f1:'🔵',f2:'🟣',time:'15:00',odds:[1.55,3.80,6.00],mkt:45,live:false},
  {id:503,lk:'seriea',lg:'🇮🇹 Serie A',t1:'AS Roma',t2:'Lazio',f1:'🟡',f2:'🔵',time:'20:45',odds:[2.20,3.30,3.30],mkt:48,live:false},
  {id:504,lk:'seriea',lg:'🇮🇹 Serie A',t1:'Atalanta',t2:'Torino',f1:'⚫',f2:'🔴',time:'18:00',odds:[1.60,3.70,5.50],mkt:40,live:false},
  {id:505,lk:'serieb',lg:'🇮🇹 Serie B',t1:'Venezia',t2:'Parme',f1:'🔵',f2:'🟡',time:'20:30',odds:[2.40,3.00,3.00],mkt:18,live:false},

  // ===== PORTUGAL =====
  {id:601,lk:'primeiralga',lg:'🇵🇹 Primeira Liga',t1:'Benfica',t2:'Porto',f1:'🔴',f2:'🔵',time:'21:30',odds:[2.10,3.30,3.50],mkt:42,live:false},
  {id:602,lk:'primeiralga',lg:'🇵🇹 Primeira Liga',t1:'Sporting CP',t2:'Braga',f1:'🟢',f2:'🔴',time:'19:30',odds:[1.75,3.50,4.80],mkt:36,live:false},
  {id:603,lk:'primeiralga',lg:'🇹🇬 Primeira Liga',t1:'Vitória SC',t2:'Famalicão',f1:'🟢',f2:'🔵',time:'17:30',odds:[2.20,3.10,3.30],mkt:22,live:false},

  // ===== PAYS-BAS =====
  {id:701,lk:'eredivisie',lg:'🇳🇱 Eredivisie',t1:'Ajax',t2:'PSV Eindhoven',f1:'🔴',f2:'🔴',time:'20:00',odds:[2.30,3.20,3.10],mkt:38,live:false},
  {id:702,lk:'eredivisie',lg:'🇳🇱 Eredivisie',t1:'Feyenoord',t2:'AZ Alkmaar',f1:'🔴',f2:'🔴',time:'18:00',odds:[1.90,3.30,4.20],mkt:32,live:false},

  // ===== BELGIQUE =====
  {id:801,lk:'jupiler',lg:'🇧🇪 Jupiler Pro',t1:'Club Bruges',t2:'Anderlecht',f1:'🔵',f2:'🟣',time:'20:30',odds:[1.85,3.40,4.30],mkt:34,live:false},
  {id:802,lk:'jupiler',lg:'🇧🇪 Jupiler Pro',t1:'Gent',t2:'Standard Liège',f1:'🔵',f2:'🔴',time:'18:30',odds:[2.10,3.10,3.60],mkt:28,live:false},

  // ===== TURQUIE =====
  {id:901,lk:'superlig',lg:'🇹🇷 Süper Lig',t1:'Galatasaray',t2:'Fenerbahçe',f1:'🔴',f2:'🟡',time:'20:00',odds:[2.20,3.10,3.30],mkt:40,live:false},
  {id:902,lk:'superlig',lg:'🇹🇷 Süper Lig',t1:'Beşiktaş',t2:'Trabzonspor',f1:'⚫',f2:'🔵',time:'17:30',odds:[1.90,3.30,4.20],mkt:32,live:false},

  // ===== GRÈCE =====
  {id:1001,lk:'superleague',lg:'🇬🇷 Super League',t1:'Olympiakos',t2:'Panathinaïkos',f1:'🔴',f2:'🟢',time:'21:00',odds:[1.95,3.30,4.00],mkt:28,live:false},

  // ===== RUSSIE =====
  {id:1101,lk:'rpl',lg:'🇷🇺 RPL',t1:'Zenit St-Pétersbourg',t2:'CSKA Moscou',f1:'🔵',f2:'🔴',time:'16:00',odds:[1.80,3.40,4.60],mkt:30,live:false},
  {id:1102,lk:'rpl',lg:'🇷🇺 RPL',t1:'Spartak Moscou',t2:'Lokomotiv',f1:'🔴',f2:'🔴',time:'14:00',odds:[2.10,3.20,3.50],mkt:26,live:false},

  // ===== COMPÉTITIONS EUROPÉENNES =====
  {id:1201,lk:'ucl',lg:'🌍 Champions League',t1:'Inter Milan',t2:'Bayern Munich',f1:'🔵',f2:'🔴',time:'21:00',odds:[3.10,3.40,2.20],mkt:72,live:false},
  {id:1202,lk:'ucl',lg:'🌍 Champions League',t1:'Arsenal',t2:'PSG',f1:'🔴',f2:'🔵',time:'21:00',odds:[2.40,3.20,3.00],mkt:68,live:false},
  {id:1203,lk:'ucl',lg:'🌍 Champions League',t1:'Atlético Madrid',t2:'Porto',f1:'🔴',f2:'🔵',time:'21:00',odds:[1.80,3.40,4.60],mkt:62,live:false},
  {id:1204,lk:'europa',lg:'🌍 Europa League',t1:'AS Roma',t2:'Ajax',f1:'🟡',f2:'🔴',time:'21:00',odds:[1.95,3.30,3.90],mkt:55,live:false},
  {id:1205,lk:'europa',lg:'🌍 Europa League',t1:'Bayer Leverkusen',t2:'Atalanta',f1:'🔴',f2:'⚫',time:'18:45',odds:[2.10,3.20,3.50],mkt:52,live:false},
  {id:1206,lk:'europa',lg:'🌍 Europa League',t1:'Villarreal',t2:'Feyenoord',f1:'🟡',f2:'🔴',time:'18:45',odds:[2.30,3.10,3.20],mkt:46,live:false},
  {id:1207,lk:'confleague',lg:'🌍 Conference League',t1:'Fiorentina',t2:'Slavia Prague',f1:'🟣',f2:'🔴',time:'21:00',odds:[1.70,3.50,5.20],mkt:38,live:false},

  // ===== BRÉSIL =====
  {id:1301,lk:'brasileirao',lg:'🇧🇷 Brasileirão',t1:'Flamengo',t2:'Palmeiras',f1:'🔴',f2:'🟢',time:'00:00',odds:[2.20,3.10,3.30],mkt:42,live:false},
  {id:1302,lk:'brasileirao',lg:'🇧🇷 Brasileirão',t1:'Corinthians',t2:'Santos',f1:'⚫',f2:'⚪',time:'22:00',odds:[1.90,3.30,4.20],mkt:36,live:false},
  {id:1303,lk:'brasileirao',lg:'🇧🇷 Brasileirão',t1:'São Paulo FC',t2:'Grêmio',f1:'🔴',f2:'🔵',time:'00:30',odds:[2.00,3.20,3.70],mkt:32,live:false},

  // ===== ARGENTINE =====
  {id:1401,lk:'primera',lg:'🇦🇷 Primera División',t1:'River Plate',t2:'Boca Juniors',f1:'⚪',f2:'🟡',time:'01:00',odds:[2.40,3.00,3.00],mkt:44,live:false},
  {id:1402,lk:'primera',lg:'🇦🇷 Primera División',t1:'Independiente',t2:'Racing Club',f1:'🔴',f2:'🔵',time:'23:00',odds:[2.20,3.10,3.30],mkt:32,live:false},

  // ===== COPA LIBERTADORES & SUDAMERICANA =====
  {id:1501,lk:'libertadores',lg:'🌎 Copa Libertadores',t1:'Flamengo',t2:'Boca Juniors',f1:'🔴',f2:'🟡',time:'02:00',odds:[2.20,3.10,3.30],mkt:50,live:false},
  {id:1502,lk:'libertadores',lg:'🌎 Copa Libertadores',t1:'River Plate',t2:'Palmeiras',f1:'⚪',f2:'🟢',time:'00:30',odds:[2.40,3.00,3.00],mkt:46,live:false},
  {id:1503,lk:'libertadores',lg:'🌎 Copa Libertadores',t1:'Nacional',t2:'Peñarol',f1:'🔵',f2:'🟡',time:'01:30',odds:[2.10,3.20,3.60],mkt:38,live:false},
  {id:1504,lk:'sudamericana',lg:'🌎 Copa Sudamericana',t1:'LDU Quito',t2:'Independiente',f1:'🔵',f2:'🔴',time:'02:30',odds:[2.30,3.10,3.20],mkt:34,live:false},

  // ===== MEXIQUE =====
  {id:1601,lk:'ligamx',lg:'🇲🇽 Liga MX',t1:'América',t2:'Chivas',f1:'🟡',f2:'🔴',time:'03:00',odds:[1.90,3.30,4.20],mkt:38,live:false},
  {id:1602,lk:'ligamx',lg:'🇲🇽 Liga MX',t1:'Cruz Azul',t2:'UNAM Pumas',f1:'🔵',f2:'🟡',time:'01:00',odds:[2.00,3.20,3.70],mkt:32,live:false},

  // ===== USA =====
  {id:1701,lk:'mls',lg:'🇺🇸 MLS',t1:'LA Galaxy',t2:'Inter Miami',f1:'🔵',f2:'🩷',time:'01:30',odds:[2.10,3.20,3.40],mkt:35,live:false},
  {id:1702,lk:'mls',lg:'🇺🇸 MLS',t1:'NYCFC',t2:'Atlanta United',f1:'🔵',f2:'🔴',time:'23:30',odds:[2.30,3.00,3.20],mkt:30,live:false},
  {id:1703,lk:'mls',lg:'🇺🇸 MLS',t1:'Seattle Sounders',t2:'Portland Timbers',f1:'🟢',f2:'🟢',time:'02:00',odds:[2.20,3.10,3.40],mkt:28,live:false},

  // ===== AFRIQUE =====
  {id:1801,lk:'cafcl',lg:'🌍 CAF Champions League',t1:'Al Ahly',t2:'TP Mazembe',f1:'🔴',f2:'🔴',time:'19:00',odds:[1.70,3.50,5.20],mkt:30,live:false},
  {id:1802,lk:'cafcl',lg:'🌍 CAF Champions League',t1:'Wydad Casablanca',t2:'Espérance Tunis',f1:'🔴',f2:'🔴',time:'21:00',odds:[2.20,3.10,3.30],mkt:28,live:false},
  {id:1803,lk:'npfl',lg:'🇳🇬 NPFL Nigeria',t1:'Enyimba',t2:'Rivers United',f1:'🔴',f2:'🟢',time:'15:00',odds:[2.30,3.00,3.20],mkt:18,live:false},

  // ===== ASIE =====
  {id:1901,lk:'jleague',lg:'🇯🇵 J-League',t1:'Vissel Kobe',t2:'Gamba Osaka',f1:'🔴',f2:'🔵',time:'12:00',odds:[1.85,3.40,4.30],mkt:32,live:false},
  {id:1902,lk:'jleague',lg:'🇯🇵 J-League',t1:'Urawa Reds',t2:'Kashima Antlers',f1:'🔴',f2:'🔴',time:'11:00',odds:[2.10,3.20,3.50],mkt:28,live:false},
  {id:1903,lk:'kleague',lg:'🇰🇷 K-League',t1:'Jeonbuk',t2:'Ulsan Hyundai',f1:'🟢',f2:'🔵',time:'12:30',odds:[2.30,3.10,3.20],mkt:26,live:false},
  {id:1904,lk:'csl',lg:'🇨🇳 Super League',t1:'Shanghai Port',t2:'Shandong Taishan',f1:'🔴',f2:'🟡',time:'13:00',odds:[1.90,3.30,4.20],mkt:24,live:false},
  {id:1905,lk:'acl',lg:'🏆 AFC Champions League',t1:'Al Hilal',t2:'Urawa Reds',f1:'🔵',f2:'🔴',time:'17:00',odds:[1.75,3.50,4.80],mkt:38,live:false},

  // ===== MOYEN-ORIENT =====
  {id:2001,lk:'splt',lg:'🇸🇦 Saudi Pro League',t1:'Al Hilal',t2:'Al Nassr',f1:'🔵',f2:'🟡',time:'19:00',odds:[1.80,3.40,4.60],mkt:36,live:false},
  {id:2002,lk:'splt',lg:'🇸🇦 Saudi Pro League',t1:'Al Ittihad',t2:'Al Ahli',f1:'🟡',f2:'🟢',time:'21:00',odds:[2.10,3.20,3.60],mkt:30,live:false},

  // ===== AUSTRALIE =====
  {id:2101,lk:'aleague',lg:'🇦🇺 A-League',t1:'Melbourne City',t2:'Sydney FC',f1:'🔵',f2:'🔵',time:'09:00',odds:[2.20,3.10,3.40],mkt:24,live:false},
];
const EMKTS={'Double Chance':[['1X','1.15'],['12','1.05'],['X2','1.50']],'Buts':[['Moins 1.5','1.80'],['Plus 1.5','1.95'],['Moins 2.5','2.10'],['Plus 2.5','1.75'],['Moins 3.5','1.45'],['Plus 3.5','2.60']],'Mi-temps/Match':[['1/1','3.20'],['X/X','3.80'],['2/2','2.80'],['1/2','9.00'],['2/1','12.0'],['X/2','4.20']],'BTTS':[['Oui','1.80'],['Non','1.95']],'Handicap':[['-1','2.10'],['0','1.90'],['+1','1.75']],'Score exact':[['1-0','6.00'],['2-1','7.50'],['1-1','5.50'],['0-0','7.00']]};
const H2H={fr1:['W','W','D','W','L'],fr2:['L','D','W','L','W'],h2h:[{dt:'12 Jan 2025',s1:2,s2:1,cp:'Ligue 1',w:1},{dt:'05 Oct 2024',s1:1,s2:1,cp:'Coupe Nat.',w:0},{dt:'18 Mar 2024',s1:3,s2:0,cp:'Ligue 1',w:1},{dt:'22 Nov 2023',s1:0,s2:2,cp:'Ligue 1',w:2},{dt:'08 Apr 2023',s1:2,s2:2,cp:'Coupe Nat.',w:0}],stats:[{n:'Possession',v1:62,v2:38},{n:'Tirs cadrés',v1:6,v2:3},{n:'Corners',v1:7,v2:4},{n:'Fautes',v1:9,v2:14}]};

// Mapping lk -> région
const LK_REGION={
  ligue1:'fr',ligue2:'fr',
  premier:'en',championship:'en',
  laliga:'es',liga2:'es',
  bundesliga:'de',bundesliga2:'de',
  seriea:'it',serieb:'it',
  primeiralga:'pt',
  eredivisie:'nl',
  jupiler:'other_eu',superlig:'other_eu',superleague:'other_eu',rpl:'other_eu',
  ucl:'europe',europa:'europe',confleague:'europe',
  brasileirao:'amsud',primera:'amsud',libertadores:'amsud',sudamericana:'amsud',
  ligamx:'amnord',mls:'amnord',
  cafcl:'afrique',npfl:'afrique',
  jleague:'asie',kleague:'asie',csl:'asie',acl:'asie',splt:'asie',aleague:'asie',
};
let currentFilter='all';

function filterSport(el, region){
  document.querySelectorAll('.stab').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');
  currentFilter=region;
  renderSports();
}

function getFilteredMatches(){
  if(currentFilter==='all') return MATCHES;
  return MATCHES.filter(m=>{
    const r=LK_REGION[m.lk]||'other';
    return r===currentFilter;
  });
}

const ogSt={};
function renderMatch(m){
  const fn=(m.f1+' '+m.t1+' vs '+m.f2+' '+m.t2).replace(/'/g,"\'");
  const obs=['1','X','2'].map((l,i)=>`<div class="ob ${i===0&&m.odds[0]<2?'fv':''}" id="ob-${m.id}-${i}" onclick="addBet(${m.id},'${l}',${m.odds[i]},'${fn}',event)"><div class="ol">${l}</div><div class="ov">${m.odds[i].toFixed(2)}</div></div>`).join('');
  return `<div class="mc" id="mc-${m.id}">
    <div class="mchd"><span class="mctime ${m.live?'lt':''}">${m.live?'🔴 '+m.time:'⏰ '+m.time}</span>${m.live?'<span class="live-badge"><span class="ld"></span>LIVE</span>':''}</div>
    <div class="mcbody"><div class="mcteams"><div class="trow"><span class="tname">${m.f1} ${m.t1}</span></div><div class="trow"><span class="tname">${m.f2} ${m.t2}</span></div></div>${m.live?`<div class="mcscore"><div class="sval">${m.s1}</div><div style="font-size:9px;color:var(--muted)">—</div><div class="sval">${m.s2}</div></div>`:''}</div>
    <div class="odds">${obs}</div>
    <div class="mcact"><button class="bmkt" onclick="openMkt(${m.id})">📊 Marchés <span class="mkcnt">+${m.mkt}</span></button><button class="bh2h" onclick="openH2H(${m.id})">📈 H2H</button></div>
  </div>`;
}
function renderGroup(key,ms){
  const isOpen=ogSt[key]!==false;
  return `<div class="lgrp"><div class="lghd" onclick="togGrp('${key}')"><span class="lgname">${ms[0].lg} <span style="color:var(--muted);font-size:11px">${ms.length} match${ms.length>1?'s':''}</span></span><span class="lgtog ${isOpen?'op':''}" id="ltog-${key}">▼</span></div><div class="lgbody" id="lgrp-${key}" style="${isOpen?'':'display:none'}">${ms.map(renderMatch).join('')}</div></div>`;
}
function renderSports(){
  const filtered=getFilteredMatches();
  const live=filtered.filter(m=>m.live);
  const upcoming=filtered.filter(m=>!m.live);

  const liveEl=document.getElementById('liveSection');
  const upEl=document.getElementById('upcomingSection');
  const liveHd=document.getElementById('live-section-hd');

  if(live.length>0){
    if(liveHd) liveHd.style.display='flex';
    liveEl.innerHTML=live.map(renderMatch).join('');
  } else {
    if(liveHd) liveHd.style.display='none';
    liveEl.innerHTML='';
  }

  if(upcoming.length>0){
    const g={};upcoming.forEach(m=>{if(!g[m.lk])g[m.lk]=[];g[m.lk].push(m);});
    upEl.innerHTML=Object.keys(g).map(k=>renderGroup(k,g[k])).join('');
  } else {
    upEl.innerHTML='<div style="text-align:center;padding:30px;color:#888;font-size:14px">Aucun match pour ce filtre.</div>';
  }
}
function togGrp(key){
  const b=document.getElementById('lgrp-'+key),t=document.getElementById('ltog-'+key);
  if(!b||!t)return;
  const h=b.style.display==='none';b.style.display=h?'':'none';t.classList.toggle('op',h);ogSt[key]=h;
}

// ===== COUPON =====
const betSlip=[];
function addBet(matchId,result,odd,matchName,event){
  if(!CJ){showNotif('Connectez-vous pour parier !','err');return;}
  if(MODE==='ticket'){showNotif('Paris sportifs nécessitent un compte joueur','err');return;}
  const btn=event.currentTarget;
  const ex=betSlip.findIndex(b=>b.matchId===matchId);
  if(ex>=0){if(betSlip[ex].result===result){betSlip.splice(ex,1);btn.classList.remove('sel');renderCP();updateCPBar();return;}
  document.querySelectorAll('[id^="ob-'+matchId+'-"]').forEach(b=>b.classList.remove('sel'));betSlip.splice(ex,1);}
  betSlip.push({matchId,result,odd,matchName});btn.classList.add('sel');renderCP();updateCPBar();
  showNotif(result+' @ '+odd.toFixed(2)+' ajouté','info');
}
function addBetMdl(matchId,result,odd,matchName,el){
  if(!CJ){showNotif('Connectez-vous pour parier !','err');return;}
  if(MODE==='ticket'){showNotif('Paris sportifs nécessitent un compte joueur','err');return;}
  const al=betSlip.findIndex(b=>b.matchId===matchId&&b.result===result);
  if(al>=0){el.classList.remove('sel');betSlip.splice(al,1);renderCP();updateCPBar();return;}
  el.classList.add('sel');const ex=betSlip.findIndex(b=>b.matchId===matchId);if(ex>=0)betSlip.splice(ex,1);
  betSlip.push({matchId,result,odd:parseFloat(odd),matchName});renderCP();updateCPBar();
}
function rmBet(i){const b=betSlip[i];document.querySelectorAll('[id^="ob-'+b.matchId+'-"]').forEach(x=>x.classList.remove('sel'));betSlip.splice(i,1);renderCP();updateCPBar();}
function clearSlip(){betSlip.length=0;document.querySelectorAll('.ob.sel,.mbt.sel').forEach(b=>b.classList.remove('sel'));renderCP();updateCPBar();}
function renderCP(){
  const body=document.getElementById('cpbody');
  document.getElementById('cpcnt').textContent=betSlip.length;
  if(!betSlip.length){body.innerHTML='<div class="emptycp"><div class="ei">🎯</div><p>Aucune sélection</p></div>';return;}
  const combined=betSlip.reduce((a,b)=>a*b.odd,1);
  const ps=parseFloat(document.getElementById('stkin')?.value)||100;
  const sol=getSolde();
  body.innerHTML=`${betSlip.map((b,i)=>`<div class="cpitem"><button class="cprm" onclick="rmBet(${i})">×</button><div class="cpmatch">${b.matchName}</div><div class="cpsel">Sél: <b>${b.result}</b></div><div class="cpodd">${b.odd.toFixed(2)}</div></div>`).join('')}
  <div class="stksec">
    <span class="stklbl">MISE — Solde: <b style="color:var(--gold)">${sol} Gd</b></span>
    <div class="stkrow"><input class="stkin" type="number" value="${ps}" id="stkin" oninput="updPay()" min="1"><div class="curb">Gourdes</div></div>
    <div class="qsrow"><div class="qs" onclick="setStk(50)">50</div><div class="qs" onclick="setStk(100)">100</div><div class="qs" onclick="setStk(500)">500</div><div class="qs" onclick="setStk(1000)">1k</div></div>
    <div class="pyrow"><span class="pylbl">Cote totale:</span><span class="pyval">${combined.toFixed(2)}</span></div>
    <div class="pyrow"><span class="pylbl">Gain potentiel:</span><span class="pyval gn" id="pyval">${(ps*combined).toFixed(0)} Gd</span></div>
    <button class="betbtn" onclick="placerPari()">🎯 CONFIRMER LE PARI</button>
  </div>`;
}
function updPay(){
  const s=parseFloat(document.getElementById('stkin')?.value)||0;
  const c=betSlip.reduce((a,b)=>a*b.odd,1);
  const el=document.getElementById('pyval');
  if(el)el.textContent=(s*c).toFixed(0)+' Gd';
  updateCPBar();
}
function setStk(v){const i=document.getElementById('stkin');if(i){i.value=v;updPay();}}
function updateCPBar(){
  const bar=document.getElementById('cpbar');
  if(betSlip.length>0&&curSc==='sc-app'&&(MODE==='compte'||CJ)){
    bar.classList.add('on');
    document.getElementById('cpbcnt').textContent=betSlip.length;
    const c=betSlip.reduce((a,b)=>a*b.odd,1);
    document.getElementById('cpbodd').textContent='Cote: '+c.toFixed(2);
    const s=parseFloat(document.getElementById('stkin')?.value)||100;
    document.getElementById('cpbgain').textContent='→ '+(s*c).toFixed(0)+' Gd';
  } else {bar.classList.remove('on');}
}
function toggleCP(){document.getElementById('cppanel').classList.toggle('on');}



// ===== MARCHÉS =====



document.querySelectorAll('.mov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('on');}));


// ===== COUPON (sports) =====
function placerPari(){
  if(!CJ){showNotif('Compte joueur requis','err');return;}
  if(!betSlip.length){showNotif('Coupon vide','err');return;}
  const stake=parseFloat(document.getElementById('stkin')?.value)||0;
  const sol=getSolde();
  if(stake<=0){showNotif('Montant invalide','err');return;}
  if(stake>sol){showNotif('Solde insuffisant ('+sol+' Gd)','err');return;}
  const comb=betSlip.reduce((a,b)=>a*b.odd,1);
  const gainPot=parseFloat((stake*comb).toFixed(2));
  const desc=betSlip.map(b=>b.matchName+' → '+b.result).join(' | ');
  deduireJ(stake,'Pari Sportif','Mise: '+desc+' | Cote: '+comb.toFixed(2));
  const bets=gB();
  betSlip.forEach(b=>{
    bets.unshift({id:Date.now()+Math.random(),date:new Date().toLocaleString(),phone:CJ.phone,joueurName:CJ.name,match:b.matchName,selection:b.result,odd:b.odd,mise:stake,gainPotentiel:gainPot,statut:'En attente'});
  });
  sB(bets);
  showNotif('🎉 Pari placé ! Gain potentiel: '+gainPot+' Gd','ok');
  clearSlip();document.getElementById('cppanel').classList.remove('on');
}

// ==================== BORLETTE (Joueur) ====================
let borCart=[];
let borGame='borlette';
let borLotto4Opts=[true,true,true];
let borLotto5Opts=[true,true,true];

function borSubGame(el,game){
  document.querySelectorAll('#tab-borlette .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  borGame=game;
  const maxLen={borlette:2,lotto3:3,lotto4:4,lotto5:5,mariage:4};
  const pl={borlette:'00',lotto3:'000',lotto4:'0000',lotto5:'00000',mariage:'0000'};
  const inp=document.getElementById('bor-num');
  inp.maxLength=maxLen[game]||5;
  inp.placeholder=pl[game]||'00';
  document.getElementById('bor-lotto4-opts').style.display=game==='lotto4'?'flex':'none';
  document.getElementById('bor-lotto5-opts').style.display=game==='lotto5'?'flex':'none';
  inp.focus();
}

function borTogOpt(type,idx,el){
  if(type===4)borLotto4Opts[idx-1]=!borLotto4Opts[idx-1];
  else borLotto5Opts[idx-1]=!borLotto5Opts[idx-1];
  el.style.background=(type===4?borLotto4Opts[idx-1]:borLotto5Opts[idx-1])?'rgba(26,58,143,.4)':'var(--bg2)';
  el.style.borderColor=(type===4?borLotto4Opts[idx-1]:borLotto5Opts[idx-1])?'var(--gold)':'var(--border)';
  el.style.color=(type===4?borLotto4Opts[idx-1]:borLotto5Opts[idx-1])?'var(--gold)':'var(--text)';
}

function borAddBet(){
  const numRaw=document.getElementById('bor-num').value.trim();
  const amt=parseFloat(document.getElementById('bor-amt').value)||0;
  if(!numRaw||amt<=0){showNotif('Nimewo oswa montan pa valid','err');return;}
  const num=numRaw.replace(/[-&]/g,'');
  const lenOk={borlette:2,lotto3:3,lotto4:4,lotto5:5,mariage:4};
  if(num.length!==lenOk[borGame]){showNotif('Longè nimewo pa bon (atann '+lenOk[borGame]+' chif)','err');return;}
  const sol=getSolde();
  if(CJ&&amt>sol){showNotif('Solde insuffisant','err');return;}
  const drawId=document.getElementById('bor-tiraj').value;
  const abbr={borlette:'bor',lotto3:'lo3',lotto4:'lo4',lotto5:'lo5',mariage:'mar'};
  if(borGame==='lotto4'||borGame==='lotto5'){
    const opts=borGame==='lotto4'?borLotto4Opts:borLotto5Opts;
    let added=0;
    opts.forEach((on,i)=>{
      if(!on)return;
      let dn=num;
      if(borGame==='lotto4')dn=num.slice(0,2)+'-'+num.slice(2);
      else dn=num.slice(0,3)+'-'+num.slice(3);
      borCart.push({id:Date.now()+Math.random(),game:borGame,number:dn,cleanNumber:num,amount:amt,drawId,option:i+1});
      added++;
    });
    if(!added){showNotif('Chwazi omwen yon opsyon','err');return;}
  } else {
    borCart.push({id:Date.now()+Math.random(),game:borGame,number:num,cleanNumber:num,amount:amt,drawId});
  }
  renderBorCart();
  document.getElementById('bor-num').value='';
  document.getElementById('bor-num').focus();
  document.getElementById('bor-status').textContent='✅ '+num+' ajoute nan fich.';
  document.getElementById('bor-status').style.color='var(--green2)';
}

function borRemoveBet(id){
  borCart=borCart.filter(b=>b.id!=id);
  renderBorCart();
}

function renderBorCart(){
  const display=document.getElementById('bor-cart-display');
  const totalEl=document.getElementById('bor-cart-total');
  const countEl=document.getElementById('bor-items-count');
  const section=document.getElementById('bor-cart-section');
  if(!borCart.length){
    display.innerHTML='<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px">Panye vid</div>';
    if(totalEl)totalEl.textContent='0 Gd';
    if(countEl)countEl.textContent='0 paryaj';
    if(section)section.style.display='none';
    return;
  }
  if(section)section.style.display='';
  let total=0;
  const abbr={borlette:'bor',lotto3:'lo3',lotto4:'lo4',lotto5:'lo5',mariage:'mar',auto_marriage:'mara'};
  display.innerHTML=borCart.map(b=>{
    total+=b.amount;
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px">
      <span style="font-weight:800;color:var(--gold);min-width:40px">${abbr[b.game]||b.game}</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;flex:1;padding:0 8px">${b.number}${b.option?' (op'+b.option+')':''}</span>
      <span style="font-weight:700;color:var(--green2);min-width:55px;text-align:right">${b.amount} G</span>
      <button onclick="borRemoveBet('${b.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 0 0 8px">✕</button>
    </div>`;
  }).join('');
  if(totalEl)totalEl.textContent=total.toLocaleString('fr-FR')+' Gd';
  if(countEl)countEl.textContent=borCart.length+' paryaj';
}

function processBorTicket(){
  if(!borCart.length){showNotif('Panye vid','err');return;}
  const total=borCart.reduce((s,b)=>s+b.amount,0);
  const sol=getSolde();
  if(CJ&&total>sol){showNotif('Solde insuffisant','err');return;}
  if(CJ){
    deduireJ(total,'Borlette/Lotto','Ticket: '+borCart.length+' paryaj');
    let st=gSt();st.dep+=total;sSt(st);
  }
  printBorTicket(borCart,total);
  borCart=[];renderBorCart();
  showNotif('✅ Tikè enprime!','ok');
}

function printBorTicket(bets,total){
  const pw=window.open('','_blank','width=500,height=700');
  if(!pw){alert('Autorisez les pop-ups');return;}
  const abbr={borlette:'bor',lotto3:'lo3',lotto4:'lo4',lotto5:'lo5',mariage:'mar',auto_marriage:'mara'};
  const date=new Date().toLocaleString('fr-FR',{timeZone:'America/Port-au-Prince'});
  const drawId=bets[0]?.drawId||'';
  const drawMap={tn_matin:'Tunisia Matin',tn_soir:'Tunisia Soir',fl_matin:'Florida Matin',fl_soir:'Florida Soir',ny_matin:'New York Matin',ny_soir:'New York Soir',ga_matin:'Georgia Matin',ga_soir:'Georgia Soir',tx_matin:'Texas Matin',tx_soir:'Texas Soir'};
  const drawName=drawMap[drawId]||drawId;
  const ticketId=Math.floor(Math.random()*1000000).toString().padStart(6,'0');
  pw.document.write(`<!DOCTYPE html><html><head><title>Ticket Borlette</title><style>
    @page{size:80mm auto;margin:2mm;}
    body{font-family:'Courier New',monospace;font-size:28px;font-weight:bold;width:76mm;margin:0 auto;padding:4mm;background:white;color:black;}
    .hdr{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;}
    .hdr strong{display:block;font-size:36px;} .hdr small{font-size:22px;color:#555;}
    .info p{margin:4px 0;font-size:22px;}
    hr{border:none;border-top:2px dashed #000;margin:8px 0;}
    .bet-row{display:flex;justify-content:space-between;margin:4px 0;font-size:26px;}
    .total-row{display:flex;justify-content:space-between;font-weight:bold;margin-top:8px;font-size:30px;}
    .footer{text-align:center;margin-top:14px;font-size:20px;border-top:1px dashed #000;padding-top:8px;}
  </style></head><body>
  <div class="hdr"><strong>TONTON KONDO</strong><small>Borlette · Lotto</small></div>
  <div class="info">
    <p>Ticket #: ${ticketId}</p>
    <p>Tiraj: ${drawName}</p>
    <p>Date: ${date}</p>
    <p>Joueur: ${CJ?.name||CCaiss?.name||'Anonyme'}</p>
  </div>
  <hr>
  ${bets.map(b=>`<div class="bet-row"><span>${abbr[b.game]||b.game} ${b.number}${b.option?' op'+b.option:''}</span><span>${b.amount} G</span></div>`).join('')}
  <hr>
  <div class="total-row"><span>TOTAL</span><span>${total} Gdes</span></div>
  <div class="footer"><p>Tikè valid pou 90 jou</p><p><strong>TONTON KONDO S.A.</strong></p></div>
  </body></html>`);
  pw.document.close();
  pw.onload=()=>{pw.focus();pw.print();};
}

// ==================== RECHARGE (Joueur) ====================
function initRecharge(method){
  document.getElementById('recharge-form').style.display='block';
  const instructions={
    moncash:"1. Ouvrez <b>MonCash</b><br>2. Envoyez au: <b style='color:var(--gold)'>+509 XX XX XXXX</b><br>3. Notez le numéro de transaction<br>4. Entrez le montant et le numéro ci-dessous",
    natcash:"1. Ouvrez <b>NatCash</b><br>2. Transfert vers: <b style='color:var(--gold)'>+509 YY YY YYYY</b><br>3. Notez la référence<br>4. Entrez le montant et la référence ci-dessous"
  };
  document.getElementById('rch-method-name').textContent=method==='moncash'?'MonCash':'NatCash';
  document.getElementById('rch-instructions').innerHTML=instructions[method];
  document.getElementById('rch-ref-label').textContent=method==='moncash'?'MonCash':'NatCash';
  document.getElementById('rch-ref').dataset.method=method;
}

function soumettreRecharge(){
  if(!CJ){showNotif("Connectez-vous d'abord",'err');return;}
  const amt=parseInt(document.getElementById('rch-amount').value)||0;
  const ref=document.getElementById('rch-ref').value.trim();
  const method=document.getElementById('rch-ref').dataset.method||'moncash';
  if(amt<50){showNotif('Minimum 50 Gourdes','err');return;}
  if(!ref){showNotif('Entrez la référence de transaction','err');return;}
  const rch=gRch();
  rch.unshift({id:Date.now(),phone:CJ.phone,name:CJ.name,method,amount:amt,ref,date:new Date().toLocaleString(),statut:'En attente'});
  sRch(rch);
  showNotif('✅ Demande envoyée ! Un caissier validera sous peu.','ok');
  document.getElementById('rch-ref').value='';
  document.getElementById('recharge-form').style.display='none';
}

// ==================== ADMIN: Recharges + full refresh ====================
function admRefreshRecharges(){
  const rch=gRch();
  const el=document.getElementById('adm-recharges-list');if(!el)return;
  if(!rch.length){el.innerHTML='<p style="color:var(--muted);font-size:13px">Aucune recharge.</p>';return;}
  el.innerHTML=rch.map(r=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px;margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><strong>${r.name}</strong><span style="font-size:10px;color:var(--muted)">${r.date}</span></div>
      <div style="font-size:12px;margin-bottom:5px">📱 ${r.method.toUpperCase()} · Ref: <code>${r.ref}</code> · <b style="color:var(--gold)">${r.amount} Gd</b></div>
      <span class="sbadge ${r.statut==='En attente'?'sbp':r.statut==='Validé'?'sbw':'sbl'}">${r.statut}</span>
      ${r.statut==='En attente'?`<div style="display:flex;gap:5px;margin-top:6px"><button class="tbtn g" onclick="admValiderRch(${r.id})">✅ Valider</button><button class="tbtn r" onclick="admRejeterRch(${r.id})">❌ Rejeter</button></div>`:''}
    </div>`).join('');
}
function admValiderRch(id){
  const rch=gRch();const idx=rch.findIndex(r=>r.id===id);if(idx<0)return;
  const r=rch[idx];r.statut='Validé';
  const j=gJ();if(j[r.phone]){
    j[r.phone].solde=(j[r.phone].solde||0)+r.amount;sJ(j);
    addTx(r.phone,'Recharge '+r.method,r.amount,'Validée par Admin',j[r.phone].solde);
    let st=gSt();st.dep+=r.amount;sSt(st);
  }
  sRch(rch);showNotif('✅ Recharge validée','ok');admRefreshRecharges();
}
function admRejeterRch(id){
  const rch=gRch();const idx=rch.findIndex(r=>r.id===id);if(idx<0)return;
  rch[idx].statut='Rejeté';sRch(rch);showNotif('Recharge rejetée','err');admRefreshRecharges();
}

// ==================== CAISSIER: Recharges ====================
// gRch/sRch already defined above

function refreshRecharges(){
  const rch=gRch().filter(r=>r.statut==='En attente');
  const el=document.getElementById('recharges-list');if(!el)return;
  if(!rch.length){el.innerHTML='<p style="color:var(--muted);font-size:13px">Aucune demande en attente.</p>';return;}
  el.innerHTML=rch.map(r=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px;margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><strong>${r.name}</strong><span style="font-size:11px;color:var(--muted)">${r.date}</span></div>
      <div style="font-size:12px;margin-bottom:7px">📱 ${r.method.toUpperCase()} · Ref: <code>${r.ref}</code> · <b style="color:var(--gold)">${r.amount} Gd</b></div>
      <div style="display:flex;gap:5px">
        <button class="tbtn g" onclick="validerRecharge(${r.id})">✅ Valider</button>
        <button class="tbtn r" onclick="rejeterRecharge(${r.id})">❌ Rejeter</button>
      </div>
    </div>`).join('');
}
function validerRecharge(id){
  const rch=gRch();const idx=rch.findIndex(r=>r.id===id);if(idx<0)return;
  const r=rch[idx];r.statut='Validé';
  const j=gJ();if(j[r.phone]){
    j[r.phone].solde=(j[r.phone].solde||0)+r.amount;sJ(j);
    addTx(r.phone,'Recharge '+r.method,r.amount,'Validée par: '+CCaiss?.name,j[r.phone].solde);
    let st=gSt();st.dep+=r.amount;sSt(st);
  }
  sRch(rch);showNotif('✅ Recharge validée: +'+r.amount+' Gd','ok');refreshRecharges();
}
function rejeterRecharge(id){
  const rch=gRch();const idx=rch.findIndex(r=>r.id===id);if(idx<0)return;
  rch[idx].statut='Rejeté';sRch(rch);showNotif('Recharge rejetée','err');refreshRecharges();
}

// ==================== ADMIN: atab-recharges support ====================
// selAdmTab with recharges
function selAdmTab(el){
  document.querySelectorAll('#sc-admin .ptab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('#sc-admin .psec').forEach(s=>s.classList.remove('on'));
  const target = document.getElementById('atab-'+el.dataset.ptab);
  if(target) target.classList.add('on');
  const tab = el.dataset.ptab;
  // Small delay ensures DOM is painted before we fill content
  setTimeout(()=>{
    if(tab==='borlette'){
      if(typeof loadBorletteAdmin==='function') loadBorletteAdmin();
    } else if(tab==='jackpot'){
      if(typeof renderAdminJackpot==='function') renderAdminJackpot();
    } else {
      if(typeof refreshAdmin==='function') refreshAdmin();
      if(tab==='recharges' && typeof admRefreshRecharges==='function') admRefreshRecharges();
      if(tab==='params' && typeof loadAdminMessageFields==='function') loadAdminMessageFields();
    }
  }, 50);
}

// ==================== JOUEUR: tab borlette support ====================
function joueurSwitchTab(tab,el){
  document.querySelectorAll('.asec').forEach(s=>s.classList.remove('on'));
  const sec=document.getElementById('tab-'+tab);if(sec)sec.classList.add('on');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  el?.classList.add('active');
  if(tab==='historique')renderJHist();
  if(tab!=='sports'){
    document.getElementById('cpbar').classList.remove('on');
    document.getElementById('cppanel').classList.remove('on');
  }
}

// ==================== CAISSE: Écran joueur (overlay) ====================



function updateCaisseInterface(){
  const jeu=document.getElementById('caisse-jeu-type')?.value||'borlette';
  ['borlette','keno','lucky6','course'].forEach(j=>{
    const el=document.getElementById('caisse-'+j+'-form');
    if(el)el.style.display=j===jeu?'':'none';
  });
  updateCaisseDisplay();
}


// ==================== INFO MODAL ====================


document.getElementById('info-modal').addEventListener('click',function(e){
  if(e.target===this)fermerInfo();
});

// ==================== PARTICLES HERO ====================
(function(){
  const container=document.getElementById('hero-particles');
  if(!container)return;
  for(let i=0;i<18;i++){
    const s=document.createElement('span');
    s.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;
      animation:floatUp ${2+Math.random()*4}s ease-in-out infinite;
      animation-delay:${Math.random()*4}s;
      opacity:${.2+Math.random()*.5};
      width:${1+Math.random()*3}px;height:${1+Math.random()*3}px;`;
    container.appendChild(s);
  }
})();

// ==================== DEVICE DETECTION ====================
function detectDevice(){
  const w=window.innerWidth;
  const body=document.body;
  body.classList.remove('device-mobile','device-tablet','device-desktop');
  if(w<768)body.classList.add('device-mobile');
  else if(w<1200)body.classList.add('device-tablet');
  else body.classList.add('device-desktop');
  // Update access grid columns
  const ag=document.querySelector('.access-grid');
  if(ag){
    if(w>=768)ag.style.gridTemplateColumns='repeat(4,1fr)';
    else ag.style.gridTemplateColumns='repeat(2,1fr)';
  }
}
detectDevice();
window.addEventListener('resize',detectDevice);

// ==================== CAISSE: MULTI-JOUEUR FILE ====================
let joueurFile=[]; // [{id, name, phone, solde, panier:[]}]
let joueurFileActif=null; // index
let caissePanier=[]; // paris du joueur actif
let caisseBorSousJeu='borlette';

function ajouterJoueurFile(){
  const phone=document.getElementById('caisse-phone').value.trim();
  const j=gJ();
  let joueur=null;
  if(phone&&j[phone]){
    joueur={id:Date.now(),name:j[phone].name,phone,solde:j[phone].solde||0,panier:[]};
  } else if(phone){
    showNotif('Joueur introuvable pour ce numéro','err');return;
  } else {
    joueur={id:Date.now(),name:'Joueur '+(joueurFile.length+1),phone:'',solde:0,panier:[]};
  }
  joueurFile.push(joueur);
  document.getElementById('caisse-phone').value='';
  selectionnerJoueur(joueurFile.length-1);
  renderJoueurFile();
  showNotif('Joueur ajouté: '+joueur.name,'ok');
}

function joueurAnonyme(){
  const joueur={id:Date.now(),name:'Anonyme '+(joueurFile.length+1),phone:'',solde:0,panier:[]};
  joueurFile.push(joueur);
  selectionnerJoueur(joueurFile.length-1);
  renderJoueurFile();
}

function selectionnerJoueur(idx){
  joueurFileActif=idx;
  const j=joueurFile[idx];
  if(!j)return;
  caissePanier=j.panier;
  // Update info display
  const info=document.getElementById('caisse-joueur-info');
  if(info){
    info.style.display='flex';
    document.getElementById('caisse-j-av').textContent=j.name.charAt(0).toUpperCase();
    document.getElementById('caisse-j-name').textContent=j.name+(j.phone?' ('+j.phone+')':'');
    document.getElementById('caisse-j-solde').textContent=(j.solde||0)+' Gd';
  }
  renderJoueurFile();
  renderPanierCaisse();
  updateCaisseDisplay();
}

function clearJoueurCaisse(){
  document.getElementById('caisse-joueur-info').style.display='none';
  joueurFileActif=null;caissePanier=[];
  renderJoueurFile();renderPanierCaisse();
}

function renderJoueurFile(){
  const el=document.getElementById('joueur-queue-list');
  if(!el)return;
  if(!joueurFile.length){
    el.innerHTML='<div style="color:var(--muted);font-size:12px;padding:4px">Aucun joueur en file</div>';
    return;
  }
  el.innerHTML=joueurFile.map((j,i)=>{
    const total=j.panier.reduce((s,b)=>s+b.amount,0);
    const isActive=i===joueurFileActif;
    return`<div class="joueur-queue-item ${isActive?'active-j':''}" onclick="selectionnerJoueur(${i})">
      <div style="font-weight:700">${j.name}</div>
      <span class="jq-total">${j.panier.length} paryaj · ${total} Gd</span>
      <button onclick="event.stopPropagation();retirerJoueurFile(${i})" style="position:absolute;top:5px;right:5px;background:none;border:none;color:var(--red);cursor:pointer;font-size:12px">✕</button>
    </div>`;
  }).join('');
}

function retirerJoueurFile(idx){
  joueurFile.splice(idx,1);
  if(joueurFileActif===idx){joueurFileActif=null;caissePanier=[];clearJoueurCaisse();}
  else if(joueurFileActif>idx)joueurFileActif--;
  renderJoueurFile();renderPanierCaisse();
}

// ==================== CAISSE: PANIER ====================


function renderPanierCaisse(){
  const el=document.getElementById('caisse-panier-display');
  const card=document.getElementById('caisse-panier-card');
  const totalEl=document.getElementById('caisse-panier-total');
  if(!el)return;
  if(!caissePanier.length){
    if(card)card.style.display='none';
    return;
  }
  if(card)card.style.display='';
  let total=0;
  const abbr={borlette:'bor',lotto3:'lo3',lotto4:'lo4',lotto5:'lo5',mariage:'mar',keno:'keno',lucky6:'lucky6',course:'course'};
  el.innerHTML=caissePanier.map(b=>{
    total+=b.amount;
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px">
      <span style="font-weight:800;color:var(--gold);min-width:50px">${abbr[b.game]||b.game}</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;flex:1;padding:0 8px">${b.number}</span>
      <span style="font-weight:700;color:var(--green2);min-width:55px;text-align:right">${b.amount} G</span>
      <button onclick="retirerDuPanier('${b.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;padding:0 0 0 8px">✕</button>
    </div>`;
  }).join('');
  if(totalEl)totalEl.textContent=total.toLocaleString('fr-FR')+' Gd';
}

function retirerDuPanier(id){
  caissePanier=caissePanier.filter(b=>b.id!=id);
  if(joueurFileActif!==null&&joueurFile[joueurFileActif]){
    joueurFile[joueurFileActif].panier=caissePanier;
  }
  renderPanierCaisse();renderJoueurFile();updateCaisseDisplay();
}

function viderPanierCaisse(){
  caissePanier=[];
  if(joueurFileActif!==null&&joueurFile[joueurFileActif]){
    joueurFile[joueurFileActif].panier=[];
  }
  renderPanierCaisse();renderJoueurFile();updateCaisseDisplay();
}

async function lancerJeuCaisse(){
  if(!caissePanier.length){showNotif('Panier vide','err');return;}
  const total=caissePanier.reduce((s,b)=>s+b.amount,0);
  // Déduire du joueur si en file
  const joueur=joueurFileActif!==null?joueurFile[joueurFileActif]:null;
  if(joueur&&joueur.phone){
    const jData=gJ()[joueur.phone];
    if(jData&&(jData.solde||0)<total){showNotif('Solde insuffisant pour '+joueur.name,'err');return;}
  }
  // Lancer chaque pari du panier
  const resultats=[];
  for(const bet of caissePanier){
    let gain=0,resultMsg='';
    const mise=bet.amount;
    if(bet.jeuType==='borlette'){
      const tirage=Math.floor(Math.random()*100).toString().padStart(2,'0');
      const gagne=bet.cleanNumber===tirage;
      gain=gagne?mise*60:0;
      resultMsg=`${bet.game} ${bet.number} — Tirage: ${tirage} — ${gagne?'GAGNÉ +'+gain+' Gd':'Perdu'}`;
    } else if(bet.jeuType==='keno'){
      const tirage=[];for(let i=0;i<20;i++){let r;do{r=Math.floor(Math.random()*80)+1;}while(tirage.includes(r));tirage.push(r);}
      const nums=bet.nums||bet.cleanNumber.split(',').map(Number);
      const hits=nums.filter(n=>tirage.includes(n)).length;
      gain=mise*hits*2;
      resultMsg=`Keno ${bet.number} — ${hits} trouvés — ${gain>0?'Gain: +'+gain+' Gd':'Perdu'}`;
    } else if(bet.jeuType==='lucky6'){
      const nums=bet.nums||bet.cleanNumber.split(',').map(Number);
      const pool=Array.from({length:48},(_,i)=>i+1).filter(n=>!nums.includes(n)).sort(()=>Math.random()-.5);
      const fp=[...nums,...pool].slice(0,35);
      const found=nums.filter(n=>fp.includes(n)).length;
      gain=found===6?mise*30:0;
      resultMsg=`Lucky6 ${bet.number} — ${found}/6 — ${gain>0?'GAGNÉ +'+gain+' Gd':'Perdu'}`;
    } else if(bet.jeuType==='course'){
      const COTES=[0,2.10,1.75,2.50,3.20,4.00,5.50];
      const diff=getGameDiff('course');
      const boost={easy:.5,medium:.3,hard:.2,veryhard:.1}[diff]||.3;
      const winner=Math.random()<boost?bet.car:Math.ceil(Math.random()*6);
      gain=winner===bet.car?parseFloat((mise*COTES[bet.car]).toFixed(2)):0;
      resultMsg=`Course Voiture #${bet.car} — Gagnant: #${winner} — ${gain>0?'GAGNÉ +'+gain+' Gd':'Perdu'}`;
    }
    resultats.push({bet,gain,resultMsg});
  }
  const totalGain=resultats.reduce((s,r)=>s+r.gain,0);
  // Appliquer transactions
  if(joueur&&joueur.phone){
    const j=gJ();
    if(j[joueur.phone]){
      j[joueur.phone].solde=(j[joueur.phone].solde||0)-total+totalGain;
      sJ(j);
      addTx(joueur.phone,'Jeu en Caisse',-total+totalGain,'Panier: '+caissePanier.length+' paris, gain: '+totalGain+' Gd',j[joueur.phone].solde);
      document.getElementById('caisse-j-solde').textContent=j[joueur.phone].solde+' Gd';
    }
  }
  let st=gSt();st.dep+=total;st.pay+=totalGain;sSt(st);
  // Print ticket
  imprimerResultats(resultats,total,totalGain,joueur);
  // Update display
  const statusMsg=totalGain>0?`🏆 Total gains: +${totalGain} Gd`:`😔 Aucun gain cette fois`;
  document.getElementById('caisse-status').textContent=statusMsg;
  document.getElementById('caisse-status').style.background=totalGain>0?'rgba(40,176,78,.15)':'rgba(230,57,70,.1)';
  document.getElementById('caisse-status').style.color=totalGain>0?'var(--green2)':'var(--red)';
  // Enregistrer et montrer résultats
  const cb=gCB();
  cb.unshift({id:Date.now(),date:new Date().toLocaleString(),jeu:'multi',resultats,total,totalGain,joueurPhone:joueur?.phone||'',joueurName:joueur?.name||'Anonyme',caissCode:CCaiss?.code||''});
  sCB(cb);
  refreshCaisseBets();
  // Vider le joueur de la file
  if(joueurFileActif!==null){
    joueurFile.splice(joueurFileActif,1);
    joueurFileActif=null;caissePanier=[];
    clearJoueurCaisse();
    renderJoueurFile();
  }
  renderPanierCaisse();
  // Afficher overlay résultats
  afficherResultatsCaisse(resultats,totalGain);
}

function afficherResultatsCaisse(resultats,totalGain){
  const overlay=document.getElementById('tickets-win-overlay');
  document.getElementById('tw-date').textContent=new Date().toLocaleString('fr-FR');
  document.getElementById('tw-list').innerHTML=resultats.map(r=>`
    <div class="ticket-win-item" style="${r.gain>0?'background:rgba(40,176,78,.15);border:1px solid var(--green2)':''}">
      <span class="name" style="font-size:12px">${r.resultMsg}</span>
      <span class="${r.gain>0?'gain':''}" style="${r.gain>0?'color:var(--gold)':'color:var(--red)'};font-size:14px">${r.gain>0?'+'+r.gain:r.gain} Gd</span>
    </div>`).join('');
  overlay.classList.add('on');
}

function imprimerPanierCaisse(){
  if(!caissePanier.length){showNotif('Panier vide','err');return;}
  const total=caissePanier.reduce((s,b)=>s+b.amount,0);
  const joueur=joueurFileActif!==null?joueurFile[joueurFileActif]:null;
  imprimerTicketCaisse(caissePanier,[],total,0,joueur);
}

function imprimerResultats(resultats,total,totalGain,joueur){
  const bets=resultats.map(r=>r.bet);
  imprimerTicketCaisse(bets,resultats,total,totalGain,joueur);
}

function imprimerTicketCaisse(bets,resultats,total,totalGain,joueur){
  const pw=window.open('','_blank','width=500,height=800');
  if(!pw){alert('Autorisez les pop-ups');return;}
  const abbr={borlette:'bor',lotto3:'lo3',lotto4:'lo4',lotto5:'lo5',mariage:'mar',keno:'Keno',lucky6:'L6',course:'Course',auto_marriage:'mara'};
  const date=new Date().toLocaleString('fr-FR',{timeZone:'America/Port-au-Prince'});
  const ticketId=Math.floor(Math.random()*1000000).toString().padStart(6,'0');
  const hasResults=resultats&&resultats.length>0;
  pw.document.write(`<!DOCTYPE html><html><head><title>Ticket Tonton Kondo</title><style>
    @page{size:80mm auto;margin:2mm;}
    body{font-family:'Courier New',monospace;font-size:26px;font-weight:bold;width:76mm;margin:0 auto;padding:4mm;background:white;color:black;}
    .hdr{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;}
    .hdr strong{display:block;font-size:34px;} .hdr small{font-size:20px;color:#666;}
    .info p{margin:3px 0;font-size:20px;}
    hr{border:none;border-top:2px dashed #000;margin:8px 0;}
    .bet-row{display:flex;justify-content:space-between;margin:3px 0;font-size:24px;}
    .res-row{display:flex;justify-content:space-between;margin:3px 0;font-size:20px;color:#333;}
    .win-row{color:green;font-weight:bold;}
    .total-row{display:flex;justify-content:space-between;font-weight:bold;margin-top:7px;font-size:28px;}
    .gain-row{display:flex;justify-content:space-between;font-weight:bold;font-size:28px;color:green;}
    .footer{text-align:center;margin-top:14px;font-size:18px;border-top:1px dashed #000;padding-top:8px;}
  </style></head><body>
  <div class="hdr"><strong>TONTON KONDO</strong><small>Paryaj · Casino · Lotto</small></div>
  <div class="info">
    <p>Ticket #: ${ticketId}</p>
    <p>Date: ${date}</p>
    <p>Joueur: ${joueur?.name||'Anonyme'}</p>
    <p>Caissier: ${CCaiss?.name||'—'}</p>
  </div>
  <hr>
  <div style="font-size:20px;font-weight:bold;margin-bottom:4px">PARIS:</div>
  ${bets.map((b,i)=>{
    const r=hasResults?resultats[i]:null;
    return`<div class="bet-row"><span>${abbr[b.game]||b.game} ${b.number}</span><span>${b.amount} G</span></div>${r?`<div class="res-row ${r.gain>0?'win-row':''}"><span>→ ${r.resultMsg.split('—').pop().trim()}</span></div>`:''}`
  }).join('')}
  <hr>
  <div class="total-row"><span>TOTAL MISÉ</span><span>${total} Gdes</span></div>
  ${hasResults&&totalGain>0?`<div class="gain-row"><span>TOTAL GAIN</span><span>+${totalGain} Gdes</span></div>`:''}
  <div class="footer">
    <p>Tikè valid pou 90 jou</p>
    <p>Jwe responsab — 18+</p>
    <p><strong>TONTON KONDO S.A.</strong></p>
  </div>
  </body></html>`);
  pw.document.close();
  pw.onload=()=>{pw.focus();pw.print();};
}

// updateCaisseDisplay enhanced


function ouvrirEcranJoueur(){
  document.getElementById('caisse-display')?.classList.add('on');
  updateCaisseDisplay();
}
function fermerEcranJoueur(){
  document.getElementById('caisse-display')?.classList.remove('on');
}

function caisseBorSub(el,sub){
  document.querySelectorAll('#caisse-bor-sub-btns .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');caisseBorSousJeu=sub;
}

// chargerJoueurCaisse kept for backward compat
function chargerJoueurCaisse(){ajouterJoueurFile();}

// Backward compat: enregistrerPariCaisse -> lancerJeuCaisse
function enregistrerPariCaisse(){
  // Quick add from old form then launch
  ajouterAuPanierCaisse();
  setTimeout(lancerJeuCaisse,200);
}

// ==================== HISTORIQUE PAR CATÉGORIE ====================
function selHistTab(tab, el){
  ['depot','lotto','casino','sports'].forEach(t=>{
    const sec=document.getElementById('hsec-'+t);
    const btn=document.getElementById('htab-'+t);
    if(sec) sec.style.display = t===tab ? '' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='sports') renderJBets();
  else renderJHistCat(tab);
}

function renderJHistCat(cat){
  if(!CJ) return;
  const j=gJ()[CJ.phone];
  const hist=(j&&j.transactions)||[];
  const catMap={
    depot: t => ['Dépôt','Retrait','Recharge','Cash','MonCash','NatCash'].some(k=>t.type.includes(k)),
    lotto: t => ['Borlette','Lotto','borlette','lotto','Tiraj'].some(k=>(t.type+t.details).includes(k)),
    casino: t => ['Casino','Keno','Course','Hélicoptère','Lucky','Caisse'].some(k=>(t.type+t.details).includes(k))
  };
  const filtered = hist.filter(catMap[cat]||(() => true));
  const el = document.getElementById('jhist-'+cat);
  if(!el) return;
  el.innerHTML = filtered.length
    ? filtered.map(t=>`<div style="padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;color:var(--muted)">${t.date}</span> —
        <b style="color:${t.montant>0?'var(--green2)':'var(--red)'}">${t.type}</b>:
        <span style="color:${t.montant>0?'var(--green2)':'var(--red)'}">${t.montant>0?'+':''}${t.montant} Gd</span>
        <span style="font-size:10px;color:var(--muted)"> — ${t.details||''}</span>
      </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;padding:8px">Aucune transaction dans cette catégorie.</div>';
}

function renderJBets(){
  const el=document.getElementById('jbets');
  if(!el||!CJ) return;
  const bets=gB().filter(b=>b.phone===CJ.phone);
  el.innerHTML=bets.length
    ?`<div style="overflow-x:auto"><table style="font-size:11px;min-width:360px"><thead><tr><th>Date</th><th>Match</th><th>Sél.</th><th>Cote</th><th>Mise</th><th>Gain pot.</th><th>Statut</th></tr></thead><tbody>
    ${bets.map(b=>`<tr><td style="font-size:10px">${b.date}</td><td>${b.match}</td><td><b>${b.selection}</b></td><td style="color:var(--gold)">${b.odd.toFixed(2)}</td><td>${b.mise} Gd</td><td style="color:var(--green2)">${b.gainPotentiel} Gd</td><td><span class="sbadge ${b.statut==='En attente'?'sbp':b.statut==='Gagné'?'sbw':'sbl'}">${b.statut}</span></td></tr>`).join('')}
    </tbody></table></div>`
    :'<p style="color:var(--muted);font-size:13px">Aucun pari sportif.</p>';
}

// Patch renderJHist to use new system
function renderJHist(){
  if(!CJ) return;
  // Refresh active tab
  const activeBtn=document.querySelector('#tab-historique .chip.active');
  if(activeBtn){
    const tab=activeBtn.id.replace('htab-','');
    if(tab==='sports') renderJBets();
    else renderJHistCat(tab);
  } else {
    renderJHistCat('depot');
  }
}

// ==================== ADMIN: COMPTES MONCASH/NATCASH/CASH ====================


// ==================== CAISSE: GRILLES KENO & LUCKY6 ====================
let caisseKenoSel=[];
let caisseL6Sel=[];

function initCaisseKeno(){
  const g=document.getElementById('caisse-keno-grid');
  if(!g) return;
  caisseKenoSel=[];
  g.innerHTML='';
  for(let i=1;i<=80;i++){
    const b=document.createElement('button');
    b.textContent=i;
    b.id='ck-'+i;
    b.style.cssText='aspect-ratio:1;background:var(--bg2);border:1px solid var(--border);color:#fff;border-radius:4px;cursor:pointer;font-weight:700;font-size:10px;width:100%;padding:2px;';
    b.onclick=()=>{
      if(caisseKenoSel.includes(i)){
        caisseKenoSel=caisseKenoSel.filter(x=>x!==i);
        b.style.background='var(--bg2)';b.style.color='#fff';b.style.borderColor='var(--border)';
      } else if(caisseKenoSel.length<10){
        caisseKenoSel.push(i);
        b.style.background='var(--blue)';b.style.color='var(--gold)';b.style.borderColor='var(--gold)';
      } else {showNotif('Maximum 10 numéros','err');return;}
      const cnt=document.getElementById('caisse-keno-sel-count');
      const nums=document.getElementById('caisse-keno-sel-nums');
      if(cnt) cnt.textContent=caisseKenoSel.length+'/10';
      if(nums) nums.textContent=caisseKenoSel.sort((a,b)=>a-b).join(', ')||'—';
      updateCaisseDisplay();
    };
    g.appendChild(b);
  }
}

function initCaisseL6(){
  const g=document.getElementById('caisse-l6-grid');
  if(!g) return;
  caisseL6Sel=[];
  g.innerHTML='';
  for(let i=1;i<=48;i++){
    const b=document.createElement('button');
    b.textContent=i;
    b.id='cl6-'+i;
    b.style.cssText='aspect-ratio:1;border-radius:50%;border:1px solid var(--border);background:var(--bg2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;width:100%;';
    b.onclick=()=>{
      if(caisseL6Sel.includes(i)){
        caisseL6Sel=caisseL6Sel.filter(x=>x!==i);
        b.style.background='var(--bg2)';b.style.color='#fff';b.style.borderColor='var(--border)';
      } else if(caisseL6Sel.length<6){
        caisseL6Sel.push(i);
        b.style.background='var(--gold)';b.style.color='#000';b.style.borderColor='var(--gold)';
      } else {showNotif('Maximum 6 numéros','err');return;}
      const cnt=document.getElementById('caisse-l6-sel-count');
      const nums=document.getElementById('caisse-l6-sel-nums');
      if(cnt) cnt.textContent=caisseL6Sel.length+'/6';
      if(nums) nums.textContent=caisseL6Sel.sort((a,b)=>a-b).join(', ')||'—';
      updateCaisseDisplay();
    };
    g.appendChild(b);
  }
}

// ==================== BORLETTE: RÉSULTATS TIRAJ ====================
let borResultats=[]; // {drawId, drawName, date, nums:[lot1,lot2,lot3]}
let borResultFilter='all';

function filtreResultats(el, filter){
  document.querySelectorAll('#tab-borlette .chip').forEach(c=>{
    if(['all','tn_matin','fl_matin','ny_matin','ga_matin'].some(v=>c.onclick?.toString().includes("'"+v+"'")))
      c.classList.remove('active');
  });
  el.classList.add('active');
  borResultFilter=filter;
  renderBorResultats();
}

function renderBorResultats(){
  const el=document.getElementById('bor-resultats');
  if(!el) return;
  const filtered=borResultFilter==='all'?borResultats:borResultats.filter(r=>r.drawId===borResultFilter);
  if(!filtered.length){
    el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center">Pa gen rezilta disponib.</div>';
    return;
  }
  const drawMap={tn_matin:'Tunisia Matin',tn_soir:'Tunisia Soir',fl_matin:'Florida Matin',fl_soir:'Florida Soir',ny_matin:'New York Matin',ny_soir:'New York Soir',ga_matin:'Georgia Matin',ga_soir:'Georgia Soir',tx_matin:'Texas Matin',tx_soir:'Texas Soir'};
  el.innerHTML=filtered.slice(0,10).map(r=>`
    <div style="padding:10px;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-weight:800;color:var(--gold)">${drawMap[r.drawId]||r.drawId}</span>
        <span style="font-size:11px;color:var(--muted)">${r.date}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="background:var(--gold);color:#000;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px">
          ${r.nums[0]||'—'}
        </span>
        <span style="background:var(--muted);color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px">
          ${r.nums[1]||'—'}
        </span>
        <span style="background:rgba(230,57,70,.6);color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px">
          ${r.nums[2]||'—'}
        </span>
        <span style="font-size:11px;color:var(--muted);align-self:center">Lot1 · Lot2 · Lot3</span>
      </div>
    </div>`).join('');
}

function simulerTirage(){
  const draws=['tn_matin','fl_matin','ny_matin','ga_matin','tx_matin'];
  const drawId=draws[Math.floor(Math.random()*draws.length)];
  const nums=[
    Math.floor(Math.random()*100).toString().padStart(2,'0'),
    Math.floor(Math.random()*100).toString().padStart(2,'0'),
    Math.floor(Math.random()*100).toString().padStart(2,'0')
  ];
  const tirage={drawId,drawName:drawId,date:new Date().toLocaleString('fr-FR'),nums};
  borResultats.unshift(tirage);
  // Save to localStorage
  const saved=JSON.parse(localStorage.getItem('tk_resultats')||'[]');
  saved.unshift(tirage);
  if(saved.length>50) saved.pop();
  localStorage.setItem('tk_resultats',JSON.stringify(saved));
  renderBorResultats();
  showNotif('Tirage simulé: '+nums.join(' - '),'ok');
}

function loadBorResultats(){
  borResultats=JSON.parse(localStorage.getItem('tk_resultats')||'[]');
  renderBorResultats();
}

// ==================== PATCH: updateCaisseForm initialise les grilles ====================
function updateCaisseForm(){
  const jeu=document.getElementById('caisse-jeu-type')?.value||'borlette';
  ['borlette','keno','lucky6','course'].forEach(j=>{
    const el=document.getElementById('caisse-'+j+'-form');
    if(el) el.style.display=j===jeu?'':'none';
  });
  // Init grilles si besoin
  if(jeu==='keno'){
    const g=document.getElementById('caisse-keno-grid');
    if(g&&!g.children.length) initCaisseKeno();
  }
  if(jeu==='lucky6'){
    const g=document.getElementById('caisse-l6-grid');
    if(g&&!g.children.length) initCaisseL6();
  }
  updateCaisseDisplay();
}

// ==================== PATCH: ajouterAuPanierCaisse utilise les grilles ====================
function ajouterAuPanierCaisse(){
  const jeu=document.getElementById('caisse-jeu-type').value;
  if(jeu==='keno'){
    if(!caisseKenoSel.length){showNotif('Sélectionnez au moins 1 numéro','err');return;}
    const mise=parseFloat(document.getElementById('caisse-keno-mise')?.value)||0;
    if(mise<=0){showNotif('Mise invalide','err');return;}
    caissePanier.push({id:Date.now()+Math.random(),game:'keno',number:caisseKenoSel.join(','),cleanNumber:caisseKenoSel.join(','),amount:mise,nums:[...caisseKenoSel],jeuType:'keno'});
    if(joueurFileActif!==null&&joueurFile[joueurFileActif]) joueurFile[joueurFileActif].panier=caissePanier;
    // Reset sélection keno
    caisseKenoSel=[];
    document.querySelectorAll('[id^="ck-"]').forEach(b=>{b.style.background='var(--bg2)';b.style.color='#fff';b.style.borderColor='var(--border)';});
    const cnt=document.getElementById('caisse-keno-sel-count');if(cnt)cnt.textContent='0/10';
    const nums=document.getElementById('caisse-keno-sel-nums');if(nums)nums.textContent='—';
    renderPanierCaisse();renderJoueurFile();updateCaisseDisplay();
    showNotif('Keno ajouté au panier','ok');
    return;
  }
  if(jeu==='lucky6'){
    if(caisseL6Sel.length!==6){showNotif('Sélectionnez exactement 6 numéros','err');return;}
    const mise=parseFloat(document.getElementById('caisse-lucky6-mise')?.value)||0;
    if(mise<=0){showNotif('Mise invalide','err');return;}
    caissePanier.push({id:Date.now()+Math.random(),game:'lucky6',number:caisseL6Sel.join(','),cleanNumber:caisseL6Sel.join(','),amount:mise,nums:[...caisseL6Sel],jeuType:'lucky6'});
    if(joueurFileActif!==null&&joueurFile[joueurFileActif]) joueurFile[joueurFileActif].panier=caissePanier;
    // Reset sélection lucky6
    caisseL6Sel=[];
    document.querySelectorAll('[id^="cl6-"]').forEach(b=>{b.style.background='var(--bg2)';b.style.color='#fff';b.style.borderColor='var(--border)';});
    const cnt=document.getElementById('caisse-l6-sel-count');if(cnt)cnt.textContent='0/6';
    const nums=document.getElementById('caisse-l6-sel-nums');if(nums)nums.textContent='—';
    renderPanierCaisse();renderJoueurFile();updateCaisseDisplay();
    showNotif('Lucky 6 ajouté au panier','ok');
    return;
  }
  // Fallback: borlette / course
  const jeuFb=document.getElementById('caisse-jeu-type').value;
  let miseFb=0,numsFb=[];
  if(jeuFb==='borlette'){
    const raw=document.getElementById('caisse-bor-nums').value;
    numsFb=raw.split(',').map(n=>n.trim()).filter(n=>n);
    miseFb=parseFloat(document.getElementById('caisse-bor-mise')?.value)||0;
    if(!numsFb.length||miseFb<=0){showNotif('Numéros ou mise invalides','err');return;}
    numsFb.forEach(num=>{
      caissePanier.push({id:Date.now()+Math.random(),game:caisseBorSousJeu||'borlette',number:num,cleanNumber:num,amount:miseFb,drawId:document.getElementById('caisse-tiraj')?.value||'',jeuType:'borlette'});
    });
    document.getElementById('caisse-bor-nums').value='';
  } else if(jeuFb==='course'){
    const car=parseInt(document.getElementById('caisse-course-car').value);
    miseFb=parseFloat(document.getElementById('caisse-course-mise').value)||0;
    if(miseFb<=0){showNotif('Mise invalide','err');return;}
    caissePanier.push({id:Date.now()+Math.random(),game:'course',number:'Voiture #'+car,cleanNumber:String(car),amount:miseFb,car,jeuType:'course'});
  }
  if(joueurFileActif!==null&&joueurFile[joueurFileActif]) joueurFile[joueurFileActif].panier=caissePanier;
  renderPanierCaisse();renderJoueurFile();updateCaisseDisplay();
  showNotif('Ajouté au panier','ok');
}

// ==================== PATCH: updateCaisseDisplay avec grilles ====================
function updateCaisseDisplay(){
  const jeu=document.getElementById('caisse-jeu-type')?.value||'borlette';
  const JL={keno:'🎱 Keno Lucky',lucky6:'🍀 Lucky 6',course:'🏎️ Course Auto',borlette:'🎯 Borlette/Lotto'};
  const drawSel=document.getElementById('caisse-tiraj');
  const drawName=drawSel?drawSel.options[drawSel.selectedIndex]?.text||'—':'—';
  const joueur=joueurFileActif!==null?joueurFile[joueurFileActif]:null;
  // Sélections depuis le panier + sélection en cours
  let selections=caissePanier.map(b=>`${b.game}: ${b.number} (${b.amount}G)`);
  // Ajouter sélection en cours (keno/l6 pas encore dans le panier)
  if(jeu==='keno'&&caisseKenoSel.length) selections.push('Keno en cours: '+caisseKenoSel.join(','));
  if(jeu==='lucky6'&&caisseL6Sel.length) selections.push('Lucky6 en cours: '+caisseL6Sel.join(','));
  const total=caissePanier.reduce((s,b)=>s+b.amount,0);
  const dispGame=document.getElementById('caisse-display-game');
  const dispDraw=document.getElementById('caisse-display-draw');
  const dispSel=document.getElementById('caisse-display-selections');
  const dispTotal=document.getElementById('caisse-display-total');
  const dispJoueur=document.getElementById('caisse-display-joueur');
  if(dispGame)dispGame.textContent=JL[jeu]||jeu;
  if(dispDraw)dispDraw.textContent='Tiraj: '+drawName;
  if(dispJoueur)dispJoueur.textContent=joueur?joueur.name:'Anonyme';
  if(dispSel){
    if(selections.length||caisseKenoSel.length||caisseL6Sel.length){
      // Afficher numéros en cours de sélection (keno/l6)
      let displayNums=[];
      if(jeu==='keno') displayNums=caisseKenoSel.map(n=>n);
      if(jeu==='lucky6') displayNums=caisseL6Sel.map(n=>n);
      dispSel.innerHTML=
        (displayNums.length?displayNums.map(n=>`<div class="caisse-sel-item">${n}</div>`).join(''):'')
        +(caissePanier.map(b=>`<div class="caisse-sel-item confirmed">${b.number}</div>`).join(''))
        ||'<div style="color:var(--muted);font-size:13px;width:100%;text-align:center;padding:20px">En attente...</div>';
    } else {
      dispSel.innerHTML='<div style="color:var(--muted);font-size:13px;width:100%;text-align:center;padding:20px">En attente de sélections...</div>';
    }
  }
  if(dispTotal)dispTotal.textContent='Total: '+total+' Gd';
}

// ==================== PATCH: refreshAdmin inclut comptes ====================


// Init résultats au démarrage
loadBorResultats();

// Init
renderLandingDirs();



// ===== ROULETTE =====

















// ===== ABOUT MODAL =====



// ===== LOGIN PAGE =====
const SECRET_CODE = 'TONTONKONDO12';
let secretUnlocked = false;

function showSecretOverlay(){
  document.getElementById('secret-overlay').classList.add('on');
  document.getElementById('secret-input').value='';
  document.getElementById('secret-input').focus();
}
function hideSecretOverlay(){
  document.getElementById('secret-overlay').classList.remove('on');
}
function verifySecret(){
  const val = document.getElementById('secret-input').value.trim().toUpperCase();
  if(val === SECRET_CODE){
    secretUnlocked = true;
    hideSecretOverlay();
    showLoginPanel('staff');
    showNotif('Accès autorisé','ok');
  } else {
    document.getElementById('secret-input').style.borderColor='var(--red)';
    setTimeout(()=>{ document.getElementById('secret-input').style.borderColor='var(--border)'; },1000);
    showNotif('Code incorrect','err');
  }
}
document.getElementById('secret-input')?.addEventListener('keypress',function(e){
  if(e.key==='Enter') verifySecret();
});

function showLoginPanel(panel){
  document.querySelectorAll('.login-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.login-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('lp-'+panel)?.classList.add('active');
  document.getElementById('lt-'+panel)?.classList.add('active');
}

function togglePwd(inputId, btn){
  const inp = document.getElementById(inputId);
  if(!inp) return;
  if(inp.type==='password'){ inp.type='text'; btn.innerHTML='<i class="fas fa-eye-slash"></i>'; }
  else { inp.type='password'; btn.innerHTML='<i class="fas fa-eye"></i>'; }
}

// Login joueur depuis la page principale
function loginJoueurMain(){
  const phone = document.getElementById('ml-phone').value.trim();
  const pwd   = document.getElementById('ml-pwd').value;
  const err   = document.getElementById('ml-err');
  err.classList.remove('show');
  const j = gJ();
  if(!j[phone]||j[phone].pwd!==pwd){
    err.textContent='Nimewo oswa mot de passe enkòrèk.';
    err.classList.add('show'); return;
  }
  CJ = j[phone];
  goTo('sc-app');
  updateAppBar();
  initKeno(); initLucky6(); initCourse();
  renderSports(); renderJHist();
  renderJoueurDraws && renderJoueurDraws();
}

function registerJoueurMain(){
  const name  = document.getElementById('mr-name').value.trim();
  const phone = document.getElementById('mr-phone').value.trim();
  const pwd   = document.getElementById('mr-pwd').value;
  const pwd2  = document.getElementById('mr-pwd2').value;
  const err   = document.getElementById('mr-err');
  err.classList.remove('show');
  if(!name||!phone||!pwd){ err.textContent='Tout champ obligatoires.'; err.classList.add('show'); return; }
  if(pwd!==pwd2){ err.textContent='Mot de passe diferan.'; err.classList.add('show'); return; }
  const j = gJ();
  if(j[phone]){ err.textContent='Nimewo deja itilize.'; err.classList.add('show'); return; }
  j[phone]={name,phone,pwd,solde:0,dirCode:'',caissCode:'',createdAt:new Date().toLocaleString(),transactions:[]};
  sJ(j);
  showNotif('✅ Kont kree ! Konekte ou.','ok');
  showLoginPanel('joueur');
}

function loginStaff(){
  const role = document.getElementById('staff-role').value;
  const code = document.getElementById('staff-code').value.trim().toUpperCase();
  const pwd  = document.getElementById('staff-pwd').value;
  const err  = document.getElementById('staff-err');
  err.classList.remove('show');
  if(role==='admin'){
    if(pwd==='admin'){ refreshAdmin(); goTo('sc-admin'); }
    else { err.textContent='Mot de passe incorrect.'; err.classList.add('show'); }
    return;
  }
  if(role==='directeur'){
    const dirs = gDirs();
    const found = Object.values(dirs).find(d=>d.code===code&&d.pwd===pwd);
    if(!found){ err.textContent='Code ou mot de passe incorrect.'; err.classList.add('show'); return; }
    CDir = found;
    document.getElementById('dir-zone-name').textContent = found.zone;
    refreshDir(); goTo('sc-dir'); return;
  }
  if(role==='caissier'){
    const caiss = gCaiss();
    const found = Object.values(caiss).find(c=>c.code===code&&c.pwd===pwd);
    if(!found){ err.textContent='Code ou mot de passe incorrect.'; err.classList.add('show'); return; }
    CCaiss = found;
    document.getElementById('caiss-name-display').textContent = found.name;
    document.getElementById('caiss-jeu-label').textContent = JEU_LABELS[found.jeu]||found.jeu;
    goTo('sc-sec'); return;
  }
}


// ============================================================
// FIX: togglePwdInline (for forms inside admin)
// ============================================================
function togglePwdInline(inputId, btn){
  const inp = document.getElementById(inputId);
  if(!inp) return;
  if(inp.type==='password'){ inp.type='text'; btn.innerHTML='<i class="fas fa-eye-slash"></i>'; }
  else { inp.type='password'; btn.innerHTML='<i class="fas fa-eye"></i>'; }
}

// ============================================================
// FIX: admCreerDirecteur — use custom code + phone
// ============================================================
function admCreerDirecteur(){
  const name = document.getElementById('adm-dir-name')?.value.trim();
  const code = document.getElementById('adm-dir-code')?.value.trim().toUpperCase();
  const zone = document.getElementById('adm-dir-zone')?.value.trim();
  const phone= document.getElementById('adm-dir-phone')?.value.trim();
  const pwd  = document.getElementById('adm-dir-pwd')?.value;
  const pct  = parseFloat(document.getElementById('adm-dir-pct')?.value)||0;
  if(!name||!code||!zone||!pwd){ showNotif('Tous les champs obligatoires','err'); return; }
  const dirs = gDirs();
  if(dirs[code]){ showNotif('Ce code existe déjà','err'); return; }
  dirs[code] = {name, code, zone, phone:phone||'', pwd, pct:pct, createdAt:new Date().toLocaleString()};
  sDirs(dirs);
  showNotif('✅ Directeur créé: '+name+' ('+code+') — '+pct+'%','ok');
  ['adm-dir-name','adm-dir-code','adm-dir-zone','adm-dir-phone','adm-dir-pwd','adm-dir-pct'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  refreshAdmin();
}

// ============================================================
// FIX: creerCaissier — use custom code + phone
// ============================================================
function creerCaissier(){
  if(!CDir){ showNotif('Erreur: pas de directeur connecté','err'); return; }
  const name = document.getElementById('new-caiss-name')?.value.trim();
  const code = document.getElementById('new-caiss-code')?.value.trim().toUpperCase();
  const phone= document.getElementById('new-caiss-phone')?.value.trim();
  const pwd  = document.getElementById('new-caiss-pwd')?.value;
  const jeu  = document.getElementById('new-caiss-jeu')?.value || 'all';
  if(!name||!code||!pwd){ showNotif('Tous les champs obligatoires','err'); return; }
  const caiss = gCaiss();
  if(caiss[code]){ showNotif('Ce code existe déjà','err'); return; }
  caiss[code] = {name, code, phone:phone||'', pwd, jeu, dirCode:CDir.code, zone:CDir.zone, createdAt:new Date().toLocaleString()};
  sCaiss(caiss);
  showNotif('✅ Caissier créé: '+name+' ('+code+')','ok');
  ['new-caiss-name','new-caiss-code','new-caiss-phone','new-caiss-pwd'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  refreshDir();
}

// ============================================================
// FIX: Reset mot de passe agents (Admin only)
// ============================================================
function resetMdpDir(code){
  const newPwd = prompt('Nouveau mot de passe pour le directeur '+code+':');
  if(!newPwd||newPwd.length<3){ showNotif('Mot de passe trop court','err'); return; }
  const dirs=gDirs();
  if(!dirs[code]){ showNotif('Directeur introuvable','err'); return; }
  dirs[code].pwd=newPwd;
  sDirs(dirs);
  showNotif('✅ Mot de passe réinitialisé pour '+code,'ok');
  refreshAdmin();
}

function resetMdpCaiss(code){
  const newPwd = prompt('Nouveau mot de passe pour le caissier '+code+':');
  if(!newPwd||newPwd.length<3){ showNotif('Mot de passe trop court','err'); return; }
  const caiss=gCaiss();
  if(!caiss[code]){ showNotif('Caissier introuvable','err'); return; }
  caiss[code].pwd=newPwd;
  sCaiss(caiss);
  showNotif('✅ Mot de passe réinitialisé pour '+code,'ok');
  refreshAdmin();
}

function resetMdpJoueur(phone){
  const newPwd = prompt('Nouveau mot de passe pour le joueur '+phone+':');
  if(!newPwd||newPwd.length<3){ showNotif('Mot de passe trop court','err'); return; }
  const j=gJ();
  if(!j[phone]){ showNotif('Joueur introuvable','err'); return; }
  j[phone].pwd=newPwd;
  sJ(j);
  showNotif('✅ Mot de passe réinitialisé','ok');
  refreshAdmin();
}

// ============================================================
// FIX: Diff par directeur (0-80%)
// ============================================================
function getGameDiff(game){
  // Check if current user (caissier) has a directeur with specific diff
  const dirCode = CCaiss?.dirCode || CDir?.code || '';
  if(dirCode){
    const stored = localStorage.getItem('tk_diff_dir_'+dirCode+'_'+game);
    if(stored !== null) return parseFloat(stored);
  }
  // Global fallback
  const global = localStorage.getItem('tk_diff_'+game);
  return global !== null ? parseFloat(global) : 45;
}

function saveGameDiff(game){
  const el = document.getElementById(game+'-diff-range');
  if(!el) return;
  const val = parseInt(el.value);
  localStorage.setItem('tk_diff_'+game, val);
  showNotif('✅ Difficulté '+game+' sauvegardée: '+val+'%','ok');
}

function updateDiffLabel(game, val){
  const el = document.getElementById(game+'-pct-lbl');
  if(el) el.textContent = val+'%';
}

function saveDirGameDiff(dirCode, game, val){
  localStorage.setItem('tk_diff_dir_'+dirCode+'_'+game, val);
  showNotif('✅ Difficulté '+game+' sauvegardée pour '+dirCode+': '+val+'%','ok');
}

function renderDirDiffList(){
  const el = document.getElementById('dir-diff-list');
  if(!el) return;
  const dirs = gDirs();
  const dlist = Object.values(dirs);
  if(!dlist.length){
    el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:10px">Aucun directeur configuré.</div>';
    return;
  }
  const games = ['keno','lucky6','course','helico'];
  const gameLabels = {keno:'🎱 Keno',lucky6:'🍀 Lucky 6',course:'🏎️ Course',helico:'🚁 Hélico'};
  el.innerHTML = dlist.map(d => {
    const gameSliders = games.map(g => {
      const stored = localStorage.getItem('tk_diff_dir_'+d.code+'_'+g);
      const val = stored !== null ? parseInt(stored) : 45;
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${gameLabels[g]}</span>
          <span style="color:var(--gold);font-weight:700" id="ddir-${d.code}-${g}-lbl">${val}%</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="range" min="0" max="80" step="5" value="${val}" style="flex:1;accent-color:var(--gold)"
            oninput="document.getElementById('ddir-${d.code}-${g}-lbl').textContent=this.value+'%'"
            id="ddir-${d.code}-${g}">
          <button onclick="saveDirGameDiff('${d.code}','${g}',document.getElementById('ddir-${d.code}-${g}').value)"
            style="padding:4px 10px;background:var(--blue);color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">OK</button>
        </div>
      </div>`;
    }).join('');
    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-weight:800;color:var(--gold);margin-bottom:10px;font-size:14px">${d.name} <span style="color:var(--muted);font-size:11px">${d.zone}</span></div>
      ${gameSliders}
    </div>`;
  }).join('');
}

// ============================================================
// FIX: Finance logic — tracking argent maison
// ============================================================
// La logique correcte:
// - Quand joueur dépose → son solde augmente, ça ne touche pas les gains maison
// - Quand joueur perd un jeu → la mise est perdue = GAIN de la maison
// - Quand joueur gagne → on lui paie = PERTE de la maison
// tk_maison = {entrees: X (mises perdues), sorties: Y (gains payés), solde: X-Y}

function getMaisonStats(){
  const at = gAT();
  const rch = gRch();
  // Dépôts par méthode (argent des joueurs)
  const mcRch   = rch.filter(r=>r.method==='moncash'&&r.statut==='Validé');
  const ncRch   = rch.filter(r=>r.method==='natcash'&&r.statut==='Validé');
  const cashRch = at.filter(t=>t.type==='Dépôt'&&t.montant>0);
  const totalMC   = mcRch.reduce((s,r)=>s+r.amount,0);
  const totalNC   = ncRch.reduce((s,r)=>s+r.amount,0);
  const totalCash = cashRch.reduce((s,t)=>s+t.montant,0);
  const totalDepots = totalMC + totalNC + totalCash;
  // Mises perdues = gains maison (type contient 'Mise' et c'est une sortie du joueur)
  const misesPerdues = at.filter(t=>
    (t.type.includes('Mise')||t.type.includes('Casino')||t.type.includes('Caisse'))
    && t.montant < 0
  ).reduce((s,t)=>s+Math.abs(t.montant),0);
  // Gains payés aux joueurs = sortie de la maison
  const gainsPaies = at.filter(t=>
    (t.type.includes('Gain')||t.type.includes('gain'))
    && t.montant > 0
  ).reduce((s,t)=>s+t.montant,0);
  const beneficeMaison = misesPerdues - gainsPaies;
  return {totalMC,totalNC,totalCash,totalDepots,misesPerdues,gainsPaies,beneficeMaison};
}

function refreshAdminComptes(){
  const stats = getMaisonStats();
  const el = n => document.getElementById(n);
  // Comptes recharge
  if(el('adm-moncash-total')) el('adm-moncash-total').textContent=stats.totalMC.toLocaleString('fr-FR')+' Gd';
  if(el('adm-natcash-total')) el('adm-natcash-total').textContent=stats.totalNC.toLocaleString('fr-FR')+' Gd';
  if(el('adm-cash-total'))    el('adm-cash-total').textContent=stats.totalCash.toLocaleString('fr-FR')+' Gd';
  if(el('adm-total-encaisse'))el('adm-total-encaisse').textContent=stats.totalDepots.toLocaleString('fr-FR')+' Gd';
  // Gains maison
  if(el('adm-mises-perdues')) el('adm-mises-perdues').textContent=stats.misesPerdues.toLocaleString('fr-FR')+' Gd';
  if(el('adm-gains-paies'))   el('adm-gains-paies').textContent=stats.gainsPaies.toLocaleString('fr-FR')+' Gd';
  if(el('adm-benefice')){
    el('adm-benefice').textContent=stats.beneficeMaison.toLocaleString('fr-FR')+' Gd';
    el('adm-benefice').style.color=stats.beneficeMaison>=0?'var(--green2)':'var(--red)';
  }
}

// ============================================================
// PATCH: refreshAdmin — add renderDirDiffList + comptes
// ============================================================