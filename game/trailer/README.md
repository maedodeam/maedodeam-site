# Trailer do Microgame Mayhem — gravador

Ferramenta de desenvolvimento que grava o trailer com o próprio motor do jogo. **Não faz parte do jogo publicado**:
`game/scripts/build.ts` só empacota `game/src/main.ts`, `tools/dist.py` não publica `game/`, e nada aqui muda
mecânicas, balanceamento ou telemetria (o bundle do gravador tem `TELEMETRY_URL = ""`).

```
npm run trailer          # tudo: linha do tempo → captura → encerramento → textos → montagem
```

Ou por etapa:

| comando | o que faz |
| --- | --- |
| `node game/trailer/record.ts timeline` | joga a partida do roteiro sem capturar e grava `timeline.json` (início, resultado e andamento de cada microgame, acelerações, Game Over) |
| `node game/trailer/record.ts capture` | joga a mesma partida de novo (idêntica: confere a linha do tempo) e captura só os quadros usados + o áudio da partida |
| `node game/trailer/record.ts closing` | encerramento: a tela inicial de verdade (fundo animado, logotipo, música) + o texto final |
| `node game/trailer/record.ts cards` | textos promocionais em PNG com transparência |
| `node game/trailer/edit.ts` | monta o MP4 com FFmpeg |

Saída em `game/.dev/trailer/` (fora do Git): `microgame-mayhem-trailer.mp4`.

## Como funciona

- **Partida real.** `harness.ts` monta o jogo com os mesmos módulos de `main.ts` (Session, Renderer, AudioManager,
  telas do DOM, radar de habilidades) na página `/play/` publicada. Placar, vidas, acelerações, vida extra, radar e
  frase do Game Over vêm do jogo.
- **Determinística.** O relógio é um `OfflineAudioContext`: o navegador para a cada 1/60 s, o jogo avança exatamente
  um quadro e o áudio é renderizado com precisão de amostra (música, efeitos, vinhetas, falas). A mesma partida se
  repete quadro a quadro, por isso a captura grava só o que a edição usa.
- **Jogadas válidas.** Cada microgame é jogado pelo bot dele (`win` ou `lose`), pela entrada real (`InputCore`), com
  um tempo de reação antes de agir (sem isso os bots vencem em 0,2 s). O cursor do mouse aparece como na tela real.
- **O que o roteiro escolhe** (`plan.ts`): a ordem dos microgames (em vez do sorteio), quem vence ou perde, o tempo de
  reação e qual gravação do SPEED UP toca em cada aceleração (no jogo ela é sorteada; o tratamento é o mesmo).
- **O que a gravação esconde**: os botões da interface (pausa, som, tela cheia, voltar).
- **Edição** (`edit-plan.ts`): trechos medidos em tempos da música de cada nível, então os cortes caem na batida.
  Textos promocionais e encerramento em `page.ts`, com as fontes e cores do jogo.

Para trocar um microgame, uma gravação ou a ordem: edite `plan.ts`, rode `timeline`, ajuste `edit-plan.ts` pelos
números de `timeline.json` e rode o resto.
