// 081 · SNEAK OUT! — 17h58. Segure para andar até a porta; solte para congelar. O chefe, de costas, vira de
// repente (antes ele mexe a cabeça). Andando quando ele olha = "só mais uma tarefinha…".
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, boss, plant } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";
import { textBlock } from "./util.ts";

interface S {
  x: number;
  x0: number;
  x1: number;
  floor: number;
  speed: number;
  warn: number;
  look: number;
  grace: number;
  turns: number[];
  walking: boolean;
  caught: boolean;
  out: boolean;
  phase: "calm" | "warn" | "look";
  since: number;
  t: number;
  walkT: number;
  endT: number;
}

export function sneakPhase(s: S, t: number): { phase: S["phase"]; since: number } {
  for (const p of s.turns) {
    if (t >= p && t < p + s.warn) return { phase: "warn", since: t - p };
    if (t >= p + s.warn && t < p + s.warn + s.look) return { phase: "look", since: t - p - s.warn };
  }
  return { phase: "calm", since: 0 };
}

/** Chefe de costas, sentado. (x, y) = base da cadeira. */
function bossBack(g: Gfx, x: number, y: number, sc: number, twitch: number): void {
  g.push();
  g.translate(x, y);
  g.scale(sc);
  g.rect(-70, -40, 140, 40, C.gray2, { r: 10 });
  g.rect(-14, 0, 28, 60, C.gray2);
  g.rect(-48, -150, 96, 120, C.ink2, { r: 26 });
  g.push();
  g.translate(0, -178);
  g.rotate(twitch);
  g.circle(-40, 4, 10, C.skin);
  g.circle(40, 4, 10, C.skin);
  g.circle(0, 0, 44, C.gray2);
  g.arc(0, 4, 30, 0.2, Math.PI - 0.2, C.ink, 4);
  g.pop();
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const D = api.duration;
  // Do sinal (cabeça mexendo) até virar: tempo de reação humano mesmo no nível mais alto (0,85 s → 0,55 s).
  const warn = 0.85 - lv * 0.2;
  const look = 0.7 - lv * 0.15;
  const grace = 0.08;
  const walkTime = clamp(D * 0.4, 1.2, 2.4);
  const nTurns = clamp(Math.floor((D - walkTime - 0.35) / (warn + look + 0.15)), 1, 3);
  const turns: number[] = [];
  // A primeira virada vem antes de dar para chegar à porta andando sem parar.
  let t = rng.range(0.35, Math.max(0.4, walkTime - warn - grace - 0.15));
  for (let i = 0; i < nTurns; i++) {
    turns.push(t);
    t += warn + look + rng.range(0.25, 0.7);
  }
  const x0 = portrait ? 150 : w * 0.1;
  const x1 = portrait ? w - 170 : w * 0.86;
  const s: S = {
    x: x0,
    x0,
    x1,
    floor: portrait ? h * 0.7 : h * 0.86,
    speed: (x1 - x0) / walkTime,
    warn,
    look,
    grace,
    turns,
    walking: false,
    caught: false,
    out: false,
    phase: "calm",
    since: 0,
    t: 0,
    walkT: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.out) s.x += s.speed * 0.8 * dt;
        s.walking = s.out;
        if (s.out) s.walkT += dt;
        return;
      }
      const ph = sneakPhase(s, api.time);
      s.phase = ph.phase;
      s.since = ph.since;
      const go = api.input.action;
      if (go && !s.walking) api.sfx("slide");
      s.walking = go;
      if (ph.phase === "look" && ph.since >= s.grace && go) {
        s.caught = true;
        api.sfx("buzz");
        api.fx.shake(0.6);
        api.lose();
        return;
      }
      if (go) {
        s.x += s.speed * dt;
        s.walkT += dt;
        if (Math.floor(s.walkT * 5) !== Math.floor((s.walkT - dt) * 5)) api.sfx("tap");
        if (s.x >= s.x1) {
          s.x = s.x1;
          s.out = true;
          api.sfx("chime");
          api.fx.burst(s.x1, s.floor - 200, C.yellow, 20);
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      const fl = s.floor;
      // parede e janela ao fim da tarde
      g.rect(-10, fl, w + 20, h - fl + 10, C.paper2, { lw: 7 });
      const wx = portrait ? w * 0.5 : w * 0.3;
      const wy = portrait ? h * 0.12 : h * 0.12;
      g.rect(wx - 170, wy, 340, 220, C.orange2, { lw: 7 });
      g.circle(wx, wy + 190, 70, C.yellow, { lw: 5 });
      g.rect(wx - 170, wy + 190, 340, 30, C.orange, { stroke: null });
      g.rect(wx - 170, wy, 340, 220, null, { lw: 7 });
      // relógio
      const cx = portrait ? w * 0.5 : w * 0.62;
      const cy = portrait ? h * 0.3 : h * 0.16;
      g.rect(cx - 150, cy - 60, 300, 120, C.ink, { r: 16, lw: 6 });
      g.text(api.result === "win" ? "18:00" : "17:58", cx, cy + 4, { size: 86, font: "mono", color: api.result === "win" ? C.green : C.red });
      // porta
      const dw = portrait ? 170 : 230;
      const dh = portrait ? 380 : 420;
      g.rect(s.x1 - dw / 2, fl - dh, dw, dh, C.ink2, { lw: 7 });
      const open = s.out ? Math.min(1, s.endT * 4) : 0;
      g.rect(s.x1 - dw / 2, fl - dh, dw * (1 - open * 0.75), dh, C.brown, { lw: 7 });
      g.circle(s.x1 + dw * 0.3 - open * dw * 0.6, fl - dh * 0.48, 12, C.yellow, { lw: 4 });
      g.rect(s.x1 - 90, fl - dh - 70, 180, 56, C.green, { r: 8, lw: 5 });
      g.text(api.t({ en: "EXIT", pt: "SAÍDA" }), s.x1, fl - dh - 40, { size: 44, color: C.white });
      // mesa do chefe (no meio, ao fundo)
      const bx = (s.x0 + s.x1) / 2 + (portrait ? 0 : -40);
      const by = portrait ? fl - 300 : fl - 150;
      const bs = portrait ? 1.15 : 1.25;
      const turned = s.phase === "look" || s.caught;
      g.rect(bx - 190 * bs, by - 120 * bs, 380 * bs, 30 * bs, C.brown2, { lw: 6 });
      g.rect(bx - 170 * bs, by - 90 * bs, 24 * bs, 90 * bs, C.brown2, { lw: 5 });
      g.rect(bx + 146 * bs, by - 90 * bs, 24 * bs, 90 * bs, C.brown2, { lw: 5 });
      g.rect(bx - 80 * bs, by - 250 * bs, 160 * bs, 120 * bs, C.ink2, { r: 10, lw: 6 });
      if (turned) {
        const k = s.caught ? 1 : clamp(s.since / s.grace, 0, 1);
        g.push();
        g.translate(bx, by + 100 * bs);
        g.scale(0.6 + 0.4 * k, 1);
        g.shadow(0, 0, 70 * bs);
        boss(g, 0, 0, bs, { mood: s.caught ? "angry" : "neutral", look: { x: (s.x - bx) / 600, y: 0.3 } });
        g.pop();
      } else {
        // o tremor da cabeça aumenta até ele virar
        const twitch = s.phase === "warn" ? Math.sin(s.t * 45) * (0.12 + 0.16 * clamp(s.since / s.warn, 0, 1)) : 0;
        bossBack(g, bx, by + 40 * bs, bs, twitch);
        if (s.phase === "warn") g.text("?", bx + 70 * bs, by - 300 * bs, { size: 110, color: C.red, stroke: C.ink, lw: 12 });
      }
      if (s.caught) {
        const tw = Math.min(w - 120, 760);
        const ty = portrait ? by - 420 * bs : h * 0.38;
        g.rect(w / 2 - tw / 2, ty - 70, tw, 140, C.white, { r: 70, lw: 7 });
        textBlock(g, api.t({ en: "Just one more task…", pt: "Só mais uma tarefinha…" }), w / 2, ty, tw - 80, { size: 60, color: C.ink, font: "body", weight: 800 });
      }
      // sua mesa
      if (!portrait) {
        g.rect(s.x0 - 120, fl - 140, 220, 24, C.brown2, { lw: 5 });
        plant(g, s.x0 - 80, fl - 140, 0.8);
      }
      // você
      if (!(s.out && s.endT > 0.3)) {
        const frozen = !s.walking && s.phase !== "calm";
        const mood = s.caught ? "shock" : s.out ? "happy" : frozen ? "smug" : s.walking ? "worried" : "neutral";
        g.push();
        if (s.out) g.alpha(1 - clamp((s.endT - 0.1) / 0.2, 0, 1));
        person(g, s.x, fl, portrait ? 1.3 : 1.45, {
          shirt: C.blue,
          tie: C.yellow,
          mood,
          walk: s.walking ? s.walkT * 2.2 : undefined,
          look: { x: 1, y: 0 },
          tilt: s.walking ? 0.08 : 0,
        });
        g.pop();
        if (frozen && !s.caught) {
          // assobiando, disfarçando
          const k = (s.t * 2) % 1;
          g.push();
          g.alpha(1 - k);
          const nx = s.x + 80;
          const ny = fl - 330 - k * 60;
          g.ellipse(nx, ny, 16, 12, C.ink, { stroke: null, rot: -0.4 });
          g.line(nx + 13, ny - 4, nx + 13, ny - 56, C.ink, 6);
          g.line(nx + 13, ny - 56, nx + 34, ny - 40, C.ink, 6);
          g.pop();
        }
      }
      // trilha até a porta
      const prog = clamp((s.x - s.x0) / (s.x1 - s.x0), 0, 1);
      g.rect(s.x0, fl + 50, s.x1 - s.x0, 24, C.white, { r: 12, lw: 5 });
      g.rect(s.x0 + 4, fl + 54, Math.max(0, (s.x1 - s.x0 - 8) * prog), 16, C.green, { r: 8, stroke: null });
    },
  };
}

export const sneakOut: Entry<S> = {
  def: {
    id: "sneak-out",
    num: 81,
    name: { en: "Sneak Out", pt: "Sai de Fininho" },
    verb: { en: "SNEAK OUT!", pt: "SAI DE FININHO!" },
    hint: { pointer: "hold", keys: "space" },
    category: "office",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "It's 17:58. Hold to tiptoe to the exit; release to freeze. The boss sits with his back to you and suddenly turns around (his head twitches just before). Moving while he looks means one more task.",
    winText: "Reach the door.",
    loseText: "Walking while the boss looks, or time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const ph = sneakPhase(s, api.time + 1 / 60);
          const go = ph.phase === "calm";
          if (go && !io.isDown) io.down(api.w / 2, api.h / 2);
          else if (!go && io.isDown) io.up(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result) return;
          if (!io.isDown && s.x < s.x1) io.down(api.w / 2, api.h / 2);
        },
      }
    : null,
};
