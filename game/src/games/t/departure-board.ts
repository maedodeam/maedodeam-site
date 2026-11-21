// 283 · NEXT TRAIN! — um painel de partidas com destinos, horários e plataformas, e o relógio da estação.
// A pergunta: "PRÓXIMO TREM PARA X?". Toque na plataforma certa (ou aperte o número).
// Níveis altos: mais linhas e uma 5ª plataforma (lv ≥ 0.5), um trem para X que já partiu (lv ≥ 0.5)
// e atrasos que mudam qual é o próximo (lv ≥ 1).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { bigText, btnCenter, drawBtn, fitText, inBtn, isPortrait, type Btn } from "./util.ts";

interface Row {
  dest: string;
  time: number;
  delay: number;
  plat: number;
}
interface S {
  rows: Row[];
  now: number;
  target: string;
  answer: number;
  decoy: number;
  plats: number;
  btns: Btn[];
  picked: number;
  board: { x: number; y: number; w: number; h: number };
  banner: number;
  t: number;
  endT: number;
}

const CITIES = ["VALEMAR", "NORTELA", "BRUMA", "SOLANA", "PEDRAS", "ARVORA", "LUMEN", "CORAL", "QUINTA", "OLIVAL"];

function hhmm(m: number): string {
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const nRows = lv < 0.5 ? 4 : lv < 1 ? 5 : 6;
  const plats = lv < 0.5 ? 4 : 5;
  const now = rng.int(6, 21) * 60 + rng.int(0, 11) * 5;
  const cities = rng.shuffle(CITIES);
  const target = cities[0];
  const platOrder = rng.shuffle(Array.from({ length: plats }, (_, i) => i + 1));
  const rows: Row[] = [];
  // dois trens futuros para X
  const a = rng.int(1, 4) * 5;
  const b = a + rng.int(2, 5) * 5;
  const first: Row = { dest: target, time: now + a, delay: 0, plat: platOrder[0] };
  const second: Row = { dest: target, time: now + b, delay: 0, plat: platOrder[1] };
  rows.push(first, second);
  if (lv >= 1) first.delay = b - a + rng.int(1, 3) * 5;
  let past: Row | null = null;
  if (lv >= 0.5) {
    past = { dest: target, time: now - rng.int(1, 4) * 5, delay: 0, plat: platOrder[2] };
    rows.push(past);
  }
  let ci = 1;
  while (rows.length < nRows) {
    const r: Row = { dest: cities[ci++], time: now + rng.int(lv >= 0.5 ? -3 : 1, 9) * 5, delay: 0, plat: rng.int(1, plats) };
    if (lv >= 1 && rng.chance(0.4)) r.delay = rng.int(1, 4) * 5;
    rows.push(r);
  }
  rows.sort((p, q) => p.time - q.time || p.dest.localeCompare(q.dest));
  const next = rows.filter((r) => r.dest === target && r.time + r.delay >= now).sort((p, q) => p.time + p.delay - (q.time + q.delay))[0];
  const answer = next.plat;
  // engano mais provável: o primeiro trem para X que aparece na lista (já partiu, ou atrasado)
  const listed = rows.find((r) => r.dest === target && r !== next);
  const decoy = listed ? listed.plat : (answer % plats) + 1;

  // layout
  const banner = portrait ? 150 : 82;
  const board = portrait ? { x: 50, y: 250, w: w - 100, h: h * 0.5 } : { x: w > 1300 ? 120 : 50, y: 150, w: w > 1300 ? w - 240 : w - 100, h: h * 0.56 };
  const by = board.y + board.h + (portrait ? 170 : 90);
  const bh = portrait ? 220 : h - by - 50;
  const gap = 24;
  const bw = Math.min(260, (board.w - gap * (plats - 1)) / plats);
  const x0 = w / 2 - (plats * bw + (plats - 1) * gap) / 2;
  const btns: Btn[] = Array.from({ length: plats }, (_, i) => ({ x: x0 + i * (bw + gap), y: by, w: bw, h: bh }));
  const s: S = { rows, now, target, answer, decoy, plats, btns, picked: -1, board, banner, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      let p = -1;
      if (inp.pressed) for (let i = 0; i < s.btns.length; i++) if (inBtn({ x: inp.x, y: inp.y }, s.btns[i], 12)) p = i + 1;
      if (inp.digit !== null && inp.digit >= 1 && inp.digit <= s.plats) p = inp.digit;
      if (p < 0) return;
      s.picked = p;
      const c = btnCenter(s.btns[p - 1]);
      if (p === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow, 16);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.fx.pop(c.x, c.y - 80, api.t({ en: "WRONG TRAIN!", pt: "TREM ERRADO!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // pergunta
      const q = api.t({ en: `NEXT TRAIN TO ${s.target}?`, pt: `PRÓXIMO TREM PARA ${s.target}?` });
      g.push();
      fitText(g, q, w / 2, s.banner - (portrait ? 40 : 0), w - 80, { size: portrait ? 76 : 70, color: C.yellow, stroke: C.ink, lw: 12 });
      g.pop();
      const nowLabel = api.t({ en: "NOW", pt: "AGORA" }) + " " + hhmm(s.now);
      if (portrait) bigText(g, nowLabel, w / 2, s.banner + 50, 64, C.white);
      // painel
      const b = s.board;
      g.rect(b.x + 8, b.y + 14, b.w, b.h, C.ink, { r: 22, stroke: null });
      g.rect(b.x, b.y, b.w, b.h, C.ink2, { r: 22, lw: 7 });
      const rowH = b.h / (s.rows.length + 1);
      const fs = Math.min(50, rowH * 0.6);
      const cTime = b.x + b.w * 0.05;
      const cDest = b.x + b.w * 0.25;
      const cPlat = b.x + b.w * 0.68;
      const cStat = b.x + b.w * 0.8;
      const hy = b.y + rowH * 0.55;
      const head = { size: fs * 0.7, font: "mono" as const, weight: 800, align: "left" as const, color: C.muted };
      g.text(api.t({ en: "TIME", pt: "HORA" }), cTime, hy, head);
      g.text(api.t({ en: "TO", pt: "DESTINO" }), cDest, hy, head);
      g.text(api.t({ en: "PLAT.", pt: "PLAT." }), cPlat, hy, head);
      if (!portrait) g.text(nowLabel, b.x + b.w - 30, hy, { ...head, align: "right", color: C.white, size: fs * 0.85 });
      g.line(b.x + 20, b.y + rowH, b.x + b.w - 20, b.y + rowH, C.gray2, 4);
      for (let i = 0; i < s.rows.length; i++) {
        const r = s.rows[i];
        const y = b.y + rowH * (i + 1.5);
        const isX = r.dest === s.target;
        const col = isX ? C.yellow : C.orange2;
        const o = { size: fs, font: "mono" as const, weight: 800, align: "left" as const, color: col };
        g.text(hhmm(r.time), cTime, y, o);
        g.text(r.dest, cDest, y, { ...o, maxWidth: cPlat - cDest - 20 });
        g.text(String(r.plat), cPlat + 20, y, o);
        if (r.delay > 0) {
          g.rect(cStat - 10, y - fs * 0.55, b.x + b.w - cStat - 10, fs * 1.1, C.red, { r: 8, stroke: null });
          g.text(`+${r.delay}'`, cStat + 6, y, { ...o, color: C.white, size: fs * 0.85 });
        }
        if (api.result && r.plat === s.answer && isX && r.time + r.delay >= s.now) g.rect(b.x + 12, y - rowH * 0.46, b.w - 24, rowH * 0.92, null, { r: 10, lw: 6, stroke: C.green });
      }
      // plataformas
      const ly = s.btns[0].y - (portrait ? 60 : 30);
      g.text(api.t({ en: "PLATFORM", pt: "PLATAFORMA" }), w / 2, ly, { size: 40, color: C.white, stroke: C.ink, lw: 8 });
      for (let i = 0; i < s.btns.length; i++) {
        const bt = s.btns[i];
        const p = i + 1;
        const fill = api.result && p === s.answer ? C.green : api.result === "lose" && p === s.picked ? C.red : C.white;
        drawBtn(g, bt, fill, s.picked === p);
        const c = btnCenter(bt);
        g.text(String(p), c.x + (s.picked === p ? 5 : 0), c.y + (s.picked === p ? 8 : 0), { size: Math.min(bt.h, bt.w) * 0.6, color: C.ink });
      }
      if (api.result === "win") bigText(g, api.t({ en: "ALL ABOARD!", pt: "EMBARQUE!" }), w / 2, b.y + b.h / 2, 96, C.green);
    },
  };
}

export const departureBoard: Entry<S> = {
  def: {
    id: "departure-board",
    num: 283,
    name: { en: "Departure Board", pt: "Painel de Partidas" },
    verb: { en: "NEXT TRAIN!", pt: "PRÓXIMO TREM!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A departures board lists destinations, times and platforms, next to the station clock. The question asks for the next train to one destination; tap its platform (or press its number). Later there are more rows, a train that already left, and delays that change which one is next.",
    winText: "Pick the platform of the next train to that destination.",
    loseText: "Pick another platform, or time runs out.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.4) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const c = btnCenter(s.btns[s.answer - 1]);
          io.tap(c.x, c.y);
          m.done = true;
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.4) return;
          const m = mem(s, () => ({ done: false }));
          if (m.done) return;
          const c = btnCenter(s.btns[s.decoy - 1]);
          io.tap(c.x, c.y);
          m.done = true;
        },
      }
    : null,
};
