// 101 · SQUEEZE! — cachorros-quentes passam numa esteira debaixo do frasco de ketchup. Segure para espremer:
// cada cachorro-quente precisa de 70% de ketchup; o que cai na esteira vazia enche o medidor de SUJEIRA.
// Nos níveis altos a esteira corre mais, os vãos encolhem e aparece uma bandeja de batata que não pode levar ketchup.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { bigText, checkMark, crossMark, isPortrait, meter, pips } from "./util.ts";

interface Item {
  kind: "dog" | "fries";
  /** Distância (na esteira) da frente do item até o bico no instante 0. */
  d0: number;
  len: number;
  cov: number;
  done: boolean;
}
interface S {
  bx: number;
  beltY: number;
  v: number;
  items: Item[];
  strips: [number, number][];
  squeezing: boolean;
  wasSqueezing: boolean;
  mess: number;
  messMax: number;
  need: number;
  t: number;
  endT: number;
  why: "" | "mess" | "naked" | "fries";
}

const NEED = 0.7;
/** Ampliação da cena no retrato. */
const ZOOM = 1.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const T = api.duration;
  const nDogs = lv < 0.5 ? 3 : 4;
  const L = 220;
  const G = 230 - 80 * lv;
  const fries = lv >= 1;
  const kinds: ("dog" | "fries")[] = [];
  for (let i = 0; i < nDogs; i++) {
    kinds.push("dog");
    if (fries && i === 1) kinds.push("fries");
  }
  const lens = kinds.map((k) => (k === "dog" ? L : 170));
  const layout = lens.reduce((a, b) => a + b, 0) + G * (kinds.length - 1);
  const v = Math.max(260 + 160 * lv, layout / Math.max(1, T - 1.25));
  let d = v * 0.8;
  const items: Item[] = kinds.map((kind, i) => {
    const it: Item = { kind, d0: d, len: lens[i], cov: 0, done: false };
    d += lens[i] + G;
    return it;
  });
  const s: S = {
    bx: portrait ? w * 0.64 : w * 0.56,
    beltY: portrait ? h * 0.63 : h * 0.66,
    v,
    items,
    strips: [],
    squeezing: false,
    wasSqueezing: false,
    mess: 0,
    messMax: 170 - 40 * lv,
    need: nDogs,
    t: 0,
    endT: 0,
    why: "",
  };
  const covered = () => s.items.filter((it) => it.kind === "dog" && it.cov >= NEED * it.len).length;

  return {
    s,
    update(dt) {
      if (api.result) {
        s.endT += dt;
        s.squeezing = false;
        return;
      }
      s.t += dt;
      const inp = api.input;
      s.squeezing = inp.action;
      const dd = s.v * s.t;
      if (s.squeezing) {
        if (!s.wasSqueezing) {
          s.strips.push([dd, dd]);
          api.sfx("squeak");
        } else s.strips[s.strips.length - 1][1] = dd;
        const it = s.items.find((q) => dd >= q.d0 && dd <= q.d0 + q.len);
        if (it && it.kind === "fries") {
          s.why = "fries";
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.fx.pop(s.bx, s.beltY - 200, api.t({ en: "NOT THE FRIES!", pt: "A BATATA NÃO!" }), C.yellow);
          api.lose();
          return;
        }
        if (it) {
          const before = it.cov >= NEED * it.len;
          it.cov += s.v * dt;
          if (!before && it.cov >= NEED * it.len) {
            api.sfx("pop");
            api.fx.burst(s.bx, s.beltY - 40, C.red, 10);
            if (covered() >= s.need) {
              api.sfx("chime");
              api.win();
              return;
            }
          }
        } else {
          s.mess += s.v * dt;
          if (s.mess >= s.messMax) {
            s.why = "mess";
            api.sfx("splash");
            api.fx.shake(0.7);
            api.fx.pop(s.bx, s.beltY - 200, api.t({ en: "WHAT A MESS!", pt: "QUE SUJEIRA!" }), C.red);
            api.lose();
            return;
          }
        }
      }
      s.wasSqueezing = s.squeezing;
      // cachorro-quente que passou pelado
      for (const it of s.items) {
        if (it.kind !== "dog" || it.done || dd <= it.d0 + it.len) continue;
        it.done = true;
        if (it.cov < NEED * it.len) {
          s.why = "naked";
          api.sfx("buzz");
          api.fx.pop(s.bx - 200, s.beltY - 200, api.t({ en: "NAKED HOTDOG!", pt: "CACHORRO PELADO!" }), C.yellow);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      const by = s.beltY;
      const vt = s.v * s.t;
      const X = (dd: number) => s.bx - dd + vt;
      // parede de lanchonete: azulejos
      for (let y = 0; y < (portrait ? h : by - 140); y += 120) for (let x = (y / 120) % 2 ? -60 : 0; x < w; x += 120) g.rect(x + 6, y + 6, 108, 108, "#ffd9c2", { stroke: null, r: 8 });
      // cozinheiro ao fundo, torcendo
      const cookMood = api.result === "lose" ? "shock" : "happy";
      if (!portrait) person(g, w * 0.13, by - 40, 1.25, { shirt: C.white, tie: null, hat: C.white, mood: cookMood, look: { x: 1, y: 0.3 } });
      else person(g, w * 0.16, by - 10, 1.5, { shirt: C.white, tie: null, hat: C.white, mood: cookMood, look: { x: 1, y: 0.3 } });
      // no retrato, a cena (esteira, itens e frasco) é ampliada em volta do bico para ocupar a tela
      g.push();
      if (portrait) {
        g.translate(s.bx, by);
        g.scale(ZOOM);
        g.translate(-s.bx, -by);
      }
      // esteira
      g.rect(-10, by, w + 20, 70, C.gray2, { lw: 7 });
      for (let x = -((vt * 1) % 80); x < w + 80; x += 80) g.line(x + 80, by + 8, x + 40, by + 62, C.ink2, 6);
      g.rect(-10, by + 70, w + 20, 40, C.ink2, { stroke: null });
      for (let x = 40; x < w; x += 160) {
        g.circle(x, by + 90, 22, C.gray, { lw: 5 });
        const a = vt / 22;
        g.line(x, by + 90, x + Math.cos(a) * 18, by + 90 + Math.sin(a) * 18, C.ink, 4);
      }
      g.rect(-10, by + 110, w + 20, h - by, C.brown, { lw: 7 });
      // ketchup na esteira vazia (por baixo dos itens)
      for (const [a, b] of s.strips) {
        const x1 = X(b);
        const x0 = X(a);
        if (x0 < -50 || x1 > w + 50) continue;
        g.rect(x1 - 6, by - 8, Math.max(12, x0 - x1 + 12), 16, C.red, { r: 8, lw: 4 });
      }
      // itens
      for (const it of s.items) {
        const xr = X(it.d0);
        const xl = X(it.d0 + it.len);
        if (xr < -40 || xl > w + 40) continue;
        const cx = (xl + xr) / 2;
        if (it.kind === "fries") {
          g.rect(xl, by - 70, it.len, 70, C.red, { r: 10 });
          for (let i = 0; i < 7; i++) g.rect(xl + 14 + i * ((it.len - 40) / 6), by - 130 + (i % 3) * 12, 16, 80, C.yellow, { r: 5, lw: 4 });
          g.rect(xl, by - 70, it.len, 70, C.red, { r: 10 });
          g.rect(xl + 20, by - 50, it.len - 40, 14, C.white, { r: 6, stroke: null });
          continue;
        }
        // pão + salsicha
        g.rect(xl, by - 58, it.len, 58, C.brown2, { r: 28 });
        g.rect(xl - 12, by - 82, it.len + 24, 40, "#c8553d", { r: 20 });
        g.rect(xl + 6, by - 40, it.len - 12, 34, C.yellow2, { r: 17, lw: 5 });
        // ketchup por cima da salsicha (em zigue-zague)
        for (const [a, b] of s.strips) {
          const lo = Math.max(a, it.d0);
          const hi = Math.min(b, it.d0 + it.len);
          if (hi <= lo) continue;
          const pts = [];
          const steps = Math.max(2, Math.ceil((hi - lo) / 16));
          for (let i = 0; i <= steps; i++) {
            const dd = lo + ((hi - lo) * i) / steps;
            pts.push({ x: X(dd), y: by - 64 + (i % 2 ? -9 : 9) });
          }
          g.polyline(pts, C.ink, 20);
          g.polyline(pts, C.red, 12);
        }
        if (it.cov >= NEED * it.len) checkMark(g, cx, by - 150, 40);
        else if (it.done) crossMark(g, cx, by - 150, 40);
      }
      // frasco
      const ny = by - 150;
      const sq = s.squeezing ? 0.84 : 1;
      if (s.squeezing && !api.result) {
        g.rect(s.bx - 9, ny, 18, by - 70 - ny, C.red, { r: 9, lw: 4 });
      }
      g.push();
      g.translate(s.bx, ny);
      g.shape(0, 0, [-14, 0, 14, 0, 40, -70, -40, -70], C.white);
      g.scale(sq, 1);
      g.rect(-90, -330, 180, 270, C.red, { r: 50 });
      g.rect(-62, -250, 124, 90, C.white, { r: 14, lw: 5 });
      g.pop();
      g.text("KETCHUP", s.bx, ny - 205, { size: 34, color: C.red, maxWidth: 110 * sq });
      // mãos apertando
      for (const sx of [-1, 1]) {
        const hx = s.bx + sx * (88 * sq + 26);
        g.rect(hx - 28, ny - 280, 56, 150, C.skin, { r: 26 });
        g.line(hx - sx * 26, ny - 250, hx - sx * 26, ny - 160, C.skin2, 6);
      }
      g.pop();
      // painel: sujeira e progresso (no retrato, embaixo, no chão da lanchonete)
      const messK = s.mess / s.messMax;
      const messCol = messK > 0.7 ? C.red : C.orange;
      if (portrait) {
        const py = h * 0.84;
        g.text(api.t({ en: "MESS", pt: "SUJEIRA" }), 60, py + 36, { size: 56, align: "left", color: C.white, stroke: C.ink, lw: 10 });
        const lx = api.lang === "pt" ? 320 : 230;
        meter(g, lx, py, w - lx - 60, 72, messK, messCol);
        pips(g, w / 2, h * 0.93, s.need, covered(), 30, C.red);
      } else {
        const px = w * 0.06;
        const py = 60;
        g.text(api.t({ en: "MESS", pt: "SUJEIRA" }), px, py + 30, { size: 44, align: "left", color: C.ink });
        meter(g, px + (api.lang === "pt" ? 190 : 140), py, 460, 60, messK, messCol);
        pips(g, w * 0.82, py + 30, s.need, covered(), 22, C.red);
      }
      if (api.result === "win") bigText(g, api.t({ en: "YUM!", pt: "DELÍCIA!" }), w / 2, portrait ? h * 0.14 : by - 460 > 120 ? by - 460 : 200, 120, C.yellow);
      if (api.result === "lose" && s.why === "") bigText(g, api.t({ en: "TOO SLOW!", pt: "DEVAGAR!" }), w / 2, 260, 100, C.red);
    },
  };
}

export const ketchupLine: Entry<S> = {
  def: {
    id: "ketchup-line",
    num: 101,
    name: { en: "Ketchup Line", pt: "Linha de Ketchup" },
    verb: { en: "SQUEEZE!", pt: "ESPREME!" },
    hint: { pointer: "hold", keys: "space" },
    category: "precision",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Hotdogs ride a conveyor under a ketchup bottle. Hold (or hold Space) to squeeze: each hotdog needs at least 70% of its length covered, and ketchup on the bare belt fills a MESS meter. Later the belt is faster, the gaps are smaller and a fries tray must not get any ketchup.",
    winText: "Cover every hotdog with ketchup.",
    loseText: "The mess meter fills, a hotdog passes with too little ketchup, the fries get ketchup, or time runs out.",
    timeScale: 1.6,
    minTime: 4.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const dn = s.v * (s.t + dt);
          const want = s.items.some((it) => it.kind === "dog" && dn >= it.d0 + 0.1 * it.len && dn <= it.d0 + 0.9 * it.len);
          if (want && !io.isDown) io.down(s.bx, s.beltY + 200);
          else if (!want && io.isDown) io.up(s.bx, s.beltY + 200);
        },
        lose(s, api, io) {
          // aperta sem parar desde o começo: suja a esteira
          if (api.result || api.time < 0.2) return;
          if (!io.isDown) io.down(s.bx, s.beltY + 200);
        },
      }
    : null,
};
