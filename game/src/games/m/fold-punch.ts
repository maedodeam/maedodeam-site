// 199 · UNFOLD IT! — uma folha é dobrada ao meio (duas vezes nos níveis altos) e furada.
// Escolha, entre três, como a folha fica quando desdobrada (os furos se espelham na dobra). Depois da escolha (ou do
// tempo acabar), a folha furada se desdobra na tela, dobra por dobra, para mostrar como ela fica aberta.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { isPortrait } from "./util.ts";

const N = 4;
type Cell = [number, number];
/** "v" = dobra vertical (esquerda sobre a direita); "h" = horizontal (cima sobre baixo); "vh" = as duas. */
type Fold = "v" | "h" | "vh";

interface S {
  fold: Fold;
  /** Furos feitos na folha dobrada (coordenadas da folha inteira). */
  punched: Cell[];
  options: Cell[][];
  answer: number;
  choices: Choices;
  t: number;
  /** Segundos desde o resultado (anima o desdobrar). */
  endT: number;
}

/** Atraso e duração de cada dobra desfeita na animação do resultado. */
const UNFOLD_DELAY = 0.12;
const UNFOLD_STEP = 0.42;
/** Tempo na tela depois do resultado: desdobra tudo e ainda dá para comparar com as opções. */
const AFTER = 1.9;

interface UnfoldStage {
  axis: "x" | "y";
  baseCs: number[];
  baseRs: number[];
  flapCs: number[];
  flapRs: number[];
}

/** Dobras a desfazer, da última para a primeira. */
function unfoldStages(fold: Fold): UnfoldStage[] {
  const all = [0, 1, 2, 3];
  const hi = [2, 3];
  const lo = [0, 1];
  if (fold === "v") return [{ axis: "x", baseCs: hi, baseRs: all, flapCs: lo, flapRs: all }];
  if (fold === "h") return [{ axis: "y", baseCs: all, baseRs: hi, flapCs: all, flapRs: lo }];
  return [
    { axis: "y", baseCs: hi, baseRs: hi, flapCs: hi, flapRs: lo },
    { axis: "x", baseCs: hi, baseRs: all, flapCs: lo, flapRs: all },
  ];
}

const key = (cells: Cell[]): string =>
  cells
    .map(([c, r]) => c * N + r)
    .sort((a, b) => a - b)
    .join(",");

function uniq(cells: Cell[]): Cell[] {
  const seen = new Set<number>();
  const out: Cell[] = [];
  for (const [c, r] of cells) {
    if (c < 0 || c >= N || r < 0 || r >= N) continue;
    const k = c * N + r;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([c, r]);
    }
  }
  return out;
}

const mirV = (cs: Cell[]): Cell[] => cs.map(([c, r]) => [N - 1 - c, r] as Cell);
const mirH = (cs: Cell[]): Cell[] => cs.map(([c, r]) => [c, N - 1 - r] as Cell);
const shift = (cs: Cell[], dc: number, dr: number): Cell[] => cs.map(([c, r]) => [c + dc, r + dr] as Cell);

function unfold(fold: Fold, f: Cell[]): Cell[] {
  if (fold === "v") return uniq([...f, ...mirV(f)]);
  if (fold === "h") return uniq([...f, ...mirH(f)]);
  const a = [...f, ...mirV(f)];
  return uniq([...a, ...mirH(a)]);
}

