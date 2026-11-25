"""Рисует иконку MD Viewer и сохраняет src/app.ico (16–256 px) и docs/icon.png.

Дизайн: белый лист с загнутым углом и строками текста, поверх — плашка
с надписью «.md» и «ягодным» градиентом (малиновый → фиолетовый).
Для 16–24 px рисуется упрощённая версия: текст там всё равно не читается,
поэтому остаются лист и цветная плашка покрупнее.

Запуск из корня проекта:  py tools/make_icon.py   (нужен Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # рисуем крупно, потом уменьшаем — так края гладкие

BERRY_FROM = (225, 29, 72)   # малиновый
BERRY_TO = (147, 51, 234)    # фиолетовый
PAPER = (252, 252, 253, 255)
FOLD = (214, 221, 232, 255)
LINE = (203, 213, 225, 255)
WHITE = (255, 255, 255, 255)


def font(size: int) -> ImageFont.FreeTypeFont:
    for name in ("seguibl.ttf", "segoeuib.ttf"):  # Segoe UI Black / Bold
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    raise SystemExit("Не найден шрифт Segoe UI Black/Bold")


def berry_gradient() -> Image.Image:
    """Диагональный градиент: левый верх малиновый, правый низ фиолетовый."""
    g = Image.new("RGB", (256, 256))
    px = g.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BERRY_FROM, BERRY_TO))
    return g.resize((S, S), Image.BICUBIC)


def draw(small: bool) -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    l, t, r, b, fold = (150, 40, 874, 984, 230) if small else (180, 60, 844, 964, 210)

    # Мягкая тень (в мелких размерах только мешает)
    if not small:
        sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((l + 10, t + 26, r + 10, b + 26), 70, fill=(0, 0, 0, 70))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))

    # Лист с вырезанным углом
    m = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(m)
    md.rounded_rectangle((l, t, r, b), 70, fill=255)
    md.polygon([(r - fold, t - 5), (r + 5, t - 5), (r + 5, t + fold)], fill=0)
    img.paste(Image.new("RGBA", (S, S), PAPER), (0, 0), m)
    d = ImageDraw.Draw(img)
    d.polygon([(r - fold, t), (r - fold, t + fold - 50), (r - fold + 50, t + fold), (r, t + fold)], fill=FOLD)
    if small:
        # контур, чтобы белый лист не терялся на светлом фоне
        d.rounded_rectangle((l, t, r, b), 70, outline=(148, 163, 184, 255), width=40)

    # Строки текста
    if small:
        d.rounded_rectangle((280, 260, 640, 330), 35, fill=LINE)
    else:
        for i, w in enumerate([360, 440, 300]):
            y = 210 + i * 86
            d.rounded_rectangle((290, y, 290 + w, y + 40), 20, fill=LINE)

    # Ягодная плашка
    band = (90, 470, 934, 900) if small else (120, 540, 904, 860)
    pm = Image.new("L", (S, S), 0)
    ImageDraw.Draw(pm).rounded_rectangle(band, 90 if small else 80, fill=255)
    img.paste(berry_gradient(), (0, 0), pm)

    if not small:
        f = font(300)
        lb, tb, rb, bb = d.textbbox((0, 0), ".md", font=f)
        cx, cy = (band[0] + band[2]) / 2, (band[1] + band[3]) / 2
        d.text((cx - (lb + rb) / 2, cy - (tb + bb) / 2), ".md", font=f, fill=WHITE)
    return img


def main() -> None:
    full, small = draw(small=False), draw(small=True)
    sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    frames = [(small if s <= 24 else full).resize((s, s), Image.LANCZOS) for s in sizes]

    ico = ROOT / "src" / "app.ico"
    frames[-1].save(ico, format="ICO", sizes=[(s, s) for s in sizes], append_images=frames[:-1])

    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    full.resize((256, 256), Image.LANCZOS).save(docs / "icon.png")
    print("saved", ico, docs / "icon.png")


if __name__ == "__main__":
    main()
