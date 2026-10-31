#!/usr/bin/env python3
"""Builds the sprite atlases used by Mister M v0.6.

Reads the user's original cut-outs (segments.zip -> set a, segments (1).zip -> set b),
cleans the light halo, downsamples to a clean pixel grid, adds a 1px outline and
writes one atlas per character variant plus a JS manifest.
Originals are never modified.

usage: buildSprites.py <setA dir> <setB dir> <out dir> [sheets dir]
"""
import sys, json, colorsys
from pathlib import Path
import numpy as np
from PIL import Image

REF_HEIGHT = 184.0  # height of the idle reference frame in the source art
OUTLINE = (20, 14, 30, 255)

# Frames actually used by poses.js
FRAME_IDS = (
    ['a-%02d' % n for n in (1, 2, 4, 5, 7, 9, 10, 11, 12, 15, 17, 19, 20, 22, 23, 26, 27, 31, 33, 34, 35, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48)] +
    ['b-%02d' % n for n in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 17, 21, 24, 28, 33, 36, 44)]
)

# name -> height in px, colour spec, accessory
VARIANTS = {
    'hero':       dict(h=74),
    'agitator':   dict(h=74, suit=(24, 0.85, 1.25), shirt=(200, .2, 1.0), hair=(40, 1.0, 1.6), skin=(1.0, .88), acc='cap'),
    'pyme':       dict(h=74, suit=(176, 0.55, 1.1), shirt=(0, 0, 1.0), hair=(20, 1.0, 1.15)),
    'merchant':   dict(h=74, suit=(96, 0.62, 1.05), shirt=(48, .3, 1.0), hair=(18, 1.0, .85), skin=(1.0, 1.0)),
    'homeless':   dict(h=72, suit=(28, 0.3, 0.9), shirt=(30, .15, .7), hair=(35, .4, 1.5), skin=(1.0, .85), acc='beanie'),
    'retiree':    dict(h=68, suit=(300, 0.28, 1.35), shirt=(0, 0, 1.0), hair=(0, .08, 2.6), acc='none'),
    'student':    dict(h=68, suit=(268, 0.62, 1.3), shirt=(60, .3, 1.0), hair=(5, 1.0, 1.1), acc='backpack'),
    'puppeteer':  dict(h=92, suit=(168, 0.45, 0.8), shirt=(48, .7, 1.0), hair=(0, .05, 2.2)),
}


# Painted sheets supplied by the user (8 columns x 6 rows, 200 px cells, white background).
# name -> (file, target height, walk row, {pose: (row, col)})
SHEETS = {
    'worker':   ('worker.jpg',   76, 1, {'idle': (2, 0), 'windup': (0, 0), 'attack': (1, 3)}),
    'militant': ('militant.jpg', 74, 1, {'idle': (4, 0), 'windup': (5, 0), 'attack': (5, 3)}),
    'tycoon':   ('tycoon.jpg',   96, 1, {'idle': (4, 0), 'windup': (4, 6), 'attack': (3, 0)}),
}


def cutCell(sheet, r, c):
    cell = sheet.crop((c * 200 + 5, r * 200 + 5, c * 200 + 195, r * 200 + 195)).convert('RGBA')
    a = np.array(cell)
    rgb = a[:, :, :3].astype(np.int16)
    hi, lo = rgb.max(axis=2), rgb.min(axis=2)
    bg = (lo >= 150) & ((hi - lo) < 24)  # white paper, JPEG fringe and the soft floor shadow
    h, w = bg.shape
    seen = np.zeros_like(bg)
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    while stack:  # flood fill from the border: only background connected to the outside is removed
        y, x = stack.pop()
        if 0 <= y < h and 0 <= x < w and bg[y, x] and not seen[y, x]:
            seen[y, x] = True
            stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    a[seen, 3] = 0
    # keep the largest connected blob: drops sweat drops, dust and floating coins
    alpha = a[:, :, 3] > 0
    label = np.zeros(alpha.shape, np.int32); sizes = {}; n = 0
    for y0 in range(h):
        for x0 in range(w):
            if alpha[y0, x0] and not label[y0, x0]:
                n += 1; label[y0, x0] = n; st = [(y0, x0)]; cnt = 0
                while st:
                    y, x = st.pop(); cnt += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and alpha[yy, xx] and not label[yy, xx]:
                            label[yy, xx] = n; st.append((yy, xx))
                sizes[n] = cnt
    keep = max(sizes, key=sizes.get)
    a[label != keep, 3] = 0
    return cleanHalo(a)


def cleanHalo(a):
    """Flood-removes the near-white fringe that surrounds the dark outline.
    Only light pixels connected to the transparent background are removed, so
    eyes, teeth and shirt highlights enclosed by the outline are preserved."""
    for _ in range(24):
        alpha = a[:, :, 3] > 0
        pad = np.pad(alpha, 1)
        edge = alpha & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:] &
                         pad[:-2, :-2] & pad[:-2, 2:] & pad[2:, :-2] & pad[2:, 2:])
        rgb = a[:, :, :3].astype(np.int16)
        hi, lo = rgb.max(axis=2), rgb.min(axis=2)
        light = (hi > 105) & ((hi - lo) < 0.2 * np.maximum(hi, 1))  # whitish / grey, not skin or blue cloth
        kill = edge & light
        if not kill.any():
            break
        a[kill, 3] = 0
    return a


