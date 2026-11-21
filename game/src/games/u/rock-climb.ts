// 296 · CLIMB! — parede de escalada. Toque a próxima agarra dentro do círculo de alcance para subir até o sino.
// Agarras rachadas esfarelam (perde); fora do alcance, nada acontece ("LONGE DEMAIS"). 4 movimentos no começo,
// 5 a partir de 0,5 (com mais rachadas). A partir de 1, ficar parado numa agarra por mais de ~1,2 s cansa a mão e você cai.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Hold extends Point {
  cracked: boolean;
  color: string;
  /** Índice no caminho bom (-1 = isca rachada). */
  path: number;
  gone: boolean;
}
interface S {
  holds: Hold[];
  /** Caminho: path[0] é o ponto de partida (chão), o último é o sino. */
  path: Point[];
  bell: Point;
  at: Point;
  /** Posição desenhada do escalador (anima entre agarras). */
  cx: number;
  cy: number;
  fromX: number;
  fromY: number;
  moveT: number;
  pathIdx: number;
  reach: number;
  moves: number;
  grip: number;
  onHoldT: number;
  falling: boolean;
  fallY: number;
  rang: boolean;
  crackW: number;
  t: number;
  endT: number;
}

const TAP_R = 90;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const moves = lv < 0.5 ? 4 : 5;
  const decoys = lv < 0.5 ? 1 : 2;
  const y0 = h - (portrait ? 150 : 110);
  const yBell = portrait ? 170 : 110;
  const dy = (y0 - yBell) / moves;
  const maxDx = Math.min(w * 0.26, portrait ? 260 : 420);
  const reach = Math.hypot(dy, maxDx) * 1.12;
  const margin = 110;
  const colors = [C.pink, C.yellow, C.green, C.blue, C.purple, C.orange];
  // caminho bom
  const path: Point[] = [{ x: w / 2 + rng.range(-w * 0.15, w * 0.15), y: y0 }];
  for (let i = 1; i <= moves; i++) {
    const prev = path[i - 1];
    let x = prev.x;
    for (let k = 0; k < 20; k++) {
      x = prev.x + rng.sign() * rng.range(70, maxDx);
      if (x > margin && x < w - margin) break;
    }
    x = Math.max(margin, Math.min(w - margin, x));
    path.push({ x, y: y0 - dy * i });
  }
  const bell = path[moves];
  const holds: Hold[] = [];
  for (let i = 1; i < moves; i++) holds.push({ ...path[i], cracked: false, color: colors[i % colors.length], path: i, gone: false });
  // iscas rachadas: ao alcance da agarra atual, na altura da próxima, longe das outras
  const free = (p: Point): boolean =>
    p.x > margin * 0.8 && p.x < w - margin * 0.8 && Math.hypot(p.x - bell.x, p.y - bell.y) > 190 && holds.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 175);
  for (let i = 0; i < moves - 1; i++) {
    const cur = path[i];
    const next = path[i + 1];
    let placed = 0;
    for (let k = 0; k < 40 && placed < decoys; k++) {
      const p = { x: next.x + rng.sign() * rng.range(180, 340), y: next.y + rng.range(-40, 40) };
      if (Math.hypot(p.x - cur.x, p.y - cur.y) > reach * 0.92 || !free(p)) continue;
      holds.push({ ...p, cracked: true, color: colors[(i + 3 + placed) % colors.length], path: -1, gone: false });
      placed++;
    }
  }
  const s: S = {
    holds,
    path,
    bell,
    at: path[0],
    cx: path[0].x,
    cy: path[0].y,
    fromX: path[0].x,
    fromY: path[0].y,
    moveT: 1,
    pathIdx: 0,
    reach,
    moves,
    grip: lv < 1 ? 0 : 1.25 - 0.1 * (lv - 1),
    onHoldT: 0,
    falling: false,
    fallY: 0,
    rang: false,
    crackW: Math.max(3, 8 - lv * 3),
    t: 0,
    endT: 0,
  };

  const fall = (msg: string) => {
    s.falling = true;
    api.sfx("thud");
    api.fx.shake(0.8);
    api.fx.pop(s.cx, s.cy - 120, msg, C.red);
    api.lose();
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.moveT += dt;
      const k = Math.min(1, s.moveT / 0.14);
      s.cx = s.fromX + (s.at.x - s.fromX) * k;
      s.cy = s.fromY + (s.at.y - s.fromY) * k;
      if (api.result) {
        s.endT += dt;
        if (s.falling) s.fallY += (200 + s.endT * 1600) * dt;
        return;
      }
      if (s.grip > 0 && s.pathIdx > 0) {
        s.onHoldT += dt;
        if (s.onHoldT > s.grip) {
          fall(api.t({ en: "TIRED HANDS!", pt: "CANSOU!" }));
          return;
        }
      }
      const inp = api.input;
      if (!inp.pressed) return;
      // alvo: o sino ou a agarra mais perto do toque
      let best: Hold | null = null;
      let bestD = TAP_R;
      for (const hd of s.holds) {
        if (hd.gone) continue;
        const d = Math.hypot(hd.x - inp.x, hd.y - inp.y);
        if (d < bestD) {
          best = hd;
          bestD = d;
        }
      }
      const bellD = Math.hypot(s.bell.x - inp.x, s.bell.y - inp.y);
      const target: Point | null = bellD < 110 && bellD < bestD ? s.bell : best;
      if (!target || target === s.at) return;
      if (Math.hypot(target.x - s.at.x, target.y - s.at.y) > s.reach) {
        api.sfx("miss");
        api.fx.pop(target.x, target.y - 60, api.t({ en: "TOO FAR", pt: "LONGE DEMAIS" }), C.white);
        return;
      }
      s.fromX = s.cx;
      s.fromY = s.cy;
      s.moveT = 0;
      s.onHoldT = 0;
      if (target === s.bell) {
        s.at = s.bell;
        s.rang = true;
        api.sfx("chime");
        api.fx.burst(s.bell.x, s.bell.y, C.yellow, 22);
        api.fx.pop(s.bell.x, s.bell.y + 90, api.t({ en: "DING!", pt: "DING!" }), C.yellow);
        api.win();
        return;
      }
      const hd = target as Hold;
      s.at = hd;
      if (hd.cracked) {
        hd.gone = true;
        api.fx.burst(hd.x, hd.y, C.gray, 14);
        fall(api.t({ en: "CRUMBLED!", pt: "ESFARELOU!" }));
        return;
      }
      s.pathIdx = Math.max(s.pathIdx, hd.path);
      api.sfx("tap");
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // textura da parede: painéis e parafusos
      const pw = 250;
      for (let y = -((s.t * 0) % pw); y < h; y += pw) {
        for (let x = 0; x < w; x += pw) {
          g.rect(x + 4, y + 4, pw - 8, pw - 8, null, { stroke: "#19a99c", lw: 4, r: 8 });
          g.circle(x + pw / 2, y + pw / 2, 6, "#169488", { stroke: null });
        }
      }
      // chão
      g.rect(-10, s.path[0].y + 40, w + 20, h, C.brown2, { lw: 7 });
      // sino
      const ring = s.rang ? Math.sin(s.endT * 30) * 0.3 : Math.sin(s.t * 2) * 0.05;
      g.push();
      g.translate(s.bell.x, s.bell.y - 40);
      g.rotate(ring);
      g.line(0, -50, 0, -20, C.ink, 8);
      g.shape(0, 0, [-50, 50, -36, -8, -16, -26, 16, -26, 36, -8, 50, 50], C.yellow, { lw: 7 });
      g.circle(0, 58, 12, C.orange, { lw: 5 });
      g.pop();
      // alcance
      if (!api.result) {
        g.push();
        g.alpha(0.85);
        g.circle(s.at.x, s.at.y, s.reach, null, { stroke: C.white, lw: 6 });
        g.pop();
        g.push();
        g.alpha(0.12);
        g.circle(s.at.x, s.at.y, s.reach, C.white, { stroke: null });
        g.pop();
      }
      // agarras
      for (const hd of s.holds) {
        if (hd.gone) continue;
        drawHold(g, hd, s.crackW);
      }
      // escalador (pendurado sob a mão)
      const fy = s.fallY;
      drawClimber(g, s.cx, s.cy + fy, s.at === s.path[0], api.result === "win", s.falling, s.grip > 0 && s.pathIdx > 0 ? s.onHoldT / s.grip : 0, s.t);
    },
  };
}

