# Telemetria de gameplay — Microgame Mayhem

Estado: **preparada e testada, DESLIGADA** (branch `feat/telemetry`). Nada foi publicado na Cloudflare, a CSP de
produção continua `connect-src 'none'` e o jogo publicado não tem nenhum código de rede. A ativação depende da
autorização final do dono (ver "Ativação" no fim).

Decisões aprovadas:
- base legal: **legítimo interesse**, sem pergunta obrigatória de consentimento; **aviso discreto na tela inicial**
  com **botão para desligar** as métricas (e Do Not Track / Global Privacy Control respeitados). Avaliação em
  [`docs/LIA-legitimo-interesse.md`](docs/LIA-legitimo-interesse.md);
- **seção da política de privacidade aprovada** (PT e EN), publicada automaticamente junto com a ativação
  (`src/partials/privacy-microgame-mayhem.html`);
- retenção padrão de **180 dias** (ajustável entre 30 e 400; justificativa na LIA).

## Arquitetura

```
Jogo (GitHub Pages, público, estático)
   │  POST /v1/events  (2–4 lotes por partida, text/plain, sendBeacon ao sair)
   ▼
mm-telemetry-ingest.<sub>.workers.dev      ← Worker PÚBLICO: só recebe eventos validados (nada de leitura)
   │  grava
   ▼
D1  mm-telemetry  (SQLite)                 ← sem IP, sem identificadores persistentes
   ▲  lê
   │
mm-telemetry-dashboard.<sub>.workers.dev   ← Worker PRIVADO: página + API + CSV
   ▲  Cloudflare Access (só o seu e-mail) + verificação do token do Access no próprio Worker
 você
```

- Dois Workers separados: o público **não tem** rotas de leitura (qualquer caminho além de `POST /v1/events`
  responde 404), e o privado **não recebe** eventos. Um erro de configuração num não abre o outro.
- Endereços gratuitos `workers.dev`; nenhum registro DNS de `maedodeam.com.br` é tocado.
- `preview_urls = false` nos dois: sem URLs de versão (endereços alternativos que ficariam fora do Access).
- O dashboard verifica o token do Access **dentro do código** (assinatura RS256, emissor, audiência, validade e
  e-mail na lista). Sem configuração, nega tudo. Assim, mesmo um endereço que escape do Access não mostra dados.
- Logs de requisição da Cloudflare (`observability`) desligados: guardariam metadados como IP.

## Arquivos

| caminho | o quê |
| --- | --- |
| `client.config.json` | **a chave**: `endpoint` vazio = desligada (padrão); ligada exige `policy_date` e `retention_days` |
| `../game/src/telemetry/client.ts` | cliente no jogo (fila em memória, lotes, sendBeacon, DNT/GPC) |
| `migrations/0001_init.sql` | esquema D1 |
| `shared/` | contrato e validação (`validate.ts`), gravação idempotente (`store.ts`), estatísticas (`stats.ts`), catálogo gerado |
| `ingest/` | Worker público (`src/index.ts`, `wrangler.toml`) |
| `dashboard/` | Worker privado (`src/index.ts`, `src/access.ts`, `src/page.ts`, `wrangler.toml`) |
| `scripts/local.ts` | os dois Workers rodando local com SQLite (Access simulado só neste script) |
| `scripts/gen-catalog.ts` | regenera `shared/catalog.gen.ts` quando o catálogo do jogo muda |
| `scripts/deploy.ps1` | roteiro guiado de publicação (pede confirmação a cada passo) |
| `tests/` | testes (rodam no `npm test`) |
| `docs/LIA-legitimo-interesse.md` | teste de legítimo interesse (finalidade, necessidade, balanceamento) |
| `../src/partials/privacy-microgame-mayhem.html` | seção aprovada da política (PT/EN), entra em `privacy.html` só com a telemetria ligada |

## Contrato de eventos (v1)

`POST {endpoint}/v1/events`, corpo `text/plain;charset=UTF-8` com JSON `{"v":1,"events":[...]}`
(1 a 30 eventos, até 32 KB). Campos extras, tipos errados ou valores fora dos limites invalidam o evento.

Todos os eventos: `id` (UUID v4 do evento), `run` (UUID v4 da partida, criado em memória), `seq` (0, 1, 2…
por partida), `type`, `t` (ms desde o início da partida), `ver` (hash do código do jogo).

