/* Flight Club Saar – FPV-Simulator
   Ein kleiner, echter FPV-Sim im Browser:
   - Turnhalle mit acht Gates (Rundkurs), alles Low-Poly, Texturen werden zur Laufzeit per Canvas gemalt.
   - Kopter als starrer Körper mit festem Zeitschritt (1/240 s, Akkumulator), Schub, Schwerkraft,
     Luftwiderstand (linear + quadratisch), Motorträgheit, Akku-Spannung.
   - Acro (Betaflight-Rates) und Angle (Selbst-Ausrichten per Regler).
   - Eingabe: Funke oder Controller (Gamepad API, Assistent mit Speicherung je Gerät), Touch-Sticks, Tastatur.
   - Demo-Pilot fliegt, solange niemand fliegt. Schleife pausiert außerhalb des Bildschirms.
   Datenschutz: Es wird nichts gesendet. Einstellungen, Zuordnungen und Bestzeiten liegen im localStorage. */
import * as THREE from '../lib/three.module.min.js';

const D = document, W = window;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const COARSE = matchMedia('(pointer:coarse)').matches;
const TEST = /[?&]simtest\b/.test(location.search);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180, G = 9.81, STEP = 1 / 240;
const HX = 13.5, HZ = 22.5, HY = 8, CEIL = 7.2;
const run = (name, fn) => { try { return fn(); } catch (e) { console.warn('Simulator: ' + name, e); } };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
const fmtLap = (ms) => { if (!(ms > 0)) return '--:--.--'; const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(2).padStart(5, '0'); };
const fmtClock = (s) => { const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };
const pct = (v) => Math.round(v * 100) + ' %';

/* =====================================================================
   Einstellungen
   ===================================================================== */
const RATES_STD = { roll: { rc: 1, sr: 0.7, ex: 0 }, pitch: { rc: 1, sr: 0.7, ex: 0 }, yaw: { rc: 1, sr: 0.6, ex: 0 } };
const PRESETS = {
  soft: { roll: { rc: 0.8, sr: 0.5, ex: 0.2 }, pitch: { rc: 0.8, sr: 0.5, ex: 0.2 }, yaw: { rc: 0.8, sr: 0.4, ex: 0.1 } },
  std: RATES_STD,
  fast: { roll: { rc: 1.2, sr: 0.75, ex: 0.3 }, pitch: { rc: 1.2, sr: 0.75, ex: 0.3 }, yaw: { rc: 1.1, sr: 0.65, ex: 0.2 } }
};
const DEF = {
  mode: 'angle', craft: 'whoop', view: 'fpv', light: 'on', analog: false, osd: true, quality: 'auto',
  fov: 110, tilt: { acro: 25, angle: 10 }, maxAngle: 55, level: 7, thrMid: 0.5, thrExpo: 0, dz: 0.04,
  rates: JSON.parse(JSON.stringify(RATES_STD))
};
function loadSettings() {
  const s = JSON.parse(JSON.stringify(DEF)), o = store.get('fcs-sim-v1', null);
  if (o && typeof o === 'object') {
    if (o.mode === 'acro' || o.mode === 'angle') s.mode = o.mode;
    if (o.craft === 'whoop' || o.craft === 'five') s.craft = o.craft;
    if (o.view === 'fpv' || o.view === 'chase') s.view = o.view;
    if (o.light === 'on' || o.light === 'off') s.light = o.light;
    if (['auto', '0', '1', '2', '3'].includes(o.quality)) s.quality = o.quality;
    if (typeof o.analog === 'boolean') s.analog = o.analog;
    if (typeof o.osd === 'boolean') s.osd = o.osd;
    const num = (k, a, b) => { if (Number.isFinite(o[k])) s[k] = clamp(o[k], a, b); };
    num('fov', 80, 140); num('maxAngle', 20, 80); num('level', 2, 12); num('thrMid', 0.2, 0.8); num('thrExpo', 0, 1); num('dz', 0, 0.2);
    if (o.tilt) for (const m of ['acro', 'angle']) if (Number.isFinite(o.tilt[m])) s.tilt[m] = clamp(o.tilt[m], 0, 45);
    if (o.rates) for (const ax of ['roll', 'pitch', 'yaw']) for (const k of ['rc', 'sr', 'ex']) { const v = o.rates[ax] && o.rates[ax][k]; if (Number.isFinite(v)) s.rates[ax][k] = clamp(v, k === 'rc' ? 0.1 : 0, k === 'rc' ? 2.55 : k === 'sr' ? 0.95 : 1); }
  }
  return s;
}
const S = loadSettings();
const saveSettings = () => store.set('fcs-sim-v1', S);

/* Betaflight-Rates: Stick s ∈ [-1,1] → Drehrate in °/s */
function bfRate(s, r) {
  const a = Math.abs(s);
  const sp = s * a * a * a * r.ex + s * (1 - r.ex);
  let rate = 200 * r.rc * sp;
  if (r.sr > 0) rate *= 1 / clamp(1 - Math.abs(sp) * r.sr, 0.01, 1);
  return rate;
}
/* Gas-Kurve wie Betaflight (thr_mid, thr_expo) */
function thrCurve(t) {
  const mid = S.thrMid, e = S.thrExpo, d = t - mid, y = d > 0 ? 1 - mid : mid;
  if (y <= 0) return t;
  return clamp(mid + d * (1 - e + e * d * d / (y * y)), 0, 1);
}

