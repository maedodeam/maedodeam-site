# Microgame Mayhem

Jogo de microgames da MAEDODEAM, publicado em `/play/` (EN) e `/pt-br/play/` (PT-BR).
Uma sequência rápida de 300 desafios de poucos segundos, com 4 vidas (+1 a cada 10 fases, até 4) e dificuldade crescente.
Roda inteiro no navegador, em computador, tablet e celular. **Nada é salvo e nada é enviado:**
sem backend, cookies, storage, analytics ou rede depois do carregamento.

## Arquitetura

```
game/
├── src/
│   ├── main.ts              entrada no navegador: canvas, DOM, laço principal
│   ├── core/
│   │   ├── types.ts         contrato dos microgames (MicrogameDef, MicroAPI, InputView, bots)
│   │   ├── session.ts       máquina de estados da partida (vidas, pontos, fases)
│   │   ├── runner.ts        executa um microgame: instrução, tempo, vitória/derrota
│   │   ├── difficulty.ts    curva de duração, nível, pontos
│   │   ├── sequencer.ts     escolha do próximo microgame (baralho, WTF Moments, sem repetições próximas)
│   │   ├── input.ts         entrada unificada (mouse, toque, teclado) — pura
│   │   ├── dom-input.ts     liga os eventos do navegador ao input.ts
│   │   ├── layout.ts        encaixe responsivo do palco
│   │   ├── rng.ts           aleatório com semente
│   │   └── i18n.ts          textos da interface e dicas de controle
│   ├── audio/audio.ts       Web Audio: efeitos, vinhetas e música sintetizados
│   ├── gfx/                 draw.ts (Gfx), palette.ts, art.ts (elenco), fx.ts (partículas), wtf.ts (psicodelia)
│   ├── kit/                 choices.ts, drag.ts, mover.ts (componentes reutilizáveis)
│   ├── ui/render.ts         HUD, interlúdio, instrução, resultado, aceleração, fim
│   ├── testing/             sim.ts (simulação com bots), botkit.ts (ajudantes de bot)
│   └── games/               os microgames, em pastas por lote, registrados em games/index.ts
├── tests/                   testes (node --test, TypeScript direto)
├── dev/                     galeria de desenvolvimento (não publicada)
├── e2e/                     testes de ponta a ponta (Playwright)
└── scripts/                 build.ts, report.ts, shots.ts, catalog.ts
```

O build (`npm run build:game`) gera `assets/play/game.js`, um único arquivo minificado que vai para o
repositório, como o resto do site estático. A página é gerada por `src/build.py` a partir de
`src/templates/play.html`.

## Partida: sorteio, WTF Moments e vidas

- **Baralho.** Os microgames normais saem todos uma vez antes de repetir. As 10 primeiras fases são fáceis, até a 19ª
  médias e, a partir da 20ª, entram as difíceis (nunca duas seguidas). Nada se repete dentro de 6 fases, e o
  sorteio evita repetir categoria ou gesto em seguida.
- **WTF Moments** (`def.wtf`): desafios absurdos e inesperados, mas com lógica e possíveis de vencer de primeira.
  Ficam fora do baralho e saem **sem aviso**: o primeiro entre a 8ª e a 12ª fase; depois, um a cada 8–12 fases, com o
  intervalo encurtando um pouco depois da 30ª e da 60ª. Nunca saem dois seguidos e não se repetem numa partida
  enquanto houver outros. Os `"insane"` (mais psicodélicos) só saem depois da 30ª fase, com preferência. Cada um tem
  visual (`gfx/wtf.ts`) e sons próprios (`warp`, `glitch`, `boing`, `kazoo`, `choir`, `wobble`, `tada`); a instrução
  entra "derretendo" em cores e há um "derretimento" sonoro ao começar.
- **Vidas.** Começa com 4. A cada 10 microgames concluídos (vencidos ou perdidos), quem ainda está vivo passa pelo
  "SPEED UP!" e, se tiver menos de 4, ganha +1 vida: o coração surge com brilho e "+1 LIFE!" depois do grito, com um
  arpejo agudo. Com 4 vidas só aparece o "SPEED UP!". Cada marco dá vida no máximo uma vez, nunca depois do fim de
  jogo, e a transição continua com a mesma duração (não tira tempo do microgame seguinte).
- **Curva.** Nível interno e duração seguem a mesma curva de antes: o "ciclo" continua sendo de 100 fases
  (`CYCLE_LENGTH`), mesmo com 300 no catálogo.

## Música e som

A trilha é original e 100% sintetizada no navegador (Web Audio), sem arquivos de áudio:

```
audio/theory.ts     tom, progressão (IV–V–iii–vi do J-pop, com 7ªs e 9ªs), melodia, andamento e modulação por nível
audio/composer.ts   (puro) o que toca em cada semicolcheia, camada por camada, conforme o nível
audio/synth.ts      instrumentos: bateria, baixo, 303 ácido, piano elétrico FM, pad psicodélico, lead, sinos, chops
audio/voice.ts      voz por formantes (vocal chops, risadas, rugidos) e a "voz de monstro" para gravações
audio/music.ts      motor: agendamento preciso, transições em limites rítmicos, vinhetas, contagem no beat
audio/audio.ts      fachada usada pelo jogo; efeitos sonoros afinados no tom atual da música
```

