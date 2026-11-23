# Roteiro GUIADO de publicação da telemetria na Cloudflare. Nada roda sem você confirmar cada passo.
# Uso (PowerShell, na raiz do repositório):
#   .\telemetry\scripts\deploy.ps1 -Env staging      # ambiente de TESTE (banco e Workers "-staging")
#   .\telemetry\scripts\deploy.ps1 -Env production   # ambiente FINAL (só depois do teste validado)
# Nada aqui liga a coleta no jogo, altera o site publicado nem mexe em DNS de maedodeam.com.br.
param([ValidateSet("staging", "production")][string]$Env = "staging")
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$wrangler = "npx --yes wrangler@4"
$envFlag = if ($Env -eq "staging") { "--env staging" } else { "" }
$db = if ($Env -eq "staging") { "mm-telemetry-staging" } else { "mm-telemetry" }

function Step($title, $detail, [scriptblock]$action) {
  Write-Host ""
  Write-Host "== $title ==" -ForegroundColor Yellow
  Write-Host $detail
  $ok = Read-Host "Executar agora? (s/N)"
  if ($ok -eq "s") { & $action } else { Write-Host "pulado." }
}
function InDir($dir, $cmd) {
  Push-Location (Join-Path $root $dir)
  try { Invoke-Expression $cmd } finally { Pop-Location }
}

Write-Host "Ambiente: $Env  (banco $db)" -ForegroundColor Cyan

Step "1. Conferir o login" "Mostra a conta conectada (o login, se precisar, é você quem faz: $wrangler login)." {
  Invoke-Expression "$wrangler whoami"
}

Step "2. Criar o banco D1 '$db'" "Depois, copie o database_id mostrado para os DOIS wrangler.toml (seção do ambiente $Env)." {
  Invoke-Expression "$wrangler d1 create $db"
}

Step "3. Criar as tabelas (migrations) no D1 remoto" "Aplica telemetry/migrations no banco $db." {
  InDir "telemetry\ingest" "$wrangler d1 migrations apply $db --remote $envFlag"
}

Step "4. Publicar o Worker PÚBLICO de ingestão" "Só POST /v1/events. Endereço: https://mm-telemetry-ingest$(if ($Env -eq 'staging') {'-staging'}).<subdominio>.workers.dev" {
  InDir "telemetry\ingest" "$wrangler deploy $envFlag"
}

Step "5. Guardar o(s) e-mail(s) autorizado(s) no dashboard (secret)" "O wrangler pede o valor; ele fica só na Cloudflare, nunca no repositório." {
  InDir "telemetry\dashboard" "$wrangler secret put ALLOWED_EMAILS $envFlag"
}

Step "6. Publicar o Worker PRIVADO do dashboard" "Sem ACCESS_TEAM_DOMAIN/ACCESS_AUD preenchidos, ele nega tudo (falha fechada) — é seguro publicar antes do Access." {
  InDir "telemetry\dashboard" "$wrangler deploy $envFlag"
}

Write-Host ""
Write-Host "No painel da Cloudflare (você):" -ForegroundColor Cyan
Write-Host " a) Workers & Pages > mm-telemetry-dashboard$(if ($Env -eq 'staging') {'-staging'}) > Access > 'Protect this Worker behind Access' > All traffic"
Write-Host " b) Zero Trust > Access > Applications > (a aplicação criada) > política: Allow, Include 'Emails' = o seu e-mail"
Write-Host " c) Copie o 'Application Audience (AUD) Tag' para ACCESS_AUD e o team domain para ACCESS_TEAM_DOMAIN (wrangler.toml, seção $Env)"
Write-Host " d) Rode o passo 6 de novo"
Write-Host ""
Write-Host "Validar: node telemetry/scripts/validate-remote.mjs --ingest <url da ingestão> --dashboard <url do dashboard>"
