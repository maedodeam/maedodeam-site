# Teste de legítimo interesse (LIA) — métricas de gameplay do Microgame Mayhem

| | |
| --- | --- |
| Controladora | MAEDODEAM CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA |
| Tratamento | estatísticas de gameplay do Microgame Mayhem (maedodeam.com.br/play), sem conta, cookies ou identificação pessoal |
| Base legal avaliada | legítimo interesse — LGPD art. 7º, IX, e art. 10 |
| Operadora | Cloudflare (Workers e D1) |
| Versão | 1 — preparada antes da ativação; revisar antes de publicar e a cada mudança no que é coletado |
| Situação | **coleta desligada**; esta avaliação é condição para ativar |

> Documento técnico de apoio, preparado com base no código desta branch. **Não é parecer jurídico**:
> recomenda-se a revisão de quem cuida do jurídico antes da ativação. A estrutura segue as três etapas usuais do
> teste (finalidade, necessidade e balanceamento), como descritas no guia orientativo da ANPD sobre legítimo interesse.

## Etapa 1 — Finalidade (o interesse é legítimo?)

**Interesse:** manter o jogo equilibrado e divertido — descobrir fases fáceis ou difíceis demais, comparar versões
do jogo e entender em que ponto as partidas terminam.

- **Legítimo e concreto:** decorre da atividade da empresa (o jogo é um produto dela) e é atual (300 fases
  recém-lançadas, sem dados sobre a dificuldade real de cada uma). Art. 10, I: apoio e promoção de atividades do
  controlador.
- **Lícito:** não envolve publicidade, perfilamento, venda de dados, decisões automatizadas sobre pessoas nem
  dados sensíveis.
- **Definido e limitado:** o uso é só estatística agregada para o balanceamento (contrato de eventos em
  `telemetry/README.md`; o dashboard só mostra agregados e é privado).

**Resultado da etapa 1: atende.**

## Etapa 2 — Necessidade (os dados são os mínimos para a finalidade?)

| dado | por que é necessário | o que foi evitado |
| --- | --- | --- |
| resultado de cada fase (venceu/perdeu, tempo usado, nível, vidas) | é o próprio objeto do balanceamento | nada de entradas do jogador (toques, trajetórias) |
| início/fim da partida e motivo do fim | taxa de conclusão, progressão e onde se para de jogar | nada de horário do aparelho (só o horário de chegada no servidor) |
| versão do jogo | comparar antes/depois de ajustes | — |
| idioma (pt/en), tipo de aparelho (3 valores), tipo de controle (3 valores) | dificuldade muda com toque × mouse e com tela pequena | sem modelo, sistema, navegador, resolução, user-agent |
| UUID aleatório **por partida**, criado em memória | agrupar os eventos da mesma partida | sem identificador persistente, de pessoa ou de aparelho; sem cookies nem armazenamento local |

- **IP:** não é armazenado. Chega à Cloudflare só porque é inevitável numa conexão, e é usado só para o limite de
  requisições (proteção contra abuso). Logs de requisição da Cloudflare desligados (`observability.enabled = false`).
- **Alternativas menos invasivas avaliadas:** testes internos e o seletor de fases (já usados) não mostram a
  dificuldade percebida por jogadores reais em aparelhos variados; pesquisa por formulário exigiria mais dados
  pessoais (e-mail) e teria baixa resposta. Agregar no navegador e enviar só totais perderia a progressão por partida.
- **Retenção (180 dias, ajustável entre 30 e 400):** os ajustes de dificuldade acontecem por versão; 180 dias cobrem
  várias versões e permitem comparar antes e depois de cada ajuste com amostra suficiente para as fases menos
  jogadas (cada partida passa por poucas das 300 fases). Mais que isso traria pouco ganho para a finalidade; por
  isso o padrão deixou de ser 400 dias. A exclusão é automática (cron diário), e o valor fica num único lugar da
  política e do Worker (um teste garante que os dois coincidem).

**Resultado da etapa 2: atende.**

## Etapa 3 — Balanceamento (o interesse prevalece sobre os direitos e expectativas do titular?)

### Expectativa razoável