/* Kopter: Schub/Gewicht, Luftwiderstand, Reaktionszeiten, Größe */
const CRAFTS = {
  whoop: { osd: 'WHOOP', tw: 3.4, kLin: 0.55, kQuad: 0.12, tauR: 0.035, tauM: 0.03, r: 0.045, rest: 0.45, crash: 5.5, cells: 1, idle: 0.05, demoV: 6.2, chase: [0.95, 0.36], camFwd: 0.035, shadow: 0.28, kick: 2.4 },
  five: { osd: '5 ZOLL', tw: 9, kLin: 0.12, kQuad: 0.035, tauR: 0.02, tauM: 0.02, r: 0.11, rest: 0.25, crash: 6.5, cells: 6, idle: 0.05, demoV: 10.5, chase: [1.9, 0.62], camFwd: 0.07, shadow: 0.55, kick: 1.5 }
};
const CR = () => CRAFTS[S.craft];
const thrustK = (m) => 0.4 * m + 0.6 * m * m;
/* Schwebegas in % Stickweg (Kurve rückwärts gesucht) */
function hoverStick() {
  const C = CR(), need = 1 / C.tw;
  const m = (-0.4 + Math.sqrt(0.16 + 2.4 * need)) / 1.2;
  const c = clamp((m - C.idle) / (1 - C.idle), 0, 1);
  let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (thrCurve(mid) < c) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/* =====================================================================
   Seite: Elemente
   ===================================================================== */
const app = $('[data-sim-app]');
if (app) init();

function init() {
  const stage = $('.sim-stage', app), canvas = $('.sim-canvas', stage), panel = $('.sim-panel', app);
  const O = {}; $$('[data-o]', stage).forEach(n => O[n.dataset.o] = n);
  const toastEl = $('[data-toast]', stage), helpEl = $('[data-help]', stage), cta = $('[data-cta]', stage);
  const loadEl = $('[data-load]', stage);

  /* ---------- Zustand ---------- */
  const P = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
    ppos: new THREE.Vector3(), pq: new THREE.Quaternion(),
    motor: 0, armed: false, armReq: false, crashed: 0, crashMsg: '', used: 0, vcell: 4.2, vdisp: 4.2, flightT: 0, ground: false, upsideT: 0, thrust: 0
  };
  const IN = { thr: 0, yaw: 0, pitch: 0, roll: 0, src: COARSE && !FINE ? 'touch' : 'key', lastAct: 0 };
  const race = { next: 0, running: false, t0: 0, last: 0, laps: 0, missT: 0 };
  const demo = { on: !RM, u: 0.02, curve: null, len: 1, up: new THREE.Vector3(0, 1, 0) };
  let live = false, simT = 0, isFull = false, stageVis = true, panelVis = true, gl = false, shake = 0, msg = { t: '', cls: '', until: 0 };
  let best = store.get('fcs-sim-best', {});
  if (!best || typeof best !== 'object') best = {};

  /* =====================================================================
     Andockpunkt für die spätere globale Bestenliste
     onLap(ms, info) wird nach jeder vollen Runde aufgerufen. Hier kann später
     eine Übertragung an eine Bestenliste angehängt werden. Heute: nur lokal.
     ===================================================================== */
  function onLap(ms, info) {
    const key = info.craft + '-' + info.mode;
    const isBest = !(best[key] > 0) || ms < best[key];
    if (isBest) { best[key] = Math.round(ms); store.set('fcs-sim-best', best); }
    D.dispatchEvent(new CustomEvent('fcs:sim-lap', { detail: Object.assign({ ms, best: isBest }, info) }));
    return isBest;
  }

  /* =====================================================================
     3D: Renderer, Szene, Halle, Gates, Kopter
     ===================================================================== */
  let renderer = null, scene, camera, hemi, sun, ANISO = 1;
  const MAT = {}, TEX = {}, GATES = [], COLL = [], FX = {};
  let quadW, quadF, quad, shadowM, halos, lightsInst, ledGlow, scoreCtx, scoreTex;
  const COURSE = [
    { t: 'sq', p: [-8, 1.5, 10], h: 0 },
    { t: 'ring', p: [-8, 2.3, -3], h: 0 },
    { t: 'flag', p: [-6.4, 1.3, -13], h: 35 },
    { t: 'dive', p: [1.6, 3.3, -18.4], h: 90, tilt: 50, pre: [[-3.0, 5.6, -17.4]] },
    { t: 'ring', p: [8.6, 1.7, -10], h: 160, pre: [[5.4, 1.5, -16.4]] },
    { t: 'high', p: [9, 4.2, 1], h: 180 },
    { t: 'flag', p: [6.8, 1.3, 12], h: 215 },
    { t: 'ring', p: [-0.5, 1.5, 19], h: 270, post: [[-5.6, 1.5, 17.4]] }
  ];
  const START = new THREE.Vector3(-8, 0, 16.6);
  const C_NEXT = new THREE.Color('#3fe0ff'), C_AFTER = new THREE.Color('#ffb020'), C_IDLE = new THREE.Color('#6d86c4'), C_PASS = new THREE.Color('#3ee08a');

  function hasGL() { try { const c = D.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

  /* ---------- Hilfen ---------- */
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function mtx(x, y, z, rx = 0, ry = 0, rz = 0) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); }
  function geo(g, m, su, sv) {
    const n = g.index ? g.toNonIndexed() : g; if (g.index) g.dispose();
    if (su || sv) { const uv = n.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (su || 1), uv.getY(i) * (sv || 1)); }
    if (m) n.applyMatrix4(m); return n;
  }
  function merge(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere(); return out;
  }
  /* Kollisionskörper: gedrehter Quader aus einer Matrix (nur Drehung + Verschiebung) */
  function addOBB(m, hx, hy, hz) {
    const e = m.elements;
    COLL.push({ cx: e[12], cy: e[13], cz: e[14], hx, hy, hz, a: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]], br: Math.hypot(hx, hy, hz) });
  }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function cnv(w, h) { const c = D.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function tex(c, rep, srgb = true) {
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }

  /* ---------- Texturen (alle selbst gemalt) ---------- */
  function makeTextures() {
    const R = rng(7);
    // Hallenboden: heller Linoleum mit feinen Sprenkeln
    { const [c, x] = cnv(512, 512); x.fillStyle = '#c9c2b1'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(R() * 512, R() * 512, 0, R() * 512, R() * 512, 60 + R() * 120); g.addColorStop(0, `rgba(${R() > .5 ? '255,250,240' : '120,110,95'},.06)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
      for (let i = 0; i < 9000; i++) { const v = R(); x.fillStyle = v > .5 ? `rgba(255,255,255,${.05 + R() * .08})` : `rgba(70,60,45,${.05 + R() * .1})`; x.fillRect(R() * 512, R() * 512, 1 + (R() > .9), 1); }
      x.fillStyle = 'rgba(60,50,40,.10)'; x.fillRect(0, 0, 512, 1.5);
      TEX.floor = tex(c, [HX * 2 / 3, HZ * 2 / 3]); }
    // Wand: unten Holz-Lamellen (Prallschutz), oben heller Stein
    { const [c, x] = cnv(256, 512); const wood = 3.2 / 8 * 512;
      x.fillStyle = '#d6d0c3'; x.fillRect(0, 0, 256, 512 - wood);
      x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1;
      for (let y = 512 - wood, r = 0; y > 0; y -= 16, r++) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); for (let xx = (r % 2) * 16; xx < 256; xx += 32) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y - 16); x.stroke(); } }
      for (let xx = 0; xx < 256; xx += 6) { const t = R(); x.fillStyle = `rgb(${150 + t * 30},${102 + t * 22},${62 + t * 14})`; x.fillRect(xx, 512 - wood, 5, wood); x.fillStyle = 'rgba(40,24,10,.55)'; x.fillRect(xx + 5, 512 - wood, 1, wood); }
      const g = x.createLinearGradient(0, 512 - wood, 0, 512); g.addColorStop(0, 'rgba(255,240,220,.08)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(0, 512 - wood, 256, wood);
      x.fillStyle = '#5b3d22'; x.fillRect(0, 512 - wood - 5, 256, 5);
      TEX.wall = tex(c); TEX.wall.wrapS = THREE.RepeatWrapping; }
    // Decke
    { const [c, x] = cnv(128, 128); x.fillStyle = '#585c63'; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, 128, 2); x.fillRect(0, 0, 2, 128);
      TEX.ceil = tex(c, [HX * 2 / 3, HZ * 2 / 3]); }
    // weiches Leuchten (rund)
    { const [c, x] = cnv(128, 128); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); TEX.glow = tex(c, null, false); }
    // Leuchten um ein eckiges Gate und um einen Ring
    const frameGlow = (ring) => { const [c, x] = cnv(256, 256); x.strokeStyle = '#fff'; x.shadowColor = '#fff';
      for (const [w, b, a] of [[14, 30, .5], [7, 14, .8], [3, 4, 1]]) { x.lineWidth = w; x.shadowBlur = b; x.globalAlpha = a; x.beginPath(); if (ring) x.arc(128, 128, 79, 0, Math.PI * 2); else x.rect(48, 48, 160, 160); x.stroke(); }
      return tex(c, null, false); };
    TEX.sqGlow = frameGlow(false); TEX.ringGlow = frameGlow(true);
    // Absperrband an den Pfosten (rot-weiß)
    { const [c, x] = cnv(32, 64); x.fillStyle = '#f2f0ec'; x.fillRect(0, 0, 32, 64); x.fillStyle = '#d4293b'; x.fillRect(0, 0, 32, 32); TEX.pvc = tex(c); TEX.pvc.wrapS = TEX.pvc.wrapT = THREE.RepeatWrapping; }
    // Lichtstreifen über die Breite (für LED-Linie am Boden)
    { const [c, x] = cnv(8, 64); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); TEX.strip = tex(c, null, false); }
    // Schatten an den Wandfüßen
    { const [c, x] = cnv(8, 64); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); TEX.ao = tex(c, null, false); }
    // Sprossenwand (mit Transparenz)
    { const [c, x] = cnv(128, 256); x.clearRect(0, 0, 128, 256); x.fillStyle = '#b68650'; x.fillRect(0, 0, 9, 256); x.fillRect(119, 0, 9, 256);
      for (let y = 10; y < 256; y += 22) { x.fillStyle = '#c99a62'; x.fillRect(0, y, 128, 6); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, y + 6, 128, 1); }
      TEX.bars = tex(c); TEX.bars.wrapS = THREE.RepeatWrapping; }
    // Fenster (Abendstimmung)
    { const [c, x] = cnv(128, 64); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#1d3354'); g.addColorStop(1, '#0c1628'); x.fillStyle = g; x.fillRect(0, 0, 128, 64);
      x.fillStyle = 'rgba(160,200,255,.08)'; x.beginPath(); x.moveTo(10, 64); x.lineTo(50, 0); x.lineTo(70, 0); x.lineTo(30, 64); x.fill();
      x.fillStyle = '#cfd3d8'; x.fillRect(0, 0, 128, 4); x.fillRect(0, 60, 128, 4); x.fillRect(0, 0, 4, 64); x.fillRect(62, 0, 4, 64);
      TEX.win = tex(c); TEX.win.wrapS = THREE.RepeatWrapping; }
    // Korbbrett
    { const [c, x] = cnv(256, 150); x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, 256, 150); x.strokeStyle = '#d24418'; x.lineWidth = 7; x.strokeRect(6, 6, 244, 138); x.strokeRect(86, 66, 84, 60); TEX.board = tex(c); }
    // Karton
    { const [c, x] = cnv(128, 64); x.fillStyle = '#b8864f'; x.fillRect(0, 0, 128, 64); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(80,50,20,${R() * .08})`; x.fillRect(R() * 128, R() * 64, 2, 1); } x.fillStyle = 'rgba(210,180,120,.8)'; x.fillRect(0, 28, 128, 8); TEX.box = tex(c); }
  }
  /* Texturen mit Schrift (nach dem Laden der Vereinsschrift) */
  function textTextures(logo) {
    const big = '"Bebas Neue","Chakra Petch",Impact,sans-serif', hud = '"Chakra Petch",ui-monospace,monospace';
    /* Beim zweiten Aufruf (Schrift geladen) in dieselben Canvas malen und nur auffrischen */
    const cnvK = (key, w, h, idx) => { const t = idx == null ? TEX[key] : TEX[key] && TEX[key][idx]; if (t) { const c = t.image, x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.textAlign = 'left'; x.clearRect(0, 0, w, h); return [c, x]; } return cnv(w, h); };
    const put = (key, c, idx) => { if (idx == null) { if (TEX[key]) TEX[key].needsUpdate = true; else TEX[key] = tex(c); } else { TEX[key] = TEX[key] || []; if (TEX[key][idx]) TEX[key][idx].needsUpdate = true; else TEX[key][idx] = tex(c); } };
    // Banner an der Stirnwand
    { const [c, x] = cnvK('banner', 1024, 192); const g = x.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, '#0b1a33'); g.addColorStop(1, '#10244a'); x.fillStyle = g; x.fillRect(0, 0, 1024, 192);
      x.fillStyle = '#3fe0ff'; x.fillRect(0, 184, 1024, 8);
      if (logo) { try { x.drawImage(logo, 28, 22, 148, 148); } catch (e) { } }
      x.fillStyle = '#fff'; x.font = `400 112px ${big}`; x.textBaseline = 'middle'; x.fillText('FLIGHT CLUB SAAR', 200, 82);
      x.fillStyle = '#3fe0ff'; x.font = `600 34px ${hud}`; x.fillText('BRILLE AN, WELT AUS!  ·  E. V.', 204, 152);
      put('banner', c); }
    // Startmatte
    { const [c, x] = cnvK('start', 256, 256); x.fillStyle = '#10244a'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#3fe0ff'; x.lineWidth = 10; x.strokeRect(10, 10, 236, 236);
      if (logo) { try { x.globalAlpha = .9; x.drawImage(logo, 78, 40, 100, 100); x.globalAlpha = 1; } catch (e) { } }
      x.fillStyle = '#fff'; x.font = `400 74px ${big}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('START', 128, 196); put('start', c); }
    // Gate-Nummern
    for (let i = 1; i <= COURSE.length; i++) { const [c, x] = cnvK('num', 128, 128, i - 1); x.fillStyle = '#071225'; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 116, 116, 22) : x.rect(6, 6, 116, 116); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = `400 96px ${big}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i), 64, 70); put('num', c, i - 1); }
    // Flagge
    { const [c, x] = cnvK('flag', 128, 384); x.clearRect(0, 0, 128, 384); x.beginPath(); x.moveTo(0, 384); x.lineTo(0, 0); x.quadraticCurveTo(110, 0, 124, 90); x.lineTo(110, 384); x.closePath();
      const g = x.createLinearGradient(0, 0, 128, 384); g.addColorStop(0, '#3fe0ff'); g.addColorStop(.55, '#1f497d'); g.addColorStop(1, '#0b1a33'); x.fillStyle = g; x.fill();
      x.save(); x.translate(62, 230); x.rotate(-Math.PI / 2); x.fillStyle = '#fff'; x.font = `400 64px ${big}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FLIGHT CLUB', 0, 0); x.restore();
      put('flag', c); }
    // Anzeigetafel
    if (!scoreCtx) { const [c, x] = cnv(512, 240); scoreCtx = { c, x, big, hud }; drawScore(); TEX.score = scoreTex = tex(c); }
    else drawScore();
  }
  function drawScore() {
    if (!scoreCtx) return; const { c, x, big, hud } = scoreCtx;
    x.fillStyle = '#05070b'; x.fillRect(0, 0, 512, 240); x.strokeStyle = '#2a2f38'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 232);
    x.fillStyle = '#3fe0ff'; x.font = `600 30px ${hud}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FLIGHT CLUB SAAR', 256, 42);
    x.fillStyle = '#9db1cc'; x.font = `600 24px ${hud}`; x.fillText('BESTE RUNDE · ' + CR().osd + ' · ' + S.mode.toUpperCase(), 256, 90);
    const b = best[S.craft + '-' + S.mode];
    x.fillStyle = '#ff4b5c'; x.shadowColor = '#ff4b5c'; x.shadowBlur = 16; x.font = `400 104px ${big}`; x.fillText(b > 0 ? fmtLap(b) : '--:--.--', 256, 170); x.shadowBlur = 0;
    if (scoreTex) scoreTex.needsUpdate = true;
  }

  /* ---------- Halle ---------- */
  function buildHall() {
    MAT.floor = new THREE.MeshLambertMaterial({ map: TEX.floor });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), MAT.floor); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    buildLines();
    // Wände
    MAT.wall = new THREE.MeshLambertMaterial({ map: TEX.wall });
    const wall = (len, x, z, ry) => { const g = new THREE.PlaneGeometry(len, HY); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 4); const m = new THREE.Mesh(g, MAT.wall); m.position.set(x, HY / 2, z); m.rotation.y = ry; scene.add(m); };
    wall(HZ * 2, -HX, 0, Math.PI / 2); wall(HZ * 2, HX, 0, -Math.PI / 2); wall(HX * 2, 0, -HZ, 0); wall(HX * 2, 0, HZ, Math.PI);
    // dunkle Säume am Wandfuß (Kontaktschatten)
    MAT.ao = new THREE.MeshBasicMaterial({ map: TEX.ao, transparent: true, depthWrite: false, color: 0x000000, opacity: .9 });
    const ao = (len, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .9), MAT.ao); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, .002, z); scene.add(m); };
    ao(HZ * 2, -HX + .45, 0, -Math.PI / 2); ao(HZ * 2, HX - .45, 0, Math.PI / 2); ao(HX * 2, 0, -HZ + .45, 0); ao(HX * 2, 0, HZ - .45, Math.PI);
    // Decke, Binder, Lampen
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshLambertMaterial({ map: TEX.ceil })); ceil.rotation.x = Math.PI / 2; ceil.position.y = HY; scene.add(ceil);
    MAT.metal = new THREE.MeshLambertMaterial({ color: 0x8b929b });
    const trussZ = []; for (let z = -20.25; z <= 20.3; z += 4.5) trussZ.push(z);
    const tr = new THREE.InstancedMesh(new THREE.BoxGeometry(HX * 2, .5, .16), MAT.metal, trussZ.length * 2); let ti = 0;
    for (const z of trussZ) { tr.setMatrixAt(ti++, mtx(0, 7.62, z)); tr.setMatrixAt(ti++, mtx(0, 7.62, z + 2.25, 0, 0, 0).scale(new THREE.Vector3(1, .4, .6))); }
    scene.add(tr);
    MAT.lamp = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
    const lampXs = [-9.5, -3.2, 3.2, 9.5];
    lightsInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .06, .42), MAT.lamp, trussZ.length * lampXs.length);
    MAT.halo = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffe9c4, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false });
    halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.4, 3.4), MAT.halo, trussZ.length * lampXs.length);
    let li = 0;
    for (const z of trussZ) for (const x of lampXs) { lightsInst.setMatrixAt(li, mtx(x, 7.3, z + 1.1)); halos.setMatrixAt(li, mtx(x, 7.26, z + 1.1, Math.PI / 2)); li++; }
    scene.add(lightsInst, halos);
    // Fenster an der rechten Längswand
    TEX.win.repeat.set(16, 1); MAT.win = new THREE.MeshBasicMaterial({ map: TEX.win });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(38, 1.7), MAT.win); win.position.set(HX - .02, 6.1, 0); win.rotation.y = -Math.PI / 2; scene.add(win);
    // Banner und Anzeigetafel
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), new THREE.MeshLambertMaterial({ map: TEX.banner })); ban.position.set(0, 5.2, -HZ + .03); scene.add(ban);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, .16), new THREE.MeshLambertMaterial({ color: 0x1a1d22 })); sb.position.set(0, 5.3, HZ - .08); scene.add(sb);
    MAT.score = new THREE.MeshBasicMaterial({ map: TEX.score });
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), MAT.score); sf.position.set(0, 5.3, HZ - .17); sf.rotation.y = Math.PI; scene.add(sf);
    // Sprossenwand
    TEX.bars.repeat.set(6, 1);
    const bars = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.7), new THREE.MeshLambertMaterial({ map: TEX.bars, alphaTest: .5, side: THREE.DoubleSide })); bars.position.set(-HX + .14, 1.35, -5); bars.rotation.y = Math.PI / 2; scene.add(bars);
    addOBB(mtx(-HX + .08, 1.35, -5), .09, 1.35, 3);
    // Basketballkörbe an den Längswänden (Querfelder)
    MAT.white = new THREE.MeshLambertMaterial({ color: 0xf2f2ef }); MAT.orange = new THREE.MeshLambertMaterial({ color: 0xf06a1c });
    const net = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .55 });
    for (const sx of [-1, 1]) for (const z of [-11.25, 11.25]) {
      const bx = sx * (HX - 1.2);
      const board = new THREE.Mesh(new THREE.BoxGeometry(.04, 1.05, 1.8), MAT.white); board.position.set(bx, 3.42, z); scene.add(board);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), new THREE.MeshLambertMaterial({ map: TEX.board })); face.position.set(bx - sx * .025, 3.42, z); face.rotation.y = -sx * Math.PI / 2; scene.add(face);
      for (const y of [3.05, 3.85]) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, .07, .07), MAT.metal); s.position.set(sx * (HX - .6), y, z); scene.add(s); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.225, .014, 6, 20), MAT.orange); ring.rotation.x = Math.PI / 2; ring.position.set(bx - sx * .39, 3.05, z); scene.add(ring);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(.225, .15, .4, 12, 2, true), net); n.position.set(bx - sx * .39, 2.85, z); scene.add(n);
      addOBB(mtx(bx, 3.42, z), .03, .53, .9); addOBB(mtx(sx * (HX - .6), 3.45, z), .6, .45, .05);
    }
    // Turnbänke
    const benchG = [], benchPos = [[12.75, -2.6, Math.PI / 2], [12.75, 2.6, Math.PI / 2], [-12.75, 13.4, Math.PI / 2], [-12.75, -14.6, Math.PI / 2], [-4.5, 21.7, 0], [5.5, -21.7, 0]];
    for (const [x, z, ry] of benchPos) {
      const m = mtx(x, 0, z, 0, ry, 0);
      benchG.push(geo(new THREE.BoxGeometry(3.4, .045, .24), mtx(0, .33, 0).premultiply(m)), geo(new THREE.BoxGeometry(3.3, .05, .08), mtx(0, .06, 0).premultiply(m)));
      for (const lx of [-1.3, 1.3]) benchG.push(geo(new THREE.BoxGeometry(.05, .3, .34), mtx(lx, .16, 0).premultiply(m)));
      addOBB(m.clone().multiply(mtx(0, .18, 0)), 1.7, .18, .17);
    }
    scene.add(new THREE.Mesh(merge(benchG), new THREE.MeshLambertMaterial({ color: 0xc08d55 })));
    // Weichbodenmatte, Kasten, Kartons
    const mat = new THREE.Mesh(new THREE.BoxGeometry(3, .5, 2), new THREE.MeshLambertMaterial({ color: 0x2c5fb8 })); mat.position.set(10.6, .25, 19.8); scene.add(mat); addOBB(mtx(10.6, .25, 19.8), 1.5, .25, 1);
    const kG = []; for (let i = 0; i < 5; i++) kG.push(geo(new THREE.BoxGeometry(1.5 - i * .06, .2, .95 - i * .04), mtx(0, .1 + i * .21, 0)));
    const kasten = new THREE.Mesh(merge(kG), new THREE.MeshLambertMaterial({ color: 0xc39463 })); kasten.position.set(2.6, 0, 5); kasten.rotation.y = .3; scene.add(kasten);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.24, .07, .8), new THREE.MeshLambertMaterial({ color: 0xe9e4d6 })); top.position.set(2.6, 1.08, 5); top.rotation.y = .3; scene.add(top);
    addOBB(mtx(2.6, .55, 5, 0, .3, 0), .75, .56, .48);
    MAT.box = new THREE.MeshLambertMaterial({ map: TEX.box });
    for (const [x, z, ry] of [[-10.6, 3.2, .2], [-5.2, -7.4, -.4], [5.4, 8.2, .9], [4.2, -6.6, .1]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(.8, .42, .42), MAT.box); b.position.set(x, .21, z); b.rotation.y = ry; scene.add(b); addOBB(mtx(x, .21, z, 0, ry, 0), .4, .21, .21);
    }
    // Startmatte
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshLambertMaterial({ map: TEX.start })); sm.rotation.x = -Math.PI / 2; sm.position.set(START.x, .004, START.z); scene.add(sm);
  }

  /* Spielfeldlinien als dünne Streifen (scharf in jeder Entfernung) */
  function buildLines() {
    const sets = { blue: [], white: [], yellow: [] };
    const seg = (arr, x1, z1, x2, z2) => arr.push([x1, z1, x2, z2]);
    const rect = (arr, x1, z1, x2, z2) => { seg(arr, x1, z1, x2, z1); seg(arr, x2, z1, x2, z2); seg(arr, x2, z2, x1, z2); seg(arr, x1, z2, x1, z1); };
    const arc = (arr, cx, cz, r, a0, a1, n = 24) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n; seg(arr, cx + Math.cos(a) * r, cz + Math.sin(a) * r, cx + Math.cos(b) * r, cz + Math.sin(b) * r); } };
    // Handball (blau)
    const B = sets.blue; rect(B, -10, -20, 10, 20); seg(B, -10, 0, 10, 0);
    for (const s of [-1, 1]) { const gz = s * 20; arc(B, -1.5, gz, 6, s > 0 ? Math.PI : Math.PI / 2 * 3, s > 0 ? Math.PI * 1.5 : Math.PI * 1, 14); arc(B, 1.5, gz, 6, s > 0 ? Math.PI * 1.5 : Math.PI * 2, s > 0 ? Math.PI * 2 : Math.PI * 1.5, 14); seg(B, -1.5, gz - s * 6, 1.5, gz - s * 6);
      for (let i = 0; i < 9; i++) { const a = Math.PI * (s > 0 ? 1.12 + i * .085 : .12 + i * .085); seg(B, Math.cos(a) * 9 * .62, gz + Math.sin(a) * 9, Math.cos(a + .04) * 9 * .62, gz + Math.sin(a + .04) * 9); } }
    // Basketball quer (weiß), zwei Felder
    const Wt = sets.white;
    for (const c of [-11.25, 11.25]) { rect(Wt, -13, c - 7.5, 13, c + 7.5); seg(Wt, 0, c - 7.5, 0, c + 7.5); arc(Wt, 0, c, 1.8, 0, Math.PI * 2, 28);
      for (const s of [-1, 1]) { const bx = s * 13, hx = s * 11.425; rect(Wt, bx, c - 2.45, s * 7.2, c + 2.45); arc(Wt, s * 7.2, c, 1.8, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2, 16);
        const a = Math.asin(6.6 / 6.75); seg(Wt, bx, c - 6.6, s * 10.01, c - 6.6); seg(Wt, bx, c + 6.6, s * 10.01, c + 6.6);
        if (s > 0) arc(Wt, hx, c, 6.75, Math.PI - a, Math.PI + a, 26); else arc(Wt, hx, c, 6.75, -a, a, 26); } }
    // Volleyball (gelb)
    const Y = sets.yellow; rect(Y, -4.5, -9, 4.5, 9); seg(Y, -4.5, 0, 4.5, 0); seg(Y, -4.5, -3, 4.5, -3); seg(Y, -4.5, 3, 4.5, 3);
    const build = (list, w, y) => {
      const pos = []; for (const [x1, z1, x2, z2] of list) { const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
        pos.push(x1 + nx, y, z1 + nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz, x1 + nx, y, z1 + nz, x2 - nx, y, z2 - nz, x1 - nx, y, z1 - nz); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g; };
    const lm = (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    scene.add(new THREE.Mesh(build(sets.blue, .05, .003), lm(0x2a5fc4)), new THREE.Mesh(build(sets.white, .05, .003), lm(0xf6f3ec)), new THREE.Mesh(build(sets.yellow, .05, .003), lm(0xe2b625)));
    FX.lineBuild = build;
  }

  /* ---------- Gates ---------- */
  function buildCourse() {
    MAT.pvc = new THREE.MeshLambertMaterial({ map: TEX.pvc });
    MAT.flag = new THREE.MeshLambertMaterial({ map: TEX.flag, transparent: true, alphaTest: .4, side: THREE.DoubleSide });
    const pvcG = [], metalG = [];
    COURSE.forEach((d, i) => {
      const c = v3(d.p), h = d.h * DEG, tilt = (d.tilt || 0) * DEG;
      const hd = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
      const n = hd.clone().multiplyScalar(Math.cos(tilt)).add(new THREE.Vector3(0, -Math.sin(tilt), 0)).normalize();
      const u = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
      const v = new THREE.Vector3().crossVectors(u, n).normalize();
      const M = new THREE.Matrix4().makeBasis(u, v, n.clone().negate()).setPosition(c);
      const g = { i, t: d.t, c, n, u, v, psd: 0, flash: 0, hw: .75, hh: .75, rr: .8 };
      g.frame = new THREE.MeshBasicMaterial({ color: C_IDLE.clone() });
      g.glow = new THREE.MeshBasicMaterial({ map: d.t === 'ring' ? TEX.ringGlow : TEX.sqGlow, color: C_IDLE.clone(), transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      g.floor = new THREE.MeshBasicMaterial({ map: TEX.glow, color: C_IDLE.clone(), transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false });
      const add = (geom, mat) => { const m = new THREE.Mesh(geom, mat); scene.add(m); return m; };
      let signLocal = new THREE.Vector3(0, 1.22, 0);
      if (d.t === 'sq' || d.t === 'high' || d.t === 'dive') {
        const bars = [[0, .81, 1.74, .12], [0, -.81, 1.74, .12], [-.81, 0, .12, 1.5], [.81, 0, .12, 1.5]];
        const fg = bars.map(([x, y, w, hh]) => geo(new THREE.BoxGeometry(w, hh, .12), new THREE.Matrix4().multiplyMatrices(M, mtx(x, y, 0))));
        add(merge(fg), g.frame);
        bars.forEach(([x, y, w, hh]) => addOBB(new THREE.Matrix4().multiplyMatrices(M, mtx(x, y, 0)), w / 2, hh / 2, .06));
        const gw = add(new THREE.PlaneGeometry(2.7, 2.7), g.glow); gw.applyMatrix4(M);
        if (d.t !== 'dive') {
          // Pfosten vom Boden bis zum Rahmen, mit Absperrband
          for (const s of [-1, 1]) {
            const px = c.x + u.x * .81 * s, pz = c.z + u.z * .81 * s, top = c.y - .87, hgt = top;
            if (hgt > .05) { pvcG.push(geo(new THREE.BoxGeometry(.07, hgt, .07), mtx(px, hgt / 2, pz, 0, -h, 0), 1, hgt / .5)); addOBB(mtx(px, hgt / 2, pz, 0, -h, 0), .05, hgt / 2, .05); }
            metalG.push(geo(new THREE.BoxGeometry(.5, .04, .34), mtx(px, .02, pz, 0, -h, 0)));
          }
        } else {
          // Gerüst: vier senkrechte Beine an den Ecken
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            const p = c.clone().addScaledVector(u, .81 * sx).addScaledVector(v, .81 * sy), hgt = p.y - .06;
            pvcG.push(geo(new THREE.BoxGeometry(.06, hgt, .06), mtx(p.x, hgt / 2, p.z), 1, hgt / .5)); addOBB(mtx(p.x, hgt / 2, p.z), .045, hgt / 2, .045);
            metalG.push(geo(new THREE.BoxGeometry(.3, .03, .3), mtx(p.x, .015, p.z)));
          }
          signLocal = new THREE.Vector3(0, 1.2, 0);
        }
      } else if (d.t === 'ring') {
        g.rr = .8;
        add(geo(new THREE.TorusGeometry(.8, .055, 8, 40), M), g.frame);
        const N = 14; for (let k = 0; k < N; k++) {
          const a = k / N * Math.PI * 2, rad = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)), tng = u.clone().multiplyScalar(-Math.sin(a)).addScaledVector(v, Math.cos(a));
          const p = c.clone().addScaledVector(rad, .8), m = new THREE.Matrix4().makeBasis(tng, rad, new THREE.Vector3().crossVectors(tng, rad)).setPosition(p);
          addOBB(m, .19, .055, .055);
        }
        const gw = add(new THREE.PlaneGeometry(2.7, 2.7), g.glow); gw.applyMatrix4(M);
        const top = c.y - .86; if (top > .05) { metalG.push(geo(new THREE.CylinderGeometry(.03, .03, top, 8), mtx(c.x, top / 2, c.z))); addOBB(mtx(c.x, top / 2, c.z), .035, top / 2, .035); }
        metalG.push(geo(new THREE.CylinderGeometry(.28, .3, .04, 16), mtx(c.x, .02, c.z)));
        signLocal = new THREE.Vector3(0, 1.22, 0);
      } else if (d.t === 'flag') {
        g.hw = 1.25; g.hh = 1.45; const H = 3;
        for (const s of [-1, 1]) {
          const px = c.x + u.x * 1.35 * s, pz = c.z + u.z * 1.35 * s;
          add(geo(new THREE.CylinderGeometry(.03, .03, H, 8), mtx(px, H / 2, pz)), g.frame); addOBB(mtx(px, H / 2, pz), .04, H / 2, .04);
          const cloth = new THREE.Mesh(new THREE.PlaneGeometry(.72, 2.1), MAT.flag);
          cloth.position.set(px + u.x * .37 * s, 1.9, pz + u.z * .37 * s); cloth.rotation.y = -h; if (s < 0) cloth.scale.x = -1; scene.add(cloth);
          metalG.push(geo(new THREE.CylinderGeometry(.22, .26, .06, 12), mtx(px, .03, pz)));
        }
        // Leuchtleiste am Boden quer durch die Durchflugöffnung
        add(geo(new THREE.BoxGeometry(2.6, .03, .05), mtx(c.x, .02, c.z, 0, -h, 0)), g.frame);
        signLocal = new THREE.Vector3(0, 3.25 - c.y, 0);
      }
      // Nummer über dem Gate, zeigt zum anfliegenden Piloten
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(.46, .46), new THREE.MeshBasicMaterial({ map: TEX.num[i], transparent: true, side: THREE.DoubleSide }));
      sign.applyMatrix4(M); sign.position.copy(c).add(signLocal.clone().applyMatrix4(new THREE.Matrix4().extractRotation(M))); scene.add(sign);
      // Lichtfleck auf dem Boden
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), g.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(c.x, .01, c.z); scene.add(fl);
      g.psd = 0; GATES.push(g);
    });
    scene.add(new THREE.Mesh(merge(pvcG), MAT.pvc), new THREE.Mesh(merge(metalG), MAT.metal));
  }

  /* ---------- Strecke für den Demo-Piloten und die Leuchtlinie am Boden ---------- */
  function buildPath() {
    const pts = [];
    COURSE.forEach((d, i) => {
      const g = GATES[i], a = d.t === 'flag' ? 1.6 : 1.8;
      (d.pre || []).forEach(p => pts.push(v3(p)));
      pts.push(g.c.clone().addScaledVector(g.n, -a), g.c.clone(), g.c.clone().addScaledVector(g.n, a));
      (d.post || []).forEach(p => pts.push(v3(p)));
    });
    demo.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    demo.len = demo.curve.getLength();
    // LED-Linie auf dem Boden (Projektion der Ideallinie)
    const N = Math.round(demo.len / .35), list = [], prev = new THREE.Vector3(), cur = new THREE.Vector3();
    demo.curve.getPointAt(0, prev);
    for (let k = 1; k <= N; k++) { demo.curve.getPointAt(k / N, cur); list.push([prev.x, prev.z, cur.x, cur.z]); prev.copy(cur); }
    MAT.led = new THREE.MeshBasicMaterial({ color: 0xff3fd8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    scene.add(new THREE.Mesh(FX.lineBuild(list, .035, .005), MAT.led));
    // weicher Schein daneben
    const pos = [], uv = [];
    for (const [x1, z1, x2, z2] of list) { const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * .3, nz = dx / l * .3;
      pos.push(x1 + nx, .006, z1 + nz, x2 + nx, .006, z2 + nz, x2 - nx, .006, z2 - nz, x1 + nx, .006, z1 + nz, x2 - nx, .006, z2 - nz, x1 - nx, .006, z1 - nz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    MAT.ledGlow = new THREE.MeshBasicMaterial({ map: TEX.strip, color: 0xff3fd8, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    ledGlow = new THREE.Mesh(gg, MAT.ledGlow); scene.add(ledGlow);
  }

  /* ---------- Kopter-Modelle (für die Verfolger-Ansicht und den Schatten) ---------- */
  function buildQuads() {
    const dark = new THREE.MeshLambertMaterial({ color: 0x1b1f27 }), prop = new THREE.MeshBasicMaterial({ color: 0xdfe8f5, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide });
    const cyan = new THREE.MeshLambertMaterial({ color: 0x2bc6e8 }), white = new THREE.MeshLambertMaterial({ color: 0xf2f4f7 }), amber = new THREE.MeshLambertMaterial({ color: 0xe2b23c });
    quadW = new THREE.Group();
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .022, 18, 1, true), cyan); duct.position.set(x * .034, 0, z * .034); duct.material.side = THREE.DoubleSide; quadW.add(duct);
      const p = new THREE.Mesh(new THREE.CircleGeometry(.029, 16), prop); p.rotation.x = -Math.PI / 2; p.position.set(x * .034, .004, z * .034); quadW.add(p);
    }
    const wb = new THREE.Mesh(new THREE.BoxGeometry(.034, .012, .034), dark); quadW.add(wb);
    const can = new THREE.Mesh(new THREE.BoxGeometry(.022, .016, .026), white); can.position.set(0, .013, 0); quadW.add(can);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .01), dark); cam.position.set(0, .016, -.016); quadW.add(cam);
    quadF = new THREE.Group();
    for (const r of [Math.PI / 4, -Math.PI / 4]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.25, .006, .022), dark); arm.rotation.y = r; quadF.add(arm); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .018, 10), cyan); m.position.set(x * .088, .012, z * .088); quadF.add(m);
      const p = new THREE.Mesh(new THREE.CircleGeometry(.064, 20), prop); p.rotation.x = -Math.PI / 2; p.position.set(x * .088, .024, z * .088); quadF.add(p);
    }
    const st = new THREE.Mesh(new THREE.BoxGeometry(.05, .028, .09), dark); st.position.y = .016; quadF.add(st);
    const bat = new THREE.Mesh(new THREE.BoxGeometry(.036, .03, .078), amber); bat.position.y = .046; quadF.add(bat);
    const cm = new THREE.Mesh(new THREE.BoxGeometry(.022, .022, .022), dark); cm.position.set(0, .02, -.052); quadF.add(cm);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.007, 10), new THREE.MeshBasicMaterial({ color: 0x3fe0ff })); lens.position.set(0, .02, -.064); quadF.add(lens);
    quad = new THREE.Group(); quad.add(quadW, quadF); scene.add(quad);
    shadowM = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0x000000, transparent: true, opacity: .5, depthWrite: false }));
    shadowM.rotation.x = -Math.PI / 2; scene.add(shadowM);
    // Funken beim Crash
    const sp = new THREE.BufferGeometry(); sp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
    FX.sparks = new THREE.Points(sp, new THREE.PointsMaterial({ color: 0xffc04a, size: .06, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    FX.sparkV = new Float32Array(28 * 3); FX.sparkT = 0; scene.add(FX.sparks);
  }

  function initGL() {
    if (!hasGL()) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: FINE && (W.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', stencil: false });
    } catch (e) { console.warn('Simulator: WebGL', e); return false; }
    ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a2c31, 30, 95);
    camera = new THREE.PerspectiveCamera(80, 1.6, .025, 120);
    hemi = new THREE.HemisphereLight(0xfff4e2, 0x5d5446, 2.3); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(5, 20, 9); scene.add(sun);
    makeTextures(); textTextures(null); buildHall(); buildCourse(); buildPath(); buildQuads();
    return true;
  }
  /* Schrift-Texturen, sobald die Vereinsschrift und das Logo geladen sind */
  function lateTextures() {
    const logo = new Image(); let done = false;
    const go = () => { if (done) return; done = true; run('Texte', () => textTextures(logo.complete && (logo.naturalWidth || logo.width) ? logo : null)); };
    logo.onload = logo.onerror = () => { const f = D.fonts && D.fonts.load ? Promise.all([D.fonts.load('400 100px "Bebas Neue"'), D.fonts.load('600 30px "Chakra Petch"')]) : Promise.resolve(); f.then(go, go); setTimeout(go, 2500); };
    logo.src = 'assets/img/logo-mark.svg';
  }

  /* =====================================================================
     Physik
     ===================================================================== */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const yawQ = (deg, out = new THREE.Quaternion()) => out.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -deg * DEG);

  function resetQuad() {
    const C = CR();
    P.pos.set(START.x, C.r, START.z); P.vel.set(0, 0, 0); yawQ(0, P.q); P.w.set(0, 0, 0);
    P.ppos.copy(P.pos); P.pq.copy(P.q);
    P.motor = 0; P.armed = false; P.armReq = !armSwitch(); P.crashed = 0; P.used = 0; P.flightT = 0; P.upsideT = 0; P.vcell = 4.2;
    race.next = 0; race.running = false; race.t0 = 0;
    for (const g of GATES) g.psd = _a.subVectors(P.pos, g.c).dot(g.n);
    paintGates(); shake = 0;
  }

  function physStep(dt) {
    const C = CR();
    // Akku
    P.used += Math.pow(P.motor, 1.5) * dt;
    const soc = clamp(1 - P.used / 70, 0, 1);
    P.vcell = 3.3 + .9 * Math.pow(soc, .55) - .3 * P.motor;
    // Gas → Motoren (mit Trägheit) → Schub
    const cmd = P.armed ? C.idle + (1 - C.idle) * thrCurve(IN.thr) : 0;
    P.motor += (cmd - P.motor) * (1 - Math.exp(-dt / C.tauM));
    const batF = .82 + .18 * clamp((P.vcell + .3 * P.motor - 3.3) / .9, 0, 1);
    P.thrust = C.tw * G * thrustK(P.motor) * batF;
    // Soll-Drehraten (Körper: x = Nicken, y = Gieren, z = Rollen)
    if (P.armed) {
      let rr = bfRate(IN.roll, S.rates.roll), pr = bfRate(IN.pitch, S.rates.pitch);
      const yr = bfRate(IN.yaw, S.rates.yaw);
      if (S.mode === 'angle') {
        _up.set(0, 1, 0).applyQuaternion(_qi.copy(P.q).invert());
        const curR = Math.atan2(-_up.x, _up.y) / DEG, curP = Math.atan2(_up.z, _up.y) / DEG, gain = S.level * 1.25;
        rr = clamp((IN.roll * S.maxAngle - curR) * gain, -720, 720);
        pr = clamp((IN.pitch * S.maxAngle - curP) * gain, -720, 720);
      }
      const k = 1 - Math.exp(-dt / C.tauR);
      P.w.x += (-pr * DEG - P.w.x) * k; P.w.y += (-yr * DEG - P.w.y) * k; P.w.z += (-rr * DEG - P.w.z) * k;
    } else P.w.multiplyScalar(Math.exp(-.6 * dt));
    // Lage weiterdrehen
    const wl = P.w.length();
    if (wl > 1e-7) { _q.setFromAxisAngle(_a.copy(P.w).divideScalar(wl), wl * dt); P.q.multiply(_q).normalize(); }
    // Kräfte: Schub entlang der Hochachse, Schwerkraft, Luftwiderstand (flach mehr als von vorn)
    _up.set(0, 1, 0).applyQuaternion(P.q);
    const sp = P.vel.length(), kd = C.kLin + C.kQuad * sp, vu = P.vel.dot(_up);
    _a.copy(_up).multiplyScalar(P.thrust);
    _a.y -= G;
    _b.copy(P.vel).addScaledVector(_up, vu * .5).multiplyScalar(-kd);
    _a.add(_b);
    P.vel.addScaledVector(_a, dt);
    P.pos.addScaledVector(P.vel, dt);
    // Kollisionen
    P.ground = false; collide();
    if (P.crashed) return;
    // Am Boden: liegen bleiben, gerade setzen, umgekippt erkennen
    if (P.ground && P.thrust < G * .98) {
      _up.set(0, 1, 0).applyQuaternion(P.q);
      if (_up.y > .3) {
        _b.set(0, 0, -1).applyQuaternion(P.q); const hdg = Math.atan2(_b.x, -_b.z) / DEG;
        P.q.slerp(yawQ(hdg, _q), 1 - Math.exp(-12 * dt)); P.w.x *= Math.exp(-30 * dt); P.w.z *= Math.exp(-30 * dt);
        P.upsideT = 0;
      } else if (P.vel.lengthSq() < 1) { P.upsideT += dt; if (P.upsideT > 1.2) crash('UMGEKIPPT'); }
      const f = Math.exp(-6 * dt); P.vel.x *= f; P.vel.z *= f;
    }
    if (P.armed) P.flightT += dt;
    checkGates();
  }

  function collide() {
    const C = CR(), r = C.r, p = P.pos;
    if (p.y < r) hit(0, 1, 0, r - p.y, true);
    if (p.y > CEIL - r) hit(0, -1, 0, p.y - (CEIL - r), false);
    if (p.x > HX - r) hit(-1, 0, 0, p.x - (HX - r), false);
    if (p.x < -HX + r) hit(1, 0, 0, -HX + r - p.x, false);
    if (p.z > HZ - r) hit(0, 0, -1, p.z - (HZ - r), false);
    if (p.z < -HZ + r) hit(0, 0, 1, -HZ + r - p.z, false);
    for (let i = 0; i < COLL.length && !P.crashed; i++) {
      const b = COLL[i], dx = p.x - b.cx, dy = p.y - b.cy, dz = p.z - b.cz, rr = b.br + r;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      const a = b.a, lx = dx * a[0] + dy * a[1] + dz * a[2], ly = dx * a[3] + dy * a[4] + dz * a[5], lz = dx * a[6] + dy * a[7] + dz * a[8];
      let ex = lx - clamp(lx, -b.hx, b.hx), ey = ly - clamp(ly, -b.hy, b.hy), ez = lz - clamp(lz, -b.hz, b.hz), pen;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > r * r) continue;
      if (d2 > 1e-12) { const d = Math.sqrt(d2); ex /= d; ey /= d; ez /= d; pen = r - d; }
      else { const px = b.hx - Math.abs(lx), py = b.hy - Math.abs(ly), pz = b.hz - Math.abs(lz); ex = ey = ez = 0;
        if (px <= py && px <= pz) { ex = lx < 0 ? -1 : 1; pen = r + px; } else if (py <= pz) { ey = ly < 0 ? -1 : 1; pen = r + py; } else { ez = lz < 0 ? -1 : 1; pen = r + pz; } }
      const nx = ex * a[0] + ey * a[3] + ez * a[6], ny = ex * a[1] + ey * a[4] + ez * a[7], nz = ex * a[2] + ey * a[5] + ez * a[8];
      hit(nx, ny, nz, pen, ny > .7);
    }
  }
  function hit(nx, ny, nz, pen, floorish) {
    const C = CR();
    P.pos.x += nx * pen; P.pos.y += ny * pen; P.pos.z += nz * pen;
    if (floorish) P.ground = true;
    const vn = P.vel.x * nx + P.vel.y * ny + P.vel.z * nz;
    if (vn >= 0) return;
    const imp = -vn;
    if (imp > C.crash) { crash('CRASH'); return; }
    const e = floorish && imp < 1.5 ? 0 : C.rest;
    P.vel.x -= nx * vn * (1 + e); P.vel.y -= ny * vn * (1 + e); P.vel.z -= nz * vn * (1 + e);
    const vn2 = P.vel.x * nx + P.vel.y * ny + P.vel.z * nz, f = floorish ? .1 : .22;
    P.vel.x = nx * vn2 + (P.vel.x - nx * vn2) * (1 - f); P.vel.y = ny * vn2 + (P.vel.y - ny * vn2) * (1 - f); P.vel.z = nz * vn2 + (P.vel.z - nz * vn2) * (1 - f);
    if (imp > 1.2) { const k = imp * C.kick; P.w.x += (Math.random() - .5) * k; P.w.y += (Math.random() - .5) * k * .5; P.w.z += (Math.random() - .5) * k; if (!RM) shake = Math.max(shake, Math.min(.5, imp * .06)); }
  }
  function crash(text) {
    if (P.crashed) return;
    P.crashed = 1.05; P.armed = false; P.motor = 0; P.crashMsg = text;
    stage.classList.remove('is-crash'); void stage.offsetWidth; stage.classList.add('is-crash');
    if (!RM) shake = .6;
    // Funken
    const a = FX.sparks.geometry.attributes.position.array;
    for (let i = 0; i < 28; i++) { a[i * 3] = P.pos.x; a[i * 3 + 1] = P.pos.y; a[i * 3 + 2] = P.pos.z; FX.sparkV[i * 3] = (Math.random() - .5) * 5; FX.sparkV[i * 3 + 1] = Math.random() * 4; FX.sparkV[i * 3 + 2] = (Math.random() - .5) * 5; }
    FX.sparks.geometry.attributes.position.needsUpdate = true; FX.sparkT = .9;
    race.running = false;
  }

  /* ---------- Gates durchfliegen, Runden ---------- */
  function checkGates() {
    for (const g of GATES) {
      const sd = _a.subVectors(P.pos, g.c).dot(g.n), psd = g.psd; g.psd = sd;
      if (!(psd < 0 && sd >= 0) || psd < -4) continue;
      const t = psd / (psd - sd);
      _b.lerpVectors(P.ppos, P.pos, t).sub(g.c);
      const lu = _b.dot(g.u), lv = _b.dot(g.v);
      const inside = g.t === 'ring' ? lu * lu + lv * lv < g.rr * g.rr : Math.abs(lu) < g.hw && Math.abs(lv) < g.hh;
      if (inside) passGate(g);
    }
  }
  function passGate(g) {
    const N = GATES.length;
    if (demo.on) { g.flash = .7; race.next = (g.i + 1) % N; paintGates(); return; }
    if (g.i !== race.next) {
      if (race.running || g.i !== 0) { flashMsg(race.running ? `GATE ${race.next + 1} VERPASST` : 'START DURCH GATE 1', 'warn', 1.8); race.missT = 2.5; }
      return;
    }
    g.flash = .7;
    if (g.i === 0) {
      if (race.running) lapDone((simT - race.t0) * 1000);
      race.running = true; race.t0 = simT; race.next = 1;
    } else race.next = (g.i + 1) % N;
    paintGates();
  }
  function lapDone(ms) {
    race.last = ms; race.laps++;
    const isBest = onLap(ms, { craft: S.craft, mode: S.mode, input: IN.src === 'pad' ? (padKind() || 'pad') : IN.src, rates: JSON.parse(JSON.stringify(S.rates)), date: new Date().toISOString() });
    flashMsg(isBest ? 'NEUE BESTZEIT ' + fmtLap(ms) : 'RUNDE ' + fmtLap(ms), isBest ? 'good' : '', 2.4);
    if (isBest) { drawScore(); renderBest(); }
    if (race.laps === 1) hideHelp();
  }
  function paintGates() {
    const N = GATES.length;
    for (const g of GATES) {
      const k = (g.i - race.next + N) % N;
      const col = k === 0 ? C_NEXT : k === 1 ? C_AFTER : C_IDLE;
      g.base = col; g.rank = k;
      g.frame.color.copy(col); g.glow.color.copy(col); g.floor.color.copy(col);
    }
  }
  function animGates(dt, t) {
    const dark = S.light === 'off';
    for (const g of GATES) {
      let op = g.rank === 0 ? .62 + .3 * Math.sin(t * 5.5) : g.rank === 1 ? .32 : .13;
      if (RM && g.rank === 0) op = .8;
      if (dark) op = Math.min(1, op * 1.6 + .1);
      if (g.flash > 0) { g.flash -= dt; const f = clamp(g.flash / .7, 0, 1); g.frame.color.copy(g.base).lerp(C_PASS, f); g.glow.color.copy(g.frame.color); op = Math.max(op, f); if (g.flash <= 0) { g.frame.color.copy(g.base); g.glow.color.copy(g.base); } }
      g.glow.opacity = op; g.floor.opacity = (dark ? .9 : .28) * (g.rank === 0 ? 1 : .55);
    }
  }

  /* ---------- Demo-Pilot: fliegt die Ideallinie, Lage aus der nötigen Schubrichtung ---------- */
  const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
  function demoStep(dt) {
    const C = CR(), v = C.demoV, h = .12, wrap = (u) => ((u % 1) + 1) % 1;
    demo.u = wrap(demo.u + v * dt / demo.len);
    const du = v * h / demo.len;
    demo.curve.getPointAt(wrap(demo.u - du), _p0); demo.curve.getPointAt(demo.u, _p1); demo.curve.getPointAt(wrap(demo.u + du), _p2);
    const vel = _a.subVectors(_p2, _p0).divideScalar(2 * h);
    const acc = _b.copy(_p2).sub(_p1).sub(_p1).add(_p0).divideScalar(h * h);
    const sp = vel.length();
    acc.y += G; acc.addScaledVector(vel, C.kLin + C.kQuad * sp);
    const T = acc.length();
    demo.up.lerp(acc.normalize(), 1 - Math.exp(-dt * 9)).normalize();
    _f.copy(vel).addScaledVector(demo.up, -vel.dot(demo.up)).normalize();
    _r.crossVectors(_f, demo.up).normalize(); _f.crossVectors(demo.up, _r);
    _m.makeBasis(_r, demo.up, _f.negate());
    P.ppos.copy(P.pos); P.pq.copy(P.q);
    P.pos.copy(_p1); P.vel.copy(vel); P.q.setFromRotationMatrix(_m);
    const x = T / (C.tw * G); P.motor = clamp((-0.4 + Math.sqrt(.16 + 2.4 * x)) / 1.2, 0, 1);
    P.armed = true; P.vcell = 4.05 - .3 * P.motor; P.flightT += dt;
    checkGates();
  }

  /* =====================================================================
     Eingabe: Tastatur, Touch, Gamepad/Funke
     ===================================================================== */
  /* ---------- Tastatur ---------- */
  const KEYS = new Set(), KB = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
  const FLIGHT_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const keyTarget = () => { const a = D.activeElement; return isFull || a === stage || (a && stage.contains(a) && a.tagName === 'BUTTON'); };
  W.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || !keyTarget()) return;
    const onBtn = D.activeElement !== stage && D.activeElement && D.activeElement.tagName === 'BUTTON';
    const c = e.code;
    if (FLIGHT_KEYS.includes(c) || c === 'ShiftLeft' || c === 'ShiftRight') { if (c.startsWith('Arrow')) e.preventDefault(); KEYS.add(c); if (FLIGHT_KEYS.includes(c)) activity('key'); return; }
    if (e.repeat) return;
    if (c === 'Space' && !onBtn) { e.preventDefault(); activity('key'); toggleArm(); }
    else if (c === 'KeyR') { activity('key'); doReset(); }
    else if (c === 'KeyM') toggleMode();
    else if (c === 'KeyC') toggleView();
    else if (c === 'KeyF') toggleFull();
    else if (c === 'Escape' && isFull && !D.fullscreenElement) setFull(false);
  });
  W.addEventListener('keyup', e => KEYS.delete(e.code));
  stage.addEventListener('blur', () => { setTimeout(() => { if (!keyTarget()) KEYS.clear(); }, 0); });
  W.addEventListener('blur', () => KEYS.clear());
  function keyTick(dt) {
    const sh = KEYS.has('ShiftLeft') || KEYS.has('ShiftRight'), k = sh ? 1 : .7;
    if (KEYS.has('KeyW')) KB.thr = clamp(KB.thr + dt * (sh ? 1.1 : .5), 0, 1);
    if (KEYS.has('KeyS')) KB.thr = clamp(KB.thr - dt * (sh ? 1.5 : .7), 0, 1);
    const ramp = (cur, tgt) => cur + (tgt - cur) * (1 - Math.exp(-dt * (tgt ? 9 : 14)));
    KB.yaw = ramp(KB.yaw, ((KEYS.has('KeyD') ? 1 : 0) - (KEYS.has('KeyA') ? 1 : 0)) * k);
    KB.pitch = ramp(KB.pitch, ((KEYS.has('ArrowUp') ? 1 : 0) - (KEYS.has('ArrowDown') ? 1 : 0)) * k);
    KB.roll = ramp(KB.roll, ((KEYS.has('ArrowRight') ? 1 : 0) - (KEYS.has('ArrowLeft') ? 1 : 0)) * k);
  }

  /* ---------- Touch-Sticks (Mehrfinger per Pointer Events) ---------- */
  const TCH = { thr: 0, yaw: 0, pitch: 0, roll: 0, R: 64, l: { id: null }, r: { id: null }, moves: 0, hzT: 0, hz: 0 };
  const zones = { l: $('.st-l', stage), r: $('.st-r', stage) };
  function stickLayout() {
    const zr = zones.l.getBoundingClientRect(); if (!zr.width) return;
    TCH.R = clamp(Math.min(zr.width * 2, zr.height + 64) * .14, 46, 78);
    stage.style.setProperty('--sr', (TCH.R * 2) + 'px');
    if (TCH.l.id == null) placeStick('l', TCH.R + 30, zr.height - TCH.R - 24);
    if (TCH.r.id == null) placeStick('r', zr.width - TCH.R - 30, zr.height - TCH.R - 24);
    drawSticks();
  }
  function placeStick(s, x, y) { TCH[s].bx = x; TCH[s].by = y; }
  function drawSticks() {
    const R = TCH.R;
    for (const s of ['l', 'r']) {
      const z = zones[s], b = z.firstElementChild, k = b.firstElementChild, st = TCH[s];
      b.style.transform = `translate(${st.bx}px,${st.by}px)`;
      const kx = s === 'l' ? TCH.yaw * R : TCH.roll * R, ky = s === 'l' ? -(TCH.thr * 2 - 1) * R : -TCH.pitch * R;
      k.style.transform = `translate(${kx}px,${ky}px)`;
    }
  }
  for (const s of ['l', 'r']) {
    const z = zones[s];
    z.addEventListener('pointerdown', e => {
      const st = TCH[s]; if (st.id != null) return;
      e.preventDefault(); st.id = e.pointerId; try { z.setPointerCapture(e.pointerId); } catch (er) { }
      const r = z.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      st.x0 = x; st.y0 = y;
      if (s === 'l') { st.t0 = TCH.thr; placeStick('l', x, y + (TCH.thr * 2 - 1) * TCH.R); }
      else placeStick('r', x, y);
      z.classList.add('on'); activity('touch'); drawSticks();
    });
    z.addEventListener('pointermove', e => {
      const st = TCH[s]; if (st.id !== e.pointerId) return;
      const r = z.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = TCH.R;
      if (s === 'l') { TCH.thr = clamp(st.t0 + (st.y0 - y) / (2 * R), 0, 1); TCH.yaw = clamp((x - st.x0) / R, -1, 1); }
      else { TCH.roll = clamp((x - st.x0) / R, -1, 1); TCH.pitch = clamp((st.y0 - y) / R, -1, 1); }
      TCH.moves++; activity('touch'); drawSticks();
    });
    const up = e => {
      const st = TCH[s]; if (st.id !== e.pointerId) return; st.id = null; z.classList.remove('on');
      if (s === 'l') TCH.yaw = 0; else { TCH.roll = 0; TCH.pitch = 0; }
      stickLayout();
    };
    z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up); z.addEventListener('lostpointercapture', up);
  }
  stage.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && live) setTouch(true); });
  function setTouch(on) { stage.classList.toggle('is-touch', on); if (on) { IN.src = 'touch'; requestAnimationFrame(stickLayout); updateSrc(); } }

  /* ---------- Gamepad API ---------- */
  const PADS = { st: {}, maps: store.get('fcs-sim-pads', {}), sel: 'auto', idx: -1, hz: 0, hzList: [], lastTs: 0, timer: 0, edges: [] };
  if (!PADS.maps || typeof PADS.maps !== 'object') PADS.maps = {};
  const padsSupported = !!navigator.getGamepads;
  const getPads = () => { try { return padsSupported ? [...navigator.getGamepads()].filter(Boolean) : []; } catch (e) { return []; } };
  const padByIdx = (i) => getPads().find(p => p.index === i) || null;
  const padName = (gp) => { let n = gp.id.replace(/\((?:[^)]*?)(?:vendor|product|STANDARD GAMEPAD)[^)]*\)/ig, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').replace(/\s+/g, ' ').trim(); return n || 'Controller'; };
  const isStd = (gp) => gp.mapping === 'standard';
  const padMap = (gp) => PADS.maps[gp.id] || null;
  const padKind = () => { const gp = padByIdx(PADS.idx); return gp ? (padMap(gp) ? 'funke' : isStd(gp) ? 'controller' : 'funke-ungeprüft') : null; };
  /* Vermutung für Funken ohne Einrichtung: AETR (Achse 0 Roll, 1 Pitch, 2 Gas, 3 Yaw) */
  const GUESS = { thr: { i: 2, lo: -1, hi: 1 }, yaw: { i: 3, c: 0, e: 1 }, pitch: { i: 1, c: 0, e: 1 }, roll: { i: 0, c: 0, e: 1 } };
  function readPad(gp) {
    const a = gp.axes, out = { thr: 0, yaw: 0, pitch: 0, roll: 0, arm: null, mode: null };
    const map = padMap(gp), dz = S.dz;
    const dzf = (v) => { const m = Math.abs(v); return m <= dz ? 0 : Math.sign(v) * (m - dz) / (1 - dz); };
    if (!map && isStd(gp)) {
      out.thr = clamp((1 - (a[1] || 0)) / 2, 0, 1); out.yaw = dzf(a[0] || 0); out.pitch = dzf(-(a[3] || 0)); out.roll = dzf(a[2] || 0);
      return out;
    }
    const m = map || GUESS, ax = (o) => (o && a[o.i] != null ? a[o.i] : null);
    const t = ax(m.thr); if (t != null && m.thr.hi !== m.thr.lo) out.thr = clamp((t - m.thr.lo) / (m.thr.hi - m.thr.lo), 0, 1);
    for (const k of ['yaw', 'pitch', 'roll']) { const v = ax(m[k]); if (v != null && m[k].e) out[k] = dzf(clamp((v - m[k].c) / m[k].e, -1, 1)); }
    const sw = (o) => { if (!o) return null; const v = o.type === 'btn' ? (gp.buttons[o.i] && gp.buttons[o.i].pressed ? 1 : 0) : a[o.i]; if (v == null) return null; return Math.abs(v - o.on) < Math.abs(v - o.off); };
    if (map) { out.arm = sw(map.arm); if (map.mode) { const on = sw({ type: map.mode.type, i: map.mode.i, on: map.mode.angle, off: map.mode.acro }); out.mode = on == null ? null : on ? 'angle' : 'acro'; } }
    return out;
  }
  const PADIN = { thr: 0, yaw: 0, pitch: 0, roll: 0, arm: null, mode: null };
  let lastArmSw = null, lastModeSw = null;
  const armSwitch = () => { const gp = padByIdx(PADS.idx); const m = gp && padMap(gp); return !!(m && m.arm) && IN.src === 'pad'; };
  function pollPads() {
    const list = getPads(), tnow = performance.now();
    for (const gp of list) {
      let st = PADS.st[gp.index];
      if (!st || st.id !== gp.id) { st = PADS.st[gp.index] = { id: gp.id, first: gp.axes.slice(), prev: gp.axes.slice(), btn: gp.buttons.map(b => b.pressed), seen: tnow }; padConnected(gp); }
      let act = false, big = false;
      for (let i = 0; i < gp.axes.length; i++) { const d = Math.abs(gp.axes[i] - st.prev[i]); if (d > .02) act = true; if (Math.abs(gp.axes[i] - st.first[i]) > .3) big = true; st.prev[i] = gp.axes[i]; }
      const edges = [];
      gp.buttons.forEach((b, i) => { if (b.pressed !== st.btn[i]) { act = true; if (b.pressed) { edges.push(i); big = true; } st.btn[i] = b.pressed; } });
      if (act) st.last = tnow;
      if (PADS.sel === 'auto' ? act && (big || PADS.idx === gp.index) : PADS.sel === String(gp.index)) { if (PADS.idx !== gp.index) { PADS.idx = gp.index; updateSrc(); } }
      if (gp.index === PADS.idx && !WIZ.on) {
        const wasLive = live;
        if (act && big) { activity('pad'); }
        if (wasLive && IN.src === 'pad') { if (isStd(gp) && !padMap(gp)) PADS.edges.push(...edges); else if (edges.includes(9)) PADS.edges.push(9); }
      }
    }
    // getrennte Geräte aufräumen
    for (const k of Object.keys(PADS.st)) if (!list.find(g => String(g.index) === k)) { delete PADS.st[k]; if (String(PADS.idx) === k) { PADS.idx = -1; if (IN.src === 'pad') IN.src = COARSE && !FINE ? 'touch' : 'key'; updateSrc(); toast('Controller getrennt'); } fillPadSelect(); }
    const gp = padByIdx(PADS.idx);
    if (gp) Object.assign(PADIN, readPad(gp));
  }
  function btnEdge(i) {
    if (i === 0) toggleArm(); else if (i === 1) doReset(); else if (i === 3) toggleMode(); else if (i === 2) toggleView(); else if (i === 9) start(false);
  }
  /* Echte Abtastrate: wie oft sich timestamp/Werte des aktiven Geräts ändern (unabhängig von der Bildrate gemessen) */
  function hzPoll() {
    const gp = padByIdx(PADS.idx); if (!gp) return;
    const ts = gp.timestamp; if (!ts || ts === PADS.lastTs) return;
    if (PADS.lastTs) { const d = ts - PADS.lastTs; if (d > 0 && d < 120) { PADS.hzList.push(d); if (PADS.hzList.length > 60) PADS.hzList.shift(); } }
    PADS.lastTs = ts; PADS.hzSeen = performance.now();
  }
  function hzValue() {
    if (IN.src === 'touch') return TCH.hz;
    if (IN.src !== 'pad' || !PADS.hzList.length || performance.now() - (PADS.hzSeen || 0) > 1500) return 0;
    const s = PADS.hzList.slice().sort((a, b) => a - b), med = s[s.length >> 1];
    return med > 0 ? Math.round(1000 / med) : 0;
  }
  W.addEventListener('gamepadconnected', e => { run('connect', () => { pollPads(); fillPadSelect(); }); });
  W.addEventListener('gamepaddisconnected', () => run('disconnect', () => { pollPads(); fillPadSelect(); }));
  function padConnected(gp) {
    fillPadSelect();
    const map = padMap(gp), name = padName(gp);
    if (isStd(gp) || map) toast((isStd(gp) && !map ? 'Controller' : 'Funke') + ' erkannt: ' + name);
    else { toast('Funke erkannt: ' + name + '. Bitte einmal einrichten.'); wizBtn.classList.add('pulse'); }
    if (PADS.idx < 0) PADS.idx = gp.index;
    updateSrc();
  }

  /* ---------- Aktive Eingabe auswählen ---------- */
  function activity(src) {
    IN.lastAct = performance.now();
    if (src !== IN.src) { IN.src = src; if (src === 'touch') setTouch(true); else if (src === 'pad' || (src === 'key' && FINE)) stage.classList.remove('is-touch'); updateSrc(); }
    if (demo.on && src !== 'touch') takeover();
    if (src !== 'touch' && FINE && overStage) D.documentElement.classList.add('sim-hidecur');
  }
  let overStage = false;
  stage.addEventListener('pointerenter', () => { overStage = true; });
  stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') D.documentElement.classList.remove('sim-hidecur'); });
  stage.addEventListener('pointerleave', () => { overStage = false; D.documentElement.classList.remove('sim-hidecur'); });
  function composeInput() {
    const s = IN.src === 'pad' && PADS.idx >= 0 ? PADIN : IN.src === 'touch' ? TCH : KB;
    IN.thr = s.thr; IN.yaw = s.yaw; IN.pitch = s.pitch; IN.roll = s.roll;
    // Schalter der Funke
    if (IN.src === 'pad' && live && !WIZ.on) {
      if (PADIN.mode && PADIN.mode !== lastModeSw) { lastModeSw = PADIN.mode; if (S.mode !== PADIN.mode) setMode(PADIN.mode); }
      if (PADIN.arm != null) {
        if (PADIN.arm && !P.armed && !P.crashed) { if (IN.thr <= .05) arm(true); else if (lastArmSw !== true || !msg.t) flashMsg('GAS RUNTER ZUM ARMEN', 'warn', .6); }
        if (!PADIN.arm && P.armed) arm(false);
        lastArmSw = PADIN.arm;
      }
    }
  }

  /* =====================================================================
     Bedienung: Armen, Modus, Kopter, Ansicht, Reset, Vollbild, Start
     ===================================================================== */
  function arm(on) {
    if (on && P.crashed) return;
    if (on && IN.thr > .05) { P.armReq = true; flashMsg('GAS RUNTER ZUM ARMEN', 'warn', 1.5); return; }
    P.armed = on; P.armReq = false; flashMsg(on ? 'ARMED' : 'DISARMED', on ? 'good' : '', 1);
    btns.arm.setAttribute('aria-pressed', String(on));
    if (on) stage.classList.add('is-flying');
  }
  function toggleArm() { if (!live) { start(false); return; } if (P.armed) { P.armReq = false; arm(false); } else arm(true); }
  function doReset() { if (!live) return; resetQuad(); flashMsg('RESET', '', .8); btns.arm.setAttribute('aria-pressed', 'false'); }
  function setMode(m) { S.mode = m; saveSettings(); applyMode(); flashMsg(m === 'acro' ? 'ACRO' : 'ANGLE', m === 'acro' ? 'warn' : 'good', 1); }
  function toggleMode() { setMode(S.mode === 'acro' ? 'angle' : 'acro'); }
  function toggleView() { S.view = S.view === 'fpv' ? 'chase' : 'fpv'; saveSettings(); applyView(); }
  function toggleCraft() { S.craft = S.craft === 'whoop' ? 'five' : 'whoop'; saveSettings(); applyCraft(); }

  function takeover() {
    if (!gl) return;
    demo.on = false; live = true;
    stage.classList.remove('is-demo'); stage.classList.add('is-live');
    cta.hidden = true;
    resetQuad(); simT = 0; race.laps = 0; race.last = 0;
    if (IN.src === 'touch' || (COARSE && !FINE)) setTouch(true);
    showHelp();
  }
  function start(fromBtn) {
    if (!gl) { selectTab(0); FCS_scroll(panel); return; }
    const wasDemo = !live;
    if (wasDemo) takeover();
    if (fromBtn) {
      if (COARSE && !FINE) setFull(true);
      else FCS_scroll(stage);
      try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    }
    if (!wasDemo && P.crashed === 0 && !P.armed) arm(true);
  }
  function FCS_scroll(el) { if (W.FCS && FCS.scrollTo) FCS.scrollTo(el, -86); else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
  function backToDemo() {
    if (RM || !gl) return;
    live = false; demo.on = true; P.armed = false; stage.classList.add('is-demo'); stage.classList.remove('is-live', 'is-flying'); cta.hidden = false; hideHelp();
    race.next = 0; paintGates();
  }

  /* ---------- Vollbild (echtes Vollbild, sonst nachgebaut) ---------- */
  function setFull(on) {
    if (on === isFull) return;
    isFull = on;
    app.classList.toggle('is-full', on); D.documentElement.classList.toggle('sim-lock', on);
    btns.full.setAttribute('aria-pressed', String(on));
    if (on) {
      app.classList.remove('panel-open');
      const req = app.requestFullscreen || app.webkitRequestFullscreen;
      if (req) { try { const p = req.call(app, { navigationUI: 'hide' }); if (p && p.then) p.then(lockLandscape, () => { }); else lockLandscape(); } catch (e) { } }
      try { stage.focus({ preventScroll: true }); } catch (e) { }
      if (COARSE && W.innerHeight > W.innerWidth) toast('Dreh dein Handy quer, dann siehst du mehr.');
    } else {
      app.classList.remove('panel-open');
      if (W.innerWidth > 1100) app.classList.toggle('no-panel', !panelWanted);
      if (D.fullscreenElement || D.webkitFullscreenElement) { try { (D.exitFullscreen || D.webkitExitFullscreen).call(D); } catch (e) { } }
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { }
    }
    syncPanelBtn(); setTimeout(resize, 60); setTimeout(stickLayout, 120);
  }
  function lockLandscape() { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  function toggleFull() { setFull(!isFull); }
  const fsChange = () => { const fe = D.fullscreenElement || D.webkitFullscreenElement; if (!fe && isFull) setFull(false); };
  D.addEventListener('fullscreenchange', fsChange); D.addEventListener('webkitfullscreenchange', fsChange);

  /* ---------- Einstellungen ein- und ausblenden ---------- */
  let panelWanted = true;
  function togglePanel() {
    const narrow = W.innerWidth <= 1100;
    if (isFull && narrow) { app.classList.toggle('panel-open'); app.classList.remove('no-panel'); }
    else if (!isFull && narrow) { FCS_scroll(panel); }
    else { panelWanted = app.classList.contains('no-panel'); app.classList.toggle('no-panel', !panelWanted); setTimeout(resize, 30); }
    syncPanelBtn();
  }
  function syncPanelBtn() {
    const narrow = W.innerWidth <= 1100;
    const open = isFull && narrow ? app.classList.contains('panel-open') : narrow ? true : !app.classList.contains('no-panel');
    btns.panel.setAttribute('aria-expanded', String(open));
  }

  /* =====================================================================
     OSD, Hinweise, Meldungen
     ===================================================================== */
  function flashMsg(t, cls = '', sec = 1.2) { msg = { t, cls, until: performance.now() + sec * 1000 }; }
  let toastT = 0;
  function toast(t, ms = 3200) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); }
  function showHelp() {
    const t = { key: 'W gibt Gas, die Pfeiltasten lenken. Leertaste armt. Das nächste Gate leuchtet hell.', touch: 'Linken Stick hochschieben gibt Gas, der rechte Stick lenkt. Das nächste Gate leuchtet hell.', pad: padKind() === 'controller' ? 'Linker Stick hoch gibt Gas, Kreuz oder A armt. Das nächste Gate leuchtet hell.' : 'Gas ganz runter, dann armen (Schalter, Leertaste oder automatisch). Das nächste Gate leuchtet hell.' }[IN.src] || '';
    $('[data-help-t]', helpEl).textContent = t; helpEl.hidden = !t;
  }
  function hideHelp() { helpEl.hidden = true; }
  $('[data-help-x]', helpEl).addEventListener('click', () => { hideHelp(); try { stage.focus({ preventScroll: true }); } catch (e) { } });

  const _hp = new THREE.Vector3(), _cr = new THREE.Vector3(), _cu = new THREE.Vector3();
  let osdT = 0, fpsShown = 0, lastOsd = {};
  const setO = (k, v, cls) => { const n = O[k]; if (!n) return; if (lastOsd[k] !== v) { n.textContent = v; lastOsd[k] = v; } if (cls !== undefined && n._c !== cls) { n.className = cls; n._c = cls; } };
  function osdTick(dt) {
    osdT -= dt;
    // Horizont und Pfeil jedes Bild (nur transform)
    if (renderer && stageVis) horizonArrow();
    if (osdT > 0) return; osdT = 1 / 12;
    const C = CR();
    P.vdisp += (P.vcell * C.cells - P.vdisp) * .35;
    const low = P.vcell < 3.5;
    setO('mode', S.mode === 'acro' ? 'ACRO' : 'ANGLE', S.mode === 'acro' ? 'warn' : '');
    setO('craft', C.osd);
    setO('bat', (low ? 'LOW ' : '') + P.vdisp.toFixed(2) + 'V', low ? 'warn' : '');
    setO('gate', `GATE ${race.running ? race.next || GATES.length : 0}/${GATES.length}`);
    const lapMs = race.running ? (simT - race.t0) * 1000 : 0;
    setO('lap', fmtLap(lapMs).replace('--:--.--', '0:00.00'));
    const b = best[S.craft + '-' + S.mode];
    setO('laps', `LAST ${fmtLap(race.last)} · BEST ${fmtLap(b)}`);
    const thr = demo.on ? clamp((P.motor - C.idle) / (1 - C.idle), 0, 1) : IN.thr;
    setO('thr', 'THR ' + Math.round(thr * 100) + '%');
    setO('spd', Math.round(P.vel.length() * 3.6) + ' KM/H');
    setO('alt', 'ALT ' + Math.max(0, P.pos.y - C.r).toFixed(1) + 'M');
    setO('fps', (fpsShown || '--') + ' FPS');
    const hz = hzValue(); setO('hz', IN.src === 'key' ? 'IN TASTATUR' : 'IN ' + (hz ? hz : '--') + ' HZ', hz && hz < 50 ? 'warn' : '');
    setO('time', fmtClock(P.flightT));
    // Meldung in der Mitte
    let m = '', cls = '';
    const tnow = performance.now();
    if (demo.on) { m = 'DEMO'; cls = 'blink'; }
    else if (P.crashed) { m = P.crashMsg; cls = 'bad blink'; }
    else if (msg.t && tnow < msg.until) { m = msg.t; cls = msg.cls; }
    else if (live && !P.armed) { if (IN.thr > .05 && (P.armReq || armSwitch())) { m = 'GAS RUNTER ZUM ARMEN'; cls = 'warn blink'; } else { m = 'DISARMED'; cls = 'blink'; } }
    else if (low) { m = 'LOW BATTERY'; cls = 'warn blink'; }
    setO('msg', m, 'o-msg ' + cls);
    // Bedienleiste
    const tm = $('[data-mode-t]', stage); if (tm.textContent !== (S.mode === 'acro' ? 'Acro' : 'Angle')) tm.textContent = S.mode === 'acro' ? 'Acro' : 'Angle';
    btns.arm.setAttribute('aria-pressed', String(!!(P.armed && live)));
  }
  function horizonArrow() {
    const hor = O.hor, ar = O.arrow, w = stage.clientWidth, h = stage.clientHeight;
    if (S.view === 'fpv') {
      _cr.set(1, 0, 0).applyQuaternion(camera.quaternion); _cu.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _f.set(0, 0, -1).applyQuaternion(camera.quaternion); _f.y = 0;
      if (_f.lengthSq() > 1e-4) {
        _hp.copy(camera.position).addScaledVector(_f.normalize(), 500).project(camera);
        const sx = _hp.x * w / 2, sy = -_hp.y * h / 2, roll = Math.atan2(_cr.y, _cu.y);
        const vis = _hp.z < 1 && Math.abs(sy) < h * .32 && Math.abs(sx) < w * .3;
        hor.style.opacity = vis ? '' : '0';
        if (vis) hor.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) rotate(${roll.toFixed(4)}rad)`;
      }
    }
    // Pfeil zum nächsten Gate, wenn es nicht im Bild ist
    const g = GATES[race.next];
    if (!g || demo.on || !live) { ar.classList.remove('on'); return; }
    _hp.copy(g.c).project(camera);
    let x = _hp.x, y = _hp.y; const behind = _hp.z > 1;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > .92 || Math.abs(y) > .9;
    ar.classList.toggle('on', off);
    if (off) {
      const ang = Math.atan2(-y, x), ex = w / 2 + Math.cos(ang) * (w / 2 - 46), ey = h / 2 + Math.sin(ang) * (h / 2 - 60);
      ar.firstElementChild.style.transform = `rotate(${(ang + Math.PI / 2).toFixed(3)}rad)`;
      ar.style.transform = `translate(${ex.toFixed(0)}px,${ey.toFixed(0)}px)`;
      if (O.arrown.textContent !== String(g.i + 1)) O.arrown.textContent = String(g.i + 1);
    }
  }

  /* =====================================================================
     Kamera und Bild
     ===================================================================== */
  const RP = new THREE.Vector3(), RQ = new THREE.Quaternion(), tiltQ = new THREE.Quaternion(), chasePos = new THREE.Vector3(-8, 1.2, 19), _look = new THREE.Vector3();
  let curFovH = 0, curAspect = 0;
  function setFov() {
    const a = camera.aspect, hf = S.fov * DEG;
    let vf = 2 * Math.atan(Math.tan(hf / 2) / a) / DEG;
    if (S.view === 'chase') vf = clamp(vf * .78, 50, 90);
    camera.fov = clamp(vf, 40, 112); camera.updateProjectionMatrix(); curFovH = S.fov; curAspect = a;
  }
  function render(alpha, dt) {
    const C = CR();
    RP.lerpVectors(P.ppos, P.pos, alpha); RQ.slerpQuaternions(P.pq, P.q, alpha);
    quad.position.copy(RP); quad.quaternion.copy(RQ);
    if (S.view === 'fpv') {
      quad.visible = false;
      tiltQ.setFromAxisAngle(_a.set(1, 0, 0), S.tilt[S.mode] * DEG);
      camera.quaternion.copy(RQ).multiply(tiltQ);
      camera.position.copy(RP).add(_a.set(0, .012, -C.camFwd).applyQuaternion(RQ));
    } else {
      quad.visible = true;
      _f.set(0, 0, -1).applyQuaternion(RQ); _f.y = 0; if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1); _f.normalize();
      _look.copy(RP).addScaledVector(_f, -C.chase[0]); _look.y += C.chase[1];
      _look.x = clamp(_look.x, -HX + .3, HX - .3); _look.z = clamp(_look.z, -HZ + .3, HZ - .3); _look.y = clamp(_look.y, .15, CEIL);
      chasePos.lerp(_look, 1 - Math.exp(-dt * 7));
      camera.position.copy(chasePos); camera.lookAt(_a.copy(RP).add(_b.set(0, .05, 0)));
    }
    if (shake > 0 && !RM) { camera.position.x += (Math.random() - .5) * shake * .05; camera.position.y += (Math.random() - .5) * shake * .05; camera.rotateZ((Math.random() - .5) * shake * .05); shake = Math.max(0, shake - dt * 1.4); }
    // Schatten unter dem Kopter
    const hgt = Math.max(0, RP.y - C.r);
    shadowM.position.set(RP.x, .012, RP.z); const s = C.shadow * (1 + hgt * .35); shadowM.scale.set(s, s, 1); shadowM.material.opacity = clamp(.55 - hgt * .08, .08, .55);
    // Funken
    if (FX.sparkT > 0) {
      FX.sparkT -= dt; const a = FX.sparks.geometry.attributes.position.array, v = FX.sparkV;
      for (let i = 0; i < 28; i++) { v[i * 3 + 1] -= G * dt; a[i * 3] += v[i * 3] * dt; a[i * 3 + 1] = Math.max(.01, a[i * 3 + 1] + v[i * 3 + 1] * dt); a[i * 3 + 2] += v[i * 3 + 2] * dt; }
      FX.sparks.geometry.attributes.position.needsUpdate = true; FX.sparks.material.opacity = clamp(FX.sparkT / .9, 0, 1);
    }
    if (curFovH !== S.fov || curAspect !== camera.aspect) setFov();
    renderer.render(scene, camera);
  }

  /* ---------- Größe und Bildqualität ---------- */
  const PRS = [.75, 1, 1.5, 2];
  const Q = { level: FINE ? 3 : 2, start: FINE ? 3 : 2, t: 0, n: 0, cool: 1.5, good: 0, raises: 0 };
  function prFor(l) { return Math.min(W.devicePixelRatio || 1, PRS[l]); }
  function applyQuality() {
    if (!renderer) return;
    if (S.quality !== 'auto') Q.level = +S.quality;
    renderer.setPixelRatio(prFor(Q.level)); resize();
    if (halos) halos.visible = Q.level >= 2 && S.light === 'on';
    if (ledGlow) ledGlow.visible = Q.level >= 1;
    const names = ['Niedrig', 'Niedrig', 'Mittel', 'Hoch'];
    const qn = $('[data-q-note]', panel); if (qn) qn.textContent = S.quality === 'auto' ? `Auto senkt die Qualität, wenn die Bildrate fällt. Gerade: ${names[Q.level]}.` : 'Feste Stufe. Bei Ruckeln eine Stufe runter.';
  }
  function qualityTick(dt) {
    Q.t += dt; Q.n++; Q.cool -= dt;
    if (Q.t < 1.5) return;
    const fps = Q.n / Q.t; Q.t = 0; Q.n = 0; fpsShown = Math.round(fps);
    if (S.quality !== 'auto' || Q.cool > 0) return;
    if (fps < 48 && Q.level > 0) { Q.level--; Q.cool = 2.5; Q.good = 0; applyQuality(); }
    else if (fps > 58) { Q.good += 1.5; if (Q.good > 10 && Q.level < Q.start && Q.raises < 2) { Q.level++; Q.raises++; Q.good = 0; Q.cool = 3; applyQuality(); } }
    else Q.good = 0;
  }
  function resize() {
    if (!renderer) return;
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; setFov();
  }

  /* =====================================================================
     Schleife
     ===================================================================== */
  let raf = 0, last = 0, acc = 0, hzTimer = 0, panelT = 0, idleR = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    let dt = (t - last) / 1000; last = t;
    if (!(dt > 0)) return; if (dt > .1) dt = .1;
    run('frame', () => {
      keyTick(dt);
      // Eingabe so spät wie möglich: direkt vor der Physik
      pollPads();
      if (WIZ.on) wizTick(dt);
      composeInput();
      if (PADS.edges.length) { const e = PADS.edges.splice(0); e.forEach(btnEdge); }
      if (gl) {
        if (demo.on) { demoStep(RM ? 0 : dt); acc = 0; }
        else if (live) {
          if (P.crashed > 0) { P.crashed -= dt; if (P.crashed <= 0) { P.crashed = 0; resetQuad(); } }
          else {
            if (!P.armed && P.armReq && !armSwitch() && IN.thr <= .05) arm(true);
            acc += dt; let n = 0;
            while (acc >= STEP && n < 48) { P.ppos.copy(P.pos); P.pq.copy(P.q); physStep(STEP); acc -= STEP; simT += STEP; n++; if (P.crashed) { acc = 0; break; } }
          }
          // nach langer Pause wieder Demo
          if (!P.armed && !P.crashed && performance.now() - IN.lastAct > 75000 && D.activeElement !== stage && !isFull && !WIZ.on) backToDemo();
        }
        animGates(dt, t / 1000);
        idleR -= dt;
        if ((stageVis || isFull) && (demo.on || live || idleR <= 0)) { idleR = .5; render(demo.on ? 1 : clamp(acc / STEP, 0, 1), dt); qualityTick(dt); }
      } else qualityTick(dt);
      osdTick(dt);
      panelT -= dt; if (panelT <= 0) { panelT = 1 / 30; panelTick(); }
      if (TCH.hzT += dt, TCH.hzT >= 1) { TCH.hz = TCH.moves ? Math.round(TCH.moves / TCH.hzT) : 0; TCH.moves = 0; TCH.hzT = 0; }
    });
  }
  function updateRun() {
    const want = !D.hidden && (stageVis || panelVis || isFull);
    stage.classList.toggle('is-off', !(stageVis || isFull));
    if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); if (padsSupported && !hzTimer) hzTimer = setInterval(hzPoll, 4); }
    else if (!want && raf) { cancelAnimationFrame(raf); raf = 0; clearInterval(hzTimer); hzTimer = 0; KEYS.clear(); }
  }

  /* =====================================================================
     Einstellungsfeld
     ===================================================================== */
  const btns = {}; $$('.sim-bar [data-act]', stage).forEach(b => btns[b.dataset.act] = b);
  const wizBtn = $('[data-wiz-open]', panel);
  btns.arm.addEventListener('click', () => toggleArm());
  btns.mode.addEventListener('click', () => toggleMode());
  btns.craft.addEventListener('click', () => toggleCraft());
  btns.view.addEventListener('click', () => toggleView());
  btns.reset.addEventListener('click', () => { if (!live) start(false); else doReset(); });
  btns.panel.addEventListener('click', () => togglePanel());
  btns.full.addEventListener('click', () => toggleFull());
  $$('.sim-bar .sb', stage).forEach(b => b.addEventListener('click', e => { if (e.detail > 0) try { stage.focus({ preventScroll: true }); } catch (er) { } }));
  $('[data-panel-x]', panel).addEventListener('click', () => { app.classList.remove('panel-open'); syncPanelBtn(); try { stage.focus({ preventScroll: true }); } catch (e) { } });
  $$('[data-sim-start]').forEach(b => b.addEventListener('click', () => start(true)));

  /* Reiter */
  const tabs = $$('[role=tab]', panel), panes = tabs.map(t => $('#' + t.getAttribute('aria-controls')));
  function selectTab(i, focus) {
    tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panes[k].hidden = !on; });
    if (focus) tabs[i].focus();
    if (i === 1) drawCurve(true);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(i));
    t.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); selectTab((i + k + tabs.length) % tabs.length, true); } else if (e.key === 'Home') { e.preventDefault(); selectTab(0, true); } else if (e.key === 'End') { e.preventDefault(); selectTab(tabs.length - 1, true); } });
  });
  const curTab = () => tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');

  /* Regler, Schalter, Auswahl */
  const outs = {}; $$('[data-out]', panel).forEach(o => outs[o.dataset.out] = o);
  const fill = (r) => { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); };
  function syncUI() {
    $$('[data-set]', panel).forEach(el => {
      const k = el.dataset.set;
      if (el.type === 'radio') el.checked = String(S[k]) === el.value;
      else if (el.type === 'checkbox') el.checked = !!S[k];
      else if (el.type === 'range') {
        const v = k === 'dz' ? S.dz * 100 : k === 'thrMid' ? S.thrMid * 100 : k === 'thrExpo' ? S.thrExpo * 100 : k === 'tilt' ? S.tilt[S.mode] : S[k];
        el.value = v; fill(el);
      }
    });
    $$('[data-rate]', panel).forEach(el => { const [ax, k] = el.dataset.rate.split('.'); el.value = S.rates[ax][k].toFixed(2); });
    outs.dz.textContent = Math.round(S.dz * 100) + ' %'; outs.maxAngle.textContent = S.maxAngle + '°'; outs.level.textContent = S.level;
    outs.thrMid.textContent = pct(S.thrMid); outs.thrExpo.textContent = pct(S.thrExpo); outs.tilt.textContent = S.tilt[S.mode] + '°'; outs.fov.textContent = S.fov + '°';
    $('[data-tilt-mode]', panel).textContent = S.mode === 'acro' ? 'Acro' : 'Angle';
    $('[data-hover]', panel).textContent = Math.round(hoverStick() * 100) + ' %';
    $('[data-angle-box]', panel).hidden = S.mode !== 'angle';
    $('[data-mode-note]', panel).textContent = S.mode === 'angle' ? 'Angle: Der Stick gibt den Winkel vor, beim Loslassen richtet sich der Kopter gerade aus.' : 'Acro: Der Stick gibt die Drehrate vor. Der Kopter bleibt in jeder Lage, bis du gegensteuerst.';
    maxRates();
  }
  panel.addEventListener('input', e => {
    const el = e.target, k = el.dataset.set;
    if (el.dataset.rate) { const [ax, kk] = el.dataset.rate.split('.'); const v = parseFloat(String(el.value).replace(',', '.')); if (Number.isFinite(v)) { S.rates[ax][kk] = clamp(v, +el.min, +el.max); saveSettings(); maxRates(); drawCurve(true); } return; }
    if (!k) return;
    if (el.type === 'range') {
      const v = +el.value; fill(el);
      if (k === 'dz') S.dz = v / 100; else if (k === 'thrMid') S.thrMid = v / 100; else if (k === 'thrExpo') S.thrExpo = v / 100; else if (k === 'tilt') S.tilt[S.mode] = v; else S[k] = v;
      syncUI(); saveSettings(); if (k === 'fov') setFovSafe();
    } else if (el.type === 'radio') {
      const old = S[k]; S[k] = el.value; saveSettings();
      if (k === 'mode') applyMode(); else if (k === 'craft' && old !== S.craft) applyCraft(); else if (k === 'view') applyView(); else if (k === 'light') applyLight(); else if (k === 'quality') { Q.raises = 0; applyQuality(); }
    } else if (el.type === 'checkbox') { S[k] = el.checked; saveSettings(); applyLooks(); }
  });
  panel.addEventListener('change', e => { if (e.target.dataset.rate) { const [ax, k] = e.target.dataset.rate.split('.'); e.target.value = S.rates[ax][k].toFixed(2); } });
  $$('[data-preset]', panel).forEach(b => b.addEventListener('click', () => { S.rates = JSON.parse(JSON.stringify(PRESETS[b.dataset.preset])); saveSettings(); syncUI(); drawCurve(true); toast('Rates: ' + b.textContent); }));
  const setFovSafe = () => { if (camera) setFov(); };
  function maxRates() { for (const ax of ['roll', 'pitch', 'yaw']) { const o = $(`[data-max=${ax}]`, panel); if (o) o.textContent = Math.round(bfRate(1, S.rates[ax])); } }

  function applyMode() {
    syncUI(); stage.classList.toggle('acro', S.mode === 'acro'); btns.mode.classList.toggle('acro', S.mode === 'acro');
    $('[data-mode-t]', stage).textContent = S.mode === 'acro' ? 'Acro' : 'Angle'; drawScore(); renderBest();
  }
  function applyCraft() {
    syncUI(); $('[data-craft-t]', stage).textContent = S.craft === 'whoop' ? 'Whoop' : '5 Zoll';
    if (quadW) { quadW.visible = S.craft === 'whoop'; quadF.visible = S.craft === 'five'; }
    if (live) resetQuad();
    drawScore(); renderBest();
  }
  function applyView() { syncUI(); stage.classList.toggle('v-chase', S.view === 'chase'); $('[data-view-t]', stage).textContent = S.view === 'fpv' ? 'FPV' : 'Hinten'; if (camera) { chasePos.copy(P.pos).add(_a.set(0, 1, 2)); setFov(); } }
  function applyLight() {
    syncUI(); if (!renderer) return;
    const on = S.light === 'on';
    hemi.intensity = on ? 2.3 : .16; sun.intensity = on ? 1.2 : 0;
    const fc = on ? 0x2a2c31 : 0x030508; scene.fog.color.setHex(fc); renderer.setClearColor(fc);
    scene.fog.near = on ? 30 : 8; scene.fog.far = on ? 95 : 60;
    MAT.lamp.color.setHex(on ? 0xfff3dc : 0x2a2c30); MAT.win.color.setHex(on ? 0xffffff : 0x4a5a78);
    MAT.ledGlow.opacity = on ? .45 : .9; MAT.score.color.setHex(0xffffff);
    applyQuality();
  }
  function applyLooks() {
    syncUI();
    stage.classList.toggle('is-analog', !!S.analog); stage.classList.toggle('no-osd', !S.osd);
  }

  /* Bestzeiten */
  function renderBest() {
    const ul = $('[data-best]', panel); if (!ul) return;
    const rows = [['whoop', 'angle', 'Whoop · Angle'], ['whoop', 'acro', 'Whoop · Acro'], ['five', 'angle', '5 Zoll · Angle'], ['five', 'acro', '5 Zoll · Acro']];
    ul.innerHTML = rows.map(([c, m, n]) => { const b = best[c + '-' + m]; return `<li class="${b > 0 ? '' : 'none'}"><span>${n}</span><b>${b > 0 ? fmtLap(b) : 'noch keine'}</b></li>`; }).join('');
  }
  $('[data-best-clear]', panel).addEventListener('click', () => { best = {}; store.set('fcs-sim-best', best); renderBest(); drawScore(); toast('Bestzeiten gelöscht'); });

  /* Rate-Kurven */
  const curve = $('[data-curve]', panel); let curveKey = '';
  function drawCurve(force) {
    if (!curve || curTab() !== 1) return;
    const key = [S.rates.roll.rc, S.rates.roll.sr, S.rates.roll.ex, S.rates.pitch.rc, S.rates.pitch.sr, S.rates.pitch.ex, S.rates.yaw.rc, S.rates.yaw.sr, S.rates.yaw.ex, IN.roll.toFixed(2), IN.pitch.toFixed(2), IN.yaw.toFixed(2), curve.clientWidth].join();
    if (!force && key === curveKey) return; curveKey = key;
    const dpr = Math.min(W.devicePixelRatio || 1, 2), cw = curve.clientWidth || 340, ch = Math.round(cw / 2);
    if (curve.width !== Math.round(cw * dpr)) { curve.width = Math.round(cw * dpr); curve.height = Math.round(ch * dpr); }
    const x = curve.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cw, ch);
    const mx = Math.max(...['roll', 'pitch', 'yaw'].map(a => bfRate(1, S.rates[a]))), top = Math.max(800, Math.ceil(mx / 200) * 200);
    const L = 44, B = ch - 24, Rr = cw - 12, T = 12;
    x.strokeStyle = 'rgba(158,196,255,.14)'; x.lineWidth = 1; x.fillStyle = '#9db1cc'; x.font = '600 15px ui-monospace,Menlo,Consolas,monospace'; x.textAlign = 'right'; x.textBaseline = 'middle';
    for (let v = 0; v <= top; v += top / 4) { const y = B - (B - T) * v / top; x.beginPath(); x.moveTo(L, y); x.lineTo(Rr, y); x.stroke(); x.fillText(String(Math.round(v)), L - 6, y); }
    x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText('Stickweg →', (L + Rr) / 2, B + 4);
    const cols = { roll: '#3fe0ff', pitch: '#ffb020', yaw: '#3ee08a' };
    for (const ax of ['yaw', 'pitch', 'roll']) {
      x.strokeStyle = cols[ax]; x.lineWidth = 2.2; x.beginPath();
      for (let i = 0; i <= 60; i++) { const s = i / 60, px = L + (Rr - L) * s, py = B - (B - T) * bfRate(s, S.rates[ax]) / top; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
      const s = Math.abs(IN[ax] || 0), px = L + (Rr - L) * s, py = B - (B - T) * bfRate(s, S.rates[ax]) / top;
      x.fillStyle = cols[ax]; x.beginPath(); x.arc(px, py, 4.5, 0, Math.PI * 2); x.fill();
    }
  }

  /* Live-Anzeige der Sticks und Kanäle */
  const chans = $('[data-chans]', panel);
  const CH = [['THR', 'thr', 0], ['YAW', 'yaw', 1], ['PIT', 'pitch', 1], ['ROL', 'roll', 1], ['ARM', 'arm', 2], ['MOD', 'mode', 2]];
  chans.innerHTML = CH.map(([l, k, c]) => `<div class="sim-ch${c === 1 ? ' c' : c === 2 ? ' sw' : ''}" data-ch="${k}"><b>${l}</b><i><u></u></i><output>0</output></div>`).join('');
  const chEls = {}; CH.forEach(([, k]) => { const r = $(`[data-ch=${k}]`, chans); chEls[k] = { u: $('u', r), o: $('output', r), last: '' }; });
  const stL = $('[data-stick=l] i', panel), stR = $('[data-stick=r] i', panel);
  const srcBox = $('[data-src]', panel), padHint = $('[data-pad-hint]', panel), padPick = $('[data-pad-pick]', panel), padSel = $('[data-pad-sel]', panel);
  function panelTick() {
    if (curTab() === 0 && panelVis) {
      const sq = stL.parentElement.clientWidth / 2 - 12;
      stL.style.transform = `translate(${(IN.yaw * sq).toFixed(1)}px,${(-(IN.thr * 2 - 1) * sq).toFixed(1)}px)`;
      stR.style.transform = `translate(${(IN.roll * sq).toFixed(1)}px,${(-IN.pitch * sq).toFixed(1)}px)`;
      const armV = live && P.armed ? 1 : 0, modeV = S.mode === 'angle' ? 1 : 0;
      const vals = { thr: IN.thr, yaw: IN.yaw, pitch: IN.pitch, roll: IN.roll, arm: armV, mode: modeV };
      for (const [, k, c] of CH) {
        const v = vals[k], e = chEls[k];
        e.u.style.transform = `scaleX(${(c === 1 ? v : v).toFixed(3)})`;
        const t = c === 2 ? (k === 'arm' ? (v ? 'AN' : 'AUS') : (v ? 'ANG' : 'ACR')) : c === 1 ? (v >= 0 ? '+' : '') + Math.round(v * 100) : Math.round(v * 100) + '%';
        if (e.last !== t) { e.o.textContent = t; e.last = t; }
      }
      const hz = hzValue(), hzEl = $('[data-in-hz]', panel), fpsEl = $('[data-in-fps]', panel);
      const hzT = IN.src === 'key' ? 'Tastatur' : hz ? String(hz) : '--'; if (hzEl.textContent !== hzT) hzEl.textContent = hzT;
      const fT = fpsShown ? String(fpsShown) : '--'; if (fpsEl.textContent !== fT) fpsEl.textContent = fT;
    }
    if (curTab() === 1 && panelVis) drawCurve(false);
  }
  function updateSrc() {
    const gp = padByIdx(PADS.idx), any = getPads().length > 0;
    let n = 'Tastatur', s = 'Klick in die Bühne, dann W, A, S, D und Pfeiltasten.', cls = 'ok';
    if (IN.src === 'touch') { n = 'Touch-Sticks'; s = 'Linker Stick Gas und Gieren, rechter Stick Nicken und Rollen.'; }
    if (IN.src === 'pad' && gp) {
      n = padName(gp);
      if (padMap(gp)) s = 'Funke eingerichtet. Zuordnung ist auf diesem Gerät gespeichert.';
      else if (isStd(gp)) s = 'Controller in Mode 2: linker Stick Gas und Gieren, rechter Stick Nicken und Rollen.';
      else { s = 'Funke erkannt. Bitte einmal einrichten, dann stimmen Achsen und Richtung.'; cls = 'warn'; }
    } else if (any && gp) { s += ' Controller erkannt: ' + padName(gp) + '. Beweg einen Stick, um ihn zu nutzen.'; }
    $('[data-src-n]', srcBox).textContent = n; $('[data-src-s]', srcBox).textContent = s;
    srcBox.classList.toggle('ok', cls === 'ok'); srcBox.classList.toggle('warn', cls === 'warn');
    padHint.hidden = any;
    if (!padsSupported) padHint.textContent = 'Dieser Browser unterstützt keine Controller. Nimm Chrome, Edge, Firefox oder Safari in einer aktuellen Version.';
    wizBtn.disabled = !gp; $('[data-map-reset]', panel).disabled = !(gp && padMap(gp));
    if (gp && padMap(gp)) wizBtn.classList.remove('pulse');
    const ch = $('[data-cta-h]', stage);
    if (ch) ch.textContent = IN.src === 'pad' && gp ? `${padName(gp)} ist bereit: Beweg einen Stick oder drück einen Knopf.` : COARSE && !FINE ? 'Am Handy startet der Simulator im Vollbild mit zwei Touch-Sticks. Halt es dabei quer.' : 'Tastatur, Touch, Controller oder Funke: Du kannst sofort loslegen.';
  }
  function fillPadSelect() {
    const list = getPads();
    padPick.hidden = list.length < 2;
    padSel.innerHTML = '<option value="auto">Automatisch (zuletzt bewegt)</option>' + list.map(g => `<option value="${g.index}">${padName(g).replace(/[<>&"]/g, '')}</option>`).join('');
    padSel.value = PADS.sel; if (padSel.value !== PADS.sel) { PADS.sel = 'auto'; padSel.value = 'auto'; }
    updateSrc();
  }
  padSel.addEventListener('change', () => { PADS.sel = padSel.value; if (PADS.sel !== 'auto') { PADS.idx = +PADS.sel; IN.src = 'pad'; } updateSrc(); });
  $('[data-map-reset]', panel).addEventListener('click', () => { const gp = padByIdx(PADS.idx); if (!gp) return; delete PADS.maps[gp.id]; store.set('fcs-sim-pads', PADS.maps); updateSrc(); toast('Zuordnung zurückgesetzt'); });

  /* =====================================================================
     Assistent für Funken: erkennt Achse, Richtung, Weg und Mitte
     ===================================================================== */
  const WIZ = { on: false, i: 0, pad: -1, base: [], baseB: [], snap: null, snapB: null, map: {}, cand: -1, hold: 0, peak: 0, wait: 0 };
  const WS = [
    { k: 'rest', t: 'Sticks loslassen, Gas ganz runter', d: 'Lass beide Sticks los, sie stehen dann in der Mitte. Den Gas-Stick ziehst du ganz nach unten. Dann drück Weiter.', a: 'a-rest', man: true },
    { k: 'thr', t: 'Gas ganz hoch', d: 'Schieb den Gas-Stick ganz nach oben und halt ihn kurz. Danach wieder ganz runter.', a: 'a-thr' },
    { k: 'yaw', t: 'Gieren nach rechts', d: 'Drück den Gier-Stick (bei Mode 2 der linke) ganz nach rechts und halt ihn kurz.', a: 'a-yaw' },
    { k: 'pitch', t: 'Nicken nach vorne', d: 'Drück den rechten Stick ganz nach vorne, also nach oben, und halt ihn kurz.', a: 'a-pit' },
    { k: 'roll', t: 'Rollen nach rechts', d: 'Drück den rechten Stick ganz nach rechts und halt ihn kurz.', a: 'a-rol' },
    { k: 'arm0', t: 'Arm-Schalter auf AUS', d: 'Hast du einen Schalter zum Armen? Stell ihn auf AUS und drück Weiter. Ohne Schalter: Überspringen, dann armst du mit der Leertaste oder automatisch.', a: '', man: true, opt: 2 },
    { k: 'arm1', t: 'Arm-Schalter auf AN', d: 'Jetzt leg den Arm-Schalter auf AN. Keine Sorge, hier dreht sich nichts.', a: 'a-sw', opt: 1 },
    { k: 'mode0', t: 'Flugmodus-Schalter auf Acro', d: 'Hast du einen Schalter für den Flugmodus? Stell ihn auf Acro und drück Weiter. Sonst Überspringen, dann wechselst du mit M oder dem Knopf.', a: '', man: true, opt: 2 },
    { k: 'mode1', t: 'Jetzt auf Angle', d: 'Leg den Flugmodus-Schalter auf Angle um.', a: 'a-sw', opt: 1 },
    { k: 'done', t: 'Fertig!', d: 'Beweg die Sticks und schau, ob die Anzeige mitgeht: Gas oben gibt einen vollen Balken, Stick rechts schiebt den Punkt nach rechts. Gespeichert wird für dieses Gerät.', a: '', man: true }
  ];
  const wiz = $('[data-wiz]', panel), wizRaw = $('[data-wiz-raw]', panel), wizOk = $('[data-wiz-ok]', panel), wizPic = $('[data-wiz-pic]', panel);
  function wizOpen() {
    const gp = padByIdx(PADS.idx); if (!gp) { toast('Erst Funke anstecken und einen Stick bewegen'); return; }
    selectTab(0); WIZ.on = true; WIZ.pad = gp.index; WIZ.map = { dz: S.dz }; WIZ.i = 0; P.armed = false;
    wizRaw.innerHTML = gp.axes.map((_, i) => `<div class="rw" data-rw="${i}">A${i}<i></i></div>`).join('');
    wiz.hidden = false; wizStep(0);
    FCS_scroll(wiz);
  }
  function wizClose(save) {
    if (save) { const gp = padByIdx(WIZ.pad); if (gp) { PADS.maps[gp.id] = WIZ.map; store.set('fcs-sim-pads', PADS.maps); IN.src = 'pad'; PADS.idx = gp.index; toast('Funke gespeichert: ' + padName(gp)); } }
    WIZ.on = false; wiz.hidden = true; lastArmSw = null; lastModeSw = null; updateSrc();
    if (live) resetQuad();
  }
  function wizStep(i) {
    WIZ.i = i; WIZ.cand = -1; WIZ.hold = 0; WIZ.wait = 0; const s = WS[i];
    $('[data-wiz-i]', wiz).textContent = i + 1; $('[data-wiz-c]', wiz).textContent = WS.length;
    $('[data-wiz-t]', wiz).textContent = s.t; $('[data-wiz-d]', wiz).textContent = s.d; wizOk.textContent = ''; wizOk.className = 'sim-wiz-ok';
    wizPic.setAttribute('class', 'sim-wiz-pic ' + (s.a || ''));
    $('[data-wiz-skip]', wiz).hidden = !s.opt; $('[data-wiz-next]', wiz).textContent = s.k === 'done' ? 'Speichern' : 'Weiter';
    const gp = padByIdx(WIZ.pad);
    if (gp && (s.k === 'arm0' || s.k === 'mode0')) { WIZ.snap = null; }
    try { $('[data-wiz-t]', wiz).focus({ preventScroll: true }); } catch (e) { }
  }
  const used = () => ['thr', 'yaw', 'pitch', 'roll'].map(k => WIZ.map[k] && WIZ.map[k].i).filter(v => v != null);
  function wizNext() {
    const s = WS[WIZ.i], gp = padByIdx(WIZ.pad); if (!gp) return;
    if (s.k === 'rest') { WIZ.base = gp.axes.slice(); WIZ.baseB = gp.buttons.map(b => b.pressed ? 1 : 0); return wizStep(1); }
    if (s.k === 'arm0' || s.k === 'mode0') { WIZ.snap = gp.axes.slice(); WIZ.snapB = gp.buttons.map(b => b.pressed ? 1 : 0); return wizStep(WIZ.i + 1); }
    if (s.k === 'done') return wizClose(true);
    // Weiter ohne Erkennung: Schritt auslassen (bei Pflichtschritten mit Hinweis)
    if (!s.opt) { wizOk.textContent = 'Noch nichts erkannt. Beweg den Stick ganz bis zum Anschlag.'; wizOk.className = 'sim-wiz-ok warn'; return; }
    wizStep(WIZ.i + 1);
  }
  function wizSkip() { const s = WS[WIZ.i]; wizStep(Math.min(WS.length - 1, WIZ.i + (s.opt === 2 ? 2 : 1))); }
  function wizTick(dt) {
    const gp = padByIdx(WIZ.pad), s = WS[WIZ.i];
    if (!gp) { wizOk.textContent = 'Funke getrennt. Bitte wieder anstecken.'; wizOk.className = 'sim-wiz-ok warn'; return; }
    // Rohwerte
    const base = s.k.startsWith('arm1') || s.k.startsWith('mode1') ? (WIZ.snap || WIZ.base) : WIZ.base;
    gp.axes.forEach((v, i) => { const r = wizRaw.children[i]; if (!r) return; r.firstElementChild.style.setProperty('--x', ((v + 1) * 50).toFixed(1) + '%'); r.classList.toggle('hit', base.length && Math.abs(v - base[i]) > .3); });
    if (WIZ.wait > 0) { WIZ.wait -= dt; if (WIZ.wait <= 0) wizStep(WIZ.i + 1); return; }
    if (!WIZ.base.length) return;
    if (['thr', 'yaw', 'pitch', 'roll'].includes(s.k)) {
      const ex = used(); let bi = -1, bd = 0;
      gp.axes.forEach((v, i) => { if (ex.includes(i)) return; const d = Math.abs(v - WIZ.base[i]); if (d > bd) { bd = d; bi = i; } });
      if (bd > .45) {
        if (bi === WIZ.cand) { WIZ.hold += dt; if (Math.abs(gp.axes[bi] - WIZ.base[bi]) > Math.abs(WIZ.peak - WIZ.base[bi])) WIZ.peak = gp.axes[bi]; }
        else { WIZ.cand = bi; WIZ.hold = 0; WIZ.peak = gp.axes[bi]; }
        if (WIZ.hold > .35) {
          const i = WIZ.cand, b = WIZ.base[i];
          if (s.k === 'thr') WIZ.map.thr = { i, lo: b, hi: WIZ.peak }; else WIZ.map[s.k] = { i, c: b, e: WIZ.peak - b };
          const span = Math.abs(WIZ.peak - b);
          wizOk.textContent = `Erkannt: Achse ${i}${(s.k !== 'thr' && WIZ.peak < b) ? ', umgekehrt' : ''}${span < .7 && s.k !== 'thr' ? ' (kleiner Weg, bitte bis zum Anschlag)' : ''}`; wizOk.className = 'sim-wiz-ok';
          WIZ.wait = .7;
        }
      } else { WIZ.cand = -1; WIZ.hold = 0; }
    } else if ((s.k === 'arm1' || s.k === 'mode1') && WIZ.snap) {
      const ex = used(); let found = null;
      gp.axes.forEach((v, i) => { if (!found && !ex.includes(i) && !(s.k === 'mode1' && WIZ.map.arm && WIZ.map.arm.type === 'axis' && WIZ.map.arm.i === i) && Math.abs(v - WIZ.snap[i]) > .5) found = { type: 'axis', i, from: WIZ.snap[i], to: v }; });
      if (!found) gp.buttons.forEach((b, i) => { const p = b.pressed ? 1 : 0; if (!found && WIZ.snapB[i] != null && p !== WIZ.snapB[i] && !(s.k === 'mode1' && WIZ.map.arm && WIZ.map.arm.type === 'btn' && WIZ.map.arm.i === i)) found = { type: 'btn', i, from: WIZ.snapB[i], to: p }; });
      if (found) {
        WIZ.hold += dt;
        if (WIZ.hold > .25) {
          if (s.k === 'arm1') WIZ.map.arm = { type: found.type, i: found.i, on: found.to, off: found.from };
          else WIZ.map.mode = { type: found.type, i: found.i, angle: found.to, acro: found.from };
          wizOk.textContent = `Erkannt: ${found.type === 'btn' ? 'Knopf' : 'Achse'} ${found.i}`; wizOk.className = 'sim-wiz-ok'; WIZ.wait = .7;
        }
      } else WIZ.hold = 0;
    }
  }
  wizBtn.addEventListener('click', wizOpen);
  $('[data-wiz-next]', wiz).addEventListener('click', wizNext);
  $('[data-wiz-skip]', wiz).addEventListener('click', wizSkip);
  $('[data-wiz-cancel]', wiz).addEventListener('click', () => wizClose(false));
  $$('[data-wiz-jump]').forEach(b => b.addEventListener('click', () => { selectTab(0); if (padByIdx(PADS.idx)) wizOpen(); else { FCS_scroll(panel); toast('Funke anstecken und einen Stick bewegen, dann Funke einrichten'); } }));

  /* =====================================================================
     Sichtbarkeit, Größe, Start
     ===================================================================== */
  if ('IntersectionObserver' in W) {
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.target === stage) stageVis = e.isIntersecting; else panelVis = e.isIntersecting; }); updateRun(); }, { rootMargin: '60px 0px' });
    io.observe(stage); io.observe(panel);
  }
  D.addEventListener('visibilitychange', updateRun);
  if ('ResizeObserver' in W) new ResizeObserver(() => { resize(); stickLayout(); syncPanelBtn(); }).observe(stage);
  W.addEventListener('resize', () => { syncPanelBtn(); });

  // Rauschen für den Analog-Look (einmal gemalt)
  run('rauschen', () => { const [c, x] = cnv(180, 180), id = x.createImageData(180, 180); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); $('.sim-noise', stage).style.backgroundImage = `url(${c.toDataURL()})`; });

  gl = !!run('3D', initGL);
  if (!gl) { $('[data-nogl]', stage).hidden = false; cta.hidden = true; demo.on = false; loadEl.classList.add('gone'); }
  else {
    lateTextures();
    renderer.setClearColor(0x2a2c31);
    applyLight(); applyQuality();
    quadW.visible = S.craft === 'whoop'; quadF.visible = S.craft === 'five';
    resetQuad();
    if (demo.on) { stage.classList.add('is-demo'); P.armed = true; paintGates(); }
    else { // ruhiges Standbild (reduzierte Bewegung): Blick vom Start auf Gate 1
      stage.classList.add('is-demo'); $('.sim-cta-k', cta).innerHTML = '<span class="dot" aria-hidden="true"></span> Bereit in der Halle';
      P.pos.y = 1.2; P.ppos.copy(P.pos);
    }
    resize();
    requestAnimationFrame(() => { run('erstes Bild', () => render(1, .016)); loadEl.classList.add('gone'); });
  }
  applyMode(); applyCraft(); applyView(); applyLooks(); renderBest(); fillPadSelect(); updateSrc();
  if (COARSE && !FINE) setTouch(true);
  if (!stage.classList.contains('is-touch')) IN.src = getPads().length ? 'pad' : 'key';
  stickLayout(); syncPanelBtn();
  if (W.innerWidth > 1100) app.classList.remove('no-panel');
  updateRun();

  /* Schnittstelle (Andockpunkt Bestenliste, Prüfungen) */
  W.FCS = W.FCS || {};
  W.FCS.sim = {
    onLap,
    state: () => ({ pos: P.pos.toArray().map(v => +v.toFixed(3)), vel: P.vel.toArray().map(v => +v.toFixed(3)), quat: P.q.toArray().map(v => +v.toFixed(4)), up: new THREE.Vector3(0, 1, 0).applyQuaternion(P.q).toArray().map(v => +v.toFixed(3)), armed: P.armed, crashed: P.crashed > 0, live, demo: demo.on, mode: S.mode, craft: S.craft, src: IN.src, input: { thr: IN.thr, yaw: IN.yaw, pitch: IN.pitch, roll: IN.roll }, next: race.next, running: race.running, laps: race.laps, last: race.last, fps: fpsShown, quality: Q.level, gl, wizard: WIZ.on ? WS[WIZ.i].k : null, hz: hzValue() })
  };
  if (TEST) Object.assign(W.FCS.sim, {
    gates: () => GATES.map(g => ({ c: g.c.toArray(), n: g.n.toArray() })),
    place: (p, v, headingDeg = 0) => { P.pos.fromArray(p); P.ppos.copy(P.pos); P.vel.fromArray(v || [0, 0, 0]); yawQ(headingDeg, P.q); P.pq.copy(P.q); P.w.set(0, 0, 0); for (const g of GATES) g.psd = _a.subVectors(P.pos, g.c).dot(g.n); },
    hover: () => hoverStick(), settings: () => JSON.parse(JSON.stringify(S))
  });
}
