# Render-Station des Flight Club Saar · Rezept-Format (v1)

Das Clip-Studio (assets/js/studio.js) schickt die Originaldateien und ein `rezept.json` in den Vereins-OneDrive.
Die Render-Station (GitHub Actions, `.github/workflows/render.yml`) rechnet daraus mit `quellen/render/render.mjs`
das fertige Video. Ziel: **Das fertige Video sieht genau so aus wie die Vorschau im Studio.**

## Dateien eines Auftrags
- `rezept.json` (unten)
- Teile: jede Datei hat eine 16-stellige Auftragsnummer (`teil`). Der Workflow legt sie als `teile/<teil>.<endung>` ab
  (Endung aus dem Originalnamen, kleingeschrieben; ohne Endung: `.bin`). Der Renderer sucht `teile/<teil>.*`.

## rezept.json
```json
{
  "v": 1,
  "name": "Booyaka FPV",
  "out": { "W": 1080, "H": 1920, "fps": 30, "bitrate": 16000000 },
  "clips": [
    { "teil": "a1b2c3d4e5f60718", "fn": "DJI_0001.MP4", "w": 3840, "h": 2160, "fps": 59.94, "dur": 42.5 }
  ],
  "segs": [
    { "clip": 0, "a": 2.5, "len": 4.0, "at": 0,   "kind": "1",    "tr": null,     "d": 0,
      "crop": { "left": 960, "top": 0, "width": 1215, "height": 2160 } },
    { "clip": 0, "a": 20,  "len": 3.2, "at": 4.0, "kind": "slow", "tr": "blende", "d": 0.7,
      "crop": { "left": 960, "top": 0, "width": 1215, "height": 2160 } }
  ],
  "total": 7.2,
  "fade": 0.6,
  "look": { "id": "warm", "k": 0.8 },
  "overlay": { "teil": "0f0e0d0c0b0a0908", "osd": true, "ln": { "name": "Booyaka", "mode": "start" } },
  "audio": { "origVol": 1, "music": { "teil": "1122334455667788", "start": 1.25, "vol": 0.9, "fin": 0.5, "fout": 1.5 } }
}
```

### Bedeutung (genau wie im Browser, siehe studio.js `buildSeq`, `srcFn`, `cropPx`, `exportVideo`)
- **out**: Zielgröße (gerade Zahlen), Bildrate, Video-Bitrate in Bit/s. H.264 High, yuv420p, AAC 192 kBit/s 48 kHz Stereo, `+faststart`.
- **clips[i].w/h**: Anzeigemaße nach Drehung (ffmpeg dreht automatisch, dann stimmen sie). `dur` in Sekunden, `fps` Quelle.
- **segs**: Szenen hintereinander. `at` = Start im fertigen Video, `len` = Dauer im fertigen Video (Summe aller `len` = `total`).
  Quellzeit zu Ausgabezeit `l` (0 … len) in der Szene:
  - `kind: "1"`: `a + l`
  - `kind: "slow"`: `a + 0.5 · l` (halbe Geschwindigkeit, Quelle hat ≥ 47 fps)
  - `kind: "ramp"`: Geschwindigkeit `v(u)` mit `u = l/len`: `u < .38 → 1.75`, `.38 ≤ u < .62 → 1.75 + (0.5 − 1.75) · s((u − .38)/.24)` mit `s(x) = x²(3 − 2x)`, `u ≥ .62 → 0.5`; Quellzeit = `a + ∫₀ˡ v(l'/len) dl'`.
    Näherung erlaubt: drei Stücke mit konstanter Geschwindigkeit (1.75 / 1.125 / 0.5), solange die Ausgabedauer genau `len` bleibt.
  - Quellzeit nie über `dur − 1/fps` hinaus: letztes Bild einfrieren (`tpad=stop_mode=clone`).
