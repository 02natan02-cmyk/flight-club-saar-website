#!/bin/sh
# Baut die ElevenLabs-Stimme in die Hofstetter-Präsentation ein.
# Aufruf: sh werkzeug/stimme_einbauen.sh <take.mp3>
# Take 1 (109 s) oder Take 2 (111 s) wird an der Länge erkannt, die Wortzeiten für beide stehen schon in index.html.
set -e
HIER=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$1" ] || { echo "Datei fehlt: $1"; exit 1; }
ffmpeg -v error -y -i "$1" -af "loudnorm=I=-15:TP=-1.2:LRA=9" -ar 44100 -ac 1 -c:a libmp3lame -b:a 112k "$HIER/audio/stimme.mp3"
sed -i 's/var HAS_VOICE=false;/var HAS_VOICE=true;/' "$HIER/index.html"
echo "eingebaut: $HIER/audio/stimme.mp3 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$HIER/audio/stimme.mp3") s)"
