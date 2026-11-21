// 266 · THE FLOOR IS LAVA! — WTF insano: o escritório virou um mar de lava psicodélica. Você está em cima de uma
// cadeira de rodinhas que derrete (anel de tempo). Cadeiras, mesas, gaveteiros e caixas de pizza boiam por perto:
// toque num deles dentro do alcance (círculo tracejado) para pular. Ficar num objeto que derreteu de vez = perde.
// Tocar na lava não faz nada. Nos níveis altos tudo derrete mais rápido, boia mais e as caixas de pizza derretem em dobro.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person, stapler } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem } from "../../testing/botkit.ts";
import { clamp, tapAt } from "./util.ts";

type Kind = "chair" | "desk" | "pizza" | "cabinet";

interface Obj {
  kind: Kind;
  hx: number;
  hy: number;
  x: number;
  y: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  ph: number;
  /** 1 = inteiro, 0 = derreteu. */
  life: number;
  /** Segundos para derreter inteiro com você em cima. */
  melt: number;
  sunk: number;
}

interface S {
  objs: Obj[];
  cur: number;
  /** Pulo em andamento. */
  hop: { from: number; to: number; t: number; sx: number; sy: number } | null;
  range: number;
  r: number;
  px: number;
  py: number;
  fell: boolean;
  t: number;
  endT: number;
}

