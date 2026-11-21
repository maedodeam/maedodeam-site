// 184 · EAT THE MEETINGS! — WTF Moment: você é uma boca mastigando por cima de um calendário psicodélico que balança.
// Os blocos de reunião passeiam pela semana: coma 4 (6 nos níveis altos). Fuja do bloco vermelho "1:1 COM O CHEFE",
// que vem devagar na sua direção; encostar nele é perder.
import type { Entry, MicroAPI, MicroInstance, Point, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { clamp, fitText, isPortrait } from "./util.ts";

interface Meet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: number;
  color: string;
  eaten: number;
  ph: number;
  base: number;
  on: boolean;
  born: number;
}
interface S {
  px: number;
  py: number;
  mr: number;
  meets: Meet[];
  need: number;
  eaten: number;
  bx: number;
  by: number;
  bv: number;
  bw: number;
  bh: number;
  mw: number;
  mh: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  chomp: number;
  caught: boolean;
  t: number;
}

const LABELS: Text[] = [
  { en: "STANDUP", pt: "DAILY" },
  { en: "SYNC", pt: "ALINHAMENTO" },
  { en: "ALL-HANDS", pt: "REUNIÃO GERAL" },
  { en: "SYNERGY", pt: "SINERGIA" },
  { en: "KICKOFF", pt: "KICKOFF" },
  { en: "RETRO", pt: "RETRÔ" },
  { en: "BRAINSTORM", pt: "BRAINSTORM" },
  { en: "Q&A", pt: "PERGUNTAS" },
];
const MCOLORS = [C.blue, C.green, C.purple, C.teal, C.yellow, C.pink];

