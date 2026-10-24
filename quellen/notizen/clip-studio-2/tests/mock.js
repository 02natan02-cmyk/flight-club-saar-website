// Nachgebauter Server: Make-Webhook (Mitgliedscode, Upload start/done, Status) + Graph-Upload-Sitzung
const crypto = require('crypto');
const MEMBERS = { 'FCS-AB2C-DE3F': { n: 'Booyaka FPV', bis: 2026 }, 'FCS-ALT2-ALT3': { n: 'Alter Pilot', bis: 2025 } };
function mock(opts = {}) {
  const st = { jobs: {}, sessions: {}, log: [], fail500First: !!opts.fail500First, statusSeq: opts.statusSeq || ['wartet', 'läuft', 'fertig'], calls: { start: 0, done: 0, status: 0, check: 0, put: 0, get: 0, del: 0 } };
  const hook = async route => {
    const req = route.request(); const u = new URL(req.url());
    let p = Object.fromEntries(u.searchParams);
    if (req.method() === 'POST') p = Object.assign(p, Object.fromEntries(new URLSearchParams(req.postData() || '')));
    st.log.push({ m: req.method(), a: p.a, p });
    const json = o => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    const accepted = () => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'Accepted' });
    if (p.a === 'check') { st.calls.check++; const c = String(p.c || '').toUpperCase().replace(/\s/g, ''); if (c.length < 8) return accepted(); const m = MEMBERS[c]; return json(m ? { ok: true, n: m.n, bis: m.bis } : { ok: false }); }
    if (p.a === 'start') {
      st.calls.start++;
      const k = crypto.createHash('sha1').update(`clip|${p.n}|${p.sz}|fcs-clip-2026`).digest('hex').slice(0, 10);
      if (k !== p.k) { st.log.push({ bad: 'k', want: k, got: p.k }); return accepted(); }
      if (p.zweck === 'gyroflow' && !MEMBERS[p.c]) return accepted();
      const id = crypto.randomBytes(8).toString('hex');
      st.jobs[id] = { id, p, st: 'eingegangen', n: 0 };
      st.sessions[id] = { size: +p.sz, got: 0, buf: [], first: true };
      return json({ ok: true, id, url: `https://mock-up.sharepoint.com/upload/${id}?x=1` });
    }
    if (p.a === 'done') { st.calls.done++; const j = st.jobs[p.id]; if (!j || !p.item) return json({ ok: false, err: 'unbekannt' }); j.done = true; j.item = p.item; return json({ ok: true }); }
    if (p.a === 'status') { st.calls.status++; const j = st.jobs[p.id]; if (!j) return json({ ok: false }); const s = st.statusSeq[Math.min(j.n++, st.statusSeq.length - 1)]; return json({ ok: true, st: s, url: s === 'fertig' ? 'https://example.com/stabilisiert_' + j.id + '.mp4' : '', msg: '' }); }
    return accepted();
  };
  const up = async route => {
    const req = route.request(); const u = new URL(req.url()); const id = u.pathname.split('/').pop(); const s = st.sessions[id];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'PUT, GET, DELETE', 'access-control-allow-headers': 'content-range, content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (!s || s.expired) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"code":"itemNotFound"}}' });
    if (req.method() === 'GET') { st.calls.get++; return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ nextExpectedRanges: [s.got + '-'] }) }); }
    if (req.method() === 'DELETE') { st.calls.del++; delete st.sessions[id]; return route.fulfill({ status: 204, headers: cors }); }
    if (req.method() === 'PUT') {
      st.calls.put++;
      if (req.headers()['authorization']) return route.fulfill({ status: 401, headers: cors, body: 'auth header verboten' });
      if (s.first && st.fail500First) { s.first = false; return route.fulfill({ status: 500, body: 'boom' }); } // ohne CORS, wie im echten Test
      s.first = false;
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(req.headers()['content-range'] || '');
      const body = req.postDataBuffer() || Buffer.alloc(0);
      if (!m) return route.fulfill({ status: 400, headers: cors, body: 'no range' });
      const a = +m[1], b = +m[2], tot = +m[3];
      if (a !== s.got || b - a + 1 !== body.length || tot !== s.size) return route.fulfill({ status: 416, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { code: 'invalidRange' }, nextExpectedRanges: [s.got + '-'] }) });
      if ((b - a + 1) % 327680 !== 0 && b + 1 !== tot) return route.fulfill({ status: 400, headers: cors, body: 'chunk size not multiple of 320 KiB' });
      s.buf.push(body); s.got = b + 1;
      if (opts.slow) await new Promise(r => setTimeout(r, opts.slow));
      if (s.got >= s.size) { const item = { id: 'ITEM' + id.slice(0, 6), name: st.jobs[id].p.fn, size: s.size }; s.item = item; return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify(item) }); }
      return route.fulfill({ status: 202, headers: cors, contentType: 'application/json', body: JSON.stringify({ nextExpectedRanges: [s.got + '-'] }) });
    }
    return route.fulfill({ status: 405, headers: cors });
  };
  return { st, async attach(ctxOrPage) { await ctxOrPage.route('https://hook.eu1.make.com/**', hook); await ctxOrPage.route('https://mock-up.sharepoint.com/**', up); } };
}
module.exports = { mock, MEMBERS };
