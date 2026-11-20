// Ponta a ponta do jogo: carregamento, partida completa até o fim, reinício, pausa, teclado, idiomas,
// redimensionamento, privacidade (sem rede depois de carregar, sem armazenamento) e ausência de erros.
import { test, expect, type Page } from "@playwright/test";

/** Registra qualquer tentativa de guardar dados (antes de o jogo carregar). */
async function spyStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __storage: string[] };
    w.__storage = [];
    const note = (what: string) => w.__storage.push(what);
    for (const m of ["setItem", "getItem", "removeItem", "clear", "key"] as const) {
      const orig = Storage.prototype[m] as (...a: unknown[]) => unknown;
      Storage.prototype[m] = function (this: Storage, ...a: unknown[]) {
        note(`Storage.${m}`);
        return orig.apply(this, a);
      } as never;
    }
    const idb = window.indexedDB;
    if (idb) idb.open = ((...a: Parameters<IDBFactory["open"]>) => (note("indexedDB.open"), IDBFactory.prototype.open.apply(idb, a))) as never;
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (desc)
      Object.defineProperty(document, "cookie", {
        get() {
          note("cookie.get");
          return desc.get!.call(document);
        },
        set(v) {
          note("cookie.set");
          desc.set!.call(document, v);
        },
      });
    if (navigator.serviceWorker) navigator.serviceWorker.register = (() => (note("serviceWorker"), Promise.reject())) as never;
  });
}

function trackErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });
  return errs;
}

async function openGame(page: Page, path = "/play/"): Promise<void> {
  await page.goto(path);
  await expect(page.locator("#mm")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#mm-play")).toBeEnabled();
}

async function press(page: Page, sel: string): Promise<void> {
  const el = page.locator(sel);
  if (test.info().project.use.hasTouch) await el.tap();
  else await el.click();
}

test("carrega a tela inicial, sem erros, com o palco ocupando a tela", async ({ page }) => {
  const errs = trackErrors(page);
  await openGame(page);
  await expect(page.locator("#mm-title")).toBeVisible();
  await expect(page.locator("#mm-play")).toHaveText(/PLAY/);
  await expect(page.locator(".mm-back").first()).toHaveAttribute("href", "../");
  const box = await page.locator("#mm-canvas").boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBeGreaterThan(vp.width * 0.95);
  expect(box!.height).toBeGreaterThan(vp.height * 0.9);
  // o canvas está desenhado na resolução do aparelho
  const px = await page.locator("#mm-canvas").evaluate((c: HTMLCanvasElement) => [c.width, c.clientWidth]);
  expect(px[0]).toBeGreaterThanOrEqual(px[1]);
  // a página não rola
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight, innerHeight]);
  expect(scroll[0]).toBeLessThanOrEqual(scroll[1]);
  expect(scroll[2]).toBeLessThanOrEqual(scroll[3]);
  expect(errs).toEqual([]);
});

test("partida completa: joga até perder as 4 vidas, vê o fim, joga de novo — sem rede e sem armazenamento", async ({ page, context }) => {
  test.slow();
  await spyStorage(page);
  const errs = trackErrors(page);
  await openGame(page);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await press(page, "#mm-play");
  await expect(page.locator("#mm")).toHaveAttribute("data-screen", "game");
  await expect(page.locator("#mm-title")).toBeHidden();
  // Sem tocar em nada: microgames de "cumprir objetivo" acabam em derrota; uma hora as vidas acabam.
  await expect(page.locator("#mm-over")).toBeVisible({ timeout: 150_000 });
  await expect(page.locator("#mm-score")).toHaveText(/^\d+$/);
  expect(Number(await page.locator("#mm-played").textContent())).toBeGreaterThanOrEqual(4);
  await expect(page.locator("#mm-lostto")).not.toHaveText("—");

  await press(page, "#mm-again");
  await expect(page.locator("#mm-over")).toBeHidden();
  await expect(page.locator("#mm")).toHaveAttribute("data-screen", "game");
  await page.waitForTimeout(2500);

  expect(requests, "nenhuma requisição depois do carregamento").toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __storage: string[] }).__storage)).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(errs).toEqual([]);
});

test("pausa e continua (botão e tecla Esc); troca de aba pausa sozinha", async ({ page }) => {
  await openGame(page);
  await press(page, "#mm-play");
  await expect(page.locator("#mm-pause")).toBeVisible();
  await press(page, "#mm-pause");
  await expect(page.locator("#mm-paused")).toBeVisible();
  await press(page, "#mm-resume");
  await expect(page.locator("#mm-paused")).toBeHidden();
  if (!test.info().project.use.hasTouch) {
    await page.keyboard.press("Escape");
    await expect(page.locator("#mm-paused")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mm-paused")).toBeHidden();
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#mm-paused")).toBeVisible();
  await press(page, "#mm-quit");
  await expect(page.locator("#mm-title")).toBeVisible();
});

test("teclado: Enter no PLAY começa; Espaço joga sem rolar a página", async ({ page }) => {
  test.skip(!!test.info().project.use.hasTouch, "teclado não se aplica ao celular");
  await openGame(page);
  await page.locator("#mm-play").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mm")).toHaveAttribute("data-screen", "game");
  for (let i = 0; i < 10; i++) await page.keyboard.press("Space");
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("som liga e desliga; tela cheia quando disponível", async ({ page }) => {
  await openGame(page);
  const sound = page.locator("#mm-sound");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await press(page, "#mm-sound");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await press(page, "#mm-sound");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  const fs = await page.evaluate(() => document.fullscreenEnabled);
  await expect(page.locator("#mm-full")).toBeVisible({ visible: fs });
});

test("português: /pt-br/play/ em PT-BR, com seletor de idioma e link de volta", async ({ page }) => {
  await openGame(page, "/pt-br/play/");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("pt-BR");
  await expect(page.locator("#mm-play")).toHaveText("JOGAR");
  await expect(page.locator(".lang a[hreflang='en']")).toHaveAttribute("href", "../../play/");
  await press(page, ".mm-title .mm-back");
  await expect(page).toHaveURL(/\/pt-br\/$/);
});

test("redimensionar: o palco acompanha retrato e paisagem", async ({ page }) => {
  await openGame(page);
  await press(page, "#mm-play");
  for (const [w, h] of [
    [844, 390],
    [390, 844],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const size = await page.locator("#mm-canvas").evaluate((c: HTMLCanvasElement) => [c.clientWidth, c.clientHeight]);
    expect(size[0]).toBeGreaterThan(w * 0.95);
    expect(size[1]).toBeGreaterThan(h * 0.9);
  }
});

test("toque no celular: um toque na tela é entregue ao jogo (sem rolar nem dar zoom)", async ({ page }) => {
  test.skip(!test.info().project.use.hasTouch, "só no celular");
  await openGame(page);
  await page.locator("#mm-play").tap();
  await page.waitForTimeout(1500);
  const box = (await page.locator("#mm-canvas").boundingBox())!;
  for (let i = 0; i < 6; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const touchAction = await page.locator("#mm-canvas").evaluate((c) => getComputedStyle(c).touchAction);
  expect(touchAction).toBe("none");
  expect(await page.evaluate(() => [scrollX, scrollY, visualViewport?.scale ?? 1])).toEqual([0, 0, 1]);
});
