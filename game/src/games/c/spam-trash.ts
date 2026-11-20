// 057 · DELETE SPAM! — caixa de entrada com e-mails. Arraste só os spams (marcados com alerta) para a lixeira.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { trashcan } from "../../gfx/art.ts";
import { planDrag, stepDrag, mem, type DragPlan } from "../../testing/botkit.ts";
import { prog } from "./util.ts";

interface Card {
  x: number; // centro
  y: number;
  homeX: number;
  homeY: number;
  spam: boolean;
  text: number;
  gone: number; // >0: sendo jogado na lixeira
  held: boolean;
  shake: number;
}
interface S {
  cards: Card[];
  cw: number;
  ch: number;
  trash: { x: number; y: number };
  holding: Card | null;
  offX: number;
  offY: number;
  trashed: number;
  spams: number;
  wrong: Card | null;
  lid: number;
  win: { x: number; y: number; w: number; h: number };
  clock: number;
}

const SPAM = {
  en: [
    ["YOU WON A FREE YACHT!!!", "prize@w1nner.biz"],
    ["A prince needs your help", "royal@prince.lol"],
    ["Hot singles in your spreadsheet", "x@hot.xls"],
    ["Claim your 1,000,000 coupons", "deals@deals.deals"],
    ["URGENT: your cat owes taxes", "irs@cat-tax.ru"],
    ["Your PC has 9,999 viruses!!", "tech@supp0rt.zip"],
    ["Lose 10 kg by replying", "fit@now.now"],
  ],
  pt: [
    ["VOCÊ GANHOU UM IATE!!!", "premio@ganhe.biz"],
    ["Príncipe precisa da sua ajuda", "real@principe.lol"],
    ["Herança do tio que você não tem", "tio@heranca.xyz"],
    ["Fique rico clicando aqui", "rico@agora.agora"],
    ["URGENTE: seu gato deve impostos", "receita@gato.ru"],
    ["Seu PC tem 9.999 vírus!!", "suporte@virus.zip"],
    ["Emagreça 10 kg respondendo", "fit@ja.ja"],
  ],
};
const LEGIT = {
  en: [
    ["Meeting at 3 PM", "Boss"],
    ["Your payslip is ready", "HR"],
    ["Lunch on Friday?", "Ana"],
    ["Q3 report draft", "Finance"],
    ["Badge renewal", "Security"],
    ["Call me back", "Mom"],
  ],
  pt: [
    ["Reunião às 15h", "Chefe"],
    ["Seu holerite chegou", "RH"],
    ["Almoço na sexta?", "Ana"],
    ["Rascunho do relatório", "Financeiro"],
    ["Renovação do crachá", "Segurança"],
    ["Me liga quando puder", "Mãe"],
  ],
};
const AVATAR = [C.blue, C.green, C.purple, C.teal, C.orange, C.pink];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const portrait = h > w;
  const n = Math.round(4 + 2 * p);
  const spams = lv < 0.5 ? 2 : 3;
  const kinds = rng.shuffle(Array.from({ length: n }, (_, i) => i < spams));
  const spamTexts = rng.shuffle(SPAM.en.map((_, i) => i));
  const legitTexts = rng.shuffle(LEGIT.en.map((_, i) => i));
  // layout: janela da caixa de entrada + lixeira
  let cols: number;
  let win: S["win"];
  let trash: S["trash"];
  if (portrait) {
    cols = 1;
    win = { x: 60, y: 90, w: w - 120, h: h - 560 };
    trash = { x: w / 2, y: h - 130 };
  } else if (w > 1400) {
    cols = 2;
    win = { x: 60, y: 70, w: w - 520, h: h - 140 };
    trash = { x: w - 230, y: h * 0.62 };
  } else {
    cols = 1;
    win = { x: 50, y: 60, w: w - 380, h: h - 120 };
    trash = { x: w - 170, y: h * 0.62 };
  }
  const rows = Math.ceil(n / cols);
  const gap = 20;
  const top = win.y + 90;
  const cw = (win.w - 40 - gap * (cols - 1)) / cols;
  const ch = Math.min(portrait ? 190 : 170, (win.y + win.h - 20 - top - gap * (rows - 1)) / rows);
  let si = 0;
  let li = 0;
  const cards: Card[] = kinds.map((spam, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = win.x + 20 + c * (cw + gap) + cw / 2;
    const y = top + r * (ch + gap) + ch / 2;
    return { x, y, homeX: x, homeY: y, spam, text: spam ? spamTexts[si++] : legitTexts[li++], gone: 0, held: false, shake: 0 };
  });
  const s: S = { cards, cw, ch, trash, holding: null, offX: 0, offY: 0, trashed: 0, spams, wrong: null, lid: 0, win, clock: 0 };

  const overTrash = (c: Card) => Math.abs(c.x - s.trash.x) < 190 && Math.abs(c.y - (s.trash.y - 90)) < 200;

  return {
    s,
    update(dt) {
      s.clock += dt;
      s.lid = Math.max(0, s.lid - dt * 3);
      for (const c of s.cards) {
        c.shake = Math.max(0, c.shake - dt * 2.5);
        if (c.gone > 0) {
          c.gone = Math.min(1, c.gone + dt * 4);
          c.x += (s.trash.x - c.x) * Math.min(1, dt * 14);
          c.y += (s.trash.y - 80 - c.y) * Math.min(1, dt * 14);
        } else if (!c.held) {
          const k = 1 - Math.exp(-12 * dt);
          c.x += (c.homeX - c.x) * k;
          c.y += (c.homeY - c.y) * k;
        }
      }
      if (api.result) {
        if (s.holding) s.holding.held = false;
        s.holding = null;
        return;
      }
      const inp = api.input;
      if (inp.pressed && !s.holding) {
        for (let i = s.cards.length - 1; i >= 0; i--) {
          const c = s.cards[i];
          if (c.gone > 0) continue;
          if (Math.abs(inp.x - c.x) <= s.cw / 2 && Math.abs(inp.y - c.y) <= s.ch / 2 + 8) {
            s.holding = c;
            c.held = true;
            s.offX = c.x - inp.x;
            s.offY = c.y - inp.y;
            s.cards.splice(i, 1);
            s.cards.push(c);
            api.sfx("tap");
            break;
          }
        }
      }
      const c = s.holding;
      if (c) {
        c.x = Math.max(60, Math.min(w - 60, inp.x + s.offX));
        c.y = Math.max(60, Math.min(h - 60, inp.y + s.offY));
        if (!inp.down || inp.released) {
          c.held = false;
          s.holding = null;
          if (overTrash(c)) {
            c.gone = 0.01;
            s.lid = 1;
            if (c.spam) {
              s.trashed++;
              api.sfx("swoosh");
              if (s.trashed >= s.spams) {
                api.sfx("chime");
                api.fx.burst(s.trash.x, s.trash.y - 160, C.green, 22);
                api.win();
              }
            } else {
              s.wrong = c;
              api.sfx("buzz");
              api.fx.shake(0.5);
              api.fx.pop(s.trash.x, s.trash.y - 300, api.t({ en: "NOT SPAM!", pt: "NÃO ERA SPAM!" }), C.red);
              api.lose();
            }
          }
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      const L = api.lang;
      const wn = s.win;
      // janela do e-mail
      g.rect(wn.x + 12, wn.y + 16, wn.w, wn.h, C.ink, { r: 24, stroke: null });
      g.rect(wn.x, wn.y, wn.w, wn.h, C.paper, { r: 24 });
      g.rect(wn.x, wn.y, wn.w, 70, C.ink2, { r: 24 });
      g.rect(wn.x, wn.y + 40, wn.w, 30, C.ink2, { stroke: null });
      for (let i = 0; i < 3; i++) g.circle(wn.x + 40 + i * 40, wn.y + 35, 12, [C.red, C.yellow, C.green][i], { lw: 3 });
      const left = s.spams - s.trashed;
      g.text(api.t({ en: "INBOX", pt: "ENTRADA" }) + `  ·  ${left} spam`, wn.x + wn.w / 2, wn.y + 36, { size: 36, font: "mono", color: C.paper, maxWidth: wn.w - 200 });
      // lixeira
      const tr = s.trash;
      g.push();
      g.translate(tr.x, tr.y);
      g.rotate(Math.sin(s.clock * 40) * 0.06 * s.lid);
      trashcan(g, 0, 0, 2.1, s.wrong ? C.red : C.gray2);
      g.pop();
      const dragging = s.holding !== null;
      if (dragging && !api.result) {
        g.rect(tr.x - 170, tr.y - 290, 340, 330, null, { r: 30, stroke: C.yellow, lw: 8 });
      }
      // cartões
      for (const c of s.cards) {
        if (c.gone >= 1) continue;
        const sx = Math.sin(s.clock * 60) * 14 * c.shake;
        g.push();
        g.translate(c.x + sx, c.y);
        const k = (c.held ? 1.04 : 1) * (1 - c.gone * 0.8);
        g.scale(k);
        if (c.gone > 0) g.rotate(c.gone * 2);
        const cw = s.cw;
        const ch = s.ch;
        if (c.held) g.rect(-cw / 2 + 10, -ch / 2 + 14, cw, ch, "rgba(0,0,0,0.25)", { r: 18, stroke: null });
        g.rect(-cw / 2, -ch / 2, cw, ch, c.spam ? C.yellow2 : C.white, { r: 18, lw: 6 });
        const [subject, sender] = c.spam ? SPAM[L][c.text] : LEGIT[L][c.text];
        const ix = -cw / 2 + ch * 0.5;
        const ir = Math.min(ch * 0.32, 48);
        if (c.spam) {
          g.shape(ix, 0, [0, -ir * 1.1, ir * 1.1, ir * 0.9, -ir * 1.1, ir * 0.9], C.red, { lw: 6 });
          g.text("!", ix, ir * 0.2, { size: ir * 1.3, color: C.white });
        } else {
          g.circle(ix, 0, ir, AVATAR[c.text % AVATAR.length], { lw: 6 });
          g.text(sender[0], ix, 3, { size: ir * 1.1, color: C.white });
        }
        const tx = ix + ir + 24;
        const maxW = cw / 2 - tx - 20;
        g.text(subject, tx, -ch * 0.12, { size: Math.min(38, ch * 0.28), font: "body", weight: 800, color: c.spam ? C.red : C.ink, align: "left", maxWidth: maxW });
        g.text(sender, tx, ch * 0.24, { size: Math.min(28, ch * 0.2), font: "mono", color: C.gray2, align: "left", maxWidth: maxW });
        g.pop();
      }
    },
  };
}

export const spamTrash: Entry<S> = {
  def: {
    id: "spam-trash",
    num: 57,
    name: { en: "Spam Filter", pt: "Filtro de Spam" },
    verb: { en: "DELETE SPAM!", pt: "APAGA O SPAM!" },
    hint: { pointer: "drag" },
    category: "drag",
    family: "drag",
    goal: "complete",
    difficulty: 2,
    mechanic: "An inbox with 4 to 6 emails. Two or three are obvious spam ('YOU WON A FREE YACHT', a prince who needs help), marked with a red alert icon; the rest are real (your payslip, a meeting). Drag only the spam into the trash.",
    winText: "Every spam email is in the trash.",
    loseText: "Trash a real email, or time runs out.",
    timeScale: 1.4,
    minTime: 3.6,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const c = s.cards.find((q) => q.spam && q.gone === 0);
            if (!c) return;
            m.plan = planDrag({ x: c.x, y: c.y }, { x: s.trash.x, y: s.trash.y - 90 }, 3800);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.1) return;
          const m = mem<{ plan: DragPlan | null }>(s, () => ({ plan: null }));
          if (!m.plan) {
            const c = s.cards.find((q) => !q.spam && q.gone === 0)!;
            m.plan = planDrag({ x: c.x, y: c.y }, { x: s.trash.x, y: s.trash.y - 90 }, 3800);
          }
          if (stepDrag(io, m.plan, dt)) m.plan = null;
        },
      }
    : null,
};
