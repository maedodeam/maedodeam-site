// 228 · PRESS ANY KEY! — WTF: "aperte qualquer tecla"… num teclado gigante e psicodélico de teclas absurdas
// (BANANA, TALVEZ, PÂNICO, ¯\_(ツ)_/¯…). Só uma diz literalmente ANY / QUALQUER: toque nela.
// Num teclado de verdade, qualquer tecla real também vale (ela É qualquer tecla).
// Níveis altos: teclas-pegadinha parecidas (MANY, QUASE) a partir de 0,5, mais teclas e (lv ≥ 1) teclas trocando de lugar.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { psyBackdrop, psyColor, wobbleText } from "../../gfx/wtf.ts";
import { isPortrait, fit, ease, lerp } from "./util.ts";

interface Key {
  label: Text;
  any: boolean;
  /** Largura em casas (rótulos compridos ocupam duas). */
  span: 1 | 2;
  /** Casa atual na grade e animação de troca. */
  slot: number;
  from: number;
  k: number;
  fill: string;
}
interface S {
  keys: Key[];
  slots: { x: number; y: number }[];
  cw: number;
  kh: number;
  nextSwap: number;
  swapEvery: number;
  wrong: number;
  pressedKey: number;
  t: number;
  endT: number;
}

const SILLY: Text[] = [
  { en: "ESC", pt: "ESC" },
  { en: "BANANA", pt: "BANANA" },
  { en: "MAYBE", pt: "TALVEZ" },
  { en: "¯\\_(ツ)_/¯", pt: "¯\\_(ツ)_/¯" },
  { en: "HELP", pt: "SOCORRO" },
  { en: "NOPE", pt: "NÃO" },
  { en: "PANIC", pt: "PÂNICO" },
  { en: "LATER", pt: "DEPOIS" },
  { en: "OOPS", pt: "OPS" },
  { en: "MEH", pt: "TANTO FAZ" },
  { en: "WHY?", pt: "POR QUÊ?" },
  { en: "SNACK", pt: "LANCHE" },
  { en: "NAP", pt: "SONECA" },
  { en: "404", pt: "404" },
  { en: "WOW", pt: "UAU" },
  { en: "BOSS", pt: "CHEFE" },
  { en: "HMM", pt: "HUMM" },
  { en: "UNDO", pt: "DESFAZ" },
  { en: "☕", pt: "☕" },
  { en: "YES?", pt: "SIM?" },
];
/** Pegadinhas parecidas com a tecla certa (só a partir do nível 0,5). */
const NEAR: Text[] = [
  { en: "MANY", pt: "QUASE" },
  { en: "ANT", pt: "QUAL?" },
  { en: "ALL", pt: "TODAS" },
];
const CAPS = [C.yellow2, C.pink2, C.green2, C.blue2, C.purple2, C.orange2, C.white];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const wide = w >= 1300;
  const count = lv < 0.5 ? 12 : lv < 1 ? 15 : 18;
  const cols = portrait || !wide ? 3 : 6;
  const ax = 60;
  const ay = portrait ? 300 : 210;
  const aw = w - 120;
  const ah = h - ay - (portrait ? 140 : 60);
  const cw = aw / cols;
  const maxRows = Math.max(3, Math.floor(ah / 165));
  const labels: Text[] = [];
  if (lv >= 0.5) labels.push(...rng.shuffle(NEAR).slice(0, lv >= 1 ? 3 : 2));
  labels.push(...rng.shuffle(SILLY).slice(0, count - 1 - labels.length));
  // Rótulos compridos (no idioma atual) ganham tecla dupla, como Shift/Enter num teclado de verdade.
  const spanOf = (t: Text): 1 | 2 => ([...api.t(t)].length > 6 ? 2 : 1);
  const keys: Key[] = rng.shuffle([{ en: "ANY", pt: "QUALQUER" } as Text, ...labels]).map((label) => ({
    label,
    any: label.en === "ANY",
    span: spanOf(label),
    slot: 0,
    from: 0,
    k: 1,
    fill: rng.pick(CAPS),
  }));
  // Empacota as teclas em fileiras; se não couber, tira teclas bobas (as largas primeiro).
  const pack = (list: Key[]): Key[][] => {
    const wides = list.filter((k) => k.span === 2);
    const singles = list.filter((k) => k.span === 1);
    const est = Math.max(1, Math.ceil((wides.length * 2 + singles.length) / cols));
    const perRow = Math.max(1, Math.ceil(wides.length / est));
    const rows: Key[][] = [];
    while (wides.length || singles.length) {
      const row: Key[] = [];
      let room = cols;
      let nw = 0;
      // espalha as teclas largas pelas fileiras e completa com as simples
      while (room >= 2 && wides.length && nw < perRow) {
        row.push(wides.shift()!);
        room -= 2;
        nw++;
      }
      while (room >= 1 && singles.length) {
        row.push(singles.shift()!);
        room--;
      }
      while (room >= 2 && wides.length) {
        row.push(wides.shift()!);
        room -= 2;
      }
      rows.push(rng.shuffle(row));
    }
    return rng.shuffle(rows);
  };
  let rowsOf = pack(keys);
  while (rowsOf.length > maxRows) {
    const silly = (k: Key) => !k.any && !NEAR.includes(k.label);
    let j = keys.findIndex((k) => silly(k) && k.span === 2);
    if (j < 0) j = keys.findIndex(silly);
    keys.splice(j, 1);
    rowsOf = pack(keys);
  }
  const ch = Math.min(260, ah / rowsOf.length);
  const y0 = ay + (ah - ch * rowsOf.length) / 2;
  const slots: { x: number; y: number }[] = [];
  rowsOf.forEach((row, r) => {
    const used = row.reduce((a, k) => a + k.span, 0);
    let x = ax + (aw - used * cw) / 2;
    for (const k of row) {
      k.slot = k.from = slots.length;
      slots.push({ x: x + (k.span * cw) / 2, y: y0 + r * ch + ch / 2 });
      x += k.span * cw;
    }
  });
  const s: S = {
    keys,
    slots,
    cw,
    kh: ch - 24,
    nextSwap: 1.0,
    swapEvery: lv >= 1 ? 1.15 - (lv - 1) * 0.4 : Infinity,
    wrong: -1,
    pressedKey: -1,
    t: 0,
    endT: 0,
  };

  const posOf = (k: Key) => {
    const a = s.slots[k.from];
    const b = s.slots[k.slot];
    const e = ease(k.k);
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
  };
  const hit = (x: number, y: number) => {
    for (let i = 0; i < s.keys.length; i++) {
      const p = posOf(s.keys[i]);
      if (Math.abs(x - p.x) <= kwOf(s, s.keys[i]) / 2 + 8 && Math.abs(y - p.y) <= s.kh / 2 + 8) return i;
    }
    return -1;
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      // teclado de verdade: qualquer tecla real é "qualquer tecla"
      const realKey =
        inp.typed !== "" ||
        inp.digit !== null ||
        inp.keyPressed("action") ||
        inp.keyPressed("left") ||
        inp.keyPressed("right") ||
        inp.keyPressed("up") ||
        inp.keyPressed("down");
      let picked = -1;
      if (realKey) picked = s.keys.findIndex((k) => k.any);
      else if (inp.pressed) picked = hit(inp.x, inp.y);
      if (picked >= 0) {
        s.pressedKey = picked;
        const k = s.keys[picked];
        const p = posOf(k);
        if (k.any) {
          api.sfx("tada");
          api.fx.burst(p.x, p.y, C.yellow, 24);
          api.fx.burst(p.x, p.y, C.pink, 16);
          api.win();
        } else {
          s.wrong = picked;
          api.sfx("kazoo");
          api.fx.shake(0.5);
          api.fx.pop(p.x, p.y - s.kh / 2 - 30, api.t(k.label), C.red);
          api.lose();
        }
        return;
      }
      // troca de lugar (nível ≥ 1)
      for (const k of s.keys) k.k = Math.min(1, k.k + dt / 0.28);
      if (s.t >= s.nextSwap) {
        s.nextSwap = s.t + s.swapEvery;
        const a = s.keys.find((k) => k.any)!;
        const same = s.keys.filter((k) => !k.any && k.span === a.span);
        const b = same.length ? rng.pick(same) : a;
        const sa = a.slot;
        a.from = a.slot;
        b.from = b.slot;
        a.slot = b.slot;
        b.slot = sa;
        a.k = 0;
        b.k = 0;
        api.sfx("boing");
      }
    },
    draw(g: Gfx) {
      const t = g.time;
      psyBackdrop(g, t, 0.5, w / 2, h * 0.15);
      // título ondulando
      const ty = portrait ? 150 : 100;
      if (api.result === "win") wobbleText(g, api.t({ en: "CONTINUING…", pt: "CONTINUANDO…" }), w / 2, ty, t, { size: portrait ? 84 : 90, stroke: C.ink, lw: 12 });
      else wobbleText(g, api.t({ en: "PRESS ANY KEY", pt: "APERTE QUALQUER TECLA" }), w / 2, ty, t, { size: portrait ? 70 : 84, stroke: C.ink, lw: 12 }, 10);
      // corpo do teclado
      const first = s.slots[0];
      const last = s.slots[s.slots.length - 1];
      const bx = 30;
      const by = first.y - s.kh / 2 - 30;
      g.rect(bx + 10, by + 16, w - 60, last.y + s.kh / 2 + 30 - by, C.ink, { r: 40, stroke: null });
      g.rect(bx, by, w - 60, last.y + s.kh / 2 + 30 - by, psyColor(t, 240, 40, 22, 40), { r: 40, lw: 9 });
      for (let i = 0; i < s.keys.length; i++) {
        const k = s.keys[i];
        const p = posOf(k);
        const down = i === s.pressedKey;
        const dy = down ? 10 : 0;
        const kw = kwOf(s, k);
        const kx = p.x - kw / 2;
        const ky = p.y - s.kh / 2;
        g.rect(kx, ky + 14, kw, s.kh, C.ink, { r: 22, stroke: null });
        const fill = i === s.wrong ? C.red : down && k.any ? C.green : k.fill;
        g.rect(kx, ky + dy, kw, s.kh, fill, { r: 22, lw: 8 });
        g.rect(kx + 14, ky + dy + 10, kw - 28, s.kh - 34, null, { r: 16, lw: 3, stroke: C.ink2 });
        drawLabel(g, api.t(k.label), p.x, p.y + dy - 6, kw - 36, s.kh);
      }
      if (api.result === "lose") {
        g.text(api.t({ en: "THAT'S NOT ANY KEY", pt: "ESSA NÃO É QUALQUER" }), w / 2, h - (portrait ? 80 : 36), { size: portrait ? 58 : 64, color: C.white, stroke: C.ink, lw: 12 });
      }
    },
  };
}

