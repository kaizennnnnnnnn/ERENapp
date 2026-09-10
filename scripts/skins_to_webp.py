"""
One-shot: convert public/skins/*.png to WebP and drop the PNGs.

WHY, with the measurement that decided it: these are ~1470x1912 RGBA sprites of
soft-shaded art, and PNG is close to the worst possible container for that. At
quality 92 and FULL resolution — no downscaling, no loss of sharpness on a big
screen — WebP lands at ~5% of the PNG size. 112.8 MB becomes ~5.6 MB.

Downscaling was measured too and deliberately NOT done: 900px wide would have
saved a further 1.9 MB out of 113, which is not worth giving up resolution the
app can genuinely use (a skin is drawn at up to 42vw, ~537 CSS px on a tablet).

The extension change is a feature, not a cost. The service worker serves images
stale-while-revalidate, so replacing art at the SAME path shows the old file
until a revalidation lands. /skins/fox.webp is a new URL, so there is no stale
entry to fight. sw.js already matches .webp in its fetch handler and does not
precache any skin.

Run with `py scripts/skins_to_webp.py` (plain `python` here has no Pillow).
"""
import os
import glob
from PIL import Image

SRC = 'public/skins'
QUALITY = 92

png_files = sorted(glob.glob(os.path.join(SRC, '*.png')))
if not png_files:
    print('No PNGs left in public/skins — already converted.')
    raise SystemExit(0)

before = after = 0
converted = []
failed = []

for i, src in enumerate(png_files, 1):
    dst = src[:-4] + '.webp'
    try:
        im = Image.open(src)
        w, h = im.size
        im.convert('RGBA').save(dst, 'WEBP', quality=QUALITY, method=6)
        # Verify the file we just wrote actually opens and matches, BEFORE the
        # original is deleted. A silently truncated sprite would be discovered
        # by the user, in the app, with no way back.
        chk = Image.open(dst)
        chk.load()
        if chk.size != (w, h):
            raise ValueError(f'size drift {chk.size} != {(w, h)}')
        b, a = os.path.getsize(src), os.path.getsize(dst)
        before += b
        after += a
        converted.append((src, dst))
        print(f'[{i:3d}/{len(png_files)}] {os.path.basename(src):32s} '
              f'{b/1024:7.0f}K -> {a/1024:6.0f}K  ({100*a/b:4.1f}%)', flush=True)
    except Exception as e:  # noqa: BLE001 - report and keep the original
        failed.append((src, str(e)))
        print(f'[{i:3d}/{len(png_files)}] FAILED {os.path.basename(src)}: {e}', flush=True)
        if os.path.exists(dst):
            os.remove(dst)

if failed:
    print(f'\n{len(failed)} file(s) failed — NOTHING deleted. Fix these first:')
    for f, e in failed:
        print(f'   {f}: {e}')
    raise SystemExit(1)

for src, _ in converted:
    os.remove(src)

print(f'\nconverted {len(converted)} files, all verified, PNGs removed')
print(f'  before {before/1048576:7.1f} MB')
print(f'  after  {after/1048576:7.1f} MB   ({100*after/before:.1f}%)')
print(f'  saved  {(before-after)/1048576:7.1f} MB per deployment')
