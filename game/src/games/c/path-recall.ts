// 046 · RETRACE! — o robô de limpeza mostra um caminho pelo piso e as luzes apagam. Refaça o caminho na ordem.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix, siren } from "./util.ts";

interface Cell {
  c: number;
  r: number;
}
interface S {
  n: number;
  path: Cell[];
  step: number;
  phase: "show" | "input";
  stepT: number;
  showEnd: number;
  cs: number;
  x0: number;
  y0: number;
  last: number; // última casa registrada (índice c + r*n), para não repetir
  wrong: Cell | null;
  clock: number;
  doneAt: number;
}

const LEAD = 0.4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const n = lv < 1 ? 4 : 5;
  const len = Math.round(mix(4, 7, p));
  // passeio sem repetir casas, de preferência com curvas
  let path: Cell[] = [];
  for (let tries = 0; tries < 200 && path.length < len; tries++) {
    path = [{ c: rng.int(0, n - 1), r: rng.int(0, n - 1) }];
    let dir = -1;
    while (path.length < len) {
      const cur = path[path.length - 1];
      const opts = [0, 1, 2, 3].filter((d) => {
        const c = cur.c + [1, 0, -1, 0][d];
        const r = cur.r + [0, 1, 0, -1][d];
        return c >= 0 && r >= 0 && c < n && r < n && !path.some((q) => q.c === c && q.r === r);
      });
      if (!opts.length) break;
      // evita seguir reto muitas vezes: fica mais interessante de memorizar
      const turn = opts.filter((d) => d !== dir);
      const d = turn.length && rng.chance(0.6) ? rng.pick(turn) : rng.pick(opts);
      dir = d;
      path.push({ c: cur.c + [1, 0, -1, 0][d], r: cur.r + [0, 1, 0, -1][d] });
    }
  }
  const portrait = h > w;
  const board = Math.min(w, h) * (portrait ? 0.86 : 0.8);
  const cs = Math.min(200, board / n);
  const stepT = mix(0.32, 0.18, p);
  const s: S = {
    n,
    path,
    step: 0,
    phase: "show",
    stepT,
    showEnd: LEAD + stepT * (path.length + 1) + 0.25,
    cs,
    x0: w / 2 - (cs * n) / 2,
    y0: (portrait ? h * 0.52 : h * 0.54) - (cs * n) / 2,
    last: -1,
    wrong: null,
    clock: 0,
    doneAt: 0,
  };

  const centerOf = (c: Cell) => ({ x: s.x0 + (c.c + 0.5) * s.cs, y: s.y0 + (c.r + 0.5) * s.cs });
  const enter = (c: Cell) => {
    if (api.result) return;
    const key = c.c + c.r * s.n;
    if (key === s.last) return;
    s.last = key;
    const want = s.path[s.step];
    if (want.c === c.c && want.r === c.r) {
      s.step++;
      api.sfx(s.step === s.path.length ? "chime" : "tap");
      if (s.step === s.path.length) {
        const q = centerOf(c);
        api.fx.burst(q.x, q.y, C.yellow, 22);
        s.doneAt = s.clock;
        api.win();
      }
      return;
    }
    // voltar por casas já feitas não conta
    if (s.path.slice(0, s.step).some((q) => q.c === c.c && q.r === c.r)) return;
    s.wrong = c;
    s.doneAt = s.clock;
    api.sfx("buzz");
    api.fx.shake(0.6);
    api.lose();
  };

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (s.phase === "show") {
        const k = Math.floor((api.time - LEAD) / s.stepT);
        const prev = Math.floor((api.time - dt - LEAD) / s.stepT);
        if (k !== prev && k >= 0 && k < s.path.length) api.sfx("beep");
        if (api.time >= s.showEnd) {
          s.phase = "input";
          api.sfx("swoosh");
        }
        return;
      }
      if (api.result) return;
      const inp = api.input;
      if (inp.down || inp.pressed) {
        // amostra o trajeto do quadro em passos curtos: um gesto rápido não pula casas
        const pts: { x: number; y: number }[] = [];
        if (inp.pressed) {
          s.last = -1;
          pts.push({ x: inp.startX, y: inp.startY });
        }
        for (const [a, b] of inp.segments) {
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (s.cs * 0.15)));
          for (let i = 1; i <= steps; i++) pts.push({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
        }
        if (!pts.length) pts.push({ x: inp.x, y: inp.y });
        for (const pt of pts) {
          const fc = (pt.x - s.x0) / s.cs;
          const fr = (pt.y - s.y0) / s.cs;
          const c = Math.floor(fc);
          const r = Math.floor(fr);
          if (c < 0 || r < 0 || c >= s.n || r >= s.n) continue;
          // só conta perto do centro da casa: cortar a quina de outra casa não é erro
          if (Math.abs(fc - c - 0.5) > 0.38 || Math.abs(fr - r - 0.5) > 0.38) continue;
          enter({ c, r });
          if (api.result) break;
        }
      }
      if (api.result) return;
      // setas: partem da primeira casa
      const dirs: [string, number, number][] = [
        ["left", -1, 0],
        ["right", 1, 0],
        ["up", 0, -1],
        ["down", 0, 1],
      ];
      for (const [name, dc, dr] of dirs) {
        if (!inp.keyPressed(name as "left")) continue;
        if (s.step === 0) {
          s.last = -1;
          enter(s.path[0]);
        }
        const cur = s.path[s.step - 1];
        const c = cur.c + dc;
        const r = cur.r + dr;
        if (c < 0 || r < 0 || c >= s.n || r >= s.n) continue;
        s.last = -1;
        enter({ c, r });
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const cs = s.cs;
      const N = s.n;
      const showing = s.phase === "show";
      const k = Math.floor((api.time - LEAD) / s.stepT);
      const lit = showing ? Math.min(s.path.length, k + 1) : 0;
      const fade = showing && api.time > s.showEnd - 0.25 ? (s.showEnd - api.time) / 0.25 : 1;
      // piso
      g.rect(s.x0 - 26, s.y0 - 26, cs * N + 52, cs * N + 52, C.ink2, { r: 26 });
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const x = s.x0 + c * cs;
          const y = s.y0 + r * cs;
          const idx = s.path.findIndex((q) => q.c === c && q.r === r);
          let fill: string = (r + c) % 2 ? C.gray : C.gray2;
          if (showing && idx >= 0 && idx < lit) fill = C.yellow;
          if (!showing && idx >= 0 && idx < s.step) fill = C.green;
          if (s.wrong && s.wrong.c === c && s.wrong.r === r) fill = C.red;
          // depois do erro, mostra o caminho certo
          const reveal = api.result === "lose" && idx >= s.step;
          g.rect(x + 6, y + 6, cs - 12, cs - 12, fill, { r: 14, lw: 6 });
          if (showing && idx >= 0 && idx < lit && fade < 1) {
            g.push();
            g.alpha(1 - fade);
            g.rect(x + 6, y + 6, cs - 12, cs - 12, (r + c) % 2 ? C.gray : C.gray2, { r: 14, lw: 6 });
            g.pop();
          }
          if (reveal) g.rect(x + cs * 0.3, y + cs * 0.3, cs * 0.4, cs * 0.4, null, { r: 10, stroke: C.yellow, lw: 8 });
          if ((showing && idx >= 0 && idx < lit && fade > 0.5) || (!showing && idx >= 0 && idx < s.step)) {
            // pegadas do robô
            g.circle(x + cs * 0.38, y + cs * 0.58, cs * 0.07, C.ink, { stroke: null });
            g.circle(x + cs * 0.62, y + cs * 0.42, cs * 0.07, C.ink, { stroke: null });
          }
        }
      }
      // robô de limpeza: mostra o caminho, depois espera no último ponto acertado
      let rc: { x: number; y: number };
      if (showing) {
        const u = Math.max(0, (api.time - LEAD) / s.stepT);
        const i = Math.min(s.path.length - 1, Math.floor(u));
        const j = Math.min(s.path.length - 1, i + 1);
        const f = Math.min(1, Math.max(0, (u - i - 0.6) / 0.4));
        const a = s.path[i];
        const b = s.path[j];
        rc = { x: s.x0 + (a.c + 0.5 + (b.c - a.c) * f) * cs, y: s.y0 + (a.r + 0.5 + (b.r - a.r) * f) * cs };
      } else {
        const a = s.path[Math.max(0, s.step - 1)];
        rc = { x: s.x0 + (a.c + 0.5) * cs, y: s.y0 + (a.r + 0.5) * cs };
      }
      const rr = cs * 0.32;
      const hop = api.result === "win" ? Math.abs(Math.sin((s.clock - s.doneAt) * 14)) * 24 : 0;
      g.ellipse(rc.x, rc.y + rr * 0.5, rr, rr * 0.35, "rgba(0,0,0,0.3)", { stroke: null });
      g.circle(rc.x, rc.y - hop, rr, C.white, { lw: 7 });
      g.circle(rc.x, rc.y - hop, rr * 0.7, C.sky, { lw: 4 });
      g.face(rc.x, rc.y - hop, rr * 1.1, api.result === "lose" ? "dizzy" : api.result === "win" ? "happy" : showing ? "neutral" : "worried");
      // dica: início do caminho na vez do jogador
      if (!showing && s.step === 0 && !api.result) {
        const a = s.path[0];
        const pulse = 0.5 + 0.5 * Math.sin(s.clock * 10);
        g.rect(s.x0 + a.c * cs + 6, s.y0 + a.r * cs + 6, cs - 12, cs - 12, null, { r: 14, stroke: C.yellow, lw: 6 + pulse * 6 });
      }
      const label = showing ? api.t({ en: "WATCH…", pt: "OLHA…" }) : api.result ? "" : api.t({ en: "YOUR TURN!", pt: "SUA VEZ!" });
      if (label) g.text(label, w / 2, Math.max(60, s.y0 - 70), { size: 60, font: "mono", color: showing ? C.yellow : C.green });
      if (api.result === "lose") siren(g, w / 2, Math.max(50, s.y0 - 90), 40, s.clock, true);
    },
  };
}

