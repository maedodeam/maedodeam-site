// 085 · I'M HUMAN! — captcha: marque todas as imagens do tipo pedido e aperte VERIFICAR.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bug, cat, cup, envelope, phone, plant, stapler } from "../../gfx/art.ts";
import { type Rect, inRect } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";
import { card, duck, fitText, isPortrait } from "./util.ts";

type Kind = "duck" | "cup" | "cat" | "bug" | "plant" | "phone" | "mail" | "stapler";
interface Tile extends Rect {
  kind: Kind;
  sel: boolean;
  bg: string;
  rot: number;
  tint: string;
  flash: number;
}
interface S {
  target: "duck" | "cup" | "cat";
  tiles: Tile[];
  btn: Rect;
  verified: boolean;
  t: number;
  endT: number;
}

const TARGETS = {
  duck: { en: "RUBBER DUCKS", pt: "PATOS DE BORRACHA" },
  cup: { en: "COFFEE CUPS", pt: "XÍCARAS" },
  cat: { en: "CATS", pt: "GATOS" },
} as const;
const TILE_BG = ["#cfe8ff", "#ffe3c7", "#d8f5e1", "#f3dcff", "#fff4c2", "#e8e3d8"];

function drawKind(g: Gfx, t: Tile, time: number): void {
  const cx = t.x + t.w / 2;
  const cy = t.y + t.h / 2;
  const k = t.w / 220;
  g.push();
  g.translate(cx, cy);
  g.rotate(t.rot);
  switch (t.kind) {
    case "duck":
      duck(g, 0, 6 * k, 1.35 * k, t.tint);
      break;
    case "cup":
      cup(g, -8 * k, 14 * k, 1.5 * k, t.tint, true, time);
      break;
    case "cat":
      cat(g, -10 * k, 82 * k, 0.95 * k, { color: t.tint, mood: "smug" });
      break;
    case "bug":
      bug(g, -8 * k, 0, 1.6 * k, time, -0.3, t.tint);
      break;
    case "plant":
      plant(g, 0, 80 * k, 0.85 * k);
      break;
    case "phone":
      phone(g, 0, 0, 0.85 * k, C.sky, 0.2);
      break;
    case "mail":
      envelope(g, 0, 0, 150 * k, 100 * k, t.tint, -0.15);
      break;
    case "stapler":
      stapler(g, 0, 10 * k, 1.5 * k, -0.2);
      break;
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cols = lv >= 1 ? 4 : 3;
  const rows = 3;
  const total = cols * rows;
  const target = rng.pick(["duck", "cup", "cat"] as const);
  const nT = lv < 0.3 ? rng.int(2, 3) : lv < 1 ? rng.int(2, 4) : rng.int(3, 4);
  const others: Kind[] = (["duck", "cup", "cat", "bug", "plant", "phone", "mail", "stapler"] as Kind[]).filter((k) => k !== target);
  const kinds: Kind[] = [];
  for (let i = 0; i < nT; i++) kinds.push(target);
  while (kinds.length < total) kinds.push(rng.pick(others));
  const order = rng.shuffle(kinds);

  // layout
  const headH = portrait ? 220 : 170;
  let cs: number;
  let gx: number;
  let gy: number;
  let btn: Rect;
  if (portrait || w < 1300) {
    cs = Math.min(270, (w - 120) / cols, (h - headH - 330) / rows);
    gx = (w - cs * cols) / 2;
    gy = portrait ? (h - (headH + cs * rows + 230)) / 2 + headH + 20 : 70 + headH;
    btn = portrait ? { x: w / 2 - 240, y: gy + cs * rows + 70, w: 480, h: 160 } : { x: w / 2 - 220, y: gy + cs * rows + 36, w: 440, h: 130 };
  } else {
    cs = Math.min(230, (h - 110 - headH - 60) / rows);
    const gw = cs * cols;
    const totalW = gw + 60 + 380;
    gx = (w - totalW) / 2;
    gy = 90 + headH;
    btn = { x: gx + gw + 60, y: gy + cs * rows - 200, w: 380, h: 200 };
  }
  const tiles: Tile[] = order.map((kind, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const tint =
      kind === "duck"
        ? rng.pick([C.yellow, C.yellow, C.pink2, C.sky])
        : kind === "cat"
          ? rng.pick([C.orange2, C.gray, C.paper2, C.brown2])
          : kind === "cup"
            ? rng.pick([C.paper, C.red, C.blue2, C.white])
            : kind === "bug"
              ? rng.pick([C.green, C.purple2])
              : C.white;
    return {
      x: gx + c * cs,
      y: gy + r * cs,
      w: cs,
      h: cs,
      kind,
      sel: false,
      bg: rng.pick(TILE_BG),
      rot: lv > 0.6 ? rng.range(-0.35, 0.35) : 0,
      tint,
      flash: 0,
    };
  });

  const s: S = { target, tiles, btn, verified: false, t: 0, endT: 0 };

  const verify = () => {
    s.verified = true;
    const ok = s.tiles.every((t) => t.sel === (t.kind === s.target));
    if (ok) {
      api.sfx("chime");
      api.fx.burst(s.btn.x + s.btn.w / 2, s.btn.y + s.btn.h / 2, C.green, 22);
      api.win();
    } else {
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };
  const toggle = (t: Tile) => {
    t.sel = !t.sel;
    t.flash = 0.15;
    api.sfx(t.sel ? "click" : "tap");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const t of s.tiles) t.flash = Math.max(0, t.flash - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        if (inRect(inp.x, inp.y, s.btn, 10)) return verify();
        for (const t of s.tiles) if (inRect(inp.x, inp.y, t)) return toggle(t);
      }
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.tiles.length) toggle(s.tiles[inp.digit - 1]);
      if (inp.keyPressed("action")) verify();
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      for (let i = 0; i < 6; i++) g.circle((i * 433 + 120) % w, (i * 251 + 80) % h, 70, "#9adcff", { stroke: null });
      const t0 = s.tiles[0];
      const gw = t0.w * (s.tiles.length / 3);
      const gx = t0.x;
      const gy = t0.y;
      const head = portrait ? 220 : 170;
      // moldura do captcha
      card(g, gx - 16, gy - head - 16, gw + 32, head + t0.h * 3 + 32, C.white, 14, 7);
      g.rect(gx, gy - head, gw, head - 12, "#3d7bff", { r: 6, lw: 0, stroke: null });
      fitText(g, api.t({ en: "Select all images with", pt: "Selecione todas as imagens com" }), gx + 30, gy - head + (portrait ? 54 : 42), gw - 60, {
        size: portrait ? 46 : 40,
        font: "body",
        color: C.white,
        align: "left",
      });
      fitText(g, api.t(TARGETS[s.target]), gx + 30, gy - head + (portrait ? 140 : 108), gw - 60, {
        size: portrait ? 96 : 80,
        color: C.white,
        align: "left",
      });
      for (const t of s.tiles) {
        const inset = t.sel ? t.w * 0.1 : 4;
        g.rect(t.x + 2, t.y + 2, t.w - 4, t.h - 4, C.paper2, { stroke: null });
        g.push();
        g.clip(t.x + inset, t.y + inset, t.w - inset * 2, t.h - inset * 2, 4);
        g.rect(t.x, t.y, t.w, t.h, t.bg, { stroke: null });
        g.push();
        g.translate(t.x + t.w / 2, t.y + t.h / 2);
        const sc = (t.w - inset * 2) / t.w;
        g.scale(sc);
        g.translate(-(t.x + t.w / 2), -(t.y + t.h / 2));
        drawKind(g, t, g.time);
        g.pop();
        g.pop();
        if (t.sel) {
          g.circle(t.x + 34, t.y + 34, 26, "#3d7bff", { lw: 5 });
          g.polyline(
            [
              { x: t.x + 22, y: t.y + 35 },
              { x: t.x + 31, y: t.y + 44 },
              { x: t.x + 47, y: t.y + 25 },
            ],
            C.white,
            7,
          );
        }
        if (api.result === "lose" && (t.kind === s.target) !== t.sel) {
          g.rect(t.x + 6, t.y + 6, t.w - 12, t.h - 12, null, { stroke: C.red, lw: 10 });
        }
        if (t.flash > 0) {
          g.push();
          g.alpha(t.flash / 0.15);
          g.rect(t.x, t.y, t.w, t.h, C.white, { stroke: null });
          g.pop();
        }
      }
      // botão
      const b = s.btn;
      const ok = api.result === "win";
      const bad = api.result === "lose";
      card(g, b.x, b.y, b.w, b.h, ok ? C.green : bad ? C.red : "#3d7bff", 20, 7);
      fitText(g, ok ? api.t({ en: "HUMAN ✓", pt: "HUMANO ✓" }) : bad ? api.t({ en: "ROBOT?!", pt: "ROBÔ?!" }) : api.t({ en: "VERIFY", pt: "VERIFICAR" }), b.x + b.w / 2, b.y + b.h / 2, b.w - 40, {
        size: 76,
        color: C.white,
        stroke: C.ink,
        lw: 12,
      });
      if (!portrait && w >= 1300) {
        // robozinho desconfiado
        const rx = b.x + b.w / 2;
        const ry = b.y - 210;
        const bob = Math.sin(g.time * 4) * 6;
        g.rect(rx - 80, ry - 70 + bob, 160, 130, C.gray, { r: 26 });
        g.line(rx, ry - 70 + bob, rx, ry - 110 + bob, C.ink, 6);
        g.circle(rx, ry - 116 + bob, 14, C.red);
        g.face(rx, ry - 10 + bob, 110, ok ? "sad" : bad ? "smug" : "neutral", { x: -1, y: 0.5 });
      }
    },
  };
}

export const captcha: Entry<S> = {
  def: {
    id: "captcha",
    num: 85,
    name: { en: "I'm Not a Robot", pt: "Não Sou Robô" },
    verb: { en: "I'M HUMAN!", pt: "SOU HUMANO!" },
    hint: { pointer: "tap" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A 3x3 captcha grid (4x3 later) asks for all the rubber ducks, coffee cups or cats. Tap tiles to select or unselect them, then press VERIFY (or Enter).",
    winText: "Verify with exactly the right tiles selected.",
    loseText: "Verify with a wrong selection, or time runs out.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ wait: 0.3 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          m.wait = 0.12;
          const todo = s.tiles.find((t) => t.sel !== (t.kind === s.target));
          if (todo) io.tap(todo.x + todo.w / 2, todo.y + todo.h / 2);
          else io.tap(s.btn.x + s.btn.w / 2, s.btn.y + s.btn.h / 2);
        },
        lose(s, api, io) {
          if (api.result || io.isDown || api.time < 0.3) return;
          io.tap(s.btn.x + s.btn.w / 2, s.btn.y + s.btn.h / 2);
        },
      }
    : null,
};
