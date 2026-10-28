/* Flight Club Saar · Clip-Studio: Medien-Motor (wird von studio.js erst bei Bedarf geladen)
   - probe(): Format-Steckbrief jeder Datei (Codec, Bit-Tiefe, HDR, Drehung, Bildrate, Ton), auch wenn der Browser sie nicht abspielen kann
   - lumaAt(): Selbsttest gegen schwarze oder einfarbige Bilder über vier Dekodier-Wege ('draw', 'cpu', 'copy', 'sw')
   - clipAudio()/mixAudio(): Originalton und Musik werden mit der Web-Audio-API sauber gemischt
   - render(): Export in Originalqualität (bis 4K) über WebCodecs, MP4 mit Fast Start; verify() prüft die fertige Datei */
import * as M from '../lib/mediabunny.min.mjs';
export { M };

const TEST = () => (typeof window !== 'undefined' && window.FCS_STUDIO_TEST) || {};
const inputs = new Map();
export function inp(file) {
  let i = inputs.get(file);
  if (!i) { i = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS }); inputs.set(file, i); }
  return i;
}
export function drop(file) { const i = inputs.get(file); if (i) { try { i.dispose(); } catch (e) {} inputs.delete(file); } audioCache.delete(file); }

const NAMES = { avc: 'H.264', hevc: 'HEVC (H.265)', vp9: 'VP9', av1: 'AV1', vp8: 'VP8', prores: 'ProRes' };
export const codecName = c => NAMES[c] || (c ? String(c).toUpperCase() : 'unbekannt');
export function bitsOf(codec, cs) {
  if (!cs) return 8;
  const p = String(cs).split('.');
  if ((codec === 'vp9' || codec === 'av1') && p[3]) return parseInt(p[3], 10) || 8;
  if (codec === 'hevc' && p[1]) { const pr = parseInt(String(p[1]).replace(/^[A-C]/i, ''), 10); return pr === 1 ? 8 : 10; }
  if (codec === 'avc' && p[1]) { const pr = parseInt(p[1].slice(0, 2), 16); return [110, 122, 244].includes(pr) ? 10 : 8; }
  return 8;
}

/* ---------- Format-Steckbrief ---------- */
export async function probe(file) {
  const i = inp(file), o = { name: file.name, size: file.size, type: file.type };
  try { o.container = (await i.getFormat()).name; } catch (e) { o.err = 'format'; return o; }
  let v = null; try { v = await i.getPrimaryVideoTrack(); } catch (e) {}
  if (!v) { o.err = 'novideo'; return o; }
  try { o.codec = await v.getCodec(); } catch (e) {}
  try { o.cs = await v.getCodecParameterString(); } catch (e) {}
  o.cw = await v.getCodedWidth(); o.ch = await v.getCodedHeight();
  o.w = await v.getDisplayWidth(); o.h = await v.getDisplayHeight(); o.rot = await v.getRotation();
  try { const c = await v.getColorSpace(); o.transfer = c.transfer || null; o.primaries = c.primaries || null; } catch (e) {}
  try { o.hdr = await v.hasHighDynamicRange(); } catch (e) { o.hdr = false; }
  o.bits = bitsOf(o.codec, o.cs);
  try { const fr = await v.computeFrameRateMetrics(); o.fps = fr.bestGuessFrameRate || fr.averageFrameRate || 30; o.vfr = !fr.frameRateIsConstant && (fr.maxFrameRate - fr.minFrameRate) > 1.5; } catch (e) { o.fps = 30; o.vfr = false; }
  try { o.dur = await i.computeDuration(); } catch (e) { o.dur = 0; }
  try { o.canDecode = await v.canDecode(); } catch (e) { o.canDecode = false; }
  if ((TEST().noWebCodecs || []).includes(file.name)) o.canDecode = false;
  try { const a = await i.getPrimaryAudioTrack(); if (a) { o.audio = await a.getCodec(); o.aDec = await a.canDecode(); } } catch (e) {}
  o.ok = true;
  return o;
}

