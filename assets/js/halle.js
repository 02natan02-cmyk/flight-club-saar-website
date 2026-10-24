/* Hallenfliegen: nächster Abend mit Countdown, alle Termine, Fotostreifen, Hallen, Mitbringliste, Akku-Rechner */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const anim = () => !!window.gsap && !RM;
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const zeit = () => { const z = D.zeit || {}; return `${(z.von || '18:00').replace(':00', '')} bis ${(z.bis || '21:00').replace(':00', '')} Uhr`; };
  const ICS = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4"/></svg>';
  const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  const onScreen = (el, cb, margin = '100px 0px') => { if (!el || !('IntersectionObserver' in window)) return cb(true); new IntersectionObserver(es => cb(es[0].isIntersecting), { rootMargin: margin }).observe(el); };

  function next() {
    const n = FCS.next(); if (!n) { $('#n-datum').textContent = 'Neue Termine folgen'; $('#n-ort').textContent = 'Sobald der Vorstand die nächsten Hallenzeiten hat, stehen sie hier.'; $('#n-ring').hidden = true; $('#next .btns').hidden = true; return; }
    $('#n-datum').textContent = FCS.fmtDate(n.d, 1);
    $('#n-ort').textContent = `${n.halle.name} · ${n.halle.adresse} · ${zeit()}`;
    $('#n-route').href = FCS.route(n.halle.lat, n.halle.lng, n.halle.adresse);
    $('#n-ics').onclick = () => FCS.ics(n);
    FCS.countdown($('#n-ring'), n.start.getTime());
    // Ring zeigt, wie viel von den letzten 30 Tagen bis zum Termin schon vorbei ist
    const fg = $('#n-ring .r-fg'); const total = 30 * 864e5, left = Math.max(0, n.start - Date.now());
    const frac = Math.min(1, 1 - left / total);
    if (anim() && window.ScrollTrigger) gsap.fromTo(fg, { strokeDashoffset: 1 }, { strokeDashoffset: 1 - frac, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: fg, start: 'top 90%', once: true } });
    else fg.style.strokeDashoffset = 1 - frac;
  }

  function tickets() {
    const box = $('#tickets'), n = FCS.next(); if (!box) return;
    const all = FCS.termine();
    if (!all.length) { box.innerHTML = '<p class="mute">Neue Termine folgen.</p>'; return; }
    box.innerHTML = all.map((t, i) => {
      const d = new Date(t.d + 'T12:00:00'), isN = n && n.d === t.d;
      return `<article class="ticket${t.vorbei ? ' done' : ''}${isN ? ' next' : ''}">
        <div class="t-date"><b>${String(d.getDate()).padStart(2, '0')}</b><span>${MON[d.getMonth()]} · Sa</span></div>
        <div class="t-info"><h3>${t.halle.name}${isN ? ' <em class="t-next">Nächster Abend</em>' : ''}</h3><p>${zeit()} · ${(t.halle.adresse.split(', ')[1] || t.halle.adresse).replace(/^\d{5}\s*/, '')}</p></div>
        <div class="t-act">${t.vorbei ? '<span class="stamp">Geflogen</span>' : `<button class="t-btn" type="button" data-ics="${i}">${ICS}<span>Kalender</span></button><a class="t-btn" href="${FCS.route(t.halle.lat, t.halle.lng, t.halle.adresse)}" target="_blank" rel="noopener">${PIN}<span>Route</span></a>`}</div>
      </article>`;
    }).join('');
    $$('[data-ics]', box).forEach(b => b.addEventListener('click', () => FCS.ics(all[+b.dataset.ics])));
    if (anim() && window.ScrollTrigger) {
      gsap.from($$('.ticket', box), { x: 40, opacity: 0, stagger: .08, duration: .9, ease: 'expo.out', scrollTrigger: { trigger: box, start: 'top 85%', once: true } });
      gsap.from($$('.stamp', box), { scale: 2.4, rotation: -30, opacity: 0, duration: .5, ease: 'back.out(3)', delay: .6, scrollTrigger: { trigger: box, start: 'top 85%', once: true } });
    }
  }

  function hallen() {
    const box = $('#hallen-cards'); if (!box) return;
    const by = {}; FCS.termine().forEach(t => (by[t.h] = by[t.h] || []).push(t));
    box.innerHTML = Object.entries(D.hallen).map(([k, h]) => {
      const ts = by[k] || [], open = ts.filter(t => !t.vorbei);
      const dates = ts.map(t => { const d = new Date(t.d + 'T12:00:00'); return `<li${t.vorbei ? ' class="past"' : ''}>${d.getDate()}. ${MON[d.getMonth()]}</li>`; }).join('');
      return `<article class="halle panel" data-reveal>
        <div class="halle-map" aria-hidden="true"><span class="ring"></span><span class="ring"></span><span class="pin"></span></div>
        <div class="halle-txt">
          <h3 class="h3">${h.name}</h3>
          <p class="mute">${h.adresse}</p>
          ${dates ? `<ul class="halle-dates" aria-label="Termine in dieser Halle">${dates}</ul>` : ''}
          <p class="halle-n hud">${open.length} ${open.length === 1 ? 'Abend' : 'Abende'} noch offen</p>
          <a class="btn solid" href="${FCS.route(h.lat, h.lng, h.adresse)}" target="_blank" rel="noopener">Route mit Google Maps ↗</a>
        </div>
      </article>`;
    }).join('');
    const cards = $$('[data-reveal]', box);
    if (anim() && window.ScrollTrigger) cards.forEach((e, i) => gsap.to(e, { opacity: 1, y: 0, duration: 1, delay: i * .1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 90%', once: true } }));
    else cards.forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; });
    // Pulsierender Ort nur, solange er zu sehen ist
    $$('.halle-map', box).forEach(m => onScreen(m, v => m.classList.toggle('run', v && !RM)));
  }

  function bag() {
    const list = $('#bag-list'); if (!list) return;
    const boxes = $$('input', list), fg = $('.bag-ring .r-fg'), reset = $('#bag-reset');
    let saved = []; try { saved = JSON.parse(localStorage.getItem('fcs-bag') || '[]'); } catch (e) {}
    boxes.forEach((b, i) => { b.checked = !!saved[i]; });
    const upd = () => {
      const on = boxes.filter(b => b.checked).length;
      $('#bag-n').textContent = `${on}/${boxes.length}`; fg.style.strokeDashoffset = 1 - on / boxes.length;
      boxes.forEach(b => b.closest('.check').classList.toggle('on', b.checked));
      $('#bag-done').hidden = on !== boxes.length; reset.hidden = !on;
      try { localStorage.setItem('fcs-bag', JSON.stringify(boxes.map(b => b.checked))); } catch (e) {}
    };
    boxes.forEach(b => b.addEventListener('change', () => { upd(); if (b.checked && anim()) gsap.fromTo(b, { scale: 1.6 }, { scale: 1, duration: .5, ease: 'back.out(3)' }); }));
    reset.addEventListener('click', () => { boxes.forEach(b => b.checked = false); upd(); boxes[0].focus(); });
    fg.style.strokeDasharray = '1 1'; upd();
    // Selbst-Impuls: der erste Punkt zeigt einmal, dass man ihn abhaken kann (ohne etwas zu speichern)
    if (anim() && window.ScrollTrigger && !boxes.some(b => b.checked)) ScrollTrigger.create({ trigger: list, start: 'top 75%', once: true, onEnter: () => {
      const c = boxes[0].closest('.check'); c.classList.add('demo');
      gsap.timeline({ onComplete: () => c.classList.remove('demo') }).fromTo(c, { x: 0 }, { x: 10, duration: .25, ease: 'power2.out', yoyo: true, repeat: 3 }).to(fg, { strokeDashoffset: 1 - 1 / boxes.length, duration: .5 }, 0).to(fg, { strokeDashoffset: 1, duration: .6 }, 1.4);
    } });
  }

  function akku() {
    const a = $('#a-min'), g = $('#a-ges'); if (!a) return;
    let shown = -1;
    const calc = (manual) => {
      const min = +a.value, ges = +g.value, lade = $('input[name=lade]:checked').value === '1';
      $('#a-min-v').textContent = String(min).replace('.', ','); $('#a-ges-v').textContent = ges;
      const fluege = Math.ceil(ges / min);
      // Mit Nachladen: grob ein Drittel der Flüge aus nachgeladenen Akkus (1S lädt in ca. 20 bis 30 Minuten)
      const n = lade ? Math.max(4, Math.ceil(fluege * 0.65)) : fluege;
      $('#a-n').textContent = n;
      $('#a-txt').textContent = lade ? `Für ${fluege} Flüge reichen dir mit Nachladen vor Ort etwa ${n} Akkus.` : `Für ${fluege} Flüge ohne Nachladen brauchst du ${n} Akkus.`;
      if (n !== shown) {
        const c = $('#cells'), before = shown < 0 ? 0 : Math.min(shown, 40); shown = n;
        c.innerHTML = Array.from({ length: Math.min(n, 40) }, () => '<i class="cell"></i>').join('') + (n > 40 ? `<span class="cells-more">+${n - 40}</span>` : '');
        if (anim()) { const fresh = $$('.cell', c).slice(before); if (fresh.length) gsap.from(fresh, { y: -24, opacity: 0, stagger: .015, duration: .35, ease: 'back.out(2)' }); }
      }
      if (manual) $('#akku-hint').classList.add('off');
    };
    [a, g].forEach(i => i.addEventListener('input', () => calc(true)));
    $$('input[name=lade]').forEach(i => i.addEventListener('change', () => calc(true)));
    calc(false);
    // Selbst-Impuls: der Regler bewegt sich einmal selbst
    if (anim() && window.ScrollTrigger) ScrollTrigger.create({ trigger: '.akku', start: 'top 70%', once: true, onEnter: () => {
      const o = { v: 60 }, set = () => { g.value = Math.round(o.v / 5) * 5; calc(false); };
      gsap.timeline({ delay: .3 }).to(o, { v: 120, duration: 1, ease: 'power2.inOut', onUpdate: set }).to(o, { v: 60, duration: 1, ease: 'power2.inOut', onUpdate: set });
    } });
  }

  function fotos() {
    const tr = $('#hf-track'), rail = $('#hf-rail'); if (!tr) return;
    const L = [['h1', 'Parcours aus Gates und Absperrband'], ['h6', 'Tiny Whoop mit LED'], ['h4', 'Gates in der Halle'], ['h8', 'Tiny Whoop'], ['h2', 'Licht aus'], ['h3', 'Funke'], ['h5', 'LED-Whoop im Dunkeln'], ['h9', 'Beleuchteter Kopter']];
    const OSD = ['Parcours', 'LED-Whoop', 'Gates', 'Tiny Whoop', 'Licht aus', 'Funke', 'LED-Whoop', 'LED-Kopter'];
    tr.innerHTML = L.map(([k, n], i) => `<figure class="hf" style="--r:${(i % 2 ? 1 : -1) * (1 + (i % 3)) * .6}deg"><img src="media/halle/${k}.webp" alt="${n}" loading="lazy" decoding="async" draggable="false"><span class="osd">${String(i + 1).padStart(2, '0')} · ${OSD[i].toUpperCase()}</span></figure>`).join('');
    const hint = $('#hf-hint'), hide = () => hint && hint.classList.add('off');
    const bounds = () => ({ minX: Math.min(0, rail.clientWidth - tr.scrollWidth), maxX: 0 });
    let d = null;
    const getX = () => window.gsap ? +gsap.getProperty(tr, 'x') || 0 : 0;
    const moveTo = (x) => {
      const b = bounds(); x = Math.max(b.minX, Math.min(b.maxX, x));
      if (window.gsap) gsap.to(tr, { x, duration: RM ? 0 : .8, ease: 'power3.out', onUpdate: () => d && d.update() });
      upd(x);
    };
    const step = () => { const f = $('.hf', tr); return f ? f.offsetWidth + 18 : 300; };
    const upd = (x = getX()) => { const b = bounds(); $('#hf-prev').disabled = x >= b.maxX - 2; $('#hf-next').disabled = x <= b.minX + 2; };
    $('#hf-prev').addEventListener('click', () => { hide(); moveTo(getX() + step()); });
    $('#hf-next').addEventListener('click', () => { hide(); moveTo(getX() - step()); });
    if (window.gsap && window.Draggable) {
      d = Draggable.create(tr, { type: 'x', bounds: bounds(), inertia: !!window.InertiaPlugin, edgeResistance: .85, allowNativeTouchScrolling: true, onPress() { this.applyBounds(bounds()); }, onDragStart: hide, onDragEnd() { upd(this.x); }, onThrowComplete() { upd(this.x); } })[0];
      addEventListener('resize', () => { d.applyBounds(bounds()); upd(); });
    }
    upd(0);
    if (anim() && window.ScrollTrigger) {
      gsap.from($$('.hf', tr), { y: 60, opacity: 0, stagger: .06, duration: .9, ease: 'expo.out', scrollTrigger: { trigger: rail, start: 'top 85%', once: true } });
      // Selbst-Impuls: der Streifen rollt einmal an und wieder zurück
      ScrollTrigger.create({ trigger: rail, start: 'top 65%', once: true, onEnter: () => gsap.timeline({ delay: .7 }).to(tr, { x: () => Math.max(bounds().minX, -260), duration: 1.3, ease: 'power2.inOut' }).to(tr, { x: 0, duration: 1.1, ease: 'power2.inOut', onComplete: () => { if (d) d.update(); upd(0); } }) });
    }
  }
  document.addEventListener('fcs:ready', () => { next(); tickets(); fotos(); hallen(); bag(); akku(); }, { once: true });
})();
