// 098 · BOSS SAYS! — comandos em sequência. Só obedeça quando vier "O CHEFE MANDOU:".
// Agir num comando sem isso = derrota; deixar passar um comando do chefe = derrota.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person } from "../../gfx/art.ts";
import { fitText, isPortrait } from "./util.ts";

interface Cmd {
  boss: boolean;
  /** Quem fala: o chefe, ou o estagiário (falso, nos níveis altos). */
  intern: boolean;
  verb: Text;
  t0: number;
  t1: number;
  done: boolean;
}
interface S {
  cmds: Cmd[];
  cur: number;
  failed: boolean;
  jump: number;
  t: number;
  endT: number;
}

const VERBS: Text[] = [
  { en: "CLICK!", pt: "CLICA!" },
  { en: "CLAP!", pt: "BATE PALMA!" },
  { en: "SIGN!", pt: "ASSINA!" },
  { en: "APPROVE!", pt: "APROVA!" },
  { en: "REPLY ALL!", pt: "RESPONDE TODOS!" },
  { en: "JUMP!", pt: "PULA!" },
  { en: "SMILE!", pt: "SORRI!" },
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.3 ? 3 : lv < 0.8 ? 4 : 5;
  const flags: boolean[] = [];
  for (let i = 0; i < n; i++) flags.push(rng.chance(0.55));
  if (!flags.some((f) => f)) flags[rng.int(0, n - 1)] = true;
  if (lv >= 0.3 && flags.every((f) => f)) flags[rng.int(1, n - 1)] = false;
  const start = 0.55;
  const slot = (api.duration - start - 0.15) / n;
  const W = Math.min(1.0 - lv * 0.27, slot * 0.75);
  const gap = Math.min(0.45, slot - W);
  const verbs = rng.shuffle(VERBS);
  const cmds: Cmd[] = flags.map((b, i) => ({
    boss: b,
    intern: !b && lv >= 0.6 && rng.chance(0.6),
    verb: verbs[i % verbs.length],
    t0: start + i * (W + gap),
    t1: start + i * (W + gap) + W,
    done: false,
  }));
  const s: S = { cmds, cur: -1, failed: false, jump: 0, t: 0, endT: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.jump = Math.max(0, s.jump - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const t = api.time;
      s.cur = s.cmds.findIndex((c) => t >= c.t0 && t < c.t1);
      // comando do chefe que passou sem ação
      for (const c of s.cmds) {
        if (c.boss && !c.done && t >= c.t1) {
          s.failed = true;
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.lose();
          return;
        }
      }
      const inp = api.input;
      if (inp.actionPressed && s.cur >= 0) {
        const c = s.cmds[s.cur];
        if (c.boss) {
          if (!c.done) {
            c.done = true;
            s.jump = 0.3;
            api.sfx("coin");
            api.fx.pop(w / 2, h * 0.3, "✓", C.green);
          }
        } else {
          c.done = true;
          s.failed = true;
          s.jump = 0.3;
          api.sfx("buzz");
          api.fx.shake(0.6);
          api.lose();
          return;
        }
      }
      const last = s.cmds[s.cmds.length - 1];
      if (t >= last.t1) {
        api.sfx("chime");
        api.fx.burst(w / 2, h * 0.5, C.yellow, 24);
        api.win();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      // escritório
      const floor = portrait ? h * 0.86 : h * 0.88;
      g.rect(-10, floor, w + 20, h - floor + 10, C.paper2, { stroke: null });
      g.line(0, floor, w, floor, C.ink, 7);
      for (let x = 60; x < w; x += 300) g.rect(x, 60, 180, 120, "#ffe08a", { r: 10, lw: 5 });
      const c = s.cur >= 0 ? s.cmds[s.cur] : null;
      const bx = portrait ? w * 0.3 : w * 0.22;
      const ix = portrait ? w * 0.78 : w * 0.82;
      const yx = portrait ? w * 0.55 : w * 0.52;
      const bossMood = s.failed ? "angry" : api.result === "win" ? "happy" : c && !c.intern ? "smug" : "neutral";
      const sc = portrait ? 1.8 : 2.1;
      boss(g, bx, floor, sc, { mood: bossMood, look: { x: 1, y: 0 } });
      const internUp = c && c.intern ? Math.min(1, (api.time - c.t0) * 8) : 0;
      if (internUp > 0) person(g, ix, floor + (1 - internUp) * 400, sc * 0.9, { shirt: C.green, tie: null, mood: "smug", look: { x: -1, y: 0 }, hat: C.orange });
      // você
      const jy = s.jump > 0 ? Math.sin((s.jump / 0.3) * Math.PI) * 80 : 0;
      person(g, yx, floor - jy, sc * 0.85, {
        shirt: C.blue,
        tie: C.yellow,
        mood: s.failed ? "shock" : api.result === "win" ? "happy" : "worried",
        look: { x: c && c.intern ? 1 : -1, y: -0.3 },
      });
      // balão do comando
      if (c && !api.result) {
        const from = c.intern ? ix : bx;
        const bw = portrait ? w - 120 : Math.min(1100, w - 300);
        const bh = portrait ? 360 : 300;
        const cx = portrait ? w / 2 : Math.max(bw / 2 + 60, Math.min(w - bw / 2 - 60, from + (c.intern ? -200 : 250)));
        const cy = portrait ? h * 0.38 : h * 0.22;
        const headTop = floor - 250 * sc;
        const tx = Math.max(cx - bw / 2 + 80, Math.min(cx + bw / 2 - 80, from + (c.intern ? -60 : 60)));
        g.shape(0, 0, [tx - 40, cy + bh / 2 - 10, tx + 40, cy + bh / 2 - 10, from, headTop], C.white);
        g.rect(cx - bw / 2 + 8, cy - bh / 2 + 12, bw, bh, C.ink, { r: 40, stroke: null });
        g.rect(cx - bw / 2, cy - bh / 2, bw, bh, C.white, { r: 40 });
        if (c.boss) {
          g.rect(cx - bw / 2 + 30, cy - bh / 2 + 26, bw - 60, 90, C.red, { r: 20, lw: 5 });
          fitText(g, api.t({ en: "BOSS SAYS:", pt: "O CHEFE MANDOU:" }), cx, cy - bh / 2 + 72, bw - 100, { size: 64, color: C.white });
        } else if (c.intern) {
          g.rect(cx - bw / 2 + 30, cy - bh / 2 + 26, bw - 60, 90, C.green, { r: 20, lw: 5 });
          fitText(g, api.t({ en: "INTERN SAYS:", pt: "O ESTAGIÁRIO MANDOU:" }), cx, cy - bh / 2 + 72, bw - 100, { size: 64, color: C.white });
        }
        fitText(g, api.t(c.verb), cx, cy + (c.boss || c.intern ? 60 : 0), bw - 80, { size: 130, color: C.ink });
        // barra de tempo do comando
        const k = Math.max(0, 1 - (api.time - c.t0) / (c.t1 - c.t0));
        g.rect(cx - bw / 2 + 40, cy + bh / 2 - 34, (bw - 80) * k, 14, C.gray2, { r: 7, stroke: null });
        if (c.done && c.boss) g.text("✓", cx + bw / 2 - 70, cy - 10, { size: 120, color: C.green, stroke: C.ink, lw: 12 });
      }
      // progresso
      const n = s.cmds.length;
      for (let i = 0; i < n; i++) {
        const q = s.cmds[i];
        const x = w / 2 + (i - (n - 1) / 2) * 70;
        const y = floor + (h - floor) / 2;
        const past = api.time >= q.t1 || q.done;
        g.circle(x, y, 22, past ? (q.boss ? C.green : C.paper) : i === s.cur ? C.yellow2 : C.paper2, { lw: 5 });
      }
      if (s.failed) {
        const txt = s.cmds.some((q) => !q.boss && q.done) ? api.t({ en: "THE BOSS DIDN'T SAY!", pt: "O CHEFE NÃO MANDOU!" }) : api.t({ en: "TOO SLOW!", pt: "DEMOROU!" });
        fitText(g, txt, w / 2, portrait ? h * 0.38 : h * 0.22, w - 120, { size: 100, color: C.red, stroke: C.ink, lw: 16 });
      } else if (api.result === "win") {
        fitText(g, api.t({ en: "EMPLOYEE OF THE MONTH", pt: "FUNCIONÁRIO DO MÊS" }), w / 2, portrait ? h * 0.38 : h * 0.22, w - 120, { size: 90, color: C.green, stroke: C.ink, lw: 14 });
      }
    },
  };
}

export const bossSays: Entry<S> = {
  def: {
    id: "boss-says",
    num: 98,
    name: { en: "Boss Says", pt: "O Chefe Mandou" },
    verb: { en: "BOSS SAYS!", pt: "O CHEFE MANDOU!" },
    hint: { pointer: "tap", keys: "space" },
    category: "absurd",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Commands pop up in quick succession (3 to 5). Act (tap/click/Space) only when the bubble starts with BOSS SAYS. Plain commands, and later ones from the intern, must be ignored. Each command lasts 1.0 s, down to 0.6 s.",
    winText: "Obey every BOSS SAYS command and ignore the rest.",
    loseText: "Act on a command the boss didn't give, or let a boss command pass.",
    timeScale: 1.7,
    minTime: 5,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || io.isDown) return;
          const t = api.time;
          const c = s.cmds.find((q) => t >= q.t0 + 0.12 && t < q.t1 - 0.05);
          if (c && c.boss && !c.done) io.tap(api.w / 2, api.h / 2);
        },
        lose() {},
      }
    : null,
};