function drawHold(g: Gfx, hd: Hold, crackW: number): void {
  const col = hd.cracked ? "#b9b2a4" : hd.color;
  g.push();
  g.translate(hd.x, hd.y);
  g.scale(1.3);
  g.translate(-hd.x, -hd.y);
  g.shape(hd.x, hd.y, [-46, 10, -30, -28, 6, -40, 40, -18, 46, 16, 14, 34, -24, 32], col, { lw: 7 });
  g.circle(hd.x, hd.y - 2, 8, C.ink2, { stroke: null });
  if (hd.cracked) {
    g.polyline(
      [
        { x: hd.x - 30, y: hd.y - 24 },
        { x: hd.x - 8, y: hd.y - 6 },
        { x: hd.x - 18, y: hd.y + 10 },
        { x: hd.x + 6, y: hd.y + 28 },
      ],
      C.ink,
      crackW,
    );
    g.polyline(
      [
        { x: hd.x + 34, y: hd.y - 12 },
        { x: hd.x + 14, y: hd.y + 2 },
      ],
      C.ink,
      crackW,
    );
  }
  g.pop();
}

/** Escalador: (x, y) = mãos na agarra; no chão, fica de pé. */
function drawClimber(g: Gfx, x: number, y: number, ground: boolean, happy: boolean, falling: boolean, tired: number, t: number): void {
  g.push();
  g.translate(x, y);
  if (ground) g.translate(0, -230);
  const sw = Math.sin(t * 3) * 6 + (tired > 0.6 ? Math.sin(t * 40) * 6 * tired : 0);
  // braços para cima
  if (!ground) {
    g.line(-16, 0, -30, 70, C.skin2, 16);
    g.line(16, 0, 30, 70, C.skin2, 16);
  }
  g.rect(-40 + sw * 0.3, 70, 80, 100, C.orange, { r: 24 });
  g.rect(-40 + sw * 0.3, 150, 80, 22, C.ink2, { r: 6, stroke: null });
  g.line(-18, 166, -30 + sw, 240, C.ink, 16);
  g.line(18, 166, 30 + sw, 240, C.ink, 16);
  g.circle(0, 40, 40, C.skin);
  g.rect(-42, 6, 84, 28, C.red, { r: 14, lw: 5 });
  g.face(0, 52, 56, falling ? "shock" : happy ? "happy" : tired > 0.6 ? "worried" : "neutral", { x: 0, y: -1 });
  if (ground) {
    g.line(-40, 90, -64, 150, C.skin2, 16);
    g.line(40, 90, 64, 150, C.skin2, 16);
  }
  g.pop();
}

