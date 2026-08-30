# -*- coding: utf-8 -*-
"""Draw the three sauce bottles and the drizzle they leave on the wrap.

What was there before was a placeholder: a flat rectangle of one colour, a
white band across it with a small square in the middle, and a cone on top.
No rim light, no shading, no depth. Standing next to the cola bottle and the
knife on the same counter -- both of which have an outline, a couple of tone
bands and a glint -- it read as the one thing nobody had finished.

Everything here is drawn on the SAME pixel grid the neighbouring art uses,
measured off it rather than guessed: the bottles are 26x76 cells at 11x, the
drizzle 60x22 at 9x. Matching the grid is most of what makes a sprite look
like it belongs on the shelf it is standing on.

The bottle is described as a stack of row-spans -- how wide the bottle is at
each height -- and every interior pixel then takes its tone from where it sits
ACROSS that span, sampled from one ramp. That is what makes it read as round:
the specular stripe stays a fixed fraction in from the left edge whether it is
crossing the nozzle, the shoulder or the body, exactly as a highlight does on
a real cylinder. Hand-placing it per row is how you get a bottle with a kink
in its reflection.

Run: py scripts/build_sauce_art.py
"""
import math
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public')

# ── the bottle ─────────────────────────────────────────────────────────────
BW, BH, BSCALE = 26, 76, 11

# Light comes from the upper left, like the lamps over the prep counter.
# Two entries of rim light, one hard specular, a long body, then three tones
# of shadow rolling off to the right.
BODY_RAMP = ['H', 'W', 'H', 'B', 'B', 'B', 'B', 'B', 'B', 'B',
             'B', 'M', 'M', 'M', 'S', 'S', 'D']
CAP_RAMP = ['w', 'w', 'N', 'N', 'N', 'n', 'n', 'd']

# (row_from, row_to_inclusive, left, right, part)
def bottle_spans():
    spans = []
    def add(y0, y1, x0, x1, part):
        spans.append((y0, y1, x0, x1, part))
    # the nozzle, tapering open
    add(0,  1,  11, 14, 'cap')
    add(2,  4,  10, 15, 'cap')
    add(5,  8,  10, 15, 'cap')
    # the collar it screws down onto
    add(9,  12, 8,  17, 'cap')
    add(13, 15, 7,  18, 'cap')
    # shoulders, opening out to the body over four rows
    add(16, 16, 6,  19, 'body')
    add(17, 17, 5,  20, 'body')
    add(18, 18, 4,  21, 'body')
    add(19, 19, 3,  22, 'body')
    # and the body, straight to the base
    add(20, 73, 2,  23, 'body')
    add(74, 75, 3,  22, 'body')
    return spans

LABEL_TOP, LABEL_BOT = 33, 45
EMBLEM_X, EMBLEM_Y = 10, 36

EMBLEMS = {
    'garlic': ["..E...", "..EE..", ".EEEE.", "EEEEEE", "EEEEEE", "EEEEEE", ".EEEE."],
    'chilli': ["....E.", "...EE.", "..EE..", ".EEE..", ".EEE..", ".EE...", "..E..."],
    'herb':   [".E..E.", "EEE.EE", ".E..E.", "..EE..", "..EE..", "..EE..", "..E..."],
}

PALETTES = {
    # body: K outline, H rim, W specular, B base, M/S/D shadow
    # cap:  w highlight, N plastic, n shade, d deepest
    # label: L paper, l its shadow, E the mark on it
    'garlic': dict(
        K='#2B2119', H='#FFFCF2', W='#FFFFFF', B='#F0E5CB', M='#DCCEAE',
        S='#C0AF8C', D='#9E8E6E',
        w='#FBFAF6', N='#E4DED0', n='#BDB6A6', d='#948D7E',
        L='#FFF8EA', l='#DACBAE', E='#A98F63'),
    'chilli': dict(
        K='#2A0E0B', H='#F79080', W='#FFC4B4', B='#D6342B', M='#B62622',
        S='#8E1A18', D='#6B1211',
        w='#A8352C', N='#7C1613', n='#560E0C', d='#3A0806',
        L='#FFF3E4', l='#DBC5AE', E='#B02219'),
    'herb': dict(
        K='#0F2110', H='#9BD186', W='#C6EAB4', B='#4E9440', M='#3F7A32',
        S='#2F5E27', D='#22461D',
        w='#43723A', N='#26521F', n='#173717', d='#0E220F'),
}
PALETTES['herb'].update(L='#F4F9E7', l='#CCD9B6', E='#2F6B25')


