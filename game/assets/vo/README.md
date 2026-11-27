# Locução do "SPEED UP" — gravações originais

Um locutor anuncia cada aumento de velocidade, sobre um corte dramático da música.

**Sem gravações aqui, o jogo usa rugidos sintetizados sem palavras** (a palavra "SPEED UP!" aparece na tela).
A síntese de fala por código foi testada com reconhecimento de fala offline e não ficou inteligível o bastante para
dizer palavras, então as falas só existem como gravações reais.

## Como gravar

Grave cada fala gritando, com energia de locutor de fliperama dos anos 90 (pode ser no celular). Exagere:
gagueje na primeira sílaba e prolongue a vogal.

| arquivo           | fala                |
| ----------------- | ------------------- |
| `faster`          | "F-F-F-FASTER!"     |
| `speedup`         | "SPEED UUUUP!"      |
| `gogogo`          | "GO! GO! GOOOO!"    |
| `mayhem`          | "M-M-M-MAYHEM!"     |
| `nobrakes`        | "NO BRAAAKES!"      |
| `turbo`           | "T-T-TURBOOO!"      |

Outras falas também valem: qualquer nome de arquivo em minúsculas (`hyper.raw.mp3`, por exemplo) entra na rotação.

Várias tentativas da mesma fala também valem (`faster-1.raw.mp3`, `faster-2.raw.mp3`...): cada aceleração sorteia uma
fala, sem repetir as últimas. Com **`@<fase>`** no nome, a fala só entra a partir daquela aceleração: `turbo-1@30.raw.mp3`
só toca da fase 30 em diante (as acelerações das fases 10 e 20 sorteiam só as falas sem `@`).

**Gravações atuais (nov/2026):** 37 tentativas cruas de 6 falas, cortadas e aceleradas para 1,3 s sem mudar o tom.
As 11 que precisaram de 1,8× a 2,2× de aceleração (`gogogo-2/3/4`, `mayhem-3/4/5` e todas do `turbo`) têm `@30`.

Duas opções de arquivo (`.mp3`, `.ogg`, `.wav` ou `.m4a`):

- **`<fala>.raw.mp3`** — a sua voz crua. O jogo aplica o tratamento `speedupVoice` (opção D do laboratório):
  corta o grave de microfone, compressão moderada (-24 dB, 4:1) e reverb curto (decay 0,45 s, 12 %, pré-delay 25 ms);
  durante a fala a trilha abaixa 4 dB (ducking). Os valores ficam em `SPEEDUP_VOICE_FX` (voice.ts). A voz de monstro (`monsterize`: camadas mais graves,
  saturação, eco e reverb longo) ficou só no laboratório: sujava e embolava o fim das falas (escolha de ouvido, nov/2026).
- **`<fala>.mp3`** — já processada do jeito que você quiser; o jogo toca como está.

Regras práticas:

- Até **1,3 s** de fala por arquivo (o resto da tela de aceleração é a virada da bateria). Corte o silêncio do começo.
- Mono, 44,1 kHz, ~96–128 kbps em MP3 basta (cada arquivo fica com ~15–25 KB).
- Havendo pelo menos uma gravação, **só as gravações tocam** (os rugidos sintetizados saem da rotação).

Depois de colocar os arquivos aqui, rode `npm run build` — eles vão embutidos no `assets/play/game.js`
(nada é baixado durante o jogo).
