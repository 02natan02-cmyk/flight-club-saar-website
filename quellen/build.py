#!/usr/bin/env python3
"""Baut die Seiten des Flight Club Saar aus src/*.html (nur der Inhalt) + gemeinsamem Kopf, Menü und Fuß.
Aufruf: python3 quellen/build.py  → schreibt die Seiten in den Repo-Stamm"""
import os, re, json, hashlib, pathlib
ROOT = pathlib.Path(__file__).parent
SRC, OUT = ROOT / 'src', ROOT.parent  # Quellen in quellen/, fertige Seite im Repo-Stamm (GitHub Pages)
BASE_URL = os.environ.get('FCS_BASE', 'https://flightclub-saar.de/')

PAGES = [
  # datei, titel, beschreibung, menü-schlüssel, zusätzliche skripte
  ('index.html', 'Flight Club Saar e. V. · FPV-Verein im Saarland · Brille an!', 'Der FPV-Drohnenverein im Saarland: Hallenfliegen im Winter, Spots im Frühjahr, Hilfe beim Bauen und eine Community, die zusammenhält.', 'start', ['home', 'game', 'intro3d']),
  ('hallenfliegen.html', 'Hallenfliegen · Flight Club Saar e. V.', 'Tiny Whoops in der Halle: alle Termine der Wintersaison mit Kalender-Export, Ort und Abendplan für Mitglieder.', 'halle', ['halle']),
  ('termin.html', 'Hallenabend planen · Flight Club Saar e. V.', 'Der Abendplan fürs Hallenfliegen: Piloten eintragen, Kanäle ohne Störungen zuteilen, Flugzeiten einteilen und vor Ort live steuern.', 'halle', ['termin']),
  ('spots.html', 'Spot-Karte · Flight Club Saar e. V.', 'Unsere FPV-Spots im Saarland mit Route per Klick, Bewertungen und Spot-Vorschlag. Mit den Regeln, die für jeden Piloten gelten.', 'spots', ['leaflet', 'spots']),
  ('wissen.html', 'FPV-Wissen · Flight Club Saar e. V.', 'FPV einfach erklärt: Bauteile einer Drohne in 3D, Schaltplan zum Anklicken, Videosysteme, Kanäle und der Weg vom Simulator zum ersten Flug.', 'wissen', ['three', 'wissen']),
  ('werkstatt.html', 'Betaflight & Löten · Flight Club Saar e. V.', 'Betaflight einfach erklärt: Version, Flashen, die wichtigsten Einstellungen, dazu Löten Schritt für Schritt. Mit Animationen und Videos.', 'werkstatt', ['werkstatt']),
  ('hilfe.html', 'Technik-Hilfe · Flight Club Saar e. V.', 'Der FPV-Doktor hilft bei Betaflight, VTX, ELRS, Kanälen und Kompatibilität. Plus Forum-Fragen an den Verein.', 'hilfe', ['hilfe']),
  ('mitglied.html', 'Mitglied werden · Flight Club Saar e. V.', 'Online-Mitgliedsantrag mit SEPA-Lastschrift: 30 € im Jahr, 20 € unter 18, einmalig 20 € Aufnahme. Plus deine Mitgliedskarte zum Mitnehmen.', 'mitglied', ['mitglied']),
  ('bau.html', 'Bau deine Drohne · Flight Club Saar e. V.', 'Bau deine FPV-Drohne Schritt für Schritt aus echten Teilen: nur was zusammenpasst, jede Lötstelle, danach im Simulator fliegen.', 'bau', ['three', 'bau']),
  ('studio.html', 'Clip-Studio · Flight Club Saar e. V.', 'Das Clip-Studio des Vereins: Video schneiden, Musik im Takt, Looks, Vereinslogo und dein Tag. Für Mitglieder stabilisieren wir dein FPV-Video mit Gyroflow.', 'studio', ['studio']),
  ('filmen.html', 'FPV filmen · Flight Club Saar e. V.', 'Der Film-Ratgeber für FPV: Kameras, ND-Filter, Einstellungen, Schnitt und Musik. Plus Gyroflow für Mitglieder und das Clip-Studio des Vereins.', 'filmen', ['filmen']),
  ('simulator.html', 'FPV-Simulator · Flight Club Saar e. V.', 'FPV-Simulator im Browser: mit Funke, PlayStation- oder Xbox-Controller durch die Turnhalle fliegen. Acro und Angle, Betaflight-Rates, Rundenzeit.', 'sim', ['three', 'sim']),
  ('crew.html', 'Crew · Flight Club Saar e. V.', 'Die Piloten des Flight Club Saar, dein Profil mit Social-Links und die Pinnwand der Crew.', 'crew', ['crew']),
  ('markt.html', 'Biete/Suche · Flight Club Saar e. V.', 'Die Biete/Suche-Wand des Vereins: Kopter, Brillen und Teile von Pilot zu Pilot. Kostenlos einstellen und mit Löschcode selbst wieder löschen.', 'markt', ['markt']),
  ('impressum.html', 'Impressum · Flight Club Saar e. V.', 'Impressum des Flight Club Saar e. V.', '', ['recht']),
  ('datenschutz.html', 'Datenschutz · Flight Club Saar e. V.', 'Datenschutzerklärung des Flight Club Saar e. V.', '', ['recht']),
]
NAV = [('hallenfliegen.html', 'halle', 'Hallenfliegen'), ('spots.html', 'spots', 'Spots'), ('simulator.html', 'sim', 'Simulator'),
       ('wissen.html', 'wissen', 'FPV lernen'), ('studio.html', 'studio', 'Clip-Studio'), ('crew.html', 'crew', 'Crew')]
