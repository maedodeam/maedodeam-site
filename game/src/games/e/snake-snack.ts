// 096 · EAT! — um cabo USB faminto anda numa grade. Vire com deslizes, setas ou tocando de um lado da cabeça.
// Coma os bytes; bater na parede ou em si mesmo = derrota.
import type { Dir, Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { card, isPortrait, tapAt } from "./util.ts";

interface Cell {
  c: number;
  r: number;
}
interface S {
  cols: number;
  rows: number;
  cell: number;
  ox: number;
  oy: number;
  body: Cell[];
  prev: Cell[];
  dir: Dir;
  queue: Dir[];
  timer: number;
  step: number;
  food: Cell;
  eaten: number;
  need: number;
  dead: boolean;
  t: number;
  endT: number;
  chomp: number;
}

const DV: Record<Dir, Cell> = { left: { c: -1, r: 0 }, right: { c: 1, r: 0 }, up: { c: 0, r: -1 }, down: { c: 0, r: 1 } };
const OPP: Record<Dir, Dir> = { left: "right", right: "left", up: "down", down: "up" };

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const cell = 110;
  const top = portrait ? 300 : 190;
  const cols = Math.floor((w - 140) / cell);
  const rows = Math.floor((h - top - 70) / cell);
  const ox = (w - cols * cell) / 2;
  const oy = top + (h - top - 70 - rows * cell) / 2;
  // começa pelo lado mais comprido da grade, com bastante espaço à frente
  const vertical = rows > cols;
  const body: Cell[] = [];
  if (vertical) {
    const c0 = Math.floor(cols / 2);
    for (let i = 0; i < 3; i++) body.push({ c: c0, r: 2 - i });
  } else {
    const r0 = Math.floor(rows / 2);
    for (let i = 0; i < 3; i++) body.push({ c: 2 - i, r: r0 });
  }
  const s: S = {
    cols,
    rows,
    cell,
    ox,
    oy,
    body,
    prev: body.map((b) => ({ ...b })),
    dir: vertical ? "down" : "right",
    queue: [],
    timer: -0.45,
    step: 0.22 - lv * 0.06,
    food: { c: 0, r: 0 },
    eaten: 0,
    need: lv < 0.8 ? 2 : 3,
    dead: false,
    t: 0,
    endT: 0,
    chomp: 0,
  };

  const placeFood = () => {
    const head = s.body[0];
    const free: Cell[] = [];
    for (let c = 0; c < s.cols; c++)
      for (let r = 0; r < s.rows; r++) {
        if (s.body.some((b) => b.c === c && b.r === r)) continue;
        const d = Math.abs(c - head.c) + Math.abs(r - head.r);
        if (d < 3 || d > 6) continue;
        // nada logo atrás da cabeça (exigiria meia-volta)
        const v = DV[s.dir];
        if ((c - head.c) * v.c + (r - head.r) * v.r < 0 && Math.abs((c - head.c) * v.r) + Math.abs((r - head.r) * v.c) < 2) continue;
        free.push({ c, r });
      }
    s.food = free.length ? rng.pick(free) : { c: (head.c + 3) % s.cols, r: head.r };
  };
  placeFood();

  const turn = (d: Dir) => {
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d === last || d === OPP[last] || s.queue.length >= 2) return;
    s.queue.push(d);
    api.sfx("tap");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.chomp = Math.max(0, s.chomp - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.swipe) turn(inp.swipe);
      else {
        const tp = tapAt(inp);
        if (tp) {
          const head = s.body[0];
          const hx = s.ox + (head.c + 0.5) * s.cell;
          const hy = s.oy + (head.r + 0.5) * s.cell;
          const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
          if (last === "left" || last === "right") turn(tp.y < hy ? "up" : "down");
          else turn(tp.x < hx ? "left" : "right");
        }
      }
      s.timer += dt;
      if (s.timer < s.step) return;
      s.timer -= s.step;
      if (s.queue.length) s.dir = s.queue.shift()!;
      const v = DV[s.dir];
      const head = s.body[0];
      const nh = { c: head.c + v.c, r: head.r + v.r };
      const eating = nh.c === s.food.c && nh.r === s.food.r;
      const bodyCheck = eating ? s.body : s.body.slice(0, -1);
      if (nh.c < 0 || nh.r < 0 || nh.c >= s.cols || nh.r >= s.rows || bodyCheck.some((b) => b.c === nh.c && b.r === nh.r)) {
        s.dead = true;
        s.prev = s.body.map((b) => ({ ...b }));
        api.sfx("zap");
        api.fx.shake(0.7);
        api.fx.burst(s.ox + (head.c + 0.5 + v.c * 0.5) * s.cell, s.oy + (head.r + 0.5 + v.r * 0.5) * s.cell, C.yellow, 18);
        api.lose();
        return;
      }
      s.prev = s.body.map((b) => ({ ...b }));
      s.body.unshift(nh);
      if (eating) {
        s.prev.push({ ...s.prev[s.prev.length - 1] });
        s.eaten++;
        s.chomp = 0.25;
        api.sfx("coin");
        api.fx.pop(s.ox + (nh.c + 0.5) * s.cell, s.oy + nh.r * s.cell, "+1B", C.yellow);
        if (s.eaten >= s.need) {
          api.fx.burst(s.ox + (nh.c + 0.5) * s.cell, s.oy + (nh.r + 0.5) * s.cell, C.green, 22);
          api.win();
          return;
        }
        placeFood();
      } else s.body.pop();
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // placa de circuito
      g.rect(s.ox - 16, s.oy - 16, s.cols * s.cell + 32, s.rows * s.cell + 32, "#123b2a", { r: 20, lw: 8 });
      for (let c = 0; c <= s.cols; c++) g.line(s.ox + c * s.cell, s.oy, s.ox + c * s.cell, s.oy + s.rows * s.cell, "#1d5a40", 3);
      for (let r = 0; r <= s.rows; r++) g.line(s.ox, s.oy + r * s.cell, s.ox + s.cols * s.cell, s.oy + r * s.cell, "#1d5a40", 3);
      for (let i = 0; i < 10; i++) {
        const c = (i * 7) % s.cols;
        const r = (i * 5) % s.rows;
        g.circle(s.ox + (c + 0.5) * s.cell, s.oy + (r + 0.5) * s.cell, 8, "#2f7a57", { stroke: null });
      }
      // byte
      const fx = s.ox + (s.food.c + 0.5) * s.cell;
      const fy = s.oy + (s.food.r + 0.5) * s.cell;
      if (!(api.result === "win")) {
        const bob = Math.sin(g.time * 6) * 5;
        g.circle(fx, fy + bob, 40, C.yellow);
        g.circle(fx, fy + bob, 28, null, { stroke: C.orange, lw: 5 });
        g.text(s.eaten % 2 ? "0" : "1", fx, fy + bob + 2, { size: 44, font: "mono", weight: 800, color: C.ink });
      }
      // cabo (corpo interpolado)
      const k = s.dead || api.result ? 1 : Math.max(0, Math.min(1, s.timer / s.step));
      const pts: Point[] = s.body.map((b, i) => {
        const p = s.prev[i] ?? b;
        return { x: s.ox + (p.c + (b.c - p.c) * k + 0.5) * s.cell, y: s.oy + (p.r + (b.r - p.r) * k + 0.5) * s.cell };
      });
      // ponta da cauda (conector do outro lado)
      g.polyline(pts, C.ink, 58);
      g.polyline(pts, C.gray, 42);
      g.polyline(pts, "#b9b5aa", 10);
      const tail = pts[pts.length - 1];
      g.circle(tail.x, tail.y, 26, C.gray2);
      // cabeça: plugue USB com olhos
      const head = pts[0];
      const v = DV[s.dir];
      const ang = Math.atan2(v.r, v.c);
      g.push();
      g.translate(head.x, head.y);
      g.rotate(ang);
      g.rect(-46, -44, 84, 88, C.ink2, { r: 16 });
      g.rect(30, -30, 44, 60, C.paper2, { r: 4 });
      g.rect(46, -18, 12, 12, C.ink, { stroke: null });
      g.rect(46, 6, 12, 12, C.ink, { stroke: null });
      g.pop();
      const lookX = v.c;
      const lookY = v.r;
      const ex = head.x - v.c * 8;
      const ey = head.y - v.r * 8;
      const px = -v.r;
      const py = v.c;
      if (s.dead) {
        g.text("x x", ex, ey, { size: 40, font: "mono", weight: 800, color: C.white });
      } else {
        g.eye(ex + px * 18, ey + py * 18, 14, lookX, lookY);
        g.eye(ex - px * 18, ey - py * 18, 14, lookX, lookY);
      }
      if (s.chomp > 0) g.circle(head.x, head.y, 60 + (0.25 - s.chomp) * 200, null, { stroke: C.yellow, lw: 8 });
      // placar
      const bw = 460;
      const bx = w / 2 - bw / 2;
      const by = portrait ? 140 : 40;
      card(g, bx, by, bw, 100, C.white, 26, 6, 8);
      g.text("BYTES", bx + 36, by + 51, { size: 50, align: "left", color: C.ink });
      g.text(`${s.eaten}/${s.need}`, bx + bw - 36, by + 51, { size: 62, font: "mono", weight: 800, align: "right", color: C.green });
    },
  };
}

