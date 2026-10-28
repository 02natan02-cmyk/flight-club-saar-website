/* Flight Club Saar – Bau deine Drohne
   Werkbank: echte Teile wählen (Daten aus assets/data/teile.json, recherchiert aus Handbüchern und Produktseiten),
   Verträglichkeitsprüfung (Spannung, KV, Strom, Rahmen, Anschlüsse/UARTs, Schub zu Gewicht),
   3D-Zusammenbau (three.js, alle Teile werden aus den Maßen erzeugt), Lötplan als SVG mit Schritt-für-Schritt,
   Abheben in 3D und Übergabe an den Vereins-Simulator (localStorage „fcs-bau-sim“, simulator.html?bau=1).
   Stand 28.10.2026. Schub, Schwebegas und Flugzeit sind Schätzungen und werden so beschriftet. */
import * as THREE from '../lib/three.module.min.js';

const D = document, W = window;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v.replace(',', '.')) ? +v.replace(',', '.') : null);
const de = (v, d = 0) => v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const run = (name, fn) => { try { return fn(); } catch (e) { console.warn('Bau deine Drohne: ' + name, e); } };

/* =====================================================================
   Daten
   ===================================================================== */
let DB = null, PL = [];
const arr = (k) => (DB && Array.isArray(DB[k])) ? DB[k] : [];
const byId = {};
function index() {
  for (const k of Object.keys(DB)) if (Array.isArray(DB[k])) DB[k].forEach(p => { if (p && p.id) { p._kat = p._kat || k; byId[p.id] = p; } });
}
const P = (id) => id ? byId[id] || null : null;
/* Platinen: Stacks/FCs und AIO zusammen; ESC nur, wenn der Stack keinen hat */
const boards = () => [...arr('stack'), ...arr('fc'), ...arr('aio')].filter(b => b && b.id);
const range = (v) => Array.isArray(v) ? [num(v[0]), num(v[v.length - 1])] : (num(v) != null ? [num(v), num(v)] : [null, null]);
const statorOf = (m) => { const s = String(m.groesse || m.stator || m.name || ''); const r = s.match(/(\d{2})(\d{2})(?:\.\d)?/); return r ? { w: +r[1], h: +r[2] } : null; };
const kvList = (m) => { if (Array.isArray(m.kv_varianten) && m.kv_varianten.length) return m.kv_varianten.map(num).filter(Boolean); const k = num(m.kv); return k ? [k] : []; };

