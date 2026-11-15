// Anonymous play analytics for the web test. Only with the player's consent ("tour.consent" = "yes").
// No names, no emails, no device details: a random player id, a random session id, the case, the event and a few numbers.
// ENDPOINT: the URL of the Google Apps Script web app (see analytics/apps_script.gs). Empty = keep events on this device only.
(function () {
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbwLXJD1ulpSN-nhuJ_vUYG2r1MVnyJktRVgVjncsAHs6suxJcnp7XEg9FeLACHK8Io/exec";
  var MAX_LOCAL = 2000;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function rid() { return Math.random().toString(36).slice(2, 10); }
  var pid = get("tour.pid"); if (!pid) { pid = rid(); set("tour.pid", pid); }
  var sid = rid(), t0 = Date.now();

  window.TRACK = function (where, ev, data) {
    if (get("tour.consent") !== "yes") return;
    var row = { ts: new Date().toISOString(), pid: pid, sid: sid, where: where, ev: ev, sec: Math.round((Date.now() - t0) / 1000), data: data || {} };
    var log = []; try { log = JSON.parse(get("tour.log")) || []; } catch (e) {}
    log.push(row); if (log.length > MAX_LOCAL) log = log.slice(-MAX_LOCAL); set("tour.log", JSON.stringify(log));
    if (ENDPOINT && navigator.sendBeacon) { try { navigator.sendBeacon(ENDPOINT, JSON.stringify(row)); } catch (e) {} }
  };

  // Ask once, politely, on the map page.
  window.TRACK_ASK = function () {
    if (get("tour.consent")) return;
    var d = document.createElement("div"); d.className = "consent";
    d.innerHTML = '<p><b>Help us make better mysteries?</b> Share anonymous play data: which steps you reach, how long they take, and when you use a hint. No names, no personal details.</p>' +
      '<div><button class="btn" data-c="yes">Yes, happy to help</button> <button class="btn ghost" data-c="no">No thanks</button></div>';
    document.body.appendChild(d);
    d.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { set("tour.consent", b.getAttribute("data-c")); d.remove(); if (b.getAttribute("data-c") === "yes") window.TRACK("map", "consent"); }; });
  };

  // Local testing: in the browser console, TRACK_EXPORT() downloads the events on this device as a CSV.
  window.TRACK_EXPORT = function () {
    var log = []; try { log = JSON.parse(get("tour.log")) || []; } catch (e) {}
    var csv = "ts,pid,sid,where,ev,sec,data\n" + log.map(function (r) { return [r.ts, r.pid, r.sid, r.where, r.ev, r.sec, JSON.stringify(r.data).replace(/"/g, '""')].map(function (v, i) { return i === 6 ? '"' + v + '"' : v; }).join(","); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "play-events.csv"; a.click();
  };
})();
