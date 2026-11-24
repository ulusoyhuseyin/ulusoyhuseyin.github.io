// The match: a free-steering 5-a-side pitch (drag = run, tap = pass, flick = shoot) plus a "director" that brings a decision
// to the player at least every ~12–15 s of play (DESIGN §4). Decisions open in scene.js; this file is the sim, the director and the drawing.
'use strict';

const ROLE_HOME = { 0: { GK: [34, 101], DF1: [21, 80], DF2: [47, 80], MF: [34, 66], FW: [34, 54] }, 1: { GK: [34, 4], DF1: [21, 25], DF2: [47, 25], MF: [34, 36], FW: [30, 42] } };
const OPPS = [
  { name: 'Harbor Gulls', short: 'GUL', col: '#2f9e5b', gk: '#1b1b1b', bg: 'stadium', len: 185,
    P: [['GK', 'Pike', 1, { catch: 9 }], ['DF1', 'Bram', 3, { tackle: 7, dribble: 6, pass: 7, speed: 8, shoot: 5 }], ['DF2', 'Oren', 2, { tackle: 7.5, dribble: 6, pass: 7, speed: 8, shoot: 5 }],
      ['MF', 'Vik', 10, { shoot: 7, dribble: 8, pass: 8, tackle: 7, speed: 9 }], ['FW', 'Zane', 7, { shoot: 9, dribble: 8, pass: 7, tackle: 5, speed: 10 }]] },
  { name: 'Iron Valley', short: 'IRV', col: '#5d6773', gk: '#e9e9e9', bg: 'rain', len: 185, boss: 'Bruno',
    P: [['GK', 'Holt', 1, { catch: 10 }], ['DF1', 'Bruno', 5, { tackle: 18, dribble: 7, pass: 8, speed: 8, shoot: 7 }, 'bruno'], ['DF2', 'Gage', 4, { tackle: 10.5, dribble: 7, pass: 8, speed: 9, shoot: 6 }],
      ['MF', 'Rook', 6, { shoot: 9, dribble: 10, pass: 10, tackle: 10, speed: 10 }], ['FW', 'Dax', 9, { shoot: 11.5, dribble: 10.5, pass: 8, tackle: 6, speed: 11 }]] },
];

let G = null;
function player(team, role, name, num, st, face) {
  const [x, y] = ROLE_HOME[team][role];
  return { team, role: role.slice(0, 2), slot: role, hx: x, hy: y, x, y, vx: 0, vy: 0, st, name, num, face, stun: 0, dive: 0, diveX: 0, trail: [], ghost: 0, press: false };
}
function newMatch() {
  const m = Math.min(save.match, OPPS.length), opp = OPPS[m - 1];
  const P = [
    player(0, 'GK', 'Doi', 1, { catch: 9.5 + m * .5, pass: 9 }),
    player(0, 'DF1', 'Kemal', 4, { shoot: 7, dribble: 8, pass: 9, tackle: 11, speed: 9 }),
    player(0, 'DF2', 'Renzo', 5, { shoot: 7, dribble: 8, pass: 9, tackle: 11, speed: 9 }),
    player(0, 'MF', 'Mo', 8, { shoot: 9, dribble: 10, pass: 12 + m, tackle: 9, speed: 10 }, 'mo'),
    player(0, 'FW', save.name, 9, save.stats, 'kai'),
    ...opp.P.map(([r, n, num, st, face]) => player(1, r, n, num, { shoot: 6, dribble: 6, pass: 7, tackle: 6, speed: 8, catch: 8, ...st }, face)),
  ];
  const hero = P[4], mo = P[3];
  G = { P, hero, mo, opp, m, ball: { x: GX, y: 52.5, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, noPick: null, noPickT: 0, shot: null, trail: [] },
    score: [0, 0], t: 0, len: opp.len, paused: false, over: false, ctrl: hero, sp: 25, spMax: 100,
    cam: { x: GX, y: 48, z: 1 }, parts: [], pops: [], shake: 0, slow: 1, timers: [], bgImg: IMG[opp.bg],
    since: 0, nextForce: 9, chain: false, tut: save.match === 1 && !save.plays ? 1 : 0, fkDone: m < 2, finalDone: false,
    streak: 0, lossRun: 0, zone: 0, real0: performance.now(), goalAnim: false,
    stat: { dec: 0, won: 0, lost: 0, perfect: 0, good: 0, upset: 0, specials: 0, goals: 0, assists: 0, against: 0, chances: [], kinds: {}, gaps: [] } };
  kickoff(0);
  if (G.tut) { const bram = P.find(p => p.name === 'Bram'); bram.x = GX + 1; bram.y = 30; G.since = 2; bram.press = true; G.nextForce = 99; }
}
function kickoff(team) {
  for (const p of G.P) { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; p.stun = 0; p.dive = 0; p.press = false; }
  const b = G.ball; Object.assign(b, { x: GX, y: 52.5, z: 0, vx: 0, vy: 0, vz: 0, shot: null, noPick: null, rolls: null });
  const taker = team === 0 ? G.hero : G.P.find(p => p.team === 1 && p.role === 'FW');
  taker.x = GX; taker.y = team === 0 ? 53.6 : 51.4; own(taker);
  G.oneTwo = null; G.since = Math.min(G.since, 4);
}
function own(p) { const b = G.ball; b.owner = p; b.last = p; b.shot = null; b.vx = b.vy = b.vz = 0; b.z = 0; b.rolls = null; for (const q of G.P) q.press = false; }
const mates = p => G.P.filter(q => q.team === p.team && q !== p);
const foes = p => G.P.filter(q => q.team !== p.team);
const keeperOf = team => G.P.find(q => q.team === team && q.role === 'GK');
const goalY = team => team === 0 ? 0 : H;                 // the goal a team attacks
const later = (sec, fn) => G.timers.push({ t: G.t + sec, fn });
const specCost = () => save.style === 'striker' ? 50 : 60;
function addSp(v) { G.sp = clamp(G.sp + v, 0, G.spMax); }

