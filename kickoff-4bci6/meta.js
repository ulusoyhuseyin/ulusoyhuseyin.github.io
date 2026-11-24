// The season around the matches (DESIGN §5, §6): result + grade + XP with a head start (R6), the style choice after match 1,
// a training card with a short ring drill, a coach story panel, an auto-continue into the next match, then feedback and the
// "to be continued" teaser. Preview scope: matches 1–2.
'use strict';

const STYLES = {
  striker: { name: 'STRIKER', special: 'COMET DRIVE', desc: 'Carry the ball and finish. Your shots +5%, and Comet Drive costs 50 Spirit instead of 60.', boost: { shoot: 3, spirit: 2 }, lean: ['shoot', 'spirit', 'dribble'] },
  engine: { name: 'ENGINE', special: 'IRON CLAMP', desc: 'Win the ball back and launch counters. Gets a special tackle that always looks spectacular.', boost: { tackle: 4, speed: 2 }, lean: ['tackle', 'stamina', 'speed', 'spirit'] },
  playmaker: { name: 'PLAYMAKER', special: 'NEEDLE PASS', desc: 'Make Mo a star. One-twos get easier, and Needle Pass sends Mo through 1-on-1.', boost: { pass: 4, dribble: 1 }, lean: ['pass', 'dribble', 'spirit'] },
};
// training (owner, 24 Nov): every match earns points; the player spends them on the stats they want.
const TSTATS = [
  ['shoot', '⚽', 'SHOOT', 'Your shots go in more often'],
  ['dribble', '🌀', 'DRIBBLE', 'Get past defenders'],
  ['pass', '🎯', 'PASS', 'Passes reach your friends'],
  ['tackle', '🛡️', 'TACKLE', 'Win the ball back'],
  ['speed', '💨', 'SPEED', 'Run faster. A fast sprint uses more energy'],
  ['stamina', '🔋', 'STAMINA', 'Get tired later, get your breath back faster'],
  ['spirit', '🔥', 'SPIRIT', 'Your special bar fills faster'],
];
// the next opponent's star talks during training, and the coach says which stats help (owner, 24 Nov): faces we already have
const RIVAL_TALK = {
  Bruno: { col: '#aab', lines: ['Train all you like, {N}. Nobody dribbles past the Wall.', 'Speed? Shooting? Doesn\'t matter. Every duel ends with me.', 'One win and you think you\'re a striker? Come and try me.'],
    tip: 'Bruno wins plain duels: <b>DRIBBLE</b> around him or <b>PASS</b> for one-twos. Their striker Dax has a special shot, THUNDER HAMMER.' },
  Ren: { col: '#8fd8ff', lines: ['My Frost Spiral has never been stopped. Train harder, {N}.', 'You beat the Wall? Cute. I\'m on a different level.', 'Bring stamina, {N}. I\'ll make you run until you drop.'],
    tip: 'Ren is fast and shoots hard. <b>STAMINA</b> to keep up with him, <b>TACKLE</b> to stop him.' },
};
function rivalCard() {
  const opp = OPPS[Math.min(save.match, OPPS.length) - 1], r = opp && opp.boss && RIVAL_TALK[opp.boss];
  if (!r) return '';
  return `<div class="tnext"><img src="img/face_${opp.boss.toLowerCase()}.jpg" alt="" style="border-color:${r.col}">
    <div><span class="lab">NEXT · MATCH ${save.match} · ${opp.name.toUpperCase()}</span>
    <span class="say"><b>${opp.boss.toUpperCase()}:</b> "${pick(r.lines).replace('{N}', save.name)}"</span>
    <span class="tip">COACH ITO: ${r.tip}</span></div></div>`;
}
const tcost = v => v < 14 ? 1 : v < 19 ? 2 : 3, TMAX = 30;
const tpFor = (res, grade) => 4 + (res === 'w' ? 1 : 0) + (grade === 'S' || grade === 'A' ? 1 : 0);
const botGo = (el, ms = 400) => { if (BOT && el) setTimeout(() => el.click(), ms / FAST); };

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
  $('hud').style.display = id ? 'none' : 'flex';
  if (id) { $('scene').classList.remove('on'); $('zone').classList.remove('on'); $('pl').style.display = 'none'; document.querySelectorAll('#acts button, #bPlan').forEach(b => b.classList.remove('on')); $('planbar').classList.remove('on'); PLAN.on = false; }
}

