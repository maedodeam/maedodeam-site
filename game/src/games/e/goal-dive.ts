// 100 · SAVE! — pênalti no corredor do escritório. Você é o goleiro. O colega corre e chuta; leia a direção
// (olhar e corpo dele, e a linha pontilhada com a mira) e pule para a esquerda, a direita ou para cima antes de a
// bola chegar. Depois, ele finta: a mira fica solta (amarela, girando) mirando o lado falso e trava (vermelha) no lado
// de verdade quando ele se decide.
import type { Dir, Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, tapAt } from "./util.ts";

type Side = "left" | "right" | "up";
interface S {
  target: Side;
  fake: Side | null;
  switchAt: number;
  kickAt: number;
  flight: number;
  dive: Side | null;
  diveT: number;
  saved: boolean | null;
  t: number;
  endT: number;
  gx: number;
  goalW: number;
  barY: number;
  lineY: number;
  kx: number;
  ky: number;
}

function spot(s: S, side: Side): { x: number; y: number } {
  if (side === "left") return { x: s.gx - s.goalW * 0.34, y: s.lineY - (s.lineY - s.barY) * 0.4 };
  if (side === "right") return { x: s.gx + s.goalW * 0.34, y: s.lineY - (s.lineY - s.barY) * 0.4 };
  return { x: s.gx, y: s.barY + 45 }; // alto, perto do travessão: a mira não fica em cima das cabeças
}

/** Posição da bola no voo (k = 0..1): reta até o alvo com um arco para cima. */
function flightAt(from: { x: number; y: number }, to: { x: number; y: number }, k: number): { x: number; y: number } {
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 80 };
}

