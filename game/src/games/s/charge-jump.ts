// 274 · CHARGE & JUMP! — de telhado em telhado: segure para carregar o pulo e solte para pular; a distância
// é proporcional ao tempo segurando. Caia no próximo telhado (os vãos variam). 3 pulos.
// No nível baixo uma linha pontilhada mostra onde você vai cair; depois ela some, os telhados ficam estreitos
// e (a partir de 1) a barra de força sobe e desce se você segurar demais.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { clamp, isPortrait, lerp, meter, pips } from "./util.ts";

interface Roof {
  x0: number;
  x1: number;
  y: number;
  color: string;
}

interface S {
  roofs: Roof[];
  on: number;
  px: number;
  py: number;
  charge: number;
  charging: boolean;
  /** Ida e volta da barra (nível alto): tempo carregando. */
  chargeT: number;
  rate: number;
  maxD: number;
  pingPong: boolean;
  preview: boolean;
  jump: { x0: number; y0: number; x1: number; y1: number; t: number; land: number } | null;
  falling: number;
  camX: number;
  sc: number;
  need: number;
  t: number;
  endT: number;
}

const FLY = 0.45;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const gmin = 200 + 30 * lv;
  const gmax = 300 + 100 * lv;
  const wmin = 280 - 75 * lv;
  const wmax = 320 - 70 * lv;
  const baseY = portrait ? h * 0.6 : h * 0.66;
  const colors = [C.blue, C.purple, C.teal, C.orange, C.pink];
  const roofs: Roof[] = [{ x0: -600, x1: 300, y: baseY, color: C.gray2 }];
  for (let i = 1; i <= 3; i++) {
    const prev = roofs[i - 1];
    const x0 = prev.x1 + rng.range(gmin, gmax);
    const y = baseY + (lv >= 0.5 ? rng.range(-70, 70) : rng.range(-20, 20));
    roofs.push({ x0, x1: x0 + rng.range(wmin, wmax), y, color: colors[(i + rng.int(0, 4)) % colors.length] });
  }
  roofs.push({ x0: roofs[3].x1 + 260, x1: roofs[3].x1 + 2000, y: baseY + 40, color: C.gray2 });
  const sc = Math.min(1, (w - 140) / (wmax * 2 + gmax + 60));
  const s: S = {
    roofs,
    on: 0,
    px: 240,
    py: baseY,
    charge: 0,
    charging: false,
    chargeT: 0,
    rate: 650 + 200 * lv,
    maxD: 1000,
    pingPong: lv >= 1,
    preview: lv < 0.5,
    jump: null,
    falling: 0,
    camX: 0,
    sc,
    need: 3,
    t: 0,
    endT: 0,
  };
  const camTarget = () => {
    const next = s.roofs[Math.min(s.on + 1, s.roofs.length - 1)];
    return (s.px + next.x1) / 2 - w / 2 / s.sc;
  };
  s.camX = camTarget();

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        if (s.falling > 0) {
          s.falling += dt;
          s.py += 1400 * dt;
        }
        return;
      }
      const inp = api.input;
      if (s.jump) {
        const j = s.jump;
        j.t += dt / FLY;
        const k = Math.min(1, j.t);
        s.px = lerp(j.x0, j.x1, k);
        s.py = lerp(j.y0, j.y1, k) - Math.sin(k * Math.PI) * (110 + (j.x1 - j.x0) * 0.25);
        if (j.t >= 1) {
          s.jump = null;
          if (j.land < 0) {
            s.falling = 0.001;
            api.sfx("miss");
            api.fx.pop(s.px, s.py - 200, api.t({ en: "WHOOPS!", pt: "OPA!" }), C.red);
            api.lose();
            return;
          }
          s.py = s.roofs[j.land].y;
          if (j.land !== s.on) {
            s.on = j.land;
            api.sfx("thud");
            api.fx.burst(s.px, s.py, C.white, 12);
            if (s.on >= s.need) {
              api.sfx("coin");
              api.win();
              return;
            }
          }
        }
      } else {
        if (inp.action && !inp.actionReleased) {
          if (!s.charging) api.sfx("rise");
          s.charging = true;
          s.chargeT += dt;
          if (s.pingPong) {
            // a barra sobe e desce
            const up = s.maxD / s.rate;
            const ph = s.chargeT % (up * 2);
            s.charge = (ph < up ? ph : up * 2 - ph) * s.rate;
          } else s.charge = Math.min(s.maxD, s.chargeT * s.rate);
        } else if (s.charging) {
          // soltou: pula
          s.charging = false;
          const x1 = s.px + s.charge;
          let land = -1;
          for (let i = 0; i < s.roofs.length; i++) if (x1 >= s.roofs[i].x0 - 12 && x1 <= s.roofs[i].x1 + 12) land = i;
          const y1 = land >= 0 ? s.roofs[land].y : Math.max(...s.roofs.map((r) => r.y)) + 60;
          s.jump = { x0: s.px, y0: s.py, x1, y1, t: 0, land };
          s.charge = 0;
          s.chargeT = 0;
          api.sfx("jump");
        }
      }
      const ct = camTarget();
      s.camX += (ct - s.camX) * Math.min(1, dt * 6);
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // sol e prédios distantes
      g.circle(w * 0.8, h * 0.2, 90, C.yellow2, { lw: 7 });
      for (let i = 0; i < 9; i++) {
        const bx = ((i * 230 - s.camX * 0.25) % (w + 300) + w + 300) % (w + 300) - 150;
        const bh = 200 + ((i * 97) % 220);
        g.rect(bx, h * 0.75 - bh, 150, bh + h, C.orange2, { stroke: null });
      }
      g.push();
      g.scale(s.sc);
      g.translate(-s.camX, 0);
      const H = h / s.sc;
      for (let i = 0; i < s.roofs.length; i++) {
        const r = s.roofs[i];
        g.rect(r.x0, r.y, r.x1 - r.x0, H - r.y + 20, r.color, { lw: 8 });
        g.rect(r.x0 - 12, r.y - 6, r.x1 - r.x0 + 24, 24, C.paper2, { r: 6, lw: 6 });
        for (let wy = r.y + 70; wy < H; wy += 110) {
          for (let wx = r.x0 + 40; wx < r.x1 - 60 && wx < r.x0 + 1400; wx += 90) g.rect(wx, wy, 44, 60, C.yellow2, { r: 4, lw: 4 });
        }
        if (i === s.need) {
          const fx = (r.x0 + r.x1) / 2;
          g.line(fx, r.y - 6, fx, r.y - 170, C.ink, 8);
          g.shape(fx, r.y - 170, [0, 0, 80, 26, 0, 52], C.green, { lw: 5 });
        }
      }
      // prévia (nível baixo)
      if (s.preview && s.charging && !s.jump) {
        const x1 = s.px + s.charge;
        for (let k = 0.1; k <= 1.0001; k += 0.1) {
          const x = lerp(s.px, x1, k);
          const y = s.py - Math.sin(k * Math.PI) * (110 + s.charge * 0.25);
          g.circle(x, y - 60, 9, C.white, { lw: 4 });
        }
        g.line(x1, s.py - 50, x1, s.py + 30, C.white, 8);
      }
      // você
      const squash = s.charging ? 1 - Math.min(0.3, (s.charge / s.maxD) * 0.4) : 1;
      g.push();
      g.translate(s.px, s.py);
      g.scale(1, squash);
      if (s.falling > 0) g.rotate(s.falling * 6);
      person(g, 0, 0, 0.75, { shirt: C.green, tie: C.yellow, mood: s.falling > 0 ? "shock" : api.result === "win" ? "happy" : s.charging ? "worried" : "neutral" });
      g.pop();
      g.pop();
      // barra de força
      if (s.charging) {
        const bw = Math.min(520, w * 0.5);
        meter(g, w / 2 - bw / 2, h - 90, bw, 46, s.charge / s.maxD, s.charge / s.maxD > 0.8 ? C.red : C.yellow);
      }
      pips(g, w / 2, 60, s.need, s.on, 22, C.green);
      if (!api.result && api.time < 1 && !s.charging) {
        g.text(api.t({ en: "HOLD… RELEASE!", pt: "SEGURA… SOLTA!" }), w / 2, h - 70, { size: clamp(w * 0.05, 40, 64), color: C.white, stroke: C.ink, lw: 10 });
      }
    },
  };
}

