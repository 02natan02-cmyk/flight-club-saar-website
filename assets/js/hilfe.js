/* Flight Club Saar · Technik-Hilfe
   FPV-Doktor (Chat ohne Server, eingebaute Wissensdatenbank mit unscharfer Suche und geführten Diagnosen),
   Arming-Flag-Werkzeug, Kompatibilitäts-Check, Vereinswissen, Frage an den Verein.
   Inhalte pflegen: unten in FLAGS, KB und TREE. Stand 24.10.2026. */
(function () {
  'use strict';
  const FCS = window.FCS = window.FCS || {};
  const D = FCS.data || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = () => typeof window.gsap !== 'undefined';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise(r => setTimeout(r, RM ? Math.min(ms, 120) : ms));
  // Natives Scrollen über fcs.js (rechnet Menü und Kapitel-Leiste mit ein)
  const scrollToEl = (el, off = -84) => {
    if (!el) return;
    if (FCS.scrollTo) FCS.scrollTo(el, off);
    else { const y = el.getBoundingClientRect().top + scrollY + off; scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); }
  };
  const WIDE = () => innerWidth >= 981;
  // Aufklapper, die auf breiten Bildschirmen offen starten (am Handy zu, damit die Seite kurz bleibt)
  $$('#flagtool, .th-tips').forEach(d => { if (WIDE()) d.open = true; });
  const openFlag = () => { const d = $('#flagtool'); if (d && !d.open) d.open = true; };
  document.addEventListener('click', (ev) => { const a = ev.target.closest && ev.target.closest('a[href$="#flagtool"]'); if (a) openFlag(); }, true);
  if (location.hash === '#flagtool') openFlag();

  /* ---------- Zahlen aus data.js sofort eintragen (vor fcs.js-Zählern) ---------- */
  const support = (D.gruppen || []).find(g => /technisch/i.test(g.n));
  $$('[data-gruppe-m]').forEach(el => { if (support && support.m) { el.textContent = '0'; el.setAttribute('data-count', support.m); } });
  $$('[data-hallenbeitrag]').forEach(el => { if (D.hallenBeitrag) el.textContent = D.hallenBeitrag; });

  /* =====================================================================
     WISSENSDATENBANK
     ===================================================================== */

  // Betaflight Arming-Flags: Name, Kurztitel, Bedeutung, Lösungsschritte. a = mehrdeutiges Wort (braucht Zusammenhang)
  const FLAGS = [
    ['NOGYRO', 'Kein Gyro erkannt', 'Die Flugsteuerung findet ihren Lagesensor (Gyro) nicht. Ohne Gyro kann sie nicht fliegen.', ['Prüfen, ob die richtige Firmware (das passende Target) für deine Flugsteuerung aufgespielt ist.', 'Im Setup-Tab nachsehen, ob sich das 3D-Modell bewegt, wenn du den Kopter kippst.', 'Bleibt es dabei, ist die Flugsteuerung vermutlich beschädigt, etwa nach einem Crash oder Kurzschluss. Frag im Verein nach, bevor du neu kaufst.']],
    ['FAILSAFE', 'Failsafe aktiv', 'Betaflight ist gerade im Failsafe, meist weil das Empfängersignal fehlt oder gerade weg war.', ['Sender einschalten und prüfen, ob der Empfänger verbunden ist (LED am Empfänger).', 'Im Receiver-Tab prüfen, ob sich die Balken mit den Sticks bewegen.', 'Mehr dazu unter RXLOSS.'], 1],
    ['RXLOSS', 'Kein Empfängersignal', 'Die Flugsteuerung bekommt keine gültigen Daten vom Empfänger.', ['Sender an? Empfänger gebunden? Bei ExpressLRS leuchtet die Empfänger-LED dann dauerhaft.', 'Im Ports-Tab „Serial RX“ genau an dem UART einschalten, an dem der Empfänger hängt.', 'Im Receiver-Tab „Serial (via UART)“ und das Protokoll „CRSF“ wählen (ExpressLRS und Crossfire).', 'Verkabelung gekreuzt: TX vom Empfänger an RX der Flugsteuerung, RX an TX.', 'Bewegen sich im Receiver-Tab die Balken mit den Sticks, ist dieser Punkt gelöst.']],
    ['BADRX', 'Empfänger wieder da, Arm-Schalter noch an', 'Das Empfängersignal war weg und ist zurück. Weil der Arm-Schalter dabei auf „an“ steht, sperrt Betaflight zur Sicherheit.', ['Arm-Schalter auf „aus“ stellen.', 'Dann ganz normal wieder armen.']],
    ['BOXFAILSAFE', 'Failsafe-Schalter aktiv', 'Auf einem Schalter liegt der Modus „FAILSAFE“, und der ist gerade eingeschaltet.', ['Schalter ausschalten.', 'Im Modes-Tab nachsehen, auf welchem Schalter „FAILSAFE“ liegt.']],
    ['RUNAWAY', 'Runaway Takeoff ausgelöst', 'Betaflight hat beim Abheben erkannt, dass der Kopter unkontrolliert wegdreht, und sofort abgeschaltet (Runaway Takeoff Prevention).', ['Akku abziehen und wieder anstecken.', 'Ohne Propeller im Motors-Tab Reihenfolge und Drehrichtung der Motoren prüfen.', 'Propeller richtig herum montiert? Board-Ausrichtung im Configuration-Tab richtig?', 'Ausführlich unter „Motoren drehen falsch herum“.']],
    ['CRASH', 'Crash erkannt', 'Die Crash-Erkennung (Crash Recovery mit der Einstellung DISARM) hat ausgelöst.', ['Akku abziehen und wieder anstecken.', 'Kopter auf Schäden prüfen: Propeller, Motoren, Kabel.'], 1],
    ['THROTTLE', 'Gas nicht ganz unten', 'Betaflight armt nur, wenn das Gas in der untersten Stellung steht.', ['Gas-Stick ganz nach unten.', 'Im Receiver-Tab nachsehen: Der Gaswert muss unter „min_check“ liegen (Standard 1050).', 'Liegt er höher, im Sender den Gaskanal anpassen (Endpunkte, Trimmung), bis unten etwa 1000 ankommt.'], 1],
    ['ANGLE', 'Kopter zu schief', 'Der Kopter steht schräger als erlaubt (Einstellung small_angle, Standard 25 Grad).', ['Kopter waagerecht hinstellen.', 'Steht er gerade und der Hinweis bleibt: Im Setup-Tab den Beschleunigungssensor auf ebener Fläche kalibrieren.', 'Board-Ausrichtung im Configuration-Tab prüfen.'], 1],
    ['BOOTGRACE', 'Zu kurz nach dem Einschalten', 'Nach dem Einstecken wartet Betaflight ein paar Sekunden, bevor es das Armen zulässt (pwr_on_arm_grace).', ['Ein paar Sekunden warten, dann armen.']],
    ['NOPREARM', 'Prearm fehlt', 'Im Modes-Tab ist ein PREARM-Schalter eingerichtet, der vor dem Armen aktiv sein muss.', ['PREARM-Schalter einschalten, dann armen.', 'Willst du kein Prearm, den Modus im Modes-Tab entfernen.']],
    ['LOAD', 'Prozessor überlastet', 'Die Flugsteuerung ist zu stark ausgelastet.', ['PID-Loop-Frequenz im Configuration-Tab senken.', 'Nicht genutzte Funktionen abschalten.', 'In der CLI zeigt <code>status</code> die CPU-Last.'], 1],
    ['CALIB', 'Kalibrierung läuft', 'Die Sensoren werden gerade kalibriert. Das passiert nach dem Einstecken.', ['Kopter nach dem Einstecken ruhig stehen lassen und nicht bewegen.', 'Kurz warten, dann armen.']],
    ['CLI', 'CLI ist offen', 'Im Configurator ist die Kommandozeile (CLI) geöffnet. Solange sie offen ist, lässt Betaflight kein Armen zu.', ['CLI verlassen und den Configurator trennen.'], 1],
    ['CMS', 'OSD-Menü offen', 'Das Einstellungsmenü im OSD (CMS) ist geöffnet.', ['Menü verlassen, im Menü „Exit“ bzw. „Save Exit“ wählen.']],
    ['BST', 'BST', 'Steht für eine ältere Telemetrie-Verbindung (Black Sheep Telemetry). In heutigen Setups sehr selten.', ['Siehst du das, frag im Verein nach und schick die Ausgabe von <code>status</code> mit.']],
    ['MSP', 'Configurator verbunden', 'Der Betaflight Configurator ist per USB verbunden (MSP-Verbindung). Dann lässt Betaflight kein Armen zu.', ['Configurator trennen bzw. USB abziehen.', 'Motoren am PC nur im Motors-Tab testen, ohne Propeller.'], 1],
    ['PARALYZE', 'Paralyze aktiviert', 'Der Modus „PARALYZE“ wurde ausgelöst. Er sperrt das Armen bis zum Neustart.', ['Schalter für PARALYZE ausschalten.', 'Akku abziehen und wieder anstecken.']],
    ['GPS', 'GPS-Rescue nicht bereit', 'GPS-Rescue ist eingerichtet, aber der GPS-Empfang reicht noch nicht.', ['Draußen mit freiem Himmel warten, bis genug Satelliten gefunden sind.', 'Mindestzahl an Satelliten und Arming-Einstellungen für GPS-Rescue prüfen.'], 1],
    ['RESCUE_SW', 'GPS-Rescue-Schalter an', 'Der Schalter für GPS-Rescue steht beim Armen auf „an“.', ['GPS-Rescue-Schalter ausschalten, dann armen.']],
    ['RPMFILTER', 'RPM-Filter ohne Drehzahl-Daten', 'Der RPM-Filter ist an, aber die ESCs liefern keine gültigen Drehzahlen.', ['Die ESC-Firmware muss bidirektionales DShot können (z. B. Bluejay, BLHeli_32, AM32).', '„Bidirectional DShot“ einschalten und ein DShot-Protokoll wählen.', 'Motorpolzahl prüfen (Magnete in der Glocke zählen, oft 14, bei kleinen Whoop-Motoren oft 12).', 'Im Motors-Tab sollten dann Drehzahl und Fehlerrate angezeigt werden.']],
    ['REBOOT_REQD', 'Neustart nötig', 'Eine Einstellung wurde geändert, die erst nach einem Neustart wirkt.', ['Akku und USB abziehen, wieder anstecken.']],
    ['DSHOT_BBANG', 'DShot-Bitbang klappt nicht', 'DShot-Bitbang konnte nicht gestartet werden, meist wegen eines Timer-Konflikts.', ['In der CLI <code>get dshot_bitbang</code> prüfen. Standard ist AUTO.', 'Testweise <code>set dshot_bitbang = OFF</code> und <code>save</code>.', 'Bleibt es, frag im Verein mit genauer Bezeichnung deiner Flugsteuerung.']],
    ['NO_ACC_CAL', 'Beschleunigungssensor nicht kalibriert', 'Eine Funktion braucht den Beschleunigungssensor (z. B. Angle, Horizon oder GPS-Rescue), aber er ist nicht kalibriert.', ['Kopter auf eine ebene Fläche stellen.', 'Im Setup-Tab den Beschleunigungssensor kalibrieren.', 'Speichern und neu starten.']],
    ['MOTOR_PROTO', 'Kein Motorprotokoll', 'Es ist kein gültiges ESC-Protokoll eingestellt.', ['Im Motors- bzw. Configuration-Tab ein ESC-Protokoll wählen, z. B. DSHOT300 oder DSHOT600, je nach ESC.', 'Speichern und neu starten.']],
    ['ARMSWITCH', 'Arm-Schalter war beim Einstecken an', 'Der Arm-Schalter stand auf „an“, als der Kopter eingeschaltet oder der Empfänger verbunden wurde. Zur Sicherheit sperrt Betaflight.', ['Arm-Schalter auf „aus“ stellen.', 'Dann wieder auf „an“: Jetzt sollte er armen.']]
  ];
  const FLAG = {}; FLAGS.forEach(([n, t, d, s, a]) => { FLAG[n] = { n, t, d, s, a: !!a, c: n.toLowerCase().replace(/_/g, '') }; });
  const COMMON = ['RXLOSS', 'THROTTLE', 'ARMSWITCH', 'ANGLE', 'MSP', 'RUNAWAY', 'RPMFILTER', 'NO_ACC_CAL'];

  const STD = { th: 'Kopter armt nicht' };
  // Themen. kw: Stichwort:Gewicht (Synonyme, englisch, Umgangssprache). cat: Thema im Formular.
  const KB = [
    { id: 'arming', cat: 'Betaflight', t: 'Kopter armt nicht', start: () => 'arm1',
      kw: 'armt:3 armen:3 arm:2 arming:3 armed:2 scharf:2 scharfschalten:3 disarm:2 disarmed:2 disabled:1 entsperren:2 flag:1.5 flags:1.5 wont:0.5',
      i: 'Betaflight lässt das Armen nur zu, wenn alles sicher ist. Was gerade blockiert, verrät dir das Arming-Flag.',
      s: ['Flag auslesen: im OSD (im OSD-Tab das Element „Warnungen“ einschalten) oder am PC in der CLI mit <code>status</code>, Zeile „Arming disable flags“.',
        'Häufigste Gründe: Gas nicht ganz unten (THROTTLE), Arm-Schalter war beim Einstecken an (ARMSWITCH), kein Empfängersignal (RXLOSS), Kopter schief (ANGLE), Configurator per USB verbunden (MSP).',
        'Nach dem Einstecken den Kopter ruhig stehen lassen und ein paar Sekunden warten (CALIB, BOOTGRACE).',
        'Arm-Schalter im Modes-Tab prüfen: Liegt „ARM“ auf dem Schalter, den du bewegst, und landet die Markierung beim Umschalten im eingestellten Bereich?',
        'Armt er, aber die Motoren drehen nicht: Ist „Motor Stop“ eingeschaltet, laufen sie erst mit Gas an. Sonst ESC-Protokoll und Motoren prüfen.'],
      tip: 'Jedes Flag einzeln erklärt: Werkzeug „Arming-Flag nachschlagen“ direkt beim Chat.', more: ['bind', 'rxbf', 'usb'], acts: [['Flag nachschlagen', 'flagtool']] },

    { id: 'bind', cat: 'Empfänger', t: 'Empfänger bindet nicht',
      start: (q) => /\b(elrs|expresslrs|express)\b/.test(q) ? 'bind_elrs' : /\b(crossfire|tbs|crsf)\b/.test(q) ? '=bind_cf' : 'bind1',
      kw: 'bind:3 binden:3 bindet:3 binding:3 gebunden:2 koppeln:2 pairing:2 elrs:3 expresslrs:3 crossfire:3 crsf:2 tbs:2 empfaenger:2 receiver:2 rx:1.5 bindphrase:3 phrase:2 lua:1.5 funke:1 verbindet:2 verbinden:1.5 connect:1.5',
      i: 'Zuerst muss der Empfänger mit dem Sender verbunden sein, dann muss Betaflight ihn richtig auslesen.',
      s: ['<b>ExpressLRS:</b> Sender-Modul und Empfänger brauchen dieselbe Hauptversion, z. B. beide 3.x.',
        'Gleiche Bind-Phrase auf beiden (wird im ExpressLRS Configurator beim Flashen gesetzt). Ohne Bind-Phrase den Bind-Modus nutzen.',
        'Bind-Modus: Empfänger dreimal hintereinander ein- und ausstecken, bis die LED doppelt blinkt. Dann im ExpressLRS-Lua-Skript am Sender „Bind“ wählen.',
        'Regulatory Domain muss passen: Bei 2,4 GHz verbinden sich „LBT“ (EU) und „FCC/ISM“ nicht miteinander, bei 900 MHz ebenso 868 und 915 nicht.',
        'Model Match zum Testen ausschalten.',
        '<b>Crossfire:</b> Firmware von Sender-Modul und Empfänger mit TBS Agent aktualisieren, im Crossfire-Menü am Sender „Bind“ starten und den Empfänger laut Anleitung in den Bind-Modus bringen.',
        '<b>Betaflight:</b> Im Ports-Tab „Serial RX“ am UART des Empfängers einschalten, im Receiver-Tab „Serial (via UART)“ und „CRSF“ wählen. TX und RX gekreuzt verlöten.'],
      more: ['rxbf', 'failsafe'] },
    { id: 'bind_elrs_slow', sub: 1, cat: 'Empfänger', t: 'ExpressLRS: LED blinkt langsam',
      i: 'Der Empfänger hat Strom und sucht den Sender, findet ihn aber nicht.',
      s: ['Ist das ExpressLRS-Modul in der Funke aktiv? In EdgeTX als internes oder externes Modul mit „CRSF“ einstellen.',
        'Bind-Phrase auf Sender und Empfänger gleich?', 'Gleiche Hauptversion (z. B. beide 3.x)?', 'Gleiche Regulatory Domain (LBT oder FCC/ISM)?', 'Model Match testweise ausschalten.',
        'Notfalls neu binden: Empfänger dreimal ein- und ausstecken, die LED blinkt doppelt, dann am Sender „Bind“.'],
      more: ['bind'] },
    { id: 'bind_elrs_mode', sub: 1, cat: 'Empfänger', t: 'ExpressLRS: LED blinkt doppelt',
      i: 'Der Empfänger ist im Bind-Modus und wartet auf den Sender.',
      s: ['Am Sender das ExpressLRS-Lua-Skript öffnen (in EdgeTX unter „System“, „Tools“) und „Bind“ wählen.', 'Nach ein paar Sekunden leuchtet die LED dauerhaft: verbunden.', 'Klappt es nicht: Hauptversion und Regulatory Domain auf beiden Seiten prüfen.'],
      more: ['rxbf'] },
    { id: 'bind_elrs_aus', sub: 1, cat: 'Empfänger', t: 'ExpressLRS: LED bleibt aus',
      i: 'Der Empfänger bekommt vermutlich keinen Strom.',
      s: ['Mit Akku testen: Manche 5-V-Pads der Flugsteuerung sind nur mit Akku versorgt, nicht über USB.', 'Lötstellen an 5 V und GND prüfen.', 'Mit dem Multimeter die Spannung direkt am Empfänger messen.', 'Bleibt er dunkel, ist er eventuell defekt. Frag im Verein, bevor du neu kaufst.'],
      more: ['bind'] },
    { id: 'bind_cf', sub: 1, cat: 'Empfänger', t: 'Crossfire bindet nicht',
      i: 'Bei Crossfire lohnt sich zuerst ein Blick auf die Firmware.',
      s: ['Sender-Modul und Empfänger mit TBS Agent auf aktuelle Firmware bringen.', 'Im Crossfire-Menü am Sender (Lua-Skript) „Bind“ starten.', 'Empfänger laut Anleitung in den Bind-Modus bringen, meist per Taste am Empfänger.', 'In Betaflight: Ports-Tab „Serial RX“ am richtigen UART, Receiver-Tab „CRSF“.'],
      more: ['rxbf', 'bind'] },

    { id: 'rxbf', cat: 'Empfänger', t: 'Empfänger verbunden, aber Betaflight reagiert nicht',
      kw: 'balken:2.5 serialrx:3 serial:1.5 uart:2.5 ports:2 port:1 aetr:2.5 taer:2.5 channel:1 map:1.5 kanalbelegung:3 reagiert:2 reaktion:2 sticks:1.5 stick:1.5 receivertab:3',
      i: 'Die LED am Empfänger leuchtet dauerhaft, aber im Receiver-Tab bewegt sich nichts? Dann ist der Funk in Ordnung, und es hakt in Betaflight oder an der Verkabelung.',
      s: ['Ports-Tab: „Serial RX“ genau an dem UART einschalten, an dem der Empfänger angelötet ist. Speichern.', 'Receiver-Tab: Empfänger-Modus „Serial (via UART)“, Protokoll „CRSF“ für ExpressLRS und Crossfire. Speichern.', 'Verkabelung gekreuzt: TX vom Empfänger an RX der Flugsteuerung, RX an TX.', 'Bewegen sich die Balken, aber vertauscht: Kanalbelegung (Channel Map) prüfen, bei ExpressLRS und Crossfire meist „AETR1234“.'],
      more: ['bind', 'arming'] },

    { id: 'bild', cat: 'Videosystem', t: 'Kein Bild in der Brille',
      start: (q) => /\b(dji|walksnail|avatar|hdzero|digital|o3|o4)\b/.test(q) ? '=bild_digital' : /\banalog\b/.test(q) ? 'bild_a' : /\b(schnee|rauschen|snow|static)\b/.test(q) ? '=bild_schnee' : 'bild1',
      kw: 'bild:3 video:3 videobild:3 schnee:3 rauschen:3 snow:3 static:2 schwarz:2 black:2 screen:1 flackert:1.5 brille:1 goggles:1 empfang:1 videosignal:3 kamera:1.5 camera:1.5 cam:1 dji:1.5 o3:1.5 o4:1.5 walksnail:1.5 hdzero:1.5',
      i: 'Erst prüfen wir die einfachen Dinge, dann das Videosystem.',
      w: 'Einen Videosender nie ohne Antenne einschalten. Er kann dabei kaputtgehen.',
      s: ['<b>Analog:</b> Band und Kanal an Brille und VTX gleich einstellen, z. B. R4. Viele Brillen haben einen Suchlauf.', 'Pit-Modus aus? Im Pit-Modus sendet der VTX kaum, das Bild kommt nur ganz nah oder gar nicht.', 'VTX-Tabelle in Betaflight geladen? Ohne passende Tabelle stimmen Kanäle und Leistung nicht.', 'Nur Schnee heißt: Brille und VTX finden sich nicht. Schwarz oder grau mit OSD-Schrift heißt: Die Kamera liefert kein Bild.', '<b>Digital:</b> Bei DJI und Walksnail müssen Brille und Air Unit gebunden sein, HDZero braucht nur denselben Kanal. Firmware beider Geräte auf einen zueinander passenden Stand bringen.', 'Digitale Sender mit angestecktem Akku testen, nicht nur über USB.'],
      more: ['kompat', 'kanaele', 'vtx'] },
    { id: 'bild_schnee', sub: 1, cat: 'Videosystem', t: 'Nur Schnee oder Rauschen',
      i: 'Die Brille empfängt nichts Brauchbares. Brille und VTX finden sich nicht.',
      w: 'Erst die Antenne prüfen. Ohne Antenne kann der VTX kaputtgehen.',
      s: ['Antenne fest am VTX? Kabel oder Stecker nach einem Crash beschädigt?', 'Band und Kanal an Brille und VTX gleich? Suchlauf der Brille nutzen.', 'Hat der VTX Strom? Die meisten VTX haben eine LED.', 'Pit-Modus ausschalten (OSD-Menü, Lua-Skript oder Video-Transmitter-Tab).', 'VTX-Tabelle passend zum VTX laden, sonst stimmt der eingestellte Kanal nicht mit dem gesendeten überein.'],
      more: ['vtx', 'kanaele'] },
    { id: 'bild_kamera', sub: 1, cat: 'Videosystem', t: 'Schwarz oder grau, aber OSD-Schrift da',
      i: 'Das OSD kommt von der Flugsteuerung. Der Weg zum VTX funktioniert also, nur das Kamerabild fehlt.',
      s: ['Kamerakabel prüfen: Video, Plus und Minus fest und richtig an CAM bzw. VIN der Flugsteuerung.', 'Bekommt die Kamera die richtige Spannung? Datenblatt der Kamera ansehen.', 'Die kleinen Stecker am Kamerakabel lockern sich gern, besonders nach Crashs.', 'Mit einer anderen Kamera gegenprüfen.'],
      more: ['osd'] },
    { id: 'bild_stoer', sub: 1, cat: 'Videosystem', t: 'Bild flackert oder bricht ein',
      i: 'Störungen im analogen Bild haben meist mit Antenne, Strom oder Kanal zu tun.',
      s: ['Antenne prüfen: Kabel geknickt, Stecker locker, Antenne verbogen?', 'Störungen durch die Motoren: Ein Low-ESR-Kondensator an den Akku-Pads des ESC hilft oft.', 'Der VTX wird am Boden schnell heiß. Bei Tests nicht lange mit hoher Leistung stehen lassen.', 'Kanal frei? In der Halle Kanäle absprechen, sonst überlagern sich die Bilder.'],
      more: ['kanaele', 'failsafe'] },
    { id: 'bild_digital', sub: 1, cat: 'Videosystem', t: 'Kein Bild bei DJI, Walksnail oder HDZero',
      i: 'Bei digitalen Systemen hängt fast alles an Bindung, Firmware und Strom.',
      w: 'Auch digitale Sender nie ohne Antenne einschalten.',
      s: ['<b>DJI und Walksnail:</b> Brille und Air Unit nach Anleitung des Herstellers binden (Bind-Taste an beiden Geräten).', '<b>HDZero:</b> Es wird nicht gebunden. Brille bzw. VRX und VTX auf denselben Kanal stellen.', 'Firmware von Brille und Air Unit auf einen zueinander passenden Stand bringen.', 'Mit angestecktem Akku testen, nicht nur über USB.', 'Passt das System überhaupt? DJI, Walksnail und HDZero verstehen sich nicht untereinander.'],
      more: ['kompat', 'osd_digital'], acts: [['Kompatibilität prüfen', 'check']] },

    { id: 'osd', cat: 'Videosystem', t: 'Kein OSD',
      start: (q) => /\b(dji|walksnail|avatar|hdzero|digital|o3|o4|displayport|canvas)\b/.test(q) ? '=osd_digital' : /\b(smartaudio|smart|tramp)\b/.test(q) ? '=osd_direkt' : /\banalog\b/.test(q) ? 'osd_a' : 'osd1',
      kw: 'osd:4 einblendung:2 einblendungen:2 anzeige:1 overlay:2 displayport:3 canvas:3 schrift:1 font:1.5 werte:1 spannungsanzeige:3 dji:1.5 o3:1.5 o4:1.5 walksnail:1.5 hdzero:1.5',
      i: 'Wie das OSD ins Bild kommt, hängt vom Videosystem ab.',
      s: ['<b>Analog:</b> Das Betaflight-OSD entsteht in der Flugsteuerung. Das Kamerabild muss deshalb durch die Flugsteuerung laufen: Kamera an CAM bzw. VIN, vom Pad VTX bzw. VOUT weiter zum VTX.', 'SmartAudio oder Tramp ist nur die Steuerleitung für Kanal und Leistung. Sie trägt kein Bild und kein OSD.', 'Im Configuration-Tab die Funktion OSD einschalten, im OSD-Tab Elemente einschalten und das Videoformat wählen.', 'Manche Flugsteuerungen für Digitalsysteme haben keinen analogen OSD-Chip. Datenblatt prüfen.', '<b>Digital:</b> Das OSD läuft über MSP DisplayPort. Mehr dazu unter „Kein OSD bei Digital“.'],
      more: ['osd_direkt', 'osd_digital', 'vtx'] },
    { id: 'osd_direkt', sub: 1, cat: 'Videosystem', t: 'Kamera hängt direkt am VTX',
      i: 'Diese Frage kam neulich in unserem Vereinschat: SmartAudio verkabelt, aber kein OSD. Eine häufige Ursache: Das Videosignal läuft an der Flugsteuerung vorbei. Dann kann sie nichts einblenden.',
      s: ['Videokabel der Kamera an CAM bzw. VIN der Flugsteuerung.', 'Vom Pad VTX bzw. VOUT der Flugsteuerung ein Kabel zum Video-Eingang des VTX.', 'SmartAudio bleibt an seinem Pad. Es steuert nur Kanal und Leistung.', 'Masse (GND) gemeinsam für Kamera, Flugsteuerung und VTX.', 'Danach im Configuration-Tab OSD einschalten und im OSD-Tab Elemente aktivieren.'],
      tip: 'Schneller Test ohne Lötkolben: Verschieb im OSD-Tab ein Element und speichere. Ändert sich im Bild nichts, läuft das Video nicht durch die Flugsteuerung.',
      more: ['osd_analog', 'vtx'] },
    { id: 'osd_analog', sub: 1, cat: 'Videosystem', t: 'Kamera läuft über die Flugsteuerung, trotzdem kein OSD',
      i: 'Dann liegt es meist an einer Einstellung.',
      s: ['Configuration-Tab: Funktion OSD eingeschaltet?', 'OSD-Tab: Elemente eingeschaltet und auf dem Bild platziert?', 'Videoformat auf Auto, PAL oder NTSC passend zur Kamera.', 'Hat die Flugsteuerung einen analogen OSD-Chip? Datenblatt prüfen.', 'Nur Zeichensalat im Bild: im OSD-Tab die Schriftart (Font) neu hochladen.', 'Nach Änderungen speichern und neu starten.'],
      more: ['osd_direkt'] },
    { id: 'osd_digital', sub: 1, cat: 'Videosystem', t: 'Kein OSD bei DJI, Walksnail oder HDZero',
      i: 'Digitale Systeme bekommen das OSD als Daten über MSP DisplayPort.',
      s: ['Air Unit mit TX und RX an einen freien UART der Flugsteuerung, gekreuzt.', 'Im Ports-Tab an diesem UART „MSP“ einschalten. Speichern.', 'Im OSD-Tab als Videoformat „HD“ wählen.', 'Bei älteren Betaflight-Versionen in der CLI: <code>set osd_displayport_device = MSP</code> und <code>set displayport_msp_serial = </code> UART-Nummer minus 1, dann <code>save</code>.', 'Bei DJI in der Brille das eigene OSD einschalten, je nach Firmware „Canvas“ bzw. „Custom OSD“.'],
      more: ['bild_digital'] },

    { id: 'vtx', cat: 'Videosystem', t: 'VTX lässt sich nicht steuern',
      kw: 'vtx:3 videosender:3 smartaudio:3 tramp:3 vtxtabelle:3 vtxtable:3 tabelle:2 table:1.5 leistung:1.5 power:1 pitmode:2.5 pit:2 steuern:2 umstellen:1.5 wechseln:1 kanalwechsel:2',
      i: 'Kanal oder Leistung lassen sich über OSD-Menü, Lua-Skript oder Betaflight nicht ändern?',
      s: ['Steuerleitung: SmartAudio (z. B. TBS und viele andere) bzw. Tramp (z. B. ImmersionRC) an ein TX-Pad der Flugsteuerung.', 'Im Ports-Tab an genau diesem UART unter „Peripherals“ „VTX (TBS SmartAudio)“ bzw. „VTX (IRC Tramp)“ wählen. Speichern.', 'Im Video-Transmitter-Tab die VTX-Tabelle laden, die zu deinem VTX passt: Datei vom Hersteller oder passende Vorlage aus dem Presets-Tab.', 'Mit angestecktem Akku testen. Über USB allein bekommt der VTX meist keinen Strom.', 'Im Video-Transmitter-Tab muss „Device ready“ bzw. „Gerät bereit“ auf Ja stehen. Sonst Leitung, UART und Protokoll prüfen.', 'Manche Kombinationen brauchen ein bestimmtes Pad. Anleitungen von VTX und Flugsteuerung beachten.'],
      more: ['osd', 'kanaele'] },

    { id: 'motor', cat: 'Betaflight', t: 'Motoren drehen falsch herum oder Kopter flippt',
      start: (q) => /\b(flippt|flip|flipt|ueberschlaegt|ueberschlag|kippt)\b/.test(q) ? '=motor_flip' : /\b(ruckelt|stottert|desync)\b/.test(q) ? '=motor_tot' : /(falsch|verkehrt|andersrum|richtung|direction|reversed)/.test(q) ? '=motor_dir' : 'mot1',
      kw: 'flippt:3 flip:2.5 ueberschlaegt:3 kippt:2 falsch:1.5 falschrum:3 verkehrt:2.5 andersrum:2.5 herum:1 drehrichtung:3 richtung:2 direction:2.5 reversed:2 propsout:3 propeller:1.5 props:1.5 reihenfolge:2.5 motorreihenfolge:3 order:2 abheben:1.5 motoren:1.5 motor:1.5 spinning:1 dreht:1 drehen:1 ruckelt:2 stottert:2',
      i: 'Wenn der Kopter beim ersten Gasgeben flippt, stimmt fast immer eins von vier Dingen nicht: Reihenfolge, Drehrichtung, Propeller oder Board-Ausrichtung.',
      w: 'Motoren nur ohne Propeller testen!',
      s: ['Im Motors-Tab den Sicherheitshinweis bestätigen, dann jeden Motor einzeln kurz andrehen.', 'Reihenfolge bei Quad X in Betaflight: 1 hinten rechts, 2 vorne rechts, 3 hinten links, 4 vorne links. Das Bild im Motors-Tab zeigt es.', 'Drehrichtung Standard („Props in“): 1 und 4 im Uhrzeigersinn, 2 und 3 gegen den Uhrzeigersinn, von oben gesehen. Mit „Motor direction is reversed“ („Props out“) genau andersherum.', 'Richtung ändern: im Motors-Tab über die Einstellung der Motor-Richtung (bei DShot), mit dem ESC-Konfigurator oder durch Tauschen von zwei der drei Motorkabel.', 'Reihenfolge falsch: im Motors-Tab neu zuordnen oder per Resource umstellen.', 'Propeller richtig herum: Die Vorderkante zeigt in Drehrichtung, passend zu „Props in“ oder „Props out“.', 'Board-Ausrichtung: Das 3D-Modell im Setup-Tab muss sich genau wie der Kopter bewegen.'],
      more: ['vib'] },
    { id: 'motor_flip', sub: 1, cat: 'Betaflight', t: 'Kopter flippt beim Abheben',
      i: 'Gleich beim Abheben überschlagen heißt: Betaflight regelt in die falsche Richtung. Das hat fast immer eine dieser vier Ursachen.',
      w: 'Ohne Propeller prüfen!',
      s: ['Motor-Reihenfolge im Motors-Tab: 1 hinten rechts, 2 vorne rechts, 3 hinten links, 4 vorne links.', 'Drehrichtung: Props in heißt 1 und 4 im Uhrzeigersinn, 2 und 3 dagegen. Props out genau andersherum.', 'Propeller auf den richtigen Motoren und richtig herum.', 'Board-Ausrichtung: Kippst du den Kopter, muss das 3D-Modell im Setup-Tab genauso kippen.'],
      more: ['motor_dir', 'motor'] },
    { id: 'motor_dir', sub: 1, cat: 'Betaflight', t: 'Ein Motor dreht falsch herum',
      w: 'Ohne Propeller testen!',
      i: 'Die Drehrichtung lässt sich ohne Löten ändern.',
      s: ['Soll-Richtung bei „Props in“: 1 (hinten rechts) und 4 (vorne links) im Uhrzeigersinn, 2 und 3 gegen den Uhrzeigersinn. Bei „Props out“ andersherum.', 'Bei DShot: im Motors-Tab die Motor-Richtung einzeln umstellen.', 'Oder mit dem ESC-Konfigurator (je nach ESC-Firmware) die Richtung umkehren.', 'Oder zwei der drei Motorkabel tauschen.'],
      more: ['motor_flip'] },
    { id: 'motor_tot', sub: 1, cat: 'Betaflight', t: 'Motor dreht nicht oder ruckelt',
      w: 'Ohne Propeller testen!',
      s: ['Motor von Hand drehen: Schleift oder knirscht es, ist das Lager hin oder Dreck drin.', 'Motorschrauben zu lang? Sie können die Wicklung berühren.', 'Lötstellen der drei Motorkabel am ESC prüfen, auch auf Brücken zwischen den Pads.', 'Im Motors-Tab einzeln testen. Motor mit einem anderen Platz tauschen: Wandert der Fehler mit, ist es der Motor, sonst der ESC.', 'Riecht es verbrannt oder ist ein Bauteil am ESC dunkel, nicht weiter testen.'],
      more: ['vib', 'loeten'] },

    { id: 'vib', cat: 'Betaflight', t: 'Vibrationen, Jello, heiße Motoren',
      kw: 'vibration:3 vibrationen:3 vibrations:3 vibriert:3 zittern:2 zittert:2 jello:3 wackelt:2 oszillation:3 oscillation:3 oszilliert:3 propwash:3 heiss:2.5 hot:2 warm:1 filter:2 rpm:2 rpmfilter:3 bidirektional:3 bidirectional:3 blackbox:2 pid:2 pids:2 tune:2 tuning:2 unruhig:2 brummen:2 schwingt:2',
      i: 'Erst die Mechanik, dann die Software. Viele Probleme verschwinden mit einem neuen Propeller.',
      s: ['Propeller: kleinste Kerben oder Verformungen reichen. Im Zweifel tauschen.', 'Schrauben: Motoren, Rahmen und Stack fest. Motorschrauben nicht zu lang. Gummidämpfer am Stack nicht zu fest anziehen.', 'Lager und Wellen: Motor von Hand drehen, Glocke auf Spiel prüfen, Welle auf Verbiegung.', 'Jello im Video kommt oft von der Kamerahalterung: weich lagern, nichts darf schwingen. Kabel und Antennen dürfen nicht in die Propeller ragen.', 'RPM-Filter einschalten: braucht bidirektionales DShot, ESC-Firmware, die das kann (z. B. Bluejay, BLHeli_32, AM32), und die richtige Motorpolzahl.', 'Heiße Motoren nach kurzem Flug: Filter oder D-Werte passen nicht. Erst Mechanik prüfen, dann mit Blackbox-Log einstellen statt nach Gefühl.'],
      w: 'Nach Änderungen an Filtern nur kurz fliegen und die Motortemperatur prüfen. Sehr heiße Motoren nicht anfassen.',
      more: ['motor', 'flag_RPMFILTER'] },

    { id: 'failsafe', cat: 'Empfänger', t: 'Failsafe im Flug',
      kw: 'failsafe:3.5 signalverlust:3 signal:1.5 verbindungsabbruch:3 abgestuerzt:1.5 runtergefallen:2.5 faellt:2 fiel:2 reichweite:3 range:2 lq:2 rssi:2.5 antenne:1.5 antennen:1.5 telemetrie:1.5 flug:0.8 abbruch:2',
      i: 'Failsafe heißt: Der Empfänger hat das Signal verloren und Betaflight hat übernommen.',
      s: ['Reichweite und Hindernisse: Hinter Häusern, Bäumen oder Hallenwänden bricht das Signal zuerst ein. LQ und RSSI im OSD anzeigen lassen.', 'Empfänger-Antennen: frei, nicht hinter Carbon oder Akku, nicht geknickt, nicht parallel zu Stromkabeln. Bei zwei Antennen im Winkel von 90 Grad.', 'Sender-Antenne: Die Spitze einer Stabantenne strahlt am schwächsten. Nicht mit der Spitze auf den Kopter zielen.', 'Leistung und Paketrate: Höhere Sendeleistung oder niedrigere Paketrate bringen mehr Reichweite. Erlaubte Leistung beachten.', 'Stromversorgung: Wackelige Lötstellen oder Spannungseinbrüche lassen den Empfänger neu starten. Lötstellen prüfen.', 'Failsafe-Tab in Betaflight: Standard ist „Drop“ (Motoren aus). Ohne Propeller testen: Sender ausschalten, die Motoren müssen stoppen.'],
      more: ['bind', 'beeper'] },

    { id: 'turtle', cat: 'Betaflight', t: 'Turtle-Mode: Kopter umdrehen',
      kw: 'turtle:4 turtlemode:4 schildkroete:3 crashflip:4 umdrehen:3 ruecken:3 kopfueber:3 upside:3 umgedreht:2 umgefallen:2',
      i: 'Liegt der Kopter nach einem Crash auf dem Rücken, kann er sich mit den Motoren selbst umdrehen.',
      s: ['Braucht ein DShot-Protokoll für die ESCs.', 'Im Modes-Tab „FLIP OVER AFTER CRASH“ (je nach Version „Crash Flip“) auf einen Schalter legen.', 'Kopter liegt auf dem Rücken: Turtle-Schalter an, dann armen. Mit dem Roll- oder Nick-Stick in die Richtung drücken, in die er sich drehen soll.', 'Liegt er richtig herum: disarmen, Turtle-Schalter aus, neu armen und weiterfliegen.', 'Nicht mit Gewalt: Hängt ein Propeller im Gras oder Netz fest, lieber hingehen. Sonst leiden Motoren und ESC.'],
      more: ['beeper'] },

    { id: 'beeper', cat: 'Betaflight', t: 'Beeper: Kopter wiederfinden',
      kw: 'beeper:4 buzzer:4 piepser:3 piept:3 piepen:3 beep:3 finden:2 wiederfinden:3 verloren:3 lost:2 vermisst:2 suchen:2 beacon:3 weg:1',
      i: 'Ein piepender Kopter ist im hohen Gras viel schneller gefunden.',
      s: ['Im Modes-Tab „BEEPER“ auf einen Schalter legen. So lässt du den Kopter piepen, solange der Empfänger noch Verbindung hat.', 'Ohne eingebauten Buzzer: DShot-Beacon im Configuration-Tab einschalten. Dann piepen die Motoren über den ESC.', 'In den Beeper-Einstellungen im Configuration-Tab festlegen, dass er bei Signalverlust automatisch piept.', 'Ein eigener Buzzer mit eigenem Akku piept auch dann weiter, wenn der Flugakku beim Crash herausfliegt.', 'Beim Suchen hilft die Aufnahme der Brille (DVR): Wo ging es zuletzt hin?'],
      more: ['failsafe', 'turtle'] },

    { id: 'akku', cat: 'Akku', t: 'LiPo laden, lagern, entsorgen',
      kw: 'akku:3 akkus:3 lipo:4 lipos:4 battery:3 batterie:3 laden:2.5 aufladen:2.5 ladegeraet:3 charger:3 lagern:3 lagerspannung:4 storage:3 aufgeblaeht:4 aufgeblasen:3 dick:1.5 puffy:3 swollen:3 entsorgen:3 balancer:3 zelle:2 zellen:2 spannung:1.5 voltage:1.5 lihv:3',
      i: 'LiPos sind sicher, wenn man ein paar Regeln einhält.',
      s: ['Nur mit Balance-Ladegerät laden, nie unbeaufsichtigt, auf nicht brennbarer Unterlage oder im LiPo-Sack.', 'Ladestrom: 1C ist die sichere Faustregel, bei 1300 mAh also 1,3 A. Mehr nur, wenn der Hersteller es ausdrücklich erlaubt.', 'Voll: 4,20 V pro Zelle (LiHV: 4,35 V). Landen, wenn die Spannung unter Last bei etwa 3,5 V pro Zelle liegt.', 'Lagern: Fliegst du ein paar Tage nicht, mit der Storage-Funktion des Ladegeräts auf etwa 3,8 V pro Zelle bringen.', 'Nach dem Flug erst abkühlen lassen, dann laden.', 'Aufgebläht, beschädigt oder heiß nach dem Laden: nicht mehr laden, nicht mehr fliegen, feuerfest lagern.', 'Entsorgen: möglichst entladen, Pole abkleben und bei einer Sammelstelle abgeben, etwa am Wertstoffhof oder über die Rücknahme im Handel.'],
      w: 'Raucht oder bläht sich ein Akku beim Laden auf: Stecker ziehen, wenn das gefahrlos geht, Abstand halten, im Notfall 112.',
      more: ['loeten'] },

    { id: 'kompat', cat: 'Videosystem', t: 'Welche Brille passt zu welchem Sender?',
      kw: 'kompatibel:4 kompatibilitaet:4 passt:2.5 zusammen:1.5 compatible:4 dji:2.5 o3:3 o4:3 walksnail:3 avatar:2 hdzero:3 integra:3 goggles:2 n3:2 vrx:2 airunit:3 air:1 unit:1 vista:2 analog:1.5 digital:1.5 brille:1.5 system:1.5 videosystem:2.5',
      i: 'Kurz gesagt: Analog passt zu Analog, und jedes Digitalsystem nur zu sich selbst.',
      s: ['<b>Analog</b> ist offen: Jede analoge Brille empfängt jeden analogen 5,8-GHz-Sender.', '<b>DJI</b> (O3, O4) läuft nur mit DJI-Brillen wie Goggles 2, Integra, Goggles 3 oder Goggles N3. Welche Kombination geht, hängt von Modell und Firmware ab: Liste des Herstellers prüfen.', '<b>Walksnail</b> Avatar läuft mit Walksnail-Brillen oder dem Walksnail-VRX.', '<b>HDZero</b> läuft mit der HDZero-Brille oder dem HDZero-VRX.', 'Die digitalen Systeme verstehen sich nicht untereinander.'],
      more: ['faq_system'], acts: [['Kompatibilitäts-Check öffnen', 'check']] },

    { id: 'kanaele', cat: 'Videosystem', t: 'Analoge Kanäle auf 5,8 GHz', viz: 'band',
      kw: 'kanal:3 kanaele:3 channel:3 channels:3 frequenz:3 frequenzen:3 raceband:4 band:2 mhz:3 r1:3 r2:3 r3:2 r4:2 r5:2 r6:2 r7:3 r8:3 mw:2 erlaubt:2 legal:2 bundesnetzagentur:3 bnetza:3 ghz:1.5',
      i: 'Raceband hat acht Kanäle mit je 37 MHz Abstand. Deshalb fliegen mehrere Piloten gern gleichzeitig darauf.',
      s: ['In Deutschland ist für solche Funkanwendungen ohne Amateurfunk-Lizenz der Bereich 5725 bis 5875 MHz mit höchstens 25 mW (EIRP) freigegeben.', 'Damit liegen R3 bis R6 im Bereich. R1 (5658), R2 (5695) und R8 (5917) liegen außerhalb, R7 (5880) knapp darüber.', 'VTX auf 25 mW stellen und nur Kanäle im erlaubten Bereich nutzen.', 'In der Halle: Kanäle absprechen, damit sich niemand gegenseitig stört.'],
      n: 'Ohne Gewähr. Maßgeblich sind die Vorgaben der Bundesnetzagentur.',
      more: ['vtx', 'bild'] },

    { id: 'kalib', cat: 'Betaflight', t: 'Sensoren kalibrieren',
      kw: 'kalibrieren:3 kalibrierung:3 kalibriert:3 calibrate:3 calibration:3 accelerometer:3 acc:2 beschleunigungssensor:3 horizont:2 schief:2 driftet:2.5 drift:2 gyro:2',
      i: 'Den Gyro kalibriert Betaflight bei jedem Einstecken selbst. Den Beschleunigungssensor kalibrierst du einmal von Hand.',
      s: ['Kopter nach dem Einstecken ein paar Sekunden ruhig stehen lassen. Dann kalibriert sich der Gyro.', 'Beschleunigungssensor: Kopter auf eine ebene Fläche stellen und im Setup-Tab die Kalibrierung starten (englisch „Calibrate Accelerometer“).', 'Driftet der Kopter im Angle-Modus trotzdem, die Board-Ausrichtung im Configuration-Tab prüfen und neu kalibrieren.', 'Steht der künstliche Horizont im OSD schief: ebenfalls neu kalibrieren.'],
      more: ['flag_NO_ACC_CAL', 'flag_ANGLE'] },

    { id: 'usb', cat: 'Betaflight', t: 'Configurator erkennt die Flugsteuerung nicht',
      kw: 'usb:3 configurator:2 erkennt:2.5 erkannt:2.5 comport:3 com:1.5 treiber:3 driver:3 dfu:3 flashen:3 flash:2.5 firmware:2 update:2 bootloader:3 boot:2 webapp:2 browser:1 verbindung:1',
      i: 'Meist liegt es am Kabel oder am Treiber.',
      s: ['Anderes USB-Kabel probieren. Viele Kabel laden nur und übertragen keine Daten.', 'Unter Windows fehlt oft der Treiber. Für den Flash-Modus (DFU) helfen Werkzeuge wie ImpulseRC Driver Fixer oder Zadig.', 'Nur ein Programm gleichzeitig: Ist der Configurator doppelt offen, oder hält ein anderes Programm den Port fest?', 'Zum Flashen: Boot-Taste gedrückt halten, USB einstecken, loslassen. Dann erscheint „DFU“ als Port.', 'Die Web-Version des Configurators läuft in Chrome oder Edge. Der Browser fragt nach der Freigabe für den USB-Port.', 'Vor jedem Flashen die Einstellungen sichern: in der CLI <code>diff all</code> ausgeben und speichern.'],
      more: ['arming'] },

    { id: 'loeten', cat: 'Löten/Bauen', t: 'Löten lernen',
      kw: 'loeten:4 loetet:3 loetstelle:3 loetstellen:3 loetkolben:3 loetstation:3 solder:3 soldering:3 zinn:2 flussmittel:3 flux:3 pads:2 pad:2 abgerissen:2 kalte:1.5 bauen:2 build:2 selbstbau:3 rauchstopper:3 smokestopper:3 kurzschluss:2.5',
      i: 'Löten lernt jeder. Wichtig sind gutes Werkzeug und ein bisschen Übung.',
      s: ['Eine Lötstation mit Temperaturregelung und eine saubere, verzinnte Spitze machen vieles leichter.', 'Flussmittel benutzen. Pads und Kabelenden vorher verzinnen, dann nur kurz zusammen erhitzen.', 'Eine gute Lötstelle glänzt und läuft sauber ins Pad. Matte oder kugelige Stellen nachlöten.', 'Erst üben: an alten Kabeln oder einer Lochrasterplatine.', 'Vor dem ersten Akku mit dem Multimeter auf Kurzschluss prüfen und einen Rauchstopper (Smoke Stopper) dazwischenstecken.', 'Gut lüften und die Dämpfe nicht einatmen.'],
      more: ['faq_erster'] },

    { id: 'sim', cat: 'Sonstiges', t: 'Welcher Simulator?',
      kw: 'simulator:4 sim:3 simulieren:3 liftoff:3 velocidrone:3 uncrashed:3 drl:2 ueben:2 training:2 trainieren:2 anfaenger:1.5 acro:2 lernen:1',
      i: 'Es gibt mehrere FPV-Simulatoren für den PC, zum Beispiel Liftoff, VelociDrone, Uncrashed oder DRL Simulator. Welcher dir liegt, ist Geschmackssache.',
      s: ['Mit deiner eigenen Funke üben. Die meisten Funken lassen sich per USB als Joystick anschließen.', 'Gleich im Acro-Modus üben, also ohne Selbststabilisierung.', 'Wer im Simulator sicher seine Runden dreht, ist beim ersten echten Flug deutlich entspannter.'],
      more: ['faq_erster'] },

    { id: 'recht', cat: 'Recht/Spots', t: 'Was muss ich rechtlich beachten?',
      kw: 'recht:3 rechtlich:3 gesetz:3 erlaubt:1 legal:1.5 versicherung:4 haftpflicht:4 registrieren:3 registrierung:3 lba:3 eid:3 kompetenznachweis:4 fuehrerschein:3 drohnenfuehrerschein:4 beobachter:3 spotter:3 dipul:3 flugverbot:3 luftraum:3 darf:1.5 regeln:1.5',
      i: 'Kurz und ohne Gewähr, für das Fliegen draußen:',
      s: ['Für jede Drohne braucht es in Deutschland eine Haftpflichtversicherung.', 'Wer mit Kamera fliegt, muss sich in der Regel beim Luftfahrt-Bundesamt als Betreiber registrieren und die e-ID am Kopter anbringen.', 'Ab 250 g Abfluggewicht braucht es zusätzlich mindestens den EU-Kompetenznachweis A1/A3.', 'Wer draußen mit Brille fliegt, braucht einen Beobachter, der den Kopter direkt im Blick hat.', 'Wo du fliegen darfst, zeigt die Karte der Digitalen Plattform Unbemannte Luftfahrt (dipul). Unsere Spots und Regeln stehen auf der <a href="spots.html">Spot-Karte</a>.'],
      n: 'Ohne Gewähr. Maßgeblich sind die aktuellen Vorgaben des Luftfahrt-Bundesamts.',
      more: ['kanaele'] },

    { id: 'halle', cat: 'Sonstiges', t: 'Hallenfliegen',
      kw: 'halle:3 hallenfliegen:4 hallenabend:3 indoor:3 whoop:3 whoops:3 tinywhoop:3 termin:2 termine:2 wann:1 eiweiler:3 holz:2',
      i: 'Im Winter fliegen wir mit Tiny Whoops in der Halle.',
      s: ['Mitbringen: Whoop mit Propellerschutz, Brille, Funke, mehrere Akkus und Ladegerät.', 'Bei analogem Video den Kanal vor Ort absprechen.', 'Termine, Hallen und Anfahrt stehen auf der Seite <a href="hallenfliegen.html">Hallenfliegen</a>.'],
      more: ['faq_halle', 'kanaele'] },

    { id: 'faq_brille', cat: 'Videosystem', t: 'Welche Brille für den Anfang?', faq: 'faq-brille',
      kw: 'welche:1 anfang:2 anfaenger:2 einsteiger:2 kaufen:1.5 brille:2 goggle:1.5 brillentraeger:3 ipd:3 augenabstand:3',
      i: 'Zuerst das Videosystem, dann der Sitz. Mehr dazu steht im Vereinswissen.' },
    { id: 'faq_system', cat: 'Videosystem', t: 'Analog oder digital?', faq: 'faq-system',
      kw: 'analog:2 digital:2 oder:0.3 umsteigen:2 latenz:2 latency:2',
      i: 'Beides hat Vor- und Nachteile. Die kurze Übersicht steht im Vereinswissen.' },
    { id: 'faq_erster', cat: 'Löten/Bauen', t: 'Erster Kopter: kaufen oder selbst bauen?', faq: 'faq-erster',
      kw: 'erster:2 ersten:2 kopter:0.6 rtf:3 bnf:3 pnp:3 fertig:1.5 selbst:1.5 einstieg:2 kaufen:1.5',
      i: 'RTF, BNF, PNP oder Selbstbau: Was die Begriffe heißen, steht im Vereinswissen.' },
    { id: 'faq_halle', cat: 'Sonstiges', t: 'Was brauche ich fürs Hallenfliegen?', faq: 'faq-halle',
      kw: 'mitbringen:3 brauche:1.5 ausruestung:2',
      i: 'Die Liste zum Mitbringen steht im Vereinswissen.' },

    { id: 'mitglied', cat: 'Sonstiges', t: 'Mitglied werden', kw: 'mitglied:3 mitgliedschaft:3 beitrag:3 beitreten:3 verein:1.5 kosten:1.5 whatsapp:2 gruppe:1.5',
      i: 'Vereinsmitglieder sind in der WhatsApp-Gruppe „Technischer Support“ dabei.', s: [], more: [], acts: [['Zum Mitgliedsantrag', 'link', 'mitglied.html']] },
    { id: 'hallo', small: 1, t: 'Hallo', kw: 'hallo:3 hi:3 hey:3 moin:3 servus:3 gruezi:3 tag:1 hello:3',
      i: 'Hallo! Beschreib kurz, was nicht klappt, oder wähl ein Thema.' },
    { id: 'danke', small: 1, t: 'Danke', kw: 'danke:3 dank:2 merci:3 thanks:3 thx:3 super:1.5 top:1.5 klasse:1.5 cool:1.5',
      i: 'Gern geschehen. Guten Flug! Wenn noch etwas ist, frag einfach.' },
    { id: 'themen', small: 1, t: 'Was der Doktor kann', kw: 'themen:3 thema:2 kannst:3 koennen:1.5 hilfe:1.5 help:2 menue:2 menu:2 liste:2 uebersicht:2',
      i: 'Ich kenne mich mit diesen Themen aus. Tipp auf eins oder beschreib dein Problem.' }
  ];
  const BY = {}; KB.forEach(e => { BY[e.id] = e; });
  FLAGS.forEach(([n]) => { const f = FLAG[n]; BY['flag_' + n] = { id: 'flag_' + n, cat: 'Betaflight', t: 'Arming-Flag ' + n, flag: f, i: f.d, s: f.s, sub: 1, more: ['arming'], acts: [['Anderes Flag nachschlagen', 'flagtool']] }; });
  const MAIN = ['arming', 'bild', 'osd', 'bind', 'motor', 'akku'];
  const TOPICS = ['arming', 'bind', 'rxbf', 'bild', 'osd', 'vtx', 'motor', 'vib', 'failsafe', 'turtle', 'beeper', 'akku', 'kompat', 'kanaele', 'kalib', 'usb', 'loeten', 'sim', 'recht', 'halle'];

  // Geführte Diagnosen: t = Frage, o = [Antwort, Ziel]. Ziel: Knoten, „=id“ zeigt ein Thema, „!akt“ eine Aktion
  const TREE = {
    arm1: { t: 'Ich helfe dir, den Grund zu finden. Zeigt dein OSD beim Armen einen Hinweis, oder kannst du den Kopter an den PC hängen?', o: [['Ich sehe ein Flag', 'arm_flag'], ['Ich hänge am PC', 'arm_pc'], ['Kein OSD, kein PC', 'arm2'], ['Alle Ursachen zeigen', '=arming']] },
    arm_pc: { t: 'Gib in der CLI <code>status</code> ein. Die Zeile „Arming disable flags“ nennt den Grund. Solange der Configurator verbunden ist, stehen dort auch MSP und CLI. Die beiden kannst du übergehen.', o: [['Flag auswählen', 'arm_flag'], ['Flag nachschlagen', '!flagtool']] },
    arm_flag: { t: 'Welches Flag siehst du? Tipp es unten ein oder wähl es hier aus:', o: COMMON.map(n => [n, '=flag_' + n]).concat([['Anderes Flag', '!flagtool']]) },
    arm2: { t: 'Ist der Kopter gerade per USB mit dem Betaflight Configurator verbunden?', o: [['Ja', '=flag_MSP'], ['Nein', 'arm3']] },
    arm3: { t: 'Reagiert der Kopter auf deine Funke? Bei ExpressLRS erkennst du das an der Empfänger-LED: Sie leuchtet dauerhaft, wenn alles verbunden ist.', o: [['Ja, verbunden', 'arm4'], ['Nein oder unsicher', '=flag_RXLOSS']] },
    arm4: { t: 'Stand der Arm-Schalter beim Anstecken auf „aus“, und ist das Gas ganz unten?', o: [['Schalter war an', '=flag_ARMSWITCH'], ['Gas nicht ganz unten', '=flag_THROTTLE'], ['Beides passt', 'arm5']] },
    arm5: { t: 'Steht der Kopter waagerecht, und hast du nach dem Einstecken ein paar Sekunden gewartet, ohne ihn zu bewegen?', o: [['Er stand schief', '=flag_ANGLE'], ['Ich war zu schnell', '=flag_BOOTGRACE'], ['Ja, beides', 'arm6']] },
    arm6: { t: 'Dann brauchen wir den genauen Grund, das Flag. So liest du es aus:', s: ['Im OSD-Tab das Element „Warnungen“ einschalten. Beim Armen zeigt das OSD dann den Grund.', 'Oder am PC in der CLI <code>status</code> eingeben und die Zeile „Arming disable flags“ lesen.'], o: [['Flag nachschlagen', '!flagtool'], ['Alle Ursachen zeigen', '=arming']], end: 1 },
    bild1: { t: 'Welches Videosystem fliegst du?', o: [['Analog', 'bild_a'], ['DJI, Walksnail oder HDZero', '=bild_digital'], ['Weiß ich nicht', '=kompat']] },
    bild_a: { t: 'Was siehst du in der Brille?', o: [['Nur Schnee oder Rauschen', '=bild_schnee'], ['Schwarz oder grau, aber OSD-Schrift', '=bild_kamera'], ['Bild flackert oder bricht ein', '=bild_stoer'], ['Alles zu „Kein Bild“', '=bild']] },
    osd1: { t: 'Fliegst du analog oder digital?', o: [['Analog', 'osd_a'], ['Digital (DJI, Walksnail, HDZero)', '=osd_digital']] },
    osd_a: { t: 'Wo hängt das Videokabel der Kamera?', o: [['An der Flugsteuerung (CAM oder VIN)', '=osd_analog'], ['Direkt am VTX', '=osd_direkt'], ['Nur SmartAudio geht zur Flugsteuerung', '=osd_direkt'], ['Weiß ich nicht', '=osd_direkt']] },
    bind1: { t: 'Welches Funksystem nutzt du?', o: [['ExpressLRS (ELRS)', 'bind_elrs'], ['Crossfire', '=bind_cf'], ['Anderes', '=bind']] },
    bind_elrs: { t: 'Was macht die LED am Empfänger, wenn Sender und Kopter an sind?', o: [['Leuchtet dauerhaft', '=rxbf'], ['Blinkt langsam', '=bind_elrs_slow'], ['Blinkt doppelt', '=bind_elrs_mode'], ['Bleibt aus', '=bind_elrs_aus'], ['Alles zu ELRS und Crossfire', '=bind']] },
    mot1: { t: 'Was genau passiert?', o: [['Kopter flippt beim Abheben', '=motor_flip'], ['Ein Motor dreht falsch herum', '=motor_dir'], ['Motor dreht nicht oder ruckelt', '=motor_tot'], ['Alles zu Motoren', '=motor']] }
  };

  /* =====================================================================
     UNSCHARFE SUCHE
     ===================================================================== */
  const norm = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  const STOP = new Set(('der die das den dem des ein eine einen einem einer eines und oder aber mein meine meinen meinem meiner mir mich ich du er es wir ihr sie man ist sind war bin hab habe hat haben wird werden bei beim mit von vom zu zum zur im in am an auf aus fuer ueber unter was wie wo warum wieso weshalb welche welcher welches bitte mal nur noch schon auch dann denn da so jetzt immer gar sehr nicht kein keine keinen keiner nichts mehr geht gehen klappt funktioniert problem probleme frage hilfe ' +
    'the a an is are my not no it its of to and or why how what does doesnt dont wont cant i me with on in at for').split(' '));
  STOP.delete('hilfe');
  const STOP_FUZZY = ['nicht', 'keine', 'warum', 'wieso', 'funktioniert', 'klappt', 'problem'];
  function lev(a, b, max) {
    if (a === b) return 0;
    const la = a.length, lb = b.length; if (Math.abs(la - lb) > max) return max + 1;
    let p2 = null, p = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i++) {
      const c = [i]; let mn = i;
      for (let j = 1; j <= lb; j++) {
        let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        c[j] = v; if (v < mn) mn = v;
      }
      if (mn > max) return max + 1; p2 = p; p = c;
    }
    return p[lb];
  }
  const isStop = (t) => STOP.has(t) || (t.length >= 4 && STOP_FUZZY.some(s => lev(t, s, 1) <= 1));
  function tokMatch(t, k) {
    if (t === k) return 1;
    const lk = k.length;
    if (lk >= 6 && lev(t, k, 2) <= (lk >= 8 ? 2 : 1)) return 0.85;
    if (lk >= 4 && lk < 6 && t.length >= 4 && t[0] === k[0] && lev(t, k, 1) <= 1) return 0.6;
    if (lk >= 3 && t.length > lk && t.length - lk <= 3 && t.startsWith(k)) return 0.8;
    if (t.length >= 5 && lk > t.length && k.startsWith(t)) return 0.7;
    if (lk >= 5 && t.length >= lk + 2 && t.includes(k)) return 0.6;
    return 0;
  }
  // Stichwörter vorbereiten
  KB.forEach(e => {
    e._kw = [];
    if (e.kw) e.kw.split(/\s+/).forEach(p => { const [k, w] = p.split(':'); e._kw.push([norm(k), parseFloat(w) || 1]); });
    norm(e.t).split(' ').filter(t => t.length > 2 && !isStop(t)).forEach(t => { if (!e._kw.some(([k]) => k === t)) e._kw.push([t, 0.8]); });
  });
  const CONTEXT = /\b(flag|flags|arm|armt|armen|arming|status|disabled|warnung)\b/;

  function search(raw) {
    const q = norm(raw);
    const all = q.split(' ').filter(Boolean);
    const toks = all.filter(t => !isStop(t));
    const res = [];
    // 1) Arming-Flags (auch zusammengeschrieben, „rx loss“, Tippfehler)
    const cand = new Set(all);
    for (let i = 0; i < all.length - 1; i++) { cand.add(all[i] + all[i + 1]); if (i < all.length - 2) cand.add(all[i] + all[i + 1] + all[i + 2]); }
    let direct = null;
    for (const f of Object.values(FLAG)) {
      let m = 0;
      cand.forEach(c => { if (c === f.c) m = Math.max(m, 1); else if (f.c.length >= 5 && lev(c, f.c, 2) <= (f.c.length >= 8 ? 2 : 1)) m = Math.max(m, 0.85); });
      if (!m) continue;
      const upper = new RegExp('(^|[^A-Z_])' + f.n + '([^A-Z_]|$)').test(raw);
      if (!f.a || upper || CONTEXT.test(q) || (toks.length === 1 && f.n !== 'FAILSAFE')) { if (!direct || m > direct.m) direct = { f, m }; }
      else res.push({ e: BY['flag_' + f.n], s: 1.4 * m });
    }
    if (direct) return [{ e: BY['flag_' + direct.f.n], s: 10 * direct.m }];
    // 2) Themen
    for (const e of KB) {
      if (!e._kw.length) continue;
      let s = 0;
      for (const t of toks) { let b = 0; for (const [k, w] of e._kw) { const m = tokMatch(t, k); if (m * w > b) b = m * w; } s += b; }
      if (s > 0) res.push({ e, s });
    }
    res.sort((a, b) => b.s - a.s);
    return res;
  }
  FCS.doktorSuche = search; // zum Testen

  /* =====================================================================
     CHAT
     ===================================================================== */
  const doc = $('.th-doc'), log = $('#doc-log'), form = $('#doc-form'), input = $('#doc-q');
  let lastQ = '', lastEntry = null, started = false, queue = Promise.resolve(), firstClick = true;

  function bubble(kind, html) {
    const m = document.createElement('div');
    m.className = 'th-msg ' + kind;
    m.innerHTML = `<span class="who">${kind === 'me' ? 'Du' : 'FPV-Doktor'}</span>` + html;
    log.appendChild(m);
    return m;
  }
  function follow(m) {
    const max = log.scrollHeight - log.clientHeight;
    const top = Math.min(Math.max(0, m.offsetTop - 14), max);
    log.scrollTo({ top, behavior: RM ? 'auto' : 'smooth' });
  }
  function animIn(m, long) {
    follow(m);
    if (!G() || RM) return;
    gsap.fromTo(m, { y: 16, opacity: 0, scale: .98 }, { y: 0, opacity: 1, scale: 1, duration: .5, ease: 'power3.out', transformOrigin: m.classList.contains('me') ? '100% 0' : '0 0' });
    if (long) {
      const parts = $$('p, li, .th-band, .th-chgrid, .th-chips', m);
      gsap.from(parts, { y: 10, opacity: 0, duration: .45, ease: 'power2.out', stagger: .05, delay: .1 });
      const tt = $('.th-tt span', m);
      if (tt && window.ScrambleTextPlugin) gsap.to(tt, { duration: .9, scrambleText: { text: tt.textContent, chars: 'ABCDEFX01#/_', speed: .7 } });
    }
  }
  async function typing(ms) {
    const t = document.createElement('div');
    t.className = 'th-typing'; t.setAttribute('aria-hidden', 'true');
    t.innerHTML = '<i></i><i></i><i></i><span>Doktor tippt</span>';
    log.appendChild(t); follow(t);
    await wait(ms);
    t.remove();
  }
  const chip = (label, data, cls = '') => `<button type="button" class="th-chip ${cls}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(label)}</button>`;
  const stdChips = () => chip('Hat geholfen', { act: 'ok' }, 'ok') + chip('Frage an den Verein schicken', { act: 'verein' }, 'ask');
  const label = (id) => (BY[id] && (BY[id].flag ? BY[id].flag.n + ': ' + BY[id].flag.t : BY[id].t)) || id;

  function viz(kind) {
    if (kind !== 'band') return '';
    const CH = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917], lo = 5640, hi = 5940, pct = (f) => ((f - lo) / (hi - lo) * 100).toFixed(2);
    const inside = (f) => f >= 5725 && f <= 5875;
    let h = '<div class="th-band" aria-hidden="true"><div class="th-band-bar">';
    h += `<div class="th-band-ok" style="left:${pct(5725)}%;width:${(pct(5875) - pct(5725)).toFixed(2)}%"><span>5725 bis 5875 MHz</span></div>`;
    CH.forEach((f, i) => { h += `<span class="th-band-ch ${inside(f) ? 'in' : 'out'}" style="left:${pct(f)}%"><b>R${i + 1}</b></span>`; });
    h += `</div><div class="th-band-ax"><span>${lo} MHz</span><span>${hi} MHz</span></div></div>`;
    h += '<div class="th-chgrid">' + CH.map((f, i) => `<div class="${inside(f) ? 'in' : 'out'}"><b>R${i + 1}</b>${f} MHz<br>${inside(f) ? 'im Bereich' : 'außerhalb'}</div>`).join('') + '</div>';
    return h;
  }
  function entryHTML(e) {
    let h = `<p class="th-tt"><span>${esc(e.flag ? e.flag.n : e.t)}</span></p>`;
    if (e.flag) h += `<p><b>${esc(e.flag.t)}.</b> ${e.i}</p>`; else if (e.i) h += `<p>${e.i}</p>`;
    if (e.w) h += `<p class="th-warn"><b>Achtung:</b> ${e.w}</p>`;
    if (e.viz) h += viz(e.viz);
    if (e.s && e.s.length) h += `<ol>${e.s.map(s => `<li>${s}</li>`).join('')}</ol>`;
    if (e.tip) h += `<p class="th-tip">${e.tip}</p>`;
    if (e.n) h += `<p class="th-note">${e.n}</p>`;
    return h;
  }
  function entryChips(e, alts) {
    let c = '';
    (alts || []).forEach(a => { c += chip('Oder: ' + label(a.e.id), { id: a.e.id }, 'alt'); });
    (e.acts || []).forEach(([l, act, v]) => { c += chip(l, { act, v: v || '' }); });
    if (e.faq) c += chip('Im Vereinswissen lesen', { act: 'faq', v: e.faq });
    (e.more || []).forEach(id => { if (BY[id]) c += chip(label(id), { id }); });
    return c + stdChips();
  }

  async function showEntry(e, opts = {}) {
    lastEntry = e;
    if (e.small) return smallTalk(e);
    if (!opts.full && e.start) {
      const n = e.start(opts.q || '');
      if (n.charAt(0) === '=') return showEntry(BY[n.slice(1)], { full: 1, alts: opts.alts });
      return showNode(n, e, opts.alts);
    }
    await typing(Math.min(1300, 450 + (e.s ? e.s.length * 110 : 200)));
    const m = bubble('bot', entryHTML(e) + `<div class="th-chips">${entryChips(e, opts.alts)}</div>`);
    animIn(m, true);
  }
  async function showNode(id, e, alts) {
    const n = TREE[id]; if (!n) return;
    await typing(500);
    let h = '';
    if (e) h += `<p class="th-tt"><span>${esc(e.t)}</span></p>`;
    h += `<p>${n.t}</p>`;
    if (n.s) h += `<ol>${n.s.map(s => `<li>${s}</li>`).join('')}</ol>`;
    let c = '';
    (alts || []).forEach(a => { c += chip('Oder: ' + label(a.e.id), { id: a.e.id }, 'alt'); });
    n.o.forEach(([l, to]) => {
      if (to.charAt(0) === '=') c += chip(l, { id: to.slice(1), full: 1 });
      else if (to.charAt(0) === '!') c += chip(l, { act: to.slice(1) });
      else c += chip(l, { node: to });
    });
    if (n.end) c += stdChips();
    const m = bubble('bot', h + `<div class="th-chips">${c}</div>`);
    animIn(m, true);
  }
  async function smallTalk(e) {
    await typing(450);
    let c = '';
    if (e.id === 'themen') c = TOPICS.map(id => chip(BY[id].t, { id })).join('');
    else if (e.id === 'hallo') c = MAIN.map(id => chip(BY[id].t, { id })).join('');
    else c = chip('Neue Frage', { act: 'focus' });
    const m = bubble('bot', `<p>${e.i}</p><div class="th-chips">${c}</div>`);
    animIn(m, true);
  }
  async function fallback(res) {
    await typing(650);
    const weak = res.filter(r => r.s >= 0.5).slice(0, 3);
    let h = '<p>Dazu finde ich in unserer Wissensdatenbank keine sichere Antwort.</p>';
    let c = '';
    if (weak.length) { h += '<p>Meinst du vielleicht eins davon?</p>'; weak.forEach(r => { c += chip(label(r.e.id), { id: r.e.id }); }); }
    else { h += '<p>Versuch es mit anderen Worten, wähl ein Thema oder schick deine Frage an den Verein.</p>'; MAIN.slice(0, 4).forEach(id => { c += chip(BY[id].t, { id }); }); c += chip('Alle Themen', { id: 'themen' }); }
    c += chip('Frage an den Verein schicken', { act: 'verein' }, 'ask');
    const m = bubble('bot', h + `<div class="th-chips">${c}</div>`);
    animIn(m, true);
  }
  async function answer(text) {
    lastQ = text;
    const res = search(text);
    if (!res.length || res[0].s < 1.5) return fallback(res);
    const top = res[0];
    const alts = res.slice(1, 3).filter(r => r.s >= top.s * 0.72 && r.e.id !== top.e.id && !r.e.small && top.s < 10);
    return showEntry(top.e, { alts, q: norm(text) });
  }
  function ask(text) {
    text = String(text || '').trim().slice(0, 200); if (!text) return;
    queue = queue.then(async () => {
      if (!started) await greet(true);
      const m = bubble('me', `<p>${esc(text)}</p>`); animIn(m);
      await answer(text);
    }).catch(() => {});
    return queue;
  }
  FCS.doktor = ask;

  async function greet(fast) {
    if (started) return; started = true;
    const txt = 'Hallo, ich bin der FPV-Doktor. Beschreib kurz, was nicht klappt, oder tipp auf ein Thema. Tippfehler sind kein Problem.';
    if (!fast) await typing(700);
    const m = bubble('bot', `<p class="th-greet"><span class="sr">${txt}</span><span class="th-typed" aria-hidden="true"></span></p><div class="th-chips"></div>`);
    if (G() && !RM) gsap.from(m, { y: 16, opacity: 0, duration: .5, ease: 'power3.out' });
    const out = $('.th-typed', m);
    if (fast || RM) out.textContent = txt;
    else { for (let i = 1; i <= txt.length; i++) { out.textContent = txt.slice(0, i); if (i % 3 === 0) await new Promise(r => setTimeout(r, 22)); } }
    const box = $('.th-chips', m);
    box.innerHTML = MAIN.map(id => chip(BY[id].t, { id })).join('') + chip('Alle Themen', { id: 'themen' });
    if (!fast) {
      const n = document.createElement('p'); n.className = 'th-nudge'; n.textContent = 'Antippen oder unten eintippen'; m.appendChild(n);
      const first = $('.th-chip', box); if (first) first.classList.add('pulse');
    }
    if (G() && !RM) gsap.from($$('.th-chip', box), { y: 12, opacity: 0, scale: .9, duration: .45, ease: 'back.out(2)', stagger: .07 });
    follow(m);
  }

  function prefill() {
    const f = $('.th-form'); if (!f) return;
    const ta = $('[name="Frage"]', f), dt = $('[name="Doktor-Thema"]', f);
    const e = lastEntry;
    if (ta && !ta.value.trim()) {
      ta.value = (lastQ ? `Ich habe den FPV-Doktor gefragt: „${lastQ}“\n` : '') + (e ? `Seine Antwort zu „${e.flag ? 'Arming-Flag ' + e.flag.n : e.t}“ hat mir nicht gereicht.\n\n` : '') + 'Mein Problem genauer: ';
    }
    if (dt && e) dt.value = e.flag ? 'Arming-Flag ' + e.flag.n : e.t;
    if (e && e.cat) { const r = $(`input[name="Thema"][value="${e.cat}"]`, f); if (r) r.checked = true; }
    scrollToEl($('#frage'));
    setTimeout(() => { f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); if (ta) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (err) {} } }, RM ? 50 : 900);
  }

  function act(a, v, btn) {
    if (a === 'ok') {
      queue = queue.then(async () => {
        const m = bubble('me', '<p>Hat geholfen</p>'); animIn(m);
        await typing(400);
        const r = bubble('bot', '<p>Freut mich! Guten Flug.</p><p class="th-armed">ARMED</p><div class="th-chips">' + chip('Neue Frage', { act: 'focus' }) + '</div>');
        animIn(r);
        if (G() && !RM) gsap.fromTo($('.th-armed', r), { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(3)', delay: .15 });
      });
    } else if (a === 'verein') prefill();
    else if (a === 'flagtool') { openFlag(); scrollToEl($('#flagtool')); setTimeout(() => { const i = $('#flag-in'); if (i) i.focus({ preventScroll: true }); }, RM ? 50 : 900); }
    else if (a === 'check') scrollToEl($('#check'));
    else if (a === 'faq') openFaq(v, true);
    else if (a === 'link' && v) location.href = v;
    else if (a === 'focus') input.focus();
  }

  if (log && form) {
    const nKB = KB.filter(e => !e.sub && !e.small && !e.faq).length;
    $$('[data-kb-n]').forEach(el => { el.textContent = nKB; });
    $$('[data-flag-n]').forEach(el => { el.textContent = FLAGS.length; });
    log.addEventListener('click', (ev) => {
      const b = ev.target.closest('.th-chip'); if (!b || !log.contains(b)) return;
      if (firstClick) { firstClick = false; $$('.th-chip.pulse', log).forEach(c => c.classList.remove('pulse')); $$('.th-nudge', log).forEach(n => n.remove()); }
      b.classList.add('used');
      const d = b.dataset;
      if (d.act) return act(d.act, d.v, b);
      const text = b.textContent.replace(/^Oder: /, '');
      queue = queue.then(async () => {
        const m = bubble('me', `<p>${esc(text)}</p>`); animIn(m);
        if (d.node) return showNode(d.node);
        if (d.id && BY[d.id]) { if (!BY[d.id].flag && !BY[d.id].sub && !BY[d.id].small) lastQ = text; return showEntry(BY[d.id], { full: d.full === '1' }); }
      }).catch(() => {});
    });
    form.addEventListener('submit', (ev) => { ev.preventDefault(); const v = input.value; input.value = ''; firstClick = false; $$('.th-chip.pulse', log).forEach(c => c.classList.remove('pulse')); ask(v); });
    input.addEventListener('focus', () => { if (!started) greet(true); });
    $('.th-restart').addEventListener('click', () => { log.innerHTML = ''; started = false; lastQ = ''; lastEntry = null; queue = Promise.resolve(); greet(false); input.focus({ preventScroll: true }); });
    // Platzhalter wechselt Beispiele, solange das Feld leer ist
    const ex = ['z. B. Kopter armt nicht', 'z. B. kein osd', 'z. B. rxloss', 'z. B. elrs bindet nicht', 'z. B. Bild nur Schnee', 'z. B. Akku aufgebläht', 'z. B. welche Kanäle sind erlaubt'];
    let exI = 0;
    if (!RM) setInterval(() => { if (document.activeElement !== input && !input.value) { exI = (exI + 1) % ex.length; input.placeholder = ex[exI]; } }, 2600);
    // Selbst-Impuls: Begrüßung beim ersten Sichtkontakt
    const io = new IntersectionObserver((es) => { if (es.some(x => x.isIntersecting)) { io.disconnect(); setTimeout(() => greet(false), RM ? 0 : 350); } }, { threshold: .35 });
    io.observe(doc);
  }

  // Symptom-Laufband
  const track = $('.th-sym-track');
  if (track) {
    const set = $('.th-sym-set', track);
    const copy = set.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); $$('button', copy).forEach(b => b.tabIndex = -1);
    track.appendChild(copy);
    // Touch: Leiste zum Wischen. Selbst-Impuls: einmal kurz anschieben, damit man sieht, dass es weitergeht
    const mq = track.parentElement;
    if (matchMedia('(hover:none)').matches && mq && !RM) {
      const io7 = new IntersectionObserver((es) => {
        if (!es.some(x => x.isIntersecting)) return; io7.disconnect();
        setTimeout(() => { mq.scrollTo({ left: 140, behavior: 'smooth' }); setTimeout(() => mq.scrollTo({ left: 0, behavior: 'smooth' }), 900); }, 700);
      }, { threshold: .6 });
      io7.observe(mq);
    }
    track.addEventListener('click', (ev) => {
      const b = ev.target.closest('.th-sym'); if (!b) return;
      scrollToEl($('#doktor .th-doc-grid'));
      setTimeout(() => ask(b.dataset.ask), RM ? 0 : 750);
    });
  }

  /* =====================================================================
     ARMING-FLAG-WERKZEUG
     ===================================================================== */
  const fIn = $('#flag-in'), fOut = $('.th-flagout'), fChips = $('.th-fchips'), fMore = $('.th-fmore'), fScr = $('.th-osdflag');
  let fTouched = false;
  function flagFind(v) {
    const c = norm(v).replace(/ /g, ''); if (!c) return { f: null, list: [] };
    const exact = Object.values(FLAG).find(f => f.c === c); if (exact) return { f: exact, list: [] };
    const pre = Object.values(FLAG).filter(f => f.c.startsWith(c));
    if (pre.length === 1) return { f: pre[0], list: [] };
    const fz = Object.values(FLAG).map(f => ({ f, d: lev(c, f.c, 2) })).filter(x => x.d <= (x.f.c.length >= 6 ? 2 : 1)).sort((a, b) => a.d - b.d);
    if (fz.length && !pre.length) return { f: fz[0].f, list: fz.slice(1, 4).map(x => x.f), guess: 1 };
    return { f: null, list: pre.slice(0, 8) };
  }
  function flagShow(f, guess, list) {
    $$('.th-fchip', fChips).forEach(b => b.setAttribute('aria-pressed', String(!!f && b.dataset.flag === f.n)));
    if (!f) {
      fScr.textContent = 'ARM'; fScr.classList.remove('ok');
      fOut.innerHTML = list && list.length ? `<p>Meinst du eins davon?</p><div class="th-sug">${list.map(x => `<button type="button" class="th-fchip" data-flag="${x.n}">${x.n}</button>`).join('')}</div>` : '<p class="mute">Kein Flag mit diesem Namen gefunden. Schreib es so, wie es im OSD oder in der CLI steht.</p>';
      return;
    }
    fScr.textContent = f.n;
    fOut.innerHTML = `<h3 class="th-fh"><code>${f.n}</code> ${esc(f.t)}</h3>${guess ? `<p class="mute">Ich nehme an, du meinst ${f.n}.</p>` : ''}<p>${f.d}</p><ol>${f.s.map(s => `<li>${s}</li>`).join('')}</ol>${list && list.length ? `<div class="th-sug">${list.map(x => `<button type="button" class="th-fchip" data-flag="${x.n}">${x.n}</button>`).join('')}</div>` : ''}`;
    if (G() && !RM) {
      gsap.fromTo(fScr, { scale: 1.25, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2.4)' });
      gsap.from($$('h3, p, li', fOut), { y: 8, opacity: 0, duration: .35, stagger: .04, ease: 'power2.out' });
    }
  }
  if (fIn && fOut && fChips) {
    const render = (all) => { fChips.innerHTML = (all ? FLAGS.map(x => x[0]) : COMMON).map(n => `<button type="button" class="th-fchip" data-flag="${n}" aria-pressed="false">${n}</button>`).join(''); };
    render(false);
    fMore.addEventListener('click', () => { const open = fMore.getAttribute('aria-expanded') !== 'true'; fMore.setAttribute('aria-expanded', String(open)); fMore.textContent = open ? 'Nur häufige Flags zeigen' : `Alle ${FLAGS.length} Flags zeigen`; const fl = $('#flagchips-l'); if (fl) fl.textContent = open ? `Alle ${FLAGS.length} Flags` : 'Häufige Flags'; render(open); if (fIn.value) { const r = flagFind(fIn.value); flagShow(r.f, r.guess, r.list); } });
    let t = 0;
    fIn.addEventListener('input', () => { fTouched = true; clearTimeout(t); t = setTimeout(() => { const r = flagFind(fIn.value); if (!fIn.value.trim()) { fOut.innerHTML = ''; fScr.textContent = 'ARM'; return; } flagShow(r.f, r.guess, r.list); }, 160); });
    $('.th-flag').addEventListener('click', (ev) => {
      const b = ev.target.closest('.th-fchip'); if (!b) return;
      fTouched = true; const f = FLAG[b.dataset.flag]; fIn.value = f.n; flagShow(f);
    });
    // Selbst-Impuls: tippt beim ersten Sichtkontakt ein Beispiel ein
    const hint = document.createElement('p'); hint.className = 'th-flag-hint'; hint.textContent = 'Probier es aus: tipp dein Flag ein';
    fIn.closest('.field').after(hint);
    fIn.addEventListener('focus', () => hint.remove(), { once: true });
    const io2 = new IntersectionObserver(async (es) => {
      if (!es.some(x => x.isIntersecting)) return; io2.disconnect();
      if (fTouched) return;
      const demo = 'RXLOSS';
      if (RM) { fIn.value = demo; flagShow(FLAG[demo]); return; }
      await new Promise(r => setTimeout(r, 900));
      for (let i = 1; i <= demo.length; i++) { if (fTouched) return; fIn.value = demo.slice(0, i); await new Promise(r => setTimeout(r, 110)); }
      if (!fTouched) flagShow(FLAG[demo]);
    }, { threshold: .5 });
    io2.observe($('.th-osdscr'));
  }

  /* =====================================================================
     KOMPATIBILITÄTS-CHECK
     ===================================================================== */
  const RX = { an: ['analog', 'Analoge Brille'], dg2: ['dji', 'DJI Goggles 2'], dgi: ['dji', 'DJI Goggles Integra'], dg3: ['dji', 'DJI Goggles 3'], dgn3: ['dji', 'DJI Goggles N3'], wsg: ['ws', 'Walksnail Avatar Brille'], wsv: ['ws', 'Walksnail Avatar VRX', 1], hzg: ['hz', 'HDZero Goggle'], hzv: ['hz', 'HDZero VRX', 1] };
  const TX = { an: ['analog', 'Analog-VTX'], o3: ['dji', 'DJI O3 Air Unit'], o4: ['dji', 'DJI O4 Air Unit'], ws: ['ws', 'Walksnail Avatar VTX'], hz: ['hz', 'HDZero VTX'] };
  const SYS = { analog: 'Analog', dji: 'DJI', ws: 'Walksnail', hz: 'HDZero' };
  function verdict(rx, tx) {
    const [rs, rn, vrx] = RX[rx], [ts, tn] = TX[tx];
    if (rs === ts) {
      if (rs === 'analog') return ['ok', 'Passt', 'Analog ist offen: Jede analoge Brille empfängt jeden analogen 5,8-GHz-Sender. Nur Band und Kanal müssen gleich sein.'];
      if (rs === 'dji') return ['warn', 'Prüfen', `${rn} und ${tn} sind beide DJI. Ob genau diese Kombination läuft, hängt von Modell und Firmware ab. Vor dem Kauf die Kompatibilitätsliste von DJI prüfen und beide Geräte aktualisieren.`];
      if (rs === 'ws') return ['ok', 'Passt', `Beides ist Walksnail Avatar. Brille bzw. VRX und VTX auf zueinander passende Firmware bringen, dann binden.`];
      return ['ok', 'Passt', 'Beides ist HDZero. Gebunden wird nicht: Brille bzw. VRX und VTX einfach auf denselben Kanal stellen. Firmware aktuell halten.'];
    }
    if (ts === 'analog') return vrx ? ['no', 'Passt nicht', `${rn} empfängt nur ${SYS[rs]}. Für einen analogen Sender brauchst du einen analogen Empfänger.`]
      : ['warn', 'Bedingt', `${rn} ist eine ${SYS[rs]}-Brille. Ein analoger Sender braucht einen analogen Empfänger. Manche Digitalbrillen haben einen eingebauten oder nachrüstbaren Analog-Empfänger, andere nicht: Herstellerangaben prüfen.`];
    if (rs === 'analog') return ['no', 'Passt nicht', `${tn} sendet digital (${SYS[ts]}). Eine analoge Brille kann das Bild nicht anzeigen.` + (ts === 'ws' || ts === 'hz' ? ` Ausnahme: ein ${SYS[ts]}-VRX an einer Brille mit HDMI-Eingang.` : '')];
    return ['no', 'Passt nicht', `${SYS[ts]} und ${SYS[rs]} sind eigene Funksysteme und verstehen sich nicht untereinander.`];
  }
  const stage = $('.th-cmp-stage');
  if (stage) {
    const big = $('.th-big', stage), why = $('.th-why', stage), hintT = $('.th-cmp-hint-t', stage);
    let demo = true, last = '';
    const update = (fromUser) => {
      const r = $('input[name="cmp-rx"]:checked'), t = $('input[name="cmp-tx"]:checked');
      if (!r || !t) { stage.dataset.v = 'idle'; big.textContent = r || t ? 'Weiter' : 'Wählen'; why.textContent = r ? 'Jetzt noch den Sender am Kopter wählen.' : t ? 'Jetzt noch die Brille oder den Empfänger wählen.' : 'Links die Brille, rechts den Sender am Kopter.'; return; }
      const [v, word, text] = verdict(r.value, t.value);
      const key = r.value + t.value; if (key === last) return; last = key;
      stage.dataset.v = v; why.textContent = text;
      if (G() && !RM) {
        if (window.ScrambleTextPlugin) gsap.to(big, { duration: .7, scrambleText: { text: word, chars: 'PASTNICHÜF#01', speed: .9 } }); else big.textContent = word;
        gsap.fromTo(big, { scale: .7, opacity: .2 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(2.2)' });
        if (v === 'no') gsap.fromTo(stage, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)' });
        gsap.fromTo(why, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .4, delay: .15 });
      } else big.textContent = word;
      if (fromUser && hintT) hintT.textContent = 'Ohne Gewähr: Herstellerangaben gehen vor';
      // Handy: Ergebnis ins Bild holen, wenn die Bühne gerade nicht zu sehen ist
      if (fromUser && innerWidth <= 980) { const rc = stage.getBoundingClientRect(); if (rc.top > innerHeight - 160 || rc.bottom < 80) scrollToEl(stage); }
    };
    $$('#cmp-rx input, #cmp-tx input').forEach(i => i.addEventListener('change', () => { if (demo && i.dataset.demo !== '1') demo = false; update(!demo); }));
    ['pointerdown', 'keydown'].forEach(evn => $('.th-cmp').addEventListener(evn, () => { demo = false; }, { passive: true }));
    const pick = (rx, tx) => { if (!demo) return false; const a = $(`input[name="cmp-rx"][value="${rx}"]`), b = $(`input[name="cmp-tx"][value="${tx}"]`); a.checked = true; b.checked = true; update(false); return true; };
    const io3 = new IntersectionObserver(async (es) => {
      if (!es.some(x => x.isIntersecting)) return; io3.disconnect();
      if (RM) { pick('an', 'an'); return; }
      await new Promise(r => setTimeout(r, 600)); if (!pick('an', 'an')) return;
      await new Promise(r => setTimeout(r, 2200)); if (!pick('an', 'o4')) return;
      await new Promise(r => setTimeout(r, 2400)); if (!pick('dg3', 'o4')) return;
      await new Promise(r => setTimeout(r, 1800)); if (demo && hintT) hintT.textContent = 'Jetzt du: wähl deine Kombination';
    }, { threshold: .45 });
    io3.observe(stage);
  }

  /* =====================================================================
     VEREINSWISSEN (Akkordeon)
     ===================================================================== */
  function toggle(btn, open) {
    const item = btn.closest('.th-acc-item'), panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    if (open === undefined) open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open)); item.classList.toggle('open', open);
    if (G() && !RM) {
      gsap.killTweensOf(panel);
      if (open) {
        panel.hidden = false;
        gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: .6, ease: 'expo.out', onComplete: () => { panel.style.height = ''; if (window.ScrollTrigger) ScrollTrigger.refresh(); } });
        gsap.from($$('li, p', panel), { x: -14, opacity: 0, duration: .45, stagger: .05, ease: 'power2.out', delay: .08 });
      } else gsap.to(panel, { height: 0, duration: .45, ease: 'power3.inOut', onComplete: () => { panel.hidden = true; panel.style.height = ''; if (window.ScrollTrigger) ScrollTrigger.refresh(); } });
    } else panel.hidden = !open;
  }
  function openFaq(id, scroll) {
    const btn = $(`[aria-controls="${id}"]`); if (!btn) return;
    if (btn.getAttribute('aria-expanded') !== 'true') toggle(btn, true);
    if (scroll) scrollToEl(btn.closest('.th-acc-item'));
  }
  const acc = $('.th-acc');
  if (acc) {
    acc.addEventListener('click', (ev) => { const b = ev.target.closest('.th-acc-btn'); if (b) toggle(b); });
    const io4 = new IntersectionObserver((es) => {
      if (!es.some(x => x.isIntersecting)) return; io4.disconnect();
      setTimeout(() => { if (!$('.th-acc-item.open', acc)) toggle($('.th-acc-btn', acc), true); }, RM ? 0 : 700);
    }, { threshold: .3 });
    io4.observe(acc);
  }

  /* =====================================================================
     GRUPPE, WHATSAPP, FORMULAR
     ===================================================================== */
  const dots = $('.th-dots');
  if (dots && support && support.m) {
    dots.innerHTML = '<i></i>'.repeat(support.m);
    const io5 = new IntersectionObserver((es) => {
      if (!es.some(x => x.isIntersecting)) return; io5.disconnect();
      if (G() && !RM) gsap.from($$('i', dots), { scale: 0, opacity: 0, duration: .5, ease: 'back.out(3)', stagger: { each: .025, from: 'random' } });
    }, { threshold: .4 });
    io5.observe(dots);
  }
  const waBox = $('.th-wa-btns');
  if (waBox) {
    const ico = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>';
    waBox.innerHTML = (D.kontakte || []).filter(k => k.wa).map(k => {
      const text = `Hallo ${k.name}, ich habe eine Technik-Frage zum FPV-Fliegen: `;
      return `<a class="th-wa-btn" href="https://wa.me/${encodeURIComponent(k.wa)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${ico}<span><b>WhatsApp an ${esc(k.name)}</b><small>${esc(k.rolle || '')}</small></span><span class="arr" aria-hidden="true">→</span></a>`;
    }).join('');
  }
  const qForm = $('.th-form');
  if (qForm) {
    const again = $('.th-again', qForm);
    if (again) again.addEventListener('click', () => {
      qForm.reset(); qForm.classList.remove('sent'); $('.form-ok', qForm).hidden = true; const bad = $('.form-bad', qForm); if (bad) bad.hidden = true;
      $$('.field.bad, .check.bad', qForm).forEach(x => x.classList.remove('bad'));
      const n = $('#f-name'); if (n) n.focus();
    });
    qForm.addEventListener('fcs:sent', () => { scrollToEl(qForm); });
    const io6 = new IntersectionObserver((es) => {
      if (!es.some(x => x.isIntersecting)) return; io6.disconnect();
      if (G() && !RM) gsap.fromTo($$('.th-topics .chip span', qForm), { y: 0 }, { y: -6, duration: .25, ease: 'power2.out', yoyo: true, repeat: 1, stagger: .06, delay: .4 });
    }, { threshold: .3 });
    io6.observe(qForm);
  }

  /* =====================================================================
     SEITENKOPF: OSD-Diagnose spielt einmal durch
     ===================================================================== */
  function headDemo() {
    const w = $('.th-osd-warn'), t = $('.th-osd-warn-t'); if (!w || !t || RM) return;
    const seq = [['RXLOSS', 0], ['THROTTLE', 0], ['NO VIDEO', 0], ['DIAGNOSE OK', 1]];
    let i = 0;
    const step = () => {
      const [txt, ok] = seq[i]; w.classList.toggle('ok', !!ok);
      if (G() && window.ScrambleTextPlugin) gsap.to(t, { duration: .8, scrambleText: { text: txt, chars: 'ABCDEFGHIKLMNOPRSTUVX01', speed: .8 } }); else t.textContent = txt;
      i++; if (i < seq.length) setTimeout(step, 1700);
    };
    setTimeout(step, 1600);
  }

  /* Endlos-Animationen anhalten, solange ein Abschnitt nicht zu sehen ist (nichts ruckelt beim Scrollen) */
  function pauseOffscreen() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '80px 0px' });
    $$('main > section, main > div').forEach(x => io.observe(x));
  }

  function init() {
    pauseOffscreen();
    headDemo();
    if (G() && !RM && window.ScrollTrigger) {
      // Kompatibilitäts-Bühne und Karten mit Tiefe
      $$('.th-card').forEach((c, i) => gsap.fromTo(c, { rotateX: 8, transformPerspective: 900 }, { rotateX: 0, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'top 55%', scrub: true } }));
      gsap.fromTo('.th-reticle', { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out', delay: .4 });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('fcs:ready', init); else setTimeout(init, 0);
})();
