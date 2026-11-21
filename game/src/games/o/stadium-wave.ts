// 219 · DO THE WAVE! — a ola percorre a arquibancada em direção ao seu lugar (o torcedor com a seta).
// Toque (ou Espaço) exatamente quando ela chegar em você. Cedo demais = você levanta sozinho; tarde = a ola passou.
// Níveis altos: janela menor, a ola pode vir da direita e (lv ≥ 0.5) acelera e freia no caminho.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { isPortrait, bigText } from "./util.ts";

interface Fan {
  col: number;
  row: number;
  x: number;
  y: number;
  shirt: string;
  skin: string;
}
interface S {
  fans: Fan[];
  you: Fan;
  dir: number;
  x0: number;
  v: number;
  amp: number;
  omega: number;
  ta: number;
  tol: number;
  spacing: number;
  wx: number;
  jump: number;
  tapped: boolean;
  fail: "early" | "late" | null;
  t: number;
}

const SHIRTS = [C.red, C.blue, C.green, C.purple, C.orange, C.pink, C.white, C.teal];
const SKINS = [C.skin, C.skin2, "#8d5a3b", "#f7d7b5"];

/** Avanço da ola (coordenada ao longo do sentido de movimento). */
function waveAt(s: S, t: number): number {
  return s.x0 + s.v * t + s.amp * Math.sin(s.omega * t);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const spacing = portrait ? 108 : 118;
  const cols = Math.floor((w - 40) / spacing);
  const rows = portrait ? 7 : 4;
  const top = portrait ? h * 0.2 : h * 0.24;
  const rowH = portrait ? 168 : 150;
  const x0c = (w - (cols - 1) * spacing) / 2;
  const fans: Fan[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      fans.push({ col: c, row: r, x: x0c + c * spacing + (r % 2 ? spacing * 0.25 : -spacing * 0.25), y: top + r * rowH + 110, shirt: rng.pick(SHIRTS), skin: rng.pick(SKINS) });
    }
  }
  const dir = lv >= 0.5 && rng.chance(0.5) ? -1 : 1;
  // seu lugar fica na metade de chegada (a ola precisa de estrada antes)
  const yourRow = Math.floor(rows / 2);
  const colIdx = dir > 0 ? rng.int(Math.ceil(cols * 0.55), cols - 2) : rng.int(1, Math.floor(cols * 0.45));
  const you = fans.find((f) => f.row === yourRow && f.col === colIdx)!;
  you.shirt = C.yellow;
  // posição "ao longo" da ola: dir>0 → x; dir<0 → w − x
  const along = dir > 0 ? you.x : w - you.x;
  const dur = api.duration;
  const ta = rng.range(1.5, Math.max(1.6, Math.min(dur - 0.6, 2.4 + (1 - Math.min(1, lv)) * 0.6)));
  const start = -120;
  const v = (along - start) / ta;
  const omega = (Math.PI * 2) / 1.4;
  const amp = lv >= 0.5 ? (v * (0.35 + Math.min(0.5, lv) * 0.3)) / omega : 0;
  const phase0 = amp * Math.sin(omega * ta);
  const s: S = {
    fans,
    you,
    dir,
    x0: along - v * ta - phase0,
    v,
    amp,
    omega,
    ta,
    tol: 0.18 - lv * 0.035,
    spacing,
    wx: -999,
    jump: 0,
    tapped: false,
    fail: null,
    t: 0,
  };
  s.wx = waveAt(s, 0);

  return {
    s,
    update(dt) {
      s.t += dt;
      s.wx = waveAt(s, s.t);
      if (s.tapped) s.jump += dt;
      if (api.result) return;
      if (api.input.actionPressed) {
        s.tapped = true;
        s.jump = 0;
        const err = api.time - s.ta;
        if (Math.abs(err) <= s.tol) {
          api.sfx("chime");
          api.fx.burst(s.you.x, s.you.y - 120, C.yellow, 26);
          api.fx.pop(s.you.x, s.you.y - 200, api.t({ en: "WOOO!", pt: "UHUUU!" }), C.white);
          api.win();
        } else {
          s.fail = err < 0 ? "early" : "late";
          api.sfx("buzz");
          api.fx.pop(s.you.x, s.you.y - 200, err < 0 ? api.t({ en: "TOO EARLY", pt: "CEDO DEMAIS" }) : api.t({ en: "TOO LATE", pt: "TARDE DEMAIS" }), C.red);
          api.lose();
        }
        return;
      }
      if (api.time > s.ta + s.tol) {
        s.fail = "late";
        api.sfx("miss");
        api.fx.pop(s.you.x, s.you.y - 200, api.t({ en: "MISSED IT", pt: "PERDEU" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // holofotes e placar
      const sbW = Math.min(w * 0.6, 640);
      g.rect(w / 2 - sbW / 2, 30, sbW, portrait ? 150 : 110, C.ink2, { r: 14, stroke: C.gray, lw: 6 });
      bigText(g, api.t({ en: "WAVE!", pt: "OLA!" }), w / 2, portrait ? 105 : 85, portrait ? 80 : 64, C.yellow);
      // degraus
      const rows = Math.max(...s.fans.map((f) => f.row)) + 1;
      for (let r = 0; r < rows; r++) {
        const y = s.fans.find((f) => f.row === r)!.y;
        g.rect(-10, y - 20, w + 20, rows > 4 ? 168 : 150, r % 2 ? C.gray2 : C.gray, { lw: 5 });
      }
      const k = (x: number) => (s.dir > 0 ? x : w - x);
      for (const f of s.fans) {
        let lift: number;
        if (f === s.you) {
          lift = s.tapped ? Math.max(0, Math.sin(Math.min(1, s.jump / 0.5) * Math.PI)) : 0;
          if (api.result === "win") lift = Math.max(lift, 0.7);
        } else {
          const d = (s.wx - k(f.x)) / (s.spacing * 1.1);
          lift = Math.exp(-d * d);
        }
        const by = f.y - lift * 60;
        // corpo
        g.rect(f.x - 34, by - 70, 68, 90, f.shirt, { r: 18, lw: 5 });
        // braços (para cima com a ola)
        const ay = by - 60;
        const up = lift > 0.35;
        g.line(f.x - 30, ay, f.x - 46, up ? ay - 90 : ay + 50, f.skin, 14);
        g.line(f.x + 30, ay, f.x + 46, up ? ay - 90 : ay + 50, f.skin, 14);
        g.circle(f.x, by - 100, 34, f.skin, { lw: 5 });
        g.face(f.x, by - 96, 48, up ? "happy" : f === s.you && s.fail ? "sad" : "neutral", { x: s.dir * -0.6, y: 0 });
      }
      // seta "VOCÊ"
      if (!api.result || api.result === "win") {
        const bob = Math.sin(g.time * 8) * 10;
        const ay = s.you.y - 230 + bob - (s.tapped ? 60 : 0);
        g.shape(s.you.x, ay, [-30, -30, 30, -30, 0, 16], C.yellow, { lw: 6 });
        bigText(g, api.t({ en: "YOU", pt: "VOCÊ" }), s.you.x, ay - 60, 48, C.yellow);
      }
      g.circle(s.you.x, s.you.y - 70, 84, null, { stroke: C.ink, lw: 16 });
      g.circle(s.you.x, s.you.y - 70, 84, null, { stroke: C.yellow, lw: 9 });
    },
  };
}

export const stadiumWave: Entry<S> = {
  def: {
    id: "stadium-wave",
    num: 219,
    name: { en: "Stadium Wave", pt: "Ola" },
    verb: { en: "DO THE WAVE!", pt: "FAZ A OLA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "A stadium wave runs through the crowd toward your highlighted seat. Tap (or Space) exactly when it reaches you. Later it speeds up and slows down on the way.",
    winText: "Stand up exactly when the wave reaches you.",
    loseText: "Stand up too early, or let the wave pass you by.",
    minTime: 3.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.tapped) return;
          if (api.time + dt >= s.ta - 0.01) {
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space");
          }
        },
        lose(s, api, io, dt) {
          // Ansioso: levanta antes da ola chegar.
          if (api.result || s.tapped) return;
          if (api.time + dt >= s.ta - 0.45) io.tap(s.you.x, s.you.y);
        },
      }
    : null,
};
