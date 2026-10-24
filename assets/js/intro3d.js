/* Flight Club Saar · 3D-Eröffnungs-Intro
   ------------------------------------------------------------------
   playIntro(root, opts) → Promise<boolean>
     true  = Intro lief (ganz oder übersprungen), Seite ist frei, alles aufgeräumt
     false = nichts gezeigt (kein WebGL2, reduzierte Bewegung, Fehler beim Laden) → altes Intro nehmen
   Regie: eine GSAP-Timeline (Zeit = Drehbuchzeit in Sekunden). Der 3D-Zustand ist eine reine
   Funktion dieser Zeit, deshalb lässt sich jede Stelle exakt anspringen (Tests, Überspringen).
   three.js r170 (nur Kern) wird erst hier dynamisch geladen; Rauschen und OSD laufen schon vorher.

   opts (alle optional, Standard = Flight Club Saar):
     logoPath   SVG-Pfad des Logos (fill-rule evenodd)
     viewBox    "x y w h" oder [x,y,w,h]
     ring       {cx, cy, r, w}   Mitte, Außenradius und Breite des Logo-Rings (SVG-Einheiten)
     props      [[x,y],…]        Mitten der Propeller-Kreise (SVG-Einheiten)
     propR, propW, motorR        Radius und Wandstärke der Propellerkreise, Radius des Motorpunkts
     title, subtitle, osd        Texte
     colors     {a, b, ink}      LED vorne / hinten / Logofarbe
     threeUrl                    Pfad zu three.module.min.js (Standard: ../lib/ relativ zu diesem Modul)
     onReveal   Funktion, wird aufgerufen, sobald die Seite durchscheint (Portal beginnt)
     allowSoftwareGL, debug, hold   nur für Tests
*/

const FCS_DEFAULTS = {
  logoPath: 'M354.0 310.0C336.5 307.6 320.4 302.7 305.5 295.3C263.4 274.3 234.0 235.5 224.9 188.7C222.0 174.2 221.8 151.2 224.4 136.5C230.0 104.9 245.0 76.9 268.4 54.3C289.7 33.7 313.4 21.2 343.0 14.9C358.1 11.7 384.9 11.7 400.0 14.9C451.8 25.9 493.2 61.1 511.5 109.5C525.8 147.4 523.3 191.5 504.9 228.3C484.1 269.6 445.7 298.9 400.1 308.1C389.0 310.3 363.9 311.4 354.0 310.0ZM398.7 295.0C445.9 285.0 484.0 251.7 499.9 206.7C505.4 191.1 507.3 179.5 507.3 161.5C507.3 148.9 506.8 143.3 505.1 135.3C499.2 107.1 487.5 85.5 467.5 65.5C447.5 45.5 426.0 33.9 397.7 27.8C383.3 24.8 359.7 24.8 345.3 27.8C317.4 33.8 295.1 45.8 275.5 65.5C249.3 91.6 235.8 124.3 235.7 161.5C235.7 189.7 242.9 213.6 258.5 237.1C277.2 265.1 307.5 286.4 340.0 294.2C357.4 298.3 381.6 298.7 398.7 295.0ZM308.8 246.7C298.5 242.8 291.6 236.6 287.1 227.0C284.9 222.3 284.5 220.1 284.5 212.0C284.5 203.6 284.8 201.8 287.3 196.8C290.9 189.4 297.4 182.9 304.8 179.3C309.8 176.8 311.6 176.5 320.0 176.5C328.4 176.5 330.1 176.8 335.0 179.3L340.5 182.0L343.8 178.3C351.9 169.1 351.5 153.9 342.8 143.8L340.5 141.1L335.0 143.8C330.2 146.2 328.3 146.5 320.0 146.5C311.5 146.5 309.9 146.2 304.6 143.6C297.0 139.9 290.6 133.5 287.2 126.2C284.9 121.3 284.5 119.2 284.5 111.0C284.5 102.8 284.9 100.7 287.2 95.8C290.6 88.5 297.5 81.6 304.8 78.2C309.7 75.9 311.8 75.5 320.0 75.5C328.2 75.5 330.3 75.9 335.2 78.2C342.3 81.5 349.0 88.2 352.7 95.8C355.2 100.8 355.5 102.6 355.5 111.0C355.5 119.3 355.2 121.2 352.8 126.0L350.1 131.5L352.8 133.7C364.1 143.0 380.2 142.7 389.5 133.0L392.3 130.1L390.0 124.8C383.4 109.5 388.5 91.9 402.4 81.6C409.1 76.6 416.4 74.7 425.9 75.2C438.9 76.0 449.2 82.9 455.7 95.2C458.2 100.0 458.5 101.4 458.5 111.0C458.5 121.1 458.4 121.8 455.1 127.8C451.1 135.2 445.8 140.2 438.0 143.9C433.3 146.1 431.2 146.5 423.0 146.5C414.6 146.5 412.8 146.2 407.6 143.6L401.7 140.7L399.3 143.6C394.1 149.9 392.5 154.1 392.5 162.0C392.5 169.9 393.7 173.3 398.9 179.7L401.4 182.9L404.5 181.1C422.9 170.3 446.8 177.6 455.8 196.8C458.2 201.8 458.5 203.7 458.5 212.5C458.5 221.5 458.2 223.0 455.7 227.8C451.7 235.3 447.0 240.2 439.8 244.0C434.7 246.8 432.1 247.4 425.8 247.8C416.2 248.4 410.6 246.9 403.0 241.8C388.9 232.4 383.3 213.7 390.0 198.2L392.3 192.8L389.4 190.4C383.1 185.1 378.9 183.5 371.0 183.5C363.3 183.5 359.2 185.0 353.1 189.8L350.7 191.8L353.1 197.6C355.0 202.3 355.5 205.3 355.5 212.5C355.5 220.4 355.1 222.2 352.6 227.4C348.9 235.0 342.4 241.4 335.2 244.8C328.4 248.0 315.0 248.9 308.8 246.7ZM332.3 239.1C342.6 234.1 349.4 223.5 349.4 212.4C349.4 206.3 346.6 196.6 345.0 197.2C344.5 197.4 341.2 200.1 337.6 203.3C331.6 208.6 331.0 209.5 331.0 213.0C331.0 224.8 313.8 227.0 310.0 215.6C307.8 208.9 312.9 202.0 320.1 202.0C323.3 202.0 324.4 201.3 329.2 195.8C336.9 186.9 336.8 187.3 331.3 184.8C324.3 181.7 315.1 181.9 308.0 185.2C283.3 196.7 284.8 231.1 310.5 240.3C316.9 242.6 326.2 242.1 332.3 239.1ZM436.5 238.5C453.1 230.4 458.0 208.7 446.5 193.7C441.4 187.0 432.0 182.6 423.1 182.7C416.9 182.7 410.4 184.6 407.3 187.1C406.3 188.0 407.3 189.6 412.1 195.1C417.7 201.4 418.5 202.0 422.2 202.0C428.1 202.0 432.0 206.2 432.0 212.5C432.0 216.3 431.5 217.7 429.1 220.1C426.7 222.5 425.3 223.0 421.5 223.0C415.2 223.0 411.0 219.1 411.0 213.2C411.0 209.6 410.4 208.8 404.6 203.6C401.1 200.5 397.9 198.0 397.5 198.0C395.9 198.0 394.0 205.6 394.0 212.2C394.0 221.4 396.8 227.8 403.4 233.8C412.8 242.4 425.0 244.2 436.5 238.5ZM309.2 234.9C301.6 231.1 295.0 221.5 295.0 214.1C295.0 213.0 295.4 212.0 296.0 212.0C296.6 212.0 297.0 213.2 297.0 214.8C297.1 223.8 308.4 235.0 317.5 235.0C318.9 235.0 320.0 235.4 320.0 236.0C320.0 237.7 313.7 237.1 309.2 234.9ZM423.0 236.0C423.0 235.4 424.2 235.0 425.8 235.0C429.5 234.9 435.9 231.9 439.4 228.4C442.9 224.9 445.9 218.5 446.0 214.8C446.0 213.2 446.4 212.0 447.0 212.0C447.6 212.0 448.0 213.5 448.0 215.2C447.9 225.1 435.9 237.0 426.0 237.0C424.4 237.0 423.0 236.6 423.0 236.0ZM331.9 137.9L336.2 136.0L330.0 129.0C324.4 122.7 323.4 122.0 320.0 122.0C312.3 122.0 307.3 114.0 310.8 107.0C313.2 102.1 318.7 99.4 323.5 101.0C328.1 102.5 331.0 106.3 331.0 111.0C331.0 114.4 331.7 115.3 337.4 120.4C340.9 123.5 344.3 126.0 344.8 126.0C346.7 126.0 349.4 116.9 349.4 110.6C349.4 99.6 342.5 88.9 332.1 83.9C325.8 80.8 314.5 80.7 307.9 83.7C301.9 86.4 296.0 92.3 292.9 98.6C289.7 105.3 289.6 116.4 292.9 123.2C300.1 138.0 317.1 144.5 331.9 137.9ZM435.7 137.8C446.5 132.7 452.5 123.2 452.5 111.0C452.5 98.7 446.9 89.6 436.2 84.3C428.3 80.4 417.9 80.4 410.5 84.2C404.3 87.5 398.7 93.1 396.1 99.0C393.4 104.9 393.3 116.8 395.8 122.4L397.5 126.3L404.3 120.5C410.4 115.3 411.0 114.4 411.0 111.0C411.0 103.6 418.5 98.5 425.3 101.3C429.8 103.2 432.0 106.5 432.0 111.5C431.9 117.8 427.5 121.9 420.8 122.1C418.0 122.1 416.7 123.1 412.2 128.4C409.4 131.9 407.0 135.0 407.0 135.3C407.0 136.3 412.5 138.9 416.7 140.0C422.1 141.3 430.3 140.4 435.7 137.8ZM295.0 108.2C295.0 104.0 299.7 95.4 303.8 92.0C309.0 87.8 320.0 84.3 320.0 86.9C320.0 87.4 318.3 88.1 316.2 88.5C307.3 90.0 299.9 97.0 297.8 105.8C296.4 111.4 295.0 112.7 295.0 108.2ZM446.0 108.5C446.0 99.4 434.8 88.1 425.8 88.0C424.2 88.0 423.0 87.5 423.0 87.0C423.0 86.5 424.0 86.0 425.1 86.0C432.5 86.0 442.8 93.0 446.1 100.5C448.1 104.8 448.6 111.0 447.0 111.0C446.4 111.0 446.0 109.9 446.0 108.5Z',
  viewBox: '217.8 5.6 312.0 312.0',
  ring: { cx: 371.55, cy: 161.55, r: 149.0, w: 12.85 },
  props: [[320.0, 111.05], [423.1, 111.05], [320.0, 212.0], [423.1, 212.0]],
  propR: 35.9, propW: 6.4, motorR: 10.5,
  title: 'FLIGHT CLUB SAAR',
  subtitle: 'e. V. · FPV im Saarland · seit 2022',
  osd: 'FLIGHT CLUB SAAR · OSD',
  colors: { a: '#3fe0ff', b: '#ffb020', ink: '#eaf4ff' }
};

/* Drehbuch (Sekunden) */
const TL = {
  bootEnd: 0.7, ringA: 0.75, ringB: 1.45, appear: 1.0, gate: 2.25, blendA: 3.78, stop: 4.35,
  flatA: 4.3, flatB: 4.72, morphA: 4.42, morphB: 4.78, whiteA: 4.32, whiteB: 4.8,
  zipA: 4.2, zipB: 4.62, scanA: 4.66, scanB: 5.16, burst: 5.16, title: 5.36, armed: 5.56, sub: 5.62,
  portal: 6.3, end: 7.0
};