// ---------------------------------------------------------------- input: drag = run, tap = pass, flick = shoot
let touch = null, steer = null;
const toWorld = (sx, sy) => ({ x: (sx - CW / 2) / (S * G.cam.z) + G.cam.x, y: (sy - CH / 2) / (S * G.cam.z) + G.cam.y });
cv.addEventListener('pointerdown', e => { if (!G || G.paused) return; touch = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), hist: [] }; G.touched = true; });
cv.addEventListener('pointermove', e => {
  if (!touch) return; touch.x = e.clientX; touch.y = e.clientY; touch.hist.push([performance.now(), e.clientX, e.clientY]);
  const dx = touch.x - touch.x0, dy = touch.y - touch.y0, d = Math.hypot(dx, dy);
  if (d > 14) steer = { x: dx / d, y: dy / d, k: Math.min(1, d / 60) };
});
const endTouch = e => {
  if (!touch || !G) { touch = null; steer = null; return; }
  const now = performance.now(), dx = e.clientX - touch.x0, dy = e.clientY - touch.y0, d = Math.hypot(dx, dy), dur = now - touch.t0;
  const recent = touch.hist.filter(h => now - h[0] < 120); const r0 = recent[0] || [touch.t0, touch.x0, touch.y0];
  const vx = (e.clientX - r0[1]) / Math.max(16, now - r0[0]), vy = (e.clientY - r0[2]) / Math.max(16, now - r0[0]);
  if (!G.paused && !G.tut) {
    if (d < 12 && dur < 300) tapPass(e.clientX, e.clientY);
    else if (Math.hypot(vx, vy) > .9 && vy < -.4) flick(vx, vy);
  }
  touch = null; steer = null;
};
cv.addEventListener('pointerup', endTouch); cv.addEventListener('pointercancel', () => { touch = null; steer = null; });
function tapPass(sx, sy) {
  const w = toWorld(sx, sy), b = G.ball;
  if (b.owner && b.owner.team === 0) {
    const t = mates(b.owner).filter(q => q.role !== 'GK').sort((a, c) => dist(a, w) - dist(c, w))[0];
    if (t && dist(t, w) < 7) pass(b.owner, t);
  }
}
function flick(vx, vy) {                                     // a quick free shot: rolled honestly, no clash
  const b = G.ball, p = b.owner;
  if (!p || p.team !== 0) return;
  const k = p.y / -vy, aimX = p.x + vx * k, gk = keeperOf(1);
  const ch = shotChance(p, gk, false), onT = Math.abs(aimX - GX) < GOALW / 2 + .4;
  shoot(p, clamp(aimX, GX - 3.2, GX + 3.2), false, !onT ? 'miss' : Math.random() < ch ? 'goal' : Math.random() < .5 ? 'parry' : 'catch');
}

