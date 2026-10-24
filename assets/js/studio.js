/* Flight Club Saar – Clip-Studio (läuft auf filmen.html)
   1 Video auswählen · 2 Vereinslogo, Ayedo-Logo und Sticker draufziehen · 3 Runterladen oder an den Verein schicken.
   Alles passiert im Browser: Das Video verlässt das Gerät erst, wenn jemand es selbst abschickt.
   Rendern mit mediabunny/WebCodecs, sonst MediaRecorder. Jede Funktion bricht ab, wenn ihr Element fehlt. */
(function () {
  'use strict';

  /* ===== Sticker: neue einfach als Zeile ergänzen =====
     k = Schlüssel, n = Name, src = Datei, w = Startbreite als Anteil der Bildbreite, top = steht oben groß.
     typ 'osd' = Live-OSD-Rahmen mit laufender Flugzeit. opt = Datei kommt evtl. später: dann bleibt der Sticker unsichtbar. */
  const STICKER = [
    { k: 'logo', n: 'Vereinslogo', src: 'assets/img/sticker/vereinslogo.svg', w: .28, top: 1 },
    { k: 'ayedo', n: 'Ayedo-Logo', src: 'assets/img/partner/ayedo-logo.webp', w: .3, top: 1, opt: 1 },
    { k: 'plakette', n: 'Logo rund', src: 'assets/img/sticker/logo-plakette.svg', w: .15, top: 1 },
    { k: 'osd', n: 'OSD-Rahmen', src: 'assets/img/sticker/osd-rahmen.svg', typ: 'osd', top: 1 },
    { k: 'wz', n: '@flightclubsaar', src: 'assets/img/sticker/wasserzeichen.svg', w: .3 },
    { k: 'brille', n: 'Brille an, Welt aus!', src: 'assets/img/sticker/brille-an.svg', w: .34 },
    { k: 'build', n: 'Build · Fly · Crash', src: 'assets/img/sticker/build-fly.svg', w: .62 },
    { k: 'saarland', n: 'Saarland', src: 'assets/img/sticker/saarland.svg', w: .34 },
    { k: 'fpv', n: 'FPV', src: 'assets/img/sticker/fpv.svg', w: .2 },
    { k: 'crash', n: 'Crash & Repeat', src: 'assets/img/sticker/crash-repeat.svg', w: .26 },
    { k: 'sendit', n: 'Send it', src: 'assets/img/sticker/send-it.svg', w: .15 },
    { k: 'herz', n: 'FPV Liebe', src: 'assets/img/sticker/fpv-herz.svg', w: .15 },
    { k: 'vollgas', n: 'Vollgas', src: 'assets/img/sticker/vollgas.svg', w: .15 },
    { k: 'akku', n: 'Akku leer', src: 'assets/img/sticker/akku-leer.svg', w: .15 },
    { k: 'fpvalien', n: 'Unser FPV-Alien', src: 'assets/img/partner/fpv-alien.webp', w: .22, opt: 1 },
    { k: 'alienquad', n: 'Alien-Kopter', src: 'assets/img/partner/fpv-alien-quad.webp', w: .16, opt: 1 }
  ];
  const LIB = 'assets/lib/mediabunny.min.mjs';
  const DEMO_SRC = 'media/hero.mp4', DEMO_POSTER = 'media/hero.webp';
  const MAXLEN = 60, MINLEN = .5;
  const SIG = '#3fe0ff', AMBER = '#ffb020', RED = '#ff4b5c';
  const ICON = {
    wa: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>'
  };

  let D, RM, FINE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const gs = () => window.gsap;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const even = v => Math.max(2, Math.round(v / 2) * 2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MB = b => (b / 1048576).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
  const tS = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };
  const tD = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + r.toFixed(1).padStart(4, '0').replace('.', ','); };
  const sec = s => (Math.round(s * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  const slug = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const attach = (input, file) => { try { const dt = new DataTransfer(); if (file) dt.items.add(file); input.files = dt.files; return true; } catch (e) { return false; } };
  const once = (el, ev, ms) => new Promise((res, rej) => { let t; const off = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); }; const ok = () => { off(); res(); }; const bad = () => { off(); rej(new Error('error')); }; el.addEventListener(ev, ok); el.addEventListener('error', bad); if (ms) t = setTimeout(() => { off(); rej(new Error('timeout')); }, ms); });
  const go = (el, off) => { if (!el) return; if (window.FCS && FCS.scrollTo) FCS.scrollTo(el, off == null ? -84 : off); else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const inView = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight - 20; };
  const maxBytes = () => ((D.upload && D.upload.maxMail) || 9) * 1048576;
  const isVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(f.name);

  /* =====================================================================
     Zustand
     ===================================================================== */
  const S = {
    demo: true, file: null, url: '', name: 'Beispielvideo',
    vw: 1280, vh: 720, dur: 0, fmt: 'orig', aspect: 16 / 9,
    pan: { x: .5, y: .5 }, a: 0, b: 0,
    st: [], sel: null, uid: 0, osd: false, osdDemo: false,
    ln: { name: '', mode: 'start', force: false }, busy: false, interacted: false,
    result: null, resultSig: '', resultQ: '', done: { dl: false, sent: false }
  };
  const IMG = {};
  let video, cv, ctx, stage, wrap, layer, trays = [], box = { w: 0, h: 0 }, poster;
  let demoTL = null, hintLoop = null, visible = false, looping = false;

  const def = k => STICKER.find(s => s.k === k);
  const fmtA = f => f === '9:16' ? 9 / 16 : f === '1:1' ? 1 : f === '16:9' ? 16 / 9 : (S.vw / S.vh || 16 / 9);
  const byId = id => S.st.find(s => s.id === +id);
  const trayBtn = k => { for (const t of trays) { const b = t.querySelector(`[data-k="${k}"]`); if (b) return b; } return null; };
  const userStickers = () => S.st.filter(s => !s.demo).length + (S.osd && !S.osdDemo ? 1 : 0);
  // Fingerabdruck aller Einstellungen: Ändert sich etwas, muss neu gerendert werden
  const sig = () => JSON.stringify([S.fmt, Math.round(S.pan.x * 100), Math.round(S.pan.y * 100), S.a.toFixed(2), S.b.toFixed(2), S.osd, S.ln.name.trim(), S.ln.mode, S.st.map(s => [s.k, s.x.toFixed(3), s.y.toFixed(3), s.w.toFixed(3), Math.round(s.r)])]);

  function loadImgs() {
    STICKER.forEach(d => {
      const el = new Image(); el.decoding = 'async';
      const o = IMG[d.k] = { el, ok: false, ar: 1 };
      el.onload = () => { o.ok = true; o.ar = (el.naturalHeight || 1) / (el.naturalWidth || 1); S.st.filter(s => s.k === d.k).forEach(place); };
      el.onerror = () => { o.ok = false; const b = trayBtn(d.k); if (b) b.remove(); S.st.filter(s => s.k === d.k).forEach(remove); };
      el.src = d.src;
    });
  }

  /* =====================================================================
     Aufbau
     ===================================================================== */
  function studio() {
    stage = $('#st-stage'); wrap = $('#st-wrap'); layer = $('#st-layer'); cv = $('#st-cv');
    if (!stage || !wrap || !layer || !cv) return;
    ctx = cv.getContext('2d');
    video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto'; video.loop = true;
    video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
    video.style.cssText = 'position:absolute;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
    wrap.appendChild(video);
    poster = new Image(); poster.src = DEMO_POSTER;
    loadImgs(); buildTray(); gestures(); trayDrag(); keys(); timeline(); controls(); fileIn(); stepsUI(); options();
    layout();
    let rq = 0; addEventListener('resize', () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { layout(); tlDraw(); }); });
    if (document.fonts) { document.fonts.load('400 40px "Bebas Neue"').catch(() => {}); document.fonts.load('600 20px "Chakra Petch"').catch(() => {}); }
    video.addEventListener('loadedmetadata', () => { if (S.demo) { S.vw = video.videoWidth || 1280; S.vh = video.videoHeight || 720; S.dur = video.duration || 13; S.a = 0; S.b = Math.min(S.dur, MAXLEN); tlDraw(); } });
    video.addEventListener('play', () => { const b = $('#st-play'); if (b) { b.classList.add('on'); b.setAttribute('aria-label', 'Pause'); } });
    video.addEventListener('pause', () => { const b = $('#st-play'); if (b) { b.classList.remove('on'); b.setAttribute('aria-label', 'Abspielen'); } });
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) { if (!looping) loop(); if (!S.busy && (S.demo || !S.userPaused)) video.play().catch(() => {}); }
      else if (!video.paused) video.pause();
    }, { rootMargin: '120px 0px' }).observe(wrap);
    // Selbst-Impuls: Sobald das Studio zu sehen ist, fliegen Logos von allein aufs Beispielvideo
    video.src = DEMO_SRC;
    const st = $('#st');
    const startDemo = () => demo();
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: st, start: 'top 85%', once: true, onEnter: startDemo });
    else startDemo();
    // Jede echte Bedienung beendet die Vorführung
    ['pointerdown', 'keydown'].forEach(ev => st.addEventListener(ev, e => { if (e.isTrusted) interact(); }, true));
    goState(); steps();
  }

  function interact() {
    if (S.interacted) return;
    S.interacted = true;
    if (demoTL) { demoTL.kill(); demoTL = null; }
    clearInterval(hintLoop); hintLoop = null;
    S.st.forEach(s => { s.a = 1; });
    if (S.ln.name === 'Dein Pilotenname' && !(($('#ln-name') || {}).value)) S.ln.name = '';
    $$('.ghostcur').forEach(g => g.remove());
    $$('.st-steps .demo').forEach(x => x.classList.remove('demo'));
  }

  /* ---------- Bühne: Größe ---------- */
  function layout() {
    const cs = getComputedStyle(wrap), px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const desk = innerWidth > 1040;
    const maxH = Math.min(innerHeight * (desk ? .62 : .58), desk ? 600 : 540);
    const avail = Math.max(120, wrap.clientWidth - px);
    let w = avail, h = w / S.aspect;
    if (h > maxH) { h = maxH; w = h * S.aspect; }
    stage.style.width = w + 'px'; stage.style.height = h + 'px'; stage.style.aspectRatio = 'auto';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    box = { w, h };
    S.st.forEach(place);
    if (!looping) draw();
  }

  /* ---------- Zeichnen (Vorschau und Export nutzen dieselben Funktionen) ---------- */
  function crop(sw, sh, A) {
    const sa = sw / sh; let cw = sw, ch = sh, cx = 0, cy = 0;
    if (sa > A + 1e-3) { cw = sh * A; cx = (sw - cw) * S.pan.x; }
    else if (sa < A - 1e-3) { ch = sw / A; cy = (sh - ch) * S.pan.y; }
    return { cx, cy, cw, ch };
  }
  function overlay(c, W, H, t, preview) {
    if (S.osd) drawOSD(c, W, H, t);
    for (const s of S.st) {
      const im = IMG[s.k]; if (!im || !im.ok || s.a <= 0) continue;
      const w = s.w * W, h = w * im.ar;
      c.save(); c.globalAlpha = s.a; c.translate(s.x * W, s.y * H); c.rotate(s.r * Math.PI / 180);
      c.drawImage(im.el, -w / 2, -h / 2, w, h); c.restore();
    }
    drawLower(c, W, H, t, preview && S.ln.force);
  }
  function drawOSD(c, W, H, t) {
    const u = Math.min(W, H) / 100, m = 4.2 * u, L = 7 * u;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 1.4 * u; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, .6 * u); c.lineCap = 'square';
    c.beginPath();
    c.moveTo(m, m + L); c.lineTo(m, m); c.lineTo(m + L, m);
    c.moveTo(W - m - L, m); c.lineTo(W - m, m); c.lineTo(W - m, m + L);
    c.moveTo(W - m, H - m - L); c.lineTo(W - m, H - m); c.lineTo(W - m - L, H - m);
    c.moveTo(m + L, H - m); c.lineTo(m, H - m); c.lineTo(m, H - m - L);
    const cx = W / 2, cy = H / 2, g = 2.6 * u, l = 2.6 * u;
    c.moveTo(cx - g - l, cy); c.lineTo(cx - g, cy); c.moveTo(cx + g, cy); c.lineTo(cx + g + l, cy);
    c.moveTo(cx, cy - g - l * .5); c.lineTo(cx, cy - g); c.moveTo(cx, cy + g); c.lineTo(cx, cy + g + l * .5);
    c.stroke();
    c.fillStyle = SIG; c.beginPath(); c.arc(cx, cy, .7 * u, 0, Math.PI * 2); c.fill();
    const fs = 3.3 * u, top = m + 3.4 * u, bot = H - m - 3.4 * u;
    c.font = `600 ${fs}px "Chakra Petch", ui-monospace, monospace`; c.textBaseline = 'middle';
    const v = Math.max(14, 16.4 - t * .012), lvl = (v - 14) / 2.6;
    c.fillStyle = '#fff'; c.textAlign = 'left'; const vt = v.toFixed(1) + 'V'; c.fillText(vt, m + 2.2 * u, top);
    const bx = m + 2.2 * u + c.measureText(vt).width + 1.6 * u, bw = 6.4 * u, bh = 2.8 * u;
    c.lineWidth = Math.max(1, .4 * u); c.strokeRect(bx, top - bh / 2, bw, bh); c.fillRect(bx + bw, top - bh / 4, .6 * u, bh / 2);
    c.fillStyle = lvl > .35 ? SIG : AMBER; c.fillRect(bx + .5 * u, top - bh / 2 + .5 * u, (bw - u) * clamp(lvl, .05, 1), bh - u);
    c.fillStyle = SIG; c.textAlign = 'right'; c.fillText(tS(t).padStart(5, '0'), W - m - 2.2 * u, top);
    if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = RED; c.beginPath(); c.arc(m + 3 * u, bot, 1 * u, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText('REC', m + 4.9 * u, bot);
    c.globalAlpha = .88; c.textAlign = 'right'; c.font = `600 ${2.5 * u}px "Chakra Petch", ui-monospace, monospace`;
    c.fillText('FLIGHT CLUB SAAR', W - m - 2.2 * u, bot);
    c.restore();
  }
  function drawLower(c, W, H, t, force) {
    const name = S.ln.name.trim(); if (!name || S.ln.mode === 'off') return;
    let p = 1;
    if (!force) {
      if (S.ln.mode === 'start') { if (t < .3 || t > 5.6) return; p = Math.min(1, (t - .3) / .55, (5.6 - t) / .5); }
      else { p = clamp((t - .3) / .55, 0, 1); if (p <= 0) return; }
    }
    const e = 1 - Math.pow(1 - p, 3);
    const u = Math.min(W, H) / 100, x = 5 * u, yb = H - (S.osd ? 13.5 * u : 6 * u);
    const big = `400 ${7.6 * u}px "Bebas Neue", "Chakra Petch", sans-serif`, small = `600 ${2.2 * u}px "Chakra Petch", ui-monospace, monospace`;
    c.save();
    c.font = big; const nw = c.measureText(name.toUpperCase()).width;
    c.font = small; const sub = 'FLIGHT CLUB SAAR E. V.'; const sw = c.measureText(sub).width + 2.2 * u * .15 * sub.length;
    const bw = Math.max(nw, sw) + 6.5 * u, bh = 12.6 * u, y = yb - bh;
    c.fillStyle = SIG; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 2 * u; c.fillRect(x, y + bh * (1 - e), 1.1 * u, bh * e);
    c.shadowBlur = 0;
    c.beginPath(); c.rect(x + 1.1 * u, y, bw * e, bh); c.clip();
    c.fillStyle = 'rgba(4,9,18,.84)'; c.fillRect(x + 1.1 * u, y, bw, bh);
    c.fillStyle = 'rgba(63,224,255,.16)'; c.fillRect(x + 1.1 * u, y + bh - .5 * u, bw, .5 * u);
    const tx = x + 3.8 * u - (1 - e) * 4 * u;
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.font = big; c.fillStyle = '#fff'; c.fillText(name.toUpperCase(), tx, y + 7.9 * u);
    c.font = small; c.fillStyle = AMBER; if ('letterSpacing' in c) c.letterSpacing = (.3 * u) + 'px';
    c.fillText(sub, tx, y + 10.8 * u);
    c.restore();
  }
  function frameSrc() {
    if (video.readyState >= 2 && video.videoWidth) return { el: video, w: video.videoWidth, h: video.videoHeight };
    if (S.demo && poster.complete && poster.naturalWidth) return { el: poster, w: poster.naturalWidth, h: poster.naturalHeight };
    return null;
  }
  function tNow() { return S.demo ? (video.currentTime || 0) : Math.max(0, (video.currentTime || 0) - S.a); }
  let drawnFor = '';
  function draw() {
    const W = cv.width, H = cv.height;
    const f = frameSrc();
    if (!f && !S.demo && drawnFor === W + 'x' + H) return; // beim Spulen letztes Bild stehen lassen
    drawnFor = W + 'x' + H;
    ctx.fillStyle = '#02050b'; ctx.fillRect(0, 0, W, H);
    if (f) { const c = crop(f.w, f.h, S.aspect); try { ctx.drawImage(f.el, c.cx, c.cy, c.cw, c.ch, 0, 0, W, H); } catch (e) {} }
    overlay(ctx, W, H, tNow(), true);
  }
  function loop() {
    if (!visible) { looping = false; return; }
    looping = true;
    if (!S.demo && !S.busy && !video.paused && video.currentTime >= S.b - .03) video.currentTime = S.a;
    draw(); tick();
    requestAnimationFrame(loop);
  }

  /* ---------- Sticker-Leisten (oben groß: Logos, darunter weitere Sticker) ---------- */
  function buildTray() {
    const top = $('#tray-top'), more = $('#tray');
    trays = [top, more].filter(Boolean);
    const btn = d => `<button type="button" data-k="${d.k}"${d.typ === 'osd' ? ' aria-pressed="false"' : ''} aria-label="${d.typ === 'osd' ? 'OSD-Rahmen ein- oder ausschalten' : esc(d.n) + ' aufs Video legen'}" title="${esc(d.n)}"><img src="${d.src}" alt="" draggable="false"><span>${esc(d.n)}</span></button>`;
    if (top) top.innerHTML = STICKER.filter(d => d.top).map(btn).join('');
    if (more) more.innerHTML = STICKER.filter(d => !d.top || !top).map(btn).join('');
    trays.forEach(tray => {
      $$('img', tray).forEach(im => im.addEventListener('error', () => { const b = im.closest('button'); if (b) b.remove(); }));
      tray.addEventListener('click', e => {
        const b = e.target.closest('button[data-k]'); if (!b || S.busy) return;
        if (b._dragged) { b._dragged = false; return; }
        interact();
        const d = def(b.dataset.k);
        if (d.typ === 'osd') { S.osdDemo = false; setOSD(!S.osd); return; }
        const n = S.st.length, off = (n % 5 - 2) * .06;
        const s = flyIn(d.k, .5 + off, .5 + off * .6, 0);
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        hideHint();
        if (s && s.h && e.detail === 0) setTimeout(() => s.h.focus(), 50);
        // Am Handy liegt die Bühne oft außerhalb: kurz hinscrollen, damit man sieht, wo der Sticker landet
        if (!inView(stage) && innerWidth <= 1040) go(wrap, -110);
      });
    });
    if (!FINE) {
      const help = $('#st-help-tray'); if (help) help.textContent = 'Tipp ein Logo an, es landet auf dem Video. Dort verschiebst du es mit dem Finger, mit zwei Fingern drehst und vergrößerst du es.';
      const ht = $('#st-hint-t'); if (ht) ht.textContent = 'Tipp unten ein Logo an';
    }
  }
  function setOSD(on) {
    S.osd = on; const b = trayBtn('osd'); if (b) b.setAttribute('aria-pressed', on);
    sumLine(); steps();
  }
  function trayDrag() {
    trays.forEach(tray => tray.addEventListener('pointerdown', e => {
      const b = e.target.closest('button[data-k]'); if (!b || e.button || S.busy || e.pointerType === 'touch') return;
      const d = def(b.dataset.k); if (d.typ === 'osd') return;
      const st = { x: e.clientX, y: e.clientY, g: null };
      const mv = ev => {
        if (!st.g && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 8) {
          interact();
          st.g = document.createElement('div'); st.g.className = 'dragghost'; st.g.innerHTML = `<img src="${d.src}" alt="">`; document.body.appendChild(st.g);
        }
        if (st.g) { st.g.style.transform = `translate(${ev.clientX}px,${ev.clientY}px)`; wrap.classList.toggle('target', over(ev)); }
      };
      const up = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        wrap.classList.remove('target');
        if (!st.g) return;
        st.g.remove(); b._dragged = true; setTimeout(() => { b._dragged = false; }, 0);
        if (over(ev)) {
          const r = stage.getBoundingClientRect();
          const s = add(d.k, clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
          pulse(s); hideHint();
        }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    }));
    const over = ev => { const r = stage.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
  }

  /* ---------- Sticker-Modell ---------- */
  function add(k, x = .5, y = .5, o = {}) {
    const d = def(k), im = IMG[k]; if (!d || !im) return null;
    let w = o.w || d.w;
    const ar = im.ar || 1;
    if (box.w && w * box.w * ar > box.h * .9) w = box.h * .9 / (box.w * ar);
    const s = { id: ++S.uid, k, x, y, w, r: o.r || 0, a: o.a == null ? 1 : o.a, demo: !!o.demo };
    S.st.push(s); mkHandle(s); select(o.demo ? null : s.id); sumLine(); steps();
    return s;
  }
  function mkHandle(s) {
    const d = def(s.k), h = document.createElement('div');
    h.className = 'stk'; h.tabIndex = 0; h.dataset.id = s.id;
    h.setAttribute('role', 'button');
    h.setAttribute('aria-label', `${d.n} auf dem Video. Pfeiltasten verschieben, Plus und Minus ändern die Größe, Q und E drehen, Entf löscht.`);
    h.innerHTML = '<span class="stk-k stk-rot" aria-hidden="true"></span><span class="stk-k stk-sc" aria-hidden="true"></span><button class="stk-k stk-x" type="button" tabindex="-1" aria-label="Sticker löschen">×</button>';
    h.querySelector('.stk-x').addEventListener('click', e => { e.stopPropagation(); remove(s); });
    h.addEventListener('focus', () => select(s.id));
    layer.appendChild(h); s.h = h; place(s);
  }
  function place(s) {
    if (!s.h) return;
    const im = IMG[s.k], w = s.w * box.w, h = w * (im ? im.ar : 1);
    s.h.style.left = (s.x * 100) + '%'; s.h.style.top = (s.y * 100) + '%';
    s.h.style.width = w + 'px'; s.h.style.height = h + 'px';
    s.h.style.setProperty('--r', s.r + 'deg');
    s.h.style.zIndex = 2 + S.st.indexOf(s);
  }
  function remove(s) {
    if (!s) return;
    S.st = S.st.filter(x => x !== s); if (s.h) s.h.remove();
    if (S.sel === s.id) select(null);
    S.st.forEach(place); sumLine(); steps();
  }
  function select(id) {
    S.sel = id == null ? null : +id;
    S.st.forEach(s => s.h && s.h.classList.toggle('sel', s.id === S.sel));
    editor();
  }
  function pulse(s) {
    if (!s || !gs() || RM) return;
    const w = s.w; s.w = w * .6; gs().to(s, { w, duration: .6, ease: 'back.out(3)', onUpdate: () => place(s) });
  }
  function flyIn(k, x, y, r, demoFlag) {
    const b = trayBtn(k);
    const s = add(k, x, y, { r, a: 0, demo: !!demoFlag }); if (!s) return null;
    const br = b && b.getBoundingClientRect();
    const sr = stage.getBoundingClientRect(), im = IMG[k];
    const fromTray = br && br.width && br.top < innerHeight + 40 && br.bottom > -40;
    if (!gs() || RM || !im || !im.ok) { s.a = 1; pulse(s); return s; }
    // Liegt die Leiste außer Sicht (Handy), fliegt der Sticker vom oberen Bühnenrand herein
    const fx = fromTray ? br.left + br.width / 2 : sr.left + sr.width * x, fy = fromTray ? br.top + br.height / 2 : sr.top - 40;
    const g = document.createElement('div'); g.className = 'dragghost'; g.style.margin = '0'; g.innerHTML = `<img src="${def(k).src}" alt="">`; document.body.appendChild(g);
    const tw = s.w * sr.width;
    gs().fromTo(g, { x: fx, y: fy, width: fromTray ? br.width * .7 : tw * .5, height: fromTray ? br.width * .7 : tw * .5 * im.ar, xPercent: -50, yPercent: -50, rotation: -30, opacity: fromTray ? 1 : 0 },
      { x: sr.left + x * sr.width, y: sr.top + y * sr.height, width: tw, height: tw * im.ar, rotation: r || 0, opacity: 1, duration: .85, ease: 'expo.inOut',
        onComplete: () => { g.remove(); s.a = 1; } });
    return s;
  }
  function editor() {
    const s = byId(S.sel), ed = $('#stk-edit');
    if (!ed) return;
    ed.hidden = !s;
    const clr = $('#stk-clear'); if (clr) clr.hidden = S.demo || (!S.st.length && !S.osd);
    if (!s) return;
    $('#stk-name').textContent = def(s.k).n;
    const sz = $('#stk-size'), rt = $('#stk-rot');
    sz.value = Math.round(s.w * 100); rt.value = Math.round(((s.r + 540) % 360) - 180);
    $('#stk-size-o').textContent = sz.value + ' %'; $('#stk-rot-o').textContent = rt.value + '°';
    fill(sz); fill(rt);
  }
  function fill(r) { if (r) r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }

  /* ---------- Gesten auf der Bühne (Maus, Finger, zwei Finger) ---------- */
  function gestures() {
    const P = new Map(); let G = null;
    const rect = () => stage.getBoundingClientRect();
    const center = s => { const r = rect(); return { x: r.left + s.x * r.width, y: r.top + s.y * r.height }; };
    const two = () => { const [a, b] = [...P.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) }; };
    stage.addEventListener('pointerdown', e => {
      if (S.busy || e.target.closest('.st-drop,.st-err,.stk-x') || (e.pointerType === 'mouse' && e.button)) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      const s0 = byId(S.sel);
      if (P.size === 2 && s0) { const t = two(); G = { t: 'pinch', s: s0, d0: t.d, a0: t.a, w0: s0.w, r0: s0.r }; return; }
      if (P.size > 2) return;
      const h = e.target.closest('.stk');
      if (h) {
        const s = byId(h.dataset.id); if (!s) return;
        select(s.id); hideHint(); s.demo = false; steps();
        if (e.target.classList.contains('stk-rot')) { const c = center(s); G = { t: 'rot', s, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), r0: s.r }; }
        else if (e.target.classList.contains('stk-sc')) { const c = center(s); G = { t: 'sc', s, d0: Math.hypot(e.clientX - c.x, e.clientY - c.y), w0: s.w }; }
        else G = { t: 'move', s, x0: e.clientX, y0: e.clientY, sx: s.x, sy: s.y };
        h.classList.add('drag'); e.preventDefault();
      } else {
        select(null);
        const ax = panAxis();
        G = ax ? { t: 'pan', ax, x0: e.clientX, y0: e.clientY, px: S.pan.x, py: S.pan.y } : null;
      }
    });
    stage.addEventListener('pointermove', e => {
      if (!P.has(e.pointerId)) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!G) return;
      const r = rect(), s = G.s;
      if (G.t === 'pinch' && P.size >= 2) { const t = two(); s.w = clamp(G.w0 * t.d / G.d0, .03, 1.6); s.r = G.r0 + (t.a - G.a0) * 180 / Math.PI; }
      else if (G.t === 'move') { s.x = clamp(G.sx + (e.clientX - G.x0) / r.width, -.05, 1.05); s.y = clamp(G.sy + (e.clientY - G.y0) / r.height, -.05, 1.05); }
      else if (G.t === 'rot') { const c = center(s); let v = G.r0 + (Math.atan2(e.clientY - c.y, e.clientX - c.x) - G.a0) * 180 / Math.PI; v = ((v + 540) % 360) - 180; if (Math.abs(v) < 3) v = 0; s.r = v; }
      else if (G.t === 'sc') { const c = center(s); s.w = clamp(G.w0 * Math.hypot(e.clientX - c.x, e.clientY - c.y) / Math.max(8, G.d0), .03, 1.6); }
      else if (G.t === 'pan') {
        const f = frameSrc(); if (!f) return;
        const c = crop(f.w, f.h, S.aspect);
        if (G.ax === 'x') S.pan.x = clamp(G.px - (e.clientX - G.x0) / r.width * c.cw / Math.max(1, f.w - c.cw), 0, 1);
        else S.pan.y = clamp(G.py - (e.clientY - G.y0) / r.height * c.ch / Math.max(1, f.h - c.ch), 0, 1);
        panUI();
        return;
      }
      if (s) { place(s); editor(); }
    });
    const end = e => {
      if (!P.has(e.pointerId)) return;
      P.delete(e.pointerId);
      if (P.size === 1 && G && G.t === 'pinch') { const [p] = [...P.values()]; G = { t: 'move', s: G.s, x0: p.x, y0: p.y, sx: G.s.x, sy: G.s.y }; return; }
      if (P.size === 0) { if (G && G.s && G.s.h) G.s.h.classList.remove('drag'); G = null; panUI(); sumLine(); }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', e => {
      const h = e.target.closest('.stk'); if (!h || S.busy) return;
      const s = byId(h.dataset.id); if (!s) return;
      e.preventDefault(); interact(); select(s.id); s.demo = false;
      if (e.shiftKey) s.r = ((s.r + Math.sign(e.deltaY || e.deltaX) * 5 + 540) % 360) - 180;
      else s.w = clamp(s.w * Math.exp(-e.deltaY * .0015), .03, 1.6);
      place(s); editor(); steps();
    }, { passive: false });
    // Dateien auf die Bühne ziehen
    ['dragenter', 'dragover'].forEach(ev => wrap.addEventListener(ev, e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); wrap.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { if (ev === 'dragleave' && wrap.contains(e.relatedTarget)) return; wrap.classList.remove('over'); }));
    wrap.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
  }
  function keys() {
    layer.addEventListener('keydown', e => {
      const h = e.target.closest('.stk'); if (!h || S.busy) return;
      const s = byId(h.dataset.id); if (!s) return;
      if (e.key !== 'Tab') s.demo = false;
      const st = e.shiftKey ? .05 : .01;
      switch (e.key) {
        case 'ArrowLeft': s.x = clamp(s.x - st, -.05, 1.05); break;
        case 'ArrowRight': s.x = clamp(s.x + st, -.05, 1.05); break;
        case 'ArrowUp': s.y = clamp(s.y - st, -.05, 1.05); break;
        case 'ArrowDown': s.y = clamp(s.y + st, -.05, 1.05); break;
        case '+': case '=': s.w = clamp(s.w * 1.06, .03, 1.6); break;
        case '-': case '_': s.w = clamp(s.w / 1.06, .03, 1.6); break;
        case 'q': case 'Q': s.r = ((s.r - (e.shiftKey ? 15 : 5) + 540) % 360) - 180; break;
        case 'e': case 'E': s.r = ((s.r + (e.shiftKey ? 15 : 5) + 540) % 360) - 180; break;
        case 'Delete': case 'Backspace': { const i = S.st.indexOf(s); remove(s); const n = S.st[Math.min(i, S.st.length - 1)]; if (n && n.h) n.h.focus(); else { const tb = $('#tray-top button'); if (tb) tb.focus(); } e.preventDefault(); return; }
        case 'Escape': select(null); h.blur(); return;
        default: return;
      }
      e.preventDefault(); place(s); editor(); steps();
    });
  }

  /* ---------- Format und Ausschnitt ---------- */
  function setFmt(f, anim) {
    S.fmt = f;
    const r = $(`input[name=st-fmt][value="${f}"]`); if (r) r.checked = true;
    const A = fmtA(f);
    const fl = $('#st-fmt'); if (fl) fl.textContent = f === 'orig' ? 'ORIGINAL' : f;
    if (gs()) gs().killTweensOf(S, 'aspect');
    if (anim && gs() && !RM) gs().to(S, { aspect: A, duration: .9, ease: 'expo.inOut', onUpdate: layout, onComplete: () => { layout(); panUI(); if (window.ScrollTrigger) ScrollTrigger.refresh(); } });
    else { S.aspect = A; layout(); }
    panUI(); sumLine();
  }
  function panAxis() {
    const f = frameSrc(); if (!f) return null;
    const sa = f.w / f.h, A = fmtA(S.fmt);
    return sa > A + .01 ? 'x' : sa < A - .01 ? 'y' : null;
  }
  function panUI() {
    const ax = panAxis(), row = $('#pan-row'), help = $('#pan-help'), r = $('#pan');
    if (row) row.hidden = !ax; if (help) help.hidden = !ax;
    stage.classList.toggle('pan-x', ax === 'x'); stage.classList.toggle('pan-y', ax === 'y');
    stage.style.touchAction = ax === 'x' ? 'pan-y' : ax === 'y' ? 'pan-x' : 'pan-x pan-y';
    if (!ax || !r) return;
    const v = ax === 'x' ? S.pan.x : S.pan.y;
    $('#pan-lbl').textContent = ax === 'x' ? 'Ausschnitt ↔' : 'Ausschnitt ↕';
    r.value = Math.round(v * 100); fill(r);
    $('#pan-o').textContent = v < .4 ? (ax === 'x' ? 'Links' : 'Oben') : v > .6 ? (ax === 'x' ? 'Rechts' : 'Unten') : 'Mitte';
  }

  /* ---------- Schritt-Leiste 1 · 2 · 3 ---------- */
  function stepsUI() {
    const bar = $('#st-steps'); if (!bar) return;
    $$('[data-step]', bar).forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.step;
      if (n === 1) pick();
      else if (n === 2) { const t = $('#st-b2'); if (!inView(t)) go(t, -120); flash(t); }
      else { const t = $('#st-b3'); if (!inView(t)) go(t, -140); flash($('#st-go') || t); }
    }));
  }
  function flash(el) { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function steps() {
    const bar = $('#st-steps'); if (!bar) return;
    const st = [!S.demo, userStickers() > 0, S.done.dl || S.done.sent];
    let cur = st.indexOf(false); if (cur < 0) cur = 2;
    if (!S.demo && st[1] === false && S.st.length === 0 && !S.osd) cur = 1;
    $$('li', bar).forEach((li, i) => {
      li.classList.toggle('done', st[i]); li.classList.toggle('now', i === cur);
      const b = $('button', li); if (b) { if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }
    });
    // Ohne Sticker ist Schritt 3 trotzdem erlaubt (Video direkt schicken)
    if (!S.demo && cur === 1 && st[2] === false) $$('li', bar)[2].classList.add('ready'); else $$('li', bar).forEach(li => li.classList.remove('ready'));
  }

  /* ---------- Steuerelemente ---------- */
  function pick() { const i = $('#st-file'); if (i && !S.busy) i.click(); }
  function controls() {
    const play = $('#st-play'), mute = $('#st-mute');
    if (play) play.addEventListener('click', () => { if (video.paused) { S.userPaused = false; if (!S.demo && (video.currentTime < S.a || video.currentTime >= S.b - .05)) video.currentTime = S.a; video.play().catch(() => {}); } else { S.userPaused = true; video.pause(); } });
    if (mute) mute.addEventListener('click', () => { video.muted = !video.muted; mute.setAttribute('aria-pressed', !video.muted); });
    $$('input[name=st-fmt]').forEach(r => r.addEventListener('change', () => { interact(); S.pan.x = S.pan.y = .5; setFmt(r.value, true); }));
    const pan = $('#pan'); if (pan) pan.addEventListener('input', () => { const ax = panAxis(); if (ax === 'x') S.pan.x = pan.value / 100; else if (ax === 'y') S.pan.y = pan.value / 100; panUI(); });
    const sz = $('#stk-size'), rt = $('#stk-rot');
    if (sz) sz.addEventListener('input', () => { const s = byId(S.sel); if (!s) return; s.w = sz.value / 100; place(s); editor(); });
    if (rt) rt.addEventListener('input', () => { const s = byId(S.sel); if (!s) return; s.r = +rt.value; place(s); editor(); });
    const del = $('#stk-del'); if (del) del.addEventListener('click', () => remove(byId(S.sel)));
    const front = $('#stk-front'); if (front) front.addEventListener('click', () => { const s = byId(S.sel); if (!s) return; S.st = S.st.filter(x => x !== s).concat(s); S.st.forEach(place); });
    const clr = $('#stk-clear'); if (clr) clr.addEventListener('click', () => { [...S.st].forEach(remove); setOSD(false); editor(); });
    const ln = $('#ln-name');
    if (ln) {
      ln.addEventListener('input', () => { S.ln.name = ln.value; sumLine(); const p = $('#cf-pilot'); if (p && !p.dataset.touched) p.value = ln.value; });
      ln.addEventListener('focus', () => { S.ln.force = true; }); ln.addEventListener('blur', () => { S.ln.force = false; });
    }
    $$('input[name=ln-mode]').forEach(r => r.addEventListener('change', () => { S.ln.mode = r.value; sumLine(); }));
    $$('[data-st-pick]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); pick(); }));
    const dl = $('#st-dl'), sd = $('#st-send');
    if (dl) dl.addEventListener('click', () => action('dl'));
    if (sd) sd.addEventListener('click', () => action('send'));
    const px = $('#prog-x'); if (px) px.addEventListener('click', () => { if (S.cancel) S.cancel(); });
    const rs = $('#res-send'); if (rs) rs.addEventListener('click', () => { if (S.result) openSend(S.result, 'studio'); });
    const sh = $('#res-share'); if (sh) sh.addEventListener('click', async () => { try { await navigator.share({ files: [S.result], title: 'Mein Clip · Flight Club Saar', text: '#flightclubsaar @flightclubsaar' }); } catch (e) {} });
    const rdl = $('#res-dl'); if (rdl) rdl.addEventListener('click', () => { S.done.dl = true; steps(); });
  }
  function options() {
    const opt = $('#st-opt'); if (!opt) return;
    opt.addEventListener('toggle', () => { if (opt.open) { panUI(); } });
  }
  function fileIn() {
    const inp = $('#st-file'); if (!inp) return;
    inp.addEventListener('change', () => { if (inp.files[0]) loadFile(inp.files[0]); inp.value = ''; });
  }
  function err(msg, actions) {
    const e = $('#st-err'); if (!e) return;
    if (!msg) { e.hidden = true; e.innerHTML = ''; return; }
    e.innerHTML = `<p style="margin:0">${msg}</p>` + (actions || '');
    e.hidden = false;
  }

  /* ---------- Eigenes Video laden ---------- */
  async function loadFile(f) {
    if (!f || S.busy) return;
    if (!isVideo(f)) { err('Das ist keine Videodatei. Bitte wähl ein MP4-, MOV- oder WebM-Video.'); return; }
    interact(); err(null);
    if (S.url) URL.revokeObjectURL(S.url);
    if (S.demo) { S.st.filter(s => s.demo).forEach(remove); if (S.osdDemo) setOSD(false); S.osdDemo = false; }
    S.demo = false; editor(); S.file = f; S.url = URL.createObjectURL(f); S.name = f.name; S.result = null; S.resultSig = ''; S.done = { dl: false, sent: false };
    const drop = $('#st-drop'); if (drop) drop.classList.add('gone'); hideHint();
    const tag = $('#st-tag'); if (tag) { tag.textContent = 'DEIN VIDEO'; tag.classList.add('own'); }
    const nm = $('#st-name'); if (nm) nm.textContent = f.name + ' · ' + MB(f.size);
    const other = $('#st-other'); if (other) { other.classList.remove('solid'); other.classList.add('ghost'); other.textContent = 'Anderes Video'; }
    const res = $('#res'); if (res) res.hidden = true;
    closeSend();
    video.loop = false; video.muted = true; const mute = $('#st-mute'); if (mute) mute.setAttribute('aria-pressed', 'false');
    video.src = S.url;
    if (!inView(stage)) go($('#st-steps') || wrap, -100);
    try { await once(video, 'loadeddata', 15000); }
    catch (e) {
      S.vw = 16; S.vh = 9; S.dur = 0; layout(); tlDraw(); goState(); steps();
      err('Dein Browser kann dieses Video nicht abspielen. Das passiert zum Beispiel mit HEVC-Videos vom iPhone in manchen Browsern. Du kannst es trotzdem ohne Sticker an den Verein schicken.', '<button class="btn" type="button" id="err-send">Ohne Sticker schicken</button>');
      const es = $('#err-send'); if (es) es.addEventListener('click', () => openSend(f, 'direkt'));
      return;
    }
    S.vw = video.videoWidth; S.vh = video.videoHeight;
    let d = video.duration;
    if (!isFinite(d) || !d) { try { video.currentTime = 1e7; await once(video, 'seeked', 5000); d = video.duration; } catch (e) {} if (!isFinite(d) || !d) d = video.currentTime || 0; }
    S.dur = d; S.a = 0; S.b = Math.min(d, MAXLEN);
    S.pan.x = S.pan.y = .5;
    setFmt(S.fmt, false);
    video.currentTime = 0;
    const trim = $('#st-trim'); if (trim) trim.hidden = false;
    tlDraw(); strip(S.url); sumLine(); goState(); steps();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    S.userPaused = false; video.play().catch(() => {});
    // Hinweis: weiter mit Schritt 2
    flash($('#st-b2'));
  }

  /* ---------- Vorführung als Selbst-Impuls ---------- */
  function demo() {
    if (!S.demo || S.interacted) return;
    video.play().catch(() => {});
    const s2 = $('#st-steps li:nth-child(2)');
    if (RM || !gs()) { add('logo', .8, .2, { r: -6, demo: true }); add('ayedo', .24, .2, { demo: true }); setOSD(true); S.osdDemo = true; select(null); return; }
    const tl = demoTL = gs().timeline({ delay: .4 });
    tl.add(() => { if (s2) s2.classList.add('demo'); flyIn('logo', .79, .24, -6, true); })
      .add(() => { flyIn('ayedo', .24, .2, 0, true); }, '+=0.9')
      .add(() => { setOSD(true); S.osdDemo = true; steps(); }, '+=0.8')
      .add(() => { if (!S.ln.name) S.ln.name = 'Dein Pilotenname'; if (s2) s2.classList.remove('demo'); }, '+=0.5')
      .add(() => ghostLoop(), '+=1.6');
  }
  function hideHint() { const h = $('#st-hint'); if (h) h.classList.add('gone'); clearInterval(hintLoop); hintLoop = null; }
  function ghostLoop() {
    if (RM || !gs() || S.interacted) return;
    const run = () => {
      if (S.interacted || !visible) return;
      const b = trayBtn('plakette') || trayBtn('logo'); if (!b) return;
      const br = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      if (br.top > innerHeight || br.bottom < 0 || sr.bottom < 0 || sr.top > innerHeight) return;
      const g = document.createElement('div'); g.className = 'ghostcur'; g.innerHTML = `<img src="${def(b.dataset.k).src}" alt="">`; document.body.appendChild(g);
      gs().timeline({ onComplete: () => g.remove() })
        .fromTo(g, { x: br.left + br.width / 2, y: br.top + br.height / 2, scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)' })
        .to(g, { x: sr.left + sr.width * .5, y: sr.top + sr.height * .55, rotation: -8, duration: 1.2, ease: 'power3.inOut' })
        .to(g, { scale: 1.3, opacity: 0, duration: .4, ease: 'power2.in' });
    };
    run(); hintLoop = setInterval(run, 7000);
  }

  /* ---------- Zeitleiste: kürzen ---------- */
  let stripTok = 0;
  async function strip(url) {
    const tok = ++stripTok, c = $('#tl-strip'), tl = $('#tl'); if (!c || !tl || !tl.clientWidth) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(tl.clientWidth * dpr), H = Math.round(tl.clientHeight * dpr);
    c.width = W; c.height = H; const x = c.getContext('2d'); x.clearRect(0, 0, W, H);
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try { await once(v, 'loadeddata', 8000); } catch (e) { return; }
    const d = v.duration; if (!isFinite(d) || !d) return;
    const n = Math.max(4, Math.round(tl.clientWidth / 64)), tw = W / n;
    for (let i = 0; i < n; i++) {
      if (tok !== stripTok) return;
      v.currentTime = (i + .5) * d / n;
      try { await once(v, 'seeked', 4000); } catch (e) { break; }
      const sa = v.videoWidth / v.videoHeight, ta = tw / H; let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0;
      if (sa > ta) { sw = sh * ta; sx = (v.videoWidth - sw) / 2; } else { sh = sw / ta; sy = (v.videoHeight - sh) / 2; }
      try { x.drawImage(v, sx, sy, sw, sh, i * tw, 0, tw + 1, H); } catch (e) { break; }
    }
    v.removeAttribute('src'); v.load();
  }
  function tlDraw() {
    const A = $('#tl-a'), B = $('#tl-b'); if (!A || !B) return;
    const d = S.dur || 1, pa = S.a / d * 100, pb = S.b / d * 100;
    A.style.left = pa + '%'; B.style.left = pb + '%';
    $('#tl-win').style.left = pa + '%'; $('#tl-win').style.width = (pb - pa) + '%';
    $('#tl-sl').style.width = pa + '%'; $('#tl-sr').style.width = (100 - pb) + '%';
    $('#tl-ra').textContent = tD(S.a); $('#tl-rb').textContent = tD(S.b); $('#tl-rl').textContent = sec(S.b - S.a);
    [[A, S.a], [B, S.b]].forEach(([el, v]) => { el.setAttribute('aria-valuemax', (S.dur || 0).toFixed(1)); el.setAttribute('aria-valuenow', v.toFixed(1)); el.setAttribute('aria-valuetext', (Math.round(v * 10) / 10).toLocaleString('de-DE') + ' Sekunden'); });
    const long = $('#tl-long'); if (long) long.hidden = !(S.dur > MAXLEN);
    sumLine();
  }
  function tick() {
    const ph = $('#tl-ph'), tm = $('#st-time');
    const d = S.dur || video.duration || 1;
    if (ph) ph.style.left = (clamp((video.currentTime || 0) / d, 0, 1) * 100) + '%';
    const t = S.demo ? video.currentTime : video.currentTime - S.a, len = S.demo ? d : S.b - S.a;
    if (tm) tm.textContent = tS(t) + ' / ' + tS(len);
  }
  function timeline() {
    const tl = $('#tl'), A = $('#tl-a'), B = $('#tl-b'), W = $('#tl-win'); if (!tl || !A || !B || !W) return;
    const tAt = x => { const r = tl.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * S.dur; };
    const setA = v => { S.a = clamp(v, 0, S.b - MINLEN); if (S.b - S.a > MAXLEN) S.b = S.a + MAXLEN; };
    const setB = v => { S.b = clamp(v, S.a + MINLEN, S.dur); if (S.b - S.a > MAXLEN) S.a = S.b - MAXLEN; };
    let drag = null;
    tl.addEventListener('pointerdown', e => {
      if (S.demo || !S.dur || S.busy) return;
      e.preventDefault(); try { tl.setPointerCapture(e.pointerId); } catch (er) {}
      const t = tAt(e.clientX);
      if (e.target.closest('.tl-a')) drag = { k: 'a' };
      else if (e.target.closest('.tl-b')) drag = { k: 'b' };
      else if (e.target === W) drag = { k: 'w', t0: t, a0: S.a, b0: S.b };
      else { drag = { k: 'seek' }; video.currentTime = clamp(t, S.a, S.b); }
      video.pause();
    });
    tl.addEventListener('pointermove', e => {
      if (!drag) return;
      const t = tAt(e.clientX);
      if (drag.k === 'a') { setA(t); video.currentTime = S.a; }
      else if (drag.k === 'b') { setB(t); video.currentTime = S.b; }
      else if (drag.k === 'w') { const len = drag.b0 - drag.a0; S.a = clamp(drag.a0 + t - drag.t0, 0, S.dur - len); S.b = S.a + len; video.currentTime = S.a; }
      else video.currentTime = clamp(t, S.a, S.b);
      tlDraw();
    });
    const up = () => { if (!drag) return; drag = null; tlDraw(); };
    tl.addEventListener('pointerup', up); tl.addEventListener('pointercancel', up);
    [[A, 'a'], [B, 'b']].forEach(([el, k]) => el.addEventListener('keydown', e => {
      if (S.demo || !S.dur) return;
      const st = e.shiftKey ? 1 : .1; let v = S[k];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= st; else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += st;
      else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = S.dur; else return;
      e.preventDefault(); k === 'a' ? setA(v) : setB(v); video.pause(); video.currentTime = S[k]; tlDraw();
    }));
  }

  /* ---------- Zusammenfassung + Ausgabegröße ---------- */
  function outDims(mail) {
    const short = mail ? 720 : 1080, long = mail ? 1280 : 1920;
    if (S.fmt === 'orig') {
      const sc = Math.min(1, short / Math.min(S.vw, S.vh), long / Math.max(S.vw, S.vh));
      return { W: even(S.vw * sc), H: even(S.vh * sc) };
    }
    const A = fmtA(S.fmt);
    return A < 1 ? { W: short, H: even(short / A) } : { W: even(short * A), H: short };
  }
  function sumLine() {
    const el = $('#st-sum'); if (!el) return;
    const o = outDims(false), n = S.st.length + (S.osd ? 1 : 0);
    const parts = [(S.fmt === 'orig' ? 'Original' : S.fmt) + ' · ' + o.W + ' × ' + o.H];
    if (!S.demo) parts.push(sec(S.b - S.a));
    parts.push(n === 1 ? '1 Sticker' : n ? n + ' Sticker' : 'ohne Sticker');
    if (S.ln.name.trim() && S.ln.mode !== 'off' && S.ln.name !== 'Dein Pilotenname') parts.push('Name: ' + S.ln.name.trim());
    el.textContent = parts.join(' · ');
  }
  function goState() {
    const why = $('#st-why'); if (!why) return;
    why.classList.remove('bad');
    if (S.demo) why.innerHTML = 'Das ist ein Beispiel. <button type="button" class="linkbtn" data-st-pick2>Wähl zuerst dein Video</button>, dann geht beides mit einem Tipp.';
    else if (!S.dur) why.textContent = 'Dieses Video lässt sich hier nicht bearbeiten, du kannst es aber ohne Sticker schicken.';
    else why.textContent = 'Runterladen speichert dein Video mit allen Logos. Zum Schicken rechnen wir es kleiner, damit es als Anhang passt.';
    const p2 = $('[data-st-pick2]', why); if (p2) p2.addEventListener('click', pick);
    $$('#st-dl,#st-send').forEach(b => b.classList.toggle('wait', S.demo));
  }

  /* ---------- Schritt 3: Runterladen oder schicken ---------- */
  // Unverändertes Video (keine Sticker, kein Format, keine Kürzung) geht direkt raus, ohne neu zu rechnen
  const untouched = () => !S.st.length && !S.osd && !(S.ln.name.trim() && S.ln.mode !== 'off') && S.fmt === 'orig' && S.a < .05 && S.b >= S.dur - .05;
  async function action(kind) {
    if (S.busy) return;
    interact();
    if (S.demo) { pick(); flash($('#st-steps li:first-child')); return; }
    if (!S.dur) { if (kind === 'send' && S.file) openSend(S.file, 'direkt'); return; }
    if (kind === 'send' && untouched() && S.file.size <= maxBytes()) { openSend(S.file, 'direkt'); return; }
    const q = kind === 'send' ? 'mail' : 'hoch', now = sig();
    if (!(S.result && S.resultSig === now && S.resultQ === q)) { const ok = await render(q); if (!ok) return; S.resultSig = now; S.resultQ = q; }
    if (kind === 'dl') { const a = $('#res-dl'); if (a) { try { a.click(); } catch (e) {} } S.done.dl = true; steps(); const rt = $('#res-t'); if (rt) rt.textContent = 'Fertig. Dein Download startet'; }
    else openSend(S.result, 'studio');
  }

  /* ---------- Rendern ---------- */
  async function render(q) {
    if (S.busy || !S.file || !S.dur) return false;
    S.busy = true; $('#st').classList.add('busy'); video.pause();
    const mail = q === 'mail', { W, H } = outDims(mail), len = S.b - S.a;
    const vb = mail ? clamp((((D.upload && D.upload.maxMail) || 9) * .9 * 8 * 1048576) / len - 200000, 350000, 6000000) : null;
    const prog = $('#prog'), fillEl = $('#bat-fill'), pt = $('#prog-t'), eta = $('#prog-eta'), goBox = $('#st-go');
    prog.hidden = false; $('#res').hidden = true; if (goBox) goBox.hidden = true; closeSend();
    const t0 = performance.now();
    const set = p => { p = clamp(p, 0, 1); fillEl.style.transform = `scaleX(${p})`; pt.textContent = `${mail ? 'Wird für den Versand vorbereitet' : 'Wird gerechnet'} … ${Math.round(p * 100)} %`; const el = (performance.now() - t0) / 1000; eta.textContent = p > .04 ? 'noch ca. ' + tS(el / p - el) : ''; };
    set(0);
    if (!inView(prog)) go(prog, -200);
    let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    let out = null, note = '';
    try { await (document.fonts && document.fonts.ready); } catch (e) {}
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; const c2 = cvs.getContext('2d');
    let cancelled = false;
    S.cancel = () => { cancelled = true; if (S._conv) S._conv.cancel().catch(() => {}); if (S._stop) S._stop(); };
    const doneUI = () => { S.busy = false; $('#st').classList.remove('busy'); prog.hidden = true; if (goBox) goBox.hidden = false; S.cancel = null; S._conv = null; S._stop = null; if (ac) ac.close().catch(() => {}); };
    try {
      if (!window.crewForceRecorder && 'VideoEncoder' in window) {
        try { out = await renderWC(W, H, vb, set, cvs, c2, true); }
        catch (e) { if (cancelled) throw e; console.info('Clip-Studio: WebCodecs nicht möglich, nehme MediaRecorder.', e && e.message); }
      }
      if (!out && !cancelled && window.MediaRecorder && cvs.captureStream) {
        try { out = await renderMR(W, H, vb, set, cvs, c2, ac); }
        catch (e) { if (cancelled) throw e; console.info('Clip-Studio: MediaRecorder nicht möglich.', e && e.message); }
      }
      if (!out && !cancelled && 'VideoEncoder' in window) { out = await renderWC(W, H, vb, set, cvs, c2, false); note = ' · ohne Ton'; }
      if (!out) throw new Error('kein Weg');
    } catch (e) {
      doneUI();
      if (cancelled) { goState(); return false; }
      const why = $('#st-why'); why.classList.add('bad');
      why.innerHTML = 'Rechnen hat in diesem Browser nicht geklappt. Du kannst dein Video ohne Sticker schicken. <button class="btn" type="button" id="fail-send">Ohne Sticker schicken</button>';
      const fs = $('#fail-send'); if (fs) fs.addEventListener('click', () => openSend(S.file, 'direkt'));
      return false;
    }
    doneUI(); goState();
    const pilot = (S.ln.name !== 'Dein Pilotenname' && S.ln.name.trim()) || (($('#cf-pilot') || {}).value) || 'clip';
    const file = new File([out.blob], `flightclubsaar_${slug(pilot) || 'clip'}_${today()}.${out.ext}`, { type: out.blob.type });
    S.result = file;
    const rv = $('#res-v'); if (rv.src) URL.revokeObjectURL(rv.src); rv.src = URL.createObjectURL(file);
    const dl = $('#res-dl'); dl.href = rv.src; dl.download = file.name;
    $('#res-t').textContent = 'Fertig gerechnet';
    $('#res-info').textContent = `${out.ext.toUpperCase()} · ${W} × ${H} · ${MB(file.size)}${note}`;
    $('#res-share').hidden = !(navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })());
    $('#res').hidden = false;
    if (gs() && !RM) gs().from('#res', { y: 16, opacity: 0, duration: .6, ease: 'expo.out' });
    return true;
  }

  async function renderWC(W, H, vb, set, cvs, c2, withAudio) {
    const M = await import(new URL(LIB, document.baseURI).href);
    const input = new M.Input({ source: new M.BlobSource(S.file), formats: M.ALL_FORMATS });
    try {
      const vt = await input.getPrimaryVideoTrack();
      if (!vt) throw new Error('keine Videospur');
      if (!(await vt.canDecode())) throw new Error('nicht dekodierbar');
      const dw = await vt.getDisplayWidth(), dh = await vt.getDisplayHeight();
      const c = crop(dw, dh, fmtA(S.fmt));
      const cr = { left: Math.round(c.cx), top: Math.round(c.cy), width: Math.min(dw - Math.round(c.cx), Math.round(c.cw)), height: Math.min(dh - Math.round(c.cy), Math.round(c.ch)) };
      const opt = { width: W, height: H };
      let fmt = new M.Mp4OutputFormat({ fastStart: 'in-memory' }), ext = 'mp4', aList = ['aac', 'opus'];
      let vc = await M.getFirstEncodableVideoCodec(['avc'], opt);
      if (!vc) { fmt = new M.WebMOutputFormat(); ext = 'webm'; aList = ['opus', 'vorbis']; vc = await M.getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], opt); }
      if (!vc) throw new Error('kein Video-Encoder');
      let audio = { discard: true };
      const at = withAudio ? await input.getPrimaryAudioTrack() : null;
      if (at) {
        const acod = await at.getCodec();
        if (acod && aList.includes(acod)) audio = { codec: acod };
        else { const enc = await M.getFirstEncodableAudioCodec(aList); if (!enc) throw new Error('kein Audio-Encoder'); audio = { codec: enc, bitrate: 160000 }; }
      }
      const output = new M.Output({ format: fmt, target: new M.BufferTarget() });
      const vopt = { crop: cr, width: W, height: H, fit: 'fill', codec: vc, forceTranscode: true, allowTransformationMetadata: false, processedWidth: W, processedHeight: H,
        process: s => { c2.fillStyle = '#000'; c2.fillRect(0, 0, W, H); s.draw(c2, 0, 0, W, H); overlay(c2, W, H, Math.max(0, s.timestamp), false); return cvs; } };
      if (vb) vopt.bitrate = vb; else vopt.quality = M.QUALITY_HIGH;
      const conv = await M.Conversion.init({ input, output, tracks: 'primary', trim: { start: S.a, end: S.b }, video: vopt, audio, showWarnings: false });
      if (!conv.isValid) throw new Error('ungültig: ' + conv.discardedTracks.map(d => d.reason).join(','));
      if (at && conv.discardedTracks.some(d => d.track.type === 'audio')) throw new Error('Ton nicht übertragbar');
      S._conv = conv;
      conv.onProgress = p => set(p);
      await conv.execute();
      return { blob: new Blob([output.target.buffer], { type: fmt.mimeType }), ext };
    } finally { try { input.dispose(); } catch (e) {} }
  }

  function renderMR(W, H, vb, set, cvs, c2, ac) {
    return new Promise(async (resolve, reject) => {
      const types = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) { reject(new Error('kein Format')); return; }
      const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.src = S.url; v.muted = !ac;
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.appendChild(v);
      const clean = () => { try { v.pause(); v.remove(); } catch (e) {} };
      try { await once(v, 'loadeddata', 15000); } catch (e) { clean(); reject(e); return; }
      const stream = cvs.captureStream(30);
      if (ac) {
        try { if (ac.state === 'suspended') await ac.resume(); const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) {}
      }
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: vb || 8000000 });
      const parts = []; rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      let done = false, raf = 0;
      const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); try { rec.stop(); } catch (e) {} v.pause(); };
      S._stop = () => { finish(); clean(); reject(new Error('abgebrochen')); };
      rec.onstop = () => { clean(); stream.getTracks().forEach(t => t.stop()); const type = mime.split(';')[0]; resolve({ blob: new Blob(parts, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm' }); };
      v.currentTime = S.a; try { await once(v, 'seeked', 8000); } catch (e) {}
      const len = S.b - S.a, paint = () => {
        const c = crop(v.videoWidth, v.videoHeight, fmtA(S.fmt));
        c2.drawImage(v, c.cx, c.cy, c.cw, c.ch, 0, 0, W, H);
        const t = Math.max(0, v.currentTime - S.a); overlay(c2, W, H, t, false); set(t / len);
      };
      const fr = () => { if (done) return; paint(); if (v.currentTime >= S.b || v.ended) { finish(); return; } raf = requestAnimationFrame(fr); };
      paint(); rec.start(500);
      try { await v.play(); } catch (e) { finish(); clean(); reject(e); return; }
      v.addEventListener('ended', finish);
      raf = requestAnimationFrame(fr);
    });
  }

  /* =====================================================================
     An den Verein schicken: kurzes Formular
     ===================================================================== */
  const SEND = { file: null, url: '', route: null };
  function closeSend() { const f = $('#clipform'); if (f && !f.classList.contains('sent')) f.hidden = true; }
  function openSend(file, from) {
    const form = $('#clipform'); if (!file || !form) return;
    SEND.file = file;
    form.hidden = false; form.classList.remove('sent');
    const ok = $('.form-ok', form), bad = $('.form-bad', form); if (ok) ok.hidden = true; if (bad) bad.hidden = true;
    const att = $('#cf-att'), st = $('#cf-status'), big = file.size > maxBytes(), link = (D.upload && D.upload.link) || '';
    $('#cf-vn').textContent = file.name; $('#cf-vs').textContent = MB(file.size) + (from === 'studio' ? ' · mit deinen Logos' : ' · unverändert');
    const badge = $('#cf-badge'), bx = $('#cf-big');
    if (!big) {
      form._extra = attach(att, file) ? null : () => ({ attachment: file });
      st.value = `Anhang: ${file.name} (${MB(file.size)})`;
      badge.textContent = 'geht als Anhang mit'; badge.className = 'tag green';
      bx.hidden = true; SEND.route = 'mail';
    } else {
      attach(att, null); form._extra = null;
      st.value = `Zu groß für den Anhang (${MB(file.size)}), kommt per ${link ? 'Upload-Link' : 'WhatsApp'}: ${file.name}`;
      badge.textContent = 'zu groß für den Anhang'; badge.className = 'tag amber';
      if (link) {
        $('#cf-big-t').innerHTML = `<b>Dein Clip ist ${MB(file.size)} groß</b>, zu viel für den Anhang. Lad ihn über den Knopf hoch und schick danach hier deinen Namen ab, damit wir ihn zuordnen können.`;
        $('#cf-big-b').innerHTML = `<a class="btn amber solid" href="${esc(link)}" target="_blank" rel="noopener">Video hochladen ↗</a>`;
        SEND.route = 'link';
      } else {
        $('#cf-big-t').innerHTML = `<b>Dein Clip ist ${MB(file.size)} groß</b>, zu viel für den Anhang. Schick hier deinen Namen ab und das Video per WhatsApp: Knopf antippen, dann das Video im Chat anhängen.`;
        $('#cf-big-b').innerHTML = (D.kontakte || []).map(k => `<a class="btn wa" data-wa="${esc(k.wa)}" data-n="${esc(k.name)}" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener">${ICON.wa}Per WhatsApp an ${esc(k.name)} ↗</a>`).join('');
        waLinks(); SEND.route = 'wa';
      }
      bx.hidden = false;
    }
    const p = $('#cf-pilot'); if (p && !p.value && S.ln.name.trim() && S.ln.name !== 'Dein Pilotenname') p.value = S.ln.name.trim();
    if (gs() && !RM) gs().from(form, { y: 14, opacity: 0, duration: .55, ease: 'expo.out', clearProps: 'all' });
    setTimeout(() => { if (!inView(form)) go(form, -120); if (p) p.focus({ preventScroll: true }); }, 60);
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 200);
  }
  function waLinks() {
    const p = ($('#cf-pilot') || {}).value || '';
    $$('#cf-big-b [data-wa]').forEach(a => { a.href = `https://wa.me/${a.dataset.wa}?text=${encodeURIComponent(`Hallo ${a.dataset.n}, hier kommt mein Clip für den Flight Club Saar${p.trim() ? ' (' + p.trim() + ')' : ''}. Meinen Namen habe ich über die Website geschickt.`)}`; });
  }
  function sendForm() {
    const f = $('#clipform'); if (!f) return;
    $$('[data-maxmail]').forEach(e => { e.textContent = (D.upload && D.upload.maxMail) || 9; });
    const pilot = $('#cf-pilot');
    if (pilot) pilot.addEventListener('input', () => { pilot.dataset.touched = 1; waLinks(); });
    const back = $('#cf-back'); if (back) back.addEventListener('click', () => { f.hidden = true; const g = $('#st-go'); if (g) g.hidden = false; });
    f.addEventListener('fcs:sent', () => {
      S.done.sent = true; steps();
      const t = $('#cf-ok-t');
      if (t && SEND.route === 'wa') t.textContent = 'Dein Name ist angekommen. Schick jetzt noch das Video per WhatsApp, die Knöpfe stehen oben im Formular.';
      else if (t && SEND.route === 'link') t.textContent = 'Dein Name ist angekommen. Denk daran, das Video über den Upload-Knopf hochzuladen.';
    });
    reach();
  }
  /* Reichweite der Vereinskanäle (FCS.data.stats), zählt hoch, wenn sie ins Bild kommt */
  function reach() {
    const box = $('#reach-g'), s = D.stats; if (!box) return;
    if (!s) { const r = $('#reach'); if (r) r.hidden = true; return; }
    const items = [s.instagram && ['Instagram', s.instagram.follower], s.tiktok && ['TikTok', s.tiktok.follower], s.youtube && ['YouTube', s.youtube.abos], s.whatsapp && ['WhatsApp', s.whatsapp]].filter(Boolean);
    box.innerHTML = items.map(([n, v]) => `<span><b data-to="${v}">${RM ? v.toLocaleString('de-DE') : '0'}</b> ${n}</span>`).join('');
    const sEl = $('#reach-s'); if (sEl) sEl.textContent = 'Stand ' + s.stand;
    if (RM || !gs()) return;
    const run = () => $$('b[data-to]', box).forEach(b => { const o = { v: 0 }; gs().to(o, { v: +b.dataset.to, duration: 1.8, ease: 'expo.out', onUpdate: () => { b.textContent = Math.round(o.v).toLocaleString('de-DE'); } }); });
    new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); run(); } }, { threshold: .5 }).observe(box);
  }

  /* Werkzeuge: Hashtag kopieren */
  function copyTag() {
    const b = $('#tag-copy'), t = $('#tag-txt'); if (!b || !t) return;
    b.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(t.textContent); ok = true; } catch (e) {
        const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { ok = document.execCommand('copy'); } catch (er) {}
      }
      b.textContent = ok ? 'Kopiert' : 'Markiert, jetzt kopieren'; b.classList.toggle('ok', ok);
      setTimeout(() => { b.textContent = 'Kopieren'; b.classList.remove('ok'); }, 2200);
    });
  }

  /* ===================================================================== */
  function init() {
    if (!$('#studio')) return;
    D = (window.FCS && FCS.data) || {}; RM = window.FCS ? FCS.rm : matchMedia('(prefers-reduced-motion: reduce)').matches; FINE = window.FCS ? FCS.fine : matchMedia('(hover:hover) and (pointer:fine)').matches;
    D.upload = D.upload || { link: '', maxMail: 9 };
    [studio, sendForm, copyTag].forEach(fn => { try { fn(); } catch (e) { console.error('Clip-Studio:', fn.name, e); } });
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
