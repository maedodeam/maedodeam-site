// 016 · SHAVE! — reunião em 5 minutos e a barba por fazer. Passe o barbeador na espuma; cuidado com o nariz
// (e, nos níveis altos, com o bigode sagrado).
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { segDist } from "../../kit/mover.ts";
import { mem, moveToward } from "../../testing/botkit.ts";
import { bigText } from "./art-a.ts";

interface Tuft {
  x: number;
  y: number;
  gone: number; // >0 raspado (tempo)
  rot: number;
}
interface S {
  fx: number;
  fy: number;
  rx: number;
  ry: number;
  nose: Point;
  nr: number;
  stache: { x: number; y: number; rx: number; ry: number } | null;
  tufts: Tuft[];
  removed: number;
  need: number;
  cut: Point | null;
  cutWhat: "nose" | "stache" | null;
}

const BLADE = 70;
const NOSE_PAD = 22;

function inStache(s: S, p: Point, pad = 0): boolean {
  const m = s.stache;
  if (!m) return false;
  const dx = (p.x - m.x) / (m.rx + pad);
  const dy = (p.y - m.y) / (m.ry + pad);
  return dx * dx + dy * dy <= 1;
}

/** O segmento ab passa por zona proibida? Devolve o ponto ou null. */
export function forbiddenOnSeg(s: S, a: Point, b: Point): { p: Point; what: "nose" | "stache" } | null {
  if (segDist(s.nose, a, b) < s.nr + NOSE_PAD) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((s.nose.x - a.x) * dx + (s.nose.y - a.y) * dy) / l2));
    return { p: { x: a.x + dx * t, y: a.y + dy * t }, what: "nose" };
  }
  if (s.stache) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let i = 0; i <= n; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
      if (inStache(s, p)) return { p, what: "stache" };
    }
  }
  return null;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const fx = w / 2;
  const fy = portrait ? h * 0.5 : h * 0.53;
  const rx = portrait ? 400 : 330;
  const ry = portrait ? 500 : 410;
  const nr = 58;
  const s: S = {
    fx,
    fy,
    rx,
    ry,
    nose: { x: fx, y: fy - ry * 0.02 },
    nr,
    stache: lv >= 1 ? { x: fx, y: fy + ry * 0.2, rx: 150, ry: 42 } : null,
    tufts: [],
    removed: 0,
    need: 0,
    cut: null,
    cutWhat: null,
  };
  const n = Math.round(40 + 20 * lv);
  let guard = 0;
  while (s.tufts.length < n && guard++ < 5000) {
    const p = { x: fx + rng.range(-rx, rx), y: fy + rng.range(-ry * 0.12, ry) };
    const ex = (p.x - fx) / (rx * 0.86);
    const ey = (p.y - fy) / (ry * 0.88);
    if (ex * ex + ey * ey > 1) continue;
    if (Math.hypot(p.x - s.nose.x, p.y - s.nose.y) < nr + NOSE_PAD + 14) continue;
    if (inStache(s, p, 30)) continue;
    // espaço entre tufos
    if (s.tufts.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 36)) continue;
    s.tufts.push({ x: p.x, y: p.y, gone: 0, rot: rng.range(-0.6, 0.6) });
  }
  s.need = Math.ceil(s.tufts.length * 0.92);

  const shaveSeg = (a: Point, b: Point) => {
    const bad = forbiddenOnSeg(s, a, b);
    if (bad) {
      s.cut = bad.p;
      s.cutWhat = bad.what;
      api.sfx("hit");
      api.fx.shake(0.7);
      api.fx.pop(bad.p.x, bad.p.y - 120, api.t(bad.what === "nose" ? { en: "OUCH!", pt: "AI!" } : { en: "NOT THE STACHE!", pt: "O BIGODE NÃO!" }), C.red);
      api.lose();
      return;
    }
    let got = 0;
    for (const t of s.tufts) {
      if (t.gone > 0) continue;
      if (segDist(t, a, b) <= BLADE) {
        t.gone = 0.001;
        got++;
      }
    }
    if (got) {
      s.removed += got;
      api.sfx("slide");
      if (s.removed >= s.need) {
        api.sfx("chime");
        api.fx.burst(fx, fy + ry * 0.5, undefined, 26);
        api.win();
      }
    }
  };

  return {
    s,
    update(dt) {
      for (const t of s.tufts) if (t.gone > 0) t.gone += dt;
      if (api.result) return;
      const inp = api.input;
      if (inp.pressed) shaveSeg({ x: inp.startX, y: inp.startY }, { x: inp.startX, y: inp.startY });
      if (inp.down) for (const [a, b] of inp.segments) if (!api.result) shaveSeg(a, b);
    },
    draw(g: Gfx) {
      g.clear(BG.teal);
      // espelho do banheiro do escritório
      g.rect(30, 30, w - 60, h - 60, C.sky, { r: 40, lw: 10 });
      g.line(w * 0.7, 60, w * 0.85, 260, C.white, 14);
      g.line(w * 0.76, 60, w * 0.9, 230, C.white, 8);
      // pescoço e camisa
      g.rect(fx - rx * 0.45, fy + ry * 0.6, rx * 0.9, ry, C.skin);
      g.shape(fx, fy + ry * 1.05, [-rx * 1.3, 400, -rx * 1.1, 0, -rx * 0.3, -60, rx * 0.3, -60, rx * 1.1, 0, rx * 1.3, 400], C.white);
      g.shape(fx, fy + ry * 1.0, [-40, 0, 40, 0, 26, 260, 0, 300, -26, 260], C.blue, { lw: 5 });
      // orelhas e rosto
      g.ellipse(fx - rx, fy - ry * 0.1, 60, 100, C.skin);
      g.ellipse(fx + rx, fy - ry * 0.1, 60, 100, C.skin);
      g.ellipse(fx, fy, rx, ry, C.skin);
      // cabelo
      g.push();
      g.clip(fx - rx - 10, fy - ry - 10, rx * 2 + 20, ry * 0.62);
      g.ellipse(fx, fy - ry * 0.18, rx * 1.04, ry * 0.9, C.ink2);
      g.pop();
      // espuma + tufos
      for (const t of s.tufts) {
        if (t.gone > 0.25) continue;
        g.push();
        if (t.gone > 0) g.alpha(1 - t.gone / 0.25);
        g.circle(t.x, t.y, 34, C.white, { stroke: null });
        g.line(t.x - 10, t.y + 10, t.x - 14 + Math.sin(t.rot) * 8, t.y - 12, C.ink2, 7);
        g.line(t.x + 4, t.y + 12, t.x + 4 + Math.sin(t.rot) * 10, t.y - 14, C.ink2, 7);
        g.line(t.x + 16, t.y + 8, t.x + 20 + Math.sin(t.rot) * 6, t.y - 10, C.ink2, 7);
        g.pop();
      }
      // olhos e boca
      const mood = s.cut ? "shock" : api.result === "win" ? "happy" : "worried";
      g.face(fx, fy - ry * 0.18, rx * 0.95, mood, { x: 0, y: 0.6 });
      const my = fy + ry * 0.48;
      if (s.cut) g.ellipse(fx, my, 50, 36, C.ink);
      else if (api.result === "win") g.arc(fx, my - 30, 70, 0.2, Math.PI - 0.2, C.ink, 10);
      else g.line(fx - 60, my, fx + 60, my - 6, C.ink, 10);
      // bigode sagrado
      const m = s.stache;
      if (m) {
        const sx = s.cutWhat === "stache" ? 0.5 : 1;
        g.push();
        g.translate(m.x, m.y);
        g.scale(sx, 1);
        g.shape(0, 0, [0, -10, -60, -34, -120, -24, -160, -50, -150, 0, -100, 26, -40, 22], C.brown);
        g.shape(0, 0, [0, -10, 60, -34, 120, -24, 160, -50, 150, 0, 100, 26, 40, 22], C.brown);
        g.pop();
        if (!api.result) {
          g.star(m.x - 190, m.y - 50, 18, 7, 4, C.yellow, { lw: 3 });
          g.star(m.x + 190, m.y - 50, 18, 7, 4, C.yellow, { lw: 3 });
        }
      }
      // nariz
      g.circle(s.nose.x, s.nose.y, s.nr, C.skin2, { lw: 7 });
      g.ellipse(s.nose.x - 20, s.nose.y - 20, 14, 9, C.white, { stroke: null });
      if (s.cut && s.cutWhat === "nose") {
        g.push();
        g.translate(s.nose.x, s.nose.y);
        g.rotate(-0.5);
        g.rect(-80, -26, 160, 52, C.yellow2, { r: 20 });
        g.rect(-24, -26, 48, 52, C.paper2, { lw: 4 });
        g.pop();
      }
      // barbeador
      const inp = api.input;
      if (!api.result && inp.hasPointer && (inp.down || inp.mode === "mouse")) {
        g.push();
        g.translate(inp.x, inp.y);
        g.rotate(-0.15);
        g.rect(-18, 20, 36, 220, C.blue, { r: 16 });
        g.rect(-BLADE, -26, BLADE * 2, 48, C.paper2, { r: 12 });
        g.line(-BLADE + 10, -6, BLADE - 10, -6, C.gray, 6);
        g.line(-BLADE + 10, 8, BLADE - 10, 8, C.gray, 6);
        g.pop();
      }
      // placar
      const left = Math.max(0, s.need - s.removed);
      if (!api.result) bigText(g, `${Math.min(100, Math.round((s.removed / s.need) * 100))}%`, portrait ? w / 2 : w - 180, portrait ? 160 : h / 2, 90, left === 0 ? C.green : C.paper);
      if (api.result === "win") bigText(g, api.t({ en: "SMOOTH!", pt: "LISINHO!" }), w / 2, portrait ? 180 : 130, 120, C.yellow, -0.05);
    },
  };
}

