#!/usr/bin/env python3
"""Gera as imagens do site: capturas otimizadas, imagens Open Graph e ícones.

Rodar só quando uma imagem mudar (o resultado vai para o repositório):

    python tools/assets.py

Precisa de Pillow (com AVIF) e fontTools + brotli:  pip install pillow fonttools brotli
As capturas vêm do repositório do jogo (TestResults/idiomas, geradas pelo próprio jogo);
o caminho pode ser trocado com a variável de ambiente GAME_CAPTURES.
"""
import io
import os
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"
FONTS = ROOT / "assets" / "fonts"
CAPTURES = Path(os.environ.get("GAME_CAPTURES", r"C:\projetos\stealthgame\TestResults\idiomas"))

WIDTHS = (640, 960, 1440, 1920)
# nome no site -> sufixo do arquivo de captura do jogo
SHOTS = {
    "e1758-desk": "1_hud_legenda",
    "e1758-disguise": "8_placas_hall",
    "e1758-caught": "6_game_over",
}
LANGS = {"en": "en", "pt-br": "pt-BR"}  # sufixo no site -> idioma da captura

BG = (13, 13, 11)
TEXT = (239, 236, 228)
MUTED = (168, 164, 152)
LINE = (34, 33, 30)
ACCENT = (255, 90, 31)


def captures():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, suffix in SHOTS.items():
        for slug, lang in LANGS.items():
            src = Image.open(CAPTURES / f"1920x1080_{lang}_{suffix}.png").convert("RGB")
            for w in WIDTHS:
                img = src if w == src.width else src.resize((w, round(w * src.height / src.width)), Image.LANCZOS)
                base = OUT / f"{name}-{slug}-{w}"
                img.save(f"{base}.avif", quality=58, speed=4)
                img.save(f"{base}.webp", quality=80, method=6)
            print("captura", name, slug)


def font(path, size, **axes):
    """Instância estática de uma fonte variável (o Pillow lê TTF; o site usa woff2)."""
    f = TTFont(path)
    if axes:
        f = instantiateVariableFont(f, axes)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


def tracked(draw, xy, text, fnt, fill, tracking=0.0):
    """Texto com espaçamento entre letras (tracking em em)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking * fnt.size
    return x


def og(slug, lines, eyebrow, words):
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(20, 20, 18))
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(20, 20, 18))

    archivo = FONTS / "archivo-var.woff2"
    mono = FONTS / "jetbrains-mono-var.woff2"
    brand = font(archivo, 30, wght=800, wdth=100)
    head = font(archivo, 148, wght=800, wdth=62)
    small = font(mono, 19, wght=500)

    x = tracked(d, (60, 52), "MAEDODEAM", brand, TEXT, 0.14)
    d.text((x, 52), "_", font=brand, fill=ACCENT)
    tracked(d, (60, 100), eyebrow.upper(), small, MUTED, 0.08)

    y = 140
    for i, line in enumerate(lines):
        last = i == len(lines) - 1
        text = line[:-1] if last and line.endswith(".") else line
        end = tracked(d, (56, y), text, head, TEXT, -0.01)
        if last and line.endswith("."):
            d.text((end, y), ".", font=head, fill=ACCENT)
        y += 128

    # captura real do jogo à direita, recortada
    shot = Image.open(OUT / f"e1758-desk-{slug}-1440.webp").convert("RGB")
    box_w, box_h = 430, 380
    sx = (shot.width - shot.height * box_w / box_h) / 2
    crop = shot.crop((int(sx), 0, int(sx + shot.height * box_w / box_h), shot.height)).resize((box_w, box_h), Image.LANCZOS)
    img.paste(crop, (W - 60 - box_w, 140))
    d.rectangle([W - 60 - box_w - 1, 139, W - 60, 140 + box_h], outline=(70, 68, 62))

    d.line([(60, 560), (W - 60, 560)], fill=LINE, width=1)
    d.rectangle([60, 558, 140, 561], fill=ACCENT)
    tracked(d, (60, 578), "  ·  ".join(words).upper(), small, MUTED, 0.06)
    url = "maedodeam.com.br"
    tracked(d, (W - 60 - len(url) * 12.6, 578), url, small, TEXT, 0.06)
    img.save(ROOT / "assets" / f"og-{slug}.jpg", quality=86, optimize=True, progressive=True)
    print("og", slug)


def mark(size):
    """Ícone: M + cursor, desenhado em 4x e reduzido."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = s / 64
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=12 * u, fill=BG)
    d.line([(14 * u, 42 * u), (14 * u, 15 * u), (32 * u, 33 * u), (50 * u, 15 * u), (50 * u, 42 * u)],
           fill=TEXT, width=round(7 * u), joint="curve")
    d.rectangle([14 * u, 48 * u, 50 * u, 54 * u], fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)


def icons():
    mark(180).convert("RGB").save(ROOT / "apple-touch-icon.png", optimize=True)
    mark(64).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("ícones")


if __name__ == "__main__":
    captures()
    og("en", ["WE", "BUILD", "THINGS."], "Independent technology company",
       ["Software", "Products", "Games", "Experiments"])
    og("pt-br", ["A GENTE", "CONSTRÓI", "COISAS."], "Empresa independente de tecnologia",
       ["Software", "Produtos", "Jogos", "Experimentos"])
    icons()
