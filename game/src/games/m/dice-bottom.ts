// 200 · WHAT'S UNDER? — um dado mostra a face de cima; faces opostas somam 7. Qual número está embaixo?
// No nível 0 há um lembrete pequeno; nos altos ele some e aparecem dois dados (soma das faces de baixo).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait } from "./util.ts";

interface Die {
  top: number;
  left: number;
  right: number;
  x: number;
  y: number;
  spin: number;
}
interface S {
  dice: Die[];
  size: number;
  options: number[];
  answer: number;
  choices: Choices;
  reminder: boolean;
  t: number;
  endT: number;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.73, 0.22],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.78],
    [0.73, 0.78],
  ],
};

/** Face (paralelogramo O + u·U + v·V) com os pontos do número n. */
function face(g: Gfx, o: Point, u: Point, v: Point, n: number, fill: string): void {
  g.poly(
    [
      { x: o.x, y: o.y },
      { x: o.x + u.x, y: o.y + u.y },
      { x: o.x + u.x + v.x, y: o.y + u.y + v.y },
      { x: o.x + v.x, y: o.y + v.y },
    ],
    fill,
    { lw: 7 },
  );
  g.push();
  g.ctx.transform(u.x, u.y, v.x, v.y, o.x, o.y);
  for (const [px, py] of PIPS[n]) g.circle(px, py, 0.095, n === 1 ? C.red : C.ink, { stroke: null });
  g.pop();
}

/** Dado em perspectiva isométrica. (x, y) = centro do cubo; S = meia altura. */
function drawDie(g: Gfx, d: Die, S: number, lifted: number): void {
  const k = 0.866 * S;
  const cx = d.x;
  const cy = d.y - lifted;
  g.shadow(d.x, d.y + S * 1.05, S * (1.05 - lifted / (S * 6)), S * 0.28);
  // lados
  face(g, { x: cx - k, y: cy - S / 2 }, { x: k, y: S / 2 }, { x: 0, y: S }, d.left, C.paper2);
  face(g, { x: cx, y: cy }, { x: k, y: -S / 2 }, { x: 0, y: S }, d.right, C.muted);
  // topo (a face que importa)
  face(g, { x: cx, y: cy - S }, { x: k, y: S / 2 }, { x: -k, y: S / 2 }, d.top, C.white);
}

function makeDie(api: MicroAPI, x: number, y: number): Die {
  const { rng } = api;
  const top = rng.int(1, 6);
  const sideOpts = [1, 2, 3, 4, 5, 6].filter((n) => n !== top && n !== 7 - top);
  const left = rng.pick(sideOpts);
  const right = rng.pick(sideOpts.filter((n) => n !== left && n !== 7 - left));
  return { top, left, right, x, y, spin: rng.range(0, 6) };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const two = lv >= 1;
  const dieY = portrait ? h * 0.27 : h * 0.3;
  const size = two ? (portrait ? 140 : 135) : portrait ? 175 : 165;
  const dice: Die[] = two ? [makeDie(api, w / 2 - size * 1.45, dieY), makeDie(api, w / 2 + size * 1.45, dieY)] : [makeDie(api, w / 2, dieY)];
  const answerVal = dice.reduce((a, d) => a + 7 - d.top, 0);
  const topSum = dice.reduce((a, d) => a + d.top, 0);
  // erradas plausíveis: o próprio topo (erro clássico) e uma face lateral (ou vizinho, se coincidir)
  const wrong = new Set<number>([topSum]);
  const lateral = dice.reduce((a, d) => a + (rng.chance(0.5) ? d.left : d.right), 0);
  for (const v of rng.shuffle([lateral, answerVal + 1, answerVal - 1, topSum + 1])) {
    if (wrong.size >= 2) break;
    if (v !== answerVal && v > 0 && !wrong.has(v)) wrong.add(v);
  }
  const options = rng.shuffle([answerVal, ...wrong]);
  const s: S = {
    dice,
    size,
    options,
    answer: options.indexOf(answerVal),
    choices: new Choices(api, 3, {
      area: portrait ? { x: 80, y: h * 0.6, w: w - 160, h: h * 0.26 } : { x: w * 0.16, y: h * 0.64, w: w * 0.68, h: h * 0.28 },
      maxCols: 3,
    }),
    reminder: lv < 0.5,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // feltro da mesa de jogo
      const fy = dieY + s.size * 1.05;
      g.ellipse(w / 2, fy, Math.min(w * 0.46, 760), s.size * 0.75, "#2aa862", { stroke: null });
      const lift = api.result ? Math.min(1, s.endT / 0.25) * s.size * 0.9 : 0;
      for (const d of s.dice) {
        if (lift > 0) {
          // embaixo do dado aparece a face de baixo
          const v = 7 - d.top;
          g.rectC(d.x, fy - 4, s.size * 1.2, s.size * 0.5, C.white, { r: 16, lw: 6 });
          g.text(String(v), d.x, fy - 2, { size: s.size * 0.42, color: C.ink, font: "mono" });
        }
        drawDie(g, d, s.size, lift);
      }
      // seta e pergunta "embaixo?"
      if (!api.result) {
        const bob = Math.sin(s.t * 6) * 8;
        for (const d of s.dice) {
          const ay = d.y + s.size * 1.45 + bob;
          g.shape(d.x, ay, [-26, -20, 26, -20, 0, 14], C.yellow, { lw: 5 });
        }
        const q = s.dice.length > 1 ? api.t({ en: "BOTTOM + BOTTOM = ?", pt: "BAIXO + BAIXO = ?" }) : api.t({ en: "BOTTOM = ?", pt: "EMBAIXO = ?" });
        g.text(q, w / 2, dieY + s.size * 1.9, { size: portrait ? 62 : 56, color: C.white, stroke: C.ink, lw: 10 });
      }
      if (s.reminder) {
        const txt = api.t({ en: "opposite faces add up to 7", pt: "faces opostas somam 7" });
        const ry = portrait ? h * 0.06 : 54;
        g.rectC(w / 2, ry, Math.min(w - 80, 560), 64, C.yellow2, { r: 32, lw: 5 });
        g.text(txt, w / 2, ry + 2, { size: 34, font: "body", weight: 800, color: C.ink, maxWidth: Math.min(w - 120, 520) });
      }
      s.choices.draw(
        g,
        (i, r) => {
          g.text(String(s.options[i]), r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(r.h * 0.56, r.w * 0.45), color: C.ink, font: "mono" });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const diceBottom: Entry<S> = {
  def: {
    id: "dice-bottom",
    num: 200,
    name: { en: "Under the Die", pt: "Embaixo do Dado" },
    verb: { en: "WHAT'S UNDER?", pt: "O QUE TEM EMBAIXO?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "A die shows its top face; opposite faces add up to 7. Pick the number underneath. Later the reminder goes away and two dice ask for the sum of both bottoms.",
    winText: "Pick the number on the bottom face.",
    loseText: "Pick a wrong number or run out of time.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          if (!io.isDown) {
            const c = s.choices.center(s.answer);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          // erro clássico: responde o número de cima
          const top = s.dice.reduce((a, d) => a + d.top, 0);
          const i = s.options.indexOf(top);
          const c = s.choices.center(i >= 0 ? i : (s.answer + 1) % 3);
          if (!io.isDown) io.tap(c.x, c.y);
        },
      }
    : null,
};
