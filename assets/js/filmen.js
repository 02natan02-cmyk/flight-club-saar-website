/* FPV filmen · Werkzeuge des Film-Ratgebers (Flight Club Saar)
   Jedes Werkzeug bewegt sich von selbst, bis jemand eingreift (Selbst-Impuls), und zeigt einen kurzen Hinweis.
   Läuft nur, solange es zu sehen ist. Bei „Bewegung reduzieren“ bleibt alles ruhig. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const de = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const shTxt = (t) => '1/' + Math.round(1 / t);
  const hasG = () => !!window.gsap;
  const FM = window.FCS_FILM = {};

  /* ---------- Helfer ---------- */
  function onVis(el, cb, margin) {
    if (!el) return;
    const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { rootMargin: margin || '80px 0px' });
    io.observe(el);
  }
  // Zeichenschleife, die nur läuft, solange das Element sichtbar ist. Gibt eine Funktion zum einmaligen Neuzeichnen zurück.
  function loop(el, fn) {
    let vis = false, raf = 0, last = 0, t0 = performance.now();
    const tick = (now) => {
      raf = 0; if (!vis) return;
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
      fn((now - t0) / 1000, dt);
      if (!RM) raf = requestAnimationFrame(tick);
    };
    onVis(el, v => { vis = v; if (v && !raf) { last = 0; raf = requestAnimationFrame(tick); } });
    return () => { if (vis && !raf) raf = requestAnimationFrame(tick); };
  }
  // Selbst-Impuls: führt step() regelmäßig aus, bis der Nutzer im Element etwas tut
  function auto(root, step, ms, hint) {
    const st = { on: true };
    let vis = false, iv = 0;
    const stop = () => {
      if (!st.on) return; st.on = false; clearInterval(iv);
      if (hint) { hint.classList.remove('on'); hint.classList.add('gone'); }
    };
    st.stop = stop;
    ['pointerdown', 'keydown', 'input', 'change', 'focusin'].forEach(n => root.addEventListener(n, e => { if (e.isTrusted) stop(); }, { passive: true }));
    onVis(root, v => { vis = v; if (v && st.on && hint) hint.classList.add('on'); }, '0px');
    if (!RM && step) iv = setInterval(() => { if (st.on && vis && !document.hidden) step(); }, ms);
    return st;
  }
  function addHint(box, text, cls) {
    const p = document.createElement('p'); p.className = 'fm-hint ' + (cls || 'fm-hint-tr'); p.setAttribute('aria-hidden', 'true'); p.textContent = text;
    box.appendChild(p); return p;
  }
  const radioVal = (name) => { const r = $(`input[name="${name}"]:checked`); return r ? r.value : null; };
  function setRadio(name, val) {
    const r = $(`input[name="${name}"][value="${val}"]`);
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function img(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function copy(text, okEl) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try {
        const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e2) { ok = false; }
    }
    if (okEl) { okEl.textContent = ok ? 'Kopiert. Jetzt einfügen.' : 'Kopieren ging nicht. Bitte Text markieren und kopieren.'; setTimeout(() => { okEl.textContent = ''; }, 3500); }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function sizeCanvas(cv, maxW, ratio) {
    const w = Math.max(200, Math.min(maxW, Math.round((cv.clientWidth || maxW) * DPR))), h = Math.round(w / ratio);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; return true; }
    return false;
  }
  const fmtTC = (fr) => { const f = fr % 25, s = Math.floor(fr / 25); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f].map(n => String(n).padStart(2, '0')).join(':'); };

  /* ND-Berechnung: Lichtwert (ISO 100), Bildrate, Shutter-Winkel und Blende → Empfehlung */
  const NDS = [0, 2, 3, 4, 5, 6, 7], NDN = ['Kein', 'ND4', 'ND8', 'ND16', 'ND32', 'ND64', 'ND128'];
  function ndRec(EV, fps, ang, N) {
    const tT = ang / 360 / fps, tB = N * N / Math.pow(2, EV), s = Math.log2(tT / tB);
    let i = 0;
    if (s >= 1.5) i = clamp(Math.round(s), 2, 7) - 1;
    const st = NDS[i];
    let t = tT, iso = 100;
    if (i === 0) { if (s >= 0) t = tB; else iso = Math.round(100 * Math.pow(2, -s) / 10) * 10; }
    else if (st >= s) iso = Math.round(100 * Math.pow(2, st - s) / 10) * 10;
    else t = tB * Math.pow(2, st);
    return { i, s, tT, tB, t, iso, name: i ? NDN[i] : 'Kein ND' };
  }

  /* =========================================================
     KOPF: Blende öffnet sich, Timecode, Histogramm
     ========================================================= */
  function head() {
    const sec = $('.fm-head'); if (!sec) return;
    const iris = $('.fm-iris', sec), p = $('.fm-iris-p', sec), lines = $('.fm-iris-l', sec), fst = $('[data-fstop]', sec);
    const C = Math.cos(Math.PI / 8);
    const build = (r, rot) => {
      const R = Math.max(.5, r) / C, pts = [];
      for (let k = 0; k < 8; k++) { const a = rot + (k + .5) * Math.PI / 4; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
      p.setAttribute('d', 'M-400-300H400V300H-400Z M' + pts.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join(' L') + 'Z');
      lines.innerHTML = pts.map((q, k) => {
        const o = pts[(k + 7) % 8]; let dx = q[0] - o[0], dy = q[1] - o[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        return `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${(q[0] + dx * 420).toFixed(1)}" y2="${(q[1] + dy * 420).toFixed(1)}"/>`;
      }).join('');
    };
    const fNum = (pr) => 22 * Math.pow(2.8 / 22, pr);
    const skip = RM || !hasG() || location.search.includes('nointro');
    if (skip) { iris.classList.add('gone'); if (fst) fst.textContent = 'F2.8'; }
    else {
      const o = { r: .5, rot: 0, pr: 0 };
      const upd = () => { build(o.r, o.rot); if (fst) fst.textContent = 'F' + fNum(o.pr).toFixed(1); };
      upd();
      gsap.timeline({ delay: .2, onComplete: () => iris.classList.add('gone') })
        .to(o, { r: 14, rot: .3, pr: .18, duration: .45, ease: 'power2.out', onUpdate: upd })
        .to(o, { r: 250, rot: 1.15, pr: 1, duration: 1.05, ease: 'power3.in', onUpdate: upd }, '+=.1');
      gsap.from(['.fm-h1a', '.fm-h1b'], { yPercent: 110, opacity: 0, duration: 1.1, stagger: .1, ease: 'expo.out', delay: .95 });
      gsap.from(['.fm-head .crumb', '.fm-head-l', '.fm-head-b'], { y: 22, opacity: 0, duration: .8, stagger: .06, ease: 'expo.out', delay: 1.15 });
    }
    if (hasG() && window.ScrollTrigger && !RM) gsap.to('.fm-head-in', { yPercent: -12, opacity: .3, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true } });
    // Timecode läuft mit 25 Bildern pro Sekunde
    const tc = $('[data-tc]', sec), t0 = performance.now();
    let vis = true; onVis(sec, v => { vis = v; });
    setInterval(() => { if (vis && tc) tc.textContent = fmtTC(Math.floor((performance.now() - t0) / 40)); }, 40);
    // Histogramm aus dem echten Standbild
    const hc = $('.fm-histo', sec);
    if (hc) img('media/cine.webp').then(im => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data, bins = new Array(44).fill(0);
      for (let i = 0; i < d.length; i += 4) bins[Math.min(43, Math.floor((d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 256 * 44))]++;
      const mx = Math.max(...bins), hx = hc.getContext('2d');
      const draw = () => { hx.clearRect(0, 0, 132, 46); hx.fillStyle = 'rgba(234,244,255,.78)'; bins.forEach((b, i) => { const h = Math.max(1, (b / mx) * 40 * (RM ? 1 : .85 + Math.random() * .3)); hx.fillRect(i * 3, 46 - h, 2, h); }); };
      draw(); if (!RM) setInterval(() => { if (vis) draw(); }, 220);
    }).catch(() => {});
  }

  /* =========================================================
     AUFKLAPPER: Werkzeuge in „Mehr dazu“ messen sich beim Öffnen neu
     ========================================================= */
  function folds() {
    $$('details.fold').forEach(d => d.addEventListener('toggle', () => {
      if (d.open && hasG() && !RM) { const fi = $('.fold-in', d); if (fi) gsap.from(fi, { y: 14, opacity: 0, duration: .5, ease: 'expo.out', clearProps: 'transform,opacity' }); }
      requestAnimationFrame(() => { dispatchEvent(new Event('resize')); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
    }));
  }

  /* =========================================================
     „WAS WILLST DU WISSEN?“: Kacheln springen zu den Kapiteln
     ========================================================= */
  function asks() {
    const ol = $('#fm-ask'); if (!ol) return;
    const as = $$('a', ol); let i = -1;
    const clear = () => as.forEach(a => a.classList.remove('hot'));
    // Selbst-Impuls: ein Lichtrahmen wandert über die Fragen, bis jemand eine antippt
    const st = auto(ol, () => { clear(); i = (i + 1) % as.length; as[i].classList.add('hot'); }, 1300, addHint(ol, 'Frage antippen, du springst hin'));
    ['pointerenter', 'pointerdown', 'focusin'].forEach(n => ol.addEventListener(n, () => { clear(); st.stop(); }, { passive: true }));
    if (!RM && hasG() && window.ScrollTrigger) gsap.from(as, { y: 24, opacity: 0, duration: .8, stagger: .035, ease: 'expo.out', scrollTrigger: { trigger: ol, start: 'top 88%', once: true } });
  }

  /* =========================================================
     01 SCHNELLSTART: Einstellungs-Generator
     ========================================================= */
  function quick() {
    const form = $('#fm-q'); if (!form) return;
    const out = $('#fm-q-out'), sum = $('[data-q-sum]'), note = $('[data-q-note]');
    const CAM = {
      gopro: { ap: 2.5, log: 'GP-Log in 10 Bit', std: 'Natürlich, Schärfe niedrig', full: '4K 8:7 (volle Sensorfläche)', fullMax: 60, wide: '4K 16:9', stabCam: 'HyperSmooth an', stabGyro: 'HyperSmooth aus (ab HERO8 darf es an bleiben)', lensCam: { kino: 'Linear + Horizont-Lock', free: 'SuperView oder HyperView', slow: 'Wide', halle: 'Wide' }, lensGyro: 'Wide' },
      o4: { ap: 2.8, log: 'D-Log M (O4 Pro)', std: 'Normal', full: '4K 4:3', fullMax: 60, wide: '4K 16:9', stabCam: 'RockSteady an (nur im Standard-Bildwinkel)', stabGyro: 'RockSteady aus, sonst keine Gyro-Daten', lensCam: { kino: 'Standard', free: 'Standard', slow: 'Standard', halle: 'Standard' }, lensGyro: 'Wide (für Gyroflow Pflicht)' },
      action: { ap: 2.8, log: 'D-Log M in 10 Bit', std: 'Normal', full: '4K quadratisch (Action 6)', fullMax: 120, wide: '4K 16:9', stabCam: 'RockSteady, für Kino HorizonSteady', stabGyro: 'RockSteady aus, sonst keine Gyro-Daten', lensCam: { kino: 'Normal mit HorizonSteady', free: 'Weit', slow: 'Weit', halle: 'Weit' }, lensGyro: 'Wide' },
      thumb: { ap: 2.8, log: null, std: 'Normal (Gyroflow-Empfehlung)', full: '1440p 4:3', fullMax: 60, wide: '1080p 16:9', stabCam: 'Bildstabilisierung an', stabGyro: 'Bildstabilisierung aus', lensCam: { kino: 'Verzerrungskorrektur an', free: 'Verzerrungskorrektur aus', slow: 'Verzerrungskorrektur aus', halle: 'Verzerrungskorrektur aus' }, lensGyro: 'Verzerrungskorrektur aus' },
      x360: { ap: 2.0, log: 'I-Log (Insta360) oder Log des Herstellers', std: 'Standard', full: '', fullMax: 0, wide: '', stabCam: 'Stabilisierung in der Hersteller-App', stabGyro: 'Stabilisierung in der Hersteller-App', lensCam: {}, lensGyro: '' }
    };
    const FPS = { kino: 25, free: 50, slow: 100, halle: 50 };
    let prev = {}, text = '';
    function calc() {
      const z = radioVal('ziel'), c = radioVal('cam'), s = radioVal('stab'), f = radioVal('fmt'), K = CAM[c];
      let fps = FPS[z];
      if (c === 'thumb' && z === 'slow') fps = 120;
      if (c === 'x360' && z === 'slow') fps = 120;
      const tall = f !== 'yt';
      let res;
      if (c === 'x360') res = z === 'slow' ? ['Einzellinsen-Modus', 'Die Insta360 X6 filmt so 4K mit 120 fps.'] : ['Höchste 360-Grad-Auflösung', 'Je mehr Pixel, desto schärfer der spätere Ausschnitt. Die X6 filmt 8K mit bis zu 50 fps.'];
      else if (fps <= K.fullMax && (tall || s === 'gyro')) res = [K.full, tall ? 'Reserve für den 9:16-Ausschnitt und die Stabilisierung.' : 'Spielraum für Gyroflow, am Ende 16:9 ausgeben.'];
      else res = [K.wide, tall ? `Bei ${fps} fps gibt es hier keine volle Sensorfläche. Plane den Hochformat-Ausschnitt mittig.` : 'Passt direkt zu YouTube.'];
      const fpsWhy = { kino: 'Kino-Takt für Deutschland, flackerfrei bei 50 Hz.', free: 'Flüssig für Tricks und Social Media.', slow: fps === 100 ? 'Auf einer 25p-Timeline viermal langsamer.' : 'Auf 25p fast fünfmal langsamer. Unter Hallenlicht besser 100 fps.', halle: 'Flackerfrei unter 50-Hz-Hallenlicht.' }[z];
      const ang = (s === 'gyro' && c !== 'x360') ? 90 : 180;
      const t = z === 'halle' ? 1 / 100 : ang / 360 / fps;
      const shWhy = z === 'halle' ? '1/100 s umfasst genau einen Lichtzyklus: keine Streifen.' : ang === 90 ? '90 Grad: weniger Unschärfe, die beim Stabilisieren nicht mitwandert.' : '180-Grad-Regel: natürliche Bewegungsunschärfe.';
      const iso = z === 'halle' ? ['Auto mit Obergrenze', 'In der Halle fehlt Licht, die Obergrenze hält das Rauschen im Rahmen.'] : ['100', 'So wenig Rauschen wie möglich. Den Rest regelt der ND-Filter.'];
      const wb = z === 'halle' ? ['Fest, passend zum Hallenlicht', 'Vor dem Flug einmal einstellen und testen, sonst springt die Farbe.'] : c === 'thumb' ? ['Sunny', 'So empfiehlt es die Gyroflow-Doku für RunCam.'] : ['5500 K fest', 'Tageslicht. Auto-Weißabgleich springt im Flug.'];
      let prof;
      if (z === 'halle') prof = [K.std, 'Bei wenig Licht rauscht Log nach dem Graden stärker.'];
      else if (!K.log) prof = [K.std, 'Kein Log-Profil. Kontrast und Schärfe niedrig stellen.'];
      else if (z === 'free' && f === 'reel') prof = ['Standard oder ' + K.log, 'Log nur, wenn du gradest. Für schnelle Reels reicht Standard.'];
      else prof = [K.log, 'Mehr Spielraum für Himmel und Schatten. Danach LUT im Schnitt.'];
      const lens = c === 'x360' ? ['Rundum, später reframen', 'Blickrichtung und Kamerafahrt legst du in der App fest.'] : s === 'gyro' ? [K.lensGyro, 'Gyroflow braucht den Rand zum Zuschneiden.'] : [K.lensCam[z], z === 'kino' ? 'Gerade Linien und ruhiger Horizont wirken hochwertig.' : 'Weites Bild für Tempo und Übersicht.'];
      const stab = c === 'x360' ? [K.stabCam, 'Gyroflow kann gestitchtes 360-Grad-Video nicht stabilisieren.'] : s === 'gyro' ? [K.stabGyro, 'Danach in Gyroflow: Objektivprofil, Glättung, Horizont.'] : [K.stabCam, 'Fertig zum Posten direkt nach dem Flug.'];
      let nd;
      if (z === 'halle') nd = ['Kein ND', 'In der Halle ist es dunkel genug.'];
      else if (c === 'x360') {
        // Aufsteckfilter gibt es für die Insta360 X5 und X6 nur als ND16, ND32 und ND64
        const r = ndRec(15, fps, ang, K.ap), ix = Math.min(5, Math.max(3, r.i)), nm = r.i ? NDN[ix] : 'Kein ND';
        const cap = ix === 5 && r.i > 5;
        nd = [nm, (!r.i ? '' : cap ? `Stärker als ND64 gibt es nicht: Bei Sonne wird der Shutter damit ${shTxt(r.tB * 64)} s statt ${shTxt(t)} s. ` : `Richtwert bei Sonne für ${shTxt(t)} s. `) + 'Zum Aufstecken gibt es ND16, ND32 und ND64 für die Insta360 X5 und X6. Für die GoPro Max 2 bietet GoPro keine ND-Filter an, dort wird der Shutter bei Sonne kürzer.'];
      }
      else { const r = ndRec(15, fps, ang, K.ap); nd = [r.name, `Richtwert bei Sonne für ${shTxt(t)} s. Bei Wolken ein bis zwei Stufen schwächer.`]; }
      const rows = [['Auflösung', res], ['Bildrate', [fps + 'p', fpsWhy]], ['Shutter', [shTxt(t) + ' s', shWhy]], ['ISO', iso], ['Weißabgleich', wb], ['Profil', prof], ['Objektiv', lens], ['Stabilisierung', stab], ['ND bei Sonne', nd]];
      out.innerHTML = rows.map(([k, [v, w]]) => `<div class="${prev[k] !== undefined && prev[k] !== v ? 'flash' : ''}"><dt>${k}</dt><dd><b>${esc(v)}</b><span>${esc(w)}</span></dd></div>`).join('');
      prev = Object.fromEntries(rows.map(([k, [v]]) => [k, v]));
      sum.textContent = `${fps}P · ${shTxt(t)} · ${nd[0]}`.toUpperCase();
      note.textContent = 'Startwerte zum Ausprobieren. Am Spot kurz testen und die Aufnahme am Handy prüfen.';
      text = 'Meine Film-Einstellungen (FPV filmen, Flight Club Saar)\n' + rows.map(([k, [v]]) => `${k}: ${v}`).join('\n');
      FM.quickState = { fps, ang, ap: K.ap };
    }
    form.addEventListener('change', calc);
    $('#fm-q-copy').addEventListener('click', () => copy(text, $('#fm-q-ok')));
    $('#fm-q-nd').addEventListener('click', () => { if (FM.ndSet && FM.quickState) FM.ndSet(FM.quickState); });
    calc();
    const order = ['kino', 'free', 'slow', 'halle']; let k = 0;
    const camOrder = ['gopro', 'o4', 'action', 'thumb']; let c = 0;
    auto(form.closest('.fm-q-grid'), () => { k = (k + 1) % 4; if (k === 0) { c = (c + 1) % camOrder.length; setRadio('cam', camOrder[c]); } setRadio('ziel', order[k]); }, 2600, $('.fm-hint-q'));
  }

  /* =========================================================
     02 KAMERAS: Regal mit Filter
     ========================================================= */
  const CAMS = [
    { n: 'GoPro HERO13 Black', t: 'Action-Cam', g: 159, gt: '159 g mit Akku', s: '5.3K60, 4K120, 10 Bit, Log, bis 120 Mbit/s, HyperSmooth 6.0', gy: 'ja', k: ['fuenf', 'lr'] },
    { n: 'DJI Osmo Action 6', t: 'Action-Cam', g: 149, gt: '149 g', s: '4K bis 120 fps, auch quadratisch 3840 × 3840, 1/1,1-Zoll-Sensor, Blende f/2,0 bis f/4,0, D-Log M in 10 Bit', gy: 'ja', k: ['fuenf', 'lr'] },
    { n: 'DJI Osmo Action 5 Pro', t: 'Action-Cam', g: 146, gt: '146 g', s: '4K120, 1/1,3-Zoll-Sensor, 155°, RockSteady 3.0+', gy: 'ja', k: ['fuenf', 'lr'] },
    { n: 'GoPro Mission 1 Pro', t: 'Action-Cam', g: 207, gt: 'etwa 207 g', s: 'Seit Mai 2026: 1-Zoll-Sensor mit 50 Megapixeln, 8K60, 4K240. Die Mission 1 ohne Pro schafft 8K30 und 4K120. Gyroflow listet keine der beiden Mission-Kameras, also nutz die Stabilisierung in der Kamera.', gy: 'nein', k: ['fuenf', 'lr'] },
    { n: 'Naked GoPro (Beispiel HERO9)', t: 'Naked', g: 49, gt: '49 g im Flywoo-Case', s: 'Bild wie das Original, Strom vom Kopter (2S bis 6S), nicht wasserdicht', gy: 'ja', k: ['cine', 'fuenf', 'lr'] },
    { n: 'RunCam Thumb 2', t: 'Mini-HD', g: 27, gt: '27 g', s: '4K60, 1080p120, 5 V. Für Gyroflow: .gcsv-Datei neben dem Video, Synchronisation nötig.', gy: 'ja', k: ['cine', 'fuenf', 'lr'] },
    { n: 'Insta360 GO 3S', t: 'Mini-HD', g: 39, gt: '39 g Kamera allein', s: '4K, FlowState-Stabilisierung. Gyroflow braucht keine Synchronisation.', gy: 'ja', k: ['cine', 'fuenf'] },
    { n: 'Insta360 GO Ultra', t: 'Mini-HD', g: 53, gt: '53 g', s: '4K60, 1/1,28-Zoll-Sensor, 156°, bis 180 Mbit/s. Gyroflow liest ihre Bewegungsdaten, in der Kameratabelle der Doku steht sie noch nicht.', gy: 'ja', k: ['cine', 'fuenf'] },
    { n: 'Caddx Walnut', t: 'Mini-HD', g: 60, gt: 'etwa 60 g', s: '4K60, 1/2,3-Zoll-Sensor, Strom 2S bis 6S, IP64. Für Gyroflow: .gcsv-Datei, Synchronisation nötig, interne Verzerrungskorrektur aus.', gy: 'ja', k: ['fuenf', 'lr'] },
    { n: 'DJI O4 Air Unit', t: 'Digital', g: 8.2, gt: 'etwa 8,2 g mit Kamera', s: '4K60, 1080p120, 1/2-Zoll-Sensor, 117,6°, bis 100 Mbit/s, 23 GB intern', gy: 'ja', k: ['whoop', 'cine', 'fuenf'] },
    { n: 'DJI O4 Air Unit Pro', t: 'Digital', g: 32, gt: 'etwa 32 g mit Kamera', s: '4K120, 1/1,3-Zoll-Sensor, 155°, D-Log M, bis 130 Mbit/s. Bei Einheiten von 2026 mit dem Gyro-Chip 1469D meldet das Gyro unter Vibration falsche Bewegung: dann die Optische Korrektur in Gyroflow nutzen.', gy: 'ja', k: ['cine', 'fuenf', 'lr'] },
    { n: 'Walksnail Avatar Moonlight', t: 'Digital', g: 38.5, gt: 'etwa 38,5 g ohne Antenne', s: '4K60, 1080p100, bis 150 Mbit/s. Für Gyroflow: eigene Gyro-Datei, Synchronisation von Hand, eingebaute Stabilisierung aus.', gy: 'ja', k: ['cine', 'fuenf', 'lr'] },
    { n: 'HDZero', t: 'Digital', g: null, gt: 'Aufnahme in der Brille', gs: 'in der Brille', s: 'DVR in der Brille, gut zum Auswerten. Für Filme eine zusätzliche HD-Kamera mitnehmen.', gy: 'nein', k: ['whoop', 'cine', 'fuenf'] },
    { n: 'Insta360 X6', t: '360 Grad', g: 196, gt: '196 g', s: 'Seit August 2026: 8K50 rundum, Einzellinse bis 5K60, I-Log', gy: '360', k: ['fuenf', 'lr'] },
    { n: 'Insta360 X5', t: '360 Grad', g: 201, gt: '201 g', s: '8K rundum, austauschbare Linsen', gy: '360', k: ['fuenf', 'lr'] },
    { n: 'GoPro Max 2', t: '360 Grad', g: 195, gt: '195 g', s: 'Seit September 2025: 8K30 rundum, 5.6K60, austauschbare Linsen. Keine ND-Filter von GoPro.', gy: '360', k: ['fuenf', 'lr'] },
    { n: 'DJI Avata 360', t: '360-Grad-Drohne', g: null, gt: 'etwa 455 g, komplette Drohne', gs: 'ganze Drohne', s: 'Seit März 2026: 8K60 rundum, Einzellinse 4K60, Reframing in DJI Fly und DJI Studio. Gyroflow liest nur die Bewegungsdaten und spielt das Video nicht ab.', gy: '360', k: [] }
  ];
  function shelf() {
    const list = $('#fm-shelf'); if (!list) return;
    const say = $('#fm-shelf-say'), sort = $('#fm-sort'), root = list.closest('.fm-shelf'), card = $('#fm-cam-card');
    const GY = { ja: ['green', 'Gyroflow: ja'], nein: ['', 'Gyroflow: nein'], '360': ['sig', 'Reframen in der App'] };
    const KL = { whoop: 'Tiny Whoop', cine: 'Cinewhoop', fuenf: '5 Zoll', lr: 'Long Range' };
    const SAY = {
      alle: 'Alle 17 Kameras, der Balken zeigt das Gewicht. Wähl eine Kopter-Klasse, um zu sehen, was passt.',
      whoop: 'Tiny Whoops tragen praktisch keine Extra-Kamera. Gefilmt wird mit dem Videosystem selbst, etwa der <b>DJI O4 Air Unit</b>, oder mit dem DVR der Brille.',
      cine: 'Cinewhoops brauchen leichte Kameras: Mini-HD, Naked GoPro oder ein digitales System mit eigener Aufnahme.',
      fuenf: '5 Zoll trägt fast alles, auch eine volle Action-Cam. Achte auf die Startmasse: Ab 250 Gramm ist laut Bundesverkehrsministerium ein Kompetenznachweis Pflicht.',
      lr: 'Bei Long Range zählen Bildqualität und Laufzeit. Eine volle Action-Cam oder ein 360-Grad-Modell ist hier gut aufgehoben.'
    };
    const MAXG = Math.max(...CAMS.map(c => c.g || 0));
    const info = c => {
      const gy = GY[c.gy], fits = c.k.map(k => KL[k]).join(', ');
      return `<p class="fm-cc-t"><span class="tag">${esc(c.t)}</span><span class="tag ${gy[0]}">${gy[1]}</span></p>` +
        `<p class="fm-cc-n">${esc(c.n)}</p><p class="fm-cc-w"><b>${esc(c.gt)}</b></p><p class="fm-cc-s">${esc(c.s)}</p>` +
        `<p class="fm-cc-k"><span>Passt zu</span> ${fits ? esc(fits) : 'eigene Drohne, keine Extra-Kamera'}</p>`;
    };
    let shown = false, cur = CAMS[0].n, demo = null;
    const byName = n => CAMS.find(c => c.n === n);
    function show(n, open) {
      const c = byName(n); if (!c) return;
      cur = n;
      if (card) card.innerHTML = info(c);
      $$('.fm-cam', list).forEach(b => {
        const on = b.dataset.n === n; b.classList.toggle('sel', on);
        if (open !== undefined) { const li = b.parentElement; const o = on && open; li.classList.toggle('open', o); b.setAttribute('aria-expanded', o); }
      });
    }
    function render() {
      const by = sort.value, arr = CAMS.slice();
      if (by === 'g') arr.sort((a, b) => (a.g == null) - (b.g == null) || (a.g || 0) - (b.g || 0));
      if (by === 'n') arr.sort((a, b) => a.n.localeCompare(b.n, 'de'));
      if (by === 't') arr.sort((a, b) => a.t.localeCompare(b.t, 'de') || (a.g || 999) - (b.g || 999));
      list.innerHTML = arr.map((c, i) => {
        const w = c.g == null ? 0 : c.g / MAXG;
        return `<li><button type="button" class="fm-cam" data-n="${esc(c.n)}" data-k="${c.k.join(' ')}" aria-expanded="false" aria-controls="fm-cx-${i}">` +
          `<span class="fm-cam-n">${esc(c.n)}<small>${esc(c.t)}</small></span>` +
          `<span class="fm-cam-w">${c.g == null ? `<em>${esc(c.gs || c.gt)}</em>` : `<i style="--w:${shown ? w.toFixed(3) : 0}" data-w="${w.toFixed(3)}"></i>`}</span>` +
          `<span class="fm-cam-g">${c.g == null ? '' : de(c.g, c.g % 1 ? 1 : 0) + '&nbsp;g'}</span></button>` +
          `<div class="fm-cam-x" id="fm-cx-${i}">${info(c)}</div></li>`;
      }).join('');
      $$('.fm-cam', list).forEach(b => {
        b.addEventListener('click', () => { stopDemo(); const li = b.parentElement; show(b.dataset.n, !li.classList.contains('open')); });
        b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { stopDemo(); show(b.dataset.n); } });
        b.addEventListener('focus', () => show(b.dataset.n));
      });
      filter(); show(cur);
    }
    function filter() {
      const k = radioVal('klasse'); let n = 0, first = null;
      $$('.fm-cam', list).forEach(b => { const fit = k === 'alle' || b.dataset.k.split(' ').includes(k); b.parentElement.classList.toggle('off', !fit); b.parentElement.classList.toggle('fit', fit && k !== 'alle'); if (fit) { n++; if (!first) first = b.dataset.n; } });
      say.innerHTML = SAY[k] + (k !== 'alle' ? ` <b>${n} passen.</b>` : '');
      return first;
    }
    const grow = () => { shown = true; $$('.fm-cam-w i', list).forEach(i => i.style.setProperty('--w', i.dataset.w)); };
    $$('input[name=klasse]').forEach(r => r.addEventListener('change', () => { const f = filter(); const c = byName(cur); if (f && c && radioVal('klasse') !== 'alle' && !c.k.includes(radioVal('klasse'))) show(f); }));
    sort.addEventListener('change', () => { render(); if (shown) requestAnimationFrame(grow); });
    render();
    onVis(list, v => { if (v && !shown) setTimeout(grow, 200); }, '-10% 0px');
    const ks = ['alle', 'whoop', 'cine', 'fuenf', 'lr']; let i = 0;
    const st = auto(root, () => { i = (i + 1) % ks.length; setRadio('klasse', ks[i]); }, 2800, $('.fm-hint-shelf'));
    // Selbst-Impuls: die Detailkarte wandert durch die Kameras, bis jemand eingreift
    let j = 0, seen = false;
    onVis(root, v => { seen = v; }, '0px');
    if (!RM) demo = setInterval(() => { if (!st.on || !seen || document.hidden) return; const vis = $$('li:not(.off) .fm-cam', list); if (vis.length) show(vis[(j++) % vis.length].dataset.n); }, 1400);
    function stopDemo() { if (demo) { clearInterval(demo); demo = null; } st.stop(); }
  }

  /* =========================================================
     03 SHUTTER-SIMULATOR
     ========================================================= */
  function shutterSim() {
    const cv = $('#fm-sim-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), root = cv.closest('.fm-sim');
    const angIn = $('#fm-sim-ang'), say = $('#fm-sim-say'), sector = $('#fm-sim-sector');
    const acc = document.createElement('canvas'), ax = acc.getContext('2d');
    const smp = document.createElement('canvas'), sx = smp.getContext('2d');
    let fps = 25, angle = 180, W = 0, H = 0, lastK = -1, maxN = 16;
    const toAng = (v) => 11.25 * Math.pow(2, v);
    // Skala unter dem Regler
    const ticks = $('#fm-sim-ah');
    if (ticks) { const mn = +angIn.min, mx = +angIn.max; ticks.innerHTML = [0, 1, 2, 3, 4, 5].map(v => `<span style="left:${((v - mn) / (mx - mn) * 100).toFixed(1)}%">${Math.round(toAng(v))}°</span>`).join(''); }
    function size() {
      sizeCanvas(cv, 960, 16 / 9); W = cv.width; H = cv.height;
      acc.width = smp.width = W; acc.height = smp.height = H; maxN = W < 800 ? 10 : 16; lastK = -1;
    }
    // Szene: Abendhimmel, Hügel, Bäume, ein LED-Gate und Masten im Vordergrund
    function scene(c, t) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1d3f'); g.addColorStop(.5, '#2b4f88'); g.addColorStop(.72, '#d9864c'); g.addColorStop(.8, '#5a3a35'); g.addColorStop(1, '#141f1a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sun = c.createRadialGradient(W * .72, H * .66, 0, W * .72, H * .66, H * .35); sun.addColorStop(0, 'rgba(255,214,140,.95)'); sun.addColorStop(.25, 'rgba(255,170,90,.45)'); sun.addColorStop(1, 'rgba(255,150,80,0)');
      c.fillStyle = sun; c.fillRect(0, 0, W, H);
      // Hügel (langsam)
      const o1 = (t * W * .05) % W;
      c.fillStyle = '#1a2c4c'; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 24; x += 24) c.lineTo(x, H * .66 + Math.sin((x + o1) / W * Math.PI * 4) * H * .045 + Math.sin((x + o1) / W * Math.PI * 10) * H * .015);
      c.lineTo(W, H); c.fill();
      // Boden
      c.fillStyle = '#0f2219'; c.fillRect(0, H * .8, W, H * .2);
      c.strokeStyle = 'rgba(120,200,150,.18)'; c.lineWidth = Math.max(1, W / 480);
      const o2 = (t * W * 1.2) % (W * .12);
      for (let x = -W * .12; x < W * 1.2; x += W * .12) { c.beginPath(); c.moveTo(x - o2, H * .8); c.lineTo(x - o2 - W * .2, H); c.stroke(); }
      // Bäume (mittel)
      const sp = W * .2, o3 = (t * W * .35) % sp;
      c.fillStyle = '#0c1d17';
      for (let x = -sp; x < W + sp; x += sp) { const X = x - o3 + sp * .5, b = H * .8; c.beginPath(); c.moveTo(X, b - H * .32); c.lineTo(X - W * .045, b); c.lineTo(X + W * .045, b); c.fill(); c.fillRect(X - W * .006, b - H * .02, W * .012, H * .04); }
      // LED-Gate (schnell)
      const P = 1.7, ph = (t % P) / P, gx = lerp(W * 1.35, -W * .45, ph), gw = W * .3, gh = H * .44, gy = H * .86 - gh;
      c.lineWidth = Math.max(4, W / 90); c.strokeStyle = '#ffb020'; c.shadowColor = '#ffb020'; c.shadowBlur = W / 60;
      c.strokeRect(gx - gw / 2, gy, gw, gh);
      c.shadowBlur = 0; c.fillStyle = '#fff3c4';
      for (let i = 0; i <= 10; i++) { c.fillRect(gx - gw / 2 + gw * i / 10 - 2, gy - 2, 4, 4); c.fillRect(gx - gw / 2 + gw * i / 10 - 2, gy + gh - 2, 4, 4); }
      // Masten im Vordergrund (sehr schnell)
      const sp2 = W * .75, o4 = (t * W * 2.6) % sp2;
      c.fillStyle = '#05080f';
      for (let x = -sp2; x < W + sp2; x += sp2) { const X = x - o4 + sp2 * .3; c.fillRect(X, 0, W * .028, H); }
    }
    function capture(tk, e) {
      const N = clamp(Math.ceil(2.6 * W * e / 3), 1, maxN);
      for (let i = 0; i < N; i++) {
        scene(sx, tk + (N > 1 ? e * i / (N - 1) : 0));
        ax.globalAlpha = 1 / (i + 1); ax.drawImage(smp, 0, 0);
      }
      ax.globalAlpha = 1; ctx.drawImage(acc, 0, 0);
    }
    function sectorPath(a) {
      const r = 46, h = Math.min(359.9, a) / 2 * Math.PI / 180, s = -Math.PI / 2 - h, en = -Math.PI / 2 + h;
      return `M0 0L${(Math.cos(s) * r).toFixed(2)} ${(Math.sin(s) * r).toFixed(2)}A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${(Math.cos(en) * r).toFixed(2)} ${(Math.sin(en) * r).toFixed(2)}Z`;
    }
    function readout() {
      const e = angle / 360 / fps, blur = 1.06 * (cv.clientWidth || 600) * e;
      $('[data-sim-fps]').textContent = fps + 'P'; $('[data-sim-sh]').textContent = shTxt(e); $('[data-sim-ang]').textContent = Math.round(angle) + '°';
      $('[data-sim-ang2]').textContent = Math.round(angle) + '°'; $('[data-sim-sh2]').textContent = shTxt(e) + ' s';
      sector.setAttribute('d', sectorPath(angle));
      let v, cls = '';
      if (angle >= 270) { v = '<b>Sehr weich:</b> Die Belichtung dauert fast so lang wie ein ganzes Bild. Details verschwimmen, das Bild wirkt verschmiert.'; cls = 'warn'; }
      else if (angle >= 135) v = '<b>Kino-Look:</b> natürliche Bewegungsunschärfe nach der 180-Grad-Regel. Braucht bei Sonne einen ND-Filter.';
      else if (angle >= 60) v = '<b>Etwas knackiger:</b> 90 Grad, die Empfehlung, wenn du später mit Gyroflow stabilisierst.';
      else if (angle >= 20) v = '<b>Scharfe Einzelbilder:</b> leichtes Stottern bei schnellen Objekten. Für Gyroflow sind 45 Grad noch in Ordnung.';
      else { v = '<b>Stroboskop-Effekt:</b> Jedes Bild gestochen scharf, die Bewegung wirkt abgehackt. So sieht FPV ohne ND-Filter in der Sonne aus.'; cls = 'bad'; }
      v += ` Gate-Unschärfe: etwa ${de(blur, 0)} Pixel pro Bild.`;
      if (fps >= 100) v += ' Hinweis: Dein Bildschirm zeigt höchstens seine eigene Bildrate.';
      say.className = 'fm-verdict ' + cls; say.innerHTML = v;
    }
    const redraw = loop(cv, (t) => {
      if (!W) size();
      const k = Math.floor(t * fps);
      if (k !== lastK) { lastK = k; capture(k / fps, angle / 360 / fps); }
      sector.setAttribute('transform', `rotate(${(t * 216) % 360})`);
    });
    const setAng = (a) => { angle = clamp(a, 8, 360); angIn.value = Math.log2(angle / 11.25).toFixed(2); lastK = -1; readout(); redraw(); };
    angIn.addEventListener('input', () => { angle = toAng(+angIn.value); lastK = -1; readout(); redraw(); });
    $$('input[name=simfps]').forEach(r => r.addEventListener('change', () => { fps = +radioVal('simfps'); lastK = -1; readout(); redraw(); }));
    $$('#fm-sim-pre [data-p]').forEach(b => b.addEventListener('click', () => { const [f, a] = b.dataset.p.split(',').map(Number); setRadio('simfps', f); fps = f; setAng(a); }));
    addEventListener('resize', () => { size(); redraw(); });
    size(); readout();
    const pre = [[25, 180], [50, 180], [50, 90], [50, 9], [24, 360]]; let i = 0;
    auto(root, () => { i = (i + 1) % pre.length; setRadio('simfps', pre[i][0]); fps = pre[i][0]; setAng(pre[i][1]); }, 3200, $('.fm-hint-sim'));
  }

  /* Zeitlupen-Rechner */
  function slowmo() {
    const a = $('#fm-slow-a'), b = $('#fm-slow-b'); if (!a) return;
    const f = $('#fm-slow-f'), t = $('#fm-slow-t'), barC = $('#fm-slow-bar'), barR = $('.fm-sb-r em'), root = a.closest('.fm-slow');
    let fac = 4;
    function upd() {
      fac = +a.value / +b.value;
      f.textContent = de(fac, fac % 1 ? 1 : 0) + '×';
      if (Math.abs(fac - 1) < .01) t.textContent = 'Echtzeit: Aufnahme und Timeline laufen gleich schnell.';
      else if (fac > 1) t.textContent = `langsamer, ${de(100 / fac, 0)} % Tempo. Aus 1 Sekunde Flug werden ${de(fac, 1)} Sekunden.`;
      else t.textContent = `schneller als echt. Die Timeline braucht mehr Bilder, als du aufgenommen hast: Nimm mindestens ${b.value} fps auf.`;
    }
    a.addEventListener('change', upd); b.addEventListener('change', upd); upd();
    const hint = addHint(root, 'Werte wählen');
    auto(root, null, 0, hint);
    // Selbst-Impuls: Abspielkopf läuft über echte Zeit und Clip-Zeit
    loop(root, (time) => {
      const L = 1.1 * Math.max(1, fac), c = RM ? 1 : clamp((time % (L + .6)) / L, 0, 1);
      if (fac >= 1) { barC.style.width = (c * 100) + '%'; barR.style.width = (Math.min(c, 1 / fac) * 100) + '%'; }
      else { barR.style.width = (c * 100) + '%'; barC.style.width = (Math.min(c, fac) * 100) + '%'; }
    });
  }

  /* Hallenlicht-Test: Flackern durch 50-Hz-Netz */
  function flicker() {
    const cv = $('#fm-flick-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), fpsS = $('#fm-fl-fps'), shS = $('#fm-fl-sh'), say = $('#fm-fl-say'), osd = $('[data-fl-osd]'), root = cv.closest('.fm-flick');
    const base = document.createElement('canvas'), bx = base.getContext('2d');
    let W = 0, H = 0, lastK = -1;
    function size() {
      sizeCanvas(cv, 720, 2); W = cv.width; H = cv.height; base.width = W; base.height = H; lastK = -1;
      // Halle: Decke mit Lichtbändern, Wand, Boden, zwei LED-Gates
      const g = bx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2333'); g.addColorStop(.45, '#2a3346'); g.addColorStop(.46, '#3b4458'); g.addColorStop(1, '#5a4a3a');
      bx.fillStyle = g; bx.fillRect(0, 0, W, H);
      bx.fillStyle = '#f4f7ff';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { const y = H * (.05 + r * .09), w = W * (.1 - r * .02), x = W * (.08 + i * .15) + r * W * .02; bx.globalAlpha = .95 - r * .2; bx.fillRect(x, y, w, H * (.03 - r * .006)); }
      bx.globalAlpha = 1;
      bx.strokeStyle = 'rgba(255,255,255,.15)'; bx.lineWidth = 2;
      for (let i = 0; i < 9; i++) { bx.beginPath(); bx.moveTo(W / 2, H * .46); bx.lineTo(i / 8 * W * 1.6 - W * .3, H); bx.stroke(); }
      bx.lineWidth = Math.max(4, W / 110); bx.strokeStyle = '#3fe0ff'; bx.strokeRect(W * .16, H * .5, W * .2, H * .3);
      bx.strokeStyle = '#ffb020'; bx.strokeRect(W * .62, H * .55, W * .16, H * .24);
    }
    // Mittlere Lichtstärke einer 100-Hz-flackernden Lampe zwischen a und b (Sekunden)
    const w = 100 * Math.PI, m = .7;
    const F = (x) => { const k = Math.floor(x / Math.PI); return 2 * k + (1 - Math.cos(x - Math.PI * k)); };
    const avgL = (a, b) => (1 - m) + m * (Math.PI / 2) * (F(w * b) - F(w * a)) / w / (b - a);
    const st = () => { const fps = +fpsS.value; let sh = +shS.value; const e = Math.min(1 / sh, 1 / fps); return { fps, e, sh }; };
    function say2() {
      const { fps, e, sh } = st(); const k = e * 100, whole = Math.abs(k - Math.round(k)) < .02 && Math.round(k) >= 1;
      osd.textContent = `${fps}P · ${shTxt(e)}`;
      let v, cls = '';
      if (1 / sh > 1 / fps) v = `<b>Geht nicht:</b> Der Shutter kann nicht länger dauern als ein Bild. Die Kamera nimmt dann ${shTxt(1 / fps)}. `; else v = '';
      if (whole) v += '<b>Flackerfrei:</b> Die Belichtung umfasst ganze Lichtzyklen von 1/100 s. Genau so filmen wir beim Hallenfliegen.';
      else if (Number.isInteger(100 / fps)) { v += '<b>Stehende Streifen:</b> Die Bildrate passt zum Netz, der Shutter nicht. Nimm 1/50 oder 1/100.'; cls = 'warn'; }
      else { v += '<b>Laufende Streifen und Flackern:</b> Weder Bildrate noch Shutter passen zum 50-Hz-Netz. In Deutschland 25, 50 oder 100 fps mit 1/50 oder 1/100 wählen.'; cls = 'bad'; }
      say.className = 'fm-verdict ' + cls; say.innerHTML = v; lastK = -1;
    }
    const redraw = loop(cv, (t) => {
      if (!W) size();
      const { fps, e } = st(), k = Math.floor(t * fps);
      if (k === lastK) return; lastK = k;
      ctx.drawImage(base, 0, 0);
      const t0 = k / fps + 3, ro = Math.min(.75 / fps, 1 / 60), step = Math.max(2, Math.round(H / 140));
      for (let y = 0; y < H; y += step) {
        const tr = t0 + (y / H) * ro, B = avgL(tr, tr + e);
        if (B < 1) { ctx.fillStyle = `rgba(0,0,0,${((1 - B) * .9).toFixed(3)})`; ctx.fillRect(0, y, W, step); }
        else if (B > 1.01) { ctx.fillStyle = `rgba(255,236,200,${((B - 1) * .4).toFixed(3)})`; ctx.fillRect(0, y, W, step); }
      }
    });
    fpsS.addEventListener('change', () => { say2(); redraw(); }); shS.addEventListener('change', () => { say2(); redraw(); });
    addEventListener('resize', () => { size(); redraw(); });
    size(); say2();
    const combos = [[30, 120], [50, 100], [60, 60], [25, 50], [50, 200], [100, 100]]; let i = 0;
    auto(root, () => { i = (i + 1) % combos.length; fpsS.value = combos[i][0]; shS.value = combos[i][1]; say2(); redraw(); }, 2800, $('.fm-hint-fl'));
  }

  /* =========================================================
     04 ND-RECHNER mit Filterrad und Zebra-Vorschau
     ========================================================= */
  function nd() {
    const cv = $('#fm-nd-cv'); if (!cv) return;
    const ctx = cv.getContext('2d', { willReadFrequently: true }), hc = $('#fm-nd-h'), hx = hc.getContext('2d');
    const fpsS = $('#fm-nd-fps'), styS = $('#fm-nd-sty'), apS = $('#fm-nd-ap'), wheel = $('#fm-wheel'), root = cv.closest('.fm-ndcalc');
    const recEl = $('#fm-nd-rec'), txt = $('#fm-nd-txt'), osd = $('[data-nd-osd]'), expEl = $('[data-nd-exp]'), zebL = $('.fm-nd-zeb');
    let base = null, W = 0, H = 0, sel = 5, rec = null, offE = 0, zebra = 0, ph = 0;
    const STEP = 360 / 7, DARK = [0, .25, .4, .55, .68, .8, .88];
    // Filterrad aufbauen
    const rot = document.createElement('div'); rot.className = 'fm-wh-rot'; wheel.appendChild(rot);
    const discs = NDN.map((n, i) => { const d = document.createElement('div'); d.className = 'fm-wh-f'; d.textContent = i ? n : 'OHNE'; d.style.background = `rgba(2,4,8,${DARK[i]})`; if (!i) d.style.borderStyle = 'dashed'; d.dataset.i = i; rot.appendChild(d); return d; });
    const wr = { r: -sel * STEP };
    const place = () => {
      const R = wheel.clientWidth * .35;
      rot.style.transform = `rotate(${wr.r}deg)`;
      discs.forEach((d, i) => { const a = i * STEP; d.style.transform = `rotate(${a}deg) translateY(${-R}px) rotate(${-a - wr.r}deg)`; });
    };
    function select(i, anim) {
      sel = ((i % 7) + 7) % 7;
      let target = -sel * STEP; while (target - wr.r > 180) target -= 360; while (target - wr.r < -180) target += 360;
      if (anim && hasG() && !RM) gsap.to(wr, { r: target, duration: .6, ease: 'back.out(1.4)', onUpdate: place }); else { wr.r = target; place(); }
      discs.forEach((d, k) => d.classList.toggle('on', k === sel));
      wheel.setAttribute('aria-valuenow', sel); wheel.setAttribute('aria-valuetext', sel ? NDN[sel] : 'Ohne Filter');
      expo();
    }
    function calc() {
      const EV = +radioVal('ndl'), fps = +fpsS.value, ang = +styS.value, N = +apS.value;
      rec = ndRec(EV, fps, ang, N);
      recEl.textContent = rec.name;
      let s;
      if (rec.i) s = `Shutter ${shTxt(rec.t)} s bei ISO ${rec.iso}` + (rec.t < rec.tT * .8 ? `. Für ${shTxt(rec.tT)} bräuchtest du einen noch stärkeren Filter.` : '.');
      else if (rec.s >= 0) s = `Kein Filter nötig. Shutter ${shTxt(rec.t)} s bei ISO 100, etwas kürzer als das Ziel ${shTxt(rec.tT)}.`;
      else s = `Kein Filter. Für ${shTxt(rec.tT)} s braucht es ISO ${rec.iso}` + (rec.iso > 1600 ? ', rechne mit Rauschen.' : '.');
      txt.textContent = s;
      discs.forEach((d, k) => d.classList.toggle('rec', k === rec.i));
      expo();
    }
    function expo() {
      if (!rec) return;
      offE = clamp(rec.s - NDS[sel], -4, 5);
      osd.textContent = `${shTxt(rec.tT)} · ${sel ? NDN[sel] : 'OHNE ND'} · ISO 100`;
      expEl.className = Math.abs(offE) <= .5 ? '' : offE > 0 ? 'over' : 'under';
      expEl.textContent = Math.abs(offE) <= .5 ? 'BELICHTUNG OK' : offE > 0 ? `+${de(offE, 1)} EV ZU HELL` : `${de(offE, 1)} EV ZU DUNKEL`;
      render();
    }
    function render() {
      if (!base) return;
      const g = Math.pow(2, offE), lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) lut[v] = Math.pow(Math.min(1, Math.pow(v / 255, 2.2) * g), 1 / 2.2) * 255;
      const src = base.data, out = ctx.createImageData(W, H), d = out.data, hist = new Uint32Array(64);
      let z = 0;
      for (let i = 0, p = 0; i < src.length; i += 4, p++) {
        const r = lut[src[i]], gg = lut[src[i + 1]], b = lut[src[i + 2]];
        hist[((r * 77 + gg * 151 + b * 28) >> 8) >> 2]++;
        if (r > 250 || gg > 250 || b > 250) { z++; const x = p % W, y = (p / W) | 0; const s = ((x + y + ph) >> 3) & 1; d[i] = d[i + 1] = d[i + 2] = s ? 255 : 40; }
        else { d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
        d[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      zebra = z / (W * H); zebL.style.opacity = zebra > .002 ? 1 : 0;
      const mx = Math.max(...hist) || 1; hx.clearRect(0, 0, 160, 56); hx.fillStyle = 'rgba(234,244,255,.8)';
      for (let i = 0; i < 64; i++) { const h = hist[i] / mx * 52; hx.fillRect(i * 2.5, 56 - h, 2, h); }
      if (hist[63] > W * H * .01) { hx.fillStyle = '#ffb020'; hx.fillRect(156, 0, 4, 56); }
    }
    function size() {
      sizeCanvas(cv, 720, 16 / 9); W = cv.width; H = cv.height;
      return img('media/turm.webp').then(im => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); base = x.getImageData(0, 0, W, H); render(); });
    }
    // Zebra-Streifen laufen, wenn etwas ausfrisst
    let lastZ = 0;
    loop(cv, (t) => { if (zebra > .002 && t - lastZ > .09) { lastZ = t; ph = (ph + 2) % 16; render(); } });
    // Bedienung Filterrad: antippen, ziehen, Pfeiltasten
    let drag = null;
    const angOf = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
    wheel.addEventListener('pointerdown', e => { drag = { a: angOf(e), r: wr.r, moved: 0, target: e.target.closest('.fm-wh-f') }; wheel.setPointerCapture(e.pointerId); if (hasG()) gsap.killTweensOf(wr); });
    wheel.addEventListener('pointermove', e => { if (!drag) return; let d = angOf(e) - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360; drag.moved = Math.max(drag.moved, Math.abs(d)); wr.r = drag.r + d; place(); });
    const end = () => { if (!drag) return; const dd = drag; drag = null; if (dd.moved < 4 && dd.target) select(+dd.target.dataset.i, true); else select(Math.round(-wr.r / STEP), true); };
    wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);
    wheel.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (k) { e.preventDefault(); select(clamp(sel + k, 0, 6), true); } if (e.key === 'Home') select(0, true); if (e.key === 'End') select(6, true); });
    [fpsS, styS, apS].forEach(s => s.addEventListener('change', calc));
    $$('input[name=ndl]').forEach(r => r.addEventListener('change', calc));
    addEventListener('resize', () => { place(); size(); });
    FM.ndSet = ({ fps, ang, ap }) => {
      if ([...fpsS.options].some(o => +o.value === fps)) fpsS.value = String(fps);
      styS.value = ang <= 90 ? '90' : '180';
      apS.value = ap <= 2.2 ? '2' : ap <= 2.6 ? '2.5' : '2.8';
      setRadio('ndl', '15'); calc(); select(rec.i, true); if (ndAuto) ndAuto.stop();
    };
    place(); calc(); select(rec.i, false); size();
    const lights = ['15', '16', '14', '13', '12', '10']; let li = 0;
    const ndAuto = auto(root, () => { li = (li + 1) % lights.length; setRadio('ndl', lights[li]); select(rec.i, true); }, 2900, $('.fm-hint-nd'));
  }

  /* =========================================================
     05 FOV-VISUALIZER: Sichtfeld, Krümmung, Horizont-Lock
     ========================================================= */
  function fov() {
    const cv = $('#fm-fov-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), fS = $('#fm-fov-f'), dS = $('#fm-fov-d'), rollC = $('#fm-fov-roll'), lockC = $('#fm-fov-lock'), view = cv.closest('.fm-fov-view'), root = cv.closest('.fm-fov');
    const OW = 640, OH = 360, SW = 960, SH = 540, S = 165 * Math.PI / 180;
    cv.width = OW; cv.height = OH;
    const out = ctx.createImageData(OW, OH), o32 = new Uint32Array(out.data.buffer);
    let src32 = null, p = { F: 150, d: 1, hs: 0, vz: 1 }, dirty = true, roll = 0;
    const PRE = { fish: { F: 155, d: 1, hs: 0, vz: 1, n: 'FISCHAUGE' }, wide: { F: 128, d: .7, hs: 0, vz: 1, n: 'WIDE' }, super: { F: 150, d: .85, hs: .2, vz: 1.15, n: 'SUPERVIEW-STIL' }, lin: { F: 92, d: 0, hs: 0, vz: 1, n: 'LINEAR' } };
    let mName = 'FISCHAUGE';
    function load(srcUrl) {
      return img(srcUrl).then(im => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; const x = c.getContext('2d'); x.drawImage(im, 0, 0, SW, SH); src32 = new Uint32Array(x.getImageData(0, 0, SW, SH).data.buffer.slice(0)); dirty = true; redraw(); });
    }
    function render() {
      if (!src32) return;
      const F = p.F * Math.PI / 180, d = p.d, tf = Math.tan(F / 2), RM_ = 2.2, TN = 2048, T = new Float32Array(TN);
      for (let i = 0; i < TN; i++) { const r = i / (TN - 1) * RM_; const th = lerp(Math.atan(r * tf), r * F / 2, d); T[i] = th / (S / 2); }
      const lock = lockC.checked, rolling = rollC.checked, R = lock ? 0 : roll, cr = Math.cos(R), sr = Math.sin(R), z = rolling ? .8 : 1;
      const hw = OW / 2, hs = p.hs, vz = p.vz, black = 0xff0b0705;
      for (let y = 0; y < OH; y++) {
        for (let x = 0; x < OW; x++) {
          let u = (x - hw) / hw * z, v = (y - OH / 2) / hw * z;
          const ru = u * cr - v * sr, rv = u * sr + v * cr; u = ru; v = rv;
          if (hs) u = u * (1 - hs * u * u);
          v *= vz;
          const rho = Math.sqrt(u * u + v * v);
          let idx = 0;
          if (rho > 0) {
            const ti = rho / RM_ * (TN - 1); const rs = ti >= TN - 1 ? 9 : T[ti | 0];
            const k = rs / rho, xs = (SW / 2 + u * k * SW / 2) | 0, ys = (SH / 2 + v * k * SW / 2) | 0;
            o32[y * OW + x] = (xs < 0 || ys < 0 || xs >= SW || ys >= SH) ? black : src32[ys * SW + xs];
          } else o32[y * OW + x] = src32[(SH / 2 | 0) * SW + (SW / 2 | 0)];
        }
      }
      ctx.putImageData(out, 0, 0);
      // Horizont-Lock: Rand, der beim Geraderichten verloren geht
      if (lock && rolling) {
        const a = .3, s = 1 / ((OW / OH) * Math.sin(a) + Math.cos(a)), w = OW * s, h = OH * s, x0 = (OW - w) / 2, y0 = (OH - h) / 2;
        ctx.fillStyle = 'rgba(2,5,12,.62)'; ctx.fillRect(0, 0, OW, y0); ctx.fillRect(0, y0 + h, OW, OH - y0 - h); ctx.fillRect(0, y0, x0, h); ctx.fillRect(x0 + w, y0, OW - x0 - w, h);
        ctx.setLineDash([8, 6]); ctx.strokeStyle = '#3fe0ff'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
        ctx.fillStyle = '#3fe0ff'; ctx.font = '600 13px "Chakra Petch", monospace'; ctx.fillText('CROP ' + Math.round((1 - s * s) * 100) + ' %', x0 + 8, y0 + 18);
      }
      $('[data-fov-v]').textContent = Math.round(p.F) + '°'; $('[data-fov-m]').textContent = mName;
      $('[data-fov-v2]').textContent = Math.round(p.F) + '°'; $('[data-fov-d]').textContent = Math.round(p.d * 100) + ' %';
      view.classList.toggle('lock', lock && rolling);
    }
    const redraw = loop(cv, (t) => {
      if (rollC.checked) { roll = .3 * Math.sin(t * .9); dirty = true; }
      if (dirty) { dirty = false; render(); }
    });
    const setP = (q, anim) => {
      mName = q.n || mName;
      if (anim && hasG() && !RM) gsap.to(p, { F: q.F, d: q.d, hs: q.hs, vz: q.vz, duration: .9, ease: 'power2.inOut', onUpdate: () => { fS.value = p.F; dS.value = p.d * 100; dirty = true; redraw(); } });
      else { Object.assign(p, { F: q.F, d: q.d, hs: q.hs, vz: q.vz }); fS.value = p.F; dS.value = p.d * 100; dirty = true; redraw(); }
    };
    $$('input[name=fovm]').forEach(r => r.addEventListener('change', () => setP(PRE[r.value], true)));
    fS.addEventListener('input', () => { if (hasG()) gsap.killTweensOf(p); p.F = +fS.value; mName = 'EIGENE'; $$('input[name=fovm]').forEach(r => { r.checked = false; }); dirty = true; redraw(); });
    dS.addEventListener('input', () => { if (hasG()) gsap.killTweensOf(p); p.d = +dS.value / 100; p.hs = 0; p.vz = 1; mName = 'EIGENE'; $$('input[name=fovm]').forEach(r => { r.checked = false; }); dirty = true; redraw(); });
    [rollC, lockC].forEach(c => c.addEventListener('change', () => { if (!rollC.checked) roll = 0; if (lockC.checked && !rollC.checked && c === lockC) { rollC.checked = true; } dirty = true; redraw(); }));
    $$('input[name=fovi]').forEach(r => r.addEventListener('change', () => load(r.value)));
    setP(PRE.fish, false); load('media/gang.webp');
    const steps = [() => setRadio('fovm', 'wide'), () => setRadio('fovm', 'super'), () => setRadio('fovm', 'lin'), () => { rollC.checked = true; dirty = true; }, () => { lockC.checked = true; dirty = true; }, () => { lockC.checked = false; rollC.checked = false; roll = 0; setRadio('fovm', 'fish'); dirty = true; }];
    let i = -1;
    auto(root, () => { i = (i + 1) % steps.length; steps[i](); redraw(); }, 2700, $('.fm-hint-fov'));
  }

  /* =========================================================
     06 STABILISIERUNG: Wackel-Demo mit Gyro-Kurven
     ========================================================= */
  function shake() {
    const cv = $('#fm-sh-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), sc = $('#fm-sh-sensor'), sx = sc.getContext('2d'), gc = $('#fm-sh-gyro'), gx = gc.getContext('2d');
    const sS = $('#fm-sh-s'), hC = $('#fm-sh-h'), bC = $('#fm-sh-b'), say = $('#fm-sh-say'), root = cv.closest('.fm-shake');
    let im = null, W = 0, H = 0, mode = 'raw', sm = .5;
    const hist = []; let prev = null;
    const low = (t) => ({ x: .03 * Math.sin(.7 * t) + .012 * Math.sin(1.9 * t + 1), y: .02 * Math.sin(.9 * t + .5) + .01 * Math.sin(2.3 * t), r: .1 * Math.sin(.5 * t) + .04 * Math.sin(1.3 * t + 2) });
    const high = (t) => ({ x: .012 * Math.sin(23 * t) + .008 * Math.sin(37 * t + 2) + .006 * Math.sin(51 * t + 1), y: .01 * Math.sin(29 * t + 1) + .007 * Math.sin(43 * t), r: .02 * Math.sin(19 * t) + .012 * Math.sin(31 * t + 1) });
    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, r: a.r + b.r });
    const Z0 = 1.5;
    function size() { sizeCanvas(cv, 900, 16 / 9); W = cv.width; H = cv.height; sizeCanvas(sc, 320, 16 / 9); gc.width = Math.round((gc.clientWidth || 200) * DPR); gc.height = Math.round((gc.clientHeight || 60) * DPR); }
    function draw(c, w, h, x, y, r, z) { c.setTransform(1, 0, 0, 1, 0, 0); c.translate(w / 2 + x * w, h / 2 + y * w); c.rotate(r); c.scale(z, z); c.drawImage(im, -w / 2, -h / 2, w, h); c.setTransform(1, 0, 0, 1, 0, 0); }
    function state(t) {
      const L = low(t), Hh = high(t), raw = add(L, Hh), lock = hC.checked;
      let sh, crop;
      if (mode === 'raw') { sh = raw; crop = 0; }
      else if (mode === 'cam') { sh = { x: L.x * .8 + Hh.x * .18, y: L.y * .8 + Hh.y * .18, r: lock ? 0 : L.r * .85 + Hh.r * .2 }; crop = .1 + (lock ? .12 : 0); }
      else { const k = 1 - sm * .85; sh = { x: L.x * k + Hh.x * .03, y: L.y * k + Hh.y * .03, r: lock ? 0 : L.r * (1 - sm * .7) + Hh.r * .03 }; crop = .06 + sm * .12 + (lock ? .16 : 0); }
      return { raw, sh, crop };
    }
    function frame(t) {
      if (!im) return;
      const { raw, sh, crop } = state(t), z = Z0 * (1 + crop), long = bC.checked, e = long ? 1 / 50 : 1 / 200, N = long ? 8 : 2;
      for (let i = 0; i < N; i++) {
        const tau = e * i / (N - 1), R2 = add(low(t + tau), high(t + tau));
        ctx.globalAlpha = 1 / (i + 1);
        draw(ctx, W, H, sh.x + (R2.x - raw.x), sh.y + (R2.y - raw.y), sh.r + (R2.r - raw.r), z);
      }
      ctx.globalAlpha = 1;
      // Sensor-Ansicht mit Ausschnitt
      const sw = sc.width, shh = sc.height;
      draw(sx, sw, shh, raw.x, raw.y, raw.r, Z0);
      sx.save(); sx.translate(sw / 2 + (sh.x - raw.x) * -sw, shh / 2 + (sh.y - raw.y) * -sw); sx.rotate(raw.r - sh.r);
      const cw = sw / (1 + crop), ch = shh / (1 + crop);
      sx.strokeStyle = mode === 'raw' ? 'rgba(255,255,255,.7)' : '#3fe0ff'; sx.lineWidth = Math.max(1.5, sw / 160); sx.setLineDash([6, 4]); sx.strokeRect(-cw / 2, -ch / 2, cw, ch); sx.restore(); sx.setLineDash([]);
      // Gyro-Kurven
      if (prev) { hist.push([(raw.x - prev.x) * 27, (raw.y - prev.y) * 27, (raw.r - prev.r) * 30]); if (hist.length > 150) hist.shift(); }
      prev = raw;
      const gw = gc.width, gh = gc.height; gx.clearRect(0, 0, gw, gh);
      ['#3fe0ff', '#ffb020', '#3ee08a'].forEach((col, a) => {
        gx.strokeStyle = col; gx.lineWidth = Math.max(1, DPR); gx.beginPath();
        hist.forEach((v, i) => { const X = i / 149 * gw, Y = gh / 2 - clamp(v[a] * gh, -gh / 2 + 1, gh / 2 - 1); i ? gx.lineTo(X, Y) : gx.moveTo(X, Y); });
        gx.stroke();
      });
      gx.fillStyle = 'rgba(255,255,255,.75)'; gx.font = `600 ${Math.round(10 * DPR)}px "Chakra Petch", monospace`; gx.fillText('GYRO', 6 * DPR, 13 * DPR);
      $('[data-sh-crop]').textContent = Math.round(crop * 100) + ' %';
    }
    function sayIt() {
      const lock = hC.checked, long = bC.checked;
      $('[data-sh-mode]').textContent = { raw: 'ROH', cam: 'IN DER KAMERA', gyro: 'GYROFLOW' }[mode];
      $('[data-sh-s]').textContent = Math.round(sm * 100) + ' %';
      let v = { raw: '<b>Roh:</b> Jedes Zittern der Propeller landet im Bild. So sieht Material aus, bevor Gyroflow es bearbeitet.', cam: '<b>In der Kamera:</b> Das grobe Wackeln ist weg, bei harten Manövern bleiben Reste. Was abgeschnitten wurde, ist für immer weg.', gyro: '<b>Gyroflow:</b> ruhig wie auf Schienen. Mehr Glättung bedeutet mehr Zuschnitt.' }[mode];
      if (lock && mode !== 'raw') v += ' Horizont gesperrt: kostet zusätzlich Rand.';
      let cls = '';
      if (long && mode !== 'raw') { v += ' <b>Achtung:</b> Die Unschärfe aus der langen Belichtung zittert weiter, obwohl das Bild ruhig ist. Darum 45 bis 90 Grad Shutter.'; cls = 'warn'; }
      say.className = 'fm-verdict ' + cls; say.innerHTML = v;
    }
    const redraw = loop(cv, (t) => { if (!W) size(); frame(t); });
    $$('input[name=shm]').forEach(r => r.addEventListener('change', () => { mode = r.value; sayIt(); redraw(); }));
    sS.addEventListener('input', () => { sm = +sS.value / 100; sayIt(); redraw(); });
    [hC, bC].forEach(c => c.addEventListener('change', () => { sayIt(); redraw(); }));
    addEventListener('resize', () => { size(); redraw(); });
    size(); sayIt();
    img('media/g/lp7.webp').then(i => { im = i; redraw(); }).catch(() => {});
    const seq = [() => setRadio('shm', 'cam'), () => setRadio('shm', 'gyro'), () => { hC.checked = true; sayIt(); }, () => { bC.checked = true; sayIt(); }, () => { hC.checked = false; bC.checked = false; setRadio('shm', 'raw'); sayIt(); }];
    let i = -1;
    auto(root, () => { i = (i + 1) % seq.length; seq[i](); redraw(); }, 3200, $('.fm-hint-sh'));
  }

  /* =========================================================
     07 FARBE: Vorher/Nachher, Weißabgleich, 8 gegen 10 Bit
     ========================================================= */
  function beforeAfter() {
    const v = $('#fm-ba'); if (!v) return;
    const knob = $('#fm-ba-knob'), lab = $('[data-ba-lut]'), root = v.closest('.fm-ba');
    let x = 50, drag = false;
    const set = (q) => { x = clamp(q, 0, 100); v.style.setProperty('--x', x.toFixed(2) + '%'); knob.setAttribute('aria-valuenow', Math.round(x)); };
    const fromEvt = (e) => { const r = v.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
    v.addEventListener('pointerdown', e => { drag = true; try { v.setPointerCapture(e.pointerId); } catch (er) {} fromEvt(e); });
    v.addEventListener('pointermove', e => { if (drag) fromEvt(e); });
    ['pointerup', 'pointercancel'].forEach(n => v.addEventListener(n, () => { drag = false; }));
    knob.addEventListener('keydown', e => { const k = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key]; if (k) { e.preventDefault(); set(x + k); } if (e.key === 'Home') set(0); if (e.key === 'End') set(100); });
    const NAMES = { '709': 'REC.709', teal: 'TEAL & ORANGE', warm: 'WARMER ABEND', cold: 'KÜHL' };
    $$('input[name=lut]').forEach(r => r.addEventListener('change', () => { v.dataset.lut = r.value; lab.textContent = NAMES[r.value]; }));
    const order = ['709', 'teal', 'warm', 'cold']; let i = 0;
    const st = auto(root, () => { i = (i + 1) % order.length; setRadio('lut', order[i]); }, 3600, $('.fm-hint-ba'));
    loop(v, (t) => { if (st.on && !RM) set(50 + 26 * Math.sin(t * 1.1)); });
  }
  function k2rgb(K) {
    const t = K / 100; let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
    return [clamp(r, 1, 255), clamp(g, 1, 255), clamp(b, 1, 255)];
  }
  function wb() {
    const s = $('#fm-wb-k'); if (!s) return;
    const mtx = $('#fm-wb-m'), aC = $('#fm-wb-a'), root = s.closest('.fm-wb'), autoL = $('[data-wb-auto]');
    const ref = k2rgb(5500);
    let K = 5500, awb = 0;
    const apply = (k) => {
      const c = k2rgb(k), m = [ref[0] / c[0], ref[1] / c[1], ref[2] / c[2]], n = .3 * m[0] + .59 * m[1] + .11 * m[2];
      mtx.setAttribute('values', `${(m[0] / n).toFixed(3)} 0 0 0 0  0 ${(m[1] / n).toFixed(3)} 0 0 0  0 0 ${(m[2] / n).toFixed(3)} 0 0  0 0 0 1 0`);
      $('[data-wb-v]').textContent = Math.round(k / 100) * 100 + 'K';
    };
    const set = (k) => { K = k; s.value = k; $('[data-wb-v2]').textContent = de(Math.round(k / 100) * 100) + ' K'; if (!aC.checked) apply(k); };
    s.addEventListener('input', () => set(+s.value));
    aC.addEventListener('change', () => { clearInterval(awb); autoL.textContent = aC.checked ? 'AUTO' : ''; if (aC.checked) awb = setInterval(() => apply(4300 + Math.random() * 3200), 900); else apply(K); });
    set(5500);
    const st = auto(root, null, 0, $('.fm-hint-wb'));
    loop(root, (t) => { if (st.on && !RM) set(Math.round((5600 + 2300 * Math.sin(t * .7)) / 100) * 100); });
  }
  function bits() {
    const cv = $('#fm-bits-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), s = $('#fm-bits-k'), root = cv.closest('.fm-bits');
    let W = 0, H = 0, k = 4, lastK = -1;
    function render() {
      if (!W) { sizeCanvas(cv, 560, 16 / 9); W = cv.width; H = cv.height; }
      const d = ctx.createImageData(W, H), a = d.data, half = W / 2;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = .4 + .065 * (y / H) + .008 * Math.sin(x / W * 3.1);
          const q = x < half ? Math.round(v * 255) / 255 : Math.round(v * 1023) / 1023;
          const o = clamp(.43 + (q - .43) * k, 0, 1), i = (y * W + x) * 4;
          a[i] = 25 + o * 165; a[i + 1] = 55 + o * 195; a[i + 2] = 115 + o * 140; a[i + 3] = 255;
        }
      }
      ctx.putImageData(d, 0, 0);
      $('[data-bits-v]').textContent = '×' + de(k, 1);
    }
    s.addEventListener('input', () => { k = +s.value; render(); });
    const st = auto(root, null, 0, $('.fm-hint-bits'));
    loop(cv, (t) => { if (st.on && !RM) { k = Math.round((6 + 4.5 * Math.sin(t * .8)) * 10) / 10; s.value = k; } if (k !== lastK) { lastK = k; render(); } });
    addEventListener('resize', () => { W = 0; render(); });
  }

  /* =========================================================
     08 FLUGSTIL: Manöver, Uptilt, Rates
     ========================================================= */
  const MV = {
    reveal: { n: 'Reveal', d: 'M30 312 C100 314 128 312 138 292 C150 252 172 204 262 176 S420 148 480 156', dur: 4, w: 'Du fliegst tief hinter einer Mauer, Kante oder Baumreihe und steigst dann darüber. Erst in diesem Moment öffnet sich der Blick auf die Landschaft. Der Klassiker für den Anfang eines Clips.', tip: 'Langsam steigen, Gas gleichmäßig. Der Reveal wirkt am stärksten, wenn das Hindernis nah und die Landschaft dahinter weit ist.' },
    orbit: { n: 'Orbit', d: 'M330 168 C400 172 440 196 470 212 A100 36 0 1 1 670 208 A100 36 0 1 1 470 212', dur: 5.6, w: 'Ein Kreis um ein Objekt, die Kamera schaut die ganze Zeit zur Mitte. Braucht gleichzeitiges Gieren und Rollen und ist eine echte Übungsaufgabe.', tip: 'Abstand konstant halten, lieber ein großer ruhiger Kreis als ein enger hektischer. Erst im Simulator üben.' },
    dive: { n: 'Dive', d: 'M400 40 C480 18 548 28 566 66 C586 112 580 220 596 296 C606 330 660 334 740 322', dur: 4, w: 'Über die Kante kippen und an der Struktur entlang nach unten stürzen. Zeigt die Höhe und sorgt für Gänsehaut.', tip: 'Im Fall etwas Gas stehen lassen, sonst schüttelt dich die eigene Luftverwirbelung (Propwash). Früh genug abfangen.' },
    gap: { n: 'Gap', d: 'M50 250 C150 238 250 282 336 292 S470 300 540 250', dur: 3.6, w: 'Durch eine Lücke fliegen, zwischen Bäumen, Masten oder Bauteilen. Je enger die Lücke, desto mehr Spannung.', tip: 'Die Lücke von weit vorne anpeilen und gerade durchziehen. Ein sehr weites Objektiv lässt die Lücke enger wirken, als sie ist.' },
    prox: { n: 'Proximity', d: 'M430 334 C496 326 512 306 518 284 C526 234 532 182 543 132 C550 108 596 100 616 118 C636 136 640 170 700 180', dur: 4.6, w: 'Nah an Oberflächen entlang: Wand, Turm, Baumkrone. Nähe erzeugt Geschwindigkeit, auch wenn du eigentlich langsam fliegst.', tip: 'Mit Abstand anfangen und dich Meter für Meter herantasten. Nur an Objekten, bei denen niemand gefährdet ist.' },
    through: { n: 'Fly-Through', d: 'M420 300 C520 300 610 306 700 306 L790 306', dur: 3.4, w: 'Durch ein offenes Tor, eine Halle oder ein Fenster hinein und hindurch. Der Wechsel von draußen nach drinnen ist ein starker Moment.', tip: 'Drinnen ist es viel dunkler: Feste Werte oder Log helfen, Belichtung vorher testen. Nur mit Erlaubnis des Eigentümers.' }
  };
  function moves() {
    const svg = $('#fm-mv-svg'); if (!svg) return;
    const path = $('#fm-mv-path'), drone = $('#fm-mv-drone'), btns = $$('.fm-mv-btns button'), root = svg.closest('.fm-moves');
    const name = $('#fm-mv-name'), what = $('#fm-mv-what'), tip = $('#fm-mv-tip');
    let tw = null, cur = 'reveal', vis = false;
    function show(k, focus) {
      cur = k; const m = MV[k]; path.setAttribute('d', m.d);
      btns.forEach(b => { const on = b.dataset.mv === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      name.textContent = m.n; what.textContent = m.w; tip.textContent = m.tip;
      if (tw) { tw.kill(); tw = null; }
      if (hasG() && window.MotionPathPlugin && !RM) {
        if (window.DrawSVGPlugin) gsap.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, ease: 'power2.out' });
        tw = gsap.to(drone, { motionPath: { path, align: path, autoRotate: true, alignOrigin: [.2, .5] }, duration: m.dur, ease: 'power1.inOut', repeat: -1, repeatDelay: .5, paused: !vis });
      } else {
        const L = path.getTotalLength(), q = path.getPointAtLength(L * .5), q2 = path.getPointAtLength(L * .52);
        drone.setAttribute('transform', `translate(${q.x} ${q.y}) rotate(${Math.atan2(q2.y - q.y, q2.x - q.x) * 180 / Math.PI})`);
      }
    }
    btns.forEach((b, i) => {
      b.addEventListener('click', () => show(b.dataset.mv));
      b.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); show(btns[(i + d + btns.length) % btns.length].dataset.mv, true); } });
    });
    onVis(svg, v => { vis = v; if (tw) v ? tw.play() : tw.pause(); });
    show('reveal');
    const keys = Object.keys(MV); let i = 0;
    auto(root, () => { i = (i + 1) % keys.length; show(keys[i]); }, 5200, $('.fm-hint-mv'));
  }
  function uptilt() {
    const us = $('#fm-up-u'); if (!us) return;
    const ss = $('#fm-up-s'), body = $('#fm-up-body'), cam = $('#fm-up-cam'), sky = $('#fm-up-sky'), hz = $('#fm-up-hz'), say = $('#fm-up-say'), root = us.closest('.fm-up');
    function upd() {
      const u = +us.value, p = +ss.value;
      body.setAttribute('transform', `rotate(${p})`);
      cam.setAttribute('transform', `translate(44 0) rotate(${-u})`);
      const a = u - p, pos = clamp(50 + (a / 40) * 50, -5, 105);
      sky.style.height = clamp(pos, 0, 100) + '%'; hz.style.top = pos + '%';
      $('[data-up-u]').textContent = u + '°'; $('[data-up-s]').textContent = p + '°';
      let v, cls = '';
      if (a > 22) { v = `<b>Viel Himmel:</b> Die Kamera schaut ${a}° nach oben. Für dieses Tempo ist der Uptilt zu hoch, oder flieg schneller.`; cls = 'warn'; }
      else if (a < -22) { v = `<b>Fast nur Boden:</b> Die Kamera schaut ${-a}° nach unten. Für dieses Tempo brauchst du mehr Uptilt.`; cls = 'warn'; }
      else v = `<b>Gute Balance:</b> Der Horizont liegt im Bild, die Kamera schaut ${Math.abs(a)}° ${a >= 0 ? 'nach oben' : 'nach unten'}.`;
      say.className = 'fm-verdict ' + cls; say.innerHTML = v;
    }
    us.addEventListener('input', upd); ss.addEventListener('input', upd); upd();
    const st = auto(root, null, 0, $('.fm-hint-up'));
    loop(root, (t) => { if (st.on && !RM) { ss.value = Math.round(28 + 26 * Math.sin(t * .6)); upd(); } });
  }
  function rates() {
    const svgEl = $('#fm-rt-svg'); if (!svgEl) return;
    const cS = $('#fm-rt-c'), mS = $('#fm-rt-m'), eS = $('#fm-rt-e'), path = $('#fm-rt-path'), dot = $('#fm-rt-dot'), root = svgEl.closest('.fm-rates');
    const X = (s) => 34 + s * 254, Y = (r) => 166 - r / 1200 * 154;
    const rate = (x, c, m, e) => x * c + Math.max(0, m - c) * (e * Math.pow(x, 6) + (1 - e) * x * x);
    $('.fm-rt-grid', svgEl).innerHTML = [0, 300, 600, 900, 1200].map(r => `<line x1="34" x2="290" y1="${Y(r)}" y2="${Y(r)}"/><text x="29" y="${Y(r) + 3}" text-anchor="end">${r}</text>`).join('') + [0, .25, .5, .75, 1].map(s => `<line x1="${X(s)}" x2="${X(s)}" y1="12" y2="166"/><text x="${X(s)}" y="177" text-anchor="${s === 0 ? 'start' : s === 1 ? 'end' : 'middle'}">${s * 100} %</text>`).join('');
    let sx = .5, follow = false;
    function upd() {
      const c = +cS.value, m = +mS.value, e = +eS.value;
      let d = ''; for (let i = 0; i <= 60; i++) { const s = i / 60; d += (i ? 'L' : 'M') + X(s).toFixed(1) + ' ' + Y(rate(s, c, m, e)).toFixed(1); }
      path.setAttribute('d', d);
      $('[data-rt-c]').textContent = c; $('[data-rt-m]').textContent = m; $('[data-rt-e]').textContent = de(e, 2);
      dotTo(sx);
    }
    function dotTo(s) {
      sx = s; const r = rate(s, +cS.value, +mS.value, +eS.value);
      dot.setAttribute('cx', X(s)); dot.setAttribute('cy', Y(r));
      $('[data-rt-x]').textContent = Math.round(s * 100) + ' %'; $('[data-rt-y]').textContent = Math.round(r);
    }
    [cS, mS, eS].forEach(i => i.addEventListener('input', upd));
    $$('[data-rt]', root).forEach(b => b.addEventListener('click', () => { const [c, m, e] = b.dataset.rt.split(',').map(Number); cS.value = c; mS.value = m; eS.value = e; upd(); }));
    svgEl.addEventListener('pointermove', e => { const r = svgEl.getBoundingClientRect(); follow = true; dotTo(clamp(((e.clientX - r.left) / r.width * 300 - 34) / 254, 0, 1)); });
    svgEl.addEventListener('pointerleave', () => { follow = false; });
    upd();
    const hint = addHint(root, 'Regler schieben');
    const pre = [[60, 450, .4], [120, 850, .3], [70, 670, 0]]; let i = 2;
    auto(root, () => { i = (i + 1) % pre.length; [cS.value, mS.value, eS.value] = pre[i]; upd(); }, 3400, hint);
    loop(root, (t) => { if (!follow && !RM) dotTo((Math.sin(t * 1.2) + 1) / 2); });
  }

  /* =========================================================
     09 FORMAT-STUDIO: 9:16-Ausschnitt mit Safe Zones
     ========================================================= */
  function reframe() {
    const box = $('#fm-fr-img'); if (!box) return;
    const win = $('#fm-fr-win'), scr = $('#fm-fr-out'), safe = $('#fm-fr-safe'), root = box.closest('.fm-frame');
    let ratio = 9 / 16, pos = .5, lbl = '9:16';
    function upd() {
      const W = box.clientWidth, H = box.clientHeight; if (!W) return;
      const w = Math.min(W, H * ratio), x = (W - w) * pos;
      win.style.width = w + 'px'; win.style.transform = `translateX(${x.toFixed(1)}px)`;
      win.style.backgroundSize = `${W}px ${H}px`; win.style.backgroundPosition = `${(-x).toFixed(1)}px 0`;
      const pw = scr.clientWidth, ph = scr.clientHeight, sc = pw / w, bh = H * sc;
      scr.style.backgroundSize = `${(W * sc).toFixed(1)}px ${bh.toFixed(1)}px`; scr.style.backgroundPosition = `${(-x * sc).toFixed(1)}px ${((ph - bh) / 2).toFixed(1)}px`;
      win.setAttribute('aria-valuenow', Math.round(pos * 100)); $('span', win).textContent = lbl;
    }
    let drag = null;
    win.addEventListener('pointerdown', e => { drag = { x: e.clientX, p: pos }; try { win.setPointerCapture(e.pointerId); } catch (er) {} e.stopPropagation(); });
    win.addEventListener('pointermove', e => { if (!drag) return; const W = box.clientWidth, w = win.offsetWidth; pos = clamp(drag.p + (e.clientX - drag.x) / Math.max(1, W - w), 0, 1); upd(); });
    ['pointerup', 'pointercancel'].forEach(n => win.addEventListener(n, () => { drag = null; }));
    box.addEventListener('pointerdown', e => { if (e.target !== box) return; const r = box.getBoundingClientRect(), w = win.offsetWidth; pos = clamp((e.clientX - r.left - w / 2) / Math.max(1, r.width - w), 0, 1); upd(); });
    win.addEventListener('keydown', e => { const k = { ArrowLeft: -.05, ArrowRight: .05 }[e.key]; if (k) { e.preventDefault(); pos = clamp(pos + k, 0, 1); upd(); } });
    $$('input[name=ratio]').forEach(r => r.addEventListener('change', () => { ratio = +r.value; lbl = r.nextElementSibling.textContent; upd(); }));
    safe.addEventListener('change', () => scr.classList.toggle('nosafe', !safe.checked));
    addEventListener('resize', upd);
    if (window.ResizeObserver) new ResizeObserver(upd).observe(box);
    upd();
    const st = auto(root, null, 0, $('.fm-hint-fr'));
    loop(root, (t) => { if (st.on && !RM) { pos = .5 + .48 * Math.sin(t * .55); upd(); } });
  }

  /* =========================================================
     10 MUSIK: Prompt-Baukasten und Beat-Rechner
     ========================================================= */
  function music() {
    const out = $('#fm-pr-out'); if (!out) return;
    const bpm = $('#fm-pr-bpm'), inst = $('#fm-pr-inst'), bt = $('#fm-bt-bpm'), bOut = $('#fm-beat-out'), ring = $('#fm-beat-ring'), barsEl = $('#fm-beat-bars');
    const pRoot = out.closest('.fm-prompt'), bRoot = bt.closest('.fm-beat');
    const EXTRA = { synthwave: 'retro synths, driving bassline', 'drum and bass': 'fast breakbeats, deep sub bass', 'cinematic orchestral': 'big strings, epic drums, slow build', 'lo-fi hip hop': 'warm vinyl texture, mellow keys', 'post-rock': 'shimmering guitars, slow build to a big climax', 'ambient electronic': 'airy pads, soft pulses', techno: 'four on the floor, hypnotic synth' };
    let text = '', period = .5, lastB = -1;
    function prompt() {
      const g = radioVal('gen'), m = radioVal('moo'), b = bpm.value;
      $('[data-pr-bpm]').textContent = b;
      text = `${inst.checked ? 'instrumental, ' : ''}${g}, ${m}, ${b} bpm, ${EXTRA[g]}, clear intro, strong drop, clean ending`;
      out.textContent = text;
      bt.value = b; beat();
    }
    function beat() {
      const b = +bt.value, s = 60 / b; period = s;
      $('[data-bt-bpm]').textContent = b;
      bOut.innerHTML = [['Ein Beat', de(s, 3) + '<small>s</small>'], ['Ein Takt, 4 Beats', de(s * 4, 2) + '<small>s</small>'], ['Frames pro Beat bei 25p', de(s * 25, 1)], ['Frames pro Beat bei 50p', de(s * 50, 1)], ['Schnitt alle 2 Takte', de(s * 8, 1) + '<small>s</small>']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    }
    barsEl.innerHTML = '<i></i><i></i><i></i><i></i>';
    const bars = $$('i', barsEl);
    pRoot.addEventListener('change', prompt); bpm.addEventListener('input', prompt); inst.addEventListener('change', prompt);
    bt.addEventListener('input', beat);
    $('#fm-pr-copy').addEventListener('click', () => copy(text, $('#fm-pr-ok')));
    prompt();
    const gens = $$('input[name=gen]').map(r => r.value); let i = 0;
    auto(pRoot, () => { i = (i + 1) % gens.length; setRadio('gen', gens[i]); }, 3000, addHint(pRoot, 'Stil antippen'));
    auto(bRoot, null, 0, addHint(bRoot, 'Tempo ändern'));
    loop(bRoot, (t) => {
      const n = Math.floor(t / period); if (n === lastB) return; lastB = n;
      if (RM) return;
      ring.classList.remove('hit', 'one'); void ring.offsetWidth; ring.classList.add('hit'); if (n % 4 === 0) ring.classList.add('one');
      bars.forEach((b, k) => b.classList.toggle('on', k === n % 4));
    });
  }

  /* =========================================================
     11 POSTEN: Collab-Schritte und Beschreibung
     ========================================================= */
  function post() {
    const steps = $$('#fm-ig-steps button'); if (!steps.length) return;
    const scr = $$('#fm-ig .fm-ig-s'), root = $('.fm-collab');
    let cur = 0;
    const desc = $('#fm-ig-desc');
    const go = (i) => { cur = i; steps.forEach((b, k) => b.setAttribute('aria-pressed', k === i)); scr.forEach((s, k) => s.classList.toggle('on', k === i)); const em = $('em', steps[i]); if (desc && em) desc.textContent = em.textContent; };
    steps.forEach((b, k) => b.addEventListener('click', () => go(k)));
    go(0);
    auto(root, () => go((cur + 1) % steps.length), 2800, $('.fm-hint-ig'));
    // Beschreibung
    const out = $('#fm-cg-out'), spot = $('#fm-cg-spot'), q = $('#fm-cg-q'), c = $('#fm-cg-c'), m = $('#fm-cg-m'), g = $('#fm-cg-g'), cgRoot = out.closest('.fm-capgen');
    let text = '';
    function cap() {
      const sp = spot.value.trim() || 'Neuer Flug';
      const mus = { suno: 'Musik: eigener Song, erstellt mit Suno.', app: '', yt: 'Musik: YouTube-Audiomediathek.', none: 'Mit Originalton.' }[m.value];
      text = [sp.replace(/[.!]$/, '') + '.', `Gefilmt mit ${c.value.trim() || 'meiner Kamera'} auf einem ${q.value}${g.checked ? ', stabilisiert mit Gyroflow' : ''}.`, mus, 'Mit @flightclubsaar', '#flightclubsaar #fpv #fpvdrone #cinematicfpv #saarland'].filter(Boolean).join('\n');
      out.textContent = text;
    }
    [spot, c].forEach(i => i.addEventListener('input', cap)); [q, m, g].forEach(i => i.addEventListener('change', cap));
    $('#fm-cg-copy').addEventListener('click', () => copy(text, $('#fm-cg-ok')));
    cap();
    const ex = ['Abendflug am Turm', 'Cinewhoop durch die alte Halle', 'Goldene Stunde über dem Saartal', 'Hallenfliegen im Winter']; let i = 0;
    auto(cgRoot, () => { i = (i + 1) % ex.length; spot.value = ex[i]; q.selectedIndex = [0, 1, 0, 2][i]; cap(); }, 3400, addHint(cgRoot, 'Felder ausfüllen'));
  }

  /* =========================================================
     12 CHECKLISTE (gespeichert im Browser)
     ========================================================= */
  const CK = [
    ['Kamera', ['Linse und ND-Filter sauber geputzt', 'ND-Filter passend zum Licht aufgesteckt', 'Bildrate und Shutter eingestellt, zum Beispiel 25p mit 1/50 oder 50p mit 1/100', 'ISO fest oder begrenzt, Weißabgleich fest', 'Profil gewählt (Log oder Standard), Bitrate auf hoch', 'Stabilisierung aus, wenn Gyroflow geplant ist (bei DJI Pflicht)', 'Speicherkarte leer, schnell genug und formatiert', 'Kamera-Akku voll, Ersatz dabei', 'Kamera fest montiert, Halter und Dämpfer geprüft']],
    ['Kopter', ['Propeller ohne Macken, sonst Vibrationen und Jello', 'Uptilt passt zur geplanten Geschwindigkeit', 'Blackbox an, falls sie die Gyro-Quelle ist', 'Flugakkus geladen, Reihenfolge für die Takes geplant']],
    ['Spot und Regeln', ['Fliegen hier erlaubt, Eigentümer gefragt', 'Keine Menschenansammlungen im Flugbereich, Abstand zu Unbeteiligten', 'Spotter dabei, wenn du mit Brille fliegst', 'Wetter, Wind und Sonnenstand geprüft']],
    ['Aufnahme', ['Linie geplant: Anfang, Höhepunkt, Ende', 'Probeflug gemacht und Aufnahme kurz geprüft', 'Aufnahme läuft wirklich (roter Punkt)']]
  ];
  function checklist() {
    const box = $('#fm-ck'); if (!box) return;
    const KEY = 'fcs-filmen-check';
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    let n = 0;
    // Vier Bereiche als Reiter: kurz statt einer langen Liste
    box.innerHTML = `<div class="fm-ck-tabs" role="tablist" aria-label="Bereiche der Checkliste">${CK.map(([g, items], i) => `<button type="button" role="tab" id="fmck-t${i}" aria-controls="fmck-p${i}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${esc(g)}<small data-ck-c="${i}">0/${items.length}</small></button>`).join('')}</div>` +
      CK.map(([g, items], i) => `<div class="fm-ck-g" role="tabpanel" id="fmck-p${i}" aria-labelledby="fmck-t${i}"${i ? ' hidden' : ''}><ul>${items.map(t => { const id = 'fmck' + (n++); return `<li><label class="check"><input type="checkbox" id="${id}" data-k="${id}"${saved[id] ? ' checked' : ''}><span>${esc(t)}</span></label></li>`; }).join('')}</ul></div>`).join('');
    const boxes = $$('input', box), ring = $('#fm-ck-ring'), nEl = $('#fm-ck-n'), st = $('#fm-ck-st');
    const tabs = $$('[role=tab]', box), panes = $$('[role=tabpanel]', box);
    const sel = (i, focus) => {
      tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; panes[k].hidden = !on; });
      if (focus) tabs[i].focus();
      if (hasG() && !RM) gsap.from($$('li', panes[i]), { y: 10, opacity: 0, duration: .4, stagger: .03, ease: 'expo.out', clearProps: 'transform,opacity' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => sel(i));
      t.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); sel((i + d + tabs.length) % tabs.length, true); });
    });
    $('#fm-ck-t').textContent = boxes.length;
    function upd() {
      const done = boxes.filter(b => b.checked).length, f = done / boxes.length;
      ring.style.strokeDashoffset = (1 - f).toFixed(3); nEl.textContent = done;
      st.textContent = done === boxes.length ? 'BEREIT ZUM FILMEN' : done ? `CHECK ${done}/${boxes.length}` : 'STANDBY';
      st.classList.toggle('ok', done === boxes.length);
      panes.forEach((p, i) => { const bs = $$('input', p), d = bs.filter(b => b.checked).length; const c = $(`[data-ck-c="${i}"]`, box); if (c) c.textContent = d + '/' + bs.length; tabs[i].classList.toggle('done', d === bs.length); });
      try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(boxes.filter(b => b.checked).map(b => [b.dataset.k, 1])))); } catch (e) {}
    }
    box.addEventListener('change', upd);
    $('#fm-ck-reset').addEventListener('click', () => { boxes.forEach(b => { b.checked = false; }); upd(); });
    upd();
    // Selbst-Impuls: ein Lichtbalken wandert über die offenen Punkte im sichtbaren Reiter
    let i = 0;
    const scan = () => { const pane = panes.find(p => !p.hidden) || panes[0]; const open = $$('input', pane).filter(b => !b.checked); $$('.check.scan', box).forEach(l => l.classList.remove('scan')); if (!open.length) return; open[i++ % open.length].closest('.check').classList.add('scan'); };
    auto(box, scan, 1100, addHint(box, 'Antippen zum Abhaken'));
    box.addEventListener('pointerdown', () => $$('.check.scan', box).forEach(l => l.classList.remove('scan')));
  }

  /* =========================================================
     13 GLOSSAR
     ========================================================= */
  const GL = [
    ['180-Grad-Regel', 'Belichtung', 'Verschlusszeit gleich eins durch doppelte Bildrate, also 1/50 s bei 25p. Ergibt Bewegungsunschärfe wie im Kino.'],
    ['Blende', 'Belichtung', 'Öffnung des Objektivs, angegeben als f-Zahl. Kleine Zahl bedeutet viel Licht. Action-Cams haben meist eine feste Blende.'],
    ['Blendenstufe', 'Belichtung', 'Verdopplung oder Halbierung der Lichtmenge. Ein ND8 schluckt drei Blendenstufen.'],
    ['Shutter', 'Belichtung', 'Verschlusszeit: wie lange jedes einzelne Bild belichtet wird, etwa 1/100 s.'],
    ['Shutter-Winkel', 'Belichtung', 'Verschlusszeit im Verhältnis zur Bildrate. 180 Grad heißt: halb so lang, wie ein Bild dauert.'],
    ['ISO', 'Belichtung', 'Verstärkung des Sensorsignals. Höhere Werte machen heller, aber auch rauschiger.'],
    ['Lichtwert (EV)', 'Belichtung', 'Maß für die Helligkeit einer Szene. Ein Schritt bedeutet doppelt oder halb so viel Licht. Sonne liegt etwa bei EV 15.'],
    ['Sunny-16-Regel', 'Belichtung', 'Faustregel: Bei Sonne und Blende 16 ist die richtige Verschlusszeit eins durch ISO. Grundlage unseres ND-Rechners.'],
    ['ND-Filter', 'Belichtung', 'Neutralgraufilter, der Licht gleichmäßig schluckt, ohne Farben zu verändern. Ermöglicht lange Verschlusszeiten bei Sonne.'],
    ['ND/PL', 'Belichtung', 'ND-Filter mit eingebautem Polfilter: weniger Spiegelungen, satterer Himmel.'],
    ['Polfilter (CPL)', 'Belichtung', 'Filtert polarisiertes Licht. Nimmt Spiegelungen auf Wasser und Glas und macht den Himmel satter.'],
    ['Zebra', 'Belichtung', 'Streifenmuster im Monitor auf Stellen, die überbelichtet sind.'],
    ['Histogramm', 'Belichtung', 'Diagramm der Helligkeitsverteilung: links Schatten, rechts Lichter. Stößt es rechts an, frisst der Himmel aus.'],
    ['Ausgefressen', 'Belichtung', 'Reines Weiß ohne Zeichnung. Lässt sich im Schnitt nicht mehr retten.'],
    ['Abgesoffen', 'Belichtung', 'Reines Schwarz ohne Zeichnung in den Schatten.'],
    ['Dynamikumfang', 'Belichtung', 'Spanne zwischen dunkelster und hellster Stelle, die die Kamera noch zeichnet. Log-Profile holen mehr davon heraus.'],
    ['Belichtungskorrektur', 'Belichtung', 'Nachregeln der Automatik heller oder dunkler, angegeben in EV.'],
    ['Bildrate (fps)', 'Bild', 'Bilder pro Sekunde. 25 oder 50 sind in Deutschland üblich, 100 und mehr für Zeitlupe.'],
    ['PAL und NTSC', 'Bild', 'Alte Fernsehnormen. PAL steht heute für 25, 50 und 100 fps passend zum 50-Hz-Netz in Europa, NTSC für 30, 60 und 120 fps.'],
    ['Flackern', 'Bild', 'Helligkeitsschwankungen durch Lampen, die mit der Netzfrequenz pulsieren. In Deutschland 100-mal pro Sekunde.'],
    ['Rolling Shutter', 'Bild', 'Der Sensor liest Zeile für Zeile aus. Schnelle Bewegungen werden schief, Vibrationen erzeugen Jello.'],
    ['Jello', 'Bild', 'Wabbelnde, gummiartige Verzerrung durch Vibrationen von Propellern, Motoren oder einem zu harten Halter.'],
    ['Bewegungsunschärfe', 'Bild', 'Verwischen bewegter Dinge innerhalb eines Bildes. Hängt von der Verschlusszeit ab.'],
    ['Stroboskop-Effekt', 'Bild', 'Abgehackte Bewegung durch sehr kurze Verschlusszeit ohne Bewegungsunschärfe.'],
    ['Auflösung', 'Bild', 'Anzahl der Bildpunkte, etwa 1080p, 2.7K, 4K, 5.3K oder 8K. Mehr Pixel geben Reserve zum Zuschneiden.'],
    ['Seitenverhältnis', 'Bild', 'Verhältnis von Breite zu Höhe: 16:9 für YouTube, 9:16 für Reels, 4:3 und 8:7 für die volle Sensorfläche.'],
    ['Volle Sensorfläche', 'Bild', 'Aufnahme in 4:3 oder 8:7, damit kein Teil des Sensors verschenkt wird. Gibt Reserve für Stabilisierung und Hochformat.'],
    ['Bitrate', 'Bild', 'Datenmenge pro Sekunde Video in Mbit/s. Höher heißt weniger Kompressionsfehler bei Gras, Bäumen und Wasser.'],
    ['Codec', 'Bild', 'Verfahren zum Komprimieren, etwa H.264 oder H.265. H.265 spart Platz, braucht aber mehr Rechenleistung.'],
    ['10 Bit', 'Bild', '1024 Abstufungen pro Farbkanal statt 256 bei 8 Bit. Wichtig, wenn du stark gradest.'],
    ['Banding', 'Bild', 'Sichtbare Stufen in sanften Verläufen wie dem Himmel. Typisch bei 8 Bit und starkem Grading.'],
    ['Rauschen', 'Bild', 'Körniges Flimmern bei wenig Licht oder hoher ISO.'],
    ['Schärfung', 'Bild', 'Kamerainterne Kantenbetonung. Für FPV meist niedrig einstellen, nachschärfen geht im Schnitt.'],
    ['Zeitlupe', 'Bild', 'Hohe Bildrate auf einer normalen Timeline abgespielt. 100p auf 25p ergibt viermal langsamer.'],
    ['Crop', 'Bild', 'Zuschnitt des Bildes. Stabilisierung und Horizont-Lock kosten immer etwas Rand.'],
    ['Moiré', 'Bild', 'Flimmernde Muster bei feinen Strukturen wie Gittern, Zäunen oder Dachziegeln.'],
    ['Sichtfeld (FOV)', 'Objektiv', 'Wie viel Grad die Kamera überblickt. FPV-Kameras sehen oft 150 Grad und mehr.'],
    ['Fischauge', 'Objektiv', 'Extrem weites Objektiv mit stark gekrümmten Linien am Rand. Wirkt schnell und nah.'],
    ['Linear', 'Objektiv', 'Entzerrter Modus: Gerade Linien bleiben gerade, das Bild ist dafür enger.'],
    ['SuperView', 'Objektiv', 'GoPro-Modus, der das 4:3-Bild auf 16:9 dehnt, besonders an den Rändern.'],
    ['HyperView', 'Objektiv', 'GoPro-Modus, der das 8:7-Bild auf 16:9 dehnt. Noch immersiver als SuperView.'],
    ['Linsenverzerrung', 'Objektiv', 'Krümmung gerader Linien durch Weitwinkel-Optik. Lässt sich mit Objektivprofilen korrigieren.'],
    ['Objektivprofil', 'Objektiv', 'Datensatz, der die Verzerrung einer Kamera beschreibt. Gyroflow nutzt ihn zum Entzerren und Stabilisieren.'],
    ['Uptilt', 'Objektiv', 'Neigungswinkel der Kamera nach oben. Je schneller du fliegst, desto mehr Uptilt brauchst du.'],
    ['Horizont-Lock', 'Objektiv', 'Hält den Horizont gerade, auch wenn der Kopter rollt. Kostet Bildausschnitt.'],
    ['Vignette', 'Objektiv', 'Abdunklung zu den Bildecken hin.'],
    ['Gegenlicht', 'Objektiv', 'Die Kamera schaut in die Sonne. Gibt Stimmung und Lens Flares, kann aber Details verschlucken.'],
    ['Lens Flare', 'Objektiv', 'Lichtreflexe im Objektiv, wenn die Sonne ins Bild scheint.'],
    ['Lens Mod', 'Objektiv', 'Aufsteck-Objektiv, etwa die Ultra-Weitwinkel-, Makro- oder Anamorphot-Linse für die HERO13.'],
    ['Gyro', 'Stabi', 'Drehratensensor, der jede Bewegung der Kamera misst. Grundlage für Gyroflow.'],
    ['Gyroflow', 'Stabi', 'Kostenlose Open-Source-Software, die Videos mit Gyro-Daten stabilisiert. Auch als Plugin für Schnittprogramme.'],
    ['Blackbox', 'Stabi', 'Flugdatenschreiber im Flugcontroller (Betaflight, INAV, Emuflight). Kann Gyroflow als Gyro-Quelle dienen.'],
    ['HyperSmooth', 'Stabi', 'Eingebaute Bildstabilisierung der GoPro.'],
    ['RockSteady', 'Stabi', 'Eingebaute Bildstabilisierung bei DJI, etwa in Osmo Action und O4 Air Unit.'],
    ['HorizonSteady', 'Stabi', 'DJI-Modus, der zusätzlich den Horizont gerade hält.'],
    ['FlowState', 'Stabi', 'Eingebaute Bildstabilisierung von Insta360.'],
    ['EIS', 'Stabi', 'Elektronische Bildstabilisierung: Das Bild wird digital verschoben und zugeschnitten.'],
    ['Glättung', 'Stabi', 'Wie stark Gyroflow Bewegungen beruhigt. Mehr Glättung bedeutet mehr Zuschnitt.'],
    ['Synchronisation', 'Stabi', 'Abgleich von Gyro-Daten und Video, wenn sie aus getrennten Quellen kommen, etwa bei Blackbox-Logs.'],
    ['.gcsv', 'Stabi', 'Dateiformat für Gyro-Daten, das unter anderem RunCam, Walksnail und Caddx Walnut neben dem Video speichern.'],
    ['Propwash', 'Stabi', 'Verwirbelte Luft der eigenen Propeller, etwa im Sturz eines Dives. Erzeugt Wackler im Bild.'],
    ['Log-Profil', 'Farbe', 'Flaches Bildprofil mit viel Dynamik und wenig Kontrast, gedacht für die Farbkorrektur im Schnitt.'],
    ['GP-Log', 'Farbe', 'Log-Profil von GoPro, seit der HERO12. Passende LUT zum Download.'],
    ['D-Log M', 'Farbe', 'Log-Profil von DJI für Kameras wie Osmo Action oder O4 Air Unit Pro.'],
    ['I-Log', 'Farbe', 'Log-Profil von Insta360, etwa bei Ace Pro 2 und X6.'],
    ['LUT', 'Farbe', 'Look-Up-Table: Tabelle, die Farben umrechnet, etwa von Log nach Rec.709.'],
    ['Rec.709', 'Farbe', 'Standard-Farbraum für normales HD-Video. Ziel der meisten Hersteller-LUTs.'],
    ['Color Grading', 'Farbe', 'Gestalten des Looks: Stimmung, Kontrast, Farbtöne.'],
    ['Farbkorrektur', 'Farbe', 'Technisches Angleichen von Belichtung und Weißabgleich, bevor der Look kommt.'],
    ['Weißabgleich', 'Farbe', 'Einstellung, damit Weiß auch weiß aussieht. Angegeben in Kelvin, Tageslicht etwa 5500 K.'],
    ['Kelvin', 'Farbe', 'Einheit der Farbtemperatur. Kleine Werte stehen für warmes, große für kühles Licht.'],
    ['Teal und Orange', 'Farbe', 'Beliebter Look mit blaugrünen Schatten und warmen Lichtern.'],
    ['Sättigung', 'Farbe', 'Kräftigkeit der Farben.'],
    ['HLG', 'Farbe', 'Hybrid Log Gamma, ein HDR-Format. Die HERO13 nutzt es für ihren HDR-Modus.'],
    ['Timeline', 'Schnitt', 'Zeitachse im Schnittprogramm mit fester Bildrate, auf die du die Clips legst.'],
    ['Proxy', 'Schnitt', 'Leichte Arbeitskopie großer Dateien, damit der Schnitt flüssig läuft.'],
    ['Keyframe', 'Schnitt', 'Markierung, an der sich ein Wert ändert, etwa Zoom oder Tempo.'],
    ['Speed Ramp', 'Schnitt', 'Fließender Wechsel zwischen Zeitlupe und Echtzeit im selben Clip.'],
    ['Schnitt auf den Beat', 'Schnitt', 'Schnitte genau auf die Taktschläge der Musik legen. Wirkt sofort professioneller.'],
    ['Reframing', 'Schnitt', 'Nachträgliches Festlegen des Bildausschnitts, vor allem bei 360-Grad-Material.'],
    ['Hook', 'Schnitt', 'Die ersten ein bis zwei Sekunden, die entscheiden, ob jemand dranbleibt.'],
    ['Export', 'Schnitt', 'Ausgabe des fertigen Films mit Auflösung, Bildrate, Codec und Bitrate.'],
    ['Safe Zone', 'Schnitt', 'Bildbereich, den die App-Oberfläche nicht verdeckt. Text und Logo gehören hinein.'],
    ['Motion Blur im Schnitt', 'Schnitt', 'Künstliche Bewegungsunschärfe, etwa für Material mit kurzer Verschlusszeit nach dem Stabilisieren.'],
    ['Hyperlapse', 'Schnitt', 'Zeitraffer, bei dem sich die Kamera bewegt.'],
    ['BPM', 'Musik', 'Beats per Minute, das Tempo eines Songs. 120 BPM heißt: ein Beat alle 0,5 Sekunden.'],
    ['Suno', 'Musik', 'KI-Dienst, der Songs aus Text erzeugt. Kommerzielle Nutzung nur für Songs aus einem aktiven Pro- oder Premier-Abo.'],
    ['Kommerzielle Nutzung', 'Musik', 'Einsatz, mit dem Geld verdient oder geworben wird, etwa in monetarisierten Videos.'],
    ['Content ID', 'Musik', 'YouTube-System, das Musik automatisch erkennt und Ansprüche der Rechteinhaber durchsetzt.'],
    ['Audiomediathek', 'Musik', 'Kostenlose Musik und Soundeffekte in YouTube Studio für YouTube-Videos.'],
    ['Creative Commons', 'Musik', 'Freie Lizenzen, oft mit der Pflicht, den Urheber zu nennen.'],
    ['Stems', 'Musik', 'Einzelspuren eines Songs wie Drums, Bass oder Melodie. Praktisch, um Musik unter Motorsound zu mischen.'],
    ['Collab-Beitrag', 'Social', 'Instagram-Beitrag mit Mitwirkenden. Erscheint auf allen Profilen, sobald die Eingeladenen annehmen.'],
    ['Mitwirkende', 'Social', 'Accounts, die du bei Instagram zu einem Beitrag einlädst. Für uns: @flightclubsaar.'],
    ['Reel', 'Social', 'Kurzvideo im Hochformat bei Instagram, bis 3 Minuten.'],
    ['Short', 'Social', 'Kurzvideo bei YouTube, quadratisch oder hochkant, bis 3 Minuten.'],
    ['Hashtag', 'Social', 'Schlagwort mit Raute. Unseres: #flightclubsaar.'],
    ['Markieren', 'Social', 'Einen Account im Beitrag nennen, damit er benachrichtigt wird.'],
    ['Caption', 'Social', 'Beschreibungstext unter einem Beitrag.'],
    ['Cinematic', 'Flug', 'Ruhiger, filmischer Flugstil mit weichen Bewegungen.'],
    ['Freestyle', 'Flug', 'Trick-Flugstil mit Flips, Rolls und Power Loops.'],
    ['Linie', 'Flug', 'Geplante Flugbahn durch einen Spot, die eine kleine Geschichte erzählt.'],
    ['Reveal', 'Flug', 'Über ein Hindernis steigen und dahinter die Landschaft zeigen.'],
    ['Orbit', 'Flug', 'Kreis um ein Objekt, die Kamera schaut immer zur Mitte.'],
    ['Dive', 'Flug', 'Sturzflug an einer Struktur entlang nach unten.'],
    ['Gap', 'Flug', 'Flug durch eine Lücke, etwa zwischen Bäumen.'],
    ['Proximity', 'Flug', 'Sehr naher Flug an Oberflächen entlang.'],
    ['Power Loop', 'Flug', 'Looping über ein Hindernis wie einen Baum oder Turm.'],
    ['Split-S', 'Flug', 'Halbe Rolle und halber Looping nach unten: schnelle Richtungsumkehr.'],
    ['Rates', 'Flug', 'Wie schnell der Kopter bei vollem Knüppelausschlag dreht, in Grad pro Sekunde.'],
    ['Expo', 'Flug', 'Macht die Knüppelmitte weicher für feine Korrekturen.'],
    ['Spotter', 'Flug', 'Beobachter, der beim Flug mit Brille den Luftraum im Blick behält.'],
    ['Cinewhoop', 'Flug', 'Kleiner Kopter mit Propellerschutz für ruhige Aufnahmen nah an Objekten und in Räumen.'],
    ['Tiny Whoop', 'Flug', 'Winziger Kopter mit Propellerschutz, perfekt für die Halle.'],
    ['Long Range', 'Flug', 'Kopter für weite Strecken, oft 7 Zoll und größer.'],
    ['Action-Cam', 'Kamera', 'Robuste Kompaktkamera wie GoPro oder DJI Osmo Action.'],
    ['Naked GoPro', 'Kamera', 'GoPro ohne Originalgehäuse in einem leichten Case, Strom vom Kopter.'],
    ['DVR', 'Kamera', 'Aufnahme des Videobilds in der Brille. Zeigt, was du gesehen hast, aber in geringerer Qualität.'],
    ['Air Unit', 'Kamera', 'Sender mit Kamera bei digitalen Systemen wie DJI O4. Viele zeichnen selbst in HD auf.'],
    ['360-Grad-Kamera', 'Kamera', 'Filmt rundherum mit zwei Linsen. Den Ausschnitt wählst du später in der App.'],
    ['Speicherkarte', 'Kamera', 'Für hohe Bitraten braucht es schnelle Karten, sonst bricht die Aufnahme ab. Vor dem Flug in der Kamera formatieren.']
  ];
  function glossary() {
    const list = $('#fm-gl'); if (!list) return;
    const input = $('#fm-gl-q'), cats = $('#fm-gl-cat'), count = $('#fm-gl-n'), empty = $('#fm-gl-empty'), root = list.closest('.fm-gl');
    const CATS = ['Alle', 'Belichtung', 'Bild', 'Objektiv', 'Stabi', 'Farbe', 'Schnitt', 'Musik', 'Social', 'Flug', 'Kamera'];
    cats.innerHTML = CATS.map((c, i) => `<label class="chip"><input type="radio" name="glc" value="${c}"${i ? '' : ' checked'}><span>${c}</span></label>`).join('');
    const hl = (s, q) => {
      const e = esc(s); if (!q) return e;
      const low = e.toLowerCase(), qq = esc(q).toLowerCase(); let out = '', i = 0, j;
      while ((j = low.indexOf(qq, i)) !== -1) { out += e.slice(i, j) + '<mark>' + e.slice(j, j + qq.length) + '</mark>'; i = j + qq.length; }
      return out + e.slice(i);
    };
    const more = $('#fm-gl-more'), FIRST = matchMedia('(max-width:620px)').matches ? 6 : 9; let all = false;
    function render() {
      const q = input.value.trim().toLowerCase(), c = radioVal('glc');
      const items = GL.filter(([t, k, d]) => (c === 'Alle' || k === c) && (!q || (t + ' ' + d).toLowerCase().includes(q))).sort((a, b) => a[0].localeCompare(b[0], 'de', { numeric: true }));
      const cut = !all && !q && c === 'Alle' && items.length > FIRST;
      list.innerHTML = (cut ? items.slice(0, FIRST) : items).map(([t, k, d]) => `<div><dt>${hl(t, q)}<small>${k}</small></dt><dd>${hl(d, q)}</dd></div>`).join('');
      count.textContent = items.length; empty.hidden = items.length > 0;
      more.parentElement.hidden = !cut; more.firstChild.textContent = `Alle ${items.length} Begriffe zeigen `;
    }
    more.addEventListener('click', () => { all = true; render(); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
    input.addEventListener('input', render); cats.addEventListener('change', render);
    render();
    // Zahl im Kopf an die echte Anzahl anpassen
    $$('.fm-stats [data-count]').forEach(b => { if (b.dataset.count === '110') { b.dataset.count = GL.length; b.textContent = GL.length; } });
    // Selbst-Impuls: Platzhalter tippt Beispiele
    const words = ['Shutter', 'LUT', 'Gyroflow', 'ND-Filter', 'Uptilt', 'Banding', 'Reveal']; let w = 0, ch = 0, dir = 1;
    const ctrl = $('.fm-gl-ctrl');
    const st = auto(ctrl, null, 0, addHint(ctrl, 'Begriff eintippen'));
    if (!RM) {
      const iv = setInterval(() => {
        if (!st.on || document.activeElement === input) { input.placeholder = 'zum Beispiel Shutter, LUT, Gyro'; if (!st.on) clearInterval(iv); return; }
        const word = words[w]; ch += dir;
        if (ch > word.length + 6) { dir = -1; ch = word.length; } else if (ch < 0) { dir = 1; ch = 0; w = (w + 1) % words.length; }
        input.placeholder = word.slice(0, clamp(ch, 0, word.length)) + (ch <= word.length ? '|' : '');
      }, 120);
    }
  }

  /* Filmklappe schlägt zu, wenn ein Kapitel ins Bild kommt */
  function slates() {
    const anim = hasG() && !RM;
    $$('.fm-slate').forEach(s => {
      const t = $('.fm-ch-t', s), below = s.getBoundingClientRect().top > innerHeight;
      if (anim && t && below) gsap.set(t, { yPercent: 55, opacity: 0 });
      onVis(s, v => {
        if (!v || s.classList.contains('snap')) return;
        setTimeout(() => s.classList.add('snap'), 280);
        if (anim && t) gsap.to(t, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out' });
      }, '0px 0px -8% 0px');
    });
  }

  /* Absicherung: Nach schnellen Sprüngen (Kapitel-Leiste) erscheinen Inhalte sofort statt nach langer Stagger-Kette */
  function revealFix() {
    if (!window.ScrollTrigger || !hasG() || RM) return;
    const fix = () => {
      const vh = innerHeight;
      const late = $$('main [data-reveal]').filter(el => el.getBoundingClientRect().top < vh * .92 && +getComputedStyle(el).opacity < .05);
      if (late.length) gsap.to(late, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: Math.min(.05, .5 / late.length), overwrite: true });
    };
    ScrollTrigger.addEventListener('scrollEnd', fix);
  }

  function init() {
    [head, folds, asks, quick, shelf, shutterSim, slowmo, flicker, nd, fov, shake, beforeAfter, wb, bits, moves, uptilt, rates, reframe, music, post, checklist, glossary, slates, revealFix].forEach(f => {
      try { f(); } catch (e) { console.error('filmen.js:', f.name, e); }
    });
    if (window.ScrollTrigger) { ScrollTrigger.refresh(); addEventListener('load', () => ScrollTrigger.refresh()); }
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