/** Erros típicos: copiar em vez de espelhar, espelhar no eixo errado, esquecer uma dobra. */
function decoys(fold: Fold, f: Cell[]): Cell[][] {
  const out: Cell[][] = [];
  if (fold === "v") {
    out.push(uniq([...f, ...shift(f, -2, 0)]), uniq([...f, ...mirH(f)]), uniq(f), uniq([...f, ...shift(mirH(f), -2, 0)]));
  } else if (fold === "h") {
    out.push(uniq([...f, ...shift(f, 0, -2)]), uniq([...f, ...mirV(f)]), uniq(f), uniq([...f, ...shift(mirV(f), 0, -2)]));
  } else {
    const a = [...f, ...shift(f, -2, 0)];
    out.push(uniq([...a, ...shift(a, 0, -2)]), uniq([...f, ...mirV(f)]), uniq([...f, ...mirH(f)]), uniq([...f, ...mirV(f), ...shift(f, 0, -2), ...shift(mirV(f), 0, -2)]));
  }
  return out;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const fold: Fold = lv >= 1 ? "vh" : rng.pick(["v", "h"] as const);
  const holes = lv >= 1.25 ? 2 : lv >= 1 ? 1 : lv >= 0.5 ? 2 : 1;
  // região que sobra depois de dobrar: metade direita / de baixo / quarto de baixo à direita
  const cols = fold === "h" ? [0, 1, 2, 3] : [2, 3];
  const rows = fold === "v" ? [0, 1, 2, 3] : [2, 3];
  let punched: Cell[] = [];
  let options: Cell[][] = [];
  let answer = 0;
  for (let tries = 0; tries < 60; tries++) {
    const pool: Cell[] = [];
    for (const c of cols) for (const r of rows) pool.push([c, r]);
    punched = rng.shuffle(pool).slice(0, holes);
    const right = unfold(fold, punched);
    const rk = key(right);
    const seen = new Set([rk]);
    const wrong: Cell[][] = [];
    for (const d of rng.shuffle(decoys(fold, punched))) {
      const k = key(d);
      if (d.length === 0 || seen.has(k)) continue;
      seen.add(k);
      wrong.push(d);
      if (wrong.length === 2) break;
    }
    if (wrong.length < 2) continue;
    options = rng.shuffle([right, ...wrong]);
    answer = options.findIndex((o) => key(o) === rk);
    break;
  }
  const s: S = {
    fold,
    punched,
    options,
    answer,
    choices: new Choices(api, 3, {
      area: portrait ? { x: 50, y: h * 0.56, w: w - 100, h: h * 0.3 } : { x: w * 0.12, y: h * 0.56, w: w * 0.76, h: h * 0.38 },
      maxCols: 3,
      gap: portrait ? 22 : 34,
    }),
    t: 0,
    endT: 0,
  };
  const opened = unfold(fold, punched);

  /** Folha inteira (ou parte dela) com grade fraca e furos. */
  const sheet = (g: Gfx, x: number, y: number, cell: number, cs: number[], rs: number[], hs: Cell[], fill: string = C.white) => {
    const c0 = Math.min(...cs);
    const r0 = Math.min(...rs);
    const sw = cs.length * cell;
    const sh = rs.length * cell;
    const ox = x + c0 * cell;
    const oy = y + r0 * cell;
    g.rect(ox + 6, oy + 8, sw, sh, C.ink, { r: 6, stroke: null });
    g.rect(ox, oy, sw, sh, fill, { r: 6, lw: 6 });
    for (let i = 1; i < cs.length; i++) g.line(ox + i * cell, oy + 6, ox + i * cell, oy + sh - 6, C.paper2, 3);
    for (let i = 1; i < rs.length; i++) g.line(ox + 6, oy + i * cell, ox + sw - 6, oy + i * cell, C.paper2, 3);
    for (const [c, r] of hs) {
      if (!cs.includes(c) || !rs.includes(r)) continue;
      g.circle(x + (c + 0.5) * cell, y + (r + 0.5) * cell, cell * 0.3, C.ink2, { lw: 4 });
    }
  };

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
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(c.x, c.y, C.yellow);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // passo a passo no alto: folha → dobrada (→ dobrada de novo) com furo
      const steps = s.fold === "vh" ? 3 : 2;
      const topH = portrait ? h * 0.42 : h * 0.44;
      const cell = Math.min(portrait ? 56 : 62, (w - 160) / (steps * N + (steps - 1) * 2.2));
      const sheetW = N * cell;
      const gapW = cell * 2.2;
      const total = steps * sheetW + (steps - 1) * gapW;
      const x0 = (w - total) / 2;
      const y0 = (portrait ? h * 0.1 : 70) + (topH - (portrait ? h * 0.1 : 70) - sheetW) / 2;
      const all = [0, 1, 2, 3];
      const half = [2, 3];
      for (let k = 0; k < steps; k++) {
        const x = x0 + k * (sheetW + gapW);
        // contorno tracejado da folha original
        if (k > 0) {
          g.push();
          g.ctx.setLineDash([12, 10]);
          g.rect(x, y0, sheetW, sheetW, null, { r: 6, lw: 4, stroke: C.brown });
          g.pop();
        }
        const last = k === steps - 1;
        let cs = all;
        let rs = all;
        if (k >= 1) {
          if (s.fold === "v" || s.fold === "vh") cs = half;
          if (s.fold === "h") rs = half;
        }
        if (k >= 2) rs = half;
        if (last && api.result) {
          // resultado: a folha furada se desdobra, dobra por dobra (a aba gira em torno da linha da dobra)
          const stages = unfoldStages(s.fold);
          let cur = -1;
          let p = 1;
          for (let i = 0; i < stages.length; i++) {
            const q = Math.max(0, Math.min(1, (s.endT - UNFOLD_DELAY - i * UNFOLD_STEP) / UNFOLD_STEP));
            if (q < 1) {
              cur = i;
              p = q * q * (3 - 2 * q);
              break;
            }
          }
          if (cur < 0) sheet(g, x, y0, cell, all, all, opened, C.white);
          else {
            const st = stages[cur];
            sheet(g, x, y0, cell, st.baseCs, st.baseRs, opened, C.yellow2);
            const f = -Math.cos(Math.PI * p);
            if (Math.abs(f) > 0.02) {
              const fx = x + 2 * cell;
              const fy = y0 + 2 * cell;
              g.push();
              if (st.axis === "x") {
                g.translate(fx, 0);
                g.scale(f, 1);
                g.translate(-fx, 0);
              } else {
                g.translate(0, fy);
                g.scale(1, f);
                g.translate(0, -fy);
              }
              sheet(g, x, y0, cell, st.flapCs, st.flapRs, opened, f < 0 ? C.yellow2 : C.white);
              g.pop();
            }
          }
          continue;
        }
        sheet(g, x, y0, cell, cs, rs, last ? s.punched : [], k === 0 ? C.white : C.yellow2);
        // linha da próxima dobra + seta
        if (!last) {
          const nextIsV = (s.fold === "v" && k === 0) || (s.fold === "vh" && k === 0);
          if (nextIsV) {
            g.push();
            g.ctx.setLineDash([14, 10]);
            g.line(x + sheetW / 2, y0 - 16, x + sheetW / 2, y0 + sheetW + 16, C.blue, 6);
            g.pop();
            g.arc(x + sheetW / 2, y0 - 10, sheetW * 0.28, Math.PI * 1.15, Math.PI * 1.85, C.blue, 7);
            g.shape(x + sheetW / 2 + sheetW * 0.25, y0 - 10 - sheetW * 0.1, [-14, -10, 14, 4, -6, 16], C.blue, { lw: 4 });
          } else {
            const cx0 = s.fold === "vh" ? x + sheetW * 0.75 : x + sheetW / 2;
            const span = s.fold === "vh" ? sheetW * 0.25 : sheetW / 2;
            g.push();
            g.ctx.setLineDash([14, 10]);
            g.line(cx0 - span - 16, y0 + sheetW / 2, cx0 + span + 16, y0 + sheetW / 2, C.blue, 6);
            g.pop();
            const ax0 = s.fold === "vh" ? x + sheetW / 2 - 10 : x - 10;
            g.arc(ax0, y0 + sheetW / 2, sheetW * 0.28, Math.PI * 0.65, Math.PI * 1.35, C.blue, 7);
            g.shape(ax0 - sheetW * 0.1, y0 + sheetW / 2 + sheetW * 0.25, [-10, -14, 4, 14, 16, -6], C.blue, { lw: 4 });
          }
          // seta entre passos
          const ax = x + sheetW + gapW / 2;
          g.shape(ax, y0 + sheetW / 2, [-cell * 0.6, -cell * 0.3, cell * 0.2, -cell * 0.3, cell * 0.2, -cell * 0.6, cell * 0.8, 0, cell * 0.2, cell * 0.6, cell * 0.2, cell * 0.3, -cell * 0.6, cell * 0.3], C.orange, { lw: 5 });
        } else {
          // furador
          const px = x + sheetW + 40;
          if (px + 60 < w && !api.result) {
            const py = y0 + sheetW * 0.2 + Math.abs(Math.sin(s.t * 5)) * 10;
            g.rect(px - 10, py - 40, 70, 60, C.gray2, { r: 10 });
            g.rect(px + 10, py + 20, 30, 26, C.gray, { r: 4 });
          }
        }
      }
      // a pergunta, entre o passo a passo e as opções (e, no fim, o que fazer com a animação)
      const choicesTop = h * 0.56;
      const qy = (y0 + sheetW + 14 + choicesTop) / 2;
      const qs = Math.min(50, (choicesTop - y0 - sheetW) * 0.42);
      if (!api.result) g.text(api.t({ en: "WHICH ONE IS IT, UNFOLDED?", pt: "COMO ELA FICA DESDOBRADA?" }), w / 2, qy, { size: qs, color: C.white, stroke: C.ink, lw: 9 });
      else if (api.result === "win") g.text(api.t({ en: "EXACTLY! IT OPENS LIKE THIS", pt: "ISSO! ELA ABRE ASSIM" }), w / 2, qy, { size: qs, color: C.yellow, stroke: C.ink, lw: 9 });
      else g.text(api.t({ en: "SEE HOW IT OPENS!", pt: "OLHA COMO ELA ABRE!" }), w / 2, qy, { size: qs, color: C.red, stroke: C.white, lw: 9 });
      s.choices.draw(
        g,
        (i, r) => {
          const c = (Math.min(r.w, r.h) * 0.78) / N;
          const sx = r.x + (r.w - c * N) / 2;
          const sy = r.y + (r.h - c * N) / 2;
          sheet(g, sx, sy, c, all, all, s.options[i]);
        },
        api.result ? s.answer : undefined,
        C.paper2,
      );
    },
  };
}

export const foldPunch: Entry<S> = {
  def: {
    id: "fold-punch",
    num: 199,
    name: { en: "Fold & Punch", pt: "Dobra e Fura" },
    verb: { en: "UNFOLD IT!", pt: "DESDOBRA!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "puzzle",
    family: "choice",
    goal: "complete",
    difficulty: 3,
    mechanic: "A sheet is folded in half and punched. Pick which of three sheets shows the holes once unfolded (mirrored across the fold). After the pick (or when time runs out) the punched sheet unfolds on screen, fold by fold, so you can see the answer. Later: two holes, then two folds.",
    winText: "Pick the correctly unfolded sheet.",
    loseText: "Pick a wrong sheet or run out of time.",
    timeScale: 1.6,
    minTime: 4.5,
    aftermath: AFTER,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2) return;
          if (!io.isDown) {
            const c = s.choices.center(s.answer);
            io.tap(c.x, c.y);
          }
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
