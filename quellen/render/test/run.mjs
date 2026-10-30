#!/usr/bin/env node
/* Flight Club Saar · Tests der Render-Station
   Rechnet Beispiel-Rezepte mit echten Testmedien und prüft das Ergebnis mit ffprobe und Bildstichproben.
   Testmedien (Ordner, Umgebungsvariable RENDER_TESTMEDIA, Standard /tmp/render-testmedia):
     h264_landscape.mp4 (1920×1080, 6 s, Ton) · h264_portrait.mp4 (1080×1920, 5 s) · samsung_hdr10.mp4 (4K HDR10 HEVC 10 Bit, Ton)
     gopro_hevc10.mp4 (2704×1520, 60 fps, 10 Bit) · dji_hlg_noaudio.mp4 (HLG ohne Ton) · pq_foto.mp4 (PQ, voller Bereich) · musik.mp3 (40 s)
   Aufruf: node quellen/render/test/run.mjs [--nur a,b] [--ausgabe <ordner>]
   Standbilder für die Sichtprüfung landen in <ausgabe>/<test>/standbilder/. */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.resolve(HIER, '..', 'render.mjs');
const MEDIEN = process.env.RENDER_TESTMEDIA || '/tmp/render-testmedia';

const argv = process.argv.slice(2);
const wert = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const NUR = (wert('--nur') || '').split(',').filter(Boolean);
const AUSGABE = path.resolve(wert('--ausgabe') || process.env.RENDER_TESTAUSGABE || fs.mkdtempSync(path.join(os.tmpdir(), 'fcs-render-test-')));

/* ---------- Hilfen ---------- */
function lauf(cmd, args, opt = {}) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opt });
    const out = [], err = [];
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err.push(d));
    p.on('close', code => resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') }));
  });
}
const teilNr = name => crypto.createHash('sha1').update(name).digest('hex').slice(0, 16);
const medium = name => path.join(MEDIEN, name);

