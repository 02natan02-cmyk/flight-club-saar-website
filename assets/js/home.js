/* Startseite: Intro, Hero-OSD, Termin, Loop, Crew, Reels, Community */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 700px)').matches;

  /* ---------- Hero-Video passend zum Bildschirm ---------- */
  const hv = $('.hero-vid');
  if (hv) { const portrait = innerHeight > innerWidth; hv.dataset.src = portrait ? hv.dataset.srcM : hv.dataset.srcD; hv.poster = portrait ? 'media/hero-s.webp' : 'media/hero.webp'; }

  /* ---------- Intro „Brille an“ ---------- */
  function intro() {
    const el = $('#intro'); if (!el) return Promise.resolve();
    const q = location.search;
    let seen = false; try { seen = !!sessionStorage.getItem('fcs-intro'); } catch (e) {}
    if (q.includes('nointro') || (seen && !q.includes('intro')) || RM || !window.gsap) { el.classList.add('gone'); return Promise.resolve(); }
    try { sessionStorage.setItem('fcs-intro', '1'); } catch (e) {}
    document.documentElement.style.overflow = 'hidden'; if (FCS.lenis) FCS.lenis.stop();
    // Bildrauschen wie analoges FPV-Video
    const cv = $('.intro-noise', el), cx = cv.getContext('2d'); let run = true;
    const W = cv.width = 220, H = cv.height = 140; const img = cx.createImageData(W, H);
    (function noise() { if (!run) return; for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } cx.putImageData(img, 0, 0); requestAnimationFrame(noise); })();
    cv.style.imageRendering = 'pixelated';
    return new Promise(res => {
      const done = () => { run = false; el.classList.add('gone'); document.documentElement.style.overflow = ''; if (FCS.lenis) FCS.lenis.start(); res(); };
      const cnt = $('.io-count', el);
      const tl = gsap.timeline({ onComplete: done });
      tl.to(cv, { opacity: .55, duration: .25 })
        .to(cv, { opacity: .08, duration: .5 })
        .to($('[data-l="1"]', el), { opacity: 1, duration: .1 }, '-=.2')
        .to($('[data-l="1"]', el), { duration: .6, scrambleText: { text: 'FLIGHT CLUB SAAR · OSD', chars: '01#/<>_', speed: .8 } }, '<')
        .to($('[data-l="2"]', el), { opacity: 1, duration: .1 })
        // Unser Logo zeichnet sich wie eine Leuchtspur und zündet dann
        .fromTo($('.io-logo path', el), { drawSVG: '0%' }, { drawSVG: '100%', duration: .9, ease: 'power2.inOut' }, '-=.1')
        .to($('.io-logo path', el), { fill: '#eaf4ff', duration: .3 })
        .fromTo($('.io-logo', el), { scale: 1 }, { scale: 1.12, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out' }, '<')
        .from($('.io-big', el), { scale: 1.6, filter: 'blur(14px)', duration: .7, ease: 'expo.out' }, '-=.05')
        .to($('.io-big', el), { opacity: 1, duration: .3 }, '<')
        .to($('[data-l="3"]', el), { opacity: 1, duration: .1 })
        .call(() => cnt.textContent = '2', null, '+=.35')
        .call(() => cnt.textContent = '1', null, '+=.35')
        .call(() => { cnt.parentNode.innerHTML = '<b style="color:#3ee08a">ARMED</b>'; }, null, '+=.35')
        .to($('.intro-osd', el), { opacity: 0, scale: .92, duration: .35 }, '+=.25')
        // Brillengläser öffnen sich und geben die Welt frei
        .to($$('.lh', el), { attr: { rx: 22, ry: 18 }, duration: .45, ease: 'power2.out' }, '<')
        .to(cv, { opacity: 0, duration: .3 }, '<')
        .to($$('.lh', el), { attr: { rx: 140, ry: 120 }, duration: .9, ease: 'expo.in' }, '+=.15');
      $('.intro-skip', el).addEventListener('click', () => { tl.progress(1); });
    });
  }

  /* ---------- Hero-Einflug + OSD ---------- */
  function hero() {
    const t0 = Date.now();
    const timer = $('[data-osd=timer]'), volt = $('[data-osd=volt]'), rssi = $('[data-osd=rssi]'), alt = $('[data-osd=alt]'), spd = $('[data-osd=spd]');
    setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      if (timer) timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      if (volt) { const v = Math.max(14.0, 16.8 - s * 0.006); volt.textContent = v.toFixed(1) + 'V'; volt.classList.toggle('warn', v < 14.8); }
      if (rssi) rssi.textContent = 92 + Math.floor(Math.random() * 8);
    }, 1000);
    let lastY = scrollY, lastT = performance.now();
    addEventListener('scroll', () => {
      const now = performance.now(), dy = Math.abs(scrollY - lastY), dt = Math.max(16, now - lastT);
      if (alt) alt.textContent = String(12 + Math.floor(scrollY / 12)).padStart(3, '0');
      if (spd) spd.textContent = String(Math.min(140, Math.round(dy / dt * 90))).padStart(2, '0');
      lastY = scrollY; lastT = now;
    }, { passive: true });
    const hz = $('.horizon');
    if (hz && !RM) {
      addEventListener('pointermove', e => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; hz.style.setProperty('--roll', (x * -14).toFixed(1) + 'deg'); hz.style.setProperty('--pitch', (y * 30).toFixed(0) + 'px'); }, { passive: true });
      addEventListener('deviceorientation', e => { if (e.gamma == null) return; hz.style.setProperty('--roll', Math.max(-25, Math.min(25, -e.gamma)).toFixed(1) + 'deg'); }, { passive: true });
    }
    if (window.gsap && !RM) {
      gsap.from('.hero-h .hh', { yPercent: 105, opacity: 0, duration: 1.3, stagger: .12, ease: 'expo.out' });
      gsap.from(['.hero .kicker', '.hero-l', '.hero-b'], { y: 30, opacity: 0, duration: 1, stagger: .1, delay: .35, ease: 'expo.out' });
      gsap.from('.osd', { opacity: 0, duration: .6, stagger: .08, delay: .2 });
      gsap.to('.hero-in', { yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero-vid', { scale: 1.12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  /* ---------- Nächstes Hallenfliegen ---------- */
  function termin() {
    const n = FCS.next(), list = $('#t-list'); if (!list) return;
    const all = FCS.termine();
    $('#stat-hallen') && ($('#stat-hallen').dataset.count = all.length);
    list.innerHTML = all.map(t => `<li class="${t.vorbei ? 'past' : ''}${n && t.d === n.d ? ' nx' : ''}"><span>${FCS.fmtDate(t.d)}</span><span class="mute">${t.halle.name.replace('Großwaldhalle', 'Eiweiler').replace('Glück-Auf-Halle', '')}</span></li>`).join('');
    if (!n) { $('#t-datum').textContent = 'Neue Termine folgen'; $('#t-ort').textContent = 'Die nächste Saison kündigen wir in der Gruppe und hier an.'; $('#t-cd').hidden = true; return; }
    $('#t-datum').textContent = FCS.fmtDate(n.d, 1);
    $('#t-ort').textContent = `${n.halle.name} · ${D.zeit.von.replace(':00', '')} bis ${D.zeit.bis.replace(':00', '')} Uhr`;
    $('#t-route').href = FCS.route(n.halle.lat, n.halle.lng, n.halle.adresse);
    $('#t-ics').addEventListener('click', () => FCS.ics(n));
    FCS.countdown($('#t-cd'), n.start.getTime());
    if (window.gsap && window.ScrollTrigger && !RM) {
      gsap.from('.gate-led rect', { drawSVG: 0, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.gate', start: 'top 80%', once: true } });
      gsap.from('.cd div', { y: 40, opacity: 0, rotateX: -70, stagger: .08, duration: 1, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.cd', start: 'top 85%', once: true } });
    }
  }

  /* ---------- Build Fly Crash Repair Repeat ---------- */
  function loop() {
    const sec = $('#motto'); if (!sec) return;
    // Bildrauschen im Crash-Panel
    const cv = $('.crash-noise'); if (cv) {
      const cx = cv.getContext('2d'), W = cv.width = 160, H = cv.height = 200, img = cx.createImageData(W, H); let vis = false;
      new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) draw(); }).observe(cv);
      let f = 0; function draw() { if (!vis) return; if (f++ % 2 === 0) { for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200 | 0; img.data[i] = v * .7; img.data[i + 1] = v * .8; img.data[i + 2] = v; img.data[i + 3] = 255; } cx.putImageData(img, 0, 0); } requestAnimationFrame(draw); }
      cv.style.imageRendering = 'pixelated';
    }
    if (!window.gsap || !window.ScrollTrigger || RM || matchMedia('(max-width: 860px)').matches) return;
    const track = $('.loop-track'), names = ['BUILD', 'FLY', 'CRASH', 'REPAIR', 'REPEAT'];
    const dist = () => track.scrollWidth - innerWidth;
    const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: {
      trigger: sec, pin: '.loop-pin', start: 'top top', end: () => '+=' + dist(), scrub: .6, invalidateOnRefresh: true,
      onUpdate: s => { const i = Math.min(4, Math.round(s.progress * 4)); $('[data-loop-i]').textContent = '0' + (i + 1); $('[data-loop-n]').textContent = names[i]; gsap.set('.loop-bar i', { scaleX: s.progress }); }
    } });
    $$('.lp', track).forEach(p => {
      gsap.from($('.lp-h', p), { xPercent: 30, opacity: 0, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: tw, start: 'left 90%', end: 'left 40%', scrub: true } });
      gsap.from($('.lp-media', p), { scale: .85, rotate: -3, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: tw, start: 'left 100%', end: 'left 50%', scrub: true } });
    });
  }

  /* ---------- Crew-Karten ---------- */
  function crew() {
    const deck = $('#deck'); if (!deck) return;
    const okc = D.crew.filter(c => c.ok), rest = D.crew.length - okc.length;
    const cards = okc.map((c, i) => {
      const name = c.n || c.a, alias = c.n ? c.a : '';
      const back = [c.seit ? `<span>FPV seit <b>${c.seit}</b></span>` : '', c.stil ? `<span>Stil <b>${c.stil}</b></span>` : '', c.ort ? `<span>Aus <b>${c.ort}</b></span>` : ''].filter(Boolean).join('') || '<span>Mitglied im Flight Club Saar</span>';
      return `<div class="mcard${c.v ? ' v' : ''}" tabindex="0" role="button" title="Antippen dreht die Karte um">
        <div class="mc-top"><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Mitgliedskarte<br><b>2026</b></span></div>
        ${c.img ? `<img class="mc-ph" src="${c.img}" alt="" loading="lazy" width="400" height="400">` : ''}<div class="mc-name">${name}</div><div class="mc-alias">${alias || ''}</div>
        <div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">${c.r || 'Mitglied'}</span></div>
        <div class="mc-back">${back}</div><i class="mc-shine"></i></div>`;
    }).join('') + (rest > 0 ? `<div class="mcard more" tabindex="0" role="button" title="Antippen dreht die Karte um"><div class="mc-top"><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Mitgliedskarte<br><b>2026</b></span></div><div class="mc-name">+${rest}</div><div class="mc-alias">weitere Piloten</div><div class="mc-bot"><span>Flight Club Saar e. V.</span><span class="mc-role">Crew 2026</span></div><div class="mc-back"><span>Dabei, bezahlt, <b>ohne Namen</b> auf der Website</span></div><i class="mc-shine"></i></div>` : '') + `<a class="mcard free" href="mitglied.html"><b>+ Du?</b><span>Dein Platz ist frei</span></a>`;
    deck.innerHTML = cards;
    const all = $$('.mcard', deck);
    all.forEach(c => {
      if (c.classList.contains('free')) return;
      c.addEventListener('click', () => c.classList.toggle('flip'));
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flip'); } });
      if (FCS.fine && window.gsap) {
        c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; gsap.to(c, { rotateY: x * 18, rotateX: -y * 14, duration: .4 }); c.style.setProperty('--sx', (x * 120) + '%'); });
        c.addEventListener('pointerleave', () => gsap.to(c, { rotateY: 0, rotateX: 0, duration: .8, ease: 'elastic.out(1,.5)' }));
      }
    });
    if (window.gsap && window.ScrollTrigger && !RM) {
      gsap.from(all, { y: 120, rotateX: -50, rotateZ: (i) => (i % 2 ? 6 : -6), opacity: 0, stagger: .07, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: deck, start: 'top 80%', once: true,
        onEnter: () => { // Selbst-Impuls: die erste Karte dreht sich einmal um
          const f = all[0]; setTimeout(() => { f.classList.add('flip'); setTimeout(() => f.classList.remove('flip'), 1600); }, 1700);
        } } });
    }
    deck.addEventListener('click', () => { const h = $('#crew-hint'); if (h) h.style.opacity = 0; }, { once: true });
  }

  /* ---------- Reels (Zwei-Klick zu Instagram) ---------- */
  function reels() {
    const tr = $('#reel-track'); if (!tr) return;
    const cols = [['#1F497D', '#071225'], ['#2a1f5c', '#070b1c'], ['#0f4b5c', '#04121a'], ['#5c3a12', '#120a04']];
    const fmt = d => d ? d.split('-').reverse().join('.') : '';
    tr.innerHTML = D.reels.map((r, i) => `<div class="reel${r.cov !== 0 ? ' has-cov' : ''}" data-twoclick="iframe" data-src="https://www.instagram.com/reel/${r.id}/embed/" data-title="Instagram-Reel Flight Club Saar: ${r.t || i + 1}" style="--c1:${cols[i % 4][0]};--c2:${cols[i % 4][1]}">
      <div class="reel-in">${r.cov !== 0 ? `<img class="reel-cov" src="media/reels/${r.id}.webp" alt="" loading="lazy" width="540" height="960" onerror="this.remove()">` : ''}${r.clip ? `<video class="reel-clip" data-clip="media/reels/${r.id}.mp4" muted loop playsinline preload="none" poster="media/reels/${r.id}.webp" aria-hidden="true"></video>` : ''}
        <div class="reel-top"><span class="reel-no">${String(i + 1).padStart(2, '0')}</span><span class="reel-d">${fmt(r.d)}</span></div>
        <div class="reel-c"><b class="reel-v">${r.v.toLocaleString('de-DE')}</b><span class="reel-vl">Aufrufe</span><strong class="reel-t">${r.t || ''}</strong><span class="reel-s">${r.c || ''}</span><button class="btn solid" type="button" data-load>Reel ansehen</button><span class="reel-note">Lädt Inhalte von Instagram</span></div></div></div>`).join('');
    // Stumme Endlos-Clips: laden erst, wenn die Karte sichtbar ist, und pausieren außerhalb
    if (!RM) { const io = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting) { if (!v.src) v.src = v.dataset.clip; v.play().catch(() => {}); } else v.pause(); }), { threshold: .35 }); $$('.reel-clip', tr).forEach(v => io.observe(v)); }
    if (!window.gsap || !window.Draggable) return;
    const rail = $('#reel-rail');
    const bounds = () => ({ minX: Math.min(0, rail.clientWidth - tr.scrollWidth), maxX: 0 });
    const d = Draggable.create(tr, { type: 'x', bounds: bounds(), inertia: !!window.InertiaPlugin, edgeResistance: .85, dragClickables: false, onPress() { this.applyBounds(bounds()); }, onDragStart: () => { const h = $('#rail-hint'); if (h) h.style.opacity = 0; } })[0];
    addEventListener('resize', () => d.applyBounds(bounds()));
    if (!RM && window.ScrollTrigger) ScrollTrigger.create({ trigger: rail, start: 'top 75%', once: true, onEnter: () => gsap.timeline().to(tr, { x: -180, duration: 1, ease: 'power2.inOut' }).to(tr, { x: 0, duration: 1, ease: 'power2.inOut', onComplete: () => d.update() }) });
  }

  /* ---------- Community-Netz ---------- */
  function net() {
    const box = $('#net'); if (!box) return;
    const G = D.gruppen, N = G.length, cx = 300, cy = 300, R = 220;
    const pts = G.map((g, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, g, i }; });
    const max = Math.max(...G.map(g => g.m || 0));
    const rad = g => g.m ? 22 + 22 * g.m / max : 20;
    box.innerHTML = `<svg viewBox="0 0 600 600" role="group">
      ${pts.map(p => `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`).join('')}
      ${pts.map((p, i) => { const q = pts[(i + 1) % N]; return `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" style="opacity:.5"/>`; }).join('')}
      ${pts.map(p => `<circle class="pulse" r="3" cx="${cx}" cy="${cy}" data-tx="${p.x.toFixed(1)}" data-ty="${p.y.toFixed(1)}"/>`).join('')}
      <g><circle cx="${cx}" cy="${cy}" r="70" fill="#1F497D" stroke="#3fe0ff" stroke-width="2"/><image href="assets/img/logo-mark.svg" x="${cx - 46}" y="${cy - 46}" width="92" height="92"/></g>
      ${pts.map(p => `<g class="node${p.i === 0 ? ' on' : ''}" tabindex="0" role="button" data-i="${p.i}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle class="n" r="${rad(p.g).toFixed(1)}"/>${p.g.m ? `<text class="cnt" text-anchor="middle" dy="6">${p.g.m}</text>` : `<text class="cnt" text-anchor="middle" dy="6">•</text>`}<text text-anchor="middle" dy="${(rad(p.g) + 18).toFixed(0)}">${p.g.n.replace('Flight Club Saar ', '').replace('Ankündigungen Verein', 'Ankündig. Verein')}</text></g>`).join('')}
    </svg>`;
    const info = $('#comm-info');
    const pick = i => { $$('.node', box).forEach(n => n.classList.toggle('on', +n.dataset.i === i)); const g = G[i]; info.innerHTML = `<b>${g.n}</b><span>${g.t}${g.m ? ` · ${g.m} Mitglieder` : ''}</span>`; };
    $$('.node', box).forEach(n => { const i = +n.dataset.i; n.addEventListener('click', () => pick(i)); n.addEventListener('mouseenter', () => pick(i)); n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } }); });
    if (!window.gsap || RM) return;
    $$('.pulse', box).forEach((p, i) => gsap.to(p, { attr: { cx: p.dataset.tx, cy: p.dataset.ty }, duration: 1.8 + (i % 3) * .4, repeat: -1, ease: 'power1.inOut', yoyo: true, delay: i * .2 }));
    if (window.ScrollTrigger) {
      gsap.from($$('.node', box), { scale: 0, transformOrigin: '50% 50%', stagger: .08, duration: .8, ease: 'back.out(2)', scrollTrigger: { trigger: box, start: 'top 75%', once: true } });
      gsap.from($$('line', box), { drawSVG: 0, stagger: .03, duration: .8, scrollTrigger: { trigger: box, start: 'top 75%', once: true } });
      // Selbst-Impuls: die Gruppen werden einmal nacheinander hervorgehoben
      ScrollTrigger.create({ trigger: box, start: 'top 60%', once: true, onEnter: () => { let k = 0; const iv = setInterval(() => { pick(k % N); if (++k > N) { clearInterval(iv); pick(0); } }, 650); box.addEventListener('pointerdown', () => clearInterval(iv), { once: true }); } });
    }
  }

  /* ---------- Mitgliedskarte im Abschluss ---------- */
  function joinCard() {
    const c = $('#card3d .mcard'); if (!c || !window.gsap || RM) return;
    gsap.to(c, { rotateY: 12, rotateX: -4, ease: 'none', scrollTrigger: { trigger: '#mitmachen', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to(c, { '--sx': '60%', ease: 'none', scrollTrigger: { trigger: '#mitmachen', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  function go() { intro().then(() => { hero(); if (window.ScrollTrigger) ScrollTrigger.refresh(); }); termin(); loop(); crew(); reels(); net(); joinCard(); }
  document.addEventListener('fcs:ready', go, { once: true });
})();

/* ===== Teil 2: Drohnenshow, Flug per Scroll, Kanal-Zapper, Galerie-Ring ===== */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SMALL = matchMedia('(max-width: 700px)').matches;

  /* ---------- Drohnenshow ---------- */
  async function show() {
    const sec = $('#show'), cv = $('#show-cv'); if (!sec || !cv) return;
    const cx = cv.getContext('2d');
    const N = SMALL ? 420 : 820;
    let W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2);
    const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    // Leuchtpunkt als Sprite (schneller als Schatten pro Punkt)
    const spr = (c, r) => { const s = document.createElement('canvas'); s.width = s.height = r * 2; const g = s.getContext('2d'); const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return s; };
    const SC = spr('rgba(63,224,255,.9)', 9), SA = spr('rgba(255,176,32,.9)', 9), SW = spr('rgba(234,244,255,.9)', 9);
    try { await document.fonts.load('400 200px "Bebas Neue"'); } catch (e) {}
    const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    const mark = await loadImg('assets/img/logo-mark.svg');
    // Formen abtasten
    const sample = (draw, aspect) => {
      const w = 420, h = Math.round(420 / aspect), o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d');
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw(g, w, h);
      const d = g.getImageData(0, 0, w, h).data, pts = [];
      for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (d[(y * w + x) * 4 + 3] > 120) pts.push([x / w, y / h]);
      const out = []; for (let i = 0; i < N; i++) out.push(pts.length ? pts[(i * 7919) % pts.length] : [Math.random(), Math.random()]);
      return { pts: out, aspect };
    };
    const txt = (t, size) => (g, w, h) => { g.font = `400 ${size}px "Bebas Neue"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + size * .06); };
    const F = [
      { s: sample((g, w, h) => mark && g.drawImage(mark, (w - h) / 2, 0, h, h), 1.4), t: 'Flight Club Saar', u: 'Unser Logo, geflogen von Drohnen.' },
      { s: sample(txt('2022', 300), 1.9), t: 'Gegründet 2022', u: 'Am 10. Dezember 2022 in Dillingen, so steht es in unserer Satzung.' },
      { s: sample(txt('69', 320), 1.6), t: 'Im Vereins-Chat', u: 'So viele Leute sind im Hauptchat unserer Community.' },
      { s: sample(txt('FPV', 300), 1.9), t: 'First Person View', u: 'Du siehst, was die Drohne sieht. Live, durch die Brille.' },
      { s: sample((g, w, h) => { g.font = '400 118px "Bebas Neue"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FLIGHT CLUB', w / 2, h * .3); g.fillText('SAAR', w / 2, h * .74); }, 1.55), t: 'Brille an. Welt aus.', u: 'Flight Club Saar e. V.' }
    ];
    // Drohnen starten verteilt am Boden
    const P = Array.from({ length: N }, (_, i) => ({ x: Math.random() * W, y: H + Math.random() * 60, vx: 0, vy: 0, k: .035 + Math.random() * .04, c: i % 11 === 0 ? SA : i % 5 === 0 ? SW : SC, ph: Math.random() * 6.28 }));
    let fi = -1, mix = 0, mx = -999, my = -999, vis = false, launched = false;
    const target = (f, p) => { const s = F[f].s; const bw = Math.min(W * .82, (H * .58) * s.aspect), bh = bw / s.aspect; const ox = (W - bw) / 2, oy = H * .42 - bh / 2; return [ox + p[0] * bw, oy + p[1] * bh]; };
    const setF = (f) => { if (f === fi) return; fi = f; $('#show-t').textContent = F[f].t; $('#show-s').textContent = F[f].u; $('#show-f').textContent = f + 1; if (window.gsap && !RM) gsap.fromTo('#show-t', { opacity: 0, y: 20, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .6 }); };
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    cv.addEventListener('pointerleave', () => { mx = my = -999; });
    sec.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) { if (!launched) { launched = true; setF(0); } loop(); } }, { threshold: .05 }).observe(sec);
    addEventListener('resize', size);
    let t = 0;
    function loop() {
      if (!vis) return; t += .016;
      cx.globalCompositeOperation = 'source-over'; cx.fillStyle = 'rgba(2,5,11,.42)'; cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = 'lighter';
      const f = Math.max(0, fi), s = F[f].s.pts; let air = 0;
      for (let i = 0; i < N; i++) {
        const p = P[i]; const [tx, ty] = target(f, s[i]);
        const hx = tx + Math.sin(t * 1.3 + p.ph) * 1.6, hy = ty + Math.cos(t * 1.1 + p.ph) * 1.6;
        let ax = (hx - p.x) * p.k, ay = (hy - p.y) * p.k;
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 9000) { const d = Math.sqrt(d2) || 1, fz = (95 - d) / 95 * 4.2; ax += dx / d * fz; ay += dy / d * fz; }
        p.vx = (p.vx + ax) * .82; p.vy = (p.vy + ay) * .82; p.x += p.vx; p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > .3) air++;
        const sz = (i % 13 === 0 ? 9 : 6) + (Math.sin(t * 6 + p.ph) > .96 ? 4 : 0);
        cx.drawImage(p.c, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      $('#show-n').textContent = N;
      requestAnimationFrame(loop);
    }
    if (window.ScrollTrigger && !RM) {
      ScrollTrigger.create({ trigger: sec, pin: '.show-pin', start: 'top top', end: () => '+=' + (innerHeight * 3.2), scrub: true,
        onUpdate: st => setF(Math.min(F.length - 1, Math.floor(st.progress * F.length * .999))) });
      // Die Show entsteht erst nach dem Laden von Schrift und Logo: Reihenfolge der Pins neu ordnen
      ScrollTrigger.sort(); ScrollTrigger.refresh();
    } else setF(0);
  }

  /* ---------- Flug per Scroll ---------- */
  function fly() {
    const sec = $('#fly'), v = $('#fly-v'); if (!sec || !v || !window.ScrollTrigger || RM) return;
    let want = 0, busy = false, dur = 11;
    v.addEventListener('loadedmetadata', () => { dur = v.duration || 11; });
    const seek = () => { if (busy) return; busy = true; v.currentTime = want; };
    v.addEventListener('seeked', () => { busy = false; if (Math.abs(v.currentTime - want) > .04) seek(); });
    const thr = $('#thr'), tv = $('#thr-v'), d = $('#fly-d');
    ScrollTrigger.create({ trigger: sec, pin: '.fly-pin', start: 'top top', end: () => '+=' + (innerHeight * 2.4), scrub: true,
      onUpdate: st => {
        want = Math.min(dur - .05, st.progress * dur); seek();
        const vel = Math.min(100, Math.abs(st.getVelocity()) / 25); thr.style.height = vel + '%'; tv.textContent = Math.round(vel) + '%';
        const s = Math.floor(want); d.textContent = `00:${String(s).padStart(2, '0')}`;
      },
      onEnter: () => { v.load(); } });
    setInterval(() => { const h = parseFloat(thr.style.height) || 0; if (h > 0) { const n = Math.max(0, h - 6); thr.style.height = n + '%'; tv.textContent = Math.round(n) + '%'; } }, 120);
  }

  /* ---------- Kanal-Zapper ---------- */
  function zap() {
    const v = $('#zap-v'), nz = $('#zap-noise'), wrap = $('#chbtns'), knob = $('#knob'); if (!v || !wrap) return;
    const R = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917];
    const CL = ['media/hero.mp4', 'media/natur.mp4', 'media/schiff.mp4', 'media/turm.mp4', 'media/gang.mp4', 'media/schacht.mp4', 'media/cine.mp4', 'media/hero.mp4'];
    const legal = f => f >= 5725 && f <= 5875;
    wrap.innerHTML = R.map((f, i) => `<button type="button" aria-pressed="${i === 3}" class="${legal(f) ? '' : 'ill'}" data-ch="${i}">R${i + 1}</button>`).join('');
    const cx = nz.getContext('2d'); nz.width = 160; nz.height = 100; const img = cx.createImageData(160, 100);
    let noiseOn = false; const noise = () => { if (!noiseOn) return; for (let i = 0; i < img.data.length; i += 4) { const q = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = q; img.data[i + 3] = 255; } cx.putImageData(img, 0, 0); requestAnimationFrame(noise); };
    let ch = 3, started = false, manual = false;
    const set = (i, user) => {
      ch = (i + 8) % 8; const f = R[ch], ok = legal(f);
      $$('button', wrap).forEach((b, k) => b.setAttribute('aria-pressed', k === ch));
      knob.style.setProperty('--k', (ch * 45 - 157.5) + 'deg'); knob.setAttribute('aria-valuenow', ch + 1);
      const kp = (D.kanal || []).find(k => k.ch === ch + 1);
      $('#zap-ch').textContent = `R${ch + 1} · ${f} MHz`; $('#zap-pilot').textContent = ok ? (kp ? kp.a.toUpperCase() : `PILOT ${ch + 1}`) : 'KEIN PILOT';
      $('#zap-t').textContent = ok && kp && kp.o ? kp.o.toUpperCase() : 'FLIGHT CLUB SAAR';
      const lg = $('#zap-legal'); lg.textContent = ok ? '25 mW · DE OK' : 'IN DE NICHT ERLAUBT'; lg.classList.toggle('bad', !ok);
      noiseOn = true; nz.style.opacity = 1; noise();
      setTimeout(() => {
        if (ok) { const kp2 = (D.kanal || []).find(k => k.ch === ch + 1); v.src = kp2 ? kp2.clip : CL[ch]; v.play().catch(() => {}); setTimeout(() => { noiseOn = false; nz.style.opacity = 0; }, 260); }
        else { v.pause(); v.removeAttribute('src'); v.load(); nz.style.opacity = .9; }
      }, RM ? 0 : 220);
      if (user && !manual) { manual = true; const h = $('#zap-hint'); if (h) h.style.opacity = 0; }
    };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) set(+b.dataset.ch, true); });
    knob.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(ch + 1, true); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(ch - 1, true); } });
    let drag = false;
    const ang = e => { const r = knob.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 57.3 + 90; };
    knob.addEventListener('pointerdown', e => { drag = true; knob.setPointerCapture(e.pointerId); });
    knob.addEventListener('pointermove', e => { if (!drag) return; let a = ang(e); if (a < -180) a += 360; if (a > 180) a -= 360; const i = Math.max(0, Math.min(7, Math.round((a + 157.5) / 45))); if (i !== ch) set(i, true); });
    ['pointerup', 'pointercancel'].forEach(t => knob.addEventListener(t, () => drag = false));
    new IntersectionObserver(es => { const on = es[0].isIntersecting; if (on && !started) { started = true; set(3); if (!RM) { setTimeout(() => !manual && set(4), 1800); setTimeout(() => !manual && set(7), 3300); setTimeout(() => !manual && set(3), 4800); } } if (!on) v.pause(); else if (v.src) v.play().catch(() => {}); }, { threshold: .3 }).observe($('.goggle'));
  }

  /* ---------- Galerie-Ring ---------- */
  function ring() {
    const st = $('#ring-stage'), inn = $('#ring-in'); if (!st) return;
    const imgs = ['lp1', 'lp4', 'lp8', 'cine', 'lp2', 'lp9', 'sch9', 'lp6', 'lp10', 'lp3', 'lp7', 'sch26', 'lp5'];
    const n = imgs.length, wv = () => innerWidth < 700 ? 190 : innerWidth < 1100 ? 280 : 360;
    const build = () => {
      const w = wv(), h = w * .62, rad = Math.round(w * 1.05 / (2 * Math.tan(Math.PI / n)));
      inn.innerHTML = imgs.map((k, i) => `<button type="button" class="rimg" style="--w:${k.startsWith('sch') ? h * .62 : w}px;--h:${h}px;transform:rotateY(${i * 360 / n}deg) translateZ(${rad}px)" data-src="media/g/${k}.webp" aria-label="Bild ${i + 1} groß ansehen"><img src="media/g/${k}.webp" alt="Standbild aus einem Flug des Vereins" loading="lazy" width="${w}" height="${Math.round(h)}"></button>`).join('');
      return rad;
    };
    let rad = build(), rot = 0, vel = .12, dragging = false, lastX = 0, moved = 0, idle = true;
    const apply = () => { inn.style.transform = `translateY(-40px) translateZ(${-rad}px) rotateX(-4deg) rotateY(${rot}deg)`; };
    st.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; moved = 0; idle = false; st.setPointerCapture(e.pointerId); const h = $('#ring-hint'); if (h) h.style.opacity = 0; });
    st.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); rot += dx * .25; vel = dx * .25; apply(); });
    const up = e => { if (!dragging) return; dragging = false; if (moved < 6) { const b = document.elementFromPoint(e.clientX, e.clientY); const btn = b && b.closest('.rimg'); if (btn) open(btn.dataset.src); } setTimeout(() => idle = true, 2500); };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', () => dragging = false);
    inn.addEventListener('keydown', e => { const b = e.target.closest('.rimg'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(b.dataset.src); } });
    const lb = $('#lb'); const open = (src) => { $('#lb-img').src = src; lb.showModal ? lb.showModal() : lb.setAttribute('open', ''); if (FCS.lenis) FCS.lenis.stop(); };
    const close = () => { lb.close ? lb.close() : lb.removeAttribute('open'); if (FCS.lenis) FCS.lenis.start(); };
    $('#lb-x').addEventListener('click', close); lb.addEventListener('click', e => { if (e.target === lb) close(); }); lb.addEventListener('close', () => FCS.lenis && FCS.lenis.start());
    let on = false; new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) tick(); }).observe(st);
    function tick() { if (!on) return; if (!dragging) { if (idle && !RM) vel += (.12 - vel) * .02; else vel *= .95; rot += vel; apply(); } requestAnimationFrame(tick); }
    addEventListener('resize', () => { rad = build(); apply(); });
    apply();
  }

  document.addEventListener('fcs:ready', () => { show(); fly(); zap(); ring(); }, { once: true });
})();

