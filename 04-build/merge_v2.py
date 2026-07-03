#!/usr/bin/env python3
"""Full page export: v2 'after critics' where available, v1 for the rest, optional mascot.
Stacks section renders into one tall PDF + PNG in 03-design/exports/.
Run from anywhere:  python3 04-build/merge_v2.py
"""
import os, sys
sys.dont_write_bytecode = True
try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    os.system(f"{sys.executable} -m pip install --quiet pillow")
    from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))   # 04-build
ROOT = os.path.dirname(HERE)                         # project root
V1   = os.path.join(ROOT, "03-design", "sections-v1")
V2   = os.path.join(ROOT, "03-design", "sections-v2-after-critics")
OUT  = os.path.join(ROOT, "03-design", "exports"); os.makedirs(OUT, exist_ok=True)
MASC = os.path.join(ROOT, "03-design", "mascot", "mascot_cut.png")

W, BG = 1672, (14, 11, 8)
ADD_MASCOT = False   # set True to float the Basyra AI mascot at the bottom edge

# section order 1..11  (v2 = refined after critics, v1 = not yet redone)
PLAN = [
    (V1, "1-Hero.png"), (V1, "2-block.png"),
    (V2, "3.png"), (V2, "4.png"), (V2, "5.png"), (V2, "6.png"),
    (V1, "7-block.png"),
    (V2, "8.png"), (V2, "9.png"), (V2, "10.png"),
    (V1, "11 - block.png"),
]

imgs = []
for d, f in PLAN:
    p = os.path.join(d, f)
    if not os.path.exists(p): print("  MISSING:", p); continue
    im = Image.open(p).convert("RGB")
    if im.width != W: im = im.resize((W, round(im.height*W/im.width)), Image.LANCZOS)
    imgs.append((f, im))

body = sum(i.height for _, i in imgs)

pad = 0; m = None; mx = my = mw = mh = 0
if ADD_MASCOT and os.path.exists(MASC):
    m = Image.open(MASC).convert("RGBA")
    mw = 300; mh = round(m.height*mw/m.width); m = m.resize((mw, mh), Image.LANCZOS)
    pad = mh + 56; mx = W - mw - 48; my = body + (pad - mh)//2

total = body + pad
canvas = Image.new("RGB", (W, total), BG)
y = 0
for _, im in imgs:
    canvas.paste(im, (0, y)); y += im.height

if m is not None:
    base = canvas.convert("RGBA")
    sh = Image.new("RGBA", canvas.size, (0,0,0,0)); sd = ImageDraw.Draw(sh)
    cx, fy = mx + mw//2, my + mh - 10
    sd.ellipse([cx-mw*0.34, fy-16, cx+mw*0.34, fy+16], fill=(0,0,0,150))
    base = Image.alpha_composite(base, sh.filter(ImageFilter.GaussianBlur(14)))
    base.paste(m, (mx, my), m); canvas = base.convert("RGB")

png = os.path.join(OUT, "website-v2-after-critics.png")
pdf = os.path.join(OUT, "website-v2-after-critics.pdf")
canvas.save(png); canvas.save(pdf, "PDF", resolution=100.0)
print(f"merged {len(imgs)} sections -> {canvas.size[0]}x{canvas.size[1]}px  (mascot={ADD_MASCOT})")
print(" ->", pdf)
