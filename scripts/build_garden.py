"""Build the Garden room's art: public/garden/{day,night}{,_cut}.png

The other rooms are painted pictures; the garden is drawn here instead, at
192x344 and scaled 4x with nearest-neighbour so the pixel grid matches the
chunky grid of the painted rooms (768x1376, the same canvas as the kitchen).
Rerun this rather than hand-editing the PNGs.

Four files:
  day.png / night.png          the room background (sky + garden, opaque)
  day_cut.png / night_cut.png  the same picture with the sky made transparent,
                               drawn back over the weather so the house, the
                               tree and the fence stand in front of a sunset
                               (the trick RoomWeather uses for windows)

The flower beds are NOT in the picture: GardenScene draws them over the open
lawn, so a hand-painted replacement for this art only has to leave the lawn
clear (roughly the middle third of the picture, below the fence).

    python3 scripts/build_garden.py      (needs Pillow)
"""

import math
import os
import random
from PIL import Image

W, H = 192, 344
BACK_LIFT = 14             # how far the fence, house and tree sit above where they were first drawn
LAWN_TOP = 104
SCALE = 4
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'garden')

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def hexrgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


class Canvas:
    def __init__(self):
        self.px = [[None] * W for _ in range(H)]   # None = sky (transparent in the cut)
        self.dy = 0   # shifts everything drawn while set (the back of the garden sits higher)

    def put(self, x, y, c):
        y += self.dy
        if 0 <= x < W and 0 <= y < H:
            self.px[y][x] = hexrgb(c) if isinstance(c, str) else c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                self.put(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c, shade=None, light=None):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx, dy = (x - cx) / rx, (y - cy) / ry
                d = dx * dx + dy * dy
                if d <= 1:
                    col = c
                    if shade and dx * 0.6 + dy * 0.8 > 0.45:
                        col = shade
                    if light and dx * -0.6 + dy * -0.8 > 0.55:
                        col = light
                    self.put(x, y, col)

    def vgrad(self, x0, y0, x1, y1, top, bot):
        """Vertical gradient, ordered-dithered between bands."""
        top, bot = hexrgb(top), hexrgb(bot)
        steps = 6
        for y in range(y0, y1):
            t = (y - y0) / max(1, (y1 - y0 - 1))
            band = t * steps
            lo = int(band)
            frac = band - lo
            for x in range(x0, x1):
                k = lo + (1 if frac * 16 > BAYER[y % 4][x % 4] else 0)
                self.put(x, y, mix(top, bot, min(k, steps) / steps))