/* ---------- Bild zeichnen: mehrere Wege, weil manche Handys (zum Beispiel Samsung mit HEVC oder HDR) auf dem
   Grafikchip-Canvas eine leere Fläche statt des Bildes liefern.
   'draw' = direkt auf den Grafikchip-Canvas · 'cpu' = auf einen Canvas im Arbeitsspeicher
   'copy' = über eine RGBA-Kopie in sRGB (rechnet HDR und 10 Bit auf normales SDR um) · 'sw' = Software-Dekoder ---------- */
export const WAYS = ['draw', 'cpu', 'copy', 'raw', 'sw'];
export const cpuWay = mode => mode === 'cpu' || mode === 'sw' || mode === 'raw';
export function sinkFor(track, mode) { return new M.VideoSampleSink(track, mode === 'sw' ? { hardwareAcceleration: 'prefer-software' } : {}); }
export function canvas(w, h, mode) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', cpuWay(mode) ? { alpha: false, willReadFrequently: true } : { alpha: false })];
}
const FLAT = '#2f0d33';
const flagged = (key, mode) => (TEST()[key] || []).includes(mode);
async function toRGBA(s) {
  const opt = { format: 'RGBA', colorSpace: 'srgb' };
  const buf = new Uint8Array(s.allocationSize(opt));
  await s.copyTo(buf, opt);
  const r = s.visibleRect || { width: s.codedWidth, height: s.codedHeight };
  return new M.VideoSample(buf, { format: 'RGBA', codedWidth: r.width, codedHeight: r.height, timestamp: s.timestamp, duration: s.duration, rotation: s.rotation });
}
/* 'raw': Rohdaten (YUV, 8 oder 10 Bit) aus dem Dekoder holen und selbst in RGB umrechnen, inklusive HDR (PQ/HLG) → SDR.
   Umgeht den Grafik-Weg des Browsers komplett: hilft, wenn das Handy für HDR-Videos überall nur leere Flächen liefert. */