/* Klassen. Werte ohne Datenbasis sind Richtwerte und nur Rückfall, wenn teile.json keine Regel liefert. */
const KLASSEN = [
  { thr: .62, id: 'whoop', name: 'Tiny Whoop', sub: '65 bis 75 mm, Halle', prop: [1.2, 1.8], stator: [6, 12], cells: [1, 2], twr: [2.2, 3, 6], rpmV: [60000, 95000], last: 1.3, wb: 75 },
  { thr: .5, id: 'cine', name: 'Cinewhoop 3 Zoll', sub: 'Filmen mit Schutzringen', prop: [2.8, 3.6], stator: [13, 19], cells: [4, 6], twr: [3, 4, 9], rpmV: [45000, 70000], last: 1.4, wb: 145 },
  { thr: .42, id: 'five', name: 'Freestyle 5 Zoll', sub: 'Der Klassiker', prop: [4.8, 5.3], stator: [20, 24], cells: [4, 6], twr: [5, 8, 16], rpmV: [36000, 47000], last: 2.0, wb: 225 },
  { thr: .32, id: 'seven', name: 'Long Range 7 Zoll', sub: 'Weit und lange', prop: [6.5, 7.6], stator: [26, 29], cells: [6, 6], twr: [3, 4, 9], rpmV: [24000, 34000], last: 1.25, wb: 300 }
];
const KL = (id) => KLASSEN.find(k => k.id === id) || KLASSEN[2];
const klasseOfProp = (zoll) => { const z = num(zoll); if (!z) return null; return z <= 2 ? 'whoop' : z < 4 ? 'cine' : z < 6 ? 'five' : 'seven'; };
const klasseOfStator = (s) => !s ? null : s.w <= 12 ? 'whoop' : s.w <= 19 ? 'cine' : s.w <= 25 ? 'five' : 'seven';
const klasseOfFrame = (f) => {
  const kk = String(f.klasse || '').toLowerCase();
  if (/^whoop|tiny/.test(kk)) return 'whoop'; if (/cine/.test(kk)) return 'cine'; if (/^7|long ?range/.test(kk)) return 'seven'; if (/^5|freestyle|racing/.test(kk)) return 'five';
  const t = String((f.klasse || '') + ' ' + (f.name || '')).toLowerCase(); const mp = num(f.max_prop_zoll);
  if (/whoop|65|75 ?mm/.test(t) && !/cine/.test(t)) return 'whoop';
  if (/cine|3 ?zoll|3"|3inch|3-inch/.test(t)) return 'cine';
  if (/7 ?zoll|7"|long|lr/.test(t)) return 'seven';
  if (mp) return klasseOfProp(mp);
  return 'five';
};
const klasseOfBattery = (a) => { const c = num(a.zellen), m = num(a.mah); if (!c || !m) return null; if (c <= 2 && m <= 600) return 'whoop'; if (m < 1000 && c >= 4) return 'cine'; if (m >= 2500) return 'seven'; return 'five'; };
const isAio = (b) => !!(b && (b._kat === 'aio' || b.aio === true));
const boardSize = (b) => num(b && (b.groesse_mm || b.lochabstand_mm)) || 30.5;

/* =====================================================================
   Zustand
   ===================================================================== */
const B = { klasse: 'five', rahmen: null, board: null, esc: null, motor: null, kv: null, prop: null, akku: null, video: null, rx: null, gps: null, led: null, buzzer: null, kondensator: null, kamera: null };
const STEPS = [{ id: 'klasse', t: 'Klasse' }, { id: 'akku', t: 'Akku' }, { id: 'rahmen', t: 'Rahmen' }, { id: 'board', t: 'Flugcontroller' }, { id: 'motor', t: 'Motoren' }, { id: 'prop', t: 'Propeller' }, { id: 'video', t: 'Video' }, { id: 'rx', t: 'Empfänger' }, { id: 'extras', t: 'Extras' }, { id: 'loeten', t: 'Löten' }, { id: 'fly', t: 'Abheben' }];
const SI = (id) => STEPS.findIndex(s => s.id === id);
let step = 0, view = '3d';

/* =====================================================================
   Berechnungen
   ===================================================================== */
const rule = (k) => DB && DB.regeln ? DB.regeln[k] : null;
function weight() {
  const f = P(B.rahmen), b = P(B.board), e = P(B.esc), m = P(B.motor), pr = P(B.prop), a = P(B.akku), v = P(B.video), r = P(B.rx);
  let g = 0, parts = 0;
  const add = (p, n = 1) => { const w = p && num(p.gewicht_g); if (w != null) { g += w * n; parts++; } };
  add(f); add(b); if (e && !isAio(b)) add(e); add(m, 4); add(pr, 4); add(v); if (r && !(b && b.eingebauter_empfaenger && r._builtin)) add(r);
  ['gps', 'led', 'buzzer', 'kondensator', 'kamera'].forEach(k => add(P(B[k])));
  const ohneAkku = g * 1.08; // Kabel, Schrauben, Straps, Lötzinn
  const aw = a && num(a.gewicht_g) != null ? num(a.gewicht_g) : null;
  return { ohneAkku: parts ? ohneAkku : null, gesamt: parts ? ohneAkku + (aw || 0) : null, akku: aw };
}
function cells() { const a = P(B.akku); return a ? num(a.zellen) : null; }
function thrust() {
  const m = P(B.motor); if (!m) return null;
  let t = num(m.schub_max_g); if (t == null) return null;
  const testS = num(m.test_zellen || m.schub_zellen) || range(m.empfohlen_s)[1] || cells();
  const c = cells();
  if (c && testS && c !== testS) t *= Math.pow(c / testS, 1.5); // Schub wächst grob mit Spannung^1,5 (Schätzung)
  const kvTest = num(m.kv), kv = B.kv || kvTest;
  if (kv && kvTest && kv !== kvTest) t *= Math.pow(kv / kvTest, 1.5);
  return t * 4;
}
function metrics() {
  const w = weight(), T = thrust(), K = KL(B.klasse), m = P(B.motor), a = P(B.akku);
  const out = { gewicht: w.gesamt, twr: null, hover: null, zeit: null };
  if (T && w.gesamt) {
    out.twr = T / w.gesamt;
    out.hover = clamp(Math.pow(w.gesamt / T, 1 / 1.6), 0, 1.2);
    const iMax = m && num(m.strom_max_a);
    const mah = a && num(a.mah);
    if (iMax && mah) {
      const iHover = 4 * iMax * Math.pow(w.gesamt / T, 1.5);
      // Mittlerer Strom im typischen Flug der Klasse (Gas im Schnitt K.thr, Strom etwa Gas^2,5), mindestens etwas über dem Schweben
      const iAvg = Math.max(iHover * 1.15, 4 * iMax * Math.pow(K.thr || .4, 2.5));
      out.zeit = (mah * .8 / 1000) / iAvg * 60;
    }
  }
  return out;
}

/* Prüfungen: Liste {lvl: ok|warn|bad, t, d} */
const CK = new Map();
function checks(st = B) {
  // Ergebnis je Zusammenstellung merken: die Listen bewerten viele Varianten, das hält die Seite flott
  const key = ['klasse', 'rahmen', 'board', 'esc', 'motor', 'kv', 'prop', 'akku', 'video', 'rx', 'gps', 'led', 'buzzer', 'kondensator', 'kamera'].map(k => st[k] || '').join('|');
  const hit = CK.get(key); if (hit) return hit;
  const res = checksRaw(st); if (CK.size > 4000) CK.clear(); CK.set(key, res); return res;
}
function checksRaw(st) {
  const L = [], add = (lvl, t, d) => L.push({ lvl, t, d });
  const K = KL(st.klasse), f = P(st.rahmen), b = P(st.board), e = P(st.esc), m = P(st.motor), pr = P(st.prop), a = P(st.akku), v = P(st.video), r = P(st.rx), gps = P(st.gps);
  const c = a ? num(a.zellen) : null;
  // Spannung
  if (c) {
    if (b) { const [lo, hi] = range(b.eingang_s); if (lo && (c < lo || c > hi)) add('bad', `${esc(b.name)} verträgt ${lo}S bis ${hi}S`, `Dein Akku hat ${c}S. Das zerstört die Platine oder sie startet nicht.`); }
    if (e && !isAio(b)) { const [lo, hi] = range(e.eingang_s); if (lo && (c < lo || c > hi)) add('bad', `ESC verträgt ${lo}S bis ${hi}S`, `Dein Akku hat ${c}S.`); }
    if (m) { const [lo, hi] = range(m.empfohlen_s); if (lo && (c < lo || c > hi)) add('warn', `Motor ist für ${lo === hi ? lo : lo + '–' + hi}S gedacht`, `Mit ${c}S drehen die Motoren ${c > hi ? 'zu schnell und werden heiß' : 'zu langsam, die Drohne wirkt müde'}.`); }
    if (v) {
      const [vlo, vhi] = range(v.eingang_v); const vmax = c * 4.2, vmin = c * 3.5;
      const dro = b && (layoutFor(b) || {}).rollen && layoutFor(b).rollen.digital, viaReg = dro && (dro.buchse || (dro.pads && dro.pads.Plus));
      if (vlo && vhi && v.typ === 'digital' && (vmax > vhi)) { if (viaReg) add('ok', `${esc(v.name)} über den Spannungsregler`, `Voll geladen hat dein Akku ${de(vmax, 1)} V, das Videosystem verträgt bis ${de(vhi, 1)} V. Es bekommt seinen Strom deshalb vom 9-V-Ausgang der Platine${/jumper|lötbrücke/i.test(dro.text || '') ? '. Die Lötbrücke für die Spannung steht im Lötplan' : ''}.`); else add('warn', `${esc(v.name)} nicht direkt an den Akku`, `Voll geladen hat dein Akku ${de(vmax, 1)} V, das Videosystem verträgt bis ${de(vhi, 1)} V. Über den Spannungsregler des Flugcontrollers anschließen.`); }
      if (vlo && vmax < vlo) add('bad', `${esc(v.name)} bekommt zu wenig Spannung`, `Braucht mindestens ${de(vlo, 1)} V, dein ${c}S-Akku liefert höchstens ${de(vmax, 1)} V.`);
      else if (vlo && vmin < vlo && c >= 2) add('warn', `${esc(v.name)} wird gegen Ende knapp`, `Unter ${de(vlo, 1)} V kann das Bild ausfallen. Lieber einen Akku mit mehr Zellen.`);
    }
  }
  // KV passend zur Spannung (Drehzahl ohne Last je Propellergröße)
  if (m && c) {
    const kv = st.kv || kvList(m)[0];
    if (kv) {
      const rpm = kv * c * 3.7, [lo, hi] = K.rpmV;
      if (rpm > hi * 1.12) add('bad', `${de(kv)} KV an ${c}S ist zu viel für ${K.name}`, `Ohne Last etwa ${de(Math.round(rpm / 1000))} 000 Umdrehungen pro Minute. Die Motoren überhitzen. Weniger KV oder weniger Zellen.`);
      else if (rpm > hi) add('warn', `${de(kv)} KV an ${c}S ist sehr spitz`, `Etwa ${de(Math.round(rpm / 1000))} 000 U/min ohne Last. Geht für Rennen, für Freestyle wird es heiß.`);
      else if (rpm < lo * .85) add('warn', `${de(kv)} KV an ${c}S ist eher träge`, `Etwa ${de(Math.round(rpm / 1000))} 000 U/min ohne Last. Mehr KV oder mehr Zellen machen die Drohne wacher.`);
      else add('ok', `${de(kv)} KV an ${c}S passt`, `Etwa ${de(Math.round(rpm / 1000))} 000 U/min ohne Last, im typischen Bereich für ${K.name}.`);
    }
  }
  // Strom
  if (m) {
    const iM = num(m.strom_max_a), escA = isAio(b) ? num(b.esc_dauerstrom_a) : (e ? num(e.dauerstrom_a) : null);
    if (iM && escA) {
      if (iM > escA * 1.1) add('bad', `ESC zu schwach: ${de(escA)} A für Motoren mit bis zu ${de(iM)} A`, 'Der ESC kann abbrennen. Größeren ESC oder kleinere Motoren wählen.');
      else if (iM > escA * .9) add('warn', 'ESC knapp bemessen', `Motoren bis ${de(iM)} A, ESC ${de(escA)} A Dauerstrom. Geht, aber Vollgas-Passagen kurz halten.`);
      else add('ok', 'ESC hat genug Reserve', `${de(escA)} A Dauerstrom je Motor, Motoren bis ${de(iM)} A.`);
    }
  }
  // Rahmen
  if (f) {
    const fk = klasseOfFrame(f);
    if (fk !== st.klasse) add('warn', `${esc(f.name)} ist ein ${KL(fk).name}-Rahmen`, `Du baust gerade ${K.name}. Klasse oder Rahmen anpassen.`);
    if (b) { const H = holesOf(f), want = H.length ? H[0] : null, have = boardSize(b); if (H.length && have && !H.some(h => Math.abs(h - have) <= .6)) add('bad', `Flugcontroller passt nicht in den Rahmen`, `Der Rahmen hat Befestigungslöcher für ${de(want, 1)} × ${de(want, 1)} mm, ${esc(b.name)} braucht ${de(have, 1)} × ${de(have, 1)} mm. Wähle einen Flugcontroller mit ${de(want, 1)} mm oder einen anderen Rahmen.`); }
    if (pr) { const mp = num(f.max_prop_zoll), d = num(pr.durchmesser_zoll); if (mp && d && d > mp + .05) add('bad', `Propeller zu groß für den Rahmen`, `Höchstens ${de(mp, 1)} Zoll, gewählt ${de(d, 1)} Zoll. Die Propeller schlagen aneinander.`); }
  }
  if (pr && m) { const pk = klasseOfProp(pr.durchmesser_zoll), mk = klasseOfStator(statorOf(m)); if (pk && mk && pk !== mk) add('warn', 'Motor und Propeller passen nicht zusammen', `${esc(m.name)} ist für ${KL(mk).name} gebaut, der Propeller für ${KL(pk).name}.`); }
  // Anschlüsse
  const plan = wiring(st);
  if (b && plan.noplan && plan.noplan.length) add('warn', 'Nicht im Herstellerplan eingezeichnet', `${plan.noplan.join(', ')}: Der Anschlussplan des Herstellers zeigt dafür keine Lötpunkte. Freien UART und Pads im Handbuch nachsehen.`);
  if (b && plan.missing.length) add('bad', 'Zu wenige freie Anschlüsse (UART)', `Es fehlt ein freier UART für: ${plan.missing.join(', ')}. Andere Platine wählen oder ein Teil weglassen.`);
  else if (b && plan.uarts.length) add('ok', 'Anschlüsse reichen', plan.uarts.map(u => `${u.uart}: ${u.wer}`).join(' · '));
  if (b && b.eingebauter_empfaenger && r && !r._builtin) add('warn', 'Die Platine hat schon einen Empfänger', `${esc(b.name)} hat ${esc(b.eingebauter_empfaenger)} eingebaut. Ein zweiter Empfänger ist nur nötig, wenn deine Funke ein anderes Protokoll spricht.`);
  if (r && /sbus/i.test(r.protokoll || '') && b && /F4/i.test(b.mcu || '') && !(b.pads || []).some(p => /sbus/i.test(p.name || p))) add('warn', 'SBUS braucht einen invertierten Eingang', 'Auf F4-Platinen nur am SBUS-Pad. Prüf im Handbuch, ob deine Platine einen hat.');
  // Extras
  if (c && c >= 4 && !st.kondensator) add('warn', 'Kondensator fehlt', 'Bei 4S und mehr gehört ein Low-ESR-Kondensator an die Akkupads. Er fängt Spannungsspitzen ab, die Videosystem und Gyro stören.');
  if (st.klasse === 'seven' && !gps) add('warn', 'Ohne GPS kein Rückflug', 'Bei Long Range bringt dich GPS-Rescue nach Hause, wenn das Signal abreißt.');
  // Schub
  const mt = metricsFor(st);
  if (mt.twr) {
    const [bad, ok] = K.twr;
    if (mt.twr < bad) add('bad', `Schub zu Gewicht nur ${de(mt.twr, 1)} : 1`, 'Die Drohne kommt kaum vom Boden. Leichtere Teile, mehr Zellen oder stärkere Motoren.');
    else if (mt.twr < ok) add('warn', `Schub zu Gewicht ${de(mt.twr, 1)} : 1`, `Fliegt, aber für ${K.name} eher gemütlich.`);
    else add('ok', `Schub zu Gewicht ${de(mt.twr, 1)} : 1`, `Kräftig genug für ${K.name}.`);
  }
  return L;
}
function metricsFor(st) { const keep = Object.assign({}, B); Object.assign(B, st); const r = metrics(); Object.assign(B, keep); return r; }

/* =====================================================================
   Lötplan: welche Leitung an welches Pad, UARTs verteilen
   ===================================================================== */
function padNames(b) { return (b && Array.isArray(b.pads) ? b.pads : []).map(p => typeof p === 'string' ? p : (p.name || p.pad || '')).filter(Boolean); }
function findPad(b, ...pat) { const n = padNames(b); for (const p of pat) { const hit = n.find(x => p instanceof RegExp ? p.test(x) : x.toUpperCase() === String(p).toUpperCase()); if (hit) return hit; } return null; }
function uartsOf(b) {
  const list = Array.isArray(b && b.uarts) ? b.uarts : [];
  return list.map(u => typeof u === 'string' ? { name: u, frei: true } : u).map(u => {
    const n = (String(u.name || u.uart || '').match(/(\d+)/) || [])[1];
    return { n, name: 'UART' + n, frei: u.frei !== false, info: u.besonderheit || u.hinweis || u.info || '', raw: u };
  }).filter(u => u.n);
}
const LF = new Map();
function layoutFor(b) {
  if (!b) return null;
  if (LF.has(b.id)) return LF.get(b.id);
  const r = layoutFind(b); LF.set(b.id, r); return r;
}
function layoutFind(b) {
  const name = (b.name || '') + ' ' + (b.hersteller || '');
  return PL.find(l => l.board === b.id) || PL.find(l => { try { return new RegExp(l.match, 'i').test(name); } catch (e) { return false; } }) || null;
}
const buchseOf = (L, n) => L && [...((L.unterseite && L.unterseite.buchsen) || []).map(c => ({ ...c, unten: true })), ...((L.oberseite && L.oberseite.buchsen) || []), ...(L.teile || []).filter(t => t.typ === 'buchse')].find(c => c.n === n) || null;
const padById = (L, id) => L && (L.pads.find(p => p.id === id) || L.pads.find(p => p.n === id && !p.id) || L.pads.find(p => p.n === id)) || null;
/* Belegung nach dem Anschlussplan des Herstellers (platinen.json, „rollen“) */
function wiringLayout(st, b, L) {
  const v = P(st.video), r = P(st.rx), gps = P(st.gps), led = P(st.led), bz = P(st.buzzer);
  const R = Object.fromEntries(Object.entries(L.rollen || {}).filter(([, x]) => x && typeof x === 'object').map(([k, x]) => [k, { ...x, pads: x.pads || {} }]));
  const W_ = [], uarts = [], missing = [], noplan = [];
  const W2 = (teil, kabel, id, art, notiz, rolle) => { if (!id) return; const pd = padById(L, id); W_.push({ teil, kabel, pad: pd ? (pd.lab || pd.n) : id, padId: pd ? (pd.id || pd.n) : id, art, notiz: notiz || '', rolle, unten: !!(pd && pd.unten) }); };
  const plug = (teil, bu, notiz, rolle) => { const c = buchseOf(L, bu); W_.push({ teil, kabel: 'Steckerkabel', pad: c ? (c.lab || c.n) : bu, padId: 'BUCHSE:' + bu, art: 'plug', notiz: notiz || '', rolle }); };
  const useU = (role, wer) => { if (role && role.uart) uarts.push({ uart: 'UART' + role.uart, wer }); };
  if (r && !r._builtin && !/dji/i.test(r.protokoll || '')) {
    const ro = R.empfaenger;
    if (!ro || (!Object.keys(ro.pads).length && !ro.buchse)) noplan.push('Empfänger');
    else {
      useU(ro, 'Empfänger'); if (ro.buchse) plug('Empfänger', ro.buchse, ro.text || '', 'rx');
      const crsf = /crsf|crossfire|tracer/i.test((r.protokoll || '') + r.name), sbus = /sbus/i.test(r.protokoll || '');
      W2('Empfänger', 'GND', ro.pads.GND, 'g', '', 'rx'); W2('Empfänger', crsf ? '5V-IN' : '5V', ro.pads['5V'], 'v', '', 'rx');
      if (sbus) W2('Empfänger', 'SBUS', ro.pads.SBUS || ro.pads.TX, 'rx', '', 'rx');
      else { W2('Empfänger', crsf ? 'CH1 (TX)' : 'TX', ro.pads.TX, 'rx', 'TX des Empfängers an RX der Platine', 'rx'); W2('Empfänger', crsf ? 'CH2 (RX)' : 'RX', ro.pads.RX, 'tx', 'RX des Empfängers an TX der Platine', 'rx'); }
    }
  }
  if (v) {
    if (v.typ === 'digital') {
      const ro = R.digital || {};
      useU(ro, 'Videosystem (MSP)');
      if (ro.buchse && buchseOf(L, ro.buchse)) plug('Videosystem', ro.buchse, ro.text || '', 'dji');
      else if (ro.pads && Object.keys(ro.pads).length) { W2('Videosystem', 'Plus', ro.pads.Plus, 'v', 'über den Spannungsregler', 'vtx'); W2('Videosystem', 'GND', ro.pads.Masse, 'g', '', 'vtx'); W2('Videosystem', 'TX', ro.pads.TX, 'rx', 'Bildschirmanzeige (MSP)', 'vtx'); W2('Videosystem', 'RX', ro.pads.RX, 'tx', '', 'vtx'); }
      else noplan.push('Videosystem');
    } else {
      const k = R.kamera, t = R.vtx_analog;
      if (k) { const kp = k.pads || {}; if (k.buchse) plug('Kamera', k.buchse, k.text || '', 'cam'); W2('Kamera', 'Video', kp.Video, 'vid', '', 'cam'); W2('Kamera', 'Plus', kp.Plus, 'v', k.text || '', 'cam'); W2('Kamera', 'GND', kp.Masse || kp.GND, 'g', '', 'cam'); }
      if (t) { const tp = t.pads || {}; if (Object.keys(tp).length) useU(t, 'Videosender (SmartAudio)'); W2('Videosender', 'Video', tp.Video, 'vid', '', 'vtx'); W2('Videosender', 'Plus', tp.Plus, 'v', t.text || '', 'vtx'); W2('Videosender', 'GND', tp.Masse || tp.GND, 'g', '', 'vtx'); W2('Videosender', 'SmartAudio', tp.SmartAudio, 'tx', 'Kanal und Leistung aus dem Menü', 'vtx'); }
    }
  }
  if (gps) { const ro = R.gps; if (!ro || (!Object.keys(ro.pads).length && !ro.buchse)) noplan.push('GPS'); else { const gp = ro.pads || {}; useU(ro, 'GPS'); if (ro.buchse) plug('GPS', ro.buchse, ro.text || '', 'gps'); W2('GPS', '5V', gp['5V'], 'v', '', 'gps'); W2('GPS', 'GND', gp.GND, 'g', '', 'gps'); W2('GPS', 'TX', gp.TX, 'rx', '', 'gps'); W2('GPS', 'RX', gp.RX, 'tx', '', 'gps'); if (gps.kompass || /880|m10q|5883|kompass|compass/i.test(gps.name || '')) { W2('GPS', 'SDA', gp.SDA, 'tx', 'Kompass', 'gps'); W2('GPS', 'SCL', gp.SCL, 'rx', 'Kompass', 'gps'); } } }
  if (led && R.led) { W2('LED-Streifen', '5V', R.led.pads['5V'], 'v', '', 'led'); W2('LED-Streifen', 'GND', R.led.pads.GND, 'g', '', 'led'); W2('LED-Streifen', 'DIN', R.led.pads.DIN, 'tx', 'Pfeil auf dem Streifen zeigt weg von der Platine', 'led'); }
  if (bz && R.buzzer) { W2('Buzzer', '+', R.buzzer.pads.Plus, 'v', '', 'bz'); W2('Buzzer', '−', R.buzzer.pads.Minus, 'g', '', 'bz'); }
  return { wires: W_, uarts, missing, noplan, layout: L };
}
function wiring(st = B) {
  { const bb = P(st.board), L = layoutFor(bb); if (L && L.rollen) return wiringLayout(st, bb, L); }
  const b = P(st.board), v = P(st.video), r = P(st.rx), gps = P(st.gps), led = P(st.led), bz = P(st.buzzer), cam = P(st.kamera);
  const W_ = [], uarts = [], missing = [];
  if (!b) return { wires: W_, uarts, missing };
  const free = uartsOf(b).filter(u => u.frei);
  const used = new Set();
  const take = (wer, pref) => {
    let u = null;
    if (pref) u = free.find(x => !used.has(x.n) && pref.test(x.info + ' ' + x.name));
    if (!u) u = free.find(x => !used.has(x.n) && !/dji|vtx|hd/i.test(x.info) && !/sbus|inverter/i.test(x.info));
    if (!u) u = free.find(x => !used.has(x.n));
    if (!u) { missing.push(wer); return null; }
    used.add(u.n); uarts.push({ uart: u.name, wer }); return u;
  };
  const tx = (u) => findPad(b, 'T' + u.n, 'TX' + u.n, new RegExp('^TX?' + u.n + '$', 'i')) || 'TX' + u.n;
  const rxp = (u) => findPad(b, 'R' + u.n, 'RX' + u.n, new RegExp('^RX?' + u.n + '$', 'i')) || 'RX' + u.n;
  const p5 = findPad(b, '4V5', '5V', /^5v/i) || '5V', gnd = findPad(b, 'G', 'GND', /^g(nd)?$/i) || 'GND';
  const p9 = findPad(b, '10V', '9V', '12V', /^(9|10|12)v/i), vbat = findPad(b, 'VBAT', 'BAT', /^vbat|^bat/i);
  const W2 = (teil, kabel, pad, art, notiz) => W_.push({ teil, kabel, pad, art, notiz: notiz || '' });

  // Empfänger
  if (r && !r._builtin && !/dji/i.test(r.protokoll || '')) {
    if (/sbus/i.test(r.protokoll || '')) {
      const s = findPad(b, 'SBUS', /sbus/i);
      if (s) W2('Empfänger', 'SBUS', s, 'rx'); else { const u = take('Empfänger (SBUS)', /sbus|inverter/i); if (u) W2('Empfänger', 'SBUS', rxp(u), 'rx'); }
    } else {
      const u = take('Empfänger', /rx|empf|serial ?rx|crsf|elrs/i);
      if (u) { W2('Empfänger', 'TX', rxp(u), 'rx', 'TX des Empfängers an RX der Platine'); W2('Empfänger', 'RX', tx(u), 'tx', 'RX des Empfängers an TX der Platine'); }
    }
    W2('Empfänger', '5V', p5, 'v'); W2('Empfänger', 'GND', gnd, 'g');
  }
  // Videosystem
  if (v) {
    if (v.typ === 'digital') {
      if (b.anschluesse && b.anschluesse.dji_stecker && /dji|o3|o4|walksnail|avatar/i.test(v.name)) {
        const u = take('Videosystem (MSP)', /dji|vtx|hd|displayport|msp/i);
        W2('Videosystem', 'Steckerkabel', 'DJI-Stecker', 'plug', `Das mitgelieferte Kabel einstecken, die Platine legt Strom, Masse und ${u ? u.name : 'UART'} (Bildschirmanzeige) selbst an.`);
      } else {
        const u = take('Videosystem (MSP)', /dji|vtx|hd|displayport|msp/i);
        const [vlo, vhi] = range(v.eingang_v);
        const pw = (p9 && (!vhi || vhi >= 9)) ? p9 : (vbat || 'VBAT');
        W2('Videosystem', 'Plus (rot)', pw, 'v', pw === p9 ? 'über den Spannungsregler der Platine' : 'direkt an Akkuspannung, nur wenn das Handbuch es erlaubt');
        W2('Videosystem', 'Masse (schwarz)', gnd, 'g');
        if (u) { W2('Videosystem', 'TX', rxp(u), 'rx', 'für die Bildschirmanzeige (MSP DisplayPort)'); W2('Videosystem', 'RX', tx(u), 'tx'); }
        if (/dji/i.test(v.name) && r && /dji/i.test(r.protokoll || '')) W2('Videosystem', 'SBUS (Funke über DJI)', findPad(b, 'SBUS', /sbus/i) || 'SBUS', 'rx', 'nur wenn du mit der DJI-Funke steuerst');
      }
    } else {
      const cp = findPad(b, 'CAM', 'C', /^cam/i) || 'CAM', vp = findPad(b, 'VTX', 'VID', /^vtx|^v.?out/i) || 'VTX';
      W2('Kamera', 'Video (gelb)', cp, 'vid'); W2('Kamera', 'Plus', p5, 'v'); W2('Kamera', 'Masse', gnd, 'g');
      W2('Videosender', 'Video-Eingang', vp, 'vid'); W2('Videosender', 'Plus', p9 || vbat || 'VBAT', 'v', p9 ? 'über den Spannungsregler' : 'direkt an Akkuspannung, laut Handbuch des Senders'); W2('Videosender', 'Masse', gnd, 'g');
      const u = take('Videosender (SmartAudio)', /smart|tramp|vtx/i); if (u) W2('Videosender', 'SmartAudio', tx(u), 'tx', 'Kanal und Leistung aus dem Menü einstellen');
    }
  }
  if (gps) {
    const u = take('GPS', /gps/i);
    W2('GPS', 'VCC', p5, 'v'); W2('GPS', 'GND', gnd, 'g');
    if (u) { W2('GPS', 'TX', rxp(u), 'rx'); W2('GPS', 'RX', tx(u), 'tx'); }
    if (/880|m10q|kompass|compass/i.test(gps.name || '') ) { const sda = findPad(b, 'SDA', /sda/i), scl = findPad(b, 'SCL', /scl/i); if (sda && scl) { W2('GPS', 'SDA (Kompass)', sda, 'tx'); W2('GPS', 'SCL (Kompass)', scl, 'rx'); } }
  }
  if (led) { W2('LED-Streifen', '5V', p5, 'v'); W2('LED-Streifen', 'GND', gnd, 'g'); W2('LED-Streifen', 'DIN', findPad(b, 'LED', /^led/i) || 'LED', 'tx', 'Pfeil auf dem Streifen zeigt weg von der Platine'); }
  if (bz) { W2('Buzzer', 'Plus', findPad(b, 'BZ+', 'BUZ+', /^bz\+|^buz/i) || 'BZ+', 'v'); W2('Buzzer', 'Minus', findPad(b, 'BZ-', 'BUZ-', /^bz-|^bz−/i) || 'BZ−', 'g'); }
  if (cam && v && v.typ !== 'digital') { /* eigene Kamera schon oben */ }
  return { wires: W_, uarts, missing };
}

/* =====================================================================
   Optionen je Teil (Natan 28.10.2026: „viel einfacher, intuitiver“). Ablauf: drei Fragen → fertiges, passendes Set →
   jedes Teil tauschbar. Beim Tauschen stehen die Entscheidungen (Zellen, KV, Bauart …) oben, darunter nur passende Teile.
   ===================================================================== */
const SLOTS = [
  { id: 'rahmen', t: 'Rahmen', tt: 'Rahmen' }, { id: 'akku', t: 'Akku', tt: 'Akku' }, { id: 'motor', t: 'Motoren', tt: 'Motoren' },
  { id: 'prop', t: 'Propeller', tt: 'Propeller' }, { id: 'board', t: 'Flugcontroller und ESC', tt: 'Flugcontroller' },
  { id: 'video', t: 'Videosystem', tt: 'Videosystem' }, { id: 'rx', t: 'Empfänger', tt: 'Empfänger' }, { id: 'extras', t: 'Extras', tt: 'Extras' }
];
const SLOT = (id) => SLOTS.find(s => s.id === id);
const KDEF = { whoop: { c: 1, mah: 450, video: 'analog' }, cine: { c: 4, mah: 850, video: 'dji' }, five: { c: 6, mah: 1300, video: 'dji' }, seven: { c: 6, mah: 3000, video: 'dji' } };
const VFAM = [
  { id: 'dji', t: 'DJI', sub: 'Goggles 3, N3, Integra', re: /dji/i },
  { id: 'walksnail', t: 'Walksnail', sub: 'Avatar-Brillen', re: /walksnail/i },
  { id: 'hdzero', t: 'HDZero', sub: 'sehr geringe Verzögerung', re: /hdzero/i },
  { id: 'analog', t: 'Analog', sub: 'günstig, jede analoge Brille', re: /./, typ: 'analog' }
];
const RFAM = [
  { id: 'elrs', t: 'ExpressLRS', sub: 'RadioMaster, BetaFPV, Jumper: fast alle neuen Funken', re: /expresslrs|elrs/i },
  { id: 'crsf', t: 'Crossfire / Tracer', sub: 'Funken mit TBS-Modul', re: /crossfire|tracer/i },
  { id: 'dji', t: 'DJI-Funke', sub: 'FPV Remote 3, nur mit DJI-Videosystem', re: /dji/i },
  { id: 'andere', t: 'Andere', sub: 'Ghost, FrSky', re: /ghost|frsky/i }
];
const cellsOf = (st) => { const a = P(st.akku); return a ? num(a.zellen) : null; };
const wantCells = (st = B) => cellsOf(st) || KDEF[st.klasse || 'five'].c;
function bestKv(m, c, klasse = B.klasse) { const ks = kvList(m); if (!ks.length) return null; const t = avg(KL(klasse).rpmV); return ks.slice().sort((a, b) => Math.abs(a * c * 3.7 - t) - Math.abs(b * c * 3.7 - t))[0]; }
const inClass = {
  rahmen: (f) => klasseOfFrame(f) === B.klasse,
  akku: (a) => klasseOfBattery(a) === B.klasse || (B.klasse === 'five' && num(a.zellen) >= 4 && num(a.mah) >= 850 && num(a.mah) <= 1800) || (B.klasse === 'cine' && num(a.zellen) >= 4 && num(a.mah) <= 1100) || (B.klasse === 'seven' && num(a.zellen) === 6 && num(a.mah) >= 1800),
  motor: (m) => { const s = statorOf(m), K = KL(B.klasse); return !!s && s.w >= K.stator[0] && s.w <= K.stator[1]; },
  prop: (p) => { const d = num(p.durchmesser_zoll), K = KL(B.klasse); return !!d && d >= K.prop[0] && d <= K.prop[1]; },
  board: (x) => B.klasse === 'whoop' ? isAio(x) && boardSize(x) <= 26 && (num(range(x.eingang_s)[0]) || 1) <= 2 : B.klasse === 'cine' ? boardSize(x) <= 26 || boardSize(x) === 30.5 : boardSize(x) >= 20 && !(num(range(x.eingang_s)[1]) < 4),
  // Natan 28.10.: „wenn man 7 Zoll auswählt, nur 7-Zoll-Teile“. Auch Video und Empfänger nach Gewicht passend zur Klasse
  video: (v) => { const g = num(v.gewicht_g); return B.klasse === 'whoop' ? g == null || g <= 10 : B.klasse === 'cine' ? g == null || g <= 30 : true; },
  rx: (r) => B.klasse === 'whoop' ? !/900|868|crossfire nano/i.test((r.frequenz || '') + r.name) && (num(r.gewicht_g) == null || num(r.gewicht_g) <= 1.5) : true
};
const listOf = (slot) => slot === 'board' ? boards() : slot === 'rx' ? arr('empfaenger') : arr(slot);
function stWith(slot, p, kv) {
  const st = Object.assign({}, B); st[slot] = p.id;
  if (slot === 'motor') st.kv = kv || bestKv(p, wantCells(st), st.klasse);
  if (slot === 'akku' && P(st.motor)) st.kv = bestKv(P(st.motor), num(p.zellen), st.klasse);
  if (slot === 'board' && isAio(p)) st.esc = null;
  if (slot === 'board' && p.eingebauter_empfaenger && (!st.rx || st.rx === '__builtin')) st.rx = '__builtin';
  if (slot === 'video' && p.typ === 'digital') st.kamera = null;
  return st;
}
const score = (st) => { const L = checks(st); return L.filter(c => c.lvl === 'bad').length * 1000 + L.filter(c => c.lvl === 'warn').length * 20; };
/* Bewertung einer Option im aktuellen Bau: schlechteste neue Meldung, in Alltagssprache */
function judge(slot, part, kv) {
  const st = stWith(slot, part, kv);
  const before = new Set(checks(B).filter(c => c.lvl !== 'ok').map(c => c.t));
  const after = checks(st).filter(c => c.lvl !== 'ok' && !before.has(c.t));
  const bad = after.find(c => c.lvl === 'bad'); if (bad) return { lvl: 'bad', t: bad.t, d: bad.d, kv: st.kv };
  const warn = after.find(c => c.lvl === 'warn'); if (warn) return { lvl: 'warn', t: warn.t, d: warn.d, kv: st.kv };
  let t = '';
  if (slot === 'motor' && st.kv) t = `${de(st.kv)} KV an ${wantCells(st)}S passt`;
  return { lvl: 'ok', t, kv: st.kv };
}
function specLine(stepId, p) {
  const s = [];
  const w = num(p.gewicht_g); if (w != null) s.push(de(w, w < 10 ? 1 : 0) + ' g');
  switch (stepId) {
    case 'rahmen': if (num(p.radstand_mm)) s.unshift(de(num(p.radstand_mm)) + ' mm Radstand'); if (num(p.max_prop_zoll)) s.push('Propeller bis ' + de(num(p.max_prop_zoll), 1) + ' Zoll'); break;
    case 'board': { const [lo, hi] = range(p.eingang_s); s.unshift(isAio(p) ? 'Eine Platine (AIO)' : 'Stack'); s.push(de(boardSize(p), 1) + ' mm'); if (lo) s.push(lo + 'S bis ' + hi + 'S'); const ea = num(p.esc_dauerstrom_a || (p.esc && p.esc.dauerstrom_a)); if (ea) s.push('ESC ' + de(ea) + ' A'); const u = uartsOf(p).filter(x => x.frei).length; if (u) s.push(u + ' freie Anschlüsse'); if (p.eingebauter_empfaenger) s.push('Empfänger eingebaut'); break; }
    case 'motor': { if (p.groesse) s.unshift('Größe ' + p.groesse); const [lo, hi] = range(p.empfohlen_s); if (lo) s.push('für ' + (lo === hi ? lo : lo + 'S bis ' + hi) + 'S'); break; }
    case 'prop': s.unshift(de(num(p.durchmesser_zoll), 1) + ' Zoll'); if (p.blaetter) s.push(p.blaetter + ' Blätter'); break;
    case 'akku': s.unshift(`${p.zellen}S · ${de(num(p.mah))} mAh`); break;
    case 'video': s.unshift(p.typ === 'digital' ? 'digital (HD)' : 'analog'); break;
    case 'rx': if (p.protokoll) s.unshift(String(p.protokoll).replace('CRSF (ExpressLRS)', 'ExpressLRS')); if (p.frequenz) s.push(String(p.frequenz).replace(/\s*\(.*\)/, '')); break;
  }
  return s.join(' · ');
}
const nameOf = (p) => p ? (p.name || p.id) : '';
const cleanName = (p) => nameOf(p).replace(/\s*\((?:\d|5 Zoll|7 Zoll|Cinewhoop)[^)]*\)\s*$/, '');

/* ---------- Automatisch zusammenstellen ---------- */
const state = { solderSeen: false, flown: false, solderStep: 0, edit: null, notes: [], f: {}, q: {}, her: {}, flash: '', exOk: false, klOk: false, w: { video: '', funk: '' } };
function bestOf(slot, list, pref = () => 0) {
  let best = null, bs = Infinity;
  list.forEach((p, i) => { const st = stWith(slot, p); const s = score(st) - pref(p, i); if (s < bs) { bs = s; best = { p, st }; } });
  if (best) { B[slot] = best.p.id; if (slot === 'motor') B.kv = best.st.kv; if (slot === 'board') { if (isAio(best.p)) B.esc = null; } }
  return best ? best.p : null;
}
function autoBuild() {
  const kl = B.klasse, def = KDEF[kl], keepW = state.w;
  KEYS.forEach(k => { if (k !== 'klasse') B[k] = null; });
  state.notes = [];
  const idx = (p, i) => -i * .5;
  bestOf('rahmen', arr('rahmen').filter(inClass.rahmen), idx);
  bestOf('akku', arr('akku').filter(inClass.akku), (a) => (num(a.zellen) === def.c ? 60 : 0) - Math.abs(num(a.mah) - def.mah) / 60 + (kl === 'seven' && /li-?ion/i.test(a.name) ? 20 : 0));
  bestOf('motor', arr('motor').filter(inClass.motor), idx);
  const K = KL(kl), mid = avg(K.prop);
  bestOf('prop', arr('prop').filter(inClass.prop), (p) => -Math.abs(num(p.durchmesser_zoll) - mid) * 8);
  const bd = bestOf('board', boards().filter(inClass.board), (x, i) => (layoutFor(x) && layoutFor(x).rollen ? 25 : 0) + ((kl === 'five' || kl === 'seven') && !isAio(x) && boardSize(x) === 30.5 ? 8 : 0) + (kl === 'whoop' && x.eingebauter_empfaenger && (keepW.funk || 'elrs') === 'elrs' ? 30 : 0) - i * .3);
  if (bd && !isAio(bd) && !bd.esc && !num(bd.esc_dauerstrom_a) && arr('esc').length) bestOf('esc', arr('esc'));
  // Videosystem nach Wunsch, sonst Empfehlung der Klasse
  const vf = VFAM.find(v => v.id === (keepW.video || def.video)) || VFAM[0];
  const vlist = arr('video').filter(v => vf.typ ? v.typ === vf.typ : vf.re.test(v.name));
  const big = kl === 'five' || kl === 'seven';
  let v = bestOf('video', vlist, (x) => (big ? (/pro|freestyle|tank/i.test(x.name) ? 10 : 0) : (/pro|freestyle|tank/i.test(x.name) ? 0 : 10)));
  if (v && checks(B).some(c => c.lvl === 'bad' && c.t.includes(nameOf(v)))) { const alt = bestOf('video', arr('video')); state.notes.push(`${vf.t} passt nicht zu ${K.name}${kl === 'whoop' ? ' mit 1S-Akku' : ''}. Darum ${cleanName(alt)}.`); v = alt; }
  if (v && v.typ === 'analog') { const cams = arr('extra').filter(x => x.typ === 'kamera'); if (cams.length) B.kamera = (big ? cams[0] : cams[cams.length - 1]).id; }
  // Empfänger
  const rf = keepW.funk || 'elrs', b = P(B.board);
  if (b && b.eingebauter_empfaenger && /elrs/i.test(b.eingebauter_empfaenger) && rf === 'elrs') B.rx = '__builtin';
  else if (rf === 'dji' && v && !/dji/i.test(v.name)) { state.notes.push('Die DJI-Funke funkt nur über ein DJI-Videosystem. Darum ExpressLRS.'); bestOf('rx', arr('empfaenger').filter(r => RFAM[0].re.test((r.protokoll || '') + r.name))); }
  else { const f = RFAM.find(x => x.id === rf) || RFAM[0]; bestOf('rx', arr('empfaenger').filter(r => f.re.test((r.protokoll || '') + ' ' + r.name)), (r, i) => (kl === 'seven' && /rp3|diversity/i.test(r.name) ? 10 : 0) - i * .5); }
  // Extras
  const c = cells() || 0, ex = arr('extra');
  if (c >= 4) { const caps = ex.filter(x => x.typ === 'kondensator'); B.kondensator = (caps.find(x => c >= 6 ? /50 ?V/.test(x.name) : /35 ?V/.test(x.name)) || caps[0] || {}).id || null; }
  if (kl !== 'whoop') B.buzzer = (ex.find(x => x.typ === 'buzzer') || {}).id || null;
  if (kl === 'seven') B.gps = (ex.find(x => /m10q/i.test(x.name)) || ex.find(x => x.typ === 'gps') || {}).id || null;
  state.flown = false; state.solderSeen = false; state.solderStep = 0;
}

/* ---------- Oberfläche: geführter Bau, ein Schritt nach dem anderen ----------
   Natan 28.10. 23:29: „ganz einfach aussuchen, welcher Akku, welcher Frame … mehrere Frames, mehrere Flight Controller …
   auf einmal werden Sachen ausgewählt, schon voreingestellt, die man gar nicht hat“.
   Regeln: nichts ist vorausgewählt; jeder Schritt zeigt nur, was zu den bisherigen Entscheidungen passt; wer vorne etwas
   ändert, verliert nur die Teile, die nicht mehr passen, und liest warum; „Für mich aussuchen“ nur auf Knopfdruck. */
let ui = {};
const INTRO = {
  klasse: '',
  rahmen: 'Der Rahmen gibt vor, wie groß die Propeller sein dürfen und wo der Flugcontroller sitzt. Leichter fliegt länger, schwerer hält mehr aus.',
  akku: '<b>S</b> ist die Zahl der Zellen: Mehr Zellen heißt mehr Spannung und mehr Kraft. <b>mAh</b> ist der Energievorrat: mehr mAh fliegt länger, wiegt aber mehr.',
  motor: '<b>Erst den Akku wählen, dann den Motor.</b> Die Zahl wie 2207 ist die Größe. <b>KV</b> sagt, wie schnell der Motor pro Volt dreht: Mit mehr Zellen nimmt man weniger KV. Die passende KV-Variante ist markiert und wird automatisch gewählt.',
  prop: 'Der Propeller muss in den Rahmen passen. Mehr Steigung bringt mehr Tempo und braucht mehr Strom.',
  board: 'Der <b>Flugcontroller</b> ist das Gehirn, der <b>ESC</b> (Motorregler) gibt den Motoren Strom. Beim <b>Stack</b> liegen beide übereinander, bei <b>AIO</b> ist alles auf einer Platine. An die freien Anschlüsse (UART) kommen Empfänger, Videosystem und GPS.',
  video: '<b>Digital</b> (DJI, Walksnail, HDZero) gibt ein scharfes HD-Bild. <b>Analog</b> ist günstig und hat kaum Verzögerung. Wichtig ist, dass es zu deiner Brille passt.',
  rx: 'Der Empfänger hört auf deine Funke. Er muss dieselbe Funktechnik sprechen wie deine Funke.'
};
const EXG = [['kondensator', 'Kondensator', 'schützt vor Spannungsspitzen, ab 4S Pflicht'], ['buzzer', 'Buzzer', 'piept, wenn die Drohne im Gras liegt'], ['gps', 'GPS', 'bringt die Drohne bei Signalverlust zurück'], ['led', 'LEDs', 'Licht, gut für die Halle und abends'], ['kamera', 'Analoge Kamera', 'nur bei analogem Video']];
function slotOf(c) {
  const t = c.t + ' ' + c.d, v = P(B.video), r = P(B.rx);
  if (/Flugcontroller passt nicht in den Rahmen/.test(c.t)) return 'board';
  if (/Kondensator|GPS/.test(t)) return 'extras';
  if (/KV|Motor ist für|Motor und Propeller|Schub zu Gewicht/.test(c.t)) return 'motor';
  if (/Propeller zu groß/.test(c.t)) return 'prop';
  if (/-Rahmen/.test(c.t)) return 'rahmen';
  if (v && c.t.includes(v.name)) return 'video';
  if (/Empfänger|SBUS/.test(c.t) || (r && c.t.includes(r.name))) return 'rx';
  if (/ESC|Platine|UART|Anschlüsse|Herstellerplan|verträgt/.test(c.t)) return 'board';
  return null;
}
const PARTSTEPS = ['akku', 'rahmen', 'board', 'motor', 'prop', 'video', 'rx'];
const short = (p) => cleanName(p).replace(/\s*\(.*$/, '').split(' ').slice(0, 3).join(' ');
const anyChosen = () => KEYS.some(k => k !== 'klasse' && k !== 'kv' && B[k]);
const holesOf = (f) => { const L = Array.isArray(f && f.stack_lochabstaende) ? f.stack_lochabstaende.map(num).filter(Boolean) : []; const s = num(f && f.stack_lochabstand); if (s && !L.some(x => Math.abs(x - s) < .1)) L.push(s); return L; };
const fitsFrame = (b, f = P(B.rahmen)) => { if (!f || !b) return true; const H = holesOf(f); return !H.length || H.some(h => Math.abs(h - boardSize(b)) <= .6); };
const fitsCells = (b, c = cells()) => { if (!c || !b) return true; const [lo, hi] = range(b.eingang_s); return !lo || (c >= lo && c <= hi); };
const hasPlan = (b) => !!(layoutFor(b) && layoutFor(b).rollen);
const exRec = (k) => { const c = cells() || 0; return (k === 'kondensator' && c >= 4) || (k === 'buzzer' && B.klasse !== 'whoop') || (k === 'gps' && B.klasse === 'seven'); };

function stepDone(id) {
  if (id === 'klasse') return !!state.klOk;
  if (id === 'video') { const v = P(B.video); return !!v && (v.typ === 'digital' || !!B.kamera); }
  if (PARTSTEPS.includes(id)) return !!B[id];
  if (id === 'extras') return !!state.exOk;
  if (id === 'loeten') return !!state.solderSeen;
  if (id === 'fly') return !!state.flown;
  return false;
}
const reach = (i) => STEPS.slice(0, i).every(s => stepDone(s.id));
function firstOpen() { const i = STEPS.findIndex(s => !stepDone(s.id)); return i < 0 ? STEPS.length - 1 : i; }
function stepLabel(id) {
  if (id === 'klasse') return state.klOk ? KL(B.klasse).name.replace(/^(Freestyle|Long Range|Tiny) /, '') : '';
  if (id === 'akku') { const a = P(B.akku); return a ? `${a.zellen}S · ${de(num(a.mah))} mAh` : ''; }
  if (id === 'rx' && B.rx === '__builtin') return 'eingebaut';
  if (PARTSTEPS.includes(id)) { const p = P(B[id]); return p ? short(p) : ''; }
  if (id === 'extras') { const n = EXG.filter(([k]) => k !== 'kamera' && B[k]).length; return state.exOk ? (n ? n + ' gewählt' : 'keine') : ''; }
  return '';
}
function renderSteps() {
  ui.steps.innerHTML = STEPS.map((s, i) => { const ok = reach(i) || i === step, done = stepDone(s.id), lab = stepLabel(s.id);
    return `<button type="button" class="${i === step ? 'now' : ''} ${done ? 'done' : ''}" data-i="${i}" ${ok ? '' : 'disabled'} ${i === step ? 'aria-current="step"' : ''} title="${esc(s.t + (lab ? ': ' + lab : ''))}"><b>${done && i !== step ? '✓' : i + 1}</b><span>${s.t}${lab ? `<small>${esc(lab)}</small>` : ''}</span></button>`; }).join('');
  const sid = STEPS[step].id, nx = STEPS[step + 1];
  ui.prev.hidden = step === 0;
  ui.next.hidden = !nx;
  if (nx) {
    const done = stepDone(sid) || sid === 'extras';
    ui.next.disabled = !done;
    const need = { klasse: 'Erst eine Klasse wählen', akku: 'Erst einen Akku wählen', rahmen: 'Erst einen Rahmen wählen', board: 'Erst einen Flugcontroller wählen', motor: 'Erst Motoren wählen', prop: 'Erst Propeller wählen', video: P(B.video) ? 'Erst eine Kamera wählen' : 'Erst ein Videosystem wählen', rx: 'Erst einen Empfänger wählen' };
    ui.next.querySelector('span').textContent = !done ? (need[sid] || 'Weiter') : sid === 'extras' && !EXG.some(([k]) => k !== 'kamera' && B[k]) ? 'Ohne Extras weiter' : 'Weiter: ' + nx.t;
    ui.next.classList.toggle('ready', done);
  }
}

/* Kandidaten je Schritt: nur, was zu Klasse, Akku, Rahmen und Flugcontroller passt */
function candidates(slot) {
  const f = P(B.rahmen), c = cells();
  let L = listOf(slot).filter(p => p && p.id && inClass[slot](p));
  if (slot === 'akku' && state.f.cells) L = L.filter(a => num(a.zellen) === +state.f.cells);
  if (slot === 'board') { L = L.filter(b => fitsFrame(b) && fitsCells(b)); if (state.f.art) L = L.filter(x => state.f.art === 'aio' ? isAio(x) : !isAio(x)); }
  if (slot === 'prop' && f && num(f.max_prop_zoll)) L = L.filter(p => num(p.durchmesser_zoll) <= num(f.max_prop_zoll) + .05);
  if (slot === 'video' && state.f.vfam) { const v = VFAM.find(x => x.id === state.f.vfam); if (v) L = L.filter(x => v.typ ? x.typ === v.typ : v.re.test(x.name)); }
  if (slot === 'rx' && state.f.rfam) { const r = RFAM.find(x => x.id === state.f.rfam); if (r) L = L.filter(x => r.re.test((x.protokoll || '') + ' ' + x.name)); }
  return L;
}
/* Ausgeschlossen, mit Grund (für den Klappkasten „Passt nicht“) */
function excluded(slot) {
  const f = P(B.rahmen), c = cells(), out = [];
  listOf(slot).filter(p => p && p.id && inClass[slot](p)).forEach(p => {
    if (slot === 'board') { if (!fitsFrame(p)) out.push({ p, why: `braucht ${de(boardSize(p), 1)} mm Lochabstand, dein Rahmen hat ${holesOf(f).map(h => de(h, 1)).join(' oder ')} mm` }); else if (!fitsCells(p)) { const [lo, hi] = range(p.eingang_s); out.push({ p, why: `verträgt nur ${lo}S bis ${hi}S, dein Akku hat ${c}S` }); } }
    if (slot === 'prop' && f && num(f.max_prop_zoll) && num(p.durchmesser_zoll) > num(f.max_prop_zoll) + .05) out.push({ p, why: `${de(num(p.durchmesser_zoll), 1)} Zoll, dein Rahmen nimmt höchstens ${de(num(f.max_prop_zoll), 1)} Zoll` });
  });
  return out;
}
function ranked(slot) {
  const rank = { ok: 0, warn: 1, bad: 2 };
  const J = candidates(slot).map(p => ({ p, j: judge(slot, p), s: score(stWith(slot, p)) + (slot === 'board' && !hasPlan(p) ? 15 : 0) }));
  J.sort((a, b) => rank[a.j.lvl] - rank[b.j.lvl] || a.s - b.s);
  const good = J.filter(x => x.j.lvl !== 'bad'), bad = J.filter(x => x.j.lvl === 'bad');
  const rec = good.find(x => x.j.lvl === 'ok') || null;
  return { good, bad, rec };
}

function rowHTML2(slot, p, j, rec) {
  const on = B[slot] === p.id;
  const tags = [];
  if (rec) tags.push('<span class="bk-tag rec">Empfohlen</span>');
  if (j.lvl === 'warn') tags.push('<span class="bk-tag warn">Hinweis</span>');
  if (slot === 'board') tags.push(hasPlan(p) ? '<span class="bk-tag plan">Genauer Lötplan</span>' : '<span class="bk-tag dim">Lötplan allgemein</span>');
  const why = j.lvl !== 'ok' ? `<span class="bk-why">${esc(j.t)}${j.d ? ': ' + esc(String(j.d).replace(/<[^>]+>/g, '')) : ''}</span>` : '';
  let kv = '';
  if (slot === 'motor' && on) {
    const ks = kvList(p), best = bestKv(p, wantCells()), c = wantCells(), [lo, hi] = KL(B.klasse).rpmV;
    const lab = k => { if (k === best) return 'passt'; const rpm = k * c * 3.7; return rpm > hi * 1.12 ? 'zu heiß' : rpm > hi ? 'sehr spritzig' : rpm < lo * .85 ? 'zu träge' : 'geht auch'; };
    if (ks.length > 1) kv = `<div class="bk-kvrow"><span>KV-Variante für deinen ${c}S-Akku</span><span class="bk-kvs" role="group" aria-label="KV-Variante">${ks.slice().sort((a, b) => a - b).map(k => { const l = lab(k); return `<button type="button" class="chip-b ${B.kv === k ? 'on' : ''} ${k === best ? 'rec' : ''} ${/heiß|träge/.test(l) ? 'dim' : ''}" data-pick-kv="${esc(p.id)}|${k}" aria-pressed="${B.kv === k}">${de(k)} KV · ${l}</button>`; }).join('')}</span></div>`;
  }
  return `<li class="bk-row ${on ? 'on' : ''} f-${j.lvl}" data-her="${esc(p.hersteller || 'Andere')}" data-s="${esc((nameOf(p) + ' ' + (p.hersteller || '')).toLowerCase())}">
    <button type="button" class="bk-row-b" data-pick="${esc(p.id)}" data-slot="${slot}" role="radio" aria-checked="${on}">
      <span class="bk-radio" aria-hidden="true"></span><span class="bk-opt-ic" aria-hidden="true">${icon(slot, p)}</span>
      <span class="bk-row-t"><b>${esc(cleanName(p))}</b><small>${esc(p.hersteller || '')}${p.hersteller ? ' · ' : ''}${esc(specLine(slot, p))}</small>${why}</span>
      <span class="bk-tags">${tags.join('')}</span>
    </button>${kv}</li>`;
}
function chipRow(name, items, cur, label) {
  return `<div class="bk-filter"><span>${label}</span><div class="bk-chips" role="group" aria-label="${esc(label)}">${items.map(([v, t, rec]) => `<button type="button" class="chip-b ${String(cur || '') === String(v) ? 'on' : ''} ${rec ? 'rec' : ''}" data-f="${name}" data-v="${esc(v)}" aria-pressed="${String(cur || '') === String(v)}">${t}</button>`).join('')}</div></div>`;
}
function decisionHTML(slot) {
  const f = state.f;
  if (slot === 'akku') {
    const cs = [...new Set(arr('akku').filter(inClass.akku).map(a => num(a.zellen)).filter(Boolean))].sort((a, b) => a - b), rec = KDEF[B.klasse].c;
    if (cs.length < 2) return '';
    return chipRow('cells', [['', 'Alle'], ...cs.map(c => [c, `${c}S${c === rec ? ' · empfohlen' : ''}`, c === rec])], f.cells, 'Wie viele Zellen (S)?');
  }
  if (slot === 'board') return chipRow('art', [['', 'Alle'], ['stack', 'Stack (zwei Platinen)'], ['aio', 'Alles auf einer Platine']], f.art, 'Bauart');
  if (slot === 'video') return chipRow('vfam', [['', 'Alle'], ...VFAM.map(v => [v.id, v.t])], f.vfam, 'Welche Brille hast du?');
  if (slot === 'rx') return chipRow('rfam', [['', 'Alle'], ...RFAM.map(r => [r.id, r.t])], f.rfam, 'Welche Funke hast du?');
  if (slot === 'motor') { const c = cells(); return c ? `<p class="bk-info"><i aria-hidden="true"></i>Dein Akku hat <b>${c}S</b>. Die passende KV-Variante wird beim Wählen gesetzt, du kannst sie danach ändern.</p>` : ''; }
  if (slot === 'prop') { const fr = P(B.rahmen); return fr && num(fr.max_prop_zoll) ? `<p class="bk-info"><i aria-hidden="true"></i>Dein Rahmen nimmt Propeller bis <b>${de(num(fr.max_prop_zoll), 1)} Zoll</b>.</p>` : ''; }
  if (slot === 'rahmen') return '';
  return '';
}
function toolsHTML(slot, list) {
  const her = [...new Set(list.map(x => x.p.hersteller || 'Andere'))].sort((a, b) => a.localeCompare(b, 'de'));
  const q = (state.q && state.q[slot]) || '', h = (state.her && state.her[slot]) || '';
  return `<div class="bk-find"><label class="sr" for="bk-q-${slot}">Suchen</label><input id="bk-q-${slot}" type="search" data-bk-search="${slot}" value="${esc(q)}" placeholder="Suchen, z. B. ${esc(her[0] || 'Hersteller')}" autocomplete="off">
    <label class="sr" for="bk-h-${slot}">Hersteller</label><select id="bk-h-${slot}" data-bk-her="${slot}"><option value="">Alle Hersteller (${list.length})</option>${her.map(x => `<option ${x === h ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
}
function partHTML(slot) {
  const S = SLOT(slot), K = KL(B.klasse);
  let h = `<h3 class="bk-h">${S.t} <small class="bk-kl-tag">${K.name}</small></h3><p class="bk-p">${INTRO[slot] || ''}</p>`;
  h += decisionHTML(slot);
  const { good, bad, rec } = ranked(slot);
  if (slot === 'rx' && P(B.board) && P(B.board).eingebauter_empfaenger) h += `<ul class="bk-list" role="radiogroup" aria-label="Eingebauter Empfänger"><li class="bk-row ${B.rx === '__builtin' ? 'on' : ''} f-ok"><button type="button" class="bk-row-b" data-builtin role="radio" aria-checked="${B.rx === '__builtin'}"><span class="bk-radio" aria-hidden="true"></span><span class="bk-opt-ic" aria-hidden="true">${icon('rx', {})}</span><span class="bk-row-t"><b>Eingebauter Empfänger</b><small>${esc(P(B.board).eingebauter_empfaenger)} steckt schon auf ${esc(cleanName(P(B.board)))}, nichts zu löten</small></span><span class="bk-tags"><span class="bk-tag rec">Empfohlen</span></span></button></li></ul><p class="bk-sub">Oder ein eigener Empfänger:</p>`;
  if (rec && !B[slot] && !(slot === 'rx' && B.rx === '__builtin')) h += `<button type="button" class="bk-auto" data-bk-auto="${slot}"><span>Für mich aussuchen</span><b>${esc(short(rec.p))}</b></button>`;
  if (good.length > 6) h += toolsHTML(slot, good);
  h += good.length ? `<ul class="bk-list" role="radiogroup" aria-label="${esc(S.t)}" data-bk-list>${good.map(x => rowHTML2(slot, x.p, x.j, rec && x.p.id === rec.p.id)).join('')}</ul><p class="bk-empty" data-bk-none hidden>Keine Treffer. Suche leeren oder anderen Hersteller wählen.</p>` : `<p class="bk-empty">Mit deiner Auswahl passt hier nichts. Ändere oben die Auswahl oder geh einen Schritt zurück.</p>`;
  const ex = excluded(slot).concat(bad.map(x => ({ p: x.p, why: x.j.t + (x.j.d ? ': ' + String(x.j.d).replace(/<[^>]+>/g, '') : '') })));
  if (ex.length) h += `<details class="bk-moreopts"><summary>Passt nicht zu deinem Bau (${ex.length})</summary><ul class="bk-nolist">${ex.map(x => `<li><b>${esc(cleanName(x.p))}</b><span>${esc(x.why)}</span></li>`).join('')}</ul></details>`;
  if (slot === 'board' && P(B.board) && !isAio(P(B.board)) && !P(B.board).esc && !num(P(B.board).esc_dauerstrom_a) && arr('esc').length) h += `<h4 class="bk-h4">Motorregler (ESC) dazu</h4><ul class="bk-list" role="radiogroup">${arr('esc').map(p => rowHTML2('esc', p, judge('esc', p), false)).join('')}</ul>`;
  if (slot === 'video' && P(B.video) && P(B.video).typ !== 'digital') { const cams = arr('extra').filter(x => x.typ === 'kamera'); if (cams.length) h += `<h4 class="bk-h4">Dazu eine Kamera <small>analoges Video braucht eine eigene Kamera</small></h4><ul class="bk-list" role="radiogroup">${cams.map(p => rowHTML2('kamera', p, { lvl: 'ok' }, false)).join('')}</ul>`; }
  return h;
}
function klasseHTML() {
  return `<h3 class="bk-h">Was willst du bauen?</h3><p class="bk-p">Danach führt dich die Werkbank Schritt für Schritt: Akku, Rahmen, Flugcontroller, Motoren und so weiter. Du siehst immer nur Teile, die zu deinen bisherigen Entscheidungen passen. Nichts ist vorausgewählt.</p>
    <div class="bk-klassen" role="radiogroup" aria-label="Klasse">${KLASSEN.map(k => { const on = B.klasse === k.id && state.klOk; return `<button type="button" class="bk-kl ${on ? 'on' : ''}" data-klasse="${k.id}" role="radio" aria-checked="${on}"><svg viewBox="0 0 120 80" aria-hidden="true">${klasseSVG(k.id)}</svg><b>${k.name}</b><small>${k.sub}</small></button>`; }).join('')}</div>`;
}
function extrasStepHTML() {
  const ex = arr('extra'); let h = `<h3 class="bk-h">Extras</h3><p class="bk-p">Alles freiwillig, nichts ist vorausgewählt. „Empfohlen“ heißt: Für deinen Bau sinnvoll. Ein zweiter Klick nimmt ein Teil wieder raus.</p>`;
  for (const [k, t, sub] of EXG) {
    if (k === 'kamera') continue;
    if (B.klasse === 'whoop' && (k === 'gps' || k === 'buzzer' || k === 'kondensator')) continue;
    if (B.klasse === 'cine' && k === 'gps') continue;
    const L = ex.filter(p => p.typ === k || (k === 'led' && /led/i.test(p.typ || ''))); if (!L.length) continue;
    h += `<h4 class="bk-h4">${t} ${exRec(k) ? '<span class="bk-tag rec">Empfohlen</span>' : ''} <small>${sub}</small></h4><ul class="bk-list">${L.map(p => { const on = B[k] === p.id; return `<li class="bk-row ${on ? 'on' : ''} f-ok"><button type="button" class="bk-row-b" data-extra="${k}" data-id="${esc(p.id)}" role="checkbox" aria-checked="${on}"><span class="bk-check" aria-hidden="true"></span><span class="bk-opt-ic" aria-hidden="true">${icon(k, p)}</span><span class="bk-row-t"><b>${esc(cleanName(p))}</b><small>${esc(specLine('extra', p))}</small></span><span class="bk-tags">${on ? '<span class="bk-tag plan">Eingebaut</span>' : ''}</span></button></li>`; }).join('')}</ul>`;
  }
  return h;
}
function solderHTML() {
  const b = P(B.board);
  if (!b) return `<h3 class="bk-h">Löten</h3><p class="bk-empty">Erst einen Flugcontroller wählen.</p>`;
  const plan = wiring(), steps = solderSteps(plan), i = clamp(state.solderStep, 0, steps.length - 1), s = steps[i];
  return `<h3 class="bk-h">Löten</h3><p class="bk-p">Ein Arbeitsschritt nach dem anderen. Im Plan siehst du genau, welcher Draht an welches Pad kommt. Der Plan ist zum Anschauen, anklicken musst du dort nichts.</p>
    <div class="bk-solcard" aria-live="polite"><p class="bk-kicker">Lötschritt ${i + 1} von ${steps.length}</p><div class="bk-soltext">${s.html}</div></div>
    <div class="bk-solnav"><button class="btn ghost" type="button" data-sol-go="-1" ${i === 0 ? 'disabled' : ''}>‹ Zurück</button><span class="bk-dots" aria-hidden="true">${steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('')}</span><button class="btn" type="button" data-sol-go="1" ${i === steps.length - 1 ? 'disabled' : ''}>Nächster Lötschritt ›</button></div>
    <details class="bk-moreopts"><summary>Alle ${steps.length} Lötschritte als Liste</summary><ol class="bk-sol">${steps.map((x, k) => `<li><button type="button" class="${k === i ? 'on' : ''}" data-sol="${k}" aria-pressed="${k === i}"><b>${k + 1}</b><span>${x.html}</span></button></li>`).join('')}</ol></details>
    ${plan.uarts.length ? `<h4 class="bk-h4">Danach in Betaflight unter „Anschlüsse“</h4><p class="bk-uarts">${plan.uarts.map(u => `<span><b>${esc(u.uart)}</b> ${esc(u.wer)}</span>`).join('')}</p><p class="mute small">Empfänger als „Serial RX“, Videosystem als „VTX (MSP + DisplayPort)“, GPS als „GPS“. Schritt für Schritt erklärt es <a href="werkstatt.html">Betaflight &amp; Löten</a>.</p>` : ''}`;
}
function flyHTML() {
  const L = checks(), bad = L.filter(c => c.lvl === 'bad'), need = ['rahmen', 'board', 'motor', 'prop', 'akku'].filter(k => !B[k]);
  let h = `<h3 class="bk-h">Abheben</h3>`;
  if (need.length) h += `<p class="bk-empty">Es fehlen noch: ${need.map(k => SLOT(k).t).join(', ')}.</p>`;
  else if (bad.length) h += `<p class="bk-empty">Erst die roten Punkte beheben, sonst hebt hier nichts ab:</p><ul class="bk-cl">${bad.map(c => { const sl = slotOf(c); return `<li class="f-bad"><b>${c.t}</b><span>${c.d}</span>${sl ? `<button type="button" class="bk-fix" data-edit="${sl}">Beheben: ${SLOT(sl).tt}</button>` : ''}</li>`; }).join('')}</ul>`;
  else h += `<p class="bk-p">Alles verbunden. Propeller drauf, Akku dran, und los. Danach fliegst du genau diesen Kopter im Vereins-Simulator durch unsere Turnhalle.</p><div class="btns"><button class="btn amber solid" type="button" data-bk-go2>Abheben</button><a class="btn" href="simulator.html?bau=1#simulator" data-bk-sim2>Im Simulator fliegen <span class="arr">→</span></a></div>`;
  h += `<h4 class="bk-h4">Dein Bau</h4><ul class="bk-sum">${PARTSTEPS.map(k => `<li><span>${SLOT(k).t}</span><b>${k === 'rx' && B.rx === '__builtin' ? 'Eingebaut' : P(B[k]) ? esc(cleanName(P(B[k]))) + (k === 'motor' && B.kv ? ` · ${de(B.kv)} KV` : '') : '–'}</b><button type="button" class="linkbtn" data-edit="${k}">ändern</button></li>`).join('')}</ul>`;
  h += `<div class="bk-share"><button class="btn ghost" type="button" data-bk-share>Bau als Link teilen</button></div>`;
  return h;
}
function renderBody() {
  const sid = STEPS[step].id;
  let h = `<div class="bk-sh"><p class="bk-kicker">Schritt ${step + 1} von ${STEPS.length}</p>${anyChosen() || state.klOk ? '<button type="button" class="bk-reset" data-bk-restart>Neu anfangen</button>' : ''}</div>`;
  if (state.flash) h += `<p class="bk-flash" role="status">${esc(state.flash)}</p>`;
  if (sid === 'klasse') h += klasseHTML();
  else if (PARTSTEPS.includes(sid)) h += partHTML(sid);
  else if (sid === 'extras') h += extrasStepHTML();
  else if (sid === 'loeten') h += solderHTML();
  else h += flyHTML();
  ui.body.innerHTML = h;
  applyFind(sid);
}
/* Suchen und Hersteller: nur ausblenden, nichts neu zeichnen (kein Springen) */
function applyFind(slot) {
  const list = ui.body.querySelector('[data-bk-list]'); if (!list) return;
  const q = ((state.q && state.q[slot]) || '').trim().toLowerCase(), h = (state.her && state.her[slot]) || '';
  let n = 0; list.querySelectorAll('.bk-row').forEach(li => { const ok = (!q || li.dataset.s.includes(q)) && (!h || li.dataset.her === h); li.hidden = !ok; if (ok) n++; });
  const none = ui.body.querySelector('[data-bk-none]'); if (none) none.hidden = n > 0;
}
function renderBar() {
  const m = metrics(), L = checks();
  ui.m.gewicht.textContent = m.gewicht ? de(Math.round(m.gewicht)) + ' g' : '–';
  ui.m.twr.textContent = m.twr ? de(m.twr, 1) + ' : 1' : '–';
  ui.m.hover.textContent = m.hover ? de(Math.round(m.hover * 100)) + ' %' : '–';
  { const lo = Math.max(1, Math.round(m.zeit * .85)), hi = Math.round(m.zeit * 1.15); ui.m.zeit.textContent = m.zeit ? (lo >= hi ? 'etwa ' + de(hi) : de(lo) + '–' + de(hi)) + ' min' : '–'; }
  const bad = L.filter(c => c.lvl === 'bad').length, warn = L.filter(c => c.lvl === 'warn').length;
  const any = anyChosen();
  ui.ampel.className = !any ? '' : bad ? 'bad' : warn ? 'warn' : 'ok';
  ui.checkT.textContent = !any ? 'Noch keine Teile' : bad ? `${bad} passt nicht` : warn ? `${warn} Hinweis${warn > 1 ? 'e' : ''}` : 'Alles passt';
  ui.checks.innerHTML = L.length ? `<ul class="bk-cl">${L.map(c => { const sl = c.lvl !== 'ok' && slotOf(c); return `<li class="f-${c.lvl}"><b>${c.t}</b><span>${c.d}</span>${sl ? `<button type="button" class="bk-fix" data-edit="${sl}">${c.lvl === 'bad' ? 'Beheben' : 'Ansehen'}: ${SLOT(sl).tt}</button>` : ''}</li>`; }).join('')}</ul>` : '<p class="mute">Noch nichts zu prüfen.</p>';
  const ready = ['rahmen', 'board', 'motor', 'prop', 'akku'].every(k => B[k]) && !bad;
  ui.go.disabled = !ready; ui.go.textContent = ready ? 'Abheben' : bad ? 'Erst Fehler beheben' : 'Abheben';
  ui.osdW.textContent = m.gewicht ? de(Math.round(m.gewicht)) + ' g' : '0 g';
  ui.osdName.textContent = (state.klOk ? KL(B.klasse).name : 'Dein Kopter') + (P(B.board) ? ' · ' + cleanName(P(B.board)) : '');
}
function render() { ui.app.classList.toggle('is-empty', !B.rahmen); renderSteps(); renderBody(); renderBar(); save(); if (view === 'loeten') drawSolder(); }
/* neu zeichnen, ohne dass die Liste springt */
function renderKeep() {
  const st = ui.body.scrollTop, ae = D.activeElement, sel = ae && ae.id && ui.body.contains(ae) ? '#' + ae.id : null, cp = ae && 'selectionStart' in ae ? ae.selectionStart : null;
  const pk = ae && ae.closest && ae.closest('[data-pick],[data-extra],[data-pick-kv]'); const pkSel = pk ? (pk.dataset.pickKv ? `[data-pick-kv="${pk.dataset.pickKv}"]` : pk.dataset.pick ? `[data-pick="${pk.dataset.pick}"]` : `[data-id="${pk.dataset.id}"]`) : null;
  render(); ui.body.scrollTop = st;
  const el = sel ? ui.body.querySelector(sel) : pkSel ? ui.body.querySelector(pkSel) : null;
  if (el) { el.focus({ preventScroll: true }); if (cp != null && el.setSelectionRange) try { el.setSelectionRange(cp, cp); } catch (e) {} }
}

/* kleine Symbole, eigene SVG-Zeichnungen, eine Strichstärke */
function icon(k, p) {
  const s = (d) => `<svg viewBox="0 0 32 32">${d}</svg>`;
  switch (k) {
    case 'rahmen': return s('<path d="M6 6l20 20M26 6L6 26"/><circle cx="6" cy="6" r="3.5"/><circle cx="26" cy="6" r="3.5"/><circle cx="6" cy="26" r="3.5"/><circle cx="26" cy="26" r="3.5"/><rect x="12" y="12" width="8" height="8" rx="1.5"/>');
    case 'board': case 'esc': return s('<rect x="6" y="6" width="20" height="20" rx="2"/><rect x="12" y="12" width="8" height="8"/><path d="M9 3v3M16 3v3M23 3v3M9 26v3M16 26v3M23 26v3M3 9h3M3 16h3M3 23h3M26 9h3M26 16h3M26 23h3"/>');
    case 'motor': return s('<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 6v4M16 22v4M6 16h4M22 16h4"/>');
    case 'prop': return s('<path d="M16 16C12 10 6 8 4 10s4 8 12 6zM16 16c4 6 10 8 12 6s-4-8-12-6z"/><circle cx="16" cy="16" r="2"/>');
    case 'akku': return s('<rect x="4" y="9" width="22" height="14" rx="2"/><path d="M26 13h2v6h-2M9 16h6M12 13v6"/>');
    case 'video': return p && p.typ === 'analog' ? s('<rect x="6" y="9" width="14" height="14" rx="2"/><circle cx="13" cy="16" r="4"/><path d="M20 13l6-3v12l-6-3"/>') : s('<rect x="5" y="10" width="16" height="12" rx="2"/><circle cx="13" cy="16" r="3"/><path d="M21 14l6-2v8l-6-2M8 7h10"/>');
    case 'rx': return s('<rect x="10" y="14" width="12" height="12" rx="1.5"/><path d="M16 14V5M11 6l5-1 5 1"/>');
    case 'gps': return s('<rect x="7" y="7" width="18" height="18" rx="3"/><circle cx="16" cy="16" r="4"/><path d="M16 3v4"/>');
    case 'led': return s('<path d="M4 16h24"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="24" cy="16" r="2"/><path d="M8 10v-3M16 10v-3M24 10v-3"/>');
    case 'buzzer': return s('<circle cx="14" cy="16" r="7"/><circle cx="14" cy="16" r="2"/><path d="M24 10c2 3 2 9 0 12M27 7c3 5 3 13 0 18"/>');
    case 'kondensator': return s('<rect x="10" y="6" width="12" height="20" rx="3"/><path d="M14 26v4M18 26v4M10 10h12"/>');
    case 'kamera': return s('<rect x="7" y="8" width="18" height="16" rx="2"/><circle cx="16" cy="16" r="5"/>');
  }
  return s('<circle cx="16" cy="16" r="8"/>');
}
function klasseSVG(id) {
  const d = { whoop: [22, 9, true], cine: [26, 11, true], five: [30, 13, false], seven: [36, 15, false] }[id];
  const [r, pr, duct] = d; let o = '';
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = 60 + sx * r, y = 40 + sy * r * .62;
    o += `<path d="M60 40L${x} ${y}"/>`;
    o += duct ? `<ellipse cx="${x}" cy="${y}" rx="${pr + 3}" ry="${(pr + 3) * .55}"/>` : '';
    o += `<ellipse class="p" cx="${x}" cy="${y}" rx="${pr}" ry="${pr * .55}"/>`;
  }
  return o + '<rect x="52" y="34" width="16" height="12" rx="2"/>';
}

/* =====================================================================
   Lötplan zeichnen (SVG)
   ===================================================================== */
function solderSteps(plan) {
  const b = P(B.board), e = P(B.esc), m = P(B.motor);
  const S = [];
  const cap = B.kondensator ? nameOf(P(B.kondensator)) : null;
  S.push({ pads: ['BAT+', 'BAT-'], html: `<b>Akkukabel${cap ? ' und Kondensator' : ''}</b> an die großen Pads ${isAio(b) ? 'der Platine' : 'des ESC'}: rot an <code>+</code>, schwarz an <code>−</code>.${cap ? ' Der Kondensator kommt mit kurzen Beinen auf dieselben Pads, Minus-Streifen an Minus.' : ''}` });
  S.push({ pads: ['M1', 'M2', 'M3', 'M4'], html: `<b>Motorkabel</b> an M1 bis M4 (je drei Drähte). Die Reihenfolge der drei Drähte ist egal, die Drehrichtung stellst du später am PC in der Software des Motorreglers um.` });
  if (!isAio(b)) S.push({ pads: ['ESC'], html: `<b>Stack verbinden:</b> das 8-polige Kabel zwischen ESC und Flugcontroller einstecken. Gummidämpfer nicht zu fest anziehen.` });
  const grp = {};
  plan.wires.forEach(w => { (grp[w.teil] = grp[w.teil] || []).push(w); });
  for (const teil of Object.keys(grp)) {
    const ws = grp[teil];
    S.push({ pads: ws.map(w => w.pad), ids: ws.map(w => w.padId || w.pad), teil, html: `<b>${esc(teil)}</b>: ${ws.map(w => `${esc(w.kabel)} → <code>${esc(w.pad)}</code>`).join(', ')}.${ws.some(w => w.notiz) ? ' <span class="mute">' + ws.filter(w => w.notiz).map(w => esc(w.notiz).replace(/[.\s]+$/, '')).join('. ') + '.</span>' : ''}` });
  }
  S.push({ pads: [], html: `<b>Prüfen vor dem ersten Akku:</b> Durchgang zwischen Plus und Minus messen (darf nicht piepen), dann mit Smoke-Stopper und ohne Propeller anstecken.` });
  return S;
}
function padLayout(b) {
  /* Pads der Platine um das Board verteilen. Mit Lageangabe aus den Daten (rand: nord/ost/sued/west), sonst gleichmäßig. */
  const raw = Array.isArray(b.pads) ? b.pads : [];
  const list = raw.map(p => typeof p === 'string' ? { name: p } : { name: p.name || p.pad, rand: (p.rand || p.kante || p.seite || '').toLowerCase() }).filter(p => p.name);
  const sides = { n: [], o: [], s: [], w: [] };
  const key = (r) => /nord|oben|top|n$/.test(r) ? 'n' : /ost|rechts|right|e$|o$/.test(r) ? 'o' : /s(ü|ue)d|unten|bottom|s$/.test(r) ? 's' : /west|links|left|w$/.test(r) ? 'w' : null;
  const rest = [];
  list.forEach(p => { const k = key(p.rand); if (k) sides[k].push(p); else rest.push(p); });
  rest.forEach((p, i) => { const k = ['n', 'o', 's', 'w'].sort((a, c) => sides[a].length - sides[c].length)[0]; sides[k].push(p); });
  return sides;
}
function drawEsc(mk, b, act) {
  const aio = isAio(b), S = 440, x0 = 500 - S / 2, y0 = 450 - S / 2, on = new Set(act.pads);
  vlabel(aio ? 'die Platine (alles auf einer), Akku- und Motorpads' : 'den Motorregler (ESC), die untere Platine im Stapel', aio ? 'aio' : 'bottom');
  ui.solder.classList.remove('fade'); void ui.solder.getBoundingClientRect(); if (!RM) ui.solder.classList.add('fade');
  mk('rect', { x: x0, y: y0, width: S, height: S, rx: 26, class: 'sv-esc' });
  for (let i = 0; i < 4; i++) mk('rect', { x: x0 + 120 + i * 52, y: y0 + 170, width: 36, height: 36, rx: 3, class: 'sv-mcu' });
  mk('text', { x: 500, y: y0 + 240, 'text-anchor': 'middle', class: 'sv-t sm dim' }).textContent = aio ? nameOf(b) + ' (alles auf einer Platine)' : '4in1-ESC, unten im Stack';
  // Motorpads in den Ecken, je drei
  const corners = [[x0 + 40, y0 + 40, 'M1'], [x0 + S - 40, y0 + 40, 'M2'], [x0 + 40, y0 + S - 110, 'M4'], [x0 + S - 40, y0 + S - 110, 'M3']];
  corners.forEach(([x, y, n]) => { for (let i = 0; i < 3; i++) mk('rect', { x: x - 30 + i * 22, y: y - 9, width: 16, height: 18, rx: 3, class: 'sv-pad' + (on.has(n) ? ' on' : '') }); mk('text', { x, y: y + 34, 'text-anchor': 'middle', class: 'sv-t pad' + (on.has(n) ? ' on' : '') }).textContent = n; if (on.has(n)) { const ox = x < 500 ? x - 150 : x + 150; mk('path', { d: `M${x} ${y} C ${x} ${y - 60}, ${ox} ${y - 60}, ${ox} ${y - 90}`, class: 'sv-w w-tx on' }); mk('text', { x: ox, y: y - 100, 'text-anchor': 'middle', class: 'sv-t sm out' }).textContent = 'Motor ' + n.slice(1); } });
  // Akkupads
  const bp = on.has('BAT+');
  mk('rect', { x: 400, y: y0 + S - 70, width: 70, height: 46, rx: 6, class: 'sv-big' + (bp ? ' on' : '') }); mk('rect', { x: 530, y: y0 + S - 70, width: 70, height: 46, rx: 6, class: 'sv-big' + (bp ? ' on' : '') });
  mk('text', { x: 435, y: y0 + S - 40, 'text-anchor': 'middle', class: 'sv-t' }).textContent = '+'; mk('text', { x: 565, y: y0 + S - 40, 'text-anchor': 'middle', class: 'sv-t' }).textContent = '−';
  if (bp) {
    mk('path', { d: `M435 ${y0 + S - 24} C 435 ${y0 + S + 40}, 470 ${y0 + S + 60}, 480 ${y0 + S + 110}`, class: 'sv-w w-v on' });
    mk('path', { d: `M565 ${y0 + S - 24} C 565 ${y0 + S + 40}, 530 ${y0 + S + 60}, 520 ${y0 + S + 110}`, class: 'sv-w w-g on' });
    mk('rect', { x: 455, y: y0 + S + 110, width: 90, height: 50, rx: 6, class: 'sv-big on' }); mk('text', { x: 500, y: y0 + S + 142, 'text-anchor': 'middle', class: 'sv-t sm' }).textContent = 'XT60';
    if (B.kondensator) { mk('rect', { x: 620, y: y0 + S - 20, width: 120, height: 44, rx: 22, class: 'sv-box' }); mk('text', { x: 680, y: y0 + S + 8, 'text-anchor': 'middle', class: 'sv-t sm' }).textContent = 'Kondensator'; mk('path', { d: `M620 ${y0 + S} C 600 ${y0 + S}, 580 ${y0 + S - 30}, 565 ${y0 + S - 40}`, class: 'sv-w w-g on' }); }
  }
  if (bp) iron(mk, 435, y0 + S - 47); else if (on.has('M1')) iron(mk, x0 + 40, y0 + 40);
  if (!aio) { const c = on.has('ESC'); mk('rect', { x: 440, y: y0 + 60, width: 120, height: 34, rx: 4, class: 'sv-conn' + (c ? ' on' : '') }); mk('text', { x: 500, y: y0 + 126, 'text-anchor': 'middle', class: 'sv-t pad' + (c ? ' on' : '') }).textContent = '8-polig zum Flugcontroller'; if (c) mk('path', { d: `M500 ${y0 + 60} C 500 ${y0 - 20}, 500 ${y0 - 30}, 500 ${y0 - 60}`, class: 'sv-w w-plug on' }); }
  state.solderSeen = true;
}

/* Anschlussplan im Stil der Hersteller-Pläne: Platine mit allen Pads an der echten Stelle,
   Bauteile drumherum, Leitungen rechtwinklig über einen Ring um die Platine, animiert Schritt für Schritt. */
const WCOL = { v: '#ff4b5c', g: '#8a95a5', tx: '#ffb020', rx: '#3ee08a', vid: '#f2d33a', plug: '#3fe0ff' };
function edgeOf(p, h) { const d = { w: p.x, e: 1 - p.x, n: p.y, s: h - p.y }; return Object.keys(d).sort((a, c) => d[a] - d[c])[0]; }
const PLDEFS = (farbe) => `
<radialGradient id="svg-pcb" cx="45%" cy="35%" r="80%"><stop offset="0" stop-color="#2c313b"/><stop offset=".55" stop-color="${farbe}"/><stop offset="1" stop-color="#090a0d"/></radialGradient>
<pattern id="svg-mask" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="transparent"/><circle cx="1" cy="1" r=".6" fill="rgba(255,255,255,.045)"/><circle cx="4" cy="4" r=".5" fill="rgba(0,0,0,.25)"/></pattern>
<linearGradient id="svg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe6a2"/><stop offset=".45" stop-color="#d9ad48"/><stop offset="1" stop-color="#9b7224"/></linearGradient>
<radialGradient id="svg-tin" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#d7dde6"/><stop offset="1" stop-color="#7d8592"/></radialGradient>
<linearGradient id="svg-alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e7ec"/><stop offset=".5" stop-color="#aab1bc"/><stop offset="1" stop-color="#7b8390"/></linearGradient>
<linearGradient id="svg-orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb259"/><stop offset=".6" stop-color="#f07c12"/><stop offset="1" stop-color="#b8560a"/></linearGradient>
<linearGradient id="svg-pcb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a303b"/><stop offset="1" stop-color="#14171d"/></linearGradient>
<radialGradient id="svg-ceramic" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f4dfa0"/><stop offset=".7" stop-color="#c79a3a"/><stop offset="1" stop-color="#8a6420"/></radialGradient>
<radialGradient id="svg-lens" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#4a7fb0"/><stop offset=".5" stop-color="#10273d"/><stop offset="1" stop-color="#020407"/></radialGradient>
<filter id="svg-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="svg-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0b1420" flood-opacity=".45"/></filter>
<filter id="svg-sh2" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0b1420" flood-opacity=".4"/></filter>`;
function drawPlan(svg, mk, b, plan, steps, act) {
  const L = plan.layout, h = L.h || 1, BS = 380, x0 = 500 - BS / 2, BH = BS * h, y0 = 490 - BH / 2;
  const cur = state.solderStep, last = steps.length - 1;
  const pos = {};
  const doneIds = new Set(), actIds = new Set(act.ids || act.pads || []);
  steps.forEach((st, i) => { if (i < cur || cur === last) (st.ids || st.pads || []).forEach(x => doneIds.add(x)); });
  const under = new Set([...((L.unterseite && L.unterseite.buchsen) || []).map(c => 'BUCHSE:' + c.n), ...L.pads.filter(p => p.unten).map(p => p.id || p.n)]);
  const flip = (act.ids || []).some(x => under.has(String(x)));
  const raute = L.form === 'raute';
  const pcb = (attrs) => raute ? mk('path', { d: `M${x0 + BS / 2} ${y0} L${x0 + BS} ${y0 + BH / 2} L${x0 + BS / 2} ${y0 + BH} L${x0} ${y0 + BH / 2}Z`, 'stroke-linejoin': 'round', ...attrs }, g) : mk('rect', { x: x0, y: y0, width: BS, height: BH, rx: 34, ...attrs }, g);
  svg.classList.remove('fade'); void svg.getBoundingClientRect(); if (!RM) svg.classList.add('fade');
  vlabel(isAio(b) ? `die Platine (alles auf einer), ${flip ? 'Unterseite' : 'Oberseite'}` : `den Flugcontroller${flip ? ', Unterseite' : ''}`, isAio(b) ? 'aio' : 'top');
  const defs = mk('defs', {});
  defs.innerHTML = PLDEFS(L.farbe || '#14161b');
  // Platine
  const g = mk('g', { class: 'pl-board' + (flip ? ' flip' : '') });
  pcb({ class: 'pl-pcb', fill: 'url(#svg-pcb)', filter: 'url(#svg-shadow)' });
  pcb({ fill: 'url(#svg-mask)' });
  for (let i = 0; i < 9; i++) mk('path', { d: `M${x0 + BS * .22} ${y0 + BH * (.24 + i * .06)} h${BS * (.12 + (i % 3) * .05)} l${BS * .03} ${BS * .03} h${BS * .16}`, class: 'pl-trace' }, g);
  mk('rect', { x: x0 + BS * .4, y: y0 + BH * .38, width: BS * .16, height: BS * .16, rx: 3, class: 'pl-chip' }, g);
  for (let i = 0; i < 6; i++) { mk('rect', { x: x0 + BS * (.25 + i * .05), y: y0 + BH * .7, width: BS * .025, height: BS * .014, class: 'pl-smd' }, g); mk('rect', { x: x0 + BS * .3, y: y0 + BH * (.2 + i * .035), width: BS * .014, height: BS * .025, class: 'pl-smd' }, g); }
  if (flip) {
    mk('text', { x: 500, y: y0 + 46, 'text-anchor': 'middle', class: 'sv-t sm dim' }, g).textContent = 'Unterseite';
    const bu = (L.unterseite && L.unterseite.buchsen) || [];
    const sock = (c, cx, cy) => { const w = c.w * BS, hh = c.h * BS; mk('rect', { x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, rx: 4, class: 'pl-sock on' }, g); };
    L.pads.filter(p => p.unten).forEach(p => { const cx = x0 + (1 - p.x) * BS, cy = y0 + p.y * BS, id = p.id || p.n, on = actIds.has(id), done = doneIds.has(id); mk('rect', { x: cx - 8.5, y: cy - 8.5, width: 17, height: 17, rx: 2.5, class: 'pl-pad' + (on ? ' on' : '') + (done ? ' done' : '') }, g); if (on || done) mk('circle', { cx, cy, r: 6.5, class: 'pl-blob' + (on ? ' fresh' : '') }, g); mk('text', { x: cx, y: cy + (p.y > h / 2 ? -16 : 28), 'text-anchor': 'middle', class: 'pl-lab in' + (on ? ' on' : '') }, g).textContent = p.lab || p.n; });
    bu.forEach(c => { const cx = x0 + (1 - c.x) * BS, cy = y0 + c.y * BS, w = c.w * BS, hh = c.h * BS; mk('rect', { x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, rx: 4, class: 'pl-sock on' }, g); for (let i = 0; i < (c.pins || []).length; i++) mk('rect', { x: cx - w / 2 + 6 + i * (w - 12) / c.pins.length, y: cy - 3, width: (w - 12) / c.pins.length - 4, height: 6, class: 'pl-pin' }, g); mk('text', { x: cx, y: cy - hh / 2 - 12, 'text-anchor': 'middle', class: 'sv-t sm' }, g).textContent = c.lab || c.n; });
  }
  (L.loecher || []).forEach(([hx, hy]) => { const cx = x0 + hx * BS, cy = y0 + hy * BS; mk('circle', { cx, cy, r: 22, class: 'pl-ring' }, g); mk('circle', { cx, cy, r: 12, class: 'pl-hole' }, g); });
  if (!flip) (L.teile || []).forEach(t => {
    const tx = x0 + t.x * BS, ty = y0 + t.y * BS;
    if (t.typ === 'usb') { mk('rect', { x: tx, y: ty, width: t.w * BS, height: t.h * BS, rx: 10, class: 'pl-usb' }, g); mk('rect', { x: tx + 10, y: ty + t.h * BS * .3, width: t.w * BS - 20, height: t.h * BS * .4, rx: 8, class: 'pl-usb-in' }, g); }
    else if (t.typ === 'pfeil') mk('path', { d: `M${tx} ${ty - 34} L${tx + 26} ${ty + 22} L${tx} ${ty + 8} L${tx - 26} ${ty + 22}Z`, class: 'pl-arrow' }, g);
    else if (t.typ === 'antenne') mk('path', { d: `M${tx} ${ty} h${t.w * BS} v${t.h * BS * .5} h-${t.w * BS * .3} v-${t.h * BS * .3} h-${t.w * BS * .4} v${t.h * BS * .3}`, class: 'pl-ant' }, g);
    else if (t.typ === 'jumper') { mk('rect', { x: tx, y: ty, width: t.w * BS, height: t.h * BS, rx: 3, class: 'pl-jmp' }, g); }
    else if (t.typ === 'chip') mk('rect', { x: tx - t.w * BS / 2, y: ty - t.w * BS / 2, width: t.w * BS, height: t.w * BS, rx: 4, class: 'pl-chip' }, g);
    else if (t.typ === 'knopf') { mk('rect', { x: tx - 11, y: ty - 8, width: 22, height: 16, rx: 3, class: 'pl-btn' }, g); mk('circle', { cx: tx, cy: ty, r: 4.5, class: 'pl-btn-in' }, g); }
    else if ((t.typ === 'buchse' || t.typ === 'stecker') && t.w) { const w = t.w * BS, hh = (t.h || .06) * BS, on = actIds.has('BUCHSE:' + t.n); mk('rect', { x: tx, y: ty, width: w, height: hh, rx: 4, class: 'pl-sock' + (on ? ' on' : '') }, g); const np = (t.pins || []).length; for (let i = 0; i < np; i++) { const vert = hh > w; mk('rect', vert ? { x: tx + hh * 0 + w * .3, y: ty + 5 + i * (hh - 10) / np, width: w * .4, height: (hh - 10) / np - 3, class: 'pl-pin' } : { x: tx + 5 + i * (w - 10) / np, y: ty + hh * .3, width: (w - 10) / np - 3, height: hh * .4, class: 'pl-pin' }, g); } }
  });
  if (!flip) (L.teile || []).filter(t => t.typ === 'buchse' && t.n).forEach(c => { const cxr = c.x + (c.w || 0) / 2, cyr = c.y + (c.h || 0) / 2, e = edgeOf({ x: cxr, y: cyr }, h), cx = x0 + cxr * BS, cy = y0 + cyr * BS; pos['BUCHSE:' + c.n] = { x: cx, y: cy, lx: cx, ly: cy, e, inner: true }; });
  // Pads
  const PS = 17;
  if (!flip) L.pads.filter(p => !p.unten).forEach(p => {
    const cx = x0 + p.x * BS, cy = y0 + p.y * BS, id = p.id || p.n, e = edgeOf(p, h);
    const on = actIds.has(id), done = doneIds.has(id);
    mk('rect', { x: cx - PS / 2, y: cy - PS / 2, width: PS, height: PS, rx: 2.5, class: 'pl-pad' + (on ? ' on' : '') + (done ? ' done' : '') }, g);
    if (done || on) mk('circle', { cx, cy, r: 6.5, class: 'pl-blob' + (on ? ' fresh' : '') }, g);
    const inner = Math.min(p.x, 1 - p.x, p.y, h - p.y) > .08;
    const lab = p.lab || p.n, cls = 'pl-lab' + (on ? ' on' : '') + (inner ? ' in' : '');
    const tight = inner && (e === 'n' || e === 's') && L.pads.some(q => q !== p && !q.unten && Math.abs(q.y - p.y) < .03 && Math.abs(q.x - p.x) < .055 + String(lab).length * .004);
    if (tight) { const ty = e === 'n' ? cy + 14 : cy - 14; mk('text', { x: cx + 4, y: ty, class: cls + ' v', transform: `rotate(-90 ${cx + 4} ${ty})`, 'text-anchor': e === 'n' ? 'end' : 'start' }, g).textContent = lab; }
    else if (inner) mk('text', { x: cx + (e === 'w' ? 16 : e === 'e' ? -16 : 0), y: cy + (e === 'n' ? 24 : e === 's' ? -16 : 4), 'text-anchor': e === 'w' ? 'start' : e === 'e' ? 'end' : 'middle', class: cls }, g).textContent = lab;
    else if (e === 'n' || e === 's') { const ty = e === 'n' ? y0 - 12 : y0 + BH + 12; mk('text', { x: cx + 5, y: ty, class: cls, transform: `rotate(-90 ${cx + 5} ${ty})`, 'text-anchor': e === 'n' ? 'start' : 'end' }, g).textContent = lab; }
    else mk('text', { x: e === 'w' ? x0 - 12 : x0 + BS + 12, y: cy + 5, 'text-anchor': e === 'w' ? 'end' : 'start', class: cls }, g).textContent = lab;
    const dist = inner ? 34 : 22 + String(lab).length * 8.6, lx = e === 'w' ? x0 - dist : e === 'e' ? x0 + BS + dist : cx, ly = e === 'n' ? y0 - dist : e === 's' ? y0 + BH + dist : cy;
    const sx = e === 'w' ? x0 - 4 : e === 'e' ? x0 + BS + 4 : cx, sy = e === 'n' ? y0 - 4 : e === 's' ? y0 + BH + 4 : cy;
    pos[id] = { x: cx, y: cy, lx, ly, e, inner, sx, sy };
  });
  if (flip) L.pads.forEach(p => { const e = edgeOf(p, h), cx = x0 + (p.unten ? 1 - p.x : p.x) * BS, cy = y0 + p.y * BS; pos[p.id || p.n] = { x: cx, y: cy, lx: cx, ly: cy, e, inner: true, ghost: !p.unten }; });
  if (flip) (L.unterseite && L.unterseite.buchsen || []).forEach(c => { pos['BUCHSE:' + c.n] = { x: x0 + (1 - c.x) * BS, y: y0 + c.y * BS + c.h * BS / 2, lx: x0 + (1 - c.x) * BS, ly: y0 + BH + 34, e: 's', inner: true }; });
  // Bauteile: Seite nach Lage ihrer Pads
  const grp = {}; plan.wires.forEach(w => { (grp[w.teil] = grp[w.teil] || []).push(w); });
  const sides = { w: [], e: [], n: [], s: [] };
  Object.keys(grp).forEach(t => { const cnt = { w: 0, e: 0, n: 0, s: 0 }; grp[t].forEach(w => { const p = pos[w.padId]; if (p) cnt[p.e]++; else if (String(w.padId).startsWith('BUCHSE')) cnt.s += 3; }); const sd = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0]; sides[sd].push(t); });
  // Leitungen über einen Ring um die Platine
  const visible = (w) => { const id = w.padId; return actIds.has(id) || doneIds.has(id) || (act.teil === w.teil); };
  let k = 0;
  const ringPt = (d) => ({ X0: x0 - d, Y0: y0 - d, X1: x0 + BS + d, Y1: y0 + BH + d });
  const perim = (R, p) => { const W = R.X1 - R.X0, H = R.Y1 - R.Y0; if (Math.abs(p.y - R.Y0) < .5) return p.x - R.X0; if (Math.abs(p.x - R.X1) < .5) return W + (p.y - R.Y0); if (Math.abs(p.y - R.Y1) < .5) return W + H + (R.X1 - p.x); return 2 * W + H + (R.Y1 - p.y); };
  const walk = (R, a, c) => { const W = R.X1 - R.X0, H = R.Y1 - R.Y0, T = 2 * (W + H); const corners = [[W, R.X1, R.Y0], [W + H, R.X1, R.Y1], [2 * W + H, R.X0, R.Y1], [T, R.X0, R.Y0]]; let ta = perim(R, a), tc = perim(R, c), fw = (tc - ta + T) % T, pts = []; const forward = fw <= T / 2; const n = forward ? fw : T - fw; const cs = corners.map(x => x[0] % T); for (const [cc, cx, cy] of corners) { const d = forward ? (cc % T - ta + T) % T : (ta - cc % T + T) % T; if (d > 0 && d < n) pts.push({ d, x: cx, y: cy }); } pts.sort((u, v2) => u.d - v2.d); return pts; };
  const onRing = (R, sd, x, y) => sd === 'w' ? { x: R.X0, y: clamp(y, R.Y0, R.Y1) } : sd === 'e' ? { x: R.X1, y: clamp(y, R.Y0, R.Y1) } : sd === 'n' ? { x: clamp(x, R.X0, R.X1), y: R.Y0 } : { x: clamp(x, R.X0, R.X1), y: R.Y1 };
  for (const sd of ['w', 'e', 'n', 's']) {
    const list = sides[sd];
    list.forEach((t, i) => {
      const ws = grp[t], n = list.length, isAct = act.teil === t || ws.some(w => actIds.has(w.padId));
      const anyShown = ws.some(visible);
      let cx, cy; if (sd === 'w') { cx = 92; cy = 160 + (i + .5) * (680 / n); } else if (sd === 'e') { cx = 908; cy = 160 + (i + .5) * (680 / n); } else if (sd === 'n') { cx = 140 + (i + .5) * (720 / n); cy = 70; } else { cx = 140 + (i + .5) * (720 / n); cy = 930; }
      const cg = mk('g', { class: 'pl-comp' + (isAct ? ' on' : '') + (anyShown ? '' : ' wait') });
      compArt(mk, cg, t, cx, cy, sd);
      ws.forEach((w, j) => {
        const p = pos[w.padId]; if (!p || p.ghost) return;
        const off = (j - (ws.length - 1) / 2) * 20;
        let S; if (sd === 'w') S = { x: cx + 92, y: cy + off }; else if (sd === 'e') S = { x: cx - 92, y: cy + off }; else if (sd === 'n') S = { x: cx + off, y: cy + 44 }; else S = { x: cx + off, y: cy - 44 };
        // Steckerfahne am Bauteil
        const col = WCOL[w.art] || '#fff';
        if (sd === 'w' || sd === 'e') { const tx = sd === 'w' ? S.x - 52 : S.x + 2; mk('rect', { x: tx, y: S.y - 7, width: 50, height: 14, rx: 3, fill: col, class: 'pl-tag' }, cg); mk('text', { x: tx + 25, y: S.y + 4, 'text-anchor': 'middle', class: 'pl-tagt' }, cg).textContent = w.kabel.replace(/ \(.*\)/, ''); }
        else { mk('rect', { x: S.x - 7, y: sd === 'n' ? S.y - 46 : S.y + 2, width: 14, height: 44, rx: 3, fill: col, class: 'pl-tag' }, cg); }
        if (!visible(w)) { k++; return; }
        const R = ringPt(80 + (k % 6) * 6), A = onRing(R, sd, S.x, S.y), Bp = onRing(R, p.e, p.lx, p.ly);
        const pts = [S, A, ...walk(R, A, Bp), Bp, { x: p.lx, y: p.ly }];
        if (p.inner) pts.push({ x: p.x, y: p.y }); else mk('path', { d: `M${p.x} ${p.y} L${p.sx} ${p.sy}`, class: 'pl-stub', stroke: col });
        const d = 'M' + pts.map(q => q.x.toFixed(1) + ' ' + q.y.toFixed(1)).join(' L');
        const fresh = actIds.has(w.padId) && cur !== last;
        mk('path', { d, class: 'pl-wo' + (fresh ? ' on' : '') });
        const path = mk('path', { d, class: 'pl-w' + (fresh ? ' on' : ''), stroke: col });
        if (fresh && !RM) { const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; requestAnimationFrame(() => { path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.3,.7,.2,1)'; path.style.strokeDashoffset = 0; }); }
        k++;
      });
    });
  }
  { const ap = [...actIds].map(id => pos[id]).find(q => q && !q.ghost); if (ap && cur !== last) iron(mk, ap.x, ap.y); }
  state.solderSeen = true;
  // Am Handy die Platine größer zeigen, damit die Pad-Namen lesbar sind (Anfänger-Test 28.10.)
  if (zoomOn()) { const m = 150; svg.setAttribute('viewBox', `${x0 - m} ${y0 - m} ${BS + 2 * m} ${BH + 2 * m}`); }
}
/* Bauteile als eigene Zeichnungen, Stil wie in Anschlussplänen */
function compArt(mk, g, t, cx, cy, sd) {
  const box = (w, hh, cls, rx = 8) => mk('rect', { x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, rx, class: cls }, g);
  const label = (txt, dy) => { let t2 = String(txt || '').replace(/ mit .*$| \(.*\)$/, ''); if (t2.length > 24) t2 = t2.slice(0, 23).trim() + '…'; mk('text', { x: cx, y: cy + dy, 'text-anchor': 'middle', class: 'pl-cname' }, g).textContent = t2; };
  const nm = (k) => { const p = P(B[k]); return p ? nameOf(p) : ''; };
  if (t === 'Empfänger') { box(150, 74, 'pl-pcb2'); box(34, 34, 'pl-chip', 3); mk('path', { d: `M${cx - 75} ${cy - 20} h-30`, class: 'pl-antw' }, g); mk('rect', { x: cx - 112, y: cy - 26, width: 12, height: 12, class: 'pl-gold' }, g); label(nm('rx'), -48); }
  else if (t === 'GPS') { box(110, 110, 'pl-gpsb', 10); box(70, 70, 'pl-gold', 6); label(nm('gps') || 'GPS', -66); }
  else if (t === 'Kamera') { box(64, 64, 'pl-cam', 8); mk('circle', { cx: cx, cy: cy, r: 22, class: 'pl-lens' }, g); mk('circle', { cx: cx, cy: cy, r: 12, class: 'pl-glass' }, g); label('Kamera', -44); }
  else if (t === 'Videosender') { box(110, 70, 'pl-pcb2'); box(70, 40, 'pl-shield', 4); mk('path', { d: `M${cx} ${cy - 35} v-30`, class: 'pl-antw' }, g); mk('ellipse', { cx, cy: cy - 72, rx: 22, ry: 10, class: 'pl-lolli' }, g); label(nm('video'), 54); }
  else if (t === 'Videosystem') { box(150, 96, 'pl-au', 10); for (let i = 0; i < 7; i++) mk('rect', { x: cx - 64 + i * 19, y: cy - 40, width: 9, height: 80, rx: 3, class: 'pl-fin' }, g); label(nm('video'), sd === 's' ? 66 : -60); }
  else if (t === 'LED-Streifen') { box(56, 170, 'pl-pcb2', 6); for (let i = 0; i < 4; i++) mk('rect', { x: cx - 13, y: cy - 70 + i * 40, width: 26, height: 26, rx: 4, class: 'pl-led', style: `animation-delay:${i * .25}s` }, g); label('LED', -98); }
  else if (t === 'Buzzer') { mk('circle', { cx, cy, r: 38, class: 'pl-bz' }, g); mk('circle', { cx, cy, r: 6, class: 'pl-hole' }, g); label('Buzzer', -50); }
  else { box(130, 70, 'pl-pcb2'); label(t, 5); }
}
/* Lötkolben fährt an das Pad, setzt den Punkt und fährt weg (nur Anschauen, keine Bedienung) */
function iron(mk, x, y) {
  if (RM) return;
  const w = mk('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, class: 'pl-ironw', 'aria-hidden': 'true' });
  mk('circle', { r: 4, class: 'pl-spark' }, w);
  const g = mk('g', { class: 'pl-iron' }, w);
  mk('path', { d: 'M2 -2 L44 -44', class: 'pl-iron-tip' }, g);
  mk('path', { d: 'M44 -44 L64 -64', class: 'pl-iron-col' }, g);
  mk('path', { d: 'M64 -64 L150 -150', class: 'pl-iron-grip' }, g);
}
function vlabel(txt, layer) {
  if (!ui.vlabel) return;
  ui.vlabel.innerHTML = `<span class="bk-stk ${layer}" aria-hidden="true"><i></i><i></i></span><span>Du siehst: <b>${esc(txt)}</b></span><small>Nur zum Anschauen · Schritte ${innerWidth > 1100 ? 'rechts' : 'darunter'}</small>`;
}
let solderSvg = null;
function drawSolder() {
  const svg = ui.solder; const b = P(B.board);
  svg.innerHTML = ''; svg.setAttribute('viewBox', '0 0 1000 1000');
  if (ui.zoom) { ui.zoom.textContent = zoomOn() ? 'Ganzer Plan' : 'Lötstellen groß'; ui.zoom.setAttribute('aria-pressed', zoomOn()); }
  const mk = (t, a, p) => { const n = D.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); (p || svg).appendChild(n); return n; };
  if (!b) { vlabel('noch keinen Flugcontroller', ''); mk('text', { x: 500, y: 500, 'text-anchor': 'middle', class: 'sv-t big' }).textContent = 'Wähl zuerst einen Flugcontroller'; return; }
  const plan = wiring(), steps = solderSteps(plan), act = steps[state.solderStep] || {};
  const actPads = new Set((act.pads || []).map(String));
  if ((act.pads || []).some(x => /^(BAT|M\d|ESC)/.test(x))) { drawEsc(mk, b, act); return; }
  if (plan.layout) { drawPlan(svg, mk, b, plan, steps, act); return; }
  // Platine
  vlabel('den Flugcontroller (allgemeines Schema)', 'top');
  const S = 420, x0 = 500 - S / 2, y0 = 470 - S / 2;
  mk('rect', { x: x0, y: y0, width: S, height: S, rx: 26, class: 'sv-pcb' });
  for (let i = 0; i < 14; i++) mk('path', { d: `M${x0 + 70} ${y0 + 70 + i * 21}h${120 + (i % 4) * 30}l18 14h${80}`, class: 'sv-trace' });
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) mk('circle', { cx: 500 + dx * (S / 2 - 34), cy: 470 + dy * (S / 2 - 34), r: 16, class: 'sv-hole' });
  mk('rect', { x: 470, y: 440, width: 60, height: 60, rx: 4, class: 'sv-mcu' });
  mk('text', { x: 500, y: 476, 'text-anchor': 'middle', class: 'sv-t sm' }).textContent = b.mcu || 'MCU';
  mk('text', { x: 500, y: y0 + S + 34, 'text-anchor': 'middle', class: 'sv-t sm dim' }).textContent = nameOf(b);
  // Pads
  const sides = padLayout(b), pos = {};
  const place = (arr, side) => {
    const n = arr.length; if (!n) return;
    arr.forEach((p, i) => {
      const t = (i + 1) / (n + 1);
      let x, y, w = 34, h = 22;
      if (side === 'n') { x = x0 + t * S; y = y0 + 22; } else if (side === 's') { x = x0 + t * S; y = y0 + S - 22; } else if (side === 'w') { x = x0 + 22; y = y0 + t * S; [w, h] = [22, 30]; } else { x = x0 + S - 22; y = y0 + t * S; [w, h] = [22, 30]; }
      const on = actPads.has(p.name);
      mk('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 4, class: 'sv-pad' + (on ? ' on' : '') });
      const lx = side === 'w' ? x + 18 : side === 'o' ? x - 18 : x, ly = side === 'n' ? y + 30 : side === 's' ? y - 22 : y + 5;
      mk('text', { x: lx, y: ly, 'text-anchor': side === 'w' ? 'start' : side === 'o' ? 'end' : 'middle', class: 'sv-t pad' + (on ? ' on' : '') }).textContent = p.name;
      pos[p.name] = { x, y, side };
    });
  };
  for (const k of ['n', 'o', 's', 'w']) place(sides[k], k);
  if (plan.wires.some(w => w.pad === 'DJI-Stecker')) { const on = act.teil === 'Videosystem'; mk('rect', { x: x0 + 40, y: y0 + 60, width: 74, height: 30, rx: 4, class: 'sv-conn' + (on ? ' on' : '') }); mk('text', { x: x0 + 77, y: y0 + 112, 'text-anchor': 'middle', class: 'sv-t pad' + (on ? ' on' : '') }).textContent = 'DJI'; pos['DJI-Stecker'] = { x: x0 + 77, y: y0 + 75, side: 'n' }; }
  const missingPads = [];
  // Bauteile außen und Leitungen
  const grp = {}; plan.wires.forEach(w => { (grp[w.teil] = grp[w.teil] || []).push(w); });
  const teile = Object.keys(grp);
  const slots = [[150, 120], [850, 120], [900, 470], [850, 830], [150, 830], [100, 470], [500, 60], [500, 930]];
  teile.forEach((t, i) => {
    const [cx, cy] = slots[i % slots.length];
    const isAct = act.teil === t;
    const g = mk('g', { class: 'sv-part' + (isAct ? ' on' : '') });
    mk('rect', { x: cx - 92, y: cy - 34, width: 184, height: 68, rx: 12, class: 'sv-box' }, g);
    mk('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', class: 'sv-t' }, g).textContent = t;
    mk('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', class: 'sv-t sm dim' }, g).textContent = grp[t].length + (grp[t].length === 1 ? ' Leitung' : ' Leitungen');
    grp[t].forEach((w, j) => {
      let p = pos[w.pad];
      if (!p && w.art === 'plug') { p = { x: x0 + S * .72, y: y0 + 6 }; mk('rect', { x: p.x - 34, y: p.y - 12, width: 68, height: 24, rx: 4, class: 'sv-plug' + (isAct ? ' on' : '') }); mk('text', { x: p.x, y: p.y + 40, 'text-anchor': 'middle', class: 'sv-t pad' + (isAct ? ' on' : '') }).textContent = 'Stecker'; pos[w.pad] = p; }
      if (!p) { if (!missingPads.includes(w.pad)) missingPads.push(w.pad); return; }
      const sx = cx + (j - (grp[t].length - 1) / 2) * 22, sy = cy + (cy < p.y ? 34 : -34);
      const mx = (sx + p.x) / 2;
      const d = `M${sx} ${sy} C ${sx} ${(sy + p.y) / 2}, ${p.x} ${(sy + p.y) / 2}, ${p.x} ${p.y}`;
      const path = mk('path', { d, class: `sv-w w-${w.art}` + (isAct ? ' on' : '') });
      if (isAct && !RM) { const L = path.getTotalLength ? path.getTotalLength() : 600; path.style.strokeDasharray = L; path.style.strokeDashoffset = L; requestAnimationFrame(() => { path.style.transition = 'stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)'; path.style.strokeDashoffset = 0; }); }
      if (isAct) mk('circle', { cx: p.x, cy: p.y, r: 9, class: 'sv-dot' });
    });
  });
  if (missingPads.length) mk('text', { x: 500, y: 990, 'text-anchor': 'middle', class: 'sv-t sm dim' }).textContent = 'Im Handbuch nachsehen: ' + missingPads.join(', ');
  state.solderSeen = true;
}

/* =====================================================================
   3D-Werkbank
   ===================================================================== */
const G3 = { ok: false };
function init3d(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, FINE ? 2 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .5, 900);
  // Umgebung für Spiegelungen
  const pm = new THREE.PMREMGenerator(renderer); const env = new THREE.Scene();
  const eg = new THREE.SphereGeometry(50, 32, 16); const col = []; const pos = eg.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50; const c = new THREE.Color().setHSL(.58, .55, clamp(.06 + y * .35, .02, .5)); col.push(c.r, c.g, c.b); }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); env.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  scene.environment = pm.fromScene(env, .04).texture; pm.dispose();
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a1426, .9));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(20, 34, 26); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3fe0ff, 2.4); rim.position.set(-30, 12, -24); scene.add(rim);
  const warm = new THREE.DirectionalLight(0xffb020, 1.0); warm.position.set(28, -6, -10); scene.add(warm);
  const root = new THREE.Group(); scene.add(root);
  // Schneidematte als Boden
  const matT = (() => { const c = D.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#07152a'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(63,224,255,.16)'; g.lineWidth = 1; for (let i = 0; i <= 512; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } g.strokeStyle = 'rgba(63,224,255,.32)'; g.lineWidth = 2; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mat = new THREE.Mesh(new THREE.CircleGeometry(70, 64), new THREE.MeshStandardMaterial({ map: matT, roughness: .9, metalness: 0, transparent: true, opacity: .95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.y = -.02; root.add(mat);
  const shT = (() => { const c = D.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shT, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; root.add(shadow);
  const drone = new THREE.Group(); root.add(drone);
  Object.assign(G3, { ok: true, renderer, scene, cam, root, drone, shadow, parts: {}, spin: [], leds: [], yaw: -.7, pitch: .42, dist: 60, vel: 0, explode: 0, exT: 0, fly: 0, flyT: 0, t: 0, dirty: true, size: 30 });
  return true;
}
/* Materialien und Formen */
const MAT = {};
function mats() {
  if (MAT.ok) return MAT;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const ct = (() => { const c = D.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#0c0e12'; g.fillRect(0, 0, 128, 128); const s = 16; for (let y = 0; y < 128; y += s) for (let x = 0; x < 128; x += s) { const odd = ((x + y) / s) % 2; const gr = odd ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s); gr.addColorStop(0, '#14171c'); gr.addColorStop(.5, '#2b3039'); gr.addColorStop(1, '#101216'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, s - 2, s - 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pcb = (accent) => { const c = D.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#0a1322'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(80,140,200,.35)'; g.lineWidth = 2; for (let i = 0; i < 18; i++) { g.beginPath(); const y = 20 + i * 12; g.moveTo(30, y); g.lineTo(110 + (i % 4) * 20, y); g.lineTo(130 + (i % 4) * 20, y + 14); g.lineTo(226, y + 14); g.stroke(); } g.fillStyle = '#d9b44a'; for (let i = 0; i < 8; i++) { g.fillRect(8, 24 + i * 28, 16, 14); g.fillRect(232, 24 + i * 28, 16, 14); g.fillRect(24 + i * 28, 8, 14, 16); g.fillRect(24 + i * 28, 232, 14, 16); } g.fillStyle = accent; g.fillRect(118, 118, 20, 6); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  Object.assign(MAT, {
    ok: true, std,
    carbon: std({ map: ct, roughness: .42, metalness: .35 }), carbonEdge: std({ color: 0x3a3f47, roughness: .8, metalness: .1 }),
    alu: std({ color: 0x2f6fd0, metalness: .85, roughness: .3 }),
    bell: std({ color: 0x8a95a5, metalness: .92, roughness: .26 }),
    dark: std({ color: 0x161c26, metalness: .7, roughness: .4 }),
    acc: std({ color: 0x3fe0ff, metalness: .6, roughness: .3, emissive: 0x0b4652, emissiveIntensity: .5 }),
    pcbA: std({ map: pcb('#ffb020'), roughness: .55, metalness: .2 }), pcbC: std({ map: pcb('#3fe0ff'), roughness: .55, metalness: .2 }), pcbG: std({ map: pcb('#3ee08a'), roughness: .55 }), pcbR: std({ map: pcb('#ff4b5c'), roughness: .55 }),
    red: std({ color: 0xd9343f, roughness: .6 }), yel: std({ color: 0xe8c21a, roughness: .6 }), copper: std({ color: 0xb8692e, metalness: .8, roughness: .35 }), blk: std({ color: 0x15181f, roughness: .6 }), xt: std({ color: 0xe8c21a, roughness: .45 }),
    tpu: std({ color: 0xff7a1a, roughness: .7 }), duct: std({ color: 0x1b2433, roughness: .55, metalness: .1, transparent: true, opacity: .92 }),
    silver: std({ color: 0xc8d2de, metalness: .9, roughness: .25 }), grey: std({ color: 0x2a313d, metalness: .5, roughness: .45 }),
    white: std({ color: 0xeaf4ff, roughness: .5 }), gold: std({ color: 0xd8b25a, metalness: .9, roughness: .3 })
  });
  return MAT;
}
/* Oberseite einer echten Platine als Textur: Pads, Löcher, Buchsen und Beschriftung an der Stelle aus dem Herstellerplan */
const texCache = {};
function boardTex(L) {
  if (texCache[L.board]) return texCache[L.board];
  const W = 1024, h = L.h || 1, H = Math.round(W * h), c = D.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.translate(W, H); g.rotate(Math.PI); // Front (Pfeil) liegt in der Szene vorne
  const X = (x) => x * W, Y = (y) => y * W;
  g.fillStyle = L.farbe || '#15171c';
  g.beginPath(); if (L.form === 'raute') { g.moveTo(W / 2, 0); g.lineTo(W, H / 2); g.lineTo(W / 2, H); g.lineTo(0, H / 2); } else g.roundRect(0, 0, W, H, 70); g.fill();
  g.save(); g.clip(); g.strokeStyle = 'rgba(120,150,190,.12)'; g.lineWidth = 6; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(W * .2, H * (.18 + i * .045)); g.lineTo(W * (.45 + (i % 3) * .08), H * (.18 + i * .045)); g.lineTo(W * (.52 + (i % 3) * .08), H * (.24 + i * .045)); g.lineTo(W * .78, H * (.24 + i * .045)); g.stroke(); } g.restore();
  g.fillStyle = '#090a0d'; g.fillRect(W * .41, H * .4, W * .17, W * .17); g.strokeStyle = '#2a2f38'; g.lineWidth = 4; g.strokeRect(W * .41, H * .4, W * .17, W * .17);
  (L.loecher || []).forEach(([x, y]) => { g.fillStyle = '#d9ad48'; g.beginPath(); g.arc(X(x), Y(y), 46, 0, 7); g.fill(); g.fillStyle = '#05060a'; g.beginPath(); g.arc(X(x), Y(y), 26, 0, 7); g.fill(); });
  (L.teile || []).forEach(t => { const x = X(t.x), y = Y(t.y);
    if (t.typ === 'usb') { g.fillStyle = '#c3cad4'; g.fillRect(x, y, t.w * W, t.h * W); g.fillStyle = '#3a414c'; g.fillRect(x + 18, y + t.h * W * .3, t.w * W - 36, t.h * W * .4); }
    else if (t.typ === 'buchse' && t.w) { g.fillStyle = '#f2f2f2'; g.fillRect(x, y, t.w * W, (t.h || .06) * W); g.fillStyle = '#c9a23f'; const n = (t.pins || []).length; for (let i = 0; i < n; i++) g.fillRect(x + 10 + i * (t.w * W - 20) / n, y + (t.h || .06) * W * .35, (t.w * W - 20) / n - 6, (t.h || .06) * W * .3); }
    else if (t.typ === 'pfeil') { g.fillStyle = '#f2f4f8'; g.beginPath(); g.moveTo(x, y - 70); g.lineTo(x + 52, y + 44); g.lineTo(x, y + 16); g.lineTo(x - 52, y + 44); g.closePath(); g.fill(); }
    else if (t.typ === 'knopf') { g.fillStyle = '#c3cad4'; g.fillRect(x - 22, y - 16, 44, 32); g.fillStyle = '#20242c'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  });
  const PS = 30; g.textBaseline = 'middle';
  L.pads.filter(p => !p.unten).forEach(p => { const x = X(p.x), y = Y(p.y);
    const gr = g.createLinearGradient(x - PS / 2, y - PS / 2, x + PS / 2, y + PS / 2); gr.addColorStop(0, '#fbe6a2'); gr.addColorStop(.5, '#d9ad48'); gr.addColorStop(1, '#9b7224');
    g.fillStyle = gr; g.fillRect(x - PS / 2, y - PS / 2, PS, PS);
    const e = edgeOf(p, h), lab = String(p.lab || p.n); g.fillStyle = 'rgba(240,244,250,.92)'; g.font = `700 ${lab.length > 5 ? 17 : 21}px "Chakra Petch",sans-serif`;
    const inner = Math.min(p.x, 1 - p.x, p.y, h - p.y) > .08;
    g.save(); g.translate(x, y);
    if (e === 'n' || e === 's') { g.rotate(-Math.PI / 2); g.textAlign = (e === 'n') === inner ? 'right' : 'left'; g.fillText(lab, (e === 'n') === inner ? -PS * .75 : PS * .75, 0); }
    else { g.textAlign = (e === 'w') === inner ? 'left' : 'right'; g.fillText(lab, (e === 'w') === inner ? PS * .75 : -PS * .75, 0); }
    g.restore();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (texCache[L.board] = t);
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 8, false), m);
const bladeGeo = {};
function blade(R, n) {
  const k = R.toFixed(2) + n; if (bladeGeo[k]) return bladeGeo[k];
  const s = R / 6.15, sh = new THREE.Shape();
  sh.moveTo(.5 * s, -.42 * s); sh.bezierCurveTo(2.2 * s, -1.02 * s, 4.8 * s, -.96 * s, 6.15 * s, -.3 * s); sh.quadraticCurveTo(6.45 * s, .05 * s, 6.05 * s, .32 * s); sh.bezierCurveTo(4.4 * s, .72 * s, 2.2 * s, .76 * s, .5 * s, .42 * s); sh.lineTo(.5 * s, -.42 * s);
  const g = new THREE.ExtrudeGeometry(sh, { depth: .07 * Math.max(.6, s), bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2); g.rotateX(.26);
  return (bladeGeo[k] = g);
}
/* Maße in cm. Ein Teil = Gruppe mit Zielposition und Explosions-Versatz. */
function dims() {
  const K = KL(B.klasse), f = P(B.rahmen), pr = P(B.prop), m = P(B.motor), b = P(B.board);
  const wb = num(f && f.radstand_mm) || K.wb;
  const arm = wb / 10 / 2 / Math.SQRT2;
  const propR = ((num(pr && pr.durchmesser_zoll) || (K.prop[0] + K.prop[1]) / 2) * 2.54) / 2;
  const st = (m && statorOf(m)) || { w: K.stator[1] - 1, h: B.klasse === 'whoop' ? 2 : 7 };
  const bellR = (st.w + 5) / 20, bellH = Math.max(.5, (st.h + 7) / 10);
  const bs = (boardSize(b) + (B.klasse === 'whoop' ? 4 : 6)) / 10;
  return { K, wb, arm, propR, bellR, bellH, bs, duct: B.klasse === 'whoop' || B.klasse === 'cine' };
}
function part(id, obj, ex, delay = 0) {
  const g = G3.parts[id]; if (g) { G3.drone.remove(g.obj); }
  obj.userData.ex = ex || new THREE.Vector3(); obj.userData.base = obj.position.clone();
  G3.parts[id] = { obj, born: G3.t + delay, id };
  G3.drone.add(obj); G3.dirty = true;
}
function drop(id) { const g = G3.parts[id]; if (g) { G3.drone.remove(g.obj); delete G3.parts[id]; G3.dirty = true; } }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let lastSig = {};
function build3d(force) {
  if (!G3.ok) return;
  const M = mats(), d = dims(), c = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  G3.bs = d.bs;
  const sig = (k, extra = '') => JSON.stringify([B[k], B.klasse, d.wb, d.propR, d.bellR, d.bs, extra]);
  const changed = (k, extra) => { const s = sig(k, extra); if (!force && lastSig[k] === s) return false; lastSig[k] = s; return true; };
  // Rahmen
  if (changed('rahmen')) {
    if (!B.rahmen && step < 1) drop('rahmen'); else {
      const fr = new THREE.Group();
      const armW = d.duct ? .5 : Math.max(1, d.wb / 160), t = d.duct ? .3 : Math.max(.3, d.wb / 520);
      c.forEach(([sx, sz]) => {
        const mx = d.arm * sx, mz = d.arm * sz, L = Math.hypot(mx, mz);
        // Arm als Carbon-Frästeil: verjüngt, runde Motorplatte, Erleichterungsloch
        const r = d.bellR + .35, w0 = armW * 1.15, w1 = armW * .8, sh = new THREE.Shape();
        sh.moveTo(0, -w0 / 2); sh.lineTo(L - r * .9, -w1 / 2); sh.absarc(L, 0, r, Math.PI + .55, Math.PI - .55 + Math.PI * 2, false); sh.lineTo(0, w0 / 2); sh.lineTo(0, -w0 / 2);
        if (!d.duct && L > 6) { const hole = new THREE.Path(); const hl = L * .32, hw = armW * .18; hole.moveTo(L * .3, -hw); hole.lineTo(L * .3 + hl, -hw * .8); hole.absarc(L * .3 + hl, 0, hw * .8, -Math.PI / 2, Math.PI / 2, false); hole.lineTo(L * .3, hw); hole.absarc(L * .3, 0, hw, Math.PI / 2, Math.PI * 1.5, false); sh.holes.push(hole); }
        for (let i = 0; i < 4; i++) { const sc = new THREE.Path(), a2 = i * Math.PI / 2 + Math.PI / 4, rr = Math.min(.95, d.bellR * .55); sc.absarc(L + Math.cos(a2) * rr, Math.sin(a2) * rr, .13, 0, Math.PI * 2, true); sh.holes.push(sc); }
        const ag = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 1, curveSegments: 18 });
        ag.rotateX(-Math.PI / 2); ag.translate(0, -t / 2, 0);
        const am = new THREE.Mesh(ag, [M.carbon, M.carbonEdge]); am.rotation.y = -Math.atan2(mz, mx); fr.add(am);
        if (d.duct) { const ring = new THREE.Mesh(new THREE.TorusGeometry(d.propR + .35, .18, 8, 40), M.duct); ring.rotation.x = Math.PI / 2; ring.position.set(mx, d.bellH * .9, mz); fr.add(ring); const wall = new THREE.Mesh(new THREE.CylinderGeometry(d.propR + .4, d.propR + .4, d.bellH * 1.4, 40, 1, true), M.duct); wall.position.set(mx, d.bellH * .6, mz); fr.add(wall); }
      });
      fr.add(box(d.bs * 1.35, t, d.bs * (d.duct ? 1.6 : 2.4), M.carbon));
      if (!d.duct) { const top = new THREE.Group(); top.add(at(box(d.bs * 1.1, t * .7, d.bs * 2.4, M.carbon), 0, d.bs * .9 + .6, 0)); for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) top.add(at(cyl(.22, .22, d.bs * .9 + .5, M.alu, 10), x * d.bs * .45, (d.bs * .9 + .6) / 2, z * d.bs * 1.05)); fr.add(top); fr.userData.top = top; }
      part('rahmen', fr, V(0, -3, 0));
    }
  }
  // Platine(n)
  if (changed('board', B.esc)) {
    if (!B.board) { drop('board'); drop('esc'); } else {
      const b = P(B.board), aio = isAio(b);
      const fc = new THREE.Group(); const s = d.bs * .92, LY = layoutFor(b), fy = aio ? .6 : 1.7;
      if (LY) {
        const hz = s * (LY.h || 1), raute = LY.form === 'raute';
        const core = at(box(raute ? s * .7 : s, .14, raute ? hz * .7 : hz, M.std({ color: new THREE.Color(LY.farbe || '#15171c'), roughness: .6, metalness: .15 })), 0, fy, 0); if (raute) core.rotation.y = Math.PI / 4; fc.add(core);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(s, hz), M.std({ map: boardTex(LY), roughness: .45, metalness: .25, transparent: true, alphaTest: .5 })); top.rotation.x = -Math.PI / 2; top.position.set(0, fy + .075, 0); fc.add(top);
        fc.add(at(box(s * .16, .1, s * .16, M.dark), 0, fy + .12, 0));
      } else {
        fc.add(at(box(s, .14, s, M.pcbA), 0, fy, 0));
        fc.add(at(box(s * .25, .14, s * .25, M.dark), 0, fy + .14, 0));
        fc.add(at(box(s * .2, .25, s * .15, M.silver), s * .42, fy + .15, 0));
      }
      const holes = LY && LY.loecher && LY.loecher.length ? LY.loecher.map(([x, y]) => [(.5 - x) * s, s * (LY.h || 1) / 2 - y * s]) : [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [x * s * .42, z * s * .42]);
      holes.forEach(([x, z]) => fc.add(at(cyl(.16, .16, .34, M.std({ color: 0x7a3cff, roughness: .7 }), 12), x, fy - .1, z)));
      part('board', fc, V(0, 5, 0), .05);
      if (!aio) {
        const e = new THREE.Group(), EL = LY && LY.esc && LY.esc.pads ? { ...LY.esc, board: LY.board + '_esc' } : null;
        if (EL) { const hz = s * (EL.h || 1); e.add(at(box(s, .16, hz, M.std({ color: new THREE.Color(EL.farbe || '#15171c'), roughness: .6 })), 0, .75, 0)); const tp = new THREE.Mesh(new THREE.PlaneGeometry(s, hz), M.std({ map: boardTex(EL), roughness: .45, metalness: .25, transparent: true, alphaTest: .5 })); tp.rotation.x = -Math.PI / 2; tp.position.set(0, .835, 0); e.add(tp); }
        else e.add(at(box(s, .16, s, M.pcbC), 0, .75, 0));
        if (!EL) for (let i = 0; i < 8; i++) e.add(at(box(s * .14, .18, s * .1, M.dark), -s * .33 + (i % 4) * s * .22, .9, i < 4 ? s * .35 : -s * .35));
        e.add(tube([[s * .12, .8, -s * .5], [s * .12, .8, -s * 1.2], [s * .1, 1.0, -s * 1.9]], .18, M.red));
        e.add(tube([[-s * .12, .8, -s * .5], [-s * .12, .8, -s * 1.2], [-s * .1, 1.0, -s * 1.9]], .18, M.blk));
        e.add(at(box(1.4, .75, 1.3, M.xt), 0, 1.05, -s * 2.15));
        part('esc', e, V(0, -3.5, 0), .1);
      } else drop('esc');
    }
  }
  // Motoren
  if (changed('motor')) {
    if (!B.motor) drop('motor'); else {
      const mg = new THREE.Group();
      c.forEach(([sx, sz]) => {
        const mo = new THREE.Group();
        mo.add(at(cyl(d.bellR * .9, d.bellR * .95, d.bellH * .3, M.dark, 24), 0, d.bellH * .15, 0));
        mo.add(at(cyl(d.bellR, d.bellR, d.bellH * .75, M.bell, 32), 0, d.bellH * .62, 0));
        mo.add(at(cyl(d.bellR * 1.01, d.bellR * 1.01, d.bellH * .1, M.acc, 32), 0, d.bellH * .98, 0));
        mo.add(at(cyl(.1 + d.bellR * .08, .1 + d.bellR * .08, d.bellH * .7, M.bell, 10), 0, d.bellH * 1.25, 0));
        // Glocke mit Speichen und sichtbaren Wicklungen darunter
        mo.add(at(cyl(d.bellR * .72, d.bellR * .72, d.bellH * .5, M.copper, 18), 0, d.bellH * .62, 0));
        for (let i = 0; i < 5; i++) { const sp = box(d.bellR * .9, d.bellH * .08, d.bellR * .22, M.bell); const a3 = i / 5 * Math.PI * 2; sp.position.set(Math.cos(a3) * d.bellR * .45, d.bellH * 1.03, Math.sin(a3) * d.bellR * .45); sp.rotation.y = -a3; mo.add(sp); }
        mo.add(at(cyl(d.bellR * .28, d.bellR * .28, d.bellH * .12, M.dark, 16), 0, d.bellH * 1.06, 0));
        const lead = [M.blk, M.red, M.yel]; const ang = Math.atan2(-sz, -sx);
        lead.forEach((lm, li) => { const off = (li - 1) * .14; const p1 = [Math.cos(ang) * d.bellR, .15, Math.sin(ang) * d.bellR], p2 = [Math.cos(ang) * (d.arm * .55) - Math.sin(ang) * off, .3, Math.sin(ang) * (d.arm * .55) + Math.cos(ang) * off]; mo.add(tube([[p1[0] - Math.sin(ang) * off, p1[1], p1[2] + Math.cos(ang) * off], [(p1[0] + p2[0]) / 2, .35, (p1[2] + p2[2]) / 2], p2], .06, lm)); });
        mo.position.set(d.arm * sx, .2, d.arm * sz); mg.add(mo);
      });
      part('motor', mg, V(0, 3, 0), .05);
    }
  }
  // Propeller
  if (changed('prop', B.motor)) {
    G3.spin = [];
    if (!B.prop) drop('prop'); else {
      const p = P(B.prop), n = num(p.blaetter) || 3, front = M.std({ color: 0xffb020, roughness: .32, transparent: true, opacity: .9, side: THREE.DoubleSide }), back = M.std({ color: 0x3fe0ff, roughness: .32, transparent: true, opacity: .9, side: THREE.DoubleSide });
      const pg = new THREE.Group();
      c.forEach(([sx, sz]) => {
        const sp = new THREE.Group(); const pm = sz > 0 ? front : back;
        sp.add(at(cyl(.3 + d.propR * .05, .35 + d.propR * .05, .4, pm, 16), 0, 0, 0));
        for (let i = 0; i < n; i++) { const bl = new THREE.Mesh(blade(d.propR, n), pm); bl.rotation.y = i * Math.PI * 2 / n; sp.add(bl); }
        const dir = sx * sz > 0 ? 1 : -1; if (dir < 0) sp.scale.z = -1;
        sp.position.set(d.arm * sx, .2 + d.bellH * 1.35, d.arm * sz); pg.add(sp); G3.spin.push({ sp, dir });
      });
      part('prop', pg, V(0, 8, 0), .05);
    }
  }
  // Akku
  if (changed('akku')) {
    if (!B.akku) drop('akku'); else {
      const a = P(B.akku), g = num(a.gewicht_g) || 200, vol = g / 2.1; const len = Math.cbrt(vol * 3.2), wid = len / 2.1, hei = len / 2.6;
      const ak = new THREE.Group(); const side = M.std({ color: 0x18202d, roughness: .5 });
      ak.add(box(wid, hei, len, [side, side, M.grey, M.grey, M.dark, M.dark]));
      ak.add(at(box(wid * 1.01, hei * .12, len * 1.01, M.std({ color: 0xffb020, roughness: .5 })), 0, -hei * .3, 0));
      ak.add(tube([[wid * .15, -hei * .3, -len / 2], [wid * .15, -hei * .6, -len / 2 - 1.2], [0, -hei * .9, -len / 2 - 2]], Math.max(.08, wid * .05), M.red));
      ak.add(tube([[-wid * .15, -hei * .3, -len / 2], [-wid * .15, -hei * .6, -len / 2 - 1.2], [0, -hei * .9, -len / 2 - 2]], Math.max(.08, wid * .05), M.blk));
      const top = d.duct ? d.bs * .4 + hei / 2 + 1.4 : d.bs * .9 + .6 + hei / 2 + .3;
      ak.position.set(0, top, 0); part('akku', ak, V(0, 10, 0), .05);
    }
  }
  // Video
  if (changed('video', B.kamera)) {
    if (!B.video) drop('video'); else {
      const v = P(B.video), vg = new THREE.Group(), y = d.duct ? 1.6 : d.bs * .5 + .8, fz = (d.duct ? d.bs * .8 : d.bs * 1.2);
      const camS = d.duct ? .9 : 1.4;
      const camG = new THREE.Group(); camG.position.set(0, y, fz);
      if (!d.duct) for (const sx of [-1, 1]) camG.add(at(box(.18, camS * 1.4, camS * 1.3, M.tpu), sx * camS * .6, 0, 0));
      const tilt = new THREE.Group(); tilt.rotation.x = -.4; camG.add(tilt);
      tilt.add(box(camS, camS, camS * .85, M.grey));
      const bar = cyl(camS * .38, camS * .42, camS * .5, M.dark, 20); bar.rotation.x = Math.PI / 2; bar.position.z = camS * .6; tilt.add(bar);
      vg.add(camG);
      if (v.typ === 'digital') {
        const isDJI = /dji|o3|o4/i.test(v.name), au = new THREE.Group();
        const w = isDJI ? 3 : 2.2, h = isDJI ? 1.1 : .8;
        au.add(box(w, h, w, M.grey)); if (isDJI) for (let i = 0; i < 7; i++) au.add(at(box(w * .9, h * .5, .08, M.silver), 0, h * .55, -w * .4 + i * w * .13));
        au.position.set(0, d.duct ? 1.8 : d.bs * .9 + .1, -(d.duct ? d.bs * .3 : d.bs * .8)); vg.add(au);
        const ant = tube([[0, au.position.y, au.position.z - w / 2], [0, au.position.y + 1.2, au.position.z - w / 2 - 1.2], [0, au.position.y + 2.4, au.position.z - w / 2 - 2]], .1, M.dark); vg.add(ant);
        const tip = cyl(.25, .25, .9, M.white, 10); tip.position.set(0, au.position.y + 2.6, au.position.z - w / 2 - 2.2); tip.rotation.x = -.6; vg.add(tip);
      } else {
        const vt = new THREE.Group(); vt.add(box(2, .16, 2, M.pcbR)); vt.add(at(box(1.5, .35, 1.3, M.silver), 0, .25, 0));
        vt.position.set(0, d.duct ? 1.5 : d.bs * .55, -(d.duct ? d.bs * .3 : d.bs * .9)); vg.add(vt);
        const l = new THREE.Mesh(new THREE.SphereGeometry(.8, 20, 12), M.std({ color: 0x3fe0ff, roughness: .35, transparent: true, opacity: .9 })); l.scale.set(1, .45, 1); l.position.set(0, vt.position.y + 3, vt.position.z - 2); vg.add(l);
        vg.add(tube([[0, vt.position.y, vt.position.z - 1], [0, vt.position.y + 1.5, vt.position.z - 1.6], [0, vt.position.y + 2.8, vt.position.z - 2]], .1, M.dark));
      }
      part('video', vg, V(0, 6, 4), .05);
    }
  }
  // Empfänger
  if (changed('rx')) {
    if (!B.rx || B.rx === '__builtin') drop('rx'); else {
      const r = P(B.rx), rg = new THREE.Group(); rg.add(box(1, .14, 1.3, M.pcbG));
      rg.add(at(box(.22, .1, .22, M.std({ color: 0x3ee08a, emissive: 0x3ee08a, emissiveIntensity: 1.2 })), .2, .1, .3));
      const is900 = /900|crossfire|tracer|915|868/i.test((r.frequenz || '') + r.name) && !/tracer/i.test(r.name);
      const L = is900 ? 4.2 : 2.4;
      rg.add(tube([[0, 0, -.6], [.5, -.2, -1.6], [1.6, -.5, -2.6]], .06, M.dark));
      const ta = cyl(.06, .06, L, M.dark, 8); ta.rotation.z = Math.PI / 2; ta.position.set(1.6, -.5, -2.6); ta.rotation.y = Math.PI / 4; rg.add(ta);
      rg.position.set(d.bs * .55, d.duct ? 1 : d.bs * .4, -d.bs * .6); part('rx', rg, V(4, 2, -3), .05);
    }
  }
  // Extras
  if (changed('gps')) { if (!B.gps) drop('gps'); else { const g = new THREE.Group(); g.add(box(1.8, .5, 1.8, M.std({ color: 0x15181f, roughness: .5 }))); g.add(at(box(1.4, .08, 1.4, M.std({ color: 0xc8a14a, metalness: .6, roughness: .4 })), 0, .3, 0)); g.add(at(cyl(.12, .12, 2.5, M.carbon, 8), 0, -1.4, 0)); g.position.set(0, (d.duct ? 3 : d.bs * .9 + 3.5), -d.bs * 1.4); g.rotation.x = .25; part('gps', g, V(0, 6, -4)); } }
  if (changed('buzzer')) { if (!B.buzzer) drop('buzzer'); else { const g = cyl(.55, .55, .5, M.dark, 18); g.rotation.x = Math.PI / 2; g.position.set(-d.bs * .45, d.duct ? .9 : .9, -d.bs * 1.1); part('buzzer', g, V(-3, 1, -3)); } }
  if (changed('kondensator')) { if (!B.kondensator) drop('kondensator'); else { const g = cyl(.45, .45, 1.6, M.std({ color: 0x1b1f29, metalness: .5, roughness: .35 }), 18); g.rotation.z = Math.PI / 2; g.position.set(0, 1.1, -d.bs * 1.75); part('kondensator', g, V(0, -1, -3)); } }
  if (changed('led')) {
    G3.leds = [];
    if (!B.led) drop('led'); else {
      const lg = new THREE.Group();
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { for (let i = 1; i <= 5; i++) { const t = .25 + i * .11; const m = new THREE.MeshBasicMaterial({ color: 0x3fe0ff }); const l = box(.35, .12, .35, m); l.position.set(d.arm * sx * t, -.25, d.arm * sz * t); lg.add(l); G3.leds.push({ m, k: i + (sx + 1) * 3 + (sz + 1) * 7 }); } });
      part('led', lg, V(0, -2, 0));
    }
  }
  // Kamera und Bühne an die Größe anpassen
  const sz = Math.max(d.arm * 2 + d.propR * 2, 10);
  G3.size = sz; G3.shadow.scale.set(sz * 1.3, sz * 1.3, 1);
  G3.dirty = true;
}
function layout3d() {
  if (!G3.ok) return;
  const c = G3.renderer.domElement, w = c.clientWidth || 1, h = c.clientHeight || 1;
  G3.renderer.setSize(w, h, false); G3.cam.aspect = w / h; G3.cam.updateProjectionMatrix(); G3.dirty = true;
}
function frame3d(dt) {
  if (!G3.ok) return;
  G3.t += dt;
  const tgt = view === 'explode' ? 1 : 0; G3.exT += (tgt - G3.exT) * clamp(dt * 4);
  if (!G3.drag) { if (Math.abs(G3.vel) > .0005) { G3.yaw += G3.vel; G3.vel *= .94; } else if (!G3.touched && !RM) G3.yaw += dt * .18; }
  // Teile einfliegen lassen und zerlegen
  for (const k in G3.parts) {
    const p = G3.parts[k], o = p.obj, age = (G3.t - p.born) / .7, e = RM ? 1 : ease(age);
    const fromY = (1 - e) * 14;
    o.position.copy(o.userData.base).addScaledVector(o.userData.ex, G3.exT);
    o.position.y += fromY;
    o.scale.setScalar(lerp(.6, 1, e));
  }
  // Abheben
  const flyT = G3.fly ? 1 : 0; G3.flyK = (G3.flyK || 0) + (flyT - (G3.flyK || 0)) * clamp(dt * 1.6);
  const spinSpeed = (G3.fly ? 70 : 0) * (RM ? .2 : 1);
  G3.spin.forEach(s => { s.sp.rotation.y += s.dir * spinSpeed * dt; });
  const lift = G3.flyK * (G3.size * .35 + 4), wob = G3.fly && !RM ? Math.sin(G3.t * 2.1) * .5 : 0;
  G3.drone.position.y = lift + wob; G3.drone.rotation.z = G3.fly && !RM ? Math.sin(G3.t * 1.3) * .05 : 0; G3.drone.rotation.x = G3.fly && !RM ? Math.sin(G3.t * 1.7) * .04 : 0;
  G3.shadow.material.opacity = 1 - G3.flyK * .6; const ss = G3.size * 1.3 * (1 + G3.flyK * .4); G3.shadow.scale.set(ss, ss, 1);
  // LEDs
  if (G3.leds.length) G3.leds.forEach(l => l.m.color.setHSL(((G3.t * .25 + l.k * .05) % 1), .9, .55));
  // Nahaufnahme der Platine beim Schritt Flugcontroller: obere Teile ausblenden, Kamera fährt von oben heran
  const fT = view === '3d' && !G3.fly && STEPS[step].id === 'board' && B.board ? 1 : 0; G3.fk = (G3.fk || 0) + (fT - (G3.fk || 0)) * clamp(dt * (RM ? 20 : 2.4));
  const hideTop = G3.fk > .25; ['akku', 'video', 'prop', 'gps', 'rx', 'buzzer', 'kondensator'].forEach(k => { if (G3.parts[k]) G3.parts[k].obj.visible = !hideTop; });
  if (G3.parts.rahmen && G3.parts.rahmen.obj.userData.top) G3.parts.rahmen.obj.userData.top.visible = !hideTop;
  // Kamera
  const fk = ease(G3.fk), r = lerp(G3.size * 1.55 + 7 + G3.exT * 10, (G3.bs || 3.6) * 2.5 + 2, fk), el = lerp(G3.pitch, 1.2, fk);
  G3.cam.position.set(Math.sin(G3.yaw) * Math.cos(el) * r, Math.sin(el) * r + G3.flyK * 6, Math.cos(G3.yaw) * Math.cos(el) * r);
  G3.cam.lookAt(0, lerp(2, 1.7, fk) + G3.flyK * (G3.size * .3), 0);
  G3.renderer.render(G3.scene, G3.cam);
}

