# -*- coding: utf-8 -*-
"""Cut each room's SKY out of its window, so weather can be drawn behind it.

The weather has to stop at the glass. Clipping it to a rectangle puts rain on
the sash; hand-tracing a mask per room is a day's work and goes stale the
moment the art is repainted.

So nothing is clipped. For each room this emits a PNG the FULL SIZE of the
room art, transparent everywhere except the window, where every mullion, sash,
curtain, plant and sill is left exactly as painted and only the SKY is cut
away. At runtime the weather draws inside the window's box and this overlay
draws on top, so the weather is behind the glass by construction and cannot
land anywhere the artist did not paint sky.

Full size, not a cropped box, and that is not incidental. A cropped overlay is
scaled by the browser as its own raster, on its own pixel grid, while the room
behind it is scaled as a background-image on another -- so the same painted
curtain came out a shade different inside the box than outside it, and the
overlay's rectangle showed as a pale seam ruled across the fabric. At full
size the overlay and the room are the same picture at the same scale, and
every kept pixel lands exactly on the one it came from.

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
  green  and never a green-dominant pixel, because no window in this game has
         green SKY -- green is the treeline, the hills and the bushes, and
         erasing those leaves rain falling through where a tree used to be.
         `greenGuard` is the margin, 10 by default; 0 turns it off
  cool   and, where a room asks for it, never less blue than `coolMin`,
         measured as blue minus red. This is the night window's substitute for
         the key brake: after dark the frame is not darker than the sky, but it
         is still WOOD, so it stays warm where the sky has gone cold. Off by
         default, and wrong for any window with white cloud or green hills in
         it -- those are not blue either

Where no threshold separates two objects at all -- a 1px frame lining the same
brightness and the same hue as the glass beside it -- a room may list `keep`
rectangles, in fractions of its own crop, which are never cut. That is not a
failure of the flood; some pairs of colours are genuinely identical and saying
so explicitly beats inventing a fourth heuristic to guess it.

A room whose night art is a different picture gets a second pass over that
picture, INTERSECTED with the day pass: a pixel is only cut at night if the
daylight picture agreed it was sky. It needs that, because after dark the
lab's mullions go as black as its glass and the playroom's neighbouring house
goes as black as the sky behind it -- unchecked, the night flood swallows both
and the house disappears every evening. Since the two pictures are the same
room from the same camera, the daylight cut, where colour separation is easy,
is the authority on where the glass IS, and the night pass only ever narrows
it.

Small ISLANDS of kept pixels that the sky completely encloses are then filled
in, up to `fillHoles` pixels each. These are the shreds of cloud the flood
could not step onto -- it seeds the middle of a cumulus and stops at its soft
edge, leaving a white rag floating in the pane, which over a midnight-blue
aurora is the single most artificial thing in the window. Enclosure is what
makes this safe where colour was not: a cloud shred is surrounded by sky,
while a curtain reaches the edge of the crop and a tree stands on the frame,
so neither is ever a hole. The size cap keeps a whole treetop from counting
as one.

Finally the hole's edge is MATTED. The art is not hard-edged pixel art: where
the painter put frame against sky the boundary pixels are a blend of the two,
and a flood can only ever say keep or cut about them. Kept whole, they are a
hairline of daylight sky welded to the frame, and the moment the sky behind
them went dark they drew a pale outline round every pane. Cut whole, the frame
loses a pixel and the weather laps onto the wood.

Neither answer is right because the question is wrong: a blended pixel is not
sky OR frame, it is a known FRACTION of each, and alpha is exactly the channel
for saying so. So for every kept pixel within `feather` of the cut, take S =
the mean of the sky beside it and F = the mean of the frame behind it, and read
its own colour c as the mix it is:

    c = aF + (1-a)S   =>   a = (c-S).(F-S) / |F-S|^2

That a is the pixel's alpha, and unpremultiplying gives back the frame colour
that was mixed into it. A pixel the painter left pure frame solves to a = 1 and
is written back untouched, so the matte is self-limiting -- it costs nothing to
run it two pixels deep, and where frame and sky are the same colour (|F-S| tiny,
or a mullion so thin it has no interior) it declines to answer and keeps the
pixel. Bias preserved.

This replaces an earlier attempt that pulled the hole in two pixels and
repainted the ring in the frame's colour, darkened. It traded the pale outline
for a worse one: against the living room's white curtain, a ring of 82%-grey is
a line ruled down the fabric, which is what it looked like.

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

# Bump whenever the SHAPE of these files changes. The service worker serves
# images stale-while-revalidate, so a replaced file at the same path keeps
# rendering the old one for a visit or two -- and an old CROPPED overlay drawn
# by the current full-size layout squeezes the whole room into the window.
#   2  full-size overlays, enclosed cloud shreds filled
#   3  hole edges matted instead of eroded and repainted
ASSET_V = 3


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def cool(c):
    """Blue minus red. Sky is positive, wood and lamplight are negative."""
    return c[2] - c[0]


def leafy(c, margin):
    """Green-dominant, i.e. a tree, a hedge or a hill. Never sky.

    `min(c) < 200` keeps a near-white pixel out of it: cloud and window glare
    often sit a couple of levels greener than neutral without being foliage.
    """
    return (margin > 0 and min(c[:3]) < 200
            and c[1] > c[0] + margin and c[1] > c[2] + margin)


# Below this, frame and sky are too close in colour for the mix to be read off
# reliably -- the projection starts amplifying dither instead of measuring
# coverage. Euclidean in RGB.
SEPARABLE = 30


def matte(px, cw, ch, sky, feather):
    """Solve the alpha of every kept pixel the flood's edge runs through.

    Returns {(x, y): RGBA} for the pixels that turned out to be a mix. A pixel
    that solves to fully opaque is left out of the dict entirely, so the frame
    the artist painted is returned byte for byte wherever it is really frame.
    """
    if feather <= 0:
        return {}

    # How far each kept pixel is from the cut, 8-connected, up to `feather`.
    # Anything further is interior: the frame's own colour, uncontaminated.
    far = feather + 1
    d = [[0 if sky[x][y] else far for y in range(ch)] for x in range(cw)]
    front = [(x, y) for x in range(cw) for y in range(ch) if sky[x][y]]
    for step in range(1, feather + 1):
        nxt = []
        for x, y in front:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < cw and 0 <= ny < ch and d[nx][ny] == far:
                        d[nx][ny] = step
                        nxt.append((nx, ny))
        front = nxt

    r = feather + 1
    out = {}
    for x in range(cw):
        for y in range(ch):
            if not 1 <= d[x][y] <= feather:
                continue
            s, sn, f, fn = [0, 0, 0], 0, [0, 0, 0], 0
            for nx in range(max(0, x - r), min(cw, x + r + 1)):
                for ny in range(max(0, y - r), min(ch, y + r + 1)):
                    c = px[nx, ny]
                    if d[nx][ny] == 0:
                        s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; sn += 1
                    elif d[nx][ny] == far:
                        f[0] += c[0]; f[1] += c[1]; f[2] += c[2]; fn += 1
            # No sky beside it, or no frame behind it (a mullion one pixel
            # wide). Nothing to separate, so keep the pixel as painted.
            if not sn or not fn:
                continue
            S = [v / sn for v in s]
            F = [v / fn for v in f]
            df = [F[i] - S[i] for i in range(3)]
            den = df[0] ** 2 + df[1] ** 2 + df[2] ** 2
            if den < SEPARABLE ** 2:
                continue
            c = px[x, y]
            a = sum((c[i] - S[i]) * df[i] for i in range(3)) / den
            a = 0.0 if a < 0 else (1.0 if a > 1 else a)
            if a > 0.995:
                continue                       # pure frame -- leave it alone
            # Unpremultiply: c = aF + (1-a)S, so the frame colour mixed in is
            # (c - (1-a)S) / a. Near-zero alpha makes that meaningless, and the
            # neighbourhood mean is the better estimate there.
            if a < 0.02:
                col = F
            else:
                col = [(c[i] - (1 - a) * S[i]) / a for i in range(3)]
            # Floored at 1, which is invisible but keeps alpha==0 meaning
            # exactly "the flood called this sky". The night pass is
            # intersected against the day flood, so without the floor a pixel
            # the day kept at 1% could still be punched right through after
            # dark, and the intersection would no longer be a guarantee.
            out[(x, y)] = tuple(
                min(255, max(0, round(v))) for v in col) + (max(1, round(255 * a)),)
    return out


def cut(room, spec, outdir, shots, art=None, suffix='', only=None):
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
    cool_min = spec.get('coolMin')
    green_guard = spec.get('greenGuard', 10)
    feather = spec.get('feather', 2)
    fill_holes = spec.get('fillHoles', 120)
    night = spec.get('night', False)

    # Painted-in walls the flood may not enter, in fractions of this crop.
    keep = [[False] * ch for _ in range(cw)]
    for kl, kt, kw, kh in spec.get('keep', []):
        ax, ay = max(0, int(kl * cw)), max(0, int(kt * ch))
        bx = min(cw, max(ax + 1, int((kl + kw) * cw)))
        by = min(ch, max(ay + 1, int((kt + kh) * ch)))
        for x in range(ax, bx):
            for y in range(ay, by):
                keep[x][y] = True

    sky = [[False] * ch for _ in range(cw)]
    seed_of = {}
    q = deque()
    for sx, sy in spec['seeds']:
        p = (min(cw - 1, max(0, int(sx * cw))), min(ch - 1, max(0, int(sy * ch))))
        # A seed skips every brake by definition, so a seed dropped one row off
        # the glass punches a hole in the frame and nothing downstream catches
        # it. Refuse it loudly instead.
        if (keep[p[0]][p[1]] or leafy(px[p[0], p[1]], green_guard)
                or (cool_min is not None and cool(px[p[0], p[1]]) < cool_min)):
            print(f'  ! {room}{suffix}: seed ({sx}, {sy}) is not on glass '
                  f'-- px {p} is {px[p[0], p[1]][:3]}, ignored')
            continue
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
            if not (0 <= nx < cw and 0 <= ny < ch) or sky[nx][ny] or keep[nx][ny]:
                continue
            c = px[nx, ny]
            if dist(here, c) > tol:
                continue
            if dist(seed, c) > seed_tol:
                continue
            if not night and luma(c) < luma(seed) - key_drop:
                continue
            if leafy(c, green_guard):
                continue
            if cool_min is not None and cool(c) < cool_min:
                continue
            sky[nx][ny] = True
            seed_of[(nx, ny)] = seed
            q.append((nx, ny))

    if only is not None:
        for x in range(cw):
            for y in range(ch):
                if not only[x][y]:
                    sky[x][y] = False

    # Fill the small islands the sky has closed around.
    if fill_holes:
        seen = [[False] * ch for _ in range(cw)]
        for sx in range(cw):
            for sy in range(ch):
                if sky[sx][sy] or seen[sx][sy] or keep[sx][sy]:
                    continue
                comp, edge, stack = [], False, [(sx, sy)]
                seen[sx][sy] = True
                while stack:
                    x, y = stack.pop()
                    comp.append((x, y))
                    if x == 0 or y == 0 or x == cw - 1 or y == ch - 1:
                        edge = True
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if not (0 <= nx < cw and 0 <= ny < ch):
                            continue
                        if sky[nx][ny] or seen[nx][ny] or keep[nx][ny]:
                            continue
                        seen[nx][ny] = True
                        stack.append((nx, ny))
                if not edge and len(comp) <= fill_holes:
                    for x, y in comp:
                        sky[x][y] = True

    found = sky
    soft = matte(px, cw, ch, sky, feather)

    n = 0
    for x in range(cw):
        for y in range(ch):
            if sky[x][y]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
                n += 1
    for (x, y), v in soft.items():
        px[x, y] = v

    os.makedirs(outdir, exist_ok=True)
    full = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    full.paste(crop, (x0, y0))
    full.save(os.path.join(outdir, f'{room}{suffix}.png'), optimize=True)

    chk = Image.new('RGBA', crop.size, (255, 0, 200, 255))
    chk.alpha_composite(crop)
    s = max(1, min(6, int(560 / max(1, cw))))
    os.makedirs(shots, exist_ok=True)
    chk.convert('RGB').resize((cw * s, ch * s), Image.NEAREST).save(
        os.path.join(shots, f'_frame_{room}{suffix}.png'))

    pct = 100.0 * n / (cw * ch)
    print(f'{room + suffix:16s} box={cw}x{ch} sky={pct:5.1f}% '
          f'tol={tol} seedTol={seed_tol} keyDrop={key_drop} coolMin={cool_min} '
          f'green={green_guard} feather={feather} fill={fill_holes} night={night} '
          f'keep={len(spec.get("keep", []))} -> {room}{suffix}.png')
    return pct, (cw, ch), im.size, found


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
        _, _, art_size, day_sky = cut(room, sp, a.out, a.shots)
        night = f'/weather/{room}.png?v={ASSET_V}'
        if sp.get('nightOk') is False:
            # No clean cut of this room's night art exists, so it simply has
            # no weather after dark. A leak is worse than an absence.
            night = None
        elif sp.get('nightArt'):
            cut(room, sp, a.out, a.shots, art=sp['nightArt'], suffix='_night',
                only=day_sky)
            night = f'/weather/{room}_night.png?v={ASSET_V}'
        meta[room] = dict(box=sp['box'], art=art_size, night=night)

    if a.rooms:
        return
    emit_ts(specs, meta)


ROOM_LABELS = {
    'home': 'LIVING ROOM',
    'feed': 'KITCHEN', 'play': 'PLAYROOM', 'sleep': 'BEDROOM', 'wash': 'BATHROOM',
    'chemistry': 'LAB', 'talk': 'ATTIC', 'school': 'SCHOOL',
}
ROOM_ORDER = ['home', 'feed', 'play', 'sleep', 'wash', 'chemistry', 'talk', 'school']


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
    L.append('// A room whose night art is a different picture carries a second cut; one')
    L.append('// already painted after dark (the bedroom) points `night` back at its day')
    L.append('// cut. `night: null` means no clean cut of that room after dark exists, so')
    L.append('// it simply has no weather then -- an absence beats a leak.')
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
        L.append(f"    day: '/weather/{r}.png?v={ASSET_V}',")
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
