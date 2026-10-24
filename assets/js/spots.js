/* Spot-Karte: Radar, Straßenkarte nach Klick, Spot-Infos, Route (erst nach Regeln), Einsenden, Bewerten */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = D.spots, T = D.spotTypen;
  let filter = 'alle', current = S[0] && S[0].id, map = null, layer = null;
  const accepted = () => { try { return sessionStorage.getItem('fcs-spot-ok') === '1'; } catch (e) { return $('#accept') && $('#accept').checked; } };

  // Saarland grob: 49.10–49.65 N, 6.35–7.40 O
  const BB = { n: 49.65, s: 49.10, w: 6.35, e: 7.40 };
  const proj = (lat, lng) => ({ x: (lng - BB.w) / (BB.e - BB.w), y: 1 - (lat - BB.s) / (BB.n - BB.s) });
  const vis = () => S.filter(s => filter === 'alle' || s.typ === filter);
  const stars = s => s.stern ? `<i>${'★'.repeat(Math.round(s.stern))}${'☆'.repeat(5 - Math.round(s.stern))}</i>${s.stern.toFixed(1)}` : '<i>☆☆☆☆☆</i>Noch keine Bewertung';
  const routeBtn = (s) => `<a class="btn solid" data-route href="${FCS.route(s.lat, s.lng, s.adr)}" target="_blank" rel="noopener" ${accepted() ? '' : 'aria-disabled="true"'}>Route mit Google Maps ↗</a>`;

  function filters() {
    const used = [...new Set(S.map(s => s.typ))];
    $('#filters').innerHTML = `<label class="chip"><input type="radio" name="f" value="alle" checked><span>Alle (${S.length})</span></label>` + Object.entries(T).map(([k, t]) => `<label class="chip"><input type="radio" name="f" value="${k}"${used.includes(k) ? '' : ' disabled'}><span style="${used.includes(k) ? '' : 'opacity:.4'}">${t.n} (${S.filter(s => s.typ === k).length})</span></label>`).join('');
    $$('#filters input').forEach(i => i.addEventListener('change', () => { filter = i.value; pins(); list(); if (map) leafPins(); }));
    $$('[data-spotcount]').forEach(e => e.textContent = S.length);
  }

  /* ---------- Radar ---------- */
  function radar() {
    const cv = $('#radar-cv'), box = $('#radar'); if (!cv) return;
    const cx = cv.getContext('2d'); let w, h, a = 0, on = false;
    const size = () => { const r = box.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height; cv.width = w * d; cv.height = h * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) draw(); }).observe(box);
    function draw() {
      if (!on || box.hidden) return;
      cx.clearRect(0, 0, w, h);
      const R = Math.hypot(w, h) / 2, mx = w / 2, my = h / 2;
      cx.strokeStyle = 'rgba(63,224,255,.12)'; cx.lineWidth = 1;
      for (let r = 60; r < R; r += 60) { cx.beginPath(); cx.arc(mx, my, r, 0, Math.PI * 2); cx.stroke(); }
      for (let x = 0; x < w; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, h); cx.strokeStyle = 'rgba(63,224,255,.05)'; cx.stroke(); }
      for (let y = 0; y < h; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke(); }
      if (!RM) a += 0.012;
      const g = cx.createConicGradient ? cx.createConicGradient(a, mx, my) : null;
      if (g) { g.addColorStop(0, 'rgba(63,224,255,.38)'); g.addColorStop(.12, 'rgba(63,224,255,0)'); g.addColorStop(1, 'rgba(63,224,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(mx, my, R, 0, Math.PI * 2); cx.fill(); }
      const read = $('#radar-read'); if (read) read.textContent = `${vis().length} SPOTS · ${((a * 57.3) % 360).toFixed(0).padStart(3, '0')}°`;
      requestAnimationFrame(draw);
    }
  }
  function pins() {
    const box = $('#radar-pins'); if (!box) return;
    // Spots dicht beieinander: Ansicht auf die Spots zoomen, damit sie nicht übereinander liegen
    const v = vis(); if (!v.length) { box.innerHTML = ''; return; }
    const lats = v.map(s => s.lat), lngs = v.map(s => s.lng);
    const pad = .35, la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lngs), lo1 = Math.max(...lngs);
    const dla = Math.max(.08, la1 - la0), dlo = Math.max(.12, lo1 - lo0);
    const bb = { s: la0 - dla * pad, n: la1 + dla * pad, w: lo0 - dlo * pad, e: lo1 + dlo * pad };
    box.innerHTML = v.map(s => { const x = (s.lng - bb.w) / (bb.e - bb.w) * 100, y = (1 - (s.lat - bb.s) / (bb.n - bb.s)) * 100; return `<button class="rpin${s.id === current ? ' on' : ''}" type="button" style="left:${(10 + x * .8).toFixed(1)}%;top:${(12 + y * .74).toFixed(1)}%;--c:${T[s.typ].c}" data-id="${s.id}" data-n="${s.n}" aria-label="${s.n} anzeigen"></button>`; }).join('');
    $$('.rpin', box).forEach(p => p.addEventListener('click', () => show(p.dataset.id)));
    if (window.gsap && !RM) gsap.from($$('.rpin', box), { scale: 0, stagger: .12, duration: .6, ease: 'back.out(3)' });
  }

  /* ---------- Spot-Panel ---------- */
  function show(id) {
    current = id; const s = S.find(x => x.id === id); if (!s) return;
    $$('.rpin').forEach(p => p.classList.toggle('on', p.dataset.id === id));
    const p = $('#spotpanel');
    p.innerHTML = `<div class="sp-photo">${s.foto ? `<img src="${s.foto}" alt="${s.n}">` : 'Foto folgt'}</div>
      <span class="tag" style="border-color:${T[s.typ].c};color:${T[s.typ].c}"><span class="dot"></span>${T[s.typ].n}</span>
      <h3 class="h3">${s.n}</h3><p class="mute" style="margin:0">${s.adr}</p><p style="margin:0">${s.t}</p>
      <p class="sp-rule">${s.regel}</p>
      <p class="starsline">${stars(s)} · ${s.k.length} Kommentare</p>
      <div class="sp-btns">${routeBtn(s)}<button class="btn ghost" type="button" data-rate="${s.id}">Bewerten</button></div>
      <p class="lock-hint" ${accepted() ? 'hidden' : ''}>Route erst nach dem Haken bei den Regeln oben.</p>`;
    wire(p);
    if (map) { map.flyTo([s.lat, s.lng], 13, { duration: RM ? 0 : 1.2 }); }
    if (window.gsap && !RM) gsap.from(p.children, { y: 16, opacity: 0, stagger: .04, duration: .5, ease: 'expo.out' });
  }
  function list() {
    $('#spotlist').innerHTML = vis().map(s => `<article class="spotcard panel">
      <span class="tag" style="border-color:${T[s.typ].c};color:${T[s.typ].c}"><span class="dot"></span>${T[s.typ].n}</span>
      <h3 class="h3">${s.n}</h3><p class="mute" style="margin:0">${s.adr}</p>
      <p class="starsline">${stars(s)}</p>
      ${s.k.length ? `<div class="comments">${s.k.map(k => `<p><b>${k.n}:</b> ${k.t}</p>`).join('')}</div>` : '<p class="mute" style="margin:0;font-size:14px">Noch keine Kommentare. Warst du schon dort?</p>'}
      <div class="sp-btns">${routeBtn(s)}<button class="btn ghost" type="button" data-show="${s.id}">Auf der Karte</button><button class="btn ghost" type="button" data-rate="${s.id}">Bewerten</button></div>
    </article>`).join('');
    wire($('#spotlist'));
  }
  function wire(root) {
    $$('[data-route]', root).forEach(a => a.addEventListener('click', e => { if (!accepted()) { e.preventDefault(); const r = $('#regeln'); FCS.lenis ? FCS.lenis.scrollTo(r, { offset: -80 }) : r.scrollIntoView(); const acc = $('.accept'); if (window.gsap) gsap.fromTo(acc, { x: -10 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)' }); } }));
    $$('[data-show]', root).forEach(b => b.addEventListener('click', () => { show(b.dataset.show); const k = $('#karte'); FCS.lenis ? FCS.lenis.scrollTo(k, { offset: -80 }) : k.scrollIntoView(); }));
    $$('[data-rate]', root).forEach(b => b.addEventListener('click', () => openRate(b.dataset.rate)));
  }
  function accept() {
    const c = $('#accept'); if (!c) return;
    c.checked = accepted();
    c.addEventListener('change', () => {
      try { sessionStorage.setItem('fcs-spot-ok', c.checked ? '1' : '0'); } catch (e) {}
      $$('[data-route]').forEach(a => c.checked ? a.removeAttribute('aria-disabled') : a.setAttribute('aria-disabled', 'true'));
      $$('.lock-hint').forEach(h => h.hidden = c.checked);
    });
  }

  /* ---------- Straßenkarte (Leaflet, erst nach Klick) ---------- */
  function leaflet() {
    $('#map-load').addEventListener('click', () => {
      if (!window.L) return;
      $('#radar').hidden = true; const el = $('#leaf'); el.hidden = false;
      map = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([49.35, 6.98], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>' }).addTo(map);
      leafPins(); const s = S.find(x => x.id === current); if (s) map.setView([s.lat, s.lng], 11);
    });
  }
  function leafPins() {
    if (layer) layer.remove(); layer = L.layerGroup().addTo(map);
    vis().forEach(s => {
      const icon = L.divIcon({ className: '', html: `<div class="lpin" style="--c:${T[s.typ].c}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
      L.marker([s.lat, s.lng], { icon, title: s.n }).addTo(layer).on('click', () => show(s.id)).bindPopup(`<b>${s.n}</b><br>${T[s.typ].n}`);
    });
  }

  /* ---------- Einsenden ---------- */
  function send() {
    const wa = $('#wa-btns'); if (wa) wa.innerHTML = D.kontakte.map(k => `<a class="btn wa" href="https://wa.me/${k.wa}?text=${encodeURIComponent('Hallo ' + k.name + ', ich habe einen Spot-Vorschlag für den Flight Club Saar: ')}" target="_blank" rel="noopener">WhatsApp an ${k.name} ↗</a>`).join('');
    const geo = $('#geo'); if (geo) geo.addEventListener('click', () => {
      if (!navigator.geolocation) { geo.textContent = 'Nicht verfügbar'; return; }
      geo.textContent = 'Suche …';
      navigator.geolocation.getCurrentPosition(p => { $('#s-loc').value = `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)} (https://www.google.com/maps?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)})`; geo.textContent = 'Übernommen ✓'; }, () => { geo.textContent = 'Kein Zugriff'; }, { enableHighAccuracy: true, timeout: 10000 });
    });
    const drop = $('#drop'), inp = $('#s-foto'), prev = $('#s-prev'); if (!drop) return;
    const showPrev = f => { if (!f || !f.type.startsWith('image/')) return; prev.src = URL.createObjectURL(f); prev.hidden = false; $('.drop-in', drop).style.opacity = 0; };
    inp.addEventListener('change', () => showPrev(inp.files[0]));
    ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (!f) return; const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; showPrev(f); });
  }

  /* ---------- Bewerten ---------- */
  function openRate(id) {
    const s = S.find(x => x.id === id), d = $('#rate'); if (!s || !d) return;
    $('#rate-h').textContent = s.n + ' bewerten'; $('#rate-spot').value = s.n;
    const f = $('#rateform'); f.classList.remove('sent'); $$('.form-ok,.form-bad', f).forEach(x => x.hidden = true);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    if (FCS.lenis) FCS.lenis.stop();
  }
  function rate() {
    const d = $('#rate'); if (!d) return;
    const close = () => { d.close ? d.close() : d.removeAttribute('open'); if (FCS.lenis) FCS.lenis.start(); };
    $('#rate-x').addEventListener('click', close);
    d.addEventListener('click', e => { if (e.target === d) close(); });
    d.addEventListener('close', () => FCS.lenis && FCS.lenis.start());
  }

  document.addEventListener('fcs:ready', () => {
    filters(); radar(); pins(); list(); accept(); leaflet(); send(); rate(); if (current) show(current);
    // Selbst-Impuls: die Spots werden nacheinander angesteuert
    if (window.ScrollTrigger && !RM) ScrollTrigger.create({ trigger: '#radar', start: 'top 70%', once: true, onEnter: () => { let i = 0; const ids = vis().map(s => s.id); const iv = setInterval(() => { show(ids[i % ids.length]); if (++i >= ids.length) { clearInterval(iv); show(ids[0]); } }, 1400); $('#radar').addEventListener('pointerdown', () => clearInterval(iv), { once: true }); } });
  }, { once: true });
})();
