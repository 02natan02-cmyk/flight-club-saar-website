/* Spot-Karte: Regeln mit Haken (schaltet die Route-Knöpfe frei), Karte (Radar ohne fremde Server,
   Straßenkarte erst nach Klick), Spot-Liste mit Details und Bewerten, kurzes Formular „Spot melden“. */
(function () {
  'use strict';
  const D = (window.FCS && FCS.data) || {};
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOB = matchMedia('(max-width: 900px)');
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const S = D.spots || [], T = D.spotTypen || {};
  const KEY = 'fcs-spot-ok';
  const G = () => (window.gsap && !RM ? window.gsap : null);
  let filter = 'alle', current = S[0] ? S[0].id : null, touched = false;

  /* ---------- Hilfen ---------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const typ = s => T[s.typ] || { n: 'Spot', c: '#3fe0ff' };
  const vis = () => S.filter(s => filter === 'alle' || s.typ === filter);
  const byId = id => S.find(s => s.id === id);
  const go = (el, off) => (window.FCS && FCS.scrollTo ? FCS.scrollTo(el, off) : el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }));
  const IC = {
    route: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5M9 5h10v10"/></svg>',
    lock: '<svg class="ic ic-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    chev: '<svg class="ic ic-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
    wa: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z"/><path d="M9 9.5c.3 2.3 2.2 4.3 4.6 4.9l1.2-1.2 1.7.8-.5 1.6c-3.8.2-7.4-3.3-7.3-7.2l1.6-.5.8 1.7z"/></svg>'
  };
  const TYPIC = {
    halle: '<path d="M3 20V10l9-6 9 6v10"/><path d="M8 20v-6h8v6"/>',
    industrie: '<path d="M4 21V9l5 3V9l5 3V5h4v16z"/><path d="M8 17h2M13 17h2"/>',
    lost: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5l3-2 3 2v5M8 10l2 2M16 9l-3 3"/>',
    feld: '<path d="M3 18c4-3 14-3 18 0"/><path d="M7 15V9M12 14V6M17 15V9M5 11l2-2 2 2M10 8l2-2 2 2M15 11l2-2 2 2"/>',
    bando: '<path d="M4 21V7h6v4h4V5h6v16"/><path d="M8 15h1M15 9h1M15 14h1"/>'
  };
  const typIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${TYPIC[k] || TYPIC.halle}</svg>`;
  const starsHTML = s => {
    if (!s.stern) return `<span class="st-row is-empty" aria-hidden="true">${IC.star.repeat(5)}</span><span>Noch keine Bewertung</span>`;
    const n = Math.round(s.stern);
    return `<span class="st-row" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => i <= n ? IC.star.replace('<svg', '<svg class="on"') : IC.star).join('')}</span><span>${s.stern.toFixed(1).replace('.', ',')} von 5</span>`;
  };

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

  /* ---------- Flugvideos: Video-Links aus den Bewertungen (Feld link, höchstens 300 Zeichen) ----------
     YouTube lädt erst nach Klick über youtube-nocookie.com. Instagram, TikTok und andere bleiben Link-Karten (neuer Tab),
     weil deren Einbettung fremde Skripte lädt. Nur http(s), alles escaped, rel="noopener nofollow ugc". */
  const VP = {
    youtube: { n: 'YouTube', c: '#ff4b4b', svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>' },
    instagram: { n: 'Instagram', c: '#ff5fa2', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' },
    tiktok: { n: 'TikTok', c: '#3fe0ff', svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.9 5.9 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>' },
    facebook: { n: 'Facebook', c: '#5b9bff', svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1.3 1.3-1.3H17V2.5h-2.6C11.6 2.5 10 4.2 10 6.9v1.6H7.5v3.3H10v9.7h4v-9.7h2.7l.4-3.3z"/></svg>' },
    vimeo: { n: 'Vimeo', c: '#35c3f3', svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 7.4c-.1 2-1.5 4.7-4.2 8.1-2.8 3.6-5.1 5.4-7.1 5.4-1.2 0-2.2-1.1-3-3.3L6.1 11.7C5.5 9.5 4.9 8.4 4.2 8.4c-.1 0-.7.3-1.6 1L1.6 8.1l3-2.7c1.4-1.2 2.4-1.8 3-1.9 1.6-.2 2.6.9 3 3.4.4 2.6.7 4.2.9 4.8.5 2.1 1 3.2 1.5 3.2.4 0 1.1-.7 1.9-2 .9-1.4 1.3-2.4 1.4-3.1.1-1.2-.3-1.8-1.4-1.8-.5 0-1 .1-1.5.3 1-3.3 3-4.9 5.9-4.8 2.1.1 3.1 1.5 3 4.1z"/></svg>' },
    web: { n: 'Link', c: '#9db1cc', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/></svg>' }
  };
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
  const CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  // Eingabe säubern: ohne https:// davor wird es ergänzt, sonst nur http(s) mit echtem Hostnamen, höchstens 300 Zeichen
  function vidNorm(raw) {
    let t = String(raw || '').trim(); if (!t) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) { if (/^(\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|\?|$)/i.test(t)) t = 'https://' + t.replace(/^\/+/, ''); else return null; }
    let u; try { u = new URL(t); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return null;
    return u.href.length <= 300 ? u.href : null;
  }
  function vidParse(link) {
    const href = vidNorm(link); if (!href) return null;
    const u = new URL(href), h = u.hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, ''), p = u.pathname;
    const o = { href, k: 'web', yt: '', short: false, what: 'Video-Link', host: h };
    if (/^(youtube\.com|youtu\.be|youtube-nocookie\.com|music\.youtube\.com)$/.test(h)) {
      o.k = 'youtube'; o.short = /^\/shorts\//.test(p); o.what = o.short ? 'YouTube Short' : 'YouTube-Video';
      const m = h === 'youtu.be' ? p.match(/^\/([\w-]{11})/) : p.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      const id = m ? m[1] : (u.searchParams.get('v') || '');
      if (/^[\w-]{11}$/.test(id)) o.yt = id;
    } else if (/^(instagram\.com|instagr\.am)$/.test(h)) { o.k = 'instagram'; o.what = /^\/(reels?|tv)\//.test(p) ? 'Instagram-Reel' : 'Instagram-Beitrag'; }
    else if (/(^|\.)tiktok\.com$/.test(h)) { o.k = 'tiktok'; o.what = 'TikTok-Video'; }
    else if (/^(facebook\.com|fb\.watch|fb\.com)$/.test(h)) { o.k = 'facebook'; o.what = 'Facebook-Video'; }
    else if (/(^|\.)vimeo\.com$/.test(h)) { o.k = 'vimeo'; o.what = 'Vimeo-Video'; }
    return o;
  }
  // Feld mit Live-Erkennung: zeigt sofort, welche Plattform erkannt wurde
  function vidField(inp, hint, idle) {
    if (!inp || !hint) return;
    // Beim Tippen nur freundlich, der Hinweis „kein Link“ kommt erst beim Senden (beim Verlassen des Feldes würde er Knöpfe verschieben)
    const upd = strict => {
      const v = inp.value.trim(), fld = inp.closest('.field');
      const idleT = () => { hint.textContent = idle || ''; hint.className = 'hint vd-hint'; };
      if (!v) { idleT(); inp.removeAttribute('aria-invalid'); if (fld && !$$('[aria-invalid=true]', fld).length) fld.classList.remove('bad'); return; }
      const p = vidParse(v);
      if (p) { hint.innerHTML = `<span class="vd-hic" style="--pc:${VP[p.k].c}">${VP[p.k].svg}</span>${esc(p.what)}${p.k === 'web' ? ' · ' + esc(p.host) : ''} erkannt`; hint.className = 'hint vd-hint vd-ok'; inp.removeAttribute('aria-invalid'); if (fld && !$$('[aria-invalid=true]', fld).length) fld.classList.remove('bad'); }
      else if (strict) { hint.textContent = 'Das ist noch kein Link. Bitte die Adresse mit https:// einfügen.'; hint.className = 'hint vd-hint vd-bad'; inp.setAttribute('aria-invalid', 'true'); }
      else idleT();
    };
    inp.addEventListener('input', () => upd(false));
    inp.addEventListener('blur', () => { const n = vidNorm(inp.value); if (n && n !== inp.value) { inp.value = n; upd(false); } });
    inp._vupd = upd; upd(false);
  }
  const VD = { all: new Set() };
  const vidsOf = id => rtOf(id).map(x => ({ x, v: vidParse(x.link) })).filter(o => o.v);
  function vidCard({ x, v }) {
    const P = VP[v.k], by = `<span class="vd-by"><b>${esc(x.n)}</b>${x.d ? ' · ' + lvTime(x.d) : ''}</span>`;
    if (v.k === 'youtube' && v.yt) return `<li class="vd vd-yt${v.short ? ' is-short' : ''}" data-vx="${esc(x.id)}" style="--pc:${P.c}">
        <div class="vd-box" data-yt="${v.yt}"><span class="vd-art">${P.svg}</span><button class="vd-play" type="button" aria-label="Video laden (YouTube): Flug von ${esc(x.n)}"><i>${PLAY}</i><span>Video laden (YouTube)</span></button></div>
        <div class="vd-meta"><span class="vd-pf">${P.svg}${esc(v.what)}</span>${by}<a class="vd-out" href="${esc(v.href)}" target="_blank" rel="noopener nofollow ugc">Auf YouTube öffnen<span class="sr"> (neues Fenster)</span><span aria-hidden="true"> ↗</span></a></div>
      </li>`;
    return `<li class="vd vd-link" data-vx="${esc(x.id)}" style="--pc:${P.c}"><a class="vd-card" href="${esc(v.href)}" target="_blank" rel="noopener nofollow ugc">
        <span class="vd-ic">${P.svg}</span><span class="vd-tx"><b>${esc(v.what)}${v.k === 'web' ? ' · ' + esc(v.host) : ''}</b>${by}</span>
        <span class="vd-go">${v.k === 'web' ? 'Link öffnen' : 'Auf ' + P.n + ' ansehen'}<span class="sr"> (neues Fenster)</span><span aria-hidden="true"> ↗</span></span></a></li>`;
  }
  // Bereich „So sieht der Spot aus der Luft aus“ in den Details
  function vdHTML(s) {
    const head = `<p class="vd-h">${CAM}So sieht der Spot aus der Luft aus</p>`;
    const add = `<button class="vd-add" type="button" data-vadd="${esc(s.id)}">${PLUS}<span>Dein Flug hier? Video verlinken</span></button>`;
    if (!live()) return `${head}<div class="vd-empty"><p>Hast du hier gefilmt? Verlinke dein Video beim Bewerten.</p>${add}</div>`;
    if (RT.st === 'idle' || RT.st === 'load') return `${head}<div class="vd-sk" aria-hidden="true"><i></i></div>`;
    if (RT.st === 'err') return `${head}<p class="vd-0">Videos gerade nicht erreichbar.</p>`;
    const V = vidsOf(s.id);
    if (!V.length) return `${head}<div class="vd-empty"><p>Noch kein Video von diesem Spot. Zeig den anderen, wie es hier von oben aussieht.</p>${add}</div>`;
    const all = VD.all.has(s.id), show = all ? V : V.slice(0, 4);
    return `${head}<ul class="vd-list">${show.map(vidCard).join('')}</ul>${V.length > 4 && !all ? `<button class="rv-all" type="button" data-vall="${esc(s.id)}">Alle ${V.length} Videos zeigen</button>` : ''}${add}`;
  }
  // Handy-Leiste unter der Karte: Videos als Wischreihe
  function vdStrip(s) {
    if (!live() || RT.st !== 'ok') return '';
    const V = vidsOf(s.id);
    if (!V.length) return `<button class="ms-vadd" type="button" data-vadd="${esc(s.id)}">${PLUS}<span>Dein Flug hier? Video verlinken</span></button>`;
    return `<p class="ms-vh">${CAM}So sieht der Spot aus der Luft aus</p><ul class="ms-vids">${V.slice(0, 8).map(({ x, v }) => {
      const P = VP[v.k], inner = `<span class="vd-ic">${P.svg}</span><span class="ms-vt"><b>${esc(v.what)}</b><span>${esc(x.n)}</span></span>`;
      return `<li style="--pc:${P.c}">${v.k === 'youtube' && v.yt
        ? `<button class="ms-v" type="button" data-vplay="${esc(x.id)}" data-spot="${esc(s.id)}">${inner}<span class="ms-vg">${PLAY}Abspielen</span></button>`
        : `<a class="ms-v" href="${esc(v.href)}" target="_blank" rel="noopener nofollow ugc">${inner}<span class="ms-vg">${esc(P.n)} ↗<span class="sr"> (neues Fenster)</span></span></a>`}</li>`;
    }).join('')}</ul>`;
  }
  function ytLoad(box) {
    if (!box || box.classList.contains('loaded')) return;
    const id = box.dataset.yt; if (!/^[\w-]{11}$/.test(id || '')) return;
    const li = box.closest('.vd'), who = li ? ($('.vd-by b', li) || {}).textContent || '' : '';
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    f.title = 'YouTube-Video: Flug von ' + who;
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.setAttribute('allowfullscreen', '');
    box.innerHTML = ''; box.appendChild(f); box.classList.add('loaded');
    f.focus({ preventScroll: true });
  }
  // Einladung „Video verlinken“: Spot öffnen, Bewerten-Formular mit dem Video-Feld zeigen
  function vidInvite(id) {
    stopImpulse(); touched = true;
    toggleDet(id, true);
    const f = $('#rateform'); if (!f) return;
    if (!f.classList.contains('go')) { f.classList.add('go'); const g = G(); if (g) g.from($$('.rf-more', f), { opacity: 0, y: 8, duration: .45, ease: 'expo.out', stagger: .05 }); }
    const inp = $('#r-link');
    setTimeout(() => { if (inp) { go(inp, -Math.round(innerHeight * .3)); inp.focus({ preventScroll: true }); } }, RM ? 0 : 120);
  }
  function vidWire() {
    document.addEventListener('click', e => {
      const t = e.target.closest('.vd-play,[data-vadd],[data-vplay],[data-vall]'); if (!t) return;
      if (t.classList.contains('vd-play')) { ytLoad(t.closest('.vd-box')); return; }
      if (t.hasAttribute('data-vadd')) { vidInvite(t.dataset.vadd); return; }
      if (t.hasAttribute('data-vall')) { VD.all.add(t.dataset.vall); const box = t.closest('[data-vd]'), s = byId(t.dataset.vall); if (box && s) box.innerHTML = vdHTML(s); return; }
      // Handy-Leiste: zum Video in den Details springen und dort abspielen
      const id = t.dataset.spot, vx = t.dataset.vplay; stopImpulse(); touched = true;
      toggleDet(id, true);
      const card = $(`.sp-item[data-id="${CSS.escape(id)}"] .vd[data-vx="${CSS.escape(vx)}"]`);
      if (card) { go(card, -90); ytLoad($('.vd-box', card)); }
    });
  }

  /* ---------- Bewertungen live (FCS.board, Bereich 'spot:<id>') ----------
     Einmal laden, sobald die Spot-Liste in Sicht kommt (oder ein Spot geöffnet wird). Danach nur noch lokal rechnen. */
  const RT = { st: 'idle', list: [], all: new Set(), seen: false };
  const live = () => !!(window.FCS && FCS.board && FCS.board.on());
  const rtOf = id => RT.list.filter(x => x.b === 'spot:' + id);
  const stOf = x => { const v = Math.round(+x.st); return v >= 1 && v <= 5 ? v : 0; };
  const rtAvg = id => { const r = rtOf(id).map(stOf).filter(Boolean); return r.length ? { a: r.reduce((x, y) => x + y, 0) / r.length, n: r.length } : { a: 0, n: 0 }; };
  const fmt1 = v => v.toFixed(1).replace('.', ',');
  const starRow = (v, cls = '') => `<span class="st-row ${cls}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => i <= Math.round(v) ? IC.star.replace('<svg', '<svg class="on"') : IC.star).join('')}</span>`;
  // Kurzanzeige an der Karte: ★ 4,6 · 12 Bewertungen
  function rtBadge(id, inList) {
    if (!live() || RT.st === 'idle') return '';
    if (RT.st === 'load') return '<span class="rt-sk" aria-hidden="true"></span><span class="sr">Bewertungen werden geladen</span>';
    if (RT.st === 'err') return '';
    const { a, n } = rtAvg(id);
    if (!n) return `<span class="rt rt-0">${IC.star}Noch keine Bewertung</span>`;
    return `<span class="rt" aria-label="${fmt1(a)} von 5 Sternen aus ${n} ${n === 1 ? 'Bewertung' : 'Bewertungen'}">${IC.star}<b${inList ? ` data-rtv="${a.toFixed(2)}"` : ''}>${RT.seen || !inList || !G() ? fmt1(a) : '0,0'}</b><span>· ${n} ${n === 1 ? 'Bewertung' : 'Bewertungen'}</span></span>`;
  }
  // Zeile „Bewertung“ in den Details
  function rtBig(s) {
    if (!live()) return starsHTML(s);
    if (RT.st !== 'ok') return RT.st === 'err' ? '<span>Gerade nicht erreichbar</span>' : '<span class="rt-sk" aria-hidden="true"></span>';
    const { a, n } = rtAvg(s.id);
    if (!n) return `${starRow(0, 'is-empty')}<span>Noch keine Bewertung</span>`;
    return `${starRow(a)}<span><b class="rt-big">${fmt1(a)}</b> von 5 · ${n} ${n === 1 ? 'Bewertung' : 'Bewertungen'}</span>`;
  }
  // Liste der Bewertungen in den Details (die neuesten drei, „Alle zeigen“ klappt den Rest auf)
  function rvHTML(s) {
    const stat = (s.k || []).map(k => `<li class="rv-i rv-stat"><div class="rv-top"><b class="rv-n">${esc(k.n)}</b></div><p class="rv-t">${esc(k.t)}</p></li>`).join('');
    if (!live()) return stat ? `<ul class="rv-list">${stat}</ul>` : '<p class="rv-0">Noch keine Kommentare. Warst du schon dort?</p>';
    if (RT.st === 'load' || RT.st === 'idle') return '<div class="rv-sk" aria-hidden="true"><i></i><i></i></div>';
    if (RT.st === 'err') return `<div class="lv-err"><p>Bewertungen gerade nicht erreichbar, versuch es gleich nochmal.</p><button class="lv-retry" type="button" data-rt-retry>Nochmal</button></div>`;
    const L = rtOf(s.id);
    if (!L.length && !stat) return '<p class="rv-0">Noch keine Bewertung, sei die oder der Erste.</p>';
    const all = RT.all.has(s.id), show = all ? L : L.slice(0, 3);
    const li = x => { const m = lvMine(x.id), v = stOf(x); return `<li class="rv-i${m ? ' is-mine' : ''}" data-lv-id="${esc(x.id)}">
        <div class="rv-top"><b class="rv-n">${esc(x.n)}</b>${m ? '<span class="lv-mine">Deine</span>' : ''}${v ? `<span class="rv-st" aria-label="${v} von 5 Sternen">${starRow(v)}</span>` : ''}${lvTime(x.d)}</div>
        ${x.t ? `<p class="rv-t">${esc(x.t)}</p>` : ''}
        ${(v => v ? `<a class="rv-v" href="${esc(v.href)}" target="_blank" rel="noopener nofollow ugc" style="--pc:${VP[v.k].c}">${VP[v.k].svg}<span>${esc(v.what)}${v.k === 'web' ? ' · ' + esc(v.host) : ''}</span><span class="sr"> (neues Fenster)</span><span aria-hidden="true"> ↗</span></a>` : '')(vidParse(x.link))}
        ${lvActs()}
      </li>`; };
    return `<p class="rv-h">${L.length} ${L.length === 1 ? 'Bewertung' : 'Bewertungen'}</p><ul class="rv-list">${show.map(li).join('')}${stat}</ul>${L.length > 3 && !all ? `<button class="rv-all" type="button" data-rv-all="${esc(s.id)}">Alle ${L.length} Bewertungen zeigen</button>` : ''}`;
  }
  function rtPaint() {
    $$('[data-rt]').forEach(el => { el.innerHTML = rtBadge(el.dataset.rt, !!el.closest('#spotlist')); el.hidden = !el.innerHTML; });
    $$('[data-rt-big]').forEach(el => { const s = byId(el.dataset.rtBig); if (s) el.innerHTML = rtBig(s); });
    $$('[data-rv]').forEach(el => { const s = byId(el.dataset.rv); if (s) el.innerHTML = rvHTML(s); });
    // Videos: bereits geladene YouTube-Fenster nicht neu aufbauen
    $$('[data-vd]').forEach(el => { const s = byId(el.dataset.vd); if (s && !$('.vd-box.loaded', el)) el.innerHTML = vdHTML(s); });
    $$('[data-vs]').forEach(el => { const s = byId(el.dataset.vs); if (s) el.innerHTML = vdStrip(s); });
  }
  // Selbst-Impuls: die Durchschnitte zählen einmal hoch, wenn sie zum ersten Mal zu sehen sind
  function rtCount() {
    if (RT.seen) return; RT.seen = true;
    const g = G();
    $$('[data-rtv]').forEach(b => {
      const to = +b.dataset.rtv; if (!g) { b.textContent = fmt1(to); return; }
      const o = { v: 0 }; g.to(o, { v: to, duration: 1.4, ease: 'expo.out', onUpdate: () => { b.textContent = fmt1(o.v); } });
    });
    if (g) g.from($$('.sp-rt .rt svg'), { scale: 0, rotation: -90, duration: .6, ease: 'back.out(2.5)', stagger: .08 });
  }
  async function rtLoad() {
    if (!live() || RT.st === 'load') return;
    RT.st = 'load'; rtPaint();
    try { const srv = await FCS.board.list('spot:'); RT.list = [...RT.list.filter(x => x._new && !srv.some(y => y.id === x.id)), ...srv]; RT.st = 'ok'; } catch (e) { RT.st = 'err'; }
    rtPaint();
    if (RT.st !== 'ok') return;
    const ul = $('#spotlist'), r = ul && ul.getBoundingClientRect();
    if (r && r.top < innerHeight && r.bottom > 0) rtCount();
    else if (ul) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); rtCount(); } }, { threshold: .2 }); io.observe(ul); }
  }
  function ratingsInit() {
    const ul = $('#spotlist'); if (!ul) return;
    if (live()) {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); if (RT.st === 'idle') rtLoad(); } }, { rootMargin: '200px 0px' });
      io.observe(ul);
    }
    ul.addEventListener('click', e => {
      const b = e.target.closest('[data-rt-retry],[data-rv-all]'); if (!b) return;
      if (b.hasAttribute('data-rt-retry')) { rtLoad(); return; }
      RT.all.add(b.dataset.rvAll); const box = b.closest('[data-rv]'), s = byId(b.dataset.rvAll);
      if (box && s) { box.innerHTML = rvHTML(s); const g = G(); if (g) g.from($$('.rv-i', box).slice(3), { opacity: 0, y: 10, duration: .4, stagger: .04, ease: 'expo.out' }); const nx = $$('.rv-i', box)[3]; if (nx) { const a = $('[data-lv]', nx); if (a) a.focus({ preventScroll: true }); } }
    });
    lvWire(ul, {
      what: 'Bewertung', acc: 'die Bewertung', it: 'sie', mine: 'Das ist deine.', area: 'Spot-Bewertung',
      get: id => RT.list.find(x => x.id === id),
      excerpt: x => { const s = byId(String(x.b || '').slice(5)); return `${s ? s.n + ': ' : ''}${stOf(x) ? stOf(x) + ' Sterne' : ''}${x.t ? ', ' + x.t : ''}`; },
      onDeleted: id => { RT.list = RT.list.filter(x => x.id !== id); RT.seen = true; rtPaint(); }
    });
  }

  /* ---------- Regeln + Haken ---------- */
  const accepted = () => {
    try { if (sessionStorage.getItem(KEY) === '1') return true; } catch (e) {}
    const c = $('#accept'); return !!(c && c.checked);
  };
  const routeBtn = (s, cls = '') => `<a class="btn solid sp-route ${cls}" data-route href="${esc(FCS.route(s.lat, s.lng, s.adr))}" target="_blank" rel="noopener"${accepted() ? '' : ' aria-disabled="true"'}>${IC.lock}${IC.route}<span>Route</span><span class="sr"> zu ${esc(s.n)} mit Google Maps (öffnet neues Fenster)</span></a>`;

  function setLock(anim) {
    const ok = accepted();
    document.body.classList.toggle('route-frei', ok);
    $$('[data-route]').forEach(a => ok ? a.removeAttribute('aria-disabled') : a.setAttribute('aria-disabled', 'true'));
    const box = $('#rl-accept'); if (box) box.classList.toggle('on', ok);
    const g = G();
    if (anim && ok && g) {
      g.fromTo('#rl-accept .rl-box', { scale: .6 }, { scale: 1, duration: .6, ease: 'back.out(3)' });
      g.fromTo('.rl-on', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .5, ease: 'expo.out' });
    }
  }
  function nudge() {
    const box = $('#rl-accept'); if (!box) return;
    go(box, -Math.round(innerHeight * .38));
    box.classList.remove('nudge'); void box.offsetWidth; box.classList.add('nudge');
    setTimeout(() => { const c = $('#accept'); if (c) c.focus({ preventScroll: true }); }, RM ? 0 : 650);
  }
  function rules() {
    const c = $('#accept'); if (!c) return;
    c.checked = accepted(); setLock(false);
    c.addEventListener('change', () => { try { sessionStorage.setItem(KEY, c.checked ? '1' : '0'); } catch (e) {} setLock(true); });

    // Handy: Regeln zum Wischen, Punkte zeigen die Position
    const rail = $('#rl-rail'), cards = $$('.rl-card'), dots = $('#rl-dots');
    if (rail && dots && cards.length) {
      dots.innerHTML = cards.map(() => '<i></i>').join('');
      const di = $$('i', dots);
      const upd = () => {
        const max = rail.scrollWidth - rail.clientWidth;
        const i = max <= 2 ? 0 : Math.round(rail.scrollLeft / max * (cards.length - 1));
        di.forEach((d, k) => d.classList.toggle('on', k === i));
      };
      rail.addEventListener('scroll', upd, { passive: true }); upd();
      // Selbst-Impuls: wischt einmal kurz an, damit man sieht, dass es weitergeht
      if (!RM) {
        const io = new IntersectionObserver(es => {
          if (!es[0].isIntersecting) return; io.disconnect();
          if (rail.scrollWidth - rail.clientWidth < 20 || rail.scrollLeft > 0) return;
          setTimeout(() => { rail.scrollBy({ left: 90, behavior: 'smooth' }); setTimeout(() => rail.scrollBy({ left: -90, behavior: 'smooth' }), 650); }, 500);
        }, { threshold: .6 });
        io.observe(rail);
      }
    }
    // Haken pulsiert dreimal, sobald man ihn sieht (nur solange er nicht gesetzt ist)
    const acc = $('#rl-accept');
    if (acc) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); if (!accepted()) acc.classList.add('hint'); } }, { threshold: .8 }).observe(acc);
    // Einblenden: dezent, einmal
    const g = G();
    if (g && window.ScrollTrigger) g.from(cards, { y: 18, opacity: 0, duration: .7, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '#rl-cards', start: 'top 88%', once: true } });
  }

  /* ---------- Filter ---------- */
  function filters() {
    $$('[data-spotcount]').forEach(e => e.textContent = S.length);
    const box = $('#filters'); if (!box) return;
    const used = Object.keys(T).filter(k => S.some(s => s.typ === k));
    if (used.length < 2) { box.hidden = true; return; }
    const chip = (v, n, cnt, c) => `<label class="chip mp-chip"${c ? ` style="--c:${c}"` : ''}><input type="radio" name="spotfilter" value="${v}"${v === filter ? ' checked' : ''}><span>${c ? '<i></i>' : ''}${esc(n)}<b>${cnt}</b></span></label>`;
    box.innerHTML = chip('alle', 'Alle', S.length) + used.map(k => chip(k, T[k].n, S.filter(s => s.typ === k).length, T[k].c)).join('');
    $$('input', box).forEach(i => i.addEventListener('change', () => {
      filter = i.value; touched = true;
      if (!vis().some(s => s.id === current)) current = vis()[0] ? vis()[0].id : null;
      radarPins(); list(); leafPins(true); sel();
    }));
  }

  /* ---------- Saarland-Radar: eigene Karte mit Umriss, Nachbarn, Autobahnen, Flüssen und Orten (ohne fremde Server) ----------
     Alles läuft durch dieselbe Projektion km(lng, lat): Spots, Orte, Straßen und Umrisse liegen dadurch exakt übereinander.
     Unterste Ebene Canvas (Karte, nur bei Bedarf neu gezeichnet), darüber der Radar-Strahl (CSS-Drehung, nur transform),
     darüber die Spots als echte Knöpfe. Läuft nur, solange die Karte zu sehen ist. */
  const GEO_URL = 'assets/data/saarland.json?v=1';
  const LAT0 = 49.4, LON0 = 6.9, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
  const km = (lng, lat) => [(lng - LON0) * KX, (lat - LAT0) * KY];
  const SLB = (() => { const a = km(6.25, 49.112), b = km(7.42, 49.639); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] }; })();
  const SWEEP = 5200;
  const R = { box: null, cv: null, cx: null, sw: null, sa: null, pins: null, read: null, w: 0, h: 0, dpr: 1, k: 0, kFit: 0, kMin: 0, kMax: 0, c: [0, 0], fitted: false,
    geo: null, geoP: null, vis: false, on: false, raf: 0, dirty: true, intro: -1, introDone: false, pinsIn: false, mv: null, active: false, dragged: false,
    lastA: -1, readTxt: '', pos: {}, boxes: [], pinEls: [], ringPx: 90, scKm: 0, font: { hud: '"Chakra Petch",monospace', body: 'Inter,system-ui,sans-serif' } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const seg = (t, a, d) => clamp((t - a) / d, 0, 1);
  const toS = (x, y) => [R.w / 2 + (x - R.c[0]) * R.k, R.h / 2 - (y - R.c[1]) * R.k];
  const toW = (sx, sy) => [R.c[0] + (sx - R.w / 2) / R.k, R.c[1] - (sy - R.h / 2) / R.k];
  const fitCenter = () => [(SLB.x0 + SLB.x1) / 2, (SLB.y0 + SLB.y1) / 2];
  function fitK() {
    const padX = Math.min(40, R.w * .05), padY = Math.min(56, R.h * .08);
    return Math.min((R.w - padX * 2) / (SLB.x1 - SLB.x0), (R.h - padY * 2 - 44) / (SLB.y1 - SLB.y0));
  }
  function clampC() { const m = 24; R.c[0] = clamp(R.c[0], SLB.x0 - m, SLB.x1 + m); R.c[1] = clamp(R.c[1], SLB.y0 - m, SLB.y1 + m); }
  function touchMode() {
    if (!R.box) return;
    const zoomed = R.k > R.kFit * 1.04;
    // In der Übersicht scrollt ein Finger die Seite weiter, gezoomt verschiebt er die Karte
    R.box.style.touchAction = zoomed ? 'none' : 'pan-y';
    R.box.classList.toggle('zoomed', zoomed);
  }

  /* Kartendaten laden (15 KB) und als Pfade vorbereiten */
  function geoLoad() {
    if (R.geoP) return R.geoP;
    const t = setTimeout(() => { if (R.geo === null) { R.geo = false; introMaybe(); } }, 6000);
    R.geoP = fetch(GEO_URL).then(r => { if (!r.ok) throw new Error('geo'); return r.json(); })
      .then(d => { clearTimeout(t); if (R.geo === null || R.geo === false) R.geo = geoPrep(d); R.dirty = true; introMaybe(); kick(); })
      .catch(() => { clearTimeout(t); if (R.geo === null) R.geo = false; introMaybe(); });
    return R.geoP;
  }
  function geoPrep(d) {
    const q = d.q || 10000;
    const dec = a => { const o = new Float32Array(a.length); let x = 0, y = 0; for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; const p = km(x / q, y / q); o[i] = p[0]; o[i + 1] = -p[1]; } return o; };
    const line = (a, close) => { const o = dec(a), p = new Path2D(); let len = 0; p.moveTo(o[0], o[1]); for (let i = 2; i < o.length; i += 2) { p.lineTo(o[i], o[i + 1]); len += Math.hypot(o[i] - o[i - 2], o[i + 1] - o[i - 1]); } if (close) p.closePath(); return { p, len, o }; };
    const G = {
      sl: (d.sl || []).map(a => line(a, true)), rp: (d.rp || []).map(a => line(a, true)),
      bd: [...(d.rpl || []), ...(d.gr || [])].map(a => line(a)),
      ab: Object.entries(d.ab || {}).map(([n, ls]) => ({ n, ls: ls.map(a => line(a)) })),
      fl: Object.entries(d.fl || {}).map(([n, ls]) => ({ n, ls: ls.map(a => line(a)) })),
      sch: (d.sch || []).map(([t, cs]) => { const c = []; for (let i = 0; i < cs.length; i += 2) c.push(km(cs[i], cs[i + 1])); return { t, c }; }),
      orte: (d.orte || []).map(([n, lng, lat, r]) => ({ n, p: km(lng, lat), r })).sort((a, b) => a.r - b.r),
      land: (d.land || []).map(([n, cs]) => ({ n, c: cs.map(([lng, lat]) => km(lng, lat)) })),
      flab: []
    };
    G.sch.forEach(s => { s.ai = G.ab.findIndex(r => r.n === 'A ' + s.t); });
    // Flussnamen: nächster Punkt am Fluss und Richtung dort (einmal berechnet)
    (d.flab || []).forEach(([n, lng, lat]) => {
      const f = G.fl.find(r => r.n === n); if (!f) return;
      const p = km(lng, lat); let best = null;
      f.ls.forEach(l => { for (let i = 4; i < l.o.length - 4; i += 2) { const dd = (l.o[i] - p[0]) ** 2 + (l.o[i + 1] + p[1]) ** 2; if (!best || dd < best.d) best = { d: dd, l, i }; } });
      if (!best) return;
      const o = best.l.o, i = best.i;
      let ang = Math.atan2(o[i + 3] - o[i - 1], o[i + 2] - o[i - 2]);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      G.flab.push({ n, x: o[i], y: -o[i + 1], ang });
    });
    return G;
  }

  /* Ablauf des Intros: Umriss zeichnet sich, Nachbarn und Flüsse erscheinen, Autobahnen ziehen sich ein, Orte, dann die Spots */
  function phase(now) {
    if (RM || R.introDone || R.intro < 0) return null;
    const t = now - R.intro;
    return { land: easeOut(seg(t, 200, 900)), sl: ease(seg(t, 0, 1500)), slf: easeOut(seg(t, 800, 900)), fl: ease(seg(t, 650, 1300)),
      ab: i => ease(seg(t, 1050 + i * 130, 950)), sch: i => seg(t, 1850 + i * 130, 260), orte: easeOut(seg(t, 1600, 700)), lab: easeOut(seg(t, 1300, 900)) };
  }
  function A(P, key, i) { if (!P) return 1; const v = P[key]; return typeof v === 'function' ? v(i) : v; }
  function reveal(l, p) {
    const cx = R.cx;
    if (p >= 1) { cx.stroke(l.p); return; }
    if (p <= 0) return;
    cx.setLineDash([l.len * p, l.len + 1]); cx.lineDashOffset = 0; cx.stroke(l.p); cx.setLineDash([]);
  }
  function scaleBar() {
    const kmv = [.5, 1, 2, 5, 10, 20, 50].find(x => x * R.k >= 64) || 50;
    R.ringPx = Math.max(70, kmv * R.k * 2);
    const sc = $('#radar-scale'); if (!sc) return;
    const wpx = Math.round(kmv * R.k);
    if (sc._w !== wpx) { sc._w = wpx; sc.querySelector('i').style.width = wpx + 'px'; }
    if (R.scKm !== kmv) { R.scKm = kmv; sc.querySelector('span').textContent = kmv < 1 ? '500 m' : kmv + ' km'; }
  }
  function hud() {
    const { cx, w, h } = R, mx = w / 2, my = h / 2, rad = Math.hypot(w, h) / 2;
    cx.lineWidth = 1;
    cx.strokeStyle = 'rgba(63,224,255,.045)'; cx.beginPath();
    for (let x = mx % 48; x < w; x += 48) { cx.moveTo(x, 0); cx.lineTo(x, h); }
    for (let y = my % 48; y < h; y += 48) { cx.moveTo(0, y); cx.lineTo(w, y); }
    cx.stroke();
    cx.strokeStyle = 'rgba(63,224,255,.12)'; cx.beginPath();
    for (let r = R.ringPx; r < rad; r += R.ringPx) { cx.moveTo(mx + r, my); cx.arc(mx, my, r, 0, Math.PI * 2); }
    cx.stroke();
    cx.strokeStyle = 'rgba(63,224,255,.08)'; cx.beginPath(); cx.moveTo(mx, 0); cx.lineTo(mx, h); cx.moveTo(0, my); cx.lineTo(w, my); cx.stroke();
  }
  const over = (b, o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0;
  function blocked(b) { return b.x0 < 4 || b.y0 < 34 || b.x1 > R.w - 4 || b.y1 > R.h - 30 || R.boxes.some(o => over(b, o)); }
  function rrect(x, y, w, h, r) {
    const cx = R.cx; cx.beginPath();
    if (cx.roundRect) { cx.roundRect(x, y, w, h, r); return; }
    cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  function halo(t, x, y, fill, lw = 3.2) { const cx = R.cx; cx.lineWidth = lw; cx.strokeStyle = 'rgba(4,9,18,.88)'; cx.strokeText(t, x, y); cx.fillStyle = fill; cx.fillText(t, x, y); }
  function spaced(t, x, y, sp) { const cx = R.cx; let px = x; for (const ch of t) { cx.fillText(ch, px, y); px += cx.measureText(ch).width + sp; } }
  function spacedW(t, sp) { let s = 0; for (const ch of t) s += R.cx.measureText(ch).width + sp; return s - sp; }

  function labels(P) {
    const { cx, w, h } = R, G = R.geo, z = R.k / R.kFit, F = R.font;
    cx.textBaseline = 'top'; cx.textAlign = 'left'; cx.lineJoin = 'round';
    const oa = A(P, 'orte');
    // Reihenfolge nach Wichtigkeit: gewählter Spot (weicht den Orten aus), wichtige Orte, Autobahnnummern, übrige Spots, Länder, kleine Orte, Flüsse
    selLabel();
    G.orte.filter(o => o.r <= 2).forEach(o => town(o));
    // Autobahn-Schildchen (blau mit weißem Rand, wie an der Autobahn)
    G.sch.forEach(s => {
      const p = A(P, 'sch', Math.max(0, s.ai));
      cx.font = `700 11px ${F.hud}`;
      const bw = Math.max(21, cx.measureText(s.t).width + 12), bh = 17;
      // erste freie Stelle entlang der Autobahn rund um den Wunschpunkt
      let sx = 0, sy = 0, b = null;
      for (const c of s.c) { [sx, sy] = toS(c[0], c[1]); const t = { x0: sx - bw / 2 - 2, y0: sy - bh / 2 - 2, x1: sx + bw / 2 + 2, y1: sy + bh / 2 + 2 }; if (!blocked(t)) { b = t; break; } }
      if (!b) return;
      R.boxes.push(b);
      if (p <= 0) return;
      const sc = p >= 1 ? 1 : easeOut(p) * (1 + .25 * Math.sin(p * Math.PI));
      cx.save(); cx.translate(sx, sy); cx.scale(sc, sc);
      rrect(-bw / 2, -bh / 2, bw, bh, 4); cx.fillStyle = '#1557b0'; cx.fill(); cx.lineWidth = 1.4; cx.strokeStyle = '#f2f7ff'; cx.stroke();
      cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(s.t, 0, .5);
      cx.restore(); cx.textAlign = 'left'; cx.textBaseline = 'top';
    });
    // Orte: Rang 1 und 2 immer (Name nur, wenn Platz ist), Rang 3 und 4 nur mit Platz und genug Zoom
    function town(o) {
      if (o.r === 3 && z < .9) return; if (o.r === 4 && z < 1.8) return;
      const [sx, sy] = toS(o.p[0], o.p[1]); if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) return;
      const big = o.r === 1;
      cx.font = big ? `700 14px ${F.body}` : o.r === 2 ? `600 12.5px ${F.body}` : `500 11.5px ${F.body}`;
      const tw = cx.measureText(o.n).width, th = big ? 15 : 13, dr = big ? 3.8 : o.r === 2 ? 3 : 2.2;
      const dot = { x0: sx - dr - 1, y0: sy - dr - 1, x1: sx + dr + 1, y1: sy + dr + 1 };
      if (o.r >= 3 && blocked(dot)) return;
      const R0 = sx + dr + 5, L0 = sx - dr - 5 - tw, M0 = sy - th / 2;
      const cand = [[R0, M0], [L0, M0], [sx - tw / 2, sy - dr - 3 - th], [sx - tw / 2, sy + dr + 3], [R0, M0 - 6], [R0, M0 + 6], [L0, M0 - 6], [L0, M0 + 6]];
      let pos = null;
      for (const [x, y] of cand) { const b = { x0: x - 3, y0: y - 1, x1: x + tw + 3, y1: y + th + 1 }; if (!blocked(b)) { pos = [x, y]; R.boxes.push(b); break; } }
      if (!pos && o.r >= 3) return;
      R.boxes.push(dot);
      cx.globalAlpha = oa * (o.r >= 3 ? .62 : 1);
      cx.beginPath(); cx.arc(sx, sy, dr, 0, Math.PI * 2); cx.fillStyle = '#eaf4ff'; cx.fill(); cx.lineWidth = 1.6; cx.strokeStyle = 'rgba(4,9,18,.9)'; cx.stroke();
      if (pos) halo(o.n, pos[0], pos[1], o.r >= 3 ? '#b9c9de' : '#f2f7ff');
      cx.globalAlpha = 1;
    }
    spotLabels();
    // Nachbarländer und Saarland: blasse, gesperrte Großbuchstaben an der ersten freien Stelle
    const la = A(P, 'lab');
    G.land.forEach(l => {
      const sl = l.n === 'Saarland';
      const sm = w < 560, fz = sl ? (sm ? 13 : 15) : (sm ? 11 : 12.5);
      cx.font = `600 ${fz}px ${F.hud}`;
      const t = l.n.toUpperCase(), sp = sl ? (sm ? 4 : 6) : (sm ? 2.5 : 3.5), tw = spacedW(t, sp), th = fz + 1;
      for (const c of l.c) {
        const [sx, sy] = toS(c[0], c[1]);
        const b = { x0: sx - tw / 2 - 4, y0: sy - th / 2 - 3, x1: sx + tw / 2 + 4, y1: sy + th / 2 + 3 };
        if (b.x0 < 10 || b.x1 > w - 10 || b.y0 < 40 || b.y1 > h - 36 || R.boxes.some(o => over(b, o))) continue;
        R.boxes.push(b);
        cx.globalAlpha = la * (sl ? .55 : .5); cx.fillStyle = sl ? '#3fe0ff' : '#b5c9ea';
        spaced(t, sx - tw / 2, sy - th / 2, sp); cx.globalAlpha = 1;
        break;
      }
    });
    G.orte.filter(o => o.r > 2).forEach(town);
    // Flussnamen schräg am Fluss entlang
    G.flab.forEach(f => {
      const [sx, sy] = toS(f.x, f.y);
      cx.font = `italic 500 11.5px ${F.body}`;
      const tw = cx.measureText(f.n).width, ca = Math.abs(Math.cos(f.ang)), sa = Math.abs(Math.sin(f.ang));
      const ox = -Math.sin(f.ang) * 9, oy = Math.cos(f.ang) * 9;
      const hw = (tw * ca + 12 * sa) / 2, hh = (tw * sa + 12 * ca) / 2;
      const b = { x0: sx + ox - hw, y0: sy + oy - hh, x1: sx + ox + hw, y1: sy + oy + hh };
      if (blocked(b)) return;
      R.boxes.push(b);
      cx.save(); cx.globalAlpha = A(P, 'fl'); cx.translate(sx + ox, sy + oy); cx.rotate(f.ang); cx.textAlign = 'center'; cx.textBaseline = 'middle';
      halo(f.n, 0, 0, '#86bdff', 3); cx.restore();
    });
  }

  function pinsLayout() {
    const { w, h } = R, B = R.boxes;
    R.pinEls.forEach(e => {
      const p = km(e.s.lng, e.s.lat), [x, y] = toS(p[0], p[1]);
      e.x = x; e.y = y; R.pos[e.s.id] = [x, y];
      e.out = x < -24 || x > w + 24 || y < -24 || y > h + 24;
      e.b.style.transform = `translate3d(${(x - 22).toFixed(1)}px,${(y - 22).toFixed(1)}px,0)`;
      B.push({ x0: x - 12, y0: y - 12, x1: x + 12, y1: y + 12 });
    });
  }
  function spotLabel(e, avoid) {
    const { w, h } = R, B = R.boxes;
    if (!e.lw) e.lw = e.lab.offsetWidth || 160;
    const lw = e.lw, lh = 26, { x, y } = e;
    const C = { r: [x + 18, y - lh / 2], l: [x - 18 - lw, y - lh / 2], b: [x - lw / 2, y + 22], t: [x - lw / 2, y - 22 - lh] };
    let pl = 'n', best = 1e9;
    if (!e.out) for (const key of ['r', 'l', 'b', 't']) {
      const [bx, by] = C[key], b = { x0: bx, y0: by, x1: bx + lw, y1: by + lh };
      const outB = b.x0 < 6 || b.x1 > w - 6 || b.y0 < 34 || b.y1 > h - 28;
      if (!avoid) { if (outB || B.some(o => over(b, o))) continue; pl = key; break; }
      // gewählter Spot: immer beschriftet, an der Stelle, die am wenigsten verdeckt (Rand, andere Spots, wichtige Orte)
      const sc = (outB ? 100 : 0) + B.filter(o => over(b, o)).length * 20 + avoid.filter(o => over(b, o)).reduce((m, o) => m + o.wt, 0);
      if (sc < best) { best = sc; pl = key; }
      if (!sc) break;
    }
    // Handy: der Name steht ohnehin groß in der Leiste unter der Karte, deshalb dort nur beschriften, wenn kaum etwas verdeckt wird
    if (avoid && MOB.matches && best > 3) pl = 'n';
    if (pl !== 'n') { const [bx, by] = C[pl]; B.push({ x0: bx, y0: by, x1: bx + lw, y1: by + lh }); }
    if (e.pl !== pl) { e.pl = pl; e.b.dataset.pl = pl; }
    // Ohne Platz erscheint der Name nur beim Zeigen oder Fokus, dann auf der Seite, auf der er ganz hineinpasst
    const ph = x + 18 + lw < w - 6 ? 'r' : 'l'; if (e.ph !== ph) { e.ph = ph; e.b.dataset.ph = ph; }
  }
  // Grobe Flächen der wichtigen Orte (Punkt und Name rechts daneben), damit der gewählte Spot sie möglichst nicht verdeckt
  function townAreas() {
    const G = R.geo; if (!G) return [];
    return G.orte.filter(o => o.r <= 2).map(o => { const [sx, sy] = toS(o.p[0], o.p[1]), tw = o.n.length * (o.r === 1 ? 8 : 7); return { x0: sx - 4, y0: sy - 8, x1: sx + 8 + tw, y1: sy + 8, wt: o.r === 1 ? 6 : 3 }; });
  }
  const selLabel = () => R.pinEls.filter(e => e.s.id === current).forEach(e => spotLabel(e, townAreas()));
  const spotLabels = () => R.pinEls.filter(e => e.s.id !== current).forEach(e => spotLabel(e, null));

  function render(now) {
    const { cx, w, h, dpr, k } = R; if (!cx || !w) return;
    const P = phase(now);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    scaleBar(); hud();
    // Zoom-Knöpfe rechts oben freihalten
    R.boxes = R.zr ? [R.zr] : [];
    pinsLayout();
    const G = R.geo;
    if (G) {
      cx.setTransform(k * dpr, 0, 0, k * dpr, (w / 2 - R.c[0] * k) * dpr, (h / 2 + R.c[1] * k) * dpr);
      const px = v => v / k;
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      let a = A(P, 'land');
      if (a > 0) {
        cx.globalAlpha = a; cx.fillStyle = 'rgba(120,160,230,.075)'; G.rp.forEach(r => cx.fill(r.p));
        cx.strokeStyle = 'rgba(190,215,255,.36)'; cx.lineWidth = px(1.1); cx.setLineDash([px(5), px(4)]); G.bd.forEach(l => cx.stroke(l.p)); cx.setLineDash([]);
      }
      a = A(P, 'slf'); if (a > 0) { cx.globalAlpha = a; cx.fillStyle = 'rgba(63,224,255,.075)'; G.sl.forEach(r => cx.fill(r.p)); }
      cx.globalAlpha = 1;
      a = A(P, 'fl');
      G.fl.forEach(f => { cx.strokeStyle = 'rgba(86,160,255,.85)'; cx.lineWidth = px(f.n === 'Saar' || f.n === 'Mosel' ? 2.1 : 1.35); f.ls.forEach(l => reveal(l, a)); });
      a = A(P, 'sl');
      cx.strokeStyle = 'rgba(63,224,255,.16)'; cx.lineWidth = px(8); G.sl.forEach(l => reveal(l, a));
      cx.strokeStyle = 'rgba(63,224,255,.95)'; cx.lineWidth = px(1.8); G.sl.forEach(l => reveal(l, a));
      const lw = clamp(2 + Math.log2(k / R.kFit) * .55, 1.8, 3.6);
      G.ab.forEach((r, i) => {
        const p = A(P, 'ab', i); if (p <= 0) return;
        cx.strokeStyle = 'rgba(4,9,18,.85)'; cx.lineWidth = px(lw + 2.6); r.ls.forEach(l => reveal(l, p));
        cx.strokeStyle = 'rgba(255,186,64,.95)'; cx.lineWidth = px(lw); r.ls.forEach(l => reveal(l, p));
      });
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      labels(P);
    } else { selLabel(); spotLabels(); }
    const zi = $('#rz-in'), zo = $('#rz-out');
    if (zi) { const a = String(k >= R.kMax * .999), b = String(k <= R.kMin * 1.001); if (zi.getAttribute('aria-disabled') !== a) zi.setAttribute('aria-disabled', a); if (zo.getAttribute('aria-disabled') !== b) zo.setAttribute('aria-disabled', b); }
  }

  /* Radar-Strahl: dreht per CSS-Transform; JS liest nur den Winkel, damit Spots aufleuchten, wenn er vorbeikommt */
  function sweepStart() {
    if (RM || !R.sw || !R.sw.animate) return;
    if (!R.sa) R.sa = R.sw.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: SWEEP, iterations: Infinity });
    R.sw.classList.add('on');
    if (R.on) R.sa.play(); else R.sa.pause();
  }
  function ping(e) { if (e.ring && e.ring.animate) e.ring.animate([{ transform: 'scale(.6)', opacity: .95 }, { transform: 'scale(2.8)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,.7,.1,1)' }); }
  function sweepCheck() {
    if (!R.sa) return;
    const t = R.sa.currentTime; if (t == null) return;
    const a = (t % SWEEP) / SWEEP * 360, pa = R.lastA; R.lastA = a;
    const txt = String(Math.floor(a)).padStart(3, '0') + '°';
    if (txt !== R.readTxt && R.read) { R.readTxt = txt; R.read.textContent = txt; }
    if (pa < 0) return;
    R.pinEls.forEach(e => {
      if (e.out) return;
      let b = Math.atan2(e.x - R.w / 2, -(e.y - R.h / 2)) * 180 / Math.PI; if (b < 0) b += 360;
      if (pa <= a ? b > pa && b <= a : b > pa || b <= a) ping(e);
    });
  }

  function kick() { if (!R.raf && R.on) R.raf = requestAnimationFrame(tick); }
  const redraw = () => { R.dirty = true; kick(); };
  function tick(now) {
    R.raf = 0; if (!R.on) return;
    let more = false;
    if (R.mv) { if (R.mv(now) === false) R.mv = null; else more = true; }
    if (R.intro >= 0 && !R.introDone) {
      const t = now - R.intro;
      if (!R.pinsIn && t > 2250) pinsIn();
      if (t > 2700) { R.introDone = true; introEnd(); }
      R.dirty = true; more = true;
    }
    if (R.dirty) { R.dirty = false; render(now); }
    if (R.introDone && R.sa) { sweepCheck(); more = true; }
    if (more) R.raf = requestAnimationFrame(tick);
  }
  function setOn(v) {
    if (v != null) R.vis = v;
    R.on = !!(R.vis && R.box && !R.box.hidden && !document.hidden);
    if (R.sa) { if (R.on) R.sa.play(); else R.sa.pause(); }
    if (R.on) { geoLoad(); introMaybe(); kick(); }
  }
  function introMaybe() {
    if (R.intro >= 0 || R.geo === null || !R.on) return;
    if (RM) { R.intro = 0; R.introDone = true; pinsIn(); introEnd(); redraw(); return; }
    R.intro = performance.now(); R.dirty = true; kick();
  }
  function pinsIn() {
    R.pinsIn = true;
    if (R.pins) R.pins.classList.remove('is-pre');
    if (RM) return;
    R.pinEls.forEach((e, i) => {
      if (e.dot.animate) e.dot.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.5)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 650, delay: i * 120, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'backwards' });
      if (e.lab.animate) e.lab.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 200 + i * 120, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'backwards' });
      setTimeout(() => ping(e), 120 + i * 120);
    });
  }
  function introEnd() { sweepStart(); impulseStart(); }

  /* Ansicht ändern: Zoom um einen Punkt, Hinfliegen, Schwung nach dem Ziehen */
  function zoomBy(f, sx = R.w / 2, sy = R.h / 2, anim = true) {
    const W = toW(sx, sy), k0 = R.k, k1 = clamp(R.k * f, R.kMin, R.kMax);
    const cAt = k => [W[0] - (sx - R.w / 2) / k, W[1] + (sy - R.h / 2) / k];
    if (!anim || RM) { R.k = k1; R.c = cAt(k1); clampC(); touchMode(); redraw(); return; }
    const t0 = performance.now(), dur = 380;
    R.mv = now => { const t = Math.min(1, (now - t0) / dur); R.k = k0 * Math.pow(k1 / k0, easeOut(t)); R.c = cAt(R.k); clampC(); R.dirty = true; if (t >= 1) { touchMode(); return false; } };
    kick();
  }
  function flyTo(k1, c1, dur = 600) {
    k1 = clamp(k1, R.kMin, R.kMax);
    const k0 = R.k, c0 = [...R.c];
    if (RM || !R.on) { R.k = k1; R.c = [...c1]; clampC(); touchMode(); redraw(); return; }
    const t0 = performance.now();
    R.mv = now => { const t = Math.min(1, (now - t0) / dur), e = ease(t); R.k = k0 * Math.pow(k1 / k0, e); R.c = [c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e]; clampC(); R.dirty = true; if (t >= 1) { touchMode(); return false; } };
    kick();
  }
  function inertia(vx, vy) {
    if (RM || Math.hypot(vx, vy) < .15) return;
    let last = performance.now();
    R.mv = now => { const dt = Math.min(40, now - last); last = now; R.c[0] -= vx * dt / R.k; R.c[1] += vy * dt / R.k; clampC(); const f = Math.exp(-dt / 260); vx *= f; vy *= f; R.dirty = true; if (Math.hypot(vx, vy) < .02) return false; };
    kick();
  }
  // Liegen Spots am Handy so dicht, dass ein Finger mehrere trifft, zoomt der Tipp die Gruppe auseinander
  function fanOut(e) {
    const grp = R.pinEls.filter(o => !o.out && Math.hypot(o.x - e.x, o.y - e.y) < 46);
    if (grp.length < 2) return;
    let md = 1e9; grp.forEach((a, i) => grp.slice(i + 1).forEach(b => { md = Math.min(md, Math.hypot(a.x - b.x, a.y - b.y)); }));
    const f = clamp(64 / Math.max(md, 4), 1.4, R.kMax / R.k); if (f <= 1.01) return;
    const c = grp.reduce((m, o) => { const p = km(o.s.lng, o.s.lat); return [m[0] + p[0] / grp.length, m[1] + p[1] / grp.length]; }, [0, 0]);
    flyTo(R.k * f, c, 560);
  }
  function centerOn(id) { const s = byId(id); if (!s || !R.w) return; flyTo(R.k, km(s.lng, s.lat)); }
  function inView(id) { const p = R.pos[id]; return p && p[0] > 30 && p[0] < R.w - 30 && p[1] > 50 && p[1] < R.h - 40; }
  function hintFlash(t) {
    const h = $('#map-hint'); if (!h || imp) return;
    h.textContent = t; h.classList.add('on'); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on'), 1800);
  }

  function gestures() {
    const box = R.box, P = new Map();
    let st = null, moved = false, vel = [0, 0], lastT = 0, lastTap = 0, tapXY = null;
    const loc = e => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const user = () => { touched = true; stopImpulse(); };
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('.radar-zoom')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      R.active = true; R.mv = null; R.dragged = false; R.pt = e.pointerType;
      P.set(e.pointerId, loc(e));
      if (P.size === 1) { st = loc(e); moved = false; vel = [0, 0]; lastT = performance.now(); }
      if (P.size === 2) { moved = true; R.dragged = true; P.forEach((v, id) => { try { box.setPointerCapture(id); } catch (er) {} }); user(); }
    });
    box.addEventListener('pointermove', e => {
      if (!P.has(e.pointerId)) return;
      const cur = loc(e), prev = P.get(e.pointerId);
      if (P.size === 1) {
        // Übersicht am Handy: ein Finger scrollt die Seite, die Karte bleibt stehen (zwei Finger zoomen)
        if (e.pointerType === 'touch' && !R.box.classList.contains('zoomed') && !moved) return;
        if (!moved) {
          if (Math.hypot(cur[0] - st[0], cur[1] - st[1]) < 7) return;
          moved = true; R.dragged = true; try { box.setPointerCapture(e.pointerId); } catch (er) {} box.classList.add('grab'); user();
        }
        const dx = cur[0] - prev[0], dy = cur[1] - prev[1], now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
        R.c[0] -= dx / R.k; R.c[1] += dy / R.k; clampC();
        vel = [vel[0] * .5 + dx / dt * .5, vel[1] * .5 + dy / dt * .5];
        P.set(e.pointerId, cur); redraw(); return;
      }
      if (P.size === 2) {
        const ids = [...P.keys()], a0 = P.get(ids[0]), b0 = P.get(ids[1]);
        P.set(e.pointerId, cur);
        const a1 = P.get(ids[0]), b1 = P.get(ids[1]);
        const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1, d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) || 1;
        const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
        zoomBy(d1 / d0, m0[0], m0[1], false);
        R.c[0] -= (m1[0] - m0[0]) / R.k; R.c[1] += (m1[1] - m0[1]) / R.k; clampC(); redraw();
        lastT = performance.now(); vel = [0, 0];
        return;
      }
      P.set(e.pointerId, cur);
    });
    const up = e => {
      if (!P.has(e.pointerId)) return;
      const n = P.size; P.delete(e.pointerId);
      if (P.size === 1) { st = [...P.values()][0]; lastT = performance.now(); vel = [0, 0]; return; }
      if (P.size) return;
      box.classList.remove('grab'); touchMode();
      if (moved && n === 1 && e.type === 'pointerup' && performance.now() - lastT < 90) inertia(vel[0], vel[1]);
      if (!moved && e.type === 'pointerup' && e.pointerType !== 'mouse' && !e.target.closest('.rpin,.radar-zoom')) {
        // Doppeltipp zoomt hinein (am PC übernimmt das der Doppelklick)
        const now = performance.now(), p = loc(e);
        if (now - lastTap < 320 && tapXY && Math.hypot(p[0] - tapXY[0], p[1] - tapXY[1]) < 32) { lastTap = 0; user(); zoomBy(2, p[0], p[1]); }
        else { lastTap = now; tapXY = p; }
      }
    };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !P.size) R.active = false; });
    // Safari: Zwei-Finger-Geste nicht als Seitenzoom behandeln
    box.addEventListener('gesturestart', e => e.preventDefault());
    box.addEventListener('dblclick', e => { if (e.target.closest('.rpin,.radar-zoom') || (R.pt && R.pt !== 'mouse')) return; e.preventDefault(); const p = loc(e); user(); zoomBy(e.shiftKey ? .5 : 2, p[0], p[1]); });
    // Mausrad: mit Strg (oder nachdem man in die Karte geklickt hat), sonst scrollt die Seite ganz normal weiter
    box.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey || R.active)) { hintFlash('Strg + Mausrad zum Zoomen'); return; }
      e.preventDefault(); user(); R.mv = null;
      const p = loc(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.exp(-dy * (Math.abs(dy) < 40 ? .012 : .0022)), p[0], p[1], false);
    }, { passive: false });
    box.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key; let ok = true;
      if (k === '+' || k === '=') zoomBy(1.6);
      else if (k === '-' || k === '_') zoomBy(1 / 1.6);
      else if (k === '0') flyTo(R.kFit, fitCenter());
      else if (k.indexOf('Arrow') === 0) { const s = 90 / R.k, c = [...R.c]; if (k === 'ArrowLeft') c[0] -= s; if (k === 'ArrowRight') c[0] += s; if (k === 'ArrowUp') c[1] += s; if (k === 'ArrowDown') c[1] -= s; flyTo(R.k, c, 260); }
      else ok = false;
      if (ok) { e.preventDefault(); user(); }
    });
    box.addEventListener('focusin', e => { const b = e.target.closest('.rpin'); if (b && !inView(b.dataset.id)) centerOn(b.dataset.id); });
    const zb = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') === 'true') return; user(); fn(); }); };
    zb('#rz-in', () => zoomBy(1.8)); zb('#rz-out', () => zoomBy(1 / 1.8)); zb('#rz-fit', () => flyTo(R.kFit, fitCenter()));
  }

  function size() {
    if (!R.box || R.box.hidden) return;
    const r = R.box.getBoundingClientRect(); if (!r.width || !r.height) return;
    const d = Math.min(devicePixelRatio || 1, 2), rel = R.kFit ? R.k / R.kFit : 1, rc = [...R.c];
    R.w = r.width; R.h = r.height; R.dpr = d;
    R.cv.width = Math.round(R.w * d); R.cv.height = Math.round(R.h * d);
    R.kFit = fitK(); R.kMin = R.kFit * .7; R.kMax = R.kFit * 8;
    if (!R.fitted) { R.fitted = true; R.k = R.kFit; R.c = fitCenter(); } else { R.k = clamp(R.kFit * rel, R.kMin, R.kMax); R.c = rc; clampC(); }
    const dia = Math.ceil(Math.hypot(R.w, R.h));
    if (R.sw) { R.sw.style.width = R.sw.style.height = dia + 'px'; R.sw.style.margin = `${-dia / 2}px 0 0 ${-dia / 2}px`; }
    const z = $('.radar-zoom', R.box);
    if (z) { const zr = z.getBoundingClientRect(); R.zr = { x0: zr.left - r.left - 6, y0: zr.top - r.top - 6, x1: zr.right - r.left + 6, y1: zr.bottom - r.top + 6 }; }
    touchMode(); R.dirty = false; render(performance.now());
  }
  function radarPins() {
    const box = R.pins; if (!box) return;
    const v = vis();
    box.innerHTML = v.map(s => `<button class="rpin${s.id === current ? ' on' : ''}" type="button" style="--c:${typ(s).c}" data-id="${esc(s.id)}" aria-pressed="${s.id === current}" aria-label="${esc(s.n)}: Spot öffnen"><span class="rp-ring"></span><span class="rp-dot"></span><span class="rp-l" aria-hidden="true">${esc(s.n)}</span></button>`).join('');
    R.pinEls = $$('.rpin', box).map(b => ({ b, s: byId(b.dataset.id), lab: $('.rp-l', b), ring: $('.rp-ring', b), dot: $('.rp-dot', b), lw: 0, pl: '' }));
    R.pinEls.forEach(e => e.b.addEventListener('click', ev => { if (R.dragged) { R.dragged = false; return; } stopImpulse(); if (ev.detail && R.pt && R.pt !== 'mouse') fanOut(e); pick(e.s.id, 'map'); }));
    const n = $('#radar-n'); if (n) n.textContent = v.length;
    if (R.w) { R.dirty = false; render(performance.now()); }
    redraw();
  }
  function radar() {
    if (/[?&]radardebug/.test(location.search)) window.__R = R;
    R.box = $('#radar'); R.cv = $('#radar-cv'); R.sw = $('#radar-sweep'); R.pins = $('#radar-pins'); R.read = $('#radar-read');
    if (!R.box || !R.cv) return;
    R.cx = R.cv.getContext('2d');
    const cs = getComputedStyle(document.documentElement), hf = cs.getPropertyValue('--hud').trim(), bf = cs.getPropertyValue('--body').trim();
    if (hf) R.font.hud = hf; if (bf) R.font.body = bf;
    if (!RM && R.pins) R.pins.classList.add('is-pre');
    radarPins(); size(); gestures();
    if (window.ResizeObserver) new ResizeObserver(() => size()).observe(R.box); else addEventListener('resize', size);
    new IntersectionObserver(es => setOn(es[0].isIntersecting), { threshold: .2 }).observe(R.box);
    document.addEventListener('visibilitychange', () => setOn());
    // Kartendaten früh holen, die Schrift für die Beschriftung abwarten
    const pre = new IntersectionObserver(es => { if (es[0].isIntersecting) { pre.disconnect(); geoLoad(); } }, { rootMargin: '900px 0px' });
    pre.observe(R.box);
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load(`600 12px ${R.font.hud}`), document.fonts.load(`600 12px ${R.font.body}`)]).then(() => { R.pinEls.forEach(e => { e.lw = 0; }); redraw(); }).catch(() => {});
  }

  /* ---------- Straßenkarte und Satellit (Leaflet, lädt erst nach Klick, Anbieter ohne Schlüssel) ----------
     Straßenkarte: OpenStreetMap. Satellit: Esri World Imagery, darüber Straßen und Ortsnamen von Esri. */
  const M = { map: null, base: null, over: [], layer: null, mk: {}, ok: 0, bad: 0, timer: 0, failed: false, kind: '', acc: 0 };
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  function tiles(kind) {
    if (kind === 'sat') return [
      L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 19, attribution: 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> · Bilder © Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer(ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, opacity: .9 }),
      L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Beschriftung © Esri' })
    ];
    return [L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende' })];
  }
  function setLayer(kind) {
    if (!M.map || M.kind === kind) return;
    [M.base, ...M.over].forEach(l => { if (l) M.map.removeLayer(l); });
    const ls = tiles(kind); M.base = ls[0]; M.over = ls.slice(1); M.kind = kind;
    M.ok = 0; M.bad = 0;
    M.base.on('tileload', () => { M.ok++; if (M.ok === 1) { $('#map-wait').hidden = true; clearTimeout(M.timer); } });
    M.base.on('tileerror', () => { M.bad++; if (!M.ok && M.bad >= 4) fail(); });
    ls.forEach(l => l.addTo(M.map));
    $('#leaf').classList.toggle('is-sat', kind === 'sat');
    watchTiles();
  }
  function setView(v) {
    const street = v !== 'radar';
    $$('.mp-vbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    $('#map-fail').hidden = true;
    R.box.hidden = street; $('#leaf').hidden = !street;
    $('#mapbox').classList.toggle('is-street', street);
    if (!street) { $('#map-wait').hidden = true; size(); setOn(); redraw(); return; }
    setOn(); stopImpulse();
    if (!window.L) { fail(); return; }
    if (!M.map) makeMap(v);
    else {
      if (M.kind !== v) setLayer(v); else if (M.failed) retry();
      // Behälter war versteckt: Größe neu messen, sonst bleibt die Karte grau oder klein
      requestAnimationFrame(() => { M.map.invalidateSize(); focusSpot(false); });
    }
  }
  function makeMap(kind) {
    const el = $('#leaf');
    M.map = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: false, zoomSnap: .5, minZoom: 7, maxZoom: 19 });
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(M.map);
    M.map.on('click', () => { stopImpulse(); M.map.scrollWheelZoom.enable(); });
    el.addEventListener('mouseleave', () => { if (M.map) M.map.scrollWheelZoom.disable(); });
    // Mausrad nur mit Strg oder nach einem Klick in die Karte, sonst scrollt die Seite weiter
    el.addEventListener('wheel', e => {
      if (!M.map || M.map.scrollWheelZoom.enabled()) return;
      if (!(e.ctrlKey || e.metaKey)) { hintFlash('Strg + Mausrad zum Zoomen'); return; }
      e.preventDefault(); M.acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(M.acc) < 60) return;
      M.map.setZoomAround(M.map.mouseEventToContainerPoint(e), M.map.getZoom() + (M.acc < 0 ? .5 : -.5)); M.acc = 0;
    }, { passive: false });
    setLayer(kind);
    leafPins(false);
    fit(false);
    requestAnimationFrame(() => { M.map.invalidateSize(); fit(false); });
    setTimeout(() => M.map && M.map.invalidateSize(), 350);
    if (window.ResizeObserver) new ResizeObserver(() => M.map && !el.hidden && M.map.invalidateSize()).observe(el);
  }
  function watchTiles() {
    M.failed = false; $('#map-wait').hidden = M.ok > 0;
    clearTimeout(M.timer);
    M.timer = setTimeout(() => { if (!M.ok) fail(); }, 9000);
  }
  function retry() { M.ok = 0; M.bad = 0; watchTiles(); [M.base, ...M.over].forEach(l => l && l.redraw()); }
  function fail() {
    M.failed = true; clearTimeout(M.timer);
    $('#map-wait').hidden = true;
    const b = $('#map-fail-b');
    b.innerHTML = vis().map(s => routeBtn(s, 'mp-fail-r').replace('<span>Route</span>', `<span>${esc(s.n)}</span>`)).join('');
    $('#map-fail').hidden = false;
    wire(b);
  }
  function fit(anim) {
    if (!M.map) return;
    const v = vis(); if (!v.length) return;
    const bb = L.latLngBounds(v.map(s => [s.lat, s.lng]));
    if (v.length === 1) M.map.setView(bb.getCenter(), 13, { animate: anim });
    else M.map.fitBounds(bb, { padding: [56, 56], maxZoom: 13, animate: anim });
  }
  function leafPins(refit) {
    if (!M.map) return;
    if (M.layer) M.layer.remove();
    M.layer = L.layerGroup().addTo(M.map); M.mk = {};
    vis().forEach(s => {
      const icon = L.divIcon({ className: 'lpin-w' + (s.id === current ? ' on' : ''), html: `<span class="lpin" style="--c:${typ(s).c}"><i></i></span>`, iconSize: [30, 30], iconAnchor: [15, 15], tooltipAnchor: [16, 0] });
      const m = L.marker([s.lat, s.lng], { icon, title: s.n, alt: s.n, keyboard: true, riseOnHover: true }).addTo(M.layer);
      m.bindTooltip(esc(s.n), { direction: 'auto', permanent: s.id === current, className: 'ltip' });
      m.on('click', () => { stopImpulse(); pick(s.id, 'map'); });
      M.mk[s.id] = m;
    });
    if (refit) fit(true);
  }
  function focusSpot(anim) {
    if (!M.map || $('#leaf').hidden) return;
    const s = byId(current); if (!s) return;
    Object.entries(M.mk).forEach(([id, m]) => {
      const el = m.getElement(); if (el) el.classList.toggle('on', id === current);
      m.unbindTooltip(); m.bindTooltip(esc(byId(id).n), { direction: 'auto', permanent: id === current, className: 'ltip' });
      if (id === current) m.setZIndexOffset(500); else m.setZIndexOffset(0);
    });
    const z = Math.max(M.map.getZoom(), 12);
    if (anim && !RM) M.map.flyTo([s.lat, s.lng], z, { duration: .8 }); else M.map.setView([s.lat, s.lng], z, { animate: false });
  }

  /* ---------- Spot-Liste ---------- */
  function item(s) {
    const t = typ(s), on = s.id === current;
    const pic = s.foto ? `<img src="${esc(s.foto)}" alt="" loading="lazy" decoding="async">` : `<span class="sp-ph">${typIcon(s.typ)}</span>`;
    return `<li class="sp-item${on ? ' on' : ''}" data-id="${esc(s.id)}" style="--c:${t.c}">
      <article class="sp-card" aria-labelledby="sp-${esc(s.id)}-n">
        <button class="sp-pic" type="button" data-show="${esc(s.id)}" aria-label="${esc(s.n)} auf der Karte zeigen">${pic}<span class="sp-pin">${IC.pin}</span></button>
        <div class="sp-body">
          <p class="sp-typ"><i></i>${esc(t.n)}</p>
          <h3 class="sp-n" id="sp-${esc(s.id)}-n">${esc(s.n)}</h3>
          <p class="sp-rt" data-rt="${esc(s.id)}"${rtBadge(s.id, true) ? '' : ' hidden'}>${rtBadge(s.id, true)}</p>
          <p class="sp-t">${esc(s.t)}</p>
        </div>
        <div class="sp-btns">${routeBtn(s)}<button class="btn ghost sp-more" type="button" data-more="${esc(s.id)}" aria-expanded="false" aria-controls="sp-${esc(s.id)}-d"><span>Details</span>${IC.chev}</button></div>
      </article>
      <div class="sp-det" id="sp-${esc(s.id)}-d" hidden>
        <dl class="sp-dl">
          <div><dt>Adresse</dt><dd>${esc(s.adr)}</dd></div>
          <div><dt>Fliegen</dt><dd>${esc(s.regel)}</dd></div>
          <div><dt>Bewertung</dt><dd class="sp-st" data-rt-big="${esc(s.id)}">${rtBig(s)}</dd></div>
        </dl>
        <div class="vd-wrap" data-vd="${esc(s.id)}">${vdHTML(s)}</div>
        <div class="rv" data-rv="${esc(s.id)}">${rvHTML(s)}</div>
        <div class="sp-rate-slot"></div>
      </div>
    </li>`;
  }
  function list() {
    const ul = $('#spotlist'); if (!ul) return;
    const home = $('#rate-home'), f = $('#rateform'); if (home && f && !home.contains(f)) home.appendChild(f); // Formular vor dem Neuzeichnen in Sicherheit bringen
    const v = vis();
    ul.innerHTML = `<li class="sp-lock">${IC.lock}<span>Die Route-Knöpfe werden frei, sobald du oben die Regeln bestätigst.</span><button class="sp-lock-b" type="button" data-nudge>Regeln bestätigen</button></li>`
      + (v.length ? v.map(item).join('') : '<li class="sp-empty">Hier gibt es noch keinen Spot dieser Art. Kennst du einen? <a href="#einsenden">Spot melden</a></li>');
    wire(ul);
  }
  function wire(root) {
    $$('[data-route]', root).forEach(a => a.addEventListener('click', e => { if (!accepted()) { e.preventDefault(); nudge(); } }));
    $$('[data-nudge]', root).forEach(b => b.addEventListener('click', nudge));
    $$('[data-show]', root).forEach(b => b.addEventListener('click', () => {
      stopImpulse(); pick(b.dataset.show, 'list');
      const box = $('#mapbox'), r = box.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight) go(box, -16);
    }));
    $$('[data-more]', root).forEach(b => b.addEventListener('click', () => { stopImpulse(); toggleDet(b.dataset.more); }));
  }
  function toggleDet(id, force) {
    const li = $(`.sp-item[data-id="${CSS.escape(id)}"]`); if (!li) return;
    const det = $('.sp-det', li), btn = $('[data-more]', li);
    const open = force != null ? force : det.hidden;
    // Immer nur ein Spot offen: so bleibt die Liste kurz
    $$('.sp-item').forEach(o => { if (o !== li) { const d = $('.sp-det', o); if (d && !d.hidden) { d.hidden = true; $('[data-more]', o).setAttribute('aria-expanded', 'false'); o.classList.remove('open'); } } });
    det.hidden = !open; btn.setAttribute('aria-expanded', String(open)); li.classList.toggle('open', open);
    $('span', btn).textContent = open ? 'Weniger' : 'Details';
    if (open) {
      if (live() && RT.st === 'idle') rtLoad();
      rateInto(id, $('.sp-rate-slot', det));
      pick(id, 'list');
      const g = G(); if (g) g.from(det.children, { y: 10, opacity: 0, duration: .45, ease: 'expo.out', stagger: .05 });
    }
  }

  /* ---------- Auswahl: Liste, Radar, Straßenkarte und Handy-Leiste immer gleich ---------- */
  function pick(id, from) {
    if (!byId(id)) return;
    if (from !== 'auto') touched = true;
    const was = current; current = id; sel(); redraw();
    if (from === 'map') {
      if (!MOB.matches) {
        // PC: die Spot-Karte rechts klappt auf (Route, Bewertungen) und rückt ins Bild, die Karte bleibt stehen
        const li = $(`.sp-item[data-id="${CSS.escape(id)}"]`);
        if (li && $('.sp-det', li).hidden) toggleDet(id, true);
        if (li) { const r = li.getBoundingClientRect(); if (r.top < 140 || r.top > innerHeight - 220) go(li, -150); }
      } else {
        // Handy: direkt unter der Karte erscheint der Spot mit Route und Details
        const ms = $('#mp-sel');
        if (ms) {
          const r = ms.getBoundingClientRect();
          if (r.bottom > innerHeight - 72) window.scrollBy({ top: r.bottom - innerHeight + 84, behavior: RM ? 'auto' : 'smooth' });
          const g = G(); if (g && was !== id) g.fromTo(ms.children, { opacity: .35, y: 6 }, { opacity: 1, y: 0, duration: .4, ease: 'expo.out', stagger: .05 });
        }
      }
    }
    if (from === 'list' && R.w && !R.box.hidden && !inView(id)) centerOn(id);
    if (from !== 'auto') focusSpot(true);
  }
  function sel() {
    R.pinEls.forEach(e => { const on = e.s.id === current; e.b.classList.toggle('on', on); e.b.setAttribute('aria-pressed', String(on)); });
    $$('.sp-item').forEach(li => li.classList.toggle('on', li.dataset.id === current));
    Object.entries(M.mk).forEach(([id, m]) => { const el = m.getElement(); if (el) el.classList.toggle('on', id === current); });
    const box = $('#mp-sel'), s = byId(current); if (!box) return;
    if (!s) { box.innerHTML = ''; return; }
    const t = typ(s);
    box.style.setProperty('--c', t.c);
    const pic = s.foto ? `<img src="${esc(s.foto)}" alt="" loading="lazy" decoding="async">` : typIcon(s.typ);
    box.innerHTML = `<div class="ms-row"><span class="ms-pic">${pic}</span><div class="ms-t"><p class="sp-typ"><i></i>${esc(t.n)}</p><p class="ms-n">${esc(s.n)}</p><p class="sp-rt ms-rt" data-rt="${esc(s.id)}"${rtBadge(s.id) ? '' : ' hidden'}>${rtBadge(s.id)}</p></div></div><div class="ms-b">${routeBtn(s)}<button class="btn ghost" type="button" data-det="${esc(s.id)}">Details${IC.chev}</button></div><div class="ms-vw" data-vs="${esc(s.id)}">${vdStrip(s)}</div>`;
    wire(box);
    $('[data-det]', box).addEventListener('click', () => { stopImpulse(); touched = true; const li = $(`.sp-item[data-id="${CSS.escape(s.id)}"]`); toggleDet(s.id, true); if (li) go(li, -16); });
  }

  /* Selbst-Impuls: Nach dem Intro werden die Spots einmal nacheinander angetippt, dazu ein kurzer Hinweis */
  let imp = 0;
  function stopImpulse() { if (imp) { clearInterval(imp); imp = 0; } const h = $('#map-hint'); if (h) h.classList.remove('on'); }
  function impulseStart() {
    if (RM || touched || imp || !R.on) return;
    const hint = $('#map-hint');
    if (hint) { hint.textContent = FINE ? 'Klick auf einen Punkt · Ziehen verschiebt · Strg + Mausrad zoomt' : 'Tipp auf einen Punkt · Zoomen mit zwei Fingern'; hint.classList.add('on'); }
    const ids = vis().map(s => s.id), first = current; let i = 0;
    if (ids.length < 2) { setTimeout(() => { if (!imp && hint) hint.classList.remove('on'); }, 4000); return; }
    imp = setInterval(() => {
      if (touched || R.box.hidden || !R.on) { stopImpulse(); return; }
      i++; if (i > ids.length) { stopImpulse(); pick(first, 'auto'); return; }
      pick(ids[i % ids.length], 'auto');
    }, 1400);
  }
  function impulse() {
    const box = $('#mapbox'); if (!box) return;
    ['pointerdown', 'keydown'].forEach(ev => box.addEventListener(ev, () => { touched = true; stopImpulse(); }, { passive: true }));
  }

  /* ---------- Bewerten: ein Formular, das in den geöffneten Spot wandert ----------
     Live: FCS.board.add({b:'spot:'+id, n, st, t}), sofort sichtbar. Ohne Live-Anbindung wie bisher per Mail an den Vorstand. */
  const WORD = ['', 'Eher nichts', 'Geht so', 'Ganz okay', 'Gut', 'Top-Spot'];
  let waved = false;
  function rateReset(f) {
    f.reset(); f.classList.remove('sent', 'go');
    $$('.form-ok,.form-bad', f).forEach(x => x.hidden = true);
    $$('.field.bad,.check.bad', f).forEach(x => x.classList.remove('bad'));
    $('.stars', f).removeAttribute('data-v'); $('#rf-word').textContent = '';
    const nm = lvName(); if (nm) $('#r-name').value = nm;
    const li = $('#r-link'); if (li && li._vupd) li._vupd(false);
  }
  function rateInto(id, slot) {
    const f = $('#rateform'), s = byId(id); if (!f || !slot || !s) return;
    if (f.dataset.spot !== id) rateReset(f);
    f.dataset.spot = id; $('#rate-spot').value = s.n;
    slot.appendChild(f);
    // Selbst-Impuls: die Sterne winken einmal, damit klar ist, dass man tippen kann
    const g = G();
    if (!waved && g && !f.classList.contains('go')) { waved = true; g.fromTo($$('.stars svg', f), { scale: 1 }, { scale: 1.28, duration: .18, ease: 'power2.out', yoyo: true, repeat: 1, stagger: .07, delay: .45 }); }
  }
  function rate() {
    const f = $('#rateform'); if (!f) return;
    const st = $('.stars', f), labs = $$('label', st), word = $('#rf-word'), btn = $('#rf-go'), ok = $('#rf-ok'), bad = $('#rf-bad');
    const setV = (k, v) => v ? st.setAttribute(k, v) : st.removeAttribute(k);
    const cur = () => +(st.getAttribute('data-v') || 0);
    vidField($('#r-link'), $('#r-link-h'), 'Reel, Short oder anderes Video von deinem Flug hier.');
    if (!live()) { btn.textContent = 'Bewertung senden'; $('#rf-dsgvo').innerHTML = 'Meine Bewertung darf mit meinem Namen auf der Seite erscheinen (<a href="datenschutz.html">Datenschutz</a>).'; }
    $$('input', st).forEach(i => i.addEventListener('change', () => {
      setV('data-v', i.value); word.textContent = WORD[+i.value];
      if (!f.classList.contains('go')) {
        f.classList.add('go');
        const g = G(); if (g) g.from($$('.rf-more', f), { opacity: 0, y: 8, duration: .45, ease: 'expo.out', stagger: .05 });
      }
      const fld = i.closest('.field'); if (fld) fld.classList.remove('bad');
    }));
    labs.forEach((l, k) => {
      l.addEventListener('pointerenter', () => { setV('data-h', k + 1); word.textContent = WORD[k + 1]; });
      l.addEventListener('pointerleave', () => { setV('data-h', ''); word.textContent = WORD[cur()]; });
    });
    const fail = t => { $('#rf-bad-t').textContent = t; bad.hidden = false; };
    f.addEventListener('submit', async e => {
      e.preventDefault();
      bad.hidden = true; f.classList.add('go');
      if (!FCS.validate(f)) return;
      const hp = $('[name=_honey]', f); if (hp && hp.value) return;
      const id = f.dataset.spot, s = byId(id); if (!s) return;
      const n = $('#r-name').value.trim().replace(/\s+/g, ' ').slice(0, 40), t = $('#r-txt').value.trim().slice(0, 500), stv = +(($('input[name=Sterne]:checked', f) || {}).value || 0);
      // Video-Link (freiwillig): nur http(s), sonst Feld markieren und nicht senden
      const li = $('#r-link'), raw = li ? li.value.trim() : '', link = raw ? vidNorm(raw) : '';
      if (raw && !link) { if (li._vupd) li._vupd(true); li.closest('.field').classList.add('bad'); li.focus(); return; }
      if (li && link) li.value = link;
      lvKeepName(n);
      lvBusy(btn, true, live() ? 'Wird veröffentlicht …' : 'Wird gesendet …');
      if (!live()) {
        let r = { ok: false }; try { r = await FCS.send(f); } catch (er) {}
        lvBusy(btn, false);
        if (!r.ok) { fail('Bitte versuch es noch einmal.'); return; }
        f.classList.add('sent'); ok.innerHTML = `${LVI.ok}<p><b>Danke!</b> Deine Bewertung erscheint nach der Freigabe durch den Vorstand.</p>`; ok.hidden = false; ok.focus({ preventScroll: true });
        return;
      }
      let r = { ok: false, err: 'netz' }; try { r = await FCS.board.add({ b: 'spot:' + id, n, st: stv, t, link }); } catch (er) {}
      lvBusy(btn, false);
      if (!r.ok) { fail(r.err === 'abgelehnt' ? 'Prüf Name, Kommentar und Video-Link und versuch es nochmal.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'); return; }
      RT.list.unshift({ id: r.id, b: 'spot:' + id, n, st: stv, t: t || null, link: link || null, d: lvNow(), _new: 1 });
      RT.seen = true; rtPaint();
      f.classList.add('sent');
      ok.innerHTML = `${LVI.ok}<div class="rf-ok-in"><p><b>Danke, deine Bewertung ist online.</b>${link ? ' Dein Video steht jetzt bei diesem Spot.' : ''}</p>
        <div class="lv-code"><span class="lv-code-l">Dein Löschcode</span><code>${esc(r.pw)}</code><button class="lv-copy" type="button" data-copy="${esc(r.pw)}">${LVI.copy}<span>Code kopieren</span></button></div>
        <p class="lv-note">Auf diesem Gerät merken wir ihn uns.</p></div>`;
      ok.hidden = false; ok.focus({ preventScroll: true });
      const g = G();
      if (g) { g.fromTo(ok, { scale: .94, opacity: 0 }, { scale: 1, opacity: 1, duration: .55, ease: 'back.out(2)' }); const nw = $(`[data-lv-id="${CSS.escape(r.id)}"]`); if (nw) g.from(nw, { opacity: 0, y: -12, duration: .6, ease: 'expo.out', delay: .1 }); }
      const ub = $(`.sp-item[data-id="${CSS.escape(id)}"] [data-rt]`); if (ub && g) g.fromTo(ub, { scale: 1.15 }, { scale: 1, duration: .6, ease: 'back.out(3)' });
    });
    f.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) lvCopy(c.dataset.copy, c); });
  }

  /* ---------- Spot melden ---------- */
  function send() {
    const f = $('#spotform'); if (!f) return;
    const wa = $('#wa-btns');
    if (wa) wa.innerHTML = (D.kontakte || []).map(k => `<a class="btn ghost sp-wa" href="https://wa.me/${esc(k.wa)}?text=${encodeURIComponent('Hallo ' + k.name + ', ich habe einen Spot-Vorschlag für den Flight Club Saar: ')}" target="_blank" rel="noopener">${IC.wa}<span>${esc(k.name)}</span><span class="sr"> per WhatsApp schreiben (öffnet neues Fenster)</span></a>`).join('');

    // Art: Chips aus spotTypen, nochmal tippen hebt die Auswahl auf (das Feld ist freiwillig)
    const art = $('#s-art');
    if (art) {
      art.innerHTML = Object.values(T).map(t => `<label class="chip sf-chip" style="--c:${t.c}"><input type="radio" name="Art" value="${esc(t.n)}"><span><i></i>${esc(t.n)}</span></label>`).join('');
      $$('label', art).forEach(l => { const i = $('input', l); l.addEventListener('pointerdown', () => { l._was = i.checked; }); i.addEventListener('click', () => { if (l._was) { i.checked = false; l._was = false; } }); });
    }

    // Standort
    const geo = $('#geo'), loc = $('#s-loc'), msg = $('#geo-msg');
    const say = (t, k) => { msg.textContent = t; msg.className = 'hint geo-' + (k || 'i'); };
    if (geo) geo.addEventListener('click', () => {
      if (!navigator.geolocation || !window.isSecureContext) { say('Dein Browser gibt keinen Standort her. Tipp den Ort oder einen Google-Maps-Link ein.', 'bad'); return; }
      geo.disabled = true; geo.classList.add('busy'); say('Standort wird gesucht …');
      navigator.geolocation.getCurrentPosition(p => {
        const la = p.coords.latitude.toFixed(5), lo = p.coords.longitude.toFixed(5);
        loc.value = `https://www.google.com/maps?q=${la},${lo}`;
        loc.closest('.field').classList.remove('bad');
        geo.disabled = false; geo.classList.remove('busy');
        say(`Standort übernommen (auf etwa ${Math.max(1, Math.round(p.coords.accuracy))} m genau).`, 'ok');
      }, e => {
        geo.disabled = false; geo.classList.remove('busy');
        say(e && e.code === 1 ? 'Kein Zugriff auf den Standort. Erlaube ihn im Browser oder tipp den Ort ein.' : 'Standort nicht gefunden. Tipp den Ort oder einen Google-Maps-Link ein.', 'bad');
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });

    // Foto (freiwillig): Vorschau, entfernen, Ziehen und Ablegen
    const drop = $('#drop'), inp = $('#s-foto'), rm = $('#s-foto-x'), fmsg = $('#foto-msg');
    const prev = document.createElement('img'); prev.id = 's-prev'; prev.alt = 'Vorschau deines Fotos'; prev.hidden = true; if (drop) drop.appendChild(prev);
    let url = '';
    const clear = () => { if (url) URL.revokeObjectURL(url); url = ''; inp.value = ''; prev.hidden = true; prev.removeAttribute('src'); drop.classList.remove('has'); rm.hidden = true; };
    const take = file => {
      if (fmsg) fmsg.textContent = '';
      if (!file) { clear(); return; }
      if (!/^image\//.test(file.type)) { clear(); if (fmsg) fmsg.textContent = 'Das ist kein Bild. Bitte ein Foto wählen (JPG, PNG oder HEIC).'; return; }
      if (file.size > 10 * 1024 * 1024) { clear(); if (fmsg) fmsg.textContent = 'Das Foto ist größer als 10 MB. Bitte ein kleineres wählen.'; return; }
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(file); prev.src = url; prev.hidden = false; drop.classList.add('has'); rm.hidden = false;
    };
    if (drop && inp) {
      inp.addEventListener('change', () => take(inp.files[0]));
      rm.addEventListener('click', () => { clear(); inp.focus(); });
      ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', ev => {
        const file = ev.dataTransfer && ev.dataTransfer.files[0]; if (!file) return;
        try { const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; take(file); } catch (e) { if (fmsg) fmsg.textContent = 'Bitte tipp auf „Foto wählen“.'; }
      });
    }

    // Video-Links (freiwillig, bis zu 3): Plattform wird erkannt, ungültige Links halten das Senden an
    const vbox = $('#sf-vids'), vmore = $('#sf-vmore');
    const vrow = k => `<div class="sf-vrow"><input id="s-v${k}" name="Video ${k}" type="url" inputmode="url" maxlength="300" autocomplete="off" spellcheck="false" placeholder="Noch ein Link" aria-label="Video-Link ${k}" aria-describedby="s-v${k}-h"><span class="hint vd-hint" id="s-v${k}-h"></span></div>`;
    const vcount = () => $$('.sf-vrow', vbox).length;
    if (vbox && vmore) {
      vidField($('#s-v1'), $('#s-v1-h'), 'Instagram, TikTok, YouTube, Facebook oder ein anderer Link');
      vmore.addEventListener('click', () => {
        const k = vcount() + 1; if (k > 3) return;
        vmore.insertAdjacentHTML('beforebegin', vrow(k));
        const inp = $('#s-v' + k); vidField(inp, $(`#s-v${k}-h`), ''); inp.focus();
        const g = G(); if (g) g.from(inp.closest('.sf-vrow'), { opacity: 0, y: -6, duration: .35, ease: 'expo.out' });
        vmore.hidden = k >= 3;
      });
    }
    // Senden: alte Fehlermeldung weg, Video-Links prüfen, nach Erfolg Danke zeigen
    f.addEventListener('submit', e => {
      $$('.form-bad', f).forEach(x => x.hidden = true);
      let bad = null;
      $$('.sf-vrow input', f).forEach(i => { const raw = i.value.trim(); if (!raw) return; const n = vidNorm(raw); if (n) i.value = n; else { if (i._vupd) i._vupd(true); if (!bad) bad = i; } });
      if (bad) { e.preventDefault(); e.stopImmediatePropagation(); bad.closest('.field').classList.add('bad'); bad.focus({ preventScroll: true }); FCS.scrollTo(bad, -160); }
    }, true);
    f.addEventListener('fcs:sent', () => { const ok = $('.sf-ok', f); if (ok) setTimeout(() => { go(ok, -Math.round(innerHeight * .3)); const b = $('#sf-again'); if (b) b.focus({ preventScroll: true }); }, 60); });
    const again = $('#sf-again');
    if (again) again.addEventListener('click', () => {
      f.reset(); clear(); f.classList.remove('sent');
      $$('.sf-vrow', f).slice(1).forEach(r => r.remove()); if (vmore) vmore.hidden = false; const v1 = $('#s-v1'); if (v1 && v1._vupd) v1._vupd(false);
      $$('.form-ok,.form-bad', f).forEach(x => x.hidden = true);
      say('Am Spot? Dann tipp auf „Meinen Standort nehmen“.');
      $('#s-name').focus({ preventScroll: true }); go(f, -20);
    });
  }

  /* ---------- Start ---------- */
  function init() {
    if (!S.length) return;
    rules(); filters(); radar(); list(); sel(); send(); rate(); impulse(); ratingsInit(); vidWire();
    $$('.mp-vbtn').forEach(b => b.addEventListener('click', () => { touched = true; setView(b.dataset.view); }));
    $('#map-fail-radar').addEventListener('click', () => setView('radar'));
    const g = G();
    if (g && window.ScrollTrigger) g.from('#mapbox', { opacity: 0, y: 24, duration: .9, ease: 'expo.out', scrollTrigger: { trigger: '#mapbox', start: 'top 90%', once: true } });
  }
  let started = false;
  const start = () => { if (started) return; started = true; init(); };
  document.addEventListener('fcs:ready', start, { once: true });
  if (document.readyState === 'complete') setTimeout(start, 0);
})();
