// Tela de Game Over: frase do narrador + perfil de habilidades da partida (radar em SVG, ou barras com poucos eixos).
// Montado uma vez por Game Over com a API do DOM (sem bibliotecas, sem innerHTML). Não guarda nem envia nada.
import type { Lang } from "../core/types.ts";
import { tr } from "../core/i18n.ts";
import { MIN_RADAR_AXES, SKILL_NAMES, type Profile, type SkillKey, type SkillStat } from "../skills/profile.ts";
import { isShort, type Quip } from "../skills/quips.ts";

const SVG = "http://www.w3.org/2000/svg";
const R = 78; // raio do radar (unidades do viewBox)

const T = {
  best: { pt: "Melhor", en: "Best" },
  worst: { pt: "Pior", en: "Worst" },
  even: { pt: "Nenhuma habilidade se destacou nesta partida.", en: "No skill stood out this match." },
  few: { pt: "Poucas fases para um perfil — jogue mais uma!", en: "Too few levels for a profile — play another!" },
  thin: { pt: "Pouca amostra", en: "Too few to tell" },
  levels: { pt: "fases", en: "levels" },
  level: { pt: "fase", en: "level" },
  chart: { pt: "Perfil de habilidades desta partida", en: "This match's skill profile" },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svg(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

const name = (k: SkillKey, lang: Lang) => tr(SKILL_NAMES[k], lang);
const count = (n: number, lang: Lang) => `${n} ${tr(n === 1 ? T.level : T.levels, lang)}`;

/** Pontos do polígono para taxas 0..1 em cada eixo (o primeiro eixo aponta para cima). */
export function radarPoints(rates: readonly number[], radius = R): [number, number][] {
  const n = rates.length;
  return rates.map((r, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const d = Math.max(0, Math.min(1, r)) * radius;
    return [round1(Math.cos(a) * d), round1(Math.sin(a) * d)];
  });
}
const round1 = (x: number) => Math.round(x * 10) / 10;
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");

function radar(stats: SkillStat[], lang: Lang): SVGElement {
  const n = stats.length;
  const s = svg("svg", { viewBox: "-172 -130 344 260", class: "mm-radar-svg", role: "img", "aria-label": ariaLabel(stats, lang) });
  const grid = svg("g", { class: "mm-radar-grid", "aria-hidden": "true" });
  for (const f of [0.25, 0.5, 0.75, 1]) grid.append(svg("polygon", { points: pts(radarPoints(Array(n).fill(f))) }));
  for (const [x, y] of radarPoints(Array(n).fill(1))) grid.append(svg("line", { x1: 0, y1: 0, x2: x, y2: y }));
  s.append(grid);

  const shape = svg("g", { class: "mm-radar-shape", "aria-hidden": "true" });
  const vals = radarPoints(stats.map((x) => x.rate));
  shape.append(svg("polygon", { points: pts(vals) }));
  for (const [x, y] of vals) shape.append(svg("circle", { cx: x, cy: y, r: 3.6 }));
  s.append(shape);

  const labels = svg("g", { class: "mm-radar-labels", "aria-hidden": "true" });
  radarPoints(Array(n).fill(1), R + 13).forEach(([x, y], i) => {
    const st = stats[i];
    const anchor = Math.abs(x) < 8 ? "middle" : x > 0 ? "start" : "end";
    // rótulos de cima sobem, os de baixo descem; os do meio ficam centrados no eixo (em "em": o CSS pode aumentar a letra)
    const dy = y < -20 ? "-1.45em" : y > 20 ? "1.05em" : "-0.3em";
    const t = svg("text", { x, y, "text-anchor": anchor });
    t.append(svg("tspan", { class: "mm-radar-name", x, dy }, name(st.key, lang)));
    t.append(svg("tspan", { class: "mm-radar-val", x, dy: "1.2em" }, `${st.pct}% · ${st.n}`));
    labels.append(t);
  });
  s.append(labels);
  return s;
}

function bars(stats: SkillStat[], lang: Lang): HTMLElement {
  const ul = el("ul", "mm-skill-bars");
  for (const st of stats) {
    const li = el("li");
    li.append(el("span", "mm-skill-bar-name", name(st.key, lang)));
    const track = el("span", "mm-skill-bar");
    const fill = el("span", "mm-skill-bar-fill");
    fill.style.setProperty("--v", `${st.pct}%`);
    track.append(fill);
    li.append(track);
    li.append(el("span", "mm-skill-bar-val", `${st.pct}% · ${st.n}`));
    ul.append(li);
  }
  return ul;
}

function ariaLabel(stats: SkillStat[], lang: Lang): string {
  return tr(T.chart, lang) + ": " + stats.map((s) => `${name(s.key, lang)} ${s.pct}% (${count(s.n, lang)})`).join(", ");
}

/** Linha de resumo: melhor/pior só com amostra e diferença de verdade; senão, diz isso. */
export function summaryText(p: Profile, lang: Lang): string {
  if (isShort(p)) return tr(T.few, lang);
  const parts: string[] = [];
  if (p.best.length) parts.push(`${tr(T.best, lang)}: ${p.best.map((k) => name(k, lang)).join(", ")}`);
  if (p.worst.length) parts.push(`${tr(T.worst, lang)}: ${p.worst.map((k) => name(k, lang)).join(", ")}`);
  return parts.length ? parts.join(" · ") : tr(T.even, lang);
}

export interface SkillsDom {
  quip: HTMLElement;
  box: HTMLElement;
  chart: HTMLElement;
  summary: HTMLElement;
  thin: HTMLElement;
}

/** Preenche a frase e o perfil no Game Over. */
export function renderSkills(dom: SkillsDom, p: Profile, quip: Quip, lang: Lang): void {
  dom.quip.textContent = quip[lang];
  dom.quip.dataset.quip = quip.id;
  dom.quip.hidden = false;

  dom.chart.replaceChildren();
  // Radar só quando há um perfil de verdade; partida curta ganha barras discretas (sem cara de veredito)
  const shown = p.skills;
  const kind = shown.length >= MIN_RADAR_AXES && !isShort(p) ? "radar" : shown.length ? "bars" : "none";
  if (kind === "radar") dom.chart.append(radar(shown, lang));
  else if (kind === "bars") dom.chart.append(bars(shown, lang));
  dom.chart.dataset.kind = kind;
  dom.summary.textContent = summaryText(p, lang);
  dom.thin.textContent = p.thin.length ? `${tr(T.thin, lang)}: ${p.thin.map((k) => name(k, lang)).join(", ")}` : "";
  dom.thin.hidden = !p.thin.length;
  dom.box.hidden = false;
}

export function hideSkills(dom: SkillsDom): void {
  dom.quip.hidden = true;
  dom.box.hidden = true;
  dom.chart.replaceChildren();
}
