// 207 · CLOSE ALL! — uma pilha de 3 a 5 pop-ups de propaganda. Feche sempre o de CIMA pelo X de verdade (o botão
// vermelho na barra de título). Os "x" pequenos desenhados dentro das imagens são pegadinhas, e os de baixo ainda não fecham.
// Tocar em "BAIXAR AGORA" ou no corpo de um anúncio = perde. Níveis altos: mais janelas e (lv ≥ 1) o X pode estar à esquerda.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { fitText, isPortrait } from "./util.ts";

const TITLE = 84;

const ADS: { head: Text; sub: Text; color: string }[] = [
  { head: { en: "YOU WON!!!", pt: "VOCÊ GANHOU!!!" }, sub: { en: "claim your prize", pt: "resgate o prêmio" }, color: C.yellow },
  { head: { en: "HOT DEALS", pt: "OFERTAS QUENTES" }, sub: { en: "99% off everything", pt: "99% de desconto" }, color: C.pink },
  { head: { en: "FREE RAM", pt: "RAM GRÁTIS" }, sub: { en: "download more memory", pt: "baixe mais memória" }, color: C.sky },
  { head: { en: "SINGLE CATS", pt: "GATOS SOLTEIROS" }, sub: { en: "near your office", pt: "perto do escritório" }, color: C.green2 },
  { head: { en: "SPEED UP PC", pt: "ACELERE O PC" }, sub: { en: "1 weird trick", pt: "um truque estranho" }, color: C.orange2 },
  { head: { en: "BIG PRIZE", pt: "PRÊMIO GRANDE" }, sub: { en: "spin the wheel!", pt: "gire a roleta!" }, color: C.purple2 },
];

interface Popup {
  x: number;
  y: number;
  w: number;
  h: number;
  /** X à direita (1) ou à esquerda (-1) da barra de título. */
  side: number;
  ad: number;
  shake: number;
}
interface S {
  pops: Popup[];
  closed: number;
  total: number;
  xr: number;
  bad: { x: number; y: number } | null;
  t: number;
  endT: number;
}

