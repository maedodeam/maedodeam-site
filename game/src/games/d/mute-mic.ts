// 075 · MUTE! — videochamada da firma; no SEU quadro, o cachorro late (ou a criança grita). Ache o seu quadro e
// toque no SEU microfone. Mutar outra pessoa = derrota (e se for o chefe…).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person, boss } from "../../gfx/art.ts";
import { pill } from "./util.ts";

interface Tile {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  shirt: string;
  hair: string;
  name: string;
  isBoss: boolean;
  mx: number;
  my: number;
  mr: number;
  muted: boolean;
}
interface S {
  tiles: Tile[];
  me: number;
  chaos: "dog" | "kid";
  wrong: number;
  t: number;
  shame: number;
}

const NAMES = ["Bia", "Caio", "Dani", "Edu", "Fer", "Gabi", "Hugo", "Iris", "Leo", "Nina", "Otto", "Rui"];
const BGS = [C.sky, C.green2, C.pink2, C.yellow2, C.purple2, C.blue2, C.orange2, C.paper2, "#b9f0d0"];
const SHIRTS = [C.blue, C.red, C.green, C.purple, C.teal, C.orange, C.pink, C.yellow];

function micIcon(g: Gfx, x: number, y: number, r: number, muted: boolean): void {
  g.circle(x + 4, y + 6, r, C.ink, { stroke: null });
  g.circle(x, y, r, muted ? C.red : C.white, { lw: 6 });
  const c = muted ? C.white : C.ink;
  g.rect(x - r * 0.2, y - r * 0.55, r * 0.4, r * 0.7, c, { r: r * 0.2, stroke: null });
  g.arc(x, y - r * 0.12, r * 0.36, 0.1 * Math.PI, 0.9 * Math.PI, c, 5);
  g.line(x, y + r * 0.25, x, y + r * 0.45, c, 5);
  if (muted) g.line(x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5, C.white, 8);
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const n = lv < 0.4 ? 4 : lv < 0.9 ? 6 : 9;
  const cols = n === 4 ? 2 : n === 6 ? (portrait ? 2 : 3) : 3;
  const rows = n / cols;
  const top = portrait ? 230 : 150;
  const area = { x: 50, y: top, w: w - 100, h: h - top - 50 };
  const gap = 20;
  const tw = (area.w - gap * (cols - 1)) / cols;
  const th = (area.h - gap * (rows - 1)) / rows;
  const names = rng.shuffle(NAMES);
  const bgs = rng.shuffle(BGS);
  const me = rng.int(0, n - 1);
  let bossAt = rng.int(0, n - 1);
  if (bossAt === me) bossAt = (bossAt + 1) % n;
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    const x = area.x + (i % cols) * (tw + gap);
    const y = area.y + Math.floor(i / cols) * (th + gap);
    const mr = Math.max(62, Math.min(80, Math.min(tw, th) * 0.17));
    tiles.push({
      x,
      y,
      w: tw,
      h: th,
      bg: bgs[i % bgs.length],
      shirt: rng.pick(SHIRTS),
      hair: rng.pick([C.ink2, C.brown, C.yellow, C.gray2, C.orange]),
      name: names[i],
      isBoss: i === bossAt,
      mx: x + tw - mr - 18,
      my: y + th - mr - 18,
      mr,
      muted: rng.chance(0.3) && i !== me && i !== bossAt,
    });
  }
  const s: S = { tiles, me, chaos: rng.chance(0.5) ? "dog" : "kid", wrong: -1, t: 0, shame: 0 };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) return;
      s.shame = Math.min(1, api.time / api.duration);
      if (Math.floor(s.t * 3) !== Math.floor((s.t - dt) * 3)) api.sfx(s.chaos === "dog" ? "squeak" : "buzz");
      const inp = api.input;
      if (!inp.pressed) return;
      for (let i = 0; i < s.tiles.length; i++) {
        const t = s.tiles[i];
        if (Math.hypot(inp.x - t.mx, inp.y - t.my) > Math.max(t.mr * 1.25, 75)) continue;
        if (i === s.me) {
          t.muted = true;
          api.sfx("click");
          api.fx.burst(t.mx, t.my, C.green, 14);
          api.win();
        } else {
          s.wrong = i;
          t.muted = true;
          api.sfx("buzz");
          api.fx.shake(0.5);
          api.lose();
        }
        return;
      }
    },
    draw(g: Gfx) {
      g.clear(BG.dark);
      // barra de vergonha
      const bw = Math.min(w - 120, 900);
      const bx = (w - bw) / 2;
      const by = portrait ? 110 : 60;
      g.text(api.t({ en: "CRINGE", pt: "VERGONHA" }), bx, by - 2, { size: 46, align: "left", color: C.paper });
      const lw = g.textWidth(api.t({ en: "CRINGE", pt: "VERGONHA" }), { size: 46 }) + 24;
      g.rect(bx + lw, by - 24, bw - lw, 48, C.ink2, { r: 24, stroke: C.paper, lw: 4 });
      g.rect(bx + lw + 6, by - 18, Math.max(0, (bw - lw - 12) * s.shame), 36, s.shame > 0.7 ? C.red : C.orange, { r: 18, stroke: null });
      const noisy = !api.result || api.result === "lose";
      for (let i = 0; i < s.tiles.length; i++) {
        const t = s.tiles[i];
        const mine = i === s.me;
        g.push();
        g.clip(t.x, t.y, t.w, t.h, 18);
        g.rect(t.x, t.y, t.w, t.h, t.bg, { stroke: null });
        // estante ao fundo
        g.rect(t.x + t.w * 0.08, t.y + t.h * 0.18, t.w * 0.3, t.h * 0.06, C.brown2, { lw: 4 });
        g.rect(t.x + t.w * 0.12, t.y + t.h * 0.06, t.w * 0.06, t.h * 0.12, C.red, { lw: 3 });
        g.rect(t.x + t.w * 0.2, t.y + t.h * 0.08, t.w * 0.06, t.h * 0.1, C.blue, { lw: 3 });
        const sc = Math.min(t.h / 250, t.w / 260);
        const px = t.x + t.w * (mine ? 0.36 : 0.45);
        const py = t.y + t.h + 70 * sc;
        const shakeX = mine && noisy ? Math.sin(s.t * 40) * 3 : 0;
        if (t.isBoss) boss(g, px, py, sc, { mood: s.wrong === i ? "angry" : "neutral" });
        else
          person(g, px + shakeX, py, sc, {
            shirt: t.shirt,
            hair: t.hair,
            tie: null,
            mood: mine ? (api.result === "win" ? "happy" : "shock") : s.wrong >= 0 ? "shock" : rng01(i) > 0.5 ? "sleep" : "neutral",
            glasses: i % 3 === 0,
          });
        if (mine) {
          const cx = t.x + t.w * 0.72;
          const k = Math.min(1, Math.min(t.w, t.h) / 260);
          const cy = t.y + Math.min(t.h * 0.58, t.h - t.mr * 2 - 70 * k);
          const jump = noisy ? Math.abs(Math.sin(s.t * 10)) * 18 * k : 0;
          if (s.chaos === "dog") {
            // cachorro
            g.ellipse(cx, cy + 40 * k - jump, 62 * k, 44 * k, C.brown2);
            g.circle(cx + 46 * k, cy - 6 * k - jump, 38 * k, C.brown2);
            g.ellipse(cx + 26 * k, cy - 24 * k - jump, 12 * k, 26 * k, C.brown, { rot: 0.4 });
            g.ellipse(cx + 70 * k, cy - 24 * k - jump, 12 * k, 26 * k, C.brown, { rot: -0.4 });
            g.face(cx + 46 * k, cy - 2 * k - jump, 52 * k, noisy ? "shock" : "happy");
          } else {
            person(g, cx, t.y + t.h + 10 * k - jump, k * 0.62, { shirt: C.yellow, tie: null, hair: C.orange, mood: noisy ? "shock" : "sleep" });
          }
          if (noisy) {
            for (let r = 0; r < 3; r++) {
              const rr = ((s.t * 1.6 + r / 3) % 1) * 90 * k + 30 * k;
              g.arc(cx + 50 * k, cy - 10 * k, rr, -0.9, -0.1, C.ink, 6);
            }
            const word = s.chaos === "dog" ? api.t({ en: "WOOF!", pt: "AU AU!" }) : api.t({ en: "AAAH!", pt: "MANHÊÊ!" });
            g.text(word, cx, t.y + t.h * 0.18, { size: Math.min(60, t.w * 0.2), color: C.red, stroke: C.ink, lw: 8, maxWidth: t.w * 0.5 });
          }
        }
        g.pop();
        // moldura (verde = falando)
        const talking = mine && noisy && Math.floor(s.t * 8) % 2 === 0;
        g.rect(t.x, t.y, t.w, t.h, null, { r: 18, stroke: talking ? C.green : mine ? C.orange : C.ink, lw: talking || mine ? 12 : 7 });
        // nome
        const label = mine ? api.t({ en: "YOU", pt: "VOCÊ" }) : t.isBoss ? api.t({ en: "BOSS", pt: "CHEFE" }) : t.name;
        g.push();
        const lx = t.x + 24 + g.textWidth(label, { size: 44 }) / 2 + 18;
        pill(g, label, lx, t.y + t.h - 46, 44, mine ? C.orange : C.paper, mine ? C.white : C.ink);
        g.pop();
        micIcon(g, t.mx, t.my, t.mr, t.muted);
      }
      if (s.wrong >= 0) {
        const t = s.tiles[s.wrong];
        const txt = t.isBoss ? api.t({ en: "You muted the boss!", pt: "Você mutou o chefe!" }) : api.t({ en: "Wrong mic!", pt: "Mic errado!" });
        g.text(txt, w / 2, h / 2, { size: 80, color: C.white, stroke: C.ink, lw: 14, maxWidth: w - 100 });
      }
    },
  };
}

/** Pseudoaleatório fixo por índice (só para variar o desenho sem mexer no estado). */
function rng01(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export const muteMic: Entry<S> = {
  def: {
    id: "mute-mic",
    num: 75,
    name: { en: "You're on Mute", pt: "Tá no Mudo?" },
    verb: { en: "MUTE!", pt: "MUDO!" },
    hint: { pointer: "tap" },
    category: "office",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "A video call grid with 4 to 9 people. In your own tile (marked YOU) a dog is barking or a kid is screaming while the cringe meter fills. Tap the mic button in YOUR tile; every tile has one.",
    winText: "Mute your own mic.",
    loseText: "Mute someone else's mic (maybe the boss), or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.dark,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const t = s.tiles[s.me];
          io.tap(t.mx, t.my);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const t = s.tiles[(s.me + 1) % s.tiles.length];
          io.tap(t.mx, t.my);
        },
      }
    : null,
};
