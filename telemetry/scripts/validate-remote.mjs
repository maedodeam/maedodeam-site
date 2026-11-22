// Valida os Workers PUBLICADOS (staging ou produção), de fora, como um navegador/atacante faria.
// Uso: node telemetry/scripts/validate-remote.mjs --ingest https://mm-telemetry-ingest-staging.<sub>.workers.dev \
//        --dashboard https://mm-telemetry-dashboard-staging.<sub>.workers.dev [--origin http://127.0.0.1:8765] [--no-ratelimit]
// Envia uma partida sintética (marcada com versão "validacao") e imprime os ids para conferir no D1.
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const ingest = opt("ingest", "").replace(/\/+$/, "");
const dashboard = opt("dashboard", "").replace(/\/+$/, "");
const origin = opt("origin", "http://127.0.0.1:8765");
if (!ingest) {
  console.error("informe --ingest <url>");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const post = (body, o = {}) =>
  fetch(`${ingest}/v1/events`, {
    method: "POST",
    headers: { "content-type": o.type ?? "text/plain;charset=UTF-8", ...(o.origin === null ? {} : { origin: o.origin ?? origin }) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });

// ---------- ingestão ----------
const run = crypto.randomUUID();
let seq = 0;
const ev = (type, extra) => ({ id: crypto.randomUUID(), run, seq: seq++, type, t: seq * 3000, ver: "validacao", ...extra });
const batch = [
  ev("game_start", { lang: "pt", device: "desktop" }),
  ev("microgame_result", { n: 1, mg: "swat-fly", result: "win", level: 0, tier: 1, dur: 7, used: 2.1, lives: 4, input: "mouse" }),
  ev("microgame_result", { n: 2, mg: "quick-draw", result: "lose", level: 0.02, tier: 1, dur: 8.4, used: 1.3, lives: 3, input: "mouse" }),
  ev("life_changed", { n: 2, from: 4, to: 3, reason: "lose" }),
  ev("game_abandon", { n: 2, reason: "quit" }),
];

let r = await fetch(`${ingest}/v1/events`, { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST" } });
check("preflight CORS da origem do jogo", r.status === 204 && r.headers.get("access-control-allow-origin") === origin, `HTTP ${r.status}`);
r = await post({ v: 1, events: batch });
check("lote válido aceito (204, sem corpo)", r.status === 204 && (await r.text()) === "", `HTTP ${r.status}`);
r = await post({ v: 1, events: batch });
check("mesmo lote de novo aceito (idempotente)", r.status === 204, `HTTP ${r.status}`);
r = await post({ v: 1, events: batch }, { origin: "https://site-estranho.example" });
check("outra origem recusada", r.status === 403, `HTTP ${r.status}`);
r = await post({ v: 1, events: batch }, { origin: null });
check("sem origem recusado", r.status === 403, `HTTP ${r.status}`);
r = await post({ v: 1, events: [{ ...batch[1], id: crypto.randomUUID(), mg: "nao-existe" }] });
check("evento inválido recusado", r.status === 400, `HTTP ${r.status}`);
r = await post("x".repeat(40_000));
check("corpo grande demais recusado", r.status === 413, `HTTP ${r.status}`);
for (const path of ["/", "/api/summary", "/api/export.csv?kind=runs", "/admin", "/v1/stats"]) {
  r = await fetch(`${ingest}${path}`, { headers: { origin }, redirect: "manual" });
  check(`ingestão não tem leitura: GET ${path}`, r.status === 404, `HTTP ${r.status}`);
}
r = await fetch(`${ingest}/v1/events`, { headers: { origin } });
check("GET /v1/events não lê nada", r.status === 405 && (await r.text()) === "405", `HTTP ${r.status}`);

if (!args.includes("--no-ratelimit")) {
  // O limitador da Cloudflare é aproximado, por local e com consistência eventual: uma rajada simultânea
  // passa antes de os contadores sincronizarem. O que importa é segurar um fluxo contínuo (60 a cada 10 s).
  const fake = { v: 1, events: [{ ...batch[0], id: crypto.randomUUID(), run: crypto.randomUUID() }] };
  // 8 conexões contínuas (~bem acima de 6 req/s) até a primeira 429 ou 40 s
  const t0 = Date.now();
  let sent = 0;
  let firstBlock = 0;
  const lane = async () => {
    while (!firstBlock && sent < 2000 && Date.now() - t0 < 40_000) {
      const n = ++sent;
      if ((await post(fake)).status === 429 && !firstBlock) firstBlock = n;
    }
  };
  await Promise.all(Array.from({ length: 8 }, lane));
  check(
    "limite de requisições segura fluxo contínuo",
    firstBlock > 0,
    firstBlock ? `primeira 429 na requisição ${firstBlock}, após ${((Date.now() - t0) / 1000).toFixed(1)} s` : `nenhuma 429 em ${sent}`,
  );
}

// ---------- dashboard ----------
if (dashboard) {
  for (const path of ["/", "/api/summary", "/api/microgames", "/api/export.csv?kind=runs", "/app.js", "/nao-existe"]) {
    r = await fetch(`${dashboard}${path}`, { redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    const body = r.status === 200 ? await r.text() : "";
    const blocked = (r.status === 302 && /cloudflareaccess\.com/.test(loc)) || r.status === 401 || r.status === 403;
    check(`dashboard sem login bloqueado: ${path}`, blocked && !body.includes('"runs"'), `HTTP ${r.status}${loc ? " → " + new URL(loc).host : ""}`);
  }
  r = await fetch(`${dashboard}/api/summary`, { headers: { "cf-access-jwt-assertion": "a.b.c" }, redirect: "manual" });
  check("token do Access falso não abre a API", r.status !== 200, `HTTP ${r.status}`);
}

console.log("");
console.log(`partida de validação: run_id = ${run} (versão "validacao")`);
console.log(`conferir no D1: npx wrangler d1 execute <banco> --remote --command "SELECT status, abandon_reason, max_n, events, max_seq FROM runs WHERE run_id = '${run}'"`);
const failed = results.filter((x) => !x.ok);
console.log(failed.length ? `\n${failed.length} verificação(ões) falharam` : "\ntudo certo");
process.exit(failed.length ? 1 : 0);