const PQ = (() => { const m1 = .1593017578125, m2 = 78.84375, c1 = .8359375, c2 = 18.8515625, c3 = 18.6875; return v => { const p = Math.pow(Math.max(v, 0), 1 / m2); return Math.pow(Math.max(p - c1, 0) / (c2 - c3 * p), 1 / m1) * 10000; }; })();
const HLG = v => { const a = .17883277, b = .28466892, c = .55991073; return v <= .5 ? v * v / 3 : (Math.exp((v - c) / a) + b) / 12; };
const lutCache = new Map();
function luts(transfer) {
  let L = lutCache.get(transfer); if (L) return L;
  // Code (0..1023) → lineares Licht relativ zu SDR-Weiß; danach Tonkurve und Gamma über eine zweite Tabelle
  const lin = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const v = i / 1023;
    lin[i] = transfer === 'pq' ? PQ(v) / 203 : transfer === 'hlg' ? Math.pow(HLG(v) * 12, 1.2) / 3.2 : Math.pow(v, 2.4);
  }
  const hdr = transfer === 'pq' || transfer === 'hlg';
  const enc = new Uint8ClampedArray(4096); // lineares Licht 0..4 (in 4096 Stufen) → sRGB 8 Bit
  for (let i = 0; i < 4096; i++) { let x = i / 1023; if (hdr) x = x * (1 + x / 16) / (1 + x); x = Math.min(1, x); enc[i] = Math.round(255 * (x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055)); }
  L = { lin, enc, hdr }; lutCache.set(transfer, L); return L;
}
async function rawRGBA(s) {
  const fmt = s.format; if (!fmt) throw new Error('kein Rohformat');
  const deep = /P10|P12/.test(fmt), sub = /^I420|^NV12/.test(fmt) ? 2 : /^I422/.test(fmt) ? 1 : 0, nv = fmt === 'NV12';
  if (!/^(I420|I420P10|I420P12|I420A|I422|I422P10|I444|I444P10|NV12)$/.test(fmt)) throw new Error('Format ' + fmt);
  const r = s.visibleRect || { x: 0, y: 0, width: s.codedWidth, height: s.codedHeight }, w = r.width, h = r.height;
  const buf = new Uint8Array(s.allocationSize()); const lay = await s.copyTo(buf);
  const B = deep ? new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength >> 1) : buf, k = deep ? 2 : 1, sh = deep ? (/P12/.test(fmt) ? 2 : 0) : 0;
  const cs = s.colorSpace || {}, m = cs.matrix || (w * h > 1280 * 720 ? 'bt709' : 'smpte170m'), full = !!cs.fullRange, tr = cs.transfer || 'bt709';
  const L = luts(tr === 'pq' ? 'pq' : tr === 'hlg' || tr === 'arib-std-b67' ? 'hlg' : 'sdr');
  const [kr, kb] = m === 'bt2020-ncl' ? [.2627, .0593] : m === 'smpte170m' || m === 'bt470bg' ? [.299, .114] : [.2126, .0722];
  const kg = 1 - kr - kb, crR = 2 * (1 - kr), cbB = 2 * (1 - kb), cbG = -2 * kb * (1 - kb) / kg, crG = -2 * kr * (1 - kr) / kg;
  const g2020 = m === 'bt2020-ncl' || cs.primaries === 'bt2020';
  const yS = full ? 1 / 1023 : 1 / 876, yO = full ? 0 : 64, cS = full ? 1 / 1023 : 1 / 896;
  const out = new Uint8ClampedArray(w * h * 4), lin = L.lin, enc = L.enc;
  const yo = lay[0].offset / k, ys = lay[0].stride / k, uo = lay[1].offset / k, us = lay[1].stride / k, vo = nv ? 0 : lay[2].offset / k, vs = nv ? 0 : lay[2].stride / k;
  const to10 = deep ? (v => v >> sh) : (v => v << 2);
  const cx = sub ? 1 : 0, cy = sub === 2 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    const yr = yo + y * ys, cyy = y >> cy;
    for (let x = 0; x < w; x++) {
      const cxx = x >> cx;
      let Y = to10(B[yr + x]), U, V;
      if (nv) { const q = uo + cyy * us + cxx * 2; U = to10(B[q]); V = to10(B[q + 1]); } else { U = to10(B[uo + cyy * us + cxx]); V = to10(B[vo + cyy * vs + cxx]); }
      const yy = (Y - yO) * yS, u = (U - 512) * cS, v = (V - 512) * cS;
      let R = yy + crR * v, G = yy + cbG * u + crG * v, Bc = yy + cbB * u;
      R = lin[R <= 0 ? 0 : R >= 1 ? 1023 : (R * 1023) | 0]; G = lin[G <= 0 ? 0 : G >= 1 ? 1023 : (G * 1023) | 0]; Bc = lin[Bc <= 0 ? 0 : Bc >= 1 ? 1023 : (Bc * 1023) | 0];
      if (g2020) { const r2 = 1.6605 * R - .5876 * G - .0728 * Bc, g2 = -.1246 * R + 1.1329 * G - .0083 * Bc, b2 = -.0182 * R - .1006 * G + 1.1187 * Bc; R = r2; G = g2; Bc = b2; }
      const o = (y * w + x) * 4;
      out[o] = enc[R <= 0 ? 0 : R >= 4 ? 4095 : (R * 1023) | 0]; out[o + 1] = enc[G <= 0 ? 0 : G >= 4 ? 4095 : (G * 1023) | 0]; out[o + 2] = enc[Bc <= 0 ? 0 : Bc >= 4 ? 4095 : (Bc * 1023) | 0]; out[o + 3] = 255;
    }
  }
  return new M.VideoSample(out, { format: 'RGBA', codedWidth: w, codedHeight: h, timestamp: s.timestamp, duration: s.duration, rotation: s.rotation });
}
/* test: Name eines Testschalters (FCS_STUDIO_TEST.flat / .flatExport), der für diesen Weg eine leere lila Fläche simuliert */
export async function drawTo(ctx, s, crop, mode, test) {
  const fit = crop ? { fit: 'fill', crop } : { fit: 'cover' };
  if (test && flagged(test, mode)) { ctx.fillStyle = FLAT; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
  if (mode === 'copy' || mode === 'raw') { const r = await (mode === 'raw' ? rawRGBA(s) : toRGBA(s)); try { r.drawWithFit(ctx, fit); } finally { r.close(); } return; }
  s.drawWithFit(ctx, fit);
}
export function lumaOf(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, n = d.length / 4;
  let mx = 0, mn = 255, sum = 0, sq = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
    if (l > mx) mx = l; if (l < mn) mn = l; sum += l; sq += l * l; r += d[i]; g += d[i + 1]; b += d[i + 2];
  }
  const mean = sum / n;
  return { max: mx, min: mn, mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), range: mx - mn, rgb: [r / n, g / n, b / n].map(Math.round) };
}
/* Echtes Bild: nicht schwarz und nicht einfarbig. Eine gleichmäßige Fläche (lila, grün, grau) ist kein Videobild. */
export const real = l => !!(l && l.max >= 6 && (l.std >= .8 || l.range >= 6));
const withTimeout = (p, ms) => Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);
/* Selbsttest eines Weges: gezeichnet wird auf dieselbe Canvas-Art wie beim Export (groß, Grafikchip oder Arbeitsspeicher),
   danach auf 24 × 24 verkleinert und ausgewertet. */