export const shave: Entry<S> = {
  def: {
    id: "shave",
    num: 16,
    name: { en: "Quick Shave", pt: "Barba Rápida" },
    verb: { en: "SHAVE!", pt: "BARBEIA!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "A meeting in five minutes and a foamy beard to go. Drag the razor over the foam to shave it off without touching the nose. Later, a sacred mustache must survive too.",
    winText: "Shave at least 92% of the beard.",
    loseText: "The razor touches the nose (or the mustache), or time runs out.",
    timeScale: 1.5,
    minTime: 3.8,
    bg: BG.teal,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          const m = mem(s, () => ({ target: null as Point | null }));
          const left = s.tufts.filter((t) => t.gone === 0);
          if (!left.length) return;
          const cur = { x: io.px, y: io.py };
          if (!m.target || s.tufts.every((t) => t.gone > 0 || Math.hypot(t.x - m.target!.x, t.y - m.target!.y) > 1)) {
            const t = left.sort((a, b) => Math.hypot(a.x - cur.x, a.y - cur.y) - Math.hypot(b.x - cur.x, b.y - cur.y))[0];
            m.target = { x: t.x, y: t.y };
          }
          const tg = m.target;
          if (!io.isDown) {
            io.down(tg.x, tg.y);
            m.target = null;
            return;
          }
          // Caminho reto passa pelo nariz/bigode? Levanta e desce do outro lado.
          if (forbiddenOnSeg(s, cur, tg) || Math.hypot(tg.x - cur.x, tg.y - cur.y) > 900) {
            io.up(cur.x, cur.y);
            return;
          }
          moveToward(io, tg, 3000, dt);
          if (Math.hypot(io.px - tg.x, io.py - tg.y) < 1) m.target = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          if (!io.isDown) {
            io.down(s.fx - s.rx * 0.6, s.nose.y + 40);
            return;
          }
          moveToward(io, s.nose, 1500, dt);
        },
      }
    : null,
};
