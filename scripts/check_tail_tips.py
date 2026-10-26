"""Read-only regression checks for the bee/ladybug split layers. Requires Pillow."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "public" / "skins"
CASES = [("bee", 0.62, 0.67, 0.78), ("ladybug", 0.66, 0.71, 0.82)]


def wing_color(pixel):
    r, g, b, _ = pixel
    # Ignore dark WebP edge bleed when comparing separately encoded layers.
    return max(r, g, b) > 130 and (
        (b - r > 20 and g - r > 10) or (r - g > 35 and r - b > 35)
    )


for skin, search_start, old_cutoff, hip in CASES:
    full, body, tail = [
        Image.open(ROOT / f"{skin}{suffix}.webp").convert("RGBA")
        for suffix in ("", "_notail", "_tail")
    ]
    assert full.size == body.size == tail.size, f"{skin}: misaligned layers"
    width, height = full.size
    bounds = tail.getbbox()
    assert bounds, f"{skin}: missing tail"
    left, top, right, bottom = bounds
    assert height * search_start + 8 < top < height * old_cutoff - 24, (
        f"{skin}: tail tip clipped by the search boundary"
    )
    fp, bp, tp = full.load(), body.load(), tail.load()
    points = set()
    recovered = 0
    for y in range(top, bottom):
        for x in range(left, right):
            if tp[x, y][3] < 128:
                continue
            points.add((x, y))
            assert fp[x, y][3] >= 128, f"{skin}: tail leaks outside source sprite"
            if y < height * old_cutoff:
                recovered += 1
            if y < height * hip:
                assert bp[x, y][3] < 128, f"{skin}: static tip remains on body"
                assert not wing_color(tp[x, y]), f"{skin}: wing pixels move with tail"
    assert recovered > 500, f"{skin}: upper tip was not recovered"

    wing_pixels = 0
    for y in range(int(height * 0.45), int(height * hip)):
        for x in range(int(width * 0.72), width):
            if fp[x, y][3] >= 128 and wing_color(fp[x, y]):
                wing_pixels += 1
                assert bp[x, y][3] >= 128, f"{skin}: wing has a hole"
    assert wing_pixels > 2000, f"{skin}: wing check did not cover the costume"

    pending = [points.pop()]
    while pending:
        x, y = pending.pop()
        for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if neighbor in points:
                points.remove(neighbor)
                pending.append(neighbor)
    assert not points, f"{skin}: disconnected tail fragments"
    print(f"{skin}: complete moving tip, intact wing, no static stub or fragments")
