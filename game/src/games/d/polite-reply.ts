// 078 · REPLY! — chega um e-mail irritante. Três respostas: uma profissional e duas passivo-agressivas (ou absurdas).
// Escolha a profissional.
import type { Entry, MicroAPI, MicroInstance, Text } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { Choices } from "../../kit/choices.ts";
import { envelope } from "../../gfx/art.ts";
import { textBlock, sticker } from "./util.ts";

interface Situation {
  from: Text;
  body: Text;
  /** [profissional, ruim, ruim] */
  replies: [Text, Text, Text];
}

const BOSS = { en: "From: Boss", pt: "De: Chefe" };
const CLIENT = { en: "From: Client", pt: "De: Cliente" };
const COWORKER = { en: "From: Coworker", pt: "De: Colega" };
const HR = { en: "From: HR", pt: "De: RH" };
const ALL = { en: "From: Everyone", pt: "De: Todo mundo" };

export const SITUATIONS: Situation[] = [
  {
    from: BOSS,
    body: { en: "Can you work this Saturday? It's a quick thing.", pt: "Dá pra trabalhar sábado? É rapidinho." },
    replies: [
      { en: "Not this weekend. First thing Monday?", pt: "Sábado não dá. Vejo segunda cedo?" },
      { en: "Sure, I'll just move in here.", pt: "Claro, já trago meu colchão." },
      { en: "Saturday is a myth.", pt: "Sábado é uma lenda urbana." },
    ],
  },
  {
    from: ALL,
    body: { en: "Who heated fish in the microwave??", pt: "Quem esquentou peixe no micro-ondas??" },
    replies: [
      { en: "Wasn't me, but I can put up a sign.", pt: "Não fui eu, mas posso pôr um aviso." },
      { en: "Whoever it was: we know.", pt: "Quem foi: a gente sabe." },
      { en: "Smells like a promotion.", pt: "Cheirinho de promoção." },
    ],
  },
  {
    from: COWORKER,
    body: { en: "Per my last email, did you see my last email?", pt: "Conforme meu último e-mail, viu meu último e-mail?" },
    replies: [
      { en: "Yes, sorry! Full reply today.", pt: "Vi sim, desculpa! Respondo hoje." },
      { en: "Per my last reply: yes.", pt: "Conforme minha última resposta: vi." },
      { en: "I only read emails on Tuesdays.", pt: "Só leio e-mail às terças." },
    ],
  },
  {
    from: CLIENT,
    body: { en: "Can the logo be bigger? And also smaller?", pt: "Dá pra deixar o logo maior? E também menor?" },
    replies: [
      { en: "Sure! I'll send two options today.", pt: "Claro! Mando duas opções hoje." },
      { en: "I made it medium. Happy now?", pt: "Fiz médio. Satisfeito?" },
      { en: "The logo is already the size of the sun.", pt: "O logo já está do tamanho do sol." },
    ],
  },
  {
    from: COWORKER,
    body: { en: "Got 5 minutes for a quick call?", pt: "Tem 5 minutinhos pra uma call rápida?" },
    replies: [
      { en: "Sure, does 3 pm work?", pt: "Tenho, às 15h pode ser?" },
      { en: "Your 5 minutes or real minutes?", pt: "Seus 5 min ou 5 min de verdade?" },
      { en: "I'm in a call about calls.", pt: "Tô numa call sobre calls." },
    ],
  },
  {
    from: HR,
    body: { en: "Reminder: mandatory fun at 6 pm.", pt: "Lembrete: diversão obrigatória às 18h." },
    replies: [
      { en: "Thanks, I'll be there!", pt: "Obrigado, estarei lá!" },
      { en: "Is the fun also unpaid?", pt: "A diversão também é sem hora extra?" },
      { en: "My fun is busy that day.", pt: "Minha diversão tá ocupada nesse dia." },
    ],
  },
  {
    from: BOSS,
    body: { en: "(sent 11:47 PM) Are you awake?", pt: "(enviado 23h47) Tá acordado?" },
    replies: [
      { en: "I'll look at it first thing tomorrow.", pt: "Vejo isso amanhã logo cedo." },
      { en: "No. This is my ghost.", pt: "Não. Aqui é meu fantasma." },
      { en: "zzzz (sent from my pillow)", pt: "zzzz (enviado do travesseiro)" },
    ],
  },
  {
    from: CLIENT,
    body: { en: "Can you send the file again? I lost it.", pt: "Pode mandar o arquivo de novo? Perdi." },
    replies: [
      { en: "Of course, attached again.", pt: "Claro, segue em anexo de novo." },
      { en: "Attached. Again. For the 4th time.", pt: "Segue. De novo. Pela 4ª vez." },
      { en: "The file is in a better place now.", pt: "O arquivo está num lugar melhor." },
    ],
  },
  {
    from: ALL,
    body: { en: "Who ate my yogurt? It had my NAME on it.", pt: "Quem comeu meu iogurte? Tinha meu NOME." },
    replies: [
      { en: "Wasn't me. Hope it turns up!", pt: "Não fui eu. Espero que apareça!" },
      { en: "Your name was delicious.", pt: "Seu nome estava uma delícia." },
      { en: "Yogurts can't own things.", pt: "Iogurte não tem dono." },
    ],
  },
  {
    from: COWORKER,
    body: { en: "The printer is broken. You're IT, right?", pt: "A impressora quebrou. Você é da TI, né?" },
    replies: [
      { en: "I'm not IT, but I'll open a ticket.", pt: "Não sou, mas abro um chamado." },
      { en: "I am the printer now.", pt: "Agora eu sou a impressora." },
      { en: "Have you tried yelling at it?", pt: "Já tentou gritar com ela?" },
    ],
  },
  {
    from: BOSS,
    body: { en: "Let's circle back to synergize our deliverables.", pt: "Vamos alinhar as sinergias dos entregáveis?" },
    replies: [
      { en: "Sounds good. When works for you?", pt: "Vamos. Que horário fica bom?" },
      { en: "Let's square forward instead.", pt: "Vamos desalinhar, pra variar." },
      { en: "My deliverables are allergic.", pt: "Meus entregáveis são alérgicos." },
    ],
  },
  {
    from: COWORKER,
    body: { en: "Your camera is on. We can see your cat.", pt: "Sua câmera está ligada. Dá pra ver o gato." },
    replies: [
      { en: "Oops, thanks for the heads-up!", pt: "Opa, valeu pelo aviso!" },
      { en: "The cat is presenting next.", pt: "O gato apresenta a seguir." },
      { en: "That's not a cat. That's my manager.", pt: "Não é um gato. É meu gerente." },
    ],
  },
  {
    from: COWORKER,
    body: { en: "Can you cover my shift? (again)", pt: "Pode cobrir meu turno? (de novo)" },
    replies: [
      { en: "I can't this time, sorry!", pt: "Dessa vez não consigo, desculpa!" },
      { en: "Sure, I'll cover your whole life.", pt: "Claro, cubro sua vida inteira." },
      { en: "I'd love to, but no.", pt: "Adoraria, mas não." },
    ],
  },
  {
    from: CLIENT,
    body: { en: "URGENT!!! (no details attached)", pt: "URGENTE!!! (sem detalhes)" },
    replies: [
      { en: "Happy to help! What do you need?", pt: "Claro! Do que você precisa?" },
      { en: "Urgently: what?", pt: "Urgentemente: o quê?" },
      { en: "Received your vibes.", pt: "Recebi suas vibrações." },
    ],
  },
  {
    from: ALL,
    body: { en: "We're out of coffee. Who's buying?", pt: "Acabou o café. Quem compra?" },
    replies: [
      { en: "I can order some today.", pt: "Posso pedir hoje mesmo." },
      { en: "Not me, I run on tears.", pt: "Eu não, funciono à base de lágrimas." },
      { en: "Coffee is a social construct.", pt: "Café é uma construção social." },
    ],
  },
  {
    from: HR,
    body: { en: "New password policy: 47 characters minimum.", pt: "Nova política de senha: no mínimo 47 caracteres." },
    replies: [
      { en: "Got it, updating it now.", pt: "Entendido, já estou atualizando." },
      { en: "My password is now 'no'.", pt: "Minha senha agora é 'não'." },
      { en: "Can it be 'password' 6 times?", pt: "Pode ser 'senha123' seis vezes?" },
    ],
  },
];

