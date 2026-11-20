// 035 · GRAB! — a torradeira da copa cospe torradas para o alto. Pegue a torrada no ponto mais alto do pulo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { bigText, dog, pips } from "./art-a.ts";

interface Toast {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  state: "fly" | "slip" | "caught" | "eaten";
  t: number;
}
interface S {
  toast: Toast | null;
  next: number;
  caught: number;
  need: number;
  y0: number;
  apexY: number;
  zoneH: number;
  gr: number;
  vy0: number;
  slips: number;
  dogChew: number;
  plate: { x: number; y: number };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const counterY = portrait ? h * 0.74 : h * 0.8;
  const tx = portrait ? w * 0.55 : w * 0.4;
  const y0 = counterY - 150;
  const H = portrait ? 900 : 560;
  const ta = 0.62 - 0.13 * lv;
  const gr = (2 * H) / (ta * ta);
  const f = 0.3 - 0.1 * lv;
  const s: S = {
    toast: null,
    next: 0.25,
    caught: 0,
    need: lv >= 1 ? 2 : 1,
    y0,
    apexY: y0 - H,
    zoneH: f * H,
    gr,
    vy0: gr * ta,
    slips: 0,
    dogChew: 0,
    plate: { x: portrait ? w * 0.86 : w * 0.72, y: counterY - 20 },
  };
  const dogX = portrait ? w * 0.13 : w * 0.16;
  const inZone = (t: Toast) => t.y >= s.apexY - 25 && t.y <= s.apexY + s.zoneH;

  return {
    s,
    update(dt) {
      s.dogChew = Math.max(0, s.dogChew - dt);
      const t = s.toast;
      if (t) {
        t.t += dt;
        if (t.state === "fly" || t.state === "slip") {
          t.vy += s.gr * dt * (t.state === "slip" ? 1.3 : 1);
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.rot += t.vr * dt;
          // passou da torradeira na volta: vai para o cachorro
          if (t.vy > 0 && t.y > s.y0 - 20) {
            t.state = "eaten";
            t.t = 0;
            s.dogChew = 0.6;
            api.sfx("squeak");
          }
        } else if (t.state === "caught") {
          t.x += (s.plate.x - t.x) * Math.min(1, dt * 12);
          t.y += (s.plate.y - 30 - s.caught * 0 - t.y) * Math.min(1, dt * 12);
          t.rot *= 0.8;
        }
        if ((t.state === "caught" && t.t > 0.25) || (t.state === "eaten" && t.t > 0.35)) {
          s.toast = null;
          s.next = 0.3;
        }
      } else if (!api.result) {
        s.next -= dt;
        if (s.next <= 0) {
          s.toast = { x: tx, y: s.y0, vx: rng.range(-50, 50), vy: -s.vy0, rot: 0, vr: rng.range(-2, 2), state: "fly", t: 0 };
          api.sfx("jump");
        }
      }
      if (api.result) return;
      const inp = api.input;
      const cur = s.toast;
      if (!cur || cur.state !== "fly") return;
      let tried = false;
      if (inp.pressed) tried = Math.abs(inp.x - cur.x) < 130 && Math.abs(inp.y - cur.y) < 130;
      else if (inp.keyPressed("action")) tried = true;
      if (!tried) return;
      if (inZone(cur)) {
        cur.state = "caught";
        cur.t = 0;
        s.caught++;
        api.sfx("coin");
        api.fx.burst(cur.x, cur.y, C.yellow, 14);
        api.fx.pop(cur.x, cur.y - 120, api.t({ en: "GOT IT!", pt: "PEGUEI!" }), C.yellow);
        if (s.caught >= s.need) api.win();
      } else {
        cur.state = "slip";
        cur.vr = 14 * (rng.chance(0.5) ? 1 : -1);
        cur.vx = (dogX - cur.x) * 1.2;
        if (cur.vy < 0) cur.vy *= 0.3;
        s.slips++;
        api.sfx("miss");
        api.fx.pop(cur.x, cur.y - 110, api.t({ en: "SLIPPED!", pt: "ESCORREGOU!" }), C.red);
      }
    },
    draw(g: Gfx) {
      g.clear(BG.peach);
      // azulejos
      for (let x = 0; x < w; x += 110) g.line(x, 0, x, counterY, "#f3b593", 4);
      for (let y = 0; y < counterY; y += 110) g.line(0, y, w, y, "#f3b593", 4);
      // zona de pegar
      const zy = s.apexY - 70;
      const zh = s.zoneH + 70 + 50;
      g.push();
      g.alpha(0.35);
      g.rect(40, zy, w - 80, zh, C.yellow, { stroke: null, r: 20 });
      g.pop();
      g.dashed(40, zy, w - 40, zy, C.ink, 5, 16);
      g.dashed(40, zy + zh, w - 40, zy + zh, C.ink, 5, 16);
      g.text(api.t({ en: "GRAB ZONE", pt: "ZONA DE PEGAR" }), w - 60, zy + 34, { size: 36, align: "right", color: C.ink2 });
      // bancada
      g.rect(-10, counterY, w + 20, 60, C.brown, { lw: 7 });
      g.rect(-10, counterY + 60, w + 20, h, C.brown2, { lw: 7 });
      for (let x = 80; x < w; x += 300) g.rect(x, counterY + 100, 220, 160, C.brown2, { r: 10, lw: 5 });
      // prato
      g.ellipse(s.plate.x, s.plate.y + 10, 120, 26, C.white, { lw: 6 });
      for (let i = 0; i < s.caught; i++) {
        if (s.toast && s.toast.state === "caught" && i === s.caught - 1) continue;
        drawToast(g, s.plate.x + (i - (s.caught - 1) / 2) * 30, s.plate.y - 20 - i * 18, 0.85, 0.1 * (i % 2 ? 1 : -1));
      }
      // torradeira
      const tt = s.toast;
      const popping = tt && tt.state === "fly" && tt.t < 0.15;
      g.rect(tx - 170, s.y0 - 20, 340, 170, C.gray, { r: 50 });
      g.rect(tx - 120, s.y0 - 28, 90, 24, C.ink, { r: 10 });
      g.rect(tx + 30, s.y0 - 28, 90, 24, C.ink, { r: 10 });
      g.rect(tx + 160, s.y0 + 40 + (popping ? -20 : 20), 34, 24, C.ink2, { r: 6 });
      g.face(tx, s.y0 + 75, 140, popping ? "shock" : api.result === "win" ? "happy" : "neutral");
      // cachorro
      dog(g, dogX, portrait ? counterY - 2 : counterY - 2, portrait ? 1.3 : 1.5, 1, s.dogChew > 0 ? "happy" : "neutral", s.dogChew);
      if (tt && tt.state === "eaten") {
        g.push();
        g.alpha(Math.max(0, 1 - tt.t / 0.35));
        drawToast(g, dogX + 120, counterY - 160, 0.7, 0.5);
        g.pop();
      }
      if (tt && tt.state !== "eaten") drawToast(g, tt.x, tt.y, 1.3, tt.rot);
      pips(g, w / 2, counterY + (h - counterY) / 2 + 20, s.need, s.caught, 26, C.orange);
      if (api.result === "win") bigText(g, api.t({ en: "BREAKFAST!", pt: "CAFÉ DA MANHÃ!" }), w / 2, portrait ? h * 0.5 : h * 0.45, 100, C.yellow, -0.05);
      if (api.result === "lose") bigText(g, api.t({ en: "GOOD BOY.", pt: "BOM GAROTO." }), w / 2, portrait ? h * 0.5 : h * 0.45, 100, C.paper, 0.03);
    },
  };
}