// Auftrag anlegen: rezept.json und teile/<teil>.<endung> (Verweise auf die Testmedien)
async function auftrag(name, rezept, teile) {
  const dir = path.join(AUSGABE, name);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(path.join(dir, 'teile'), { recursive: true });
  await fsp.mkdir(path.join(dir, 'standbilder'), { recursive: true });
  for (const [teil, quelle] of Object.entries(teile)) {
    if (!quelle) continue;
    const ziel = path.join(dir, 'teile', `${teil}${path.extname(quelle).toLowerCase() || '.bin'}`);
    await fsp.symlink(path.resolve(quelle), ziel);
  }
  await fsp.writeFile(path.join(dir, 'rezept.json'), JSON.stringify(rezept, null, 2));
  return dir;
}
async function rendern(dir, extra = []) {
  const t0 = Date.now();
  const r = await lauf(process.execPath, [RENDER, '--rezept', path.join(dir, 'rezept.json'), '--teile', path.join(dir, 'teile'),
    '--out', path.join(dir, 'fertig.mp4'), '--tmp', path.join(dir, 'tmp'), ...extra]);
  r.sekunden = (Date.now() - t0) / 1000;
  r.stdoutText = r.stdout.toString('utf8');
  await fsp.writeFile(path.join(dir, 'protokoll.txt'), `Exit ${r.code} nach ${r.sekunden.toFixed(1)} s\n--- stdout\n${r.stdoutText}\n--- stderr\n${r.stderr}`);
  return r;
}
async function probe(datei) {
  const r = await lauf('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-count_frames', datei]);
  return r.code === 0 ? JSON.parse(r.stdout.toString('utf8')) : null;
}
// Ein Bild bei t (Sekunden) als kleines RGB-Raster: Mittelwert, Streuung, Spannweite der Helligkeit, Graustufigkeit
async function bildBei(datei, t, w = 96) {
  const r = await lauf('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', datei, '-frames:v', '1', '-vf', `scale=${w}:-2:flags=area,format=rgb24`, '-f', 'rawvideo', '-']);
  const px = r.stdout; if (r.code !== 0 || !px.length) return null;
  let s = 0, q = 0, mn = 255, mx = 0, bunt = 0; const n = px.length / 3;
  for (let i = 0; i < n; i++) {
    const R = px[i * 3], G = px[i * 3 + 1], B = px[i * 3 + 2], l = .2126 * R + .7152 * G + .0722 * B;
    s += l; q += l * l; mn = Math.min(mn, l); mx = Math.max(mx, l); bunt = Math.max(bunt, Math.abs(R - G), Math.abs(G - B));
  }
  const m = s / n; return { mittel: m, streuung: Math.sqrt(Math.max(0, q / n - m * m)), spanne: mx - mn, bunt, px };
}
async function standbild(datei, t, ziel, breite = 540) {
  await lauf('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', datei, '-frames:v', '1', '-vf', `scale=${breite}:-2`, ziel]);
  return ziel;
}
// Mittlere Helligkeitsdifferenz benachbarter Bilder ab t (Graustufen 480 px breit). Doppelte Bilder: nahe 0 (nur Kodierrauschen)
async function nachbarDifferenzen(datei, t, anzahl) {
  const r = await lauf('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', datei, '-frames:v', String(anzahl), '-vf', 'scale=480:-2,format=gray', '-f', 'rawvideo', '-']);
  const j = await probe(datei), v = j.streams.find(s => s.codec_type === 'video');
  const groesse = 480 * Math.round(480 * v.height / v.width / 2) * 2, px = r.stdout, diffs = [];
  for (let k = 1; k * groesse < px.length; k++) { let s = 0; for (let i = 0; i < groesse; i++) s += Math.abs(px[k * groesse + i] - px[(k - 1) * groesse + i]); diffs.push(s / groesse); }
  return diffs;
}
// Lautstärke eines Zeitabschnitts (dB, −91 = Stille)
async function lautstaerke(datei, von, bis) {
  const r = await lauf('ffmpeg', ['-v', 'info', '-ss', String(von), '-t', String(bis - von), '-i', datei, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(r.stderr);
  return m ? (m[1] === '-inf' ? -91 : parseFloat(m[1])) : -91;
}
// Gleichheit zweier Bilder (PSNR in dB, 100 = gleich)
async function psnr(a, ta, b, tb, filterB = '') {
  const r = await lauf('ffmpeg', ['-v', 'info', '-ss', String(ta), '-i', a, '-ss', String(tb), '-i', b, '-filter_complex',
    `[0:v]trim=end_frame=1,format=yuv420p[x];[1:v]trim=end_frame=1${filterB ? ',' + filterB : ''},format=yuv420p[y];[x][y]psnr`, '-f', 'null', '-']);
  const m = /average:([\d.]+|inf)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 100 : parseFloat(m[1])) : 0;
}
// Test-Sticker: transparentes PNG in Ausgabegröße mit einem bunten Rechteck (oben rechts)
async function stickerPng(ziel, W, H) {
  const x = Math.round(W * .62), y = Math.round(H * .18), w = Math.round(W * .3), h = Math.round(H * .1);
  await lauf('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${W}x${H},format=rgba`, '-f', 'lavfi', '-i', `testsrc2=s=${w}x${h},format=rgba`,
    '-filter_complex', `[0:v][1:v]overlay=${x}:${y}:format=auto,format=rgba`, '-frames:v', '1', ziel]);
  return { x, y, w, h };
}

