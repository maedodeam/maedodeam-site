// 291 · LET THE BOSS WIN! — WTF: pedra, papel e tesoura contra o chefe convencido, num palco de programa de auditório
// psicodélico. Ele mostra a mão primeiro; escolha o gesto que PERDE para ele. Ganhar ou empatar = demitido.
// 1 rodada no começo, 2 a partir de 0,5 e 3 a partir de 1,1 (e aí os cartões trocam de lugar a cada rodada).
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { boss } from "../../gfx/art.ts";
import { Choices } from "../../kit/choices.ts";
import { psyBackdrop, psyColor, psyWash, wobbleText } from "../../gfx/wtf.ts";
import { fitText, isPortrait } from "./util.ts";

/** 0 = pedra, 1 = papel, 2 = tesoura. O gesto g vence (g + 2) % 3. */
type Gesture = 0 | 1 | 2;
const NAMES = [
  { en: "ROCK", pt: "PEDRA" },
  { en: "PAPER", pt: "PAPEL" },
  { en: "SCISSORS", pt: "TESOURA" },
];
const beatenBy = (g: Gesture): Gesture => ((g + 2) % 3) as Gesture;

interface S {
  rounds: number;
  round: number;
  bossHand: Gesture;
  /** Gesto em cada cartão. */
  cards: Gesture[];
  choices: Choices;
  /** Índice do cartão certo nesta rodada. */
  answer: number;
  phase: "pick" | "cheer" | "end";
  phaseT: number;
  picked: Gesture | null;
  shuffle: boolean;
  t: number;
  endT: number;
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const area = portrait ? { x: 50, y: h * 0.64, w: w - 100, h: h * 0.26 } : { x: w * 0.12, y: h * 0.67, w: w * 0.76, h: h * 0.29 };
  const makeChoices = (): Choices => new Choices(api, 3, { area, maxCols: 3 });
  const s: S = {
    rounds: lv < 0.5 ? 1 : lv < 1.1 ? 2 : 3,
    round: 0,
    bossHand: 0,
    cards: [0, 1, 2],
    choices: makeChoices(),
    answer: 0,
    phase: "pick",
    phaseT: 0,
    picked: null,
    shuffle: lv >= 1.1,
    t: 0,
    endT: 0,
  };
  const deal = () => {
    let g = rng.int(0, 2) as Gesture;
    if (s.round > 0 && g === s.bossHand) g = ((g + 1) % 3) as Gesture;
    s.bossHand = g;
    s.cards = s.shuffle ? (rng.shuffle([0, 1, 2]) as Gesture[]) : [0, 1, 2];
    s.answer = s.cards.indexOf(beatenBy(g));
    s.choices = makeChoices();
    s.phase = "pick";
    s.phaseT = 0;
  };
  deal();

  // posições da cena
  const bossX = portrait ? w * 0.3 : w * 0.36;
  const bossY = portrait ? h * 0.5 : h * 0.61;
  const bossS = portrait ? 1.45 : 1.3;
  const handX = portrait ? w * 0.72 : w * 0.6;
  const handY = portrait ? h * 0.31 : h * 0.37;
  const handR = portrait ? 170 : 140;

