// 244 · LAY A PLANK! — um colega atravessa o riacho olhando o celular, sem perceber os 3 buracos no caminho.
// Toque num buraco para jogar uma tábua antes de ele pisar ali. A tábua só aguenta ~1,2 s e depois sai boiando
// (cedo demais = já foi embora; dá para jogar outra). Tarde demais = tchibum (perde). Vence quando ele chega ao outro lado.
// Em retrato/quadrado a cena tem zoom e a câmera acompanha o colega (o tempo é o mesmo da paisagem).
// Níveis altos: tábuas duram menos e (lv ≥ 0.5) ele muda o passo (começa devagar e depois apressa).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, phone } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, tapAt } from "./util.ts";

interface Gap {
  x: number;
  /** Momento em que ele entra / sai da parte perigosa do buraco. */
  enter: number;
  exit: number;
  /** Idade da tábua atual (-1 = sem tábua). */
  plank: number;
}
interface Drift {
  x: number;
  t: number;
}
interface S {
  gaps: Gap[];
  gw: number;
  life: number;
  x0: number;
  x1: number;
  gy: number;
  /** Zoom da cena e largura do mundo (telas estreitas: mundo largo com câmera que segue o colega). */
  Z: number;
  WW: number;
  camX: number;
  Tend: number;
  hurry: number;
  wx: number;
  fallen: boolean;
  fallT: number;
  drifts: Drift[];
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  // Em tela estreita (retrato/quadrado) o mundo tem a largura da paisagem e a câmera dá zoom e segue o colega,
  // para o colega e os buracos ficarem grandes o bastante para o dedo (e o tempo fica igual ao da paisagem).
  const narrow = w < 1400;
  const Z = portrait ? 1.6 : narrow ? 1.35 : 1;
  const WW = narrow ? 1780 : w;
  const x0 = WW * 0.07;
  const x1 = WW * 0.93;
  const dist = x1 - x0;
  const Tend = Math.min(api.duration - 0.35, 4.6);
  const hurry = lv >= 0.5 ? 0.3 : 0;
  const f = (u: number) => {
    const k = Math.max(0, Math.min(1, u));
    return k - (hurry * Math.sin(2 * Math.PI * k)) / (2 * Math.PI);
  };
  const xAt = (t: number) => x0 + dist * f(t / Tend);
  const gw = Math.max(100, Math.min(160, dist * 0.1));
  const safe = 18;
  const u1 = Math.max(1.3 / Tend, 0.3);
  const u3 = 0.82;
  const u2 = (u1 + u3) / 2 + rng.range(-0.04, 0.04);
  const timeAt = (x: number) => {
    let lo = 0;
    let hi = Tend;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (xAt(mid) < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const gaps: Gap[] = [u1, u2, u3].map((u) => {
    const gx = x0 + dist * f(u);
    return { x: gx, enter: timeAt(gx - gw / 2 + safe), exit: timeAt(gx + gw / 2 - safe), plank: -1 };
  });
  const s: S = {
    gaps,
    gw,
    life: 1.5 - 0.35 * lv,
    x0,
    x1,
    gy: portrait ? h * 0.6 : narrow ? h * 0.66 : h * 0.6,
    Z,
    WW,
    camX: 0,
    Tend,
    hurry,
    wx: x0,
    fallen: false,
    fallT: 0,
    drifts: [],
    t: 0,
    endT: 0,
  };

  /** Câmera: o colega fica perto da borda esquerda (para ver os buracos à frente), presa às bordas do mundo. */
  const camFor = (wx: number) => Math.max(0, Math.min(WW - w / Z, wx - (narrow ? 0.14 : 0.28) * (w / Z)));
  const sx = (x: number) => (x - s.camX) * Z;
  s.camX = camFor(s.wx);

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const d of s.drifts) d.t += dt;
      if (s.fallen) s.fallT += dt;
      // tábuas envelhecem e saem boiando
      for (const gp of s.gaps) {
        if (gp.plank < 0) continue;
        gp.plank += dt;
        if (gp.plank >= s.life) {
          gp.plank = -1;
          s.drifts.push({ x: gp.x, t: 0 });
          if (!api.result) api.sfx("splash");
        }
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      s.wx = xAt(api.time);
      s.camX = camFor(s.wx);
      // jogar tábua (toque em coordenadas de tela → mundo)
      const p = tapAt(api.input, 70);
      if (p && Math.abs(p.y - s.gy) < (portrait ? 420 : 300)) {
        const px = p.x / Z + s.camX;
        let best: Gap | null = null;
        let bd = Math.max(95, s.gw / 2 + 40);
        for (const gp of s.gaps) {
          const d = Math.abs(gp.x - px);
          if (d < bd) {
            bd = d;
            best = gp;
          }
        }
        if (best && best.plank < 0 && s.wx < best.x + s.gw / 2) {
          best.plank = 0;
          api.sfx("thud");
          api.fx.pop(sx(best.x), s.gy - 110 * Z, api.t({ en: "PLANK!", pt: "TÁBUA!" }), C.yellow);
        }
      }
      // pisou num buraco sem tábua?
      for (const gp of s.gaps) {
        if (s.wx > gp.x - s.gw / 2 + safe && s.wx < gp.x + s.gw / 2 - safe && gp.plank < 0) {
          s.fallen = true;
          api.sfx("splash");
          api.fx.shake(0.5);
          api.fx.burst(sx(gp.x), s.gy + 40 * Z, C.sky, 20);
          api.lose();
          return;
        }
      }
      if (s.wx >= s.x1 - 1) {
        api.sfx("chime");
        api.fx.burst(sx(s.wx), s.gy - 120 * Z, C.yellow, 22);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.green);
      // riacho (coordenadas de tela)
      const wy = s.gy + 30 * Z;
      g.rect(-10, wy, w + 20, h - wy + 10, C.blue, { stroke: null });
      for (let i = 0; i < 30; i++) {
        const xx = ((((i * 233 + s.t * 120 - s.camX * Z) % (w + 200)) + w + 200) % (w + 200)) - 100;
        const yy = wy + 40 + ((i * 97) % Math.max(80, h - wy - 60));
        g.line(xx, yy, xx + 60, yy, C.blue2, 6);
      }
      // daqui em diante: mundo (zoom Z a partir da linha do chão, câmera em camX)
      g.push();
      g.translate(0, s.gy);
      g.scale(Z);
      g.translate(-s.camX, -s.gy);
      const WW = s.WW;
      // árvores ao fundo
      for (let i = 0; i < 8; i++) {
        const tx = (i + 0.5) * (WW / 8);
        g.rect(tx - 14, s.gy - 330, 28, 120, C.brown, { lw: 5 });
        g.circle(tx, s.gy - 360, 70, C.green2, { lw: 6 });
      }
      // margens e chão entre os buracos
      const gw = s.gw;
      const edges: [number, number][] = [];
      let from = -10;
      for (const gp of s.gaps) {
        edges.push([from, gp.x - gw / 2]);
        from = gp.x + gw / 2;
      }
      edges.push([from, WW + 10]);
      for (const [a, b] of edges) {
        g.rect(a, s.gy, b - a, 70, C.brown2, { lw: 6 });
        g.rect(a, s.gy - 6, b - a, 20, C.green2, { lw: 5 });
      }
      // bandeira de chegada
      g.line(s.x1 + 20, s.gy, s.x1 + 20, s.gy - 200, C.ink, 8);
      g.shape(s.x1 + 24, s.gy - 200, [0, 0, 70, 22, 0, 44], C.yellow, { lw: 5 });
      // buracos: alvo tracejado ou tábua
      for (const gp of s.gaps) {
        if (gp.plank >= 0) {
          const old = gp.plank > s.life - 0.4;
          const wob = old ? Math.sin(s.t * 40) * 4 : 0;
          const drop = Math.max(0, 1 - gp.plank * 8) * -60;
          g.rect(gp.x - gw / 2 - 26, s.gy - 14 + drop + wob, gw + 52, 30, old ? C.brown2 : C.brown, { r: 6, lw: 6 });
          g.line(gp.x - gw / 2, s.gy + 1 + drop + wob, gp.x + gw / 2, s.gy + 1 + drop + wob, C.ink, 3);
        } else if (s.wx < gp.x + gw / 2 && !api.result) {
          const pulse = 0.5 + 0.5 * Math.sin(s.t * 7);
          g.push();
          g.alpha(0.5 + 0.4 * pulse);
          g.ctx.setLineDash([16, 12]);
          g.rect(gp.x - gw / 2 - 20, s.gy - 26, gw + 40, 54, null, { r: 10, stroke: C.white, lw: 6 });
          g.ctx.setLineDash([]);
          g.pop();
          g.text("?", gp.x, s.gy - 80, { size: 60, color: C.white, stroke: C.ink, lw: 8 });
        }
      }
      // tábuas boiando para longe
      for (const d of s.drifts) {
        if (d.t > 1.4) continue;
        g.push();
        g.alpha(1 - d.t / 1.4);
        g.translate(d.x + d.t * 90, s.gy + 60 + d.t * 120);
        g.rotate(d.t * 0.6);
        g.rect(-gw / 2 - 26, -15, gw + 52, 30, C.brown2, { r: 6, lw: 5 });
        g.pop();
      }
      // o colega distraído
      const won = api.result === "win";
      let px = s.wx;
      let py = s.gy;
      let tilt = 0;
      if (s.fallen) {
        const k = Math.min(1, s.fallT * 3);
        py += k * 140;
        tilt = k * 0.5;
      }
      const sc = 1;
      g.push();
      if (s.fallen) g.clip(s.camX - 10, -h, w / Z + 20, s.gy + 150 + h);
      person(g, px, py - 4, sc, { shirt: C.purple2, tie: C.purple, mood: s.fallen ? "shock" : won ? "happy" : "neutral", look: { x: 0.3, y: 0.6 }, walk: s.fallen || won ? undefined : api.time * 1.6, tilt });
      phone(g, px + 30 * sc, py - 150 * sc, 0.5 * sc, C.sky, -0.3);
      g.pop();
      g.pop();
      const msgY = Math.max(110, s.gy - 470 * Z);
      if (s.fallen) g.text(api.t({ en: "SPLASH!", pt: "TCHIBUM!" }), w / 2, msgY, { size: 110, color: C.white, stroke: C.ink, lw: 12 });
      if (won) g.text(api.t({ en: "MADE IT!", pt: "CHEGOU!" }), w / 2, msgY, { size: 110, color: C.yellow, stroke: C.ink, lw: 12 });
    },
  };
}

