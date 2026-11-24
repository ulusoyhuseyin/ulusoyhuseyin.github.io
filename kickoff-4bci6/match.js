// The match: a free-steering 11-a-side pitch (drag = run; buttons or gestures to pass, long-pass, shoot, tackle) plus a "director" that brings a decision
// to the player at least every ~12–15 s of play (DESIGN §4). Decisions open in scene.js; this file is the sim, the director and the drawing.
'use strict';

// 11 a side, 4-3-3 for both teams. Our team attacks up; the other team's spots are mirrored.
const FORM = { GK: [34, 101], DF1: [12, 84], DF2: [26, 87], DF3: [42, 87], DF4: [56, 84], MF1: [18, 70], MF2: [34, 72], MF3: [50, 70], FW1: [14, 57], FW2: [34, 54], FW3: [54, 57] };
const OPPS = [
  { name: 'Harbor Gulls', short: 'GUL', col: '#2f9e5b', gk: '#1b1b1b', bg: 'stadium', len: 120, iq: .55, base: { shoot: 6, dribble: 6.5, pass: 7, tackle: 6.5, speed: 8.5, catch: 8, stamina: 9 },
    P: [['GK', 'Pike', 1, { catch: 9 }], ['DF1', 'Ivo', 2, { tackle: 7 }], ['DF2', 'Bram', 3, { tackle: 7 }], ['DF3', 'Oren', 4, { tackle: 7.5 }], ['DF4', 'Finn', 5, { tackle: 6.5, speed: 9.5 }],
      ['MF1', 'Cal', 6, { pass: 8, dribble: 8 }], ['MF2', 'Vik', 10, { pass: 8.5, dribble: 8, tackle: 7 }], ['MF3', 'Noah', 8, { tackle: 7.5 }],
      ['FW1', 'Rhys', 11, { shoot: 8, dribble: 8, speed: 10 }], ['FW2', 'Zane', 7, { shoot: 9, dribble: 8, speed: 10 }], ['FW3', 'Kit', 9, { shoot: 8, dribble: 8.5, speed: 10 }]] },
  { name: 'Iron Valley', short: 'IRV', col: '#5d6773', gk: '#e9e9e9', bg: 'rain', len: 120, iq: .85, boss: 'Bruno', base: { shoot: 8, dribble: 8, pass: 8.5, tackle: 9, speed: 9.5, catch: 9, stamina: 10 },
    P: [['GK', 'Holt', 1, { catch: 10 }], ['DF1', 'Flint', 2, { tackle: 10 }], ['DF2', 'Bruno', 5, { tackle: 18, dribble: 7, speed: 8, stamina: 14 }, 'bruno'], ['DF3', 'Gage', 4, { tackle: 10.5 }], ['DF4', 'Stone', 3, { tackle: 10, speed: 10 }],
      ['MF1', 'Mace', 6, { tackle: 10 }], ['MF2', 'Rook', 8, { pass: 10, dribble: 10, tackle: 10 }], ['MF3', 'Pierce', 7, { pass: 9.5, dribble: 9 }],
      ['FW1', 'Cole', 11, { shoot: 10, dribble: 9.5, speed: 10.5 }], ['FW2', 'Dax', 9, { shoot: 11.5, dribble: 10.5, speed: 11 }], ['FW3', 'Vance', 10, { shoot: 10, dribble: 9.5 }]] },
  { name: 'Storm Academy', short: 'STA', col: '#5fb4e6', gk: '#1b1b1b', bg: 'school', len: 120, iq: .9, boss: 'Ren', tag: 'the prodigy', base: { shoot: 9, dribble: 9.5, pass: 10, tackle: 10, speed: 10.5, catch: 10, stamina: 11 },
    P: [['GK', 'Ise', 1, { catch: 11 }], ['DF1', 'Yuri', 2, { tackle: 11 }], ['DF2', 'Kenji', 5, { tackle: 11.5 }], ['DF3', 'Noel', 4, { tackle: 11 }], ['DF4', 'Ash', 3, { tackle: 10.5, speed: 11 }],
      ['MF1', 'Taro', 6, { pass: 11, tackle: 10.5 }], ['MF2', 'Lio', 8, { pass: 11.5, dribble: 10.5 }], ['MF3', 'Remy', 7, { pass: 10.5, tackle: 11 }],
      ['FW1', 'Haru', 11, { shoot: 11, dribble: 10.5, speed: 11 }], ['FW2', 'Ren', 10, { shoot: 14, dribble: 14, pass: 11, speed: 12, stamina: 13 }, 'ren'], ['FW3', 'Max', 9, { shoot: 10.5, dribble: 10 }]] },
];
// rival specials used against the player (DESIGN §4): Ren's shot, Bruno's block, Dax's shot (owner, 24 Nov: match 2 needs a special shot too).
// Twice a match each at most. Match 1 has none on purpose: it's the easy first match.
const RIVAL_SP = { Ren: { name: 'FROST SPIRAL', face: 'ren', cols: ['#e8fbff', '#7fd8ff', '#0b2f4a'], pen: .15 },
  Dax: { name: 'THUNDER HAMMER', cols: ['#fffbe0', '#ffd23f', '#5a3a00'], pen: .1, anim: 'zig' }, Bruno: { name: 'IRON WALL', face: 'bruno', cols: ['#f2f4f8', '#9aa7b5', '#2b333d'] } };
async function rivalShot(car, final) {                       // their shot at your goal; a rival may unleash a special first
  const rs = RIVAL_SP[car.name], used = (G.rivalUsed = G.rivalUsed || {});
  if (rs && rs.pen && (used[car.name] || 0) < 2 && car.en >= 25 && (final || Math.random() < .7)) {   // rivals pay energy for specials too
    used[car.name] = (used[car.name] || 0) + 1; G.paused = true; car.en = Math.max(0, car.en - 25); audN('special_' + car.name);
    if (car.name === 'Ren') await techRen(rs.name, (used[car.name] || 0) > 1); else if (rs.anim) await techStar(rs.name, car, rs.cols, rs.anim, (used[car.name] || 0) > 1); else await techFX(rs.name, rs.face, rs.cols, 1.5, false);
    if (!G || G.over) return; G.paused = false;
    audN('shot_by_star'); return openScene('save', { me: keeperOf(0), them: car, final, rival: rs });
  }
  audN(car === G.star ? 'shot_by_star' : 'shot_by_other'); openScene('save', { me: keeperOf(0), them: car, final });
}

