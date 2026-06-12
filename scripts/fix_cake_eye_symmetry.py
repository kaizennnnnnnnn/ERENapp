# Make ErenCakeShop's right eye an exact mirror of the left eye so the dark
# pupil/iris reads the same on both sides (most visible at night, when the
# bakery's sepia filter darkens the blue iris into the dark mass and the
# baked ~1px pixel-art asymmetry shows as "more black on the right eye").
# Only EYE pixels (dark outline/pupil, blue iris, white catchlight) are
# copied across the face midline — surrounding fur is left untouched so
# there is no box seam.
#
# Run with --apply to overwrite public/ErenCakeShop.png; without it, writes
# a before/after zoom preview (raw + night-filtered).
from PIL import Image
import numpy as np
import sys

SRC = r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public\ErenCakeShop.png'
im = Image.open(SRC).convert('RGBA')
arr = np.asarray(im).astype(np.int32).copy()
H, W = arr.shape[:2]

MID = 492          # face midline between the two iris centers (385 & 599)
# Source box around the LEFT eye, edges sitting in plain face fur.
X0, X1, Y0, Y1 = 330, 460, 556, 654

def eye_like(px):
    r, g, b, a = px[..., 0], px[..., 1], px[..., 2], px[..., 3]
    lum = 0.2126*r + 0.7152*g + 0.0722*b
    dark = (a > 100) & (lum < 95)
    blue = (a > 100) & (b > r + 18) & (b > g + 8)
    white = (a > 100) & (r > 200) & (g > 200) & (b > 200)
    return dark | blue | white

out = arr.copy()
for y in range(Y0, Y1):
    for x in range(X0, X1):
        mx = 2*MID - x            # mirrored destination column on the right
        if mx < 0 or mx >= W:
            continue
        srcpx = arr[y, x]         # left-eye pixel
        dstpx = arr[y, mx]        # current right-eye pixel
        # Replace the union of both eyes' glyph pixels with the mirrored left.
        if eye_like(srcpx) or eye_like(dstpx):
            out[y, mx] = srcpx

fixed = Image.fromarray(out.astype(np.uint8), 'RGBA')

if '--apply' in sys.argv:
    fixed.save(SRC)
    print(f'APPLIED to {SRC}')
    sys.exit()

def night(img):
    a = np.asarray(img.convert('RGBA')).astype(np.float64)
    rgb, al = a[..., :3], a[..., 3:]
    rgb = rgb * 0.8
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    rgb = lum[..., None] + 0.9*(rgb - lum[..., None])
    sep = np.array([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]])
    rgb = 0.9*rgb + 0.1*(rgb @ sep.T)
    o = np.concatenate([np.clip(rgb, 0, 255), al], axis=-1).astype(np.uint8)
    return Image.fromarray(o, 'RGBA')

box = (300, 545, 685, 670)
sc = 6
def prep(img, bg):
    c = img.crop(box).resize(((box[2]-box[0])*sc, (box[3]-box[1])*sc), Image.NEAREST)
    b = Image.new('RGBA', c.size, bg); b.alpha_composite(c); return b.convert('RGB')

raw = prep(fixed, (120, 120, 128, 255))
nig = prep(night(fixed), (40, 30, 44, 255))
pw, ph = raw.size
sheet = Image.new('RGB', (pw, ph*2+20), (25, 25, 30))
sheet.paste(raw, (0, 0))
sheet.paste(nig, (0, ph+20))
sheet.save(r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\scripts\cake_eye_fixed_preview.png')
print('saved cake_eye_fixed_preview.png (top: raw fixed, bottom: night fixed)')
