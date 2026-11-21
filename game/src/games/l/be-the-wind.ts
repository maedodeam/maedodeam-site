// 178 · BE THE WIND! — WTF Moment: você É o vento (uma nuvem bochechuda). Um barquinho de papel na banheira precisa chegar
// à ilha do pato de borracha. Cada deslize é uma rajada naquela direção; o barco desliza com inércia e quica em
// sabonetes e esponjas. Nos níveis altos há duas barreiras e a passagem fica mais estreita.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText, psyWobble } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, dirVec, isPortrait, lerp, stepSwipe } from "./util.ts";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "soap" | "sponge";
  color: string;
}
interface Row {
  u: number;
  gv: number;
  gw: number;
}
interface S {
  bx: number;
  by: number;
  vx: number;
  vy: number;
  br: number;
  ix: number;
  iy: number;
  ir: number;
  tub: { x: number; y: number; w: number; h: number };
  blocks: Block[];
  rows: Row[];
  vertical: boolean;
  fric: number;
  gust: number;
  gustT: number;
  gdx: number;
  gdy: number;
  cx: number;
  cy: number;
  bump: number;
  t: number;
}

const G = 620;
const VMAX = 1150;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const vertical = portrait;
  const tub = portrait ? { x: 80, y: 300, w: w - 160, h: h - 440 } : { x: 110, y: 190, w: w - 220, h: h - 290 };
  // (u ao longo do lado comprido, v no lado curto) → tela
  const toS = (u: number, v: number): Point => (vertical ? { x: tub.x + v * tub.w, y: tub.y + tub.h - u * tub.h } : { x: tub.x + u * tub.w, y: tub.y + v * tub.h });
  const gw = lv >= 0.5 ? 0.42 - (lv - 0.5) * 0.06 : 0.5;
  const rows: Row[] = (lv >= 0.5 ? [0.36, 0.64] : [0.5]).map((u) => ({ u, gv: rng.range(0.3, 0.7), gw }));
  if (rows.length === 2 && Math.abs(rows[0].gv - rows[1].gv) < 0.25) rows[1].gv = rows[0].gv < 0.5 ? rows[0].gv + 0.3 : rows[0].gv - 0.3;
  const thick = 0.07;
  const blocks: Block[] = [];
  for (const r of rows) {
    const t = thick;
    const segs: [number, number][] = [
      [0, r.gv - r.gw / 2],
      [r.gv + r.gw / 2, 1],
    ];
    for (const [v0, v1] of segs) {
      if (v1 - v0 < 0.02) continue;
      const a = toS(r.u - t / 2, v0);
      const b = toS(r.u + t / 2, v1);
      const kind = rng.chance(0.5) ? "soap" : "sponge";
      blocks.push({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
        kind,
        color: kind === "soap" ? rng.pick([C.pink2, C.sky, C.green2, C.purple2]) : C.yellow,
      });
    }
  }
  const start = toS(0.08, rng.range(0.3, 0.7));
  const isl = toS(0.89, rng.range(0.3, 0.7));
  const s: S = {
    bx: start.x,
    by: start.y,
    vx: 0,
    vy: 0,
    br: 46,
    ix: isl.x,
    iy: isl.y,
    ir: 105,
    tub,
    blocks,
    rows,
    vertical,
    fric: 1.15 - lv * 0.2,
    gust: 0,
    gustT: 0,
    gdx: vertical ? 0 : 1,
    gdy: vertical ? -1 : 0,
    cx: start.x,
    cy: start.y,
    bump: 0,
    t: 0,
  };

  const blow = (dx: number, dy: number) => {
    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m;
    const uy = dy / m;
    s.vx += ux * G;
    s.vy += uy * G;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > VMAX) {
      s.vx *= VMAX / sp;
      s.vy *= VMAX / sp;
    }
    s.gdx = ux;
    s.gdy = uy;
    s.gustT = 0.35;
    s.gust++;
    api.sfx("swoosh");
    if (s.gust === 1) api.sfx("warp");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.gustT = Math.max(0, s.gustT - dt);
      s.bump = Math.max(0, s.bump - dt);
      // a nuvem (você) flutua atrás do barco, do lado de onde soprou
      s.cx = lerp(s.cx, s.bx - s.gdx * 230, 1 - Math.exp(-5 * dt));
      s.cy = lerp(s.cy, s.by - s.gdy * 230, 1 - Math.exp(-5 * dt));
      if (api.result) {
        s.vx *= Math.exp(-4 * dt);
        s.vy *= Math.exp(-4 * dt);
        if (api.result === "win") {
          s.bx = lerp(s.bx, s.ix, 1 - Math.exp(-4 * dt));
          s.by = lerp(s.by, s.iy + 40, 1 - Math.exp(-4 * dt));
        }
        return;
      }
      const inp = api.input;
      if (inp.swipeLine) blow(inp.swipeLine.to.x - inp.swipeLine.from.x, inp.swipeLine.to.y - inp.swipeLine.from.y);
      else if (inp.swipe) {
        const d = dirVec(inp.swipe);
        blow(d.x, d.y);
      }
      // inércia + atrito da água
      const k = Math.exp(-s.fric * dt);
      s.vx *= k;
      s.vy *= k;
      s.bx += s.vx * dt;
      s.by += s.vy * dt;
      // bordas da banheira
      const r = s.br;
      const T = s.tub;
      let bounced = false;
      if (s.bx < T.x + r) {
        s.bx = T.x + r;
        s.vx = Math.abs(s.vx) * 0.65;
        bounced = true;
      }
      if (s.bx > T.x + T.w - r) {
        s.bx = T.x + T.w - r;
        s.vx = -Math.abs(s.vx) * 0.65;
        bounced = true;
      }
      if (s.by < T.y + r) {
        s.by = T.y + r;
        s.vy = Math.abs(s.vy) * 0.65;
        bounced = true;
      }
      if (s.by > T.y + T.h - r) {
        s.by = T.y + T.h - r;
        s.vy = -Math.abs(s.vy) * 0.65;
        bounced = true;
      }
      // sabonetes e esponjas
      for (const b of s.blocks) {
        const qx = clamp(s.bx, b.x, b.x + b.w);
        const qy = clamp(s.by, b.y, b.y + b.h);
        let nx = s.bx - qx;
        let ny = s.by - qy;
        let d = Math.hypot(nx, ny);
        if (d >= r) continue;
        if (d < 0.001) {
          // centro dentro do bloco: empurra pelo lado mais perto
          const left = s.bx - b.x;
          const right = b.x + b.w - s.bx;
          const top = s.by - b.y;
          const bot = b.y + b.h - s.by;
          const mn = Math.min(left, right, top, bot);
          nx = mn === left ? -1 : mn === right ? 1 : 0;
          ny = mn === top ? -1 : mn === bot ? 1 : 0;
          d = 0;
          s.bx = mn === left ? b.x - r : mn === right ? b.x + b.w + r : s.bx;
          s.by = mn === top ? b.y - r : mn === bot ? b.y + b.h + r : s.by;
        } else {
          nx /= d;
          ny /= d;
          s.bx = qx + nx * r;
          s.by = qy + ny * r;
        }
        const vn = s.vx * nx + s.vy * ny;
        if (vn < 0) {
          s.vx -= 1.7 * vn * nx;
          s.vy -= 1.7 * vn * ny;
        }
        bounced = true;
      }
      if (bounced && s.bump <= 0 && Math.hypot(s.vx, s.vy) > 120) {
        s.bump = 0.25;
        api.sfx("boing");
      }
      if (Math.hypot(s.bx - s.ix, s.by - s.iy) < s.ir + s.br * 0.5) {
        api.sfx("tada");
        api.fx.burst(s.ix, s.iy, C.yellow, 24);
        api.fx.pop(s.ix, s.iy - 160, api.t({ en: "LAND HO!", pt: "TERRA À VISTA!" }), C.white);
        api.win();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, s.ix, s.iy);
      const wb = psyWobble(t, 0.5);
      const T = s.tub;
      // banheira (contorno firme)
      g.push();
      g.translate(wb.dx * 0.4, wb.dy * 0.4);
      g.rect(T.x - 50, T.y - 50, T.w + 100, T.h + 100, C.white, { r: 110, lw: 10 });
      g.rect(T.x, T.y, T.w, T.h, "#9fe3ff", { r: 70, lw: 7 });
      g.push();
      g.clip(T.x, T.y, T.w, T.h, 70);
      // ondinhas
      for (let i = 0; i < 9; i++) {
        const yy = T.y + ((i * 137 + t * 30) % T.h);
        const xx = T.x + ((i * 311) % T.w);
        g.arc(xx, yy, 40, Math.PI * 1.15, Math.PI * 1.85, C.white, 5);
      }
      psyWash(g, t, 0.14);
      g.pop();
      // ralo + torneira
      if (s.vertical) {
        g.rect(T.x + T.w / 2 - 40, T.y - 95, 80, 60, C.gray, { r: 14, lw: 6 });
      } else g.rect(T.x - 95, T.y + T.h / 2 - 40, 60, 80, C.gray, { r: 14, lw: 6 });
      g.pop();

      // barreiras: sabonetes e esponjas
      for (const b of s.blocks) {
        if (b.kind === "soap") {
          g.rect(b.x, b.y, b.w, b.h, b.color, { r: 26, lw: 7 });
          g.push();
          g.alpha(0.7);
          g.rect(b.x + 10, b.y + 10, Math.max(4, b.w * 0.35), Math.max(4, b.h * 0.25), C.white, { r: 10, stroke: null });
          g.pop();
        } else {
          g.rect(b.x, b.y, b.w, b.h, b.color, { r: 16, lw: 7 });
          const n = Math.floor((b.w * b.h) / 3200);
          for (let i = 0; i < Math.min(n, 30); i++) {
            g.circle(b.x + 14 + ((i * 47) % Math.max(1, b.w - 28)), b.y + 14 + ((i * 71) % Math.max(1, b.h - 28)), 7, C.orange2, { stroke: null });
          }
        }
      }

      // ilha do pato
      g.ellipse(s.ix, s.iy + 20, s.ir, s.ir * 0.8, C.yellow2, { lw: 7 });
      g.push();
      g.translate(s.ix, s.iy - 10);
      const dk = 1 + Math.sin(t * 6) * 0.05;
      g.scale(dk);
      g.ellipse(0, 18, 60, 36, C.yellow, { lw: 6 });
      g.circle(-18, -26, 32, C.yellow, { lw: 6 });
      g.shape(-46, -26, [0, -8, -28, -2, -28, 6, 0, 10], C.orange, { lw: 5 });
      g.circle(-24, -34, 6, C.ink, { stroke: null });
      g.pop();
      // bandeirinha na ilha
      g.line(s.ix + 60, s.iy + 10, s.ix + 60, s.iy - 110, C.ink, 6);
      g.shape(s.ix + 60, s.iy - 110, [0, 0, 60, 18, 0, 36], C.red, { lw: 5 });

      // barquinho de papel
      const ang = Math.atan2(s.vy, s.vx);
      const sp = Math.hypot(s.vx, s.vy);
      g.push();
      g.translate(s.bx, s.by);
      g.rotate(sp > 40 ? ang : s.vertical ? -Math.PI / 2 : 0);
      g.shape(0, 0, [-52, -8, 52, -8, 34, 26, -34, 26], C.white, { lw: 6 });
      g.shape(0, 0, [-34, -8, 0, -48, 34, -8], C.paper, { lw: 6 });
      g.line(0, -48, 0, -8, C.ink, 4);
      g.pop();

      // você: a nuvem-vento
      const puff = s.gustT > 0 ? 1.15 : 1;
      g.push();
      g.translate(s.cx + wb.dx, s.cy + wb.dy);
      g.scale(puff);
      const cc = psyColor(t, 40, 80, 88);
      g.circle(-50, 10, 46, cc);
      g.circle(0, -18, 60, cc);
      g.circle(52, 8, 48, cc);
      g.rect(-90, 4, 186, 56, cc, { r: 28 });
      g.circle(-50, 10, 46, cc, { stroke: null });
      g.circle(0, -18, 60, cc, { stroke: null });
      g.circle(52, 8, 48, cc, { stroke: null });
      g.face(0, 10, 110, api.result === "lose" ? "sad" : "happy", { x: s.gdx, y: s.gdy });
      if (s.gustT > 0) {
        g.ellipse(s.gdx * 44, 34 + s.gdy * 20, 16, 12, C.ink, { stroke: null });
        // linhas de vento
        for (let i = -1; i <= 1; i++) {
          const ox = -s.gdy * i * 36;
          const oy = s.gdx * i * 36;
          const L0 = 110 + (1 - s.gustT / 0.35) * 80;
          g.line(ox + s.gdx * L0, oy + s.gdy * L0, ox + s.gdx * (L0 + 90), oy + s.gdy * (L0 + 90), C.white, 9);
        }
      }
      g.pop();

      wobbleText(g, api.t({ en: "I AM THE WIND", pt: "EU SOU O VENTO" }), w / 2, s.vertical ? 150 : 95, t, { size: s.vertical ? 84 : 76, stroke: C.ink, lw: 12 }, 12);
      if (api.result === "lose") g.text(api.t({ en: "LOST AT SEA", pt: "NAUFRAGOU" }), w / 2, h / 2, { size: 100, color: C.white, stroke: C.ink, lw: 16 });
    },
  };
}

