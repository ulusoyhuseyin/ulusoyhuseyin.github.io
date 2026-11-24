// Decision scenes and the clash (DESIGN §4 + research rules R1–R3, R9 in §13).
// Every option shows its real win chance. The clash builds the wait (power count-up + timing ring), then reveals.
// The timing ring adds +15 points on PERFECT, +7 on GOOD; the feedback about early/late is computed from the real tap.
'use strict';

const chance = (a, b, k = .035) => clamp(.5 + (a - b) * k, .08, .92);
function shotChance(p, gk, special) {
  const d = distToGoal(p);
  let c = chance(p.st.shoot, gk.st.catch + 2.5) - Math.max(0, d - 13) * .018 - anglePen(p) + (save.style === 'striker' && p === G.hero ? .05 : 0);
  if (special) c += .3;
  return clamp(c, .08, special ? .9 : .8);
}
const EN = { dribble: 14, dribble2: 20, onetwo: 6, tokai: 4, back: 0, longshot: 6, comet: 18, needle: 10, shoot: 6, curl: 6, square: 4, shortmo: 4, tackle: 12, clamp: 16, block: 7, hold: 0, dive: 0, rush: 0, slide: 10 };
function bonuses(o, actor) {                                 // visible boosts and penalties: ZONE, "fighting spirit" after two lost clashes in a row, TIRED
  let add = 0; const tags = [];
  const tp = actor ? tiredPen(actor) : 0; if (tp > .005) { add -= tp; tags.push(`TIRED −${Math.round(tp * 100)}`); }
  if (G.zone > 0) { add += .1; tags.push('ZONE +10'); }
  if (G.lossRun >= 2) { add += .05; tags.push('SPIRIT +5'); }
  o.ch = clamp(o.ch + add, .05, o.special ? .95 : .92); o.tags = tags; return o;
}
const RING_BONUS = { perfect: .15, good: .07, miss: 0 };

