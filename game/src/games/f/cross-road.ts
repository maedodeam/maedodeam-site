// 113 · CROSS! — um colega com o café na mão precisa atravessar 3–4 faixas (5 depois). Cada toque (ou Espaço)
// dá um pulinho de uma faixa para a frente. Carros e patinetes passam em velocidades diferentes; ser atingido = derrota.
// Chegou na calçada do outro lado = vitória.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person, plant } from "../../gfx/art.ts";
import { bigText, isPortrait } from "./util.ts";

interface Veh {
  x0: number;
  len: number;
  kind: 0 | 1;
  color: string;
}
interface Lane {
  dir: 1 | -1;
  v: number;
  vehs: Veh[];
}
interface S {
  px: number;
  n: number;
  lanes: Lane[];
  loop: number;
  row: number;
  target: number;
  hopping: boolean;
  hopT: number;
  LH: number;
  roadTop: number;
  roadBot: number;
  SW: number;
  hit: boolean;
  t: number;
  endT: number;
}

const HOP = 0.16;
const HALF = 38;

/** Posição do centro do veículo no instante t. */
export function vehX(s: S, ln: Lane, vh: Veh, t: number): number {
  const L = s.loop;
  return ((((vh.x0 + ln.dir * ln.v * t) % L) + L) % L) - 300;
}

/** A fileira (1..n = faixas) está ocupada na posição do jogador no instante t? */
export function laneBusy(s: S, row: number, t: number, pad = 0): boolean {
  if (row < 1 || row > s.n) return false;
  const ln = s.lanes[row - 1];
  for (const vh of ln.vehs) {
    const x = vehX(s, ln, vh, t);
    if (Math.abs(x - s.px) < vh.len / 2 + HALF + pad) return true;
  }
  return false;
}

