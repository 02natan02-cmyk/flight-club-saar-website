#!/usr/bin/env python3
"""Mitglieder-Bereich: Hallen, Halle je Termin und Spots verschlüsselt ablegen.

  python3 quellen/mitglieder_verschluesseln.py [QUELLE.json] [CODEDATEI]

Standard: Quelle /home/claude/fcs/geheim/mitglieder_daten.json, Code /home/claude/fcs/geheim/jahrescode.txt
(Klartext und Code liegen NIE im Repo, Kopie bei Natan in OneDrive alcutruz\\_FCS_INTERN).
Ausgang: assets/data/mitglieder.enc.json (AES-GCM 256, Schlüssel per PBKDF2-SHA256 aus dem Jahrescode).
Neuer Jahrescode: Codedatei ändern, Skript laufen lassen, build, prüfen, pushen. Mit dem alten Code
verschlüsselte Spot-Meldungen bei Make dann mit quellen/mitglieder_verschluesseln.py --umschluesseln neu verschlüsseln (TODO bei Bedarf).
Gleiches Verfahren im Browser: FCS.member in assets/js/fcs.js.
"""
import base64, json, os, sys, pathlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

R = pathlib.Path(__file__).resolve().parent.parent
SALT = b'flight-club-saar|mitglieder|v1'
ITER = 250000

def norm(c): return ''.join(ch for ch in c.strip().upper() if ch not in ' -_.')
def key(code): return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=SALT, iterations=ITER).derive(norm(code).encode())
def enc(k, text):
    iv = os.urandom(12); return 'enc1:' + base64.b64encode(iv + AESGCM(k).encrypt(iv, text.encode(), None)).decode()
def dec(k, s):
    raw = base64.b64decode(s[5:]); return AESGCM(k).decrypt(raw[:12], raw[12:], None).decode()

if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/home/claude/fcs/geheim/mitglieder_daten.json')
    code = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/home/claude/fcs/geheim/jahrescode.txt').read_text().strip()
    k = key(code)
    data = json.loads(src.read_text(encoding='utf-8'))
    out = {'v': 1, 'iter': ITER, 'data': enc(k, json.dumps(data, ensure_ascii=False, separators=(',', ':')))}
    assert json.loads(dec(k, out['data'])) == data
    (R / 'assets/data/mitglieder.enc.json').write_text(json.dumps(out), encoding='utf-8')
    print('verschlüsselt:', len(data.get('spots', [])), 'Spots,', len(data.get('hallen', {})), 'Hallen')
