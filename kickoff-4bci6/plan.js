// PLAN: stop the clock any time and decide (owner, 24 Nov: "add the ability to pause and decide what to do").
// The camera pulls back; with the ball every teammate shows a pass line with its real success chance (the same AI evaluation
// the opponents use) and the AI's best idea gets a star. Tap a teammate to pass, tap the goal to shoot, or pick a move.
// Without the ball: tap a teammate to control him, STOP HIM (tackle decision) or PRESS. Team tactics: DEFEND / BALANCED / ATTACK.
// With the ball PLAN always lists PASS / LONG PASS / SHOOT / SPECIAL SHOT / ONE-TWO (greyed out with the reason when not possible),
// plus STEER IN when getting closer gives a clearly better shot. Any teammate can be picked as the target (owner, 26 Nov):
// tap him on the pitch or his name in the PASS TO row; PASS / LONG PASS / ONE-TWO then use him; tap him again to play it.
// Keyboard (desktop): Space = PLAN, WASD/arrows = run, J = pass, L = long ball, K = shoot, H = tackle;
// in PLAN 1-7 pick a button, J/L/K/O = pass / long / shoot / one-two, Tab = next teammate.
'use strict';

const PLAN = { on: false, tactic: 'bal', info: null };
function planOpen() {
  if (!G || G.paused || G.cutting || G.goalKick || G.over || G.goalAnim || CINE.on || G.ball.shot || G.tut) return;
  audN('plan'); PLAN.on = true; G.paused = true; G.plan = true; steer = null; touch = null; snd('tick');
  G.stat.plans = (G.stat.plans || 0) + 1;
  $('hint').style.opacity = 0; $('toast').classList.remove('on');   // tips and speech bubbles would cover the pass chances
  PLAN.sel = null; planBar();
  if (BOT) setTimeout(botPlan, 300);
}
function planClose() { PLAN.on = false; PLAN.spot = null; PLAN.sel = null; if (G) { G.plan = false; G.paused = false; } $('planbar').classList.remove('on'); }
function planInfo() {
  const b = G.ball, c = G.ctrl, car = b.owner, info = { mode: car && car.team === 0 ? 'attack' : car ? 'defend' : 'loose', marks: [] };
  if (info.mode === 'attack') {
    const opts = AI.options(car); let best = null;
    for (const o of opts) if (!best || o.v > best.v) best = o;
    const all = info.targets = opts.filter(o => o.kind === 'pass' || o.kind === 'long').sort((a, b) => b.v - a.v);   // every teammate in reach
    const sel = info.sel = (PLAN.sel && all.find(o => o.q === PLAN.sel)) || null;
    const defPass = fwdFirst(car, all.filter(o => o.kind === 'pass'))[0] || null, defLong = fwdLong(car, all.filter(o => o.kind === 'long'))[0] || null;
    info.pass = sel && sel.kind === 'pass' ? sel : defPass;   // the picked teammate, else the same picks as the in-play PASS / LONG buttons
    info.long = sel && sel.kind === 'long' ? sel : defLong;
    if (!info.long) {                                         // nobody 24 m+ ahead: offer a lofted ball into the space in front of the furthest teammate
      const up = G.P.filter(q => q.team === 0 && q.role !== 'GK' && q !== car && q.stun <= 0 && car.y - q.y > 6).sort((a, b) => a.y - b.y)[0];
      const sc = up && spaceChance(car, clamp(up.x, 4, W - 4), clamp(up.y - 7, 4, H - 4));
      if (sc && sc.lofted && sc.who && sc.who.team === 0) info.longSpace = sc;
    }   // the LONG PASS button's target always has its line
    for (const o of all) info.marks.push({ q: o.q, p: o.p, kind: o.kind, best: best.kind === o.kind && best.q === o.q, sel: !!sel && sel.q === o.q });
    const o2 = all.filter(o => o.kind === 'pass' && dist(car, o.q) <= 20).map(o => ({ q: o.q, p: oneTwoChance(car, o.q), behind: o.q.y - car.y > 6 }))
      .sort((a, b) => (a.behind - b.behind) || (b.p - a.p));   // a one-two goes with a man beside or ahead of you; behind only if nobody else
    info.o2 = sel ? o2.find(x => x.q === sel.q) || null : o2[0] || null;
    info.o2why = sel ? `${sel.q.name} is too far · max 20 m` : 'nobody within 20 m';
    const cr = crossOpts(car); info.cross = (sel && cr.find(c => c.q === sel.q)) || cr[0] || null;
    info.steer = distToGoal(car) < 36 && angleOk(car) && !G.steerIn ? steerGain(car, false) : null;
    info.best = best; info.car = car;
    info.shot = angleOk(car) && distToGoal(car) < 34 ? clamp(shotChance(car, keeperOf(1), false) - tiredPen(car), .03, .8) : null;
    // the special shot: always listed, with the honest reason when it can't be used yet (owner, 26 Nov: shoot, special shoot and long pass in PLAN)
    const d0 = distToGoal(car), d = Math.round(d0);
    info.specs = unlockedSpecials().map(k => { const cost = shotCost(k);
      const why = car !== G.hero ? `only ${G.hero.name} has one` : G.sp < cost ? `need ${cost} spirit · have ${Math.floor(G.sp)}` : car.en < EN[k] ? `too tired · need ⚡${EN[k]}`
        : d0 > SPEC_RANGE ? `${d} m · get within ${SPEC_RANGE} m` : !specAngleOk(car) ? 'no angle · move inside' : null;
      return { k, cost, why, ch: why ? null : bonuses({ ch: shotChance(car, keeperOf(1), k), special: true, kind: 'shot' }, car).ch }; });
    if (car !== G.hero) info.specs = info.specs.slice(0, 1);
    info.foe = foes(car).filter(f => f.role !== 'GK' && f.stun <= 0).sort((a, d) => dist(a, car) - dist(d, car))[0];
  } else if (info.mode === 'defend') {
    info.car = car;
    info.tackle = c.role !== 'GK' && dist(c, car) < 6 ? clamp(chance(c.st.tackle, car.st.dribble) - tiredPen(c) + tiredPen(car), .05, .9) : null;
  }
  return info;
}
function planBar() {
  const info = PLAN.info = planInfo(), bar = $('planbar'), acts = $('planacts'), c = G.ctrl;
  const btn = (label, sub, fn, cls, off, k) => { const b = document.createElement('button'), n = acts.children.length + 1;
    b.innerHTML = `${label}<small>${sub}</small>`; if (cls) b.className = cls; b.disabled = !!off; b.dataset.n = n; if (k) b.dataset.k = k; b.onclick = fn; acts.appendChild(b); };
  acts.innerHTML = ''; const tg = $('plantg'); tg.innerHTML = ''; tg.style.display = info.mode === 'attack' && info.targets.length ? 'flex' : 'none';
  if (info.mode === 'attack') {
    const car = info.car, bestTxt = info.best.kind === 'cross' ? `cross to ${info.best.q.name}` : info.best.kind === 'pass' || info.best.kind === 'long' ? `pass to ${info.best.q.name}` : info.best.kind === 'shoot' ? 'shoot' : info.best.kind === 'dribble' ? 'keep running' : 'hold it';
    const pct = p => `${Math.round(p * 100)}%`, d = Math.round(distToGoal(car)), sel = info.sel;
    $('planhint').innerHTML = PLAN.spot ? `Pass into space: <b>${pct(PLAN.spot.p)}</b> · ${PLAN.spot.who ? PLAN.spot.who.name + ' runs for it' : ''}. Tap the spot again to play it.`
      : sel ? `<b>${sel.q.name}</b> picked: ${sel.kind === 'long' ? 'LONG PASS' : 'PASS'} ${pct(sel.p)}. Tap him again to play it, or pick a button.`
      : `Pick a teammate (tap him or his name), tap empty grass to pass into space, or the goal to shoot. <b>★ Best: ${bestTxt}</b>`;
    tg.innerHTML = '<span>PASS TO:</span>';
    for (const o of info.targets) { const b = document.createElement('button'), col = o.p >= .65 ? '#7dff9a' : o.p >= .45 ? '#ffe27a' : '#ff8a7a';
      b.innerHTML = `${o.kind === 'long' ? '↗ ' : ''}${o.q.name}<i style="color:${col}">${pct(o.p)}</i>`; if (sel && sel.q === o.q) b.className = 'sel';
      b.onclick = () => { PLAN.sel = sel && sel.q === o.q ? null : o.q; PLAN.spot = null; snd('tick'); planBar(); }; tg.appendChild(b); }
    btn('PASS', info.pass ? `→ ${info.pass.q.name} ${pct(info.pass.p)}` : sel ? `${sel.q.name} is far · use LONG` : 'nobody open', () => { planClose(); pass(car, info.pass.q); car.en = Math.max(0, car.en - 2); G.stat.free++; }, '', !info.pass, 'J');
    const ls = !sel && info.longSpace;
    if (info.long || !ls) btn('LONG PASS', info.long ? `→ ${info.long.q.name} ${pct(info.long.p)}` : 'nobody far ahead · use PASS', () => { planClose(); passLong(car, info.long.q); G.stat.free++; }, 'lg', !info.long, 'L');
    else btn('LONG PASS', `into space · ${ls.who.name} ${pct(ls.p)}`, () => { PLAN.spot = null; planClose(); passSpace(car, ls.x, ls.y); G.stat.free++; }, 'lg', false, 'L');
    if (info.cross) btn('CROSS', `→ ${info.cross.q.name} ${pct(info.cross.p)} · header or volley`, () => { planClose(); audN('plan_cross'); crossTo(car, info.cross.q); G.stat.free++; }, 'lg', false, 'X');
    btn('SHOOT', info.shot !== null ? `${pct(info.shot)} · ${d} m${keeperDown(keeperOf(1)) ? ' · KEEPER DOWN' : ''}` : d >= 34 ? `${d} m · get closer` : 'no angle · move inside', () => { planClose(); shootNow(car); G.stat.free++; }, '', info.shot === null, 'K');
    for (const s of info.specs) btn(car === G.hero ? SPECIALS[s.k].name : 'SPECIAL SHOT', s.ch ? `${pct(s.ch)} · ${s.cost} spirit · ${d} m` : s.why,
      () => { planClose(); openScene('shot', { me: car, them: keeperOf(1), auto: s.k }); }, 'sp' + (s.k === 'meteor' ? ' mt' : ''), !s.ch);
    btn('ONE-TWO', info.o2 ? `with ${info.o2.q.name} ${pct(info.o2.p)} · he plays it back` : info.o2why,
      () => { planClose(); audN('plan_onetwo'); oneTwo(car, info.o2.q); G.stat.free++; }, 'o2', !info.o2, 'O');
    if (info.steer) btn('STEER IN', `run closer · stops at ~${pct(info.steer)}`, () => { planClose(); audN('plan_steer'); steerIn(car); });
    if (info.foe && dist(info.foe, car) < 8 && G.since > 1) btn('TAKE HIM ON', `run at ${info.foe.name}`, () => { planClose(); G.want = { kind: 'attack', me: car, them: info.foe, until: G.t + 4 }; });
  } else if (info.mode === 'defend') {
    $('planhint').innerHTML = `Tap a teammate to control him. ${info.car.name} has the ball.`;
    if (info.tackle !== null) btn('STOP HIM', `${c.name} · ${Math.round(info.tackle * 100)}%`, () => { planClose(); G.want = { kind: 'defend', me: c, them: info.car, until: G.t + 4 }; G.ctrlLock = G.t + 4; });
    btn('PRESS!', 'two teammates hunt the ball', () => { G.pressT = G.t + 7; planClose(); pop(c.x, c.y - 2, 'PRESS!', '#ffd23f'); });
  } else $('planhint').textContent = 'The ball is loose. Tap a teammate to control him.';
  bar.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('sel', b.dataset.t === PLAN.tactic));
  bar.classList.add('on');
}
function planTap(sx, sy) {
  const w = toWorld(sx, sy), info = PLAN.info; if (!info) return;
  const ours = G.P.filter(q => q.team === 0 && q.role !== 'GK' && q.stun <= 0).sort((a, b) => dist(a, w) - dist(b, w))[0];
  if (info.mode === 'attack') {
    const car = info.car;
    if (ours && ours !== car && dist(ours, w) < 3) {           // first tap picks him (the buttons switch to him), a second tap plays the pass
      if (PLAN.sel !== ours && info.targets.some(o => o.q === ours)) { PLAN.sel = ours; PLAN.spot = null; snd('tick'); planBar(); return; }
      PLAN.spot = null; planClose(); if (dist(ours, car) > 24) passLong(car, ours); else { pass(car, ours); car.en = Math.max(0, car.en - 2); } G.stat.free++; return; }
    if (info.shot !== null && w.y < 4 && Math.abs(w.x - GX) < 8) { planClose(); shootNow(car); G.stat.free++; return; }   // the goal itself
    if (w.x > 0 && w.x < W && w.y > 0 && w.y < H) {              // an empty spot: first tap shows the chance, second tap plays it
      if (PLAN.spot && Math.hypot(PLAN.spot.x - w.x, PLAN.spot.y - w.y) < 3) { const sp = PLAN.spot; PLAN.spot = null; planClose(); passSpace(car, sp.x, sp.y); G.stat.free++; return; }
      PLAN.spot = spaceChance(car, w.x, w.y); snd('tick'); planBar(); return;
    }
  } else if (ours && dist(ours, w) < 4) { G.ctrl = ours; G.ctrlLock = G.t + 4; snd('tick'); planBar(); }
}
$('planGo').onclick = () => planClose();
document.querySelectorAll('#planbar [data-t]').forEach(b => b.onclick = () => { PLAN.tactic = b.dataset.t; planBar(); });
$('bPlan').onclick = () => (PLAN.on ? planClose() : planOpen());