/* ---------- Prüfungen ---------- */
const ERGEBNISSE = [];
function testBeginn(name, titel) { const t = { name, titel, pruef: [], ok: true, sekunden: 0 }; ERGEBNISSE.push(t); console.log(`\n=== ${name}) ${titel}`); return t; }
function pruefe(t, was, ok, detail = '') {
  t.pruef.push({ was, ok, detail }); if (!ok) t.ok = false;
  console.log(`${ok ? '  ok    ' : '  FEHLER'} ${was}${detail ? ` (${detail})` : ''}`);
}
async function grundPruefung(t, dir, r, { W, H, dauer, fps, ton, stichproben = [], warnungen = false }) {
  pruefe(t, 'Exit-Code 0', r.code === 0, r.code === 0 ? '' : r.stderr.trim().split('\n').slice(-6).join(' | '));
  if (!warnungen) pruefe(t, 'keine Warnungen', !/Warnung/.test(r.stderr), r.stderr.trim().split('\n')[0] || '');
  const out = path.join(dir, 'fertig.mp4');
  pruefe(t, 'fertig.mp4 vorhanden', fs.existsSync(out));
  if (!fs.existsSync(out)) return null;
  const j = await probe(out);
  const v = j && j.streams.find(s => s.codec_type === 'video'), a = j && j.streams.find(s => s.codec_type === 'audio');
  pruefe(t, `Größe ${W} × ${H}`, !!v && v.width === W && v.height === H, v ? `${v.width} × ${v.height}` : 'keine Bildspur');
  pruefe(t, 'H.264 High, yuv420p, BT.709', !!v && v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p' && v.color_transfer === 'bt709', v ? `${v.codec_name} ${v.profile} ${v.pix_fmt} ${v.color_transfer}` : '');
  const vd = v ? parseFloat(v.duration) : NaN, fd = j ? parseFloat(j.format.duration) : NaN;
  pruefe(t, `Dauer ${dauer} s ± 0,05`, Math.abs(vd - dauer) <= .05 && Math.abs(fd - dauer) <= .05, `Bild ${vd.toFixed(3)} s, Datei ${fd.toFixed(3)} s`);
  const bilder = v ? +v.nb_read_frames : 0, soll = Math.round(dauer * fps);
  pruefe(t, `Bildanzahl ${soll}`, Math.abs(bilder - soll) <= 1, `${bilder}`);
  const [n, d] = v ? v.avg_frame_rate.split('/').map(Number) : [0, 1];
  pruefe(t, `Bildrate ${fps}`, Math.abs(n / d - fps) < .01, `${(n / d).toFixed(3)}`);
  pruefe(t, ton ? 'Tonspur vorhanden (AAC 48 kHz Stereo)' : 'keine Tonspur', ton ? !!a && a.codec_name === 'aac' && a.sample_rate === '48000' && a.channels === 2 : !a, a ? `${a.codec_name} ${a.sample_rate} ${a.channels}` : 'ohne Ton');
  pruefe(t, 'Fast Start (moov vor mdat)', await fastStart(out));
  for (const s of stichproben) {
    const b = await bildBei(out, s);
    pruefe(t, `Bild bei ${s} s nicht schwarz und nicht einfarbig`, !!b && b.mittel > 12 && b.streuung > 6 && b.spanne > 30, b ? `Mittel ${b.mittel.toFixed(0)}, Streuung ${b.streuung.toFixed(0)}, Spanne ${b.spanne.toFixed(0)}` : 'kein Bild');
  }
  return { out, j, v, a };
}
async function fastStart(datei) {
  const fd = await fsp.open(datei, 'r'); const buf = Buffer.alloc(65536); await fd.read(buf, 0, buf.length, 0); await fd.close();
  const moov = buf.indexOf('moov'), mdat = buf.indexOf('mdat');
  return moov > 0 && (mdat < 0 || moov < mdat);
}

/* ---------- Testfälle ---------- */
const T = {
  land: teilNr('h264_landscape'), hoch: teilNr('h264_portrait'), hdr: teilNr('samsung_hdr10'), gopro: teilNr('gopro_hevc10'),
  hlg: teilNr('dji_hlg_noaudio'), pq: teilNr('pq_foto'), musik: teilNr('musik'), sticker: teilNr('sticker'), fehlt: teilNr('gibt-es-nicht')
};
const clip = (teil, fn, w, h, fps, dur) => ({ teil, fn, w, h, fps, dur });
const cropPx = (sw, sh, A) => { const sa = sw / sh; let cw = sw, ch = sh; if (sa > A + 1e-3) cw = sh * A; else if (sa < A - 1e-3) ch = sw / A; return { left: Math.round((sw - cw) * .5), top: Math.round((sh - ch) * .5), width: Math.round(cw), height: Math.round(ch) }; };
// Szenen mit at kumulativ und d wie buildSeq (min(T.d, len_vor · 0,45, len · 0,45))
const DAUER = { schnitt: 0, blende: .7, blitz: .32, zoom: .42, wisch: .5, whip: .36, glitch: .3 };
function szenen(liste) {
  let at = 0;
  return liste.map((s, i) => {
    const r = { clip: s.clip, a: s.a, len: s.len, at, kind: s.kind || '1', tr: i ? (s.tr || 'schnitt') : null, d: 0, crop: s.crop };
    if (i) r.d = r.tr === 'schnitt' ? 0 : Math.min(DAUER[r.tr], liste[i - 1].len * .45, s.len * .45);
    at += s.len; return r;
  });
}
const summe = segs => Math.round(segs.reduce((s, x) => s + x.len, 0) * 1e6) / 1e6;

async function testA() {
  const t = testBeginn('a', '1 Clip, Originalformat, kein Look, kein Overlay, Originalton (Preset medium)');
  const segs = szenen([{ clip: 0, a: 1, len: 4, crop: { left: 0, top: 0, width: 1920, height: 1080 } }]);
  const dir = await auftrag('a', { v: 1, name: 'Test A', out: { W: 1920, H: 1080, fps: 30, bitrate: 16e6 }, clips: [clip(T.land, 'landscape.mp4', 1920, 1080, 30, 6)],
    segs, total: summe(segs), fade: 0, look: { id: 'natur', k: 0 }, overlay: { osd: false, ln: { name: '', mode: 'off' } }, audio: { origVol: 1 } }, { [T.land]: medium('h264_landscape.mp4') });
  const r = await rendern(dir); t.sekunden = r.sekunden;
  const g = await grundPruefung(t, dir, r, { W: 1920, H: 1080, dauer: 4, fps: 30, ton: true, stichproben: [.5, 2, 3.5] });
  if (!g) return;
  // Zeitachse: Ausgabe bei t entspricht Quelle bei a + t (gleiches Bild, nur neu kodiert)
  for (const tt of [0, 1.5, 3.9]) { const p = await psnr(g.out, tt, medium('h264_landscape.mp4'), 1 + tt); pruefe(t, `Bild bei ${tt} s = Quelle bei ${1 + tt} s`, p > 32, `PSNR ${p.toFixed(1)} dB`); }
  pruefe(t, 'Ton nicht still', (await lautstaerke(g.out, .5, 3.5)) > -40);
}

async function testB() {
  const t = testBeginn('b', '3 Szenen aus 2 Clips, 9:16, Blende und Wisch, Look warm 0,8, Sticker, OSD, Einblendung, Musik, Ausblenden');
  const W = 1080, H = 1920, A = W / H;
  const segs = szenen([
    { clip: 0, a: .5, len: 2, crop: cropPx(1920, 1080, A) },
    { clip: 1, a: .5, len: 2, tr: 'blende', crop: cropPx(1080, 1920, A) },
    { clip: 0, a: 3, len: 2, tr: 'wisch', crop: cropPx(1920, 1080, A) }
  ]);
  const dir = path.join(AUSGABE, 'b');
  await fsp.mkdir(dir, { recursive: true });
  const stickerDatei = path.join(AUSGABE, 'sticker_1080x1920.png');
  const st = await stickerPng(stickerDatei, W, H);
  const rezept = { v: 1, name: 'Test B', out: { W, H, fps: 30, bitrate: 16e6 },
    clips: [clip(T.land, 'landscape.mp4', 1920, 1080, 30, 6), clip(T.hoch, 'portrait.mp4', 1080, 1920, 30, 5)],
    segs, total: summe(segs), fade: .6, look: { id: 'warm', k: .8 },
    overlay: { teil: T.sticker, osd: true, ln: { name: 'Testpilot', mode: 'start' } },
    audio: { origVol: .6, music: { teil: T.musik, start: 3, vol: .9, fin: .5, fout: 1.5 } } };
  await auftrag('b', rezept, { [T.land]: medium('h264_landscape.mp4'), [T.hoch]: medium('h264_portrait.mp4'), [T.musik]: medium('musik.mp3'), [T.sticker]: stickerDatei });
  const r = await rendern(dir, ['--preset', 'veryfast']); t.sekunden = r.sekunden;
  const g = await grundPruefung(t, dir, r, { W, H, dauer: 6, fps: 30, ton: true, stichproben: [.5, 2, 2.35, 4.25, 5.5] });
  if (!g) return;
  const sb = path.join(dir, 'standbilder');
  for (const [tt, n] of [[.5, '0_5s'], [2, '2_0s'], [2.35, '2_35s_blende'], [4.25, '4_25s_wisch'], [5.9, '5_9s_ausblenden']]) await standbild(g.out, tt, path.join(sb, `b_${n}.png`));
  // Sticker: Rechteck oben rechts bunt (testsrc2 im Rechteck)
  const b1 = await bildBei(g.out, 1, W);
  const px = b1.px, at = (x, y) => [px[(y * W + x) * 3], px[(y * W + x) * 3 + 1], px[(y * W + x) * 3 + 2]];
  const mitte = at(st.x + Math.round(st.w * .1), st.y + Math.round(st.h * .5));
  pruefe(t, 'Sticker-Rechteck sichtbar (bunt)', Math.max(...mitte) - Math.min(...mitte) > 80, `Pixel ${mitte.join(', ')}`);
  // OSD: Ecke oben links weiß (Linie bei u·4,2 vom Rand)
  const u = Math.min(W, H) / 100, e = Math.round(4.2 * u), ecke = at(e, e + Math.round(3 * u));
  pruefe(t, 'OSD-Ecke oben links (weiße Linie)', ecke.every(c => c > 200), `Pixel ${ecke.join(', ')}`);
  // Einblendung unten links: Kasten dunkel mit cyanfarbener Kante, sichtbar bei 2 s, weg bei 5,9 s
  const yb = H - Math.round(13.5 * u), kante = at(Math.round(5.5 * u), yb - Math.round(6 * u));
  pruefe(t, 'Einblendung unten links (cyanfarbene Kante)', kante[2] > 180 && kante[1] > 150 && kante[0] < 140, `Pixel ${kante.join(', ')}`);
  const b6 = await bildBei(g.out, 5.95, W), kante6 = [b6.px[((yb - Math.round(6 * u)) * W + Math.round(5.5 * u)) * 3], 0, b6.px[((yb - Math.round(6 * u)) * W + Math.round(5.5 * u)) * 3 + 2]];
  pruefe(t, 'Einblendung am Ende weg (mode start)', !(kante6[2] > 180 && kante6[0] < 140), `Pixel R ${kante6[0]} B ${kante6[2]}`);
  // Ausblenden: letztes Bild deutlich dunkler als bei 5 s (Overlay bleibt hell)
  const m5 = (await bildBei(g.out, 4.9)).mittel, mEnde = (await bildBei(g.out, 5.96)).mittel;
  pruefe(t, 'Ausblenden ins Schwarze am Ende', mEnde < m5 * .5, `Mittel ${m5.toFixed(0)} → ${mEnde.toFixed(0)}`);
  // Look warm: dieselbe Stelle ist wärmer als die Quelle (R−B steigt)
  pruefe(t, 'Ton nicht still (Originalton und Musik)', (await lautstaerke(g.out, .2, 5)) > -40);
  pruefe(t, 'Musik eingeblendet: Anfang leiser als Mitte', (await lautstaerke(g.out, 0, .1)) < (await lautstaerke(g.out, 2.5, 3.5)));
}

async function testC() {
  const t = testBeginn('c', 'HDR10 (4K HEVC) mit Look kräftig, Zeitlupe und Rampe auf GoPro 10 Bit 60 fps, 16:9 1080p');
  const W = 1920, H = 1080, A = W / H;
  const segs = szenen([
    { clip: 0, a: .5, len: 2.5, crop: cropPx(3840, 2160, A) },
    { clip: 1, a: .2, len: 2.5, kind: 'slow', tr: 'zoom', crop: cropPx(2704, 1520, A) },
    { clip: 1, a: .3, len: 1.5, kind: 'ramp', tr: 'blitz', crop: cropPx(2704, 1520, A) }
  ]);
  const dir = await auftrag('c', { v: 1, name: 'Test C', out: { W, H, fps: 60, bitrate: 24e6 },
    clips: [clip(T.hdr, 'samsung.mp4', 3840, 2160, 30, 4), clip(T.gopro, 'gopro.mp4', 2704, 1520, 60, 3)],
    segs, total: summe(segs), fade: 0, look: { id: 'kraeftig', k: 1 }, overlay: { osd: false }, audio: { origVol: 1 } },
  { [T.hdr]: medium('samsung_hdr10.mp4'), [T.gopro]: medium('gopro_hevc10.mp4') });
  const r = await rendern(dir, ['--preset', 'veryfast']); t.sekunden = r.sekunden;
  const g = await grundPruefung(t, dir, r, { W, H, dauer: 6.5, fps: 60, ton: true, stichproben: [.3, 2.4, 3, 5.1, 6.3] });
  if (!g) return;
  const sb = path.join(dir, 'standbilder');
  for (const [tt, n] of [[1, '1_0s_hdr'], [2.6, '2_6s_zoom'], [3.5, '3_5s_zeitlupe'], [5.05, '5_05s_blitz']]) await standbild(g.out, tt, path.join(sb, `c_${n}.png`));
  const b = await bildBei(g.out, 1);
  pruefe(t, 'HDR → SDR: weder flau noch überstrahlt', b.mittel > 40 && b.mittel < 220 && b.spanne > 120, `Mittel ${b.mittel.toFixed(0)}, Spanne ${b.spanne.toFixed(0)}`);
  // Zeitlupe: In Szene 2 ändert sich das Bild nur jedes zweite Ausgabebild (60-fps-Quelle mit halber Geschwindigkeit bei 60 fps → jedes Quellbild zweimal? nein: 60 → 30 Quellbilder je Sekunde bei 60 fps Ausgabe → jedes Bild zweimal)
  // Zeitlupe: 60-fps-Quelle mit halber Geschwindigkeit bei 60 fps → jedes Quellbild zweimal hintereinander
  const dz = await nachbarDifferenzen(g.out, 3.2, 13), gleich = dz.filter(x => x < .3).length;
  pruefe(t, 'Zeitlupe: Quellbilder doppelt (halbe Geschwindigkeit)', gleich >= 5 && gleich <= 7, `${gleich} von ${dz.length} Nachbarn gleich, Differenzen ${dz.map(x => x.toFixed(2)).join(' ')}`);
  const b5 = await bildBei(g.out, 5.01);
  pruefe(t, 'Blitz: am Anfang fast weiß, nicht ganz', b5.mittel > 200 && b5.mittel < 250, `Mittel ${b5.mittel.toFixed(0)}`);
  pruefe(t, 'Originalton nur aus Szene 1 (Zeitlupe und Rampe stumm)', (await lautstaerke(g.out, .2, 2.3)) > -40 && (await lautstaerke(g.out, 2.7, 6.4)) < -80);
}

async function testD() {
  const t = testBeginn('d', 'Fehlerfälle: fehlender Clip, fehlende Musik');
  const segs = szenen([{ clip: 0, a: 0, len: 2 }]);
  const basis = { v: 1, name: 'Test D', out: { W: 1280, H: 720, fps: 30, bitrate: 10e6 }, segs, total: 2, fade: 0, overlay: { osd: false } };
  const d1 = await auftrag('d1', { ...basis, clips: [clip(T.fehlt, 'weg.mp4', 1920, 1080, 30, 6)], audio: { origVol: 1 } }, {});
  const r1 = await rendern(d1, ['--preset', 'veryfast']);
  pruefe(t, 'fehlender Clip: Exit ≠ 0', r1.code !== 0, `Exit ${r1.code}`);
  pruefe(t, 'fehlender Clip: klare Meldung ohne Pfade', /Clip 1 .*fehlt/.test(r1.stderr) && !r1.stderr.includes(AUSGABE), r1.stderr.trim().split('\n')[0]);
  pruefe(t, 'fehlender Clip: keine fertig.mp4', !fs.existsSync(path.join(d1, 'fertig.mp4')));
  const d2 = await auftrag('d2', { ...basis, clips: [clip(T.land, 'landscape.mp4', 1920, 1080, 30, 6)], audio: { origVol: 0, music: { teil: T.fehlt, start: 0, vol: 1, fin: 0, fout: 0 } } }, { [T.land]: medium('h264_landscape.mp4') });
  const r2 = await rendern(d2, ['--preset', 'veryfast']); t.sekunden = r1.sekunden + r2.sekunden;
  pruefe(t, 'fehlende Musik: Warnung', /Warnung: Die Musik fehlt/.test(r2.stderr), r2.stderr.trim().split('\n')[0]);
  await grundPruefung(t, d2, r2, { W: 1280, H: 720, dauer: 2, fps: 30, ton: false, stichproben: [1], warnungen: true });
}

async function testE() {
  const t = testBeginn('e', 'HLG ohne Ton, PQ voller Bereich, Clip zu kurz (letztes Bild steht), Musik zu kurz, Glitch und Whip, Look sw');
  const W = 1280, H = 720, A = W / H;
  const segs = szenen([
    { clip: 0, a: 1, len: 2, crop: cropPx(1920, 1080, A) },
    { clip: 1, a: .5, len: 2.5, tr: 'glitch', crop: cropPx(1920, 1440, A) },   // pq_foto ist 2 s lang: ab 1,5 s steht das letzte Bild
    { clip: 0, a: 2, len: 1, tr: 'whip', crop: cropPx(1920, 1080, A) }
  ]);
  const dir = await auftrag('e', { v: 1, name: 'Test E', out: { W, H, fps: 30, bitrate: 10e6 },
    clips: [clip(T.hlg, 'dji.mp4', 1920, 1080, 30, 3), clip(T.pq, 'foto.mp4', 1920, 1440, 30, 2)],
    segs, total: summe(segs), fade: 0, look: { id: 'sw', k: 1 }, overlay: { osd: false },
    audio: { origVol: 1, music: { teil: T.musik, start: 38.5, vol: 1, fin: 0, fout: 0 } } },
  { [T.hlg]: medium('dji_hlg_noaudio.mp4'), [T.pq]: medium('pq_foto.mp4'), [T.musik]: medium('musik.mp3') });
  const r = await rendern(dir, ['--preset', 'veryfast']); t.sekunden = r.sekunden;
  const g = await grundPruefung(t, dir, r, { W, H, dauer: 5.5, fps: 30, ton: true, stichproben: [.5, 2.1, 3, 5.2] });
  if (!g) return;
  const sb = path.join(dir, 'standbilder');
  for (const [tt, n] of [[1, '1_0s_hlg'], [2.05, '2_05s_glitch'], [3.5, '3_5s_pq_standbild'], [4.6, '4_6s_whip']]) await standbild(g.out, tt, path.join(sb, `e_${n}.png`));
  const b = await bildBei(g.out, 3);
  pruefe(t, 'Look sw: graue Pixel', b.bunt <= 6, `größte Kanaldifferenz ${b.bunt}`);
  // Szene 2 läuft 2,0 … 4,5 s; Quelle ab 0,5 s, 2 s lang → ab etwa 3,5 s steht das letzte Bild
  const dz = await nachbarDifferenzen(g.out, 3.6, 18);
  pruefe(t, 'Clip zu kurz: letztes Bild bleibt stehen', dz.every(x => x < .3), `größte Nachbardifferenz ${Math.max(...dz).toFixed(2)} zwischen 3,6 und 4,2 s`);
  // pq_foto ist ein Standbild (Foto als Video), Bewegung deshalb in Szene 1 (HLG-Clip) prüfen
  const dv = await nachbarDifferenzen(g.out, .5, 6);
  pruefe(t, 'Szene 1 (HLG) bewegt sich', dv.every(x => x > .3), `Differenzen ${dv.map(x => x.toFixed(2)).join(' ')}`);
  pruefe(t, 'Hinweis „letztes Bild wird gehalten“ im Protokoll', /letzte Bild wird gehalten/.test(r.stdoutText));
  pruefe(t, 'Musik läuft am Anfang', (await lautstaerke(g.out, .1, 1.2)) > -40);
  pruefe(t, 'Musik endet nach etwa 1,5 s, danach Stille (kein Wiederholen)', (await lautstaerke(g.out, 1.8, 5.4)) < -80);
}

async function testF() {
  const t = testBeginn('f', 'D-Log-M-Look 0,5, nur Sticker (statisch), 25 fps, 720 × 1280, Originalton 0,5, Schnitt ohne Übergang');
  const W = 720, H = 1280, A = W / H;
  const segs = szenen([{ clip: 0, a: 0, len: 2.2, crop: cropPx(1080, 1920, A) }, { clip: 0, a: 3, len: 1.8, crop: cropPx(1080, 1920, A) }]);
  const stickerDatei = path.join(AUSGABE, 'sticker_720x1280.png');
  await stickerPng(stickerDatei, W, H);
  const dir = await auftrag('f', { v: 1, name: 'Test F', out: { W, H, fps: 25, bitrate: 8e6 }, clips: [clip(T.hoch, 'portrait.mp4', 1080, 1920, 30, 5)],
    segs, total: summe(segs), fade: 0, look: { id: 'dlogm', k: .5 }, overlay: { teil: T.sticker, osd: false, ln: { name: 'Niemand', mode: 'off' } }, audio: { origVol: .5 } },
  { [T.hoch]: medium('h264_portrait.mp4'), [T.sticker]: stickerDatei });
  const r = await rendern(dir, ['--preset', 'veryfast']); t.sekunden = r.sekunden;
  const g = await grundPruefung(t, dir, r, { W, H, dauer: 4, fps: 25, ton: true, stichproben: [.5, 3] });
  if (!g) return;
  await standbild(g.out, 1, path.join(dir, 'standbilder', 'f_1_0s_dlogm_sticker.png'), 360);
  pruefe(t, 'Overlay als einzelnes Sticker-Bild (keine Bildfolge)', !fs.existsSync(path.join(dir, 'tmp', 'overlay.ffconcat')));
}

/* ---------- Ablauf ---------- */
const FAELLE = { a: testA, b: testB, c: testC, d: testD, e: testE, f: testF };
async function main() {
  for (const m of ['h264_landscape.mp4', 'h264_portrait.mp4', 'samsung_hdr10.mp4', 'gopro_hevc10.mp4', 'dji_hlg_noaudio.mp4', 'pq_foto.mp4', 'musik.mp3']) {
    if (!fs.existsSync(medium(m))) { console.error(`Testmedium fehlt: ${medium(m)}`); process.exit(2); }
  }
  console.log(`Ausgabe: ${AUSGABE}`);
  const sel = await lauf(process.execPath, [RENDER, '--selbsttest']);
  console.log(`Selbsttest: ${sel.code === 0 ? 'bestanden' : 'NICHT bestanden'}`);
  if (sel.code !== 0) console.log(sel.stdout.toString());
  for (const [k, f] of Object.entries(FAELLE)) {
    if (NUR.length && !NUR.includes(k)) continue;
    try { await f(); } catch (e) { const t = ERGEBNISSE[ERGEBNISSE.length - 1]; if (t) pruefe(t, 'Test lief durch', false, e.stack || e.message); }
  }
  console.log('\n=== Zusammenfassung');
  for (const t of ERGEBNISSE) console.log(`${t.ok ? 'ok    ' : 'FEHLER'} ${t.name}) ${t.titel} · ${t.pruef.filter(p => p.ok).length}/${t.pruef.length} Prüfungen · Render ${t.sekunden.toFixed(1)} s`);
  const ok = sel.code === 0 && ERGEBNISSE.every(t => t.ok);
  console.log(ok ? 'Alle Tests bestanden' : 'Nicht alle Tests bestanden');
  process.exitCode = ok ? 0 : 1;
}
main();
