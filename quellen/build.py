#!/usr/bin/env python3
"""Baut die Seiten des Flight Club Saar aus src/*.html (nur der Inhalt) + gemeinsamem Kopf, Menü und Fuß.
Aufruf: python3 quellen/build.py  → schreibt die Seiten in den Repo-Stamm"""
import os, re, json, hashlib, pathlib
ROOT = pathlib.Path(__file__).parent
SRC, OUT = ROOT / 'src', ROOT.parent  # Quellen in quellen/, fertige Seite im Repo-Stamm (GitHub Pages)
BASE_URL = os.environ.get('FCS_BASE', 'https://02natan02-cmyk.github.io/flight-club-saar-website/')

PAGES = [
  # datei, titel, beschreibung, menü-schlüssel, zusätzliche skripte
  ('index.html', 'Flight Club Saar e. V. · FPV-Verein im Saarland · Brille an!', 'Der FPV-Drohnenverein im Saarland: Hallenfliegen im Winter, Spots im Frühjahr, Hilfe beim Bauen und eine Community, die zusammenhält.', 'start', ['home', 'game']),
  ('hallenfliegen.html', 'Hallenfliegen · Flight Club Saar e. V.', 'Tiny Whoops in der Halle: alle Termine der Wintersaison in Eiweiler und Holz, mit Kalender-Export und Route. Kommt einfach vorbei!', 'halle', ['halle']),
  ('spots.html', 'Spot-Karte · Flight Club Saar e. V.', 'Unsere FPV-Spots im Saarland mit Route per Klick, Bewertungen und Spot-Vorschlag. Mit den Regeln, die für jeden Piloten gelten.', 'spots', ['leaflet', 'spots']),
  ('wissen.html', 'FPV-Wissen · Flight Club Saar e. V.', 'FPV einfach erklärt: Bauteile einer Drohne in 3D, Schaltplan zum Anklicken, Videosysteme, Kanäle und der Weg vom Simulator zum ersten Flug.', 'wissen', ['three', 'wissen']),
  ('hilfe.html', 'Technik-Hilfe · Flight Club Saar e. V.', 'Der FPV-Doktor hilft bei Betaflight, VTX, ELRS, Kanälen und Kompatibilität. Plus Forum-Fragen an den Verein.', 'hilfe', ['hilfe']),
  ('mitglied.html', 'Mitglied werden · Flight Club Saar e. V.', 'Online-Mitgliedsantrag mit SEPA-Lastschrift: 30 € im Jahr, 20 € unter 18, einmalig 20 € Aufnahme. Plus deine Mitgliedskarte zum Mitnehmen.', 'mitglied', ['mitglied']),
  ('filmen.html', 'FPV filmen · Flight Club Saar e. V.', 'Der große Film-Ratgeber für FPV: Kameras, Bildraten, Shutter und ND-Filter, Linsen, Stabilisierung, Farbe, Schnitt, Musik und Posten.', 'filmen', ['filmen']),
  ('crew.html', 'Crew-Bereich · Flight Club Saar e. V.', 'Für Mitglieder: Clip-Studio mit Vereinslogo und Stickern, Video einsenden, Profil ergänzen und die Pinnwand der Crew.', 'crew', ['crew']),
  ('markt.html', 'Biete/Suche · Flight Club Saar e. V.', 'Die Biete/Suche-Wand des Vereins: Kopter, Brillen und Teile von Piloten für Piloten. Kostenlos, vom Vorstand geprüft.', 'markt', ['markt']),
  ('impressum.html', 'Impressum · Flight Club Saar e. V.', 'Impressum des Flight Club Saar e. V.', '', ['recht']),
  ('datenschutz.html', 'Datenschutz · Flight Club Saar e. V.', 'Datenschutzerklärung des Flight Club Saar e. V.', '', ['recht']),
]
NAV = [('index.html', 'start', 'Start'), ('hallenfliegen.html', 'halle', 'Hallenfliegen'), ('spots.html', 'spots', 'Spots'),
       ('wissen.html', 'wissen', 'FPV-Wissen'), ('hilfe.html', 'hilfe', 'Technik-Hilfe'), ('filmen.html', 'filmen', 'Filmen'), ('crew.html', 'crew', 'Crew')]
