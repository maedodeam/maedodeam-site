// Galeria de desenvolvimento: roda microgames com os bots, no navegador (canvas real), e desenha uma folha de
// quadros em momentos escolhidos. Não faz parte do site publicado.
//
// Parâmetros da URL:
//   ids=swat-fly,pour-coffee   (vazio = todos)
//   stage=landscape|portrait|square   level=0..1.5   bot=win|lose|idle   seed=1   lang=en|pt
//   times=0.3,1.2,3            momentos (s de jogo) a capturar; "end" = último quadro
//   cell=360                   largura de cada quadro (px)
import { ENTRIES } from "../src/games/index.ts";
import { simulate, STAGES } from "../src/testing/sim.ts";
import { Gfx } from "../src/gfx/draw.ts";
import { C } from "../src/gfx/palette.ts";
import type { Lang } from "../src/core/types.ts";
import { tr } from "../src/core/i18n.ts";

const q = new URLSearchParams(location.search);
const ids = (q.get("ids") ?? "").split(",").filter(Boolean);
const stage = STAGES.find((s) => s.name === (q.get("stage") ?? "landscape")) ?? STAGES[0];
const level = Number(q.get("level") ?? 0.5);
const bot = (q.get("bot") ?? "win") as "win" | "lose" | "idle";
const seed = Number(q.get("seed") ?? 1);
const lang = (q.get("lang") ?? "en") as Lang;
const times = (q.get("times") ?? "0.6,1.8,end").split(",");
const cellW = Number(q.get("cell") ?? 360);
const touch = q.get("touch") === "1";

const list = (ids.length ? ENTRIES.filter((e) => ids.includes(e.def.id)) : ENTRIES).sort((a, b) => a.def.num - b.def.num);
const root = document.getElementById("gallery")!;
if (times.length === 1) root.classList.add("grid");
const scale = cellW / stage.w;
const cellH = Math.round(stage.h * scale);
const errors: string[] = [];

for (const e of list) {
  const row = document.createElement("section");
  row.className = "row";
  const head = document.createElement("h2");
  row.appendChild(head);
  const cells = document.createElement("div");
  cells.className = "cells";
  row.appendChild(cells);
  root.appendChild(row);

  const canvases = times.map((t) => {
    const fig = document.createElement("figure");
    const cv = document.createElement("canvas");
    cv.width = cellW * 2;
    cv.height = cellH * 2;
    cv.style.width = `${cellW}px`;
    cv.style.height = `${cellH}px`;
    const cap = document.createElement("figcaption");
    cap.textContent = `t=${t}`;
    fig.append(cv, cap);
    cells.appendChild(fig);
    return { t, cv, cap, done: false };
  });

  const snap = (c: (typeof canvases)[number], r: Parameters<NonNullable<Parameters<typeof simulate>[1]["onFrame"]>>[0]) => {
    const ctx = c.cv.getContext("2d")!;
    ctx.setTransform(scale * 2, 0, 0, scale * 2, 0, 0);
    const g = new Gfx(ctx, stage.w, stage.h);
    g.time = r.clock;
    g.clear(C.ink);
    r.draw(g);
    // instrução (como no jogo) no primeiro quadro
    if (r.clock < 0.9) {
      g.text(tr(r.verb, lang), stage.w / 2, stage.h * 0.42, { size: 150, color: C.paper, stroke: C.ink, lw: 30 });
    }
    c.cap.textContent = `t=${r.time.toFixed(2)}s ${r.result ?? ""}`;
    c.done = true;
  };

  const res = simulate(e, {
    w: stage.w,
    h: stage.h,
    level,
    seed,
    bot,
    lang,
    touch,
    onFrame: (r) => {
      for (const c of canvases) {
        if (c.done || c.t === "end") continue;
        if (r.clock >= Number(c.t)) snap(c, r);
      }
      if (r.finished || r.phase === "done") for (const c of canvases) if (!c.done && c.t === "end") snap(c, r);
    },
  });
  for (const c of canvases) if (!c.done) c.cap.textContent += " (não chegou)";
  if (res.error) errors.push(`${e.def.id}: ${String(res.error)}`);
  head.textContent = `#${String(e.def.num).padStart(3, "0")} ${e.def.id} — ${tr(e.def.verb, lang)} — bot ${bot}: ${res.result ?? "?"} em ${res.at.toFixed(2)}s / ${res.duration}s${res.error ? " ERRO " + String(res.error) : ""}`;
}

document.body.dataset.done = "true";
(window as unknown as { galleryErrors: string[] }).galleryErrors = errors;
