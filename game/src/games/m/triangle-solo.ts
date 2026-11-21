// 195 · DING ON CUE! — a orquestra toca; a partitura mostra 2 compassos de 4 tempos com UMA nota de triângulo marcada.
// Os pontinhos de tempo acendem com o maestro. Toque exatamente naquele tempo (±0,12 s). Qualquer outro toque = erro.
// Nos níveis altos o andamento acelera e, no 2º compasso, só o maestro marca o tempo (os pontinhos não acendem).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { isPortrait } from "./util.ts";

interface S {
  lead: number;
  ib: number;
  target: number;
  T: number;
  win: number;
  beat: number;
  dark2: boolean;
  dinged: boolean;
  wrongAt: number;
  ring: number;
  t: number;
}

const WINDOW = 0.12;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const lead = 0.4;
  const ib = Math.max(0.28, Math.min(0.62 - lv * 0.06, (api.duration - lead - 0.35) / 7));
  const dark2 = lv >= 1;
  const target = dark2 ? rng.int(4, 7) : rng.int(2, 7);
  const s: S = {
    lead,
    ib,
    target,
    T: lead + target * ib,
    win: WINDOW,
    beat: -1,
    dark2,
    dinged: false,
    wrongAt: -1,
    ring: 0,
    t: 0,
  };

  // diagramação: no retrato a partitura ocupa a metade de cima (um compasso por linha) e os personagens crescem
  const rows = portrait ? 2 : 1;
  const sw = portrait ? w - 80 : Math.min(w - 80, 1300);
  const sx = (w - sw) / 2;
  const sy = portrait ? h * 0.06 : 46;
  const header = portrait ? 24 : 56;
  const rowH = portrait ? 340 : 250;
  const slotW = (sw - 60) / (8 / rows);
  const floor = portrait ? h * 0.88 : h * 0.9;
  const condS = portrait ? 1.6 : 1.3;
  const playS = portrait ? 1.75 : 1.45;
  const playX = w * (portrait ? 0.73 : 0.8);
  const lay = {
    rows,
    sx,
    sy,
    sw,
    sh: header + rows * rowH + 10,
    rowH,
    slotW,
    noteR: Math.min(slotW * 0.42, portrait ? 70 : 56),
    dotR: Math.min(slotW * 0.3, portrait ? 44 : 34),
    labelSize: portrait ? 34 : 28,
    rowTop: (r: number) => sy + header + r * rowH,
    slot: (i: number) => {
      const r = rows === 2 ? Math.floor(i / 4) : 0;
      const col = rows === 2 ? i % 4 : i;
      const top = sy + header + r * rowH;
      return { x: sx + 30 + slotW * (col + 0.5), staffY: top + rowH * (rows === 2 ? 0.44 : 0.36), dotY: top + rowH * (rows === 2 ? 0.82 : 0.8) };
    },
    floor,
    condS,
    condX: w * (portrait ? 0.3 : 0.52),
    playS,
    playX,
    tri: { x: playX - 52 * playS, y: floor - 110 * playS },
    musX: portrait ? [w * 0.1, w * 0.52, w * 0.92] : [w * 0.08, w * 0.17, w * 0.26, w * 0.35],
    musS: portrait ? 1.0 : 0.9,
    musUp: portrait ? 210 : 130,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      s.ring = Math.max(0, s.ring - dt);
      // tempo atual (0..7) e som da orquestra
      const b = Math.floor((s.t - s.lead) / s.ib + 1e-6);
      if (b !== s.beat && b >= 0 && b < 8 && s.t >= s.lead) {
        s.beat = b;
        if (b !== s.target) api.sfx(b % 4 === 0 ? "drum" : "tap");
      }
      if (api.result) return;
      if (api.input.actionPressed) {
        if (Math.abs(s.t - s.T) <= s.win) {
          s.dinged = true;
          s.ring = 0.6;
          api.sfx("chime");
          api.fx.burst(lay.tri.x, lay.tri.y, C.yellow, 18);
          api.fx.pop(lay.tri.x, lay.tri.y - 200, "DING!", C.yellow);
          api.win();
        } else {
          s.wrongAt = s.t;
          api.sfx("buzz");
          api.fx.shake(0.4);
          api.fx.pop(lay.tri.x, lay.tri.y - 200, s.t < s.T ? api.t({ en: "TOO SOON!", pt: "CEDO!" }) : api.t({ en: "LATE!", pt: "ATRASOU!" }), C.red);
          api.lose();
        }
        return;
      }
      if (s.t > s.T + s.win) {
        s.wrongAt = s.t;
        api.sfx("miss");
        api.fx.pop(w / 2, h * 0.5, api.t({ en: "MISSED!", pt: "PERDEU!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      const L = lay;
      // palco: cortina e chão
      g.rect(-10, L.floor - 40, w + 20, h - L.floor + 50, C.brown, { stroke: null });
      g.line(0, L.floor - 40, w, L.floor - 40, C.ink, 7);
      for (let x = -40; x < w + 80; x += 120) g.ellipse(x, -20, 70, 90, C.red, { lw: 6 });
      // partitura: 2 compassos x 4 tempos (no retrato, um compasso por linha)
      g.rect(L.sx + 10, L.sy + 12, L.sw, L.sh, C.ink, { r: 22, stroke: null });
      g.rect(L.sx, L.sy, L.sw, L.sh, C.paper, { r: 22, lw: 8 });
      const now = s.t >= s.lead ? (s.t - s.lead) / s.ib : -1;
      for (let r = 0; r < L.rows; r++) {
        const staffY = L.slot(r * 4).staffY;
        const gap = L.noteR * 0.36;
        for (let k = -2; k <= 2; k++) g.line(L.sx + 30, staffY + k * gap, L.sx + L.sw - 30, staffY + k * gap, C.gray, 3);
        if (L.rows === 1) g.line(L.sx + 30 + L.slotW * 4, staffY - gap * 2.6, L.sx + 30 + L.slotW * 4, staffY + gap * 2.6, C.ink, 7);
        g.line(L.sx + L.sw - 30, staffY - gap * 2.6, L.sx + L.sw - 30, staffY + gap * 2.6, C.ink, 9);
      }
      for (let i = 0; i < 8; i++) {
        const c = L.slot(i);
        if (i === s.target) {
          // a nota do triângulo
          const pulse = 1 + Math.sin(s.t * 10) * 0.08;
          const nr = L.noteR * pulse;
          g.circle(c.x, c.staffY, nr, C.yellow, { lw: 7 });
          g.shape(c.x, c.staffY + nr * 0.1, [0, -nr * 0.6, nr * 0.55, nr * 0.38, -nr * 0.55, nr * 0.38], null, { lw: 8 });
        } else {
          // pausa (tracinho)
          g.rect(c.x - L.noteR * 0.35, c.staffY - 7, L.noteR * 0.7, 14, C.ink2, { r: 3, stroke: null });
        }
        // pontinho do tempo (a informação principal: grande)
        const lit = Math.floor(now + 1e-6) === i && !(s.dark2 && i >= 4);
        const passed = now >= i + 1;
        const fill = lit ? (i === s.target ? C.yellow : C.orange) : passed ? C.gray : C.paper2;
        g.circle(c.x, c.dotY, lit ? L.dotR * 1.2 : L.dotR, fill, { lw: 6 });
        if (i % 4 === 0) {
          const lx = L.rows === 1 ? c.x - L.slotW * 0.3 : L.sx + 34;
          const ly = L.rows === 1 ? L.sy + 32 : L.rowTop(i / 4) + 24;
          g.text(api.t({ en: `BAR ${i / 4 + 1}`, pt: `COMP. ${i / 4 + 1}` }), lx, ly, { size: L.labelSize, font: "body", weight: 800, color: C.gray2, align: "left" });
        }
      }
      if (s.dark2) {
        const c = L.slot(L.rows === 1 ? 6 : 4);
        const tx = L.rows === 1 ? c.x : L.sx + L.sw - 34;
        const ty = L.rows === 1 ? L.sy + 32 : L.rowTop(1) + 24;
        g.text(api.t({ en: "follow the baton!", pt: "siga a batuta!" }), tx, ty, { size: L.labelSize, font: "body", weight: 800, color: C.purple, align: L.rows === 1 ? "center" : "right" });
      }
      // músicos ao fundo
      const cols = [C.blue, C.green, C.purple, C.teal];
      const bob = s.beat >= 0 ? Math.sin((s.t * Math.PI * 2) / s.ib) * 4 : 0;
      for (const [k, x] of L.musX.entries()) {
        const y = L.floor - L.musUp + bob;
        person(g, x, y, L.musS, { shirt: cols[k % 4], tie: null, mood: s.wrongAt >= 0 ? "shock" : "neutral", look: { x: 0.5, y: -0.3 } });
        g.line(x + 30 * L.musS, y - 120 * L.musS, x + 70 * L.musS, y - 170 * L.musS, C.brown, 8);
      }
      // maestro: batuta sobe e desce em cada tempo
      const ks = L.condS;
      const mx = L.condX;
      const phase = now >= 0 ? now - Math.floor(now) : 0;
      const beatInBar = now >= 0 ? Math.floor(now) % 4 : 0;
      const bx = [0, -40, 40, 0][beatInBar] * ks;
      const baton = { x: mx + 60 * ks + bx, y: L.floor - 230 * ks + (phase * phase * 70 - (1 - phase) * 20) * ks };
      person(g, mx, L.floor, ks, { shirt: C.ink2, tie: C.white, hair: C.gray, mood: s.wrongAt >= 0 ? "angry" : s.dinged ? "happy" : "neutral", look: { x: 0.6, y: 0 } });
      g.line(mx + 36 * ks, L.floor - 130 * ks, baton.x, baton.y, C.ink2, 16);
      g.line(baton.x, baton.y, baton.x + 50 * ks, baton.y - 60 * ks, C.white, 8);
      // você: o triangulista
      const kp = L.playS;
      const tx = L.playX;
      person(g, tx, L.floor + 20, kp, { shirt: C.orange, tie: null, mood: s.dinged ? "happy" : s.wrongAt >= 0 ? "sad" : "worried", look: { x: -0.5, y: -0.4 } });
      const tri = L.tri;
      const shake = s.ring > 0 ? Math.sin(s.t * 80) * 6 * s.ring : 0;
      g.line(tri.x, tri.y - 70 * kp, tri.x, tri.y - 42 * kp, C.gray, 5);
      g.push();
      g.translate(tri.x + shake, tri.y);
      g.scale(kp);
      g.shape(0, 0, [0, -44, 40, 26, -40, 26], null, { stroke: C.ink, lw: 16 });
      g.shape(0, 0, [0, -44, 40, 26, -40, 26], null, { stroke: C.yellow, lw: 9 });
      g.pop();
      if (s.ring > 0) {
        for (let k = 1; k <= 3; k++) g.arc(tri.x, tri.y - 10, (50 + k * 26 + (0.6 - s.ring) * 60) * kp, -0.6, 0.6, C.yellow, 6);
      }
      g.line(tri.x + 80 * kp, tri.y - 20 * kp, tri.x + 30 * kp, tri.y + 10 * kp, C.gray2, 7);
    },
  };
}

export const triangleSolo: Entry<S> = {
  def: {
    id: "triangle-solo",
    num: 195,
    name: { en: "Triangle Solo", pt: "Solo de Triângulo" },
    verb: { en: "DING ON CUE!", pt: "NA HORA CERTA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "action",
    goal: "complete",
    difficulty: 2,
    mechanic: "The orchestra plays two bars of four beats; the score marks the one beat for your triangle. Tap exactly on it (±0.12 s); any other tap ruins the concert. Later the tempo rises and bar 2 is kept only by the conductor's baton.",
    winText: "Ding exactly on the marked beat.",
    loseText: "Tap on any other beat or miss your note.",
    timeScale: 1.2,
    minTime: 3.6,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          // o toque vale no próximo quadro do jogo (tempo + dt)
          if (s.t + dt >= s.T - 0.02 && !io.isDown) {
            if (io.touch) io.tap(api.w / 2, api.h / 2);
            else io.press("Space");
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          // um tempo adiantado
          if (s.t + dt >= s.T - s.ib && !io.isDown) io.tap(api.w / 2, api.h / 2);
        },
      }
    : null,
};