| type | campos | quando |
| --- | --- | --- |
| `game_start` | `lang` (en/pt), `device` (mobile/tablet/desktop) | começar ou jogar de novo |
| `microgame_result` | `n` (posição), `mg` (id), `result` (win/lose), `level` (0–1,5), `tier`, `dur`, `used` (s), `lives` (depois), `input` (mouse/touch/keys) | cada microgame |
| `life_changed` | `n`, `from`, `to`, `reason` (lose/milestone) | perdeu uma vida ou ganhou no SPEED UP |
| `game_over` | `n` (jogados), `score`, `wins` | fim de jogo |
| `game_abandon` | `n`, `reason` (quit/pagehide) | saiu para o título ou fechou a página no meio |

O servidor **não confia** no navegador para o que pode conferir: o `mg` precisa existir no catálogo do servidor,
e número, dificuldade e tipo WTF vêm desse catálogo.

## Esquema D1

- **Uma linha por partida** (`runs`): início, último evento, versão, idioma, aparelho, estado, maior nível, placar,
  contagem e maior `seq`, e a coluna `ev` com **todos os eventos da partida** em JSON compacto, por número de
  sequência. Cada lote é mesclado com `json_patch`: **1 linha escrita por lote**, qualquer que seja o tamanho.
- `mg_daily` + `rollup_days`: agregado diário por microgame × aparelho × versão, recalculado pelo cron
  (idempotente: apaga o dia e refaz). O dashboard lê dali os dias fechados e só lê eventos crus de hoje.
- Detalhes e formato dos eventos em `migrations/0001_init.sql`.

- **Idempotência:** o mesmo evento duas vezes grava a mesma chave com o mesmo valor; um lote sem nada novo não
  escreve nada (0 linhas). A ordem de chegada não importa (máximos e o estado mais final: Game Over > abandono > aberta).
- **Desfechos de uma partida** (uma partida sem Game Over **não** vira abandono confirmado automaticamente):
  - *Game Over* = evento `game_over`;
  - *abandono voluntário* = evento `game_abandon` com `quit`: a pessoa saiu pelo menu (escolha explícita de parar);
  - *saída detectada* = evento `game_abandon` com `pagehide`: a página foi fechada ou trocada no meio da partida
    (registrado, mas não tratado como decisão de abandonar; se a página só foi para o cache de voltar/avançar,
    nem conta);
  - *sem fim registrado* = nenhum dos dois e sem eventos há mais de `ABANDON_AFTER_MIN` (30 min, configurável).
    Fica separado do abandono confirmado e se divide em *presumido* (sequência completa) e *falha de envio*
    (lacuna em `seq` ou sem `game_start`);
  - *em andamento* = evento recente; fora das taxas.
- **Contagem pelas chaves:** `events` soma só as chaves novas de cada lote, então lotes repetidos ou chegando ao
  mesmo tempo não criam lacunas falsas nem dobram contagens.
- **Cron diário (04:17 em Brasília):** agrega o dia que fechou (as partidas que viraram a meia-noite já acabaram)
  e aplica a retenção: apaga partidas e agregados com mais de `RETENTION_DAYS` dias (180; sempre entre 30 e 400).
  O número precisa ser o mesmo em `ingest/wrangler.toml` e em `client.config.json` (`retention_days`, que vai
  para a política); um teste confere.

## Estratégia de envio

- `game_over` e `game_abandon` saem na hora; os demais (inclusive o `game_start`) esperam até 30 s ou 20 eventos.
  Uma partida típica sai em 2–4 lotes (cada lote = 1 requisição e 1 linha escrita no D1). Um lote = uma partida.
- Aba ficando oculta: envia a fila com `sendBeacon`. Fechar a página no meio da partida: `game_abandon` por `sendBeacon`.
- Nunca aguarda a rede: `fetch` com `keepalive`, sem `await` no laço do jogo, tudo em `try/catch`.
- Offline: descarta. Depois de 3 falhas seguidas, desiste naquela aba. Fila só em memória, com limite de 100.
- Sem cookies/localStorage/sessionStorage/IndexedDB. Com Do Not Track ou Global Privacy Control, não envia nada.
- Telemetria desligada: o build **remove** o módulo do bundle; os testes e o `tools/dist.py` garantem que o jogo
  publicado não tem nenhuma API de rede e que a CSP do jogo é `connect-src 'none'`. Ligada: só `fetch`/`sendBeacon`,
  só para o endereço configurado, e a CSP do jogo libera só esse endereço (as outras páginas continuam `'none'`).