/* =====================================================================
   Speichern, Teilen, Beispiele
   ===================================================================== */
const KEYS = ['klasse', 'rahmen', 'board', 'esc', 'motor', 'kv', 'prop', 'akku', 'video', 'rx', 'gps', 'led', 'buzzer', 'kondensator', 'kamera'];
function save() { store.set('fcs-bau2', KEYS.reduce((o, k) => (o[k] = B[k], o), {})); store.set('fcs-bau2-w', { kl: !!state.klOk, ex: !!state.exOk }); }
function load(obj) { if (!obj) return; KEYS.forEach(k => { if (k in obj) B[k] = (k === 'klasse' || k === 'kv' || obj[k] === '__builtin' || P(obj[k])) ? obj[k] : null; }); if (!KLASSEN.some(k => k.id === B.klasse)) B.klasse = 'five'; }
function loadW() { const o = store.get('fcs-bau2-w', null); state.klOk = !!(o && o.kl) || !!B.akku || !!B.rahmen; state.exOk = !!(o && o.ex); }
function shareLink() { const o = KEYS.reduce((a, k) => (B[k] && (a[k] = B[k]), a), {}); return location.href.split('#')[0] + '#bau=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o))))); }
function fromHash() { const m = location.hash.match(/bau=([^&]+)/); if (!m) return null; try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); } catch (e) { return null; } }
function findBy(kat, re, pref) { const L = (kat === 'board' ? boards() : arr(kat)).filter(p => re.test(p.name || '')); if (!L.length) return null; if (pref) { const x = L.find(pref); if (x) return x.id; } return L[0].id; }
function preset(name) {
  if (name === 'mamba-o4-crsf') {
    Object.keys(B).forEach(k => B[k] = null); B.klasse = 'five';
    B.board = findBy('board', /mamba.*f722(?!.*mini)/i) || findBy('board', /mamba/i);
    B.rahmen = findBy('rahmen', /.*/, f => klasseOfFrame(f) === 'five');
    B.motor = findBy('motor', /2207|2306/, m => range(m.empfohlen_s)[1] >= 6);
    if (B.motor) { const ks = kvList(P(B.motor)); B.kv = ks.find(k => k >= 1700 && k <= 2000) || ks[0] || null; }
    B.prop = findBy('prop', /.*/, p => { const d = num(p.durchmesser_zoll); return d && d >= 4.8 && d <= 5.3; });
    B.akku = findBy('akku', /.*/, a => num(a.zellen) === 6 && num(a.mah) >= 1000 && num(a.mah) <= 1400);
    B.video = findBy('video', /o4 air unit(?!.*pro)/i) || findBy('video', /o4/i);
    B.rx = findBy('empfaenger', /crossfire nano/i) || findBy('empfaenger', /crossfire/i);
    B.kondensator = findBy('extra', /.*/, x => x.typ === 'kondensator' && /50/.test(x.name)) || findBy('extra', /kondens|capacitor|µF/i); B.buzzer = findBy('extra', /.*/, x => x.typ === 'buzzer') || findBy('extra', /buzzer/i);
    state.klOk = true; state.exOk = true; state.notes = []; state.edit = null;
  }
}