- **Übergang** `tr` (Typ) mit Dauer `d` sitzt am **Anfang** der Szene i: Während `[at, at + d]` läuft Szene i−1 **über ihr Ende hinaus weiter**
  (Quellzeit `src_{i−1}(len_{i−1} + l)`), Szene i beginnt bei `a_i`. Die Gesamtlänge ändert sich dadurch nicht.
  Umsetzung mit `xfade`: Stück A mit Länge `len_A + d` schneiden, Stück B mit `len_B`, `xfade=offset=len_A:duration=d` → Ausgabe `len_A + len_B`.
  Fortschritt `p = l/d` (0 … 1). Typen (aus studio-gl.js, Shader `FS`, `TYPE`):
  - `schnitt`: harter Schnitt (d = 0)
  - `blende`: `mix(A, B, smoothstep(0,1,p))` → `xfade=transition=fade` (gleiche Kurve genügt)
  - `blitz`: `mix(B, weiß, pow(1−p, 2.2) · 0.95)` → `xfade=custom` mit genau dieser Formel (oder `fadewhite`, wenn custom scheitert)
  - `zoom`: erste Hälfte A zoomt auf 1.45 (quadratisch), zweite Hälfte B von 1.3 zurück auf 1.0 (kubisch aus), mit Zoom-Blur → `zoomin` reicht
  - `wisch`: Kante `uv.x·0.8 + uv.y·0.2`, `e = smoothstep(0,1,p)·1.5 − .25`, Mischung `smoothstep(e−.08, e+.08, edge)` von B nach A → `custom`-Ausdruck
  - `whip`: A schiebt nach links raus, B kommt von rechts, mit Bewegungsunschärfe → `slideleft` reicht
  - `glitch`: zeilenweise Verschiebungen von B, in den ersten 35 % manchmal A → `pixelize` oder `custom` reicht
- **fade**: Sekunden Ausblenden ins Schwarze am Ende (0 = aus). Nur Bild (Musik hat `fout`).
- **look**: Farbstimmung, **exakt** wie im Shader `grade()` in `assets/js/studio-gl.js` (Werte in `LOOKS`), Stärke `k` (0 … 1, `natur` = aus).
  Umsetzung: `grade()` nach JavaScript portieren, daraus eine 3D-LUT (`.cube`, 33³) für genau diesen Look und dieses `k` erzeugen,
  per `lut3d=interp=tetrahedral` anwenden. Der Shader rechnet auf Werten 0 … 1 des angezeigten (SDR, sRGB-artigen) Bildes.
  `dlogm`: der `uLog`-Zweig mit `dlogm()` (ohne 3D-LUT-Datei).
- **HDR-Quellen** (color_transfer `smpte2084` oder `arib-std-b67`): zuerst nach SDR BT.709 (zscale + tonemap hable wie in `gyroflow.yml`), dann Look.
- **overlay**: Reihenfolge wie im Browser (`overlay()` in studio.js): 1. OSD (`osd: true`), 2. Sticker-Bild `teil` (PNG in Ausgabegröße W×H mit Alpha, kann fehlen), 3. Namens-Einblendung `ln` (`mode`: `start` = die ersten 5 s, `all` = immer, `off` = aus; leerer `name` = aus).
  OSD und Einblendung zeichnet **dasselbe Modul** `assets/js/studio-overlay.js` (`drawOSD(ctx, W, H, t)`, `drawLower(ctx, W, H, t, ln, osd, false)`, `frameKey(t, osd, ln)`)
  mit `@napi-rs/canvas` in Node. Pro Ausgabebild (t = i / fps) ein Overlay-Bild; gleiche `frameKey` → gleiche PNG-Datei (ffconcat-Liste mit `duration`),
  damit nicht tausende Bilder entstehen. Schriften: `quellen/render/fonts/` (Bebas Neue 400, Chakra Petch 400/600) per `GlobalFonts.registerFromPath`.
  Ohne OSD und ohne Einblendung reicht das statische Sticker-PNG als einzelnes Overlay.
- **audio**: `origVol` (0 … 1) = Originalton der Szenen mit `kind "1"` (slow/ramp haben keinen Originalton), jeweils `[a, a+len]` an Position `at`.
  `music`: Datei `teil` (MP3/M4A/WAV …), ab Sekunde `start` im Lied, Lautstärke `vol`, Einblenden `fin` s, Ausblenden `fout` s zum Ende bei `total`.
  Alles mischen (`amix`, Lautstärken multiplikativ, kein Normalisieren), Ergebnis auf `total` kürzen. Ohne beides: keine Tonspur.

## Aufruf
```
node quellen/render/render.mjs --rezept auftrag/rezept.json --teile auftrag/teile --out auftrag/fertig.mp4 [--tmp auftrag/tmp] [--preset veryfast]
```
Exit 0 und `fertig.mp4` vorhanden, sonst Exit ≠ 0 mit klarer Meldung auf stderr (deutsch, ohne Pfade von Nutzern).
Fortschritt auf stdout (`progress 0.42`). Zum Schluss `ffprobe`-Zusammenfassung ausgeben.

## Grenzen
- `total` ≤ 180 s, bis zu 5 Clips, Ausgabe bis 3840×2160, 23.976 … 60 fps.
- Quellen: alles, was ffmpeg liest (H.264, HEVC 8/10 Bit, HDR10/HLG, ProRes, AV1, VP9), Drehung aus Metadaten.
- Fehlende Musik- oder Sticker-Datei: Warnung, ohne sie weiterrechnen. Fehlender Clip: Abbruch.
