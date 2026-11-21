#!/usr/bin/env bash
# 릴스 '릴멜의 지구 적응기 #1' 빌드 → reels/earth_reel_15s.mp4 · 저장소 루트에서: bash promo/tools/build_earth_reel.sh
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
for s in "01_space 3.4" "02_crash 3.5" "03_friends 4.0" "04_tarot 5.0"; do
  set -- $s; node tools/render.js src/reel_earth_$1.html $2 $T/$1 &
done; wait
ffmpeg -y -loglevel error \
 -framerate 30 -i $T/01_space/%04d.png -framerate 30 -i $T/02_crash/%04d.png \
 -framerate 30 -i $T/03_friends/%04d.png -framerate 30 -i $T/04_tarot/%04d.png \
 -f lavfi -t 15 -i anullsrc=r=44100:cl=stereo \
 -filter_complex "[0]settb=1/30,setpts=N[i0];[1]settb=1/30,setpts=N[i1];[2]settb=1/30,setpts=N[i2];[3]settb=1/30,setpts=N[i3];[i0][i1]xfade=transition=fadewhite:duration=0.3:offset=3.1[a];[a][i2]xfade=transition=slideleft:duration=0.3:offset=6.3[b];[b][i3]xfade=transition=fade:duration=0.3:offset=10.0,format=yuv420p[v]" \
 -map "[v]" -map 4:a -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/earth_reel_15s.mp4
for n in 01_space 02_crash 03_friends 04_tarot; do node tools/shot.js src/reel_earth_$n.html reels/earth_$n.png; done
rm -rf $T; echo "reels/earth_reel_15s.mp4 완료"
