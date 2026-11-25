// 080 · SLACK OFF! — você está jogando no computador do trabalho: a diversão enche enquanto você NÃO segura.
// O chefe vem andando atrás do vidro fosco (aviso: sombra e passos) até o meio da janela; quando chega e olha,
// SEGURE para abrir a planilha. Depois ele segue andando e sai pelo outro lado.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss, monitor } from "../../gfx/art.ts";
import { clamp } from "../../kit/mover.ts";

interface Pass {
  /** Início do aviso (o chefe entra na janela). */
  t: number;
  /** Sentido da caminhada: 1 = da esquerda para a direita. */
  dir: number;
  /** Quanto tempo ele leva para sair depois de olhar (antes da próxima passada). */
  leave: number;
}
interface S {
  fun: number;
  fillTime: number;
  warn: number;
  look: number;
  grace: number;
  passes: Pass[];
  holding: boolean;
  caught: boolean;
  phase: "calm" | "warn" | "look";
  /** Relógio do chefe (congela quando a rodada acaba). */
  bt: number;
  scoreT: number;
}

function phaseAt(s: S, t: number): { phase: S["phase"]; since: number } {
  for (const p of s.passes) {
    if (t >= p.t && t < p.t + s.warn) return { phase: "warn", since: t - p.t };
    if (t >= p.t + s.warn && t < p.t + s.warn + s.look) return { phase: "look", since: t - p.t - s.warn };
  }
  return { phase: "calm", since: 0 };
}

/**
 * Onde está o chefe no instante t. Caminho contínuo: entra por uma borda da janela, anda até o meio durante todo o
 * aviso (desacelerando para parar), fica parado olhando e depois segue até sair pela outra borda. Sem saltos.
 */
export function bossPos(s: S, t: number, w: number, margin: number): { x: number; mode: "walk" | "look"; walk: number } | null {
  const cx = w / 2;
  for (const p of s.passes) {
    const since = t - p.t;
    if (since < 0 || since >= s.warn + s.look + p.leave) continue;
    const from = p.dir > 0 ? 40 - margin : w - 40 + margin;
    const to = p.dir > 0 ? w - 40 + margin : 40 - margin;
    if (since < s.warn) {
      const k = since / s.warn;
      return { x: from + (cx - from) * k * (1.6 - 0.6 * k), mode: "walk", walk: since * 2.6 };
    }
    if (since < s.warn + s.look) return { x: cx, mode: "look", walk: 0 };
    const k = (since - s.warn - s.look) / p.leave;
    return { x: cx + (to - cx) * k * (0.4 + 0.6 * k), mode: "walk", walk: since * 2.6 };
  }
  return null;
}