/* ---------- kleine Helfer ---------- */
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const sstep = x => x * x * (3 - 2 * x);
const eOut3 = x => 1 - Math.pow(1 - x, 3);
const eIn2 = x => x * x;
const eInOut3 = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eOutExpo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const decay = (t, at, len) => (t < at ? 0 : Math.exp(-(t - at) / len * 4.6));
const lerp = (a, b, t) => a + (b - a) * t;
const hex3 = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

/* Keyframe-Spur: Hermite mit Catmull-Rom-Tangenten über ungleichmäßige Zeiten (C1-stetig).
   key = {t, v:[…], ease:true (Geschwindigkeit 0 an dieser Stelle)} */
function makeTrack(keys) {
  const n = keys.length, dim = keys[0].v.length;
  keys.forEach((k, i) => {
    if (k.ease) { k.d = new Array(dim).fill(0); return; }
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)], dt = (b.t - a.t) || 1;
    k.d = k.v.map((_, j) => (b.v[j] - a.v[j]) / dt);
  });
  return (t, out) => {
    if (t <= keys[0].t) { for (let j = 0; j < dim; j++) out[j] = keys[0].v[j]; return out; }
    if (t >= keys[n - 1].t) { for (let j = 0; j < dim; j++) out[j] = keys[n - 1].v[j]; return out; }
    let i = 0; while (i < n - 2 && t >= keys[i + 1].t) i++;
    const k0 = keys[i], k1 = keys[i + 1], h = k1.t - k0.t, s = (t - k0.t) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    for (let j = 0; j < dim; j++) out[j] = h00 * k0.v[j] + h10 * h * k0.d[j] + h01 * k1.v[j] + h11 * h * k1.d[j];
    return out;
  };
}

/* C2-stetiger kubischer Spline durch Zeit-Stützpunkte (glatte Beschleunigung → ruhige Lage).
   Anfang natürlich, Ende mit vorgegebener Geschwindigkeit endV (z. B. 0 = Stillstand). */
function makeSpline(keys, endV) {
  const n = keys.length, dim = keys[0].v.length, t = keys.map(k => k.t), M = [];
  for (let j = 0; j < dim; j++) {
    const y = keys.map(k => k.v[j]), a = new Array(n).fill(0), b = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
    b[0] = 1; d[0] = 0;
    for (let i = 1; i < n - 1; i++) {
      const h0 = t[i] - t[i - 1], h1 = t[i + 1] - t[i];
      a[i] = h0 / 6; b[i] = (h0 + h1) / 3; c[i] = h1 / 6; d[i] = (y[i + 1] - y[i]) / h1 - (y[i] - y[i - 1]) / h0;
    }
    const hl = t[n - 1] - t[n - 2]; a[n - 1] = hl / 6; b[n - 1] = hl / 3; d[n - 1] = (endV ? endV[j] : 0) - (y[n - 1] - y[n - 2]) / hl;
    for (let i = 1; i < n; i++) { const m = a[i] / b[i - 1]; b[i] -= m * c[i - 1]; d[i] -= m * d[i - 1]; }
    const m2 = new Array(n); m2[n - 1] = d[n - 1] / b[n - 1];
    for (let i = n - 2; i >= 0; i--) m2[i] = (d[i] - c[i] * m2[i + 1]) / b[i];
    M.push({ y, m2 });
  }
  return (tt, out) => {
    const q = Math.min(t[n - 1], Math.max(t[0], tt));
    let i = 0; while (i < n - 2 && q >= t[i + 1]) i++;
    const h = t[i + 1] - t[i], A = (t[i + 1] - q) / h, B = (q - t[i]) / h;
    for (let j = 0; j < dim; j++) { const { y, m2 } = M[j]; out[j] = A * y[i] + B * y[i + 1] + ((A * A * A - A) * m2[i] + (B * B * B - B) * m2[i + 1]) * h * h / 6; }
    return out;
  };
}

function webgl2(canvas, soft) {
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !soft });
    if (!gl || soft) return gl;
    // Software-Rasterizer (kein Grafikchip) → lieber das leichte alte Intro
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) { const lc = gl.getExtension('WEBGL_lose_context'); lc && lc.loseContext(); return null; }
    return gl;
  } catch (e) { return null; }
}

