/* Flight Club Saar · Clip-Studio: Medien-Motor (wird von studio.js erst bei Bedarf geladen)
   - probe(): Format-Steckbrief jeder Datei (Codec, Bit-Tiefe, HDR, Drehung, Bildrate, Ton), auch wenn der Browser sie nicht abspielen kann
   - lumaAt(): Selbsttest gegen schwarze Bilder über zwei Dekodier-Wege ('draw' und 'copy')
   - clipAudio()/mixAudio(): Originalton und Musik werden mit der Web-Audio-API sauber gemischt
   - render(): Export in Originalqualität (bis 4K) über WebCodecs, Ausgabe direkt in Blob-Stücke statt in den Arbeitsspeicher */
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

/* ---------- Bild zeichnen: 'draw' = direkt, 'copy' = über RGBA-Kopie (hilft, wenn der Grafikchip schwarze Bilder liefert) ---------- */
async function toRGBA(s) {
  const opt = { format: 'RGBA', colorSpace: 'srgb' };
  const buf = new Uint8Array(s.allocationSize(opt));
  await s.copyTo(buf, opt);
  const r = s.visibleRect || { width: s.codedWidth, height: s.codedHeight };
  return new M.VideoSample(buf, { format: 'RGBA', codedWidth: r.width, codedHeight: r.height, timestamp: s.timestamp, duration: s.duration, rotation: s.rotation });
}
export async function drawTo(ctx, s, crop, mode) {
  if (mode === 'copy') { const r = await toRGBA(s); try { r.drawWithFit(ctx, crop ? { fit: 'fill', crop } : { fit: 'cover' }); } finally { r.close(); } return; }
  s.drawWithFit(ctx, crop ? { fit: 'fill', crop } : { fit: 'cover' });
}
export function lumaOf(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data; let mx = 0, sum = 0;
  for (let i = 0; i < d.length; i += 4) { const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; if (l > mx) mx = l; sum += l; }
  return { max: mx, mean: sum / (d.length / 4) };
}
export async function lumaAt(file, times, mode) {
  const v = await inp(file).getPrimaryVideoTrack(); const sink = new M.VideoSampleSink(v);
  const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
  const out = [];
  for (const t of times) {
    let s = null; try { s = await sink.getSample(t); } catch (e) {}
    if (!s) { out.push(null); continue; }
    try { x.fillStyle = '#000'; x.fillRect(0, 0, 24, 24); await drawTo(x, s, null, mode); out.push(lumaOf(x, 24, 24)); }
    catch (e) { out.push(null); }
    finally { s.close(); }
  }
  if ((TEST().black || []).includes(mode)) return out.map(l => l && { max: 0, mean: 0 });
  return out;
}

/* ---------- Vorschaubilder für die Zeitleiste ---------- */
export async function thumbs(file, times, w, h, mode, onThumb) {
  const v = await inp(file).getPrimaryVideoTrack(); const sink = new M.VideoSampleSink(v);
  let k = 0;
  for await (const s of sink.samplesAtTimestamps(times)) {
    const i = k++;
    if (!s) continue;
    try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); await drawTo(x, s, null, mode); onThumb(i, c); }
    catch (e) {} finally { s.close(); }
  }
}

/* ---------- Ton ---------- */
const audioCache = new Map();
export async function hasAudio(file) { try { return !!(await inp(file).getPrimaryAudioTrack()); } catch (e) { return false; } }
/* Ton eines Zeitbereichs als AudioBuffer. Weg 1: WebCodecs-AudioDecoder. Weg 2: Tonspur ohne Neukodieren
   in eine kleine Datei umpacken und vom Browser dekodieren lassen (z. B. ältere Safari-Versionen). */
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

