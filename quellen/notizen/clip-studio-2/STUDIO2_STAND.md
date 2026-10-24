# Clip-Studio 2 · Zustand (Helfer G, 24.10.2026, 23:10, abgebrochen auf Natans STOPP)

## Baubar und fehlerfrei?
- `python3 quellen/build.py` läuft, filmen.html wird gebaut. Syntax aller Module geprüft (node --check).
- Letzter Browser-Lauf (vor den letzten zwei kleinen Änderungen): filmen.html lädt ohne Konsolenfehler und ohne 404. `fe-pruefen`/`fe-livegang` NICHT gelaufen. Nicht live stellen, bevor das geprüft ist.

## Geänderte Dateien (nur mein Bereich, kein commit)
- assets/js/studio.js (komplett neu), assets/css/studio.css (neu), quellen/src/filmen.html NUR Abschnitt `#studio` (Kapitel 01 inkl. Werkzeuge)
- neu: assets/js/studio-media.js (mediabunny: Steckbrief, Selbsttest, Ton, Export), studio-gl.js (WebGL: Übergänge, Looks, D-Log M), studio-cloud.js (Mitgliedscode, OneDrive-Upload in Stücken, Gyroflow-Status), studio-beat.js (Worker Takterkennung)

## Fertig und getestet (Playwright-Chromium)
- Schwarzes Video, Ursache und Lösung: Vorschau zeigt jetzt das echte Video-Element (nicht mehr Canvas aus unsichtbarem 2-px-Video), Selbsttest liest Pixel über 3 Wege (Element, WebCodecs direkt, WebCodecs über RGBA-Kopie) und wählt pro Clip den funktionierenden Exportweg. Wahrscheinliche Ursache bei Natan: Canvas aus HDR-10-Bit-HEVC (iPhone) bzw. unsichtbares Video auf iOS; im Container nicht nachstellbar (kein H.264/HEVC-Dekoder).
- Formatmatrix (15 Dateien, mit ffmpeg erzeugt): VP9 4K60, VP9 10 Bit HDR PQ, AV1 10 Bit HLG hochkant mit Drehung, AV1 gedreht, AV1 1080×1920, VP9 VFR, dunkel, schwarz → alle erkannt, Vorschau mit Bild, Selbsttest grün (schwarzer Clip korrekt als „sehr dunkel“). H.264 4K60/VFR/GoPro, HEVC 8/10 Bit, HEVC HDR10, iPhone HEVC HLG .mov, DJI-artig HEVC 10 Bit → klarer Format-Steckbrief und Meldung, Original einsenden möglich.
- Takterkennung (Worker, Bass-gewichtet): 128 und 100 BPM exakt, Beats ±3 ms (max 7 ms), Taktanfang richtig. M4A/AAC dekodiert Playwright-Chromium nicht (echtes Chrome/Safari schon).

## Halb fertig (geschrieben, NICHT im Browser durchgetestet)
- Export (studio-media.js `render`, studio.js `exportVideo`/`renderLive`): Testlauf hing im Container, Ursache offen (letzter Stand: hängt vor/bei Schritt 4/5 im Testskript, evtl. Klick auf verdeckte Elemente oder Export-Promise). Unbedingt prüfen, bevor live.
- WebGL-Compositor (Looks, Übergänge Blende/Blitz/Zoom/Wisch/Whip/Glitch, D-Log M aus DJI-Whitepaper-Kurve + D-Gamut-Matrix): Shader nie im Browser kompiliert. Bei Fehler fällt die Vorschau auf CSS-Filter zurück.
- Auto-Schnitt (3 Stile, Szenen auf Bass-Beats, Tempo-Rampe, Zeitlupe ab 47 fps), Storyboard mit tauschbaren Übergängen, Musik-UI (Wellenform, Start auf Takt, Lautstärken, Blenden), Piloten-Tag (4 Stile, Profilbild aus data.js), Zuschneiden mit Feinknöpfen.
- Upload (Stücke 30×327 680 B, 5 Wiederholungen 1/2/4/8/16 s mit GET nextExpectedRanges, 416/404, Pause/Fortsetzen/Verwerfen, Fortsetzen nach Neuladen über localStorage `fcs-uploads`), Mitgliedscode (`fcs-mitglied`, „Accepted“ = ungültig), Gyroflow-Auftrag + „Meine Aufträge“ (`fcs-gyro`, Status max. 1×/Minute nur bei sichtbarer Seite). Mock dafür liegt fertig in /tmp/claude-0/-home-claude/7a8f63d6-d747-5eb8-a717-2d586b09191f/scratchpad/g/mock.js (Tests: h.js, t-formats.js, t-export.js).

## Bekannte Fehler / offen
- Handy: Premium-Leiste oben zu hoch (langer Text), braucht Kurzfassung unter 620 px.
- Storyboard-Abspielkopf `#sb-ph` ist ausgeblendet (nur Szenen-Markierung aktiv).
- Bildschirmfotos aller Schritte, Touch-Bedienung, fe-pruefen: nicht gemacht.

## Wünsche an dich (exakt)
- Backend Gyroflow: opt-JSON kommt als `{"glaettung":0-100,"horizont":true|false,"zoom":"dynamisch"|"statisch"|"aus"}`. Zusatzdatei (.gcsv/Blackbox-Log) wird als eigener Start mit `zweck=gyroflow` und neuem Feld `zu=<Job-ID des Videos>` hochgeladen; bitte im Make-Szenario annehmen und dem Auftrag zuordnen.
- Optional data.js: `studio: { lut: 'assets/data/lut/dji-dlogm-rec709.cube' }` und dort die offizielle DJI-LUT (dji.com/downloads/softwares/o4-air-unit-dlog-to-rec709, im Container gesperrt) ablegen; dann nutzt der Look „D-Log M → normal“ die echte 3D-LUT statt der Nachbildung.