def draw(night=False):
    rnd = random.Random(7)
    c = Canvas()
    SKY_END = 118

    # ── The hills and the far trees (the back of the garden, raised) ─────────
    c.dy = -BACK_LIFT
    hills = Canvas()
    hills.vgrad(0, 86, W, 120, '#A9D3B8', '#8CC29C')
    for x in range(W):                                                # rolling hill line
        top = 92 + int(5 * (1 + math.sin(x / 17.0)) + 3 * math.sin(x / 7.3))
        for y in range(top, 120):
            c.put(x, y, hills.px[y][x])
    for i in range(0, W + 12, 11):                                    # tree line
        r = 7 + rnd.randint(0, 4)
        c.ellipse(i, 116, r, r - 1, '#5E9E6C', shade='#4E8F5E', light='#78B583')

    c.dy = 0
    # Lawn: soft mowing stripes, darker toward the fence
    for y in range(LAWN_TOP, H):
        for x in range(W):
            stripe = ((x + (y - LAWN_TOP) // 3) // 16) % 2
            base = '#9FD07F' if stripe else '#95C877'
            col = hexrgb(base)
            if y < LAWN_TOP + 30:
                col = mix(col, hexrgb('#7FB765'), (LAWN_TOP + 30 - y) / 40)
            c.put(x, y, col)
    # Grass flecks and tufts
    for _ in range(900):
        x, y = rnd.randrange(W), rnd.randrange(LAWN_TOP + 30, H)
        c.put(x, y, '#86BD6A' if rnd.random() < 0.7 else '#B3DC92')
    for _ in range(60):
        x, y = rnd.randrange(4, W - 4), rnd.randrange(LAWN_TOP + 40, H - 4)
        for dx, dy in ((0, 0), (-1, -1), (1, -1), (0, -2), (-2, -2), (2, -2)):
            c.put(x + dx, y + dy, '#6FA65A')
    # Tiny clover flowers
    for _ in range(40):
        x, y = rnd.randrange(4, W - 4), rnd.randrange(LAWN_TOP + 44, H - 6)
        col = rnd.choice(['#FFFFFF', '#FFF3C4', '#F6BCCD'])
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            c.put(x + dx, y + dy, col)
        c.put(x, y, '#F2B33D')


    # Stepping stones from the gate, out onto the lawn (the beds sit below)
    for i, (cx, cy, rx, ry) in enumerate([(97, 145, 5, 2), (95, 151, 6, 2), (98, 158, 7, 3), (95, 166, 8, 3), (98, 175, 9, 3)]):
        c.ellipse(cx, cy + 1, rx, ry, '#86BD6A')
        c.ellipse(cx, cy, rx, ry, '#DAD2C2', shade='#C3BAA8', light='#ECE6DA')

    c.dy = -BACK_LIFT
    # ── The fence across the back ────────────────────────────────────────────
    for x in range(W):
        for y in (134, 135, 146, 147):
            c.put(x, y, '#C9AE80')
    for x in range(-2, W, 9):
        if 84 <= x <= 108:            # leave the gate opening
            continue
        for y in range(126, 156):
            for dx in range(6):
                col = '#EFDCB4' if dx < 4 else '#CDB386'
                if y < 128 and (dx == 0 or dx == 5):
                    continue                                          # pointed top
                c.put(x + dx, y, col)
        c.put(x + 1, 152, '#B49A6E')
    # The gate, ajar
    for y in range(128, 156):
        for x in range(86, 94):
            c.put(x, y, '#E6CFA2' if (x - 86) % 4 else '#C2A677')
    c.rect(86, 133, 94, 135, '#B08F5E')
    c.rect(86, 146, 94, 148, '#B08F5E')
    # Roses climbing the fence
    for _ in range(26):
        x = rnd.choice([rnd.randrange(14, 70), rnd.randrange(118, 150)])
        y = rnd.randrange(124, 152)
        c.ellipse(x, y, 2, 2, '#6FA65A')
        if rnd.random() < 0.6:
            c.put(x, y, rnd.choice(['#E57C9F', '#F6BCCD', '#E0574A']))

    # ── The house wall on the left: siding, a window, the back door ──────────
    for y in range(40, 168):
        for x in range(0, 40):
            col = '#F3E3C3' if (y // 5) % 2 == 0 else '#EAD7B0'
            if x > 36:
                col = '#D9C39A'
            c.put(x, y, col)
    c.rect(0, 36, 44, 41, '#B5714E')                                  # eave
    c.rect(0, 41, 44, 43, '#8F5538')
    # Window
    c.rect(8, 60, 32, 88, '#FFFFFF')
    glass = '#FFE6A6' if night else '#BFE3F5'
    c.rect(10, 62, 30, 86, glass)
    c.rect(19, 62, 21, 86, '#FFFFFF')
    c.rect(10, 73, 30, 75, '#FFFFFF')
    if not night:
        for i in range(5):
            c.put(12 + i, 64 + i, '#E6F5FC')
    c.rect(6, 88, 34, 92, '#D9C39A')                                  # sill
    for i, col in enumerate(['#E57C9F', '#F2B33D', '#E0574A']):       # window box flowers
        c.ellipse(11 + i * 8, 88, 3, 2, '#5E9E6C')
        c.put(11 + i * 8, 87, col)
    # Back door and step
    c.rect(10, 112, 32, 162, '#9C6A45')
    c.rect(12, 114, 30, 160, '#B07A52')
    c.rect(14, 118, 28, 132, '#C99068')
    c.rect(14, 136, 28, 156, '#C99068')
    c.put(27, 140, '#F2B33D')
    c.rect(6, 162, 38, 168, '#CFC7B6')
    c.rect(4, 166, 40, 170, '#B9B09E')

    # ── The apple tree on the right ──────────────────────────────────────────
    c.rect(158, 104, 169, 172, '#7A4E32')
    c.rect(165, 104, 169, 172, '#5E3B26')
    c.rect(160, 120, 162, 150, '#8E6040')
    for i in range(5):
        c.put(157 - i, 166 + i, '#7A4E32')
        c.put(156 - i, 167 + i, '#7A4E32')
        c.put(169 + i, 167 + i, '#5E3B26')
        c.put(170 + i, 168 + i, '#5E3B26')
    for (cx, cy, r) in [(164, 82, 27), (145, 94, 18), (183, 92, 18), (162, 62, 19), (177, 70, 16), (149, 72, 15)]:
        c.ellipse(cx, cy, r, r - 2, '#5FA067', shade='#4A8A55', light='#7DBA7C')
    for _ in range(14):
        x, y = rnd.randrange(140, 190), rnd.randrange(60, 108)
        if c.px[y][x] is not None:
            c.put(x, y, '#E0574A')
            c.put(x + 1, y, '#E0574A')
            c.put(x, y + 1, '#B5392F')
            c.put(x + 1, y + 1, '#E0574A')
            c.put(x, y - 1, '#FF8A7A')
    # Fallen apples and the tree's shade on the lawn
    for y in range(170, 180):
        for x in range(140, 192):
            if ((x - 165) / 28) ** 2 + ((y - 175) / 5) ** 2 <= 1 and c.px[y][x] is not None:
                c.put(x, y, mix(c.px[y][x], hexrgb('#5E8F4E'), 0.35))
    for (x, y) in [(150, 176), (178, 178)]:
        c.rect(x, y, x + 3, y + 3, '#E0574A')
        c.put(x, y, '#FF8A7A')

    c.dy = 0

    # Watering can on the lawn, front left: clear of the beds, which GardenScene
    # draws across the middle of the lawn (a can behind a flower read as a hat).
    wx, wy = 44, 288
    c.ellipse(wx + 1, wy + 6, 9, 2, '#86BD6A')
    c.ellipse(wx, wy, 6, 4, '#7FB0D8', shade='#5E8FB8', light='#A9CBEA')
    c.rect(wx + 5, wy - 8, wx + 7, wy - 1, '#5E8FB8')
    for i in range(6):
        c.put(wx + 6 + i, wy - 4 - i // 2, '#5E8FB8')
    for x in range(wx - 4, wx + 4):
        c.put(x, wy - 6 + abs(x - wx) // 3, '#5E8FB8')

    # ── A birdbath on the lawn, front right, out of the beds' way ────────────
    c.rect(170, 300, 176, 322, '#CFC7B6')
    c.rect(174, 300, 176, 322, '#B9B09E')
    c.ellipse(173, 299, 13, 4, '#DAD2C2', shade='#B9B09E')
    c.ellipse(173, 298, 10, 2, '#9FD3EC', light='#CFEAF7')
    c.ellipse(173, 324, 9, 3, '#B9B09E')

    # A flower bush, front left
    c.ellipse(16, 312, 17, 12, '#5E9E6C', shade='#4E8F5E', light='#78B583')
    for _ in range(12):
        x, y = rnd.randrange(4, 30), rnd.randrange(303, 320)
        if c.px[y][x] is not None:
            c.put(x, y, rnd.choice(['#E57C9F', '#FFFFFF', '#F2B33D']))

    return c, SKY_END


def sky(night):
    s = Canvas()
    if night:
        s.vgrad(0, 0, W, 122, '#1B2140', '#3B3F6E')
        rnd = random.Random(3)
        for _ in range(70):
            x, y = rnd.randrange(W), rnd.randrange(0, 100)
            s.put(x, y, '#FFF6D5' if rnd.random() < 0.3 else '#B8BEE0')
        s.ellipse(52, 34, 9, 9, '#FFF3C4', shade='#F2D27A')
        s.ellipse(56, 31, 8, 8, '#3B3F6E')                            # crescent
    else:
        s.vgrad(0, 0, W, 122, '#8EC9F0', '#D4EEF8')
        for (cx, cy, r) in [(40, 30, 10), (52, 26, 12), (64, 31, 9), (120, 52, 8), (130, 48, 10), (141, 53, 7)]:
            s.ellipse(cx, cy, r, r * 0.6, '#FFFFFF', shade='#E3F1FA')
    return s


NIGHT = hexrgb('#2A3260')


def nightify(col):
    """Moonlight: darker, cooler, a little desaturated. Not too dark: the beds
    and flowers are drawn over this, and a night garden still has to read."""
    r, g, b = col
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    d = mix((round(lum),) * 3, col, 0.7)
    return mix(d, NIGHT, 0.42)


def light(x, y, col, night):
    """The painted rooms are lit: warm light from the upper left, and a soft
    vignette that darkens the edges and the bottom. Flat colour reads as a
    diagram next to them, so the garden gets the same treatment."""
    nx, ny = x / W, y / H
    edge = max(0.0, (abs(nx - 0.5) - 0.32) * 2.2) + max(0.0, (ny - 0.78) * 1.1)
    shade = min(0.18 if night else 0.28, edge * 0.35)
    col = mix(col, (40, 30, 50) if night else (70, 60, 40), shade)
    if not night:
        warm = max(0.0, 0.10 - 0.10 * (nx * 0.6 + ny * 0.9))
        col = mix(col, (255, 236, 196), warm)
    return col


def save(canvas, sky_canvas, name, night):
    full = Image.new('RGBA', (W, H))
    cut = Image.new('RGBA', (W, H))
    fp, cp = full.load(), cut.load()
    for y in range(H):
        for x in range(W):
            p = canvas.px[y][x]
            if p is None:
                fp[x, y] = (*light(x, y, sky_canvas.px[y][x], night), 255)
                cp[x, y] = (0, 0, 0, 0)
            else:
                col = p
                if night:
                    col = nightify(p)
                    # the lit window and the stars stay bright
                    if p == hexrgb('#FFE6A6'):
                        col = p
                col = light(x, y, col, night)
                fp[x, y] = (*col, 255)
                cp[x, y] = (*col, 255)
    size = (W * SCALE, H * SCALE)
    full.convert('RGB').resize(size, Image.NEAREST).save(os.path.join(OUT, f'{name}.png'), optimize=True)
    cut.resize(size, Image.NEAREST).save(os.path.join(OUT, f'{name}_cut.png'), optimize=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for night in (False, True):
        canvas, _ = draw(night)
        save(canvas, sky(night), 'night' if night else 'day', night)
    print('wrote', sorted(os.listdir(OUT)))
