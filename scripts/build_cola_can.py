"""
Replace the Pepsi can in the shawarma kiosk with original art.

The file this replaces, public/fr_pepsi.webp, was a 420x807 pixel-art can
carrying the PEPSI wordmark twice and the Pepsi globe device. It was rendered
in the fridge overlay AND painted into the kiosk's back-wall art, so both had
to change — swapping only the sprite would have left the trademark on the wall
behind it.

Deliberately NOT a blue can with a circular device (Pepsi), and NOT a red can
with a white swoosh (Coca-Cola). Both of those are the trade dress, not just
the wordmark, and "generic cola" drawn carelessly lands on one or the other.
This is cola-brown with a cream band and the same paw mark as the energy cans,
which ties it to this app's own world rather than to anyone else's.

    py scripts/build_cola_can.py
"""

from PIL import Image, ImageDraw, ImageFilter

# Match the file being replaced exactly — the fridge overlay positions it by
# its intrinsic size, so a different aspect would shift it on the shelf.
W, H = 420, 807
SS = 2

BODY      = (94, 48, 34)
BODY_DEEP = (58, 27, 18)
BODY_LITE = (150, 88, 62)
CREAM     = (243, 232, 210)
CREAM_DIM = (206, 190, 165)
SILVER    = (198, 202, 210)
SILVER_HI = (238, 241, 246)
SILVER_LO = (140, 146, 158)


def paw(d, cx, cy, width, fill):
    """Same construction as the energy cans, so the two read as one brand."""
    u = width / 100.0
    pad_w, pad_h = 30 * u, 26 * u
    d.ellipse([cx - pad_w, cy - pad_h * 0.35, cx + pad_w, cy + pad_h * 1.25], fill=fill)
    toe_w, toe_h = 11 * u, 14 * u
    for dx, dy, sx in ((-36, -30, 0.88), (-13, -44, 1.0), (13, -44, 1.0), (36, -30, 0.88)):
        x, y = cx + dx * u, cy + dy * u
        d.ellipse([x - toe_w * sx, y - toe_h, x + toe_w * sx, y + toe_h], fill=fill)


def build():
    w, h = W * SS, H * SS
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    m = int(w * 0.06)                       # side margin
    x0, x1 = m, w - m
    lid_h = int(h * 0.085)
    y0, y1 = int(h * 0.02), h - int(h * 0.02)
    r = int(w * 0.13)

    # ── Body ────────────────────────────────────────────────────────────
    d.rounded_rectangle([x0, y0 + lid_h, x1, y1], radius=r, fill=BODY)

    shade = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    span = x1 - x0
    sd.rounded_rectangle([x0 + span * 0.64, y0 + lid_h, x1, y1], radius=r,
                         fill=BODY_DEEP + (165,))
    sd.rounded_rectangle([x0 + span * 0.13, y0 + lid_h + 8 * SS, x0 + span * 0.33, y1 - 10 * SS],
                         radius=int(r * 0.5), fill=BODY_LITE + (185,))
    shade = shade.filter(ImageFilter.GaussianBlur(9 * SS))
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0, y0 + lid_h, x1, y1], radius=r, fill=255)
    img.paste(Image.alpha_composite(img, shade), (0, 0), mask)

    # ── Cream label band ────────────────────────────────────────────────
    band_top = y0 + lid_h + (y1 - y0 - lid_h) * 0.26
    band_bot = y0 + lid_h + (y1 - y0 - lid_h) * 0.63
    band = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([x0, band_top, x1, band_bot], fill=CREAM)
    bd.rectangle([x0, band_bot - 9 * SS, x1, band_bot], fill=CREAM_DIM)
    img.paste(band, (0, 0), Image.composite(mask, Image.new('L', (w, h), 0), band.split()[3]))

    # ── Mark ────────────────────────────────────────────────────────────
    paw(d, (x0 + x1) / 2, (band_top + band_bot) / 2 + 6 * SS, span * 0.46, BODY_DEEP)

    # ── Lid ─────────────────────────────────────────────────────────────
    d.rounded_rectangle([x0, y0, x1, y0 + lid_h + 6 * SS], radius=int(r * 0.5), fill=SILVER)
    d.ellipse([x0, y0 - 8 * SS, x1, y0 + lid_h * 0.75], fill=SILVER_HI)
    d.ellipse([x0 + span * 0.11, y0, x1 - span * 0.11, y0 + lid_h * 0.55], fill=SILVER_LO)
    tab_cx = (x0 + x1) / 2
    d.ellipse([tab_cx - span * 0.09, y0 + lid_h * 0.10,
               tab_cx + span * 0.09, y0 + lid_h * 0.42],
              outline=SILVER_HI, width=int(3 * SS))

    # ── Base ────────────────────────────────────────────────────────────
    d.ellipse([x0, y1 - 14 * SS, x1, y1 + 5 * SS], fill=BODY_DEEP)

    return img.resize((W, H), Image.LANCZOS)


def patch_wall(can):
    """Paint the new can over the Pepsi baked into the kiosk back wall.

    The old can occupies x 191-237, y 916-994 (measured, not guessed). It is
    cleared with the fridge shelf's own colour sampled from just beside it, so
    the patch cannot show as a rectangle of the wrong white."""
    wall = Image.open('public/KioskBackReal.webp').convert('RGBA')
    bx0, by0, bx1, by1 = 191, 916, 237, 994
    pad = 3
    # Sample the shelf background immediately left of the can.
    bg = wall.getpixel((bx0 - 12, (by0 + by1) // 2))
    ImageDraw.Draw(wall).rectangle(
        [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad], fill=bg)

    tw = (bx1 - bx0) + pad
    th = int(tw * (H / W))
    small = can.resize((tw, th), Image.LANCZOS)
    # Sit it on the same shelf line the old can stood on.
    wall.alpha_composite(small, (bx0 - pad // 2, by1 - th))
    wall.convert('RGB').save('public/KioskBackReal.webp', 'WEBP', quality=92, method=6)
    print('patched public/KioskBackReal.webp')


if __name__ == '__main__':
    can = build()
    can.save('public/fr_cola.webp', 'WEBP', quality=95, method=6)
    print('wrote public/fr_cola.webp', can.size)
    patch_wall(can)
