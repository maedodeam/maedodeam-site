// 294 · HOLD THE DOOR! — gente corre para o elevador, um de cada vez. Segure o botão de abrir a porta (ou Espaço)
// para os colegas legais entrarem; solte (a porta fecha) antes de o falastrão do megafone chegar.
// Colega que dá de cara na porta fechada = perde; falastrão dentro do elevador = perde.
// Nos níveis altos vêm 3 colegas, e a partir de 1 o falastrão chega no meio da fila (fecha e reabre a tempo).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person } from "../../gfx/art.ts";
import { isPortrait } from "./util.ts";

interface Runner {
  talker: boolean;
  /** Momento (s) em que chega à porta. */
  arrive: number;
  shirt: string;
  state: "run" | "in" | "bonk";
  stateT: number;
}
interface S {
  people: Runner[];
  /** Abertura da porta 0..1. */
  open: number;
  holding: boolean;
  doorX: number;
  doorW: number;
  floorY: number;
  speed: number;
  t: number;
  endT: number;
}

const OPEN_RATE = 5;
const CLOSE_RATE = 3.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const friends = lv < 0.5 ? 2 : 3;
  const n = friends + 1;
  const talkerAt = lv < 1 ? n - 1 : n - 2;
  const t0 = lv < 0.5 ? 1.3 : 1.05;
  const gap = Math.min(1.25, (api.duration - 0.45 - t0) / (n - 1));
  const shirts = rng.shuffle([C.blue, C.green, C.purple, C.teal]);
  const people: Runner[] = [];
  for (let i = 0; i < n; i++) {
    people.push({ talker: i === talkerAt, arrive: t0 + i * gap, shirt: i === talkerAt ? C.yellow : shirts[i], state: "run", stateT: 0 });
  }
  const s: S = {
    people,
    open: 1,
    holding: false,
    doorX: portrait ? w * 0.6 : w * 0.74,
    doorW: portrait ? 330 : 400,
    floorY: portrait ? h * 0.64 : h * 0.86,
    speed: portrait ? 700 : 950,
    t: 0,
    endT: 0,
  };

  const xOf = (p: Runner): number => {
    const edge = s.doorX - s.doorW / 2;
    if (p.state === "in") return Math.min(s.doorX - 40 + (p.talker ? 60 : 0), edge + p.stateT * 600);
    if (p.state === "bonk") return edge - 40 - Math.min(1, p.stateT * 3) * 120;
    return edge - s.speed * (p.arrive - s.t);
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const p of s.people) if (p.state !== "run") p.stateT += dt;
      if (api.result) {
        s.endT += dt;
        s.open = Math.max(0, s.open - CLOSE_RATE * dt);
        return;
      }
      const was = s.holding;
      s.holding = api.input.action;
      if (s.holding && !was) api.sfx("click");
      s.open = s.holding ? Math.min(1, s.open + OPEN_RATE * dt) : Math.max(0, s.open - CLOSE_RATE * dt);
      for (const p of s.people) {
        if (p.state !== "run" || s.t < p.arrive) continue;
        const open = s.open >= 0.5;
        p.state = open ? "in" : "bonk";
        p.stateT = 0;
        const x = s.doorX - s.doorW / 2;
        if (p.talker && open) {
          api.sfx("kazoo");
          api.fx.shake(0.6);
          api.fx.pop(s.doorX, s.floorY - 420, api.t({ en: "BLAH BLAH BLAH!", pt: "BLÁ BLÁ BLÁ!" }), C.red);
          api.lose();
          return;
        }
        if (!p.talker && !open) {
          api.sfx("thud");
          api.fx.shake(0.6);
          api.fx.pop(x, s.floorY - 400, api.t({ en: "BONK!", pt: "PLAFT!" }), C.red);
          api.lose();
          return;
        }
        if (p.talker) {
          api.sfx("thud");
          api.fx.pop(x, s.floorY - 400, api.t({ en: "BONK!", pt: "PLAFT!" }), C.yellow);
        } else {
          api.sfx("pop");
          api.fx.burst(s.doorX, s.floorY - 200, C.green, 10);
        }
      }
      if (s.people.every((p) => p.state !== "run")) {
        api.sfx("chime");
        api.fx.pop(s.doorX, s.floorY - 450, api.t({ en: "GOING UP!", pt: "SUBINDO!" }), C.green);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      const fy = s.floorY;
      const k = portrait ? 1.6 : 1.55;
      // parede e piso
      g.rect(-10, fy, w + 20, h - fy + 10, C.paper2, { lw: 7 });
      for (let x = 0; x < w; x += 160) g.line(x, fy, x - 60, h, C.muted, 4);
      g.rect(-10, fy - 30, w + 20, 30, C.gray, { lw: 5 });
      // elevador
      const dx = s.doorX;
      const dw = s.doorW;
      const dh = 470 * k * 0.85;
      const top = fy - dh;
      g.rect(dx - dw / 2 - 40, top - 120, dw + 80, dh + 120, C.gray2, { lw: 8 });
      g.rect(dx - 90, top - 100, 180, 64, C.ink, { r: 10, lw: 5 });
      g.text("▲ 7", dx, top - 68, { size: 46, color: C.orange, font: "mono" });
      // cabine (por trás das portas)
      g.rect(dx - dw / 2, top, dw, dh, C.yellow2, { lw: 6 });
      g.rect(dx - dw / 2, top + dh * 0.45, dw, 8, C.brown2, { stroke: null });
      for (const p of s.people) {
        if (p.state !== "in") continue;
        const x = xOf(p);
        person(g, x, fy - 6, k * 0.9, { shirt: p.shirt, mood: p.talker ? "smug" : "happy", tie: null, look: { x: 0.3, y: 0 } });
        if (p.talker) drawMegaphone(g, x, fy - 6, k * 0.9, s.t);
      }
      // portas
      const leaf = (dw / 2) * (1 - s.open);
      g.rect(dx - dw / 2, top, leaf, dh, C.muted, { lw: 6 });
      g.rect(dx + dw / 2 - leaf, top, leaf, dh, C.muted, { lw: 6 });
      g.rect(dx - dw / 2, top, dw, dh, null, { lw: 8 });
      // botão de abrir
      const bx = dx + dw / 2 + 110;
      const by = fy - dh * 0.55;
      if (bx < w - 60) {
        g.rect(bx - 60, by - 110, 120, 220, C.gray, { r: 18, lw: 6 });
        g.circle(bx, by - 40, 44, s.holding ? C.green : C.white, { lw: 6 });
        g.text("◀▶", bx, by - 40, { size: 36, color: C.ink });
        g.circle(bx, by + 56, 34, C.white, { lw: 5 });
        g.text("▶◀", bx, by + 56, { size: 26, color: C.gray2 });
      }
      // quem está chegando (ou ficou para fora)
      for (const p of s.people) {
        if (p.state === "in") continue;
        const x = xOf(p);
        if (x < -150) continue;
        const bonk = p.state === "bonk";
        person(g, x, fy + 10, k, {
          shirt: p.shirt,
          mood: bonk ? (p.talker ? "angry" : "dizzy") : p.talker ? "smug" : "happy",
          walk: bonk ? undefined : s.t * 3.2,
          tilt: bonk ? -0.25 : 0.1,
          tie: p.talker ? C.red : null,
        });
        if (p.talker) {
          drawMegaphone(g, x, fy + 10, k, s.t);
          if (!bonk) {
            const jag = (Math.sin(s.t * 20) + 1) * 4;
            g.star(x + 40, fy - 330 * k, 120 + jag, 80, 12, C.white, { lw: 6 });
            g.text(api.t({ en: "BLAH!", pt: "BLÁ!" }), x + 40, fy - 330 * k, { size: 50, color: C.red });
          }
        } else if (!bonk) {
          cup(g, x + 58 * k, fy - 120 * k, 0.6 * k, C.white, true, s.t);
        }
      }
      // dica de controle
      if (!api.result && s.t < 1.2) {
        g.text(api.t({ en: "HOLD = OPEN", pt: "SEGURA = ABRE" }), portrait ? w / 2 : w * 0.3, portrait ? fy + 230 : h * 0.2, {
          size: 58,
          color: C.white,
          stroke: C.ink,
          lw: 12,
        });
      }
    },
  };
}