// the overlay, drawn in screen space on top of the pitch
function W2S(x, y) { const [u, v] = w2s(x - G.cam.x, y - G.cam.y); return [CW / 2 + u * S * G.cam.z, CH / 2 + v * S * G.cam.z]; }
function pill(c, x, y, text, col, big) {
  c.font = `${big ? 17 : 14}px Bangers, sans-serif`; const w = c.measureText(text).width + 12, h = big ? 22 : 19;
  const pb = $('planbar'), bot = pb.classList.contains('on') ? pb.offsetTop - h / 2 - 4 : CH - 20;   // never hidden under the PLAN panel
  x = clamp(x, w / 2 + 4, CW - w / 2 - 4); y = clamp(y, 70, Math.max(80, bot));
  c.fillStyle = 'rgba(0,0,0,.78)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 8); c.fill();
  c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1); c.textBaseline = 'alphabetic';
}
function drawPlan(c) {
  const info = PLAN.info; if (!info) return;
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = 'rgba(0,10,30,.22)'; c.fillRect(0, 0, CW, CH);
  const pulse = .6 + .4 * Math.sin(performance.now() / 180);
  if (info.mode === 'attack') {
    const [cx, cy] = W2S(info.car.x, info.car.y);
    const any = info.marks.some(m => m.sel);
    for (const m of info.marks.sort((a, b) => (a.sel - b.sel) || (a.best - b.best))) {
      const [x, y] = W2S(m.q.x, m.q.y), col = m.sel ? '#fff' : m.best ? '#ffd23f' : m.p >= .65 ? '#7dff9a' : m.p >= .45 ? '#ffe27a' : '#ff8a7a';
      c.strokeStyle = col; c.globalAlpha = m.sel || (m.best && !any) ? 1 : any ? .35 : .7; c.lineWidth = m.sel ? 5 : m.best ? 4 : 2; c.setLineDash(m.kind === 'long' ? [8, 6] : []);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (m.sel) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 18 + 3 * pulse, 0, 7); c.stroke(); }
      pill(c, x, y - 26, `${m.best ? '★ ' : ''}${m.sel || m.best ? m.q.name.toUpperCase() + ' ' : ''}${m.kind === 'long' ? 'LONG ' : ''}${Math.round(m.p * 100)}%`, col, m.best || m.sel);
    }
    if (info.shot !== null) { const [gx, gy] = W2S(GX, 0); pill(c, gx, gy + 18, `${info.best.kind === 'shoot' ? '★ ' : ''}SHOOT ${Math.round(info.shot * 100)}%`, info.best.kind === 'shoot' ? '#ffd23f' : '#fff', true); }
    c.strokeStyle = `rgba(255,210,63,${pulse})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 26, 0, 7); c.stroke();
    const cr = info.cross;
    if (cr) { const [x, y] = W2S(cr.x, cr.y); c.strokeStyle = '#8fd8ff'; c.lineWidth = 3; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo((cx + x) / 2, Math.min(cy, y) - 60, x, y); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(x, y, 12 + 3 * pulse, 0, 7); c.stroke(); pill(c, x, y + 26, `CROSS ${Math.round(cr.p * 100)}%`, '#8fd8ff'); }
    const ls = info.longSpace;
    if (ls && !PLAN.spot) { const [x, y] = W2S(ls.x, ls.y), [rx, ry] = W2S(ls.who.x, ls.who.y), col = ls.p >= .65 ? '#7dff9a' : ls.p >= .45 ? '#ffe27a' : '#ff8a7a';
      c.strokeStyle = col; c.globalAlpha = .8; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
      c.strokeStyle = 'rgba(143,216,255,.8)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(rx, ry); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      c.strokeStyle = col; c.beginPath(); c.arc(x, y, 12, 0, 7); c.stroke(); pill(c, x, y - 24, `LONG ${Math.round(ls.p * 100)}%`, col); }
    const sp = PLAN.spot;
    if (sp) { const [x, y] = W2S(sp.x, sp.y), col = sp.p >= .65 ? '#7dff9a' : sp.p >= .45 ? '#ffe27a' : '#ff8a7a';
      c.strokeStyle = col; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(x, y, 14 + 4 * pulse, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke();
      if (sp.who) { const [rx, ry] = W2S(sp.who.x, sp.who.y); c.strokeStyle = 'rgba(143,216,255,.8)'; c.lineWidth = 2; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(rx, ry); c.lineTo(x, y); c.stroke(); c.setLineDash([]); }
      pill(c, x, y - 26, `PASS HERE ${Math.round(sp.p * 100)}% · tap again`, col, true); }
  } else {
    if (info.car) { const [x, y] = W2S(info.car.x, info.car.y), [gx, gy] = W2S(GX, H); c.strokeStyle = 'rgba(255,90,90,.7)'; c.lineWidth = 3; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]); pill(c, x, y - 28, `${info.car.name.toUpperCase()} · DRI ${Math.round(info.car.st.dribble)}`, '#ff8a7a'); }
    for (const q of G.P) if (q.team === 0 && q.role !== 'GK') {
      const [x, y] = W2S(q.x, q.y), me = q === G.ctrl;
      c.strokeStyle = me ? '#ffd23f' : `rgba(255,255,255,${.4 + .4 * pulse})`; c.lineWidth = me ? 3 : 2; c.beginPath(); c.arc(x, y, 22, 0, 7); c.stroke();
      if (!me) pill(c, x, y - 30, `${q.name} · TKL ${Math.round(q.st.tackle)} · ⚡${Math.round(q.en)}`, '#cfe');
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- keyboard (CrazyGames is mostly played on computers)
const HELD = new Set();
function keySteer() {
  let x = 0, y = 0;
  if (HELD.has('ArrowLeft') || HELD.has('KeyA')) x -= 1; if (HELD.has('ArrowRight') || HELD.has('KeyD')) x += 1;
  if (HELD.has('ArrowUp') || HELD.has('KeyW')) y -= 1; if (HELD.has('ArrowDown') || HELD.has('KeyS')) y += 1;
  const d = Math.hypot(x, y); if (d) { const [wx, wy] = s2w(x / d, y / d); steer = { x: wx, y: wy, k: 1 }; } else steer = touch ? steer : null;
  if (d && G) G.touched = true;
}
addEventListener('keydown', e => {
  if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) { HELD.add(e.code); keySteer(); e.preventDefault(); return; }
  const scene = document.querySelector('#scene.on');
  if (scene && /^Digit[1-9]$/.test(e.code)) { const b = scene.querySelectorAll('#opts button')[+e.code.slice(5) - 1]; if (b && !b.disabled) b.click(); return; }
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); if (PLAN.on) planClose(); else planOpen(); return; }
  if (PLAN.on) {                                              // in PLAN: 1-7 pick a button; J/L/K/O = pass / long / shoot / one-two; Tab = next teammate
    if (e.code === 'Tab') { e.preventDefault(); const t = PLAN.info && PLAN.info.targets; if (t && t.length) { const i = t.findIndex(o => o.q === PLAN.sel); PLAN.sel = t[(i + 1) % t.length].q; snd('tick'); planBar(); } return; }
    const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : null, acts = $('planacts');
    const b = /^Digit[1-9]$/.test(e.code) ? acts.querySelector(`button[data-n="${e.code.slice(5)}"]`) : k && acts.querySelector(`button[data-k="${k}"]`);
    if (b && !b.disabled) b.click(); return;
  }
  const click = id => { const b = $(id); if (b && b.classList.contains('on')) b.click(); };
  if (e.code === 'KeyC') click('bSpec'); else if (e.code === 'KeyK') click('bShoot'); else if (e.code === 'KeyJ') click('bPass'); else if (e.code === 'KeyL') click('bLong'); else if (e.code === 'KeyH') click('bTackle');
});
addEventListener('keyup', e => { if (HELD.delete(e.code)) keySteer(); });
addEventListener('blur', () => { HELD.clear(); keySteer(); });

// test robot (?bot=1): it also uses the free-play buttons and PLAN now and then, so the soak test covers those paths too
let botT = 0;
function botFree(dt) {
  if (!BOT || !G || G.paused || G.over || CINE.on || (botT -= dt) > 0) return;
  botT = rnd(1.5, 3.5);
  const p = G.ctrl, b = G.ball, r = Math.random(), on = id => $(id).classList.contains('on');
  if (b.owner === p && p.team === 0) {
    if (r < .1) planOpen();   // botPlan picks in PLAN
    else if (r < .4 && on('bPass')) $('bPass').click();
    else if (r < .5 && on('bShoot')) $('bShoot').click();
    else if (r < .55 && on('bLong')) $('bLong').click();
    else if (r < .62 && on('bSpec')) $('bSpec').click();
  } else if (r < .4 && on('bTackle')) $('bTackle').click();
}
function botPlan() {                                          // the test robot in PLAN: buttons, picked targets, taps on teammates
  if (!BOT || !PLAN.on || !G) return;
  const r = Math.random(), ok = [...$('planacts').querySelectorAll('button')].filter(b => !b.disabled), chips = [...$('plantg').querySelectorAll('button')];
  if (r < .45 && ok.length) pick(ok).click();
  else if (r < .75 && chips.length) { pick(chips).click(); const ok2 = [...$('planacts').querySelectorAll('button')].filter(b => !b.disabled); if (ok2.length) pick(ok2).click(); }
  else { const car = G.ball.owner, q = pick(G.P.filter(x => x.team === 0 && x.role !== 'GK' && x !== car)), [sx, sy] = W2S(q.x, q.y); planTap(sx, sy); if (PLAN.on) planTap(sx, sy); }
  if (PLAN.on) planClose();
}
