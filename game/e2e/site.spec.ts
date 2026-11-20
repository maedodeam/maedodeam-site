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