// ---------------------------------------------------------------- title
function title() {
  G = null; show('title');
  $('play').textContent = save.done ? 'REPLAY MATCH 3' : save.match > 1 ? `CONTINUE · MATCH ${save.match}` : 'KICK OFF';
  const tb = $('trainBtn'); tb.style.display = save.match > 1 || save.tp ? '' : 'none'; tb.textContent = save.tp ? `TRAINING · ★ ${save.tp} POINT${save.tp === 1 ? '' : 'S'}` : 'TRAINING';
  tb.onclick = () => training(title, 'DONE');
  $('tsub').textContent = save.style ? `${save.name} · LV ${save.lvl} · ${STYLES[save.style].name}` : 'Anime football. You make the calls.';
  const cb = $('consentBox');
  if (!LS.get('ss.consent')) {
    cb.innerHTML = `<div class="consent"><b>Help us improve the game?</b> Share anonymous play data: your choices, scores and time played. No names, no personal details.
      <div><button data-c="yes">Yes, happy to help</button><button class="ghost" data-c="no">No thanks</button></div></div>`;
    cb.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { LS.set('ss.consent', b.dataset.c); cb.innerHTML = ''; if (b.dataset.c === 'yes') track('consent'); });
  } else cb.innerHTML = `<button class="link" id="mute">sound: ${MUTE ? 'off' : 'on'}</button>`;
  const m = $('mute'); if (m) m.onclick = () => { MUTE = !MUTE; LS.set('ss.mute', MUTE ? '1' : '0'); title(); };
  botGo($('play'));
}
$('play').onclick = () => { if (save.done) save.match = 3; startMatch(); };
$('reset').onclick = () => { if (confirm('Start a new season? Your level and style will be reset.')) { save = fresh(); store(); title(); } };

function startMatch() {
  show(null); newMatch(); snd('whistle');
  track('m_start', { m: G.m, style: save.style, lvl: save.lvl });
  if (G.tut) setHint('Drag anywhere to steer. Or just watch: the choices come to you.', 5000);
  else setHint(`Match ${G.m} vs ${G.opp.name}`, 3000);
  if (G.m === 2) setTimeout(() => G && toast('ito', 'COACH ITO', 'Bruno wins plain duels. Go around him!', 4200), 1600);
  if (G.m === 3) setTimeout(() => G && toast('ren', 'REN', 'Show me that Comet Drive. I\'ll freeze it.', 4200), 1600);
}

