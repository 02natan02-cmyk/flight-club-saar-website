#!/usr/bin/env node
/* Flight Club Saar · Render-Station
   Rechnet ein Rezept aus dem Clip-Studio (assets/js/studio.js) mit ffmpeg zum fertigen Video.
   Format und Regeln: quellen/render/REZEPT.md. Ziel: Das fertige Video sieht genau so aus wie die Vorschau im Studio.

   Ablauf
   1. Rezept lesen und prüfen
   2. Teile finden (teile/<teil>.*)
   3. Sonden (ffprobe): Größe nach Drehung, Bildrate, Länge, HDR, Ton
   4. Look: grade() aus assets/js/studio-gl.js nach JavaScript portiert, daraus eine 3D-LUT (.cube, 33³)
   5. Overlay-Bilder (OSD, Sticker, Namens-Einblendung) mit demselben Zeichenmodul wie die Vorschau (assets/js/studio-overlay.js)
   6. Ton: Originalton der Szenen und Musik mischen → ton.wav
   7. Szenen einzeln rechnen: Ausschnitt, Größe, HDR → SDR, Geschwindigkeit, Übergang am Szenenanfang → szene_NNN.mkv
   8. Endkodierung: Szenen aneinander, Look, Ausblenden, Overlay, H.264 und AAC mit Fast Start
   9. Prüfen (ffprobe) und Zusammenfassung

   Aufruf
     node quellen/render/render.mjs --rezept auftrag/rezept.json --teile auftrag/teile --out auftrag/fertig.mp4 [--tmp auftrag/tmp] [--preset veryfast]
     node quellen/render/render.mjs --selbsttest
   Fortschritt auf stdout als „progress 0.42“. Fehler auf stderr (deutsch), Exit ≠ 0. */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..', '..');
const STUDIO_GL = path.join(WURZEL, 'assets', 'js', 'studio-gl.js');
const STUDIO_OVERLAY = path.join(WURZEL, 'assets', 'js', 'studio-overlay.js');
const SCHRIFTEN = path.join(HIER, 'fonts');
const SCHRIFT_DATEIEN = [
  ['BebasNeue-Regular.ttf', 'Bebas Neue'],
  ['ChakraPetch-Regular.ttf', 'Chakra Petch'],
  ['ChakraPetch-Medium.ttf', 'Chakra Petch'],
  ['ChakraPetch-SemiBold.ttf', 'Chakra Petch']
];
const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
const TEIL_MUSTER = /^[0-9a-f]{16}$/i;
const LUT_GROESSE = 33;
// Prüfsumme der Shader-Funktionen dl(), dlogm() und grade() in studio-gl.js, nach denen der Look unten portiert ist.
// Ändert sich der Shader, muss grade() hier nachgezogen und die Prüfsumme erneuert werden (der Selbsttest meldet es).
const SHADER_PRUEFSUMME = '54c9541434c58938';
// Zwischendateien der Szenen: H.264 nahezu verlustfrei (8 Bit 4:2:0 wie die Vorschau im Browser)
const ZWISCHEN_KODIERUNG = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv420p'];

/* =====================================================================
   Meldungen und Fortschritt
   ===================================================================== */
class RenderFehler extends Error {
  constructor(text, code = 1) { super(text); this.code = code; }
}
const WARNUNGEN = [];
const VERBERGEN = []; // [Pfad, Ersatz]: Pfade, die nie in Meldungen erscheinen sollen
function verbergen(text) {
  let t = String(text == null ? '' : text);
  for (const [p, ersatz] of VERBERGEN) if (p) t = t.split(p).join(ersatz);
  return t;
}
function warnung(text) { WARNUNGEN.push(text); process.stderr.write(`Warnung: ${verbergen(text)}\n`); }
function info(text) { process.stdout.write(`${verbergen(text)}\n`); }
let letzterFortschritt = -1;
function fortschritt(p) {
  const r = Math.floor(Math.max(0, Math.min(1, p)) * 100) / 100;
  if (r > letzterFortschritt) { letzterFortschritt = r; process.stdout.write(`progress ${r.toFixed(2)}\n`); }
}
const abschnitt = (von, bis) => p => fortschritt(von + (bis - von) * Math.max(0, Math.min(1, p)));

/* =====================================================================
   Kleine Rechenhilfen (wie im Browser)
   ===================================================================== */
const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
const gerade = v => Math.max(2, Math.round(v / 2) * 2);
const zahl = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
// Zahl für ffmpeg-Ausdrücke und Optionen: genug Stellen, keine Exponentenschreibweise
const z = v => { const s = (Math.abs(v) < 1e-9 ? 0 : v).toFixed(9).replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; };
const sek = v => `${v.toFixed(2).replace('.', ',')} s`;

// Bildrate als Bruch (29.97 → 30000/1001), damit Zeitstempel exakt bleiben
function fpsBruch(f) {
  for (const [wert, n, d] of [[23.976, 24000, 1001], [29.97, 30000, 1001], [47.952, 48000, 1001], [59.94, 60000, 1001], [119.88, 120000, 1001]]) {
    if (Math.abs(f - wert) < 0.006) return { n, d, text: `${n}/${d}`, wert: n / d };
  }
  if (Math.abs(f - Math.round(f)) < 0.001) return { n: Math.round(f), d: 1, text: `${Math.round(f)}/1`, wert: Math.round(f) };
  const n = Math.round(f * 1000);
  return { n, d: 1000, text: `${n}/1000`, wert: n / 1000 };
}

// studio.js · cropPx: Bildausschnitt im Seitenverhältnis A, pan 0 … 1
function cropPx(sw, sh, A, pan) {
  const sa = sw / sh; let cw = sw, ch = sh;
  if (sa > A + 1e-3) cw = sh * A; else if (sa < A - 1e-3) ch = sw / A;
  return { left: (sw - cw) * (pan ? pan.x : .5), top: (sh - ch) * (pan ? pan.y : .5), width: cw, height: ch };
}
// studio.js · bitrate
function bitrateFuer(W, H, fps) {
  const px = W * H, hi = fps > 40;
  if (px >= 3840 * 2160 * .85) return hi ? 60e6 : 40e6;
  if (px >= 2560 * 1440 * .85) return hi ? 36e6 : 26e6;
  if (px >= 1920 * 1080 * .85) return hi ? 24e6 : 16e6;
  if (px >= 1280 * 720 * .85) return hi ? 14e6 : 10e6;
  return 8e6;
}

/* =====================================================================
   Geschwindigkeiten und Quellzeit (studio.js · SPEED, srcFn)
   ===================================================================== */
const SPEED = {
  1: { at: () => 1 },
  slow: { at: () => .5 },
  ramp: { at: u => u < .38 ? 1.75 : u < .62 ? 1.75 + (.5 - 1.75) * ((x => x * x * (3 - 2 * x))((u - .38) / .24)) : .5 }
};
const RAMPE_N = 96;
function rampenIntegral(seg) {
  const acc = new Float64Array(RAMPE_N + 1);
  for (let i = 0; i < RAMPE_N; i++) acc[i + 1] = acc[i] + SPEED.ramp.at((i + .5) / RAMPE_N) * seg.len / RAMPE_N;
  return acc;
}
// Ausgabezeit l (Sekunden ab Szenenanfang) → Quellzeit, genau wie srcFn im Browser
function srcFn(seg) {
  if (seg.kind === 'slow') return l => seg.a + l * .5;
  if (seg.kind !== 'ramp') return l => seg.a + l;
  const acc = rampenIntegral(seg), N = RAMPE_N;
  return l => {
    if (l >= seg.len) return seg.a + acc[N] + (l - seg.len) * SPEED.ramp.at(1);
    const x = klemm(l / seg.len * N, 0, N), i = Math.floor(x), f = x - i;
    return seg.a + acc[i] + (i < N ? (acc[i + 1] - acc[i]) * f : 0);
  };
}
/* Dieselbe Abbildung als Stücke mit fester Geschwindigkeit: { s: Quellzeit am Stückanfang, l: Ausgabezeit, v: Quelle je Ausgabesekunde }.
   srcFn ist stückweise linear, die Umkehrung also auch: daraus wird der setpts-Ausdruck (Quellzeit → Ausgabezeit). */
function zeitStuecke(seg) {
  if (seg.kind === 'slow') return [{ s: seg.a, l: 0, v: .5 }];
  if (seg.kind !== 'ramp') return [{ s: seg.a, l: 0, v: 1 }];
  const acc = rampenIntegral(seg), roh = [];
  for (let i = 0; i < RAMPE_N; i++) roh.push({ s: seg.a + acc[i], l: seg.len * i / RAMPE_N, v: SPEED.ramp.at((i + .5) / RAMPE_N) });
  roh.push({ s: seg.a + acc[RAMPE_N], l: seg.len, v: SPEED.ramp.at(1) });
  const st = [];
  for (const p of roh) if (!st.length || Math.abs(st[st.length - 1].v - p.v) > 1e-9) st.push(p);
  return st;
}
// setpts-Ausdruck: Quellzeit (Variable ld(0)) → Ausgabezeit
function umkehrAusdruck(stuecke) {
  const teil = p => `${z(p.l)}+(ld(0)-${z(p.s)})/${z(p.v)}`;
  let e = teil(stuecke[stuecke.length - 1]);
  for (let j = stuecke.length - 2; j >= 0; j--) e = `if(lt(ld(0),${z(stuecke[j + 1].s)}),${teil(stuecke[j])},${e})`;
  return e;
}

/* =====================================================================
   Look: grade() und dlogm() aus assets/js/studio-gl.js (Shader FS), exakt portiert
   ===================================================================== */
