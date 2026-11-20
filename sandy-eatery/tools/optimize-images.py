#!/usr/bin/env python3
"""
Optimasi foto Sandy Eatery.

Membaca semua foto di  assets-src/  lalu menulis:
  - src/img/<nama>-<lebar>.webp   (beberapa ukuran untuk srcset)
  - src/data/images.json          (ukuran tiap foto, dipakai build.mjs)
  - src/img/logo.png, ikon favicon, apple-touch-icon, og-image.jpg

Jalankan ulang setiap kali menambah/mengganti foto:
    python3 tools/optimize-images.py
Butuh Python 3 + Pillow (pip install pillow).
"""
import json, os, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "src" / "img"
DATA = ROOT / "src" / "data"
WIDTHS = [480, 800, 1200, 1600]
CREAM = (255, 248, 234)

OUT.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)

# bersihkan hasil lama supaya foto yang dihapus tidak tertinggal
for old in OUT.glob("*.webp"):
    old.unlink()

meta = {}
for p in sorted(SRC.iterdir()):
    if p.suffix.lower() not in (".jpg", ".jpeg", ".png") or p.stem == "logo":
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    name = p.stem
    variants = [x for x in WIDTHS if x < w]
    if w >= 400 and (not variants or w - variants[-1] > 120):
        variants.append(w)           # sertakan ukuran asli
    if not variants:
        variants = [w]               # foto kecil: satu ukuran saja
    for vw in variants:
        vh = round(h * vw / w)
        r = im if vw == w else im.resize((vw, vh), Image.LANCZOS)
        r.save(OUT / f"{name}-{vw}.webp", "WEBP", quality=82 if w > 600 else 90, method=6)
    meta[name] = {"w": variants[-1], "h": round(h * variants[-1] / w), "variants": variants}
    print(f"{name:28s} {w}x{h} -> {variants}")

(DATA / "images.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

# ---------- logo & ikon ----------
logo = Image.open(SRC / "logo.png").convert("RGBA")
logo.save(OUT / "logo.png", optimize=True)

def icon(size, pad_ratio, path, bg=CREAM, radius=0):
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    inner = int(size * (1 - 2 * pad_ratio))
    l = logo.copy(); l.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(l, ((size - l.width) // 2, (size - l.height) // 2))
    if radius:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius, fill=255)
        canvas.putalpha(mask)
    canvas.save(path)

icon(32, 0.06, OUT / "favicon-32.png", radius=7)
icon(192, 0.14, OUT / "icon-192.png", radius=40)
icon(512, 0.14, OUT / "icon-512.png", radius=100)
icon(180, 0.14, OUT / "apple-touch-icon.png")  # iOS membulatkan sendiri
Image.open(OUT / "icon-192.png").convert("RGBA").save(OUT.parent / "static" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# ---------- gambar pratinjau link (WhatsApp/Instagram/Google) ----------
def font(size, bold=True):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

W, H = 1200, 630
bg = Image.open(SRC / "pizza-cheese-pull-wide.jpg").convert("RGB")
scale = H / bg.height
bg = bg.resize((round(bg.width * scale), H), Image.LANCZOS)
card = Image.new("RGB", (W, H), (10, 7, 7))
card.paste(bg, (W - bg.width, 0))
# gradasi gelap di kiri agar teks terbaca
grad = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(grad)
for x in range(W):
    a = max(0, min(255, int(255 * (1 - (x - 380) / 520)))) if x > 380 else 255
    gd.line([(x, 0), (x, H)], fill=a)
card = Image.composite(Image.new("RGB", (W, H), (10, 7, 7)), card, grad)
d = ImageDraw.Draw(card)
badge = Image.new("RGB", (118, 118), CREAM)
lg = logo.copy(); lg.thumbnail((74, 92), Image.LANCZOS)
badge.paste(lg, ((118 - lg.width) // 2, (118 - lg.height) // 2), lg)
card.paste(badge, (70, 70))
d.text((70, 250), "Sandy Eatery", font=font(92), fill=(246, 234, 211))
d.text((74, 372), "Rumah Pizza Terlengkap", font=font(40), fill=(255, 210, 41))
d.text((74, 440), "Pizza  ·  Kopi  ·  Camilan   |   Malang", font=font(30, False), fill=(201, 187, 163))
card.save(OUT / "og-image.jpg", quality=88, optimize=True)
print("selesai.")