export async function lumaAt(file, times, mode) {
  const v = await inp(file).getPrimaryVideoTrack(); const sink = sinkFor(v, mode);
  let dw = 1280, dh = 720; try { dw = await v.getDisplayWidth(); dh = await v.getDisplayHeight(); } catch (e) {}
  const k = Math.min(1, 1280 / Math.max(dw, dh)), [big, bx] = canvas(Math.max(2, Math.round(dw * k)), Math.max(2, Math.round(dh * k)), mode);
  const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
  const out = [];
  for (const t of times) {
    let s = null; try { s = await withTimeout(sink.getSample(t), 8000); } catch (e) {}
    if (!s) { out.push(null); continue; }
    try {
      bx.fillStyle = '#000'; bx.fillRect(0, 0, big.width, big.height); await drawTo(bx, s, null, mode, 'flat');
      x.fillStyle = '#000'; x.fillRect(0, 0, 24, 24); x.drawImage(big, 0, 0, 24, 24); out.push(lumaOf(x, 24, 24));
    } catch (e) { out.push(null); }
    finally { s.close(); }
  }
  big.width = big.height = 1;
  if (flagged('black', mode)) return out.map(l => l && { max: 0, min: 0, mean: 0, std: 0, range: 0 });
  return out;
}

/* ---------- Vorschaubilder für die Zeitleiste ---------- */
export async function thumbs(file, times, w, h, mode, onThumb) {
  const v = await inp(file).getPrimaryVideoTrack(); const sink = sinkFor(v, mode);
  let k = 0;
  for await (const s of sink.samplesAtTimestamps(times)) {
    const i = k++;
    if (!s) continue;
    try { const [c, x] = canvas(w, h, mode); await drawTo(x, s, null, mode); onThumb(i, c); }
    catch (e) {} finally { s.close(); }
  }
}

/* ---------- Ton ---------- */
const audioCache = new Map();
export async function hasAudio(file) { try { return !!(await inp(file).getPrimaryAudioTrack()); } catch (e) { return false; } }
/* Ton eines Zeitbereichs als AudioBuffer. Weg 1: WebCodecs-AudioDecoder. Weg 2: Tonspur ohne Neukodieren
   in eine kleine Datei umpacken und vom Browser dekodieren lassen (zum Beispiel ältere Safari-Versionen). */
