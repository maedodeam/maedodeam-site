// 130 · PASS IT! — batata quente na mesa de reunião. A batata na sua mão esquenta (anel de pavio).
// Toque num colega que está OLHANDO para você para passar; ele devolve logo depois. Quem está no celular leva a batata na
// cabeça e deixa cair (perde). Vence com 3 passes. Perde também se o pavio acabar na sua mão.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, phone } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp01, isPortrait } from "./util.ts";

interface Mate {
  x: number;
  /** Pés (escondidos atrás da mesa). */
  y: number;
  looking: boolean;
  timer: number;
  shirt: string;
  hair: string;
  bonked: number;
}
type Where = "you" | "out" | "held" | "back";
interface S {
  mates: Mate[];
  where: Where;
  target: number;
  flyT: number;
  holdT: number;
  fuse: number;
  fuseMax: number;
  passes: number;
  need: number;
  youX: number;
  youY: number;
  scale: number;
  tableX: number;
  tableY: number;
  tableRX: number;
  tableRY: number;
  lookMin: number;
  lookMax: number;
  phoneMin: number;
  phoneMax: number;
  burnt: boolean;
  t: number;
  endT: number;
}

const FLY = 0.22;
const HOLD = 0.3;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const count = lv < 0.5 ? 4 : 5;
  const tableX = w / 2;
  const tableY = portrait ? h * 0.56 : h * 0.64;
  const tableRX = portrait || w < 1300 ? w * 0.4 : Math.min(w * 0.34, 560);
  const tableRY = tableRX * 0.34;
  const scale = portrait ? 1.3 : w < 1300 ? 1.05 : 1.3;
  const shirts = rng.shuffle([C.green, C.purple, C.pink, C.teal, C.yellow, C.sky]);
  const hairs = [C.ink2, C.brown, C.gray2, C.orange, C.ink];
  const mates: Mate[] = [];
  for (let i = 0; i < count; i++) {
    // espalhados por igual no x, na borda de trás da mesa
    const u = (-1 + (2 * i) / (count - 1)) * 0.95;
    mates.push({
      x: tableX + u * tableRX,
      y: tableY - Math.sqrt(1 - u * u) * tableRY * 0.6 + 20 * scale,
      looking: false,
      timer: 0,
      shirt: shirts[i % shirts.length],
      hair: hairs[i % hairs.length],
      bonked: 0,
    });
  }
  // nível 0: olhadas longas; depois, mais curtas e com mais gente no celular
  const s: S = {
    mates,
    where: "you",
    target: -1,
    flyT: 0,
    holdT: 0,
    fuseMax: 2.2 - 0.5 * Math.min(1, lv),
    fuse: 2.4 - 0.5 * Math.min(1, lv),
    passes: 0,
    need: 3,
    youX: w / 2,
    youY: portrait ? h * 0.82 : h * 0.9,
    scale,
    tableX,
    tableY,
    tableRX,
    tableRY,
    lookMin: lv < 0.5 ? 1.2 : 0.75 - Math.min(0.15, (lv - 0.5) * 0.15),
    lookMax: lv < 0.5 ? 2.0 : 1.3 - (lv - 0.5) * 0.2,
    phoneMin: lv < 0.5 ? 0.6 : 0.8,
    phoneMax: lv < 0.5 ? 1.2 : 1.7 + lv * 0.3,
    burnt: false,
    t: 0,
    endT: 0,
  };
  const lookers = rng.sample(count, lv < 0.5 ? 2 : 1);
  mates.forEach((m, i) => {
    m.looking = lookers.includes(i);
    m.timer = m.looking ? rng.range(s.lookMin, s.lookMax) : rng.range(s.phoneMin, s.phoneMax);
  });

  /** Garante que sempre há alguém olhando (e alguém distraído, para a pegadinha existir). */
  const keepInvariants = () => {
    const free = s.mates.filter((_, i) => !(s.where !== "you" && i === s.target));
    if (!free.some((m) => m.looking)) {
      const m = free.reduce((a, b) => (a.timer > b.timer ? a : b));
      m.looking = true;
      m.timer = rng.range(s.lookMin, s.lookMax);
    }
    if (!s.mates.some((m) => !m.looking)) {
      const m = free.reduce((a, b) => (a.timer < b.timer ? a : b));
      m.looking = false;
      m.timer = rng.range(s.phoneMin, s.phoneMax);
    }
  };
  keepInvariants();

  const handPos = (i: number) => ({ x: s.mates[i].x, y: s.mates[i].y - 120 * s.scale });

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const m of s.mates) if (m.bonked > 0) m.bonked += dt;
      if (s.where === "out" || s.where === "back") s.flyT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      // colegas alternam entre olhar e o celular
      s.mates.forEach((m, i) => {
        if (s.where !== "you" && i === s.target) return;
        m.timer -= dt;
        if (m.timer <= 0) {
          m.looking = !m.looking;
          m.timer = m.looking ? rng.range(s.lookMin, s.lookMax) : rng.range(s.phoneMin, s.phoneMax);
        }
      });
      keepInvariants();

      if (s.where === "you") {
        s.fuse -= dt;
        if (s.fuse <= 0) {
          s.burnt = true;
          api.sfx("zap");
          api.fx.shake(0.8);
          api.fx.pop(s.youX, s.youY - 160, api.t({ en: "HOT!", pt: "QUEIMOU!" }), C.red);
          api.lose();
          return;
        }
        const inp = api.input;
        if (!inp.pressed) return;
        const R = 140 * Math.max(0.9, s.scale);
        let best = -1;
        let bd = Infinity;
        s.mates.forEach((m, i) => {
          const d = Math.hypot(inp.x - m.x, inp.y - (m.y - 130 * s.scale));
          if (d < R && d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best < 0) return;
        s.target = best;
        s.where = "out";
        s.flyT = 0;
        api.sfx("swoosh");
        const m = s.mates[best];
        if (!m.looking) {
          // acertou quem estava no celular
          m.bonked = 0.001;
          api.sfx("thud");
          api.fx.shake(0.6);
          api.fx.pop(m.x, m.y - 260 * s.scale, api.t({ en: "OUCH!", pt: "AI!" }), C.red);
          api.lose();
        }
      } else if (s.where === "out") {
        if (s.flyT >= FLY) {
          s.where = "held";
          s.holdT = 0;
          s.passes++;
          api.sfx("pop");
          const p = handPos(s.target);
          api.fx.pop(p.x, p.y - 140, `${s.passes}/${s.need}`, C.white);
          if (s.passes >= s.need) {
            api.sfx("chime");
            api.fx.burst(p.x, p.y, C.yellow, 20);
            api.win();
          }
        }
      } else if (s.where === "held") {
        s.holdT += dt;
        if (s.holdT >= HOLD) {
          s.where = "back";
          s.flyT = 0;
          api.sfx("swoosh");
        }
      } else if (s.flyT >= FLY) {
        s.where = "you";
        s.fuse = s.fuseMax;
        s.target = -1;
        api.sfx("tap");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // parede e quadro
      g.rect(-10, -10, w + 20, s.tableY - s.tableRY * 0.2, C.paper2, { stroke: null });
      g.rect(w * 0.08, h * 0.06, w * 0.22, h * 0.14, C.white, { r: 10 });
      g.line(w * 0.1, h * 0.17, w * 0.28, h * 0.09, C.green, 8);
      // colegas
      for (let i = 0; i < s.mates.length; i++) {
        const m = s.mates[i];
        const headY = m.y - 178 * s.scale;
        const look = m.looking ? { x: (s.youX - m.x) / 600, y: 0.8 } : { x: 0, y: 1 };
        const mood = m.bonked > 0 ? "dizzy" : m.looking ? "happy" : "neutral";
        person(g, m.x, m.y, s.scale, { shirt: m.shirt, hair: m.hair, mood, look, tie: null, tilt: m.looking ? 0 : 0.08 });
        if (m.looking && m.bonked === 0) {
          // mãos prontas para pegar
          g.circle(m.x - 60 * s.scale, m.y - 150 * s.scale, 20 * s.scale, C.skin, { lw: 5 });
          g.circle(m.x + 60 * s.scale, m.y - 150 * s.scale, 20 * s.scale, C.skin, { lw: 5 });
          g.text("!", m.x + 56 * s.scale, headY - 60 * s.scale, { size: 60 * s.scale, color: C.orange, stroke: C.ink, lw: 8 });
        } else if (!m.looking) {
          phone(g, m.x + 6, m.y - 110 * s.scale, 0.42 * s.scale, C.sky, 0.2);
          g.push();
          g.alpha(0.35);
          g.circle(m.x + 6, m.y - 120 * s.scale, 34 * s.scale, C.sky, { stroke: null });
          g.pop();
        }
        if (m.bonked > 0) {
          for (let k = 0; k < 3; k++) {
            const a = m.bonked * 6 + (k * Math.PI * 2) / 3;
            g.star(m.x + Math.cos(a) * 50 * s.scale, headY - 50 * s.scale + Math.sin(a) * 14, 14, 6, 5, C.yellow, { lw: 3 });
          }
        }
      }
      // mesa
      g.ellipse(s.tableX, s.tableY + 26, s.tableRX, s.tableRY, C.ink, { stroke: null });
      g.ellipse(s.tableX, s.tableY, s.tableRX, s.tableRY, C.brown2, { lw: 8 });
      g.ellipse(s.tableX, s.tableY, s.tableRX * 0.8, s.tableRY * 0.7, null, { stroke: C.brown, lw: 5 });
      // suas mãos
      const hx = s.youX;
      const hy = s.youY;
      g.circle(hx - 120, hy + 30, 46, C.skin);
      g.circle(hx + 120, hy + 30, 46, C.skin);
      // a batata
      let px = hx;
      let py = hy - 30;
      if (s.where !== "you" && s.target >= 0) {
        const p = handPos(s.target);
        const m = s.mates[s.target];
        let k = clamp01(s.flyT / FLY);
        let ax = hx;
        let ay = hy - 30;
        let bx = p.x;
        let by = p.y;
        if (m.bonked > 0) {
          // bate na cabeça e cai
          by = m.y - 190 * s.scale;
          if (k >= 1) {
            const fall = Math.min(1, (s.endT - FLY) * 3);
            ax = bx;
            ay = by;
            by = s.tableY;
            k = Math.max(0, fall);
          }
        }
        if (s.where === "held") k = 1;
        if (s.where === "back") {
          [ax, ay, bx, by] = [p.x, p.y, hx, hy - 30];
        }
        px = ax + (bx - ax) * k;
        py = ay + (by - ay) * k - Math.sin(k * Math.PI) * 220;
      }
      const heat = s.where === "you" ? 1 - s.fuse / s.fuseMax : 0;
      const jig = s.where === "you" ? Math.sin(s.t * 40) * heat * 8 : 0;
      g.ellipse(px + jig, py, 64, 48, s.burnt ? C.ink2 : heat > 0.6 ? C.orange2 : C.brown2, { rot: 0.3 });
      g.circle(px - 20 + jig, py - 10, 6, C.brown, { stroke: null });
      g.circle(px + 18 + jig, py + 12, 5, C.brown, { stroke: null });
      // vapor
      for (let i = -1; i <= 1; i++) {
        const o = Math.sin(s.t * 5 + i) * 8;
        g.polyline(
          [
            { x: px + i * 20, y: py - 56 },
            { x: px + i * 20 + o, y: py - 76 },
            { x: px + i * 20 - o, y: py - 96 },
          ],
          C.white,
          6,
        );
      }
      // anel do pavio
      if (s.where === "you" && !api.result) {
        const k = clamp01(s.fuse / s.fuseMax);
        g.arc(hx, hy - 30, 100, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, C.ink, 22);
        g.arc(hx, hy - 30, 100, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, k < 0.35 ? C.red : C.yellow, 12);
      }
      // placar de passes
      g.text(`${s.passes}/${s.need}`, w - 90, h - 70, { size: 64, color: C.white, stroke: C.ink, lw: 12 });
    },
  };
}