/* ======================================================================== */
export async function playIntro(root, opts = {}) {
  const gsap = window.gsap;
  if (!root || !gsap) return false;
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM && !opts.debug) return false;

  const O = Object.assign({}, FCS_DEFAULTS, opts);
  O.ring = Object.assign({}, FCS_DEFAULTS.ring, opts.ring || {});
  O.colors = Object.assign({}, FCS_DEFAULTS.colors, opts.colors || {});
  const VB = (Array.isArray(O.viewBox) ? O.viewBox : String(O.viewBox).trim().split(/[\s,]+/)).map(Number);
  const RR = O.ring.r;                                             // 1 Welteinheit = Außenradius des Logo-Rings
  const ringW = (O.ring.w || RR * 0.086) / RR;                     // Ringbreite in Welteinheiten
  const toW = (x, y) => [(x - O.ring.cx) / RR, -(y - O.ring.cy) / RR];
  const propsW = O.props.map(p => toW(p[0], p[1]));
  const propR = (O.propR || RR * 0.24) / RR, propW = (O.propW || RR * 0.043) / RR, motorR = (O.motorR || RR * 0.07) / RR;
  const CA = hex3(O.colors.a), CB = hex3(O.colors.b), CINK = hex3(O.colors.ink);

  /* --- Bühne, sofort sichtbar --- */
  const glCanvas = document.createElement('canvas');
  glCanvas.className = 'i3d-gl';
  const gl = webgl2(glCanvas, !!O.allowSoftwareGL);
  if (!gl) return false;

  const stage = document.createElement('div');
  stage.className = 'i3d-stage';
  stage.style.setProperty('--i3d-a', O.colors.a);
  stage.style.setProperty('--i3d-b', O.colors.b);
  stage.innerHTML =
    '<canvas class="i3d-noise"></canvas>' +
    '<div class="i3d-boot"><p class="i3d-b1"></p><p class="i3d-b2">BAT <b>16.8V</b> · RSSI <b>99</b> · CH <b>R4 5769</b></p></div>' +
    '<div class="i3d-osd"><span class="i3d-o i3d-tl"><i class="i3d-rec"></i>REC <span data-o="tm">00:00</span></span>' +
    '<span class="i3d-o i3d-tr">BAT <b data-o="bat">16.8V</b> · RSSI <b>99</b></span>' +
    '<span class="i3d-o i3d-bl">CH R4 5769</span><span class="i3d-armed">ARMED</span></div>' +
    '<div class="i3d-title"><div class="i3d-t1"></div><div class="i3d-t2"></div></div>';
  stage.insertBefore(glCanvas, stage.firstChild);
  glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!finished) { if (ready3d) finish(); else fail(); } });
  const $ = s => stage.querySelector(s);
  const noiseCv = $('.i3d-noise'), boot = $('.i3d-boot'), b1 = $('.i3d-b1'), osd = $('.i3d-osd'), armed = $('.i3d-armed');
  const titleWrap = $('.i3d-title'), t1 = $('.i3d-t1'), t2 = $('.i3d-t2'), osdTm = $('[data-o=tm]'), osdBat = $('[data-o=bat]');
  t1.textContent = O.title;
  const skipBtn = root.querySelector('.intro-skip');
  root.insertBefore(stage, skipBtn || null);
  root.classList.add('i3d');
  root.classList.remove('gone');
  const htmlEl = document.documentElement, prevOverflow = htmlEl.style.overflow;
  htmlEl.style.overflow = 'hidden';

  /* --- Zustand, Aufräumen --- */
  let finished = false, exiting = false, ready3d = false, THREE = null, R3 = null, mainTl = null;
  let resolveFn; const done = new Promise(r => (resolveFn = r));
  const t0 = performance.now(), timing = { start: t0 };
  if (opts.debug) { window.FCSIntro3D = window.FCSIntro3D || {}; window.FCSIntro3D.timing = timing; }
  const cleanups = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };
  const S = { exit: 0 };
  let revealed = false;
  const reveal = () => { if (revealed) return; revealed = true; try { O.onReveal && O.onReveal(); } catch (e) {} };

  function teardown() {
    cleanups.splice(0).forEach(f => { try { f(); } catch (e) {} });
    try { bootTl.kill(); } catch (e) {}
    try { mainTl && mainTl.kill(); } catch (e) {}
    if (R3) { try { R3.dispose(); } catch (e) {} R3 = null; }
    try { const lc = gl.getExtension('WEBGL_lose_context'); lc && lc.loseContext(); } catch (e) {}
    stage.remove();
    root.classList.remove('i3d');
    htmlEl.style.overflow = prevOverflow;
  }
  function finish() {
    if (finished) return; finished = true;
    timing.end = performance.now();
    reveal();
    teardown();
    root.classList.add('gone');
    if (window.FCSIntro3D && window.FCSIntro3D.debug) window.FCSIntro3D.debug.finished = true;
    resolveFn(true);
  }
  function fail() {               // nur solange noch kein 3D zu sehen war
    if (finished) return; finished = true;
    teardown();
    resolveFn(false);
  }

  /* --- Boot: analoges Rauschen (gedämpft) + OSD --- */
  let noiseOn = true; const stopNoiseRaw = startNoise(noiseCv);
  const stopNoise = () => { if (noiseOn) { noiseOn = false; stopNoiseRaw(); } };
  cleanups.push(stopNoise);
  const plug = ['ScrambleTextPlugin'].map(n => window[n]).filter(Boolean);
  if (plug.length) try { gsap.registerPlugin(...plug); } catch (e) {}
  const SCR = !!window.ScrambleTextPlugin;
  if (!SCR) b1.textContent = O.osd;
  const bootTl = gsap.timeline();
  bootTl.fromTo(noiseCv, { opacity: 0 }, { opacity: 0.34, duration: 0.12, ease: 'none' }, 0)
    .to(noiseCv, { opacity: 0.2, duration: 0.4, ease: 'power1.out' }, 0.12)
    .fromTo(b1, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.06)
    .to(b1, SCR ? { duration: 0.46, scrambleText: { text: O.osd, chars: '01#/<>_', speed: 0.9 } } : { duration: 0.46 }, 0.06)
    .fromTo($('.i3d-b2'), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.36)
    .to(boot, { opacity: 0.45, duration: 0.08, repeat: -1, yoyo: true, repeatDelay: 0.32, ease: 'none' }, 0.75); // wartet notfalls auf three.js

  /* --- Überspringen: Ausgang läuft nach Uhrzeit (max. 0,4 s), auch wenn Bilder hängen --- */
  const EXIT_MS = 340;
  function fadeOut(els, ms) { els.forEach(el => { el.style.transition = `opacity ${ms}ms ease-in`; el.style.opacity = '0'; }); }
  function skip() {
    if (finished || exiting) return;
    timing.skip = performance.now();
    const T = mainTl ? mainTl.time() : 0;
    exiting = true; reveal();
    if (!ready3d || !mainTl || T < 1.05) {     // noch keine 3D-Szene sichtbar: kurz ausblenden
      if (mainTl) mainTl.pause();
      bootTl.pause();
      fadeOut([stage], 300);
      const id = setTimeout(finish, 330); cleanups.push(() => clearTimeout(id));
      return;
    }
    if (T >= TL.portal) { mainTl.timeScale(2.6); const id = setTimeout(finish, 400); cleanups.push(() => clearTimeout(id)); return; }
    S.exitStart = performance.now();
    fadeOut([titleWrap, osd, boot], 180);
    const id = setTimeout(finish, EXIT_MS + 60); cleanups.push(() => clearTimeout(id));   // Sicherheitsnetz: nie länger als 0,4 s
  }
  if (skipBtn) on(skipBtn, 'click', e => { e.stopPropagation(); skip(); });
  on(window, 'keydown', e => {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); skip(); }
  });
  on(root, 'pointerdown', e => {
    if (skipBtn && skipBtn.contains(e.target)) return;
    if (performance.now() - t0 > 1000) skip();
  });

  /* --- three.js laden und Szene bauen --- */
  (async () => {
    try {
      const url = O.threeUrl || new URL('../lib/three.module.min.js', import.meta.url).href;
      const loadP = import(url);
      const timeout = new Promise(r => setTimeout(() => r('timeout'), 3200));
      const mod = await Promise.race([loadP, timeout]);
      if (finished || exiting) return;
      if (mod === 'timeout') { skip(); return; }     // sehr langsame Verbindung: Intro sauber beenden
      THREE = mod;
      if (document.fonts && document.fonts.load) {
        await Promise.race([Promise.all([document.fonts.load('400 100px "Bebas Neue"'), document.fonts.load('600 16px "Chakra Petch"')]), new Promise(r => setTimeout(r, 700))]).catch(() => {});
      }
      if (finished || exiting) return;
      R3 = await buildScene(THREE, {
        canvas: glCanvas, gl, stage, O, CA, CB, CINK, VB, propsW, propR, propW, motorR, ringW, S,
        titleEl: t1, subEl: t2, titleWrap, armedEl: armed
      });
      if (finished || exiting) { R3 && R3.dispose(); R3 = null; return; }
      startMain();
    } catch (err) {
      if (O.debug) console.warn('[intro3d]', err);
      const T = mainTl ? mainTl.time() : 0;
      if (!ready3d || T < 0.8) fail(); else finish();
    }
  })();

  function startMain() {
    ready3d = true;
    const chars = manualSplit(t1);          // Buchstaben einzeln (wie SplitText, ohne Schrift-Wartezeit)
    R3.layout();

    mainTl = gsap.timeline({ paused: true, onComplete: finish });
    const tl = mainTl;
    tl.set({}, {}, TL.end);
    // Übergang Boot → 3D
    tl.fromTo(glCanvas, { opacity: 0 }, { opacity: 1, duration: 0.32, ease: 'power1.out', immediateRender: true }, TL.bootEnd)
      .fromTo(noiseCv, { opacity: 0.2 }, { opacity: 0, duration: 0.45, ease: 'power1.in', immediateRender: false }, TL.bootEnd)
      .fromTo(boot, { opacity: 1, y: 0, scaleY: 1 }, { opacity: 0, y: -10, scaleY: 0.4, duration: 0.22, ease: 'power2.in', immediateRender: false }, TL.bootEnd)
      .fromTo(osd.querySelectorAll('.i3d-o'), { opacity: 0 }, { opacity: 0.88, duration: 0.18, stagger: 0.06, immediateRender: true }, 0.95)
      // Titel knallt rein
      .fromTo(chars, { opacity: 0, scale: 2.6, yPercent: -18 },
        { opacity: 1, scale: 1, yPercent: 0, duration: 0.62, ease: 'expo.out', stagger: { each: 0.028, from: 'center' }, immediateRender: true }, TL.title)
      .fromTo(t1, { filter: 'blur(10px)' }, { filter: 'blur(0px)', duration: 0.34, ease: 'power2.out', immediateRender: true }, TL.title)
      .fromTo(t1, { '--i3d-glow': 0 }, { '--i3d-glow': 1, duration: 0.12, ease: 'none', immediateRender: true }, TL.title + 0.2)
      .to(t1, { '--i3d-glow': 0, duration: 0.6, ease: 'power2.out' }, TL.title + 0.32)
      .fromTo(t2, { opacity: 0 }, { opacity: 1, duration: 0.05, immediateRender: true }, TL.sub)
      // ARMED blinkt zweimal (OSD)
      .fromTo(armed, { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'none', immediateRender: true }, TL.armed)
      .to(armed, { opacity: 0, duration: 0.04, ease: 'none' }, TL.armed + 0.14)
      .to(armed, { opacity: 1, duration: 0.04, ease: 'none' }, TL.armed + 0.24)
      // Portal
      .call(reveal, null, TL.portal)
      .to(titleWrap, { opacity: 0, scale: 1.14, duration: 0.3, ease: 'power2.in' }, TL.portal)
      .to(osd, { opacity: 0, duration: 0.2, ease: 'power1.in' }, TL.portal);
    if (SCR) tl.to(t2, { duration: 0.55, scrambleText: { text: O.subtitle, chars: '01#/<>_', speed: 1.2 } }, TL.sub);
    else t2.textContent = O.subtitle;

    // Regie-Takt: GSAP aktualisiert die Timeline, danach rendern wir denselben Zeitpunkt
    let last = performance.now(), isLive = false, seeked = false;
    const stats = { frames: 0, renderMs: 0, maxRenderMs: 0, maxGap: 0, long: 0, gaps: [] };
    const tick = () => {
      if (finished || !R3) return;
      const now = performance.now(), gap = now - last; last = now;
      const T = mainTl.time();
      if (S.exitStart) { S.exit = clamp01((now - S.exitStart) / EXIT_MS); S.exit = S.exit * S.exit; }
      const a = performance.now();
      try { R3.render(T, S, revealed); } catch (err) { if (O.debug) console.warn('[intro3d]', err); finish(); return; }
      if (S.exitStart && S.exit >= 1) { finish(); return; }
      const ms = performance.now() - a;
      if (T > TL.bootEnd && T < TL.end) R3.adapt(gap);
      if (O.debug && T > TL.bootEnd && T < TL.end) {
        stats.renders = (stats.renders || 0) + 1; stats.frames++; stats.renderMs += ms; stats.maxRenderMs = Math.max(stats.maxRenderMs, ms);
        if (stats.frames > 2) { stats.maxGap = Math.max(stats.maxGap, gap); if (gap > 50) stats.long++; stats.gaps.push(gap); if (gap > 150 || ms > 50) (stats.slow = stats.slow || []).push([+T.toFixed(2), Math.round(gap), Math.round(ms)]); }
      }
      const live = T >= 1.04 || exiting; if (live !== isLive) { isLive = live; stage.classList.toggle('live', live); }
      if (T > 1.2 && noiseOn && !seeked) stopNoise();
      // OSD-Werte aus der Zeit (deterministisch)
      const ft = Math.max(0, T - TL.bootEnd), sec = Math.floor(ft);
      const tm = '00:0' + Math.min(9, sec); if (osdTm.textContent !== tm) osdTm.textContent = tm;
      const sag = T > 2.42 && T < 3.3; const bt = sag ? '15.9V' : (T >= 3.3 ? '16.6V' : '16.8V');
      if (osdBat.textContent !== bt) { osdBat.textContent = bt; osdBat.classList.toggle('warn', sag); }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
    on(window, 'resize', () => R3 && R3.layout());

    // Start frühestens nach dem Boot
    const wait = Math.max(0, TL.bootEnd * 1000 - (performance.now() - t0));
    const go = () => {
      if (finished || exiting || seeked) return;
      bootTl.pause();
      if (O.hold) { mainTl.pause(TL.bootEnd); }
      else mainTl.play(TL.bootEnd);
    };
    if (wait > 0) { const id = setTimeout(go, wait); cleanups.push(() => clearTimeout(id)); } else go();

    if (O.debug) {
      window.FCSIntro3D = window.FCSIntro3D || {};
      window.FCSIntro3D.stats = stats;
      window.FCSIntro3D.debug = {
        ready: true, stats, tl: mainTl,
        seek(T) {
          seeked = true; bootTl.pause(); mainTl.pause();
          if (T < TL.bootEnd) { mainTl.time(TL.bootEnd, false); bootTl.time(T); gsap.set(boot, { opacity: 1, y: 0, scaleY: 1 }); }
          else mainTl.time(T, false);
          R3.render(Math.max(T, TL.bootEnd), S, revealed); return T;
        },
        skip, layout: () => R3.layoutInfo(), r3: () => R3, S
      };
    }
  }

  return done;
}

/* Fallback ohne SplitText */
function manualSplit(el) {
  const txt = el.textContent; el.textContent = '';
  el.setAttribute('aria-label', txt);
  return [...txt].map(c => { const s = document.createElement('span'); s.className = 'i3d-ch'; s.style.display = 'inline-block'; s.setAttribute('aria-hidden', 'true'); s.textContent = c === ' ' ? '\u00a0' : c; el.appendChild(s); return s; });
}

