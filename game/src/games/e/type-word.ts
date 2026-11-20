// 086 · TYPE! — uma palavrinha de escritório/programação. Digite no teclado ou toque nas teclas grandes, na ordem.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { type Rect, inRect } from "../../kit/choices.ts";
import { mem } from "../../testing/botkit.ts";
import { card, fitText, isPortrait } from "./util.ts";

interface Key extends Rect {
  ch: string;
  used: boolean;
  bounce: number;
}
interface S {
  word: string;
  typed: number;
  keys: Key[];
  wrong: string;
  wrongKey: Key | null;
  t: number;
  endT: number;
}

const WORDS: Record<"en" | "pt", string[][]> = {
  en: [
    ["GIT", "BUG", "RAM", "CPU", "API", "APP", "LAG", "WEB"],
    ["CODE", "SUDO", "PING", "BOSS", "WIFI", "LOOP", "PUSH", "MEME"],
    ["MERGE", "CACHE", "EMAIL", "PIXEL", "DEBUG", "LUNCH", "CLOUD", "LOGIN"],
    ["DEPLOY", "COFFEE", "SERVER", "ROUTER", "LAPTOP", "REBOOT", "HOTFIX", "BACKUP"],
  ],
  pt: [
    ["PIX", "BUG", "GIT", "RAM", "CPU", "APP", "ZAP", "LAG"],
    ["CAFE", "PING", "WIFI", "SUDO", "LOOP", "BUGS", "CHAT", "MEME"],
    ["CHEFE", "NUVEM", "EMAIL", "CACHE", "MERGE", "PRAZO", "PAUSA", "SENHA"],
    ["DEPLOY", "BACKUP", "REBOOT", "LAPTOP", "HOTFIX", "CODIGO", "TECLAR", "BOLETO"],
  ],
};

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const tier = lv < 0.3 ? 0 : lv < 0.8 ? 1 : lv < 1.2 ? 2 : 3;
  const word = rng.pick(WORDS[api.lang][tier]);
  const nExtra = lv < 0.3 ? 2 : lv < 0.8 ? 3 : 4;
  const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((c) => !word.includes(c));
  const extras = rng.shuffle(pool).slice(0, nExtra);
  const letters = rng.shuffle([...word.split(""), ...extras]);
  const count = letters.length;

  const cols = portrait ? Math.min(count, 4) : count <= 8 ? count : 5;
  const rows = Math.ceil(count / cols);
  const gap = 24;
  const areaW = w - 140;
  const ts = Math.min(portrait ? 200 : 190, (areaW - gap * (cols - 1)) / cols);
  const top = portrait ? h * 0.5 : rows > 1 ? h * 0.5 : h * 0.6;
  const keys: Key[] = letters.map((ch, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, count - r * cols);
    const rowW = inRow * ts + (inRow - 1) * gap;
    return { x: (w - rowW) / 2 + c * (ts + gap), y: top + r * (ts + gap), w: ts, h: ts, ch, used: false, bounce: 0 };
  });

  const s: S = { word, typed: 0, keys, wrong: "", wrongKey: null, t: 0, endT: 0 };

  const enter = (ch: string, key: Key | null) => {
    const need = s.word[s.typed];
    if (ch === need) {
      const k = key ?? s.keys.find((q) => !q.used && q.ch === ch) ?? null;
      if (k) {
        k.used = true;
        k.bounce = 0.2;
      }
      s.typed++;
      api.sfx("click");
      if (s.typed >= s.word.length) {
        api.sfx("chime");
        api.fx.burst(w / 2, portrait ? h * 0.26 : h * 0.27, C.green, 24);
        api.win();
      }
    } else {
      s.wrong = ch;
      s.wrongKey = key ?? s.keys.find((q) => q.ch === ch) ?? null;
      api.sfx("buzz");
      api.fx.shake(0.5);
      api.lose();
    }
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const k of s.keys) k.bounce = Math.max(0, k.bounce - dt);
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed) {
        for (const k of s.keys) {
          if (!k.used && inRect(inp.x, inp.y, k, 8)) {
            enter(k.ch, k);
            break;
          }
        }
      }
      for (const ch of inp.typed) {
        if (api.result) break;
        enter(ch, null);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.yellow);
      for (let x = 0; x < w; x += 110) g.line(x, 0, x + 300, h, "#ffd466", 30);
      // tela do notebook
      const sw = portrait ? w - 120 : Math.min(1100, w - 300);
      const sh = portrait ? h * 0.28 : h * 0.36;
      const sx = (w - sw) / 2;
      const sy = portrait ? h * 0.16 : h * 0.1;
      card(g, sx - 24, sy - 24, sw + 48, sh + 48, C.ink2, 30, 7);
      g.rect(sx, sy, sw, sh, api.result === "lose" ? "#3a1420" : "#14213d", { r: 10, lw: 4 });
      g.text(api.t({ en: "type:", pt: "digite:" }), sx + 34, sy + 50, { size: 40, font: "mono", align: "left", color: "#7fd3ff" });
      const n = s.word.length;
      const slot = Math.min(130, (sw - 80) / n);
      const wx = w / 2 - (slot * n) / 2;
      const wy = sy + sh * 0.6;
      for (let i = 0; i < n; i++) {
        const cx = wx + slot * (i + 0.5);
        const done = i < s.typed;
        const cur = i === s.typed && !api.result;
        g.text(s.word[i], cx, wy, { size: slot * 0.95, font: "mono", weight: 800, color: done ? C.green : cur ? C.white : "#5d6b94" });
        g.line(cx - slot * 0.36, wy + slot * 0.6, cx + slot * 0.36, wy + slot * 0.6, done ? C.green : cur ? C.yellow : "#5d6b94", 8);
      }
      if (api.result === "lose") {
        fitText(g, api.t({ en: `TYPO: "${s.wrong}"`, pt: `ERROU: "${s.wrong}"` }), w / 2, sy + sh - 30, sw - 40, { size: 52, font: "mono", weight: 800, color: C.red });
      } else if (api.result === "win") {
        g.text("✓ OK", w / 2, sy + sh - 34, { size: 52, font: "mono", weight: 800, color: C.green });
      }
      // teclas
      for (const k of s.keys) {
        const isWrong = s.wrongKey === k && api.result === "lose";
        const fly = k.used ? Math.min(1, 1 - k.bounce / 0.2) : 0;
        if (k.used && fly >= 1) {
          g.rect(k.x + 6, k.y + 18, k.w - 12, k.h - 18, "#c9b98a", { r: 20, stroke: null });
          continue;
        }
        const dy = k.used ? 12 : 0;
        g.rect(k.x + 6, k.y + 18, k.w - 12, k.h - 12, C.ink, { r: 24, stroke: null });
        g.rect(k.x, k.y + dy, k.w, k.h - 10, isWrong ? C.red : C.paper, { r: 24 });
        g.rect(k.x + 14, k.y + dy + 10, k.w - 28, k.h - 44, isWrong ? "#ff6b6b" : C.white, { r: 18, stroke: null });
        g.text(k.ch, k.x + k.w / 2, k.y + dy + k.h * 0.44, { size: k.w * 0.56, font: "mono", weight: 800, color: C.ink });
      }
    },
  };
}

