# -*- coding: utf-8 -*-
"""Cut each room's SKY out of its window, so weather can be drawn behind it.

The weather has to stop at the glass. Clipping it to a rectangle puts rain on
the sash; hand-tracing a mask per room is a day's work and goes stale the
moment the art is repainted.

So nothing is clipped. For each room this emits a small PNG -- the window's
bounding box, cut straight out of the room art, with the SKY pixels made
transparent and every mullion, sash, curtain, plant and sill left exactly as
painted. At runtime the weather draws inside that box and this overlay draws on
top, so the weather is behind the glass by construction and cannot land
anywhere the artist did not paint sky.

Finding the sky is tractable here and would not be in a photo: the art is flat
pixel art, so a window's sky is a few dozen exact colours bounded by a hard
dark keyline. The flood therefore has three brakes, and it needs all three --
with only the first it walks a sunset gradient straight through the frame and
eats the wallpaper:

  step   a neighbour must be within `tol` of the pixel we came from
  drift  and within `seedTol` of the seed it grew from, so a gradient is one
         region but a long ramp cannot wander to another colour entirely
  key    and never darker than the seed by `keyDrop`, which is what actually
         stops it at the outline every window in this game is drawn with
         (disabled for a night window, where the sky IS the dark thing)

Bias: when in doubt KEEP the pixel. A pixel wrongly kept hides a raindrop
nobody was looking at; a pixel wrongly dropped puts weather on the wallpaper.

  py scripts/build_window_frames.py                     # all rooms
  py scripts/build_window_frames.py feed sleep          # some
  py scripts/build_window_frames.py --json my.json --shots /tmp/x feed

Reads scripts/window_seeds.json. Emits public/weather/<room>.png, and a check
image per room: the cut composited over magenta, so any magenta outside the
glass is a leak and any un-magenta glass is a hole.
"""
import argparse
import json
import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
DEFAULT_JSON = os.path.join(ROOT, 'scripts', 'window_seeds.json')


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def cut(room, spec, outdir, shots, art=None, suffix=''):
    im = Image.open(os.path.join(PUB, art or spec['art'])).convert('RGBA')
    W, H = im.size
    fl, ft, fw, fh = spec['box']
    x0, y0 = int(fl * W), int(ft * H)
    x1, y1 = int((fl + fw) * W), int((ft + fh) * H)
    crop = im.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    px = crop.load()

    tol = spec.get('tol', 26)
    seed_tol = spec.get('seedTol', 110)
    key_drop = spec.get('keyDrop', 55)
    night = spec.get('night', False)

    sky = [[False] * ch for _ in range(cw)]
    seed_of = {}
    q = deque()
    for sx, sy in spec['seeds']:
        p = (min(cw - 1, max(0, int(sx * cw))), min(ch - 1, max(0, int(sy * ch))))
        if not sky[p[0]][p[1]]:
            sky[p[0]][p[1]] = True
            seed_of[p] = px[p[0], p[1]]
            q.append(p)

    while q:
        x, y = q.popleft()
        here = px[x, y]
        seed = seed_of[(x, y)]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < cw and 0 <= ny < ch) or sky[nx][ny]:
                continue
            c = px[nx, ny]
            if dist(here, c) > tol:
                continue
            if dist(seed, c) > seed_tol:
                continue
            if not night and luma(c) < luma(seed) - key_drop:
                continue
            sky[nx][ny] = True
            seed_of[(nx, ny)] = seed
            q.append((nx, ny))

    n = 0
    for x in range(cw):
        for y in range(ch):
            if sky[x][y]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
                n += 1

    os.makedirs(outdir, exist_ok=True)
    crop.save(os.path.join(outdir, f'{room}{suffix}.png'))

    chk = Image.new('RGBA', crop.size, (255, 0, 200, 255))
    chk.alpha_composite(crop)
    s = max(1, min(6, int(560 / max(1, cw))))
    os.makedirs(shots, exist_ok=True)
    chk.convert('RGB').resize((cw * s, ch * s), Image.NEAREST).save(
        os.path.join(shots, f'_frame_{room}{suffix}.png'))

    pct = 100.0 * n / (cw * ch)
    print(f'{room + suffix:16s} box={cw}x{ch} sky={pct:5.1f}% '
          f'tol={tol} seedTol={seed_tol} keyDrop={key_drop} night={night} '
          f'-> {room}{suffix}.png')
    return pct, (cw, ch), im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('rooms', nargs='*')
    ap.add_argument('--json', default=DEFAULT_JSON)
    ap.add_argument('--out', default=os.path.join(PUB, 'weather'))
    ap.add_argument('--shots', default=os.path.join(ROOT, 'scripts', 'tro_shots'))
    a = ap.parse_args()

    specs = json.load(open(a.json, encoding='utf-8'))
    rooms = a.rooms or list(specs)
    meta = {}
    for room in rooms:
        sp = specs[room]
        _, _, art_size = cut(room, sp, a.out, a.shots)
        night = f'/weather/{room}.png'
        if sp.get('nightOk') is False:
            # No clean cut of this room's night art exists, so it simply has
            # no weather after dark. A leak is worse than an absence.
            night = None
        elif sp.get('nightArt'):
            cut(room, sp, a.out, a.shots, art=sp['nightArt'], suffix='_night')
            night = f'/weather/{room}_night.png'
        meta[room] = dict(box=sp['box'], art=art_size, night=night)

    if a.rooms:
        return
    emit_ts(specs, meta)


