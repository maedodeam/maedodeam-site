// Peças visuais do trailer que não são do jogo: CSS do gravador, o bloco do encerramento e os textos promocionais.
// Usam as fontes e as cores do próprio site/jogo (Archivo, JetBrains Mono; tinta, papel e laranja).

/** Injetado na /play/ durante a gravação: esconde os botões da interface (pausa, som, tela cheia, voltar). */
export const TRAILER_CSS = `
.mm-bar, .mm-back { display: none !important; }
#tr-cursor { position: fixed; left: 0; top: 0; z-index: 50; pointer-events: none; display: none; transform-origin: 3px 3px;
  filter: drop-shadow(0 3px 3px rgba(0,0,0,.35)); }
#tr-cursor svg { display: block; }
body.tr-closing .mm-foot, body.tr-closing .mm-controls, body.tr-closing .mm-credit, body.tr-closing #mm-play { display: none !important; }
body.tr-closing .mm-title { grid-template-rows: 1fr; }
body.tr-closing .mm-hero { gap: 2.2rem; }
body.tr-closing .mm-kicker { font-size: 1.35rem; animation: tr-fade .4s ease-out .1s both; }
body.tr-closing .mm-logo { font-size: 15rem; animation: tr-punch .5s cubic-bezier(.2, 1.5, .4, 1) both; }
.tr-end { display: grid; justify-items: center; gap: 1.5rem; margin-top: .8rem; }
.tr-free { font-size: 4.2rem; padding: .38em 1.3em .42em; animation: tr-punch .45s cubic-bezier(.2, 1.6, .4, 1) .55s both; }
.tr-tag { margin: 0; font-family: var(--display); font-weight: 900; font-stretch: 70%; text-transform: uppercase; font-size: 3.3rem;
  letter-spacing: .02em; color: var(--text); animation: tr-up .35s cubic-bezier(.2, .9, .3, 1) .95s both; }
.tr-url { margin: 0; font-family: var(--mono); font-weight: 700; font-size: 2.6rem; color: var(--accent); letter-spacing: .02em;
  animation: tr-up .35s cubic-bezier(.2, .9, .3, 1) 1.2s both; }
.tr-credit { margin: .4rem 0 0; font-family: var(--mono); font-size: 1.15rem; color: var(--muted); letter-spacing: .06em;
  animation: tr-fade .4s ease-out 1.5s both; }
.tr-credit strong { color: var(--text); }
@keyframes tr-punch { from { transform: scale(1.6); opacity: 0; } 40% { opacity: 1; } to { transform: scale(1); opacity: 1; } }
@keyframes tr-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tr-fade { from { opacity: 0; } to { opacity: 1; } }
`;

/** Bloco do encerramento, colocado logo abaixo do logotipo da tela inicial. */
export const CLOSING_HTML = `
<span class="mm-btn mm-btn--play tr-free">Play for free</span>
<p class="tr-tag">No downloads. Just chaos.</p>
<p class="tr-url">maedodeam.com.br/play/</p>
<p class="tr-credit">Voices by <strong>RappaNui</strong></p>
`;

/** Página dos textos promocionais (fundo transparente). cardAt(t) posiciona todas as animações no instante t. */
export const CARD_HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
@font-face { font-family: "Archivo"; src: url(/assets/fonts/archivo-var.woff2) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "JetBrains Mono"; src: url(/assets/fonts/jetbrains-mono-var.woff2) format("woff2"); font-weight: 100 800; }
html, body { margin: 0; width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
.card { position: absolute; display: grid; gap: 14px; transform: rotate(-4deg); }
.bl { left: 96px; bottom: 120px; justify-items: start; }
.br { right: 96px; bottom: 120px; justify-items: end; transform: rotate(3deg); }
.tl { left: 80px; top: 92px; justify-items: start; transform: rotate(-4deg) scale(.72); transform-origin: top left; }
.tr { right: 80px; top: 92px; justify-items: end; transform: rotate(3deg) scale(.72); transform-origin: top right; }
.c { left: 0; right: 0; top: 50%; justify-items: center; transform: translateY(-50%) rotate(-3deg); }
.band { font-family: "Archivo"; font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .9; color: #0d0d0b;
  background: #ff5a1f; padding: 14px 30px 8px; font-size: 96px; letter-spacing: .01em; box-shadow: 12px 12px 0 #0d0d0b;
  border: 5px solid #0d0d0b; white-space: nowrap; }
.band.paper { background: #efece4; }
.band.sm { font-size: 64px; padding: 10px 24px 4px; }
.big { font-family: "Archivo"; font-weight: 900; font-stretch: 62%; line-height: .8; font-size: 300px; color: #ff5a1f;
  -webkit-text-stroke: 14px #0d0d0b; paint-order: stroke fill; text-shadow: 14px 16px 0 #0d0d0b; letter-spacing: -.01em; }
.big.paper { color: #efece4; }
</style></head>
<body>
<script>
const CARDS = {
  "300": { pos: "tl", items: ['<div class="big">300</div>', '<div class="band">Unique microgames</div>'] },
  "think": { pos: "tr", items: ['<div class="band paper">Think fast.</div>', '<div class="band">React faster.</div>'] },
  "faster": { pos: "br", items: ['<div class="band paper sm">It only gets</div>', '<div class="big">FASTER.</div>'] },
  "level50": { pos: "tr", items: ['<div class="band paper sm">Can you reach</div>', '<div class="big paper">LEVEL 50?</div>'] },
};
const q = new URLSearchParams(location.search);
const card = CARDS[q.get("id")];
const total = Number(q.get("s") || 2) * 1000;
const box = document.createElement("div");
box.className = "card " + card.pos;
box.innerHTML = card.items.join("");
document.body.append(box);
const anims = [];
[...box.children].forEach((el, i) => {
  const d = i * 110; // um depois do outro
  const dir = card.pos.endsWith("r") ? 1 : -1;
  anims.push(el.animate([
    { transform: "translateX(" + dir * 140 + "px) scale(1.25)", opacity: 0, offset: 0 },
    { transform: "translateX(" + -dir * 10 + "px) scale(.97)", opacity: 1, offset: 0.62 },
    { transform: "none", opacity: 1, offset: 1 },
  ], { duration: 260, delay: d, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" }));
  anims.push(el.animate([
    { transform: "none", opacity: 1 },
    { transform: "translateX(" + -dir * 90 + "px) skewX(" + dir * 12 + "deg)", opacity: 0 },
  ], { duration: 170, delay: total - 190 + i * 40, fill: "forwards", easing: "cubic-bezier(.6,0,.9,.4)", composite: "add" }));
});
anims.forEach((a) => a.pause());
window.cardAt = (t) => anims.forEach((a) => { a.currentTime = t * 1000; });
</script>
</body></html>`;
