// 049 · SWERVE! — descendo o corredor numa cadeira de rodinhas. Troque de faixa para não bater em nada.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { mem } from "../../testing/botkit.ts";
import { prog, mix } from "./util.ts";

type Kind = "plant" | "person" | "cone" | "sign" | "box";
interface Obs {
  lane: number;
  y: number;
  kind: Kind;
  hit: boolean;
}
interface Row {
  y: number;
  free: number[];
}
interface S {
  lanes: number;
  laneW: number;
  x0: number;
  lane: number; // faixa alvo
  px: number;
  py: number;
  obs: Obs[];
  rows: Row[];
  speed: number;
  oh: number; // meia altura dos obstáculos
  ph: number; // meia altura da cadeira
  crashed: boolean;
  scroll: number;
  clock: number;
  /** Gesto do ponteiro em curso: 0 = nenhum, 1 = acompanhando, 2 = já virou troca de faixa. */
  gest: 0 | 1 | 2;
}

/** Arrasto horizontal mínimo (unidades do palco) para contar como deslizar. Bem abaixo do SWIPE_MIN global. */
const SWIPE = 36;

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const p = prog(lv);
  const lanes = lv < 1 ? 3 : 4;
  const cw = Math.min(w - 160, lanes * (h > w ? 290 : 270));
  const laneW = cw / lanes;
  const py = h * (h > w ? 0.8 : 0.78);
  const speed = mix(820, 1350, p);
  const gapT = mix(0.8, 0.52, p);
  const s: S = {
    lanes,
    laneW,
    x0: w / 2 - cw / 2,
    lane: Math.floor(lanes / 2),
    px: 0,
    py,
    obs: [],
    rows: [],
    speed,
    oh: Math.min(laneW * 0.4, 110) * 0.72,
    ph: 56,
    crashed: false,
    scroll: 0,
    clock: 0,
    gest: 0,
  };
  s.px = s.x0 + (s.lane + 0.5) * laneW;
  // Fileiras pré-sorteadas. Uma faixa livre "garantida" anda no máximo uma faixa por fileira.
  let safe = rng.int(0, lanes - 1);
  const kinds: Kind[] = ["plant", "person", "cone", "sign", "box"];
  // a primeira fileira só chega depois que a instrução sai da tela (dá tempo de reagir)
  const first = 1.15 + (s.oh + s.ph) / speed;
  let t = first;
  for (let k = 0; ; k++) {
    if (k > 0) {
      const ns = Math.max(0, Math.min(lanes - 1, safe + rng.int(-1, 1)));
      // trocar de faixa pede um pouco mais de espaço entre as fileiras
      t += gapT * rng.range(0.95, 1.15) + (ns !== safe ? 0.08 : 0);
      safe = ns;
    }
    if (t > api.duration + 1) break;
    const others = rng.shuffle(Array.from({ length: lanes }, (_, i) => i).filter((i) => i !== safe));
    const nBlock = Math.max(1, Math.min(lanes - 1, rng.int(1, lanes - 1 + (lv > 0.6 ? 1 : 0))));
    const blocked = others.slice(0, nBlock);
    const y = py - speed * t;
    for (const lane of blocked) s.obs.push({ lane, y, kind: rng.pick(kinds), hit: false });
    s.rows.push({ y, free: Array.from({ length: lanes }, (_, i) => i).filter((i) => !blocked.includes(i)) });
  }

  return {
    s,
    update(dt) {
      s.clock += dt;
      const inp = api.input;
      if (!s.crashed && !api.result) {
        // Troca de faixa tolerante. Antes (sideTap), o toque só valia se o dedo andasse < 40 e o deslizar
        // só valia com >= 90 em até 0,75 s: no meio disso nada acontecia, e o lado era o meio do palco
        // (com 4 faixas, a cadeira quase nunca está no meio). Agora:
        // - deslizar curto (>= SWIPE na horizontal) troca na hora, sem esperar soltar;
        // - qualquer outro toque/clique troca ao soltar, para o lado em que encostou em relação à cadeira;
        // - setas continuam valendo.
        let d = 0;
        if (inp.keyPressed("left")) d = -1;
        else if (inp.keyPressed("right")) d = 1;
        if (inp.pressed) s.gest = 1;
        if (s.gest === 1 && (inp.down || inp.released)) {
          const dx = inp.x - inp.startX;
          if (Math.abs(dx) >= SWIPE && Math.abs(dx) >= Math.abs(inp.y - inp.startY) * 0.8) {
            d = dx < 0 ? -1 : 1;
            s.gest = 2;
          }
        }
        if (inp.released) {
          if (s.gest === 1) d = inp.startX < s.px ? -1 : 1;
          s.gest = 0;
        }
        if (d !== 0) {
          const nl = Math.max(0, Math.min(s.lanes - 1, s.lane + d));
          if (nl !== s.lane) {
            s.lane = nl;
            api.sfx("swoosh");
          } else api.sfx("thud");
        }
      }
      const tx = s.x0 + (s.lane + 0.5) * s.laneW;
      // troca de faixa rápida (~0.12 s)
      const step = s.laneW * 9 * dt;
      s.px = Math.abs(tx - s.px) <= step ? tx : s.px + Math.sign(tx - s.px) * step;
      const mv = s.crashed ? 0 : s.speed;
      s.scroll += mv * dt;
      for (const o of s.obs) o.y += mv * dt;
      for (const r of s.rows) r.y += mv * dt;
      if (api.result || s.crashed) return;
      for (const o of s.obs) {
        const ox = s.x0 + (o.lane + 0.5) * s.laneW;
        if (Math.abs(o.y - s.py) < s.oh + s.ph && Math.abs(ox - s.px) < s.laneW * 0.52) {
          o.hit = true;
          s.crashed = true;
          api.sfx("thud");
          api.fx.shake(0.8);
          api.fx.pop(s.px, s.py - 160, "BONK", C.red);
          api.lose();
          return;
        }
      }
    },
    draw(g: Gfx) {
      g.clear(BG.office);
      const lw = s.laneW;
      const cx0 = s.x0;
      const cx1 = s.x0 + lw * s.lanes;
      // paredes com portas
      g.rect(-10, -10, cx0 + 10, h + 20, C.purple2, { stroke: null });
      g.rect(cx1, -10, w - cx1 + 10, h + 20, C.purple2, { stroke: null });
      const doorGap = 520;
      const off = s.scroll % doorGap;
      for (let y = -doorGap + off; y < h + doorGap; y += doorGap) {
        if (cx0 > 140) {
          g.rect(cx0 - 60, y, 50, 230, C.brown2, { r: 6, lw: 6 });
          g.rect(cx0 - 200, y + 300, 120, 120, C.green2, { r: 60, lw: 6 });
          g.rect(cx1 + 10, y + 180, 50, 230, C.brown2, { r: 6, lw: 6 });
        } else {
          g.rect(cx0 - 26, y, 22, 200, C.brown2, { r: 4, lw: 5 });
          g.rect(cx1 + 4, y + 220, 22, 200, C.brown2, { r: 4, lw: 5 });
        }
      }
      // piso do corredor
      g.rect(cx0, -10, cx1 - cx0, h + 20, C.blue2, { lw: 8 });
      const tile = 200;
      const toff = s.scroll % tile;
      for (let y = -tile + toff; y < h + tile; y += tile) g.rect(cx0 + 4, y, cx1 - cx0 - 8, tile / 2, "#9dbcff", { stroke: null });
      for (let i = 1; i < s.lanes; i++) {
        const x = cx0 + lw * i;
        for (let y = -120 + (s.scroll % 120); y < h; y += 120) g.line(x, y, x, y + 60, C.white, 9);
      }
      // obstáculos (vista de cima)
      for (const o of s.obs) {
        if (o.y < -200 || o.y > h + 200) continue;
        const x = cx0 + (o.lane + 0.5) * lw;
        const y = o.y;
        const r = Math.min(lw * 0.4, 110);
        g.ellipse(x + 10, y + 14, r, r * 0.9, "rgba(0,0,0,0.18)", { stroke: null });
        switch (o.kind) {
          case "plant":
            g.circle(x, y, r * 0.8, C.orange);
            for (let i = 0; i < 6; i++) {
              const a = i * 1.05 + 0.3;
              g.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.5, r * 0.22, C.green, { rot: a, lw: 5 });
            }
            g.circle(x, y, r * 0.2, C.green2, { lw: 4 });
            break;
          case "person":
            g.ellipse(x, y + 6, r, r * 0.55, C.blue);
            g.circle(x, y, r * 0.48, C.ink2);
            g.circle(x + r * 0.75, y - r * 0.5, r * 0.26, C.white, { lw: 5 });
            g.circle(x + r * 0.75, y - r * 0.5, r * 0.15, C.brown, { stroke: null });
            break;
          case "cone":
            g.rectC(x, y, r * 1.6, r * 1.6, C.orange, { r: 10 });
            g.circle(x, y, r * 0.6, C.white, { lw: 5 });
            g.circle(x, y, r * 0.32, C.orange, { lw: 5 });
            break;
          case "sign":
            g.shape(x, y, [0, -r, r, r * 0.8, -r, r * 0.8], C.yellow);
            g.text("!", x, y + r * 0.2, { size: r * 1.1, color: C.ink });
            break;
          default:
            g.rectC(x, y, r * 1.7, r * 1.4, C.brown2, { r: 6 });
            g.line(x - r * 0.85, y, x + r * 0.85, y, C.yellow2, 10);
        }
      }
      // cadeira com o jogador (vista de cima, de costas)
      const x = s.px;
      const y = s.py;
      const tilt = (x - (s.x0 + (s.lane + 0.5) * lw)) / lw;
      g.push();
      g.translate(x, y);
      g.rotate(s.crashed ? Math.sin(s.clock * 20) * 0.4 : -tilt * 0.5);
      g.scale(1.3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + s.clock * (s.crashed ? 0 : 2);
        g.line(0, 0, Math.cos(a) * 70, Math.sin(a) * 70, C.gray2, 12);
        g.circle(Math.cos(a) * 70, Math.sin(a) * 70, 13, C.ink2, { lw: 4 });
      }
      g.rectC(0, 6, 120, 100, C.blue, { r: 30 });
      g.rectC(0, 54, 132, 34, C.blue, { r: 14 });
      g.ellipse(-62, -10, 18, 40, C.skin, { lw: 5 });
      g.ellipse(62, -10, 18, 40, C.skin, { lw: 5 });
      g.ellipse(0, 0, 54, 38, C.white);
      g.circle(0, -6, 34, C.ink2);
      g.pop();
      // linhas de velocidade
      if (!s.crashed) {
        for (let i = 0; i < 3; i++) {
          const yy = y + 90 + ((s.clock * 900 + i * 60) % 180);
          g.line(x - 40 + i * 40, yy, x - 40 + i * 40, yy + 40, C.muted, 6);
        }
      }
      if (s.crashed) {
        for (let i = 0; i < 3; i++) {
          const a = s.clock * 5 + i * 2.1;
          g.star(x + Math.cos(a) * 70, y - 90 + Math.sin(a) * 20, 18, 8, 5, C.yellow, { lw: 4 });
        }
      }
    },
  };
}

