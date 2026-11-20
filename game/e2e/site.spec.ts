// O site institucional continua funcionando, agora com a entrada "Play" e a chamada na home.
import { test, expect } from "@playwright/test";

for (const [path, lang, play] of [
  ["/", "en", "play/"],
  ["/pt-br/", "pt-BR", "play/"],
] as const) {
  test(`home ${lang}: carrega sem erros, tem "Play" no menu e a chamada do jogo`, async ({ page }) => {
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
    await expect(page.locator(".site-nav .nav-play")).toBeVisible();
    await expect(page.locator(".site-nav .nav-play")).toHaveAttribute("href", play);
    await expect(page.locator(".arcade-btn")).toHaveAttribute("href", play);
    await expect(page.locator("#work")).toBeVisible();
    await expect(page.locator("#contact")).toBeAttached();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    expect(errs).toEqual([]);
  });
}

test("o atalho perto do título abre o jogo", async ({ page }) => {
  await page.goto("/pt-br/");
  await page.locator(".hero-play-btn").click();
  await expect(page).toHaveURL(/\/pt-br\/play\/$/);
  await expect(page.locator("#mm")).toHaveAttribute("data-ready", "true");
});

test("a chamada da home abre o jogo na mesma aba", async ({ page }) => {
  await page.goto("/");
  await page.locator(".arcade-btn").click();
  await expect(page).toHaveURL(/\/play\/$/);
  await expect(page.locator("#mm")).toHaveAttribute("data-ready", "true");
});

test("política de privacidade: os links do jogo Escritório 17h58 continuam funcionando", async ({ page }) => {
  for (const id of ["pt-BR", "en", "ko", "zh-CN"]) {
    await page.goto("/support.html");
    await page.goto(`/privacy.html#${id}`);
    await page.waitForTimeout(600);
    const top = await page.locator(`[id="${id}"]`).evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(200);
  }
});

test("CSP: todas as páginas têm a política, nada legítimo é bloqueado e código injetado não roda", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  for (const path of ["/", "/pt-br/", "/support.html", "/privacy.html", "/404.html", "/play/", "/pt-br/play/"]) {
    await page.goto(path);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), path).toEqual([]);
  }
  // um script injetado na página (como num ataque de XSS) é bloqueado
  const ran = await page.evaluate(async () => {
    const w = window as unknown as { __pwned?: boolean; __csp: string[] };
    const s = document.createElement("script");
    s.textContent = "window.__pwned = true";
    document.body.append(s);
    await new Promise((r) => setTimeout(r, 50));
    return { pwned: !!w.__pwned, violations: w.__csp.length };
  });
  expect(ran.pwned).toBe(false);
  expect(ran.violations).toBeGreaterThan(0);
});