// ---------------------------------------------------------------- actions
function pass(p, t, safe) {
  const b = G.ball, tx = t.x + t.vx * .3, ty = t.y + t.vy * .3, d = Math.hypot(tx - p.x, ty - p.y) || 1, sp = clamp(10 + d * .55, 12, 24);
  b.owner = null; b.vx = (tx - p.x) / d * sp; b.vy = (ty - p.y) / d * sp; b.noPick = p; b.noPickT = .35; b.passTo = t; b.last = p;
  b.rolls = new Map(foes(p).map(q => [q, safe ? false : Math.random() < clamp(.2 + ((q.st.tackle || 8) - (p.st.pass || 9)) * .04, .05, .6)]));
  if (p.team === 0) G.lastPasser = p;
  snd('kick');
}
function passPoint(p, tx, ty) {                              // a through ball into space (one-two return)
  const b = G.ball, d = Math.hypot(tx - p.x, ty - p.y) || 1, sp = clamp(11 + d * .6, 13, 24);
  b.owner = null; b.vx = (tx - p.x) / d * sp; b.vy = (ty - p.y) / d * sp; b.noPick = p; b.noPickT = .4; b.last = p;
  b.rolls = new Map(foes(p).map(q => [q, false])); snd('kick');
}
function distToGoal(p) { return Math.hypot(p.x - GX, p.y - goalY(p.team)); }
function shoot(p, aimX, special, out) {                      // out is decided before the kick (by the clash); the flight reveals it
  const b = G.ball, gk = keeperOf(1 - p.team), gy = goalY(p.team);
  if (out === 'miss') aimX = GX + (aimX >= GX ? 1 : -1) * rnd(4.4, 6);
  const d = Math.hypot(aimX - p.x, gy - p.y) || 1, sp = special ? 36 : 26;
  b.owner = null; b.last = p; b.vx = (aimX - p.x) / d * sp; b.vy = (gy - p.y) / d * sp; b.vz = special ? 1.6 : 3; b.z = .2;
  b.shot = { by: p, out, special, aimX, gk, gy }; b.noPick = p; b.noPickT = 99; b.rolls = null;
  gk.diveX = out === 'goal' ? aimX + (aimX > GX ? -2.2 : 2.2) : aimX;   // a beaten keeper dives the wrong way or too late
  G.flame = !!special;
  snd(special ? 'boom' : 'kick'); buzz(special ? 60 : 20);
}

