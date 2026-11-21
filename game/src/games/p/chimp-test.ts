// 226 · IN ORDER! — números de 1 a N aparecem espalhados por um instante e viram quadrados brancos.
// Toque os quadrados na ordem 1 → N, de memória. Tocar o 1 antes do tempo já esconde o resto (como no teste do chimpanzé).
// Níveis altos: mais números (5 a partir de 0,5; 6 a partir de 1) e menos tempo para olhar.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Box {
  x: number;
  y: number;
  n: number;
  done: boolean;
  /** Tempo desde que foi acertado (animação). */
  pop: number;
}
interface S {
  boxes: Box[];
  N: number;
  next: number;
  showT: number;
  hidden: boolean;
  half: number;
  wrong: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const N = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const half = portrait ? 92 : 86;
  // grade de casas livres para os números não se sobreporem
  const ax = 110;
  const ay = portrait ? 260 : 180;
  const aw = w - 220;
  const ah = h - ay - (portrait ? 220 : 110);
  const cell = 240;
  const cols = Math.max(3, Math.floor(aw / cell));
  const rows = Math.max(2, Math.floor(ah / cell));
  const cw = aw / cols;
  const ch = ah / rows;
  const picks = rng.sample(cols * rows, N);
  const boxes: Box[] = picks.map((k, i) => {
    const c = k % cols;
    const r = Math.floor(k / cols);
    const jx = Math.max(0, cw / 2 - half - 14);
    const jy = Math.max(0, ch / 2 - half - 14);
    return { x: ax + c * cw + cw / 2 + rng.range(-jx, jx), y: ay + r * ch + ch / 2 + rng.range(-jy, jy), n: i + 1, done: false, pop: 0 };
  });
  const s: S = { boxes, N, next: 1, showT: 1.0 - lv * 0.27, hidden: false, half, wrong: -1, t: 0, endT: 0 };

  const hit = (x: number, y: number): Box | null => {
    let best: Box | null = null;
    let bd = Infinity;
    for (const b of s.boxes) {
      if (b.done) continue;
      const d = Math.max(Math.abs(x - b.x), Math.abs(y - b.y));
      if (d <= half + 22 && d < bd) {
        best = b;
        bd = d;
      }
    }
    return best;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const b of s.boxes) if (b.done) b.pop += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (!s.hidden && s.t >= s.showT) {
        s.hidden = true;
        api.sfx("swoosh");
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const b = hit(inp.x, inp.y);
      if (!b) return;
      if (b.n === s.next) {
        b.done = true;
        s.next++;
        // tocar o 1 já esconde os outros
        if (!s.hidden) s.hidden = true;
        api.sfx("pop");
        api.fx.burst(b.x, b.y, C.yellow, 8);
        if (s.next > s.N) {
          api.sfx("chime");
          api.fx.pop(w / 2, portrait ? 170 : 110, api.t({ en: "GENIUS!", pt: "GÊNIO!" }), C.green);
          api.win();
        }
      } else {
        s.wrong = b.n;
        s.hidden = true;
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(b.x, b.y - half - 40, api.t({ en: "NOPE", pt: "ERROU" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // grade de laboratório ao fundo
      g.push();
      g.alpha(0.12);
      for (let x = 0; x < w; x += 80) g.line(x, 0, x, h, C.sky, 3);
      for (let y = 0; y < h; y += 80) g.line(0, y, w, y, C.sky, 3);
      g.pop();
      // placar de progresso
      const py = portrait ? 170 : 100;
      for (let i = 0; i < s.N; i++) {
        const x = w / 2 + (i - (s.N - 1) / 2) * 70;
        g.circle(x, py, 22, i < s.next - 1 ? C.green : C.ink2, { lw: 5, stroke: C.sky });
      }
      const reveal = api.result === "lose";
      for (const b of s.boxes) {
        if (b.done) {
          // acertado: pisca e encolhe
          const k = Math.max(0, 1 - b.pop * 4);
          if (k > 0) g.rectC(b.x, b.y, s.half * 2 * k, s.half * 2 * k, C.green, { r: 20 });
          if (api.result === "win") g.text(String(b.n), b.x, b.y + 4, { size: 70, color: C.green2 });
          continue;
        }
        const showNum = !s.hidden || reveal;
        const wrong = reveal && b.n === s.wrong;
        g.rect(b.x - s.half + 8, b.y - s.half + 12, s.half * 2, s.half * 2, C.ink, { r: 22, stroke: null });
        const fill = wrong ? C.red : s.hidden && !reveal ? C.white : C.ink2;
        g.rectC(b.x, b.y, s.half * 2, s.half * 2, fill, { r: 22, lw: 8, stroke: s.hidden && !reveal ? C.ink : C.white });
        if (showNum) g.text(String(b.n), b.x, b.y + 6, { size: 120, color: wrong ? C.white : reveal && b.n === s.next ? C.yellow : C.white });
      }
      // barra do tempo de olhar
      if (!s.hidden && !api.result) {
        const k = Math.max(0, 1 - s.t / s.showT);
        const bw = Math.min(600, w * 0.6);
        g.rect(w / 2 - bw / 2, h - 70, bw, 26, C.ink2, { r: 13, lw: 5, stroke: C.sky });
        g.rect(w / 2 - bw / 2, h - 70, bw * k, 26, C.yellow, { r: 13, stroke: null });
      }
      if (api.result === "lose") g.text(api.t({ en: "WRONG ORDER", pt: "ORDEM ERRADA" }), w / 2, h - 60, { size: 70, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const chimpTest: Entry<S> = {
  def: {
    id: "chimp-test",
    num: 226,
    name: { en: "Number Memory", pt: "Memória dos Números" },
    verb: { en: "IN ORDER!", pt: "EM ORDEM!" },
    hint: { pointer: "tap" },
    category: "memory",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Numbers 1 to 4 flash at random spots, then turn into blank squares. Tap the squares in order from memory; tapping 1 early hides the rest. Later there are 5 or 6 numbers and less time to look.",
    winText: "Tap every square in order 1 → N.",
    loseText: "Tap a square out of order, or run out of time.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time < m.next || io.isDown) return;
          const b = s.boxes.find((x) => x.n === s.next);
          if (b) {
            io.tap(b.x, b.y);
            m.next = api.time + 0.18;
          }
        },
        lose(s, api, io) {
          // Lembra do 1, mas troca a ordem do resto.
          if (api.result || !s.hidden) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time < m.next || io.isDown) return;
          const want = s.next === 1 ? 1 : s.next + 1;
          const b = s.boxes.find((x) => x.n === want) ?? s.boxes.find((x) => !x.done && x.n !== s.next);
          if (b) {
            io.tap(b.x, b.y);
            m.next = api.time + 0.2;
          }
        },
      }
    : null,
};