let G = null;
function player(team, role, name, num, st, face) {
  const [x0, y0] = FORM[role], x = team ? W - x0 : x0, y = team ? H - y0 : y0;
  return { team, role: role.slice(0, 2), slot: role, hx: x, hy: y, x, y, vx: 0, vy: 0, st, name, num, face, stun: 0, dive: 0, diveX: 0, trail: [], ghost: 0, press: false, en: 100, rec: true };
}
// everyone is built differently (owner, 24 Nov): forwards are quick but tire sooner, midfielders run all day
const ROLE_FIT = (b, r) => r.startsWith('FW') ? { speed: b.speed + .5, stamina: b.stamina - 1.5 } : r.startsWith('MF') ? { stamina: b.stamina + 2 } : r.startsWith('DF') ? { speed: b.speed - .5, stamina: b.stamina + .5 } : {};
function newMatch() {
  const m = Math.min(save.match, OPPS.length), opp = OPPS[m - 1];
  const ours = (st) => ({ shoot: 7, dribble: 8, pass: 9, tackle: 9, speed: 9.5, stamina: 10, ...st });
  const P = [
    player(0, 'GK', 'Doi', 1, { catch: 9.5 + m * .5, pass: 9 }),
    player(0, 'DF1', 'Aki', 2, ours({ tackle: 10, speed: 10.5 })), player(0, 'DF2', 'Kemal', 4, ours({ tackle: 11, speed: 8.5, stamina: 12 })),
    player(0, 'DF3', 'Renzo', 5, ours({ tackle: 11, pass: 9.5, stamina: 11 })), player(0, 'DF4', 'Tomas', 3, ours({ tackle: 9.5, speed: 11, stamina: 8.5 })),
    player(0, 'MF1', 'Yuto', 7, ours({ pass: 11, dribble: 10, shoot: 8, stamina: 12 })), player(0, 'MF2', 'Mo', 8, ours({ shoot: 9, dribble: 10, pass: 12 + m, speed: 10, stamina: 11 }), 'mo'),
    player(0, 'MF3', 'Elif', 6, ours({ tackle: 10.5, pass: 10, speed: 9, stamina: 14 })),
    player(0, 'FW1', 'Sami', 11, ours({ shoot: 9, dribble: 10.5, speed: 12, stamina: 8 })), player(0, 'FW2', save.name, 9, save.stats, 'kai'),
    player(0, 'FW3', 'Lukas', 10, ours({ shoot: 9.5, dribble: 9, speed: 10, stamina: 10.5 })),
    ...opp.P.map(([r, n, num, st, face]) => player(1, r, n, num, { ...opp.base, ...ROLE_FIT(opp.base, r), ...st }, face)),
  ];
  const hero = P.find(p => p.team === 0 && p.slot === 'FW2'), mo = P.find(p => p.name === 'Mo');
  const star = P.filter(p => p.team === 1 && p.role !== 'GK').sort((a, c) => (c.st.shoot || 0) - (a.st.shoot || 0))[0];   // their best shooter: fed more, marked ★
  G = { P, hero, mo, star, opp, m, ball: { x: GX, y: 52.5, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, noPick: null, noPickT: 0, shot: null, trail: [] },
    score: [0, 0], t: 0, len: opp.len, paused: false, over: false, ctrl: hero, sp: 25, spMax: 100, tkCd: 0,
    cam: { x: GX, y: 48, z: 1 }, parts: [], pops: [], shake: 0, slow: 1, timers: [], bgImg: IMG[opp.bg],
    since: 0, nextForce: 9, chain: false, tut: save.match === 1 && !save.plays ? 1 : 0, fkDone: m < 2, finalDone: false,
    streak: 0, lossRun: 0, zone: 0, real0: performance.now(), goalAnim: false,
    stat: { dec: 0, won: 0, lost: 0, perfect: 0, good: 0, upset: 0, specials: 0, goals: 0, assists: 0, against: 0, chances: [], kinds: {}, gaps: [], free: 0 } };
  kickoff(0);
  if (G.tut) { const bram = P.find(p => p.name === 'Bram'); bram.x = GX + 1; bram.y = 30; G.since = 2; bram.press = true; G.nextForce = 99; }
}
function kickoff(team) {
  for (const p of G.P) { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; p.stun = 0; p.dive = 0; p.press = false; }
  const b = G.ball; Object.assign(b, { x: GX, y: 52.5, z: 0, vx: 0, vy: 0, vz: 0, shot: null, noPick: null, rolls: null });
  const taker = team === 0 ? G.hero : G.P.find(p => p.team === 1 && p.slot === 'FW2');
  taker.x = GX; taker.y = team === 0 ? 53.6 : 51.4; own(taker);
  G.oneTwo = null; G.since = Math.min(G.since, 4); b.net = null;
}
function own(p) { const b = G.ball;
  if (AUD && b.owner && b.owner.team === 0 && p.team === 1 && !G.paused && !G.fairSteal) audBad('steal_no_warning', { from: b.owner.name, by: p.name });
  b.owner = p; b.last = p; b.shot = null; b.air = false; b.net = null; b.x = p.x; b.y = p.y + (p.team === 0 ? -.8 : .8); G.ownT = G.t; p.plan = null; b.vx = b.vy = b.vz = 0; b.z = 0; b.rolls = null; for (const q of G.P) { q.press = false; q.wind = null; } }
const mates = p => G.P.filter(q => q.team === p.team && q !== p);
const foes = p => G.P.filter(q => q.team !== p.team);
const keeperOf = team => G.P.find(q => q.team === team && q.role === 'GK');
const goalY = team => team === 0 ? 0 : H;                 // the goal a team attacks
const later = (sec, fn) => G.timers.push({ t: G.t + sec, fn });
const specCost = () => save.style === 'striker' ? 50 : 60;
function addSp(v) { G.sp = clamp(G.sp + v, 0, G.spMax); }