function bfs(s: S): Dir | null {
  const head = s.body[0];
  const blocked = new Set(s.body.slice(0, -1).map((b) => b.c + "," + b.r));
  const start = head.c + "," + head.r;
  const prev = new Map<string, { from: string; dir: Dir }>();
  const q: Cell[] = [head];
  const seen = new Set([start]);
  const target = s.food.c + "," + s.food.r;
  while (q.length) {
    const cur = q.shift()!;
    const key = cur.c + "," + cur.r;
    if (key === target) {
      let k = key;
      let d: Dir | null = null;
      while (k !== start) {
        const p = prev.get(k)!;
        d = p.dir;
        k = p.from;
      }
      return d;
    }
    for (const d of ["up", "down", "left", "right"] as Dir[]) {
      if (key === start && d === OPP[s.dir]) continue;
      const n = { c: cur.c + DV[d].c, r: cur.r + DV[d].r };
      const nk = n.c + "," + n.r;
      if (n.c < 0 || n.r < 0 || n.c >= s.cols || n.r >= s.rows || blocked.has(nk) || seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, { from: key, dir: d });
      q.push(n);
    }
  }
  return null;
}

export const snakeSnack: Entry<S> = {
  def: {
    id: "snake-snack",
    num: 96,
    name: { en: "Hungry Cable", pt: "Cabo Faminto" },
    verb: { en: "EAT!", pt: "COME!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 3,
    mechanic:
      "A USB-cable snake crawls on a grid (one step every 0.22 s, down to 0.13 s). Turn with swipes, arrow keys, or by tapping on the side of the head you want to go. Eat 2 to 3 bytes.",
    winText: "Eat all the bytes.",
    loseText: "Hit a wall or your own cable, or time runs out.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.dead) return;
          const m = mem(s, () => ({ lock: 0 }));
          if (m.lock > 0) {
            m.lock--;
            return;
          }
          if (s.queue.length) return;
          // não manda a virada colada no passo (o toque só conta no quadro seguinte)
          if (s.step - s.timer < 2.5 / 60) return;
          const d = bfs(s);
          if (!d || d === s.dir) return;
          if (io.touch) {
            const head = s.body[0];
            const hx = s.ox + (head.c + 0.5) * s.cell + DV[d].c * 150;
            const hy = s.oy + (head.r + 0.5) * s.cell + DV[d].r * 150;
            io.tap(hx, hy);
            m.lock = 3;
          } else {
            io.press({ up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[d]);
          }
        },
        lose(s, api, io) {
          if (api.result || s.dead || s.queue.length) return;
          // vira para a parede mais próxima e segue reto
          const head = s.body[0];
          if (s.dir === "left" || s.dir === "right") io.press(head.r < s.rows / 2 ? "ArrowUp" : "ArrowDown");
          else io.press(head.c < s.cols / 2 ? "ArrowLeft" : "ArrowRight");
        },
      }
    : null,
};
