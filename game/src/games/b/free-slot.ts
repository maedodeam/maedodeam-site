// 024 · BOOK IT! — a agenda da semana está lotada de reuniões; só um horário está livre. Toque nele.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";

interface Block {
  day: number;
  row: number;
  len: number;
  color: string;
  title: Text;
  decoy: "focus" | "lunch" | null;
}

interface S {
  rows: number;
  free: { day: number; row: number };
  blocks: Block[];
  grid: { x: number; y: number; cw: number; ch: number };
  picked: { day: number; row: number } | null;
  after: number;
}

const TITLES: Text[] = [
  { en: "Sync about syncs", pt: "Alinhar o alinhamento" },
  { en: "Quick call (1h)", pt: "Call rápida (1h)" },
  { en: "Standup", pt: "Daily" },
  { en: "Retro", pt: "Retrô" },
  { en: "Q3 vibes", pt: "Vibe do trimestre" },
  { en: "Pre-meeting", pt: "Pré-reunião" },
  { en: "1:1", pt: "1:1" },
  { en: "All hands", pt: "Reunião geral" },
  { en: "Synergy", pt: "Sinergia" },
  { en: "Brainstorm", pt: "Toró de ideias" },
  { en: "Status update", pt: "Status do status" },
  { en: "Kickoff", pt: "Kickoff" },
  { en: "Touch base", pt: "Bater a bola" },
  { en: "Deep dive", pt: "Mergulho profundo" },
  { en: "Circle back", pt: "Retomar o tema" },
  { en: "Roadmap", pt: "Roadmap" },
  { en: "Meeting prep", pt: "Pauta da pauta" },
  { en: "Post-mortem", pt: "Lições aprendidas" },
  { en: "Feedback", pt: "Feedback" },
  { en: "Vision 2030", pt: "Visão 2030" },
];
const COLORS = [C.blue2, C.pink, C.green, C.purple2, C.orange2, C.teal, C.yellow, C.sky];
const DAYS: Text[] = [
  { en: "MON", pt: "SEG" },
  { en: "TUE", pt: "TER" },
  { en: "WED", pt: "QUA" },
  { en: "THU", pt: "QUI" },
  { en: "FRI", pt: "SEX" },
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = lv / 1.5;
  const timeW = 130;
  const headH = 90;
  const gx0 = 60 + timeW;
  const gy0 = 60 + headH;
  const availW = w - 60 - gx0;
  const availH = h - 60 - gy0;
  const rows = Math.max(4, Math.min(4 + Math.round(k * 4), Math.floor(availH / 112)));
  const cw = availW / 5;
  const ch = Math.min(availH / rows, 200);
  const grid = { x: gx0, y: gy0 + (availH - ch * rows) / 2, cw, ch };
  const free = { day: rng.int(0, 4), row: rng.int(0, rows - 1) };
  const blocks: Block[] = [];
  const decoyRate = lv < 0.5 ? 0 : 0.08 + k * 0.12;
  const titles = rng.shuffle(TITLES);
  let ti = 0;
  for (let d = 0; d < 5; d++) {
    let r = 0;
    while (r < rows) {
      if (d === free.day && r === free.row) {
        r++;
        continue;
      }
      const canTwo = r + 1 < rows && !(d === free.day && r + 1 === free.row);
      const len = canTwo && rng.chance(0.4) ? 2 : 1;
      let decoy: Block["decoy"] = null;
      if (rng.chance(decoyRate)) decoy = r === 3 && len === 1 ? "lunch" : "focus";
      const title =
        decoy === "focus" ? { en: "Focus time", pt: "Foco total" } : decoy === "lunch" ? { en: "Lunch", pt: "Almoço" } : titles[ti++ % titles.length];
      const color = decoy === "focus" ? "#e9e6df" : decoy === "lunch" ? "#fff4cf" : rng.pick(COLORS);
      blocks.push({ day: d, row: r, len, color, title, decoy });
      r += len;
    }
  }
  const s: S = { rows, free, blocks, grid, picked: null, after: 0 };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.after += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const d = Math.floor((inp.x - grid.x) / grid.cw);
      const r = Math.floor((inp.y - grid.y) / grid.ch);
      if (d < 0 || d > 4 || r < 0 || r >= s.rows) return;
      s.picked = { day: d, row: r };
      const cx = grid.x + (d + 0.5) * grid.cw;
      const cy = grid.y + (r + 0.5) * grid.ch;
      if (d === s.free.day && r === s.free.row) {
        api.sfx("coin");
        api.fx.burst(cx, cy, C.green);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      const { x, y, cw, ch } = grid;
      const gw = cw * 5;
      const gh = ch * s.rows;
      // folha do calendário
      g.rect(x - timeW - 20 + 10, y - headH - 20 + 14, gw + timeW + 40, gh + headH + 40, C.ink, { r: 24, stroke: null });
      g.rect(x - timeW - 20, y - headH - 20, gw + timeW + 40, gh + headH + 40, C.white, { r: 24, lw: 9 });
      g.rect(x - timeW - 20, y - headH - 20, gw + timeW + 40, headH + 10, C.ink2, { r: 24, lw: 9 });
      for (let d = 0; d < 5; d++) g.text(api.t(DAYS[d]), x + (d + 0.5) * cw, y - headH / 2 - 10, { size: 52, color: C.paper });
      for (let r = 0; r < s.rows; r++) {
        const hr = 9 + r;
        const lab = api.lang === "pt" ? `${hr}h` : `${((hr + 11) % 12) + 1}${hr < 12 ? "AM" : "PM"}`;
        g.text(lab, x - timeW / 2 - 6, y + r * ch + ch / 2, { size: 44, font: "mono", color: C.gray2, maxWidth: timeW - 10 });
        g.line(x, y + r * ch, x + gw, y + r * ch, C.paper2, 3);
      }
      for (let d = 1; d < 5; d++) g.line(x + d * cw, y, x + d * cw, y + gh, C.paper2, 3);
      // reuniões
      const pad = 6;
      for (const b of s.blocks) {
        const bx = x + b.day * cw + pad;
        const by = y + b.row * ch + pad;
        const bw = cw - pad * 2;
        const bh = ch * b.len - pad * 2;
        const hit = s.picked && api.result === "lose" && s.picked.day === b.day && s.picked.row >= b.row && s.picked.row < b.row + b.len;
        const wob = hit ? Math.sin(s.after * 40) * 6 : 0;
        g.rect(bx + wob, by, bw, bh, b.color, { r: 14, lw: 5 });
        if (b.decoy === "focus") {
          g.push();
          g.clip(bx + wob, by, bw, bh, 14);
          for (let i = -bh; i < bw; i += 26) g.line(bx + wob + i, by + bh, bx + wob + i + bh, by, "#d3cec3", 5);
          g.pop();
          g.rect(bx + wob, by, bw, bh, null, { r: 14, lw: 5 });
        } else if (!b.decoy) {
          g.rect(bx + wob, by, 12, bh, "rgba(0,0,0,0.25)", { r: 6, stroke: null });
        }
        const size = Math.min(44, bh * 0.38);
        const o = { size, font: "body" as const, weight: 800 };
        // quebra em linhas se couber na altura
        const words = api.t(b.title).split(" ");
        const lines: string[] = [];
        for (const wd of words) {
          const last = lines[lines.length - 1];
          if (last !== undefined && g.textWidth(last + " " + wd, o) <= bw - 26) lines[lines.length - 1] = last + " " + wd;
          else lines.push(wd);
        }
        const maxLines = Math.max(1, Math.floor((bh - 10) / (size * 1.05)));
        const show = lines.length <= maxLines ? lines : [api.t(b.title)];
        show.forEach((ln, li) => {
          g.text(ln, bx + wob + bw / 2 + 4, by + bh / 2 + (li - (show.length - 1) / 2) * size * 1.05, { ...o, color: C.ink, maxWidth: bw - 26 });
        });
      }
      // horário livre
      const fx = x + s.free.day * cw + pad;
      const fy = y + s.free.row * ch + pad;
      if (api.result === "win") {
        const drop = Math.min(1, s.after * 4);
        g.rect(fx, fy - (1 - drop) * 120, cw - pad * 2, ch - pad * 2, C.green, { r: 14, lw: 6 });
        g.text(api.t({ en: "BOOKED!", pt: "MARCADO!" }), fx + cw / 2 - pad, fy - (1 - drop) * 120 + ch / 2 - pad, {
          size: Math.min(48, ch * 0.4),
          color: C.white,
          stroke: C.ink,
          lw: 8,
          maxWidth: cw - 30,
        });
      } else if (api.result === "lose") {
        const pulse = 0.5 + Math.sin(s.after * 14) * 0.5;
        g.rect(fx, fy, cw - pad * 2, ch - pad * 2, null, { r: 14, stroke: C.green, lw: 6 + pulse * 6 });
        if (s.picked) {
          const px = x + (s.picked.day + 0.5) * cw;
          const py = y + (s.picked.row + 0.5) * ch;
          g.push();
          g.translate(Math.max(260, Math.min(w - 260, px)), py);
          g.rotate(-0.12);
          g.rect(-230, -50, 460, 100, C.red, { r: 14, lw: 7 });
          g.text(api.t({ en: "DOUBLE BOOKED!", pt: "CONFLITO!" }), 0, 2, { size: 58, color: C.white, maxWidth: 430 });
          g.pop();
        }
      }
    },
  };
}

export const freeSlot: Entry<S> = {
  def: {
    id: "free-slot",
    num: 24,
    name: { en: "Book a Room", pt: "Marca a Sala" },
    verb: { en: "BOOK IT!", pt: "MARCA!" },
    hint: { pointer: "tap" },
    category: "perception",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "A weekly calendar packed with silly meetings has exactly one free slot. Tap it. More time slots later, plus pale 'Focus time' and 'Lunch' blocks that look almost empty.",
    winText: "Tap the free slot.",
    loseText: "Tap a busy slot (double booking!), or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          io.tap(s.grid.x + (s.free.day + 0.5) * s.grid.cw, s.grid.y + (s.free.row + 0.5) * s.grid.ch);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const d = (s.free.day + 2) % 5;
          io.tap(s.grid.x + (d + 0.5) * s.grid.cw, s.grid.y + (s.free.row + 0.5) * s.grid.ch);
        },
      }
    : null,
};
