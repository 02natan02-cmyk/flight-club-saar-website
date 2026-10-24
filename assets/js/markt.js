/* Biete/Suche: Live-Wand über FCS.board (Make), Anzeige aufgeben mit Löschcode, Löschen, „Code vergessen?“ und Melden,
   Detailansicht mit Galerie, „Deine Anzeigen“, Sicher-handeln-Check und Marktplatz intern.
   Kosten sparen: die Wand lädt einmal pro Besuch (erst wenn sie gebraucht wird), Fotos erst beim Ansehen. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const anim = () => !!window.gsap && !RM;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  const sid = (s) => String(s || '').replace(/[^\w-]/g, '').slice(0, 60);
  const scrollToEl = (el, off = -84) => { if (!el) return; FCS.scrollTo ? FCS.scrollTo(el, off) : el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const visible = (el, cb, margin = '150px 0px') => { if (!el || !('IntersectionObserver' in window)) { cb(true); return; } const io = new IntersectionObserver(es => cb(es[es.length - 1].isIntersecting, io), { rootMargin: margin }); io.observe(el); };
  const B = () => (window.FCS && FCS.board) || null;
  const live = () => { const b = B(); return !!(b && b.on()); };
  let D = {};

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
    phone: '<path d="M6.6 3.5h2.8l1.4 4.2-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4.2 1.4v2.8a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 13.3l7.4 4.3M15.7 6.4l-7.4 4.3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
    flag: '<path d="M5 21V4M5 4h11.5l-2.2 4 2.2 4H5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    tag: '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.5" cy="8.5" r="1.6"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="12" cy="12" r="1.1"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/>',
    bolt: '<path d="M13 3L5 13.5h6L10.5 21 19 10.5h-6z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
    wifi: '<path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.4a4 4 0 0 1 6 0"/><path d="M12 19.5h.01M4 4l16 16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M20 6L9 17l-5-5"/>'
  };
  const WA = '<svg class="mk-i" data-wa viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>';
  const ico = (k) => k === 'wa' ? WA : `<svg class="mk-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[k] || P.sonstiges}</svg>`;
  const QUAD = `<svg viewBox="-50 -50 100 100"><circle class="q-ring" r="46"/><path class="q-arm" d="M-24-24L24 24M24-24L-24 24"/><rect class="q-body" x="-11" y="-11" width="22" height="22" rx="6" transform="rotate(45)"/>${[[-24, -24], [24, -24], [-24, 24], [24, 24]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><circle class="q-pr" r="12"/><path class="q-bl ${i % 2 ? 'ccw' : ''}" d="M-11 0H11"/></g>`).join('')}</svg>`;

  /* ---------- Kategorien, Preis, Zeit, Kontakt ---------- */
  const KAT = [
    { k: 'kopter', n: 'Kopter', c: '#3fe0ff' }, { k: 'brille', n: 'Brille', c: '#ffb020' }, { k: 'funke', n: 'Funke', c: '#3ee08a' },
    { k: 'akkus', n: 'Akkus', c: '#ff6b7a' }, { k: 'teile', n: 'Teile', c: '#5aa2ff' }, { k: 'werkzeug', n: 'Werkzeug', c: '#ffd36b' },
    { k: 'sonstiges', n: 'Sonstiges', c: '#c78bff' }
  ];
  const KM = Object.fromEntries(KAT.map(k => [k.k, k]));
  const katOf = (k) => KM[norm(k)] || KAT.find(x => norm(x.n) === norm(k)) || KM.sonstiges;
  const eur = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' €';
  function priceText(ad) {
    const p = ad.preis, s = ad.art === 'suche';
    if (typeof p === 'number' && isFinite(p)) return p === 0 ? 'Zu verschenken' : (s ? 'bis ' : '') + eur(p);
    const t = String(p == null ? '' : p).trim();
    if (!t) return s ? 'Budget offen' : 'Preis offen';
    if (/^\d+([.,]\d+)?$/.test(t)) return (s ? 'bis ' : '') + eur(parseFloat(t.replace(',', '.')));
    return t;
  }
  function parseD(d) {
    const s = String(d || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { d: new Date(s + 'T12:00:00'), day: true };
    const x = new Date(s.replace(' ', 'T'));
    return { d: isNaN(x) ? null : x, day: false };
  }
  const fullDate = (d) => d ? d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  function ago(ad) {
    const d = ad.d; if (!d) return '';
    const now = new Date(), s = (now - d) / 1000;
    const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (!ad.day) {
      if (s < 60) return 'gerade eben';
      if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
      if (days <= 0 || s < 6 * 3600) return `vor ${Math.floor(s / 3600)} Std.`;
    } else if (days <= 0) return 'heute';
    if (days === 1) return 'gestern';
    return d.toLocaleDateString('de-DE', d.getFullYear() === now.getFullYear() ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function contacts(raw) {
    const s = String(raw || '');
    const mails = s.match(/[^\s,;|·<>()"']+@[^\s,;|·<>()"']+\.[a-z]{2,}/gi) || [];
    let rest = s; mails.forEach(m => rest = rest.replace(m, ' '));
    const ph = (rest.match(/\+?\d[\d\s/().-]{4,}\d/g) || []).find(p => p.replace(/\D/g, '').length >= 6);
    let tel = '', wa = '';
    if (ph) {
      const d = ph.replace(/[^\d+]/g, '');
      tel = d.startsWith('+') ? d : d.startsWith('00') ? '+' + d.slice(2) : d.startsWith('0') ? '+49' + d.slice(1) : d;
      wa = tel.replace(/^\+/, ''); if (wa.length < 9) wa = '';
    }
    return { mail: mails[0] || '', tel, wa };
  }
  const safeLink = (u) => { const s = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(s) ? s : ''; };
  const safeImg = (u) => { const s = String(u || ''); return /^data:image\/(webp|jpe?g|png|gif|avif);base64,[\w+/=]+$/i.test(s) || /^blob:/.test(s) || /^(media|assets)\/[\w./-]+$/.test(s) ? s : ''; };

  /* ---------- Datenmodell: data.js + Make + gerade selbst erstellt ---------- */
  let ADS = [], LOCAL = [];
  const S = { loaded: false, loading: false, err: false, wanted: false, shown: false, nudged: false };
  function fromApi(x) {
    const t = parseD(x.d);
    return { id: String(x.id), src: 'api', art: norm(x.art) === 'suche' ? 'suche' : 'biete', kat: x.kat, titel: x.titel || (x.t ? String(x.t).slice(0, 60) : 'Ohne Titel'), t: x.t || '', preis: x.preis, zustand: x.zustand || '', ort: x.ort || '', kontakt: x.kontakt || '', link: x.link || '', n: x.n || '', d: t.d, day: t.day, th: safeImg(x.th), nf: clamp(parseInt(x.nf, 10) || 0, 0, 3) };
  }
  function fromData(a, i) {
    const t = parseD(a.d), img = (Array.isArray(a.img) ? a.img : a.img ? [a.img] : []).map(safeImg).filter(Boolean);
    return { id: 'v-' + (sid(a.id) || i), src: 'data', art: norm(a.art) === 'suche' ? 'suche' : 'biete', kat: a.kat, titel: a.titel || 'Ohne Titel', t: a.t || '', preis: a.preis, zustand: a.zustand || '', ort: a.ort || '', kontakt: [a.kontakt, a.wa, a.mail].filter(Boolean).join(' · '), link: a.link || '', n: a.n || '', d: t.d, day: t.day, th: img[0] || '', img };
  }
  const dataAds = () => (Array.isArray(D.markt) ? D.markt : []).filter(a => a && a.titel).map(fromData);
  const photos = (ad) => ad.src === 'api' ? Array.from({ length: ad.nf }, (_, i) => B().foto(ad.id, i)) : (ad.img || []);
  const thumb = (ad) => ad.th || '';
  const mineMap = () => { try { return (B() && B().mine()) || {}; } catch (e) { return {}; } };
  const isMine = (ad) => ad.src !== 'data' && !ad._pv && !!mineMap()[ad.id];
  const findAd = (id) => ADS.find(a => a.id === id);

  /* ---------- Karte ---------- */
  function cardHTML(ad, pv) {
    const k = katOf(ad.kat), th = thumb(ad), n = ad.src === 'api' ? ad.nf : (ad.img || []).length, mine = isMine(ad), ph = ad._ph || {};
    const title = pv ? `<span${ph.titel ? ' class="is-ph"' : ''}>${esc(ad.titel)}</span>` : `<a href="#a-${esc(ad.id)}" data-open="${esc(ad.id)}">${esc(ad.titel)}</a>`;
    return `<article class="mk-card${ad.art === 'suche' ? ' is-suche' : ''}${mine ? ' is-mine' : ''}" data-id="${esc(ad.id)}" style="--acc:${k.c}"><div class="mk-card-in">
      <div class="mk-media"><span class="mk-noimg">${ico(k.k)}</span>${th ? `<img src="${esc(th)}" alt="" loading="lazy" decoding="async">` : ''}<span class="mk-art">${ad.art === 'suche' ? 'Suche' : 'Biete'}</span>${n > 1 ? `<span class="mk-nimg">${ico('cam')}${n}</span>` : ''}</div>
      <div class="mk-body">
        <p class="mk-price${ph.preis ? ' is-ph' : ''}">${esc(priceText(ad))}</p>
        <h3 class="mk-title">${title}</h3>
        <p class="mk-meta"><span class="mk-kat${ph.kat ? ' is-ph' : ''}">${ico(k.k)}${k.n}</span>${ad.ort ? `<span class="mk-ort">${ico('pin')}${esc(ad.ort)}</span>` : ''}<span class="mk-when">${esc(ago(ad))}</span></p>
        ${mine ? '<span class="mk-minetag">Deine</span>' : ''}
      </div>
    </div></article>`;
  }
  const SKEL = '<div class="mk-card mk-skel" aria-hidden="true"><div class="mk-card-in"><div class="mk-media"></div><div class="mk-body"><i></i><i></i><i></i></div></div></div>';

  /* ---------- Die Wand ---------- */
  const W = { art: 'alle', kat: 'alle', q: '' };
  function match(ad) {
    if (W.art !== 'alle' && ad.art !== W.art) return false;
    if (W.kat !== 'alle' && katOf(ad.kat).k !== W.kat) return false;
    if (W.q) { const hay = norm([ad.titel, ad.t, ad.n, ad.ort, katOf(ad.kat).n, ad.zustand, priceText(ad)].join(' ')); return W.q.split(/\s+/).filter(Boolean).every(w => hay.includes(w)); }
    return true;
  }
  function counts() {
    const all = ADS;
    $$('[data-cnt]').forEach(b => { const a = b.dataset.cnt; b.textContent = a === 'alle' ? all.length : all.filter(x => x.art === a).length; });
    $$('#mk-kats [data-kc]').forEach(s => { const k = s.dataset.kc, n = k === 'alle' ? all.length : all.filter(a => katOf(a.kat).k === k).length; s.textContent = n; s.closest('.chip').classList.toggle('zero', !n); });
    const t = $('#mk-live-t'), on = live() && !S.err;
    $('#mk-live').classList.toggle('on', on); $('#mk-live').classList.toggle('bad', S.err);
    if (!S.loaded) t.textContent = 'Lädt …';
    else if (S.err && !all.length) t.textContent = 'Gerade offline';
    else t.textContent = `${on ? 'Live · ' : ''}${all.length} ${all.length === 1 ? 'Anzeige' : 'Anzeigen'}`;
  }
  function kats() {
    const box = $('#mk-kats'); if (!box) return;
    box.innerHTML = `<label class="chip"><input type="radio" name="mk-kat" value="alle" checked><span>Alle <small data-kc="alle">0</small></span></label>` +
      KAT.map(k => `<label class="chip" style="--acc:${k.c}"><input type="radio" name="mk-kat" value="${k.k}"><span>${ico(k.k)}${k.n} <small data-kc="${k.k}">0</small></span></label>`).join('');
    box.addEventListener('change', e => { W.kat = e.target.value; renderWall({ flip: true }); });
  }
  let segPlace = () => {};
  function seg() {
    const s = $('#mk-seg'); if (!s) return;
    const pill = $('.mk-seg-pill', s);
    const place = segPlace = () => { const c = $('input:checked', s).closest('label'); if (!c.offsetWidth) return; pill.style.width = c.offsetWidth + 'px'; pill.style.transform = `translateX(${c.offsetLeft}px)`; s.classList.toggle('is-suche', W.art === 'suche'); };
    s.addEventListener('change', e => { W.art = e.target.value; place(); renderWall({ flip: true }); });
    addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place);
  }
  function search() {
    const q = $('#mk-q'); if (!q) return;
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { W.q = norm(q.value.trim()); renderWall({ flip: true }); }, 160); });
    // Selbst-Impuls: Beispielbegriffe tippen sich in den Platzhalter
    const EX = ['Tiny Whoop', 'Brille', 'Akkus 4S', 'ELRS-Empfänger', 'Lötstation', 'Funke', 'Propeller'];
    if (RM) { q.placeholder = 'Suchen, z. B. Tiny Whoop'; return; }
    let i = 0, c = 0, dir = 1, h;
    const type = () => {
      if (document.activeElement === q || q.value) { q.placeholder = 'Suchen …'; h = setTimeout(type, 1500); return; }
      const w = EX[i % EX.length]; c += dir; q.placeholder = 'Suchen: ' + w.slice(0, c) + (c < w.length ? '▍' : '');
      if (c >= w.length) { dir = -1; h = setTimeout(type, 1600); return; }
      if (c <= 0) { dir = 1; i++; h = setTimeout(type, 350); return; }
      h = setTimeout(type, dir > 0 ? 85 : 35);
    };
    visible(q, v => { clearTimeout(h); if (v) type(); }, '0px');
  }
  function resetFilter() {
    W.art = 'alle'; W.kat = 'alle'; W.q = ''; $('#mk-q').value = '';
    $$('#mk-seg input')[0].checked = true; const k = $('#mk-kats input'); if (k) k.checked = true; segPlace();
  }
  // Positionen merken, neu zeichnen, Karten gleiten an den neuen Platz (nur transform)
  function flip(mutate) {
    const grid = $('#mk-grid');
    const before = new Map($$('.mk-card', grid).map(c => [c.dataset.id, c.getBoundingClientRect()]));
    mutate();
    if (!anim()) return;
    const cards = $$('.mk-card', grid);
    cards.forEach(c => {
      const b = before.get(c.dataset.id), a = c.getBoundingClientRect();
      if (b) { const dx = b.left - a.left, dy = b.top - a.top; if (Math.abs(dx) + Math.abs(dy) > 1) gsap.fromTo(c, { x: dx, y: dy }, { x: 0, y: 0, duration: .55, ease: 'expo.out', clearProps: 'transform' }); }
      else gsap.fromTo(c, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .45, ease: 'expo.out', clearProps: 'transform,opacity' });
    });
  }
  function renderWall({ flip: fl = false, enter = false } = {}) {
    const grid = $('#mk-grid'), empty = $('#mk-empty'), none = $('#mk-none'), err = $('#mk-err');
    const all = ADS, list = all.filter(match);
    counts(); renderMine();
    grid.setAttribute('aria-busy', 'false');
    err.hidden = !S.err;
    $('#mk-filter').hidden = !all.length; if (all.length) requestAnimationFrame(segPlace);
    $('#wand').classList.toggle('is-empty', !all.length);
    const read = $('#mk-readout'), filtered = W.art !== 'alle' || W.kat !== 'alle' || W.q;
    read.textContent = filtered && all.length ? `${list.length} von ${all.length}` : '';
    if (!all.length) { grid.innerHTML = ''; grid.hidden = true; none.hidden = true; empty.hidden = S.err; goggle(!S.err); return; }
    empty.hidden = true; goggle(false);
    if (!list.length) { grid.innerHTML = ''; grid.hidden = true; none.hidden = false; return; }
    none.hidden = true; grid.hidden = false;
    const draw = () => { grid.innerHTML = list.map(a => cardHTML(a)).join(''); $$('.mk-card', grid).forEach(tiltCard); };
    if (fl) flip(draw); else draw();
    if (enter) enterCards();
  }
  // Erster Auftritt: Karten gleiten nacheinander herein, dann kippt die erste Karte einmal an (Selbst-Impuls)
  function enterCards() {
    const grid = $('#mk-grid'), cards = $$('.mk-card', grid).slice(0, 12);
    if (!cards.length) return;
    if (!anim()) { S.shown = true; return; }
    gsap.set(cards, { opacity: 0, y: 22 });
    visible(grid, (v, io) => {
      if (!v || S.shown) return; S.shown = true; io && io.disconnect();
      gsap.to(cards, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .06, clearProps: 'transform,opacity', onComplete: nudge });
    }, '0px 0px -10% 0px');
  }
  function nudge() {
    if (S.nudged || RM || !window.gsap) return; S.nudged = true;
    const c = $('#mk-grid .mk-card'); if (!c) return;
    setTimeout(() => {
      if (document.querySelector('#mk-dlg[open]')) return;
      c.classList.add('nudge');
      gsap.timeline({ onComplete: () => { c.classList.remove('nudge'); gsap.set(c, { clearProps: 'transform' }); } })
        .to(c, { rotationY: -9, rotationX: 5, y: -6, transformPerspective: 700, duration: .45, ease: 'power2.out' })
        .to(c, { rotationY: 0, rotationX: 0, y: 0, duration: 1.1, ease: 'elastic.out(1,.45)' });
    }, 500);
  }
  function tiltCard(c) {
    if (!FINE || RM) return;
    const inn = c.firstElementChild;
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); inn.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 6 + 'deg'); inn.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 6 + 'deg'); });
    c.addEventListener('pointerleave', () => { inn.style.setProperty('--rx', '0deg'); inn.style.setProperty('--ry', '0deg'); });
  }
  function skeleton() {
    const grid = $('#mk-grid'); grid.hidden = false; grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = SKEL.repeat(innerWidth < 700 ? 3 : 6);
    ['#mk-empty', '#mk-none', '#mk-err'].forEach(s => $(s).hidden = true);
  }
  async function load(fresh) {
    if (S.loading) return; S.loading = true; S.wanted = true;
    if (!S.loaded || fresh) skeleton();
    $('#mk-live-t').textContent = 'Lädt …';
    let api = [], err = false;
    if (live()) {
      try { api = await B().list('markt', fresh ? { fresh: true } : undefined); if (!Array.isArray(api)) throw new Error('liste'); }
      catch (e) { err = true; api = []; }
    }
    const fromServer = api.filter(x => x && x.id && (!x.b || x.b === 'markt')).map(fromApi);
    const lids = new Set(LOCAL.map(a => a.id));
    ADS = [...LOCAL, ...dataAds(), ...fromServer.filter(a => !lids.has(a.id))];
    S.loading = false; S.loaded = true; S.err = err;
    renderWall({ enter: !S.shown });
    if (F.newId && !F.flashed) { F.flashed = true; flash(F.newId); }
    fromHash();
  }
  function wall() {
    kats(); seg(); search();
    $('#mk-retry').addEventListener('click', () => load(true));
    $('#mk-reset').addEventListener('click', () => { resetFilter(); renderWall({ flip: true }); });
    $('#mk-gesuch').addEventListener('click', () => {
      setArt('suche'); const q = $('#mk-q').value.trim(); if (q) $('#mk-titel').value = q;
      if (W.kat !== 'alle') { const r = $(`#mk-katchips input[value="${W.kat}"]`); if (r) r.checked = true; }
      preview();
    });
    $('#mk-grid').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);
    skeleton(); counts();
    // Erst laden, wenn die Wand in die Nähe kommt (eine Abfrage pro Besuch)
    if (/^#a-/.test(location.hash)) load();
    else visible($('#wand'), (v, io) => { if (v && !S.wanted) { io && io.disconnect(); load(); } }, '100% 0px');
  }

  /* ---------- Deine Anzeigen ---------- */
  function renderMine() {
    const box = $('#mk-mine'), list = ADS.filter(isMine);
    box.hidden = !list.length; if (!list.length) return;
    $('#mk-mine-n').textContent = `(${list.length})`;
    $('#mk-mine-list').innerHTML = list.map(a => `<li><button type="button" class="mk-mine-open" data-open="${esc(a.id)}">${esc(a.titel)}</button><button type="button" class="mk-mine-del" data-del="${esc(a.id)}" aria-label="„${esc(a.titel)}“ löschen">${ico('trash')}</button></li>`).join('');
  }

  /* ---------- Leerzustand: Bildrauschen wie in der Brille ---------- */
  const BAND = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917];
  let GG = null;
  function goggle(run) {
    const el = $('#mk-goggle'); if (!el) return;
    if (!GG) {
      const cv = $('#mk-static'), cx = cv.getContext('2d');
      cv.width = 120; cv.height = 60;
      GG = { el, cv, cx, img: cx.createImageData(120, 60), ch: 0, burst: 0, on: false, vis: false, last: 0, user: 0, tim: null };
      const draw = () => {
        const d = GG.img.data, b = GG.burst, roll = (performance.now() / 40) % 60;
        for (let y = 0; y < 60; y++) {
          const tear = Math.random() < .03 + b * .2 ? (Math.random() * 40 - 20) | 0 : 0, band = Math.abs(y - roll) < 4 ? 40 : 0;
          for (let x = 0; x < 120; x++) { const i = (y * 120 + ((x + tear + 120) % 120)) * 4, v = (Math.random() * (140 + b * 110) + band) | 0; d[i] = v * .86; d[i + 1] = v * .93; d[i + 2] = v; d[i + 3] = 255; }
        }
        GG.cx.putImageData(GG.img, 0, 0); GG.burst = Math.max(0, b - .08);
      };
      const loop = (t) => { if (!GG.on || !GG.vis) return; if (t - GG.last > 50) { GG.last = t; draw(); } requestAnimationFrame(loop); };
      GG.start = () => { if (GG.on && GG.vis && !RM) requestAnimationFrame(loop); };
      GG.tune = (i, byUser) => {
        GG.ch = (i + BAND.length) % BAND.length; GG.burst = 1;
        $('#mk-gg-band').textContent = `R${GG.ch + 1} · ${BAND[GG.ch]} MHz`;
        $('#mk-gg-scan').textContent = byUser ? `Kanal R${GG.ch + 1}` : `Bandscan R${GG.ch + 1} …`;
        el.classList.remove('tune'); void el.offsetWidth; el.classList.add('tune'); if (RM) draw();
      };
      el.addEventListener('click', () => { GG.user = performance.now(); GG.tune(GG.ch + 1, true); });
      // Selbst-Impuls: die Brille scannt die Kanäle von allein durch
      GG.auto = () => { clearInterval(GG.tim); if (RM) return; GG.tim = setInterval(() => { if (GG.on && GG.vis && performance.now() - GG.user > 7000) GG.tune(GG.ch + 1); }, 1900); };
      visible(el, v => { GG.vis = v; GG.start(); }, '0px');
      GG.tune(0); draw();
    }
    GG.on = run;
    if (run) { GG.start(); GG.auto(); } else clearInterval(GG.tim);
  }

  /* ---------- Detailansicht ---------- */
  const DLG = { ad: null, i: 0, pushed: false, n: 0 };
  function galleryHTML(ad) {
    const urls = photos(ad), th = thumb(ad), k = katOf(ad.kat);
    DLG.n = urls.length;
    if (!urls.length) return `<div class="mk-noimg big" style="--acc:${k.c}">${ico(k.k)}<span>${safeLink(ad.link) ? 'Fotos bei Kleinanzeigen' : ad.art === 'suche' ? 'Gesuch ohne Foto' : 'Kein Foto'}</span></div>`;
    return (th ? `<img class="mk-gal-bg" src="${esc(th)}" alt="" aria-hidden="true">` : '') +
      urls.map((u, i) => `<figure class="mk-sl${i ? '' : ' on'}" data-i="${i}"><img data-src="${esc(u)}" alt="${esc(ad.titel)}, Foto ${i + 1} von ${urls.length}" decoding="async"><figcaption class="mk-sl-msg">Foto lädt …</figcaption></figure>`).join('') +
      (urls.length > 1 ? `<button class="mk-gal-nav prev" type="button" aria-label="Vorheriges Foto">${ico('left')}</button><button class="mk-gal-nav next" type="button" aria-label="Nächstes Foto">${ico('right')}</button>
        <div class="mk-dots" role="group" aria-label="Fotos">${urls.map((_, i) => `<button type="button" aria-label="Foto ${i + 1} zeigen"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : '') +
      `<p class="mk-gal-n hud"><b data-gi>1</b>/${urls.length}</p>`;
  }
  function showSlide(i) {
    const g = $('#mk-gal'), sl = $$('.mk-sl', g); if (!sl.length) return;
    DLG.i = (i + sl.length) % sl.length;
    sl.forEach((s, j) => s.classList.toggle('on', j === DLG.i));
    $$('.mk-dots button', g).forEach((b, j) => b.setAttribute('aria-current', j === DLG.i ? 'true' : 'false'));
    const gi = $('[data-gi]', g); if (gi) gi.textContent = DLG.i + 1;
    // Foto erst laden, wenn es gezeigt wird (spart Abfragen)
    const fig = sl[DLG.i], im = $('img', fig);
    if (im && !im.src) {
      im.addEventListener('load', () => fig.classList.add('ok'), { once: true });
      im.addEventListener('error', () => { fig.classList.add('fail'); $('.mk-sl-msg', fig).textContent = 'Foto gerade nicht ladbar'; }, { once: true });
      im.src = im.dataset.src;
    }
  }
  function wireGallery() {
    const g = $('#mk-gal'); showSlide(0); if (DLG.n < 2) return;
    $('.prev', g).addEventListener('click', () => showSlide(DLG.i - 1));
    $('.next', g).addEventListener('click', () => showSlide(DLG.i + 1));
    $$('.mk-dots button', g).forEach((b, j) => b.addEventListener('click', () => showSlide(j)));
    let sx = null, sy = 0;
    g.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    g.addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 40 && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) showSlide(DLG.i + (e.clientX < sx ? 1 : -1)); sx = null; });
    // Selbst-Impuls: der Weiter-Pfeil stupst einmal an
    if (anim()) gsap.fromTo($('.next', g), { x: 0 }, { x: 8, duration: .28, yoyo: true, repeat: 3, ease: 'power1.inOut', delay: .9 });
  }
  function infoHTML(ad) {
    const k = katOf(ad.kat), c = contacts(ad.kontakt), mine = isMine(ad), pv = !!ad._pv, link = safeLink(ad.link);
    const hi = ad.art === 'suche' ? `Hallo ${ad.n || ''}, ich habe dein Gesuch „${ad.titel}“ auf der Biete/Suche-Wand des Flight Club Saar gesehen.` : `Hallo ${ad.n || ''}, ich interessiere mich für deine Anzeige „${ad.titel}“ auf der Biete/Suche-Wand des Flight Club Saar.`;
    const btns = [
      c.wa ? `<a class="btn solid wa" href="https://wa.me/${c.wa}?text=${encodeURIComponent(hi)}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>` : '',
      c.tel ? `<a class="btn" href="tel:${esc(c.tel)}">${ico('phone')}Anrufen</a>` : '',
      c.mail ? `<a class="btn${c.wa ? '' : ' solid'}" href="mailto:${esc(c.mail)}?subject=${encodeURIComponent('Biete/Suche: ' + ad.titel)}&body=${encodeURIComponent(hi + '\n\n')}">${ico('mail')}E-Mail</a>` : '',
      link ? `<a class="btn amber" href="${esc(link)}" target="_blank" rel="noopener nofollow ugc">${ico('ext')}Bei Kleinanzeigen</a>` : ''
    ].join('');
    const meta = [ad.zustand ? `<li>${ico('tag')}${esc(ad.zustand)}</li>` : '', ad.ort ? `<li>${ico('pin')}${esc(ad.ort)}</li>` : '', ad.d ? `<li title="${esc(fullDate(ad.d))}">${ico('clock')}${pv ? 'gleich online' : esc(ago(ad))}</li>` : ''].join('');
    return `${pv ? '<p class="mk-d-pv">Vorschau · so sieht deine Anzeige aus</p>' : ''}
      <div class="mk-i-top"><span class="mk-art${ad.art === 'suche' ? ' is-suche' : ''}">${ad.art === 'suche' ? 'Suche' : 'Biete'}</span><span class="mk-kat" style="--acc:${k.c}">${ico(k.k)}${k.n}</span>${mine ? '<span class="mk-minetag">Deine Anzeige</span>' : ''}</div>
      <h3 class="mk-d-h" id="mk-d-h">${esc(ad.titel)}</h3>
      <p class="mk-d-price">${esc(priceText(ad))}</p>
      ${meta ? `<ul class="mk-d-meta">${meta}</ul>` : ''}
      ${ad.t ? `<p class="mk-d-t">${esc(ad.t)}</p>` : ''}
      <p class="mk-d-by">Von <b>${esc(ad.n || 'Pilot')}</b></p>
      <div class="mk-d-btns">${btns || '<p class="mute">Keine Kontaktdaten angegeben.</p>'}</div>
      <p class="mk-d-safe">${ico('shield')}<span>Erst ansehen, dann zahlen. Keine Vorkasse an Fremde. <a href="#sicher" data-close>Sicher handeln</a></span></p>
      ${pv ? '' : `<div class="mk-d-acts">
        <button type="button" class="mk-act-b" data-share>${ico('share')}<span>Teilen</span></button>
        <button type="button" class="mk-act-b${mine ? ' is-mine' : ''}" data-act="del">${ico('trash')}<span>${mine ? 'Anzeige löschen' : 'Löschen'}</span></button>
        <button type="button" class="mk-act-b" data-act="report">${ico('flag')}<span>Melden</span></button>
      </div>
      <div class="mk-act" id="mk-act" hidden></div>`}`;
  }
  function openAd(ad, push, mode) {
    const dlg = $('#mk-dlg'); if (!dlg || !ad) return;
    DLG.ad = ad; DLG.i = 0;
    $('#mk-gal').innerHTML = galleryHTML(ad);
    $('#mk-gal').classList.toggle('has-photos', DLG.n > 0);
    $('#mk-info').innerHTML = infoHTML(ad);
    wireGallery();
    if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); document.documentElement.classList.add('mk-lock'); }
    $('#mk-info').scrollTop = 0; $('.mk-dlg-in').scrollTop = 0;
    if (push && !ad._pv) { try { history.pushState({ mk: ad.id }, '', '#a-' + ad.id); DLG.pushed = true; } catch (e) {} }
    if (mode) act(mode);
    else if (anim()) {
      gsap.fromTo('.mk-dlg-in', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out', clearProps: 'transform,opacity' });
      gsap.from($$('#mk-info > *').slice(0, 8), { y: 14, opacity: 0, stagger: .035, duration: .5, ease: 'expo.out', delay: .06, clearProps: 'transform,opacity' });
    }
  }
  function closeDlg() { const dlg = $('#mk-dlg'); if (dlg.open) dlg.close ? dlg.close() : (dlg.removeAttribute('open'), dlg.dispatchEvent(new Event('close'))); }

  /* Löschen, Code vergessen, Melden: kleine Formulare unten in der Detailansicht */
  const REASONS = ['Betrug oder Spam', 'Unpassender Inhalt', 'Falsche Angaben', 'Schon verkauft', 'Sonstiges'];
  function act(mode) {
    const ad = DLG.ad, box = $('#mk-act'); if (!ad || !box) return;
    const mine = mineMap()[ad.id];
    $$('.mk-d-acts [data-act]').forEach(b => b.setAttribute('aria-expanded', b.dataset.act === mode || (mode === 'forgot' && b.dataset.act === 'del') ? 'true' : 'false'));
    if (mode === 'del' && ad.src === 'data') mode = 'forgot';
    if (mode === 'del') {
      box.innerHTML = `<form class="mk-act-f" data-f="del" novalidate>
        <p class="mk-act-h">${ico('trash')}Anzeige löschen</p>
        ${mine ? '<p class="mk-act-p">Das ist deine Anzeige. Dein Löschcode ist schon eingetragen.</p>' : '<p class="mk-act-p">Gib den Löschcode ein, den du beim Aufgeben bekommen hast.</p>'}
        <div class="field"><label for="mk-del-pw">Löschcode</label><input id="mk-del-pw" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" value="${esc(mine ? mine.pw : '')}" required></div>
        <p class="mk-act-msg" role="alert" hidden></p>
        <div class="btns"><button type="submit" class="btn solid red">Endgültig löschen</button><button type="button" class="btn ghost" data-act-x>Abbrechen</button></div>
        <button type="button" class="mk-linkbtn" data-act-go="forgot">Code vergessen?</button>
      </form>`;
    } else if (mode === 'forgot') {
      box.innerHTML = `<form class="mk-act-f" data-f="forgot" novalidate>
        <p class="mk-act-h">${ico('key')}${ad.src === 'data' ? 'Anzeige löschen lassen' : 'Code vergessen?'}</p>
        <p class="mk-act-p">${ad.src === 'data' ? 'Diese Anzeige hat der Vorstand eingetragen. Schreib ihm kurz, dann nimmt er sie raus.' : 'Kein Problem. Schreib dem Vorstand, dann löscht er die Anzeige für dich.'}</p>
        <div class="field"><label for="mk-fg-n">Dein Name</label><input id="mk-fg-n" maxlength="60" autocomplete="name" value="${esc(ad.n || '')}" required><span class="err">Bitte deinen Namen eingeben.</span></div>
        <div class="field"><label for="mk-fg-k">Wie erreicht man dich?</label><input id="mk-fg-k" maxlength="80" autocomplete="tel" placeholder="Telefon oder E-Mail" required><span class="err">Bitte Telefon oder E-Mail angeben.</span></div>
        <div class="field"><label for="mk-fg-t">Nachricht <small>(freiwillig)</small></label><textarea id="mk-fg-t" rows="2" maxlength="500">Bitte löscht meine Anzeige.</textarea></div>
        <p class="mk-act-msg" role="alert" hidden></p>
        <div class="btns"><button type="submit" class="btn solid">An den Vorstand senden</button><button type="button" class="btn ghost" data-act-x>Abbrechen</button></div>
      </form>`;
    } else if (mode === 'report') {
      box.innerHTML = `<form class="mk-act-f" data-f="report" novalidate>
        <p class="mk-act-h">${ico('flag')}Anzeige melden</p>
        <p class="mk-act-p">Was stimmt nicht? Der Vorstand schaut sich die Anzeige dann an.</p>
        <div class="chips" role="radiogroup" aria-label="Grund">${REASONS.map((r, i) => `<label class="chip"><input type="radio" name="mk-grund" value="${esc(r)}"${i ? '' : ' checked'}><span>${esc(r)}</span></label>`).join('')}</div>
        <div class="field"><label for="mk-rp-t">Magst du kurz mehr sagen? <small>(freiwillig)</small></label><textarea id="mk-rp-t" rows="2" maxlength="500"></textarea></div>
        <p class="mk-act-msg" role="alert" hidden></p>
        <div class="btns"><button type="submit" class="btn solid amber">Melden</button><button type="button" class="btn ghost" data-act-x>Abbrechen</button></div>
      </form>`;
    }
    box.hidden = false;
    const f = $('form', box), first = $('input:not([type=radio]), textarea', f);
    if (anim()) gsap.from(box, { y: 12, opacity: 0, duration: .45, ease: 'expo.out', clearProps: 'transform,opacity' });
    setTimeout(() => { box.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); if (mode === 'del' && first) first.focus({ preventScroll: true }); }, 60);
  }
  function actDone(html, ok) {
    const box = $('#mk-act'); if (!box) return;
    box.innerHTML = `<div class="mk-act-ok${ok ? '' : ' bad'}" role="status">${ok ? ico('check') : ico('wifi')}<p>${html}</p></div>`;
    if (anim()) gsap.from(box.firstElementChild, { scale: .96, opacity: 0, duration: .45, ease: 'back.out(2)', clearProps: 'transform,opacity' });
  }
  async function submitAct(f) {
    const ad = DLG.ad, kind = f.dataset.f, btn = $('[type=submit]', f), msg = $('.mk-act-msg', f);
    const say = (t) => { msg.textContent = t; msg.hidden = false; };
    const busy = (on, t) => { btn.disabled = on; if (t) btn.textContent = t; };
    msg.hidden = true;
    if (kind === 'del') {
      const inp = $('#mk-del-pw'), pw = inp.value.trim();
      if (pw.length < 4) { say('Bitte deinen Löschcode eingeben.'); inp.focus(); return; }
      busy(true, 'Wird gelöscht …');
      let r; try { r = await B().del(ad.id, pw); } catch (e) { r = { ok: false, err: 'netz' }; }
      busy(false, 'Endgültig löschen');
      if (r.ok) { removeAd(ad.id); return; }
      if (r.err === 'code') { say('Code stimmt nicht. Prüf Groß- und Kleinschreibung oder tipp auf „Code vergessen?“.'); inp.select(); if (anim()) gsap.fromTo(inp, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)', clearProps: 'transform' }); }
      else say('Gerade nicht erreichbar, versuch es gleich nochmal.');
    } else if (kind === 'forgot') {
      const n = $('#mk-fg-n'), k = $('#mk-fg-k');
      n.closest('.field').classList.toggle('bad', !n.value.trim()); k.closest('.field').classList.toggle('bad', !k.value.trim());
      if (!n.value.trim() || !k.value.trim()) { (n.value.trim() ? k : n).focus(); return; }
      busy(true, 'Wird gesendet …');
      const r = await notify('Löschcode vergessen (Biete/Suche)', { ID: ad.id, Titel: ad.titel, 'Name in der Anzeige': ad.n || '', Name: n.value.trim(), Kontakt: k.value.trim(), Nachricht: $('#mk-fg-t').value.trim(), Anzeige: shareUrl(ad) });
      busy(false, 'An den Vorstand senden');
      if (r.ok) actDone('<b>Angekommen.</b> Der Vorstand löscht den Beitrag für dich.', true);
      else say('Gerade nicht erreichbar, versuch es gleich nochmal.');
    } else if (kind === 'report') {
      const g = (f.querySelector('[name=mk-grund]:checked') || {}).value || 'Sonstiges';
      busy(true, 'Wird gesendet …');
      const r = await notify('Beitrag melden (Biete/Suche)', { ID: ad.id, Titel: ad.titel, Grund: g, Nachricht: $('#mk-rp-t').value.trim(), Anzeige: shareUrl(ad) });
      busy(false, 'Melden');
      if (r.ok) actDone('<b>Danke.</b> Der Vorstand schaut sich die Anzeige an.', true);
      else say('Gerade nicht erreichbar, versuch es gleich nochmal.');
    }
  }
  async function notify(subject, fields) { try { return (FCS.notify ? await FCS.notify(subject, fields) : { ok: false }) || { ok: false }; } catch (e) { return { ok: false }; } }
  const shareUrl = (ad) => location.origin + location.pathname + '#a-' + ad.id;
  function removeAd(id) {
    closeDlg();
    const card = $(`#mk-grid .mk-card[data-id="${CSS.escape(id)}"]`);
    const done = () => { ADS = ADS.filter(a => a.id !== id); LOCAL = LOCAL.filter(a => a.id !== id); renderWall({ flip: true }); toast('Anzeige gelöscht.'); };
    if (card && anim()) gsap.to(card, { opacity: 0, scale: .9, y: -10, duration: .4, ease: 'power2.in', delay: .15, onComplete: done });
    else done();
  }
  function dialog() {
    const dlg = $('#mk-dlg'); if (!dlg) return;
    $('#mk-x').addEventListener('click', closeDlg);
    dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
    dlg.addEventListener('keydown', e => { if (DLG.n < 2 || e.target.closest('input,textarea')) return; if (e.key === 'ArrowLeft') showSlide(DLG.i - 1); if (e.key === 'ArrowRight') showSlide(DLG.i + 1); });
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('mk-lock');
      if (/^#a-/.test(location.hash)) { if (DLG.pushed && history.state && history.state.mk) history.back(); else try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      DLG.pushed = false;
      const c = DLG.ad && $(`.mk-card[data-id="${CSS.escape(DLG.ad.id)}"] a`); if (c) c.focus({ preventScroll: true });
    });
    dlg.addEventListener('click', e => {
      const a = e.target.closest('[data-close]'); if (a) { e.preventDefault(); closeDlg(); setTimeout(() => openSafe(true), 80); return; }
      const ab = e.target.closest('[data-act]'); if (ab) { act(ab.dataset.act); return; }
      const go = e.target.closest('[data-act-go]'); if (go) { act(go.dataset.actGo); return; }
      if (e.target.closest('[data-act-x]')) { const box = $('#mk-act'); box.hidden = true; box.innerHTML = ''; $$('.mk-d-acts [data-act]').forEach(b => b.setAttribute('aria-expanded', 'false')); return; }
      const s = e.target.closest('[data-share]'); if (s && DLG.ad) {
        const url = shareUrl(DLG.ad), t = $('span', s);
        if (navigator.share && !FINE) navigator.share({ title: DLG.ad.titel + ' · Biete/Suche', url }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { t.textContent = 'Link kopiert'; setTimeout(() => t.textContent = 'Teilen', 2200); }).catch(() => toast(url));
        else toast(url);
      }
    });
    dlg.addEventListener('submit', e => { const f = e.target.closest('.mk-act-f'); if (!f) return; e.preventDefault(); submitAct(f); });
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-open]'); if (o && !o.closest('#mk-dlg')) { e.preventDefault(); const ad = findAd(o.dataset.open); if (ad) openAd(ad, true); return; }
      const d = e.target.closest('[data-del]'); if (d) { const ad = findAd(d.dataset.del); if (ad) openAd(ad, true, 'del'); }
    });
    addEventListener('popstate', fromHash);
  }
  function fromHash() {
    const m = location.hash.match(/^#a-([\w-]+)/), dlg = $('#mk-dlg');
    if (m) {
      if (!S.loaded) { if (!S.loading) load(); return; }
      const ad = findAd(m[1]);
      if (ad) { if (!dlg.open || !DLG.ad || DLG.ad.id !== ad.id) openAd(ad, false); return; }
      toast('Diese Anzeige gibt es nicht mehr.');
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }
    if (dlg.open) closeDlg();
  }
  let toastT;
  function toast(t) { const el = $('#mk-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }

  /* ---------- Anzeige aufgeben ---------- */
  const F = { art: 'biete', files: [], newId: '' };
  const fval = (n) => { const el = $('#mk-form').elements[n]; return el && el.value != null ? String(el.value).trim() : ''; };
  const radio = (n) => (($('#mk-form').querySelector(`[name="${n}"]:checked`)) || {}).value || '';
  function priceField() {
    const pa = radio('Preisart') || 'Festpreis', raw = fval('Preis'), n = raw !== '' && isFinite(+raw) ? Math.max(0, Math.round(+raw)) : null;
    if (pa === 'Zu verschenken' || pa === 'Tausch') return pa;
    if (pa === 'VB') return n !== null ? `${eur(n)} VB` : 'VB';
    if (n === null) return '';
    return n === 0 && F.art === 'biete' ? 'Zu verschenken' : (F.art === 'suche' ? 'bis ' : '') + eur(n);
  }
  function fields() {
    return { b: 'markt', art: F.art, kat: radio('Kategorie'), titel: fval('Titel'), t: fval('Beschreibung'), preis: priceField(), zustand: radio('Zustand'), ort: fval('Ort'), kontakt: fval('Kontakt'), link: safeLink(fval('Kleinanzeigen-Link')), n: fval('Name'), pw: fval('Löschcode') };
  }
  function formAd() {
    const f = fields(), now = new Date();
    return { id: 'vorschau', _pv: true, src: 'local', art: F.art, kat: f.kat || 'sonstiges', titel: f.titel || (F.art === 'suche' ? 'Was suchst du?' : 'Dein Titel'), t: f.t, preis: f.preis, zustand: f.zustand, ort: f.ort, kontakt: f.kontakt, link: f.link, n: f.n || 'Dein Name', d: now, day: false,
      th: F.files[0] ? F.files[0].url : '', img: F.files.map(x => x.url), _ph: { titel: !f.titel, kat: !f.kat, preis: !f.preis } };
  }
  function preview() {
    const box = $('#mk-pv-card'); if (!box) return;
    box.innerHTML = cardHTML(formAd(), true).replace(/<span class="mk-when">[^<]*<\/span>/, '<span class="mk-when">gleich online</span>');
  }
  function setArt(a) {
    F.art = a === 'suche' ? 'suche' : 'biete';
    const f = $('#mk-form'), s = F.art === 'suche';
    const r = f.querySelector(`[name=Art][value="${F.art}"]`); if (r) r.checked = true;
    $('#mk-switch').classList.toggle('is-suche', s);
    $('#mk-price-l').innerHTML = (s ? 'Budget' : 'Preis') + ' <small>(freiwillig)</small>';
    $('#mk-titel').placeholder = s ? 'z. B. Suche gebrauchte FPV-Brille' : 'z. B. 5-Zoll-Freestyle-Kopter, flugbereit';
    $$('.mk-only-biete', f).forEach(c => { c.hidden = s; const i = $('input', c); if (s && i.checked) f.querySelector('[name=Preisart][value=Festpreis]').checked = true; });
    priceMode(); preview();
  }
  function priceMode() {
    const pa = radio('Preisart'), n = $('#mk-preis'), off = pa === 'Zu verschenken' || pa === 'Tausch';
    n.disabled = off; if (off) n.value = '';
  }
  /* Fotos: Vorschau sofort, verkleinert wird beim Veröffentlichen in FCS.board.add */
  const canOpen = (file) => new Promise(res => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(u); im.onerror = () => { URL.revokeObjectURL(u); res(''); }; im.src = u; });
  async function addFiles(list) {
    const files = [...list].filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
    const pf = $('#mk-photofield'), hint = $('#mk-photo-hint'); pf.classList.remove('bad');
    if (!files.length) return;
    const free = 3 - F.files.length;
    if (files.length > free) { hint.textContent = free ? `Es passen 3 Fotos in eine Anzeige. Die ersten ${free} sind übernommen.` : 'Es passen 3 Fotos in eine Anzeige. Entferne erst eins.'; hint.classList.add('note'); }
    for (const file of files.slice(0, Math.max(0, free))) {
      const url = await canOpen(file);
      if (!url) { $('#mk-photo-err').textContent = `„${file.name}“ kann dein Browser nicht öffnen. Bitte als JPG oder PNG versuchen.`; pf.classList.add('bad'); continue; }
      F.files.push({ file, url, id: Math.random().toString(36).slice(2) });
    }
    thumbs(); preview();
  }
  function thumbs() {
    const box = $('#mk-thumbs');
    box.innerHTML = F.files.map((m, i) => `<div class="mk-th" data-id="${m.id}"><img src="${m.url}" alt="Foto ${i + 1}">
      ${i ? `<button type="button" class="mk-th-cover" data-cover="${m.id}" aria-label="Foto ${i + 1} als Titelbild nehmen"><span>Als Titelbild</span></button>` : '<span class="mk-th-tag">Titelbild</span>'}
      <button type="button" class="mk-th-x" data-rm="${m.id}" aria-label="Foto ${i + 1} entfernen">${ico('x')}</button></div>`).join('');
    $('#mk-drop').hidden = F.files.length >= 3;
    $('#mk-drop-sub').textContent = F.files.length ? `noch ${3 - F.files.length} möglich` : (FINE ? 'oder hierher ziehen' : 'aus Galerie oder Kamera');
    if (anim()) gsap.from($$('.mk-th:not(.seen)', box), { scale: .85, opacity: 0, duration: .45, ease: 'back.out(2)', clearProps: 'transform,opacity' });
    $$('.mk-th', box).forEach(t => t.classList.add('seen'));
  }
  function photosUI() {
    const drop = $('#mk-drop'), inp = $('#mk-files');
    inp.addEventListener('change', () => { addFiles(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('#mk-thumbs').addEventListener('click', e => {
      const d = e.target.closest('[data-rm]'), c = e.target.closest('[data-cover]');
      if (d) { const i = F.files.findIndex(m => m.id === d.dataset.rm); if (i > -1) F.files.splice(i, 1); }
      else if (c) { const i = F.files.findIndex(m => m.id === c.dataset.cover); if (i > 0) F.files.unshift(F.files.splice(i, 1)[0]); }
      else return;
      $('#mk-photo-hint').textContent = 'Das erste Foto ist das Titelbild. Wir verkleinern alles automatisch.'; $('#mk-photo-hint').classList.remove('note');
      thumbs(); preview();
    });
    thumbs();
  }
  let kupd = () => {};
  function kontaktUI() {
    const inp = $('#mk-kontakt'), hint = $('#mk-k-hint');
    const upd = kupd = () => {
      const v = inp.value.trim(), c = contacts(v), mail = v.includes('@');
      const i = $('.mk-kin .mk-i'); if (i && i.dataset.k !== (mail ? 'm' : 'p')) { i.outerHTML = ico(mail ? 'mail' : 'phone').replace('<svg ', `<svg data-k="${mail ? 'm' : 'p'}" `); }
      hint.textContent = !v ? 'So melden sich Interessenten bei dir.' : c.mail ? 'Erkannt: E-Mail. Interessenten schreiben dir.' : c.tel ? 'Erkannt: Telefon. Interessenten rufen an oder schreiben per WhatsApp.' : 'Noch keine Nummer oder E-Mail erkannt.';
      hint.classList.toggle('ok', !!(c.mail || c.tel));
    };
    inp.addEventListener('input', upd); upd();
  }
  function check() {
    const f = $('#mk-form'), bad = [];
    const mark = (fld, ok, msg) => { fld.classList.toggle('bad', !ok); if (!ok) { if (msg) { const e = $('.err', fld); if (e) e.textContent = msg; } bad.push(fld); } };
    mark($('#mk-titel').closest('.field'), !!fval('Titel'));
    mark($('#mk-katchips').closest('.field'), !!radio('Kategorie'));
    const lv = fval('Kleinanzeigen-Link'); mark($('#mk-linkfield'), !lv || !!safeLink(lv), 'Der Link sieht nicht richtig aus. Er beginnt mit https://');
    mark($('#mk-name').closest('.field'), !!fval('Name'));
    const kv = fval('Kontakt'), c = contacts(kv);
    mark($('#mk-kontaktfield'), !!(c.mail || c.tel), !kv ? 'Bitte eine Telefonnummer oder E-Mail-Adresse angeben.' : kv.includes('@') ? 'Die E-Mail-Adresse sieht nicht richtig aus.' : 'Die Telefonnummer ist zu kurz.');
    if (live()) mark($('#mk-pwfield'), fval('Löschcode').length >= 4);
    const cons = f.querySelector('[name=Einwilligung]'); cons.closest('.check').classList.toggle('bad', !cons.checked); if (!cons.checked) bad.push(cons.closest('.check'));
    return bad;
  }
  const NAMES = { 'mk-titel': 'Titel', 'mk-katchips': 'Kategorie', 'mk-linkfield': 'Kleinanzeigen-Link', 'mk-name': 'Name', 'mk-kontaktfield': 'Telefon oder E-Mail', 'mk-pwfield': 'Löschcode' };
  function nameOf(fld) {
    if (fld.classList.contains('check')) return 'Haken bei „öffentlich“';
    const k = Object.keys(NAMES).find(id => fld.id === id || fld.querySelector('#' + id)); return k ? NAMES[k] : '';
  }
  async function submit(e) {
    e.preventDefault();
    const f = $('#mk-form');
    if (f.elements._honey && f.elements._honey.value) return;
    const bad = check(), sum = $('#mk-errsum'), sbad = $('#mk-sendbad');
    sbad.hidden = true;
    if (bad.length) {
      sum.innerHTML = `<b>Fast fertig.</b> Bitte prüf noch: ${[...new Set(bad.map(nameOf).filter(Boolean))].map(esc).join(', ')}.`; sum.hidden = false;
      const first = bad[0], i = first.querySelector('input:not([type=hidden]):not(:disabled),textarea'); if (i) i.focus({ preventScroll: true }); scrollToEl(first, -150);
      return;
    }
    sum.hidden = true;
    const btn = $('#mk-submit'), label = $('span', btn);
    btn.disabled = true; label.textContent = F.files.length ? 'Fotos werden hochgeladen …' : 'Wird veröffentlicht …'; btn.classList.add('busy');
    const data = fields();
    let r;
    if (!live()) {
      // Ausweg ohne Live-Server: wie bisher als Nachricht an den Vorstand
      const pw = $('#mk-pw'); pw.disabled = true;
      try { r = await FCS.send(f, Object.fromEntries(F.files.map((m, i) => ['Foto' + (i + 1), m.file]))); r = { ok: r.ok, mail: true }; } catch (err) { r = { ok: false, err: 'netz' }; }
      pw.disabled = false;
    } else {
      try { r = await B().add(data, F.files.map(m => m.file)); } catch (err) { r = { ok: false, err: 'foto' }; }
    }
    btn.disabled = false; btn.classList.remove('busy'); label.textContent = 'Veröffentlichen';
    if (r.ok) { published(r, data); return; }
    sbad.innerHTML = r.err === 'abgelehnt' ? '<b>Das hat der Server nicht angenommen.</b> Prüf bitte deine Angaben, zum Beispiel einen sehr langen Text, und versuch es nochmal.'
      : r.err === 'foto' ? '<b>Ein Foto ließ sich nicht verarbeiten.</b> Entferne es oder nimm ein anderes und versuch es nochmal.'
      : '<b>Gerade nicht erreichbar, versuch es gleich nochmal.</b> Deine Eingaben bleiben stehen.';
    sbad.hidden = false;
    if (anim()) gsap.from(sbad, { y: 8, opacity: 0, duration: .4, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  function published(r, data) {
    try { sessionStorage.removeItem('fcs-markt-draft'); } catch (e) {}
    const done = $('#mk-done'), f = $('#mk-form');
    $('#mk-done-mail').hidden = !r.mail; $('.mk-done-live', done).hidden = !!r.mail; $('#mk-to-new').hidden = !!r.mail;
    if (r.mail) $('#mk-done-h').textContent = 'Danke, deine Anzeige ist unterwegs.';
    else {
      $('#mk-done-h').textContent = 'Deine Anzeige ist online.';
      const now = new Date(), ad = Object.assign({}, data, { id: r.id, src: 'local', d: now, day: false, th: F.files[0] ? F.files[0].url : '', img: F.files.map(m => m.url), art: data.art });
      F.newId = r.id; F.flashed = false; LOCAL.unshift(ad);
      if (S.loaded) { ADS = [ad, ...ADS.filter(a => a.id !== ad.id)]; resetFilter(); renderWall({ flip: true }); F.flashed = true; flash(r.id); }
      const pw = r.pw || data.pw, url = location.origin + location.pathname + '#a-' + r.id;
      $('#mk-code').textContent = pw;
      $('#mk-wa-me').href = 'https://wa.me/?text=' + encodeURIComponent(`Mein Löschcode für die Anzeige „${data.titel}“ auf der Biete/Suche-Wand des Flight Club Saar: ${pw}\n${url}`);
      // Info an den Vorstand (ohne Löschcode). Ein Fehler hier stört das Posten nicht.
      notify('Neue Anzeige auf der Biete/Suche-Wand', { ID: r.id, Art: data.art === 'suche' ? 'Suche' : 'Biete', Titel: data.titel, Kategorie: katOf(data.kat).n, Preis: data.preis || '', Ort: data.ort || '', Name: data.n, Kontakt: data.kontakt, Fotos: String(F.files.length), Anzeige: url });
    }
    f.hidden = true; done.hidden = false;
    $('#mk-pv-l').textContent = r.mail ? 'So erscheint sie nach der Freigabe' : 'So steht sie jetzt auf der Wand';
    done.focus({ preventScroll: true }); scrollToEl(done, -140);
    if (anim()) {
      gsap.from(done, { y: 24, opacity: 0, duration: .7, ease: 'expo.out', clearProps: 'transform,opacity' });
      gsap.from('.mk-done-ok', { scale: 0, rotation: -40, duration: .8, ease: 'back.out(2.4)', delay: .15, clearProps: 'transform' });
      const code = $('#mk-code'); if (window.ScrambleTextPlugin && code.textContent) gsap.from(code, { duration: 1, scrambleText: { text: code.textContent, chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', speed: .6 }, delay: .2 });
    }
  }
  // Neue Anzeige leuchtet kurz auf, sobald man sie auf der Wand sieht
  function flash(id) {
    const card = $(`#mk-grid .mk-card[data-id="${CSS.escape(id)}"]`); if (!card) return;
    card.classList.add('is-new');
    visible(card, (v, io) => { if (!v) return; io && io.disconnect(); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }, '0px 0px -15% 0px');
  }
  function again() {
    const f = $('#mk-form');
    f.reset(); F.files = []; thumbs();
    $$('.field.bad, .check.bad', f).forEach(x => x.classList.remove('bad'));
    $('#mk-pw').value = newCode(); $('#mk-t-n').textContent = '0';
    $('#mk-done').hidden = true; f.hidden = false; $('#mk-pv-l').textContent = 'So erscheint sie auf der Wand';
    setArt('biete'); kupd(); $('#mk-titel').focus({ preventScroll: true }); scrollToEl(f, -150);
  }
  const newCode = () => { try { return B() ? B().code() : ''; } catch (e) { return ''; } };
  function form() {
    const f = $('#mk-form'); if (!f) return;
    $('#mk-katchips').innerHTML = KAT.map(k => `<label class="chip" style="--acc:${k.c}"><input type="radio" name="Kategorie" value="${k.k}" required><span>${ico(k.k)}${k.n}</span></label>`).join('');
    const sw = $('#mk-switch'); if (!RM) sw.classList.add('idle');
    sw.addEventListener('change', e => { sw.classList.remove('idle'); setArt(e.target.value); });
    $$('[name=Preisart]', f).forEach(r => r.addEventListener('change', () => { priceMode(); preview(); }));
    const t = $('#mk-t'), tn = $('#mk-t-n'); t.addEventListener('input', () => tn.textContent = t.value.length);
    let raf = 0;
    const live_ = (e) => { const fld = e.target.closest('.field,.check'); if (fld && fld.classList.contains('bad') && e.target.type !== 'file') { fld.classList.remove('bad'); if (!$$('.field.bad, .check.bad', f).length) $('#mk-errsum').hidden = true; } cancelAnimationFrame(raf); raf = requestAnimationFrame(preview); };
    f.addEventListener('input', live_); f.addEventListener('change', live_);
    $('#mk-pw').value = newCode();
    $('#mk-dice').addEventListener('click', () => { const i = $('#mk-pw'); i.value = newCode(); i.closest('.field').classList.remove('bad'); if (anim()) gsap.fromTo('#mk-dice .mk-i', { rotation: 0 }, { rotation: 360, duration: .6, ease: 'back.out(1.6)', clearProps: 'transform' }); });
    if (!live()) { $('#mk-pwfield').hidden = true; $('#mk-submit span').textContent = 'Anzeige einschicken'; }
    photosUI(); kontaktUI(); priceMode(); setArt('biete'); draft();
    f.addEventListener('submit', submit);
    $('#mk-again').addEventListener('click', again);
    $('#mk-copy').addEventListener('click', () => {
      const code = $('#mk-code').textContent, l = $('#mk-copy span');
      const ok = () => { l.textContent = 'Kopiert'; setTimeout(() => l.textContent = 'Code kopieren', 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(ok).catch(sel); else sel();
      function sel() { const r = document.createRange(); r.selectNodeContents($('#mk-code')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); l.textContent = 'Markiert, jetzt kopieren'; }
    });
    $('#mk-to-new').addEventListener('click', e => {
      e.preventDefault(); const card = $(`#mk-grid .mk-card[data-id="${CSS.escape(F.newId)}"]`);
      if (card) { scrollToEl(card, -140); setTimeout(() => { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }, 600); } else scrollToEl($('#wand'));
    });
    $$('[data-mk-art]').forEach(a => a.addEventListener('click', () => setArt(a.dataset.mkArt)));
    $('#mk-pv-open').addEventListener('click', () => openAd(formAd(), false));
    // Vorschau: am PC links neben dem Formular, am Handy direkt über dem Haken
    const mq = matchMedia('(max-width: 980px)'), pv = $('#mk-pv-box');
    const place = () => (mq.matches ? $('#mk-pv-slot') : $('#mk-pv-aside')).appendChild(pv);
    place(); mq.addEventListener ? mq.addEventListener('change', place) : mq.addListener(place);
  }
  // Unvollständige Eingaben überleben ein versehentliches Neuladen (nur in diesem Tab, ohne Fotos)
  function draft() {
    const f = $('#mk-form'), KEYS = ['Art', 'Titel', 'Kategorie', 'Preis', 'Preisart', 'Zustand', 'Beschreibung', 'Ort', 'Kleinanzeigen-Link', 'Name', 'Kontakt', 'Löschcode'];
    try {
      const d = JSON.parse(sessionStorage.getItem('fcs-markt-draft') || 'null');
      if (d) {
        KEYS.forEach(k => { const el = f.elements[k]; if (!el || d[k] == null || d[k] === '') return; if (el instanceof RadioNodeList) { const r = f.querySelector(`[name="${k}"][value="${CSS.escape(d[k])}"]`); if (r) r.checked = true; } else el.value = d[k]; });
        setArt(d.Art === 'suche' ? 'suche' : 'biete'); priceMode(); $('#mk-t-n').textContent = $('#mk-t').value.length;
      }
    } catch (e) {}
    let t; const save = () => { try { const o = {}; KEYS.forEach(k => { const el = f.elements[k]; if (el) o[k] = el.value; }); sessionStorage.setItem('fcs-markt-draft', JSON.stringify(o)); } catch (e) {} };
    f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 400); }); f.addEventListener('change', () => { clearTimeout(t); t = setTimeout(save, 400); });
  }
  // Vorschau-Karte am PC: schwebt leicht und kippt mit der Maus (Selbst-Impuls)
  function tilt() {
    const stage = $('#mk-pv-stage'), el = $('#mk-pv-tilt'); if (!stage || !el || RM || !FINE) return;
    let idle = true, rx = 0, ry = 0, tx = 0, ty = 0, resume, on = false, t0 = performance.now();
    stage.addEventListener('pointermove', e => { idle = false; clearTimeout(resume); const r = stage.getBoundingClientRect(); ty = (clamp((e.clientX - r.left) / r.width, 0, 1) - .5) * 18; tx = -(clamp((e.clientY - r.top) / r.height, 0, 1) - .5) * 14; });
    stage.addEventListener('pointerleave', () => { tx = ty = 0; resume = setTimeout(() => idle = true, 2200); });
    const loop = (t) => {
      if (!on) return;
      if (matchMedia('(max-width: 980px)').matches) { el.style.transform = ''; requestAnimationFrame(loop); return; }
      if (idle) { const s = (t - t0) / 1000; tx = Math.sin(s * 1.1) * 4; ty = Math.sin(s * .8 + 1) * 8; }
      rx += (tx - rx) * .09; ry += (ty - ry) * .09;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      requestAnimationFrame(loop);
    };
    visible(stage, v => { if (v && !on) { on = true; requestAnimationFrame(loop); } else if (!v) on = false; });
  }
  // Drei Schritte: eine kleine Drohne fliegt von Schritt zu Schritt (Selbst-Impuls)
  function steps() {
    const box = $('#mk-steps'); if (!box) return;
    const items = $$('.mk-step', box), nodes = $$('.mk-step-n', box), quad = $('.mk-steps-quad', box), track = $('.mk-steps-track', box);
    quad.innerHTML = QUAD;
    let pos = [], cur = 0, timer = null;
    const measure = () => {
      const b = box.getBoundingClientRect(); if (!b.width) return;
      pos = nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; });
      Object.assign(track.style, { left: pos[0].x + 'px', top: pos[0].y + 'px', width: (pos[2].x - pos[0].x) + 'px' });
      if (window.gsap) gsap.set(quad, { x: pos[cur].x, y: pos[cur].y }); else quad.style.transform = `translate(${pos[cur].x}px,${pos[cur].y}px)`;
      track.style.setProperty('--f', cur / 2);
    };
    const mark = (i) => items.forEach((w, j) => { w.classList.toggle('on', j === i); w.classList.toggle('done', j < i); });
    const go = (i) => {
      cur = i; mark(i); track.style.setProperty('--f', i / 2);
      if (!anim() || !pos.length) { measure(); return; }
      gsap.to(quad, { x: pos[i].x, y: pos[i].y, duration: i ? .9 : 1.2, ease: 'power2.inOut', overwrite: 'auto' });
      gsap.timeline({ overwrite: 'auto' }).to(quad, { rotation: i ? 14 : -14, duration: .4, ease: 'power2.out' }).to(quad, { rotation: 0, duration: .6, ease: 'back.out(2)' });
    };
    requestAnimationFrame(measure); addEventListener('resize', () => requestAnimationFrame(measure)); if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(measure));
    mark(0);
    if (RM) { quad.hidden = true; items.forEach(w => { w.classList.remove('on'); w.classList.add('done'); }); track.style.setProperty('--f', 1); return; }
    visible(box, v => { clearInterval(timer); timer = null; if (v) timer = setInterval(() => go((cur + 1) % 3), 2300); }, '0px');
  }

  /* ---------- Sicher handeln (Aufklapper mit Check) ---------- */
  function openSafe(scroll) {
    const d = $('#sicher'); if (!d) return;
    d.open = true; if (scroll) setTimeout(() => scrollToEl(d, -100), 30);
  }
  function safe() {
    const d = $('#sicher'), boxes = $$('#mk-checks input'); if (!d) return;
    $('.mk-arm-q').innerHTML = QUAD;
    const upd = () => {
      const n = boxes.filter(b => b.checked).length, all = n === boxes.length;
      $('#mk-safe-st').textContent = `${n}/${boxes.length}`; d.classList.toggle('armed', all);
      $('#mk-arm-state').textContent = all ? 'Armed. Bereit zum Handeln.' : n ? `Noch ${boxes.length - n} ${boxes.length - n === 1 ? 'Punkt' : 'Punkte'} offen.` : 'Hak die Punkte ab wie vor dem Abheben.';
    };
    boxes.forEach(b => b.addEventListener('change', () => { upd(); if (anim() && b.checked) gsap.fromTo(b.closest('.mk-chk').querySelector('.mk-chk-box'), { scale: .6 }, { scale: 1, duration: .5, ease: 'back.out(3)', clearProps: 'transform' }); }));
    upd();
    document.addEventListener('click', e => { const a = e.target.closest('a[href="#sicher"]'); if (a && !a.closest('#mk-dlg')) openSafe(false); });
    if (location.hash === '#sicher') openSafe(false);
    d.addEventListener('toggle', () => { d.classList.remove('idle'); if (d.open && anim()) gsap.from($$('#mk-checks li'), { y: 10, opacity: 0, stagger: .06, duration: .5, ease: 'expo.out', clearProps: 'transform,opacity' }); });
    if (!RM) visible(d, (v, io) => { if (v) { io && io.disconnect(); d.classList.add('idle'); } }, '0px 0px -20% 0px');
  }

  /* ---------- Marktplatz intern: das Schloss springt auf, wenn man auf „Mitglied werden“ zeigt ---------- */
  function intern() {
    const box = $('#gruppe'), lock = $('#mk-lock'); if (!box) return;
    const open = (o) => lock.classList.toggle('open', o);
    const b = $('#mk-join');
    b.addEventListener('pointerenter', () => open(true)); b.addEventListener('pointerleave', () => open(false));
    b.addEventListener('focus', () => open(true)); b.addEventListener('blur', () => open(false));
    if (!RM) visible(box, (v, io) => { if (!v) return; io && io.disconnect(); setTimeout(() => { open(true); setTimeout(() => open(false), 1300); }, 500); }, '0px 0px -20% 0px');
  }

  function init() {
    D = (window.FCS && FCS.data) || {};
    $$('[data-ico]').forEach(i => { i.outerHTML = ico(i.dataset.ico); });
    wall(); dialog(); form(); tilt(); steps(); safe(); intern();
    // Endlos-Animationen laufen nur, solange ihr Abschnitt zu sehen ist
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('mk-off', !e.isIntersecting)), { rootMargin: '100px 0px' }); $$('main > section').forEach(sec => io.observe(sec)); }
    if (window.ScrollTrigger && window.ResizeObserver) { let h = 0, t; new ResizeObserver(() => { const nh = document.documentElement.scrollHeight; if (Math.abs(nh - h) > 30) { h = nh; clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250); } }).observe(document.body); }
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
