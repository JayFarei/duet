"""frame.py [--out docs/media/frames] [--scale 2]

Builds the device frames compose.sh lays simulator recordings into, from the iPhone Duo artwork that ships with
Xcode's simulator (so the outline is Apple's, not a guess). Needs Xcode. Writes per posture:
  <posture>.png        the device with a transparent screen hole
  <posture>-mask.png   the screen's shape, screen-sized (white = visible)
  <posture>.json       where the screen sits in the frame: {"x", "y", "w", "h"} in pixels

closed  the outer display as the simulator draws it: hinge spine on the left, square corners on the hinge side,
        big rounded corners on the free edge, volume buttons on top, power button on the right.
open    the inner display. Unfolded, both side edges are free edges, so the free edge of the closed body is
        mirrored onto the left and the straight bezel stretched to the inner display's size.

The outputs are derived from Apple's artwork: they are gitignored, regenerate them instead of committing them.
"""
import argparse, json, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageOps

CHROME = "/Library/Developer/DeviceKit/Chrome/phone15.devicechrome/Contents/Resources"
DEVICE = "/Library/Developer/CoreSimulator/Profiles/DeviceTypes/iPhone Duo.simdevicetype/Contents/Resources"
CLOSED_MASK, OPEN_MASK = "1C896A2B-F0D7-405C-8D0F-66E4B80AD044.pdf", "BF0DC480-5EE2-4EC1-B02B-C75E94759832.pdf"
# Measured against a capture of the Simulator window (exact match): the screen inside the body, and the buttons
# relative to the body's top-left corner. Points.
SCREEN_AT = (26, 14)
BUTTONS = [("Vol BTN", 236, -4), ("Vol BTN", 316, -4), ("X_Power BTN", 494, 202)]
CLOSED, OPEN = (466, 678), (951, 669)  # screen sizes, points
BEZEL_OPEN = (22, 14)  # side and top/bottom bezel of the unfolded body, points
PAD = 8  # transparent margin around the device, points

p = argparse.ArgumentParser()
p.add_argument("--out", default="docs/media/frames")
p.add_argument("--scale", type=float, default=2)
a = p.parse_args()
S = a.scale
os.makedirs(a.out, exist_ok=True)
tmp = tempfile.mkdtemp()
tool = os.path.join(tmp, "pdf2png")
subprocess.run(["swiftc", "-O", "-o", tool, os.path.join(os.path.dirname(__file__), "pdf2png.swift")], check=True)


def pdf(path, scale):
    out = os.path.join(tmp, os.path.basename(path) + f"@{scale}.png")
    subprocess.run([tool, path, out, str(scale)], check=True)
    return Image.open(out).convert("RGBA")


def px(v):
    return round(v * S)


def save(name, frame, mask, at):
    frame.save(f"{a.out}/{name}.png")
    mask.save(f"{a.out}/{name}-mask.png")
    json.dump({"x": at[0], "y": at[1], "w": mask.width, "h": mask.height}, open(f"{a.out}/{name}.json", "w"))
    print(name, frame.size, "screen", at, mask.size)


def punch(frame, mask, at):
    """Clears the screen area of the frame so the recording shows through."""
    hole = Image.new("L", frame.size, 0)
    hole.paste(mask, at)
    frame.putalpha(Image.composite(Image.new("L", frame.size, 0), frame.getchannel("A"), hole))


body = pdf(f"{CHROME}/PhoneComposite.pdf", S)

# Closed: body, buttons behind it, screen hole from the simulator's framebuffer mask.
pad = px(PAD)
closed = Image.new("RGBA", (body.width + 2 * pad, body.height + 2 * pad))
for name, x, y in BUTTONS:
    closed.alpha_composite(pdf(f"{CHROME}/{name}.pdf", S), (pad + px(x), pad + px(y)))
closed.alpha_composite(body, (pad, pad))
mask = pdf(f"{DEVICE}/{CLOSED_MASK}", S).getchannel("A").resize((px(CLOSED[0]), px(CLOSED[1])), Image.LANCZOS)
at = (pad + px(SCREEN_AT[0]), pad + px(SCREEN_AT[1]))
punch(closed, mask, at)
save("closed", closed, mask, at)

# Open: free edge of the body (right side, past its corner) mirrored left, straight bezel stretched between.
edge = body.crop((px(380), 0, body.width, body.height))
w, h = px(OPEN[0] + 2 * BEZEL_OPEN[0]), px(OPEN[1] + 2 * BEZEL_OPEN[1])
top, bot = h // 2, h - h // 2  # cut the straight middle of the side to shorten the body to the inner height
side = Image.new("RGBA", (edge.width, h))
side.paste(edge.crop((0, 0, edge.width, top)), (0, 0))
side.paste(edge.crop((0, edge.height - bot, edge.width, edge.height)), (0, top))
fill = side.crop((0, 0, 1, h)).resize((w - 2 * side.width, h))
shell = Image.new("RGBA", (w + 2 * pad, h + 2 * pad))
shell.paste(ImageOps.mirror(side), (pad, pad))
shell.paste(fill, (pad + side.width, pad))
shell.paste(side, (pad + w - side.width, pad))
# The right half is the closed body unfolded, so its buttons keep their place relative to the free edge.
opened, dx = Image.new("RGBA", shell.size), pad + w - side.width - px(380)
for name, x, y in BUTTONS:
    opened.alpha_composite(pdf(f"{CHROME}/{name}.pdf", S), (dx + px(x), pad + px(y)))
opened.alpha_composite(shell)
mask = pdf(f"{DEVICE}/{OPEN_MASK}", 1).getchannel("A").rotate(90, expand=True).resize((px(OPEN[0]), px(OPEN[1])), Image.LANCZOS)
at = (pad + px(BEZEL_OPEN[0]), pad + px(BEZEL_OPEN[1]))
punch(opened, mask, at)
# The fold: a faint crease down the middle of the inner display, drawn over the recording.
crease = Image.new("RGBA", opened.size)
cx, cw = at[0] + mask.width // 2, px(10)
d = ImageDraw.Draw(crease)
d.rectangle((cx - cw // 2, at[1], cx, at[1] + mask.height), fill=(0, 0, 0, 14))
d.rectangle((cx, at[1], cx + cw // 2, at[1] + mask.height), fill=(255, 255, 255, 16))
opened.alpha_composite(crease.filter(ImageFilter.GaussianBlur(px(3))))
save("open", opened, mask, at)
