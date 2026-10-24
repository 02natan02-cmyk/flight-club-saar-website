/* Flight Club Saar · Clip-Studio: Takterkennung (läuft als Web Worker, blockiert die Seite nicht)
   Eingang: { id, pcm: Float32Array (mono), sr }
   Ausgang: { id, bpm, beats: Float32Array (Sekunden), down: Index des ersten Taktanfangs, peaks: Float32Array (min/max-Paare), dur }
   Verfahren: Spektraler Fluss (Onset-Hüllkurve) → Tempo per Autokorrelation mit Gewichtung um 120 BPM
   → Beat-Tracking per dynamischer Programmierung (Ellis 2007) → Taktanfang über die Bassenergie. */
'use strict';

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function analyse(pcm, sr) {
  const dur = pcm.length / sr;
  // Wellenform für die Anzeige (1200 Spalten, min/max)
  const COLS = 1200, peaks = new Float32Array(COLS * 2), per = Math.max(1, Math.floor(pcm.length / COLS));
  for (let c = 0; c < COLS; c++) {
    let mn = 0, mx = 0; const s = c * per, e = Math.min(pcm.length, s + per);
    for (let i = s; i < e; i += 4) { const v = pcm[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    peaks[c * 2] = mn; peaks[c * 2 + 1] = mx;
  }
  // Auf ca. 11 kHz herunterrechnen (Mittelwert als einfacher Tiefpass)
  const k = Math.max(1, Math.round(sr / 11025)), fs = sr / k, n = Math.floor(pcm.length / k);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < k; j++) s += pcm[i * k + j]; x[i] = s / k; }
  const N = 512, H = 128, hop = H / fs, frames = Math.max(0, Math.floor((n - N) / H));
  if (frames < 64) return { bpm: 0, beats: new Float32Array(0), str: new Float32Array(0), down: 0, peaks, dur };
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N);
  const re = new Float32Array(N), im = new Float32Array(N), half = N / 2;
  let prev = new Float32Array(half), cur = new Float32Array(half);
  const flux = new Float32Array(frames), low = new Float32Array(frames);
  const lowBin = Math.max(2, Math.round(160 / (fs / N)));
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let s = 0, l = 0;
    for (let b = 1; b < half; b++) {
      const m = Math.log(1 + 100 * Math.hypot(re[b], im[b]));
      cur[b] = m; const d = m - prev[b];
      if (d > 0) { s += d; if (b <= lowBin) l += d; }
    }
    flux[f] = s; low[f] = l;
    const t = prev; prev = cur; cur = t;
  }
  // Hüllkurven: gleitenden Mittelwert abziehen, gleichrichten, normieren.
  // Der Bass (Tiefpass bis ca. 160 Hz: Kick und Bass) zählt dreimal so stark, damit die Schnitte auf den Bässen sitzen.
  const W = Math.max(3, Math.round(.4 / hop));
  const norm = src => {
    const out = new Float32Array(frames); let acc = 0; const q = [];
    for (let f = 0; f < frames; f++) { acc += src[f]; q.push(src[f]); if (q.length > W) acc -= q.shift(); out[f] = Math.max(0, src[f] - acc / q.length); }
    let mean = 0; for (let f = 0; f < frames; f++) mean += out[f]; mean /= frames;
    let sd = 0; for (let f = 0; f < frames; f++) sd += (out[f] - mean) ** 2; sd = Math.sqrt(sd / frames) || 1;
    for (let f = 0; f < frames; f++) out[f] /= sd;
    return out;
  };
  const eFull = norm(flux), eLow = norm(low), env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) env[f] = (eFull[f] + 3 * eLow[f]) / 4;

  // Tempo: Autokorrelation, gewichtet um 120 BPM (log-normal, eine Oktave Breite)
  const minLag = Math.floor(60 / 200 / hop), maxLag = Math.ceil(60 / 60 / hop), t0 = 60 / 120 / hop;
  const ac = new Float32Array(maxLag + 2);
  for (let L = minLag - 1; L <= maxLag + 1; L++) {
    let s = 0; for (let f = L; f < frames; f++) s += env[f] * env[f - L];
    ac[L] = s / (frames - L);
  }
  let best = minLag, bv = -1;
  for (let L = minLag; L <= maxLag; L++) {
    const w = Math.exp(-.5 * Math.pow(Math.log2(L / t0) / 1, 2));
    const v = ac[L] * w;
    if (v > bv) { bv = v; best = L; }
  }
  // Feinwert per Parabel
  const a1 = ac[best - 1], a2 = ac[best], a3 = ac[best + 1];
  const den = a1 - 2 * a2 + a3; const P = best + (den ? .5 * (a1 - a3) / den : 0);

  // Beat-Tracking per dynamischer Programmierung
  const alpha = 100, score = new Float32Array(frames), back = new Int32Array(frames).fill(-1);
  const lo = Math.round(P / 2), hi = Math.round(P * 2);
  for (let f = 0; f < frames; f++) {
    let bs = 0, bi = -1;
    for (let p = f - hi; p <= f - lo; p++) {
      if (p < 0) continue;
      const v = score[p] - alpha * Math.pow(Math.log((f - p) / P), 2);
      if (bi < 0 || v > bs) { bs = v; bi = p; }
    }
    score[f] = env[f] + (bi >= 0 ? Math.max(0, bs) : 0); back[f] = bs > 0 ? bi : -1;
  }
  let end = frames - 1, ev = -Infinity;
  for (let f = Math.max(0, frames - Math.round(P)); f < frames; f++) if (score[f] > ev) { ev = score[f]; end = f; }
  const idx = []; for (let f = end; f >= 0; f = back[f]) { idx.push(f); if (back[f] < 0) break; }
  idx.reverse();
  // Zeitpunkt eines Frames (der Anschlag fällt im Mittel ins dritte Viertel des Analysefensters)
  const tOf = f => (f * H + N * .75) / fs;
  const beats = new Float32Array(idx.map(tOf));
  // Tempo per Ausgleichsgerade durch alle Beats (genauer als einzelne Abstände)
  let period = P * hop;
  if (beats.length > 3) {
    const m = beats.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < m; i++) { sx += i; sy += beats[i]; sxx += i * i; sxy += i * beats[i]; }
    const sl = (m * sxy - sx * sy) / (m * sxx - sx * sx);
    if (sl > .25 && sl < 1.2) period = sl;
  }
  const bpm = Math.round(600 / period) / 10;
  // Bass-Stärke je Beat (0..1): darauf sitzen später die Schnitte
  const raw = idx.map(f => Math.max(eLow[f], f > 0 ? eLow[f - 1] : 0, f + 1 < frames ? eLow[f + 1] : 0));
  const srt = raw.slice().sort((a, b) => a - b), ref = srt[Math.floor(srt.length * .95)] || 1;
  const str = new Float32Array(raw.map(v => Math.min(1, v / ref)));
  // Taktanfang (4/4): die Phase mit der meisten Bassenergie
  let down = 0, dv = -1;
  for (let ph = 0; ph < 4; ph++) {
    let s = 0; for (let i = ph; i < raw.length; i += 4) s += raw[i];
    if (s > dv) { dv = s; down = ph; }
  }
  return { bpm, beats, str, down, peaks, dur };
}

self.onmessage = e => {
  const { id, pcm, sr } = e.data || {};
  try {
    const r = analyse(pcm, sr);
    self.postMessage({ id, ok: true, ...r }, [r.beats.buffer, r.str.buffer, r.peaks.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, err: String(err && err.message || err) });
  }
};