const HOP = 0.28;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const k = Math.min(w, h) / 1000;
  let cols = Math.max(2, Math.floor((w - 100) / 360));
  let rows = Math.max(2, Math.floor((h - 200) / 330));
  if (cols * rows < 6) {
    cols = 3;
    rows = 2;
  }
  const top = 150;
  const cw = (w - 100) / cols;
  const ch = (h - top - 60) / rows;
  const amp = (lv < 0.5 ? 22 : 40 + 25 * lv) * k;
  const jit = 30 * k;
  const baseMelt = 1.75 - 0.4 * lv;
  const objs: Obj[] = [];
  const startIdx = rng.int(0, cols * rows - 1);
  for (let i = 0; i < cols * rows; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    let kind: Kind = rng.pick(["chair", "desk", "cabinet", "chair"] as const);
    // a partir de 0,5 entram as caixas de pizza, que derretem em dobro
    if (lv >= 0.5 && rng.chance(0.3)) kind = "pizza";
    if (i === startIdx) kind = "chair";
    const hx = 50 + cw * (c + 0.5) + rng.range(-jit, jit);
    const hy = top + ch * (r + 0.5) + rng.range(-jit, jit);
    objs.push({
      kind,
      hx,
      hy,
      x: hx,
      y: hy,
      ax: amp * rng.range(0.6, 1),
      ay: amp * rng.range(0.4, 0.8),
      fx: rng.range(0.7, 1.2) * (1 + lv * 0.3),
      fy: rng.range(0.6, 1.1) * (1 + lv * 0.3),
      ph: rng.range(0, 6),
      life: 1,
      melt: kind === "pizza" ? baseMelt * 0.55 : baseMelt,
      sunk: 0,
    });
  }
  const s: S = {
    objs,
    cur: startIdx,
    hop: null,
    range: (Math.max(cw, ch) + amp * 2 + jit * 2) * 1.1,
    r: 95 * k + 10,
    px: objs[startIdx].x,
    py: objs[startIdx].y,
    fell: false,
    t: 0,
    endT: 0,
  };

  const place = (o: Obj, t: number) => {
    o.x = o.hx + Math.sin(t * o.fx + o.ph) * o.ax;
    o.y = o.hy + Math.cos(t * o.fy + o.ph * 1.3) * o.ay;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const o of s.objs) place(o, s.t);
      if (api.result) {
        s.endT += dt;
        if (s.fell) s.objs[s.cur].sunk = Math.min(1, s.objs[s.cur].sunk + dt * 3);
        const o = s.objs[s.cur];
        s.px = o.x;
        s.py = o.y;
        return;
      }
      // derrete quem está ocupado; os outros esfriam devagar
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        if (!s.hop && i === s.cur) o.life -= dt / o.melt;
        else o.life = Math.min(1, o.life + dt * 0.2);
      }
      if (s.hop) {
        s.hop.t += dt;
        const to = s.objs[s.hop.to];
        const k2 = Math.min(1, s.hop.t / HOP);
        s.px = s.hop.sx + (to.x - s.hop.sx) * k2;
        s.py = s.hop.sy + (to.y - s.hop.sy) * k2;
        if (k2 >= 1) {
          s.cur = s.hop.to;
          s.hop = null;
          api.sfx("boing");
          api.fx.burst(to.x, to.y, C.yellow, 10);
        }
      } else {
        const o = s.objs[s.cur];
        s.px = o.x;
        s.py = o.y;
        if (o.life <= 0) {
          o.life = 0;
          s.fell = true;
          api.sfx("splash");
          api.fx.shake(1);
          api.fx.pop(o.x, o.y - 180, api.t({ en: "TOO HOT!", pt: "QUEIMOU!" }), C.yellow);
          api.lose();
          return;
        }
      }
      const p = tapAt(api.input, 60);
      if (!p || s.hop) return;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < s.objs.length; i++) {
        const d = Math.hypot(p.x - s.objs[i].x, p.y - s.objs[i].y);
        if (d < s.r + 45 && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0 || best === s.cur) return; // lava (ou o próprio lugar): nada acontece
      const tgt = s.objs[best];
      if (Math.hypot(tgt.x - s.px, tgt.y - s.py) > s.range) {
        api.sfx("miss");
        api.fx.pop(tgt.x, tgt.y - 120, api.t({ en: "TOO FAR!", pt: "LONGE!" }), C.white);
        return;
      }
      s.hop = { from: s.cur, to: best, t: 0, sx: s.px, sy: s.py };
      api.sfx("jump");
    },
    draw(g: Gfx) {
      const t = g.time;
      // lava psicodélica (cena de fundo balança, os objetos não)
      psyBackdrop(g, t, 1, w / 2, h / 2);
      g.push();
      g.alpha(0.55);
      g.rect(-10, -10, w + 20, h + 20, "#ff4a10", { stroke: null });
      g.pop();
      const wb = psyWobble(t, 1.6);
      g.push();
      g.translate(w / 2 + wb.dx, h / 2 + wb.dy);
      g.rotate(wb.rot);
      g.translate(-w / 2, -h / 2);
      // bolhas de lava
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 263.7 + t * (30 + i * 7)) % (w + 200)) - 100;
        const by = ((i * 151.3) % h) + Math.sin(t * 2 + i) * 30;
        const br = 20 + ((i * 37) % 40) + Math.sin(t * 4 + i) * 8;
        g.circle(bx, by, br, psyColor(t, i * 25, 100, 62), { stroke: "#7a1400", lw: 5 });
      }
      // escritório boiando à toa (decoração)
      cup(g, w * 0.12, h * 0.9, 0.9, C.white, false, t);
      stapler(g, w * 0.86, h * 0.12 + Math.sin(t * 3) * 20, 1.1, t * 1.4);
      cup(g, w * 0.9, h * 0.86, 0.8, C.pink, false, t);
      g.pop();
      wobbleText(g, api.t({ en: "HOT HOT HOT", pt: "QUENTE QUENTE" }), w / 2, 70, t, { size: 64, stroke: C.ink, lw: 10 }, 18);

      // alcance do pulo
      if (!api.result && !s.hop) {
        g.push();
        g.alpha(0.85);
        g.ctx.setLineDash([26, 18]);
        g.circle(s.px, s.py, s.range, null, { stroke: C.white, lw: 7 });
        g.ctx.setLineDash([]);
        g.pop();
      }
      // objetos (sempre nítidos: contorno sólido e alto contraste)
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i];
        const inRange = !api.result && !s.hop && i !== s.cur && Math.hypot(o.x - s.px, o.y - s.py) <= s.range;
        if (inRange) g.circle(o.x, o.y, s.r + 22, null, { stroke: C.white, lw: 9 });
        drawObj(g, o, s.r, api);
        // anel de derretimento
        if (o.life < 0.999 && o.sunk < 1) {
          const a0 = -Math.PI / 2;
          g.arc(o.x, o.y, s.r + 8, a0, a0 + Math.PI * 2 * Math.max(0, o.life), o.life < 0.35 ? C.red : C.yellow, 12);
        }
      }
      // você
      let hy = 0;
      if (s.hop) {
        const k2 = Math.min(1, s.hop.t / HOP);
        hy = Math.sin(k2 * Math.PI) * 110;
      }
      const sunk = s.fell ? s.objs[s.cur].sunk : 0;
      if (sunk < 1) {
        g.push();
        g.alpha(1 - sunk * 0.8);
        person(g, s.px, s.py - 10 - hy + sunk * 80, 0.55 * (s.r / 105), {
          shirt: C.blue,
          tie: C.yellow,
          mood: s.fell ? "shock" : api.result === "win" ? "happy" : s.objs[s.cur].life < 0.4 && !s.hop ? "worried" : "neutral",
        });
        g.pop();
      }
      if (api.result === "win") wobbleText(g, api.t({ en: "STILL DRY!", pt: "SALVO!" }), w / 2, h / 2, t, { size: 120, stroke: C.ink, lw: 14 }, 20);
    },
  };
}