interface S {
  sit: number;
  order: number[];
  answer: number;
  choices: Choices;
  picked: number;
  t: number;
  card: { x: number; y: number; w: number; h: number };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const portrait = h > w;
  const sit = rng.int(0, SITUATIONS.length - 1);
  const order = rng.shuffle([0, 1, 2]);
  const card = portrait ? { x: 60, y: h * 0.05, w: w - 120, h: h * 0.3 } : { x: w * 0.1, y: h * 0.05, w: w * 0.8, h: h * 0.32 };
  const area = portrait ? { x: 60, y: h * 0.4, w: w - 120, h: h * 0.55 } : { x: w * 0.1, y: h * 0.43, w: w * 0.8, h: h * 0.52 };
  const s: S = {
    sit,
    order,
    answer: order.indexOf(0),
    choices: new Choices(api, 3, { area, vertical: true, gap: 22 }),
    picked: -1,
    t: 0,
    card,
  };

  return {
    s,
    update(dt) {
      if (s.picked >= 0) s.t += dt;
      if (api.result) return;
      const i = s.choices.update();
      if (i === null) return;
      s.picked = i;
      if (i === s.answer) {
        api.sfx("chime");
        const c = s.choices.center(i);
        api.fx.burst(c.x, c.y, C.green, 18);
        api.win();
      } else {
        api.sfx("buzz");
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      const S0 = SITUATIONS[s.sit];
      const cd = s.card;
      sticker(g, cd.x, cd.y, cd.w, cd.h, C.white, 22, 7, 12);
      g.rect(cd.x, cd.y, cd.w, 74, C.ink2, { r: 22 });
      g.rect(cd.x, cd.y + 50, cd.w, 24, C.ink2, { stroke: null });
      envelope(g, cd.x + 70, cd.y + 37, 70, 46, C.yellow);
      g.text(api.t(S0.from), cd.x + 125, cd.y + 39, { size: 44, align: "left", color: C.paper, font: "body", weight: 800 });
      g.circle(cd.x + cd.w - 50, cd.y + 37, 16, C.red, { lw: 4 });
      textBlock(g, api.t(S0.body), cd.x + cd.w / 2, cd.y + 74 + (cd.h - 74) / 2, cd.w - 80, { size: w > h * 1.3 ? 66 : 54, color: C.ink, font: "body", weight: 800 });
      s.choices.draw(
        g,
        (i, r) => {
          const txt = api.t(S0.replies[s.order[i]]);
          textBlock(g, txt, r.x + r.w / 2 + 20, r.y + r.h / 2, r.w - 110, { size: w > h * 1.3 ? 58 : 48, color: C.ink, font: "body", weight: 700 });
          g.rect(r.x + 18, r.y + r.h / 2 - 26, 52, 52, C.white, { r: 26, lw: 5 });
          g.text(String(i + 1), r.x + 44, r.y + r.h / 2 + 2, { size: 34, font: "mono", color: C.ink });
        },
        api.result ? s.answer : undefined,
        C.paper,
      );
      // consequência
      if (api.result) {
        const k = Math.min(1, s.t / 0.3);
        if (api.result === "win") {
          g.push();
          g.translate(w / 2, cd.y + cd.h * 0.6);
          g.scale(Math.max(0.01, k));
          sticker(g, -Math.min(420, w * 0.44), -70, Math.min(840, w * 0.88), 140, C.green, 20, 7, 10);
          g.text(api.t({ en: "Sent. Very professional.", pt: "Enviado. Muito profissional." }), 0, 0, { size: 60, color: C.white, stroke: C.ink, lw: 10, maxWidth: Math.min(780, w * 0.84) });
          g.pop();
        } else {
          g.push();
          g.translate(w / 2, cd.y + cd.h * 0.6);
          g.scale(Math.max(0.01, k));
          sticker(g, -Math.min(380, w * 0.42), -70, Math.min(760, w * 0.84), 140, C.red, 20, 7, 10);
          g.text(api.t({ en: "HR would like a word.", pt: "O RH quer conversar." }), 0, 0, { size: 62, color: C.white, stroke: C.ink, lw: 10, maxWidth: Math.min(700, w * 0.8) });
          g.pop();
        }
      }
    },
  };
}

export const politeReply: Entry<S> = {
  def: {
    id: "polite-reply",
    num: 78,
    name: { en: "Reply Nicely", pt: "Responde com Educação" },
    verb: { en: "REPLY!", pt: "RESPONDE!" },
    hint: { pointer: "tap", keys: "digits" },
    category: "office",
    family: "choice",
    goal: "complete",
    difficulty: 1,
    mechanic:
      "An annoying email arrives (16 situations: weekend work, fish in the microwave, the stolen yogurt…). Three replies: one professional, two passive-aggressive or absurd. Pick the professional one.",
    winText: "Pick the professional reply.",
    loseText: "Pick a passive-aggressive reply, or run out of time.",
    timeScale: 1.6,
    minTime: 4.5,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.1 || io.isDown) return;
          const c = s.choices.center(s.answer);
          io.tap(c.x, c.y);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.1) return;
          io.press(`Digit${((s.answer + 1) % 3) + 1}`);
        },
      }
    : null,
};
