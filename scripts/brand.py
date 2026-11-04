# Brand the generated Capacitor Android project: black E on white icon + splash.
# Run from repo root AFTER `npx cap add android`. Needs Pillow.
import glob
import os
from PIL import Image, ImageDraw

RES = 'android/app/src/main/res'
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# density -> (legacy launcher px, adaptive foreground px)
DENSITIES = {
    'mdpi': (48, 108),
    'hdpi': (72, 162),
    'xhdpi': (96, 216),
    'xxhdpi': (144, 324),
    'xxxhdpi': (192, 432),
}

BG_XML = '''<?xml version='1.0' encoding='utf-8'?>
<resources>
    <color name='ic_launcher_background'>#FFFFFF</color>
</resources>
'''


def draw_e(d, cx, cy, h):
    # Boxy letter E built from rectangles (no font needed).
    w = h * 0.78
    t = h / 5.0
    x0, y0 = cx - w / 2, cy - h / 2

    def rect(a, b, c, e):
        d.rectangle([round(a), round(b), round(c) - 1, round(e) - 1], fill=BLACK)

    rect(x0, y0, x0 + t, y0 + h)                       # spine
    rect(x0, y0, x0 + w, y0 + t)                       # top
    rect(x0, cy - t / 2, x0 + w * 0.82, cy + t / 2)    # middle
    rect(x0, y0 + h - t, x0 + w, y0 + h)               # bottom


def square_icon(size):
    img = Image.new('RGBA', (size, size), WHITE)
    draw_e(ImageDraw.Draw(img), size / 2, size / 2, size * 0.56)
    return img


def round_icon(size):
    img = Image.new('RGBA', (size, size), CLEAR)
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], fill=WHITE)
    draw_e(d, size / 2, size / 2, size * 0.46)
    return img


def foreground(size):
    img = Image.new('RGBA', (size, size), CLEAR)
    draw_e(ImageDraw.Draw(img), size / 2, size / 2, size * 0.34)  # inside 66% safe zone
    return img


def main():
    for dens, (legacy, fg) in DENSITIES.items():
        folder = f'{RES}/mipmap-{dens}'
        if not os.path.isdir(folder):
            continue
        square_icon(legacy).save(f'{folder}/ic_launcher.png')
        round_icon(legacy).save(f'{folder}/ic_launcher_round.png')
        foreground(fg).save(f'{folder}/ic_launcher_foreground.png')

    os.makedirs(f'{RES}/values', exist_ok=True)
    with open(f'{RES}/values/ic_launcher_background.xml', 'w') as f:
        f.write(BG_XML)

    for path in glob.glob(f'{RES}/drawable*/splash.png'):
        w, h = Image.open(path).size
        img = Image.new('RGBA', (w, h), WHITE)
        draw_e(ImageDraw.Draw(img), w / 2, h / 2, min(w, h) * 0.16)
        img.save(path)
    print('branding done')


if __name__ == '__main__':
    main()