## Métricas do dashboard

Toda métrica mostra o tamanho da amostra. Filtros: período (dias inteiros pelo início da partida, horário de
Brasília; abre nos últimos 7 dias), aparelho, dificuldade (estatísticas por microgame) e versão.

- Tudo conta **partidas** (sessões), nunca pessoas: não há identificador de jogador, logo não há "jogadores únicos".
- Partidas iniciadas; Game Over; abandono voluntário; saída detectada; sem fim registrado (presumido / falha de envio), em número e %.
- Nível = microgames concluídos na partida: média, mediana, moda, faixas, curva de progressão (% que chega ao N)
  e onde se abandona.
- Por microgame (os 300): tentativas, vitórias, derrotas, % de sucesso, partidas distintas, partidas com ao menos
  uma vitória, % médio do tempo usado. Tabela ordenável e filtrável.
- Ranking das maiores e menores taxas (só com amostra mínima, `RANKING_MIN_ATTEMPTS` = 30).
- Comparativos por aparelho (celular × tablet × computador), dificuldade, tipo (normal × WTF) e versão.
- CSV: microgames, partidas (uma linha por partida, sem identificação pessoal) e progressão (com proteção contra fórmulas).

## Testar localmente (sem Cloudflare)

```powershell
node telemetry/scripts/local.ts
```
Ingestão em `http://127.0.0.1:8787`, dashboard em `http://127.0.0.1:8788`. Para o jogo mandar eventos para ele,
ponha temporariamente `"endpoint": "http://127.0.0.1:8787"` em `client.config.json`, rode `npm run build` e sirva o
site em `http://127.0.0.1:8765`. **Volte o endpoint para `""` e gere de novo antes de qualquer commit.**

## Coerência das mensagens de privacidade

A mesma chave (`client.config.json`) liga ou desliga, juntos:

| | desligada (hoje) | ligada |
| --- | --- | --- |
| coleta no jogo | código removido do bundle | ligada (respeita o botão e DNT/GPC) |
| CSP da página do jogo | `connect-src 'none'` | só a origem do serviço |
| aviso na tela inicial | "Nada fica guardado. Fechou a página, sumiu." | "Coletamos estatísticas de gameplay para equilibrar as fases — sem conta, sem cookies e sem identificação pessoal…" + botão + "Como funciona" |
| meta description e chamada da home | "nada salvo" / "no saves" | "sem salvar o progresso" / "no save files" |
| rodapé do site | "Sem rastreadores" | "Estatísticas de gameplay só no jogo" |
| `privacy.html` | sem seção do Microgame Mayhem | seção PT/EN com data e retenção da configuração |

Os testes em `tests/site.test.ts` geram as páginas nos dois estados (sem gravar nada) e conferem cada linha.

## Segurança — resumo

- Ingestão: só `POST /v1/events`; CORS só para `https://maedodeam.com.br` (não é autenticação); corpo ≤ 32 KB;
  ≤ 30 eventos de uma única partida (≤ 2 linhas escritas por requisição); validação estrita; limite de eventos
  por partida; respostas sem dados (204 ou código genérico). Limites de requisição: ver "Limite de requisições"
  (o IP só é usado no limitador, nunca vai para o banco).
- Eventos podem ser falsificados por quem quiser: os números são estatísticas de comportamento, não contabilidade.
  As defesas acima limitam o estrago (lixo validado e com teto), e o ranking exige amostra mínima.
- Dashboard: Access (só seu e-mail) + verificação do token no Worker (falha fechada) + `no-store`, `noindex`,
  CSP estrita, `frame-ancestors 'none'`, só GET. Nenhuma credencial no jogo nem no repositório (os e-mails autorizados são *secret*).

## LGPD — revisão (não é parecer jurídico; avaliação completa na LIA)

- **Dados tratados:** eventos de jogo ligados a um UUID aleatório por partida, versão do jogo, idioma e um tipo de
  aparelho grosseiro. Nenhum nome, e-mail, IP armazenado, localização, impressão digital nem identificador
  persistente. Sem cruzamento com outras fontes, a reidentificação não é razoável — o objetivo é que os dados
  armazenados sejam anônimos (art. 12).
- **Em trânsito**, o IP chega à Cloudflare (operadora, art. 5º VII) por necessidade técnica e é usado só para o
  limite de requisições. A Cloudflare pode processar fora do Brasil (transferência internacional, art. 33):
  mencionar na política.
