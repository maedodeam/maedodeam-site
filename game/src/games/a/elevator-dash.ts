// 038 · GO! — a porta do elevador abre e fecha sem parar. Corra para dentro quando o vão for ficar aberto.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { bigText } from "./art-a.ts";

interface S {
  maxGap: number;
  omega: number;
  phi: number;
  B: number;
  run: number;
  t: number;
  runT: number; // -1 = parado; senão, tempo de corrida
  state: "wait" | "run" | "in" | "crushed";
  endT: number;
}

export function gapAt(s: Pick<S, "maxGap" | "omega" | "phi">, t: number): number {
  return s.maxGap * (0.5 + 0.5 * Math.sin(s.omega * t + s.phi));
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const maxGap = portrait ? 520 : 560;
  const period = 2.0 - 0.6 * lv;
  const s: S = {
    maxGap,
    omega: (Math.PI * 2) / period,
    phi: -Math.PI / 2 + rng.range(-0.5, 0.5),
    B: maxGap * 0.45,
    run: 0.35,
    t: 0,
    runT: -1,
    state: "wait",
    endT: 0,
  };
  const doorCx = w / 2;
  const doorBase = portrait ? h * 0.6 : h * 0.64;
  const doorH = portrait ? 620 : 470;
  const doorW = maxGap + 40;
  const startY = portrait ? h * 0.95 : h * 0.99;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.state === "in" || s.state === "crushed") {
        s.endT += dt;
        return;
      }
      if (s.state === "run") {
        s.runT += dt;
        if (gapAt(s, s.t) < s.B) {
          s.state = "crushed";
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.pop(doorCx, doorBase - doorH - 40, api.t({ en: "OUCH!", pt: "AI!" }), C.red);
          if (!api.result) api.lose();
          return;
        }
        if (s.runT >= s.run) {
          s.state = "in";
          api.sfx("chime");
          api.fx.burst(doorCx, doorBase - doorH / 2, undefined, 22);
          if (!api.result) api.win();
        }
        return;
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        s.state = "run";
        s.runT = 0;
        api.sfx("swoosh");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.cream);
      // corredor
      g.rect(-10, doorBase, w + 20, h - doorBase + 10, C.paper2);
      g.line(0, doorBase, w, doorBase, C.ink, 7);
      for (let i = -6; i <= 6; i++) g.line(doorCx + i * 60, doorBase, doorCx + i * 260, h, C.muted, 4);
      // moldura e interior
      const x0 = doorCx - doorW / 2;
      const y0 = doorBase - doorH;
      g.rect(x0 - 50, y0 - 60, doorW + 100, doorH + 60, C.gray2, { r: 12 });
      g.rect(x0, y0, doorW, doorH, C.yellow2, { stroke: null });
      // colegas lá dentro
      g.push();
      g.clip(x0, y0, doorW, doorH);
      const cs = portrait ? 1.15 : 0.95;
      person(g, doorCx - 150, doorBase - 30, cs, { shirt: C.purple, tie: C.yellow, mood: s.state === "crushed" ? "shock" : "neutral" });
      person(g, doorCx + 160, doorBase - 30, cs * 0.95, { shirt: C.teal, tie: C.red, mood: s.state === "in" ? "happy" : "smug" });
      g.pop();
      // portas
      const gap = s.state === "crushed" ? Math.max(gapAt(s, s.t), s.B * 0.55) : s.state === "in" && s.endT > 0.15 ? Math.max(0, gapAt(s, s.t) * (1 - (s.endT - 0.15) * 4)) : gapAt(s, s.t);
      const leaf = (doorW - gap) / 2;
      const ok = gap >= s.B;
      g.rect(x0, y0, leaf, doorH, C.paper, { lw: 6 });
      g.rect(x0 + doorW - leaf, y0, leaf, doorH, C.paper, { lw: 6 });
      g.line(x0 + leaf - 30, y0 + doorH * 0.45, x0 + leaf - 30, y0 + doorH * 0.6, C.gray, 8);
      g.line(x0 + doorW - leaf + 30, y0 + doorH * 0.45, x0 + doorW - leaf + 30, y0 + doorH * 0.6, C.gray, 8);
      // painel de andar
      g.rect(doorCx - 90, y0 - 50, 180, 36, C.ink, { r: 8 });
      g.text(s.state === "in" ? "▲ 12" : "▼ 12", doorCx, y0 - 30, { size: 30, font: "mono", color: C.orange });
      // marca do corpo na soleira: verde = cabe
      const by = doorBase + 16;
      g.rect(doorCx - s.B / 2, by - 8, s.B, 16, ok ? C.green : C.red, { r: 8, lw: 4 });
      g.line(doorCx - s.B / 2, by - 30, doorCx - s.B / 2, by + 20, C.ink, 6);
      g.line(doorCx + s.B / 2, by - 30, doorCx + s.B / 2, by + 20, C.ink, 6);

      // corredor correndo do primeiro plano até a porta
      let k = 0;
      if (s.state === "run") k = Math.min(1, s.runT / s.run);
      if (s.state === "in") k = 1;
      if (s.state === "crushed") k = 0.92;
      const py = startY + (doorBase - 10 - startY) * k;
      const ps = portrait ? 1.9 - 0.6 * k : 1.45 - 0.35 * k;
      const hide = s.state === "in" && s.endT > 0.3;
      if (!hide) {
        g.push();
        if (s.state === "crushed") {
          g.translate(doorCx, py);
          g.scale(0.65, 1);
          g.translate(-doorCx, -py);
        }
        person(g, doorCx, py, ps, {
          shirt: C.blue,
          tie: C.orange,
          mood: s.state === "crushed" ? "dizzy" : s.state === "run" ? "worried" : s.state === "in" ? "happy" : "neutral",
          walk: s.state === "run" ? s.runT * 4 : undefined,
          look: { x: 0, y: -1 },
        });
        g.pop();
        // pasta
        if (s.state !== "crushed") g.rect(doorCx + 50 * ps, py - 90 * ps, 60 * ps, 44 * ps, C.brown, { r: 8 });
      }
      if (s.state === "wait" && !api.result) {
        g.push();
        g.alpha(0.5 + 0.4 * Math.sin(g.time * 6));
        const opening = gapAt(s, s.t + 0.05) > gapAt(s, s.t);
        const label = ok ? { en: "OPEN", pt: "ABERTA" } : opening ? { en: "OPENING...", pt: "ABRINDO..." } : { en: "CLOSING", pt: "FECHANDO" };
        bigText(g, api.t(label), portrait ? doorCx : x0 - 230, portrait ? y0 - 120 : y0 + 120, 64, ok ? C.green : opening ? C.yellow : C.red);
        g.pop();
      }
      if (s.state === "in" && s.endT > 0.2) bigText(g, api.t({ en: "DING!", pt: "PLIM!" }), doorCx, portrait ? y0 - 130 : y0 - 95, portrait ? 120 : 100, C.yellow, -0.05);
      if (s.state === "crushed") bigText(g, api.t({ en: "SQUISHED!", pt: "ESPREMIDO!" }), doorCx, portrait ? y0 - 130 : y0 - 95, portrait ? 110 : 100, C.red, 0.04);
    },
  };
}

export const elevatorDash: Entry<S> = {
  def: {
    id: "elevator-dash",
    num: 38,
    name: { en: "Doors Closing", pt: "A Porta Tá Fechando" },
    verb: { en: "GO!", pt: "VAI!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 1,
    mechanic: "The elevator doors keep opening and closing. Tap or press Space to dash in; the run takes about a third of a second, and the gap must stay wider than you the whole way (the mark on the threshold turns green when you fit).",
    winText: "Get inside the elevator.",
    loseText: "Getting squeezed by the doors, or time runs out.",
    timeScale: 1.2,
    minTime: 3,
    bg: BG.cream,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02 || s.state !== "wait") return;
          // A corrida começa no próximo quadro: o vão precisa caber durante toda ela.
          for (let t = s.t + dt; t <= s.t + dt + s.run + 0.06; t += 1 / 120) if (gapAt(s, t) < s.B * 1.04) return;
          io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.02 || s.state !== "wait") return;
          const closing = gapAt(s, s.t + dt + 0.05) < gapAt(s, s.t + dt);
          if (closing && gapAt(s, s.t + dt + s.run * 0.6) < s.B * 0.9) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
