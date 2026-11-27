#!/usr/bin/env bash
# 릴스 '12월이 가기 전에 꼭 정리해야 할 것' 빌드 → reels/dec_reel.mp4 · 저장소 루트에서 실행
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
S="01_hook:4.8 02_card:4 03_list:6.5 04_fix:5.3 05_end:5"
TOT=25.6
for s in $S; do n=${s%%:*}; d=${s##*:}; node tools/render.js src/reel_dec_$n.html $d $T/$n & done; wait
I=""; F=""; k=0
for s in $S; do n=${s%%:*}; I="$I -framerate 30 -i $T/$n/%04d.png"; F="$F[$k]"; k=$((k+1)); done
ffmpeg -y -loglevel error $I -f lavfi -t $TOT -i anullsrc=r=44100:cl=stereo \
 -filter_complex "${F}concat=n=$k:v=1,format=yuv420p[v]" -map "[v]" -map $k:a \
 -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/dec_reel.mp4
for s in $S; do n=${s%%:*}; node tools/shot.js src/reel_dec_$n.html reels/dec_$n.png; done
rm -rf $T; echo "reels/dec_reel.mp4 완료"
