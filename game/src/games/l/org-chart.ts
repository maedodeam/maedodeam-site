// 180 · WHO'S THE BOSS? — um organograma pequeno (4 a 7 caixinhas com nomes). A pergunta pede "o chefe da Ana" ou, nos
// níveis altos, "o chefe do chefe do Bob". Toque a caixa certa. Depois a árvore cresce e a pessoa citada deixa de ser destacada.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { card, fitText, inBox, isPortrait } from "./util.ts";

interface Node {
  name: string;
  art: string;
  parent: number;
  depth: number;
  kids: number[];
  x: number;
  y: number;
  shirt: string;
  hair: string;
}
interface S {
  nodes: Node[];
  asked: number;
  steps: number;
  answer: number;
  picked: number;
  bw: number;
  bh: number;
  highlight: boolean;
  qy: number;
  t: number;
}

const NAMES: [string, string][] = [
  ["ANA", "DA"],
  ["BOB", "DO"],
  ["CAIO", "DO"],
  ["DANI", "DA"],
  ["EVA", "DA"],
  ["GIL", "DO"],
  ["HUGO", "DO"],
  ["IVO", "DO"],
  ["JU", "DA"],
  ["LEO", "DO"],
  ["MIA", "DA"],
  ["NINA", "DA"],
  ["OTTO", "DO"],
  ["PIA", "DA"],
  ["RUI", "DO"],
  ["TINA", "DA"],
  ["ZECA", "DO"],
  ["LIA", "DA"],
];
const SHIRTS = [C.blue, C.green, C.orange, C.purple, C.pink, C.teal, C.yellow];
const HAIRS = [C.ink2, C.brown, C.yellow, C.gray2, C.orange];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const n = lv < 0.5 ? rng.int(4, 5) : lv < 1 ? rng.int(5, 6) : rng.int(6, 7);
  const names = rng.shuffle(NAMES).slice(0, n);
  const nodes: Node[] = [];
  const add = (parent: number) => {
    const i = nodes.length;
    const depth = parent < 0 ? 0 : nodes[parent].depth + 1;
    nodes.push({ name: names[i][0], art: names[i][1], parent, depth, kids: [], x: 0, y: 0, shirt: SHIRTS[i % SHIRTS.length], hair: rng.pick(HAIRS) });
    if (parent >= 0) nodes[parent].kids.push(i);
  };
  add(-1);
  add(0);
  add(1); // garante uma cadeia de 3 níveis
  while (nodes.length < n) {
    const opts = nodes.map((_, i) => i).filter((i) => nodes[i].depth <= 2 && nodes[i].kids.length < 3);
    add(rng.pick(opts));
  }
  // pergunta: 1 ou 2 passos para cima
  const twoStep = lv >= 0.5 && rng.chance(lv >= 1 ? 0.7 : 0.5);
  let asked: number;
  if (twoStep) asked = rng.pick(nodes.map((_, i) => i).filter((i) => nodes[i].depth >= 2));
  else {
    const deep = nodes.map((_, i) => i).filter((i) => nodes[i].depth >= 2);
    asked = deep.length && rng.chance(0.7) ? rng.pick(deep) : rng.int(1, n - 1);
  }
  const steps = twoStep ? 2 : 1;
  const answer = twoStep ? nodes[nodes[asked].parent].parent : nodes[asked].parent;

  // layout: folhas em ordem, pais no meio dos filhos
  let slot = 0;
  const place = (i: number) => {
    const nd = nodes[i];
    if (!nd.kids.length) nd.x = slot++;
    else {
      for (const k of nd.kids) place(k);
      nd.x = (nodes[nd.kids[0]].x + nodes[nd.kids[nd.kids.length - 1]].x) / 2;
    }
  };
  place(0);
  const leaves = slot;
  const maxDepth = Math.max(...nodes.map((nd) => nd.depth));
  const qy = portrait ? 230 : 110;
  const top = portrait ? 440 : 270;
  const bottom = portrait ? h - 160 : h - 110;
  const margin = 70;
  const colW = (w - margin * 2) / Math.max(1, leaves);
  const bw = Math.min(280, colW - 26);
  const narrow = bw < 230;
  const bh = portrait ? (narrow ? 175 : 150) : narrow ? 132 : 124;
  const rowH = maxDepth > 0 ? (bottom - top - bh) / maxDepth : 0;
  for (const nd of nodes) {
    nd.x = margin + colW * (nd.x + 0.5);
    nd.y = top + nd.depth * Math.min(rowH, portrait ? 330 : 240) + bh / 2;
  }

  const s: S = { nodes, asked, steps, answer, picked: -1, bw, bh, highlight: lv < 1, qy, t: 0 };
  const a = nodes[asked];
  const verb =
    steps === 1 ? { en: `${a.name}'S BOSS`, pt: `CHEFE ${a.art} ${a.name}` } : { en: `${a.name}'S BOSS'S BOSS`, pt: `CHEFE DO CHEFE ${a.art} ${a.name}` };

  return {
    s,
    verb,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      const inp = api.input;
      if (!inp.pressed) return;
      const i = s.nodes.findIndex((nd) => inBox(inp.x, inp.y, nd.x - s.bw / 2, nd.y - s.bh / 2, s.bw, s.bh, 16));
      if (i < 0) return;
      s.picked = i;
      api.sfx("click");
      const nd = s.nodes[i];
      if (i === s.answer) {
        api.sfx("chime");
        api.fx.burst(nd.x, nd.y, C.yellow, 18);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      // parede com quadro de cortiça
      g.rect(30, s.qy + 80, w - 60, h - s.qy - 120, "#d7a06a", { r: 24, lw: 8 });
      // linhas do organograma
      for (const nd of s.nodes) {
        if (nd.parent < 0) continue;
        const p = s.nodes[nd.parent];
        const midY = (p.y + s.bh / 2 + nd.y - s.bh / 2) / 2;
        g.polyline(
          [
            { x: p.x, y: p.y + s.bh / 2 },
            { x: p.x, y: midY },
            { x: nd.x, y: midY },
            { x: nd.x, y: nd.y - s.bh / 2 },
          ],
          C.ink,
          8,
        );
      }
      // caixinhas
      for (let i = 0; i < s.nodes.length; i++) {
        const nd = s.nodes[i];
        const x = nd.x - s.bw / 2;
        const y = nd.y - s.bh / 2;
        let fill: string = C.white;
        if (api.result && i === s.answer) fill = C.green2;
        else if (api.result === "lose" && i === s.picked) fill = C.red;
        else if (s.highlight && i === s.asked) fill = C.yellow2;
        card(g, x, y, s.bw, s.bh, fill, 20, 6, 10);
        // avatar
        const narrow = s.bw < 230;
        const ar = narrow ? s.bh * 0.2 : Math.min(s.bh * 0.32, s.bw * 0.2);
        const ax = narrow ? nd.x : x + ar + 16;
        const ay = narrow ? y + s.bh * 0.33 : nd.y;
        g.circle(ax, ay + ar * 0.2, ar, nd.shirt, { lw: 5 });
        g.circle(ax, ay - ar * 0.25, ar * 0.72, C.skin, { lw: 5 });
        g.push();
        g.ctx.beginPath();
        g.ctx.arc(ax, ay - ar * 0.25, ar * 0.72, Math.PI, Math.PI * 2);
        g.ctx.fillStyle = nd.hair;
        g.ctx.fill();
        g.pop();
        g.face(ax, ay - ar * 0.18, ar * 1.05, api.result && i === s.answer ? "happy" : "neutral");
        if (narrow) fitText(g, nd.name, nd.x, y + s.bh * 0.78, s.bw - 24, { size: 40, font: "display" });
        else fitText(g, nd.name, x + (s.bw + ar * 2 + 16) / 2, nd.y + 4, s.bw - ar * 2 - 40, { size: 46, font: "display" });
        if (nd.depth === 0) g.text("★", nd.x + s.bw / 2 - 18, y + 22, { size: 34, color: C.orange });
      }
      // pergunta
      const a = s.nodes[s.asked];
      const q =
        s.steps === 1
          ? api.t({ en: `WHO IS ${a.name}'S BOSS?`, pt: `QUEM É O CHEFE ${a.art} ${a.name}?` })
          : api.t({ en: `WHO IS ${a.name}'S BOSS'S BOSS?`, pt: `QUEM É O CHEFE DO CHEFE ${a.art} ${a.name}?` });
      card(g, 60, s.qy - 60, w - 120, 120, C.ink2, 24, 6, 10);
      fitText(g, q, w / 2, s.qy + 2, w - 180, { size: portrait ? 64 : 70, color: C.yellow });
      if (api.result === "win") g.text(api.t({ en: "PROMOTED!", pt: "PROMOVIDO!" }), w / 2, h - 60, { size: 80, color: C.green, stroke: C.ink, lw: 12 });
      if (api.result === "lose") g.text(api.t({ en: "AWKWARD…", pt: "QUE GAFE…" }), w / 2, h - 60, { size: 80, color: C.red, stroke: C.ink, lw: 12 });
    },
  };
}

export const orgChart: Entry<S> = {
  def: {
    id: "org-chart",
    num: 180,
    name: { en: "Org Chart", pt: "Organograma" },
    verb: { en: "WHO'S THE BOSS?", pt: "QUEM É O CHEFE?" },
    hint: { pointer: "tap" },
    category: "logic",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A small org chart of 4 to 7 named boxes. The question asks for someone's boss (ANA'S BOSS) or, later, the boss's boss (BOB'S BOSS'S BOSS). Follow the lines up and tap the right box. Later the tree grows and the named person is no longer highlighted.",
    winText: "Tap the right boss.",
    loseText: "Tap anyone else, or time runs out.",
    timeScale: 1.3,
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time <= 0 || io.isDown) return;
          const nd = s.nodes[s.answer];
          io.tap(nd.x, nd.y);
        },
        lose(s, api, io) {
          // Toca a própria pessoa citada, em vez do chefe dela.
          if (api.result || api.time <= 0 || io.isDown) return;
          const nd = s.nodes[s.asked];
          io.tap(nd.x, nd.y);
        },
      }
    : null,
};