/** Distância do ponto ao retângulo centrado (cx, cy) de meias-medidas hw, hh. */
function rectDist(px: number, py: number, cx: number, cy: number, hw: number, hh: number): number {
  const dx = Math.max(0, Math.abs(px - cx) - hw);
  const dy = Math.max(0, Math.abs(py - cy) - hh);
  return Math.hypot(dx, dy);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const need = lv >= 0.5 ? 6 : 4;
  const mw = 210;
  const mh = 92;
  const top = portrait ? 230 : 150;
  const s: S = {
    px: w / 2,
    py: portrait ? h * 0.8 : h * 0.78,
    mr: 72,
    meets: [],
    need,
    eaten: 0,
    bx: 0,
    by: 0,
    bv: 170 + lv * 110,
    bw: 270,
    bh: 120,
    mw,
    mh,
    minX: 90,
    maxX: w - 90,
    minY: top + 40,
    maxY: h - 90,
    chomp: 0,
    caught: false,
    t: 0,
  };
  // o chefe começa no canto mais longe de você
  s.bx = rng.chance(0.5) ? 220 : w - 220;
  s.by = top + 110;
  const far = (x: number, y: number) => Math.hypot(x - s.px, y - s.py) > 330 && Math.hypot(x - s.bx, y - s.by) > 330;
  const labels = rng.shuffle(LABELS.map((_, i) => i));
  for (let i = 0; i < need + 2; i++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < 40; k++) {
      x = rng.range(s.minX + mw / 2, s.maxX - mw / 2);
      y = rng.range(s.minY + mh / 2, s.maxY - mh / 2);
      if (far(x, y) && s.meets.every((m) => Math.hypot(m.x - x, m.y - y) > 240)) break;
    }
    const a = rng.range(0, Math.PI * 2);
    const sp = rng.range(170, 240) + lv * 70;
    // só 3 na tela por vez; as outras entram quando uma é comida
    s.meets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, label: labels[i % labels.length], color: MCOLORS[i % MCOLORS.length], eaten: 0, ph: rng.range(0, 6), base: sp, on: i < 3, born: -1 });
  }
  const respawn = () => {
    const m = s.meets.find((mm) => !mm.on);
    if (!m) return;
    m.on = true;
    for (let k = 0; k < 30; k++) {
      m.x = rng.range(s.minX + mw / 2, s.maxX - mw / 2);
      m.y = rng.range(s.minY + mh / 2, s.maxY - mh / 2);
      if (Math.hypot(m.x - s.px, m.y - s.py) > 420 && Math.hypot(m.x - s.bx, m.y - s.by) > 250) break;
    }
    m.born = s.t;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.chomp += dt;
      for (const m of s.meets) if (m.eaten > 0) m.eaten += dt;
      if (api.result) return;
      if (!s.caught) {
        const p = { x: s.px, y: s.py };
        steer(api.input, p, { axis: "xy", keySpeed: 820, maxSpeed: 1150, minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY }, dt);
        s.px = p.x;
        s.py = p.y;
      }
      // reuniões passeando
      for (const m of s.meets) {
        if (m.eaten > 0 || !m.on) continue;
        // as reuniões têm medo da boca: fogem quando ela chega perto
        const ex = m.x - s.px;
        const ey = m.y - s.py;
        const ed = Math.hypot(ex, ey) || 1;
        if (ed < 300) {
          m.vx += (ex / ed) * 1100 * dt;
          m.vy += (ey / ed) * 1100 * dt;
        }
        const msp = Math.hypot(m.vx, m.vy) || 1;
        const cap = ed < 300 ? m.base * 1.7 : m.base;
        const ns = msp > cap ? Math.max(cap, msp - 400 * dt) : msp;
        m.vx *= ns / msp;
        m.vy *= ns / msp;
        const turn = Math.sin(s.t * 1.3 + m.ph) * 0.9 * dt;
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        const vx = m.vx * c - m.vy * sn;
        m.vy = m.vx * sn + m.vy * c;
        m.vx = vx;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.x < s.minX + s.mw / 2 || m.x > s.maxX - s.mw / 2) m.vx = -m.vx;
        if (m.y < s.minY + s.mh / 2 || m.y > s.maxY - s.mh / 2) m.vy = -m.vy;
        m.x = clamp(m.x, s.minX + s.mw / 2, s.maxX - s.mw / 2);
        m.y = clamp(m.y, s.minY + s.mh / 2, s.maxY - s.mh / 2);
        if (rectDist(s.px, s.py, m.x, m.y, s.mw / 2, s.mh / 2) < s.mr * 0.8) {
          m.eaten = 0.001;
          s.eaten++;
          s.chomp = 0;
          api.sfx("kazoo");
          api.fx.pop(m.x, m.y - 80, "NOM!", C.white);
          api.fx.burst(m.x, m.y, m.color, 12);
          if (s.eaten >= s.need) {
            api.sfx("tada");
            api.win();
            return;
          }
          respawn();
        }
      }
      // o 1:1 com o chefe vem atrás de você (depois de um respiro inicial)
      if (s.t > 0.6) {
        const dx = s.px - s.bx;
        const dy = s.py - s.by;
        const d = Math.hypot(dx, dy) || 1;
        const sp = s.bv * (lv >= 1 ? 1 + Math.min(0.5, (s.t - 0.6) * 0.2) : 1);
        s.bx += (dx / d) * sp * dt;
        s.by += (dy / d) * sp * dt;
      }
      if (rectDist(s.px, s.py, s.bx, s.by, s.bw / 2 - 14, s.bh / 2 - 14) < s.mr * 0.8) {
        s.caught = true;
        api.sfx("glitch");
        api.fx.shake(1);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.45);
      const wb = psyWobble(t, 0.8);
      // calendário derretendo
      g.push();
      g.translate(w / 2 + wb.dx, h / 2 + wb.dy);
      g.rotate(wb.rot);
      g.translate(-w / 2, -h / 2);
      g.push();
      g.alpha(0.82);
      g.rect(40, s.minY - 100, w - 80, h - s.minY + 60, C.white, { r: 30, lw: 8 });
      g.pop();
      const days = [
        { en: "MON", pt: "SEG" },
        { en: "TUE", pt: "TER" },
        { en: "WED", pt: "QUA" },
        { en: "THU", pt: "QUI" },
        { en: "FRI", pt: "SEX" },
      ];
      const colW = (w - 80) / 5;
      for (let i = 0; i < 5; i++) {
        const x = 40 + colW * i;
        if (i > 0) g.line(x, s.minY - 100, x + Math.sin(t * 3 + i) * 14, h - 40, psyColor(t, i * 60, 80, 45), 5);
        g.text(api.t(days[i]), x + colW / 2, s.minY - 60, { size: 40, color: psyColor(t, i * 50, 90, 35) });
      }
      for (let y = s.minY; y < h - 40; y += 120) g.line(40, y, w - 40, y + Math.sin(t * 2 + y) * 10, C.paper2, 3);
      g.pop();

      // reuniões (nítidas, contorno firme)
      for (const m of s.meets) {
        if (m.eaten > 0.25 || !m.on) continue;
        const pop = Math.min(1, (s.t - m.born) / 0.2);
        const k = m.eaten > 0 ? 1 - m.eaten / 0.25 : Math.max(0.05, pop);
        g.push();
        g.translate(m.x, m.y);
        g.scale(k);
        g.rect(-s.mw / 2 + 6, -s.mh / 2 + 10, s.mw, s.mh, C.ink, { r: 16, stroke: null });
        g.rect(-s.mw / 2, -s.mh / 2, s.mw, s.mh, m.color, { r: 16, lw: 6 });
        g.rect(-s.mw / 2, -s.mh / 2, 18, s.mh, C.white, { r: 8, lw: 4 });
        fitText(g, api.t(LABELS[m.label]), 10, 4, s.mw - 50, { size: 40, color: C.ink });
        g.pop();
      }
      // o chefe
      g.push();
      g.translate(s.bx, s.by);
      g.rotate(Math.sin(t * 5) * 0.04);
      g.rect(-s.bw / 2 + 8, -s.bh / 2 + 12, s.bw, s.bh, C.ink, { r: 16, stroke: null });
      g.rect(-s.bw / 2, -s.bh / 2, s.bw, s.bh, C.red, { r: 16, lw: 8 });
      fitText(g, api.t({ en: "1:1 WITH BOSS", pt: "1:1 COM O CHEFE" }), 0, -12, s.bw - 30, { size: 40, color: C.white });
      g.face(0, 34, 70, "angry", { x: (s.px - s.bx) / 600, y: (s.py - s.by) / 600 });
      g.pop();

      // a boca
      const open = s.caught ? 0.1 : 0.25 + Math.abs(Math.sin(s.chomp * 9)) * 0.75;
      g.push();
      g.translate(s.px, s.py);
      const r = s.mr;
      g.ellipse(0, 0, r * 1.25, r * (0.45 + open * 0.55), C.ink2, { stroke: null });
      g.ellipse(0, r * 0.25 * open, r * 0.6, r * 0.25 * open + 6, C.pink, { stroke: null });
      // dentes
      for (let i = -2; i <= 2; i++) {
        g.rect(i * r * 0.32 - r * 0.13, -r * (0.42 + open * 0.5), r * 0.26, r * 0.28, C.white, { r: 6, lw: 4 });
        g.rect(i * r * 0.32 - r * 0.13, r * (0.14 + open * 0.5), r * 0.26, r * 0.28, C.white, { r: 6, lw: 4 });
      }
      // lábios
      g.ellipse(0, -r * (0.45 + open * 0.5), r * 1.3, r * 0.3, C.red, { lw: 7 });
      g.ellipse(0, r * (0.45 + open * 0.5), r * 1.3, r * 0.3, C.red, { lw: 7 });
      g.pop();

      // contador
      const label = `${s.eaten}/${s.need}`;
      g.text(label, w - 110, portrait ? 150 : 70, { size: 70, color: C.white, stroke: C.ink, lw: 12 });
      wobbleText(g, api.t({ en: "NOM NOM", pt: "NHAC NHAC" }), w / 2, portrait ? 130 : 66, t, { size: portrait ? 80 : 64, stroke: C.ink, lw: 10 }, 10);
      if (api.result === "lose") g.text(api.t({ en: "SEE YOU AT 1:1…", pt: "TE VEJO NO 1:1…" }), w / 2, h / 2, { size: 90, color: C.white, stroke: C.ink, lw: 16 });
      if (api.result === "win") g.text(api.t({ en: "CALENDAR CLEAR!", pt: "AGENDA LIVRE!" }), w / 2, h / 2, { size: 96, color: C.yellow, stroke: C.ink, lw: 16 });
    },
  };
}

