/* Flight Club Saar – Betaflight & Löten
   Klassisches Skript (kein Modul). GSAP und Plugins kommen global aus fcs.js, wir warten auf „fcs:ready“.
   Alle Bilder sind selbst gezeichnete Erklär-Grafiken. Videos laden erst nach Klick (youtube-nocookie).
   Endlos-Animationen laufen nur, solange ihr Abschnitt zu sehen ist. */
(function () {
  'use strict';
  const D = document, W = window;
  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const has = (n) => typeof W[n] !== 'undefined';
  const GS = () => has('gsap');
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs = {}, parent) => { const n = D.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const run = (name, fn) => { try { fn(); } catch (e) { if (W.console) console.info('Werkstatt: ' + name, e); } };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const fmt = (n) => Math.round(n).toLocaleString('de-DE');

  function whenReady(fn) {
    let done = false;
    const go = () => {
      if (done) return; done = true;
      if (GS()) { const p = ['ScrollTrigger', 'DrawSVGPlugin', 'Draggable', 'MotionPathPlugin'].filter(has).map(n => W[n]); if (p.length) gsap.registerPlugin(...p); }
      fn();
    };
    D.addEventListener('fcs:ready', go, { once: true });
    if (D.readyState === 'complete') setTimeout(go, 0); else W.addEventListener('load', () => setTimeout(go, 0), { once: true });
  }
  function firstSight(target, fn, threshold = 0.35) {
    if (!target) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
    io.observe(target);
  }
  function makeHint(node) {
    let gone = false;
    return {
      show() { if (node && !gone) node.classList.add('on'); },
      done() { if (!node || gone) return; gone = true; node.classList.remove('on'); node.classList.add('gone'); },
      get gone() { return gone; }
    };
  }
  /* rAF-Schleife, die nur läuft, solange das Element zu sehen ist. fn(dt) gibt false zurück, wenn sie ruhen darf. */
  function ticker(el, fn) {
    let vis = false, raf = 0, last = 0, on = true;
    const loop = (now) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
      const keep = fn(dt, now);
      if (vis && on && keep !== false) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (vis && on && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const io = new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; if (vis) kick(); }, { rootMargin: '80px 0px' });
    io.observe(el);
    return { kick, set active(v) { on = v; if (v) kick(); }, get vis() { return vis; } };
  }
  /* Tweens (GSAP), die außerhalb des Bildschirms pausieren */
  function pauseWith(el, tweens) {
    const io = new IntersectionObserver(es => { const v = es[es.length - 1].isIntersecting; tweens.forEach(t => t && (v ? t.resume() : t.pause())); }, { rootMargin: '60px 0px' });
    io.observe(el);
  }
  function pauseOffscreen() {
    const secs = $$('main > section'); if (!secs.length) return;
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '80px 0px' });
    secs.forEach(s => io.observe(s));
  }

  /* ---------- Stick (Funke, Modus 2) ---------- */
  function makeStick(el, opt) {
    const o = Object.assign({ springX: true, springY: true, x: 0, y: 0, onMove: null, onUser: null }, opt);
    const knob = $('.ws-knob', el);
    const st = { x: o.x, y: o.y };
    let drag = false, pid = null, tw = null, keyT = 0;
    const rad = () => Math.max(10, el.clientWidth / 2 - knob.offsetWidth / 2 - 6);
    const render = () => { const r = rad(); knob.style.transform = `translate(${(st.x * r).toFixed(1)}px,${(-st.y * r).toFixed(1)}px)`; };
    function set(x, y, user) { st.x = clamp(x, -1, 1); st.y = clamp(y, -1, 1); render(); if (o.onMove) o.onMove(st, !!user); }
    function kill() { if (tw) { tw.kill(); tw = null; } }
    function tweenTo(x, y, dur = 0.5, ease = 'power2.inOut') {
      kill();
      if (!GS() || RM) { set(x, y, false); return null; }
      const p = { x: st.x, y: st.y };
      tw = gsap.to(p, { x, y, duration: dur, ease, onUpdate: () => set(p.x, p.y, false) });
      return tw;
    }
    function release() { tweenTo(o.springX ? 0 : st.x, o.springY ? 0 : st.y, 0.45, 'elastic.out(1,.55)'); }
    function fromEvent(e) {
      const b = el.getBoundingClientRect(), r = rad();
      set((e.clientX - (b.left + b.width / 2)) / r, -(e.clientY - (b.top + b.height / 2)) / r, true);
    }
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); kill(); drag = true; pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
      el.classList.add('grab'); fromEvent(e); if (o.onUser) o.onUser();
    });
    el.addEventListener('pointermove', e => { if (drag && e.pointerId === pid) fromEvent(e); });
    const end = () => { if (!drag) return; drag = false; el.classList.remove('grab'); release(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    el.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!k) return;
      e.preventDefault(); kill(); if (o.onUser) o.onUser();
      set(st.x + k[0] * 0.25, st.y + k[1] * 0.25, true);
      clearTimeout(keyT); keyT = setTimeout(release, 900);
    });
    W.addEventListener('resize', render, { passive: true });
    render();
    return { set, tweenTo, release, st, el };
  }

  /* Betaflight-Rates. Formeln wie in der Firmware (src/main/fc/rc.c, Version 2026.6.2) */
  const RATE_LIMIT = 1998;
  function rateActual(s, center, max, expo) {
    const a = Math.abs(s);
    const e = a * (Math.pow(s, 5) * expo + s * (1 - expo));
    return clamp(s * center + Math.max(0, max - center) * e, -RATE_LIMIT, RATE_LIMIT);
  }
  function rateBF(s, rc, sr, ex) {
    const a = Math.abs(s);
    if (ex) s = s * a * a * a * ex + s * (1 - ex);
    if (rc > 2) rc += 14.54 * (rc - 2);
    let r = 200 * rc * s;
    if (sr) r *= 1 / clamp(1 - a * sr, 0.01, 1);
    return clamp(r, -RATE_LIMIT, RATE_LIMIT);
  }

  /* =====================================================================
     Seitenkopf
     ===================================================================== */
  function kopf() {
    const head = $('.ws-head'), art = $('.ws-head-art', head); if (!art) return;
    if (!GS() || RM) return;
    const trs = $$('.ws-ha-tr path', art);
    if (has('DrawSVGPlugin')) gsap.from(trs, { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut', stagger: 0.08, delay: 0.3 });
    gsap.from($('.ws-ha-board', art), { opacity: 0, scale: 0.92, rotation: -4, duration: 1.4, ease: 'expo.out', transformOrigin: '50% 50%' });
    gsap.from($('.ws-ha-iron', art), { x: -120, y: -120, opacity: 0, duration: 1.4, ease: 'expo.out', delay: 0.5 });
    const tweens = [];
    if (has('MotionPathPlugin')) {
      const dots = $$('.ws-ha-pulse circle', art), paths = ['#ws-tr3', '#ws-tr4', '#ws-tr7'];
      dots.forEach((d, i) => {
        tweens.push(gsap.to(d, { motionPath: { path: paths[i], align: paths[i], alignOrigin: [0.5, 0.5] }, duration: 1.6 + i * 0.4, repeat: -1, ease: 'none', delay: 1.2 + i * 0.5 }));
      });
    } else $$('.ws-ha-pulse circle', art).forEach(d => d.remove());
    pauseWith(head, tweens);
    if (FINE) {
      const qx = gsap.quickTo(art, 'rotationY', { duration: 0.8, ease: 'power3' }), qy = gsap.quickTo(art, 'rotationX', { duration: 0.8, ease: 'power3' });
      gsap.set(art, { transformPerspective: 900 });
      head.addEventListener('pointermove', e => { const r = head.getBoundingClientRect(); qx(((e.clientX - r.left) / r.width - 0.5) * 14); qy(-((e.clientY - r.top) / r.height - 0.5) * 10); }, { passive: true });
      head.addEventListener('pointerleave', () => { qx(0); qy(0); });
    }
  }

  /* =====================================================================
     01 · Was ist Betaflight? Signalfluss mit Sticks
     ===================================================================== */
  function signalfluss() {
    const sec = $('#betaflight'); if (!sec) return;
    const panel = $('.ws-flow', sec), svg = $('.ws-flow-svg', sec);
    const nodes = ['.ws-n-radio', '.ws-n-rx', '.ws-n-fc', '.ws-n-esc', '.ws-n-mot'].map(s => $(s, panel));
    const chs = $$('.ws-ch i', panel), escs = $$('.ws-esc span', panel);
    const props = $$('.ws-q-prop', panel), quad = $('.ws-quad', panel);
    const spEl = $('[data-fc-sp]', panel), gyEl = $('[data-fc-gy]', panel);
    const canvas = $('.ws-plot', panel), ctx = canvas.getContext('2d');
    const hint = makeHint($('.ws-hint-stick', sec));
    const IN = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
    let user = false, demo = null;
    const onUser = () => { user = true; hint.done(); if (demo) { demo.kill(); demo = null; } tk.kick(); };
    const L = makeStick($('[data-stick=l]', panel), { springY: false, y: -1, onMove: (s) => { IN.thr = (s.y + 1) / 2; IN.yaw = s.x; tk.kick(); }, onUser });
    const R = makeStick($('[data-stick=r]', panel), { onMove: (s) => { IN.roll = s.x; IN.pitch = s.y; tk.kick(); }, onUser });

    /* Leitungen zwischen den Kästen */
    let links = [];
    function layout() {
      const pr = panel.getBoundingClientRect();
      const rr = nodes.map(n => { const b = n.getBoundingClientRect(); return { l: b.left - pr.left, t: b.top - pr.top, r: b.right - pr.left, b: b.bottom - pr.top, w: b.width, h: b.height }; });
      svg.innerHTML = ''; links = [];
      for (let i = 0; i < rr.length - 1; i++) {
        const a = rr[i], b = rr[i + 1];
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        let d;
        if (ox > 24) {
          const x = (Math.max(a.l, b.l) + Math.min(a.r, b.r)) / 2;
          d = b.t >= a.b - 2 ? `M${x} ${a.b}L${x} ${b.t}` : `M${x} ${a.t}L${x} ${b.b}`;
        } else {
          const y1 = a.t + a.h / 2, y2 = b.t + b.h / 2;
          const x1 = b.l >= a.r - 2 ? a.r : a.l, x2 = b.l >= a.r - 2 ? b.l : b.r, xm = (x1 + x2) / 2;
          d = `M${x1} ${y1}C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}`;
        }
        sv('path', { d, class: 'ws-fl-base' }, svg);
        const hot = sv('path', { d, class: 'ws-fl-hot' }, svg);
        const dots = [0, 0.5].map(o => ({ el: sv('circle', { r: 3.6, class: 'ws-fl-dot' }, svg), o }));
        links.push({ hot, len: hot.getTotalLength(), dots });
      }
      sizeCanvas();
    }
    let cw = 240, ch = 70, dpr = 1;
    function sizeCanvas() {
      dpr = Math.min(2, W.devicePixelRatio || 1);
      cw = Math.max(120, canvas.clientWidth); ch = Math.round(cw * 70 / 240);
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }

    /* Physik (vereinfacht): Soll aus den Standard-Rates (Actual 70/670/0), Gyro folgt mit Verzögerung */
    const buf = { sp: new Float32Array(140), gy: new Float32Array(140), i: 0 };
    const S = { sp: [0, 0, 0], gy: [0, 0, 0], act: 0, ph: 0, ang: [0, 0, 0, 0], txt: 0 };
    function step(dt) {
      const sticks = [IN.roll, IN.pitch, IN.yaw];
      for (let a = 0; a < 3; a++) {
        S.sp[a] = rateActual(sticks[a], 70, 670, 0);
        const k = 1 - Math.exp(-dt * (a === 2 ? 7 : 11));
        S.gy[a] += (S.sp[a] - S.gy[a]) * k + (Math.random() - 0.5) * (6 + IN.thr * 18);
      }
      const act = clamp(Math.abs(IN.roll) + Math.abs(IN.pitch) + Math.abs(IN.yaw) * 0.7 + IN.thr * 0.7, 0, 1);
      S.act += (act - S.act) * (1 - Math.exp(-dt * 6));
      // Mischer Quad X wie Betaflight: 1 hinten rechts, 2 vorne rechts, 3 hinten links, 4 vorne links
      const u = S.sp.map((sp, a) => clamp((S.gy[a] + 1.6 * (sp - S.gy[a])) / 670, -1, 1) * 0.3);
      const r = u[0], p = u[1], y = u[2] * 0.7, base = 0.055 + IN.thr * 0.8;
      const m = [base - r + p - y, base - r - p + y, base + r + p + y, base + r - p - y].map(v => clamp(v, 0.055, 1));
      return m;
    }
    function draw(dt) {
      const m = step(dt);
      // Kanäle (1000 bis 2000)
      const cv = [(IN.roll + 1) / 2, (IN.pitch + 1) / 2, IN.thr, (IN.yaw + 1) / 2];
      chs.forEach((c, i) => c.style.setProperty('--v', cv[i].toFixed(3)));
      // Propeller
      for (let i = 0; i < 4; i++) {
        S.ang[i] = (S.ang[i] + (i === 1 || i === 2 ? -1 : 1) * (240 + 2600 * m[i]) * dt) % 360;
        props[i].setAttribute('transform', `rotate(${S.ang[i].toFixed(1)})`);
      }
      quad.style.transform = `rotateX(${(S.gy[1] / 670 * 30).toFixed(2)}deg) rotateY(${(S.gy[0] / 670 * 30).toFixed(2)}deg) rotateZ(${(S.gy[2] / 670 * 12).toFixed(2)}deg)`;
      // Leitungen und Impulse
      S.ph += dt * (0.25 + 1.5 * S.act);
      const op = (0.12 + 0.88 * S.act).toFixed(3);
      links.forEach((ln, i) => {
        ln.hot.style.opacity = op;
        ln.dots.forEach(d => {
          const t = ((S.ph - i * 0.18 + d.o) % 1 + 1) % 1;
          const pt = ln.hot.getPointAtLength(t * ln.len);
          d.el.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
          d.el.style.opacity = (0.35 + 0.65 * S.act) * Math.sin(Math.PI * t);
        });
      });
      nodes.forEach(n => n.classList.toggle('hot', S.act > 0.12));
      // Plot: Achse mit dem größten Ausschlag
      const ax = Math.abs(S.sp[1]) > Math.abs(S.sp[0]) ? 1 : 0;
      buf.sp[buf.i] = S.sp[ax]; buf.gy[buf.i] = S.gy[ax]; buf.i = (buf.i + 1) % buf.sp.length;
      plot();
      S.txt += dt;
      if (S.txt > 0.12) {
        S.txt = 0;
        spEl.textContent = fmt(S.sp[ax]); gyEl.textContent = fmt(S.gy[ax]);
        escs.forEach((e, i) => { e.textContent = Math.round(m[i] * 100); });
      }
      return true;
    }
    function plot() {
      const n = buf.sp.length, w = cw * dpr, h = ch * dpr;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(158,196,255,.15)'; ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      const line = (arr, col, lw) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw * dpr; ctx.beginPath();
        for (let k = 0; k < n; k++) { const v = arr[(buf.i + k) % n]; const x = k / (n - 1) * w, y = h / 2 - v / 700 * (h / 2 - 4 * dpr); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      };
      line(buf.sp, '#ffb020', 2); line(buf.gy, '#3fe0ff', 1.6);
    }
    const tk = ticker(panel, draw);
    let rt = 0;
    const relayout = () => { clearTimeout(rt); rt = setTimeout(layout, 80); };
    if ('ResizeObserver' in W) new ResizeObserver(relayout).observe(panel); else W.addEventListener('resize', relayout);
    layout();
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(layout);

    // Selbst-Impuls: einmal vormachen, was man tun kann
    firstSight(panel, () => {
      if (user) return;
      if (!GS() || RM) { hint.show(); return; }
      demo = gsap.timeline({ delay: 0.4, onComplete: () => { demo = null; hint.show(); } })
        .add(() => L.tweenTo(0, -0.35, 0.7))
        .add(() => R.tweenTo(0.85, 0, 0.6), '+=0.5')
        .add(() => R.tweenTo(0, 0, 0.5), '+=0.8')
        .add(() => R.tweenTo(0, 0.75, 0.6), '+=0.4')
        .add(() => R.tweenTo(0, 0, 0.5), '+=0.8')
        .add(() => L.tweenTo(0.7, -0.35, 0.5), '+=0.3')
        .add(() => L.tweenTo(0, -1, 0.7), '+=0.7')
        .add(() => {}, '+=0.8');
    }, 0.4);
  }

  /* =====================================================================
     02 · Version und Flashen
     ===================================================================== */
  const VP_TXT = {
    '': 'Seit Version 2025.12 zählt Betaflight nach Kalender. Geplant sind zwei große Versionen pro Jahr, im Juni und im Dezember. 2025.12 ist der Nachfolger von 4.5.',
    y: '2026 ist das Jahr, in dem die Version erschienen ist.',
    m: '6 steht für den Monat Juni. Die großen Versionen sind für Juni und Dezember geplant.',
    p: '2 ist die Patch-Nummer. Patches erscheinen zwischen den großen Versionen und beheben vor allem Fehler.'
  };
  function version() {
    const sec = $('#version'); if (!sec) return;
    const card = $('.ws-vcard', sec), txt = $('[data-vp-txt]', card);
    const btns = $$('[data-vp-b]', card), parts = $$('[data-vp]', card);
    let sel = '', touched = false;
    function setSel(k, anim) {
      sel = k;
      btns.forEach(b => { const on = b.dataset.vpB === sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      parts.forEach(p => p.classList.toggle('hl', p.dataset.vp === sel));
      txt.textContent = VP_TXT[sel];
      if (sel && anim && GS() && !RM) gsap.fromTo(parts.find(p => p.dataset.vp === sel), { y: -10 }, { y: 0, duration: 0.6, ease: 'back.out(3)' });
    }
    // Erster Tipp wählt immer aus (auch wenn der Selbst-Impuls den Teil gerade markiert hat), danach schaltet ein Tipp um
    btns.forEach(b => { b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => { const was = touched; touched = true; setSel(was && sel === b.dataset.vpB ? '' : b.dataset.vpB, true); }); });
    firstSight(card, () => {
      if (!GS() || RM) return;
      gsap.from($$('.ws-vline li', card), { opacity: 0, x: -16, stagger: 0.15, duration: 0.6, ease: 'expo.out' });
      // Ziffern einmal von alt nach neu „hochzählen“
      const y = parts[0], m = parts[1], p = parts[2];
      const o = { v: 0 };
      gsap.to(o, { v: 1, duration: 1.1, ease: 'power2.out', onUpdate: () => { const k = o.v; y.textContent = Math.round(2025 + k); m.textContent = k < 0.5 ? '12' : '6'; p.textContent = Math.round(k * 2); }, onComplete: () => { y.textContent = '2026'; m.textContent = '6'; p.textContent = '2'; } });
      // Selbst-Impuls: Jahr, Monat, Patch kurz erklären, dann zurück
      ['y', 'm', 'p', ''].forEach((k, i) => gsap.delayedCall(1.6 + i * 2.4, () => { if (!touched) setSel(k, true); }));
    }, 0.4);
  }

  const FSTEPS = [
    { cap: 'Flashen löscht immer deine Einstellungen. Tipp in der CLI <code>diff all</code> ein und speicher die Ausgabe als Textdatei.', dur: 4.6 },
    { cap: 'Öffne app.betaflight.com in Chrome oder Edge, seit 2026.6 auch in Firefox ab Version 151, und steck den Flugcontroller per USB an.', dur: 3.4 },
    { cap: 'Im Firmware Flasher erkennt die App dein Board automatisch. Prüf, ob der Name stimmt.', dur: 3.2 },
    { cap: 'Version wählen und im Bereich Board &amp; Build ankreuzen, was du brauchst, zum Beispiel CRSF und Telemetrie für ELRS. Die Firmware wird dann online für dich gebaut.', dur: 4.2 },
    { cap: 'Auf Firmware flashen tippen und warten, bis der Balken durch ist. Das USB-Kabel dabei nicht ziehen.', dur: 3.4 },
    { cap: 'Verbinden, Beschleunigungssensor kalibrieren und alles neu einstellen. Wie, zeigen dir die Tabs gleich hier unten.', dur: 3 }
  ];
  const DIFF_OUT = ['# version', '# Betaflight / STM32F405 2026.6.2', '', '# master', 'set serialrx_provider = CRSF', 'set dshot_bidir = ON', 'set craft_name = FCS', '#c Ausgabe kopieren und als Datei speichern'];
  function typeInto(el, text, dur, tl, pos) {
    const o = { n: 0 };
    tl.to(o, { n: text.length, duration: dur, ease: 'none', onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); } }, pos);
  }
  function flashen() {
    const sec = $('#version'); const box = sec && $('.ws-flash', sec); if (!box) return;
    const screens = $$('.ws-fsc', box), steps = $$('[data-f]', box), cap = $('[data-f-cap]', box);
    const playB = $('[data-f-play]', box), prog = $('.ws-prog i', box);
    const hint = makeHint($('.ws-hint-flash', box));
    let cur = 0, playing = false, tl = null, touched = false;
    function sceneTl(i) {
      const s = screens[i], t = gsap.timeline();
      if (i === 0) {
        const ty = $('[data-type]', s), out = $('[data-term-out]', s);
        ty.textContent = ''; out.innerHTML = '';
        typeInto(ty, 'diff all', 0.9, t, 0.3);
        DIFF_OUT.forEach((l, k) => t.call(() => { const p = D.createElement('p'); if (l.startsWith('#c')) { p.className = 'c'; p.textContent = '# ' + l.slice(3); } else p.textContent = l || ' '; out.appendChild(p); }, null, 1.4 + k * 0.28));
      } else if (i === 1) {
        t.fromTo($('.ws-usb', s), { x: -30 }, { x: 0, duration: 0.8, ease: 'power3.out' }, 0.2)
          .fromTo($('.ws-pill', s), { scale: 0.85, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, 1.1);
      } else if (i === 2) {
        const b = $('[data-board]', s), sel = $('.ws-sel', s);
        b.textContent = 'Suche Board …'; sel.classList.remove('ok');
        t.fromTo($('.ws-scan i', s), { xPercent: -100 }, { xPercent: 340, duration: 0.9, repeat: 1, ease: 'power1.inOut' }, 0.1)
          .call(() => { b.textContent = 'F405-Board erkannt'; sel.classList.add('ok'); }, null, 2)
          .fromTo(sel, { scale: 0.96 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 2);
      } else if (i === 3) {
        const lis = $$('.ws-opts li', s); lis.forEach(l => l.classList.remove('on'));
        lis.forEach((l, k) => t.call(() => l.classList.add('on'), null, 0.3 + k * 0.35));
        t.fromTo($$('.ws-dots i', s), { opacity: 0.2 }, { opacity: 1, duration: 0.3, stagger: { each: 0.15, repeat: 5, yoyo: true } }, 2.1);
      } else if (i === 4) {
        const pct = $('[data-pct]', s), o = { v: 0 };
        t.fromTo($('.ws-bar i', s), { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: 'power1.inOut' }, 0.2)
          .to(o, { v: 100, duration: 2.6, ease: 'power1.inOut', onUpdate: () => { pct.textContent = Math.round(o.v); } }, 0.2);
      } else {
        t.fromTo($('.ws-ok svg', s), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2.2)', transformOrigin: '50% 50%' }, 0.1);
      }
      return t;
    }
    function show(i) {
      cur = (i + screens.length) % screens.length;
      screens.forEach((s, k) => { s.classList.toggle('on', k === cur); if (k !== cur) gsap.set(s, { opacity: 0 }); });
      steps.forEach((b, k) => { if (k === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); b.classList.toggle('done', k < cur); });
      cap.innerHTML = FSTEPS[cur].cap;
      if (tl) tl.kill();
      if (!GS() || RM) { screens[cur].style.opacity = 1; finalState(cur); prog.style.transform = `scaleX(${(cur + 1) / screens.length})`; return; }
      gsap.fromTo(screens[cur], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' });
      tl = gsap.timeline({ paused: !playing });
      tl.add(sceneTl(cur), 0);
      tl.fromTo(prog, { scaleX: cur / screens.length }, { scaleX: (cur + 1) / screens.length, duration: FSTEPS[cur].dur, ease: 'none' }, 0);
      tl.call(() => { if (playing) { if (cur < screens.length - 1) show(cur + 1); else stop(true); } }, null, FSTEPS[cur].dur);
      if (playing) tl.play();
      else tl.progress(0.999).pause();
    }
    function finalState(i) {
      const s = screens[i];
      if (i === 0) { $('[data-type]', s).textContent = 'diff all'; const out = $('[data-term-out]', s); out.innerHTML = ''; DIFF_OUT.forEach(l => { const p = D.createElement('p'); if (l.startsWith('#c')) { p.className = 'c'; p.textContent = '# ' + l.slice(3); } else p.textContent = l || ' '; out.appendChild(p); }); }
      if (i === 2) { $('[data-board]', s).textContent = 'F405-Board erkannt'; $('.ws-sel', s).classList.add('ok'); }
      if (i === 3) $$('.ws-opts li', s).forEach(l => l.classList.add('on'));
      if (i === 4) { $('.ws-bar i', s).style.transform = 'scaleX(1)'; $('[data-pct]', s).textContent = '100'; }
    }
    function play() {
      playing = true; playB.classList.add('on'); playB.setAttribute('aria-label', 'Pause');
      if (!tl || tl.progress() > 0.95) show(cur === screens.length - 1 && tl ? 0 : cur); else tl.play();
    }
    function stop(end) { playing = false; playB.classList.remove('on'); playB.setAttribute('aria-label', 'Abspielen'); if (tl && !end) tl.pause(); if (end) hint.show(); }
    playB.addEventListener('click', () => { touched = true; hint.done(); playing ? stop() : play(); });
    $('[data-f-prev]', box).addEventListener('click', () => { touched = true; hint.done(); stop(); show(cur - 1); });
    $('[data-f-next]', box).addEventListener('click', () => { touched = true; hint.done(); stop(); show(cur + 1); });
    steps.forEach(b => b.addEventListener('click', () => { touched = true; hint.done(); stop(); show(+b.dataset.f); }));
    show(0);
    // Pausieren, wenn außer Sicht
    const io = new IntersectionObserver(es => { const v = es[es.length - 1].isIntersecting; if (!tl) return; if (!v) tl.pause(); else if (playing) tl.play(); }, { rootMargin: '40px 0px' });
    io.observe(box);
    firstSight(box, () => { if (touched) return; if (!GS() || RM) { hint.show(); return; } play(); }, 0.45);
  }

  /* =====================================================================
     03 · Tabs der Betaflight App (Nachzeichnung)
     ===================================================================== */
  const DEMOS = {};
  function tabs() {
    const sec = $('#tabs'); if (!sec) return;
    const app = $('.ws-app', sec), list = $('.ws-app-nav', app), tabsB = $$('[role=tab]', list), panels = $$('[role=tabpanel]', app);
    const hint = makeHint($('.ws-hint-tabs', app));
    let cur = 'setup', touched = false;
    const seen = {};
    function select(id, { focus = false, user = false } = {}) {
      const b = tabsB.find(t => t.dataset.tab === id); if (!b) return;
      if (user) { touched = true; hint.done(); }
      const prev = cur; cur = id;
      tabsB.forEach(t => { const on = t === b; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      panels.forEach(p => { p.hidden = p.id !== 'wp-' + id; });
      if (focus) b.focus();
      // Reiter in der Leiste sichtbar halten (Handy)
      if (list.scrollWidth > list.clientWidth + 4) list.scrollTo({ left: b.offsetLeft - list.clientWidth / 2 + b.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth' });
      const p = $('#wp-' + id);
      if (GS() && !RM && prev !== id) gsap.fromTo(p.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.06 });
      if (prev !== id && DEMOS[prev] && DEMOS[prev].leave) run('leave ' + prev, () => DEMOS[prev].leave());
      if (DEMOS[id]) {
        if (!seen[id] && DEMOS[id].init) { seen[id] = true; run('init ' + id, () => DEMOS[id].init()); }
        if (DEMOS[id].enter) run('enter ' + id, () => DEMOS[id].enter());
      }
    }
    W.wsSelectTab = (id) => select(id, { user: true });
    tabsB.forEach((t, i) => {
      t.addEventListener('click', () => select(t.dataset.tab, { user: true }));
      t.addEventListener('keydown', e => {
        const n = tabsB.length;
        let k = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
        if (k == null) return; e.preventDefault(); k = (k + n) % n; select(tabsB[k].dataset.tab, { focus: true, user: true });
      });
    });
    app.addEventListener('pointerdown', () => { touched = true; hint.done(); }, { passive: true });
    // Erste Demo vorbereiten, aber erst im Bild starten
    firstSight(app, () => {
      select(cur);
      if (touched || !GS() || RM) { hint.show(); return; }
      // Selbst-Impuls: einmal über alle Reiter streichen
      const tlh = gsap.timeline({ delay: 0.3, onComplete: () => { if (!touched) hint.show(); } });
      tabsB.forEach((t, i) => { tlh.call(() => t.classList.add('peek'), null, i * 0.09).call(() => t.classList.remove('peek'), null, i * 0.09 + 0.28); });
    }, 0.3);
  }

  /* ---------- Demo: Einrichtung ---------- */
  DEMOS.setup = (() => {
    let el, inner, rEl, pEl, msg, cal, st = { rx: 0, ry: 0 }, tw = null, did = false;
    const render = () => { inner.style.transform = `rotateX(${st.rx.toFixed(1)}deg) rotateY(${st.ry.toFixed(1)}deg)`; rEl.textContent = Math.round(st.ry); pEl.textContent = Math.round(-st.rx); };
    const to = (rx, ry, d = 0.6, ease = 'power2.inOut') => { if (tw) tw.kill(); if (!GS() || RM) { st.rx = rx; st.ry = ry; render(); return; } tw = gsap.to(st, { rx, ry, duration: d, ease, onUpdate: render }); return tw; };
    function init() {
      const p = $('#wp-setup'); el = $('.ws-tilt', p); inner = $('.ws-tilt-in', p); rEl = $('[data-su-r]', p); pEl = $('[data-su-p]', p); msg = $('[data-su-msg]', p); cal = $('[data-su-cal]', p);
      let drag = false, sx = 0, sy = 0, b0 = { rx: 0, ry: 0 };
      el.addEventListener('pointerdown', e => { drag = true; did = true; sx = e.clientX; sy = e.clientY; b0 = { rx: st.rx, ry: st.ry }; if (tw) tw.kill(); try { el.setPointerCapture(e.pointerId); } catch (err) {} el.style.cursor = 'grabbing'; });
      el.addEventListener('pointermove', e => { if (!drag) return; st.ry = clamp(b0.ry + (e.clientX - sx) * 0.45, -45, 45); st.rx = clamp(b0.rx - (e.clientY - sy) * 0.45, -45, 45); render(); });
      const end = () => { if (!drag) return; drag = false; el.style.cursor = ''; to(0, 0, 0.9, 'elastic.out(1,.5)'); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      let kt = 0;
      el.addEventListener('keydown', e => { const k = { ArrowLeft: [0, -10], ArrowRight: [0, 10], ArrowUp: [10, 0], ArrowDown: [-10, 0] }[e.key]; if (!k) return; e.preventDefault(); did = true; to(clamp(st.rx + k[0], -45, 45), clamp(st.ry + k[1], -45, 45), 0.3); clearTimeout(kt); kt = setTimeout(() => to(0, 0, 0.9, 'elastic.out(1,.5)'), 1200); });
      cal.addEventListener('click', () => {
        did = true; cal.disabled = true; msg.className = 'ws-d-msg'; msg.textContent = 'Kalibriere … Drohne nicht bewegen.';
        to(0, 0, 0.4);
        setTimeout(() => { cal.disabled = false; msg.className = 'ws-d-msg ok'; msg.textContent = 'Kalibriert. Kipp jetzt die Drohne: Das Modell muss in dieselbe Richtung mitkippen.'; }, 1400);
      });
      render();
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      gsap.timeline({ delay: 0.5 }).add(to(0, 28, 0.7)).add(to(0, -22, 0.8)).add(to(-18, 0, 0.7)).add(to(0, 0, 0.9, 'elastic.out(1,.5)'));
    }
    return { init, enter };
  })();

  /* ---------- Demo: Anschlüsse ---------- */
  DEMOS.ports = (() => {
    let p, sws, msg, wire, tk, dots, paths, did = false;
    const RIGHT = '2';
    function setUart(u, user) {
      sws.forEach(s => { const on = s.dataset.uart === u; s.setAttribute('aria-checked', on); const row = s.closest('tr'); row.classList.toggle('ok', on && u === RIGHT); row.classList.toggle('bad', on && u !== RIGHT); $(`[data-pt-f="${s.dataset.uart}"]`, p).textContent = on ? 'Serial RX' : 'frei'; });
      if (!u) { msg.className = 'ws-d-msg'; msg.textContent = 'Dein Empfänger ist an UART2 gelötet. Welcher Schalter ist richtig?'; return; }
      if (u === RIGHT) { msg.className = 'ws-d-msg ok'; msg.textContent = 'Passt: Serial RX auf UART2. Im Tab Empfänger bewegen sich jetzt die Balken.'; }
      else { msg.className = 'ws-d-msg bad'; msg.textContent = `UART${u} ist frei. Dein Empfänger hängt aber an den Pads T2 und R2, also an UART2.`; }
      if (user && GS() && !RM) gsap.fromTo(msg, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,.4)' });
    }
    function init() {
      p = $('#wp-ports'); sws = $$('.ws-sw', p); msg = $('[data-pt-msg]', p); wire = $('.ws-wire', p);
      sws.forEach(s => s.addEventListener('click', () => { did = true; setUart(s.getAttribute('aria-checked') === 'true' ? '' : s.dataset.uart, true); }));
      paths = $$('.ws-w-l', wire); dots = $$('.ws-w-p', wire);
      const lens = paths.map(x => x.getTotalLength());
      let ph = 0;
      wire.classList.add('live');
      tk = ticker(wire, (dt) => {
        if (p.hidden) return false;
        ph += dt * 0.6;
        dots.forEach((d, i) => { const t = (ph + i * 0.5) % 1; const pt = paths[i].getPointAtLength(t * lens[i]); d.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`); d.style.opacity = Math.sin(Math.PI * t).toFixed(2); });
        return !RM;
      });
    }
    function enter() {
      if (tk) tk.kick();
      if (did) return; did = true;
      const row = sws[1].closest('tr');
      if (GS() && !RM) gsap.fromTo(row, { backgroundColor: 'rgba(255,176,32,0)' }, { backgroundColor: 'rgba(255,176,32,.16)', duration: 0.5, yoyo: true, repeat: 3, delay: 1, clearProps: 'backgroundColor' });
    }
    return { init, enter };
  })();

  /* ---------- Demo: Konfiguration ---------- */
  DEMOS.conf = (() => {
    let p, fc, frame, mountEl, msg, radios, mount = 0, did = false;
    const NAMES = ['Pfeil vorne', 'Pfeil rechts', 'Pfeil hinten', 'Pfeil links'];
    const align = () => +(radios.find(r => r.checked) || { value: 0 }).value;
    function upd(anim) {
      const a = align(), ok = a === mount;
      mountEl.textContent = NAMES[mount];
      frame.classList.toggle('ok', ok); frame.classList.toggle('bad', !ok);
      if (ok) { msg.className = 'ws-d-msg ok'; msg.textContent = mount === 0 ? 'Passt: Der Pfeil zeigt nach vorne, Ausrichtung bleibt auf 0.' : 'Passt: Die Ausrichtung passt zum Einbau. Prüf es im Tab Einrichtung am Modell.'; }
      else { msg.className = 'ws-d-msg bad'; msg.textContent = 'Passt nicht: Der Flugcontroller hält eine andere Seite für vorne. Die Drohne würde beim Start flippen.'; }
      if (GS() && !RM && anim) gsap.to(fc, { rotation: mount * 90, svgOrigin: '120 110', duration: 0.7, ease: 'back.out(1.6)' });
      else fc.setAttribute('transform', `rotate(${mount * 90} 120 110)`);
    }
    function init() {
      p = $('#wp-conf'); fc = $('[data-fc-rot]', p); frame = $('.ws-frame', p); mountEl = $('[data-cf-mount]', p); msg = $('[data-cf-msg]', p); radios = $$('input[name=ws-align]', p);
      $('[data-cf-rot]', p).addEventListener('click', () => { did = true; mount = (mount + 1) % 4; upd(true); });
      radios.forEach(r => r.addEventListener('change', () => { did = true; upd(false); }));
      upd(false);
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      gsap.timeline({ delay: 0.6 })
        .call(() => { mount = 1; upd(true); })
        .call(() => { radios[1].checked = true; upd(false); }, null, '+=1.8')
        .call(() => { mount = 0; radios[0].checked = true; upd(true); }, null, '+=2.2');
    }
    return { init, enter };
  })();

  /* ---------- Demo: Failsafe ---------- */
  DEMOS.fs = (() => {
    let p, lqEl, st, bar, s1, s2, procEl, btn, q, prop, tl = null, did = false, off = false;
    const PROC = { drop: 'Drop', land: 'Landen', gps: 'GPS-Rettung' };
    const proc = () => ($('input[name=ws-fsp]:checked', p) || { value: 'drop' }).value;
    let spin = null;
    function reset() {
      if (tl) tl.kill(); off = false;
      btn.textContent = 'Funke ausschalten';
      lqEl.textContent = '100'; st.className = 'ws-fsim-st'; st.textContent = 'Verbunden';
      s1.className = ''; s2.className = '';
      if (GS()) { gsap.set(bar, { scaleX: 1 }); gsap.set(q, { y: 0, x: 0, rotation: 0, opacity: 1 }); }
      if (spin) spin.timeScale(1).play();
    }
    function go() {
      if (off) { reset(); return; }
      off = true; btn.textContent = 'Funke einschalten';
      const pr = proc();
      if (!GS() || RM) { lqEl.textContent = '0'; st.className = 'ws-fsim-st s2'; st.textContent = 'Stufe 2: ' + PROC[pr]; s1.className = 'on'; s2.className = 'on2'; return; }
      const o = { v: 100 };
      tl = gsap.timeline();
      tl.to(o, { v: 0, duration: 0.4, ease: 'power2.in', onUpdate: () => { lqEl.textContent = Math.round(o.v); } })
        .to(bar, { scaleX: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .call(() => { st.className = 'ws-fsim-st s1'; st.textContent = 'Signal weg'; s1.className = 'on'; })
        .to({}, { duration: 1.5 })
        .call(() => { st.className = 'ws-fsim-st s2'; st.textContent = 'Stufe 2: ' + PROC[pr]; s1.className = ''; s2.className = 'on2'; });
      if (pr === 'drop') tl.call(() => spin && spin.pause()).to(q, { y: 34, rotation: 14, duration: 0.6, ease: 'power2.in', svgOrigin: '0 0' }).to(q, { opacity: 0.35, duration: 0.3 });
      else if (pr === 'land') tl.to(q, { y: 26, duration: 2.4, ease: 'sine.inOut' }).call(() => spin && spin.pause());
      else tl.to(q, { x: -26, y: -6, duration: 1.4, ease: 'sine.inOut' }).to(q, { x: -40, duration: 1, ease: 'sine.inOut' });
    }
    function init() {
      p = $('#wp-fs'); lqEl = $('[data-fs-lq]', p); st = $('[data-fs-st]', p); bar = $('[data-fs-bar]', p); s1 = $('[data-fs-s="1"]', p); s2 = $('[data-fs-s="2"]', p); procEl = $('[data-fs-proc]', p); btn = $('[data-fs-go]', p); q = $('[data-fs-q]', p); prop = $$('.ws-fsim-p ellipse', p);
      btn.addEventListener('click', () => { did = true; go(); });
      $$('input[name=ws-fsp]', p).forEach(r => r.addEventListener('change', () => { did = true; procEl.textContent = PROC[proc()]; reset(); }));
      if (GS() && !RM) { spin = gsap.to(prop, { opacity: 0.25, duration: 0.07, repeat: -1, yoyo: true, ease: 'none', stagger: 0.02 }); pauseWith(p, [spin]); }
      reset();
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      gsap.delayedCall(0.8, () => { if (!p.hidden) go(); });
      gsap.delayedCall(5.4, () => { if (!p.hidden && off) reset(); });
    }
    function leave() { if (spin) spin.pause(); }
    return { init, enter, leave };
  })();

  /* ---------- Demo: PID & Rates ---------- */
  DEMOS.pid = (() => {
    let p, svgR, curve, lin, dot, grid, maxEl, halfEl, sl = {}, out = {}, lab = {}, hint, did = false, type = 'actual', sweep = null;
    const W0 = 320, H0 = 190, L0 = 44, R0 = 304, T0 = 18, B0 = 166;
    const CFG = {
      actual: { a: ['Mitte', 10, 400, 10, 70, v => v + ' °/s'], b: ['Maximum', 200, 1500, 10, 670, v => v + ' °/s'], c: ['Expo', 0, 1, 0.01, 0, v => v.toFixed(2)] },
      bf: { a: ['RC Rate', 0.1, 2.55, 0.01, 1, v => v.toFixed(2)], b: ['Super Rate', 0, 0.95, 0.01, 0.7, v => v.toFixed(2)], c: ['Expo', 0, 1, 0.01, 0, v => v.toFixed(2)] }
    };
    const val = { actual: { a: 70, b: 670, c: 0 }, bf: { a: 1, b: 0.7, c: 0 } };
    const f = (s) => { const v = val[type]; return type === 'actual' ? rateActual(s, v.a, v.b, v.c) : rateBF(s, v.a, v.b, v.c); };
    let top = 800, stick = 0;
    function drawGrid() {
      grid.innerHTML = '';
      for (let k = 0; k <= 4; k++) { const y = B0 - (B0 - T0) * k / 4; sv('path', { d: `M${L0} ${y}H${R0}` }, grid); const t = sv('text', { x: L0 - 6, y: y + 3, 'text-anchor': 'end' }, grid); t.textContent = Math.round(top * k / 4); }
      for (let k = 1; k <= 4; k++) { const x = L0 + (R0 - L0) * k / 4; sv('path', { d: `M${x} ${T0}V${B0}` }, grid); }
    }
    function render() {
      const mx = f(1);
      const nt = Math.max(800, Math.ceil(mx / 200) * 200); if (nt !== top) { top = nt; drawGrid(); }
      let d = '';
      for (let i = 0; i <= 60; i++) { const s = i / 60, x = L0 + (R0 - L0) * s, y = B0 - (B0 - T0) * f(s) / top; d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
      curve.setAttribute('d', d);
      lin.setAttribute('d', `M${L0} ${B0}L${R0} ${(B0 - (B0 - T0) * mx / top).toFixed(1)}`);
      maxEl.textContent = fmt(mx); halfEl.textContent = fmt(f(0.5));
      placeDot();
    }
    function placeDot() { const x = L0 + (R0 - L0) * stick, y = B0 - (B0 - T0) * f(stick) / top; dot.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); }
    function setSliders() {
      const c = CFG[type];
      ['a', 'b', 'c'].forEach(k => { const [name, mn, mxv, st] = c[k]; lab[k].textContent = name; sl[k].min = mn; sl[k].max = mxv; sl[k].step = st; sl[k].value = val[type][k]; paint(k); });
    }
    function paint(k) { const s = sl[k]; s.style.setProperty('--p', ((s.value - s.min) / (s.max - s.min) * 100).toFixed(1) + '%'); out[k].textContent = CFG[type][k][5](+s.value); }
    function init() {
      p = $('#wp-pid'); svgR = $('.ws-rate', p); curve = $('.ws-r-curve', p); lin = $('.ws-r-lin', p); dot = $('.ws-r-dot', p); grid = $('.ws-r-grid', p);
      maxEl = $('[data-r-max]', p); halfEl = $('[data-r-half]', p); hint = makeHint($('.ws-hint-rate', p));
      ['a', 'b', 'c'].forEach(k => { sl[k] = $(`[data-r="${k}"]`, p); out[k] = $(`[data-r-o="${k}"]`, p); lab[k] = $(`[data-r-l="${k}"]`, p); });
      ['a', 'b', 'c'].forEach(k => sl[k].addEventListener('input', () => { did = true; hint.done(); if (sweep) { sweep.kill(); sweep = null; } val[type][k] = +sl[k].value; paint(k); render(); }));
      $$('[data-rt]', p).forEach(b => b.addEventListener('click', () => { did = true; type = b.dataset.rt; $$('[data-rt]', p).forEach(x => x.setAttribute('aria-pressed', x === b)); setSliders(); render(); }));
      // Ziehen auf der Kurve bewegt den Stick-Punkt
      svgR.addEventListener('pointermove', e => { const b = svgR.getBoundingClientRect(); const s = clamp(((e.clientX - b.left) / b.width * W0 - L0) / (R0 - L0)); if (sweep) { sweep.kill(); sweep = null; } stick = s; placeDot(); });
      drawGrid(); setSliders(); render();
    }
    function enter() {
      if (did || !GS() || RM) { if (!did) hint.show(); return; }
      const o = { s: 0 };
      sweep = gsap.timeline({ delay: 0.5, onComplete: () => { sweep = null; hint.show(); } })
        .to(o, { s: 1, duration: 1.6, ease: 'power1.inOut', onUpdate: () => { stick = o.s; placeDot(); } })
        .to(o, { s: 0.5, duration: 0.9, ease: 'power1.inOut', onUpdate: () => { stick = o.s; placeDot(); } });
    }
    return { init, enter };
  })();

  /* ---------- Demo: Empfänger ---------- */
  DEMOS.rx = (() => {
    let p, bars, vals, rows, msg, led, L, R, did = false;
    const IN = { roll: 0, pitch: 0, yaw: 0, thr: 0 };
    const FN = ['A', 'E', 'R', 'T'], NAME = { A: 'Rollen', E: 'Nicken', R: 'Gieren', T: 'Gas' };
    const map = () => ($('input[name=ws-map]:checked', p) || { value: 'AETR' }).value;
    function upd(user) {
      // Die Funke sendet AETR: Kanal 1 Rollen, 2 Nicken, 3 Gas, 4 Gieren
      const ch = [IN.roll, IN.pitch, IN.thr * 2 - 1, IN.yaw];
      const radio = ['A', 'E', 'T', 'R'];
      const m = map(); let wrong = null;
      FN.forEach((fn, i) => {
        const c = m.indexOf(fn); const v = ch[c];
        const us = Math.round(1500 + v * 500);
        bars[i].style.setProperty('--v', ((v + 1) / 2).toFixed(3)); vals[i].textContent = us;
        const bad = radio[c] !== fn; rows[i].classList.toggle('wrong', bad);
        if (bad && radio[c] === 'T') wrong = NAME[fn];
      });
      if (m !== 'AETR') { msg.className = 'ws-d-msg bad'; msg.textContent = `Falsche Zuordnung: Dein Gas bewegt den Balken ${wrong}. Stell die Kanalzuordnung so ein, wie deine Funke sendet.`; }
      else if (user && msg.dataset.bound !== '1') { msg.className = 'ws-d-msg ok'; msg.textContent = 'Passt: Jeder Balken folgt dem richtigen Stick.'; }
    }
    function init() {
      p = $('#wp-rx'); bars = $$('[data-rb]', p); vals = $$('[data-rv]', p); rows = $$('.ws-bars li', p); msg = $('[data-rx-msg]', p); led = $('[data-rx-led]', p);
      const onUser = () => { did = true; };
      L = makeStick($('[data-stick=l]', p), { springY: false, y: -1, onMove: (s, u) => { IN.thr = (s.y + 1) / 2; IN.yaw = s.x; upd(u); }, onUser });
      R = makeStick($('[data-stick=r]', p), { onMove: (s, u) => { IN.roll = s.x; IN.pitch = s.y; upd(u); }, onUser });
      $$('input[name=ws-map]', p).forEach(r => r.addEventListener('change', () => { did = true; msg.dataset.bound = ''; if (map() === 'AETR') { msg.className = 'ws-d-msg ok'; msg.textContent = 'AETR1234 passt zu deiner Funke.'; } upd(false); if (map() !== 'AETR' && GS() && !RM) L.tweenTo(0, 0.4, 0.6); }));
      const bind = $('[data-rx-bind]', p);
      bind.addEventListener('click', () => {
        did = true; bind.disabled = true; led.className = 'ws-led blink2'; msg.dataset.bound = '1'; msg.className = 'ws-d-msg'; msg.textContent = 'Bind-Modus: Die LED am Empfänger blinkt doppelt. Jetzt an der Funke binden.';
        setTimeout(() => { led.className = 'ws-led on'; bind.disabled = false; msg.className = 'ws-d-msg ok'; msg.textContent = 'Gebunden: Die LED leuchtet dauerhaft. Beweg die Sticks und prüf die Balken.'; msg.dataset.bound = ''; }, 2400);
      });
      upd(false);
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      gsap.timeline({ delay: 0.5 })
        .add(() => L.tweenTo(0, 0, 0.7))
        .add(() => R.tweenTo(-0.8, 0, 0.5), '+=0.8')
        .add(() => R.tweenTo(0, 0.7, 0.5), '+=0.6')
        .add(() => R.tweenTo(0, 0, 0.5), '+=0.6')
        .add(() => L.tweenTo(0, -1, 0.6), '+=0.4');
    }
    return { init, enter };
  })();

  /* ---------- Demo: Modi ---------- */
  DEMOS.modes = (() => {
    let p, rows, msg, did = false, turtleBeforeArm = false;
    const ON = 91.7, OFF = 8.3; // Position der Markierung in Prozent (1000 beziehungsweise 2000 auf der Skala 900 bis 2100)
    function setRow(li, on) {
      const sw = $('.ws-sw', li); sw.setAttribute('aria-checked', on);
      li.classList.toggle('on', on);
      $('.ws-md-mk', li).style.transform = `translateX(${on ? ON : OFF}%)`;
    }
    const state = () => Object.fromEntries(rows.map(li => [li.dataset.md, li.classList.contains('on')]));
    function say(changed) {
      const s = state(); let t = '', cls = 'ws-d-msg';
      if (changed === 'turtle' && s.turtle && s.arm) { t = 'Turtle wirkt nur, wenn du den Schalter vor dem Armen umlegst. Erst disarmen, Turtle an, dann armen.'; cls += ' bad'; }
      else if (s.arm && s.turtle && turtleBeforeArm) { t = 'Turtle aktiv: Mit dem Stick drehst du die Drohne, die auf dem Rücken liegt, wieder um.'; cls += ' ok'; }
      else if (s.arm) { t = s.angle ? 'ARM und ANGLE aktiv: Motoren scharf, die Drohne richtet sich selbst gerade aus.' : 'ARM aktiv: Die Motoren sind scharf. Ohne ANGLE fliegst du Acro.'; cls += ' ok'; }
      else if (s.beeper) { t = 'BEEPER aktiv: Die Drohne piept, damit du sie im hohen Gras wiederfindest.'; cls += ' ok'; }
      else if (s.angle) { t = 'ANGLE ist vorgewählt. Aktiv wird es, sobald du armst.'; }
      else if (s.turtle) { t = 'Turtle vorgewählt. Jetzt armen, dann drehst du die Drohne mit dem Stick um.'; }
      else t = 'Kipp einen Schalter: Liegt die Markierung im Bereich, ist der Modus aktiv.';
      msg.className = cls; msg.textContent = t;
    }
    function init() {
      p = $('#wp-modes'); rows = $$('.ws-modes li', p); msg = $('[data-md-msg]', p);
      rows.forEach(li => { setRow(li, false); $('.ws-sw', li).addEventListener('click', () => {
        did = true; const on = !li.classList.contains('on'); const s = state();
        if (li.dataset.md === 'arm' && on) turtleBeforeArm = s.turtle;
        if (li.dataset.md === 'turtle' && !on) turtleBeforeArm = false;
        setRow(li, on); say(li.dataset.md);
      }); });
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      const arm = rows[0];
      gsap.timeline({ delay: 0.7 }).call(() => { setRow(arm, true); say('arm'); }).call(() => { setRow(arm, false); say(); }, null, '+=2');
    }
    return { init, enter };
  })();

  /* ---------- Demo: Motoren ---------- */
  DEMOS.mot = (() => {
    let p, ms, dirs, okBox, btns, msg, did = false, out = false;
    const POS = ['hinten rechts', 'vorne rechts', 'hinten links', 'vorne links'];
    const cw = (i) => { const inCW = i === 0 || i === 3; return out ? !inCW : inCW; }; // Props in: 1 und 4 im Uhrzeigersinn
    function setDirs(anim) { dirs.forEach((d, i) => { const s = cw(i) ? 1 : -1; if (GS() && !RM && anim) gsap.to(d, { scaleX: s, duration: 0.45, ease: 'back.out(2)', svgOrigin: '0 0' }); else d.setAttribute('transform', `scale(${s} 1)`); }); }
    function spin(i) {
      ms.forEach((m, k) => m.classList.toggle('hl', k === i));
      const m = ms[i], prop = $('.ws-mq-prop', m); m.classList.add('spin'); btns[i].classList.add('on');
      msg.className = 'ws-d-msg ok'; msg.textContent = `Motor ${i + 1} dreht: ${POS[i]}, ${cw(i) ? 'im Uhrzeigersinn' : 'gegen den Uhrzeigersinn'}. Stimmt das an deiner Drohne?`;
      const done = () => { m.classList.remove('spin', 'hl'); btns[i].classList.remove('on'); };
      if (GS() && !RM) gsap.to(prop, { rotation: (cw(i) ? '+=' : '-=') + 1440, svgOrigin: '0 0', duration: 1.6, ease: 'power1.inOut', onComplete: done });
      else setTimeout(done, 1200);
    }
    function init() {
      p = $('#wp-mot'); ms = $$('.ws-mq-m', p); dirs = $$('.ws-mq-dir', p); okBox = $('[data-mt-ok]', p); btns = $$('[data-mt]', p); msg = $('[data-mt-msg]', p);
      $$('[data-pr]', p).forEach(b => b.addEventListener('click', () => { did = true; out = b.dataset.pr === 'out'; $$('[data-pr]', p).forEach(x => x.setAttribute('aria-pressed', x === b)); setDirs(true); msg.className = 'ws-d-msg'; msg.textContent = out ? 'Props out: Alle Motoren drehen andersherum. In der App heißt das „Motordrehrichtung ist umgekehrt“.' : 'Props in ist der Standard: 1 und 4 drehen im Uhrzeigersinn, 2 und 3 dagegen.'; }));
      okBox.addEventListener('change', () => { did = true; btns.forEach(b => { b.disabled = !okBox.checked; }); msg.className = 'ws-d-msg'; msg.textContent = okBox.checked ? 'Freigegeben. Tipp auf M1 bis M4 und schau, welcher Motor sich dreht.' : 'Motortest gesperrt.'; });
      btns.forEach((b, i) => b.addEventListener('click', () => spin(i)));
      setDirs(false);
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      const t = gsap.timeline({ delay: 0.6 });
      ms.forEach((m, i) => t.call(() => { ms.forEach((x, k) => x.classList.toggle('hl', k === i)); }, null, i * 0.7));
      t.call(() => ms.forEach(x => x.classList.remove('hl')), null, ms.length * 0.7);
    }
    return { init, enter };
  })();

  /* ---------- Demo: OSD ---------- */
  DEMOS.osd = (() => {
    let p, view, els, did = false;
    function init() {
      p = $('#wp-osd'); view = $('.ws-osdv', p); els = $$('.ws-oe', view);
      $$('[data-oc]', p).forEach(c => { const e = $(`[data-oe="${c.dataset.oc}"]`, view); e.classList.toggle('off', !c.checked); c.addEventListener('change', () => { did = true; e.classList.toggle('off', !c.checked); if (c.checked && GS() && !RM) gsap.fromTo(e, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }); }); });
      if (has('Draggable') && GS()) {
        els.forEach(e => Draggable.create(e, { bounds: view, type: 'x,y', onPress() { did = true; view.classList.add('drag'); e.classList.add('dragging'); }, onRelease() { view.classList.remove('drag'); e.classList.remove('dragging'); } }));
      }
    }
    function enter() {
      if (did || !GS() || RM) return; did = true;
      gsap.from(els.filter(e => !e.classList.contains('off')), { opacity: 0, y: -8, duration: 0.5, stagger: 0.25, ease: 'expo.out', delay: 0.4 });
      const w = $('[data-oe=warn]', view);
      gsap.to(w, { opacity: 0.2, duration: 0.35, repeat: 5, yoyo: true, delay: 1.8 });
    }
    return { init, enter };
  })();

  /* ---------- Demo: Blackbox ---------- */
  DEMOS.bb = (() => {
    let p, mv, rec = true, mem = 12, tk, x = 0, acc = 0, btn, tEl, memEl;
    function pathFor(lag, noise) {
      let d = '';
      for (let i = 0; i <= 640; i += 4) {
        const t = (i - lag) / 320 * Math.PI * 2;
        let v = 34 * Math.sin(t * 2) + 18 * Math.sin(t * 5 + 1) + 10 * Math.sign(Math.sin(t * 3));
        if (noise) v += 3 * Math.sin(i / 320 * Math.PI * 2 * 40) + 2 * Math.sin(i / 320 * Math.PI * 2 * 67);
        d += (i ? 'L' : 'M') + i + ' ' + (75 - v * 0.95).toFixed(1);
      }
      return d;
    }
    function init() {
      p = $('#wp-bb'); mv = $('.ws-bb-move', p); btn = $('[data-bb-rec]', p); tEl = $('[data-bb-t]', p); memEl = $('[data-bb-mem]', p);
      $('.ws-bb-sp', p).setAttribute('d', pathFor(0, false));
      $('.ws-bb-gy', p).setAttribute('d', pathFor(10, true));
      btn.addEventListener('click', () => { rec = !rec; btn.setAttribute('aria-pressed', rec); tEl.textContent = rec ? 'Aufnahme läuft' : 'Aufnahme starten'; if (rec && mem >= 99) mem = 0; tk.kick(); });
      tk = ticker($('.ws-bbv', p), (dt) => {
        if (p.hidden || !rec || RM) return false;
        x = (x + dt * 60) % 320; mv.setAttribute('transform', `translate(${(-x).toFixed(1)} 0)`);
        acc += dt; if (acc > 1.2) { acc = 0; mem = Math.min(99, mem + 1); memEl.textContent = mem; if (mem >= 99) { rec = false; btn.setAttribute('aria-pressed', 'false'); tEl.textContent = 'Speicher voll'; return false; } }
        return true;
      });
    }
    function enter() { if (tk) tk.kick(); }
    return { init, enter };
  })();

  /* ---------- Demo: CLI ---------- */
  DEMOS.cli = (() => {
    let p, term, btns, busy = false, did = false;
    const OUT = {
      diff: ['diff all', ['# version', '# Betaflight / STM32F405 2026.6.2', '# master', 'set serialrx_provider = CRSF', 'set dshot_bidir = ON', 'set craft_name = FCS', '#c Alles kopieren und als Datei speichern: dein Backup.']],
      get: ['get serialrx', ['serialrx_provider = CRSF', 'serialrx_inverted = OFF', 'serialrx_halfduplex = OFF', '#c So siehst du, was gerade eingestellt ist.']],
      status: ['status', ['System Uptime: 312 seconds', 'Arming disable flags: RXLOSS CLI', '#c RXLOSS: kein Signal vom Empfänger. CLI: solange die CLI offen ist, armt nichts.']],
      save: ['save', ['# saving', 'Rebooting', '#c Gespeichert. Der Flugcontroller startet neu und die App trennt kurz.']]
    };
    function line(txt, cls) { const el = D.createElement('p'); if (cls) el.className = cls; el.textContent = txt; term.appendChild(el); term.scrollTop = term.scrollHeight; return el; }
    function exec(k) {
      if (busy) return; busy = true;
      btns.forEach(b => b.classList.toggle('on', b.dataset.cmd === k));
      const [cmd, lines] = OUT[k];
      const hint = $('.ws-term-m', term); if (hint) hint.remove();
      const l = line('', ''); const pr = D.createElement('span'); pr.className = 'ws-pr'; pr.textContent = '# '; l.appendChild(pr); const tx = D.createElement('span'); l.appendChild(tx);
      const fin = () => { lines.forEach((o, i) => setTimeout(() => { if (o.startsWith('#c')) line('# ' + o.slice(3), 'c'); else line(o, 'o'); if (i === lines.length - 1) busy = false; }, RM ? 0 : 160 + i * 140)); };
      if (!GS() || RM) { tx.textContent = cmd; fin(); return; }
      const o = { n: 0 };
      gsap.to(o, { n: cmd.length, duration: cmd.length * 0.05, ease: 'none', onUpdate: () => { tx.textContent = cmd.slice(0, Math.round(o.n)); }, onComplete: fin });
    }
    function init() {
      p = $('#wp-cli'); term = $('[data-cli-out]', p); btns = $$('[data-cmd]', p);
      btns.forEach(b => b.addEventListener('click', () => { did = true; exec(b.dataset.cmd); }));
    }
    function enter() { if (did) return; did = true; setTimeout(() => { if (!p.hidden) exec('diff'); }, RM ? 0 : 500); }
    return { init, enter };
  })();

  /* =====================================================================
     04 · Erste Einrichtung in 10 Schritten
     ===================================================================== */
  function einrichtung() {
    const sec = $('#einrichtung'); if (!sec) return;
    const boxes = $$('input[data-su]', sec), ring = $('.ws-ring', sec), fg = $('.ws-ring-fg', sec);
    const nEl = $('[data-su-n]', sec), stEl = $('[data-su-st]', sec), txt = $('[data-su-txt]', sec);
    const hint = makeHint($('.ws-hint-su', sec));
    const KEY = 'fcs-werkstatt-setup';
    let saved = store.get(KEY, []); if (!Array.isArray(saved)) saved = [];
    boxes.forEach(b => { b.checked = saved.includes(b.dataset.su); });
    let shown = 0, cntT = null;
    function upd(anim) {
      const done = boxes.filter(b => b.checked), n = done.length, all = n === boxes.length;
      const off = 100 - n / boxes.length * 100;
      if (GS() && anim && !RM) { gsap.to(fg, { strokeDashoffset: off, duration: 0.7, ease: 'expo.out', overwrite: true }); if (cntT) cntT.kill(); const o = { v: +nEl.textContent || 0 }; cntT = gsap.to(o, { v: n, duration: 0.5, snap: { v: 1 }, onUpdate: () => { nEl.textContent = o.v; } }); }
      else { fg.style.strokeDashoffset = off; nEl.textContent = n; }
      shown = n;
      ring.classList.toggle('done', all);
      stEl.textContent = all ? 'BEREIT' : n ? 'IN ARBEIT' : 'DISARMED';
      const next = boxes.find(b => !b.checked);
      txt.textContent = all ? 'Alles erledigt. Guten ersten Flug, und denk an den Spotter!' : n ? `Als Nächstes: Schritt ${boxes.indexOf(next) + 1}.` : 'Fang oben an.';
      if (all && anim && GS() && !RM) gsap.fromTo(ring, { scale: 0.96 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1,.4)' });
      store.set(KEY, done.map(b => b.dataset.su));
    }
    boxes.forEach(b => b.addEventListener('change', () => { hint.done(); upd(true); }));
    $('.ws-su-reset', sec).addEventListener('click', () => { boxes.forEach(b => { b.checked = false; }); upd(true); });
    // Pfeil öffnet den Tab und scrollt so, dass Reiter und Inhalt zu sehen sind (am Handy liegt der Inhalt unter der Reiterleiste)
    $$('[data-go-tab]', sec).forEach(a => a.addEventListener('click', ev => {
      if (!W.wsSelectTab) return;
      ev.preventDefault(); ev.stopPropagation();
      W.wsSelectTab(a.dataset.goTab);
      const tl = $('#tabs [role=tablist]') || $('#tabs');
      if (W.FCS && FCS.scrollTo) FCS.scrollTo(tl, -70); else tl.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#tabs');
    }));
    upd(false);
    // Propeller-Warnung: einmal drehen und „abheben“
    const pr = $('.ws-props-p', sec);
    const props = () => { if (!GS() || RM) return; gsap.timeline().to(pr, { rotation: 720, transformOrigin: '50% 50%', duration: 1.1, ease: 'power2.in' }).to(pr, { y: -26, opacity: 0, duration: 0.5, ease: 'power2.in' }).set(pr, { rotation: 0, y: 14 }).to(pr, { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)', delay: 0.4 }); };
    $('.ws-props', sec).addEventListener('pointerenter', props);
    firstSight($('.ws-su-grid', sec), () => {
      props();
      if (!boxes.some(b => b.checked)) { hint.show(); const f = boxes[0].closest('.check'); f.classList.add('pulse'); setTimeout(() => f.classList.remove('pulse'), 3200); }
      if (RM || !GS()) return;
      const real = 100 - boxes.filter(b => b.checked).length / boxes.length * 100;
      gsap.timeline().to(fg, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }).to(fg, { strokeDashoffset: real, duration: 0.9, ease: 'power2.inOut' });
    }, 0.3);
  }

  /* =====================================================================
     05 · Löten: Szene und Temperatur
     ===================================================================== */
  const JOBS = { sig: { lo: 350, hi: 390, n: 'Signal-Pads' }, mot: { lo: 380, hi: 420, n: 'Motorkabel' }, xt: { lo: 400, hi: 450, n: 'XT60' } };
  const LO_STEPS = [
    ['Pad verzinnen', 'Flussmittel aufs Pad, Spitze dran, etwas Zinn zuführen. Es entsteht ein kleiner, glänzender Hügel.'],
    ['Kabel verzinnen', 'Die abisolierte Litze mit Flussmittel verzinnen, bis alle Drähte benetzt sind. Es soll keine dicke, steife Spitze entstehen.'],
    ['Zusammenführen', 'Das Kabel aufs Pad legen und ruhig halten, zum Beispiel mit einer dritten Hand.'],
    ['Wärme', 'Die Spitze kurz auf Kabel und Pad halten. Das Zinn schmilzt und fließt um die Litze.']
  ];
  const LO_END = {
    good: ['Fertig', 'Glänzend, glatte Form, das Kabel sitzt fest. Spitze weg und nicht wackeln, bis das Zinn fest ist.'],
    cold: ['Kalte Lötstelle', 'Matt, körnig oder kugelig, und das Kabel wackelt bei leichtem Zug. Flussmittel dazugeben und neu aufschmelzen.'],
    hot: ['Zu heiß', 'Das Flussmittel verbrennt, bevor das Zinn sauber fließt, und bei zu viel Hitze kann sich das Pad lösen. Lieber Spitze, Flussmittel oder Temperatur prüfen, statt die Platine zu kochen.']
  };
  function loeten() {
    const sec = $('#loeten'); if (!sec) return;
    const svg = $('.ws-lo-svg', sec), scene = $('.ws-scene', sec), tp = $('.ws-temp', sec);
    const q = (s) => $(s, svg);
    const iron = q('.lo-iron'), solder = q('.lo-solder'), wire = q('.lo-wire'), wtin = q('.lo-wtin'), padsol = q('.lo-padsol');
    const jW = q('.lo-joint'), jG = q('.lo-j-good'), jC = q('.lo-j-cold'), jH = q('.lo-j-hot'), heat = q('.lo-heat'), smoke = $$('.lo-smoke circle', svg), lift = q('.lo-lift'), badge = q('.lo-badge'), tipglow = q('.lo-tipglow');
    const nEl = $('[data-lo-n]', sec), tEl = $('[data-lo-t]', sec), xEl = $('[data-lo-x]', sec);
    const playB = $('[data-lo-play]', sec), prog = $('.ws-prog i', scene);
    const range = $('#ws-t', sec), tv = $('[data-t-v]', sec), tst = $('[data-t-state]', sec), tmsg = $('[data-t-msg]', sec), good = $('.ws-t-good', sec), mk = $('.ws-t-mk', sec);
    const qBtns = $$('[data-lo-q]', sec);
    const hintT = makeHint($('.ws-hint-temp', sec));
    let T = +range.value, job = 'sig', step = 0, playing = false, touched = false;
    const outcome = () => { const j = JOBS[job]; return T < j.lo ? 'cold' : T > j.hi ? 'hot' : 'good'; };
    const heatN = () => clamp((T - 250) / 230);

    function caption(i) {
      const res = outcome();
      const [t, x] = i < 4 ? LO_STEPS[i] : LO_END[res];
      nEl.textContent = Math.min(5, i + 1); tEl.textContent = t; xEl.textContent = x;
    }
    function applyResult(instant) {
      const res = outcome();
      const show = { good: jG, cold: jC, hot: jH };
      const d = instant || !GS() || RM ? 0 : 0.35;
      [jG, jC, jH].forEach(j => { if (GS()) gsap.to(j, { opacity: j === show[res] ? 1 : 0, duration: d, overwrite: 'auto' }); else j.style.opacity = j === show[res] ? 1 : 0; });
      badge.classList.toggle('bad', res !== 'good');
      if (GS()) gsap.to(lift, { rotation: res === 'hot' ? 4 : 0, svgOrigin: '380 262', duration: d ? 0.8 : 0, ease: 'power2.out', overwrite: 'auto' });
      qBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.loQ === (res === 'cold' ? 'cold' : res === 'good' ? 'good' : '')));
    }

    /* Haupt-Zeitleiste mit Sprungmarken s0 bis s4 */
    let tl = null;
    const REST_I = { x: 170, y: 118 }, REST_S = { x: 500, y: 128 };
    function build() {
      if (!GS()) return;
      gsap.set(iron, { x: REST_I.x, y: REST_I.y }); gsap.set(solder, { x: REST_S.x, y: REST_S.y });
      gsap.set(wire, { x: 170, y: -80 }); gsap.set(wtin, { opacity: 0 }); gsap.set(padsol, { scaleY: 0, opacity: 1, transformOrigin: '50% 100%' });
      gsap.set([heat, badge, tipglow, ...smoke], { transformOrigin: '50% 50%' });
      gsap.set(jW, { opacity: 0, scale: 0.7, transformOrigin: '50% 100%' }); gsap.set(heat, { opacity: 0, scale: 0.7 }); gsap.set(smoke, { opacity: 0 });
      gsap.set(badge, { opacity: 0, scale: 0.4 }); gsap.set(lift, { rotation: 0, svgOrigin: '380 262' });
      const puff = (t, at, n) => { smoke.slice(0, n).forEach((c, k) => t.fromTo(c, { opacity: 0, x: 0, y: 0, scale: 0.6 }, { opacity: 0.55, scale: 1.4, y: -26, duration: 0.5, ease: 'sine.out' }, at + k * 0.12).to(c, { opacity: 0, y: -70, scale: 2.4, duration: 0.9, ease: 'sine.in' }, at + k * 0.12 + 0.5)); };
      tl = gsap.timeline({ paused: true, onUpdate: () => { prog.style.transform = `scaleX(${tl.progress().toFixed(3)})`; } });
      // 1 Pad verzinnen
      tl.addLabel('s0')
        .to(iron, { x: 292, y: 250, duration: 0.9, ease: 'power2.inOut' })
        .to(solder, { x: 332, y: 246, duration: 0.8, ease: 'power2.inOut' }, '<0.1')
        .to(padsol, { scaleY: 1, duration: 0.9, ease: 'power2.out' }, '>-0.1');
      puff(tl, 1.1, 3);
      tl.to(solder, { x: REST_S.x, y: REST_S.y, duration: 0.7, ease: 'power2.inOut' }, '+=0.2')
        .to(iron, { x: REST_I.x, y: REST_I.y, duration: 0.7, ease: 'power2.inOut' }, '<')
        .addLabel('s1', '+=0.3')
        // 2 Kabel verzinnen
        .to(wire, { x: 60, y: -60, duration: 0.8, ease: 'power2.inOut' }, 's1')
        .to(iron, { x: 362, y: 156, duration: 0.8, ease: 'power2.inOut' }, 's1+=0.3')
        .to(solder, { x: 396, y: 156, duration: 0.7, ease: 'power2.inOut' }, 's1+=0.4')
        .to(wtin, { opacity: 1, duration: 0.8 }, 's1+=1.1');
      puff(tl, tl.labels.s1 + 1.1, 3);
      tl.to(solder, { x: REST_S.x, y: REST_S.y, duration: 0.7, ease: 'power2.inOut' }, 's1+=2.1')
        .to(iron, { x: REST_I.x, y: REST_I.y, duration: 0.7, ease: 'power2.inOut' }, 's1+=2.1')
        .addLabel('s2', 's1+=3')
        // 3 Zusammenführen
        .to(wire, { x: 0, y: 0, duration: 1, ease: 'power3.inOut' }, 's2')
        .addLabel('s3', 's2+=1.5')
        // 4 Wärme
        .to(iron, { x: 318, y: 214, duration: 0.8, ease: 'power2.inOut' }, 's3')
        .to(heat, { opacity: () => 0.25 + 0.75 * heatN(), scale: 1, duration: 0.6 }, 's3+=0.7')
        .to(padsol, { scaleY: 1.25, scaleX: 1.04, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 100%' }, 's3+=0.8')
        .call(() => applyResult(true), null, 's3+=1.2')
        .to(jW, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, 's3+=1.2')
        .to(padsol, { opacity: 0, duration: 0.3 }, 's3+=1.4');
      puff(tl, tl.labels.s3 + 0.9, 5);
      tl.addLabel('s4', 's3+=2.4')
        // 5 Ergebnis
        .to(iron, { x: REST_I.x, y: REST_I.y, duration: 0.8, ease: 'power2.inOut' }, 's4')
        .to(heat, { opacity: 0, scale: 0.8, duration: 0.8 }, 's4')
        .to(badge, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, 's4+=0.5')
        .addLabel('end', 's4+=1.6');
      tl.eventCallback('onComplete', () => { playing = false; playB.classList.remove('on'); playB.setAttribute('aria-label', 'Abspielen'); });
      // Schritt-Anzeige beim Abspielen nachführen
      ['s0', 's1', 's2', 's3', 's4'].forEach((l, i) => tl.call(() => { step = i; caption(i); if (i === 4) applyResult(false); else if (i < 3) gsap.set(lift, { rotation: 0, svgOrigin: '380 262' }); }, null, l));
    }
    const LABELS = ['s0', 's1', 's2', 's3', 's4'];
    let nav = null;
    const killNav = () => { if (nav) { nav.kill(); nav = null; } };
    function goStep(i, play) {
      killNav(); step = clamp(i, 0, 4); caption(step);
      if (!tl) { applyResult(true); return; }
      if (play) { tl.play(LABELS[step]); }
      else {
        const to = step < 4 ? tl.labels[LABELS[step + 1]] - 0.02 : tl.labels.end;
        tl.pause(); tl.seek(LABELS[step], true); if (step < 3) gsap.set(lift, { rotation: 0, svgOrigin: '380 262' }); nav = tl.tweenTo(to, { ease: 'none' });
      }
    }
    function play() { killNav(); playing = true; playB.classList.add('on'); playB.setAttribute('aria-label', 'Pause'); if (!tl) return; if (tl.progress() >= 0.999) { tl.restart(); } else tl.play(); }
    function pause() { killNav(); playing = false; playB.classList.remove('on'); playB.setAttribute('aria-label', 'Abspielen'); if (tl) tl.pause(); }
    playB.addEventListener('click', () => { touched = true; playing ? pause() : play(); });
    $('[data-lo-prev]', sec).addEventListener('click', () => { touched = true; pause(); goStep(step - 1, false); });
    $('[data-lo-next]', sec).addEventListener('click', () => { touched = true; pause(); goStep(step + 1, false); });

    /* Temperatur */
    function showEnd() { if (!tl) { caption(4); applyResult(true); return; } pause(); tl.progress(1); step = 4; caption(4); }
    function updTemp(fromUser) {
      const j = JOBS[job], res = outcome();
      tv.textContent = T; range.style.setProperty('--p', ((T - 250) / 230 * 100).toFixed(1) + '%');
      tp.classList.toggle('cold', res === 'cold'); tp.classList.toggle('hot', res === 'hot');
      tst.textContent = res === 'cold' ? 'zu kalt' : res === 'hot' ? 'zu heiß' : 'guter Startwert';
      tmsg.textContent = res === 'cold' ? `Unter dem Startbereich für ${j.n}. Das Zinn fließt schlecht, du hältst länger drauf und riskierst eine kalte Lötstelle.`
        : res === 'hot' ? `Über dem Startbereich für ${j.n}. Das Flussmittel verbrennt schnell, und wer lange draufhält, kann das Pad von der Platine lösen.`
          : `Guter Startwert für ${j.n} (${j.lo} bis ${j.hi} °C). Das Zinn fließt schnell und glänzt.`;
      good.style.left = ((j.lo - 250) / 230 * 100) + '%'; good.style.width = ((j.hi - j.lo) / 230 * 100) + '%';
      mk.style.transform = `translateX(${(T - 250) / 230 * mk.parentElement.clientWidth}px)`;
      if (GS()) gsap.to(tipglow, { opacity: 0.2 + 0.8 * heatN(), scale: 0.7 + 0.6 * heatN(), duration: 0.3, overwrite: 'auto' });
      if (fromUser) { if (step < 4 || (tl && tl.progress() < 0.999)) showEnd(); applyResult(false); caption(4); }
    }
    range.addEventListener('input', () => { touched = true; hintT.done(); T = +range.value; updTemp(true); });
    $$('input[name=ws-job]', sec).forEach(r => r.addEventListener('change', () => { touched = true; job = r.value; updTemp(true); }));
    qBtns.forEach(b => b.addEventListener('click', () => { touched = true; const j = JOBS[job]; T = b.dataset.loQ === 'cold' ? j.lo - 60 : Math.round((j.lo + j.hi) / 10 / 2) * 10; T = clamp(T, 250, 480); range.value = T; updTemp(true); }));
    W.addEventListener('resize', () => updTemp(false), { passive: true });

    build(); caption(0); updTemp(false);
    applyResult(true);
    if (!GS() || RM) { caption(4); if (GS()) { gsap.set(iron, { x: REST_I.x, y: REST_I.y }); gsap.set(solder, { x: REST_S.x, y: REST_S.y }); gsap.set(wire, { x: 0, y: 0 }); gsap.set(wtin, { opacity: 1 }); gsap.set(padsol, { opacity: 0 }); gsap.set(badge, { opacity: 1, scale: 1 }); gsap.set(jW, { opacity: 1, scale: 1 }); } else jW.style.opacity = 1; }
    const io = new IntersectionObserver(es => { const v = es[es.length - 1].isIntersecting; if (!tl) return; if (!v) tl.pause(); else if (playing) tl.play(); }, { rootMargin: '40px 0px' });
    io.observe(scene);
    firstSight(scene, () => { if (touched || !tl || RM) { hintT.show(); return; } play(); setTimeout(() => hintT.show(), 9000); }, 0.45);
    // Tipp-Kacheln: Symbole einmal beim Erscheinen anstupsen
    firstSight($('.ws-tips', sec), () => { if (!GS() || RM) return; gsap.from($$('.ws-tip svg', sec), { scale: 0.6, opacity: 0, rotation: -20, duration: 0.7, ease: 'back.out(2)', stagger: 0.08, transformOrigin: '50% 50%' }); }, 0.3);
  }

  /* =====================================================================
     06 · Videos (laden erst nach Klick, ohne Vorschaubilder von YouTube)
     ===================================================================== */
  /* Nur Videos, deren Seite per Abruf geprüft ist (Titel, Kanal, Datum). Stand 24.10.2026. */
  const VIDS = [
    { id: 'bWIPMkWhXPA', t: 'How to Set Up Betaflight | Quad & Radio | 2026', ch: 'Drone Camps RC', d: '10.02.2026', lang: 'EN', topic: 'bf', art: 'bf', why: 'Für Einsteiger: die wichtigsten Einstellungen, um Drohne und Funke zu binden, zu armen und sicher zu fliegen.' },
    { id: 'GoPT69y98pY', t: 'Most FPV pilots need to watch this soldering tutorial', ch: 'Joshua Bardwell', d: '06.11.2021', lang: 'EN', topic: 'lot', art: 'lot', why: 'Lötkolben, Lot, Flussmittel, Spitzenpflege, Temperatur und wie du gute von schlechten Lötstellen unterscheidest.' }
  ];
  /* Kandidaten aus der Suche (Titel laut Suchindex). YouTube hat den Abruf zur Prüfung blockiert.
     Erst nach Prüfung von Titel, Kanal und Länge in VIDS übernehmen.
     qqQsVdEPr18 · Meine Tricks und Tipps für das Update auf Betaflight 2025.12.1 (DE)
     kCtL8RxNeRU · NEUES Betaflight 2025.12.1 (4.6) Update: SO rettest du deine SETTINGS (DE)
     8Ph4w06gUKY · How-to Bind v3.4 Express LRS Receivers, All 4 Methods [ELRS] (EN)
     jkjlk-ahcto · ExpressLRS (ELRS) Binding Demo, with and without a Binding Phrase (EN)
     Ia_Pd1QcujA · Flight Controller löten & Komponenten anschließen (DE)
     Wk2uNRD8kNc · Betaflight 2025.12 Tutorial: Flashing Firmware and Getting Position Hold Working (EN) */
  function videos() {
    const sec = $('#videos'); if (!sec) return;
    const list = $('[data-vlist]', sec);
    const art = (k) => {
      const A = {
        bf: '<rect x="40" y="30" width="240" height="120" rx="10" class="ws-vth-l"/><path d="M40 52h240M70 30v120" class="ws-vth-l"/><path d="M92 76h60M92 96h90M92 116h40" class="ws-vth-l"/><g class="ws-vth-m ws-anim ws-vth-k"><circle cx="230" cy="100" r="14" class="ws-vth-a"/><path d="M230 86v28M216 100h28" class="ws-vth-a"/></g>',
        up: '<text x="160" y="96" text-anchor="middle" class="ws-vth-t">4.5</text><path d="M118 120h84" class="ws-vth-l"/><g class="ws-vth-m ws-anim ws-vth-r"><path d="M150 132l10 10 10-10M160 112v30" class="ws-vth-a"/></g><text x="160" y="172" text-anchor="middle" class="ws-vth-t" style="fill:#3fe0ff">2025.12</text>',
        elrs: '<rect x="138" y="96" width="44" height="44" rx="8" class="ws-vth-l"/><path d="M160 96V58" class="ws-vth-l"/><g class="ws-vth-m ws-anim ws-vth-w"><path d="M136 56a34 34 0 0 1 48 0M124 44a50 50 0 0 1 72 0M112 32a66 66 0 0 1 96 0" class="ws-vth-a"/></g><circle cx="150" cy="118" r="4" class="ws-vth-a ws-anim ws-vth-b"/><circle cx="170" cy="118" r="4" class="ws-vth-a"/>',
        lot: '<rect x="40" y="132" width="240" height="22" rx="4" class="ws-vth-l"/><rect x="130" y="124" width="60" height="8" rx="2" class="ws-vth-a"/><g class="ws-vth-m ws-anim ws-vth-i"><path d="M160 120 112 50 98 58l44 70z" class="ws-vth-l"/><path d="M112 50 86 12l-14 8 26 38z" class="ws-vth-l"/></g><path d="M150 124c4-10 16-10 20 0" class="ws-vth-a"/>'
      };
      return `<svg class="ws-vthumb" viewBox="0 0 320 180" aria-hidden="true" focusable="false"><rect width="320" height="180" class="ws-vth-bg"/><g opacity=".5"><path d="M0 45H320M0 90H320M0 135H320M80 0V180M160 0V180M240 0V180" stroke="rgba(158,196,255,.08)"/></g>${A[k] || A.bf}</svg>`;
    };
    list.dataset.n = VIDS.length;
    list.innerHTML = VIDS.map((v, i) => `
      <li class="ws-vc" data-topic="${v.topic}">
        <div class="ws-vbox" data-vid="${v.id}">
          ${art(v.art)}
          <div class="ws-vtags"><span class="tag sig">${v.lang === 'DE' ? 'Deutsch' : 'Englisch'}</span></div>
          <button type="button" class="ws-vplay" aria-label="Video laden (YouTube): ${v.t.replace(/"/g, '&quot;')}"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg></i><span>Video laden (YouTube)</span></button>
        </div>
        <div class="ws-vinfo">
          <h3>${v.t}</h3>
          <p>${[v.ch, v.d ? 'vom ' + v.d : ''].filter(Boolean).join(' · ') || 'YouTube'}${v.len ? ' · ' + v.len : ''}</p>
          <p class="ws-vwhy">${v.why}</p>
          <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">Auf YouTube öffnen <span aria-hidden="true">↗</span></a>
        </div>
      </li>`).join('');
    // Themen-Filter nur für Themen, zu denen es Videos gibt
    const topics = new Set(VIDS.map(v => v.topic)), fs = $('.ws-vf', sec);
    $$('input[name=ws-vt]', sec).forEach(r => { if (r.value && !topics.has(r.value)) r.closest('.chip').hidden = true; });
    if (fs && topics.size < 2) fs.hidden = true;
    const hint = makeHint($('.ws-hint-vid', sec));
    list.addEventListener('click', e => {
      const b = e.target.closest('.ws-vplay'); if (!b) return;
      hint.done();
      const box = b.closest('.ws-vbox'), id = box.dataset.vid, v = VIDS.find(x => x.id === id);
      const f = D.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.title = 'YouTube-Video: ' + (v ? v.t : '');
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.setAttribute('allowfullscreen', '');
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      box.innerHTML = ''; box.appendChild(f); box.classList.add('loaded');
      f.focus();
    });
    $$('input[name=ws-vt]', sec).forEach(r => r.addEventListener('change', () => {
      const t = r.value; const cards = $$('.ws-vc', list);
      cards.forEach(c => { c.hidden = !!t && c.dataset.topic !== t; });
      if (GS() && !RM) gsap.fromTo(cards.filter(c => !c.hidden), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'expo.out' });
      list.scrollTo({ left: 0 });
    }));
    // Vorschau-Animationen (Erklärvideo-Stil) nur im Bild
    if (GS() && !RM) {
      const tw = [];
      $$('.ws-vth-k', list).forEach(e => tw.push(gsap.to(e, { x: -60, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })));
      $$('.ws-vth-r', list).forEach(e => tw.push(gsap.fromTo(e, { y: -10, opacity: 0.3 }, { y: 6, opacity: 1, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })));
      $$('.ws-vth-w', list).forEach(e => tw.push(gsap.fromTo(e, { opacity: 0.2, scale: 0.9 }, { opacity: 1, scale: 1.05, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' })));
      $$('.ws-vth-b', list).forEach(e => tw.push(gsap.to(e, { opacity: 0.1, duration: 0.18, yoyo: true, repeat: -1, repeatDelay: 0.5 })));
      $$('.ws-vth-i', list).forEach(e => tw.push(gsap.to(e, { x: 6, y: 8, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })));
      tw.forEach(t => t.pause());
      pauseWith(list, tw);
    }
    firstSight(list, () => {
      if (GS() && !RM) gsap.from($$('.ws-vc', list), { opacity: 0, y: 24, duration: 0.7, stagger: 0.08, ease: 'expo.out' });
      const first = $('.ws-vplay i', list);
      if (first && GS() && !RM) gsap.fromTo(first, { scale: 1 }, { scale: 1.18, duration: 0.45, yoyo: true, repeat: 3, ease: 'sine.inOut', delay: 0.8, onComplete: () => hint.show() });
      else hint.show();
    }, 0.3);
  }

  /* =====================================================================
     07 · Weiter
     ===================================================================== */
  function weiter() {
    const sec = $('#weiter'); if (!sec) return;
    firstSight($('.ws-ncards', sec), () => {
      if (!GS() || RM) return;
      const paths = $$('.ws-ncard > svg:first-child path, .ws-ncard > svg:first-child rect, .ws-ncard > svg:first-child circle', sec);
      if (has('DrawSVGPlugin')) gsap.from(paths, { drawSVG: '0%', duration: 1.1, ease: 'power2.inOut', stagger: 0.05 });
      gsap.from($$('.ws-ncard', sec), { y: 20, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'expo.out' });
      gsap.fromTo($$('.ws-nc-go', sec), { x: 0 }, { x: 8, duration: 0.35, yoyo: true, repeat: 1, stagger: 0.15, delay: 1, ease: 'sine.inOut' });
    }, 0.3);
  }

  whenReady(() => {
    pauseOffscreen();
    run('Kopf', kopf);
    run('Signalfluss', signalfluss);
    run('Version', version);
    run('Flashen', flashen);
    run('Tabs', tabs);
    run('Einrichtung', einrichtung);
    run('Löten', loeten);
    run('Videos', videos);
    run('Weiter', weiter);
  });
})();
