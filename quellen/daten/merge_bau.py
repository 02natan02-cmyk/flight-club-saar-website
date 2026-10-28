#!/usr/bin/env python3
"""Baut die Daten der Werkbank (bau.html) aus den Rechercheergebnissen.

  python3 quellen/daten/merge_bau.py

Eingang:  quellen/daten/teile.json (+ teile_plus.json), platinen_basis.json, platinen_neu.json, platinen_neu2.json
Ausgang:  assets/data/teile.json, assets/data/platinen.json
"""
import json, re, pathlib

D = pathlib.Path(__file__).resolve().parent
R = D.parent.parent
load = lambda n: json.loads((D / n).read_text(encoding='utf-8')) if (D / n).exists() else None

# Teile
T = load('teile.json')
plus = load('teile_plus.json') or {}
for k in ('stack', 'aio'):
    have = {x['id'] for x in T[k]}
    T[k] += [x for x in plus.get(k, []) if x['id'] not in have]
T.pop('_test', None)
ids = [x['id'] for k, v in T.items() if isinstance(v, list) for x in v if isinstance(x, dict) and 'id' in x]
dup = {i for i in ids if ids.count(i) > 1}
assert not dup, f'doppelte ids: {dup}'

# Platinen
P = []
for n in ('platinen_basis.json', 'platinen_neu.json', 'platinen_neu2.json'):
    d = load(n)
    if not d: continue
    for b in d['platinen']:
        if n == 'platinen_neu2.json':
            # Helfer 2 gibt Buchsen mit der linken oberen Ecke an: Unterseite auf Mitte umrechnen, Oberseite als Bauteil führen
            for c in (b.get('unterseite') or {}).get('buchsen', []):
                c['x'] = round(c['x'] + c.get('w', 0) / 2, 3); c['y'] = round(c['y'] + c.get('h', 0) / 2, 3)
            for c in (b.pop('oberseite', None) or {}).get('buchsen', []):
                b.setdefault('teile', []).append({'typ': 'buchse', **c})
        P.append(b)
seen, out = set(), []
for b in P:
    b['board'] = b.get('board') or b.get('id')
    b['id'] = b['board']
    if b['board'] in seen: continue
    seen.add(b['board'])
    re.compile(b['match'])
    out.append(b)
# Kleine Varianten (Mini) zuerst, damit die allgemeinere Regel sie nicht schluckt
out.sort(key=lambda b: 0 if re.search(r'mini|nano|20x20', b.get('name', ''), re.I) else 1)

# Zuordnung prüfen: jede Platine der Teileliste findet ihren Plan
names = [(x['id'], x['name'] + ' ' + x.get('hersteller', '')) for x in T['stack'] + T['aio']]
ohne = []
for i, nm in names:
    L = next((b for b in out if b['board'] == i), None) or next((b for b in out if re.search(b['match'], nm, re.I)), None)
    if not L: ohne.append(i)
    elif L['board'] != i: print(f'  Hinweis: {i} nutzt Plan {L["board"]}')

(R / 'assets/data/teile.json').write_text(json.dumps(T, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(R / 'assets/data/platinen.json').write_text(json.dumps({'schema_version': 1, 'platinen': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'teile: {len(ids)} · platinen: {len(out)} · ohne Plan: {ohne}')
