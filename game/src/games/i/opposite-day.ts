// 147 · OPPOSITE DAY! — WTF Moment insano: o chefe-discoteca numa pista psicodélica mostra passos de dança como setas,
// no ritmo. Deslize para o lado OPOSTO a cada batida (esquerda↔direita, cima↔baixo). Mesmo lado ou perder a batida = perde.
import type { Dir, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { arrow, isPortrait, OPP, stepSwipe } from "./util.ts";

const ALL: Dir[] = ["left", "right", "up", "down"];

interface S {
  dirs: Dir[];
  done: boolean[];
  n: number;
  t0: number;
  P: number;
  ok: number;
  fail: "" | "same" | "wrong" | "late";
  failAt: number;
  lastOkAt: number;
  t: number;
}

function activeIndex(s: S, t: number): number {
  if (t < s.t0) return -1;
  return Math.min(s.n - 1, Math.floor((t - s.t0) / s.P));
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // cada passo tem tempo de sobra para ler a seta e pensar no contrário (1,3 s no começo, 1 s no fim); cabem quantos
  // passos o tempo do microgame deixar, de 3 a 5
  const P = 1.3 - 0.2 * lv;
  const t0 = 0.6;
  const n = Math.max(3, Math.min(lv < 0.5 ? 4 : 5, Math.floor((api.duration - t0 - 0.25) / P)));
  const dirs: Dir[] = [];
  for (let i = 0; i < n; i++) {
    let d = rng.pick(ALL);
    // sem a mesma seta três vezes seguidas
    if (i >= 2 && dirs[i - 1] === d && dirs[i - 2] === d) d = OPP[d];
    dirs.push(d);
  }
  const s: S = {
    dirs,
    done: dirs.map(() => false),
    n,
    t0,
    P,
    ok: 0,
    fail: "",
    failAt: 0,
    lastOkAt: -9,
    t: 0,
  };
  let lastBeat = -1;
  let started = false;

  const fail = (why: S["fail"]) => {
    s.fail = why;
    s.failAt = s.t;
    api.sfx("glitch");
    api.sfx("buzz");
    api.fx.shake(0.8);
    api.lose();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (!started) {
        started = true;
        api.sfx("warp");
      }
      if (api.result) return;
      const k = activeIndex(s, s.t);
      if (k !== lastBeat && k >= 0) {
        // fim da janela anterior sem passo = perdeu a batida
        if (lastBeat >= 0 && !s.done[lastBeat]) {
          fail("late");
          return;
        }
        lastBeat = k;
        api.sfx("drum");
      }
      if (k === s.n - 1 && s.t >= s.t0 + s.n * s.P && !s.done[k]) {
        fail("late");
        return;
      }
      const sw = api.input.swipe;
      if (!sw || k < 0 || s.done[k]) return;
      const want = OPP[s.dirs[k]];
      if (sw === want) {
        s.done[k] = true;
        s.ok++;
        s.lastOkAt = s.t;
        api.sfx(s.ok % 2 ? "boing" : "kazoo");
        api.fx.burst(w / 2, h / 2, psyColor(s.t, s.ok * 60), 16);
        if (s.ok >= s.n) {
          api.sfx("tada");
          api.win();
        }
      } else fail(sw === s.dirs[k] ? "same" : "wrong");
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 1, w / 2, h * 0.4);
      const wob = psyWobble(t, 1.4);
      // pista de dança quadriculada piscando
      const floorY = portrait ? h * 0.62 : h * 0.66;
      const tile = 120;
      g.push();
      g.translate(wob.dx * 0.5, 0);
      for (let y = floorY; y < h + tile; y += tile) {
        for (let x = -tile; x < w + tile; x += tile) {
          const i = Math.floor(x / tile) + Math.floor(y / tile) * 3;
          g.rect(x, y, tile, tile, psyColor(t * 2, i * 47, 95, 55 + ((i + Math.floor(t * 4)) % 2) * 15), { lw: 4 });
        }
      }
      g.pop();
      // bola de espelhos
      const bx = portrait ? w * 0.82 : w * 0.5;
      g.line(bx, 0, bx, 70, C.ink, 5);
      g.circle(bx, 120, 52, C.paper2, { lw: 6 });
      for (let i = 0; i < 6; i++) g.rect(bx - 40 + (i % 3) * 28, 90 + Math.floor(i / 3) * 30, 20, 20, psyColor(t, i * 60, 100, 75), { stroke: null });
      psyWash(g, t, 0.12);
      // o chefe dançando e você
      const k = activeIndex(s, s.t);
      const cur = k >= 0 ? s.dirs[k] : null;
      const bossX = portrait ? w * 0.3 : w * 0.2;
      const youX = portrait ? w * 0.72 : w * 0.84;
      const feetY = portrait ? h * 0.86 : h * 0.93;
      const sc = portrait ? 1.7 : 1.45;
      const beatK = s.t < s.t0 ? 0 : ((s.t - s.t0) % s.P) / s.P;
      const bounce = Math.abs(Math.sin(beatK * Math.PI)) * 18;
      g.push();
      g.translate(wob.dx, wob.dy);
      const lean = (d: Dir | null) => (d === "left" ? -0.25 : d === "right" ? 0.25 : 0);
      boss(g, bossX, feetY - bounce, sc, { mood: s.fail ? "shock" : "smug", tilt: lean(cur) });
      drawArm(g, bossX, feetY - bounce - 120 * sc, cur, sc);
      const youDir = k >= 0 && s.done[k] ? OPP[s.dirs[k]] : null;
      const youMood = s.fail ? "dizzy" : api.result === "win" ? "happy" : youDir ? "happy" : "worried";
      person(g, youX, feetY - (youDir ? bounce : 0), sc, { shirt: C.pink, hair: C.purple, mood: youMood, tilt: lean(youDir) });
      drawArm(g, youX, feetY - (youDir ? bounce : 0) - 120 * sc, youDir, sc);
      g.pop();
      // a carta da seta: nítida, contorno sólido, sem tremer
      const cs = portrait ? 400 : w < 1300 ? 320 : 380;
      const cx = portrait ? w / 2 : w < 1300 ? w * 0.6 : w / 2;
      const cy = portrait ? h * 0.32 : h * 0.4;
      g.rect(cx - cs / 2 + 12, cy - cs / 2 + 14, cs, cs, C.ink, { r: 36, stroke: null });
      const doneNow = k >= 0 && s.done[k];
      g.rect(cx - cs / 2, cy - cs / 2, cs, cs, doneNow ? C.green2 : C.white, { r: 36, lw: 10 });
      if (cur && !s.fail) {
        if (doneNow) arrow(g, cx, cy, cs * 0.62, OPP[cur], C.green, 10);
        else arrow(g, cx, cy, cs * 0.66, cur, C.ink, 10);
        // relógio da batida (arco que esvazia)
        if (!doneNow && !api.result) g.arc(cx, cy, cs * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - beatK), C.orange, 16);
      } else if (s.fail && cur) {
        arrow(g, cx, cy, cs * 0.62, cur, C.red, 10);
        g.text("X", cx, cy, { size: cs * 0.6, color: C.ink });
      } else {
        g.text(api.t({ en: "READY…", pt: "PRONTO…" }), cx, cy, { size: cs * 0.18, color: C.ink });
      }
      g.text(api.t({ en: "BOSS DOES", pt: "O CHEFE FAZ" }), cx, cy - cs / 2 - 40, { size: 44, color: C.white, stroke: C.ink, lw: 10 });
      // progresso
      for (let i = 0; i < s.n; i++) {
        const px = cx + (i - (s.n - 1) / 2) * 56;
        g.circle(px, cy + cs / 2 + 50, 20, s.done[i] ? C.green : C.white, { lw: 5 });
      }
      // título absurdo (só decoração)
      const ty = portrait ? h * 0.08 : h * 0.08;
      wobbleText(g, api.t({ en: "DO THE OPPOSITE!", pt: "FAÇA O CONTRÁRIO!" }), w / 2 + (portrait ? -60 : 0), ty, t, { size: portrait ? 64 : 70, stroke: C.ink, lw: 10 }, 12);
      if (s.fail) {
        const msg = s.fail === "late" ? api.t({ en: "MISSED THE BEAT!", pt: "PERDEU A BATIDA!" }) : s.fail === "same" ? api.t({ en: "SAME WAY!", pt: "IGUALZINHO!" }) : api.t({ en: "WRONG WAY!", pt: "LADO ERRADO!" });
        g.text(msg, w / 2, cy + cs / 2 + 130, { size: 84, color: C.red, stroke: C.white, lw: 14 });
      } else if (api.result === "win") {
        g.text(api.t({ en: "GROOVY!", pt: "ARRASOU!" }), w / 2, cy + cs / 2 + 130, { size: 100, color: C.yellow, stroke: C.ink, lw: 14 });
      }
    },
  };
}

