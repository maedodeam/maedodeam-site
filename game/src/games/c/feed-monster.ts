// 055 · FEED! — a impressora-monstro abre e fecha a boca. Arraste as folhas para dentro quando ela estiver aberta.
// Nos níveis altos há um grampeador no meio das folhas: dar o grampeador causa um engasgo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { paper, stapler } from "../../gfx/art.ts";
import { DragGroup, makeItem, returnHome, type DragItem } from "../../kit/drag.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

interface Item extends DragItem {
  stapler: boolean;
  eaten: number; // >0: animação de ser engolida
  crumple: number; // >0: amassada, voltando
  rot: number;
}
interface S {
  items: Item[];
  drag: DragGroup<Item>;
  isOpen: boolean;
  timer: number;
  jaw: number; // 0 fechada .. 1 aberta (animação)
  openR: [number, number];
  closedR: [number, number];
  fed: number;
  need: number;
  jam: boolean;
  chomp: number;
  px: number; // centro da impressora
  py: number;
  pw: number;
  mouth: { x: number; y: number; hw: number; hh: number };
  clock: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const need = lv < 0.75 ? 3 : 4;
  const hasStapler = lv >= 1;
  const pw = portrait ? 560 : Math.min(560, w * 0.36);
  const px = portrait ? w / 2 : w * 0.68;
  const py = portrait ? h * 0.3 : h * 0.5;
  const items: Item[] = [];
  const total = need + (hasStapler ? 1 : 0);
  const staplerIdx = hasStapler ? rng.int(0, total - 1) : -1;
  for (let i = 0; i < total; i++) {
    let x: number;
    let y: number;
    if (portrait) {
      const cols = total > 3 ? 3 : total;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const inRow = Math.min(cols, total - r * cols);
      x = w / 2 + (c - (inRow - 1) / 2) * 290 + rng.range(-20, 20);
      y = h * 0.68 + r * 290 + rng.range(-20, 20);
    } else {
      const c = i % 2;
      const r = Math.floor(i / 2);
      const rows = Math.ceil(total / 2);
      x = w * 0.13 + c * Math.min(270, w * 0.2) + rng.range(-20, 20) + (r % 2) * 40;
      y = h / 2 + (r - (rows - 1) / 2) * 270 + rng.range(-15, 15);
    }
    items.push({ ...makeItem(x, y, 100), stapler: i === staplerIdx, eaten: 0, crumple: 0, rot: rng.range(-0.15, 0.15) });
  }
  const s: S = {
    items,
    drag: new DragGroup(items),
    isOpen: false,
    timer: 0.35,
    jaw: 0,
    openR: [mix(0.9, 0.6, p), mix(1.3, 0.9, p)],
    closedR: [mix(0.35, 0.45, p), mix(0.6, 0.8, p)],
    fed: 0,
    need,
    jam: false,
    chomp: 0,
    px,
    py,
    pw,
    mouth: { x: px, y: py + pw * 0.16, hw: pw * 0.36, hh: pw * 0.17 },
    clock: 0,
  };
  s.drag.bounds = { minX: 70, minY: 70, maxX: w - 70, maxY: h - 70 };

  const inMouth = (it: Item) => Math.abs(it.x - s.mouth.x) < s.mouth.hw + 40 && Math.abs(it.y - s.mouth.y) < s.mouth.hh + 60;

