// Mensagens de privacidade coerentes com a coleta: a MESMA chave (telemetry/client.config.json) liga a coleta,
// a CSP, o aviso e o botão na tela inicial, os textos e a seção da política — e desligada, nada disso aparece.
// Gera as páginas com src/build.py --print (não grava nada no disco).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CURRENT = JSON.parse(readFileSync(join(root, "telemetry", "client.config.json"), "utf8"));

function page(rel: string, cfg?: object): string {
  const env = { ...process.env, SITE_CONTACT_EMAIL: process.env.SITE_CONTACT_EMAIL || "teste@exemplo.invalid" } as Record<string, string>;
  if (cfg) {
    const f = join(mkdtempSync(join(tmpdir(), "tele-")), "cfg.json");
    writeFileSync(f, JSON.stringify(cfg));
    env.TELEMETRY_CONFIG = f;
  }
  return execFileSync("python", [join(root, "src", "build.py"), "--print", rel], { env, encoding: "utf8" });
}

const ON = { endpoint: "https://mm-telemetry-ingest.exemplo.workers.dev", policy_date: "2026-12-01", retention_days: 180 };
// textos que dizem "nada é guardado/enviado" e não podem aparecer com a coleta ligada
const OFF_TEXTS = ["Fechou a página, sumiu", "Close the page and it's gone", "nada salvo", "no saves", "Sem rastreadores", "No trackers"];
const ESCRITORIO_ANCHORS = ["pt-BR", "en", "es", "fr", "ja", "ko", "zh-CN", "escritorio-17h58", "contato"];

// Ativação autorizada em 2026-11-23: a configuração do repositório só pode apontar para a ingestão de produção.
const PROD = "https://mm-telemetry-ingest.maedodeam.workers.dev";

test("configuração atual: ligada só para a ingestão de produção, com aviso, botão e seção na política", () => {
  assert.equal(CURRENT.endpoint, PROD, "o jogo publicado só pode enviar para a ingestão de produção");
  assert.match(CURRENT.policy_date, /^\d{4}-\d{2}-\d{2}$/);
  for (const rel of ["play/index.html", "pt-br/play/index.html"]) {
    const play = page(rel);
    assert.ok(play.includes(`connect-src ${PROD};`), `${rel}: CSP só com a ingestão`);
    assert.match(play, /<button id="mm-metrics"[^>]+aria-pressed="true"/, `${rel}: botão para desligar`);
    for (const t of OFF_TEXTS) assert.ok(!play.includes(t), `${rel}: texto incoerente com a coleta: "${t}"`);
    assert.equal(play, readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n"), `${rel} em dia com a configuração`);
  }
  for (const rel of ["index.html", "pt-br/index.html", "support.html", "pt-br/support.html", "404.html"]) {
    assert.match(readFileSync(join(root, rel), "utf8"), /connect-src 'none'/, `${rel}: só a página do jogo fala com a rede`);
  }
  const pp = page("privacy.html");
  assert.ok(pp.includes('id="microgame-mayhem"'), "seção do Microgame Mayhem na política");
  assert.equal(pp, readFileSync(join(root, "privacy.html"), "utf8").replace(/\r\n/g, "\n"), "privacy.html em dia e idêntica");
});

test("ligada: CSP só para o serviço, aviso discreto + botão para desligar, sem textos de 'nada é coletado'", () => {
  for (const [rel, lang] of [
    ["pt-br/play/index.html", "pt"],
    ["play/index.html", "en"],
  ] as const) {
    const html = page(rel, ON);
    assert.match(html, /connect-src https:\/\/mm-telemetry-ingest\.exemplo\.workers\.dev;/, rel);
    assert.match(html, /<button id="mm-metrics"[^>]+aria-pressed="true"/, `${rel}: botão das métricas`);
    assert.match(html, new RegExp(`privacy\\.html#microgame-mayhem-${lang}`), `${rel}: link para a seção da política`);
    for (const t of OFF_TEXTS) assert.ok(!html.includes(t), `${rel}: texto incoerente com a coleta: "${t}"`);
  }
  for (const rel of ["index.html", "pt-br/index.html"]) {
    const html = page(rel, ON);
    assert.match(html, /connect-src 'none'/, `${rel}: só a página do jogo fala com a rede`);
    for (const t of OFF_TEXTS) assert.ok(!html.includes(t), `${rel}: texto incoerente com a coleta: "${t}"`);
  }
});

test("ligada: a política ganha a seção do Microgame Mayhem (PT e EN), com data e retenção da configuração, sem mexer nas âncoras do Escritório 17h58", () => {
  const pp = page("privacy.html", ON);
  for (const id of ["microgame-mayhem", "microgame-mayhem-pt", "microgame-mayhem-en"]) assert.ok(pp.includes(`id="${id}"`), id);
  for (const id of ESCRITORIO_ANCHORS) assert.equal(pp.split(`id="${id}"`).length - 1, 1, `âncora #${id} intacta e única`);
  assert.ok(pp.includes("Última atualização: 01/12/2026"));
  assert.ok(pp.includes("Last updated: December 1, 2026"));
  assert.ok(pp.includes("depois de 180 dias") && pp.includes("after 180 days"));
  assert.ok(pp.includes("legítimo interesse") && pp.includes("Global Privacy Control"));
  assert.ok(pp.includes("contam partidas, não pessoas") && pp.includes("count matches, not people"));
});

test("ligar sem data da política ou com retenção fora de 30–400 dias falha o build", () => {
  for (const bad of [{ ...ON, policy_date: "" }, { ...ON, retention_days: 1000 }, { ...ON, retention_days: 10 }, { ...ON, endpoint: "http://exemplo.com" }]) {
    assert.throws(() => page("privacy.html", bad), (e: unknown) => e instanceof Error, JSON.stringify(bad));
  }
});

test("a retenção do Worker é a mesma da política", () => {
  const toml = readFileSync(join(root, "telemetry", "ingest", "wrangler.toml"), "utf8");
  const m = /^RETENTION_DAYS\s*=\s*"(\d+)"/m.exec(toml);
  assert.ok(m, "RETENTION_DAYS no wrangler.toml");
  assert.equal(Number(m[1]), CURRENT.retention_days, "wrangler.toml e client.config.json precisam dizer o mesmo número de dias");
});