// ---------------------------------------------------------------- result
function finish() {
  G.over = true; snd('whistle');
  if (AUD) { const avg = t => Math.round(G.P.filter(q => q.team === t && q.role !== 'GK').reduce((s, q) => s + q.en, 0) / 10);
    (AUD.stam = AUD.stam || []).push({ heroMin: Math.round(G.heroMin), heroEnd: Math.round(G.hero.en), us: avg(0), them: avg(1), half: !!G.half }); }
  const st = G.stat, [a, b] = G.score, res = a > b ? 'w' : a === b ? 'd' : 'l', m = G.m;
  const wonRate = st.dec ? st.won / st.dec : 0, perfRate = st.dec ? st.perfect / st.dec : 0;
  const pts = (a - b) * 2 + (res === 'w' ? 3 : res === 'd' ? 1 : 0) + wonRate * 5 + perfRate * 4 + st.goals * .5;
  const grade = pts >= 13 ? 'S' : pts >= 9 ? 'A' : pts >= 5 ? 'B' : 'C';
  const xp = 50 + (res === 'w' ? 40 : res === 'd' ? 15 : 5) + st.goals * 20 + st.assists * 12 + st.won * 4 + st.perfect * 3;
  const real = Math.round((performance.now() - G.real0) / 1000);
  const inRange = st.chances.filter(c => c >= 45 && c <= 75).length;
  const summary = { len: G.opp.len, pace: PACE, free: st.free || 0, oppPasses: st.oppPasses || 0, m, res, score: `${a}-${b}`, grade, dec: st.dec, won: st.won, perfect: st.perfect, good: st.good, upset: st.upset, specials: st.specials, goals: st.goals, assists: st.assists, real, think: Math.round(st.think || 0), oddsBand: st.chances.length ? Math.round(inRange / st.chances.length * 100) : 0, steered: !!G.touched };
  window.LAST = { ...summary, chances: st.chances, gaps: st.gaps, kinds: st.kinds };
  track('m_end', summary);
  save.plays = (save.plays || 0) + 1; save.rec.push({ m, res, a, b, grade });
  // XP, with one guaranteed level-up per season-1 match and a head start on the next bar (R6)
  const lv0 = save.lvl, xp0 = save.xp, need0 = need(lv0);
  save.xp += xp; let bonus = 0;
  if (save.xp < need0) { bonus = need0 - save.xp; save.xp = need0; }
  save.xp -= need0; save.lvl++; save.xp = Math.max(save.xp, Math.round(need(save.lvl) * .2));
  const tpGain = tpFor(res, grade); save.tp += tpGain;
  store();
  const next = OPPS[m] || null;
  const r = $('result');
  r.innerHTML = `<h1 class="bang">${res === 'w' ? 'VICTORY!' : res === 'd' ? 'DRAW!' : 'DEFEAT'}</h1>
    <h2 class="bang">${save.name} ${a} - ${b} ${G.opp.short}</h2>
    <div class="grade ${grade}">${grade}</div>
    <div class="chips"><span>decisions won <b>${st.won}/${st.dec}</b></span><span>PERFECT <b>${st.perfect}</b></span><span>upsets <b>${st.upset}</b></span><span>goals <b>${st.goals}</b></span>${st.assists ? `<span>assists <b>${st.assists}</b></span>` : ''}${st.specials ? `<span>specials <b>${st.specials}</b></span>` : ''}</div>
    <p class="bang" style="font-size:26px">+<span id="xpn">0</span> XP${bonus ? ` <span style="font-size:16px;opacity:.8">(+ match bonus)</span>` : ''}</p>
    <div class="xp"><i id="xpb" style="width:${xp0 / need0 * 100}%"></i></div>
    <p id="lvl" class="small">LV ${lv0}</p>
    <p class="small" style="max-width:360px">${res === 'l' ? 'A loss still makes you stronger. Try again, or keep going. ' : ''}${m === 1 ? 'Next: <b>Iron Valley</b>. Their centre-back <b>Bruno</b> is called "the Wall".' : m === 2 ? 'Next: <b>Storm Academy</b>. <b>Ren</b> is waiting.' : 'Next: <b>Kings of Sand</b>, then the Final against <b>Sora</b>.'}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${res === 'l' ? '<button class="btn alt" id="rematch">REMATCH</button>' : ''}<button class="btn" id="cont">CONTINUE</button></div>`;
  show('result');
  let n = 0; const tick = setInterval(() => { n = Math.min(xp, n + Math.ceil(xp / 25)); $('xpn').textContent = n; if (n >= xp) clearInterval(tick); }, 40);
  setTimeout(() => { $('xpb').style.width = '100%'; }, 300);
  setTimeout(() => { snd('level'); const l = $('lvl'); l.className = 'unlock bang'; l.textContent = `LEVEL UP! LV ${save.lvl} · +${tpGain} TRAINING POINTS`;
    const bar = $('xpb'); bar.style.transition = 'none'; bar.style.width = '0'; requestAnimationFrame(() => { bar.style.transition = 'width .6s ease-out'; bar.style.width = '20%'; }); }, 1500);
  const advance = () => {
    if (m === 1) { save.match = 2; store(); if (!save.style) pickStyle(); else training(() => story(nextMatch)); }
    else if (m === 2) { save.match = 3; store(); const go = () => training(() => story(nextMatch)); if (!save.fb) feedback(go); else go(); }
    else { save.done = true; save.lastRes = res; store(); ending(); }
  };
  $('cont').onclick = () => { $('cont').onclick = null; advance(); };
  if ($('rematch')) $('rematch').onclick = () => startMatch();
  botGo($('cont'), 2200);
}