// ---------------------------------------------------------------- simulation
function speedOf(p) { return (5.2 + (p.st.speed || 8) * .17) * (G.ball.owner === p ? .86 : 1); }
function moveTo(p, tx, ty, k = 1) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), v = speedOf(p) * k;
  if (d < .3) { p.vx *= .8; p.vy *= .8; return; }
  const s = Math.min(v, d * 3); p.vx = lerp(p.vx, dx / d * s, .15); p.vy = lerp(p.vy, dy / d * s, .15);
}
function shiftHome(p) {
  const b = G.ball, side = p.team === 0 ? 1 : -1, att = b.owner ? (b.owner.team === p.team) : false;
  let y = p.hy + (b.y - 52.5) * .55 + (att ? -side * 6 : side * 2), x = p.hx + (b.x - GX) * .35;
  if (p.role === 'GK') { x = clamp(b.x, GX - 3, GX + 3); y = p.hy; }
  return [clamp(x, 3, W - 3), clamp(y, 2, H - 2)];
}
function step(dt) {
  if (G.over) return;
  const b = G.ball; dt *= G.slow;
  G.t += dt; G.since += dt; addSp(dt * (G.zone > 0 ? .6 : .25));
  if (G.zone > 0 && (G.zone -= dt) <= 0) { G.zone = 0; $('zone').classList.remove('on'); }
  for (const tm of G.timers.filter(x => x.t <= G.t)) { G.timers.splice(G.timers.indexOf(tm), 1); tm.fn(); }
  if (G.t >= G.len && !b.shot && !G.goalAnim && !G.paused) return finish();
  if (b.owner && b.owner.team === 0) G.ctrl = b.owner;
  else if (!G.oneTwo) { const near = G.P.filter(q => q.team === 0 && q.role !== 'GK').sort((a, c) => dist(a, b) - dist(c, b))[0]; if (dist(near, b) < dist(G.ctrl, b) - 3 || G.ctrl.role === 'GK') G.ctrl = near; }
  for (const p of G.P) {
    p.trail.push([p.x, p.y]); if (p.trail.length > 8) p.trail.shift(); p.ghost = Math.max(0, p.ghost - dt);
    if (p.stun > 0) { p.stun -= dt; p.vx *= .9; p.vy *= .9; continue; }
    if (G.oneTwo && p === G.hero && b.owner !== p) { moveTo(p, G.oneTwo.tx, G.oneTwo.ty, 1.15); continue; }
    if (p === G.ctrl) ctrlMove(p);
    else if (p.team === 1 && b.owner === p) oppCarrier(p, dt);
    else if (p.role === 'GK') keeper(p);
    else if (p.press && b.owner && b.owner.team !== p.team) moveTo(p, b.owner.x, b.owner.y - (p.team === 1 ? 1 : -1), 1.25);
    else if (G.tut && p.team === 1) { const [x, y] = shiftHome(p); moveTo(p, x, y, .5); }
    else {
      const chaser = !b.owner || b.owner.team !== p.team;
      const myNear = G.P.filter(q => q.team === p.team && q.role !== 'GK' && q !== G.ctrl).sort((a, c) => dist(a, b) - dist(c, b))[0];
      if (chaser && p === myNear && (p.team === 1 || !b.owner)) moveTo(p, b.x, b.y, p.team === 1 ? .92 : .8);
      else { const [x, y] = shiftHome(p); moveTo(p, x, y, .7); }
    }
  }
  for (const p of G.P) { p.x = clamp(p.x + p.vx * dt, 1, W - 1); p.y = clamp(p.y + p.vy * dt, -1, H + 1); }
  ballStep(dt);
  if (b.owner && b.owner.team === 1 && !G.tut) for (const q of G.P) {
    if (q.team === 0 && q.role !== 'GK' && q.stun <= 0 && dist(q, b.owner) < 1.4 && Math.random() < dt * (q === G.ctrl ? .08 : .2)) {
      const lost = b.owner; own(q); lost.stun = .8; pop(q.x, q.y - 2, 'NICKED IT!', '#ffd23f'); break; }
  }
  if (!G.paused && !G.goalAnim) director();
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .92; q.vy *= .92; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter(q => q.t < 1.3);
  G.shake = Math.max(0, G.shake - dt);
}
function ctrlMove(p) {
  const b = G.ball;
  if (steer) { const v = speedOf(p) * (.55 + .5 * steer.k); p.vx = lerp(p.vx, steer.x * v, .25); p.vy = lerp(p.vy, steer.y * v, .25); return; }
  if (b.owner === p) {                                       // the carrier runs at goal by itself, weaving away from the nearest defender
    const th = foes(p).filter(q => q.role !== 'GK' && q.y < p.y).sort((a, c) => dist(a, p) - dist(c, p))[0];
    const side = th && dist(th, p) < 8 ? (th.x < p.x ? 1 : -1) * 3 : 0;
    moveTo(p, clamp(lerp(p.x, GX, .3) + side, 6, W - 6), p.y - 10, .85);
  } else if (!b.owner || b.owner.team === 1) moveTo(p, b.x + (b.owner ? 0 : b.vx * .3), b.y + (b.owner ? 1.2 : b.vy * .3), G.since > G.nextForce ? 1.15 : .95);
  else { const [x, y] = shiftHome(p); moveTo(p, x, y, .7); }
}
function oppCarrier(p, dt) {
  const threat = G.P.filter(q => q.team === 0 && q.stun <= 0 && q.role !== 'GK').sort((a, c) => dist(a, p) - dist(c, p))[0];
  G.aiT = (G.aiT || 0) - dt;
  if (threat && dist(threat, p) < 5 && G.aiT <= 0) {
    G.aiT = 1.2;
    const outlet = mates(p).filter(q => q.role !== 'GK' && q.y > p.y - 2 && q.stun <= 0).sort((a, c) => c.y - a.y)[0];
    if (outlet && Math.random() < .35) return pass(p, outlet);
  }
  const side = threat && dist(threat, p) < 7 ? (threat.x < p.x ? 1 : -1) * 4 : 0;
  moveTo(p, clamp(lerp(p.x, GX, .25) + side, 4, W - 4), p.y + 10, .82);
}
function keeper(p) {
  const b = G.ball, home = p.team === 0 ? H - 1.6 : 1.6;
  if (b.shot && b.shot.gk === p) { p.dive = Math.min(1, p.dive + .06); moveTo(p, b.shot.gk.diveX, home, 1.6); return; }
  p.dive = Math.max(0, p.dive - .05);
  if (!b.owner && Math.abs(b.y - home) < 12 && Math.abs(b.x - GX) < 10 && !b.shot) return moveTo(p, b.x, b.y, 1);
  moveTo(p, clamp(GX + (b.x - GX) * .18, GX - 3, GX + 3), home + (p.team === 0 ? -1 : 1) * Math.min(4, Math.abs(b.y - home) * .05), 1);
}
function ballStep(dt) {
  const b = G.ball;
  if (b.owner) {
    const p = b.owner, sp = Math.hypot(p.vx, p.vy) || 1, f = .75 + .25 * Math.sin(G.t * 14);
    b.x = p.x + p.vx / sp * f; b.y = p.y + p.vy / sp * f; b.z = 0; b.trail.length = 0; return;
  }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.max(0, b.z + b.vz * dt); b.vz -= 9.8 * dt;
  b.trail.push([b.x, b.y, b.z]); if (b.trail.length > (G.flame ? 22 : 8)) b.trail.shift();
  if (b.shot) {
    const s = b.shot;
    if (s.special) burst(b.x, b.y, 2, Math.random() < .5 ? '#ffb000' : '#ff4a00', 2, .45, .5);
    if (Math.abs(b.y - s.gy) < 10 && G.slow > .4) G.slow = s.special ? .3 : .45;
    if (Math.abs(b.y - s.gy) < 1.8) shotEnd(s);
    return;
  }
  const sp = Math.hypot(b.vx, b.vy); if (sp > 0) { const f = Math.exp(-1.1 * dt); b.vx *= f; b.vy *= f; if (sp < .4) b.vx = b.vy = 0; }
  if ((b.noPickT -= dt) <= 0) b.noPick = null;
  if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) return outOfPlay();
  for (const p of G.P) {                                       // pick-ups and interceptions
    if (p === b.noPick || p.stun > 0) continue;
    if (dist(p, b) < 1.2) {
      if (b.rolls && b.rolls.has(p) && sp > 5 && !b.rolls.get(p)) continue;          // this defender misjudged the pass
      if (b.rolls && b.rolls.has(p)) pop(p.x, p.y - 2, 'INTERCEPTED', '#ff6b6b');
      own(p);
      if (G.oneTwo && p === G.mo) { const o = G.oneTwo; later(.2, () => { if (G.ball.owner === G.mo) { passPoint(G.mo, o.tx, o.ty); } }); }
      if (p === G.hero && G.oneTwo) { G.oneTwo = null; G.chain = true; G.since = Math.max(G.since, 2.7); }
      if (p.team === 0 && G.lastPasser && G.lastPasser !== p) G.assistFrom = G.lastPasser;
      return;
    }
  }
}
async function shotEnd(s) {
  const b = G.ball; b.shot = null; G.flame = false;
  if (s.out === 'goal') {
    G.goalAnim = true; G.afterShot = null;
    b.vx *= .25; b.vy = (s.gy === 0 ? -1 : 1) * 3; b.vz = 0; G.slow = .25; G.shake = .6; burst(b.x, s.gy, 40, '#fff', 10, .9);
    G.score[s.by.team]++;
    if (s.by.team === 0) { if (s.by === G.hero) G.stat.goals++; else G.stat.assists += s.assist ? 1 : 0; G.stat.teamGoals = (G.stat.teamGoals || 0) + 1; snd('win'); buzz([40, 40, 80]); banner(s.special ? 'GOAL!!!' : 'GOAL!'); }
    else { G.stat.against++; snd('lose'); banner(`${G.opp.short} SCORE`, 'small'); }
    if (s.by.team === 0 && s.special && !save.firstSpecialGoal) { save.firstSpecialGoal = true; track('first_special', { m: G.m, sec: Math.round(G.t) }); }
    await wait(1900 / FAST);
    if (!G) return;
    G.slow = 1; G.goalAnim = false;
    if (G.afterGoal) { const f = G.afterGoal; G.afterGoal = null; f(); }
    if (G.t < G.len) kickoff(1 - s.by.team);
    return;
  }
  G.slow = 1; G.afterGoal = null;
  if (s.out === 'parry') { b.vx = (b.x > GX ? 1 : -1) * rnd(5, 9); b.vy = (s.gy === 0 ? 1 : -1) * rnd(6, 10); b.vz = 2; b.noPick = s.gk; b.noPickT = .5; pop(s.gk.x, s.gk.y + (s.gy ? -2 : 2), 'PARRIED!', '#fff'); s.gk.stun = .6; burst(b.x, b.y, 16, '#fff', 6); }
  else if (s.out === 'catch') { own(s.gk); pop(s.gk.x, s.gk.y + (s.gy ? -2 : 2), 'SAVED!', '#fff'); later(.9, () => { if (G.ball.owner === s.gk) pass(s.gk, mates(s.gk).filter(q => q.role === 'DF')[Math.random() < .5 ? 0 : 1], true); }); }
  else { pop(b.x, s.gy + (s.gy ? -2 : 2), 'WIDE!', '#ddd'); b.vx = b.vy = 0; b.x = GX; b.y = s.gy === 0 ? 5 : H - 5; own(s.gk); s.gk.x = b.x; s.gk.y = b.y; later(.9, () => { if (G.ball.owner === s.gk) pass(s.gk, mates(s.gk).find(q => q.role === 'MF'), true); }); }
  if (G.afterShot) { const f = G.afterShot; G.afterShot = null; f(s.out); }
}
function outOfPlay() {
  const b = G.ball, team = b.last ? 1 - b.last.team : 0;
  b.x = clamp(b.x, 1, W - 1); b.y = clamp(b.y, 6, H - 6);
  const p = G.P.filter(q => q.team === team && q.role !== 'GK').sort((a, c) => dist(a, b) - dist(c, b))[0];
  p.x = b.x; p.y = b.y; own(p);
}
function pop(x, y, text, col) { G.pops.push({ x, y, text, col: col || '#fff', t: 0 }); }
function burst(x, y, n, col, sp = 6, life = .6, size = .35) {
  for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 2), v = rnd(sp * .3, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, col, size }); }
}
function banner(text, cls) { const el = $('banner'); el.innerHTML = `<span class="bang go ${cls || ''}">${text}</span>`; }

