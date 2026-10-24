/* Mitglied werden: Schritt-Antrag, U18, IBAN-Prüfung, Unterschrift, Mitgliedskarte */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let step = 1; const N = 5; let sigDirty = false;
  const form = () => $('#antragform');

  function age() { const v = $('#a-geb').value; if (!v) return null; const b = new Date(v), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
  function u18() {
    const a = age(), y = a !== null && a < 18;
    $('#a-u18').hidden = !y; $('#u18-sig').hidden = !y;
    const r = $$('input[name=Mitgliedschaft]'); if (a !== null) r[y ? 1 : 0].checked = true;
    summary();
  }
  function summary() {
    const jung = $$('input[name=Mitgliedschaft]')[1].checked, b = D.verein.beitrag;
    const jb = jung ? b.u18 : b.erwachsen;
    $('#sum').innerHTML = `<div class="sum-row"><span>Aufnahmebeitrag (einmalig)</span><b>${b.aufnahme},00 €</b></div><div class="sum-row"><span>Jahresbeitrag ${jung ? 'unter 18' : ''}</span><b>${jb},00 €</b></div><div class="sum-row tot"><span>Zusammen</span><b>${b.aufnahme + jb},00 €</b></div>`;
  }
  function pay() {
    const sepa = $$('input[name=Zahlungsart]')[0].checked;
    $('#sepa').hidden = !sepa; $('#ueber').hidden = sepa;
    $$('[data-sepa]').forEach(i => { if (i.id === 'a-bank') return; sepa ? i.setAttribute('required', '') : i.removeAttribute('required'); });
  }
  function iban() {
    const i = $('#a-iban'), ok = $('#iban-ok');
    i.addEventListener('input', () => {
      const raw = i.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), pos = i.selectionStart;
      i.value = raw.replace(/(.{4})/g, '$1 ').trim();
      const good = raw.length >= 15 && FCS.checks.iban(raw);
      ok.textContent = raw.length < 15 ? '' : good ? '✓ IBAN geprüft' : 'Prüfziffer passt nicht';
      ok.className = 'iban-ok' + (good ? ' good' : '');
      if (good) i.closest('.field').classList.remove('bad');
    });
  }

  /* ---------- Schritte ---------- */
  function go(to) {
    const cur = $(`.step[data-step="${step}"]`);
    if (to > step && !FCS.validate(cur)) return;
    if (to > step && step === 5) return;
    step = Math.max(1, Math.min(N, to));
    $$('.step').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
    $$('#steps li').forEach((l, i) => { l.classList.toggle('on', i + 1 === step); l.classList.toggle('ok', i + 1 < step); });
    $('#prog').style.width = (step / N * 100) + '%';
    $('#prev').hidden = step === 1; $('#next').hidden = step === N; $('#submit').hidden = step !== N;
    if (step === 5) { review(); sizeSig(); }
    const nxt = $(`.step[data-step="${step}"]`);
    if (window.gsap && !RM) gsap.fromTo(nxt, { x: to >= step ? 40 : -40, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: 'expo.out' });
    const top = $('#antrag'); FCS.lenis ? FCS.lenis.scrollTo(top, { offset: -60 }) : top.scrollIntoView();
  }
  function review() {
    const f = form(), fd = new FormData(f), skip = ['_subject', '_honey', 'Formular'];
    const rows = []; const seen = {};
    for (const [k, v] of fd.entries()) { if (skip.includes(k) || v instanceof Blob || !String(v).trim()) continue; if (k === 'IBAN') { rows.push([k, v.slice(0, 4) + ' •••• •••• ' + v.slice(-4)]); continue; } if (seen[k]) { seen[k][1] += ', ' + v; continue; } const r = [k, String(v)]; seen[k] = r; rows.push(r); }
    $('#review').innerHTML = rows.filter(r => !/einverstanden|anerkannt|Risiko|richtig|Datenschutz/.test(r[0])).map(([k, v]) => `<div><span>${k}</span><b>${v.replace(/</g, '&lt;')}</b></div>`).join('');
  }

  /* ---------- Unterschrift ---------- */
  let cv, cx, drawing = false, last = null;
  function sizeSig() {
    if (!cv) return; const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    if (!r.width) return; const old = sigDirty ? cv.toDataURL() : null;
    cv.width = r.width * d; cv.height = r.height * d; cx.setTransform(d, 0, 0, d, 0, 0);
    cx.lineWidth = 2.6; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#0b1a33';
    if (old) { const im = new Image(); im.onload = () => cx.drawImage(im, 0, 0, r.width, r.height); im.src = old; }
  }
  function sig() {
    cv = $('#sig-cv'); cx = cv.getContext('2d'); const box = $('#sig');
    const line = document.createElement('i'); line.className = 'sig-line'; box.appendChild(line);
    const p = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => { drawing = true; last = p(e); cv.setPointerCapture(e.pointerId); $('#sig-hint').style.opacity = 0; });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const q = p(e); cx.beginPath(); cx.moveTo(last.x, last.y); const mx = (last.x + q.x) / 2, my = (last.y + q.y) / 2; cx.quadraticCurveTo(last.x, last.y, mx, my); cx.lineTo(q.x, q.y); cx.stroke(); last = q; sigDirty = true; box.classList.remove('bad'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, () => drawing = false));
    $('#sig-x').addEventListener('click', () => { cx.clearRect(0, 0, cv.width, cv.height); sigDirty = false; $('#sig-hint').style.opacity = 1; });
    addEventListener('resize', sizeSig);
  }
  const sigBlob = () => {
    // Unterschrift auf weißem Grund, synchron als PNG-Blob
    const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height); c.drawImage(cv, 0, 0);
    const bin = atob(o.toDataURL('image/png').split(',')[1]), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: 'image/png' });
  };

  /* ---------- Mitgliedskarte ---------- */
  function card(name, alias) {
    const c = $('#mycard'), x = c.getContext('2d'), W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#24569a'); g.addColorStop(.6, '#0b1f40'); g.addColorStop(1, '#071225');
    x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, 40) : x.rect(0, 0, W, H); x.fill();
    const r1 = x.createRadialGradient(W, 0, 0, W, 0, W * .7); r1.addColorStop(0, 'rgba(63,224,255,.38)'); r1.addColorStop(1, 'rgba(63,224,255,0)'); x.fillStyle = r1; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 3; for (let i = -H; i < W; i += 22) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H * .5, 0); x.stroke(); }
    const logo = new Image(); logo.onload = () => {
      x.drawImage(logo, 60, 50, 120, 120);
      x.fillStyle = '#cfe5ff'; x.font = '600 26px "Chakra Petch"'; x.textAlign = 'right'; x.fillText('MITGLIEDSKARTE', W - 60, 90); x.fillStyle = '#fff'; x.font = '700 54px "Chakra Petch"'; x.fillText('2026', W - 60, 150);
      x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '700 64px "Chakra Petch"'; x.fillText(name.toUpperCase().slice(0, 26), 60, H - 190);
      x.fillStyle = '#3fe0ff'; x.font = '500 36px "Chakra Petch"'; x.fillText(alias || 'Pilot im Flight Club Saar', 60, H - 135);
      x.fillStyle = '#a9c3e4'; x.font = '600 24px "Chakra Petch"'; x.fillText('FLIGHT CLUB SAAR E. V.', 60, H - 60); x.textAlign = 'right'; x.fillText('NR. FOLGT', W - 60, H - 60);
    };
    logo.src = 'assets/img/logo-mark.svg';
    $('#dl-card').onclick = () => { const a = document.createElement('a'); a.download = 'Mitgliedskarte_Flight_Club_Saar.png'; a.href = c.toDataURL('image/png'); a.click(); };
    if (window.gsap && !RM) gsap.fromTo(c, { rotateY: -70, rotateX: 20, opacity: 0, scale: .8 }, { rotateY: 0, rotateX: 0, opacity: 1, scale: 1, duration: 1.6, ease: 'expo.out' });
  }

  function init() {
    const f = form(); if (!f) return;
    const today = new Date().toISOString().slice(0, 10);
    $('#a-udat').value = today;
    $('#a-ein').value = today;
    $('#glid').textContent = D.verein.glaeubigerId;
    $('#a-geb').addEventListener('change', u18);
    $$('input[name=Mitgliedschaft]').forEach(i => i.addEventListener('change', summary));
    $$('input[name=Zahlungsart]').forEach(i => i.addEventListener('change', pay));
    $$('input[name=Drohnenführerschein]').forEach(i => i.addEventListener('change', () => $('#a-fs-s').hidden = i.value !== 'Sonstige' || !i.checked));
    $$('input[name=Haftpflicht]').forEach(i => i.addEventListener('change', () => { const ja = $$('input[name=Haftpflicht]')[1].checked; $('#a-vers').hidden = !ja; $('#a-novers').hidden = ja; }));
    $('#next').addEventListener('click', () => go(step + 1));
    $('#prev').addEventListener('click', () => go(step - 1));
    summary(); pay(); iban(); sig();
    // Ohne Unterschrift bei Lastschrift kein Absenden
    f.addEventListener('submit', e => {
      if (!sigDirty) { e.stopImmediatePropagation(); e.preventDefault(); $('#sig').classList.add('bad'); return; }
    }, true);
    f._extra = () => (sigDirty ? { Unterschrift: sigBlob() } : {});
    f.addEventListener('fcs:sent', () => {
      const name = `${$('#a-vn').value} ${$('#a-nn').value}`.trim(), alias = $('#a-alias').value.trim();
      f.hidden = true; $('#steps').hidden = true; $('.progress').hidden = true; $('#welcome').hidden = false; card(name, alias);
      FCS.lenis ? FCS.lenis.scrollTo('#antrag', { offset: -60 }) : $('#antrag').scrollIntoView();
    });
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