/** Megafone na mão do falastrão (pessoa com pés em x, y e escala k). */
function drawMegaphone(g: Gfx, x: number, y: number, k: number, t: number): void {
  g.push();
  g.translate(x + 50 * k, y - 190 * k);
  g.scale(k);
  g.rotate(-0.2 + Math.sin(t * 10) * 0.05);
  g.shape(0, 0, [0, -16, 70, -44, 70, 44, 0, 16], C.orange, { lw: 6 });
  g.rect(-18, -14, 22, 28, C.ink2, { r: 4, lw: 4 });
  for (let i = 0; i < 3; i++) g.arc(80, 0, 30 + i * 20, -0.6, 0.6, C.ink, 5);
  g.pop();
}

export const holdTheDoor: Entry<S> = {
  def: {
    id: "hold-the-door",
    num: 294,
    name: { en: "Hold the Door", pt: "Segura a Porta" },
    verb: { en: "HOLD THE DOOR!", pt: "SEGURA A PORTA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "office",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Coworkers run to the elevator one at a time. Hold the door-open button (or Space) while friendly coworkers arrive, and let go so the doors close before the loud talker with a megaphone gets there. Later there are 3 friends, and from level 1 the talker comes in the middle of the line, so you must close and reopen in time.",
    winText: "Every friend gets in and the loud talker bonks on the closed door.",
    loseText: "A friend hits the closed door, or the loud talker gets in.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const next = s.people.find((p) => p.state === "run");
          const want = !!next && !next.talker;
          if (want && !io.isDown) io.down(api.w / 2, api.h / 2);
          else if (!want && io.isDown) io.up(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result) return;
          // segura o tempo todo, inclusive para o falastrão
          if (!io.isDown) io.down(api.w / 2, api.h / 2);
        },
      }
    : null,
};