- **Base legal:** legítimo interesse (art. 7º IX) para melhorar o jogo, com aviso no jogo, botão para desligar,
  DNT/GPC, minimização e retenção de 180 dias. Teste de balanceamento em `docs/LIA-legitimo-interesse.md`.
- **Transparência:** seção própria na política (âncoras `#microgame-mayhem`, `-pt`, `-en`; as do Escritório 17h58
  não mudam) e aviso na tela inicial, ambos publicados automaticamente junto com a ativação.
- **Direitos do titular:** como não há identificação, não há como localizar os dados de uma pessoa; dizer isso na
  política e manter o contato para dúvidas.

## Limite de requisições

Três camadas, todas precisam aprovar (`ingest/src/index.ts`):

| camada | o quê | número |
| --- | --- | --- |
| binding nativo por cliente (`RATE_LIMITER`) | chave = IPv4, ou o prefixo /64 do IPv6 (trocar de endereço dentro da mesma rede não escapa) | 100 a cada 10 s, por local da Cloudflare |
| binding nativo global (`GLOBAL_LIMITER`) | uma chave para todos: teto contra abuso vindo de muitos IPs | 300 a cada 10 s, por local |
| contador em memória | por instância do Worker; pega rajadas de um cliente que caem na mesma instância | 100 a cada 10 s |

- **Limitações (documentadas pela Cloudflare e medidas aqui):** os bindings são aproximados, contados por local e
  com consistência eventual. Funcionam com várias instâncias, mas deixam passar 2–4× o número sob rajada (medido:
  um cliente com 8 conexões teve ~200–400 aceitas a cada 10 s). Não existe limite global exato sem um Durable
  Object (1 requisição extra por lote, mais latência, mesma cota diária) ou regras de rate limiting do WAF (exigem
  domínio próprio na Cloudflare, isto é, mudar o DNS de maedodeam.com.br — fora de escopo).
- **CGNAT:** uma partida manda ~4 lotes em ~90 s (~0,5 por 10 s). 100 a cada 10 s comportam ~200 pessoas jogando ao
  mesmo tempo atrás do mesmo IP. A maioria dos celulares no Brasil já usa IPv6 (com /64 próprio).
- **Pior caso de abuso:** cada requisição escreve no máximo 2 linhas, então um atacante consegue ~30 escritas/s por
  local. No plano gratuito isso **não gera custo**: a cota diária acaba, a coleta para até 00:00 UTC e o jogo segue
  normal. No plano pago, o mesmo ataque custaria ~US$ 3/dia (escritas + requisições) — por isso a recomendação é
  ficar no gratuito enquanto couber e criar alertas de cobrança antes de mudar de plano.

## Consumo e custo (medido no D1 real)

| | antes | agora |
| --- | --- | --- |
| linhas escritas por partida típica (15 microgames, 22 eventos) | ~170 + ~170 na retenção | **5** (2 + 1 + 1 + 1) **+ 1** na retenção |
| lote reenviado (retry) | ~10 | **0** |
| linhas lidas por partida na ingestão | ~70 | ~44 |
| requisições por partida | ~17 | ~4 |
| tamanho por partida | ~5 KB em 4 tabelas | ~0,8 KB |

**Capacidade no plano gratuito** (vale o que acabar primeiro):

| recurso grátis por dia | por partida | partidas/dia |
| --- | --- | --- |
| D1: 100 mil linhas escritas | ~6 (+ agregação diária, ≤ ~1 mil linhas/dia no total) | **~16 mil** |
| Workers: 100 mil requisições | ~4 | ~25 mil |
| D1: 5 milhões de linhas lidas | ~44 na ingestão + ~45 na agregação | ~55 mil (sobra para o dashboard) |
| D1: 5 GB | ~0,8 KB × 180 dias | ~35 mil/dia em regime |

Antes: ~700–900 partidas/dia. Agora: **~16 mil partidas/dia sem custo** (~20× mais).

**Leituras do dashboard:** dias fechados vêm do agregado (poucas linhas); hoje vem dos eventos crus (~2 leituras
por evento); as partidas do período, ~5 leituras cada. No limite de 16 mil partidas/dia, cada carga lê ~1–1,5
milhão de linhas (~3 cargas/dia no gratuito); com 2 mil partidas/dia, ~0,2 milhão por carga.

