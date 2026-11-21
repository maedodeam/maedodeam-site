// 227 · NAME? — três colegas se apresentam com crachá por um instante. Depois um deles volta sem crachá:
// escolha o nome dele entre os cartões (toque ou 1..N).
// Níveis altos: quatro colegas (a partir de 0,5), menos tempo para olhar e (a partir de 1) roupas parecidas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, speech } from "../../gfx/art.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait, fitText, ease } from "./util.ts";

interface Mate {
  name: string;
  shirt: string;
  hair: string;
  glasses: boolean;
  hat: string | null;
  tie: string | null;
}
interface S {
  mates: Mate[];
  target: number;
  options: number[];
  answer: number;
  phase: "show" | "ask";
  showT: number;
  askT: number;
  choices: Choices;
  picked: number | null;
  t: number;
}

const NAMES = ["ANA", "BOB", "LIA", "MAX", "NINA", "OTTO", "RITA", "TOM", "KIM", "LEO", "BIA", "IVO", "EVA", "GUS"];
const SHIRTS = [C.blue, C.green, C.purple, C.orange, C.pink, C.teal, C.yellow, C.red];
const HAIRS = [C.ink2, C.brown, C.yellow, C.orange, C.gray, C.paper];
const HATS = [C.red, C.blue, C.green, C.purple];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const N = lv < 0.5 ? 3 : 4;
  const names = rng.shuffle(NAMES).slice(0, N);
  const shirts = rng.shuffle(SHIRTS);
  const hairs = rng.shuffle(HAIRS);
  const mates: Mate[] = names.map((name, i) => ({
    name,
    shirt: shirts[i],
    hair: hairs[i % hairs.length],
    glasses: rng.chance(0.5),
    hat: rng.chance(0.3) ? rng.pick(HATS) : null,
    tie: rng.chance(0.5) ? rng.pick([C.red, C.ink2, C.yellow]) : null,
  }));
  // A partir do nível 1: dois colegas com a mesma camisa (o cabelo/óculos é que diferencia).
  if (lv >= 1) {
    mates[1].shirt = mates[0].shirt;
    mates[1].glasses = !mates[0].glasses;
    if (mates[1].hair === mates[0].hair) mates[1].hair = hairs[(N + 1) % hairs.length];
  }
  const target = rng.int(0, N - 1);
  const options = rng.shuffle(Array.from({ length: N }, (_, i) => i));
  const s: S = {
    mates,
    target,
    options,
    answer: options.indexOf(target),
    phase: "show",
    showT: 1.4 - lv * 0.26,
    askT: 0,
    choices: new Choices(api, N, {
      area: portrait ? { x: 70, y: h * 0.62, w: w - 140, h: h * 0.3 } : { x: w * 0.08, y: h * 0.64, w: w * 0.84, h: h * 0.28 },
      maxCols: portrait ? 2 : 4,
    }),
    picked: null,
    t: 0,
  };

  const draw1 = (g: Gfx, m: Mate, x: number, y: number, sc: number, mood: "neutral" | "happy" | "angry" | "shock") => {
    g.shadow(x, y, 60 * sc);
    person(g, x, y, sc, { shirt: m.shirt, hair: m.hair, glasses: m.glasses, hat: m.hat, tie: m.tie, mood });
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.phase === "ask") s.askT += dt;
      if (api.result) return;
      if (s.phase === "show" && s.t >= s.showT) {
        s.phase = "ask";
        api.sfx("swoosh");
      }
      if (s.phase !== "ask") return;
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("coin");
        api.fx.burst(c.x, c.y, C.green, 14);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // parede do escritório + rodapé
      const floorY = portrait ? h * 0.66 : h * 0.8;
      g.rect(-10, floorY, w + 20, h - floorY + 10, C.brown2, { stroke: null });
      g.line(0, floorY, w, floorY, C.ink, 7);
      if (s.phase === "show") {
        g.text(api.t({ en: "HI, I'M…", pt: "OI, EU SOU…" }), w / 2, portrait ? h * 0.12 : h * 0.1, { size: 70, color: C.ink });
        const sp = w / N;
        const sc = Math.min(1.6, sp / 150);
        const fy = portrait ? h * 0.52 : h * 0.66;
        for (let i = 0; i < N; i++) {
          const x = sp * (i + 0.5);
          draw1(g, s.mates[i], x, fy, sc, "happy");
          const tw = Math.min(sp - 30, 230);
          g.rect(x - tw / 2 + 6, fy + 36, tw, 84, C.ink, { r: 14, stroke: null });
          g.rect(x - tw / 2, fy + 28, tw, 84, C.white, { r: 14, lw: 6 });
          g.rect(x - tw / 2, fy + 28, tw, 22, C.red, { r: 8, lw: 6 });
          fitText(g, s.mates[i].name, x, fy + 84, tw - 24, { size: 54, color: C.ink });
        }
        // barra do tempo para olhar
        const k = Math.max(0, 1 - s.t / s.showT);
        const bw = Math.min(600, w * 0.6);
        const by = portrait ? h * 0.86 : h * 0.9;
        g.rect(w / 2 - bw / 2, by, bw, 26, C.white, { r: 13, lw: 5 });
        g.rect(w / 2 - bw / 2, by, bw * k, 26, C.orange, { r: 13, stroke: null });
        return;
      }
      // pergunta: um deles volta sem crachá
      const m = s.mates[s.target];
      const sc = portrait ? 1.8 : 1.35;
      const slide = ease(s.askT / 0.22);
      const fy = (portrait ? h * 0.52 : h * 0.58) + (1 - slide) * 300;
      const tx = w / 2;
      const mood = api.result === "win" ? "happy" : api.result === "lose" ? "angry" : "neutral";
      draw1(g, m, tx, fy, sc, mood);
      // crachá em branco
      g.rect(tx - 70, fy - 125 * sc, 140, 70, C.white, { r: 10, lw: 6 });
      g.text(api.result === "win" ? m.name : "???", tx, fy - 125 * sc + 37, { size: 44, color: api.result === "win" ? C.green : C.gray2 });
      if (api.result === "lose") {
        speech(g, tx, fy - 260 * sc - 40, api.t({ en: `I'M ${m.name}!`, pt: `EU SOU ${m.name}!` }), 52, 0);
      } else if (!api.result) {
        g.text(api.t({ en: "WHO'S THIS?", pt: "QUEM É?" }), tx, fy - 260 * sc - 30, { size: 70, color: C.ink });
      }
      s.choices.draw(
        g,
        (i, r) => {
          fitText(g, s.mates[s.options[i]].name, r.x + r.w / 2, r.y + r.h / 2 + 4, r.w - 40, { size: Math.min(r.h * 0.5, 110), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const nameFace: Entry<S> = {
  def: {
    id: "name-face",
    num: 227,
    name: { en: "Name That Face", pt: "Qual É o Nome?" },
    verb: { en: "NAME?", pt: "NOME?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "memory",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Three coworkers introduce themselves with name tags for a moment. Then one comes back without the tag: pick their name. Later there are four coworkers, less time to look, and two of them wear the same shirt.",
    winText: "Pick the right name for the face.",
    loseText: "Pick the wrong name, or run out of time.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "ask" || s.askT < 0.15 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "ask" || s.askT < 0.15 || io.isDown) return;
          const c = s.choices.center((s.answer + 1) % s.options.length);
          io.tap(c.x, c.y);
        },
      }
    : null,
};