function drawToast(g: Gfx, x: number, y: number, s: number, rot: number): void {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s);
  g.rect(-62, -40, 124, 110, C.brown2, { r: 16 });
  g.circle(-34, -42, 34, C.brown2);
  g.circle(34, -42, 34, C.brown2);
  g.rect(-62, -40, 124, 30, C.brown2, { stroke: null });
  g.rect(-48, -34, 96, 92, C.yellow2, { r: 10, stroke: null });
  g.circle(-26, -40, 22, C.yellow2, { stroke: null });
  g.circle(26, -40, 22, C.yellow2, { stroke: null });
  g.rect(-20, -6, 40, 26, C.yellow, { r: 6, lw: 4 });
  g.pop();
}

export const toastGrab: Entry<S> = {
  def: {
    id: "toast-grab",
    num: 35,
    name: { en: "Toast!", pt: "Torrada!" },
    verb: { en: "GRAB!", pt: "AGARRA!" },
    hint: { pointer: "tap", keys: "space" },
    category: "timing",
    family: "tap",
    goal: "complete",
    difficulty: 1,
    mechanic: "The break-room toaster launches toast into the air. Tap the toast (or press Space) while it is inside the marked zone near the top of its jump. Grab too early or too late and it slips to the dog.",
    winText: "Catch 1 toast (2 at higher levels).",
    loseText: "Time runs out (the dog is very happy).",
    timeScale: 1.2,
    minTime: 3.2,
    bg: BG.peach,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.02) return;
          const t = s.toast;
          if (!t || t.state !== "fly") return;
          if (t.y >= s.apexY - 20 && t.y <= s.apexY + s.zoneH * 0.7) io.tap(t.x, t.y);
        },
        lose() {},
      }
    : null,
};
