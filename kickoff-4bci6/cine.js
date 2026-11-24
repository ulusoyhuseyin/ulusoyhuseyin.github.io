// Special-move cut-ins. Technique D (the owner's pick): AI key poses of the same hero, animated like TV anime —
// holds, hard cuts, camera push and shake, black/white impact frames, a code-drawn ball with a tapered fire streak.
// Styles without key poses yet (Engine, Playmaker) use a placeholder face cut-in (techFX) until their poses are rendered.
'use strict';

const CINE = { on: false, skip: false, skippable: false };
addEventListener('pointerdown', () => { if (CINE.on && CINE.skippable) CINE.skip = true; }, true);
function cine(dur, draw, skippable) {
  CINE.on = true; CINE.skip = false; CINE.skippable = !!skippable;
  return new Promise(res => {
    const t0 = performance.now();
    const f = now => {
      let t = (now - t0) / 1000; if (CINE.skip) t = dur;
      fx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.clearRect(0, 0, CW, CH);
      draw(fx, Math.min(1, t / dur), t);
      if (t < dur) requestAnimationFrame(f); else { fx.clearRect(0, 0, CW, CH); CINE.on = false; res(); }
    };
    requestAnimationFrame(f);
  });
}
function focusLines(c, cx, cy, n, inner, col, alpha = 1) {   // manga "concentration lines"
  c.save(); c.fillStyle = col; c.globalAlpha = alpha; const R = Math.hypot(CW, CH);
  for (let i = 0; i < n; i++) {
    const a = rnd(Math.PI * 2), r0 = inner * rnd(.85, 1.4), w = rnd(.004, .018);
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); c.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); c.fill();
  }
  c.restore();
}
function speedLines(c, x0, y0, w, h, n, col, t, dir = -1) {
  c.save(); c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const y = y0 + ((i * 97.3) % h), len = 40 + ((i * 53) % 160), sp = 900 + (i * 37 % 600);
    const x = x0 + ((((i * 211) % w) + dir * t * sp) % (w + len) + w + len) % (w + len) - len;
    c.globalAlpha = .25 + (i % 5) * .12; c.fillRect(x, y, len, 1.5 + (i % 3));
  }
  c.restore();
}
function moveName(c, text, t, x, y, size, cols) {             // slam-in title with overshoot
  const k = t < .25 ? 2.4 - 1.5 * easeOut(t / .25) : t < .35 ? .9 + (t - .25) : 1;
  c.save(); c.translate(x, y); c.rotate(-.08); c.scale(k, k);
  c.font = `${size}px Bangers, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = size * .16; c.strokeStyle = '#000'; c.strokeText(text, 0, 0);
  const g = c.createLinearGradient(0, -size / 2, 0, size / 2); cols = cols || ['#fff6a8', '#ffd23f', '#ff7a00'];
  g.addColorStop(0, cols[0]); g.addColorStop(.5, cols[1]); g.addColorStop(1, cols[2]);
  c.fillStyle = g; c.fillText(text, 0, 0); c.restore();
}
function drawArtIn(c, img, x, y, w, h, focus, zoom, flip) {     // cover-fit an image into a box, centred on focus (0..1)
  if (!img || !img.ok) { c.fillStyle = '#1a0a0a'; c.fillRect(x, y, w, h); return { ix: x, iy: y, iw: w, ih: h }; }
  const s = Math.max(w / img.width, h / img.height) * zoom, iw = img.width * s, ih = img.height * s;
  let ix = x + w / 2 - focus[0] * iw, iy = y + h / 2 - focus[1] * ih;
  ix = clamp(ix, x + w - iw, x); iy = clamp(iy, y + h - ih, y);
  c.save(); if (flip) { c.translate(x * 2 + w, 0); c.scale(-1, 1); } c.drawImage(img, ix, iy, iw, ih); c.restore();
  return { ix, iy, iw, ih };
}
function panel(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function ballArt(c, x, y, r, sq, spin) {
  c.save(); c.translate(x, y); c.scale(1 / sq, sq); c.rotate(spin || 0);
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#111'; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(Math.cos(a) * r * .6, Math.sin(a) * r * .6, r * .22, 0, 7); c.fill(); }
  c.beginPath(); c.arc(0, 0, r * .25, 0, 7); c.fill(); c.restore();
}

// ---------------------------------------------------------------- technique D
const KEYS = { k1: { foot: [.8, .9] }, k2: { foot: [.7, .8] }, k3: { foot: [.963, .356] }, k4: { foot: [.7, .9] } };
for (const k in KEYS) { const i = new Image(); i.onload = () => { i.ok = true; i.sil = silhouettes(i); }; i.src = `img/${k}.png`; KEYS[k].img = i; }
function silhouettes(img) {                                  // black and white versions of a cut-out, for impact frames
  const out = {};
  for (const col of ['#000', '#fff']) {
    const o = document.createElement('canvas'); o.width = img.width; o.height = img.height; const c = o.getContext('2d');
    c.drawImage(img, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, o.width, o.height); out[col] = o;
  }
  return out;
}
function keyArt(c, k, cx, by, h, rot = 0, sil) {             // draw key pose k with its feet-line at (cx, by), height h; returns the foot point
  const K = KEYS[k], img = K.img; if (!img.ok) return [cx, by];
  const w = h * img.width / img.height, x = -w / 2, y = -h;
  c.save(); c.translate(cx, by); c.rotate(rot);
  c.drawImage(sil ? img.sil[sil] : img, x, y, w, h); c.restore();
  const fx0 = x + K.foot[0] * w, fy0 = y + K.foot[1] * h;
  return [cx + fx0 * Math.cos(rot) - fy0 * Math.sin(rot), by + fx0 * Math.sin(rot) + fy0 * Math.cos(rot)];
}
function cineBg(c, focus, extra) {
  const img = (G && G.bgImg && G.bgImg.ok) ? G.bgImg : IMG.stadium;
  if (img.ok) { c.filter = 'blur(4px) brightness(.62) saturate(1.2)'; drawArtIn(c, img, -60, -60, CW + 120, CH + 120, focus, 1.25, false); c.filter = 'none'; }
  else { c.fillStyle = '#102030'; c.fillRect(-60, -60, CW + 120, CH + 120); }
  c.fillStyle = extra || 'rgba(30,0,10,.3)'; c.fillRect(-60, -60, CW + 120, CH + 120);
}
async function techD(name, dur, skippable) {
  const st = { trail: [], boomed: false };
  snd('swoosh');
  await cine(dur, (c, t, ts) => dPhase(c, t, ts, st, name, skippable), skippable);
}
function dPhase(c, t, ts, st, name, skippable) {             // one frame of the action part of technique D at phase t (0..1)
  const trail = st.trail;
  {
    const portrait = CH > CW, h = portrait ? Math.min(CH * .5, CW * 1.25) : CH * .78;
    const T1 = .2, T2 = .42, TI = .47, T3 = .78;                // sprint | leap | impact frames | strike hold | landing
    if (t > T2 && !st.boomed) { st.boomed = true; snd('boom'); buzz(60); }
    const shake = t > T2 && t < T2 + .12 ? (1 - (t - T2) / .12) * 16 : 0;
    const camZ = t < T2 ? 1 + .18 * t / T2 : t < T3 ? 1.12 + .06 * (t - TI) : 1.05;
    c.save(); c.translate(CW / 2 + rnd(-shake, shake), CH / 2 + rnd(-shake, shake)); c.scale(camZ, camZ); c.translate(-CW / 2, -CH / 2);
    const pan = t < T1 ? t * 2 : T1 * 2, tilt = t > T1 && t < T2 ? (t - T1) / (T2 - T1) * .25 : t >= T2 ? .25 : 0;
    cineBg(c, [.35 + pan * .3, .65 - tilt]);
    const gy = portrait ? CH * .78 : CH * .95, ballR = h * .055;
    let foot = null;
    if (t < T1) {                                              // 1. sprint
      speedLines(c, -60, 0, CW + 120, CH, 80, '#fff', ts * 1.6, -1);
      const k = easeOut(t / T1), x = lerp(-CW * .2, CW * .42, k);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, gy, h * .22, h * .03, 0, 0, 7); c.fill();
      keyArt(c, 'k1', x, gy + Math.sin(ts * 28) * h * .01, h);
      ballArt(c, x + h * .3, gy - ballR, ballR, 1, ts * 12);
    } else if (t < T2) {                                       // 2. leap
      const k = (t - T1) / (T2 - T1), rise = easeOut(k) * h * (portrait ? .32 : .1), x = CW * .44, top = gy - rise - h;
      focusLines(c, x, top + h * .4, 60, h * .45, '#fff', .35);
      keyArt(c, 'k2', x, gy - rise, h, -.05);
      ballArt(c, x + h * .2, Math.max(ballR + 8, top - h * .06) + k * k * h * .22, ballR, 1, ts * 8);
    } else if (t < T3) {                                       // 3. impact frames, then the held strike with the ball launch
      const h3 = portrait ? CW * .9 * 719 / 698 : CH * .7, x = CW * (portrait ? .46 : .42), by = CH * .24 + h3, rot = -.06 + (t - TI) * .06;
      const imp = t < TI ? (t < TI - .025 ? '#fff' : '#000') : null;
      if (imp) { c.fillStyle = imp === '#fff' ? '#000' : '#fff'; c.fillRect(-60, -60, CW + 120, CH + 120); }
      else speedLines(c, -60, 0, CW + 120, CH, 90, '#ffd9a0', ts * 2.5, -1);
      foot = keyArt(c, 'k3', x, by, h3, rot, imp);
      if (!imp) {
        const k0 = (t - TI) / (T3 - TI), k = Math.max(0, (k0 - .1) / .9), bx = foot[0] + ballR + easeOut(k) * CW * (portrait ? .75 : 1.2), byy = foot[1] - easeOut(k) * CH * (portrait ? .5 : .35);
        trail.push([bx, byy]); while (trail.length > 16) trail.shift();
        c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; const tail = [[foot[0] + ballR, foot[1]], ...trail];
        for (const [wk, col] of [[2.2, 'rgba(255,80,0,.45)'], [1.4, 'rgba(255,170,30,.7)'], [.6, 'rgba(255,245,200,.9)']])
          for (let i = 1; i < tail.length; i++) { c.strokeStyle = col; c.lineWidth = ballR * wk * i / tail.length; c.beginPath(); c.moveTo(...tail[i - 1]); c.lineTo(...tail[i]); c.stroke(); }
        c.globalCompositeOperation = 'source-over';
        ballArt(c, bx, byy, ballR, k0 < .1 ? .62 : 1, ts * 40);
        if (k0 < .35) { c.strokeStyle = `rgba(255,255,255,${1 - k0 / .35})`; c.lineWidth = 7; c.beginPath(); c.arc(foot[0] + ballR, foot[1], ballR + k0 * h * 1.2, 0, 7); c.stroke(); }
      }
    } else {                                                   // 4. landing
      const k = (t - T3) / (1 - T3), x = CW * .5;
      speedLines(c, -60, 0, CW + 120, CH, 40, '#fff', ts * .5, -1);
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,140,0,.6)'; c.lineWidth = ballR * 1.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-20, CH * .45); c.lineTo(CW + 20, CH * .08); c.stroke(); c.restore();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, gy, h * .25, h * .03, 0, 0, 7); c.fill();
      keyArt(c, 'k4', x, gy + (1 - easeOut(Math.min(1, k * 4))) * -h * .12, h * .95);
    }
    c.restore();
    if (t > TI) moveName(c, name + '!', (t - TI) / (1 - TI), CW / 2, CH * (portrait ? .13 : .14), Math.min(CW * .14, CH * .12, 84));
    if (t > .97) { c.fillStyle = `rgba(255,255,255,${(t - .97) * 33})`; c.fillRect(0, 0, CW, CH); }
    if (skippable && t < .9) { c.font = '13px system-ui'; c.fillStyle = 'rgba(255,255,255,.6)'; c.textAlign = 'right'; c.fillText('tap to skip', CW - 12, CH - 16); }
  }
}

// ---------------------------------------------------------------- placeholder cut-in for moves without key poses yet
// face panel slams in, energy in the move's colours, the name. About 1.4 s.
async function techFX(name, face, cols, dur, skippable) {
  snd('swoosh'); let boomed = false;
  const img = IMG['face_' + face];
  await cine(dur, (c, t, ts) => {
    if (t > .45 && !boomed) { boomed = true; snd('boom'); buzz(50); }
    cineBg(c, [.5, .5], 'rgba(0,0,20,.45)');
    const portrait = CH > CW, ph = portrait ? CH * .34 : CH * .5, py = CH * (portrait ? .3 : .25), sk = CW * .1;
    const k1 = easeOut(Math.min(1, t / .18)), off = (1 - k1) * -CW * 1.2, sh = t > .45 && t < .55 ? (1 - (t - .45) / .1) * 12 : 0;
    c.save(); c.translate(rnd(-sh, sh), rnd(-sh, sh));
    const pts = [off - sk, py + sk * .5, off + CW + sk, py - sk * .3, off + CW + sk, py + ph - sk * .3, off - sk, py + ph + sk * .5];
    c.save(); panel(c, pts); c.clip();
    c.fillStyle = cols[2]; c.fillRect(-20, py - sk, CW + 40, ph + sk * 2);
    drawArtIn(c, img, off, py - sk, CW, ph + sk * 2, [.5, .45], 1.05 + t * .25, false);
    focusLines(c, CW / 2, py + ph * .45, 30, ph * .5, '#000', .3);
    c.restore();
    c.save(); panel(c, pts); c.lineWidth = 6; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 2; c.strokeStyle = cols[0]; c.stroke(); c.restore();
    if (t > .45) {                                             // energy burst in the move's colours
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const a = i * 2.4 + ts * 3, r = ((t - .45) * 2.2 + i / 40 % 1) * Math.max(CW, CH) * .6;
        c.fillStyle = i % 2 ? cols[0] : cols[1]; c.globalAlpha = Math.max(0, 1 - (t - .45) * 1.6); c.beginPath(); c.arc(CW / 2 + Math.cos(a) * r, py + ph / 2 + Math.sin(a) * r, 3 + i % 4, 0, 7); c.fill(); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    c.restore();
    if (t > .3) moveName(c, name + '!', (t - .3) / .7, CW / 2, py - Math.min(CW * .09, 50), Math.min(CW * .13, CH * .11, 80), [cols[0], cols[1], cols[2]]);
    if (t > .94) { c.fillStyle = `rgba(255,255,255,${(t - .94) * 16})`; c.fillRect(0, 0, CW, CH); }
  }, skippable);
}

// ---------------------------------------------------------------- the long Comet Drive: technique D with face close-ups cut in
// side profile → sprint → burning eyes → leap → kick (impact frames) → battle cry with the name → landing. About 4.6 s.
for (const k of ['side', 'eyes', 'shout']) load('fs_' + k, `img/fs_${k}.jpg`);
function faceShot(c, key, k, ts, name) {
  const img = IMG['fs_' + key], portrait = CH > CW;
  c.fillStyle = '#000'; c.fillRect(0, 0, CW, CH);
  if (key === 'side') {                                      // calm before the storm: letterboxed, slow push-in, slides in from the right
    const bh = portrait ? CH * .62 : CH * .8, y = (CH - bh) / 2, off = (1 - easeOut(Math.min(1, k / .2))) * CW * .4;
    c.save(); c.beginPath(); c.rect(0, y, CW, bh); c.clip();
    drawArtIn(c, img, off, y, CW, bh, [.58, .45], 1.02 + k * .12, false); c.restore();
    speedLines(c, 0, y, CW, bh, 18, 'rgba(255,255,255,.5)', ts * .4, 1);
  } else if (key === 'eyes') {                               // the eyes burn: a white flash, a strip across the screen, glowing pupils
    const bh = portrait ? CH * .34 : CH * .6, y = (CH - bh) / 2, sh = k < .25 ? (1 - k / .25) * 10 : 0;
    focusLines(c, CW / 2, CH / 2, 70, Math.max(CW, CH) * .3, '#fff', .5);
    c.save(); c.translate(rnd(-sh, sh), rnd(-sh, sh)); c.beginPath(); c.rect(-10, y, CW + 20, bh); c.clip();
    const r = drawArtIn(c, img, -10, y, CW + 20, bh, [.5, .55], 1.05 + k * .2, false);
    c.globalCompositeOperation = 'lighter';
    for (const ex of [.37, .65]) { const gx = r.ix + ex * r.iw, gy = r.iy + .55 * r.ih, g = c.createRadialGradient(gx, gy, 0, gx, gy, r.iw * .09 * (1 + .3 * Math.sin(ts * 30)));
      g.addColorStop(0, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(gx, gy, r.iw * .1, 0, 7); c.fill(); }
    c.globalCompositeOperation = 'source-over'; c.restore();
    c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeRect(-10, y, CW + 20, bh);
    if (k < .12) { c.fillStyle = `rgba(255,255,255,${1 - k / .12})`; c.fillRect(0, 0, CW, CH); }
  } else {                                                    // the battle cry: full screen, zoom punch, heavy shake, the name
    const sh = k < .3 ? (1 - k / .3) * 22 : 3;
    c.save(); c.translate(rnd(-sh, sh), rnd(-sh, sh));
    drawArtIn(c, img, -30, -30, CW + 60, CH + 60, [.5, .5], 1.3 - .22 * easeOut(Math.min(1, k / .3)), false);
    c.restore();
    c.globalCompositeOperation = 'lighter'; focusLines(c, CW / 2, CH * .55, 40, Math.min(CW, CH) * .45, '#ffb000', .35); c.globalCompositeOperation = 'source-over';
    moveName(c, name + '!', k, CW / 2, CH * (portrait ? .82 : .78), Math.min(CW * .16, CH * .14, 96));
    if (k < .08) { c.fillStyle = `rgba(255,150,0,${1 - k / .08})`; c.fillRect(0, 0, CW, CH); }
  }
}
async function techDFull(name, skippable) {
  const st = { trail: [], boomed: false };
  const SEG = [['f', 'side', .8], ['d', 0, .2, .55], ['f', 'eyes', .6], ['d', .2, .42, .5], ['d', .42, .78, .95], ['f', 'shout', .7], ['d', .78, 1, .5]];
  const total = SEG.reduce((a, s) => a + s[s.length - 1], 0);
  snd('swoosh'); let lastSeg = -1;
  await cine(total, (c, t, ts) => {
    let at = t * total, i = 0;
    while (i < SEG.length - 1 && at > SEG[i][SEG[i].length - 1]) { at -= SEG[i][SEG[i].length - 1]; i++; }
    const s = SEG[i], dur = s[s.length - 1], k = clamp(at / dur, 0, 1);
    if (i !== lastSeg) { lastSeg = i; if (s[0] === 'f') { snd(s[1] === 'shout' ? 'boom' : 'swoosh'); if (s[1] === 'shout') buzz(80); } }
    if (s[0] === 'f') faceShot(c, s[1], k, ts, name);
    else dPhase(c, lerp(s[1], s[2], k), ts, st, name, skippable);
    if (skippable && t < .9) { c.font = '13px system-ui'; c.fillStyle = 'rgba(255,255,255,.6)'; c.textAlign = 'right'; c.fillText('tap to skip', CW - 12, CH - 16); }
  }, skippable);
}

// ---------------------------------------------------------------- Ren's FROST SPIRAL (rival special, aimed at your goal): face shot → impact → kick + ice spiral
const REN = { foot: [.02, .22] };
{ const i = new Image(); i.onload = () => { i.ok = true; i.sil = silhouettes(i); }; i.src = 'img/ren_kick.png'; REN.img = i; }
load('ren_fs', 'img/ren_fs.jpg');
async function techRen(name, skippable) {
  const SEG = [.8, .16, 1.25, .35], total = SEG.reduce((a, b) => a + b, 0), shards = [];
  snd('swoosh'); let boomed = false;
  await cine(total, (c, t, ts) => {
    let at = t * total, i = 0; while (i < SEG.length - 1 && at > SEG[i]) { at -= SEG[i]; i++; }
    const k = clamp(at / SEG[i], 0, 1), portrait = CH > CW;
    c.fillStyle = '#02101c'; c.fillRect(0, 0, CW, CH);
    const ice = ['#e8fbff', '#7fd8ff', '#1d6fa3'];
    if (i === 0) {                                            // the cold stare
      drawArtIn(c, IMG.ren_fs, -20, -20, CW + 40, CH + 40, [.5, .4], 1.05 + k * .12, false);
      c.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 30; j++) { const x = (j * 97 + ts * 40 * (1 + j % 3)) % CW, y = (j * 131 + ts * 25) % CH; c.fillStyle = 'rgba(160,230,255,.5)'; c.beginPath(); c.arc(x, y, 1.5 + j % 3, 0, 7); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      if (k < .1) { c.fillStyle = `rgba(200,240,255,${1 - k / .1})`; c.fillRect(0, 0, CW, CH); }
      return;
    }
    const img = REN.img, h = portrait ? Math.min(CH * .5, CW * 1.15) : CH * .78, w = img.ok ? h * img.width / img.height : h * .78;
    const cx = CW * (portrait ? .74 : .62), by = CH * (portrait ? .2 : .1) + h, x0 = cx - w / 2, y0 = by - h;
    const foot = [x0 + REN.foot[0] * w, y0 + REN.foot[1] * h];
    if (i === 1) {                                            // impact frames: white on black, then black on white
      const inv = k > .5; c.fillStyle = inv ? '#fff' : '#000'; c.fillRect(0, 0, CW, CH);
      if (img.ok) c.drawImage(img.sil[inv ? '#000' : '#fff'], x0, y0, w, h);
      if (!boomed) { boomed = true; snd('boom'); buzz(70); }
      return;
    }
    if (i === 2) {                                            // the kick, held; the ball spirals away to the left in ice
      const sh = k < .12 ? (1 - k / .12) * 14 : 0;
      c.save(); c.translate(rnd(-sh, sh), rnd(-sh, sh));
      cineBg(c, [.5, .5], 'rgba(0,30,60,.55)');
      speedLines(c, -60, 0, CW + 120, CH, 80, '#cdf3ff', ts * 2.2, 1);
      if (img.ok) c.drawImage(img, x0, y0, w, h);
      const kk = ease(clamp((k - .1) / .9, 0, 1)), bx = foot[0] - kk * CW * (portrait ? .75 : .9), byy = foot[1] + kk * CH * (portrait ? .5 : .4), br = h * .055;
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const [wk, col] of [[2.4, 'rgba(60,160,255,.35)'], [1.5, 'rgba(127,216,255,.6)'], [.7, 'rgba(235,252,255,.95)']]) {
        c.strokeStyle = col; c.lineWidth = br * wk; c.beginPath();
        for (let j = 0; j <= 30; j++) { const u = j / 30, px = lerp(foot[0], bx, u), py = lerp(foot[1], byy, u), sp = Math.sin(u * 12 - ts * 16) * br * 2.4 * Math.min(1, u * 2);
          j ? c.lineTo(px, py + sp) : c.moveTo(px, py + sp); }
        c.stroke();
      }
      if (shards.length < 60) shards.push({ x: bx, y: byy, vx: rnd(-2, 4), vy: rnd(-3, 3), l: 1 });
      for (const s of shards) { s.x += s.vx; s.y += s.vy; s.l -= .02; c.fillStyle = `rgba(200,240,255,${Math.max(0, s.l)})`; c.save(); c.translate(s.x, s.y); c.rotate(s.x * .1); c.fillRect(-3, -1, 6, 2); c.restore(); }
      c.globalCompositeOperation = 'source-over';
      ballArt(c, bx, byy, br, k < .1 ? .62 : 1, -ts * 40);
      if (k < .35) { c.strokeStyle = `rgba(200,240,255,${1 - k / .35})`; c.lineWidth = 6; c.beginPath(); c.arc(foot[0], foot[1], br + k * h, 0, 7); c.stroke(); }
      c.restore();
      moveName(c, name + '!', k, CW / 2, CH * (portrait ? .12 : .13), Math.min(CW * .13, CH * .12, 80), ice);
      return;
    }
    c.fillStyle = `rgba(220,245,255,${1 - k})`; c.fillRect(0, 0, CW, CH);   // cold flash
    moveName(c, name + '!', 1, CW / 2, CH * (portrait ? .12 : .13), Math.min(CW * .13, CH * .12, 80), ice);
  }, skippable);
}