export const rockClimb: Entry<S> = {
  def: {
    id: "rock-climb",
    num: 296,
    name: { en: "Rock Climb", pt: "Escalada" },
    verb: { en: "CLIMB!", pt: "ESCALA!" },
    hint: { pointer: "tap" },
    category: "reflex",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A climbing wall: tap the next hold inside your reach circle to climb up to the bell. Cracked holds crumble and you fall; holds out of reach just say TOO FAR. 4 moves at first, 5 later with more cracked holds and subtler cracks; from level 1 your hands get tired if you stay on a hold for more than about 1.2 s.",
    winText: "Climb hold by hold and tap the bell.",
    loseText: "Grab a cracked hold, hang too long (later), or run out of time.",
    timeScale: 1.3,
    minTime: 3.4,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1 || s.moveT < 0.2 || io.isDown) return;
          const next = s.pathIdx + 1 >= s.moves ? s.bell : s.holds.find((hd) => hd.path === s.pathIdx + 1)!;
          io.tap(next.x, next.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1 || s.moveT < 0.2 || io.isDown) return;
          const m = mem(s, () => ({ n: 0 }));
          // sobe uma vez e depois agarra uma rachada ao alcance (ou insiste numa longe até o tempo acabar)
          const crack = s.holds.find((hd) => hd.cracked && !hd.gone && Math.hypot(hd.x - s.at.x, hd.y - s.at.y) <= s.reach);
          if (m.n >= 1 && crack) {
            io.tap(crack.x, crack.y);
            return;
          }
          if (m.n >= 1) return;
          m.n++;
          const next = s.holds.find((hd) => hd.path === s.pathIdx + 1) ?? s.bell;
          io.tap(next.x, next.y);
        },
      }
    : null,
};