export const pathRecall: Entry<S> = {
  def: {
    id: "path-recall",
    num: 46,
    name: { en: "Retrace", pt: "Refaz o Caminho" },
    verb: { en: "RETRACE!", pt: "REFAZ!" },
    hint: { pointer: "drag", keys: "arrows" },
    category: "memory",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "A cleaning robot lights up a path of 4 to 7 tiles on a 4x4 (or 5x5) floor, then the lights go out. Drag through the same tiles in order (or tap them, or use the arrows starting from the first tile).",
    winText: "Retrace the whole path.",
    loseText: "Step on a wrong tile, or time runs out.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (s.phase !== "input" || api.result) return;
          const m = mem(s, () => ({ started: false }));
          const at = (i: number) => ({ x: s.x0 + (s.path[i].c + 0.5) * s.cs, y: s.y0 + (s.path[i].r + 0.5) * s.cs });
          if (!m.started) {
            const a = at(0);
            io.down(a.x, a.y);
            m.started = true;
            return;
          }
          const tgt = at(Math.min(s.step, s.path.length - 1));
          const dx = tgt.x - io.px;
          const dy = tgt.y - io.py;
          const d = Math.hypot(dx, dy);
          const stepLen = 2200 * dt;
          if (d <= stepLen) io.move(tgt.x, tgt.y);
          else io.move(io.px + (dx / d) * stepLen, io.py + (dy / d) * stepLen);
        },
        lose(s, api, io) {
          if (s.phase !== "input" || api.result) return;
          // toca uma casa fora do caminho
          for (let r = 0; r < s.n; r++)
            for (let c = 0; c < s.n; c++) {
              if (s.path.some((q) => q.c === c && q.r === r)) continue;
              io.tap(s.x0 + (c + 0.5) * s.cs, s.y0 + (r + 0.5) * s.cs);
              return;
            }
        },
      }
    : null,
};
