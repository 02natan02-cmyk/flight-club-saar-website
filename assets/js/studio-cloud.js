/* Flight Club Saar · Clip-Studio: Verbindung zum Verein (Make-Webhooks + OneDrive-Upload-Sitzung)
   Vertrag (STUDIO2.md, 24.10.2026):
   - Mitgliedscode:  GET  api.mitglied?a=check&c=<code>          → {ok:true,n,bis} | {ok:false} | Text „Accepted“ (= ungültig)
   - Upload starten: POST api.clips a=start, n, fn, sz, typ, zweck, t, opt, c, k   → {ok:true,id,url} | {ok:false,err}
   - Hochladen:      PUT  url  (Content-Range: bytes a-b/total, Stücke als Vielfaches von 327 680 Bytes, KEIN Authorization-Header)
                     202 → weiter (nextExpectedRanges), 200/201 → Datei-Objekt {id,name,size}; GET url → nextExpectedRanges; 404 = abgelaufen
   - Abschließen:    POST api.clips a=done, id, item → {ok:true}
   - Status:         GET  api.clips?a=status&id=<job> → {ok, st:'upload'|'eingegangen'|'wartet'|'läuft'|'fertig'|'fehler', url, msg, name, size}
   - zweck: 'einsenden' (Mail an den Verein) · 'gyroflow' (Mitglieder, Station stabilisiert) · 'teil' (Clip, Sticker-Bild oder Musik
     für einen Render-Auftrag) · 'render' (rezept.json, startet die Render-Station; Format in quellen/render/REZEPT.md)
   - Ein Stück, das mit Netzfehler oder 5xx scheitert, wird bis zu 5-mal wiederholt (1, 2, 4, 8, 16 s Pause),
     vorher fragt ein GET auf die Upload-URL ab, wo es weitergeht (nextExpectedRanges). 416 = Bereich passt nicht → ebenso.
   Make-Kosten: start und done einmal pro Datei, Status höchstens einmal pro Minute und nur bei offener Seite. */

export const CHUNK = 30 * 327680; // 9 830 400 Bytes
const STORE = 'fcs-uploads';

export async function sha10(s) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 10);
}
const timeout = ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
async function readJSON(res) { const t = await res.text(); try { return JSON.parse(t); } catch (e) { return null; } }
/* Antwort ohne JSON (Make sagt dann nur „Accepted“) heißt: abgelehnt → {ok:false, err:'abgelehnt'}; Netzfehler → null */
export async function post(url, fields) {
  const body = new URLSearchParams(); Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, String(v)); });
  let res;
  try { res = await fetch(url, { method: 'POST', body, credentials: 'omit', signal: timeout(30000) }); } catch (e) { return null; }
  const j = await readJSON(res);
  if (!j) return res.ok ? { ok: false, err: 'abgelehnt' } : null;
  return j;
}

/* ---------- Mitgliedscode ---------- */
export const normCode = s => {
  const r = String(s || '').toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, '');
  const core = r.startsWith('FCS') ? r.slice(3) : r;
  return r.startsWith('FCS') && core.length === 8 ? `FCS-${core.slice(0, 4)}-${core.slice(4)}` : r;
};
// FCS-XXXX-XXXX oder ein Wort mit Zahl (gleiche Regel wie fcs.js)
export const codeOk = c => /^FCS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c) || /^[A-ZÄÖÜ0-9]{8,24}$/.test(c);
export async function checkMember(url, code) {
  try {
    const u = new URL(url); u.searchParams.set('a', 'check'); u.searchParams.set('c', code);
    const res = await fetch(u, { credentials: 'omit', signal: timeout(20000) });
    const j = await readJSON(res);
    if (j && j.ok && j.n) return { ok: true, n: String(j.n).slice(0, 40), bis: +j.bis || null };
    return { ok: false };
  } catch (e) { return { ok: false, net: true }; }
}

