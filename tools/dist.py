#!/usr/bin/env python3
"""Monta em _site/ somente o que o site publicado precisa (lista de permissão), sem fontes, testes,
documentação interna, configuração nem páginas de desenvolvimento.

Uso:  python tools/dist.py            (gera _site/)
      python tools/dist.py --list     (só lista o que seria publicado)

Não gera páginas: copia as que src/build.py já gerou e estão no repositório. Falha se algo proibido
aparecer no resultado (fonte TypeScript/Python, source map, package.json, Markdown, galeria de dev...).
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"

# o que o site usa, e nada mais
FILES = [
    "index.html", "support.html", "privacy.html", "404.html",
    "favicon.svg", "favicon.ico", "apple-touch-icon.png",
    "robots.txt", "sitemap.xml", "CNAME",
]
DIRS = {
    "pt-br": {".html"},
    "play": {".html"},
    "assets": {".css", ".js", ".woff2", ".txt", ".avif", ".webp", ".jpg", ".png", ".svg"},
}

FORBIDDEN_SUFFIXES = {".ts", ".py", ".map", ".md", ".mjs", ".cjs", ".tsx", ".lock", ".yml", ".yaml"}
FORBIDDEN_GAME_APIS = ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "serviceWorker",
                       "sendBeacon", "XMLHttpRequest", "WebSocket", "fetch(", "caches."]
# Com telemetria ligada (CSP do jogo libera um endereço em connect-src), o jogo pode usar só estas duas, e só para ele.
TELEMETRY_APIS = {"sendBeacon", "fetch("}
FORBIDDEN_NAMES = {"package.json", "package-lock.json", "tsconfig.json", ".gitignore", ".nojekyll", "gallery.html", "gallery.js", "music-lab.js"}


def collect() -> list[Path]:
    files = [ROOT / f for f in FILES]
    for d, exts in DIRS.items():
        files += sorted(p for p in (ROOT / d).rglob("*") if p.is_file() and p.suffix.lower() in exts)
    missing = [str(p.relative_to(ROOT)) for p in files if not p.is_file()]
    if missing:
        sys.exit(f"faltando: {', '.join(missing)} (rode python src/build.py antes)")
    return files


def check(files: list[Path]) -> None:
    bad = [str(p.relative_to(ROOT)) for p in files if p.suffix.lower() in FORBIDDEN_SUFFIXES or p.name in FORBIDDEN_NAMES]
    for p in files:
        if p.suffix in {".js", ".css"} and b"sourceMappingURL" in p.read_bytes():
            bad.append(f"{p.relative_to(ROOT)} (aponta para source map)")
    for p in files:
        if p.suffix == ".html" and b'http-equiv="Content-Security-Policy"' not in p.read_bytes():
            bad.append(f"{p.relative_to(ROOT)} (sem CSP)")
    # o jogo não guarda nada; e só fala com a rede se a CSP da página do jogo liberar o serviço de telemetria
    game = (ROOT / "assets/play/game.js").read_text(encoding="utf-8")
    connect = set()
    for page in ("play/index.html", "pt-br/play/index.html"):
        m = re.search(r"connect-src ([^;\"]+)", (ROOT / page).read_text(encoding="utf-8"))
        connect.add(m.group(1).strip() if m else "?")
    if len(connect) != 1:
        bad.append(f"play/: CSP diferente entre os idiomas ({connect})")
    allowed = connect.pop() if len(connect) == 1 else "'none'"
    tele = allowed if re.fullmatch(r"https://[a-z0-9.-]+(:\d+)?", allowed, re.I) else None
    if allowed != "'none'" and not tele:
        bad.append(f"play/: connect-src inesperado: {allowed}")
    for api in FORBIDDEN_GAME_APIS:
        if api in game and not (tele and api in TELEMETRY_APIS):
            bad.append(f"assets/play/game.js (usa {api})")
    for url in re.findall(r"https?://[^\s\"'`)]+", game):
        if not url.startswith("http://www.w3.org/") and not (tele and url.startswith(tele)):
            bad.append(f"assets/play/game.js (endereço externo {url})")
    if tele and tele not in game:
        bad.append("play/: CSP libera telemetria, mas o jogo não foi gerado com ela")
    if bad:
        sys.exit("ERRO: não pode ser publicado:\n  " + "\n  ".join(bad))


def main() -> None:
    files = collect()
    check(files)
    if "--list" in sys.argv:
        for p in files:
            print(p.relative_to(ROOT).as_posix())
        print(f"{len(files)} arquivos")
        return
    if OUT.exists():
        shutil.rmtree(OUT)
    for p in files:
        dest = OUT / p.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)
    size = sum(p.stat().st_size for p in files)
    print(f"_site/: {len(files)} arquivos, {size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
