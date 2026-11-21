// 273 · DUCK AND THROW! — guerra de neve no parque. Segurar = abaixar atrás do muro de neve; soltar = levantar e
// arremessar (0,2 s depois). Acerte o rival 3 vezes enquanto ele está provocando (de pé, sem bola na mão: quando ele
// prepara o arremesso, a bola gigante na frente dele bloqueia a sua). Estar de pé quando a bola dele chega = perde.
// Nos níveis altos ele aparece direto preparando o arremesso, provoca por menos tempo e joga mais rápido.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { person } from "../../gfx/art.ts";
import { mem } from "../../testing/botkit.ts";
import { isPortrait, lerp, pips } from "./util.ts";

type Opp = "hidden" | "taunt" | "windup" | "stun";

interface S {
  opp: Opp;
  /** Tempo restante no estado atual do rival. */
  left: number;
  pops: number;
  attackAt: number;
  hits: number;
  need: number;
  /** Seu arremesso: espera (0,2 s) e voo. */
  pending: number | null;
  mine: number | null;
  /** Bola do rival em voo (0..1). */
  his: number | null;
  standing: boolean;
  hitMe: boolean;
  tTaunt: number;
  tWind: number;
  tFly: number;
  t: number;
  endT: number;
  msg: { text: string; t: number; good: boolean } | null;
}

const DELAY = 0.2;
const MY_FLY = 0.22;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api);
  const s: S = {
    opp: "hidden",
    left: 0.5,
    pops: 0,
    // a partir de 0,5, uma das primeiras aparições já vem preparando o arremesso
    attackAt: lv < 0.5 ? -1 : rng.int(0, 2),
    hits: 0,
    need: 3,
    pending: null,
    mine: null,
    his: null,
    standing: true,
    hitMe: false,
    tTaunt: 1.05 - 0.2 * lv,
    tWind: 0.55 - 0.12 * lv,
    tFly: 0.5 - 0.08 * lv,
    t: 0,
    endT: 0,
    msg: null,
  };

  const OX = w / 2 + Math.min(w * 0.12, 150);
  const PX = w / 2 - Math.min(w * 0.25, 330);
  const HOR = portrait ? h * 0.42 : h * 0.4;
  const FORT = HOR + (portrait ? 230 : 200);
  const WALL = h * 0.8;

  const say = (en: string, pt: string, good: boolean) => {
    s.msg = { text: api.t({ en, pt }), t: 0, good };
  };

  return {
    s,
    update(dt) {
      s.t += dt;
      if (s.msg) s.msg.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      // ----- você -----
      const held = inp.action && !(inp.actionPressed && inp.actionReleased);
      const wasStanding = s.standing;
      s.standing = !held;
      if (s.standing && (!wasStanding || (inp.actionPressed && inp.actionReleased)) && s.pending === null && s.mine === null) {
        s.pending = DELAY;
      }
      if (s.pending !== null) {
        if (!s.standing) s.pending = null;
        else {
          s.pending -= dt;
          if (s.pending <= 0) {
            s.pending = null;
            s.mine = 0;
            api.sfx("swoosh");
          }
        }
      }
      if (s.mine !== null) {
        s.mine += dt / MY_FLY;
        if (s.mine >= 1) {
          s.mine = null;
          if (s.opp === "taunt") {
            s.hits++;
            s.opp = "stun";
            s.left = 0.3;
            api.sfx("hit");
            api.fx.burst(OX, FORT - 250, C.white, 20);
            say("BULLSEYE!", "NA CARA!", true);
            if (s.hits >= s.need) {
              api.sfx("coin");
              api.win();
              return;
            }
          } else if (s.opp === "windup") {
            api.sfx("thud");
            say("BLOCKED!", "BLOQUEOU!", false);
          } else {
            api.sfx("thud");
            say("MISS!", "ERROU!", false);
          }
        }
      }
      // ----- rival -----
      s.left -= dt;
      if (s.left <= 0) {
        if (s.opp === "hidden") {
          s.opp = s.pops === s.attackAt ? "windup" : "taunt";
          s.left = s.opp === "windup" ? s.tWind : s.tTaunt;
          s.pops++;
          if (s.opp === "windup") api.sfx("rise");
        } else if (s.opp === "taunt") {
          s.opp = "windup";
          s.left = s.tWind;
          api.sfx("rise");
        } else if (s.opp === "windup") {
          s.his = 0;
          s.opp = "hidden";
          s.left = s.tFly + rng.range(0.25, 0.45);
          api.sfx("swoosh");
        } else {
          s.opp = "hidden";
          s.left = 0.25;
        }
      }
      if (s.his !== null) {
        s.his += dt / s.tFly;
        if (s.his >= 1) {
          s.his = null;
          if (s.standing) {
            s.hitMe = true;
            api.sfx("splash");
            api.fx.shake(1);
            api.fx.pop(PX, WALL - 300, api.t({ en: "SPLAT!", pt: "PLAFT!" }), C.blue);
            api.lose();
            return;
          }
          api.sfx("thud");
          api.fx.burst(PX, WALL, C.white, 14);
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.sky);
      const hor = HOR;
      // árvores e neve
      for (let i = 0; i < 5; i++) {
        const tx = ((i + 0.5) * w) / 5;
        g.shape(tx, hor - 10, [-60, 0, 60, 0, 0, -170], C.green, { lw: 6 });
        g.shape(tx, hor - 110, [-40, 0, 40, 0, 0, -100], C.green, { lw: 6 });
      }
      g.rect(-10, hor - 10, w + 20, h - hor + 20, C.white, { stroke: null });
      g.line(-10, hor - 10, w + 10, hor - 10, C.ink, 6);
      // rival atrás do forte
      const ox = OX;
      const px = PX;
      const fortY = FORT;
      const up = s.opp === "taunt" || s.opp === "windup" ? 1 : s.opp === "stun" ? 0.6 : 0;
      const rise = up * 190;
      const mood = s.opp === "stun" ? "dizzy" : s.opp === "windup" ? "angry" : "smug";
      person(g, ox, fortY + 190 - rise, 1.0, { shirt: C.red, hat: C.blue, mood, look: { x: 0, y: 0.5 } });
      if (s.opp === "windup") {
        // bola gigante na frente: escudo e arremesso
        g.circle(ox + 10, fortY + 4 - rise, 70, C.white, { lw: 8 });
        g.text("!", ox + 110, fortY - rise - 110, { size: 110, color: C.red, stroke: C.ink, lw: 12 });
      }
      if (s.opp === "taunt") {
        g.text(api.t({ en: "NYAH!", pt: "LERO-LERO!" }), Math.min(ox + 250, w - 170), fortY - rise - 60, { size: 60, color: C.white, stroke: C.ink, lw: 12 });
      }
      g.ellipse(ox, fortY + 40, 230, 90, C.white, { lw: 7 });
      g.rect(ox - 230, fortY + 40, 460, 170, C.white, { stroke: null });
      // sua bola indo
      if (s.mine !== null) {
        const k = s.mine;
        const x = lerp(px + 150, ox, k);
        const y = lerp(h * 0.75, fortY - 160, k) - Math.sin(k * Math.PI) * 120;
        g.circle(x, y, lerp(46, 18, k), C.white, { lw: 6 });
      }
      // seu muro e você (de costas)
      const wallY = WALL;
      const stand = s.standing ? 1 : 0;
      const myY = wallY - 40 - stand * 170;
      g.circle(px, myY, 90, C.brown, { lw: 8 });
      g.rect(px - 95, myY - 100, 190, 50, C.orange, { r: 20, lw: 7 });
      g.circle(px, myY - 120, 26, C.yellow, { lw: 6 });
      if (s.standing) {
        g.line(px + 70, myY + 60, px + 150, myY - (s.pending !== null ? 120 : 20), C.orange, 34);
        if (s.pending !== null || s.mine === null) g.circle(px + 155, myY - (s.pending !== null ? 140 : 40), 38, C.white, { lw: 6 });
      }
      g.ellipse(px, wallY + 40, Math.min(w * 0.42, 520), 110, C.white, { lw: 8 });
      g.rect(-10, wallY + 40, w + 20, h, C.white, { stroke: null });
      g.line(-10, wallY + 150, w + 10, wallY + 150, C.paper2, 6);
      // bola dele vindo
      if (s.his !== null) {
        const k = s.his;
        const x = lerp(ox, px, k);
        const y = lerp(fortY - 160, wallY - 200, k) - Math.sin(k * Math.PI) * 140;
        g.circle(x, y, lerp(22, 140, k * k), C.white, { lw: 8 });
      }
      if (s.hitMe) {
        g.push();
        g.alpha(0.85);
        g.circle(px, wallY - 200, 300, C.white, { lw: 10 });
        g.pop();
      }
      pips(g, w / 2, 60, s.need, s.hits, 24, C.green);
      if (s.msg && s.msg.t < 0.5) g.text(s.msg.text, ox, hor - 250, { size: 64, color: s.msg.good ? C.green : C.paper, stroke: C.ink, lw: 12 });
      if (!api.result && !s.standing) g.text(api.t({ en: "DUCKING", pt: "ABAIXADO" }), w / 2, h - 60, { size: 46, color: C.gray2 });
    },
  };
}

