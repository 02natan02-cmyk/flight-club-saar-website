#!/usr/bin/env python3
"""Neue Spots in die (geheime) Mitglieder-Quelle übernehmen und neu verschlüsseln.

  python3 quellen/spots_hinzufuegen.py NEUE_SPOTS.json

Liest /home/claude/fcs/geheim/mitglieder_daten.json, hängt die Spots aus NEUE_SPOTS.json an (gleiche id = ersetzen),
schreibt die Quelle zurück und ruft quellen/mitglieder_verschluesseln.py auf. Gibt nur Zahlen aus, nie Inhalte.
"""
import json, pathlib, subprocess, sys
R = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path('/home/claude/fcs/geheim/mitglieder_daten.json')
neu = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
data = json.loads(SRC.read_text(encoding='utf-8'))
spots = data.setdefault('spots', [])
vorher = len(spots)
by = {s.get('id'): i for i, s in enumerate(spots)}
ersetzt = 0
for s in neu:
    if s['id'] in by: spots[by[s['id']]] = s; ersetzt += 1
    else: spots.append(s); by[s['id']] = len(spots) - 1
SRC.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'Spots vorher {vorher}, neu {len(neu) - ersetzt}, ersetzt {ersetzt}, jetzt {len(spots)}')
subprocess.run([sys.executable, str(R / 'quellen/mitglieder_verschluesseln.py')], check=True)
