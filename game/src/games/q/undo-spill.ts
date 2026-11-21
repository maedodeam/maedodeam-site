// 241 · UNDO! — WTF insano: o desastre do café passa em loop numa fita VHS psicodélica (alguém enche a xícara,
// a pata do gato vem, a xícara tomba, o café inunda o teclado). Arraste a barra da linha do tempo de volta até
// o trecho exato em que a xícara está CHEIA, em pé, e a pata ainda não encostou — e solte ali.
// Soltar num quadro derramado = perde. Soltar enquanto ainda está enchendo só avisa "AINDA NÃO ENCHEU" (a fita continua).
// Teclado: ←/→ rebobinam, Espaço confirma. Níveis altos: janela mais estreita e fita mais rápida (lv ≥ 0.5).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { psyBackdrop, psyColor, psyWash, psyWobble, wobbleText } from "../../gfx/wtf.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { clamp01, ease, hash01, isPortrait } from "./util.ts";

interface S {
  tau: number;
  ws: number;
  we: number;
  held: boolean;
  paused: boolean;
  playSpeed: number;
  barX0: number;
  barX1: number;
  barY: number;
  tv: { x: number; y: number; w: number; h: number };
  verdict: "" | "win" | "spill";
  warn: number;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const width = lv >= 0.5 ? 0.15 - 0.03 * (lv - 0.5) : 0.2;
  const ws = rng.range(0.22, 0.38);
  const tv = portrait ? { x: 50, y: h * 0.1, w: w - 100, h: h * 0.5 } : { x: w * 0.5 - Math.min(w * 0.33, 640), y: h * 0.06, w: Math.min(w * 0.66, 1280), h: h * 0.64 };
  const s: S = {
    tau: 0.74,
    ws,
    we: ws + width,
    held: false,
    paused: false,
    playSpeed: lv >= 0.5 ? 0.6 + 0.1 * lv : 0.45,
    barX0: portrait ? 110 : w * 0.12,
    barX1: portrait ? w - 110 : w * 0.88,
    barY: portrait ? h * 0.74 : h * 0.86,
    tv,
    verdict: "",
    warn: 0,
    t: 0,
    endT: 0,
  };
  const tauAt = (x: number) => clamp01((x - s.barX0) / (s.barX1 - s.barX0));
  const handleX = () => s.barX0 + s.tau * (s.barX1 - s.barX0);
  const submit = () => {
    if (s.tau < s.ws) {
      // ainda enchendo: só avisa, a fita volta a rodar
      s.warn = 0.8;
      s.paused = false;
      api.sfx("boing");
      api.fx.pop(handleX(), s.barY - 90, api.t({ en: "NOT FULL YET!", pt: "AINDA NÃO ENCHEU!" }), C.yellow);
      return;
    }
    if (s.tau <= s.we) {
      s.verdict = "win";
      api.sfx("tada");
      api.fx.burst(s.tv.x + s.tv.w / 2, s.tv.y + s.tv.h / 2, C.yellow, 30);
      api.win();
    } else {
      s.verdict = "spill";
      api.sfx("glitch");
      api.sfx("splash");
      api.fx.shake(0.6);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.warn = Math.max(0, s.warn - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed && !s.held) {
        const hx = handleX();
        const onHandle = Math.hypot(inp.x - hx, inp.y - s.barY) < 95;
        const onBar = Math.abs(inp.y - s.barY) < 80 && inp.x > s.barX0 - 40 && inp.x < s.barX1 + 40;
        if (onHandle || onBar) {
          s.held = true;
          if (!onHandle) s.tau = tauAt(inp.x);
          api.sfx("click");
        }
      }
      if (s.held) {
        const before = s.tau;
        s.tau = tauAt(inp.x);
        if (Math.abs(s.tau - before) > 0.03 && Math.floor(s.t * 8) % 2 === 0) api.sfx("slide");
        if (!inp.down || inp.released) {
          s.held = false;
          submit();
          return;
        }
        return;
      }
      if (inp.axisX !== 0) {
        s.paused = true;
        s.tau = clamp01(s.tau + inp.axisX * 0.55 * dt);
      } else if (inp.keyPressed("action") && s.paused) {
        submit();
        return;
      }
      if (!s.paused) {
        s.tau += s.playSpeed * dt;
        if (s.tau >= 1) {
          s.tau -= 1;
          api.sfx("glitch");
        }
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 1, w / 2, s.tv.y + s.tv.h / 2);
      const won = s.verdict === "win";
      const tau = s.tau;
      // ---------- a TV (cena oscila) ----------
      const wob = psyWobble(t, won ? 0.3 : 1.2);
      const tv = s.tv;
      g.push();
      g.translate(tv.x + tv.w / 2 + wob.dx, tv.y + tv.h / 2 + wob.dy);
      g.rotate(wob.rot);
      g.rect(-tv.w / 2 - 30, -tv.h / 2 - 30 + 16, tv.w + 60, tv.h + 60, C.ink, { r: 40, stroke: null });
      g.rect(-tv.w / 2 - 30, -tv.h / 2 - 30, tv.w + 60, tv.h + 60, C.brown, { r: 40, lw: 9 });
      g.push();
      g.clip(-tv.w / 2, -tv.h / 2, tv.w, tv.h, 24);
      g.rect(-tv.w / 2, -tv.h / 2, tv.w, tv.h, BG.lilac, { stroke: null });
      // cena em coordenadas próprias 800×500, escalada para caber
      const k = Math.min(tv.w / 800, tv.h / 500);
      g.scale(k);
      drawScene(g, s, tau, t, won);
      g.pop();
      // VHS: linhas, faixa de ruído, cor girando
      g.push();
      g.clip(-tv.w / 2, -tv.h / 2, tv.w, tv.h, 24);
      psyWash(g, t, 0.12);
      g.alpha(0.16);
      for (let y = -tv.h / 2; y < tv.h / 2; y += 12) g.rect(-tv.w / 2, y, tv.w, 4, C.ink, { stroke: null });
      g.pop();
      g.push();
      g.clip(-tv.w / 2, -tv.h / 2, tv.w, tv.h, 24);
      const band = ((t * 0.6) % 1.2) * tv.h - tv.h * 0.6;
      g.alpha(0.35);
      for (let i = 0; i < 18; i++) {
        const nx = hash01(i + Math.floor(t * 12) * 31) * tv.w - tv.w / 2;
        g.rect(nx, band + hash01(i * 7) * 40, 30 + hash01(i * 3) * 120, 6, i % 2 ? C.white : psyColor(t, i * 40), { stroke: null });
      }
      g.pop();
      // OSD da fita
      const osd = s.held || s.paused ? (s.held ? "◀◀ REW" : "❚❚ PAUSE") : "▶ PLAY";
      g.text(osd, -tv.w / 2 + 30, -tv.h / 2 + 46, { size: 46, font: "mono", align: "left", color: C.white, stroke: C.ink, lw: 8 });
      const secs = Math.floor(tau * 600);
      g.text(`00:0${Math.floor(secs / 100)}:${String(secs % 100).padStart(2, "0")}`, tv.w / 2 - 30, -tv.h / 2 + 46, {
        size: 40,
        font: "mono",
        align: "right",
        color: C.white,
        stroke: C.ink,
        lw: 8,
      });
      g.pop();
      // ---------- título absurdo ----------
      const ty = portrait ? h * 0.05 : s.barY - 120;
      if (portrait) wobbleText(g, api.t({ en: "BE KIND, REWIND", pt: "SEJA GENTIL, REBOBINE" }), w / 2, ty, t, { size: 56, stroke: C.ink, lw: 10 }, 10);
      else wobbleText(g, api.t({ en: "BE KIND, REWIND", pt: "SEJA GENTIL, REBOBINE" }), w / 2, ty, t, { size: 54, stroke: C.ink, lw: 10 }, 10);
      if (portrait) {
        g.text(api.t({ en: "FULL CUP · NO PAW YET", pt: "XÍCARA CHEIA · SEM PATA" }), w / 2, s.tv.y + s.tv.h + 110, { size: 54, color: C.white, stroke: C.ink, lw: 10 });
      }
      // ---------- linha do tempo (nítida, sem oscilar) ----------
      const x0 = s.barX0;
      const x1 = s.barX1;
      const by = s.barY;
      g.rect(x0 - 40, by - 54, x1 - x0 + 80, 108, C.ink, { r: 54, stroke: C.white, lw: 6 });
      g.rect(x0, by - 14, x1 - x0, 28, C.gray2, { r: 14, lw: 4, stroke: C.white });
      g.rect(x0, by - 14, Math.max(0, (x1 - x0) * tau), 28, C.orange, { r: 14, stroke: null });
      for (let i = 0; i <= 10; i++) g.line(x0 + ((x1 - x0) * i) / 10, by + 24, x0 + ((x1 - x0) * i) / 10, by + 38, C.white, 4);
      const hx = x0 + (x1 - x0) * tau;
      g.circle(hx, by, s.held ? 52 : 46, s.held ? C.yellow : C.white, { lw: 8 });
      g.line(hx - 10, by - 16, hx - 10, by + 16, C.ink, 6);
      g.line(hx + 10, by - 16, hx + 10, by + 16, C.ink, 6);
      if (s.warn > 0) g.text(api.t({ en: "NOT FULL YET!", pt: "AINDA NÃO ENCHEU!" }), w / 2, by + 100, { size: 50, color: C.yellow, stroke: C.ink, lw: 10 });
      if (api.result) {
        const msg = won ? api.t({ en: "UNDONE!", pt: "DESFEITO!" }) : api.t({ en: "TOO LATE!", pt: "TARDE DEMAIS!" });
        wobbleText(g, msg, w / 2, s.tv.y + s.tv.h / 2, t, { size: 150, stroke: C.ink, lw: 16, color: won ? C.yellow : C.red }, 16);
      }
    },
  };
}