export async function clipAudio(file, a, b) {
  const i = inp(file); let t = null;
  try { t = await i.getPrimaryAudioTrack(); } catch (e) {}
  if (!t) return null;
  let can = false; try { can = await t.canDecode(); } catch (e) {}
  if (can) {
    try {
      const sink = new M.AudioBufferSink(t); const parts = []; let ch = 1, rate = 48000;
      for await (const w of sink.buffers(a, b)) { parts.push(w); ch = Math.max(ch, w.buffer.numberOfChannels); rate = w.buffer.sampleRate; }
      if (parts.length) {
        const len = Math.max(1, Math.ceil((b - a) * rate)), nc = Math.min(2, ch);
        const out = new AudioBuffer({ length: len, numberOfChannels: nc, sampleRate: rate });
        for (const w of parts) {
          const off = Math.round((w.timestamp - a) * rate);
          for (let c = 0; c < nc; c++) {
            const src = w.buffer.getChannelData(Math.min(c, w.buffer.numberOfChannels - 1)), dst = out.getChannelData(c);
            let s0 = 0, d0 = off; if (d0 < 0) { s0 = -d0; d0 = 0; }
            const n = Math.min(src.length - s0, len - d0); if (n > 0) dst.set(src.subarray(s0, s0 + n), d0);
          }
        }
        return out;
      }
    } catch (e) { console.info('Clip-Studio: AudioDecoder ging nicht, nehme den Browser-Weg.', e && e.message); }
  }
  let full = audioCache.get(file);
  if (full === undefined) {
    full = null;
    try {
      const out = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
      const conv = await M.Conversion.init({ input: i, output: out, video: { discard: true }, showWarnings: false });
      if (conv.isValid) { await conv.execute(); const ac = new OfflineAudioContext(2, 1, 48000); full = await ac.decodeAudioData(out.target.buffer); }
    } catch (e) { console.info('Clip-Studio: Originalton nicht lesbar.', e && e.message); full = null; }
    audioCache.set(file, full);
  }
  if (!full) return null;
  const rate = full.sampleRate, s0 = Math.max(0, Math.round(a * rate)), len = Math.max(1, Math.round((b - a) * rate));
  const out = new AudioBuffer({ length: len, numberOfChannels: full.numberOfChannels, sampleRate: rate });
  for (let c = 0; c < full.numberOfChannels; c++) out.getChannelData(c).set(full.getChannelData(c).subarray(s0, Math.min(full.length, s0 + len)));
  return out;
}
/* Mischen: Originalton je Szene + Musik mit Ein- und Ausblenden. plan: {total, segs:[{buf, at, len, vol}], music:{buf, start, vol, fin, fout}} */
export async function mixAudio(plan) {
  const sr = 48000, total = Math.max(.1, plan.total);
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
  let any = false;
  for (const s of plan.segs || []) {
    if (!s.buf || !(s.vol > 0)) continue;
    const src = ctx.createBufferSource(); src.buffer = s.buf;
    const g = ctx.createGain(), e = Math.min(.015, s.len / 4);
    g.gain.setValueAtTime(0, s.at); g.gain.linearRampToValueAtTime(s.vol, s.at + e);
    g.gain.setValueAtTime(s.vol, Math.max(s.at + e, s.at + s.len - e)); g.gain.linearRampToValueAtTime(0, s.at + s.len);
    src.connect(g).connect(ctx.destination); src.start(s.at, 0, s.len); any = true;
  }
  const m = plan.music;
  if (m && m.buf && m.vol > 0) {
    const src = ctx.createBufferSource(); src.buffer = m.buf; src.loop = m.buf.duration < m.start + total; if (src.loop) { src.loopStart = 0; src.loopEnd = m.buf.duration; }
    const g = ctx.createGain(), fin = Math.min(m.fin || 0, total / 2), fout = Math.min(m.fout || 0, total / 2);
    g.gain.setValueAtTime(fin > 0 ? 0 : m.vol, 0); if (fin > 0) g.gain.linearRampToValueAtTime(m.vol, fin);
    g.gain.setValueAtTime(m.vol, Math.max(fin, total - fout)); if (fout > 0) g.gain.linearRampToValueAtTime(0, total);
    src.connect(g).connect(ctx.destination); src.start(0, Math.max(0, m.start || 0)); any = true;
  }
  if (!any) return null;
  return await ctx.startRendering();
}

/* ---------- Kodierer wählen ----------
   H.264 zuerst (spielt in jeder Galerie, auf jedem Samsung und in WhatsApp), lieber etwas kleiner als in einem exotischen Format.
   sizes: Liste von [W, H, bitrate], größte zuerst */
