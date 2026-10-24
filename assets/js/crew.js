/* Flight Club Saar – Crew-Seite
   Seitenkopf mit OSD-Menü, Verweis-Karte zum Clip-Studio (filmen.html), Crew 2026, Piloten aus der Community
   als dichtes Raster mit Wendekarten, Profil mit Live-Karte, Pinnwand.
   Das Clip-Studio selbst liegt in studio.js. Jede Funktion bricht ab, wenn ihr Element fehlt. */
(function () {
  'use strict';

  const ICON = {
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.9 5.9 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>'
  };
  const SOC = { ig: ['Instagram', h => 'https://www.instagram.com/' + h + '/'], tt: ['TikTok', h => 'https://www.tiktok.com/@' + h], yt: ['YouTube', h => 'https://www.youtube.com/@' + h] };

  let D, RM, FINE, $, $$;
  const gs = () => window.gsap;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tS = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };
  const handle = v => String(v || '').trim().replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|youtube\.com)\/?/i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  const go = (el, off) => { if (!el) return; if (FCS.scrollTo) FCS.scrollTo(el, off); else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  const attach = (input, file) => { try { const dt = new DataTransfer(); if (file) dt.items.add(file); input.files = dt.files; return true; } catch (e) { return false; } };
  const slug = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const deDate = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const onVis = (el, cb, margin) => { if (!el) return; new IntersectionObserver(es => cb(es[0].isIntersecting), { rootMargin: margin || '0px' }).observe(el); };

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
    if (!zone || !input) return;
    ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', ev => { const f = ev.dataTransfer && ev.dataTransfer.files[0]; if (f) onFile(f); });
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
  }
  function chipsToHidden(box, hidden, cb) {
    if (!box || !hidden) return;
    const upd = () => { hidden.value = $$('input:checked', box).map(i => i.value).join(', '); if (cb) cb(hidden.value); };
    box.addEventListener('change', upd); upd();
  }

  /* =====================================================================
     Seitenkopf: OSD-Menü mit wanderndem Cursor + Flugzeit
     ===================================================================== */
  function head() {
    const clock = $('#cw-clock'), t0 = Date.now();
    let vis = true; onVis($('.cw-head'), v => { vis = v; });
    if (clock) setInterval(() => { if (vis) clock.textContent = tS((Date.now() - t0) / 1000).padStart(5, '0'); }, 1000);
    const m = $('#cw-menu'); if (!m) return;
    const items = $$('a', m); let i = 0, auto = null;
    const on = n => { i = (n + items.length) % items.length; items.forEach((a, k) => a.classList.toggle('on', k === i)); };
    on(0);
    const stop = () => { if (auto) { clearInterval(auto); auto = null; } };
    if (!RM) auto = setInterval(() => { if (vis) on(i + 1); }, 1700);
    items.forEach((a, k) => { a.addEventListener('pointerenter', () => { stop(); on(k); }); a.addEventListener('focus', () => { stop(); on(k); }); });
    m.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault(); stop(); on(i + (e.key === 'ArrowDown' ? 1 : -1)); items[i].focus();
    });
    m.addEventListener('pointerdown', stop);
    if (gs() && !RM) gs().from(items, { x: 30, opacity: 0, stagger: .07, duration: .7, ease: 'expo.out', delay: .4 });
  }

  /* =====================================================================
     Verweis-Karte Clip-Studio: Logos fliegen von allein aufs Video (Selbst-Impuls)
     ===================================================================== */
  function studioCard() {
    const card = $('.csc'); if (!card) return;
    const logo = $('.csc-logo', card), ay = $('.csc-ayedo', card), steps = $$('.csc-steps > span', card);
    if (!gs() || RM) { steps.forEach(s => s.classList.add('on')); return; }
    const tl = gs().timeline({ repeat: -1, repeatDelay: 1.6, paused: true })
      .set([logo, ay], { opacity: 0 })
      .add(() => { steps.forEach(s => s.classList.remove('on')); steps[0].classList.add('on'); })
      .fromTo(logo, { opacity: 0, scale: 1.8, rotation: -20, x: -40, y: 30 }, { opacity: 1, scale: 1, rotation: -6, x: 0, y: 0, duration: .9, ease: 'expo.out' }, '+=.8')
      .add(() => steps[1].classList.add('on'), '<')
      .fromTo(ay, { opacity: 0, scale: 1.6, y: -30 }, { opacity: 1, scale: 1, y: 0, duration: .8, ease: 'expo.out' }, '+=.5')
      .add(() => steps[2].classList.add('on'), '+=.7')
      .to([logo, ay], { opacity: 0, duration: .4, ease: 'power2.in' }, '+=2.4');
    onVis(card, v => { v ? tl.play() : tl.pause(); }, '0px');
    if (FINE) {
      const vis = $('.csc-vis', card);
      card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); gs().to(vis, { rotateY: ((e.clientX - r.left) / r.width - .5) * 10, rotateX: -((e.clientY - r.top) / r.height - .5) * 8, duration: .6, transformPerspective: 900 }); });
      card.addEventListener('pointerleave', () => gs().to(vis, { rotateY: 0, rotateX: 0, duration: .8, ease: 'expo.out' }));
    }
  }

  /* =====================================================================
     Profil mit Live-Karte
     ===================================================================== */
  function profile() {
    const f = $('#profform'); if (!f) return;
    const card = $('#pcard'), seit = $('#pf-seit'); if (!card || !seit) return;
    const y = new Date().getFullYear();
    seit.innerHTML = '<option value="">Bitte wählen</option>' + Array.from({ length: y - 2009 }, (_, i) => `<option>${y - i}</option>`).join('') + '<option value="vor 2010">vor 2010</option>';
    const val = id => (($('#' + id) || {}).value || '').trim();
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v || '…'; };
    const upd = () => {
      const name = val('pf-name'), alias = val('pf-alias');
      $('#pc-name').textContent = name || 'Dein Name';
      $('#pc-alias').textContent = alias || 'Dein Pilotenname';
      $('#pc-ini').textContent = (alias || name || '?').charAt(0).toUpperCase();
      set('pc-seit', val('pf-seit')); set('pc-ort', val('pf-ort')); set('pc-stil', $('#pf-stil-v').value);
      set('pc-kopter', val('pf-kopter')); set('pc-brille', val('pf-brille')); set('pc-funke', val('pf-funke'));
      const soc = $('#pc-soc'), ok = ($('#pf-soc') || {}).checked;
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
      idle = gs().timeline({ repeat: -1, yoyo: true, paused: true }).to(card, { rotateY: 10, rotateX: -5, y: -6, duration: 2.6, ease: 'sine.inOut' });
      onVis(card, v => { if (idle) v ? idle.play() : idle.pause(); });
      if (window.ScrollTrigger) ScrollTrigger.create({ trigger: card, start: 'top 75%', once: true, onEnter: () => { setTimeout(() => { if (!f.contains(document.activeElement)) { flip(true); setTimeout(() => flip(false), 1800); } }, 900); } });
      const stage = $('#pc-stage');
      if (FINE && stage) {
        stage.addEventListener('pointermove', e => { stopIdle(); const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, yy = (e.clientY - r.top) / r.height - .5; gs().to(card, { rotateY: x * 22, rotateX: -yy * 16, y: 0, duration: .5 }); card.style.setProperty('--sx', (x * 140) + '%'); });
        stage.addEventListener('pointerleave', () => gs().to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
      }
      f.addEventListener('input', stopIdle, { once: true });
    }
    f.addEventListener('fcs:sent', () => flip(false));
  }

  /* =====================================================================
     Crew 2026 + Piloten aus der Community
     Einwilligung: Crew nur mit ok, Piloten nur aus FCS.data.piloten (öffentlich gelistet).
     ===================================================================== */
  function tilt(c) {
    if (!FINE || !gs() || RM) return;
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; gs().to(c, { rotateY: x * 16, rotateX: -y * 12, duration: .4 }); c.style.setProperty('--sx', (x * 120) + '%'); });
    c.addEventListener('pointerleave', () => gs().to(c, { rotateY: 0, rotateX: 0, duration: .8, ease: 'elastic.out(1,.5)' }));
  }
  function socLinks(o) {
    return ['ig', 'tt', 'yt'].filter(k => o[k]).map(k => { const h = handle(o[k]); return `<a href="${SOC[k][1](encodeURIComponent(h))}" target="_blank" rel="noopener" aria-label="${SOC[k][0]} von ${esc(o.a || o.n || '')}">${ICON[k]}</a>`; }).join('');
  }
  function crew() {
    const deck = $('#cdeck'); if (!deck) return;
    const list = (D.crew || []).filter(c => c.ok), rest = (D.crew || []).length - list.length;
    const top = '<div class="mc-top"><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Mitgliedskarte<br><b>2026</b></span></div>';
    deck.innerHTML = list.map(c => {
      const name = c.n || c.a, alias = c.n ? c.a : '';
      const back = [c.seit ? `<span>FPV seit <b>${esc(c.seit)}</b></span>` : '', c.stil ? `<span>Stil <b>${esc(c.stil)}</b></span>` : '', c.ort ? `<span>Aus <b>${esc(c.ort)}</b></span>` : ''].filter(Boolean).join('') || '<span>Mitglied im Flight Club Saar</span>';
      return `<div class="card3${c.v ? ' v' : ''}" tabindex="0" role="button" aria-pressed="false"><span class="sr">Karte umdrehen: </span><div class="c3-in">
        <div class="c3-f c3-front">${top}
        ${c.img ? `<img class="mc-ph" src="${esc(c.img)}" alt="" loading="lazy" width="400" height="400">` : ''}<div style="align-self:end"><div class="mc-name">${esc(name)}</div><div class="mc-alias">${esc(alias)}</div></div>
        <div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">${esc(c.r || 'Mitglied')}</span></div><i class="mc-shine"></i></div>
        <div class="c3-f c3-back"><div class="cc-b">${back}</div></div></div></div>`;
    }).join('') + (rest > 0 ? `<div class="card3 more" tabindex="0" role="button" aria-pressed="false"><span class="sr">Karte umdrehen: </span><div class="c3-in"><div class="c3-f c3-front">${top}<div style="align-self:end"><div class="mc-name">+${rest}</div><div class="mc-alias">weitere Piloten</div></div><div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">Crew 2026</span></div><i class="mc-shine"></i></div><div class="c3-f c3-back"><div class="cc-b"><span>Dabei und bezahlt. Wer mit Namen hierher möchte, ergänzt einfach sein Profil.</span></div></div></div></div>` : '') + '<a class="card3 free" href="#profil"><div class="c3-in"><div class="c3-f c3-front"><b>+ Du?</b><span>Profil ergänzen</span></div></div></a>';
    const cards = $$('.card3', deck);
    cards.forEach(c => {
      if (c.classList.contains('free')) return;
      const t = () => { c.classList.toggle('flip'); c.setAttribute('aria-pressed', c.classList.contains('flip')); };
      c.addEventListener('click', e => { if (e.target.closest('a')) return; t(); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
      tilt(c);
    });
    // Austeilen wie ein Kartenspiel, danach dreht sich die erste Karte von selbst um
    if (gs() && window.ScrollTrigger && !RM) {
      ScrollTrigger.create({ trigger: deck, start: 'top 82%', once: true, onEnter: () => {
        gs().from(cards, { y: 40, rotation: (i) => (i % 2 ? 6 : -6), opacity: 0, duration: .9, stagger: .07, ease: 'expo.out',
          onComplete: () => { const f = cards[0]; f.classList.add('flip'); setTimeout(() => f.classList.remove('flip'), 1700); } });
      } });
    }
    piloten();
  }
  const STIL = { cinema: 'Cinematic', cinematic: 'Cinematic', whoop: 'Whoops', whoops: 'Whoops', 'tiny whoop racing': ['Whoops', 'Racing'], race: 'Racing', racing: 'Racing', 'long range': 'Long Range', freestyle: 'Freestyle', 'juicy sbang': 'Juicy SBang', '3d': '3D', 'aggro acro': 'Aggro Acro', aggressive: 'Aggressive' };
  const tags = s => [...new Set(String(s || '').split(/[,·]/).map(x => x.trim()).filter(Boolean).flatMap(x => { const m = STIL[x.toLowerCase()]; return m ? [].concat(m) : [x]; }))];
  function piloten() {
    const grid = $('#pl-grid'), P = D.piloten || []; if (!grid) return;
    if (!P.length) { const pl = $('#piloten'); if (pl) pl.hidden = true; return; }
    const all = P.map((p, i) => ({ p, i, t: tags(p.stil), q: [p.a, p.n, p.ort].join(' ').toLowerCase() }));
    // Dichtes Raster: vorne Foto, Name, seit wann. Antippen dreht die Karte um (Name, Ort, Stil, Kanäle)
    grid.innerHTML = all.map(({ p, t, i }) => {
      const soc = socLinks(p), ini = esc(String(p.a || '?').charAt(0).toUpperCase());
      return `<article class="plc" data-i="${i}"><div class="plc-in">
        <button type="button" class="plc-f plc-front" aria-expanded="false" aria-controls="plc-b${i}">
          <span class="plc-img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" width="400" height="400">` : `<span>${ini}</span>`}</span>
          <span class="plc-a">${esc(p.a)}</span><span class="plc-seit hud">${p.seit ? 'seit ' + esc(p.seit) : '&nbsp;'}</span><span class="sr">Details zeigen</span></button>
        <div class="plc-f plc-back" id="plc-b${i}">
          <p class="plc-b-a">${esc(p.a)}</p>
          <p class="plc-n">${[p.n, p.ort].filter(Boolean).map(esc).join(' · ') || 'Pilot im Saarland'}</p>
          ${p.seit ? `<p class="plc-sx hud">FPV seit ${esc(p.seit)}</p>` : ''}
          ${t.length ? `<p class="plc-t">${t.slice(0, 4).map(x => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
          ${soc ? `<p class="plc-s">${soc}</p>` : ''}
          <button type="button" class="plc-x" aria-label="Karte von ${esc(p.a)} zurückdrehen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg></button>
        </div></div></article>`;
    }).join('');
    const els = $$('.plc', grid);
    const setFlip = (el, on) => { el.classList.toggle('flip', on); const b = $('.plc-front', el); if (b) b.setAttribute('aria-expanded', on); };
    els.forEach(el => {
      $('.plc-front', el).addEventListener('click', () => { stopDemo(); els.forEach(o => { if (o !== el) setFlip(o, false); }); setFlip(el, true); setTimeout(() => { const x = $('.plc-x', el); if (x && el.contains(document.activeElement)) x.focus({ preventScroll: true }); }, 50); });
      $('.plc-back', el).addEventListener('click', e => { if (e.target.closest('a')) return; setFlip(el, false); $('.plc-front', el).focus({ preventScroll: true }); });
      el.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('flip')) { setFlip(el, false); $('.plc-front', el).focus(); } });
    });
    // Filter-Chips nach Häufigkeit
    const cnt = {}; all.forEach(x => x.t.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    const keys = Object.keys(cnt).filter(k => cnt[k] > 1).sort((a, b) => cnt[b] - cnt[a]);
    const fbox = $('#pl-f'), q = $('#pl-q'), read = $('#pl-read');
    fbox.innerHTML = `<label class="chip"><input type="radio" name="pl-f" value="" checked><span>Alle</span></label>` + keys.map(k => `<label class="chip"><input type="radio" name="pl-f" value="${esc(k)}"><span>${esc(k)} <small>${cnt[k]}</small></span></label>`).join('');
    let rt = 0;
    const apply = (anim = true) => {
      const s = (($('input[name=pl-f]:checked') || {}).value) || '', term = q.value.trim().toLowerCase();
      let n = 0; const show = [];
      all.forEach((x, i) => { const ok = (!s || x.t.includes(s)) && (!term || x.q.includes(term)); els[i].hidden = !ok; if (!ok) setFlip(els[i], false); if (ok) { n++; show.push(els[i]); } });
      read.textContent = n === all.length ? `${n} Piloten` : n ? `${n} von ${all.length}` : 'Kein Pilot gefunden. Probier einen anderen Namen oder Stil.';
      if (anim && gs() && !RM && show.length) gs().fromTo(show, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .02, ease: 'expo.out', overwrite: true });
      if (window.ScrollTrigger) { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 400); }
    };
    fbox.addEventListener('change', () => { stopDemo(); apply(); });
    q.addEventListener('input', () => { stopDemo(); apply(); });
    apply(false);
    // Selbst-Impuls: nacheinander dreht sich je eine Karte kurz um, bis jemand selbst tippt
    const hint = $('#pl-hint'); let demo = null, k = 0, vis = false;
    function stopDemo() { if (demo) { clearInterval(demo); demo = null; } if (hint) hint.classList.add('gone'); els.forEach(e => e.classList.remove('peek')); }
    onVis(grid, v => { vis = v; if (v && hint && demo) hint.classList.add('on'); }, '-15% 0px');
    if (!RM) demo = setInterval(() => {
      if (!vis || document.hidden) return;
      const shown = els.filter(e => !e.hidden); if (!shown.length) return;
      const el = shown[(k++ * 5) % Math.min(shown.length, 10)];
      el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1500);
    }, 3200);
    grid.addEventListener('pointerdown', stopDemo, { passive: true });
    if (gs() && window.ScrollTrigger && !RM) gs().from(els, { y: 30, opacity: 0, duration: .7, stagger: .025, ease: 'expo.out', scrollTrigger: { trigger: grid, start: 'top 88%', once: true } });
  }

  /* =====================================================================
     Pinnwand
     ===================================================================== */
  function pinboard() {
    const feed = $('#pin-feed'); if (!feed) return;
    const posts = [...(D.pinnwand || [])].sort((a, b) => String(b.d).localeCompare(String(a.d)));
    const clips = [...(D.clips || [])].sort((a, b) => String(b.d).localeCompare(String(a.d)));
    if (posts.length || clips.length) {
      const ns = $('#nosig'); if (ns) ns.remove();
      let h = '';
      if (clips.length) h += `<p class="pin-sub">Clips aus der Crew</p><div class="clipgrid">${clips.map(c => `<figure class="clipc" style="margin:0"><video src="${esc(c.src)}"${c.poster ? ` poster="${esc(c.poster)}"` : ''} controls playsinline preload="none"></video><figcaption><b>${esc(c.n)}</b><br><span>${deDate(c.d)}</span>${c.ig ? ` · <a href="${SOC.ig[1](encodeURIComponent(handle(c.ig)))}" target="_blank" rel="noopener">@${esc(handle(c.ig))}</a>` : ''}</figcaption></figure>`).join('')}</div>`;
      if (posts.length) h += (clips.length ? '<p class="pin-sub">Beiträge</p>' : '') + posts.map((p, i) => `<article class="post panel">
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
      if (gs() && window.ScrollTrigger && !RM) ScrollTrigger.batch($$('.post,.clipc', feed), { start: 'top 88%', once: true, onEnter: b => gs().from(b, { y: 30, opacity: 0, stagger: .08, duration: .9, ease: 'expo.out' }) });
    } else noSignal();
    // Neuer Beitrag: Foto verkleinern
    const pf = $('#pin-form'); if (!pf) return;
    const txt = $('#pw-txt'); if (txt) txt.addEventListener('input', () => { $('#pw-cnt').textContent = txt.value.length; });
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
    [head, studioCard, crew, profile, pinboard].forEach(fn => { try { fn(); } catch (e) { console.error('Crew-Seite:', fn.name, e); } });
    $$('details.fold').forEach(d => d.addEventListener('toggle', () => { if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh()); }));
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 300);
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
