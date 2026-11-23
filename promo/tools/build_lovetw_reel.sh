#!/usr/bin/env bash
# 릴스 '솔로 연애운 최고의 카드 TOP 3' (반전 버전, 33.7초) 빌드 → reels/lovetw_reel.mp4 · 저장소 루트에서 실행
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d); L=""
S="01_hook:5.5 02_rank3:4.5 03_rank2:5 04_rank1:6.2 05_why:7 06_end:5.5"
for s in $S; do n=${s%%:*}; d=${s##*:}; node tools/render.js src/reel_lovetw_$n.html $d $T/$n & done; wait
I=""; F=""; k=0
for s in $S; do n=${s%%:*}; I="$I -framerate 30 -i $T/$n/%04d.png"; F="$F[$k]"; k=$((k+1)); done
ffmpeg -y -loglevel error $I -f lavfi -t 33.7 -i anullsrc=r=44100:cl=stereo \
 -filter_complex "${F}concat=n=6:v=1,format=yuv420p[v]" -map "[v]" -map 6:a \
 -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/lovetw_reel.mp4
for s in $S; do n=${s%%:*}; node tools/shot.js src/reel_lovetw_$n.html reels/lovetw_$n.png; done
rm -rf $T; echo "reels/lovetw_reel.mp4 완료"