/** Mira: solta = amarela girando (ainda pode mudar); travada = vermelha, firme. */
function crosshair(g: Gfx, x: number, y: number, r: number, locked: boolean, spin: number): void {
  const col = locked ? C.red : C.yellow;
  g.push();
  g.translate(x, y);
  if (!locked) g.rotate(spin);
  g.circle(0, 0, r, null, { stroke: C.ink, lw: 16 });
  g.circle(0, 0, r, null, { stroke: col, lw: 8 });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    g.line(c * (r - 16), sn * (r - 16), c * (r + 22), sn * (r + 22), C.ink, 16);
    g.line(c * (r - 16), sn * (r - 16), c * (r + 22), sn * (r + 22), col, 8);
  }
  g.circle(0, 0, 9, col, { stroke: C.ink, lw: 5 });
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const target = rng.pick(["left", "right", "up"] as Side[]);
  const kickAt = (lv < 0.5 ? 1.0 : 0.85 - (lv - 0.5) * 0.1) + rng.range(0, 0.2);
  const feint = lv >= 0.95;
  const s: S = {
    target,
    fake: feint ? rng.pick((["left", "right", "up"] as Side[]).filter((d) => d !== target)) : null,
    switchAt: feint ? kickAt - 0.35 : 0,
    kickAt,
    flight: 0.55 - lv * 0.1,
    dive: null,
    diveT: 0,
    saved: null,
    t: 0,
    endT: 0,
    gx: w / 2,
    goalW: portrait ? 820 : Math.min(1100, w - 200),
    barY: portrait ? h * 0.38 : h * 0.3,
    lineY: portrait ? h * 0.88 : h * 0.95,
    kx: w / 2,
    ky: portrait ? h * 0.52 : h * 0.56,
  };

  const choose = (d: Side) => {
    if (s.dive) return;
    s.dive = d;
    s.diveT = 0;
    api.sfx("jump");
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.dive) s.diveT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      const sw: Dir | null = inp.swipe;
      if (sw === "left" || sw === "right" || sw === "up") choose(sw);
      else {
        const tp = tapAt(inp);
        if (tp) choose(tp.x < w / 3 ? "left" : tp.x > (w * 2) / 3 ? "right" : "up");
      }
      if (s.t >= s.kickAt && s.t - dt < s.kickAt) api.sfx("thud");
      if (s.t >= s.kickAt + s.flight) {
        s.saved = s.dive === s.target;
        if (s.saved) {
          const p = spot(s, s.target);
          api.sfx("hit");
          api.fx.burst(p.x, p.y, C.white, 20);
          api.fx.shake(0.4);
          api.win();
        } else {
          api.sfx("buzz");
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // corredor em perspectiva
      const vx = s.gx;
      const vy = s.ky - 40;
      g.rect(-10, vy, w + 20, h - vy + 10, "#bdb6a6", { stroke: null });
      g.poly(
        [
          { x: 0, y: 0 },
          { x: vx - 220, y: vy - 260 },
          { x: vx - 220, y: vy + 40 },
          { x: 0, y: h },
        ],
        "#e9e2d2",
        { stroke: null },
      );
      g.poly(
        [
          { x: w, y: 0 },
          { x: vx + 220, y: vy - 260 },
          { x: vx + 220, y: vy + 40 },
          { x: w, y: h },
        ],
        "#e9e2d2",
        { stroke: null },
      );
      g.rect(vx - 220, vy - 260, 440, 300, "#f6f1e6", { stroke: null });
      g.rect(vx - 60, vy - 160, 120, 200, C.brown2, { lw: 5 });
      g.line(vx - 220, vy + 40, 0, h, C.ink, 5);
      g.line(vx + 220, vy + 40, w, h, C.ink, 5);
      g.line(vx - 220, vy - 260, 0, 0, C.ink, 5);
      g.line(vx + 220, vy - 260, w, 0, C.ink, 5);
      // pôster
      g.rect(vx - 200, vy - 230, 110, 80, C.sky, { lw: 4 });

      // gol (arquivos de aço + faixa)
      const gl = s.gx - s.goalW / 2;
      const gr = s.gx + s.goalW / 2;
      g.push();
      g.alpha(0.35);
      for (let x = gl; x <= gr; x += 60) g.line(x, s.barY, x, s.lineY, C.white, 3);
      for (let y = s.barY; y <= s.lineY; y += 60) g.line(gl, y, gr, y, C.white, 3);
      g.pop();
      g.rect(gl - 70, s.barY - 20, 90, s.lineY - s.barY + 20, C.gray, { r: 6 });
      g.rect(gr - 20, s.barY - 20, 90, s.lineY - s.barY + 20, C.gray, { r: 6 });
      for (let k = 0; k < 3; k++) {
        const yy = s.barY + 40 + k * ((s.lineY - s.barY) / 3);
        g.rect(gl - 56, yy, 62, 50, C.paper2, { r: 4, lw: 4 });
        g.rect(gr - 6, yy, 62, 50, C.paper2, { r: 4, lw: 4 });
      }
      g.rect(gl - 70, s.barY - 70, s.goalW + 140, 60, C.blue, { r: 10 });
      g.text(api.t({ en: "Q4 GOALS", pt: "METAS DO Q4" }), s.gx, s.barY - 38, { size: 42, color: C.white });

      // cobrador (colega) correndo para a bola
      const run = Math.min(1, s.t / s.kickAt);
      const kicked = s.t >= s.kickAt;
      const showDir: Side = s.fake && s.t < s.switchAt ? s.fake : s.target;
      const look = showDir === "left" ? { x: -1, y: 0.2 } : showDir === "right" ? { x: 1, y: 0.2 } : { x: 0, y: -1 };
      const lean = showDir === "left" ? -0.3 : showDir === "right" ? 0.3 : -0.05;
      const ksc = 1.1 + run * 0.35;
      // o cobrador fica à esquerda da bola: a linha "para cima" não passa por cima do corpo dele
      const kx = s.kx - 150 + run * 40;
      const ky = s.ky + run * 70;
      // bola parada antes do chute
      const ballStart = { x: s.kx, y: ky + 6 };
      const tilt = lean * Math.min(1, run * 1.5);
      person(g, kx, ky, ksc, { shirt: C.red, tie: null, mood: kicked ? "smug" : "angry", look, tilt, walk: kicked ? undefined : s.t * 3 });
      // olhos grandes (o olhar é a pista principal)
      g.push();
      g.translate(kx, ky);
      g.rotate(tilt);
      g.scale(ksc);
      for (const ex of [-17, 17]) g.eye(ex, -178 + 4, 15, look.x, look.y);
      g.pop();
      if (s.fake && s.t >= s.switchAt && s.t < s.switchAt + 0.3 && !kicked) g.text("!", kx, ky - 330 * ksc, { size: 90, color: C.yellow, stroke: C.ink, lw: 12 });

      // bola
      let bx = ballStart.x;
      let by = ballStart.y;
      let br = 26;
      if (kicked) {
        const k = Math.min(1, (s.t - s.kickAt) / s.flight);
        const p = spot(s, s.target);
        const stop = s.saved === true ? 0.98 : 1.08;
        const kk = Math.min(k, stop);
        const q = flightAt(ballStart, p, kk);
        bx = q.x;
        by = q.y;
        br = 26 + kk * 34;
        if (api.result === "win") {
          bx = p.x;
          by = p.y + s.endT * 300;
        }
      }
      // goleiro (você), de costas
      const sc = portrait ? 1.3 : 1.15;
      const d = s.dive;
      const dk = d ? Math.min(1, s.diveT / 0.22) : 0;
      let ox = 0;
      let oy = 0;
      let rot = 0;
      if (d === "left") {
        ox = -s.goalW * 0.26 * dk;
        oy = -80 * dk;
        rot = -1.0 * dk;
      } else if (d === "right") {
        ox = s.goalW * 0.26 * dk;
        oy = -80 * dk;
        rot = 1.0 * dk;
      } else if (d === "up") {
        oy = -(s.lineY - s.barY) * 0.32 * dk;
      }
      const bodyDrawn = () => {
        g.push();
        g.translate(s.gx + ox, s.lineY + oy);
        g.rotate(rot);
        g.scale(sc);
        g.line(-22, -70, -26, 0, C.ink, 22);
        g.line(22, -70, 26, 0, C.ink, 22);
        g.rect(-60, -190, 120, 130, C.green, { r: 30 });
        g.text("1", 0, -124, { size: 70, color: C.white, stroke: C.ink, lw: 8 });
        const up = d === "up" ? 1 : 0;
        for (const sx of [-1, 1]) {
          const hx = sx * (d ? 110 : 96);
          const hy = d ? -280 : -150 - up * 120;
          g.line(sx * 50, -170, hx, hy, C.green, 26);
          g.circle(hx, hy, 34, C.yellow);
        }
        g.circle(0, -240, 52, C.ink2);
        g.pop();
      };
      if (kicked && (s.saved === false || api.result === "lose")) {
        bodyDrawn();
        g.circle(bx, by, br, C.white);
        g.star(bx, by, br * 0.5, br * 0.25, 5, C.ink, { stroke: null });
      } else {
        if (kicked) {
          g.circle(bx, by, br, C.white);
          g.star(bx, by, br * 0.5, br * 0.25, 5, C.ink, { stroke: null });
        } else {
          g.circle(ballStart.x, ballStart.y, 26, C.white);
          g.star(ballStart.x, ballStart.y, 13, 6, 5, C.ink, { stroke: null });
        }
        bodyDrawn();
      }
      // trajetória pontilhada + mira, por cima de tudo (o goleiro e o cobrador não escondem o "para cima").
      // Segue a mira atual do cobrador: na finta aponta o lado falso (mira solta) e muda para o lado de verdade
      // quando ele se decide (mira trava, com um pulso).
      if (!api.result) {
        const aim: Side = kicked ? s.target : showDir;
        const locked = kicked || !s.fake || s.t >= s.switchAt;
        const p = spot(s, aim);
        const k0 = kicked ? Math.min(1, (s.t - s.kickAt) / s.flight) : 0;
        const N = 16;
        g.push();
        g.alpha(locked ? 0.95 : 0.7);
        for (let i = 1; i < N; i++) {
          const k = i / N;
          if (k <= k0 + 0.03) continue;
          const q = flightAt(ballStart, p, k);
          g.circle(q.x, q.y, 7 + k * 7, locked ? C.white : C.paper2, { stroke: C.ink, lw: 4 });
        }
        g.pop();
        const cr = portrait ? 62 : 56;
        crosshair(g, p.x, p.y, cr, locked, s.t * 2.5);
        const since = s.fake ? s.t - s.switchAt : s.t;
        if (locked && since >= 0 && since < 0.35) {
          const e = since / 0.35;
          g.push();
          g.alpha(1 - e);
          g.circle(p.x, p.y, cr * (1 + e * 1.2), null, { stroke: C.red, lw: 10 });
          g.pop();
        }
      }
      if (api.result === "win") g.text(api.t({ en: "SAVED!", pt: "DEFENDEU!" }), w / 2, portrait ? h * 0.2 : h * 0.16, { size: 120, color: C.green, stroke: C.ink, lw: 16 });
      if (api.result === "lose") g.text(api.t({ en: "GOOOAL…", pt: "GOOOL…" }), w / 2, portrait ? h * 0.2 : h * 0.16, { size: 120, color: C.red, stroke: C.ink, lw: 16 });
    },
  };
}