/** Ponto de toque dos bots: um pouco ao lado da cadeira, na direção pedida. */
function sideX(s: S, w: number, d: number): number {
  return Math.max(10, Math.min(w - 10, s.px + d * s.laneW * 0.8));
}

export const chairLanes: Entry<S> = {
  def: {
    id: "chair-lanes",
    num: 49,
    name: { en: "Office Chair Race", pt: "Corrida de Cadeira" },
    verb: { en: "SWERVE!", pt: "ESQUIVA!" },
    hint: { pointer: "tap", keys: "lr" },
    category: "dodge",
    family: "swipe",
    goal: "survive",
    difficulty: 2,
    mechanic: "Rolling down the hallway on an office chair (top view). Plants, coworkers, cones and boxes come down 3 (later 4) lanes. Tap or click anywhere left or right of the chair (or make a short swipe, or press left/right) to move one lane that way. There is always a free lane within reach.",
    winText: "Roll until time runs out without hitting anything.",
    loseText: "Crash into an obstacle.",
    minTime: 3,
    bg: BG.office,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ cool: 0 }));
          m.cool -= dt;
          // programação dinâmica nas próximas fileiras: menor número de trocas até lá
          const ahead = s.rows.filter((r) => r.y < s.py + s.oh + s.ph).sort((a, b) => b.y - a.y);
          let want = s.lane;
          if (ahead.length) {
            const L = s.lanes;
            const INF = 1e9;
            const rows = ahead.slice(0, 5);
            let cost = Array.from({ length: L }, (_, l) => (rows[0].free.includes(l) ? Math.abs(l - s.lane) : INF));
            const choice: number[][] = [];
            for (let k = 1; k < rows.length; k++) {
              const nc = Array(L).fill(INF);
              const ch = Array(L).fill(-1);
              for (let l = 0; l < L; l++) {
                if (!rows[k].free.includes(l)) continue;
                for (let q = Math.max(0, l - 1); q <= Math.min(L - 1, l + 1); q++) {
                  if (cost[q] + Math.abs(l - q) < nc[l]) {
                    nc[l] = cost[q] + Math.abs(l - q);
                    ch[l] = q;
                  }
                }
              }
              choice.push(ch);
              cost = nc;
            }
            let l = cost.indexOf(Math.min(...cost));
            for (let k = choice.length - 1; k >= 0; k--) l = choice[k][l] >= 0 ? choice[k][l] : l;
            want = l;
          }
          if (want !== s.lane && m.cool <= 0) {
            // só troca se a faixa vizinha não tiver obstáculo passando agora
            const nl = s.lane + Math.sign(want - s.lane);
            const busy = s.obs.some((o) => o.lane === nl && Math.abs(o.y - s.py) < s.oh + s.ph + s.speed * 0.06);
            if (!busy) {
              io.tap(sideX(s, api.w, want < s.lane ? -1 : 1), api.h * 0.5);
              m.cool = 0.07;
            }
          }
        },
        lose(s, api, io, dt) {
          if (api.result) return;
          const m = mem(s, () => ({ cool: 0, lift: false }));
          m.cool -= dt;
          const next = s.obs.filter((o) => o.y < s.py).sort((a, b) => b.y - a.y)[0];
          if (m.lift) {
            io.up(io.px, io.py);
            m.lift = false;
          }
          if (next && next.lane !== s.lane && m.cool <= 0) {
            const d = next.lane < s.lane ? -1 : 1;
            if (io.touch) {
              // deslizar curto (abaixo do antigo limite de 90) começando em cima da cadeira
              io.down(s.px, s.py);
              io.move(s.px + d * 50, s.py + 8);
              m.lift = true;
            } else io.tap(sideX(s, api.w, d), api.h * 0.5);
            m.cool = 0.08;
          }
        },
      }
    : null,
};