  return {
    s,
    update(dt) {
      s.clock += dt;
      if (!s.jam) {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.isOpen = !s.isOpen;
          const r = s.isOpen ? s.openR : s.closedR;
          s.timer = rng.range(r[0], r[1]);
          if (!s.isOpen) api.sfx("click");
        }
      }
      s.jaw += ((s.isOpen && !s.jam ? 1 : s.jam ? 0.5 : 0) - s.jaw) * Math.min(1, dt * 22);
      s.chomp = Math.max(0, s.chomp - dt * 3);
      for (const it of s.items) {
        if (it.eaten > 0) it.eaten = Math.min(1, it.eaten + dt * 3.5);
        it.crumple = Math.max(0, it.crumple - dt * 1.6);
        if (it.eaten === 0) returnHome(it, dt, it.crumple > 0 ? 6 : 12);
      }
      if (api.result) {
        s.drag.release();
        return;
      }
      const ev = s.drag.update(api.input);
      if (ev.picked) api.sfx("tap");
      const d = ev.dropped;
      if (d && inMouth(d)) {
        if (s.isOpen) {
          d.enabled = false;
          d.eaten = 0.01;
          d.homeX = s.mouth.x;
          d.homeY = s.mouth.y;
          s.chomp = 1;
          if (d.stapler) {
            s.jam = true;
            api.sfx("buzz");
            api.fx.shake(0.8);
            api.fx.pop(s.mouth.x, s.mouth.y - 200, api.t({ en: "PAPER JAM!", pt: "ATOLOU!" }), C.red);
            api.lose();
          } else {
            s.fed++;
            api.sfx("pop");
            api.fx.pop(s.mouth.x, s.mouth.y - 160, "NOM", C.white);
            if (s.fed >= s.need) {
              api.sfx("chime");
              api.fx.burst(s.px, s.py, C.yellow, 24);
              api.win();
            }
          }
        } else {
          // boca fechada: amassa e volta
          d.crumple = 1;
          api.sfx(d.stapler ? "thud" : "squeak");
          api.fx.shake(0.2);
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const { px, py, pw } = s;
      const ph = pw * 0.9;
      // mesa
      g.rect(-10, py + ph * 0.45, w + 20, h, C.brown2, { lw: 7 });
      // impressora-monstro (com a bandeja de entrada atrás)
      g.shape(px, py - ph / 2, [-pw * 0.36, 10, -pw * 0.3, -ph * 0.28, pw * 0.3, -ph * 0.28, pw * 0.36, 10], C.gray);
      g.rect(px - pw * 0.24, py - ph / 2 - ph * 0.24, pw * 0.48, ph * 0.18, C.white, { r: 4, lw: 5 });
      g.rect(px - pw / 2 + 12, py - ph / 2 + 16, pw, ph, C.ink, { r: 40, stroke: null });
      g.rect(px - pw / 2, py - ph / 2, pw, ph, s.jam ? C.gray : C.paper2, { r: 40 });
      // olhos e sobrancelhas
      const mood = s.jam ? "dizzy" : api.result === "win" ? "happy" : s.isOpen ? "shock" : "angry";
      g.face(px, py - ph * 0.26, pw * 0.5, mood === "shock" ? "neutral" : mood, { x: -0.6, y: 0.3 });
      // painel
      g.rect(px + pw * 0.22, py - ph * 0.44, pw * 0.22, ph * 0.12, C.ink2, { r: 8, lw: 5 });
      g.circle(px + pw * 0.28, py - ph * 0.38, 9, s.jam ? C.red : C.green, { stroke: null });
      // boca (bandeja) com dentes
      const m = s.mouth;
      const open = s.jaw;
      const mh = m.hh * 2 * (0.12 + 0.88 * open);
      g.rect(m.x - m.hw, m.y - mh / 2, m.hw * 2, mh, C.ink2, { r: 18 });
      if (open > 0.3) g.ellipse(m.x, m.y + mh * 0.25, m.hw * 0.5, mh * 0.22, C.pink, { lw: 5 });
      const teeth = 6;
      for (let i = 0; i < teeth; i++) {
        const tx = m.x - m.hw + (i + 0.5) * ((m.hw * 2) / teeth);
        const tw = (m.hw * 2) / teeth / 2 - 4;
        g.shape(tx, m.y - mh / 2, [-tw, -4, tw, -4, 0, 30], C.white, { lw: 4 });
        g.shape(tx, m.y + mh / 2, [-tw, 4, tw, 4, 0, -30], C.white, { lw: 4 });
      }
      // dica de abertura
      if (!api.result) {
        const label = s.isOpen ? api.t({ en: "OPEN!", pt: "ABERTA!" }) : api.t({ en: "WAIT…", pt: "ESPERA…" });
        g.text(label, m.x, m.y + m.hh + 70, { size: 54, color: s.isOpen ? C.green : C.red, stroke: C.ink, lw: 10 });
      }
      if (s.jam) {
        for (let i = 0; i < 4; i++) {
          const t = (s.clock * 0.8 + i * 0.25) % 1;
          g.push();
          g.alpha(1 - t);
          g.circle(px - pw * 0.3 + i * 60, py - ph / 2 - t * 200, 30 + t * 40, C.gray, { lw: 4 });
          g.pop();
        }
      }
      if (api.result === "win") {
        // imprime um desenho feliz
        const up = Math.min(1, (1 - s.chomp) * 1.4);
        paper(g, px + pw * 0.3, py - ph / 2 - 40 - 90 * up, 140, 170, 0.15, C.white, 0);
        g.face(px + pw * 0.3, py - ph / 2 - 40 - 90 * up, 90, "happy");
      }
      // folhas e grampeador
      for (const it of s.items) {
        if (it.eaten >= 1) continue;
        g.push();
        g.translate(it.x, it.y);
        const sc = (it.held ? 1.1 : 1) * (1 - it.eaten);
        g.scale(Math.max(0.01, sc));
        if (it.held) g.shadow(10, 120, 70);
        if (it.stapler) stapler(g, 0, 0, 2.2, it.rot);
        else if (it.crumple > 0.3) {
          g.circle(0, 0, 70, C.white, { lw: 6 });
          g.line(-40, -20, 30, 10, C.gray, 5);
          g.line(-20, 30, 35, -30, C.gray, 5);
        } else paper(g, 0, 0, 150, 190, it.rot + (it.held ? 0.1 : 0), C.white, 5);
        g.pop();
      }
      // contador
      g.text(`${s.fed}/${s.need}`, portrait ? w - 120 : 140, 90, { size: 64, font: "mono", color: C.ink });
    },
  };
}

export const feedMonster: Entry<S> = {
  def: {
    id: "feed-monster",
    num: 55,
    name: { en: "Feed the Printer", pt: "Alimenta a Impressora" },
    verb: { en: "FEED!", pt: "ALIMENTA!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "The printer monster opens and closes its paper tray mouth on an irregular rhythm. Drag the sheets into it while it's open; a sheet dropped on a closed mouth crumples and comes back. On harder levels a stapler hides among the sheets: don't feed it.",
    winText: "Feed every sheet to the printer.",
    loseText: "Feed it the stapler (paper jam!), or time runs out.",
    timeScale: 1.45,
    minTime: 4,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ phase: "pick" as "pick" | "move" | "wait", item: null as Item | null }));
          const mouth = s.mouth;
          if (m.phase === "pick") {
            const it = s.items.find((q) => !q.stapler && q.enabled && q.eaten === 0 && q.crumple < 0.3);
            if (!it) return;
            io.move(it.x, it.y);
            io.down(it.x, it.y);
            m.item = it;
            m.phase = "move";
            return;
          }
          if (m.phase === "move") {
            const dx = mouth.x - io.px;
            const dy = mouth.y - io.py;
            const d = Math.hypot(dx, dy);
            const st = 3200 * dt;
            if (d <= st) {
              io.move(mouth.x, mouth.y);
              m.phase = "wait";
            } else io.move(io.px + (dx / d) * st, io.py + (dy / d) * st);
            return;
          }
          // espera a boca abrir (com folga para não fechar na hora)
          if (s.isOpen && s.timer > 0.08) {
            io.up(mouth.x, mouth.y);
            m.phase = "pick";
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const st = s.items.find((q) => q.stapler);
          if (!st) return; // sem grampeador: perde pelo tempo
          const m = mem(s, () => ({ phase: "pick" as "pick" | "move" | "wait" }));
          const mouth = s.mouth;
          if (m.phase === "pick") {
            io.move(st.x, st.y);
            io.down(st.x, st.y);
            m.phase = "move";
          } else if (m.phase === "move") {
            const dx = mouth.x - io.px;
            const dy = mouth.y - io.py;
            const d = Math.hypot(dx, dy);
            const k = 3200 * dt;
            if (d <= k) {
              io.move(mouth.x, mouth.y);
              m.phase = "wait";
            } else io.move(io.px + (dx / d) * k, io.py + (dy / d) * k);
          } else if (s.isOpen && s.timer > 0.08) {
            io.up(mouth.x, mouth.y);
            m.phase = "pick";
          }
        },
      }
    : null,
};
