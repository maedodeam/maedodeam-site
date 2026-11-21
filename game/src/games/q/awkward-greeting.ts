// 249 · GREET! — colegas vêm até você oferecendo um cumprimento: soquinho (toque), aperto de mão (deslize →)
// ou "toca aqui" (deslize ↑). Quando ele chega e estende a mão, responda com o gesto certo. Errou = climão (perde);
// deixar no vácuo também. Teclado: ↓ ou Espaço = soquinho, → = aperto de mão, ↑ = toca aqui.
// Níveis altos: o colega muda de ideia no meio do caminho (lv ≥ 0.5; mais em cima da hora em lv ≥ 1), 4 colegas (lv ≥ 1),
// menos tempo para responder.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { botSwipe, isPortrait, type GestureMem } from "./util.ts";

/** 0 = soquinho, 1 = aperto de mão, 2 = toca aqui. */
type Gesture = 0 | 1 | 2;
const NAMES = [
  { en: "FIST BUMP", pt: "SOQUINHO" },
  { en: "HANDSHAKE", pt: "APERTO DE MÃO" },
  { en: "HIGH FIVE", pt: "TOCA AQUI" },
];
const SHIRTS = [C.blue2, C.pink2, C.green2, C.yellow2, C.purple2];

interface Mate {
  first: Gesture;
  final: Gesture;
  /** Fração da chegada em que ele muda de ideia (-1 = não muda). */
  switchAt: number;
  shirt: string;
}
interface S {
  mates: Mate[];
  cur: number;
  phase: "approach" | "greet" | "done";
  pt: number;
  approach: number;
  window: number;
  /** Gesto mostrado agora pelo colega atual. */
  showing: Gesture;
  answered: Gesture | -1;
  leaveT: number;
  wait: number;
  awkward: boolean;
  t: number;
  endT: number;
}

