// Team AI: a utility AI with a short look-ahead (expected-value search), the usual approach for real-time sports games.
// Minimax needs alternating turns and a small move set; football here is continuous, 22 players, and every pass and tackle is a
// chance, so instead the ball carrier scores every option a few times a second:
//   value = P(it works) × value of the resulting position (one step deeper: what the receiver could then do, including a shot)
//         − P(it fails) × cost of losing the ball there (worse near your own goal).
// P(pass works) comes from geometry: defenders near the passing lane (or near the landing spot of a lofted ball) and their
// tackle skill against the passer's pass skill. Off the ball, the attacking team makes support runs into open space that
// opens passing lanes; the defending team presses the carrier and marks goal-side.
// "Game IQ" per team sets reaction time and how often a slightly worse option is picked: weaker teams think slower and err more.
'use strict';

const AI = (() => {
  const atkGoalY = team => team === 0 ? 0 : H, ownGoalY = team => team === 0 ? H : 0;
  const prog = (team, y) => team === 0 ? 1 - y / H : y / H;                 // 0 = own goal line, 1 = the goal you attack
  const iq = team => team === 1 ? (G.opp.iq || .7) : .8;
  const iqOf = p => p.team === 1 && p.face ? 1 : iq(p.team);     // named rivals (Bruno, later Ren and Sora) always play their best (owner, 24 Nov)
  function posValue(team, x, y) {
    const d = Math.hypot(x - GX, atkGoalY(team) - y);
    return .55 * prog(team, y) + Math.exp(-d / 15) - Math.max(0, Math.abs(x - GX) - 22) * .01;
  }
  function pressure(team, x, y) {                            // how crowded a spot is by the other team (0 = free)
    let s = 0;
    for (const f of G.P) if (f.team !== team && f.role !== 'GK' && f.stun <= 0) { const d = Math.hypot(f.x - x, f.y - y); if (d < 6) s += 1 - d / 6; }
    return s;
  }
  const lossCost = (team, y) => .25 + .6 * (1 - prog(team, y));
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1, t = clamp(((px - ax) * vx + (py - ay) * vy) / L, 0, 1);
    return [Math.hypot(px - ax - t * vx, py - ay - t * vy), t];
  }
  function passSuccess(p, tx, ty, lofted) {
    let ok = 1;
    for (const f of G.P) {
      if (f.team === p.team || f.role === 'GK' || f.stun > 0) continue;
      let ds, t;
      if (lofted) { ds = Math.hypot(f.x - tx, f.y - ty); t = 1; if (ds > 4) continue; }   // a lofted ball can only be won where it lands
      else { [ds, t] = segDist(f.x, f.y, p.x, p.y, tx, ty); if (ds > 3.2) continue; }
      const reach = (1 - ds / (lofted ? 4 : 3.2)) * (.35 + t * .3), skill = clamp(.6 + ((f.st.tackle ?? G.L) - (p.st.pass ?? G.L)) * .04, .25, .95);
      ok *= 1 - reach * skill;
    }
    const d = Math.hypot(tx - p.x, ty - p.y);
    ok *= lofted ? clamp(.5 + (rv(p, 'pass') - 10) * .04, .2, .88) + .12 : 1 - Math.max(0, d - 20) * .02;
    return clamp(ok, 0, 1);
  }
  function xg(q, x, y) {
    const d = Math.hypot(x - GX, atkGoalY(q.team) - y), gk = keeperOf(1 - q.team);
    const fake = { x, y, team: q.team }; if (d > 28 || !angleOk(fake)) return 0;
    const kd = keeperDown(gk);   // a keeper on the ground after a parry: they shoot on the rebound too
    return clamp(chance(q.st.shoot ?? G.L, (gk.st.catch ?? G.L) + 2.5) - Math.max(0, d - 13) * .018 - anglePen(fake) + kd, .03, .8 + kd / 2);
  }
  function holdValue(q, x, y) {                               // having the ball as q at (x, y): position, space, or the shot from there
    return Math.max(posValue(q.team, x, y) - pressure(q.team, x, y) * .18, xg(q, x, y) * 2.2);
  }
  function nearestTackle(p) { let best = G.L, bd = 1e9; for (const f of G.P) if (f.team !== p.team && f.role !== 'GK') { const d = dist(f, p); if (d < bd) { bd = d; best = f.st.tackle ?? G.L; } } return best; }
  function options(p) {
    const team = p.team, dir = team === 0 ? -1 : 1, out = [], tk = nearestTackle(p);
    for (const a of [-1.1, -.7, -.35, 0, .35, .7, 1.1]) {      // dribbles: 7 directions, 5 m
      const tx = clamp(p.x + Math.sin(a) * 5, 3, W - 3), ty = clamp(p.y + dir * Math.cos(a) * 5, 2, H - 2);
      const pr = pressure(team, (p.x + tx) / 2, (p.y + ty) / 2), keep = clamp(1 - pr * .32 * (1 + (tk - (p.st.dribble ?? G.L)) * .05), .05, 1);
      out.push({ kind: 'dribble', tx, ty, p: keep, v: keep * holdValue(p, tx, ty) - (1 - keep) * lossCost(team, p.y) });
    }
    for (const q of G.P) {                                    // passes and long balls to every teammate
      if (q.team !== team || q === p || q.role === 'GK' || q.stun > 0) continue;
      const d = dist(p, q); if (d < 4 || d > 50) continue;
      const lofted = d > 24, lx = q.x + q.vx * .5, ly = q.y + q.vy * .5, ps = passSuccess(p, lx, ly, lofted);
      const fwd = .45 * (prog(team, ly) - prog(team, p.y));   // football goes forward: a pass that gains ground is worth more, a back pass less
      const feed = team === 1 && q === G.star ? .15 : 0;      // their team looks for its star (owner, 24 Nov)
      out.push({ kind: lofted ? 'long' : 'pass', q, p: ps, v: ps * holdValue(q, lx, ly) - (1 - ps) * lossCost(team, (p.y + ly) / 2) - (lofted ? .03 : 0) + fwd + feed });
    }
    if (isWide(p)) for (const c of crossOpts(p))             // out wide near their box: a cross onto a man in the box (wing play, owner 26 Nov)
      out.push({ kind: 'cross', q: c.q, p: c.p, v: c.p * holdValue(c.q, c.x, c.y) * 1.15 - (1 - c.p) * lossCost(team, p.y) + .14 });
    const x = xg(p, p.x, p.y); if (x > 0) out.push({ kind: 'shoot', p: x, v: x * 2.2 + (1 - x) * .1 });
    out.push({ kind: 'hold', p: 1, v: holdValue(p, p.x, p.y) - .05 });
    return out;
  }
  function choose(p) {
    const noise = (1 - iqOf(p)) * .35; let best = null, bv = -1e9;
    for (const o of options(p)) { const v = o.v + (Math.random() + Math.random() - 1) * noise; if (v > bv) { bv = v; best = o; } }
    return best;
  }
  function carrier(p, dt) {                                   // the opponent with the ball
    p.think = (p.think || 0) - dt;
    if (p.think <= 0 || !p.plan) {
      p.think = .75 - .45 * iqOf(p) + rnd(.1);                 // reaction time: about 0.3 s (rival) to 0.6 s
      p.plan = choose(p); p.aiShoot = p.plan.kind === 'shoot';
      const settled = G.t - (G.ownT || 0) > .35;
      if (settled && p.plan.kind === 'pass') { pass(p, p.plan.q); G.stat.oppPasses = (G.stat.oppPasses || 0) + 1; p.plan = null; return; }
      if (settled && p.plan.kind === 'cross') { crossTo(p, p.plan.q); G.stat.oppPasses = (G.stat.oppPasses || 0) + 1; p.plan = null; return; }
      if (settled && p.plan.kind === 'long') { passLong(p, p.plan.q); G.stat.oppPasses = (G.stat.oppPasses || 0) + 1; p.plan = null; return; }
    }
    const pl = p.plan; if (!pl) return;
    if (pl.kind === 'dribble') moveTo(p, pl.tx, pl.ty, .9);
    else if (pl.kind === 'shoot') moveTo(p, lerp(p.x, GX, .3), p.y + (p.team === 1 ? 8 : -8), .9);
    else { p.vx *= .85; p.vy *= .85; }
  }
  function supportSpot(p, car) {                              // the best nearby spot to receive: forward, open, with a clear lane
    let [hx, hy] = shiftHome(p); if (p === G.star && p.team === 1) hy = Math.min(H - 8, hy + 4);   // the star runs further, into the box
    let best = [hx, hy], bv = -1e9;
    for (let i = 0; i < 9; i++) {
      const a = i * .785, r = i === 8 ? 0 : 6, x = clamp(hx + Math.cos(a) * r, 3, W - 3), y = clamp(hy + Math.sin(a) * r, 3, H - 3);
      const v = posValue(p.team, x, y) * .8 + passSuccess(car, x, y, Math.hypot(x - car.x, y - car.y) > 24) * .6 - pressure(p.team, x, y) * .25;
      if (v > bv) { bv = v; best = [x, y]; }
    }
    return best;
  }
  function assignJobs() {                                     // the defending team: 1-2 press the carrier, the rest mark goal-side
    const car = G.ball.owner; G.jobs = new Map(); if (!car) return;
    const team = 1 - car.team, nPress = team === 1 ? (iq(1) > .75 ? 2 : 1) : (G.pressT > G.t ? 2 : PLAN.tactic === 'att' ? 1 : 0);   // our controlled player presses too
    const defs = G.P.filter(q => q.team === team && q.role !== 'GK' && q !== G.ctrl && q.stun <= 0).sort((a, c) => dist(a, car) - dist(c, car));
    defs.slice(0, nPress).forEach(d => G.jobs.set(d, 'press'));
    for (const d of defs.slice(nPress)) if (d.face && team === 1 && dist(d, car) < 12) G.jobs.set(d, 'press');   // a rival never lets you pass him easily
    const attackers = G.P.filter(q => q.team === car.team && q !== car && q.role !== 'GK'), taken = new Set();
    for (const d of defs.slice(nPress)) {
      const [hx, hy] = shiftHome(d); let best = null, bd = 16;
      for (const a of attackers) { if (taken.has(a)) continue; const dd = Math.hypot(a.x - hx, a.y - hy); if (dd < bd) { bd = dd; best = a; } }
      if (best) { taken.add(best); G.jobs.set(d, best); }
    }
  }
  function offBall(p, dt) {
    const b = G.ball, car = b.owner;
    if (!car) {                                               // loose ball: the nearest player of each team goes for it
      const near = G.P.filter(q => q.team === p.team && q.role !== 'GK' && q !== G.ctrl).sort((a, c) => dist(a, b) - dist(c, b))[0];
      if (p === near) return moveTo(p, b.x + b.vx * .3, b.y + b.vy * .3, .95);
      const [x, y] = shiftHome(p); return moveTo(p, x, y, .7);
    }
    if (car.team === p.team) {                                // support run
      p.spotT = (p.spotT || 0) - dt;
      if (p.spotT <= 0 || !p.spot) { p.spotT = rnd(.8, 1.3); p.spot = supportSpot(p, car); }
      const behind = (p.team === 0 ? p.y - p.spot[1] : p.spot[1] - p.y) > 4;   // a forward run to get ahead of the ball is run hard
      return moveTo(p, p.spot[0], p.spot[1], p.en < 30 ? .5 : behind ? .95 : .75);
    }
    const job = G.jobs && G.jobs.get(p);
    if (job === 'press') return moveTo(p, car.x, car.y + (p.team === 1 ? -1 : 1), .98);
    if (job) { const g = ownGoalY(p.team), dx = GX - job.x, dy = g - job.y, d = Math.hypot(dx, dy) || 1; return moveTo(p, job.x + dx / d * 2.2, job.y + dy / d * 2.2, p.en < 30 ? .6 : .85); }
    const [x, y] = shiftHome(p); moveTo(p, x, y, p.en < 40 ? .5 : .7);   // nothing to do: a tired player walks back into shape and recovers
  }
  function rankPass(p, kind) { return options(p).filter(o => o.kind === kind).sort((a, c) => c.v - a.v); }
  function bestPass(p, kind) { let best = null, bv = -1e9; for (const o of options(p)) if (o.kind === kind && o.v > bv) { bv = o.v; best = o.q; } return best; }
  return { carrier, offBall, assignJobs, bestPass, rankPass, options, passSuccess, iqOf, pressure };
})();