**Se passar do gratuito — Workers Paid, US$ 5/mês** (preços de nov/2026):
- incluídos por mês: 10 milhões de requisições, 50 milhões de linhas escritas, 25 bilhões de linhas lidas, 5 GB;
- 50 mil partidas/dia ≈ 6 M requisições + 9 M escritas por mês: **cabe nos US$ 5**;
- 200 mil partidas/dia ≈ 24 M requisições (+US$ 4,20) e 36 M escritas (incluídas): **≈ US$ 9–10/mês**;
- excedentes: US$ 0,30 por milhão de requisições, US$ 1,00 por milhão de linhas escritas, US$ 0,75 por GB-mês.

## Ambientes publicados

| | teste (staging) | produção |
| --- | --- | --- |
| ingestão | `https://mm-telemetry-ingest-staging.maedodeam.workers.dev` (aceita só `http://127.0.0.1:8765` e `http://localhost:8765`) | `https://mm-telemetry-ingest.maedodeam.workers.dev` (aceita só `https://maedodeam.com.br`) |
| dashboard | `https://mm-telemetry-dashboard-staging.maedodeam.workers.dev` | `https://mm-telemetry-dashboard.maedodeam.workers.dev` |
| D1 | `mm-telemetry-staging` | `mm-telemetry` |
| Access | política "Cloudflare account" (membros da conta) + `ALLOWED_EMAILS` | política `somente-dono-telemetria` (só o seu e-mail) + `ALLOWED_EMAILS` |
| login | `databairro.cloudflareaccess.com` (time Zero Trust já existente na conta) | idem |

Os Workers estão publicados, mas **o jogo não envia nada**: `client.config.json` continua com `endpoint` vazio.

## Ativação (só com a sua autorização final)

1. Em `client.config.json`: `"endpoint": "https://mm-telemetry-ingest.maedodeam.workers.dev"`,
   `"policy_date"` = a data da publicação (AAAA-MM-DD), `"retention_days": 180`.
2. `npm run build` (PowerShell, com `SITE_CONTACT_EMAIL` carregado), `npm test`, `npm run e2e`,
   `python src/build.py --check`.
3. Conferir no diff: CSP do jogo só com esse endereço, aviso + botão na tela inicial, seção da política PT/EN.
4. Merge de `feat/telemetry` na `main` e push (o GitHub Actions publica).
5. Depois do deploy: jogar uma partida em `https://maedodeam.com.br/play/` e conferir no dashboard de produção.
6. Acompanhar o uso em Workers & Pages → Usage e D1 → Metrics nos primeiros dias.

### Checklist de pré-ativação (cada item tem teste automático)

| verificação | teste |
| --- | --- |
| partida sem Game Over não vira abandono confirmado | `stats.test.ts` → "partida sem Game Over e sem evento de saída NUNCA conta como abandono" |
| saída detectada ≠ abandono voluntário | `stats.test.ts` → "saída detectada (fechou a página) separada do abandono voluntário (saiu pelo menu)" |
| dashboard e todos os endpoints exigem autenticação válida | `dashboard.test.ts` → "sem token: 403 em todas as rotas…", "endereços alternativos e outros métodos…", "tokens adulterados…", "falha fechada" |
| processamento idempotente | `ingest.test.ts` → "o mesmo lote enviado duas vezes…", "dois lotes iguais chegando ao mesmo tempo…", "ordem de chegada não importa…", "reenvio idêntico não escreve nada"; `stats.test.ts` → agregação diária "dá exatamente o mesmo resultado" e "não duplica" |
| custo previsível sob abuso | `ingest.test.ts` → "lote máximo (30 eventos): 1 comando, 1 linha escrita", "um lote só pode ter uma partida", "IPv6 conta pelo prefixo /64", "teto global nativo" |
| jogo funciona com a telemetria fora do ar | `telemetry-client.test.ts` → "serviço fora do ar…"; validado também à mão com o servidor local derrubado (partida inteira até o Game Over) |
| partidas não confundidas com jogadores | `dashboard.test.ts` → "dashboard: partidas não são jogadores"; `stats.test.ts` (`sample.unit`) |
| mensagens de privacidade coerentes | `site.test.ts` (todas) e `privacy.test.ts` |
| retenção necessária e ajustável | justificativa na LIA; `site.test.ts` → "ligar … com retenção fora de 30–400 dias falha" e "a retenção do Worker é a mesma da política" |

**Rollback:** `"endpoint": ""` + `npm run build` + push: o jogo volta a não ter rede e a CSP volta a `'none'`.
Os Workers podem ser desligados ou apagados no painel sem afetar o jogo.