/** Sombra do chefe no vidro fosco: mesma silhueta e posição do desenho do chefe. (x, y) = pés. */
function shadowOf(g: Gfx, x: number, y: number, sc: number, walk: number): void {
  const step = Math.sin(walk * Math.PI * 2) * 14;
  g.push();
  g.alpha(0.42);
  g.translate(x, y);
  g.scale(sc);
  g.line(-14, -60, -14 - step, 0, C.ink, 20);
  g.line(14, -60, 14 + step, 0, C.ink, 20);
  g.rect(-42, -144, 84, 96, C.ink, { r: 24, stroke: null });
  g.circle(0, -178, 46, C.ink, { stroke: null });
  g.pop();
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const D = api.duration;
  // Aviso = a caminhada até o meio da janela; precisa dar tempo de ver e reagir mesmo no nível alto.
  const warn = 0.95 - lv * 0.3;
  const look = 0.75 - lv * 0.15;
  const grace = 0.1;
  const fillTime = clamp(D * 0.5, 1.6, 3.2);
  const nPass = clamp(Math.floor((D - fillTime - 0.35) / (warn + look + 0.15)), 1, 3);
  const passes: Pass[] = [];
  // O chefe nunca aparece enquanto a instrução ainda está na tela (≥ 0,8 s de jogo).
  let t = rng.range(0.8, Math.max(0.85, fillTime - warn - grace - 0.1));
  let dir = rng.sign();
  for (let i = 0; i < nPass; i++) {
    const gap = rng.range(0.3, 0.8);
    // Ele sai pelo outro lado antes da próxima passada (que volta no sentido contrário).
    passes.push({ t, dir, leave: Math.min(warn, gap - 0.05) });
    dir = -dir;
    t += warn + look + gap;
  }
  const s: S = {
    fun: 0,
    fillTime,
    warn,
    look,
    grace,
    passes,
    holding: false,
    caught: false,
    phase: "calm",
    bt: 0,
    scoreT: 0,
  };

  return {
    s,
    update(dt) {
      const ph = phaseAt(s, api.time);
      if (!api.result) {
        s.phase = ph.phase;
        s.bt = api.time;
      }
      if (api.result) return;
      const hold = api.input.action;
      if (hold !== s.holding) api.sfx(hold ? "click" : "tap");
      s.holding = hold;
      if (ph.phase === "warn" && Math.floor(ph.since / 0.12) !== Math.floor((ph.since - dt) / 0.12)) api.sfx("drum");
      if (ph.phase === "look" && ph.since >= s.grace && !hold) {
        s.caught = true;
        api.sfx("buzz");
        api.fx.shake(0.6);
        api.lose();
        return;
      }
      if (!hold) {
        s.fun += dt / s.fillTime;
        s.scoreT += dt;
        if (s.fun >= 1) {
          s.fun = 1;
          api.sfx("coin");
          api.fx.burst(w / 2, h * 0.55, C.yellow, 22);
          api.win();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.lilac);
      // janela de vidro com o corredor
      const wy = portrait ? h * 0.08 : h * 0.06;
      const wh = portrait ? h * 0.3 : h * 0.34;
      g.rect(40, wy, w - 80, wh, "#cfeefa", { lw: 8 });
      for (let x = 40 + (w - 80) / 3; x < w - 60; x += (w - 80) / 3) g.line(x, wy, x, wy + wh, C.ink, 7);
      // chefe passando
      const bossScale = wh / 300;
      const by = wy + wh + 30 * bossScale;
      const bp = s.caught ? { x: w / 2, mode: "look" as const, walk: 0 } : bossPos(s, s.bt, w, 90 * bossScale);
      if (bp) {
        const bx = bp.x;
        g.push();
        g.clip(40, wy, w - 80, wh);
        if (bp.mode === "walk") shadowOf(g, bx, by, bossScale, bp.walk);
        else boss(g, bx, by, bossScale, { mood: s.caught ? "angry" : "neutral", look: { x: 0, y: 0.6 } });
        g.pop();
        if (s.phase === "warn" && !s.caught) {
          for (let i = 0; i < 2; i++) {
            const fx = Math.max(90, Math.min(w - 90, bx)) + (i - 0.5) * 120;
            g.text(api.t({ en: "tok", pt: "toc" }), fx, wy + wh + 50 + (i % 2) * 20, { size: 46, color: C.ink, font: "body", weight: 800 });
          }
          g.text("!", Math.max(110, Math.min(w - 110, bx)), wy + 70, { size: 110, color: C.red, stroke: C.ink, lw: 12 });
        }
      }
      // reflexo do vidro
      g.push();
      g.alpha(0.35);
      g.line(80, wy + wh * 0.8, 220, wy + 20, C.white, 18);
      g.line(140, wy + wh * 0.9, 280, wy + 60, C.white, 10);
      g.pop();
      g.rect(40, wy, w - 80, wh, null, { lw: 8 });
      // mesa e monitor
      const deskY = portrait ? h * 0.82 : h * 0.86;
      g.rect(-10, deskY, w + 20, h, C.brown2, { lw: 7 });
      const mw = portrait ? w - 180 : Math.min(w * 0.5, 820);
      const mh = portrait ? h * 0.26 : h * 0.3;
      const mx = w / 2;
      const my = deskY - mh / 2 - 70;
      monitor(g, mx, my, mw, mh, s.holding ? C.white : C.ink2);
      g.push();
      g.clip(mx - mw / 2, my - mh / 2, mw, mh, 6);
      if (s.holding) {
        // planilha
        const cols = 5;
        const rows = 6;
        for (let r = 0; r <= rows; r++) g.line(mx - mw / 2, my - mh / 2 + 60 + (r * (mh - 60)) / rows, mx + mw / 2, my - mh / 2 + 60 + (r * (mh - 60)) / rows, C.paper2, 4);
        for (let c = 0; c <= cols; c++) g.line(mx - mw / 2 + (c * mw) / cols, my - mh / 2 + 60, mx - mw / 2 + (c * mw) / cols, my + mh / 2, C.paper2, 4);
        g.rect(mx - mw / 2, my - mh / 2, mw, 60, C.green, { stroke: null });
        g.text("Q3_REPORT_final_v7.xls", mx, my - mh / 2 + 32, { size: 40, color: C.white, font: "mono", maxWidth: mw - 40 });
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) g.text(String(((r * 7 + c * 13) % 90) + 10), mx - mw / 2 + (c + 0.5) * (mw / cols), my - mh / 2 + 60 + (r + 0.5) * ((mh - 60) / rows), { size: 34, font: "mono", color: C.ink2 });
      } else {
        // joguinho: carrinho de corrida numa pista com faixas passando
        for (let i = 0; i < 14; i++) {
          const sx = mx - mw / 2 + ((i * 131 - s.scoreT * 300) % mw + mw) % mw;
          const sy = my - mh / 2 + 30 + ((i * 71) % (mh - 60));
          g.rect(sx - 14, sy - 3, 28, 6, C.yellow, { stroke: null, r: 3 });
        }
        const ry = my + Math.sin(s.scoreT * 5) * mh * 0.25;
        g.push();
        g.translate(mx - mw * 0.25, ry);
        g.rect(-44, -18, 88, 36, C.orange, { r: 10, lw: 5 });
        g.rect(-10, -14, 26, 22, C.sky, { r: 5, lw: 4 });
        for (const wx of [-26, 26]) for (const wy of [-20, 20]) g.rect(wx - 10, wy - 6, 20, 12, C.ink, { stroke: null, r: 4 });
        g.pop();
        g.text(`SCORE ${Math.floor(s.scoreT * 1234)}`, mx + mw / 2 - 30, my - mh / 2 + 40, { size: 40, align: "right", font: "mono", color: C.green });
      }
      g.pop();
      // medidor de diversão
      const bw = Math.min(w - 160, 760);
      const bx0 = (w - bw) / 2;
      const by0 = deskY + (portrait ? 90 : 60);
      g.rect(bx0, by0 - 30, bw, 60, C.white, { r: 30, lw: 7 });
      g.rect(bx0 + 8, by0 - 22, Math.max(0, (bw - 16) * s.fun), 44, C.pink, { r: 22, stroke: null });
      g.text(api.t({ en: "FUN", pt: "DIVERSÃO" }), w / 2, by0 + 2, { size: 44, color: C.ink });
      // dica
      g.text(api.t({ en: "HOLD = SPREADSHEET", pt: "SEGURA = PLANILHA" }), w / 2, my - mh / 2 - 50, {
        size: 44,
        color: s.holding ? C.green : C.paper,
        stroke: C.ink,
        lw: 8,
      });
      if (s.caught) {
        g.text(api.t({ en: "MY OFFICE. NOW.", pt: "NA MINHA SALA. JÁ." }), w / 2, wy + wh + 80, { size: 76, color: C.red, stroke: C.ink, lw: 12, maxWidth: w - 100 });
      }
    },
  };
}

export const slackOff: Entry<S> = {
  def: {
    id: "slack-off",
    num: 80,
    name: { en: "Slack Off", pt: "Enrola" },
    verb: { en: "SLACK OFF!", pt: "ENROLA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "office",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "You are playing a game at work: the fun meter fills while you are NOT holding. Now and then the boss's shadow walks along the frosted glass wall (with footsteps) up to the middle, where he stops and looks in. While he looks, hold to show the spreadsheet; then he walks off the other side.",
    winText: "Fill the fun meter without getting caught.",
    loseText: "The boss sees the game, or time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.lilac,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) {
            if (io.isDown) io.up(io.px, io.py);
            return;
          }
          const ph = phaseAt(s, api.time + 1 / 60);
          const need = ph.phase !== "calm";
          if (need && !io.isDown) io.down(api.w / 2, api.h / 2);
          else if (!need && io.isDown) io.up(api.w / 2, api.h / 2);
        },
        lose() {},
      }
    : null,
};