  return {
    s,
    update(dt) {
      s.t += dt;
      s.phaseT += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      if (s.phase === "cheer") {
        if (s.phaseT > 0.5) {
          s.round++;
          deal();
          api.sfx("boing");
        }
        return;
      }
      const i = s.choices.update();
      if (i === null) return;
      const g = s.cards[i];
      s.picked = g;
      const c = s.choices.center(i);
      if (i === s.answer) {
        api.sfx("kazoo");
        api.fx.pop(handX, handY - 200, api.t({ en: "BOSS WINS!", pt: "CHEFE GANHOU!" }), C.yellow);
        if (s.round + 1 >= s.rounds) {
          s.phase = "end";
          api.sfx("tada");
          api.fx.burst(w / 2, h * 0.3, C.yellow, 30);
          api.fx.burst(c.x, c.y, C.pink, 20);
          api.win();
        } else {
          s.phase = "cheer";
          s.phaseT = 0;
        }
      } else {
        api.sfx("glitch");
        api.fx.shake(0.8);
        const tie = g === s.bossHand;
        api.fx.pop(c.x, c.y - 60, tie ? api.t({ en: "A TIE?!", pt: "EMPATE?!" }) : api.t({ en: "YOU BEAT HIM?!", pt: "VOCÊ GANHOU?!" }), C.red);
        api.lose();
      }
    },
    draw(g: Gfx) {
      const t = s.t;
      psyBackdrop(g, t, 0.5, w / 2, portrait ? h * 0.3 : h * 0.35);
      // palco do programa de auditório
      const floorY = bossY + 10;
      g.rect(-10, floorY, w + 20, h - floorY + 10, C.purple, { lw: 7 });
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * w;
        g.circle(x, floorY + 24, 10, psyColor(t, i * 40, 100, 70), { lw: 3 });
      }
      // letreiro
      const signY = portrait ? h * 0.07 : h * 0.08;
      wobbleText(g, api.t({ en: "ROCK · PAPER · BOSS", pt: "PEDRA · PAPEL · CHEFE" }), w / 2, signY, t, { size: portrait ? 70 : 76, stroke: C.ink, lw: 12 }, 10);
      // rodadas
      for (let r = 0; r < s.rounds; r++) {
        const done = r < s.round || (r === s.round && (s.phase !== "pick" || api.result === "win"));
        g.star(60 + r * 70, h - 50, 28, 13, 5, done ? C.yellow : C.white, { lw: 5 });
      }
      // o chefe
      const cheering = s.phase !== "pick" || api.result === "win";
      const lost = api.result === "lose";
      const jump = cheering ? Math.abs(Math.sin(s.phaseT * 12)) * 30 : 0;
      boss(g, bossX, bossY - jump, bossS, { mood: lost ? "angry" : cheering ? "happy" : "smug", look: { x: 0.6, y: 0.2 } });
      // braço até a mão mostrada
      g.line(bossX + 40 * bossS, bossY - 110 * bossS - jump, handX - 40, handY + 90, C.ink2, 34);
      // holofote e a mão do chefe (nítida, contorno forte)
      g.circle(handX, handY, handR, C.white, { lw: 10 });
      g.circle(handX, handY, handR, null, { stroke: psyColor(t, 90, 100, 50), lw: 8 });
      const pump = s.phase === "pick" && s.phaseT < 0.25 ? Math.sin((s.phaseT / 0.25) * Math.PI) * 18 : 0;
      drawHand(g, handX, handY + 10 - pump, handR / 110, s.bossHand, C.skin, C.ink2);
      if (portrait) fitText(g, api.t(NAMES[s.bossHand]), handX, handY + handR + 44, 360, { size: 58, color: C.white, stroke: C.ink, lw: 12 });
      else fitText(g, api.t(NAMES[s.bossHand]), handX + handR + 24, handY, w - handX - handR - 60, { size: 70, color: C.white, stroke: C.ink, lw: 14, align: "left" });
      // cartões
      s.choices.draw(
        g,
        (i, r) => {
          const ge = s.cards[i];
          const k = Math.min(r.h / 330, r.w / 260);
          drawHand(g, r.x + r.w / 2, r.y + r.h * 0.42, k, ge, C.skin, C.blue);
          fitText(g, api.t(NAMES[ge]), r.x + r.w / 2, r.y + r.h * 0.86, r.w * 0.85, { size: Math.min(52, r.h * 0.16), color: C.ink });
        },
        api.result ? s.answer : undefined,
      );
      if (s.phase === "cheer") psyWash(g, t, 0.12);
      // selo de "promoção" na vitória
      if (api.result === "win") {
        const k = Math.min(1, s.endT * 4);
        g.push();
        g.translate(w / 2, portrait ? h * 0.42 : h * 0.4);
        g.rotate(-0.15);
        g.scale(0.4 + k * 0.6);
        g.star(0, 0, 210, 160, 14, C.yellow, { lw: 9 });
        g.text(api.t({ en: "PROMOTED!", pt: "PROMOVIDO!" }), 0, 0, { size: 64, color: C.red, stroke: C.white, lw: 10 });
        g.pop();
      }
      if (lost) {
        g.text(api.t({ en: "FIRED!", pt: "DEMITIDO!" }), w / 2, portrait ? h * 0.42 : h * 0.45, { size: 130, color: C.red, stroke: C.ink, lw: 18 });
      }
    },
  };
}

