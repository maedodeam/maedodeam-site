// Desenho das telas do jogo em volta dos microgames: HUD, interlúdio, instrução, resultado, aceleração, fim.
import type { Session } from "../core/session.ts";
import { betweenTime, SPEEDUP_TIME } from "../core/session.ts";
import { INTRO_FREEZE } from "../core/runner.ts";
import { START_LIVES } from "../core/difficulty.ts";
import type { InputMode, Lang, Text } from "../core/types.ts";
import { hintText, tr, UI } from "../core/i18n.ts";
import { Gfx } from "../gfx/draw.ts";
import { C } from "../gfx/palette.ts";
import { heart, blob } from "../gfx/art.ts";
import type { Fit } from "../core/layout.ts";
import type { MicrogameDef } from "../core/types.ts";

export interface View {
  /** Tamanho da janela (px CSS). */
  vw: number;
  vh: number;
  /** Faixas do HUD. */
  top: number;
  bottom: number;
  /** Encaixe do palco na área entre as faixas. */
  fit: Fit;
}

export interface RenderState {
  session: Session;
  lang: Lang;
  mode: InputMode;
  time: number;
  calm: boolean;
  /** Verbos do catálogo, para o fundo animado da tela inicial. */
  verbs: string[];
  paused: boolean;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const back = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export class Renderer {
  private readonly g: Gfx;

  constructor(ctx: CanvasRenderingContext2D) {
    this.g = new Gfx(ctx, 1, 1);
  }

  render(v: View, st: RenderState, dpr: number): void {
    const g = this.g;
    const ctx = g.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.time = st.time;
    g.w = v.vw;
    g.h = v.vh;
    g.clear(C.ink);

    const s = st.session;
    const stageX = v.fit.offX;
    const stageY = v.top + v.fit.offY;

    // ---------- palco ----------
    g.push();
    g.translate(stageX, stageY);
    g.scale(v.fit.scale);
    g.w = v.fit.w;
    g.h = v.fit.h;
    g.clip(0, 0, v.fit.w, v.fit.h, 0);
    switch (s.phase) {
      case "title":
        this.title(st);
        break;
      case "between":
        this.between(st);
        break;
      case "speedup":
        this.speedup(st);
        break;
      case "over":
        this.over(st);
        break;
      case "game":
        this.game(st);
        break;
    }
    g.pop();

    // ---------- HUD ----------
    g.w = v.vw;
    g.h = v.vh;
    if (s.phase !== "title") this.hud(v, st);
  }

  // ---------------- HUD ----------------

  private hud(v: View, st: RenderState): void {
    const g = this.g;
    const s = st.session;
    const t = v.top;
    const hr = t * 0.22;
    // vidas
    for (let i = 0; i < START_LIVES; i++) {
      const x = 16 + hr * 1.3 + i * hr * 2.8;
      const alive = i < s.lives;
      heart(g, x, t / 2 + 2, hr, alive ? C.orange : C.ink2, { stroke: alive ? C.ink : C.gray2, lw: 2.5 });
    }
    // número do microgame
    const n = s.phase === "game" || s.phase === "between" ? s.played + 1 : s.played;
    const lx = 16 + hr * 1.3 + START_LIVES * hr * 2.8 + 10;
    g.text(`#${String(n).padStart(2, "0")}`, lx, t / 2 + 1, { size: t * 0.4, font: "mono", align: "left", color: C.paper });
    // pontos e velocidade (deixa espaço para os botões à direita)
    const right = v.vw - Math.min(200, v.vw * 0.4);
    g.text(`${s.score}`, right, t / 2 + 1, { size: t * 0.42, font: "mono", align: "right", color: C.paper });
    if (s.tier > 1) {
      const w = g.textWidth(`×${s.tier}`, { size: t * 0.32, font: "mono" }) + 16;
      g.rect(right - g.textWidth(`${s.score}`, { size: t * 0.42, font: "mono" }) - w - 12, t / 2 - t * 0.22, w, t * 0.44, C.orange, { r: 6, stroke: null });
      g.text(`×${s.tier}`, right - g.textWidth(`${s.score}`, { size: t * 0.42, font: "mono" }) - 12 - w / 2, t / 2 + 1, { size: t * 0.32, font: "mono", color: C.ink });
    }

    // pavio do tempo
    const r = s.runner;
    const y0 = v.vh - v.bottom;
    g.rect(0, y0, v.vw, v.bottom, C.ink2, { stroke: null });
    if (s.phase === "game" && r) {
      const frac = r.phase === "intro" ? 1 : r.timeLeftFrac;
      const w = v.vw * frac;
      const danger = frac < 0.3 && !r.result;
      const col = r.result === "win" ? C.green : r.result === "lose" ? C.red : danger ? (Math.floor(st.time * 8) % 2 ? C.red : C.orange) : C.orange;
      g.rect(0, y0 + 3, w, v.bottom - 6, col, { stroke: null, r: 3 });
      if (!r.result && r.phase === "play") {
        const fl = 0.7 + Math.sin(st.time * 40) * 0.3;
        g.star(w, y0 + v.bottom / 2, v.bottom * 0.75 * fl, v.bottom * 0.3, 6, C.yellow, { stroke: null, rot: st.time * 6 });
      }
    }
  }

  // ---------------- microgame em andamento ----------------

  private game(st: RenderState): void {
    const g = this.g;
    const r = st.session.runner;
    if (!r) return;
    g.time = r.clock;
    r.draw(g);
    g.time = st.time;
    const def = r.def;

    // instrução: entra com estalo e sai depois de ~0.6 s de jogo
    const showFor = INTRO_FREEZE + 0.55;
    if (r.clock < showFor && !r.result) {
      const k = r.clock / showFor;
      const inK = back(r.clock / 0.28);
      const out = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      this.instruction(def, r.verb, st, inK, out);
    }
    if (r.result) this.stamp(r.result === "win", r.clock - r.resultClock, st);
  }

  private instruction(def: MicrogameDef, verbText: Text, st: RenderState, inK: number, alpha: number): void {
    const g = this.g;
    const verb = tr(verbText, st.lang);
    const size = Math.min(g.w / Math.max(4, verb.length * 0.5), g.h * 0.24, 260);
    g.push();
    g.alpha(alpha);
    g.translate(g.w / 2, g.h * 0.42);
    g.rotate(-0.06);
    g.scale(Math.max(0.01, inK));
    g.text(verb, 10, 14, { size, color: C.ink, stroke: C.ink, lw: size * 0.22 });
    g.text(verb, 0, 0, { size, color: C.paper, stroke: C.ink, lw: size * 0.2 });
    g.pop();
    const hint = hintText(def.hint, st.mode, st.lang);
    const hs = Math.min(46, g.w * 0.045);
    const hw = g.textWidth(hint, { size: hs, font: "mono", weight: 700 }) + hs * 1.4;
    g.push();
    g.alpha(alpha);
    g.rect(g.w / 2 - hw / 2, g.h * 0.42 + size * 0.55, hw, hs * 1.7, C.ink, { r: hs * 0.85, stroke: C.paper, lw: 4 });
    g.text(hint, g.w / 2, g.h * 0.42 + size * 0.55 + hs * 0.88, { size: hs, font: "mono", weight: 700, color: C.paper });
    g.pop();
  }

  private stamp(win: boolean, since: number, st: RenderState): void {
    const g = this.g;
    // Espera um instante para o jogador ver o que aconteceu, depois carimba.
    const k = since - 0.12;
    if (k <= 0) return;
    const text = tr(win ? UI.nice : UI.oops, st.lang);
    const size = Math.min(g.w * 0.22, g.h * 0.2, 220);
    const pop = st.calm ? 1 : back(k / 0.2);
    g.push();
    g.translate(g.w / 2, g.h * 0.5);
    g.rotate(win ? -0.12 : 0.1);
    g.scale(Math.max(0.01, pop));
    const w = g.textWidth(text, { size }) + size * 0.7;
    g.rect(-w / 2 + 12, -size * 0.62 + 14, w, size * 1.24, C.ink, { r: 26, stroke: null });
    g.rect(-w / 2, -size * 0.62, w, size * 1.24, win ? C.green : C.red, { r: 26, lw: 10 });
    g.text(text, 0, size * 0.05, { size, color: C.paper, stroke: C.ink, lw: size * 0.14 });
    g.pop();
  }

  // ---------------- interlúdio ----------------

  private between(st: RenderState): void {
    const g = this.g;
    const s = st.session;
    const t = s.phaseTime;
    const dur = betweenTime(s.tier);
    g.clear(C.ink);
    this.stripes(C.ink2, st.time * 120, 0.35);
    const k = ease(t / 0.25);
    const portrait = g.h > g.w;

    // número do próximo microgame
    const n = String(s.played + 1).padStart(2, "0");
    const size = Math.min(g.h * (portrait ? 0.3 : 0.42), g.w * 0.5);
    g.push();
    g.translate(g.w / 2, g.h * (portrait ? 0.36 : 0.4));
    g.scale(0.6 + 0.4 * k);
    g.text(n, 12, 16, { size, color: C.orange, stroke: C.ink, lw: size * 0.08 });
    g.text(n, 0, 0, { size, color: C.paper, stroke: C.ink, lw: size * 0.06 });
    g.pop();
    g.text("MICROGAME", g.w / 2, g.h * (portrait ? 0.36 : 0.4) - size * 0.55, { size: Math.min(44, g.w * 0.05), font: "mono", color: C.muted });

    // vidas grandes; a que acabou de ser perdida quebra
    const hr = Math.min(g.w, g.h) * 0.055;
    const lost = s.lastResult === "lose" && s.livesBefore > s.lives;
    for (let i = 0; i < START_LIVES; i++) {
      const x = g.w / 2 + (i - (START_LIVES - 1) / 2) * hr * 3;
      const y = g.h * (portrait ? 0.62 : 0.7);
      const alive = i < s.lives;
      const breaking = lost && i === s.lives && t < 0.5;
      g.push();
      g.translate(x, y + (breaking ? t * 120 : 0));
      if (breaking) g.rotate(t * 1.5);
      heart(g, 0, 0, hr, alive ? C.orange : breaking ? C.red : C.ink2, { stroke: alive || breaking ? C.ink : C.gray2, lw: 6 });
      if (!alive && !breaking) g.line(-hr * 0.6, -hr * 0.6, hr * 0.6, hr * 0.6, C.gray2, 6);
      g.pop();
    }

    // mascote reage ao resultado anterior
    const mood = s.lastResult === "win" ? "happy" : s.lastResult === "lose" ? "sad" : "neutral";
    const bob = Math.sin(st.time * 10) * 8;
    blob(g, g.w / 2, g.h * (portrait ? 0.8 : 0.86) + bob, Math.min(70, g.h * 0.06), s.lastResult === "lose" ? C.blue : C.yellow, mood);
    if (s.lastPoints > 0 && s.lastResult === "win" && t < dur) {
      g.push();
      g.alpha(1 - t / dur);
      g.text(`+${s.lastPoints}`, g.w / 2 + Math.min(200, g.w * 0.2), g.h * (portrait ? 0.78 : 0.82) - t * 60, { size: 64, font: "mono", color: C.yellow, stroke: C.ink, lw: 10 });
      g.pop();
    }
    g.text("MAEDODEAM_", 40, 50, { size: 30, font: "mono", align: "left", color: C.gray2 });
  }

  /** Listras diagonais em movimento (fundo). */
  private stripes(color: string, offset: number, alpha: number, width = 90): void {
    const g = this.g;
    g.push();
    g.alpha(alpha);
    const span = g.w + g.h;
    const off = offset % (width * 2);
    for (let x = -g.h - width * 2 + off; x < span; x += width * 2) {
      g.shape(x, 0, [0, 0, width, 0, width + g.h, g.h, g.h, g.h], color, { stroke: null });
    }
    g.pop();
  }

  // ---------------- aceleração ----------------

  private speedup(st: RenderState): void {
    const g = this.g;
    const s = st.session;
    const t = s.phaseTime;
    g.clear(C.orange);
    this.stripes(C.ink, st.time * (st.calm ? 200 : 900), 1, 70);
    const k = back(t / 0.35);
    const out = t > SPEEDUP_TIME - 0.25 ? (SPEEDUP_TIME - t) / 0.25 : 1;
    const text = tr(UI.speedUp, st.lang);
    const size = Math.min(g.w / (text.length * 0.48), g.h * 0.28);
    g.push();
    g.alpha(Math.max(0, out));
    g.rect(0, g.h / 2 - size * 0.75, g.w, size * 1.5, C.ink, { stroke: null });
    g.translate(g.w / 2, g.h / 2);
    g.scale(k);
    g.rotate(-0.04);
    g.text(text, 0, 0, { size, color: C.yellow, stroke: C.ink, lw: size * 0.1 });
    g.pop();
    g.text(`×${s.tier}`, g.w / 2, g.h / 2 + size * 1.05, { size: size * 0.45, font: "mono", color: C.ink });
  }

  // ---------------- fim ----------------

  private over(st: RenderState): void {
    const g = this.g;
    const s = st.session;
    const t = s.phaseTime;
    g.clear(C.ink);
    this.stripes(C.ink2, st.time * 40, 0.5);
    const text = tr(UI.gameOver, st.lang);
    const size = Math.min(g.w / (text.length * 0.5), g.h * 0.24);
    const drop = st.calm ? 1 : ease(t / 0.5);
    g.push();
    g.translate(g.w / 2, g.h * 0.45 - (1 - drop) * g.h * 0.5);
    g.rotate(-0.05 * drop);
    g.text(text, 0, 0, { size, color: C.red, stroke: C.paper, lw: size * 0.08 });
    g.pop();
    blob(g, g.w / 2, g.h * 0.75, Math.min(80, g.h * 0.07), C.blue, "dizzy");
  }

  // ---------------- tela inicial ----------------

  private title(st: RenderState): void {
    const g = this.g;
    g.clear(C.ink);
    const verbs = st.verbs.length ? st.verbs : ["PLAY!"];
    const rows = Math.ceil(g.h / 150) + 1;
    const cols = [C.orange, C.yellow, C.blue, C.pink, C.green, C.purple];
    const speed = st.calm ? 0 : 60;
    for (let r = 0; r < rows; r++) {
      const y = r * 150 + 40;
      const dir = r % 2 ? 1 : -1;
      const line = Array.from({ length: 8 }, (_, i) => verbs[(r * 5 + i * 3) % verbs.length]).join("  ·  ");
      const w = g.textWidth(line, { size: 110 });
      const off = ((st.time * speed * dir) % w) - w / 2;
      g.push();
      g.alpha(0.16);
      g.text(line, g.w / 2 + off, y, { size: 110, color: cols[r % cols.length] });
      g.text(line, g.w / 2 + off + w * dir, y, { size: 110, color: cols[r % cols.length] });
      g.pop();
    }
  }
}
