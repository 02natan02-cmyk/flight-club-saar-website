/* Flight Club Saar – alle Inhalte, die sich ändern, an einer Stelle.
   Pflege: Flight-Club-Chat (Claude). Stand 24.10.2026. */
window.FCS = window.FCS || {};
FCS.data = {
  verein: {
    name: 'Flight Club Saar e. V.', kurz: 'Flight Club Saar', gegruendet: 2022, gruendung: '2022-12-10', satzung: 'docs/Satzung_Flight_Club_Saar.pdf',
    motto: 'Brille an, Welt aus!',
    adresse: 'Hedwigstraße 16, 66763 Dillingen',
    register: 'Vereinsregister Saarlouis · VR 1665',
    mail: 'info@flightclub-saar.de',
    // Alle Formulare gehen an info@flightclub-saar.de (Natan 28.10.2026: „Alles soll auf Info Flight Club gehen“), IONOS leitet weiter
    formMail: 'info@flightclub-saar.de',
    glaeubigerId: 'DE65ZZZ00002925192',
    iban: 'DE87 8306 5408 0007 0100 28', bic: 'GENODEF1SLR', bank: 'Deutsche Skatbank',
    beitrag: { erwachsen: 30, u18: 20, aufnahme: 20 }
  },
  kontakte: [
    { name: 'Manuel', rolle: 'Vorsitzender', wa: '4915775730048' },
    { name: 'Natan', rolle: 'Schriftführer', wa: '4915156743442' }
  ],
  social: [
    { k: 'instagram', name: 'Instagram', h: '@flightclubsaar', u: 'https://www.instagram.com/flightclubsaar/' },
    { k: 'tiktok', name: 'TikTok', h: '@flightclubsaar', u: 'https://www.tiktok.com/@flightclubsaar' },
    { k: 'youtube', name: 'YouTube', h: '@flightclubsaar', u: 'https://www.youtube.com/@flightclubsaar' }
  ],
  // Hallenfliegen: Hallen, Termine (Datum, Halle) und Spots stehen nur verschlüsselt in assets/data/mitglieder.enc.json
  // (eigener Mitgliedscode wie bei Gyroflow; Natan 28.10.2026: Spots, Hallen und Termine nur für Mitglieder)
  hallen: {},
  termine: [],
  zeit: { von: '18:00', bis: '21:00' },
  hallenBeitrag: 'ein kleiner Beitrag pro Abend, Infos in der WhatsApp-Gruppe',
  // Crew 2026: Mitglieder mit Beitrag 2026 (Stand Kassenbuch 21.10.2026) + Vorstand.
  // Datenschutz: ok:1 = Einwilligung liegt vor (stand schon auf der alten Vereinsseite, Natan 24.10.2026). Ohne ok erscheint nur die Anzahl.
  // Jugendliche nur mit Pilotennamen.
  crew: [
    { nr: '001', n: 'Manuel Hoffstetter', a: 'Alcutruz', r: 'Vorsitzender', seit: 2019, stil: 'Freestyle · Cinematic · Long Range', ort: 'Dillingen', v: 1, img: 'media/piloten/alcutruz.webp', ok: 1 },
    { nr: '002', n: 'Bianca Jozwiak', a: 'Etjoz', r: 'Kassenwartin', seit: 2019, stil: '', ort: 'Dillingen', v: 1, img: 'media/piloten/etjoz.webp', ok: 1 },
    { nr: '003', n: 'Natan Wojtasczyk', a: 'Booyaka FPV', r: 'Schriftführer', seit: 2021, stil: 'Freestyle · Long Range · Cinematic', ort: 'Dudweiler', v: 1, img: 'media/piloten/booyaka-fpv.webp', ok: 1 },
    // Mitglieder 2026 (Natan 29.10.: „gib allen eine Mitgliedsnummer … dass die, wo bezahlt haben … richtig auftauchen“). Öffentlich nur Vorname und Anfangsbuchstabe, kein Foto.
    { nr: '004', n: 'Boris H.', a: '', r: 'Mitglied', seit: '', stil: '', ort: '', m: 1 },
    { nr: '005', n: 'Dima K.', a: '', r: 'Mitglied', seit: '', stil: '', ort: '', m: 1 },
    { nr: '006', n: 'Nikola W.', a: '', r: 'Spotter & Security', seit: '', stil: '', ort: '', m: 1 },
    { nr: '007', n: 'Jan S.', a: 'Jan FPV', r: 'Jugend', seit: '', stil: '', ort: '', m: 1 },
    { nr: '008', n: 'Stefan S.', a: '', r: 'Neu 2026', seit: '', stil: '', ort: '', m: 1 },
    { nr: '009', n: 'Julian B.', a: '', r: 'Neu 2026', seit: '', stil: '', ort: '', m: 1 },
    { n: 'Alexander K.', a: '', r: 'Mitglied', seit: '', stil: '', ort: '' },
    { n: 'Dimitri S.', a: '', r: 'Mitglied', seit: '', stil: '', ort: '' },
    { n: '', a: 'Jonny FPV Magic', r: 'Jugend', seit: 2024, stil: 'Aggro Acro · Whoops · Cinematic', ok: 1 }
  ],
  // Spots: nur, was der Vorstand freigegeben hat. Neue Spots kommen über das Formular und werden geprüft.
  spots: [],
  spotTypen: {
    halle: { n: 'Halle', c: '#3fe0ff' },
    lost: { n: 'Lost Place', c: '#ffb020' },
    industrie: { n: 'Industriekultur', c: '#ff7a59' },
    feld: { n: 'Feld / Wiese', c: '#3ee08a' },
    bando: { n: 'Bando / Ruine', c: '#c78bff' }
  },
  // WhatsApp-Community „Flight Club Saar e.V.“ (gegründet 27.05.2023, Stand 24.10.2026)
  gruppen: [
    { n: 'Flight Club Saar Chat', m: 69, t: 'Der Hauptkanal: Fragen, Fotos, Verabredungen.' },
    { n: 'Spots / Treffen', m: 60, t: '„Ich geh morgen da hin.“ „Samstag was los?“' },
    { n: 'Technischer Support', m: 55, t: 'Löten, Betaflight, VTX, ELRS: Hier wird geholfen.' },
    { n: 'Videos & Fotos', m: 55, t: 'Die besten Clips der Woche.' },
    { n: 'Hab ich neu', m: 44, t: 'Neue Kopter, neue Brillen, neue Teile.' },
    { n: 'Marktplatz intern', m: null, t: 'Kaufen, verkaufen, tauschen unter Mitgliedern.' },
    { n: 'Ankündigungen', m: null, t: 'Termine und Infos vom Vorstand.' },
    { n: 'Verein', m: null, t: 'Für Vereinsmitglieder.' },
    { n: 'Ankündigungen Verein', m: null, t: 'Vereinsinterne Infos.' }
  ],
  // Kanal-Zapper: legale Kanäle R3–R6, Clips aus den Reels der Piloten (gemeinsame Beiträge mit @flightclubsaar)
  kanal: [
    { ch: 3, a: 'Stay Fly', o: 'Bando-Session', clip: 'media/kanal/stayfly.mp4', ig: 'stay_fly.sb' },
    { ch: 4, a: 'GrobsFPV', o: 'Bando Time', clip: 'media/kanal/grobsfpv.mp4', ig: 'grobsfpv' },
    { ch: 5, a: 'Orcinus', o: 'Kühlturm-Dive', clip: 'media/kanal/orcafpv.mp4', ig: 'orcinus.fpv' },
    { ch: 6, a: 'Booyaka FPV', o: 'Alte Grube', clip: 'media/kanal/booyaka.mp4', ig: 'wojtasczyk_natan' }
  ],
  // Bestenliste „Kannst du fliegen?“: Make-Szenario 8156727 (Webhook → Datenspeicher „FCS Whoop Bestenliste“)
  highscore: { url: 'https://hook.eu1.make.com/gq3bv9u25ybq6tzu5o2l9ecf4tcnuovk' },
  // Live-Beiträge (Markt, Pinnwand, Spot-Bewertungen, Termin-Zusagen): Make-Szenario 8157184 → Datenspeicher „FCS Website-Beiträge“ + „FCS Website-Fotos“. Zugriff nur über FCS.board (fcs.js).
  // Make-Webhooks. bereich = Mitgliedscode prüfen und Schlüssel für Spots/Hallen holen (Szenario 8240408), mitglied = Mitgliedscode prüfen (Clip-Studio Premium), clips = Upload in den Vereins-OneDrive und Gyroflow (gleicher Webhook, Unterscheidung über a=)
  api: { beitraege: 'https://hook.eu1.make.com/q8ldn199ovql1h99k95oedbgf4ko5ktl', mitglied: 'https://hook.eu1.make.com/ue6rysv2dwkk9lozrsnjzyy55edkpz9i', clips: 'https://hook.eu1.make.com/ue6rysv2dwkk9lozrsnjzyy55edkpz9i', bereich: 'https://hook.eu1.make.com/06rl3qh9dynwm1j9limhua76ju9rrljz' },
  // Instagram @flightclubsaar, Aufrufe Stand 24.10.2026
  reels: [
    { id: 'DdRQZOsI0vS', v: 6203, d: '2026-09-14', t: 'Addicted to Dance 2026', c: 'mit @addicted2dancecontest', clip: 1 },
    { id: 'DdUGwbwIeJs', v: 4538, d: '2026-09-15', t: 'Addicted to Dance 2026', c: 'Tanz- und Kulturmeisterschaft', clip: 1 },
    { id: 'DXgU6XmDQNC', v: 3627, d: '2026-04-24', t: 'Lemon Love', c: 'Styled Shoot von oben', clip: 1 },
    { id: 'DO5XzLCiHc3', v: 2720, d: '2025-09-22', t: 'Addicted to Dance 2025', c: 'Impressionen', clip: 1 },
    { id: 'DdgTJM5IyBx', v: 2715, d: '2026-09-20', t: 'POV über der Bühne', c: 'Addicted to Dance 2026', clip: 1 },
    { id: 'DXjZWCuDW4y', v: 1573, d: '2026-04-25', t: 'Kopter im Ayedo-Look', c: 'mit @weareayedo', clip: 1 },
    { id: 'DZZPCmpNo-_', v: 1463, d: '2026-06-10', t: 'Altes Grubengelände', c: 'Booyaka FPV', clip: 1 },
    { id: 'DcjJwc8yiwl', v: 1173, d: '2026-08-27', t: 'Wüste Gobi, Mongolei', c: 'Enduro und FPV', clip: 1 },
    { id: 'DeI-1Hzo-me', v: 613, d: '2026-10-06', t: 'Technikmuseum Sinsheim', c: 'eine traumhafte Sammlung', clip: 1 }
  ],
  // Reichweite, Stand 24.10.2026 (selbst nachgezählt auf den Profilen)
  stats: { stand: '24.10.2026', instagram: { follower: 360, beitraege: 71 }, tiktok: { follower: 3950, likes: 3254, videos: 40 }, youtube: { abos: 36, videos: 10 }, whatsapp: 69 },
  // TikTok @flightclubsaar: angepinnte Videos und die meistgesehenen (Aufrufe Stand 24.10.2026)
  tiktok: [
    { id: '7693492531773852960', pin: 1 }, { id: '7681322923772218657', pin: 1 }, { id: '7679147146683174176', pin: 1 },
    { id: '7483942002891951383', v: 1924 }, { id: '7486974041199365398', v: 1102 }, { id: '7345103806188752160', v: 1068 },
    { id: '7483486524802370838', v: 992 }, { id: '7408912746747579681', v: 915 }, { id: '7483147844333866262', v: 887 }
  ],
  // YouTube @flightclubsaar (10 Videos, Auswahl)
  youtube: [
    { id: 'l41DRIX8Wf0', t: 'Inside a Bando' }, { id: 'B9ArK0tmVf0', t: 'Bando Action' }, { id: '3qAH6slQclA', t: 'qrotec & Cheeez' },
    { id: 'hQJFDqeb338', t: 'Seize The Sunny Day' }, { id: '9BgCHWsSINk', t: 'Cheeez in the Fields' }, { id: '5h4TyZocbKo', t: 'Into to Jungle' },
    { id: 'Ov4PgpwjsH4', t: 'Pool or Beach?' }, { id: 'CiSRRCzzaZ0', t: 'Be Prepared!' }
  ],
  // Chronik aus den News der alten Vereinsseite und unseren Kanälen
  chronik: [
    { d: '2022-12-10', t: 'Gründung', u: 'Der Flight Club Saar wird in Dillingen gegründet. Zweck laut Satzung: die Förderung des FPV-Sports.' },
    { d: '2023-05-27', t: 'Die Community startet', u: 'Die WhatsApp-Community „Flight Club Saar e.V.“ wird gegründet.', img: 'media/chronik/2023-05-27.webp' },
    { d: '2023-07-20', t: 'Saarlouis Hornets', u: 'Für die Baseball-Saison 2023/24 liefern wir Live-Luftbilder aus dem Stadion Saarlouis.', img: 'media/chronik/2023-07-20.webp' },
    { d: '2023-11-04', t: 'Ü30 Festhalle Elm', u: 'Ü30-Party in der Turn- und Festhalle Elm, wir sind dabei.', img: 'media/chronik/2023-11-04.webp' },
    { d: '2023-12-16', t: 'Ü30 Party Überherrn', u: 'Ü30-Party im Kulturhaus Überherrn mit DJ Benjamin Suffel und Freunden.', img: 'media/chronik/2023-12-16.webp' },
    { d: '2023-12-27', t: 'Erste Indoor-Session', u: 'Tiny-Whoop-Wintersaison 2023/24 in der Halle.', img: 'media/chronik/2023-12-27.webp' },
    { d: '2024-02-22', t: 'Time Axis', u: 'Unser Film vom Techno-Klassiker mit 13 DJs.', img: 'media/chronik/2024-02-22.webp' },
    { d: '2025-02-02', t: 'Ayedo steigt ein', u: 'Ayedo wird Sponsor und Partner des Vereins.', img: 'media/chronik/2025-02-02.webp' },
    { d: '2024-06-15', t: 'Erstmals auf der Make It', u: 'Unser erster Stand beim Maker Festival make-it.saarland im E-Werk Saarbrücken.' },
    { d: '2025-06-14', t: 'Make It: beliebtester Stand', u: 'Großer Drohnenkäfig im E-Werk: Hunderte Besucher und viele Kinder fliegen mit FPV-Brille echte Drohnen.' },
    { d: '2026-06-13', t: 'Make It 2026', u: 'Zum dritten Mal im E-Werk, mit Dutzenden Drohnen und mehreren Simulatoren.', img: 'media/chronik/2026-06-13.webp' },
    { d: '2026-09-14', t: 'Addicted to Dance 2026', u: 'FPV-Bilder von der saarländischen Tanz- und Kulturmeisterschaft. Unser meistgesehenes Reel.', img: 'media/chronik/2026-09-14.webp' },
    { d: '2026-10-17', t: 'Hallensaison 2026', u: 'Start der Wintersaison in der Halle.' }
  ],
  // Piloten von der alten Vereinsseite (öffentlich gelistet). Vor dem Livegang mit dem Vorstand abgleichen, wer noch dabei ist.
  piloten: [
    { a: 'Alcutruz', n: 'Manuel', ort: 'Dillingen', seit: 2019, stil: 'Freestyle, Cinematic, Juicy SBang, Long Range', ig: 'manuel_hoffstetter', img: 'media/piloten/alcutruz.webp' },
    { a: 'Booyaka FPV', n: 'Natan', ort: 'Dudweiler', seit: 2021, stil: 'Freestyle, Long Range, Cinematic', ig: 'wojtasczyk_natan', img: 'media/piloten/booyaka-fpv.webp' },
    { a: 'Etjoz', n: 'Bianca', ort: 'Dillingen', seit: 2019, stil: '', img: 'media/piloten/etjoz.webp' },
    { a: 'Stay Fly', n: 'Tobias', ort: 'Scheidt', seit: 2019, stil: 'Juicy SBang, Freestyle, Cinematic', yt: 'stayflysb', tt: 'stayfly.sb', ig: 'stay_fly.sb', img: 'media/piloten/stay-fly.webp' },
    { a: 'Fireblast FPV', n: 'Sebastian', ort: 'Riegelsberg', seit: 2017, stil: 'Freestyle, 3D', tt: 'fireblast_fpv', ig: 'fireblast_fpv', img: 'media/piloten/fireblast-fpv.webp' },
    { a: 'GrobsFPV', n: 'Tom', ort: 'Merzig', seit: 2023, stil: 'Freestyle, Cinematic', yt: 'GrobsFPV', tt: 'grobsfpv', ig: 'grobsfpv', img: 'media/piloten/grobsfpv.webp' },
    { a: 'Orcinus', n: 'Ruben', ort: '', seit: 2020, stil: 'Freestyle, Cinema, Whoops', ig: 'orcinus.fpv', img: 'media/piloten/orcafpv.webp' },
    { a: 'Crystal FPV', n: 'Julian', ort: 'Völklingen', seit: 2023, stil: 'Cinema, Whoop, Freestyle', img: 'media/piloten/crystal-fpv.webp' },
    { a: 'Jonny FPV Magic', n: '', ort: '', seit: 2024, stil: 'Aggro Acro, Whoops, Freestyle, Cinematic' },
    { a: 'Lord FPV', n: 'Waldemar', ort: 'Saarlouis', seit: 2019, stil: 'Race, Freestyle, Long Range', img: 'media/piloten/lord-fpv.webp' },
    { a: 'Kenny FPV', n: 'Kenny', ort: 'Merzig', seit: 2020, stil: 'Freestyle', img: 'media/piloten/kenny-fpv.webp' },
    { a: 'MaNa', n: 'Matthias', ort: 'Weiskirchen', seit: 2020, stil: 'Freestyle', img: 'media/piloten/mana.webp' },
    { a: 'Lukas FPV', n: 'Lukas', ort: 'Schwalbach', seit: 2018, stil: 'Freestyle', img: 'media/piloten/lukas-fpv.webp' },
    { a: 'Jens FPV', n: 'Jens', ort: '', seit: 2023, stil: 'Freestyle', img: 'media/piloten/jens-fpv.webp' },
    { a: 'Pascal FPV', n: 'Pascal', ort: 'Saarbrücken', seit: 2018, stil: 'Freestyle, Juicy SBang', img: 'media/piloten/pascal-fpv.webp' },
    { a: 'Floss FPV', n: 'Fabian', ort: 'Merzig', seit: 2021, stil: 'Freestyle', img: 'media/piloten/floss-fpv.webp' },
    { a: 'Erik FPV', n: 'Erik', ort: 'Nonnweiler', seit: 2021, stil: 'Freestyle, Racing, Tiny Whoop Racing', img: 'media/piloten/erik-fpv.webp' },
    { a: 'Ney FPV', n: 'Michael', ort: 'Völklingen', seit: 2021, stil: 'Freestyle', img: 'media/piloten/ney-fpv.webp' },
    { a: 'Nadja FPV', n: 'Nadja', ort: 'Saarlouis', seit: 2023, stil: 'Cinematic', img: 'media/piloten/nadja-fpv.webp' },
    { a: 'Dennis FPV', n: 'Dennis', ort: 'Schwalbach', seit: 2022, stil: 'Freestyle', img: 'media/piloten/dennis-fpv.webp' },
    { a: 'Mailo FPV', n: 'Kevin', ort: 'Saarland', seit: 2018, stil: 'Freestyle, Whoop', img: 'media/piloten/mailo-fpv.webp' },
    { a: 'Olli FPV', n: 'Oliver', ort: 'Orscholz', seit: 2020, stil: 'Freestyle, Whoop', img: 'media/piloten/olli-fpv.webp' },
    { a: 'Mr_Batch', n: 'Axel', ort: 'Saarland', seit: 2021, stil: 'Freestyle', yt: 'mr_batch', img: 'media/piloten/mr-batch.webp' },
    { a: 'Spotter & Security', n: 'Nikola', ort: 'Dudweiler', seit: 2019, stil: 'Aggressive', img: 'media/piloten/spotter.webp' }
  ],
  // Video-Einsendungen: OneDrive-Datei-Anfrage (Link folgt, solange leer: Formular + WhatsApp)
  upload: { link: '', maxMail: 9 },
  // Freigegebene Einsendungen (pflegt der Vorstand, neueste zuerst). Leer = schöner Leerzustand auf der Seite.
  // pinnwand: { d:'2026-10-24', n:'Pilotenname', t:'Text', img:'media/pin/xyz.webp', k:[{n,t,d}] }
  pinnwand: [],
  // clips: { d, n:'Pilotenname', src:'media/clips/xyz.mp4', poster:'media/clips/xyz.webp', ig:'' }
  clips: [],
  // markt: { id, art:'biete'|'suche', titel, kat, preis, zustand, ort, t, img:[], kontakt, link, n, d:'2026-10-24' }. Nur vom Vorstand eingetragene Anzeigen: Sie stehen vor den Live-Anzeigen (FCS.board) und bleiben, bis sie hier gelöscht werden
  markt: [],
  partner: [
    { n: 'Ayedo', u: 'https://ayedo.de/', ig: 'weareayedo', t: 'Sponsor und Partner seit Februar 2025. Cloud-Anbieter aus Schwalbach-Hülzweiler im Saarland.' },
    { n: 'Falcon Eye', u: 'https://falcon-eye.de/', t: 'FPV-Filme und Webdesign aus dem Verein heraus. Falcon Eye baut und betreibt diese Website, die Filme stammen von vielen Mitgliedern des Vereins.' }
  ]
};
