// Player for "easy" cases (one lie, caught by one contradiction). Reads window.CASE (from engine/solver.py).
// Screens: title -> cold-open comic -> hub (Suspects, Crime scene, Notebook, Accuse) -> confession -> end.
// Progress is saved as localStorage "episode.<id>.v1"; the map (../index.html) reads it.
(function () {
  var C = window.CASE, app = document.getElementById("app");
  if (C.sealed) { // preview builds scramble the answer and endings (scripts/build_preview.py) so they can't be read in the page source
    try { var sk = "grand-tour-1926", raw = atob(C.sealed), txt = ""; for (var si = 0; si < raw.length; si++) txt += String.fromCharCode(raw.charCodeAt(si) ^ sk.charCodeAt(si % sk.length));
      var so = JSON.parse(txt); for (var sk2 in so) C[sk2] = so[sk2]; } catch (e) {}
  }
  var KEY = "episode." + C.id + ".v1";
  var CALM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PEOPLE = C.suspects.map(function (s) { return s.id; });
  var Q = { where: "Where were you at " + (C.times.length > 2 ? C.times.slice(0, -1).join(", ") + " and " + C.times[C.times.length - 1] : C.times.join(" and ")) + "?", see: "Who did you see?", suspect: "Who do you think did it?" };
  var CT = C.crime.time, CP = C.crime.place;
  var S = load() || fresh();
  var view = { screen: S.started ? "hub" : "title", tab: "suspects", who: null };
  var audio = new Audio(), typingNow = 0, sel = [];

  function fresh() { return { started: false, asked: {}, found: [], contra: false, hints: 0, wrong: 0, solved: false, failed: false, t0: 0, t1: 0, tut: 0 }; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(s) { return app.querySelector(s); }
  function on(sel, fn) { app.querySelectorAll(sel).forEach(function (el) { el.addEventListener("click", fn); }); }
  function img(n) { return "img/" + n + ".jpg"; }
  function sus(id) { return C.suspects.filter(function (s) { return s.id === id; })[0]; }
  function clue(id) { return C.clues.filter(function (c) { return c.id === id; })[0]; }
  function short(id) { var n = sus(id) ? sus(id).name : id; return n.indexOf("Madame") === 0 ? "Madame " + n.split(" ").pop() : n.split(" ")[0]; }
  function stars() { return Math.max(1, 3 - S.wrong); }
  function heard(id, k) { return !!S.asked[id + "_" + k]; }
  function track(ev, data) { try { if (window.TRACK) window.TRACK(C.id, ev, data); } catch (e) {} }
  window.addEventListener("pagehide", function () { track("leave", { screen: view.screen, asked: Object.keys(S.asked).length, objection: !!S.contra, clues: S.found.length, solved: !!S.solved, tut: S.tut }); });

  // ---------- optional goals: badges collect across replays (localStorage "badges.<id>") ----------
  var PAR = C.par || C.mins || 10;
  var GOALS = [
    { id: "moth", icon: "🦋", name: "Sharp eye", text: "Find the Collector card", ok: function () { return !!S.moth; } },
    { id: "nohint", icon: "🧠", name: "Own wits", text: "Solve without hints", ok: function () { return !S.hints; } },
    { id: "fast", icon: "⏱️", name: "Quick wit", text: "Solve in under " + PAR + " minutes", ok: function () { return (S.t1 - S.t0) / 60000 <= PAR; } }
  ];
  function badges() { try { return JSON.parse(localStorage.getItem("badges." + C.id)) || []; } catch (e) { return []; } }
  function earnBadges() {
    var have = badges(), got = [];
    GOALS.forEach(function (g) { if (g.ok()) { got.push(g.id); if (have.indexOf(g.id) < 0) have.push(g.id); } });
    try { localStorage.setItem("badges." + C.id, JSON.stringify(have)); } catch (e) {}
    return got;
  }
  function goalRow(got, all) {
    return '<div class="goals">' + GOALS.map(function (g) { var on = got.indexOf(g.id) >= 0, ever = all.indexOf(g.id) >= 0;
      return '<div class="goal' + (on ? " on" : ever ? " ever" : "") + '"><span>' + g.icon + "</span><b>" + esc(g.name) + "</b><small>" + esc(g.text) + (on ? " ✓" : ever ? " (earned before)" : "") + "</small></div>"; }).join("") + "</div>";
  }

  // ---------- logic: same rules as engine/solver.py ----------
  function holds(c, pos) {
    if (c[0] === "at") return pos[c[1]] === c[2];
    if (c[0] === "alone") return pos[c[1]] === c[2] && PEOPLE.every(function (w) { return w === c[1] || pos[w] !== c[2]; });
    return true;
  }
  function possible(claims) { // is there any world where all these claims hold?
    var places = Object.keys(C.places);
    for (var t = 0; t < C.times.length; t++) {
      var ct = claims.filter(function (c) { return c[3] === t; }); if (!ct.length) continue;
      var ok = false, n = PEOPLE.length, total = Math.pow(places.length, n);
      for (var m = 0; m < total && !ok; m++) {
        var pos = {}, x = m; PEOPLE.forEach(function (p) { pos[p] = places[x % places.length]; x = Math.floor(x / places.length); });
        ok = ct.every(function (c) { return holds(c, pos); });
      }
      if (!ok) return false;
    }
    return true;
  }
  function stmtClaims(k) { var p = k.split(":"); return sus(p[0]).answers[p[1]].claims || []; }

  // ---------- room sound + music bed: ambience is synthesised (no files); audio/music.m4a is optional ----------
  var BG = (function () {
    var ctx = null, master = null, music = null, started = false, ducked = false, scene = true, mvol = 0, fader = null;
    var on = (function () { try { return JSON.parse(localStorage.getItem("tour.sound")) !== false; } catch (e) { return true; } })();
    var mus = (function () { try { return JSON.parse(localStorage.getItem("tour.music")) !== false; } catch (e) { return true; } })();
    var MUSIC_VOL = 0.16;
    function buf(sec, brown) { var b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0), last = 0;
      for (var i = 0; i < d.length; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return b; }
    function loop(b, type, freq, q, vol) { var s = ctx.createBufferSource(); s.buffer = b; s.loop = true; var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      var g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(); return { f: f, g: g }; }
    function lfo(param, rate, depth) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); }
    function crackle(rate, vol) { var w = buf(0.05, false);
      (function tick() { if (!ctx) return; var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
        s.buffer = w; f.type = "bandpass"; f.Q.value = 0.8; f.frequency.value = 500 + Math.random() * 700; g.gain.setValueAtTime(vol * (0.3 + Math.random()), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.05); setTimeout(tick, rate * (0.2 + Math.random() * 1.8)); })(); }
    function bell(every) { (function ring() { setTimeout(function () { if (!ctx) return; var t = ctx.currentTime;
      [[330, .03], [660, .012], [831, .01], [990, .006]].forEach(function (p) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = p[0]; g.gain.setValueAtTime(p[1], t); g.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.connect(g); g.connect(master); o.start(t); o.stop(t + 6.2); });
      ring(); }, every * (0.7 + Math.random() * 0.6)); })(); }
    function lap() { var b = buf(3, true), n = loop(b, "bandpass", 480, 1.1, 0.03);
      (function wave() { if (!ctx) return; var t = ctx.currentTime, d = 0.6 + Math.random() * 0.9; n.g.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.06, t + d / 2); n.g.gain.linearRampToValueAtTime(0.012, t + d); setTimeout(wave, d * 1000); })(); }
    function tune(every) { (function go() { setTimeout(function () { if (!ctx) return; var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = 440; f.type = "lowpass"; f.frequency.value = 1400; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 3.3); go(); }, every * (0.6 + Math.random() * 0.8)); })(); }
    function clack(every) { var w = buf(0.08, false); (function go() { if (!ctx) return; var t = ctx.currentTime;
      [0, 0.16].forEach(function (d) { var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = w; f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.5;
        g.gain.setValueAtTime(0.05, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.07); s.connect(f); f.connect(g); g.connect(master); s.start(t + d); s.stop(t + d + 0.08); });
      setTimeout(go, every + Math.random() * 60); })(); }
    function crickets() { (function go() { setTimeout(function () { if (!ctx) return; var t = ctx.currentTime;
      for (var k = 0; k < 3; k++) { var o = ctx.createOscillator(), g = ctx.createGain(), at = t + k * 0.09; o.frequency.value = 4300; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.006, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06); o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.07); }
      go(); }, 700 + Math.random() * 1600); })(); }
    var BEDS = {
      bakery: function () { loop(buf(4, true), "lowpass", 170, 0.7, 0.07); crackle(380, 0.025); },
      alpine: function () { var w = loop(buf(4, false), "bandpass", 450, 0.8, 0.018); lfo(w.f.frequency, 0.06, 220); lfo(w.g.gain, 0.11, 0.012); crackle(520, 0.015); },
      canal: function () { lap(); bell(42000); },
      room: function () { loop(buf(4, true), "lowpass", 140, 0.7, 0.04); },
      // opera house backstage: a far-off murmuring audience, now and then an instrument tuning its A
      opera: function () { var m = loop(buf(4, true), "bandpass", 320, 0.9, 0.05); lfo(m.g.gain, 0.07, 0.02); tune(26000); },
      // night train: low rumble and the double clack of the wheels on the rail joints
      train: function () { loop(buf(4, true), "lowpass", 110, 0.7, 0.09); clack(1150); },
      // museum gala: a soft crowd through the walls and crickets from the Nile garden
      gala: function () { var m = loop(buf(4, true), "bandpass", 380, 0.9, 0.035); lfo(m.g.gain, 0.05, 0.015); crickets(); }
    };
    // Music only in the story moments (title, comics, confrontation, end screen), never while investigating,
    // and almost silent while someone speaks. It fades, and pauses at 0 so it carries on where it stopped.
    function musicTarget() { return on && mus && scene ? (ducked ? MUSIC_VOL * 0.1 : MUSIC_VOL) : 0; }
    function fadeMusic() {
      if (!music) return; clearInterval(fader);
      var goal = musicTarget(); if (goal > 0 && music.paused) music.play().catch(function () {});
      fader = setInterval(function () {
        mvol += Math.max(-0.012, Math.min(0.006, goal - mvol)); if (Math.abs(goal - mvol) < 0.004) mvol = goal;
        try { music.volume = Math.max(0, Math.min(1, mvol)); } catch (e) {}
        if (mvol === goal) { clearInterval(fader); if (goal === 0) music.pause(); }
      }, 50);
    }
    function apply() { if (master) master.gain.setTargetAtTime(on ? (ducked ? 0.3 : 1) : 0, ctx.currentTime, 0.25); /* room sound steps back while someone speaks */ fadeMusic(); }
    return {
      start: function () {
        if (started) return; started = true;
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.connect(ctx.destination); (BEDS[C.ambience] || BEDS.room)(); } catch (e) { ctx = null; }
        try { music = new Audio("audio/music.m4a"); music.loop = true; music.volume = 0; music.addEventListener("error", function () { music = null; }); } catch (e) { music = null; }
        apply();
      },
      on: function () { return on; },
      toggle: function () { on = !on; try { localStorage.setItem("tour.sound", JSON.stringify(on)); } catch (e) {} apply(); return on; },
      duck: function (d) { ducked = d; apply(); },
      scene: function (v) { v = !!v; if (v === scene) return; scene = v; if (started) fadeMusic(); },
      musicOn: function () { return mus; },
      toggleMusic: function () { mus = !mus; try { localStorage.setItem("tour.music", JSON.stringify(mus)); } catch (e) {} fadeMusic(); return mus; }
    };
  })();
  ["pointerdown", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { BG.start(); }, { once: true }); });

  // ---------- audio + speaking ----------
  function setSpeaking(on) { document.body.classList.toggle("speaking", !!on); }
  audio.addEventListener("playing", function () { setSpeaking(true); BG.duck(true); });
  ["pause", "ended", "error"].forEach(function (ev) { audio.addEventListener(ev, function () { BG.duck(false); if (!typingNow) setSpeaking(false); }); });
  function play(key) { try { audio.pause(); audio.src = "audio/" + key + ".m4a"; audio.play().catch(function () {}); } catch (e) {} }
  function stop() { try { audio.pause(); } catch (e) {} }
  function typeOut(el, text, talk) {
    if (!el) return;
    if (CALM) { el.textContent = text; return; }
    var i = 0, start = Date.now(), dur = text.length * 45, finished = false;
    var setDur = function () { if (audio.duration && isFinite(audio.duration)) dur = audio.duration * 920; };
    setDur(); audio.addEventListener("loadedmetadata", setDur, { once: true });
    var done = function () { if (finished) return; finished = true; el.textContent = text; el.classList.remove("typing"); if (talk) { typingNow = Math.max(0, typingNow - 1); if (!typingNow && (audio.paused || audio.error)) setSpeaking(false); } };
    if (talk) { typingNow++; setSpeaking(true); }
    el.classList.add("typing"); el.textContent = "";
    el.parentNode.addEventListener("click", done, { once: true });
    (function tick() {
      if (!el.isConnected) return done();
      i = Math.min(text.length, Math.ceil(text.length * (Date.now() - start) / dur));
      el.textContent = text.slice(0, i);
      if (i < text.length) requestAnimationFrame(tick); else done();
    })();
  }
  function shake() { if (CALM) return; document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake"); }
  function confetti() {
    if (CALM) return;
    var cols = ["#f0b45a", "#f4ecdc", "#7fb7b0", "#c9473a"];
    for (var i = 0; i < 80; i++) { var d = document.createElement("i"); d.className = "confetti"; d.style.left = Math.random() * 100 + "vw"; d.style.background = cols[i % 4];
      d.style.animationDuration = 2.4 + Math.random() * 2 + "s"; d.style.animationDelay = Math.random() * .8 + "s"; document.body.appendChild(d); setTimeout(function (x) { x.remove(); }.bind(null, d), 5500); }
  }
  function h(html) { app.innerHTML = html; window.scrollTo(0, 0); app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter"); }

  // Phones held upright: comics are wide, so ask the player to turn the phone. Where the browser allows it
  // (Android Chrome), go fullscreen and switch to landscape automatically for the comic, then back.
  function landscape(on) {
    var portrait = window.matchMedia && window.matchMedia("(orientation: portrait) and (pointer: coarse)").matches;
    try {
      if (on) {
        if (!portrait || window.IS_PHONE || !document.documentElement.requestFullscreen || !(screen.orientation && screen.orientation.lock)) return false;
        document.documentElement.requestFullscreen().then(function () { return screen.orientation.lock("landscape"); }).catch(function () {});
        return true;
      }
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } catch (e) {}
    return false;
  }

  // ---------- motion-comic player ----------
  function comic(panels, onDone) {
    stop(); BG.scene(true);
    var ov = document.createElement("div"); ov.className = "comic";
    ov.innerHTML = '<div class="stage"></div><div class="cprog"></div><button class="skip">Skip ›</button>' +
      '<div class="rotate"><span class="ri">📱↻</span> Turn your phone sideways for the full picture</div>';
    document.body.appendChild(ov);
    var turned = landscape(true); // phones get a portrait comic layout instead (see noir.css "phone")
    var stage = ov.querySelector(".stage"), i = -1, timer = null, ended = false;
    function fx(list) { return (list || []).map(function (f) { return '<div class="fx ' + f + '"></div>'; }).join(""); }
    function next() {
      clearTimeout(timer); i++;
      if (i >= panels.length) return finish();
      var p = panels[i];
      var base = p.dur || (p.caption ? Math.max(4200, p.caption.length * 70) : 3600);
      var el = document.createElement("div"); el.className = "panel in";
      // phones held upright: the wide panel sweeps across a tall frame (img animation), the words sit below it (.cwords)
      var dur = (base + 2500) + "ms", sweep = CALM ? "" : p.move === "panLeft" ? "sweepL" : "sweepR";
      el.innerHTML = '<div class="camclip"><div class="cam ' + (CALM ? "" : p.move || "push") + '" style="animation-duration:' + dur + '"><img class="' + sweep + '" style="animation-duration:' + dur + '" src="' + esc(p.img) + '" alt=""></div></div>' + fx(p.fx) + '<div class="vignette"></div>' +
        (p.sfx ? '<div class="sfx">' + esc(p.sfx) + "</div>" : "") + '<div class="cwords">' + (p.bubble ? '<div class="cbubble">' + esc(p.bubble) + "</div>" : "") +
        (p.caption ? '<div class="caption"><span>' + esc(p.caption) + "</span></div>" : "") + "</div>";
      stage.appendChild(el);
      var olds = stage.querySelectorAll(".panel"); if (olds.length > 1) { var o = olds[0]; o.classList.add("out"); setTimeout(function () { o.remove(); }, 900); }
      if (p.sfx) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }
      ov.querySelector(".cprog").style.width = ((i + 1) / panels.length * 100) + "%";
      if (p.audio) {
        play(p.audio);
        var waitAudio = function () { var d = audio.duration && isFinite(audio.duration) ? audio.duration * 1000 + 700 : base; clearTimeout(timer); timer = setTimeout(next, Math.max(d, 2600)); };
        audio.addEventListener("loadedmetadata", waitAudio, { once: true });
        audio.addEventListener("error", function () { clearTimeout(timer); timer = setTimeout(next, base); }, { once: true });
        timer = setTimeout(next, base + 6000);
      } else timer = setTimeout(next, base);
    }
    function finish() { if (ended) return; ended = true; clearTimeout(timer); stop(); if (turned) landscape(false); ov.classList.add("bye"); setTimeout(function () { ov.remove(); if (onDone) onDone(); BG.scene(view.screen !== "hub" || !!document.querySelector(".confront, .comic")); }, 500); }
    stage.addEventListener("click", next);
    ov.querySelector(".skip").addEventListener("click", function () { track("comic_skip", { at: i + 1, of: panels.length }); finish(); });
    next();
  }

  // ---------- screens ----------
  function render() { closeModal(); BG.scene(view.screen !== "hub"); if (view.screen === "title") return title(); if (view.screen === "end") return end(); hub(); }

  function title() {
    h('<div class="title"><img class="hero" src="img/co_1.jpg" alt=""><a class="btn ghost small maplink" href="../index.html" style="position:absolute;left:14px;top:14px;z-index:2">‹ Map</a><div class="tcard"><p class="kicker">' + esc(C.city) + ' · 1926 · <span class="diff ' + (C.level || "easy") + '">' + (C.level === "medium" ? "Medium" : C.level === "hard" ? "Hard" : "Easy") + '</span></p><h1>' + esc(C.title) + '</h1><p class="tag">' + esc(C.tagline) + '</p><button class="btn big" id="go">Open the case</button><p class="muted small">Bonus goals: ' + GOALS.map(function (g) { return g.icon + " " + esc(g.text); }).join(" · ") + '</p><p class="muted small">Sound on. About ' + (C.mins || 10) + ' minutes.' + (C.tutorial ? " Your first case comes with a guide." : "") + '</p></div></div>');
    on("#go", function () {
      track("start", { replay: !!S.solved });
      var co = C.coldopen.map(function (p) { return { img: img(p.id), move: p.move, fx: p.fx, sfx: p.sfx, caption: p.caption, bubble: p.bubble, audio: p.id }; });
      comic(co, function () { S.started = true; S.t0 = S.t0 || Date.now(); save(); view.screen = "hub"; render();
        modal('<h3>The one rule</h3><p>' + esc(C.rule) + '</p><p class="muted small">' + esc(C.crime.what) + '</p><button class="btn" data-close>Start investigating</button>'); });
    });
  }

  function hub() {
    var tabs = [["suspects", "Suspects", "👥"], ["scene", "Crime scene", "🔦"], ["notebook", "Notebook", "📓"], ["accuse", "Accuse", "⚖️"]];
    var body = view.who ? profile(view.who) : { suspects: suspectsTab, scene: sceneTab, notebook: notebookTab, accuse: accuseTab }[view.tab]();
    h('<div class="topbar"><a class="btn ghost small maplink" href="../index.html">‹ Map</a><h2>' + esc(C.title) + '</h2><button class="btn ghost small" id="snd" aria-label="Sound on or off">' + (BG.on() ? "🔊" : "🔇") + '</button> <button class="btn ghost small' + (BG.musicOn() ? "" : " off") + '" id="mus" aria-label="Music on or off" title="Music">🎵</button> <button class="btn ghost small" id="hint">Hint</button></div>' +
      '<nav class="tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (view.tab === t[0] && !view.who ? "on" : "") + '"><span class="ti">' + t[2] + "</span>" + t[1] + (t[0] === "notebook" && S.contra ? " ✓" : "") + "</button>"; }).join("") + "</nav>" + body.html);
    on("[data-tab]", function () { view.tab = this.getAttribute("data-tab"); view.who = null; sel = []; stop(); render(); });
    on("#hint", hint);
    on("#snd", function () { this.textContent = BG.toggle() ? "🔊" : "🔇"; });
    on("#mus", function () { this.classList.toggle("off", !BG.toggleMusic()); toast(BG.musicOn() ? "Music on. It plays in the story scenes." : "Music off. Room sounds and voices stay on."); });
    if (body.wire) body.wire();
  }

  function suspectsTab() {
    return {
      html: '<p class="muted small">' + esc(C.suspectsNote) + '</p><div class="grid">' + C.suspects.map(function (s, k) {
        var n = Object.keys(Q).filter(function (q) { return heard(s.id, q); }).length;
        return '<button class="sus" style="--i:' + k + '" data-who="' + s.id + '"><img src="' + img("face_" + s.id) + '" alt=""><div class="meta"><b>' + esc(s.name) + '</b><span class="muted small">' + esc(s.role) + '</span><span class="pips">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < n ? "on" : "") + '"></i>'; }).join("") + "</span></div></button>";
      }).join("") + "</div>",
      wire: function () { on("[data-who]", function () { view.who = this.getAttribute("data-who"); view.fresh = true; render(); play(view.who + "_intro"); }); }
    };
  }

  function profile(id) {
    var s = sus(id);
    var html = '<div class="prof"><button class="btn ghost small" id="back">‹ All suspects</button><div class="phead" style="margin-top:10px"><div class="talker"><img src="' + img("face_" + id) + '" alt=""><div class="bars"><i></i><i></i><i></i><i></i></div></div><div><h3>' + esc(s.name) + '</h3><span class="arch">' + esc(s.role) + "</span></div></div>" +
      '<div class="bubble">“<span class="introline">' + esc(s.intro) + '</span>”</div>' +
      Object.keys(Q).filter(function (q) { return heard(id, q); }).map(function (q) { return '<div class="bubble said" data-said="' + q + '"><div class="muted small">' + Q[q] + '</div>“<span class="words">' + esc(s.answers[q].text) + "</span>”</div>"; }).join("") +
      '<div class="qs">' + Object.keys(Q).map(function (q) { return '<button data-q="' + q + '" class="' + (heard(id, q) ? "asked" : "") + '">' + (heard(id, q) ? "▶ Again: " : "Ask: ") + Q[q] + "</button>"; }).join("") + "</div></div>";
    return { html: html, wire: function () {
      on("#back", function () { view.who = null; stop(); render(); });
      on("[data-q]", function () { var q = this.getAttribute("data-q"); if (!S.asked[id + "_" + q]) track("ask", { who: id, q: q }); S.asked[id + "_" + q] = 1; save(); render(); play(id + "_" + q);
        var b = $('[data-said="' + q + '"] .words'); if (b) { b.parentNode.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "center" }); typeOut(b, s.answers[q].text, true); } });
      if (view.fresh) { view.fresh = false; typeOut($(".introline"), s.intro, true); }
    } };
  }

  function sceneTab() {
    var found = C.clues.filter(function (c) { return S.found.indexOf(c.id) >= 0; });
    var nEv = C.clues.filter(function (c) { return !c.collector; }).length, fEv = found.filter(function (c) { return !c.collector; }).length;
    return {
      html: '<p class="muted small">' + esc(C.scene.title) + ". " + fEv + "/" + nEv + ' clues found. ' + (window.IS_PHONE ? "Swipe to look around, tap anything that glints." : "Drag your torch, tap anything that glints.") + (S.moth ? ' <span style="color:var(--teal)">· Collector card found</span>' : "") + '</p><div class="scenescroll"><div class="scenepic dark"><img src="img/scene.jpg" alt="' + esc(C.scene.title) + '">' +
        C.clues.map(function (c) { return '<button class="spot' + (c.collector ? " moth" : "") + (S.found.indexOf(c.id) >= 0 ? " found" : "") + '" data-clue="' + c.id + '" style="left:' + c.spot[0] * 100 + "%;top:" + c.spot[1] * 100 + '%" aria-label="Examine ' + esc(c.title) + '"></button>'; }).join("") + '<div class="torch"></div></div></div>' +
        '<div class="cluegrid">' + found.map(function (c) { return '<button class="cl" data-clue="' + c.id + '"><img src="' + img("clue_" + c.id) + '" alt=""><span>' + esc(c.title) + "</span></button>"; }).join("") + "</div>",
      wire: function () {
        var sp = $(".scenepic"), sc = $(".scenescroll");
        // phone: the scene is shown tall and wide; start in the middle, swipe to look around
        var centre = function () { if (sc.scrollWidth > sc.clientWidth && !sc.dataset.c) { sc.dataset.c = 1; sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; } };
        var si = sp.querySelector("img"); if (si.complete) centre(); else si.addEventListener("load", centre);
        var move = function (e) { var r = sp.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; sp.style.setProperty("--x", t.clientX - r.left + "px"); sp.style.setProperty("--y", t.clientY - r.top + "px"); };
        sp.addEventListener("pointermove", move); sp.addEventListener("pointerdown", move); sp.addEventListener("touchmove", move, { passive: true });
        on("[data-clue]", function () { openClue(this.getAttribute("data-clue")); });
      }
    };
  }
  function openClue(id) {
    var c = clue(id);
    if (S.found.indexOf(id) < 0) { S.found.push(id); if (c.collector) S.moth = true; save(); track("clue", { id: id }); }
    play("clue_" + id);
    modal('<div class="evid"><img class="clueimg" src="' + img("clue_" + id) + '" alt=""><span class="stamp">' + (c.collector ? "Collector" : "Evidence") + '</span></div><h3>' + esc(c.title) + '</h3><p class="ct"></p><button class="btn" data-close>Note it</button>', function () { stop(); render(); });
    typeOut(document.querySelector(".overlay .ct"), c.text, false);
  }

  // ---------- notebook: timeline board + statements + objection ----------
  function notebookTab() {
    var stmts = [];
    C.suspects.forEach(function (s) { ["where", "see"].forEach(function (k) { if (heard(s.id, k)) stmts.push(s.id + ":" + k); }); });
    // timeline board: what is claimed about each person at each time, and by whom
    var cell = function (p, t) {
      var says = [];
      stmts.forEach(function (k) { stmtClaims(k).forEach(function (c) { if (c[1] === p && c[3] === t) says.push('<span class="say">' + esc(C.places[c[2]]) + (c[0] === "alone" ? " <b>alone</b>" : "") + ' <span class="src">(' + (k.split(":")[0] === p ? "self" : esc(short(k.split(":")[0]))) + ")</span></span>"); }); });
      return says.length ? says.join("") : '<span class="q">?</span>';
    };
    var board = '<div class="board"><table><tr><th></th>' + C.times.map(function (t, i) { return '<th class="' + (i === CT ? "crime" : "") + '">' + esc(t) + (i === CT ? " · theft" : "") + "</th>"; }).join("") + "</tr>" +
      PEOPLE.map(function (p) { return '<tr><td><span class="who"><img src="' + img("face_" + p) + '" alt="">' + esc(short(p)) + "</span></td>" + C.times.map(function (t, i) { return '<td class="' + (i === CT ? "crime" : "") + '">' + cell(p, i) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
    var list = stmts.map(function (k) {
      var p = k.split(":");
      return '<button class="stmt' + (sel.indexOf(k) >= 0 ? " sel" : "") + (S.contra && C.insight.pair.indexOf(k) >= 0 ? " caught" : "") + '" data-k="' + k + '"><img src="' + img("face_" + p[0]) + '" alt=""><span><b>' + esc(short(p[0])) + ":</b> “" + esc(sus(p[0]).answers[p[1]].text) + "”</span></button>";
    }).join("");
    return {
      html: (S.contra ? '<div class="card insight"><b>' + esc(C.insight.title) + "</b> " + esc(C.insight.text) + "</div>" : "") +
        '<h3 class="sub">Who was where</h3>' + board +
        '<h3 class="sub">Statements</h3>' + (stmts.length ? '<p class="muted small">Tap two statements that can’t both be true, then object.</p>' + list +
        '<div class="objbar"><button class="btn warn" id="object"' + (sel.length === 2 ? "" : " disabled") + ">Objection! (" + sel.length + "/2)</button></div>"
        : '<p class="muted small">Question the suspects. What they say is written down here.</p>'),
      wire: function () {
        on("[data-k]", function () {
          var k = this.getAttribute("data-k"), i = sel.indexOf(k);
          if (i >= 0) sel.splice(i, 1); else { sel.push(k); if (sel.length > 2) sel.shift(); }
          var y = window.scrollY; render(); window.scrollTo(0, y);
        });
        on("#object", function () {
          if (sel.length !== 2) return;
          if (possible(stmtClaims(sel[0]).concat(stmtClaims(sel[1])))) { toast("Those two fit together. Both can be true."); track("objection", { ok: false, pair: sel.join("|") }); sel = []; var y = window.scrollY; render(); window.scrollTo(0, y); return; }
          sel = []; S.contra = true; save(); shake(); track("objection", { ok: true });
          comic([{ img: img("insight"), move: "pushSlow", fx: ["memory"], sfx: "OBJECTION!", caption: C.insight.text, audio: "insight", dur: 9000 }], function () { render(); });
        });
      }
    };
  }

  // ---------- accusation: name the thief, then the lie ----------
  function accuseTab() {
    return {
      html: '<div class="card"><b>' + esc(C.finale.accuse) + '</b><p class="muted small">Name the ' + esc(C.crimeNoun || "culprit") + ', then prove it to their face: break their story, then show the evidence. A wrong answer costs a star.</p><div class="pick">' + C.suspects.map(function (s) {
        return '<button class="pk" data-acc="' + s.id + '"><img src="' + img("face_" + s.id) + '" alt=""><b>' + esc(short(s.id)) + "</b></button>"; }).join("") + "</div></div>",
      wire: function () { on("[data-acc]", function () { accuse(this.getAttribute("data-acc")); }); }
    };
  }
  function witnessAgainst(id) { // a heard, truthful statement that puts `id` away from the scene at the crime time
    var w = null;
    C.suspects.forEach(function (s) { if (w || s.id === id || s.id === C.answer.killer) return; ["where", "see"].forEach(function (k) {
      (s.answers[k].claims || []).forEach(function (c) { if (!w && c[1] === id && c[3] === CT && c[2] !== CP) w = { by: s.id, k: k, place: c[2] }; }); }); });
    return w;
  }
  function wrong(msg, again, what) {
    S.wrong++; save(); shake(); track(what || "wrong", { n: S.wrong });
    if (S.wrong >= 3) { S.failed = true; S.t1 = Date.now(); save(); view.screen = "end"; return render(); }
    modal('<h3>Not quite</h3><p>' + msg + '</p><p class="muted small">Stars left: ' + stars() + '</p><button class="btn" data-close>Think again</button>', again);
  }
  function accuse(id) {
    if (id !== C.answer.killer) {
      var w = witnessAgainst(id);
      track("accuse", { who: id, ok: false });
      return wrong(w ? esc(short(w.by)) + " puts " + esc(short(id)) + " at " + esc(C.places[w.place]) + " at " + esc(C.times[CT]) + ", not in " + esc(C.places[CP]) + ". Someone else is lying." : esc(short(id)) + "’s story holds up. Look again.");
    }
    if (!C.clues.some(function (c) { return c.proof && S.found.indexOf(c.id) >= 0; }))
      return modal("<h3>Not so fast</h3><p>You may be right, but you’ll need evidence to make it stick. Search the crime scene first.</p><button class=\"btn\" data-close>Search the scene</button>", function () { view.tab = "scene"; render(); });
    track("accuse", { who: id, ok: true });
    confront(id);
  }

  // ---------- confrontation: break their story, then show the evidence ----------
  function breakers(id) { // other people's statements that cannot be true together with one of the culprit's lies
    var out = [];
    C.answer.lies.forEach(function (lk) {
      var lie = sus(id).answers[lk].claims || [];
      C.suspects.forEach(function (s) { if (s.id === id) return; ["where", "see"].forEach(function (k) {
        var key = s.id + ":" + k; if (out.indexOf(key) < 0 && !possible(lie.concat(s.answers[k].claims || []))) out.push(key); }); });
    });
    return out;
  }
  function confront(id) {
    var F = C.finale, good = breakers(id), step = 0;
    var offered = []; C.suspects.forEach(function (s) { if (s.id !== id) ["where", "see"].forEach(function (k) { var key = s.id + ":" + k; if (heard(s.id, k) || good.indexOf(key) >= 0 && S.contra) offered.push(key); }); });
    var ev = C.clues.filter(function (c) { return !c.collector && S.found.indexOf(c.id) >= 0; });
    stop(); BG.scene(true); // the confrontation is a story moment: music back in
    var ov = document.createElement("div"); ov.className = "confront"; document.body.appendChild(ov);
    ov.innerHTML = '<div class="cf-stage"><div class="cf-spot"></div><div class="cf-facebox"><img class="cf-face" src="' + img("face_" + id) + '" alt=""><i class="drop d1"></i><i class="drop d2"></i></div>' +
      '<div class="cf-bubble"><b>' + esc(short(id)) + '</b>“<span class="cf-line"></span>”</div><div class="cf-bang"></div></div><div class="cf-ask"></div>';
    function say(text, key, mood) {
      var face = ov.querySelector(".cf-face");
      if (mood) { face.classList.add("swap"); setTimeout(function () { face.src = img("confront_" + mood); face.classList.remove("swap"); }, 260); ov.classList.toggle("sweating", mood === "sweat"); ov.classList.toggle("broken", mood === "broken"); }
      if (key) play(key); else stop();
      typeOut(ov.querySelector(".cf-line"), text, !!key);
    }
    function bang(t) { var b = ov.querySelector(".cf-bang"); b.textContent = t; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); shake(); }
    function ask(title, items, onPick) {
      ov.querySelector(".cf-ask").innerHTML = '<p class="cf-q">' + title + '</p><div class="cf-cards">' + items.map(function (it) {
        return '<button class="cf-card" data-v="' + it.v + '">' + '<img src="' + it.img + '" alt=""><span>' + it.label + "</span></button>"; }).join("") + "</div>";
      ov.querySelectorAll(".cf-card").forEach(function (b) { b.onclick = function () { onPick(b.getAttribute("data-v"), b); }; });
      ov.querySelector(".cf-ask").scrollTop = 0;
    }
    function miss(b) {
      S.wrong++; save(); track("confront_wrong", { step: step + 1, n: S.wrong }); b.classList.add("no"); b.disabled = true; shake();
      if (S.wrong >= 3) { stop(); ov.remove(); S.failed = true; S.t1 = Date.now(); save(); view.screen = "end"; return render(); }
      say(["Is that all, Detective?", "Ha! That proves nothing.", "You are wasting my time."][Math.min(2, S.wrong - 1)] + " (stars left: " + stars() + ")", null);
    }
    say(F.deny, id + "_deny");
    ask("Present the statement that breaks " + esc(short(id)) + "’s story", offered.map(function (k) { var p = k.split(":");
      return { v: k, img: img("face_" + p[0]), label: "<b>" + esc(short(p[0])) + ":</b> “" + esc(sus(p[0]).answers[p[1]].text) + "”" }; }), function (v, b) {
      if (good.indexOf(v) < 0) return miss(b);
      step = 1; bang("OBJECTION!"); say(F.crack1, id + "_crack1", "sweat"); track("confront_ok", { step: 1 });
      ask("Now the evidence. What puts " + esc(short(id)) + " at the scene?", ev.map(function (c) { return { v: c.id, img: img("clue_" + c.id), label: "<b>" + esc(c.title) + "</b>" }; }), function (v2, b2) {
        if (!clue(v2).proof) return miss(b2);
        step = 2; bang("TAKE THAT!"); say(F.crack2, id + "_crack2", "broken");
        S.solved = true; S.stars = stars(); S.t1 = Date.now(); S.goals = earnBadges(); save();
        track("solve", { stars: S.stars, mins: Math.round((S.t1 - S.t0) / 6000) / 10, wrong: S.wrong, hints: S.hints, goals: S.goals });
        ov.querySelector(".cf-ask").innerHTML = '<div class="cf-done"><button class="btn big" id="cfend">Hear the confession ›</button></div>';
        ov.querySelector("#cfend").onclick = function () {
          stop(); ov.remove();
          comic([{ img: img("confess_0"), move: "pushSlow", fx: ["memory"], caption: F.confession, audio: id + "_confession", dur: 10000 },
                 { img: img("ending"), move: "pullBack", caption: F.ending, audio: "ending", dur: 11000 }]
            .concat(C.collector ? [{ img: img("collector"), move: "pushSlow", fx: ["flicker"], caption: C.collector.caption, audio: "collector", dur: 11000 }] : [])
            .concat(C.teaser ? [{ img: img("teaser"), move: "panRight", caption: C.teaser.caption, audio: "teaser", dur: 7000 }] : []), function () { view.screen = "end"; render(); confetti(); });
        };
      });
    });
  }

  function end() {
    var mins = Math.max(1, Math.round((S.t1 - S.t0) / 60000));
    var share = (C.emoji || "🔎") + " " + C.title + " (" + C.city + ")\n" + (S.solved ? "Case closed " + "⭐".repeat(stars()) : "The " + (C.crimeNoun || "culprit") + " got away 💨") + " · " + mins + " min";
    h('<div class="card endc">' + (S.solved ? '<h1 class="stampin good">Case closed</h1><div class="stars">' + [0, 1, 2].map(function (i) { return '<span class="star' + (i < stars() ? "" : " dim") + '" style="--i:' + i + '">★</span>'; }).join("") + "</div>"
      : '<h1 class="bad">The ' + esc(C.crimeNoun || "culprit") + ' got away</h1><p>Three wrong answers. Try again: the clues are all there.</p>') +
      '<img class="endimg" src="img/face_' + C.answer.killer + '.jpg" alt=""><p class="muted small">Time ' + mins + " min · wrong answers " + S.wrong + " · Collector card: " + (S.moth ? "found 🦋" : "missed") + "</p>" +
      (S.solved ? goalRow(S.goals || [], badges()) : "") +
      '<pre class="share">' + esc(share) + '</pre><div class="row c"><a class="btn maplink" href="../index.html">' + (S.solved ? "Travel on ›" : "Back to the map") + '</a><button class="btn ghost" id="copy">Copy result</button><button class="btn ghost" id="restart">Play again</button></div></div>');
    on("#copy", function () { try { navigator.clipboard.writeText(share); toast("Copied. Share it (no spoilers)!"); } catch (e) {} });
    on("#restart", function () { S = fresh(); S.tut = 99; save(); view = { screen: "title", tab: "suspects", who: null }; render(); });
  }

  // ---------- hints: chosen from what the player has not done yet (free on easy cases) ----------
  function hint() {
    var t = !PEOPLE.every(function (p) { return heard(p, "where"); }) ? C.hints.ask : !S.contra ? C.hints.contra : C.hints.accuse;
    S.hints++; save(); track("hint", { n: S.hints, stage: t === C.hints.ask ? "ask" : t === C.hints.contra ? "contra" : "accuse" });
    modal('<h3>Detective’s hunch</h3><div class="bubble">' + esc(t) + '</div><button class="btn" data-close>Thanks</button>');
  }

  // ---------- tutorial coach: this first case teaches every move ----------
  var hubNow = function () { return !view.who; };
  var A = C.insight.pair, P0 = A[0].split(":")[0], P1 = A[1].split(":")[0];
  var witness = C.suspects.filter(function (s) { return A.every(function (k) { return k.split(":")[0] !== s.id; }); })[0].id;
  var STEPS = [
    { target: '[data-who="' + P0 + '"]', show: function () { return hubNow() && view.tab === "suspects"; }, alt: '[data-tab="suspects"]',
      text: "Welcome, detective. Let’s question someone. Tap <b>" + esc(short(P0)) + "</b>.", done: function () { return view.who === P0 || heard(P0, "where"); } },
    { target: '[data-q="where"]', show: function () { return view.who === P0; }, alt: "#back",
      text: "Ask the big question: <b>where were they?</b> The theft happened at " + esc(C.times[CT]) + ".", done: function () { return heard(P0, "where"); } },
    { target: '[data-who="' + P1 + '"]', show: function () { return hubNow() && view.tab === "suspects"; }, alt: "#back",
      text: "Noted. Now ask <b>" + esc(short(P1)) + "</b> the same thing.", done: function () { return view.who === P1 || heard(P1, "where"); } },
    { target: '[data-q="where"]', show: function () { return view.who === P1; }, alt: "#back",
      text: "Ask: <b>where were you?</b> Listen carefully…", done: function () { return heard(P1, "where"); } },
    { target: '[data-tab="notebook"]',
      text: "Hmm. Something doesn’t add up. Open your <b>Notebook</b>.", done: function () { return (hubNow() && view.tab === "notebook") || S.contra; } },
    { target: '[data-k="' + A[0] + '"]', show: function () { return hubNow() && view.tab === "notebook"; }, alt: '[data-tab="notebook"]',
      text: "Everything they said is here. Tap <b>" + esc(short(P0)) + "’s</b> statement.", done: function () { return sel.indexOf(A[0]) >= 0 || S.contra; } },
    { target: '[data-k="' + A[1] + '"]', show: function () { return hubNow() && view.tab === "notebook"; }, alt: '[data-tab="notebook"]',
      text: "Now tap <b>" + esc(short(P1)) + "’s</b>. Can both be true at " + esc(C.times[CT]) + "?", done: function () { return sel.length === 2 || S.contra; } },
    { target: "#object", show: function () { return hubNow() && view.tab === "notebook"; }, alt: '[data-tab="notebook"]',
      text: "They can’t! Shout it: tap <b>Objection!</b>", done: function () { return S.contra; } },
    { target: function () { return view.who === witness ? '[data-q="see"]' : view.who ? "#back" : view.tab === "suspects" ? '[data-who="' + witness + '"]' : '[data-tab="suspects"]'; },
      text: "One of them is lying. But which? A witness can tell you. Ask <b>" + esc(short(witness)) + "</b>: “Who did you see?”", done: function () { return heard(witness, "see"); } },
    { target: '[data-tab="scene"]',
      text: "Now search the <b>Crime scene</b>. Drag your torch and tap what glints.", done: function () { return S.found.length; } },
    { target: '[data-tab="accuse"]',
      text: "Who lied? The person a witness puts somewhere else can’t be the thief. When you’re sure, <b>Accuse</b>. Stuck? Tap <b>Hint</b>, it’s free in this case.", button: "Got it" }
  ];
  var coachEl = null, coachShown = -1, scrolledFor = "", lastTarget = null;
  function coach() {
    var active = C.tutorial && S.started && !S.solved && !S.failed && view.screen === "hub" && S.tut < STEPS.length && !modalEl && !document.querySelector(".comic");
    while (active && S.tut < STEPS.length && STEPS[S.tut].done && STEPS[S.tut].done()) { S.tut++; save(); }
    var st = active && S.tut < STEPS.length ? STEPS[S.tut] : null;
    var selq = st ? (st.show && !st.show() ? st.alt : typeof st.target === "function" ? st.target() : st.target) : null;
    var t = selq ? app.querySelector(selq) : null;
    if (lastTarget && lastTarget !== t) lastTarget.classList.remove("coach-target");
    lastTarget = t;
    document.body.classList.toggle("coaching", !!st);
    if (!st) { if (coachEl) { coachEl.remove(); coachEl = null; coachShown = -1; } return; }
    if (t) { t.classList.add("coach-target"); if (scrolledFor !== S.tut + selq) { scrolledFor = S.tut + selq; t.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "center" }); } }
    if (coachShown === S.tut) return;
    coachShown = S.tut;
    if (!coachEl) { coachEl = document.createElement("div"); coachEl.className = "coach"; coachEl.setAttribute("role", "status"); document.body.appendChild(coachEl); }
    coachEl.innerHTML = '<div class="cicon">🔎</div><div class="ctext"><div class="chead">Detective’s notes · ' + (S.tut + 1) + "/" + STEPS.length + "</div><p>" + st.text + '</p><div class="crow">' +
      (st.button ? '<button class="btn small" id="cnext">' + st.button + "</button>" : "") + '<button class="cskip" id="cskip">Skip tutorial</button></div></div>';
    coachEl.classList.remove("cin"); void coachEl.offsetWidth; coachEl.classList.add("cin");
    var nx = coachEl.querySelector("#cnext"); if (nx) nx.addEventListener("click", function () { S.tut++; save(); coach(); });
    coachEl.querySelector("#cskip").addEventListener("click", function () { track("guide_skip", { step: S.tut + 1 }); S.tut = STEPS.length; save(); coach(); });
  }

  // ---------- modal, toast ----------
  var modalEl = null;
  function modal(inner, onClose) {
    closeModal();
    var o = document.createElement("div"); o.className = "overlay"; o.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + inner + "</div>";
    o.addEventListener("click", function (e) { if (e.target === o || (e.target.hasAttribute && e.target.hasAttribute("data-close"))) { closeModal(); if (onClose) onClose(); } });
    document.body.appendChild(o); modalEl = o;
  }
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
  function toast(t) { var d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200); }

  render();
  setInterval(coach, 300);
})();