export const eatMeetings: Entry<S> = {
  def: {
    id: "eat-meetings",
    num: 184,
    name: { en: "Eat the Meetings", pt: "Come as Reuniões" },
    verb: { en: "EAT THE MEETINGS!", pt: "COME AS REUNIÕES!" },
    hint: { pointer: "move", keys: "arrows" },
    category: "absurd",
    family: "move",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF: you are a chomping mouth on a wobbling psychedelic calendar. Meeting blocks wander around the week; move (mouse, finger drag or arrows) to eat 4 of them (6 later). The red 1:1 WITH BOSS block slowly drifts toward you; touching it ends it. Later the boss block speeds up as it chases.",
    winText: "Eat enough meetings to clear the calendar.",
    loseText: "Touch the 1:1 with the boss, or time runs out.",
    wtf: "normal",
    timeScale: 1.4,
    minTime: 4.2,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0) return;
          const p = { x: s.px, y: s.py };
          // reunião mais perto que não esteja colada no chefe
          let best: Point | null = null;
          let bd = Infinity;
          for (const m of s.meets) {
            if (m.eaten > 0 || !m.on) continue;
            const dBoss = Math.hypot(m.x - s.bx, m.y - s.by);
            const d = Math.hypot(m.x - p.x, m.y - p.y) + (dBoss < 260 ? 2000 : 0);
            if (d < bd) {
              bd = d;
              best = { x: m.x, y: m.y };
            }
          }
          let target = best ?? p;
          // fuga se o chefe está perto; desvio se ele está no caminho
          const bdx = p.x - s.bx;
          const bdy = p.y - s.by;
          const bdist = Math.hypot(bdx, bdy) || 1;
          const clear = 290;
          if (bdist < clear) target = { x: p.x + (bdx / bdist) * 300, y: p.y + (bdy / bdist) * 300 };
          else {
            const ax = target.x - p.x;
            const ay = target.y - p.y;
            const L = Math.hypot(ax, ay) || 1;
            const u = clamp(((s.bx - p.x) * ax + (s.by - p.y) * ay) / (L * L), 0, 1);
            const qx = p.x + ax * u;
            const qy = p.y + ay * u;
            const dq = Math.hypot(qx - s.bx, qy - s.by);
            if (dq < clear && u > 0 && u < 1) {
              let nx = -ay / L;
              let ny = ax / L;
              if ((qx - s.bx) * nx + (qy - s.by) * ny < 0) {
                nx = -nx;
                ny = -ny;
              }
              target = { x: s.bx + nx * (clear + 80), y: s.by + ny * (clear + 80) };
            }
          }
          target = { x: clamp(target.x, s.minX, s.maxX), y: clamp(target.y, s.minY, s.maxY) };
          steerTo(io, p, target, 1700, dt);
        },
        lose(s, api, io, dt) {
          // Vai direto no bloco do chefe (achou que era mais uma reunião).
          if (api.result || api.time <= 0) return;
          steerTo(io, { x: s.px, y: s.py }, { x: s.bx, y: s.by }, 1500, dt);
        },
      }
    : null,
};
