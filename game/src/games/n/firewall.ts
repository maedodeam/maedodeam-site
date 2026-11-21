// 210 · BLOCK THE VIRUS! — pacotes correm por 3 cabos até o servidor: vermelhos (vírus, com caveira) e verdes (e-mail).
// Toque nos vermelhos para bloquear antes que cheguem. Bloqueou 5 = vence. Tocou num verde, ou um vírus chegou = perde.
// Níveis altos: pacotes mais rápidos, vírus mais próximos uns dos outros e (lv ≥ 0.5) muito mais e-mails no meio.
import type { Entry, MicroAPI, MicroInstance, Point } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { envelope, cloud } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait } from "./util.ts";

const GOAL = 5;
/** Escala do desenho dos pacotes (raio 56 × PK). */
const PK = 1.35;

interface Packet {
  lane: number;
  at: number;
  p: number;
  red: boolean;
  state: "wait" | "run" | "blocked" | "done";
  fade: number;
}
interface S {
  lanes: { a: Point; b: Point }[];
  packets: Packet[];
  speed: number;
  blocked: number;
  infected: Packet | null;
  wrong: Packet | null;
  server: Point;
  vertical: boolean;
  t: number;
  endT: number;
}

function posOf(s: S, k: Packet, p = k.p): Point {
  const L = s.lanes[k.lane];
  return { x: L.a.x + (L.b.x - L.a.x) * p, y: L.a.y + (L.b.y - L.a.y) * p };
}

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const vertical = portrait;
  const lanes: S["lanes"] = [];
  for (let i = 0; i < 3; i++) {
    if (vertical) {
      const x = w * (0.2 + 0.3 * i);
      lanes.push({ a: { x, y: h * 0.12 }, b: { x, y: h * 0.8 } });
    } else {
      const y = h * (0.28 + 0.26 * i);
      lanes.push({ a: { x: w * 0.12, y }, b: { x: w - 250, y } });
    }
  }
  const T = 2.6 - 0.9 * Math.min(1, lv) - 0.6 * Math.max(0, lv - 1);
  const D = api.duration;
  const gap = Math.max(0.3, Math.min(0.9 - 0.4 * Math.min(1, lv), (D - 0.6 - T - 0.2) / (GOAL - 1)));
  const packets: Packet[] = [];
  for (let i = 0; i < GOAL; i++) {
    packets.push({ lane: rng.int(0, 2), at: 0.2 + i * gap + rng.range(0, gap * 0.25), p: 0, red: true, state: "wait", fade: 0 });
  }
  const last = packets[packets.length - 1].at;
  const nGreen = lv < 0.5 ? 2 : lv < 1 ? 4 : 6;
  let guard = 0;
  while (packets.filter((k) => !k.red).length < nGreen && guard++ < 300) {
    const k: Packet = { lane: rng.int(0, 2), at: rng.range(0.1, last + 0.3), p: 0, red: false, state: "wait", fade: 0 };
    // no mesmo cabo, deixa espaço para tocar sem ambiguidade
    if (packets.some((q) => q.lane === k.lane && Math.abs(q.at - k.at) < T * 0.3)) continue;
    packets.push(k);
  }
  const s: S = {
    lanes,
    packets,
    speed: 1 / T,
    blocked: 0,
    infected: null,
    wrong: null,
    server: vertical ? { x: w / 2, y: h * 0.9 } : { x: w - 130, y: h * 0.54 },
    vertical,
    t: 0,
    endT: 0,
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      for (const k of s.packets) if (k.state === "blocked" || k.state === "done") k.fade += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      for (const k of s.packets) {
        if (k.state === "wait" && s.t >= k.at) k.state = "run";
        if (k.state !== "run") continue;
        k.p += s.speed * dt;
        if (k.p >= 1) {
          k.p = 1;
          k.state = "done";
          if (k.red) {
            s.infected = k;
            api.sfx("zap");
            api.fx.shake(0.9);
            api.lose();
            return;
          }
          api.sfx("tap");
        }
      }
      const inp = api.input;
      if (!inp.pressed) return;
      let best: Packet | null = null;
      let bd = 105;
      for (const k of s.packets) {
        if (k.state !== "run") continue;
        const q = posOf(s, k);
        const d = Math.hypot(q.x - inp.x, q.y - inp.y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (!best) return;
      const q = posOf(s, best);
      if (best.red) {
        best.state = "blocked";
        s.blocked++;
        api.sfx("zap");
        api.fx.burst(q.x, q.y, C.red, 14);
        if (s.blocked >= GOAL) {
          api.sfx("chime");
          api.win();
        }
      } else {
        best.state = "blocked";
        s.wrong = best;
        api.sfx("buzz");
        api.fx.pop(q.x, q.y - 70, api.t({ en: "MAIL!", pt: "E-MAIL!" }), C.green);
        api.fx.shake(0.5);
        api.lose();
      }
    },
    draw(g: Gfx) {
      g.clear(BG.night);
      // grade digital
      for (let x = 0; x < w; x += 100) g.line(x, 0, x, h, "#26254d", 2);
      for (let y = 0; y < h; y += 100) g.line(0, y, w, y, "#26254d", 2);
      // internet (nuvem) e cabos
      const src = s.vertical ? { x: w / 2, y: h * 0.06 } : { x: w * 0.06, y: h * 0.54 };
      cloud(g, src.x, src.y, s.vertical ? 2.4 : 1.4, C.gray2);
      for (const L of s.lanes) {
        g.line(L.a.x, L.a.y, L.b.x, L.b.y, C.ink, 44);
        g.line(L.a.x, L.a.y, L.b.x, L.b.y, C.blue, 30);
      }
      // servidor
      const sv = s.server;
      const sw = s.vertical ? w * 0.84 : 200;
      const sh = s.vertical ? h * 0.12 : h * 0.84;
      const hurt = s.infected !== null;
      g.rect(sv.x - sw / 2, sv.y - sh / 2, sw, sh, hurt ? C.red : C.gray2, { r: 20 });
      const rows = s.vertical ? 2 : 6;
      for (let i = 0; i < rows; i++) {
        const yy = sv.y - sh / 2 + 30 + i * ((sh - 60) / Math.max(1, rows - 1));
        g.rect(sv.x - sw / 2 + 24, yy - 14, sw - 48, 28, C.ink2, { r: 8, stroke: null });
        g.circle(sv.x + sw / 2 - 44, yy, 8, (i + Math.floor(s.t * 6)) % 3 === 0 ? C.green : C.green2, { stroke: null });
      }
      // escudo do firewall: contador
      const cx = s.vertical ? w / 2 : sv.x;
      const cy = s.vertical ? sv.y - sh / 2 - 60 : sv.y - sh / 2 - 50;
      g.rect(cx - 110, cy - 40, 220, 80, C.white, { r: 40, lw: 6 });
      g.text(`${s.blocked}/${GOAL}`, cx, cy + 2, { size: 54, font: "mono", weight: 800, color: C.red });
      // pacotes
      for (const k of s.packets) {
        if (k.state === "wait") continue;
        if (k.fade > 0.4) continue;
        const q = posOf(s, k);
        g.push();
        if (k.state !== "run") {
          g.alpha(1 - k.fade / 0.4);
        }
        // pacote grande (≈ 150 unidades) com ícone claro: caveira = vírus, envelope = e-mail
        g.translate(q.x, q.y);
        g.scale(PK);
        if (k.red) {
          g.circle(0, 0, 56, C.red, { lw: 6 });
          g.circle(0, -8, 32, C.white, { lw: 5 });
          g.rect(-18, 14, 36, 20, C.white, { r: 5, lw: 5 });
          g.line(-6, 18, -6, 32, C.ink, 3);
          g.line(6, 18, 6, 32, C.ink, 3);
          g.circle(-12, -10, 9, C.ink, { stroke: null });
          g.circle(12, -10, 9, C.ink, { stroke: null });
          if (k.state === "blocked") g.line(-50, -50, 50, 50, C.yellow, 12);
        } else {
          g.circle(0, 0, 56, C.green, { lw: 6 });
          envelope(g, 0, 0, 76, 52);
        }
        g.pop();
      }
      if (api.result === "lose") g.text(api.t({ en: hurt ? "INFECTED!" : "THAT WAS MAIL!", pt: hurt ? "INFECTADO!" : "ERA E-MAIL!" }), w / 2, h * 0.5, { size: 110, color: C.red, stroke: C.ink, lw: 14 });
      if (api.result === "win") g.text(api.t({ en: "SECURE!", pt: "PROTEGIDO!" }), w / 2, h * 0.5, { size: 120, color: C.green, stroke: C.ink, lw: 14 });
    },
  };
}

