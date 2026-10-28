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
    const h = (D.hallen || {})[t.h] || { name: 'Halle im Saarland', adresse: 'Ort nur für Mitglieder', geheim: true };
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
      'DESCRIPTION:Tiny Whoops in der Halle mit dem Flight Club Saar.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
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

  /* ---------- Mitglieder-Bereich (Natan 28.10.2026: Spots und Hallenfliegen nur für Mitglieder, genau wie Gyroflow).
     Jedes Mitglied meldet sich mit seinem eigenen Mitgliedscode FCS-XXXX-XXXX an (dieselben Codes wie im Clip-Studio,
     Make-Datenspeicher 231679). Make prüft den Code und gibt den Vereinsschlüssel zurück; damit entschlüsselt der Browser
     Hallen, Halle je Termin und Spots aus assets/data/mitglieder.enc.json (PBKDF2 + AES-GCM, gleiches Verfahren wie
     quellen/mitglieder_verschluesseln.py). Gemeldete Spots gehen verschlüsselt an den Server. */
  const MKEY = 'fcs-mitglied', BKEY = 'fcs-bereich';
  const M = FCS.member = { ok: false, key: null };
  const mNorm = c => String(c || '').toUpperCase().replace(/[\s\-_.]/g, '');
  const fcsCode = s => { const r = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), c = r.startsWith('FCS') ? r.slice(3) : r; return c.length === 8 ? `FCS-${c.slice(0, 4)}-${c.slice(4)}` : String(s || '').trim().toUpperCase(); };
  const lsJ = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} };
  const u8 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const b64 = a => { let s = ''; a.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  async function mDerive(code) {
    const te = new TextEncoder(), base = await crypto.subtle.importKey('raw', te.encode(mNorm(code)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('flight-club-saar|mitglieder|v1'), iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  // Mitgliedscode bei Make prüfen: { ok, n, bis, k } oder { ok:false } oder { net:true }
  async function mCheck(code) {
    const api = ((D.api || {}).bereich || '').trim(); if (!api) return { ok: false, net: true };
    try {
      const u = new URL(api); u.searchParams.set('c', code);
      const ac = 'AbortController' in window ? new AbortController() : null; const to = ac && setTimeout(() => ac.abort(), 8000);
      const r = await fetch(u, { credentials: 'omit', cache: 'no-store', signal: ac && ac.signal }); clearTimeout(to);
      const j = await r.json().catch(() => null);
      return j && j.ok && j.k ? { ok: true, n: String(j.n || '').slice(0, 40), bis: +j.bis || null, k: String(j.k) } : { ok: false };
    } catch (e) { return { ok: false, net: true }; }
  }
  M.isEnc = s => typeof s === 'string' && s.startsWith('enc1:');
  M.dec = async (s, key = M.key) => { const raw = u8(String(s).slice(5)); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))); };
  M.enc = async (text) => { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, M.key, new TextEncoder().encode(text))); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return 'enc1:' + b64(out); };
  async function mLoad(key) { const r = await fetch('assets/data/mitglieder.enc.json', { cache: 'no-cache' }); const j = await r.json(); return JSON.parse(await M.dec(j.data, key)); }
  function mApply(sec) {
    if (D.hallen) Object.assign(D.hallen, sec.hallen || {}); else D.hallen = sec.hallen || {};
    if (Array.isArray(sec.termine)) D.termine = sec.termine.map(t => Object.assign({}, t)).sort((a, b) => a.d < b.d ? -1 : 1);
    else if (sec.termine) D.termine = Object.keys(sec.termine).sort().map(d => ({ d, h: sec.termine[d] }));
    if (Array.isArray(D.spots)) D.spots.push(...(sec.spots || [])); else D.spots = sec.spots || [];
  }
  // Anmelden mit dem eigenen Mitgliedscode: gilt danach auch im Clip-Studio (Gyroflow, Premium)
  M.unlock = async (input) => {
    const c = fcsCode(input);
    if (!/^FCS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c)) return 'form';
    const r = await mCheck(c); if (!r.ok) return r.net ? 'net' : 'nein';
    if (r.bis && r.bis < new Date().getFullYear()) return 'alt';
    try { const key = await mDerive(r.k); await mLoad(key); } catch (e) { return 'nein'; }
    lsS(BKEY, r.k); lsS(MKEY, { c, n: r.n, bis: r.bis });
    return 'ok';
  };
  M.logout = () => { lsS(BKEY, null); lsS(MKEY, null); location.reload(); };
  M.ready = (async () => {
    if (!window.crypto || !crypto.subtle) return false;
    const m = lsJ(MKEY); if (!m || !m.c || (m.bis && m.bis < new Date().getFullYear())) return false;
    const tryKey = async k => { const key = await mDerive(k); const sec = await mLoad(key); M.key = key; mApply(sec); M.ok = true; M.name = m.n; document.documentElement.classList.add('is-member'); return true; };
    const k = (() => { try { return localStorage.getItem(BKEY); } catch (e) { return null; } })();
    if (k) { try { return await tryKey(k); } catch (e) {} }
    // Im Clip-Studio angemeldet oder neuer Jahresschlüssel: Schlüssel einmal mit dem eigenen Code holen
    const r = await mCheck(m.c);
    if (r.ok) { try { await tryKey(r.k); lsS(BKEY, r.k); return true; } catch (e) {} }
    else if (!r.net) lsS(MKEY, null);
    return false;
  })();
  // Sperr-Kasten: <div data-mitglied-lock="Titel|Text"></div>
  function locks() {
    // Inhaltsverzeichnis nur mit den sichtbaren Abschnitten
    $$(M.ok ? '.nur-gast[data-toc]' : '.nur-mitglied[data-toc]').forEach(el => el.removeAttribute('data-toc'));
    const wa = ((D.kontakte || [])[0] || {}).wa;
    $$('[data-mitglied-lock]').forEach((el, i) => {
      const [t, x] = (el.dataset.mitgliedLock || '').split('|');
      if (M.ok) { el.innerHTML = `<p class="ml-in hud"><span class="dot" aria-hidden="true"></span>${M.name ? `Hallo ${M.name.replace(/[<>&"]/g, '')}, ` : ''}Mitglieder-Bereich freigeschaltet <button type="button" class="ml-out">Abmelden</button></p>`; $('.ml-out', el).onclick = M.logout; return; }
      el.innerHTML = `<div class="ml-box">
        <svg class="ml-ic" viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="21" width="28" height="21" rx="4"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/><circle cx="24" cy="31" r="3"/><path d="M24 34v3"/></svg>
        <div class="ml-txt"><h3 class="h3">${t || 'Nur für Mitglieder'}</h3><p>${x || 'Mit deinem Mitgliedscode siehst du alles.'}</p></div>
        <form class="ml-form" novalidate><label for="ml-c${i}">Dein Mitgliedscode</label><div class="ml-row"><input id="ml-c${i}" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="FCS-XXXX-XXXX" required><button class="btn amber solid" type="submit">Freischalten</button></div>
        <p class="ml-err" role="alert" hidden></p></form>
        <p class="ml-alt">Noch kein Mitglied? <a href="mitglied.html">Mitglied werden</a>${wa ? ` · Code vergessen? <a href="https://wa.me/${wa}?text=${encodeURIComponent('Hallo, ich bin Mitglied im Flight Club Saar und brauche meinen Mitgliedscode für die Website.')}" target="_blank" rel="noopener">Vorstand fragen</a>` : ''}</p>
      </div>`;
      const f = $('form', el), inp = $('input', f), err = $('.ml-err', f), btn = $('button', f);
      f.addEventListener('submit', async e => {
        e.preventDefault(); if (!inp.value.trim()) { inp.focus(); return; }
        btn.disabled = true; const bt = btn.textContent; btn.textContent = 'Prüfe …'; err.hidden = true;
        const res = await M.unlock(inp.value);
        if (res === 'ok') { btn.textContent = 'Freigeschaltet'; location.reload(); return; }
        err.textContent = { form: 'Dein Code hat die Form FCS-XXXX-XXXX.', net: 'Gerade keine Verbindung, versuch es gleich nochmal.', alt: 'Dieser Code ist abgelaufen. Den neuen Code bekommst du vom Vorstand.' }[res] || 'Dieser Code stimmt nicht. Achte auf die Schreibweise oder frag den Vorstand.';
        btn.disabled = false; btn.textContent = bt; err.hidden = false; inp.select();
      });
    });
  }

  /* ---------- Nach dem Laden ---------- */
  function init() {
    if (has('gsap')) {
      const plugins = ['ScrollTrigger', 'SplitText', 'Draggable', 'InertiaPlugin', 'DrawSVGPlugin', 'MotionPathPlugin', 'ScrambleTextPlugin', 'Observer'].filter(has).map(n => window[n]);
      gsap.registerPlugin(...plugins);
    }
    locks(); smooth(); nav(); toc(); reveal(); counters(); glow(); reticle(); twoclick(); videos(); draftbar(); magnets(); forms(); year(); nextBadge();
    document.dispatchEvent(new CustomEvent('fcs:ready'));
  }

  /* Natives Scrollen (ruckelt nicht). Sprungmarken gleiten mit Abstand zur Leiste oben. */
  FCS.scrollTo = (target, off = -84) => {
    let el = typeof target === 'string' ? $(target) : target; if (!el && typeof target !== 'number') return;
    if (el && el.nodeType === 1 && !M.ok && el.closest('.nur-mitglied')) el = (el.id && $('#' + el.id + '-gast')) || $('[data-mitglied-lock]') || el;
    const y = typeof target === 'number' ? target : el.getBoundingClientRect().top + scrollY + off - (document.body.classList.contains('has-toc') ? 52 : 0);
    window.scrollTo({ top: Math.max(0, y), behavior: RM ? 'auto' : 'smooth' });
  };
  function smooth() {
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a) return;
      const u = new URL(a.href, location.href); if (u.pathname !== location.pathname || !u.hash || u.hash.length < 2) return;
      let el = null; try { el = $(decodeURIComponent(u.hash)); } catch (err) {} if (!el) return;
      e.preventDefault(); FCS.scrollTo(el); history.replaceState(null, '', u.hash);
    });
    // Beim Öffnen mit #abschnitt erst nach dem Aufbau springen
    if (location.hash.length > 1) setTimeout(() => { let el = null; try { el = $(decodeURIComponent(location.hash)); } catch (err) {} if (el) FCS.scrollTo(el); }, 450);
  }

  function nav() {
    const n = $('.nav'); if (!n) return;
    let last = 0;
    const on = () => {
      const y = scrollY; n.classList.toggle('solid', y > 40);
      if (y > 420 && y > last + 6 && !document.body.classList.contains('menu-open')) n.classList.add('hide');
      else if (y < last - 6 || y < 420) n.classList.remove('hide');
      document.body.classList.toggle('nav-hidden', n.classList.contains('hide'));
      const tt = $('.totop'); if (tt) tt.classList.toggle('on', y > innerHeight * 1.6);
      last = y;
    };
    addEventListener('scroll', on, { passive: true }); on();
    const b = $('.burger'), m = $('.menu');
    const setOpen = open => {
      b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen'); m.classList.toggle('open', open); document.body.classList.toggle('menu-open', open);
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open && has('gsap') && !RM) gsap.fromTo($$('.menu .mt'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: .035, duration: .6, ease: 'expo.out', delay: .12 });
    };
    if (b && m) {
      b.addEventListener('click', () => setOpen(b.getAttribute('aria-expanded') !== 'true'));
      $$('.menu a').forEach(a => a.addEventListener('click', () => setOpen(false)));
      addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) setOpen(false); });
    }
    // Nach oben
    const tt = document.createElement('button'); tt.type = 'button'; tt.className = 'totop'; tt.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span class="sr">Nach oben</span>';
    tt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' })); document.body.appendChild(tt);
  }

  /* Inhaltsverzeichnis: Abschnitte mit data-toc="Name" werden zu einer Leiste, die oben mitläuft */
  function toc() {
    const secs = $$('main [data-toc]'); if (secs.length < 2) return;
    const bar = document.createElement('nav'); bar.className = 'toc'; bar.setAttribute('aria-label', 'Auf dieser Seite');
    bar.innerHTML = `<div class="toc-in"><span class="toc-l">Auf dieser Seite</span>${secs.map((s, i) => { if (!s.id) s.id = 'abschnitt-' + (i + 1); return `<a href="#${s.id}" data-i="${i}"><b>${String(i + 1).padStart(2, '0')}</b>${s.dataset.toc}</a>`; }).join('')}</div>`;
    const head = $('main .pagehead'); head ? head.after(bar) : $('main').prepend(bar);
    document.body.classList.add('has-toc');
    const links = $$('a', bar), inner = $('.toc-in', bar);
    let cur = -1;
    const mark = i => { if (i === cur) return; cur = i; links.forEach((a, k) => a.classList.toggle('on', k === i)); const a = links[i]; if (a) inner.scrollTo({ left: a.offsetLeft - inner.clientWidth / 2 + a.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth' }); };
    const upd = () => { const y = innerHeight * .35; let i = 0; secs.forEach((s, k) => { if (s.getBoundingClientRect().top < y) i = k; }); mark(i); };
    addEventListener('scroll', upd, { passive: true }); upd();
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
      // Jahreszahlen ohne Tausenderpunkt (2022, nicht 2.022)
      const fmt = v => el.dataset.from && to > 1900 && to < 2100 ? String(Math.round(v)) : v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (RM || !has('gsap')) { el.textContent = pre + fmt(to) + suf; return; }
      const o = { v: parseFloat(el.dataset.from || 0) };
      gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: () => el.textContent = pre + fmt(o.v) + suf });
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
    // Genauer Zeiger = Fadenkreuz aus dem FPV-OSD mit künstlichem Horizont (Natan 28.10.: größer und passend zum Thema)
    const dot = document.createElement('div'); dot.className = 'cdot'; dot.setAttribute('aria-hidden', 'true');
    const arms = '<path d="M0-7V-16M0 7V16M-7 0H-16M7 0H16"/>';
    dot.innerHTML = `<svg viewBox="-34 -34 68 68"><g class="cx-hz"><path class="o" d="M-30 0H-20V5M30 0H20V5"/><path d="M-30 0H-20V5M30 0H20V5"/></g><g class="cx-ar"><g class="o">${arms}</g><g>${arms}</g></g><circle class="cx-c" r="2.6"/></svg>`;
    document.body.appendChild(dot);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, vx = 0, vy = 0, flip = 0, lock = null;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; r.classList.add('on'); dot.classList.add('on');
      const t = e.target.closest && e.target.closest('a,button,[role=button],label,select,summary,[data-hot],.rpin,.mcard');
      const typing = e.target.closest && e.target.closest('input,textarea,[contenteditable]');
      lock = t && !typing ? t : null; r.classList.toggle('lock', !!lock); L.classList.toggle('on', !!lock); r.classList.toggle('hide', !!typing); dot.classList.toggle('hide', !!typing);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { r.classList.remove('on'); dot.classList.remove('on'); });
    addEventListener('pointerdown', () => { flip = 1; r.classList.add('boost'); setTimeout(() => r.classList.remove('boost'), 260); });
    let ang = 0, px = x, hz = 0;
    const hzEl = dot.querySelector('.cx-hz');
    const loop = () => {
      // Feder-Dämpfer: fliegt wie ein Kopter hinterher
      const ax = (tx + 30 - x) * .09, ay = (ty + 30 - y) * .09; // fliegt als Begleiter schräg hinter dem Fadenkreuz vx = (vx + ax) * .72; vy = (vy + ay) * .72; x += vx; y += vy;
      if (flip > 0) { ang += 24; if (ang >= 360) { ang = 0; flip = 0; } }
      const bank = Math.max(-38, Math.min(38, vx * 2.2)), pitch = Math.max(-38, Math.min(38, -vy * 2.2));
      r.style.transform = `translate(${x}px,${y}px) perspective(300px) rotateX(${pitch}deg) rotateY(${bank}deg) rotate(${ang}deg)`;
      dot.style.transform = `translate(${tx}px,${ty}px)`;
      hz += (Math.max(-32, Math.min(32, (tx - px) * 1.6)) - hz) * .18; px = tx; hzEl.style.transform = `rotate(${hz.toFixed(1)}deg)`;
      dot.classList.toggle('lock', !!lock);
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

  /* Kleiner Entwurfs-Hinweis unten links: klappt nach ein paar Sekunden zu einem Punkt zusammen */
  function draftbar() {
    try { if (sessionStorage.getItem('fcs-draft-x')) return; } catch (e) {}
    const b = document.createElement('aside'); b.className = 'draftbar'; b.setAttribute('aria-label', 'Hinweis');
    b.innerHTML = '<span class="dot" style="color:#ffb020"></span><span class="db-t">Entwurf · Vorschau für den Vorstand</span><button type="button" aria-label="Hinweis schließen">×</button>';
    b.querySelector('button').onclick = () => { b.remove(); try { sessionStorage.setItem('fcs-draft-x', 1); } catch (e) {} };
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('mini'), 5000);
    b.addEventListener('pointerenter', () => b.classList.remove('mini')); b.addEventListener('pointerleave', () => b.classList.add('mini'));
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
  // Kurze Nachricht an den Vorstand ohne sichtbares Formular (zum Beispiel „Löschcode vergessen“, „Beitrag melden“, „Neue Anzeige“)
  FCS.notify = async (subject, fields = {}) => {
    const mail = (D.verein || {}).formMail || 'info@falcon-eye.de';
    const body = Object.assign({ _subject: subject, _template: 'table', _captcha: 'false', Seite: location.href }, fields);
    try {
      const res = await fetch('https://formsubmit.co/ajax/' + mail, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'omit' });
      let j = {}; try { j = await res.json(); } catch (e) {}
      return { ok: res.ok && String(j.success) !== 'false' };
    } catch (e) { return { ok: false }; }
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
    if (first) { first.focus({ preventScroll: true }); FCS.scrollTo(first, -160); return false; }
    return true;
  }
  /* ---------- Live-Beiträge (Make: Markt, Pinnwand, Spots, Termine) ----------
     FCS.board.list(b)            → [{id,b,art,kat,titel,t,preis,zustand,ort,kontakt,link,n,ig,st,th,nf,d}] neueste zuerst; b ist ein Präfix ('markt', 'pinnwand', 'spot:', 'spot:eiweiler', 'termin:')
     FCS.board.add(fields, files) → {ok, id, pw}  fields: b (Pflicht), n (Pflicht), pw (Löschcode, sonst automatisch), titel, t, art, kat, preis, zustand, ort, kontakt, link, ig, st
                                    files: bis zu 3 Bild-Dateien; werden im Browser verkleinert (720 px, Vorschaubild 200 px)
     FCS.board.del(id, pw)        → {ok} oder {ok:false, err:'code'}
     FCS.board.foto(id, i)        → Bild-URL (direkt in <img src> nutzbar, wird vom Browser gecacht)
     FCS.board.mine()             → {id: {pw, b, t}} Beiträge, die auf diesem Gerät erstellt wurden (Löschcode gemerkt) */
  FCS.board = (() => {
    const url = () => ((D.api || {}).beitraege || '');
    const KEY = 'fcs-meine-beitraege';
    const cache = new Map();
    const sig = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
    const hex = async (t) => { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };
    const mine = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const remember = (id, v) => { try { const m = mine(); if (v) m[id] = v; else delete m[id]; localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} };
    const code = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(6)); return [...r].map(x => a[x % a.length]).join(''); };
    const shrink = (file, max, q) => new Promise((res, rej) => {
      const im = new Image(), u = URL.createObjectURL(file);
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
        let d = cv.toDataURL('image/webp', q); if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', q);
        res(d);
      };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bild')); };
      im.src = u;
    });
    async function list(b = '', { fresh = false } = {}) {
      if (!url()) return [];
      const ck = 'fcs-b:' + b;
      if (!fresh) {
        if (cache.has(ck)) return cache.get(ck);
        try { const s = JSON.parse(sessionStorage.getItem(ck) || 'null'); if (s && Date.now() - s.at < 120000) { cache.set(ck, s.list); return s.list; } } catch (e) {}
      }
      const r = await fetch(url() + '?a=list&b=' + encodeURIComponent(b), { signal: sig(12000), credentials: 'omit' });
      const j = await r.json(); const out = Array.isArray(j.list) ? j.list.filter(x => x && x.id) : [];
      cache.set(ck, out); try { sessionStorage.setItem(ck, JSON.stringify({ at: Date.now(), list: out })); } catch (e) {}
      return out;
    }
    const drop = () => { cache.clear(); try { Object.keys(sessionStorage).filter(k => k.startsWith('fcs-b:')).forEach(k => sessionStorage.removeItem(k)); } catch (e) {} };
    async function add(fields, files = [], opts = {}) {
      if (!url()) return { ok: false, err: 'aus' };
      const f = Object.assign({}, fields); f.pw = String(f.pw || '').trim() || code();
      const p = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v != null && v !== '') p.append(k, String(v)); });
      p.set('a', 'add'); p.set('web', ''); p.set('k', (await hex(`${f.b}|${f.n}|fcs-beitrag-2026`)).slice(0, 10));
      const imgs = [...files].filter(Boolean).slice(0, 3);
      if (imgs.length) {
        // Größen passend zu den Grenzen im Make-Szenario: Vorschaubild < 40 000 Zeichen, Foto < 180 000 Zeichen
        const fit = async (file, steps, limit) => { let d = ''; for (const [mx, q] of steps) { d = await shrink(file, mx, q); if (d.length < limit) return d; } return d.length < limit ? d : ''; };
        const th = await fit(imgs[0], [[200, .55], [160, .45], [120, .4]], 38000); if (th) p.set('th', th);
        let n = 0;
        for (let i = 0; i < imgs.length; i++) { const d = await fit(imgs[i], [[720, .62], [720, .5], [600, .45], [480, .4]], 170000); if (!d) continue; p.set('m', d.slice(5, d.indexOf(';'))); p.set('f' + n++, d.slice(d.indexOf(',') + 1)); }
      }
      let txt = '';
      try { const r = await fetch(url(), { method: 'POST', body: p, signal: sig(30000), credentials: 'omit' }); txt = await r.text(); } catch (e) { return { ok: false, err: 'netz' }; }
      let j = {}; try { j = JSON.parse(txt); } catch (e) { return { ok: false, err: 'abgelehnt' }; }
      if (j.ok && j.id) { if (opts.merken !== false) remember(j.id, { pw: f.pw, b: f.b, t: f.titel || f.t || '', d: new Date().toISOString().slice(0, 10) }); drop(); return { ok: true, id: j.id, pw: f.pw }; }
      return { ok: false, err: 'abgelehnt' };
    }
    async function del(id, pw) {
      if (!url()) return { ok: false, err: 'aus' };
      let j = {};
      try { const r = await fetch(url() + '?a=del&id=' + encodeURIComponent(id) + '&pw=' + encodeURIComponent(String(pw || '').trim()), { signal: sig(15000), credentials: 'omit' }); j = JSON.parse(await r.text()); } catch (e) { return { ok: false, err: 'netz' }; }
      if (j.ok) { remember(id, null); drop(); }
      return j.ok ? { ok: true } : { ok: false, err: j.err || 'code' };
    }
    const foto = (id, i = 0) => url() + '?a=foto&id=' + encodeURIComponent(id) + '&i=' + i;
    return { list, add, del, foto, mine, code, on: () => !!url() };
  })();

  FCS.validate = validate;
  // Fehlermarkierung verschwindet, sobald man das Feld korrigiert
  const unbad = e => { const fld = e.target.closest && (e.target.closest('.field.bad') || e.target.closest('.check.bad')); if (fld) fld.classList.remove('bad'); };
  document.addEventListener('input', unbad, true); document.addEventListener('change', unbad, true);
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
      if (!M.ok) { el.textContent = el.dataset.next === 'kurz' ? '' : 'für Mitglieder'; return; }
      if (!n) { el.textContent = 'Neue Termine folgen'; return; }
      el.textContent = el.dataset.next === 'kurz' ? FCS.fmtDate(n.d) : `${FCS.fmtDate(n.d)} · ${n.halle.name.replace('Großwaldhalle ', '').replace('Glück-Auf-Halle ', '')}`;
    });
  }

  const start = () => M.ready.then(init, init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
