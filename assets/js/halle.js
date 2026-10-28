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
    if (n.halle.geheim) { $('#n-route').hidden = true; } else $('#n-route').href = FCS.route(n.halle.lat, n.halle.lng, n.halle.adresse);
    $('#n-ics').onclick = () => FCS.ics(n);
    const np = $('#n-plan'); if (np) np.href = 'termin.html?d=' + n.d;
    const zb = $('#n-zu'); if (zb) zb.dataset.zu = n.d;
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
        <div class="t-info"><h3>${t.halle.name}${isN ? ' <em class="t-next">Nächster Abend</em>' : ''}</h3><p>${zeit()} · ${(t.halle.adresse.split(', ')[1] || t.halle.adresse).replace(/^\d{5}\s*/, '')}</p><a class="t-plan" href="termin.html?d=${t.d}">${t.vorbei ? 'Abendplan ansehen' : 'Abendplan &amp; eintragen'}<span aria-hidden="true">→</span></a></div>
        <div class="t-act">${t.vorbei ? '<span class="stamp">Geflogen</span>' : `<span class="t-zu" data-zu-act="${t.d}"></span><button class="t-btn" type="button" data-ics="${i}" aria-label="${FCS.fmtDate(t.d, 1)} in den Kalender">${ICS}<span>Kalender</span></button>${t.halle.geheim ? '' : `<a class="t-btn" href="${FCS.route(t.halle.lat, t.halle.lng, t.halle.adresse)}" target="_blank" rel="noopener" aria-label="Route zur ${t.halle.name} (öffnet Google Maps)">${PIN}<span>Route</span></a>`}`}</div>
        <div class="t-crew zu" data-zu="${t.d}" hidden></div>
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
      // Mit Nachladen: grob ein Drittel der Flüge aus nachgeladenen Akkus (1S lädt in etwa 20 bis 30 Minuten)
      const n = lade ? Math.min(fluege, Math.max(4, Math.ceil(fluege * 0.65))) : fluege;
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
  /* ---------- „Ich bin dabei“: Zusagen live für jeden kommenden Abend ----------
     Lädt alle Zusagen EINMAL (FCS.board.list('termin:')), sobald die Termine in Sicht kommen, und filtert pro Abend.
     Der Spitzname wird auf dem Gerät gemerkt, der Löschcode merkt sich FCS.board selbst. */
  const NAMEKEY = 'fcs-name';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const myName = () => { try { return String(localStorage.getItem(NAMEKEY) || '').slice(0, 40); } catch (e) { return ''; } };
  const keepName = v => { try { localStorage.setItem(NAMEKEY, v); } catch (e) {} };
  const COL = ['#3fe0ff', '#ffb020', '#3ee08a', '#c78bff', '#ff7a59', '#5aa2ff'];
  const colOf = s => { let h = 7; for (const ch of String(s).toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0; return COL[h % COL.length]; };
  const ini = s => { const w = String(s).trim().split(/\s+/).filter(Boolean).map(x => [...x]); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || ['?']).slice(0, 2).join('')).toUpperCase(); };
  const IC_GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const IC_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const Z = { st: 'idle', list: [], open: '', busy: '', src: null, msg: '', msgBad: false, seen: new Set() };
  const tByD = d => FCS.termine().find(t => t.d === d);
  const ofT = d => Z.list.filter(x => x.b === 'termin:' + d);
  const mineOf = d => { const m = FCS.board.mine(); const o = ofT(d).find(x => m[x.id] && m[x.id].pw); return o ? { id: o.id, pw: m[o.id].pw } : null; };
  const wtag = d => FCS.fmtDate(d, 1).split(',')[0];
  let live = null;
  const say = t => { if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); };

  function avatars(list, ownId, max) {
    const show = list.slice(0, max), more = list.length - show.length;
    const names = list.map(x => x.n).join(', ');
    return `<span class="zu-av" role="img" aria-label="Zusagen: ${esc(names)}">${show.map(x => `<i class="${x.id === ownId ? 'me' : ''}" style="--c:${colOf(x.n)}" data-zid="${esc(x.id)}">${esc(ini(x.n))}</i>`).join('')}${more > 0 ? `<i class="more">+${more}</i>` : ''}</span>`;
  }
  const slotOf = box => box && box.classList.contains('t-crew') ? $(`[data-zu-act="${box.dataset.zu}"]`) : null;
  function zuBox(box) {
    const d = box.dataset.zu, t = d && tByD(d), big = box.classList.contains('zu-big'), slot = slotOf(box);
    const cls = (k, on) => box.classList.toggle(k, !!on);
    const setSlot = h => { if (slot) slot.innerHTML = h; };
    cls('is-load', Z.st === 'load'); cls('is-err', Z.st === 'err');
    if (!t || !FCS.board.on() || Z.st === 'idle') { box.hidden = true; setSlot(''); return; }
    if (Z.st === 'load') { box.hidden = false; setSlot(''); box.innerHTML = '<span class="zu-sk" aria-hidden="true"><i></i><i></i><i></i></span><span class="zu-skb" aria-hidden="true"></span><span class="sr">Zusagen werden geladen</span>'; return; }
    if (Z.st === 'err') { box.hidden = !big; setSlot(''); if (big) box.innerHTML = '<p class="zu-err">Gerade nicht erreichbar, versuch es gleich nochmal.</p><button class="zu-retry" type="button" data-zu-retry>Nochmal</button>'; return; }
    const list = ofT(d), own = mineOf(d), n = list.length, busy = Z.busy === d, ownId = own && own.id;
    const shownN = Z.seen.has(box) || !anim() ? n : 0;
    if (t.vorbei) {
      box.hidden = !n;
      if (n) box.innerHTML = `<div class="zu-row">${avatars(list, ownId, 5)}<p class="zu-n"><b data-zn="${n}">${shownN}</b> ${n === 1 ? 'war' : 'waren'} dabei</p></div>`;
      return;
    }
    box.hidden = false;
    const lbl = n === 1 ? '<span class="zu-w">Pilot </span>kommt' : '<span class="zu-w">Piloten </span>kommen';
    const count = n ? `<p class="zu-n"><b data-zn="${n}">${shownN}</b> <span>${lbl}</span></p>` : `<p class="zu-n zu-0">${big ? 'Noch niemand eingetragen. Sei die oder der Erste!' : 'Noch niemand eingetragen'}</p>`;
    const open = Z.open === d && Z.src === box;
    let act = '';
    if (busy) act = `<button class="zu-go busy" type="button" disabled><span class="zu-spin" aria-hidden="true"></span>Moment …</button>`;
    else if (own) act = `<span class="zu-me">${IC_OK}<span class="zu-w">Du bist </span>dabei</span><button class="zu-no" type="button" data-zu-no>Doch nicht</button>`;
    else if (!open) act = `<button class="zu-go" type="button" data-zu-go aria-label="Ich bin dabei am ${esc(FCS.fmtDate(d, 1))}">${IC_GO}Ich bin dabei</button>`;
    const nm = myName(), k = big ? 'b' : 't';
    const MAXC = 8;
    const chips = big && n ? `<ul class="zu-names" aria-label="Wer kommt">${list.slice(0, MAXC).map(x => `<li class="${x.id === ownId ? 'me' : ''}" style="--c:${colOf(x.n)}" data-zid="${esc(x.id)}"><i aria-hidden="true"></i>${x.id === ownId ? '<b>Du</b> · ' : ''}${esc(x.n)}</li>`).join('')}${n > MAXC ? `<li class="more">+${n - MAXC} weitere</li>` : ''}</ul>` : '';
    const as = big && nm && !own && !open && !busy ? `<p class="zu-as">Du trägst dich als <b>${esc(nm)}</b> ein. <button type="button" data-zu-edit>Ändern</button></p>` : '';
    const form = open ? `<form class="zu-form" data-zu-form novalidate>
        <label class="zu-l" for="zu-in-${d}-${k}">Dein Spitzname</label>
        <div class="zu-fr"><input class="zu-in" id="zu-in-${d}-${k}" name="n" maxlength="40" autocomplete="nickname" enterkeyhint="send" required value="${esc(nm)}" aria-describedby="zu-h-${d}-${k}"><button class="zu-ok" type="submit">Eintragen</button></div>
        <p class="zu-hint" id="zu-h-${d}-${k}">Dein Spitzname erscheint öffentlich bei diesem Termin.</p>
        <button class="zu-x" type="button" data-zu-x>Abbrechen</button>
      </form>` : '';
    const msg = Z.src === box && Z.msg ? `<p class="zu-msg${Z.msgBad ? ' bad' : ''}">${esc(Z.msg)}</p>` : '';
    box.innerHTML = `<div class="zu-row">${!big && n ? avatars(list, ownId, 4) : ''}${count}<div class="zu-act">${act}</div></div>${chips}${as}${form}${msg}`;
    setSlot(act);
  }
  const zuRender = () => $$('[data-zu]').forEach(zuBox);
  const countTo = (el, from, to) => {
    if (!el) return;
    if (!anim()) { el.textContent = to; return; }
    const o = { v: from }; gsap.to(o, { v: to, duration: Math.min(1.6, .5 + Math.abs(to - from) * .12), ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
  };
  // Selbst-Impuls: Sobald ein Abend zu sehen ist, zählt der Zähler hoch, die Avatare springen rein, der Knopf blitzt einmal
  function intro(box) {
    if (Z.seen.has(box)) return; Z.seen.add(box);
    if (!anim()) return;
    const b = $('[data-zn]', box); if (b) countTo(b, 0, +b.dataset.zn);
    const av = $$('.zu-av i, .zu-names li', box); if (av.length) gsap.from(av, { scale: 0, opacity: 0, duration: .5, ease: 'back.out(2.4)', stagger: .06, delay: .15 });
    const go = $('.zu-go', box); if (go && box.classList.contains('zu-big')) setTimeout(() => go.classList.add('glint'), 700);
  }
  function focusIn(box, sel) { if (!box) return; const el = [...$$(sel, box), ...(slotOf(box) ? $$(sel, slotOf(box)) : [])].find(x => x.offsetParent !== null); if (el) el.focus({ preventScroll: true }); }
  async function zuLoad() {
    if (!FCS.board.on()) return;
    Z.st = 'load'; zuRender();
    try { const srv = await FCS.board.list('termin:'); Z.list = [...Z.list.filter(x => x._new && !srv.some(y => y.id === x.id)), ...srv]; Z.st = 'ok'; } catch (e) { Z.st = 'err'; }
    zuRender();
    if (Z.st !== 'ok') return;
    $$('[data-zu]').forEach(box => onScreen(box, v => { if (v) intro(box); }, '0px 0px -15% 0px'));
  }
  async function zuAdd(box, d, name) {
    Z.busy = d; Z.src = box; Z.msg = ''; zuRender();
    let r = { ok: false, err: 'netz' };
    try { r = await FCS.board.add({ b: 'termin:' + d, n: name }); } catch (e) {}
    Z.busy = '';
    const before = ofT(d).length;
    if (r.ok) {
      keepName(name); Z.open = '';
      Z.list.unshift({ id: r.id, b: 'termin:' + d, n: name, d: new Date().toISOString().slice(0, 19), _new: 1 });
      Z.msg = `Eingetragen. Bis ${wtag(d)}!`; Z.msgBad = false; say(`Du bist dabei am ${FCS.fmtDate(d, 1)}.`);
      zuRender();
      $$(`[data-zu="${d}"]`).forEach(b => { countTo($('[data-zn]', b), before, before + 1); if (anim()) gsap.from($$(`[data-zid="${CSS.escape(r.id)}"]`, b), { scale: 0, opacity: 0, duration: .6, ease: 'back.out(3)' }); });
      focusIn(box, '[data-zu-no]');
    } else {
      Z.msg = r.err === 'abgelehnt' ? 'Das hat nicht geklappt. Prüf deinen Spitznamen und versuch es nochmal.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'; Z.msgBad = true; say(Z.msg);
      zuRender(); focusIn(box, '.zu-in, [data-zu-go]');
    }
  }
  async function zuDel(box, d) {
    const own = mineOf(d); if (!own) return;
    Z.busy = d; Z.src = box; Z.msg = ''; zuRender();
    let r = { ok: false, err: 'netz' };
    try { r = await FCS.board.del(own.id, own.pw); } catch (e) {}
    Z.busy = '';
    if (r.ok) {
      const before = ofT(d).length;
      const gone = $$(`[data-zu="${d}"] [data-zid="${CSS.escape(own.id)}"]`);
      const done = () => {
        Z.list = Z.list.filter(x => x.id !== own.id);
        Z.msg = 'Ausgetragen. Vielleicht beim nächsten Mal!'; Z.msgBad = false; say('Du bist ausgetragen.');
        zuRender(); $$(`[data-zu="${d}"]`).forEach(b => countTo($('[data-zn]', b), before, before - 1));
        focusIn(box, '[data-zu-go]');
      };
      if (anim() && gone.length) gsap.to(gone, { scale: 0, opacity: 0, duration: .35, ease: 'power2.in', onComplete: done }); else done();
    } else {
      Z.msg = r.err === 'code' ? 'Das ging gerade nicht. Lad die Seite neu und versuch es nochmal.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'; Z.msgBad = true; say(Z.msg);
      zuRender(); focusIn(box, '[data-zu-no]');
    }
  }
  function zusagen() {
    const sec = $('#termine'); if (!sec) return;
    if (!FCS.board || !FCS.board.on()) { const l = $('#termine-lede'); if (l) l.textContent = 'Jeweils 18 bis 21 Uhr, die Hallen sind für uns fest reserviert. Ein Klick legt den Termin in deinen Kalender oder plant die Route.'; return; }
    live = document.createElement('p'); live.className = 'sr'; live.setAttribute('role', 'status'); sec.appendChild(live);
    sec.addEventListener('click', e => {
      const el = e.target.closest('[data-zu-go],[data-zu-no],[data-zu-x],[data-zu-edit],[data-zu-retry]'); if (!el) return;
      const sl = el.closest('[data-zu-act]'), box = el.closest('[data-zu]') || (sl && $(`.t-crew[data-zu="${sl.dataset.zuAct}"]`)), d = box && box.dataset.zu;
      if (el.hasAttribute('data-zu-retry')) { zuLoad(); return; }
      if (!d || Z.busy) return;
      Z.msg = '';
      if (el.hasAttribute('data-zu-go')) {
        const nm = myName();
        if (nm.trim().length >= 2) { zuAdd(box, d, nm); return; }
        Z.open = d; Z.src = box; zuRender(); focusIn(box, '.zu-in');
      } else if (el.hasAttribute('data-zu-edit')) { Z.open = d; Z.src = box; zuRender(); const i = $('.zu-in', box); if (i) { i.focus({ preventScroll: true }); i.select(); } }
      else if (el.hasAttribute('data-zu-x')) { Z.open = ''; zuRender(); focusIn(box, '[data-zu-go]'); }
      else if (el.hasAttribute('data-zu-no')) zuDel(box, d);
    });
    sec.addEventListener('submit', e => {
      const f = e.target.closest('[data-zu-form]'); if (!f) return;
      e.preventDefault();
      const box = f.closest('[data-zu]'), inp = $('.zu-in', f), nm = inp.value.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (nm.length < 2) { inp.classList.add('bad'); inp.setAttribute('aria-invalid', 'true'); $('.zu-hint', f).textContent = 'Bitte gib einen Spitznamen mit mindestens 2 Zeichen ein. Er erscheint öffentlich bei diesem Termin.'; inp.focus(); return; }
      zuAdd(box, box.dataset.zu, nm);
    });
    sec.addEventListener('keydown', e => { if (e.key === 'Escape' && Z.open) { const box = Z.src; Z.open = ''; zuRender(); focusIn(box, '[data-zu-go]'); } });
    let asked = false;
    onScreen(sec, v => { if (v && !asked) { asked = true; zuLoad(); } }, '300px 0px');
  }

  document.addEventListener('fcs:ready', () => { next(); tickets(); fotos(); hallen(); bag(); akku(); zusagen(); }, { once: true });
})();
