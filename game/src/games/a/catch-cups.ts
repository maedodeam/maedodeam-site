// 008 · CATCH! — xícaras caem do andar de cima; pegue-as na bandeja. Grampeador na bandeja quebra tudo.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { cup, person, stapler } from "../../gfx/art.ts";
import { steer } from "../../kit/mover.ts";
import { steerTo } from "../../testing/botkit.ts";
import { bigText, pips } from "./art-a.ts";

interface Item {
  kind: "cup" | "stapler";
  x: number;
  y: number;
  land: number; // instante em que cruza a altura da bandeja
  spawn: number;
  state: "wait" | "fall" | "caught" | "missed";
  rot: number;
  color: string;
  t: number;
}
interface S {
  tx: number;
  trayY: number;
  trayW: number;
  ground: number;
  items: Item[];
  caught: number;
  need: number;
  broke: boolean;
  fall: number;
  vx: number;
}

const CUPS = [C.paper, C.pink2, C.sky, C.yellow2, C.green2];

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = h > w;
  const ground = portrait ? h * 0.86 : h * 0.95;
  const ps = portrait ? 1.55 : 1.25;
  const trayY = ground - 265 * ps;
  const fall = 0.95 - 0.17 * lv;
  const top = -70;
  const s: S = {
    tx: w / 2,
    trayY,
    trayW: (270 - 40 * lv) * (ps / 1.25),
    ground,
    items: [],
    caught: 0,
    need: 3 + Math.round(lv * 1.34),
    broke: false,
    fall,
    vx: 0,
  };
  // Roteiro: cada xícara chega um pouco depois da anterior, sempre ao alcance da bandeja.
  const gap = 0.75 - 0.2 * lv;
  const reach = 1400 * gap * 0.8;
  // Nenhuma xícara cai onde a bandeja começa: parado, não se pega nada.
  const excl = s.trayW / 2 + 70;
  let x = w / 2;
  let t = fall + 0.2;
  const cups: Item[] = [];
  while (t < api.duration - 0.12) {
    let nx = x + rng.sign() * rng.range(120, reach);
    if (nx < 110 || nx > w - 110) nx = x - (nx - x);
    nx = Math.max(110, Math.min(w - 110, nx));
    if (Math.abs(nx - w / 2) < excl) {
      const side = x !== w / 2 ? Math.sign(x - w / 2) : rng.sign();
      nx = w / 2 + side * (excl + rng.range(0, 80));
    }
    x = nx;
    cups.push({ kind: "cup", x, y: top, land: t, spawn: t - fall, state: "wait", rot: 0, color: rng.pick(CUPS), t: 0 });
    t += gap * rng.range(0.95, 1.15);
  }
  s.items.push(...cups);
  // Grampeadores caem junto com uma xícara, longe dela: quem está embaixo da xícara está seguro.
  const nStaplers = lv < 0.3 ? 0 : lv < 1 ? 1 : 2;
  const used = new Set<number>();
  for (let k = 0; k < nStaplers && cups.length > 2; k++) {
    let i = rng.int(1, cups.length - 1);
    if (used.has(i)) i = (i % (cups.length - 1)) + 1;
    used.add(i);
    const c = cups[i];
    const minD = s.trayW / 2 + 260;
    const left = c.x - minD > 110;
    const right = c.x + minD < w - 110;
    let sx: number;
    if (left && (!right || rng.chance(0.5))) sx = rng.range(110, c.x - minD);
    else if (right) sx = rng.range(c.x + minD, w - 110);
    else continue;
    s.items.push({ kind: "stapler", x: sx, y: top, land: c.land, spawn: c.land - fall, state: "wait", rot: rng.range(-1, 1), color: C.red, t: 0 });
  }
  const speed = (trayY - top) / fall;

  return {
    s,
    update(dt) {
      const time = api.time;
      for (const it of s.items) {
        it.t += dt;
        if (it.state === "wait" && time >= it.spawn) it.state = "fall";
        if (it.state === "fall") {
          const prevY = it.y;
          it.y = top + (time - it.spawn) * speed;
          if (it.kind === "stapler") it.rot += dt * 6;
          if (prevY < trayY - 20 && it.y >= trayY - 20 && !api.result && !s.broke) {
            if (Math.abs(it.x - s.tx) < s.trayW / 2 + 26) {
              if (it.kind === "cup") {
                it.state = "caught";
                s.caught++;
                api.sfx("coin");
                api.fx.pop(s.tx, trayY - 140, `${s.caught}/${s.need}`, C.yellow);
                if (s.caught >= s.need) {
                  api.fx.burst(s.tx, trayY - 60, undefined, 22);
                  api.sfx("chime");
                  api.win();
                }
              } else {
                s.broke = true;
                it.state = "caught";
                api.sfx("thud");
                api.fx.shake(0.8);
                api.fx.burst(s.tx, trayY, C.paper, 16);
                api.fx.pop(s.tx, trayY - 160, "CRASH!", C.red);
                api.lose();
              }
            }
          }
          if (it.y >= s.ground - 30) {
            it.y = s.ground - 30;
            it.state = "missed";
            it.t = 0;
            if (!api.result) api.sfx(it.kind === "cup" ? "splash" : "thud");
          }
        }
      }
      if (!api.result && !s.broke) {
        const p = { x: s.tx, y: trayY };
        const v = steer(api.input, p, { axis: "x", keySpeed: 1400, minX: 110, maxX: w - 110, minY: 0, maxY: h }, dt);
        s.tx = p.x;
        s.vx = v.x;
      } else s.vx = 0;
    },
    draw(g: Gfx) {
      g.clear(BG.mint);
      // copa do escritório: azulejos e balcão do andar de cima
      for (let x = 0; x < w; x += 125) g.line(x, 120, x, s.ground, "#a3e0bd", 4);
      for (let y = 120; y < s.ground; y += 125) g.line(0, y, w, y, "#a3e0bd", 4);
      g.rect(-10, -10, w + 20, 120, C.brown2);
      g.line(0, 110, w, 110, C.ink, 7);
      for (let x = 30; x < w; x += 90) g.rect(x, 60, 40, 50, C.brown, { lw: 4 });
      g.rect(-10, s.ground, w + 20, h - s.ground + 10, C.paper2);
      g.line(0, s.ground, w, s.ground, C.ink, 7);

      // avisos: sombra no chão + linha tracejada
      for (const it of s.items) {
        if (it.state !== "fall") continue;
        const k = Math.max(0, Math.min(1, (it.y - top) / (s.trayY - top)));
        g.push();
        g.alpha(0.2 + 0.4 * k);
        g.ellipse(it.x, s.ground + 8, 30 + 30 * k, 10, C.ink, { stroke: null });
        g.dashed(it.x, Math.max(130, it.y + 60), it.x, s.ground - 10, it.kind === "cup" ? C.green : C.red, 4, 14);
        g.pop();
      }

      // garçom com a bandeja
      const walking = Math.abs(s.vx) > 60;
      person(g, s.tx, s.ground, ps, {
        shirt: C.white,
        tie: C.ink2,
        mood: s.broke ? "shock" : api.result === "win" ? "happy" : "worried",
        look: { x: 0, y: -1 },
        walk: walking ? g.time * 2.5 : undefined,
      });
      const ty = s.trayY;
      const sy = s.ground - 128 * ps;
      g.line(s.tx - 32 * ps, sy, s.tx - s.trayW * 0.3, ty + 6, C.ink, 18);
      g.line(s.tx + 32 * ps, sy, s.tx + s.trayW * 0.3, ty + 6, C.ink, 18);
      g.line(s.tx - 32 * ps, sy, s.tx - s.trayW * 0.3, ty + 6, C.white, 9);
      g.line(s.tx + 32 * ps, sy, s.tx + s.trayW * 0.3, ty + 6, C.white, 9);
      const tilt = s.broke ? 0.35 : Math.max(-0.12, Math.min(0.12, -s.vx / 8000));
      g.push();
      g.translate(s.tx, ty);
      g.rotate(tilt);
      g.ellipse(0, 6, s.trayW / 2, 22, C.gray, { lw: 6 });
      g.ellipse(0, 0, s.trayW / 2 - 10, 14, C.paper2, { lw: 4 });
      // xícaras empilhadas
      const caught = s.items.filter((q) => q.kind === "cup" && q.state === "caught");
      caught.forEach((c, i) => {
        const row = i < 3 ? 0 : 1;
        const col = i < 3 ? i - 1 : i - 3.5;
        cup(g, col * 76, -46 - row * 80, 1.0, c.color, false);
      });
      g.pop();

      for (const it of s.items) {
        if (it.state === "wait" || it.state === "caught") continue;
        g.push();
        if (it.state === "missed") g.alpha(Math.max(0, 1 - it.t / 0.6));
        if (it.kind === "cup") {
          if (it.state === "missed") {
            g.ellipse(it.x, s.ground + 4, 70, 14, C.brown, { lw: 4 });
            g.shape(it.x - 30, s.ground - 20, [-20, 10, 0, -20, 18, 8], it.color, { lw: 4 });
            g.shape(it.x + 34, s.ground - 16, [-16, 12, 6, -18, 20, 10], it.color, { lw: 4 });
          } else cup(g, it.x, it.y, 1.45, it.color, true, g.time);
        } else stapler(g, it.x, it.y, 1.8, it.rot);
        g.pop();
      }
      if (s.broke) {
        stapler(g, s.tx + 20, s.trayY - 30, 1.5, 0.3);
        for (let i = 0; i < 4; i++) g.shape(s.tx - 80 + i * 50, s.trayY - 20 + (i % 2) * 20, [-16, 10, 0, -18, 18, 8], C.paper, { lw: 4 });
      }

      // placar
      const py = portrait ? 200 : 170;
      pips(g, w / 2, py, s.need, s.caught, 26, C.yellow);
      if (api.result === "win") bigText(g, api.t({ en: "BARISTA OF THE MONTH", pt: "BARISTA DO MÊS" }), w / 2, py + 110, portrait ? 70 : 90, C.yellow, -0.04);
    },
  };
}

