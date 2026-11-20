// 045 · WHO WAS IT? — alguém passa correndo e leva o último pedaço de bolo. Depois, aponte o culpado na fileira.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Look {
  shirt: number;
  hair: number;
  glasses: number;
  hat: number;
  tie: number;
}
interface S {
  thief: Look;
  suspects: Look[];
  culprit: number;
  showDur: number;
  phase: "show" | "pick";
  clock: number;
  pickedAt: number;
  picked: number;
  focus: number;
  sp: number;
  scale: number;
  feetY: number;
  pos: { x: number; y: number }[];
}

const SHIRTS = [C.red, C.blue, C.green, C.yellow, C.purple];
const HAIRS = [C.ink2, C.brown, C.yellow2, C.orange];
const HATS = [null, C.blue2, C.red];
const TIES = [null, C.ink2, C.orange];
const ATTRS: (keyof Look)[] = ["shirt", "hair", "glasses", "hat", "tie"];
const COUNT: Record<keyof Look, number> = { shirt: SHIRTS.length, hair: HAIRS.length, glasses: 2, hat: HATS.length, tie: TIES.length };

const same = (a: Look, b: Look) => ATTRS.every((k) => a[k] === b[k]);

function drawLook(g: Gfx, l: Look, x: number, y: number, s: number, mood: "neutral" | "happy" | "sad" | "shock" | "smug" | "worried", walk?: number, tilt = 0): void {
  person(g, x, y, s, {
    shirt: SHIRTS[l.shirt],
    hair: HAIRS[l.hair],
    glasses: l.glasses === 1,
    hat: HATS[l.hat],
    tie: TIES[l.tie],
    mood,
    walk,
    tilt,
  });
}

function cakeSlice(g: Gfx, x: number, y: number, s: number): void {
  g.push();
  g.translate(x, y);
  g.scale(s);
  g.shape(0, 0, [-34, 18, 34, 18, 30, -10, -6, -26], C.yellow2);
  g.shape(0, 0, [-34, 2, 32, 2, 30, -10, -6, -26], C.pink, { lw: 5 });
  g.circle(-2, -30, 9, C.red, { lw: 4 });
  g.pop();
}