ICONS = {
 'instagram': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
 'tiktok': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.9 5.9 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
 'youtube': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>',
 'whatsapp': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.5 11.5 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.6.6 0 0 1 0 .5l-.3.5-.4.5c-.2.2-.3.3-.1.6a8 8 0 0 0 1.5 1.9 7.4 7.4 0 0 0 2.2 1.3c.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.3 2.3 0 0 1-.2 1.4z"/></svg>',
}
LIB = {
  'gsap': ['assets/lib/gsap.min.js', 'assets/lib/ScrollTrigger.min.js', 'assets/lib/SplitText.min.js', 'assets/lib/ScrambleTextPlugin.min.js', 'assets/lib/Draggable.min.js', 'assets/lib/InertiaPlugin.min.js', 'assets/lib/DrawSVGPlugin.min.js', 'assets/lib/MotionPathPlugin.min.js', 'assets/lib/lenis.min.js'],
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
<script data-fe="intro">try{{var n=performance.getEntriesByType("navigation")[0];if(!n||n.type!=="back_forward")sessionStorage.removeItem("fcs-intro")}}catch(e){{}}</script>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex,nofollow">
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
    links = ''.join(f'<a href="{h}"{" aria-current=page" if k == key else ""}>{t}</a>' for h, k, t in NAV)
    mlinks = ''.join(f'<a href="{h}"><b>0{i+1}</b>{t}</a>' for i, (h, k, t) in enumerate(NAV + [('mitglied.html', 'mitglied', 'Mitglied werden')]))
    return f'''<a class="sr" href="#inhalt">Zum Inhalt springen</a>
<header class="nav">
  <a class="brand" href="index.html"><span class="sr">Startseite: </span><img src="assets/img/logo-mark.svg" alt="" width="44" height="44"><span>Flight Club<small>Saar e. V.</small></span></a>
  <nav class="nav-links" aria-label="Hauptmenü">{links}</nav>
  <a class="btn solid nav-cta" href="mitglied.html">Mitglied werden</a>
  <button class="burger" type="button" aria-expanded="false" aria-controls="menu"><i></i><i></i><i></i><span class="sr">Menü</span></button>
</header>
<div class="menu" id="menu">{mlinks}<p class="menu-foot">Brille an, Welt aus! · Flight Club Saar e. V.</p></div>
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
      <div><h4>Fliegen</h4><ul><li><a href="hallenfliegen.html">Hallenfliegen</a></li><li><a href="spots.html">Spot-Karte</a></li><li><a href="spots.html#einsenden">Spot einsenden</a></li><li><a href="markt.html">Biete/Suche</a></li></ul></div>
      <div><h4>Lernen</h4><ul><li><a href="wissen.html">FPV-Wissen</a></li><li><a href="wissen.html#schaltplan">Schaltplan</a></li><li><a href="hilfe.html">FPV-Doktor</a></li><li><a href="hilfe.html#frage">Frage stellen</a></li><li><a href="filmen.html">FPV filmen</a></li></ul></div>
      <div><h4>Verein</h4><ul><li><a href="mitglied.html">Mitglied werden</a></li><li><a href="crew.html">Crew-Bereich</a></li><li><a href="crew.html#studio">Clip einsenden</a></li><li><a href="mailto:info@flightclub-saar.de">info@flightclub-saar.de</a></li><li><a href="docs/Satzung_Flight_Club_Saar.pdf" target="_blank" rel="noopener">Satzung (PDF)</a></li><li><a href="impressum.html">Impressum</a></li><li><a href="datenschutz.html">Datenschutz</a></li></ul></div>
    </div>
    <div class="foot-big" aria-hidden="true">Brille an</div>
    <div class="foot-bar"><span>© <span data-year>2026</span> Flight Club Saar e. V. · Vereinsregister Saarlouis VR 1665</span><span>Filme: Falcon Eye</span></div>
  </div>
</footer>
'''

def scripts(extra, file):
    tags = [f'<script src="assets/js/data.js?v={ver("assets/js/data.js")}"></script>']
    tags += [f'<script src="{s}"></script>' for s in LIB['gsap']]
    if 'leaflet' in extra:
        tags.insert(0, '<link rel="stylesheet" href="assets/lib/leaflet.css">')
        tags.append('<script src="assets/lib/leaflet.js"></script>')
    tags.append(f'<script src="assets/js/fcs.js?v={ver("assets/js/fcs.js")}"></script>')
    for e in extra:
        if e in ('leaflet', 'three'): continue
        js = f'assets/js/{e}.js'
        if (OUT / js).exists():
            mod = ' type="module"' if 'three' in extra and e in ('home', 'wissen') else ''
            tags.append(f'<script src="{js}?v={ver(js)}"{mod}></script>')
        css = f'assets/css/{e}.css'
    return '\n'.join(tags)

def page_css(extra):
    out = []
    for e in extra:
        css = f'assets/css/{e}.css'
        if (OUT / css).exists(): out.append(f'<link rel="stylesheet" href="{css}?v={ver(css)}">')
    return '\n'.join(out)

def build():
    for file, title, desc, key, extra in PAGES:
        src = SRC / file
        if not src.exists():
            print('fehlt:', src); continue
        body = src.read_text()
        html = head(file, title, desc) + page_css(extra) + '\n</head>\n<body>\n' + nav(key) + f'<main id="inhalt">\n{body}\n</main>\n' + foot() + scripts(extra, file) + '\n</body>\n</html>\n'
        (OUT / file).write_text(html)
        print('gebaut:', file, len(html))

if __name__ == '__main__':
    build()