/* ===== Teil 3: Blackbox-Chronik ===== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function chronik() {
    const bb = $('#bb'), list = $('#bb-list'); if (!bb || !list) return;
    const items = (FCS.data.chronik || []).slice().sort((a, b) => a.d.localeCompare(b.d));
    const today = new Date().toISOString().slice(0, 10);
    list.innerHTML = items.map((c, i) => {
      const [y, m, d] = c.d.split('-');
      return `<li class="bb-it${c.d <= today && (!items[i + 1] || items[i + 1].d > today) ? ' now' : ''}"><i class="bb-dot"></i><div class="bb-card">${c.img ? `<span class="bb-img"><img src="${c.img}" alt="" loading="lazy" width="640" height="400"></span>` : ''}<p class="bb-log"><span>LOG ${String(i + 1).padStart(2, '0')} · ${d}.${m}.${y}</span><em>${c.d > today ? 'GEPLANT' : 'T+' + String(Math.round((new Date(c.d) - new Date(items[0].d)) / 864e5)).padStart(4, '0') + ' D'}</em></p><h3>${c.t}</h3><p>${c.u}</p></div></li>`;
    }).join('');
    const its = $$('.bb-it', list), fill = $('#bb-fill'), drone = $('#bb-drone'), line = $('.bb-line', bb);
    // Gyro-Spuren wie im Blackbox Explorer
    const cv = $('#bb-trace'), cx = cv.getContext('2d'); let W = 0, H = 0, prog = 0, vis = false, t = 0;
    const size = () => { const r = bb.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const cols = ['rgba(255,90,110,.55)', 'rgba(62,224,138,.5)', 'rgba(90,168,255,.55)'];
    const draw = () => {
      if (!vis) return; t += RM ? 0 : .012;
      cx.clearRect(0, 0, W, H);
      const lanes = 3, laneW = W / lanes;
      for (let k = 0; k < lanes; k++) {
        cx.strokeStyle = cols[k]; cx.lineWidth = 1.2; cx.beginPath();
        for (let y = 0; y <= H; y += 6) {
          const q = y * .018 + t * (1.4 + k * .3) + prog * 18 + k * 7;
          const amp = laneW * (.18 + .12 * Math.sin(y * .002 + k));
          const x = laneW * (k + .5) + Math.sin(q) * amp * .6 + Math.sin(q * 2.7 + k) * amp * .3 + Math.sin(q * 7.3) * amp * .08;
          y ? cx.lineTo(x, y) : cx.moveTo(x, y);
        }
        cx.stroke();
      }
      requestAnimationFrame(draw);
    };
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) draw(); }).observe(bb);
    if (!window.ScrollTrigger || RM) { its.forEach(i => i.classList.add('on')); fill.style.height = '100%'; drone.style.top = '100%'; return; }
    ScrollTrigger.create({ trigger: line, start: 'top 60%', end: 'bottom 60%', scrub: .6,
      onUpdate: st => { prog = st.progress; fill.style.height = (prog * 100) + '%'; drone.style.top = (prog * 100) + '%'; drone.style.transform = `rotate(${Math.max(-25, Math.min(25, st.getVelocity() / 60))}deg)`; } });
    its.forEach(it => ScrollTrigger.create({ trigger: it, start: 'top 62%', onEnter: () => it.classList.add('on'), onLeaveBack: () => it.classList.remove('on') }));
  }
  document.addEventListener('fcs:ready', chronik, { once: true });
})();

/* ===== Teil 4: Ayedo-Mission (Sponsor) ===== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = {
    akku: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M7 10v4M11 10v4"/></svg>',
    props: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><path d="M12 10C10 6 7 3 5 4s1 5 5 7M14 12c4 2 7 5 6 7s-5-1-7-5M10 13c-4 2-7 5-6 7"/></svg>',
    gate: '<svg viewBox="0 0 24 24"><path d="M4 21V9a8 8 0 0 1 16 0v12"/><path d="M8 21v-9a4 4 0 0 1 8 0v9"/></svg>',
    loet: '<svg viewBox="0 0 24 24"><path d="M3 21l6-6M9 15l3 3 9-9-3-3z"/><path d="M14 6l4 4"/></svg>',
    brille: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="9" rx="4"/><circle cx="8" cy="12.5" r="2"/><circle cx="16" cy="12.5" r="2"/></svg>'
  };
  const GEAR = [['akku', 'Akkus'], ['props', 'Props'], ['gate', 'Gates'], ['loet', 'Werkzeug'], ['brille', 'Brillen']];
  const BEATS = [
    ['Hallo Flight Club!', 'Seit Februar 2025 fliegt Ayedo mit uns.'],
    ['Abheben mit Ayedo', 'Ein Sponsor aus dem Saarland, der den Verein unterstützt.'],
    ['Rüstet den Verein aus', 'Sponsoring und Unterstützung, damit wir mehr fliegen können.'],
    ['Cloud aus dem Saarland', 'Ayedo betreibt Cloud und Server, zu Hause in Schwalbach-Hülzweiler.'],
    ['Unser FPV-Alien', 'Von Ayedo extra für uns gezeichnet: mit FPV-Brille und Funke. Er fliegt in fast jedem unserer Videos mit.'],
    ['Danke, Ayedo!', 'Der Flight Club Saar sagt Danke.']
  ];
  function ay() {
    const sec = $('#partner'); if (!sec || !sec.classList.contains('ay')) return;
    const pin = $('.ay-pin', sec), title = $('#ay-title'), sub = $('#ay-sub'), step = $('#ay-step'), end = $('#ay-end'), hint = $('#ay-hint');
    const gear = $('#ay-gear');
    gear.innerHTML = GEAR.map(([k, n]) => `<i class="g">${ICON[k]}<span>${n}</span></i>`).join('');
    // Sternenhimmel mit Warp beim Abheben
    const sky = $('#ay-sky'), sx = sky.getContext('2d'); let W = 0, H = 0, warp = 0, vis = false;
    const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .9 + .1, t: Math.random() * 6 }));
    const size = () => { const r = pin.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; sky.width = W * d; sky.height = H * d; sx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    // Drohnen-Schwarm schreibt DANKE
    const sw = $('#ay-swarm'), wx = sw.getContext('2d'); let SW = 0, SH = 0, form = 0; const N = innerWidth < 760 ? 320 : 760; let pts = [];
    const swSize = () => { const r = sw.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); SW = r.width; SH = r.height; sw.width = SW * d; sw.height = SH * d; wx.setTransform(d, 0, 0, d, 0, 0);
      const o = document.createElement('canvas'), w = 400, h = 120; o.width = w; o.height = h; const g = o.getContext('2d'); g.fillStyle = '#fff'; g.font = '400 110px "Bebas Neue"'; try { g.letterSpacing = '16px'; } catch (e) {} g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DANKE', w / 2 + 8, h / 2 + 6);
      const dd = g.getImageData(0, 0, w, h).data, P = []; for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (dd[(y * w + x) * 4 + 3] > 120) P.push([x / w, y / h]);
      const mob = innerWidth < 760, bw = SW * (mob ? .55 : .5), bh = bw * h / w, ox = SW * (mob ? .22 : .06), oy = SH * (mob ? .1 : .12); pts = Array.from({ length: N }, (_, i) => { const p = P[(i * 7919) % P.length] || [Math.random(), Math.random()]; return { tx: ox + p[0] * bw, ty: oy + p[1] * bh, x: SW * .405 + (Math.random() - .5) * 10, y: SH * .31 + (Math.random() - .5) * 10, vx: 0, vy: 0, k: .05 + Math.random() * .05, c: i % 4 ? '#d6ec5a' : '#3fe0ff' }; }); };
    let t = 0;
    const loop = () => {
      if (!vis) return; t += .016;
      sx.clearRect(0, 0, W, H);
      for (const s of stars) { const tw = .5 + .5 * Math.sin(t * 2 + s.t); const x = s.x * W, y = ((s.y + warp * t * .02 * s.z) % 1) * H * .82; sx.globalAlpha = .25 + .6 * tw * s.z; sx.fillStyle = '#e8f3ff'; if (warp > .05) { sx.fillRect(x, y, 1.2, 2 + warp * 26 * s.z); } else { sx.fillRect(x, y, 1.4 * s.z, 1.4 * s.z); } }
      sx.globalAlpha = 1;
      if (form > 0) { wx.clearRect(0, 0, SW, SH); wx.globalCompositeOperation = 'lighter';
        for (const p of pts) { const hx = p.x + (p.tx - p.x), hy = p.ty + Math.sin(t * 3 + p.tx) * 1.2; p.vx = (p.vx + (hx - p.x) * p.k * form) * .84; p.vy = (p.vy + (hy - p.y) * p.k * form) * .84; p.x += p.vx; p.y += p.vy; wx.fillStyle = p.c; wx.globalAlpha = .22; wx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); wx.globalAlpha = 1; wx.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); }
        wx.globalCompositeOperation = 'source-over'; }
      requestAnimationFrame(loop);
    };
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) { if (!pts.length) swSize(); loop(); } }, { threshold: .01 }).observe(pin);
    addEventListener('resize', () => pts.length && swSize());
    let cur = -1;
    const setBeat = i => { if (i === cur) return; cur = i; step.textContent = i + 1; title.textContent = BEATS[i][0]; sub.textContent = BEATS[i][1]; if (window.gsap && !RM) gsap.fromTo([title, sub], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .5, stagger: .06, overwrite: true }); };
    setBeat(0);
    const hello = $('.ay-hello'), rock = $('.ay-rock'), thr = $('.ay-thrust'), tools = $('.ay-tools'), jug = $('.ay-jug'), dir = $('.ay-dir'), fpv = $('.ay-fpv'), quad = $('.ay-quad'), gs = $$('.g', gear);
    if (!window.gsap || !window.ScrollTrigger || RM) { dir.style.opacity = 1; end.style.opacity = 1; end.style.visibility = 'visible'; setBeat(5); return; }
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    // 1 · Hallo
    tl.addLabel('b1').fromTo(hello, { opacity: 0, xPercent: 60, rotate: 12 }, { opacity: 1, xPercent: 0, rotate: 0, duration: 1, ease: 'back.out(1.6)' })
      .to(hello, { rotate: -6, duration: .4, yoyo: true, repeat: 1 })
    // 2 · Abheben auf dem Felsen
      .addLabel('b2', '+=.2').to(hello, { xPercent: 80, opacity: 0, duration: .5 }, 'b2')
      .fromTo(rock, { opacity: 0, yPercent: 90 }, { opacity: 1, yPercent: 10, duration: .8 }, '<.1')
      .to(thr, { opacity: 1, duration: .2 })
      .to(rock, { yPercent: -18, duration: 1.2, ease: 'power1.in' }, '<')
      .to({}, { duration: 1.2, onUpdate() { warp = this.progress() * 1.2; } }, '<')
    // 3 · Werkzeuge verteilen
      .addLabel('b3').to(rock, { yPercent: -160, opacity: 0, duration: .7, ease: 'power3.in' }, 'b3')
      .to({}, { duration: .7, onUpdate() { warp = 1.2 * (1 - this.progress()); } }, '<')
      .fromTo(tools, { opacity: 0, y: 80, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .7, ease: 'back.out(1.4)' }, '-=.2');
    gs.forEach((g, i) => {
      const ang = (-150 + i * 34) * Math.PI / 180, r = innerWidth < 760 ? 140 : 230;
      tl.fromTo(g, { opacity: 0, x: 0, y: 0, scale: .3, rotate: -40 }, { opacity: 1, x: Math.cos(ang) * r, y: Math.sin(ang) * r * .7, scale: 1, rotate: 0, duration: .55, ease: 'back.out(1.8)' }, i ? '<.12' : '+=.05');
    });
    // 4 · Jonglieren, Werkzeuge kreisen
    tl.addLabel('b4', '+=.4').to(gs, { opacity: 0, scale: .6, duration: .4, stagger: .04 }, 'b4')
      .to(tools, { opacity: 0, y: 40, duration: .4 }, '<')
      .fromTo(jug, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: .6, ease: 'back.out(1.4)' }, '<.2')
      .to(jug, { rotate: 4, duration: .5, yoyo: true, repeat: 3, ease: 'sine.inOut' })
    // 5 · Dirigent und Schwarm
      .addLabel('b5').to(jug, { opacity: 0, y: 40, duration: .3 }, 'b5')
      // Unser eigener FPV-Alien mit Brille, der Kopter kreist um ihn
      .fromTo(fpv, { opacity: 0, y: 60, scale: .85 }, { opacity: 1, y: 0, scale: 1, duration: .6, ease: 'back.out(1.6)' }, '<.2')
      .fromTo(quad, { opacity: 0, x: -260, y: 120, rotate: -30 }, { opacity: 1, x: 0, y: 0, rotate: 0, duration: .7, ease: 'power2.out' }, '<.2')
      .to(quad, { motionPath: { path: [{ x: 120, y: -60 }, { x: 200, y: 40 }, { x: 60, y: 110 }, { x: -80, y: 30 }, { x: 0, y: 0 }], curviness: 1.4, autoRotate: false }, rotate: 360, duration: 1.6, ease: 'none' })
      .to([fpv, quad], { opacity: 0, y: 40, duration: .35 })
      .addLabel('b6')
      .fromTo(dir, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: .6, ease: 'back.out(1.4)' }, 'b6')
      .to(sw, { opacity: 1, duration: .3 }, '<')
      .to({}, { duration: .7, onUpdate() { form = Math.min(1, this.progress() * 1.6); } }, '<')
      .to(dir, { rotate: -5, duration: .3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<')
      .to(end, { autoAlpha: 1, duration: .6 }, '+=.2')
      .to(sw, { opacity: .25, duration: .6 }, '<').to('.ay-copy', { opacity: 0, duration: .4 }, '<');
    const total = tl.duration(); tl.pause();
    const marks = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(l => tl.labels[l] / total);
    ScrollTrigger.create({ trigger: sec, pin: pin, start: 'top top', end: () => '+=' + innerHeight * 5, scrub: 1, animation: tl,
      onUpdate: st => { let i = 0; marks.forEach((m, k) => { if (st.progress >= m) i = k; }); setBeat(i); hint.style.opacity = st.progress > .9 ? 0 : ''; } });
    ScrollTrigger.sort(); ScrollTrigger.refresh();
    window.__ay = () => ({ form, pts: pts.length, SW, SH });
  }
  document.addEventListener('fcs:ready', () => setTimeout(ay, 60), { once: true });
})();