Progressão (cada "SPEED UP" sobe o andamento e o tom):

| nível | o que entra |
| --- | --- |
| 1 | groove pop: bumbo 4×4 leve, palmas, shaker, baixo saltitante, piano elétrico, melodia |
| 2 | chimbal, cowbell bossa, arpejo de sininho, vocal chops "pa-pi-po" respondendo à melodia |
| 3 | baixo ácido 303 suave (teto fixo de brilho e ressonância, três desenhos, um compasso de respiro), breakbeat, "hey!" |
| 4 | synth psicodélico (ondas de 2 compassos, oscilação de fita em estéreo), melodia dobrada, chops de esquilo, risadas, lasers, viradas |
| 5 | breakbeat no comando, glitch/stutter, surpresas rítmicas (parada, tercinas, meio-tempo) |
| 6+ | tudo junto, mais rápido; mutações na melodia, coro de risadas, bitcrush |

Sincronia: o microgame começa no tempo da música; a contagem regressiva toca nos tempos; vitória e derrota são
vinhetas no tom e no tempo; a aceleração faz corte dramático → locução → virada → volta no downbeat exato.
A música nunca reinicia entre microgames.

Locução do "SPEED UP": gravações originais em `game/assets/vo/` (ver o README de lá). Sem elas, rugidos sem palavras.

Laboratório: `node game/scripts/audio-lab.ts --out <pasta>` renderiza offline uma partida simulada e as vozes (WAV).

Diagnóstico da trilha (só local, nada disso é publicado):

- `npm run music-lab` abre em http://127.0.0.1:4180 um laboratório para ouvir cada faixa de fases, ligar/desligar ou
  isolar cada instrumento, simular a partida (contagem + vinhetas) e disparar o SPEED UP.
  `-- --compare <ref do git>` acrescenta o motor de outra versão para comparar de ouvido.
- `npm run music-report -- --solo --cues [--wav <pasta>]` renderiza offline e imprime loudness, picos antes e
  depois do limitador, nível por faixa de frequência (a "presença", 2–5 kHz, é onde o ouvido cansa), densidade de
  notas, nós de áudio por segundo (custo no celular), estalos e cada instrumento isolado. Números bons não provam
  que soa bem: ouça no laboratório.
- Revisão de 2026-11 (escolhida de ouvido entre três versões de cada): o 303 suave (nível 3+) e o synth psicodélico
  em ondas de 2 compassos (nível 4+) substituíram o 303 ressonante que tocava toda semicolcheia e o synth de dentes
  de serra com filtro ressonante a cada compasso. As fases 1–19 não mudaram; um teste guarda a impressão digital
  das notas de cada nível.

## Comandos

```bash
npm test                                   # todos os testes
MG_FILTER=swat,pour npm test               # só alguns microgames
node --import ./game/tests/helpers/setup.ts game/scripts/report.ts swat   # taxas de acerto dos bots
node game/scripts/shots.ts --ids swat-fly --out C:/temp/a.png            # folha de capturas
npm run typecheck
npm run build:game
npm run e2e
```

## Como escrever um microgame

Cada microgame é um arquivo em `game/src/games/<lote>/<id>.ts` que exporta um `Entry`:

```ts
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";

interface S { /* estado */ }

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const s: S = { /* ... */ };
  return {
    s,                       // exposto para os bots
    update(dt) { /* lê api.input, chama api.win() / api.lose() */ },
    draw(g: Gfx) { /* desenha tudo, todo quadro */ },
  };
}

export const meuJogo: Entry<S> = {
  def: { id: "meu-jogo", num: 99, name: {...}, verb: {...}, hint: { pointer: "tap", keys: "space" },
         category: "absurd", family: "tap", goal: "complete", difficulty: 1,
         mechanic: "...", winText: "...", loseText: "...", bg: BG.pink, setup },
  bots: BOTS ? { win(s, api, io, dt) {...}, lose(s, api, io, dt) {...} } : null,
};
```

Depois, acrescente o `Entry` à lista do `index.ts` do lote. Para um WTF Moment, acrescente `wtf: "normal"` (ou
`"insane"`, que só sai depois da 30ª fase) e use `gfx/wtf.ts` e os sons de WTF.

### Regras do contrato

- **Puro.** Nada de DOM, `setTimeout`, `setInterval`, `requestAnimationFrame`, eventos globais, `Math.random`
  ou `Date`. Todo tempo vem de `dt`/`api.time`; todo acaso vem de `api.rng`. (Os testes verificam.)
- **Vitória e derrota explícitas.** `goal: "complete"`: chame `api.win()` ao cumprir o objetivo; o fim do tempo
  é derrota. `goal: "survive"`: chame `api.lose()` ao falhar; o fim do tempo é vitória. Use também
  `api.lose()` para erros claros (resposta errada, pasta errada, transbordar).
