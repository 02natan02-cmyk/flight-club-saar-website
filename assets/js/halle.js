/* Hallenfliegen: nächster Termin, Tickets, Hallen, Checkliste, Akku-Rechner */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function next() {
    const n = FCS.next(); if (!n) { $('#n-datum').textContent = 'Neue Termine folgen'; $('#n-ring').hidden = true; return; }
    $('#n-datum').textContent = FCS.fmtDate(n.d, 1);
    $('#n-ort').textContent = `${n.halle.name} · ${n.halle.adresse} · 18 bis 21 Uhr`;
    $('#n-route').href = FCS.route(n.halle.lat, n.halle.lng, n.halle.adresse);
    $('#n-ics').onclick = () => FCS.ics(n);
    FCS.countdown($('#n-ring'), n.start.getTime());
    // Ring zeigt, wie viel von den letzten 30 Tagen bis zum Termin schon vorbei ist
    const fg = $('#n-ring .r-fg'); const total = 30 * 864e5, left = Math.max(0, n.start - Date.now());
    const frac = Math.min(1, 1 - left / total);
    if (window.gsap && !RM) gsap.fromTo(fg, { strokeDashoffset: 1 }, { strokeDashoffset: 1 - frac, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: fg, start: 'top 85%', once: true } });
    else fg.style.strokeDashoffset = 1 - frac;
  }

  function tickets() {
    const box = $('#tickets'), n = FCS.next(); if (!box) return;
    box.innerHTML = FCS.termine().map((t, i) => {
      const d = new Date(t.d + 'T12:00:00');
      const isN = n && n.d === t.d;
      return `<article class="ticket${t.vorbei ? ' done' : ''}${isN ? ' next' : ''}" data-i="${i}">
        ${isN ? '<span class="t-next">Nächster Abend</span>' : ''}
        <div class="t-date"><b>${String(d.getDate()).padStart(2, '0')}</b><span>${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][d.getMonth()]} · Sa</span></div>
        <div class="t-info"><h3>${t.halle.name}</h3><p>${t.halle.adresse} · 18 bis 21 Uhr</p></div>
        <div class="t-act">${t.vorbei ? '' : `<button class="btn ghost" type="button" data-ics="${i}">Kalender</button>`}<a class="btn ghost" href="${FCS.route(t.halle.lat, t.halle.lng, t.halle.adresse)}" target="_blank" rel="noopener">Route ↗</a></div>
        ${t.vorbei ? '<span class="stamp" aria-label="Termin vorbei">Geflogen</span>' : ''}
      </article>`;
    }).join('');
    const all = FCS.termine();
    $$('[data-ics]', box).forEach(b => b.addEventListener('click', () => FCS.ics(all[+b.dataset.ics])));
    if (window.gsap && window.ScrollTrigger && !RM) {
      gsap.from($$('.ticket', box), { x: (i) => i % 2 ? 140 : -140, rotateY: (i) => i % 2 ? -25 : 25, opacity: 0, stagger: .12, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
      gsap.from($$('.stamp', box), { scale: 3, opacity: 0, duration: .5, ease: 'back.out(3)', delay: .9, scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
    }
  }

  function hallen() {
    const box = $('#hallen-cards'); if (!box) return;
    const cnt = {}; FCS.termine().forEach(t => cnt[t.h] = (cnt[t.h] || 0) + 1);
    box.innerHTML = Object.entries(D.hallen).map(([k, h]) => `<article class="halle panel" data-reveal>
      <div class="halle-map" aria-hidden="true"><span class="ring"></span><span class="pin"></span><span class="ring"></span><span class="hn">${k === 'eiweiler' ? 'Heusweiler-Eiweiler' : 'Heusweiler-Holz'}</span><span class="coords">${h.lat.toFixed(4)}° N · ${h.lng.toFixed(4)}° O</span></div>
      <span class="tag sig"><span class="dot"></span>${cnt[k] || 0} Termine</span>
      <h3 class="h3">${h.name}</h3><p class="mute" style="margin:0">${h.adresse}</p>
      <div class="btns"><a class="btn solid" href="${FCS.route(h.lat, h.lng, h.adresse)}" target="_blank" rel="noopener">Route mit Google Maps ↗</a></div>
    </article>`).join('');
    if (window.gsap && window.ScrollTrigger && !RM) $$('[data-reveal]', box).forEach(e => gsap.to(e, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 88%', once: true } }));
    else $$('[data-reveal]', box).forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; });
  }

  function bag() {
    const list = $('#bag-list'); if (!list) return;
    const boxes = $$('input', list), fg = $('.bag-ring .r-fg');
    let saved = []; try { saved = JSON.parse(localStorage.getItem('fcs-bag') || '[]'); } catch (e) {}
    boxes.forEach((b, i) => { b.checked = !!saved[i]; });
    const upd = () => {
      const on = boxes.filter(b => b.checked).length;
      $('#bag-n').textContent = `${on}/${boxes.length}`; fg.style.strokeDashoffset = 1 - on / boxes.length;
      boxes.forEach(b => b.closest('.check').classList.toggle('on', b.checked));
      $('#bag-done').hidden = on !== boxes.length;
      try { localStorage.setItem('fcs-bag', JSON.stringify(boxes.map(b => b.checked))); } catch (e) {}
    };
    boxes.forEach(b => b.addEventListener('change', () => { upd(); if (b.checked && window.gsap && !RM) gsap.fromTo(b, { scale: 1.6 }, { scale: 1, duration: .5, ease: 'back.out(3)' }); }));
    fg.style.strokeDasharray = '1 1'; upd();
  }

  function akku() {
    const a = $('#a-min'), g = $('#a-ges'); if (!a) return;
    const calc = (manual) => {
      const min = +a.value, ges = +g.value, lade = $('input[name=lade]:checked').value === '1';
      $('#a-min-v').textContent = String(min).replace('.', ','); $('#a-ges-v').textContent = ges;
      const fluege = Math.ceil(ges / min);
      // Mit Nachladen: grob ein Drittel der Flüge aus nachgeladenen Akkus (1S lädt in ca. 20 bis 30 Minuten)
      const n = lade ? Math.max(4, Math.ceil(fluege * 0.65)) : fluege;
      $('#a-n').textContent = n;
      $('#a-txt').textContent = lade ? `Für ${fluege} Flüge reichen dir mit Nachladen vor Ort etwa ${n} Akkus.` : `Für ${fluege} Flüge ohne Nachladen brauchst du ${n} Akkus.`;
      const c = $('#cells'); c.innerHTML = Array.from({ length: Math.min(n, 40) }, () => '<i class="cell"></i>').join('');
      if (window.gsap && !RM) gsap.from($$('.cell', c), { y: -30, opacity: 0, stagger: .02, duration: .4, ease: 'back.out(2)' });
      if (manual) $('#akku-hint').style.opacity = 0;
    };
    [a, g].forEach(i => i.addEventListener('input', () => calc(true)));
    $$('input[name=lade]').forEach(i => i.addEventListener('change', () => calc(true)));
    calc(false);
    // Selbst-Impuls: Regler bewegt sich einmal selbst
    if (window.gsap && window.ScrollTrigger && !RM) ScrollTrigger.create({ trigger: '.akku', start: 'top 70%', once: true, onEnter: () => {
      const o = { v: 60 }; gsap.timeline().to(o, { v: 120, duration: 1, ease: 'power2.inOut', onUpdate: () => { g.value = Math.round(o.v / 5) * 5; calc(false); } }).to(o, { v: 60, duration: 1, ease: 'power2.inOut', onUpdate: () => { g.value = Math.round(o.v / 5) * 5; calc(false); } });
    } });
  }

  function fotos() {
    const tr = $('#hf-track'); if (!tr) return;
    const L = [['h1', 'Parcours'], ['h6', 'LED-Whoop'], ['h4', 'Gates'], ['h8', 'Tiny Whoop'], ['h2', 'Licht aus'], ['h3', 'Funke'], ['h5', 'LED-Whoop'], ['h9', 'LED-Kopter']];
    tr.innerHTML = L.map(([k, n], i) => `<figure class="hf" style="--r:${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg"><img src="media/halle/${k}.webp" alt="${n}" loading="lazy"><span class="osd">${String(i + 1).padStart(2, '0')} · ${n.toUpperCase()}</span></figure>`).join('');
    if (!window.gsap || !window.Draggable) return;
    const rail = $('#hf-rail'), b = () => ({ minX: Math.min(0, rail.clientWidth - tr.scrollWidth), maxX: 0 });
    const d = Draggable.create(tr, { type: 'x', bounds: b(), inertia: !!window.InertiaPlugin, edgeResistance: .85, onPress() { this.applyBounds(b()); }, onDragStart: () => { const h = $('#hf-hint'); if (h) h.style.opacity = 0; } })[0];
    addEventListener('resize', () => d.applyBounds(b()));
    const RMx = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!RMx && window.ScrollTrigger) {
      gsap.from('.hf', { y: 80, opacity: 0, rotate: (i) => (i % 2 ? 8 : -8), stagger: .08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: rail, start: 'top 80%', once: true } });
      // Selbst-Impuls: die Leiste rollt einmal an
      ScrollTrigger.create({ trigger: rail, start: 'top 60%', once: true, onEnter: () => gsap.timeline({ delay: .8 }).to(tr, { x: () => Math.max(b().minX, -260), duration: 1.4, ease: 'power2.inOut' }).to(tr, { x: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => d.update() }) });
    }
  }
  document.addEventListener('fcs:ready', () => { next(); tickets(); fotos(); hallen(); bag(); akku(); }, { once: true });
})();