function rowY(s: S, row: number): number {
  if (row <= 0) return s.roadBot + s.SW * 0.55;
  if (row > s.n) return s.roadTop - s.SW * 0.45;
  return s.roadBot - (row - 0.5) * s.LH;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? 3 : lv < 1 ? 4 : 5;
  const SW = portrait ? 200 : 130;
  const LH = Math.min(portrait ? 190 : 170, (h - 2 * SW - 40) / n);
  const total = n * LH;
  const roadTop = (h - total) / 2 + (portrait ? 0 : 10);
  const loop = w + 600;
  const colors = [C.blue, C.red, C.yellow, C.purple, C.teal, C.green, C.pink];
  const lanes: Lane[] = [];
  for (let i = 0; i < n; i++) {
    const dir: 1 | -1 = i % 2 ? -1 : 1;
    const v = rng.range(280, 470) * (1 + 0.35 * lv);
    const minGap = 2 * HALF + v * (HOP + 0.5) + 40;
    const vehs: Veh[] = [];
    let x = rng.range(0, loop);
    let used = 0;
    for (let k = 0; k < 6; k++) {
      const kind: 0 | 1 = rng.chance(0.35) ? 1 : 0;
      const len = kind === 1 ? 120 : 220;
      const gap = minGap * rng.range(1, 1.7);
      if (used + len + gap > loop) break;
      vehs.push({ x0: x, len, kind, color: rng.pick(colors) });
      x = (x + len + gap) % loop;
      used += len + gap;
    }
    lanes.push({ dir, v, vehs });
  }
  const s: S = { px: w / 2, n, lanes, loop, row: 0, target: 0, hopping: false, hopT: 0, LH, roadTop, roadBot: roadTop + total, SW, hit: false, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      if (api.result) {
        s.endT += dt;
        if (s.hit) return;
      }
      s.t += dt;
      if (api.result) return;
      if (s.hopping) {
        s.hopT += dt;
        if (s.hopT >= HOP) {
          s.hopping = false;
          s.row = s.target;
          if (s.row > s.n) {
            api.sfx("chime");
            api.fx.burst(s.px, rowY(s, s.row) - 100, C.yellow, 16);
            api.win();
            return;
          }
        }
      }
      if (!s.hopping && api.input.actionPressed) {
        s.hopping = true;
        s.hopT = 0;
        s.target = s.row + 1;
        api.sfx("jump");
      }
      const occ = s.hopping ? (s.hopT < HOP / 2 ? s.row : s.target) : s.row;
      if (laneBusy(s, occ, s.t)) {
        s.hit = true;
        s.row = occ;
        s.hopping = false;
        api.sfx("thud");
        api.sfx("splash");
        api.fx.shake(0.8);
        api.fx.pop(s.px, rowY(s, occ) - 160, api.t({ en: "BEEP BEEP!", pt: "FOM FOM!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // calçadas
      g.rect(-10, s.roadBot, w + 20, h - s.roadBot + 10, C.paper2, { lw: 7 });
      g.rect(-10, -10, w + 20, s.roadTop + 10, C.paper2, { lw: 7 });
      for (let x = 0; x < w; x += 100) {
        g.line(x, s.roadBot, x, h, C.muted, 3);
        g.line(x, 0, x, s.roadTop, C.muted, 3);
      }
      // prédio do escritório do outro lado (o destino)
      const doorY = s.roadTop - 10;
      g.rect(w / 2 - 170, doorY - 170, 340, 170, C.blue2, { lw: 7 });
      g.rect(w / 2 - 50, doorY - 130, 100, 130, C.brown2, { lw: 6 });
      g.text(api.t({ en: "OFFICE", pt: "ESCRITÓRIO" }), w / 2, doorY - 150 < 30 ? 30 : doorY - 150, { size: 30, color: C.ink, maxWidth: 300 });
      plant(g, w * 0.12, s.roadTop - 10, 0.7);
      plant(g, w * 0.88, s.roadTop - 10, 0.7);
      // asfalto e faixas
      g.rect(-10, s.roadTop, w + 20, s.roadBot - s.roadTop, C.gray2, { stroke: null });
      for (let i = 1; i < s.n; i++) {
        const y = s.roadTop + i * s.LH;
        for (let x = 20; x < w; x += 140) g.rect(x, y - 5, 70, 10, C.white, { stroke: null });
      }
      // veículos
      for (let i = 0; i < s.n; i++) {
        const ln = s.lanes[i];
        const cy = rowY(s, i + 1);
        for (const vh of ln.vehs) {
          const x = vehX(s, ln, vh, s.t);
          if (x < -200 || x > w + 200) continue;
          g.push();
          g.translate(x, cy + s.LH * 0.18);
          g.scale(ln.dir, 1);
          if (vh.kind === 0) {
            g.rect(-vh.len / 2, -60, vh.len, 60, vh.color, { r: 18 });
            g.rect(-vh.len / 2 + 40, -104, vh.len * 0.55, 50, vh.color, { r: 16 });
            g.rect(-vh.len / 2 + 56, -94, vh.len * 0.2, 32, C.sky, { r: 6, lw: 4 });
            g.rect(-vh.len / 2 + 64 + vh.len * 0.22, -94, vh.len * 0.2, 32, C.sky, { r: 6, lw: 4 });
            g.circle(-vh.len / 2 + 46, 0, 22, C.ink2);
            g.circle(vh.len / 2 - 46, 0, 22, C.ink2);
            g.circle(vh.len / 2 - 10, -40, 9, C.yellow2, { lw: 3 });
          } else {
            g.circle(-40, 0, 18, C.ink2);
            g.circle(40, 0, 18, C.ink2);
            g.line(-40, -10, 40, -10, C.gray, 10);
            g.line(36, -10, 30, -90, C.gray, 8);
            person(g, -2, -14, 0.42, { shirt: vh.color, hat: C.yellow, mood: "happy", look: { x: 1, y: 0 } });
          }
          g.pop();
        }
      }
      // o colega com café (pulinho entre faixas)
      const from = rowY(s, s.row);
      const to = rowY(s, s.target);
      let y = from;
      let lift = 0;
      if (s.hopping) {
        const k = Math.min(1, s.hopT / HOP);
        y = from + (to - from) * k;
        lift = Math.sin(k * Math.PI) * 40;
      }
      const sc = Math.min(0.62, s.LH / 270);
      const feet = y + s.LH * 0.3 - lift;
      g.shadow(s.px, y + s.LH * 0.3, 40);
      person(g, s.px, feet, sc, { shirt: C.orange2, tie: C.blue, mood: s.hit ? "dizzy" : api.result === "win" ? "happy" : "worried", look: { x: 0, y: -1 }, tilt: s.hit ? 0.5 : 0 });
      if (!s.hit) cup(g, s.px + 40 * sc * 1.6, feet - 120 * sc, 0.45, C.white, true, g.time);
      else g.ellipse(s.px + 60, feet + 10, 60, 16, C.brown, { stroke: null });
      if (api.result === "win") bigText(g, api.t({ en: "MADE IT!", pt: "CHEGOU!" }), w / 2, Math.max(120, s.roadTop + 60), 100, C.yellow);
    },
  };
}

export const crossRoad: Entry<S> = {
  def: {
    id: "cross-road",
    num: 113,
    name: { en: "Cross the Street", pt: "Atravessa a Rua" },
    verb: { en: "CROSS!", pt: "ATRAVESSA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A coworker holding a coffee must cross 3 or 4 lanes (5 later). Each tap (or Space) hops one lane forward. Cars and scooters pass in each lane at different speeds; you cannot go back, so time each hop. Later there are more lanes and faster traffic.",
    winText: "Reach the far sidewalk.",
    loseText: "Get hit by a car or scooter, or time runs out.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0 || s.hopping || io.isDown) return;
          // busca em largura: em cada quadro, esperar ou pular (pulo = 5 quadros na faixa de origem, 6 na de destino;
          // a próxima decisão só vem depois que o pulo termina)
          const F = Math.round(HOP / dt);
          const half = Math.ceil(HOP / 2 / dt);
          const horizon = 300;
          const safe = (row: number, k: number) => !laneBusy(s, row, s.t + k * dt, 10);
          const prev = new Map<string, string>();
          let frontier: [number, number][] = [[0, s.row]];
          const seen = new Set<string>([`0,${s.row}`]);
          let goal: string | null = null;
          while (frontier.length && !goal) {
            const next: [number, number][] = [];
            for (const [f, r] of frontier) {
              if (f >= horizon) continue;
              // pular
              let ok = true;
              for (let j = 0; j < F && ok; j++) ok = safe(j < half ? r : r + 1, f + 1 + j);
              if (ok && safe(r + 1, f + F + 1)) {
                const key = `${f + F + 1},${r + 1}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  prev.set(key, `${f},${r},hop`);
                  if (r + 1 > s.n) {
                    goal = key;
                    break;
                  }
                  next.push([f + F + 1, r + 1]);
                }
              }
              // esperar
              if (safe(r, f + 1)) {
                const key = `${f + 1},${r}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  prev.set(key, `${f},${r},wait`);
                  next.push([f + 1, r]);
                }
              }
            }
            frontier = next.sort((a, b) => a[0] - b[0]);
          }
          if (!goal) return;
          let key = goal;
          let first = "wait";
          for (;;) {
            const p = prev.get(key);
            if (!p) break;
            const [f, r, act] = p.split(",");
            if (f === "0") {
              first = act;
              break;
            }
            key = `${f},${r}`;
          }
          if (first === "hop") io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io, dt) {
          // pula bem na frente de um carro chegando
          if (api.result || api.time <= 0 || s.hopping || io.isDown) return;
          if (s.row >= s.n) return;
          const t = s.t + dt * 7;
          if (laneBusy(s, s.row + 1, t) && !laneBusy(s, s.row, s.t + dt * 3)) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
