// PLAN: stop the clock any time and decide (owner, 24 Nov: "add the ability to pause and decide what to do").
// The camera pulls back; with the ball every teammate shows a pass line with its real success chance (the same AI evaluation
// the opponents use) and the AI's best idea gets a star. Tap a teammate to pass, tap the goal to shoot, or pick a move.
// Without the ball: tap a teammate to control him, STOP HIM (tackle decision) or PRESS. Team tactics: DEFEND / BALANCED / ATTACK.
// Keyboard (desktop): Space = PLAN, WASD/arrows = run, J = pass, L = long ball, K = shoot, H = tackle, 1-4 = pick an option.
'use strict';

const PLAN = { on: false, tactic: 'bal', info: null };
function planOpen() {
  if (!G || G.paused || G.over || G.goalAnim || CINE.on || G.ball.shot || G.tut) return;
  PLAN.on = true; G.paused = true; G.plan = true; steer = null; touch = null; snd('tick');
  G.stat.plans = (G.stat.plans || 0) + 1;
  planBar();
}
function planClose() { PLAN.on = false; PLAN.spot = null; if (G) { G.plan = false; G.paused = false; } $('planbar').classList.remove('on'); }
function planInfo() {
  const b = G.ball, c = G.ctrl, car = b.owner, info = { mode: car && car.team === 0 ? 'attack' : car ? 'defend' : 'loose', marks: [] };
  if (info.mode === 'attack') {
    const opts = AI.options(car); let best = null;
    for (const o of opts) if (!best || o.v > best.v) best = o;
    const passes = opts.filter(o => o.kind === 'pass' || o.kind === 'long').sort((a, b) => b.v - a.v).slice(0, 5);
    for (const o of passes) info.marks.push({ q: o.q, p: o.p, kind: o.kind, best: o === best });
    info.best = best; info.car = car;
    info.shot = angleOk(car) && distToGoal(car) < 34 ? clamp(shotChance(car, keeperOf(1), false) - tiredPen(car), .03, .8) : null;
    info.foe = foes(car).filter(f => f.role !== 'GK' && f.stun <= 0).sort((a, d) => dist(a, car) - dist(d, car))[0];
  } else if (info.mode === 'defend') {
    info.car = car;
    info.tackle = c.role !== 'GK' && dist(c, car) < 6 ? clamp(chance(c.st.tackle, car.st.dribble) - tiredPen(c) + tiredPen(car), .05, .9) : null;
  }
  return info;
}
function planBar() {
  const info = PLAN.info = planInfo(), bar = $('planbar'), acts = $('planacts'), c = G.ctrl;
  const btn = (label, sub, fn, cls) => { const b = document.createElement('button'); b.innerHTML = `${label}<small>${sub}</small>`; if (cls) b.className = cls; b.onclick = fn; acts.appendChild(b); };
  acts.innerHTML = '';
  if (info.mode === 'attack') {
    const car = info.car, bestTxt = info.best.kind === 'pass' || info.best.kind === 'long' ? `pass to ${info.best.q.name}` : info.best.kind === 'shoot' ? 'shoot' : info.best.kind === 'dribble' ? 'keep running' : 'hold it';
    $('planhint').innerHTML = PLAN.spot ? `Pass into space: <b>${Math.round(PLAN.spot.p * 100)}%</b> · ${PLAN.spot.who ? PLAN.spot.who.name + ' runs for it' : ''}. Tap the spot again to play it.`
      : `Tap a teammate to pass, an empty spot to pass into space, or the goal to shoot. <b>★ Best: ${bestTxt}</b>`;
    if (info.shot !== null) btn('SHOOT', `${Math.round(info.shot * 100)}%`, () => { planClose(); shootNow(car); G.stat.free++; });
    if (info.foe && dist(info.foe, car) < 8 && G.since > 1) btn('TAKE HIM ON', `vs ${info.foe.name}`, () => { planClose(); info.foe.x = car.x + rnd(-1, 1); info.foe.y = car.y - 2.2; openScene('attack', { me: car, them: info.foe }); });
    if (car === G.hero && G.sp >= specCost() && angleOk(car) && distToGoal(car) < 30) btn('COMET DRIVE!', `${specCost()} spirit`, () => { planClose(); openScene('shot', { me: car, them: keeperOf(1) }); }, 'sp');
  } else if (info.mode === 'defend') {
    $('planhint').innerHTML = `Tap a teammate to control him. ${info.car.name} has the ball.`;
    if (info.tackle !== null) btn('STOP HIM', `${c.name} · ${Math.round(info.tackle * 100)}%`, () => { planClose(); c.x = info.car.x + rnd(-1, 1); c.y = info.car.y + 2; openScene('defend', { me: c, them: info.car }); });
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
    if (info.shot !== null && w.y < 7 && Math.abs(w.x - GX) < 9) { planClose(); shootNow(car); G.stat.free++; return; }
    if (ours && ours !== car && dist(ours, w) < 3) { PLAN.spot = null; planClose(); if (dist(ours, car) > 24) passLong(car, ours); else { pass(car, ours); car.en = Math.max(0, car.en - 2); } return; }
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
  x = clamp(x, w / 2 + 4, CW - w / 2 - 4); y = clamp(y, 70, CH - 20);
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
    for (const m of info.marks.sort((a, b) => a.best - b.best)) {
      const [x, y] = W2S(m.q.x, m.q.y), col = m.best ? '#ffd23f' : m.p >= .65 ? '#7dff9a' : m.p >= .45 ? '#ffe27a' : '#ff8a7a';
      c.strokeStyle = col; c.globalAlpha = m.best ? 1 : .7; c.lineWidth = m.best ? 4 : 2; c.setLineDash(m.kind === 'long' ? [8, 6] : []);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      pill(c, x, y - 26, `${m.best ? '★ ' : ''}${m.kind === 'long' ? 'LONG ' : ''}${Math.round(m.p * 100)}%`, col, m.best);
    }
    if (info.shot !== null) { const [gx, gy] = W2S(GX, 0); pill(c, gx, gy + 18, `${info.best.kind === 'shoot' ? '★ ' : ''}SHOOT ${Math.round(info.shot * 100)}%`, info.best.kind === 'shoot' ? '#ffd23f' : '#fff', true); }
    c.strokeStyle = `rgba(255,210,63,${pulse})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 26, 0, 7); c.stroke();
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
  const click = id => { const b = $(id); if (b && b.classList.contains('on')) b.click(); };
  if (e.code === 'KeyK') click('bShoot'); else if (e.code === 'KeyJ') click('bPass'); else if (e.code === 'KeyL') click('bLong'); else if (e.code === 'KeyH') click('bTackle');
});
addEventListener('keyup', e => { if (HELD.delete(e.code)) keySteer(); });
addEventListener('blur', () => { HELD.clear(); keySteer(); });