def recolor(a, spec):
    if not any(k in spec for k in ('suit', 'shirt', 'hair', 'skin')):
        return a
    rgb = a[:, :, :3].astype(np.float32) / 255.0
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    v, d = mx, mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h = np.zeros_like(v)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    hd = h * 360.0
    opaque = a[:, :, 3] > 0
    suitMask = opaque & (hd > 195) & (hd < 265) & (s > 0.22)
    shirtMask = suitMask & (v > 0.6)
    suitMask = suitMask & ~shirtMask
    hairMask = opaque & (hd > 8) & (hd < 50) & (s > 0.2) & (v > 0.1) & (v < 0.42)
    skinMask = opaque & (hd > 8) & (hd < 40) & (s > 0.2) & (s < 0.75) & (v >= 0.55)
    out = rgb.copy()

    def paint(mask, hue, sat, val, keepV=True):
        idx = np.argwhere(mask)
        for y, x in idx:
            nv = min(1.0, v[y, x] * val)
            ns = min(1.0, max(0.0, s[y, x] * sat)) if keepV else sat
            out[y, x] = colorsys.hsv_to_rgb((hue % 360) / 360.0, ns, nv)

    if 'suit' in spec:
        hue, sat, val = spec['suit']
        paint(suitMask, hue, sat / max(0.01, 0.8) if sat > 0 else 0, val)
    if 'shirt' in spec:
        hue, sat, val = spec['shirt']
        idx = np.argwhere(shirtMask)
        for y, x in idx:
            out[y, x] = colorsys.hsv_to_rgb(hue / 360.0, sat, min(1.0, 0.55 + v[y, x] * 0.5 * val))
    if 'hair' in spec:
        hue, sat, val = spec['hair']
        if hue == 0 and sat < 0.1:  # grey / white hair
            idx = np.argwhere(hairMask)
            for y, x in idx:
                gv = min(1.0, v[y, x] * val)
                out[y, x] = (gv, gv, gv * 1.02 if gv < .98 else gv)
        else:
            paint(hairMask, hue, sat, val)
    if 'skin' in spec:
        sMul, vMul = spec['skin']
        idx = np.argwhere(skinMask)
        for y, x in idx:
            out[y, x] = colorsys.hsv_to_rgb(h[y, x], min(1, s[y, x] * sMul), min(1, v[y, x] * vMul))
    res = a.copy()
    res[:, :, :3] = np.clip(out * 255.0, 0, 255).astype(np.uint8)
    return res


def downscale(a, factor):
    im = Image.fromarray(a, 'RGBA')
    w, h = max(1, round(im.width * factor)), max(1, round(im.height * factor))
    arr = np.array(im).astype(np.float32)
    al = arr[:, :, 3:4] / 255.0
    pm = Image.fromarray(np.concatenate([arr[:, :, :3] * al, arr[:, :, 3:4]], axis=2).astype(np.uint8), 'RGBA')
    small = np.array(pm.resize((w, h), Image.BOX)).astype(np.float32)
    al2 = small[:, :, 3:4] / 255.0
    rgb = np.where(al2 > 0.01, small[:, :, :3] / np.maximum(al2, 0.01), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), (al2 > 0.5) * 255.0], axis=2).astype(np.uint8)
    return out


def addOutline(a):
    h, w = a.shape[:2]
    big = np.zeros((h + 2, w + 2, 4), np.uint8)
    big[1:-1, 1:-1] = a
    alpha = big[:, :, 3] > 0
    pad = np.pad(alpha, 1)
    near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    ring = near & ~alpha
    big[ring] = OUTLINE
    return big


