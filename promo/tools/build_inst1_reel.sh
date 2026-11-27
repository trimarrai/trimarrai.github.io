#!/usr/bin/env bash
# 릴스 '릴멜 본능타로 #1' 빌드 → reels/inst1_reel.mp4 · 저장소 루트에서 실행
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
S="01_pick:3.8 02_count:3.2 03_card1:4 04_card2:4 05_card3:4 06_end:5"
TOT=24
for s in $S; do n=${s%%:*}; d=${s##*:}; node tools/render.js src/reel_inst1_$n.html $d $T/$n & done; wait
I=""; F=""; k=0
for s in $S; do n=${s%%:*}; I="$I -framerate 30 -i $T/$n/%04d.png"; F="$F[$k]"; k=$((k+1)); done
ffmpeg -y -loglevel error $I -f lavfi -t $TOT -i anullsrc=r=44100:cl=stereo \
 -filter_complex "${F}concat=n=$k:v=1,format=yuv420p[v]" -map "[v]" -map $k:a \
 -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/inst1_reel.mp4
for s in $S; do n=${s%%:*}; node tools/shot.js src/reel_inst1_$n.html reels/inst1_$n.png; done
rm -rf $T; echo "reels/inst1_reel.mp4 완료"
