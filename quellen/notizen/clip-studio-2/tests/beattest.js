const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('**/__t/**', r => { const f = path.join(__dirname, 'tv', decodeURIComponent(r.request().url().split('/__t/')[1])); r.fulfill({ body: fs.readFileSync(f), contentType: 'application/octet-stream' }); });
  await p.goto('http://localhost:8800/robots.txt');
  for (const [f, bpm, lead] of [['musik_128bpm.mp3', 128, .37], ['musik_100bpm.wav', 100, .37], ['musik_128bpm.m4a', 128, .37]]) {
    const r = await p.evaluate(async ([f, bpm, lead]) => {
      try {
        const ab = await (await fetch('/__t/' + f)).arrayBuffer();
        const ac = new AudioContext(); const buf = await ac.decodeAudioData(ab);
        const n = buf.length, m = new Float32Array(n); for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) m[i] += d[i] / buf.numberOfChannels; }
        const w = new Worker('/assets/js/studio-beat.js'); const t0 = performance.now();
        const res = await new Promise(r => { w.onmessage = e => r(e.data); w.postMessage({ id: 1, pcm: m, sr: buf.sampleRate }, [m.buffer]); });
        const ms = performance.now() - t0; w.terminate();
        const p = 60 / bpm; let err = 0, cnt = 0, maxe = 0;
        for (const t of res.beats) { const k = Math.round((t - lead) / p); const e = Math.abs(t - (lead + k * p)); err += e; cnt++; maxe = Math.max(maxe, e); }
        return { bpm: res.bpm, n: res.beats.length, first: Array.from(res.beats.slice(0, 5)).map(x => x.toFixed(3)).join(' '), down: res.down, str: Array.from(res.str.slice(0,8)).map(x=>x.toFixed(2)).join(' '), meanErrMs: (err / cnt * 1000).toFixed(1), maxErrMs: (maxe * 1000).toFixed(1), ms: ms.toFixed(0) };
      } catch (e) { return { err: e.message }; }
    }, [f, bpm, lead]);
    console.log(f, JSON.stringify(r));
  }
  await b.close();
})();
