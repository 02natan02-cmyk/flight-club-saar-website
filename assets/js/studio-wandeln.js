/* Flight Club Saar · Clip-Studio: Umwandeln (wird von studio.js nur bei Bedarf geladen)
   Natan 29.10. 23:33: „Ist mir scheißegal, wie, was für Videos ich hochlade, vom Handy, von GoPro und eine von der Drohne.
   Das muss immer geschnitten werden, immer runterladbar sein und ohne Fehler.“
   Manche Handys (zum Beispiel Samsung Internet mit HDR10+ oder 10 Bit HEVC) zeigen solche Clips zwar an, geben die Bilder aber
   nicht zum Rechnen frei. Dann rechnet FFmpeg (WebAssembly) direkt im Browser eine Arbeitskopie: H.264, 8 Bit, SDR, lange Seite
   höchstens 1920 px, Ton AAC. Das Original bleibt unverändert und geht weiter in voller Qualität an den Verein.
   - Kern zuerst von jsDelivr, sonst unpkg, sonst aus assets/lib/ffmpeg/core (Einkern-Fassung liegt im Repo). */
const V_CORE = '0.12.10';
const SRC = mt => [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core${mt ? '-mt' : ''}@${V_CORE}/dist/umd/`,
  `https://unpkg.com/@ffmpeg/core${mt ? '-mt' : ''}@${V_CORE}/dist/umd/`,
  ...(mt ? [] : [new URL('../lib/ffmpeg/core/', import.meta.url).href])
];
// Mehrkern-Fassung (core-mt) ist vorbereitet, aber aus: im Test brach sie mit „function signature mismatch“ ab (30.10.)
export const mt = () => false;

async function blobURL(url, type, onBytes) {
  const r = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!r.ok) throw new Error('http ' + r.status);
  let b;
  const len = +r.headers.get('content-length') || 0;
  if (onBytes && r.body && r.body.getReader) {
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onBytes(got, len); }
    b = new Blob(parts);
  } else b = await r.blob();
  if (b.size < 1000) throw new Error('leer');
  return URL.createObjectURL(new Blob([b], { type }));
}
function script(src) {
  return new Promise((ok, bad) => { if (window.FFmpegWASM) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('ffmpeg.js')); document.head.appendChild(s); });
}

let ffP = null, busy = Promise.resolve();
async function engine(onStatus) {
  if (ffP) return ffP;
  ffP = (async () => {
    await script(new URL('../lib/ffmpeg/ffmpeg.js', import.meta.url).href);
    const tries = mt() ? [true, false] : [false];
    let lastErr = null;
    for (const multi of tries) {
      for (const base of SRC(multi)) {
        try {
          onStatus && onStatus('laden', 0);
          const coreURL = await blobURL(base + 'ffmpeg-core.js', 'text/javascript');
          const wasmURL = await blobURL(base + 'ffmpeg-core.wasm', 'application/wasm', (g, t) => onStatus && onStatus('laden', t ? g / t : 0));
          const o = { coreURL, wasmURL };
          if (multi) o.workerURL = await blobURL(base + 'ffmpeg-core.worker.js', 'text/javascript');
          const ff = new window.FFmpegWASM.FFmpeg();
          await Promise.race([ff.load(o), new Promise((_, no) => setTimeout(() => no(new Error('laden dauert zu lange')), 60000))]);
          ff._multi = multi;
          return ff;
        } catch (e) { lastErr = e; console.info('Clip-Studio: Umwandler-Kern nicht geladen von', base, e && e.message); }
      }
    }
    throw lastErr || new Error('kern');
  })();
  ffP.catch(() => { ffP = null; });
  return ffP;
}

/* HDR → SDR ohne zscale (im Browser zu langsam): in RGB (10 Bit) umrechnen, Helligkeitskurve als Tabelle (lutrgb),
   Farbraum BT.2020 → BT.709 über eine Farbmatrix (etwas kräftiger, weil im Gamma-Raum gerechnet), zurück nach YUV 4:2:0.
   PQ (HDR10/HDR10+, Samsung): PQ-EOTF → Nits, Referenzweiß 170 Nits = 1.0, sanfte Schulter (Reinhard erweitert), Gamma 2.4.
   HLG (iPhone, DJI, GoPro): ist für normale Bildschirme gedacht, hier nur Farbraum umrechnen. */
const PQ_RGB = (() => {
  const m1 = 2610 / 16384, m2 = 2523 / 4096 * 128, c1 = 3424 / 4096, c2 = 2413 / 4096 * 32, c3 = 2392 / 4096 * 32;
  const P = `pow(clip(val/maxval,0,1),${(1 / m2).toFixed(6)})`;
  const L = `10000*pow(max(${P}-${c1.toFixed(6)},0)/(${c2.toFixed(6)}-${c3.toFixed(6)}*${P}),${(1 / m1).toFixed(6)})`;
  const x = `((${L})/170)`, tm = `(${x}*(1+${x}/16)/(1+${x}))`;
  return `maxval*pow(clip(${tm},0,1),1/2.4)`;
})();
const MIX = 'colorchannelmixer=rr=1.9577:rg=-0.8520:rb=-0.1056:gr=-0.1807:gg=1.1927:gb=-0.0120:br=-0.0264:bg=-0.1459:bb=1.1721';

