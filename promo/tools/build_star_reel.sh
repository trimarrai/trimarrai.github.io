#!/usr/bin/env bash
# 릴스 '별' 편 빌드: 장면별 30fps 프레임 캡처 → 15초 MP4 (무음 트랙 포함)
# 필요: node + playwright(chromium), ffmpeg · 저장소 루트에서 실행: bash promo/tools/build_star_reel.sh
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
for s in "01_hook 3.0" "02_reveal 4.5" "03_message 4.3" "04_cta 3.8"; do
  set -- $s; node tools/render.js src/reel_star_$1.html $2 $T/$1 &
done; wait
ffmpeg -y -loglevel error \
 -framerate 30 -i $T/01_hook/%04d.png -framerate 30 -i $T/02_reveal/%04d.png \
 -framerate 30 -i $T/03_message/%04d.png -framerate 30 -i $T/04_cta/%04d.png \
 -f lavfi -t 15 -i anullsrc=r=44100:cl=stereo \
 -filter_complex "[0]settb=1/30,setpts=N[i0];[1]settb=1/30,setpts=N[i1];[2]settb=1/30,setpts=N[i2];[3]settb=1/30,setpts=N[i3];[i0][i1]concat=n=2:v=1,settb=1/30,setpts=N[a];[a][i2]xfade=transition=fade:duration=0.3:offset=7.2[b];[b][i3]xfade=transition=slideleft:duration=0.3:offset=11.2,format=yuv420p[v]" \
 -map "[v]" -map 4:a -c:v libx264 -profile:v high -crf 18 -preset slow -r 30 -c:a aac -b:a 128k -shortest -movflags +faststart reels/star_reel_15s.mp4
# 정지 화면(각 장면의 완성 모습)
for n in 01_hook 02_reveal 03_message 04_cta; do node tools/shot.js src/reel_star_$n.html reels/star_$n.png; done
rm -rf $T; echo "reels/star_reel_15s.mp4 완료"
