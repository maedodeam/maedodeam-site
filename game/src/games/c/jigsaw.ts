// 056 · FIT! — o quebra-cabeça da copa tem um buraco. Entre as peças parecidas, arraste a que encaixa.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";

type Edges = [number, number, number, number]; // cima, direita, baixo, esquerda: 1 aba, -1 encaixe, 0 reto
interface Piece extends DragItem {
  edges: Edges;
  right: boolean;
  shake: number;
}
interface S {
  cols: number;
  rows: number;
  size: number;
  bx: number; // canto do tabuleiro
  by: number;
  hole: { c: number; r: number };
  hEdges: number[][]; // [r][c] borda entre (c,r) e (c+1,r): +1 = aba na peça da esquerda
  vEdges: number[][]; // [r][c] borda entre (c,r) e (c,r+1): +1 = aba na peça de cima
  pieces: Piece[];
  drag: DragGroup<Piece>;
  placed: boolean;
  wrong: Piece | null;
  clock: number;
}

const SNAP = 70;

/** Contorno de uma peça centrada na origem, com abas/encaixes. */
function piecePath(g: Gfx, S: number, e: Edges): void {
  const c = g.ctx;
  const h = S / 2;
  const corners: Point[] = [
    { x: -h, y: -h },
    { x: h, y: -h },
    { x: h, y: h },
    { x: -h, y: h },
  ];
  c.beginPath();
  c.moveTo(corners[0].x, corners[0].y);
  for (let i = 0; i < 4; i++) {
    const A = corners[i];
    const B = corners[(i + 1) % 4];
    const d = { x: (B.x - A.x) / S, y: (B.y - A.y) / S };
    const n = { x: d.y, y: -d.x };
    const sg = e[i];
    if (sg !== 0) {
      const r = 0.15 * S;
      const P = (u: number, v: number) => ({ x: A.x + d.x * u + n.x * v * sg, y: A.y + d.y * u + n.y * v * sg });
      const p1 = P(0.38 * S, 0);
      c.lineTo(p1.x, p1.y);
      const steps = 14;
      for (let k = 0; k <= steps; k++) {
        const phi = Math.PI + 0.5 - ((Math.PI + 1) * k) / steps;
        const q = P(0.5 * S + r * Math.cos(phi), 0.16 * S + r * Math.sin(phi));
        c.lineTo(q.x, q.y);
      }
      const p2 = P(0.62 * S, 0);
      c.lineTo(p2.x, p2.y);
    }
    c.lineTo(B.x, B.y);
  }
  c.closePath();
}

/** Desenho do quebra-cabeça (coordenadas do tabuleiro: 0..cols·S × 0..rows·S). */
function picture(g: Gfx, W: number, H: number, t: number): void {
  g.rect(0, 0, W, H, C.sky, { stroke: null });
  g.circle(W * 0.7, H * 0.3, H * 0.17, C.yellow, { lw: 6 });
  g.face(W * 0.7, H * 0.3, H * 0.2, "happy");
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.2;
    g.line(W * 0.7 + Math.cos(a) * H * 0.21, H * 0.3 + Math.sin(a) * H * 0.21, W * 0.7 + Math.cos(a) * H * 0.27, H * 0.3 + Math.sin(a) * H * 0.27, C.orange, 8);
  }
  g.ellipse(W * 0.2, H * 0.22, W * 0.14, H * 0.07, C.white, { stroke: null });
  g.ellipse(W * 0.28, H * 0.18, W * 0.1, H * 0.07, C.white, { stroke: null });
  g.ellipse(W * 0.25, H * 1.05, W * 0.55, H * 0.45, C.green, { lw: 6 });
  g.ellipse(W * 0.9, H * 1.1, W * 0.45, H * 0.42, "#2fb56a", { lw: 6 });
  g.rect(W * 0.12, H * 0.5, W * 0.2, H * 0.2, C.red, { lw: 6 });
  g.shape(W * 0.22, H * 0.5, [-W * 0.13, 0, W * 0.13, 0, 0, -H * 0.14], C.brown);
  g.rect(W * 0.19, H * 0.6, W * 0.06, H * 0.1, C.yellow2, { lw: 5 });
}

