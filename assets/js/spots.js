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
        ${lvActs()}
      </li>`; };
    return `<p class="rv-h">${L.length} ${L.length === 1 ? 'Bewertung' : 'Bewertungen'}</p><ul class="rv-list">${show.map(li).join('')}${stat}</ul>${L.length > 3 && !all ? `<button class="rv-all" type="button" data-rv-all="${esc(s.id)}">Alle ${L.length} Bewertungen zeigen</button>` : ''}`;
  }
  function rtPaint() {
    $$('[data-rt]').forEach(el => { el.innerHTML = rtBadge(el.dataset.rt, !!el.closest('#spotlist')); el.hidden = !el.innerHTML; });
    $$('[data-rt-big]').forEach(el => { const s = byId(el.dataset.rtBig); if (s) el.innerHTML = rtBig(s); });
    $$('[data-rv]').forEach(el => { const s = byId(el.dataset.rv); if (s) el.innerHTML = rvHTML(s); });
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

  /* ---------- Radar (läuft ohne fremde Server) ---------- */
  const R = { box: null, cv: null, cx: null, w: 0, h: 0, on: false, raf: 0, a: 0, t0: 0, pos: {}, prevA: 0 };
  function proj() {
    // Ausschnitt aus allen Spots, gleicher Maßstab in beide Richtungen (km), damit Abstände stimmen
    const lat0 = S.reduce((m, s) => Math.min(m, s.lat), 90), lat1 = S.reduce((m, s) => Math.max(m, s.lat), -90);
    const lng0 = S.reduce((m, s) => Math.min(m, s.lng), 180), lng1 = S.reduce((m, s) => Math.max(m, s.lng), -180);
    const cl = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
    const kx = 111.32 * cl, ky = 110.57;
    const dx = Math.max(6, (lng1 - lng0) * kx), dy = Math.max(6, (lat1 - lat0) * ky);
    const padX = Math.min(150, R.w * .2), padY = Math.min(110, R.h * .2);
    const k = Math.min((R.w - padX * 2) / dx, (R.h - padY * 2) / dy); // px pro km
    const cxL = (lng0 + lng1) / 2, cyL = (lat0 + lat1) / 2;
    return { k, at: (lat, lng) => ({ x: R.w / 2 + (lng - cxL) * kx * k, y: R.h / 2 - (lat - cyL) * ky * k }) };
  }
  function radarSize() {
    if (!R.box || R.box.hidden) return;
    const r = R.box.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    R.w = r.width; R.h = r.height; R.cv.width = Math.round(R.w * d); R.cv.height = Math.round(R.h * d); R.cx.setTransform(d, 0, 0, d, 0, 0);
    radarPins(); draw();
  }
  function radarPins() {
    const box = $('#radar-pins'); if (!box || !R.w) return;
    const P = proj(); R.k = P.k;
    const v = vis();
    box.innerHTML = v.map(s => {
      const p = P.at(s.lat, s.lng); R.pos[s.id] = p;
      return `<button class="rpin${s.id === current ? ' on' : ''}" type="button" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--c:${typ(s).c}" data-id="${esc(s.id)}" aria-pressed="${s.id === current}" aria-label="${esc(s.n)} markieren"><span class="rp-ring"></span><span class="rp-dot"></span><span class="rp-l" aria-hidden="true">${esc(s.n)}</span></button>`;
    }).join('');
    // Beschriftung rechts, links oder unter dem Punkt, je nachdem wo sie ganz hineinpasst
    $$('.rpin', box).forEach(b => {
      const p = R.pos[b.dataset.id], lw = b.querySelector('.rp-l').offsetWidth;
      if (p.x + 30 + lw > R.w - 10) b.classList.add(p.x - 30 - lw > 10 ? 'l' : 'b');
    });
    $$('.rpin', box).forEach(b => b.addEventListener('click', () => { stopImpulse(); pick(b.dataset.id, 'map'); }));
    const n = $('#radar-n'); if (n) n.textContent = v.length;
    // Maßstab: runde Kilometerzahl, die etwa 70–130 px lang ist
    const sc = $('#radar-scale');
    if (sc && R.k) {
      const km = [1, 2, 5, 10, 20, 50].find(x => x * R.k >= 70) || 50;
      sc.querySelector('i').style.width = Math.round(km * R.k) + 'px'; sc.querySelector('span').textContent = km + ' km';
      R.ring = km * R.k;
    }
  }
  function draw(t) {
    const { cx, w, h } = R; if (!cx || !w) return;
    cx.clearRect(0, 0, w, h);
    const mx = w / 2, my = h / 2, rad = Math.hypot(w, h) / 2;
    cx.lineWidth = 1;
    cx.strokeStyle = 'rgba(63,224,255,.06)';
    for (let x = mx % 48; x < w; x += 48) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, h); cx.stroke(); }
    for (let y = my % 48; y < h; y += 48) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke(); }
    cx.strokeStyle = 'rgba(63,224,255,.16)';
    const step = Math.max(40, R.ring || 80);
    for (let r = step; r < rad; r += step) { cx.beginPath(); cx.arc(mx, my, r, 0, Math.PI * 2); cx.stroke(); }
    cx.strokeStyle = 'rgba(63,224,255,.12)'; cx.beginPath(); cx.moveTo(mx, 0); cx.lineTo(mx, h); cx.moveTo(0, my); cx.lineTo(w, my); cx.stroke();
    if (RM || !t) return;
    const a = ((t - R.t0) / 4200 * Math.PI * 2) % (Math.PI * 2);
    if (cx.createConicGradient) {
      const g = cx.createConicGradient(a - .55, mx, my);
      g.addColorStop(0, 'rgba(63,224,255,0)'); g.addColorStop(.0875, 'rgba(63,224,255,.30)'); g.addColorStop(.088, 'rgba(63,224,255,0)'); g.addColorStop(1, 'rgba(63,224,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(mx, my); cx.arc(mx, my, rad, 0, Math.PI * 2); cx.fill();
    }
    cx.strokeStyle = 'rgba(63,224,255,.65)'; cx.beginPath(); cx.moveTo(mx, my); cx.lineTo(mx + Math.cos(a) * rad, my + Math.sin(a) * rad); cx.stroke();
    // Wenn der Strahl über einen Spot läuft, blinkt der Punkt kurz auf
    const pa = R.prevA; R.prevA = a;
    $$('#radar-pins .rpin').forEach(b => {
      const p = R.pos[b.dataset.id]; if (!p) return;
      const ang = (Math.atan2(p.y - my, p.x - mx) + Math.PI * 2) % (Math.PI * 2);
      const hit = pa <= a ? ang > pa && ang <= a : ang > pa || ang <= a;
      if (hit) { const ring = b.querySelector('.rp-ring'); if (ring && ring.animate) ring.animate([{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.7,.1,1)' }); }
    });
    const rd = $('#radar-read'); if (rd) rd.textContent = String(Math.round((a * 180 / Math.PI + 90) % 360)).padStart(3, '0') + '°';
  }
  function loop(t) { if (!R.on || R.box.hidden) { R.raf = 0; return; } draw(t); R.raf = requestAnimationFrame(loop); }
  function radarRun() { if (RM) { draw(); return; } if (!R.raf && R.on && !R.box.hidden) { R.t0 = R.t0 || performance.now(); R.raf = requestAnimationFrame(loop); } }
  function radar() {
    R.box = $('#radar'); R.cv = $('#radar-cv'); if (!R.box || !R.cv) return;
    R.cx = R.cv.getContext('2d');
    radarSize();
    if (window.ResizeObserver) new ResizeObserver(() => radarSize()).observe(R.box); else addEventListener('resize', radarSize);
    new IntersectionObserver(es => { R.on = es[0].isIntersecting; if (R.on) radarRun(); }).observe(R.box);
  }

  /* ---------- Straßenkarte (Leaflet, lädt erst nach Klick) ---------- */
  const M = { map: null, tiles: null, layer: null, mk: {}, ok: 0, bad: 0, timer: 0, failed: false };
  const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  function setView(v) {
    const street = v === 'street';
    const radarEl = $('#radar'), leaf = $('#leaf');
    $('#view-radar').setAttribute('aria-pressed', String(!street));
    $('#map-load').setAttribute('aria-pressed', String(street));
    $('#map-fail').hidden = true;
    radarEl.hidden = street; leaf.hidden = !street;
    $('#mapbox').classList.toggle('is-street', street);
    if (!street) { $('#map-wait').hidden = true; radarSize(); radarRun(); return; }
    stopImpulse();
    if (!window.L) { fail(); return; }
    if (!M.map) makeMap();
    else {
      // Behälter war versteckt: Größe neu messen, sonst bleibt die Karte grau oder klein
      requestAnimationFrame(() => { M.map.invalidateSize(); focusSpot(false); });
      if (M.failed) retry();
    }
  }
  function makeMap() {
    const el = $('#leaf');
    $('#map-load-t').textContent = 'Straßenkarte';
    M.map = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: false, zoomSnap: .5, minZoom: 7, maxZoom: 18 });
    L.control.attribution({ position: 'topright', prefix: false }).addTo(M.map);
    M.map.on('click', () => stopImpulse());
    M.tiles = L.tileLayer(TILE, { subdomains: 'abcd', maxZoom: 19, detectRetina: false, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' });
    M.tiles.on('tileload', () => { M.ok++; if (M.ok === 1) { $('#map-wait').hidden = true; clearTimeout(M.timer); } });
    M.tiles.on('tileerror', () => { M.bad++; if (!M.ok && M.bad >= 4) fail(); });
    M.tiles.addTo(M.map);
    leafPins(false);
    fit(false);
    watchTiles();
    requestAnimationFrame(() => { M.map.invalidateSize(); fit(false); });
    setTimeout(() => M.map && M.map.invalidateSize(), 350);
    if (window.ResizeObserver) new ResizeObserver(() => M.map && !el.hidden && M.map.invalidateSize()).observe(el);
  }
  function watchTiles() {
    M.failed = false; $('#map-wait').hidden = M.ok > 0;
    clearTimeout(M.timer);
    M.timer = setTimeout(() => { if (!M.ok) fail(); }, 9000);
  }
  function retry() { M.ok = 0; M.bad = 0; watchTiles(); M.tiles.redraw(); }
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
    current = id; sel();
    if (from === 'map' && !MOB.matches) {
      const li = $(`.sp-item[data-id="${CSS.escape(id)}"]`);
      if (li) { const r = li.getBoundingClientRect(); if (r.top < 120 || r.bottom > innerHeight) go(li, -140); }
    }
    if (from !== 'auto') focusSpot(true);
  }
  function sel() {
    $$('#radar-pins .rpin').forEach(p => { const on = p.dataset.id === current; p.classList.toggle('on', on); p.setAttribute('aria-pressed', String(on)); });
    $$('.sp-item').forEach(li => li.classList.toggle('on', li.dataset.id === current));
    Object.entries(M.mk).forEach(([id, m]) => { const el = m.getElement(); if (el) el.classList.toggle('on', id === current); });
    const box = $('#mp-sel'), s = byId(current); if (!box) return;
    if (!s) { box.innerHTML = ''; return; }
    const t = typ(s);
    box.style.setProperty('--c', t.c);
    box.innerHTML = `<div class="ms-t"><p class="sp-typ"><i></i>${esc(t.n)}</p><p class="ms-n">${esc(s.n)}</p><p class="sp-rt ms-rt" data-rt="${esc(s.id)}"${rtBadge(s.id) ? '' : ' hidden'}>${rtBadge(s.id)}</p></div><div class="ms-b">${routeBtn(s)}<button class="btn ghost" type="button" data-det="${esc(s.id)}">Details</button></div>`;
    wire(box);
    $('[data-det]', box).addEventListener('click', () => { const li = $(`.sp-item[data-id="${CSS.escape(s.id)}"]`); toggleDet(s.id, true); if (li) go(li, -16); });
  }

  /* Selbst-Impuls: Sobald die Karte zu sehen ist, werden die Spots einmal nacheinander angetippt */
  let imp = 0;
  function stopImpulse() { if (imp) { clearInterval(imp); imp = 0; } const h = $('#map-hint'); if (h) h.classList.remove('on'); }
  function impulse() {
    const box = $('#mapbox'); if (!box || RM) return;
    const hint = $('#map-hint'); if (hint) hint.textContent = FINE ? 'Klick auf einen Punkt oder einen Spot in der Liste' : 'Tipp auf einen Punkt';
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return; io.disconnect();
      if (touched) return;
      if (hint) hint.classList.add('on');
      const ids = vis().map(s => s.id), first = current; let i = 0;
      if (ids.length < 2) return;
      imp = setInterval(() => {
        if (touched || $('#radar').hidden) { stopImpulse(); return; }
        i++; if (i > ids.length) { stopImpulse(); pick(first, 'auto'); return; }
        pick(ids[i % ids.length], 'auto');
      }, 1300);
    }, { threshold: .55 });
    io.observe(box);
    ['pointerdown', 'keydown', 'wheel'].forEach(ev => box.addEventListener(ev, () => { touched = true; stopImpulse(); }, { passive: true }));
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
      lvKeepName(n);
      lvBusy(btn, true, live() ? 'Wird veröffentlicht …' : 'Wird gesendet …');
      if (!live()) {
        let r = { ok: false }; try { r = await FCS.send(f); } catch (er) {}
        lvBusy(btn, false);
        if (!r.ok) { fail('Bitte versuch es noch einmal.'); return; }
        f.classList.add('sent'); ok.innerHTML = `${LVI.ok}<p><b>Danke!</b> Deine Bewertung erscheint nach der Freigabe durch den Vorstand.</p>`; ok.hidden = false; ok.focus({ preventScroll: true });
        return;
      }
      let r = { ok: false, err: 'netz' }; try { r = await FCS.board.add({ b: 'spot:' + id, n, st: stv, t }); } catch (er) {}
      lvBusy(btn, false);
      if (!r.ok) { fail(r.err === 'abgelehnt' ? 'Prüf Name und Kommentar und versuch es nochmal.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'); return; }
      RT.list.unshift({ id: r.id, b: 'spot:' + id, n, st: stv, t: t || null, d: lvNow(), _new: 1 });
      RT.seen = true; rtPaint();
      f.classList.add('sent');
      ok.innerHTML = `${LVI.ok}<div class="rf-ok-in"><p><b>Danke, deine Bewertung ist online.</b></p>
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

    // Senden: alte Fehlermeldung weg, nach Erfolg Danke zeigen
    f.addEventListener('submit', () => { $$('.form-bad', f).forEach(x => x.hidden = true); }, true);
    f.addEventListener('fcs:sent', () => { const ok = $('.sf-ok', f); if (ok) setTimeout(() => { go(ok, -Math.round(innerHeight * .3)); const b = $('#sf-again'); if (b) b.focus({ preventScroll: true }); }, 60); });
    const again = $('#sf-again');
    if (again) again.addEventListener('click', () => {
      f.reset(); clear(); f.classList.remove('sent');
      $$('.form-ok,.form-bad', f).forEach(x => x.hidden = true);
      say('Am Spot? Dann tipp auf „Meinen Standort nehmen“.');
      $('#s-name').focus({ preventScroll: true }); go(f, -20);
    });
  }

  /* ---------- Start ---------- */
  function init() {
    if (!S.length) return;
    rules(); filters(); radar(); list(); sel(); send(); rate(); impulse(); ratingsInit();
    $('#map-load').addEventListener('click', () => { touched = true; setView('street'); });
    $('#view-radar').addEventListener('click', () => { touched = true; setView('radar'); });
    $('#map-fail-radar').addEventListener('click', () => setView('radar'));
    const g = G();
    if (g && window.ScrollTrigger) g.from('#mapbox', { opacity: 0, y: 24, duration: .9, ease: 'expo.out', scrollTrigger: { trigger: '#mapbox', start: 'top 90%', once: true } });
  }
  let started = false;
  const start = () => { if (started) return; started = true; init(); };
  document.addEventListener('fcs:ready', start, { once: true });
  if (document.readyState === 'complete') setTimeout(start, 0);
})();
