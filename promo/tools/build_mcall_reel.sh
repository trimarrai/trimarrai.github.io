#!/usr/bin/env bash
# 릴스 '이번 주 연락운' (머리맡 알림 디자인) 빌드 → reels/mcall_reel.mp4 · 저장소 루트에서 실행
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
S="01_hook:4 02_future:3.5 03_reveal:4 04_answer:6.5 05_moment:8.5 06_tip:5.5 07_end:5"
TOT=37
for s in $S; do n=${s%%:*}; d=${s##*:}; node tools/render.js src/reel_mcall_$n.html $d $T/$n & done; wait
I=""; F=""; k=0
for s in $S; do n=${s%%:*}; I="$I -framerate 30 -i $T/$n/%04d.png"; F="$F[$k]"; k=$((k+1)); done
ffmpeg -y -loglevel error $I -f lavfi -t $TOT -i anullsrc=r=44100:cl=stereo \
 -filter_complex "${F}concat=n=$k:v=1,format=yuv420p[v]" -map "[v]" -map $k:a \
 -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/mcall_reel.mp4
for s in $S; do n=${s%%:*}; node tools/shot.js src/reel_mcall_$n.html reels/mcall/$n.png; done
rm -rf $T; echo "reels/mcall_reel.mp4 완료"