# Übersicht im Menü: Gruppen mit Kacheln (Symbol, Name, ein Satz)
MI = {
 'halle': '<path d="M3 20V10l9-6 9 6v10"/><path d="M8 20v-6h8v6"/><circle cx="12" cy="9.5" r="1.4"/>',
 'spots': '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
 'mitglied': '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.8-1.7 2-2.4 3.2-2.4s2.4.7 3.2 2.4M14.5 10h4M14.5 13.5h3"/>',
 'wissen': '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M7 10.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5"/>',
 'hilfe': '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5 6.5 20.5l5.7-5.7a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.6-.6-2.6 2.6-2.2z"/>',
 'filmen': '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/><circle cx="9.5" cy="12" r="2.4"/>',
 'crew': '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M2.8 19c.9-3 2.9-4.5 5.2-4.5s4.3 1.5 5.2 4.5M13.6 15.2c.8-.6 1.8-1 2.9-1 2 0 3.6 1.3 4.3 3.8"/>',
 'markt': '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9c0 1.6 1.3 2.6 3 2.6S9 10.6 9 9c0 1.6 1.3 2.6 3 2.6S15 10.6 15 9c0 1.6 1.3 2.6 3 2.6S21 10.6 21 9"/>',
 'start': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/>',
 'werkstatt': '<path d="M4 20l7-7"/><path d="M13.5 6.5l4 4-6 6-4-4z"/><path d="M17.5 2.5l4 4-2 2-4-4z"/><circle cx="6" cy="18" r="1"/>',
 'bau': '<path d="M14.5 6.5l3 3-8 8H6.5v-3z"/><path d="M13 8l3 3"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M17.5 13.5v1.5M17.5 20v1.5M13.5 17.5H15M20 17.5h1.5"/>',
 'studio': '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9h19M7 5l2 4M12 5l2 4M17 5l2 4"/><path d="M10 12.2v4.6l4-2.3z"/>',
 'termin': '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3M8 17h6"/>',
 'sim': '<rect x="3" y="9" width="18" height="11" rx="3"/><circle cx="8.5" cy="14.5" r="2.2"/><circle cx="15.5" cy="14.5" r="2.2"/><path d="M6.5 9V4M17.5 9V4"/>',
}
MENU = [
 ('Fliegen', [('hallenfliegen.html', 'halle', 'Hallenfliegen', 'Tiny Whoops im Winter. Nächster Termin: <span data-next>für Mitglieder</span>'),
              ('termin.html', 'termin', 'Hallenabend-Planer', 'Dabei sein, Kanal und Gruppe für den Abend'),
              ('spots.html', 'spots', 'Spot-Karte', 'Wo wir draußen fliegen, mit Route, Regeln und Bewertungen'),
              ('simulator.html', 'sim', 'FPV-Simulator', 'Mit Funke, Controller oder Handy im Browser fliegen')]),
 ('Lernen', [('wissen.html', 'wissen', 'FPV lernen', 'Neu dabei? Drohne in 3D, Schaltplan, dein erster Flug'),
              ('bau.html', 'bau', 'Bau deine Drohne', 'Teile wählen, Lötplan, im Simulator fliegen'),
              ('werkstatt.html', 'werkstatt', 'Betaflight & Löten', 'Einrichten und Löten, Schritt für Schritt'),
              ('hilfe.html', 'hilfe', 'Technik-Hilfe', 'Kopter armt nicht? Der FPV-Doktor hilft'),
              ('filmen.html', 'filmen', 'FPV filmen', 'Kameras, Einstellungen, Schnitt. Gyroflow für Mitglieder')]),
 ('Verein', [('mitglied.html', 'mitglied', 'Mitglied werden', 'Kosten, Vorteile und Antrag in wenigen Minuten'),
              ('studio.html', 'studio', 'Clip-Studio', 'Video schneiden, Logo drauf, Gyroflow für Mitglieder'),
              ('crew.html', 'crew', 'Crew & Pinnwand', 'Unsere Piloten, dein Profil, die Pinnwand'),
              ('markt.html', 'markt', 'Biete/Suche', 'Kopter, Brillen und Teile von Pilot zu Pilot')]),
]
ICONS = {
 'instagram': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
 'tiktok': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.9 5.9 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
 'youtube': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>',
 'whatsapp': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>',
}
LIB = {
  'gsap': ['assets/lib/gsap.min.js', 'assets/lib/ScrollTrigger.min.js', 'assets/lib/SplitText.min.js', 'assets/lib/ScrambleTextPlugin.min.js', 'assets/lib/Draggable.min.js', 'assets/lib/InertiaPlugin.min.js', 'assets/lib/DrawSVGPlugin.min.js', 'assets/lib/MotionPathPlugin.min.js'],
}

