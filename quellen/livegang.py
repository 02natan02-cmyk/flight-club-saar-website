#!/usr/bin/env python3
"""Livegang-Schalter der Vereinsseite. Nur mit Natans OK ausführen.

  python3 quellen/livegang.py --domain https://www.example.de [--formmail verein@example.de]

Was er macht:
  1. robots.txt erlaubt Suchmaschinen und nennt die Sitemap, sitemap.xml aus build.PAGES
  2. build.py: noindex-Meta raus, Entwurfs-Leiste (fcs.js draftbar) aus
  3. Entwurfs-Hinweise in den Formularen raus („Entwurf“ im Betreff, draftnote-Absätze zu info@falcon-eye.de)
  4. optional: Formular-Empfänger in assets/js/data.js umstellen (FormSubmit verlangt danach eine Bestätigungsmail an die neue Adresse!)
Danach: python3 quellen/build.py, fe-pruefen, fe-livegang, Commit.
"""
import argparse, re, sys, pathlib

R = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--domain', required=True)
ap.add_argument('--formmail')
a = ap.parse_args()
dom = a.domain.rstrip('/')

sys.path.insert(0, str(R / 'quellen'))
src = (R / 'quellen/build.py').read_text(encoding='utf-8')
pages = re.findall(r"^\s*\('([a-z]+\.html)'", src, re.M)

(R / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {dom}/sitemap.xml\n', encoding='utf-8')
urls = ''.join(f'  <url><loc>{dom}/{"" if p == "index.html" else p}</loc></url>\n' for p in pages)
(R / 'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding='utf-8')

(R / 'llms.txt').write_text(f"""# Flight Club Saar e. V.
> FPV-Drohnenverein im Saarland, gegründet am 10.12.2022 in Dillingen, eingetragen im Vereinsregister Saarlouis (VR 1665).

- Im Winter Hallenfliegen mit Tiny Whoops in Hallen im Saarland (Ort für Mitglieder), Anfänger sind willkommen: {dom}/hallenfliegen.html
- Spot-Karte für Mitglieder mit Regeln und Route: {dom}/spots.html
- FPV lernen, Betaflight einrichten, Fehler finden: {dom}/wissen.html, {dom}/werkstatt.html, {dom}/hilfe.html
- FPV-Simulator im Browser: {dom}/simulator.html
- Clip-Studio und Gyroflow-Stabilisierung für Mitglieder: {dom}/studio.html
- Mitglied werden (Jahresbeitrag 30 €, unter 18 Jahren 20 €, Aufnahme einmalig 20 €): {dom}/mitglied.html
- Kontakt: info@flightclub-saar.de, Impressum: {dom}/impressum.html
""", encoding='utf-8')

# Adresse: canonical, og:image und Vorschaubilder auf die echte Domain (GitHub Pages liest die Datei CNAME)
src = src.replace("os.environ.get('FCS_BASE', 'https://02natan02-cmyk.github.io/flight-club-saar-website/')", f"os.environ.get('FCS_BASE', '{dom}/')")
host = re.sub(r'^https?://', '', dom)
(R / 'CNAME').write_text(host + '\n', encoding='utf-8')
for f in ('bald/index.html', 'hofstetter/index.html'):
    q = R / f
    if q.exists(): q.write_text(q.read_text(encoding='utf-8').replace('https://02natan02-cmyk.github.io/flight-club-saar-website/', dom + '/'), encoding='utf-8')
src = src.replace('<meta name="robots" content="noindex,nofollow">\n', '').replace('<meta name="robots" content="noindex,nofollow">', '')
(R / 'quellen/build.py').write_text(src, encoding='utf-8')

js = R / 'assets/js/fcs.js'; t = js.read_text(encoding='utf-8')
t = t.replace(' draftbar();', '', 1); js.write_text(t, encoding='utf-8')

for f in (R / 'quellen/src').glob('*.html'):
    t = f.read_text(encoding='utf-8'); o = t
    t = t.replace(', Entwurf)', ')').replace(' Entwurf">', '">')
    t = re.sub(r'\s*<p class="draftnote"[^>]*>(?:(?!</p>).)*?(?:Entwurf:|vorerst an)(?:(?!</p>).)*</p>', '', t, flags=re.S)
    if t != o: f.write_text(t, encoding='utf-8'); print('angepasst:', f.name)

if a.formmail:
    d = R / 'assets/js/data.js'; t = d.read_text(encoding='utf-8')
    t = t.replace("formMail: 'info@falcon-eye.de'", f"formMail: '{a.formmail}'"); d.write_text(t, encoding='utf-8')
    print('Formulare gehen jetzt an', a.formmail, '– FormSubmit-Bestätigungsmail abwarten!')
print('fertig: jetzt build.py, fe-pruefen, fe-livegang')
