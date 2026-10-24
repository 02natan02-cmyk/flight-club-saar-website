/* Flight Club Saar – gemeinsame Logik aller Seiten
   Smooth Scroll, Navigation, Einblendungen, Zähler, Zwei-Klick, Formulare, Termine. */
(function () {
  'use strict';
  const FCS = window.FCS = window.FCS || {};
  const D = FCS.data || {};
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  FCS.rm = RM; FCS.fine = FINE;
  document.documentElement.classList.remove('no-js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  FCS.$ = $; FCS.$$ = $$;
  const has = (n) => typeof window[n] !== 'undefined';

  /* ---------- Datum und Termine ---------- */
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  FCS.fmtDate = (iso, lang) => { const d = new Date(iso + 'T12:00:00'); return lang ? `${['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}` : `${WT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
  FCS.termine = () => (D.termine || []).map(t => {
    const h = (D.hallen || {})[t.h] || {};
    const start = new Date(`${t.d}T${(D.zeit || {}).von || '18:00'}:00`);
    const end = new Date(`${t.d}T${(D.zeit || {}).bis || '21:00'}:00`);
    return Object.assign({}, t, { halle: h, start, end, vorbei: end < new Date() });
  });
  FCS.next = () => FCS.termine().find(t => !t.vorbei) || null;
  FCS.ics = (t) => {
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flight Club Saar//Hallenfliegen//DE', 'BEGIN:VEVENT',
      `UID:fcs-${t.d}@flightclub-saar.de`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(t.start)}`, `DTEND:${f(t.end)}`,
      `SUMMARY:Hallenfliegen Flight Club Saar`, `LOCATION:${(t.halle.name || '') + ', ' + (t.halle.adresse || '')}`,
      'DESCRIPTION:Tiny Whoops in der Halle. Kommt einfach vorbei!', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = `Hallenfliegen_${t.d}.ics`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  FCS.route = (lat, lng, label) => `https://www.google.com/maps/dir/?api=1&destination=${lat && lng ? lat + ',' + lng : encodeURIComponent(label || '')}`;
  FCS.countdown = (el, target) => {
    const tick = () => {
      let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
      const set = (k, v) => { const n = el.querySelector(`[data-cd=${k}]`); if (n) n.textContent = String(v).padStart(2, '0'); };
      set('d', d); set('h', h); set('m', m); set('s', s);
    };
    tick(); return setInterval(tick, 1000);
  };

  /* ---------- Nach dem Laden ---------- */
  function init() {
    if (has('gsap')) {
      const plugins = ['ScrollTrigger', 'SplitText', 'Draggable', 'InertiaPlugin', 'DrawSVGPlugin', 'MotionPathPlugin', 'ScrambleTextPlugin', 'Observer'].filter(has).map(n => window[n]);
      gsap.registerPlugin(...plugins);
    }
    smooth(); nav(); reveal(); counters(); glow(); reticle(); twoclick(); videos(); draftbar(); magnets(); forms(); year(); nextBadge();
    document.dispatchEvent(new CustomEvent('fcs:ready'));
  }

  /* Smooth Scroll mit Lenis, verbunden mit ScrollTrigger */
  function smooth() {
    if (RM || !has('Lenis')) return;
    const lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    FCS.lenis = lenis;
    if (has('ScrollTrigger')) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const id = a.getAttribute('href'); if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id, { offset: -70 }); } }));
  }

  function nav() {
    const n = $('.nav'); if (!n) return;
    let last = 0;
    const on = () => { const y = scrollY; n.classList.toggle('solid', y > 40); n.classList.toggle('hide', y > 500 && y > last + 4 && !document.body.classList.contains('menu-open')); if (y < last - 4) n.classList.remove('hide'); last = y; };
    addEventListener('scroll', on, { passive: true }); on();
    const b = $('.burger'), m = $('.menu');
    if (b && m) b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', open); m.classList.toggle('open', open); document.body.classList.toggle('menu-open', open);
      if (FCS.lenis) open ? FCS.lenis.stop() : FCS.lenis.start();
      if (open && has('gsap') && !RM) gsap.fromTo($$('.menu a'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: .06, duration: .7, ease: 'expo.out', delay: .15 });
    });
    if (m) $$('.menu a').forEach(a => a.addEventListener('click', () => { b.click(); }));
  }

  function reveal() {
    const els = $$('[data-reveal]');
    if (!has('gsap') || !has('ScrollTrigger') || RM) { els.forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; }); return; }
    ScrollTrigger.batch(els, { start: 'top 88%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .09 }) });
    if (has('SplitText')) {
      $$('[data-split]').forEach(h => {
        const run = () => {
          const st = new SplitText(h, { type: 'chars,words', charsClass: 'ch' });
          gsap.from(st.chars, { yPercent: 110, opacity: 0, rotateX: -60, transformOrigin: '50% 100%', duration: 1, ease: 'expo.out', stagger: .022, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
        };
        document.fonts ? document.fonts.ready.then(run) : run();
      });
    }
    $$('[data-scramble]').forEach(el => {
      if (!has('ScrambleTextPlugin')) return;
      const txt = el.textContent;
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(el, { duration: 1.2, scrambleText: { text: txt, chars: '01#<>/_', speed: .6 } }) });
    });
    $$('[data-parallax]').forEach(el => gsap.to(el, { yPercent: parseFloat(el.dataset.parallax) || -15, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  }

  function counters() {
    const els = $$('[data-count]'); if (!els.length) return;
    const go = (el) => {
      const to = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      if (RM || !has('gsap')) { el.textContent = pre + to.toLocaleString('de-DE', { minimumFractionDigits: dec }) + suf; return; }
      const o = { v: parseFloat(el.dataset.from || 0) };
      gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: () => el.textContent = pre + o.v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf });
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { go(e.target); io.unobserve(e.target); } }), { threshold: .4 });
    els.forEach(e => io.observe(e));
  }

  function glow() {
    if (!FINE) return;
    document.addEventListener('pointermove', e => {
      const p = e.target.closest && e.target.closest('.panel'); if (!p) return;
      const r = p.getBoundingClientRect(); p.style.setProperty('--mx', (e.clientX - r.left) + 'px'); p.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* Mauszeiger = unser Logo: eine kleine Quad, die mit Trägheit hinterherfliegt, sich in die Kurve legt und Ziele erfasst */
  function reticle() {
    if (!FINE || RM) return;
    document.documentElement.classList.add('dronecur');
    const r = document.createElement('div'); r.className = 'cdrone'; r.setAttribute('aria-hidden', 'true');
    r.innerHTML = `<svg class="cd-q" viewBox="-50 -50 100 100"><circle class="cd-ring" r="46"/><g class="cd-arms"><path d="M-24-24L24 24M24-24L-24 24"/></g><rect class="cd-body" x="-11" y="-11" width="22" height="22" rx="6" transform="rotate(45)"/>${[[-24,-24],[24,-24],[-24,24],[24,24]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><circle class="cd-pr" r="12"/><g class="cd-bl ${i%2?'ccw':'cw'}"><path d="M-11 0H11"/></g><circle class="cd-hub" r="3"/></g>`).join('')}</svg>`;
    document.body.appendChild(r);
    const L = document.createElement('div'); L.className = 'cd-lock'; L.setAttribute('aria-hidden', 'true'); L.innerHTML = '<i></i><i></i><i></i><i></i><span>LOCK</span>'; document.body.appendChild(L);
    const dot = document.createElement('div'); dot.className = 'cdot'; dot.setAttribute('aria-hidden', 'true'); document.body.appendChild(dot);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, vx = 0, vy = 0, flip = 0, lock = null;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; r.classList.add('on'); dot.classList.add('on');
      const t = e.target.closest && e.target.closest('a,button,[role=button],label,select,summary,[data-hot],.rpin,.mcard');
      const typing = e.target.closest && e.target.closest('input,textarea,[contenteditable]');
      lock = t && !typing ? t : null; r.classList.toggle('lock', !!lock); L.classList.toggle('on', !!lock); r.classList.toggle('hide', !!typing); dot.classList.toggle('hide', !!typing);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { r.classList.remove('on'); dot.classList.remove('on'); });
    addEventListener('pointerdown', () => { flip = 1; r.classList.add('boost'); setTimeout(() => r.classList.remove('boost'), 260); });
    let ang = 0;
    const loop = () => {
      // Feder-Dämpfer: fliegt wie ein Kopter hinterher
      const ax = (tx - x) * .09, ay = (ty - y) * .09; vx = (vx + ax) * .72; vy = (vy + ay) * .72; x += vx; y += vy;
      if (flip > 0) { ang += 24; if (ang >= 360) { ang = 0; flip = 0; } }
      const bank = Math.max(-38, Math.min(38, vx * 2.2)), pitch = Math.max(-38, Math.min(38, -vy * 2.2));
      r.style.transform = `translate(${x}px,${y}px) perspective(300px) rotateX(${pitch}deg) rotateY(${bank}deg) rotate(${ang}deg)`;
      dot.style.transform = `translate(${tx}px,${ty}px)`;
      if (lock) { const b = lock.getBoundingClientRect(); L.style.width = (b.width + 16) + 'px'; L.style.height = (b.height + 16) + 'px'; L.style.transform = `translate(${b.left - 8}px,${b.top - 8}px)`; }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* Externe Inhalte (Instagram, Karte) laden erst nach Klick */
  function twoclick() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-load]'); if (!b) return;
      const box = b.closest('[data-twoclick]'); if (!box) return;
      const kind = box.dataset.twoclick;
      if (kind === 'iframe') {
        const f = document.createElement('iframe');
        f.src = box.dataset.src; f.title = box.dataset.title || 'Eingebetteter Inhalt'; f.loading = 'lazy'; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.setAttribute('allowfullscreen', '');
        f.style.cssText = 'width:100%;height:100%;border:0;border-radius:inherit;background:#000';
        box.innerHTML = ''; box.appendChild(f); box.classList.add('loaded');
      } else document.dispatchEvent(new CustomEvent('fcs:twoclick', { detail: { box, kind } }));
    });
  }

  /* Videos spielen nur, wenn sie zu sehen sind */
  function videos() {
    const vs = $$('video[data-auto]'); if (!vs.length) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; if (!RM) v.play().catch(() => {}); } else v.pause();
    }), { rootMargin: '200px 0px' });
    vs.forEach(v => { v.muted = true; v.playsInline = true; io.observe(v); });
  }

  function draftbar() {
    try { if (sessionStorage.getItem('fcs-draft-x')) return; } catch (e) {}
    const b = document.createElement('div'); b.className = 'draftbar';
    b.innerHTML = '<span class="dot" style="color:#ffb020"></span><span>Entwurf · Vorschau für den Vorstand</span><button type="button" aria-label="Hinweis schließen">×</button>';
    b.querySelector('button').onclick = () => { b.remove(); try { sessionStorage.setItem('fcs-draft-x', 1); } catch (e) {} };
    document.body.appendChild(b);
  }

  function magnets() {
    if (!FINE || RM || !has('gsap')) return;
    $$('.btn, .social a').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * .18, y: (e.clientY - r.top - r.height / 2) * .28, duration: .4, ease: 'power3.out' }); });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.4)' }));
    });
  }

  /* ---------- Formulare (Entwurf: alles an Falcon Eye) ---------- */
  FCS.send = async (form, extra = {}) => {
    const mail = (D.verein || {}).formMail || 'info@falcon-eye.de';
    const fd = new FormData(form);
    if (fd.get('_honey')) return { ok: true };
    Object.entries(extra).forEach(([k, v]) => v instanceof Blob ? fd.append(k, v, k + '.png') : fd.append(k, v));
    fd.append('_template', 'table'); fd.append('_captcha', 'false');
    const hasFile = [...fd.values()].some(v => v instanceof Blob && v.size);
    const res = await fetch('https://formsubmit.co/ajax/' + mail, hasFile
      ? { method: 'POST', body: fd, headers: { Accept: 'application/json' }, credentials: 'omit' }
      : { method: 'POST', body: JSON.stringify(Object.fromEntries([...fd.entries()].filter(([, v]) => !(v instanceof Blob)))), headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'omit' });
    let j = {}; try { j = await res.json(); } catch (e) {}
    return { ok: res.ok && String(j.success) !== 'false', j };
  };
  function forms() {
    $$('form[data-fcs-form]').forEach(f => {
      f.addEventListener('submit', async e => {
        e.preventDefault();
        if (!validate(f)) return;
        const btn = f.querySelector('[type=submit]'); const t = btn && btn.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<span>Wird gesendet …</span>'; }
        let r = { ok: false };
        try { r = await FCS.send(f, f._extra ? f._extra() : {}); } catch (err) { r = { ok: false }; }
        if (btn) { btn.disabled = false; btn.innerHTML = t; }
        const ok = f.querySelector('.form-ok'), bad = f.querySelector('.form-bad');
        if (r.ok) { f.classList.add('sent'); if (ok) { ok.hidden = false; if (has('gsap')) gsap.fromTo(ok, { scale: .9, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(2)' }); } f.dispatchEvent(new CustomEvent('fcs:sent')); }
        else if (bad) bad.hidden = false;
      });
    });
  }
  function validate(f) {
    let first = null;
    $$('[required]', f).forEach(i => {
      const fld = i.closest('.field') || i.closest('.check');
      const okv = i.type === 'checkbox' ? i.checked : i.checkValidity() && String(i.value).trim() !== '';
      const custom = i.dataset.check && FCS.checks[i.dataset.check] ? FCS.checks[i.dataset.check](i.value) : true;
      const ok = okv && custom;
      if (fld) fld.classList.toggle('bad', !ok);
      if (!ok && !first) first = i;
    });
    if (first) { first.focus({ preventScroll: true }); (FCS.lenis ? FCS.lenis.scrollTo(first, { offset: -140 }) : first.scrollIntoView({ block: 'center' })); return false; }
    return true;
  }
  FCS.validate = validate;
  FCS.checks = {
    iban: (v) => {
      const s = v.replace(/\s+/g, '').toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
      const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
      let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1;
    }
  };

  function year() { $$('[data-year]').forEach(e => e.textContent = new Date().getFullYear()); }
  function nextBadge() {
    const n = FCS.next(); $$('[data-next]').forEach(el => {
      if (!n) { el.textContent = 'Neue Termine folgen'; return; }
      el.textContent = `${FCS.fmtDate(n.d)} · ${n.halle.name.replace('Großwaldhalle ', '').replace('Glück-Auf-Halle ', '')}`;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