function drawObj(g: Gfx, o: Obj, r: number, api: MicroAPI): void {
  const melt = clamp(o.life, 0, 1);
  g.push();
  g.translate(o.x, o.y + o.sunk * 60);
  // derretendo: achata e escorre
  g.scale(r / 100, (r / 100) * (0.55 + 0.45 * melt) * (1 - o.sunk * 0.9));
  if (melt < 0.95) {
    for (let i = -1; i <= 1; i++) g.ellipse(i * 40, 60 + (1 - melt) * 20, 18, 14 + (1 - melt) * 30, C.orange2, { lw: 5 });
  }
  switch (o.kind) {
    case "chair":
      g.line(0, 10, 0, 60, C.ink, 12);
      g.line(-55, 70, 55, 70, C.ink, 12);
      g.circle(-55, 78, 12, C.gray2, { lw: 5 });
      g.circle(55, 78, 12, C.gray2, { lw: 5 });
      g.circle(0, 82, 12, C.gray2, { lw: 5 });
      g.rect(-60, -100, 120, 90, C.purple, { r: 26 });
      g.ellipse(0, 4, 82, 28, C.purple2, { lw: 7 });
      break;
    case "desk":
      g.rect(-90, -10, 14, 80, C.brown, { lw: 5 });
      g.rect(76, -10, 14, 80, C.brown, { lw: 5 });
      g.rect(-100, -30, 200, 30, C.brown2, { r: 6 });
      g.rect(-40, -100, 80, 56, C.gray2, { r: 8 });
      g.rect(-32, -92, 64, 40, C.sky, { r: 4, lw: 4 });
      g.rect(-6, -44, 12, 14, C.gray2, { lw: 4 });
      break;
    case "pizza":
      g.rect(-85, -40, 170, 70, "#f1d39b", { r: 8 });
      g.shape(0, -40, [-85, 0, 85, 0, 70, -36, -70, -36], "#e2b974");
      g.text(api.t({ en: "PIZZA", pt: "PIZZA" }), 0, -4, { size: 40, color: C.red });
      break;
    default:
      g.rect(-60, -100, 120, 170, C.gray, { r: 10 });
      for (let i = 0; i < 3; i++) {
        g.rect(-48, -88 + i * 54, 96, 44, C.paper2, { r: 6, lw: 5 });
        g.rect(-16, -70 + i * 54, 32, 10, C.ink2, { r: 4, stroke: null });
      }
  }
  g.pop();
}

export const floorIsLava: Entry<S> = {
  def: {
    id: "floor-is-lava",
    num: 266,
    name: { en: "The Floor Is Lava", pt: "O Chão É Lava" },
    verb: { en: "THE FLOOR IS LAVA!", pt: "O CHÃO É LAVA!" },
    hint: { pointer: "tap" },
    category: "dodge",
    family: "tap",
    goal: "survive",
    difficulty: 2,
    wtf: "insane",
    mechanic:
      "WTF: the office turned into a sea of psychedelic lava. You stand on a rolling chair that melts (ring timer); chairs, desks, cabinets and pizza boxes float by. Tap one inside your jump range (dashed circle) to hop onto it. Tapping lava does nothing. Later everything melts faster and drifts more, and pizza boxes melt twice as fast.",
    winText: "Keep hopping to solid furniture until time runs out.",
    loseText: "Stay on a piece of furniture until it fully melts.",
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.hop || io.isDown) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait > 0) {
            m.wait--;
            return;
          }
          const cur = s.objs[s.cur];
          if (cur.life * cur.melt > 0.55 && cur.life > 0.4) return;
          let best = -1;
          let bs = -1;
          for (let i = 0; i < s.objs.length; i++) {
            if (i === s.cur) continue;
            const o = s.objs[i];
            if (Math.hypot(o.x - s.px, o.y - s.py) > s.range * 0.85) continue;
            const sc = o.life * o.melt;
            if (sc > bs) {
              bs = sc;
              best = i;
            }
          }
          if (best < 0) return;
          io.tap(s.objs[best].x, s.objs[best].y);
          m.wait = 3;
        },
        lose(s, api, io) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ next: 0.3 }));
          // fica martelando a própria cadeira (que não leva a lugar nenhum)
          if (api.time >= m.next) {
            io.tap(s.px, s.py);
            m.next = api.time + 0.3;
          }
        },
      }
    : null,
};