/* Braucht dieser Clip die Arbeitskopie? */
export function needs(info) {
  if (!info || !info.ok) return false;
  return !!(info.hdr || info.bits > 8 || ['pq', 'hlg'].includes(info.transfer) || info.primaries === 'bt2020');
}

let nr = 0;
/* file → File (MP4, H.264 SDR). onProgress(anteil 0..1, phase 'laden'|'rechnen'). signal: AbortSignal */
export function wandeln(file, info, { onProgress, signal, dur } = {}) {
  const job = busy.then(() => run(file, info, { onProgress, signal, dur }));
  busy = job.catch(() => {});
  return job;
}
async function run(file, info, { onProgress, signal, dur }) {
  if (signal && signal.aborted) throw new Error('abgebrochen');
  const ff = await engine((ph, p) => onProgress && onProgress(p, ph));
  const id = ++nr, dir = '/in' + id, out = `/out${id}.mp4`, safe = 'clip' + id + (String(file.name || '').match(/\.[a-z0-9]{2,5}$/i) || ['.mp4'])[0];
  const total = dur || (info && info.dur) || 0;
  const tr = info && info.transfer, wide = tr === 'pq' || tr === 'hlg' || (info && info.primaries === 'bt2020');
  const fit = "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))':flags=bilinear";
  const vf = tr === 'pq' ? [fit + ':in_color_matrix=bt2020:in_range=tv:out_range=pc', 'format=gbrp10le', `lutrgb=r='${PQ_RGB}':g='${PQ_RGB}':b='${PQ_RGB}'`, MIX, 'scale=out_color_matrix=bt709:in_range=pc:out_range=tv', 'format=yuv420p']
    : wide ? [fit + ':in_color_matrix=bt2020:in_range=tv:out_range=pc', 'format=gbrp10le', MIX, 'scale=out_color_matrix=bt709:in_range=pc:out_range=tv', 'format=yuv420p']
    : [fit, 'format=yuv420p'];
  const logs = [];
  const onLog = e => { logs.push(e.message); if (logs.length > 60) logs.shift(); const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(e.message); if (m && total && onProgress) onProgress(Math.min(.99, ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) / total), 'rechnen'); };
  const stop = () => { try { ff.terminate(); } catch (e) {} ffP = null; };
  ff.on('log', onLog);
  if (signal) signal.addEventListener('abort', stop, { once: true });
  let mounted = false;
  try {
    await ff.createDir(dir);
    // WORKERFS: die Datei wird nicht kopiert, auch große 4K-Clips passen so in den Speicher
    const f2 = file.name === safe ? file : new File([file], safe, { type: file.type || 'video/mp4' });
    await ff.mount('WORKERFS', { files: [f2] }, dir); mounted = true;
    onProgress && onProgress(0, 'rechnen');
    const args = ton => ['-hide_banner', '-i', `${dir}/${safe}`, '-map', '0:v:0', ...(ton ? ['-map', '0:a:0?'] : ['-an']), '-sn', '-dn', '-vf', vf.join(','), '-fpsmax', '60',
      '-c:v', 'libx264', '-preset', ff._multi ? 'veryfast' : 'superfast', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...(ton ? ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'] : []), '-movflags', '+faststart', '-y', out];
    // Nur für automatische Tests (Testbrowser ohne H.264): fertige Arbeitskopie von außen
    const T = window.FCS_STUDIO_TEST || {};
    if (T.wandelnFake) { const r = await fetch(T.wandelnFake); const b = new Uint8Array(await r.arrayBuffer()); onProgress && onProgress(1, 'rechnen'); return new File([b], String(file.name).replace(/\.[^.]+$/, '') + '_studio.webm', { type: 'video/webm' }); }
    let rc = await ff.exec(args(true));
    // Ton macht Ärger (zum Beispiel PCM oder seltene Formate): ohne Ton nochmal, das Studio kann Musik drunterlegen
    if (rc !== 0 && !(signal && signal.aborted)) rc = await ff.exec(args(false));
    if (rc !== 0) throw new Error('ffmpeg ' + rc + ': ' + logs.slice(-4).join(' | '));
    const data = await ff.readFile(out);
    try { await ff.deleteFile(out); } catch (e) {}
    if (!data || data.length < 2000) throw new Error('leer');
    onProgress && onProgress(1, 'rechnen');
    const base = String(file.name || 'clip').replace(/\.[^.]+$/, '');
    return new File([data.buffer], base + '_studio.mp4', { type: 'video/mp4', lastModified: Date.now() });
  } finally {
    ff.off && ff.off('log', onLog);
    if (signal) signal.removeEventListener('abort', stop);
    if (mounted) { try { await ff.unmount(dir); } catch (e) {} }
    try { await ff.deleteDir(dir); } catch (e) {}
  }
}
