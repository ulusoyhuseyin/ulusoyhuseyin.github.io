// Episode player for "circle" cases: motion-comic sequences + investigation hub.
(function () {
  var C = window.CASE, CO = window.COLDOPEN || [], app = document.getElementById("app");
  if (C.sealed) { // preview builds scramble the answer, the finale and the confession (scripts/build_preview.py)
    try { var sk = "grand-tour-1926", raw = atob(C.sealed), txt = ""; for (var si = 0; si < raw.length; si++) txt += String.fromCharCode(raw.charCodeAt(si) ^ sk.charCodeAt(si % sk.length));
      var so = JSON.parse(txt); for (var sk2 in so) if (sk2 !== "_conf") C[sk2] = so[sk2];
      C.suspects.forEach(function (x) { if (so._conf && so._conf[x.id]) x.confession = so._conf[x.id]; }); } catch (e) {}
  }
  var KEY = "episode." + C.id + ".v1";
  var CALM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SUS = C.suspects.slice(), PARROT = C.parrot;
  var ALL = SUS.concat([PARROT]);
  var NAME = {}; ALL.forEach(function (p) { NAME[p.id] = p.name; }); NAME[C.victim.id] = C.victim.name;
  var SHORT = function (id) { var n = NAME[id] || id; return id === "colonel" ? "the Colonel" : id === "viola" ? "Mrs. Ashcombe" : id === "celeste" ? "Lady Celeste" : id === "felix" ? "Dr. Hartmann" : id === "basil" ? "Mr. Crane" : id === "oriel" ? "Madame Oriel" : n.split(" ")[0]; };
  var Q = { held: "Whose hands did you hold?", noticed: "What did you notice in the dark?", suspect: "Who do you think did it?" };
  var S = load() || fresh();
  var view = { screen: S.started ? "hub" : "title", tab: "suspects", who: null };
  var audio = new Audio(), typingNow = 0;

  function fresh() { return { started: false, asked: {}, found: [], secrets: {}, contra: [], insight: false, twist: false, hints: 0, wrong: 0, solved: false, failed: false, t0: 0, t1: 0, step: 0, tut: 0, coachOk: 0 }; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(s) { return app.querySelector(s); }
  function on(sel, fn) { app.querySelectorAll(sel).forEach(function (el) { el.addEventListener("click", fn); }); }
  function stars() { return Math.max(1, 3 - S.hints - S.wrong); }
  function clue(id) { return C.clues.filter(function (c) { return c.id === id; })[0]; }
  function sus(id) { return ALL.filter(function (s) { return s.id === id; })[0]; }
  function img(n) { return "img/" + n + ".jpg"; }

  // ---------- audio + speaking ----------
  function setSpeaking(on) { document.body.classList.toggle("speaking", !!on); }
  // background music (audio/music.m4a): quiet loop, steps back while someone speaks; shares the on/off setting with the map
  var MUSIC_VOL = 0.16, music = null, ducked = false;
  var soundOn = (function () { try { return JSON.parse(localStorage.getItem("tour.sound")) !== false; } catch (e) { return true; } })();
  function musicVol() { if (music) music.volume = soundOn ? (ducked ? MUSIC_VOL * 0.35 : MUSIC_VOL) : 0; }
  function startMusic() { if (music) return; try { music = new Audio("audio/music.m4a"); music.loop = true; musicVol(); music.addEventListener("error", function () { music = null; }); music.play().catch(function () {}); } catch (e) { music = null; } }
  ["pointerdown", "keydown"].forEach(function (ev) { window.addEventListener(ev, startMusic, { once: true }); });
  function toggleSound() { soundOn = !soundOn; try { localStorage.setItem("tour.sound", JSON.stringify(soundOn)); } catch (e) {} audio.muted = !soundOn; musicVol(); return soundOn; }
  audio.muted = !soundOn;
  audio.addEventListener("playing", function () { setSpeaking(true); ducked = true; musicVol(); });
  ["pause", "ended", "error"].forEach(function (ev) { audio.addEventListener(ev, function () { ducked = false; musicVol(); if (!typingNow) setSpeaking(false); }); });
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
  // panels: {img, move, fx[], sfx, caption, bubble, audio, dur}
  function comic(panels, onDone) {
    stop();
    var ov = document.createElement("div"); ov.className = "comic";
    ov.innerHTML = '<div class="stage"></div><div class="cprog"></div><button class="skip">Skip ›</button>' +
      '<div class="rotate"><span class="ri">📱↻</span> Turn your phone sideways for the full picture</div>';
    document.body.appendChild(ov);
    var turned = landscape(true);
    var stage = ov.querySelector(".stage"), i = -1, timer = null, ended = false;
    function fx(list) { return (list || []).map(function (f) { return '<div class="fx ' + f + '"></div>'; }).join(""); }
    function next() {
      clearTimeout(timer); i++;
      if (i >= panels.length) return finish();
      var p = panels[i];
      var base = p.dur || (p.caption ? Math.max(4200, p.caption.length * 70) : 3600);
      var el = document.createElement("div"); el.className = "panel in" + (p.img ? "" : " black");
      var dur = (base + 2500) + "ms", sweep = CALM ? "" : p.move === "panLeft" ? "sweepL" : "sweepR"; // phones: the panel sweeps across a tall frame, words below
      el.innerHTML = (p.img ? '<div class="camclip"><div class="cam ' + (CALM ? "" : p.move || "push") + '" style="animation-duration:' + dur + '"><img class="' + sweep + '" style="animation-duration:' + dur + '" src="' + esc(p.img) + '" alt=""></div></div>' : "") + fx(p.fx) + '<div class="vignette"></div>' +
        (p.sfx ? '<div class="sfx">' + esc(p.sfx) + "</div>" : "") + '<div class="cwords">' + (p.bubble ? '<div class="cbubble">' + esc(p.bubble) + "</div>" : "") +
        (p.caption ? '<div class="caption"><span>' + esc(p.caption) + "</span></div>" : "") + "</div>";
      stage.appendChild(el);
      var olds = stage.querySelectorAll(".panel"); if (olds.length > 1) { var o = olds[0]; o.classList.add("out"); setTimeout(function () { o.remove(); }, 900); }
      if (p.sfx || !p.img) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }
      ov.querySelector(".cprog").style.width = ((i + 1) / panels.length * 100) + "%";
      if (p.audio) {
        play(p.audio);
        var waitAudio = function () { var d = audio.duration && isFinite(audio.duration) ? audio.duration * 1000 + 700 : base; clearTimeout(timer); timer = setTimeout(next, Math.max(d, 2600)); };
        audio.addEventListener("loadedmetadata", waitAudio, { once: true });
        audio.addEventListener("error", function () { clearTimeout(timer); timer = setTimeout(next, base); }, { once: true });
        timer = setTimeout(next, base + 6000);
      } else timer = setTimeout(next, base);
    }
    function finish() { if (ended) return; ended = true; clearTimeout(timer); stop(); if (turned) landscape(false); ov.classList.add("bye"); setTimeout(function () { ov.remove(); if (onDone) onDone(); }, 500); }
    stage.addEventListener("click", next);
    ov.querySelector(".skip").addEventListener("click", finish);
    next();
  }

  // ---------- screens ----------
  function render() { closeModal(); if (view.screen === "title") return title(); if (view.screen === "end") return end(); hub(); }

  function title() {
    h('<div class="title"><img class="hero" src="img/co_p1.jpg" alt=""><div class="tcard"><p class="kicker">A case file · 1926</p><h1>' + esc(C.title) + '</h1><p class="tag">' + esc(C.tagline) + '</p><button class="btn big" id="go">Open the case</button><p class="muted small">Sound on. About 20 minutes. One answer you can prove.</p></div></div>');
    on("#go", function () {
      comic(CO, function () { S.started = true; S.t0 = S.t0 || Date.now(); save(); view.screen = "hub"; render(); rules(); });
    });
  }

  function rules() {
    modal('<h3>The rules of this case</h3><p>' + esc(C.rule) + '</p><p class="muted small">Question everyone. Look at their hands. Show them evidence: everyone hides something. When you know who broke the circle, make your accusation.</p><button class="btn" data-close>Begin</button>');
  }

  function hub() {
    var tabs = [["suspects", "Suspects", "👥"], ["scene", "Crime scene", "🔦"], ["seating", "Seating", "🪑"], ["accuse", "Accuse", "⚖️"]];
    var body = view.who ? profile(view.who) : { suspects: suspectsTab, scene: sceneTab, seating: seatingTab, accuse: accuseTab }[view.tab]();
    h('<div class="topbar"><a class="btn ghost small" href="../index.html" style="text-decoration:none">‹ Map</a><h2 style="flex:1;text-align:center">' + esc(C.title) + '</h2><button class="btn ghost small" id="snd" aria-label="Sound on or off">' + (soundOn ? "🔊" : "🔇") + '</button> <button class="btn ghost small" id="hint">Hint (' + (C.hints.length - S.hints) + ')</button></div>' +
      '<nav class="tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (view.tab === t[0] && !view.who ? "on" : "") + '"><span class="ti">' + t[2] + "</span>" + t[1] + (t[0] === "seating" && S.insight ? " ✓" : "") + "</button>"; }).join("") + "</nav>" + body.html);
    on("[data-tab]", function () { view.tab = this.getAttribute("data-tab"); view.who = null; stop(); render(); });
    on("#hint", hint);
    on("#snd", function () { this.textContent = toggleSound() ? "🔊" : "🔇"; });
    if (body.wire) body.wire();
  }

  function suspectsTab() {
    return {
      html: '<p class="muted small">Six guests and one parrot were in the salon. Tap someone to question them.</p><div class="grid">' + ALL.map(function (s, k) {
        var n = Object.keys(Q).filter(function (q) { return S.asked[s.id + "_" + q]; }).length;
        return '<button class="sus" style="--i:' + k + '" data-who="' + s.id + '"><img src="' + img("face_" + s.id) + '" alt=""><div class="meta"><b>' + esc(s.name) + '</b><span class="muted small">' + esc(s.role) + "</span>" +
          (S.secrets[s.id] ? '<span class="badge">Secret revealed</span>' : s.id === "captain" ? "" : '<span class="pips">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < n ? "on" : "") + '"></i>'; }).join("") + "</span>") + "</div></button>";
      }).join("") + "</div>",
      wire: function () { on("[data-who]", function () { view.who = this.getAttribute("data-who"); view.fresh = true; render(); play(view.who + (view.who === "captain" ? "_0" : "_intro")); }); }
    };
  }

  function profile(id) {
    var s = sus(id), parrot = id === "captain";
    var html = '<button class="btn ghost small" id="back">‹ All suspects</button><div class="card prof"><div class="phead"><div class="talker"><img src="' + img("face_" + id) + '" alt=""><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div><div><h2>' + esc(s.name) + '</h2><div class="muted">' + esc(s.role) + '</div><span class="arch">' + esc(s.archetype) + "</span>" +
      (C.hands[id] ? '<div class="hands"><b>Hands:</b> ' + esc(C.hands[id].text) + "</div>" : "") + "</div></div>";
    if (parrot) {
      html += '<div class="bubble">“<span class="line">Awk! Cracker? Cracker?</span>”</div><div class="qs">' + s.lines.map(function (l, k) { return '<button data-pl="' + k + '">Offer a cracker (' + (k + 1) + ")</button>"; }).join("") + "</div></div>";
      return { html: html, wire: function () {
        on("#back", function () { view.who = null; stop(); render(); });
        on("[data-pl]", function () { var k = +this.getAttribute("data-pl"); S.asked["captain_" + k] = 1; save(); play("captain_" + k); typeOut($(".line"), s.lines[k], true); });
      } };
    }
    var answers = { held: s.held.text, noticed: s.noticed, suspect: s.suspect };
    html += '<div class="bubble">“<span class="introline">' + esc(s.intro) + '</span>”</div>' +
      Object.keys(Q).filter(function (q) { return S.asked[id + "_" + q]; }).map(function (q) { return '<div class="bubble said" data-said="' + q + '"><div class="muted small">' + Q[q] + '</div>“<span class="words">' + esc(answers[q]) + "</span>”</div>"; }).join("") +
      (S.secrets[id] ? '<div class="bubble secret"><div class="muted small">Their secret</div>“' + esc(s.secret.text) + "”</div>" : "") +
      '<div class="qs">' + Object.keys(Q).map(function (q) { return '<button data-q="' + q + '" class="' + (S.asked[id + "_" + q] ? "asked" : "") + '">' + (S.asked[id + "_" + q] ? "▶ Again: " : "Ask: ") + Q[q] + "</button>"; }).join("") +
      '<button class="show" id="show">🔎 Show evidence…</button></div></div>';
    return { html: html, wire: function () {
      on("#back", function () { view.who = null; stop(); render(); });
      on("[data-q]", function () { var q = this.getAttribute("data-q"); S.asked[id + "_" + q] = 1; save(); render(); play(id + "_" + q);
        var b = $('[data-said="' + q + '"] .words'); if (b) { b.parentNode.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "center" }); typeOut(b, answers[q], true); } });
      on("#show", function () { showEvidence(s); });
      if (view.fresh) { view.fresh = false; typeOut($(".introline"), s.intro, true); }
    } };
  }

  function showEvidence(s) {
    var have = C.clues.filter(function (c) { return S.found.indexOf(c.id) >= 0; });
    if (!have.length) return modal('<h3>No evidence yet</h3><p>Search the crime scene first.</p><button class="btn" data-close>OK</button>');
    modal('<h3>Show ' + esc(SHORT(s.id)) + ' which evidence?</h3><div class="evlist">' + have.map(function (c) { return '<button class="ev" data-ev="' + c.id + '"><img src="' + img("clue_" + c.id) + '" alt=""><span>' + esc(c.title) + "</span></button>"; }).join("") + '</div><button class="btn ghost" data-close>Cancel</button>');
    document.querySelectorAll(".overlay [data-ev]").forEach(function (b) { b.addEventListener("click", function () {
      var ev = b.getAttribute("data-ev"); closeModal();
      if (s.secret && s.secret.evidence === ev && !S.secrets[s.id]) {
        S.secrets[s.id] = 1; save();
        comic([{ img: img("secret_" + s.id + "_0"), move: "pushSlow", fx: ["memory"], caption: s.secret.text, audio: s.id + "_secret" }], function () { render(); toast("Secret revealed: " + SHORT(s.id) + " is hiding something, but not murder."); });
      } else if (s.deflect && s.deflect[ev]) {
        play(s.id + "_deflect_" + ev); modal('<div class="react"><img src="' + img("face_" + s.id) + '" alt=""><p>“<span class="dl"></span>”</p></div><button class="btn" data-close>Hmm.</button>'); typeOut(document.querySelector(".overlay .dl"), s.deflect[ev], false);
      } else {
        modal('<div class="react"><img src="' + img("face_" + s.id) + '" alt=""><p>' + esc(SHORT(s.id)) + ' looks at it and shrugs. “I don’t see what that has to do with me.”</p></div><button class="btn" data-close>OK</button>');
      }
    }); });
  }

  // ---------- crime scene ----------
  function sceneTab() {
    var vis = C.clues.filter(function (c) { return !c.locked || S.twist; });
    var found = vis.filter(function (c) { return S.found.indexOf(c.id) >= 0; });
    return {
      html: '<p class="muted small">The salon, lights on. Search it with your torch (' + found.length + "/" + vis.length + ' found).</p><div class="scenescroll"><div class="scenepic' + (found.length < vis.length && !CALM ? " dark" : "") + '"><img src="img/scene.jpg" alt="The crime scene">' +
        vis.map(function (c) { return '<button class="spot' + (S.found.indexOf(c.id) >= 0 ? " found" : "") + '" data-clue="' + c.id + '" style="left:' + c.spot[0] * 100 + "%;top:" + c.spot[1] * 100 + '%" aria-label="Examine ' + esc(c.title) + '"></button>'; }).join("") + '<div class="torch"></div></div></div>' +
        '<div class="cluegrid">' + found.map(function (c) { return '<button class="cl" data-clue="' + c.id + '"><img src="' + img("clue_" + c.id) + '" alt=""><span>' + esc(c.title) + "</span></button>"; }).join("") + "</div>",
      wire: function () {
        var sp = $(".scenepic");
        var move = function (e) { var r = sp.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; sp.style.setProperty("--x", t.clientX - r.left + "px"); sp.style.setProperty("--y", t.clientY - r.top + "px"); };
        sp.addEventListener("pointermove", move); sp.addEventListener("pointerdown", move); sp.addEventListener("touchmove", move, { passive: true });
        on("[data-clue]", function () { openClue(this.getAttribute("data-clue")); });
      }
    };
  }
  function openClue(id) {
    var c = clue(id), first = S.found.indexOf(id) < 0;
    if (first) { S.found.push(id); save(); }
    play("clue_" + id);
    modal('<div class="evid"><img class="clueimg" src="' + img("clue_" + id) + '" alt=""><span class="stamp">Evidence</span></div><h3>' + esc(c.title) + '</h3><p class="ct"></p><button class="btn" data-close>Note it</button>', function () {
      stop();
      var vis = C.clues.filter(function (x) { return !x.locked; });
      if (!S.twist && S.found.filter(function (f) { return vis.some(function (v) { return v.id === f; }); }).length >= C.twist.after) return twist();
      render();
    });
    typeOut(document.querySelector(".overlay .ct"), c.text, false);
  }
  function twist() {
    S.twist = true; save();
    var tp = C.twist.panels.map(function (p, k) { return { img: img("twist_" + k), move: k === 1 ? "pushSlow" : "push", fx: k === 0 ? ["flicker"] : [], sfx: p.sfx, caption: p.caption, audio: "twist_" + k }; });
    comic(tp, function () { view.tab = "scene"; render(); toast("New evidence appeared at the crime scene."); });
  }

  // ---------- seating chart + contradictions ----------
  function seatingTab() {
    var seats = C.seats, n = seats.length, R = 38;
    var pos = seats.map(function (p, k) { var a = -Math.PI / 2 + k * 2 * Math.PI / n; return [50 + R * Math.cos(a), 50 + R * Math.sin(a)]; });
    var circle = '<div class="table"><div class="tabletop"></div>' + seats.map(function (p, k) {
      return '<div class="seat' + (p === C.victim.id ? " victim" : "") + '" style="left:' + pos[k][0] + "%;top:" + pos[k][1] + '%"><img src="' + img("face_" + p) + '" alt=""><span>' + esc(SHORT(p)) + "</span></div>";
    }).join("") + "</div>";
    var rows = [];
    C.suspects.forEach(function (s) {
      if (!S.asked[s.id + "_held"]) return;
      var i = seats.indexOf(s.id);
      s.held.claims.forEach(function (c) {
        var other = c[1] === "left" ? seats[(i - 1 + n) % n] : seats[(i + 1) % n];
        var feltText = { rings: "bony fingers covered in rings", signet: "a heavy signet ring", lace: "a black lace glove", bracelet: "a warm bare hand and a bracelet", bitten: "cold, trembling, bitten nails", ink: "inky fingers", cotton: "a cotton glove" }[c[2]];
        var k = s.id + ">" + other, done = S.contra.indexOf(k) >= 0;
        rows.push('<div class="hrow' + (done ? " caught" : "") + '" data-row="' + s.id + '"><img src="' + img("face_" + s.id) + '" alt=""><div><b>' + esc(SHORT(s.id)) + "</b> held <b>" + esc(SHORT(other)) + "</b> with the " + c[1] + " hand and felt <i>" + esc(feltText) + "</i>." +
          '<div class="muted small">' + esc(SHORT(other)) + "’s hands: " + esc(C.hands[other].text) + "</div>" +
          (done ? '<div class="caughtnote">✗ Doesn’t match!</div>' : '<div class="row"><button class="btn small" data-ok="' + k + '">Matches</button><button class="btn small warn" data-no="' + k + '" data-tag="' + c[2] + '" data-other="' + other + '">Objection! Doesn’t match</button></div>') + "</div></div>");
      });
    });
    return {
      html: '<p class="muted small">' + esc(C.seatNote) + "</p>" + circle +
        (S.insight ? '<div class="card insight"><b>' + esc(C.insight.title) + "</b><p>" + esc(C.insight.text) + "</p></div>" : "") +
        '<h3 class="sub">What they felt in the dark</h3>' + (rows.length ? rows.join("") : '<p class="muted small">Ask the guests “Whose hands did you hold?” and their answers appear here.</p>'),
      wire: function () {
        on("[data-ok]", function () { S.coachOk = 1; save(); toast("Noted."); this.closest(".hrow").classList.add("checked"); });
        on("[data-no]", function () {
          var k = this.getAttribute("data-no"), tag = this.getAttribute("data-tag"), other = this.getAttribute("data-other");
          if (C.hands[other].tag !== tag) {
            if (S.contra.indexOf(k) < 0) S.contra.push(k); save();
            var need = C.insight.requires.every(function (r) { return S.contra.indexOf(r[0] + ">" + r[1]) >= 0; });
            if (need && !S.insight) { S.insight = true; save(); comic([{ img: img("insight"), move: "pushSlow", fx: ["memory"], caption: C.insight.title + " " + C.insight.text, audio: "insight", dur: 9000 }], function () { render(); }); }
            else { shake(); render(); toast("Objection sustained! That hand isn’t who they think it was."); }
          } else { S.wrong += 0; toast("Look again: that matches " + SHORT(other) + "’s hands."); }
        });
      }
    };
  }

  // ---------- accusation + finale ----------
  function accuseTab() {
    return {
      html: '<div class="card"><b>Who broke the circle?</b><p class="muted small">Accuse someone, then prove it step by step. Every wrong answer costs a star.</p><div class="pick">' + C.suspects.map(function (s) {
        return '<button class="pk" data-acc="' + s.id + '"><img src="' + img("face_" + s.id) + '" alt=""><span>' + esc(s.name) + "</span></button>"; }).join("") + "</div></div>",
      wire: function () { on("[data-acc]", function () { accuse(this.getAttribute("data-acc")); }); }
    };
  }
  function accuse(id) {
    if (id !== C.killer) {
      S.wrong++; save(); shake();
      var s = sus(id), i = C.seats.indexOf(id), n = C.seats.length;
      var wit = C.suspects.filter(function (w) { return w.id !== C.killer && (w.id === C.seats[(i - 1 + n) % n] || w.id === C.seats[(i + 1) % n]); })[0];
      var msg = wit ? SHORT(wit.id) + " felt " + SHORT(id) + "’s hand the whole time: " + C.hands[id].text.toLowerCase() + " Their hands were held." : "Their story holds.";
      if (S.wrong >= 3) return lose();
      return modal('<h3 class="bad">The circle holds</h3><p>' + esc(msg) + '</p><p class="muted small">Accusations left: ' + (3 - S.wrong) + '</p><button class="btn" data-close>Back to the case</button>');
    }
    S.step = 0; save(); finaleStep();
  }
  function evidenceOptions() {
    var o = [];
    if (S.insight) o.push(["insight", "The joined hands", "insight"]);
    C.clues.forEach(function (c) { if (S.found.indexOf(c.id) >= 0) o.push([c.id, c.title, "clue_" + c.id]); });
    if (Object.keys(S.asked).some(function (k) { return k.indexOf("captain_") === 0; })) o.push(["parrot", "Captain the parrot: “Jingle jingle!”", "face_captain"]);
    ["colonel", "viola", "felix"].forEach(function (w) { if (S.asked[w + "_noticed"]) o.push([w, SHORT(w) + "’s testimony: something jingled, moving", "face_" + w]); });
    return o;
  }
  function finaleStep() {
    var st = C.finale.steps[S.step], k = S.step;
    var opts = evidenceOptions();
    modal('<div class="react"><img src="' + img("face_celeste") + '" alt=""><p><b>' + esc(st.ask) + "</b></p></div>" + '<div class="evlist">' + opts.map(function (o) { return '<button class="ev" data-pf="' + o[0] + '"><img src="' + img(o[2]) + '" alt=""><span>' + esc(o[1]) + "</span></button>"; }).join("") + "</div>" +
      (opts.length ? "" : '<p class="muted">You have no evidence yet.</p>') + '<button class="btn ghost" data-close>Not yet</button>');
    document.querySelectorAll(".overlay [data-pf]").forEach(function (b) { b.addEventListener("click", function () {
      var a = b.getAttribute("data-pf"), good = (st.accept || [st.answer]).indexOf(a) >= 0;
      closeModal();
      if (!good) { S.wrong++; save(); shake(); if (S.wrong >= 3) return lose(); return modal('<div class="react"><img src="' + img("face_celeste") + '" alt=""><p>“Is that all, darling?” She almost laughs.</p></div><p class="muted small">That doesn’t prove it. Accusations left: ' + (3 - S.wrong) + '</p><button class="btn" data-close>Think again</button>', function () { finaleStep(); }); }
      comic([{ img: img("finale_" + k), move: "pushSlow", caption: st.react === "..." ? "" : st.react, bubble: null, audio: "celeste_react_" + k, dur: 3800 }], function () {
        S.step++; save();
        if (S.step < C.finale.steps.length) return finaleStep();
        S.solved = true; S.moth = true; S.t1 = Date.now(); save(); // the finale "finds" the 7th Collector card: the Collector herself
        var reveal = C.collector ? [{ img: "img/collector.jpg", move: "pushSlow", caption: C.collector.caption, audio: "collector", dur: 11000 },
                                    { img: "img/teaser.jpg", move: "panRight", caption: C.teaser.caption, audio: "teaser", dur: 9000 }] : [];
        comic([{ img: img("confess_0"), move: "panRight", fx: ["memory"], caption: C.suspects.filter(function (s) { return s.id === C.killer; })[0].confession, audio: "celeste_confession", dur: 12000 },
               { img: img("confess_1"), move: "pushSlow", fx: ["memory"], sfx: "jingle", dur: 4500 },
               { img: "img/co_p8.jpg", move: "pullBack", caption: C.ending, audio: "ending", dur: 12000 }].concat(reveal), function () { view.screen = "end"; render(); confetti(); });
      });
    }); });
  }
  function lose() { S.failed = true; S.t1 = Date.now(); save(); view.screen = "end"; render(); }

  function end() {
    var mins = Math.max(1, Math.round((S.t1 - S.t0) / 60000));
    var share = "🕯️ " + C.title + "\n" + (S.solved ? "Case closed " + "⭐".repeat(stars()) : "The killer walked free 💀") + " · " + mins + " min · " + Object.keys(S.secrets).length + "/5 secrets";
    h('<div class="card endc">' + (S.solved ? '<h1 class="stampin good">Case closed</h1><div class="stars">' + [0, 1, 2].map(function (i) { return '<span class="star' + (i < stars() ? "" : " dim") + '" style="--i:' + i + '">★</span>'; }).join("") + "</div>"
      : '<h1 class="bad">The killer walks free</h1><p>Three wrong answers. Lady Celeste smiles all the way home.</p>') +
      '<img class="endimg" src="img/face_celeste.jpg" alt=""><p class="muted small">Time ' + mins + " min · hints " + S.hints + " · wrong answers " + S.wrong + " · secrets found " + Object.keys(S.secrets).length + "/5</p>" +
      '<pre class="share">' + esc(share) + '</pre><div class="row c"><a class="btn" href="../index.html" style="text-decoration:none">Back to the map ›</a><button class="btn ghost" id="copy">Copy result</button><button class="btn ghost" id="restart">Play again</button></div></div>');
    on("#copy", function () { try { navigator.clipboard.writeText(share); toast("Copied. Share it (no spoilers)!"); } catch (e) {} });
    on("#restart", function () { S = fresh(); save(); view = { screen: "title", tab: "suspects", who: null }; render(); });
  }

  // ---------- tutorial coach: teaches by doing, never reveals the answer ----------
  // The practice guest is chosen automatically: an innocent whose hand story is entirely true.
  var GUIDE = (function () {
    var n = C.seats.length;
    var g = C.suspects.filter(function (s) {
      if (s.id === C.killer) return false;
      var i = C.seats.indexOf(s.id);
      return s.held.claims.every(function (c) { var o = c[1] === "left" ? C.seats[(i - 1 + n) % n] : C.seats[(i + 1) % n]; return C.hands[o].tag === c[2]; });
    })[0];
    return (g || C.suspects[0]).id;
  })();
  var hubNow = function () { return !view.who; };
  var STEPS = [
    { target: '[data-who="' + GUIDE + '"]', show: function () { return hubNow() && view.tab === "suspects"; }, alt: '[data-tab="suspects"]',
      text: "Let’s question someone together. Tap <b>" + esc(SHORT(GUIDE)) + "</b>.", done: function () { return view.who === GUIDE || S.asked[GUIDE + "_held"]; } },
    { target: '[data-q="held"]', show: function () { return view.who === GUIDE; }, alt: '#back',
      text: "In this case, <b>hands are everything</b>. Ask: “Whose hands did you hold?”", done: function () { return S.asked[GUIDE + "_held"]; } },
    { target: '[data-tab="seating"]',
      text: "Good. Every story can be checked. Open the <b>Seating</b> tab.", done: function () { return (hubNow() && view.tab === "seating") || S.coachOk || S.contra.length; } },
    { target: '.hrow[data-row="' + GUIDE + '"]', show: function () { return hubNow() && view.tab === "seating"; }, alt: '[data-tab="seating"]',
      text: "Compare what they <i>felt</i> with what that neighbour <i>really wears</i> (grey line). Same? Tap <b>Matches</b>. Different? Tap <b>Objection!</b>", done: function () { return S.coachOk || S.contra.length; } },
    { target: '.table',
      text: "Right, that story is true. <b>Your goal:</b> find the stories that <b>don’t</b> match. Question every guest, then check their rows here.", button: "Got it" },
    { target: '[data-tab="scene"]',
      text: "Evidence helps too. Open the <b>Crime scene</b>.", done: function () { return (hubNow() && view.tab === "scene") || S.found.length; } },
    { target: '.scenepic', show: function () { return hubNow() && view.tab === "scene"; }, alt: '[data-tab="scene"]',
      text: "It’s dark. Drag your torch over the room and tap the <b>glints</b>.", done: function () { return S.found.length; } },
    { target: '[data-tab="suspects"]',
      text: "Everyone here hides something. Use <b>🔎 Show evidence</b> on the right guest and they’ll confess a secret. Only one secret is murder.", button: "Got it" },
    { target: '#hint',
      text: "You’re on your own now, detective. Stuck? Hints are up here.", button: "Let’s go" }
  ];
  var coachEl = null, coachShown = -1, scrolledFor = "", lastTarget = null;
  function coach() {
    if (S.tut == null) S.tut = 0;
    var active = S.started && !S.solved && !S.failed && view.screen === "hub" && S.tut < STEPS.length && !modalEl && !document.querySelector(".comic");
    while (active && S.tut < STEPS.length && STEPS[S.tut].done && STEPS[S.tut].done()) { S.tut++; save(); }
    var st = active && S.tut < STEPS.length ? STEPS[S.tut] : null;
    var sel = st ? (st.show && !st.show() ? st.alt : st.target) : null;
    var t = sel ? app.querySelector(sel) : null;
    if (lastTarget && lastTarget !== t) lastTarget.classList.remove("coach-target");
    lastTarget = t;
    document.body.classList.toggle("coaching", !!st);
    if (!st) { if (coachEl) { coachEl.remove(); coachEl = null; coachShown = -1; } return; }
    if (t) { t.classList.add("coach-target"); if (scrolledFor !== S.tut + sel) { scrolledFor = S.tut + sel; t.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "center" }); } }
    if (coachShown === S.tut) return;
    coachShown = S.tut;
    if (!coachEl) { coachEl = document.createElement("div"); coachEl.className = "coach"; coachEl.setAttribute("role", "status"); document.body.appendChild(coachEl); }
    coachEl.innerHTML = '<div class="cicon">🔎</div><div class="ctext"><div class="chead">Detective’s notes · ' + (S.tut + 1) + "/" + STEPS.length + "</div><p>" + st.text + '</p><div class="crow">' +
      (st.button ? '<button class="btn small" id="cnext">' + st.button + "</button>" : "") + '<button class="cskip" id="cskip">Skip tutorial</button></div></div>';
    coachEl.classList.remove("cin"); void coachEl.offsetWidth; coachEl.classList.add("cin");
    var nx = coachEl.querySelector("#cnext"); if (nx) nx.addEventListener("click", function () { S.tut++; save(); coach(); });
    coachEl.querySelector("#cskip").addEventListener("click", function () { S.tut = STEPS.length; save(); coach(); });
  }

  // ---------- hint, modal, toast ----------
  function hint() {
    var more = S.hints < C.hints.length;
    modal("<h3>Hints</h3>" + C.hints.slice(0, S.hints).map(function (t, i) { return '<div class="bubble"><b>Hint ' + (i + 1) + ":</b> " + esc(t) + "</div>"; }).join("") +
      (S.hints ? "" : '<p class="muted">Each hint costs a star.</p>') + (more ? '<button class="btn" id="more">Reveal hint ' + (S.hints + 1) + '</button><div class="adnote">In the published game, a short ad unlocks each hint.</div>' : "") + ' <button class="btn ghost" data-close>Close</button>');
    var m = document.getElementById("more"); if (m) m.addEventListener("click", function () { S.hints++; save(); closeModal(); hint(); });
  }
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
