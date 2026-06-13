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
    # De-halo: AI art on a transparent canvas leaves a translucent near-white
    # fringe (the old white matte bleeding through the anti-aliased edge). On
    # the dark bedroom that ring sparkles. Drop any NON-opaque pixel that is
    # near-white to transparent. Fully opaque pixels (a==255) are never touched,
    # so Eren's solid white fur is preserved; only the sub-pixel matte goes.
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 255 and min(r, g, b) >= 208:
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
