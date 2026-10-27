"""Read-only checks for the 13 food-first sprites. Requires Pillow."""
from collections import deque
from hashlib import sha256
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IDS = (
    'steak carbonara risotto gyoza cevapi sarma meatballs roast_chicken '
    'ramen pad_thai paella stew xiaolongbao'
).split()
hashes = set()
for food in IDS:
    image = Image.open(ROOT / 'public/food' / (food + '.png'))
    assert image.mode == 'RGBA' and image.size == (128, 128), food
    alpha = image.getchannel('A')
    assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (127, 0), (0, 127), (127, 127))), food
    bbox = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    assert bbox is not None, food
    left, top, right, bottom = bbox
    assert left >= 2 and top >= 2 and right <= 126 and bottom <= 126, (food, bbox)
    assert abs(left + right - 128) <= 2 and abs(top + bottom - 128) <= 2, (food, bbox)
    assert 96 <= ((right - left) * (bottom - top)) ** 0.5 <= 104, (food, bbox)
    solid = {(x, y) for y in range(128) for x in range(128) if alpha.getpixel((x, y)) >= 128}
    assert len(solid) >= 4000, (food, len(solid))
    remaining = solid.copy()
    components = []
    while remaining:
        queue = deque([remaining.pop()])
        size = 0
        while queue:
            x, y = queue.popleft()
            size += 1
            for point in ((x-1,y), (x+1,y), (x,y-1), (x,y+1)):
                if point in remaining:
                    remaining.remove(point)
                    queue.append(point)
        components.append(size)
    assert max(components) / len(solid) > 0.995, (food, components)
    digest = sha256(image.tobytes()).hexdigest()
    assert digest not in hashes, food
    hashes.add(digest)
    print(f'{food}: centered, transparent, connected 128px sprite; {len(solid)} visible pixels')
print('All 13 food silhouettes passed.')
