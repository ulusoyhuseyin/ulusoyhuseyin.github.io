// Striker Spirit, Stage 1 preview. Shared setup: canvas, helpers, images, sound, save, consent-based tracking.
// Files: core.js (this) → cine.js (special-move cut-ins) → match.js (pitch sim + director) → scene.js (decisions + clash) → meta.js (season screens).
'use strict';

const W = 68, H = 105, GX = 34, GOALW = 7.32;            // pitch in metres, portrait; we attack up (towards y = 0)
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const fxc = document.getElementById('fx'), fx = fxc.getContext('2d');
const $ = id => document.getElementById(id);
let DPR = 1, CW = 0, CH = 0, S = 10, ROT = false;   // ROT: wide screens show the pitch sideways, attacking to the right
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); CW = innerWidth; CH = innerHeight;
  for (const c of [cv, fxc]) { c.width = CW * DPR; c.height = CH * DPR; c.style.width = CW + 'px'; c.style.height = CH + 'px'; }
  ROT = CW > CH * 1.05;
  S = ROT ? Math.min(CW / 48, CH / 28) : Math.min(CH / 38, CW / 22);   // close camera: pixels per metre
}
addEventListener('resize', resize); resize();
const s2w = (u, v) => ROT ? [v, -u] : [u, v];             // a screen direction → the world direction (pitch coordinates)
const w2s = (x, y) => ROT ? [-y, x] : [x, y];             // a world direction → the screen direction
function upright(c, x, y) { c.translate(x, y); if (ROT) c.rotate(-Math.PI / 2); }   // faces and text stay upright on a rotated pitch

const URLP = new URLSearchParams(location.search);
const BOT = URLP.has('bot');                              // test robot: picks options and taps rings by itself
const FAST = +URLP.get('fast') || 1;
// ?audit=1: an automatic referee for soak tests. It checks every goal and every out-of-play against the ball's real path
// and a few invariants (no NaN, ball near the pitch, time moving, no scene stuck). Results in window.AUDIT.
const AUD = URLP.has('audit') ? (window.AUDIT = { goals: [], outs: [], bad: [], shots: 0 }) : null;
function audBad(kind, data) { if (AUD && AUD.bad.length < 200) AUD.bad.push({ kind, t: G ? Math.round(G.t * 10) / 10 : 0, m: G ? G.m : 0, score: G ? G.score.join('-') : '', ...data }); }                       // test speed-up of the pitch simulation only
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------- images
const IMG = {};
function load(k, src) { const i = new Image(); i.onload = () => { i.ok = true; }; i.src = src; IMG[k] = i; return i; }
for (const k of ['kai', 'mo', 'ren', 'bruno', 'ito']) load('face_' + k, `img/face_${k}.jpg`);
load('stadium', 'img/stadium.jpg'); load('rain', 'img/bg_rain.jpg'); load('school', 'img/bg_school.jpg');

