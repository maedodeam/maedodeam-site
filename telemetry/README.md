# Telemetria de gameplay — Microgame Mayhem

Estado: **preparada e testada, DESLIGADA.** Nada foi publicado na Cloudflare, a CSP de produção continua
`connect-src 'none'` e o jogo publicado não tem nenhum código de rede. A ativação depende da sua autorização
(ver "Ativação" no fim).

## Arquitetura

```
Jogo (GitHub Pages, público, estático)
   │  POST /v1/events  (lotes pequenos, text/plain, sendBeacon ao sair)
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
| `client.config.json` | **a chave**: `endpoint` vazio = telemetria desligada (padrão) |
| `../game/src/telemetry/client.ts` | cliente no jogo (fila em memória, lotes, sendBeacon, DNT/GPC) |
| `migrations/0001_init.sql` | esquema D1 |
| `shared/` | contrato e validação (`validate.ts`), gravação idempotente (`store.ts`), estatísticas (`stats.ts`), catálogo gerado |
| `ingest/` | Worker público (`src/index.ts`, `wrangler.toml`) |
| `dashboard/` | Worker privado (`src/index.ts`, `src/access.ts`, `src/page.ts`, `wrangler.toml`) |
| `scripts/local.ts` | os dois Workers rodando local com SQLite (Access simulado só neste script) |
| `scripts/gen-catalog.ts` | regenera `shared/catalog.gen.ts` quando o catálogo do jogo muda |
| `scripts/deploy.ps1` | roteiro guiado de publicação (pede confirmação a cada passo) |
| `tests/` | testes (rodam no `npm test`) |
| `docs/politica-microgame-mayhem.html` | rascunho da seção da política de privacidade |

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

`runs` (uma linha por partida: início, último evento, versão, idioma, aparelho, estado, maior nível, placar,
contagem e maior `seq`), `results` (um resultado por linha), `life_changes`, `seen_events` (ids já
processados = idempotência). Detalhes em `migrations/0001_init.sql`.

- **Idempotência:** o mesmo evento duas vezes conta uma vez; a ordem de chegada não importa (máximos e o estado
  mais final: Game Over > abandono > aberta).
- **Abandono:**
  - *detectado* = evento `game_abandon` (`quit` ou `pagehide`);
  - *presumido* = sem fim e sem eventos há mais de `ABANDON_AFTER_MIN` (30 min, configurável);
  - *incompleta por comunicação* = presumida **e** com eventos faltando (lacuna em `seq` ou sem `game_start`).
- **Retenção:** cron diário apaga dados brutos com mais de `RETENTION_DAYS` (400 dias).

## Estratégia de envio

- `game_start`, `game_over` e `game_abandon` saem na hora; os demais esperam até 4 s ou 10 eventos.
- Aba ficando oculta: envia a fila com `sendBeacon`. Fechar a página no meio da partida: `game_abandon` por `sendBeacon`.
- Nunca aguarda a rede: `fetch` com `keepalive`, sem `await` no laço do jogo, tudo em `try/catch`.
- Offline: descarta. Depois de 3 falhas seguidas, desiste naquela aba. Fila só em memória, com limite de 100.
- Sem cookies/localStorage/sessionStorage/IndexedDB. Com Do Not Track ou Global Privacy Control, não envia nada.
- Telemetria desligada: o build **remove** o módulo do bundle; os testes e o `tools/dist.py` garantem que o jogo
  publicado não tem nenhuma API de rede e que a CSP do jogo é `connect-src 'none'`. Ligada: só `fetch`/`sendBeacon`,
  só para o endereço configurado, e a CSP do jogo libera só esse endereço (as outras páginas continuam `'none'`).

## Métricas do dashboard

Toda métrica mostra o tamanho da amostra. Filtros: período (início da partida, UTC), aparelho, dificuldade
(estatísticas por microgame) e versão.

- Partidas iniciadas; Game Over; abandonadas (detectado / presumido / incompletas por comunicação), em número e %.
- Nível = microgames concluídos na partida: média, mediana, moda, faixas, curva de progressão (% que chega ao N)
  e onde se abandona.
- Por microgame (os 300): tentativas, vitórias, derrotas, % de sucesso, partidas distintas, partidas com ao menos
  uma vitória, % médio do tempo usado. Tabela ordenável e filtrável.
- Ranking das maiores e menores taxas (só com amostra mínima, `RANKING_MIN_ATTEMPTS` = 30).
- Comparativos por aparelho (celular × tablet × computador), dificuldade, tipo (normal × WTF) e versão.
- CSV: microgames, partidas (anônimas) e progressão (com proteção contra fórmulas).

## Testar localmente (sem Cloudflare)

```powershell
node telemetry/scripts/local.ts
```
Ingestão em `http://127.0.0.1:8787`, dashboard em `http://127.0.0.1:8788`. Para o jogo mandar eventos para ele,
ponha temporariamente `"endpoint": "http://127.0.0.1:8787"` em `client.config.json`, rode `npm run build` e sirva o
site em `http://127.0.0.1:8765`. **Volte o endpoint para `""` e gere de novo antes de qualquer commit.**