/* ---------- Kodierer wählen ---------- */
export async function encodable(W, H, fps, bitrate) {
  const list = TEST().vcodecs || ['avc', 'hevc', 'vp9', 'av1'];
  for (const c of list) {
    try { if (await M.canEncodeVideo(c, { width: W, height: H, bitrate, frameRate: fps })) return c; } catch (e) {}
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
          segs: [{ file, mode, f0, f1, times: Float64Array (Quellzeit je Ausgabebild, inkl. Nachlauf für den Übergang), crop }],
          cuts: [{ f, d, type }] (Übergang beim Bild f zur Szene i, d Bilder lang),
          look: {id, k}, fadeFrames, gl (Compositor auf einem Canvas W×H) | null, cssLook(id,k) für den 2D-Ersatz,
          overlay(ctx, t), audio: AudioBuffer | null, signal: AbortSignal }
   hooks: { progress(p), frameCheck(f, ctx) } */
export async function render(job, hooks = {}) {
  const { W, H, fps, frames, segs } = job;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d', { alpha: false })]; };
  const [outC, out] = mk(), scratch = [mk(), mk()];
  const target = blobTarget();
  const Fmt = job.fmt === 'mov' ? M.MovOutputFormat : M.Mp4OutputFormat;
  const output = new M.Output({ format: new Fmt({ fastStart: false }), target: target.t });
  const vsrc = new M.CanvasSource(outC, { codec: job.vc, quality: new M.Quality({ bitrate: job.bitrate, bitrateMode: 'variable' }), keyFrameInterval: 2, latencyMode: 'quality' });
  output.addVideoTrack(vsrc, { frameRate: fps });
  let asrc = null;
  if (job.audio && job.ac) {
    asrc = new M.AudioBufferSource(job.ac.startsWith('pcm') ? { codec: job.ac } : { codec: job.ac, quality: new M.Quality(192000) });
    output.addAudioTrack(asrc);
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
    if (!iters[i]) { const sink = new M.VideoSampleSink(await track(s.file)); iters[i] = { it: sink.samplesAtTimestamps(s.times)[Symbol.asyncIterator](), n: 0 }; }
    const I = iters[i], r = await I.it.next(); I.n++;
    if (!r.done && r.value) {
      const x = scratch[i % 2][1];
      try { await drawTo(x, r.value, s.crop, s.mode); } finally { r.value.close(); }
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
      const A = inTr ? scratch[(seg - 1) % 2][0] : scratch[seg % 2][0], B = inTr ? scratch[seg % 2][0] : null;
      const tr = inTr ? { type: cut.type, p: (f - cut.f + .5) / cut.d, seed: f % 97 } : null;
      if ((inTr || look || fade > 0) && job.gl && job.gl.ok && !job.gl.lost) {
        job.gl.render({ A, B, tr, look, fade });
        out.drawImage(job.gl.canvas, 0, 0, W, H);
      } else {
        // 2D-Ersatz ohne WebGL: Blende als Überblendung, Blitz als weiße Fläche, Look per Canvas-Filter
        if (look && 'filter' in out && job.cssLook) out.filter = job.cssLook(look.id, look.k);
        out.globalAlpha = 1; out.drawImage(A, 0, 0, W, H);
        if (inTr && B) {
          const p = Math.max(0, Math.min(1, tr.p));
          if (cut.type === 'blitz') { out.drawImage(B, 0, 0, W, H); out.filter = 'none'; out.fillStyle = '#fff'; out.globalAlpha = Math.pow(1 - p, 2.2) * .95; out.fillRect(0, 0, W, H); }
          else { out.globalAlpha = p * p * (3 - 2 * p); out.drawImage(B, 0, 0, W, H); }
          out.globalAlpha = 1;
        }
        if ('filter' in out) out.filter = 'none';
        if (fade > 0) { out.fillStyle = '#000'; out.globalAlpha = fade; out.fillRect(0, 0, W, H); out.globalAlpha = 1; }
      }
      if (hooks.frameCheck) hooks.frameCheck(f, out, seg);
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
  }
  const mime = job.fmt === 'mov' ? 'video/quicktime' : 'video/mp4';
  return { blob: await target.blob(mime), mime, ext: job.fmt === 'mov' ? 'mov' : 'mp4' };
}