// ---------------------------------------------------------------- building the scene
function openScene(kind, cx) {
  if (!G || G.paused || G.over) return;
  G.paused = true; steer = null; touch = null; G.want = null; for (const q of G.P) q.wind = null;
  G.focus = { x: (cx.me.x + cx.them.x) / 2, y: (cx.me.y + cx.them.y) / 2 };
  const me = cx.me, them = cx.them, opts = [], cost = specCost(), sp = G.sp;
  const hero = me === G.hero, mo = G.mo, gk = keeperOf(1);
  let title = '', sub = '', hint = '';
  const add = o => { o.en = EN[o.key] || 0; opts.push(o.noRoll || o.tut ? o : bonuses(o, o.def || me)); };
  if (kind === 'attack' || kind === 'squeeze') {
    const hard = kind === 'squeeze' ? Math.max(them.st.tackle, cx.them2.st.tackle) : them.st.tackle;
    title = kind === 'squeeze' ? 'TWO DEFENDERS!' : `${them.name.toUpperCase()} CLOSES IN!`; sub = `${me.name} DRI ${Math.round(me.st.dribble)} vs TKL ${Math.round(them.st.tackle)}`;
    if (G.tut === 1) {
      add({ key: 'dribble', name: 'DRIBBLE', sub: `past ${them.name} · tutorial`, ch: 1, kind: 'duel', tut: true });
      hint = 'Pick a move. The big number is your chance to win it.';
    } else {
      if (kind === 'squeeze') add({ key: 'dribble2', name: 'DRIBBLE BOTH', sub: 'risky · lands you in the box', ch: chance(me.st.dribble, hard + 3), kind: 'duel', big: true });
      else add({ key: 'dribble', name: 'DRIBBLE', sub: `past ${them.name} · big gain`, ch: chance(me.st.dribble, them.st.tackle), kind: 'duel', big: true });
      if (hero && mo.stun <= 0) add({ key: 'onetwo', name: 'ONE-TWO · MO', sub: 'safer · gains less ground', ch: chance(me.st.pass + 3 + (save.style === 'playmaker' ? 1.5 : 0), them.st.tackle * .4 + them.st.speed * .4 + 2 + (kind === 'squeeze' ? 1.5 : 0)), kind: 'duel' });
      else if (!hero) add({ key: 'tokai', name: `PASS → ${save.name}`, sub: 'find your striker', ch: chance(me.st.pass + 3, them.st.tackle * .4 + them.st.speed * .4 + 2), kind: 'duel' });
      if (kind === 'squeeze') add({ key: 'back', name: 'BACK PASS', sub: 'safe · start again', noRoll: true, cls: 'safe' });
      else if (distToGoal(me) < 32 && angleOk(me)) add({ key: 'longshot', name: 'LONG SHOT', sub: `from ${Math.round(distToGoal(me))} m`, ch: shotChance(me, gk, false), kind: 'shot' });
      if (hero && distToGoal(me) < 30 && angleOk(me)) add({ key: 'comet', name: 'COMET DRIVE!', sub: `special shot · ${cost} spirit`, ch: shotChance(me, gk, true), kind: 'shot', special: 'comet', cost, cls: 'sp' });
      if (hero && save.style === 'playmaker') add({ key: 'needle', name: 'NEEDLE PASS!', sub: `special · sends Mo 1-on-1 · ${cost} spirit`, ch: chance(me.st.pass + 10, hard), kind: 'duel', special: 'needle', cost, cls: 'sp' });
      if (them.name === 'Bruno') hint = 'Bruno wins plain dribbles. Go around him: ONE-TWO, or a special.';
      else if (kind === 'squeeze') hint = 'Two of them. Risky move or safe reset?';
    }
  } else if (kind === 'shot' || kind === 'freekick') {
    title = cx.final ? 'LAST CHANCE!' : kind === 'freekick' ? 'FREE KICK!' : `1 ON 1 VS ${them.name.toUpperCase()}!`;
    sub = kind === 'freekick' ? 'the wall is set' : `keeper ${them.name} · catch ${Math.round(them.st.catch)}`;
    if (G.tut === 2) {
      add({ key: 'comet', name: 'COMET DRIVE!', sub: 'your special shot · tutorial', ch: 1, kind: 'shot', special: 'comet', cost: 0, cls: 'sp pulse', tut: true });
      add({ key: 'shoot', name: 'SHOOT', sub: 'normal shot', ch: shotChance(me, them, false), kind: 'shot' });
      hint = 'Your Spirit is full. Unleash a special!';
    } else {
      if (kind === 'freekick') {
        add({ key: 'curl', name: 'CURL IT', sub: 'over the wall', ch: shotChance(me, them, false) + .04, kind: 'shot' });
        add({ key: 'shortmo', name: 'SHORT TO MO', sub: 'then you pick Mo\'s shot', ch: clamp(AI.passSuccess(me, mo.x, mo.y, false), .3, .92), kind: 'duel', mate: mo });
      } else {
        add({ key: 'shoot', name: 'SHOOT', sub: `from ${Math.round(distToGoal(me))} m`, ch: shotChance(me, them, false), kind: 'shot' });
        const mate = hero ? mo : G.hero;
        if (mate.stun <= 0 && dist(mate, me) < 22 && distToGoal(mate) < 24) add({ key: 'square', name: `PASS → ${mate === mo ? 'MO' : save.name}`, sub: `then you pick ${mate === mo ? 'his' : 'your'} shot`, ch: clamp(AI.passSuccess(me, mate.x, mate.y, false), .2, .92), kind: 'duel', mate });
      }
      if (hero) add({ key: 'comet', name: 'COMET DRIVE!', sub: `special shot · ${cost} spirit`, ch: shotChance(me, them, true), kind: 'shot', special: 'comet', cost, cls: 'sp' + (sp >= cost ? ' pulse' : '') });
      hint = them.name === 'Holt' ? 'Holt is a big keeper. Specials beat keepers.' : cx.final ? 'The last kick of the match.' : '';
    }
  } else if (kind === 'defend') {
    title = `STOP ${them.name.toUpperCase()}!`; sub = `${me.name} TKL ${Math.round(me.st.tackle)} vs DRI ${Math.round(them.st.dribble)}`;
    add({ key: 'tackle', name: 'TACKLE', sub: 'win the ball · big gain', ch: chance(me.st.tackle, them.st.dribble), kind: 'duel', big: true });
    add({ key: 'block', name: 'BLOCK', sub: 'safer · knocks it loose', ch: chance(me.st.tackle + 4, them.st.dribble), kind: 'duel' });
    add({ key: 'hold', name: 'HOLD', sub: 'stay goal-side · no risk now', noRoll: true, cls: 'safe' });
    if (me === G.hero && save.style === 'engine') add({ key: 'clamp', name: 'IRON CLAMP!', sub: `special tackle · ${cost} spirit`, ch: chance(me.st.tackle + 10, them.st.dribble), kind: 'duel', special: 'clamp', cost, cls: 'sp' });
  } else if (kind === 'save') {
    const gkp = me, def = G.P.filter(q => q.team === 0 && q.role === 'DF' && q.stun <= 0).sort((a, b) => dist(a, them) - dist(b, them))[0];
    title = cx.rival ? `${cx.rival.name}!` : cx.final ? 'HOLD THE LEAD!' : `${them.name.toUpperCase()} SHOOTS!`; sub = `${gkp.name} in goal${cx.rival ? ` · ${them.name}'s special` : ''}`;
    const rp = cx.rival ? cx.rival.pen : 0;
    add({ key: 'dive', name: 'DIVE!', sub: `${gkp.name} goes for it`, ch: chance(gkp.st.catch, them.st.shoot) - rp, kind: 'save' });
    add({ key: 'rush', name: 'RUSH OUT', sub: 'risky · a save starts a counter', ch: chance(gkp.st.catch - 2, them.st.dribble) - rp, kind: 'save', big: true });
    if (def && dist(def, them) < 12) add({ key: 'slide', name: `${def.name.toUpperCase()} SLIDES`, sub: 'block before the shot', ch: chance(def.st.tackle, them.st.shoot + 1), kind: 'duel', def });
    hint = cx.rival ? `A rival special: −${Math.round(rp * 100)}% to save it. Nail the ring!` : 'Their shot! Your keeper needs you.';
  }
  for (const o of opts) if (o.cost && sp < o.cost) o.disabled = true;
  showScene(kind, cx, title, sub, hint, opts);
}
function faceDiv(el, p) {
  el.className = 'f' + (p.team === 1 ? ' them' : '');
  if (p.face) { el.style.background = `#222 url(img/face_${p.face}.jpg) center/cover`; el.textContent = ''; }
  else { el.style.backgroundImage = 'none'; el.classList.add('gen'); el.textContent = p.num; el.style.background = p.team === 0 ? (p.role === 'GK' ? '#b08a00' : '#e23b3b') : (p.role === 'GK' ? '#333' : G.opp.col); }
  el.style.borderColor = p.team === 0 ? '#e23b3b' : (p.face ? '#8fd8ff' : '#ccd');
}
function showScene(kind, cx, title, sub, hint, opts) {
  const me = cx.me, en = me.role === 'GK' ? '' : ` · ⚡${Math.round(me.en)}${me.en < 40 ? ' TIRED' : ''}`;
  $('st').innerHTML = `${title}<small>${sub}${en}</small>`; $('shint').textContent = hint || '';
  faceDiv($('fl'), cx.me); faceDiv($('fr'), cx.them);
  const box = $('scene'), row = $('opts'); row.innerHTML = '';
  for (const o of opts) {
    const b = document.createElement('button'); b.className = o.cls || ''; b.disabled = !!o.disabled;
    const pc = o.noRoll ? '' : Math.round(o.ch * 100) + '%', col = o.ch >= .65 ? '#7dff9a' : o.ch >= .45 ? '#ffd23f' : '#ff8a7a';
    b.innerHTML = `<span class="n">${o.name}</span>${o.noRoll ? '<span class="p" style="color:#9fe">SAFE</span>' : `<span class="p" style="color:${col}">${pc}</span>`}` +
      `<small>${o.sub}${o.en ? ` · <b style="color:#9dffb0">⚡−${o.en}</b>` : o.key === 'hold' ? ' · <b style="color:#9dffb0">⚡+10</b>' : ''}${(o.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}${o.disabled ? ` · need ${o.cost}` : ''}</small>` +
      (o.noRoll ? '' : `<i class="bar" style="width:${o.ch * 100}%;color:${col}"></i>`);
    b.onclick = () => { if (box.dataset.busy) return; box.dataset.busy = '1'; choose(kind, cx, o); };
    row.appendChild(b);
  }
  delete box.dataset.busy; box.classList.add('on');
  $('pl').style.display = 'none'; document.querySelectorAll('#acts button, #bPlan').forEach(b => b.classList.remove('on'));
  G.sceneOpen = performance.now();
  if (BOT) setTimeout(() => { const ok = opts.filter(o => !o.disabled); const o = ok.find(x => x.special && Math.random() < .7) || pick(ok); if (G && G.paused && !box.dataset.busy) { box.dataset.busy = '1'; choose(kind, cx, o); } }, 300 / FAST);
}