def trim(a):
    ys, xs = np.where(a[:, :, 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def anchors(a):
    h, w = a.shape[:2]
    al = a[:, :, 3] > 0
    hip = al[int(h * .50):int(h * .64)]
    xs = np.where(hip)[1]
    px = int(round(xs.mean())) if len(xs) else w // 2
    top = np.where(al.any(axis=1))[0][0]
    band = al[top:top + max(3, int(h * .14))]
    hx = int(round(np.where(band)[1].mean())) if band.any() else w // 2
    return px, hx, int(top)


def put(a, shape, color, x, y):
    """Paints a rectangle clipped to existing opaque head pixels' neighbourhood."""
    h, w = a.shape[:2]
    for yy in range(y, y + shape[1]):
        for xx in range(x, x + shape[0]):
            if 0 <= yy < h and 0 <= xx < w:
                a[yy, xx] = color


def accessory(a, kind, hx, hy, px):
    if kind in (None, 'none'):
        return
    c = lambda r, g, b: (r, g, b, 255)
    dark = c(20, 14, 30)
    if kind == 'helmet':
        put(a, (19, 6), c(250, 214, 70), hx - 9, hy + 1)
        put(a, (13, 2), c(255, 236, 130), hx - 6, hy)
        put(a, (23, 2), c(232, 186, 40), hx - 11, hy + 7)
        put(a, (23, 1), dark, hx - 11, hy + 9)
    elif kind == 'headband':
        put(a, (21, 3), c(224, 56, 72), hx - 10, hy + 9)
        put(a, (4, 2), c(224, 56, 72), hx - 14, hy + 11)
    elif kind == 'cap':
        put(a, (19, 7), c(60, 150, 210), hx - 9, hy + 1)
        put(a, (19, 1), c(130, 200, 240), hx - 9, hy + 1)
        put(a, (9, 3), c(36, 100, 160), hx + 8, hy + 7)
    elif kind == 'beanie':
        put(a, (19, 9), c(120, 128, 140), hx - 9, hy + 1)
        put(a, (21, 3), c(84, 90, 104), hx - 10, hy + 8)
        put(a, (3, 3), c(200, 200, 210), hx - 1, hy - 2)
    elif kind == 'backpack':
        yy = int(a.shape[0] * .34)
        put(a, (9, 18), c(240, 174, 70), px - 20, yy)
        put(a, (9, 3), c(150, 90, 40), px - 20, yy + 10)
        put(a, (9, 1), dark, px - 20, yy - 1)


def main(srcA, srcB, out, srcSheets='sheets'):
    srcA, srcB, out = Path(srcA), Path(srcB), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {'refHeight': REF_HEIGHT, 'variants': {}}
    for name, spec in VARIANTS.items():
        factor = spec['h'] / REF_HEIGHT
        tiles = []
        for fid in FRAME_IDS:
            folder, num = (srcA, int(fid[2:])) if fid[0] == 'a' else (srcB, int(fid[2:]))
            a = np.array(Image.open(folder / 'pixel-art-character' / ('pixel-art-character-%d.png' % num)).convert('RGBA'))
            a = cleanHalo(a)
            a = recolor(a, spec)
            a = downscale(a, factor)
            a = trim(a)
            # reduce the palette a little so edges read as hand-placed pixels
            rgb = Image.fromarray(a[:, :, :3]).quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
            a = np.concatenate([np.array(rgb), a[:, :, 3:4]], axis=2)
            a = addOutline(a)
            px, hx, hy = anchors(a)
            accessory(a, spec.get('acc'), hx, hy + 1, px)
            tiles.append((fid, a, px, hx, hy))
        finish(name, tiles, spec['h'], out, manifest)
    for name, (file, height, walkRow, poses) in SHEETS.items():
        sheet = Image.open(Path(srcSheets) / file)
        cells = {'w%d' % i: (walkRow, i) for i in range(8)}
        cells.update(poses)
        raw = {k: cutCell(sheet, r, c) for k, (r, c) in cells.items()}
        refH = max(np.where(raw['idle'][:, :, 3] > 0)[0]) - min(np.where(raw['idle'][:, :, 3] > 0)[0]) + 1
        factor = height / float(refH)
        tiles = []
        for fid, a in raw.items():
            a = downscale(trim(a), factor)
            rgb = Image.fromarray(a[:, :, :3]).quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
            a = addOutline(np.concatenate([np.array(rgb), a[:, :, 3:4]], axis=2))
            px, hx, hy = anchors(a)
            tiles.append((fid, a, px, hx, hy))
        finish(name, tiles, height, out, manifest)
    import hashlib
    digest = hashlib.sha256()
    for name in manifest['variants']:
        digest.update((out / ('%s.png' % name)).read_bytes())
    manifest['version'] = digest.hexdigest()[:10]
    (out / 'manifest.js').write_text('// Generated by tools/buildSprites.py. Do not edit by hand.\nexport const spriteManifest = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')


def finish(name, tiles, height, out, manifest):
    if True:
        maxW = 640
        x = y = rowH = 0
        placed = {}
        for fid, a, px, hx, hy in sorted(tiles, key=lambda t: -t[1].shape[0]):
            h, w = a.shape[:2]
            if x + w + 1 > maxW:
                x, y, rowH = 0, y + rowH + 1, 0
            placed[fid] = (x, y, w, h, px, hx, hy, a)
            x += w + 1
            rowH = max(rowH, h)
        atlas = Image.new('RGBA', (maxW, y + rowH + 1), (0, 0, 0, 0))
        frames = {}
        for fid, (x, y, w, h, px, hx, hy, a) in placed.items():
            atlas.paste(Image.fromarray(a, 'RGBA'), (x, y))
            frames[fid] = dict(x=x, y=y, w=w, h=h, px=px, py=h - 1, hx=hx, hy=hy)
        atlas.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out / ('%s.png' % name), optimize=True)
        manifest['variants'][name] = dict(image='%s.png' % name, height=height, frames=frames)
        print(name, atlas.size, (out / ('%s.png' % name)).stat().st_size)


if __name__ == '__main__':
    main(*sys.argv[1:5])
