// 073 · PAIR! — o varal do "achados e perdidos" do escritório: só existe um par de meias igual. Toque nas duas.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cloud } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";

const BASES = [C.red, C.blue, C.yellow, C.green, C.purple, C.pink];
const ACCENTS = [C.white, C.ink2, C.yellow, C.sky];
const PATTERNS = ["plain", "stripes", "dots", "diamonds"] as const;

interface Design {
  base: number;
  accent: number;
  pattern: number;
}
interface Sock {
  x: number;
  y: number;
  d: Design;
  tilt: number;
  phase: number;
}
interface S {
  socks: Sock[];
  pair: [number, number];
  sel: number;
  second: number;
  sw: number;
  lines: number[];
  t: number;
}

const key = (d: Design) => `${d.base}-${d.accent}-${d.pattern}`;
/** Combinações sem contraste (o desenho some). */
const bland = (d: Design) => (d.base === 2 && (d.accent === 2 || d.accent === 0)) || (d.base === 1 && d.accent === 3);

function sockPath(g: Gfx, sw: number): void {
  const c = g.ctx;
  const a = sw * 0.36;
  const H = sw * 1.5;
  const yF = H * 0.62;
  const r = sw * 0.24;
  const xT = sw * 0.62;
  c.beginPath();
  c.moveTo(-a, 0);
  c.lineTo(a, 0);
  c.lineTo(a, yF);
  c.lineTo(xT - r, yF);
  c.arc(xT - r, yF + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(-a + r, yF + 2 * r);
  c.arc(-a + r, yF + r, r, Math.PI / 2, Math.PI);
  c.closePath();
}

function drawSock(g: Gfx, sw: number, d: Design, t: number): void {
  const c = g.ctx;
  const base = BASES[d.base];
  const acc = ACCENTS[d.accent];
  const H = sw * 1.5;
  g.push();
  sockPath(g, sw);
  c.fillStyle = base;
  c.fill();
  c.clip();
  const p = PATTERNS[d.pattern];
  if (p === "stripes") {
    for (let y = sw * 0.3; y < H * 1.2; y += sw * 0.26) g.rect(-sw, y, sw * 2, sw * 0.11, acc, { stroke: null });
  } else if (p === "dots") {
    for (let y = sw * 0.32; y < H * 1.1; y += sw * 0.24)
      for (let x = -sw * 0.5; x < sw; x += sw * 0.24) g.circle(x + ((y / (sw * 0.24)) % 2) * sw * 0.12, y, sw * 0.055, acc, { stroke: null });
  } else if (p === "diamonds") {
    for (let y = sw * 0.42; y < H * 1.1; y += sw * 0.34)
      for (let x = -sw * 0.36; x < sw; x += sw * 0.36) g.shape(x, y, [0, -sw * 0.15, sw * 0.12, 0, 0, sw * 0.15, -sw * 0.12, 0], acc, { stroke: null });
  }
  // punho, calcanhar e ponta
  g.rect(-sw, 0, sw * 2, sw * 0.18, acc, { stroke: null });
  g.circle(-sw * 0.36 + sw * 0.05, H * 0.62 + sw * 0.43, sw * 0.2, acc, { stroke: null });
  g.circle(sw * 0.62, H * 0.62 + sw * 0.24, sw * 0.2, acc, { stroke: null });
  g.pop();
  sockPath(g, sw);
  c.strokeStyle = C.ink;
  c.lineWidth = 7;
  c.lineJoin = "round";
  c.stroke();
  g.line(-sw * 0.36, sw * 0.18, sw * 0.36, sw * 0.18, C.ink, 4);
  // prendedor
  g.rect(-sw * 0.09, -sw * 0.14 + Math.sin(t) * 0, sw * 0.18, sw * 0.3, C.brown2, { r: 6, lw: 5 });
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = Math.min(10, 6 + Math.round(lv * 2.7));
  const randDesign = (): Design => ({ base: rng.int(0, BASES.length - 1), accent: rng.int(0, ACCENTS.length - 1), pattern: rng.int(0, PATTERNS.length - 1) });
  let pairD = randDesign();
  while (bland(pairD)) pairD = randDesign();
  const designs: Design[] = [pairD, pairD];
  const used = new Set([key(pairD)]);
  const decoys = lv < 0.6 ? 0 : lv < 1.1 ? 2 : 3;
  let guard = 0;
  while (designs.length < n && guard++ < 500) {
    let d: Design;
    if (designs.length - 2 < decoys) {
      // quase igual ao par: muda um atributo só
      d = { ...pairD };
      const which = rng.int(0, 2);
      if (which === 0) d.base = rng.int(0, BASES.length - 1);
      else if (which === 1) d.accent = rng.int(0, ACCENTS.length - 1);
      else d.pattern = rng.int(0, PATTERNS.length - 1);
    } else d = randDesign();
    if (used.has(key(d)) || bland(d)) continue;
    used.add(key(d));
    designs.push(d);
  }
  const order = rng.shuffle(designs.map((_, i) => i));
  const perLine = portrait ? 3 : w > h * 1.3 ? (n <= 6 ? 6 : 5) : 4;
  const nLines = Math.ceil(n / perLine);
  const top = portrait ? h * 0.14 : h * 0.12;
  const bottom = portrait ? h * 0.94 : h * 0.95;
  const lineGap = (bottom - top) / nLines;
  const sw = Math.min((w - 140) / perLine * 0.62, lineGap / 1.65, 230);
  const lines: number[] = [];
  for (let l = 0; l < nLines; l++) lines.push(top + l * lineGap + sw * 0.12);
  const socks: Sock[] = order.map((di, k) => {
    const l = Math.floor(k / perLine);
    const inLine = Math.min(perLine, n - l * perLine);
    const col = k % perLine;
    const span = (w - 140) / perLine;
    const x = w / 2 + (col - (inLine - 1) / 2) * span - sw * 0.12;
    return { x, y: lines[l], d: designs[di], tilt: rng.range(-0.08, 0.08), phase: rng.range(0, 6) };
  });
  const pair: [number, number] = [order.indexOf(0), order.indexOf(1)];
  const s: S = { socks, pair, sel: -1, second: -1, sw, lines, t: 0 };

  const hit = (x: number, y: number): number => {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < s.socks.length; i++) {
      const k = s.socks[i];
      const cx = k.x + s.sw * 0.12;
      const cy = k.y + s.sw * 0.75;
      if (Math.abs(x - cx) < Math.max(s.sw * 0.62, 70) && Math.abs(y - cy) < Math.max(s.sw * 0.85, 75)) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    return best;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = hit(inp.x, inp.y);
      if (i < 0) return;
      if (s.sel < 0) {
        s.sel = i;
        api.sfx("tap");
        return;
      }
      if (s.sel === i) {
        s.sel = -1;
        api.sfx("click");
        return;
      }
      s.second = i;
      const a = s.socks[s.sel];
      const b = s.socks[i];
      if (key(a.d) === key(b.d)) {
        api.sfx("chime");
        api.fx.burst(b.x, b.y + s.sw * 0.7, BASES[b.d.base], 20);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.fx.pop(b.x, b.y, api.t({ en: "NOPE", pt: "NÃO" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      cloud(g, w * 0.2, h * 0.06, 1.2);
      cloud(g, w * 0.8, h * 0.08, 0.9);
      for (const ly of s.lines) {
        g.line(-10, ly - 14, w + 10, ly + 6, C.ink, 7);
        g.line(-10, ly - 14, w + 10, ly + 6, C.paper, 3);
      }
      for (let i = 0; i < s.socks.length; i++) {
        const k = s.socks[i];
        const chosen = i === s.sel || i === s.second;
        const isPair = i === s.pair[0] || i === s.pair[1];
        let lift = chosen ? -s.sw * 0.12 : 0;
        let rot = k.tilt + Math.sin(s.t * 2 + k.phase) * 0.04;
        if (api.result === "win" && isPair) {
          lift -= Math.sin(Math.min(1, s.t * 3) * Math.PI) * 0;
          rot += Math.sin(s.t * 18) * 0.15;
        }
        if (api.result === "lose" && chosen) rot += Math.sin(s.t * 30) * 0.08;
        g.push();
        g.translate(k.x, k.y + lift + (k.x / w) * 20);
        g.rotate(rot);
        if (chosen) {
          g.push();
          g.alpha(0.5);
          g.circle(s.sw * 0.12, s.sw * 0.75, s.sw * 0.95, api.result === "lose" ? C.red : C.yellow2, { stroke: null });
          g.pop();
        }
        drawSock(g, s.sw, k.d, s.t);
        g.pop();
      }
      if (api.result === "lose") {
        // mostra onde estava o par certo
        for (const i of s.pair) {
          const k = s.socks[i];
          g.circle(k.x + s.sw * 0.12, k.y + s.sw * 0.78, s.sw * 0.9, null, { stroke: C.green, lw: 10 });
        }
      }
    },
  };
}

export const sockPair: Entry<S> = {
  def: {
    id: "sock-pair",
    num: 73,
    name: { en: "Find the Pair", pt: "Acha o Par" },
    verb: { en: "PAIR!", pt: "PAREIA!" },
    hint: { pointer: "tap" },
    category: "puzzle",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "The office lost-and-found clothesline holds 6 to 10 socks with stripes, dots and diamonds; exactly one pair is identical. Tap both. At high levels some socks differ from the pair by a single detail.",
    winText: "Tap the two identical socks.",
    loseText: "The second sock does not match the first, or time runs out.",
    timeScale: 1.3,
    minTime: 3.2,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const i = s.sel === s.pair[0] ? s.pair[1] : s.sel === s.pair[1] ? s.pair[0] : s.sel >= 0 ? s.sel : s.pair[0];
          const k = s.socks[i];
          io.tap(k.x + s.sw * 0.12, k.y + s.sw * 0.75);
          m.cd = 0.12;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.05) return;
          const m = mem<{ cd: number }>(s, () => ({ cd: 0 }));
          m.cd -= dt;
          if (m.cd > 0 || io.isDown) return;
          const wrong = s.socks.findIndex((_, j) => j !== s.pair[0] && j !== s.pair[1]);
          const i = s.sel < 0 ? s.pair[0] : wrong;
          const k = s.socks[i];
          io.tap(k.x + s.sw * 0.12, k.y + s.sw * 0.75);
          m.cd = 0.12;
        },
      }
    : null,
};