export async function encodable(W, H, fps, bitrate) {
  const list = TEST().vcodecs || ['avc', 'hevc', 'vp9', 'av1'];
  for (const c of list) {
    try { if (await M.canEncodeVideo(c, { width: W, height: H, bitrate, frameRate: fps })) return c; } catch (e) {}
  }
  return null;
}
export async function pickEncoder(sizes, fps) {
  const list = TEST().vcodecs || ['avc', 'hevc', 'vp9', 'av1'];
  const first = list.includes('avc') ? ['avc'] : [], rest = list.filter(c => c !== 'avc');
  for (const group of [first, rest]) {
    for (const [W, H, bitrate] of sizes) {
      for (const c of group) {
        try { if (await M.canEncodeVideo(c, { width: W, height: H, bitrate, frameRate: fps })) return { vc: c, W, H, bitrate }; } catch (e) {}
      }
    }
  }
  return null;
}
export async function audioCodec() {
  for (const c of (TEST().acodecs || ['aac', 'opus'])) { try { if (await M.canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 })) return c; } catch (e) {} }
  return null;
}

/* ---------- Ziel: Stücke als Blob sammeln (große Videos landen nicht komplett im Arbeitsspeicher) ---------- */
function blobTarget() {
  const parts = []; let end = 0, pend = [], pendLen = 0; const patches = [];
  const flush = () => { if (!pend.length) return; parts.push({ pos: end - pendLen, d: parts.length ? new Blob(pend) : concat(pend), len: pendLen }); pend = []; pendLen = 0; };
  const concat = arr => { const n = arr.reduce((a, b) => a + b.length, 0), u = new Uint8Array(n); let o = 0; for (const a of arr) { u.set(a, o); o += a.length; } return u; };
  const ws = new WritableStream({
    write(ch) {
      const d = ch.data, p = ch.position;
      if (p === end) { pend.push(d.slice()); pendLen += d.length; end += d.length; if (pendLen > 24 * 1048576 || (!parts.length && pendLen > 4 * 1048576)) flush(); return; }
      if (p + d.length <= end) { patches.push({ pos: p, d: d.slice() }); return; }
      if (p < end) { const k = end - p; patches.push({ pos: p, d: d.slice(0, k) }); pend.push(d.slice(k)); pendLen += d.length - k; end += d.length - k; return; }
      // Lücke (sollte nicht vorkommen): mit Nullen füllen
      const gap = new Uint8Array(p - end); pend.push(gap, d.slice()); pendLen += gap.length + d.length; end = p + d.length;
    }
  });
  return {
    t: new M.StreamTarget(ws, { chunked: true, chunkSize: 8 * 1048576 }),
    async blob(type) {
      flush();
      for (const pt of patches) {
        for (const part of parts) {
          const a = Math.max(pt.pos, part.pos), b = Math.min(pt.pos + pt.d.length, part.pos + part.len);
          if (a >= b) continue;
          if (part.d instanceof Blob) part.d = new Uint8Array(await part.d.arrayBuffer());
          part.d.set(pt.d.subarray(a - pt.pos, b - pt.pos), a - part.pos);
        }
      }
      return new Blob(parts.map(p => p.d), { type });
    }
  };
}

/* ---------- Export ----------
   job: { W, H, fps, frames, vc, ac, fmt ('mp4'|'mov'), bitrate,
          segs: [{ file, mode, f0, f1, times: Float64Array (Quellzeit je Ausgabebild, inklusive Nachlauf für den Übergang), crop }],
          cuts: [{ f, d, type }] (Übergang beim Bild f zur Szene i, d Bilder lang),
          look: {id, k}, fadeFrames, gl (Compositor auf einem Canvas W×H) | null, cssLook(id,k) für den 2D-Ersatz,
          overlay(ctx, t), audio: AudioBuffer | null, signal: AbortSignal }
   hooks: { progress(p), frameCheck(f, ctx, seg, {src, gl, fade}) }
   Das MP4 ist nicht fragmentiert, das Inhaltsverzeichnis (moov) steht vorne (Fast Start): Galerie-Apps zeigen sofort Länge und Bild. */