export const typeWord: Entry<S> = {
  def: {
    id: "type-word",
    num: 86,
    name: { en: "Type It", pt: "Digita" },
    verb: { en: "TYPE!", pt: "DIGITA!" },
    hint: { pointer: "tap", keys: "type" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A short tech/office word (3 to 6 letters) on a laptop. Type it on a physical keyboard, or tap the big shuffled key tiles in order (with 2 to 4 extra letters as decoys).",
    winText: "Type the whole word in order.",
    loseText: "Type a wrong letter, or time runs out.",
    timeScale: 1.4,
    minTime: 3.8,
    bg: BG.yellow,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ wait: 0.25 }));
          m.wait -= dt;
          if (m.wait > 0) return;
          m.wait = 0.12;
          const ch = s.word[s.typed];
          if (io.touch) {
            const k = s.keys.find((q) => !q.used && q.ch === ch);
            if (k) io.tap(k.x + k.w / 2, k.y + k.h / 2);
          } else io.press(`Key${ch}`, ch.toLowerCase());
        },
        lose(s, api, io) {
          if (api.result || io.isDown || api.time < 0.3) return;
          const k = s.keys.find((q) => !s.word.includes(q.ch));
          if (k) io.tap(k.x + k.w / 2, k.y + k.h / 2);
        },
      }
    : null,
};