const KEY: Record<Side, string> = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp" };

export const goalDive: Entry<S> = {
  def: {
    id: "goal-dive",
    num: 100,
    name: { en: "Penalty", pt: "Pênalti" },
    verb: { en: "SAVE!", pt: "DEFENDE!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "absurd",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Hallway football: you are the goalkeeper. A coworker runs up and kicks; his gaze, his lean and a dotted line ending in a crosshair show where. Swipe (or press an arrow, or tap the left, middle or right of the screen) to dive left, right or up before the ball arrives. Later he fakes one way first (loose yellow crosshair), then commits to the real side just before kicking (the crosshair moves there and locks red).",
    winText: "Dive to the side the ball goes.",
    loseText: "Dive the wrong way, too late, or not at all.",
    minTime: 2.8,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.dive || api.time <= 0) return;
          const m = mem(s, () => ({ sent: false }));
          if (m.sent) return;
          const ready = s.fake ? s.t >= s.switchAt + 0.08 : s.t >= 0.3;
          if (!ready) return;
          m.sent = true;
          if (io.touch) {
            const x = s.target === "left" ? api.w * 0.15 : s.target === "right" ? api.w * 0.85 : api.w * 0.5;
            io.tap(x, api.h * 0.6);
          } else io.press(KEY[s.target]);
        },
        lose(s, api, io) {
          if (api.result || s.dive || api.time <= 0.2) return;
          const wrong: Side = s.target === "left" ? "right" : "left";
          io.press(KEY[wrong]);
        },
      }
    : null,
};