/* ---------- Gyroflow-Status ---------- */
export async function gyroStatus(url, id) {
  try {
    const u = new URL(url); u.searchParams.set('a', 'status'); u.searchParams.set('id', id);
    const res = await fetch(u, { credentials: 'omit', signal: timeout(20000) });
    const j = await readJSON(res);
    if (!j || !j.ok) return { ok: false, net: !j };
    return { ok: true, st: j.st, url: j.url && /^https:\/\//.test(j.url) ? j.url : '', msg: j.msg ? String(j.msg).slice(0, 300) : '', size: +j.size || 0, name: j.name ? String(j.name).slice(0, 160) : '' };
  } catch (e) { return { ok: false, net: true }; }
}

/* ---------- Gemerkte Upload-Sitzungen (zum Fortsetzen nach Abbruch oder neuem Laden der Seite) ---------- */
export const fileKey = (f, zweck) => [f.name, f.size, f.lastModified || 0, zweck].join('|');
export function sessions() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } }
function saveSess(k, v) { try { const s = sessions(); if (v) s[k] = v; else delete s[k]; localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }

/* ---------- Upload ----------
   const up = new Upload(api, file, {n, zweck, t, opt, c}); up.on = (ev, data) => …; up.start();
   Ereignisse: 'phase' ('start'|'up'|'pause'|'done'|'fehler'), 'progress' {sent, total, bps}, 'error' {msg, fatal} */
export class Upload {
  constructor(api, file, meta) {
    this.api = api; this.file = file; this.meta = meta; this.key = fileKey(file, meta.zweck);
    this.on = () => {}; this.state = 'neu'; this.sent = 0; this.xhr = null; this.job = null; this.url = null; this._paused = false;
    this._spd = []; this._wakeLock = null;
  }
  emit(ev, d) { try { this.on(ev, d); } catch (e) {} }
  phase(p) { this.state = p; this.emit('phase', p); }
  async lock(on) {
    try {
      if (on && 'wakeLock' in navigator && !this._wakeLock) { this._wakeLock = await navigator.wakeLock.request('screen'); }
      if (!on && this._wakeLock) { await this._wakeLock.release(); this._wakeLock = null; }
    } catch (e) {}
  }
  async start() {
    this._paused = false; this.phase('start'); this.lock(true);
    const old = sessions()[this.key];
    try {
      if (old && old.url && old.id && old.done !== true) {
        const next = await this.status(old.url);
        if (next != null) { this.job = old.id; this.url = old.url; this.sent = next; return this.loop(); }
      }
      const m = this.meta, n = String(m.n || '').slice(0, 40);
      const k = await sha10(`clip|${n}|${this.file.size}|fcs-clip-2026`);
      const r = await post(this.api, { a: 'start', n, fn: this.file.name.slice(0, 120), sz: this.file.size, typ: this.file.type || 'video/mp4', zweck: m.zweck, t: (m.t || '').slice(0, 500), opt: m.opt ? JSON.stringify(m.opt) : '', c: m.c || '', k, zu: m.zu || '' });
      if (!r || !r.ok || !r.id || !/^https:\/\//.test(r.url || '')) { this.fail(r && r.err ? errText(r.err, m.zweck) : 'Der Verein ist gerade nicht erreichbar. Versuch es gleich nochmal.', !r); return; }
      this.job = r.id; this.url = r.url; this.sent = 0;
      saveSess(this.key, { id: r.id, url: r.url, fn: this.file.name, sz: this.file.size, zweck: m.zweck, n, d: Date.now() });
      return this.loop();
    } catch (e) { this.fail('Der Verein ist gerade nicht erreichbar. Versuch es gleich nochmal.', true); }
  }
  /* Wie viel ist schon da? → Byte-Position oder null (Sitzung abgelaufen) */
  async status(url) {
    try {
      const res = await fetch(url, { credentials: 'omit', signal: timeout(20000) });
      if (res.status === 404) { saveSess(this.key, null); return null; }
      const j = await readJSON(res); if (!j) return null;
      const r = (j.nextExpectedRanges || [])[0]; if (r == null) return null;
      return parseInt(String(r).split('-')[0], 10) || 0;
    } catch (e) { return null; }
  }
  async loop() {
    this.phase('up'); let tries = 0;
    const total = this.file.size;
    while (!this._paused && this.sent < total) {
      const a = this.sent, b = Math.min(total, a + CHUNK) - 1;
      const r = await this.put(a, b, total);
      if (this._paused) break;
      if (r.ok) {
        tries = 0;
        if (r.status === 200 || r.status === 201) { this.sent = total; this.emit('progress', { sent: total, total, bps: this.bps() }); return this.finish(r.json); }
        const nx = r.json && (r.json.nextExpectedRanges || [])[0];
        this.sent = nx != null ? parseInt(String(nx).split('-')[0], 10) : b + 1;
        this._spd.push([performance.now(), this.sent]); if (this._spd.length > 40) this._spd.shift();
        this.emit('progress', { sent: this.sent, total, bps: this.bps() });
        continue;
      }
      if (r.status === 404) { saveSess(this.key, null); this.fail('Die Upload-Sitzung ist abgelaufen. Tipp auf „Nochmal“, dann startet der Upload neu.', false, true); return; }
      if (r.status === 416) { const nx = await this.status(this.url); if (nx != null) { this.sent = nx; continue; } }
      tries++;
      if (tries > 5) { this.pause(true); this.emit('error', { msg: 'Die Verbindung ist weg. Sobald du wieder Netz hast, geht es mit „Fortsetzen“ an derselben Stelle weiter.' }); return; }
      this.emit('retry', { n: tries });
      await new Promise(res => setTimeout(res, [1000, 2000, 4000, 8000, 16000][tries - 1]));
      if (this._paused) break;
      const nx = await this.status(this.url); if (nx != null) this.sent = nx;
    }
  }
  put(a, b, total) {
    return new Promise(res => {
      const x = this.xhr = new XMLHttpRequest();
      x.open('PUT', this.url, true);
      x.setRequestHeader('Content-Range', `bytes ${a}-${b}/${total}`);
      const t0 = performance.now();
      x.upload.onprogress = e => { const s = a + e.loaded; this._spd.push([performance.now(), s]); if (this._spd.length > 40) this._spd.shift(); this.emit('progress', { sent: s, total, bps: this.bps() }); };
      x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch (e) {} res({ ok: x.status >= 200 && x.status < 300, status: x.status, json: j, ms: performance.now() - t0 }); };
      x.onerror = () => res({ ok: false, status: 0 });
      x.ontimeout = () => res({ ok: false, status: 0 });
      x.onabort = () => res({ ok: false, status: -1 });
      x.timeout = 10 * 60 * 1000;
      x.send(this.file.slice(a, b + 1));
    });
  }
  bps() { const s = this._spd; if (s.length < 2) return 0; const [t0, b0] = s[0], [t1, b1] = s[s.length - 1]; return t1 > t0 ? (b1 - b0) / ((t1 - t0) / 1000) : 0; }
  async finish(item) {
    const id = item && item.id;
    try {
      const r = await post(this.api, { a: 'done', id: this.job, item: id || '' });
      if (!r || !r.ok) { this.fail('Die Datei ist hochgeladen, aber die Bestätigung kam nicht an. Tipp auf „Nochmal“, wir melden sie erneut.', true, false, true); return; }
    } catch (e) { this.fail('Die Datei ist hochgeladen, aber die Bestätigung kam nicht an. Tipp auf „Nochmal“, wir melden sie erneut.', true, false, true); this._item = id; return; }
    saveSess(this.key, null); this.lock(false); this.done = { job: this.job, item: id, name: item && item.name };
    this.phase('done');
  }
  async retryDone() { return this.finish({ id: this._item }); }
  pause(silent) { this._paused = true; try { if (this.xhr) this.xhr.abort(); } catch (e) {} this.lock(false); this.phase('pause'); }
  resume() { if (this.state === 'up') return; this._paused = false; this.lock(true); if (this.url) this.loop(); else this.start(); }
  /* Verwerfen: Sitzung bei OneDrive löschen und vergessen */
  async discard() { this.pause(true); const u = this.url; saveSess(this.key, null); if (u) { try { await fetch(u, { method: 'DELETE', credentials: 'omit' }); } catch (e) {} } this.phase('neu'); }
  fail(msg, net, restart, doneRetry) { this.lock(false); this._needDone = !!doneRetry; this.phase('fehler'); this.emit('error', { msg, net, restart }); }
}
function errText(e, zweck) {
  if (e === 'abgelehnt' && zweck === 'gyroflow') return 'Der Verein hat den Auftrag nicht angenommen. Meistens gilt der Mitgliedscode auf diesem Gerät nicht mehr: Melde dich unten bei „Premium“ ab und gib deinen Code neu ein.';
  const m = { code: 'Der Mitgliedscode stimmt nicht.', mitglied: 'Gyroflow ist nur für Mitglieder.', gross: 'Die Datei ist zu groß.', typ: 'Diese Datei kann der Verein nicht annehmen.', abgelehnt: 'Der Verein hat die Datei nicht angenommen. Versuch es nochmal, sonst schreib kurz dem Vorstand.' };
  return m[e] || 'Das hat nicht geklappt (' + String(e).slice(0, 60) + '). Versuch es gleich nochmal.';
}
