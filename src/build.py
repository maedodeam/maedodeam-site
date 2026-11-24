#!/usr/bin/env python3
"""Gera as páginas do site a partir de src/ (templates + textos em JSON). Só biblioteca padrão.

    python src/build.py          gera as páginas
    python src/build.py --check  só confere se as páginas geradas estão em dia (sai com erro se não)

Templates: {{ chave }} insere o texto como HTML, {{ chave|e }} insere escapado (para atributos),
{{> nome }} inclui src/partials/nome.html. Os textos ficam em src/i18n/<idioma>.json.
"""
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = "https://maedodeam.com.br"
# E-mail de contato publicado no site. Fica fora do código, numa variável de ambiente definida por quem
# roda o build (ex.: setx SITE_CONTACT_EMAIL "contato@exemplo.com" no Windows, e reabrir o terminal).
EMAIL = os.environ.get("SITE_CONTACT_EMAIL", "").strip()
LINKEDIN = ""  # ex.: "https://www.linkedin.com/in/..." — vazio esconde o link

LANGS = {
    "en": {"dir": "", "slug": "en", "og_locale": "en_US", "privacy": "en"},
    "pt-BR": {"dir": "pt-br/", "slug": "pt-br", "og_locale": "pt_BR", "privacy": "pt-BR"},
}
WIDTHS = (640, 960, 1440, 1920)
APP_WIDTHS = (480, 736)  # telas do DataBairro (tools/assets.py), 736 × 470, iguais nos dois idiomas
DATABAIRRO_URL = "https://app.databairro.com.br/"
ARROW = '<span class="arw" aria-hidden="true"></span>'

TOKEN = re.compile(r"{{\s*(>)?\s*([\w.\-]+)\s*(\|e)?\s*}}")


def load(lang):
    return json.loads((SRC / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))


def lookup(ctx, path):
    cur = ctx
    for part in path.split("."):
        try:
            cur = cur[part]
        except (KeyError, TypeError):
            raise KeyError(f"chave inexistente no template: {path}") from None
    return cur


def render(tpl, ctx):
    def rep(m):
        if m.group(1):
            return render((SRC / "partials" / f"{m.group(2)}.html").read_text(encoding="utf-8"), ctx).rstrip("\n")
        value = str(lookup(ctx, m.group(2)))
        if m.group(3):
            return html.escape(value, quote=True)
        if m.group(2).startswith("t."):
            value = value.replace("→", ARROW)
        return value
    return TOKEN.sub(rep, tpl)


def picture(root, name, slug, alt, sizes, loading="lazy"):
    base = f"{root}assets/img/{name}-{slug}"
    avif = ", ".join(f"{base}-{w}.avif {w}w" for w in WIDTHS)
    webp = ", ".join(f"{base}-{w}.webp {w}w" for w in WIDTHS)
    return (f'<picture><source type="image/avif" srcset="{avif}" sizes="{sizes}">'
            f'<img src="{base}-1440.webp" srcset="{webp}" sizes="{sizes}" width="1920" height="1080" '
            f'alt="{html.escape(alt, quote=True)}" loading="{loading}" decoding="async"></picture>')


def app_picture(root, name, alt, sizes):
    base = f"{root}assets/img/databairro-{name}"
    avif = ", ".join(f"{base}-{w}.avif {w}w" for w in APP_WIDTHS)
    webp = ", ".join(f"{base}-{w}.webp {w}w" for w in APP_WIDTHS)
    return (f'<picture><source type="image/avif" srcset="{avif}" sizes="{sizes}">'
            f'<img src="{base}-736.webp" srcset="{webp}" sizes="{sizes}" width="736" height="470" '
            f'alt="{html.escape(alt, quote=True)}" loading="lazy" decoding="async"></picture>')


def seo(t, url, alternates, og_image, og_locale, og_alt_locales, og_alt):
    lines = [f'<link rel="canonical" href="{url}">']
    for hreflang, href in alternates:
        lines.append(f'<link rel="alternate" hreflang="{hreflang}" href="{href}">')
    title = html.escape(t["meta"]["title"], quote=True)
    desc = html.escape(t["meta"]["description"], quote=True)
    lines += [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="MAEDODEAM">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{og_image}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{html.escape(og_alt, quote=True)}">',
        f'<meta property="og:locale" content="{og_locale}">',
    ]
    lines += [f'<meta property="og:locale:alternate" content="{loc}">' for loc in og_alt_locales]
    lines += [
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{title}">',
        f'<meta name="twitter:description" content="{desc}">',
        f'<meta name="twitter:image" content="{og_image}">',
    ]
    return "\n".join(lines)


