// 037 · BEAT! — batuque na mesa: canetas e clipes chegam à linha no ritmo. Bata na hora certa, sem errar nenhuma.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, speech } from "../../gfx/art.ts";
import { bigText, pips } from "./art-a.ts";

interface Note {
  t: number;
  kind: number;
  hit: number; // >0 acertada (tempo desde o acerto)
}
interface S {
  notes: Note[];
  win: number;
  lead: number;
  hits: number;
  slam: number;
  fail: "early" | "late" | null;
  waves: number[];
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv >= 1 ? 4 : 3;
  const interval = 0.55 - 0.1 * lv;
  const lead = 1.0 - 0.2 * lv;
  const s: S = { notes: [], win: 0.13 - 0.033 * lv, lead, hits: 0, slam: 0, fail: null, waves: [] };
  // A primeira nota chega depois que a instrução sai da tela (≥ 1.15 s de jogo).
  const first = Math.max(1.15, lead + 0.1);
  for (let i = 0; i < n; i++) s.notes.push({ t: first + i * interval, kind: rng.int(0, 2), hit: 0 });
  const hitX = portrait ? w / 2 : w * 0.3;
  const hitY = portrait ? h * 0.62 : h * 0.4;
  const speed = portrait ? (hitY + 120) / lead : (w - hitX + 120) / lead;
  const posOf = (nt: Note, now: number) => (portrait ? { x: hitX, y: hitY - (nt.t - now) * speed } : { x: hitX + (nt.t - now) * speed, y: hitY });