function edgesOf(s: S, c: number, r: number): Edges {
  const top = r === 0 ? 0 : -s.vEdges[r - 1][c];
  const right = c === s.cols - 1 ? 0 : s.hEdges[r][c];
  const bottom = r === s.rows - 1 ? 0 : s.vEdges[r][c];
  const left = c === 0 ? 0 : -s.hEdges[r][c - 1];
  return [top, right, bottom, left];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const cols = 3;
  const rows = 3;
  const size = portrait ? 200 : Math.min(210, w * 0.16);
  const nCand = lv < 0.4 ? 2 : 3;
  const bw = cols * size;
  const bx = portrait ? w / 2 - bw / 2 : w * (w > 1400 ? 0.3 : 0.31) - bw / 2;
  const by = portrait ? h * 0.27 - (rows * size) / 2 : h / 2 - (rows * size) / 2;
  const s: S = {
    cols,
    rows,
    size,
    bx,
    by,
    hole: { c: rng.int(0, cols - 1), r: rng.int(0, rows - 1) },
    hEdges: [],
    vEdges: [],
    pieces: [],
    drag: new DragGroup<Piece>([]),
    placed: false,
    wrong: null,
    clock: 0,
  };
  for (let r = 0; r < rows; r++) {
    s.hEdges.push(Array.from({ length: cols - 1 }, () => rng.sign()));
    s.vEdges.push(Array.from({ length: cols }, () => rng.sign()));
  }
  const correct = edgesOf(s, s.hole.c, s.hole.r);
  const inner = [0, 1, 2, 3].filter((i) => correct[i] !== 0);
  const cands: Edges[] = [correct];
  for (let guard = 0; cands.length < nCand && guard < 100; guard++) {
    const e = correct.slice() as Edges;
    const flips = lv >= 0.7 || rng.chance(0.5) ? 1 : 2;
    for (const i of rng.shuffle(inner).slice(0, flips)) e[i] = -e[i];
    if (!cands.some((q) => q.every((v, k) => v === e[k]))) cands.push(e);
  }
  const order = rng.shuffle(cands.map((_, i) => i));
  const pieces: Piece[] = order.map((ci, k) => {
    let x: number;
    let y: number;
    if (portrait) {
      x = w / 2 + (k - (order.length - 1) / 2) * 300;
      y = h * 0.74 + (k % 2) * 60;
    } else {
      x = w * (w > 1400 ? 0.72 : 0.78) + (k % 2 ? 1 : -1) * (w > 1400 ? 130 : 30);
      y = h / 2 + (k - (order.length - 1) / 2) * 290;
    }
    return { ...makeItem(x, y, 105), edges: cands[ci], right: ci === 0, shake: 0 };
  });
  s.pieces = pieces;
  s.drag = new DragGroup(pieces);
  s.drag.bounds = { minX: 80, minY: 80, maxX: w - 80, maxY: h - 80 };

  const holeCenter = () => ({ x: s.bx + (s.hole.c + 0.5) * s.size, y: s.by + (s.hole.r + 0.5) * s.size });

  return {
    s,
    update(dt) {
      s.clock += dt;
      for (const pc of s.pieces) {
        pc.shake = Math.max(0, pc.shake - dt * 2.5);
        if (!pc.held) returnHome(pc, dt, pc.right && s.placed ? 25 : 10);
      }
      if (api.result) {
        s.drag.release();
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      const d = ev.dropped;
      if (d) {
        const hc = holeCenter();
        if (Math.hypot(d.x - hc.x, d.y - hc.y) < SNAP) {
          if (d.right) {
            s.placed = true;
            d.enabled = false;
            d.homeX = hc.x;
            d.homeY = hc.y;
            api.sfx("chime");
            api.fx.burst(hc.x, hc.y, C.yellow, 22);
            api.win();
          } else {
            s.wrong = d;
            d.shake = 1;
            api.sfx("buzz");
            api.fx.shake(0.5);
            api.fx.pop(hc.x, hc.y - 140, api.t({ en: "DOESN'T FIT", pt: "NÃO ENCAIXA" }), C.red);
            api.lose();
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      const S = s.size;
      const bw = s.cols * S;
      const bh = s.rows * S;
      // mesa e moldura
      g.rect(s.bx - 30 + 12, s.by - 30 + 16, bw + 60, bh + 60, C.ink, { r: 20, stroke: null });
      g.rect(s.bx - 30, s.by - 30, bw + 60, bh + 60, C.brown, { r: 20 });
      g.push();
      g.translate(s.bx, s.by);
      g.clip(0, 0, bw, bh);
      picture(g, bw, bh, s.clock);
      g.pop();
      // contornos das peças
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
          if (c === s.hole.c && r === s.hole.r) continue;
          g.push();
          g.translate(s.bx + (c + 0.5) * S, s.by + (r + 0.5) * S);
          piecePath(g, S, edgesOf(s, c, r));
          g.ctx.strokeStyle = "rgba(13,13,11,0.35)";
          g.ctx.lineWidth = 4;
          g.ctx.stroke();
          g.pop();
        }
      }
      g.rect(s.bx, s.by, bw, bh, null, { lw: 7 });
      // buraco
      const hc = holeCenter();
      g.push();
      g.translate(hc.x, hc.y);
      piecePath(g, S, edgesOf(s, s.hole.c, s.hole.r));
      g.ctx.fillStyle = C.ink2;
      g.ctx.fill();
      g.ctx.strokeStyle = C.ink;
      g.ctx.lineWidth = 7;
      g.ctx.stroke();
      g.pop();
      // peças soltas
      const near = s.drag.holding && Math.hypot(s.drag.holding.x - hc.x, s.drag.holding.y - hc.y) < SNAP;
      for (const pc of s.pieces) {
        const sx = Math.sin(s.clock * 60) * 16 * pc.shake;
        g.push();
        g.translate(pc.x + sx, pc.y);
        if (pc.held && !near) {
          g.push();
          g.translate(10, 14);
          piecePath(g, S, pc.edges);
          g.ctx.fillStyle = "rgba(13,13,11,0.3)";
          g.ctx.fill();
          g.pop();
        }
        g.push();
        piecePath(g, S, pc.edges);
        g.ctx.save();
        g.ctx.clip();
        // a mesma parte da imagem (o formato é a pista)
        g.translate(-(s.hole.c + 0.5) * S, -(s.hole.r + 0.5) * S);
        picture(g, s.cols * S, s.rows * S, s.clock);
        g.ctx.restore();
        g.pop();
        piecePath(g, S, pc.edges);
        g.ctx.strokeStyle = pc.held && near ? C.green : C.ink;
        g.ctx.lineWidth = pc.held && near ? 12 : 7;
        g.ctx.stroke();
        g.pop();
      }
    },
  };
}

export const jigsaw: Entry<S> = {
  def: {
    id: "jigsaw",
    num: 56,
    name: { en: "Last Piece", pt: "Última Peça" },
    verb: { en: "FIT!", pt: "ENCAIXA!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "The break-room jigsaw puzzle has one hole. Two or three loose pieces look alike but their tabs and blanks differ. Drag the one that fits into the hole (it snaps in when close).",
    winText: "The right piece snaps into the hole.",
    loseText: "Drop a piece that doesn't fit into the hole, or time runs out.",
    timeScale: 1.35,
    minTime: 3.6,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const pc = s.pieces.find((q) => q.right)!;
            m.plan = planDrag({ x: pc.x, y: pc.y }, { x: s.bx + (s.hole.c + 0.5) * s.size, y: s.by + (s.hole.r + 0.5) * s.size }, 3000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.25) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const pc = s.pieces.find((q) => !q.right)!;
            m.plan = planDrag({ x: pc.x, y: pc.y }, { x: s.bx + (s.hole.c + 0.5) * s.size, y: s.by + (s.hole.r + 0.5) * s.size }, 3000);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