export const snowballFight: Entry<S> = {
  def: {
    id: "snowball-fight",
    num: 273,
    name: { en: "Snowball Fight", pt: "Guerra de Neve" },
    verb: { en: "DUCK AND THROW!", pt: "ABAIXA E JOGA!" },
    hint: { pointer: "hold", keys: "space" },
    category: "timing",
    family: "hold",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "Snowball fight in the park. Hold to duck behind your snow wall; release to stand up and throw (0.2 s later). Hit the rival 3 times while he is up taunting (when he winds up, the giant snowball in front of him blocks yours). Standing when his snowball arrives loses. Later he can pop up already winding up, taunts for less time and throws faster.",
    winText: "Land three snowballs on the taunting rival.",
    loseText: "Get hit by his snowball while standing, or run out of time.",
    timeScale: 1.7,
    minTime: 5,
    bg: BG.sky,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result) return;
          const danger = s.opp === "windup" || s.his !== null;
          let duck = true;
          if (s.pending !== null) duck = false;
          else if (!danger && s.opp === "taunt" && s.left > DELAY + MY_FLY + 0.04 && s.mine === null) duck = false;
          if (duck && !io.isDown) io.down(api.w / 2, api.h * 0.85);
          else if (!duck && io.isDown) io.up(api.w / 2, api.h * 0.85);
        },
        lose(s, api, io) {
          if (api.result || io.isDown) return;
          const m = mem(s, () => ({ next: 0 }));
          // fica de pé e arremessa quando o rival está escondido
          if (s.opp === "hidden" && s.left > 0.45 && s.mine === null && s.pending === null && api.time >= m.next) {
            io.tap(api.w / 2, api.h * 0.85);
            m.next = api.time + 0.3;
          }
        },
      }
    : null,
};