LDJSON = '''<script type="application/ld+json">{"@context":"https://schema.org","@type":"SportsClub","name":"Flight Club Saar e. V.","alternateName":"Flight Club Saar","description":"FPV-Drohnenverein im Saarland: Hallenfliegen im Winter, Spots im Frühjahr, Hilfe beim Bauen und Programmieren.","sport":"FPV-Drohnenfliegen","foundingDate":"2022-12-10","email":"info@flightclub-saar.de","address":{"@type":"PostalAddress","streetAddress":"Hedwigstraße 16","postalCode":"66763","addressLocality":"Dillingen","addressRegion":"Saarland","addressCountry":"DE"},"sameAs":["https://www.instagram.com/flightclubsaar/","https://www.tiktok.com/@flightclubsaar","https://www.youtube.com/@flightclubsaar"],"sponsor":{"@type":"Organization","name":"Ayedo Cloud Solutions GmbH","url":"https://ayedo.de/"}}</script>
'''

def ver(path):
    p = OUT / path
    return hashlib.md5(p.read_bytes()).hexdigest()[:8] if p.exists() else '1'

def head(file, title, desc):
    url = BASE_URL + ('' if file == 'index.html' else file)
    return f'''<!doctype html>
<html lang="de" class="no-js">
<head>
<meta charset="utf-8">
<script data-fe="bald">try{{if(new URLSearchParams(location.search).has("vorschau"))localStorage.setItem("fcs-vorschau","1");if(Date.now()<Date.parse("2026-10-29T08:00:00+01:00")&&!localStorage.getItem("fcs-vorschau"))location.replace(new URL("bald/",document.baseURI).href)}}catch(e){{}}</script>
<script data-fe="film">try{{var q=location.search;if(/[?&]film/.test(q)||(Date.now()<Date.parse("2026-11-16T00:00:00+01:00")&&!localStorage.getItem("fcs-film")&&!/[?&](intro|nofilm)/.test(q)&&!navigator.webdriver))document.documentElement.classList.add("film-on")}}catch(e){{}}</script>
<script data-fe="intro">try{{if(Date.now()-(+localStorage.getItem("fcs-intro")||0)<2592e5&&!/[?&]intro/.test(location.search))document.documentElement.classList.add("no-intro")}}catch(e){{}}</script>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#040912">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="de_DE"><meta property="og:site_name" content="Flight Club Saar e. V.">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{BASE_URL}og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preload" href="assets/fonts/bebas-neue-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/fcs.css?v={ver('assets/css/fcs.css')}">
''' + (LDJSON if file == 'index.html' else '')

