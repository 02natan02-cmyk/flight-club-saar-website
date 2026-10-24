/* Flight Club Saar – Crew-Bereich
   Clip-Studio (Video im Browser öffnen, Sticker, Format, Kürzen, Bauchbinde, Rendern mit mediabunny/WebCodecs,
   sonst MediaRecorder), Einsenden mit automatischem Versandweg, Werkzeugkasten, Profil mit Live-Karte,
   Crew 2026, Piloten aus der Community, Pinnwand. */
(function () {
  'use strict';

  /* ===== Sticker: neue einfach als Zeile ergänzen =====
     k = Schlüssel, n = Name, src = Datei, w = Startbreite als Anteil der Bildbreite.
     typ 'osd' = Live-OSD-Rahmen: wird passend zum Format gezeichnet, mit laufender Flugzeit.
     opt = Datei kommt evtl. erst später: Der Sticker bleibt ausgeblendet, solange die Datei nicht lädt. */
  const STICKER = [
    { k: 'logo', n: 'Vereinslogo', src: 'assets/img/sticker/vereinslogo.svg', w: .28 },
    { k: 'plakette', n: 'Logo rund', src: 'assets/img/sticker/logo-plakette.svg', w: .15 },
    { k: 'osd', n: 'OSD-Rahmen', src: 'assets/img/sticker/osd-rahmen.svg', typ: 'osd' },
    { k: 'brille', n: 'Brille an, Welt aus!', src: 'assets/img/sticker/brille-an.svg', w: .34 },
    { k: 'build', n: 'Build · Fly · Crash', src: 'assets/img/sticker/build-fly.svg', w: .62 },
    { k: 'saarland', n: 'Saarland', src: 'assets/img/sticker/saarland.svg', w: .34 },
    { k: 'fpv', n: 'FPV', src: 'assets/img/sticker/fpv.svg', w: .2 },
    { k: 'crash', n: 'Crash & Repeat', src: 'assets/img/sticker/crash-repeat.svg', w: .26 },
    { k: 'wz', n: '@flightclubsaar', src: 'assets/img/sticker/wasserzeichen.svg', w: .3 },
    { k: 'sendit', n: 'Send it', src: 'assets/img/sticker/send-it.svg', w: .15 },
    { k: 'herz', n: 'FPV Liebe', src: 'assets/img/sticker/fpv-herz.svg', w: .15 },
    { k: 'vollgas', n: 'Vollgas', src: 'assets/img/sticker/vollgas.svg', w: .15 },
    { k: 'akku', n: 'Akku leer', src: 'assets/img/sticker/akku-leer.svg', w: .15 },
    { k: 'ayedo', n: 'Ayedo (Sponsor)', src: 'assets/img/partner/ayedo-logo.svg', w: .3, opt: 1 },
    { k: 'fpvalien', n: 'Unser FPV-Alien', src: 'assets/img/partner/fpv-alien.webp', w: .22, opt: 1 },
    { k: 'alienquad', n: 'Alien-Kopter', src: 'assets/img/partner/fpv-alien-quad.webp', w: .16, opt: 1 }
  ];
  const LIB = 'assets/lib/mediabunny.min.mjs';
  const MAXLEN = 60, MINLEN = .5;
  const SIG = '#3fe0ff', AMBER = '#ffb020', RED = '#ff4b5c', NIGHT = '#040912';
  const ICON = {
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.9 5.9 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>'
  };
  const SOC = { ig: ['Instagram', h => 'https://www.instagram.com/' + h + '/'], tt: ['TikTok', h => 'https://www.tiktok.com/@' + h], yt: ['YouTube', h => 'https://www.youtube.com/@' + h] };

  let D, RM, FINE, $, $$;
  const gs = () => window.gsap;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const even = v => Math.max(2, Math.round(v / 2) * 2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MB = b => (b / 1048576).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
  const tS = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };
  const tD = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + r.toFixed(1).padStart(4, '0').replace('.', ','); };
  const sec = s => (Math.round(s * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  const handle = v => String(v || '').trim().replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|youtube\.com)\/?/i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  const go = el => { if (!el) return; FCS.lenis ? FCS.lenis.scrollTo(el, { offset: -80 }) : el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const attach = (input, file) => { try { const dt = new DataTransfer(); if (file) dt.items.add(file); input.files = dt.files; return true; } catch (e) { return false; } };
  const once = (el, ev, ms) => new Promise((res, rej) => { let t; const ok = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); res(); }; const bad = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); rej(new Error('error')); }; el.addEventListener(ev, ok); el.addEventListener('error', bad); if (ms) t = setTimeout(() => { el.removeEventListener(ev, ok); el.removeEventListener('error', bad); rej(new Error('timeout')); }, ms); });
  const slug = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const deDate = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const maxBytes = () => ((D.upload && D.upload.maxMail) || 9) * 1048576;

  /* Bild verkleinern (Profilbild, Pinnwand-Foto) */
  function shrink(file, max, name) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(b => b ? res(new File([b], name, { type: 'image/jpeg' })) : rej(new Error('blob')), 'image/jpeg', .86);
      };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
      img.src = u;
    });
  }
  function dropZone(zone, input, onFile) {
    ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', ev => { const f = ev.dataTransfer && ev.dataTransfer.files[0]; if (f) onFile(f); });
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
  }
  function chipsToHidden(box, hidden, cb) {
    const upd = () => { hidden.value = $$('input:checked', box).map(i => i.value).join(', '); const f = hidden.closest('.field'); if (f && hidden.value) f.classList.remove('bad'); if (cb) cb(hidden.value); };
    box.addEventListener('change', upd); upd();
  }

  /* =====================================================================
     1 · Seitenkopf: OSD-Menü mit wanderndem Cursor + Flugzeit
     ===================================================================== */
  function head() {
    const clock = $('#cw-clock'), t0 = Date.now();
    if (clock) setInterval(() => { clock.textContent = tS((Date.now() - t0) / 1000).padStart(5, '0'); }, 1000);
    const m = $('#cw-menu'); if (!m) return;
    const items = $$('a', m); let i = 0, auto = null;
    const on = n => { i = (n + items.length) % items.length; items.forEach((a, k) => a.classList.toggle('on', k === i)); };
    on(0);
    const stop = () => { if (auto) { clearInterval(auto); auto = null; } };
    if (!RM) auto = setInterval(() => on(i + 1), 1700);
    items.forEach((a, k) => { a.addEventListener('pointerenter', () => { stop(); on(k); }); a.addEventListener('focus', () => { stop(); on(k); }); });
    m.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault(); stop(); on(i + (e.key === 'ArrowDown' ? 1 : -1)); items[i].focus();
    });
    m.addEventListener('pointerdown', stop);
    if (gs() && !RM) gs().from(items, { x: 40, opacity: 0, stagger: .08, duration: .8, ease: 'expo.out', delay: .5 });
  }

  /* =====================================================================
     2 · Clip-Studio
     ===================================================================== */
  const S = {
    demo: true, file: null, url: '', name: 'Beispielvideo',
    vw: 1280, vh: 720, dur: 0, fmt: 'orig', aspect: 16 / 9,
    pan: { x: .5, y: .5 }, a: 0, b: 0,
    st: [], sel: null, uid: 0, osd: false,
    ln: { name: '', mode: 'start', force: false }, q: 'hoch', busy: false, interacted: false
  };
  const IMG = {};
  let video, cv, ctx, stage, wrap, layer, tray, box = { w: 0, h: 0 }, poster;
  let demoTL = null, hintLoop = null, visible = false, looping = false;

  const def = k => STICKER.find(s => s.k === k);
  const fmtA = f => f === '9:16' ? 9 / 16 : f === '1:1' ? 1 : f === '16:9' ? 16 / 9 : (S.vw / S.vh || 16 / 9);
  const byId = id => S.st.find(s => s.id === +id);

  function loadImgs() {
    STICKER.forEach(d => {
      const el = new Image(); el.decoding = 'async';
      const o = IMG[d.k] = { el, ok: false, ar: 1 };
      el.onload = () => { o.ok = true; o.ar = (el.naturalHeight || 1) / (el.naturalWidth || 1); S.st.filter(s => s.k === d.k).forEach(place); };
      el.onerror = () => { o.ok = false; const b = tray && tray.querySelector(`[data-k="${d.k}"]`); if (b) b.remove(); S.st.filter(s => s.k === d.k).forEach(remove); };
      el.src = d.src;
    });
  }

  function studio() {
    stage = $('#st-stage'); wrap = $('#st-wrap'); layer = $('#st-layer'); tray = $('#tray'); cv = $('#st-cv');
    if (!stage) return;
    ctx = cv.getContext('2d');
    video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto'; video.loop = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:absolute;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
    wrap.appendChild(video);
    poster = new Image(); poster.src = 'media/hero.webp';
    loadImgs(); buildTray(); tabs(); gestures(); trayDrag(); keys(); timeline(); controls(); fileIn();
    layout(); addEventListener('resize', () => { layout(); tlDraw(); });
    if (document.fonts) { document.fonts.load('400 40px "Bebas Neue"'); document.fonts.load('600 20px "Chakra Petch"'); }
    video.addEventListener('loadedmetadata', () => { if (S.demo) { S.vw = video.videoWidth || 1280; S.vh = video.videoHeight || 720; S.dur = video.duration || 13; S.a = 0; S.b = Math.min(S.dur, MAXLEN); tlDraw(); } });
    video.addEventListener('play', () => { const b = $('#st-play'); b.classList.add('on'); b.setAttribute('aria-label', 'Pause'); });
    video.addEventListener('pause', () => { const b = $('#st-play'); b.classList.remove('on'); b.setAttribute('aria-label', 'Abspielen'); });
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) { if (!looping) loop(); if (S.demo && !S.busy) video.play().catch(() => {}); }
      else if (!video.paused) video.pause();
    }, { rootMargin: '120px 0px' }).observe(wrap);
    // Selbst-Impuls: Demo startet, sobald das Studio ins Bild kommt
    const startDemo = () => demo();
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: '#st', start: 'top 75%', once: true, onEnter: startDemo });
    else startDemo();
    // Jede echte Bedienung beendet die Demo
    const st = $('#st');
    ['pointerdown', 'keydown'].forEach(ev => st.addEventListener(ev, e => { if (e.isTrusted) interact(); }, true));
    updSum(); renderState();
  }

  function interact() {
    if (S.interacted) return;
    S.interacted = true;
    if (demoTL) { demoTL.kill(); demoTL = null; }
    clearInterval(hintLoop); hintLoop = null;
    const f = ($('input[name=st-fmt]:checked') || {}).value || 'orig';
    if (gs()) gs().killTweensOf(S.pan);
    if (f !== S.fmt || Math.abs(S.aspect - fmtA(f)) > .001) setFmt(f, false);
    S.st.forEach(s => { s.a = 1; });
    if (S.ln.name === 'Dein Pilotenname' && !$('#ln-name').value) S.ln.name = '';
    $$('.ghostcur').forEach(g => g.remove());
  }

  /* ---------- Bühne: Größe ---------- */
  function layout() {
    const cs = getComputedStyle(wrap), px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const desk = innerWidth > 1040;
    const maxH = Math.min(innerHeight * (desk ? .66 : .6), desk ? 620 : 560);
    const avail = wrap.clientWidth - px;
    let w = avail, h = w / S.aspect;
    if (h > maxH) { h = maxH; w = h * S.aspect; }
    wrap.style.height = desk ? (maxH + py) + 'px' : '';
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
    // Akku: sinkt langsam mit der Flugzeit
    const v = Math.max(14, 16.4 - t * .012), lvl = (v - 14) / 2.6;
    c.fillStyle = '#fff'; c.textAlign = 'left'; const vt = v.toFixed(1) + 'V'; c.fillText(vt, m + 2.2 * u, top);
    const bx = m + 2.2 * u + c.measureText(vt).width + 1.6 * u, bw = 6.4 * u, bh = 2.8 * u;
    c.lineWidth = Math.max(1, .4 * u); c.strokeRect(bx, top - bh / 2, bw, bh); c.fillRect(bx + bw, top - bh / 4, .6 * u, bh / 2);
    c.fillStyle = lvl > .35 ? SIG : AMBER; c.fillRect(bx + .5 * u, top - bh / 2 + .5 * u, (bw - u) * clamp(lvl, .05, 1), bh - u);
    // Flugzeit
    c.fillStyle = SIG; c.textAlign = 'right'; c.fillText(tS(t).padStart(5, '0'), W - m - 2.2 * u, top);
    // REC
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
    // Beim Spulen kurz kein Bild: letztes Bild stehen lassen statt schwarz zu blinken
    if (!f && !S.demo && drawnFor === W + 'x' + H) return;
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

  /* ---------- Sticker-Leiste ---------- */
  function buildTray() {
    tray.innerHTML = STICKER.map(d => `<button type="button" data-k="${d.k}"${d.typ === 'osd' ? ' aria-pressed="false"' : ''} aria-label="${d.typ === 'osd' ? 'OSD-Rahmen ein- oder ausschalten' : 'Sticker ' + esc(d.n) + ' hinzufügen'}"><img src="${d.src}" alt="" draggable="false"><span>${esc(d.n)}</span></button>`).join('');
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
    });
    const help = $('#st-help-tray'); if (help && !FINE) help.textContent = 'Tipp einen Sticker an, er landet auf dem Video. Dort kannst du ihn verschieben.';
    const ds = $('#st-drop span'); if (ds && !FINE) ds.textContent = 'MP4, MOV oder WebM · bleibt auf deinem Handy';
    const ht = $('#st-hint-t'); if (ht && !FINE) ht.textContent = 'Tipp einen Sticker an';
  }
  function setOSD(on) {
    S.osd = on; const b = tray.querySelector('[data-k=osd]'); if (b) b.setAttribute('aria-pressed', on);
    updSum();
  }
  function trayDrag() {
    tray.addEventListener('pointerdown', e => {
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
        if (!st.g) return;
        st.g.remove(); b._dragged = true; setTimeout(() => { b._dragged = false; }, 0);
        if (over(ev)) {
          const r = stage.getBoundingClientRect();
          const s = add(d.k, clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
          pulse(s); hideHint();
        }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    const over = ev => { const r = stage.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
  }

  /* ---------- Sticker-Modell ---------- */
  function add(k, x = .5, y = .5, o = {}) {
    const d = def(k), im = IMG[k]; if (!d || !im) return null;
    let w = o.w || d.w;
    const ar = im.ar || 1;
    if (w * box.w * ar > box.h * .9) w = box.h * .9 / (box.w * ar);
    const s = { id: ++S.uid, k, x, y, w, r: o.r || 0, a: o.a == null ? 1 : o.a, demo: !!o.demo };
    S.st.push(s); mkHandle(s); select(s.id); updSum();
    return s;
  }
  function mkHandle(s) {
    const d = def(s.k), h = document.createElement('div');
    h.className = 'stk'; h.tabIndex = 0; h.dataset.id = s.id;
    h.setAttribute('role', 'button');
    h.setAttribute('aria-label', `Sticker ${d.n}. Pfeiltasten verschieben, Plus und Minus ändern die Größe, Q und E drehen, Entf löscht.`);
    h.setAttribute('data-lenis-prevent-wheel', '');
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
    S.st.forEach(place); updSum();
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
  function flyIn(k, x, y, r) {
    const b = tray.querySelector(`[data-k="${k}"]`);
    const s = add(k, x, y, { r, a: 0, demo: S.demo && !S.interacted }); if (!s) return null;
    const br = b && b.getBoundingClientRect();
    if (!gs() || RM || !br || !br.width || br.top > innerHeight + 300 || br.bottom < -300) { s.a = 1; pulse(s); return s; }
    const sr = stage.getBoundingClientRect(), im = IMG[k];
    const g = document.createElement('div'); g.className = 'dragghost'; g.style.margin = '0'; g.innerHTML = `<img src="${def(k).src}" alt="">`; document.body.appendChild(g);
    const tw = s.w * sr.width;
    gs().fromTo(g, { x: br.left + br.width / 2, y: br.top + br.height / 2, width: br.width * .7, height: br.width * .7, xPercent: -50, yPercent: -50, rotation: -30 },
      { x: sr.left + x * sr.width, y: sr.top + y * sr.height, width: tw, height: tw * im.ar, rotation: r || 0, duration: .85, ease: 'expo.inOut',
        onComplete: () => { g.remove(); s.a = 1; } });
    return s;
  }
  function editor() {
    const s = byId(S.sel), ed = $('#stk-edit'), none = $('#stk-none');
    ed.hidden = !s; none.hidden = !!s;
    if (!s) return;
    $('#stk-name').textContent = def(s.k).n;
    const sz = $('#stk-size'), rt = $('#stk-rot');
    sz.value = Math.round(s.w * 100); rt.value = Math.round(((s.r + 540) % 360) - 180);
    $('#stk-size-o').textContent = sz.value + ' %'; $('#stk-rot-o').textContent = rt.value + '°';
    fill(sz); fill(rt);
  }
  function fill(r) { r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }

  /* ---------- Gesten auf der Bühne ---------- */
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
        select(s.id); hideHint(); s.demo = false;
        stage.style.touchAction = 'none';
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
      if (P.size === 0) { if (G && G.s && G.s.h) G.s.h.classList.remove('drag'); G = null; panUI(); }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', e => {
      const h = e.target.closest('.stk'); if (!h || S.busy) return;
      const s = byId(h.dataset.id); if (!s) return;
      e.preventDefault(); interact(); select(s.id); s.demo = false;
      if (e.shiftKey) s.r = ((s.r + Math.sign(e.deltaY || e.deltaX) * 5 + 540) % 360) - 180;
      else s.w = clamp(s.w * Math.exp(-e.deltaY * .0015), .03, 1.6);
      place(s); editor();
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
        case 'Delete': case 'Backspace': { const i = S.st.indexOf(s); remove(s); const n = S.st[Math.min(i, S.st.length - 1)]; if (n && n.h) n.h.focus(); else $('#tray button') && $('#tray button').focus(); e.preventDefault(); return; }
        case 'Escape': select(null); h.blur(); return;
        default: return;
      }
      e.preventDefault(); place(s); editor();
    });
  }

  /* ---------- Format und Ausschnitt ---------- */
  function setFmt(f, anim) {
    S.fmt = f;
    const r = $(`input[name=st-fmt][value="${f}"]`); if (r) r.checked = true;
    const A = fmtA(f);
    $('#st-fmt').textContent = f === 'orig' ? 'ORIGINAL' : f;
    if (gs()) gs().killTweensOf(S, 'aspect');
    if (anim && gs() && !RM) gs().to(S, { aspect: A, duration: .9, ease: 'expo.inOut', onUpdate: layout, onComplete: () => { layout(); panUI(); } });
    else { S.aspect = A; layout(); }
    panUI(); updSum();
  }
  function panAxis() {
    const f = frameSrc(); if (!f) return null;
    const sa = f.w / f.h, A = fmtA(S.fmt);
    return sa > A + .01 ? 'x' : sa < A - .01 ? 'y' : null;
  }
  function panUI() {
    const ax = panAxis(), row = $('#pan-row'), help = $('#pan-help'), r = $('#pan');
    row.hidden = !ax; help.hidden = !ax;
    stage.classList.toggle('pan-x', ax === 'x'); stage.classList.toggle('pan-y', ax === 'y');
    stage.style.touchAction = ax === 'x' ? 'pan-y' : ax === 'y' ? 'pan-x' : 'pan-x pan-y';
    if (!ax) return;
    const v = ax === 'x' ? S.pan.x : S.pan.y;
    $('#pan-lbl').textContent = ax === 'x' ? 'Ausschnitt ↔' : 'Ausschnitt ↕';
    r.value = Math.round(v * 100); fill(r);
    $('#pan-o').textContent = v < .4 ? (ax === 'x' ? 'Links' : 'Oben') : v > .6 ? (ax === 'x' ? 'Rechts' : 'Unten') : 'Mitte';
  }

  /* ---------- Reiter im Bedienfeld ---------- */
  function tabs() {
    const tl = $('.st-tabs'), ts = $$('[role=tab]', tl), bar = $('.st-tabs-bar', tl);
    const sel = (t, focus) => {
      ts.forEach((x, i) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; if (on) bar.style.transform = `translateX(${i * 100}%)`; });
      if (focus) t.focus();
      S.ln.force = t.id === 'tab-name';
      if (t.id === 'tab-go') updSum();
      if (gs() && !RM) gs().from($('#' + t.getAttribute('aria-controls')).children, { y: 12, opacity: 0, stagger: .04, duration: .45, ease: 'expo.out', clearProps: 'all' });
    };
    ts.forEach((t, i) => {
      t.addEventListener('click', () => sel(t));
      t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); sel(ts[(i + d + ts.length) % ts.length], true); });
    });
    $$('[data-go]').forEach(b => b.addEventListener('click', () => { const t = $('#' + b.dataset.go); sel(t, true); if (innerWidth <= 1040) go($('.st-panel')); }));
  }

  /* ---------- Steuerelemente ---------- */
  function controls() {
    $('#st-play').addEventListener('click', () => { if (video.paused) { if (!S.demo && (video.currentTime < S.a || video.currentTime >= S.b - .05)) video.currentTime = S.a; video.play().catch(() => {}); } else video.pause(); });
    $('#st-mute').addEventListener('click', () => { video.muted = !video.muted; $('#st-mute').setAttribute('aria-pressed', !video.muted); });
    $$('input[name=st-fmt]').forEach(r => r.addEventListener('change', () => { interact(); S.pan.x = S.pan.y = .5; setFmt(r.value, true); }));
    const pan = $('#pan'); pan.addEventListener('input', () => { const ax = panAxis(); if (ax === 'x') S.pan.x = pan.value / 100; else if (ax === 'y') S.pan.y = pan.value / 100; panUI(); });
    const sz = $('#stk-size'), rt = $('#stk-rot');
    sz.addEventListener('input', () => { const s = byId(S.sel); if (!s) return; s.w = sz.value / 100; place(s); editor(); });
    rt.addEventListener('input', () => { const s = byId(S.sel); if (!s) return; s.r = +rt.value; place(s); editor(); });
    $('#stk-del').addEventListener('click', () => remove(byId(S.sel)));
    $('#stk-front').addEventListener('click', () => { const s = byId(S.sel); if (!s) return; S.st = S.st.filter(x => x !== s).concat(s); S.st.forEach(place); });
    $('#stk-clear').addEventListener('click', () => { [...S.st].forEach(remove); setOSD(false); });
    const ln = $('#ln-name');
    ln.addEventListener('input', () => { S.ln.name = ln.value; updSum(); const p = $('#cf-pilot'); if (p && !p.dataset.touched) p.value = ln.value; });
    $$('input[name=ln-mode]').forEach(r => r.addEventListener('change', () => { S.ln.mode = r.value; updSum(); }));
    $$('input[name=st-q]').forEach(r => r.addEventListener('change', () => { S.q = r.value; updSum(); }));
    $('#st-render').addEventListener('click', () => { if (S.demo) { $('#st-file').click(); return; } render(); });
    $('#prog-x').addEventListener('click', () => { if (S.cancel) S.cancel(); });
    $('#res-send').addEventListener('click', () => { if (S.result) { setSend(S.result, 'studio'); go($('#einsenden')); } });
    $('#res-share').addEventListener('click', async () => { try { await navigator.share({ files: [S.result], title: 'Mein Clip · Flight Club Saar', text: '#flightclubsaar @flightclubsaar' }); } catch (e) {} });
    fill(sz); fill(rt);
  }
  function fileIn() {
    const inp = $('#st-file');
    inp.addEventListener('change', () => { if (inp.files[0]) loadFile(inp.files[0]); inp.value = ''; });
  }
  function err(msg, actions) {
    const e = $('#st-err');
    if (!msg) { e.hidden = true; e.innerHTML = ''; return; }
    e.innerHTML = `<p style="margin:0">${msg}</p>` + (actions || '');
    e.hidden = false;
  }

  /* ---------- Eigenes Video laden ---------- */
  async function loadFile(f) {
    if (!f || S.busy) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(f.name)) { err('Das ist keine Videodatei. Bitte wähl ein MP4-, MOV- oder WebM-Video.'); return; }
    interact(); err(null);
    if (S.url) URL.revokeObjectURL(S.url);
    if (S.demo) { S.st.filter(s => s.demo).forEach(remove); if (S.osdDemo) setOSD(false); S.osdDemo = false; }
    S.demo = false; S.file = f; S.url = URL.createObjectURL(f); S.name = f.name;
    $('#st-drop').classList.add('gone'); hideHint();
    const tag = $('#st-tag'); tag.textContent = 'DEIN VIDEO'; tag.classList.add('own');
    $('#st-name').textContent = f.name + ' · ' + MB(f.size);
    video.loop = false; video.muted = true; $('#st-mute').setAttribute('aria-pressed', 'false');
    video.src = S.url;
    try { await once(video, 'loadeddata', 15000); }
    catch (e) {
      S.vw = 16; S.vh = 9; S.dur = 0; layout(); tlDraw(); renderState();
      err('Dein Browser kann dieses Video nicht abspielen. Das passiert zum Beispiel mit HEVC-Videos vom iPhone in manchen Browsern. Du kannst es trotzdem ohne Sticker einsenden.', '<button class="btn" type="button" id="err-send">Ohne Sticker einsenden →</button>');
      $('#err-send').addEventListener('click', () => { setSend(f, 'direkt'); go($('#einsenden')); });
      return;
    }
    S.vw = video.videoWidth; S.vh = video.videoHeight;
    let d = video.duration;
    if (!isFinite(d) || !d) { try { video.currentTime = 1e7; await once(video, 'seeked', 5000); d = video.duration; } catch (e) {} if (!isFinite(d) || !d) d = video.currentTime || 0; }
    S.dur = d; S.a = 0; S.b = Math.min(d, MAXLEN);
    S.pan.x = S.pan.y = .5;
    setFmt(S.fmt, false);
    video.currentTime = 0;
    tlDraw(); strip(S.url); updSum(); renderState();
    $('#res').hidden = true;
    video.play().catch(() => {});
  }

  /* ---------- Demo als Selbst-Impuls ---------- */
  function demo() {
    if (!S.demo || S.interacted) return;
    video.src = 'media/hero.mp4'; video.loop = true; video.play().catch(() => {});
    strip('media/hero.mp4');
    if (RM || !gs()) { add('plakette', .86, .22, { demo: true }); add('brille', .27, .78, { r: -5, demo: true }); setOSD(true); S.osdDemo = true; select(null); return; }
    const tl = demoTL = gs().timeline({ delay: .5 });
    tl.add(() => { flyIn('plakette', .86, .23, -8); select(null); })
      .add(() => { flyIn('brille', .27, .78, -5); select(null); }, '+=1')
      .add(() => { setOSD(true); S.osdDemo = true; }, '+=0.9')
      .add(() => { const n = $('#ln-name'); if (!S.ln.name) { S.ln.name = 'Dein Pilotenname'; S.ln.force = false; } n.placeholder = 'Dein Pilotenname'; }, '+=0.4')
      .add(() => setFmt('9:16', true), '+=1.2')
      .to(S.pan, { x: .25, duration: 1.1, ease: 'sine.inOut', onUpdate: panUI }, '+=1')
      .to(S.pan, { x: .75, duration: 1.6, ease: 'sine.inOut', onUpdate: panUI })
      .to(S.pan, { x: .5, duration: .9, ease: 'sine.inOut', onUpdate: panUI })
      .add(() => setFmt('orig', true), '+=0.3')
      .add(() => ghostLoop(), '+=1.2');
  }
  function hideHint() { const h = $('#st-hint'); if (h) h.classList.add('gone'); clearInterval(hintLoop); hintLoop = null; }
  function ghostLoop() {
    if (RM || !gs() || S.interacted) return;
    const run = () => {
      if (S.interacted || !visible || $('#pn-stk').hidden) return;
      const b = tray.querySelector('[data-k=fpv]') || tray.querySelector('button'); if (!b) return;
      const br = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      if (br.top > innerHeight || br.bottom < 0) return;
      const g = document.createElement('div'); g.className = 'ghostcur'; g.innerHTML = `<img src="${def(b.dataset.k).src}" alt="">`; document.body.appendChild(g);
      gs().timeline({ onComplete: () => g.remove() })
        .fromTo(g, { x: br.left + br.width / 2, y: br.top + br.height / 2, scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)' })
        .to(g, { x: sr.left + sr.width * .5, y: sr.top + sr.height * .45, rotation: -8, duration: 1.2, ease: 'power3.inOut' })
        .to(g, { scale: 1.3, opacity: 0, duration: .4, ease: 'power2.in' });
    };
    run(); hintLoop = setInterval(run, 6500);
  }

  /* ---------- Zeitleiste: kürzen ---------- */
  let stripTok = 0;
  async function strip(url) {
    const tok = ++stripTok, c = $('#tl-strip'), tl = $('#tl');
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
    const d = S.dur || 1, pa = S.a / d * 100, pb = S.b / d * 100;
    const A = $('#tl-a'), B = $('#tl-b');
    A.style.left = pa + '%'; B.style.left = pb + '%';
    $('#tl-win').style.left = pa + '%'; $('#tl-win').style.width = (pb - pa) + '%';
    $('#tl-sl').style.width = pa + '%'; $('#tl-sr').style.width = (100 - pb) + '%';
    $('#tl-ra').textContent = tD(S.a); $('#tl-rb').textContent = tD(S.b); $('#tl-rl').textContent = sec(S.b - S.a);
    [[A, S.a], [B, S.b]].forEach(([el, v]) => { el.setAttribute('aria-valuemax', (S.dur || 0).toFixed(1)); el.setAttribute('aria-valuenow', v.toFixed(1)); el.setAttribute('aria-valuetext', (Math.round(v * 10) / 10).toLocaleString('de-DE') + ' Sekunden'); });
    $('#tl').classList.toggle('off', S.demo || !S.dur);
    updSum();
  }
  function tick() {
    const d = S.dur || video.duration || 1;
    $('#tl-ph').style.left = (clamp((video.currentTime || 0) / d, 0, 1) * 100) + '%';
    const t = S.demo ? video.currentTime : video.currentTime - S.a, len = S.demo ? d : S.b - S.a;
    $('#st-time').textContent = tS(t) + ' / ' + tS(len);
  }
  function timeline() {
    const tl = $('#tl'), A = $('#tl-a'), B = $('#tl-b'), W = $('#tl-win');
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
  function updSum() {
    const el = $('#sum'); if (!el) return;
    const o = outDims(S.q === 'mail'), n = S.st.length + (S.osd ? 1 : 0);
    const rows = [
      ['Format', (S.fmt === 'orig' ? 'Original' : S.fmt) + ' · ' + o.W + ' × ' + o.H],
      ['Länge', S.demo ? 'nach Videowahl' : sec(S.b - S.a)],
      ['Sticker', n ? String(n) : 'keine'],
      ['Bauchbinde', S.ln.name.trim() && S.ln.mode !== 'off' ? S.ln.name.trim() : 'aus'],
      ['Qualität', S.q === 'mail' ? 'Mail-tauglich' : 'Hoch']
    ];
    el.innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  }
  function renderState() {
    const b = $('#st-render'), why = $('#st-render-why');
    if (S.demo) { b.setAttribute('aria-disabled', 'true'); why.textContent = 'Wähl zuerst dein eigenes Video, dann kannst du rendern.'; }
    else if (!S.dur) { b.setAttribute('aria-disabled', 'true'); why.textContent = 'Dieses Video lässt sich hier nicht bearbeiten.'; }
    else { b.removeAttribute('aria-disabled'); why.textContent = 'Dein Video wird nur auf deinem Gerät verarbeitet.'; }
    why.style.color = '';
  }

  /* ---------- Rendern ---------- */
  async function render() {
    if (S.busy || !S.file || !S.dur) return;
    S.busy = true; $('#st').classList.add('busy'); video.pause();
    const mail = S.q === 'mail', { W, H } = outDims(mail), len = S.b - S.a;
    const vb = mail ? clamp(((D.upload.maxMail || 9) * .9 * 8 * 1048576) / len - 200000, 350000, 6000000) : null;
    const prog = $('#prog'), fillEl = $('#bat-fill'), pt = $('#prog-t'), eta = $('#prog-eta');
    prog.hidden = false; $('#res').hidden = true; $('#st-render').hidden = true;
    const t0 = performance.now();
    const set = p => { p = clamp(p, 0, 1); fillEl.style.width = (p * 100) + '%'; fillEl.style.setProperty('--p', Math.max(p, .001)); pt.textContent = `Rendert … ${Math.round(p * 100)} %`; const el = (performance.now() - t0) / 1000; eta.textContent = p > .04 ? 'noch ca. ' + tS(el / p - el) : ''; };
    set(0);
    let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    let out = null, note = '';
    try { await (document.fonts && document.fonts.ready); } catch (e) {}
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; const c2 = cvs.getContext('2d');
    let cancelled = false;
    S.cancel = () => { cancelled = true; if (S._conv) S._conv.cancel().catch(() => {}); if (S._stop) S._stop(); };
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
      S.busy = false; $('#st').classList.remove('busy'); prog.hidden = true; $('#st-render').hidden = false; S.cancel = null; S._conv = null; S._stop = null;
      if (ac) ac.close().catch(() => {});
      if (cancelled) { renderState(); return; }
      const why = $('#st-render-why'); why.style.color = '#ffc2c8';
      why.innerHTML = 'Rendern hat in diesem Browser nicht geklappt. Du kannst dein Video ohne Sticker einsenden. <button class="btn" type="button" id="fail-send" style="margin-top:10px">Ohne Sticker einsenden →</button>';
      $('#fail-send').addEventListener('click', () => { setSend(S.file, 'direkt'); go($('#einsenden')); });
      return;
    }
    if (ac) ac.close().catch(() => {});
    S.busy = false; $('#st').classList.remove('busy'); S.cancel = null; S._conv = null; S._stop = null;
    set(1); prog.hidden = true; $('#st-render').hidden = false; renderState();
    const pilot = S.ln.name.trim() || ($('#cf-pilot') && $('#cf-pilot').value) || 'clip';
    const file = new File([out.blob], `flightclubsaar_${slug(pilot) || 'clip'}_${today()}.${out.ext}`, { type: out.blob.type });
    S.result = file;
    const rv = $('#res-v'); if (rv.src) URL.revokeObjectURL(rv.src); rv.src = URL.createObjectURL(file);
    const dl = $('#res-dl'); dl.href = rv.src; dl.download = file.name;
    $('#res-info').textContent = `${out.ext.toUpperCase()} · ${W} × ${H} · ${MB(file.size)}${note}`;
    $('#res-share').hidden = !(navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })());
    $('#res').hidden = false;
    if (gs() && !RM) gs().from('#res', { y: 20, opacity: 0, duration: .7, ease: 'expo.out' });
    const rr = $('#res').getBoundingClientRect(); if (rr.top > innerHeight - 160 || rr.top < 0) go($('#res'));
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
     3 · Einsenden
     ===================================================================== */
  const SEND = { file: null, url: '', route: null };
  function setSend(file, from) {
    if (!file) return;
    SEND.file = file;
    const att = $('#cf-att'), st = $('#cf-status'), big = file.size > maxBytes(), link = (D.upload && D.upload.link) || '';
    if (SEND.url) URL.revokeObjectURL(SEND.url);
    SEND.url = URL.createObjectURL(file);
    const v = $('#cf-v'); v.src = SEND.url + '#t=0.5';
    $('#cf-empty').hidden = true; $('#cf-clip').hidden = false;
    $('#cf-vn').textContent = file.name; $('#cf-vs').textContent = MB(file.size) + (from === 'studio' ? ' · aus dem Clip-Studio' : '');
    const badge = $('#cf-badge'), bx = $('#cf-big');
    const form = $('#clipform');
    if (!big) {
      form._extra = attach(att, file) ? null : () => ({ attachment: file });
      st.value = `Anhang: ${file.name} (${MB(file.size)})`;
      badge.textContent = 'Geht als Anhang mit'; badge.className = 'tag green';
      bx.hidden = true; route('mail');
    } else {
      attach(att, null); form._extra = null;
      st.value = `Zu groß für den Anhang (${MB(file.size)}), kommt per ${link ? 'Upload-Link' : 'WhatsApp'}: ${file.name}`;
      badge.textContent = 'Zu groß für den Anhang'; badge.className = 'tag amber';
      const tip = S.file ? ' Tipp: Im Clip-Studio mit „Mail-tauglich“ gerendert, passt er als Anhang.' : '';
      if (link) {
        $('#cf-big-t').innerHTML = `<b>Dein Clip ist ${MB(file.size)} groß.</b> Das ist zu viel für den Anhang. Lad ihn über den Button hoch und schick danach hier die Angaben ab, damit wir ihn zuordnen können.${tip}`;
        $('#cf-big-b').innerHTML = `<a class="btn amber solid" href="${esc(link)}" target="_blank" rel="noopener">Video hochladen ↗</a>`;
        route('link');
      } else {
        $('#cf-big-t').innerHTML = `<b>Dein Clip ist ${MB(file.size)} groß.</b> Das ist zu viel für den Anhang. Schick die Angaben hier ab und das Video per WhatsApp: Button antippen, dann das Video im Chat anhängen.${tip}`;
        $('#cf-big-b').innerHTML = (D.kontakte || []).map(k => `<a class="btn wa" data-wa="${esc(k.wa)}" data-n="${esc(k.name)}" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener">${ICON.wa.replace('<svg', '<svg width="16" height="16"')}Per WhatsApp an ${esc(k.name)} ↗</a>`).join('');
        waLinks(); route('wa');
      }
      bx.hidden = false;
      if (gs() && !RM) gs().from(bx, { y: 10, opacity: 0, duration: .5, ease: 'expo.out' });
    }
    $('#cf-vfield').classList.remove('bad');
  }
  function waLinks() {
    const p = ($('#cf-pilot') || {}).value || '';
    $$('#cf-big-b [data-wa]').forEach(a => { a.href = `https://wa.me/${a.dataset.wa}?text=${encodeURIComponent(`Hallo ${a.dataset.n}, hier kommt mein Clip für den Flight Club Saar${p.trim() ? ' (Pilotenname: ' + p.trim() + ')' : ''}. Die Angaben habe ich über die Website geschickt.`)}`; });
  }
  function route(k) {
    SEND.route = k;
    ['mail', 'link', 'wa'].forEach(r => { const l = $('#r-' + r); if (l) l.classList.toggle('on', r === k); const t = $(`.r-tag[data-r="${r}"]`); if (t) t.classList.toggle('on', r === k); });
  }
  function send() {
    const f = $('#clipform'); if (!f) return;
    $$('[data-maxmail]').forEach(e => { e.textContent = (D.upload && D.upload.maxMail) || 9; });
    dropZone($('#cf-drop'), $('#cf-pick'), file => {
      if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(file.name)) { $('#cf-vfield').classList.add('bad'); return; }
      setSend(file, 'direkt');
    });
    chipsToHidden($('#cf-where .chips'), $('#cf-where-v'));
    const pilot = $('#cf-pilot');
    pilot.addEventListener('input', () => { pilot.dataset.touched = 1; waLinks(); });
    f.addEventListener('fcs:sent', () => {
      if (SEND.file && SEND.route === 'wa') $('#cf-ok-t').textContent = 'Deine Angaben sind unterwegs. Schick jetzt noch das Video per WhatsApp, die Buttons stehen oben im Formular.';
      else if (SEND.route === 'link') $('#cf-ok-t').textContent = 'Deine Angaben sind unterwegs. Denk daran, das Video über den Upload-Button hochzuladen.';
    });
    // Versandweg-Grafik: Pakete fliegen auf dem aktiven Weg; ohne Video wechseln die Wege von selbst
    const svg = $('.route-svg'); if (!svg) return;
    const pk = $$('.r-pk', svg); let idle = 0, last = 0, vis = false;
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) requestAnimationFrame(fly); }).observe(svg);
    const order = ['mail', 'link', 'wa'];
    function fly(ts) {
      if (!vis) return;
      if (!SEND.file && !RM && ts - last > 2600) { last = ts; route(order[idle++ % 3]); }
      const path = $('#r-' + (SEND.route || 'mail')), L = path.getTotalLength();
      pk.forEach((p, i) => { const q = RM ? (i + 1) / 4 : ((ts / 2200) + i / pk.length) % 1; const pt = path.getPointAtLength(q * L); p.setAttribute('cx', pt.x); p.setAttribute('cy', pt.y); });
      if (!RM) requestAnimationFrame(fly);
    }
    reach();
  }
  /* Reichweiten-Zähler aus FCS.data.stats */
  function reach() {
    const box = $('#reach-g'), s = D.stats; if (!box) return;
    if (!s) { $('#reach').hidden = true; return; }
    const items = [
      s.instagram && ['ig', 'Instagram', s.instagram.follower, 'Follower'],
      s.tiktok && ['tt', 'TikTok', s.tiktok.follower, 'Follower'],
      s.youtube && ['yt', 'YouTube', s.youtube.abos, 'Abos'],
      s.whatsapp && ['wa', 'WhatsApp', s.whatsapp, 'im Chat']
    ].filter(Boolean);
    box.innerHTML = items.map(([k, n, v, l]) => `<div class="rc"><span class="rc-i">${ICON[k]}</span><b data-to="${v}">${RM ? v.toLocaleString('de-DE') : '0'}</b><span>${n} · ${l}</span></div>`).join('');
    $('#reach-s').textContent = 'Stand ' + s.stand;
    if (RM || !gs()) return;
    const run = () => $$('b[data-to]', box).forEach(b => { const o = { v: 0 }; gs().to(o, { v: +b.dataset.to, duration: 2, ease: 'expo.out', onUpdate: () => { b.textContent = Math.round(o.v).toLocaleString('de-DE'); } }); });
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: box, start: 'top 85%', once: true, onEnter: run }); else run();
  }

  /* =====================================================================
     3b · Werkzeugkasten
     ===================================================================== */
  function tools() {
    const root = $('#tk'); if (!root) return;
    const ts = $$('[role=tab]', root);
    let cur = 0, auto = !RM, raf = 0, t0 = 0;
    const DUR = 9000;
    const sel = (i, focus) => {
      cur = (i + ts.length) % ts.length;
      ts.forEach((t, k) => { const on = k === cur; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; t.querySelector('i').style.setProperty('--p', on && !auto ? 1 : 0); });
      if (focus) ts[cur].focus();
      const p = $('#' + ts[cur].getAttribute('aria-controls'));
      if (gs() && !RM) gs().from(p.children, { y: 24, opacity: 0, duration: .6, stagger: .06, ease: 'expo.out', clearProps: 'all' });
      t0 = performance.now();
    };
    const stop = () => { if (!auto) return; auto = false; cancelAnimationFrame(raf); ts.forEach((t, k) => t.querySelector('i').style.setProperty('--p', k === cur ? 1 : 0)); };
    ts.forEach((t, i) => {
      t.addEventListener('click', () => { stop(); sel(i); });
      t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); stop(); sel(cur + d, true); });
    });
    root.addEventListener('pointerdown', stop); root.addEventListener('focusin', e => { if (!ts.includes(e.target)) stop(); });
    let vis = false;
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && auto) { t0 = performance.now(); raf = requestAnimationFrame(step); } }, { threshold: .25 }).observe(root);
    function step(now) {
      if (!auto || !vis) return;
      const p = (now - t0) / DUR;
      ts[cur].querySelector('i').style.setProperty('--p', Math.min(1, p));
      if (p >= 1) sel(cur + 1);
      raf = requestAnimationFrame(step);
    }
    sel(0);
    amp(); pipe(); phone(); copyTag(); lens();
  }
  function amp() {
    const cards = $$('.tk-card[data-amp]'); if (!cards.length) return;
    const lamps = { g: $('.amp-l.g'), a: $('.amp-l.a'), r: $('.amp-l.r') };
    let i = 0, iv = null;
    const on = c => { cards.forEach(x => x.classList.toggle('on', x === c)); Object.entries(lamps).forEach(([k, l]) => l && l.classList.toggle('on', c && c.dataset.amp === k)); };
    const stop = () => { clearInterval(iv); iv = null; };
    cards.forEach(c => { c.addEventListener('pointerenter', () => { stop(); on(c); }); c.addEventListener('focusin', () => { stop(); on(c); }); c.tabIndex = -1; });
    on(cards[0]);
    if (!RM) iv = setInterval(() => { if (!$('#tk-p1').hidden) on(cards[++i % cards.length]); }, 2400);
    $('#tk-p1').addEventListener('pointerdown', stop);
  }
  function pipe() {
    const ol = $('#pipe'); if (!ol) return;
    const li = $$('li', ol), dot = $('.pipe-dot', ol), tools = $$('.tool');
    let i = 0, iv = null;
    const on = n => {
      i = n; li.forEach((l, k) => l.classList.toggle('on', k === n)); tools.forEach(t => t.classList.toggle('hot', +t.dataset.step === n));
      if (!dot) return;
      const r = ol.getBoundingClientRect(), lr = li[n].getBoundingClientRect(), vert = getComputedStyle(ol).gridTemplateColumns.split(' ').length === 1;
      const x = vert ? 23 : lr.left - r.left + lr.width / 2, y = vert ? lr.top - r.top + lr.height / 2 - 6 : 18;
      if (gs() && !RM) gs().to(dot, { left: x, top: y, duration: .8, ease: 'expo.inOut' }); else { dot.style.left = x + 'px'; dot.style.top = y + 'px'; }
    };
    tools.forEach(t => { t.addEventListener('pointerenter', () => { clearInterval(iv); iv = null; on(+t.dataset.step); }); t.addEventListener('focus', () => { clearInterval(iv); iv = null; on(+t.dataset.step); }); });
    const start = () => { if (RM || iv) return; iv = setInterval(() => { if (!$('#tk-p2').hidden) on((i + 1) % li.length); }, 1600); };
    new MutationObserver(() => { if (!$('#tk-p2').hidden) { on(i); } }).observe($('#tk-p2'), { attributes: true, attributeFilter: ['hidden'] });
    on(0); start();
    addEventListener('resize', () => on(i));
  }
  function phone() {
    const btn = $$('#psteps button'), sc = $$('.ph-s'), fin = $('.ph-finger'); if (!btn.length) return;
    let i = 0, iv = null;
    const on = n => {
      i = n; btn.forEach((b, k) => b.classList.toggle('on', k === n)); sc.forEach((s, k) => s.classList.toggle('on', k === n));
      const hot = sc[n] && (sc[n].querySelector('.hot') || sc[n].querySelector('.ph-plus') || sc[n].querySelector('.ph-cta'));
      if (!fin || !hot || RM || !gs()) return;
      const pr = $('#phone').getBoundingClientRect(), hr = hot.getBoundingClientRect();
      gs().killTweensOf(fin);
      gs().timeline().set(fin, { opacity: 0 }).to(fin, { left: hr.left - pr.left + hr.width * .7, top: hr.top - pr.top + hr.height / 2, opacity: 1, duration: .6, ease: 'power3.out', delay: .4 })
        .to(fin, { scale: .8, duration: .12, yoyo: true, repeat: 1 });
    };
    btn.forEach((b, k) => b.addEventListener('click', () => { clearInterval(iv); iv = null; on(k); }));
    on(0);
    if (!RM) iv = setInterval(() => { if (!$('#tk-p3').hidden) on((i + 1) % btn.length); }, 2600);
    new MutationObserver(() => { if (!$('#tk-p3').hidden) setTimeout(() => on(i), 60); }).observe($('#tk-p3'), { attributes: true, attributeFilter: ['hidden'] });
  }
  function copyTag() {
    const b = $('#tag-copy'); if (!b) return;
    b.addEventListener('click', async () => {
      const t = $('#tag-txt').textContent;
      let ok = false;
      try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {
        const r = document.createRange(); r.selectNodeContents($('#tag-txt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { ok = document.execCommand('copy'); } catch (er) {}
      }
      b.textContent = ok ? 'Kopiert ✓' : 'Markiert, jetzt kopieren'; b.classList.toggle('ok', ok);
      setTimeout(() => { b.textContent = 'Kopieren'; b.classList.remove('ok'); }, 2200);
    });
  }
  function lens() {
    const a = $('#teaser'); if (!a) return;
    const svg = $('svg', a), ticks = $('.ln-ticks', svg), blades = $('.ln-blades', svg), NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 48; i++) { const l = document.createElementNS(NS, 'line'), an = i / 48 * Math.PI * 2, r1 = 86, r2 = i % 4 ? 90 : 94; l.setAttribute('x1', Math.cos(an) * r1); l.setAttribute('y1', Math.sin(an) * r1); l.setAttribute('x2', Math.cos(an) * r2); l.setAttribute('y2', Math.sin(an) * r2); ticks.appendChild(l); }
    const N = 8, paths = [];
    for (let i = 0; i < N; i++) { const p = document.createElementNS(NS, 'path'); blades.appendChild(p); paths.push(p); }
    const st = { o: .25, rot: 0 };
    const drawIris = () => {
      const r = 10 + st.o * 66, R = 84, tw = (1 - st.o) * 34 * Math.PI / 180 + st.rot;
      for (let i = 0; i < N; i++) {
        const a1 = i / N * Math.PI * 2 + tw, a2 = (i + 1) / N * Math.PI * 2 + tw, k = .62;
        const p1 = [Math.cos(a1) * r, Math.sin(a1) * r], p2 = [Math.cos(a2) * r, Math.sin(a2) * r];
        const o2 = [Math.cos(a2 + k) * R * 1.02, Math.sin(a2 + k) * R * 1.02], o1 = [Math.cos(a1 + k) * R * 1.02, Math.sin(a1 + k) * R * 1.02];
        paths[i].setAttribute('d', `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}L${o2[0].toFixed(1)} ${o2[1].toFixed(1)}A${R} ${R} 0 0 0 ${o1[0].toFixed(1)} ${o1[1].toFixed(1)}Z`);
      }
    };
    drawIris();
    if (!gs() || RM) return;
    // Selbst-Impuls: Die Blende atmet, beim Scrollen öffnet sie sich, beim Drüberfahren ganz
    const breathe = gs().to(st, { o: .55, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: drawIris });
    if (window.ScrollTrigger) gs().to(st, { rot: Math.PI / 3, ease: 'none', scrollTrigger: { trigger: a, start: 'top bottom', end: 'bottom top', scrub: true }, onUpdate: drawIris });
    a.addEventListener('pointerenter', () => { breathe.pause(); gs().to(st, { o: 1, duration: .8, ease: 'expo.out', onUpdate: drawIris }); });
    a.addEventListener('pointerleave', () => { gs().to(st, { o: .3, duration: .8, ease: 'expo.out', onUpdate: drawIris, onComplete: () => breathe.restart() }); });
    if (FINE) a.addEventListener('pointermove', e => { const r = a.getBoundingClientRect(); gs().to($('.lens', a), { rotateY: ((e.clientX - r.left) / r.width - .5) * 24, rotateX: -((e.clientY - r.top) / r.height - .5) * 24, duration: .6, transformPerspective: 700 }); });
  }

  /* =====================================================================
     4 · Profil mit Live-Karte
     ===================================================================== */
  function profile() {
    const f = $('#profform'); if (!f) return;
    const card = $('#pcard'), seit = $('#pf-seit');
    const y = new Date().getFullYear();
    seit.innerHTML = '<option value="">Bitte wählen</option>' + Array.from({ length: y - 2009 }, (_, i) => `<option>${y - i}</option>`).join('') + '<option value="vor 2010">vor 2010</option>';
    const val = id => ($('#' + id).value || '').trim();
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v || '…'; };
    const upd = () => {
      const name = val('pf-name'), alias = val('pf-alias');
      $('#pc-name').textContent = name || 'Dein Name';
      $('#pc-alias').textContent = alias || 'Dein Pilotenname';
      $('#pc-ini').textContent = (alias || name || '?').charAt(0).toUpperCase();
      set('pc-seit', val('pf-seit')); set('pc-ort', val('pf-ort')); set('pc-stil', $('#pf-stil-v').value);
      set('pc-kopter', val('pf-kopter')); set('pc-brille', val('pf-brille')); set('pc-funke', val('pf-funke'));
      const soc = $('#pc-soc'), ok = $('#pf-soc').checked;
      const items = ['ig', 'tt', 'yt'].map(k => [k, handle(val('pf-' + k))]).filter(([, h]) => h);
      soc.classList.toggle('off', !ok);
      soc.innerHTML = items.map(([k, h]) => `<span>${ICON[k]}@${esc(h)}</span>`).join('') + (items.length && !ok ? '<em>Verlinkt nur mit Haken</em>' : '');
    };
    chipsToHidden($('#pf-stil'), $('#pf-stil-v'), upd);
    f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    const flip = on => card.classList.toggle('flip', on);
    $$('[data-card]', f).forEach(i => i.addEventListener('focus', () => { flip(i.hasAttribute('data-back')); stopIdle(); }));
    $('#pf-stil').addEventListener('focusin', () => flip(true));
    $('#pc-flip').addEventListener('click', () => { stopIdle(); flip(!card.classList.contains('flip')); });
    // Profilbild verkleinern und anhängen
    dropZone($('#pf-drop'), $('#pf-pic'), async file => {
      if (!/^image\//.test(file.type)) return;
      try {
        const small = await shrink(file, 800, `profilbild_${slug(val('pf-alias')) || 'pilot'}.jpg`);
        if (!attach($('#pf-att'), small)) f._extra = () => ({ Profilbild: small });
        const u = URL.createObjectURL(small);
        const pv = $('#pf-prev'); pv.src = u; pv.hidden = false; $('.drop-in', $('#pf-drop')).style.opacity = 0;
        const im = $('#pc-img'); im.src = u; im.hidden = false; $('#pc-ini').hidden = true;
        flip(false);
      } catch (e) {}
    });
    // 3D-Kippen + Glanz, Selbst-Impuls: Karte schwebt und dreht sich einmal um
    let idle = null;
    const stopIdle = () => { if (idle) { idle.kill(); idle = null; } };
    if (gs() && !RM) {
      idle = gs().timeline({ repeat: -1, yoyo: true }).to(card, { rotateY: 10, rotateX: -5, y: -6, duration: 2.6, ease: 'sine.inOut' });
      if (window.ScrollTrigger) ScrollTrigger.create({ trigger: card, start: 'top 75%', once: true, onEnter: () => { setTimeout(() => { if (!f.contains(document.activeElement)) { flip(true); setTimeout(() => flip(false), 1800); } }, 900); } });
      const stage = $('#pc-stage');
      if (FINE) {
        stage.addEventListener('pointermove', e => { stopIdle(); const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, yy = (e.clientY - r.top) / r.height - .5; gs().to(card, { rotateY: x * 22, rotateX: -yy * 16, y: 0, duration: .5 }); card.style.setProperty('--sx', (x * 140) + '%'); });
        stage.addEventListener('pointerleave', () => gs().to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
      }
      f.addEventListener('input', stopIdle, { once: true });
    }
    f.addEventListener('fcs:sent', () => flip(false));
  }

  /* =====================================================================
     5 · Crew 2026 + Piloten aus der Community
     ===================================================================== */
  function tilt(c) {
    if (!FINE || !gs() || RM) return;
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; gs().to(c, { rotateY: x * 18, rotateX: -y * 14, duration: .4 }); c.style.setProperty('--sx', (x * 120) + '%'); });
    c.addEventListener('pointerleave', () => gs().to(c, { rotateY: 0, rotateX: 0, duration: .8, ease: 'elastic.out(1,.5)' }));
  }
  function socLinks(o) {
    return ['ig', 'tt', 'yt'].filter(k => o[k]).map(k => { const h = handle(o[k]); return `<a href="${SOC[k][1](encodeURIComponent(h))}" target="_blank" rel="noopener" aria-label="${SOC[k][0]} von ${esc(o.a || o.n || '')}">${ICON[k]}</a>`; }).join('');
  }
  function crew() {
    const deck = $('#cdeck'); if (!deck) return;
    const list = (D.crew || []).filter(c => c.ok), rest = (D.crew || []).length - list.length;
    deck.innerHTML = list.map(c => {
      const name = c.n || c.a, alias = c.n ? c.a : '';
      const back = [c.seit ? `<span>FPV seit <b>${esc(c.seit)}</b></span>` : '', c.stil ? `<span>Stil <b>${esc(c.stil)}</b></span>` : '', c.ort ? `<span>Aus <b>${esc(c.ort)}</b></span>` : ''].filter(Boolean).join('') || '<span>Mitglied im Flight Club Saar</span>';
      const soc = socLinks(c);
      return `<div class="card3${c.v ? ' v' : ''}" tabindex="0" role="button" title="Antippen dreht die Karte um"><div class="c3-in">
        <div class="c3-f c3-front"><div class="mc-top"><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Mitgliedskarte<br><b>2026</b></span></div>
        ${c.img ? `<img class="mc-ph" src="${esc(c.img)}" alt="" loading="lazy" width="400" height="400">` : ''}<div style="align-self:end"><div class="mc-name">${esc(name)}</div><div class="mc-alias">${esc(alias)}</div></div>
        <div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">${esc(c.r || 'Mitglied')}</span></div><i class="mc-shine"></i></div>
        <div class="c3-f c3-back"><div class="cc-b">${back}</div>${soc ? `<div class="cc-soc">${soc}</div>` : ''}</div></div></div>`;
    }).join('') + (rest > 0 ? `<div class="card3" tabindex="0" role="button" title="Antippen dreht die Karte um"><div class="c3-in"><div class="c3-f c3-front"><div class="mc-top"><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Mitgliedskarte<br><b>2026</b></span></div><div style="align-self:end"><div class="mc-name">+${rest}</div><div class="mc-alias">weitere Piloten</div></div><div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">Crew 2026</span></div><i class="mc-shine"></i></div><div class="c3-f c3-back"><div class="cc-b"><span>Dabei und bezahlt. Wer mit Namen hierher möchte, ergänzt einfach sein Profil.</span></div></div></div></div>` : '') + '<a class="card3 free" href="#profil"><div class="c3-in"><div class="c3-f c3-front"><b>+ Du?</b><span>Profil ergänzen</span></div></div></a>';
    const cards = $$('.card3', deck);
    cards.forEach(c => {
      if (c.classList.contains('free')) { c.addEventListener('click', e => { e.preventDefault(); go($('#profil')); }); return; }
      c.addEventListener('click', e => { if (e.target.closest('a')) return; c.classList.toggle('flip'); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flip'); } });
      tilt(c);
    });
    // Austeilen wie ein Kartenspiel, danach dreht sich die erste Karte von selbst um
    if (gs() && window.ScrollTrigger && !RM) {
      ScrollTrigger.create({ trigger: deck, start: 'top 80%', once: true, onEnter: () => {
        const r = deck.getBoundingClientRect();
        gs().from(cards, { x: (i, el) => r.width / 2 - (el.offsetLeft + el.offsetWidth / 2), y: (i, el) => -el.offsetTop + 40, rotation: (i) => (i % 2 ? 8 : -8) + i, opacity: 0, duration: 1.1, stagger: .07, ease: 'expo.out',
          onComplete: () => { const f = cards[0]; f.classList.add('flip'); setTimeout(() => f.classList.remove('flip'), 1700); } });
      } });
    }
    piloten();
  }
  const STIL = { cinema: 'Cinematic', cinematic: 'Cinematic', whoop: 'Whoops', whoops: 'Whoops', 'tiny whoop racing': ['Whoops', 'Racing'], race: 'Racing', racing: 'Racing', 'long range': 'Long Range', freestyle: 'Freestyle', 'juicy sbang': 'Juicy SBang', '3d': '3D', 'aggro acro': 'Aggro Acro', aggressive: 'Aggressive' };
  const tags = s => [...new Set(String(s || '').split(/[,·]/).map(x => x.trim()).filter(Boolean).flatMap(x => { const m = STIL[x.toLowerCase()]; return m ? [].concat(m) : [x]; }))];
  function piloten() {
    const grid = $('#pl-grid'), P = D.piloten || []; if (!grid) return;
    if (!P.length) { $('#piloten').hidden = true; return; }
    const all = P.map((p, i) => ({ p, i, t: tags(p.stil), q: [p.a, p.n, p.ort].join(' ').toLowerCase() }));
    grid.innerHTML = all.map(({ p, t }) => {
      const soc = socLinks(p);
      return `<article class="plc${p.img ? ' has-img' : ''}" tabindex="-1">${p.img ? `<span class="plc-img"><img src="${esc(p.img)}" alt="${esc(p.a)}" loading="lazy" width="400" height="400"></span>` : ''}<span class="plc-seit hud">${p.seit ? 'seit ' + esc(p.seit) : ''}</span>
        <h4 class="plc-a">${esc(p.a)}</h4><p class="plc-n">${[p.n, p.ort].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</p>
        <div class="plc-t">${t.map(x => `<span>${esc(x)}</span>`).join('')}</div>${soc ? `<div class="plc-s">${soc}</div>` : ''}<i class="plc-scan" aria-hidden="true"></i></article>`;
    }).join('');
    const els = $$('.plc', grid);
    // Filter-Chips nach Häufigkeit
    const cnt = {}; all.forEach(x => x.t.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    const keys = Object.keys(cnt).filter(k => cnt[k] > 1).sort((a, b) => cnt[b] - cnt[a]);
    const fbox = $('#pl-f');
    fbox.innerHTML = `<label class="chip"><input type="radio" name="pl-f" value="" checked><span>Alle</span></label>` + keys.map(k => `<label class="chip"><input type="radio" name="pl-f" value="${esc(k)}"><span>${esc(k)} <small>${cnt[k]}</small></span></label>`).join('');
    const q = $('#pl-q'), read = $('#pl-read');
    let rt = 0;
    // dim = Vorschau (Selbst-Impuls): nur abdunkeln, damit die Seite nicht springt
    const apply = (anim = true, dim = false) => {
      const s = (($('input[name=pl-f]:checked') || {}).value) || '', term = q.value.trim().toLowerCase();
      let n = 0; const show = [];
      all.forEach((x, i) => { const ok = (!s || x.t.includes(s)) && (!term || x.q.includes(term)); if (dim) { els[i].hidden = false; els[i].classList.toggle('dim', !ok); } else { els[i].classList.remove('dim'); els[i].hidden = !ok; } if (ok) { n++; show.push(els[i]); } });
      read.textContent = n === all.length ? `${n} Piloten` : n ? `${n} von ${all.length} Piloten` : 'Kein Pilot gefunden. Probier einen anderen Namen oder Stil.';
      if (anim && !dim && gs() && !RM && show.length) gs().fromTo(show, { y: 18, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .5, stagger: .025, ease: 'expo.out', overwrite: true });
      if (!dim && window.ScrollTrigger) { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 400); }
    };
    let demoIv = null;
    const stop = () => { if (!demoIv) return; clearInterval(demoIv); demoIv = null; els.forEach(e => e.classList.remove('dim')); };
    fbox.addEventListener('change', e => { if (e.isTrusted) stop(); apply(); });
    fbox.addEventListener('pointerdown', stop); q.addEventListener('focus', stop);
    q.addEventListener('input', () => { stop(); apply(); });
    apply(false);
    if (gs() && window.ScrollTrigger && !RM) {
      gs().from(els, { y: 40, opacity: 0, duration: .8, stagger: .03, ease: 'expo.out', scrollTrigger: { trigger: grid, start: 'top 85%', once: true } });
      // Selbst-Impuls: der Filter probiert zwei Stile von selbst aus, dann wieder alle
      ScrollTrigger.create({ trigger: fbox, start: 'top 70%', once: true, onEnter: () => {
        const seq = [keys[1], keys[2], ''].filter(v => v !== undefined); let k = 0;
        demoIv = setInterval(() => { const v = seq[k++]; const r = $(`input[name=pl-f][value="${v}"]`); if (r) { r.checked = true; apply(false, true); } if (k >= seq.length) stop(); }, 1600);
      } });
    }
  }

  /* =====================================================================
     6 · Pinnwand
     ===================================================================== */
  function pinboard() {
    const feed = $('#pin-feed'); if (!feed) return;
    const posts = [...(D.pinnwand || [])].sort((a, b) => String(b.d).localeCompare(String(a.d)));
    const clips = [...(D.clips || [])].sort((a, b) => String(b.d).localeCompare(String(a.d)));
    if (posts.length || clips.length) {
      $('#nosig').remove();
      let h = '';
      if (clips.length) h += `<p class="pin-sub">Clips aus der Crew</p><div class="clipgrid">${clips.map(c => `<figure class="clipc" style="margin:0"><video src="${esc(c.src)}"${c.poster ? ` poster="${esc(c.poster)}"` : ''} controls playsinline preload="none"></video><figcaption><b>${esc(c.n)}</b><br><span>${deDate(c.d)}</span>${c.ig ? ` · <a href="${SOC.ig[1](encodeURIComponent(handle(c.ig)))}" target="_blank" rel="noopener">@${esc(handle(c.ig))}</a>` : ''}</figcaption></figure>`).join('')}</div>`;
      if (posts.length) h += (clips.length ? '<p class="pin-sub">Beiträge</p>' : '') + posts.map((p, i) => `<article class="post panel" data-reveal>
        <div class="post-h"><b>${esc(p.n)}</b><time datetime="${esc(p.d)}">${deDate(p.d)}</time></div>
        <p>${esc(p.t)}</p>${p.img ? `<img src="${esc(p.img)}" alt="Foto von ${esc(p.n)}" loading="lazy">` : ''}
        ${(p.k || []).length ? `<div class="post-k">${p.k.map(k => `<p><b>${esc(k.n)}</b>${k.d ? ' · <span class="mute">' + deDate(k.d) + '</span>' : ''}<br>${esc(k.t)}</p>`).join('')}</div>` : ''}
        <button class="btn ghost" type="button" data-reply="${i}" aria-expanded="false">Antworten</button>
        <form class="reply" novalidate hidden>
          <input type="hidden" name="_subject" value="Antwort auf Pinnwand-Beitrag (Flight Club Saar, Entwurf)">
          <input type="hidden" name="Formular" value="Pinnwand: Antwort">
          <input type="hidden" name="Antwort auf" value="${esc(p.n + ' (' + p.d + '): ' + String(p.t).slice(0, 80))}">
          <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-label="Bitte leer lassen">
          <div class="field"><label for="rp-n${i}">Name oder Pilotenname</label><input id="rp-n${i}" name="Name" required><span class="err">Bitte einen Namen eingeben.</span></div>
          <div class="field"><label for="rp-t${i}">Deine Antwort</label><textarea id="rp-t${i}" name="Antwort" required maxlength="500"></textarea><span class="err">Bitte ein paar Worte schreiben.</span></div>
          <label class="check"><input type="checkbox" name="Freigabe" value="ja" required><span>Meine Antwort darf mit meinem Namen erscheinen.</span></label>
          <button class="btn solid" type="submit">Antwort senden</button>
          <div class="form-ok" hidden><b>Danke!</b> Deine Antwort erscheint nach der Freigabe.</div>
          <div class="form-bad" hidden>Das hat nicht geklappt. Bitte versuch es noch einmal.</div>
        </form></article>`).join('');
      feed.innerHTML = h;
      $$('[data-reply]', feed).forEach(b => b.addEventListener('click', () => { const f = b.nextElementSibling; f.hidden = !f.hidden; b.setAttribute('aria-expanded', !f.hidden); if (!f.hidden) f.querySelector('input[name=Name]').focus(); }));
      $$('form.reply', feed).forEach(f => f.addEventListener('submit', async e => {
        e.preventDefault(); if (!FCS.validate(f)) return;
        const btn = f.querySelector('[type=submit]'); btn.disabled = true;
        let r = { ok: false }; try { r = await FCS.send(f); } catch (er) {}
        btn.disabled = false;
        f.querySelector(r.ok ? '.form-ok' : '.form-bad').hidden = false;
        if (r.ok) f.querySelector('.form-bad').hidden = true;
      }));
      if (gs() && window.ScrollTrigger && !RM) ScrollTrigger.batch($$('.post,.clipc', feed), { start: 'top 88%', once: true, onEnter: b => gs().fromTo(b, { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: .9, ease: 'expo.out' }) });
      else $$('[data-reveal]', feed).forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; });
    } else noSignal();
    // Neuer Beitrag: Foto verkleinern
    const pf = $('#pin-form'); if (!pf) return;
    const txt = $('#pw-txt'); txt.addEventListener('input', () => { $('#pw-cnt').textContent = txt.value.length; });
    dropZone($('#pw-drop'), $('#pw-pic'), async file => {
      if (!/^image\//.test(file.type)) return;
      try {
        const small = await shrink(file, 1600, `pinnwand_${slug($('#pw-name').value) || 'foto'}.jpg`);
        if (!attach($('#pw-att'), small)) pf._extra = () => ({ Foto: small });
        const pv = $('#pw-prev'); pv.src = URL.createObjectURL(small); pv.hidden = false; $('.drop-in', $('#pw-drop')).style.opacity = 0;
      } catch (e) {}
    });
    const ns = $('#ns-go'); if (ns) ns.addEventListener('click', e => { e.preventDefault(); go(pf); setTimeout(() => $('#pw-name').focus({ preventScroll: true }), RM ? 0 : 900); });
  }
  /* Leerzustand: analoges Rauschen wie in der Brille ohne Signal, Kanalsuche läuft von selbst */
  function noSignal() {
    const box = $('#nosig'); if (!box) return;
    const c = $('#nosig-cv'), x = c.getContext('2d'); c.width = 160; c.height = 120;
    const img = x.createImageData(160, 120), d = img.data;
    const CH = [['R1', 5658], ['R2', 5695], ['R3', 5732], ['R4', 5769], ['R5', 5806], ['R6', 5843], ['R7', 5880], ['R8', 5917]];
    let vis = false, ci = 0, lock = false, hover = false, last = 0, lastCh = 0, cyc = 0, scans = 0;
    const logo = $('.nosig-logo', box), chEl = $('#ns-ch'), fEl = $('#ns-f'), txt = $$('.nosig-h,.nosig-t,#ns-go', box);
    const noise = a => { for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 * a; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } x.putImageData(img, 0, 0); };
    noise(1);
    if (RM) return;
    const setLock = on => {
      lock = on; box.classList.toggle('lock', on);
      if (gs()) { gs().to(logo, { opacity: on ? 1 : 0, scale: on ? 1 : .9, duration: on ? .25 : .4, ease: on ? 'power4.out' : 'power2.in' }); gs().to(c, { opacity: on ? .18 : .75, duration: .3 }); gs().to(txt, { opacity: on ? 0 : 1, duration: on ? .15 : .4 }); }
      chEl.parentElement.firstChild.textContent = on ? 'SIGNAL ' : 'SUCHE ';
    };
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) requestAnimationFrame(fr); }).observe(box);
    function fr(ts) {
      if (!vis) return;
      if (ts - last > 50) { last = ts; noise(lock ? .5 : 1); }
      if (!hover && ts - lastCh > 420) {
        lastCh = ts;
        if (lock) { if (++cyc > 3) { setLock(false); cyc = 0; } }
        else { ci = (ci + 1) % CH.length; chEl.textContent = CH[ci][0]; fEl.textContent = CH[ci][1]; if (ci === 3 && ++scans % 2 === 0) { setLock(true); cyc = 0; } }
      }
      requestAnimationFrame(fr);
    }
    box.addEventListener('pointerenter', () => { hover = true; if (lock) setLock(false); });
    box.addEventListener('pointerleave', () => { hover = false; });
    box.addEventListener('focusin', () => { hover = true; if (lock) setLock(false); });
    box.addEventListener('focusout', () => { hover = false; });
  }

  /* ===================================================================== */
  function init() {
    D = FCS.data || {}; RM = FCS.rm; FINE = FCS.fine; $ = FCS.$; $$ = FCS.$$;
    D.upload = D.upload || { link: '', maxMail: 9 };
    const parts = [head, studio, send, tools, profile, crew, pinboard];
    parts.forEach(fn => { try { fn(); } catch (e) { console.error('Crew-Bereich:', fn.name, e); } });
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 300);
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
