/* Biete/Suche: Etiketten-Schiene, Wegpunkte mit Drohne, Wand mit Akku-Laufzeit, Bandscan-Leerzustand,
   Formular mit Foto-Verkleinerung und Live-Vorschau, Community-Orbit, Preflight-Check, Detailansicht. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const DAY = 864e5, RUN = 30, MAXPX = 1400, BUDGET = 8 * 1024 * 1024, SAFE = 7.4 * 1024 * 1024;
  let D = {};
  const anim = () => !!window.gsap && !RM;
  const scramble = () => anim() && !!window.ScrambleTextPlugin;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  const scrollToEl = (el, off = -80) => { if (!el) return; FCS.lenis ? FCS.lenis.scrollTo(el, { offset: off }) : el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const visible = (el, cb, margin = '150px 0px') => { if (!el) return; const io = new IntersectionObserver(es => cb(es[0].isIntersecting), { rootMargin: margin }); io.observe(el); };

  /* ---------- Symbole (eigene Linien-Icons, 24er Raster) ---------- */
  const P = {
    kopter: '<path d="M8.4 8.4L10 10M14 14l1.6 1.6M15.6 8.4L14 10M10 14l-1.6 1.6"/><circle cx="6" cy="6" r="3.2"/><circle cx="18" cy="6" r="3.2"/><circle cx="6" cy="18" r="3.2"/><circle cx="18" cy="18" r="3.2"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
    brille: '<path d="M3 10a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 10v3.5a2.5 2.5 0 0 1-2.5 2.5h-3.2a2 2 0 0 1-1.8-1.1l-.6-1.2a1 1 0 0 0-1.8 0l-.6 1.2A2 2 0 0 1 8.7 16H5.5A2.5 2.5 0 0 1 3 13.5z"/><path d="M1.5 11.5H3M21 11.5h1.5M16.5 7.5V4.5"/>',
    funke: '<rect x="3" y="9" width="18" height="11" rx="3"/><circle cx="8" cy="14.5" r="2"/><circle cx="16" cy="14.5" r="2"/><path d="M12 9V3.5M10.5 3.5h3"/>',
    akkus: '<rect x="2.5" y="7" width="14" height="11" rx="2"/><path d="M16.5 10c2.6 0 2.4-3 5-3M16.5 15c2.6 0 2.4 3 5 3"/><path d="M10.2 9.3l-2.2 3.4h3l-2.2 3.4"/>',
    teile: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20"/>',
    werkzeug: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    sonstiges: '<path d="M16.5 9.4l-9-5.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    cam: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 13.3l7.4 4.3M15.7 6.4l-7.4 4.3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>'
  };
  const WA = '<svg class="mk-i" data-wa viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>';
  const ico = (k) => k === 'wa' ? WA : `<svg class="mk-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[k] || P.sonstiges}</svg>`;
  const QUAD = `<svg viewBox="-50 -50 100 100"><circle class="q-ring" r="46"/><path class="q-arm" d="M-24-24L24 24M24-24L-24 24"/><rect class="q-body" x="-11" y="-11" width="22" height="22" rx="6" transform="rotate(45)"/>${[[-24, -24], [24, -24], [-24, 24], [24, 24]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><circle class="q-pr" r="12"/><path class="q-bl ${i % 2 ? 'ccw' : ''}" d="M-11 0H11"/></g>`).join('')}</svg>`;

  /* ---------- Kategorien, Zustand, Preis, Laufzeit ---------- */
  const KAT = [
    { k: 'kopter', n: 'Kopter', c: '#3fe0ff' }, { k: 'brille', n: 'Brille', c: '#ffb020' }, { k: 'funke', n: 'Funke', c: '#3ee08a' },
    { k: 'akkus', n: 'Akkus', c: '#ff6b7a' }, { k: 'teile', n: 'Teile', c: '#5aa2ff' }, { k: 'werkzeug', n: 'Werkzeug', c: '#ffd36b' },
    { k: 'sonstiges', n: 'Sonstiges', c: '#c78bff' }
  ];
  const KM = Object.fromEntries(KAT.map(k => [k.k, k]));
  const katOf = (k) => KM[norm(k)] || KAT.find(x => norm(x.n) === norm(k)) || KM.sonstiges;
  const ZU = { neu: 'Neu', 'wie neu': 'Wie neu', gebraucht: 'Gebraucht', defekt: 'Defekt / Bastler' };
  const zust = (z) => { if (!z) return ''; const s = norm(z); if (s.startsWith('defekt') || s.includes('bastler')) return ZU.defekt; return ZU[s] || String(z); };
  const eur = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' €';
  function priceText(ad) {
    const p = ad.preis;
    if (typeof p === 'number' && isFinite(p)) return p === 0 ? 'Zu verschenken' : (ad.art === 'suche' ? 'bis ' : '') + eur(p);
    const s = String(p == null ? '' : p).trim();
    if (!s) return ad.art === 'suche' ? 'Budget offen' : 'VB';
    if (/^\d+([.,]\d+)?$/.test(s)) return (ad.art === 'suche' ? 'bis ' : '') + eur(parseFloat(s.replace(',', '.')));
    return s;
  }
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  function life(ad) {
    const start = new Date(String(ad.d) + 'T00:00:00');
    if (isNaN(start)) return { left: -1, days: 0, frac: 0 };
    const end = new Date(start.getTime() + RUN * DAY), left = (end - Date.now()) / DAY;
    return { start, end, left, days: clamp(Math.ceil(left), 0, RUN), frac: clamp(left / RUN, 0, 1) };
  }
  const batColor = (f) => f > .5 ? 'var(--green)' : f > .2 ? 'var(--amber)' : 'var(--red)';
  const volt = (f) => (3.3 + .9 * f).toFixed(2) + 'V';
  const sid = (s) => String(s || '').replace(/[^\w-]/g, '').slice(0, 60);
  function ads() {
    const raw = Array.isArray(D.markt) ? D.markt : [];
    return raw.map((a, i) => a && Object.assign({}, a, { id: sid(a.id) || 'a' + i, art: norm(a.art) === 'suche' ? 'suche' : 'biete', img: (Array.isArray(a.img) ? a.img : a.img ? [a.img] : []).filter(Boolean) }))
      .filter(a => a && a.titel && life(a).left > 0)
      .sort((a, b) => String(b.d).localeCompare(String(a.d)));
  }
  function contacts(ad) {
    const raw = [ad.kontakt, ad.wa, ad.mail].filter(Boolean).join(' · ');
    const mails = raw.match(/[^\s,;|·<>()]+@[^\s,;|·<>()]+\.[a-z]{2,}/gi) || [];
    let rest = raw; mails.forEach(m => rest = rest.replace(m, ' '));
    const phones = (rest.match(/\+?\d[\d\s/().-]{5,}\d/g) || []).map(p => {
      let d = p.replace(/[^\d+]/g, '');
      if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '49' + d.slice(1);
      return d.length >= 9 ? d : '';
    }).filter(Boolean);
    return { mail: mails[0] || '', wa: phones[0] || '' };
  }

  /* ---------- Karte ---------- */
  function batHTML(L) {
    return `<span class="mk-bat${L.frac <= .2 ? ' low' : ''}" style="--lvl:${L.frac.toFixed(3)};--bc:${batColor(L.frac)}" data-frac="${L.frac.toFixed(3)}" data-days="${L.days}" title="Noch ${L.days} ${L.days === 1 ? 'Tag' : 'Tage'} sichtbar"><span class="mk-bat-v">${volt(L.frac)}</span><span class="mk-bat-b"><i></i></span><span class="mk-bat-d">${L.days} T</span></span>`;
  }
  function mediaHTML(ad) {
    const k = katOf(ad.kat), img = ad.img[0];
    return img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">`
      : `<div class="mk-noimg" style="--acc:${k.c}">${ico(k.k)}<span>${ad.link ? 'Fotos bei Kleinanzeigen' : ad.art === 'suche' ? 'Gesuch' : 'Kein Foto'}</span></div>`;
  }
  function cardHTML(ad, pv) {
    const k = katOf(ad.kat), L = pv ? { days: RUN, frac: 1 } : life(ad), z = zust(ad.zustand), ph = ad._ph || {};
    const title = pv ? `<span${ph.titel ? ' class="is-ph"' : ''}>${esc(ad.titel)}</span>` : `<a href="#a-${esc(ad.id)}" data-open="${esc(ad.id)}">${esc(ad.titel)}</a>`;
    const dd = new Date(String(ad.d) + 'T12:00:00');
    return `<article class="mk-card${ad.art === 'suche' ? ' is-suche' : ''}" data-id="${esc(ad.id)}" style="--acc:${k.c}">
      <div class="mk-media"><div class="mk-ph">${mediaHTML(ad)}</div><span class="mk-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="mk-art">${ad.art === 'suche' ? 'Suche' : 'Biete'}</span>${batHTML(L)}
        ${ad.img.length > 1 ? `<span class="mk-nimg">${ico('cam')}${ad.img.length}</span>` : ''}
        <span class="mk-price${ph.preis ? ' is-ph' : ''}" data-price>${esc(priceText(ad))}</span></div>
      <div class="mk-body"><h3 class="mk-title">${title}</h3>
        <p class="mk-meta"><span class="mk-kat${ph.kat ? ' is-ph' : ''}">${ico(k.k)}${k.n}</span>${z ? `<span>${esc(z)}</span>` : ''}</p>
        <p class="mk-by"><span>von <b${ph.n ? ' class="is-ph"' : ''}>${esc(ad.n || 'Pilot')}</b></span><span>${isNaN(dd) ? '' : dd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span></p></div>
      ${pv ? '<div class="mk-pvbar">Vorschau · noch nicht veröffentlicht</div>' : ''}
    </article>`;
  }
  function drainBattery(bat, delay = 0) {
    if (!bat) return;
    const f = parseFloat(bat.dataset.frac), days = +bat.dataset.days;
    if (!anim()) return;
    const o = { v: 1 }, v = $('.mk-bat-v', bat), d = $('.mk-bat-d', bat);
    gsap.fromTo(o, { v: 1 }, { v: f, duration: 1.8, delay, ease: 'power2.inOut', onUpdate: () => {
      bat.style.setProperty('--lvl', o.v.toFixed(3)); bat.style.setProperty('--bc', batColor(o.v));
      v.textContent = volt(o.v); d.textContent = Math.max(days, Math.ceil(o.v * RUN)) + ' T';
    } });
  }
  function scramblePrice(el, text, from) {
    if (!el) return;
    if (!scramble()) { el.textContent = text; return; }
    gsap.to(el, { duration: .9, scrambleText: { text, chars: '0123456789€', speed: .7, revealDelay: .15 }, overwrite: 'auto' });
  }

  /* ---------- Etiketten-Schiene im Kopf ---------- */
  function rail() {
    const box = $('#mk-rail'); if (!box) return;
    const LEN = [36, 92, 14, 66, 112, 28, 78];
    box.innerHTML = KAT.map((k, i) => `<div class="mk-slot" style="--len:${LEN[i]}px;--zi:${10 - Math.round(LEN[i] / 20)}"><button type="button" class="mk-hang" data-kat="${k.k}" style="--acc:${k.c}"><span class="mk-str"></span><span class="mk-tg"><span class="mk-tg-hole"></span>${ico(k.k)}<b>${k.n}</b><em data-tagcnt="${k.k}">0 Anzeigen</em><span class="sr">, Wand danach filtern</span></span></button></div>`).join('');
    const hs = $$('.mk-hang', box).map(el => ({ el, a: 0, w: 0 }));
    hs.forEach(h => h.el.addEventListener('click', () => { pickKat(h.el.dataset.kat); scrollToEl($('#wand'), -70); }));
    const hint = box.parentElement.querySelector('.mk-hint'); if (hint && !FINE) hint.lastChild.textContent = 'Wisch über die Etiketten oder tipp eins an, um direkt zu filtern.';
    if (hint && RM) hint.lastChild.textContent = 'Tipp ein Etikett an, um direkt zu filtern.';
    if (RM) return;
    let on = false, last = 0, px = null, touched = 0, gust = 0;
    if (anim()) gsap.from($$('.mk-tg', box), { y: -40, opacity: 0, rotationX: -70, transformOrigin: '50% 0', stagger: .07, duration: 1.1, ease: 'elastic.out(1,.55)', delay: .3 });
    box.addEventListener('pointermove', e => {
      if (px !== null) {
        const vx = clamp(e.clientX - px, -40, 40);
        hs.forEach(h => { const r = h.el.getBoundingClientRect(); if (e.clientX > r.left - 6 && e.clientX < r.right + 6 && e.clientY > r.top && e.clientY < r.bottom) h.w += vx * .22; });
      }
      px = e.clientX; touched = performance.now();
    }, { passive: true });
    box.addEventListener('pointerleave', () => { px = null; });
    const tick = (t) => {
      if (!on) return;
      const dt = clamp((t - (last || t)) / 16.67, 0, 3); last = t;
      // Selbst-Impuls: kleine Windböen, solange niemand die Etiketten anstößt
      if (t - touched > 2500 && t > gust) { const h = hs[Math.floor(Math.random() * hs.length)]; h.w += (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 3); gust = t + 900 + Math.random() * 1400; }
      hs.forEach(h => { h.w += (-.016 * h.a - .045 * h.w) * dt; h.a = clamp(h.a + h.w * dt, -32, 32); h.el.style.transform = `rotate(${h.a.toFixed(2)}deg) rotateY(${(h.a * .9).toFixed(2)}deg)`; });
      requestAnimationFrame(tick);
    };
    visible(box, v => { if (v && !on) { on = true; last = 0; requestAnimationFrame(tick); } else if (!v) on = false; });
  }

  /* ---------- Wegpunkte mit Drohne ---------- */
  function plan() {
    const box = $('.mk-wps-box'); if (!box) return;
    const wps = $$('.mk-wp', box), nodes = $$('.mk-wp-node', box), quad = $('.mk-quad', box), track = $('.mk-track', box), fill = $('.mk-track-fill', box);
    quad.innerHTML = QUAD;
    let pos = [], cur = 0, vert = false, pause = 0, timer = null;
    const measure = () => {
      const b = box.getBoundingClientRect();
      pos = nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; });
      vert = Math.abs(pos[2].y - pos[0].y) > Math.abs(pos[2].x - pos[0].x);
      track.classList.toggle('v', vert);
      Object.assign(track.style, vert ? { left: pos[0].x - 1 + 'px', top: pos[0].y + 'px', width: '2px', height: pos[2].y - pos[0].y + 'px' } : { left: pos[0].x + 'px', top: pos[0].y - 1 + 'px', height: '2px', width: pos[2].x - pos[0].x + 'px' });
      if (window.gsap) gsap.set(quad, { x: pos[cur].x, y: pos[cur].y });
      else quad.style.transform = `translate(${pos[cur].x}px,${pos[cur].y}px)`;
      setFill(cur, true);
    };
    const setFill = (i, now) => {
      const s = i / (pos.length - 1 || 1), prop = vert ? 'scaleY' : 'scaleX';
      if (window.gsap) gsap.to(fill, { [prop]: s, [vert ? 'scaleX' : 'scaleY']: 1, duration: now || !anim() ? 0 : 1.1, ease: 'power2.inOut' });
      else fill.style.transform = `${prop}(${s})`;
    };
    const mark = (i) => wps.forEach((w, j) => { w.classList.toggle('on', j === i); w.classList.toggle('here', j === i); w.classList.toggle('done', j < i); });
    const go = (i) => {
      const from = cur; cur = i; mark(i); setFill(i);
      if (!anim()) { if (window.gsap) gsap.set(quad, { x: pos[i].x, y: pos[i].y }); return; }
      const dir = vert ? (pos[i].y > pos[from].y ? 1 : -1) : (pos[i].x > pos[from].x ? 1 : -1);
      const dist = Math.hypot(pos[i].x - pos[from].x, pos[i].y - pos[from].y), dur = clamp(dist / 420, .5, 1.6);
      gsap.to(quad, { x: pos[i].x, y: pos[i].y, duration: dur, ease: 'power2.inOut', overwrite: 'auto' });
      gsap.timeline({ overwrite: 'auto' }).to(quad, { rotation: (vert ? 0 : 16) * dir, rotationX: vert ? 18 * dir : 0, scale: 1.15, duration: dur * .45, ease: 'power2.out' }).to(quad, { rotation: 0, rotationX: 0, scale: 1, duration: dur * .55, ease: 'back.out(2)' });
    };
    const loop = () => { clearTimeout(timer); timer = setTimeout(() => { if (performance.now() > pause) go((cur + 1) % 3); loop(); }, 2600); };
    wps.forEach((w, i) => {
      const b = $('.mk-wp-btn', w);
      b.addEventListener('click', () => { pause = performance.now() + 9000; go(i); });
      if (FINE) b.addEventListener('pointerenter', () => { pause = performance.now() + 9000; go(i); });
    });
    requestAnimationFrame(measure);
    addEventListener('resize', () => requestAnimationFrame(measure));
    if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(measure));
    mark(0);
    if (RM) { quad.hidden = true; wps.forEach(w => { w.classList.add('on'); w.classList.remove('here'); }); return; }
    visible(box, v => { if (v && !timer) loop(); else if (!v) { clearTimeout(timer); timer = null; } }, '0px');
  }

  /* ---------- Die Wand ---------- */
  const W = { art: 'alle', kat: 'alle', q: '', first: true };
  function match(ad) {
    if (W.art !== 'alle' && ad.art !== W.art) return false;
    if (W.kat !== 'alle' && katOf(ad.kat).k !== W.kat) return false;
    if (W.q) { const hay = norm([ad.titel, ad.t, ad.n, katOf(ad.kat).n, zust(ad.zustand), priceText(ad)].join(' ')); return W.q.split(/\s+/).filter(Boolean).every(w => hay.includes(w)); }
    return true;
  }
  function counts(all) {
    $$('[data-cnt]').forEach(b => { const a = b.dataset.cnt; b.textContent = a === 'alle' ? all.length : all.filter(x => x.art === a).length; });
    $$('[data-mk-count]').forEach(b => b.textContent = all.length);
    $$('[data-tagcnt]').forEach(e => { const n = all.filter(a => katOf(a.kat).k === e.dataset.tagcnt).length; e.textContent = `${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'}`; });
    $$('#mk-kats [data-kc]').forEach(s => { const k = s.dataset.kc; s.textContent = k === 'alle' ? all.length : all.filter(a => katOf(a.kat).k === k).length; });
  }
  function kats() {
    const box = $('#mk-kats'); if (!box) return;
    box.innerHTML = `<label class="chip" style="--n:0"><input type="radio" name="mk-kat" value="alle" checked><span>Alle <small data-kc="alle">0</small></span></label>` +
      KAT.map((k, i) => `<label class="chip" style="--acc:${k.c};--n:${i + 1}"><input type="radio" name="mk-kat" value="${k.k}"><span>${ico(k.k)}${k.n} <small data-kc="${k.k}">0</small></span></label>`).join('');
    if (!RM) box.classList.add('sweep');
    box.addEventListener('change', e => { box.classList.remove('sweep'); W.kat = e.target.value; renderWall(); });
  }
  function pickKat(k) {
    W.kat = k; const r = $(`#mk-kats input[value="${k}"]`); if (r) r.checked = true;
    $('#mk-kats').classList.remove('sweep'); renderWall();
  }
  let segPlace = () => {};
  function seg() {
    const s = $('#mk-seg'); if (!s) return;
    const pill = $('.mk-seg-pill', s);
    const place = segPlace = () => { const c = $('input:checked', s).closest('label'); pill.style.width = c.offsetWidth + 'px'; pill.style.transform = `translateX(${c.offsetLeft}px)`; s.classList.toggle('is-suche', W.art === 'suche'); };
    s.addEventListener('change', e => { s.classList.remove('idle'); W.art = e.target.value; place(); renderWall(); });
    if (!RM) s.classList.add('idle');
    requestAnimationFrame(place); addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place);
  }
  function search() {
    const q = $('#mk-q'); if (!q) return;
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { W.q = norm(q.value.trim()); renderWall(); }, 160); });
    // Selbst-Impuls: Beispielbegriffe tippen sich in den Platzhalter
    const EX = ['Tiny Whoop', 'Brille', 'Akkus 4S', 'ELRS-Empfänger', 'Lötstation', 'Funke', 'Propeller', 'Cinewhoop'];
    if (RM) { q.placeholder = 'Suchen, z. B. Tiny Whoop'; return; }
    let i = 0, c = 0, dir = 1, stop = false, h;
    const type = () => {
      if (stop || document.activeElement === q || q.value) { q.placeholder = 'Suchen …'; h = setTimeout(type, 1200); return; }
      const w = EX[i % EX.length]; c += dir; q.placeholder = 'Suchen: ' + w.slice(0, c) + (c < w.length ? '▍' : '');
      if (c >= w.length) { dir = -1; h = setTimeout(type, 1600); return; }
      if (c <= 0) { dir = 1; i++; h = setTimeout(type, 350); return; }
      h = setTimeout(type, dir > 0 ? 85 : 35);
    };
    visible(q, v => { clearTimeout(h); if (v) type(); });
  }
  function renderWall() {
    const all = ads(), list = all.filter(match), grid = $('#mk-grid'), empty = $('#mk-empty'), none = $('#mk-none'), read = $('#mk-readout');
    counts(all);
    const katN = W.kat === 'alle' ? 'alle Kategorien' : katOf(W.kat).n;
    if (!all.length) {
      grid.innerHTML = ''; grid.hidden = true; none.hidden = true; empty.hidden = false;
      read.innerHTML = '<b>0</b> Anzeigen · die Wand ist noch leer'; goggle(true); return;
    }
    empty.hidden = true; goggle(false);
    read.innerHTML = `<b>${list.length}</b> von ${all.length} ${all.length === 1 ? 'Anzeige' : 'Anzeigen'} · ${W.art === 'alle' ? 'Biete und Suche' : W.art === 'biete' ? 'Biete' : 'Suche'} · ${esc(katN)}${W.q ? ` · „${esc($('#mk-q').value.trim())}“` : ''}`;
    if (!list.length) { grid.innerHTML = ''; grid.hidden = true; none.hidden = false; return; }
    none.hidden = true; grid.hidden = false;
    grid.innerHTML = list.map(a => cardHTML(a)).join('');
    const cards = $$('.mk-card', grid);
    cards.forEach(tiltCard);
    if (!anim()) return;
    const fly = () => {
      // Pakete fliegen herein: von oben, gekippt, und landen mit kleinem Federn
      cards.forEach(c => c.classList.add('fly'));
      gsap.fromTo(cards, { y: -160, rotation: () => gsap.utils.random(-12, 12), rotationX: 50, scale: .82, opacity: 0 },
        { y: 0, rotation: 0, rotationX: 0, scale: 1, opacity: 1, duration: 1.05, ease: 'back.out(1.5)', stagger: .09, clearProps: 'transform,opacity', onComplete: () => cards.forEach(c => c.classList.remove('fly')) });
      cards.forEach((c, i) => { drainBattery($('.mk-bat', c), .3 + i * .09); const p = $('[data-price]', c); scramblePrice(p, p.textContent); });
    };
    if (W.first && window.ScrollTrigger) { W.first = false; gsap.set(cards, { opacity: 0 }); ScrollTrigger.create({ trigger: grid, start: 'top 85%', once: true, onEnter: fly }); }
    else { W.first = false; fly(); }
  }
  function tiltCard(c) {
    if (!FINE || RM) return;
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 10 + 'deg'); c.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 8 + 'deg'); });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  }

  /* ---------- Leerzustand: Bandscan wie in der Brille ---------- */
  const BAND = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917];
  let GG = null;
  function goggle(run) {
    const el = $('#mk-goggle'); if (!el) return;
    if (!GG) {
      const cv = $('#mk-static'), cx = cv.getContext('2d'), spec = $('#mk-spec');
      cv.width = 160; cv.height = 100;
      const img = cx.createImageData(160, 100);
      spec.innerHTML = BAND.map((f, i) => `<span><i></i><em>R${i + 1}</em></span>`).join('');
      GG = { el, cv, cx, img, spec, ch: 0, burst: 0, on: false, vis: false, last: 0, user: 0, tim: null };
      const draw = () => {
        const d = GG.img.data, b = GG.burst, roll = (performance.now() / 40) % 100;
        for (let y = 0; y < 100; y++) {
          const tear = Math.random() < .03 + b * .2 ? (Math.random() * 60 - 30) | 0 : 0, band = Math.abs(y - roll) < 6 ? 40 : 0;
          for (let x = 0; x < 160; x++) {
            const i = (y * 160 + ((x + tear + 160) % 160)) * 4, v = (Math.random() * (150 + b * 105) + band) | 0;
            d[i] = v * .86; d[i + 1] = v * .93; d[i + 2] = v; d[i + 3] = 255;
          }
        }
        GG.cx.putImageData(GG.img, 0, 0);
        GG.burst = Math.max(0, b - .08);
        $$('i', GG.spec).forEach((bar, i) => bar.style.setProperty('--h', (i === GG.ch ? 6 + Math.random() * 10 : 2 + Math.random() * 7).toFixed(1) + '%'));
      };
      const loop = (t) => { if (!GG.on || !GG.vis) return; if (t - GG.last > 42) { GG.last = t; draw(); } requestAnimationFrame(loop); };
      GG.start = () => { if (GG.on && GG.vis && !RM) requestAnimationFrame(loop); };
      GG.draw = draw;
      GG.tune = (i, byUser) => {
        GG.ch = (i + BAND.length) % BAND.length; GG.burst = 1;
        $('#mk-gg-band').textContent = `RACEBAND R${GG.ch + 1} · ${BAND[GG.ch]} MHz`;
        $('#mk-gg-rssi').textContent = String((Math.random() * 6) | 0).padStart(2, '0');
        $('#mk-gg-scan').textContent = byUser ? `KANAL R${GG.ch + 1} · MANUELL` : `BANDSCAN R${GG.ch + 1} …`;
        $$('span', GG.spec).forEach((s, j) => s.classList.toggle('on', j === GG.ch));
        el.classList.remove('tune'); void el.offsetWidth; el.classList.add('tune');
        if (RM) draw();
      };
      const user = () => { GG.user = performance.now(); GG.tune(GG.ch + 1, true); };
      el.addEventListener('click', user);
      // Selbst-Impuls: die Brille scannt die Kanäle von allein durch
      GG.auto = () => { clearInterval(GG.tim); if (RM) return; GG.tim = setInterval(() => { if (GG.on && GG.vis && performance.now() - GG.user > 7000) GG.tune(GG.ch + 1); }, 1700); };
      visible(el, v => { GG.vis = v; GG.start(); }, '0px');
      if (FINE && !RM && window.gsap) {
        el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); gsap.to(el, { rotationY: ((e.clientX - r.left) / r.width - .5) * 8, rotationX: -((e.clientY - r.top) / r.height - .5) * 6, transformPerspective: 1200, duration: .6, ease: 'power3.out' }); });
        el.addEventListener('pointerleave', () => gsap.to(el, { rotationY: 0, rotationX: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
      }
      GG.tune(0); draw();
    }
    GG.on = run;
    if (run) { GG.start(); GG.auto(); } else clearInterval(GG.tim);
  }

  /* ---------- Detailansicht ---------- */
  let DLG = { ad: null, i: 0, pushed: false };
  function openAd(ad, push) {
    const dlg = $('#mk-dlg'); if (!dlg || !ad) return;
    DLG.ad = ad; DLG.i = 0; DLG.show = null; clearInterval(DLG.auto);
    const k = katOf(ad.kat), L = ad._pv ? { days: RUN, frac: 1, start: new Date(), end: new Date(Date.now() + RUN * DAY) } : life(ad), c = contacts(ad), z = zust(ad.zustand);
    const imgs = ad.img;
    $('#mk-gal').innerHTML = (imgs.length
      ? imgs.map((s, i) => `<img class="mk-sl${i ? '' : ' on'}" src="${esc(s)}" alt="${esc(ad.titel)}, Foto ${i + 1} von ${imgs.length}"${i ? ' loading="lazy"' : ''}>`).join('')
      : `<div class="mk-noimg" style="--acc:${k.c}">${ico(k.k)}<span>${ad.link ? 'Fotos bei Kleinanzeigen' : 'Kein Foto'}</span></div>`) +
      '<div class="osd-frame"><i></i></div>' +
      `<p class="mk-gal-osd">${imgs.length ? `FOTO <b data-gi>1</b>/${imgs.length}${imgs.length > 1 ? ` · ${FINE ? 'PFEILTASTEN' : 'WISCHEN'}` : ''}` : esc(k.n.toUpperCase())}</p>` +
      (imgs.length > 1 ? `<button class="mk-gal-nav prev" type="button" aria-label="Vorheriges Foto">${ico('left').replace('class="mk-i"', '')}</button><button class="mk-gal-nav next" type="button" aria-label="Nächstes Foto">${ico('right').replace('class="mk-i"', '')}</button>
        <div class="mk-gal-th">${imgs.map((s, i) => `<button type="button" aria-label="Foto ${i + 1} zeigen"${i ? '' : ' aria-current="true"'}><img src="${esc(s)}" alt=""></button>`).join('')}</div>` : '');
    const waText = ad.art === 'suche' ? `Hallo ${ad.n || ''}, ich habe dein Gesuch „${ad.titel}“ auf der Biete/Suche-Wand des Flight Club Saar gesehen.` : `Hallo ${ad.n || ''}, ich interessiere mich für deine Anzeige „${ad.titel}“ auf der Biete/Suche-Wand des Flight Club Saar.`;
    const btns = [
      c.wa ? `<a class="btn solid wa" href="https://wa.me/${c.wa}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>` : '',
      c.mail ? `<a class="btn" href="mailto:${esc(c.mail)}?subject=${encodeURIComponent('Biete/Suche: ' + ad.titel)}&body=${encodeURIComponent(waText + '\n\n')}">${ico('mail')}E-Mail</a>` : '',
      ad.link && /^https?:\/\//i.test(ad.link) ? `<a class="btn amber" href="${esc(ad.link)}" target="_blank" rel="noopener nofollow">${ico('ext')}Bei Kleinanzeigen ansehen</a>` : ''
    ].join('');
    $('#mk-info').innerHTML = `${ad._pv ? '<p class="mk-d-pv">Vorschau: so sieht deine Anzeige nach der Freigabe aus</p>' : ''}
      <div class="mk-i-top"><span class="mk-art${ad.art === 'suche' ? ' is-suche' : ''}">${ad.art === 'suche' ? 'Suche' : 'Biete'}</span><span class="mk-kat hud" style="--acc:${k.c};font-size:12px;letter-spacing:.14em;text-transform:uppercase">${ico(k.k)}${k.n}</span></div>
      <h3 class="mk-d-h" id="mk-d-h">${esc(ad.titel)}</h3>
      <p class="mk-d-price" data-dprice>${esc(priceText(ad))}</p>
      <dl class="mk-d-meta">
        <div><dt>Zustand</dt><dd>${esc(z || (ad.art === 'suche' ? 'egal' : 'k. A.'))}</dd></div>
        <div><dt>Restlaufzeit</dt><dd>${batHTML(L)}</dd></div>
        <div><dt>Eingestellt</dt><dd>${L.start ? fmt(L.start) : ''}</dd></div>
        <div><dt>Läuft ab</dt><dd>${L.end ? fmt(L.end) : ''}</dd></div>
      </dl>
      ${ad.t ? `<p class="mk-d-t">${esc(ad.t)}</p>` : ''}
      <p class="mk-d-by">Von <b>${esc(ad.n || 'Pilot')}</b></p>
      <div class="mk-d-btns">${btns || '<p class="mute" style="margin:0">Keine Kontaktdaten hinterlegt.</p>'}</div>
      <p class="mk-d-safe">Erst ansehen, dann zahlen. Keine Vorkasse an Fremde. Mehr im <a href="#sicher" data-close>Preflight-Check</a>.</p>
      ${ad._pv ? '' : `<button class="mk-share" type="button" data-share>${ico('share')}<span>Link zur Anzeige teilen</span></button>`}`;
    wireGallery();
    if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); if (FCS.lenis) FCS.lenis.stop(); document.documentElement.classList.add('mk-lock'); }
    $('#mk-info').scrollTop = 0; $('.mk-dlg-in').scrollTop = 0;
    if (push && !ad._pv) { try { history.pushState({ mk: ad.id }, '', '#a-' + ad.id); DLG.pushed = true; } catch (e) {} }
    if (anim()) {
      gsap.fromTo('.mk-dlg-in', { y: 40, scale: .96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .6, ease: 'expo.out' });
      gsap.fromTo('#mk-gal', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .9, ease: 'expo.inOut', clearProps: 'clipPath' });
      gsap.from($$('#mk-info > *'), { y: 18, opacity: 0, stagger: .045, duration: .6, ease: 'expo.out', delay: .1 });
      scramblePrice($('[data-dprice]'), priceText(ad));
      drainBattery($('#mk-info .mk-bat'), .3);
    }
  }
  function wireGallery() {
    const g = $('#mk-gal'), sl = $$('.mk-sl', g), th = $$('.mk-gal-th button', g); if (sl.length < 2) return;
    const show = (i) => { DLG.i = (i + sl.length) % sl.length; sl.forEach((s, j) => s.classList.toggle('on', j === DLG.i)); th.forEach((b, j) => b.setAttribute('aria-current', j === DLG.i ? 'true' : 'false')); const gi = $('[data-gi]', g); if (gi) gi.textContent = DLG.i + 1; };
    DLG.show = show;
    // Selbst-Impuls: die Fotos blättern von allein weiter, bis jemand selbst blättert
    clearInterval(DLG.auto); if (!RM) DLG.auto = setInterval(() => show(DLG.i + 1), 3800);
    const stop = () => clearInterval(DLG.auto);
    $('.prev', g).addEventListener('click', () => { stop(); show(DLG.i - 1); });
    $('.next', g).addEventListener('click', () => { stop(); show(DLG.i + 1); });
    th.forEach((b, j) => b.addEventListener('click', () => { stop(); show(j); }));
    let sx = null;
    g.addEventListener('pointerdown', e => { stop(); sx = e.clientX; });
    g.addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 40) show(DLG.i + (e.clientX < sx ? 1 : -1)); sx = null; });
  }
  function dialog() {
    const dlg = $('#mk-dlg'); if (!dlg) return;
    const close = () => { if (dlg.open) dlg.close ? dlg.close() : (dlg.removeAttribute('open'), dlg.dispatchEvent(new Event('close'))); };
    $('#mk-x').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', e => { if (!DLG.show) return; if (e.key === 'ArrowLeft') { clearInterval(DLG.auto); DLG.show(DLG.i - 1); } if (e.key === 'ArrowRight') { clearInterval(DLG.auto); DLG.show(DLG.i + 1); } });
    dlg.addEventListener('close', () => {
      if (FCS.lenis) FCS.lenis.start(); document.documentElement.classList.remove('mk-lock'); DLG.show = null; clearInterval(DLG.auto);
      if (/^#a-/.test(location.hash)) { if (DLG.pushed && history.state && history.state.mk) history.back(); else try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      DLG.pushed = false;
      const c = DLG.ad && $(`.mk-card[data-id="${DLG.ad.id}"] a`); if (c) c.focus({ preventScroll: true });
    });
    dlg.addEventListener('click', e => {
      const a = e.target.closest('[data-close]'); if (a) { e.preventDefault(); close(); setTimeout(() => scrollToEl($(a.getAttribute('href'))), 60); }
      const s = e.target.closest('[data-share]'); if (s && DLG.ad) {
        const url = location.origin + location.pathname + '#a-' + DLG.ad.id, t = $('span', s);
        if (navigator.share) navigator.share({ title: DLG.ad.titel + ' · Biete/Suche', url }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { t.textContent = 'Link kopiert'; setTimeout(() => t.textContent = 'Link zur Anzeige teilen', 2200); }).catch(() => { t.textContent = url; });
        else t.textContent = url;
      }
    });
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-open]'); if (!a) return;
      e.preventDefault(); const ad = ads().find(x => x.id === a.dataset.open); if (ad) openAd(ad, true);
    });
    const fromHash = () => {
      const m = location.hash.match(/^#a-([\w-]+)/);
      if (m) { const ad = ads().find(x => x.id === m[1]); if (ad) { openAd(ad, false); return; } }
      if (dlg.open) close();
    };
    addEventListener('popstate', fromHash);
    if (/^#a-/.test(location.hash)) setTimeout(fromHash, 200);
  }

  /* ---------- Formular mit Live-Vorschau ---------- */
  const F = { art: 'biete', imgs: [], busy: 0, todo: [] };
  function formAd() {
    const f = $('#mk-form'), v = (n) => (f.elements[n] && f.elements[n].value || '').trim();
    const pa = (f.querySelector('[name=Preisart]:checked') || {}).value || 'Festpreis', num = v('Preis');
    const nn = num !== '' && isFinite(+num) ? +num : null;
    let preis = '', phP = false;
    if (pa === 'Zu verschenken') preis = 'Zu verschenken';
    else if (pa === 'Tausch') preis = 'Tausch';
    else if (pa === 'VB') preis = nn !== null ? `${eur(nn)} VB` : 'VB';
    else if (nn !== null) preis = nn;
    else { preis = F.art === 'suche' ? 'Budget offen' : '0 €'; phP = F.art !== 'suche'; }
    const kat = (f.querySelector('[name=Kategorie]:checked') || {}).value || '';
    const zz = (f.querySelector('[name=Zustand]:checked') || {}).value || '';
    const wa = v('WhatsApp'), mail = v('E-Mail');
    return {
      id: 'vorschau', _pv: true, art: F.art, titel: v('Titel') || (F.art === 'suche' ? 'Was suchst du?' : 'Dein Titel'), kat: kat || 'sonstiges', preis, zustand: zz, t: v('Beschreibung'),
      img: F.imgs.filter(m => m.url && !m.busy).map(m => m.url), kontakt: [wa && 'WhatsApp ' + wa, mail].filter(Boolean).join(' · '), link: v('Kleinanzeigen-Link'), n: v('Name') || 'Dein Pilotenname', d: iso(new Date()),
      _ph: { titel: !v('Titel'), preis: phP, kat: !kat, n: !v('Name') }, _real: { titel: v('Titel'), kat, preis, zustand: zz, t: v('Beschreibung'), wa, mail, link: v('Kleinanzeigen-Link'), n: v('Name') }
    };
  }
  function entry(ad) {
    const r = ad._real, slug = norm(r.titel).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'anzeige', id = `${ad.d}-${slug}`;
    const o = { id, art: ad.art, titel: r.titel, kat: r.kat, preis: r.preis, zustand: r.zustand, t: r.t, img: F.imgs.map((m, i) => `media/markt/${id}-${i + 1}.jpg`), kontakt: ad.kontakt, link: r.link, n: r.n, d: ad.d };
    return '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ') + ' }';
  }
  let pvPrice = '';
  function preview() {
    const ad = formAd(), box = $('#mk-pv-card'); if (!box) return;
    const oldImg = box.dataset.img || '', newImg = ad.img.join('|');
    const price = priceText(ad);
    if (!box.firstElementChild || oldImg !== newImg || box.dataset.art !== ad.art || box.dataset.kat !== ad.kat) {
      box.innerHTML = cardHTML(ad, true); box.dataset.img = newImg; box.dataset.art = ad.art; box.dataset.kat = ad.kat;
    } else {
      const c = $('.mk-card', box);
      $('.mk-title', c).innerHTML = `<span${ad._ph.titel ? ' class="is-ph"' : ''}>${esc(ad.titel)}</span>`;
      $('.mk-meta', c).innerHTML = `<span class="mk-kat${ad._ph.kat ? ' is-ph' : ''}">${ico(katOf(ad.kat).k)}${katOf(ad.kat).n}</span>${ad.zustand ? `<span>${esc(zust(ad.zustand))}</span>` : ''}`;
      $('.mk-by b', c).textContent = ad.n; $('.mk-by b', c).className = ad._ph.n ? 'is-ph' : '';
      $('[data-price]', c).classList.toggle('is-ph', ad._ph.preis);
      $('.mk-noimg span', c) && ($('.mk-noimg span', c).textContent = ad.link ? 'Fotos bei Kleinanzeigen' : ad.art === 'suche' ? 'Gesuch' : 'Kein Foto');
    }
    const pe = $('[data-price]', box);
    if (price !== pvPrice) { pvPrice && pe ? scramblePrice(pe, price) : pe && (pe.textContent = price); pvPrice = price; } else if (pe) pe.textContent = price;
    const j = $('#mk-json'); if (j) j.value = entry(ad);
  }
  function setArt(a) {
    F.art = a === 'suche' ? 'suche' : 'biete';
    const f = $('#mk-form'), s = F.art === 'suche';
    const r = f.querySelector(`[name=Art][value="${s ? 'Suche' : 'Biete'}"]`); if (r) r.checked = true;
    $('#mk-switch').classList.toggle('is-suche', s);
    $('#mk-price-l').textContent = s ? 'Budget' : 'Preis';
    $('#mk-price-hint').textContent = s ? 'Was willst du ungefähr ausgeben? Leer lassen geht auch.' : 'VB geht auch ohne Zahl.';
    $('#mk-z-l').innerHTML = s ? 'Zustand <small>(freiwillig)</small>' : 'Zustand';
    $$('[name=Zustand]', f).forEach(i => i.required = !s);
    $('#mk-privat-t').textContent = s ? 'Ich suche privat und nicht gewerblich.' : 'Ich verkaufe privat und habe das Recht dazu.';
    $('#mk-photo-hint').textContent = s ? 'Bei einem Gesuch sind Fotos und Link freiwillig.' : 'Fotos oder Link: eins von beiden reicht.'; $('#mk-photo-hint').classList.remove('note');
    $('#mk-titel').placeholder = s ? 'z. B. Suche gebrauchte FPV-Brille' : 'z. B. 5-Zoll-Freestyle-Kopter, flugbereit';
    $('#mk-photofield').classList.remove('bad');
    priceMode(); preview();
  }
  function priceMode() {
    const f = $('#mk-form'), pa = (f.querySelector('[name=Preisart]:checked') || {}).value, n = $('#mk-preis');
    const off = pa === 'Zu verschenken' || pa === 'Tausch';
    n.disabled = off; if (off) n.value = '';
    n.required = pa === 'Festpreis' && F.art === 'biete';
    if (!n.required) $('#mk-pricefield').classList.remove('bad');
  }

  /* Fotos: verkleinern auf max. 1400 px, JPEG, Gesamtgröße unter 8 MB */
  async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {} }
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u; });
  }
  const toBlob = (cv, q) => new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', q));
  async function shrink(file, q = .82) {
    const bm = await decode(file), w0 = bm.width || bm.naturalWidth, h0 = bm.height || bm.naturalHeight;
    const s = Math.min(1, MAXPX / Math.max(w0, h0)), w = Math.round(w0 * s), h = Math.round(h0 * s);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.imageSmoothingQuality = 'high'; cx.drawImage(bm, 0, 0, w, h);
    if (bm.close) bm.close();
    let b = await toBlob(cv, q);
    while (b && b.size > 2.4 * 1024 * 1024 && q > .5) { q -= .1; b = await toBlob(cv, q); }
    return { blob: b, w, h, cv, q };
  }
  async function addFiles(list) {
    const files = [...list].filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
    const free = 3 - F.imgs.length;
    const err = $('#mk-photo-err');
    if (!files.length) return;
    const hint = $('#mk-photo-hint');
    if (files.length > free) { hint.textContent = `Es passen 3 Fotos in eine Anzeige. ${free ? `Die ersten ${free} sind übernommen.` : 'Lösch erst ein Foto.'}`; hint.classList.add('note'); }
    for (const file of files.slice(0, Math.max(0, free))) {
      const m = { busy: true, url: '', blob: null, size: 0, id: Math.random().toString(36).slice(2) };
      F.imgs.push(m); F.busy++; thumbs();
      try {
        const r = await shrink(file); m.blob = r.blob; m.size = r.blob.size; m.cv = r.cv; m.url = URL.createObjectURL(r.blob);
      } catch (e) {
        F.imgs.splice(F.imgs.indexOf(m), 1);
        err.textContent = `„${file.name}“ kann dein Browser nicht öffnen. Bitte als JPG oder PNG versuchen.`; $('#mk-photofield').classList.add('bad');
      }
      m.busy = false; F.busy--;
      if (m.blob) $('#mk-photofield').classList.remove('bad');
      await fitBudget(); thumbs(); syncFiles(); preview();
    }
  }
  async function fitBudget() {
    let tot = F.imgs.reduce((s, m) => s + (m.size || 0), 0), q = .72;
    while (tot > SAFE && q >= .4) {
      for (const m of F.imgs) if (m.cv) { const b = await toBlob(m.cv, q); if (b && b.size < m.size) { URL.revokeObjectURL(m.url); m.blob = b; m.size = b.size; m.url = URL.createObjectURL(b); } }
      tot = F.imgs.reduce((s, m) => s + (m.size || 0), 0); q -= .1;
    }
  }
  function thumbs() {
    const box = $('#mk-thumbs'), x = `<svg viewBox="0 0 24 24" aria-hidden="true">${P.x}</svg>`;
    box.innerHTML = F.imgs.map((m, i) => `<div class="mk-th${m.busy ? ' busy' : ''}" data-id="${m.id}">${m.url ? `<img src="${m.url}" alt="Foto ${i + 1}">` : ''}
      ${i && !m.busy ? `<button type="button" class="mk-th-cover" data-cover="${m.id}" aria-label="Foto ${i + 1} als Titelbild nehmen"></button>` : ''}
      <span class="mk-th-tag">${i ? 'Als Titelbild?' : 'Titelbild'}</span>${m.busy ? '' : `<button type="button" class="mk-th-x" data-del="${m.id}" aria-label="Foto ${i + 1} entfernen">${x}</button>`}</div>`).join('');
    $('#mk-drop').classList.toggle('full', F.imgs.length >= 3);
    const tot = F.imgs.reduce((s, m) => s + (m.size || 0), 0), bud = $('#mk-budget');
    bud.hidden = !F.imgs.length;
    $('i', bud).style.width = Math.min(100, tot / BUDGET * 100) + '%';
    $('i', bud).style.background = tot > SAFE ? 'var(--amber)' : 'var(--green)';
    $('.mk-budget-t', bud).textContent = `${F.imgs.length} ${F.imgs.length === 1 ? 'Foto' : 'Fotos'} · ${(tot / 1048576).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB von 8 MB`;
    if (anim()) gsap.from($$('.mk-th:not(.seen)', box), { scale: .8, opacity: 0, duration: .5, ease: 'back.out(2)' });
    $$('.mk-th', box).forEach(t => t.classList.add('seen'));
  }
  function syncFiles() {
    const f = $('#mk-form'); let ok = true;
    try {
      if (typeof DataTransfer === 'undefined') throw new Error('kein DataTransfer');
      for (let i = 0; i < 3; i++) {
        const inp = $('#mk-f' + (i + 1)), m = F.imgs[i];
        if (m && m.blob) { const dt = new DataTransfer(); dt.items.add(new File([m.blob], `Foto${i + 1}.jpg`, { type: 'image/jpeg' })); inp.files = dt.files; inp.name = 'Foto' + (i + 1); }
        else { inp.value = ''; inp.removeAttribute('name'); }
      }
    } catch (e) { ok = false; }
    // Ausweg für ältere Browser: Fotos als Anhänge über FCS.send
    f._extra = ok ? undefined : () => Object.fromEntries(F.imgs.filter(m => m.blob).map((m, i) => ['Foto' + (i + 1), m.blob]));
  }
  function photos() {
    const drop = $('#mk-drop'), inp = $('#mk-files');
    if (!FINE) { $('.drop-in b', drop).textContent = 'Fotos auswählen'; $('.drop-in span', drop).textContent = 'Tippen, um Fotos zu wählen oder aufzunehmen. Wir verkleinern sie automatisch.'; }
    inp.addEventListener('change', () => { addFiles(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('#mk-thumbs').addEventListener('click', e => {
      const d = e.target.closest('[data-del]'), c = e.target.closest('[data-cover]');
      if (d) { const i = F.imgs.findIndex(m => m.id === d.dataset.del); if (i > -1) { URL.revokeObjectURL(F.imgs[i].url); F.imgs.splice(i, 1); } }
      else if (c) { const i = F.imgs.findIndex(m => m.id === c.dataset.cover); if (i > 0) F.imgs.unshift(F.imgs.splice(i, 1)[0]); }
      else return;
      $('#mk-photofield').classList.remove('bad'); thumbs(); syncFiles(); preview();
    });
  }
  function checkCustom() {
    const f = $('#mk-form'), bad = [];
    const link = $('#mk-link'), lv = link.value.trim(), linkOk = !lv || (/^https?:\/\/\S+\.\S+/i.test(lv) && link.checkValidity());
    const pf = $('#mk-photofield'), err = $('#mk-photo-err');
    if (!linkOk) { err.textContent = 'Der Link sieht nicht richtig aus. Er beginnt mit https://'; pf.classList.add('bad'); bad.push(pf); }
    else if (F.busy) { err.textContent = 'Einen Moment, die Fotos werden noch verkleinert.'; pf.classList.add('bad'); bad.push(pf); }
    else if (F.art === 'biete' && !F.imgs.length && !lv) { err.textContent = 'Bitte mindestens ein Foto hochladen oder einen Kleinanzeigen-Link einfügen.'; pf.classList.add('bad'); bad.push(pf); }
    else pf.classList.remove('bad');
    const wa = $('#mk-wa').value.trim(), mail = $('#mk-mail'), mv = mail.value.trim(), k = $('#mk-kontakt'), ke = $('#mk-k-err');
    const waOk = !wa || wa.replace(/\D/g, '').length >= 6, mailOk = !mv || (mail.checkValidity() && /@.+\./.test(mv));
    if (!wa && !mv) { ke.textContent = 'Bitte eine WhatsApp-Nummer oder eine E-Mail-Adresse angeben.'; k.classList.add('bad'); bad.push(k); }
    else if (!waOk) { ke.textContent = 'Die WhatsApp-Nummer ist zu kurz.'; k.classList.add('bad'); bad.push(k); }
    else if (!mailOk) { ke.textContent = 'Die E-Mail-Adresse sieht nicht richtig aus.'; k.classList.add('bad'); bad.push(k); }
    else k.classList.remove('bad');
    return bad;
  }
  function form() {
    const f = $('#mk-form'); if (!f) return;
    const sw = $('#mk-switch'); if (!RM) sw.classList.add('idle');
    sw.addEventListener('change', e => { sw.classList.remove('idle'); setArt(e.target.value === 'Suche' ? 'suche' : 'biete'); });
    $$('[name=Preisart]', f).forEach(r => r.addEventListener('change', () => { priceMode(); preview(); }));
    const t = $('#mk-t'), tn = $('#mk-t-n'); t.addEventListener('input', () => tn.textContent = t.value.length);
    let raf = 0; f.addEventListener('input', e => { const fld = e.target.closest('.field,.check'); if (fld && fld.classList.contains('bad') && e.target.id !== 'mk-files') fld.classList.remove('bad'); cancelAnimationFrame(raf); raf = requestAnimationFrame(preview); });
    f.addEventListener('change', e => { const fld = e.target.closest('.field,.check'); if (fld && e.target.id !== 'mk-files') fld.classList.remove('bad'); cancelAnimationFrame(raf); raf = requestAnimationFrame(preview); });
    photos(); priceMode(); setArt('biete'); draft();
    // Eigene Prüfung läuft vor dem Absenden in fcs.js (Capture-Phase am Dokument)
    document.addEventListener('submit', e => {
      if (e.target !== f) return;
      syncFiles(); preview();
      const base = FCS.validate ? FCS.validate(f) : true, bad = checkCustom();
      if (base && !bad.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const first = $$('.field.bad, .check.bad', f)[0];
      if (first) { const i = first.querySelector('input:not([type=hidden]):not(:disabled),textarea'); if (i) i.focus({ preventScroll: true }); scrollToEl(first, -140); }
    }, true);
    f.addEventListener('fcs:sent', () => {
      F.sent = true;
      try { sessionStorage.removeItem('fcs-markt-draft'); } catch (e) {}
      const tilt = $('#mk-pv-tilt'), sent = $('#mk-pv-sent');
      const done = () => { tilt.style.visibility = 'hidden'; sent.hidden = false; if (anim()) gsap.from(sent.children, { y: 20, opacity: 0, stagger: .08, duration: .6, ease: 'expo.out' }); };
      if (anim()) gsap.to(tilt, { y: -140, rotationX: 60, scale: .5, opacity: 0, duration: .8, ease: 'power3.in', onComplete: done }); else done();
      scrollToEl($('#aufgeben'), -70);
    });
    $('#mk-again').addEventListener('click', () => {
      f.reset(); f.classList.remove('sent'); $$('.form-ok,.form-bad', f).forEach(x => x.hidden = true);
      F.imgs.forEach(m => m.url && URL.revokeObjectURL(m.url)); F.imgs = []; thumbs(); syncFiles(); tn.textContent = '0';
      const tilt = $('#mk-pv-tilt'); tilt.style.visibility = ''; $('#mk-pv-sent').hidden = true; if (window.gsap) gsap.set(tilt, { clearProps: 'all' }); F.sent = false; pvPrice = '';
      setArt('biete'); $('#mk-titel').focus();
    });
    // Knöpfe, die das Formular vorbereiten
    $$('[data-mk-art]').forEach(a => a.addEventListener('click', () => setArt(a.dataset.mkArt)));
    const g = $('#mk-gesuch'); if (g) g.addEventListener('click', () => {
      setArt('suche'); const q = $('#mk-q').value.trim(); if (q) $('#mk-titel').value = q;
      if (W.kat !== 'alle') { const r = f.querySelector(`[name=Kategorie][value="${W.kat}"]`); if (r) r.checked = true; }
      preview();
    });
    const rs = $('#mk-reset'); if (rs) rs.addEventListener('click', () => { W.art = 'alle'; W.kat = 'alle'; W.q = ''; $('#mk-q').value = ''; $$('#mk-seg input')[0].checked = true; $$('#mk-kats input')[0].checked = true; segPlace(); renderWall(); });
    const more = document.createElement('div'); more.className = 'mk-pv-more';
    more.innerHTML = '<button type="button" class="btn ghost">Detailansicht testen</button>';
    $('#mk-pv-stage').after(more);
    $('button', more).addEventListener('click', () => openAd(formAd(), false));
  }
  // Unvollständige Eingaben überleben ein versehentliches Neuladen (nur in diesem Tab, ohne Fotos)
  function draft() {
    const f = $('#mk-form'), KEYS = ['Art', 'Titel', 'Kategorie', 'Preis', 'Preisart', 'Zustand', 'Beschreibung', 'Kleinanzeigen-Link', 'Name', 'WhatsApp', 'E-Mail'];
    try {
      const d = JSON.parse(sessionStorage.getItem('fcs-markt-draft') || 'null');
      if (d) {
        KEYS.forEach(k => { const el = f.elements[k]; if (!el || d[k] == null) return; if (el instanceof RadioNodeList || (el.length && el[0] && el[0].type === 'radio')) { const r = f.querySelector(`[name="${k}"][value="${CSS.escape(d[k])}"]`); if (r) r.checked = true; } else el.value = d[k]; });
        setArt(d.Art === 'Suche' ? 'suche' : 'biete'); $('#mk-t-n').textContent = $('#mk-t').value.length;
      }
    } catch (e) {}
    let t; f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 400); }); f.addEventListener('change', () => { clearTimeout(t); t = setTimeout(save, 400); });
    function save() { try { const o = {}; KEYS.forEach(k => { const el = f.elements[k]; if (!el) return; o[k] = el.value; }); sessionStorage.setItem('fcs-markt-draft', JSON.stringify(o)); } catch (e) {} }
  }
  function tilt() {
    const stage = $('#mk-pv-stage'), el = $('#mk-pv-tilt'); if (!stage || !el) return;
    if (!FINE) $('.mk-pv-hint').textContent = 'Die Karte entsteht beim Tippen. Wisch über die Karte, um sie zu kippen.';
    if (RM) { $('.mk-pv-hint').textContent = 'Die Karte entsteht beim Tippen.'; return; }
    let idle = true, rx = 0, ry = 0, tx = 0, ty = 0, gx = 50, gy = 30, resume, on = false, t0 = performance.now();
    const move = (e) => { idle = false; clearTimeout(resume); const r = stage.getBoundingClientRect(), px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1); ty = (px - .5) * 28; tx = -(py - .5) * 22; gx = px * 100; gy = py * 100; };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', () => { tx = ty = 0; resume = setTimeout(() => idle = true, 2200); });
    stage.addEventListener('pointerup', () => { if (!FINE) { tx = ty = 0; resume = setTimeout(() => idle = true, 2200); } });
    const loop = (t) => {
      if (!on) return;
      // Selbst-Impuls: die Karte schwebt und dreht sich leicht, bis jemand sie anfasst
      if (F.sent) { requestAnimationFrame(loop); return; }
      if (idle) { const s = (t - t0) / 1000; tx = Math.sin(s * 1.1) * 7; ty = Math.sin(s * .8 + 1) * 13; gx = 50 + ty * 2.4; gy = 30 - tx * 3; }
      rx += (tx - rx) * .09; ry += (ty - ry) * .09;
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      el.style.setProperty('--gx', gx.toFixed(1) + '%'); el.style.setProperty('--gy', gy.toFixed(1) + '%');
      requestAnimationFrame(loop);
    };
    visible(stage, v => { if (v && !on) { on = true; requestAnimationFrame(loop); } else if (!v) on = false; });
  }

  /* ---------- Community-Orbit ---------- */
  function orbit() {
    const box = $('#mk-orbit'), read = $('#mk-orbit-read'); if (!box) return;
    const G = (D.gruppen || []).slice(); if (!G.length) { box.closest('.mk-orbit-box').hidden = true; return; }
    const mkI = Math.max(0, G.findIndex(g => g.n === 'Marktplatz intern'));
    const svg = $('#mk-orbit-lines');
    svg.innerHTML = '<ellipse/>' + G.map(() => '<line/>').join('');
    box.insertAdjacentHTML('beforeend', G.map((g, i) => `<button type="button" class="mk-node${i === mkI ? ' is-mk' : ''}" data-i="${i}">${i === mkI ? ico('lock') : '<span class="dot"></span>'}${esc(g.n)}</button>`).join(''));
    const nodes = $$('.mk-node', box), lines = $$('line', svg), ell = $('ellipse', svg);
    let a0 = -Math.PI / 2 - (mkI / G.length) * Math.PI * 2 + .35, act = mkI, speed = RM ? 0 : .00016, hold = 0, on = false, last = 0, W0 = 0, H0 = 0;
    const show = (i) => {
      act = i; const g = G[i];
      nodes.forEach((n, j) => n.classList.toggle('on', j === i)); lines.forEach((l, j) => l.classList.toggle('on', j === i));
      read.innerHTML = `<b>${esc(g.n)}</b><span>${esc(g.t || '')}</span><em>${i === mkI ? 'Nur für Vereinsmitglieder' : g.m ? `${g.m} Mitglieder in der Gruppe` : 'Gruppe der WhatsApp-Community'}</em>`;
    };
    const place = () => {
      const r = box.getBoundingClientRect(); W0 = r.width; H0 = r.height;
      const cx = W0 / 2, cy = H0 / 2, rx = W0 * .3, ry = H0 * .4;
      ell.setAttribute('cx', cx); ell.setAttribute('cy', cy); ell.setAttribute('rx', rx); ell.setAttribute('ry', ry);
      nodes.forEach((n, i) => {
        const a = a0 + (i / G.length) * Math.PI * 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, depth = (Math.sin(a) + 1) / 2;
        // Beschriftung zeigt nach außen: links vom Kern nach links, rechts nach rechts
        const s = .76 + .28 * depth, w = n.offsetWidth, h = n.offsetHeight, left = Math.cos(a) < -.15, right = Math.cos(a) > .15;
        const nx = clamp(left ? x - w * s : right ? x : x - w * s / 2, 0, W0 - w * s), ny = y - h / 2;
        n.classList.toggle('to-l', left);
        n.style.transform = `translate(${nx.toFixed(1)}px,${ny.toFixed(1)}px) scale(${s.toFixed(3)})`;
        n.style.transformOrigin = '0 50%';
        n.style.opacity = (.5 + .5 * depth).toFixed(2); n.style.zIndex = 10 + Math.round(depth * 50) + (i === mkI ? 60 : 0);
        const ax = left ? nx + w * s : right ? nx : nx + w * s / 2;
        const l = lines[i]; l.setAttribute('x1', cx); l.setAttribute('y1', cy); l.setAttribute('x2', ax); l.setAttribute('y2', y);
      });
    };
    const tick = (t) => { if (!on) return; const dt = clamp(t - (last || t), 0, 50); last = t; a0 += speed * dt * (performance.now() < hold ? .15 : 1); place(); requestAnimationFrame(tick); };
    nodes.forEach((n, i) => {
      const pick = () => { hold = performance.now() + 8000; show(i); };
      n.addEventListener('click', pick); n.addEventListener('focus', pick); if (FINE) n.addEventListener('pointerenter', pick);
    });
    show(mkI); place(); addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place);
    if (RM) return;
    // Selbst-Impuls: der Orbit dreht sich und zeigt nacheinander die Gruppen, „Marktplatz intern“ am längsten
    let k = 0; const seq = [];
    G.forEach((g, i) => { if (i !== mkI) seq.push(i, mkI); });
    setInterval(() => { if (!on || performance.now() < hold) return; show(seq[k++ % seq.length]); }, 2600);
    visible(box, v => { if (v && !on) { on = true; last = 0; requestAnimationFrame(tick); } else if (!v) on = false; });
  }

  /* ---------- Preflight-Check ---------- */
  function preflight() {
    const pre = $('.mk-pre'), boxes = $$('#mk-checks input'), props = $$('.mk-armq-p'), arm = $('#mk-arm'); if (!pre) return;
    if (!RM) pre.classList.add('idle');
    const list = $('#mk-checks'); const sh = () => list.style.setProperty('--sh', list.offsetHeight + 'px'); sh(); addEventListener('resize', sh);
    const upd = () => {
      const n = boxes.filter(b => b.checked).length, left = boxes.length - n, all = left === 0;
      props.forEach((p, i) => p.classList.toggle('on', !!(boxes[i] && boxes[i].checked)));
      $('#mk-arm-state').textContent = all ? 'ARMED' : 'ARMING DISABLED';
      $('#mk-arm-left').textContent = all ? 'BEREIT ZUM HANDELN' : `${left} ${left === 1 ? 'CHECK' : 'CHECKS'} OFFEN`;
      const was = arm.classList.contains('armed'); arm.classList.toggle('armed', all); pre.classList.toggle('armed', all);
      if (all && !was && anim()) gsap.fromTo('.mk-armq', { y: 0 }, { y: -16, duration: .5, ease: 'power2.out', yoyo: true, repeat: 1 });
    };
    boxes.forEach((b, i) => b.addEventListener('change', () => {
      pre.classList.remove('idle'); upd();
      const s = b.closest('.mk-chk').querySelector('.mk-chk-s'); const txt = b.checked ? 'OK' : 'CHECK';
      if (scramble()) gsap.to(s, { duration: .5, scrambleText: { text: txt, chars: 'X#01', speed: 1 } }); else s.textContent = txt;
    }));
    upd();
  }

  /* ---------- Kopf: Gebühr-Scramble, Parallaxe ---------- */
  function head() {
    const fee = $('.mk-fee');
    if (scramble() && fee) {
      const run = () => gsap.to(fee, { duration: 1.4, scrambleText: { text: '0,00 €', chars: '0123456789', speed: .5 } });
      setTimeout(run, 900); setInterval(() => { if (scrollY < innerHeight) run(); }, 6500);
    }
    if (anim() && window.ScrollTrigger) gsap.to('.mk-head-bg', { yPercent: 14, scale: 1.16, ease: 'none', scrollTrigger: { trigger: '.mk-head', start: 'top top', end: 'bottom top', scrub: true } });
  }

  function init() {
    D = (window.FCS && FCS.data) || {};
    $$('[data-ico]').forEach(i => { i.outerHTML = ico(i.dataset.ico); });
    head(); rail(); plan(); kats(); seg(); search(); renderWall(); dialog(); form(); tilt(); orbit(); preflight();
    if (window.ScrollTrigger) {
      setTimeout(() => ScrollTrigger.refresh(), 400);
      // Höhe ändert sich (Fotos, Leerzustand, gesendetes Formular): Scroll-Auslöser neu vermessen
      if (window.ResizeObserver) { let h = 0, t; new ResizeObserver(() => { const nh = document.documentElement.scrollHeight; if (Math.abs(nh - h) > 30) { h = nh; clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250); } }).observe(document.body); }
    }
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