def nav(key):
    top = {'termin': 'halle', 'werkstatt': 'wissen', 'hilfe': 'wissen', 'bau': 'wissen', 'filmen': 'wissen', 'markt': 'crew'}.get(key, key)
    links = ''.join(f'<a href="{h}"{" aria-current=page" if k == key else (" aria-current=true" if k == top else "")}>{t}</a>' for h, k, t in NAV)
    groups = ''
    for g, items in MENU:
        tiles = ''.join(f'<a class="mt{" on" if k == key else ""}" href="{h}"><svg viewBox="0 0 24 24" aria-hidden="true">{MI[k]}</svg><b>{t}</b><span>{d}</span></a>' for h, k, t, d in items)
        groups += f'<div class="mg"><p class="mg-h">{g}</p><div class="mg-t">{tiles}</div></div>'
    return f'''<a class="sr" href="#inhalt">Zum Inhalt springen</a>
<header class="nav">
  <a class="brand" href="index.html"><span class="sr">Startseite: </span><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Flight Club<small>Saar e. V.</small></span></a>
  <nav class="nav-links" aria-label="Hauptmenü">{links}</nav>
  <button class="nav-login" type="button" data-login aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path class="sh" d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg><span class="nl-t">Login</span></button>
  <button class="nav-kontakt" type="button" data-kontakt aria-haspopup="dialog" aria-label="Kontakt aufnehmen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg><span class="nk-t">Kontakt</span></button>
  <a class="btn solid nav-cta" href="mitglied.html"{' aria-current=page' if key == 'mitglied' else ''}>Mitglied werden</a>
  <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menü öffnen"><span class="bg-ic"><i></i><i></i><i></i></span><span class="bg-t">Menü</span></button>
</header>
<div class="menu" id="menu" aria-label="Übersicht aller Seiten"><div class="menu-in wrap">{groups}<p class="menu-k"><button class="btn" type="button" data-kontakt>Erstmal Kontakt aufnehmen</button> <a class="btn solid" href="mitglied.html">Mitglied werden</a></p><p class="menu-foot">Brille an, Welt aus! · Flight Club Saar e. V. · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p></div></div>
'''

def foot():
    soc = ''.join(f'<a href="{u}" target="_blank" rel="noopener" aria-label="{n}">{ICONS[k]}</a>' for k, n, u in [
        ('instagram', 'Instagram @flightclubsaar', 'https://www.instagram.com/flightclubsaar/'),
        ('tiktok', 'TikTok @flightclubsaar', 'https://www.tiktok.com/@flightclubsaar'),
        ('youtube', 'YouTube @flightclubsaar', 'https://www.youtube.com/@flightclubsaar')])
    return f'''<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div><img src="assets/img/logo.svg" alt="Flight Club Saar" width="170" height="114" style="width:170px;height:auto;margin-bottom:18px"><p class="mute" style="max-width:36ch">Der FPV-Verein im Saarland. Gegründet 2022. Build · Fly · Crash · Repair · Repeat.</p><div class="social">{soc}</div></div>
      <div><p class="foot-h">Fliegen</p><ul><li><a href="hallenfliegen.html">Hallenfliegen</a></li><li><a href="spots.html">Spot-Karte</a></li><li><a href="spots.html#einsenden">Spot einsenden</a></li><li><a href="markt.html">Biete/Suche</a></li></ul></div>
      <div><p class="foot-h">Lernen</p><ul><li><a href="wissen.html">FPV-Wissen</a></li><li><a href="wissen.html#schaltplan">Schaltplan</a></li><li><a href="bau.html">Bau deine Drohne</a></li><li><a href="werkstatt.html">Betaflight &amp; Löten</a></li><li><a href="hilfe.html">FPV-Doktor</a></li><li><a href="hilfe.html#frage">Frage stellen</a></li><li><a href="simulator.html">FPV-Simulator</a></li><li><a href="filmen.html#ratgeber">Film-Ratgeber</a></li></ul></div>
      <div><p class="foot-h">Verein</p><ul><li><button type="button" class="foot-btn" data-kontakt>Kontakt aufnehmen</button></li><li><a href="mitglied.html">Mitglied werden</a></li><li><a href="crew.html">Crew-Bereich</a></li><li><a href="studio.html">Clip-Studio</a></li><li><a href="termin.html">Hallenabend-Planer</a></li><li><a href="mailto:info@flightclub-saar.de">info@flightclub-saar.de</a></li><li><a href="docs/Satzung_Flight_Club_Saar.pdf" target="_blank" rel="noopener">Satzung (PDF)</a></li><li><a href="impressum.html">Impressum</a></li><li><a href="datenschutz.html">Datenschutz</a></li><li><a href="index.html?film">Eröffnungsfilm ansehen</a></li><li><a href="index.html?intro">Intro nochmal ansehen</a></li></ul></div>
    </div>
    <div class="foot-big" aria-hidden="true">Brille an</div>
    <div class="foot-bar"><span>© <span data-year>2026</span> Flight Club Saar e. V. · Vereinsregister Saarlouis VR 1665</span><span>Filme: Mitglieder des Vereins · Website: <a href="https://falcon-eye.de/" target="_blank" rel="noopener">Falcon Eye</a></span></div>
  </div>
</footer>
'''