function kwOf(s: S, k: Key): number {
  return k.span * s.cw - 18;
}

/** Rótulo da tecla: uma linha grande; se ficar pequeno demais e tiver espaço, quebra em duas linhas. */
function drawLabel(g: Gfx, str: string, x: number, y: number, maxW: number, kh: number): void {
  const o = { size: Math.min(74, kh * 0.44), color: C.ink, font: "display" as const };
  const one = fit(g, str, maxW, o);
  const sp = str.indexOf(" ");
  if (one >= 50 || sp < 0) {
    g.text(str, x, y, { ...o, size: one });
    return;
  }
  const a = str.slice(0, sp);
  const b = str.slice(sp + 1);
  const size = Math.min(o.size * 0.82, fit(g, a, maxW, o), fit(g, b, maxW, o));
  g.text(a, x, y - size * 0.48, { ...o, size });
  g.text(b, x, y + size * 0.52, { ...o, size });
}

export const anyKey: Entry<S> = {
  def: {
    id: "any-key",
    num: 228,
    name: { en: "Any Key", pt: "Qualquer Tecla" },
    verb: { en: "PRESS ANY KEY!", pt: "APERTE QUALQUER TECLA!" },
    hint: { pointer: "tap", keys: "type" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "WTF Moment: a giant psychedelic keyboard full of absurd keys (BANANA, MAYBE, PANIC…). Only one literally says ANY: tap it. On a real keyboard, any real key also counts. Later there are look-alike decoys (MANY, ALL), more keys, and the keys swap places.",
    winText: "Tap the key labeled ANY (or press any real key).",
    loseText: "Tap any other key, or run out of time.",
    timeScale: 1.2,
    minTime: 3.5,
    wtf: "normal",
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const k = s.keys.find((x) => x.any)!;
          // posição atual (inclui a animação de troca)
          const a = s.slots[k.from];
          const b = s.slots[k.slot];
          const e = ease(k.k);
          io.tap(lerp(a.x, b.x, e), lerp(a.y, b.y, e));
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const k = s.keys.find((x) => !x.any && x.k >= 1)!;
          const p = s.slots[k.slot];
          io.tap(p.x, p.y);
        },
      }
    : null,
};
