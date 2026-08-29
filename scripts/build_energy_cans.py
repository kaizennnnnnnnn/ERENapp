"""
Generate original energy-can art for the `monsta_*` food ids.

Why this exists
---------------
The files these replace were renders of REAL Monster Energy cans — the claw
device and the MONSTER ENERGY wordmark were legible in the pixels. Renaming
would not have helped; the infringement was the artwork itself. Google Play's
IP process is takedown on complaint, with no warning and no grace period.

The ids (`monsta_original`, ...) are deliberately NOT renamed: they are stored
in user inventories, gift payloads and purchase history, so changing them would
orphan real data. "Monsta" is an invented word and carries no mark. Only the
pixels and the flavour names needed to change.

Design constraints, in the order they mattered
----------------------------------------------
* Same 128x128 canvas and the same ~52x124 content box as the originals, so
  nothing in the shop grid or the fridge shifts.
* Renders at 32px in FoodIcon. Anything finer than a bold silhouette turns to
  mush, so there is no text on these cans at all — colour and one mark do the
  identifying work.
* The mark is a PAW, not a slash. It had to be unmistakably not-a-claw, and the
  app is about a cat, so the obvious original mark was already sitting there.
* Body colour comes from the `color` already declared per-flavour in
  foodMeta.ts, so the can matches the swatch the UI draws elsewhere.

Drawn at 4x and LANCZOS-downsampled — these render smooth, not pixelated
(FoodIcon uses the plate recipe, not the PixelIcons canvas).

    py scripts/build_energy_cans.py
"""

from PIL import Image, ImageDraw, ImageFilter
import colorsys

OUT = 128
SS = 4                      # supersample factor
W = OUT * SS

# Content box measured off the originals so the swap is drop-in.
CAN_X0, CAN_X1 = 38 * SS, 90 * SS
CAN_Y0, CAN_Y1 = 2 * SS, 126 * SS