/* Analoges FPV-Rauschen: klein, weich hochskaliert, 30 Bilder/s, gedämpft */
function startNoise(cv) {
  const w = 168, h = 100; cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { alpha: false }); if (!cx) return () => {};
  const img = cx.createImageData(w, h), d = img.data;
  let run = true, f = 0, raf = 0;
  const loop = () => {
    if (!run) return;
    if ((f++ & 1) === 0) {
      const roll = (performance.now() * 0.06) % (h + 30) - 15;
      for (let y = 0; y < h; y++) {
        const streak = Math.random() < 0.05 ? 50 : 0, band = Math.abs(y - roll) < 7 ? 28 : 0, base = 30 + streak + band;
        for (let x = 0; x < w; x++) {
          const v = base + Math.random() * 110, i = (y * w + x) << 2;
          d[i] = v * 0.86; d[i + 1] = v * 0.96; d[i + 2] = v * 1.08; d[i + 3] = 255;
        }
      }
      cx.putImageData(img, 0, 0);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { run = false; cancelAnimationFrame(raf); };
}

/* ======================================================================== */
/*  3D-Szene                                                                 */
/* ======================================================================== */
async function buildScene(T, C) {
  const { canvas, gl, stage, O, CA, CB, CINK, VB, propsW, propR, propW, motorR, ringW, S } = C;
  const coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  const dprCap = coarse ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);

  const renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(dpr);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.03, 160);
  const disposables = [];
  const track = o => { disposables.push(o); return o; };
  const V3 = a => new T.Vector3(a[0], a[1], a[2]);
  const U = (v) => ({ value: v });

  /* gemeinsame Uniforms: Scan-Linie (alles mit dot(p,dir) < c ist schon Logo) */
  const scanDir = new T.Vector2(0.62, -0.785).normalize();
  const uScanDir = U(scanDir), uScanC = U(-100);
  const clip = new T.Plane(new T.Vector3(scanDir.x, scanDir.y, 0), 100);   // behält dot(p,dir) - c >= 0

  /* ---------- Hintergrund (Schleier) ---------- */
  const veilMat = track(new T.ShaderMaterial({
    uniforms: { uRes: U(new T.Vector2(1, 1)), uC: U(new T.Vector2(0, 0)), uR: U(300), uTime: U(0), uGrain: U(0.035), uGlow: U(0.6) },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform vec2 uRes,uC;uniform float uR,uTime,uGrain,uGlow;
      void main(){vec2 px=gl_FragCoord.xy;vec2 q=(px-uC)/uR;float g=exp(-dot(q,q)*.55)*uGlow;
        vec3 col=mix(vec3(.008,.02,.043),vec3(.035,.075,.15),g);
        vec2 uv=px/uRes-.5;uv.x*=uRes.x/uRes.y;col*=mix(.5,1.,smoothstep(1.15,.25,length(uv)));
        float n=fract(sin(dot(floor(px)+fract(uTime*7.13)*97.,vec2(12.9898,78.233)))*43758.5453);
        col+=(n-.5)*uGrain;gl_FragColor=vec4(col,1.);}`,
    depthTest: false, depthWrite: false, blending: T.NoBlending
  }));
  const veil = new T.Mesh(track(new T.PlaneGeometry(2, 2)), veilMat);
  veil.frustumCulled = false; veil.renderOrder = -100; scene.add(veil);

  /* ---------- Portal-Stanze (zuletzt): innen durchsichtig, Rand leuchtet ---------- */
  const punchMat = track(new T.ShaderMaterial({
    uniforms: { uHole: U(new T.Vector3(0, 0, -10)), uRim: U(0), uA: U(V3(CA)), uSoft: U(1.5) },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform vec3 uHole,uA;uniform float uRim,uSoft;
      void main(){float dh=length(gl_FragCoord.xy-uHole.xy)-uHole.z;float inside=1.-smoothstep(-uSoft,uSoft,dh);
        float w=max(2.,uHole.z*.035);float rim=exp(-abs(dh)/w)*uRim;
        gl_FragColor=vec4(uA*rim+vec3(1.)*rim*rim*.35,inside);}`,
    depthTest: false, depthWrite: false, transparent: true,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
    blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor
  }));
  const punch = new T.Mesh(veil.geometry, punchMat);
  punch.frustumCulled = false; punch.renderOrder = 1000; scene.add(punch);

  /* ---------- Licht ---------- */
  scene.add(new T.HemisphereLight(0x9cc4ff, 0x2a3c58, 1.7));
  const key = new T.DirectionalLight(0xffffff, 2.6); key.position.set(2.2, 3.5, 7); scene.add(key);
  const rimA = new T.DirectionalLight(new T.Color().setRGB(CA[0], CA[1], CA[2], T.SRGBColorSpace), 2.2); rimA.position.set(-4, 2, -3); scene.add(rimA);
  const rimB = new T.DirectionalLight(new T.Color().setRGB(CB[0], CB[1], CB[2], T.SRGBColorSpace), 1.6); rimB.position.set(4, -1.5, -2.5); scene.add(rimB);
  const gateLight = new T.PointLight(new T.Color().setRGB(CA[0], CA[1], CA[2], T.SRGBColorSpace), 0, 3.2, 2); scene.add(gateLight);

  /* ---------- kleine Texturen aus Canvas ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const dotTex = (() => {
    const c = mkCanvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.75)'); g.addColorStop(0.5, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return track(new T.CanvasTexture(c));
  })();
  const flareTex = (() => {
    const c = mkCanvas(256, 32), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 32);
    x.globalCompositeOperation = 'destination-in';
    const v = x.createLinearGradient(0, 0, 0, 32); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = v; x.fillRect(0, 0, 256, 32); return track(new T.CanvasTexture(c));
  })();
  const carbonTex = (() => {
    const c = mkCanvas(64, 64), x = c.getContext('2d'); x.fillStyle = '#16191e'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const hor = (i + j) % 2 === 0, g = hor ? x.createLinearGradient(i * 8, 0, i * 8 + 8, 0) : x.createLinearGradient(0, j * 8, 0, j * 8 + 8);
      g.addColorStop(0, '#101317'); g.addColorStop(0.5, '#2a3038'); g.addColorStop(1, '#101317'); x.fillStyle = g; x.fillRect(i * 8 + 0.5, j * 8 + 0.5, 7, 7);
    }
    const t = track(new T.CanvasTexture(c)); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = T.SRGBColorSpace; return t;
  })();

  /* Logo als Textur (scharf) + weiche Version fürs Leuchten — exakt der echte SVG-Pfad */
  const logoSize = Math.min(2048, Math.max(1024, Math.ceil(Math.min(innerWidth, innerHeight) * 0.75 * dpr / 512) * 512));
  const drawLogo = (size, blur) => {
    const c = mkCanvas(size, size), x = c.getContext('2d');
    const path = new Path2D(O.logoPath);
    if (blur && 'filter' in x) x.filter = `blur(${blur}px)`;
    x.setTransform(size / VB[2], 0, 0, size / VB[3], -VB[0] * size / VB[2], -VB[1] * size / VB[3]);
    x.fillStyle = '#fff'; x.fill(path, 'evenodd');
    return c;
  };
  const logoTex = track(new T.CanvasTexture(drawLogo(logoSize, 0)));
  logoTex.anisotropy = 4; logoTex.generateMipmaps = true; logoTex.minFilter = T.LinearMipmapLinearFilter;
  const glowTex = track(new T.CanvasTexture(drawLogo(128, 3)));

  /* ---------- Gate-Ring (LED) ---------- */
  const ringRc = 1 - ringW / 2, ringRt = ringW / 2;      // deckungsgleich mit dem Logo-Ring
  const ringU = {
    uA: U(V3(CA)), uB: U(V3(CB)), uInk: U(V3(CINK)), uDraw: U(0), uPulse: U(0), uWhite: U(0), uGain: U(1), uTime: U(0),
    uScanDir, uScanC, uHalo: U(0), uFlash: U(0)
  };
  const ringVS = `varying vec2 vL;varying vec3 vN,vV,vW;
    void main(){vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vL=position.xy;
      vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`;
  const ringFS = `uniform vec3 uA,uB,uInk;uniform float uDraw,uPulse,uWhite,uGain,uTime,uHalo,uFlash,uScanC;uniform vec2 uScanDir;
    varying vec2 vL;varying vec3 vN,vV,vW;
    void main(){
      if(dot(vW.xy,uScanDir)<uScanC)discard;
      float vAng=atan(vL.y,vL.x);
      float d=abs(mod(vAng-1.5707963+3.14159265,6.2831853)-3.14159265);   // Abstand vom oberen Punkt 0..pi
      float soft=uHalo>0.?.22:.025;float lim=uDraw*(3.1416+soft*2.);float lit=smoothstep(lim+soft,lim-soft,d)*smoothstep(0.,.04,uDraw);
      float head=exp(-max(lim-d,0.)*7.)*lit*(1.-smoothstep(.97,1.,uDraw));
      float side=smoothstep(-.55,.55,cos(vAng));
      vec3 col=mix(uA,uB,side);col+=vec3(.25)*(1.-abs(side*2.-1.));
      float n=110.;float f=fract(vAng/6.2831853*n);float led=.62+.38*smoothstep(.36,.08,abs(f-.5));
      float wave=exp(-pow((d-uPulse*3.4)*2.2,2.))*step(.001,uPulse)*(1.-uPulse);
      float b=lit*(1.+head*2.2+wave*2.5+uFlash*1.6);
      col=mix(col,uInk,uWhite);
      float nv=abs(dot(normalize(vN),normalize(vV)));
      vec3 c;
      if(uHalo>0.){c=col*pow(nv,uHalo)*b;}
      else{led=mix(led,1.,uWhite);c=mix(col,vec3(1.),.42+head*.4)*led*b*(.75+.35*nv);}
      gl_FragColor=vec4(c*uGain,1.);}`;
  const mkRingMat = (halo, gain, own) => {
    const u = Object.assign({}, ringU, { uHalo: U(halo), uGain: own || U(gain) });
    return track(new T.ShaderMaterial({ uniforms: u, vertexShader: ringVS, fragmentShader: ringFS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  };
  const ringGroup = new T.Group(); scene.add(ringGroup);
  const ringCore = new T.Mesh(track(new T.TorusGeometry(ringRc, ringRt, 14, 220)), mkRingMat(0, 1));
  const ringHalo1 = new T.Mesh(track(new T.TorusGeometry(ringRc, 0.13, 12, 160)), mkRingMat(2.2, 0.55));
  const ringHalo2 = new T.Mesh(track(new T.TorusGeometry(ringRc, 0.38, 12, 140)), mkRingMat(3.2, 0.28));
  ringCore.renderOrder = 3; ringHalo1.renderOrder = 2; ringHalo2.renderOrder = 2;
  ringGroup.add(ringHalo2, ringHalo1, ringCore);
  const ringMats = [ringCore.material, ringHalo1.material, ringHalo2.material];

  /* ---------- Drohne ---------- */
  // Lokale Achsen: X rechts, Y oben, Z Nase. Endlage: Y → Kamera (+Z Welt), Nase → oben (+Y Welt)
  const qFinal = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(-1, 0, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0)));
  const propsL = propsW.map(([wx, wy]) => ({ x: -wx, z: wy, front: wy >= 0 }));
  const drone = new T.Group(); scene.add(drone);
  const body = new T.Group(); drone.add(body);
  const stdMat = o => track(new T.MeshStandardMaterial(Object.assign({ clippingPlanes: [clip] }, o)));
  const mCarbon = stdMat({ color: 0xffffff, map: carbonTex, roughness: 0.42, metalness: 0.35 });
  const mDuct = stdMat({ color: 0x29313b, roughness: 0.3, metalness: 0.2 });
  const mMotor = stdMat({ color: 0x2b3038, roughness: 0.28, metalness: 0.8 });
  const mBell = stdMat({ color: 0xb9c3cf, roughness: 0.22, metalness: 0.9 });
  const mBatt = stdMat({ color: 0x1d222a, roughness: 0.55, metalness: 0.1 });
  const mStrap = stdMat({ color: new T.Color().setRGB(CB[0], CB[1], CB[2], T.SRGBColorSpace), roughness: 0.6, metalness: 0, emissive: new T.Color().setRGB(CB[0], CB[1], CB[2], T.SRGBColorSpace), emissiveIntensity: 0.25 });
  const mLens = stdMat({ color: 0x05080e, roughness: 0.08, metalness: 0.4, emissive: new T.Color().setRGB(CA[0], CA[1], CA[2], T.SRGBColorSpace), emissiveIntensity: 0.35 });
  const nP = propsL.length;
  const dummy = new T.Object3D();
  const inst = (geo, mat, n, fn) => { const m = new T.InstancedMesh(track(geo), mat, n); for (let i = 0; i < n; i++) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); fn(dummy, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); } m.instanceMatrix.needsUpdate = true; return m; };
  // Arme
  body.add(inst(new T.BoxGeometry(1, 1, 1), mCarbon, nP, (o, i) => { const p = propsL[i], L = Math.hypot(p.x, p.z); o.position.set(p.x / 2, 0, p.z / 2); o.rotation.y = Math.atan2(p.x, p.z); o.scale.set(0.05, 0.022, L); }));
  // Mittelplatte + Stack + Akku + Gurt
  const plate = new T.Mesh(track(new T.BoxGeometry(0.22, 0.024, 0.22)), mCarbon); body.add(plate);
  const stack = new T.Mesh(track(new T.BoxGeometry(0.15, 0.04, 0.15)), mBatt); stack.position.y = 0.032; body.add(stack);
  const batt = new T.Mesh(track(new T.BoxGeometry(0.135, 0.07, 0.27)), mBatt); batt.position.y = 0.088; body.add(batt);
  const strap = new T.Mesh(track(new T.BoxGeometry(0.142, 0.074, 0.032)), mStrap); strap.position.set(0, 0.088, 0.035); body.add(strap);
  // FPV-Kamera vorn, Antenne hinten
  const cam = new T.Mesh(track(new T.BoxGeometry(0.075, 0.062, 0.05)), mBatt); cam.position.set(0, 0.05, 0.165); cam.rotation.x = -0.32; body.add(cam);
  const lens = new T.Mesh(track(new T.CylinderGeometry(0.022, 0.026, 0.03, 18)), mLens); lens.rotation.x = Math.PI / 2 - 0.32; lens.position.set(0, 0.058, 0.195); body.add(lens);
  const ant = new T.Mesh(track(new T.CylinderGeometry(0.006, 0.006, 0.15, 6)), mMotor); ant.position.set(0, 0.11, -0.17); ant.rotation.x = -0.6; body.add(ant);
  // Schutzringe (wie im Logo: außen propR, Wandstärke propW)
  const ro = propR, ri = propR - propW;
  const lathe = new T.LatheGeometry([[ri, -0.02], [ro - 0.006, -0.02], [ro, -0.012], [ro, 0.046], [ro - 0.006, 0.054], [ri + 0.004, 0.054], [ri, 0.048], [ri, -0.02]].map(p => new T.Vector2(p[0], p[1])), 56);
  body.add(inst(lathe, mDuct, nP, (o, i) => o.position.set(propsL[i].x, 0, propsL[i].z)));
  // LED-Kante oben auf jedem Ring (vorn Farbe A, hinten B)
  const ledMat = track(new T.MeshBasicMaterial({ color: 0xffffff, clippingPlanes: [clip] }));
  const ledRing = inst(new T.TorusGeometry((ri + ro) / 2, 0.0065, 6, 72), ledMat, nP, (o, i) => { o.position.set(propsL[i].x, 0.056, propsL[i].z); o.rotation.x = Math.PI / 2; });
  propsL.forEach((p, i) => { const c = p.front ? CA : CB; ledRing.setColorAt(i, new T.Color().setRGB(c[0], c[1], c[2], T.SRGBColorSpace)); });
  body.add(ledRing);
  // Motoren
  body.add(inst(new T.CylinderGeometry(motorR * 0.97, motorR, 0.055, 26), mMotor, nP, (o, i) => o.position.set(propsL[i].x, 0.03, propsL[i].z)));
  body.add(inst(new T.CylinderGeometry(motorR * 0.62, motorR * 0.88, 0.012, 26), mBell, nP, (o, i) => o.position.set(propsL[i].x, 0.063, propsL[i].z)));
  // Leuchthof der Ring-LEDs (flach, additiv)
  const haloU = { uScanDir, uScanC, uGain: U(1), uRc: U((ri + ro) / 2) };
  const haloMat = track(new T.ShaderMaterial({
    uniforms: haloU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `attribute vec3 aCol;varying vec3 vCol,vW;varying vec2 vP;
      void main(){vCol=aCol;vP=position.xy;vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform vec2 uScanDir;uniform float uScanC,uGain,uRc;varying vec3 vCol,vW;varying vec2 vP;
      void main(){if(dot(vW.xy,uScanDir)<uScanC)discard;float r=length(vP);float x=(r-uRc)/.05;
        float a=exp(-x*x)*.55+exp(-x*x*.12)*.16;gl_FragColor=vec4(vCol*a*uGain,1.);}`
  }));
  const haloGeo = new T.RingGeometry(ri * 0.55, ro * 1.6, 56, 1);
  const halos = inst(haloGeo, haloMat, nP, (o, i) => { o.position.set(propsL[i].x, 0.05, propsL[i].z); o.rotation.x = -Math.PI / 2; });
  halos.geometry.setAttribute('aCol', new T.InstancedBufferAttribute(new Float32Array(propsL.flatMap(p => (p.front ? CA : CB))), 3));
  halos.renderOrder = 4; body.add(halos);
  // Propeller als drehende Scheiben mit Bewegungsunschärfe → werden zu den Wirbeln des Logos
  const propU = { uTime: U(0), uMorph: U(0), uInk: U(V3(CINK)), uScanDir, uScanC, uAlpha: U(1), uArcR: U(0.66 * propR / (ri - 0.006)) };
  const propMat = track(new T.ShaderMaterial({
    uniforms: propU, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: `attribute vec3 aCol;attribute float aSpin,aArc;varying vec3 vCol,vW;varying vec2 vP;varying float vSpin,vArc;
      void main(){vCol=aCol;vSpin=aSpin;vArc=aArc;vP=position.xy;vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform float uTime,uMorph,uScanC,uAlpha,uArcR;uniform vec3 uInk;uniform vec2 uScanDir;
      varying vec3 vCol,vW;varying vec2 vP;varying float vSpin,vArc;
      void main(){if(dot(vW.xy,uScanDir)<uScanC)discard;
        float r=length(vP)/${(ri - 0.006).toFixed(4)};float ang=atan(-vP.y,vP.x);
        float rot=ang-vSpin*uTime*46.;
        float bl=pow(.5+.5*cos(2.*rot),5.);float bl2=pow(.5+.5*cos(2.*rot+.9),3.);
        float disc=smoothstep(1.,.93,r)*smoothstep(.2,.36,r);
        float da=abs(mod(ang-vArc+3.14159,6.28318)-3.14159);
        float arcMask=smoothstep(.85,.35,da);float arcW=mix(.06,.045,uMorph);
        float arc=exp(-pow((r-uArcR)/arcW,2.))*arcMask;
        vec3 blur=vec3(.55,.62,.72)*(.10+.30*bl+.12*bl2)*disc;
        float aBlur=(.16+.34*bl+.1*bl2)*disc*(1.-uMorph);
        vec3 col=blur*(1.-uMorph)+mix(vCol*.9+vec3(.15),uInk*1.15,uMorph)*arc*mix(.55,1.3,uMorph);
        float a=max(aBlur,arc*mix(.5,1.,uMorph));
        gl_FragColor=vec4(col,a*uAlpha);}`
  }));
  const propGeo = new T.CircleGeometry(ri - 0.006, 56);
  const propMesh = inst(propGeo, propMat, nP, (o, i) => { o.position.set(propsL[i].x, 0.072, propsL[i].z); o.rotation.x = -Math.PI / 2; });
  propMesh.geometry.setAttribute('aCol', new T.InstancedBufferAttribute(new Float32Array(propsL.flatMap(p => (p.front ? CA : CB))), 3));
  propMesh.geometry.setAttribute('aSpin', new T.InstancedBufferAttribute(new Float32Array(propsL.map((p, i) => ((p.x * p.z > 0) ? 1 : -1))), 1));
  // Wirbel zeigt wie im Logo nach außen (weg von der Rumpfmitte); Winkel im Scheibensystem
  propMesh.geometry.setAttribute('aArc', new T.InstancedBufferAttribute(new Float32Array(propsL.map(p => Math.atan2(p.z, p.x))), 1));
  propMesh.renderOrder = 5; body.add(propMesh);
  // LED-Glühpunkte unter den Motoren
  const spr = propsL.map(p => {
    const c = p.front ? CA : CB;
    const m = track(new T.SpriteMaterial({ map: dotTex, color: new T.Color().setRGB(c[0], c[1], c[2], T.SRGBColorSpace), blending: T.AdditiveBlending, depthWrite: false, transparent: true, clippingPlanes: [clip] }));
    const s = new T.Sprite(m); s.position.set(p.x, -0.03, p.z); s.scale.setScalar(0.42); s.renderOrder = 6; drone.add(s); return s;
  });

  /* ---------- Flugbahn (zeitbasiert) und Lage aus Schub = Beschleunigung + Schwerkraft ---------- */
  const pathKeys = [
    { t: 1.00, v: [-9.0, -1.15, -17.5] },
    { t: 1.45, v: [-4.7, -0.7, -10.2] },
    { t: 1.85, v: [-1.55, -0.25, -4.7] },
    { t: 2.25, v: [0.0, -0.05, 0.0] },
    { t: 2.47, v: [0.14, -0.18, 2.45] },
    { t: 2.70, v: [0.1, 0.45, 3.65] },
    { t: 2.95, v: [0.0, 1.55, 3.15] },
    { t: 3.20, v: [-0.1, 2.12, 1.85] },
    { t: 3.46, v: [-0.06, 1.66, 0.68] },
    { t: 3.78, v: [0.0, 0.76, 0.52] },
    { t: 4.08, v: [0.0, 0.17, 0.25] },
    { t: TL.stop, v: [0, 0, 0], ease: true }
  ];
  const path = makeSpline(pathKeys, [0, 0, 0]);
  const HZ = 240, tA = TL.appear, tB = TL.stop, NTAB = Math.ceil((tB - tA) * HZ) + 1;
  const tabP = new Float32Array(NTAB * 3), tabQ = new Float32Array(NTAB * 4);
  {
    const h = 1 / 90, G = 10, p0 = [], p1 = [], p2 = [], ups = new Float32Array(NTAB * 3), vel = new Float32Array(NTAB * 3);
    for (let i = 0; i < NTAB; i++) {
      const t = tA + i / HZ; path(t - h, p0); path(t, p1); path(t + h, p2);
      tabP[i * 3] = p1[0]; tabP[i * 3 + 1] = p1[1]; tabP[i * 3 + 2] = p1[2];
      for (let j = 0; j < 3; j++) { vel[i * 3 + j] = (p2[j] - p0[j]) / (2 * h); ups[i * 3 + j] = (p2[j] - 2 * p1[j] + p0[j]) / (h * h) + (j === 1 ? G : 0); }
    }
    const win = 22, up = new T.Vector3(), fwd = new T.Vector3(1e-6, 0, 1), right = new T.Vector3(), m = new T.Matrix4(), q = new T.Quaternion(), qs = new T.Quaternion(), qy = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
    const lastF = new T.Vector3(0, 0, 1);
    for (let i = 0; i < NTAB; i++) {
      up.set(0, 0, 0);
      for (let k = -win; k <= win; k++) { const j = Math.min(NTAB - 1, Math.max(0, i + k)), w = 1 - Math.abs(k) / (win + 1); up.x += ups[j * 3] * w; up.y += ups[j * 3 + 1] * w; up.z += ups[j * 3 + 2] * w; }
      up.normalize();
      // Nase = Flugrichtung quer zum Schub; bei senkrechtem Flug die letzte Richtung weitertragen
      fwd.set(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]); fwd.addScaledVector(up, -fwd.dot(up));
      const fl = fwd.length(); lastF.addScaledVector(up, -lastF.dot(up)).normalize();
      if (fl > 1e-5) fwd.multiplyScalar(1 / fl); else fwd.copy(lastF);
      fwd.lerp(lastF, 1 - clamp01(fl / 2.5)).normalize(); lastF.copy(fwd);
      right.crossVectors(up, fwd).normalize(); fwd.crossVectors(right, up);
      m.makeBasis(right, up, fwd); q.setFromRotationMatrix(m);
      const t = tA + i / HZ, w = sstep(ramp(t, TL.blendA, tB - 0.06));
      if (w > 0) {
        const spin = Math.PI * 0.5 * (1 - eOut3(ramp(t, TL.blendA, tB)));
        qy.setFromAxisAngle(Y, spin); qs.copy(qFinal).multiply(qy); q.slerp(qs, w);
      }
      if (i > 0 && q.dot(new T.Quaternion(tabQ[i * 4 - 4], tabQ[i * 4 - 3], tabQ[i * 4 - 2], tabQ[i * 4 - 1])) < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; }
      tabQ[i * 4] = q.x; tabQ[i * 4 + 1] = q.y; tabQ[i * 4 + 2] = q.z; tabQ[i * 4 + 3] = q.w;
    }
  }
  const poseP = new T.Vector3(), poseQ = new T.Quaternion(), _qa = new T.Quaternion(), _qb = new T.Quaternion();
  function pose(t, outP, outQ) {
    const f = (Math.min(tB, Math.max(tA, t)) - tA) * HZ, i = Math.min(NTAB - 2, Math.floor(f)), u = f - i;
    outP.set(lerp(tabP[i * 3], tabP[i * 3 + 3], u), lerp(tabP[i * 3 + 1], tabP[i * 3 + 4], u), lerp(tabP[i * 3 + 2], tabP[i * 3 + 5], u));
    _qa.fromArray(tabQ, i * 4); _qb.fromArray(tabQ, i * 4 + 4); outQ.copy(_qa).slerp(_qb, u);
  }

  /* ---------- Lichtspuren (Langzeitbelichtung) aus den vier Motoren ---------- */
  const NS = coarse ? 84 : 120, NT = nP;
  const trailGeo = track(new T.BufferGeometry());
  const tPos = new Float32Array(NT * NS * 2 * 3), tAge = new Float32Array(NT * NS * 2), tSide = new Float32Array(NT * NS * 2), tCol = new Float32Array(NT * NS * 2);
  const tIdx = [];
  for (let k = 0; k < NT; k++) for (let s = 0; s < NS; s++) {
    const b = (k * NS + s) * 2; tAge[b] = tAge[b + 1] = s / (NS - 1); tSide[b] = -1; tSide[b + 1] = 1; tCol[b] = tCol[b + 1] = propsL[k].front ? 0 : 1;
    if (s < NS - 1) tIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  trailGeo.setAttribute('position', new T.BufferAttribute(tPos, 3).setUsage(T.DynamicDrawUsage));
  trailGeo.setAttribute('aAge', new T.BufferAttribute(tAge, 1));
  trailGeo.setAttribute('aSide', new T.BufferAttribute(tSide, 1));
  trailGeo.setAttribute('aCol', new T.BufferAttribute(tCol, 1));
  trailGeo.setIndex(tIdx);
  const trailMat = track(new T.ShaderMaterial({
    uniforms: { uA: U(V3(CA)), uB: U(V3(CB)), uGain: U(1) }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `attribute float aAge,aSide,aCol;varying float vAge,vSide,vCol;void main(){vAge=aAge;vSide=aSide;vCol=aCol;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 uA,uB;uniform float uGain;varying float vAge,vSide,vCol;
      void main(){float core=exp(-vSide*vSide*4.);float hot=exp(-vSide*vSide*28.);float fade=pow(1.-vAge,1.8);
        vec3 c=mix(uA,uB,vCol);gl_FragColor=vec4((c*core*.85+vec3(1.)*hot*.6*pow(1.-vAge,3.))*fade*uGain,1.);}`
  }));
  const trails = new T.Mesh(trailGeo, trailMat); trails.frustumCulled = false; trails.renderOrder = 4; scene.add(trails);
  const motorL = propsL.map(p => new T.Vector3(p.x, 0.035, p.z));
  const _p = new T.Vector3(), _q = new T.Quaternion(), _v = new T.Vector3(), _w = new T.Vector3(), _tan = new T.Vector3(), _side = new T.Vector3();
  const trailPts = new Float32Array(NS * 3);
  function updateTrails(T_, W, camPos, swirl) {
    for (let k = 0; k < NT; k++) {
      let hx = 0, hy = 0;
      for (let s = 0; s < NS; s++) {
        const ts = T_ - W * s / (NS - 1);
        pose(ts, _p, _q); _v.copy(motorL[k]).applyQuaternion(_q).add(_p);
        if (s === 0) { hx = _v.x; hy = _v.y; }
        else if (swirl > 0) {          // Wirbel: Spur dreht sich beim Einsaugen um ihren Propeller
          const dx = _v.x - hx, dy = _v.y - hy, r = Math.hypot(dx, dy), th = swirl * 5.5 * (0.35 + 0.65 * Math.min(r, 2) / 2) * (propsL[k].x * propsL[k].z > 0 ? 1 : -1);
          const c = Math.cos(th), sn = Math.sin(th), sh = Math.exp(-3.4 * swirl);
          _v.x = hx + (dx * c - dy * sn) * sh; _v.y = hy + (dx * sn + dy * c) * sh;
        }
        trailPts[s * 3] = _v.x; trailPts[s * 3 + 1] = _v.y; trailPts[s * 3 + 2] = _v.z;
      }
      for (let s = 0; s < NS; s++) {
        const a = Math.max(0, s - 1), b = Math.min(NS - 1, s + 1);
        _tan.set(trailPts[b * 3] - trailPts[a * 3], trailPts[b * 3 + 1] - trailPts[a * 3 + 1], trailPts[b * 3 + 2] - trailPts[a * 3 + 2]);
        _w.set(camPos.x - trailPts[s * 3], camPos.y - trailPts[s * 3 + 1], camPos.z - trailPts[s * 3 + 2]);
        _side.crossVectors(_tan, _w); const L = _side.length();
        const width = 0.055 * (1 - 0.6 * s / (NS - 1));
        if (L > 1e-9) _side.multiplyScalar(width / L); else _side.set(0, 0, 0);
        const o = (k * NS + s) * 6;
        tPos[o] = trailPts[s * 3] - _side.x; tPos[o + 1] = trailPts[s * 3 + 1] - _side.y; tPos[o + 2] = trailPts[s * 3 + 2] - _side.z;
        tPos[o + 3] = trailPts[s * 3] + _side.x; tPos[o + 4] = trailPts[s * 3 + 1] + _side.y; tPos[o + 5] = trailPts[s * 3 + 2] + _side.z;
      }
    }
    trailGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- Hallenboden: dunkel glänzend, spiegelt Gate und Lichtspuren ---------- */
  const FLOOR_Y = -1.85;
  // Spiegelbilder teilen Geometrie und Shader, haben aber eine eigene Helligkeit
  const uRefl = U(0), uReflT = U(0);
  const mirror = (o, mat) => { const m = new T.Mesh(o.geometry, mat); m.renderOrder = o.renderOrder - 10; m.frustumCulled = false; return m; };
  const reflGroup = new T.Group(); reflGroup.scale.y = -1; reflGroup.position.y = 2 * FLOOR_Y; scene.add(reflGroup);
  const reflRing = new T.Group();
  reflRing.add(mirror(ringHalo2, mkRingMat(3.2, 0, uRefl)), mirror(ringCore, mkRingMat(0, 0, uRefl)));
  reflGroup.add(reflRing);
  const reflTrailMat = track(new T.ShaderMaterial({ uniforms: { uA: trailMat.uniforms.uA, uB: trailMat.uniforms.uB, uGain: uReflT }, vertexShader: trailMat.vertexShader, fragmentShader: trailMat.fragmentShader, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  const reflTrails = mirror(trails, reflTrailMat); reflGroup.add(reflTrails);
  const floorU = { uA: U(V3(CA)), uB: U(V3(CB)), uAlpha: U(0), uGrid: U(0), uFloorY: U(FLOOR_Y) };
  const floorMat = track(new T.ShaderMaterial({
    uniforms: floorU, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW;void main(){vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform float uAlpha,uGrid;uniform vec3 uA,uB;varying vec3 vW;
      void main(){vec2 g=abs(fract(vW.xz*.5)-.5)/fwidth(vW.xz*.5);float line=1.-min(min(g.x,g.y),1.);
        float dist=length(vW.xz-vec2(0.,1.5));float fade=smoothstep(22.,3.,dist);
        float pool=exp(-dot(vW.xz,vW.xz)*.18);
        vec3 col=vec3(.006,.012,.024)+mix(uA,uB,smoothstep(-1.,1.,vW.x))*pool*.05+vec3(.25,.45,.7)*line*.09*uGrid*fade;
        gl_FragColor=vec4(col,.6*fade*uAlpha);}`
  }));
  const floor = new T.Mesh(track(new T.PlaneGeometry(60, 60)), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, -8); floor.renderOrder = -5; scene.add(floor);

  /* ---------- Logo-Ebene (echter SVG-Pfad), Scan, Glitch, Portal-Ring ---------- */
  const lw = VB[2] / O.ring.r, lh = VB[3] / O.ring.r;
  const lcx = (VB[0] + VB[2] / 2 - O.ring.cx) / O.ring.r, lcy = -(VB[1] + VB[3] / 2 - O.ring.cy) / O.ring.r;
  const logoU = {
    uTex: U(logoTex), uGlowTex: U(glowTex), uScanDir, uScanC, uGlitch: U(0), uSeed: U(0), uInk: U(V3(CINK)), uA: U(V3(CA)),
    uGlowAmt: U(0), uInner: U(1), uPortal: U(0), uRin: U(1 - ringW), uRout: U(1), uAlpha: U(1), uHot: U(0)
  };
  const logoMat = track(new T.ShaderMaterial({
    uniforms: logoU, transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true,
    vertexShader: `varying vec2 vUv,vP;void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vP=wp.xy;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform sampler2D uTex,uGlowTex;uniform vec2 uScanDir;uniform float uScanC,uGlitch,uSeed,uGlowAmt,uInner,uPortal,uRin,uRout,uAlpha,uHot;uniform vec3 uInk,uA;
      varying vec2 vUv,vP;
      void main(){
        float sd=dot(vP,uScanDir)-uScanC;float shown=smoothstep(.01,-.01,sd);
        if(shown<=0.)discard;
        vec2 uv=vUv;float sl=floor(vUv.y*26.+uSeed*3.);float rn=fract(sin(sl*91.7+uSeed*13.1)*43758.5);
        uv.x+=uGlitch*(rn-.5)*.07*step(.62,rn);
        float o=uGlitch*.011;
        float aR=texture2D(uTex,uv+vec2(o,0.)).a,aG=texture2D(uTex,uv).a,aB=texture2D(uTex,uv-vec2(o,o*.4)).a;
        float r=length(vP);float fw=fwidth(r)*.9;
        float ring=smoothstep(uRin-fw,uRin+fw,r)*(1.-smoothstep(uRout-fw,uRout+fw,r));
        aR=mix(aR,ring,uPortal);aG=mix(aG,ring,uPortal);aB=mix(aB,ring,uPortal);
        float inner=r<uRin-.004?uInner:1.;
        float edge=exp(-sd*sd*900.)*uHot;
        vec3 ink=uInk+uA*edge*1.5+vec3(edge);
        vec3 col=vec3(aR*ink.r,aG*ink.g,aB*ink.b);
        float a=max(aG,max(aR,aB));
        float gl=texture2D(uGlowTex,vUv).a*uGlowAmt*(1.-uPortal);
        gl_FragColor=vec4((col+uA*gl*.55)*shown*inner*uAlpha,a*shown*inner*uAlpha);}`
  }));
  const logo = new T.Mesh(track(new T.PlaneGeometry(lw, lh)), logoMat);
  logo.position.set(lcx, lcy, 0); logo.renderOrder = 20; scene.add(logo);

  /* Effekt-Ebene: Scanlinie, Druckwelle, Blitz */
  const fxU = { uScanDir, uScanC, uScanOn: U(0), uShockR: U(0), uShockA: U(0), uFlash: U(0), uA: U(V3(CA)), uB: U(V3(CB)) };
  const fxMat = track(new T.ShaderMaterial({
    uniforms: fxU, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    vertexShader: `varying vec2 vP;void main(){vec4 wp=modelMatrix*vec4(position,1.);vP=wp.xy;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform vec2 uScanDir;uniform float uScanC,uScanOn,uShockR,uShockA,uFlash;uniform vec3 uA,uB;varying vec2 vP;
      void main(){vec2 n=vec2(-uScanDir.y,uScanDir.x);float sd=dot(vP,uScanDir)-uScanC;float al=dot(vP,n);
        float ends=smoothstep(1.55,.7,abs(al));
        float line=(exp(-sd*sd*5200.)*1.3+exp(-sd*sd*120.)*.22)*ends*uScanOn;
        float trailS=smoothstep(0.,-.35,sd)*smoothstep(-.6,-.0,sd)*ends*uScanOn*.10;
        float r=length(vP);float w1=.035+uShockR*.05;float d1=r-uShockR;float d2=r-uShockR*.8;
        float s1=exp(-d1*d1/(w1*w1));float s2=exp(-d2*d2/(w1*w1*.6))*.5;
        vec3 sh=(mix(uB,uA,smoothstep(-w1,w1,d1))*s1+uA*s2)*uShockA;
        vec3 col=vec3(1.)*line+uA*trailS+sh+uA*exp(-r*r*2.2)*uFlash*.55+vec3(1.)*exp(-r*r*9.)*uFlash*.35;
        gl_FragColor=vec4(col,1.);}`
  }));
  const fx = new T.Mesh(track(new T.PlaneGeometry(9, 9)), fxMat); fx.position.z = 0.02; fx.renderOrder = 30; scene.add(fx);

  /* Funken */
  const NSP = coarse ? 200 : 320;
  const spGeo = track(new T.BufferGeometry());
  {
    const pos = new Float32Array(NSP * 3), vel = new Float32Array(NSP * 3), life = new Float32Array(NSP), size = new Float32Array(NSP), col = new Float32Array(NSP), dl = new Float32Array(NSP);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < NSP; i++) {
      const fromProp = i % 4 === 0, th = rnd() * Math.PI * 2;
      let ox, oy, sp;
      if (fromProp) { const p = propsW[i % propsW.length]; ox = p[0] + Math.cos(th) * propR * 0.9; oy = p[1] + Math.sin(th) * propR * 0.9; sp = 0.6 + rnd() * 1.4; dl[i] = 0; }
      else { ox = Math.cos(th) * (1 - ringW * rnd()); oy = Math.sin(th) * (1 - ringW * rnd()); sp = 1.2 + rnd() * 3.4; dl[i] = 0.06 + rnd() * 0.05; }
      pos[i * 3] = ox; pos[i * 3 + 1] = oy; pos[i * 3 + 2] = 0.03;
      const tx = -Math.sin(th), ty = Math.cos(th), tj = (rnd() - 0.5) * 1.1;
      vel[i * 3] = Math.cos(th) * sp + tx * tj; vel[i * 3 + 1] = Math.sin(th) * sp + ty * tj; vel[i * 3 + 2] = rnd() * 1.5;
      life[i] = 0.45 + rnd() * 0.75; size[i] = 1.6 + rnd() * 3.2; col[i] = rnd();
    }
    spGeo.setAttribute('position', new T.BufferAttribute(pos, 3)); spGeo.setAttribute('aVel', new T.BufferAttribute(vel, 3));
    spGeo.setAttribute('aLife', new T.BufferAttribute(life, 1)); spGeo.setAttribute('aSize', new T.BufferAttribute(size, 1));
    spGeo.setAttribute('aCol', new T.BufferAttribute(col, 1)); spGeo.setAttribute('aDelay', new T.BufferAttribute(dl, 1));
  }
  const spMat = track(new T.ShaderMaterial({
    uniforms: { uT: U(-1), uDpr: U(dpr), uA: U(V3(CA)), uB: U(V3(CB)), uPx: U(1) }, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec3 aVel;attribute float aLife,aSize,aCol,aDelay;uniform float uT,uDpr,uPx;varying float vAge,vCol;
      void main(){float t=uT-aDelay;vAge=t/aLife;vCol=aCol;
        if(t<0.||vAge>1.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}
        vec3 p=position+aVel*(1.-exp(-2.4*t))/2.4;p.y-=.35*t*t;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=aSize*uDpr*uPx*(1.-vAge*.7);}`,
    fragmentShader: `uniform vec3 uA,uB;varying float vAge,vCol;
      void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c)*4.;float a=exp(-d*3.)*(1.-vAge);
        vec3 col=mix(vec3(1.),mix(uA,uB,step(.5,vCol)),smoothstep(.0,.5,vAge));gl_FragColor=vec4(col*a*1.4,1.);}`
  }));
  const sparks = new T.Points(spGeo, spMat); sparks.frustumCulled = false; sparks.renderOrder = 40; scene.add(sparks);

  /* Schwebeteilchen (Hallenluft), vom Ring angestrahlt */
  const ND = coarse ? 360 : 620;
  const duGeo = track(new T.BufferGeometry());
  {
    const pos = new Float32Array(ND * 3), sd = new Float32Array(ND); let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < ND; i++) { pos[i * 3] = (rnd() - 0.5) * 9; pos[i * 3 + 1] = (rnd() - 0.5) * 6.5 + 0.4; pos[i * 3 + 2] = -14 + rnd() * 22; sd[i] = rnd(); }
    duGeo.setAttribute('position', new T.BufferAttribute(pos, 3)); duGeo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
  }
  const duMat = track(new T.ShaderMaterial({
    uniforms: { uTime: U(0), uDpr: U(dpr), uAlpha: U(0), uRing: U(0), uA: U(V3(CA)), uPx: U(1) }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute float aSeed;uniform float uTime,uDpr,uRing,uPx;varying float vB;
      void main(){vec3 p=position;p.x+=sin(uTime*.4+aSeed*40.)*.06;p.y+=cos(uTime*.33+aSeed*23.)*.05;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        float dr=abs(length(p.xy)-.96)+abs(p.z)*.7;vB=.22+uRing*exp(-dr*1.6)*1.2;
        gl_PointSize=clamp((1.2+aSeed*2.2)*uDpr*uPx*5./max(.3,-mv.z),1.,9.);}`,
    fragmentShader: `uniform float uAlpha;uniform vec3 uA;varying float vB;
      void main(){vec2 c=gl_PointCoord-.5;float a=exp(-dot(c,c)*14.);gl_FragColor=vec4(mix(vec3(.75,.85,1.),uA,.35)*a*vB*uAlpha,1.);}`
  }));
  const dust = new T.Points(duGeo, duMat); dust.frustumCulled = false; dust.renderOrder = 1; scene.add(dust);

  /* Anamorph-Streifen für die großen Lichtmomente */
  const flareMat = track(new T.SpriteMaterial({ map: flareTex, color: new T.Color().setRGB(CA[0], CA[1], CA[2], T.SRGBColorSpace), blending: T.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
  const flare = new T.Sprite(flareMat); flare.renderOrder = 50; scene.add(flare);

  /* ---------- Layout: wo das Logo am Ende sitzt (Pixel) ---------- */
  const L = {};
  function layout() {
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
    const portrait = H >= W * 1.05;
    // Logo: hochkant ca. 70 % der Breite, quer ca. die Hälfte der Höhe
    let d = portrait ? Math.min(W * 0.70, H * 0.47) : Math.min(W * 0.6, H * 0.5);
    // Titel einpassen (gemessen in der echten Schrift)
    const t1 = C.titleEl, t2 = C.subEl;
    t1.style.fontSize = '100px'; const em = Math.max(1, t1.scrollWidth) / 100;
    const subTxt = t2.textContent; t2.textContent = O.subtitle; t2.style.fontSize = '20px';
    const sem = Math.max(1, t2.scrollWidth) / 20; t2.textContent = subTxt;
    const topRes = 62, botRes = 44;                    // Platz für OSD-Zeile/ARMED oben und Knopf unten
    let ts, ss, gap1, th, gap2, sh, block;
    for (let i = 0; i < 4; i++) {
      ts = Math.max(28, Math.min(d * 0.27, (W * 0.88) / em));
      ss = Math.min(Math.max(15, ts * 0.16), 24, (W * 0.9) / sem);
      gap1 = d * 0.1; th = ts * 0.92; gap2 = Math.max(8, ts * 0.2); sh = ss * 1.3;
      block = d + gap1 + th + gap2 + sh;
      if (block <= H - topRes - botRes) break;
      d *= (H - topRes - botRes) / block;            // niedrige Querformate: Logo etwas kleiner
    }
    t1.style.fontSize = ts.toFixed(1) + 'px';
    t2.style.fontSize = ss.toFixed(1) + 'px';
    const top = Math.max(topRes, (H - block) / 2 - H * 0.012);
    Object.assign(L, { W, H, portrait, d, rpx: d / 2, cx: W / 2, cy: top + d / 2, titleTop: top + d + gap1, ts, ss });
    C.titleWrap.style.top = L.titleTop.toFixed(1) + 'px';
    t2.style.marginTop = gap2.toFixed(1) + 'px';
    if (C.armedEl) C.armedEl.style.setProperty('--i3d-armed-top', Math.max(38, Math.min(46, top - 30)).toFixed(0) + 'px');
    renderer.setSize(W, H, false);
    veilMat.uniforms.uRes.value.set(W * dpr, H * dpr);
    buildCam();
  }
  function layoutInfo() { return Object.assign({}, L, { dpr }); }

  /* ---------- Kamera-Regie: Ziel, Richtung, Bildausschnitt (Radius), Brennweite, Rollen ---------- */
  // frameR = sichtbarer Radius um das Ziel in der kürzeren Bildachse → Dolly-Zoom bleibt formstabil
  let camTrack = null;
  const FINAL_FOV = 8;
  function buildCam() {
    const frameF = (Math.min(L.W, L.H) / 2) / L.rpx;
    const oy = (L.H / 2 - L.cy) / L.rpx, ox = (L.cx - L.W / 2) / L.rpx;
    const tf = [-ox, -oy, 0];
    const k = (t, tg, dir, fr, fov, roll, ease) => ({ t, v: [tg[0], tg[1], tg[2], dir[0], dir[1], dir[2], fr, fov, roll], ease });
    camTrack = makeTrack([
      k(0.70, [0.0, 0.05, 0], [0.5, 0.12, 1], 2.75, 36, 0),
      k(1.45, [0.0, 0.0, -0.4], [0.42, 0.07, 1], 2.3, 38, -0.02),
      k(2.05, [0.0, -0.02, -0.5], [0.36, 0.03, 1], 2.15, 40, -0.03),
      k(2.30, [0.06, -0.06, 0.55], [0.5, 0.02, 1], 2.35, 43, 0.0),
      k(2.72, [0.0, 0.75, 1.75], [1.0, -0.1, 0.8], 2.95, 46, 0.04),
      k(3.18, [0.0, 1.0, 1.7], [1.0, -0.06, 0.3], 3.1, 44, 0.02),
      k(3.66, [0.0, 0.6, 0.6], [0.6, 0.0, 1], 2.4, 36, 0.0),
      k(4.12, [tf[0] * 0.7, tf[1] * 0.7, 0.1], [0.05, -0.01, 1], frameF * 1.02, 18, 0),
      k(4.62, tf, [0, 0, 1], frameF, FINAL_FOV, 0, true),
      k(TL.end, tf, [0, 0, 1], frameF, FINAL_FOV, 0, true)
    ]);
    L.frameF = frameF; L.tf = tf;
  }

  const cv = new Array(9).fill(0), tgt = new T.Vector3(), dir = new T.Vector3();
  const followK = makeTrack([{ t: 1.7, v: [0], ease: true }, { t: 2.2, v: [0.45] }, { t: 2.7, v: [0.28] }, { t: 3.2, v: [0.25] }, { t: 3.6, v: [0.4] }, { t: 4.05, v: [0], ease: true }]);
  const fk = [0], fp = new T.Vector3(), fq = new T.Quaternion();
  function placeCamera(T_, flyIn) {
    camTrack(T_, cv);
    tgt.set(cv[0], cv[1], cv[2]); dir.set(cv[3], cv[4], cv[5]).normalize();
    followK(T_, fk);
    if (fk[0] > 0.001) { pose(T_, fp, fq); tgt.lerp(fp, fk[0]); }
    const fovMinor = cv[7], fr = cv[6];
    let dist = fr / Math.tan(fovMinor * Math.PI / 360);
    if (flyIn > 0) dist /= (1 + 7.5 * Math.pow(flyIn, 2.3));
    // kleines Rütteln bei Durchflug und Druckwelle
    const sh = decay(T_, TL.gate, 0.35) * 0.018 + decay(T_, TL.burst, 0.25) * 0.004;
    if (sh > 0) tgt.add(_v.set(Math.sin(T_ * 91) * sh, Math.cos(T_ * 77) * sh, 0));
    const aspect = L.W / L.H;
    camera.fov = aspect >= 1 ? fovMinor : 2 * Math.atan(Math.tan(fovMinor * Math.PI / 360) / aspect) * 180 / Math.PI;
    camera.aspect = aspect;
    camera.position.copy(tgt).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0); camera.lookAt(tgt); camera.rotateZ(cv[8]);
    camera.near = Math.max(0.03, Math.min(dist * 0.02, 0.5)); camera.far = dist + 60;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return dist;
  }
  const _pr = new T.Vector3();
  function toPx(v) { _pr.copy(v).project(camera); return [(_pr.x * 0.5 + 0.5) * L.W, (0.5 - _pr.y * 0.5) * L.H]; }

  /* ---------- Bild für Zeit T ---------- */
  let qualityDrops = 0; const gaps = [];
  function adapt(gap) {                  // Stellschraube: Pixeldichte senken, wenn es dauerhaft ruckelt
    gaps.push(gap); if (gaps.length < 24) return; const g = gaps.splice(0).sort((a, b) => a - b)[12];
    if (g > 26 && dpr > 1 && qualityDrops < 2) { qualityDrops++; dpr = Math.max(1, dpr - 0.35); renderer.setPixelRatio(dpr); renderer.setSize(L.W, L.H, false); veilMat.uniforms.uRes.value.set(L.W * dpr, L.H * dpr); spMat.uniforms.uDpr.value = dpr; duMat.uniforms.uDpr.value = dpr; }
  }

  const ink0 = new T.Vector3(), centerW = new T.Vector3(0, 0, 0), rimW = new T.Vector3();
  function render(T_, St) {
    const portalP = ramp(T_, TL.portal, TL.end);
    const fly = sstep(ramp(T_, TL.portal + 0.08, TL.end));
    const dist = placeCamera(T_, fly);

    /* Ring */
    const draw = eInOut3(ramp(T_, TL.ringA, TL.ringB));
    const meet = decay(T_, TL.ringB - 0.02, 0.4);
    const gp = T_ >= TL.gate ? ramp(T_, TL.gate, TL.gate + 0.7) : 0;
    const white = sstep(ramp(T_, TL.whiteA, TL.whiteB));
    ringMats.forEach(m => { const u = m.uniforms; u.uDraw.value = draw; u.uPulse.value = gp > 0 && gp < 1 ? gp : 0; u.uWhite.value = white; u.uFlash.value = meet + decay(T_, TL.gate, 0.3) * 0.8; });
    ringHalo1.material.uniforms.uGain.value = 0.55 * (1 - 0.35 * white);
    ringHalo2.material.uniforms.uGain.value = 0.28 * (1 - 0.5 * white);
    ringGroup.visible = draw > 0;

    /* Drohne */
    const vis = T_ >= TL.appear - 0.01;
    drone.visible = vis;
    if (vis) {
      pose(T_, poseP, poseQ);
      // Schweben nach der Landung, klingt bis zum Scan aus
      const hv = T_ > TL.stop ? (1 - ramp(T_, TL.stop, TL.flatB)) : 0;
      if (hv > 0) { const tt = T_ - TL.stop; poseP.x += Math.sin(tt * 19) * 0.012 * hv; poseP.y += Math.sin(tt * 13 + 1) * 0.014 * hv; }
      drone.position.copy(poseP); drone.quaternion.copy(poseQ);
      const flat = sstep(ramp(T_, TL.flatA, TL.flatB));
      body.scale.set(1, 1 - 0.72 * flat, 1);
      propU.uTime.value = T_; propU.uMorph.value = sstep(ramp(T_, TL.morphA, TL.morphB));
      haloU.uGain.value = 1 - 0.6 * white;
      const pass = decay(T_, TL.gate - 0.05, 0.5);
      gateLight.intensity = 9 * pass + 2.0 * draw * (1 - sstep(ramp(T_, 3.7, 4.2))); gateLight.position.set(0, 0, 0.2);
      spr.forEach(s => { s.material.opacity = 1 - 0.7 * white; });
    }

    /* Lichtspuren: Fenster schrumpft am Ende → Spuren ziehen sich in die Propeller */
    const W0 = 1.55, zip = eIn2(ramp(T_, TL.zipA, TL.zipB));
    const Wt = W0 * (1 - zip);
    trails.visible = vis && Wt > 0.01;
    if (trails.visible) { updateTrails(T_, Math.min(Wt, Math.max(0.0, T_ - TL.appear)), camera.position, sstep(ramp(T_, TL.zipA, TL.zipB))); trailMat.uniforms.uGain.value = 1 + zip * 1.2; }

    /* Scan */
    const sc = ramp(T_, TL.scanA, TL.scanB), scE = eInOut3(sc);
    const c = T_ < TL.scanA ? -100 : (T_ >= TL.scanB ? 100 : lerp(-1.42, 1.42, scE));
    uScanC.value = c; clip.constant = -c;
    fxU.uScanOn.value = sc > 0 && sc < 1 ? Math.sin(sc * Math.PI) * 0.6 + 0.4 : 0;
    logoU.uHot.value = sc > 0 && sc < 1 ? 1 : 0;
    logo.visible = T_ >= TL.scanA;

    /* Abschluss: Blitz, Druckwelle, Funken, Glitch */
    const bt = T_ - TL.burst;
    fxU.uFlash.value = decay(T_, TL.burst, 0.45);
    fx.visible = (sc > 0 && sc < 1) || (bt > 0 && bt < 1.0);
    sparks.visible = bt > 0 && bt < 1.4;
    fxU.uShockR.value = bt > 0 ? 0.25 + 3.4 * eOutExpo(clamp01(bt / 0.85)) : 0;
    fxU.uShockA.value = bt > 0 ? Math.pow(1 - clamp01(bt / 0.85), 1.4) * 1.1 : 0;
    spMat.uniforms.uT.value = bt > 0 ? bt : -1;
    spMat.uniforms.uPx.value = Math.max(0.8, L.rpx / 180);
    const gl_ = bt > 0 && bt < 0.26 ? (Math.floor(bt * 30) % 2 === 0 ? 1 : 0.45) * (1 - bt / 0.26) : 0;
    logoU.uGlitch.value = gl_; logoU.uSeed.value = Math.floor(bt * 30);
    logoU.uGlowAmt.value = T_ >= TL.scanA ? 0.35 + decay(T_, TL.burst, 0.6) * 0.9 + decay(T_, TL.title + 0.2, 0.5) * 0.45 : 0;

    /* Portal: Innenkreis wird Bullauge, Ring wächst über den Bildschirm */
    const inner = 1 - sstep(ramp(T_, TL.portal + 0.1, TL.portal + 0.32));
    logoU.uInner.value = inner; logoU.uPortal.value = portalP > 0 ? 1 : 0;
    let holeR = -10, holeC = [L.cx, L.cy], rim = 0;
    if (portalP > 0) {
      const c0 = toPx(centerW); rimW.set(1 - ringW, 0, 0); const c1 = toPx(rimW);
      holeC = c0; holeR = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) * eOut3(ramp(T_, TL.portal, TL.portal + 0.3));
      rim = 0.9 * (1 - portalP);
    }
    if (St.exit > 0) {
      const diag = Math.hypot(L.W, L.H);
      holeC = [L.cx, L.cy]; holeR = Math.max(holeR, St.exit * diag * 0.62); rim = Math.max(rim, 0.9 * Math.sin(St.exit * Math.PI));
    }
    punchMat.uniforms.uHole.value.set(holeC[0] * dpr, (L.H - holeC[1]) * dpr, holeR * dpr);
    punchMat.uniforms.uRim.value = rim; punchMat.uniforms.uSoft.value = 1.5 * dpr;
    punch.visible = holeR > 0;

    /* Boden blendet vor der Draufsicht aus */
    const fl = sstep(ramp(T_, 0.72, 1.2)) * (1 - sstep(ramp(T_, 3.85, 4.3)));
    floorU.uAlpha.value = fl; floorU.uGrid.value = 1;
    uRefl.value = 0.42 * fl * (1 - 0.4 * white); uReflT.value = 0.5 * fl;
    floor.visible = reflGroup.visible = fl > 0.002;
    reflRing.visible = ringGroup.visible; reflTrails.visible = trails.visible;

    /* Hintergrund, Staub, Flare */
    veilMat.uniforms.uTime.value = T_;
    const cpx = toPx(centerW);
    veilMat.uniforms.uC.value.set(cpx[0] * dpr, (L.H - cpx[1]) * dpr); veilMat.uniforms.uR.value = L.rpx * 2.2 * dpr;
    veilMat.uniforms.uGlow.value = 0.35 + 0.4 * white;
    duMat.uniforms.uTime.value = T_; duMat.uniforms.uRing.value = draw * (1 - white);
    duMat.uniforms.uAlpha.value = sstep(ramp(T_, 0.8, 1.4)) * (1 - 0.85 * sstep(ramp(T_, TL.flatA, TL.scanA))) + fly * 0.9;
    duMat.uniforms.uPx.value = Math.max(0.8, L.rpx / 200);
    const fA = decay(T_, TL.ringB - 0.02, 0.35), fB = decay(T_, TL.gate - 0.02, 0.4), fC = decay(T_, TL.burst, 0.5);
    let fo = 0;
    if (fC > 0.01) { flare.position.set(0, 0, 0.1); fo = fC; flare.scale.set(5.5 * fo + 1, 0.06, 1); }
    else if (fB > 0.01) { pose(TL.gate, _p, _q); flare.position.copy(_p); fo = fB; flare.scale.set(6 * fo + 1, 0.07, 1); }
    else if (fA > 0.01) { flare.position.set(0, -(1 - ringW / 2), 0); fo = fA * 0.8; flare.scale.set(4.5 * fo + 1, 0.06, 1); }
    flareMat.opacity = fo; flare.visible = fo > 0.01;

    renderer.render(scene, camera);
  }

  /* Programme und Texturen vorab übersetzen, damit später kein Bild hängt */
  layout();
  [logoTex, glowTex, dotTex, flareTex, carbonTex].forEach(t => renderer.initTexture(t));
  const vis0 = [];
  scene.traverse(o => { vis0.push([o, o.visible]); o.visible = true; });
  placeCamera(TL.bootEnd, 0);
  const parallel = !!gl.getExtension('KHR_parallel_shader_compile');
  try { if (parallel && renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  vis0.forEach(([o, v]) => (o.visible = v));
  // Vorwärmen: typische Bilder einmal unsichtbar zeichnen (Leinwand ist noch durchsichtig),
  // damit Treiber ihre Zustände nicht erst mitten im Flug anlegen
  for (const t of [2.32, 3.1, 4.9, 5.3, 6.5]) render(t, { exit: 0 });
  render(TL.bootEnd, { exit: 0 });

  function dispose() {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      if (o.isInstancedMesh) o.dispose();
    });
    disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
    renderer.renderLists.dispose();
    renderer.dispose();
  }

  return { render: (T_, St) => render(T_, St), layout, layoutInfo, dispose, adapt, renderer, _dbg: { tPos, pose, camera, drone, T, scene, parts: { veil, punch, ringGroup, drone, trails, floor, reflGroup, logo, fx, sparks, dust, flare } } };
}

if (typeof window !== 'undefined') window.FCSIntro3D = Object.assign(window.FCSIntro3D || {}, { playIntro });