/** Mão de frente, dedos para cima. (x, y) = centro da palma. */
function drawHand(g: Gfx, x: number, y: number, k: number, ge: Gesture, skin: string, cuff: string): void {
  g.push();
  g.translate(x, y);
  g.scale(k);
  g.rect(-62, 70, 124, 50, cuff, { r: 10, lw: 6 });
  if (ge === 1) {
    // papel: mão aberta
    const fingers = [
      [-46, -8, 0.22],
      [-20, -28, 0.06],
      [8, -30, -0.04],
      [34, -20, -0.16],
    ] as const;
    for (const [fx, fy, rot] of fingers) {
      g.push();
      g.translate(fx, fy);
      g.rotate(rot);
      g.rect(-13, -78, 26, 96, skin, { r: 13, lw: 6 });
      g.pop();
    }
    g.ellipse(-64, 30, 18, 40, skin, { rot: -0.8, lw: 6 });
    g.rect(-58, -20, 112, 100, skin, { r: 30, lw: 6 });
  } else {
    if (ge === 2) {
      // tesoura: dois dedos em V
      for (const [fx, rot] of [
        [-12, -0.3],
        [16, 0.3],
      ] as const) {
        g.push();
        g.translate(fx, -10);
        g.rotate(rot);
        g.rect(-13, -96, 26, 106, skin, { r: 13, lw: 6 });
        g.pop();
      }
    }
    // punho
    g.rect(-58, -24, 116, 104, skin, { r: 34, lw: 6 });
    const curled = ge === 2 ? 2 : 4;
    for (let i = 0; i < curled; i++) {
      const fx = ge === 2 ? 10 + i * 24 : -36 + i * 24;
      g.rect(fx - 12, -30, 24, 38, skin, { r: 12, lw: 5 });
    }
    g.ellipse(-56, 26, 16, 32, skin, { rot: -0.4, lw: 5 });
  }
  g.pop();
}

export const letBossWin: Entry<S> = {
  def: {
    id: "let-boss-win",
    num: 291,
    name: { en: "Let the Boss Win", pt: "Deixa o Chefe Ganhar" },
    verb: { en: "LET THE BOSS WIN!", pt: "DEIXA O CHEFE GANHAR!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "logic",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    wtf: "normal",
    mechanic:
      "WTF Moment: rock-paper-scissors against a smug boss on a psychedelic game-show stage. He shows his hand first; pick the gesture that LOSES to it. Winning or tying gets you fired. One round at first, 2 from level 0.5, 3 later with the cards reshuffled every round.",
    winText: "Pick the gesture that loses to the boss's hand, every round.",
    loseText: "Beat the boss, tie with him, or run out of time.",
    timeScale: 1.5,
    minTime: 4,
    bg: BG.purple,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || s.phase !== "pick" || s.phaseT < 0.25 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || s.phase !== "pick" || s.phaseT < 0.25 || io.isDown) return;
          // instinto: escolhe o gesto que GANHA dele
          const winner = (s.bossHand + 1) % 3;
          const c = s.choices.center(s.cards.indexOf(winner as Gesture));
          io.tap(c.x, c.y);
        },
      }
    : null,
};