export const plankWalk: Entry<S> = {
  def: {
    id: "plank-walk",
    num: 244,
    name: { en: "Plank Walk", pt: "Ponte de Tábuas" },
    verb: { en: "LAY A PLANK!", pt: "PÕE A TÁBUA!" },
    hint: { pointer: "tap" },
    category: "timing",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A coworker glued to his phone walks over a creek with 3 gaps. Tap a gap to drop a plank before he steps there. Planks float away after about a second (too early and it's gone, but you can drop another). Too late is a splash.",
    winText: "Get him across all three gaps.",
    loseText: "He steps into a gap with no plank.",
    timeScale: 1.1,
    minTime: 3.4,
    bg: BG.green,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0.05) return;
          const m = mem(s, () => ({ done: [false, false, false] }));
          for (let i = 0; i < s.gaps.length; i++) {
            const gp = s.gaps[i];
            if (m.done[i]) continue;
            const tp = (gp.exit - s.life + gp.enter) / 2;
            if (api.time >= tp && gp.plank < 0) {
              io.tap((gp.x - s.camX) * s.Z, s.gy);
              m.done[i] = true;
              return;
            }
          }
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0.05) return;
          const m = mem(s, () => ({ done: [false, false, false] }));
          // as duas primeiras certinhas; a terceira tarde demais (ele já pisou no buraco)
          for (let i = 0; i < 3; i++) {
            const gp = s.gaps[i];
            const tp = i < 2 ? (gp.exit - s.life + gp.enter) / 2 : gp.enter + 0.08;
            if (!m.done[i] && api.time >= tp && gp.plank < 0) {
              io.tap((gp.x - s.camX) * s.Z, s.gy);
              m.done[i] = true;
              return;
            }
          }
        },
      }
    : null,
};
