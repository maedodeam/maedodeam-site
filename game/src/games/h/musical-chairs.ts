// 131 · SIT! — dança das cadeiras na festa do escritório. Enquanto a caixa de som toca (notas saindo), todo mundo gira.
// Quando a música PARA, os colegas correm para as cadeiras: toque a única cadeira que ficou vazia antes que alguém sente.
// Tocar numa cadeira com a música tocando = perde. Nos níveis altos: mais cadeiras e soluços falsos na música.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp01, isPortrait } from "./util.ts";

interface Npc {
  shirt: string;
  hair: string;
  chair: number;
  from: Point;
  /** Tempo para chegar na cadeira depois da parada. */
  arrive: number;
}
type Phase = "music" | "stutter" | "scramble";
interface S {
  phase: Phase;
  chairs: Point[];
  npcs: Npc[];
  target: number;
  stopAt: number;
  stutterAt: number;
  stutterLen: number;
  window: number;
  sT: number;
  ang: number;
  omega: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  scale: number;
  youFrom: Point;
  youSat: boolean;
  badChair: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng, duration } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const cx = w / 2;
  const cy = portrait ? h * 0.58 : h * 0.62;
  const rx = portrait ? w * 0.4 : Math.min(Math.max(w * 0.32, 400), 560);
  const ry = portrait ? rx * 1.05 : rx * 0.62;
  const off = rng.range(0, Math.PI * 2);
  const chairs: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    chairs.push({ x: cx + Math.cos(a) * rx * 0.48, y: cy + Math.sin(a) * ry * 0.48 });
  }
  const shirts = rng.shuffle([C.green, C.purple, C.pink, C.teal, C.sky, C.yellow]);
  const hairs = [C.ink2, C.brown, C.gray2, C.orange, C.ink];
  const npcs: Npc[] = Array.from({ length: n }, (_, i) => ({ shirt: shirts[i], hair: hairs[i % hairs.length], chair: -1, from: { x: 0, y: 0 }, arrive: 0 }));
  const win = 1.05 - 0.25 * Math.min(lv, 1.2);
  const latest = Math.min(4.2, duration - win - 0.45);
  const stopAt = rng.range(Math.min(1.1, latest), latest);
  // soluço falso: a música engasga um instante antes da parada de verdade
  const stutterAt = lv >= 0.5 && stopAt > 1.05 ? Math.max(0.55, stopAt - rng.range(0.45, 0.8)) : Infinity;
  const s: S = {
    phase: "music",
    chairs,
    npcs,
    target: rng.int(0, n - 1),
    stopAt,
    stutterAt,
    stutterLen: 0.28,
    window: win,
    sT: 0,
    ang: rng.range(0, 6),
    omega: 0.9 + lv * 0.35,
    cx,
    cy,
    rx,
    ry,
    scale: portrait ? 0.9 : w < 1300 ? 0.72 : 0.85,
    youFrom: { x: 0, y: 0 },
    youSat: false,
    badChair: -1,
    t: 0,
    endT: 0,
  };

  /** Posição de quem gira em volta das cadeiras (j = n é você). */
  const walkPos = (j: number): Point => {
    const a = s.ang + (j / (n + 1)) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  };

  const stop = () => {
    s.phase = "scramble";
    s.sT = 0;
    api.sfx("thud");
    // os outros pegam as cadeiras mais próximas; quem sobra corre para a cadeira-alvo (demora a janela inteira)
    const free = new Set(s.npcs.map((_, i) => i));
    const pos = s.npcs.map((_, i) => walkPos(i));
    s.npcs.forEach((np, i) => (np.from = pos[i]));
    for (let c = 0; c < n; c++) {
      if (c === s.target) continue;
      let best = -1;
      let bd = Infinity;
      for (const i of free) {
        const d = Math.hypot(pos[i].x - s.chairs[c].x, pos[i].y - s.chairs[c].y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      free.delete(best);
      s.npcs[best].chair = c;
      s.npcs[best].arrive = 0.18;
    }
    const runner = [...free][0];
    s.npcs[runner].chair = s.target;
    s.npcs[runner].arrive = s.window;
    s.youFrom = walkPos(n);
  };

  const npcPos = (np: Npc, i: number): Point => {
    if (s.phase !== "scramble" || np.chair < 0) return walkPos(i);
    const k = clamp01(s.sT / np.arrive);
    const c = s.chairs[np.chair];
    return { x: np.from.x + (c.x - np.from.x) * k, y: np.from.y + (c.y - 30 - np.from.y) * k };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.phase === "scramble") s.sT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.phase === "music" || s.phase === "stutter") s.ang += s.omega * dt * (s.phase === "stutter" ? 0.7 : 1);
      if (s.phase === "music" && s.t >= s.stutterAt && s.t < s.stutterAt + s.stutterLen) {
        s.phase = "stutter";
        api.sfx("glitch");
      } else if (s.phase === "stutter" && s.t >= s.stutterAt + s.stutterLen) s.phase = "music";
      if (s.phase !== "scramble" && s.t >= s.stopAt) stop();

      if (s.phase === "scramble" && s.sT >= s.window) {
        api.sfx("buzz");
        api.fx.pop(s.youFrom.x, s.youFrom.y - 200, api.t({ en: "LEFT STANDING!", pt: "FICOU DE PÉ!" }), C.red);
        api.lose();
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let ci = -1;
      let bd = 120;
      s.chairs.forEach((c, i) => {
        const d = Math.hypot(inp.x - c.x, inp.y - (c.y - 20));
        if (d < bd) {
          bd = d;
          ci = i;
        }
      });
      if (ci < 0) return;
      if (s.phase !== "scramble") {
        s.badChair = ci;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(s.chairs[ci].x, s.chairs[ci].y - 120, api.t({ en: "MUSIC'S ON!", pt: "TÁ TOCANDO!" }), C.red);
        api.lose();
      } else if (ci === s.target) {
        s.youSat = true;
        api.sfx("pop");
        api.fx.burst(s.chairs[ci].x, s.chairs[ci].y - 40, C.yellow, 22);
        api.win();
      } else {
        s.badChair = ci;
        api.sfx("thud");
        api.fx.shake(0.5);
        api.fx.pop(s.chairs[ci].x, s.chairs[ci].y - 120, api.t({ en: "TAKEN!", pt: "OCUPADA!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.purple);
      // pista de dança
      g.ellipse(cx, cy + 20, rx * 1.25, ry * 1.25, C.purple2, { lw: 8 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + s.t * 0.2;
        g.circle(cx + Math.cos(a) * rx * 1.1, cy + 20 + Math.sin(a) * ry * 1.1, 10, [C.yellow, C.pink, C.sky][i % 3], { stroke: null });
      }
      // caixa de som
      const playing = s.phase === "music";
      const sq = !portrait && w < 1300;
      const spx = portrait ? w * 0.8 : sq ? w * 0.09 : w * 0.12;
      const spy = portrait ? h * 0.16 : sq ? h * 0.16 : h * 0.3;
      const bump = playing ? Math.abs(Math.sin(s.t * 9)) * 0.08 : 0;
      g.push();
      g.translate(spx, spy);
      g.scale((sq ? 0.6 : 1) * (1 + bump));
      g.rect(-80, -120, 160, 240, C.ink2, { r: 18 });
      g.circle(0, -50, 44, C.gray2);
      g.circle(0, -50, 18, C.ink);
      g.circle(0, 55, 50, C.gray2);
      g.circle(0, 55, 22, C.ink);
      g.pop();
      if (playing) {
        for (let i = 0; i < 4; i++) {
          const k = (s.t * 0.9 + i / 4) % 1;
          const nx = spx + (portrait ? -1 : 1) * (60 + k * 260) + Math.sin(k * 9 + i) * 30;
          const ny = spy - 80 - k * 160;
          g.push();
          g.alpha(1 - k);
          g.circle(nx, ny, 18, C.yellow, { lw: 5 });
          g.line(nx + 15, ny, nx + 15, ny - 60, C.ink, 6);
          g.pop();
        }
      } else if (s.phase === "stutter") {
        g.text("~?", sq ? spx + 120 : spx, sq ? spy : spy - 170, { size: 70, color: C.yellow, stroke: C.ink, lw: 10 });
      } else {
        const sx = sq ? spx + 120 : spx;
        const sy = sq ? spy + 180 : spy;
        g.rect(sx - 50, sy - 230, 100, 100, C.red, { r: 12 });
        g.rect(sx - 22, sy - 202, 44, 44, C.white, { stroke: null });
      }
      // cadeiras
      for (let i = 0; i < s.chairs.length; i++) {
        const c = s.chairs[i];
        const bad = i === s.badChair;
        const k = 1.25;
        g.rect(c.x - 44 * k, c.y - 110 * k, 88 * k, 80 * k, bad ? C.red : C.orange, { r: 12 });
        g.rect(c.x - 54 * k, c.y - 34 * k, 108 * k, 34 * k, bad ? C.red : C.orange2, { r: 10 });
        g.line(c.x - 44 * k, c.y, c.x - 44 * k, c.y + 44 * k, C.ink, 9);
        g.line(c.x + 44 * k, c.y, c.x + 44 * k, c.y + 44 * k, C.ink, 9);
      }
      // pessoas (ordenadas por profundidade)
      const all: { p: Point; draw: () => void }[] = [];
      s.npcs.forEach((np, i) => {
        const p = npcPos(np, i);
        const seated = s.phase === "scramble" && s.sT >= np.arrive;
        all.push({
          p,
          draw: () =>
            person(g, p.x, p.y + (seated ? 20 : 0), s.scale, {
              shirt: np.shirt,
              hair: np.hair,
              tie: null,
              mood: s.phase === "scramble" ? (api.result === "win" && np.chair === s.target ? "shock" : "smug") : "happy",
              walk: seated ? undefined : s.t * (s.phase === "scramble" ? 6 : 2.5) + i * 0.3,
            }),
        });
      });
      let you = s.phase === "scramble" ? s.youFrom : walkPos(n);
      if (s.youSat) {
        const c = s.chairs[s.target];
        const k = clamp01(s.endT / 0.15);
        you = { x: you.x + (c.x - you.x) * k, y: you.y + (c.y - 10 - you.y) * k };
      }
      all.push({
        p: you,
        draw: () => {
          person(g, you.x, you.y, s.scale, {
            shirt: C.orange,
            tie: C.yellow,
            mood: api.result === "lose" ? "sad" : api.result === "win" ? "happy" : "neutral",
            walk: s.phase === "scramble" ? undefined : s.t * 2.5,
          });
          const ty = you.y - 270 * s.scale - 30;
          g.rect(you.x - 52, ty - 26, 104, 52, C.yellow, { r: 12, lw: 5 });
          g.text(api.t({ en: "YOU", pt: "VOCÊ" }), you.x, ty + 2, { size: 34, color: C.ink, maxWidth: 96 });
        },
      });
      all.sort((a, b) => a.p.y - b.p.y);
      for (const it of all) it.draw();
    },
  };
}

export const musicalChairs: Entry<S> = {
  def: {
    id: "musical-chairs",
    num: 131,
    name: { en: "Musical Chairs", pt: "Dança das Cadeiras" },
    verb: { en: "SIT!", pt: "SENTA!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Coworkers circle the chairs while notes float out of a bouncing speaker. When the music stops, everyone rushes to sit: tap the one chair still empty before the last runner gets there (under a second). Harder levels: more chairs and fake hiccups in the music.",
    winText: "Grab the empty chair right after the music stops.",
    loseText: "Tap a chair while the music plays, tap a taken chair, or be left standing.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "scramble" || s.sT < 0.22 || io.isDown) return;
          const c = s.chairs[s.target];
          io.tap(c.x, c.y - 30);
        },
        lose(s, api, io) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ done: false }));
          // afobado: senta no primeiro engasgo da música (ou antes da hora)
          const early = s.phase === "stutter" || (s.stutterAt === Infinity && api.time > 0.6);
          if (!early || m.done) return;
          const c = s.chairs[(s.target + 1) % s.chairs.length];
          io.tap(c.x, c.y - 30);
          m.done = true;
        },
      }
    : null,
};
