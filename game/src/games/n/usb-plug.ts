// 208 · PLUG IT IN! — o pendrive clássico: a porta mostra (em corte) de que lado fica a lingueta laranja; o plugue mostra
// de que lado fica o bloco dele. Laranja tem que encontrar o buraco preto. Toque no plugue para virar; arraste até a porta.
// Do lado errado ele quica de volta; no 3º quique, perde. Nível baixo: uma seta aponta o buraco. Níveis altos: menos folga e (lv ≥ 0.5) o notebook balança.
import type { BotIO, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { ease, isPortrait } from "./util.ts";

const SLEEVE = 84;
/** Escala do desenho do plugue e da porta (peças grandes, fáceis de ver e pegar). */
const K = 1.7;
/** Largura do notebook (lateral) no palco. */
const LAPTOP = 190 * K;

interface S {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  up: boolean;
  portUp: boolean;
  px: number;
  py: number;
  baseY: number;
  sway: number;
  swayPh: number;
  tolY: number;
  held: boolean;
  offX: number;
  offY: number;
  moved: boolean;
  /** 1 → 0 enquanto volta para casa depois de um quique. */
  back: number;
  backFromX: number;
  backFromY: number;
  flip: number;
  bounces: number;
  inserted: number;
  helper: boolean;
  t: number;
  endT: number;
}

function tip(s: S): { x: number; y: number } {
  return { x: s.x + 150 * K, y: s.y };
}
function fits(s: S): boolean {
  return s.up !== s.portUp;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // o notebook inteiro (LAPTOP de largura) fica dentro do palco, com margem à direita
  const px = Math.min(portrait ? w * 0.6 : w * 0.66, w - 40 - LAPTOP);
  const baseY = portrait ? h * 0.45 : h * 0.48;
  const homeX = portrait ? 300 : w > 1300 ? w * 0.22 : 300;
  const homeY = portrait ? h * 0.72 : h * 0.72;
  const s: S = {
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    up: rng.chance(0.5),
    portUp: rng.chance(0.5),
    px,
    py: baseY,
    baseY,
    sway: lv >= 0.5 ? 50 + 70 * Math.min(1, lv - 0.5) : 0,
    swayPh: rng.range(0, 6),
    tolY: (70 - 25 * Math.min(1, lv)) * 1.3,
    held: false,
    offX: 0,
    offY: 0,
    moved: false,
    back: 0,
    backFromX: 0,
    backFromY: 0,
    flip: 0,
    bounces: 0,
    inserted: 0,
    helper: lv < 0.5,
    t: 0,
    endT: 0,
  };

  const bounce = () => {
    s.held = false;
    s.bounces++;
    s.back = 1;
    s.backFromX = s.x - 60 * K;
    s.backFromY = s.y;
    api.sfx("thud");
    api.fx.shake(0.4);
    api.fx.pop(s.px - 60, s.py - 150, `${s.bounces}/3`, C.red);
    if (s.bounces >= 3) {
      api.sfx("buzz");
      api.lose();
    }
  };
  const tryInsert = (): boolean => {
    const tp = tip(s);
    if (Math.abs(tp.x - s.px) > 120 || Math.abs(tp.y - s.py) > s.tolY) return false;
    if (fits(s)) {
      s.held = false;
      s.inserted = 0.001;
      api.sfx("click");
      api.sfx("chime");
      api.fx.burst(s.px, s.py, C.green, 22);
      api.win();
    } else bounce();
    return true;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.flip = Math.max(0, s.flip - dt * 6);
      s.py = s.baseY + Math.sin(s.t * 1.6 + s.swayPh) * s.sway;
      if (s.inserted > 0) {
        s.inserted += dt;
        s.x = s.px - 150 * K + 100 * K * ease(s.inserted * 5);
        s.y = s.py;
      }
      if (s.back > 0) {
        s.back = Math.max(0, s.back - dt * 3);
        const k = ease(1 - s.back);
        s.x = s.backFromX + (s.homeX - s.backFromX) * k;
        s.y = s.backFromY + (s.homeY - s.backFromY) * k - Math.sin(k * Math.PI) * 120;
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed && s.back === 0 && inp.x > s.x - 190 * K && inp.x < s.x + 190 * K && inp.y > s.y - 110 * K && inp.y < s.y + 110 * K) {
        s.held = true;
        s.moved = false;
        s.offX = s.x - inp.x;
        s.offY = s.y - inp.y;
      }
      if (!s.held) return;
      if (Math.hypot(inp.x - inp.startX, inp.y - inp.startY) > 25) s.moved = true;
      if (s.moved) {
        s.x = inp.x + s.offX;
        s.y = inp.y + s.offY;
        // a ponta encostou na boca da porta: tenta entrar
        const tp = tip(s);
        if (tp.x > s.px - 10 && tp.x < s.px + 60 * K && Math.abs(tp.y - s.py) <= s.tolY) {
          tryInsert();
          return;
        }
        if (tp.x > s.px + 60 * K) s.x = s.px + 60 * K - 150 * K;
      }
      if (!inp.down) {
        s.held = false;
        if (!s.moved) {
          s.up = !s.up;
          s.flip = 1;
          api.sfx("swoosh");
        } else if (!tryInsert()) {
          s.back = 1;
          s.backFromX = s.x;
          s.backFromY = s.y;
          api.sfx("slide");
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // mesa
      g.rect(-10, h * 0.86, w + 20, h * 0.2, C.brown2, { lw: 7 });
      // plugue: capa + cabo + manga metálica em corte (o bloco laranja de um lado)
      g.push();
      g.translate(s.x, s.y);
      g.scale(K);
      g.polyline(
        [
          { x: -150, y: 0 },
          { x: -230, y: 20 },
          { x: -290, y: 80 },
          { x: -s.x / K - 20, y: 150 },
        ],
        C.ink2,
        14,
      );
      g.rect(-150, -60, 190, 120, C.blue, { r: 24, lw: 5 });
      g.text("USB", -55, 0, { size: 44, color: C.white, stroke: C.ink, lw: 7 });
      const sy = 1 - 2 * s.flip;
      g.push();
      g.translate(95, 0);
      g.scale(1, Math.abs(sy) < 0.1 ? 0.1 : Math.abs(sy));
      g.rect(-55, -SLEEVE / 2, 110, SLEEVE, C.paper2, { lw: 5 });
      const blockTop = s.up ? -SLEEVE / 2 + 7 : 3;
      g.rect(-48, s.up ? 3 : -SLEEVE / 2 + 7, 96, SLEEVE / 2 - 10, C.ink, { r: 4, stroke: null });
      g.rect(-48, blockTop, 96, SLEEVE / 2 - 10, C.orange, { r: 4, lw: 4 });
      g.pop();
      g.pop();
      // notebook (lateral) com a porta em corte
      const px = s.px;
      const py = s.py;
      g.rect(px + 10, py - 150 * K + 14, LAPTOP, 300 * K, C.ink, { r: 30, stroke: null });
      g.rect(px, py - 150 * K, LAPTOP, 300 * K, C.gray, { r: 30 });
      g.rect(px + 30, py - 130 * K, LAPTOP - 60, 24, C.gray2, { r: 12, stroke: null });
      for (let i = 0; i < 3; i++) g.rect(px + LAPTOP - 70, py + 40 * K + i * 34, 40, 16, C.gray2, { r: 6, stroke: null });
      g.push();
      g.translate(px, py);
      g.scale(K);
      g.rect(-6, -SLEEVE / 2 - 14, 150, SLEEVE + 28, C.ink2, { r: 8, lw: 5 });
      const tabTop = s.portUp ? -SLEEVE / 2 : 0;
      g.rect(0, -SLEEVE / 2, 140, SLEEVE, C.ink, { stroke: null });
      g.rect(4, tabTop + 4, 132, SLEEVE / 2 - 8, C.orange, { r: 4, lw: 4 });
      // luzinha
      g.circle(80, 100, 14, api.result === "win" ? C.green : C.red, { lw: 4 });
      // ajuda (nível baixo): seta apontando o buraco preto
      if (s.helper && !api.result && s.bounces === 0) {
        const holeY = s.portUp ? SLEEVE / 4 : -SLEEVE / 4;
        g.shape(-24, holeY, [0, 0, -36, -20, -36, 20], C.white, { lw: 4 });
      }
      g.pop();
      // quiques
      for (let i = 0; i < 3; i++) g.circle(w / 2 - 70 + i * 70, 70, 22, i < s.bounces ? C.red : C.white, { lw: 5 });
      if (api.result === "win") g.text(api.t({ en: "CONNECTED!", pt: "CONECTOU!" }), w / 2, h * 0.18, { size: 100, color: C.green, stroke: C.ink, lw: 14 });
      if (api.result === "lose") g.text(api.t({ en: "WRONG SIDE!", pt: "LADO ERRADO!" }), w / 2, h * 0.18, { size: 100, color: C.red, stroke: C.ink, lw: 14 });
    },
  };
}

export const usbPlug: Entry<S> = {
  def: {
    id: "usb-plug",
    num: 208,
    name: { en: "USB Plug", pt: "Pendrive" },
    verb: { en: "PLUG IT IN!", pt: "ENCAIXA!" },
    hint: { pointer: "drag" },
    category: "tech",
    family: "drag",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A cut-away port shows which half holds its orange tab, and the plug shows which half holds its block. Tap the plug to flip it, then drag it into the port. The wrong side bounces back; the third bounce loses. Later the laptop sways.",
    winText: "Plug it in the right way up.",
    loseText: "Bounce off the port three times, or time runs out.",
    timeScale: 1.1,
    minTime: 3.2,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          botPlug(s, api, io, dt, true);
        },
        lose(s, api, io, dt) {
          botPlug(s, api, io, dt, false);
        },
      }
    : null,
};

/** Bot: vira se precisar (vencedor) ou se estiver certo (perdedor) e empurra a ponta até a boca da porta. */
function botPlug(s: S, api: MicroAPI, io: BotIO, dt: number, good: boolean): void {
  if (api.result || api.time < 0.2) return;
  const m = mem(s, () => ({ dragging: false, wait: 0, frames: 0 }));
  if (m.wait-- > 0) return;
  if (!m.dragging) {
    if (s.back > 0 || io.isDown) return;
    if (fits(s) !== good) {
      io.tap(s.x - 60, s.y);
      m.wait = 3;
      return;
    }
    io.move(s.x - 60, s.y);
    io.down(s.x - 60, s.y);
    m.dragging = true;
    m.frames = 0;
    return;
  }
  if (!s.held && m.frames++ > 0) {
    // entrou ou quicou: solta e recomeça
    io.up(io.px, io.py);
    m.dragging = false;
    m.wait = 2;
    return;
  }
  const tp = tip(s);
  moveToward(io, { x: io.px + (s.px + 20 - tp.x), y: io.py + (s.py - tp.y) }, 2600, dt);
}
