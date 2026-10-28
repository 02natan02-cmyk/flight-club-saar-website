/* Flight Club Saar · Clip-Studio (studio.html)
   1 Clips · 2 Schneiden (Zuschneiden oder Auto-Schnitt im Takt) · 3 Musik · 4 Look und Logo · 5 Fertig
   - Vorschau zeigt das echte Video-Element des Browsers (HDR, Drehung, alle abspielbaren Formate), Looks und Übergänge
     rechnet derselbe WebGL-Compositor wie der Export. Ein Selbsttest liest Pixel und erkennt schwarze Bilder.
   - Export in Originalqualität (bis 4K, hohe Bitrate) per WebCodecs, Einsenden in voller Qualität in den Vereins-OneDrive.
   - Premium für Mitglieder: Auto-Schnitt, eigene Musik, Piloten-Tag, Gyroflow.
   Module (werden erst bei Bedarf geladen): studio-media.js, studio-gl.js, studio-cloud.js, studio-beat.js (Worker). */
(function () {
  'use strict';
  const REV = '2026-10-28-a';
  const SELF = document.currentScript && document.currentScript.src || '';
  const BASE = SELF ? SELF.replace(/[^/?#]*([?#].*)?$/, '') : 'assets/js/';
  const VQ = '?r=' + REV + (SELF.includes('?v=') ? '&' + SELF.split('?')[1] : '');
  const mod = {};
  const load = n => mod[n] || (mod[n] = import(BASE + n + VQ));
  const media = () => load('studio-media.js'), glm = () => load('studio-gl.js'), cloud = () => load('studio-cloud.js');

  /* ===== Sticker: neue einfach als Zeile ergänzen =====
     k = Schlüssel, n = Name, src = Datei, w = Startbreite (Anteil der Bildbreite), top = steht oben groß, typ 'osd' = Live-OSD, opt = Datei eventuell später */
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
    { k: 'alienquad', n: 'Alien-Kopter', src: 'assets/img/partner/fpv-alien-quad.webp', w: .16, opt: 1 },
    { k: 'tag', n: 'Dein Tag', src: '', w: .42, dyn: 1 }
  ];
  /* Auto-Schnitt: drei Stile. beats = Länge einer Szene in Schlägen, group = Raster, flex = Schnitt darf auf den stärksten Bass daneben rutschen */
  const STYLES = {
    ruhig: { n: 'Ruhig', d: 'Lange Szenen, weiche Blenden', group: 8, min: 4, flex: 0, trs: ['blende'], look: 'natur', fade: 1.2 },
    action: { n: 'Action', d: 'Kurze Szenen auf dem Bass, Zoom, Blitz und Tempo', chop: 2, flex: 1, trs: ['zoom', 'blitz', 'schnitt', 'glitch', 'whip', 'schnitt', 'zoom', 'blitz'], ramp: 3, look: 'kraeftig', fade: .4 },
    cine: { n: 'Cinematisch', d: 'Mittlere Längen, Blenden und Whip, leichte Zeitlupe', group: 4, min: 4, flex: 1, trs: ['blende', 'whip', 'blende', 'wisch'], slow: 1, look: 'warm', fade: 1 }
  };
  const DEMO = [
    { src: 'media/hero.mp4', poster: 'media/hero.webp', n: 'Beispiel: Silo', marks: [2.2, 9.5] },
    { src: 'media/schiff.mp4', poster: 'media/schiff.webp', n: 'Beispiel: Schiff', marks: [3.5] },
    { src: 'media/natur.mp4', poster: 'media/natur.webp', n: 'Beispiel: Natur', marks: [4] },
    { src: 'media/cine.mp4', poster: 'media/cine.webp', n: 'Beispiel: Cinewhoop', marks: [1.2] }
  ];
  const MAXLEN = 180, MINLEN = .5, MAXCLIPS = 5;
  const SIG = '#3fe0ff', AMBER = '#ffb020', RED = '#ff4b5c';
  const LS = { member: 'fcs-mitglied', tag: 'fcs-tag', jobs: 'fcs-gyro' };

  let D = {}, RM = false, FINE = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const gs = () => window.gsap;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const even = v => Math.max(2, Math.round(v / 2) * 2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MB = b => b >= 1073741824 ? (b / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' GB' : (b / 1048576).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
  const tS = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };
  const tD = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + r.toFixed(1).padStart(4, '0').replace('.', ','); };
  const sec = s => (Math.round(s * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  const slug = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const once = (el, ev, ms) => new Promise((res, rej) => { let t; const off = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); }; const ok = () => { off(); res(); }; const bad = () => { off(); rej(new Error('error')); }; el.addEventListener(ev, ok); el.addEventListener('error', bad); if (ms) t = setTimeout(() => { off(); rej(new Error('timeout')); }, ms); });
  const go = (el, off) => { if (!el) return; if (window.FCS && FCS.scrollTo) FCS.scrollTo(el, off == null ? -84 : off); else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const inView = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight - 20; };
  const isVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv|3gp|insv|lrv)$/i.test(f.name);
  const isAudio = f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(f.name);
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  // Echtes Bild: nicht schwarz und nicht einfarbig (Samsung lieferte beim Export eine gleichmäßige lila Fläche)
  const nb = l => !!(l && l.max >= 6 && (l.std == null || l.std >= .8 || l.range >= 6));
  const flatL = l => !!(l && !nb(l));
  const ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>'
  };

  /* =====================================================================
     Zustand
     ===================================================================== */
  const S = {
    clips: [], sel: 0, demo: true, uid: 0,
    mode: 'trim', style: 'action', sceneLen: 5, trOv: {}, viewSeq: false, seq: null, fadeEnd: true,
    music: null, origVol: 1, sound: false,
    fmt: 'orig', aspect: 16 / 9, q: 'orig',
    look: 'natur', lookK: .8, lookTouched: false,
    st: [], selSt: null, sid: 0, osd: false, osdDemo: false,
    ln: { name: '', mode: 'start', force: false },
    tag: { alias: '', style: 'band', img: true },
    member: null, step: 1, visited: { 1: true }, busy: false, interacted: false,
    result: null, resultSig: '', done: { dl: false, sent: false }
  };
  const P = { on: false, t: 0, last: 0, raf: 0, visible: false, cur: null, glUse: false, tr: null };
  const IMG = {};
  let stage, wrap, layer, vids, ovc, octx, glc, GL = null, glOff = false, box = { w: 0, h: 0 };
  let demoTL = null, hintLoop = null;
  const def = k => STICKER.find(s => s.k === k);
  const byId = id => S.st.find(s => s.id === +id);
  const isMember = () => { const m = S.member; return !!(m && m.c && (!m.bis || m.bis >= new Date().getFullYear())); };
  const own = () => S.clips.filter(c => !c.demo);
  const curClip = () => S.clips[S.sel] || S.clips[0] || null;
  const fmtA = f => f === '9:16' ? 9 / 16 : f === '1:1' ? 1 : f === '16:9' ? 16 / 9 : (() => { const c = S.clips[0]; return c && c.w && c.h ? c.w / c.h : 16 / 9; })();

  /* =====================================================================
     Clips
     ===================================================================== */
  function mkVideo(src, poster) {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    ['playsinline', 'webkit-playsinline', 'muted', 'disablepictureinpicture', 'disableremoteplayback'].forEach(a => v.setAttribute(a, ''));
    v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1; v.className = 'vid';
    // Zeitpunkt des letzten Suchens merken (vReady): kurz nach dem Suchen ist das Bild am Handy oft noch nicht da
    v.addEventListener('seeking', () => { v._sk = performance.now(); });
    v.addEventListener('seeked', () => { v._sk = performance.now(); P.dirty = true; });
    v.addEventListener('emptied', () => { v._sk = performance.now(); });
    if (poster) v.poster = poster;
    vids.appendChild(v);
    if (src) v.src = src;
    return v;
  }
  function newClip(o) {
    const c = Object.assign({ id: ++S.uid, file: null, src: '', name: '', size: 0, demo: false, el: null, el2: null, info: null, w: 0, h: 0, dur: 0, fps: 30, a: 0, b: 0, pan: { x: .5, y: .5 }, marks: [], thumbs: [], state: 'laden', msg: '', mode: null, lum: {}, elSamples: [], ref: null, glBad: false, poster: '' }, o);
    return c;
  }
  function addFiles(list) {
    if (S.busy) return;
    let files = [...(list || [])].filter(f => f && f.size);
    if (files.some(isVideo)) S.left = false;
    const bad = files.filter(f => !isVideo(f));
    files = files.filter(isVideo);
    if (!files.length) { if (bad.length) err('Das ist keine Videodatei. Wähl ein Video (MP4, MOV, WebM), Musik kommt in Schritt 3.'); return; }
    interact(); err(null);
    if (S.demo) clearDemo();
    if (!isMember()) {
      if (files.length > 1 || own().length) note1('Mehrere Clips aneinander und Auto-Schnitt sind Premium für Mitglieder. Jetzt ist dein neues Video geladen.', true);
      own().forEach(c => removeClip(c, true)); files = files.slice(0, 1);
    } else if (own().length + files.length > MAXCLIPS) {
      note1(`Höchstens ${MAXCLIPS} Clips auf einmal. Die ersten ${MAXCLIPS - own().length} sind drin.`);
      files = files.slice(0, Math.max(0, MAXCLIPS - own().length));
    } else note1('');
    const first = S.clips.length;
    files.forEach(f => { const c = newClip({ file: f, src: URL.createObjectURL(f), name: f.name, size: f.size }); S.clips.push(c); loadClip(c); });
    S.result = null; S.done = { dl: false, sent: false };
    select(first);
    renderClips(); steps(); goState(); syncUp();
    const tag = $('#st-tag'); if (tag) { tag.textContent = 'DEIN VIDEO'; tag.classList.add('own'); }
    const drop = $('#st-drop'); if (drop) drop.classList.add('gone'); hideHint();
    // Rückmeldung Mitglied 28.10.: nach der Auswahl immer zum Editor springen und zeigen, dass das Video drin ist
    go($('#st-steps') || wrap, -100);
    if (stage) { stage.classList.remove('st-loaded'); void stage.offsetWidth; stage.classList.add('st-loaded'); }
    { const nn = $('#clips-note'); if (!nn || nn.hidden) note1(files.length > 1 ? `${files.length} Videos geladen. Jetzt hier im Editor schneiden.` : 'Dein Video ist geladen. Jetzt hier im Editor schneiden.'); }
  }
  function removeClip(c, quiet) {
    const i = S.clips.indexOf(c); if (i < 0) return;
    S.clips.splice(i, 1);
    [c.el, c.el2].forEach(v => { if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch (e) {} } });
    if (c.src && c.file) URL.revokeObjectURL(c.src);
    if (c.file) media().then(m => m.drop(c.file)).catch(() => {});
    if (!quiet) {
      if (S.sel >= S.clips.length) S.sel = Math.max(0, S.clips.length - 1);
      if (!S.clips.length) { resetToDemo(); return; }
      select(S.sel); renderClips(); rebuild(); steps(); goState(); syncUp();
    }
  }
  function stageMsg() {
    const c = curClip(); if (!c || c.demo) { if (stageMsg.on) { err(null); stageMsg.on = false; } return; }
    if (c.state === 'nicht' || c.state === 'nurExport') {
      stageMsg.on = true;
      err(esc(c.msg), apiClips() ? '<button class="btn amber solid" type="button" id="err-orig">Original an den Verein schicken</button>' : '');
      const b = $('#err-orig'); if (b) b.addEventListener('click', () => { setStep(5); const r = $('input[name=snd-what][value=orig]'); if (r) { r.checked = true; sndUI(); } setTimeout(() => go($('#send-wrap'), -120), 60); });
    } else if (stageMsg.on) { err(null); stageMsg.on = false; }
  }
  function select(i) {
    S.sel = clamp(i, 0, Math.max(0, S.clips.length - 1));
    const c = curClip(); if (!c) return;
    stageMsg();
    const nm = $('#st-name'); if (nm) nm.textContent = c.demo ? c.name : c.name + (c.size ? ' · ' + MB(c.size) : '');
    renderClips(); tlDraw(); strip(); panUI(); markUI();
    if (P.on && playMode() === 'clip') { stopAll(); play(); } else seekView();
  }
  async function loadClip(c) {
    c.state = 'laden'; renderClips();
    const el = c.el = mkVideo('', c.poster);
    el.addEventListener('error', () => { if (c.state === 'laden') c._elErr = true; });
    const pMeta = once(el, 'loadedmetadata', 20000).then(() => true, () => false);
    const pInfo = c.file ? media().then(m => m.probe(c.file)).catch(e => ({ err: 'lib', msg: e && e.message })) : Promise.resolve(null);
    el.src = c.src;
    const [meta, info] = await Promise.all([pMeta, pInfo]);
    if (!S.clips.includes(c)) return;
    c.info = info;
    if (info && info.ok) { c.w = info.w; c.h = info.h; c.fps = info.fps || 30; c.dur = info.dur || 0; }
    const elOk = meta && el.videoWidth > 0;
    if (elOk) {
      if (!c.w) { c.w = el.videoWidth; c.h = el.videoHeight; }
      // Das Element zeigt die Drehung schon richtig an: seine Maße gelten für die Vorschau
      c.ew = el.videoWidth; c.eh = el.videoHeight;
      if (isFinite(el.duration) && el.duration > 0) c.dur = c.dur || el.duration;
    }
    if (!c.dur && elOk) { try { el.currentTime = 1e7; await once(el, 'seeked', 5000); c.dur = el.currentTime || el.duration || 0; el.currentTime = 0; } catch (e) {} }
    if (!elOk) {
      c.state = 'nicht'; c.msg = notPlayable(info);
      if (info && info.ok && info.canDecode) { c.mode = 'draw'; c.state = 'nurExport'; c.msg = `Dein Browser spielt dieses Format (${fmtLine(info)}) nicht ab, kann es aber rechnen: Die Vorschau zeigt ein Standbild, das fertige Video wird trotzdem vollständig.`; }
    } else c.state = 'ok';
    if (c.dur) { c.a = 0; c.b = Math.min(c.dur, MAXLEN); }
    if (c.demo) c.fps = 25;
    if (S.clips[0] === c && S.fmt === 'orig') setFmt('orig');
    renderClips(); rebuild(); tlDraw(); layout(); goState(); steps();
    if (c.dur) thumbsFor(c);
    if (S.clips[S.sel] === c) { stageMsg(); strip(); seekView(); if (!c.demo && P.visible) play(); }
    if (c.file) selftest(c);
  }
  /* Klare Meldung, wenn der Browser die Videospur nicht abspielt (zum Beispiel HEVC 10 Bit in Chrome ohne passenden Grafikchip) */
  function fmtLine(info) {
    if (!info || !info.ok) return '';
    const parts = [];
    parts.push((({ avc: 'H.264', hevc: 'HEVC (H.265)', vp9: 'VP9', av1: 'AV1', vp8: 'VP8', prores: 'ProRes' })[info.codec] || String(info.codec || 'unbekannt').toUpperCase()) + (info.bits > 8 ? ` ${info.bits} Bit` : ''));
    if (info.hdr) parts.push(info.transfer === 'pq' ? 'HDR10 (PQ)' : info.transfer === 'hlg' ? 'HDR (HLG)' : 'HDR');
    parts.push(`${info.w} × ${info.h}`);
    if (info.fps) parts.push((Math.round(info.fps * 100) / 100).toLocaleString('de-DE') + (info.vfr ? ' fps variabel' : ' fps'));
    return parts.join(' · ');
  }
  function notPlayable(info) {
    if (!info || info.err === 'format') return 'Dieses Dateiformat kann dein Browser nicht öffnen. Schick das Original trotzdem an den Verein, dort wird es verarbeitet.';
    if (info.err === 'novideo') return 'In dieser Datei steckt keine Videospur.';
    const f = fmtLine(info), hevc = info.codec === 'hevc';
    const ua = navigator.userAgent, safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua), firefox = /Firefox/.test(ua);
    let tip = '';
    if (hevc) tip = safari ? 'Aktualisier Safari auf die neueste Version.' : firefox ? 'Öffne die Seite in Chrome, Edge oder Safari, die spielen HEVC auf den meisten Geräten ab.' : 'Am iPhone filmst du künftig in H.264 mit Einstellungen › Kamera › Formate › „Maximale Kompatibilität“. Am PC spielen Edge und Chrome HEVC, wenn die Grafikkarte es unterstützt, am Mac und iPhone Safari.';
    else tip = 'Probier Chrome, Edge oder Safari in der neuesten Version.';
    return `Dein Browser kann die Videospur dieser Datei nicht anzeigen (${f}). ${tip} In voller Qualität an den Verein schicken geht trotzdem, das Original bleibt dabei unverändert.`;
  }
  /* ---------- Selbsttest: liefert jeder Weg echte Bilder? ---------- */
  async function selftest(c) {
    const info = c.info;
    if (!info || !info.ok || !c.dur) { evalClip(c); return; }
    const times = [.18, .5, .82].map(k => Math.min(c.dur - .05, Math.max(0, k * c.dur)));
    if (info.canDecode) {
      try {
        const M = await media();
        // Wege der Reihe nach testen, beim ersten mit echtem Bild aufhören
        for (const w of M.WAYS) { c.lum[w] = await M.lumaAt(c.file, times, w); if (c.lum[w].some(nb)) break; }
      } catch (e) { console.info('Clip-Studio: Selbsttest WebCodecs', e && e.message); }
    }
    c.tested = true; evalClip(c);
  }
  const WAYS = ['draw', 'cpu', 'copy', 'raw', 'sw'];
  function evalClip(c) {
    if (S.locked) {
      // Pixel-Prüfungen sagen hier nichts aus: Video-Element in Echtzeit nehmen, nichts verweigern
      c.ref = true; c.glBad = true; c.elBlack = false;
      c.mode = c.state === 'ok' ? 'element' : (c.info && c.info.canDecode ? 'draw' : null);
      renderClips(); return;
    }
    const L = c.lum, el = c.elSamples.length >= 2 ? c.elSamples : null;
    const wc = WAYS.find(w => L[w] && L[w].some(nb)) || null, elOk = !!(el && el.some(nb));
    const wcDone = !c.info || !c.info.canDecode || WAYS.every(w => L[w]) || !!wc || (c.tested && !wc);
    c.ref = wc || elOk ? true : (wcDone && el) ? false : null;
    c.elBlack = !!(el && !elOk && c.ref === true);
    if (c.elBlack) c.glBad = true;
    const before = c.mode;
    // Kein Weg mit echtem Bild und auch die Vorschau ist leer: nichts exportieren (sonst entsteht ein leeres Video)
    if (wc) c.mode = wc;
    else if (c.state === 'ok') c.mode = c.elBlack || c.ref === false ? null : 'element';
    else if (c.info && c.info.canDecode && !c.tested) c.mode = 'draw';
    else c.mode = null;
    if (before !== c.mode && WAYS.includes(c.mode) && before !== null && !c._thumbing && c.thumbs.length) { c.thumbs = []; thumbsFor(c); }
    renderClips();
  }
  function k24() { return sampleEl.c || (sampleEl.c = (() => { const x = document.createElement('canvas'); x.width = x.height = 24; return x.getContext('2d', { willReadFrequently: true }); })()); }
  function lum24(k, n = 24) {
    const d = k.getImageData(0, 0, n, n).data; let mx = 0, mn = 255, sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 4) { const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; if (l > mx) mx = l; if (l < mn) mn = l; sum += l; sq += l * l; }
    const m = sum / (n * n); return { max: mx, min: mn, mean: m, std: Math.sqrt(Math.max(0, sq / (n * n) - m * m)), range: mx - mn };
  }
  function sampleEl(c, v) {
    // Während die Vorschau läuft: drei Proben aus dem Video-Element (zeigt, ob der Browser Bilder an Canvas/WebGL weitergibt)
    if (c.elSamples.length >= 3 || !v || v.readyState < 2 || v.seeking || v.currentTime < .3) return;
    const now = performance.now(); if (c._lastSample && now - c._lastSample < 600) return; c._lastSample = now;
    try {
      const k = k24();
      k.fillStyle = '#000'; k.fillRect(0, 0, 24, 24); k.drawImage(v, 0, 0, 24, 24);
      const T = window.FCS_STUDIO_TEST; c.elSamples.push(T && (T.black || []).includes('element') ? { max: 0, mean: 0, std: 0, range: 0 } : lum24(k));
    } catch (e) { c.elSamples.push({ max: 0, mean: 0, std: 0, range: 0, err: 1 }); }
    if (c.elSamples.length >= 2) evalClip(c);
  }

  function renderClips() {
    const ul = $('#clips'); if (!ul) return;
    const list = S.clips;
    const ae = document.activeElement, keep = ae && ul.contains(ae) ? [ae.closest('li') && ae.closest('li').dataset.id, ae.dataset.act] : null;
    ul.innerHTML = list.map((c, i) => {
      const f = c.info && c.info.ok ? fmtLine(c.info) : c.w ? `${c.w} × ${c.h}` : '';
      const meta = [f, c.dur ? tS(c.dur) : '', c.size ? MB(c.size) : ''].filter(Boolean).join(' · ');
      let st = '';
      if (c.demo) st = '<span class="cl-st">Beispielclip vom Verein</span>';
      else if (c.state === 'laden') st = '<span class="cl-st wait">Wird geöffnet …</span>';
      else if (c.state === 'nicht' || c.state === 'nurExport') st = `<span class="cl-st bad">${ICON.warn}${esc(c.msg)}</span>`;
      else if (c.ref === false) st = `<span class="cl-st">${ICON.ok}Läuft. Das Bild ist an den geprüften Stellen sehr dunkel oder schwarz.</span>`;
      else if (c.mode && c.ref) st = `<span class="cl-st ok">${ICON.ok}Bild geprüft: Vorschau und Export laufen${['cpu', 'copy', 'raw', 'sw'].includes(c.mode) ? ' (über den sicheren Weg)' : c.mode === 'element' ? ' (in Echtzeit)' : ''}</span>`;
      else if (c.state === 'ok' && c.elBlack && !c.mode) st = `<span class="cl-st bad">${ICON.warn}Die Vorschau läuft, aber dieser Browser gibt die Bilder nicht zum Rechnen frei. Rechne das Video in Chrome oder Edge oder schick das Original an den Verein.</span>`;
      else st = '<span class="cl-st wait">Bild wird geprüft …</span>';
      const hdr = c.info && c.info.hdr ? '<em class="cl-b">HDR</em>' : '';
      const port = c.h > c.w ? '<em class="cl-b">Hochkant</em>' : '';
      const nM = c.marks.length;
      return `<li class="cl${i === S.sel ? ' on' : ''}${c.demo ? ' demo' : ''}" data-id="${c.id}">
        <button type="button" class="cl-main" data-act="sel" aria-pressed="${i === S.sel}">
          <span class="cl-th"><canvas width="96" height="54" data-th="${c.id}"></canvas><b>${i + 1}</b></span>
          <span class="cl-tx"><b>${esc(c.name)}</b><small>${esc(meta)}</small>${st}</span>
        </button>
        <span class="cl-side">${hdr}${port}${S.mode === 'auto' && nM ? `<em class="cl-b star">${nM} ★</em>` : ''}
          ${list.length > 1 && !c.demo ? `<button type="button" class="cl-ic" data-act="up" aria-label="Clip ${i + 1} nach vorn"${i === 0 ? ' disabled' : ''}>${ICON.up}</button><button type="button" class="cl-ic" data-act="down" aria-label="Clip ${i + 1} nach hinten"${i === list.length - 1 ? ' disabled' : ''}>${ICON.down}</button>` : ''}
          ${c.demo ? '' : `<button type="button" class="cl-ic del" data-act="del" aria-label="Clip ${i + 1} entfernen">${ICON.x}</button>`}</span>
      </li>`;
    }).join('');
    $$('canvas[data-th]', ul).forEach(cv => { const c = S.clips.find(x => x.id === +cv.dataset.th); const t = c && (c.thumbs[Math.floor(c.thumbs.length / 3)] || c.thumbs.find(Boolean)); if (t) { try { cv.getContext('2d').drawImage(t, 0, 0, 96, 54); } catch (e) {} } else if (c && c.poster) { const im = new Image(); im.onload = () => { try { const x = cv.getContext('2d'); const s = Math.max(96 / im.width, 54 / im.height); x.drawImage(im, (96 - im.width * s) / 2, (54 - im.height * s) / 2, im.width * s, im.height * s); } catch (e) {} }; im.src = c.poster; } });
    const add = $('#clips-add'); if (add) add.querySelector('span').textContent = own().length ? (isMember() ? 'Weitere Clips' : 'Anderes Video') : 'Clips auswählen';
    const none = $('#clips-none'); if (none) none.hidden = !!own().length;
    if (keep) { const f = $(`#clips li[data-id="${keep[0]}"] [data-act="${keep[1]}"]`); if (f && !f.disabled) f.focus({ preventScroll: true }); }
  }
  function clipsUI() {
    const ul = $('#clips'); if (!ul) return;
    ul.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || S.busy) return;
      const li = b.closest('li'); const c = S.clips.find(x => x.id === +li.dataset.id); if (!c) return;
      const i = S.clips.indexOf(c);
      interact();
      if (b.dataset.act === 'sel') select(i);
      else if (b.dataset.act === 'del') removeClip(c);
      else if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= S.clips.length) return;
        S.clips.splice(i, 1); S.clips.splice(j, 0, c); S.sel = j; renderClips(); rebuild();
        const nb2 = $(`#clips li[data-id="${c.id}"] [data-act="${b.dataset.act}"]`); if (nb2 && !nb2.disabled) nb2.focus(); else { const s2 = $(`#clips li[data-id="${c.id}"] [data-act="sel"]`); if (s2) s2.focus(); }
      }
    });
  }
  /* Vorschaubilder für Zeitleiste, Clip-Karten und Szenen-Streifen (12 je Clip, für jeden Clip) */
  const NTH = 12;
  function strip() {
    const c = curClip(), cv = $('#tl-strip'), tl = $('#tl'); if (!c || !cv || !tl) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round((tl.clientWidth || 300) * dpr), H = Math.round((tl.clientHeight || 60) * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
    const tw = W / NTH;
    c.thumbs.forEach((t, i) => { if (!t) return; const sa = t.width / t.height, ta = tw / H; let sw = t.width, sh = t.height, sx = 0, sy = 0; if (sa > ta) { sw = sh * ta; sx = (t.width - sw) / 2; } else { sh = sw / ta; sy = (t.height - sh) / 2; } try { x.drawImage(t, sx, sy, sw, sh, i * tw, 0, tw + 1, H); } catch (e) {} });
    if (!c.thumbs.length) thumbsFor(c);
  }
  async function thumbsFor(c) {
    if (!c.dur || c._thumbing) return;
    c._thumbing = 1; c.thumbs = new Array(NTH).fill(null);
    const times = Array.from({ length: NTH }, (_, i) => (i + .5) * c.dur / NTH);
    const upd = () => { if (curClip() === c) strip(); };
    const done = () => { c._thumbing = 0; upd(); renderClips(); sbDraw(); if (c.state === 'nurExport' && c.el && c.thumbs[0]) { try { c.el.poster = c.thumbs[Math.floor(NTH / 3)].toDataURL('image/jpeg', .8); c.el.classList.add('on'); } catch (e) {} } };
    if (c.file && c.info && c.info.canDecode && c.mode !== 'element') {
      try { const M = await media(); await M.thumbs(c.file, times, 160, 90, WAYS.includes(c.mode) ? c.mode : 'draw', (i, t) => { c.thumbs[i] = t; upd(); }); done(); return; } catch (e) {}
    }
    if (c.state !== 'ok') { c._thumbing = 0; return; }
    // Ersatz: eigenes Video-Element springen lassen
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = c.src;
    try { await once(v, 'loadeddata', 8000); } catch (e) { c._thumbing = 0; return; }
    for (let i = 0; i < NTH; i++) {
      v.currentTime = times[i]; try { await once(v, 'seeked', 4000); } catch (e) { break; }
      try { const t = document.createElement('canvas'); t.width = 160; t.height = 90; const k = t.getContext('2d'); const sa = v.videoWidth / v.videoHeight; let sw = v.videoWidth, sh = v.videoHeight; if (sa > 16 / 9) sw = sh * 16 / 9; else sh = sw * 9 / 16; k.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, 160, 90); c.thumbs[i] = t; upd(); } catch (e) { break; }
    }
    v.removeAttribute('src'); v.load(); done();
  }

  /* =====================================================================
     Schnittfolge (Szenen): Zuschneiden oder Auto-Schnitt im Takt
     ===================================================================== */
  const SPEED = {
    1: { avg: 1, at: () => 1 },
    slow: { avg: .5, at: () => .5 },
    ramp: { avg: 0, at: u => u < .38 ? 1.75 : u < .62 ? 1.75 + (.5 - 1.75) * ((x => x * x * (3 - 2 * x))((u - .38) / .24)) : .5 }
  };
  // Durchschnitt der Rampe numerisch
  SPEED.ramp.avg = (() => { let s = 0; for (let i = 0; i < 200; i++) s += SPEED.ramp.at((i + .5) / 200); return s / 200; })();
  function srcFn(seg) {
    const sp = SPEED[seg.kind] || SPEED[1];
    if (seg.kind === '1' || !seg.kind) return l => seg.a + l;
    if (seg.kind === 'slow') return l => seg.a + l * .5;
    // Rampe: Integral vorberechnen
    const N = 96, acc = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) acc[i + 1] = acc[i] + sp.at((i + .5) / N) * seg.len / N;
    return l => { if (l >= seg.len) return seg.a + acc[N] + (l - seg.len) * sp.at(1); const x = clamp(l / seg.len * N, 0, N); const i = Math.floor(x), f = x - i; return seg.a + acc[i] + (i < N ? (acc[i + 1] - acc[i]) * f : 0); };
  }
  function rateAt(seg, l) { const sp = SPEED[seg.kind] || SPEED[1]; return sp.at(clamp(l / seg.len, 0, 1)); }
  function marksAll() { const out = []; S.clips.forEach((c, ci) => c.marks.slice().sort((x, y) => x.t0 - y.t0).forEach(m => out.push({ c, ci, m }))); return out; }
  function grid() {
    const m = S.music;
    if (m && m.beats && m.beats.length > 4) {
      const B = m.beats; let j = 0; while (j < B.length && B[j] < m.start - .03) j++;
      if (j >= B.length - 2) j = 0;
      const t0 = B[j], p = 60 / (m.bpm || 120);
      const times = [], str = [];
      for (let i = j; i < B.length; i++) { times.push(B[i] - t0); str.push(m.str ? m.str[i] : 1); }
      while (times.length < 4000 && times[times.length - 1] < MAXLEN + 8) { times.push(times[times.length - 1] + p); str.push(.5); }
      return { times, str, p, t0, music: true };
    }
    const p = .5, times = [], str = []; for (let i = 0; i < (MAXLEN + 8) / p; i++) { times.push(i * p); str.push(i % 4 === 0 ? 1 : .5); }
    return { times, str, p, t0: 0, music: false };
  }
  function trName(key, i, st) { return S.trOv[key] || (st ? st.trs[(i - 1) % st.trs.length] : 'schnitt'); }
  function buildSeq() {
    const list = S.clips.filter(c => c.dur > 0 && (c.state === 'ok' || c.state === 'nurExport'));
    const segs = [];
    let st = null;
    if (S.mode === 'auto' && (isMember() || S.demo) && marksAll().length) {
      st = STYLES[S.style] || STYLES.action;
      const G = grid(); let j = 0, total = 0;
      const pick = (target, flex) => {
        target = Math.min(target, G.times.length - 1);
        if (!flex) return target;
        let best = target, bv = G.str[target] || 0;
        for (const k of [target - 1, target + 1]) if (k > j && k < G.times.length && (G.str[k] || 0) > bv + .12) { best = k; bv = G.str[k]; }
        return best;
      };
      for (const { c, ci, m } of marksAll()) {
        if (!list.includes(c) || total >= MAXLEN) continue;
        if (st.chop) {
          let src = m.t0, k = 0; const end = Math.min(c.dur, m.t0 + m.len);
          while (src < end - .25 && total < MAXLEN) {
            const kind = st.ramp && k % st.ramp === st.ramp - 1 ? 'ramp' : '1';
            let jE = pick(j + st.chop, st.flex); if ((G.times[jE] - G.times[j]) * SPEED[kind].avg > c.dur - src + .02) jE = j + st.chop;
            const len = G.times[jE] - G.times[j];
            const sl = len * SPEED[kind].avg;
            if (src + sl > c.dur + .02) { if (k === 0) { const l2 = Math.max(.3, c.dur - src); segs.push({ ci, c, a: Math.max(0, c.dur - l2), len: l2, kind: '1', key: m.id + ':' + k }); total += l2; j = G.times.findIndex(x => x >= total - .01); if (j < 0) j = G.times.length - 1; } break; }
            segs.push({ ci, c, a: src, len, kind, key: m.id + ':' + k }); total += len; src += sl; j = jE; k++;
          }
        } else {
          const kind = st.slow && c.fps >= 47 ? 'slow' : '1';
          const span = k => (G.times[Math.min(j + k, G.times.length - 1)] - G.times[j]) * SPEED[kind].avg;
          let n = Math.max(st.min, Math.round(m.len / G.p / st.group) * st.group);
          while (n > st.group && span(n) > c.dur + .01) n -= st.group;
          while (n > 1 && span(n) > c.dur + .01) n--;
          let jE = j + n; const jF = pick(jE, st.flex); if (span(jF - j) <= c.dur + .01) jE = jF;
          const len = G.times[jE] - G.times[j], sl = len * SPEED[kind].avg;
          const mid = m.t0 + m.len / 2, a = clamp(mid - sl / 2, 0, Math.max(0, c.dur - sl));
          segs.push({ ci, c, a, len, kind, key: m.id + ':0' }); total += len; j = jE;
        }
      }
    } else {
      const use = (isMember() ? list : list.slice(0, 1));
      use.forEach(c => { const len = Math.max(MINLEN, (c.b || c.dur) - c.a); segs.push({ ci: S.clips.indexOf(c), c, a: c.a, len, kind: '1', key: 'c' + c.id }); });
    }
    let at = 0;
    segs.forEach((s, i) => {
      s.at = at; at += s.len; s.src = srcFn(s);
      if (i > 0) {
        s.tr = trName(s.key, i, st);
        const T = (window.__fcsTrans || {})[s.tr] || { d: 0 };
        s.d = s.tr === 'schnitt' ? 0 : Math.min(T.d || .4, segs[i - 1].len * .45, s.len * .45);
      } else { s.tr = null; s.d = 0; }
      // Video-Element der Szene: folgt sie im selben Clip nicht nahtlos auf die vorige, nimmt sie das zweite Element (el2)
      const pv = segs[i - 1];
      if (pv && pv.c === s.c) s.slot = Math.abs(pv.src(pv.len) - s.src(0)) < .12 ? pv.slot : 1 - pv.slot; else s.slot = 0;
      if (s.slot && !s.c.el2 && vids && s.c.src) s.c.el2 = mkVideo(s.c.src);
    });
    S.seq = { segs, total: Math.min(at, MAXLEN), style: st ? S.style : null, fade: st ? st.fade : (S.fadeEnd && segs.length > 1 ? .6 : 0) };
    return S.seq;
  }
  function rebuild() {
    buildSeq(); sbDraw(); sumLine(); markUI();
    if (playMode() === 'seq') { P.t = clamp(P.t, 0, Math.max(0, S.seq.total - .05)); if (!P.on) seekView(); }
  }
  const vidOf = s => (s.slot && s.c.el2) || s.c.el;
  /* Hat das Video an seiner Stelle wirklich ein Bild? (nicht beim Suchen und kurz danach: Android liefert dann schwarze oder lila Flächen) */
  function vReady(v) {
    if (!v) return false;
    if (!('readyState' in v)) return true;
    return v.readyState >= 2 && !v.seeking && !(v._sk > 0 && performance.now() - v._sk < 60) && v.videoWidth > 0;
  }
  function seqAt(t) {
    const segs = S.seq ? S.seq.segs : []; if (!segs.length) return null;
    let i = 0; while (i < segs.length - 1 && t >= segs[i + 1].at) i++;
    const s = segs[i], l = t - s.at;
    const r = { i, s, l, prev: null, p: 0 };
    if (i > 0 && s.d > 0 && l < s.d) { r.prev = segs[i - 1]; r.p = l / s.d; }
    return r;
  }

  /* =====================================================================
     Vorschau-Player
     ===================================================================== */
  const playMode = () => (S.step <= 2 && !S.viewSeq) || !S.seq || !S.seq.segs.length ? 'clip' : 'seq';
  function clipRange(c) { return S.mode === 'auto' && (isMember() || S.demo) ? [0, c.dur] : [c.a, c.b || c.dur]; }
  function stopAll(except) { S.clips.forEach(c => [c.el, c.el2].forEach(v => { if (v && !(except && except.includes(v)) && !v.paused) v.pause(); })); if (S.music && S.music.el && !(except && except.includes(S.music.el))) S.music.el.pause(); }
  function play() {
    if (!S.clips.length) return;
    P.on = true; P.last = performance.now(); $('#st-play') && $('#st-play').classList.add('on');
    const b = $('#st-play'); if (b) b.setAttribute('aria-label', 'Pause');
    if (playMode() === 'clip') { const c = curClip(); if (c && c.el) { const [lo, hi] = clipRange(c); if (c.el.currentTime < lo || c.el.currentTime >= hi - .05) c.el.currentTime = lo; tryPlay(c.el); } }
    if (!P.raf && P.visible) P.raf = requestAnimationFrame(frame);
  }
  function pause() {
    P.on = false; stopAll();
    const b = $('#st-play'); if (b) { b.classList.remove('on'); b.setAttribute('aria-label', 'Abspielen'); }
  }
  function tryPlay(v) {
    if (!v || !v.paused) return;
    const p = v.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotAllowedError') { const t = $('#st-tap'); if (t) t.hidden = false; } });
  }
  function drive(v, want, rate, run, tolRun) {
    if (!v || !isFinite(want)) return;
    want = clamp(want, 0, Math.max(0, (v.duration || 1e9) - .04));
    const tol = run ? (tolRun || .3) : .045;
    if (!v.seeking && Math.abs(v.currentTime - want) > tol) { try { v.currentTime = want; } catch (e) {} }
    const r = clamp(rate || 1, .25, 4); if (Math.abs(v.playbackRate - r) > .01) { try { v.playbackRate = r; } catch (e) {} }
    // Am Clip-Ende nicht wieder starten: play() auf ein beendetes Video springt an den Anfang (falsches Bild, am Handy schwarz)
    if (run) { if (!v.ended) tryPlay(v); } else if (!v.paused) v.pause();
  }
  function seekView() { if (!P.raf && P.visible) P.raf = requestAnimationFrame(frame); P.dirty = true; }
  function frame(now) {
    P.raf = 0;
    if (!P.visible) return;
    const dt = Math.min(.25, (now - (P.last || now)) / 1000); P.last = now;
    const mode = playMode();
    let A = null, B = null, cA = null, cB = null, tr = null, tShow = 0, fade = 0;
    if (mode === 'clip') {
      const c = curClip();
      if (c && c.el) {
        const [lo, hi] = clipRange(c);
        if (P.on) { if (c.el.currentTime >= hi - .03 || c.el.ended) { c.el.currentTime = lo; } tryPlay(c.el); }
        A = c.el; cA = c; tShow = Math.max(0, c.el.currentTime - (S.mode === 'auto' ? 0 : c.a));
        S.clips.forEach(x => [x.el, x.el2].forEach(v => { if (v && v !== c.el && !v.paused) v.pause(); }));
        if (S.music && S.music.el && !S.music.el.paused) S.music.el.pause();
        audioFor(c.el, 1);
      }
    } else {
      const seq = S.seq;
      if (P.on) {
        // Uhr: läuft Musik, gibt die Tonspur den Takt vor (Audio-Uhr des Geräts). Kommt ein Bild zu spät, wird es ausgelassen,
        // die Musik wird nie angehalten oder zurückgespult. Ohne Musik: Echtzeit, beim Suchen des Videos kurz warten.
        const m = S.music, a = m && m.el;
        const aRun = !!(a && !a.paused && !a.seeking && a.readyState >= 2 && !S.busy);
        if (aRun) { const ca = a.currentTime, d = ca - (P.aLast == null ? ca : P.aLast); P.aLast = ca; P.t += d >= 0 && d < .5 ? d : dt; }
        else if (a && !a.paused && !S.busy) { P.aLast = null; } // Musik lädt oder sucht gerade: Bild wartet mit, statt davonzulaufen
        else { P.aLast = null; const r0 = seqAt(P.t), main = r0 && vidOf(r0.s); if (!(main && main.seeking)) P.t += dt; }
        if (P.t >= seq.total) { P.t = 0; P.aLast = null; }
      }
      const r = seqAt(P.t);
      if (r) {
        const s = r.s; cB = null;
        cA = s.c;
        // Jede Szene hat ihr festes Video-Element (vidOf): zwei Szenen aus demselben Clip wechseln zwischen el und el2,
        // damit im Übergang keines der beiden Videos springen (suchen) muss. Suchende Videos zeigen am Handy schwarze oder lila Flächen.
        const vMain = vidOf(s);
        if (r.prev) {
          const pv = r.prev, vPrev = vidOf(pv);
          // Im Übergang nur bei großem Versatz nachstellen: jedes Suchen kostet am Handy Bilder
          drive(vPrev, pv.src(pv.len + r.l), rateAt(pv, pv.len), P.on, 1.5);
          if (vPrev !== vMain) drive(vMain, s.src(r.l), rateAt(s, r.l), P.on, 1.5);
          A = vPrev; B = vMain; cA = pv.c; cB = s.c; tr = { type: s.tr, p: r.p, seed: Math.floor(P.t * 30) % 97 };
          stopAll([vPrev, vMain, S.music && S.music.el]);
        } else {
          drive(vMain, s.src(r.l), rateAt(s, r.l), P.on); A = vMain;
          const nx = seq.segs[r.i + 1];
          const keep = [vMain, S.music && S.music.el];
          // Nächste Szene früh vorbereiten (pausiert an ihrem ersten Bild), damit sie beim Übergang schon ein Bild hat
          if (nx && nx.at - P.t < 1.6) { const nv = vidOf(nx); if (nv && nv !== vMain) { drive(nv, nx.src(0), 1, false); keep.push(nv); } }
          stopAll(keep);
        }
        audioFor(B || A, (s.kind === '1' || !s.kind) ? S.origVol : 0);
        musicDrive();
        tShow = P.t;
        if (seq.fade > 0 && P.t > seq.total - seq.fade) fade = (P.t - (seq.total - seq.fade)) / seq.fade;
      }
    }
    P.cur = cA;
    // Ruhezustand: nichts hat sich geändert → nicht neu zeichnen (spart Akku)
    const key = [A && A.currentTime, A && A.readyState, vReady(A), B && B.currentTime, B && B.readyState, vReady(B), P.t, mode, S.look, S.lookK, box.w].join('|');
    if (P.on || P.dirty || key !== P.lastKey) {
      P.lastKey = key;
      paint(A, B, cA, cB, tr, fade);
      overlay(octx, ovc.width, ovc.height, tShow, true);
      tick(mode, tShow);
      if (cA && A && !cA.demo && A === cA.el && !A.paused) sampleEl(cA, A);
      [[cA, A], [cB, B]].forEach(([c, v]) => { if (c && v && !c.glProbed && !c.glBad) { const n = performance.now(); if (!c._lp || n - c._lp > 700) { c._lp = n; glProbe(c, v); } } });
    }
    P.dirty = false;
    P.raf = requestAnimationFrame(frame);
  }
  function audioFor(v, vol) {
    S.clips.forEach(c => [c.el, c.el2].forEach(x => { if (x && x !== v && !x.muted) x.muted = true; }));
    if (!v) return;
    const want = !S.sound || !(vol > 0) || S.busy;
    if (v.muted !== want) v.muted = want;
    if (!want) { try { v.volume = clamp(vol, 0, 1); } catch (e) {} }
  }
  function musicDrive() {
    const m = S.music; if (!m || !m.el) return;
    const want = (m.start || 0) + P.t;
    const a = m.el;
    if (!P.on || S.busy) { if (!a.paused) a.pause(); return; }
    const dur = a.duration || m.dur || 1e9; const w = want % dur;
    // Nur bei echten Sprüngen (Anfang, Spulen, Schleife) nachstellen, nicht wegen kleiner Ruckler im Bild
    const tol = a.paused ? .05 : .6;
    if (Math.abs(a.currentTime - w) > tol && !a.seeking) { try { a.currentTime = w; P.aLast = null; } catch (e) {} }
    let g = m.vol; const tot = S.seq.total;
    if (m.fin > 0 && P.t < m.fin) g *= P.t / m.fin;
    if (m.fout > 0 && P.t > tot - m.fout) g *= Math.max(0, (tot - P.t) / m.fout);
    try { a.volume = clamp(g, 0, 1); } catch (e) {}
    a.muted = !S.sound;
    tryPlay(a);
  }
  /* Zeichnen: WebGL (Look, Übergänge) oder direkt das Video-Element (sicherster Weg) */
  function cropN(c, v) {
    const sw = (v && v.videoWidth) || c.w || 16, sh = (v && v.videoHeight) || c.h || 9;
    const r = cropPx(sw, sh, S.aspect, c.pan);
    return [r.left / sw, r.top / sh, (r.left + r.width) / sw, (r.top + r.height) / sh];
  }
  function cropPx(sw, sh, A, pan, zoom) {
    const sa = sw / sh; let cw = sw, ch = sh;
    if (sa > A + 1e-3) cw = sh * A; else if (sa < A - 1e-3) ch = sw / A;
    if (zoom && zoom > 1) { cw /= zoom; ch /= zoom; }
    return { left: (sw - cw) * (pan ? pan.x : .5), top: (sh - ch) * (pan ? pan.y : .5), width: cw, height: ch };
  }
  let glTestFor = null;
  function paint(A, B, cA, cB, tr, fade) {
    // Übergang nur zeichnen, wenn beide Videos an ihrer Stelle ein Bild haben. Sonst lieber harter Schnitt
    // (altes Bild bleibt, bis das neue da ist) als eine schwarze oder lila Fläche.
    if (tr && B && A !== B) {
      const aOk = vReady(A), bOk = vReady(B);
      if (!bOk && (aOk || !(B.readyState >= 2))) { B = null; cB = null; tr = null; }
      else if (!aOk && bOk) { A = B; cA = cB; B = null; cB = null; tr = null; }
    }
    const look = S.look !== 'natur' && S.lookK > 0;
    if (GL && GL.lost) glLost();
    const need = !!(A && !glOff && (look || tr || fade > 0) && !(cA && cA.glBad) && !(cB && cB.glBad));
    if (need) needGL();
    const want = !!(need && GL && GL.ok && (A.readyState >= 2 || P.glUse));
    // Sucht ein Video gerade (readyState < 2), bleibt das letzte WebGL-Bild stehen, statt auf den Ersatzweg zu springen
    const ready = !!(A && A.readyState >= 2 && !A.seeking && (!B || !tr || vReady(B)));
    S.clips.forEach(c => [c.el, c.el2].forEach(v => { if (!v) return; const on = v === A || v === B; v.classList.toggle('on', on); }));
    // Fallback-Übergang ohne WebGL: Überblenden per Deckkraft, Blitz als weiße Fläche
    const fx = $('#st-fx');
    const reset = v => { if (!v) return; const st = v.style; if (st.opacity) st.opacity = ''; if (st.transform) st.transform = ''; if (st.clipPath) st.clipPath = ''; if (st.filter) st.filter = ''; if (st.zIndex) st.zIndex = ''; };
    if (!want && tr && B && A !== B) {
      // Übergänge ohne WebGL: Blende, Blitz, Zoom, Wisch, Whip-Pan und Glitch mit CSS auf den Video-Elementen
      const p = clamp(tr.p, 0, 1), e = p * p * (3 - 2 * p);
      S.clips.forEach(c => [c.el, c.el2].forEach(v => { if (v !== A && v !== B) reset(v); }));
      B.classList.add('on'); reset(A); reset(B); B.style.zIndex = 1;
      let flash = 0;
      switch (tr.type) {
        case 'blitz': A.style.opacity = 0; flash = Math.pow(1 - p, 2.2) * .95; break;
        case 'zoom': if (p < .5) { const q = p / .5; A.style.transform = `scale(${(1 + .45 * q * q).toFixed(3)})`; B.style.opacity = 0; } else { const q = (p - .5) / .5; A.style.opacity = 0; B.style.transform = `scale(${(1.3 - .3 * (1 - Math.pow(1 - q, 3))).toFixed(3)})`; } break;
        case 'wisch': { const k = e * 1.5 - .25, x0 = clamp(k / .8, 0, 1) * 100, x1 = clamp((k - .2) / .8, 0, 1) * 100; B.style.clipPath = `polygon(0 0, ${x0.toFixed(1)}% 0, ${x1.toFixed(1)}% 100%, 0 100%)`; break; }
        case 'whip': { const bl = (Math.sin(Math.PI * p) * 6).toFixed(1); A.style.transform = `translateX(${(-e * 100).toFixed(1)}%)`; B.style.transform = `translateX(${((1 - e) * 100).toFixed(1)}%)`; A.style.filter = B.style.filter = `blur(${bl}px)`; break; }
        case 'glitch': { const k = 1 - p, j = (Math.sin(tr.seed * 12.9898 + p * 40) * 43758.5453) % 1; B.style.transform = `translateX(${(j * 6 * k).toFixed(1)}%)`; if (p < .35 && tr.seed % 2) B.style.opacity = 0; break; }
        case 'schnitt': A.style.opacity = 0; break;
        default: B.style.opacity = e.toFixed(3);
      }
      if (fx) fx.style.opacity = flash;
    } else { S.clips.forEach(c => [c.el, c.el2].forEach(reset)); if (fx) fx.style.opacity = 0; }
    // Fallback-Look per CSS-Filter, Ausblenden per Schwarz
    vids.style.filter = !want && look && window.__fcsCssLook ? window.__fcsCssLook(S.look, S.lookK) : '';
    const fb = $('#st-fade'); if (fb) fb.style.opacity = !want && fade > 0 ? clamp(fade, 0, 1) : 0;
    // Bildausschnitt für die Video-Elemente
    [[A, cA], [B, cB]].forEach(([v, c]) => { if (!v || !c) return; const p = c.pan; v.style.objectPosition = `${(p.x * 100).toFixed(1)}% ${(p.y * 100).toFixed(1)}%`; });
    if (!want) { if (P.glUse) { glc.classList.remove('on'); P.glUse = false; } return; }
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(box.w * dpr), h = Math.round(box.h * dpr);
    const sc = Math.min(1, 1920 / Math.max(w, h));
    // Erst prüfen, dann die Größe setzen: eine neue Größe leert den Canvas (schwarz), und ohne Bild bliebe er leer stehen
    if (!ready) return;
    GL.size(w * sc, h * sc);
    const ok = GL.render({ A, B: tr ? B : null, ra: cropN(cA, A), rb: cB ? cropN(cB, B) : null, tr, look: look ? { id: S.look, k: S.lookK } : null, fade });
    if (!ok) { glc.classList.remove('on'); P.glUse = false; return; }
    // Wächter: WebGL-Bild gegen das Video-Element prüfen, bevor es gezeigt wird (erstes Bild), danach etwa jede Sekunde.
    // Einfarbig (schwarz, lila), obwohl das Video Bild hat → WebGL für diese Clips aus, Look und Übergang per CSS.
    P.glN = (P.glN || 0) + 1;
    if ((!P.glUse || P.glN % 40 === 0) && !(fade > .5) && A.readyState >= 2) {
      const l = GL.luma(), T = window.FCS_STUDIO_TEST || {};
      if (!nb(l) || (T.black || []).includes('gl')) {
        const k = k24(); k.fillStyle = '#000'; k.fillRect(0, 0, 24, 24);
        let srcOk = false; try { k.drawImage(A, 0, 0, 24, 24); srcOk = nb(lum24(k)); } catch (e) {}
        if (srcOk || (cA && cA.ref === true)) { glFail([cA, cB], 'Vorschau'); paint(A, B, cA, cB, tr, fade); return; }
      }
    }
    glc.classList.add('on'); P.glUse = true;
  }
  /* WebGL liefert eine leere Fläche: für die betroffenen Clips abschalten (Vorschau und Export nehmen den 2D-Weg) */
  function glFail(cs, wo) {
    cs.forEach(c => { if (c) c.glBad = true; });
    glc.classList.remove('on'); P.glUse = false;
    console.info(`Clip-Studio: WebGL liefert eine leere Fläche (${wo}), Look und Übergänge laufen über den 2D-Weg.`);
  }
  /* WebGL-Kontext verloren (Handy spart Speicher): frischen Canvas anlegen und neu aufbauen, nach dem zweiten Mal 2D-Weg */
  let glLosses = 0;
  function glLost() {
    glLosses++; GL = null; P.glUse = false;
    const n = glc.cloneNode(false); n.classList.remove('on'); glc.replaceWith(n); glc = n;
    console.info('Clip-Studio: WebGL-Kontext verloren', glLosses < 3 ? '→ wird neu aufgebaut' : '→ 2D-Weg');
    if (glLosses >= 3) { glOff = true; return; }
    needGL.tried = false; setTimeout(() => { needGL(); seekView(); }, 300);
  }
  /* Vorab-Test auf dem echten Weg: echtes Videobild des Clips durch WebGL schicken (mit Look und mit Übergang) und prüfen.
     Läuft auf einem kleinen eigenen Canvas, sobald das Video ein Bild hat, also vor dem ersten Look oder Übergang. */
  let GLP = null;
  function glProbe(c, v) {
    if (c.glProbed || c.glBad || glOff || !GLM || !v || v.readyState < 2 || v.seeking || v.currentTime < .3) return;
    const k = k24(); k.fillStyle = '#000'; k.fillRect(0, 0, 24, 24);
    try { k.drawImage(v, 0, 0, 24, 24); } catch (e) { return; }
    if (!nb(lum24(k))) return; // Video zeigt gerade selbst kein Bild (zum Beispiel schwarzer Anfang): später noch einmal
    c.glProbed = true;
    if (!GLP) { const pc = document.createElement('canvas'); pc.width = 96; pc.height = 54; GLP = GLM.compositor(pc); if (!GLP.ok) { GLP = null; glOff = true; return; } }
    const T = window.FCS_STUDIO_TEST || {};
    const tests = [{ look: { id: 'warm', k: 1 } }, { B: v, tr: { type: 'blende', p: .5, seed: 1 } }];
    for (const t of tests) {
      let l = null; try { GLP.render({ A: v, B: t.B || null, ra: [0, 0, 1, 1], rb: t.B ? [0, 0, 1, 1] : null, tr: t.tr || null, look: t.look || null, fade: 0 }); l = GLP.luma(); } catch (e) {}
      if (!l || GLP.lost || !nb(l) || (T.black || []).includes('gl')) { glFail([c], 'Vorab-Test'); if (GLP.lost) GLP = null; return; }
    }
  }
  function tick(mode, t) {
    const ph = $('#tl-ph'), tm = $('#st-time');
    const c = curClip();
    if (mode === 'clip' && c) {
      const d = c.dur || 1; if (ph) { ph.hidden = false; ph.style.left = (clamp((c.el && c.el.currentTime || 0) / d, 0, 1) * 100) + '%'; }
      const [lo, hi] = clipRange(c);
      if (tm) tm.textContent = tS(t) + ' / ' + tS(hi - lo);
    } else if (S.seq) {
      if (tm) tm.textContent = tS(t) + ' / ' + tS(S.seq.total);
      const sp = $('#sb-ph'); if (sp && S.seq.total) sp.style.left = (clamp(t / S.seq.total, 0, 1) * 100) + '%';
      $$('#sb-row .sb-sc').forEach((el, i) => { const s = S.seq.segs[i]; el.classList.toggle('now', !!s && t >= s.at && t < s.at + s.len); });
    }
  }

  /* =====================================================================
     Overlay: Sticker, OSD, Bauchbinde (Vorschau und Export nutzen dieselben Funktionen)
     ===================================================================== */
  function overlay(c, W, H, t, preview) {
    if (preview) c.clearRect(0, 0, W, H);
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

  /* =====================================================================
     Bühne: Größe
     ===================================================================== */
  function layout() {
    if (!wrap) return;
    // Größe kommt aus dem CSS (max. 100 % Breite, max. Höhe in svh): kann die Seite nie verbreitern, bleibt ruhig,
    // wenn auf Android die Adressleiste ein- und ausfährt. Hier nur das Seitenverhältnis setzen und messen.
    stage.style.setProperty('--ar', String(S.aspect));
    const r = stage.getBoundingClientRect();
    const w = Math.max(60, r.width), h = Math.max(34, r.height || w / S.aspect);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (ovc.width !== cw || ovc.height !== ch) { ovc.width = cw; ovc.height = ch; }
    box = { w, h };
    S.st.forEach(place);
    seekView();
  }
  function setFmt(f, anim) {
    S.fmt = f;
    const r = $(`input[name=st-fmt][value="${f}"]`); if (r) r.checked = true;
    const A = fmtA(f);
    const fl = $('#st-fmt'); if (fl) fl.textContent = f === 'orig' ? 'ORIGINAL' : f;
    if (gs()) gs().killTweensOf(S, 'aspect');
    if (anim && gs() && !RM && Math.abs(S.aspect - A) > .01) gs().to(S, { aspect: A, duration: .8, ease: 'expo.inOut', onUpdate: layout, onComplete: () => { layout(); panUI(); if (window.ScrollTrigger) ScrollTrigger.refresh(); } });
    else { S.aspect = A; layout(); }
    panUI(); sumLine(); S.result = null;
  }
  function panAxis(c) {
    c = c || P.cur || curClip(); if (!c || !c.w) return null;
    const sa = (c.ew || c.w) / (c.eh || c.h), A = S.aspect;
    return sa > A + .01 ? 'x' : sa < A - .01 ? 'y' : null;
  }
  function panUI() {
    const c = curClip(), ax = panAxis(c), row = $('#pan-row'), r = $('#pan');
    if (row) row.hidden = !ax;
    if (stage) { stage.classList.toggle('pan-x', ax === 'x'); stage.classList.toggle('pan-y', ax === 'y'); stage.style.touchAction = ax === 'x' ? 'pan-y' : ax === 'y' ? 'pan-x' : 'pan-x pan-y'; }
    if (!ax || !r || !c) return;
    const v = ax === 'x' ? c.pan.x : c.pan.y;
    $('#pan-lbl').textContent = ax === 'x' ? 'Ausschnitt ↔' : 'Ausschnitt ↕';
    r.value = Math.round(v * 100); fill(r);
    $('#pan-o').textContent = v < .4 ? (ax === 'x' ? 'Links' : 'Oben') : v > .6 ? (ax === 'x' ? 'Rechts' : 'Unten') : 'Mitte';
  }
  function fill(r) { if (r) r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }

  /* =====================================================================
     Zeitleiste (ausgewählter Clip): Zuschneiden oder coole Stellen
     ===================================================================== */
  function tlDraw() {
    const c = curClip(), A = $('#tl-a'), B = $('#tl-b'); if (!A || !B) return;
    const trim = $('#st-trim'); if (trim) trim.hidden = !c || !c.dur || playMode() !== 'clip';
    if (!c || !c.dur) return;
    const auto = S.mode === 'auto' && (isMember() || S.demo);
    $('#tl').classList.toggle('marks', auto);
    const d = c.dur, pa = c.a / d * 100, pb = (c.b || d) / d * 100;
    A.hidden = B.hidden = auto; $('#tl-win').hidden = auto; $('#tl-sl').hidden = $('#tl-sr').hidden = auto;
    A.style.left = pa + '%'; B.style.left = pb + '%';
    $('#tl-win').style.left = pa + '%'; $('#tl-win').style.width = (pb - pa) + '%';
    $('#tl-sl').style.width = pa + '%'; $('#tl-sr').style.width = (100 - pb) + '%';
    $('#tl-ra').textContent = tD(c.a); $('#tl-rb').textContent = tD(c.b || d); $('#tl-rl').textContent = sec((c.b || d) - c.a);
    [[A, c.a], [B, c.b || d]].forEach(([el, v]) => { el.setAttribute('aria-valuemax', d.toFixed(1)); el.setAttribute('aria-valuenow', v.toFixed(1)); el.setAttribute('aria-valuetext', (Math.round(v * 10) / 10).toLocaleString('de-DE') + ' Sekunden'); });
    $('#tl-read').hidden = auto; $$('.tl-fine').forEach(x => x.hidden = auto);
    const long = $('#tl-long'); if (long) long.hidden = auto || !(d > MAXLEN);
    const mk = $('#tl-marks');
    if (mk) mk.innerHTML = auto ? c.marks.map(m => `<div class="tl-mk" data-mk="${m.id}" style="left:${m.t0 / d * 100}%;width:${m.len / d * 100}%" role="button" tabindex="0" aria-label="Stelle bei ${tD(m.t0)}, ${sec(m.len)} lang. Pfeiltasten verschieben, Entf löscht."><i>${ICON.star}</i><span class="tl-mk-x" aria-hidden="true">×</span></div>`).join('') : '';
    const hint = $('#tl-hint'); if (hint) hint.innerHTML = auto ? 'Tipp bei jeder coolen Stelle auf <b>★ Stelle</b>. Die Kästchen kannst du verschieben, × löscht.' : 'Zuschneiden: Zieh die gelben Griffe oder das ganze Fenster.';
    sumLine();
  }
  function timeline() {
    const tl = $('#tl'), A = $('#tl-a'), B = $('#tl-b'), W = $('#tl-win'); if (!tl || !A || !B || !W) return;
    const tAt = x => { const c = curClip(), r = tl.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * (c ? c.dur : 0); };
    const setA = (c, v) => { c.a = clamp(v, 0, (c.b || c.dur) - MINLEN); if ((c.b || c.dur) - c.a > MAXLEN) c.b = c.a + MAXLEN; };
    const setB = (c, v) => { c.b = clamp(v, c.a + MINLEN, c.dur); if (c.b - c.a > MAXLEN) c.a = c.b - MAXLEN; };
    let drag = null;
    tl.addEventListener('pointerdown', e => {
      const c = curClip(); if (!c || !c.dur || S.busy || (e.pointerType === 'mouse' && e.button)) return;
      interact(); e.preventDefault(); try { tl.setPointerCapture(e.pointerId); } catch (er) {}
      const t = tAt(e.clientX), mk = e.target.closest('.tl-mk');
      if (e.target.closest('.tl-mk-x')) { const m = c.marks.find(x => x.id === mk.dataset.mk); c.marks = c.marks.filter(x => x !== m); tlDraw(); renderClips(); rebuild(); return; }
      if (mk) { const m = c.marks.find(x => x.id === mk.dataset.mk); drag = { k: 'mk', m, t0: t, s0: m.t0 }; c.el.currentTime = m.t0; }
      else if (e.target.closest('.tl-a')) drag = { k: 'a' };
      else if (e.target.closest('.tl-b')) drag = { k: 'b' };
      else if (e.target === W) drag = { k: 'w', t0: t, a0: c.a, b0: c.b || c.dur };
      else { drag = { k: 'seek' }; c.el.currentTime = t; }
      pause();
    });
    tl.addEventListener('pointermove', e => {
      if (!drag) return; const c = curClip(); if (!c) return;
      const t = tAt(e.clientX);
      if (drag.k === 'a') { setA(c, t); c.el.currentTime = c.a; }
      else if (drag.k === 'b') { setB(c, t); c.el.currentTime = c.b; }
      else if (drag.k === 'w') { const len = drag.b0 - drag.a0; c.a = clamp(drag.a0 + t - drag.t0, 0, c.dur - len); c.b = c.a + len; c.el.currentTime = c.a; }
      else if (drag.k === 'mk') { drag.m.t0 = clamp(drag.s0 + t - drag.t0, 0, Math.max(0, c.dur - drag.m.len)); c.el.currentTime = drag.m.t0; }
      else c.el.currentTime = t;
      tlDraw(); seekView();
    });
    const up = () => { if (!drag) return; const k = drag.k; drag = null; tlDraw(); if (k !== 'seek') rebuild(); };
    tl.addEventListener('pointerup', up); tl.addEventListener('pointercancel', up);
    [[A, 'a'], [B, 'b']].forEach(([el, k]) => el.addEventListener('keydown', e => {
      const c = curClip(); if (!c || !c.dur) return;
      const st = e.shiftKey ? 1 : .1; let v = k === 'a' ? c.a : (c.b || c.dur);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= st; else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += st;
      else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = c.dur; else return;
      e.preventDefault(); k === 'a' ? setA(c, v) : setB(c, v); pause(); c.el.currentTime = k === 'a' ? c.a : c.b; tlDraw(); rebuild(); seekView();
    }));
    $('#tl-marks') && $('#tl-marks').addEventListener('keydown', e => {
      const el = e.target.closest('.tl-mk'); const c = curClip(); if (!el || !c) return;
      const m = c.marks.find(x => x.id === el.dataset.mk); if (!m) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { c.marks = c.marks.filter(x => x !== m); e.preventDefault(); tlDraw(); renderClips(); rebuild(); markUI(); return; }
      const st = e.shiftKey ? 1 : .2;
      if (e.key === 'ArrowLeft') m.t0 = clamp(m.t0 - st, 0, c.dur - m.len); else if (e.key === 'ArrowRight') m.t0 = clamp(m.t0 + st, 0, c.dur - m.len); else return;
      e.preventDefault(); c.el.currentTime = m.t0; tlDraw(); rebuild(); seekView();
      const again = $(`.tl-mk[data-mk="${m.id}"]`); if (again) again.focus();
    });
    // Feinschritte (Knöpfe, gut für Daumen und genaue Arbeit)
    $$('[data-fine]').forEach(b => b.addEventListener('click', () => {
      const c = curClip(); if (!c || !c.dur || S.busy) return; interact();
      const k = b.dataset.fine, cur = c.el ? c.el.currentTime : 0;
      if (k === 'a-') setA(c, c.a - .1); else if (k === 'a+') setA(c, c.a + .1); else if (k === 'a=') setA(c, cur);
      else if (k === 'b-') setB(c, (c.b || c.dur) - .1); else if (k === 'b+') setB(c, (c.b || c.dur) + .1); else if (k === 'b=') setB(c, cur);
      pause(); if (c.el) c.el.currentTime = k[0] === 'a' ? c.a : c.b; tlDraw(); rebuild(); seekView();
    }));
  }

  /* ---------- Coole Stellen (Auto-Schnitt) ---------- */
  function addMark() {
    const c = curClip(); if (!c || !c.dur || S.busy) return;
    if (!isMember() && !S.demo) { lockHit('auto'); return; }
    interact();
    const t = c.el ? c.el.currentTime : 0, L = Math.min(S.sceneLen, c.dur);
    const t0 = clamp(t - L * .3, 0, Math.max(0, c.dur - L));
    const hit = c.marks.find(m => Math.abs(m.t0 - t0) < L * .5);
    if (hit) { flash($(`.tl-mk[data-mk="${hit.id}"]`)); return; }
    c.marks.push({ id: 'm' + (++S.uid), t0, len: L });
    tlDraw(); renderClips(); rebuild(); markUI();
    const b = $('#st-mark'); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    S.viewSeq = false;
  }
  function markUI() {
    const n = marksAll().length, info = $('#mk-n'), go2 = $('#cut-go');
    if (info) info.textContent = n ? `${n} ${n === 1 ? 'Stelle' : 'Stellen'} markiert` + (S.seq && S.seq.style ? ` · Schnitt: ${S.seq.segs.length} Szenen, ${tS(S.seq.total)}` : '') : 'Noch keine Stelle markiert';
    if (go2) go2.disabled = !n;
    const mb = $('#st-mark'); if (mb) mb.hidden = !(S.mode === 'auto' && S.step === 2 && playMode() === 'clip');
    const chips = $('#mk-chips');
    if (chips) chips.innerHTML = S.clips.length > 1 ? S.clips.map((c, i) => `<button type="button" class="chip-b${i === S.sel ? ' on' : ''}" data-ci="${i}" aria-pressed="${i === S.sel}">Clip ${i + 1}<small>${c.marks.length} ★</small></button>`).join('') : '';
    const ed = $('#cut-edit'); if (ed) ed.hidden = !(S.viewSeq && playMode() === 'seq');
  }
  function autoUI() {
    $$('input[name=st-mode]').forEach(r => r.addEventListener('change', () => {
      if (r.value === 'auto' && !isMember() && !S.demo) { const t = $('input[name=st-mode][value=trim]'); if (t) t.checked = true; lockHit('auto'); return; }
      interact(); S.mode = r.value; S.viewSeq = false; modeUI(); rebuild(); tlDraw(); renderClips(); seekView();
    }));
    const mk = $('#mk-add'); if (mk) mk.addEventListener('click', addMark);
    const sm = $('#st-mark'); if (sm) sm.addEventListener('click', addMark);
    const len = $('#mk-len'); if (len) len.addEventListener('input', () => {
      S.sceneLen = +len.value; $('#mk-len-o').textContent = sec(S.sceneLen); fill(len);
      S.clips.forEach(c => c.marks.forEach(m => { const mid = m.t0 + m.len / 2; m.len = Math.min(S.sceneLen, c.dur); m.t0 = clamp(mid - m.len / 2, 0, Math.max(0, c.dur - m.len)); }));
      tlDraw(); rebuild();
    });
    $$('input[name=st-style]').forEach(r => r.addEventListener('change', () => {
      interact(); S.style = r.value; S.trOv = {};
      if (!S.lookTouched) setLook(STYLES[S.style].look, true);
      rebuild(); if (S.viewSeq) { P.t = 0; play(); }
    }));
    const cg = $('#cut-go'); if (cg) cg.addEventListener('click', () => {
      if (!marksAll().length) return; interact();
      if (!S.lookTouched) setLook(STYLES[S.style].look, true);
      S.viewSeq = true; rebuild(); modeUI(); P.t = 0; tlDraw(); play(); visit(2);
      if (!inView(stage)) go(wrap, -110);
      flash($('#st-sb'));
    });
    const ce = $('#cut-edit'); if (ce) ce.addEventListener('click', () => { S.viewSeq = false; modeUI(); tlDraw(); pause(); markUI(); });
    const ch = $('#mk-chips'); if (ch) ch.addEventListener('click', e => { const b = e.target.closest('[data-ci]'); if (!b) return; S.viewSeq = false; select(+b.dataset.ci); modeUI(); });
    const fe = $('#fade-end'); if (fe) fe.addEventListener('change', () => { S.fadeEnd = fe.checked; rebuild(); });
  }
  function modeUI() {
    const auto = S.mode === 'auto';
    const r = $(`input[name=st-mode][value="${S.mode}"]`); if (r) r.checked = true;
    const pt = $('#p2-trim'), pa = $('#p2-auto'); if (pt) pt.hidden = auto; if (pa) pa.hidden = !auto;
    const sb = $('#st-sb'); if (sb) sb.hidden = !(S.seq && (S.seq.segs.length > 1 || S.seq.style) && playMode() === 'seq');
    markUI(); tlDraw();
  }

  /* ---------- Storyboard: Szenen und Übergänge (jeder Übergang antippbar) ---------- */
  function sbDraw() {
    const row = $('#sb-row'), sb = $('#st-sb'); if (!row || !sb) return;
    const seq = S.seq; const show = !!(seq && (seq.segs.length > 1 || seq.style) && playMode() === 'seq');
    sb.hidden = !show; if (!show) return;
    const T = window.__fcsTrans || {};
    row.innerHTML = seq.segs.map((s, i) => `${i > 0 ? `<button type="button" class="sb-tr${s.tr !== 'schnitt' ? ' fx' : ''}" data-i="${i}" aria-haspopup="menu" aria-label="Übergang ${i}: ${esc((T[s.tr] || {}).n || s.tr)}. Antippen zum Ändern">${trIcon(s.tr)}<span>${esc((T[s.tr] || {}).n || s.tr)}</span></button>` : ''}<button type="button" class="sb-sc" data-i="${i}" style="flex-grow:${Math.max(.6, s.len).toFixed(2)}" aria-label="Szene ${i + 1}, ${sec(s.len)}${s.kind === 'slow' ? ', Zeitlupe' : s.kind === 'ramp' ? ', Tempo-Rampe' : ''}"><canvas width="80" height="45" data-sb="${i}"></canvas><span>${sec(s.len)}${s.kind === 'slow' ? ' · Zeitlupe' : s.kind === 'ramp' ? ' · Tempo' : ''}</span></button>`).join('') + '<div class="sb-ph" id="sb-ph" aria-hidden="true"></div>';
    $$('canvas[data-sb]', row).forEach(cv => { const s = seq.segs[+cv.dataset.sb]; const c = s && s.c; if (!c) return; const idx = c.thumbs.length ? clamp(Math.floor((s.a + s.len / 2) / c.dur * c.thumbs.length), 0, c.thumbs.length - 1) : -1; const t = idx >= 0 ? c.thumbs[idx] : null; if (t) { try { cv.getContext('2d').drawImage(t, 0, 0, 80, 45); } catch (e) {} } });
    const info = $('#sb-info'); if (info) info.textContent = `${seq.segs.length} ${seq.segs.length === 1 ? 'Szene' : 'Szenen'} · ${tS(seq.total)}${S.music && S.music.bpm ? ` · im Takt (${Math.round(S.music.bpm)} BPM)` : ''}`;
  }
  function trIcon(t) {
    const p = { schnitt: '<path d="M12 3v18"/>', blende: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>', blitz: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', zoom: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>', wisch: '<path d="M4 20 20 4M4 13l9-9M11 20l9-9"/>', whip: '<path d="M3 12h13M12 7l5 5-5 5M3 8h6M3 16h6"/>', glitch: '<path d="M4 6h10M8 10h12M4 14h9M10 18h10"/>' }[t] || '';
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  }
  function sbUI() {
    const row = $('#sb-row'), menu = $('#sb-menu'); if (!row || !menu) return;
    const T = () => window.__fcsTrans || {};
    let cur = null;
    const close = () => { menu.hidden = true; if (cur) cur.setAttribute('aria-expanded', 'false'); cur = null; };
    row.addEventListener('click', e => {
      const sc = e.target.closest('.sb-sc');
      if (sc) { const s = S.seq.segs[+sc.dataset.i]; if (s) { P.t = s.at + .01; seekView(); if (!P.on) play(); } return; }
      const b = e.target.closest('.sb-tr'); if (!b) return;
      if (!isMember() && !S.demo) { lockHit('auto'); return; }
      interact();
      if (cur === b) { close(); return; }
      cur = b; b.setAttribute('aria-expanded', 'true');
      const i = +b.dataset.i, s = S.seq.segs[i];
      menu.innerHTML = Object.keys(T()).map(k => `<button type="button" role="menuitemradio" aria-checked="${s.tr === k}" data-tr="${k}">${trIcon(k)}<span>${esc(T()[k].n)}</span></button>`).join('');
      menu.dataset.i = i; menu.hidden = false;
      const rb = b.getBoundingClientRect(), rs = $('#st-sb').getBoundingClientRect();
      menu.style.left = clamp(rb.left - rs.left + rb.width / 2 - 120, 0, Math.max(0, rs.width - 240)) + 'px';
      const f = $('[aria-checked=true]', menu) || $('button', menu); if (f) f.focus({ preventScroll: true });
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('[data-tr]'); if (!b) return;
      const i = +menu.dataset.i, s = S.seq.segs[i]; if (!s) return;
      S.trOv[s.key] = b.dataset.tr; close(); rebuild();
      // Vorschau sofort: kurz vor dem Übergang abspielen
      const s2 = S.seq.segs[i]; P.t = Math.max(0, s2.at - .9); seekView(); play();
      const nb2 = $(`#sb-row .sb-tr[data-i="${i}"]`); if (nb2) nb2.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', e => {
      const items = $$('button', menu), k = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { const c = cur; close(); if (c) c.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(k + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[(k - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.sb-tr')) close(); });
  }

  /* =====================================================================
     Musik: eigene Datei, Takterkennung im Worker
     ===================================================================== */
  let beatW = null, beatId = 0;
  function beats(pcm, sr) {
    return new Promise((res, rej) => {
      if (!beatW) { try { beatW = new Worker(BASE + 'studio-beat.js' + VQ); } catch (e) { rej(e); return; } }
      const id = ++beatId, to = setTimeout(() => rej(new Error('Zeit abgelaufen')), 30000);
      const on = e => { if (e.data && e.data.id === id) { clearTimeout(to); beatW.removeEventListener('message', on); e.data.ok ? res(e.data) : rej(new Error(e.data.err)); } };
      beatW.addEventListener('message', on);
      beatW.onerror = e => { clearTimeout(to); rej(new Error(e.message || 'Worker')); };
      beatW.postMessage({ id, pcm, sr }, [pcm.buffer]);
    });
  }
  async function analyse(buf) {
    const n = buf.length, m = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) m[i] += d[i] / buf.numberOfChannels; }
    return beats(m, buf.sampleRate);
  }
  async function loadMusic(f, demo) {
    if (!f) return;
    if (!demo && !isMember()) { lockHit('musik'); return; }
    if (!demo && !isAudio(f)) { muErr('Das ist keine Audiodatei. Nimm MP3, M4A, AAC oder WAV.'); return; }
    interact(); muErr('');
    const box = $('#mu-box'), nm = $('#mu-name'), bpm = $('#mu-bpm');
    if (box) box.hidden = false; if (nm) nm.textContent = f.name || 'Musik'; if (bpm) bpm.textContent = 'Takt wird erkannt …';
    let buf;
    try {
      const ab = await f.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
      try { ac.close(); } catch (e) {}
    } catch (e) {
      if (box) box.hidden = !S.music;
      muErr(`Diese Datei kann dein Browser nicht abspielen (${esc(f.name)}). ${/\.(m4a|aac)$/i.test(f.name) ? 'M4A und AAC spielen Chrome, Edge und Safari ab, Firefox unter Linux nicht. ' : ''}Nimm sonst eine MP3- oder WAV-Datei.`);
      return;
    }
    if (S.music && S.music.url && !S.music.demo) URL.revokeObjectURL(S.music.url);
    if (S.music && S.music.el) { S.music.el.pause(); S.music.el.remove(); }
    const url = URL.createObjectURL(f);
    const el = document.createElement('audio'); el.preload = 'auto'; el.src = url; el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    S.music = { file: f, name: f.name || 'Musik', url, el, buf, dur: buf.duration, start: 0, vol: .9, fin: .5, fout: 1.5, bpm: 0, beats: [], str: [], down: 0, peaks: null, demo: !!demo };
    S.origVol = .2; const ov = $('#mu-orig'); if (ov) { ov.value = 20; fill(ov); $('#mu-orig-o').textContent = '20 %'; }
    S.sound = true; const mb = $('#st-mute'); if (mb) mb.setAttribute('aria-pressed', 'true');
    muSliders();
    try {
      const r = await analyse(buf);
      if (S.music && S.music.buf === buf) {
        Object.assign(S.music, { bpm: r.bpm, beats: Array.from(r.beats), str: Array.from(r.str || []), down: r.down, peaks: r.peaks });
        // Start auf den ersten Taktanfang (erster starker Bass)
        S.music.start = barStart(0);
      }
      if (bpm) bpm.textContent = r.bpm ? `${Math.round(r.bpm)} BPM · ${Math.floor(r.beats.length / 4)} Takte erkannt` : 'Kein klarer Takt erkannt, geschnitten wird im 120er-Raster';
    } catch (e) { if (bpm) bpm.textContent = 'Takterkennung ging nicht, geschnitten wird im 120er-Raster'; }
    waveDraw(); rebuild(); visit(3); steps();
    if (playMode() === 'seq') { P.t = 0; play(); }
  }
  function barStart(t) {
    const m = S.music; if (!m || !m.beats.length) return t;
    const B = m.beats; let best = 0, bd = 1e9;
    for (let i = ((m.down % 4) + 4) % 4; i < B.length; i += 4) { const d = Math.abs(B[i] - t); if (d < bd) { bd = d; best = B[i]; } }
    return best;
  }
  function muErr(t) { const e = $('#mu-err'); if (e) { e.textContent = t; e.hidden = !t; } }
  function muSliders() {
    const m = S.music; if (!m) return;
    [['#mu-vol', m.vol * 100, '%'], ['#mu-orig', S.origVol * 100, '%'], ['#mu-fin', m.fin * 10, 's'], ['#mu-fout', m.fout * 10, 's']].forEach(([s, v, u]) => { const r = $(s); if (!r) return; r.value = Math.round(v); fill(r); const o = $(s + '-o'); if (o) o.textContent = u === '%' ? Math.round(v) + ' %' : sec(v / 10); });
  }
  function waveDraw() {
    const cv = $('#mu-wave'), m = S.music; if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(cv.clientWidth * dpr) || 600, H = Math.round(cv.clientHeight * dpr) || 120;
    cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
    if (!m || !m.dur) return;
    const dur = m.dur, sx = t => t / dur * W;
    const total = S.seq ? S.seq.total : 0, g = grid();
    // Bereich, der im Video läuft
    const s0 = (g && g.music ? g.t0 : m.start), s1 = s0 + total;
    x.fillStyle = 'rgba(63,224,255,.12)'; x.fillRect(sx(s0), 0, Math.max(2, sx(Math.min(dur, s1)) - sx(s0)), H);
    if (m.peaks) {
      const P2 = m.peaks, cols = P2.length / 2;
      for (let i = 0; i < cols; i++) {
        const X = i / cols * W, mn = P2[i * 2], mx = P2[i * 2 + 1], t = i / cols * dur;
        x.fillStyle = t >= s0 && t <= s1 ? '#bfefff' : 'rgba(157,177,204,.55)';
        x.fillRect(X, H / 2 - mx * H * .46, Math.max(1, W / cols), Math.max(1, (mx - mn) * H * .46));
      }
    }
    // Takt-Raster: Taktanfänge hell, Bass-Stärke als Höhe
    m.beats.forEach((b, i) => {
      const bar = ((i - m.down) % 4 + 4) % 4 === 0, st = m.str[i] || .4;
      x.fillStyle = bar ? 'rgba(255,176,32,.95)' : 'rgba(255,255,255,.28)';
      const h = bar ? H : H * (.2 + .35 * st);
      x.fillRect(Math.round(sx(b)), bar ? 0 : H - h, bar ? Math.max(1, dpr * 1.2) : Math.max(1, dpr * .8), h);
    });
    // Schnittpunkte des Videos
    if (S.seq && g && g.music) { x.fillStyle = '#3fe0ff'; S.seq.segs.forEach((s, i) => { if (!i) return; x.fillRect(Math.round(sx(s0 + s.at)) - dpr, 0, 2 * dpr, H * .3); }); }
    x.strokeStyle = SIG; x.lineWidth = 2 * dpr; x.strokeRect(sx(s0) + dpr, dpr, Math.max(2, sx(Math.min(dur, s1)) - sx(s0)) - 2 * dpr, H - 2 * dpr);
    const so = $('#mu-start-o'); if (so) so.textContent = tD(s0);
  }
  function musicUI() {
    const inp = $('#mu-file');
    $$('[data-mu-pick]').forEach(b => b.addEventListener('click', () => { if (!isMember()) { lockHit('musik'); return; } if (inp) inp.click(); }));
    if (inp) inp.addEventListener('change', () => { if (inp.files[0]) loadMusic(inp.files[0]); inp.value = ''; });
    const bind = (id, fn, u) => { const r = $(id); if (!r) return; r.addEventListener('input', () => { fn(+r.value); fill(r); const o = $(id + '-o'); if (o) o.textContent = u === '%' ? r.value + ' %' : sec(r.value / 10); }); };
    bind('#mu-vol', v => { if (S.music) S.music.vol = v / 100; S.result = null; }, '%');
    bind('#mu-orig', v => { S.origVol = v / 100; S.result = null; }, '%');
    bind('#mu-fin', v => { if (S.music) S.music.fin = v / 10; S.result = null; }, 's');
    bind('#mu-fout', v => { if (S.music) S.music.fout = v / 10; S.result = null; }, 's');
    const del = $('#mu-del'); if (del) del.addEventListener('click', () => { if (S.music) { S.music.el.pause(); S.music.el.remove(); if (!S.music.demo) URL.revokeObjectURL(S.music.url); } S.music = null; S.origVol = 1; $('#mu-box').hidden = true; rebuild(); });
    const shift = k => { const m = S.music; if (!m || !m.beats.length) return; const B = m.beats, p = 60 / (m.bpm || 120); m.start = clamp(barStart(m.start + k * 4 * p), 0, Math.max(0, m.dur - 1)); rebuild(); waveDraw(); P.t = 0; if (playMode() === 'seq') play(); };
    const pb = $('#mu-prev'), nx = $('#mu-next'), fb = $('#mu-first');
    if (pb) pb.addEventListener('click', () => shift(-1)); if (nx) nx.addEventListener('click', () => shift(1));
    if (fb) fb.addEventListener('click', () => { const m = S.music; if (!m) return; m.start = barStart(0); rebuild(); waveDraw(); });
    // Startpunkt per Ziehen/Tippen auf der Wellenform (rastet auf Taktanfänge ein)
    const cv = $('#mu-wave');
    if (cv) {
      let dr = null;
      const tAt = x => { const r = cv.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * (S.music ? S.music.dur : 0); };
      cv.addEventListener('pointerdown', e => { if (!S.music) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {} dr = { x: e.clientX, s: S.music.start }; });
      cv.addEventListener('pointermove', e => { if (!dr || !S.music) return; const m = S.music; const dt = tAt(e.clientX) - tAt(dr.x); m.start = clamp(dr.s + dt, 0, Math.max(0, m.dur - 1)); waveDraw(); });
      const up = e => { if (!dr || !S.music) return; const moved = Math.abs(e.clientX - dr.x) > 4; if (!moved) S.music.start = tAt(e.clientX); S.music.start = barStart(S.music.start); dr = null; rebuild(); waveDraw(); P.t = 0; if (playMode() === 'seq') play(); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { dr = null; });
      cv.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { shift(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { shift(-1); e.preventDefault(); } });
    }
  }
  /* Demo-Beat (im Browser erzeugt, keine fremde Musik): 124 BPM, Kick, Clap, Hi-Hat, Bass */
  async function demoBeat() {
    const sr = 44100, bpm = 124, p = 60 / bpm, dur = 32, ctx = new OfflineAudioContext(2, sr * dur, sr);
    const noise = ctx.createBuffer(1, sr, sr); const nd = noise.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
    const notes = [55, 55, 65.4, 49];
    for (let b = 0, t = .25; t < dur - .5; b++, t = .25 + b * p) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
      g.gain.setValueAtTime(b % 4 === 0 ? 1 : .8, t); g.gain.exponentialRampToValueAtTime(.001, t + .38); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .4);
      if (b % 2 === 1) { const n = ctx.createBufferSource(); n.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g2 = ctx.createGain(); g2.gain.setValueAtTime(.5, t); g2.gain.exponentialRampToValueAtTime(.001, t + .16); n.connect(f).connect(g2).connect(ctx.destination); n.start(t, Math.random() * .5, .2); }
      const h = ctx.createBufferSource(); h.buffer = noise; const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000; const hg = ctx.createGain(); hg.gain.setValueAtTime(.18, t + p / 2); hg.gain.exponentialRampToValueAtTime(.001, t + p / 2 + .05); h.connect(hf).connect(hg).connect(ctx.destination); h.start(t + p / 2, Math.random() * .5, .06);
      const bs = ctx.createOscillator(), bg = ctx.createGain(); bs.type = 'sawtooth'; bs.frequency.value = notes[Math.floor(b / 8) % 4]; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      bg.gain.setValueAtTime(.0001, t); bg.gain.exponentialRampToValueAtTime(.16, t + .02); bg.gain.exponentialRampToValueAtTime(.001, t + p * .9); bs.connect(lp).connect(bg).connect(ctx.destination); bs.start(t); bs.stop(t + p);
    }
    const buf = await ctx.startRendering();
    // als WAV-Datei, damit das Audio-Element sie abspielt
    const n = buf.length, ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(L[i]));
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, clamp(L[i] / mx, -1, 1) * 30000, true); dv.setInt16(46 + i * 4, clamp(R[i] / mx, -1, 1) * 30000, true); }
    return new File([ab], 'Demo-Beat (im Browser erzeugt).wav', { type: 'audio/wav' });
  }

  /* =====================================================================
     Look (Farbstimmung) und Format
     ===================================================================== */
  function setLook(id, auto) {
    S.look = id; if (!auto) S.lookTouched = true;
    const r = $(`input[name=st-look][value="${id}"]`); if (r) r.checked = true;
    const k = $('#look-k-row'); if (k) k.hidden = id === 'natur';
    S.result = null; sumLine(); seekView();
  }
  function lookUI() {
    $$('input[name=st-look]').forEach(r => r.addEventListener('change', () => { interact(); setLook(r.value); visit(4); }));
    const k = $('#look-k'); if (k) k.addEventListener('input', () => { S.lookK = k.value / 100; $('#look-k-o').textContent = k.value + ' %'; fill(k); S.result = null; seekView(); });
    $$('input[name=st-fmt]').forEach(r => r.addEventListener('change', () => { interact(); S.clips.forEach(c => { c.pan = { x: .5, y: .5 }; }); setFmt(r.value, true); }));
    const pan = $('#pan'); if (pan) pan.addEventListener('input', () => { const c = curClip(), ax = panAxis(c); if (!c) return; if (ax === 'x') c.pan.x = pan.value / 100; else if (ax === 'y') c.pan.y = pan.value / 100; panUI(); seekView(); S.result = null; });
    $$('input[name=st-q]').forEach(r => r.addEventListener('change', () => { S.q = r.value; sumLine(); S.result = null; }));
  }

  /* =====================================================================
     Sticker
     ===================================================================== */
  function loadImgs() {
    STICKER.forEach(d => {
      if (d.dyn) { IMG[d.k] = { el: document.createElement('canvas'), ok: false, ar: .3 }; return; }
      const el = new Image(); el.decoding = 'async';
      const o = IMG[d.k] = { el, ok: false, ar: 1 };
      el.onload = () => { o.ok = true; o.ar = (el.naturalHeight || 1) / (el.naturalWidth || 1); S.st.filter(s => s.k === d.k).forEach(place); };
      el.onerror = () => { o.ok = false; const b = trayBtn(d.k); if (b) b.remove(); S.st.filter(s => s.k === d.k).forEach(removeSt); };
      el.src = d.src;
    });
  }
  let trays = [];
  const trayBtn = k => { for (const t of trays) { const b = t.querySelector(`[data-k="${k}"]`); if (b) return b; } return null; };
  const userStickers = () => S.st.filter(s => !s.demo).length + (S.osd && !S.osdDemo ? 1 : 0);
  function buildTray() {
    const top = $('#tray-top'), more = $('#tray');
    trays = [top, more].filter(Boolean);
    const btn = d => `<button type="button" data-k="${d.k}"${d.typ === 'osd' ? ' aria-pressed="false"' : ''} aria-label="${d.typ === 'osd' ? 'OSD-Rahmen ein- oder ausschalten' : esc(d.n) + ' aufs Video legen'}" title="${esc(d.n)}"><img src="${d.src}" alt="" draggable="false"><span>${esc(d.n)}</span></button>`;
    const list = STICKER.filter(d => !d.dyn);
    if (top) top.innerHTML = list.filter(d => d.top).map(btn).join('');
    if (more) more.innerHTML = list.filter(d => !d.top || !top).map(btn).join('');
    trays.forEach(tray => {
      $$('img', tray).forEach(im => im.addEventListener('error', () => { const b = im.closest('button'); if (b) b.remove(); }));
      tray.addEventListener('click', e => {
        const b = e.target.closest('button[data-k]'); if (!b || S.busy) return;
        if (b._dragged) { b._dragged = false; return; }
        interact();
        const d = def(b.dataset.k);
        if (d.typ === 'osd') { S.osdDemo = false; setOSD(!S.osd); visit(4); return; }
        const n = S.st.length, off = (n % 5 - 2) * .06;
        const s = flyIn(d.k, .5 + off, .5 + off * .6, 0);
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        hideHint(); visit(4);
        if (s && s.h && e.detail === 0) setTimeout(() => s.h.focus(), 50);
        if (!inView(stage) && innerWidth <= 1040) go(wrap, -110);
      });
    });
    if (!FINE) {
      const help = $('#st-help-tray'); if (help) help.textContent = 'Tipp ein Logo an, es landet auf dem Video. Dort verschiebst du es mit dem Finger, mit zwei Fingern drehst und vergrößerst du es.';
      const ht = $('#st-hint-t'); if (ht) ht.textContent = 'Tipp ein Logo an';
    }
  }
  function setOSD(on) { S.osd = on; const b = trayBtn('osd'); if (b) b.setAttribute('aria-pressed', on); sumLine(); steps(); seekView(); S.result = null; }
  function trayDrag() {
    const over = ev => { const r = stage.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
    trays.forEach(tray => tray.addEventListener('pointerdown', e => {
      const b = e.target.closest('button[data-k]'); if (!b || e.button || S.busy || e.pointerType === 'touch') return;
      const d = def(b.dataset.k); if (d.typ === 'osd') return;
      const st = { x: e.clientX, y: e.clientY, g: null };
      const mv = ev => {
        if (!st.g && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 8) { interact(); st.g = document.createElement('div'); st.g.className = 'dragghost'; st.g.innerHTML = `<img src="${d.src}" alt="">`; document.body.appendChild(st.g); }
        if (st.g) { st.g.style.transform = `translate(${ev.clientX}px,${ev.clientY}px)`; wrap.classList.toggle('target', over(ev)); }
      };
      const up = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        wrap.classList.remove('target');
        if (!st.g) return;
        st.g.remove(); b._dragged = true; setTimeout(() => { b._dragged = false; }, 0);
        if (over(ev)) { const r = stage.getBoundingClientRect(); const s = addSt(d.k, clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); pulse(s); hideHint(); visit(4); }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    }));
  }
  function addSt(k, x = .5, y = .5, o = {}) {
    const d = def(k), im = IMG[k]; if (!d || !im) return null;
    let w = o.w || d.w; const ar = im.ar || 1;
    if (box.w && w * box.w * ar > box.h * .9) w = box.h * .9 / (box.w * ar);
    const s = { id: ++S.sid, k, x, y, w, r: o.r || 0, a: o.a == null ? 1 : o.a, demo: !!o.demo };
    S.st.push(s); mkHandle(s); selectSt(o.demo ? null : s.id); sumLine(); steps(); S.result = null;
    return s;
  }
  function mkHandle(s) {
    const d = def(s.k), h = document.createElement('div');
    h.className = 'stk'; h.tabIndex = 0; h.dataset.id = s.id; h.setAttribute('role', 'button');
    h.setAttribute('aria-label', `${d.n} auf dem Video. Pfeiltasten verschieben, Plus und Minus ändern die Größe, Q und E drehen, Entf löscht.`);
    h.innerHTML = '<span class="stk-k stk-rot" aria-hidden="true"></span><span class="stk-k stk-sc" aria-hidden="true"></span><span class="stk-k stk-x" aria-hidden="true">×</span>';
    h.querySelector('.stk-x').addEventListener('click', e => { e.stopPropagation(); removeSt(s); });
    h.addEventListener('focus', () => selectSt(s.id));
    layer.appendChild(h); s.h = h; place(s);
  }
  function place(s) {
    if (!s.h) return;
    const im = IMG[s.k], w = s.w * box.w, h = w * (im ? im.ar : 1);
    s.h.style.left = (s.x * 100) + '%'; s.h.style.top = (s.y * 100) + '%';
    s.h.style.width = w + 'px'; s.h.style.height = h + 'px';
    s.h.style.setProperty('--r', s.r + 'deg'); s.h.style.zIndex = 2 + S.st.indexOf(s);
    seekView();
  }
  function removeSt(s) {
    if (!s) return;
    S.st = S.st.filter(x => x !== s); if (s.h) s.h.remove();
    if (S.selSt === s.id) selectSt(null);
    S.st.forEach(place); sumLine(); steps(); S.result = null;
  }
  function selectSt(id) { S.selSt = id == null ? null : +id; S.st.forEach(s => s.h && s.h.classList.toggle('sel', s.id === S.selSt)); editor(); }
  function pulse(s) { if (!s || !gs() || RM) return; const w = s.w; s.w = w * .6; gs().to(s, { w, duration: .6, ease: 'back.out(3)', onUpdate: () => place(s) }); }
  function flyIn(k, x, y, r, demoFlag) {
    const b = trayBtn(k);
    const s = addSt(k, x, y, { r, a: 0, demo: !!demoFlag }); if (!s) return null;
    const br = b && b.getBoundingClientRect(), sr = stage.getBoundingClientRect(), im = IMG[k];
    const fromTray = br && br.width && br.top < innerHeight + 40 && br.bottom > -40;
    if (!gs() || RM || !im || !im.ok || !def(k).src) { s.a = 1; pulse(s); return s; }
    const ox = scrollX, oy = scrollY;
    const fx = (fromTray ? br.left + br.width / 2 : sr.left + sr.width * x) + ox, fy = (fromTray ? br.top + br.height / 2 : sr.top - 40) + oy;
    const g = document.createElement('div'); g.className = 'dragghost fly'; g.style.margin = '0'; g.innerHTML = `<img src="${def(k).src}" alt="">`; document.body.appendChild(g);
    const tw = s.w * sr.width;
    gs().fromTo(g, { x: fx, y: fy, width: fromTray ? br.width * .7 : tw * .5, height: fromTray ? br.width * .7 : tw * .5 * im.ar, xPercent: -50, yPercent: -50, rotation: -30, opacity: fromTray ? 1 : 0 },
      { x: sr.left + x * sr.width + ox, y: sr.top + y * sr.height + oy, width: tw, height: tw * im.ar, rotation: r || 0, opacity: 1, duration: .85, ease: 'expo.inOut', onComplete: () => { g.remove(); s.a = 1; seekView(); } });
    return s;
  }
  function editor() {
    const s = byId(S.selSt), ed = $('#stk-edit'); if (!ed) return;
    ed.hidden = !s;
    const clr = $('#stk-clear'); if (clr) clr.hidden = S.demo || (!S.st.length && !S.osd);
    if (!s) return;
    $('#stk-name').textContent = def(s.k).n;
    const sz = $('#stk-size'), rt = $('#stk-rot');
    sz.value = Math.round(s.w * 100); rt.value = Math.round(((s.r + 540) % 360) - 180);
    $('#stk-size-o').textContent = sz.value + ' %'; $('#stk-rot-o').textContent = rt.value + '°';
    fill(sz); fill(rt);
  }
  function gestures() {
    const Pm = new Map(); let G = null;
    const rect = () => stage.getBoundingClientRect();
    const center = s => { const r = rect(); return { x: r.left + s.x * r.width, y: r.top + s.y * r.height }; };
    const two = () => { const [a, b] = [...Pm.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) }; };
    stage.addEventListener('pointerdown', e => {
      if (S.busy || e.target.closest('.st-drop,.st-err,.stk-x,.st-tap') || (e.pointerType === 'mouse' && e.button)) return;
      Pm.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      const s0 = byId(S.selSt);
      if (Pm.size === 2 && s0) { const t = two(); G = { t: 'pinch', s: s0, d0: t.d, a0: t.a, w0: s0.w, r0: s0.r }; return; }
      if (Pm.size > 2) return;
      const h = e.target.closest('.stk');
      if (h) {
        const s = byId(h.dataset.id); if (!s) return;
        selectSt(s.id); hideHint(); s.demo = false; steps();
        if (e.target.classList.contains('stk-rot')) { const c = center(s); G = { t: 'rot', s, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), r0: s.r }; }
        else if (e.target.classList.contains('stk-sc')) { const c = center(s); G = { t: 'sc', s, d0: Math.hypot(e.clientX - c.x, e.clientY - c.y), w0: s.w }; }
        else G = { t: 'move', s, x0: e.clientX, y0: e.clientY, sx: s.x, sy: s.y };
        h.classList.add('drag'); e.preventDefault();
      } else {
        selectSt(null);
        const c = P.cur || curClip(), ax = panAxis(c);
        G = ax && c ? { t: 'pan', c, ax, x0: e.clientX, y0: e.clientY, px: c.pan.x, py: c.pan.y } : { t: 'tap', x0: e.clientX, y0: e.clientY };
      }
    });
    stage.addEventListener('pointermove', e => {
      if (!Pm.has(e.pointerId)) return;
      Pm.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!G) return;
      const r = rect(), s = G.s;
      if (G.t === 'pinch' && Pm.size >= 2) { const t = two(); s.w = clamp(G.w0 * t.d / G.d0, .03, 1.6); s.r = G.r0 + (t.a - G.a0) * 180 / Math.PI; }
      else if (G.t === 'move') { s.x = clamp(G.sx + (e.clientX - G.x0) / r.width, -.05, 1.05); s.y = clamp(G.sy + (e.clientY - G.y0) / r.height, -.05, 1.05); }
      else if (G.t === 'rot') { const c = center(s); let v = G.r0 + (Math.atan2(e.clientY - c.y, e.clientX - c.x) - G.a0) * 180 / Math.PI; v = ((v + 540) % 360) - 180; if (Math.abs(v) < 3) v = 0; s.r = v; }
      else if (G.t === 'sc') { const c = center(s); s.w = clamp(G.w0 * Math.hypot(e.clientX - c.x, e.clientY - c.y) / Math.max(8, G.d0), .03, 1.6); }
      else if (G.t === 'pan') {
        const c = G.c, sw = c.ew || c.w, sh = c.eh || c.h, cr = cropPx(sw, sh, S.aspect);
        if (G.ax === 'x') c.pan.x = clamp(G.px - (e.clientX - G.x0) / r.width * cr.width / Math.max(1, sw - cr.width), 0, 1);
        else c.pan.y = clamp(G.py - (e.clientY - G.y0) / r.height * cr.height / Math.max(1, sh - cr.height), 0, 1);
        panUI(); seekView(); S.result = null; return;
      } else return;
      if (s) { place(s); editor(); S.result = null; }
    });
    const end = e => {
      if (!Pm.has(e.pointerId)) return;
      Pm.delete(e.pointerId);
      if (Pm.size === 1 && G && G.t === 'pinch') { const [p] = [...Pm.values()]; G = { t: 'move', s: G.s, x0: p.x, y0: p.y, sx: G.s.x, sy: G.s.y }; return; }
      if (Pm.size === 0) {
        if (G && G.t === 'tap' && e.type === 'pointerup' && Math.hypot(e.clientX - G.x0, e.clientY - G.y0) < 6) { P.on ? pause() : play(); }
        if (G && G.s && G.s.h) G.s.h.classList.remove('drag'); G = null; panUI(); sumLine();
      }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', e => {
      const h = e.target.closest('.stk'); if (!h || S.busy) return;
      const s = byId(h.dataset.id); if (!s) return;
      e.preventDefault(); interact(); selectSt(s.id); s.demo = false;
      if (e.shiftKey) s.r = ((s.r + Math.sign(e.deltaY || e.deltaX) * 5 + 540) % 360) - 180;
      else s.w = clamp(s.w * Math.exp(-e.deltaY * .0015), .03, 1.6);
      place(s); editor(); steps(); S.result = null;
    }, { passive: false });
    ['dragenter', 'dragover'].forEach(ev => wrap.addEventListener(ev, e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); wrap.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { if (ev === 'dragleave' && wrap.contains(e.relatedTarget)) return; wrap.classList.remove('over'); }));
    wrap.addEventListener('drop', e => { e.preventDefault(); const fs = e.dataTransfer && [...e.dataTransfer.files]; if (!fs || !fs.length) return; const au = fs.find(isAudio), vi = fs.filter(isVideo); if (vi.length) addFiles(vi); else if (au) loadMusic(au); });
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
        case 'Delete': case 'Backspace': { const i = S.st.indexOf(s); removeSt(s); const n = S.st[Math.min(i, S.st.length - 1)]; if (n && n.h) n.h.focus(); else { const tb = $('#tray-top button'); if (tb) tb.focus(); } e.preventDefault(); return; }
        case 'Escape': selectSt(null); h.blur(); return;
        default: return;
      }
      e.preventDefault(); place(s); editor(); steps(); S.result = null;
    });
    // Leertaste spielt ab, M setzt eine Stelle (wenn der Fokus nicht in einem Feld steht)
    document.addEventListener('keydown', e => {
      if (!$('#studio') || e.target.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = $('#st'), r = st.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      if ((e.key === 'm' || e.key === 'M') && S.mode === 'auto' && S.step === 2) { addMark(); e.preventDefault(); }
    });
  }
  function stickerControls() {
    const sz = $('#stk-size'), rt = $('#stk-rot');
    if (sz) sz.addEventListener('input', () => { const s = byId(S.selSt); if (!s) return; s.w = sz.value / 100; place(s); editor(); S.result = null; });
    if (rt) rt.addEventListener('input', () => { const s = byId(S.selSt); if (!s) return; s.r = +rt.value; place(s); editor(); S.result = null; });
    const del = $('#stk-del'); if (del) del.addEventListener('click', () => removeSt(byId(S.selSt)));
    const front = $('#stk-front'); if (front) front.addEventListener('click', () => { const s = byId(S.selSt); if (!s) return; S.st = S.st.filter(x => x !== s).concat(s); S.st.forEach(place); S.result = null; });
    const clr = $('#stk-clear'); if (clr) clr.addEventListener('click', () => { [...S.st].forEach(removeSt); setOSD(false); editor(); });
    const ln = $('#ln-name');
    if (ln) {
      ln.addEventListener('input', () => { S.ln.name = ln.value; sumLine(); const p = $('#snd-name'); if (p && !p.dataset.touched) p.value = ln.value; S.result = null; seekView(); visit(4); });
      ln.addEventListener('focus', () => { S.ln.force = true; seekView(); }); ln.addEventListener('blur', () => { S.ln.force = false; seekView(); });
    }
    $$('input[name=ln-mode]').forEach(r => r.addEventListener('change', () => { S.ln.mode = r.value; sumLine(); S.result = null; seekView(); }));
  }

  /* ---------- Eigener Tag (Premium): aus dem Pilotennamen, im Vereinsstil ---------- */
  const pilotOf = a => { const k = String(a || '').trim().toLowerCase(); return (D.piloten || []).find(p => p.a && p.a.toLowerCase() === k) || null; };
  const tagImg = {};
  async function tagRender() {
    const t = S.tag, alias = (t.alias || '').trim().slice(0, 24) || 'Dein Pilotenname';
    try { await Promise.all([document.fonts.load('400 120px "Bebas Neue"'), document.fonts.load('600 40px "Chakra Petch"')]); } catch (e) {}
    const p = t.img ? pilotOf(alias) : null;
    let pic = null;
    if (p && p.img) { pic = tagImg[p.img]; if (!pic) { pic = new Image(); pic.src = p.img; tagImg[p.img] = pic; try { await pic.decode(); } catch (e) { pic = null; } } }
    const logo = IMG.plakette && IMG.plakette.ok ? IMG.plakette.el : null;
    const cv = IMG.tag.el, x = cv.getContext('2d');
    const A = alias.toUpperCase();
    const round = (cx, cy, r, img) => { x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip(); if (img) { const s = Math.max(2 * r / img.naturalWidth, 2 * r / img.naturalHeight); x.drawImage(img, cx - img.naturalWidth * s / 2, cy - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s); } x.restore(); };
    if (t.style === 'band') {
      x.font = '400 150px "Bebas Neue", sans-serif'; const tw = x.measureText(A).width;
      const has = !!(pic || logo), pad = has ? 200 : 60; cv.width = Math.ceil(pad + tw + 90); cv.height = 220;
      x.font = '400 150px "Bebas Neue", sans-serif';
      x.fillStyle = 'rgba(4,9,18,.86)'; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = SIG; x.fillRect(0, 0, 14, cv.height);
      x.fillStyle = AMBER; x.fillRect(14, cv.height - 10, cv.width - 14, 10);
      if (has) { x.fillStyle = 'rgba(63,224,255,.25)'; x.beginPath(); x.arc(110, 110, 80, 0, Math.PI * 2); x.fill(); round(110, 110, 74, pic || logo); x.strokeStyle = SIG; x.lineWidth = 6; x.beginPath(); x.arc(110, 110, 77, 0, Math.PI * 2); x.stroke(); }
      x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.fillText(A, pad, 150);
      x.font = '600 34px "Chakra Petch", monospace'; x.fillStyle = AMBER; if ('letterSpacing' in x) x.letterSpacing = '6px'; x.fillText('FLIGHT CLUB SAAR', pad + 4, 196); if ('letterSpacing' in x) x.letterSpacing = '0px';
    } else if (t.style === 'plakette') {
      cv.width = 640; cv.height = 760;
      const g = x.createRadialGradient(320, 300, 40, 320, 300, 300); g.addColorStop(0, '#1f497d'); g.addColorStop(1, '#040912');
      x.fillStyle = g; x.beginPath(); x.arc(320, 300, 290, 0, Math.PI * 2); x.fill();
      x.lineWidth = 16; x.strokeStyle = SIG; x.stroke(); x.lineWidth = 6; x.strokeStyle = AMBER; x.beginPath(); x.arc(320, 300, 262, 0, Math.PI * 2); x.stroke();
      round(320, 300, 230, pic || logo);
      if (!pic && !logo) { x.fillStyle = '#fff'; x.font = '400 160px "Bebas Neue"'; x.textAlign = 'center'; x.fillText('FCS', 320, 360); }
      x.textAlign = 'center';
      let fs = 120; x.font = `400 ${fs}px "Bebas Neue", sans-serif`; while (x.measureText(A).width > 600 && fs > 50) { fs -= 6; x.font = `400 ${fs}px "Bebas Neue", sans-serif`; }
      const bw = Math.min(630, x.measureText(A).width + 70);
      x.fillStyle = AMBER; x.fillRect(320 - bw / 2, 570, bw, fs + 20);
      x.fillStyle = '#040912'; x.textBaseline = 'top'; x.fillText(A, 320, 580);
      x.font = '600 30px "Chakra Petch", monospace'; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.fillText('FLIGHT CLUB SAAR', 320, 750);
    } else if (t.style === 'hud') {
      x.font = '600 96px "Chakra Petch", monospace'; const tw = x.measureText(A).width;
      cv.width = Math.ceil(tw + 300); cv.height = 250;
      x.font = '600 96px "Chakra Petch", monospace';
      x.strokeStyle = '#fff'; x.lineWidth = 8; x.lineCap = 'square'; const W2 = cv.width, H2 = cv.height, L = 46, m = 8;
      x.beginPath(); x.moveTo(m, m + L); x.lineTo(m, m); x.lineTo(m + L, m); x.moveTo(W2 - m - L, m); x.lineTo(W2 - m, m); x.lineTo(W2 - m, m + L); x.moveTo(W2 - m, H2 - m - L); x.lineTo(W2 - m, H2 - m); x.lineTo(W2 - m - L, H2 - m); x.moveTo(m + L, H2 - m); x.lineTo(m, H2 - m); x.lineTo(m, H2 - m - L); x.stroke();
      x.fillStyle = 'rgba(4,9,18,.55)'; x.fillRect(20, 20, W2 - 40, H2 - 40);
      x.fillStyle = SIG; x.font = '600 40px "Chakra Petch", monospace'; x.fillText('PILOT ▸', 52, 82);
      x.fillStyle = '#fff'; x.font = '600 96px "Chakra Petch", monospace'; x.fillText(A, 150, 176);
      x.fillStyle = RED; x.beginPath(); x.arc(70, 200, 12, 0, Math.PI * 2); x.fill();
      x.fillStyle = AMBER; x.font = '600 32px "Chakra Petch", monospace'; x.fillText('FCS · SAARLAND', 96, 212);
    } else {
      x.font = '400 130px "Bebas Neue", sans-serif'; const tw = x.measureText(A).width;
      cv.width = Math.ceil(Math.max(tw, 560) + 140); cv.height = 300;
      x.font = '400 130px "Bebas Neue", sans-serif';
      x.translate(cv.width / 2, cv.height / 2); x.rotate(-.05); x.translate(-cv.width / 2, -cv.height / 2);
      x.strokeStyle = AMBER; x.lineWidth = 10; x.strokeRect(30, 30, cv.width - 60, cv.height - 60); x.lineWidth = 4; x.strokeRect(46, 46, cv.width - 92, cv.height - 92);
      x.fillStyle = AMBER; x.textAlign = 'center'; x.fillText(A, cv.width / 2, 178);
      x.font = '600 32px "Chakra Petch", monospace'; x.fillText('FLIGHT CLUB SAAR E. V.', cv.width / 2, 232);
      x.setTransform(1, 0, 0, 1, 0, 0);
    }
    IMG.tag.ok = true; IMG.tag.ar = cv.height / cv.width;
    S.st.filter(s => s.k === 'tag').forEach(place);
    const pv = $('#tag-prev'); if (pv) { const k = pv.getContext('2d'); pv.width = 480; pv.height = Math.round(480 * IMG.tag.ar); k.clearRect(0, 0, pv.width, pv.height); k.drawImage(cv, 0, 0, pv.width, pv.height); }
    const pi = $('#tag-img-row'); if (pi) pi.hidden = !pilotOf(alias);
    lsSet(LS.tag, { alias: t.alias, style: t.style, img: t.img });
    S.result = null; seekView();
  }
  function tagUI() {
    const saved = lsGet(LS.tag); if (saved) Object.assign(S.tag, saved);
    const al = $('#tag-alias'), im = $('#tag-img');
    if (al) { al.value = S.tag.alias || ''; al.addEventListener('input', () => { S.tag.alias = al.value; tagRender(); }); }
    if (im) { im.checked = S.tag.img !== false; im.addEventListener('change', () => { S.tag.img = im.checked; tagRender(); }); }
    $$('input[name=tag-style]').forEach(r => { r.checked = r.value === S.tag.style; r.addEventListener('change', () => { S.tag.style = r.value; tagRender(); }); });
    const add = $('#tag-add'); if (add) add.addEventListener('click', async () => {
      if (!isMember()) { lockHit('tag'); return; }
      interact(); await tagRender();
      if (!S.tag.alias.trim()) { const a = $('#tag-alias'); if (a) { a.focus(); a.closest('.field') && a.closest('.field').classList.add('bad'); } return; }
      const ex = S.st.find(s => s.k === 'tag');
      if (ex) { selectSt(ex.id); pulse(ex); } else { const s = addSt('tag', .5, .82); pulse(s); }
      visit(4); if (!inView(stage) && innerWidth <= 1040) go(wrap, -110);
    });
  }

  /* =====================================================================
     Ausgabe: Größe, Bitrate, Zusammenfassung
     ===================================================================== */
  function firstOwn() { return own().find(c => c.w) || S.clips.find(c => c.w) || null; }
  function outDims() {
    const c0 = firstOwn(); if (!c0) return { W: 1920, H: 1080 };
    // Zielformat, nicht der gerade animierte Wert der Bühne
    const r = cropPx(c0.w, c0.h, fmtA(S.fmt)); let W = r.width, H = r.height;
    if (S.q === '1080') { const sh = Math.min(W, H); if (sh > 1080) { W *= 1080 / sh; H *= 1080 / sh; } }
    const k = Math.min(1, 3840 / Math.max(W, H), 2160 / Math.min(W, H)); W *= k; H *= k;
    return { W: even(W), H: even(H) };
  }
  function outFps() {
    const segs = S.seq ? S.seq.segs : []; let f = 30;
    if (segs.length) f = Math.max(...segs.map(s => s.c.fps || 30));
    if (S.seq && S.seq.style === 'cine') f = Math.min(f, 30);
    f = clamp(f, 23.976, 60);
    const std = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]; return std.reduce((a, b) => Math.abs(b - f) < Math.abs(a - f) ? b : a);
  }
  function bitrate(W, H, fps) {
    const px = W * H, hi = fps > 40;
    if (px >= 3840 * 2160 * .85) return hi ? 60e6 : 40e6;
    if (px >= 2560 * 1440 * .85) return hi ? 36e6 : 26e6;
    if (px >= 1920 * 1080 * .85) return hi ? 24e6 : 16e6;
    if (px >= 1280 * 720 * .85) return hi ? 14e6 : 10e6;
    return 8e6;
  }
  function sumLine() {
    const el = $('#st-sum'); if (!el) return;
    const o = outDims(), n = S.st.length + (S.osd ? 1 : 0), seq = S.seq;
    const parts = [(S.fmt === 'orig' ? 'Original' : S.fmt) + ' · ' + o.W + ' × ' + o.H];
    if (!S.demo && seq) parts.push(tS(seq.total) + (seq.segs.length > 1 ? ` · ${seq.segs.length} Szenen` : ''));
    if (S.music && !S.music.demo) parts.push('Musik');
    if (S.look !== 'natur') parts.push('Look ' + ((window.__fcsLooks || {})[S.look] || { n: S.look }).n);
    parts.push(n === 1 ? '1 Sticker' : n ? n + ' Sticker' : 'ohne Sticker');
    if (S.ln.name.trim() && S.ln.mode !== 'off' && S.ln.name !== 'Dein Pilotenname') parts.push('Name: ' + S.ln.name.trim());
    el.textContent = parts.join(' · ');
    const qo = $('#q-orig-o'); if (qo) { const c0 = firstOwn(); qo.textContent = c0 ? `${outDimsFor('orig').W} × ${outDimsFor('orig').H}` : 'bis 4K'; }
  }
  function outDimsFor(q) { const k = S.q; S.q = q; const o = outDims(); S.q = k; return o; }
  function goState() {
    const why = $('#st-why'); if (!why) return;
    why.classList.remove('bad', 'lock');
    if (S.demo) why.innerHTML = 'Das ist ein Beispiel. <button type="button" class="linkbtn" data-st-pick2>Wähl zuerst dein Video</button>, dann rechnet das Studio es fertig.';
    else if (!own().some(c => c.state === 'ok' || c.state === 'nurExport')) why.textContent = 'Dieses Video kann dein Browser nicht bearbeiten. In voller Qualität an den Verein schicken geht trotzdem, unten bei „An den Verein schicken“.';
    else if (S.locked) lockNote();
    else why.textContent = 'Das Video wird in voller Qualität gerechnet: so groß wie dein Original (bis 4K), mit hoher Bitrate, als MP4.';
    const p2 = $('[data-st-pick2]', why); if (p2) p2.addEventListener('click', pick);
    const dl = $('#st-dl'); if (dl) dl.classList.toggle('wait', S.demo);
  }

  /* =====================================================================
     Export
     ===================================================================== */
  const sig = () => JSON.stringify([S.fmt, S.q, S.look, S.lookK, S.osd, S.ln, S.st.map(s => [s.k, s.x.toFixed(3), s.y.toFixed(3), s.w.toFixed(3), Math.round(s.r)]), S.seq && S.seq.segs.map(s => [s.c.id, s.a.toFixed(2), s.len.toFixed(2), s.kind, s.tr]), S.clips.map(c => [c.pan.x, c.pan.y]), S.music && [S.music.start, S.music.vol, S.music.fin, S.music.fout], S.origVol, S.tag]);
  let expCtl = null;
  async function exportVideo() {
    if (S.busy) return;
    interact();
    if (S.demo) { pick(); flash($('#st-steps li:first-child')); return; }
    if (!S.seq || !S.seq.segs.length) { err('Wähl zuerst einen Clip, den dein Browser abspielen kann.'); return; }
    if (S.result && S.resultSig === sig()) { saveResult(); return; }
    const segs = S.seq.segs;
    // Selbsttest abwarten
    for (let i = 0; i < 140 && segs.some(s => s.c.file && s.c.info && s.c.info.canDecode && !s.c.tested); i++) await new Promise(r => setTimeout(r, 150));
    const bad = segs.find(s => !s.c.mode);
    if (bad) { failMsg((bad.c.ref === false ? `In „${bad.c.name}“ findet der Browser kein Videobild, nur eine leere Fläche. Damit kein leeres Video entsteht, rechnet das Studio hier nicht. Probier den Clip in Chrome am PC oder schick das Original in voller Qualität an den Verein.` : `Dieser Browser gibt die Bilder von „${bad.c.name}“ nicht zum Rechnen frei. Rechne das Video in Chrome oder Edge am PC oder schick das Original in voller Qualität an den Verein.`) + hdrTip(bad.c)); return; }
    S.busy = true; $('#st').classList.add('busy'); pause();
    const prog = $('#prog'), fillEl = $('#bat-fill'), pt = $('#prog-t'), eta = $('#prog-eta'), goBox = $('#st-go');
    prog.hidden = false; $('#res').hidden = true; if (goBox) goBox.hidden = true;
    const t0 = performance.now();
    const set = (p, label) => { p = clamp(p, 0, 1); fillEl.style.transform = `scaleX(${p})`; pt.textContent = `${label || 'Wird gerechnet'} … ${Math.round(p * 100)} %`; const el = (performance.now() - t0) / 1000; eta.textContent = p > .03 ? 'noch etwa ' + tS(el / p - el) : ''; };
    set(0, 'Wird vorbereitet');
    if (!inView(prog)) go(prog, -200);
    const ctl = expCtl = new AbortController();
    let wake = null; try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) {}
    const doneUI = () => { S.busy = false; $('#st').classList.remove('busy'); prog.hidden = true; if (goBox) goBox.hidden = false; expCtl = null; if (wake) wake.release().catch(() => {}); };
    try {
      try { await (document.fonts && document.fonts.ready); } catch (e) {}
      const M = await media();
      const full = outDims(), fps = outFps();
      // H.264 zuerst, notfalls in kleinerer Stufe (spielt in jeder Galerie); erst danach HEVC, VP9, AV1
      const sizes = [[full.W, full.H, bitrate(full.W, full.H, fps)]];
      for (const sh of [1440, 1080, 720]) { const k = sh / Math.min(full.W, full.H); if (k >= 1) continue; const w2 = even(full.W * k), h2 = even(full.H * k); sizes.push([w2, h2, bitrate(w2, h2, fps)]); }
      const enc = await M.pickEncoder(sizes, fps);
      let W = full.W, H = full.H, br = sizes[0][2], vc = null, note = '';
      if (enc) { W = enc.W; H = enc.H; br = enc.bitrate; vc = enc.vc; if (W !== full.W) note = `Dein Browser kodiert auf diesem Gerät höchstens ${W} × ${H}. Das Original schickst du unten in voller Qualität an den Verein.`; }
      if (!vc && !window.MediaRecorder) throw new Error('kein-encoder');
      // Ton mischen
      set(.01, 'Ton wird gemischt');
      const plan = { total: S.seq.total, segs: [], music: S.music ? { buf: S.music.buf, start: grid().music ? grid().t0 : S.music.start, vol: S.music.vol, fin: S.music.fin, fout: S.music.fout } : null };
      if (S.origVol > 0) for (const s of segs) { if (s.kind !== '1' && s.kind) continue; const buf = await M.clipAudio(s.c.file, s.a, s.a + s.len).catch(() => null); plan.segs.push({ buf, at: s.at, len: s.len, vol: S.origVol }); }
      const audio = await M.mixAudio(plan).catch(() => null);
      const ac = audio ? await M.audioCodec() : null;
      const fmt = audio && !ac ? 'mov' : 'mp4';
      const job = { W, H, fps, vc, ac: audio ? (ac || 'pcm-s16') : null, fmt, bitrate: br, audio, look: { id: S.look, k: S.lookK }, signal: ctl.signal, cssLook: window.__fcsCssLook };
      job.frames = Math.max(1, Math.round(S.seq.total * fps));
      job.fadeFrames = Math.round((S.seq.fade || 0) * fps);
      job.segs = segs.map((s, i) => {
        const f0 = Math.round(s.at * fps), nx = segs[i + 1], f1 = nx ? Math.round(nx.at * fps) : job.frames;
        const tail = nx && nx.d > 0 ? Math.max(1, Math.round(nx.d * fps)) : 0, n = Math.max(1, f1 - f0 + tail);
        const times = new Float64Array(n), last = Math.max(0, s.c.dur - 1 / (s.c.fps || 30));
        for (let k = 0; k < n; k++) times[k] = clamp(s.src((f0 + k) / fps - s.at), 0, last);
        for (let k = 1; k < n; k++) if (times[k] < times[k - 1]) times[k] = times[k - 1];
        const cr = cropPx(s.c.w, s.c.h, W / H, s.c.pan);
        return { file: s.c.file, mode: s.c.mode, f0, f1, times, crop: { left: Math.round(cr.left), top: Math.round(cr.top), width: Math.round(cr.width), height: Math.round(cr.height) }, clip: s.c };
      });
      job.cuts = segs.map((s, i) => i ? { f: job.segs[i].f0, d: job.segs[i - 1].times.length - (job.segs[i - 1].f1 - job.segs[i - 1].f0), type: s.tr } : null);
      job.overlay = (c, t) => overlay(c, W, H, t, false);
      // Compositor in Ausgabegröße für Übergänge und Look
      const G = await glm(); job.tr2d = G.tr2d;
      // Hat WebGL auf diesem Gerät in der Vorschau schon eine leere Fläche geliefert (oder ist der Kontext verloren), gleich den 2D-Weg nehmen
      if (glOff || S.locked || segs.some(s => s.c.glBad)) job.gl = null;
      else { const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H; job.gl = G.compositor(glCanvas); if (job.gl.ok) await loadLut(job.gl); }
      let out, live = false;
      const run = async () => {
        live = S.locked || job.segs.some(sg => sg.mode === 'element') || !vc;
        if (live) return renderLive(job, p => set(p), M);
        // Bild-Selbsttest während des Exports (vor Logo, Sticker und Schriftzug): liefert ein Weg nur eine leere,
        // einfarbige Fläche (Samsung: lila), bricht das Studio ab und nimmt den nächsten Weg
        const probe = document.createElement('canvas'); probe.width = probe.height = 16; const pk = probe.getContext('2d', { willReadFrequently: true });
        const look16 = cv => { pk.fillStyle = '#000'; pk.fillRect(0, 0, 16, 16); pk.drawImage(cv, 0, 0, 16, 16); return M.lumaOf(pk, 16, 16); };
        const st = new Map();
        return M.render(job, {
          progress: p => set(p),
          frameCheck: (f, ctx, si, info) => {
            const sg = job.segs[si], c = sg.clip;
            if (c.ref === true && (f - sg.f0) % 6 === 2) {
              const s0 = st.get(c) || { n: 0, flat: 0, real: 0, glFlat: 0 }; st.set(c, s0);
              const L = look16(info.src); s0.n++;
              if (nb(L)) s0.real++; else s0.flat++;
              if (!s0.real && s0.flat >= 3) throw flatErr(c, 'decode', L);
              if (info.gl && !(info.fade > 0) && nb(L)) { const O = look16(ctx.canvas); if (!nb(O)) { s0.glFlat++; if (s0.glFlat >= 2) throw flatErr(c, 'gl', O); } }
            }
            // Letztes Bild: Clips, die nie echtes Bild geliefert haben, gelten als gescheitert (kurze Szenen)
            if (info.last) for (const [c2, s2] of st) if (!s2.real && s2.flat) throw flatErr(c2, 'decode', null);
          }
        });
      };
      const order = [...WAYS, 'element'], tried = new Map();
      for (let tries = 0; tries < 10 && !out; tries++) {
        try { out = await run(); }
        catch (e) {
          if (e && e.name === 'AbortError') throw e;
          if (e && e.message === 'flach' && e.clip) {
            const c = e.clip;
            console.info('Clip-Studio: Export-Selbsttest: leere/einfarbige Fläche', { clip: c.name, weg: c.mode, stufe: e.stage, pixel: e.L });
            if (e.stage === 'gl' && job.gl) { try { job.gl.destroy && job.gl.destroy(); } catch (er) {} job.gl = null; c.glBad = true; set(0, 'Neuer Versuch ohne WebGL'); continue; }
            if (e.stage === 'canvas' && !job.liveCpu) { job.liveCpu = true; set(0, 'Neuer Versuch über den sicheren Weg'); continue; }
            const t = tried.get(c) || new Set(); t.add(c.mode); tried.set(c, t);
            const next = order.find(w => !t.has(w) && (w === 'element' ? c.state === 'ok' && !c.elBlack : !!(c.info && c.info.canDecode) && !(c.lum[w] && !c.lum[w].some(nb))));
            console.info('Clip-Studio: nächster Weg:', next || 'keiner');
            if (!next) { const e2 = new Error('leer-alle'); e2.clip = c; e2.tried = [...t]; throw e2; }
            c.mode = next; job.segs.forEach(sg => { if (sg.clip === c) sg.mode = next; });
            renderClips(); set(0, 'Neuer Versuch über einen anderen Weg'); continue;
          }
          throw e;
        }
      }
      if (!out) throw new Error('kein-ergebnis');
      // Fertige Datei prüfen: Länge und Bildanzahl. Nie still ein kaputtes oder leeres Video speichern.
      if (out.ext !== 'webm' && !out.rec) {
        set(1, 'Wird geprüft');
        const chk = await M.verify(out.blob, { dur: job.frames / fps, frames: job.frames, fps, live });
        console.info('Clip-Studio: Prüfung der fertigen Datei', chk, out.fastStart || '');
        // Echtzeit-Weg: ist das Gerät zu langsam, fehlen einzelne Bilder (das vorige bleibt stehen), Länge muss trotzdem stimmen
        if (!chk.ok && !(live && chk.frames >= Math.max(2, job.frames * .2) && Math.abs(chk.dur - job.frames / fps) < .5)) { const e2 = new Error('kaputt'); e2.why = chk.why; throw e2; }
      }
      if (job.gl && job.gl.destroy) job.gl.destroy();
      doneUI(); goState();
      const pilot = (S.ln.name !== 'Dein Pilotenname' && S.ln.name.trim()) || (S.member && S.member.n) || ((($('#snd-name') || {}).value) || '') || 'clip';
      const file = new File([out.blob], `flightclubsaar_${slug(pilot) || 'clip'}_${today()}.${out.ext}`, { type: out.mime || out.blob.type });
      S.result = file; S.resultSig = sig();
      const rv = $('#res-v'); if (rv.src) URL.revokeObjectURL(rv.src); rv.src = URL.createObjectURL(file);
      const dl = $('#res-dl'); dl.href = rv.src; dl.download = file.name;
      $('#res-t').textContent = 'Fertig gerechnet';
      const cn = { avc: 'H.264', hevc: 'HEVC', vp9: 'VP9', av1: 'AV1' }[job.vc] || job.vc || 'WebM';
      $('#res-info').textContent = `${out.ext.toUpperCase()} · ${cn} · ${W} × ${H} · ${String(Math.round(fps * 100) / 100).replace('.', ',')} fps · ${MB(file.size)}${audio ? '' : ' · ohne Ton'}`;
      const rn = $('#res-note'); if (rn) { rn.textContent = note; rn.hidden = !note; }
      $('#res-share').hidden = !(navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })());
      $('#res').hidden = false;
      if (gs() && !RM) gs().from('#res', { y: 16, opacity: 0, duration: .6, ease: 'expo.out' });
      saveResult(); sndUI();
      return true;
    } catch (e) {
      doneUI();
      if (e && e.name === 'AbortError') { goState(); return false; }
      console.info('Clip-Studio: Export fehlgeschlagen', e);
      const m = e && e.message;
      failMsg(m === 'leer-alle' ? `Dieser Browser liefert beim Rechnen von „${e.clip ? e.clip.name : 'deinem Clip'}“ nur eine leere Fläche statt des Videobilds (alle Wege geprüft). Damit du kein leeres Video bekommst, speichert das Studio nichts. Rechne es in Chrome am PC oder schick das Original in voller Qualität an den Verein.` + hdrTip(e.clip)
        : m === 'kaputt' ? 'Die fertige Datei war unvollständig, deshalb speichert das Studio sie nicht. Tipp noch einmal auf „Video erstellen“ oder schick das Original in voller Qualität an den Verein.'
        : 'Rechnen hat in diesem Browser nicht geklappt. Probier es in Chrome, Edge oder Safari in der neuesten Version, oder schick das Original in voller Qualität an den Verein.');
      return false;
    }
  }
  // Handy-HDR-Videos (zum Beispiel Samsung „HDR10+“) geben manche Browser nicht zum Rechnen frei: konkreter Tipp
  function hdrTip(c) { const i = c && c.info; return i && (i.hdr || i.bits > 8) ? ' Tipp: Dein Clip ist HDR beziehungsweise 10 Bit. Am Samsung in der Kamera unter Einstellungen › Erweiterte Videooptionen „HDR10+-Video“ ausschalten, dann klappt es künftig direkt am Handy.' : ''; }
  function flatErr(c, stage, L) { const e = new Error('flach'); e.clip = c; e.stage = stage; e.L = L; return e; }
  function failMsg(t) {
    const why = $('#st-why'); if (!why) return; why.classList.add('bad');
    why.innerHTML = esc(t) + ' <button class="btn" type="button" id="fail-send">Original an den Verein schicken</button>';
    const fs = $('#fail-send'); if (fs) fs.addEventListener('click', () => { const r = $('input[name=snd-what][value=orig]'); if (r) { r.checked = true; r.dispatchEvent(new Event('change')); } go($('#snd'), -120); });
  }
  function saveResult() {
    if (!S.result) return;
    const a = $('#res-dl'); if (a) { try { a.click(); } catch (e) {} }
    S.done.dl = true; steps();
    const rt = $('#res-t'); if (rt) rt.textContent = 'Fertig. Dein Download startet';
  }
  /* Export in Echtzeit über das Video-Element (wenn WebCodecs ein Format nicht dekodiert, der Browser es aber abspielt) */
  async function renderLive(job, set, M) {
    const { W, H, fps } = job;
    const outC = document.createElement('canvas'); outC.width = W; outC.height = H; const out = outC.getContext('2d', { alpha: false });
    const total = S.seq.total, mode = playMode(); const wasStep = S.step;
    S.viewSeq = true; if (S.step <= 2) S.step = 3;
    let rec = null, vsrc = null, output = null, target = null, parts = [];
    if (job.vc && window.VideoEncoder && !S.locked) {
      target = new M.M.BufferTarget();
      output = new M.M.Output({ format: new M.M.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
      vsrc = new M.M.CanvasSource(outC, { codec: job.vc, quality: new M.M.Quality({ bitrate: job.bitrate, bitrateMode: 'variable' }), keyFrameInterval: 2 }); output.addVideoTrack(vsrc, { frameRate: fps });
      if (job.audio && job.ac) { const as = new M.M.AudioBufferSource(job.ac.startsWith('pcm') ? { codec: job.ac } : { codec: job.ac, quality: new M.M.Quality({ bitrate: 192000 }) }); output.addAudioTrack(as); job._as = as; }
      await output.start(); if (job._as) await job._as.add(job.audio);
    } else {
      const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t)); if (!mime) throw new Error('kein-encoder');
      const stream = outC.captureStream(fps); let ac2 = null;
      if (job.audio) { ac2 = new AudioContext(); const src = ac2.createBufferSource(); src.buffer = job.audio; const dst = ac2.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t)); job._src = src; job._ac = ac2; }
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: job.bitrate }); rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); }; rec._mime = mime;
    }
    return new Promise((resolve, reject) => {
      let lastF = -1, stopped = false;
      P.t = 0; P.on = true; P.last = performance.now(); const wasSound = S.sound; S.sound = false;
      const look = job.look && job.look.id !== 'natur' ? job.look : null;
      const stop = async (e) => {
        if (stopped) return; stopped = true; P.on = false; S.sound = wasSound; stopAll(); S.step = wasStep; S.viewSeq = mode === 'seq' ? S.viewSeq : false;
        if (e) { try { if (output) await output.cancel(); if (rec && rec.state !== 'inactive') rec.stop(); if (job._ac) job._ac.close(); } catch (er) {} reject(e); return; }
        try {
          if (output) { await output.finalize(); resolve({ blob: new Blob([target.buffer], { type: 'video/mp4' }), mime: 'video/mp4', ext: 'mp4', fastStart: 'in-memory' }); }
          else { rec.onstop = () => { if (job._ac) job._ac.close(); const type = rec._mime.split(';')[0]; resolve({ blob: new Blob(parts, { type }), mime: type, ext: type === 'video/mp4' ? 'mp4' : 'webm', rec: true }); }; rec.stop(); }
        } catch (er) { reject(er); }
      };
      if (job.signal) job.signal.addEventListener('abort', () => stop(new DOMException('abgebrochen', 'AbortError')));
      if (rec) { rec.start(500); if (job._src) job._src.start(); }
      let srcFlat = 0, outFlat = 0, checks = 0, lc = null, made = 0;
      const T = window.FCS_STUDIO_TEST || {}, flagT = w => (T.flatExport || []).includes(w);
      const purple = () => { out.fillStyle = '#2f0d33'; out.globalAlpha = 1; out.fillRect(0, 0, W, H); };
      const step = async () => {
        if (stopped) return;
        const r = seqAt(Math.min(P.t, total - .001)); if (!r) { stop(new Error('leer')); return; }
        const f = Math.floor(P.t * fps);
        if (f > lastF && f < job.frames) {
          const s = r.s;
          // Dieselben Video-Elemente wie die Vorschau (vidOf). Hat eines im Übergang noch kein Bild: harter Schnitt statt leerer Fläche.
          let A = r.prev ? vidOf(r.prev) : vidOf(s), B = r.prev ? vidOf(s) : null, cA = r.prev ? r.prev.c : s.c, inTr = !!B;
          if (inTr && !vReady(B)) inTr = false;
          else if (inTr && !vReady(A)) { A = B; cA = s.c; inTr = false; }
          if (!inTr) B = null;
          if (A.readyState >= 2 && !A.seeking) {
            const tr = inTr ? { type: s.tr, p: r.p, seed: f % 97 } : null;
            const fade = job.fadeFrames > 0 ? Math.max(0, (f - (job.frames - job.fadeFrames)) / job.fadeFrames) : 0;
            const useGL = !!(job.gl && job.gl.ok);
            if (useGL) { job.gl.render({ A, B, ra: cropN(cA, A), rb: B ? cropN(s.c, B) : null, tr, look, fade }); out.drawImage(job.gl.canvas, 0, 0, W, H); if (flagT('gl')) purple(); }
            else {
              // 2D-Weg: Bild (optional erst auf einen Arbeitsspeicher-Canvas, falls der Grafikchip-Canvas leer bleibt), Look per Filter, Blende, Ausblenden
              const dst = job.liveCpu ? (lc || (lc = (() => { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; return c2.getContext('2d', { alpha: false, willReadFrequently: true }); })())) : out;
              const base = look && job.cssLook ? job.cssLook(look.id, look.k) : 'none';
              const cr = cropPx(A.videoWidth, A.videoHeight, W / H, cA.pan), ra = [cr.left, cr.top, cr.width, cr.height];
              if (B && tr && job.tr2d) { const c2 = cropPx(B.videoWidth, B.videoHeight, W / H, s.c.pan); job.tr2d(dst, A, ra, B, [c2.left, c2.top, c2.width, c2.height], tr, W, H, base); }
              else { if ('filter' in dst) dst.filter = base; dst.globalAlpha = 1; dst.drawImage(A, ra[0], ra[1], ra[2], ra[3], 0, 0, W, H); }
              if ('filter' in dst) dst.filter = 'none';
              if (fade > 0) { dst.fillStyle = '#000'; dst.globalAlpha = clamp(fade, 0, 1); dst.fillRect(0, 0, W, H); dst.globalAlpha = 1; }
              if (job.liveCpu) { out.drawImage(lc.canvas, 0, 0, W, H); if (flagT('elementCpu')) purple(); }
              else if (flagT('element')) purple();
            }
            // Selbsttest: Video-Element direkt (Arbeitsspeicher) gegen das gerechnete Bild (vor Logo und Stickern)
            if (made++ % 8 === 3 && cA.ref === true && !S.locked) {
              const k = k24(); k.fillStyle = '#000'; k.fillRect(0, 0, 24, 24); k.drawImage(A, 0, 0, 24, 24); const Ls = lum24(k);
              k.fillRect(0, 0, 24, 24); k.drawImage(outC, 0, 0, 24, 24); const Lo = lum24(k);
              checks++; if (!nb(Ls)) srcFlat++; else if (!nb(Lo) && !(fade > 0)) outFlat++;
              if (checks >= 3 && srcFlat === checks) { stop(flatErr(cA, 'decode', Ls)); return; }
              if (outFlat >= 2) { stop(flatErr(cA, useGL ? 'gl' : job.liveCpu ? 'decode' : 'canvas', Lo)); return; }
            }
            overlay(out, W, H, f / fps, false);
            if (vsrc) { try { await vsrc.add(f / fps, 1 / fps); } catch (e) { stop(e); return; } }
            lastF = f; set(Math.min(1, P.t / total));
          }
        }
        if (P.t >= total - 1 / fps) { stop(); return; }
        requestAnimationFrame(step);
      };
      seekView(); requestAnimationFrame(step);
    });
  }

  /* =====================================================================
     An den Verein schicken (voller Qualität, OneDrive über Make)
     ===================================================================== */
  const UPS = new Map();
  function apiClips() { return ((D.api || {}).clips || '').trim(); }
  function sndUI() {
    const f = $('#snd'), off = $('#snd-off'); if (!f) return;
    const on = !!apiClips(); f.hidden = !on; if (off) off.hidden = on;
    const fin = $('input[name=snd-what][value=fertig]'), orig = $('input[name=snd-what][value=orig]');
    if (S.result && S.resultSig !== sig()) S.result = null;
    if (fin) { fin.disabled = !S.result; fin.closest('label').classList.toggle('dis', !S.result); if (!S.result && fin.checked && orig) orig.checked = true; if (S.result && !f.dataset.touched) fin.checked = true; }
    const what = ($('input[name=snd-what]:checked') || {}).value || 'orig';
    const list = $('#snd-files');
    if (list) {
      const files = what === 'fertig' && S.result ? [{ f: S.result, n: 'Fertiges Video' }] : own().filter(c => c.file).map((c, i) => ({ f: c.file, n: `Clip ${i + 1}` }));
      list.innerHTML = files.length ? files.map(x => `<li><b>${esc(x.f.name)}</b><span>${esc(x.n)} · ${MB(x.f.size)}</span></li>`).join('') : '<li class="mute">Noch kein Video ausgewählt.</li>';
      f._files = files.map(x => x.f);
    }
    const nm = $('#snd-name'); if (nm && !nm.value) nm.value = (S.member && S.member.n) || S.ln.name.trim() || '';
  }
  function sendUI() {
    const f = $('#snd'); if (!f) return;
    $$('input[name=snd-what]', f).forEach(r => r.addEventListener('change', () => { f.dataset.touched = 1; sndUI(); }));
    const nm = $('#snd-name'); if (nm) nm.addEventListener('input', () => { nm.dataset.touched = 1; });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (window.FCS && FCS.validate && !FCS.validate(f)) return;
      const extra = [...(($('#snd-extra') || {}).files || [])].filter(x => x.size);
      const files = (f._files || []).concat(extra); if (!files.length) { const s = $('#snd-state'); if (s) s.textContent = 'Wähl oben zuerst dein Video.'; return; }
      const C = await cloud();
      const ig = ($('#snd-ig').value || '').trim(), msg = ($('#snd-msg').value || '').trim();
      const t = [ig && 'Instagram: ' + (ig.startsWith('@') ? ig : '@' + ig), msg, S.result && files.includes(S.result) ? `Clip-Studio: ${$('#st-sum').textContent}` : ''].filter(Boolean).join('\n').slice(0, 500);
      const n = $('#snd-name').value.trim().slice(0, 40);
      const box = $('#snd-up'); box.hidden = false; box.innerHTML = '';
      $('#snd-go').disabled = true;
      let allOk = true;
      for (const file of files) {
        const ok = await runUpload(C, box, file, { n, zweck: 'einsenden', t, c: S.member ? S.member.c : '' });
        if (!ok) { allOk = false; break; }
      }
      $('#snd-go').disabled = false;
      if (allOk) { S.done.sent = true; steps(); f.classList.add('sent'); const ok = $('#snd-ok-msg'); if (ok) { ok.hidden = false; if (gs() && !RM) gs().fromTo(ok, { scale: .92, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(2)' }); } }
    });
    const ex = $('#snd-extra'); if (ex) ex.addEventListener('change', () => { const st = $('#snd-state'); if (st) st.textContent = ''; });
    const again = $('#snd-again'); if (again) again.addEventListener('click', () => { const e2 = $('#snd-extra'); if (e2) e2.value = ''; f.classList.remove('sent'); $('#snd-ok-msg').hidden = true; $('#snd-up').innerHTML = ''; $('#snd-up').hidden = true; });
    reach();
  }
  /* Ein Upload mit Fortschritt, Pause/Fortsetzen und Abbrechen. Liefert true, wenn fertig. */
  function runUpload(C, box, file, meta) {
    return new Promise(resolve => {
      const up = new C.Upload(apiClips(), file, meta);
      UPS.set(up.key, up);
      const el = document.createElement('div'); el.className = 'up'; box.appendChild(el);
      el.innerHTML = `<p class="up-h"><b>${esc(file.name)}</b><span class="up-st hud">Startet …</span></p>
        <div class="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Upload ${esc(file.name)}"><i></i></div>
        <p class="up-row hud" aria-live="polite"><span class="up-mb">0 MB von ${MB(file.size)}</span><span class="up-eta"></span></p>
        <p class="up-err" hidden></p>
        <div class="up-b"><button type="button" class="btn ghost" data-u="pause">Pause</button><button type="button" class="btn ghost" data-u="go" hidden>Fortsetzen</button><button type="button" class="btn ghost" data-u="again" hidden>Nochmal</button><button type="button" class="btn ghost st-del" data-u="stop">Abbrechen</button></div>`;
      const q = s => el.querySelector(s);
      const bar = q('.up-bar'), st = q('.up-st'), mb = q('.up-mb'), eta = q('.up-eta'), er = q('.up-err');
      const btn = k => q(`[data-u="${k}"]`);
      const show = (...ks) => ['pause', 'go', 'again', 'stop'].forEach(k => { btn(k).hidden = !ks.includes(k); });
      up.on = (ev, d) => {
        if (ev === 'progress') { const p = d.total ? d.sent / d.total : 0; bar.firstChild.style.transform = `scaleX(${p})`; bar.setAttribute('aria-valuenow', Math.round(p * 100)); mb.textContent = `${MB(d.sent)} von ${MB(d.total)}`; eta.textContent = d.bps > 1000 ? `${MB(d.bps)}/s · noch etwa ${tS((d.total - d.sent) / d.bps)}` : ''; }
        else if (ev === 'retry') { st.textContent = `Verbindung hakt, Versuch ${d.n} von 5 …`; }
        else if (ev === 'phase') {
          er.hidden = true;
          if (d === 'start') { st.textContent = 'Verbindet …'; show('stop'); }
          else if (d === 'up') { st.textContent = 'Lädt hoch'; show('pause', 'stop'); }
          else if (d === 'pause') { st.textContent = 'Pausiert'; show('go', 'stop'); }
          else if (d === 'done') { st.textContent = 'Angekommen'; el.classList.add('ok'); bar.firstChild.style.transform = 'scaleX(1)'; show(); eta.textContent = ''; UPS.delete(up.key); resolve(up.done || { job: up.job }); }
          else if (d === 'fehler') { st.textContent = 'Unterbrochen'; show('again', 'stop'); }
        } else if (ev === 'error') { er.hidden = false; er.textContent = d.msg; if (d.restart) show('again', 'stop'); }
      };
      btn('pause').addEventListener('click', () => up.pause());
      btn('go').addEventListener('click', () => up.resume());
      btn('again').addEventListener('click', () => { if (up._needDone) up.retryDone(); else up.start(); });
      btn('stop').addEventListener('click', async () => { await up.discard(); el.remove(); UPS.delete(up.key); resolve(false); });
      addEventListener('online', () => { if (up.state === 'pause' && !up._userPaused) up.resume(); });
      up.start();
    });
  }
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
  /* Unterbrochene Uploads nach neuem Laden der Seite melden */
  async function pendingUploads() {
    const C = await cloud(); const s = C.sessions(), keys = Object.keys(s).filter(k => Date.now() - (s[k].d || 0) < 6 * 864e5);
    const el = $('#snd-pending'); if (!el) return;
    if (!keys.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<b>Unterbrochener Upload:</b> ' + keys.map(k => `${esc(s[k].fn)} (${MB(s[k].sz)})`).join(', ') + '. Wähl dieselbe Datei oben noch einmal und tipp auf „Hochladen“, dann geht es an der Stelle weiter.';
  }

  /* =====================================================================
     Gyroflow (Premium)
     ===================================================================== */
  const jobs = () => lsGet(LS.jobs) || [];
  function saveJobs(j) { lsSet(LS.jobs, j.slice(0, 20)); }
  function gyroUI() {
    const go2 = $('#gy-go'); if (!go2) return;
    const sm = $('#gy-smooth'); if (sm) sm.addEventListener('input', () => { $('#gy-smooth-o').textContent = sm.value + ' %'; fill(sm); });
    ['#gy-clip', '#gy-ganz'].forEach(q => { const e = $(q); if (e) e.addEventListener('change', gyCut); });
    go2.addEventListener('click', async () => {
      if (!isMember()) { lockHit('gyro'); return; }
      if (!apiClips()) return;
      const sel = $('#gy-clip'), c = own().find(x => String(x.id) === (sel && sel.value)) || own()[0];
      if (!c || !c.file) { const m = $('#gy-msg'); if (m) m.textContent = 'Wähl in Schritt 1 zuerst deinen Clip.'; return; }
      interact();
      // Schnitt und Qualität gehen mit: die Station stabilisiert nur von … bis (Sekunden im Original), außer „Ganzes Video“
      const cut = gyRange(c), ganz = !!($('#gy-ganz') || {}).checked, qual = ($('input[name=gy-q]:checked') || {}).value || 'social';
      const opt = { glaettung: +$('#gy-smooth').value, horizont: $('#gy-hor').checked, zoom: ($('input[name=gy-zoom]:checked') || {}).value || 'dynamisch', von: ganz ? 0 : cut[0], bis: ganz ? cut[2] : cut[1], ganz, qual };
      const C = await cloud(); const box = $('#gy-up'); box.hidden = false; box.innerHTML = ''; go2.disabled = true;
      const n = (S.member.n || 'Mitglied').slice(0, 40);
      const res = await runUpload(C, box, c.file, { n, zweck: 'gyroflow', opt, c: S.member.c, t: 'Gyroflow-Auftrag aus dem Clip-Studio' });
      go2.disabled = false;
      if (!res) return;
      const id = res.job;
      if (id) { const j = jobs(); j.unshift({ id, fn: c.file.name, d: Date.now(), st: 'eingegangen', url: '', msg: '', lp: Date.now(), von: opt.von, bis: opt.bis, len: cut[2], ganz, qual }); saveJobs(j); }
      jobsUI(); pollJobs(true);
    });
  }
  /* Schnitt eines Clips für Gyroflow: [von, bis, Länge] in Sekunden im Original. Auto-Schnitt: von der ersten bis zur letzten Szene dieses Clips. */
  function gyRange(c) {
    const L = c.dur || 0; let a = 0, b = L;
    const segs = S.seq && S.seq.segs ? S.seq.segs.filter(s => s.c === c) : [];
    if (segs.length) { a = Math.min(...segs.map(s => s.a)); b = Math.max(...segs.map(s => s.a + s.len)); }
    else if (c.b) { a = c.a || 0; b = c.b; }
    a = Math.max(0, Math.round(a * 100) / 100); b = Math.min(L || b, Math.round(b * 100) / 100); if (!(b > a)) { a = 0; b = L; }
    return [a, b, Math.round(L * 100) / 100];
  }
  function gyCut() {
    const el = $('#gy-cut'); if (!el) return;
    const sel = $('#gy-clip'), c = own().find(x => String(x.id) === (sel && sel.value)) || own().filter(x => x.file)[0];
    if (!c || !c.dur) { el.textContent = ''; return; }
    const [a, b, L] = gyRange(c), all = ($('#gy-ganz') || {}).checked || (a <= .05 && b >= L - .05);
    el.textContent = all ? `Stabilisiert wird das ganze Video (${sec(L)}).` : `Stabilisiert wird nur dein Schnitt: ${tD(a)} bis ${tD(b)} (${sec(b - a)}). Das spart viel Wartezeit und Speicher.`;
  }
  function jobsUI() {
    const list = $('#jobs-list'), box = $('#jobs'); if (!list || !box) return;
    const j = jobs(); box.hidden = !j.length;
    const lbl = { eingegangen: 'Wird stabilisiert …', wartet: 'In der Warteschlange', 'läuft': 'Wird stabilisiert …', fertig: 'Fertig', fehler: 'Fehler' };
    const DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
    list.innerHTML = j.map(x => {
      const whole = x.ganz || (x.len && x.von <= .05 && x.bis >= x.len - .05);
      const what = [x.von != null && x.bis != null && !whole ? `Schnitt ${tD(x.von)} bis ${tD(x.bis)}` : x.von != null ? 'ganzes Video' : '', x.qual === 'original' ? 'volle Auflösung' : x.qual ? 'Social Media' : ''].filter(Boolean).join(' · ');
      return `<li class="job st-${esc(slug(x.st || 'wartet'))}"><span class="job-h"><b>${esc(x.fn)}</b><small>${new Date(x.d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${what ? ' · ' + esc(what) : ''}</small></span>
      <span class="job-st hud">${esc(lbl[x.st] || x.st || 'Wird stabilisiert …')}</span>
      ${x.st === 'fertig' && x.url ? `<a class="btn solid job-dl" href="${esc(x.url)}" target="_blank" rel="noopener" download>${DL}Stabilisiertes Video herunterladen</a>` : x.st === 'fertig' ? '<span class="job-msg">Fertig. Der Link kommt in einer Minute hier an.</span>' : x.st === 'fehler' ? `<span class="job-msg">${esc(x.msg || 'Das Stabilisieren hat nicht geklappt. Der Vorstand ist informiert.')}</span>` : '<span class="job-msg">Dauert je nach Länge 5 bis 30 Minuten, die Seite darf zu. Der Download-Knopf erscheint dann hier unter „Meine Aufträge“.</span>'}
      <button type="button" class="linkbtn job-x" data-job="${esc(x.id)}">Aus der Liste nehmen</button></li>`;
    }).join('');
  }
  let pollT = 0;
  const pollMs = () => (window.FCS_STUDIO_TEST && FCS_STUDIO_TEST.poll) || 60000;
  async function pollJobs(now) {
    clearTimeout(pollT);
    const api = apiClips(); if (!api) return;
    const open = jobs().filter(x => x.st !== 'fertig' && x.st !== 'fehler'); if (!open.length) return;
    if (document.visibilityState !== 'visible') { pollT = setTimeout(() => pollJobs(), pollMs()); return; }
    const C = await cloud(); const j = jobs(); const t = Date.now();
    for (const x of j) {
      if (x.st === 'fertig' || x.st === 'fehler') continue;
      if (t - (x.lp || 0) < pollMs() - 500) continue; // höchstens einmal pro Minute
      x.lp = t; const r = await C.gyroStatus(api, x.id);
      if (r.ok) { x.st = r.st || x.st; x.url = r.url || ''; x.msg = r.msg || ''; }
    }
    saveJobs(j); jobsUI();
    if (j.some(x => x.st !== 'fertig' && x.st !== 'fehler')) pollT = setTimeout(() => pollJobs(), pollMs() + 500);
  }
  function jobsInit() {
    jobsUI();
    const list = $('#jobs-list'); if (list) list.addEventListener('click', e => { const b = e.target.closest('[data-job]'); if (!b) return; saveJobs(jobs().filter(x => x.id !== b.dataset.job)); jobsUI(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollJobs(); else clearTimeout(pollT); });
    pollJobs();
  }
  function gyroClips() {
    const sel = $('#gy-clip'); if (!sel) return;
    const list = own().filter(c => c.file);
    const keep = sel.value;
    sel.innerHTML = list.length ? list.map((c, i) => `<option value="${c.id}">Clip ${i + 1}: ${esc(c.name)}</option>`).join('') : '<option value="">Noch kein Clip gewählt</option>';
    if (keep && list.some(c => String(c.id) === keep)) sel.value = keep;
    sel.disabled = !list.length;
    gyCut();
  }

  /* =====================================================================
     Mitglieder (Premium)
     ===================================================================== */
  function memberUI() {
    S.member = lsGet(LS.member);
    const form = $('#mc-form'), code = $('#mc-code'), msg = $('#mc-msg');
    $$('[data-code-open],#mc-open').forEach(b => b.addEventListener('click', () => openCode()));
    if (code) code.addEventListener('input', () => { const p = code.selectionStart; const v = code.value.toUpperCase(); if (v !== code.value) { code.value = v; try { code.setSelectionRange(p, p); } catch (e) {} } });
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const api = ((D.api || {}).mitglied || '').trim();
      const C = await cloud(); const c = C.normCode(code.value);
      if (!api) { msg.textContent = 'Die Freischaltung ist bald verfügbar.'; return; }
      if (!C.codeOk(c)) { msg.textContent = 'Dieser Code ist zu kurz oder enthält Sonderzeichen. Tipp ihn so ein, wie du ihn vom Vorstand bekommen hast.'; msg.className = 'st-code-msg bad'; code.focus(); return; }
      msg.textContent = 'Wird geprüft …'; msg.className = 'st-code-msg';
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const r = await C.checkMember(api, c); btn.disabled = false;
      if (r.ok && r.bis && r.bis < new Date().getFullYear()) {
        msg.textContent = `Dieser Code galt bis Ende ${r.bis}. Mit deinem neuen Code für ${new Date().getFullYear()} geht Premium sofort wieder.`; msg.className = 'st-code-msg bad';
      } else if (r.ok) {
        S.member = { c, n: r.n, bis: r.bis }; lsSet(LS.member, S.member);
        msg.textContent = ''; form.hidden = true; clubUI(); unlock(true);
      } else { msg.textContent = r.net ? 'Gerade nicht erreichbar, versuch es gleich nochmal.' : 'Dieser Code stimmt nicht. Den Code bekommst du vom Vorstand.'; msg.className = 'st-code-msg bad'; }
    });
    clubUI(); unlock(false);
  }
  function openCode() {
    const f = $('#mc-form'); if (!f) return;
    f.hidden = false; go($('#st-club'), -110);
    setTimeout(() => { const c = $('#mc-code'); if (c) c.focus({ preventScroll: true }); }, 350);
    flash(f);
  }
  function clubUI() {
    const t = $('#st-club-t'), b = $('#st-club-b'), wrapC = $('#st-club'); if (!t || !b) return;
    const m = S.member, exp = m && m.bis && m.bis < new Date().getFullYear();
    wrapC.classList.toggle('on', isMember());
    if (isMember()) {
      t.innerHTML = `<b>Premium aktiv: Hallo ${esc(m.n)}!</b> <span class="cl-l">Auto-Schnitt, eigene Musik, dein Tag und Gyroflow sind freigeschaltet${m.bis ? ` (bis Ende ${m.bis})` : ''}.</span><span class="cl-s">Alles freigeschaltet${m.bis ? ` bis Ende ${m.bis}` : ''}.</span>`;
      b.innerHTML = '<button class="btn ghost" type="button" id="mc-out">Abmelden</button>';
      $('#mc-out').addEventListener('click', () => { S.member = null; lsSet(LS.member, null); clubUI(); unlock(false); });
    } else {
      t.innerHTML = exp ? `<b>Dein Mitgliedscode galt bis Ende ${m.bis}.</b> Mit deinem neuen Code geht Premium sofort wieder.` : '<b>Premium für Mitglieder:</b> <span class="cl-l">Auto-Schnitt im Takt, eigene Musik, dein Piloten-Tag und Gyroflow. Kein GoPro- oder CapCut-Abo nötig und kein Gyroflow am eigenen PC: alles im Mitgliedsbeitrag.</span><span class="cl-s">Auto-Schnitt, Musik, Tag und Gyroflow, ohne Abo.</span>';
      b.innerHTML = '<button class="btn solid" type="button" id="mc-open2">Code eingeben</button><a class="btn ghost" href="mitglied.html">Mitglied werden <span class="arr">→</span></a>';
      $('#mc-open2').addEventListener('click', openCode);
    }
  }
  function unlock(fresh) {
    const m = isMember();
    $$('[data-prem]').forEach(el => { el.classList.toggle('locked', !m); const l = el.querySelector('.prem-lock'); if (l) l.hidden = m; });
    $$('[data-prem-only]').forEach(el => { el.hidden = !m; });
    $$('[data-prem-lock]').forEach(el => { el.hidden = m; });
    if (m && S.member && !S.tag.alias) { S.tag.alias = S.member.n; const a = $('#tag-alias'); if (a) a.value = S.member.n; }
    if (m) tagRender();
    if (!m && S.mode === 'auto' && !S.demo) { S.mode = 'trim'; modeUI(); }
    gyroClips(); renderClips(); rebuild();
    if (fresh) { const card = $('#st-club'); flash(card); if (gs() && !RM) gs().fromTo(card, { scale: .98 }, { scale: 1, duration: .6, ease: 'back.out(3)' }); }
  }
  function lockHit(what) {
    const box = $(`[data-lockmsg="${what}"]`) || $('#st-club');
    const txt = { auto: 'Auto-Schnitt mit mehreren Clips ist für Mitglieder.', musik: 'Eigene Musik ist für Mitglieder.', tag: 'Der eigene Tag ist für Mitglieder.', gyro: 'Gyroflow ist für Mitglieder.' }[what] || '';
    const n = $('#st-lockmsg'); if (n) { n.textContent = txt + ' Gib deinen Mitgliedscode ein oder werde Mitglied.'; n.hidden = false; }
    openCode(); flash(box);
  }

  /* =====================================================================
     Schritte 1 bis 5
     ===================================================================== */
  function visit(n) { S.visited[n] = true; steps(); }
  function setStep(n, noScroll) {
    n = clamp(n, 1, 5); const prev = S.step; S.step = n; visit(n);
    $$('.st-pane').forEach(p => { const on = +p.dataset.pane === n; p.hidden = !on; });
    const pv = $('#st-prev'), nx = $('#st-next');
    if (pv) pv.hidden = n === 1; if (nx) { nx.hidden = n === 5; const l = { 1: 'Weiter: Schneiden', 2: 'Weiter: Musik', 3: 'Weiter: Look und Logo', 4: 'Weiter: Fertig machen' }[n]; if (l) nx.querySelector('span').textContent = l; }
    if (n >= 3 && S.mode === 'auto' && marksAll().length) S.viewSeq = true;
    modeUI(); sbDraw(); tlDraw(); markUI(); steps(); panUI();
    if (n === 3) setTimeout(waveDraw, 30);
    if (n === 5) { sndUI(); gyroClips(); jobsUI(); }
    if (prev !== n && P.on) { stopAll(); if (playMode() === 'seq') P.t = 0; }
    seekView();
    const pan = $('#st-panel');
    if (!noScroll && pan) { if (innerWidth <= 1040) { const r = pan.getBoundingClientRect(); if (r.top < 60 || r.top > innerHeight * .7) go(pan, -120); } }
    const h = $(`.st-pane[data-pane="${n}"] h3`); if (h && !noScroll) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function steps() {
    const bar = $('#st-steps'); if (!bar) return;
    const o = own().length > 0;
    const done = { 1: o, 2: o && S.visited[2], 3: o && (S.music && !S.music.demo || S.visited[3] && S.step > 3), 4: o && (userStickers() > 0 || S.look !== 'natur' || S.st.some(s => s.k === 'tag')), 5: S.done.dl || S.done.sent };
    $$('li', bar).forEach((li, i) => {
      const n = i + 1; li.classList.toggle('done', !!done[n]); li.classList.toggle('now', n === S.step);
      const b = $('button', li); if (b) { if (n === S.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }
    });
  }
  function stepsUI() {
    $$('#st-steps [data-step]').forEach(b => b.addEventListener('click', () => { interact(); setStep(+b.dataset.step); }));
    const pv = $('#st-prev'), nx = $('#st-next');
    if (pv) pv.addEventListener('click', () => setStep(S.step - 1));
    if (nx) nx.addEventListener('click', () => { interact(); setStep(S.step + 1); });
  }
  function flash(el) { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function err(msg, actions) {
    const e = $('#st-err'); if (!e) return;
    if (!msg) { e.hidden = true; e.innerHTML = ''; return; }
    e.innerHTML = `<p style="margin:0">${msg}</p>` + (actions || '') + '<button type="button" class="st-err-x" aria-label="Meldung schließen">×</button>';
    e.hidden = false; const x = $('.st-err-x', e); if (x) x.addEventListener('click', () => err(null));
  }
  function note1(t, lock) { const n = $('#clips-note'); if (!n) return; n.innerHTML = t ? (lock ? ICON.lock : '') + esc(t) + (lock ? ' <button type="button" class="linkbtn" data-code-open2>Code eingeben</button>' : '') : ''; n.hidden = !t; const b = $('[data-code-open2]', n); if (b) b.addEventListener('click', openCode); }

  /* ---------- Steuerelemente ---------- */
  function pick() { const i = $('#st-file'); if (i && !S.busy) i.click(); }
  function controls() {
    const play2 = $('#st-play'), mute = $('#st-mute');
    if (play2) play2.addEventListener('click', () => { interact(); P.on ? pause() : play(); });
    if (mute) mute.addEventListener('click', () => { interact(); S.sound = !S.sound; mute.setAttribute('aria-pressed', S.sound); seekView(); });
    const tap = $('#st-tap'); if (tap) tap.addEventListener('click', () => { tap.hidden = true; play(); S.clips.forEach(c => { if (c.el && c.el.classList.contains('on')) c.el.play().catch(() => {}); }); });
    $$('[data-st-pick]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); pick(); }));
    // Gyroflow-Angebot oben: springt zu Schritt 5 an den Gyroflow-Kasten
    $$('[data-st-gyro]').forEach(b => b.addEventListener('click', () => { interact(); setStep(5, true); setTimeout(() => go($('.gybox') || $('#st-panel'), -110), 60); }));
    // Vorher/nachher zum Umschalten, schaltet sich von selbst um, bis jemand tippt (Selbst-Impuls)
    const gd = $('[data-gy-demo]');
    if (gd) {
      const sw = $('.sx-gy-sw', gd), st = $('.sx-gy-state', gd); let touched = false;
      const set = on => { gd.classList.toggle('on', on); sw.setAttribute('aria-checked', on); sw.setAttribute('aria-label', on ? 'Gyroflow ausschalten' : 'Gyroflow einschalten'); st.textContent = on ? 'Mit Gyroflow' : 'Ohne Gyroflow'; };
      const flip = () => set(!gd.classList.contains('on'));
      gd.addEventListener('click', () => { touched = true; flip(); });
      if (!RM) { const t = setInterval(() => { if (touched) return clearInterval(t); if (gd.getBoundingClientRect().top < innerHeight) flip(); }, 2600); }
    }
    const inp = $('#st-file'); if (inp) inp.addEventListener('change', () => { if (inp.files.length) addFiles(inp.files); inp.value = ''; });
    const dl = $('#st-dl'); if (dl) dl.addEventListener('click', exportVideo);
    const px = $('#prog-x'); if (px) px.addEventListener('click', () => { if (expCtl) expCtl.abort(); });
    const rs = $('#res-send'); if (rs) rs.addEventListener('click', () => { const r = $('input[name=snd-what][value=fertig]'); if (r && !r.disabled) { r.checked = true; sndUI(); } go($('#snd') || $('#snd-off'), -120); });
    const sh = $('#res-share'); if (sh) sh.addEventListener('click', async () => { try { await navigator.share({ files: [S.result], title: 'Mein Clip · Flight Club Saar', text: '#flightclubsaar @flightclubsaar' }); } catch (e) {} });
    const rdl = $('#res-dl'); if (rdl) rdl.addEventListener('click', () => { S.done.dl = true; steps(); });
    const da = $('#demo-auto'); if (da) da.addEventListener('click', demoAuto);
    addEventListener('beforeunload', e => { if (S.busy || [...UPS.values()].some(u => u.state === 'up' || u.state === 'start')) { e.preventDefault(); e.returnValue = ''; } });
  }
  function copyTag() {
    const b = $('#tag-copy'), t = $('#tag-txt'); if (!b || !t) return;
    b.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(t.textContent); ok = true; } catch (e) { const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { ok = document.execCommand('copy'); } catch (er) {} }
      b.textContent = ok ? 'Kopiert' : 'Markiert, jetzt kopieren'; b.classList.toggle('ok', ok);
      setTimeout(() => { b.textContent = 'Kopieren'; b.classList.remove('ok'); }, 2200);
    });
  }

  /* =====================================================================
     Beispiel und Selbst-Impuls
     ===================================================================== */
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
  function clearDemo() {
    S.clips.filter(c => c.demo).forEach(c => removeClip(c, true));
    S.st.filter(s => s.demo).forEach(removeSt); if (S.osdDemo) setOSD(false); S.osdDemo = false;
    if (S.music && S.music.demo) { S.music.el.pause(); S.music.el.remove(); URL.revokeObjectURL(S.music.url); S.music = null; const mb = $('#mu-box'); if (mb) mb.hidden = true; S.origVol = 1; }
    S.demo = false; S.viewSeq = false; S.trOv = {};
    if (S.mode === 'auto' && !isMember()) S.mode = 'trim';
    editor(); modeUI();
  }
  function resetToDemo() {
    S.demo = true; S.mode = 'trim'; S.viewSeq = false;
    const tag = $('#st-tag'); if (tag) { tag.textContent = 'BEISPIEL'; tag.classList.remove('own'); }
    const drop = $('#st-drop'); if (drop) drop.classList.remove('gone');
    addDemoClips([DEMO[0]]); modeUI(); goState(); steps(); renderClips();
  }
  function addDemoClips(list) {
    list.forEach(d => { const c = newClip({ demo: true, src: d.src, name: d.n, poster: d.poster }); S.clips.push(c); loadClip(c).then(() => { if (d.marks && S.mode === 'auto') { c.marks = d.marks.map(t => ({ id: 'd' + (++S.uid), t0: Math.max(0, Math.min(c.dur - 4, t)), len: Math.min(4, c.dur) })); rebuild(); tlDraw(); renderClips(); } }); });
    select(0);
  }
  /* Vorführung Auto-Schnitt (auch ohne Mitgliedschaft): Beispielclips, markierte Stellen, Demo-Beat, Stil Action */
  async function demoAuto() {
    interact(); if (S.busy) return;
    if (own().length) { if (!confirm('Die Vorführung ersetzt deine Clips in der Vorschau. Weiter?')) return; own().forEach(c => removeClip(c, true)); }
    S.clips.forEach(c => removeClip(c, true)); S.demo = true; S.mode = 'auto'; S.style = 'action'; S.trOv = {};
    const r = $('input[name=st-style][value=action]'); if (r) r.checked = true;
    const btn = $('#demo-auto'); if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Wird vorbereitet …'; }
    addDemoClips(DEMO);
    try { const f = await demoBeat(); await loadMusic(f, true); } catch (e) {}
    for (let i = 0; i < 60 && S.clips.some(c => c.state === 'laden'); i++) await new Promise(r2 => setTimeout(r2, 100));
    S.clips.forEach((c, i) => { const d = DEMO[i]; if (d && c.dur) c.marks = d.marks.map(t => ({ id: 'd' + (++S.uid), t0: clamp(t, 0, Math.max(0, c.dur - 4)), len: Math.min(4, c.dur) })); });
    if (!S.lookTouched) setLook('kraeftig', true);
    S.viewSeq = true; modeUI(); rebuild(); setStep(2, true); S.viewSeq = true; modeUI(); sbDraw(); P.t = 0; play();
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Vorführung nochmal'; }
    if (!inView(stage)) go(wrap, -110);
    const n = $('#demo-note'); if (n) n.hidden = false;
  }
  function demo() {
    if (!S.demo || S.interacted) return;
    play();
    const s2 = $('#st-steps li:nth-child(4)');
    if (RM || !gs()) { addSt('logo', .8, .2, { r: -6, demo: true }); addSt('ayedo', .24, .2, { demo: true }); setOSD(true); S.osdDemo = true; selectSt(null); return; }
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
      if (S.interacted || !P.visible) return;
      const b = $('#clips-add') || $('[data-st-pick]'); if (!b) return;
      const br = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      if (br.top > innerHeight || br.bottom < 0 || sr.bottom < 0 || sr.top > innerHeight) return;
      b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge');
    };
    run(); hintLoop = setInterval(run, 6000);
  }

  /* =====================================================================
     Start
     ===================================================================== */
  async function loadLut(gl) {
    // Offizielle DJI-LUT (D-Log M → Rec.709): wird geladen, sobald in data.js studio.lut auf eine .cube-Datei zeigt; sonst rechnet der Shader die Kurve nach
    const url = (D.studio || {}).lut;
    if (!gl || !gl.v2 || !url || loadLut.txt === null) return;
    try {
      if (loadLut.txt === undefined) { const r = await fetch(url, { cache: 'force-cache' }); loadLut.txt = r.ok ? await r.text() : null; }
      if (loadLut.txt) gl.lut(loadLut.txt);
    } catch (e) { loadLut.txt = null; }
  }
  let GLM = null;
  async function initGL() {
    try {
      GLM = await glm();
      window.__fcsTrans = GLM.TRANS; window.__fcsLooks = GLM.LOOKS; window.__fcsCssLook = GLM.cssLook;
      rebuild();
      // WebGL im Leerlauf vorbereiten, nicht erst beim ersten Look oder Übergang
      const idle = window.requestIdleCallback || (f => setTimeout(f, 400));
      idle(() => { needGL(); });
    } catch (e) { GLM = null; console.info('Clip-Studio: WebGL-Modul nicht geladen', e && e.message); }
  }
  /* WebGL erst anlegen, wenn ein Look oder Übergang es braucht (spart Akku und Speicher) */
  function needGL() {
    if (GL || !GLM || needGL.tried || glOff) return GL;
    needGL.tried = true; GL = GLM.compositor(glc);
    if (GL.ok) { loadLut(GL); warmGL(GL); } else GL = null;
    return GL;
  }
  /* Shader und Texturen gleich beim Laden vorbereiten (ein Probebild je Übergang und Look), damit der erste Übergang nicht ruckelt */
  function warmGL(g) {
    try {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d');
      x.fillStyle = '#345'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#fc6'; x.fillRect(4, 4, 8, 8);
      const w0 = g.canvas.width, h0 = g.canvas.height;
      Object.keys(GLM.TRANS).forEach((t, i) => g.render({ A: c, B: c, tr: { type: t, p: .5, seed: i }, look: { id: Object.keys(GLM.LOOKS)[i % 6], k: 1 }, fade: 0 }));
      g.luma(); g.size(w0, h0);
    } catch (e) {}
  }
  /* Schutz vor Auslesen (zum Beispiel Samsung Internet „Smart Anti-Tracking“, Fingerprinting-Schutz): ein bekanntes Muster zeichnen und
     zurücklesen (2D und WebGL). Stimmt es nicht, sagen alle Pixel-Prüfungen nichts aus: dann keine Leer-Prüfungen, kein WebGL,
     Looks per CSS und Export in Echtzeit über MediaRecorder. */
  function readLockTest() {
    const T = window.FCS_STUDIO_TEST || {};
    const want = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255], [32, 96, 160], [0, 0, 0]];
    let ok2d = false, okGL = true;
    try {
      const c = document.createElement('canvas'); c.width = 12; c.height = 8; const x = c.getContext('2d', { willReadFrequently: true });
      want.forEach((w, i) => { x.fillStyle = `rgb(${w})`; x.fillRect((i % 3) * 4, Math.floor(i / 3) * 4, 4, 4); });
      const d = x.getImageData(0, 0, 12, 8).data; ok2d = true;
      want.forEach((w, i) => { const o = ((Math.floor(i / 3) * 4 + 2) * 12 + (i % 3) * 4 + 2) * 4; for (let k = 0; k < 3; k++) if (Math.abs(d[o + k] - w[k]) > 1) ok2d = false; });
    } catch (e) { ok2d = false; }
    try {
      const c = document.createElement('canvas'); c.width = 4; c.height = 4; const g = c.getContext('webgl', { preserveDrawingBuffer: true });
      if (g) { g.clearColor(.2, .6, .8, 1); g.clear(g.COLOR_BUFFER_BIT); const px = new Uint8Array(4); g.readPixels(1, 1, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); okGL = Math.abs(px[0] - 51) <= 2 && Math.abs(px[1] - 153) <= 2 && Math.abs(px[2] - 204) <= 2; const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    } catch (e) {}
    S.locked = !ok2d || !okGL || !!T.forceLocked;
    if (S.locked) { glOff = true; console.info('Clip-Studio: Dieser Browser verfälscht ausgelesene Bilder (Schutz vor Fingerprinting). Looks per CSS, Export in Echtzeit, keine Pixel-Prüfungen.', { ok2d, okGL }); lockNote(); }
  }
  const isSamsung = () => /SamsungBrowser/i.test(navigator.userAgent);
  function chromeIntent() { const u = new URL(location.href); return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`; }
  function lockNote() {
    const why = $('#st-why'); if (!why || !S.locked) return;
    const bn = isSamsung() ? 'Samsung Internet' : 'Dein Browser';
    why.classList.remove('bad'); why.classList.add('lock');
    why.innerHTML = `${esc(bn)} schützt Bilder vor dem Auslesen. Das Studio nimmt dein Video deshalb in Echtzeit auf (dauert so lange wie das Video). Wird es leer, öffne die Seite in Chrome oder schalte in ${isSamsung() ? 'Samsung Internet unter Einstellungen › Datenschutz „Smart Anti-Tracking“ beziehungsweise den Fingerprinting-Schutz' : 'den Einstellungen den Fingerprinting-Schutz'} für diese Seite aus.${/Android/i.test(navigator.userAgent) ? ` <a class="btn ghost" id="st-chrome" href="${esc(chromeIntent())}">In Chrome öffnen</a>` : ''}`;
  }
  function studio() {
    stage = $('#st-stage'); wrap = $('#st-wrap'); layer = $('#st-layer'); vids = $('#st-vids'); ovc = $('#st-cv'); glc = $('#st-gl');
    if (!stage || !wrap || !layer || !vids || !ovc || !glc) return;
    octx = ovc.getContext('2d');
    window.__fcsTrans = { schnitt: { n: 'Schnitt', d: 0 }, blende: { n: 'Blende', d: .7 }, blitz: { n: 'Blitz', d: .32 }, zoom: { n: 'Zoom', d: .42 }, wisch: { n: 'Wisch', d: .5 }, whip: { n: 'Whip-Pan', d: .36 }, glitch: { n: 'Glitch', d: .3 } };
    loadImgs(); leaveUI(); buildTray(); trayDrag(); gestures(); keys(); timeline(); controls(); clipsUI(); autoUI(); sbUI(); musicUI(); lookUI(); stickerControls(); tagUI(); sendUI(); gyroUI(); stepsUI(); memberUI(); jobsInit();
    readLockTest();
    initGL();
    S.aspect = 16 / 9; layout();
    let rq = 0, lastW = innerWidth; addEventListener('resize', () => { if (!FINE && innerWidth === lastW) return; lastW = innerWidth; cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { layout(); strip(); sbDraw(); waveDraw(); }); });
    if (document.fonts) { document.fonts.load('400 40px "Bebas Neue"').catch(() => {}); document.fonts.load('600 20px "Chakra Petch"').catch(() => {}); }
    new IntersectionObserver(es => {
      P.visible = es[0].isIntersecting;
      if (P.visible) { if (!P.raf) P.raf = requestAnimationFrame(frame); if (P.on) play(); }
      else { cancelAnimationFrame(P.raf); P.raf = 0; stopAll(); }
    }, { rootMargin: '120px 0px' }).observe(wrap);
    resetToDemo();
    const st = $('#st');
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: st, start: 'top 85%', once: true, onEnter: demo }); else demo();
    ['pointerdown', 'keydown'].forEach(ev => $('#studio').addEventListener(ev, e => { if (e.isTrusted && !e.target.closest('#demo-auto')) interact(); }, true));
    setStep(1, true); goState(); steps(); sumLine(); pendingUploads(); syncUp();
    // Diagnose für Tests auf echten Geräten: in der Konsole  await FCS.studioStatus()  aufrufen
    if (window.FCS) FCS.studioStatus = async () => {
      const WEG = { draw: 'WebCodecs direkt (Grafikchip)', cpu: 'WebCodecs über den Arbeitsspeicher (sicherer Weg)', copy: 'WebCodecs über RGBA-Kopie in sRGB (sicherer Weg)', raw: 'WebCodecs-Rohdaten, eigene Umrechnung inklusive HDR → SDR (sicherster Weg)', sw: 'WebCodecs mit Software-Dekoder (sicherer Weg)', element: 'Echtzeit über das Video-Element' };
      const mx = a => a ? a.map(l => l ? `${Math.round(l.max)}${nb(l) ? '' : (l.max >= 8 ? ' einfarbig' : ' schwarz')}` : '-').join(' / ') : 'nicht getestet';
      const clips = S.clips.map((c, i) => ({ nr: i + 1, datei: c.name, format: c.info && c.info.ok ? fmtLine(c.info) : (c.info && c.info.err) || 'Beispielclip', zustand: { ok: 'spielt', nicht: 'Browser spielt die Videospur nicht', nurExport: 'nur Export (Standbild-Vorschau)', laden: 'lädt' }[c.state] || c.state,
        selbsttest_hellste_pixel: `Element ${mx(c.elSamples)} · Grafikchip ${mx(c.lum.draw)} · Arbeitsspeicher ${mx(c.lum.cpu)} · Kopie ${mx(c.lum.copy)} · Rohdaten ${mx(c.lum.raw)} · Software ${mx(c.lum.sw)}`, bild: c.ref === true ? 'Bild vorhanden' : c.ref === false ? 'nur leere Fläche, Export gesperrt' : 'noch offen',
        exportweg: WEG[c.mode] || 'keiner (Export in diesem Browser nicht möglich)', webgl_vorschau: c.glBad ? 'aus, CSS-Ersatz' : 'an' }));
      let enc = {};
      try { const M = await media(); const { W, H } = outDims(), fps = outFps(), br = bitrate(W, H, fps); enc = { ausgabe: `${W} × ${H}, ${fps} fps, ${(br / 1e6).toFixed(0)} Mbit/s`, video_encoder: await (async () => { const e = await M.pickEncoder([[W, H, br], [even(W * 1080 / Math.min(W, H)), even(H * 1080 / Math.min(W, H)), br]], fps); return e ? `${e.vc} ${e.W} × ${e.H}` : 'keiner für diese Größe'; })(), audio_encoder: (await M.audioCodec()) || 'keiner (dann PCM in MOV)' }; } catch (e) { enc = { fehler: String(e && e.message) }; }
      const out = { clips, ...enc, webgl: GL ? (GL.ok ? (GL.v2 ? 'WebGL 2' : 'WebGL 1') : 'nicht verfügbar') : 'noch nicht gebraucht', mitglied: isMember() ? S.member.n : 'nein', browser: navigator.userAgent };
      try { console.table(clips); } catch (e) {}
      return out;
    };
    if (window.FCS_STUDIO_TEST) window.__fcsStudio = { S, P, rebuild, setStep, addFiles, loadMusic, exportVideo, select, seqAt, demoAuto, outDims, setLook, setFmt, play, pause };
  }
  function syncUp() { const s = $('#snd'); if (s) sndUI(); gyroClips(); workMode(); }
  /* Arbeitsmodus: mit eigenem Clip bleibt man im Studio (Schritt-Leiste oben, Ratgeber ausgeblendet) */
  function workMode() {
    const on = !S.left && own().some(c => c.file), was = document.body.classList.contains('st-work');
    if (on === was) return;
    document.body.classList.toggle('st-work', on);
    const lv = $('#st-leave'); if (lv) lv.hidden = !on;
    if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  function leaveUI() {
    const b = $('#st-leave-b');
    if (b) b.addEventListener('click', () => { S.left = true; pause(); workMode(); const r = $('#ratgeber'); if (r) requestAnimationFrame(() => go(r)); });
    // Ein Link in den ausgeblendeten Ratgeber (zum Beispiel „Musik“, „Posten“) beendet den Arbeitsmodus zuerst
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || !document.body.classList.contains('st-work')) return;
      let t = null; try { t = $(a.getAttribute('href')); } catch (er) {}
      if (t && !t.closest('#studio') && t.closest('main section')) { S.left = true; workMode(); }
    }, true);
  }

  function init() {
    if (!$('#studio')) return;
    D = (window.FCS && FCS.data) || {}; RM = window.FCS ? FCS.rm : matchMedia('(prefers-reduced-motion: reduce)').matches; FINE = window.FCS ? FCS.fine : matchMedia('(hover:hover) and (pointer:fine)').matches;
    [studio, copyTag].forEach(fn => { try { fn(); } catch (e) { console.error('Clip-Studio:', fn.name, e); } });
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