// ---------------------------------------------------------------- input: drag = run, tap = pass, flick = shoot
let touch = null, steer = null;
const toWorld = (sx, sy) => { const [dx, dy] = s2w((sx - CW / 2) / (S * G.cam.z), (sy - CH / 2) / (S * G.cam.z)); return { x: G.cam.x + dx, y: G.cam.y + dy }; };
cv.addEventListener('pointerdown', e => { if (G && G.plan) { planTap(e.clientX, e.clientY); return; } if (!G || G.paused) return; touch = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), hist: [], owner: G.ball.owner }; G.touched = true; });
cv.addEventListener('pointermove', e => {
  if (!touch) return; touch.x = e.clientX; touch.y = e.clientY; touch.hist.push([performance.now(), e.clientX, e.clientY]);
  const dx = touch.x - touch.x0, dy = touch.y - touch.y0, d = Math.hypot(dx, dy);
  if (d > 14) { touch.dir = { x: dx / d, y: dy / d, k: Math.min(1, d / 60) }; const [wx, wy] = s2w(dx / d, dy / d); steer = { x: wx, y: wy, k: touch.dir.k }; }
});
const endTouch = e => {
  if (!touch || !G) { touch = null; steer = null; return; }
  const now = performance.now(), dx = e.clientX - touch.x0, dy = e.clientY - touch.y0, d = Math.hypot(dx, dy), dur = now - touch.t0;
  const recent = touch.hist.filter(h => now - h[0] < 120); const r0 = recent[0] || [touch.t0, touch.x0, touch.y0];
  const [vx, vy] = s2w((e.clientX - r0[1]) / Math.max(16, now - r0[0]), (e.clientY - r0[2]) / Math.max(16, now - r0[0]));
  if (!G.paused && !G.tut && touch.owner === G.ball.owner) {      // the ball changed hands during the touch: do nothing
    if (d < 18 && dur < 450) tapPass(e.clientX, e.clientY);
    else if (dur < 350 && d > 40 && Math.hypot(vx, vy) > .9 && vy < -.4) flick(vx, vy);   // only a quick swipe shoots; letting go of a steer never does
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
  if (!p || p.team !== 0 || !angleOk(p)) return;
  const k = p.y / -vy, aimX = p.x + vx * k, gk = keeperOf(1);
  G.userShot = true; const ch = shotChance(p, gk, false), onT = Math.abs(aimX - GX) < GOALW / 2 + .4;
  shoot(p, clamp(aimX, GX - 3.2, GX + 3.2), false, !onT ? 'miss' : Math.random() < ch ? 'goal' : Math.random() < .5 ? 'parry' : 'catch');
}

// ---------------------------------------------------------------- actions
function passErr(p, d) {                                    // metres of random error for a pass of length d
  return (.3 + d * .045) * clamp(1.25 - ((p.st.pass || 9) - 10) * .06, .5, 1.6) * (1 + tiredPen(p) * 3) * (1 + AI.pressure(p.team, p.x, p.y) * .25);
}
function jitter(p, tx, ty, d) { const e = passErr(p, d), a = rnd(Math.PI * 2), r = Math.abs(rnd(-1, 1) + rnd(-1, 1)) * e * .7; return [clamp(tx + Math.cos(a) * r, 1, W - 1), clamp(ty + Math.sin(a) * r, 1, H - 1)]; }
const atFeet = (b, p, tx, ty) => { const d = Math.hypot(tx - p.x, ty - p.y) || 1; b.x = p.x + (tx - p.x) / d * .8; b.y = p.y + (ty - p.y) / d * .8; b.z = 0; };
function pass(p, t, safe) {
  const b = G.ball; atFeet(b, p, t.x, t.y); let tx = t.x + t.vx * .3, ty = t.y + t.vy * .3; if (!safe) [tx, ty] = jitter(p, tx, ty, Math.hypot(tx - p.x, ty - p.y));
  const d = Math.hypot(tx - p.x, ty - p.y) || 1, sp = clamp(10 + d * .55, 12, 24);
  b.owner = null; b.vx = (tx - p.x) / d * sp; b.vy = (ty - p.y) / d * sp; b.noPick = p; b.noPickT = .35; b.passTo = t; b.last = p;
  b.rolls = new Map(foes(p).map(q => [q, safe ? false : Math.random() < clamp(.2 + ((q.st.tackle || 8) - (p.st.pass || 9)) * .04, .05, .6)]));
  if (p.team === 0) G.lastPasser = p;
  audDir(p, ty); snd('kick');
}
function passPoint(p, tx, ty) {                              // a through ball into space (one-two return)
  const b = G.ball; atFeet(b, p, tx, ty); const d = Math.hypot(tx - p.x, ty - p.y) || 1, sp = clamp(11 + d * .6, 13, 24);
  b.owner = null; b.vx = (tx - p.x) / d * sp; b.vy = (ty - p.y) / d * sp; b.noPick = p; b.noPickT = .4; b.last = p;
  b.rolls = new Map(foes(p).map(q => [q, false])); snd('kick');
}
function distToGoal(p) { return Math.hypot(p.x - GX, p.y - goalY(p.team)); }
function mouthAngle(p) {                                     // how much of the goal mouth the shooter can see (radians)
  const gy = goalY(p.team), d = p.team === 0 ? p.y - gy : gy - p.y; if (d <= 0) return 0;
  return Math.abs(Math.atan2(GX + GOALW / 2 - p.x, d) - Math.atan2(GX - GOALW / 2 - p.x, d));
}
const angleOk = p => mouthAngle(p) > .16 && Math.abs(goalY(p.team) - p.y) > 3;
const anglePen = p => (1 - clamp(mouthAngle(p) / .45, 0, 1)) * .25;
function shoot(p, aimX, special, out) {                      // out is decided before the kick (by the clash); the flight reveals it
  const b = G.ball, gk = keeperOf(1 - p.team), gy = goalY(p.team);
  if (AUD && p.team === 0 && !G.paused && !G.userShot) audBad('shot_not_chosen', { by: p.name }); G.userShot = false;
  if (out === 'miss') aimX = GX + (aimX >= GX ? 1 : -1) * rnd(4.4, 6);
  atFeet(b, p, aimX, gy);
  const d = Math.hypot(aimX - b.x, gy - b.y) || 1, sp = special ? 36 : 26;
  b.owner = null; b.last = p; b.vx = (aimX - b.x) / d * sp; b.vy = (gy - b.y) / d * sp; b.vz = special ? 1.6 : 3; b.z = .2;
  b.shot = { by: p, out, special, aimX, gk, gy, assist: p.team === 0 && p !== G.hero && G.assistFrom === G.hero }; b.noPick = p; b.noPickT = 99; b.rolls = null;
  if (AUD) b.shot.k = { aimX: +aimX.toFixed(1), bx: +b.x.toFixed(1), by: +b.y.toFixed(1), px: +p.x.toFixed(1), py: +p.y.toFixed(1), vx: +b.vx.toFixed(1), vy: +b.vy.toFixed(1), t: +G.t.toFixed(1) };
  gk.diveX = out === 'goal' ? aimX + (aimX > GX ? -2.2 : 2.2) : aimX;   // a beaten keeper dives the wrong way or too late
  G.flame = !!special;
  snd(special ? 'boom' : 'kick'); buzz(special ? 60 : 20);
}

// ---------------------------------------------------------------- simulation
// Stamina (owner, 24 Nov): everyone starts at 100. Sprinting drains fast, running drains slowly, walking or standing recovers.
// The most you can get back (the cap) also shrinks as the match goes on, so it can't be refilled for free. Half-time gives +25.
// Tired players (under 60) run slower and (under 45) lose points on every chance; specials need the energy they cost.
const topSpeed = p => 5.2 + (p.st.speed || 8) * .17;
function speedOf(p) { return topSpeed(p) * (G.ball.owner === p ? .86 : 1) * (.62 + .38 * Math.min(1, p.en / 60)); }
const tiredPen = p => p.role === 'GK' || p.en >= 45 ? 0 : (45 - p.en) / 45 * .25;
const capOf = p => p.role === 'GK' ? 100 : 100 - 30 * clamp(G.t / G.len, 0, 1) * clamp(1 - ((p.st.stamina || 10) - 10) * .06, .5, 1.3);
const effort = p => { const r = Math.hypot(p.vx, p.vy) / topSpeed(p); return r > .88 ? 'sprint' : r > .5 ? 'run' : 'rest'; };
const sprintCost = p => clamp(1 + ((p.st.speed || 10) - 10) * .04, .8, 1.5);   // a faster sprint burns more: SPEED and STAMINA pull against each other
function stamRate(p, mode) {                                  // energy per second of match time
  const k = (p.st.stamina || 10) - 10, drain = clamp(1 - k * .04, .55, 1.3);
  return mode === 'sprint' ? -3.2 * drain * sprintCost(p) : mode === 'run' ? -.35 * drain : 2.6 * clamp(1 + k * .05, .6, 1.5);
}
function moveTo(p, tx, ty, k = 1) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), v = speedOf(p) * k;
  if (d < .3) { p.vx *= .8; p.vy *= .8; return; }
  const s = Math.min(v, d * 3); p.vx = lerp(p.vx, dx / d * s, .15); p.vy = lerp(p.vy, dy / d * s, .15);
}
// Team shape (owner, 24 Nov: "go forward when attacking, go back when defending"). Worked in metres from your own goal line (u):
// attacking, forwards run 13 m ahead of the ball, midfielders stay level or just ahead, defenders follow up to halfway;
// defending, everyone drops goal-side of the ball. So a forward pass is usually on, and the team never leaves its goal open.
function shiftHome(p) {
  const b = G.ball;
  if (p.role === 'GK') return [clamp(b.x, GX - 3, GX + 3), p.hy];
  const U = y => p.team === 0 ? H - y : y, ub = U(b.y), uh = U(p.hy), L = p.role, holder = b.owner || b.last, att = !!holder && holder.team === p.team;
  let u;
  if (att) u = L === 'FW' ? clamp(Math.max(ub + 13, uh + 4), 0, H - 13) : L === 'MF' ? clamp(Math.max(ub + 2, uh + (ub - 52.5) * .3), 0, H - 22) : clamp(ub - 22, uh, 58);
  else u = L === 'DF' ? clamp(ub - 13, 7, uh + 20) : L === 'MF' ? clamp(ub - 6, 13, uh + 26) : clamp(ub + 1, 28, uh + 14);
  if (p.team === 0) u += { att: 6, def: -6, bal: 0 }[PLAN.tactic] || 0;
  const x = GX + (p.hx - GX) * (att && L !== 'DF' ? 1.15 : 1) + (b.x - GX) * .35;
  return [clamp(x, 3, W - 3), clamp(U(u), 2, H - 2)];
}
function step(dt) {
  if (G.over) return;
  if (AUD) { for (const p of G.P) if (p.ax !== undefined && !G.afterCut && Math.hypot(p.x - p.ax, p.y - p.ay) > 2.5) audBad('teleport', { name: p.name, d: +Math.hypot(p.x - p.ax, p.y - p.ay).toFixed(1) }); G.afterCut = false; }
  const b = G.ball; dt *= G.slow;
  G.t += dt; G.since += dt; addSp(dt * (G.zone > 0 ? .6 : .25));
  if (G.zone > 0 && (G.zone -= dt) <= 0) { G.zone = 0; $('zone').classList.remove('on'); }
  for (const tm of G.timers.filter(x => x.t <= G.t)) { G.timers.splice(G.timers.indexOf(tm), 1); tm.fn(); }
  if (G.t >= G.len && !b.shot && !G.goalAnim && !G.paused) return finish();
  if (!G.half && G.t >= G.len / 2 && !b.shot && !G.goalAnim && !G.paused && !G.cutting && !G.want) return halfTime();
  if (b.owner && b.owner.team === 0) G.ctrl = b.owner;
  else if (!G.oneTwo) { const near = G.P.filter(q => q.team === 0 && q.role !== 'GK').sort((a, c) => dist(a, b) - dist(c, b))[0]; if ((dist(near, b) < dist(G.ctrl, b) - 3 && !(G.ctrlLock > G.t)) || G.ctrl.role === 'GK') G.ctrl = near; }
  AI.assignJobs();
  for (const p of G.P) {
    p.trail.push([p.x, p.y]); if (p.trail.length > 8) p.trail.shift(); p.ghost = Math.max(0, p.ghost - dt);
    p.eff = effort(p); p.en = clamp(p.en + dt * stamRate(p, p.eff), 0, capOf(p));
    if (p.dash) { if (G.t < p.dash.until) { p.vx = p.dash.vx; p.vy = p.dash.vy; continue; } p.dash = null; }
    if (p.runTo && G.t < p.runTo.until && p !== G.ctrl && p.stun <= 0) { moveTo(p, p.runTo.x, p.runTo.y, 1.1); continue; }
    if (p.stun > 0) { p.stun -= dt; p.vx *= .9; p.vy *= .9; continue; }
    if (G.oneTwo && p === G.hero && b.owner !== p) { moveTo(p, G.oneTwo.tx, G.oneTwo.ty, 1.15); continue; }
    if (p === G.ctrl) ctrlMove(p);
    else if (p.team === 1 && b.owner === p) AI.carrier(p, dt);
    else if (p.role === 'GK') keeper(p);
    else if (p.press && b.owner && b.owner.team !== p.team) moveTo(p, b.owner.x, b.owner.y - (p.team === 1 ? 1 : -1), 1.25);
    else if (G.tut && p.team === 1) { const [x, y] = shiftHome(p); moveTo(p, x, y, .5); }
    else AI.offBall(p, dt);
  }
  for (const p of G.P) { p.x = clamp(p.x + p.vx * dt, 1, W - 1); p.y = clamp(p.y + p.vy * dt, -1, H + 1); }
  ballStep(dt);
  if (AUD && !G.cutting) {
    if (!isFinite(b.x) || !isFinite(b.y) || G.P.some(p => !isFinite(p.x) || !isFinite(p.y))) audBad('nan', {});
    if (b.x < -4 || b.x > W + 4 || b.y < -6 || b.y > H + 6) audBad('ball_far_off_pitch', { x: +b.x.toFixed(1), y: +b.y.toFixed(1), owner: b.owner && b.owner.name, shot: !!b.shot });
    if (b.net && Math.abs(b.x - GX) > GOALW / 2) audBad('ball_in_net_outside_posts', { x: +b.x.toFixed(1) });
    if (b.owner && (b.owner.x < -0.5 || b.owner.x > W + .5 || b.owner.y < -0.5 || b.owner.y > H + .5)) audBad('carrier_off_pitch', { name: b.owner.name, x: +b.owner.x.toFixed(1), y: +b.owner.y.toFixed(1) });
  }
  if (!G.paused && !G.goalAnim) director();
  if (!G.paused && !G.goalAnim) contactTackles(dt);
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .92; q.vy *= .92; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter(q => q.t < 1.3);
  G.shake = Math.max(0, G.shake - dt);
  if (AUD) { for (const p of G.P) { p.ax = p.x; p.ay = p.y; } G.heroMin = Math.min(G.heroMin ?? 100, G.hero.en); }
}
function ctrlMove(p) {
  const b = G.ball;
  if (G.want && G.want.me === p && !steer) return moveTo(p, G.want.them.x, G.want.them.y, 1.15);
  if (steer) { const v = speedOf(p) * (.55 + .5 * steer.k); p.vx = lerp(p.vx, steer.x * v, .25); p.vy = lerp(p.vy, steer.y * v, .25); return; }
  if (b.owner === p) {                                       // the carrier runs at goal by itself, weaving away from the nearest defender
    const th = foes(p).filter(q => q.role !== 'GK' && q.y < p.y).sort((a, c) => dist(a, p) - dist(c, p))[0];
    const side = th && dist(th, p) < 8 ? (th.x < p.x ? 1 : -1) * 3 : 0;
    moveTo(p, clamp(lerp(p.x, GX, p.y < 22 ? .6 : .3) + side, 6, W - 6), Math.max(6, p.y - 10), p.en < 35 ? .55 : .85);   // tired: he walks it and gets his breath back
  } else if (!b.owner || b.owner.team === 1) moveTo(p, b.x + (b.owner ? 0 : b.vx * .3), b.y + (b.owner ? 1.2 : b.vy * .3), G.since > G.nextForce ? 1.15 : .95);
  else { const [x, y] = shiftHome(p); moveTo(p, x, y, p.en < 50 ? .5 : .75); }
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
    b.x = p.x + p.vx / sp * f; b.y = p.y + p.vy / sp * f; b.z = 0; b.trail.length = 0;
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) outOfPlay();   // dribbled over a line: out of play, like real football
    return;
  }
  if (b.net) {                                                // in the net: roll to the back of it and stay between the posts
    const n = b.net; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt); b.z = Math.max(0, b.z - dt);
    b.x = clamp(b.x, GX - GOALW / 2 + .4, GX + GOALW / 2 - .4); b.y = n.gy === 0 ? clamp(b.y, -1.9, 0) : clamp(b.y, H, H + 1.9);
    return;
  }
  if (G.goalKick) return;                                     // a wide shot waits for the goal-kick cut
  b.py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.max(0, b.z + b.vz * dt); b.vz -= 9.8 * dt;
  b.trail.push([b.x, b.y, b.z]); if (b.trail.length > (G.flame ? 22 : 8)) b.trail.shift();
  if (b.shot) {
    const s = b.shot;
    if (s.special) burst(b.x, b.y, 2, Math.random() < .5 ? '#ffb000' : '#ff4a00', 2, .45, .5);
    if (Math.abs(b.y - s.gy) < 10 && G.slow > .4) G.slow = s.special ? .3 : .45;
    const crossed = (b.py - s.gy) * (b.y - s.gy) <= 0;
    if (crossed) { const k = (s.gy - b.py) / ((b.y - b.py) || 1); b.x = b.x - b.vx * dt * (1 - k); b.y = s.gy; }   // exact point on the line
    if ((s.out === 'catch' || s.out === 'parry') && Math.abs(b.y - s.gy) < 1.8) shotEnd(s);   // saved at the keeper, before the line
    else if (crossed || b.x < -1 || b.x > W + 1 || b.y < -6 || b.y > H + 6) shotEnd(s);
    return;
  }
  const sp = Math.hypot(b.vx, b.vy); if (sp > 0 && b.z <= 0) { const f = Math.exp(-1.1 * dt); b.vx *= f; b.vy *= f; if (sp < .4) b.vx = b.vy = 0; }
  if (b.air && b.z <= 0) b.air = false;
  if ((b.noPickT -= dt) <= 0) b.noPick = null;
  if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) return outOfPlay();
  for (const p of G.P) {                                       // pick-ups and interceptions
    if (p === b.noPick || p.stun > 0 || b.z > 1) continue;
    if (dist(p, b) < 1.2) {
      if (b.rolls && b.rolls.has(p) && sp > 5 && !b.rolls.get(p)) continue;          // this defender misjudged the pass
      if (b.rolls && b.rolls.has(p)) pop(p.x, p.y - 2, 'INTERCEPTED', '#ff6b6b');
      own(p); p.runTo = null;
      if (G.oneTwo && p === G.mo) { const o = G.oneTwo; later(.2, () => { if (G.ball.owner === G.mo) { passPoint(G.mo, o.tx, o.ty); } }); }
      if (p === G.hero && G.oneTwo) { G.oneTwo = null; G.chain = true; G.since = Math.max(G.since, 2.7); }
      if (p.team === 0 && G.lastPasser && G.lastPasser !== p) G.assistFrom = G.lastPasser;
      return;
    }
  }
}
async function shotEnd(s) {
  const b = G.ball; b.shot = null; G.flame = false;
  if (AUD) {                                                  // referee: where does this ball cross the goal line?
    const towards = (s.gy - b.y) * b.vy > 0 || Math.abs(s.gy - b.y) < .05, xl = towards && b.vy ? b.x + b.vx * (s.gy - b.y) / b.vy : b.x;
    const inMouth = towards && Math.abs(xl - GX) < GOALW / 2, rec = { out: s.out, team: s.by.team, bx: +b.x.toFixed(1), by: +b.y.toFixed(1), xLine: +xl.toFixed(1), sx: +s.by.x.toFixed(1), sy: +s.by.y.toFixed(1), special: !!s.special, k: s.k, vxEnd: +b.vx.toFixed(1), vyEnd: +b.vy.toFixed(1) };
    AUD.goals.push(rec);
    if (s.out === 'goal' && !inMouth) audBad('goal_but_not_in_mouth', rec);
    if (s.out !== 'goal' && inMouth && s.out !== 'catch' && s.out !== 'parry') audBad('in_mouth_but_no_goal', rec);
  }
  if (s.out === 'goal') {
    G.goalAnim = true; G.afterShot = null;
    const sp0 = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / sp0 * 5; b.vy = b.vy / sp0 * 5; b.vz = 0; b.net = { gy: s.gy };   // same direction, into the net
    G.slow = .25; G.shake = .6; burst(b.x, s.gy, 40, '#fff', 10, .9);
    G.score[s.by.team]++;
    if (s.by.team === 0) { if (s.by === G.hero) G.stat.goals++; else G.stat.assists += s.assist ? 1 : 0; G.stat.teamGoals = (G.stat.teamGoals || 0) + 1; snd('win'); buzz([40, 40, 80]); banner(s.special ? 'GOAL!!!' : 'GOAL!'); }
    else { G.stat.against++; snd('lose'); banner(`${G.opp.short} SCORE`, 'small'); }
    if (s.by.team === 0 && s.special && !save.firstSpecialGoal) { save.firstSpecialGoal = true; track('first_special', { m: G.m, sec: Math.round(G.t) }); }
    await wait(1900 / FAST);
    if (!G) return;
    G.slow = 1; G.goalAnim = false;
    if (G.afterGoal) { const f = G.afterGoal; G.afterGoal = null; f(); }
    if (G.t < G.len) cut(() => kickoff(1 - s.by.team));
    return;
  }
  G.slow = 1; G.afterGoal = null;
  if (s.out === 'parry') { b.vx = (b.x > GX ? 1 : -1) * rnd(5, 9); b.vy = (s.gy === 0 ? 1 : -1) * rnd(6, 10); b.vz = 2; b.noPick = s.gk; b.noPickT = .5; pop(s.gk.x, s.gk.y + (s.gy ? -2 : 2), 'PARRIED!', '#fff'); s.gk.stun = .6; burst(b.x, b.y, 16, '#fff', 6); }
  else if (s.out === 'catch') { own(s.gk); pop(s.gk.x, s.gk.y + (s.gy ? -2 : 2), 'SAVED!', '#fff'); later(.9, () => { if (G.ball.owner === s.gk) distribute(s.gk); }); }
  else { pop(b.x, s.gy + (s.gy ? -2 : 2), 'WIDE!', '#ddd'); b.vx = b.vy = 0; G.goalKick = true;
    setTimeout(() => G && cut(() => { G.goalKick = false; const gk = s.gk; gk.x = GX; gk.y = s.gy === 0 ? 5 : H - 5; own(gk); later(.9, () => { if (G.ball.owner === gk) distribute(gk); }); }), 500 / FAST); }
  if (G.afterShot) { const f = G.afterShot; G.afterShot = null; f(s.out); }
}
function distribute(gk) { const t = AI.bestPass(gk, 'pass'), l = AI.bestPass(gk, 'long'); if (t) pass(gk, t, true); else if (l) passLong(gk, l); else pass(gk, mates(gk).find(q => q.role === 'DF'), true); }
function outOfPlay() { if (G.cutting) return; G.ball.vx = G.ball.vy = 0; cut(restart); }
function restart() {
  const b = G.ball, team = b.last ? 1 - b.last.team : 0;
  if (AUD) AUD.outs.push({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), t: Math.round(G.t) });
  const lastTeam = b.last ? b.last.team : 1;
  if (b.y < 0 || b.y > H) {                                   // over an end line: goal kick or corner
    const def = b.y < 0 ? 1 : 0;
    if (lastTeam !== def) { const gk = keeperOf(def); gk.x = GX; gk.y = def === 1 ? 5.5 : H - 5.5; own(gk); pop(gk.x, gk.y + (def ? 2 : -2), 'GOAL KICK', '#ddd'); later(.9, () => { if (G.ball.owner === gk) distribute(gk); }); return; }
    const cx = b.x < GX ? 1 : W - 1, cy = def === 1 ? 1 : H - 1, att = 1 - def;
    const p = G.P.filter(q => q.team === att && q.role !== 'GK').sort((a, c) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(c.x - cx, c.y - cy))[0];
    p.x = cx; p.y = cy; p.vx = p.vy = 0; own(p); pop(cx, cy + (def ? 2 : -2), 'CORNER', '#ffd23f'); return;
  }
  b.x = clamp(b.x, 1, W - 1); b.y = clamp(b.y, 1, H - 1);       // throw-in to the other team
  const p = G.P.filter(q => q.team === team && q.role !== 'GK').sort((a, c) => dist(a, b) - dist(c, b))[0];
  p.x = b.x; p.y = b.y; p.vx = p.vy = 0; own(p);
}
function pop(x, y, text, col) { G.pops.push({ x, y, text, col: col || '#fff', t: 0 }); }
function burst(x, y, n, col, sp = 6, life = .6, size = .35) {
  for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 2), v = rnd(sp * .3, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, col, size }); }
}
function banner(text, cls) { const el = $('banner'); el.innerHTML = `<span class="bang go ${cls || ''}">${text}</span>`; }

