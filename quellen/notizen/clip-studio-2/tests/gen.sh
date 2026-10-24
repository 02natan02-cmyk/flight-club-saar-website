#!/bin/bash
# Testvideos in echten Formaten (kurz). Quelle: testsrc2 + Sinuston
set -e
cd tv
F="-hide_banner -loglevel error -y"
SRC="testsrc2=size=%s:rate=%s"
src(){ echo "testsrc2=size=$1:rate=$2,drawtext=text='%{pts\\:hms}':fontsize=$3:fontcolor=white:x=40:y=40:box=1:boxcolor=black@0.5"; }
AUD="-f lavfi -i sine=frequency=440:sample_rate=48000"
# --- im Playwright-Chromium NICHT dekodierbar (H.264/HEVC): pruefen Meldung + Original-Upload
ffmpeg $F -f lavfi -i "$(src 3840x2160 60 90)" $AUD -t 2 -c:v libx264 -profile:v high -level 5.2 -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 128k -shortest h264_high_4k60.mp4
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libx265 -pix_fmt yuv420p -preset ultrafast -tag:v hvc1 -x265-params log-level=error -c:a aac -shortest hevc8.mp4
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libx265 -pix_fmt yuv420p10le -preset ultrafast -tag:v hvc1 -x265-params "log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc" -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -c:a aac -shortest _iphone.mov && ffmpeg $F -display_rotation:v:0 90 -i _iphone.mov -c copy iphone_hevc10_hlg_hochkant.mov 
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libx265 -pix_fmt yuv420p10le -preset ultrafast -tag:v hvc1 -x265-params "log-level=error:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:hdr10=1" -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -c:a aac -shortest hevc10_pq_hdr10.mp4
ffmpeg $F -f lavfi -i "$(src 2720x1530 50 60)" -t 2 -c:v libx265 -pix_fmt yuv420p10le -preset ultrafast -tag:v hvc1 -x265-params log-level=error -an dji_o3_hevc10_dlogm.mp4
ffmpeg $F -f lavfi -i "$(src 2704x1520 60 60)" $AUD -t 2 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -timecode 00:00:00:00 -c:a aac -shortest gopro_h264_mit_zusatzspur.mp4
ffmpeg $F -f lavfi -i "$(src 1280x720 30 40)" $AUD -t 3 -vf "setpts='if(lt(N,30),N/30,if(lt(N,60),1+(N-30)/24,2.25+(N-60)/60))/TB'" -fps_mode vfr -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -shortest h264_vfr.mp4
# --- dekodierbar im Playwright-Chromium (VP9/AV1): echte Vorschau-, Selbsttest- und Exportpruefung
OPUS="-c:a libopus -b:a 128k"
ffmpeg $F -f lavfi -i "$(src 3840x2160 60 90)" $AUD -t 2 -c:v libvpx-vp9 -b:v 8M -deadline realtime -cpu-used 8 -row-mt 1 $OPUS -shortest vp9_4k60.webm
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libvpx-vp9 -profile:v 2 -pix_fmt yuv420p10le -b:v 4M -deadline realtime -cpu-used 8 -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc $OPUS -shortest vp9_10bit_pq_hdr.webm
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libsvtav1 -preset 12 -pix_fmt yuv420p10le -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc $OPUS -shortest _a.mp4 && ffmpeg $F -display_rotation:v:0 90 -i _a.mp4 -c copy av1_10bit_hlg_hochkant_rot.mp4
ffmpeg $F -f lavfi -i "$(src 1920x1080 30 60)" $AUD -t 3 -c:v libsvtav1 -preset 12 -pix_fmt yuv420p $OPUS -shortest _b.mp4 && ffmpeg $F -display_rotation:v:0 90 -i _b.mp4 -c copy av1_hochkant_rot.mp4
ffmpeg $F -f lavfi -i "$(src 1080x1920 30 60)" $AUD -t 6 -c:v libsvtav1 -preset 12 -pix_fmt yuv420p $OPUS -shortest av1_1080x1920.mp4
ffmpeg $F -f lavfi -i "$(src 1280x720 30 40)" $AUD -t 3 -vf "setpts='if(lt(N,30),N/30,if(lt(N,60),1+(N-30)/24,2.25+(N-60)/60))/TB'" -fps_mode vfr -c:v libvpx-vp9 -b:v 2M -deadline realtime -cpu-used 8 $OPUS -shortest vp9_vfr.webm
ffmpeg $F -f lavfi -i "$(src 1280x720 30 40),eq=brightness=-0.42:contrast=0.35" -t 3 -c:v libvpx-vp9 -b:v 1M -deadline realtime -cpu-used 8 -an vp9_dunkel_ohne_ton.webm
ffmpeg $F -f lavfi -i "color=c=black:size=1280x720:rate=30" -t 2 -c:v libvpx-vp9 -b:v 200k -deadline realtime -an vp9_schwarz.webm
# --- Musik mit bekanntem Tempo (128 und 100 BPM)
mk(){ bpm=$1; out=$2; dur=$3; p=$(python3 -c "print(60/$bpm)");
  ffmpeg $F -f lavfi -i "aevalsrc='0.9*sin(2*PI*55*t)*exp(-12*mod(t,$p))*(mod(t,$p)<0.25)+0.25*sin(2*PI*880*t)*exp(-40*mod(t+$p/2,$p))*(mod(t+$p/2,$p)<0.08)+0.08*sin(2*PI*220*t)':s=44100:d=$dur" -ac 2 $out; }
mk 128 musik_128bpm.mp3 30
mk 100 musik_100bpm.wav 24
ffmpeg $F -i musik_128bpm.mp3 -c:a aac musik_128bpm.m4a
rm -f _*.mov _*.mp4; ls -la
