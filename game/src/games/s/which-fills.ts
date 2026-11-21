// 268 · FIRST TO FILL? — a água cai numa caixa d'água no alto, que desce por canos até 3 copos. Alguns canos estão
// tampados (tampa vermelha). Escolha o copo que enche primeiro: o de caminho aberto mais curto.
// Nos níveis altos há dois ou três caminhos abertos, canos em zigue-zague e tampas no cano principal.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { clamp, isPortrait } from "./util.ts";

interface Drop {
  x: number;
  zigs: number;
  /** Tampa no próprio cano (0..1 = altura da tampa) ou null. */
  cap: number | null;
  /** Tampa no cano principal antes de chegar a este copo. */
  headerCap: boolean;
  open: boolean;
  len: number;
}

interface S {
  x0: number;
  yh: number;
  yc: number;
  drops: Drop[];
  answer: number;
  choices: Choices;
  /** Tampa no cano principal (x) ou null. */
  hcap: number | null;
  picked: number | null;
  t: number;
  endT: number;
}

const ZW = 80;

function dropPath(d: Drop, yh: number, yc: number): Point[] {
  const pts: Point[] = [{ x: d.x, y: yh }];
  const pieces = d.zigs * 2 + 1;
  const step = (yc - yh) / pieces;
  let y = yh;
  for (let i = 0; i < d.zigs; i++) {
    y += step;
    pts.push({ x: d.x, y });
    pts.push({ x: d.x + ZW, y });
    y += step;
    pts.push({ x: d.x + ZW, y });
    pts.push({ x: d.x, y });
  }
  pts.push({ x: d.x, y: yc });
  return pts;
}