// ---------------------------------------------------------------- style choice (after match 1)
function pickStyle() {
  const p = $('pick'); delete p.dataset.done;
  p.innerHTML = `<h2 class="bang">WHAT KIND OF PLAYER ARE YOU?</h2><p>Your style changes your moves and how you grow. Start a new season any time to try another one.</p>
    <div class="cards">${Object.entries(STYLES).map(([k, s]) => `<div class="card"><h3>${s.name}</h3><span class="sp">${s.special}</span><p>${s.desc}</p>
      <p style="opacity:.7">${Object.entries(s.boost).map(([st, v]) => `${st.toUpperCase()} +${v}`).join(' · ')}</p>
      <div class="row"><button class="btn alt" data-w="${k}">▶ WATCH</button><button class="btn" data-k="${k}">PICK</button></div></div>`).join('')}</div>
    <p class="small">Comet Drive stays with you in every style.</p>`;
  show('pick');
  p.querySelectorAll('[data-w]').forEach(b => b.onclick = async () => {
    fxc.style.zIndex = 20; const k = b.dataset.w;
    if (k === 'striker') await techDFull('COMET DRIVE', true);
    else if (k === 'engine') await techFX('IRON CLAMP', 'kai', ['#e8f8ff', '#5ab8ff', '#0e2c55'], 1.8, true);
    else await techFX('NEEDLE PASS', 'kai', ['#fffbd0', '#9dff7a', '#0f3d1f'], 1.8, true);
    fxc.style.zIndex = '';
  });
  p.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    if (p.dataset.done) return; p.dataset.done = '1';
    const k = b.dataset.k; save.style = k; for (const [st, v] of Object.entries(STYLES[k].boost)) save.stats[st] += v; store();
    track('style', { style: k }); banner(STYLES[k].name + '!'); snd('level');
    setTimeout(() => training(() => story(nextMatch)), 700);
  });
  botGo(pick([...p.querySelectorAll('[data-k]')]), 600);
}

