/* Flight Club Saar e. V. · Mini-Spiel „Whoop-Rennen“
   Ein Tiny Whoop fliegt durch leuchtende Gates in der Turnhalle, Blick wie durch die FPV-Brille.
   Einbinden: <div data-game="whoop"></div> plus assets/css/game.css und assets/js/game.js.
   Klassisches Skript, Canvas 2D (Pseudo-3D), keine Bibliotheken nötig.
   Einzige globale Variable: window.FCSGame (mount, instances, Testhilfe end/finish). */
(function () {
  'use strict';
  if (window.FCSGame) return;

  /* ---------- Welt und Regeln ---------- */
  const HW = 11, HH = 7.5, ZN = 0.3, ZF = 72;            // Halle: halbe Breite, Deckenhöhe, Sichtweite (m)
  const RX = 5.2, YMIN = 0.9, YMAX = 4.6, YC = 2.75;  // Flugbereich des Whoops
  const BAT_T = 90;                                    // Sekunden bis 3.50 V = LAND NOW
  const LOW_V = 3.62;
  const FOG = '#050b17';
  const SIG = [63, 224, 255], AMB = [255, 176, 32], RED = [255, 75, 92], WHT = [234, 244, 255];
  const BLU = [90, 162, 255], WOOD = [196, 150, 98], HOT = [255, 255, 255];
  const BEST_KEY = 'fcs-whoop-best';
  const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  const fogA = (z) => (z >= ZF ? 0 : Math.pow(1 - z / ZF, 1.5));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const mmss = (s) => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 60) % 100) + ':' + pad(s % 60); };
  const num = (n) => Math.round(n).toLocaleString('de-DE');
  // LiPo-Kurve: schneller Abfall am Anfang, Plateau, Abfall am Ende. voltAt(1) = 3.50 V
  const voltAt = (p) => 4.2 - 0.22 * (1 - Math.exp(-6 * p)) - 0.48 * Math.pow(p, 2.2);
  const loadBest = () => { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } };
  const saveBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* privat oder gesperrt */ } };

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

  const ICON_SND = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

  const TPL = `
<div class="fcsg-stage" role="group" aria-label="Mini-Spiel Whoop-Rennen" tabindex="-1">
  <canvas class="fcsg-cv" role="img" aria-label="Whoop-Rennen: Blick durch die FPV-Brille eines Tiny Whoops, der in einer Turnhalle durch leuchtende Gates fliegt."></canvas>
  <div class="fcsg-fx" aria-hidden="true"></div>
  <div class="fcsg-hud" aria-hidden="true">
    <div class="fcsg-frame"><i></i></div>
    <div class="fcsg-o fcsg-tl">
      <div class="fcsg-bat"><span class="fcsg-cell"><i data-h="cell"></i></span><span data-h="volt">4.20V</span></div>
      <div class="fcsg-lives fcsg-play"><small>LEBEN</small><span class="fcsg-pips" data-h="lives"><i></i><i></i><i></i></span></div>
    </div>
    <div class="fcsg-o fcsg-tc"><span data-h="mode">AUTOPILOT</span></div>
    <div class="fcsg-o fcsg-tr">
      <div><small>FLUGZEIT</small> <span data-h="time">00:00</span></div>
      <div><span data-h="speed">0</span> <small>KM/H</small></div>
    </div>
    <div class="fcsg-o fcsg-bl fcsg-play"><small>PUNKTE</small><b data-h="score">0</b></div>
    <div class="fcsg-o fcsg-br fcsg-play"><small>KOMBO</small><span><b data-h="combo">0</b><em data-h="mult"></em></span></div>
    <div class="fcsg-msg" data-h="msg"></div>
    <div class="fcsg-warn" data-h="warn"></div>
  </div>
  <p class="fcsg-hint" aria-hidden="true"><span>Tippen oder klicken zum Mitfliegen</span></p>
  <div class="fcsg-ui fcsg-ui-start" data-p="start">
    <div class="fcsg-card">
      <p class="fcsg-kick">Mini-Spiel · Tiny Whoop</p>
      <h3 class="fcsg-title">Whoop-Rennen</h3>
      <p class="fcsg-txt">Brille auf: Flieg durch die leuchtenden Gates in der Halle, bevor der Akku leer ist.</p>
      <div class="fcsg-row">
        <button type="button" class="btn solid fcsg-go" data-a="go">Scharf schalten und fliegen</button>
        <span class="fcsg-best">Bestwert <b data-h="best">noch keiner</b></span>
      </div>
    </div>
  </div>
  <div class="fcsg-ui fcsg-ui-mid" data-p="pause" hidden>
    <div class="fcsg-card fcsg-card-c">
      <p class="fcsg-kick">DISARMED</p>
      <p class="fcsg-title">Pause</p>
      <p class="fcsg-txt">Dein Whoop schwebt und wartet. Akku und Punkte bleiben, wie sie sind.</p>
      <div class="fcsg-row fcsg-row-c"><button type="button" class="btn solid" data-a="resume">Weiterfliegen</button></div>
    </div>
  </div>
  <div class="fcsg-ui fcsg-ui-mid" data-p="over" hidden>
    <div class="fcsg-card fcsg-card-c">
      <p class="fcsg-kick" data-h="why">LAND NOW · Akku leer</p>
      <p class="fcsg-score"><b data-h="fscore">0</b><span>Punkte</span></p>
      <p class="fcsg-new" data-h="newbest" hidden>Neuer Bestwert!</p>
      <dl class="fcsg-stats">
        <div><dt>Gates</dt><dd data-h="fgates">0</dd></div>
        <div><dt>Beste Kombo</dt><dd data-h="fcombo">0</dd></div>
        <div><dt>Flugzeit</dt><dd data-h="ftime">00:00</dd></div>
      </dl>
      <div class="fcsg-row fcsg-row-c">
        <button type="button" class="btn solid" data-a="again">Nochmal</button>
        <a class="fcsg-link" data-h="link" href="hallenfliegen.html">Echt fliegen? Komm zum Hallenfliegen <span aria-hidden="true">→</span></a>
      </div>
      <p class="fcsg-best fcsg-best-c">Bestwert <b data-h="best2">noch keiner</b></p>
    </div>
  </div>
</div>
<div class="fcsg-bar">
  <p class="fcsg-keys">Steuerung: Maus bewegen, mit dem Finger ziehen oder Pfeiltasten und WASD. P pausiert.</p>
  <div class="fcsg-btns">
    <button type="button" class="fcsg-mini" data-a="pause" hidden>Pause</button>
    <button type="button" class="fcsg-mini fcsg-snd" data-a="snd">${ICON_SND}<span>Ton an</span></button>
  </div>
</div>
<p class="fcsg-sr" aria-live="polite" data-h="live"></p>`;

  /* ======================================================================== */
  function create(host) {
    const rm = (window.FCS && typeof window.FCS.rm === 'boolean') ? window.FCS.rm : matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.classList.add('fcsg');
    host.innerHTML = TPL;
    const H_ = {}, P_ = {}, A_ = {};
    host.querySelectorAll('[data-h]').forEach((el) => { H_[el.dataset.h] = el; });
    host.querySelectorAll('[data-p]').forEach((el) => { P_[el.dataset.p] = el; });
    host.querySelectorAll('[data-a]').forEach((el) => { A_[el.dataset.a] = el; });
    H_.link.setAttribute('href', host.getAttribute('data-link') || 'hallenfliegen.html');
    const stage = host.querySelector('.fcsg-stage'), cv = host.querySelector('.fcsg-cv');
    const ctx = cv.getContext('2d', { alpha: false });
    const pats = noiseTiles().map((c) => ctx.createPattern(c, 'repeat'));
    const lifeEls = H_.lives.children;

    /* ---------- Zustand ---------- */
    // idle (nur reduzierte Bewegung) · demo · count · play · pause · end · over
    let state = rm ? 'idle' : 'demo';
    let W = 0, H = 0, dpr = 1, dprCap = 2, f = 400;
    let running = false, visible = false, raf = 0, last = 0, clock = 0;
    let cx = 0, cy = YC, vx = 0, vy = 0, tx = 0, ty = YC, roll = 0, dist = 0, v = rm ? 0 : 9, vTarget = 9, shake = 0, sag = 0;
    let gates = [], gateN = 0, lastZw = 0, lastGx = 0, lastGy = YC;
    let score = 0, combo = 0, bestCombo = 0, lives = 3, passed = 0, flightT = 0, volt = 4.2;
    let crashT = 0, glitchT = 0, flashT = 0, flashA = 0, flashC = SIG, missT = 0, endT = 0, endReason = '';
    let countT = 0, countStep = -1, msgT = 0, touchId = null, lastPX = 0, lastPY = 0;
    let best = loadBest(), pfSum = 0, pfN = 0, assist = false;
    const keys = { l: 0, r: 0, u: 0, d: 0 };
    const pops = [], parts = [];
    const demoLike = () => state === 'demo' || state === 'over' || state === 'idle';
    const isLive = () => state === 'count' || state === 'play' || state === 'end';

    /* ---------- Projektion (Kamera blickt entlang +z) ---------- */
    const PX = (x, z) => (x - cx) * f / z;
    const PY = (y, z) => (cy - y) * f / z;
    function q4(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4) {
      ctx.moveTo(PX(x1, z1), PY(y1, z1)); ctx.lineTo(PX(x2, z2), PY(y2, z2));
      ctx.lineTo(PX(x3, z3), PY(y3, z3)); ctx.lineTo(PX(x4, z4), PY(y4, z4)); ctx.closePath();
    }

    /* ---------- Strecke ---------- */
    function makeGate(zw, x, y, bonus, d) {
      const s = (1 - 0.2 * d) * (bonus ? 0.84 : 1);
      return { zw, x, y, w: 2.7 * s, h: 2.0 * s, bonus, n: ++gateN, done: false };
    }
    function spawnGate() {
      const d = demoLike() ? 0.15 : clamp(flightT / 80, 0, 1);
      const sp = demoLike() ? 9 : Math.max(8, 8 + flightT * 0.095);
      const zw = lastZw + 10 + sp * 0.6;
      const mdx = lerp(2.6, 5.4, d), mdy = lerp(0.9, 2.1, d);
      let dx = rand(-1, 1) * mdx;
      if (Math.abs(dx) < mdx * 0.3) dx = (dx < 0 ? -1 : 1) * mdx * 0.3;
      if (Math.abs(lastGx + dx) > RX - 0.7) dx = -dx;
      let dy = rand(-1, 1) * mdy;
      if (lastGy + dy < 1.45 || lastGy + dy > 3.95) dy = -dy;
      const x = clamp(lastGx + dx, -RX + 0.7, RX - 0.7), y = clamp(lastGy + dy, 1.45, 3.95);
      const bonus = !demoLike() && gateN > 2 && Math.random() < 0.18;
      gates.push(makeGate(zw, x, y, bonus, d));
      lastZw = zw; lastGx = x; lastGy = y;
    }
    function fillCourse() { while (lastZw - dist < ZF + 6) spawnGate(); }
    function resetCourse(ahead) {
      gates = []; gateN = 0;
      lastZw = dist + ahead; lastGx = clamp(cx * 0.6, -2.5, 2.5); lastGy = clamp(cy, 1.8, 3.4);
      gates.push(makeGate(lastZw, lastGx, lastGy, false, 0));
      fillCourse();
    }
    function nextGate() {
      for (let i = 0; i < gates.length; i++) { const g = gates[i]; if (!g.done && g.zw - dist > 0.4) return g; }
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
        v = 0; gates = gates.filter((g) => g.done || g.zw - dist > 8);
      } else {
        if (!(state === 'demo' || state === 'idle' || state === 'over')) return;
        score = 0; combo = 0; bestCombo = 0; lives = 3; passed = 0; flightT = 0; volt = 4.2; sag = 0;
        crashT = 0; missT = 0; endReason = ''; pops.length = 0;
        glitchT = rm ? 0 : 0.32;              // kurzer Kanalwechsel, wie beim Umschalten der Brille
        resetCourse(20); tx = cx; ty = cy;
        say('Startsequenz. Steuern mit Maus, Finger oder Pfeiltasten. Drei Leben, der Akku hält 90 Sekunden.');
      }
      state = 'count'; countT = 0; countStep = -1;
      setUI();
      try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
      startLoop();
    }
    function pause() {
      if (!(state === 'count' || state === 'play')) return;
      state = 'pause'; keys.l = keys.r = keys.u = keys.d = 0; touchId = null; msgT = 0; H_.msg.className = 'fcsg-msg';
      setUI(); stopLoop(); if (W) { render(); hud(); }
      say('Pause. Weiterfliegen mit dem Knopf oder der Taste P.');
    }
    function endGame(reason) {
      if (state === 'end' || state === 'over') return;
      state = 'end'; endReason = reason; endT = reason === 'bat' ? 2.0 : 1.5;
      if (reason === 'lives') crashT = 1.5;
      msgT = 0; H_.msg.className = 'fcsg-msg'; pops.length = 0;
      setUI();
      say(reason === 'bat' ? 'LAND NOW. Der Akku ist leer.' : 'SIGNAL LOST. Keine Leben mehr.');
    }
    function showOver() {
      state = 'over';
      const isBest = score > best;
      if (isBest) { best = score; saveBest(best); }
      H_.why.textContent = endReason === 'bat' ? 'LAND NOW · Akku leer' : 'SIGNAL LOST · keine Leben mehr';
      H_.fscore.textContent = num(score); H_.fgates.textContent = String(passed);
      H_.fcombo.textContent = String(bestCombo); H_.ftime.textContent = mmss(flightT);
      H_.newbest.hidden = !isBest; showBest();
      crashT = 0; missT = 0; glitchT = rm ? 0 : 0.4; tx = 0; ty = YC;
      if (rm) { v = 0; cx = 0; cy = YC; vx = vy = 0; roll = 0; }
      resetCourse(rm ? 9 : 16);
      setUI();
      say('Spielende. ' + num(score) + ' Punkte, ' + passed + ' Gates.' + (isBest ? ' Neuer Bestwert!' : ''));
      try { A_.again.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      if (rm) { stopLoop(); renderStill(); }
    }
    function judge(g) {
      const dx = Math.abs(cx - g.x), dy = Math.abs(cy - g.y), r = 0.13;
      const inside = dx < g.w / 2 - r && dy < g.h / 2 - r;
      if (state !== 'play' || crashT > 0) { if (inside && demoLike()) flash(g.bonus ? AMB : SIG, 0.45); return; }
      if (inside) pass(g, Math.max(dx / (g.w / 2), dy / (g.h / 2)));
      else if (dx < g.w / 2 + 0.26 + r && dy < g.h / 2 + 0.26 + r) crash();
      else miss();
    }
    function pass(g, off) {
      combo++; passed++; if (combo > bestCombo) bestCombo = combo;
      const mult = Math.min(4, 1 + Math.floor((combo - 1) / 3));
      const prevMult = Math.min(4, 1 + Math.floor(Math.max(0, combo - 2) / 3));
      const perfect = off < 0.4;
      const pts = (g.bonus ? 200 : 100) * mult + (perfect ? 50 * mult : 0);
      score += pts;
      let sub = perfect ? 'PERFEKT' : g.bonus ? 'BONUS-GATE' : '';
      if (mult > prevMult) sub = (sub ? sub + ' · ' : '') + 'KOMBO ×' + mult;
      const col = g.bonus ? AMB : SIG;
      pops.push({ txt: '+' + pts, sub, col, t: 0 }); if (pops.length > 3) pops.shift();
      flash(col, perfect ? 0.95 : 0.65);
      sfxGate(perfect || g.bonus);
    }
    function crash() {
      lives--; combo = 0; crashT = 0.95; shake = 1; v *= 0.15; vx *= -0.5; vy *= -0.5;
      gates = gates.filter((g) => g.done || g.zw - dist > 10);     // freie Bahn nach dem Absturz
      sfxCrash();
      if (lives <= 0) endGame('lives'); else say('Absturz. Noch ' + lives + ' Leben.');
    }
    function miss() {
      lives--; combo = 0; missT = 1.0; flash(RED, 0.9); sfxMiss();
      if (lives <= 0) endGame('lives'); else say('Gate verpasst. Noch ' + lives + ' Leben.');
    }
    function flash(c, a) { flashC = c; flashA = a; flashT = 1; }
    function msg(text, extra, dur) {
      H_.msg.textContent = text;
      H_.msg.className = 'fcsg-msg ' + (extra || '');
      void H_.msg.offsetWidth;                     // Animation neu starten
      H_.msg.className = 'fcsg-msg on pop ' + (extra || '');
      msgT = dur || 0.6;
    }

    /* ---------- Steuerung ---------- */
    function autopilot() {
      const g = nextGate();
      if (g) { tx = g.x + Math.sin(clock * 0.8) * 0.18; ty = g.y + Math.sin(clock * 1.3) * 0.12; }
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

    /* ---------- Simulation ---------- */
    function update(dt) {
      clock += dt;
      const auto = demoLike();
      if (auto || (assist && state === 'play')) autopilot();
      else if (state === 'count' || state === 'play') steerKeys(dt);
      if (state === 'end' && endReason === 'bat') { tx = cx; ty = 0.35; }

      if (auto) vTarget = 9;
      else if (state === 'count' || state === 'end') vTarget = 0;
      else if (state === 'play') vTarget = crashT > 0 ? 0 : Math.min(16.5, 8 + flightT * 0.095);
      v += (vTarget - v) * Math.min(1, dt * (vTarget > v ? 1.7 : 2.6));
      dist += v * dt;

      // Feder mit Dämpfung: der Whoop folgt dem Ziel weich und mit Trägheit
      const K = auto ? 9 : 17, Dm = auto ? 5.4 : 7.2;
      const ax = K * (tx - cx) - Dm * vx, ay = K * (ty - cy) - Dm * vy;
      vx += ax * dt; vy += ay * dt;
      cx = clamp(cx + vx * dt, -HW + 0.8, HW - 0.8);
      cy = clamp(cy + vy * dt, 0.25, HH - 0.7);
      roll += (clamp(-vx * 0.055, -0.4, 0.4) - roll) * Math.min(1, dt * 7);
      sag += ((Math.min(1, Math.hypot(ax, ay) / 60) * 0.06 + v / 16 * 0.03) - sag) * Math.min(1, dt * 4);

      for (let i = 0; i < parts.length; i++) { const p = parts[i]; p.z -= v * dt; if (p.z < ZN + 0.2) newPart(p, true); }

      for (let i = 0; i < gates.length; i++) {
        const g = gates[i]; if (g.done) continue;
        if (g.zw - dist > 0) break;
        g.done = true; judge(g);
      }
      while (gates.length && gates[0].zw - dist < -2) gates.shift();
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
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.1) pops.splice(i, 1); }
    }

    /* ---------- Zeichnen ---------- */
    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = FOG; ctx.fillRect(0, 0, W, H);
      ctx.save();
      let ox = 0, oy = 0;
      if (!rm) {
        const vib = clamp(v / 16, 0, 1) * 0.35;                        // feines Propeller-Zittern
        ox = Math.sin(clock * 61) * vib + (shake ? rand(-1, 1) * shake * 9 : 0);
        oy = Math.cos(clock * 47) * vib + (shake ? rand(-1, 1) * shake * 9 : 0);
      }
      ctx.translate(W / 2 + ox, H / 2 + oy);
      ctx.rotate(roll);
      drawHall();
      drawGates();
      drawSpeed();
      drawAim();
      ctx.restore();
      drawScreen();
    }

    function drawHall() {
      let g;
      const R = Math.hypot(W, H);
      // Decke, Wände, Boden
      ctx.beginPath(); q4(-HW, HH, ZN, HW, HH, ZN, HW, HH, ZF, -HW, HH, ZF);
      g = ctx.createLinearGradient(0, PY(HH, 1.4), 0, PY(HH, ZF)); g.addColorStop(0, '#0a1426'); g.addColorStop(1, FOG);
      ctx.fillStyle = g; ctx.fill();
      for (let s = -1; s <= 1; s += 2) {
        const x = s * HW;
        ctx.beginPath(); q4(x, 0, ZN, x, HH, ZN, x, HH, ZF, x, 0, ZF);
        g = ctx.createLinearGradient(PX(x, 1.4), 0, PX(x, ZF), 0); g.addColorStop(0, '#0b1730'); g.addColorStop(0.5, '#08122a'); g.addColorStop(1, FOG);
        ctx.fillStyle = g; ctx.fill();
        // Prallschutz in Vereinsblau
        ctx.beginPath(); q4(x, 0, ZN, x, 1.9, ZN, x, 1.9, ZF, x, 0, ZF);
        g = ctx.createLinearGradient(PX(x, 1.4), 0, PX(x, ZF), 0); g.addColorStop(0, 'rgba(31,73,125,.62)'); g.addColorStop(1, 'rgba(31,73,125,0)');
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); q4(x, 1.9, ZN, x, 1.97, ZN, x, 1.97, ZF, x, 1.9, ZF);
        g = ctx.createLinearGradient(PX(x, 1.4), 0, PX(x, ZF * 0.7), 0); g.addColorStop(0, 'rgba(90,162,255,.5)'); g.addColorStop(1, 'rgba(90,162,255,0)');
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); q4(-HW, 0, ZN, HW, 0, ZN, HW, 0, ZF, -HW, 0, ZF);
      g = ctx.createLinearGradient(0, PY(0, 1.4), 0, PY(0, ZF)); g.addColorStop(0, '#132648'); g.addColorStop(0.5, '#0a1630'); g.addColorStop(1, FOG);
      ctx.fillStyle = g; ctx.fill();

      // Raster alle 6 m: Pfosten, Fenster, Träger (dunkle Silhouetten, damit die Gates leuchten)
      const P6 = 6, base6 = Math.floor(dist / P6) * P6;
      for (let zw = base6; zw < dist + ZF; zw += P6) {
        const z = zw - dist; if (z < 0.5) continue;
        const a = fogA(z); if (a < 0.02) continue;
        const z0 = Math.max(ZN, z - 0.06), z1 = z + 0.06;
        ctx.beginPath();
        q4(-HW, 0, z0, -HW, HH, z0, -HW, HH, z1, -HW, 0, z1);
        q4(HW, 0, z0, HW, HH, z0, HW, HH, z1, HW, 0, z1);
        ctx.fillStyle = rgba([3, 8, 18], 0.6 * a); ctx.fill();
        ctx.beginPath(); q4(-HW, HH - 0.32, z, HW, HH - 0.32, z, HW, HH, z, -HW, HH, z);
        ctx.fillStyle = rgba([3, 8, 18], 0.55 * a); ctx.fill();
        // Fensterband oben: drei Scheiben je Feld, nachts dunkelblau
        ctx.beginPath();
        for (let p = 0; p < 3; p++) {
          const w0 = z + 0.55 + p * 1.7, w1 = w0 + 1.45; if (w1 < ZN + 0.1) continue;
          const ww0 = Math.max(ZN, w0);
          q4(-HW, 5, ww0, -HW, 6.6, ww0, -HW, 6.6, w1, -HW, 5, w1);
          q4(HW, 5, ww0, HW, 6.6, ww0, HW, 6.6, w1, HW, 5, w1);
        }
        ctx.fillStyle = rgba([70, 135, 225], 0.13 * a); ctx.fill();
      }
      // Dunst am Ende der Halle
      ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
      g.addColorStop(0, 'rgba(47,111,208,.30)'); g.addColorStop(0.5, 'rgba(47,111,208,.07)'); g.addColorStop(1, 'rgba(47,111,208,0)');
      ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);

      // Deckenlampen mit Schein und Spiegelung im glänzenden Hallenboden
      for (let zw = base6 + 3; zw < dist + ZF; zw += P6) {
        const z = zw - dist; if (z < 1.2) continue;
        const a = fogA(z) * clamp((z - 1.2) / 5, 0, 1); if (a < 0.02) continue;   // nahe Lampen blenden weich aus
        const z0 = Math.max(ZN, z - 1.2), z1 = z + 1.2, h0 = Math.max(ZN, z - 2.6), h1 = z + 2.6, r0 = Math.max(ZN, z - 2.8), r1 = z + 2.8;
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
      }
      ctx.globalCompositeOperation = 'source-over';

      // Spielfeldlinien längs (laufen zum Fluchtpunkt, Nebel als radialer Verlauf)
      const LONG = [[WHT, 0.55, [-9.5, 9.5], 0.07], [BLU, 0.5, [-6.2, 6.2], 0.05], [AMB, 0.4, [-8.1, 8.1], 0.05]];
      for (let i = 0; i < LONG.length; i++) {
        const L = LONG[i];
        g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.6);
        g.addColorStop(0, rgba(L[0], 0)); g.addColorStop(0.1, rgba(L[0], L[1] * 0.2)); g.addColorStop(1, rgba(L[0], L[1]));
        ctx.beginPath();
        for (let j = 0; j < 2; j++) { const x = L[2][j], w = L[3]; q4(x - w, 0, ZN, x + w, 0, ZN, x + w, 0, ZF, x - w, 0, ZF); }
        ctx.fillStyle = g; ctx.fill();
      }
      // Linien quer und Mittelkreis, Muster alle 24 m
      const P24 = 24, base24 = Math.floor(dist / P24) * P24;
      for (let zw = base24; zw < dist + ZF + P24; zw += P24) {
        crossLine(zw, -9.5, 9.5, WHT, 0.55, 0.06);
        crossLine(zw + 6, -8.1, 8.1, AMB, 0.42, 0.05);
        crossLine(zw + 12, -9.5, 9.5, BLU, 0.5, 0.05);
        crossLine(zw + 18, -8.1, 8.1, AMB, 0.42, 0.05);
        const zc = zw - dist;
        if (zc > -3 && zc < ZF) {
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
      }

      // Sprossenwände und Kletterseile, typisch Turnhalle
      for (let zw = base24 - P24; zw < dist + ZF; zw += P24) {
        for (let s = -1; s <= 1; s += 2) {
          const zb = zw + (s < 0 ? 8 : 20) - dist;            // Sprossenwand
          if (zb + 3.6 > 0.6 && zb < ZF) {
            const a = fogA(Math.max(zb, 1)) * 0.55, x = s * (HW - 0.05);
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) { const z = zb + i * 0.45; if (z < 0.6) continue; ctx.moveTo(PX(x, z), PY(0, z)); ctx.lineTo(PX(x, z), PY(2.7, z)); }
            const za = Math.max(0.6, zb), ze = zb + 3.6;
            if (ze > za) { ctx.moveTo(PX(x, za), PY(2.7, za)); ctx.lineTo(PX(x, ze), PY(2.7, ze)); }
            ctx.lineWidth = clamp(0.05 * f / Math.max(zb + 1.8, 1), 0.7, 5); ctx.strokeStyle = rgba(WOOD, a); ctx.stroke();
          }
          const zr = zw + (s < 0 ? 15 : 3) - dist;              // Kletterseile
          if (zr > 0.8 && zr < ZF) {
            const a = fogA(zr) * 0.5 * clamp((zr - 0.8) / 3, 0, 1), x0 = s * 9.2;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { const z = zr + i * 0.8, x = x0 - s * i * 0.05; ctx.moveTo(PX(x, z), PY(HH - 0.3, z)); ctx.lineTo(PX(x, z), PY(1.25, z)); }
            ctx.lineWidth = clamp(0.045 * f / zr, 0.6, 5); ctx.strokeStyle = rgba(WOOD, a); ctx.stroke();
          }
        }
      }
    }
    function crossLine(zw, x0, x1, col, a, lw) {
      const z = zw - dist; if (z < 0.5 || z > ZF) return;
      const al = fogA(z) * a; if (al < 0.01) return;
      ctx.beginPath(); q4(x0, 0, Math.max(ZN, z - lw), x1, 0, Math.max(ZN, z - lw), x1, 0, z + lw, x0, 0, z + lw);
      ctx.fillStyle = rgba(col, al); ctx.fill();
    }

    function drawGates() {
      const nx = nextGate();
      for (let i = gates.length - 1; i >= 0; i--) {
        const g = gates[i], rel = g.zw - dist;
        if (rel < 0.35 || rel > ZF) continue;
        drawGate(g, rel, g === nx);
      }
    }
    function drawGate(g, rel, isNext) {
      const a = fogA(rel); if (a < 0.02) return;
      const k = f / rel, kb = f / (rel + 0.24);
      const hw = g.w / 2, hh = g.h / 2, ft = 0.26;
      const gx = g.x - cx, top = cy - (g.y + hh), bot = cy - (g.y - hh);
      const ix0 = (gx - hw) * k, ix1 = (gx + hw) * k, iy0 = top * k, iy1 = bot * k;
      const ox0 = (gx - hw - ft) * k, ox1 = (gx + hw + ft) * k, oy0 = (top - ft) * k, oy1 = (bot + ft) * k;
      const fy = cy * k;
      const col = g.bonus ? AMB : SIG;
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

      // Nummer oder Bonus über dem Gate
      if (k > 13 && k < 300) {
        const fs = Math.min(56, Math.round(0.36 * k));
        ctx.font = '700 ' + fs + 'px "Chakra Petch", ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = rgba(col, (isNext ? 0.95 : 0.7) * a * clamp((190 - k) / 80, 0, 1));
        ctx.fillText(g.bonus ? 'BONUS ×2' : 'GATE ' + pad(g.n % 100), gx * k, oy0 - 0.16 * k);
      }
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
      // Ziel-Raute: so weit kommt der Whoop bis zum nächsten Gate
      const ng = nextGate();
      const zm = clamp(ng ? ng.zw - dist : 12, 3, 30);
      const mx = clamp((tx - cx) * f / zm, -W, W), my = clamp((cy - ty) * f / zm, -H, H);
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
      // Fadenkreuz (OSD, bleibt gerade)
      const c0 = W / 2, c1 = H / 2;
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
      const mode = demo ? (state === 'idle' ? 'DISARMED' : 'AUTOPILOT') : state === 'count' ? 'ARMING' : state === 'play' ? 'ARMED' : 'DISARMED';
      put('mode', mode); cls(H_.mode, 'modec', 'fcsg-mode ' + (mode === 'AUTOPILOT' ? 'auto' : mode === 'ARMED' ? 'armed' : ''));
      put('score', num(score)); put('combo', String(combo));
      const mult = Math.min(4, 1 + Math.floor(Math.max(0, combo - 1) / 3));
      put('mult', combo > 0 && mult > 1 ? '×' + mult : '');
      if (hc.lives !== lives) { hc.lives = lives; for (let i = 0; i < 3; i++) lifeEls[i].className = i < lives ? '' : 'off'; }
      let w = '', wc = '';
      if (state === 'end') { w = endReason === 'bat' ? 'LAND NOW' : 'SIGNAL LOST'; wc = 'red'; }
      else if (state === 'play' && crashT > 0) { w = 'RXLOSS'; wc = 'red'; }
      else if (state === 'play' && missT > 0) { w = 'GATE VERPASST'; wc = 'amber'; }
      else if ((state === 'play' || state === 'pause') && volt < LOW_V) { w = 'LOW BAT'; wc = 'amber'; }
      put('warn', w); cls(H_.warn, 'warn', 'fcsg-warn ' + wc + (w ? ' on' : ''));
    }
    function showBest() {
      const t = best > 0 ? num(best) + ' Punkte' : 'noch keiner';
      H_.best.textContent = t; H_.best2.textContent = t;
    }
    function say(t) { H_.live.textContent = t; }
    function setUI() {
      host.setAttribute('data-state', state);
      const live = isLive();
      host.classList.toggle('is-live', live);
      host.classList.toggle('is-demo', state === 'demo');
      host.classList.toggle('is-hud', state === 'count' || state === 'play' || state === 'end' || state === 'pause');
      P_.start.hidden = !(state === 'demo' || state === 'idle');
      P_.pause.hidden = state !== 'pause';
      P_.over.hidden = state !== 'over';
      A_.pause.hidden = !(state === 'count' || state === 'play');
      if (!live) document.body.classList.remove('fcsg-noreticle');
    }

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
        if (!AC) { A_.snd.lastChild.textContent = 'Kein Ton möglich'; A_.snd.disabled = true; return; }
        try { buildAudio(new AC()); } catch (e) { return; }
      }
      au.on = !au.on;
      A_.snd.lastChild.textContent = au.on ? 'Ton aus' : 'Ton an';
      A_.snd.classList.toggle('on', au.on);
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
    function renderStill() { if (!W) resize(); if (W) { render(); hud(); } }
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
      f = Math.max(0.5 * Math.min(W, H) / Math.tan(41 * Math.PI / 180), W * 0.3);   // weites FPV-Sichtfeld
    }
    function perf(dt) {   // Mittelklasse-Handy: bei Ruckeln Auflösung senken
      if (dpr <= 1) return;
      pfSum += dt; if (++pfN < 120) return;
      const avg = pfSum / pfN; pfSum = 0; pfN = 0;
      if (avg > 0.026) { dprCap = Math.max(1, dpr - 0.5); resize(); }
    }

    /* ---------- Ereignisse ---------- */
    stage.addEventListener('click', (e) => {
      if (e.target.closest('button,a')) return;
      if (state === 'demo' || state === 'idle') arm(false);
      else if (state === 'pause') arm(true);
    });
    A_.go.addEventListener('click', () => arm(false));
    A_.again.addEventListener('click', () => arm(false));
    A_.resume.addEventListener('click', () => arm(true));
    A_.pause.addEventListener('click', pause);
    A_.snd.addEventListener('click', toggleSound);
    host.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code], live = state === 'count' || state === 'play';
      if (k && live) { keys[k] = 1; e.preventDefault(); return; }
      if ((e.code === 'KeyP' || e.code === 'Escape') && live) { pause(); e.preventDefault(); return; }
      if (e.code === 'KeyP' && state === 'pause') { arm(true); e.preventDefault(); return; }
      if (e.target === stage && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        if (state === 'demo' || state === 'idle') arm(false); else if (state === 'pause') arm(true);
      } else if (k && state === 'end') e.preventDefault();
    });
    host.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = 0; });
    window.addEventListener('blur', () => { keys.l = keys.r = keys.u = keys.d = 0; });
    cv.addEventListener('pointerdown', (e) => {
      if (!isLive()) return;
      if (e.pointerType === 'mouse') { if (state !== 'end') aimAbs(e); return; }
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
    document.addEventListener('visibilitychange', onVis);

    if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); if (!running && visible) renderStill(); }).observe(stage);
    else window.addEventListener('resize', () => { resize(); if (!running && visible) renderStill(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; onVis(); }, { threshold: 0.15 }).observe(stage);
    } else { visible = true; onVis(); }

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
      start: () => arm(false),
      pause,
      resume: () => arm(true),
      end(reason) {
        if (state === 'pause') { state = 'play'; setUI(); }
        if (state === 'play' || state === 'count') { endGame(reason === 'lives' ? 'lives' : 'bat'); startLoop(); }
      },
      finish(reason) { api.end(reason); if (state === 'end') showOver(); },
      setFlightTime(s) { flightT = clamp(+s || 0, 0, BAT_T); },
      assist(on) { assist = !!on; },   // nur für automatische Tests: lenkt wie der Autopilot
      stats: () => ({
        state, score, passed, combo, bestCombo, lives, best,
        flightT: +flightT.toFixed(2), volt: +volt.toFixed(2), kmh: Math.round(v * 3.6),
        pos: [+cx.toFixed(2), +cy.toFixed(2)], target: [+tx.toFixed(2), +ty.toFixed(2)],
        running, visible, dpr, size: [W, H]
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
    version: '1.0.0',
    instances,
    mount,
    mountAll,
    end: (reason) => instances.forEach((g) => g.end(reason)),
    finish: (reason) => instances.forEach((g) => g.finish(reason))
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
})();
