/* Hallenabend: eine Unterseite pro Hallenfliegen-Termin (termin.html?d=JJJJ-MM-TT)
   Piloten tragen sich ein (FCS.board 'termin:<d>'), jeder bekommt einen Kanal ohne Störungen,
   der Abendplan teilt Durchgänge gerecht ein, der Live-Modus läuft in der Halle nach Uhrzeit.
   Der Vorstand veröffentlicht den Plan für alle ('plan:<d>', nur mit Vorstandscode). */
(function (root) {
  'use strict';

  /* =====================================================================================
     KERN: Frequenzen, Kanalzuteilung und Durchgänge. Ohne DOM, damit er auch in Node testbar ist.
     -------------------------------------------------------------------------------------
     Frequenztabelle (Mittenfrequenz und belegte Bandbreite), recherchiert am 24.10.2026:
     · Analog Raceband R1 bis R8: 5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917 MHz, 37 MHz Raster.
       Belegte Bandbreite analog etwa 30 MHz.            Quelle: https://oscarliang.com/fpv-channels/
     · DJI O4 (Air Unit und Air Unit Pro), FCC/SRRC/CE gleich, manueller Modus:
       20 MHz und 10 MHz: Kanal 1 5768,5 · Kanal 2 5789,5 · Kanal 3 5814,5 MHz; 40/60 MHz: nur Kanal 1 bei 5794,5 MHz.
                                                        Quelle: https://www.dji.com/o4-air-unit/specs
     · DJI O3 Air Unit, FCC/SRRC/CE gleich, manueller Modus:
       20 MHz und 10 MHz: Kanal 1 5768,5 · Kanal 2 5804,5 · Kanal 3 5839,5 MHz; 40 MHz: nur Kanal 1 bei 5794,5 MHz.
                                                        Quelle: DJI-Datenblatt, wiedergegeben bei https://www.getfpv.com/dji-o3-air-unit.html
       Der Plan teilt DJI immer mit 20 MHz zu: Ein 40-MHz-Signal (5774,5 bis 5814,5 MHz) überdeckt fast das halbe Band.
     · HDZero: Raceband R1 bis R8 (dazu E1, F1, F2, F4), bis zu 8 Piloten zusammen mit Analog, Bandbreite 27 MHz.
                                                        Quellen: HDZero VTX User Manual v0.7 (https://www.flyingtech.co.uk/wp-content/uploads/2025/05/HDZero_VTX_UserManual_v0.7.pdf),
                                                                 Bandbreite: https://oscarliang.com/fpv-channels/
     · Walksnail Avatar: im CE-Modus Kanal 1 bis 3 und 8 = 5735, 5770, 5805, 5839 MHz bei 25 Mbit/s (20 MHz).
       Race-Modus: R1 bis R8 auf den Raceband-Frequenzen, 20 MHz, 540p.
                                                        Quellen: https://oscarliang.com/fpv-channels/ (Tabelle „DJI/Avatar 25Mbps (CE)“),
                                                                 https://www.firstquadcopter.com/news/walksnail-avatar-range-hack-and-fcc-unlock/ (CE: Kanäle 1 bis 3 und 8),
                                                                 https://blog.unmanned.tech/racing-with-digital-walksnail-avatars-nano-v3-vtx-review/ (Race-Modus)
     · Frei nutzbar ohne Lizenz: 5725 bis 5875 MHz mit 25 mW EIRP (ERC/REC 70-03, Anhang 1, nicht spezifische Funkanwendungen
       geringer Reichweite; z. B. https://www.mca.org.mt/sites/default/files/Schedule%2004%20-%20Non-specific%20SRDs.pdf).
       Ein Kanal gilt als frei nutzbar, wenn seine Mittenfrequenz in diesem Bereich liegt (Analog also R3 bis R6, wie im Verein üblich).

     Mindestabstand zweier Kanäle (Mitte zu Mitte):
       halbe Bandbreite A + halbe Bandbreite B + Schutzabstand
       Schutzabstand 7 MHz, sobald ein Analogsignal beteiligt ist: Analog zu Analog ergibt so 15 + 15 + 7 = 37 MHz,
       genau das Raceband-Raster, das für gleichzeitiges Analogfliegen gebaut ist (oscarliang.com/fpv-channels).
       Digital zu Digital: Schutzabstand 0, die Signale dürfen sich nur nicht überlappen. Die Hersteller legen ihre eigenen
       Kanäle selbst so dicht (DJI O4 Kanal 1 und 2: 21 MHz Abstand bei 20 MHz Bandbreite).
       Beispiele: Analog/Analog 37 · Analog/HDZero 35,5 · Analog/DJI 32 · HDZero/HDZero 27 · DJI/DJI 20 MHz.
       Nicht abgebildet: Intermodulation (2·f1 − f2) bei sehr vielen Sendern und die Startphase digitaler Brillen.
       „weiß nicht“ wird wie Analog behandelt, weil Analog am meisten Platz braucht (sichere Seite).
     ===================================================================================== */
  const CORE = (() => {
    const BAND = { lo: 5725, hi: 5875 };
    const RB = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917];
    const rb = (pen) => RB.map((f, i) => ({ id: 'R' + (i + 1), f, pen: pen || 0 }));
    const SYS = {
      a: { kat: 'Analog', n: 'Analog', bw: 30, analog: 1, ch: rb() },
      4: { kat: 'DJI O4', n: 'DJI O4', bw: 20, ch: [{ id: 'CH1', f: 5768.5 }, { id: 'CH2', f: 5789.5 }, { id: 'CH3', f: 5814.5 }] },
      3: { kat: 'DJI O3', n: 'DJI O3', bw: 20, ch: [{ id: 'CH1', f: 5768.5 }, { id: 'CH2', f: 5804.5 }, { id: 'CH3', f: 5839.5 }] },
      h: { kat: 'HDZero', n: 'HDZero', bw: 27, ch: rb() },
      w: { kat: 'Walksnail', n: 'Walksnail', bw: 20, ch: [{ id: 'CH1', f: 5735 }, { id: 'CH2', f: 5770 }, { id: 'CH3', f: 5805 }, { id: 'CH8', f: 5839 }].concat(rb(1)) },
      u: { kat: 'weiß nicht', n: 'weiß nicht', bw: 30, analog: 1, ch: rb() }
    };
    const ORDER = ['a', '4', '3', 'h', 'w', 'u'];
    const GUARD = 7;
    const legal = f => f >= BAND.lo && f <= BAND.hi;
    const sysOf = kat => { const k = String(kat || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (k === 'analog') return 'a'; if (/o4/.test(k)) return '4'; if (/o3/.test(k)) return '3'; if (/hd ?zero/.test(k)) return 'h'; if (/walksnail|avatar/.test(k)) return 'w'; return 'u'; };
    const CC = {};
    function chan(s, id) {
      const S = SYS[s] || SYS.u; const key = s + ':' + id; if (CC[key]) return CC[key];
      const c = S.ch.find(x => x.id === id); if (!c) return null;
      return (CC[key] = { s, id, f: c.f, bw: S.bw, legal: legal(c.f), pen: c.pen || 0, race: s === 'w' && /^R/.test(id) });
    }
    const need = (A, B) => A.bw / 2 + B.bw / 2 + ((SYS[A.s].analog || SYS[B.s].analog) ? GUARD : 0);
    const compat = (A, B) => !!A && !!B && Math.abs(A.f - B.f) + 1e-6 >= need(A, B);
    const label = c => !c ? '' : c.race ? c.id + ' Race' : c.id;
    const mhz = f => String(f).replace('.', ',') + ' MHz';
    // Kanalwunsch steckt im Feld titel: „Wunsch R4“ oder „Fest CH2“
    const parseCh = (titel, s) => { const m = /^(wunsch|fest)\s*:?\s*(R[1-8]|CH[1-8])\b/i.exec(String(titel || '').trim()); if (!m) return {}; const id = m[2].toUpperCase(); if (!chan(s, id)) return {}; return m[1].toLowerCase() === 'fest' ? { fix: id } : { wish: id }; };
    const fmtCh = (id, fix) => id ? (fix ? 'Fest ' : 'Wunsch ') + id : '';
    // Kopterklasse steht vorne in der Notiz: „[75 mm Whoop] Text“
    const parseNote = t => { const m = /^\[([^\]]{1,30})\]\s*/.exec(String(t || '')); return m ? { cls: m[1], note: String(t).slice(m[0].length) } : { cls: '', note: String(t || '') }; };

    function options(p, all) {
      const S = SYS[p.sys] || SYS.u;
      if (p.lock && p.ch) { const c = chan(p.sys, p.ch); if (c) return [c]; } // von Hand gesetzt (Vorstand vor Ort) geht vor
      if (p.fix) { const c = chan(p.sys, p.fix); if (c) return [c]; }
      return S.ch.map(c => chan(p.sys, c.id)).filter(c => all || c.legal);
    }

    /* Kanalzuteilung: k Spalten = k gleichzeitig fliegende Plätze. Jeder Pilot einer Spalte verträgt sich mit jedem Piloten
       jeder anderen Spalte, darum stört sich nie jemand, egal wie die Durchgänge gemischt werden. Wer in derselben Spalte steht,
       fliegt nie gleichzeitig. Bisherige Kanäle (ch) werden bevorzugt behalten, damit niemand am Abend umstellen muss. */
    function assign(list, k, all) {
      const N = list.length; if (!N) return { ch: {}, cols: [], H: 0, k: 0 };
      k = Math.max(1, Math.min(k | 0 || 1, N));
      const opts = list.map(p => options(p, all));
      const hard = p => (p.fix || p.lock) ? 0 : 1;
      const order = list.map((p, i) => i).sort((a, b) => hard(list[a]) - hard(list[b]) || opts[a].length - opts[b].length || a - b);
      for (let H = Math.ceil(N / k); H <= N; H++) { const r = dfs(H); if (r) return r; }
      return dfs(N, true);
      function dfs(H, loose) {
        const pick = new Array(N).fill(null), size = new Array(k).fill(0), mem = Array.from({ length: k }, () => []);
        let steps = 0;
        const go = (i) => {
          if (i === N) return true;
          if (++steps > 60000) return false;
          const pi = order[i], p = list[pi], cands = [];
          let empty = false;
          for (let c = 0; c < k; c++) {
            if (size[c] >= H) continue;
            if (!size[c]) { if (empty) continue; empty = true; } // leere Spalten sind gleichwertig
            for (let oi = 0; oi < opts[pi].length; oi++) {
              const ch = opts[pi][oi];
              let ok = true;
              if (!loose) for (let c2 = 0; c2 < k && ok; c2++) { if (c2 === c) continue; for (const q of mem[c2]) if (!compat(ch, pick[q])) { ok = false; break; } }
              if (!ok) continue;
              let sc = size[c] * 30 + ch.pen * 40 + oi * .01;
              if (p.ch && ch.id === p.ch) sc -= 100;
              if (p.wish && ch.id === p.wish) sc -= 60;
              if (mem[c].some(q => Math.abs(pick[q].f - ch.f) < 1)) sc -= 25;
              cands.push([sc, c, ch]);
            }
          }
          cands.sort((x, y) => x[0] - y[0]);
          for (const [, c, ch] of cands) {
            pick[pi] = ch; size[c]++; mem[c].push(pi);
            if (go(i + 1)) return true;
            mem[c].pop(); size[c]--; pick[pi] = null;
            if (steps > 60000) return false;
          }
          return false;
        };
        if (!go(0) && !loose) return null;
        const ch = {}; list.forEach((p, i) => { ch[p.key] = (pick[i] || opts[i][0] || {}).id || null; });
        const cols = mem.filter(m => m.length).map(m => m.map(i => list[i].key));
        return { ch, cols, H, k: cols.length };
      }
    }

    /* Wie viele Piloten dieser Mischung können höchstens gleichzeitig störungsfrei fliegen? (größte verträgliche Auswahl) */
    function maxSimul(list, all, cap = 8) {
      const types = new Map();
      list.forEach(p => { const o = options(p, all); const key = p.sys + '|' + o.map(c => c.id).join(','); const t = types.get(key) || { o, n: 0 }; t.n++; types.set(key, t); });
      const items = []; [...types.values()].forEach((t, ti) => t.o.forEach(c => items.push({ ti, c, cap: t.n })));
      const used = new Map(), chosen = []; let best = 0;
      const go = (start) => {
        if (chosen.length > best) best = chosen.length;
        if (best >= cap || chosen.length + items.length - start <= best) return;
        for (let i = start; i < items.length; i++) {
          const it = items[i]; if ((used.get(it.ti) || 0) >= it.cap) continue;
          if (chosen.some(c => !compat(c, it.c))) continue;
          chosen.push(it.c); used.set(it.ti, (used.get(it.ti) || 0) + 1);
          go(i + 1);
          chosen.pop(); used.set(it.ti, used.get(it.ti) - 1);
          if (best >= cap) return;
        }
      };
      go(0); return best;
    }

    /* Durchgänge: jeder kommt gleich oft dran (wer am wenigsten geflogen ist und am längsten wartet, zuerst),
       im selben Durchgang nur Kanäle, die sich vertragen. keep = schon festgelegte Durchgänge (z. B. bereits geflogen). */
    function heats(pilots, chOf, k, nH, keep = []) {
      const fl = {}, last = {}, out = [];
      pilots.forEach(p => { fl[p.key] = 0; last[p.key] = -1e9; });
      keep.slice(0, nH).forEach((h, i) => { out.push(h.slice()); h.forEach(key => { if (key in fl) { fl[key]++; last[key] = i; } }); });
      for (let i = out.length; i < nH; i++) {
        const cand = pilots.slice().sort((a, b) => fl[a.key] - fl[b.key] || last[a.key] - last[b.key] || a.o - b.o);
        // Gerechtigkeit: Wer schon einen Flug mehr hat als der am wenigsten Geflogene, wartet. Lieber ein Platz frei als einer, der ständig fliegt.
        const min = cand.length ? fl[cand[0].key] : 0, pick = [];
        for (const p of cand) { if (pick.length >= k) break; if (fl[p.key] > min + 1) continue; const c = chOf[p.key]; if (c && pick.every(q => compat(chOf[q.key], c))) pick.push(p); }
        pick.sort((a, b) => chOf[a.key].f - chOf[b.key].f);
        out.push(pick.map(p => p.key)); pick.forEach(p => { fl[p.key]++; last[p.key] = i; });
      }
      return out;
    }
    /* Feste Gruppen: Piloten mit Kanal auf möglichst wenige Gruppen mit höchstens k Piloten verteilen, in jeder Gruppe verträgt
       sich jeder mit jedem. Die Gruppen fliegen reihum (Gruppe 1, 2, 3, wieder 1 …). prev = bisherige Gruppe je Pilot, damit
       beim Nachrechnen möglichst niemand die Gruppe wechseln muss. */
    function teams(pilots, chOf, k, prev = {}) {
      const ps = pilots.filter(p => chOf[p.key]), N = ps.length; if (!N) return [];
      k = Math.max(1, Math.min(k | 0 || 1, N));
      const deg = {}; ps.forEach(p => { deg[p.key] = ps.filter(q => q !== p && !compat(chOf[p.key], chOf[q.key])).length; });
      const order = ps.slice().sort((a, b) => deg[b.key] - deg[a.key] || a.o - b.o);
      for (let G = Math.ceil(N / k); G <= N; G++) {
        const cap = Math.ceil(N / G), mem = Array.from({ length: G }, () => []); let steps = 0;
        const go = (i) => {
          if (i === N) return true; if (++steps > 40000) return false;
          const p = order[i], c = chOf[p.key], cands = [];
          let empty = false;
          for (let g = 0; g < G; g++) {
            if (mem[g].length >= cap) continue;
            if (!mem[g].length && prev[p.key] !== g) { if (empty) continue; empty = true; }
            if (mem[g].some(q => !compat(c, chOf[q.key]))) continue;
            cands.push([(prev[p.key] === g ? -100 : 0) + mem[g].length * 10 + g * .01, g]);
          }
          cands.sort((x, y) => x[0] - y[0]);
          for (const [, g] of cands) { mem[g].push(p); if (go(i + 1)) return true; mem[g].pop(); if (steps > 40000) return false; }
          return false;
        };
        if (go(0)) {
          const out = mem.filter(m => m.length).map(m => m.slice().sort((a, b) => chOf[a.key].f - chOf[b.key].f).map(p => p.key));
          const rank = t => { const ix = t.map(key => prev[key]).filter(v => v != null); return ix.length ? Math.min(...ix) : 1e3 + Math.min(...t.map(key => (ps.find(p => p.key === key) || {}).o || 0)); };
          return out.sort((a, b) => rank(a) - rank(b));
        }
      }
      return ps.map(p => [p.key]);
    }
    const rotation = (tm, nH, keep = []) => { const out = keep.slice(0, nH).map(h => h.slice()); for (let i = out.length; i < nH; i++) out.push(tm.length ? tm[i % tm.length].slice() : []); return out; };
    const heatCount = (s) => { const cyc = s.slot + s.pause; return cyc > 0 ? Math.max(0, Math.min(120, Math.floor((s.e - s.b + s.pause) / cyc + 1e-9))) : 0; };
    // Konflikte innerhalb eines Durchgangs (nach Handänderungen möglich)
    function conflicts(keys, chOf) { const out = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = chOf[keys[i]], b = chOf[keys[j]]; if (a && b && !compat(a, b)) out.push([keys[i], keys[j]]); } return out; }

    return { BAND, RB, SYS, ORDER, GUARD, legal, sysOf, chan, need, compat, label, mhz, parseCh, fmtCh, parseNote, options, assign, maxSimul, heats, teams, rotation, heatCount, conflicts };
  })();

  root.FCS_TERMIN = CORE;
  if (typeof module === 'object' && module.exports) module.exports = CORE;
  if (typeof document === 'undefined') return;

  /* ===================================================================================== UI */
  const FCS = root.FCS || (root.FCS = {});
  const D = FCS.data || {};
  const C = CORE, SYS = C.SYS;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const anim = () => !!root.gsap && !RM;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const fmtMin = m => { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const sess = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const NAMEKEY = 'fcs-name', MINEKEY = 'fcs-meine-beitraege', CODEKEY = 'fcs-vorstand-sitzung';
  const myName = () => { try { return String(localStorage.getItem(NAMEKEY) || '').slice(0, 40); } catch (e) { return ''; } };
  const keepName = v => { try { localStorage.setItem(NAMEKEY, v); } catch (e) {} };
  const COLS = ['#3fe0ff', '#ffb020', '#3ee08a', '#c78bff', '#ff7a59', '#5aa2ff', '#ff6fae', '#c6f432'];
  const CLASSES = ['Tiny Whoop 65 mm', 'Tiny Whoop 75 mm', 'Cinewhoop', 'Toothpick', 'Sonstiges'];
  const SYSHINT = { a: 'Kanal am Sender (VTX) einstellen, meist per Knopf oder im Betaflight-Menü.', 4: 'In der Brille den Kanal von Hand wählen und 20 MHz einstellen.', 3: 'In der Brille den Kanal von Hand wählen und 20 MHz einstellen.', h: 'Kanal im VTX-Menü der HDZero-Brille oder in Betaflight einstellen.', w: 'Kanal in der Walksnail-Brille wählen. Bei „Race“ den Race-Modus einschalten.', u: 'Bis du es weißt, plant der Plan dich wie Analog ein, das braucht am meisten Platz.' };
  const IC = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    reload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
  };

  /* ---------- Termin aus der Adresse ---------- */
  const ALL = (FCS.termine ? FCS.termine() : []);
  const T = { d: '', t: null, st: 'idle', regs: [], plans: [], planErr: false, plan: null, pub: null, src: 'auto', dirty: false, notice: '', sel: null, showAll: false, replace: null, done: null, hintSeen: {} };
  function pickDate() {
    const q = new URLSearchParams(location.search).get('d');
    if (!q) { const n = (FCS.next && FCS.next()) || ALL[ALL.length - 1] || null; return n ? n.d : ''; }
    return /^\d{4}-\d{2}-\d{2}$/.test(q) && ALL.some(t => t.d === q) ? q : null;
  }

  /* ---------- Plan: Grundeinstellungen, Piloten aus den Einträgen ---------- */
  const DEF = () => ({ b: toMin((D.zeit || {}).von) || 1080, e: toMin((D.zeit || {}).bis) || 1260, slot: 3, pause: 2, k: 0, all: 0, mode: 'g' });
  function fromReg(r, o) {
    const sys = C.sysOf(r.kat), chs = C.parseCh(r.titel, sys), nt = C.parseNote(r.t);
    return { key: r.id, ref: r.id, n: String(r.n || 'Pilot').slice(0, 40), sys, fix: chs.fix || null, wish: chs.wish || null, ch: null, lock: false, here: true, cls: nt.cls, note: nt.note.slice(0, 200), o, d: r.d || '' };
  }
  const regsOf = d => T.regs.filter(x => x && x.b === 'termin:' + d).sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || String(a.id).localeCompare(String(b.id)));
  const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function encode(pl) {
    const idx = new Map();
    const p = pl.pilots.map((x, i) => { idx.set(x.key, i); return [x.ref || ('~' + x.n), x.sys, x.ch || '', (x.here ? 1 : 0) | (x.lock ? 2 : 0) | (x.sysx ? 4 : 0)]; });
    const s = pl.s, o = { v: 1, s: [s.b, s.e, s.slot, s.pause, s.k || 0, s.all ? 1 : 0, s.mode === 'm' ? 1 : 0], p };
    if (s.mode !== 'm' && pl.teams && pl.teams.length && p.length <= 36) o.g = pl.teams.map(t => t.filter(k => idx.has(k)).map(k => B36[idx.get(k)]).join('')).join('.');
    const hs = pl.heats.map(h => h.filter(k => idx.has(k)).map(k => idx.get(k)));
    o.h = p.length <= 36 ? hs.map(h => h.map(i => B36[i]).join('')).join('.') : hs;
    let j = JSON.stringify(o);
    if (j.length > 2000) { delete o.h; j = JSON.stringify(o); }
    if (j.length > 2000) { delete o.g; j = JSON.stringify(o); } // dann rechnet jedes Gerät die Durchgänge gleich nach
    return j;
  }
  function decode(o, regsD) {
    const s = Array.isArray(o.s) ? o.s : [], df = DEF();
    const pl = { s: { b: num(s[0], df.b), e: num(s[1], df.e), slot: Math.min(15, Math.max(1, num(s[2], df.slot))), pause: Math.min(15, Math.max(0, num(s[3], df.pause))), k: Math.min(8, Math.max(0, num(s[4], 0) | 0)), all: num(s[5], 0) ? 1 : 0, mode: num(s[6], 0) ? 'm' : 'g' }, pilots: [], heats: [], teams: [] };
    const by = new Map(regsD.map(r => [r.id, r])), keys = [];
    (Array.isArray(o.p) ? o.p : []).forEach((x, i) => {
      if (!Array.isArray(x) || typeof x[0] !== 'string') { keys.push(null); return; }
      const [ref, sys, ch, fl] = x, f = +fl || 0, sy = SYS[sys] ? String(sys) : 'u';
      let p;
      if (ref[0] === '~') p = { key: 'L:' + i + ':' + ref.slice(1, 41), ref: null, n: ref.slice(1, 41) || 'Pilot', sys: sy, sysx: 1, local: 1, fix: null, wish: null, cls: '', note: '', o: i };
      else { const r = by.get(ref); p = r ? fromReg(r, i) : { key: ref, ref, n: 'Pilot', sys: 'u', fix: null, wish: null, cls: '', note: '', o: i, gone: 1 }; if (f & 4) { p.sys = sy; p.sysx = 1; } }
      p.ch = C.chan(p.sys, ch) ? ch : null; p.lock = !!(f & 2) && !!p.ch; p.here = !!(f & 1);
      if (pl.pilots.some(q => q.key === p.key)) { keys.push(null); return; }
      pl.pilots.push(p); keys.push(p.key);
    });
    const hs = typeof o.h === 'string' ? o.h.split('.').map(h => [...h].map(c => B36.indexOf(c))) : Array.isArray(o.h) ? o.h : null;
    pl.heats = hs ? hs.map(h => (Array.isArray(h) ? h : []).map(i => keys[i]).filter(Boolean)) : [];
    pl.noHeats = !hs;
    if (typeof o.g === 'string') pl.teams = o.g.split('.').map(t => [...t].map(c => keys[B36.indexOf(c)]).filter(Boolean)).filter(t => t.length);
    return pl;
  }
  // Einträge und Plan zusammenführen: Ausgetragene raus, Neue rein. true = es hat sich etwas geändert
  function reconcile(pl, regsD) {
    let changed = false; const by = new Map(regsD.map(r => [r.id, r]));
    pl.pilots = pl.pilots.filter(p => { if (!p.ref) return true; if (!by.has(p.ref)) { changed = true; return false; } return true; });
    pl.pilots.forEach(p => { if (!p.ref) return; const f = fromReg(by.get(p.ref), p.o); p.n = f.n; p.cls = f.cls; p.note = f.note; p.d = f.d; p.fix = f.fix; p.wish = f.wish; if (!p.sysx && p.sys !== f.sys) { p.sys = f.sys; p.ch = null; p.lock = false; changed = true; } delete p.gone; });
    let o = pl.pilots.reduce((m, p) => Math.max(m, p.o), -1);
    regsD.forEach(r => { if (!pl.pilots.some(p => p.ref === r.id)) { pl.pilots.push(fromReg(r, ++o)); changed = true; } });
    const keys = new Set(pl.pilots.map(p => p.key));
    pl.heats = pl.heats.map(h => h.filter(k => keys.has(k)));
    pl.teams = (pl.teams || []).map(t => t.filter(k => keys.has(k))).filter(t => t.length);
    return changed;
  }
  const present = pl => pl.pilots.filter(p => p.here).sort((a, b) => a.o - b.o);
  const chMap = (pl = T.plan) => { const m = {}; pl.pilots.forEach(p => { m[p.key] = p.ch ? C.chan(p.sys, p.ch) : null; }); return m; };
  const kAuto = pl => { const ps = present(pl); return ps.length ? Math.max(1, Math.min(4, C.maxSimul(ps, !!pl.s.all))) : 4; };
  const kMax = pl => { const ps = present(pl); return ps.length ? C.maxSimul(ps, !!pl.s.all) : 0; };
  const kEff = pl => pl.s.k || kAuto(pl);
  function reassign(pl, fresh) {
    const ps = present(pl); if (!ps.length) return;
    const list = ps.map(p => ({ key: p.key, sys: p.sys, fix: p.fix, wish: p.wish, ch: fresh && !p.lock ? null : p.ch, lock: p.lock }));
    const r = C.assign(list, kEff(pl), !!pl.s.all);
    ps.forEach(p => { p.ch = r.ch[p.key] || p.ch; });
  }
  // Ab welchem Durchgang wird neu geplant? Am Abend selbst ab dem nächsten, der noch nicht begonnen hat.
  function dayStart(d) { return new Date(d + 'T00:00:00').getTime(); }
  function fromIdx(pl) {
    const t0 = dayStart(T.d) + pl.s.b * 6e4, cyc = (pl.s.slot + pl.s.pause) * 6e4, now = Date.now();
    if (now < t0 || now > dayStart(T.d) + 864e5) return 0;
    return Math.min(pl.heats.length, Math.floor((now - t0) / cyc) + 1);
  }
  const isTeams = pl => (pl.s.mode || 'g') !== 'm';
  // Feste Gruppen neu bilden; wer schon eine Gruppe hat, bleibt nach Möglichkeit darin
  function mkTeams(pl) {
    const prev = {}; (pl.teams || []).forEach((t, i) => t.forEach(k => { prev[k] = i; }));
    const ps = present(pl), m = chMap(pl);
    pl.teams = C.teams(ps, m, kEff(pl), prev);
  }
  function regen(pl, from) {
    const nH = C.heatCount(pl.s); const keep = pl.heats.slice(0, Math.min(from || 0, nH));
    const ps = present(pl); const m = chMap(pl);
    if (isTeams(pl)) { mkTeams(pl); pl.heats = C.rotation(pl.teams, nH, keep); return; }
    pl.heats = C.heats(ps.filter(p => m[p.key]), m, kEff(pl), nH, keep);
  }
  function fitCount(pl) {
    const nH = C.heatCount(pl.s);
    if (pl.heats.length > nH) pl.heats = pl.heats.slice(0, nH);
    else if (pl.heats.length < nH) {
      if (isTeams(pl)) { if (!(pl.teams && pl.teams.length)) mkTeams(pl); pl.heats = C.rotation(pl.teams, nH, pl.heats); return; }
      const ps = present(pl), m = chMap(pl); pl.heats = C.heats(ps.filter(p => m[p.key]), m, kEff(pl), nH, pl.heats);
    }
  }
  const teamOfKey = (key, pl = T.plan) => (pl.teams || []).findIndex(t => t.includes(key));
  // Gruppe eines Durchgangs: die Gruppe, aus der die meisten Piloten des Durchgangs stammen
  function teamOfHeat(i, pl = T.plan) {
    if (!isTeams(pl) || !(pl.teams && pl.teams.length)) return -1;
    const h = pl.heats[i] || [], cnt = {}; let best = -1, bn = 0;
    h.forEach(k => { const t = teamOfKey(k, pl); if (t >= 0) { cnt[t] = (cnt[t] || 0) + 1; if (cnt[t] > bn) { bn = cnt[t]; best = t; } } });
    return best;
  }

  function build() {
    const d = T.d, regsD = regsOf(d);
    const plans = T.plans.filter(x => x && x.b === 'plan:' + d);
    let pub = null;
    for (const x of plans) { try { const o = JSON.parse(x.t); if (o && o.v === 1) { pub = { id: x.id, d: x.d, o }; break; } } catch (e) {} }
    const loc = store.get('fcs-plan:' + d, null);
    let pl = null, src = 'auto';
    T.notice = '';
    if (loc && loc.plan && (loc.base || null) === (pub ? pub.id : null)) { pl = loc.plan; src = 'local'; }
    else if (pub) { pl = decode(pub.o, regsD); src = 'pub'; if (loc) { store.del('fcs-plan:' + d); T.notice = 'Der Vorstand hat einen neueren Plan veröffentlicht. Er ersetzt die Änderungen auf diesem Gerät.'; } }
    if (!pl) pl = { s: DEF(), pilots: [], heats: [] };
    pl.s = Object.assign(DEF(), pl.s || {});
    let changed = T.st === 'ok' ? reconcile(pl, regsD) : false;
    if (src === 'auto' && T.st !== 'ok') pl.pilots = pl.pilots || [];
    const needCh = present(pl).some(p => !p.ch || !C.chan(p.sys, p.ch));
    if (changed || needCh || src === 'auto') reassign(pl, false);
    if (changed || src === 'auto' || pl.noHeats || !pl.heats.length) { regen(pl, changed ? fromIdx(pl) : 0); if (changed && src !== 'auto') T.notice = T.notice || 'Seit dem veröffentlichten Plan hat sich die Liste geändert. Die kommenden Durchgänge sind neu eingeteilt.'; }
    else fitCount(pl);
    if (isTeams(pl) && !(pl.teams && pl.teams.length) && present(pl).length) regen(pl, fromIdx(pl));
    delete pl.noHeats;
    T.plan = pl; T.pub = pub; T.src = src; T.dirty = src === 'local';
  }
  function commit(msg) {
    store.set('fcs-plan:' + T.d, { base: T.pub ? T.pub.id : null, at: Date.now(), plan: T.plan });
    T.dirty = true; T.src = 'local';
    renderAll(); if (msg) toast(msg);
  }

  /* ---------- Laden (einmal pro Aufruf, „Neu laden“ holt frisch) ---------- */
  async function load(fresh) {
    if (!FCS.board || !FCS.board.on()) { T.st = 'off'; build(); renderAll(); return; }
    T.st = 'load'; renderList();
    try {
      const [regs, plans] = await Promise.all([FCS.board.list('termin:', { fresh }), FCS.board.list('plan:', { fresh }).catch(() => null)]);
      T.regs = regs.slice(); T.plans = plans || []; T.planErr = !plans; T.st = 'ok';
    } catch (e) { T.st = 'err'; }
    build(); renderAll();
  }

  /* ---------- Wer bin ich? ---------- */
  function meKey() {
    if (!T.plan) return null;
    const m = FCS.board ? FCS.board.mine() : {};
    const own = T.plan.pilots.find(p => p.ref && m[p.ref] && m[p.ref].pw && String(m[p.ref].b || '') === 'termin:' + T.d);
    if (own) return own.key;
    const pick = store.get('fcs-plan-ich:' + T.d, null); if (pick && T.plan.pilots.some(p => p.key === pick)) return pick;
    return null;
  }
  const ownReg = () => { const m = FCS.board ? FCS.board.mine() : {}; const r = regsOf(T.d).find(x => m[x.id] && m[x.id].pw && String(m[x.id].b || '') === 'termin:' + T.d); return r ? { r, pw: m[r.id].pw } : null; };

  /* ---------- Farben je Frequenz ---------- */
  // Kanäle auf (fast) derselben Frequenz (unter 6 MHz Abstand) bilden einen Platz im Band, z. B. Analog R4 (5769) und DJI CH1 (5768,5)
  function groups(pl = T.plan) {
    const m = chMap(pl), items = [];
    present(pl).forEach(p => { const c = m[p.key]; if (c) items.push({ p, c }); });
    items.sort((a, b) => a.c.f - b.c.f || a.p.o - b.p.o);
    const out = [];
    items.forEach(({ p, c }) => {
      let g = out.find(x => Math.abs(x.f - c.f) < 6);
      if (!g) { g = { f: c.f, bw: 0, ids: [], keys: [], chs: [] }; out.push(g); }
      g.bw = Math.max(g.bw, c.bw); if (!g.ids.includes(C.label(c))) g.ids.push(C.label(c)); g.keys.push(p.key); g.chs.push(c);
    });
    out.forEach((x, i) => { x.c = COLS[i % COLS.length]; x.label = x.ids.slice().sort((a, b) => /^R/.test(b) - /^R/.test(a)).join(' / '); x.short = (x.ids.find(id => /^R\d/.test(id)) || x.ids[0]).replace(' Race', ''); });
    return out;
  }
  const colorOf = (key, gs) => { const g = gs.find(x => x.keys.includes(key)); return g ? g.c : '#5d7395'; };
  const pName = key => { const p = T.plan.pilots.find(x => x.key === key); return p ? p.n : '?'; };
  const pOf = key => T.plan.pilots.find(x => x.key === key);

  /* =========================== Darstellung =========================== */
  let live = null; const say = t => { if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); };
  function toast(t) {
    let el = $('#tp-toast'); if (!el) { el = document.createElement('div'); el.id = 'tp-toast'; el.className = 'tp-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3200);
  }
  function renderAll() { renderHead(); renderMe(); renderList(); renderSpec(); renderChList(); renderConf(); renderTeams(); renderSet(); renderHeats(); renderPub(); renderLivePrev(); if (L.open) liveFill(true); }

  function renderHead() {
    const t = T.t; if (!t) return;
    const wd = FCS.fmtDate(t.d, 1).split(',')[0], dd = new Date(t.d + 'T12:00:00');
    const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    $('#tp-datum').textContent = `${dd.getDate()}. ${MON[dd.getMonth()]}`;
    $('.tp-h1-k').textContent = `Hallenabend · ${wd}`;
    const pl = T.plan, s = pl ? pl.s : DEF();
    $('#tp-ort').innerHTML = `<b>${esc(t.halle.name)}</b> · ${esc(t.halle.adresse)} · ${fmtMin(s.b)} bis ${fmtMin(s.e)} Uhr${t.vorbei ? ' · <span class="tp-past">Schon geflogen</span>' : ''}`;
    $('#tp-route').href = FCS.route(t.halle.lat, t.halle.lng, t.halle.adresse);
    $('#tp-route').setAttribute('aria-label', `Route zur ${t.halle.name} (öffnet Google Maps)`);
    const nReg = regsOf(t.d).length;
    setNum('#tp-st-n', T.st === 'load' ? null : T.st === 'err' || T.st === 'off' || !Number.isFinite(nReg) ? '–' : nReg);
    setNum('#tp-st-k', pl ? Math.max(1, Math.min(kEff(pl), kMax(pl) || kEff(pl))) : 4);
    setNum('#tp-st-h', pl ? C.heatCount(pl.s) : 0);
    $('#tp-osd-k').textContent = pl && pl.s.all ? 'R1 bis R8' : 'R3 bis R6';
    const cta = $('#tp-cta'); if (cta) { const me = meKey(); cta.innerHTML = me ? 'Mein Abend <span class="arr">→</span>' : t.vorbei ? 'Wer dabei war <span class="arr">→</span>' : 'Ich bin dabei <span class="arr">→</span>'; }
    // Umschalter
    const sw = $('#tp-switch');
    sw.innerHTML = ALL.map(x => { const n = T.st === 'ok' ? regsOf(x.d).length : null; return `<a class="tp-sw${x.d === t.d ? ' on' : ''}${x.vorbei ? ' done' : ''}" href="termin.html?d=${x.d}"${x.d === t.d ? ' aria-current="page"' : ''} data-d="${x.d}"><b>${esc(FCS.fmtDate(x.d))}</b><span>${esc(x.halle.name.replace('Großwaldhalle ', '').replace('Glück-Auf-Halle ', ''))}</span>${n ? `<i aria-label="${n} eingetragen">${n}</i>` : ''}</a>`; }).join('');
    const on = $('.tp-sw.on', sw); if (on && sw.scrollWidth > sw.clientWidth) sw.scrollLeft = on.offsetLeft - sw.clientWidth / 2 + on.offsetWidth / 2;
    document.title = `Hallenabend ${FCS.fmtDate(t.d)} · Flight Club Saar e. V.`;
  }
  function setNum(sel, v) {
    const el = $(sel); if (!el) return;
    if (v == null) { el.textContent = '…'; return; }
    const from = parseInt(el.textContent, 10);
    if (!anim() || isNaN(from) || from === v) { el.textContent = v; return; }
    const o = { v: from }; gsap.to(o, { v, duration: .8, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
  }

  /* ---------- Mein Abend ---------- */
  function myHeats(key) { const s = T.plan.s, cyc = s.slot + s.pause; return T.plan.heats.map((h, i) => h.includes(key) ? { i, at: s.b + i * cyc } : null).filter(Boolean); }
  function renderMe() {
    const box = $('#tp-me'), form = $('#tp-form'); if (!box || !T.plan) return;
    const key = meKey(), p = key && pOf(key), own = ownReg();
    if (T.done) { box.hidden = true; form.hidden = true; return; }
    if (!p && T.t && T.t.vorbei) {
      const n = FCS.next && FCS.next();
      box.hidden = false; form.hidden = true;
      box.innerHTML = `<p class="tp-me-k hud"><span class="dot" aria-hidden="true"></span>Schon geflogen</p><p class="tp-me-hint">Dieser Hallenabend ist vorbei. Eintragen geht für die kommenden Abende.</p>${n ? `<div class="btns"><a class="btn amber solid" href="termin.html?d=${n.d}" data-go="${n.d}">Zum ${esc(FCS.fmtDate(n.d))} <span class="arr">→</span></a></div>` : ''}`;
      return;
    }
    if (!p) { box.hidden = true; form.hidden = false; return; }
    const c = p.ch && C.chan(p.sys, p.ch), gs = groups(), hs = myHeats(key), nowM = new Date().getHours() * 60 + new Date().getMinutes();
    const today = T.d === new Date().toISOString().slice(0, 10);
    const upcoming = today ? hs.filter(h => h.at + T.plan.s.slot > nowM) : hs;
    box.hidden = false; form.hidden = !(T.replace || T.formOpen);
    box.innerHTML = `<p class="tp-me-k hud"><span class="dot" aria-hidden="true"></span>Dein Abend</p>
      <div class="tp-me-row"><span class="tp-me-ch" style="--c:${colorOf(key, gs)}">${c ? esc(C.label(c)) : '–'}</span>
      <div class="tp-me-t"><h3>${esc(p.n)}</h3><p>${esc(SYS[p.sys].n)}${c ? ' · ' + esc(C.mhz(c.f)) + (c.bw === 20 && p.sys !== 'w' ? ' · 20 MHz' : '') : ''}${p.here ? '' : ' · <b class="tp-warn">als nicht da markiert</b>'}</p></div></div>
      ${isTeams(T.plan) && teamOfKey(key) >= 0 ? `<p class="tp-me-g">Du fliegst in <b>Gruppe ${teamOfKey(key) + 1}</b> zusammen mit ${T.plan.teams[teamOfKey(key)].filter(x => x !== key).map(x => esc(pName(x))).join(', ') || 'niemandem sonst'}.</p>` : ''}
      <p class="tp-me-hint">${esc(SYSHINT[p.sys] || '')}</p>
      ${hs.length ? `<p class="tp-me-n"><b>${hs.length}</b> Flüge eingeplant${upcoming.length && upcoming.length < hs.length ? `, noch ${upcoming.length}` : ''}</p><ul class="tp-me-times" aria-label="Deine Startzeiten">${upcoming.slice(0, 8).map(h => `<li><time>${fmtMin(h.at)}</time><span>#${pad(h.i + 1)}</span></li>`).join('')}${upcoming.length > 8 ? `<li class="more">+${upcoming.length - 8}</li>` : ''}</ul>` : '<p class="mute">Noch keine Flüge eingeplant.</p>'}
      <div class="btns">${own && p.ref === own.r.id && p.sys === 'u' ? '<button class="btn amber solid" type="button" data-me="add">Videosystem ergänzen</button>' : ''}<a class="btn" href="#plan">Zum Abendplan</a>${own && p.ref === own.r.id ? `<button class="btn ghost" type="button" data-me="del">${IC.trash}Austragen</button>` : '<button class="btn ghost" type="button" data-me="forget">Das bin ich nicht</button>'}</div>
      <button class="tp-link" type="button" data-me="other">Jemand anderen eintragen</button>`;
  }

  /* ---------- Formular ---------- */
  function initForm() {
    const chips = $('#tp-sys-chips');
    chips.innerHTML = C.ORDER.map(k => `<label class="chip"><input type="radio" name="tp-sys" value="${k}"><span>${esc(SYS[k].n)}</span></label>`).join('');
    $('#tp-cls-chips').innerHTML = CLASSES.map(c => `<label class="chip"><input type="radio" name="tp-cls" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('');
    $('#tp-late-s').innerHTML = C.ORDER.map(k => `<option value="${k}"${k === 'u' ? ' selected' : ''}>${esc(SYS[k].n)}</option>`).join('');
    $('#tp-name').value = myName();
    $('#tp-pw').value = FCS.board && FCS.board.code ? FCS.board.code() : '';
    const sel = $('#tp-ch');
    const fillCh = () => {
      const s = ($('input[name=tp-sys]:checked') || {}).value, all = T.plan && T.plan.s.all, cur = sel.value;
      sel.innerHTML = '<option value="">Kein Wunsch, der Plan teilt zu</option>' + (s ? SYS[s].ch.map(c => { const ch = C.chan(s, c.id); return `<option value="${ch.id}">${esc(C.label(ch))} · ${esc(C.mhz(ch.f))}${ch.legal ? '' : ' (außerhalb 5725 bis 5875 MHz)'}</option>`; }).join('') : '');
      sel.disabled = !s; $('#tp-fix').disabled = !s; if (!s) $('#tp-fix').checked = false;
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
      void all;
    };
    chips.addEventListener('change', () => { fillCh(); $('#tp-f-sys').classList.remove('bad'); $('#tp-form-hint').classList.add('off'); });
    fillCh();
    $('#tp-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('#tp-form-x').addEventListener('click', () => { T.replace = null; T.formOpen = false; $('#tp-form-x').hidden = true; renderMe(); FCS.scrollTo('#eintragen'); });
    // Selbst-Impuls: die Videosysteme leuchten einmal nacheinander auf
    if (anim() && root.ScrollTrigger) ScrollTrigger.create({ trigger: chips, start: 'top 80%', once: true, onEnter: () => { if ($('input[name=tp-sys]:checked')) return; const sp = $$('.chip span', chips); sp.forEach((x, i) => setTimeout(() => { x.classList.add('demo'); setTimeout(() => x.classList.remove('demo'), 420); }, i * 130)); gsap.fromTo(sp, { scale: 1 }, { scale: 1.07, duration: .21, stagger: .13, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' }); } });
    $('#tp-late-f').addEventListener('submit', e => { e.preventDefault(); addLate(); });
  }
  function fieldBad(id, bad) { const f = $(id); if (f) f.classList.toggle('bad', !!bad); return !bad; }
  async function submit() {
    const name = $('#tp-name').value.trim().replace(/\s+/g, ' ').slice(0, 40), sys = ($('input[name=tp-sys]:checked') || {}).value, pw = $('#tp-pw').value.trim();
    const ok = [fieldBad('#tp-f-name', name.length < 2), fieldBad('#tp-f-sys', !sys), fieldBad('#tp-f-pw', pw.length < 4), fieldBad('#tp-f-ok', !$('#tp-ok-dsgvo').checked)];
    const msg = $('#tp-form-msg'); msg.hidden = true;
    if (ok.includes(false)) { const first = $('#tp-form .bad'); if (first) { FCS.scrollTo(first, -170); const i = $('input', first); if (i) i.focus({ preventScroll: true }); } return; }
    const ch = $('#tp-ch').value, fix = $('#tp-fix').checked && !!ch, cls = ($('input[name=tp-cls]:checked') || {}).value || '', note = $('#tp-note').value.trim().slice(0, 200);
    const fields = { b: 'termin:' + T.d, n: name, kat: SYS[sys].kat, pw };
    if (ch) fields.titel = C.fmtCh(ch, fix);
    const t = (cls ? '[' + cls + '] ' : '') + note; if (t.trim()) fields.t = t.trim();
    const btn = $('#tp-submit'); btn.disabled = true; btn.textContent = 'Wird eingetragen …';
    let r = { ok: false, err: 'netz' };
    try { r = await FCS.board.add(fields); } catch (e) {}
    btn.disabled = false; btn.textContent = 'Eintragen';
    if (!r.ok) { msg.textContent = r.err === 'abgelehnt' ? 'Das hat nicht geklappt. Prüf deinen Namen und versuch es nochmal.' : r.err === 'aus' ? 'Eintragen ist gerade nicht möglich.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'; msg.hidden = false; say(msg.textContent); return; }
    keepName(name);
    const old = T.replace; T.replace = null; T.formOpen = false; $('#tp-form-x').hidden = true;
    T.regs.unshift({ id: r.id, b: 'termin:' + T.d, n: name, kat: fields.kat, titel: fields.titel || null, t: fields.t || null, d: new Date().toISOString().slice(0, 19) });
    if (old) { try { const dr = await FCS.board.del(old.id, old.pw); if (dr.ok) T.regs = T.regs.filter(x => x.id !== old.id); } catch (e) {} }
    T.done = { id: r.id, pw: r.pw, name };
    store.del('fcs-plan-ich:' + T.d);
    rebuildKeep();
    renderDone();
  }
  // Nach eigenem Eintragen/Austragen: Plan neu zusammenführen, ohne die Änderungen auf dem Gerät zu verwerfen
  function rebuildKeep() {
    const pl = T.plan, regsD = regsOf(T.d);
    if (pl) { const ch = reconcile(pl, regsD); if (ch) { reassign(pl, false); regen(pl, fromIdx(pl)); } if (T.src === 'local') store.set('fcs-plan:' + T.d, { base: T.pub ? T.pub.id : null, at: Date.now(), plan: pl }); }
    else build();
    renderAll();
  }
  function renderDone() {
    const box = $('#tp-done'), d = T.done; if (!d) { box.hidden = true; return; }
    const p = pOf(d.id), c = p && p.ch && C.chan(p.sys, p.ch), gs = groups();
    const wa = `Mein Löschcode für den Hallenabend am ${FCS.fmtDate(T.d, 1)} beim Flight Club Saar: ${d.pw}\n${location.origin}${location.pathname}?d=${T.d}`;
    $('#tp-form').hidden = true; $('#tp-me').hidden = true; box.hidden = false;
    box.innerHTML = `<p class="tp-me-k hud" style="color:var(--green)"><span class="dot" aria-hidden="true"></span>Eingetragen</p>
      <h3 class="tp-done-h">Du bist dabei, ${esc(d.name)}!</h3>
      ${c ? `<div class="tp-me-row"><span class="tp-me-ch" style="--c:${colorOf(d.id, gs)}">${esc(C.label(c))}</span><div class="tp-me-t"><h3>Dein Kanal</h3><p>${esc(SYS[p.sys].n)} · ${esc(C.mhz(c.f))}</p></div></div>` : ''}
      <p class="tp-code-l">Dein Löschcode</p><p class="tp-code" id="tp-code">${esc(d.pw)}</p>
      <div class="btns"><button class="btn solid" type="button" id="tp-copy">${IC.copy}<span>Code kopieren</span></button><a class="btn" href="https://wa.me/?text=${encodeURIComponent(wa)}" target="_blank" rel="noopener">${IC.wa}Per WhatsApp an mich senden</a></div>
      <p class="mute tp-done-m">Auf diesem Gerät merken wir ihn uns. Mit dem Code kannst du dich jederzeit selbst austragen.</p>
      <div class="btns"><a class="btn amber" href="#plan">Meine Flugzeiten ansehen</a><button class="btn ghost" type="button" id="tp-done-x">Fertig</button></div>`;
    $('#tp-copy').addEventListener('click', () => { const l = $('#tp-copy span'); const okf = () => { l.textContent = 'Kopiert'; }; if (navigator.clipboard) navigator.clipboard.writeText(d.pw).then(okf).catch(selc); else selc(); function selc() { const r = document.createRange(); r.selectNodeContents($('#tp-code')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); l.textContent = 'Markiert, jetzt kopieren'; } });
    $('#tp-done-x').addEventListener('click', () => { T.done = null; box.hidden = true; renderMe(); FCS.scrollTo('#eintragen'); });
    if (anim()) { gsap.from(box, { scale: .94, opacity: 0, duration: .6, ease: 'back.out(2)', clearProps: 'transform,opacity' }); if (root.ScrambleTextPlugin) gsap.from('#tp-code', { duration: 1, scrambleText: { text: d.pw, chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', speed: .6 }, delay: .2 }); }
    FCS.scrollTo(box, -140); say(`Du bist eingetragen. Dein Löschcode ist ${d.pw}.`);
  }
  function addLate() {
    const n = $('#tp-late-n').value.trim().replace(/\s+/g, ' ').slice(0, 40), sys = $('#tp-late-s').value;
    const fld = $('#tp-late-n').closest('.field'); if (n.length < 2) { fld.classList.add('bad'); $('#tp-late-n').focus(); return; } fld.classList.remove('bad');
    const pl = T.plan, o = pl.pilots.reduce((m, p) => Math.max(m, p.o), -1) + 1;
    pl.pilots.push({ key: 'L:' + o + ':' + n, ref: null, n, sys: SYS[sys] ? sys : 'u', sysx: 1, local: 1, fix: null, wish: null, ch: null, lock: false, here: true, cls: '', note: '', o });
    reassign(pl, false); regen(pl, fromIdx(pl));
    $('#tp-late-n').value = '';
    const np = pOf('L:' + o + ':' + n), nc = np && np.ch && C.chan(np.sys, np.ch);
    commit(nc ? `${n} ist im Plan, Kanal ${C.label(nc)}.` : `${n} ist im Plan.`);
  }

  /* ---------- Wer kommt ---------- */
  const ini = s => { const w = String(s).trim().split(/\s+/).filter(Boolean).map(x => [...x]); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || ['?']).slice(0, 2).join('')).toUpperCase(); };
  function renderList() {
    const ul = $('#tp-list'), cnt = $('#tp-who-n'); if (!ul) return;
    if (T.st === 'load' && !(T.plan && T.plan.pilots.length)) { cnt.textContent = ''; ul.innerHTML = Array.from({ length: 4 }, () => '<li class="tp-p sk" aria-hidden="true"><span class="tp-av"></span><span class="tp-sk-l"></span></li>').join('') + '<li class="sr">Liste wird geladen</li>'; return; }
    const pl = T.plan; if (!pl) return;
    const err = T.st === 'err' ? `<li class="tp-err"><p>Gerade nicht erreichbar, versuch es gleich nochmal.</p><button class="tp-mini" type="button" data-retry>${IC.reload}<span>Nochmal</span></button></li>` : '';
    const gs = groups(), me = meKey(), m = chMap();
    const ps = pl.pilots.slice().sort((a, b) => (b.here - a.here) || a.o - b.o);
    const nHere = ps.filter(p => p.here).length;
    cnt.textContent = ps.length ? `${nHere} ${nHere === 1 ? 'Pilot' : 'Piloten'}${ps.length > nHere ? ` · ${ps.length - nHere} nicht da` : ''}` : '';
    if (!ps.length) { ul.innerHTML = err + (T.st !== 'err' ? '<li class="tp-empty"><p>Noch niemand eingetragen. Sei die oder der Erste!</p></li>' : ''); return; }
    ul.innerHTML = err + ps.map(p => {
      const c = m[p.key], col = colorOf(p.key, gs);
      const sub = [SYS[p.sys].n, p.cls, p.local ? 'vor Ort dazu' : '', p.fix ? 'Kanal fest' : p.wish ? 'Wunsch ' + p.wish : ''].filter(Boolean).join(' · ');
      return `<li class="tp-p${p.here ? '' : ' away'}${p.key === me ? ' me' : ''}" data-k="${esc(p.key)}">
        <button class="tp-p-b" type="button" data-pk="${esc(p.key)}" aria-label="${esc(p.n)}: Kanal, Anwesenheit und mehr">
          <span class="tp-av" style="--c:${col}" aria-hidden="true">${esc(ini(p.n))}</span>
          <span class="tp-p-t"><b>${p.key === me ? '<em>Du</em> · ' : ''}${esc(p.n)}</b><small>${esc(sub)}${p.note ? ' · „' + esc(p.note.slice(0, 60)) + (p.note.length > 60 ? '…' : '') + '“' : ''}</small></span>
          <span class="tp-chb${c && !c.legal ? ' out' : ''}" style="--c:${col}">${p.here ? (c ? esc(C.label(c)) : '–') : 'nicht da'}</span>
        </button>
      </li>`;
    }).join('');
  }

  /* ---------- Frequenzband ---------- */
  const F0 = 5640, F1 = 5935, X = f => ((f - F0) / (F1 - F0) * 100).toFixed(2);
  function renderSpec() {
    const box = $('#tp-spec'); if (!box || !T.plan) return;
    const gs = groups(), shared = new Set();
    for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (gs[i].chs.some(a => gs[j].chs.some(b => !C.compat(a, b)))) { shared.add(i); shared.add(j); }
    const all = T.plan.s.all; let lift = 0;
    box.innerHTML = `<div class="tp-band" style="left:${X(C.BAND.lo)}%;width:${(X(C.BAND.hi) - X(C.BAND.lo)).toFixed(2)}%"><span>frei nutzbar · 5725 bis 5875 MHz · 25 mW</span></div>
      ${C.RB.map((f, i) => `<span class="tp-tick${C.legal(f) || all ? '' : ' off'}" style="left:${X(f)}%"><b>R${i + 1}</b><small>${f}</small></span>`).join('')}
      <div class="tp-sweep" aria-hidden="true"></div>
      ${gs.map((g, i) => { const h = Math.min(74, 40 + (g.keys.length - 1) * 12); lift = i && g.f - gs[i - 1].f < 18 ? lift + 1 : 0; return `<button class="tp-hill${shared.has(i) ? ' shared' : ''}" type="button" data-g="${i}" style="left:${X(g.f - g.bw / 2)}%;width:${(X(g.f + g.bw / 2) - X(g.f - g.bw / 2)).toFixed(2)}%;--h:${h}%;--c:${g.c};--lift:${lift % 2}" aria-label="${esc(g.label)}, ${esc(C.mhz(g.f))}, ${g.keys.length} ${g.keys.length === 1 ? 'Pilot' : 'Piloten'}"><i></i><span>${esc(g.short)}<small>${g.keys.length}×</small></span></button>`; }).join('')}
      ${gs.length ? '' : '<p class="tp-spec-0">Sobald sich jemand einträgt, erscheinen hier die Kanäle.</p>'}`;
    if (anim() && !box._seen && gs.length) {
      box._seen = true;
      const go = () => { gsap.from($$('.tp-hill i', box), { scaleY: 0, transformOrigin: '50% 100%', duration: .9, ease: 'expo.out', stagger: .08 }); const sw = $('.tp-sweep', box); if (sw) gsap.fromTo(sw, { x: 0, opacity: 1 }, { x: () => box.clientWidth, duration: 1.8, ease: 'power1.inOut', onComplete: () => { sw.style.opacity = 0; } }); };
      if (root.ScrollTrigger) ScrollTrigger.create({ trigger: box, start: 'top 80%', once: true, onEnter: go }); else go();
    }
  }
  function renderChList() {
    const box = $('#tp-chlist'); if (!box || !T.plan) return;
    const gs = groups(), m = chMap();
    box.innerHTML = gs.map((g, i) => `<article class="tp-chc" data-g="${i}" style="--c:${g.c}">
      <header><b>${esc(g.label)}</b><span>${esc(C.mhz(g.f))} · ${g.bw} MHz breit</span></header>
      <ul>${g.keys.map(k => { const p = pOf(k); return `<li><button type="button" data-pk="${esc(k)}"><span>${esc(p.n)}</span><small>${esc(SYS[p.sys].n)}${g.ids.length > 1 && m[k] ? ' · ' + esc(C.label(m[k])) : ''}${m[k] && m[k].race ? ' · Race-Modus' : ''}${p.lock || p.fix ? ' · fest' : ''}</small></button></li>`; }).join('')}</ul>
      ${g.keys.length > 1 ? '<p class="tp-chc-n">Gleicher Platz im Band: Diese Piloten fliegen nie gleichzeitig.</p>' : ''}
    </article>`).join('');
  }
  function renderConf() {
    const box = $('#tp-conf'); if (!box || !T.plan) return;
    const pl = T.plan, m = chMap(), out = [];
    pl.heats.forEach((h, i) => C.conflicts(h, m).forEach(([a, b]) => { const sug = suggest(b, i); out.push(`<div class="tp-cf"><p><b>Durchgang ${i + 1}:</b> ${esc(pName(a))} (${esc(C.label(m[a]))}) und ${esc(pName(b))} (${esc(C.label(m[b]))}) stören sich.</p><div class="tp-cf-a">${sug ? `<button class="tp-mini" type="button" data-sug="${esc(b)}" data-ch="${esc(sug.id)}">${esc(pName(b))} auf ${esc(C.label(sug))}</button>` : ''}<button class="tp-mini" type="button" data-fixh="${i}">Durchgang neu einteilen</button></div></div>`); }));
    const ps = present(pl), unk = ps.filter(p => p.sys === 'u').length, dji = ps.some(p => p.sys === '3' || p.sys === '4'), race = ps.some(p => m[p.key] && m[p.key].race), out5 = ps.filter(p => m[p.key] && !m[p.key].legal);
    const info = [];
    if (unk) info.push(`${unk} ${unk === 1 ? 'Pilot hat' : 'Piloten haben'} kein Videosystem angegeben und ${unk === 1 ? 'ist' : 'sind'} wie Analog eingeplant (braucht am meisten Platz).`);
    if (dji) info.push('DJI O3 und O4: In der Brille den Kanal von Hand wählen und 20 MHz Bandbreite einstellen. Mit 40 MHz belegt DJI fast das halbe Band.');
    if (race) info.push('Walksnail mit „Race“ am Kanal: In der Brille den Race-Modus einschalten (540p, Raceband-Frequenzen).');
    if (out5.length && !pl.s.all) info.push(`${out5.map(p => esc(p.n)).join(', ')}: fester Kanal außerhalb von 5725 bis 5875 MHz.`);
    const k = kEff(pl), kx = kMax(pl);
    if (ps.length && pl.s.k && kx && pl.s.k > kx) info.push(`Mit diesen Videosystemen passen höchstens ${kx} gleichzeitig störungsfrei in die Luft. Der Plan nimmt ${kx}.`);
    void k;
    box.innerHTML = (out.length ? `<div class="tp-cfs" role="alert">${out.join('')}</div>` : '') + (info.length ? `<ul class="tp-info">${info.map(t => `<li>${t}</li>`).join('')}</ul>` : '');
  }
  // Ausweichkanal für Pilot key, der in Durchgang hi stört: verträgt sich mit allen in seinen Durchgängen
  function suggest(key, hi) {
    const p = pOf(key); if (!p) return null; const m = chMap();
    const mates = new Set(); T.plan.heats.forEach(h => { if (h.includes(key)) h.forEach(k => { if (k !== key) mates.add(k); }); });
    const opts = C.options({ sys: p.sys }, !!T.plan.s.all);
    return opts.find(c => c.id !== p.ch && [...mates].every(k => !m[k] || C.compat(c, m[k]))) || opts.find(c => c.id !== p.ch && T.plan.heats[hi].every(k => k === key || !m[k] || C.compat(c, m[k]))) || null;
  }
  function renderTable() {
    const box = $('#tp-table'); if (!box) return;
    const row = (k, extra) => { const S = SYS[k]; return `<div class="tp-tr"><h4>${esc(S.n)} <small>${S.bw} MHz breit</small></h4><p class="tp-tr-c">${S.ch.map(c => { const ch = C.chan(k, c.id); return `<span class="${ch.legal ? '' : 'off'}"><b>${esc(C.label(ch))}</b> ${esc(String(ch.f).replace('.', ','))}</span>`; }).join('')}</p>${extra ? `<p class="mute">${extra}</p>` : ''}</div>`; };
    box.innerHTML = `<div class="tp-trs">
      ${row('a', 'Raceband, 37 MHz Abstand. Frei nutzbar sind R3 bis R6.')}
      ${row('4', 'Manueller Modus mit 20 oder 10 MHz. Mit 40 oder 60 MHz gibt es nur einen Kanal bei 5794,5 MHz.')}
      ${row('3', 'Manueller Modus mit 20 oder 10 MHz. Mit 40 MHz gibt es nur einen Kanal bei 5794,5 MHz.')}
      ${row('h', 'Raceband-Frequenzen, verträgt sich auf dem 37-MHz-Raster mit Analog. In Europa R3 bis R6.')}
      ${row('w', 'CE-Kanäle 1 bis 3 und 8 bei 25 Mbit/s. „Race“ = Race-Modus auf den Raceband-Frequenzen (540p).')}
    </div>
    <h4 class="tp-rule-h">So rechnet der Plan den Abstand</h4>
    <p>Mindestabstand Mitte zu Mitte = halbe Bandbreite des einen + halbe Bandbreite des anderen + 7 MHz Schutzabstand, sobald ein Analogsignal beteiligt ist. Zwischen zwei Digitalsignalen reicht es, dass sie sich nicht überlappen.</p>
    <ul class="tp-rule"><li><b>37 MHz</b> Analog zu Analog</li><li><b>35,5 MHz</b> Analog zu HDZero</li><li><b>32 MHz</b> Analog zu DJI oder Walksnail</li><li><b>27 MHz</b> HDZero zu HDZero</li><li><b>20 MHz</b> DJI zu DJI</li></ul>
    <p>Frei nutzbar ohne Lizenz ist im 5,8-GHz-Band der Bereich 5725 bis 5875 MHz mit höchstens 25 mW Sendeleistung (EIRP). Der Plan teilt nur Kanäle zu, deren Mitte darin liegt, außer du schaltest oben alle Raceband-Kanäle frei. „Weiß nicht“ plant der Plan wie Analog ein.</p>
    <h4 class="tp-rule-h">Quellen</h4>
    <ul class="tp-src">
      <li><a href="https://oscarliang.com/fpv-channels/" target="_blank" rel="noopener">Oscar Liang: 5.8GHz FPV Channels &amp; Frequency Chart</a> (Raceband, Walksnail CE, Bandbreiten)</li>
      <li><a href="https://www.dji.com/o4-air-unit/specs" target="_blank" rel="noopener">DJI: O4 Air Unit, technische Daten</a> (Kanäle und Bandbreiten)</li>
      <li><a href="https://www.getfpv.com/dji-o3-air-unit.html" target="_blank" rel="noopener">DJI O3 Air Unit, Datenblatt</a> (Kanäle und Bandbreiten)</li>
      <li><a href="https://www.flyingtech.co.uk/wp-content/uploads/2025/05/HDZero_VTX_UserManual_v0.7.pdf" target="_blank" rel="noopener">HDZero VTX User Manual v0.7</a> (Kanäle, 8 Piloten mit Analog)</li>
      <li><a href="https://www.firstquadcopter.com/news/walksnail-avatar-range-hack-and-fcc-unlock/" target="_blank" rel="noopener">Walksnail: CE-Modus mit Kanal 1 bis 3 und 8</a></li>
      <li><a href="https://blog.unmanned.tech/racing-with-digital-walksnail-avatars-nano-v3-vtx-review/" target="_blank" rel="noopener">Walksnail Race-Modus</a> (Raceband, 20 MHz)</li>
      <li><a href="https://www.mca.org.mt/sites/default/files/Schedule%2004%20-%20Non-specific%20SRDs.pdf" target="_blank" rel="noopener">ERC/REC 70-03: 5725 bis 5875 MHz, 25 mW EIRP</a> (europaweit, Beispiel Malta)</li>
    </ul>`;
  }

  const stepper = (id, lbl, val, unit) => `<div class="tp-step" data-step="${id}"><span class="lbl" id="tp-l-${id}">${lbl}</span><div class="tp-step-c"><button type="button" data-d="-1" aria-label="${lbl} weniger">−</button><output aria-labelledby="tp-l-${id}" aria-live="polite">${val}${unit ? '<small> ' + unit + '</small>' : ''}</output><button type="button" data-d="1" aria-label="${lbl} mehr">+</button></div></div>`;
  const kShow = pl => Math.min(kEff(pl), Math.max(1, kMax(pl) || kEff(pl)));

  /* ---------- Gruppen (Gruppe 1, 2, 3 … reihum) ---------- */
  function renderTeams() {
    const box = $('#tp-teams'); if (!box || !T.plan) return;
    const pl = T.plan, ps = present(pl);
    if (!ps.length) { box.innerHTML = '<div class="tp-tm-h"><div><h3 class="h3">Die Gruppen</h3><p class="tp-tm-sum">Sobald Piloten eingetragen sind, teilt der Plan sie hier in Gruppen auf: Gruppe 1, 2, 3 fliegen reihum.</p></div></div>'; return; }
    if (!isTeams(pl)) { box.innerHTML = `<div class="tp-tm-h"><div><h3 class="h3">Die Gruppen</h3><p class="tp-tm-sum">Der Abend läuft gerade gemischt: Jeder fliegt mit wechselnden Partnern.</p></div><button class="btn solid" type="button" data-mode="g">Feste Gruppen verwenden</button></div>`; return; }
    const tm = pl.teams || [], m = chMap(), gs = groups(), s = pl.s, cyc = s.slot + s.pause, focusD = document.activeElement && box.contains(document.activeElement) && document.activeElement.dataset.d;
    const times = ti => pl.heats.map((h, i) => teamOfHeat(i) === ti ? fmtMin(s.b + i * cyc) : null).filter(Boolean);
    const inT = new Set(tm.flat()), rest = ps.filter(p => !inT.has(p.key));
    const ka = kAuto(pl), kx = kMax(pl);
    box.innerHTML = `<div class="tp-tm-h"><div><h3 class="h3">Die Gruppen</h3>
        <p class="tp-tm-sum"><b>${ps.length}</b> ${ps.length === 1 ? 'Pilot' : 'Piloten'} · <b>${tm.length}</b> ${tm.length === 1 ? 'Gruppe' : 'Gruppen'} · Reihenfolge ${tm.map((t, i) => i + 1).join(' → ')}${tm.length > 1 ? ' → wieder 1' : ''}</p>
        <p class="tp-tm-note">Höchstens ${kShow(pl)} pro Gruppe, gleichmäßig verteilt. In jeder Gruppe hat jeder einen eigenen Kanal, keiner stört den anderen.${kx && s.k && s.k > kx ? ` Mit diesen Videosystemen passen höchstens ${kx} gleichzeitig störungsfrei in die Luft.` : ''}</p></div>
      ${stepper('k', 'Piloten pro Gruppe', s.k ? s.k : 'Auto ' + ka, '')}</div>
      <ol class="tp-tms">${tm.map((t, i) => { const tt = times(i); return `<li class="tp-tm" data-t="${i}">
        <header><b>Gruppe ${i + 1}</b><span>${t.length} ${t.length === 1 ? 'Pilot' : 'Piloten'}</span></header>
        <ul>${t.map(key => { const p = pOf(key), c = m[key]; return p ? `<li><button type="button" data-pk="${esc(key)}"><span class="tp-tm-ch" style="--c:${colorOf(key, gs)}">${c ? esc(C.label(c)) : '–'}</span><span class="tp-tm-n">${esc(p.n)}<small>${esc(SYS[p.sys].n)}${c ? ' · ' + esc(C.mhz(c.f)) : ''}</small></span></button></li>` : ''; }).join('')}</ul>
        <p class="tp-tm-t">${tt.length ? `Startet um ${tt.slice(0, 4).join(', ')}${tt.length > 4 ? ' und ' + (tt.length - 4) + '-mal mehr' : ''}` : 'Passt mit diesen Zeiten nicht in den Abend.'}</p>
      </li>`; }).join('')}</ol>
      ${rest.length ? `<p class="tp-tm-note">Ohne Kanal und darum noch in keiner Gruppe: ${rest.map(p => esc(p.n)).join(', ')}.</p>` : ''}
      <p class="tp-tm-act"><button class="tp-mini" type="button" data-tregen>${IC.reload}<span>Gruppen neu mischen</span></button><span class="mute">Tausch: im Abendplan zwei Piloten nacheinander antippen.</span></p>`;
    if (focusD) { const b = $(`[data-step="k"] [data-d="${focusD}"]`, box); if (b) b.focus({ preventScroll: true }); }
  }
  function setMode(v) {
    const pl = T.plan; if (!pl || (pl.s.mode || 'g') === v) return;
    pl.s.mode = v; if (v === 'g') pl.teams = [];
    regen(pl, fromIdx(pl)); commit(v === 'g' ? 'Feste Gruppen: Gruppe 1, 2, 3 … fliegen reihum.' : 'Gemischt: Jeder fliegt mit wechselnden Partnern.');
  }
  function onTeams(e) {
    if (e.target.closest('[data-mode]')) { setMode(e.target.closest('[data-mode]').dataset.mode); return; }
    if (e.target.closest('[data-tregen]')) { T.plan.teams = []; regen(T.plan, fromIdx(T.plan)); T.sel = null; commit('Gruppen neu gemischt.'); return; }
    const b = e.target.closest('[data-pk]'); if (b) { openPilot(b.dataset.pk); return; }
    onSet(e);
  }

  /* ---------- Einstellungen ---------- */
  function renderSet() {
    const box = $('#tp-set'); if (!box || !T.plan) return;
    const al = $('#tp-all'); if (al) al.checked = !!T.plan.s.all;
    const s = T.plan.s, ka = kAuto(T.plan), nH = C.heatCount(s), ps = present(T.plan), k = kShow(T.plan), tmode = isTeams(T.plan), G = (T.plan.teams || []).length;
    const per = ps.length ? Math.round(T.plan.heats.reduce((a, h) => a + h.length, 0) / ps.length) : 0;
    const step = stepper;
    const focusId = document.activeElement && box.contains(document.activeElement) ? (document.activeElement.id || (document.activeElement.closest('[data-step]') ? document.activeElement.closest('[data-step]').dataset.step + ':' + document.activeElement.dataset.d : '')) : '';
    box.innerHTML = `<div class="tp-set-g">
      <div class="field"><label for="tp-s-b">Beginn</label><input type="time" id="tp-s-b" value="${fmtMin(s.b)}" step="300"></div>
      <div class="field"><label for="tp-s-e">Ende</label><input type="time" id="tp-s-e" value="${fmtMin(s.e)}" step="300"></div>
      ${step('slot', 'Flug pro Akku', String(s.slot).replace('.', ','), 'min')}
      ${step('pause', 'Wechselpause', String(s.pause).replace('.', ','), 'min')}
      ${step('k', tmode ? 'Pro Gruppe' : 'Gleichzeitig', s.k ? s.k : 'Auto ' + ka, '')}
    </div>
    <fieldset class="tp-mode"><legend class="lbl">Ablauf</legend><div class="chips"><label class="chip"><input type="radio" name="tp-mode" value="g"${tmode ? ' checked' : ''}><span>Feste Gruppen reihum</span></label><label class="chip"><input type="radio" name="tp-mode" value="m"${tmode ? '' : ' checked'}><span>Gemischt, wechselnde Partner</span></label></div></fieldset>
    <p class="tp-set-sum"><b>${nH}</b> Durchgänge im ${String(s.slot + s.pause).replace('.', ',')}-Minuten-Takt · ${tmode && G ? `<b>${G}</b> ${G === 1 ? 'Gruppe' : 'Gruppen'} mit bis zu <b>${k}</b> Piloten` : `<b>${k}</b> gleichzeitig`}${ps.length ? ` · jeder fliegt etwa <b>${per}</b>-mal` : ''}</p>`;
    if (focusId) { const el = focusId.includes(':') ? $(`[data-step="${focusId.split(':')[0]}"] [data-d="${focusId.split(':')[1]}"]`, box) : $('#' + focusId, box); if (el) el.focus({ preventScroll: true }); }
  }
  function onSet(e) {
    const b = e.target.closest('[data-step] [data-d]'); if (!b) return;
    const id = b.closest('[data-step]').dataset.step, d = +b.dataset.d, s = T.plan.s;
    if (id === 'slot') { s.slot = Math.min(15, Math.max(1, s.slot + d * .5)); fitTimes(); }
    else if (id === 'pause') { s.pause = Math.min(15, Math.max(0, s.pause + d * .5)); fitTimes(); }
    else if (id === 'k') { const cur = s.k || kAuto(T.plan); let n = cur + d; const mx = Math.min(8, Math.max(1, present(T.plan).length)); if (n < 1) n = 1; if (n > mx) n = mx; s.k = n === kAuto(T.plan) ? 0 : n; reassign(T.plan, false); regen(T.plan, fromIdx(T.plan)); commit(); }
  }
  function fitTimes() { fitCount(T.plan); commit(); }
  function onTime(e) {
    const el = e.target; if (el.name === 'tp-mode') { setMode(el.value); return; }
    if (!el.matches('#tp-s-b, #tp-s-e')) return;
    const v = toMin(el.value); if (v == null) return;
    const s = T.plan.s;
    if (el.id === 'tp-s-b') s.b = v; else s.e = v;
    if (s.e <= s.b) s.e = Math.min(1439, s.b + 30);
    fitTimes();
  }

  /* ---------- Durchgänge ---------- */
  const SHOW = 8;
  function nowIdx() { const s = T.plan.s, t0 = dayStart(T.d) + s.b * 6e4, cyc = (s.slot + s.pause) * 6e4, now = Date.now(); if (now < t0 || now > t0 + T.plan.heats.length * cyc) return -1; return Math.floor((now - t0) / cyc); }
  function renderHeats() {
    const box = $('#tp-heats'), tools = $('#tp-tools'); if (!box || !T.plan) return;
    const pl = T.plan, s = pl.s, cyc = s.slot + s.pause, m = chMap(), gs = groups(), me = meKey(), k = kEff(pl), ni = nowIdx();
    const n = pl.heats.length;
    const sel = T.sel;
    tools.innerHTML = `<p class="tp-selmsg" role="status">${sel ? `<b>${esc(pName(sel.k))}</b> ausgewählt. Tipp einen Piloten in einem anderen Durchgang zum Tauschen oder einen freien Platz. <button class="tp-link" type="button" data-unsel>Abbrechen</button>` : FINE ? 'Tauschen: Pilot auf einen anderen ziehen oder beide nacheinander antippen.' : 'Tauschen: zwei Piloten nacheinander antippen.'}</p>
      <div class="tp-tools-b"><button class="tp-mini" type="button" data-regen>${IC.reload}<span>Neu einteilen</span></button>${me ? `<button class="tp-mini${T.onlyMe ? ' on' : ''}" type="button" data-onlyme aria-pressed="${T.onlyMe ? 'true' : 'false'}">Nur meine</button>` : ''}</div>`;
    if (!n || !present(pl).length) { box.innerHTML = `<p class="tp-empty-p">${present(pl).length ? 'Mit diesen Zeiten passt kein Durchgang in den Abend. Stell Beginn und Ende ein.' : 'Sobald Piloten eingetragen sind, steht hier der Plan.'}</p>`; return; }
    let idx = pl.heats.map((h, i) => i);
    if (T.onlyMe && me) idx = idx.filter(i => pl.heats[i].includes(me));
    const startAt = ni >= 0 && !T.showAll ? Math.max(0, ni - 1) : 0;
    const vis = T.showAll ? idx : idx.filter(i => i >= startAt).slice(0, SHOW);
    box.innerHTML = vis.map(i => {
      const h = pl.heats[i], at = s.b + i * cyc, cf = C.conflicts(h, m), past = ni > i, now = ni === i;
      const chips = h.map(key => { const c = m[key]; return `<button class="tp-chip${key === me ? ' me' : ''}${sel && sel.k === key && sel.h === i ? ' sel' : ''}${cf.some(x => x.includes(key)) ? ' bad' : ''}" type="button" data-k="${esc(key)}" data-h="${i}" style="--c:${colorOf(key, gs)}" aria-pressed="${sel && sel.k === key && sel.h === i ? 'true' : 'false'}"><span>${esc(pName(key))}</span><i>${c ? esc(C.label(c)) : '–'}</i></button>`; }).join('');
      const free = Math.max(0, k - h.length);
      return `<article class="tp-heat${past ? ' past' : ''}${now ? ' now' : ''}${cf.length ? ' bad' : ''}${me && h.includes(me) ? ' mine' : ''}" data-h="${i}">
        <header class="tp-hh"><b class="tp-hn">${pad(i + 1)}</b><span class="tp-ht"><time>${fmtMin(at)}</time><small>bis ${fmtMin(at + s.slot)}</small></span>${teamOfHeat(i) >= 0 ? `<span class="tp-hg">Gruppe ${teamOfHeat(i) + 1}</span>` : ''}${now ? '<span class="tp-hnow">Jetzt</span>' : ''}
          <span class="tp-hmv"><button type="button" data-mv="-1" data-h="${i}" aria-label="Durchgang ${i + 1} früher"${i === 0 ? ' disabled' : ''}>${IC.up}</button><button type="button" data-mv="1" data-h="${i}" aria-label="Durchgang ${i + 1} später"${i === n - 1 ? ' disabled' : ''}>${IC.down}</button></span></header>
        <div class="tp-hs">${chips}${Array.from({ length: free }, () => `<button class="tp-free" type="button" data-free="${i}"${sel ? '' : ' tabindex="-1"'}>frei</button>`).join('')}</div>
        ${cf.length ? `<p class="tp-hc">Störung: ${cf.map(([a, b]) => `${esc(pName(a))} und ${esc(pName(b))}`).join(', ')}</p>` : ''}
      </article>`;
    }).join('') + (idx.length > SHOW || T.showAll ? `<button class="btn ghost tp-more-h" type="button" data-showall>${T.showAll ? 'Weniger zeigen' : `Alle ${idx.length} Durchgänge zeigen`}</button>` : '');
    // Selbst-Impuls: der erste Pilot blinkt einmal auf und zeigt, dass man ihn antippen kann
    if (anim() && !T.hintSeen.heats && root.ScrollTrigger) { T.hintSeen.heats = 1; ScrollTrigger.create({ trigger: box, start: 'top 75%', once: true, onEnter: () => { const c = $('.tp-chip', box); if (c) gsap.fromTo(c, { scale: 1 }, { scale: 1.08, duration: .22, yoyo: true, repeat: 3, ease: 'power2.inOut', clearProps: 'transform' }); } }); }
  }
  function swap(a, b) { // a,b = {h,k} oder {h, free:true}
    const H = T.plan.heats;
    if (isTeams(T.plan) && T.plan.teams && T.plan.teams.length) {
      const pl = T.plan, tm = pl.teams, ta = teamOfKey(a.k);
      if (ta < 0) return false;
      if (b.free) { const tb = teamOfHeat(b.h); if (tb < 0 || tb === ta) { toast(`${pName(a.k)} ist schon in dieser Gruppe.`); return false; } tm[ta] = tm[ta].filter(x => x !== a.k); tm[tb].push(a.k); }
      else { const tb = teamOfKey(b.k); if (tb < 0 || tb === ta) { toast('Die beiden sind in derselben Gruppe.'); return false; } tm[ta] = tm[ta].map(x => x === a.k ? b.k : x); tm[tb] = tm[tb].map(x => x === b.k ? a.k : x); }
      const m = chMap(); pl.teams = tm.filter(t => t.length).map(t => t.sort((x, y) => (m[x] ? m[x].f : 0) - (m[y] ? m[y].f : 0)));
      pl.heats = C.rotation(pl.teams, C.heatCount(pl.s), pl.heats.slice(0, fromIdx(pl)));
      return true;
    }
    if (b.free) { if (H[b.h].includes(a.k)) { toast(`${pName(a.k)} fliegt in diesem Durchgang schon.`); return false; } H[a.h] = H[a.h].filter(x => x !== a.k); H[b.h].push(a.k); }
    else {
      if (a.h === b.h) return false;
      if (H[b.h].includes(a.k) || H[a.h].includes(b.k)) { toast('Einer der beiden fliegt im anderen Durchgang schon.'); return false; }
      H[a.h] = H[a.h].map(x => x === a.k ? b.k : x); H[b.h] = H[b.h].map(x => x === b.k ? a.k : x);
    }
    const m = chMap(); [a.h, b.h].forEach(i => H[i].sort((x, y) => (m[x] ? m[x].f : 0) - (m[y] ? m[y].f : 0)));
    return true;
  }
  function onHeats(e) {
    const t = e.target;
    if (t.closest('[data-showall]')) { T.showAll = !T.showAll; renderHeats(); return; }
    if (t.closest('[data-unsel]')) { T.sel = null; renderHeats(); return; }
    if (t.closest('[data-onlyme]')) { T.onlyMe = !T.onlyMe; renderHeats(); return; }
    if (t.closest('[data-regen]')) { if (isTeams(T.plan)) T.plan.teams = []; regen(T.plan, fromIdx(T.plan)); T.sel = null; commit('Neu eingeteilt.'); return; }
    const mv = t.closest('[data-mv]');
    if (mv) { const i = +mv.dataset.h, j = i + +mv.dataset.mv, H = T.plan.heats; if (j < 0 || j >= H.length) return; [H[i], H[j]] = [H[j], H[i]]; T.sel = null; commit(); const b = $(`[data-mv="${mv.dataset.mv}"][data-h="${j}"]`); if (b && !b.disabled) b.focus({ preventScroll: true }); flash(j); return; }
    const fr = t.closest('[data-free]');
    if (fr) { if (!T.sel) { toast('Tipp zuerst einen Piloten an.'); return; } const to = +fr.dataset.free; if (swap(T.sel, { h: to, free: true })) { const k = T.sel.k; T.sel = null; commit(movedMsg(k, to)); flash(to); } return; }
    const ch = t.closest('.tp-chip');
    if (ch && !ch._dragged) {
      const cur = { h: +ch.dataset.h, k: ch.dataset.k };
      if (!T.sel) { T.sel = cur; renderHeats(); focusChip(cur); say(`${pName(cur.k)} ausgewählt.`); return; }
      if (T.sel.h === cur.h && T.sel.k === cur.k) { T.sel = null; renderHeats(); focusChip(cur); return; }
      if (T.sel.h === cur.h) { T.sel = cur; renderHeats(); focusChip(cur); return; }
      const a = T.sel; if (swap(a, cur)) { T.sel = null; commit(swapMsg(a.k, cur.k)); flash(a.h); flash(cur.h); }
    }
  }
  const movedMsg = (k, h) => isTeams(T.plan) && teamOfKey(k) >= 0 ? `${pName(k)} fliegt jetzt in Gruppe ${teamOfKey(k) + 1}.` : `${pName(k)} in Durchgang ${h + 1} verschoben.`;
  const swapMsg = (a, b) => isTeams(T.plan) && teamOfKey(a) >= 0 ? `${pName(a)} und ${pName(b)} haben die Gruppe getauscht.` : `${pName(a)} und ${pName(b)} getauscht.`;
  const focusChip = c => { const el = $(`.tp-chip[data-h="${c.h}"][data-k="${CSS.escape(c.k)}"]`); if (el) el.focus({ preventScroll: true }); };
  const flash = i => { if (RM) return; const el = $(`.tp-heat[data-h="${i}"]`); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1100); };
  // Ziehen mit der Maus: Pilot auf einen anderen Piloten oder einen freien Platz fallen lassen
  function dragInit() {
    const box = $('#tp-heats'); let d = null;
    box.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return; const ch = e.target.closest('.tp-chip'); if (!ch) return;
      d = { ch, x: e.clientX, y: e.clientY, on: false, ghost: null };
    });
    addEventListener('pointermove', e => {
      if (!d) return;
      if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) { d.on = true; d.ghost = d.ch.cloneNode(true); d.ghost.className += ' tp-ghost'; d.ghost.removeAttribute('data-k'); document.body.appendChild(d.ghost); d.ch.classList.add('drag'); }
      if (d.on) { d.ghost.style.transform = `translate(${e.clientX + 8}px,${e.clientY + 8}px)`; const tg = document.elementFromPoint(e.clientX, e.clientY); $$('.tp-drop').forEach(x => x.classList.remove('tp-drop')); const z = tg && tg.closest('.tp-chip:not(.drag), .tp-free'); if (z) z.classList.add('tp-drop'); }
    });
    addEventListener('pointerup', e => {
      if (!d) return; const dd = d; d = null;
      if (!dd.on) return;
      dd.ghost.remove(); dd.ch.classList.remove('drag'); $$('.tp-drop').forEach(x => x.classList.remove('tp-drop'));
      dd.ch._dragged = true; setTimeout(() => { dd.ch._dragged = false; }, 50);
      const tg = document.elementFromPoint(e.clientX, e.clientY), z = tg && tg.closest('.tp-chip, .tp-free'); if (!z || z === dd.ch) return;
      const a = { h: +dd.ch.dataset.h, k: dd.ch.dataset.k };
      const b = z.classList.contains('tp-free') ? { h: +z.dataset.free, free: true } : { h: +z.dataset.h, k: z.dataset.k };
      if (swap(a, b)) { T.sel = null; commit(b.free ? movedMsg(a.k, b.h) : swapMsg(a.k, b.k)); flash(a.h); flash(b.h); }
    });
  }

  /* ---------- Veröffentlichen ---------- */
  function renderPub() {
    const box = $('#tp-pub'); if (!box || !T.plan) return;
    const when = T.pub && T.pub.d ? new Date(String(T.pub.d).replace(' ', 'T')) : null;
    const whenTxt = when && !isNaN(when) ? `${pad(when.getDate())}.${pad(when.getMonth() + 1)}. um ${pad(when.getHours())}:${pad(when.getMinutes())} Uhr` : '';
    const status = T.dirty ? `<b class="tp-warn">Auf diesem Gerät geändert.</b> Die anderen sehen ${T.pub ? 'den zuletzt veröffentlichten Plan' : 'den automatisch berechneten Plan'}.`
      : T.pub ? `<b class="tp-good">Veröffentlicht</b>${whenTxt ? ' am ' + whenTxt : ''}. Alle sehen diesen Plan.` : 'Noch kein Plan veröffentlicht. Alle sehen den automatisch berechneten Plan.';
    box.innerHTML = `${T.notice ? `<p class="tp-notice">${esc(T.notice)}</p>` : ''}${T.planErr ? '<p class="tp-notice">Der veröffentlichte Plan war gerade nicht abrufbar. Angezeigt wird der Plan dieses Geräts.</p>' : ''}
      <div class="tp-pub-r"><p class="tp-pub-s">${status}</p>
      <div class="btns"><button class="btn solid" type="button" data-pub>Für alle veröffentlichen</button>${T.dirty ? '<button class="btn ghost" type="button" data-reset>Änderungen verwerfen</button>' : ''}<button class="btn ghost" type="button" data-reload>${IC.reload}Neu laden</button></div></div>
      <p class="tp-pub-h">Änderungen gelten sofort auf diesem Gerät. Veröffentlichen kann der Vorstand mit seinem Code.</p>`;
  }
  function onPub(e) {
    if (e.target.closest('[data-pub]')) openPub();
    else if (e.target.closest('[data-reset]')) { store.del('fcs-plan:' + T.d); build(); renderAll(); toast('Änderungen verworfen.'); }
    else if (e.target.closest('[data-reload]')) reload();
  }
  async function reload() { toast('Wird neu geladen …'); await load(true); toast(T.st === 'ok' ? 'Neu geladen.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'); }
  function openPub() {
    const code = sess.get(CODEKEY) || '';
    dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">Für alle veröffentlichen</h2>
      <p class="mute">Danach sehen alle auf ihrem Handy genau diesen Plan. Ältere Fassungen dieses Abends werden aufgeräumt.</p>
      <form id="tp-pub-f" novalidate>
        <div class="field"><label for="tp-vc">Vorstandscode</label><input id="tp-vc" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" value="${esc(code)}" required></div>
        <p class="tp-msg" id="tp-pub-msg" role="alert" hidden></p>
        <p class="mute tp-small">Der Code bleibt nur für diese Sitzung im Browser und wird nirgends gespeichert.</p>
        <div class="btns"><button class="btn solid" type="submit">Veröffentlichen</button><button class="btn ghost" type="button" data-close>Abbrechen</button></div>
      </form>`);
    const f = $('#tp-pub-f'), inp = $('#tp-vc'); setTimeout(() => inp.focus(), 60);
    f.addEventListener('submit', async ev => {
      ev.preventDefault(); const pw = inp.value.trim(), msg = $('#tp-pub-msg'), btn = $('[type=submit]', f);
      if (pw.length < 4) { msg.textContent = 'Bitte den Vorstandscode eingeben.'; msg.hidden = false; inp.focus(); return; }
      btn.disabled = true; btn.textContent = 'Wird veröffentlicht …'; msg.hidden = true;
      const r = await publish(pw);
      btn.disabled = false; btn.textContent = 'Veröffentlichen';
      if (r.ok) { closeDlg(); toast('Veröffentlicht. Alle sehen jetzt diesen Plan.'); return; }
      msg.textContent = r.err === 'abgelehnt' ? 'Code stimmt nicht.' : r.err === 'lang' ? 'Der Plan ist zu groß zum Veröffentlichen.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'; msg.hidden = false;
      if (r.err === 'abgelehnt') { sess.del(CODEKEY); inp.select(); if (anim()) gsap.fromTo(inp, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)', clearProps: 'transform' }); }
    });
  }
  // Veröffentlichen: neuer Eintrag 'plan:<d>' mit dem Vorstandscode; danach ältere Fassungen mit demselben Code löschen.
  async function publish(pw) {
    const t = encode(T.plan); if (t.length > 2000) return { ok: false, err: 'lang' };
    let r = { ok: false, err: 'netz' };
    try { r = await FCS.board.add({ b: 'plan:' + T.d, n: 'Vorstand', t, pw }, [], { merken: false }); } catch (e) {}
    // FCS.board merkt sich den Code jedes Beitrags auf dem Gerät. Für den Plan wäre das der Vorstandscode: sofort wieder entfernen.
    if (r && r.id) forget(r.id);
    if (!r.ok) return r;
    sess.set(CODEKEY, pw);
    const old = T.plans.filter(x => x && x.b === 'plan:' + T.d && x.id !== r.id);
    for (const x of old) { try { const dr = await FCS.board.del(x.id, pw); if (dr.ok) T.plans = T.plans.filter(y => y.id !== x.id); } catch (e) {} forget(x.id); }
    T.plans.unshift({ id: r.id, b: 'plan:' + T.d, n: 'Vorstand', t, d: new Date().toISOString().slice(0, 19) });
    store.del('fcs-plan:' + T.d);
    T.pub = { id: r.id, d: new Date().toISOString().slice(0, 19), o: JSON.parse(t) }; T.src = 'pub'; T.dirty = false; T.notice = '';
    renderAll();
    return { ok: true };
  }
  function forget(id) { try { const m = JSON.parse(localStorage.getItem(MINEKEY) || '{}'); if (m[id]) { delete m[id]; localStorage.setItem(MINEKEY, JSON.stringify(m)); } } catch (e) {} }

  /* ---------- Dialog ---------- */
  let lastFocus = null;
  function dlg(html) {
    const d = $('#tp-dlg'); $('#tp-dlg-body').innerHTML = html; lastFocus = document.activeElement;
    if (!d.open) { d.showModal ? d.showModal() : d.setAttribute('open', ''); document.documentElement.classList.add('tp-lock'); }
    if (anim()) gsap.fromTo('.tp-dlg-in', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  function closeDlg() { const d = $('#tp-dlg'); if (d.open) { d.close ? d.close() : d.removeAttribute('open'); } }
  function dlgInit() {
    const d = $('#tp-dlg');
    d.addEventListener('close', () => { document.documentElement.classList.remove('tp-lock'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); });
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeDlg(); });
    $('#tp-dlg-x').addEventListener('click', closeDlg);
  }

  /* ---------- Pilot: Kanal, Videosystem, Anwesenheit, Austragen, Melden ---------- */
  function openPilot(key, mode) {
    const p = pOf(key); if (!p) return;
    const m = chMap(), c = m[key], pl = T.plan, me = meKey() === key;
    const mates = new Set(); pl.heats.forEach(h => { if (h.includes(key)) h.forEach(k => { if (k !== key) mates.add(k); }); });
    const others = present(pl).filter(q => q.key !== key && m[q.key]);
    const own = ownReg(), isOwn = own && p.ref === own.r.id;
    if (mode === 'del') return delForm(p, isOwn ? own.pw : '');
    if (mode === 'report') return reportForm(p);
    if (mode === 'forgot') return forgotForm(p);
    const opts = SYS[p.sys].ch.map(x => C.chan(p.sys, x.id));
    const chBtns = opts.map(o => {
      const clash = others.filter(q => !C.compat(o, m[q.key]));
      const blocked = !o.legal && !pl.s.all && p.fix !== o.id;
      const cur = c && c.id === o.id;
      const st = cur ? 'aktuell' : blocked ? 'außerhalb 5725 bis 5875 MHz' : clash.length ? `teilt sich mit ${clash.slice(0, 2).map(q => q.n).join(', ')}${clash.length > 2 ? ' +' + (clash.length - 2) : ''}` : 'frei';
      return `<button class="tp-opt${cur ? ' cur' : ''}${clash.length && !cur ? ' clash' : ''}" type="button" data-setch="${o.id}"${blocked ? ' disabled' : ''} aria-pressed="${cur ? 'true' : 'false'}"><b>${esc(C.label(o))}</b><span>${esc(C.mhz(o.f))}</span><small>${esc(st)}</small></button>`;
    }).join('');
    dlg(`<p class="tp-dlg-k hud">${esc(SYS[p.sys].n)}${p.cls ? ' · ' + esc(p.cls) : ''}</p>
      <h2 class="tp-dlg-h" id="tp-dlg-h">${esc(p.n)}</h2>
      ${p.note ? `<p class="tp-dlg-note">„${esc(p.note)}“</p>` : ''}
      <div class="tp-dlg-sec">
        <h3>Kanal ${p.fix ? '<small>vom Piloten als fest angegeben</small>' : p.lock ? '<small>von Hand gesetzt</small>' : '<small>automatisch</small>'}</h3>
        <div class="tp-opts">${chBtns}</div>
        <p class="tp-small mute">${esc(SYSHINT[p.sys] || '')} „Teilt sich“ heißt: Die beiden fliegen nie gleichzeitig.</p>
        ${p.lock && !p.fix ? '<button class="tp-link" type="button" data-auto>Wieder automatisch zuteilen</button>' : ''}
      </div>
      <div class="tp-dlg-sec tp-dlg-2">
        <div class="field"><label for="tp-p-sys">Videosystem</label><select id="tp-p-sys">${C.ORDER.map(k => `<option value="${k}"${k === p.sys ? ' selected' : ''}>${esc(SYS[k].n)}</option>`).join('')}</select></div>
        <div class="tp-here" role="group" aria-label="Anwesenheit"><button type="button" class="tp-tg${p.here ? ' on' : ''}" data-here="1" aria-pressed="${p.here}">Ist da</button><button type="button" class="tp-tg${p.here ? '' : ' on'}" data-here="0" aria-pressed="${!p.here}">Ist nicht da</button></div>
      </div>
      <div class="tp-dlg-sec tp-dlg-acts">
        <button class="tp-mini" type="button" data-itsme>${me ? IC.ok + '<span>Das bin ich</span>' : '<span>Das bin ich</span>'}</button>
        ${p.local ? `<button class="tp-mini" type="button" data-rmlocal>${IC.trash}<span>Aus dem Plan nehmen</span></button>` : `<button class="tp-mini" type="button" data-del>${IC.trash}<span>Austragen</span></button><button class="tp-mini" type="button" data-report>${IC.flag}<span>Melden</span></button>`}
      </div>
      <p class="tp-small mute">Kanal, Videosystem und Anwesenheit ändern den Plan auf diesem Gerät. Für alle gilt es nach dem Veröffentlichen.</p>`);
    const body = $('#tp-dlg-body');
    body.onclick = e => {
      const t = e.target;
      const sc = t.closest('[data-setch]'); if (sc && !sc.disabled) { if (p.fix && sc.dataset.setch !== p.fix) p.fix = null; p.ch = sc.dataset.setch; p.lock = true; regen(pl, fromIdx(pl)); commit(`${p.n} fliegt jetzt auf ${C.label(C.chan(p.sys, p.ch))}.`); openPilot(key); return; }
      if (t.closest('[data-auto]')) { p.lock = false; reassign(pl, false); regen(pl, fromIdx(pl)); commit(); openPilot(key); return; }
      const hb = t.closest('[data-here]'); if (hb) { const v = hb.dataset.here === '1'; if (p.here === v) return; p.here = v; if (v) reassign(pl, false); regen(pl, fromIdx(pl)); commit(v ? `${p.n} ist da.` : `${p.n} ist nicht da und fliegt nicht mit.`); openPilot(key); return; }
      if (t.closest('[data-itsme]')) { if (me) store.del('fcs-plan-ich:' + T.d); else store.set('fcs-plan-ich:' + T.d, key); renderAll(); openPilot(key); return; }
      if (t.closest('[data-rmlocal]')) { pl.pilots = pl.pilots.filter(q => q.key !== key); pl.heats = pl.heats.map(h => h.filter(k => k !== key)); regen(pl, fromIdx(pl)); closeDlg(); commit(`${p.n} ist aus dem Plan.`); return; }
      if (t.closest('[data-del]')) { openPilot(key, 'del'); return; }
      if (t.closest('[data-report]')) { openPilot(key, 'report'); return; }
    };
    $('#tp-p-sys').addEventListener('change', e => { p.sys = e.target.value; p.sysx = 1; p.ch = null; p.lock = false; p.fix = null; p.wish = null; reassign(pl, false); regen(pl, fromIdx(pl)); commit(`${p.n}: ${SYS[p.sys].n}.`); openPilot(key); });
  }
  function delForm(p, pw) {
    dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">${esc(p.n)} austragen</h2>
      <p class="mute">${pw ? 'Das ist dein Eintrag. Dein Löschcode ist schon eingetragen.' : 'Gib den Löschcode ein, den es beim Eintragen gab.'}</p>
      <form id="tp-del-f" novalidate>
        <div class="field"><label for="tp-del-pw">Löschcode</label><input id="tp-del-pw" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" value="${esc(pw)}" required></div>
        <p class="tp-msg" id="tp-del-msg" role="alert" hidden></p>
        <div class="btns"><button class="btn solid tp-red" type="submit">Austragen</button><button class="btn ghost" type="button" data-back>Zurück</button></div>
        <button class="tp-link" type="button" data-forgot>Code vergessen?</button>
      </form>`);
    const f = $('#tp-del-f'), inp = $('#tp-del-pw'); setTimeout(() => inp.focus(), 60);
    $('[data-back]', f).onclick = () => openPilot(p.key); $('[data-forgot]', f).onclick = () => openPilot(p.key, 'forgot');
    f.addEventListener('submit', async e => {
      e.preventDefault(); const v = inp.value.trim(), msg = $('#tp-del-msg'), btn = $('[type=submit]', f);
      if (v.length < 4) { msg.textContent = 'Bitte den Löschcode eingeben.'; msg.hidden = false; inp.focus(); return; }
      btn.disabled = true; btn.textContent = 'Wird ausgetragen …';
      let r = { ok: false, err: 'netz' }; try { r = await FCS.board.del(p.ref, v); } catch (er) {}
      btn.disabled = false; btn.textContent = 'Austragen';
      if (r.ok) { closeDlg(); removePilot(p); return; }
      msg.textContent = r.err === 'code' ? 'Code stimmt nicht. Prüf Groß- und Kleinschreibung oder tipp auf „Code vergessen?“.' : 'Gerade nicht erreichbar, versuch es gleich nochmal.'; msg.hidden = false;
      if (r.err === 'code') { inp.select(); if (anim()) gsap.fromTo(inp, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)', clearProps: 'transform' }); }
    });
  }
  function removePilot(p) {
    const rows = $$(`[data-k="${CSS.escape(p.key)}"]`);
    const done = () => { T.regs = T.regs.filter(x => x.id !== p.ref); if (T.done && T.done.id === p.ref) T.done = null; rebuildKeep(); toast(`${p.n} ist ausgetragen.`); say(`${p.n} ist ausgetragen.`); };
    if (anim() && rows.length) gsap.to(rows, { opacity: 0, scale: .9, duration: .35, ease: 'power2.in', onComplete: done }); else done();
  }
  function forgotForm(p) {
    dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">Code vergessen?</h2>
      <p class="mute">Kein Problem. Schreib dem Vorstand, dann trägt er dich aus.</p>
      <form id="tp-fg-f" novalidate>
        <div class="field"><label for="tp-fg-n">Dein Name</label><input id="tp-fg-n" maxlength="60" autocomplete="name" value="${esc(p.n)}" required><span class="err">Bitte deinen Namen eingeben.</span></div>
        <div class="field"><label for="tp-fg-k">Wie erreicht man dich?</label><input id="tp-fg-k" maxlength="80" autocomplete="tel" placeholder="Telefon oder E-Mail" required><span class="err">Bitte Telefon oder E-Mail angeben.</span></div>
        <div class="field"><label for="tp-fg-t">Nachricht <small>(freiwillig)</small></label><textarea id="tp-fg-t" rows="2" maxlength="500">Bitte tragt mich für diesen Hallenabend aus.</textarea></div>
        <p class="tp-msg" id="tp-fg-msg" role="alert" hidden></p>
        <div class="btns"><button class="btn solid" type="submit">An den Vorstand senden</button><button class="btn ghost" type="button" data-back>Zurück</button></div>
      </form>`);
    const f = $('#tp-fg-f'); $('[data-back]', f).onclick = () => openPilot(p.key, 'del');
    f.addEventListener('submit', async e => {
      e.preventDefault(); const n = $('#tp-fg-n'), k = $('#tp-fg-k'), msg = $('#tp-fg-msg'), btn = $('[type=submit]', f);
      n.closest('.field').classList.toggle('bad', !n.value.trim()); k.closest('.field').classList.toggle('bad', !k.value.trim());
      if (!n.value.trim() || !k.value.trim()) { (n.value.trim() ? k : n).focus(); return; }
      btn.disabled = true; btn.textContent = 'Wird gesendet …';
      const r = await (FCS.notify ? FCS.notify('Löschcode vergessen (Hallenabend ' + T.d + ')', { ID: p.ref, Termin: T.d, 'Name im Eintrag': p.n, Name: n.value.trim(), Kontakt: k.value.trim(), Nachricht: $('#tp-fg-t').value.trim() }) : { ok: false });
      btn.disabled = false; btn.textContent = 'An den Vorstand senden';
      if (r.ok) dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">Angekommen</h2><p class="tp-okmsg">${IC.ok}Der Vorstand löscht den Beitrag für dich.</p><div class="btns"><button class="btn solid" type="button" data-close>Schließen</button></div>`);
      else { msg.textContent = 'Gerade nicht erreichbar, versuch es gleich nochmal.'; msg.hidden = false; }
    });
  }
  const REASONS = ['Falscher Name', 'Doppelt eingetragen', 'Unpassender Inhalt', 'Sonstiges'];
  function reportForm(p) {
    dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">Eintrag melden</h2>
      <p class="mute">Was stimmt nicht mit „${esc(p.n)}“? Der Vorstand schaut es sich an.</p>
      <form id="tp-rp-f" novalidate>
        <div class="chips" role="radiogroup" aria-label="Grund">${REASONS.map((r, i) => `<label class="chip"><input type="radio" name="tp-grund" value="${esc(r)}"${i ? '' : ' checked'}><span>${esc(r)}</span></label>`).join('')}</div>
        <div class="field"><label for="tp-rp-t">Magst du kurz mehr sagen? <small>(freiwillig)</small></label><textarea id="tp-rp-t" rows="2" maxlength="500"></textarea></div>
        <p class="tp-msg" id="tp-rp-msg" role="alert" hidden></p>
        <div class="btns"><button class="btn solid amber" type="submit">Melden</button><button class="btn ghost" type="button" data-back>Zurück</button></div>
      </form>`);
    const f = $('#tp-rp-f'); $('[data-back]', f).onclick = () => openPilot(p.key);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const btn = $('[type=submit]', f), g = ($('[name=tp-grund]:checked', f) || {}).value || 'Sonstiges';
      btn.disabled = true; btn.textContent = 'Wird gesendet …';
      const r = await (FCS.notify ? FCS.notify('Eintrag melden (Hallenabend ' + T.d + ')', { ID: p.ref, Termin: T.d, Name: p.n, Grund: g, Nachricht: $('#tp-rp-t').value.trim() }) : { ok: false });
      btn.disabled = false; btn.textContent = 'Melden';
      if (r.ok) dlg(`<h2 class="tp-dlg-h" id="tp-dlg-h">Danke</h2><p class="tp-okmsg">${IC.ok}Der Vorstand schaut sich den Eintrag an.</p><div class="btns"><button class="btn solid" type="button" data-close>Schließen</button></div>`);
      else { const msg = $('#tp-rp-msg'); msg.textContent = 'Gerade nicht erreichbar, versuch es gleich nochmal.'; msg.hidden = false; }
    });
  }

  /* =========================== Live-Modus =========================== */
  const L = { open: false, timer: 0, key: '', warned: '', wake: null, sound: store.get('fcs-live-ton', true), off: 0, paused: 0, ac: null };
  const liveSt = () => { try { return JSON.parse(sess.get('fcs-live:' + T.d) || 'null') || { off: 0, paused: 0 }; } catch (e) { return { off: 0, paused: 0 }; } };
  const liveSave = () => sess.set('fcs-live:' + T.d, JSON.stringify({ off: L.off, paused: L.paused }));
  const lnow = () => (L.paused || Date.now()) - L.off;
  function phase() {
    const pl = T.plan, s = pl.s, slot = s.slot * 6e4, cyc = (s.slot + s.pause) * 6e4, t0 = dayStart(T.d) + s.b * 6e4, n = pl.heats.length, now = lnow();
    if (!n) return { ph: 'leer' };
    if (now < t0) return { ph: 'vor', left: t0 - now, total: Math.min(t0 - now, 10 * 6e4), next: 0, t0 };
    const i = Math.floor((now - t0) / cyc);
    if (i >= n) return { ph: 'ende' };
    const t = now - t0 - i * cyc;
    if (t < slot) return { ph: 'flug', i, left: slot - t, total: slot, next: i + 1 };
    return { ph: 'wechsel', i, left: cyc - t, total: cyc - slot, next: i + 1 };
  }
  function beep(f, dur, when = 0, vol = .2) {
    if (!L.sound) return;
    try { const AC = L.ac || (L.ac = new (root.AudioContext || root.webkitAudioContext)()); if (AC.state === 'suspended') AC.resume(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + when; o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .05); } catch (e) {}
  }
  const buzz = p => { if (L.sound && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  function liveOpen() {
    const st = liveSt(); L.off = st.off || 0; L.paused = st.paused || 0;
    const el = $('#tp-live'); el.hidden = false; L.open = true; L.key = ''; L.lastFocus = document.activeElement;
    document.documentElement.classList.add('tp-lock');
    if (L.sound) beep(1, .01, 0, .0001); // Ton freischalten (Browser erlauben ihn nur nach einem Tipp)
    el.innerHTML = `<div class="tl-top">
        <div class="tl-ttl"><img src="assets/img/logo-mark.svg" alt="" width="36" height="36"><div><b>Hallenabend</b><span>${esc(FCS.fmtDate(T.d))} · ${esc(T.t.halle.name)}</span></div></div>
        <div class="tl-clock" id="tl-clock" aria-hidden="true">--:--</div>
        <div class="tl-btns">
          <button type="button" class="tl-b" id="tl-snd" aria-pressed="${L.sound}" aria-label="Ton und Vibration">${L.sound ? IC.sound : IC.mute}<span>Ton</span></button>
          ${document.fullscreenEnabled || document.webkitFullscreenEnabled ? `<button type="button" class="tl-b" id="tl-fs" aria-label="Vollbild">${IC.full}<span>Vollbild</span></button>` : ''}
          <button type="button" class="tl-b" id="tl-rl" aria-label="Zusagen neu laden">${IC.reload}<span>Neu laden</span></button>
          <button type="button" class="tl-b tl-x" id="tl-x" aria-label="Live-Modus schließen">${IC.x}<span>Schließen</span></button>
        </div></div>
      <div class="tl-main">
        <div class="tl-now">
          <p class="tl-ph" id="tl-ph"></p>
          <div class="tl-cd"><b id="tl-cd">--:--</b><div class="tl-bar"><i id="tl-bar"></i></div></div>
          <div class="tl-pilots" id="tl-pilots"></div>
        </div>
        <aside class="tl-side"><section><h3 id="tl-nh">Als Nächstes</h3><ul id="tl-next"></ul></section><section><h3 id="tl-ah">Danach</h3><ul id="tl-after"></ul></section></aside>
      </div>
      <div class="tl-ctl">
        <button type="button" class="tl-c" id="tl-pause">${IC.pause}<span>Pause</span></button>
        <button type="button" class="tl-c" id="tl-m">1 min später</button><button type="button" class="tl-c" id="tl-p">1 min früher</button>
        <button type="button" class="tl-c tl-c-go" id="tl-now">Ab jetzt starten</button>
        <p class="tl-note" id="tl-note" role="status"></p>
      </div>`;
    $('#tl-x').onclick = liveClose;
    $('#tl-snd').onclick = e => { L.sound = !L.sound; store.set('fcs-live-ton', L.sound); e.currentTarget.innerHTML = (L.sound ? IC.sound : IC.mute) + '<span>Ton</span>'; e.currentTarget.setAttribute('aria-pressed', L.sound); if (L.sound) beep(880, .15); };
    const fs = $('#tl-fs'); if (fs) fs.onclick = () => { const d = document; try { if (d.fullscreenElement || d.webkitFullscreenElement) { const r = (d.exitFullscreen || d.webkitExitFullscreen).call(d); if (r && r.catch) r.catch(() => {}); } else { const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { const r = req.call(el); if (r && r.catch) r.catch(() => {}); } } } catch (e) {} };
    $('#tl-rl').onclick = async () => { $('#tl-note').textContent = 'Wird neu geladen …'; await load(true); $('#tl-note').textContent = T.st === 'ok' ? 'Neu geladen.' : 'Gerade nicht erreichbar.'; liveFill(true); };
    $('#tl-pause').onclick = () => { if (L.paused) { L.off += Date.now() - L.paused; L.paused = 0; } else L.paused = Date.now(); liveSave(); liveFill(true); };
    $('#tl-m').onclick = () => { L.off += 6e4; liveSave(); liveFill(true); $('#tl-note').textContent = 'Plan eine Minute später.'; };
    $('#tl-p').onclick = () => { L.off -= 6e4; liveSave(); liveFill(true); $('#tl-note').textContent = 'Plan eine Minute früher.'; };
    $('#tl-now').onclick = () => { const t0 = dayStart(T.d) + T.plan.s.b * 6e4; L.paused = 0; L.off = Date.now() - t0; liveSave(); L.key = ''; liveFill(true); $('#tl-note').textContent = 'Durchgang 1 startet jetzt.'; beep(880, .5); };
    el.addEventListener('keydown', liveKeys);
    wake(true);
    liveFill(true);
    L.timer = setInterval(() => liveFill(false), 250);
    setTimeout(() => $('#tl-x').focus(), 50);
    if (anim()) gsap.from(el, { opacity: 0, duration: .35, ease: 'power2.out' });
  }
  function liveKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); liveClose(); }
    else if (e.key === 'Tab') { const f = $$('#tp-live button'); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  }
  function liveClose() {
    const el = $('#tp-live'); L.open = false; clearInterval(L.timer); L.timer = 0; wake(false);
    const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {}
    el.hidden = true; el.innerHTML = ''; document.documentElement.classList.remove('tp-lock');
    if (L.lastFocus && document.contains(L.lastFocus)) L.lastFocus.focus({ preventScroll: true });
    renderLivePrev();
  }
  async function wake(on) {
    try {
      if (on && 'wakeLock' in navigator && !L.wake) { L.wake = await navigator.wakeLock.request('screen'); L.wake.addEventListener('release', () => { L.wake = null; }); }
      if (!on && L.wake) { await L.wake.release(); L.wake = null; }
    } catch (e) { L.wake = null; }
  }
  document.addEventListener('visibilitychange', () => { if (L.open && document.visibilityState === 'visible') wake(true); });
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
  const cdTxt = P => { if (P.left == null) return P.ph === 'ende' ? '00:00' : '--:--'; if (P.left >= 864e5) { const d = Math.floor(P.left / 864e5); return d + (d === 1 ? ' Tag' : ' Tage'); } if (P.left >= 36e5) return Math.floor(P.left / 36e5) + ':' + pad(Math.floor(P.left % 36e5 / 6e4)) + ' h'; return mmss(P.left); };
  const gLbl = i => { const t = teamOfHeat(i); return t >= 0 ? `Gruppe ${t + 1} · ` : ''; };
  function pilotCards(keys, big) {
    const m = chMap(), gs = groups();
    if (!keys || !keys.length) return big ? '<p class="tl-empty">Niemand eingeplant</p>' : '<li class="tl-empty">Niemand eingeplant</li>';
    return keys.map(k => { const c = m[k], p = pOf(k); return big ? `<div class="tl-p" style="--c:${colorOf(k, gs)}"><b class="tl-p-ch">${c ? esc(C.label(c)) : '–'}</b><span class="tl-p-n">${esc(p ? p.n : '?')}</span><small>${c ? esc(C.mhz(c.f)) : ''} · ${esc(p ? (p.sys === 'u' ? 'System unbekannt' : SYS[p.sys].n) : '')}</small></div>` : `<li style="--c:${colorOf(k, gs)}"><b>${c ? esc(C.label(c)) : '–'}</b><span>${esc(p ? p.n : '?')}</span></li>`; }).join('');
  }
  function liveFill(force) {
    if (!L.open || document.visibilityState === 'hidden' && !force) return;
    const pl = T.plan, s = pl.s, P = phase(), cyc = s.slot + s.pause;
    const now = new Date(); const ck = $('#tl-clock'); if (ck) ck.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const key = P.ph + ':' + (P.i == null ? '' : P.i) + ':' + pl.heats.length + (force ? ':' + Date.now() : '');
    const el = $('#tp-live'); el.dataset.ph = P.ph; el.classList.toggle('paused', !!L.paused);
    $('#tl-pause').innerHTML = L.paused ? IC.play + '<span>Weiter</span>' : IC.pause + '<span>Pause</span>';
    // Signale beim Wechsel (nicht beim ersten Öffnen)
    const pk = P.ph + ':' + P.i;
    if (L.key && L.key.split('|')[0] !== pk && !L.paused) {
      if (P.ph === 'flug') { beep(880, .7); buzz([300]); }
      else if (P.ph === 'wechsel') { beep(660, .22); beep(660, .22, .32); buzz([150, 80, 150]); }
      else if (P.ph === 'ende') { beep(520, .4); beep(780, .6, .45); }
    }
    if (P.ph === 'flug' && P.left < 10500 && P.left > 9500 && L.warned !== pk + 'w') { L.warned = pk + 'w'; beep(990, .12); }
    if ((P.ph === 'wechsel' || P.ph === 'vor') && P.left < 3500 && !L.paused) { const sec = Math.ceil(P.left / 1000); if (L.warned !== pk + 't' + sec) { L.warned = pk + 't' + sec; beep(740, .07); } }
    const structural = !L.key || L.key.split('|')[1] !== key.replace(/:\d{13}$/, '') || force;
    L.key = pk + '|' + key.replace(/:\d{13}$/, '');
    $('#tl-cd').textContent = cdTxt(P); $('#tl-bar').style.transform = `scaleX(${P.left != null ? Math.max(0, Math.min(1, 1 - P.left / P.total)).toFixed(4) : P.ph === 'ende' ? 1 : 0})`;
    if (!structural) return;
    const n = pl.heats.length;
    const atT = i => { const t = new Date(dayStart(T.d) + (s.b + i * cyc) * 6e4 + L.off); return `${pad(t.getHours())}:${pad(t.getMinutes())}`; };
    let ph = '', cur = [], nx = null, af = null;
    if (P.ph === 'leer') ph = 'Noch kein Plan';
    else if (P.ph === 'ende') ph = 'Feierabend · alle Durchgänge geflogen';
    else if (P.ph === 'vor') { ph = P.left >= 12 * 36e5 ? `Am ${FCS.fmtDate(T.d, 1)} um ${atT(0)} Uhr · ${gLbl(0)}Durchgang 1` : `Gleich geht es los · ${gLbl(0)}Durchgang 1 um ${atT(0)} Uhr`; cur = pl.heats[0]; nx = 1; af = 2; }
    else if (P.ph === 'flug') { ph = `Jetzt fliegen · ${gLbl(P.i)}Durchgang ${P.i + 1} von ${n}`; cur = pl.heats[P.i]; nx = P.i + 1; af = P.i + 2; }
    else if (P.ph === 'wechsel') { ph = `Wechsel · ${gLbl(P.i + 1)}Durchgang ${P.i + 2 <= n ? P.i + 2 : n} macht sich bereit`; cur = pl.heats[P.i + 1] || []; nx = P.i + 2; af = P.i + 3; }
    $('#tl-ph').textContent = ph + (L.paused ? ' · Pause' : '');
    $('#tl-pilots').innerHTML = P.ph === 'ende' || P.ph === 'leer' ? `<p class="tl-empty">${P.ph === 'ende' ? 'Danke fürs Fliegen! Akkus raus, Hallenlicht an.' : 'Sobald Piloten eingetragen sind, geht es los.'}</p>` : pilotCards(cur, true);
    $('#tl-pilots').dataset.n = Math.min(8, (cur || []).length);
    $('#tl-nh').textContent = nx != null && nx < n ? `Als Nächstes · ${gLbl(nx)}${atT(nx)}` : 'Als Nächstes';
    $('#tl-ah').textContent = af != null && af < n ? `Danach · ${gLbl(af)}${atT(af)}` : 'Danach';
    $('#tl-next').innerHTML = nx != null && nx < n ? pilotCards(pl.heats[nx]) : '<li class="tl-empty">Ende des Plans</li>';
    $('#tl-after').innerHTML = af != null && af < n ? pilotCards(pl.heats[af]) : '<li class="tl-empty">–</li>';
    const today = new Date().toISOString().slice(0, 10) === T.d;
    if (P.ph === 'vor' && !today && !L.off) $('#tl-note').textContent = 'Für einen Probelauf tipp auf „Ab jetzt starten“.';
    if (anim() && !force && (P.ph === 'flug' || P.ph === 'wechsel')) gsap.from($$('.tl-p', el), { y: 30, opacity: 0, stagger: .06, duration: .5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  function renderLivePrev() {
    const box = $('#tp-live-prev'); if (!box || !T.plan) return;
    const pl = T.plan, m = chMap(), gs = groups();
    const st = liveSt(); const save = { off: L.off, paused: L.paused }; if (!L.open) { L.off = st.off || 0; L.paused = st.paused || 0; }
    const P = phase(); if (!L.open) { L.off = save.off; L.paused = save.paused; }
    const i = P.ph === 'flug' ? P.i : P.ph === 'wechsel' ? P.i + 1 : 0;
    const h = pl.heats[i] || [];
    box.innerHTML = `<div class="tp-lp"><p class="tp-lp-k">${P.ph === 'flug' ? 'Jetzt fliegen' : 'Durchgang ' + (i + 1)}</p><p class="tp-lp-t">${P.ph === 'flug' ? mmss(P.left) : fmtMin(pl.s.b + i * (pl.s.slot + pl.s.pause))}</p><ul>${h.slice(0, 4).map(k => `<li style="--c:${colorOf(k, gs)}"><b>${m[k] ? esc(C.label(m[k])) : '–'}</b><span>${esc(pName(k))}</span></li>`).join('') || '<li class="tl-empty">Noch niemand</li>'}</ul></div>`;
  }

  /* =========================== Start =========================== */
  function show404(q) {
    $$('main > section:not(.pagehead):not(#tp-404)').forEach(s => { s.hidden = true; s.removeAttribute('data-toc'); });
    $('#tp-404').hidden = false;
    $('#tp-datum').textContent = 'Termin?'; $('.tp-h1-k').textContent = 'Hallenabend';
    const qd = q && /^\d{4}-\d{2}-\d{2}$/.test(q) && !isNaN(new Date(q + 'T12:00:00')) ? `${FCS.fmtDate(q, 1)} ${q.slice(0, 4)}` : '';
    $('#tp-ort').textContent = q ? `Für ${qd || 'dieses Datum'} steht kein Hallenfliegen im Kalender.` : 'Gerade stehen keine Termine im Kalender.';
    $('.tp-stats').hidden = true; $('.tp-btns').hidden = true;
    $('#tp-404-list').innerHTML = ALL.map(t => `<li><a class="t-btn" href="termin.html?d=${t.d}"><b>${esc(FCS.fmtDate(t.d, 1))}</b><span>${esc(t.halle.name)}${t.vorbei ? ' · geflogen' : ''}</span></a></li>`).join('') || '<li class="mute">Neue Termine folgen.</li>';
    $('#tp-switch').innerHTML = '';
    const tc = $('.toc'); if (tc) tc.remove(); document.body.classList.remove('has-toc');
  }
  function switchTo(d, push) {
    if (d === T.d) return;
    T.d = d; T.t = ALL.find(t => t.d === d); T.sel = null; T.done = null; T.replace = null; T.showAll = false; T.onlyMe = false;
    if (push) try { history.pushState({ d }, '', 'termin.html?d=' + d); } catch (e) {}
    build(); renderAll();
    if (anim()) gsap.fromTo(['#tp-datum', '#tp-ort', '.tp-stats'], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .06, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  function bars() {
    const el = $('#tp-bars'); if (!el || RM) return;
    if ('IntersectionObserver' in root) new IntersectionObserver(es => el.classList.toggle('run', es[0].isIntersecting)).observe(el); else el.classList.add('run');
  }
  function init() {
    const d = pickDate();
    live = document.createElement('p'); live.className = 'sr'; live.setAttribute('role', 'status'); document.body.appendChild(live);
    if (!d) { show404(new URLSearchParams(location.search).get('d')); return; }
    T.d = d; T.t = ALL.find(t => t.d === d);
    renderTable(); initForm(); dlgInit(); dragInit(); bars();
    T.plan = null; build(); renderAll();
    $('#tp-ics').addEventListener('click', () => FCS.ics(T.t));
    $('#tp-switch').addEventListener('click', e => { const a = e.target.closest('[data-d]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); switchTo(a.dataset.d, true); });
    addEventListener('popstate', () => { const q = pickDate(); if (q) switchTo(q, false); });
    $('#tp-reload').addEventListener('click', reload);
    $('#tp-list').addEventListener('click', e => { if (e.target.closest('[data-retry]')) { load(true); return; } const b = e.target.closest('[data-pk]'); if (b) openPilot(b.dataset.pk); });
    $('#tp-chlist').addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (b) openPilot(b.dataset.pk); });
    $('#tp-spec').addEventListener('click', e => { const h = e.target.closest('[data-g]'); if (!h) return; $('#tp-spec-hint').classList.add('off'); const c = $(`.tp-chc[data-g="${h.dataset.g}"]`); if (c) { FCS.scrollTo(c, -170); c.classList.remove('hl'); void c.offsetWidth; c.classList.add('hl'); } });
    $('#tp-conf').addEventListener('click', e => { const s = e.target.closest('[data-sug]'); if (s) { const p = pOf(s.dataset.sug); p.ch = s.dataset.ch; p.lock = true; commit(`${p.n} fliegt jetzt auf ${C.label(C.chan(p.sys, p.ch))}.`); return; } const f = e.target.closest('[data-fixh]'); if (f) { regen(T.plan, +f.dataset.fixh); commit('Ab diesem Durchgang neu eingeteilt.'); } });
    $('#tp-all').checked = !!T.plan.s.all;
    $('#tp-all').addEventListener('change', e => { T.plan.s.all = e.target.checked ? 1 : 0; reassign(T.plan, true); regen(T.plan, fromIdx(T.plan)); commit(e.target.checked ? 'Alle acht Raceband-Kanäle sind frei.' : 'Nur Kanäle von 5725 bis 5875 MHz.'); });
    $('#tp-reassign').addEventListener('click', () => { T.plan.pilots.forEach(p => { if (!p.fix) p.lock = false; }); reassign(T.plan, true); regen(T.plan, fromIdx(T.plan)); commit('Kanäle neu verteilt.'); });
    $('#tp-set').addEventListener('click', onSet); $('#tp-set').addEventListener('change', onTime);
    $('#tp-teams').addEventListener('click', onTeams);
    $('#tp-heats').addEventListener('click', onHeats); $('#tp-tools').addEventListener('click', onHeats);
    $('#tp-pub').addEventListener('click', onPub);
    $('#tp-me').addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g && !e.metaKey && !e.ctrlKey) { e.preventDefault(); switchTo(g.dataset.go, true); FCS.scrollTo('#eintragen'); return; }
      const b = e.target.closest('[data-me]'); if (!b) return; const a = b.dataset.me, key = meKey(), p = key && pOf(key);
      if (a === 'del' && p) openPilot(key, 'del');
      else if (a === 'forget') { store.del('fcs-plan-ich:' + T.d); renderAll(); }
      else if (a === 'other') { T.replace = null; T.formOpen = true; $('#tp-form').hidden = false; $('#tp-form-x').hidden = false; $('#tp-name').value = ''; $('#tp-pw').value = FCS.board.code(); FCS.scrollTo('#tp-form', -150); $('#tp-name').focus({ preventScroll: true }); }
      else if (a === 'add' && p) { const own = ownReg(); if (!own) return; T.replace = { id: own.r.id, pw: own.pw }; $('#tp-form').hidden = false; $('#tp-form-x').hidden = false; $('#tp-name').value = p.n; $('#tp-pw').value = own.pw; FCS.scrollTo('#tp-form', -150); }
    });
    $('#tp-live-go').addEventListener('click', liveOpen);
    $('#tp-live-prev').addEventListener('click', liveOpen);
    // Live-Einträge erst laden, wenn die Seite steht (eine Abfrage pro Bereich und Aufruf)
    load(false);
    // Vorschau im Live-Kasten läuft nur, solange sie zu sehen ist, und ohne Netz
    const lp = $('#tp-live-prev'); let lpT = 0;
    if ('IntersectionObserver' in root) new IntersectionObserver(es => { clearInterval(lpT); if (es[0].isIntersecting) lpT = setInterval(renderLivePrev, 1000); }).observe(lp);
  }
  if (FCS.termine) document.addEventListener('fcs:ready', init, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