- Métricas de uso para melhorar um jogo são uma prática comum e esperada em jogos online.
- Há aviso **na própria tela inicial do jogo**, antes de jogar ("Coletamos estatísticas de gameplay para equilibrar
  as fases — sem conta, sem cookies e sem identificação pessoal"), com botão para desligar e link para a política.
- O aviso antigo ("Nada fica guardado. Fechou a página, sumiu.") e os textos do site que diziam "nada salvo" ou
  "sem rastreadores" mudam automaticamente junto com a ativação, para não criar expectativa errada.

### Impacto sobre o titular

- **Baixo:** os dados armazenados não identificam a pessoa nem o aparelho, não permitem seguir alguém entre
  partidas ou visitas e não são combinados com outras fontes. Não há decisão sobre pessoas.
- **Público:** o jogo é aberto a qualquer idade e não sabemos a idade de quem joga. Por isso a coleta foi desenhada
  para não depender de identificação: nada pessoal é pedido, nada é guardado no aparelho e nada permite reconhecer
  uma criança ou adolescente individualmente (art. 14 e o melhor interesse).
- **Riscos residuais:** (1) o IP em trânsito na Cloudflare — mitigado por não armazenar e desligar logs; (2)
  eventos falsificados por terceiros — afetam só a qualidade da estatística, não pessoas (validação estrita,
  limites, ranking com amostra mínima); (3) transferência internacional pela Cloudflare (art. 33) — informada na
  política.

### Salvaguardas e direitos

| salvaguarda | onde está / como é verificada |
| --- | --- |
| **Opção de desligar** na tela inicial, sem tirar nada do jogo; vale até fechar a página (o jogo não guarda nada no aparelho, então não pode lembrar a escolha) | botão `#mm-metrics`; teste "botão da tela inicial: desligar para na hora…" |
| **Desligar sempre:** Do Not Track ou Global Privacy Control fazem o jogo não enviar nada | teste "Do Not Track / Global Privacy Control: nada é enviado" e "com DNT/GPC, o botão não consegue ligar" |
| Transparência: aviso no jogo + seção própria na política (PT e EN), publicados **junto** com a coleta | a mesma chave liga tudo; teste "ligada: a política ganha a seção…" e "configuração atual: telemetria desligada…" |
| Minimização: sem IP, user-agent, e-mail, localização ou identificador persistente no banco | teste "limite de requisições por IP (o IP não vai para o banco)" (inspeciona o esquema) |
| Sem armazenamento no aparelho | testes de privacidade do jogo (código e bundle) e e2e "sem rede e sem armazenamento" |
| Partidas não são pessoas: o dashboard nunca mostra "jogadores únicos" | teste "dashboard: partidas não são jogadores" |
| Retenção limitada e automática | `retentionDays()` (30–400), cron diário; teste "a retenção do Worker é a mesma da política" |
| Segurança: dashboard só para o e-mail autorizado (Access + verificação no código), ingestão sem leitura | testes "dashboard: acesso" e "ingestão: superfície mínima" |
| Direitos do titular: como nada identifica a pessoa, não há como localizar "os dados de alguém"; contato na política para dúvidas | seção "Seus direitos" da política |

**Resultado da etapa 3: o interesse prevalece**, dado o baixo impacto, a expectativa razoável, a transparência no
próprio jogo e a possibilidade de não participar sem prejuízo.

## Conclusão

O legítimo interesse é uma base adequada para estas métricas, **desde que** a ativação mantenha as condições acima:
aviso e botão no jogo, seção da política publicada junto, coleta mínima e retenção limitada. Qualquer mudança no que
é coletado (novo campo, identificador persistente, uso para outra finalidade) exige refazer esta avaliação.

## Validação automática antes da ativação

Rodar `npm test` (inclui `telemetry/tests/` e os testes de privacidade do jogo) e o e2e. Os testes que sustentam
cada afirmação deste documento estão citados nas tabelas acima. Lista de conferência manual em
`telemetry/README.md` → "Checklist de pré-ativação".

## Revisar quando

- antes da ativação (com o jurídico) e um ano depois dela;
- se mudar o que é coletado, a finalidade, a operadora ou a retenção;
- se houver orientação nova da ANPD aplicável.
