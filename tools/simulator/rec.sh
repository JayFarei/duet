#!/bin/zsh
# Record a Duo Lab display: rec.sh start <out.mp4> | rec.sh stop <out.mp4> | rec.sh shot <out.png>. DISPLAY_ID=1 (outer,
# default) or DISPLAY_ID=3 (inner, unfolded): simctl's stable display ids, so nothing goes stale when the device is recreated.
# Drive the gestures in between (MCP sim tool touch_path / swipe), then run drift.py on the file.
U=6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4  # "Duo Lab" simulator, never the other one
D=${DISPLAY_ID:-1}
case $1 in
  start) (xcrun simctl io $U recordVideo --codec=h264 --display=$D --force "$2" > "$2.log" 2>&1 &); sleep 2 ;;
  shot) xcrun simctl io $U screenshot --display=$D "$2" > /dev/null 2>&1 ;;
  stop) pkill -INT -f "recordVideo.*$(basename $2)"; sleep 2 ;;
esac