def lang_switch(current, targets, label):
    parts = []
    for lang, (short, href) in targets.items():
        if lang == current:
            parts.append(f'<span lang="{lang}" aria-current="true">{short}</span>')
        else:
            parts.append(f'<a href="{href}" hreflang="{lang}" lang="{lang}">{short}</a>')
    return f'<div class="lang" role="group" aria-label="{html.escape(label, quote=True)}">' + '<span aria-hidden="true">/</span>'.join(parts) + "</div>"


def jsonld(t, lang, url):
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": f"{SITE}/#org",
                "name": "MAEDODEAM",
                "legalName": "MAEDODEAM CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA",
                "url": f"{SITE}/",
                "logo": f"{SITE}/apple-touch-icon.png",
                "email": EMAIL,
                "description": t["meta"]["jsonld_description"],
                "founder": {"@type": "Person", "name": "Roger Maedo", "jobTitle": t["about"]["sign_role"],
                            **({"sameAs": [LINKEDIN]} if LINKEDIN else {})},
            },
            {
                "@type": "WebSite",
                "@id": f"{SITE}/#website",
                "url": url,
                "name": "MAEDODEAM",
                "inLanguage": lang,
                "publisher": {"@id": f"{SITE}/#org"},
            },
        ],
    }
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def version(*files):
    h = hashlib.sha1()
    for f in files or ("assets/site.css", "assets/site.js"):
        h.update((ROOT / f).read_bytes())
    return h.hexdigest()[:8]


MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def telemetry_config():
    """Telemetria (telemetry/client.config.json). None = desligada (padrão): o site sai exatamente como sem ela.
    Ligada, a MESMA chave liga tudo junto: coleta no jogo, CSP, aviso e botão na tela inicial, textos e a seção
    da política de privacidade (com a data e a retenção daqui)."""
    # TELEMETRY_CONFIG: outro arquivo de configuração (só para testes com --print, que não gravam nada)
    cfg_path = Path(os.environ.get("TELEMETRY_CONFIG") or ROOT / "telemetry" / "client.config.json")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    endpoint = (cfg.get("endpoint") or "").strip()
    if not endpoint:
        return None
    m = re.match(r"^(https://[a-z0-9.-]+(?::\d+)?|http://(?:127\.0\.0\.1|localhost):\d+)(?:/|$)", endpoint, re.I)
    if not m:
        raise SystemExit(f"telemetry/client.config.json: endpoint inválido: {endpoint}")
    date = (cfg.get("policy_date") or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise SystemExit("telemetry/client.config.json: policy_date (AAAA-MM-DD) é obrigatória com a telemetria ligada")
    days = cfg.get("retention_days")
    if not isinstance(days, int) or not 30 <= days <= 400:
        raise SystemExit("telemetry/client.config.json: retention_days precisa ser um inteiro entre 30 e 400")
    y, mo, d = (int(x) for x in date.split("-"))
    return {"origin": m.group(1), "policy_date_pt": f"{d:02d}/{mo:02d}/{y}", "policy_date_en": f"{MONTHS_EN[mo - 1]} {d}, {y}",
            "retention_days": days}


def with_telemetry_texts(t):
    """Troca cada texto pela versão "<chave>_telemetry", quando existir (ex.: avisos de privacidade)."""
    if isinstance(t, dict):
        return {k: with_telemetry_texts(t.get(k + "_telemetry", v) if not k.endswith("_telemetry") else v) for k, v in t.items()}
    return t


def metrics_toggle(t, privacy_href):
    """Aviso discreto + botão para desligar as métricas (só com a telemetria ligada). O jogo cuida do estado."""
    p = t["play"]
    e = lambda s: html.escape(s, quote=True)
    return ('\n      ' + f'<p class="mm-metrics"><button id="mm-metrics" class="mm-metrics-btn" type="button" aria-pressed="true" '
            f'data-on="{e(p["metrics_on"])}" data-off="{e(p["metrics_off"])}" data-browser="{e(p["metrics_browser"])}" '
            f'title="{e(p["metrics_hint"])}">{e(p["metrics_on"])}</button> '
            f'<a href="{privacy_href}">{e(p["metrics_more"])}</a></p>')


def build():
    out = {}
    tele = telemetry_config()
    site = {"version": version(), "play_version": version("assets/play/game.js", "assets/play/play.css"), "email": EMAIL,
            "databairro_url": DATABAIRRO_URL,
            # CSP do jogo: sem telemetria, nenhuma conexão; com ela, só o endereço do serviço
            "connect_src": tele["origin"] if tele else "'none'",
            **({k: tele[k] for k in ("policy_date_pt", "policy_date_en", "retention_days")} if tele else {})}
    texts = {lang: load(lang) for lang in LANGS}
    if tele:
        texts = {lang: with_telemetry_texts(t) for lang, t in texts.items()}

    for lang, cfg in LANGS.items():
        t = texts[lang]
        root = "../" if cfg["dir"] else ""
        url = f"{SITE}/{cfg['dir']}"
        other = [l for l in LANGS if l != lang][0]
        og_image = f"{SITE}/assets/og-{cfg['slug']}.jpg"
        alternates = [("en", f"{SITE}/"), ("pt-BR", f"{SITE}/pt-br/"), ("x-default", f"{SITE}/")]
        alt_locales = [LANGS[other]["og_locale"]]

        def switch(page_en, page_pt):
            return lang_switch(lang, {"en": ("EN", (root + page_en) or "./"), "pt-BR": ("PT", root + page_pt)}, t["ui"]["lang_label"])

        img = {
            "bench": picture(root, "e1758-desk", cfg["slug"], t["img"]["bench"], "(min-width: 64rem) 28rem, 7.5rem", "eager"),
            "desk": picture(root, "e1758-desk", cfg["slug"], t["img"]["desk"], "(min-width: 85rem) 54rem, (min-width: 48rem) 64vw, 100vw"),
            "disguise": picture(root, "e1758-disguise", cfg["slug"], t["img"]["disguise"], "(min-width: 85rem) 27rem, (min-width: 48rem) 32vw, 50vw"),
            "caught": picture(root, "e1758-caught", cfg["slug"], t["img"]["caught"], "(min-width: 85rem) 27rem, (min-width: 48rem) 32vw, 50vw"),
            **{f"db_{n}": app_picture(root, n, t["img"][f"db_{n}"], "(min-width: 85rem) 27rem, (min-width: 60rem) 31vw, 100vw")
               for n in ("consulta", "resultado", "comparaveis")},
        }
        linkedin = (f'<a class="label" href="{LINKEDIN}" rel="me noopener">{t["about"]["linkedin"]}</a>' if LINKEDIN else "")

        page = {
            "lang": lang, "root": root, "home": "./", "anchors": "", "support": "support.html", "play": "play/",
            "title": t["meta"]["title"], "description": t["meta"]["description"],
            "seo": seo(t, url, alternates, og_image, cfg["og_locale"], alt_locales, t["meta"]["og_alt"]),
            "lang_switch": switch("", "pt-br/"),
            "jsonld": jsonld(t, lang, url),
            "privacy_lang": cfg["privacy"],
            "mail_subject": quote(t["contact"]["subject"]),
            "linkedin": linkedin,
        }
        tpl = (SRC / "templates" / "index.html").read_text(encoding="utf-8")
        out[f"{cfg['dir']}index.html"] = render(tpl, {"t": t, "page": page, "site": site, "img": img})

        # Suporte
        s_url = f"{SITE}/{cfg['dir']}support.html"
        s_alt = [("en", f"{SITE}/support.html"), ("pt-BR", f"{SITE}/pt-br/support.html"), ("x-default", f"{SITE}/support.html")]
        st = dict(t, meta=dict(t["meta"], title=t["meta"]["support_title"], description=t["meta"]["support_description"]))
        spage = dict(page, title=st["meta"]["title"], description=st["meta"]["description"], anchors="./",
                     seo=seo(st, s_url, s_alt, og_image, cfg["og_locale"], alt_locales, t["meta"]["og_alt"]),
                     lang_switch=switch("support.html", "pt-br/support.html"))
        tpl = (SRC / "templates" / "support.html").read_text(encoding="utf-8")
        out[f"{cfg['dir']}support.html"] = render(tpl, {"t": st, "page": spage, "site": site}).replace("{root}", root)

        # Jogo: Microgame Mayhem (/play/ e /pt-br/play/). O jogo em si é o bundle assets/play/game.js.
        p_url = f"{SITE}/{cfg['dir']}play/"
        p_alt = [("en", f"{SITE}/play/"), ("pt-BR", f"{SITE}/pt-br/play/"), ("x-default", f"{SITE}/play/")]
        pt_ = dict(t, meta=dict(t["meta"], title=t["play"]["meta_title"], description=t["play"]["meta_description"]))
        proot = root + "../"
        ppage = {
            "lang": lang, "root": proot, "home": "../",
            "title": pt_["meta"]["title"], "description": pt_["meta"]["description"],
            "seo": seo(pt_, p_url, p_alt, og_image, cfg["og_locale"], alt_locales, t["play"]["og_alt"]),
            "lang_switch": lang_switch(lang, {"en": ("EN", proot + "play/"), "pt-BR": ("PT", proot + "pt-br/play/")}, t["ui"]["lang_label"]),
            "metrics": metrics_toggle(t, f"{proot}privacy.html#microgame-mayhem-{'pt' if lang == 'pt-BR' else 'en'}") if tele else "",
        }
        tpl = (SRC / "templates" / "play.html").read_text(encoding="utf-8")
        out[f"{cfg['dir']}play/index.html"] = render(tpl, {"t": pt_, "page": ppage, "site": site})

    # 404 (o GitHub Pages serve em qualquer caminho: endereços absolutos)
    t = texts["en"]
    page404 = {
        "lang": "en", "root": "/", "home": "/", "anchors": "/", "support": "/support.html", "play": "/play/",
        "title": "Not found — MAEDODEAM", "description": t["meta"]["description"], "seo": "",
        "lang_switch": lang_switch("en", {"en": ("EN", "/"), "pt-BR": ("PT", "/pt-br/")}, t["ui"]["lang_label"]),
    }
    tpl = (SRC / "templates" / "404.html").read_text(encoding="utf-8")
    out["404.html"] = render(tpl, {"t": t, "page": page404, "site": site})

    # Política de privacidade: o texto é mantido à mão; só o cabeçalho e o rodapé vêm daqui
    pp = (ROOT / "privacy.html").read_text(encoding="utf-8")
    ppage = {
        "lang": "en", "root": "", "home": "./", "anchors": "./", "support": "support.html", "play": "play/",
        "title": "Privacy Policy · Política de privacidade — MAEDODEAM",
        "description": "Official privacy policy for MAEDODEAM products, including the game Escritório 17h58. Política de privacidade oficial dos produtos da MAEDODEAM.",
        "seo": f'<link rel="canonical" href="{SITE}/privacy.html">', "lang_switch": "",
    }
    ctx = {"t": t, "page": ppage, "site": site}
    blocks = [("head", "{{> head}}"), ("header", "{{> header}}"), ("footer", "{{> footer}}"),
              ("telemetry", "{{> privacy-microgame-mayhem}}" if tele else "")]
    for name, partial in blocks:
        block = re.compile(rf"(<!-- build:{name} -->\n)(?:.*?\n)?(<!-- /build:{name} -->)", re.S)
        if not block.search(pp):
            raise SystemExit(f"privacy.html: marcador build:{name} não encontrado")
        content = render(partial, ctx).rstrip("\n") if partial else ""
        pp = block.sub(lambda m: m.group(1) + (content + "\n" if content else "") + m.group(2), pp)
    out["privacy.html"] = pp

    # Sitemap e robots
    urls = []
    for path in ("", "play/", "support.html"):
        en, pt = f"{SITE}/{path}", f"{SITE}/pt-br/{path}"
        for loc in (en, pt):
            urls.append(
                f"  <url>\n    <loc>{loc}</loc>\n"
                f'    <xhtml:link rel="alternate" hreflang="en" href="{en}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="pt-BR" href="{pt}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{en}"/>\n  </url>')
    urls.append(f"  <url>\n    <loc>{SITE}/privacy.html</loc>\n  </url>")
    out["sitemap.xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                          'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(urls) + "\n</urlset>\n")
    out["robots.txt"] = f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n"
    return out


def main():
    if not EMAIL or "@" not in EMAIL:
        sys.exit("Defina a variável de ambiente SITE_CONTACT_EMAIL com o e-mail de contato do site.")
    if "--print" in sys.argv:
        # mostra uma página gerada sem gravar nada (usado pelos testes da telemetria)
        page = sys.argv[sys.argv.index("--print") + 1]
        sys.stdout.buffer.write(build()[page].encode("utf-8"))
        return
    check = "--check" in sys.argv
    stale = []
    for rel, content in build().items():
        path = ROOT / rel
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == content:
            continue
        stale.append(rel)
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if check and stale:
        print("desatualizado (rode python src/build.py):", ", ".join(stale))
        sys.exit(1)
    print("gerado:" if stale else "nada mudou", ", ".join(stale))


if __name__ == "__main__":
    main()