ROOM_LABELS = {
    'feed': 'KITCHEN', 'play': 'PLAYROOM', 'sleep': 'BEDROOM', 'wash': 'BATHROOM',
    'chemistry': 'LAB', 'talk': 'ATTIC', 'school': 'SCHOOL',
}
ROOM_ORDER = ['feed', 'play', 'sleep', 'wash', 'chemistry', 'talk', 'school']


def emit_ts(specs, meta):
    order = [r for r in ROOM_ORDER if r in meta] + [r for r in meta if r not in ROOM_ORDER]
    L = []
    L.append('// AUTO-GENERATED by scripts/build_window_frames.py - do not edit by hand.')
    L.append('//')
    L.append("// Where each room's window is, and the cut-out that draws its frame back")
    L.append('// over the weather. `box` is in fractions of the ROOM ART, which is the')
    L.append('// space RoomWeather positions in (inside a cover box that mirrors the')
    L.append("// picture's own aspect ratio).")
    L.append('//')
    L.append('// A room whose night art differs carries a second cut; one whose night art')
    L.append('// IS the day art (the bedroom is already a night scene) carries null and')
    L.append('// reuses the day cut.')
    L.append('')
    L.append('export interface RoomWindow {')
    L.append('  /** For the picker in the Lab. */')
    L.append('  label: string')
    L.append('  /** Source art size, so the cover box can reproduce `background-size: cover`. */')
    L.append('  art: { w: number; h: number }')
    L.append('  /** Window aperture, as fractions of the art. */')
    L.append('  box: { l: number; t: number; w: number; h: number }')
    L.append('  /** The frame cut, drawn over the weather. */')
    L.append('  day: string')
    L.append('  /** null = this room has no clean cut of its night art, so no weather then. */')
    L.append('  night: string | null')
    L.append('}')
    L.append('')
    L.append('export const ROOM_WINDOWS: Record<string, RoomWindow> = {')
    for r in order:
        m = meta[r]
        b = m['box']
        lab = ROOM_LABELS.get(r, r.upper())
        night = m['night']
        L.append(f"  {r}: {{")
        L.append(f"    label: '{lab}',")
        L.append(f"    art: {{ w: {m['art'][0]}, h: {m['art'][1]} }},")
        L.append(f"    box: {{ l: {b[0]}, t: {b[1]}, w: {b[2]}, h: {b[3]} }},")
        L.append(f"    day: '/weather/{r}.png',")
        L.append(f"    night: {repr(night) if night else 'null'},".replace(chr(39) + '/', chr(39) + '/'))
        L.append('  },')
    L.append('}')
    L.append('')
    L.append('/** Every room the weather machine can set, in swipe order. */')
    L.append('export const WEATHER_ROOMS: { room: string; label: string }[] =')
    L.append('  Object.entries(ROOM_WINDOWS).map(([room, w]) => ({ room, label: w.label }))')
    L.append('')
    out = os.path.join(ROOT, 'src', 'lib', 'roomWindows.ts')
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(chr(10).join(L))
    print('wrote src/lib/roomWindows.ts', len(order), 'rooms')


if __name__ == '__main__':
    main()
