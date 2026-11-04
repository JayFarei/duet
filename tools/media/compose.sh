#!/usr/bin/env bash
# compose.sh <recording.mov> <open|closed> <out-basename> [max-idle-seconds] [background]
#
# Lays a simulator recording into the device frame from frame.py and exports a self-playing animated WebP
# (GitHub autoplays it in READMEs, unlike mp4) plus an mp4 for the site. simctl records variable frame rate,
# so idle stretches are single long frames: each gap is capped at max-idle (default 0.7s) to cut dead time.
# background is the page colour behind the device (default ffffff); the site uses a -dark copy on 1c1c1e.
#
# compose.sh clip <recording.mp4> <start-s> <end-s> <width> <out-path-without-ext> <w:h:x:y> <background>
#
# A site loop (tools/media/record.mjs calls it): the recording trimmed to the clip, cropped to the device on the page's
# background (Safari's own bars painted over with it, and padded with it where the crop runs off the frame). The first 0.5 s is
# dropped and the loop restarts with a hard cut: every clip ends where it began (the device back at rest), and a cross fade doubled
# the frames at the seam. H.264 at 30 fps with +faststart, and a WebP poster of frame 0.
set -euo pipefail
if [ "${1:-}" = clip ]; then
  in=$2 t0=$3 t1=$4 w=$5 out=$6 crop=$7 bg=$8 f=0.5 m=400
  IFS=: read -r cw ch cx cy <<<"$crop"
  ffmpeg -v error -y -i "$in" -filter_complex "[0:v]fps=30,trim=start=$t0:end=$t1,setpts=PTS-STARTPTS,drawbox=x=iw*0.845:y=0:w=iw:h=ih:color=0x$bg:t=fill,drawbox=x=0:y=0:w=iw:h=ih*0.075:color=0x$bg:t=fill,drawbox=x=0:y=ih*0.865:w=iw:h=ih:color=0x$bg:t=fill,pad=iw+2*$m:ih+2*$m:$m:$m:color=0x$bg,crop=$cw:$ch:$((cx + m)):$((cy + m)),scale=$w:-2:flags=lanczos,trim=start=$f,setpts=PTS-STARTPTS,fps=30,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p -movflags +faststart "$out.mp4"
  ffmpeg -v error -y -i "$out.mp4" -frames:v 1 -c:v libwebp -q:v 78 "$out.webp"
  ls -la "$out.mp4" "$out.webp"
  exit 0
fi
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