def scripts(extra, file):
    tags = [f'<script src="assets/js/data.js?v={ver("assets/js/data.js")}"></script>']
    tags += [f'<script src="{s}"></script>' for s in LIB['gsap']]
    if 'leaflet' in extra:
        tags.append('<script src="assets/lib/leaflet.js"></script>')
    tags.append(f'<script src="assets/js/fcs.js?v={ver("assets/js/fcs.js")}"></script>')
    for e in extra:
        if e in ('leaflet', 'three', 'intro3d'): continue
        js = f'assets/js/{e}.js'
        if e == 'studio': tags.append(f'<script src="assets/js/studio-overlay.js?v={ver("assets/js/studio-overlay.js")}"></script>')
        if (OUT / js).exists():
            mod = ' type="module"' if 'three' in extra and e in ('home', 'wissen', 'sim', 'bau') else ''
            tags.append(f'<script src="{js}?v={ver(js)}"{mod}></script>')
        css = f'assets/css/{e}.css'
    return '\n'.join(tags)

def page_css(extra):
    out = ['<link rel="stylesheet" href="assets/lib/leaflet.css">'] if 'leaflet' in extra else []
    if 'intro3d' in extra: out.append('<link rel="modulepreload" href="assets/lib/three.module.min.js">')
    for e in extra:
        css = f'assets/css/{e}.css'
        if (OUT / css).exists(): out.append(f'<link rel="stylesheet" href="{css}?v={ver(css)}">')
    return '\n'.join(out)

# Halloween 2026 (Natan 31.10.): Schleim-Intro und Deko bis Mo 02.11. 18:00 – schaltet sich selbst ab; in der Woche danach hier leeren.
HW_PAGES = {'index.html', 'crew.html', 'mitglied.html', 'hallenfliegen.html', 'wissen.html'}

def build():
    for file, title, desc, key, extra in PAGES:
        src = SRC / file
        if not src.exists():
            print('fehlt:', src); continue
        body = src.read_text()
        body = re.sub(r'%%V:([^%]+)%%', lambda m: ver(m.group(1)), body)
        hw_css = f'\n<link rel="stylesheet" href="assets/css/halloween.css?v={ver("assets/css/halloween.css")}">' if file in HW_PAGES else ''
        hw_js = f'\n<script src="assets/js/halloween.js?v={ver("assets/js/halloween.js")}" defer></script>' if file in HW_PAGES else ''
        html = head(file, title, desc) + page_css(extra) + hw_css + '\n</head>\n<body>\n' + nav(key) + f'<main id="inhalt">\n{body}\n</main>\n' + foot() + scripts(extra, file) + hw_js + '\n</body>\n</html>\n'
        (OUT / file).write_text(html)
        print('gebaut:', file, len(html))

if __name__ == '__main__':
    build()