// ---------------------------------------------------------------- choosing → clash → consequence
async function choose(kind, cx, o) {
  $('scene').classList.remove('on');
  const st = G.stat, me = cx.me, them = cx.them; audN('opt_' + o.key);
  st.dec++; st.kinds[kind] = (st.kinds[kind] || 0) + 1; st.gaps.push(Math.round(G.since * 10) / 10); st.think = (st.think || 0) + (performance.now() - G.sceneOpen) / 1000;
  if (o.cost) G.sp -= o.cost;
  const actor = o.def || me; if (o.en) actor.en = Math.max(0, actor.en - o.en); if (o.key === 'hold') me.en = Math.min(100, me.en + 10);
  let win = true, q = 'miss';
  if (!o.noRoll) {
    st.chances.push(Math.round(o.ch * 100));
    const r = await clash(o, o.def || me, them);
    q = r.q; win = r.win;
    if (q === 'perfect') st.perfect++; else if (q === 'good') st.good++;
    if (win) { st.won++; if (o.ch < .5) st.upset++; addSp(spGain() + (q === 'perfect' ? 4 : 0)); G.streak++; G.lossRun = 0; }
    else { st.lost++; addSp(3); G.streak = 0; G.lossRun++; if (G.zone > 0) { G.zone = 0; $('zone').classList.remove('on'); } }
    if (win && G.streak >= 3 && !G.zone && o.kind !== 'save') { G.zone = 15; $('zone').classList.add('on'); setTimeout(() => banner('ZONE!'), 50); snd('level'); }
  }
  if (!G) return;
  G.chain = false;
  await consequence(kind, cx, o, win);
  if (!G) return;
  G.since = 0; G.nextForce = rnd(12, 15);
  G.paused = false;
}
async function playSpecial(o) {
  if (!G) return;
  G.stat.specials++;
  const first = !save.seenCut; save.seenCut = (save.seenCut || 0) + 1; store();
  const short = !first && !BOT, dur = first ? 2.6 : 1.4;
  if (o.special === 'comet') await techDFull('COMET DRIVE', !first && !BOT);   // long version with face shots (owner 24 Nov); shorten later
  else if (o.special === 'clamp') await techFX('IRON CLAMP', 'kai', ['#e8f8ff', '#5ab8ff', '#0e2c55'], first ? 1.8 : 1.2, short);
  else if (o.special === 'needle') await techFX('NEEDLE PASS', 'kai', ['#fffbd0', '#9dff7a', '#0f3d1f'], first ? 1.8 : 1.2, short);
}
const aimFor = out => GX + (out === 'goal' ? (Math.random() < .5 ? -1 : 1) * rnd(1.6, 2.9) : rnd(-1.2, 1.2));
async function consequence(kind, cx, o, win) {
  const me = cx.me, them = cx.them, b = G.ball;
  switch (o.key) {
    case 'dribble': case 'dribble2': {
      const dir = me.x < them.x ? -1 : 1;
      if (win) {
        const foesBeaten = o.key === 'dribble2' ? [them, cx.them2] : [them];
        foesBeaten.forEach(f => { f.stun = 1.8; burst(f.x, f.y, 12, '#fff', 5); });
        me.ghost = 1; dash(me, dir * 3.5, o.key === 'dribble2' ? -15 : -9, .5); G.chain = true;
        pop(me.x, me.y - 2, o.key === 'dribble2' ? 'THROUGH BOTH!' : 'PAST HIM!', '#ffd23f');
        if (G.tut === 1) { G.tut = 2; G.sp = G.spMax; setHint('Run at goal! The keeper is next.'); }
      } else {
        const rs = RIVAL_SP[them.name], used = (G.rivalUsed = G.rivalUsed || {});
        if (rs && !rs.pen && (used[them.name] || 0) < 2) { used[them.name] = (used[them.name] || 0) + 1; await techFX(rs.name, rs.face, rs.cols, 1.2, false); if (!G) return; }
        own(them); me.stun = 1.1; burst(me.x, me.y, 14, '#c9b58a', 4); pop(them.x, them.y - 2, them.name === 'Bruno' ? 'THE WALL!' : 'STOLEN!', '#ff6b6b');
      }
      break;
    }
    case 'onetwo': {
      if (win) { them.stun = 1.4; G.oneTwo = { tx: clamp(me.x + rnd(-4, 4), 8, W - 8), ty: Math.max(14, me.y - 13) }; pass(me, G.mo, true); pop(me.x, me.y - 2, 'ONE-TWO!', '#ffd23f');
        if (Math.random() < .35) toast('mo', 'MO', pick(['Go, Kai!', 'Here it comes!', 'Nice one!'])); }
      else { own(them); pop(them.x, them.y - 2, 'INTERCEPTED', '#ff6b6b'); me.stun = .6; }
      break;
    }
    case 'tokai': {
      if (win) { them.stun = 1.2; pass(me, G.hero, true); } else { own(them); pop(them.x, them.y - 2, 'INTERCEPTED', '#ff6b6b'); }
      break;
    }
    case 'back': { const t = G.P.filter(q => q.team === 0 && q.role === 'DF').sort((a, c) => dist(a, me) - dist(c, me))[0]; pass(me, t, true); break; }
    case 'longshot': case 'shoot': case 'curl': case 'comet': {
      const out = win ? 'goal' : (o.key === 'longshot' ? (Math.random() < .5 ? 'miss' : 'catch') : (Math.random() < .55 ? 'parry' : 'catch'));
      if (o.special) await playSpecial(o);
      if (!G) return;
      if (o.tut) { G.tut = 0; }
      G.afterShot = null;
      shoot(me, aimFor(out), !!o.special, out);
      if (cx.final) G.len = Math.min(G.len, G.t + 3);
      if (G.tutJustEnded === undefined && save.match === 1 && !G.tut) { G.tutJustEnded = true; G.afterGoal = () => { later(1.5, () => toast('ren', 'REN', 'Not bad... for an amateur.', 3600)); later(6, () => setHint('Tip: tap ⏸ PLAN (or Space) any time to stop the clock and plan.', 5000)); }; G.afterShot = () => later(1.5, () => toast('ren', 'REN', 'Hmph. Is that all, amateur?', 3600)); }
      break;
    }
    case 'square': case 'shortmo': {                          // a real pass: the mate receives it where he is, then the shot is your next decision
      const mate = o.mate || G.mo;
      if (win) { pass(me, mate, true); G.chain = true; G.finalPass = !!cx.final; }
      else { passCut(me, mate); if (cx.final) G.len = Math.min(G.len, G.t + 4); }
      break;
    }
    case 'needle': {
      await playSpecial(o);
      if (!G) return;
      if (win) { const mo = G.mo, tx = clamp(lerp(mo.x, GX, .5), 10, W - 10), ty = clamp(Math.min(mo.y - 8, 18), 16, 40);
        for (const f of foes(mo)) if (f.role !== 'GK') f.stun = 2.4;
        passPoint(me, tx, ty); G.ball.rolls = new Map(); mo.runTo = { x: tx, y: ty, until: G.t + 4 }; G.chain = true; pop(me.x, me.y - 2, 'NEEDLE PASS!', '#9dff7a'); }
      else { own(them); pop(them.x, them.y - 2, 'READ IT!', '#ff6b6b'); }
      break;
    }
    case 'tackle': case 'clamp': case 'slide': {
      const actor = o.def || me;
      if (o.special) await playSpecial(o);
      if (!G) return;
      if (win) { own(actor); them.stun = 1.6; burst(them.x, them.y, o.special ? 30 : 14, o.special ? '#9fd3ff' : '#c9b58a', o.special ? 9 : 5); pop(actor.x, actor.y - 2, o.special ? 'IRON CLAMP!' : 'WON IT!', '#ffd23f'); G.stat.tackles = (G.stat.tackles || 0) + 1; }
      else { actor.stun = 1.2; dash(them, 0, 6, .45); them.ghost = .5; pop(them.x, them.y - 2, 'BEATEN', '#ff6b6b'); }
      break;
    }
    case 'block': {
      if (win) { b.owner = null; b.vx = rnd(-8, 8); b.vy = rnd(-9, -4); b.noPick = them; b.noPickT = .5; them.stun = .8; pop(me.x, me.y - 2, 'BLOCKED!', '#ffd23f'); }
      else { const out = mates(them).filter(q => q.role !== 'GK').sort((a, c) => c.y - a.y)[0]; pass(them, out); me.stun = .5; }
      break;
    }
    case 'hold': { dash(me, 0, 6, .45); G.chain = false; break; }
    case 'dive': case 'rush': {
      const out = win ? (o.key === 'rush' ? 'catch' : (Math.random() < .5 ? 'catch' : 'parry')) : 'goal';
      shoot(them, aimFor(out), false, out);
      if (win && o.key === 'rush') G.afterShot = () => later(.4, () => { if (G.ball.owner === me) { const h = G.hero; if (dist(me, h) > 24) passLong(me, h); else pass(me, h, true); pop(me.x, me.y - 2, 'COUNTER!', '#ffd23f'); } });
      if (cx.final) G.len = Math.min(G.len, G.t + 3);
      break;
    }
  }
  if (kind === 'save' && o.key === 'slide' && cx.final) G.len = Math.min(G.len, G.t + 3);
}
function setHint(t, ms = 3500) { const h = $('hint'); h.textContent = t; h.style.opacity = 1; clearTimeout(setHint.t); setHint.t = setTimeout(() => h.style.opacity = 0, ms); }
function toast(face, name, text, ms = 3000) {
  const el = $('toast'); el.querySelector('img').src = `img/face_${face}.jpg`; el.querySelector('b').textContent = name; el.querySelector('span').textContent = text;
  el.querySelector('img').style.borderColor = face === 'ren' ? '#8fd8ff' : face === 'bruno' ? '#aab' : face === 'ito' ? '#3c9' : '#e23b3b';
  el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms);
}