function handIcon(g: Gfx, x: number, y: number, s: number, ge: Gesture, flip = 1): void {
  g.push();
  g.translate(x, y);
  g.scale(s * flip, s);
  if (ge === 0) {
    g.rect(-34, -30, 68, 60, C.skin, { r: 18, lw: 6 });
    for (let i = 0; i < 3; i++) g.line(-30, -14 + i * 15, -12, -14 + i * 15, C.ink, 4);
    g.rect(-6, -40, 30, 18, C.skin, { r: 9, lw: 5 });
  } else if (ge === 1) {
    g.rect(-40, -18, 80, 40, C.skin, { r: 18, lw: 6 });
    g.rect(-10, -44, 18, 34, C.skin, { r: 9, lw: 5 });
    for (let i = 0; i < 3; i++) g.line(10 + i * 10, -14, 10 + i * 10, 16, C.ink, 3);
  } else {
    g.rect(-30, -20, 60, 56, C.skin, { r: 16, lw: 6 });
    for (let i = 0; i < 4; i++) g.rect(-28 + i * 15, -62, 13, 46, C.skin, { r: 6, lw: 4 });
    g.rect(24, -14, 30, 13, C.skin, { r: 6, lw: 4 });
  }
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv >= 1 ? 4 : 3;
  const mates: Mate[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let first = rng.int(0, 2) as Gesture;
    if (first === last) first = ((first + 1) % 3) as Gesture;
    let final = first;
    let switchAt = -1;
    if (lv >= 0.5 && rng.chance(lv >= 1 ? 0.6 : 0.45)) {
      final = ((first + rng.int(1, 2)) % 3) as Gesture;
      switchAt = lv >= 1 ? 0.85 : 0.6;
    }
    last = final;
    mates.push({ first, final, switchAt, shirt: SHIRTS[(i + rng.int(0, 4)) % SHIRTS.length] });
  }
  const s: S = {
    mates,
    cur: 0,
    phase: "approach",
    pt: 0,
    approach: Math.max(0.4, 0.6 - 0.12 * lv),
    window: 1.15 - 0.32 * lv,
    showing: mates[0].first,
    answered: -1,
    leaveT: 9,
    wait: 0,
    awkward: false,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.leaveT += dt;
      s.wait = Math.max(0, s.wait - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const mate = s.mates[s.cur];
      s.pt += dt;
      if (s.phase === "approach") {
        const k = s.pt / s.approach;
        const was = s.showing;
        s.showing = mate.switchAt >= 0 && k >= mate.switchAt ? mate.final : mate.first;
        if (was !== s.showing) {
          api.sfx("boing");
          api.fx.pop(w * (portrait ? 0.66 : 0.62), h * 0.25, "?!", C.yellow);
        }
        if (k >= 1) {
          s.phase = "greet";
          s.pt = 0;
          api.sfx("beep");
        }
      } else if (s.phase === "greet" && s.pt >= s.window) {
        s.awkward = true;
        api.sfx("miss");
        api.fx.pop(w / 2, h * 0.3, api.t({ en: "LEFT HANGING…", pt: "VÁCUO…" }), C.red);
        api.lose();
        return;
      }
      // leitura do gesto
      const inp = api.input;
      let ge: Gesture | -1 = -1;
      if (inp.keyPressed("action") || inp.keyPressed("down")) ge = 0;
      else if (inp.keyPressed("right")) ge = 1;
      else if (inp.keyPressed("up")) ge = 2;
      else if (inp.swipeLine) {
        if (inp.swipeLine.dir === "right") ge = 1;
        else if (inp.swipeLine.dir === "up") ge = 2;
      } else if (inp.released && Math.hypot(inp.x - inp.startX, inp.y - inp.startY) < 60) ge = 0;
      if (ge < 0) return;
      if (s.phase !== "greet") {
        s.wait = 0.4;
        api.sfx("tap");
        return;
      }
      s.answered = ge;
      if (ge === mate.final) {
        api.sfx(ge === 0 ? "thud" : ge === 1 ? "pop" : "hit");
        api.fx.burst(w * 0.48, h * 0.42, C.yellow, 16);
        s.leaveT = 0;
        s.cur++;
        if (s.cur >= s.mates.length) {
          s.phase = "done";
          api.sfx("chime");
          api.win();
          return;
        }
        s.phase = "approach";
        s.pt = 0;
        s.showing = s.mates[s.cur].first;
      } else {
        s.awkward = true;
        api.sfx("buzz");
        api.fx.shake(0.4);
        api.fx.pop(w / 2, h * 0.3, api.t({ en: "AWKWARD…", pt: "CLIMÃO…" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // corredor do escritório
      const floor = portrait ? h * 0.62 : h * 0.72;
      g.rect(-10, floor, w + 20, h - floor + 10, C.paper2, { lw: 6 });
      for (let x = 0; x < w; x += 220) g.rect(x + 40, floor - 420, 120, 200, C.sky, { lw: 6, r: 8 });
      const sc = portrait ? 1.75 : 1.3;
      const meX = w * (portrait ? 0.27 : 0.33);
      const meetX = w * (portrait ? 0.68 : 0.6);
      const handY = floor - 120 * sc;
      // colega que saiu (indo embora feliz)
      if (s.leaveT < 0.35 && s.cur > 0) {
        // sai de cena para o fundo (some rápido, para não se misturar com o próximo)
        g.push();
        g.alpha(1 - s.leaveT / 0.35);
        person(g, meetX + s.leaveT * 300, floor + 40 - s.leaveT * 200, sc * (1 - s.leaveT), { shirt: s.mates[s.cur - 1].shirt, mood: "happy", walk: s.leaveT * 3 });
        g.pop();
      }
      // colega atual
      const done = s.phase === "done";
      if (!done && s.cur < s.mates.length) {
        const mate = s.mates[s.cur];
        const k = s.phase === "approach" ? Math.min(1, s.pt / s.approach) : 1;
        const x = meetX + (1 - k) * (w - meetX + 160);
        const mood = s.awkward ? "worried" : s.phase === "greet" ? "happy" : "neutral";
        person(g, x, floor + 40, sc, { shirt: mate.shirt, mood, look: { x: -1, y: 0 }, walk: k < 1 ? s.pt * 3 : undefined });
        // braço estendido + mão
        const hx = x - 110 * sc;
        const hy = s.showing === 2 ? handY - 90 : handY;
        g.line(x - 30 * sc, floor + 40 - 120 * sc, hx + 20, hy, C.ink, 22);
        g.line(x - 30 * sc, floor + 40 - 120 * sc, hx + 20, hy, mate.shirt, 12);
        handIcon(g, hx, hy, 1.1, s.showing, -1);
        // balão com o nome do gesto
        const label = api.t(NAMES[s.showing]);
        const by = floor - 330 * sc;
        const tw = g.textWidth(label, { size: 56 }) + 56;
        g.rect(x - tw / 2, by - 40, tw, 80, s.phase === "greet" ? C.white : C.paper, { r: 40, lw: 6 });
        g.text(label, x, by, { size: 56, color: C.ink });
        if (s.phase === "greet") {
          const left = 1 - s.pt / s.window;
          g.rect(x - tw / 2 + 10, by + 48, (tw - 20) * Math.max(0, left), 12, left < 0.35 ? C.red : C.green, { r: 6, stroke: null });
        }
        if (s.wait > 0) g.text(api.t({ en: "WAIT…", pt: "ESPERA…" }), x, by - 80, { size: 44, color: C.white, stroke: C.ink, lw: 8 });
      }
      // você
      const myGe = s.answered;
      person(g, meX, floor + 40, sc, { shirt: C.orange, tie: C.ink, mood: s.awkward ? "worried" : api.result === "win" ? "happy" : "neutral", look: { x: 1, y: 0 } });
      if (myGe >= 0 && s.leaveT < 0.35) {
        const hx = meetX - 175 * sc;
        handIcon(g, hx, myGe === 2 ? handY - 90 : handY, 1.1, myGe as Gesture, 1);
        g.line(meX + 30 * sc, floor + 40 - 120 * sc, hx - 20, myGe === 2 ? handY - 90 : handY, C.ink, 22);
      }
      // legenda dos gestos
      const ly = portrait ? h * 0.85 : h * 0.9;
      const keys = api.input.mode === "keys";
      const tags = keys ? ["↓", "→", "↑"] : [api.t({ en: "TAP", pt: "TOQUE" }), "→", "↑"];
      for (let i = 0; i < 3; i++) {
        const cx = w / 2 + (i - 1) * (portrait ? 300 : 330);
        g.rect(cx - 130, ly - 60, 260, 120, C.white, { r: 24, lw: 6 });
        handIcon(g, cx - 60, ly + 8, 0.7, i as Gesture, 1);
        g.text(tags[i], cx + 45, ly + 2, { size: 50, color: C.ink, maxWidth: 140 });
      }
    },
  };
}

export const awkwardGreeting: Entry<S> = {
  def: {
    id: "awkward-greeting",
    num: 249,
    name: { en: "Awkward Greeting", pt: "Cumprimento Sem Graça" },
    verb: { en: "GREET!", pt: "CUMPRIMENTA!" },
    hint: { pointer: "swipe", keys: "arrows" },
    category: "reflex",
    family: "swipe",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Coworkers walk up offering a fist bump (tap), a handshake (swipe right) or a high five (swipe up). When each one arrives and holds out a hand, answer with the matching gesture. Later they change their mind on the way.",
    winText: "Match every coworker's greeting.",
    loseText: "Use the wrong gesture (awkward!) or leave someone hanging.",
    timeScale: 1.3,
    minTime: 4,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ gs: 0, cur: -1 }) as GestureMem & { cur: number });
          if (s.phase !== "greet" && m.gs === 0) return;
          if (m.gs === 0 && m.cur === s.cur) return;
          const ge = s.mates[s.cur]?.final ?? 0;
          if (ge === 0) {
            io.tap(api.w / 2, api.h / 2);
            m.cur = s.cur;
            return;
          }
          if (m.gs === 0) m.cur = s.cur;
          botSwipe(io, m, api.w / 2 - 100, api.h / 2 + 100, ge === 1 ? "right" : "up", 240);
        },
        lose(s, api, io) {
          if (api.result || api.time <= 0) return;
          const m = mem(s, () => ({ gs: 0, cur: -1 }) as GestureMem & { cur: number });
          if (s.phase !== "greet" && m.gs === 0) return;
          if (m.gs === 0 && m.cur === s.cur) return;
          const ge = ((s.mates[s.cur]?.final ?? 0) + 1) % 3;
          if (ge === 0) {
            io.tap(api.w / 2, api.h / 2);
            m.cur = s.cur;
            return;
          }
          if (m.gs === 0) m.cur = s.cur;
          botSwipe(io, m, api.w / 2 - 100, api.h / 2 + 100, ge === 1 ? "right" : "up", 240);
        },
      }
    : null,
};
