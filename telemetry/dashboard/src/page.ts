// Interface do dashboard (HTML + CSS + JS servidos pelo próprio Worker, sem bibliotecas externas).
// Os dados entram na página só por textContent (nada de innerHTML com valores do banco).

export const PAGE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Microgame Mayhem — métricas</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header>
  <h1>Microgame Mayhem <span>métricas privadas</span></h1>
  <form id="filters">
    <label>De <input type="date" name="from"></label>
    <label>Até <input type="date" name="to"></label>
    <label>Aparelho <select name="device"><option value="">todos</option><option value="mobile">celular</option><option value="tablet">tablet</option><option value="desktop">computador</option></select></label>
    <label>Dificuldade <select name="difficulty"><option value="">todas</option><option value="1">●○○</option><option value="2">●●○</option><option value="3">●●●</option></select></label>
    <label>Versão <select name="version"><option value="">todas</option></select></label>
    <button type="submit">Aplicar</button>
  </form>
  <p class="note" id="who"></p>
  <p class="note unit">Tudo aqui conta <strong>partidas</strong> (sessões de jogo), não jogadores: não existe identificador de pessoa, então não há contagem de jogadores únicos. Uma pessoa que joga 5 vezes são 5 partidas.</p>
</header>
<main>
  <section><h2>Resumo <small id="n-summary"></small></h2><div class="cards" id="cards"></div><p class="note" id="abandon-note"></p></section>
  <section class="two">
    <div><h2>Níveis finais por faixa <small id="n-bands"></small></h2><div id="bands" class="chart"></div></div>
    <div><h2>Progressão: % que chega ao microgame N <small id="n-prog"></small></h2><div id="progression" class="chart"></div></div>
  </section>
  <section class="two">
    <div><h2>Abandono voluntário (saiu pelo menu): em que ponto <small id="n-ab"></small></h2><div id="abandon" class="chart"></div></div>
    <div><h2>Saída detectada (fechou a página): em que ponto <small id="n-ex"></small></h2><div id="exits" class="chart"></div></div>
  </section>
  <section><h2>Sem fim registrado: última posição conhecida <small id="n-ne"></small></h2><div id="noend" class="chart"></div></section>
  <section><h2>Comparativos</h2><div id="compare" class="grid"></div></section>
  <section class="two">
    <div><h2>Maiores taxas de sucesso <small id="n-rank"></small></h2><ol id="easiest" class="rank"></ol></div>
    <div><h2>Menores taxas de sucesso</h2><ol id="hardest" class="rank"></ol></div>
  </section>
  <section>
    <h2>Os 300 microgames <small id="n-mg"></small></h2>
    <p class="actions">
      <a id="csv-mg" href="#">CSV dos microgames</a> · <a id="csv-runs" href="#">CSV das partidas</a> · <a id="csv-levels" href="#">CSV da progressão</a>
      · <input id="mg-filter" type="search" placeholder="filtrar por nome ou número">
    </p>
    <div class="table-wrap"><table id="mg"><thead><tr></tr></thead><tbody></tbody></table></div>
  </section>