export const hotPotato: Entry<S> = {
  def: {
    id: "hot-potato",
    num: 130,
    name: { en: "Hot Potato", pt: "Batata Quente" },
    verb: { en: "PASS IT!", pt: "PASSA!" },
    hint: { pointer: "tap" },
    category: "timing",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Coworkers around a meeting table. The potato in your hands heats up (a fuse ring). Some coworkers look at you with hands ready, others stare at their phones. Tap one who is LOOKING to pass it; they toss it back a moment later. Harder levels: more coworkers, shorter glances.",
    winText: "Make 3 good passes.",
    loseText: "Throw it at someone on their phone, let the fuse run out in your hands, or run out of time.",
    timeScale: 1.2,
    minTime: 3.4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.15 || s.where !== "you" || io.isDown) return;
          // escolhe quem ainda vai olhar por um bom tempo
          let best = -1;
          s.mates.forEach((m, i) => {
            if (m.looking && m.timer > 0.05 && (best < 0 || m.timer > s.mates[best].timer)) best = i;
          });
          if (best < 0) return;
          const m = s.mates[best];
          io.tap(m.x, m.y - 130 * s.scale);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.5 || s.where !== "you" || io.isDown) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const i = s.mates.findIndex((x) => !x.looking && x.timer > 0.1);
          if (i < 0) return;
          io.tap(s.mates[i].x, s.mates[i].y - 130 * s.scale);
          m.done = true;
        },
      }
    : null,
};