def bottle_grid(sauce):
    grid = [['.'] * BW for _ in range(BH)]
    for y0, y1, x0, x1, part in bottle_spans():
        ramp = CAP_RAMP if part == 'cap' else BODY_RAMP
        inner = x1 - x0 - 1          # interior columns between the outlines
        for y in range(y0, y1 + 1):
            grid[y][x0] = 'K'
            grid[y][x1] = 'K'
            for j in range(inner):
                t = j / (inner - 1) if inner > 1 else 0.0
                grid[y][x0 + 1 + j] = ramp[int(round(t * (len(ramp) - 1)))]

    # The base sits in its own shadow, and the very bottom row is all outline
    # -- a bottle lit from above has no rim light on the underside of it.
    for y in range(72, BH):
        for x in range(BW):
            if grid[y][x] in ('H', 'W', 'B'):
                grid[y][x] = 'M' if y < 74 else 'S'
    for x in range(BW):
        if grid[BH - 1][x] != '.':
            grid[BH - 1][x] = 'K'

    # A hard shoulder line under the collar: the step where the cap ends.
    for x in range(BW):
        if grid[16][x] != '.':
            grid[16][x] = 'K'

    # The label, wrapped right across the bottle.
    for y in range(LABEL_TOP, LABEL_BOT + 1):
        for x in range(BW):
            if grid[y][x] == 'K' or grid[y][x] == '.':
                continue
            grid[y][x] = 'l' if y in (LABEL_TOP, LABEL_BOT) else 'L'

    art = EMBLEMS[sauce]
    for dy, row in enumerate(art):
        for dx, ch in enumerate(row):
            if ch == 'E':
                grid[EMBLEM_Y + dy][EMBLEM_X + dx] = 'E'
    return grid


# ── the drizzle ────────────────────────────────────────────────────────────
DW, DH, DSCALE = 60, 22, 9


def drizzle_grid(seed):
    """A ribbon of sauce, not a wire.

    A squeezed line is thick where the hand slowed down and thin where it
    moved, and it catches the light along its upper edge -- which is the whole
    difference between sauce and a drawn zigzag. Thickness is driven off a
    second, slower wave than the path itself, so the fat parts don't land on
    the turns every time.
    """
    grid = [['.'] * DW for _ in range(DH)]
    mid = DH / 2 - 0.5
    for x in range(DW):
        u = x / (DW - 1)
        cy = mid + 5.6 * math.sin(u * math.pi * 3.35 + seed)
        half = (2.35 + 0.75 * math.sin(u * math.pi * 2.1 + seed * 1.7)) / 2
        # The ends of a squeeze taper off rather than stopping square.
        half *= min(1.0, 0.42 + u * 5.5, 0.42 + (1 - u) * 5.5)
        for y in range(DH):
            if abs(y - cy) <= half:
                grid[y][x] = 'B'

    # Outline first, off the raw silhouette, so the gloss can't erode it.
    out = [row[:] for row in grid]
    for y in range(DH):
        for x in range(DW):
            if grid[y][x] != '.':
                continue
            if any(0 <= y + dy < DH and 0 <= x + dx < DW and grid[y + dy][x + dx] == 'B'
                   for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'

    # Gloss along the top of the ribbon, shadow under its belly -- but only
    # where the ribbon is thick enough to have a top AND a middle. On the
    # steep diagonals a column is barely two cells deep, and glossing those
    # paints the whole stroke white: the line goes pale exactly where it is
    # moving fastest, which is the opposite of how a wet ribbon catches light.
    for x in range(DW):
        col = [y for y in range(DH) if grid[y][x] == 'B']
        if len(col) >= 3:
            out[col[0]][x] = 'W'
        if len(col) >= 4:
            out[col[1]][x] = 'H'
            out[col[-1]][x] = 'S'

    # Two drops that got away. Placed clear of the ribbon -- a drop touching
    # the stroke isn't a drop, it's a lump.
    def clear(bx, by):
        return all(out[y][x] == '.' for y in range(max(0, by - 2), min(DH, by + 4))
                   for x in range(max(0, bx - 2), min(DW, bx + 4)))
    placed = 0
    for bx, by in ((7, 3), (48, 18), (21, 2), (37, 19), (14, 18), (52, 3)):
        if placed == 2 or not clear(bx, by):
            continue
        placed += 1
        for dy in range(2):
            for dx in range(2):
                out[by + dy][bx + dx] = 'H' if (dy + dx) == 0 else 'B'
        for dy, dx in ((-1, 0), (2, 0), (2, 1), (-1, 1), (0, -1), (1, -1), (0, 2), (1, 2)):
            y, x = by + dy, bx + dx
            if 0 <= y < DH and 0 <= x < DW and out[y][x] == '.':
                out[y][x] = 'K'
    return out


def render(grid, palette, scale, path):
    h, w = len(grid), len(grid[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            ch = grid[y][x]
            if ch == '.':
                continue
            c = palette[ch]
            px[x, y] = (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)
    im = im.resize((w * scale, h * scale), Image.NEAREST)
    im.save(path, 'WEBP', lossless=True)
    print('  %-24s %dx%d' % (os.path.basename(path), im.width, im.height))


if __name__ == '__main__':
    for i, sauce in enumerate(('garlic', 'chilli', 'herb')):
        pal = PALETTES[sauce]
        render(bottle_grid(sauce), pal, BSCALE,
               os.path.join(OUT, 'sauce_%s.webp' % sauce))
        render(drizzle_grid(0.6 + i * 1.9), pal, DSCALE,
               os.path.join(OUT, 'drizzle_%s.webp' % sauce))