export const catchCups: Entry<S> = {
  def: {
    id: "catch-cups",
    num: 8,
    name: { en: "Coffee Run", pt: "Pega o Café" },
    verb: { en: "CATCH!", pt: "PEGA!" },
    hint: { pointer: "move", keys: "lr" },
    category: "reflex",
    family: "move",
    goal: "complete",
    difficulty: 1,
    mechanic: "Coffee cups fall from the mezzanine, with a dashed line and a shadow as warning. Move the tray left and right to catch them. Staplers fall too: catching one breaks the tray.",
    winText: "Catch 3 cups (up to 5 at higher levels).",
    loseText: "Catching a stapler, or time runs out.",
    timeScale: 1.3,
    minTime: 3.6,
    bg: BG.mint,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const next = s.items.filter((q) => q.kind === "cup" && (q.state === "fall" || q.state === "wait") && q.land >= api.time - 0.02).sort((a, b) => a.land - b.land)[0];
          if (next) steerTo(io, { x: s.tx, y: s.trayY }, { x: next.x, y: s.trayY }, 2400, dt);
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const st = s.items.find((q) => q.kind === "stapler" && q.state === "fall");
          let tx: number;
          if (st) tx = st.x;
          else {
            const next = s.items.filter((q) => q.kind === "cup" && q.state === "fall").sort((a, b) => a.land - b.land)[0];
            tx = next ? (next.x > api.w / 2 ? 110 : api.w - 110) : s.tx;
          }
          steerTo(io, { x: s.tx, y: s.trayY }, { x: tx, y: s.trayY }, 2400, dt);
        },
      }
    : null,
};
