// Privacidade: o jogo não guarda nada e só fala com a rede pela telemetria opcional (telemetry/client.config.json).
// Com a telemetria desligada (padrão), o bundle não tem nenhuma API de rede. Verifica o código-fonte e o bundle publicado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TELEMETRY_URL = (JSON.parse(readFileSync(join(root, "telemetry", "client.config.json"), "utf8")).endpoint ?? "").trim();
const NETWORK = ["navigator.sendBeacon", "XMLHttpRequest", "WebSocket", "EventSource", "fetch("];

const FORBIDDEN = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document.cookie",
  "serviceWorker",
  "navigator.sendBeacon",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "fetch(",
  "caches.",
  "navigator.storage",
  "importScripts",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

test("código-fonte do jogo não usa armazenamento nem cookies; rede só no módulo de telemetria", () => {
  const hits: string[] = [];
  const teleDir = join(root, "game", "src", "telemetry");
  for (const f of walk(join(root, "game", "src"))) {
    const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const allowed = f.startsWith(teleDir) ? ["navigator.sendBeacon", "fetch("] : [];
    for (const word of FORBIDDEN) if (src.includes(word) && !allowed.includes(word)) hits.push(`${f.slice(root.length + 1)}: ${word}`);
  }
  assert.deepEqual(hits, []);
});

test("telemetria desligada: o build remove o módulo inteiro (nenhum rastro no bundle)", async () => {
  const { build } = await import("esbuild");
  const out = await build({
    entryPoints: [join(root, "game", "src", "main.ts")],
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
    define: { BOTS: "false", TELEMETRY_URL: '""', GAME_VERSION: '"test"' },
    logLevel: "silent",
  });
  const code = out.outputFiles[0].text;
  for (const word of [...NETWORK, "pagehide", "doNotTrack", "globalPrivacyControl", "game_start", "microgame_result", "v1/events"]) {
    assert.ok(!code.includes(word), `com a telemetria desligada, o bundle ainda tem "${word}"`);
  }
});

test("bundle publicado (assets/play/game.js) não usa APIs proibidas nem endereços externos", () => {
  const file = join(root, "assets", "play", "game.js");
  assert.ok(existsSync(file), "rode npm run build:game");
  const code = readFileSync(file, "utf8");
  // sem telemetria: nenhuma API de rede; com ela: só fetch/sendBeacon (o resto continua proibido)
  const allowed = TELEMETRY_URL ? ["navigator.sendBeacon", "fetch("] : [];
  for (const word of FORBIDDEN) if (!allowed.includes(word)) assert.ok(!code.includes(word), `bundle usa ${word}`);
  if (!TELEMETRY_URL) for (const word of NETWORK) assert.ok(!code.includes(word), `telemetria desligada, mas o bundle usa ${word}`);
  const urls = code.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
  // Só o namespace do SVG (não é uma requisição) e, com telemetria ligada, o endereço dela.
  const external = urls.filter((u) => !u.startsWith("http://www.w3.org/") && !(TELEMETRY_URL && u.startsWith(TELEMETRY_URL)));
  assert.deepEqual(external, []);
  assert.ok(!code.includes("BOTS"), "os bots de teste não podem ir para produção");
});

test("página do jogo só carrega arquivos locais", () => {
  const tpl = readFileSync(join(root, "src", "templates", "play.html"), "utf8");
  const refs = [...tpl.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const external = refs.filter((r) => /^https?:|^\/\//.test(r));
  assert.deepEqual(external, []);
  assert.ok(!/serviceWorker|manifest\.json/.test(tpl));
});

test("CSP da página do jogo acompanha a telemetria: 'none' desligada, só o serviço quando ligada", () => {
  for (const page of ["play/index.html", "pt-br/play/index.html"]) {
    const html = readFileSync(join(root, page), "utf8");
    const m = /connect-src ([^;"]+)/.exec(html);
    assert.ok(m, `${page}: sem connect-src`);
    if (!TELEMETRY_URL) assert.equal(m[1].trim(), "'none'", `${page}: telemetria desligada, mas a CSP libera ${m[1]}`);
    else assert.equal(m[1].trim(), new URL(TELEMETRY_URL).origin, `${page}: a CSP deve liberar só ${new URL(TELEMETRY_URL).origin}`);
  }
  for (const page of ["index.html", "pt-br/index.html", "privacy.html", "support.html"]) {
    const html = readFileSync(join(root, page), "utf8");
    assert.match(html, /connect-src 'none'/, `${page}: as outras páginas nunca falam com a rede`);
  }
});