export const firewall: Entry<S> = {
  def: {
    id: "firewall",
    num: 210,
    name: { en: "Firewall", pt: "Firewall" },
    verb: { en: "BLOCK THE VIRUS!", pt: "BLOQUEIA O VÍRUS!" },
    hint: { pointer: "tap" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Packets run along three cables toward a server: red ones carry a skull (virus), green ones are mail. Tap the red ones before they arrive; block five to win. Later packets are faster and mail crowds the cables.",
    winText: "Block five viruses.",
    loseText: "Tap a mail packet, let a virus reach the server, or run out of time.",
    timeScale: 1.4,
    minTime: 4.2,
    bg: BG.night,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result || api.time < 0.2) return;
          const m = mem(s, () => ({ wait: 0 }));
          if (m.wait-- > 0 || io.isDown) return;
          let best: Packet | null = null;
          for (const k of s.packets) if (k.red && k.state === "run" && (!best || k.p > best.p)) best = k;
          if (!best) return;
          const q = posOf(s, best, best.p + s.speed * dt);
          io.tap(q.x, q.y);
          m.wait = 2;
        },
        lose(s, api, io, dt) {
          if (api.result || api.time < 0.3) return;
          if (io.isDown) return;
          const k = s.packets.find((q) => !q.red && q.state === "run" && q.p > 0.1);
          if (!k) return;
          const q = posOf(s, k, k.p + s.speed * dt);
          io.tap(q.x, q.y);
        },
      }
    : null,
};
