/* Flight Club Saar e. V. · Mini-Spiel „Whoop-Rennen“ (Version 2)
   Ein Tiny Whoop fliegt durch leuchtende Gates in der Turnhalle, Blick wie durch die FPV-Brille.
   Neu: Kurven mit Schräglage, Höhenwechsel, bewegliche und enger werdende Gates, Hindernisse
   (Netz, Leiter, Basketballkorb), Level 1 bis 3, Steuerung per Handy kippen, Bestenliste.
   Einbinden: <div data-game="whoop" data-board="#id-der-bestenliste"></div> plus assets/css/game.css und assets/js/game.js.
   Klassisches Skript, Canvas 2D (Pseudo-3D), keine Bibliotheken nötig.
   Globale Variablen: window.FCSGame (mount, instances, Testhilfe end/finish) und window.FCSScores (Bestenliste). */
(function () {
  'use strict';
  if (window.FCSGame) return;

  /* ---------- Welt und Regeln ---------- */
  const HW = 11, HH = 7.5, ZN = 0.3, ZF = 72;            // Halle: halbe Breite, Deckenhöhe, Sichtweite (m)
  const RX = 5.2, YMIN = 0.9, YMAX = 4.6, YC = 2.75;  // Flugbereich des Whoops
  const BAT_T = 90;                                    // Sekunden bis 3.50 V = LAND NOW
  const LOW_V = 3.62, VMAX = 17.5;
  const SEG = 1, CF = 1.6;                             // Streckenraster (m), Fliehkraft in Kurven
  const EASY_AT = 85, L2_AT = 220, L3_AT = 560;        // Streckenmeter: einfacher Anfang (ca. 10 s), Level 2, Level 3
  const FOG = '#050b17', FOGC = [5, 11, 23];
  const SIG = [63, 224, 255], AMB = [255, 176, 32], RED = [255, 75, 92], WHT = [234, 244, 255];
  const BLU = [90, 162, 255], WOOD = [196, 150, 98], HOT = [255, 255, 255], VIO = [196, 150, 255], ALU = [200, 214, 234];
  const BEST_KEY = 'fcs-whoop-best', INV_KEY = 'fcs-whoop-inv';
  const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  const DEG = Math.PI / 180;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (t) => t * t * (3 - 2 * t);
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  const mixc = (a, b, t) => 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  const fogA = (z) => (z >= ZF ? 0 : Math.pow(1 - Math.max(0, z) / ZF, 1.5));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const mmss = (s) => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 60) % 100) + ':' + pad(s % 60); };
  const num = (n) => Math.round(n).toLocaleString('de-DE');
  const first = (lo, P, off) => Math.ceil((lo - off) / P) * P + off;      // erstes Rasterelement >= lo
  // LiPo-Kurve: schneller Abfall am Anfang, Plateau, Abfall am Ende. voltAt(1) = 3.50 V
  const voltAt = (p) => 4.2 - 0.22 * (1 - Math.exp(-6 * p)) - 0.48 * Math.pow(p, 2.2);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat oder gesperrt */ } };
  const loadBest = () => { const v = parseInt(lsGet(BEST_KEY, 0), 10); return v > 0 ? v : 0; };
  // Erwartetes Tempo nach cd Streckenmetern (v = 8 + 0.105 t  ->  s = 8 t + 0.0525 t²)
  const spAt = (cd) => { const t = (-8 + Math.sqrt(64 + 0.21 * Math.max(0, cd))) / 0.105; return Math.min(VMAX, 8 + 0.105 * t); };

  /* Tiefenscheiben der Halle (vorne dicht, hinten weit): gezeichnet wird von hinten nach vorne */
  const NSL = 22, ZS = [];
  for (let i = 0; i <= NSL; i++) ZS.push(ZN + (ZF - ZN) * Math.pow(i / NSL, 1.75));
  const SC = [];
  for (let i = 0; i < NSL; i++) {
    const a = fogA((ZS[i] + ZS[i + 1]) / 2);
    SC.push({
      ceil: mixc(FOGC, [10, 20, 38], a), wall: mixc(FOGC, [11, 23, 48], a), floor: mixc(FOGC, [19, 38, 72], a),
      pad: rgba([31, 73, 125], 0.62 * a), padl: rgba(BLU, 0.5 * a * a),
      st: [rgba(WHT, 0.55 * a), rgba(BLU, 0.5 * a), rgba(AMB, 0.4 * a)]
    });
  }
  const STRIPES = [[9.5, 0.07, 0], [6.2, 0.05, 1], [8.1, 0.05, 2]];    // Spielfeldlinien längs: x, halbe Breite, Farbe

  /* Analoges Bildrauschen: drei Kacheln, einmal erzeugt, als Muster gekachelt */
  let NOISE = null;
  function noiseTiles() {
    if (NOISE) return NOISE;
    NOISE = [];
    for (let k = 0; k < 3; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const x = c.getContext('2d'); const im = x.createImageData(160, 160); const d = im.data;
      for (let row = 0; row < 160; row++) {
        const rb = Math.random() < 0.09 ? rand(0.35, 1.35) : 1;
        for (let col = 0; col < 160; col++) {
          const i = (row * 160 + col) * 4, v = Math.random() * 235 * rb;
          d[i] = v * 0.9; d[i + 1] = v * 0.97; d[i + 2] = v * 1.08; d[i + 3] = 255;
        }
      }
      x.putImageData(im, 0, 0); NOISE.push(c);
    }
    return NOISE;
  }

  /* ======================================================================
     Bestenliste: window.FCSScores
     Server nur, wenn FCS.data.highscore.url gesetzt ist, sonst nur localStorage.
     Abruf (a=top) nie beim Seitenladen, sondern erst nach einem Klick (Spielstart oder „Bestenliste laden“).
     ====================================================================== */
  const SALT = 'fcs-whoop-2026';
  const LSK = { list: 'fcs-whoop-scores', queue: 'fcs-whoop-queue', name: 'fcs-whoop-name', me: 'fcs-whoop-me' };
  const SS_TOP = 'fcs-whoop-top';
  const BAD_SUB = ['fick', 'fuck', 'fotze', 'wichser', 'wixxer', 'nutte', 'hurenso', 'schlampe', 'arschloch', 'missgeburt', 'spast', 'kanake', 'nigg', 'neger', 'hitler', 'nazi', 'siegheil', 'bitch', 'cunt', 'whore', 'pimmel', 'porn', 'scheiss', 'shit', 'schwuchtel', 'judensau', 'kinderf', 'vergewalt', 'heilhitl'];
  const BAD_WORD = ['arsch', 'hure', 'penis', 'sex', 'slut', 'kacke', 'fotz', 'ss', 'sa', 'kkk', 'nsdap', 'hh', '88'];
  function cleanName(raw) {
    let n = String(raw == null ? '' : raw);
    if (n.normalize) n = n.normalize('NFC');
    n = n.replace(/<[^>]*>?/g, ' ').replace(/[^\p{L}\p{N} ._\-!?]/gu, '').replace(/\s+/g, ' ').trim();
    return Array.from(n).slice(0, 16).join('').trim();
  }
  function badName(n) {
    const low = n.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss');
    const leet = low.replace(/[0-9@]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a' })[c] || c);
    const flat = leet.replace(/[^\p{L}]/gu, '');
    if (BAD_SUB.some((w) => flat.indexOf(w) >= 0)) return true;
    const words = low.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return words.some((w) => BAD_WORD.indexOf(w) >= 0) || BAD_WORD.indexOf(flat) >= 0;
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function normEntry(x) {
    if (!x || typeof x !== 'object') return null;
    const n = cleanName(x.n), s = Math.round(+x.s);
    if (!n || !(s > 0) || s >= 100000 || badName(n)) return null;
    const at = String(x.at || '');
    return { n, s, g: Math.max(0, Math.round(+x.g) || 0), c: Math.max(0, Math.round(+x.c) || 0), t: Math.max(0, Math.round(+x.t) || 0), d: x.d === 'm' ? 'm' : 'p', at: /^\d{4}-\d{2}-\d{2}/.test(at) ? at.slice(0, 10) : '' };
  }
  // Sortiert nach Punkten, gleiche Namen (ohne Groß/klein) nur mit ihrem besten Wert
  function rankList(arr) {
    const best = new Map();
    (arr || []).forEach((x) => {
      const e = normEntry(x); if (!e) return;
      const key = e.n.toLocaleLowerCase('de-DE'), o = best.get(key);
      if (!o || e.s > o.s || (e.s === o.s && e.at && (!o.at || e.at < o.at))) best.set(key, e);
    });
    return Array.from(best.values()).sort((a, b) => b.s - a.s || (a.at || '9').localeCompare(b.at || '9') || a.t - b.t);
  }
  const rankOf = (list, n) => { const k = String(n || '').toLocaleLowerCase('de-DE'); if (!k) return null; for (let i = 0; i < list.length; i++) if (list[i].n.toLocaleLowerCase('de-DE') === k) return i + 1; return null; };
  function plausible(e) {
    return e.s > 0 && e.s < 100000 && e.s % 25 === 0 && e.t >= 5 && e.t <= 100 && e.g >= 0 && e.g <= e.t * 1.3 + 3 &&
      e.c <= e.g && e.s <= e.g * 1100 + 100;
  }
  // SHA-1 (Hex). Im Browser über crypto.subtle, sonst kleine Ersatzfunktion.
  function sha1js(b) {
    const l = b.length, nb = ((l + 8) >> 6) + 1, w = new Int32Array(nb * 16), x = new Int32Array(80);
    for (let i = 0; i < l; i++) w[i >> 2] |= b[i] << (24 - (i & 3) * 8);
    w[l >> 2] |= 0x80 << (24 - (l & 3) * 8); w[nb * 16 - 1] = l * 8;
    const rol = (v, c) => (v << c) | (v >>> (32 - c));
    let h0 = 0x67452301, h1 = 0xEFCDAB89 | 0, h2 = 0x98BADCFE | 0, h3 = 0x10325476, h4 = 0xC3D2E1F0 | 0;
    for (let j = 0; j < w.length; j += 16) {
      let a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        x[i] = i < 16 ? w[j + i] : rol(x[i - 3] ^ x[i - 8] ^ x[i - 14] ^ x[i - 16], 1);
        const f = i < 20 ? ((bb & c) | (~bb & d)) + 0x5A827999 : i < 40 ? (bb ^ c ^ d) + 0x6ED9EBA1 : i < 60 ? ((bb & c) | (bb & d) | (c & d)) + 0x8F1BBCDC : (bb ^ c ^ d) + 0xCA62C1D6;
        const t = (rol(a, 5) + e + x[i] + f) | 0;
        e = d; d = c; c = rol(bb, 30); bb = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    return [h0, h1, h2, h3, h4].map((v) => ('0000000' + (v >>> 0).toString(16)).slice(-8)).join('');
  }
  function sha1(str) {
    const bytes = new TextEncoder().encode(str), sub = window.crypto && window.crypto.subtle;
    if (!sub) return Promise.resolve(sha1js(bytes));
    return sub.digest('SHA-1', bytes).then((buf) => Array.from(new Uint8Array(buf), (v) => (v < 16 ? '0' : '') + v.toString(16)).join('')).catch(() => sha1js(bytes));
  }
  const hsUrl = () => { const h = window.FCS && window.FCS.data && window.FCS.data.highscore; return h && typeof h.url === 'string' && /^https:\/\//.test(h.url) ? h.url : ''; };
  function hsCall(params) {
    const url = hsUrl(); if (!url) return Promise.reject(new Error('keine Adresse'));
    const q = Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const to = setTimeout(() => { if (ctl) ctl.abort(); }, 8000);
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + q, { method: 'GET', cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((txt) => {
        let j = null; try { j = JSON.parse(txt); } catch (e) { /* z. B. „Accepted“ */ }
        if (!j || j.ok !== true || !Array.isArray(j.list)) { const err = new Error('nicht angenommen'); err.rejected = true; throw err; }
        return j.list;
      })
      .then((l) => { clearTimeout(to); return l; }, (e) => { clearTimeout(to); throw e; });
  }
  let topCache = null;                              // Serverliste dieser Sitzung (roh)
  try { const c = JSON.parse(sessionStorage.getItem(SS_TOP) || 'null'); if (c && Array.isArray(c.list)) topCache = c.list; } catch (e) { /* egal */ }
  const keepTop = (list) => { topCache = list.slice(0, 500); try { sessionStorage.setItem(SS_TOP, JSON.stringify({ list: topCache, at: Date.now() })); } catch (e) { /* egal */ } };
  const localList = () => rankList(lsGet(LSK.list, []));
  const queueList = () => { const q = lsGet(LSK.queue, []); return Array.isArray(q) ? q : []; };
  const merged = () => rankList((topCache || []).concat(queueList()));
  function sendRec(rec) {
    return sha1(rec.n + '|' + rec.s + '|' + rec.g + '|' + rec.t + '|' + SALT).then((h) =>
      hsCall({ a: 'add', n: rec.n, s: rec.s, g: rec.g, c: rec.c, t: rec.t, d: rec.d, k: h.slice(0, 10) }));
  }
  function flushQueue() {   // läuft nur innerhalb eines vom Nutzer ausgelösten Abrufs
    const q = queueList(); if (!q.length || !hsUrl()) return Promise.resolve(null);
    let last = null;
    return q.reduce((p, rec) => p.then(() => sendRec(rec).then((l) => { last = l; dropQueued(rec); }, (e) => { if (e && e.rejected) dropQueued(rec); })), Promise.resolve()).then(() => last);
  }
  function dropQueued(rec) { lsSet(LSK.queue, queueList().filter((x) => !(x.n === rec.n && x.s === rec.s && x.t === rec.t))); }
  const Scores = {
    source: 'local',          // 'online' | 'local' | 'offline'
    get online() { return !!hsUrl(); },
    get loaded() { return !!topCache; },
    cached() { if (hsUrl() && topCache) { this.source = 'online'; return merged(); } this.source = 'local'; return localList(); },
    top() {
      if (!hsUrl()) { this.source = 'local'; return Promise.resolve(localList()); }
      if (topCache) return flushQueue().then((l) => { if (l) keepTop(l); this.source = 'online'; return merged(); });
      return flushQueue().then((l) => l || hsCall({ a: 'top' })).then((l) => { keepTop(l); this.source = 'online'; return merged(); },
        () => { this.source = 'offline'; return rankList(localList().concat(queueList())); });
    },
    add(e) {
      const n = cleanName(e && e.name);
      const rec = { n, s: Math.round(+e.score) || 0, g: Math.round(+e.gates) || 0, c: Math.round(+e.combo) || 0, t: Math.round(+e.time) || 0, d: e.device === 'm' ? 'm' : 'p', at: today() };
      if (Array.from(n).length < 2) return Promise.reject(Object.assign(new Error('Bitte gib mindestens zwei Zeichen ein.'), { code: 'name' }));
      if (badName(n)) return Promise.reject(Object.assign(new Error('Bitte wähl einen anderen Namen.'), { code: 'name' }));
      if (!plausible(rec)) return Promise.reject(Object.assign(new Error('Dieses Ergebnis passt nicht zu einer echten Runde.'), { code: 'plaus' }));
      const loc = lsGet(LSK.list, []); loc.push(rec); lsSet(LSK.list, rankList(loc).slice(0, 100));
      lsSet(LSK.name, n); lsSet(LSK.me, { n, s: rec.s, at: rec.at });
      if (!hsUrl()) { this.source = 'local'; const list = localList(); return Promise.resolve({ rank: rankOf(list, n), list, online: false, saved: true, entry: rec }); }
      return sendRec(rec).then((l) => { keepTop(l); this.source = 'online'; const list = merged(); return { rank: rankOf(list, n), list, online: true, saved: true, entry: rec }; },
        (err) => {
          if (err && err.rejected) { const list = topCache ? merged() : localList(); return { rank: null, list, online: true, saved: false, rejected: true, entry: rec }; }
          const q = queueList(); q.push(rec); lsSet(LSK.queue, q.slice(-10));
          this.source = 'offline';
          const list = topCache ? merged() : rankList(localList().concat(q));
          return { rank: rankOf(list, n), list, online: false, saved: true, queued: true, entry: rec };
        });
    },
    lastName: () => { const v = lsGet(LSK.name, ''); return typeof v === 'string' ? cleanName(v) : ''; },
    me: () => { const v = lsGet(LSK.me, null); return v && typeof v.n === 'string' ? v : null; },
    clean: cleanName,
    isBad: badName
  };
  window.FCSScores = Scores;

  /* ---------- Symbole ---------- */
  const SV = (p, w) => '<svg viewBox="0 0 24 24" width="' + (w || 16) + '" height="' + (w || 16) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const ICON_SND = SV('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>');
  const ICON_PAUSE = SV('<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>', 20);
  const ICON_CENTER = SV('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>', 18);
  const ICON_PHONE = SV('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>', 14);
  const ICON_PC = SV('<rect x="2.5" y="4" width="19" height="12.5" rx="1.6"/><path d="M8.5 20.5h7M12 16.5v4"/>', 14);

  let UID = 0;
  const TPL = (id) => `
<div class="fcsg-stage" role="group" aria-label="Mini-Spiel Whoop-Rennen" tabindex="-1">
  <canvas class="fcsg-cv" role="img" aria-label="Whoop-Rennen: Blick durch die FPV-Brille eines Tiny Whoops, der in einer Turnhalle durch Kurven und leuchtende Gates fliegt."></canvas>
  <div class="fcsg-fx" aria-hidden="true"></div>
  <div class="fcsg-hud" aria-hidden="true">
    <div class="fcsg-frame"><i></i></div>
    <div class="fcsg-o fcsg-tl">
      <div class="fcsg-bat"><span class="fcsg-cell"><i data-h="cell"></i></span><span data-h="volt">4.20V</span></div>
      <div class="fcsg-lives fcsg-play"><small>LEBEN</small><span class="fcsg-pips" data-h="lives"><i></i><i></i><i></i></span></div>
    </div>
    <div class="fcsg-o fcsg-tc"><span data-h="mode">AUTOPILOT</span><span class="fcsg-lvl fcsg-play" data-h="lvl">LVL 1</span></div>
    <div class="fcsg-o fcsg-tr">
      <div><small>FLUGZEIT</small> <span data-h="time">00:00</span></div>
      <div><span data-h="speed">0</span> <small>KM/H</small></div>
    </div>
    <div class="fcsg-o fcsg-bl fcsg-play"><small>PUNKTE</small><b data-h="score">0</b></div>
    <div class="fcsg-o fcsg-br fcsg-play"><small>KOMBO</small><span><b data-h="combo">0</b><em data-h="mult"></em></span></div>
    <div class="fcsg-msg" data-h="msg"></div>
    <div class="fcsg-toast" data-h="toast"></div>
    <div class="fcsg-warn" data-h="warn"></div>
  </div>
  <div class="fcsg-ctl">
    <button type="button" class="fcsg-cb" data-a="pz" aria-label="Pause">${ICON_PAUSE}</button>
    <button type="button" class="fcsg-cb fcsg-cb-t" data-a="recal" aria-label="Mitte neu ausrichten">${ICON_CENTER}<span>Mitte</span></button>
    <button type="button" class="fcsg-cb fcsg-snd" data-a="snd2" aria-label="Ton an">${ICON_SND}</button>
  </div>
  <p class="fcsg-hint" aria-hidden="true"><span data-h="hint">Klicken zum Mitfliegen</span></p>
  <div class="fcsg-ui fcsg-ui-start" data-p="start">
    <div class="fcsg-card">
      <p class="fcsg-kick">Mini-Spiel · Tiny Whoop</p>
      <h3 class="fcsg-title">Whoop-Rennen</h3>
      <p class="fcsg-txt">Brille auf: Flieg durch Kurven, leuchtende Gates und an Netz, Leiter und Korb vorbei, bevor der Akku leer ist. Drei Level, eine Bestenliste.</p>
      <div class="fcsg-row">
        <button type="button" class="btn solid fcsg-go fcsg-pc" data-a="go">Scharf schalten und fliegen</button>
        <button type="button" class="btn solid fcsg-go fcsg-tilt" data-a="tilt">${ICON_PHONE}Handy kippen zum Steuern</button>
        <button type="button" class="btn ghost fcsg-mob" data-a="finger">Mit dem Finger steuern</button>
        <span class="fcsg-best">Bestwert <b data-h="best">noch keiner</b></span>
      </div>
    </div>
  </div>
  <div class="fcsg-ui fcsg-ui-mid" data-p="pause" hidden>
    <div class="fcsg-card fcsg-card-c">
      <p class="fcsg-kick">DISARMED</p>
      <p class="fcsg-title">Pause</p>
      <p class="fcsg-txt" data-h="ptxt">Dein Whoop schwebt und wartet. Akku und Punkte bleiben, wie sie sind.</p>
      <div class="fcsg-row fcsg-row-c">
        <button type="button" class="btn solid" data-a="resume">Weiterfliegen</button>
        <button type="button" class="btn ghost" data-a="quit">Landen und werten</button>
      </div>
      <div class="fcsg-row fcsg-row-c fcsg-opts">
        <button type="button" class="fcsg-mini" data-a="swap">Mit dem Finger steuern</button>
        <button type="button" class="fcsg-mini fcsg-only-t" data-a="inv" aria-pressed="false">Hoch und runter tauschen</button>
      </div>
    </div>
  </div>
  <div class="fcsg-ui fcsg-ui-mid fcsg-ui-over" data-p="over" hidden>
    <div class="fcsg-card fcsg-card-c fcsg-card-over">
     <div class="fcsg-ov-l">
      <p class="fcsg-kick" data-h="why">LAND NOW · Akku leer</p>
      <p class="fcsg-score"><b data-h="fscore">0</b><span>Punkte</span></p>
      <p class="fcsg-new" data-h="newbest" hidden>Neuer Bestwert!</p>
      <dl class="fcsg-stats">
        <div><dt>Gates</dt><dd data-h="fgates">0</dd></div>
        <div><dt>Kombo</dt><dd data-h="fcombo">0</dd></div>
        <div><dt>Flugzeit</dt><dd data-h="ftime">00:00</dd></div>
        <div><dt>Level</dt><dd data-h="flvl">1</dd></div>
      </dl>
     </div>
     <div class="fcsg-ov-r">
      <form class="fcsg-form" data-h="form" novalidate>
        <label class="fcsg-lab" for="${id}-n">Dein Pilotenname</label>
        <div class="fcsg-frow">
          <input class="fcsg-in" id="${id}-n" data-h="name" name="pilot" type="text" maxlength="16" autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Spitzname, max. 16 Zeichen" aria-describedby="${id}-i ${id}-m">
          <button type="submit" class="btn solid fcsg-send" data-h="send">Speichern</button>
        </div>
        <p class="fcsg-note" id="${id}-i">Dein Name erscheint öffentlich in der Bestenliste. Nimm gern einen Spitznamen. <a href="datenschutz.html#bestenliste">Datenschutz</a></p>
        <p class="fcsg-fmsg" id="${id}-m" data-h="fmsg" role="status"></p>
      </form>
      <p class="fcsg-placed" data-h="placed" role="status" hidden></p>
      <div class="fcsg-row fcsg-row-c">
        <button type="button" class="btn" data-a="again">Nochmal</button>
        <a class="fcsg-link" data-h="link" href="hallenfliegen.html">Echt fliegen? Komm zum Hallenfliegen <span aria-hidden="true">→</span></a>
      </div>
     </div>
    </div>
  </div>
</div>
<div class="fcsg-bar">
  <p class="fcsg-keys" data-h="keys">Steuerung: Maus bewegen oder Pfeiltasten und WASD. P pausiert.</p>
  <div class="fcsg-btns">
    <button type="button" class="fcsg-mini fcsg-snd" data-a="snd">${ICON_SND}<span>Ton an</span></button>
  </div>
</div>
<p class="fcsg-sr" aria-live="polite" data-h="live"></p>`;

  const BOARD_TPL = `
<div class="fcsb-head">
  <p class="fcsg-kick">Bestenliste</p>
  <h3 class="fcsb-title">Top 10 Piloten</h3>
  <p class="fcsb-src" data-b="src">Auf diesem Gerät</p>
</div>
<ol class="fcsb-list" data-b="list"></ol>
<div class="fcsb-me" data-b="me" hidden></div>
<div class="fcsb-foot">
  <button type="button" class="fcsg-mini fcsb-load" data-b="load" hidden>Bestenliste laden</button>
  <p class="fcsb-fine" data-b="fine">Die Online-Liste lädt erst, wenn du spielst oder hier tippst.</p>
</div>`;

  /* ======================================================================== */
  function create(host) {
    const rm = (window.FCS && typeof window.FCS.rm === 'boolean') ? window.FCS.rm : matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mob = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
    const canTilt = mob && typeof window.DeviceOrientationEvent !== 'undefined';
    const uid = 'fcsg' + (++UID);
    host.classList.add('fcsg');
    host.classList.toggle('is-mob', mob);
    host.classList.toggle('can-tilt', canTilt);
    host.innerHTML = TPL(uid);
    const H_ = {}, P_ = {}, A_ = {};
    host.querySelectorAll('[data-h]').forEach((el) => { H_[el.dataset.h] = el; });
    host.querySelectorAll('[data-p]').forEach((el) => { P_[el.dataset.p] = el; });
    host.querySelectorAll('[data-a]').forEach((el) => { A_[el.dataset.a] = el; });
    H_.link.setAttribute('href', host.getAttribute('data-link') || 'hallenfliegen.html');
    if (mob && !canTilt) A_.finger.className = 'btn solid fcsg-go fcsg-mob';
    const stage = host.querySelector('.fcsg-stage'), cv = host.querySelector('.fcsg-cv');
    const ctx = cv.getContext('2d', { alpha: false });
    const pats = noiseTiles().map((c) => ctx.createPattern(c, 'repeat'));
    const lifeEls = H_.lives.children;

    /* ---------- Zustand ---------- */
    // idle (nur reduzierte Bewegung) · demo · count · play · pause · end · over
    let state = rm ? 'idle' : 'demo';
    let W = 0, H = 0, dpr = 1, dprCap = mob ? 1.5 : 2, f = 400;
    let running = false, visible = false, raf = 0, last = 0, clock = 0;
    let cx = 0, cy = YC, vx = 0, vy = 0, tx = 0, ty = YC, roll = 0, dist = 0, v = rm ? 0 : 9, vTarget = 9, shake = 0, sag = 0;
    let gates = [], obs = [], gateN = 0, lastZw = 0, lastGx = 0, lastGy = YC;
    let score = 0, combo = 0, bestCombo = 0, lives = 3, passed = 0, flightT = 0, volt = 4.2, curLvl = 1, near = 0;
    let crashT = 0, glitchT = 0, flashT = 0, flashA = 0, flashC = SIG, missT = 0, endT = 0, endReason = '', toastT = 0;
    let countT = 0, countStep = -1, msgT = 0, touchId = null, lastPX = 0, lastPY = 0;
    let best = loadBest(), pfSum = 0, pfN = 0, assist = false, kNow = 0, kAhead = 0;
    let mode = mob ? 'touch' : 'mouse', full = null, submitted = false, runData = null, startT = 0;
    const keys = { l: 0, r: 0, u: 0, d: 0 };
    const pops = [], parts = [], drawList = [], hits = [];
    const tilt = { have: false, raw: [0, 0], s: [0, 0], n0: [0, 0], inv: !!lsGet(INV_KEY, false), t0: 0, on: false };
    const demoLike = () => state === 'demo' || state === 'over' || state === 'idle';
    const isLive = () => state === 'count' || state === 'play' || state === 'end';

    /* ---------- Strecke: Kurvenplan und Mittellinie ---------- */
    // Mittellinie als seitlicher Versatz X(s) mit Steigung S(s), alle SEG Meter eine Stützstelle.
    let tkBase = 0, cs = [], cEnd = 0, cLastCurve = false, cLastDir = 1, courseStart = -1e6, fX0 = 0, fS0 = 0;
    const tkX = [0], tkS = [0];
    function kAt(s) {
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]; if (s < c.s0) break;
        if (s < c.s1) {
          if (!c.k) return 0;
          const R = Math.min(9, (c.s1 - c.s0) / 3), e = Math.min(s - c.s0, c.s1 - s);
          return e >= R ? c.k : c.k * smooth(e / R);
        }
      }
      return 0;
    }
    function genCurve() {
      const s0 = cEnd, demo = demoLike(), cd = s0 - courseStart;
      let L, k = 0;
      if (!demo && cd < EASY_AT) L = Math.max(10, EASY_AT - cd);         // die ersten Sekunden: gerade
      else {
        const lvl = demo ? 1 : cd < L2_AT ? 1 : cd < L3_AT ? 2 : 3;
        if (cLastCurve && !(lvl === 3 && Math.random() < 0.35)) { L = lvl === 1 ? rand(26, 44) : lvl === 2 ? rand(16, 30) : rand(10, 22); cLastCurve = false; }
        else {
          L = rand(24, 40);
          const mag = demo ? rand(0.007, 0.012) : lvl === 1 ? rand(0.005, 0.009) : lvl === 2 ? rand(0.009, 0.014) : rand(0.012, 0.019);
          cLastDir = Math.random() < 0.68 ? -cLastDir : cLastDir;
          k = mag * cLastDir; cLastCurve = true;
        }
      }
      cs.push({ s0, s1: s0 + L, k }); cEnd = s0 + L;
    }
    function ensureCurves(s) { while (cEnd <= s) genCurve(); }
    function ensureTrack(sMax) {
      ensureCurves(sMax + 2);
      while (tkBase + (tkX.length - 1) * SEG < sMax) {
        const i = tkX.length - 1, s = tkBase + i * SEG, S1 = tkS[i] + kAt(s + SEG / 2) * SEG;
        tkX.push(tkX[i] + (tkS[i] + S1) / 2 * SEG); tkS.push(S1);
      }
      if ((dist - tkBase) / SEG > 300) { const cut = Math.floor((dist - 40 - tkBase) / SEG); tkX.splice(0, cut); tkS.splice(0, cut); tkBase += cut * SEG; }
      while (cs.length > 1 && cs[0].s1 < dist - 40) cs.shift();
    }
    function resetTrackAhead(from) {
      cs = cs.filter((c) => c.s0 < from);
      if (cs.length && cs[cs.length - 1].s1 > from) cs[cs.length - 1].s1 = from;
      cEnd = Math.max(from, cs.length ? cs[cs.length - 1].s1 : from); cLastCurve = false;
      const keep = Math.max(2, Math.floor((from - tkBase) / SEG) + 1);
      if (tkX.length > keep) { tkX.length = keep; tkS.length = keep; }
    }
    function trAt(arr, s) {
      let u = (s - tkBase) / SEG; const n = arr.length - 1;
      if (u < 0) u = 0; else if (u > n - 1e-6) u = n - 1e-6;
      const i = u | 0; return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
    }
    // Seitlicher Versatz der Mittellinie in z Metern Entfernung, gesehen aus der Blickrichtung der Kamera
    const bendZ = (z) => trAt(tkX, dist + z) - fX0 - fS0 * z;

    /* ---------- Projektion (Kamera blickt entlang der Strecke) ---------- */
    const PX = (x, z) => (x + bendZ(z) - cx) * f / z;
    const PY = (y, z) => (cy - y) * f / z;
    function q4(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4) {
      ctx.moveTo(PX(x1, z1), PY(y1, z1)); ctx.lineTo(PX(x2, z2), PY(y2, z2));
      ctx.lineTo(PX(x3, z3), PY(y3, z3)); ctx.lineTo(PX(x4, z4), PY(y4, z4)); ctx.closePath();
    }

    /* ---------- Gates und Hindernisse ---------- */
    function newGate(zw, x, y, sc, o) {
      return Object.assign({ zw, x, y, x0: x, y0: y, w: 2.7 * sc, h: 2.0 * sc, bonus: false, mv: 0, amp: 0, om: 0, ph: 0, n: ++gateN, lvl: 1, after: null, done: false, kind: 'g' }, o || {});
    }
    function spawnGate() {
      const demo = demoLike();
      const prev = gates.length ? gates[gates.length - 1] : null;
      const pend = prev ? prev.after : null;
      const zw = lastZw + 10 + (demo ? 9 : spAt(lastZw - courseStart)) * 0.6 + (pend ? 5 : 0);
      const cd = zw - courseStart;
      const lvl = demo ? 1 : cd < L2_AT ? 1 : cd < L3_AT ? 2 : 3;
      const easy = !demo && cd < EASY_AT;
      const d = demo ? 0.15 : clamp(cd / 900, 0, 1);
      const mdx = easy ? 1.8 : lerp(2.6, 5.0, d), mdy = easy ? 0.5 : lerp(0.9, 2.0, d);
      const ylo = lvl > 1 ? 1.25 : 1.45, yhi = 3.95;
      let dx = rand(-1, 1) * mdx;
      if (Math.abs(dx) < mdx * 0.3) dx = (dx < 0 ? -1 : 1) * mdx * 0.3;
      if (Math.abs(lastGx + dx) > RX - 0.7) dx = -dx;
      let dy = rand(-1, 1) * mdy;
      if (lastGy + dy < ylo || lastGy + dy > yhi) dy = -dy;
      let x = clamp(lastGx + dx, -RX + 0.7, RX - 0.7), y = clamp(lastGy + dy, ylo, yhi);
      ensureCurves(zw + 2);
      const kg = kAt(zw);                                  // in Kurven liegt das Gate auf der Innenseite
      if (kg) x = clamp(x + Math.sign(kg) * Math.min(2, Math.abs(kg) * 130), -RX + 0.7, RX - 0.7);
      if (pend) y = pend === 'hoop' ? rand(2.9, 3.4) : pend === 'over' ? rand(3.2, 3.8) : (pend === 'under' || pend === 'dive') ? rand(1.15, 1.3) : y;
      let after = null;                                    // Hindernis in der Lücke nach diesem Gate
      if (!demo && lvl >= 2 && !pend && gateN > 1 && Math.random() < (lvl === 2 ? 0.36 : 0.5)) {
        const r = Math.random();
        after = lvl === 2 ? (r < 0.5 ? 'ladder' : r < 0.75 ? 'over' : 'under') : (r < 0.3 ? 'ladder' : r < 0.55 ? 'hoop' : r < 0.75 ? 'dive' : r < 0.88 ? 'over' : 'under');
        if (after === 'over' || after === 'dive') y = rand(3.3, 3.8);
        else if (after === 'under') y = rand(1.15, 1.3);
        else if (after === 'hoop') y = rand(2.9, 3.4);
      }
      const bonus = !demo && !easy && gateN > 2 && !after && !pend && Math.random() < 0.16;
      let mv = 0;
      if (!demo && !bonus && !after && !pend && lvl >= 2 && Math.random() < (lvl === 2 ? 0.22 : 0.34)) mv = lvl === 3 && Math.random() < 0.4 ? 2 : 1;
      const sc = (easy ? 1.08 : 1 - 0.12 * d) * (lvl === 3 ? 0.86 : 1) * (bonus ? 0.84 : 1);
      const g = newGate(zw, x, y, sc, { bonus, mv, lvl, after, ph: rand(0, 6.28) });
      if (mv === 1) { g.amp = lvl === 2 ? rand(0.7, 1.2) : rand(0.9, 1.5); g.om = lvl === 2 ? rand(1.0, 1.4) : rand(1.1, 1.5); g.x0 = clamp(x, -(RX - 0.5 - g.amp), RX - 0.5 - g.amp); }
      if (mv === 2) { g.amp = rand(0.5, 0.8); g.om = rand(1.3, 1.8); g.y0 = clamp(y, 1.35 + g.amp, 3.9 - g.amp); }
      g.x = g.x0; g.y = g.y0;
      gates.push(g);
      if (pend && prev) {
        const fr = pend === 'dive' ? 0.25 : 0.5, oz = prev.zw + (zw - prev.zw) * fr, ox = lerp(prev.x0, g.x0, fr);
        let o;
        if (pend === 'ladder') o = { type: 'ladder', x: ox, x0: ox - 0.5, x1: ox + 0.5, y0: 0, y1: 3.05 };
        else if (pend === 'hoop') o = { type: 'hoop', x: ox, x0: ox - 0.9, x1: ox + 0.9, y0: 2.55, y1: 3.75 };
        else o = { type: 'net', x: 0, x0: -HW, x1: HW, y0: 1.55, y1: 2.45, hint: pend === 'under' ? '▼ DRUNTER' : '▲ DRÜBER' };
        o.zw = oz; o.done = false; o.kind = 'o';
        obs.push(o);
      }
      lastZw = zw; lastGx = g.x0; lastGy = g.y0;
    }
    function fillCourse() { while (lastZw - dist < ZF + 6) spawnGate(); }
    function resetCourse(ahead) {
      gates = []; obs = []; gateN = 0;
      lastZw = dist + ahead; lastGx = clamp(cx * 0.6, -2.5, 2.5); lastGy = clamp(cy, 1.8, 3.4);
      gates.push(newGate(lastZw, lastGx, lastGy, demoLike() ? 1 : 1.08));
      fillCourse();
    }
    function nextGate() {
      for (let i = 0; i < gates.length; i++) { const g = gates[i]; if (!g.done && g.zw - dist > 0.4) return g; }
      return null;
    }
    function nextObs(maxZw) {
      for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (!o.done && o.zw - dist > 0.3 && o.zw < maxZw) return o; }
      return null;
    }
    function newPart(p, far) {
      p.x = rand(-HW + 0.4, HW - 0.4); p.y = rand(0.25, HH - 0.3);
      p.z = far ? rand(ZF * 0.3, ZF * 0.6) : rand(ZN + 1, ZF * 0.6);
      if (Math.abs(p.x - cx) < 1.2 && Math.abs(p.y - cy) < 0.9) p.x += p.x < cx ? -1.8 : 1.8;
      return p;
    }
    for (let i = 0; i < (rm ? 14 : 38); i++) parts.push(newPart({}, false));

    /* ---------- Spielablauf ---------- */
    function arm(resume) {
      if (resume) {
        if (state !== 'pause') return;
        v = 0; gates = gates.filter((g) => g.done || g.zw - dist > 8); obs = obs.filter((o) => o.done || o.zw - dist > 8);
        if (mode === 'tilt') toast('Halte das Handy bequem. So ist die Mitte.', 2.2);
      } else {
        if (!(state === 'demo' || state === 'idle' || state === 'over')) return;
        if (mob) enterFull();
        state = 'count';                      // vor dem Streckenbau: sonst entstünde noch eine Demo-Strecke
        score = 0; combo = 0; bestCombo = 0; lives = 3; passed = 0; flightT = 0; volt = 4.2; sag = 0; curLvl = 1; near = 0;
        crashT = 0; missT = 0; endReason = ''; pops.length = 0; hits.length = 0; submitted = false; runData = null;
        glitchT = rm ? 0 : 0.32;              // kurzer Kanalwechsel, wie beim Umschalten der Brille
        resetTrackAhead(dist + 2); courseStart = dist + 2;
        resetCourse(20); tx = cx; ty = cy;
        if (mode === 'tilt') { tilt.have = false; tilt.t0 = clock; toast('Halte das Handy bequem. So ist die Mitte.', 2.4); }
        else if (mode === 'touch') toast('Zieh mit dem Finger über das Bild.', 2.2);
        say('Startsequenz. ' + modeText() + ' Drei Leben, drei Level, der Akku hält 90 Sekunden.');
        loadBoard();                          // erste Runde: Online-Bestenliste holen (Klick des Nutzers)
      }
      listenTilt(mode === 'tilt');
      state = 'count'; countT = 0; countStep = -1;
      setUI();
      try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
      startLoop();
    }
    function startWith(m) {
      if (!(state === 'demo' || state === 'idle' || state === 'over')) return;
      if (m !== 'tilt') { setMode(m); arm(false); return; }
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {        // iOS: Erlaubnis nach dem Tipp
        let p; try { p = DOE.requestPermission(); } catch (e) { p = Promise.reject(e); }
        if (mob) enterFull();
        Promise.resolve(p).then((r) => {
          if (r === 'granted') { setMode('tilt'); arm(false); }
          else { setMode('touch'); arm(false); toast('Kippen ist nicht erlaubt. Du steuerst mit dem Finger.', 3.2); }
        }, () => { setMode('touch'); arm(false); toast('Kippen geht hier nicht. Du steuerst mit dem Finger.', 3.2); });
      } else { setMode('tilt'); arm(false); }
    }
    function pause(why) {
      if (!(state === 'count' || state === 'play')) return;
      state = 'pause'; keys.l = keys.r = keys.u = keys.d = 0; touchId = null; msgT = 0; H_.msg.className = 'fcsg-msg';
      H_.ptxt.textContent = why || (mode === 'tilt' ? 'Beim Weiterfliegen zählt es kurz herunter. Halte das Handy dann bequem: diese Haltung wird die neue Mitte.' : 'Dein Whoop schwebt und wartet. Akku und Punkte bleiben, wie sie sind.');
      setUI(); stopLoop(); if (W) { render(); hud(); }
      say('Pause. Weiterfliegen mit dem Knopf' + (mob ? '.' : ' oder der Taste P.'));
    }
    function endGame(reason) {
      if (state === 'end' || state === 'over') return;
      state = 'end'; endReason = reason; endT = reason === 'bat' ? 2.0 : 1.5;
      if (reason === 'lives') crashT = 1.5;
      msgT = 0; H_.msg.className = 'fcsg-msg'; pops.length = 0;
      setUI();
      say(reason === 'bat' ? 'LAND NOW. Der Akku ist leer.' : reason === 'quit' ? 'Gelandet.' : 'SIGNAL LOST. Keine Leben mehr.');
    }
    function showOver() {
      state = 'over';
      exitFull(); listenTilt(false);
      const isBest = score > best;
      if (isBest) { best = score; lsSet(BEST_KEY, best); }
      runData = { score, gates: passed, combo: bestCombo, time: Math.round(flightT), device: mode === 'mouse' ? 'p' : 'm' };
      H_.why.textContent = endReason === 'bat' ? 'LAND NOW · Akku leer' : endReason === 'quit' ? 'Gelandet · Runde beendet' : 'SIGNAL LOST · keine Leben mehr';
      H_.fscore.textContent = num(score); H_.fgates.textContent = String(passed);
      H_.fcombo.textContent = String(bestCombo); H_.ftime.textContent = mmss(flightT); H_.flvl.textContent = String(curLvl);
      H_.newbest.hidden = !isBest; showBest();
      // Namensfeld nur mit gültigem Ergebnis (Punkte und mindestens 5 Sekunden)
      const ok = score > 0 && runData.time >= 5;
      H_.form.hidden = !ok; H_.placed.hidden = ok;
      H_.placed.textContent = ok ? '' : 'Für die Bestenliste brauchst du Punkte und mindestens 5 Sekunden Flug.';
      H_.fmsg.textContent = ''; H_.send.disabled = false; H_.send.textContent = 'Speichern';
      if (ok && !H_.name.value) H_.name.value = Scores.lastName();
      A_.again.className = ok ? 'btn' : 'btn solid';
      crashT = 0; missT = 0; glitchT = rm ? 0 : 0.4; tx = 0; ty = YC;
      if (rm) { v = 0; cx = 0; cy = YC; vx = vy = 0; roll = 0; }
      resetTrackAhead(dist + 2);
      resetCourse(rm ? 9 : 16);
      setUI();
      say('Spielende. ' + num(score) + ' Punkte, ' + passed + ' Gates, Level ' + curLvl + '.' + (isBest ? ' Neuer Bestwert!' : '') + (ok ? ' Du kannst deinen Namen in die Bestenliste eintragen.' : ''));
      const foc = ok && !mob ? H_.name : A_.again;
      try { foc.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      if (rm) { stopLoop(); renderStill(); }
    }
    function judge(g) {
      if (state === 'play' && g.lvl > curLvl) levelUp(g.lvl);
      const dx = Math.abs(cx - g.x), dy = Math.abs(cy - g.y), r = 0.13;
      const inside = dx < g.w / 2 - r && dy < g.h / 2 - r;
      if (state !== 'play' || crashT > 0) { if (inside && demoLike()) flash(g.bonus ? AMB : g.mv ? VIO : SIG, 0.45); return; }
      if (inside) pass(g, Math.max(dx / (g.w / 2), dy / (g.h / 2)));
      else if (dx < g.w / 2 + 0.26 + r && dy < g.h / 2 + 0.26 + r) { hits.push({ t: 'rahmen', mv: g.mv, w: +g.w.toFixed(2), dx: +(cx - g.x).toFixed(2), dy: +(cy - g.y).toFixed(2), k: +kNow.toFixed(3) }); crash('gate'); }
      else { hits.push({ t: 'verpasst', mv: g.mv, w: +g.w.toFixed(2), dx: +(cx - g.x).toFixed(2), dy: +(cy - g.y).toFixed(2), k: +kNow.toFixed(3) }); miss(); }
    }
    function judgeObs(o) {
      if (state !== 'play' || crashT > 0) return;
      const ddx = Math.max(o.x0 - cx, 0, cx - o.x1), ddy = Math.max(o.y0 - cy, 0, cy - o.y1), dd = Math.hypot(ddx, ddy);
      if (dd < 0.13) { hits.push({ t: o.type, x: +(cx - o.x).toFixed(2), y: +cy.toFixed(2) }); crash('obs'); return; }
      if (dd < 0.5) {                                    // knapp vorbei: kleiner Bonus
        const mult = curMult(); near++;
        score += 25 * mult;
        pops.push({ txt: '+' + 25 * mult, sub: 'KNAPP!', col: WHT, t: 0 }); if (pops.length > 3) pops.shift();
        beep(2400, 0.06, 'triangle', 0.12, 3000);
      }
    }
    const curMult = () => Math.min(4, 1 + Math.floor(Math.max(0, combo - 1) / 3));
    function pass(g, off) {
      combo++; passed++; if (combo > bestCombo) bestCombo = combo;
      const mult = curMult();
      const prevMult = Math.min(4, 1 + Math.floor(Math.max(0, combo - 2) / 3));
      const perfect = off < 0.4;
      const pts = (g.bonus ? 200 : g.mv ? 150 : 100) * mult + (perfect ? 50 * mult : 0);
      score += pts;
      let sub = perfect ? 'PERFEKT' : g.bonus ? 'BONUS-GATE' : g.mv ? 'WACKEL-GATE' : '';
      if (mult > prevMult) sub = (sub ? sub + ' · ' : '') + 'KOMBO ×' + mult;
      const col = g.bonus ? AMB : g.mv ? VIO : SIG;
      pops.push({ txt: '+' + pts, sub, col, t: 0 }); if (pops.length > 3) pops.shift();
      flash(col, perfect ? 0.95 : 0.65);
      sfxGate(perfect || g.bonus || g.mv);
    }
    function crash(kind) {
      lives--; combo = 0; crashT = 0.95; shake = 1; v *= 0.15; vx *= -0.5; vy *= -0.5;
      gates = gates.filter((g) => g.done || g.zw - dist > 10);     // freie Bahn nach dem Absturz
      obs = obs.filter((o) => o.done || o.zw - dist > 10);
      sfxCrash();
      if (lives <= 0) endGame('lives'); else say((kind === 'obs' ? 'Hindernis getroffen.' : 'Absturz.') + ' Noch ' + lives + ' Leben.');
    }
    function miss() {
      lives--; combo = 0; missT = 1.0; flash(RED, 0.9); sfxMiss();
      if (lives <= 0) endGame('lives'); else say('Gate verpasst. Noch ' + lives + ' Leben.');
    }
    function levelUp(l) {
      curLvl = l;
      msg('LEVEL ' + l, 'lvl', 1.5);
      toast(l === 2 ? 'Kurven, Netze, Leitern und Wackel-Gates' : 'Enge Gates, Körbe und mehr Tempo', 2.6);
      flash(AMB, 0.8);
      beep(880, 0.1, 'square', 0.12); beep(1320, 0.1, 'square', 0.12, 0, 0.11); beep(1760, 0.2, 'square', 0.12, 0, 0.22);
      say('Level ' + l + '.');
    }
    function flash(c, a) { flashC = c; flashA = a; flashT = 1; }
    function msg(text, extra, dur) {
      H_.msg.textContent = text;
      H_.msg.className = 'fcsg-msg ' + (extra || '');
      void H_.msg.offsetWidth;                     // Animation neu starten
      H_.msg.className = 'fcsg-msg on pop ' + (extra || '');
      msgT = dur || 0.6;
    }
    function toast(text, dur) { H_.toast.textContent = text; H_.toast.className = 'fcsg-toast on'; toastT = dur || 2; }

    /* ---------- Steuerung ---------- */
    function setMode(m) {
      mode = m;
      host.classList.toggle('m-tilt', m === 'tilt'); host.classList.toggle('m-touch', m === 'touch');
      if (full) { full.wrap.classList.toggle('m-tilt', m === 'tilt'); full.wrap.classList.toggle('m-touch', m === 'touch'); }
      A_.swap.textContent = m === 'tilt' ? 'Mit dem Finger steuern' : 'Handy kippen';
      A_.swap.hidden = !canTilt;
      H_.keys.textContent = keysText();
      if (isLive() || state === 'pause') listenTilt(m === 'tilt');
    }
    function keysText() {
      if (mode === 'tilt') return 'Steuerung: Handy kippen. Oben zu dir kippen heißt steigen. Die Haltung beim Herunterzählen ist die Mitte, der Knopf „Mitte“ setzt sie neu.';
      if (mob) return 'Am Handy: kippen oder mit dem Finger über das Bild ziehen. Während des Flugs füllt das Spiel den Bildschirm.';
      return 'Steuerung: Maus bewegen oder Pfeiltasten und WASD. P pausiert.';
    }
    const modeText = () => (mode === 'tilt' ? 'Steuern durch Kippen des Handys.' : mode === 'touch' ? 'Steuern mit dem Finger.' : 'Steuern mit Maus oder Pfeiltasten.');
    function autopilot() {
      const g = nextGate();
      if (!g) return;
      const Kc = demoLike() ? 9 : 17, ff = kNow * v * v * CF / Kc;           // Fliehkraft vorhalten
      let gx = g.x, gy = g.y;
      if (g.mv) {                                       // bewegliches Gate: dorthin, wo es beim Durchflug sein wird
        const o2 = Math.sin(g.om * (clock + (g.zw - dist) / Math.max(v, 2)) + g.ph) * g.amp;
        if (g.mv === 1) gx = g.x0 + o2; else gy = g.y0 + o2;
      }
      const o = nextObs(g.zw);
      if (o) {                                          // Hindernis vor dem Gate: einmal entscheiden, dann ausweichen
        if (!o.dg) {
          const fr = clamp((o.zw - dist) / Math.max(0.5, g.zw - dist), 0, 1);
          const px = lerp(cx, g.x, fr), py = lerp(cy, g.y, fr), m = 0.45;
          o.dg = { x: null, y: null };
          if (px > o.x0 - m && px < o.x1 + m && py > o.y0 - m && py < o.y1 + m) {
            if (o.type === 'net') o.dg.y = g.y > 2 ? o.y1 + 0.55 : o.y0 - 0.45;
            else if (o.type === 'hoop') o.dg.y = o.y0 - 0.6;
            else o.dg.x = Math.abs(px - (o.x0 - 0.8)) < Math.abs(px - (o.x1 + 0.8)) ? o.x0 - 0.8 : o.x1 + 0.8;
          }
        }
        if (o.dg.x != null) gx = o.dg.x;
        if (o.dg.y != null) gy = o.dg.y;
      }
      tx = clamp(gx + ff + Math.sin(clock * 0.8) * 0.12, -RX - 1, RX + 1); ty = gy + Math.sin(clock * 1.3) * 0.08;
    }
    function steerKeys(dt) {
      const kx = keys.r - keys.l, ky = keys.u - keys.d;
      if (kx || ky) { tx = clamp(tx + kx * 7.5 * dt, -RX, RX); ty = clamp(ty + ky * 5.2 * dt, YMIN, YMAX); }
    }
    function aimAbs(e) {   // Maus: Position auf dem Bild = Ziel im Flugbereich
      const r = cv.getBoundingClientRect(); if (!r.width) return;
      const nx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.3, -1, 1);
      const ny = clamp(((e.clientY - r.top) / r.height - 0.5) * 2.3, -1, 1);
      tx = nx * RX; ty = YC - ny * (YMAX - YC);
    }
    // Handy als Joystick: Schwerkraft im Gerät -> in Bildschirmachsen drehen -> Kippwinkel links/rechts und vor/zurück
    function scrAngle() {
      const so = screen.orientation;
      const a = so && typeof so.angle === 'number' ? so.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
      return ((a % 360) + 360) % 360;
    }
    function onOri(e) {
      if (e.beta == null || e.gamma == null) return;
      const b = e.beta * DEG, gm = e.gamma * DEG;
      const gx = Math.cos(b) * Math.sin(gm), gy = -Math.sin(b), gz = -Math.cos(b) * Math.cos(gm);
      const th = scrAngle() * DEG, c = Math.cos(th), s = Math.sin(th);
      const sx = gx * c - gy * s, sy = gx * s + gy * c;
      const lr = Math.asin(clamp(sx, -1, 1)) / DEG;           // + = rechte Seite nach unten
      const fb = Math.atan2(-sy, -gz) / DEG;                   // 0 = flach, 90 = senkrecht vor dir
      if (!tilt.have) { tilt.s[0] = tilt.n0[0] = lr; tilt.s[1] = tilt.n0[1] = fb; }
      tilt.raw[0] = lr; tilt.raw[1] = fb; tilt.have = true;
    }
    function listenTilt(on) {
      if (on === tilt.on) return;
      tilt.on = on;
      if (on) window.addEventListener('deviceorientation', onOri); else window.removeEventListener('deviceorientation', onOri);
    }
    const shape = (d, dz, mx) => { const a = Math.abs(d); if (a <= dz) return 0; let u = Math.min(1, (a - dz) / (mx - dz)); u = 0.6 * u + 0.4 * u * u * u; return d < 0 ? -u : u; };
    function steerTilt(dt) {
      if (!tilt.have) return;
      const al = 1 - Math.exp(-dt / 0.06);                     // Glättung ca. 60 ms
      tilt.s[0] += (tilt.raw[0] - tilt.s[0]) * al;
      tilt.s[1] += (tilt.raw[1] - tilt.s[1]) * al;
      if (state === 'count') { tilt.n0[0] = tilt.s[0]; tilt.n0[1] = tilt.s[1]; }   // Haltung beim Herunterzählen = Mitte
      const nx = shape(tilt.s[0] - tilt.n0[0], 1.5, 15);      // Totzone 1,5°, voller Ausschlag bei 15°
      const ny = shape(tilt.s[1] - tilt.n0[1], 1.5, 13) * (tilt.inv ? -1 : 1);
      tx = nx * RX; ty = YC + ny * (ny > 0 ? YMAX - YC : YC - YMIN);
    }
    function recal() {
      if (!tilt.have) return;
      tilt.n0[0] = tilt.s[0]; tilt.n0[1] = tilt.s[1];
      toast('Mitte neu gesetzt', 1.2); beep(990, 0.07, 'sine', 0.15); say('Mitte neu gesetzt.');
    }

    /* ---------- Vollbild am Handy: Seite scrollt nicht, solange das Spiel läuft ---------- */
    function enterFull() {
      if (full) return;
      const ph = document.createElement('div');
      ph.className = 'fcsg-ph'; ph.style.height = stage.offsetHeight + 'px';
      stage.parentNode.insertBefore(ph, stage);
      const wrap = document.createElement('div');
      wrap.className = host.className + ' fcsg-full';
      wrap.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
      wrap.appendChild(stage); document.body.appendChild(wrap);
      document.documentElement.classList.add('fcsg-lock');
      full = { wrap, ph };
      if (wrap.requestFullscreen && !/iP(hone|od)/.test(navigator.userAgent)) {
        try {
          const p = wrap.requestFullscreen({ navigationUI: 'hide' });
          if (p && p.then) p.then(() => { try { const so = screen.orientation; if (so && so.lock) so.lock(so.type).catch(() => {}); } catch (e) { /* egal */ } }).catch(() => {});
        } catch (e) { /* kein Vollbild */ }
      }
      resize();
    }
    function exitFull() {
      if (!full) return;
      const f0 = full; full = null;
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* egal */ }
      try { const so = screen.orientation; if (so && so.unlock) so.unlock(); } catch (e) { /* egal */ }
      f0.ph.parentNode.replaceChild(stage, f0.ph);
      f0.wrap.remove();
      document.documentElement.classList.remove('fcsg-lock');
      resize();
      requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) { try { stage.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'center' }); } catch (e) { /* egal */ } }
      });
    }

    /* ---------- Simulation ---------- */
    function update(dt) {
      clock += dt;
      ensureTrack(dist + ZF + 30);
      const auto = demoLike();
      kNow = kAt(dist);
      if (auto || (assist && state === 'play')) autopilot();
      else if (state === 'count' || state === 'play') { if (mode === 'tilt') steerTilt(dt); else steerKeys(dt); }
      else if (state === 'end' && mode === 'tilt') steerTilt(dt);
      if (state === 'end' && endReason === 'bat') { tx = cx; ty = 0.35; }
      if (mode === 'tilt' && !tilt.have && (state === 'count' || state === 'play') && clock - tilt.t0 > 1.6) {
        setMode('touch'); toast('Kein Lagesensor gefunden. Steuer mit dem Finger.', 3.2); say('Kein Lagesensor gefunden. Steuern mit dem Finger.');
      }

      if (auto) vTarget = 9;
      else if (state === 'count' || state === 'end') vTarget = 0;
      else if (state === 'play') vTarget = crashT > 0 ? 0 : Math.min(VMAX, 8 + flightT * 0.105);
      v += (vTarget - v) * Math.min(1, dt * (vTarget > v ? 1.7 : 2.6));
      dist += v * dt;
      fX0 = trAt(tkX, dist); fS0 = trAt(tkS, dist);

      // Feder mit Dämpfung: der Whoop folgt dem Ziel weich und mit Trägheit, Kurven drücken nach außen
      const K = auto ? 9 : 17, Dm = auto ? 5.4 : 7.2;
      const ax = K * (tx - cx) - Dm * vx - kNow * v * v * CF, ay = K * (ty - cy) - Dm * vy;
      vx += ax * dt; vy += ay * dt;
      cx = clamp(cx + vx * dt, -HW + 0.8, HW - 0.8);
      cy = clamp(cy + vy * dt, 0.25, HH - 0.7);
      const bank = clamp(-kNow * v * 1.0, -0.24, 0.24);         // Schräglage in der Kurve
      roll += (clamp(clamp(-vx * 0.045, -0.3, 0.3) + bank, -0.42, 0.42) - roll) * Math.min(1, dt * 7);
      sag += ((Math.min(1, Math.hypot(ax, ay) / 60) * 0.06 + v / 16 * 0.03) - sag) * Math.min(1, dt * 4);
      let ka = 0;
      for (let z = 14; z <= 40; z += 13) { const k = kAt(dist + z); if (Math.abs(k) > Math.abs(ka)) ka = k; }
      kAhead = ka;

      for (let i = 0; i < parts.length; i++) { const p = parts[i]; p.z -= v * dt; if (p.z < ZN + 0.2) newPart(p, true); }
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i]; if (g.done || !g.mv) continue;
        const o = Math.sin(clock * g.om + g.ph) * g.amp;
        if (g.mv === 1) g.x = g.x0 + o; else g.y = g.y0 + o;
      }
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i]; if (o.done) continue;
        if (o.zw - dist > 0) break;
        o.done = true; judgeObs(o);
      }
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i]; if (g.done) continue;
        if (g.zw - dist > 0) break;
        g.done = true; judge(g);
      }
      while (gates.length && gates[0].zw - dist < -2) gates.shift();
      while (obs.length && obs[0].zw - dist < -2) obs.shift();
      fillCourse();

      if (state === 'count') {
        countT += dt;
        const step = Math.floor(countT / 0.62);
        if (step !== countStep) {
          countStep = step;
          if (step < 3) { msg(String(3 - step), '', 0.55); beep(660, 0.09, 'square', 0.12); }
          else { msg('ARMED', 'armed', 1.1); beep(1320, 0.22, 'square', 0.14); state = 'play'; setUI(); say('Scharf geschaltet. Los!'); }
        }
      } else if (state === 'play') {
        flightT += dt;
        volt = voltAt(Math.min(1, flightT / BAT_T)) - sag;
        if (flightT >= BAT_T) { volt = 3.5; endGame('bat'); }
      } else if (state === 'end') {
        endT -= dt; if (endT <= 0) showOver();
      }

      if (crashT > 0) crashT -= dt;
      if (glitchT > 0) glitchT -= dt;
      if (missT > 0) missT -= dt;
      if (flashT > 0) flashT = Math.max(0, flashT - dt * 2.8);
      if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) H_.msg.className = 'fcsg-msg'; }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) H_.toast.className = 'fcsg-toast'; }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.1) pops.splice(i, 1); }
    }

    /* ---------- Zeichnen ---------- */
    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = FOG; ctx.fillRect(0, 0, W, H);
      fX0 = trAt(tkX, dist); fS0 = trAt(tkS, dist);
      ctx.save();
      let ox = 0, oy = 0;
      if (!rm) {
        const vib = clamp(v / 16, 0, 1) * 0.35;                        // feines Propeller-Zittern
        ox = Math.sin(clock * 61) * vib + (shake ? rand(-1, 1) * shake * 9 : 0);
        oy = Math.cos(clock * 47) * vib + (shake ? rand(-1, 1) * shake * 9 : 0);
      }
      ctx.translate(W / 2 + ox, H / 2 + oy);
      ctx.rotate(roll);
      drawWorld();
      drawSpeed();
      drawAim();
      ctx.restore();
      drawScreen();
    }

    // Maler-Verfahren: Scheibe für Scheibe von hinten nach vorne, damit Kurven richtig verdecken
    function drawWorld() {
      const R = Math.hypot(W, H);
      drawList.length = 0;
      for (let i = 0; i < gates.length; i++) drawList.push(gates[i]);
      for (let i = 0; i < obs.length; i++) drawList.push(obs[i]);
      drawList.sort((a, b) => b.zw - a.zw);
      let p = 0, haze = false;
      const nx = nextGate();
      for (let i = NSL - 1; i >= 0; i--) {
        const zA = ZS[i], zB = ZS[i + 1];
        if (!haze && zA < 22) { drawHaze(R); haze = true; }
        const lo = i === 0 ? dist - 40 : dist + zA, hi = dist + zB;
        surf(i, zA, zB);
        for (let zw = first(lo + 0.06, 6, 0); zw < hi + 0.06; zw += 6) {   // Linien quer
          const m = ((Math.round(zw / 6) % 4) + 4) % 4;
          crossLine(zw, m === 0 || m === 2 ? 9.5 : 8.1, m === 0 ? WHT : m === 2 ? BLU : AMB, m === 0 ? 0.55 : m === 2 ? 0.5 : 0.42, m === 0 ? 0.06 : 0.05);
        }
        for (let zw = first(lo + 3, 24, 0); zw < hi + 3; zw += 24) drawCircle(zw - dist);
        for (let zw = first(lo, 6, 0); zw < hi; zw += 6) drawField(zw - dist);
        for (let zw = first(lo, 24, 8); zw < hi; zw += 24) drawBars(zw - dist, -1);
        for (let zw = first(lo, 24, 20); zw < hi; zw += 24) drawBars(zw - dist, 1);
        for (let zw = first(lo, 24, 15); zw < hi; zw += 24) drawRope(zw - dist, -1);
        for (let zw = first(lo, 24, 3); zw < hi; zw += 24) drawRope(zw - dist, 1);
        for (let j = 0; j < cs.length; j++) {
          const c = cs[j]; if (Math.abs(c.k) < 0.0045 || c.s1 < lo || c.s0 > hi) continue;
          for (let zw = Math.max(first(lo, 7, c.s0 + 3), c.s0 + 3); zw < Math.min(hi, c.s1 - 3); zw += 7) drawSign(zw - dist, c.k > 0 ? -1 : 1);
        }
        for (let zw = first(lo + 2.8, 6, 3); zw < hi + 2.8; zw += 6) drawLamp(zw - dist);
        while (p < drawList.length) {
          const it = drawList[p], rel = it.zw - dist;
          if (rel >= ZF) { p++; continue; }
          if (i > 0 && rel < zA) break;
          p++;
          if (rel < 0.35) continue;
          if (it.kind === 'g') drawGate(it, rel, it === nx); else drawObs(it, rel);
        }
      }
      if (!haze) drawHaze(R);
    }
    function surf(i, zA, zB) {
      const c = SC[i];
      ctx.beginPath(); q4(-HW, HH, zA, HW, HH, zA, HW, HH, zB, -HW, HH, zB); ctx.fillStyle = c.ceil; ctx.fill();
      ctx.beginPath(); q4(-HW, 0, zA, HW, 0, zA, HW, 0, zB, -HW, 0, zB); ctx.fillStyle = c.floor; ctx.fill();
      for (let k = 0; k < 3; k++) {                       // Spielfeldlinien längs
        const S = STRIPES[k];
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) { const x = s * S[0], w = S[1]; q4(x - w, 0, zA, x + w, 0, zA, x + w, 0, zB, x - w, 0, zB); }
        ctx.fillStyle = c.st[S[2]]; ctx.fill();
      }
      ctx.beginPath(); q4(-HW, 0, zA, -HW, HH, zA, -HW, HH, zB, -HW, 0, zB); q4(HW, 0, zA, HW, HH, zA, HW, HH, zB, HW, 0, zB);
      ctx.fillStyle = c.wall; ctx.fill();
      ctx.beginPath(); q4(-HW, 0, zA, -HW, 1.9, zA, -HW, 1.9, zB, -HW, 0, zB); q4(HW, 0, zA, HW, 1.9, zA, HW, 1.9, zB, HW, 0, zB);
      ctx.fillStyle = c.pad; ctx.fill();                   // Prallschutz in Vereinsblau
      ctx.beginPath(); q4(-HW, 1.9, zA, -HW, 1.97, zA, -HW, 1.97, zB, -HW, 1.9, zB); q4(HW, 1.9, zA, HW, 1.97, zA, HW, 1.97, zB, HW, 1.9, zB);
      ctx.fillStyle = c.padl; ctx.fill();
    }
    function drawHaze(R) {            // Dunst am Ende der Halle, folgt der Kurve
      const hx = clamp(bendZ(34) * f / 34, -W * 0.7, W * 0.7);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(hx, 0, 0, hx, 0, R * 0.42);
      g.addColorStop(0, 'rgba(47,111,208,.30)'); g.addColorStop(0.5, 'rgba(47,111,208,.07)'); g.addColorStop(1, 'rgba(47,111,208,0)');
      ctx.fillStyle = g; ctx.fillRect(hx - R, -R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawField(z) {           // Pfosten, Träger, Fensterband (alle 6 m)
      if (z < 0.5) return;
      const a = fogA(z); if (a < 0.02) return;
      const z0 = Math.max(ZN, z - 0.06), z1 = z + 0.06;
      ctx.beginPath();
      q4(-HW, 0, z0, -HW, HH, z0, -HW, HH, z1, -HW, 0, z1);
      q4(HW, 0, z0, HW, HH, z0, HW, HH, z1, HW, 0, z1);
      ctx.fillStyle = rgba([3, 8, 18], 0.6 * a); ctx.fill();
      ctx.beginPath(); q4(-HW, HH - 0.32, z, HW, HH - 0.32, z, HW, HH, z, -HW, HH, z);
      ctx.fillStyle = rgba([3, 8, 18], 0.55 * a); ctx.fill();
      ctx.beginPath();
      for (let p = 0; p < 3; p++) {
        const w0 = z + 0.55 + p * 1.7, w1 = w0 + 1.45;
        q4(-HW, 5, w0, -HW, 6.6, w0, -HW, 6.6, w1, -HW, 5, w1);
        q4(HW, 5, w0, HW, 6.6, w0, HW, 6.6, w1, HW, 5, w1);
      }
      ctx.fillStyle = rgba([70, 135, 225], 0.13 * a); ctx.fill();
    }
    function drawLamp(z) {            // Deckenlampen mit Schein und Spiegelung im glänzenden Hallenboden
      if (z < 1.2) return;
      const a = fogA(z) * clamp((z - 1.2) / 5, 0, 1); if (a < 0.02) return;
      const z0 = Math.max(ZN, z - 1.2), z1 = z + 1.2, h0 = Math.max(ZN, z - 2.6), h1 = z + 2.6, r0 = Math.max(ZN, z - 2.8), r1 = z + 2.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let lx = -7.5; lx <= 7.5; lx += 5) q4(lx - 1.5, HH - 0.07, h0, lx + 1.5, HH - 0.07, h0, lx + 1.5, HH - 0.07, h1, lx - 1.5, HH - 0.07, h1);
      ctx.fillStyle = rgba([140, 195, 255], 0.1 * a); ctx.fill();
      ctx.beginPath();
      for (let lx = -7.5; lx <= 7.5; lx += 5) q4(lx - 0.6, -HH, r0, lx + 0.6, -HH, r0, lx + 0.6, -HH, r1, lx - 0.6, -HH, r1);
      ctx.fillStyle = rgba([190, 225, 255], 0.1 * a); ctx.fill();
      ctx.beginPath();
      for (let lx = -7.5; lx <= 7.5; lx += 5) q4(lx - 0.3, -HH, z0, lx + 0.3, -HH, z0, lx + 0.3, -HH, z1, lx - 0.3, -HH, z1);
      ctx.fillStyle = rgba([220, 240, 255], 0.12 * a); ctx.fill();
      ctx.beginPath();
      for (let lx = -7.5; lx <= 7.5; lx += 5) q4(lx - 0.5, HH - 0.06, z0, lx + 0.5, HH - 0.06, z0, lx + 0.5, HH - 0.06, z1, lx - 0.5, HH - 0.06, z1);
      ctx.fillStyle = rgba([235, 246, 255], 0.95 * a); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    function crossLine(zw, xw, col, a, lw) {
      const z = zw - dist; if (z < 0.5 || z > ZF) return;
      const al = fogA(z) * a; if (al < 0.01) return;
      ctx.beginPath(); q4(-xw, 0, Math.max(ZN, z - lw), xw, 0, Math.max(ZN, z - lw), xw, 0, z + lw, -xw, 0, z + lw);
      ctx.fillStyle = rgba(col, al); ctx.fill();
    }
    function drawCircle(zc) {         // Mittelkreis
      if (zc <= -3 || zc >= ZF) return;
      ctx.beginPath(); let pen = false;
      for (let i = 0; i <= 36; i++) {
        const th = i / 36 * Math.PI * 2, z = zc + 3 * Math.sin(th);
        if (z < 0.7) { pen = false; continue; }
        const sx = PX(3 * Math.cos(th), z), sy = PY(0, z);
        if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        pen = true;
      }
      const zr = Math.max(1.5, zc);
      ctx.lineWidth = clamp(0.07 * f / zr, 0.6, 7); ctx.strokeStyle = rgba(WHT, 0.5 * fogA(zr)); ctx.stroke();
    }
    function drawBars(zb, s) {        // Sprossenwand
      if (zb + 3.6 <= 0.6 || zb >= ZF) return;
      const a = fogA(Math.max(zb, 1)) * 0.55, x = s * (HW - 0.05);
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const z = zb + i * 0.45; if (z < 0.6) continue; ctx.moveTo(PX(x, z), PY(0, z)); ctx.lineTo(PX(x, z), PY(2.7, z)); }
      const za = Math.max(0.6, zb), ze = zb + 3.6;
      if (ze > za) { ctx.moveTo(PX(x, za), PY(2.7, za)); ctx.lineTo(PX(x, ze), PY(2.7, ze)); }
      ctx.lineWidth = clamp(0.05 * f / Math.max(zb + 1.8, 1), 0.7, 5); ctx.strokeStyle = rgba(WOOD, a); ctx.stroke();
    }
    function drawRope(zr, s) {        // Kletterseile
      if (zr <= 0.8 || zr >= ZF) return;
      const a = fogA(zr) * 0.5 * clamp((zr - 0.8) / 3, 0, 1), x0 = s * 9.2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const z = zr + i * 0.8, x = x0 - s * i * 0.05; ctx.moveTo(PX(x, z), PY(HH - 0.3, z)); ctx.lineTo(PX(x, z), PY(1.25, z)); }
      ctx.lineWidth = clamp(0.045 * f / zr, 0.6, 5); ctx.strokeStyle = rgba(WOOD, a); ctx.stroke();
    }
    function drawSign(z, s) {         // Kurven-Pfeiltafel an der Außenwand
      if (z < 1 || z > ZF) return;
      const a = fogA(z); if (a < 0.03) return;
      const x = s * (HW - 0.03), z1 = z + 2.4;
      ctx.beginPath(); q4(x, 2.55, z, x, 3.45, z, x, 3.45, z1, x, 2.55, z1);
      ctx.fillStyle = rgba([24, 15, 3], 0.9 * a); ctx.fill();
      ctx.beginPath();
      for (let j = 0; j < 2; j++) {
        const zc = z + 0.45 + j * 1.0;
        ctx.moveTo(PX(x, zc), PY(3.3, zc)); ctx.lineTo(PX(x, zc + 0.6), PY(3.0, zc + 0.6)); ctx.lineTo(PX(x, zc), PY(2.7, zc));
      }
      const lw = clamp(0.11 * f / (z + 1), 1, 14);
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = lw * 2.6; ctx.strokeStyle = rgba(AMB, 0.22 * a); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = lw; ctx.strokeStyle = rgba(AMB, 0.95 * a); ctx.stroke();
      ctx.lineJoin = 'miter';
    }

    function drawGate(g, rel, isNext) {
      const a = fogA(rel); if (a < 0.02) return;
      const k = f / rel, kb = f / (rel + 0.24);
      const hw = g.w / 2, hh = g.h / 2, ft = 0.26;
      const gx = g.x + bendZ(rel) - cx, top = cy - (g.y + hh), bot = cy - (g.y - hh);
      const ix0 = (gx - hw) * k, ix1 = (gx + hw) * k, iy0 = top * k, iy1 = bot * k;
      const ox0 = (gx - hw - ft) * k, ox1 = (gx + hw + ft) * k, oy0 = (top - ft) * k, oy1 = (bot + ft) * k;
      const fy = cy * k;
      const col = g.bonus ? AMB : g.mv ? VIO : SIG;
      const pulse = isNext ? 0.82 + 0.18 * Math.sin(clock * 9) : 0.6;

      // Lichtschein der LEDs auf dem Boden
      ctx.globalCompositeOperation = 'lighter';
      const sy = clamp(cy / rel * 1.3, 0.04, 1), rr = (hw + 1.2) * k;
      if (rr > 2) {
        ctx.save(); ctx.translate(gx * k, fy); ctx.scale(1, sy);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        gr.addColorStop(0, rgba(col, 0.2 * a * pulse)); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Standrohre bis zum Boden
      const lw = Math.max(1, 0.09 * k);
      ctx.fillStyle = rgba([16, 32, 60], a);
      ctx.fillRect(ox0 + 0.1 * k, oy1, lw, fy - oy1);
      ctx.fillRect(ox1 - 0.1 * k - lw, oy1, lw, fy - oy1);
      ctx.fillRect(ox0 - 0.15 * k, fy - 0.05 * k, 0.55 * k, Math.max(1, 0.05 * k));
      ctx.fillRect(ox1 - 0.4 * k, fy - 0.05 * k, 0.55 * k, Math.max(1, 0.05 * k));

      // Innenflächen (Tiefe des Rahmens)
      const bx0 = (gx - hw) * kb, bx1 = (gx + hw) * kb, by0 = top * kb, by1 = bot * kb;
      ctx.fillStyle = rgba([9, 20, 40], a);
      ctx.beginPath(); ctx.moveTo(ix0, iy0); ctx.lineTo(ix1, iy0); ctx.lineTo(bx1, by0); ctx.lineTo(bx0, by0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba([40, 72, 124], a);
      ctx.beginPath(); ctx.moveTo(ix0, iy1); ctx.lineTo(ix1, iy1); ctx.lineTo(bx1, by1); ctx.lineTo(bx0, by1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba([22, 44, 82], a);
      ctx.beginPath(); ctx.moveTo(ix0, iy0); ctx.lineTo(bx0, by0); ctx.lineTo(bx0, by1); ctx.lineTo(ix0, iy1); ctx.closePath();
      ctx.moveTo(ix1, iy0); ctx.lineTo(bx1, by0); ctx.lineTo(bx1, by1); ctx.lineTo(ix1, iy1); ctx.closePath(); ctx.fill();

      // Rahmen vorne (gepolstert)
      ctx.beginPath(); ctx.rect(ox0, oy0, ox1 - ox0, oy1 - oy0); ctx.rect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      ctx.fillStyle = rgba([19, 38, 72], a); ctx.fill('evenodd');
      ctx.lineWidth = Math.max(1, 0.02 * k); ctx.strokeStyle = rgba([130, 180, 240], 0.3 * a); ctx.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
      if (k > 70) {                                    // Vereinsschriftzug auf dem Rahmen
        const fs = Math.round(0.13 * k);
        ctx.font = '600 ' + fs + 'px "Chakra Petch", ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(WHT, 0.5 * a * clamp((k - 70) / 60, 0, 1));
        ctx.fillText('FLIGHT CLUB SAAR', gx * k, (bot + ft * 0.5) * k);
      }

      // LED-Leiste rund um die Öffnung
      const e = 0.07 * k, lx = ix0 - e, ly = iy0 - e, lwid = ix1 - ix0 + 2 * e, lhei = iy1 - iy0 + 2 * e;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = clamp(0.5 * k, 3, 140); ctx.strokeStyle = rgba(col, 0.15 * a * pulse); ctx.strokeRect(lx, ly, lwid, lhei);
      ctx.lineWidth = clamp(0.18 * k, 2, 60); ctx.strokeStyle = rgba(col, 0.28 * a * pulse); ctx.strokeRect(lx, ly, lwid, lhei);
      if (rel < 14 && v > 3 && !rm) {                     // Bewegungsunschärfe der nahen LEDs
        const ks = f / (rel + v * 0.045), sx0 = (gx - hw) * ks - 0.07 * ks, sy0 = top * ks - 0.07 * ks;
        ctx.lineWidth = clamp(0.1 * ks, 1, 30); ctx.strokeStyle = rgba(col, 0.22 * a);
        ctx.strokeRect(sx0, sy0, (2 * hw + 0.14) * ks, (bot - top + 0.14) * ks);
      }
      ctx.lineWidth = clamp(0.075 * k, 1.2, 26); ctx.strokeStyle = rgba(col, 0.95 * a); ctx.strokeRect(lx, ly, lwid, lhei);
      ctx.lineWidth = clamp(0.025 * k, 0.6, 9); ctx.strokeStyle = rgba(HOT, 0.6 * a);
      if (isNext && !rm) { ctx.setLineDash([0.32 * k, 0.22 * k]); ctx.lineDashOffset = -clock * 1.4 * k; }
      ctx.strokeRect(lx, ly, lwid, lhei);
      ctx.setLineDash([]);
      // Spiegelung der LEDs im Boden
      const ry0 = (cy + g.y - hh - e) * k, ry1 = (cy + g.y + hh + e) * k;
      ctx.lineWidth = clamp(0.14 * k, 1, 40); ctx.strokeStyle = rgba(col, 0.12 * a);
      ctx.strokeRect(lx, ry0, lwid, ry1 - ry0);
      ctx.globalCompositeOperation = 'source-over';

      // Nummer, Bonus oder Bewegungsrichtung über dem Gate
      if (k > 13 && k < 300) {
        const fs = Math.min(56, Math.round(0.36 * k));
        ctx.font = '700 ' + fs + 'px "Chakra Petch", ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = rgba(col, (isNext ? 0.95 : 0.7) * a * clamp((190 - k) / 80, 0, 1));
        const lab = g.bonus ? 'BONUS ×2' : 'GATE ' + pad(g.n % 100);
        ctx.fillText(g.mv === 1 ? '◀ ' + lab + ' ▶' : g.mv === 2 ? '▲ ' + lab + ' ▼' : lab, gx * k, oy0 - 0.16 * k);
      }
    }

    function drawObs(o, rel) {
      const a = fogA(rel); if (a < 0.02) return;
      const k = f / rel, bz = bendZ(rel);
      const X = (x) => (x + bz - cx) * k, Y = (y) => (cy - y) * k;
      ctx.lineCap = 'round';
      if (o.type === 'net') {                            // Volleyballnetz quer durch die Halle
        const xl = -HW + 0.9, xr = HW - 0.9, pw = Math.max(1.5, 0.09 * k);
        ctx.fillStyle = rgba([150, 165, 190], 0.85 * a);
        ctx.fillRect(X(xl) - pw / 2, Y(2.62), pw, Y(0) - Y(2.62)); ctx.fillRect(X(xr) - pw / 2, Y(2.62), pw, Y(0) - Y(2.62));
        ctx.fillStyle = rgba([10, 20, 40], 0.45 * a); ctx.fillRect(X(xl), Y(o.y1), X(xr) - X(xl), Y(o.y0) - Y(o.y1));
        ctx.beginPath();
        for (let x = xl; x <= xr + 0.01; x += 0.36) { ctx.moveTo(X(x), Y(o.y1)); ctx.lineTo(X(x), Y(o.y0)); }
        for (let y = o.y0 + 0.22; y < o.y1; y += 0.22) { ctx.moveTo(X(xl), Y(y)); ctx.lineTo(X(xr), Y(y)); }
        ctx.lineWidth = clamp(0.012 * k, 0.5, 3); ctx.strokeStyle = rgba(WHT, 0.24 * a); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(WHT, 0.25 * a); ctx.fillRect(X(xl), Y(o.y1 + 0.06), X(xr) - X(xl), Y(o.y1 - 0.13) - Y(o.y1 + 0.06));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(WHT, 0.92 * a); ctx.fillRect(X(xl), Y(o.y1), X(xr) - X(xl), Math.max(1, 0.07 * k));
        ctx.fillStyle = rgba(WHT, 0.55 * a); ctx.fillRect(X(xl), Y(o.y0 + 0.04), X(xr) - X(xl), Math.max(1, 0.04 * k));
        obsLabel(o.hint, X(0), o.hint.indexOf('DRUNTER') >= 0 ? Y(o.y0) + 0.42 * k : Y(o.y1) - 0.2 * k, k, a, o.hint.indexOf('DRUNTER') >= 0);
      } else if (o.type === 'ladder') {                  // Stehleiter (A-Form)
        const x = o.x, kb = f / (rel + 1.0);
        const XB = (xx) => (xx + bendZ(rel + 1.0) - cx) * kb, YB = (y) => (cy - y) * kb;
        ctx.beginPath();
        ctx.moveTo(XB(x - 0.5), YB(0)); ctx.lineTo(X(x - 0.26), Y(3.05));
        ctx.moveTo(XB(x + 0.5), YB(0)); ctx.lineTo(X(x + 0.26), Y(3.05));
        ctx.lineWidth = clamp(0.05 * k, 1, 12); ctx.strokeStyle = rgba([110, 124, 146], 0.8 * a); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(X(x - 0.5), Y(0)); ctx.lineTo(X(x - 0.26), Y(3.05)); ctx.lineTo(X(x + 0.26), Y(3.05)); ctx.lineTo(X(x + 0.5), Y(0));
        ctx.lineWidth = clamp(0.3 * k, 3, 60); ctx.strokeStyle = rgba(RED, 0.12 * a); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(X(x - 0.5), Y(0)); ctx.lineTo(X(x - 0.26), Y(3.05)); ctx.moveTo(X(x + 0.5), Y(0)); ctx.lineTo(X(x + 0.26), Y(3.05));
        for (let y = 0.32; y < 3.0; y += 0.32) { const hw = 0.5 - (0.24 * y) / 3.05; ctx.moveTo(X(x - hw), Y(y)); ctx.lineTo(X(x + hw), Y(y)); }
        ctx.lineWidth = clamp(0.06 * k, 1, 14); ctx.strokeStyle = rgba(ALU, 0.95 * a); ctx.stroke();
        ctx.fillStyle = rgba(AMB, 0.95 * a); ctx.fillRect(X(x - 0.32), Y(3.12), X(x + 0.32) - X(x - 0.32), Math.max(1.5, 0.1 * k));
        obsLabel('LEITER', X(x), Y(3.12) - 0.22 * k, k, a, false);
      } else {                                           // Basketballkorb an der Deckenhalterung
        const x = o.x;
        ctx.fillStyle = rgba([40, 50, 66], 0.9 * a);
        ctx.fillRect(X(x) - Math.max(1.5, 0.06 * k), Y(HH), Math.max(3, 0.12 * k), Y(3.75) - Y(HH));
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = clamp(0.28 * k, 3, 60); ctx.strokeStyle = rgba(RED, 0.13 * a);
        ctx.strokeRect(X(x - 0.9), Y(3.75), X(x + 0.9) - X(x - 0.9), Y(2.9) - Y(3.75));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba([210, 225, 245], 0.2 * a); ctx.fillRect(X(x - 0.9), Y(3.75), X(x + 0.9) - X(x - 0.9), Y(2.9) - Y(3.75));
        ctx.lineWidth = clamp(0.04 * k, 1, 10); ctx.strokeStyle = rgba(WHT, 0.9 * a);
        ctx.strokeRect(X(x - 0.9), Y(3.75), X(x + 0.9) - X(x - 0.9), Y(2.9) - Y(3.75));
        ctx.strokeStyle = rgba([255, 120, 40], 0.9 * a);
        ctx.strokeRect(X(x - 0.3), Y(3.4), X(x + 0.3) - X(x - 0.3), Y(2.98) - Y(3.4));
        const zf = Math.max(ZN + 0.05, rel - 0.62), zb = Math.max(ZN + 0.05, rel - 0.05), ym = 2.95;   // Ring ragt nach vorne
        const kf = f / zf, kbk = f / zb, rx = 0.3 * (kf + kbk) / 2, cxs = ((x + bendZ((zf + zb) / 2) - cx) * (kf + kbk)) / 2;
        const yf = (cy - ym) * kf, yb = (cy - ym) * kbk, ry = Math.max(1, Math.abs(yf - yb) / 2);
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) { ctx.moveTo(cxs + i * rx * 0.45, (yf + yb) / 2 + ry * 0.7); ctx.lineTo(cxs + i * rx * 0.25, (cy - 2.6) * (kf + kbk) / 2); }
        ctx.lineWidth = clamp(0.012 * k, 0.6, 3); ctx.strokeStyle = rgba(WHT, 0.5 * a); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cxs, (yf + yb) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.lineWidth = clamp(0.045 * k, 1.2, 12); ctx.strokeStyle = rgba([255, 120, 40], 0.95 * a); ctx.stroke();
        obsLabel('KORB', X(x), Y(3.75) - 0.2 * k, k, a, false);
      }
      ctx.lineCap = 'butt';
    }
    function obsLabel(t, x, y, k, a, below) {
      if (k < 13 || k > 300) return;
      const fs = Math.min(48, Math.round(0.3 * k));
      ctx.font = '700 ' + fs + 'px "Chakra Petch", ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = below ? 'top' : 'alphabetic';
      ctx.fillStyle = rgba(RED, 0.9 * a * clamp((190 - k) / 80, 0, 1));
      ctx.fillText(t, x, y);
    }

    function drawSpeed() {
      const sf = clamp((v - 2) / 14, 0, 1); if (sf < 0.02) return;
      const len = 0.4 + v * 0.09, R = Math.hypot(W, H) * 0.55;
      ctx.beginPath();
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; if (p.z < ZN + 0.1) continue;
        const z2 = p.z + len;
        ctx.moveTo(PX(p.x, p.z), PY(p.y, p.z)); ctx.lineTo(PX(p.x, z2), PY(p.y, z2));
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(234,244,255,0)'); g.addColorStop(0.2, rgba(WHT, 0.1 * sf)); g.addColorStop(1, rgba(WHT, 0.55 * sf));
      ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.stroke(); ctx.lineCap = 'butt';
    }

    function drawAim() {
      const m = Math.min(W, H);
      // künstlicher Horizont (kippt mit der Welt)
      const a1 = m * 0.17, a2 = a1 + m * 0.07;
      ctx.beginPath(); ctx.moveTo(-a2, 0); ctx.lineTo(-a1, 0); ctx.moveTo(a1, 0); ctx.lineTo(a2, 0);
      ctx.moveTo(-a2, 0); ctx.lineTo(-a2, 6); ctx.moveTo(a2, 0); ctx.lineTo(a2, 6);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
      if (state === 'pause' || (state === 'idle')) return;
      // Ziel-Raute: so weit kommt der Whoop bis zum nächsten Gate (inklusive Fliehkraft)
      const ng = nextGate();
      const zm = clamp(ng ? ng.zw - dist : 12, 3, 30);
      const drift = -kNow * v * v * CF / (demoLike() ? 9 : 17);
      const mx = clamp((tx + drift + bendZ(zm) - cx) * f / zm, -W, W), my = clamp((cy - ty) * f / zm, -H, H);
      const s = clamp(m * 0.016, 6, 11);
      const live = isLive();
      if (Math.hypot(mx, my) > s * 2.2) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mx, my);
        ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = live ? 'rgba(63,224,255,.45)' : 'rgba(63,224,255,.25)'; ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.beginPath(); ctx.moveTo(mx, my - s); ctx.lineTo(mx + s, my); ctx.lineTo(mx, my + s); ctx.lineTo(mx - s, my); ctx.closePath();
      ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = live ? '#3fe0ff' : 'rgba(63,224,255,.6)'; ctx.stroke();
      if (live) { ctx.fillStyle = 'rgba(63,224,255,.22)'; ctx.fill(); }
    }

    function drawScreen() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Treffer-Blitz in Gate-Farbe
      if (flashT > 0) {
        const a = flashT * flashA;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = Math.min(W, H) * 0.07; ctx.strokeStyle = rgba(flashC, 0.45 * a); ctx.strokeRect(0, 0, W, H);
        ctx.fillStyle = rgba(flashC, 0.05 * a); ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (missT > 0) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
        g.addColorStop(0, 'rgba(255,75,92,0)'); g.addColorStop(1, rgba(RED, 0.45 * Math.min(1, missT)));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      // Bildrauschen wie bei analogem Videoverlust
      const st = Math.max(crashT > 0 ? Math.min(1, crashT / 0.3) : 0, glitchT > 0 ? glitchT / 0.35 : 0);
      if (st > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.88, 0.35 + st * 0.55) * (rm ? 0.75 : 1);
        ctx.fillStyle = pats[rm ? 0 : (Math.random() * 3) | 0];
        if (!rm) ctx.translate(-((Math.random() * 160) | 0), -((Math.random() * 160) | 0));
        ctx.fillRect(0, 0, W + 160, H + 160);
        ctx.restore();
        if (!rm) {
          const by = ((clock * 1.3) % 1) * (H + 140) - 70;
          ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, by, W, 52);
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, Math.random() * H, W, 2 + Math.random() * 3);
        }
      }
      const c0 = W / 2, c1 = H / 2;
      // Kurvenwarnung: Pfeile am Bildrand in Kurvenrichtung
      if (Math.abs(kAhead) > 0.0042 && state !== 'pause' && state !== 'idle') {
        const dir = kAhead > 0 ? 1 : -1, sz = clamp(Math.min(W, H) * 0.032, 9, 22), bx = c0 + dir * Math.min(W * 0.38, W / 2 - sz * 4.2);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let j = 0; j < 3; j++) {
          const al = rm ? 0.85 : 0.35 + 0.65 * Math.max(0, Math.sin(clock * 7 - j * 0.9));
          const px = bx + dir * j * sz * 0.95;
          ctx.beginPath(); ctx.moveTo(px - dir * sz * 0.4, c1 - sz * 0.75); ctx.lineTo(px + dir * sz * 0.4, c1); ctx.lineTo(px - dir * sz * 0.4, c1 + sz * 0.75);
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,' + (0.6 * al).toFixed(3) + ')'; ctx.stroke();
          ctx.lineWidth = 3; ctx.strokeStyle = rgba(AMB, al); ctx.stroke();
        }
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      }
      // Fadenkreuz (OSD, bleibt gerade)
      ctx.beginPath();
      ctx.moveTo(c0 - 20, c1); ctx.lineTo(c0 - 8, c1); ctx.moveTo(c0 + 8, c1); ctx.lineTo(c0 + 20, c1);
      ctx.moveTo(c0, c1 + 8); ctx.lineTo(c0, c1 + 14);
      ctx.moveTo(c0 + 3, c1); ctx.arc(c0, c1, 3, 0, Math.PI * 2);
      ctx.lineCap = 'round';
      ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.lineCap = 'butt';
      // Punkte-Einblendungen
      if (pops.length) {
        const fs = clamp(W * 0.034, 20, 42);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        for (let i = 0; i < pops.length; i++) {
          const p = pops[i], t = p.t / 1.1;
          const a = t < 0.12 ? t / 0.12 : 1 - Math.max(0, (t - 0.55) / 0.45);
          const y = H * 0.3 - t * H * 0.07;
          ctx.font = '700 ' + Math.round(fs * (t < 0.12 ? 1.25 - t * 2 : 1)) + 'px "Chakra Petch", ui-monospace, monospace';
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,' + (0.7 * a).toFixed(3) + ')'; ctx.strokeText(p.txt, c0, y);
          ctx.fillStyle = rgba(p.col, a); ctx.fillText(p.txt, c0, y);
          if (p.sub) {
            ctx.font = '600 ' + Math.round(fs * 0.48) + 'px "Chakra Petch", ui-monospace, monospace';
            ctx.lineWidth = 4; ctx.strokeText(p.sub, c0, y + fs * 0.85);
            ctx.fillStyle = rgba(HOT, a); ctx.fillText(p.sub, c0, y + fs * 0.85);
          }
        }
        ctx.lineJoin = 'miter';
      }
    }

    /* ---------- OSD in HTML (nur bei Änderung neu schreiben) ---------- */
    const hc = {};
    const put = (key, val) => { if (hc[key] !== val) { hc[key] = val; H_[key].textContent = val; } };
    const cls = (el, key, val) => { if (hc[key] !== val) { hc[key] = val; el.className = val; } };
    function hud() {
      const demo = demoLike();
      const vv = demo ? 4.2 - 0.12 * ((clock / 150) % 1) : state === 'count' && flightT === 0 ? 4.2 : volt;
      put('volt', vv.toFixed(2) + 'V');
      const pct = clamp((vv - 3.5) / 0.7, 0, 1), pw = Math.max(1, Math.round(pct * 10)) * 10 + '%';
      if (hc.pw !== pw) { hc.pw = pw; H_.cell.style.width = pw; }
      cls(H_.cell, 'cell', pct < 0.18 ? 'low' : '');
      put('time', mmss(demo ? clock : flightT));
      put('speed', String(Math.round(v * 3.6)));
      const mode_ = demo ? (state === 'idle' ? 'DISARMED' : 'AUTOPILOT') : state === 'count' ? 'ARMING' : state === 'play' ? 'ARMED' : 'DISARMED';
      put('mode', mode_); cls(H_.mode, 'modec', 'fcsg-mode ' + (mode_ === 'AUTOPILOT' ? 'auto' : mode_ === 'ARMED' ? 'armed' : ''));
      put('lvl', 'LVL ' + curLvl);
      put('score', num(score)); put('combo', String(combo));
      const mult = curMult();
      put('mult', combo > 0 && mult > 1 ? '×' + mult : '');
      if (hc.lives !== lives) { hc.lives = lives; for (let i = 0; i < 3; i++) lifeEls[i].className = i < lives ? '' : 'off'; }
      let w = '', wc = '';
      if (state === 'end') { w = endReason === 'bat' ? 'LAND NOW' : endReason === 'quit' ? 'DISARMED' : 'SIGNAL LOST'; wc = 'red'; }
      else if (state === 'play' && crashT > 0) { w = 'RXLOSS'; wc = 'red'; }
      else if (state === 'play' && missT > 0) { w = 'GATE VERPASST'; wc = 'amber'; }
      else if ((state === 'play' || state === 'pause') && volt < LOW_V) { w = 'LOW BAT'; wc = 'amber'; }
      put('warn', w); cls(H_.warn, 'warn', 'fcsg-warn ' + wc + (w ? ' on' : ''));
    }
    function showBest() { H_.best.textContent = best > 0 ? num(best) + ' Punkte' : 'noch keiner'; }
    function say(t) { H_.live.textContent = t; }
    function tog(c, on) { host.classList.toggle(c, on); if (full) full.wrap.classList.toggle(c, on); }
    function setUI() {
      host.setAttribute('data-state', state);
      const live = isLive();
      tog('is-live', live);
      tog('is-demo', state === 'demo');
      tog('is-hud', state === 'count' || state === 'play' || state === 'end' || state === 'pause');
      tog('is-ctl', state === 'count' || state === 'play');
      P_.start.hidden = !(state === 'demo' || state === 'idle');
      P_.pause.hidden = state !== 'pause';
      P_.over.hidden = state !== 'over';
      A_.inv.setAttribute('aria-pressed', tilt.inv ? 'true' : 'false');
      H_.hint.textContent = mob ? 'Tippen zum Mitfliegen' : 'Klicken zum Mitfliegen';
      if (!live) document.body.classList.remove('fcsg-noreticle');
    }

    /* ---------- Bestenliste im Abschnitt ---------- */
    const boardSel = host.getAttribute('data-board');
    let boardEl = null; try { boardEl = boardSel ? document.querySelector(boardSel) : null; } catch (e) { boardEl = null; }
    const B_ = {};
    let boardSeen = false, boardLoading = false, lastList = null;
    if (boardEl) {
      boardEl.classList.add('fcsb');
      boardEl.innerHTML = BOARD_TPL;
      boardEl.querySelectorAll('[data-b]').forEach((el) => { B_[el.dataset.b] = el; });
      B_.load.addEventListener('click', () => loadBoard(true));
    }
    function fmtDate(at) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(at || ''); return m ? m[3] + '.' + m[2] + '.' + m[1].slice(2) : ''; }
    function rowEl(e, rank, isMe) {
      const li = document.createElement('li');
      li.className = 'fcsb-row' + (isMe ? ' is-me' : '') + (rank <= 3 ? ' is-p' + rank : '');
      li.style.setProperty('--i', String(Math.min(rank - 1, 12)));
      const rk = document.createElement('span'); rk.className = 'fcsb-rk'; rk.textContent = pad(rank);
      const who = document.createElement('span'); who.className = 'fcsb-who';
      const n = document.createElement('b'); n.className = 'fcsb-n'; n.textContent = e.n;
      if (isMe) { const du = document.createElement('em'); du.className = 'fcsb-du'; du.textContent = 'Du'; n.appendChild(du); }
      const meta = document.createElement('span'); meta.className = 'fcsb-meta';
      const dv = document.createElement('span'); dv.className = 'fcsb-dev'; dv.setAttribute('role', 'img');
      dv.setAttribute('aria-label', e.d === 'm' ? 'Handy' : 'PC'); dv.innerHTML = e.d === 'm' ? ICON_PHONE : ICON_PC;
      meta.appendChild(dv); meta.appendChild(document.createTextNode(fmtDate(e.at) + (e.g ? ' · ' + e.g + ' Gates' : '')));
      who.appendChild(n); who.appendChild(meta);
      const s = document.createElement('b'); s.className = 'fcsb-s'; s.dataset.v = String(e.s); s.textContent = num(e.s);
      li.appendChild(rk); li.appendChild(who); li.appendChild(s);
      return li;
    }
    function renderBoard(list, pulseMe) {
      if (!boardEl) return;
      lastList = list;
      const me = Scores.me(), myRank = me ? rankOf(list, me.n) : null;
      B_.list.textContent = '';
      if (!list.length) {
        const li = document.createElement('li'); li.className = 'fcsb-empty';
        li.textContent = Scores.source === 'online' ? 'Noch keine Einträge. Flieg die erste Runde und setz dich an die Spitze.' : 'Hier stehen deine Runden, sobald du deinen Namen speicherst.';
        B_.list.appendChild(li);
      } else {
        list.slice(0, 10).forEach((e, i) => B_.list.appendChild(rowEl(e, i + 1, myRank === i + 1)));
      }
      B_.me.textContent = '';
      if (myRank && myRank > 10) {
        B_.me.appendChild(document.createTextNode('Dein Platz: '));
        const ol = document.createElement('ol'); ol.className = 'fcsb-list fcsb-list-me';
        ol.appendChild(rowEl(list[myRank - 1], myRank, true)); B_.me.appendChild(ol);
        B_.me.hidden = false;
      } else B_.me.hidden = true;
      const src = Scores.source;
      B_.src.textContent = src === 'online' ? 'Online · alle Geräte' : src === 'offline' ? 'Gerade offline · Einträge dieses Geräts' : 'Auf diesem Gerät';
      B_.src.className = 'fcsb-src is-' + src;
      const canLoad = Scores.online && src !== 'online';
      B_.load.hidden = !canLoad; B_.load.disabled = boardLoading;
      B_.load.textContent = boardLoading ? 'Lädt …' : src === 'offline' ? 'Nochmal laden' : 'Bestenliste laden';
      B_.fine.textContent = !Scores.online ? 'Gespeichert wird nur in diesem Browser.' : src === 'online' ? 'Gleiche Namen stehen nur mit ihrem besten Wert in der Liste.' : src === 'offline' ? 'Die Online-Liste ist gerade nicht erreichbar.' : 'Die Online-Liste lädt erst, wenn du spielst oder hier tippst.';
      if (boardSeen) countUp(pulseMe);
    }
    function countUp(pulseMe) {
      if (!boardEl) return;
      boardEl.classList.remove('is-in'); void boardEl.offsetWidth; boardEl.classList.add('is-in');
      if (pulseMe) { const r = boardEl.querySelector('.is-me'); if (r) r.classList.add('is-new'); }
      if (rm) return;
      const els = Array.from(boardEl.querySelectorAll('.fcsb-s')), t0 = performance.now(), D = 900;
      const step = (now) => {
        let done = true;
        els.forEach((el, i) => {
          const p = clamp((now - t0 - i * 55) / D, 0, 1); if (p < 1) done = false;
          el.textContent = num(+el.dataset.v * (1 - Math.pow(1 - p, 3)));
        });
        if (!done) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    function loadBoard(byClick) {
      if (!boardEl && !byClick) { if (Scores.online && !Scores.loaded) Scores.top().catch(() => {}); return; }
      if (boardLoading) return;
      if (Scores.loaded && !byClick) { renderBoard(Scores.cached()); return; }
      boardLoading = true; if (B_.load) { B_.load.disabled = true; B_.load.textContent = 'Lädt …'; }
      Scores.top().then((list) => { boardLoading = false; renderBoard(list); }, () => { boardLoading = false; renderBoard(Scores.cached()); });
    }
    if (boardEl) {
      renderBoard(Scores.cached());
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); boardSeen = true; countUp(false); } }, { threshold: 0.3 });
        io.observe(boardEl);
      } else boardSeen = true;
    }

    /* ---------- Namen eintragen ---------- */
    H_.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (submitted || !runData) return;
      const n = cleanName(H_.name.value);
      H_.name.value = n;
      if (Array.from(n).length < 2) { H_.fmsg.textContent = 'Bitte gib mindestens zwei Zeichen ein.'; H_.fmsg.className = 'fcsg-fmsg err'; H_.name.focus(); return; }
      if (badName(n)) { H_.fmsg.textContent = 'Bitte wähl einen anderen Namen.'; H_.fmsg.className = 'fcsg-fmsg err'; H_.name.focus(); return; }
      submitted = true; H_.send.disabled = true; H_.send.textContent = 'Speichert …';
      H_.fmsg.textContent = ''; H_.fmsg.className = 'fcsg-fmsg';
      Scores.add({ name: n, score: runData.score, gates: runData.gates, combo: runData.combo, time: runData.time, device: runData.device }).then((r) => {
        let t;
        const mine = r.rank ? r.list[r.rank - 1] : null;
        const better = mine && mine.s > runData.score;
        if (r.rejected) t = 'Der Eintrag wurde nicht angenommen. Probier es nach der nächsten Runde nochmal.';
        else if (r.queued) t = 'Gerade keine Verbindung. Dein Ergebnis ist auf diesem Gerät gespeichert und wird beim nächsten Laden der Bestenliste gesendet.';
        else if (better) t = 'Gespeichert. Dein bester Wert als „' + n + '“ steht auf Platz ' + r.rank + '.';
        else t = r.rank ? 'Platz ' + r.rank + ' von ' + r.list.length + (r.online ? ' in der Bestenliste.' : ' auf diesem Gerät.') : 'Gespeichert.';
        H_.form.hidden = true; H_.placed.hidden = false; H_.placed.textContent = t;
        if (boardEl && !r.rejected) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'fcsg-tolist'; b.textContent = 'Zur Bestenliste';
          b.addEventListener('click', () => { if (window.FCS && window.FCS.scrollTo) window.FCS.scrollTo(boardEl, -120); else boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
          const br = boardEl.getBoundingClientRect();
          if (br.top < 0 || br.bottom > innerHeight) { H_.placed.appendChild(document.createTextNode(' ')); H_.placed.appendChild(b); }
        }
        A_.again.className = 'btn solid';
        renderBoard(r.list, !r.rejected);
        say(t);
      }, (err) => {
        submitted = false; H_.send.disabled = false; H_.send.textContent = 'Speichern';
        H_.fmsg.textContent = (err && err.message) || 'Das hat nicht geklappt.'; H_.fmsg.className = 'fcsg-fmsg err';
      });
    });

    /* ---------- Ton (WebAudio, standardmäßig aus, ohne Audiodateien) ---------- */
    const au = { on: false, ac: null };
    function buildAudio(ac) {
      const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 3; lp.connect(master);
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), o3 = ac.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
      const mix = ac.createGain(); mix.gain.value = 0.35; o1.connect(mix); o2.connect(mix); mix.connect(lp);
      const m3 = ac.createGain(); m3.gain.value = 0.07; o3.connect(m3); m3.connect(lp);
      const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.7;
      const ng = ac.createGain(); ng.gain.value = 0.16; ns.connect(bp); bp.connect(ng); ng.connect(master);
      const fx = ac.createGain(); fx.gain.value = 0; fx.connect(ac.destination);
      o1.start(); o2.start(); o3.start(); ns.start();
      Object.assign(au, { ac, master, lp, o1, o2, o3, fx, nb });
    }
    function toggleSound() {
      if (!au.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { A_.snd.lastChild.textContent = 'Kein Ton möglich'; A_.snd.disabled = true; A_.snd2.disabled = true; return; }
        try { buildAudio(new AC()); } catch (e) { return; }
      }
      au.on = !au.on;
      A_.snd.lastChild.textContent = au.on ? 'Ton aus' : 'Ton an';
      A_.snd2.setAttribute('aria-label', au.on ? 'Ton aus' : 'Ton an');
      A_.snd.classList.toggle('on', au.on); A_.snd2.classList.toggle('on', au.on);
      if (au.on && au.ac.state !== 'running') au.ac.resume().catch(() => {});
      sndTick();
    }
    function sndTick() {
      if (!au.ac) return;
      const t = au.ac.currentTime;
      const audible = au.on && running && state !== 'pause' && state !== 'idle';
      const thr = clamp(v / 16, 0, 1), man = Math.min(1, Math.hypot(vx, vy) / 8);
      const base = 210 + v * 26 + man * 90;
      au.o1.frequency.setTargetAtTime(base, t, 0.06);
      au.o2.frequency.setTargetAtTime(base * 1.014, t, 0.06);
      au.o3.frequency.setTargetAtTime(base * 2.01, t, 0.06);
      au.lp.frequency.setTargetAtTime(900 + thr * 2600 + man * 800, t, 0.08);
      const vol = audible ? (0.022 + thr * 0.03 + man * 0.012) * (crashT > 0 ? 0.15 : 1) * (demoLike() ? 0.55 : 1) : 0;
      au.master.gain.setTargetAtTime(vol, t, 0.05);
      au.fx.gain.setTargetAtTime(au.on ? 0.5 : 0, t, 0.02);
    }
    function beep(freq, dur, type, vol, to, delay) {
      if (!au.on || !au.ac) return;
      const ac = au.ac, t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(au.fx); o.start(t); o.stop(t + dur + 0.03);
    }
    function sfxGate(big) { beep(1250, 0.09, 'sine', 0.22, 1900); if (big) beep(1900, 0.12, 'sine', 0.18, 2600, 0.07); }
    function sfxMiss() { beep(330, 0.28, 'square', 0.1, 170); }
    function sfxCrash() {
      if (!au.on || !au.ac) return;
      const ac = au.ac, t = ac.currentTime;
      const s = ac.createBufferSource(); s.buffer = au.nb;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
      const g = ac.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      s.connect(lp); lp.connect(g); g.connect(au.fx); s.start(t); s.stop(t + 0.75);
    }

    /* ---------- Schleife, Größe, Sichtbarkeit ---------- */
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      update(dt);
      if (running) { render(); hud(); sndTick(); perf(dt); raf = requestAnimationFrame(frame); }
    }
    function startLoop() {
      if (running || !visible || document.hidden) return;
      if (!W) resize();
      running = true; last = performance.now(); raf = requestAnimationFrame(frame);
      if (au.on && au.ac && au.ac.state !== 'running') au.ac.resume().catch(() => {});
    }
    function stopLoop() {
      running = false; cancelAnimationFrame(raf); sndTick();
      if (au.ac) setTimeout(() => { if (!running && au.ac.state === 'running') au.ac.suspend().catch(() => {}); }, 250);
    }
    const needsLoop = () => (rm ? isLive() : state !== 'pause' && state !== 'idle');
    function renderStill() { if (!W) resize(); if (W) { ensureTrack(dist + ZF + 30); render(); hud(); } }
    function onVis() {
      const on = visible && !document.hidden;
      if (!on) {
        if (state === 'play' || state === 'count') pause();
        else if (state === 'end') showOver();
        stopLoop();
      } else if (needsLoop()) startLoop();
      else renderStill();
    }
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      W = w; H = h; dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      f = Math.max(0.5 * Math.min(W, H) / Math.tan(41 * Math.PI / 180), W * 0.3, H * 0.34);   // weites FPV-Sichtfeld, im Hochformat nicht zu weit
    }
    function perf(dt) {   // Mittelklasse-Handy: bei Ruckeln Auflösung senken
      if (dpr <= 1) return;
      pfSum += dt; if (++pfN < 120) return;
      const avg = pfSum / pfN; pfSum = 0; pfN = 0;
      if (avg > 0.026) { dprCap = Math.max(1, dpr - 0.5); resize(); }
    }

    /* ---------- Ereignisse ---------- */
    stage.addEventListener('click', (e) => {
      if (e.target.closest('button,a,input,form')) return;
      if (state === 'demo' || state === 'idle') startWith(mob ? (canTilt ? 'tilt' : 'touch') : 'mouse');
      else if (state === 'pause') arm(true);
    });
    A_.go.addEventListener('click', () => startWith('mouse'));
    A_.tilt.addEventListener('click', () => startWith('tilt'));
    A_.finger.addEventListener('click', () => startWith('touch'));
    A_.again.addEventListener('click', () => startWith(mode));
    A_.resume.addEventListener('click', () => arm(true));
    A_.quit.addEventListener('click', () => { if (state !== 'pause') return; state = 'play'; endGame('quit'); showOver(); if (!rm) startLoop(); });
    A_.pz.addEventListener('click', () => pause());
    A_.recal.addEventListener('click', recal);
    A_.swap.addEventListener('click', () => { setMode(mode === 'tilt' ? 'touch' : 'tilt'); if (mode === 'tilt') { const DOE = window.DeviceOrientationEvent; if (DOE && typeof DOE.requestPermission === 'function') DOE.requestPermission().catch(() => {}); tilt.have = false; tilt.t0 = clock; } });
    A_.inv.addEventListener('click', () => { tilt.inv = !tilt.inv; lsSet(INV_KEY, tilt.inv); setUI(); });
    A_.snd.addEventListener('click', toggleSound);
    A_.snd2.addEventListener('click', toggleSound);
    const mine = (e) => host.contains(e.target) || stage.contains(e.target) || e.target === document.body;
    document.addEventListener('keydown', (e) => {
      if (!mine(e) || (e.target === document.body && !isLive())) return;
      const k = KEYMAP[e.code], live = state === 'count' || state === 'play';
      if (e.target.closest && e.target.closest('input')) return;
      if (k && live) { keys[k] = 1; if (mode === 'tilt') setMode(mob ? 'touch' : 'mouse'); e.preventDefault(); return; }
      if ((e.code === 'KeyP' || e.code === 'Escape') && live) { pause(); e.preventDefault(); return; }
      if (e.code === 'KeyP' && state === 'pause') { arm(true); e.preventDefault(); return; }
      if (e.target === stage && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        if (state === 'demo' || state === 'idle') startWith(mob ? 'touch' : 'mouse'); else if (state === 'pause') arm(true);
      } else if (k && state === 'end') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = 0; });
    window.addEventListener('blur', () => { keys.l = keys.r = keys.u = keys.d = 0; });
    cv.addEventListener('pointerdown', (e) => {
      if (!isLive()) return;
      if (e.pointerType === 'mouse') { if (state !== 'end') aimAbs(e); return; }
      if (mode === 'tilt') return;
      touchId = e.pointerId; lastPX = e.clientX; lastPY = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!isLive() || state === 'end') return;
      if (e.pointerType === 'mouse') { aimAbs(e); document.body.classList.add('fcsg-noreticle'); return; }
      if (e.pointerId !== touchId) return;
      const k = 8 / f;                                  // Ziehen: Raute folgt dem Finger
      tx = clamp(tx + (e.clientX - lastPX) * k, -RX, RX); ty = clamp(ty - (e.clientY - lastPY) * k, YMIN, YMAX);
      lastPX = e.clientX; lastPY = e.clientY;
    });
    const up = (e) => { if (e.pointerId === touchId) touchId = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') document.body.classList.remove('fcsg-noreticle'); });
    cv.addEventListener('touchmove', (e) => { if (isLive()) e.preventDefault(); }, { passive: false });
    stage.addEventListener('wheel', (e) => { if (state === 'count' || state === 'play') e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('fullscreenchange', () => { if (full && !document.fullscreenElement && (state === 'play' || state === 'count')) pause(); });
    const onTurn = () => { if (mode === 'tilt' && (state === 'play' || state === 'count')) pause('Bildschirm gedreht. Halte das Handy bequem und flieg weiter: die Mitte wird beim Herunterzählen neu gesetzt.'); };
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onTurn);
    else window.addEventListener('orientationchange', onTurn);

    if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); if (!running && visible) renderStill(); }).observe(stage);
    else window.addEventListener('resize', () => { resize(); if (!running && visible) renderStill(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = full ? true : es[es.length - 1].isIntersecting; onVis(); }, { threshold: 0.15 }).observe(stage);
    } else { visible = true; onVis(); }

    setMode(mode);
    ensureTrack(ZF + 30);
    resetCourse(rm ? 9 : 14);
    showBest(); setUI();
    // Schrift fürs Canvas nachladen, dann das stehende Bild neu zeichnen
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 20px "Chakra Petch"'), document.fonts.load('600 20px "Chakra Petch"')])
        .then(() => { if (!running && visible) renderStill(); }).catch(() => {});
    }

    /* ---------- Schnittstelle (auch für Tests) ---------- */
    const api = {
      el: host,
      get state() { return state; },
      get mode() { return mode; },
      start: (m) => startWith(m || (mob ? 'touch' : 'mouse')),
      pause,
      resume: () => arm(true),
      recalibrate: recal,
      end(reason) {
        if (state === 'pause') { state = 'play'; setUI(); }
        if (state === 'play' || state === 'count') { endGame(reason === 'lives' ? 'lives' : 'bat'); startLoop(); }
      },
      finish(reason) { api.end(reason); if (state === 'end') showOver(); },
      setFlightTime(s) { flightT = clamp(+s || 0, 0, BAT_T); },
      assist(on) { assist = !!on; },   // nur für automatische Tests: lenkt wie der Autopilot
      warp(m) {                         // nur für Tests: als wäre man schon m Meter geflogen (Level 2 ab 220, Level 3 ab 560)
        if (state !== 'play') return;
        m = +m || 0; courseStart -= m; flightT = clamp(flightT + m / 12, 0, BAT_T - 1);
        resetTrackAhead(dist + 2); resetCourse(16);
      },
      stats: () => ({
        state, mode, score, passed, combo, bestCombo, lives, best, level: curLvl, near,
        flightT: +flightT.toFixed(2), volt: +volt.toFixed(2), kmh: Math.round(v * 3.6),
        pos: [+cx.toFixed(2), +cy.toFixed(2)], target: [+tx.toFixed(2), +ty.toFixed(2)],
        curve: +kNow.toFixed(4), curveAhead: +kAhead.toFixed(4), course: +(dist - courseStart).toFixed(1),
        gates: gates.length, obstacles: obs.map((o) => o.type), moving: gates.filter((g) => g.mv).length,
        tilt: { have: tilt.have, lr: +(tilt.s[0] - tilt.n0[0]).toFixed(1), fb: +(tilt.s[1] - tilt.n0[1]).toFixed(1), inv: tilt.inv },
        hits: hits.slice(-10), full: !!full, running, visible, dpr, size: [W, H]
      })
    };
    return api;
  }

  /* ---------- Einhängen ---------- */
  const seen = new WeakMap();
  const instances = [];
  function mount(el) {
    if (!el || seen.has(el)) return el ? seen.get(el) : null;
    const g = create(el); seen.set(el, g); instances.push(g); return g;
  }
  function mountAll() { document.querySelectorAll('[data-game="whoop"]').forEach(mount); return instances; }
  window.FCSGame = {
    version: '2.0.0',
    instances,
    mount,
    mountAll,
    end: (reason) => instances.forEach((g) => g.end(reason)),
    finish: (reason) => instances.forEach((g) => g.finish(reason))
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
})();
