// Todos os microgames num navegador de verdade (canvas real, fontes reais), com os bots jogando.
// Usa a galeria de desenvolvimento (bundle com bots, gerado no global-setup).
import { test, expect } from "@playwright/test";

for (const stage of ["landscape", "portrait"] as const) {
  test(`todos os microgames rodam e o bot vence no navegador (${stage})`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1366", "uma vez basta: o canvas é o mesmo em todos os projetos");
    test.slow();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(`/game/dev/gallery.html?stage=${stage}&level=1&bot=win&times=1&cell=120`);
    await page.waitForSelector("body[data-done]", { timeout: 170_000 });
    const rows = await page.locator(".row h2").allTextContents();
    expect(rows.length).toBeGreaterThanOrEqual(100);
    const notWon = rows.filter((r) => !/bot win: win/.test(r));
    expect(notWon, notWon.join("\n")).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { galleryErrors: string[] }).galleryErrors)).toEqual([]);
    expect(errs).toEqual([]);
  });
}