/** O ladrão entra depois que a instrução sai do centro da tela. */
const LEAD = 0.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const n = lv < 0.6 ? 3 : 4;
  const thief: Look = { shirt: rng.int(0, 4), hair: rng.int(0, 3), glasses: rng.int(0, 1), hat: rng.int(0, 2), tie: rng.int(0, 2) };
  const suspects: Look[] = [{ ...thief }];
  let guard = 0;
  while (suspects.length < n && guard++ < 200) {
    const d: Look = { ...thief };
    const changes = lv >= 1 ? 1 : rng.chance(0.5) ? 1 : 2;
    for (const k of rng.shuffle(ATTRS).slice(0, changes)) d[k] = (d[k] + rng.int(1, COUNT[k] - 1)) % COUNT[k];
    if (!suspects.some((q) => same(q, d))) suspects.push(d);
  }
  const order = rng.shuffle(suspects);
  const culprit = order.findIndex((q) => same(q, thief));
  // Posições: uma fileira (paisagem/quadrado); em retrato com 4 suspeitos, duas fileiras de 2.
  const twoRows = portrait && n === 4;
  const perRow = twoRows ? 2 : n;
  const sp = Math.min(420, (w - 100) / perRow);
  const scale = Math.min(portrait ? 2.1 : 2.0, sp / 150, twoRows ? 1.85 : 9);
  const rowFeet = twoRows ? [h * 0.5, h * 0.88] : [portrait ? h * 0.7 : h * 0.86];
  const pos = order.map((_, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    return { x: w / 2 + (c - (perRow - 1) / 2) * sp, y: rowFeet[r] };
  });
  const s: S = {
    thief,
    suspects: order,
    culprit,
    showDur: mix(0.9, 0.6, p),
    phase: "show",
    clock: 0,
    pickedAt: -1,
    picked: -1,
    focus: -1,
    sp,
    scale,
    feetY: portrait ? h * 0.68 : h * 0.86,
    pos,
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (s.phase === "show") {
        if (api.time >= LEAD + s.showDur + 0.15) {
          s.phase = "pick";
          api.sfx("drum");
        }
        return;
      }
      if (api.result) return;
      const inp = api.input;
      let i: number | null = null;
      if (inp.pressed) {
        for (let k = 0; k < s.pos.length; k++) {
          const q = s.pos[k];
          if (Math.abs(inp.x - q.x) < s.sp / 2 && inp.y < q.y + 100 && inp.y > q.y - 320 * s.scale) i = k;
        }
      }
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.pos.length) i = inp.digit - 1;
      const nSus = s.pos.length;
      if (inp.keyPressed("right") || inp.keyPressed("down")) s.focus = (s.focus + 1 + nSus) % nSus;
      if (inp.keyPressed("left") || inp.keyPressed("up")) s.focus = (s.focus - 1 + nSus * 2) % nSus;
      if (inp.keyPressed("action") && s.focus >= 0) i = s.focus;
      if (i !== null) {
        api.sfx("click");
        s.picked = i;
        s.pickedAt = s.clock;
        if (i === s.culprit) {
          api.sfx("chime");
          api.fx.burst(s.pos[i].x, s.pos[i].y - 250 * s.scale, C.yellow, 22);
          api.fx.pop(s.pos[i].x, s.pos[i].y - 200 * s.scale, api.t({ en: "GOTCHA!", pt: "PEGUEI!" }), C.yellow);
          api.win();
        } else {
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.fx.pop(s.pos[i].x, s.pos[i].y - 200 * s.scale, api.t({ en: "NOT ME!", pt: "NÃO FUI EU!" }), C.white);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      const sc = s.scale;
      if (s.phase === "show") {
        // copa do escritório: mesa com o prato do bolo; o ladrão passa correndo
        g.clear(BG.peach);
        g.rect(-10, s.feetY, w + 20, h, C.paper2);
        g.line(0, s.feetY, w, s.feetY, C.ink, 7);
        g.rect(w * 0.1, h * 0.12, 260, 200, C.sky, { r: 10 });
        const tableY = s.feetY - 150;
        g.rect(w / 2 - 230, tableY, 460, 28, C.brown, { r: 8 });
        g.line(w / 2 - 190, tableY + 28, w / 2 - 190, s.feetY, C.ink, 14);
        g.line(w / 2 + 190, tableY + 28, w / 2 + 190, s.feetY, C.ink, 14);
        g.ellipse(w / 2, tableY - 6, 120, 22, C.white);
        const u = Math.max(0, Math.min(1, (api.time - LEAD) / s.showDur));
        const k = 2 * u - 1;
        const x = w / 2 + Math.sign(k) * Math.abs(k) ** 3 * (w * 0.5 + 200);
        if (u < 0.5) cakeSlice(g, w / 2, tableY - 34, 1.6);
        else g.text(api.t({ en: "HEY!", pt: "EI!" }), w / 2, tableY - 90, { size: 90, color: C.white, stroke: C.ink, lw: 14 });
        // linhas de velocidade
        for (let i = 0; i < 4; i++) g.line(x - 120 * sc - i * 30, s.feetY - (80 + i * 55) * sc, x - 220 * sc - i * 50, s.feetY - (80 + i * 55) * sc, C.white, 8);
        drawLook(g, s.thief, x, s.feetY, 2.1, "smug", (s.clock * 3) % 1, 0.18);
        if (u >= 0.5) cakeSlice(g, x + 120, s.feetY - 300, 1.6);
        return;
      }
      // fileira de suspeitos com régua de altura
      g.clear(BG.lilac);
      const top = s.pos[0].y - 330 * sc;
      const rows = [...new Set(s.pos.map((q) => q.y))];
      for (const fy of rows) {
        for (let i = 0; i <= 6; i++) {
          const y = fy - i * 50 * sc;
          g.line(40, y, w - 40, y, C.purple, 5);
          if (i % 2 === 0) g.text(`${(i * 0.3).toFixed(1)}m`, 90, y - 18, { size: 30, font: "mono", color: C.purple });
        }
        g.rect(-10, fy, w + 20, 130, C.gray2);
      }
      g.text(api.t({ en: "WHO ATE THE CAKE?", pt: "QUEM COMEU O BOLO?" }), w / 2, Math.max(80, top - 60), { size: 76, color: C.white, stroke: C.ink, lw: 14 });
      const done = api.result !== null;
      for (let i = 0; i < s.suspects.length; i++) {
        const x = s.pos[i].x;
        const fy = s.pos[i].y;
        const isCulprit = i === s.culprit;
        let mood: "neutral" | "happy" | "sad" | "shock" | "smug" | "worried" = "neutral";
        let hop = 0;
        if (done) {
          const at = s.clock - s.pickedAt;
          if (s.picked === i) mood = isCulprit ? "shock" : "sad";
          else if (isCulprit) {
            mood = "smug";
            hop = Math.abs(Math.sin(at * 12)) * 20;
          } else mood = "happy";
        } else if (s.focus === i) mood = "worried";
        drawLook(g, s.suspects[i], x, fy - hop, sc, mood);
        if (done && isCulprit) {
          // migalhas e o pedaço escondido aparecem
          cakeSlice(g, x + 58 * sc, fy - 95 * sc - hop, 0.9 * sc);
          g.circle(x - 10 * sc, fy - 150 * sc - hop, 5 * sc, C.yellow2, { lw: 3 });
          g.circle(x + 14 * sc, fy - 156 * sc - hop, 4 * sc, C.yellow2, { lw: 3 });
        }
        // placa numerada
        const py = fy + 55;
        const sel = done && s.picked === i;
        g.rect(x - 60, py - 38, 120, 76, sel ? (isCulprit ? C.green : C.red) : s.focus === i ? C.orange : C.ink2, { r: 10, lw: 6 });
        g.text(String(i + 1), x, py + 2, { size: 60, font: "mono", color: C.white });
      }
    },
  };
}

export const lineup: Entry<S> = {
  def: {
    id: "lineup",
    num: 45,
    name: { en: "Who Did It?", pt: "Quem Foi?" },
    verb: { en: "WHO WAS IT?", pt: "QUEM FOI?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "memory",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic: "Someone dashes through the office kitchen with the last slice of cake. Then a lineup of 3 or 4 look-alikes appears (shirt, hair, glasses, hat and tie vary). Point at the thief.",
    winText: "Pick the cake thief.",
    loseText: "Accuse an innocent coworker, or time runs out.",
    timeScale: 1.4,
    minTime: 3.4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (s.phase !== "pick" || api.result) return;
          const m = mem(s, () => ({ wait: 0.1 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          const c = s.pos[s.culprit];
          io.tap(c.x, c.y - 150 * s.scale);
          m.wait = 0.3;
        },
        lose(s, api, io) {
          if (s.phase !== "pick" || api.result) return;
          const c = s.pos[(s.culprit + 1) % s.suspects.length];
          io.tap(c.x, c.y - 150 * s.scale);
        },
      }
    : null,
};