// ---------------------------------------------------------------- the director: natural decision moments, and forcing one if play drifts
function director() {
  const b = G.ball, c = G.ctrl, gap = G.since;
  if (b.shot) return;
  if (!G.finalDone && G.t > G.len - 13 && gap > 1.5) return finalScene();
  if (gap < (G.chain ? .7 : 4)) return;
  const calm = gap >= 11;
  if (b.owner === c && c.team === 0) {
    if (!G.fkDone && G.t > G.len * .42 && c.y < 52 && c.y > 30) return freeKick();
    const near = foes(c).filter(q => q.role !== 'GK' && q.stun <= 0 && q.y < c.y + 1.5).sort((a, d) => dist(a, c) - dist(d, c));
    if (distToGoal(c) < 20 && (G.chain || gap >= 7)) return openScene('shot', { me: c, them: keeperOf(1) });
    if (calm && near[1] && dist(near[0], c) < 2.8 && dist(near[1], c) < 6) return openScene('squeeze', { me: c, them: near[0], them2: near[1] });
    if ((calm || G.chain || G.tut) && near[0] && dist(near[0], c) < 2.6) return openScene('attack', { me: c, them: near[0] });
  }
  if (b.owner && b.owner.team === 1) {
    const car = b.owner;
    if (distToGoal(car) < 22) return openScene('save', { me: keeperOf(0), them: car });
    if (calm && c.stun <= 0 && dist(c, car) < 2.4) return openScene('defend', { me: c, them: car });
  }
  if (gap > G.nextForce) {                                   // play drifted: bring the decision to the player
    if (b.owner && b.owner.team === 0) {
      const q = foes(b.owner).filter(q => q.role !== 'GK' && q.stun <= 0).sort((a, d) => dist(a, b.owner) - dist(d, b.owner))[0];
      if (q) q.press = true;
      if (gap > G.nextForce + 3 && q) { q.x = b.owner.x + rnd(-1, 1); q.y = b.owner.y - 2.2; }
    } else if (b.owner && b.owner.team === 1) {
      if (gap > G.nextForce + 3.5) { c.x = b.owner.x + rnd(-1, 1); c.y = b.owner.y + 2; }
    } else if (gap > G.nextForce + 3) { own(G.P.filter(q => q.team === 0 && q.role !== 'GK').sort((a, d) => dist(a, b) - dist(d, b))[0]); }
  }
}
function freeKick() {
  G.fkDone = true; const c = G.ctrl;
  const fouler = foes(c).filter(q => q.role !== 'GK').sort((a, d) => dist(a, c) - dist(d, c))[0];
  pop(c.x, c.y - 2, 'FOUL!', '#ff6b6b'); snd('whistle');
  const x = GX + rnd(-7, 7), y = rnd(22, 25);
  G.hero.x = x; G.hero.y = y + 1; own(G.hero); G.ctrl = G.hero;
  const wall = foes(G.hero).filter(q => q.role === 'DF'); wall.forEach((q, i) => { q.x = lerp(x, GX, .2) + (i - .5) * 1.4; q.y = y - 7; q.vx = q.vy = 0; });
  addSp(30);
  openScene('freekick', { me: G.hero, them: keeperOf(1), fouler });
}
function finalScene() {
  G.finalDone = true;
  const diff = G.score[0] - G.score[1];
  if (diff <= 0) {                                            // LAST CHANCE: the hero at the edge of the box, Spirit topped up for a special
    for (const q of foes(G.hero)) if (q.role !== 'GK') { q.y = Math.min(q.y, 30) + 6; q.stun = .5; }
    G.hero.x = GX + rnd(-6, 6); G.hero.y = 19; own(G.hero); G.ctrl = G.hero; G.sp = Math.max(G.sp, specCost());
    banner('LAST CHANCE!', 'small');
    G.paused = true; setTimeout(() => { if (G && !G.over) { G.paused = false; openScene('shot', { me: G.hero, them: keeperOf(1), final: true }); } }, 900 / FAST);
  } else {                                                    // HOLD THE LEAD: their striker breaks through
    const fw = G.P.find(p => p.team === 1 && p.role === 'FW');
    fw.x = GX + rnd(-6, 6); fw.y = H - 21; own(fw);
    for (const q of G.P) if (q.team === 0 && q.role !== 'GK') q.y = Math.min(H - 12, Math.max(q.y, H - 34));
    banner('HOLD THE LEAD!', 'small');
    G.paused = true; setTimeout(() => { if (G && !G.over) { G.paused = false; openScene('save', { me: keeperOf(0), them: fw, final: true }); } }, 900 / FAST);
  }
}

