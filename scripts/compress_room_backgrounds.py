# Lossless recompression of the room-background PNGs. Each file is re-encoded
# with optimize/compress_level=9, asserted pixel-identical (RGBA diff must be
# empty) and only overwritten if the result is strictly smaller. Sprites and
# measurement crops are deliberately not touched.
import io
import os
import sys

from PIL import Image, ImageChops

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")
FILES = [
    "kitchen.png", "KitchenDark.png", "playroom.png", "play.png",
    "bedroom.png", "bathroom.png", "BathroomDark.png",
    "ChemistryDay.png", "ChemistryNight.png", "vetBACK.png", "wetDark.png",
    "schoolBACK.png", "livingRoom.png", "HomePage.png",
    "CakeShop.png", "CakeShopNight.png",
]

total_before = total_after = 0
for name in FILES:
    path = os.path.abspath(os.path.join(PUBLIC, name))
    if not os.path.exists(path):
        print(f"SKIP (missing): {name}")
        continue
    before = os.path.getsize(path)
    img = Image.open(path)
    img.load()
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, compress_level=9)
    buf.seek(0)
    new = Image.open(buf)
    new.load()
    assert new.mode == img.mode and new.size == img.size, f"mode/size changed: {name}"
    diff = ImageChops.difference(img.convert("RGBA"), new.convert("RGBA"))
    assert diff.getbbox() is None, f"pixels changed: {name}"
    after = len(buf.getvalue())
    if after < before:
        with open(path, "wb") as f:
            f.write(buf.getvalue())
        print(f"{name}: {before/1e6:.2f} MB -> {after/1e6:.2f} MB")
        total_before += before
        total_after += after
    else:
        print(f"SKIP (not smaller): {name}")
        total_before += before
        total_after += before

print(f"TOTAL: {total_before/1e6:.2f} MB -> {total_after/1e6:.2f} MB")
sys.exit(0)
