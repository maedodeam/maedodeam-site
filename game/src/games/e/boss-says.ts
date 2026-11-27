// 098 · BOSS SAYS! — comandos em sequência, cada um num balão saindo de quem falou: o chefe ou o estagiário
// (os dois no palco, com plaquinha de nome). Só obedeça o chefe.
// Agir numa ordem do estagiário = derrota; deixar passar uma ordem do chefe = derrota.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, person } from "../../gfx/art.ts";
import { fitText, isPortrait } from "./util.ts";

interface Cmd {
  /** Quem fala: o chefe (obedeça) ou, se falso, o estagiário (ignore). */
  boss: boolean;
  verb: Text;
  t0: number;
  t1: number;
  done: boolean;
}
interface S {
  cmds: Cmd[];
  /** O chefe fica à esquerda? (sorteado: é preciso ler quem fala, não só olhar um lado) */
  bossLeft: boolean;
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
  const bossLeft = rng.chance(0.5);
  const start = 0.55;
  const slot = (api.duration - start - 0.15) / n;
  const W = Math.min(1.0 - lv * 0.27, slot * 0.75);
  const gap = Math.min(0.45, slot - W);
  const verbs = rng.shuffle(VERBS);
  const cmds: Cmd[] = flags.map((b, i) => ({
    boss: b,
    verb: verbs[i % verbs.length],
    t0: start + i * (W + gap),
    t1: start + i * (W + gap) + W,
    done: false,
  }));
  const s: S = { cmds, bossLeft, cur: -1, failed: false, jump: 0, t: 0, endT: 0 };

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
      const c = s.cur >= 0 && !api.result ? s.cmds[s.cur] : null;
      const bx = s.bossLeft ? w * 0.2 : w * 0.8;
      const ix = s.bossLeft ? w * 0.8 : w * 0.2;
      const yx = w * 0.5;
      const sc = portrait ? 1.8 : 1.7;
      const isc = sc * 0.9;
      const internFail = s.failed && s.cmds.some((q) => !q.boss && q.done);
      // quem está falando: holofote no chão e um pulinho enquanto fala
      const speaker = c ? (c.boss ? bx : ix) : null;
      if (speaker !== null) {
        g.push();
        g.alpha(0.6);
        g.ellipse(speaker, floor, 120 * sc, 26 * sc, C.white, { stroke: null });
        g.pop();
      }
      const talk = (bossTalks: boolean) => (c && c.boss === bossTalks ? Math.abs(Math.sin(s.t * 16)) * 12 : 0);
      const bossMood = s.failed ? "angry" : api.result === "win" ? "happy" : c && c.boss ? "smug" : "neutral";
      boss(g, bx, floor - talk(true), sc, { mood: bossMood, look: { x: Math.sign(yx - bx), y: 0 } });
      // estagiário: camisa verde, boné laranja, crachá no cordão
      const internMood = internFail ? "happy" : api.result === "win" ? "sad" : c && !c.boss ? "smug" : "neutral";
      const iy = floor - talk(false);
      person(g, ix, iy, isc, { shirt: C.green, tie: null, mood: internMood, look: { x: Math.sign(yx - ix), y: 0 }, hat: C.orange });
      g.line(ix - 16 * isc, iy - 136 * isc, ix, iy - 100 * isc, C.blue, 5);
      g.line(ix + 16 * isc, iy - 136 * isc, ix, iy - 100 * isc, C.blue, 5);
      g.rect(ix - 14 * isc, iy - 102 * isc, 28 * isc, 20 * isc, C.white, { r: 4, lw: 4 });
      // você (olha para quem está falando)
      const jy = s.jump > 0 ? Math.sin((s.jump / 0.3) * Math.PI) * 80 : 0;
      person(g, yx, floor - jy, sc * 0.85, {
        shirt: C.blue,
        tie: C.yellow,
        mood: s.failed ? "shock" : api.result === "win" ? "happy" : "worried",
        look: { x: speaker !== null ? Math.sign(speaker - yx) : 0, y: -0.3 },
      });
      // plaquinhas com o nome de cada um
      const plateY = portrait ? floor + 62 : floor + (h - floor) / 2;
      const plate = (x: number, label: string, fill: string) => {
        const o = { size: portrait ? 46 : 40, color: C.white };
        const tw = Math.min(g.textWidth(label, o), w * 0.32);
        g.rect(x - tw / 2 - 24, plateY - 32, tw + 48, 64, fill, { r: 32, lw: 5 });
        fitText(g, label, x, plateY + 2, tw, o);
      };
      plate(bx, api.t({ en: "BOSS", pt: "CHEFE" }), C.red);
      plate(ix, api.t({ en: "INTERN", pt: "ESTAGIÁRIO" }), C.green);
      // balão do comando, saindo da cabeça de quem falou
      if (c && speaker !== null) {
        const headTop = floor - (c.boss ? 230 * sc : 255 * isc);
        const toward = Math.sign(yx - speaker);
        const bw = portrait ? w - 120 : Math.min(1000, w - 300);
        const bh = portrait ? 360 : 280;
        const cx = Math.max(bw / 2 + 60, Math.min(w - bw / 2 - 60, speaker + toward * 250));
        const cy = portrait ? h * 0.36 : h * 0.2;
        const tx = Math.max(cx - bw / 2 + 80, Math.min(cx + bw / 2 - 80, speaker + toward * 60));
        g.shape(0, 0, [tx - 40, cy + bh / 2 - 10, tx + 40, cy + bh / 2 - 10, speaker, headTop], C.white);
        g.rect(cx - bw / 2 + 8, cy - bh / 2 + 12, bw, bh, C.ink, { r: 40, stroke: null });
        g.rect(cx - bw / 2, cy - bh / 2, bw, bh, C.white, { r: 40 });
        g.rect(cx - bw / 2 + 30, cy - bh / 2 + 26, bw - 60, 90, c.boss ? C.red : C.green, { r: 20, lw: 5 });
        const who = c.boss ? api.t({ en: "BOSS SAYS:", pt: "O CHEFE MANDOU:" }) : api.t({ en: "INTERN SAYS:", pt: "O ESTAGIÁRIO MANDOU:" });
        fitText(g, who, cx, cy - bh / 2 + 72, bw - 100, { size: 64, color: C.white });
        fitText(g, api.t(c.verb), cx, cy + 50, bw - 80, { size: 120, color: C.ink });
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
        const y = portrait ? floor + (h - floor) * 0.72 : floor + (h - floor) / 2;
        const past = api.time >= q.t1 || q.done;
        g.circle(x, y, 22, past ? (q.boss ? C.green : C.paper) : i === s.cur ? C.yellow2 : C.paper2, { lw: 5 });
      }
      if (s.failed) {
        const txt = internFail ? api.t({ en: "THAT WAS THE INTERN!", pt: "FOI O ESTAGIÁRIO!" }) : api.t({ en: "TOO SLOW!", pt: "DEMOROU!" });
        fitText(g, txt, w / 2, portrait ? h * 0.36 : h * 0.2, w - 120, { size: 100, color: C.red, stroke: C.ink, lw: 16 });
      } else if (api.result === "win") {
        fitText(g, api.t({ en: "EMPLOYEE OF THE MONTH", pt: "FUNCIONÁRIO DO MÊS" }), w / 2, portrait ? h * 0.36 : h * 0.2, w - 120, { size: 90, color: C.green, stroke: C.ink, lw: 14 });
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
      "The boss and the intern stand on stage, each with a name tag, and give orders in quick succession (3 to 5), each in a speech bubble from whoever said it. Act (tap/click/Space) only on the boss's orders; ignore the intern's. Each order lasts 1.0 s, down to 0.6 s.",
    winText: "Obey every order from the boss and ignore the intern.",
    loseText: "Act on the intern's order, or let a boss order pass.",
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