export const beTheWind: Entry<S> = {
  def: {
    id: "be-the-wind",
    num: 178,
    name: { en: "Be the Wind", pt: "Seja o Vento" },
    verb: { en: "BE THE WIND!", pt: "SEJA O VENTO!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF: you ARE the wind, a puffy cloud with a face. A paper boat floats in a bathtub; every swipe (or arrow key) is a gust in that direction. The boat glides with inertia and bounces off soap bars and sponges. Blow it through the gap to the rubber-duck island. Later there are two barriers and the gaps get narrower.",
    winText: "Blow the paper boat onto the rubber-duck island.",
    loseText: "Time runs out before the boat lands.",
    wtf: "normal",
    timeScale: 1.5,
    minTime: 4.5,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ wp: 0, sw: { k: 0 }, dx: 0, dy: 0, wait: 0 }));
          const T = s.tub;
          // pontos de passagem: antes e depois de cada vão, depois a ilha
          const pts: Point[] = [];
          for (const r of s.rows) {
            for (const du of [-0.11, 0.11]) {
              const u = r.u + du;
              pts.push(s.vertical ? { x: T.x + r.gv * T.w, y: T.y + T.h - u * T.h } : { x: T.x + u * T.w, y: T.y + r.gv * T.h });
            }
          }
          pts.push({ x: s.ix, y: s.iy });
          const uOf = (x: number, y: number) => (s.vertical ? (T.y + T.h - y) / T.h : (x - T.x) / T.w);
          while (m.wp < pts.length - 1) {
            const p = pts[m.wp];
            const d = Math.hypot(p.x - s.bx, p.y - s.by);
            if (d < 70 || uOf(s.bx, s.by) > uOf(p.x, p.y) + 0.02) m.wp++;
            else break;
          }
          if (m.sw.k > 0) {
            stepSwipe(io, m.sw, { x: api.w / 2, y: api.h / 2 }, m.dx * 170, m.dy * 170);
            return;
          }
          if (api.time < m.wait) return;
          const p = pts[m.wp];
          const tx = p.x - s.bx;
          const ty = p.y - s.by;
          const d = Math.hypot(tx, ty) || 1;
          const want = Math.min(850, 220 + d * 1.6);
          const dvx = (tx / d) * want - s.vx;
          const dvy = (ty / d) * want - s.vy;
          const dv = Math.hypot(dvx, dvy);
          if (dv > 300) {
            m.dx = dvx / dv;
            m.dy = dvy / dv;
            stepSwipe(io, m.sw, { x: api.w / 2, y: api.h / 2 }, m.dx * 170, m.dy * 170);
            m.wait = api.time + 0.1;
          }
        },
        lose(s, api, io) {
          // Sopra para o lado errado (para longe da ilha).
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ sw: { k: 0 }, wait: 0 }));
          const dx = s.vertical ? 0 : -170;
          const dy = s.vertical ? 170 : 0;
          if (m.sw.k > 0 || api.time >= m.wait) {
            if (stepSwipe(io, m.sw, { x: api.w / 2, y: api.h / 2 }, dx, dy)) m.wait = api.time + 0.4;
          }
        },
      }
    : null,
};
