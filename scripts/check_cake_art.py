"""Read-only checks for the bakery sprite set. Requires Pillow."""
from hashlib import sha256
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IDS = (
    'strawberry chocolate vanilla matcha blueberry macaron tiramisu royal '
    'honey_hive moonbeam moss_cottage lily_pond'
).split()
hashes = set()
for cake in IDS:
    image = Image.open(ROOT / 'public/cakes' / (cake + '.png'))
    assert image.mode == 'RGBA' and image.size == (128, 128), cake
    alpha = image.getchannel('A')
    assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (127, 0), (0, 127), (127, 127))), cake
    box = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    assert box is not None, cake
    left, top, right, bottom = box
    assert left >= 2 and top >= 2 and right <= 126 and bottom <= 126, (cake, box)
    assert abs(left + right - 128) <= 2 and abs(top + bottom - 128) <= 2, (cake, box)
    assert 96 <= ((right-left) * (bottom-top)) ** 0.5 <= 104, (cake, box)
    assert sum(value >= 128 for value in alpha.tobytes()) > 4000, cake
    digest = sha256(image.tobytes()).hexdigest()
    assert digest not in hashes, cake
    hashes.add(digest)
    print(f'{cake}: transparent, centered 128px artwork; content {box}')
print('All 12 bakery pictures passed.')