/** Corta um caminho num comprimento (para desenhar o cano só até a tampa). */
function cutPath(pts: Point[], frac: number): Point[] {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let left = total * frac;
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l >= left) {
      const k = l > 0 ? left / l : 0;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      return out;
    }
    out.push(b);
    left -= l;
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const area = portrait ? { x: 60, y: h * 0.72, w: w - 120, h: h * 0.2 } : { x: w * 0.12, y: h * 0.7, w: w * 0.76, h: h * 0.25 };
  const choices = new Choices(api, 3, { area, maxCols: 3, gap: portrait ? 30 : 60 });
  const xs = [0, 1, 2].map((i) => choices.center(i).x - (portrait ? 30 : 40));
  const yh = portrait ? h * 0.34 : h * 0.3;
  const yc = area.y - 6;
  const drop = yc - yh;

  let best: { drops: Drop[]; x0: number; hcap: number | null; answer: number } | null = null;
  for (let tries = 0; tries < 60 && !best; tries++) {
    const x0 = rng.range(xs[0] + 20, xs[2] - 20);
    const drops: Drop[] = xs.map((x) => ({ x, zigs: 0, cap: null, headerCap: false, open: true, len: 0 }));
    let hcap: number | null = null;
    if (lv < 0.5) {
      const open = rng.int(0, 2);
      for (let i = 0; i < 3; i++) if (i !== open) drops[i].cap = rng.range(0.3, 0.6);
      for (const d of drops) d.zigs = rng.int(0, 1);
    } else {
      for (const d of drops) d.zigs = rng.int(0, lv >= 1 ? 3 : 2);
      const nCaps = lv >= 1 ? rng.int(0, 1) : 1;
      if (nCaps > 0) {
        // no nível alto a tampa pode estar no cano principal (bloqueia o copo da ponta)
        const side = rng.pick([0, 2]);
        const room = side === 0 ? Math.min(xs[1], x0) - xs[0] : xs[2] - Math.max(xs[1], x0);
        if (lv >= 1 && rng.chance(0.5) && room > 140) {
          hcap = side === 0 ? (xs[0] + Math.min(xs[1], x0)) / 2 : (xs[2] + Math.max(xs[1], x0)) / 2;
          drops[side].headerCap = true;
        } else drops[rng.int(0, 2)].cap = rng.range(0.3, 0.6);
      }
    }
    for (const d of drops) {
      d.open = d.cap === null && !d.headerCap;
      d.len = Math.abs(d.x - x0) + drop + d.zigs * ZW * 2;
    }
    const open = drops.map((d, i) => ({ d, i })).filter((o) => o.d.open).sort((a, b) => a.d.len - b.d.len);
    if (open.length === 0) continue;
    if (open.length >= 2 && open[0].d.len > open[1].d.len * 0.8) continue;
    best = { drops, x0, hcap, answer: open[0].i };
  }
  if (!best) {
    const drops: Drop[] = xs.map((x, i) => ({ x, zigs: 0, cap: i === 1 ? null : 0.4, headerCap: false, open: i === 1, len: drop }));
    best = { drops, x0: xs[1], hcap: null, answer: 1 };
  }
  const s: S = { x0: best.x0, yh, yc, drops: best.drops, answer: best.answer, choices, hcap: best.hcap, picked: null, t: 0, endT: 0 };

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
      s.picked = i;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("splash");
        api.fx.burst(c.x, c.y, C.sky, 24);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 140, api.t({ en: "STILL DRY", pt: "SECO" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      const { x0, yh, yc } = s;
      // azulejos
      for (let y = 0; y < h; y += 120) g.line(0, y, w, y, "#c4b2f0", 4);
      const revealed = api.result !== null;
      const fillK = revealed ? clamp(s.endT / 0.45, 0, 1) : 0;
      const minLen = Math.min(...s.drops.filter((d) => d.open).map((d) => d.len));
      const pipeCol = C.gray2;
      const water = C.blue;
      const PW = 26;
      const pipe = (pts: Point[], wet: boolean) => {
        g.polyline(pts, C.ink, PW + 12);
        g.polyline(pts, wet ? water : C.paper2, PW);
      };
      // cano principal (para a esquerda e para a direita do ralo)
      const left = Math.min(...s.drops.map((d) => d.x));
      const right = Math.max(...s.drops.map((d) => d.x));
      const hl = Math.min(left, x0);
      const hr = Math.max(right, x0);
      const hc = s.hcap;
      if (hc === null) pipe([{ x: hl, y: yh }, { x: hr, y: yh }], revealed);
      else {
        // o principal é cortado na tampa
        const blockedLeft = hc < x0;
        pipe(blockedLeft ? [{ x: hc + 20, y: yh }, { x: hr, y: yh }] : [{ x: hl, y: yh }, { x: hc - 20, y: yh }], revealed);
        pipe(blockedLeft ? [{ x: hl, y: yh }, { x: hc - 20, y: yh }] : [{ x: hc + 20, y: yh }, { x: hr, y: yh }], false);
        g.rect(hc - 26, yh - 30, 52, 60, C.red, { r: 8, lw: 6 });
      }
      // descidas
      for (const d of s.drops) {
        const full = dropPath(d, yh, yc);
        if (d.cap !== null) {
          const part = cutPath(full, d.cap);
          pipe(part, revealed);
          const end = part[part.length - 1];
          g.rect(end.x - 30, end.y - 10, 60, 34, C.red, { r: 8, lw: 6 });
          // tubinho seco saindo do copo
          pipe([{ x: d.x, y: yc - 50 }, { x: d.x, y: yc }], false);
        } else pipe(full, revealed && d.open);
        g.circle(d.x, yh, PW * 0.7, pipeCol, { lw: 5 });
      }
      // caixa d'água + torneira
      const tw = Math.min(260, w * 0.2);
      const th = Math.min(yh - 120, 190);
      const ty = yh - 40 - th;
      g.rect(x0 - 14, yh - 46, 28, 46, pipeCol, { lw: 5 });
      g.rect(x0 - tw / 2, ty, tw, th, C.paper, { r: 18, lw: 8 });
      const lvl = 0.45 + Math.sin(s.t * 2) * 0.05;
      g.rect(x0 - tw / 2 + 10, ty + th * (1 - lvl), tw - 20, th * lvl - 10, water, { r: 10, stroke: null });
      g.rect(x0 - tw / 2, ty, tw, th, null, { r: 18, lw: 8 });
      // torneira despejando
      const fx = x0 + tw * 0.25;
      g.rect(fx - 70, ty - 80, 90, 28, pipeCol, { r: 10, lw: 5 });
      g.rect(fx - 10, ty - 80, 26, 50, pipeCol, { r: 6, lw: 5 });
      g.rect(fx - 4, ty - 30, 14, 30 + th * (1 - lvl), water, { stroke: null });

      s.choices.draw(
        g,
        (i, r) => {
          const d = s.drops[i];
          const cx = d.x;
          const top = r.y + 20;
          const bh = r.h - 40;
          const bw = Math.min(r.w * 0.5, 150);
          // copo
          const k = d.open && revealed ? clamp((fillK * (minLen + 300) - (d.len - minLen)) / 300, 0, 1) : 0;
          g.shape(cx, top, [-bw / 2, 0, bw / 2, 0, bw * 0.38, bh, -bw * 0.38, bh], C.white, { lw: 7 });
          if (k > 0) g.shape(cx, top + bh * (1 - k), [-bw * (0.38 + 0.12 * k), 0, bw * (0.38 + 0.12 * k), 0, bw * 0.38, bh * k, -bw * 0.38, bh * k], C.sky, { stroke: null });
          g.shape(cx, top, [-bw / 2, 0, bw / 2, 0, bw * 0.38, bh, -bw * 0.38, bh], null, { lw: 7 });
          g.text(String(i + 1), r.x + r.w - 40, r.y + r.h / 2, { size: Math.min(80, r.h * 0.4), color: C.gray2 });
        },
        api.result ? s.answer : undefined,
      );
    },
  };
}

export const whichFills: Entry<S> = {
  def: {
    id: "which-fills",
    num: 268,
    name: { en: "Which Fills First?", pt: "Qual Enche Primeiro?" },
    verb: { en: "FIRST TO FILL?", pt: "QUAL ENCHE?" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Water pours into a tank that feeds three glasses through pipes; some pipes are capped (red caps). Pick the glass that fills first: the one with the shortest open path. Later two or three paths are open, pipes zigzag and the main pipe can be capped too.",
    winText: "Pick the glass at the end of the shortest open pipe.",
    loseText: "Pick a capped or longer path, or run out of time.",
    timeScale: 1.35,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.35 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.35) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