function closeAt(p: Popup): { x: number; y: number } {
  return { x: p.side > 0 ? p.x + p.w - TITLE / 2 : p.x + TITLE / 2, y: p.y + TITLE / 2 };
}
function downloadRect(p: Popup): { x: number; y: number; w: number; h: number } {
  const bh = Math.min(100, p.h * 0.2);
  return { x: p.x + p.w * 0.12, y: p.y + p.h - bh - 26, w: p.w * 0.76, h: bh };
}
function imageRect(p: Popup): { x: number; y: number; w: number; h: number } {
  const d = downloadRect(p);
  return { x: p.x + 26, y: p.y + TITLE + 20, w: p.w * 0.36, h: d.y - (p.y + TITLE) - 40 };
}
function inside(px: number, py: number, p: Popup): boolean {
  return px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const pw = portrait ? w * 0.84 : Math.min(720, w * 0.6);
  const ph = portrait ? Math.min(560, h * 0.3) : Math.min(500, h * 0.5);
  const ads = rng.shuffle(ADS.map((_, i) => i));
  const pops: Popup[] = [];
  for (let i = 0; i < n; i++) {
    pops.push({
      x: rng.range(30, w - pw - 30),
      y: rng.range(40, h - ph - 40),
      w: pw * rng.range(0.92, 1),
      h: ph * rng.range(0.92, 1),
      side: lv >= 1 && rng.chance(0.4) ? -1 : 1,
      ad: ads[i % ads.length],
      shake: 0,
    });
  }
  const s: S = { pops, closed: 0, total: n, xr: 58 - 6 * Math.min(1, lv), bad: null, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const p of s.pops) p.shake = Math.max(0, p.shake - dt * 3);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const x = inp.x;
      const y = inp.y;
      const top = s.pops[s.pops.length - 1];
      if (!top) return;
      const c = closeAt(top);
      if (Math.hypot(x - c.x, y - c.y) < 72) {
        s.pops.pop();
        s.closed++;
        api.sfx("pop");
        api.fx.burst(c.x, c.y, C.white, 10);
        if (s.pops.length === 0) {
          api.sfx("chime");
          api.win();
        }
        return;
      }
      for (let i = s.pops.length - 1; i >= 0; i--) {
        const p = s.pops[i];
        const pc = closeAt(p);
        if (i < s.pops.length - 1 && Math.hypot(x - pc.x, y - pc.y) < 50) {
          // X de uma janela de baixo: ainda trancado
          p.shake = 1;
          api.sfx("beep");
          return;
        }
        if (inside(x, y, p)) {
          s.bad = { x, y };
          p.shake = 1;
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // área de trabalho com ícones
      for (let i = 0; i < 6; i++) {
        const ix = 60 + (i % 2) * 130;
        const iy = 70 + Math.floor(i / 2) * 150;
        g.rect(ix, iy, 80, 70, [C.yellow, C.white, C.blue2][i % 3], { r: 10, lw: 5 });
      }
      g.rect(-10, h - 70, w + 20, 80, C.ink2, { stroke: null });
      g.rect(20, h - 58, 120, 50, C.green, { r: 10, lw: 4 });
      for (let i = 0; i < s.pops.length; i++) {
        const p = s.pops[i];
        const isTop = i === s.pops.length - 1;
        const ad = ADS[p.ad];
        const sx = Math.sin(s.t * 70) * 10 * p.shake;
        g.push();
        g.translate(sx, 0);
        g.rect(p.x + 12, p.y + 16, p.w, p.h, C.ink, { r: 16, stroke: null });
        g.rect(p.x, p.y, p.w, p.h, ad.color, { r: 16 });
        // barra de título
        g.rect(p.x, p.y, p.w, TITLE, isTop ? C.ink2 : C.gray2, { r: 16 });
        g.rect(p.x + 4, p.y + TITLE - 20, p.w - 8, 16, isTop ? C.ink2 : C.gray2, { stroke: null });
        const tx = p.side > 0 ? p.x + 30 : p.x + TITLE + 20;
        g.text("ad.exe", tx, p.y + TITLE / 2, { size: 34, font: "mono", align: "left", color: C.paper2 });
        // o X de verdade
        const c = closeAt(p);
        const r = s.xr / 2;
        g.rect(c.x - r, c.y - r, r * 2, r * 2, isTop ? C.red : C.gray, { r: 10, lw: 5 });
        g.line(c.x - r * 0.45, c.y - r * 0.45, c.x + r * 0.45, c.y + r * 0.45, C.white, 8);
        g.line(c.x + r * 0.45, c.y - r * 0.45, c.x - r * 0.45, c.y + r * 0.45, C.white, 8);
        // anúncio
        const im = imageRect(p);
        g.rect(im.x, im.y, im.w, im.h, C.white, { r: 12, lw: 5 });
        g.star(im.x + im.w / 2, im.y + im.h / 2, Math.min(im.w, im.h) * 0.38, Math.min(im.w, im.h) * 0.18, 8, ad.color, { lw: 5 });
        g.text("$$$", im.x + im.w / 2, im.y + im.h / 2, { size: Math.min(im.w, im.h) * 0.2, color: C.ink });
        // pegadinhas: "x" pequenos dentro da imagem
        for (const [fx, fy] of [
          [im.x + im.w - 26, im.y + 26],
          [im.x + 26, im.y + im.h - 26],
        ]) {
          g.circle(fx, fy, 16, C.paper2, { lw: 3 });
          g.text("x", fx, fy - 2, { size: 26, font: "mono", color: C.gray2 });
        }
        const txX = im.x + im.w + 20;
        const txW = p.x + p.w - 24 - txX;
        fitText(g, api.t(ad.head), txX + txW / 2, im.y + im.h * 0.3, txW, { size: 64, color: C.red, stroke: C.white, lw: 8 });
        fitText(g, api.t(ad.sub), txX + txW / 2, im.y + im.h * 0.72, txW, { size: 36, font: "body", color: C.ink });
        const d = downloadRect(p);
        g.rect(d.x, d.y, d.w, d.h, C.green, { r: d.h / 2 });
        fitText(g, api.t({ en: "DOWNLOAD NOW", pt: "BAIXAR AGORA" }), d.x + d.w / 2, d.y + d.h / 2, d.w - 40, { size: d.h * 0.5, color: C.white, stroke: C.ink, lw: 7 });
        if (!isTop) {
          g.push();
          g.alpha(0.18);
          g.rect(p.x, p.y, p.w, p.h, C.ink, { r: 16, stroke: null });
          g.pop();
        }
        g.pop();
      }
      // contador
      fitText(g, `${s.closed}/${s.total}`, w - 90, h - 34, 140, { size: 44, font: "mono", weight: 800, color: C.white });
      if (api.result === "win") g.text(api.t({ en: "CLEAN!", pt: "LIMPINHO!" }), w / 2, h / 2, { size: 140, color: C.yellow, stroke: C.ink, lw: 16 });
      if (api.result === "lose" && s.bad) {
        g.star(s.bad.x, s.bad.y, 70, 34, 10, C.yellow);
        g.text(api.t({ en: "VIRUS!", pt: "VÍRUS!" }), w / 2, h / 2, { size: 140, color: C.red, stroke: C.ink, lw: 16 });
      }
    },
  };
}

export const closePopups: Entry<S> = {
  def: {
    id: "close-popups",
    num: 207,
    name: { en: "Close the Popups", pt: "Fecha os Pop-ups" },
    verb: { en: "CLOSE ALL!", pt: "FECHA TUDO!" },
    hint: { pointer: "tap" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A stack of 3 to 5 popup ads. Close the top one first with its real X in the title bar; little fake x's inside the ad pictures are decoys and lower windows stay locked. Later the X may sit on the left.",
    winText: "Close every popup with its real X.",
    loseText: "Tap DOWNLOAD NOW or an ad's body, or time runs out.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0 || io.isDown) return;
          const top = s.pops[s.pops.length - 1];
          if (!top) return;
          const c = closeAt(top);
          io.tap(c.x, c.y);
          m.wait = 3;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3) return;
          if (io.isDown) return;
          const top = s.pops[s.pops.length - 1];
          if (!top) return;
          const d = downloadRect(top);
          io.tap(d.x + d.w / 2, d.y + d.h / 2);
        },
      }
    : null,
};