## Segurança — resumo

- Ingestão: só `POST /v1/events`; CORS só para `https://maedodeam.com.br` (não é autenticação); corpo ≤ 32 KB;
  ≤ 30 eventos; validação estrita; limite por IP (120/min, limitador da Cloudflare; o IP não vai para o banco);
  limite de eventos por partida; respostas sem dados (204 ou código genérico).
- Eventos podem ser falsificados por quem quiser: os números são estatísticas de comportamento, não contabilidade.
  As defesas acima limitam o estrago (lixo validado e com teto), e o ranking exige amostra mínima.
- Dashboard: Access (só seu e-mail) + verificação do token no Worker (falha fechada) + `no-store`, `noindex`,
  CSP estrita, `frame-ancestors 'none'`, só GET. Nenhuma credencial no jogo nem no repositório (os e-mails autorizados são *secret*).

## LGPD — revisão (não é parecer jurídico)

- **Dados tratados:** eventos de jogo ligados a um UUID aleatório por partida, versão do jogo, idioma e um tipo de
  aparelho grosseiro. Nenhum nome, e-mail, IP armazenado, localização, impressão digital nem identificador
  persistente. Sem cruzamento com outras fontes, a reidentificação não é razoável — o objetivo é que os dados
  armazenados sejam anônimos (art. 12).
- **Em trânsito**, o IP chega à Cloudflare (operadora, art. 5º VII) por necessidade técnica e é usado só para o
  limite de requisições. A Cloudflare pode processar fora do Brasil (transferência internacional, art. 33):
  mencionar na política.
- **Base legal sugerida:** legítimo interesse (art. 7º IX) para melhorar o jogo, com transparência, minimização,
  opção de não participar (Do Not Track / GPC) e retenção limitada (400 dias). Registrar um teste de
  legítimo interesse (LIA) simples.
- **Transparência:** atualizar a política (rascunho em `docs/politica-microgame-mayhem.html`, nova seção com âncora
  própria, sem mexer nas âncoras do Escritório 17h58) e o aviso da tela inicial do jogo (já preparado: com a
  telemetria ligada, ele passa a dizer que há estatísticas anônimas).
- **Ponto de decisão seu:** o Escritório 17h58 usa consentimento (começa desligado). Para manter a mesma postura da
  marca, dá para pedir opt-in também aqui (uma pergunta por sessão, já que nada pode ser guardado). A proposta atual
  é legítimo interesse + aviso + DNT/GPC; confirme com quem cuida do jurídico.
- **Direitos do titular:** como não há identificação, não há como localizar os dados de uma pessoa; dizer isso na
  política e manter o contato para dúvidas.

## Ativação (só com a sua autorização)

O que você precisa autorizar e fazer na Cloudflare, nesta ordem (o `scripts/deploy.ps1` guia cada passo):

1. **Conta Cloudflare** (gratuita) e `npx wrangler login` — o login é feito por você no navegador.
2. **Subdomínio `workers.dev`** da conta (escolhido uma vez; aparece nos endereços dos dois Workers).
3. **D1:** criar o banco `mm-telemetry` e aplicar `migrations/` (`wrangler d1 create` + `d1 migrations apply --remote`).
   Copiar o `database_id` para os dois `wrangler.toml`.
4. **Worker de ingestão:** `wrangler deploy` em `telemetry/ingest`. Ativa: o endpoint público, o cron diário de
   retenção e o limitador de requisições.
5. **Zero Trust / Cloudflare Access** (plano gratuito; a Cloudflare pode pedir um meio de pagamento para ativar o
   Zero Trust, mesmo sem cobrar): criar o time (`<time>.cloudflareaccess.com`), o login por código no e-mail
   (One-time PIN) e uma política *Allow* só para o seu e-mail.
6. **Worker do dashboard:** definir `ACCESS_TEAM_DOMAIN` no `wrangler.toml`, `wrangler secret put ALLOWED_EMAILS`
   (o seu e-mail — fica só na Cloudflare) e `wrangler deploy` em `telemetry/dashboard`. Mesmo antes do Access, o
   Worker nega tudo (falha fechada).
7. **Ligar o Access no `workers.dev` do dashboard** (Workers → mm-telemetry-dashboard → Settings → Domains & Routes →
   workers.dev → Cloudflare Access) e copiar o **AUD** da aplicação criada para `ACCESS_AUD`; publicar de novo.
   Conferir que **Preview URLs** está desligado nos dois Workers.
8. **Verificar:** sem login, o dashboard pede o código do Access e a API responde 403; a ingestão responde 404 em
   qualquer caminho de leitura.
9. **Ligar no jogo:** `client.config.json` → `"endpoint": "https://mm-telemetry-ingest.<sub>.workers.dev"`;
   inserir a seção da política em `privacy.html`; `npm run build`; testes; commit; push na `main` (o GitHub Actions
   publica). Isso altera a CSP de produção do jogo para liberar só esse endereço.

**Rollback:** `"endpoint": ""` + `npm run build` + push: o jogo volta a não ter rede e a CSP volta a `'none'`.
Os Workers podem ser desligados ou apagados no painel sem afetar o jogo.