</main>
<script src="/app.js"></script>
</body>
</html>
`;

export const APP_CSS = `
:root { --ink:#0d0d0b; --ink2:#1b1a17; --line:#35332e; --paper:#efece4; --muted:#a8a498; --accent:#ff5a1f; --ok:#3ccf7a; --bad:#ff3b3b; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ink); color: var(--paper); font: 14px/1.45 system-ui, sans-serif; }
header { padding: 16px 20px; border-bottom: 1px solid var(--line); background: var(--ink2); position: sticky; top: 0; z-index: 2; }
h1 { margin: 0 0 10px; font-size: 20px; } h1 span { color: var(--muted); font-weight: 400; font-size: 14px; }
h2 { font-size: 15px; margin: 0 0 10px; } h2 small { color: var(--muted); font-weight: 400; }
form { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: end; }
label { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
input, select, button { font: inherit; color: inherit; background: var(--ink); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; }
button { background: var(--accent); color: var(--ink); border-color: var(--accent); font-weight: 700; cursor: pointer; }
main { padding: 16px 20px 40px; display: grid; gap: 22px; }
section { background: var(--ink2); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; background: none; border: 0; padding: 0; }
.two > div { background: var(--ink2); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
.card b { display: block; font-size: 22px; } .card span { color: var(--muted); font-size: 12px; } .card i { color: var(--muted); font-style: normal; font-size: 11px; display: block; }
.note { color: var(--muted); font-size: 12px; margin: 8px 0 0; }
.note.unit { color: var(--paper); }
.chart svg { width: 100%; height: auto; display: block; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border-bottom: 1px solid var(--line); padding: 4px 8px; text-align: right; white-space: nowrap; }
th:nth-child(2), td:nth-child(2) { text-align: left; }
th { cursor: pointer; color: var(--muted); position: sticky; top: 0; background: var(--ink2); }
th.sorted { color: var(--accent); }
.table-wrap { max-height: 70vh; overflow: auto; }
.rank { margin: 0; padding-left: 22px; } .rank li { margin: 2px 0; }
.actions a { color: var(--accent); }
.empty { color: var(--muted); }
@media (max-width: 800px) { .two { grid-template-columns: 1fr; } }
`;

export const APP_JS = `"use strict";
const $ = (id) => document.getElementById(id);
const form = $("filters");
const fmt = (v, suf = "") => (v == null ? "—" : String(v).replace(".", ",") + suf);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

function query() {
  const p = new URLSearchParams();
  for (const [k, v] of new FormData(form)) if (v) p.set(k, String(v));
  return p;
}
async function get(path) {
  const r = await fetch(path + "?" + query().toString(), { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) throw new Error(path + ": " + r.status);
  return r.json();
}

function card(label, value, sub) {
  const c = el("div", null, "card");
  c.append(el("b", value), el("span", label));
  if (sub) c.append(el("i", sub));
  return c;
}

/** Barras horizontais em SVG. rows: [{label, value, sub}] */
function bars(target, rows, unit) {
  target.replaceChildren();
  if (!rows.length || rows.every((r) => !r.value)) { target.append(el("p", "Sem dados neste filtro.", "empty")); return; }
  const max = Math.max(...rows.map((r) => r.value || 0)) || 1;
  const h = 22, w = 560, lw = 90;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + w + " " + (rows.length * h + 4));
  rows.forEach((r, i) => {
    const y = i * h + 2;
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", lw - 6); t.setAttribute("y", y + 15); t.setAttribute("text-anchor", "end"); t.setAttribute("fill", "#a8a498"); t.setAttribute("font-size", "12");
    t.textContent = r.label; svg.append(t);
    const bw = Math.max(1, ((w - lw - 120) * (r.value || 0)) / max);
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", lw); rect.setAttribute("y", y + 3); rect.setAttribute("width", bw); rect.setAttribute("height", h - 6); rect.setAttribute("rx", "3"); rect.setAttribute("fill", "#ff5a1f");
    svg.append(rect);
    const v = document.createElementNS(ns, "text");
    v.setAttribute("x", lw + bw + 6); v.setAttribute("y", y + 15); v.setAttribute("fill", "#efece4"); v.setAttribute("font-size", "12");
    v.textContent = fmt(r.value, unit) + (r.sub ? "  (" + r.sub + ")" : ""); svg.append(v);
  });
  target.append(svg);
}

function table(target, headers, rows) {
  const t = el("table");
  const tr = el("tr"); headers.forEach((h) => tr.append(el("th", h))); t.append(el("thead")); t.tHead.append(tr);
  const tb = el("tbody");
  rows.forEach((r) => { const row = el("tr"); r.forEach((c) => row.append(el("td", fmt(c)))); tb.append(row); });
  t.append(tb); target.append(t);
}

const COLS = [
  ["num", "#"], ["name_pt", "Microgame"], ["difficulty", "Dif."], ["wtf", "WTF"], ["attempts", "Tentativas"], ["wins", "Vitórias"],
  ["losses", "Derrotas"], ["success_pct", "Sucesso %"], ["runs", "Partidas"], ["runs_won", "Partidas c/ vitória"], ["avg_time_used_pct", "Tempo usado %"],
];
let mgRows = [], sortKey = "num", sortDir = 1;
function renderMg() {
  const q = $("mg-filter").value.trim().toLowerCase();
  const head = $("mg").tHead.rows[0];
  head.replaceChildren(...COLS.map(([k, label]) => {
    const th = el("th", label + (k === sortKey ? (sortDir > 0 ? " ▲" : " ▼") : ""), k === sortKey ? "sorted" : "");
    th.addEventListener("click", () => { sortDir = sortKey === k ? -sortDir : (k === "num" || k === "name_pt" ? 1 : -1); sortKey = k; renderMg(); });
    return th;
  }));
  const rows = mgRows
    .filter((m) => !q || m.name_pt.toLowerCase().includes(q) || m.name_en.toLowerCase().includes(q) || String(m.num) === q || m.id.includes(q))
    .sort((a, b) => { const x = a[sortKey], y = b[sortKey]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * sortDir; });
  const tb = $("mg").tBodies[0];
  tb.replaceChildren(...rows.map((m) => {
    const tr = el("tr");
    for (const [k] of COLS) tr.append(el("td", k === "difficulty" ? "●".repeat(m[k]) : k === "wtf" ? (m.wtf ? "🤪" + (m.wtf === "insane" ? "🤪" : "") : "") : fmt(m[k])));
    return tr;
  }));
}

async function load() {
  const csv = (kind) => "/api/export.csv?" + new URLSearchParams([...query(), ["kind", kind]]).toString();
  $("csv-mg").href = csv("microgames"); $("csv-runs").href = csv("runs"); $("csv-levels").href = csv("levels");
  const [s, m, c] = await Promise.all([get("/api/summary"), get("/api/microgames"), get("/api/compare")]);
  $("who").textContent = "Acesso: " + s.user + " · horários em UTC · abandono presumido após " + s.abandon_after_min + " min sem eventos";
  const r = s.runs;
  $("n-summary").textContent = "n = " + r.total + " partidas (" + r.finished + " sem atividade recente, " + r.in_progress + " em andamento)";
  $("cards").replaceChildren(
    card("Partidas iniciadas", fmt(r.total), r.start_missing ? r.start_missing + " sem game_start recebido" : "partidas, não jogadores"),
    card("Game Over", fmt(r.game_over.n), fmt(r.game_over.pct, "% · fim confirmado")),
    card("Abandono voluntário", fmt(r.abandon_voluntary.n), fmt(r.abandon_voluntary.pct, "% · saiu pelo menu")),
    card("Saída detectada", fmt(r.exit_detected.n), fmt(r.exit_detected.pct, "% · fechou/trocou de página")),
    card("Sem fim registrado", fmt(r.no_end.n), fmt(r.no_end.pct, "% · não confirmado")),
    card("· presumido", fmt(r.no_end_presumed.n), "sequência completa, parou de enviar"),
    card("· falha de envio", fmt(r.no_end_comm.n), "faltam eventos"),
    card("Nível médio", fmt(s.levels.mean), "n = " + s.levels.n + " partidas"),
    card("Nível mediano", fmt(s.levels.median), "n = " + s.levels.n + " partidas"),
    card("Nível mais frequente", fmt(s.levels.mode), "moda · n = " + s.levels.n + " partidas"),
  );
  $("abandon-note").textContent = "Nível = microgames concluídos na partida (0 = saiu durante o primeiro). Percentuais sobre as partidas sem atividade recente. Abandono voluntário = saiu pelo menu (escolha de parar). Saída detectada = a página foi fechada ou trocada no meio da partida: registrada, mas não tratada como decisão de abandonar. \\"Sem fim registrado\\" = sem Game Over e sem aviso de saída há mais de " + s.abandon_after_min + " min (presumido = sequência completa; falha de envio = faltam eventos): não é abandono.";
  $("n-bands").textContent = "n = " + s.levels.n;
  bars($("bands"), s.levels.bands.map((b) => ({ label: b.band, value: b.runs, sub: fmt(b.pct, "%") })));
  $("n-prog").textContent = "n = " + s.levels.n;
  bars($("progression"), s.progression.filter((p) => p.k <= 40).map((p) => ({ label: "≥ " + p.k, value: p.pct, sub: p.reached })), "%");
  const sum = (k) => s.abandon_at.reduce((a, b) => a + b[k], 0);
  $("n-ab").textContent = "n = " + sum("voluntary") + " partidas";
  $("n-ex").textContent = "n = " + sum("exit_detected") + " partidas";
  $("n-ne").textContent = "n = " + sum("no_end") + " partidas";
  bars($("abandon"), s.abandon_at.filter((a) => a.voluntary).slice(0, 40).map((a) => ({ label: "#" + a.n, value: a.voluntary })));
  bars($("exits"), s.abandon_at.filter((a) => a.exit_detected).slice(0, 40).map((a) => ({ label: "#" + a.n, value: a.exit_detected })));
  bars($("noend"), s.abandon_at.filter((a) => a.no_end).slice(0, 40).map((a) => ({ label: "#" + a.n, value: a.no_end })));

  const cmp = $("compare"); cmp.replaceChildren();
  const box = (title, headers, rows) => { const d = el("div"); d.append(el("h2", title)); table(d, headers, rows); cmp.append(d); };
  const devName = { mobile: "celular", tablet: "tablet", desktop: "computador" };
  box("Partidas por aparelho", ["Aparelho", "Partidas", "Sem atividade", "Nível médio", "Game Over %", "Abandono voluntário %", "Saída detectada %", "Sem fim %"], c.device.runs.map((x) => [devName[x.key] || x.key, x.runs, x.finished, x.mean_level, x.over_pct, x.voluntary_pct, x.exit_pct, x.no_end_pct]));
  box("Sucesso por aparelho", ["Aparelho", "Tentativas", "Sucesso %"], c.device.results.map((x) => [devName[x.key] || x.key, x.attempts, x.success_pct]));
  box("Sucesso por dificuldade", ["Dificuldade", "Tentativas", "Sucesso %"], c.difficulty.map((x) => ["●".repeat(Number(x.key)) || x.key, x.attempts, x.success_pct]));
  box("Sucesso por tipo", ["Tipo", "Tentativas", "Sucesso %"], c.wtf.map((x) => [x.key === "" ? "normal" : "WTF " + x.key, x.attempts, x.success_pct]));
  box("Por versão do jogo", ["Versão", "Partidas", "Nível médio", "Game Over %", "Abandono voluntário %", "Saída detectada %", "Sem fim %"], c.version.runs.map((x) => [x.key, x.runs, x.mean_level, x.over_pct, x.voluntary_pct, x.exit_pct, x.no_end_pct]));
  box("Sucesso por versão", ["Versão", "Tentativas", "Sucesso %"], c.version.results.map((x) => [x.key, x.attempts, x.success_pct]));

  const rk = m.ranking;
  $("n-rank").textContent = "entre " + rk.eligible + " microgames com ≥ " + rk.min_attempts + " tentativas";
  const li = (x) => el("li", "#" + x.num + " " + x.name_pt + " — " + fmt(x.success_pct, "%") + " (n = " + x.attempts + ")");
  $("easiest").replaceChildren(...(rk.easiest.length ? rk.easiest.map(li) : [el("li", "amostra insuficiente", "empty")]));
  $("hardest").replaceChildren(...(rk.hardest.length ? rk.hardest.map(li) : [el("li", "amostra insuficiente", "empty")]));
  $("n-mg").textContent = "n = " + m.sample.attempts + " tentativas · " + m.sample.microgames_with_data + " microgames com dados";
  mgRows = m.microgames; renderMg();
}

async function loadVersions() {
  try {
    const v = await get("/api/versions");
    const sel = form.elements.namedItem("version");
    for (const x of v.versions) sel.append(new Option(x, x));
  } catch {}
}
form.addEventListener("submit", (e) => { e.preventDefault(); load().catch((err) => alert("Erro ao carregar: " + err.message)); });
$("mg-filter").addEventListener("input", renderMg);
loadVersions();
load().catch((err) => alert("Erro ao carregar: " + err.message));
`;
