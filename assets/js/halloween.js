/* Halloween 2026 auf flightclub-saar.de – grüner Schleim beim ersten Öffnen, kleine Kürbisse, Geister und Fledermäuse am Seitenrand,
   einmal ein freundlicher Geist beim zweiten Klick. Übernommen vom Falcon-Eye-Chat (falcon-eye-website- 52832b9, Natan 31.10.2026 13:38:
   „genauso wie auf der Falcon-Eye-Seite … als Special für heute Abend. Bis Montag.“), angepasst: Vereinsschriften, Spruch, wartet auf 3D-Intro und Eröffnungsfilm.
   Läuft von selbst nur vom 31.10.2026 bis Montag, 02.11.2026, 18:00 Uhr (Ortszeit); danach bleibt die Seite unverändert, die Dateien tun nichts mehr
   und kommen in der Woche danach aus build.py (HW_PAGES) raus. ?halloween=1 erzwingt, ?halloween=0 schaltet aus. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var q = new URLSearchParams(location.search).get('halloween');
  var now = new Date();
  var aktiv = now >= new Date(2026, 9, 31) && now < new Date(2026, 10, 2, 18);
  if (q === '0') aktiv = false; else if (q === '1') aktiv = true;
  if (!aktiv) return;
  var reduce = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
             set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  var PUMP = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 22c-3-8 2-14 8-15-4 4-4 9-3 14" fill="none" stroke="#3d7a1f" stroke-width="5" stroke-linecap="round"/><ellipse cx="50" cy="60" rx="44" ry="34" fill="url(#hw-pg)"/><path d="M50 26v68M30 30c-8 18-8 42 0 60M70 30c8 18 8 42 0 60M18 36c-6 14-6 34 0 48M82 36c6 14 6 34 0 48" stroke="#b84800" stroke-width="2.2" fill="none" opacity=".7"/><g class="hw-face" fill="url(#hw-gl)"><path d="M30 52l10-8 6 10zM70 52l-10-8-6 10zM32 72q18 14 36 0l-6 6-6-5-6 6-6-6-6 5z"/></g></svg>';
  var DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="hw-pg" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="#ffb14d"/><stop offset=".6" stop-color="#ff7a00"/><stop offset="1" stop-color="#c24d00"/></radialGradient><radialGradient id="hw-gl" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#ff9a1a"/></radialGradient><filter id="hw-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs></svg>';

  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- 1. Schleim-Intro ---------- */
  function intro(fertig) {
    if (reduce || ss.get('hw-intro') === '1') { fertig(); return; }
    ss.set('hw-intro', '1');
    if (!D.getElementById('hw-goo')) { var dd = el('div', 'hw-defs', DEFS); D.body.appendChild(dd); }
    var ov = el('div', 'hw-ov');
    ov.innerHTML = '<canvas class="hw-cv"></canvas><div class="hw-txt"><span class="hw-h">Happy Halloween</span><span class="hw-s">Fliegt vorsichtig, da draußen spukt’s.</span></div><button type="button" class="hw-skip">Überspringen</button>';
    D.body.appendChild(ov);
    H.classList.add('hw-lock');
    var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
    var w, h, dpr = 1;
    function size() { w = cv.width = Math.round(innerWidth * dpr); h = cv.height = Math.round(innerHeight * dpr); }
    size();
    var N = Math.max(7, Math.round(innerWidth / 90)), drops = [];
    for (var i = 0; i < N; i++) {
      drops.push({ x: (i + .5) / N + (Math.random() - .5) * .5 / N, r: (.55 + Math.random() * .6), sp: .55 + Math.random() * .7, d: Math.random() * .25, wob: Math.random() * 6.28, wob2: 1.5 + Math.random() * 2 });
    }
    var t0 = performance.now(), T1 = 1.15, T2 = 2.05, T3 = 2.75, ende = false, raf;
    var txt = ov.querySelector('.hw-txt');
    function frame(ts) {
      var t = (ts - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      var base = w / N * 0.62 * dpr / Math.max(1, dpr);
      // Fläche: Schleim deckt von oben bis zu einer Front, die mit der Zeit sinkt.
      var front = h * Math.min(1.25, Math.max(0, (t - .05) / T1)) * 1.1;
      var lift = t > T2 ? (t - T2) / (T3 - T2) : 0; lift = lift * lift * (3 - 2 * lift); // nach dem Text rutscht alles nach unten weg
      ctx.save();
      ctx.translate(0, lift * h * 1.35);
      var fg = ctx.createLinearGradient(0, 0, 0, Math.max(1, front));
      fg.addColorStop(0, '#2f9c0c'); fg.addColorStop(.55, '#58d41a'); fg.addColorStop(1, '#8dff3a');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.rect(0, -h * 2, w, Math.max(0, front - base * 1.2) + h * 2); ctx.fill();
      for (var i = 0; i < N; i++) {
        var p = drops[i];
        var y = front - base * .9 + Math.sin(t * p.wob2 + p.wob) * base * .18 + (p.sp - .9) * base * 1.6;
        var r = base * p.r;
        ctx.fillStyle = '#3aa810'; ctx.beginPath(); ctx.ellipse(p.x * w, y + r * .18, r * 1.02, r * 1.4, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(p.x * w, y, r, r * 1.35, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(p.x * w - r * .3, y - r * .45, r * .32, r * .5, -.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = fg;
        // Tropfen, der abreißt
        var ty = y + r * 1.3 + ((t * 1.2 + p.d) % 1) * base * 2.2;
        var tr = r * .28 * (1 - ((t * 1.2 + p.d) % 1) * .4);
        ctx.beginPath(); ctx.ellipse(p.x * w + Math.sin(p.wob) * r * .3, ty, tr, tr * 1.5, 0, 0, 6.283); ctx.fill();
      }
      ctx.restore();
      // Glanz oben
      var g = ctx.createLinearGradient(0, 0, 0, h * .35);
      g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
      if (t > T1 * .85 && !txt.classList.contains('an')) txt.classList.add('an');
      if (t > T2 + .25) txt.classList.add('weg');
      if (t < T3 + .1 && !ende) raf = requestAnimationFrame(frame); else schluss();
    }
    function schluss() {
      if (ende) return; ende = true; cancelAnimationFrame(raf);
      ov.classList.add('hw-aus'); H.classList.remove('hw-lock');
      setTimeout(function () { ov.remove(); }, 450);
      fertig();
    }
    ov.querySelector('.hw-skip').addEventListener('click', schluss);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target === cv) schluss(); });
    W.addEventListener('resize', size);
    raf = requestAnimationFrame(frame);
    setTimeout(schluss, 4500); // Notschalter
  }

  /* ---------- 2. Deko am Rand: Kürbisse, kleine Geister, Fledermäuse (nur Schmuck, nichts zum Anklicken) ---------- */
  var GEIST = '<svg viewBox="0 0 120 140" aria-hidden="true"><path d="M60 8C32 8 16 32 16 62v62c0 6 7 8 11 4l9-9 9 9c4 4 9 4 13 0l2-2 2 2c4 4 9 4 13 0l9-9 9 9c4 4 11 2 11-4V62C104 32 88 8 60 8z" fill="#f4f7ff" opacity=".92"/><ellipse cx="44" cy="58" rx="7" ry="10" fill="#1a1f2b"/><ellipse cx="76" cy="58" rx="7" ry="10" fill="#1a1f2b"/><path d="M48 84q12 12 24 0" stroke="#1a1f2b" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
  var FLED = '<svg viewBox="0 0 90 40" aria-hidden="true"><path d="M45 20c-4-9-12-14-22-12 4 3 5 7 3 11-8-4-18-2-26 6 8-2 14 0 18 5 5-3 10-2 14 2 2-5 6-8 13-8 7 0 11 3 13 8 4-4 9-5 14-2 4-5 10-7 18-5-8-8-18-10-26-6-2-4-1-8 3-11-10-2-18 3-22 12z" fill="#0a0d12"/></svg>';
  function deko() {
    var wrap = el('div', 'hw-wrap');
    if (!D.getElementById('hw-goo')) wrap.innerHTML = DEFS;
    D.body.appendChild(wrap);
    var seed = 11; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    // Reihenfolge von oben nach unten, abwechselnd links/rechts am Seitenrand
    var arten = ['k', 'g', 'k', 'f', 'k', 'g', 'k', 'f', 'k', 'g', 'k'];
    var items = arten.map(function (a, i) {
      var e = el('div', 'hw-d hw-d-' + a, a === 'k' ? PUMP : a === 'g' ? GEIST : FLED);
      e.style.setProperty('--d', (rnd() * 4).toFixed(2) + 's'); e.style.setProperty('--s', (0.7 + rnd() * 0.6).toFixed(2));
      e.dataset.fy = ((i + 0.3 + rnd() * 0.5) / arten.length).toFixed(3); e.dataset.side = i % 2 ? 'r' : 'l';
      wrap.appendChild(e); return e;
    });
    function lege() {
      var dh = Math.max(D.body.scrollHeight, H.scrollHeight), vw = innerWidth, klein = vw < 760;
      wrap.style.height = dh + 'px';
      items.forEach(function (e) {
        var y = 160 + +e.dataset.fy * (dh - 400), gr = 56 * +e.style.getPropertyValue('--s');
        var x = e.dataset.side === 'l' ? (klein ? 6 : 14 + rnd() * 0) : vw - gr - (klein ? 6 : 14);
        e.style.left = Math.round(x) + 'px'; e.style.top = Math.round(y) + 'px';
      });
    }
    lege(); W.addEventListener('resize', lege); setTimeout(lege, 1500); setTimeout(lege, 5000);
  }
  /* ---------- 3. Der Geist: kommt einmal beim zweiten Klick irgendwo auf der Seite ---------- */
  function geist() {
    if (ss.get('hw-geist') === '1') return;
    var klicks = 0;
    D.addEventListener('click', function (e) {
      if (e.target.closest('.hw-ov, .hw-geist')) return;
      if (++klicks < 2 || ss.get('hw-geist') === '1') return;
      ss.set('hw-geist', '1'); zeigeGeist();
    }, true);
  }
  function zeigeGeist() {
    if (D.querySelector('.hw-geist')) return;
    var links = Math.random() < .5;
    var g = el('div', 'hw-geist' + (links ? ' hw-von-links' : ''), '<svg viewBox="0 0 120 140" aria-hidden="true"><path class="hw-gk" d="M60 8C32 8 16 32 16 62v62c0 6 7 8 11 4l9-9 9 9c4 4 9 4 13 0l2-2 2 2c4 4 9 4 13 0l9-9 9 9c4 4 11 2 11-4V62C104 32 88 8 60 8z" fill="#f4f7ff"/><ellipse cx="44" cy="58" rx="7" ry="10" fill="#1a1f2b"/><ellipse cx="76" cy="58" rx="7" ry="10" fill="#1a1f2b"/><circle cx="46" cy="55" r="2.5" fill="#fff"/><circle cx="78" cy="55" r="2.5" fill="#fff"/><path d="M48 84q12 12 24 0" stroke="#1a1f2b" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="34" cy="76" rx="7" ry="4" fill="#ffb3c7" opacity=".8"/><ellipse cx="86" cy="76" rx="7" ry="4" fill="#ffb3c7" opacity=".8"/></svg><span class="hw-buh">Buh! 👻 Happy Halloween</span>');
    g.style.top = (18 + Math.random() * 40) + 'vh';
    D.body.appendChild(g);
    g.addEventListener('click', function () { g.classList.add('hw-g-weg'); });
    setTimeout(function () { g.remove(); }, 9000);
  }

  function start() {
    var los = function () { intro(deko); geist(); };
    // Erst das 3D-Intro (Startseite) und der Eröffnungsfilm, dann der Schleim. Spätestens nach 90 s.
    var t0 = Date.now();
    var frei = function () { var i = D.getElementById('intro'); return !H.classList.contains('film-on') && !H.classList.contains('film-open') && !(i && i.isConnected && !i.classList.contains('gone')); };
    if (frei()) { los(); return; }
    var poll = setInterval(function () { if (frei() || Date.now() - t0 > 90000) { clearInterval(poll); setTimeout(los, 400); } }, 500);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