export const chargeJump: Entry<S> = {
  def: {
    id: "charge-jump",
    num: 274,
    name: { en: "Charge Jump", pt: "Pulo Carregado" },
    verb: { en: "CHARGE & JUMP!", pt: "CARREGA E PULA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "timing",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Rooftop to rooftop: hold to charge, release to jump; the distance grows with the hold time. Land on the next roof (gaps vary), three jumps. At first a dotted arc previews the landing; later it disappears, roofs get narrower and the power bar bounces up and down if you hold too long.",
    winText: "Land three jumps in a row.",
    loseText: "Fall into a gap, or run out of time.",
    timeScale: 1.5,
    minTime: 4.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || s.jump) return;
          const next = s.roofs[s.on + 1];
          const d = (next.x0 + next.x1) / 2 - s.px;
          if (!io.isDown) {
            io.down(api.w / 2, api.h / 2);
            return;
          }
          if (s.charging && s.charge >= d - s.rate * dt * 0.5) io.up(api.w / 2, api.h / 2);
        },
        lose(s, api, io, dt) {
          if (api.result || s.jump) return;
          const cur = s.roofs[s.on];
          const next = s.roofs[s.on + 1];
          // pula curto demais: cai no meio do vão
          const d = (cur.x1 + next.x0) / 2 - s.px;
          if (!io.isDown) {
            io.down(api.w / 2, api.h / 2);
            return;
          }
          if (s.charging && s.charge >= d - s.rate * dt * 0.5) io.up(api.w / 2, api.h / 2);
        },
      }
    : null,
};
