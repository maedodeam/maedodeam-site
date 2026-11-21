// 175 · DOUBLE CLICK! — um ícone de arquivo na área de trabalho. Clique duas vezes nele, rápido (≈0,4 s), para abrir.
// Um clique só apenas seleciona. Níveis altos: o ícone é menor, a janela de tempo encurta e (lv ≥ 0.5)
// depois do primeiro clique o ícone escorrega um pouco para o lado.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { easeOut, isPortrait } from "./util.ts";

interface S {
  icon: Point;
  from: Point;
  to: Point;
  slideT: number;
  slideDur: number;
  slideDist: number;
  slides: boolean;
  R: number;
  win: number;
  lastClick: number;
  selected: boolean;
  opened: boolean;
  t: number;
  endT: number;
  name: number;
}

const NAMES = [
  { en: "REPORT.DOC", pt: "RELATÓRIO.DOC" },
  { en: "BUDGET.XLS", pt: "ORÇAMENTO.XLS" },
  { en: "CAT.JPG", pt: "GATO.JPG" },
  { en: "NOTES.TXT", pt: "NOTAS.TXT" },
];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const icon = { x: w * rng.range(0.35, 0.65), y: (h - 120) * rng.range(0.4, 0.6) };
  const s: S = {
    icon,
    from: { ...icon },
    to: { ...icon },
    slideT: 1,
    slideDur: 0.12,
    slideDist: 90 + 50 * lv,
    slides: lv >= 0.5,
    R: 115 - 20 * lv,
    win: 0.45 - 0.07 * lv,
    lastClick: -1,
    selected: false,
    opened: false,
    t: 0,
    endT: 0,
    name: rng.int(0, NAMES.length - 1),
  };
  const margin = portrait ? 160 : 180;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.slideT < 1) {
        s.slideT = Math.min(1, s.slideT + dt / s.slideDur);
        const k = easeOut(s.slideT);
        s.icon = { x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k };
      }
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (!inp.pressed) return;
      const onIcon = Math.hypot(inp.x - s.icon.x, inp.y - s.icon.y) < s.R;
      if (!onIcon) {
        s.selected = false;
        s.lastClick = -1;
        return;
      }
      if (s.lastClick >= 0 && s.t - s.lastClick <= s.win) {
        s.opened = true;
        api.sfx("pop");
        api.sfx("chime");
        api.fx.burst(s.icon.x, s.icon.y, C.yellow, 18);
        api.win();
        return;
      }
      // primeiro clique: só seleciona (e, nos níveis altos, o ícone escorrega)
      s.selected = true;
      s.lastClick = s.t;
      api.sfx("click");
      if (s.slides) {
        const a = rng.range(0, Math.PI * 2);
        s.from = { ...s.icon };
        s.to = {
          x: Math.max(margin, Math.min(w - margin, s.icon.x + Math.cos(a) * s.slideDist)),
          y: Math.max(margin, Math.min(h - 120 - margin, s.icon.y + Math.sin(a) * s.slideDist)),
        };
        s.slideT = 0;
        api.sfx("slide");
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      // papel de parede: colinas
      g.ellipse(w * 0.25, h, w * 0.5, h * 0.35, C.green, { stroke: null });
      g.ellipse(w * 0.8, h * 1.05, w * 0.55, h * 0.4, C.teal, { stroke: null });
      g.circle(w * 0.82, h * 0.18, 70, C.yellow2, { stroke: null });
      // barra de tarefas
      g.rect(-10, h - 110, w + 20, 120, C.ink2, { lw: 6 });
      g.rect(24, h - 92, 130, 74, C.green, { r: 12, lw: 5 });
      g.text("≡", 89, h - 54, { size: 60, color: C.white });
      g.text("9:41", w - 100, h - 54, { size: 46, font: "mono", color: C.white });
      // ícone
      const ic = s.icon;
      const sc = (s.R / 115) * 1.4;
      const sel = s.selected && !s.opened;
      if (sel) {
        g.push();
        g.alpha(0.55);
        g.rect(ic.x - 95 * sc, ic.y - 100 * sc, 190 * sc, 225 * sc, C.sky, { r: 14, stroke: C.white, lw: 4 });
        g.pop();
      }
      g.push();
      g.translate(ic.x, ic.y - 15 * sc);
      g.scale(sc);
      g.shape(0, 0, [-50, -70, 26, -70, 50, -46, 50, 70, -50, 70], C.white, { lw: 7 });
      g.shape(0, 0, [26, -70, 26, -46, 50, -46], C.paper2, { lw: 5 });
      for (let i = 0; i < 4; i++) g.line(-32, -30 + i * 24, 30 - (i === 3 ? 26 : 0), -30 + i * 24, C.blue2, 7);
      g.pop();
      const label = api.t(NAMES[s.name]);
      const ls = 34 * sc;
      const lw = g.textWidth(label, { size: ls, font: "body", weight: 800 }) + 20;
      g.rect(ic.x - lw / 2, ic.y + 72 * sc, lw, ls * 1.4, sel ? C.blue : C.ink2, { r: 8, stroke: null });
      g.text(label, ic.x, ic.y + 72 * sc + ls * 0.72, { size: ls, font: "body", weight: 800, color: C.white });
      // janela aberta (vitória)
      if (s.opened) {
        const k = easeOut(s.endT * 4);
        const ww = Math.min(w - 120, 900) * k;
        const wh = Math.min(h - 260, 560) * k;
        if (k > 0.05) {
          g.rect(w / 2 - ww / 2, h * 0.45 - wh / 2, ww, wh, C.white, { r: 14, lw: 8 });
          g.rect(w / 2 - ww / 2, h * 0.45 - wh / 2, ww, 56 * k, C.blue, { r: 14, lw: 8 });
          g.text("✕", w / 2 + ww / 2 - 34 * k, h * 0.45 - wh / 2 + 28 * k, { size: 36 * k, color: C.white });
          cat(g, w / 2, h * 0.45 + 40 * k, 1.4 * k, { mood: "happy" });
          g.text(api.t({ en: "OPENED!", pt: "ABRIU!" }), w / 2, h * 0.45 - wh * 0.26, { size: 70 * k, color: C.orange, stroke: C.ink, lw: 10 });
        }
      }
      // ampulheta quando perdeu
      if (api.result === "lose") g.text(api.t({ en: "TOO SLOW…", pt: "DEVAGAR DEMAIS…" }), w / 2, h * 0.16, { size: 80, color: C.white, stroke: C.ink, lw: 12 });
      // cursor do mouse
      const inp = api.input;
      if (inp.hasPointer && inp.mode === "mouse" && !api.result) {
        g.shape(inp.x, inp.y, [0, 0, 0, 52, 13, 40, 24, 62, 34, 57, 23, 36, 40, 36], C.white, { lw: 5 });
      }
    },
  };
}

export const doubleClick: Entry<S> = {
  def: {
    id: "double-click",
    num: 175,
    name: { en: "Double Click", pt: "Clique Duplo" },
    verb: { en: "DOUBLE CLICK!", pt: "CLIQUE DUPLO!" },
    hint: { pointer: "tap" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A file icon sits on the desktop. Double-click it (two quick taps on it, about 0.4 s apart at most) to open it; a single click only selects it. Later the icon is smaller, the window shorter, and it slides a little after the first click.",
    winText: "Two quick clicks on the icon open the file.",
    loseText: "Time runs out with the file still closed.",
    minTime: 3,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          if (s.slideT < 1) return;
          io.tap(s.icon.x, s.icon.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.2 || io.isDown) return;
          // erro: cliques devagar demais
          const m = mem(s, () => ({ next: 0 }));
          if (s.t < m.next || s.slideT < 1) return;
          io.tap(s.icon.x, s.icon.y);
          m.next = s.t + s.win + 0.2;
        },
      }
    : null,
};
