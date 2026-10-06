/* MAEDODEAM — melhorias progressivas. Sem JavaScript, o site funciona igual (só sem as animações). */
(() => {
  const d = document;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Rolagem suave nos links internos, só depois que o salto inicial para a âncora já aconteceu
  addEventListener("load", () => setTimeout(() => d.documentElement.classList.add("smooth"), 100), { once: true });

  // Cabeçalho com fundo depois de rolar
  const header = d.querySelector("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 8);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
  }

  if ("IntersectionObserver" in window) {
    // Revelação ao rolar
    const items = d.querySelectorAll("[data-reveal]");
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        seen.unobserve(e.target);
        if (e.target.matches("[data-count]")) count(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    if (!reduce) d.documentElement.classList.add("reveal-ready");
    items.forEach((el) => seen.observe(el));

    // Item do menu da seção visível
    const links = new Map();
    d.querySelectorAll('.site-nav a[href*="#"]').forEach((a) => {
      const id = a.hash.slice(1);
      const section = id && d.getElementById(id);
      if (section) links.set(section, a);
    });
    if (links.size) {
      const spy = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const a = links.get(e.target);
          if (e.isIntersecting) {
            links.forEach((l) => l.removeAttribute("aria-current"));
            a.setAttribute("aria-current", "true");
          } else if (a.hasAttribute("aria-current")) {
            a.removeAttribute("aria-current");
          }
        }
      }, { rootMargin: "-45% 0px -50% 0px" });
      links.forEach((_, section) => spy.observe(section));
    }
  }

  // Contagem dos números (ex.: 20 anos)
  function count(root) {
    if (reduce) return;
    root.querySelectorAll(".count").forEach((el) => {
      const end = parseInt(el.textContent, 10);
      if (!end) return;
      const t0 = performance.now();
      const dur = 900;
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    });
  }

  // Copiar e-mail
  d.querySelectorAll("[data-copy]").forEach((btn) => {
    if (!navigator.clipboard) return;
    const label = btn.textContent;
    btn.hidden = false;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = btn.dataset.done;
        btn.dataset.state = "done";
        setTimeout(() => { btn.textContent = label; delete btn.dataset.state; }, 2200);
      } catch { /* sem permissão: o link de e-mail continua ali */ }
    });
  });

  // 17:58 de verdade? Hora de ir embora.
  const now = new Date();
  const bench = d.querySelector("[data-bench-label]");
  if (bench && now.getHours() === 17 && now.getMinutes() === 58) {
    bench.textContent = bench.dataset.bus;
  }

  console.log(
    "%cMAEDODEAM_%c\nWe build things. You read consoles.\nWe should talk: maedodeam@gmail.com",
    "font: 800 16px/1.6 sans-serif; letter-spacing: .14em; color: #ff5a1f",
    "font: 12px/1.6 monospace; color: inherit"
  );
})();
