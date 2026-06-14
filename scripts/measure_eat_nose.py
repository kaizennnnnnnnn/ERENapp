from PIL import Image, ImageDraw

PUB = r'C:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public'
OUTDIR = r'C:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\scripts'
VW, VH = 390, 844

def cover(bg, vw, vh):
    bw, bh = bg.size
    s = max(vw / bw, vh / bh)
    bg = bg.resize((int(bw * s), int(bh * s)), Image.LANCZOS)
    return bg.crop(((bg.width - vw) // 2, (bg.height - vh) // 2,
                    (bg.width - vw) // 2 + vw, (bg.height - vh) // 2 + vh))

def find_nose(im):
    # Pink nose: R notably > G and > B, and clearly pink (not red, not white).
    W, H = im.size
    px = im.load()
    xs, ys = [], []
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if r > 175 and (r - g) > 45 and (r - b) > 15 and b > g - 10 and g < 190:
                xs.append(x); ys.append(y)
    if not xs:
        return None
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    return cx / W * 100, cy / H * 100, len(xs)

print('=== nose (x%, y%-from-top, px) ===')
noses = {}
for n in ['erenEat1', 'erenEat2', 'erenEat3', 'erenEat4']:
    im = Image.open(f'{PUB}\\{n}.png').convert('RGBA')
    res = find_nose(im)
    noses[n] = res
    if res:
        nx, ny, c = res
        print(f'{n}: x={nx:.1f}%  y={ny:.1f}%  fromBottom={100-ny:.1f}%  ({c}px)')
    else:
        print(f'{n}: no nose found')

# Preview eating at a smaller width with a mock plate under the nose.
def eat_frame(width, bottom_pct):
    bg = cover(Image.open(f'{PUB}\\kitchen.png').convert('RGBA'), VW, VH)
    out = []
    for n in ['erenEat1', 'erenEat2', 'erenEat3', 'erenEat4']:
        f = bg.copy()
        pose = Image.open(f'{PUB}\\{n}.png').convert('RGBA')
        w, h = pose.size
        nh = int(h * width / w)
        pose_r = pose.resize((width, nh), Image.NEAREST)
        x = (VW - width) // 2
        y = int(VH - VH * bottom_pct / 100 - nh)
        f.alpha_composite(pose_r, (x, y))
        # mock plate (ellipse) centered-x at the nose's vertical level
        d = ImageDraw.Draw(f)
        res = noses[n]
        if res:
            nx, ny, _ = res
            noseY_px = y + nh * ny / 100
            pcx = VW // 2
            pw, ph = int(width * 0.34), 14
            # plate top sits a touch below the nose
            ptop = int(noseY_px + 4)
            d.ellipse([pcx - pw // 2, ptop, pcx + pw // 2, ptop + ph],
                      fill=(204, 51, 51, 230), outline=(255, 255, 255, 255))
        out.append(f)
    gap = 8
    mont = Image.new('RGBA', (VW * 4 + gap * 3, VH), (20, 20, 24, 255))
    for i, f in enumerate(out):
        mont.paste(f, (i * (VW + gap), 0))
    return mont

eat_frame(160, 10).save(f'{OUTDIR}\\_preview_eat2.png')
print('wrote _preview_eat2.png (width 160, mock plate at nose)')