const MEM_LIMIT = 260 * 1048576;
export async function render(job, hooks = {}) {
  const { W, H, fps, frames, segs } = job;
  const [outC, out] = canvas(W, H, 'draw');
  const scr = { gpu: [], cpu: [] };
  const scratch = i => { const kind = cpuWay(segs[i].mode) ? 'cpu' : 'gpu', k = i % 2; return scr[kind][k] || (scr[kind][k] = canvas(W, H, kind === 'cpu' ? 'cpu' : 'draw')); };
  const dur = frames / fps;
  const est = (job.bitrate * dur + (job.audio ? 192000 * dur : 0)) / 8;
  const inMem = est < MEM_LIMIT;
  const target = inMem ? null : blobTarget();
  const buf = inMem ? new M.BufferTarget() : null;
  const Fmt = job.fmt === 'mov' ? M.MovOutputFormat : M.Mp4OutputFormat;
  const output = new M.Output({ format: new Fmt({ fastStart: inMem ? 'in-memory' : 'reserve' }), target: inMem ? buf : target.t });
  const vsrc = new M.CanvasSource(outC, { codec: job.vc, quality: new M.Quality({ bitrate: job.bitrate, bitrateMode: 'variable' }), keyFrameInterval: 2, latencyMode: 'quality' });
  output.addVideoTrack(vsrc, inMem ? { frameRate: fps } : { frameRate: fps, maximumPacketCount: frames + 16 });
  let asrc = null;
  if (job.audio && job.ac) {
    asrc = new M.AudioBufferSource(job.ac.startsWith('pcm') ? { codec: job.ac } : { codec: job.ac, quality: new M.Quality({ bitrate: 192000 }) });
    output.addAudioTrack(asrc, inMem ? {} : { maximumPacketCount: Math.ceil(job.audio.duration * job.audio.sampleRate / 256) + 64 });
  }
  const tracks = new Map();
  const track = async f => { if (!tracks.has(f)) tracks.set(f, await inp(f).getPrimaryVideoTrack()); return tracks.get(f); };
  const iters = [];
  const abort = () => { if (job.signal && job.signal.aborted) throw new DOMException('abgebrochen', 'AbortError'); };
  await output.start();
  // Ton in 2-Sekunden-Stücken, passend zum Bild, damit der Muxer nichts lange puffern muss
  let aPos = 0; const aBuf = job.audio, aSR = aBuf ? aBuf.sampleRate : 48000;
  const pushAudio = async upTo => {
    if (!asrc || !aBuf) return;
    while (aPos < aBuf.length && aPos / aSR < upTo) {
      const n = Math.min(aBuf.length - aPos, aSR * 2), chunk = new AudioBuffer({ length: n, numberOfChannels: aBuf.numberOfChannels, sampleRate: aSR });
      for (let c = 0; c < aBuf.numberOfChannels; c++) chunk.getChannelData(c).set(aBuf.getChannelData(c).subarray(aPos, aPos + n));
      await asrc.add(chunk); aPos += n;
    }
  };
  const pull = async i => {
    const s = segs[i];
    if (iters[i] === 'done') return;
    if (!iters[i]) { const sink = sinkFor(await track(s.file), s.mode); iters[i] = { it: sink.samplesAtTimestamps(s.times)[Symbol.asyncIterator](), n: 0 }; }
    const I = iters[i], r = await I.it.next(); I.n++;
    if (!r.done && r.value) {
      const x = scratch(i)[1];
      try { await drawTo(x, r.value, s.crop, s.mode, 'flatExport'); } finally { r.value.close(); }
    }
    if (r.done || I.n >= s.times.length) { try { await I.it.return(); } catch (e) {} iters[i] = 'done'; }
  };
  const look = job.look && job.look.id !== 'natur' && job.look.k > 0 ? job.look : null;
  let seg = 0;
  try {
    for (let f = 0; f < frames; f++) {
      abort();
      while (seg < segs.length - 1 && f >= segs[seg + 1].f0) seg++;
      const cut = seg > 0 ? job.cuts[seg] : null;
      const inTr = cut && cut.d > 0 && f < cut.f + cut.d;
      await pull(seg);
      if (inTr) await pull(seg - 1);
      const t = f / fps;
      const fade = job.fadeFrames > 0 ? Math.max(0, (f - (frames - job.fadeFrames)) / job.fadeFrames) : 0;
      const A = inTr ? scratch(seg - 1)[0] : scratch(seg)[0], B = inTr ? scratch(seg)[0] : null;
      const tr = inTr ? { type: cut.type, p: (f - cut.f + .5) / cut.d, seed: f % 97 } : null;
      const useGL = !!((inTr || look || fade > 0) && job.gl && job.gl.ok && !job.gl.lost);
      if (useGL) {
        job.gl.render({ A, B, tr, look, fade });
        out.drawImage(job.gl.canvas, 0, 0, W, H);
        if (flagged('flatExport', 'gl')) { out.fillStyle = FLAT; out.fillRect(0, 0, W, H); }
      } else {
        // 2D-Ersatz ohne WebGL: Blende als Überblendung, Blitz als weiße Fläche, Look per Canvas-Filter
        const base = look && job.cssLook ? job.cssLook(look.id, look.k) : 'none';
        if ('filter' in out) out.filter = base;
        out.globalAlpha = 1;
        if (inTr && B && job.tr2d) job.tr2d(out, A, null, B, null, tr, W, H, base);
        else {
          out.drawImage(A, 0, 0, W, H);
          if (inTr && B) {
            const p = Math.max(0, Math.min(1, tr.p));
            if (cut.type === 'blitz') { out.drawImage(B, 0, 0, W, H); out.filter = 'none'; out.fillStyle = '#fff'; out.globalAlpha = Math.pow(1 - p, 2.2) * .95; out.fillRect(0, 0, W, H); }
            else { out.globalAlpha = p * p * (3 - 2 * p); out.drawImage(B, 0, 0, W, H); }
            out.globalAlpha = 1;
          }
        }
        if ('filter' in out) out.filter = 'none';
        if (fade > 0) { out.fillStyle = '#000'; out.globalAlpha = fade; out.fillRect(0, 0, W, H); out.globalAlpha = 1; }
      }
      if (hooks.frameCheck) hooks.frameCheck(f, out, seg, { src: scratch(seg)[0], gl: useGL, fade, last: f === frames - 1 });
      if (job.overlay) { out.save(); job.overlay(out, t); out.restore(); }
      await vsrc.add(t, 1 / fps);
      await pushAudio(t + 2);
      if (hooks.progress && (f % 3 === 0 || f === frames - 1)) hooks.progress((f + 1) / frames);
    }
    await pushAudio(Infinity);
    abort();
    await output.finalize();
  } catch (e) {
    for (const I of iters) if (I && I !== 'done') { try { await I.it.return(); } catch (er) {} }
    try { await output.cancel(); } catch (er) {}
    throw e;
  } finally {
    for (const k of ['gpu', 'cpu']) for (const c of scr[k]) if (c) c[0].width = c[0].height = 1;
  }
  const mime = job.fmt === 'mov' ? 'video/quicktime' : 'video/mp4';
  const blob = inMem ? new Blob([buf.buffer], { type: mime }) : await target.blob(mime);
  return { blob, mime, ext: job.fmt === 'mov' ? 'mov' : 'mp4', fastStart: inMem ? 'in-memory' : 'reserve' };
}

/* ---------- Fertige Datei nachprüfen: Länge und Bildanzahl stimmen? (wird vor dem Speichern aufgerufen) ---------- */
export async function verify(blob, expect) {
  const i = new M.Input({ source: new M.BlobSource(blob), formats: M.ALL_FORMATS });
  try {
    const v = await i.getPrimaryVideoTrack(); if (!v) return { ok: false, why: 'keine Videospur' };
    const dur = await v.computeDuration(), st = await v.computePacketStats();
    const tol = Math.max(.15, 3 / expect.fps);
    const ok = Math.abs(dur - expect.dur) <= tol && st.packetCount >= Math.floor(expect.frames * .98) && st.packetCount <= expect.frames + 2;
    return { ok, dur, frames: st.packetCount, why: ok ? '' : `Länge ${dur.toFixed(2)} s statt ${expect.dur.toFixed(2)} s, ${st.packetCount} statt ${expect.frames} Bilder` };
  } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
  finally { try { i.dispose(); } catch (e) {} }
}