// ---------------------------------------------------------------- free play: tackles when a player catches the carrier (football, not only menus)
const stealChance = (q, c) => clamp((chance(q.st.tackle, c.st.dribble) - tiredPen(q) + tiredPen(c)) * (q.face ? 1 : .75), .05, .9);
function contactTackles(dt) {
  const b = G.ball, c = b.owner; G.tkCd -= dt;
  if (!c || b.shot || G.tut) return;
  if (c.team === 0) {                                          // a tackle on YOU is never a surprise: the defender winds up (red ring + his chance),
    for (const q of foes(c)) {                                 // you get ~0.6 s to pass, shoot or run; he only wins it if he is still on you
      if (q.role === 'GK') continue;
      if (q.wind) {
        if (q.stun > 0 || q.wind.c !== c || G.t > q.wind.t + .5) { q.wind = null; continue; }
        if (G.t < q.wind.t) continue;
        const w = q.wind; q.wind = null; G.tkCd = 2.2; q.en = Math.max(0, q.en - 6);
        if (dist(q, c) > 2) { audN('tackle_dodged'); q.stun = .6; pop(q.x, q.y - 2, 'TOO SLOW', '#ddd'); return; }
        if (Math.random() < w.ch) {
          audN('tackle_won_after_warning'); G.fairSteal = true; own(q); G.fairSteal = false; c.stun = .9; G.stealT = G.t; burst(c.x, c.y, 10, '#c9b58a', 4); pop(q.x, q.y - 2, 'STOLEN!', '#ff6b6b'); snd('lose');
          for (const d of mates(c)) if (d.role === 'DF' && d.stun <= 0) d.runTo = null;
        } else { audN('tackle_shrugged'); q.stun = .8; pop(c.x, c.y - 2, 'SHRUGGED OFF!', '#ffd23f'); }
        return;
      }
      if (G.tkCd <= 0 && G.since >= 1.2 && q.stun <= 0 && dist(q, c) < 2.6 && !foes(c).some(f => f.wind)) {
        const ch = stealChance(q, c); audN('tackle_warned'); q.wind = { c, t: G.t + (q.face ? .5 : .65), ch };
        if (!G.windSeen) { G.windSeen = true; setHint('Tackle coming! Pass, shoot or run away before the ring closes.', 3500); }
      }
    }
    return;
  }
  if (G.tkCd > 0 || G.since < 1.2) return;
  for (const q of foes(c)) {
    if (q.role === 'GK' || q.stun > 0 || dist(q, c) > 1.3) continue;
    G.tkCd = q.team === 0 ? 1.5 : 2.4;
    const mult = q.team === 1 ? (q.face ? 1 : .75) : q === G.ctrl ? 1 : .6, ch = clamp((chance(q.st.tackle, c.st.dribble) - tiredPen(q) + tiredPen(c)) * mult, .05, .9);
    q.en = Math.max(0, q.en - 6);
    if (Math.random() < ch) { own(q); c.stun = .9; burst(c.x, c.y, 10, '#c9b58a', 4); pop(q.x, q.y - 2, q.team === 0 ? `WON IT! ${Math.round(ch * 100)}%` : 'STOLEN!', q.team === 0 ? '#ffd23f' : '#ff6b6b'); if (q.team === 0) G.stat.free++; }
    else { q.stun = .7; if (q === G.ctrl || c === G.ctrl) pop(c.x, c.y - 2, c.team === 0 ? 'SHRUGGED OFF!' : `MISSED ${Math.round(ch * 100)}%`, c.team === 0 ? '#ffd23f' : '#ddd'); }
    return;
  }
}
// pass targets for the buttons: short = best open teammate ahead within ~22 m; long = most advanced open teammate 22-50 m away
const marked = q => foes(q).filter(f => f.role !== 'GK' && dist(f, q) < 3.5).length;
const shortTarget = p => AI.bestPass(p, 'pass');            // the best short pass by the same expected-value search the AI uses
const longTarget = p => AI.bestPass(p, 'long');
const longChance = p => clamp(.5 + ((p.st.pass || 9) - 10) * .04 - tiredPen(p), .2, .88);
function passLong(p, t) { passLongTo(p, t.x + t.vx * .6, t.y - (p.team === 0 ? 4 : -4), t); }
function passLongTo(p, tx0, ty0, runner) {                   // lofted ball over the defenders: rolled honestly; a miss lands a few metres off
  const b = G.ball, ok = Math.random() < longChance(p), off = ok ? rnd(0, 1.5) : rnd(5, 8), a = rnd(Math.PI * 2);
  const tx = clamp(tx0 + Math.cos(a) * off, 2, W - 2), ty = clamp(ty0 + Math.sin(a) * off, 3, H - 3);
  atFeet(b, p, tx, ty); const d = Math.hypot(tx - b.x, ty - b.y) || 1, sp = clamp(14 + d * .3, 16, 28), T = d / sp;
  b.owner = null; b.vx = (tx - b.x) / d * sp; b.vy = (ty - b.y) / d * sp; b.vz = 9.8 * T / 2; b.z = .3; b.air = true;
  b.noPick = p; b.noPickT = .4; b.last = p; b.rolls = null; audDir(p, ty); if (runner) runner.runTo = { x: tx, y: ty, until: G.t + T + 1 };
  p.en = Math.max(0, p.en - 4); G.lastPasser = p; snd('kick');
  pop(p.x, p.y - 2, ok ? 'LONG BALL!' : 'OVERHIT...', ok ? '#8fd8ff' : '#ddd');
}
function passCut(p, mate) {                                   // a lost pass in a scene: played, and read by the defender nearest the lane
  const f = foes(p).filter(q => q.stun <= 0).sort((a, c) => laneD(a, p, mate) - laneD(c, p, mate))[0];
  passPoint(p, f.x, f.y); G.ball.rolls = new Map(); pop(f.x, f.y - 2, 'READ IT!', '#ff6b6b');
}
function laneD(q, a, b) { const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1, t = clamp(((q.x - a.x) * vx + (q.y - a.y) * vy) / L, 0, 1); return Math.hypot(q.x - a.x - t * vx, q.y - a.y - t * vy); }
const audDir = (p, ty) => { if (!AUD || p.role === 'GK') return; const g = p.team === 0 ? p.y - ty : ty - p.y; audN(`pass${p.team}_${g > 2 ? 'fwd' : g < -2 ? 'back' : 'flat'}`); };
const dash = (p, vx, vy, sec) => { p.dash = { vx, vy, until: G.t + sec }; };
// a TV cut: a short fade to black hides a re-position (restarts, kickoff, set pieces), so nobody ever jumps across the pitch in view
function cut(fn, ms = 480, keepPaused) {
  audN('cut'); const d = ms / FAST; G.fade = { t0: performance.now(), d }; G.paused = true; G.cutting = true; steer = null; touch = null;
  setTimeout(() => { if (G && !G.over) { fn(); G.afterCut = true; } }, d * .45);
  setTimeout(() => { if (!G) return; G.cutting = false; if (!keepPaused && !G.over && !G.plan) G.paused = false; }, d);
}
function halfTime() {                                        // the second half starts with their kickoff; everyone gets some breath back
  G.half = true; audN('halftime'); snd('whistle'); banner('HALF-TIME', 'small'); G.ball.vx = G.ball.vy = 0;
  cut(() => { for (const p of G.P) { p.en = Math.min(capOf(p), p.en + 25); p.runTo = null; p.dash = null; p.wind = null; } kickoff(1); }, 1400);
  later(.4, () => setHint('Half-time: everyone got their breath back (⚡+25). Their kickoff.', 3500));
}
// a pass into space: the chance is shown first (lane x accuracy x who gets there first); then rolled for real
function spaceChance(p, tx, ty) {
  const d = Math.hypot(tx - p.x, ty - p.y), lofted = d > 24, lane = AI.passSuccess(p, tx, ty, lofted);
  const tb = d / (lofted ? clamp(14 + d * .3, 16, 28) : clamp(11 + d * .6, 13, 24));
  let tUs = 1e9, tThem = 1e9, who = null;
  for (const q of G.P) { if (q === p || q.role === 'GK' || q.stun > 0) continue; const t = Math.hypot(q.x - tx, q.y - ty) / speedOf(q);
    if (q.team === p.team) { if (t < tUs) { tUs = t; who = q; } } else tThem = Math.min(tThem, t); }
  const race = clamp(.5 + (tThem - Math.max(tUs, tb)) * .45, .05, .95), acc = lofted ? 1 : clamp(1 - passErr(p, d) * .05, .55, 1);
  return { p: clamp(lane * race * acc, .03, .95), who, lofted, x: tx, y: ty };
}
function passSpace(p, tx, ty) {
  const sc = spaceChance(p, tx, ty);
  if (sc.lofted) return passLongTo(p, tx, ty, sc.who);
  const [jx, jy] = jitter(p, tx, ty, Math.hypot(tx - p.x, ty - p.y)), b = G.ball;
  passPoint(p, jx, jy);
  b.rolls = new Map(foes(p).map(q => [q, Math.random() < clamp(.2 + ((q.st.tackle || 8) - (p.st.pass || 9)) * .04, .05, .6)]));
  if (sc.who) sc.who.runTo = { x: jx, y: jy, until: G.t + 3 };
  p.en = Math.max(0, p.en - 3); G.lastPasser = p; pop(p.x, p.y - 2, 'INTO SPACE!', '#8fd8ff');
}
function shootNow(p) {
  G.userShot = true;
  const gk = keeperOf(1 - p.team), ch = clamp(shotChance(p, gk, false) - tiredPen(p), .03, .8), win = Math.random() < ch;
  const out = win ? 'goal' : distToGoal(p) > 24 && Math.random() < .5 ? 'miss' : Math.random() < .5 ? 'parry' : 'catch';
  p.en = Math.max(0, p.en - 6); pop(p.x, p.y - 2, `SHOT ${Math.round(ch * 100)}%`, '#fff');
  shoot(p, GX + (win ? (Math.random() < .5 ? -1 : 1) * rnd(1.6, 2.9) : rnd(-1.2, 1.2)), false, out);
}
function tackleNow(p) {
  const c = G.ball.owner; if (!c || c.team === p.team || dist(p, c) > 3.2) return;
  const ch = clamp(chance(p.st.tackle, c.st.dribble) - (dist(p, c) > 1.6 ? .1 : 0) - tiredPen(p) + tiredPen(c), .05, .9);
  p.en = Math.max(0, p.en - 10); p.vx += (c.x - p.x) * 2; p.vy += (c.y - p.y) * 2; G.tkCd = 1.2;
  if (Math.random() < ch) { own(p); c.stun = 1; burst(c.x, c.y, 12, '#c9b58a', 5); pop(p.x, p.y - 2, `WON IT! ${Math.round(ch * 100)}%`, '#ffd23f'); G.stat.free++; snd('win'); }
  else { p.stun = 1; pop(p.x, p.y - 2, `MISSED ${Math.round(ch * 100)}%`, '#ddd'); }
}

