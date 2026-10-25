#!/bin/zsh
# Record the Duo Lab simulator's main display: rec.sh start <out.mp4> | rec.sh stop <out.mp4> | rec.sh shot <out.png>
# Drive the gestures in between (MCP sim tool touch_path / swipe), then run drift.py on the file.
U=6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4  # "Duo Lab" simulator, never the other one
D=E4F049FE-6B3C-4E5E-99D4-55E77684F8D9  # its outer display (changes when the device is recreated: `simctl io $U enumerate`, the class 0 display that is 1398x2034)
case $1 in
  start) (xcrun simctl io $U recordVideo --codec=h264 --display=$D --force "$2" > "$2.log" 2>&1 &); sleep 2 ;;
  shot) xcrun simctl io $U screenshot --display=$D "$2" > /dev/null 2>&1 ;;
  stop) pkill -INT -f "recordVideo.*$(basename $2)"; sleep 2 ;;
esac
