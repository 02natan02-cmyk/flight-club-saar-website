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

  /* ---------- Live-Werkzeuge (gleich in spots.js und crew.js): Löschen mit Code, Code vergessen, Melden, Code kopieren ----------
     Alles aus der API wird escaped. Ein Beitrag im DOM trägt data-lv-id und enthält lvActs(). */
  const LVI = {
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z"/><path d="M9 9.5c.3 2.3 2.2 4.3 4.6 4.9l1.2-1.2 1.7.8-.5 1.6c-3.8.2-7.4-3.3-7.3-7.2l1.6-.5.8 1.7z"/></svg>'
  };
  const LV_NAME = 'fcs-name';
  const lvEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lvName = () => { try { return String(localStorage.getItem(LV_NAME) || '').slice(0, 40); } catch (e) { return ''; } };
  const lvKeepName = v => { try { if (v) localStorage.setItem(LV_NAME, String(v).slice(0, 40)); } catch (e) {} };
  const lvMine = id => { try { const m = FCS.board.mine()[id]; return m && m.pw ? m : null; } catch (e) { return null; } };
  const lvNow = () => { const z = new Date(), p = n => String(n).padStart(2, '0'); return `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}T${p(z.getHours())}:${p(z.getMinutes())}:${p(z.getSeconds())}`; };
  const lvAgo = d => {
    const t = new Date(String(d || '').replace(' ', 'T')); if (isNaN(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000), m = s / 60, h = m / 60, dd = h / 24;
    if (m < 1) return 'gerade eben';
    if (m < 60) return `vor ${Math.floor(m)} ${Math.floor(m) === 1 ? 'Minute' : 'Minuten'}`;
    if (h < 24) return `vor ${Math.floor(h)} ${Math.floor(h) === 1 ? 'Stunde' : 'Stunden'}`;
    if (dd < 2) return 'gestern';
    if (dd < 14) return `vor ${Math.floor(dd)} Tagen`;
    if (dd < 60) return `vor ${Math.floor(dd / 7)} Wochen`;
    return 'am ' + t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const lvTime = d => `<time datetime="${lvEsc(d)}" title="${lvEsc(String(d || '').replace('T', ' ').slice(0, 16))}">${lvEsc(lvAgo(d))}</time>`;
  const lvActs = (noDel) => `<div class="lv-acts">${noDel ? '' : `<button class="lv-a" type="button" data-lv="del" aria-expanded="false">${LVI.del}<span>Löschen</span></button>`}<button class="lv-a" type="button" data-lv="rep" aria-expanded="false">${LVI.flag}<span>Melden</span></button></div><div class="lv-pan" hidden></div>`;
  const lvBusy = (btn, on, txt) => { if (!btn) return; if (on) { btn._t = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="lv-spin" aria-hidden="true"></span>${txt || 'Moment …'}`; } else { btn.disabled = false; if (btn._t != null) btn.innerHTML = btn._t; } };
  async function lvCopy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const i = document.createElement('textarea'); i.value = text; i.setAttribute('readonly', ''); i.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(i); i.select(); ok = document.execCommand('copy'); i.remove(); } catch (er) {}
    }
    if (btn) { const lb = btn.querySelector('span') || btn; const was = lb.textContent; lb.textContent = ok ? 'Kopiert' : 'Bitte selbst markieren'; btn.classList.toggle('done', ok); setTimeout(() => { lb.textContent = was; btn.classList.remove('done'); }, 2200); }
    return ok;
  }
  // Beitrag animiert entfernen, die anderen rutschen weich nach (nur transform/opacity)
  function lvRemove(el, done) {
    const g = window.gsap && !RM ? window.gsap : null;
    const sibs = el.parentElement ? [...el.parentElement.children].filter(x => x !== el) : [];
    const pos = new Map(sibs.map(x => { const r = x.getBoundingClientRect(); return [x, [r.left, r.top]]; }));
    const fin = () => {
      el.remove(); if (done) done();
      if (g) sibs.forEach(x => { if (!x.isConnected) return; const r = x.getBoundingClientRect(), p = pos.get(x); const dx = p[0] - r.left, dy = p[1] - r.top; if (dx || dy) g.from(x, { x: dx, y: dy, duration: .55, ease: 'expo.out', clearProps: 'x,y' }); });
    };
    if (g) g.to(el, { opacity: 0, scale: .92, duration: .35, ease: 'power2.in', onComplete: fin }); else fin();
  }
  /* lvWire(root, opt): Löschen/Melden an allen Beiträgen in root.
     opt.what 'Bewertung' | 'Beitrag'; opt.acc 'die Bewertung' | 'den Beitrag'; opt.it 'sie' | 'ihn';
     opt.mine 'Das ist deine.' | 'Das ist deiner.'; opt.area Betreff-Zusatz;
     opt.get(id) → Eintrag; opt.excerpt(e) → kurzer Text; opt.onDeleted(id, el) */
  function lvWire(root, opt) {
    if (!root || root._lv) return; root._lv = true;
    const post = el => el.closest('[data-lv-id]');
    const close = (p) => { const pan = p && $('.lv-pan', p); if (!pan) return; pan.hidden = true; pan.innerHTML = ''; $$('[data-lv]', p).forEach(b => b.setAttribute('aria-expanded', 'false')); };
    const head = (t, sub) => `<p class="lv-ft">${t}</p>${sub ? `<p class="lv-sub">${sub}</p>` : ''}`;
    const delForm = (id) => {
      const m = lvMine(id), k = 'lv-' + id;
      return `<form class="lv-f" data-lv-f="del" novalidate>
        ${head(opt.what + ' löschen', m ? `<span class="lv-yours">${LVI.ok}${opt.mine}</span> Der Code ist schon eingetragen.` : 'Gib den Löschcode ein, den du beim Veröffentlichen bekommen hast.')}
        <label class="lv-l" for="${k}-pw">Löschcode</label>
        <div class="lv-row"><input class="lv-in lv-code-in" id="${k}-pw" name="pw" required maxlength="64" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${m ? lvEsc(m.pw) : ''}" aria-describedby="${k}-msg"><button class="lv-go lv-danger" type="submit">${LVI.del}<span>Löschen</span></button></div>
        <p class="lv-msg" id="${k}-msg" role="alert"></p>
        <div class="lv-links"><button type="button" data-lv-forgot>Code vergessen?</button><button type="button" data-lv-x>Abbrechen</button></div>
      </form>`;
    };
    const forgotForm = (id) => {
      const k = 'lv-' + id;
      return `<form class="lv-f" data-lv-f="forgot" novalidate>
        ${head('Code vergessen?', `Schreib dem Vorstand kurz, dann löscht er ${opt.acc} für dich.`)}
        <div class="lv-g"><label class="lv-l" for="${k}-fn">Dein Name</label><input class="lv-in" id="${k}-fn" name="name" required maxlength="40" autocomplete="nickname" value="${lvEsc(lvName())}"></div>
        <div class="lv-g"><label class="lv-l" for="${k}-fk">Wie erreichen wir dich? <span class="lv-opt">freiwillig</span></label><input class="lv-in" id="${k}-fk" name="kontakt" maxlength="80" autocomplete="email" placeholder="E-Mail oder Handynummer"></div>
        <div class="lv-g"><label class="lv-l" for="${k}-ft">Nachricht <span class="lv-opt">freiwillig</span></label><textarea class="lv-in" id="${k}-ft" name="txt" rows="2" maxlength="500" placeholder="z. B. Das ist von mir, bitte löschen."></textarea></div>
        <p class="lv-msg" role="alert"></p>
        <div class="lv-row lv-row-b"><button class="lv-go" type="submit">An den Vorstand senden</button><button class="lv-back" type="button" data-lv-x>Abbrechen</button></div>
      </form>`;
    };
    const repForm = (id) => {
      const k = 'lv-' + id, why = ['Beleidigend', 'Spam oder Werbung', 'Falsche Angaben', 'Persönliche Daten', 'Etwas anderes'];
      return `<form class="lv-f" data-lv-f="rep" novalidate>
        ${head(opt.what + ' melden', `Der Vorstand schaut ${opt.it} sich an und nimmt ${opt.it} bei Bedarf runter.`)}
        <fieldset class="lv-why"><legend class="lv-l">Was stimmt nicht?</legend><div class="lv-chips">${why.map((w, i) => `<label class="lv-chip"><input type="radio" name="grund" value="${w}"${i === 0 ? ' required' : ''}><span>${w}</span></label>`).join('')}</div></fieldset>
        <div class="lv-g"><label class="lv-l" for="${k}-rt">Kurz erklären <span class="lv-opt">freiwillig</span></label><textarea class="lv-in" id="${k}-rt" name="txt" rows="2" maxlength="500"></textarea></div>
        <p class="lv-msg" role="alert"></p>
        <div class="lv-row lv-row-b"><button class="lv-go" type="submit">${LVI.flag}<span>Melden</span></button><button class="lv-back" type="button" data-lv-x>Abbrechen</button></div>
      </form>`;
    };
    const done = (t) => `<div class="lv-ok" tabindex="-1">${LVI.ok}<p>${t}</p><button class="lv-back" type="button" data-lv-x>Schließen</button></div>`;
    const open = (p, kind, btn) => {
      $$('[data-lv-id]', root).forEach(o => { if (o !== p) close(o); });
      const pan = $('.lv-pan', p), id = p.dataset.lvId;
      if (!pan.hidden && pan.dataset.kind === kind) { close(p); if (btn) btn.focus(); return; }
      pan.dataset.kind = kind; pan.hidden = false;
      pan.innerHTML = kind === 'del' ? delForm(id) : kind === 'forgot' ? forgotForm(id) : repForm(id);
      $$('[data-lv]', p).forEach(b => b.setAttribute('aria-expanded', String(b.dataset.lv === kind || (kind === 'forgot' && b.dataset.lv === 'del'))));
      const g = window.gsap && !RM ? window.gsap : null; if (g) g.from(pan.firstElementChild, { opacity: 0, y: -8, duration: .35, ease: 'expo.out' });
      const f = $('input:not([type=radio]),input[type=radio]', pan);
      setTimeout(() => { const first = kind === 'del' && lvMine(id) ? $('[type=submit]', pan) : f; if (first) first.focus({ preventScroll: true }); const r = pan.getBoundingClientRect(); if (r.bottom > innerHeight - 20) FCS.scrollTo(pan, -Math.max(120, innerHeight - r.height - 40)); }, 30);
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-lv],[data-lv-x],[data-lv-forgot]'); if (!b || !root.contains(b)) return;
      const p = post(b); if (!p) return;
      if (b.hasAttribute('data-lv-x')) { close(p); const t = $('[data-lv]', p); if (t) t.focus({ preventScroll: true }); return; }
      if (b.hasAttribute('data-lv-forgot')) { open(p, 'forgot'); return; }
      open(p, b.dataset.lv, b);
    });
    root.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const p = e.target.closest && e.target.closest('[data-lv-id]'); if (p && !$('.lv-pan', p).hidden) { close(p); const t = $('[data-lv]', p); if (t) t.focus(); } });
    root.addEventListener('submit', async e => {
      const f = e.target.closest('[data-lv-f]'); if (!f) return;
      e.preventDefault();
      const p = post(f), id = p.dataset.lvId, item = opt.get(id) || {}, kind = f.dataset.lvF;
      const msg = $('.lv-msg', f), btn = $('[type=submit]', f), say = (t, bad = true) => { msg.textContent = t; msg.classList.toggle('bad', bad); };
      say('');
      if (kind === 'del') {
        const inp = $('[name=pw]', f), pw = inp.value.trim();
        if (pw.length < 4) { inp.setAttribute('aria-invalid', 'true'); say('Bitte gib deinen Löschcode ein.'); inp.focus(); return; }
        lvBusy(btn, true, 'Löscht …');
        let r = { ok: false, err: 'netz' }; try { r = await FCS.board.del(id, pw); } catch (er) {}
        lvBusy(btn, false);
        if (r.ok) { lvRemove(p, () => opt.onDeleted && opt.onDeleted(id)); return; }
        inp.setAttribute('aria-invalid', String(r.err === 'code'));
        say(r.err === 'code' ? 'Code stimmt nicht. Prüf Groß- und Kleinschreibung oder tipp auf „Code vergessen?“.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.');
        if (r.err === 'code') { inp.select(); inp.focus(); }
        return;
      }
      const ex = (opt.excerpt(item) || '').slice(0, 160);
      let fields, subject;
      if (kind === 'forgot') {
        const nm = $('[name=name]', f);
        if (nm.value.trim().length < 2) { nm.setAttribute('aria-invalid', 'true'); say('Bitte gib deinen Namen ein.'); nm.focus(); return; }
        lvKeepName(nm.value.trim());
        subject = `Löschcode vergessen (${opt.area})`;
        fields = { 'Beitrag-ID': id, Bereich: item.b || '', Beitrag: ex, 'Name im Beitrag': item.n || '', 'Name': nm.value.trim(), 'Erreichbar unter': $('[name=kontakt]', f).value.trim(), Nachricht: $('[name=txt]', f).value.trim() };
      } else {
        const g = $('[name=grund]:checked', f);
        if (!g) { say('Bitte wähl einen Grund aus.'); $('[name=grund]', f).focus(); return; }
        subject = `Beitrag gemeldet (${opt.area})`;
        fields = { 'Beitrag-ID': id, Bereich: item.b || '', Beitrag: ex, 'Name im Beitrag': item.n || '', Grund: g.value, Nachricht: $('[name=txt]', f).value.trim() };
      }
      lvBusy(btn, true, 'Wird gesendet …');
      let r = { ok: false }; try { r = await FCS.notify(subject, fields); } catch (er) {}
      lvBusy(btn, false);
      if (!r.ok) { say('Gerade nicht erreichbar, versuch es gleich nochmal.'); return; }
      const pan = $('.lv-pan', p);
      pan.innerHTML = done(kind === 'forgot' ? `<b>Danke.</b> Der Vorstand löscht ${opt.acc} für dich.` : '<b>Danke fürs Melden.</b> Der Vorstand schaut es sich an.');
      const ok = $('.lv-ok', pan); if (ok) ok.focus({ preventScroll: true });
    });
  }

  /* =====================================================================
     Pinnwand live: D.pinnwand (vom Vorstand gepflegt) + FCS.board.list('pinnwand').
     Einmal laden, wenn die Pinnwand in Sicht kommt. Posten mit Foto und Löschcode, sofort sichtbar.
     Ohne Live-Anbindung (FCS.board.on() false) geht ein Beitrag wie bisher per Mail an den Vorstand.
     ===================================================================== */
  const PN = { st: 'idle', list: [], shown: 6, local: {}, fresh: '' };
  const PN_PAGE = 6;
  const PN_COL = ['#3fe0ff', '#ffb020', '#3ee08a', '#c78bff', '#ff7a59', '#5aa2ff'];
  const pnHash = v => { let h = 7; for (const ch of String(v)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const pnIni = v => { const w = String(v).trim().split(/\s+/).filter(Boolean).map(x => [...x]); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || ['?']).slice(0, 2).join('')).toUpperCase(); };
  const TH_OK = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  const pnLive = () => !!(window.FCS && FCS.board && FCS.board.on());
  const pnAll = () => [...PN.list, ...(D.pinnwand || []).map((x, i) => Object.assign({ _s: 1, id: 's' + i }, x))].sort((a, b) => String(b.d).localeCompare(String(a.d)));

  function pnCard(x) {
    const live = !x._s, h = pnHash(x.id + x.n), rot = ((h % 5) - 2) * .55, c = PN_COL[h % PN_COL.length], m = live && lvMine(x.id);
    const src = live ? (PN.local[x.id] || (x.nf > 0 ? FCS.board.foto(x.id, 0) : '')) : (x.img || '');
    const ph = src ? `<figure class="pn-ph"><img src="${esc(src)}" alt="Foto zum Beitrag von ${esc(x.n)}" loading="lazy" decoding="async" width="720" height="540"></figure>` : '';
    return `<article class="pn${m ? ' is-mine' : ''}${x.id === PN.fresh ? ' is-new' : ''}" data-lv-id="${esc(x.id)}"${live ? ` id="pn-${esc(x.id)}"` : ''} style="--r:${rot.toFixed(2)}deg;--c:${c}">
      <span class="pn-pin" aria-hidden="true"></span>
      ${ph}
      <p class="pn-t">${esc(x.t)}</p>
      <footer class="pn-f"><span class="pn-av" aria-hidden="true">${esc(pnIni(x.n))}</span><b class="pn-n">${esc(x.n)}</b>${m ? '<span class="lv-mine">Deiner</span>' : ''}${lvTime(x.d)}</footer>
      ${lvActs(!live)}
    </article>`;
  }
  // Fotos: Vorschaubild sofort als Hintergrund, echtes Foto lädt lazy; geht es schief, bleibt ein Platzhalter
  function pnImgs(root) {
    $$('.pn-ph', root).forEach(fig => {
      const card = fig.closest('[data-lv-id]'), it = card && PN.list.find(x => x.id === card.dataset.lvId), img = $('img', fig);
      if (it && TH_OK.test(it.th || '')) fig.style.backgroundImage = `url("${it.th}")`;
      const ok = () => fig.classList.add('is-ok'), bad = () => { fig.classList.add('is-x'); img.alt = ''; };
      if (img.complete && img.naturalWidth) ok(); else if (img.complete && img.currentSrc) bad();
      img.addEventListener('load', ok, { once: true }); img.addEventListener('error', bad, { once: true });
    });
  }
  function pnClips() {
    const clips = [...(D.clips || [])].sort((a, b) => String(b.d).localeCompare(String(a.d)));
    if (!clips.length) return '';
    return `<div class="pn-clips"><p class="pin-sub">Clips aus der Crew</p><div class="clipgrid">${clips.map(c => `<figure class="clipc" style="margin:0"><video src="${esc(c.src)}"${c.poster ? ` poster="${esc(c.poster)}"` : ''} controls playsinline preload="none"></video><figcaption><b>${esc(c.n)}</b><br><span>${deDate(c.d)}</span>${c.ig ? ` · <a href="${SOC.ig[1](encodeURIComponent(handle(c.ig)))}" target="_blank" rel="noopener">@${esc(handle(c.ig))}</a>` : ''}</figcaption></figure>`).join('')}</div></div>`;
  }
  function pnMeta() {
    const all = pnAll(), more = $('#pin-more'), cnt = $('#pin-count'), ns = $('#nosig'), feed = $('#pin-feed');
    const rest = all.length - PN.shown;
    if (more) { more.hidden = rest <= 0; more.textContent = `Ältere Beiträge zeigen (${Math.max(0, rest)})`; }
    if (cnt) cnt.textContent = PN.st === 'load' ? 'Lädt …' : all.length ? `${all.length} ${all.length === 1 ? 'Beitrag' : 'Beiträge'}` : '';
    const empty = PN.st !== 'load' && PN.st !== 'err' && !all.length && !(D.clips || []).length;
    if (ns) ns.hidden = !empty;
    if (feed) feed.hidden = empty;
  }
  function pnRender() {
    const feed = $('#pin-feed'); if (!feed) return;
    feed.setAttribute('aria-busy', String(PN.st === 'load'));
    if (PN.st === 'load') { feed.innerHTML = '<div class="pn-sk" aria-hidden="true"><i></i><b></b><b></b></div><div class="pn-sk" aria-hidden="true"><i></i><b></b><b></b></div>'; pnMeta(); return; }
    const all = pnAll();
    feed.innerHTML = (PN.st === 'err' ? '<div class="lv-err pn-err"><p>Gerade nicht erreichbar, versuch es gleich nochmal.</p><button class="lv-retry" type="button" data-pn-retry>Nochmal</button></div>' : '') + pnClips() + all.slice(0, PN.shown).map(pnCard).join('');
    pnImgs(feed); pnMeta();
  }
  async function pnLoad() {
    if (!pnLive()) { PN.st = 'off'; pnRender(); return; }
    PN.st = 'load'; pnRender();
    try { const srv = (await FCS.board.list('pinnwand')).filter(x => x.b === 'pinnwand'); PN.list = [...PN.list.filter(x => x._new && !srv.some(y => y.id === x.id)), ...srv]; PN.st = 'ok'; } catch (e) { PN.st = 'err'; }
    pnRender();
    const cards = $$('#pin-feed .pn');
    if (gs() && !RM && cards.length) gs().from(cards, { y: 36, opacity: 0, rotation: (i) => (i % 2 ? 7 : -7), duration: .8, stagger: .08, ease: 'expo.out', clearProps: 'transform,opacity' });
  }

  function pinboard() {
    const sec = $('#pinnwand'), feed = $('#pin-feed'), f = $('#pin-form'); if (!sec || !feed || !f) return;
    const live = pnLive();
    // Ohne Live-Anbindung: alter Weg per Mail, Texte passend
    if (!live) {
      $('#pin-lede').textContent = 'Neuer Kopter, gelungener Flug, Frage an alle: Schreib einen Beitrag. Der Vorstand gibt ihn frei, dann steht er hier.';
      $('#nosig-t').textContent = 'Die ersten Beiträge erscheinen nach Freigabe.';
      const cf = $('#pw-code-f'); cf.hidden = true; $('#pw-code').required = false;
      $('#pw-go').innerHTML = 'Beitrag senden <span class="arr">→</span>'; $('#pw-draft').hidden = false;
      $('#pw-dsgvo').innerHTML = 'Mein Beitrag darf mit meinem Namen auf der Seite erscheinen (<a href="datenschutz.html">Datenschutz</a>).';
    }
    noSignal();
    // Einmal laden, sobald die Pinnwand in Sicht kommt
    let asked = false;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting && !asked) { asked = true; o.disconnect(); pnLoad(); } }, { rootMargin: '300px 0px' }).observe(sec);
    feed.addEventListener('click', e => { if (e.target.closest('[data-pn-retry]')) pnLoad(); });
    $('#pin-more').addEventListener('click', () => {
      // Nur die nächsten Zettel anhängen, damit schon geladene Fotos nicht neu geholt werden
      const all = pnAll(), from = $$('.pn', feed).length, add = all.slice(from, from + PN_PAGE);
      PN.shown = from + add.length;
      const tmp = document.createElement('div'); tmp.innerHTML = add.map(pnCard).join('');
      const fresh = [...tmp.children]; fresh.forEach(c => feed.appendChild(c)); pnImgs(feed); pnMeta();
      if (gs() && !RM && fresh.length) gs().from(fresh, { y: 24, opacity: 0, duration: .6, stagger: .06, ease: 'expo.out', clearProps: 'transform,opacity' });
      const a = fresh[0] && $('[data-lv]', fresh[0]); if (a) a.focus({ preventScroll: true });
    });
    lvWire(feed, {
      what: 'Beitrag', acc: 'den Beitrag', it: 'ihn', mine: 'Das ist deiner.', area: 'Pinnwand',
      get: id => pnAll().find(x => x.id === id),
      excerpt: x => x.t || '',
      onDeleted: id => { PN.list = PN.list.filter(x => x.id !== id); if (PN.local[id]) { try { URL.revokeObjectURL(PN.local[id]); } catch (e) {} delete PN.local[id]; } pnMeta(); }
    });

    // Formular
    const name = $('#pw-name'), txt = $('#pw-txt'), code = $('#pw-code'), btn = $('#pw-go'), bad = $('#pw-bad'), done = $('#pin-done');
    const nm = lvName(); if (nm) name.value = nm;
    const newCode = () => { code.value = FCS.board && FCS.board.code ? FCS.board.code() : ''; };
    newCode();
    const cnt = () => { $('#pw-cnt').textContent = txt.value.length; };
    txt.addEventListener('input', cnt); cnt();
    // Foto: Vorschau, entfernen, Ziehen und Ablegen
    let pic = null, picUrl = '';
    const drop = $('#pw-drop'), inp = $('#pw-pic'), prev = $('#pw-prev'), rmv = $('#pw-x'), fmsg = $('#pw-fmsg');
    const clearPic = () => { if (picUrl) URL.revokeObjectURL(picUrl); pic = null; picUrl = ''; inp.value = ''; prev.hidden = true; prev.removeAttribute('src'); $('.drop-in', drop).style.opacity = ''; rmv.hidden = true; };
    const take = file => {
      fmsg.textContent = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) { clearPic(); fmsg.textContent = 'Das ist kein Bild. Bitte ein Foto wählen (JPG, PNG, WebP oder HEIC).'; return; }
      if (file.size > 25 * 1024 * 1024) { clearPic(); fmsg.textContent = 'Das Foto ist größer als 25 MB. Bitte ein kleineres wählen.'; return; }
      if (picUrl) URL.revokeObjectURL(picUrl);
      pic = file; picUrl = URL.createObjectURL(file); prev.src = picUrl; prev.hidden = false; $('.drop-in', drop).style.opacity = 0; rmv.hidden = false;
    };
    dropZone(drop, inp, take);
    rmv.addEventListener('click', () => { clearPic(); inp.focus(); });
    const fail = t => { $('#pw-bad-t').textContent = t; bad.hidden = false; };
    f.addEventListener('submit', async e => {
      e.preventDefault(); bad.hidden = true;
      if (!FCS.validate(f)) return;
      const hp = $('[name=_honey]', f); if (hp && hp.value) return;
      const n = name.value.trim().replace(/\s+/g, ' ').slice(0, 40), t = txt.value.trim().slice(0, 800), pw = code.value.trim();
      lvKeepName(n);
      lvBusy(btn, true, live ? 'Wird veröffentlicht …' : 'Wird gesendet …');
      if (!live) {
        let r = { ok: false }; try { r = await FCS.send(f, pic ? { Foto: pic } : {}); } catch (er) {}
        lvBusy(btn, false);
        if (!r.ok) { fail('Bitte versuch es noch einmal.'); return; }
        f.classList.add('sent'); done.innerHTML = `<div class="pd-top">${LVI.ok}<p><b>Danke!</b> Dein Beitrag erscheint nach der Freigabe durch den Vorstand.</p></div>`; done.hidden = false; done.focus({ preventScroll: true });
        return;
      }
      let r = { ok: false, err: 'netz' };
      try { r = await FCS.board.add({ b: 'pinnwand', n, t, pw }, pic ? [pic] : []); } catch (er) {}
      lvBusy(btn, false);
      if (!r.ok) { fail(r.err === 'abgelehnt' ? 'Prüf Name, Text und Löschcode und versuch es nochmal.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'); return; }
      // Neuer Beitrag sofort oben auf der Pinnwand (Foto aus dem Gerät, spart eine Anfrage)
      if (pic) { PN.local[r.id] = picUrl; picUrl = ''; }
      PN.list.unshift({ id: r.id, b: 'pinnwand', n, t, nf: pic ? 1 : 0, th: null, d: lvNow(), _new: 1 });
      PN.fresh = r.id; if (PN.st !== 'ok' && PN.st !== 'err') PN.st = 'ok';
      // Neuen Zettel oben anheften, ohne die anderen neu zu zeichnen (spart Foto-Anfragen)
      const tmp = document.createElement('div'); tmp.innerHTML = pnCard(PN.list[0]);
      const card = tmp.firstElementChild, anchor = $('.pn', feed);
      if (anchor) feed.insertBefore(card, anchor); else feed.appendChild(card);
      PN.shown++; pnImgs(card); pnMeta();
      setTimeout(() => { card.classList.remove('is-new'); if (PN.fresh === r.id) PN.fresh = ''; }, 3200);
      if (card && gs() && !RM) gs().from(card, { scale: .8, rotation: -8, opacity: 0, duration: .8, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
      // Info an den Vorstand (der Beitrag ist ohne Prüfung online)
      FCS.notify('Neuer Pinnwand-Beitrag (live)', { 'Beitrag-ID': r.id, Name: n, Beitrag: t, Foto: pic ? 'ja' : 'nein' }).catch(() => {});
      const wa = `Mein Löschcode für die Pinnwand vom Flight Club Saar: ${r.pw}\nBeitrag: „${t.slice(0, 80)}${t.length > 80 ? ' …' : ''}“\n${location.href.split('#')[0]}#pinnwand`;
      f.classList.add('sent');
      done.innerHTML = `<div class="pd-top">${LVI.ok}<p><b>Dein Beitrag ist online.</b> Er steht ab sofort auf der Pinnwand.</p></div>
        <div class="lv-code pd-code"><span class="lv-code-l">Dein Löschcode</span><code>${esc(r.pw)}</code></div>
        <div class="pd-btns"><button class="btn solid pd-copy" type="button" data-copy="${esc(r.pw)}">${LVI.copy}<span>Code kopieren</span></button><a class="btn ghost pd-wa" href="https://wa.me/?text=${encodeURIComponent(wa)}" target="_blank" rel="noopener">${LVI.wa}<span>Per WhatsApp an mich senden</span></a></div>
        <p class="lv-note">Auf diesem Gerät merken wir ihn uns. Auf einem anderen Gerät brauchst du den Code zum Löschen.</p>
        <div class="pd-more"><a href="#pn-${esc(r.id)}" data-pd-see>Zu deinem Beitrag</a><button type="button" data-pd-again>Noch einen Beitrag schreiben</button></div>`;
      done.hidden = false; done.focus({ preventScroll: true });
      if (gs() && !RM) gs().from(done.children, { y: 14, opacity: 0, duration: .55, stagger: .07, ease: 'expo.out' });
      const r2 = done.getBoundingClientRect(); if (r2.top < 80 || r2.top > innerHeight * .7) go(done, -120);
    });
    done.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]'); if (c) { lvCopy(c.dataset.copy, c); return; }
      if (e.target.closest('[data-pd-again]')) {
        f.classList.remove('sent'); done.hidden = true; done.innerHTML = ''; txt.value = ''; cnt(); clearPic(); newCode();
        $$('.field.bad,.check.bad', f).forEach(x => x.classList.remove('bad'));
        const ck = $('[name=Datenschutz]', f); if (ck) ck.checked = false;
        (name.value ? txt : name).focus({ preventScroll: true }); go(f, -100);
      }
    });
    const ns = $('#ns-go'); if (ns) ns.addEventListener('click', e => { e.preventDefault(); go(f, -100); setTimeout(() => (name.value ? txt : name).focus({ preventScroll: true }), RM ? 0 : 700); });
    const pw = $('#pin-write'); if (pw) pw.addEventListener('click', e => { e.preventDefault(); go(f, -100); setTimeout(() => (name.value ? txt : name).focus({ preventScroll: true }), RM ? 0 : 700); });
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