// ---------------------------------------------------------------- the director: natural decision moments, and forcing one if play drifts
function director() {
  const b = G.ball, c = G.ctrl, gap = G.since;
  if (b.shot) return;
  if (G.want) {                                               // PLAN: TAKE HIM ON / STOP HIM: the duel opens when they meet
    const w = G.want, ok = G.t < w.until && w.them.stun <= 0 && (w.kind === 'attack' ? b.owner === w.me : b.owner === w.them);
    if (!ok) G.want = null; else if (dist(w.me, w.them) < 2.4) { audN('plan_duel_' + w.kind); G.want = null; return openScene(w.kind, { me: w.me, them: w.them }); }
  }
  if (!G.finalDone && G.t > G.len - 13 && gap > 1.5) return finalScene();
  if (gap < (G.chain ? .7 : 4)) return;
  const calm = gap >= 11;
  if (b.owner === c && c.team === 0) {
    const near = foes(c).filter(q => q.role !== 'GK' && q.stun <= 0 && q.y < c.y + 1.5).sort((a, d) => dist(a, c) - dist(d, c));
    if (!G.fkDone && G.t > G.len * .42 && c === G.hero && c.y < 36 && c.y > 19 && Math.abs(c.x - GX) < 22 && near[0] && dist(near[0], c) < 3) return freeKick(near[0]);
    if (distToGoal(c) < 20 && angleOk(c) && (G.chain || gap >= 7)) { const fin = G.finalPass; G.finalPass = false; return openScene('shot', { me: c, them: keeperOf(1), final: fin }); }
    if (calm && near[1] && dist(near[0], c) < 2.8 && dist(near[1], c) < 6) return openScene('squeeze', { me: c, them: near[0], them2: near[1] });
    if ((calm || G.chain || G.tut) && near[0] && dist(near[0], c) < 2.6) return openScene('attack', { me: c, them: near[0] });
  }
  if (b.owner && b.owner.team === 1) {
    const car = b.owner;
    if ((distToGoal(car) < 22 || (car.aiShoot && distToGoal(car) < 28)) && angleOk(car) && G.t - (G.stealT || -9) > 2.5) { G.paused = true; G.since = 0; setTimeout(() => { if (G && !G.over) { G.paused = false; rivalShot(car, false); } }, 0); return; }
    if (calm && c.stun <= 0 && dist(c, car) < 2.4) return openScene('defend', { me: c, them: car });
  }
  if (gap > G.nextForce) {                                   // play drifted: bring the decision to the player
    if (b.owner && b.owner.team === 0) {
      const q = foes(b.owner).filter(q => q.role !== 'GK' && q.stun <= 0).sort((a, d) => dist(a, b.owner) - dist(d, b.owner))[0];
      if (q) q.press = true;                                  // the nearest defender comes to you (no teleports: he has to run)
    }
  }
}
function freeKick(fouler) {                                   // a foul on Kai near the box: free kick from the spot of the foul
  G.fkDone = true; const c = G.hero, x = c.x, y = c.y;
  pop(c.x, c.y - 2, 'FOUL!', '#ff6b6b'); snd('whistle'); own(c); c.vx = c.vy = 0;
  cut(() => {
    for (const p of G.P) { p.vx = p.vy = 0; p.runTo = null; p.dash = null; }
    const k = 9.15 / Math.hypot(GX - x, y) , wx = x + (GX - x) * k, wy = y - y * k;   // the wall: 9.15 m towards goal
    foes(c).filter(q => q.role === 'DF').forEach((q, i) => { q.x = wx + (i - 1.5) * 1.3; q.y = wy; });
    const mo = G.mo; mo.x = clamp(x + (x < GX ? 6 : -6), 4, W - 4); mo.y = y - 4;
    addSp(30);
  }, 700, true);
  setTimeout(() => { if (G && !G.over) { G.paused = false; openScene('freekick', { me: c, them: keeperOf(1), fouler }); } }, 900 / FAST);
}
function finalScene() {
  G.finalDone = true;
  const diff = G.score[0] - G.score[1];
  if (diff <= 0) {                                            // LAST CHANCE: the hero at the edge of the box, Spirit topped up for a special
    cut(() => { for (const q of foes(G.hero)) if (q.role !== 'GK') { q.y = Math.min(q.y, 30) + 6; q.stun = .5; }
      G.hero.x = GX + rnd(-6, 6); G.hero.y = 19; own(G.hero); G.ctrl = G.hero; G.sp = Math.max(G.sp, specCost()); banner('LAST CHANCE!', 'small'); }, 700, true);
    setTimeout(() => { if (G && !G.over) { G.paused = false; openScene('shot', { me: G.hero, them: keeperOf(1), final: true }); } }, 1300 / FAST);
  } else {                                                    // HOLD THE LEAD: their striker breaks through
    const fw = G.star && G.star.role === 'FW' ? G.star : G.P.find(p => p.team === 1 && p.role === 'FW');   // their star gets the breakaway
    cut(() => { fw.x = GX + rnd(-6, 6); fw.y = H - 21; own(fw);
      for (const q of G.P) if (q.team === 0 && q.role !== 'GK') q.y = Math.min(H - 12, Math.max(q.y, H - 34)); banner('HOLD THE LEAD!', 'small'); }, 700, true);
    setTimeout(() => { if (G && !G.over) { G.paused = false; rivalShot(fw, true); } }, 1300 / FAST);
  }
}