  return {
    s,
    update(dt) {
      s.slam = Math.max(0, s.slam - dt * 6);
      for (const nt of s.notes) if (nt.hit > 0) nt.hit += dt;
      s.waves = s.waves.map((q) => q + dt).filter((q) => q < 0.5);
      if (api.result) return;
      const now = api.time;
      if (api.input.actionPressed) {
        s.slam = 1;
        s.waves.push(0);
        const nt = s.notes.find((q) => q.hit === 0 && Math.abs(q.t - now) <= s.win);
        if (nt) {
          nt.hit = 0.001;
          s.hits++;
          api.sfx("drum");
          const p = posOf(nt, now);
          api.fx.burst(p.x, p.y, undefined, 10);
          api.fx.pop(p.x, p.y - 140, api.t({ en: "NICE!", pt: "BOA!" }), C.yellow);
          if (s.hits >= s.notes.length) {
            api.sfx("chime");
            api.win();
          }
        } else {
          s.fail = "early";
          api.sfx("buzz");
          api.fx.shake(0.4);
          api.lose();
        }
        return;
      }
      if (s.notes.some((q) => q.hit === 0 && now > q.t + s.win)) {
        s.fail = "late";
        api.sfx("miss");
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.orange);
      const now = api.time;
      // mesa
      g.rect(30, 30, w - 60, h - 60, C.brown2, { r: 30 });
      for (let i = 0; i < 6; i++) g.line(60, 120 + i * ((h - 200) / 5), w - 60, 100 + i * ((h - 200) / 5), C.brown, 5);
      // trilho das notas
      if (portrait) g.rect(hitX - 110, 30, 220, hitY + 60, "#b67a4e", { stroke: null });
      else g.rect(hitX - 60, hitY - 110, w - hitX + 30, 220, "#b67a4e", { stroke: null });
      // marcas do ritmo
      for (const nt of s.notes) {
        const p = posOf(nt, now);
        if (portrait) g.line(hitX - 100, p.y, hitX + 100, p.y, "#a86d42", 4);
        else g.line(p.x, hitY - 100, p.x, hitY + 100, "#a86d42", 4);
      }
      // alvo (linha de batida)
      const pulse = 1 + s.slam * 0.12;
      g.circle(hitX, hitY, 110 * pulse, C.yellow2, { lw: 8 });
      g.circle(hitX, hitY, 70, null, { stroke: C.orange, lw: 6 });
      for (const q of s.waves) {
        g.push();
        g.alpha(1 - q / 0.5);
        g.circle(hitX, hitY, 110 + q * 500, null, { stroke: C.white, lw: 8 });
        g.pop();
      }
      // notas
      for (const nt of s.notes) {
        if (nt.hit > 0.15) continue;
        const p = posOf(nt, now);
        if (p.x > w + 150 || p.y < -150) continue;
        g.push();
        g.translate(p.x, p.y);
        if (nt.hit > 0) g.scale(1 + nt.hit * 4);
        if (nt.hit > 0) g.alpha(1 - nt.hit / 0.15);
        g.rotate(portrait ? 0 : Math.PI / 2);
        g.scale(1.3);
        if (nt.kind === 0) {
          // caneta
          g.rect(-22, -80, 44, 140, C.blue, { r: 14 });
          g.shape(0, 60, [-22, 0, 22, 0, 0, 40], C.paper, { lw: 5 });
          g.rect(-26, -80, 52, 30, C.ink2, { r: 8 });
        } else if (nt.kind === 1) {
          // clipe gigante
          g.rect(-34, -70, 68, 140, null, { r: 34, stroke: C.gray2, lw: 14 });
          g.rect(-16, -40, 32, 96, null, { r: 16, stroke: C.gray2, lw: 12 });
        } else {
          // post-it
          g.rect(-60, -60, 120, 120, C.yellow, { lw: 6 });
          g.line(-40, -20, 40, -20, C.orange, 6);
          g.line(-40, 10, 20, 10, C.orange, 6);
        }
        g.pop();
      }
      // mão batendo
      const hx = hitX + 30;
      const hy = hitY + 40 + (1 - s.slam) * 130;
      g.push();
      g.translate(hx, hy);
      g.rotate(-0.25);
      g.rect(-34, 30, 68, 260, C.blue, { r: 16 });
      g.rect(-70, -50, 140, 100, C.skin, { r: 40 });
      g.rect(-80, -10, 40, 40, C.skin, { r: 16 });
      g.line(-40, -40, -40, 0, C.skin2, 5);
      g.line(-5, -44, -5, 0, C.skin2, 5);
      g.line(30, -40, 30, 0, C.skin2, 5);
      g.pop();
      if (s.slam > 0.6) for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        g.line(hitX + Math.cos(a) * 130, hitY + Math.sin(a) * 130, hitX + Math.cos(a) * 170, hitY + Math.sin(a) * 170, C.ink, 8);
      }
      // colega irritado
      const cx = portrait ? w * 0.2 : w * 0.82;
      const cy = portrait ? h * 0.97 : h - 45;
      const angry = s.fail !== null;
      person(g, cx, cy, portrait ? 1.3 : 1.45, { shirt: C.green, tie: C.purple, mood: angry ? "angry" : s.hits > 0 ? "worried" : "neutral", look: { x: portrait ? 1 : -1, y: 0 } });
      // fones de ouvido
      const hs = portrait ? 1.3 : 1.45;
      g.arc(cx, cy - 178 * hs, 50 * hs, Math.PI * 1.05, Math.PI * 1.95, C.ink, 10);
      g.rect(cx - 56 * hs, cy - 190 * hs, 18 * hs, 40 * hs, C.red, { r: 6 });
      g.rect(cx + 38 * hs, cy - 190 * hs, 18 * hs, 40 * hs, C.red, { r: 6 });
      if (angry) speech(g, cx + (portrait ? 160 : -60), cy - 300 * hs, api.t({ en: "SHHH!", pt: "PSIU!" }), 64, portrait ? -1 : 1);
      pips(g, portrait ? w / 2 : w * 0.3, portrait ? 110 : 120, s.notes.length, s.hits, 26, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "ROCK STAR!", pt: "ARRASOU!" }), w / 2, portrait ? h * 0.2 : h * 0.18, 120, C.yellow, -0.05);
      if (s.fail === "early") bigText(g, api.t({ en: "OFF BEAT!", pt: "FORA DO RITMO!" }), w / 2, portrait ? h * 0.2 : h * 0.18, 100, C.red, 0.04);
      if (s.fail === "late") bigText(g, api.t({ en: "MISSED ONE!", pt: "PERDEU UMA!" }), w / 2, portrait ? h * 0.2 : h * 0.18, 100, C.red, 0.04);
    },
  };
}

export const drumBeat: Entry<S> = {
  def: {
    id: "drum-beat",
    num: 37,
    name: { en: "Office Beat", pt: "Batuque na Mesa" },
    verb: { en: "BEAT!", pt: "BATE!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "Pens, paper clips and sticky notes slide to the beat line at a steady rhythm. Tap or press Space exactly as each one reaches the line, to the annoyance of the coworker with headphones.",
    winText: "Hit every note (3, or 4 at higher levels) in a row.",
    loseText: "Tapping off the beat, letting a note pass, or time runs out.",
    minTime: 3,
    bg: BG.orange,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.02) return;
          // O toque é lido no próximo quadro: mira o tempo de lá.
          const nt = s.notes.find((q) => q.hit === 0);
          if (nt && Math.abs(nt.t - (api.time + dt)) <= s.win * 0.4) io.tap(api.w / 2, api.h / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.02) return;
          const nt = s.notes.find((q) => q.hit === 0);
          if (nt && Math.abs(nt.t - api.time) > s.win + 0.1) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