/* =====================================================================
   Simulator-Übergabe
   ===================================================================== */
function toSim() {
  const m = metrics(), K = KL(B.klasse), mo = P(B.motor);
  const o = { name: (nameOf(P(B.board)) || 'Eigenbau').slice(0, 40), klasse: K.id, tw: m.twr ? +m.twr.toFixed(2) : null, gewicht: m.gewicht ? Math.round(m.gewicht) : null, zellen: cells(), kv: B.kv || (mo && kvList(mo)[0]) || null, prop: P(B.prop) ? num(P(B.prop).durchmesser_zoll) : null, t: Date.now() };
  store.set('fcs-bau-sim', o);
}

/* =====================================================================
   Start
   ===================================================================== */
function bindUI(app) {
  ui = { app, steps: $('[data-bk-steps]', app), body: $('[data-bk-body]', app), prev: $('[data-bk-prev]', app), next: $('[data-bk-next]', app), go: $('[data-bk-go]', app), checkB: $('[data-bk-check]', app), checks: $('[data-bk-checks]', app), ampel: $('[data-bk-ampel]', app), checkT: $('[data-bk-check-t]', app), solder: $('[data-bk-solder]', app), stage: $('[data-bk-stage]', app), osdW: $('[data-bk-osd-w]', app), osdName: $('[data-bk-osd-name]', app), hint: $('[data-bk-hint-t]', app), hintBox: $('[data-bk-hint]', app), zoom: $('[data-bk-zoom]', app), flyhud: $('[data-bk-flyhud]', app), flyT: $('[data-bk-fly-t]', app), vlabel: $('[data-bk-vlabel]', app), m: {} };
  $$('[data-bk-m]', app).forEach(n => { ui.m[n.dataset.bkM] = n; });
  ui.steps.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b && !b.disabled) go(+b.dataset.i); });
  ui.prev.addEventListener('click', () => go(step - 1));
  ui.next.addEventListener('click', () => { if (ui.next.disabled) return; if (STEPS[step].id === 'extras') state.exOk = true; go(step + 1); });
  ui.checkB.addEventListener('click', () => { const open = ui.checks.hidden; ui.checks.hidden = !open; ui.checkB.setAttribute('aria-expanded', open); if (open) requestAnimationFrame(() => { const r = ui.checks.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) ui.checks.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); }); });
  ui.go.addEventListener('click', liftoff);
  $('[data-bk-land]', app).addEventListener('click', land);
  $('[data-bk-sim]', app).addEventListener('click', toSim);
  $$('[data-bk-view]', app).forEach(b => b.addEventListener('click', () => setView(b.dataset.bkView)));
  if (ui.zoom) ui.zoom.addEventListener('click', () => { state.zoom = !zoomOn(); drawSolder(); });
  const onAct = e => {
    const t = e.target;
    const kl = t.closest('[data-klasse]'); if (kl) { setKlasse(kl.dataset.klasse); return; }
    const au = t.closest('[data-bk-auto]'); if (au) { autoPick(au.dataset.bkAuto); return; }
    const pkv = t.closest('[data-pick-kv]'); if (pkv) { const [id, kv] = pkv.dataset.pickKv.split('|'); B.kv = +kv; state.flown = false; build3d(); renderKeep(); return; }
    const pk = t.closest('[data-pick]'); if (pk) { pickPart(pk.dataset.slot, pk.dataset.pick); return; }
    const fl = t.closest('[data-f]'); if (fl) { state.f[fl.dataset.f] = fl.dataset.v; renderKeep(); return; }
    if (t.closest('[data-builtin]')) { B.rx = '__builtin'; state.flash = ''; build3d(); renderKeep(); return; }
    const ex = t.closest('[data-extra]'); if (ex) { const k = ex.dataset.extra; B[k] = B[k] === ex.dataset.id ? null : ex.dataset.id; state.solderSeen = false; build3d(); renderKeep(); return; }
    const sg = t.closest('[data-sol-go]'); if (sg) { solderTo(state.solderStep + +sg.dataset.solGo); return; }
    const so = t.closest('[data-sol]'); if (so) { solderTo(+so.dataset.sol); return; }
    const ed = t.closest('[data-edit]'); if (ed) { const i = SI(ed.dataset.edit); if (i >= 0) go(i, true); return; }
    if (t.closest('[data-bk-go2]')) { liftoff(); return; }
    if (t.closest('[data-bk-sim2]')) { toSim(); return; }
    if (t.closest('[data-bk-share]')) { const l = shareLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => { t.textContent = 'Link kopiert'; }).catch(() => { prompt('Link zu deinem Bau:', l); }); return; }
    if (t.closest('[data-bk-restart]')) { resetAll(); go(0); return; }
  };
  ui.body.addEventListener('click', onAct);
  ui.checks.addEventListener('click', onAct);
  ui.body.addEventListener('input', e => { const s = e.target.closest('[data-bk-search]'); if (s) { (state.q = state.q || {})[s.dataset.bkSearch] = s.value; applyFind(s.dataset.bkSearch); } });
  ui.body.addEventListener('change', e => { const s = e.target.closest('[data-bk-her]'); if (s) { (state.her = state.her || {})[s.dataset.bkHer] = s.value; applyFind(s.dataset.bkHer); } });
  $$('[data-bk-preset]').forEach(b => b.addEventListener('click', () => { preset(b.dataset.bkPreset); state.flown = false; build3d(true); state.flash = 'Beispiel geladen: Mamba-Stack, DJI O4 und Crossfire. Über die Schritte oben kannst du jedes Teil tauschen.'; go(SI('loeten'), true); const w = $('#werkbank'); if (w && W.FCS && FCS.scrollTo) FCS.scrollTo(w, -70); else if (w) w.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); }));
  const src = $('[data-bk-sources]'); if (src) src.addEventListener('click', (e) => { e.preventDefault(); const l = $('[data-bk-srclist]'); l.hidden = !l.hidden; if (!l.innerHTML) l.innerHTML = '<ul>' + Object.values(byId).filter(p => p.quelle).map(p => `<li>${esc(nameOf(p))}: <a href="${esc(p.quelle)}" target="_blank" rel="noopener">${esc(String(p.quelle).replace(/^https?:\/\//, '').slice(0, 60))}</a></li>`).join('') + '</ul>'; });
}
function resetAll() { KEYS.forEach(k => { if (k !== 'klasse') B[k] = null; }); state.klOk = false; state.exOk = false; state.flown = false; state.solderSeen = false; state.solderStep = 0; state.f = {}; state.q = {}; state.her = {}; state.flash = ''; land(); build3d(true); }
function setKlasse(k) {
  if (state.klOk && k !== B.klasse && anyChosen()) { KEYS.forEach(x => { if (x !== 'klasse') B[x] = null; }); state.exOk = false; state.flash = `Neue Klasse ${KL(k).name}: die bisherigen Teile passen nicht mehr und sind entfernt.`; }
  else state.flash = '';
  B.klasse = k; state.klOk = true; state.f = {}; state.flown = false; state.solderSeen = false;
  build3d(true); renderKeep();
}
function autoPick(slot) { const { rec } = ranked(slot); if (!rec) return; pickPart(slot, rec.p.id, null, `Ausgesucht: ${cleanName(rec.p)}. Passt zu deinem Bau. Du kannst es jederzeit ändern.`); }
function pickPart(slot, id, kv, msg) {
  const p = P(id); if (!p) return;
  B[slot] = id;
  if (slot === 'motor') B.kv = kv || bestKv(p, wantCells());
  if (slot === 'board') { if (isAio(p)) B.esc = null; if (B.rx === '__builtin' && !p.eingebauter_empfaenger) B.rx = null; }
  if (slot === 'video' && p.typ === 'digital') B.kamera = null;
  state.flown = false; state.solderStep = 0; state.solderSeen = false;
  const notes = invalidate(slot);
  state.flash = [msg, ...notes].filter(Boolean).join(' ');
  build3d(); renderKeep();
}
/* Spätere Teile prüfen, wenn sich vorne etwas ändert: nur entfernen, was nicht mehr passt, und sagen warum */
function invalidate(from) {
  const out = [], c = cells(), f = P(B.rahmen), b = P(B.board);
  if (from === 'akku' && P(B.motor)) { const old = B.kv; B.kv = bestKv(P(B.motor), c); if (old && old !== B.kv) out.push(`Motor-KV an deinen ${c}S-Akku angepasst: ${de(B.kv)} KV.`); }
  if (b && (!fitsFrame(b) || !fitsCells(b))) { out.push(`Flugcontroller entfernt: ${!fitsFrame(b) ? `${de(boardSize(b), 1)} mm passen nicht in den Rahmen` : `verträgt keinen ${c}S-Akku`}.`); B.board = null; B.esc = null; if (B.rx === '__builtin') B.rx = null; }
  const pr = P(B.prop); if (pr && f && num(f.max_prop_zoll) && num(pr.durchmesser_zoll) > num(f.max_prop_zoll) + .05) { out.push(`Propeller entfernt: ${de(num(pr.durchmesser_zoll), 1)} Zoll sind zu groß für den Rahmen.`); B.prop = null; }
  if (B.rx === '__builtin' && !(P(B.board) && P(B.board).eingebauter_empfaenger)) { B.rx = null; out.push('Empfänger entfernt: Er war auf dem alten Flugcontroller eingebaut.'); }
  if (B.kamera && P(B.video) && P(B.video).typ === 'digital') B.kamera = null;
  return out;
}
function solderTo(i) {
  const n = solderSteps(wiring()).length; state.solderStep = clamp(i, 0, n - 1); state.solderSeen = true;
  if (view !== 'loeten') setView('loeten'); else drawSolder();
  renderKeep();
  if (innerWidth < 1100 && ui.stage) { const r0 = ui.stage.getBoundingClientRect(); if (r0.bottom < 80 || r0.top > innerHeight * .5) { if (W.FCS && FCS.scrollTo) FCS.scrollTo(ui.stage, -80); } }
}
function scrollPanel() { const pan = ui.app.querySelector('.bk-panel'); if (!pan) return; const rr = pan.getBoundingClientRect(); if (rr.top < 40 || rr.top > innerHeight * .5) { if (W.FCS && FCS.scrollTo) FCS.scrollTo(pan, -80); else pan.scrollIntoView({ block: 'start' }); } }
const avg = (a) => (a[0] + a[1]) / 2;
function stopSolderAuto() {}
function setView(v) {
  view = v; ui.solder.toggleAttribute('hidden', v !== 'loeten'); ui.app.classList.toggle('is-solder', v === 'loeten');
  if (ui.vlabel) ui.vlabel.hidden = v !== 'loeten';
  $$('[data-bk-view]', ui.app).forEach(b => { const on = b.dataset.bkView === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  if (v === 'loeten') drawSolder();
  hint(v === 'loeten' ? 'Lötplan: zum Anschauen, Schritte rechts' : v === 'explode' ? 'Alle Teile auseinandergezogen' : 'Ziehen dreht die Drohne');
}
function go(i, force) {
  i = clamp(i, 0, STEPS.length - 1);
  if (!force && !reach(i) && i > step) return;
  step = i; state.flash = force ? state.flash : '';
  const id = STEPS[step].id;
  if (id === 'loeten') { state.solderSeen = true; setView('loeten'); } else if (view === 'loeten') setView('3d');
  render(); scrollPanel();
}
function liftoff() {
  if (ui.go.disabled && !G3.fly) { ui.checks.hidden = false; ui.checkB.setAttribute('aria-expanded', 'true'); return; }
  setView('3d'); G3.fly = 1; state.flown = true; toSim();
  if (innerWidth < 1100 && ui.stage) { if (W.FCS && FCS.scrollTo) FCS.scrollTo(ui.stage, -80); else ui.stage.scrollIntoView(); }
  const m = metrics();
  ui.flyhud.hidden = false;
  ui.flyT.innerHTML = `In der Luft. Schwebegas etwa <b>${de(Math.round((m.hover || 0) * 100))} %</b>, Schub zu Gewicht <b>${de(m.twr, 1)} : 1</b>.`;
  renderSteps();
}
function land() { G3.fly = 0; if (ui.flyhud) ui.flyhud.hidden = true; }
const zoomOn = () => state.zoom == null ? innerWidth < 700 : state.zoom;
let hintT = 0;
function hint(t) { const el = ui.hintBox; if (!el) return; ui.hint.textContent = t; el.classList.remove('gone'); clearTimeout(hintT); hintT = setTimeout(() => el.classList.add('gone'), 4500); }

function drag3d(cv) {
  let sx = 0, sy = 0, lx = 0, id = null;
  cv.addEventListener('pointerdown', e => { id = e.pointerId; sx = lx = e.clientX; sy = e.clientY; G3.drag = true; G3.touched = true; G3.vel = 0; cv.setPointerCapture(id); });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const dx = e.clientX - lx; lx = e.clientX; G3.yaw -= dx * .008; G3.vel = -dx * .008; G3.pitch = clamp(G3.pitch + e.movementY * .004, .08, 1.2); });
  const up = (e) => { if (e.pointerId !== id) return; G3.drag = false; id = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}

async function main() {
  const app = $('[data-bk-app]'); if (!app) return;
  bindUI(app);
  ui.body.innerHTML = '<p class="bk-p">Teile werden geladen …</p>';
  try {
    const v = (D.querySelector('script[src*="bau.js"]') || {}).src || '';
    const q = (v.match(/\?v=([^&]+)/) || [])[1] || Date.now();
    DB = await (await fetch(new URL('assets/data/teile.json?v=' + q, D.baseURI))).json();
    try { PL = ((await (await fetch(new URL('assets/data/platinen.json?v=' + q, D.baseURI))).json()).platinen) || []; } catch (e) { PL = []; }
    index();
  } catch (e) { console.warn('Bau deine Drohne: Teileliste', e); ui.body.innerHTML = '<p class="bk-empty">Die Teileliste konnte nicht geladen werden. Bitte Seite neu laden.</p>'; return; }
  const fh = fromHash(); load(fh || store.get('fcs-bau2', null)); loadW(); if (fh) { state.klOk = true; state.exOk = true; }
  const cv = $('.bk-cv', app);
  if (!init3d(cv)) { $('[data-bk-nogl]', app).hidden = false; cv.hidden = true; } else { drag3d(cv); layout3d(); build3d(true); }
  // Gespeicherter Bau: beim ersten offenen Schritt weitermachen, sonst bei Schritt 1
  step = Math.min(firstOpen(), SI('loeten')); if (anyChosen()) state.flash = 'Dein letzter Bau ist wieder da. „Neu anfangen“ steht oben rechts.';
  if (STEPS[step].id === 'loeten') { state.solderSeen = true; setView('loeten'); }
  render(); hint('Ziehen dreht die Drohne');
  // Schleife nur, solange sichtbar
  let raf = 0, last = performance.now(), vis = true;
  const loop = (now) => { raf = 0; const dt = Math.min(.05, (now - last) / 1000); last = now; frame3d(dt); if (vis && !D.hidden) raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf && G3.ok) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  if ('IntersectionObserver' in W) new IntersectionObserver(es => { vis = es.some(e => e.isIntersecting); if (vis) kick(); }, { rootMargin: '100px' }).observe(ui.stage);
  D.addEventListener('visibilitychange', kick);
  addEventListener('resize', () => { layout3d(); kick(); });
  kick();
  W.__fcsBau = { B, checks, wiring, metrics, preset, go, pick: pickPart, state, DB: () => DB };
}
main();
