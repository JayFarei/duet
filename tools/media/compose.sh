#!/usr/bin/env bash
# compose.sh <recording.mov> <open|closed> <out-basename> [max-idle-seconds] [background]
#
# Lays a simulator recording into the device frame from frame.py and exports a self-playing animated WebP
# (GitHub autoplays it in READMEs, unlike mp4) plus an mp4 for the site. simctl records variable frame rate,
# so idle stretches are single long frames: each gap is capped at max-idle (default 0.7s) to cut dead time.
# background is the page colour behind the device (default ffffff); the site uses a -dark copy on 1c1c1e.
set -euo pipefail
in=$1 scene=$2 out=$3 idle=${4:-0.7} bg=${5:-ffffff}
dir=$(cd "$(dirname "$0")/../../docs/media" && pwd)
frame=$dir/frames/$scene.png mask=$dir/frames/$scene-mask.png
tmp=$(mktemp -d)
# where the screen sits in the frame, and the frame size rounded to even for yuv420p
read -r sx sy sw sh fw fh < <(python3 -c "
import json, struct; j = json.load(open('$dir/frames/$scene.json')); d = open('$frame', 'rb').read(24)
w, h = struct.unpack('>II', d[16:24]); print(j['x'], j['y'], j['w'], j['h'], w // 2 * 2, h // 2 * 2)")

# 1. cut idle time, constant 30fps
ffmpeg -v error -y -i "$in" -vf "setpts='if(eq(N,0),0,PREV_OUTPTS+min(PTS-PREV_INPTS,$idle/TB))',fps=30,scale=$sw:$sh:flags=lanczos" -c:v ffv1 "$tmp/cut.mkv"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/cut.mkv")

# 2. round the screen corners, lay it on a background, frame on top
ffmpeg -v error -y -t "$dur" -i "$tmp/cut.mkv" -loop 1 -t "$dur" -i "$frame" -loop 1 -t "$dur" -i "$mask" -f lavfi -t "$dur" -i "color=c=0x$bg:s=${fw}x${fh}:r=30" \
  -filter_complex "[0:v]format=rgba[v];[2:v]format=gray[m];[v][m]alphamerge[sv];[3:v][sv]overlay=$sx:$sy[b];[b][1:v]overlay=0:0,format=yuv420p" \
  -t "$dur" -c:v libx264 -crf 22 -movflags +faststart "$dir/$out.mp4"
ffmpeg -v error -y -i "$dir/$out.mp4" -vf "fps=15,scale=iw*0.33:-2:flags=lanczos" -c:v libwebp -q:v 62 -compression_level 6 -loop 0 -an "$dir/$out.webp"
rm -rf "$tmp"
ls -la "$dir/$out".*