// ---------------------------------------------------------------- the clash: split faces, power count-up, timing ring, then the reveal
function faceArt(p) { return p.face ? IMG['face_' + p.face] : null; }
function clash(o, me, them) {
  const tut = !!o.tut, T = tut ? 1.7 : G.m >= 2 ? .95 : 1.1, shot = o.kind === 'shot';
  const firstRings = (save.rings || 0) < 2; save.rings = (save.rings || 0) + 1;
  return new Promise(res => {
    let tapAt = null, q = null, msg = '', win = null, numMe = 0, numThem = 0, fin = null, t0 = performance.now(), done = false, played = false;
    const onTap = e => { if (tapAt === null && !done) { tapAt = (performance.now() - t0) / 1000; e.preventDefault(); } };
    addEventListener('pointerdown', onTap, true);
    const onKey = e => { if (['Space', 'Enter', 'KeyK', 'KeyJ'].includes(e.code)) { e.stopPropagation(); onTap(e); } }; addEventListener('keydown', onKey, true);
    const botTap = BOT ? rnd(.55, 1) * T : null;
    snd('swoosh');
    const f = now => {
      const t = (now - t0) / 1000; if (BOT && tapAt === null && t >= botTap) tapAt = botTap;
      const c = fx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, CW, CH);
      const portrait = CH > CW, R = Math.min(CW, CH) * .11, cx = CW / 2, cy = CH * (portrait ? .5 : .52);
      const ringR = t => R * (3 - 2.6 * Math.min(t, T) / T);    // reaches the target circle at 77% of T
      // resolve the tap
      if (q === null && (tapAt !== null || t > T)) {
        if (tapAt === null) { q = 'miss'; msg = 'MISSED THE RING'; }
        else { const err = ringR(tapAt) / R - 1;               // >0 = early, <0 = late
          if (Math.abs(err) <= .12) { q = 'perfect'; msg = 'PERFECT!'; snd('perfect'); buzz(25); }
          else if (Math.abs(err) <= .32) { q = 'good'; msg = err > 0 ? 'GOOD · a bit early' : 'GOOD · a bit late'; snd('good'); }
          else { q = 'miss'; msg = err > 0 ? 'TOO EARLY' : 'TOO LATE'; } }
        const p = clamp(o.ch + RING_BONUS[q], 0, 1); win = tut ? true : Math.random() < p;
        const base = 40 + p * 55 + rnd(-4, 4), other = 40 + (1 - p) * 55 + rnd(-4, 4);
        let a = Math.round(base), b = Math.round(other); if (win && a <= b) a = b + Math.round(rnd(2, 9)); if (!win && b <= a) b = a + Math.round(rnd(2, 9));
        fin = { a, b, t: t };
      }
      const k0 = easeOut(Math.min(1, t / .18));
      c.fillStyle = `rgba(0,0,0,${.6 * k0})`; c.fillRect(0, 0, CW, CH);
      // the two sides: me from the left (top band), them from the right (bottom band)
      const bandH = portrait ? CH * .26 : CH * .34, sk = CW * .06;
      for (const side of [0, 1]) {
        const p = side ? them : me, y = side ? (portrait ? CH * .68 : CH * .62) : (portrait ? CH * .06 : CH * .04), off = (1 - k0) * (side ? CW : -CW);
        const pts = [off - 10, y + sk, off + CW + 10, y, off + CW + 10, y + bandH - sk, off - 10, y + bandH];
        c.save(); panel(c, pts); c.clip();
        c.fillStyle = side ? (p.team === 1 ? '#18283a' : '#3a1414') : '#3a1414'; c.fillRect(0, y - 20, CW, bandH + 40);
        const img = faceArt(p);
        const fw = Math.min(bandH * 1.05, CW * .45), fxp = side ? off + CW - fw - CW * .04 : off + CW * .04;
        if (img && img.ok) drawArtIn(c, img, fxp, y + (bandH - fw) / 2, fw, fw, [.5, .45], 1.0, false);
        else { const tk = token(p.face, p.team === 0 ? '#e23b3b' : (p.role === 'GK' ? G.opp.gk : G.opp.col), String(p.num), p.team === 0 ? '#e23b3b' : (p.role === 'GK' ? '#555' : G.opp.col)); c.drawImage(tk, fxp, y + (bandH - fw) / 2, fw, fw); }
        focusLines(c, side ? CW * .25 : CW * .75, y + bandH / 2, 14, bandH * .3, '#fff', .12);
        c.restore();
        c.save(); panel(c, pts); c.lineWidth = 5; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 2; c.strokeStyle = side ? '#8fd8ff' : '#ff5a4a'; c.stroke(); c.restore();
        // name + power number
        const tx = side ? off + CW * .06 : off + CW * .94, al = side ? 'left' : 'right';
        c.textAlign = al; c.font = `${Math.min(30, CW * .07)}px Bangers, sans-serif`; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
        const nm = side && o.kind === 'save' ? them.name.toUpperCase() : p.name.toUpperCase();
        c.strokeText(nm, tx, y + bandH * .32); c.fillText(nm, tx, y + bandH * .32);
        let n;
        if (fin) { const u = clamp((t - fin.t) / .35, 0, 1); n = Math.round(lerp(side ? numThem : numMe, side ? fin.b : fin.a, u)); }
        else { n = Math.round(Math.min(t / T, 1) * (side ? 55 : 60) + Math.sin(t * 30 + side) * 3); side ? (numThem = n) : (numMe = n); }
        const hide = shot && side;                              // a shot's result is revealed by the ball, not the number
        c.font = `${Math.min(64, CW * .15)}px Bangers, sans-serif`; c.lineWidth = 7;
        c.fillStyle = side ? '#8fd8ff' : '#ffd23f'; const txt = hide ? '?' : String(Math.max(0, n));
        c.strokeText(txt, tx, y + bandH * .78); c.fillText(txt, tx, y + bandH * .78);
      }
      // the timing ring
      if (!fin || t - fin.t < .5) {
        const rr = ringR(tapAt !== null ? tapAt : t), a = fin ? 1 - (t - fin.t) / .5 : 1;
        c.globalAlpha = a;
        c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, 7); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
        c.strokeStyle = 'rgba(255,210,63,.35)'; c.lineWidth = R * .24; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
        c.strokeStyle = q === 'perfect' ? '#ffd23f' : q ? '#fff' : '#ff9b3f'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, Math.max(4, rr), 0, 7); c.stroke();
        ballArt(c, cx, cy, R * .45, 1, t * 4);
        c.globalAlpha = 1;
        if (!q) { c.font = `${firstRings || tut ? 22 : 30}px Bangers, sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
          const tx = firstRings || tut ? 'TAP when the ring hits the circle!' : 'TAP!'; c.strokeText(tx, cx, cy - R * 1.6); c.fillText(tx, cx, cy - R * 1.6); }
      }
      if (q) {                                                  // ring feedback, then the result slam
        const u = t - fin.t;
        c.textAlign = 'center'; c.font = `${q === 'perfect' ? 44 : 28}px Bangers, sans-serif`; c.lineWidth = 6; c.strokeStyle = '#000';
        c.fillStyle = q === 'perfect' ? '#ffd23f' : q === 'good' ? '#fff' : '#ff9b8a';
        const ty = cy - R * 1.6 - Math.min(u, .3) * 30; c.strokeText(msg, cx, ty); c.fillText(msg, cx, ty);
        if (q !== 'miss') { c.font = '16px system-ui'; c.lineWidth = 4; c.strokeText(`+${Math.round(RING_BONUS[q] * 100)}% chance`, cx, ty + 24); c.fillText(`+${Math.round(RING_BONUS[q] * 100)}% chance`, cx, ty + 24); }
        if (u > .38) {
          const s = clamp((u - .38) / .12, 0, 1), sc = 2.6 - 1.6 * easeOut(s);
          const word = shot ? (o.special ? 'FIRE!' : 'SHOOT!') : win ? (o.ch < .5 ? 'UPSET!' : o.kind === 'save' ? 'SAVE!' : 'WIN!') : (o.kind === 'save' ? 'BEATEN...' : 'LOST!');
          if (!played) { played = true; if (!shot) { snd(win ? 'win' : 'lose'); buzz(win ? 40 : 15); } else snd('kick'); }
          c.save(); c.translate(cx, cy); c.rotate(-.08); c.scale(sc, sc);
          c.font = `${Math.min(CW * .2, 110)}px Bangers, sans-serif`; c.lineWidth = 10; c.strokeStyle = '#000';
          c.fillStyle = shot ? '#ffd23f' : win ? (o.ch < .5 ? '#ff9b3f' : '#ffd23f') : '#9aa7b5';
          const sh2 = s < 1 ? 0 : (u < .62 ? (1 - (u - .5) / .12) * 6 : 0); c.translate(rnd(-sh2, sh2), rnd(-sh2, sh2));
          c.strokeText(word, 0, 0); c.fillText(word, 0, 0); c.restore();
          if (o.ch < .5 && win && !shot && u < .9) { c.globalCompositeOperation = 'lighter'; focusLines(c, cx, cy, 40, R * 2, '#ffb000', .5); c.globalCompositeOperation = 'source-over'; }
        }
        if (u > (shot ? .75 : 1.05)) { done = true; removeEventListener('pointerdown', onTap, true); removeEventListener('keydown', onKey, true); c.clearRect(0, 0, CW, CH); res({ q, win }); return; }
      }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
}