// ---------------------------------------------------------------- drawing
function draw() {
  const c = ctx, b = G.ball;
  const look = b.owner ? (b.owner.team === 0 ? -7 : 6) : 0, vw = CW / (S * G.cam.z), vh = CH / (S * G.cam.z);
  const sf = G.paused && G.focus, fxp = sf ? G.focus.x : b.x, fyp = sf ? G.focus.y + vh * .2 : b.y + look;
  const tx = vw >= W ? GX : clamp(fxp, vw / 2 - 3, W - vw / 2 + 3), ty = clamp(fyp, vh / 2 - 8, H - vh / 2 + 8);
  G.cam.x = lerp(G.cam.x, tx, sf ? .15 : .08); G.cam.y = lerp(G.cam.y, ty, sf ? .15 : .08);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = G.shake > 0 ? G.shake * 18 : 0; c.translate(rnd(-sh, sh), rnd(-sh, sh));
  c.fillStyle = '#1d5e2c'; c.fillRect(-20, -20, CW + 40, CH + 40);
  c.save(); c.translate(CW / 2, CH / 2); c.scale(S * G.cam.z, S * G.cam.z); c.translate(-G.cam.x, -G.cam.y);
  for (let i = -2; i < 23; i++) { c.fillStyle = i % 2 ? '#2a7a3b' : '#2f8541'; c.fillRect(-12, i * 5, W + 24, 5); }
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = .15;
  c.strokeRect(0, 0, W, H); c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
  c.beginPath(); c.arc(GX, H / 2, 9.15, 0, 7); c.stroke();
  for (const gy of [0, H]) {
    const d = gy ? -1 : 1;
    c.strokeRect(GX - 20.16, gy === 0 ? 0 : H - 16.5, 40.32, 16.5); c.strokeRect(GX - 9.16, gy === 0 ? 0 : H - 5.5, 18.32, 5.5);
    c.beginPath(); c.arc(GX, gy + d * 11, .25, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(GX - GOALW / 2, gy === 0 ? -2.2 : H, GOALW, 2.2);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = .05;
    for (let x = 0; x <= GOALW; x += .6) { c.beginPath(); c.moveTo(GX - GOALW / 2 + x, gy); c.lineTo(GX - GOALW / 2 + x, gy - d * 2.2); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = .3; c.beginPath(); c.moveTo(GX - GOALW / 2, gy); c.lineTo(GX - GOALW / 2, gy - d * 2.2); c.lineTo(GX + GOALW / 2, gy - d * 2.2); c.lineTo(GX + GOALW / 2, gy); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = .15;
  }
  // one-two target marker
  if (G.oneTwo) { c.strokeStyle = 'rgba(255,210,63,.7)'; c.lineWidth = .2; c.setLineDash([.6, .5]); c.beginPath(); c.arc(G.oneTwo.tx, G.oneTwo.ty, 1.4, 0, 7); c.stroke(); c.setLineDash([]); }
  // players: round face tokens, sorted by y
  const ps = [...G.P].sort((a, d) => a.y - d.y);
  for (const p of ps) {
    const kit = p.team === 0 ? (p.role === 'GK' ? '#ffd23f' : '#e23b3b') : (p.role === 'GK' ? G.opp.gk : G.opp.col);
    const r = p === G.hero ? 1.5 : p.face ? 1.32 : 1.1;
    if (p.ghost > 0) for (let i = 0; i < p.trail.length; i += 2) { c.globalAlpha = .14 * i / p.trail.length + p.ghost * .15; c.fillStyle = kit; c.beginPath(); c.arc(p.trail[i][0], p.trail[i][1], r * .9, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    if (p === G.ctrl) { c.strokeStyle = '#ffd23f'; c.lineWidth = .24; c.beginPath(); c.arc(p.x, p.y + .2, r + .45 + .15 * Math.sin(G.t * 8), 0, 7); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + .3, p.y + r * .7, r * .9, r * .45, 0, 0, 7); c.fill();
    const bob = Math.hypot(p.vx, p.vy) > 1 ? Math.abs(Math.sin(G.t * 12 + p.num)) * .22 : 0;
    const dx = p.dive * (p.diveX - p.x > 0 ? 1 : -1) * .6;
    const tk = token(p.face, kit, String(p.num), kit === '#e9e9e9' || kit === '#ffd23f' ? '#555' : kit);
    c.save(); c.translate(p.x + dx, p.y - bob); if (p.dive > .2) c.rotate((p.diveX - p.x > 0 ? 1 : -1) * p.dive * .9);
    c.drawImage(tk, -r, -r, r * 2, r * 2); c.restore();
    if (p.face || p === G.ctrl) {
      c.font = `${p === G.hero ? 1.15 : .95}px Bangers, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.team === 0 ? '#fff' : '#dfe8ff'; c.strokeStyle = '#000'; c.lineWidth = .25;
      const nm = p.name.toUpperCase(); c.strokeText(nm, p.x, p.y - r - .5); c.fillText(nm, p.x, p.y - r - .5);
    }
    if (p.stun > 0) for (let i = 0; i < 3; i++) { const a = G.t * 6 + i * 2.1; c.fillStyle = '#ffd23f'; c.font = '.9px sans-serif'; c.fillText('★', p.x + Math.cos(a) * 1.2, p.y - r - .2 + Math.sin(a) * .4); }
  }
  // ball + trail
  for (let i = 0; i < b.trail.length; i++) {
    const [x, y, z] = b.trail[i], k = i / b.trail.length;
    c.globalAlpha = k * (G.flame ? .8 : .35); c.fillStyle = G.flame ? (i % 2 ? '#ffb000' : '#ff4a00') : '#fff';
    c.beginPath(); c.arc(x, y - z * .5, (G.flame ? .7 : .3) * (0.4 + k), 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(b.x + .15 + b.z * .3, b.y + .3, .45, .28, 0, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = .1; c.beginPath(); c.arc(b.x, b.y - b.z * .5, .42 * (1 + b.z * .06), 0, 7); c.fill(); c.stroke();
  for (const q of G.parts) { c.globalAlpha = q.life / q.max; c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.size * (q.life / q.max + .3), 0, 7); c.fill(); }
  c.globalAlpha = 1;
  for (const q of G.pops) {
    c.globalAlpha = 1 - Math.max(0, q.t - .9) / .4; c.font = `${1.6 + Math.min(.4, q.t) * 1.2}px Bangers, sans-serif`; c.textAlign = 'center';
    c.strokeStyle = '#000'; c.lineWidth = .3; c.strokeText(q.text, q.x, q.y - q.t * 1.5); c.fillStyle = q.col; c.fillText(q.text, q.x, q.y - q.t * 1.5);
  }
  c.globalAlpha = 1; c.restore();
  // off-screen arrow to the goal we attack, so the player always knows the direction
  if (G.cam.y - vh / 2 > 4) { c.fillStyle = 'rgba(255,255,255,.35)'; const ax = CW / 2 + (GX - G.cam.x) * S; c.beginPath(); c.moveTo(ax, 64); c.lineTo(ax - 10, 80); c.lineTo(ax + 10, 80); c.fill(); }
  if (touch && steer) {
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(touch.x0, touch.y0, 44, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(touch.x0 + steer.x * 44 * steer.k, touch.y0 + steer.y * 44 * steer.k, 18, 0, 7); c.fill();
  }
  hud();
}
function hud() {
  $('sc').textContent = `${save.name} ${G.score[0]} - ${G.score[1]} ${G.opp.short}`;
  $('clock').textContent = `${Math.min(90, Math.floor(G.t / G.len * 90))}'`;
  const bar = $('sp').firstElementChild, cost = specCost(), ready = G.sp >= cost;
  bar.style.width = (G.sp / G.spMax * 100) + '%'; bar.classList.toggle('ready', ready);
  const wins = Math.ceil((cost - G.sp) / spGain());
  $('spt').textContent = ready ? 'SPECIAL READY!' : wins <= 1 ? '1 more win → SPECIAL' : `${wins} wins → SPECIAL`;
}
const spGain = () => 9 * (1 + (save.stats.spirit - 10) * .04);

let last = 0;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0) * FAST; last = now;
  if (G) { if (!G.paused) step(dt); draw(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