const LOOKS_ERSATZ = {
  natur: { n: 'Natürlich' },
  warm: { n: 'Warm Cinematic', temp: .55, con: 1.12, sat: .9, lift: .025, sh: [-.02, .012, .03], hi: [.045, .018, -.03] },
  kraeftig: { n: 'Kräftig', con: 1.16, sat: 1.38, lift: 0, sh: [0, 0, .01], hi: [.01, .005, 0] },
  kuehl: { n: 'Kühl', temp: -.5, con: 1.06, sat: .88, lift: .015, sh: [0, .01, .035], hi: [-.01, .005, .02] },
  sw: { n: 'Schwarzweiß', con: 1.24, sat: 0, mono: 1, lift: .01 },
  dlogm: { n: 'DJI D-Log M → normal', log: 1, sat: 1.06, con: 1.02 }
};
let LOOKS = null;
// Die Werte kommen direkt aus studio-gl.js (eine Quelle für Vorschau und Render-Station), notfalls aus der Kopie oben
function looksLaden() {
  if (LOOKS) return LOOKS;
  try {
    const m = fs.readFileSync(STUDIO_GL, 'utf8').match(/export const LOOKS = (\{[\s\S]*?\n\});/);
    const L = m && Function(`"use strict"; return (${m[1]});`)();
    if (L && L.natur) return (LOOKS = L);
  } catch (e) { /* unten Ersatz */ }
  warnung('Die Looks aus studio-gl.js ließen sich nicht lesen, die Render-Station nimmt ihre eingebaute Kopie.');
  return (LOOKS = LOOKS_ERSATZ);
}
function shaderPruefen() {
  try {
    const m = fs.readFileSync(STUDIO_GL, 'utf8').match(/float dl\(float x\)[\s\S]*?return mix\(c, clamp\(g, 0\., 1\.\), uK\);\s*\}/);
    if (!m) return false;
    return crypto.createHash('sha256').update(m[0].replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16) === SHADER_PRUEFSUMME;
  } catch (e) { return false; }
}
const mix = (x, y, a) => x * (1 - a) + y * a;
const smoothstep = (e0, e1, x) => { const t = klemm((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function dl(x) { return x <= .14 ? (x - .0929) / 6.025 : (Math.pow(10, 3.89616 * x - 2.27752) - .0108) / .9892; }
function dlogm(c) {
  const l = [dl(c[0]), dl(c[1]), dl(c[2])];
  // GLSL mat3(...) ist spaltenweise belegt: Spalten (1.6746, -.0981, -.0410), (-.5797, 1.3340, -.2430), (-.0949, -.2359, 1.2840)
  const m = [
    1.6746 * l[0] - .5797 * l[1] - .0949 * l[2],
    -.0981 * l[0] + 1.3340 * l[1] - .2359 * l[2],
    -.0410 * l[0] - .2430 * l[1] + 1.2840 * l[2]
  ].map(x => Math.max(x, 0) * .6);
  return m.map(x => { const t = (x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14); return Math.pow(klemm(t, 0, 1), 1 / 2.2); });
}
// Uniforms wie in compositor().render(): fehlende Werte → neutrale Vorgabe
function lookParameter(L) {
  return { log: L.log ? 1 : 0, temp: L.temp || 0, con: L.con || 1, sat: L.sat == null ? 1 : L.sat, lift: L.lift || 0, mono: L.mono || 0, sh: L.sh || [0, 0, 0], hi: L.hi || [0, 0, 0] };
}
// c: [r, g, b] 0 … 1 (angezeigtes SDR-Bild), P: lookParameter, k: Stärke 0 … 1
function grade(c, P, k) {
  let g = c.slice();
  if (P.log > .5) g = dlogm(g);
  let lin = g.map(x => Math.pow(Math.max(x, 0), 2.2));
  lin = [lin[0] * (1 + .1 * P.temp), lin[1] * (1 + .01 * P.temp), lin[2] * (1 - .1 * P.temp)];
  g = lin.map(x => Math.pow(Math.max(x, 0), 1 / 2.2));
  g = g.map(x => (x - .45) * P.con + .45);
  g = g.map(x => x + P.lift * (1 - x));
  const L = .2126 * g[0] + .7152 * g[1] + .0722 * g[2];
  g = g.map(x => mix(L, x, P.sat));
  const ws = 1 - smoothstep(0, .55, L), wh = smoothstep(.45, 1, L);
  g = g.map((x, i) => x + P.sh[i] * ws + P.hi[i] * wh);
  const m = klemm((L - .45) * 1.08 + .45, 0, 1);
  g = g.map(x => mix(x, m, P.mono));
  return c.map((x, i) => mix(x, klemm(g[i], 0, 1), k));
}
// .cube-Datei (Rot läuft am schnellsten, wie im Adobe-Format). ohneLog: nur der Teil von grade() nach dlogm() (für die genaue D-Log-Kette)
function lutText(lookId, k, N = LUT_GROESSE, ohneLog = false) {
  const L = looksLaden()[lookId];
  if (!L) throw new RenderFehler(`Unbekannter Look „${lookId}“.`, 2);
  const P = lookParameter(L);
  if (ohneLog) P.log = 0;
  const zeilen = [`TITLE "Flight Club Saar ${lookId} ${k}${ohneLog ? ' ohne Log' : ''}"`, `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    zeilen.push(grade([r / (N - 1), g / (N - 1), b / (N - 1)], P, k).map(x => x.toFixed(6)).join(' '));
  }
  return zeilen.join('\n') + '\n';
}
// 1D-LUT (.cube) über [von, bis] mit n Stützstellen, gleiche Kurve für alle drei Kanäle
function lut1dText(f, von, bis, n) {
  const zeilen = [`LUT_1D_SIZE ${n}`, `DOMAIN_MIN ${von} ${von} ${von}`, `DOMAIN_MAX ${bis} ${bis} ${bis}`];
  for (let i = 0; i < n; i++) { const y = f(von + (bis - von) * i / (n - 1)).toFixed(7); zeilen.push(`${y} ${y} ${y}`); }
  return zeilen.join('\n') + '\n';
}
/* Look als ffmpeg-Filter auf einem RGB-Bild (gbrp). Schreibt die nötigen LUT-Dateien nach ordner, gibt { filter, dateien } zurück.
   Normale Looks: eine 3D-LUT (33³) direkt aus grade().
   D-Log M: dlogm() ist für eine 3D-LUT zu steil (D-Gamut-Matrix auf Werte bis 42, Knick bei 0), deshalb genau wie der Shader in Gleitkomma:
   1D-Kurve dl() → D-Gamut-Matrix → 1D-Kurve (max(0)·0,6, Filmkurve, Gamma) → 3D-LUT mit dem Rest von grade() → Mischung mit dem Original (Stärke k). */
async function lookFilter(look, ordner, kennung = 'look') {
  const L = looksLaden()[look.id];
  if (!L.log) {
    const datei = `${kennung}_${look.id}.cube`;
    await fsp.writeFile(path.join(ordner, datei), lutText(look.id, look.k));
    return { filter: `lut3d=file=${datei}:interp=tetrahedral`, dateien: [datei] };
  }
  const d1 = `${kennung}_dlogm_kurve.cube`, d2 = `${kennung}_dlogm_ton.cube`, d3 = `${kennung}_${look.id}_rest.cube`;
  // Filmkurve wird ab etwa 12 zu 1 (t(7,24) = 1), darüber konstant
  const ton = x => { const l = Math.max(x, 0) * .6, t = (l * (2.51 * l + .03)) / (l * (2.43 * l + .59) + .14); return Math.pow(klemm(t, 0, 1), 1 / 2.2); };
  await fsp.writeFile(path.join(ordner, d1), lut1dText(dl, 0, 1, 16384));
  await fsp.writeFile(path.join(ordner, d2), lut1dText(ton, 0, 12.5, 65536));
  await fsp.writeFile(path.join(ordner, d3), lutText(look.id, 1, LUT_GROESSE, true));
  const matrix = 'rr=1.6746:rg=-0.5797:rb=-0.0949:gr=-0.0981:gg=1.3340:gb=-0.2359:br=-0.0410:bg=-0.2430:bb=1.2840';
  const kette = `lut1d=file=${d1}:interp=linear,colorchannelmixer=${matrix},lut1d=file=${d2}:interp=linear,lut3d=file=${d3}:interp=tetrahedral`;
  // 8 Bit ↔ Gleitkomma mit zscale: swscale rechnet hier ungenau (255 → 0,996), was die steile Log-Kurve stark verstärken würde
  const hin = 'zscale=rin=full:r=full,format=gbrpf32le', zurueck = 'zscale=rin=full:r=full:d=none,format=gbrp';
  const filter = look.k >= 1
    ? `${hin},${kette},${zurueck}`
    : `${hin},split[${kennung}o][${kennung}l];[${kennung}l]${kette}[${kennung}g];[${kennung}g][${kennung}o]blend=all_mode=normal:all_opacity=${z(look.k)},${zurueck}`;
  return { filter, dateien: [d1, d2, d3] };
}

/* =====================================================================
   Aufruf lesen
   ===================================================================== */
const HILFE = `Render-Station des Flight Club Saar
  node quellen/render/render.mjs --rezept <rezept.json> --teile <ordner> --out <fertig.mp4> [--tmp <ordner>] [--preset medium]
  node quellen/render/render.mjs --selbsttest`;
function argumenteLesen(argv) {
  const a = { preset: 'medium' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const wert = () => { const v = argv[++i]; if (v == null || v.startsWith('--')) throw new RenderFehler(`Beim Aufruf fehlt der Wert für ${k}.`, 2); return v; };
    if (k === '--rezept') a.rezept = wert();
    else if (k === '--teile') a.teile = wert();
    else if (k === '--out') a.out = wert();
    else if (k === '--tmp') a.tmp = wert();
    else if (k === '--preset') a.preset = wert();
    else if (k === '--selbsttest') a.selbsttest = true;
    else if (k === '--hilfe' || k === '--help' || k === '-h') a.hilfe = true;
    else throw new RenderFehler(`Unbekannte Angabe beim Aufruf: ${k}\n${HILFE}`, 2);
  }
  if (a.hilfe || a.selbsttest) return a;
  for (const k of ['rezept', 'teile', 'out']) if (!a[k]) throw new RenderFehler(`Beim Aufruf fehlt --${k}.\n${HILFE}`, 2);
  if (!PRESETS.includes(a.preset)) throw new RenderFehler(`Unbekanntes Preset „${a.preset}“ (erlaubt: ${PRESETS.join(', ')}).`, 2);
  // Absolute Pfade: ffmpeg läuft im Tmp-Ordner, relative Angaben (auftrag/teile) gingen dort ins Leere
  for (const k of ['rezept', 'teile', 'out', 'tmp']) if (a[k]) a[k] = path.resolve(a[k]);
  return a;
}

/* =====================================================================
   ffmpeg und ffprobe
   ===================================================================== */
function prozess(cmd, args, { cwd, beiZeile } = {}) {
  return new Promise((resolve, reject) => {
    let p;
    try { p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { reject(e); return; }
    const out = [], err = []; let errLaenge = 0, rest = '';
    p.stdout.on('data', d => {
      if (!beiZeile) { out.push(d); return; }
      rest += d.toString('utf8'); const zeilen = rest.split('\n'); rest = zeilen.pop();
      for (const zl of zeilen) beiZeile(zl.trim());
    });
    p.stderr.on('data', d => { err.push(d); errLaenge += d.length; while (errLaenge > 65536 && err.length > 1) errLaenge -= err.shift().length; });
    p.on('error', reject);
    p.on('close', code => resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
  });
}
async function werkzeugePruefen() {
  for (const w of ['ffmpeg', 'ffprobe']) {
    let r = null; try { r = await prozess(w, ['-hide_banner', '-version']); } catch (e) { r = null; }
    if (!r || r.code !== 0) throw new RenderFehler(`${w} ist auf diesem Rechner nicht installiert (Ubuntu: sudo apt-get install -y ffmpeg).`);
  }
  const r = await prozess('ffmpeg', ['-hide_banner', '-filters']);
  const fehlt = ['xfade', 'maskedmerge', 'geq', 'lut3d', 'lut1d', 'colorchannelmixer', 'zscale', 'tonemap', 'overlay', 'amix', 'tpad', 'fade', 'afade', 'adelay'].filter(f => !new RegExp(`\\s${f}\\s`).test(r.stdout));
  if (fehlt.length) throw new RenderFehler(`Dem installierten ffmpeg fehlen Filter: ${fehlt.join(', ')}.`);
}
/* ffmpeg ausführen. bilder: erwartete Zahl der Ausgabebilder (für den Fortschritt), beiFortschritt(0 … 1).
   Gibt die Zahl der geschriebenen Bilder zurück. */
async function ffmpeg(args, { cwd, bilder = 0, beiFortschritt, was } = {}) {
  let frame = 0, endeFrame = 0;
  const r = await prozess('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-nostats', '-progress', 'pipe:1', ...args], {
    cwd,
    beiZeile: zl => {
      const m = /^frame=(\d+)/.exec(zl);
      if (m) { frame = +m[1]; if (beiFortschritt && bilder > 0) beiFortschritt(Math.min(1, frame / bilder)); }
      if (zl === 'progress=end') endeFrame = frame;
    }
  });
  if (r.code !== 0) {
    const zeilen = r.stderr.trim().split('\n').filter(Boolean).slice(-12).join('\n');
    const e = new RenderFehler(`ffmpeg ist beim Schritt „${was || 'Rechnen'}“ gescheitert (Code ${r.code}).\n${zeilen}`);
    e.ffmpeg = true; throw e;
  }
  return endeFrame || frame;
}
async function ffprobeJson(datei, extra = []) {
  const r = await prozess('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', ...extra, datei]);
  if (r.code !== 0) return null;
  try { return JSON.parse(r.stdout); } catch (e) { return null; }
}
const bruchWert = s => { const [n, d] = String(s || '').split('/').map(Number); return n > 0 && d > 0 ? n / d : 0; };

/* =====================================================================
   Sonden: was steckt in einer Datei?
   ===================================================================== */
async function sonde(datei) {
  const j = await ffprobeJson(datei);
  if (!j) return null;
  const st = j.streams || [];
  const v = st.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = st.find(s => s.codec_type === 'audio');
  const fmtDauer = zahl(j.format && j.format.duration);
  const erg = { ton: null, video: null, dauer: Number.isFinite(fmtDauer) ? fmtDauer : 0 };
  if (a) {
    const ad = zahl(a.duration);
    erg.ton = { index: a.index, kanaele: a.channels || 2, rate: +a.sample_rate || 48000, dauer: Number.isFinite(ad) ? ad : erg.dauer };
  }
  if (v) {
    let rot = 0;
    for (const sd of v.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation) || 0;
    if (!rot && v.tags && v.tags.rotate) rot = Number(v.tags.rotate) || 0;
    const quer = Math.abs(Math.round(rot / 90)) % 2 === 1;
    const vd = zahl(v.duration);
    const fps = bruchWert(v.avg_frame_rate) || bruchWert(v.r_frame_rate) || 0;
    const trc = String(v.color_transfer || ''), raum = String(v.color_space || ''), prim = String(v.color_primaries || '');
    erg.video = {
      index: v.index, codec: v.codec_name, pixfmt: v.pix_fmt || '',
      breite: quer ? v.height : v.width, hoehe: quer ? v.width : v.height, drehung: rot,
      fps, dauer: Number.isFinite(vd) && vd > 0 ? vd : erg.dauer,
      transfer: trc, raum, primaer: prim,
      bereich: v.color_range === 'pc' || /^yuvj/.test(v.pix_fmt || '') ? 'full' : 'limited',
      hdr: trc === 'smpte2084' || trc === 'arib-std-b67'
    };
  }
  return erg;
}

/* =====================================================================
   Rezept lesen und Teile finden
   ===================================================================== */
function teilFinden(teileOrdner, teil) {
  if (!teil || !TEIL_MUSTER.test(String(teil))) return null;
  let namen = [];
  try { namen = fs.readdirSync(teileOrdner); } catch (e) { return null; }
  const passend = namen.filter(n => n.toLowerCase().startsWith(String(teil).toLowerCase() + '.')).sort();
  for (const n of passend) { const p = path.join(teileOrdner, n); try { if (fs.statSync(p).isFile() && fs.statSync(p).size > 0) return p; } catch (e) { /* weiter */ } }
  return null;
}
function rezeptLesen(datei) {
  let text;
  try { text = fs.readFileSync(datei, 'utf8'); } catch (e) { throw new RenderFehler('Das Rezept (rezept.json) fehlt oder ist nicht lesbar.', 2); }
  let r;
  try { r = JSON.parse(text); } catch (e) { throw new RenderFehler(`Das Rezept ist kein gültiges JSON (${e.message}).`, 2); }
  if (!r || typeof r !== 'object') throw new RenderFehler('Das Rezept ist leer.', 2);
  if (r.v !== 1) warnung(`Rezept-Version ${r.v} ist unbekannt, die Render-Station rechnet nach Version 1.`);
  const o = r.out || {};
  const W = zahl(o.W), H = zahl(o.H), fps = zahl(o.fps);
  if (!(W >= 16 && H >= 16)) throw new RenderFehler('Im Rezept fehlt die Zielgröße (out.W und out.H).', 2);
  if (W > 4096 || H > 4096 || W * H > 3840 * 2160) throw new RenderFehler(`Die Zielgröße ${W} × ${H} ist größer als erlaubt (bis 3840 × 2160).`, 2);
  if (!(fps >= 23.9 && fps <= 60.01)) throw new RenderFehler(`Die Bildrate ${o.fps} liegt außerhalb von 23,976 bis 60.`, 2);
  if (!Array.isArray(r.clips) || !r.clips.length) throw new RenderFehler('Im Rezept stehen keine Clips.', 2);
  if (r.clips.length > 5) warnung(`Das Rezept hat ${r.clips.length} Clips (vorgesehen sind bis zu 5).`);
  if (!Array.isArray(r.segs) || !r.segs.length) throw new RenderFehler('Im Rezept stehen keine Szenen.', 2);
  r.segs.forEach((s, i) => {
    if (!s || !Number.isInteger(s.clip) || s.clip < 0 || s.clip >= r.clips.length) throw new RenderFehler(`Szene ${i + 1} verweist auf einen Clip, den es im Rezept nicht gibt.`, 2);
    if (!(zahl(s.len) > 0)) throw new RenderFehler(`Szene ${i + 1} hat keine gültige Länge.`, 2);
    if (!(zahl(s.a) >= 0)) s.a = 0;
  });
  return r;
}

/* =====================================================================
   Plan: Bilder, Szenen, Übergänge (wie exportVideo in studio.js)
   ===================================================================== */
/* Übergänge (Shader FS in studio-gl.js, TYPE). Blende, Blitz und Wisch genau nach Formel: eine kleine Maske je Bild (geq, ein Achtel
   der Größe, weich hochskaliert) mischt A und B mit maskedmerge. Zoom, Whip-Pan und Glitch: eingebaute xfade-Übergänge (laut REZEPT.md genügt das).
   ersatz: eingebauter xfade-Übergang, falls der genaue Weg auf einem Rechner scheitert. */
const UEBERGAENGE = {
  blende: { maske: 'blende', ersatz: 'fade' },
  blitz: { maske: 'blitz', ersatz: 'fadewhite' },
  wisch: { maske: 'wisch', ersatz: 'wiperight' },
  zoom: { xfade: 'zoomin' },
  whip: { xfade: 'slideleft' },
  glitch: { xfade: 'pixelize' }
};
async function planen(rezept, arg) {
  const fpsWunsch = zahl(rezept.out.fps), R = fpsBruch(fpsWunsch);
  const fps = fpsWunsch; // Bildnummern wie im Browser mit der Zahl aus dem Rezept, Zeitstempel mit dem Bruch
  const W = gerade(rezept.out.W), H = gerade(rezept.out.H);
  if (W !== rezept.out.W || H !== rezept.out.H) warnung(`Zielgröße auf gerade Zahlen gerundet: ${W} × ${H}.`);
  const summe = rezept.segs.reduce((s, x) => s + zahl(x.len), 0);
  let total = zahl(rezept.total);
  if (!(total > 0)) total = summe;
  if (Math.abs(total - summe) > .02 && total > summe) { warnung(`total (${total}) ist länger als die Summe der Szenen (${z(summe)}), gerechnet wird mit ${z(summe)} s.`); total = summe; }
  if (total > 180.01) { warnung(`Das Video ist ${Math.round(total)} s lang, die Render-Station kürzt auf 180 s.`); total = 180; }
  const F = Math.max(1, Math.round(total * fps));

  // Clips: nur die gebrauchten müssen da sein
  const gebraucht = new Set(rezept.segs.map(s => s.clip));
  const clips = [];
  for (let i = 0; i < rezept.clips.length; i++) {
    const c = rezept.clips[i] || {}, name = path.basename(String(c.fn || `Clip ${i + 1}`));
    const datei = teilFinden(arg.teile, c.teil);
    if (!datei) {
      if (gebraucht.has(i)) throw new RenderFehler(`Clip ${i + 1} („${name}“, Teil ${c.teil || 'ohne Nummer'}) fehlt im Auftrag. Ohne ihn kann das Video nicht gerechnet werden.`, 3);
      warnung(`Clip ${i + 1} („${name}“) fehlt, wird aber in keiner Szene gebraucht.`); clips.push(null); continue;
    }
    const so = await sonde(datei);
    if (!so || !so.video) {
      if (gebraucht.has(i)) throw new RenderFehler(`Clip ${i + 1} („${name}“) ist keine lesbare Videodatei.`, 3);
      clips.push(null); continue;
    }
    const v = so.video;
    if (!(v.fps > 0)) v.fps = zahl(c.fps) > 0 ? zahl(c.fps) : 30;
    if (!(v.dauer > 0)) v.dauer = zahl(c.dur) > 0 ? zahl(c.dur) : 0;
    if (!(v.dauer > 0)) throw new RenderFehler(`Bei Clip ${i + 1} („${name}“) lässt sich die Länge nicht bestimmen.`, 3);
    const rw = zahl(c.w), rh = zahl(c.h);
    if (rw > 0 && rh > 0 && (Math.abs(rw - v.breite) > 1 || Math.abs(rh - v.hoehe) > 1)) {
      warnung(`Clip ${i + 1}: Das Studio meldet ${rw} × ${rh}, die Datei hat ${v.breite} × ${v.hoehe}. Der Ausschnitt wird umgerechnet.`);
    }
    clips.push({ nr: i, name, datei, sonde: so, w: rw > 0 ? rw : v.breite, h: rh > 0 ? rh : v.hoehe });
  }

  // Szenen: at kumulativ wie buildSeq, Bildnummern wie exportVideo
  const szenen = []; let at = 0;
  rezept.segs.forEach((s, i) => {
    const kind = s.kind === 'slow' || s.kind === 'ramp' ? s.kind : '1';
    if (s.kind != null && !['1', 'slow', 'ramp'].includes(String(s.kind))) warnung(`Szene ${i + 1}: unbekannte Geschwindigkeit „${s.kind}“, gerechnet wird mit normaler Geschwindigkeit.`);
    const sz = { nr: i + 1, clip: s.clip, a: zahl(s.a), len: zahl(s.len), at, kind, tr: s.tr || null, d: zahl(s.d) || 0, crop: s.crop || null };
    if (s.at != null && Math.abs(zahl(s.at) - at) > .002) warnung(`Szene ${i + 1}: at ${s.at} passt nicht zur Summe der Längen davor (${z(at)}), gerechnet wird mit ${z(at)}.`);
    at += sz.len; szenen.push(sz);
  });
  const genutzt = [];
  for (const sz of szenen) {
    sz.f0 = Math.round(sz.at * fps);
    if (sz.f0 >= F) { warnung(`Szene ${sz.nr} beginnt nach dem Ende des Videos und entfällt.`); continue; }
    genutzt.push(sz);
  }
  genutzt.forEach((sz, i) => { const nx = genutzt[i + 1]; sz.n = (nx ? Math.min(F, nx.f0) : F) - sz.f0; });
  const fertig = genutzt.filter(sz => {
    if (sz.n > 0) return true;
    warnung(`Szene ${sz.nr} ist kürzer als ein Bild und entfällt.`); return false;
  });

  // Ausschnitt in Pixeln der gedrehten Quelle, Übergang am Szenenanfang
  for (let i = 0; i < fertig.length; i++) {
    const sz = fertig[i], c = clips[sz.clip], v = c.sonde.video;
    let cr = sz.crop && ['left', 'top', 'width', 'height'].every(k => Number.isFinite(zahl(sz.crop[k]))) ? { ...sz.crop } : null;
    if (cr) {
      const kx = v.breite / c.w, ky = v.hoehe / c.h;
      cr = { left: cr.left * kx, top: cr.top * ky, width: cr.width * kx, height: cr.height * ky };
    } else cr = cropPx(v.breite, v.hoehe, W / H, { x: .5, y: .5 });
    cr.width = klemm(Math.round(cr.width), 2, v.breite); cr.height = klemm(Math.round(cr.height), 2, v.hoehe);
    cr.left = klemm(Math.round(cr.left), 0, v.breite - cr.width); cr.top = klemm(Math.round(cr.top), 0, v.hoehe - cr.height);
    sz.crop = cr;
    sz.uebergang = null;
    if (i > 0 && sz.tr && sz.tr !== 'schnitt' && sz.d > 0) {
      let typ = sz.tr;
      if (!UEBERGAENGE[typ]) { warnung(`Szene ${sz.nr}: unbekannter Übergang „${typ}“, die Render-Station nimmt eine Blende.`); typ = 'blende'; }
      const bilder = Math.min(sz.n, Math.max(1, Math.round(sz.d * fps)));
      sz.uebergang = { typ, bilder };
    }
  }

  // Look
  let look = null;
  if (rezept.look && rezept.look.id && rezept.look.id !== 'natur') {
    const L = looksLaden();
    const k = rezept.look.k == null ? 1 : klemm(zahl(rezept.look.k) || 0, 0, 1);
    if (!L[rezept.look.id]) warnung(`Unbekannter Look „${rezept.look.id}“, das Video bleibt ohne Look.`);
    else if (k > 0) look = { id: rezept.look.id, k };
  }

  const fadeS = Math.max(0, zahl(rezept.fade) || 0);
  const bitrate = zahl(rezept.out.bitrate) > 0 ? Math.round(zahl(rezept.out.bitrate)) : bitrateFuer(W, H, fps);
  return {
    name: String(rezept.name || 'Clip'), W, H, fps, R, F, total, bitrate,
    fadeBilder: Math.min(F, Math.round(fadeS * fps)),
    clips, szenen: fertig, look,
    overlay: rezept.overlay || null, audio: rezept.audio || null
  };
}

/* =====================================================================
   Overlay-Bilder: OSD, Sticker, Namens-Einblendung
   ===================================================================== */
function overlayModulLaden() {
  try { return createRequire(import.meta.url)(STUDIO_OVERLAY); }
  catch (e) {
    // Falls das Modul einmal als ES-Modul gilt: selbst auswerten (UMD erkennt module.exports)
    const m = { exports: {} };
    Function('module', 'exports', fs.readFileSync(STUDIO_OVERLAY, 'utf8'))(m, m.exports);
    return m.exports;
  }
}
async function leinwandLaden() {
  let C;
  try { C = await import('@napi-rs/canvas'); } catch (e) { throw new RenderFehler('Das Zeichenmodul @napi-rs/canvas fehlt. Einmal „npm install“ im Ordner quellen/render ausführen.'); }
  const C2 = C.default && C.default.createCanvas ? C.default : C;
  for (const [datei, familie] of SCHRIFT_DATEIEN) {
    const p = path.join(SCHRIFTEN, datei);
    if (!fs.existsSync(p)) { warnung(`Schrift ${datei} fehlt, die Einblendungen sehen anders aus als in der Vorschau.`); continue; }
    try { C2.GlobalFonts.registerFromPath(p, familie); } catch (e) { warnung(`Schrift ${datei} ließ sich nicht laden.`); }
  }
  return C2;
}
const lnAktiv = ln => !!(ln && String(ln.name || '').trim() && ln.mode !== 'off');
/* Ergebnis: { art: 'keins' } | { art: 'bild', datei } (ein Bild für das ganze Video) | { art: 'folge', datei: <ffconcat> } */
async function overlayBilder(plan, arg, tmp, melde) {
  const ov = plan.overlay || {};
  const osd = !!ov.osd, ln = lnAktiv(ov.ln) ? { name: String(ov.ln.name), mode: ov.ln.mode === 'start' ? 'start' : 'all' } : null; // Browser: 'start' | 'all' | 'off'; alles außer 'start' = immer sichtbar
  let sticker = null;
  if (ov.teil) {
    sticker = teilFinden(arg.teile, ov.teil);
    if (!sticker) warnung('Das Sticker-Bild fehlt im Auftrag, das Video wird ohne Sticker gerechnet.');
  }
  if (!osd && !ln) {
    melde(1);
    if (!sticker) return { art: 'keins' };
    const so = await ffprobeJson(sticker);
    const v = so && (so.streams || []).find(s => s.codec_type === 'video');
    if (!v) { warnung('Das Sticker-Bild ist nicht lesbar, das Video wird ohne Sticker gerechnet.'); return { art: 'keins' }; }
    if (v.width !== plan.W || v.height !== plan.H) warnung(`Das Sticker-Bild hat ${v.width} × ${v.height} statt ${plan.W} × ${plan.H} und wird angepasst.`);
    return { art: 'bild', datei: sticker };
  }
  const C = await leinwandLaden(), OV = overlayModulLaden();
  let stickerBild = null;
  if (sticker) {
    try { stickerBild = await C.loadImage(fs.readFileSync(sticker)); }
    catch (e) { warnung('Das Sticker-Bild ist nicht lesbar, das Video wird ohne Sticker gerechnet.'); }
    if (stickerBild && (stickerBild.width !== plan.W || stickerBild.height !== plan.H)) warnung(`Das Sticker-Bild hat ${stickerBild.width} × ${stickerBild.height} statt ${plan.W} × ${plan.H} und wird angepasst.`);
  }
  const { W, H, F, fps } = plan;
  const lw = C.createCanvas(W, H), c = lw.getContext('2d');
  const dateien = new Map(), laeufe = [];
  for (let i = 0; i < F; i++) {
    const t = i / fps, key = OV.frameKey(t, osd, ln);
    const last = laeufe[laeufe.length - 1];
    if (last && last.key === key) { last.n++; continue; }
    laeufe.push({ key, n: 1 });
    if (dateien.has(key)) continue;
    // Reihenfolge wie overlay() im Studio: OSD, Sticker, Namens-Einblendung
    c.clearRect(0, 0, W, H);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    if (osd) OV.drawOSD(c, W, H, t);
    if (stickerBild) c.drawImage(stickerBild, 0, 0, W, H);
    if (ln) OV.drawLower(c, W, H, t, ln, osd, false);
    const name = `overlay_${String(dateien.size).padStart(4, '0')}.png`;
    await fsp.writeFile(path.join(tmp, name), await lw.encode('png'));
    dateien.set(key, name);
    if (i % 10 === 0) melde(i / F);
  }
  const zeilen = ['ffconcat version 1.0'];
  for (const l of laeufe) zeilen.push(`file '${dateien.get(l.key)}'`, `duration ${z(l.n / plan.R.wert)}`);
  const liste = path.join(tmp, 'overlay.ffconcat');
  await fsp.writeFile(liste, zeilen.join('\n') + '\n');
  melde(1);
  info(`Overlay: ${dateien.size} verschiedene Bilder für ${F} Ausgabebilder`);
  return { art: 'folge', datei: liste };
}

/* =====================================================================
   Ton: Originalton (Szenen mit kind "1") und Musik → ton.wav
   ===================================================================== */
const RATE = 48000;
function kanalFilter(kanaele, wieBrowserClip) {
  if (kanaele <= 1) return 'pan=stereo|c0=c0|c1=c0'; // Mono auf beide Seiten, wie Web Audio
  if (kanaele === 2 || wieBrowserClip) return 'pan=stereo|c0=c0|c1=c1'; // clipAudio im Studio nimmt die ersten zwei Kanäle
  return 'aformat=channel_layouts=stereo';
}
async function tonMischen(plan, arg, tmp, melde) {
  const au = plan.audio || {};
  const origVol = au.origVol == null ? 1 : klemm(zahl(au.origVol) || 0, 0, 4);
  const eing = [], ketten = [], namen = [];
  const T = Math.max(1, Math.round(plan.total * RATE));
  if (origVol > 0) {
    for (const sz of plan.szenen) {
      if (sz.kind !== '1') continue;
      const c = plan.clips[sz.clip];
      if (!c.sonde.ton) continue;
      const nr = eing.length / 2, n = Math.max(1, Math.round(sz.len * RATE)), e = Math.min(.015, sz.len / 4);
      eing.push(['-ss', z(sz.a), '-t', z(sz.len + .25)], ['-i', c.datei]);
      ketten.push(`[${nr}:${c.sonde.ton.index}]aresample=${RATE},${kanalFilter(c.sonde.ton.kanaele, true)},atrim=duration=${z(sz.len)},apad=whole_len=${n},atrim=end_sample=${n},` +
        `volume=${z(origVol)},afade=t=in:d=${z(e)},afade=t=out:st=${z(sz.len - e)}:d=${z(e)},adelay=delays=${Math.round(sz.at * RATE)}S:all=1[o${nr}]`);
      namen.push(`[o${nr}]`);
    }
  }
  const mu = au.music;
  if (mu && mu.teil) {
    const datei = teilFinden(arg.teile, mu.teil), vol = mu.vol == null ? 1 : Math.max(0, zahl(mu.vol) || 0);
    if (!datei) warnung('Die Musik fehlt im Auftrag, das Video wird ohne Musik gerechnet.');
    else if (vol > 0) {
      const so = await sonde(datei);
      if (!so || !so.ton) warnung('Die Musikdatei ist nicht lesbar, das Video wird ohne Musik gerechnet.');
      else {
        const start = Math.max(0, zahl(mu.start) || 0), dauer = so.ton.dauer || so.dauer;
        if (dauer > 0 && start >= dauer) warnung('Die Musik beginnt nach ihrem eigenen Ende, das Video bleibt an dieser Stelle still.');
        else if (dauer > 0 && dauer - start < plan.total - .05) info(`Hinweis: Die Musik endet nach ${sek(dauer - start)}, danach läuft der Rest ohne Musik (keine Wiederholung).`);
        const fin = Math.min(Math.max(0, zahl(mu.fin) || 0), plan.total / 2), fout = Math.min(Math.max(0, zahl(mu.fout) || 0), plan.total / 2);
        const nr = eing.length / 2;
        eing.push(['-ss', z(start), '-t', z(plan.total + .5)], ['-i', datei]);
        let k = `[${nr}:${so.ton.index}]aresample=${RATE},${kanalFilter(so.ton.kanaele, false)},volume=${z(vol)}`;
        if (fin > 0) k += `,afade=t=in:st=0:d=${z(fin)}`;
        if (fout > 0) k += `,afade=t=out:st=${z(plan.total - fout)}:d=${z(fout)}`;
        ketten.push(`${k},apad=whole_len=${T},atrim=end_sample=${T}[m${nr}]`);
        namen.push(`[m${nr}]`);
      }
    }
  }
  if (!namen.length) { melde(1); info('Ton: keiner (kein Originalton und keine Musik)'); return null; }
  const ende = `apad=whole_len=${T},atrim=end_sample=${T},aformat=sample_fmts=flt:sample_rates=${RATE}:channel_layouts=stereo[ton]`;
  ketten.push(namen.length > 1 ? `${namen.join('')}amix=inputs=${namen.length}:normalize=0:duration=longest:dropout_transition=0,${ende}` : `${namen[0]}${ende}`);
  const skript = path.join(tmp, 'ton.filter');
  await fsp.writeFile(skript, ketten.join(';\n') + '\n');
  const ziel = path.join(tmp, 'ton.wav');
  await ffmpeg([...eing.flat(), '-filter_complex_script', skript, '-map', '[ton]', '-c:a', 'pcm_f32le', '-ar', String(RATE), '-ac', '2', '-map_metadata', '-1', ziel], { cwd: tmp, was: 'Ton mischen' });
  melde(1);
  info(`Ton: ${namen.length} Spur${namen.length === 1 ? '' : 'en'} gemischt`);
  return ziel;
}

/* =====================================================================
   Szenen: jede Szene als eigene Zwischendatei mit genau n Bildern
   ===================================================================== */
// Farbe und Größe: Ausschnitt, Skalierung, HDR → SDR BT.709 (wie gyroflow.yml), Ergebnis yuv420p BT.709 begrenzter Bereich
function bildFilter(v, cr, W, H) {
  const f = [`crop=${cr.width}:${cr.height}:${cr.left}:${cr.top}`];
  if (v.hdr) {
    const raum = v.raum === 'bt2020c' ? 'bt2020c' : 'bt2020nc';
    f.push(`scale=${W}:${H}:flags=lanczos`,
      `zscale=tin=${v.transfer}:min=${raum}:pin=bt2020:rin=${v.bereich}:t=linear:npl=100`, 'format=gbrpf32le', 'zscale=p=bt709',
      'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=limited', 'format=yuv420p');
  } else if (v.primaer === 'bt2020') {
    // SDR in BT.2020 (selten): nur Farbraum umrechnen
    f.push(`scale=${W}:${H}:flags=lanczos`, `zscale=tin=bt709:min=${v.raum === 'bt2020c' ? 'bt2020c' : 'bt2020nc'}:pin=bt2020:rin=${v.bereich}:t=bt709:m=bt709:p=bt709:r=limited`, 'format=yuv420p');
  } else {
    const m = ['smpte170m', 'bt470bg'].includes(v.raum) ? 'bt601' : 'bt709';
    f.push(`scale=${W}:${H}:flags=lanczos:in_color_matrix=${m}:out_color_matrix=bt709:in_range=${v.bereich}:out_range=limited`, 'format=yuv420p');
  }
  f.push('setsar=1', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv');
  return f.join(',');
}
/* Bildkette für ein Fenster einer Szene: Ausgabebilder g0 … g0+n−1 (Bildnummern im fertigen Video).
   Für Bild k gilt wie im Browser: Quellzeit = srcFn((g0 + k)/fps − at), höchstens dur − 1/fps (danach letztes Bild stehen lassen).
   Umsetzung: Quelle ab kurz vor der ersten Quellzeit lesen, jedem Quellbild per setpts seine Ausgabezeit geben (Umkehrung von srcFn),
   dann fps mit round=up: Ausgabebild k bekommt das letzte Quellbild mit Ausgabezeit ≤ k/fps (wie samplesAtTimestamps im Browser). */
function bildKette(plan, sz, fenster, nr, label, standbild) {
  const c = plan.clips[sz.clip], v = c.sonde.video, fps = plan.fps, R = plan.R.text;
  const qfps = v.fps, letzte = Math.max(0, v.dauer - 1 / qfps), src = srcFn(sz);
  const l0 = fenster.g0 / fps - sz.at, l1 = (fenster.g0 + fenster.n - 1) / fps - sz.at;
  const sAnfang = klemm(src(l0), 0, Infinity), sEnde = klemm(src(l1), 0, Infinity);
  const bild = bildFilter(v, sz.crop, plan.W, plan.H);
  const quelle = `[${nr}:${v.index}]`;
  if (standbild || sAnfang >= letzte - .25 / qfps) {
    // Ganzes Fenster liegt hinter dem letzten Bild: letztes Bild der Datei (vom Ende her gesucht) n-mal
    const zurueck = Math.max(.12, 5 / qfps);
    return {
      eingabe: ['-sseof', z(-zurueck), '-i', c.datei], standbild: true,
      filter: `${quelle}${bild},reverse,trim=end_frame=1,loop=loop=${fenster.n}:size=1:start=0,setpts=N/(${R})/TB,fps=${R},trim=end_frame=${fenster.n},setpts=N/FR/TB[${label}]`
    };
  }
  const seek = Math.max(0, sAnfang - 1.5 / qfps);
  const bis = Math.min(Math.max(sEnde, sAnfang), letzte) + 3 / qfps;
  const zeit = `st(0,T+${z(seek)});max(0,${umkehrAusdruck(zeitStuecke(sz))}-${z(l0)}-0.000001)/TB`;
  return {
    eingabe: ['-ss', z(seek), '-t', z(Math.max(4 / qfps, bis - seek)), '-i', c.datei], standbild: false,
    endetFrueh: sEnde > letzte,
    filter: `${quelle}setpts='${zeit}',fps=${R}:round=up:start_time=0,${bild},tpad=stop_mode=clone:stop=${fenster.n},trim=end_frame=${fenster.n},setpts=N/FR/TB[${label}]`
  };
}
/* Maske für Übergangsbild N (0 … d−1), Wert 0 … 255, Fortschritt p = (N + 0,5)/d wie im Browser.
   blende: smoothstep(0, 1, p) von A nach B · blitz: Weißanteil (1 − p)^2,2 · 0,95 über B
   wisch: Kante x·0,8 + y·0,2, e = smoothstep(0, 1, p)·1,5 − 0,25, Anteil A = smoothstep(e − 0,08, e + 0,08, Kante) */
function maskenAusdruck(typ, bilder) {
  const p = `st(0,clip((N+0.5)/${bilder},0,1))`;
  if (typ === 'blende') return `${p};255*ld(0)*ld(0)*(3-2*ld(0))+0.5`;
  if (typ === 'blitz') return `${p};255*pow(1-ld(0),2.2)*0.95+0.5`;
  return `${p};st(1,ld(0)*ld(0)*(3-2*ld(0))*1.5-0.25);st(2,clip(((X+0.5)/W*0.8+(Y+0.5)/H*0.2-ld(1)+0.08)/0.16,0,1));255*ld(2)*ld(2)*(3-2*ld(2))+0.5`;
}
// Filterzeilen für den Übergang: [a] (d Bilder Nachlauf der vorigen Szene) und [b] (n Bilder dieser Szene) → [v] (n Bilder)
function uebergangFilter(plan, ue, n, ersatz) {
  const art = UEBERGAENGE[ue.typ], d = ue.bilder, R = plan.R.text, W = plan.W, H = plan.H;
  const tag = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
  const xf = art.xfade || (ersatz && art.ersatz);
  if (xf) return [`[a]format=yuv444p[a4]`, `[b]format=yuv444p[b4]`, `[a4][b4]xfade=transition=${xf}:duration=${z(d / plan.R.wert)}:offset=0,format=yuv420p,${tag}[v]`];
  const fein = ue.typ === 'wisch', mw = fein ? gerade(W / 8) : 16, mh = fein ? gerade(H / 8) : 16, e = maskenAusdruck(art.maske, d);
  const zeilen = [
    // Blitz braucht A nicht (nur B und Weiß): A trotzdem abnehmen, sonst bleibt ein offener Ausgang
    art.maske === 'blitz' ? `[a]nullsink` : `[a]format=yuv444p[a4]`,
    n > d ? `[b]format=yuv444p,split[bs][bz]` : `[b]format=yuv444p[bs]`,
    `[bs]trim=end_frame=${d}[bt]`,
    `color=c=black:s=${mw}x${mh}:r=${R},format=yuv444p,trim=end_frame=${d},geq=lum='${e}':cb='${e}':cr='${e}',scale=${W}:${H}:flags=bilinear,setsar=1[m]`
  ];
  if (art.maske === 'blende') zeilen.push(`[a4][bt][m]maskedmerge[x]`);
  else if (art.maske === 'wisch') zeilen.push(`[bt][a4][m]maskedmerge[x]`);
  else zeilen.push(`color=c=white:s=${W}x${H}:r=${R},format=yuv444p,trim=end_frame=${d},setsar=1[weiss]`, `[bt][weiss][m]maskedmerge[x]`);
  if (n > d) zeilen.push(`[bz]trim=start_frame=${d},setpts=PTS-STARTPTS[br]`, `[x][br]concat=n=2:v=1:a=0,format=yuv420p,${tag}[v]`);
  else zeilen.push(`[x]format=yuv420p,${tag}[v]`);
  return zeilen;
}
function szeneAuftrag(plan, i, tmp, { standbildA = false, standbildB = false, ersatzUebergang = false } = {}) {
  const sz = plan.szenen[i], ue = sz.uebergang;
  const b = bildKette(plan, sz, { g0: sz.f0, n: sz.n }, 0, ue ? 'b' : 'v', standbildB);
  const eingaben = [...b.eingabe], ketten = [b.filter];
  let a = null;
  if (ue) {
    // Stück A: die vorige Szene läuft über ihr Ende hinaus weiter (Quellzeit src_{i−1}(len_{i−1} + l))
    a = bildKette(plan, plan.szenen[i - 1], { g0: sz.f0, n: ue.bilder }, 1, 'a', standbildA);
    eingaben.push(...a.eingabe);
    ketten.push(a.filter, ...uebergangFilter(plan, ue, sz.n, ersatzUebergang));
  }
  const name = `szene_${String(i).padStart(3, '0')}`;
  return { name, datei: path.join(tmp, `${name}.mkv`), skript: path.join(tmp, `${name}.filter`), eingaben, filter: ketten.join(';\n') + '\n', a, b };
}
async function szeneRechnen(plan, i, tmp, melde) {
  const sz = plan.szenen[i];
  const versuch = async opt => {
    const job = szeneAuftrag(plan, i, tmp, opt);
    await fsp.writeFile(job.skript, job.filter);
    const n = await ffmpeg([...job.eingaben, '-filter_complex_script', job.skript, '-map', '[v]', '-an', '-sn', '-dn',
      '-map_metadata', '-1', '-map_chapters', '-1', ...ZWISCHEN_KODIERUNG, '-r', plan.R.text, job.datei],
    { cwd: tmp, bilder: sz.n, beiFortschritt: melde, was: `Szene ${sz.nr}` });
    return { n, job };
  };
  let opt = {}, r;
  for (let runde = 0; runde < 4; runde++) {
    try { r = await versuch(opt); }
    catch (e) {
      // Genauer Übergang (Maske) gescheitert: eingebauter Ersatz (Blende → fade, Blitz → fadewhite, Wisch → wiperight)
      const ue = sz.uebergang;
      if (e.ffmpeg && ue && UEBERGAENGE[ue.typ].maske && !opt.ersatzUebergang) { warnung(`Szene ${sz.nr}: Übergang „${ue.typ}“ ging nicht genau, ersatzweise xfade ${UEBERGAENGE[ue.typ].ersatz}.`); opt = { ...opt, ersatzUebergang: true }; continue; }
      throw e;
    }
    if (r.n === sz.n) break;
    // Zu wenige Bilder: Die Quelle endet früher als ihre Kopfdaten sagen. Dann das letzte Bild stehen lassen (wie der Browser).
    if (!opt.standbildB && r.job.b && !r.job.b.standbild) { opt = { ...opt, standbildB: true }; info(`Hinweis: Szene ${sz.nr} endet früher als erwartet, das letzte Bild wird gehalten.`); continue; }
    if (r.job.a && !opt.standbildA && !r.job.a.standbild) { opt = { ...opt, standbildA: true }; continue; }
    break;
  }
  if (r.n !== sz.n) throw new RenderFehler(`Szene ${sz.nr} hat ${r.n} statt ${sz.n} Bilder ergeben.`);
  if (r.job.b.endetFrueh) info(`Hinweis: In Szene ${sz.nr} endet der Clip vor dem Szenenende, das letzte Bild wird gehalten.`);
  if (r.job.a && (r.job.a.endetFrueh || r.job.a.standbild)) info(`Hinweis: Beim Übergang in Szene ${sz.nr} steht das letzte Bild der vorigen Szene.`);
  return r.job.datei;
}
async function nebeneinander(anzahl, aufgaben) {
  const erg = new Array(aufgaben.length); let naechste = 0, fehler = null;
  const arbeiter = async () => {
    while (!fehler && naechste < aufgaben.length) {
      const i = naechste++;
      try { erg[i] = await aufgaben[i](); } catch (e) { fehler = fehler || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, anzahl) }, arbeiter));
  if (fehler) throw fehler;
  return erg;
}

/* =====================================================================
   Endkodierung: Szenen aneinander, Look, Ausblenden, Overlay, H.264 + AAC
   ===================================================================== */
async function endkodierung(plan, arg, tmp, szenenDateien, lookF, overlay, ton, ziel, melde) {
  const liste = path.join(tmp, 'szenen.ffconcat');
  await fsp.writeFile(liste, ['ffconcat version 1.0', ...szenenDateien.map(d => `file '${path.basename(d)}'`)].join('\n') + '\n');
  const { F, R } = plan, eing = ['-f', 'concat', '-safe', '0', '-i', liste];
  const k = [];
  // Zeitstempel neu (Bild für Bild), dann RGB: Look und Ausblenden rechnen wie der Shader auf dem angezeigten Bild
  let haupt = `[0:v]setpts=N/(${R.text})/TB,fps=${R.text},trim=end_frame=${F},scale=in_color_matrix=bt709:in_range=limited,format=gbrp`;
  if (lookF) haupt += `,${lookF.filter}`;
  if (plan.fadeBilder > 0) haupt += `,fade=t=out:s=${F - plan.fadeBilder}:n=${plan.fadeBilder}`;
  let letztes = 'g';
  k.push(`${haupt}[g]`);
  let nr = 1;
  if (overlay.art !== 'keins') {
    if (overlay.art === 'folge') {
      eing.push('-f', 'concat', '-safe', '0', '-i', overlay.datei);
      k.push(`[${nr}:v]fps=${R.text}:start_time=0,format=rgba,tpad=stop_mode=clone:stop=${F},trim=end_frame=${F}[o]`);
    } else {
      eing.push('-i', overlay.datei);
      k.push(`[${nr}:v]scale=${plan.W}:${plan.H},format=rgba[o]`);
    }
    k.push(`[g][o]overlay=format=gbrp:eof_action=repeat:shortest=0[gu]`);
    letztes = 'gu'; nr++;
  }
  k.push(`[${letztes}]scale=out_color_matrix=bt709:out_range=limited,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`);
  const skript = path.join(tmp, 'ende.filter');
  await fsp.writeFile(skript, k.join(';\n') + '\n');
  const tonArgs = [];
  if (ton) { eing.push('-i', ton); tonArgs.push('-map', `${nr}:a`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'); }
  const br = plan.bitrate;
  const args = [...eing, '-filter_complex_script', skript, '-map', '[v]', ...tonArgs,
    '-c:v', 'libx264', '-preset', arg.preset, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', String(br), '-maxrate', String(Math.round(br * 1.3)), '-bufsize', String(Math.round(br * 2)),
    '-g', String(Math.max(1, Math.round(2 * plan.fps))), '-r', R.text,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-map_metadata', '-1', '-map_chapters', '-1', '-metadata', `title=${plan.name}`,
    '-movflags', '+faststart', '-f', 'mp4', ziel];
  const n = await ffmpeg(args, { cwd: tmp, bilder: F, beiFortschritt: melde, was: 'Endkodierung' });
  if (n !== F) throw new RenderFehler(`Die Endkodierung hat ${n} statt ${F} Bilder geschrieben.`);
}

/* =====================================================================
   Prüfen: Größe, Länge, Ton
   ===================================================================== */
async function ergebnisPruefen(datei, plan, mitTon) {
  const j = await ffprobeJson(datei, ['-count_packets']);
  if (!j) throw new RenderFehler('Das fertige Video ist nicht lesbar.');
  const v = (j.streams || []).find(s => s.codec_type === 'video'), a = (j.streams || []).find(s => s.codec_type === 'audio');
  if (!v) throw new RenderFehler('Im fertigen Video fehlt die Bildspur.');
  if (v.width !== plan.W || v.height !== plan.H) throw new RenderFehler(`Das fertige Video hat ${v.width} × ${v.height} statt ${plan.W} × ${plan.H}.`);
  const bilder = +v.nb_read_packets || +v.nb_frames || 0;
  if (bilder !== plan.F) throw new RenderFehler(`Das fertige Video hat ${bilder} statt ${plan.F} Bilder.`);
  const vd = zahl(v.duration);
  if (Number.isFinite(vd) && Math.abs(vd - plan.total) > 1 / plan.fps + .01) warnung(`Die Bildspur ist ${vd.toFixed(3)} s lang statt ${plan.total.toFixed(3)} s.`);
  if (mitTon && !a) throw new RenderFehler('Im fertigen Video fehlt die Tonspur.');
  if (!mitTon && a) throw new RenderFehler('Das fertige Video hat eine Tonspur, obwohl keine vorgesehen war.');
  const groesse = zahl(j.format && j.format.size) || 0;
  const zus = {
    breite: v.width, hoehe: v.height, fps: bruchWert(v.avg_frame_rate), bilder, dauer: zahl(j.format && j.format.duration),
    video: `${v.codec_name} ${v.profile || ''} ${v.pix_fmt}`.replace(/\s+/g, ' ').trim(), bitrate: zahl(v.bit_rate) || 0,
    ton: a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} Kanäle` : 'ohne Ton', groesse
  };
  info(`Ergebnis: ${zus.breite} × ${zus.hoehe} · ${String(Math.round(zus.fps * 1000) / 1000).replace('.', ',')} fps · ${zus.bilder} Bilder · ${sek(zus.dauer)} · ${zus.video} · ` +
    `${(zus.bitrate / 1e6).toFixed(1).replace('.', ',')} Mbit/s · ${zus.ton} · ${(groesse / 1048576).toFixed(1).replace('.', ',')} MB`);
  return zus;
}

/* =====================================================================
   Ablauf
   ===================================================================== */
async function rendern(arg) {
  const t0 = Date.now();
  await werkzeugePruefen();
  const out = path.resolve(arg.out);
  VERBERGEN.push([path.resolve(arg.teile), '<teile>'], [path.dirname(out), '<ausgabe>']);
  const eigenesTmp = !arg.tmp;
  const tmp = arg.tmp ? path.resolve(arg.tmp) : await fsp.mkdtemp(path.join(os.tmpdir(), 'fcs-render-'));
  VERBERGEN.unshift([tmp, '<tmp>']);
  await fsp.mkdir(tmp, { recursive: true });
  await fsp.mkdir(path.dirname(out), { recursive: true });
  const zwischen = path.join(path.dirname(out), `.${path.basename(out, path.extname(out))}.entsteht.mp4`);
  try {
    const rezept = rezeptLesen(arg.rezept);
    if (!shaderPruefen()) warnung('Der Look-Shader in studio-gl.js wurde geändert. Die Render-Station rechnet noch nach der alten Fassung (Selbsttest ausführen und grade() nachziehen).');
    const plan = await planen(rezept, arg);
    info(`Rezept „${plan.name}“: ${plan.szenen.length} Szene${plan.szenen.length === 1 ? '' : 'n'}, ${sek(plan.total)}, ${plan.W} × ${plan.H}, ${String(plan.fps).replace('.', ',')} fps` +
      `${plan.look ? `, Look ${plan.look.id} ${plan.look.k}` : ''}${plan.fadeBilder ? `, Ausblenden ${plan.fadeBilder} Bilder` : ''}, Preset ${arg.preset}`);
    fortschritt(0);
    // Look als 3D-LUT (D-Log M als genaue Gleitkomma-Kette)
    const lookF = plan.look ? await lookFilter(plan.look, tmp) : null;
    // Overlay und Ton
    const overlay = await overlayBilder(plan, arg, tmp, abschnitt(0, .04));
    const ton = await tonMischen(plan, arg, tmp, abschnitt(.04, .06));
    // Szenen (bis zu drei gleichzeitig, jede mit eigenen ffmpeg-Fäden)
    const fertig = new Array(plan.szenen.length).fill(0);
    const meldeSzene = i => p => { fertig[i] = p * plan.szenen[i].n; fortschritt(.06 + .44 * fertig.reduce((s, x) => s + x, 0) / plan.F); };
    const parallel = Math.max(1, Math.min(3, Math.floor(os.cpus().length / 2)));
    const ts = Date.now();
    const szenenDateien = await nebeneinander(parallel, plan.szenen.map((_, i) => () => szeneRechnen(plan, i, tmp, meldeSzene(i))));
    info(`Szenen gerechnet: ${plan.szenen.length} in ${((Date.now() - ts) / 1000).toFixed(1).replace('.', ',')} s`);
    // Endkodierung
    const te = Date.now();
    await endkodierung(plan, arg, tmp, szenenDateien, lookF, overlay, ton, zwischen, abschnitt(.5, .99));
    info(`Endkodierung: ${((Date.now() - te) / 1000).toFixed(1).replace('.', ',')} s`);
    await ergebnisPruefen(zwischen, plan, !!ton);
    await fsp.rename(zwischen, out);
    fortschritt(1);
    info(`Fertig in ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s${WARNUNGEN.length ? ` (${WARNUNGEN.length} Warnung${WARNUNGEN.length === 1 ? '' : 'en'})` : ''}`);
  } finally {
    await fsp.rm(zwischen, { force: true }).catch(() => {});
    if (eigenesTmp) await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/* =====================================================================
   Selbsttest: Look-Port, LUT in ffmpeg, Schriften und Overlay-Zeichnung, Filter
   ===================================================================== */
async function selbsttest() {
  const ergebnisse = []; let ok = true;
  const pruefe = (name, bedingung, detail = '') => { ergebnisse.push(`${bedingung ? 'ok    ' : 'FEHLER'} ${name}${detail ? ` (${detail})` : ''}`); if (!bedingung) ok = false; };
  const L = looksLaden();
  pruefe('Looks aus studio-gl.js gelesen', L !== LOOKS_ERSATZ && !!L.warm && !!L.dlogm, Object.keys(L).join(', '));
  pruefe('Shader grade()/dlogm() unverändert seit dem Port', shaderPruefen());
  // 1. Look-Port in JavaScript
  const farben = []; for (let i = 0; i < 300; i++) farben.push([Math.random(), Math.random(), Math.random()]);
  let maxAbw = 0;
  for (const id of Object.keys(L)) for (const c of farben) { const o = grade(c, lookParameter(L[id]), 0); for (let j = 0; j < 3; j++) maxAbw = Math.max(maxAbw, Math.abs(o[j] - c[j])); }
  pruefe('k = 0 lässt jede Farbe unverändert (alle Looks)', maxAbw < 1e-12, `größte Abweichung ${maxAbw.toExponential(1)}`);
  const swP = lookParameter(L.sw); let swMax = 0;
  for (const c of farben) { const o = grade(c, swP, 1); swMax = Math.max(swMax, Math.abs(o[0] - o[1]), Math.abs(o[1] - o[2])); }
  pruefe('sw ergibt Grau (r = g = b)', swMax < 1e-9, `größte Abweichung ${swMax.toExponential(1)}`);
  const w = grade([.5, .5, .5], lookParameter(L.warm), 1);
  pruefe('warm wärmt mittleres Grau (R > B)', w[0] > w[2] + .02, w.map(x => x.toFixed(3)).join(' / '));
  const d = grade([.4, .4, .4], lookParameter(L.dlogm), 1);
  pruefe('dlogm hebt flaches Log-Grau an', d[0] > .4 && Math.abs(d[0] - d[2]) < .01, d.map(x => x.toFixed(3)).join(' / '));
  // 2. LUT in ffmpeg (Achsenreihenfolge, Identität, sw, warm)
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'fcs-selbsttest-'));
  try {
    await werkzeugePruefen(); pruefe('ffmpeg mit xfade, lut3d, zscale, tonemap, overlay, amix', true);
    // Testbild: ein Raster über den ganzen RGB-Würfel (und für D-Log M zusätzlich typische flache Log-Farben)
    const farbenRgb = [];
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) farbenRgb.push([r, g, b]);
    for (let i = 0; i < 2000; i++) { const y = .05 + Math.random() * .8, s = Math.random() * .25; farbenRgb.push([0, 1, 2].map(() => Math.round(klemm(y + (Math.random() * 2 - 1) * s, 0, 1) * 255))); }
    const Wt = farbenRgb.length, roh = Buffer.alloc(Wt * 3);
    farbenRgb.forEach((c, i) => roh.set(c, i * 3));
    await fsp.writeFile(path.join(tmp, 'farben.rgb'), roh);
    // Genau die Kette, die die Endkodierung nimmt (lookFilter), auf das Testbild anwenden
    const lookAnwenden = async (look, kennung) => {
      const lf = look ? await lookFilter(look, tmp, kennung) : { filter: 'null' };
      return new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${Wt}x1`, '-i', 'farben.rgb',
          '-filter_complex', `[0:v]format=gbrp,${lf.filter},format=rgb24[v]`, '-map', '[v]', '-f', 'rawvideo', '-'], { cwd: tmp });
        const teile = [], fehler = []; p.stdout.on('data', x => teile.push(x)); p.stderr.on('data', x => fehler.push(x));
        p.on('error', reject); p.on('close', c => resolve(c === 0 ? Buffer.concat(teile) : (info(Buffer.concat(fehler).toString()), null)));
      });
    };
    for (const [id, k, grenze] of [['natur', 0, 1], ['warm', 0, 1], ['sw', 1, 3], ['warm', 1, 3], ['warm', .8, 3], ['kraeftig', .7, 4], ['kuehl', 1, 3], ['dlogm', 1, 3], ['dlogm', .6, 3]]) {
      const px = await lookAnwenden(id === 'natur' || k === 0 ? (id === 'natur' ? null : { id, k: 0 }) : { id, k }, `t_${id}_${String(k).replace('.', '')}`);
      if (!px) { pruefe(`Look ${id} k=${k} in ffmpeg`, false, 'ffmpeg ging nicht'); continue; }
      let abw = 0, grauAbw = 0, warmR = 0, warmB = 0; const P = lookParameter(L[id]), ab = [];
      for (let i = 0; i < Wt; i++) {
        const c = [roh[i * 3] / 255, roh[i * 3 + 1] / 255, roh[i * 3 + 2] / 255], e = grade(c, P, k);
        for (let j = 0; j < 3; j++) { const d = Math.abs(px[i * 3 + j] - e[j] * 255); ab.push(d); abw = Math.max(abw, d); }
        grauAbw = Math.max(grauAbw, Math.abs(px[i * 3] - px[i * 3 + 1]), Math.abs(px[i * 3 + 1] - px[i * 3 + 2]));
        if (roh[i * 3] === roh[i * 3 + 1] && roh[i * 3 + 1] === roh[i * 3 + 2] && roh[i * 3] > 80 && roh[i * 3] < 180) { warmR += px[i * 3]; warmB += px[i * 3 + 2]; }
      }
      ab.sort((x, y) => x - y);
      const p999 = ab[Math.floor(ab.length * .999)];
      pruefe(`Look ${id} k=${k}: ffmpeg gleich grade()`, p999 <= grenze, `99,9 % der Werte höchstens ${p999.toFixed(1)} von 255 daneben, größte Abweichung ${abw.toFixed(1)}`);
      if (k === 0) pruefe(`Look ${id} k=0 lässt das Bild unverändert (LUT-Identität)`, abw <= 1, `größte Abweichung ${abw.toFixed(1)}`);
      if (id === 'sw') pruefe('Look sw ergibt graue Pixel', grauAbw <= 1, `größte Kanaldifferenz ${grauAbw}`);
      if (id === 'warm' && k === 1) pruefe('Look warm wärmt mittleres Grau (R > B)', warmR > warmB + 4, `Summe R ${warmR}, Summe B ${warmB}`);
    }
    // 3. Schriften und Overlay-Zeichnung
    const C = await leinwandLaden(), OV = overlayModulLaden();
    pruefe('Schriften Bebas Neue und Chakra Petch geladen', C.GlobalFonts.has('Bebas Neue') && C.GlobalFonts.has('Chakra Petch'));
    const lw = C.createCanvas(540, 960), c = lw.getContext('2d');
    OV.drawOSD(c, 540, 960, 1.2); OV.drawLower(c, 540, 960, 2, { name: 'Selbsttest', mode: 'start' }, true, false);
    const daten = c.getImageData(0, 0, 540, 960).data; let sichtbar = 0;
    for (let i = 3; i < daten.length; i += 4) if (daten[i] > 0) sichtbar++;
    pruefe('Overlay zeichnet OSD und Einblendung', sichtbar > 2000 && sichtbar < 540 * 960 * .5, `${sichtbar} sichtbare Pixel`);
    pruefe('frameKey: gleiche Zeitpunkte, gleicher Schlüssel', OV.frameKey(3.1, true, null) === OV.frameKey(3.2, true, null) && OV.frameKey(3.1, true, null) !== OV.frameKey(3.6, true, null));
  } catch (e) {
    pruefe('Selbsttest lief durch', false, e.message);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
  for (const z1 of ergebnisse) info(z1);
  info(ok ? 'Selbsttest bestanden' : 'Selbsttest NICHT bestanden');
  return ok;
}

/* =====================================================================
   Start
   ===================================================================== */
async function main() {
  const arg = argumenteLesen(process.argv.slice(2));
  if (arg.hilfe) { info(HILFE); return 0; }
  if (arg.selbsttest) return (await selbsttest()) ? 0 : 1;
  await rendern(arg);
  return 0;
}
const istHauptprogramm = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHauptprogramm) {
  main().then(code => { process.exitCode = code; }).catch(e => {
    const text = e instanceof RenderFehler ? e.message : `Unerwarteter Fehler in der Render-Station: ${e && e.message ? e.message : e}`;
    process.stderr.write(`Fehler: ${verbergen(text)}\n`);
    process.exitCode = e instanceof RenderFehler ? e.code : 1;
  });
}

export { grade, lookParameter, lutText, srcFn, zeitStuecke, cropPx, bitrateFuer, fpsBruch, sonde, rezeptLesen, planen };
