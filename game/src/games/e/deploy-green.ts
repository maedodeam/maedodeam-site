// 084 · DEPLOY! — painel de CI com verificações que piscam entre rodando, falhou e passou.
// Aperte DEPLOY só quando todas estiverem verdes ao mesmo tempo (janelas curtas).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bigButton } from "../../gfx/art.ts";
import { card, flame, isPortrait } from "./util.ts";

type St = "run" | "fail" | "pass";
interface Seg {
  t0: number;
  t1: number;
  st: St;
}
interface S {
  names: string[];
  segs: Seg[][];
  windows: [number, number][];
  t: number;
  bx: number;
  by: number;
  br: number;
  pressed: boolean;
  pressT: number;
  ok: boolean;
}

const NAMES = {
  en: ["lint", "tests", "build", "security", "coffee", "vibes"],
  pt: ["lint", "testes", "build", "segurança", "café", "vibe"],
};
const GRACE = 0.06;

function stateAt(segs: Seg[], t: number): St {
  for (const s of segs) if (t >= s.t0 && t < s.t1) return s.st;
  return "pass";
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.3 ? 3 : lv < 0.8 ? 4 : lv < 1.2 ? 5 : 6;
  const names = rng.shuffle(NAMES[api.lang]).slice(0, n);
  const len = 0.8 - lv * 0.3;
  const gapLen = 1.05 - lv * 0.3;
  const windows: [number, number][] = [];
  const segs: Seg[][] = names.map(() => []);
  let t = 0;
  let next = (lv < 0.3 ? 1.1 : 0.85) + rng.range(0, 0.25);
  let lastBlocker = -1;
  while (t < api.duration + 2) {
    // intervalo [t, next): sempre há pelo menos uma verificação não verde (o "bloqueador")
    let blocker = rng.int(0, n - 1);
    if (blocker === lastBlocker) blocker = (blocker + 1) % n;
    lastBlocker = blocker;
    for (let i = 0; i < n; i++) {
      let a = t;
      while (a < next) {
        const d = rng.range(0.16, 0.45);
        const st: St = i === blocker ? rng.pick(["run", "fail", "run"] as St[]) : rng.pick(["run", "pass", "pass", "fail"] as St[]);
        segs[i].push({ t0: a, t1: Math.min(next, a + d), st });
        a += d;
      }
    }
    windows.push([next, next + len]);
    for (let i = 0; i < n; i++) segs[i].push({ t0: next, t1: next + len, st: "pass" });
    t = next + len;
    next = t + gapLen * rng.range(0.85, 1.2);
  }

  const compact = !portrait && w < 1300;
  const bx = portrait ? w * 0.62 : w * 0.77;
  const by = portrait ? h * 0.79 : h * 0.4;
  const br = portrait ? 190 : compact ? 140 : 210;
  const s: S = { names, segs, windows, t: 0, bx, by, br, pressed: false, pressT: 0, ok: false };

  const allGreen = (tt: number) => s.windows.some(([a, b]) => tt >= a && tt < b + GRACE);

  return {
    s,
    update(dt) {
      s.t = api.time;
      if (s.pressed) s.pressT += dt;
      if (api.result) return;
      const inp = api.input;
      const hitBtn = inp.pressed && Math.hypot(inp.x - s.bx, inp.y - s.by) < s.br * 1.3;
      if (hitBtn || inp.keyPressed("action")) {
        s.pressed = true;
        s.pressT = 0;
        if (allGreen(api.time)) {
          s.ok = true;
          api.sfx("rise");
          for (const c of [C.green, C.yellow, C.pink, C.sky]) api.fx.burst(s.bx, s.by - s.br, c, 12);
          api.win();
        } else {
          api.sfx("buzz");
          api.fx.shake(0.8);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      for (let i = 0; i < 30; i++) g.circle((i * 397) % w, (i * 211) % h, 3, "#3a3970", { stroke: null });
      const now = s.t;
      // painel de CI
      const px = portrait ? 60 : 70;
      const pw = portrait ? w - 120 : w < 1300 ? w * 0.5 : w * 0.54;
      const py = portrait ? 210 : 110;
      const ph = portrait ? h * 0.5 : h - 200;
      card(g, px, py, pw, ph, C.paper, 26, 8);
      g.rect(px, py, pw, 86, C.ink2, { r: 26 });
      g.rect(px + 4, py + 50, pw - 8, 36, C.ink2, { stroke: null });
      g.text(api.t({ en: "PIPELINE #4096", pt: "PIPELINE #4096" }), px + 36, py + 44, { size: 40, font: "mono", align: "left", color: C.paper });
      const rowH = (ph - 120) / s.names.length;
      for (let i = 0; i < s.names.length; i++) {
        const st = api.result === "win" ? "pass" : stateAt(s.segs[i], now);
        const cy = py + 104 + rowH * (i + 0.5);
        const col = st === "pass" ? C.green : st === "fail" ? C.red : C.yellow;
        const pr = Math.min(rowH * 0.36, 40);
        g.rect(px + 24, cy - rowH * 0.42, pw - 48, rowH * 0.84, i % 2 ? "#e4e0d6" : C.white, { r: 16, lw: 4 });
        g.circle(px + 40 + pr + 10, cy, pr, col, { lw: 5 });
        const ix = px + 50 + pr;
        if (st === "pass") {
          g.polyline(
            [
              { x: ix - pr * 0.45, y: cy },
              { x: ix - pr * 0.1, y: cy + pr * 0.38 },
              { x: ix + pr * 0.5, y: cy - pr * 0.35 },
            ],
            C.ink,
            7,
          );
        } else if (st === "fail") {
          g.line(ix - pr * 0.4, cy - pr * 0.4, ix + pr * 0.4, cy + pr * 0.4, C.ink, 7);
          g.line(ix + pr * 0.4, cy - pr * 0.4, ix - pr * 0.4, cy + pr * 0.4, C.ink, 7);
        } else {
          const a = g.time * 8;
          g.arc(ix, cy, pr * 0.5, a, a + 4.2, C.ink, 7);
        }
        g.text(s.names[i], px + 80 + pr * 2, cy + 2, { size: Math.min(56, rowH * 0.5), font: "mono", align: "left", color: C.ink });
        const label = st === "pass" ? "PASS" : st === "fail" ? "FAIL" : api.t({ en: "RUN…", pt: "RODA…" });
        g.text(label, px + pw - 48, cy + 2, { size: Math.min(44, rowH * 0.4), font: "mono", weight: 800, align: "right", color: st === "fail" ? "#c81d1d" : st === "pass" ? "#1d8a4c" : "#a07000" });
      }

      // servidor (mascote)
      const sx = portrait ? w * 0.17 : w * 0.77;
      const sy = portrait ? h * 0.79 : h * 0.79;
      const fire = api.result === "lose";
      g.shadow(sx, sy + 120, 100);
      g.rect(sx - 90, sy - 120, 180, 240, C.gray2, { r: 18 });
      for (let k = 0; k < 3; k++) {
        g.rect(sx - 70, sy - 100 + k * 70, 140, 50, C.ink2, { r: 8, lw: 4 });
        g.circle(sx + 46, sy - 75 + k * 70, 8, (Math.floor(g.time * 6 + k) % 2 ? C.green : C.yellow), { stroke: null });
      }
      g.face(sx - 10, sy - 40, 90, fire ? "shock" : api.result === "win" ? "happy" : "worried");
      if (fire) {
        const k = Math.min(1, s.pressT * 3);
        for (let f = 0; f < 4; f++) flame(g, sx - 70 + f * 45, sy - 120, 1.5 + k * 1.2 + Math.sin(g.time * 9 + f) * 0.2, g.time + f);
      }

      // botão DEPLOY
      const down = s.pressed && s.pressT < 0.2;
      bigButton(g, s.bx, s.by, s.br, s.ok || !s.pressed ? C.green : C.red, down);
      g.text("DEPLOY", s.bx, s.by - s.br * 0.08 + (down ? s.br * 0.12 : 0), { size: s.br * 0.36, color: C.white, stroke: C.ink, lw: 12 });
      if (!api.result) {
        const ready = s.windows.some(([a, b]) => now >= a && now < b);
        if (ready) g.text(api.t({ en: "ALL GREEN!", pt: "TUDO VERDE!" }), s.bx, s.by - s.br - 70, { size: 60, color: C.green, stroke: C.ink, lw: 12 });
      }
      if (s.ok) {
        // carimbo "SHIPPED" batendo no painel + servidor fazendo joinha
        const k = Math.min(1, s.pressT * 5);
        g.push();
        g.translate(portrait ? w / 2 : w * 0.3, portrait ? h * 0.32 : h * 0.5);
        g.rotate(-0.2);
        g.scale(2.4 - 1.4 * k);
        g.alpha(k);
        g.rect(-250, -80, 500, 160, null, { stroke: C.green, lw: 18, r: 20 });
        g.text(api.t({ en: "SHIPPED", pt: "ENTREGUE" }), 0, 4, { size: 104, color: C.green, maxWidth: 440 });
        g.pop();
        const tx = (portrait ? w * 0.17 : w * 0.77) + 120;
        const ty = (portrait ? h * 0.79 : h * 0.79) - 40 - Math.sin(Math.min(1, s.pressT * 4) * Math.PI / 2) * 40;
        g.rect(tx - 34, ty - 20, 68, 60, C.gray, { r: 18 });
        g.rect(tx - 14, ty - 80, 28, 70, C.gray, { r: 14 });
        g.text(api.t({ en: "SHIPPED!", pt: "ENTREGUE!" }), w / 2, h * 0.12, { size: 110, color: C.yellow, stroke: C.ink, lw: 16 });
      } else if (fire) {
        g.text(api.t({ en: "PROD IS ON FIRE", pt: "PRODUÇÃO PEGOU FOGO" }), w / 2, portrait ? h * 0.07 : h * 0.1, { size: portrait ? 64 : 90, color: C.orange, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const deployGreen: Entry<S> = {
  def: {
    id: "deploy-green",
    num: 84,
    name: { en: "Ship It", pt: "Sobe pra Produção" },
    verb: { en: "DEPLOY!", pt: "DEPLOY!" },
    hint: { pointer: "tap", keys: "space" },
    category: "tech",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A CI dashboard with 3 to 6 checks flickering between running, failed and passed (icons and labels, not just color). Press DEPLOY in the short moments when every check is green at once.",
    winText: "Press DEPLOY while all checks are green.",
    loseText: "Press DEPLOY with any check not green (the server catches fire), or time runs out.",
    minTime: 3,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || io.isDown) return;
          const t = api.time;
          const open = s.windows.some(([a, b]) => t >= a + 0.05 && t < b - 0.06);
          if (open) io.tap(s.bx, s.by);
        },
        lose(s, api, io) {
          if (api.result || io.isDown || api.time < 0.1) return;
          const t = api.time + 1 / 60;
          const open = s.windows.some(([a, b]) => t >= a - 0.1 && t < b + 0.15);
          if (!open) io.tap(s.bx, s.by);
        },
      }
    : null,
};
