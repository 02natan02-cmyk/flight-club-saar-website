#!/usr/bin/env python3
"""Macht aus Vereinsvideos kurze, stumme Endlos-Clips für die Website (540x960, H.264, ohne Ton).
Aufruf: python3 tools/clips.py <video.mp4> <ausgabe.mp4> [start_s] [dauer_s]"""
import subprocess, sys, json
src, out = sys.argv[1], sys.argv[2]
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', src]))
dur = float(info['format']['duration'])
start = float(sys.argv[3]) if len(sys.argv) > 3 else max(0, dur * .22)
length = float(sys.argv[4]) if len(sys.argv) > 4 else 8
start = min(start, max(0, dur - length - .2))
vf = 'scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=30'
subprocess.check_call(['ffmpeg', '-y', '-v', 'error', '-ss', f'{start:.2f}', '-t', f'{length:.2f}', '-i', src, '-an', '-vf', vf,
                       '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', out])
subprocess.check_call(['ffmpeg', '-y', '-v', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1', '-vf', 'scale=540:-2', out.replace('.mp4', '.webp')])
print(out, start, length)
