#!/usr/bin/env bash
# 릴스 '이번 주 연락운' (머리맡 알림 디자인) 빌드 → reels/mcall_reel.mp4 · 저장소 루트에서 실행
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
S="01_hook:4 02_future:3.5 03_reveal:4 04_answer:6.5 05_moment:8.5 06_tip:5.5 07_end:5"
TOT=37
# 배경음 + 효과음 (시각:종류)
EV="0.25:pop,2.9:pop,5.4:whoosh,7.6:whoosh,8.1:chime,11.6:pop,18.1:pop,18.6:ding,18.7:buzz,26.8:pop,33.1:pop,33.7:tick,34.0:tick"
python3 tools/make_audio.py $T/audio.wav $TOT "$EV"
for s in $S; do n=${s%%:*}; d=${s##*:}; node tools/render.js src/reel_mcall_$n.html $d $T/$n & done; wait
I=""; F=""; k=0
for s in $S; do n=${s%%:*}; I="$I -framerate 30 -i $T/$n/%04d.png"; F="$F[$k]"; k=$((k+1)); done
ffmpeg -y -loglevel error $I -i $T/audio.wav \
 -filter_complex "${F}concat=n=$k:v=1,format=yuv420p[v]" -map "[v]" -map $k:a \
 -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 160k -shortest -movflags +faststart reels/mcall_reel.mp4
for s in $S; do n=${s%%:*}; node tools/shot.js src/reel_mcall_$n.html reels/mcall/$n.png; done
# 효과음만 있는 버전 (인스타 · 유튜브 음원을 따로 깔 때)
NO_BGM=1 python3 tools/make_audio.py $T/sfx.wav $TOT "$EV"
ffmpeg -y -loglevel error -i reels/mcall_reel.mp4 -i $T/sfx.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart reels/mcall_reel_sfx.mp4
rm -rf $T; echo "reels/mcall_reel.mp4 · reels/mcall_reel_sfx.mp4 완료"
