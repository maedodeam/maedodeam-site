// Privacidade: o jogo não guarda nem envia nada. Verifica o código-fonte e o bundle publicado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

test("código-fonte do jogo não usa armazenamento, rede nem cookies", () => {
  const hits: string[] = [];
  for (const f of walk(join(root, "game", "src"))) {
    const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const word of FORBIDDEN) if (src.includes(word)) hits.push(`${f.slice(root.length + 1)}: ${word}`);
  }
  assert.deepEqual(hits, []);
});

test("bundle publicado (assets/play/game.js) não usa APIs proibidas nem endereços externos", () => {
  const file = join(root, "assets", "play", "game.js");
  assert.ok(existsSync(file), "rode npm run build:game");
  const code = readFileSync(file, "utf8");
  for (const word of FORBIDDEN) assert.ok(!code.includes(word), `bundle usa ${word}`);
  const urls = code.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
  // Só o namespace do SVG é aceitável (não é uma requisição).
  const external = urls.filter((u) => !u.startsWith("http://www.w3.org/"));
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
