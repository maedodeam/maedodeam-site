// 176 · REBOOT! — o roteador travou. Segure o botão de energia até as luzes apagarem, solte e toque de novo para ligar.
// Nos níveis altos, segurar demais depois de desligar faz ele religar travado (e é preciso começar de novo).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bigButton, plant } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

type Phase = "frozen" | "off" | "ready" | "boot";
interface S {
  phase: Phase;
  meter: number;
  holdT: number;
  over: number;
  overLim: number;
  bootT: number;
  holding: boolean;
  bx: number;
  by: number;
  br: number;
  rx: number;
  ry: number;
  rs: number;
  resets: number;
  t: number;
}

const LEDS = 4;

function setup(api: MicroAPI): MicroInstance {
  const { w, h } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  const s: S = {
    phase: "frozen",
    meter: 0,
    holdT: 0.85 + lv * 0.22,
    over: 0,
    // Só a partir do nível 0,5: segurar demais depois de apagar religa travado.
    overLim: lv >= 0.5 ? 0.95 - (lv - 0.5) * 0.25 : Infinity,
    bootT: 0,
    holding: false,
    bx: wide ? w * 0.7 : w / 2,
    by: wide ? h * 0.56 : portrait ? h * 0.7 : h * 0.73,
    br: portrait ? 170 : 150,
    rx: wide ? w * 0.33 : w / 2,
    ry: wide ? h * 0.5 : portrait ? h * 0.34 : h * 0.33,
    rs: portrait ? 1.25 : wide ? 1.2 : 0.95,
    resets: 0,
    t: 0,
  };
  const near = (x: number, y: number) => Math.hypot(x - s.bx, y - s.by) < s.br + 80;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        if (s.phase === "boot") s.bootT += dt;
        return;
      }
      const inp = api.input;
      s.holding = inp.key("action") || (inp.down && near(inp.startX, inp.startY));
      const press = inp.keyPressed("action") || (inp.pressed && near(inp.x, inp.y));
      switch (s.phase) {
        case "frozen":
          if (s.holding) {
            if (s.meter === 0) api.sfx("click");
            s.meter += dt / s.holdT;
            if (s.meter >= 1) {
              s.meter = 1;
              s.phase = "off";
              s.over = 0;
              api.sfx("thud");
              api.fx.pop(s.rx, s.ry - 200 * s.rs, api.t({ en: "OFF", pt: "DESLIGOU" }), C.white);
            }
          } else s.meter = Math.max(0, s.meter - dt * 3);
          break;
        case "off":
          if (s.holding) {
            s.over += dt;
            if (s.over > s.overLim) {
              // segurou demais: religou travado
              s.phase = "frozen";
              s.meter = 0;
              s.resets++;
              api.sfx("buzz");
              api.fx.shake(0.4);
              api.fx.pop(s.bx, s.by - s.br - 60, api.t({ en: "TOO LONG!", pt: "DEMAIS!" }), C.red);
            }
          } else {
            s.phase = "ready";
            s.meter = 0;
          }
          break;
        case "ready":
          if (press) {
            s.phase = "boot";
            s.bootT = 0;
            api.sfx("rise");
          }
          break;
        case "boot":
          s.bootT += dt;
          if (s.bootT >= 0.5) {
            api.sfx("chime");
            api.fx.burst(s.rx, s.ry, C.green, 20);
            api.win();
          }
          break;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // estante ao fundo
      g.rect(-10, s.ry + 120 * s.rs, w + 20, 40, C.brown, { lw: 6 });
      g.rect(-10, s.ry + 160 * s.rs, w + 20, h, C.brown2, { stroke: null });
      if (wide) plant(g, w * 0.08, s.ry + 120 * s.rs, 1.4);

      // roteador
      const frozen = s.phase === "frozen";
      const on = s.phase === "boot";
      const jit = frozen && !api.result ? Math.sin(s.t * 47) * 3 : 0;
      g.push();
      g.translate(s.rx + jit, s.ry);
      g.scale(s.rs);
      // antenas
      for (const sx of [-1, 1]) {
        g.push();
        g.translate(sx * 150, -60);
        g.rotate(sx * 0.25);
        g.rect(-12, -170, 24, 170, C.gray2, { r: 12, lw: 6 });
        g.pop();
      }
      g.rect(-230, -80, 460, 190, C.ink2, { r: 36 });
      g.rect(-210, -62, 420, 60, C.gray2, { r: 22, stroke: null });
      // rosto do roteador
      const mood = api.result === "lose" ? "dizzy" : on || api.result === "win" ? "happy" : s.phase === "frozen" ? "dizzy" : "sleep";
      g.face(-120, 50, 110, mood);
      // luzes
      for (let i = 0; i < LEDS; i++) {
        const x = 0 + i * 52;
        let col: string = C.gray;
        if (frozen) {
          const blink = Math.sin(s.t * (9 + i * 3.7) + i * 2) > 0;
          col = blink ? (i % 2 ? C.orange : C.red) : C.ink;
        } else if (on) col = s.bootT * LEDS * 2.2 > i ? C.green : C.ink;
        else col = C.ink;
        g.circle(x, 40, 16, col, { lw: 4 });
        if (col === C.green || (frozen && col !== C.ink)) {
          g.push();
          g.alpha(0.35);
          g.circle(x, 40, 28, col, { stroke: null });
          g.pop();
        }
      }
      // ondas de wi-fi ao ligar
      if (api.result === "win") {
        for (let i = 1; i <= 3; i++) g.arc(0, -150, 50 * i, Math.PI * 1.2, Math.PI * 1.8, C.white, 12);
      }
      // ampulheta travada
      if (frozen && !api.result) {
        g.push();
        g.translate(190, -150);
        g.rotate(Math.sin(s.t * 3) * 0.2);
        g.shape(0, 0, [-28, -36, 28, -36, 0, 0], C.yellow, { lw: 5 });
        g.shape(0, 0, [-28, 36, 28, 36, 0, 0], C.yellow, { lw: 5 });
        g.pop();
      }
      g.pop();

      // botão de energia + medidor de segurar
      const pressed = s.holding && !api.result;
      g.circle(s.bx, s.by, s.br + 34, C.ink2, { lw: 6 });
      if (s.meter > 0) g.arc(s.bx, s.by, s.br + 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.meter, s.phase === "frozen" ? C.yellow : C.green, 24);
      bigButton(g, s.bx, s.by, s.br, s.phase === "ready" ? C.green : C.red, pressed);
      // símbolo de energia
      const sy = s.by + (pressed ? 10 : 0) - 6;
      g.arc(s.bx, sy, s.br * 0.42, -Math.PI / 2 + 0.6, Math.PI * 1.5 - 0.6, C.white, 18);
      g.line(s.bx, sy - s.br * 0.55, s.bx, sy - s.br * 0.12, C.white, 18);
      // instrução do momento
      if (!api.result) {
        let txt = { en: "HOLD", pt: "SEGURA" };
        if (s.phase === "off") txt = { en: "LET GO!", pt: "SOLTA!" };
        else if (s.phase === "ready") txt = { en: "TAP TO START", pt: "TOCA PRA LIGAR" };
        else if (s.phase === "boot") txt = { en: "BOOTING…", pt: "LIGANDO…" };
        const ty = portrait || !wide ? s.by - s.br - 90 : s.by + s.br + 100;
        const pulse = s.phase === "ready" || s.phase === "off" ? 1 + Math.sin(s.t * 14) * 0.06 : 1;
        g.text(api.t(txt), s.bx, ty, { size: 64 * pulse, color: C.white, stroke: C.ink, lw: 12 });
      }
      if (api.result === "lose") g.text(api.t({ en: "STILL FROZEN", pt: "AINDA TRAVADO" }), s.rx, s.ry - 270 * s.rs, { size: 80, color: C.red, stroke: C.ink, lw: 14 });
      if (api.result === "win") g.text(api.t({ en: "ONLINE!", pt: "VOLTOU!" }), s.rx, s.ry - 270 * s.rs, { size: 90, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const reboot: Entry<S> = {
  def: {
    id: "reboot",
    num: 176,
    name: { en: "Turn It Off and On", pt: "Desliga e Liga" },
    verb: { en: "REBOOT!", pt: "REINICIA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "tech",
    family: "hold",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A frozen router blinks angrily. Hold the power button (or Space) until the meter fills and the lights go out, let go, then tap once to turn it back on. Later the hold is longer, and holding too long after it switches off makes it boot frozen again.",
    winText: "Switch it off with a long hold, release, then tap to boot it green.",
    loseText: "Time runs out with the router still frozen (short taps don't switch it off).",
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          if (s.phase === "frozen") {
            if (!io.isDown) io.down(s.bx, s.by);
          } else if (s.phase === "off") {
            if (io.isDown) io.up(s.bx, s.by);
          } else if (s.phase === "ready") {
            if (!io.isDown) io.tap(s.bx, s.by);
          }
        },
        lose(s, api, io) {
          // Erro comum: só dá toques rápidos, que não desligam o roteador.
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ next: 0 }));
          if (api.time >= m.next && !io.isDown) {
            io.tap(s.bx, s.by);
            m.next = api.time + 0.25;
          }
        },
      }
    : null,
};
