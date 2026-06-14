import os
from PIL import Image

SRC = r'C:\Users\Lenovo\Downloads'
OUT = r'C:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public'

# (source name, output name)
JOBS = [
    ('Sleep1', 'erenSleep1'), ('Sleep2', 'erenSleep2'),
    ('Sleep3', 'erenSleep3'), ('Sleep4', 'erenSleep4'),
    ('Eating1', 'erenEat1'), ('Eating2', 'erenEat2'),
    ('Eating3', 'erenEat3'), ('Eating4', 'erenEat4'),
]

def clean_and_trim(im):
    im = im.convert('RGBA')
    W, H = im.size
    px = im.load()

    def lum(p):
        return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]

    # ── Peel the white HALO ring ────────────────────────────────────────────
    # The AI sticker art wraps the whole silhouette in a thin near-white outline
    # that sits OUTSIDE the dark pixel-art outline. It's fully opaque, so a
    # translucent-only clean leaves it, and it only reveals itself once the
    # sprite is composited over a room background (a white frame around him).
    # A halo pixel is near-white AND touches BOTH transparency (outside) and a
    # dark outline pixel (inside) — that geometry is unique to the ring. His
    # real white FUR edges touch transparency but border white fur (no dark
    # outline), so they survive. Iterate so 2px-thick rings peel fully.
    for _ in range(3):
        kill = []
        for y in range(H):
            for x in range(W):
                p = px[x, y]
                if p[3] < 32 or min(p[0], p[1], p[2]) < 190:
                    continue
                touch_transparent = touch_dark = False
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if not (0 <= nx < W and 0 <= ny < H):
                            continue
                        q = px[nx, ny]
                        if q[3] < 64:
                            touch_transparent = True
                        elif q[3] >= 128 and lum(q) <= 95:
                            touch_dark = True
                if touch_transparent and touch_dark:
                    kill.append((x, y))
        if not kill:
            break
        for (x, y) in kill:
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)

    # Drop any remaining translucent near-white fringe for crisp pixel edges.
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 255 and min(r, g, b) >= 200:
                px[x, y] = (r, g, b, 0)

    # Trim to the opaque content box so the image's bottom edge == Eren's
    # contact line and its width == his width (scene anchors by bottom, centers
    # by width — no object-fit letterbox math).
    bbox = im.getbbox()  # respects alpha
    return im.crop(bbox)

for sname, oname in JOBS:
    im = Image.open(os.path.join(SRC, sname + '.png'))
    out = clean_and_trim(im)
    out.save(os.path.join(OUT, oname + '.png'))
    w, h = out.size
    print(f'{oname}.png  {w}x{h}  (aspect {w/h:.3f})')