/** Cena do desastre no quadro tau (0..1). Coordenadas: centro (0,0), caixa 800×500. */
function drawScene(g: Gfx, s: S, tau: number, t: number, won: boolean): void {
  const fill = clamp01(tau / s.ws);
  const we = s.we;
  // parede e mesa
  g.rect(-420, -260, 840, 520, "#ffd9b8", { stroke: null });
  g.rect(-420, 60, 840, 220, C.brown2, { lw: 7 });
  g.line(-420, 60, 420, 60, C.ink, 8);
  // teclado
  const kx = 90;
  const ky = 150;
  const flood = clamp01((tau - we - 0.06) / 0.3);
  g.rect(kx - 10, ky - 50, 320, 100, C.gray2, { r: 14, lw: 6 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) g.rect(kx + 4 + c * 37, ky - 40 + r * 30, 30, 24, C.paper, { r: 5, lw: 3 });
  // xícara
  const tilt = tau < we ? 0 : ease((tau - we) / 0.12) * 1.75;
  const cx = -30;
  const cy = 40;
  // café derramado
  if (flood > 0) {
    g.ellipse(cx + 80 + flood * 140, ky + 10, 60 + flood * 230, 26 + flood * 50, C.brown, { lw: 5 });
    for (let i = 0; i < 6; i++) {
      const bx = kx + 40 + i * 45;
      const bb = Math.sin(t * 10 + i) * 6;
      g.circle(bx, ky - 60 - flood * 30 + bb, 8 + flood * 6, C.white, { lw: 3 });
    }
    if (flood > 0.5) g.star(kx + 160, ky - 90, 40, 16, 7, C.yellow, { lw: 4 });
  }
  g.push();
  g.translate(cx + 40, cy + 18);
  g.rotate(tilt);
  g.translate(-40, -18);
  g.shape(0, 0, [-46, -60, 46, -60, 38, 18, -38, 18], C.white, { lw: 7 });
  g.circle(52, -24, 20, null, { lw: 9 });
  const lvl = tilt > 0 ? Math.max(0, 1 - tilt) : fill;
  if (lvl > 0.02) {
    const top = 14 - lvl * 70;
    g.push();
    g.clip(-44, top, 88, 18 - top + 2);
    g.shape(0, 0, [-46, -60, 46, -60, 38, 18, -38, 18], C.brown, { stroke: null });
    g.pop();
    g.line(-44 + (1 - lvl) * 6, top, 44 - (1 - lvl) * 6, top, C.ink, 4);
  }
  if (fill >= 1 && tilt === 0) {
    for (let i = -1; i <= 1; i++) {
      const o = Math.sin(t * 4 + i) * 6;
      g.polyline(
        [
          { x: i * 16, y: -72 },
          { x: i * 16 + o, y: -92 },
          { x: i * 16 - o, y: -112 },
        ],
        C.white,
        6,
      );
    }
  }
  g.pop();
  // bule enchendo (vem do alto, à direita)
  if (tau < s.ws + 0.05) {
    const k = tau < s.ws ? 1 : 1 - (tau - s.ws) / 0.05;
    g.push();
    g.translate(190 + (1 - k) * 200, -170);
    g.rotate(-0.5);
    g.rect(-60, -50, 120, 100, C.ink2, { r: 20, lw: 6 });
    g.shape(-60, -30, [0, 0, -60, -20, -66, -10, 0, 20], C.ink2, { lw: 6 });
    g.pop();
    if (tau < s.ws) g.line(112, -150, cx, cy - 40, C.brown, 14);
  }
  // pata do gato vindo da esquerda (empurra a xícara para o teclado)
  const p0 = s.ws - 0.15;
  const touchX = cx - 52;
  let pawX = -520;
  if (tau > p0) pawX = -520 + ease((tau - p0) / (we - p0)) * (touchX + 520);
  if (tau > we) pawX = touchX + ease((tau - we) / 0.12) * 50;
  if (won) pawX = -520;
  if (pawX > -500) {
    g.rect(-520, -10, pawX + 520, 54, C.orange2, { r: 27, lw: 7 });
    g.ellipse(pawX - 6, 17, 34, 30, C.orange2, { lw: 7 });
    for (let i = -1; i <= 1; i++) g.circle(pawX + 12, 17 + i * 14, 7, C.pink2, { lw: 3 });
  }
  // o gato espiando, à esquerda
  g.push();
  g.translate(-330, 40);
  cat(g, 0, 0, 0.9, { mood: tau > we && !won ? "smug" : "neutral", look: { x: 1, y: 0.3 } });
  g.pop();
}

export const undoSpill: Entry<S> = {
  def: {
    id: "undo-spill",
    num: 241,
    name: { en: "Undo!", pt: "Desfaz!" },
    verb: { en: "UNDO!", pt: "DESFAZ!" },
    hint: { pointer: "drag", keys: "lr" },
    category: "absurd",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "WTF Moment: a coffee disaster loops on a psychedelic VHS tape (cup fills, a cat paw creeps in, the cup tips, coffee floods the keyboard). Drag the timeline scrubber back to the exact moment the cup is full, upright and untouched, and let go there. Keys: arrows scrub, Space confirms.",
    winText: "Release the scrubber on a frame with a full, untouched cup.",
    loseText: "Release on a spilled frame, or time runs out.",
    timeScale: 1.2,
    minTime: 3.2,
    wtf: "insane",
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0.15) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) {
            const hx = s.barX0 + s.tau * (s.barX1 - s.barX0);
            const tx = s.barX0 + ((s.ws + s.we) / 2) * (s.barX1 - s.barX0);
            m.plan = planDrag({ x: hx, y: s.barY }, { x: tx, y: s.barY }, 2400);
          }
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0.15) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) {
            const hx = s.barX0 + s.tau * (s.barX1 - s.barX0);
            const tx = s.barX0 + 0.93 * (s.barX1 - s.barX0);
            m.plan = planDrag({ x: hx, y: s.barY }, { x: tx, y: s.barY }, 2400);
          }
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