// ---------------------------------------------------------------- drawing
function draw() {
  const c = ctx, b = G.ball;
  const look = b.owner ? (b.owner.team === 0 ? -7 : 6) : 0, vw = (ROT ? CH : CW) / (S * G.cam.z), vh = (ROT ? CW : CH) / (S * G.cam.z);
  const pf = G.plan && (b.owner || G.ctrl), sf = !G.plan && G.paused && G.focus;
  let fxp = pf ? pf.x : sf ? G.focus.x : b.x, fyp = pf ? pf.y + vh * .14 : sf ? G.focus.y + vh * .2 : b.y + look;
  if (ROT && (pf || sf)) { fxp = (pf || G.focus).x + vw * (pf ? .14 : .2); fyp = (pf || G.focus).y; }   // keep the action above the bottom panel
  const tx = vw >= W ? GX : clamp(fxp, vw / 2 - 3, W - vw / 2 + 3), ty = clamp(fyp, vh / 2 - 8, H - vh / 2 + 8);
  G.cam.x = lerp(G.cam.x, tx, sf ? .15 : .08); G.cam.y = lerp(G.cam.y, ty, sf ? .15 : .08); G.cam.z = lerp(G.cam.z, G.plan ? .55 : 1, .15);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = G.shake > 0 ? G.shake * 18 : 0; c.translate(rnd(-sh, sh), rnd(-sh, sh));
  c.fillStyle = '#1d5e2c'; c.fillRect(-20, -20, CW + 40, CH + 40);
  c.save(); c.translate(CW / 2, CH / 2); if (ROT) c.rotate(Math.PI / 2); c.scale(S * G.cam.z, S * G.cam.z); c.translate(-G.cam.x, -G.cam.y);
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
  // pass targets for the buttons: P = short pass, L = long ball
  if (G.tg && !G.paused) for (const [q, l, col] of [[G.tg.s, 'P', '#ffd23f'], [G.tg.l, 'L', '#8fd8ff']]) if (q) {
    c.strokeStyle = col; c.lineWidth = .18; c.setLineDash([.5, .4]); c.beginPath(); c.arc(q.x, q.y, 1.9, 0, 7); c.stroke(); c.setLineDash([]);
    c.save(); upright(c, q.x, q.y); c.font = '1.2px Bangers, sans-serif'; c.textAlign = 'center'; c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = .25; c.strokeText(l, 1.9, 1.9); c.fillText(l, 1.9, 1.9); c.restore();
  }
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
    c.save(); upright(c, p.x + dx, p.y); c.translate(0, -bob); if (p.dive > .2) c.rotate((p.diveX - p.x > 0 ? 1 : -1) * p.dive * .9);
    c.drawImage(tk, -r, -r, r * 2, r * 2); c.restore();
    c.save(); upright(c, p.x, p.y);
    if (p.face || p === G.ctrl || p === G.star) {
      c.font = `${p === G.hero ? 1.15 : .95}px Bangers, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.team === 0 ? '#fff' : '#dfe8ff'; c.strokeStyle = '#000'; c.lineWidth = .25;
      const nm = (p === G.star ? '★ ' : '') + p.name.toUpperCase(); if (p === G.star) c.fillStyle = '#ffb36b'; c.strokeText(nm, 0, -r - .5); c.fillText(nm, 0, -r - .5);
    }
    if (p.wind) { const u = clamp(1 - (p.wind.t - G.t) / .65, 0, 1); c.strokeStyle = '#ff3b3b'; c.lineWidth = .28; c.beginPath(); c.arc(0, 0, r + 2.2 - 1.6 * u, 0, 7); c.stroke();
      const t = `⚠ TACKLE ${Math.round(p.wind.ch * 100)}%`; c.font = '1.25px Bangers, sans-serif'; c.textAlign = 'center'; const tw = c.measureText(t).width + .8, ty = -r - 2.6;
      c.fillStyle = 'rgba(0,0,0,.8)'; c.beginPath(); c.roundRect(-tw / 2, ty - 1.15, tw, 1.55, .4); c.fill(); c.fillStyle = '#ff5a5a'; c.fillText(t, 0, ty); }
    if (p.stun > 0) for (let i = 0; i < 3; i++) { const a = G.t * 6 + i * 2.1; c.fillStyle = '#ffd23f'; c.font = '.9px sans-serif'; c.fillText('★', Math.cos(a) * 1.2, -r - .2 + Math.sin(a) * .4); }
    c.restore();
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
    c.save(); upright(c, q.x, q.y); c.strokeStyle = '#000'; c.lineWidth = .3; c.strokeText(q.text, 0, -q.t * 1.5); c.fillStyle = q.col; c.fillText(q.text, 0, -q.t * 1.5); c.restore();
  }
  c.globalAlpha = 1; c.restore();
  // off-screen arrow to the goal we attack, so the player always knows the direction
  if (G.cam.y - vh / 2 > 4) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath();
    if (ROT) { const ay = CH / 2 + (GX - G.cam.x) * S * G.cam.z; c.moveTo(CW - 20, ay); c.lineTo(CW - 36, ay - 10); c.lineTo(CW - 36, ay + 10); }
    else { const ax = CW / 2 + (GX - G.cam.x) * S * G.cam.z; c.moveTo(ax, 64); c.lineTo(ax - 10, 80); c.lineTo(ax + 10, 80); } c.fill(); }
  if (touch && steer) {
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(touch.x0, touch.y0, 44, 0, 7); c.stroke();
    const sd = touch.dir || { x: 0, y: 0, k: 0 }; c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(touch.x0 + sd.x * 44 * sd.k, touch.y0 + sd.y * 44 * sd.k, 18, 0, 7); c.fill();
  }
  if (G.plan) drawPlan(ctx);
  if (G.fade) { const u = (performance.now() - G.fade.t0) / G.fade.d; if (u >= 1) G.fade = null; else { c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = `rgba(4,10,20,${u < .45 ? u / .45 : 1 - (u - .45) / .55})`; c.fillRect(0, 0, CW, CH); } }
  hud();
}
const STAT_ABBR = [['shoot', 'SHT'], ['dribble', 'DRI'], ['pass', 'PAS'], ['tackle', 'TKL'], ['speed', 'SPD'], ['stamina', 'STA']];
let hudT = 0;
function setBtn(id, show, label, far) { const b = $(id); if (show && !b.classList.contains('on')) b.onAt = performance.now(); b.classList.toggle('on', show); if (show) { b.classList.toggle('far', !!far); const sm = b.firstElementChild; if (sm.textContent !== label) sm.textContent = label; } }
function hud() {
  const now = performance.now();
  if (now - hudT > 120) {
    hudT = now;
    const p = G.ctrl, pl = $('pl'), b = G.ball, free = !G.paused && !G.goalAnim && !G.over && !b.shot && !G.tut && !CINE.on;
    pl.style.display = G.paused || CINE.on || G.over ? 'none' : 'flex';
    const f = $('plf');
    if (f.dataset.who !== p.name) { f.dataset.who = p.name; f.style.backgroundImage = p.face ? `url(img/face_${p.face}.jpg)` : 'none'; f.textContent = p.face ? '' : p.num; f.style.backgroundColor = p.face ? '#333' : '#e23b3b'; }
    $('pln').textContent = p.name.toUpperCase();
    $('pls').textContent = p.role === 'GK' ? `CATCH ${Math.round(p.st.catch)}` : STAT_ABBR.map(([k, a]) => `${a} ${Math.round(p.st[k] || 10)}`).join(' ');
    const e = Math.round(p.en), bar = $('ple').firstElementChild;
    bar.style.width = e + '%'; bar.style.background = e > 60 ? '#6dff8f' : e > 35 ? '#ffd23f' : '#ff6b5b';
    const cap = Math.round(capOf(p)), mode = p.eff || 'rest', rr = Math.abs(stamRate(p, mode)).toFixed(1);
    $('ple').style.background = `linear-gradient(to right, #ffffff22 ${cap}%, #ff5a4a66 ${cap}%)`;   // the red end = energy you can't get back any more
    const rate = mode === 'sprint' ? `▼ SPRINT −${rr}/s` : mode === 'run' ? `▼ running −${rr}/s` : e >= cap - 1 ? `● full (max ${cap})` : `▲ resting +${rr}/s`;
    const r = $('plr'); r.textContent = `⚡ ${e}  ${rate}${e < 45 ? ' · TIRED' : ''}`; r.style.color = mode === 'sprint' ? '#ff9b7a' : mode === 'run' ? '#ffe08a' : '#9dffb0';
    if (p === G.hero && e < 35 && !G.tiredSeen && free) { G.tiredSeen = true; setHint(`${p.name} is tired: slower and weaker. Let go of the stick to walk and rest, or pass.`, 4500); }
    const pb = $('bPlan'); pb.classList.toggle('on', (free || G.plan) && !G.over); pb.firstChild.textContent = G.plan ? '▶ PLAY' : '⏸ PLAN';
    const ours = free && b.owner === p && p.team === 0;
    G.tg = ours ? { s: stickyTarget('s', fwdFirst(p, AI.rankPass(p, 'pass')), now), l: stickyTarget('l', AI.rankPass(p, 'long'), now) } : null;
    const sp = G.tg && G.tg.s && (G.tgSel.sObj || {}).p;
    setBtn('bShoot', ours && distToGoal(p) < 34 && angleOk(p), `${Math.round(clamp(shotChance(p, keeperOf(1), false) - tiredPen(p), .03, .8) * 100)}%`);
    setBtn('bPass', ours && !!G.tg.s, G.tg && G.tg.s ? `→ ${G.tg.s.name}${sp ? ` ${Math.round(sp * 100)}%` : ''}` : '');
    setBtn('bLong', ours && !!G.tg.l, G.tg && G.tg.l ? `${G.tg.l.name} ${Math.round(longChance(p) * 100)}%` : '');
    const car = b.owner, near = free && car && car.team === 1 && p.team === 0 && p.role !== 'GK' && p.stun <= 0 && dist(p, car) < 7;
    setBtn('bTackle', near, near ? `${Math.round(clamp(chance(p.st.tackle, car.st.dribble) - (dist(p, car) > 1.6 ? .1 : 0) - tiredPen(p) + tiredPen(car), .05, .9) * 100)}%${dist(p, car) > 3.2 ? ' · closer!' : ''}` : '', near && dist(p, car) > 3.2);
  }
  $('sc').textContent = `${save.name} ${G.score[0]} - ${G.score[1]} ${G.opp.short}`;
  $('clock').textContent = `${Math.min(90, Math.floor(G.t / G.len * 90))}'`;
  const bar = $('sp').firstElementChild, cost = specCost(), ready = G.sp >= cost;
  bar.style.width = (G.sp / G.spMax * 100) + '%'; bar.classList.toggle('ready', ready);
  const wins = Math.ceil((cost - G.sp) / spGain());
  $('spt').textContent = ready ? 'SPECIAL READY!' : wins <= 1 ? '1 more win → SPECIAL' : `${wins} wins → SPECIAL`;
}
// the PASS / LONG target must not flicker between players while you decide: keep it for at least 0.9 s unless another is clearly better
function stickyTarget(k, list, now) {
  const sel = (G.tgSel = G.tgSel || {}), cur = sel[k], top = list[0]; if (!top) { sel[k] = null; return null; }
  const c = cur && list.find(o => o.q === cur.q);
  if (c && (now - cur.t < 900 || top.v - c.v < .08)) { sel[k + 'Obj'] = c; return c.q; }
  sel[k] = { q: top.q, t: now }; sel[k + 'Obj'] = top; return top.q;
}
// PASS goes forward whenever a forward pass has a fair chance (55%+); otherwise the safest good option (owner, 24 Nov)
function fwdFirst(p, list) {
  const gain = o => p.y - o.q.y, f = list.filter(o => gain(o) > 2 && o.p >= .55);
  return f.length ? [...f, ...list.filter(o => !f.includes(o))].map((o, i) => i ? o : { ...o, v: Math.max(o.v, list[0].v) }) : list;
}
const spGain = () => 9 * (1 + (save.stats.spirit - 10) * .04);

const armed = id => G && !G.paused && performance.now() - ($(id).onAt || 0) > 350 && G.t - (G.ownT || 0) > .3 * FAST;
$('bShoot').onclick = () => { const p = G && G.ctrl; if (p && G.ball.owner === p && armed('bShoot')) { shootNow(p); G.stat.free++; } };
$('bPass').onclick = () => { const p = G && G.ctrl; if (p && G.ball.owner === p && armed('bPass')) { const t = G.tg && G.tg.s; if (t) { pass(p, t); p.en = Math.max(0, p.en - 2); } } };
$('bLong').onclick = () => { const p = G && G.ctrl; if (p && G.ball.owner === p && armed('bLong')) { const t = G.tg && G.tg.l; if (t) passLong(p, t); } };
$('bTackle').onclick = () => { const p = G && G.ctrl; if (p && armed('bTackle')) tackleNow(p); };
let last = 0;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0) * FAST * PACE; last = now;
  if (G) { if (!G.paused) { step(dt); if (BOT) botFree(dt); } draw(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