// ---------------------------------------------------------------- training: spend points on stats, plus one optional bonus drill
function training(then, doneLabel = 'NEXT MATCH ▶') {
  const t = $('train'), start = { ...save.stats }, tp0 = save.tp, lean = save.style ? STYLES[save.style].lean : ['shoot', 'dribble', 'spirit'];
  let earned = 0, left = false; const rival = rivalCard();   // one taunt per visit, so it doesn't change on every +
  const draw = () => {
    t.classList.remove('tdrill');
    const changed = TSTATS.some(([k]) => save.stats[k] !== start[k]), drilled = save.drillM === save.match;
    t.innerHTML = `<h2 class="bang">TRAINING</h2>${rival}
      <div class="tphead"><img src="img/face_kai.jpg" alt=""><div><b>${save.name}</b> · LV ${save.lvl}<br><span class="small">${save.style ? STYLES[save.style].name : 'ROOKIE'}</span></div>
        <span class="pts ${save.tp ? '' : 'zero'}">★ ${save.tp} POINT${save.tp === 1 ? '' : 'S'}</span></div>
      <p class="small">${save.tp ? 'Tap <b>+</b> to make ' + save.name + ' stronger. ★ = good for your style.' : 'All points spent. You get more after every match.'}</p>
      <div class="trows">${TSTATS.map(([k, ic, nm, ds]) => { const v = save.stats[k], c = tcost(v), gain = v - start[k], lw = lean.includes(k);
        return `<div class="trow${lw ? ' lean' : ''}"><span class="ic">${ic}</span>
          <span class="nm">${nm}${lw ? ' ★' : ''} <b>${Math.round(v)}</b>${gain ? `<span class="up">+${gain}</span>` : ''}<span class="bar"><i style="width:${(v - gain) / TMAX * 100}%;float:left"></i><i class="new" style="width:${gain / TMAX * 100}%;float:left"></i></span></span>
          <span class="ds">${ds}</span>
          <button class="plus" data-k="${k}" ${save.tp < c || v >= TMAX ? 'disabled' : ''}>+<small>${c} PT${c > 1 ? 'S' : ''}</small></button></div>`; }).join('')}</div>
      <div class="tfoot">${changed ? '<button class="btn alt" id="tundo">UNDO</button>' : ''}${drilled ? '' : '<button class="btn alt" id="tdrill">BONUS DRILL</button>'}<button class="btn" id="tdone">${doneLabel}</button></div>
      ${save.tp ? '<p class="small">Points you don\'t spend are kept for later.</p>' : ''}`;
    t.querySelectorAll('.plus').forEach(b => b.onclick = () => {
      const k = b.dataset.k, c = tcost(save.stats[k]); if (save.tp < c) return;
      save.tp -= c; save.stats[k]++; store(); snd('good'); draw();
    });
    if ($('tundo')) $('tundo').onclick = () => { save.stats = { ...start }; save.tp = tp0 + earned; store(); draw(); };
    if ($('tdrill')) $('tdrill').onclick = drill;
    $('tdone').onclick = () => { if (left) return; left = true;
      track('train', { spent: tp0 + earned - save.tp, left: save.tp, gains: Object.fromEntries(TSTATS.filter(([k]) => save.stats[k] !== start[k]).map(([k]) => [k, save.stats[k] - start[k]])) });
      then(); };
    if (BOT) {                                                // robot: spend on the style's stats in turn, try the drill, then leave
      const nextK = lean.find(k => tcost(save.stats[k]) <= save.tp && lean.every(j => save.stats[j] - start[j] >= save.stats[k] - start[k]));
      botGo(nextK ? t.querySelector(`.plus[data-k=${nextK}]`) : $('tdrill') || $('tdone'), 250);
    }
  };
  const drill = async () => {                                 // one optional timing drill per match: GOOD +1, PERFECT +2, up to 3 tries
    t.classList.add('tdrill');
    t.innerHTML = `<h2 class="bang">BONUS DRILL</h2>
      <p>A ball will appear in the middle. An <b style="color:#ff9b3f">orange ring</b> shrinks towards the <b style="color:#ffd23f">gold circle</b>.</p>
      <p><b>Tap anywhere</b> when the orange ring is on the gold circle.</p>
      <p class="small">GOOD = +1 point · PERFECT = +2 · you get 3 tries · same timing as the rings in matches</p>
      <div class="tfoot"><button class="btn alt" id="dskip">BACK</button><button class="btn" id="dgo">START</button></div>`;
    const go = await new Promise(r => { $('dgo').onclick = () => r(true); $('dskip').onclick = () => r(false); botGo($('dgo'), 300); });
    if (!go) return draw();
    let got = 0, tries = 0;
    while (tries < 3 && !got) {
      tries++;
      t.innerHTML = `<h2 class="bang">BONUS DRILL</h2><p>Try ${tries} of 3</p>`;
      await wait(500 / FAST);
      fxc.style.zIndex = 20; const q = await ringTap(2, 'WAIT FOR IT...', true); fxc.style.zIndex = '';
      got = q === 'perfect' ? 2 : q === 'good' ? 1 : 0;
      if (!got && tries < 3) { t.innerHTML = `<h2 class="bang">BONUS DRILL</h2><p>${q === 'early' ? 'A bit <b>too early</b>. Wait until the rings meet.' : q === 'late' ? 'A bit <b>too late</b>. Tap as soon as they meet.' : 'Missed. Tap when the rings meet.'}</p>`; await wait(1400 / FAST); }
    }
    save.drillM = save.match; save.tp += got; earned += got; store(); track('drill', { got, tries });
    if (got) snd('level');
    t.innerHTML = `<h2 class="bang">${got ? 'NICE!' : 'GOOD TRY!'}</h2><p class="unlock bang">${got ? `+${got} POINT${got > 1 ? 'S' : ''}` : 'NO BONUS THIS TIME'}</p>
      <p>${got ? 'Use the same timing in matches.' : 'Your normal points are still there. Practise the ring in matches.'}</p><button class="btn" id="dback">BACK TO TRAINING</button>`;
    $('dback').onclick = draw; botGo($('dback'), 400);
  };
  show('train'); draw();
}
function ringTap(T, label, cue) {                          // one timing ring on the fx layer; resolves 'perfect' | 'good' | 'early' | 'late' | 'miss'
  return new Promise(res => {
    const t0 = performance.now(); let tapAt = null, q = null, qt = 0;
    const onTap = e => { if (tapAt === null) { tapAt = (performance.now() - t0) / 1000; e.preventDefault(); } };
    addEventListener('pointerdown', onTap, true);
    const onKey = e => { if (['Space', 'Enter'].includes(e.code)) { e.stopPropagation(); onTap(e); } }; addEventListener('keydown', onKey, true);
    const botT = BOT ? rnd(.6, 1) * T : null;
    const f = now => {
      const t = (now - t0) / 1000; if (BOT && tapAt === null && t >= botT) tapAt = botT;
      const c = fx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, CW, CH);
      const R = Math.min(CW, CH) * .14, cx = CW / 2, cy = CH * .55, rr = x => R * (3 - 2.6 * Math.min(x, T) / T);
      if (!q && (tapAt !== null || t > T + .1)) { const err = tapAt === null ? 9 : rr(tapAt) / R - 1; q = Math.abs(err) <= .14 ? 'perfect' : Math.abs(err) <= .38 ? 'good' : tapAt === null ? 'miss' : err > 0 ? 'early' : 'late'; qt = t; snd(q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : 'tick'); }
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
      const inWin = cue && !q && Math.abs(rr(t) / R - 1) <= .38; c.strokeStyle = inWin ? 'rgba(255,210,63,.9)' : 'rgba(255,210,63,.35)'; c.lineWidth = R * .24; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
      c.strokeStyle = q === 'perfect' ? '#ffd23f' : '#ff9b3f'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, Math.max(4, rr(tapAt !== null ? tapAt : t)), 0, 7); c.stroke();
      ballArt(c, cx, cy, R * .45, 1, t * 4);
      c.textAlign = 'center'; c.font = '26px Bangers, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
      const word = q ? ({ perfect: 'PERFECT!', good: 'GOOD', early: 'TOO EARLY', late: 'TOO LATE' }[q] || 'MISS') : inWin ? 'NOW!' : label, ty = cy - R * 3.3;
      c.strokeText(word, cx, ty); c.fillText(word, cx, ty);
      if (q && t - qt > .55) { removeEventListener('pointerdown', onTap, true); removeEventListener('keydown', onKey, true); c.clearRect(0, 0, CW, CH); setTimeout(() => res(q), 150); return; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
}

// ---------------------------------------------------------------- story panel (Coach Ito), tap to advance
const STORY = {
  2: [['ito', 'COACH ITO', 'Good debut, Kai. But next is Iron Valley.'],
      ['ito', 'COACH ITO', 'Their centre-back Bruno wins almost every plain duel. They call him "the Wall".'],
      ['mo', 'MO', 'Then we go around the wall. Together!'],
      ['ito', 'COACH ITO', 'Use Mo. Use your special. And watch the ring.']],
  3: [['ito', 'COACH ITO', 'Storm Academy. Ren\'s team. They pass fast and think faster.'],
      ['ren', 'REN', 'So the amateur beat the Wall. Cute. My Frost Spiral has never been stopped.'],
      ['mo', 'MO', 'Then today is the first time. Right, Kai?'],
      ['ito', 'COACH ITO', 'When Ren shoots, your keeper needs you. Nail that ring.']],
};
function story(then) {
  const lines = STORY[save.match] || []; let i = 0, done = false;
  const s = $('story');
  const draw = () => {
    if (i >= lines.length) { if (!done) { done = true; s.onclick = null; then(); } return; }
    const [face, name, text] = lines[i];
    s.style.background = `linear-gradient(rgba(5,10,8,.55), rgba(5,10,8,.85)), url(img/bg_school.jpg) center/cover`;
    s.innerHTML = `<img class="face-big" src="img/face_${face}.jpg" alt="" style="border-color:${face === 'mo' ? '#e23b3b' : face === 'ren' ? '#8fd8ff' : '#3c9'}"><div class="bubble"><b>${name}</b>${text}</div><p class="small">tap to continue</p>`;
  };
  s.onclick = () => { i++; draw(); if (BOT && !done) botGo(s, 300); };
  show('story'); draw(); botGo(s, 300);
}

// ---------------------------------------------------------------- next match countdown (auto-continue)
function nextMatch() {
  const opp = OPPS[save.match - 1], n = $('nextm'); let left = 5, gone = false;
  const go = () => { if (gone) return; gone = true; clearInterval(iv); startMatch(); };
  n.innerHTML = `<p class="bang" style="font-size:22px;color:#8fd8ff">MATCH ${save.match}</p><h1 class="bang">${opp.name.toUpperCase()}</h1>
    ${opp.boss ? `<img class="face-big" src="img/face_${opp.boss.toLowerCase()}.jpg" alt="" style="border-color:#aab"><p><b>${opp.boss}</b> · "${opp.tag || 'the Wall'}"</p>` : ''}
    <div class="count" id="cd">5</div><button class="btn" id="go">KICK OFF</button>`;
  show('nextm');
  var iv = setInterval(() => { left--; if ($('cd')) $('cd').textContent = left; if (left <= 0) go(); }, 1000 / FAST);
  $('go').onclick = go;
}

// ---------------------------------------------------------------- feedback (fun 1–5 + comment), then the teaser
function feedback(then) {
  const f = $('feedback'); let fun = 0;
  const consented = LS.get('ss.consent') === 'yes';
  f.innerHTML = `<h2 class="bang">QUICK QUESTION</h2><p>Before you face Ren: how fun has it been so far?</p>
    <div class="rate">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join('')}</div><p class="small">1 = boring · 5 = loved it</p>
    <textarea id="fbt" maxlength="240" placeholder="Anything to tell us? What was fun, what was boring? (optional)"></textarea>
    <button class="btn" id="fbs" disabled style="opacity:.5">SEND</button>
    <p class="small">${consented ? 'Sent anonymously with your play data.' : 'Pressing send shares only your rating and comment, anonymously.'}</p>
    <button class="link" id="fbskip">skip</button>`;
  show('feedback');
  f.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { fun = +b.dataset.v; f.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('sel', x === b)); $('fbs').disabled = false; $('fbs').style.opacity = 1; });
  $('fbs').onclick = () => { track('feedback', { fun, comment: $('fbt').value.slice(0, 240), style: save.style, lvl: save.lvl }, true); save.fb = true; store(); (then || ending)(); };
  $('fbskip').onclick = () => { track('feedback_skip', {}); (then || ending)(); };
  if (BOT) { botGo(f.querySelector('[data-v="4"]'), 300); botGo($('fbs'), 700); }
}
function ending() {
  const e = $('ending');
  e.innerHTML = `<h1 class="bang">TO BE<br>CONTINUED...</h1><img class="face-big" src="img/face_ren.jpg" alt="">
    <div class="bubble"><b style="color:#2a7fb8">REN</b>${save.lastRes === 'w' ? `Hmph. Enjoy it, ${save.name}. Next time I won't hold back.` : `Is that all, ${save.name}? Come back when your Comet Drive actually burns.`}</div>
    <p>Match 4 (Kings of Sand) and the Final against Sora are coming next.</p>
    <button class="btn" id="again">REPLAY MATCH 3</button><button class="btn alt" id="newseason">NEW SEASON · TRY ANOTHER STYLE</button>
    <p class="small">Thanks for playing the preview!</p>`;
  show('ending');
  $('again').onclick = () => { save.match = 3; startMatch(); };
  $('newseason').onclick = () => { save = fresh(); save.plays = 1; store(); title(); };
}

addEventListener('pagehide', () => { if (G && !G.over) track('quit', { m: G.m, t: Math.round(G.t), score: G.score.join('-'), dec: G.stat.dec }); });
title();
window.GAME = { get G() { return G; }, get save() { return save; }, startMatch, finish, title, store };