# The `color` field each flavour already declares in src/lib/foodMeta.ts.
FLAVOURS = {
    'monsta_original': '#A6E728',
    'monsta_white':    '#2FBCB3',
    'monsta_mango':    '#F9A300',
    'monsta_loco':     '#69C7EB',
    'monsta_pipeline': '#F96679',
    'monsta_punch':    '#E9665C',
    'monsta_rosa':     '#D05C8D',
    'monsta_peachy':   '#F9AB94',
    'monsta_rainbow':  '#B65CF0',
    'monsta_gold':     '#D89C24',
}


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shift(rgb, dl=0.0, ds=0.0):
    """Nudge lightness/saturation in HLS — keeps the hue exactly."""
    r, g, b = [c / 255 for c in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    return tuple(int(round(c * 255)) for c in colorsys.hls_to_rgb(h, l, s))


def paw(d, cx, cy, width, fill):
    """A paw print sized by its OVERALL width, not by an abstract scale factor.

    Sizing by scale was the first attempt and it was unusable: the toes ran off
    the top of the can and the pad read as an egg. Driving everything from the
    finished width keeps the mark inside the body no matter the canvas."""
    u = width / 100.0                      # one unit = 1% of total paw width
    pad_w, pad_h = 30 * u, 26 * u
    d.ellipse([cx - pad_w, cy - pad_h * 0.35, cx + pad_w, cy + pad_h * 1.25], fill=fill)
    toe_w, toe_h = 11 * u, 14 * u
    # Four toes on a shallow arc: outer pair sits lower and tilts outward.
    for dx, dy, sx in ((-36, -30, 0.88), (-13, -44, 1.0), (13, -44, 1.0), (36, -30, 0.88)):
        x, y = cx + dx * u, cy + dy * u
        d.ellipse([x - toe_w * sx, y - toe_h, x + toe_w * sx, y + toe_h], fill=fill)


def build(colour_hex):
    base = hex_rgb(colour_hex)
    dark = shift(base, dl=-0.26, ds=0.06)
    deep = shift(base, dl=-0.40, ds=0.04)
    lite = shift(base, dl=+0.24, ds=-0.06)

    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body_r = 9 * SS
    lid_h = 7 * SS

    # ── Body ─────────────────────────────────────────────────────────────
    d.rounded_rectangle([CAN_X0, CAN_Y0 + lid_h, CAN_X1, CAN_Y1],
                        radius=body_r, fill=base)

    # Cylinder shading: a dark right flank and a bright left highlight, both
    # feathered. Without these the can reads as a flat rounded rectangle.
    shade = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    span = CAN_X1 - CAN_X0
    sd.rounded_rectangle([CAN_X0 + span * 0.62, CAN_Y0 + lid_h, CAN_X1, CAN_Y1],
                         radius=body_r, fill=deep + (150,))
    sd.rounded_rectangle([CAN_X0 + span * 0.14, CAN_Y0 + lid_h + 2 * SS,
                          CAN_X0 + span * 0.34, CAN_Y1 - 3 * SS],
                         radius=5 * SS, fill=lite + (185,))
    shade = shade.filter(ImageFilter.GaussianBlur(3.4 * SS))
    # Composite through the body silhouette so the blur cannot bleed outside.
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [CAN_X0, CAN_Y0 + lid_h, CAN_X1, CAN_Y1], radius=body_r, fill=255)
    img.paste(Image.alpha_composite(img, shade), (0, 0), mask)

    # ── Waist band ───────────────────────────────────────────────────────
    band_y = CAN_Y0 + lid_h + (CAN_Y1 - CAN_Y0 - lid_h) * 0.66
    d.rectangle([CAN_X0, band_y, CAN_X1, band_y + 5 * SS], fill=dark)

    # ── Mark ─────────────────────────────────────────────────────────────
    # White on a dark-enough body, otherwise the deep shade of its own hue —
    # a light can (peachy) with a white paw would have no mark at all.
    lum = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]
    ink = (255, 255, 255, 240) if lum < 165 else deep + (245,)
    body_top = CAN_Y0 + lid_h
    paw(d, (CAN_X0 + CAN_X1) / 2,
        body_top + (band_y - body_top) * 0.52,
        (CAN_X1 - CAN_X0) * 0.54, ink)

    # ── Lid ──────────────────────────────────────────────────────────────
    silver, silver_hi, silver_lo = (198, 202, 210), (238, 241, 246), (140, 146, 158)
    d.rounded_rectangle([CAN_X0, CAN_Y0, CAN_X1, CAN_Y0 + lid_h + 2 * SS],
                        radius=4 * SS, fill=silver)
    d.ellipse([CAN_X0, CAN_Y0 - 2 * SS, CAN_X1, CAN_Y0 + 5 * SS], fill=silver_hi)
    d.ellipse([CAN_X0 + 5 * SS, CAN_Y0, CAN_X1 - 5 * SS, CAN_Y0 + 4 * SS], fill=silver_lo)
    # Pull tab.
    tab_cx = (CAN_X0 + CAN_X1) / 2
    d.ellipse([tab_cx - 4 * SS, CAN_Y0 + 0.6 * SS, tab_cx + 4 * SS, CAN_Y0 + 3.4 * SS],
              outline=silver_hi, width=int(1.2 * SS))

    # ── Base ─────────────────────────────────────────────────────────────
    d.ellipse([CAN_X0, CAN_Y1 - 5 * SS, CAN_X1, CAN_Y1 + 2 * SS], fill=deep)

    return img.resize((OUT, OUT), Image.LANCZOS)


def rainbow_overlay(img):
    """Rainbow is the gacha-only special edition, so it earns a hue sweep."""
    w = img.size[0]
    grad = Image.new('RGBA', (w, w))
    gd = ImageDraw.Draw(grad)
    for y in range(w):
        h = (y / w) * 0.82
        r, g, b = colorsys.hls_to_rgb(h, 0.58, 0.95)
        gd.line([(0, y), (w, y)], fill=(int(r * 255), int(g * 255), int(b * 255), 120))
    return Image.alpha_composite(img, Image.composite(
        grad, Image.new('RGBA', (w, w), (0, 0, 0, 0)), img.split()[3]))


if __name__ == '__main__':
    for fid, colour in FLAVOURS.items():
        im = build(colour)
        if fid == 'monsta_rainbow':
            im = rainbow_overlay(im)
        path = f'public/food/{fid}.png'
        im.save(path, optimize=True)
        print('wrote', path, im.size, im.getbbox())
