/* Mitglied werden: Schritt-Antrag mit Fortschritt und klaren Fehlern, U18, IBAN-Prüfung, Unterschrift,
   Live-Mitgliedskarte beim Tippen und fertige Karte nach dem Absenden. */
(function () {
  'use strict';
  const D = FCS.data, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 5, NAMES = ['Über dich', 'Mitgliedschaft und Fliegen', 'Erklärungen', 'Beitrag bezahlen', 'Prüfen und unterschreiben'];
  let step = 1, reached = 1, sigDirty = false;
  const form = () => $('#antragform');
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function age() { const v = $('#a-geb').value; if (!v) return null; const b = new Date(v), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
  function u18() {
    const a = age(), y = a !== null && a < 18;
    $('#a-u18').hidden = !y; $('#u18-sig').hidden = !y;
    const r = $$('input[name=Mitgliedschaft]'); if (a !== null) r[y ? 1 : 0].checked = true;
    summary();
  }
  function summary() {
    const jung = $$('input[name=Mitgliedschaft]')[1].checked, b = D.verein.beitrag;
    const jb = jung ? b.u18 : b.erwachsen, alt = !!($$('input[name=Aufnahme]')[1] || {}).checked, auf = alt ? 0 : b.aufnahme;
    $('#sum').innerHTML = `<div class="sum-row"><span>Aufnahmebeitrag (einmalig)</span><b>${alt ? 'entfällt' : auf + ',00 €'}</b></div><div class="sum-row"><span>Jahresbeitrag${jung ? ' unter 18' : ''}</span><b>${jb},00 €</b></div><div class="sum-row tot"><span>Zusammen</span><b>${auf + jb},00 €</b></div>`;
  }
  function pay() {
    const sepa = $$('input[name=Zahlungsart]')[0].checked;
    $('#sepa').hidden = !sepa; $('#ueber').hidden = sepa;
    $$('[data-sepa]').forEach(i => { if (i.id === 'a-bank') return; sepa ? i.setAttribute('required', '') : i.removeAttribute('required'); if (!sepa) { const f = i.closest('.field'); if (f) f.classList.remove('bad'); } });
  }
  function iban() {
    const i = $('#a-iban'), ok = $('#iban-ok');
    i.addEventListener('input', () => {
      const raw = i.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      i.value = raw.replace(/(.{4})/g, '$1 ').trim();
      const de = raw.startsWith('DE'), len = de ? 22 : 15, good = raw.length >= 15 && FCS.checks.iban(raw);
      ok.textContent = !raw ? '' : good ? '✓ IBAN geprüft' : raw.length < len ? `${raw.length} von ${de ? 22 : 'mindestens 15'} Zeichen` : 'Prüfziffer passt nicht. Bitte noch einmal vergleichen.';
      ok.className = 'iban-ok' + (good ? ' good' : raw.length >= len ? ' warn' : '');
      if (good) i.closest('.field').classList.remove('bad');
    });
  }

  /* ---------- Schritte ---------- */
  const label = (el) => {
    const fld = el.closest('.field'), chk = el.closest('.check');
    if (chk) { const t = chk.querySelector('span').textContent; return /Satzung/.test(t) ? 'Satzung' : /Risiko/.test(t) ? 'eigenes Risiko' : /personenbezogen/.test(t) ? 'Datenschutz' : 'Angaben zu Führerschein und Versicherung'; }
    const l = fld && (fld.querySelector('label') || fld.querySelector('.lbl'));
    return l ? l.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : el.name;
  };
  function check(scope) {
    // Auch Felder im zugeklappten Bereich prüfen und den Bereich dann öffnen
    $$('details', scope).forEach(d => { if ($$('[required]', d).some(i => !i.checkValidity() || !String(i.value).trim())) d.open = true; });
    let ok = FCS.validate(scope);
    $$('.check', scope).forEach(c => { const i = c.querySelector('input[required]'); if (i) c.classList.toggle('bad', !i.checked); });
    if (+scope.dataset.step === 5 && !sigDirty) { $('#sig').classList.add('bad'); if (ok) { ok = false; FCS.scrollTo($('#sig'), -160); } }
    const bad = [...new Set($$('.field.bad [required], .check.bad input', scope).map(label))];
    if (+scope.dataset.step === 5 && !sigDirty) bad.push('Unterschrift');
    const sum = $('#errsum');
    if (bad.length) {
      sum.innerHTML = `<b>Fast geschafft.</b> Bitte prüf noch ${bad.length === 1 ? 'dieses Feld' : `diese ${bad.length} Felder`}: ${bad.map(esc).join(', ')}.`;
      sum.hidden = false; if (window.gsap && !RM) gsap.fromTo(sum, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)' });
    } else sum.hidden = true;
    return ok && !bad.length;
  }
  function go(to) {
    to = Math.max(1, Math.min(N, to));
    // Vorwärts: jeden Schritt bis zum Ziel prüfen und beim ersten mit Lücken stehen bleiben
    const quiet = (el) => $$('[required]', el).every(i => i.type === 'checkbox' ? i.checked : i.checkValidity() && String(i.value).trim() !== '' && (!i.dataset.check || FCS.checks[i.dataset.check](i.value)));
    for (let s = step; s < to; s++) {
      const el = $(`.step[data-step="${s}"]`);
      if (s === step ? !check(el) : !quiet(el)) { if (s !== step) { show(s); check(el); } return; }
    }
    $('#errsum').hidden = true;
    show(to);
  }
  function show(to) {
    const from = step; step = to; reached = Math.max(reached, step);
    $$('.step').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
    $$('#steps li').forEach((l, i) => {
      const b = $('button', l), n = i + 1;
      l.classList.toggle('on', n === step); l.classList.toggle('ok', n < step || (n <= reached && n !== step));
      b.disabled = n > reached; n === step ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current');
    });
    $('#prog').style.transform = `scaleX(${step / N})`;
    $('#step-now').textContent = `Schritt ${step} von ${N} · ${NAMES[step - 1]}`;
    $('#prev').hidden = step === 1; $('#next').hidden = step === N; $('#submit').hidden = step !== N;
    if (step === 5) { review(); sizeSig(); }
    const nxt = $(`.step[data-step="${step}"]`);
    if (window.gsap && !RM && from !== step) gsap.fromTo(nxt, { x: step > from ? 40 : -40, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: 'expo.out', clearProps: 'transform' });
    // Nur hochscrollen, wenn der Anfang des Antrags nicht zu sehen ist
    const top = $('#steps'); if (from !== step && top.getBoundingClientRect().top < 60) FCS.scrollTo(top, -110);
    const first = nxt.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox])');
    if (from !== step && first && step < 5 && !first.value && matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus({ preventScroll: true }), 300);
  }
  function review() {
    const f = form(), fd = new FormData(f), skip = ['_subject', '_honey', 'Formular'];
    const rows = []; const seen = {};
    for (const [k, v] of fd.entries()) { if (skip.includes(k) || v instanceof Blob || !String(v).trim()) continue; if (/Unterschrift/.test(k)) continue; if (k === 'IBAN') { const q = String(v).replace(/\s/g, ''); rows.push([k, q.slice(0, 4) + ' •••• •••• ' + q.slice(-4)]); continue; } if (seen[k]) { seen[k][1] += ', ' + v; continue; } const r = [k, String(v)]; seen[k] = r; rows.push(r); }
    const fmtD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('.') : v;
    $('#review').innerHTML = rows.filter(r => !/einverstanden|anerkannt|Risiko|richtig|Datenschutz/.test(r[0])).map(([k, v]) => `<div><span>${esc(k === 'email' ? 'E-Mail' : k)}</span><b>${esc(fmtD(v))}</b></div>`).join('') +
      '<p class="rv-edit">Etwas falsch? Tipp oben auf einen Schritt, um ihn zu ändern.</p>';
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
    cv.addEventListener('pointermove', e => { if (!drawing) return; const q = p(e); cx.beginPath(); cx.moveTo(last.x, last.y); const mx = (last.x + q.x) / 2, my = (last.y + q.y) / 2; cx.quadraticCurveTo(last.x, last.y, mx, my); cx.lineTo(q.x, q.y); cx.stroke(); last = q; if (!sigDirty) { sigDirty = true; box.classList.remove('bad'); } });
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

  /* ---------- Mitgliedskarte (Vorschau beim Tippen und fertige Karte) ---------- */
  const LOGO = new Image(); let logoOk = false; const waitLogo = new Promise(r => { LOGO.onload = () => { logoOk = true; r(); }; LOGO.onerror = r; }); LOGO.src = 'assets/img/logo-mark.svg';
  function draw(c, name, alias, ph, nr) {
    const x = c.getContext('2d'), W = c.width, H = c.height;
    x.clearRect(0, 0, W, H); x.save();
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, 40) : x.rect(0, 0, W, H); x.clip();
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#24569a'); g.addColorStop(.6, '#0b1f40'); g.addColorStop(1, '#071225');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r1 = x.createRadialGradient(W, 0, 0, W, 0, W * .7); r1.addColorStop(0, 'rgba(63,224,255,.38)'); r1.addColorStop(1, 'rgba(63,224,255,0)'); x.fillStyle = r1; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 3; for (let i = -H; i < W; i += 22) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H * .5, 0); x.stroke(); }
    if (logoOk) x.drawImage(LOGO, 60, 50, 120, 120);
    x.fillStyle = '#cfe5ff'; x.font = '600 26px "Chakra Petch"'; x.textAlign = 'right'; x.fillText('MITGLIEDSKARTE', W - 60, 90); x.fillStyle = '#fff'; x.font = '700 54px "Chakra Petch"'; x.fillText(String(new Date().getFullYear()), W - 60, 150);
    x.textAlign = 'left'; x.globalAlpha = ph && ph.n ? .45 : 1; x.fillStyle = '#fff'; x.font = '700 64px "Chakra Petch"'; x.fillText(name.toUpperCase().slice(0, 26), 60, H - 190);
    x.globalAlpha = ph && ph.a ? .45 : 1; x.fillStyle = '#3fe0ff'; x.font = '500 36px "Chakra Petch"'; x.fillText((alias || 'Pilot im Flight Club Saar').slice(0, 34), 60, H - 135);
    x.globalAlpha = 1; x.fillStyle = '#a9c3e4'; x.font = '600 24px "Chakra Petch"'; x.fillText('FLIGHT CLUB SAAR E. V.', 60, H - 60); x.textAlign = 'right'; x.fillText(nr ? 'NR. ' + nr : 'NR. FOLGT', W - 60, H - 60);
    x.restore();
  }
  function live() {
    const c = $('#livecard'); if (!c) return;
    const vn = $('#a-vn'), nn = $('#a-nn'), al = $('#a-alias');
    let raf = 0;
    const upd = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const n = `${vn.value} ${nn.value}`.trim(); draw(c, n || 'Dein Name', al.value.trim() || (n ? '' : 'Dein Pilotenname'), { n: !n, a: !al.value.trim() && !n }); }); };
    [vn, nn, al].forEach(i => i.addEventListener('input', upd));
    Promise.all([waitLogo, document.fonts ? document.fonts.ready : null]).then(upd);
    // Selbst-Impuls: die Karte schwebt leicht, bis jemand den Antrag beginnt; läuft nur, solange sie zu sehen ist
    const box = $('#mg-live');
    if (!RM && 'IntersectionObserver' in window) new IntersectionObserver(es => box.classList.toggle('float', es[0].isIntersecting)).observe(box);
    if (!RM && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); box.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 16 + 'deg'); box.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 12 + 'deg'); box.classList.add('hold'); });
      box.addEventListener('pointerleave', () => { box.style.setProperty('--ry', '0deg'); box.style.setProperty('--rx', '0deg'); box.classList.remove('hold'); });
    }
  }
  function card(name, alias, nr) {
    const c = $('#mycard');
    const run = () => draw(c, name, alias, null, nr);
    Promise.all([waitLogo, document.fonts ? document.fonts.ready : null]).then(run); run();
    // Speichern (Natan 29.10.: „klappt nicht mit der Mitgliedskarte“): ein riesiger Daten-Link wird auf dem iPhone und in WhatsApp-/Instagram-Browsern
    // nicht heruntergeladen. Jetzt als Datei: auf dem Handy über „Teilen“ (Fotos sichern), sonst normaler Download, und als letzter Weg das Bild in groß zum Gedrückthalten.
    const fn = `Mitgliedskarte_Flight_Club_Saar${nr ? '_' + nr : ''}.png`;
    $('#dl-card').onclick = async () => {
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], fn, { type: 'image/png' });
      const touch = matchMedia('(pointer:coarse)').matches;
      if (touch && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Meine Mitgliedskarte' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      const url = URL.createObjectURL(blob);
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent);
      if (!inApp && 'download' in HTMLAnchorElement.prototype) { const a = document.createElement('a'); a.download = fn; a.href = url; document.body.appendChild(a); a.click(); a.remove(); }
      // Sichtbarer Ersatz: Bild zum Gedrückthalten („Bild sichern“), funktioniert überall
      let box = $('#card-save');
      if (!box) { box = document.createElement('div'); box.id = 'card-save'; box.className = 'card-save'; c.closest('.welcome-card').after(box); }
      box.innerHTML = `<p class="hint">${touch ? 'Falls nichts gespeichert wurde: Bild gedrückt halten und „Bild sichern“ oder „In Fotos sichern“ wählen.' : 'Falls der Download nicht startet: Rechtsklick aufs Bild und „Bild speichern unter“.'}</p><img src="${url}" alt="Deine Mitgliedskarte als Bild" width="1012" height="638">`;
    };
    if (window.gsap && !RM) gsap.fromTo(c, { rotateY: -70, rotateX: 20, opacity: 0, scale: .8 }, { rotateY: 0, rotateX: 0, opacity: 1, scale: 1, duration: 1.6, ease: 'expo.out' });
  }

  function init() {
    const f = form(); if (!f) return;
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    $('#a-udat').value = today;
    $('#a-ein').value = today;
    $('#a-geb').max = today; $('#a-geb').min = '1900-01-01';
    $('#glid').textContent = D.verein.glaeubigerId;
    if (D.verein.iban) $('#v-iban').textContent = D.verein.iban;
    if (D.verein.bic) $('#v-bic').textContent = D.verein.bic;
    // Fragen direkt per WhatsApp an den Vorstand (Nummern aus den Vereinsdaten)
    const wa = $('#mg-wa');
    if (wa) wa.innerHTML = (D.kontakte || []).filter(k => k.wa).map(k => `<a class="btn ghost" href="https://wa.me/${encodeURIComponent(k.wa)}?text=${encodeURIComponent(`Hallo ${k.name}, ich habe eine Frage zur Mitgliedschaft im Flight Club Saar: `)}" target="_blank" rel="noopener">WhatsApp an ${esc(k.name)}<small>${esc(k.rolle || '')}</small></a>`).join('');
    $('#a-geb').addEventListener('change', u18);
    $$('input[name=Mitgliedschaft], input[name=Aufnahme]').forEach(i => i.addEventListener('change', summary));
    $$('input[name=Zahlungsart]').forEach(i => i.addEventListener('change', pay));
    $$('input[name=Drohnenführerschein]').forEach(i => i.addEventListener('change', () => $('#a-fs-s').hidden = !$('input[name=Drohnenführerschein][value=Sonstige]').checked));
    $$('input[name=Haftpflicht]').forEach(i => i.addEventListener('change', () => { const ja = $$('input[name=Haftpflicht]')[1].checked; $('#a-vers').hidden = !ja; $('#a-novers').hidden = ja; }));
    $('#next').addEventListener('click', () => go(step + 1));
    $('#prev').addEventListener('click', () => go(step - 1));
    $$('#steps button').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.go; if (n < step) go(n); else if (n > step) go(n); }));
    // Fehler verschwinden, sobald das Feld stimmt
    f.addEventListener('input', e => { const fl = e.target.closest('.field'); if (fl && fl.classList.contains('bad') && e.target.checkValidity() && String(e.target.value).trim() && (!e.target.dataset.check || FCS.checks[e.target.dataset.check](e.target.value))) fl.classList.remove('bad'); });
    f.addEventListener('change', e => { const c = e.target.closest('.check'); if (c && e.target.checked) c.classList.remove('bad'); });
    summary(); pay(); iban(); sig(); live();
    // Enter in einem Feld blättert weiter statt den ganzen Antrag abzuschicken; im letzten Schritt alles prüfen
    f.addEventListener('submit', e => {
      if (step < N) { e.stopImmediatePropagation(); e.preventDefault(); go(step + 1); return; }
      if (!check($('.step[data-step="5"]'))) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
    // FormSubmit hängt bei Formularen über JavaScript keine Dateien an. Die Unterschrift geht deshalb als kleines Bild in Textform mit (29.10. getestet)
    const sigData = () => { const w = 360, h = Math.round(360 * cv.height / cv.width) || 120, o = document.createElement('canvas'); o.width = w; o.height = h; const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(cv, 0, 0, w, h); return o.toDataURL('image/jpeg', .6); };
    const jetzt = () => new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    // Wortlaut des Lastschriftmandats geht mit, damit der Verein das unterschriebene Mandat vollständig in der Mail hat
    const mandat = () => { const on = $$('input[name=Zahlungsart]')[0].checked, m = $('#sepa .mandate'); return on && m ? { 'SEPA-Lastschriftmandat (Wortlaut, mit Unterschrift erteilt)': [...m.querySelectorAll('p')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ') } : {}; };
    f._extra = () => (sigDirty ? { ...mandat(), Unterschrift: 'Auf der Website mit Finger oder Maus unterschrieben am ' + jetzt(), 'Unterschrift (Bild, auch als Anhang)': sigData() } : mandat());
    // Sicherheitsnetz: Nimmt der Mailweg den Unterschrift-Anhang nicht an, geht der Antrag ohne Bild raus
    // und der Vorstand liest in der Mail, dass die Unterschrift nachgeholt werden muss
    // Fortlaufende Mitgliedsnummer (Natan 29.10.): vergibt Make-Szenario 8247590 aus dem Zähler im Datenspeicher 231679 (Schlüssel mnr_zaehler).
    // Die Nummer wird einmal je Antrag geholt und gemerkt, damit ein zweiter Sendeversuch keine neue Nummer verbraucht.
    let NR = null;
    const nummer = async () => {
      if (NR) return NR;
      const name = `${$('#a-vn').value} ${$('#a-nn').value}`.trim(), email = $('#a-mail').value.trim();
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
        const res = await fetch('https://hook.eu1.make.com/y0gnyfjkjx18fylupyyxdnphy24kk2d8', { method: 'POST', body: new URLSearchParams({ name, email }), signal: ctl.signal, credentials: 'omit' });
        clearTimeout(t);
        const j = await res.json();
        if (j && j.ok && /^\d{3,}$/.test(j.nr)) NR = j;
      } catch (e) {}
      return NR;
    };
    const send0 = FCS.send;
    FCS.send = async (form, extra = {}) => {
      if (form === f) {
        const n = await nummer(), name = `${$('#a-vn').value} ${$('#a-nn').value}`.trim(), sepaOn = $$('input[name=Zahlungsart]')[0].checked;
        const subj = f.querySelector('[name=_subject]');
        const mk = 'SEPA-Lastschriftmandat (Wortlaut, mit Unterschrift erteilt)';
        if (n) {
          subj.value = `Mitgliedsantrag ${n.nr} – ${name} (Flight Club Saar)`;
          extra = { Mitgliedsnummer: n.nr, ...(sepaOn ? { Mandatsreferenz: n.mandat } : {}), ...extra };
          if (extra[mk]) extra[mk] = extra[mk].replace('Mandatsreferenz: wird beim Absenden fortlaufend vergeben', 'Mandatsreferenz: ' + n.mandat);
        } else {
          subj.value = `Mitgliedsantrag – ${name} – Nummer bitte vergeben (Flight Club Saar)`;
          extra = { Mitgliedsnummer: 'Konnte nicht automatisch vergeben werden. Bitte die nächste freie Nummer vergeben (Make-Datenspeicher „FCS Clip-Studio“, Schlüssel mnr_zaehler).', ...extra };
        }
      }
      let r = await send0(form, extra).catch(() => ({ ok: false }));
      if (!r.ok && form === f && extra.Unterschrift) try { const ohne = { ...extra }; delete ohne['Unterschrift (Bild, auch als Anhang)']; ohne.Unterschrift = 'Das Bild der Unterschrift konnte nicht angehängt werden, bitte beim Vorstand persönlich nachholen'; r = await send0(form, ohne); } catch (e) { r = { ok: false }; }
      return r;
    };
    f.addEventListener('fcs:sent', () => {
      const name = `${$('#a-vn').value} ${$('#a-nn').value}`.trim(), alias = $('#a-alias').value.trim();
      $('.mg-grid').hidden = true; $('#antrag .mg-sh').hidden = true; $('#welcome').hidden = false; card(name, alias, NR && NR.nr);
      const wl = $('#welcome .lede');
      if (wl) wl.textContent = NR && NR.bekannt ? `Du bist bei uns schon mit der Mitgliedsnummer ${NR.nr} eingetragen, die bleibt deine. Der Vorstand gleicht deinen Antrag ab und meldet sich bei dir. Hier ist deine Mitgliedskarte.` : NR ? `Deine vorläufige Mitgliedsnummer ist ${NR.nr}${$$('input[name=Zahlungsart]')[0].checked ? `, deine Mandatsreferenz ${NR.mandat}` : ''}. Fest wird sie, sobald dein Beitrag da ist: Dann bekommst du eine Mail mit der Bestätigung und deinem Mitgliedscode. Hier ist schon mal die Vorschau deiner Mitgliedskarte.` : 'Der Vorstand prüft deinen Antrag, vergibt deine Mitgliedsnummer und meldet sich bei dir. Hier ist schon mal die Vorschau deiner Mitgliedskarte.';
      FCS.scrollTo('#welcome', -90);
    });
  }
  document.addEventListener('fcs:ready', init, { once: true });
})();
