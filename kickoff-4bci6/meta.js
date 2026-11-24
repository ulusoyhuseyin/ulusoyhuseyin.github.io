// The season around the matches (DESIGN §5, §6): result + grade + XP with a head start (R6), the style choice after match 1,
// a training card with a short ring drill, a coach story panel, an auto-continue into the next match, then feedback and the
// "to be continued" teaser. Preview scope: matches 1–2.
'use strict';

const STYLES = {
  striker: { name: 'STRIKER', special: 'COMET DRIVE', desc: 'Carry the ball and finish. Your shots +5%, and Comet Drive costs 50 Spirit instead of 60.', boost: { shoot: 3, spirit: 2 }, lean: ['shoot', 'spirit', 'dribble'] },
  engine: { name: 'ENGINE', special: 'IRON CLAMP', desc: 'Win the ball back and launch counters. Gets a special tackle that always looks spectacular.', boost: { tackle: 4, speed: 2 }, lean: ['tackle', 'speed', 'spirit'] },
  playmaker: { name: 'PLAYMAKER', special: 'NEEDLE PASS', desc: 'Make Mo a star. One-twos get easier, and Needle Pass sends Mo through 1-on-1.', boost: { pass: 4, dribble: 1 }, lean: ['pass', 'dribble', 'spirit'] },
};
const TRAIN = {
  striker: [['SHOT TIMING', 'shoot'], ['SPIRIT FOCUS', 'spirit'], ['SPRINT DRILLS', 'speed']],
  engine: [['TACKLE DUMMY', 'tackle'], ['HILL SPRINTS', 'speed'], ['SPIRIT FOCUS', 'spirit']],
  playmaker: [['WALL PASSES', 'pass'], ['CONE DRIBBLE', 'dribble'], ['SPIRIT FOCUS', 'spirit']],
  general: [['CONE DRIBBLE', 'dribble'], ['WALL PASSES', 'pass'], ['TACKLE DUMMY', 'tackle'], ['SHOT TIMING', 'shoot']],
};
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
  const lean = save.style ? STYLES[save.style].lean : ['shoot', 'dribble', 'spirit'];
  for (const k of lean) save.stats[k]++;
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
  setTimeout(() => { snd('level'); const l = $('lvl'); l.className = 'unlock bang'; l.textContent = `LEVEL UP! LV ${save.lvl} · ${lean.map(k => k.toUpperCase()).join(' ')} +1`;
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

// ---------------------------------------------------------------- training: pick 1 of 3, then a 3-tap ring drill (each PERFECT = +1 more)
function training(then) {
  const pool = TRAIN[save.style || 'striker'], gen = TRAIN.general.filter(g => !pool.some(p => p[1] === g[1]));
  const cards = [...pool.slice().sort(() => Math.random() - .5).slice(0, 2), pick(gen)];
  const t = $('train'); t.dataset.busy = '';
  t.innerHTML = `<h2 class="bang">TRAINING</h2><p>Pick one drill. Tap the ring 3 times: each <b>PERFECT</b> adds +1 more.</p>
    <div class="cards">${cards.map(([n, st], i) => `<button class="card" data-i="${i}"><h3>${n}</h3><span class="sp">${st.toUpperCase()} +2</span><p>now ${save.stats[st]}</p></button>`).join('')}</div>`;
  show('train');
  t.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
    if (t.dataset.busy === '1') return; t.dataset.busy = '1';
    const [n, st] = cards[+b.dataset.i];
    t.innerHTML = `<h2 class="bang">${n}</h2><p id="drill">Tap when the ring hits the circle!</p>`;
    fxc.style.zIndex = 20; let perf = 0;
    for (let i = 0; i < 3; i++) { const q = await ringTap(1.5 - i * .1, `${i + 1} / 3`); if (q === 'perfect') perf++; $('drill').textContent = `${perf} PERFECT so far`; }
    fxc.style.zIndex = '';
    const before = save.stats[st]; save.stats[st] += 2 + perf; store(); track('train', { card: st, perf });
    t.innerHTML = `<h2 class="bang">${n}</h2><p class="unlock bang">${st.toUpperCase()} ${before} → ${save.stats[st]}</p><p>${perf ? `${perf} PERFECT: +${perf} bonus.` : 'No PERFECT this time. Watch the ring, then tap.'}</p><button class="btn" id="tdone">CONTINUE</button>`;
    snd('level'); $('tdone').onclick = then; botGo($('tdone'), 600);
  });
  botGo(t.querySelector('[data-i]'), 500);
}
function ringTap(T, label) {                               // one timing ring on the fx layer; resolves 'perfect' | 'good' | 'miss'
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
      if (!q && (tapAt !== null || t > T + .1)) { const err = tapAt === null ? 9 : rr(tapAt) / R - 1; q = Math.abs(err) <= .14 ? 'perfect' : Math.abs(err) <= .38 ? 'good' : 'miss'; qt = t; snd(q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : 'tick'); }
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(255,210,63,.35)'; c.lineWidth = R * .24; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
      c.strokeStyle = q === 'perfect' ? '#ffd23f' : '#ff9b3f'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, Math.max(4, rr(tapAt !== null ? tapAt : t)), 0, 7); c.stroke();
      ballArt(c, cx, cy, R * .45, 1, t * 4);
      c.textAlign = 'center'; c.font = '26px Bangers, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
      c.strokeText(q ? (q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'GOOD' : 'MISS') : label, cx, cy - R * 1.5); c.fillText(q ? (q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'GOOD' : 'MISS') : label, cx, cy - R * 1.5);
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