// round face token (pre-rendered once per face + ring colour) for the pitch and the clash
const TOK = new Map();
function token(face, ring, label, fill) {
  const key = face + ring + label + fill; if (TOK.has(key)) { const t = TOK.get(key); if (t.ok || !face) return t; }
  const N = 128, o = document.createElement('canvas'); o.width = o.height = N; const c = o.getContext('2d');
  const img = face && IMG['face_' + face];
  c.fillStyle = '#000'; c.beginPath(); c.arc(N / 2, N / 2, N / 2, 0, 7); c.fill();
  c.fillStyle = ring; c.beginPath(); c.arc(N / 2, N / 2, N / 2 - 4, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(N / 2, N / 2, N / 2 - 14, 0, 7); c.clip();
  if (img && img.ok) { c.drawImage(img, 10, 6, N - 20, N - 20); o.ok = true; }
  else { c.fillStyle = fill || ring; c.fillRect(0, 0, N, N); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(N / 2, N * .95, N * .42, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = `${N * .42}px Bangers, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.6)';
    c.strokeText(label, N / 2, N / 2 + 2); c.fillText(label, N / 2, N / 2 + 2); o.ok = !face; }
  c.restore(); TOK.set(key, o); return o;
}

// ---------------------------------------------------------------- sound: a tiny quiet synth (the owner dislikes noise: soft levels, no crowd loop)
let AC = null, MUTE = false;
try { MUTE = localStorage.getItem('ss.mute') === '1'; } catch (e) {}
function snd(kind) {
  if (MUTE) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
    const tone = (f, d, l, v, type = 'sine') => { const o = AC.createOscillator(), gg = AC.createGain(); o.type = type; o.frequency.value = f; o.connect(gg); gg.connect(AC.destination);
      gg.gain.setValueAtTime(0, t + d); gg.gain.linearRampToValueAtTime(v, t + d + .01); gg.gain.exponentialRampToValueAtTime(.001, t + d + l); o.start(t + d); o.stop(t + d + l + .02); };
    if (kind === 'kick' || kind === 'boom') {
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'boom' ? 120 : 160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + .18); g.gain.setValueAtTime(kind === 'boom' ? .4 : .18, t);
      g.gain.exponentialRampToValueAtTime(.001, t + (kind === 'boom' ? .5 : .2)); o.connect(g); o.start(t); o.stop(t + .5);
    } else if (kind === 'whistle') { tone(2900, 0, .12, .04); tone(2900, .18, .35, .04); }
    else if (kind === 'perfect') { tone(880, 0, .12, .07, 'triangle'); tone(1320, .07, .2, .07, 'triangle'); }
    else if (kind === 'good') tone(660, 0, .15, .06, 'triangle');
    else if (kind === 'win') { tone(523, 0, .12, .06, 'triangle'); tone(659, .08, .12, .06, 'triangle'); tone(784, .16, .25, .07, 'triangle'); }
    else if (kind === 'lose') { tone(300, 0, .2, .05, 'triangle'); tone(220, .12, .3, .05, 'triangle'); }
    else if (kind === 'tick') tone(1200, 0, .04, .025, 'square');
    else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .3, .06, 'triangle')); }
    else if (kind === 'swoosh') {
      const b = AC.createBuffer(1, AC.sampleRate * .4, AC.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
      const s = AC.createBufferSource(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + .35); s.buffer = b; s.connect(f); f.connect(g); g.gain.value = .16; s.start(t);
    }
  } catch (e) {}
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------------------------------------------------------- save
const KEY = 'ss.stage1.v1';
const BASE = { shoot: 10, dribble: 10, pass: 10, tackle: 10, speed: 10, spirit: 10 };
const fresh = () => ({ match: 1, lvl: 1, xp: 0, stats: { ...BASE }, style: null, name: 'KAI', rec: [], seenCut: 0, plays: 0, fb: false, done: false });
let save; try { save = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
save = save && save.stats ? save : fresh();
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
const need = lvl => 100 + 40 * (lvl - 1);

// ---------------------------------------------------------------- anonymous play data, only with consent (same sheet as the mystery game, where = "striker")
const TRACK_URL = 'https://script.google.com/macros/s/AKfycbwLXJD1ulpSN-nhuJ_vUYG2r1MVnyJktRVgVjncsAHs6suxJcnp7XEg9FeLACHK8Io/exec';
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const PID = LS.get('ss.pid') || (() => { const p = Math.random().toString(36).slice(2, 10); LS.set('ss.pid', p); return p; })();
const SID = Math.random().toString(36).slice(2, 10), T0 = Date.now();
function track(ev, data, force) {                          // force = the player pressed "send" on the feedback form themselves
  if (LS.get('ss.consent') !== 'yes' && !force) return;
  const row = { ts: new Date().toISOString(), pid: PID, sid: SID, where: 'striker', ev, sec: Math.round((Date.now() - T0) / 1000), data: data || {} };
  let log = []; try { log = JSON.parse(LS.get('ss.log')) || []; } catch (e) {}
  log.push(row); LS.set('ss.log', JSON.stringify(log.slice(-500)));
  if (navigator.sendBeacon && !navigator.webdriver && !/^(localhost|127\.|0\.0\.0\.0|192\.168\.|$)/.test(location.hostname)) { try { navigator.sendBeacon(TRACK_URL, JSON.stringify(row)); } catch (e) {} }
}
