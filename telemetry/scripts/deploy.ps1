# Roteiro GUIADO de publicação da telemetria na Cloudflare. Não roda nada sem você confirmar cada passo.
# Uso (PowerShell, na raiz do repositório):  .\telemetry\scripts\deploy.ps1
# Antes: leia telemetry/README.md ("Ativação"). Nada aqui altera o jogo publicado nem DNS de maedodeam.com.br.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$wrangler = "npx --yes wrangler@4"

function Step($title, $detail, [scriptblock]$action) {
  Write-Host ""
  Write-Host "== $title ==" -ForegroundColor Yellow
  Write-Host $detail
  $ok = Read-Host "Executar agora? (s/N)"
  if ($ok -eq "s") { & $action } else { Write-Host "pulado." }
}

Step "1. Login na Cloudflare" "Abre o navegador para você entrar na sua conta (o login é seu)." {
  Invoke-Expression "$wrangler login"
}

Step "2. Criar o banco D1 'mm-telemetry'" "Depois, copie o database_id mostrado para telemetry/ingest/wrangler.toml e telemetry/dashboard/wrangler.toml." {
  Invoke-Expression "$wrangler d1 create mm-telemetry"
}

Step "3. Aplicar o esquema (migrations) no D1 remoto" "Cria as tabelas runs, results, life_changes e seen_events." {
  Push-Location (Join-Path $root "telemetry\ingest")
  try { Invoke-Expression "$wrangler d1 migrations apply mm-telemetry --remote" } finally { Pop-Location }
}

Step "4. Publicar o Worker PÚBLICO de ingestão" "Cria https://mm-telemetry-ingest.<subdominio>.workers.dev (só POST /v1/events), o cron de retenção e o limitador." {
  Push-Location (Join-Path $root "telemetry\ingest")
  try { Invoke-Expression "$wrangler deploy" } finally { Pop-Location }
}

Step "5. Guardar os e-mails autorizados (secret do dashboard)" "Digite o(s) e-mail(s) quando o wrangler pedir. Fica só na Cloudflare, não no repositório." {
  Push-Location (Join-Path $root "telemetry\dashboard")
  try { Invoke-Expression "$wrangler secret put ALLOWED_EMAILS" } finally { Pop-Location }
}

Step "6. Publicar o Worker PRIVADO do dashboard" "Antes: ACCESS_TEAM_DOMAIN preenchido no wrangler.toml. Sem o Access configurado, o Worker nega tudo (falha fechada)." {
  Push-Location (Join-Path $root "telemetry\dashboard")
  try { Invoke-Expression "$wrangler deploy" } finally { Pop-Location }
}

Write-Host ""
Write-Host "Agora, no painel da Cloudflare:" -ForegroundColor Cyan
Write-Host " - Workers > mm-telemetry-dashboard > Settings > Domains & Routes > workers.dev > ligar Cloudflare Access"
Write-Host " - Zero Trust > Access > Applications: política Allow só para o seu e-mail; copiar o AUD para ACCESS_AUD"
Write-Host " - Preview URLs desligado nos dois Workers"
Write-Host " - Publicar o dashboard de novo (passo 6) depois de preencher ACCESS_AUD"
Write-Host ""
Write-Host "Ligar no jogo (só com autorização): telemetry/client.config.json -> endpoint; política de privacidade; npm run build; testes; commit; push."
