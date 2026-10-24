#!/usr/bin/env python3
"""Statisches Wasserzeichen (FPV-Alien) aus Vereinsvideos holen: Median über viele Bilder,
Pixel mit kleiner Streuung gehören zum Wasserzeichen. Aufruf: alien.py <ausgabe.png> <video> [x0 y0 x1 y1 als Anteile]"""
import subprocess, sys, numpy as np, tempfile, os, glob
from PIL import Image
out, v = sys.argv[1], sys.argv[2]
box = [float(x) for x in sys.argv[3:7]] if len(sys.argv) > 6 else [.45, .62, 1, .98]
d = tempfile.mkdtemp()
subprocess.call(['ffmpeg', '-v', 'error', '-i', v, '-vf', 'fps=4', os.path.join(d, 'f%04d.png')])
fs = sorted(glob.glob(os.path.join(d, '*.png')))
im0 = Image.open(fs[0]); W, H = im0.size
x0, y0, x1, y1 = int(box[0]*W), int(box[1]*H), int(box[2]*W), int(box[3]*H)
A = np.stack([np.asarray(Image.open(f).convert('RGB'), dtype=np.float32)[y0:y1, x0:x1] for f in fs])
med = np.median(A, axis=0); sd = A.std(axis=0).mean(axis=2)
print(len(fs), 'frames', W, H)
alpha = np.clip((55 - sd) / 25, 0, 1)
Image.fromarray(np.dstack([med, alpha*255]).astype(np.uint8), 'RGBA').save(out)
Image.fromarray(med.astype(np.uint8)).save(out.replace('.png', '_med.png'))
Image.fromarray((np.clip(sd, 0, 80)*3).astype(np.uint8)).save(out.replace('.png', '_sd.png'))
