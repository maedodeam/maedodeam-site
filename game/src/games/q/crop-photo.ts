// 246 · CROP THE CAT! — editor de fotos: a caixa de recorte começa na foto inteira, presa pelo canto de cima.
// Arraste a alça do canto de baixo para a caixa abraçar o gato bem justinho e solte para recortar.
// Vence com sobreposição (IoU) ≥ 70%. Cortou orelha ou sobrou fundo demais = perde.
// Níveis altos: exige mais (75% em lv ≥ 0.5, 80% em lv ≥ 1), gato menor, canto preso um pouco fora e sem o medidor.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cat, cup, plant } from "../../gfx/art.ts";
import { mem, planDrag, stepDrag, type DragPlan } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface S {
  photo: Box;
  catX: number;
  catY: number;
  sc: number;
  target: Box;
  anchor: Point;
  handle: Point;
  held: boolean;
  thr: number;
  meter: boolean;
  iou: number;
  verdict: "" | "win" | "small" | "big";
  props: { kind: number; x: number; y: number }[];
  t: number;
  endT: number;
}

function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const ua = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return ua > 0 ? inter / ua : 0;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const pw = portrait ? w - 120 : Math.min(w * 0.62, 1100);
  const ph = portrait ? h * 0.52 : h * 0.72;
  const px = (w - pw) / 2;
  const py = portrait ? h * 0.2 : h * 0.16;
  const photo = { x0: px, y0: py, x1: px + pw, y1: py + ph };
  const sc = (portrait ? 1.45 : 1.3) - 0.25 * Math.min(1, lv);
  // gato num canto qualquer, com espaço para a alça
  const bw = 157 * sc;
  const bh = 162 * sc;
  const tx0 = rng.range(px + 40, px + pw - bw - 120);
  const ty0 = rng.range(py + 40, py + ph - bh - 120);
  const target = { x0: tx0, y0: ty0, x1: tx0 + bw, y1: ty0 + bh };
  const off = lv >= 0.5 ? 12 : 0;
  const anchor = { x: tx0 - off * rng.range(0.4, 1), y: ty0 - off * rng.range(0.4, 1) };
  const props: S["props"] = [];
  for (let i = 0; i < 3; i++) {
    const x = rng.range(px + 80, px + pw - 80);
    const y = rng.range(py + 160, py + ph - 30);
    if (x > target.x0 - 110 && x < target.x1 + 110 && y > target.y0 - 40 && y < target.y1 + 190) continue;
    props.push({ kind: i % 2, x, y });
  }
  const s: S = {
    photo,
    catX: tx0 + 56 * sc,
    catY: ty0 + 160 * sc,
    sc,
    target,
    anchor,
    handle: { x: photo.x1 - 20, y: photo.y1 - 20 },
    held: false,
    thr: lv >= 1 ? 0.8 : lv >= 0.5 ? 0.75 : 0.7,
    meter: lv < 0.5,
    iou: 0,
    verdict: "",
    props,
    t: 0,
    endT: 0,
  };
  const box = (): Box => ({ x0: s.anchor.x, y0: s.anchor.y, x1: s.handle.x, y1: s.handle.y });
  s.iou = iou(box(), s.target);

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed && Math.hypot(inp.x - s.handle.x, inp.y - s.handle.y) < 100) {
        s.held = true;
        api.sfx("click");
      }
      if (!s.held) return;
      s.handle.x = Math.max(s.anchor.x + 40, Math.min(photo.x1, inp.x));
      s.handle.y = Math.max(s.anchor.y + 40, Math.min(photo.y1, inp.y));
      s.iou = iou(box(), s.target);
      if (!inp.down || inp.released) {
        s.held = false;
        const b = box();
        if (s.iou >= s.thr) {
          s.verdict = "win";
          api.sfx("zap");
          api.sfx("chime");
          api.fx.burst((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, C.yellow, 24);
          api.win();
        } else {
          const area = (b.x1 - b.x0) * (b.y1 - b.y0);
          s.verdict = area < (s.target.x1 - s.target.x0) * (s.target.y1 - s.target.y0) ? "small" : "big";
          api.sfx("buzz");
          api.fx.shake(0.4);
          api.lose();
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // barra do editor
      g.rect(0, 0, w, 90, C.ink2, { stroke: null });
      for (let i = 0; i < 4; i++) g.rect(30 + i * 90, 20, 60, 50, C.gray2, { r: 10, stroke: null });
      g.text("CROP", w - 60, 46, { size: 40, font: "mono", align: "right", color: C.yellow });
      // a foto
      const p = s.photo;
      g.rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, C.sky, { lw: 6 });
      g.rect(p.x0, p.y0 + (p.y1 - p.y0) * 0.68, p.x1 - p.x0, (p.y1 - p.y0) * 0.32, C.green2, { stroke: null });
      g.circle(p.x1 - 90, p.y0 + 90, 50, C.yellow, { stroke: null });
      for (const pr of s.props) {
        if (pr.kind === 0) plant(g, pr.x, pr.y, 0.8);
        else cup(g, pr.x, pr.y - 40, 0.9, C.white, false);
      }
      const verdict = s.verdict;
      cat(g, s.catX, s.catY, s.sc, { mood: verdict === "win" ? "happy" : verdict ? "angry" : "smug", look: { x: 0.3, y: 0.2 } });
      // área fora do recorte escurecida
      const b = box();
      g.push();
      g.alpha(0.55);
      g.rect(p.x0, p.y0, p.x1 - p.x0, b.y0 - p.y0, C.ink, { stroke: null });
      g.rect(p.x0, b.y1, p.x1 - p.x0, p.y1 - b.y1, C.ink, { stroke: null });
      g.rect(p.x0, b.y0, b.x0 - p.x0, b.y1 - b.y0, C.ink, { stroke: null });
      g.rect(b.x1, b.y0, p.x1 - b.x1, b.y1 - b.y0, C.ink, { stroke: null });
      g.pop();
      // caixa de recorte com terços
      g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, null, { stroke: C.white, lw: 6 });
      for (let i = 1; i < 3; i++) {
        g.line(b.x0 + ((b.x1 - b.x0) * i) / 3, b.y0, b.x0 + ((b.x1 - b.x0) * i) / 3, b.y1, "rgba(255,255,255,0.5)", 3);
        g.line(b.x0, b.y0 + ((b.y1 - b.y0) * i) / 3, b.x1, b.y0 + ((b.y1 - b.y0) * i) / 3, "rgba(255,255,255,0.5)", 3);
      }
      // canto preso (alfinete) e alça
      g.circle(b.x0, b.y0, 16, C.red, { lw: 5 });
      const pulse = s.held || api.result ? 0 : Math.sin(s.t * 8) * 6;
      g.circle(s.handle.x, s.handle.y, 40 + pulse, s.held ? C.yellow : C.white, { lw: 7 });
      g.polyline(
        [
          { x: s.handle.x - 20, y: s.handle.y + 4 },
          { x: s.handle.x + 4, y: s.handle.y + 4 },
          { x: s.handle.x + 4, y: s.handle.y - 20 },
        ],
        C.ink,
        7,
      );
      // medidor
      const my = portrait ? p.y1 + 110 : p.y1 + 70;
      if (s.meter || api.result) {
        const pct = Math.round(s.iou * 100);
        const ok = s.iou >= s.thr;
        g.text(api.t({ en: `FIT ${pct}%`, pt: `AJUSTE ${pct}%` }), w / 2, my, { size: 60, color: ok ? C.green : C.white, font: "mono" });
      } else g.text(api.t({ en: "SNUG FIT, THEN LET GO", pt: "BEM JUSTO E SOLTA" }), w / 2, my, { size: 50, color: C.white });
      if (verdict) {
        const msg =
          verdict === "win"
            ? api.t({ en: "PURRFECT!", pt: "PERFEITO!" })
            : verdict === "small"
              ? api.t({ en: "CUT THE CAT!", pt: "CORTOU O GATO!" })
              : api.t({ en: "TOO MUCH SKY!", pt: "SOBROU FUNDO!" });
        g.text(msg, w / 2, p.y0 + 90, { size: 100, color: verdict === "win" ? C.yellow : C.red, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const cropPhoto: Entry<S> = {
  def: {
    id: "crop-photo",
    num: 246,
    name: { en: "Crop It", pt: "Recorta" },
    verb: { en: "CROP THE CAT!", pt: "RECORTA O GATO!" },
    hint: { pointer: "drag" },
    category: "precision",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A photo editor: the crop box starts on the whole picture, pinned at its top-left corner. Drag the bottom-right handle so the box tightly fits the cat, then let go to crop (overlap ≥ 70%, stricter later).",
    winText: "Release with the box snugly around the cat.",
    loseText: "Release with the cat cut off or too much background, or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) m.plan = planDrag({ ...s.handle }, { x: s.target.x1, y: s.target.y1 }, 2200);
          stepDrag(io, m.plan, dt);
        },
        lose(s, api, io, dt) {
          if (api.result || api.time <= 0.1) return;
          const m = mem(s, () => ({ plan: null as DragPlan | null }));
          if (!m.plan) m.plan = planDrag({ ...s.handle }, { x: (s.target.x0 + s.target.x1) / 2, y: (s.target.y0 + s.target.y1) / 2 }, 2200);
          stepDrag(io, m.plan, dt);
        },
      }
    : null,
};