function drawArm(g: Gfx, x: number, y: number, d: Dir | null, sc: number): void {
  const L = 70 * sc;
  const ex = d === "left" ? -L : d === "right" ? L : 0;
  const ey = d === "up" ? -L * 1.1 : d === "down" ? L * 0.9 : L * 0.5;
  const ox = d === "left" ? -20 * sc : 20 * sc;
  g.line(x + ox, y, x + ox + ex + (d === "up" || d === "down" ? 30 * sc : 0), y + ey, C.ink, 14 * sc);
  g.circle(x + ox + ex + (d === "up" || d === "down" ? 30 * sc : 0), y + ey, 12 * sc, C.skin, { lw: 4 });
}

export const oppositeDay: Entry<S> = {
  def: {
    id: "opposite-day",
    num: 147,
    name: { en: "Opposite Day", pt: "Dia do Contrário" },
    verb: { en: "OPPOSITE DAY!", pt: "DIA DO CONTRÁRIO!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "timing",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    wtf: "insane",
    mechanic:
      "A disco boss on a flashing psychedelic dance floor shows a dance move as a big arrow on every beat. Swipe (or press the arrow) the OPPOSITE way before the next beat: left for right, up for down. Each beat gives about a second to think (1.3 s at first, 1 s at the hardest). Win with 4 moves (5 later, on a slightly faster beat; fewer if the time is short).",
    winText: "Do the opposite of every move, on the beat.",
    loseText: "Copy the boss's direction, go any other wrong way, or miss a beat.",
    timeScale: 1.8,
    minTime: 5.6,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const m = mem(s, () => ({ sw: 0, dir: "up" as Dir }));
          const k = activeIndex(s, s.t);
          if (m.sw === 0) {
            if (k < 0 || s.done[k] || s.t - (s.t0 + k * s.P) < 0.12) return;
            m.dir = OPP[s.dirs[k]];
          }
          stepSwipe(io, m, api.w / 2, api.h / 2, m.dir);
        },
        lose(s, api, io) {
          if (api.result) return;
          // copia o chefe (o erro mais natural)
          const m = mem(s, () => ({ sw: 0, dir: "up" as Dir }));
          const k = activeIndex(s, s.t);
          if (m.sw === 0) {
            if (k < 0 || s.done[k] || s.t - (s.t0 + k * s.P) < 0.2) return;
            m.dir = s.dirs[k];
          }
          stepSwipe(io, m, api.w / 2, api.h / 2, m.dir);
        },
      }
    : null,
};
