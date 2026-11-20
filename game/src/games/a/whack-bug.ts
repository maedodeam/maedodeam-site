// 003 · WHACK! — bugs saem das portas do rack de servidores. Acerte os bugs; não acerte o chefe.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, bug } from "../../gfx/art.ts";
import { bigText, pips } from "./art-a.ts";

interface Mole {
  cell: number;
  kind: "bug" | "boss";
  t: number;
  life: number;
  hit: number; // >0: acertado (tempo desde o golpe)
  color: string;
}
interface S {
  moles: Mole[];
  cells: { x: number; y: number }[];
  cell: number;
  need: number;
  hits: number;
  spawnT: number;
  every: number;
  life: number;
  spawned: number;
  lastBoss: boolean;
  bossHit: number;
  mallet: { x: number; y: number; t: number } | null;
}

const BUG_COLORS = [C.green, C.purple, C.orange, C.pink];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const cell = Math.min((w - 160) / 3, (h - (portrait ? 520 : 300)) / 3, 290);
  const gx = w / 2;
  const gy = portrait ? h * 0.55 : h * 0.57;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push({ x: gx + (c - 1) * cell, y: gy + (r - 1) * cell });
  const s: S = {
    moles: [],
    cells,
    cell,
    need: lv >= 1 ? 4 : 3,
    hits: 0,
    spawnT: 0.12,
    every: 0.62 - 0.22 * lv,
    life: 0.9 - 0.3 * lv,
    spawned: 0,
    lastBoss: false,
    bossHit: 0,
    mallet: null,
  };
  const recent: number[] = [];

  const spawn = () => {
    const busy = new Set(s.moles.map((m) => m.cell));
    const free = [...Array(9).keys()].filter((i) => !busy.has(i) && !recent.includes(i));
    const pool = free.length ? free : [...Array(9).keys()].filter((i) => !busy.has(i));
    if (!pool.length) return;
    const c = rng.pick(pool);
    recent.push(c);
    if (recent.length > 3) recent.shift();
    const bossy = s.spawned >= 1 && !s.lastBoss && rng.chance(0.22 + 0.1 * lv);
    s.lastBoss = bossy;
    s.moles.push({ cell: c, kind: bossy ? "boss" : "bug", t: 0, life: s.life * (bossy ? 1.25 : 1) * rng.range(0.9, 1.1), hit: 0, color: rng.pick(BUG_COLORS) });
    s.spawned++;
  };

  return {
    s,
    update(dt) {
      if (s.mallet) s.mallet.t += dt;
      for (const m of s.moles) {
        m.t += dt;
        if (m.hit > 0) m.hit += dt;
      }
      s.moles = s.moles.filter((m) => (m.hit > 0 ? m.kind === "boss" || m.hit < 0.5 : m.t < m.life + 0.14));
      if (s.bossHit > 0) s.bossHit += dt;
      if (api.result) return;
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        spawn();
        if (lv >= 1.2 && rng.chance(0.3)) spawn();
        s.spawnT = s.every * rng.range(0.85, 1.15);
      }
      const inp = api.input;
      if (!inp.pressed) return;
      s.mallet = { x: inp.x, y: inp.y, t: 0 };
      // Porta mais próxima do toque.
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < 9; i++) {
        const d = Math.hypot(inp.x - cells[i].x, inp.y - (cells[i].y - cell * 0.15));
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (bd > Math.max(120, cell * 0.55)) {
        api.sfx("swoosh");
        return;
      }
      const m = s.moles.find((q) => q.cell === best && q.hit === 0 && q.t <= q.life + 0.05);
      if (!m) {
        api.sfx("thud");
        return;
      }
      m.hit = 0.001;
      const c = cells[m.cell];
      if (m.kind === "boss") {
        s.bossHit = 0.001;
        api.sfx("hit");
        api.fx.shake(0.8);
        api.fx.pop(c.x, c.y - cell * 0.9, api.t({ en: "MY OFFICE. NOW.", pt: "NA MINHA SALA!" }), C.red);
        api.lose();
        return;
      }
      s.hits++;
      api.sfx("hit");
      api.fx.burst(c.x, c.y - cell * 0.2, m.color, 12);
      api.fx.pop(c.x, c.y - cell * 0.6, "+1", C.yellow);
      if (s.hits >= s.need) {
        api.sfx("chime");
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // sala de servidores: racks ao fundo
      for (let x = -40; x < w + 40; x += 220) {
        g.rect(x, 40, 180, h - 80, "#2a2950", { stroke: "#3a3970", lw: 6, r: 10 });
        for (let y = 80; y < h - 80; y += 60) g.circle(x + 30, y, 6, (Math.floor(g.time * 4 + x + y) % 3) === 0 ? C.green : "#3a3970", { stroke: null });
      }
      // painel principal
      const pw = cell * 3 + 60;
      g.rect(w / 2 - pw / 2 + 12, s.cells[0].y - cell / 2 - 30 + 14, pw, pw, C.ink, { r: 26, stroke: null });
      g.rect(w / 2 - pw / 2, s.cells[0].y - cell / 2 - 30, pw, pw, "#4b4e6d", { r: 26 });
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.circle(w / 2 + sx * (pw / 2 - 22), s.cells[0].y - cell / 2 - 30 + pw / 2 + sy * (pw / 2 - 22), 8, C.gray, { lw: 3 });
      for (let i = 0; i < 9; i++) {
        const c = s.cells[i];
        const hw = cell * 0.4;
        const hy = c.y + cell * 0.18;
        // LED de cada porta
        const m = s.moles.find((q) => q.cell === i);
        g.circle(c.x + cell * 0.36, c.y - cell * 0.36, 9, m ? (m.kind === "boss" ? C.red : C.yellow) : C.green, { lw: 3 });
        g.rect(c.x - hw - 16, hy - hw * 0.34 - 14, hw * 2 + 32, hw * 0.68 + 28, C.gray, { r: 22, lw: 5 });
        g.ellipse(c.x, hy, hw, hw * 0.34, C.ink);
        if (m) {
          const up = m.hit > 0 ? (m.kind === "boss" ? 1 : Math.max(0, 1 - m.hit / 0.3)) : Math.min(1, m.t / 0.1, Math.max(0, (m.life + 0.12 - m.t) / 0.12));
          g.push();
          g.clip(c.x - cell, c.y - cell * 1.6, cell * 2, hy - (c.y - cell * 1.6));
          const yy = hy + (1 - up) * cell * 0.8;
          if (m.kind === "boss") {
            boss(g, c.x, yy + cell * 0.88, cell / 150, { mood: m.hit > 0 ? "dizzy" : "angry" });
          } else {
            const sq = m.hit > 0 ? 0.45 : 1;
            g.push();
            g.translate(c.x, yy - cell * 0.22 * sq);
            g.scale(1, sq);
            bug(g, 0, 0, cell / 85, g.time + i, -Math.PI / 2, m.color);
            g.pop();
            if (m.hit > 0) for (let k = 0; k < 3; k++) g.star(c.x - 40 + k * 40, yy - cell * 0.45, 14, 6, 5, C.yellow, { lw: 3 });
          }
          g.pop();
        }
        // borda da frente da porta
        g.ellipse(c.x, hy, hw, hw * 0.34, null);
      }
      // placar
      const ty = portrait ? h * 0.13 : h * 0.09;
      bigText(g, api.t({ en: "BUGS", pt: "BUGS" }) + ` ${s.hits}/${s.need}`, w / 2, ty, 80, C.yellow);
      pips(g, w / 2, ty + 70, s.need, s.hits, 18, C.green);
      if (s.bossHit > 0) bigText(g, api.t({ en: "NOT THE BOSS!", pt: "O CHEFE NÃO!" }), w / 2, portrait ? h * 0.86 : h * 0.5, 110, C.red, -0.06);
      // marreta (aparece no golpe)
      const mm = s.mallet;
      if (mm && mm.t < 0.22) {
        const k = 1 - mm.t / 0.22;
        g.push();
        g.translate(mm.x + 40, mm.y + 30);
        g.rotate(-0.9 * k + 0.1);
        g.line(0, 0, 120, 120, C.brown, 22);
        g.rect(-70, -45, 140, 90, C.orange, { r: 18 });
        g.rect(-70, -45, 30, 90, C.yellow, { r: 10 });
        g.pop();
      }
    },
  };
}

export const whackBug: Entry<S> = {
  def: {
    id: "whack-bug",
    num: 3,
    name: { en: "Whack-a-Bug", pt: "Acerta o Bug" },
    verb: { en: "WHACK!", pt: "ACERTA!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "Bugs pop out of the ports of a server rack for a moment. Tap them before they hide. Sometimes the boss pops out instead: don't hit him.",
    winText: "Hit 3 bugs (4 at higher levels).",
    loseText: "Hitting the boss, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02) return;
          if (Math.floor(api.time * 60) % 4 !== 0) return;
          const m = s.moles.filter((q) => q.kind === "bug" && q.hit === 0 && q.t > 0.04 && q.t < q.life - 0.03).sort((a, b) => b.t - a.t)[0];
          if (m) io.tap(s.cells[m.cell].x, s.cells[m.cell].y);
        },
        lose(s, api, io) {
          if (api.result) return;
          const m = s.moles.find((q) => q.kind === "boss" && q.hit === 0 && q.t > 0.05);
          if (m) io.tap(s.cells[m.cell].x, s.cells[m.cell].y);
        },
      }
    : null,
};