- **Depois do resultado** o microgame continua sendo desenhado por ~0,6 s, sem entrada: anime a consequência
  (algo cai, alguém comemora). Verifique `api.result` para não decidir de novo.
- **Instrução** = `def.verb`: curta (EN ≤ 18 caracteres, PT ≤ 22), maiúscula, com "!". Se o objetivo é
  sorteado (ex.: "CORTA O AZUL!"), devolva `verb` na instância.
- **Duração.** Não escolha a duração: ela vem da curva (7 s no começo, 3 s depois do 50º). Use `timeScale`
  (≤ 1.6) e `minTime` para mecânicas que precisam de mais tempo. Faça a complexidade caber no tempo.
- **Dificuldade.** `api.level` vai de 0 a 1.5. Use para velocidade, precisão, quantidade, distrações.
  Em `level = 0` o jogo deve ser óbvio e generoso; em 1.5, difícil mas justo.

### Palco e responsividade

- O palco tem o **lado menor = 1000** unidades; o maior vai até 1780. Os testes rodam em
  **1780×1000 (paisagem), 1000×1780 (retrato de celular) e 1000×1000**. Posicione tudo em relação a
  `api.w`/`api.h`; em retrato, empilhe na vertical (`const portrait = h > w`).
- **Alvos de toque ≥ 120 unidades** (no celular, 1000 unidades ≈ 390 px). Raio de pega de arrasto ≥ 80.
- Mantenha o essencial longe das bordas (margem ≥ 60) — gestos na borda conflitam com o navegador.

### Controles (mouse, toque e teclado)

Todo microgame tem que ser **igualmente jogável com mouse e com toque**, sem botões virtuais. Teclado é
opcional, quando natural (declare em `hint.keys`). `api.input` unifica tudo:

| quer…              | use                                                    |
| ------------------ | ------------------------------------------------------ |
| toque/clique       | `input.pressed` + `input.x/y`                          |
| botão de ação      | `input.actionPressed` / `input.action` (clique, toque, Espaço, Enter) |
| segurar            | `input.action` (ponteiro pressionado ou Espaço)         |
| arrastar           | `DragGroup` (kit/drag.ts)                              |
| mover personagem   | `steer()` (kit/mover.ts): mouse segue o cursor, toque é relativo, setas |
| esquerda/direita   | `sideTap()` (kit/mover.ts): deslizar, setas ou tocar no lado da tela |
| deslizar/cortar    | `input.swipe`, `input.swipeLine`, `input.trail`, `input.segments` |
| escolher resposta  | `Choices` (kit/choices.ts): toque, teclas 1–n, setas+Enter |
| digitar            | `input.typed` (letras) / `input.digit`                 |

**Não use hover** (no toque não existe ponteiro sem dedo). `input.hasPointer` é falso no toque quando o dedo
não está na tela.

### Visual

- Estilo **adesivo**: formas chapadas, contorno de tinta `C.ink` (padrão de `Gfx`), cores fortes da `palette.ts`,
  rostos com `g.face()`. Use o elenco de `gfx/art.ts` (pessoa, chefe, gato, mosca, bug, xícara…) e crie o seu.
- Grande e legível: o jogo é visto num celular. Objetos principais com ≥ 150 unidades.
- Feedback imediato: `api.sfx(...)`, `api.fx.burst(...)`, `api.fx.shake(...)`, `api.fx.pop(...)`.
- Humor: escritório, tecnologia, absurdo. Nada de personagens, marcas ou artes de outros jogos.
- `draw()` desenha o quadro inteiro (comece com `g.clear(cor)`) e não altera o estado.

### Justiça e bots

Cada microgame traz **dois bots** que jogam pela entrada real (`BotIO`: `tap`, `down/move/up`, `press`,
`keyDown/keyUp`). O teste exige, em todos os palcos, níveis 0/0.5/1/1.5 e várias sementes:

- o bot `win` **sempre vence** — com mouse **e com toque** (`io.touch`);
- o bot `lose` **sempre perde**;
- parado, um microgame `complete` perde.

O bot vencedor é a prova de que o jogo é justo: se nem um bot com informação perfeita vence sempre,
o jogo está injusto (paredes impossíveis, alvos rápidos demais) — **conserte o jogo, não o teste**.
Escreva o bot como um jogador habilidoso, reagindo ao estado (não "trapaceie" alterando `s`).
Ajudantes em `testing/botkit.ts` (`mem`, `planDrag/stepDrag`, `steerTo`, `moveToward`).

### Verificação de cada microgame

1. `npm run typecheck`
2. `node --import ./game/tests/helpers/setup.ts game/scripts/report.ts <id>` → tudo `36/36`
3. `MG_FILTER=<id> npm test`
4. `node game/scripts/shots.ts --ids <id> --stage landscape --out <arquivo>.png` e também `--stage portrait`;
   **olhe as imagens**: está legível, bonito, engraçado e claro?
