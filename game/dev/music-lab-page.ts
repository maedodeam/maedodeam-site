// Página do laboratório da trilha (desenvolvimento). Não fica no repositório como .html: é gerada em
// game/.dev/music-lab/ (ignorado pelo git; fora da lista de permissão de tools/dist.py) por game/scripts/music-lab.ts.
export const MUSIC_LAB_HTML = (engines: string[]) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Laboratório da trilha (local)</title>
<style>
  body { margin: 0; padding: 16px; background: #0d0d0b; color: #efece4; font: 13px/1.45 ui-monospace, "JetBrains Mono", monospace; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  p { color: #a8a498; margin: 0 0 12px; max-width: 80ch; }
  section { margin: 0 0 14px; }
  button { font: inherit; background: #23221f; color: #efece4; border: 1px solid #3d3b36; border-radius: 6px; padding: 6px 10px; margin: 0 6px 6px 0; cursor: pointer; }
  button.on { background: #ffcf3f; color: #0d0d0b; border-color: #ffcf3f; }
  #insts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 4px 12px; }
  #insts label { padding: 2px 4px; border-radius: 4px; }
  #insts label.playing { background: #1f2b29; }
  #insts button { padding: 1px 6px; margin: 0; font-size: 11px; }
  #status { color: #ffcf3f; min-height: 2.9em; }
  #lvl { color: #a8a498; min-height: 1.4em; }
  canvas { display: block; width: 100%; max-width: 720px; height: 150px; background: #151513; border: 1px solid #3d3b36; }
  select, input[type=range] { font: inherit; }
  button:disabled { opacity: .4; cursor: default; }
  @media (max-width: 600px) { body { padding: 12px; } }
</style>
</head>
<body>
<h1>Microgame Mayhem — laboratório da trilha</h1>
<p>Só local (não é publicado). Mesmo motor e mesma cadeia de saída do jogo. Desmarque instrumentos ou use “solo” para
achar o som que incomoda. Números do medidor ajudam, mas não provam que algo soa bem: ouça.</p>
<section>Versão: <select id="engine"></select> &nbsp; volume <input id="vol" type="range" min="0" max="1.5" step="0.05" value="1"></section>
<section id="bands"></section>
<section>
  <button id="stop">■ parar</button><button id="next">próxima volta / cena ▸</button><button id="speed">SPEED UP ▸ próximo nível</button>
  <label><input id="sim" type="checkbox"> simular a partida (contagem regressiva + vinhetas de vitória/derrota)</label>
</section>
<section id="vo" hidden>
  <b>Vozes do SPEED UP</b> — o botão SPEED UP acima usa estas escolhas (toque uma faixa de níveis antes).<br>
  Tratamento: <span id="voFx"></span><br>
  Fonte: <span id="voSrc"></span><br>
  Fala: <select id="voTake"></select> <button id="voSolo">▶ só a voz</button>
  &nbsp; volume da voz <input id="voVol" type="range" min="-18" max="6" step="1" value="0"> <span id="voVolTxt">0 dB</span><br><span id="voLast"></span>
</section>
<section id="status"></section>
<section><canvas id="spec" width="720" height="150"></canvas><div id="lvl"></div></section>
<section><button id="all">todos os instrumentos</button><div id="insts"></div></section>
${engines.map((e) => `<script src="engine-${e}.js"></script>`).join("\n")}
<script src="music-lab.js"></script>
</body>
</html>
`;
