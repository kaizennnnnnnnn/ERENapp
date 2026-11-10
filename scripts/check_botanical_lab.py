"""Validate the selected lab painting and its compiled weather assets."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'public'
specs = json.loads((ROOT / 'scripts/window_seeds.json').read_text(encoding='utf-8'))
spec = specs['chemistry']
assert spec['assetVersion'] == 6
assert spec['art'] == 'lab-botanical-day.png'
assert spec['nightArt'] == 'lab-botanical-night.png'
assert hashlib.sha256(Image.open(PUB / spec['art']).convert('RGBA').tobytes()).hexdigest() == 'a6b98f0e7e84cbad16aef2e6a126bd7395841753bf472acd72c29b4c434da0c7', 'Keep the exact owner-selected day pixels, allowing lossless PNG recompression'

skies = [(430, 400), (500, 405), (430, 535), (500, 535)]
foreground = [(470, 430), (470, 570), (425, 505), (400, 585), (545, 585), (370, 465)]
means = []
for name, overlay in [(spec['art'], 'chemistry-botanical.png'), (spec['nightArt'], 'chemistry-botanical_night.png')]:
    source = Image.open(PUB / name).convert('RGBA')
    frame = Image.open(PUB / 'weather' / overlay).convert('RGBA')
    assert source.size == frame.size == (941, 1672)
    assert source.getchannel('A').getextrema() == (255, 255)
    bounds = frame.getchannel('A').getbbox()
    left, top, width, height = spec['box']
    aperture = (int(left * 941), int(top * 1672), int((left + width) * 941), int((top + height) * 1672))
    pad = spec['framePadding']
    assert bounds == (aperture[0] - pad, aperture[1] - pad, aperture[2] + pad, aperture[3] + pad), bounds
    assert frame.getpixel((aperture[2] + 1, aperture[1] + 10)) == source.getpixel((aperture[2] + 1, aperture[1] + 10)), 'Opaque source-art padding prevents resampling leaks around the window'
    for point in skies:
        assert frame.getpixel(point)[3] == 0, (overlay, 'sky must reveal weather', point)
    for point in foreground:
        assert frame.getpixel(point) == source.getpixel(point), (overlay, 'frame, flowers and foliage must stay pixel-identical', point)
    opaque = frame.getchannel('A').histogram()[255]
    assert 60_000 < opaque < 85_000, (overlay, 'mask stays local to the window')
    means.append(sum(ImageStat.Stat(source.convert('RGB')).mean) / 3)

assert means[1] < means[0] * .8, 'Night must visibly differ while retaining the room layout'
routes = (ROOT / 'src/lib/roomArt.ts').read_text(encoding='utf-8')
worker = (PUB / 'sw.js').read_text(encoding='utf-8')
for name in [spec['art'], spec['nightArt']]:
    assert '/' + name in routes and '/' + name in worker
assert "IMAGE_ASSET_EPOCH = 'a1'" in worker, 'Do not invalidate all cached room art'
window_routes = (ROOT / 'src/lib/roomWindows.ts').read_text(encoding='utf-8')
assert '/weather/chemistry-botanical.png?v=6' in window_routes
assert '/weather/chemistry-botanical_night.png?v=6' in window_routes
for room in ['home', 'feed', 'play', 'sleep', 'wash', 'talk']:
    assert f'/weather/{room}.png?v=5' in window_routes, 'Other rooms retain their weather-cache versions'
print('Botanical lab passed: exact selected day art, matching night/canvas, four glass apertures, preserved frame/flowers/foliage, local weather masks and scoped offline cache update.')
