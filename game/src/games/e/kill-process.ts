// 089 · END TASK! — gerenciador de tarefas: a lista se reordena o tempo todo. Toque no processo que está em 99% de CPU.
import type { Entry, MicroAPI, MicroInstance } from "../../core/types.ts";
import type { Gfx } from "../../gfx/draw.ts";
import { C, BG } from "../../gfx/palette.ts";
import { approach } from "../../kit/mover.ts";
import { card, fitText, isPortrait } from "./util.ts";

interface Proc {
  name: string;
  cpu: number;
  mem: number;
  /** Posição (índice de linha) atual e animada. */
  slot: number;
  y: number;
  decoy: boolean;
}
interface S {
  procs: Proc[];
  hog: number;
  x0: number;
  pw: number;
  top: number;
  rh: number;
  reorder: number;
  picked: number;
  t: number;
  endT: number;
}

const NAMES = {
  en: [
    "browser (300 tabs)",
    "haunted_printer.exe",
    "crypto_toaster.exe",
    "meeting_forever.exe",
    "sheet_v9_FINAL.xls",
    "cat_video_4k.mp4",
    "antivirus_lite.exe",
    "update_helper.exe",
    "music_player.exe",
    "screensaver_3d.exe",
  ],
  pt: [
    "navegador (300 abas)",
    "impressora_assombrada",
    "torradeira_cripto.exe",
    "reuniao_infinita.exe",
    "planilha_v9_FINAL.xls",
    "video_de_gato_4k.mp4",
    "antivirus_lite.exe",
    "atualizador.exe",
    "musica_do_rh.exe",
    "proteção_de_tela.exe",
  ],
};
const EDITOR = { en: "editor (UNSAVED!)", pt: "editor (NÃO SALVO!)" };

function setup(api: MicroAPI): MicroInstance {
  const { w, h, rng } = api;
  const lv = Math.min(api.level, 1.5);
  const portrait = isPortrait(api) || api.w < 1300;
  const n = lv < 0.5 ? 5 : 6;
  const names = rng.shuffle(NAMES[api.lang]).slice(0, n - 1);
  const editor = rng.int(0, names.length);
  names.splice(editor, 0, api.t(EDITOR));
  let hog = rng.int(0, n - 2);
  if (hog >= editor) hog++;
  const nDecoy = lv < 0.4 ? 0 : lv < 1.1 ? 1 : 2;
  const decoys = rng.shuffle(Array.from({ length: n }, (_, i) => i).filter((i) => i !== hog)).slice(0, nDecoy);
  const pw = portrait ? w - 100 : Math.min(1420, w - 200);
  const x0 = (w - pw) / 2;
  const rh = Math.min(portrait ? 170 : 122, (h - 170 - 80) / n);
  const head = 170;
  const top = portrait ? (h - (head + n * rh)) / 2 + head : (h - (head + n * rh)) / 2 + head + 20;
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const procs: Proc[] = names.map((name, i) => ({
    name,
    cpu: 0,
    mem: 0,
    slot: order[i],
    y: top + order[i] * rh,
    decoy: decoys.includes(i),
  }));
  const s: S = { procs, hog, x0, pw, top, rh, reorder: 0.6, picked: -1, t: 0, endT: 0 };

  const roll = () => {
    for (let i = 0; i < s.procs.length; i++) {
      const p = s.procs[i];
      p.cpu = i === s.hog ? 99 : p.decoy ? rng.pick([89, 96, 97, 98, 9, 90]) : rng.int(0, 35 + Math.round(lv * 30));
      p.mem = rng.int(40, 4000);
    }
    // ordena por memória (decrescente): a lista pula, o 99% muda de lugar
    const sorted = s.procs.slice().sort((a, b) => b.mem - a.mem);
    sorted.forEach((p, k) => (p.slot = k));
  };
  roll();
  for (const p of s.procs) p.y = s.top + p.slot * s.rh;

  return {
    s,
    update(dt) {
      s.t += dt;
      if (api.result) {
        s.endT += dt;
        return;
      }
      const inp = api.input;
      if (inp.pressed && inp.x > s.x0 - 10 && inp.x < s.x0 + s.pw + 10) {
        for (let i = 0; i < s.procs.length; i++) {
          const p = s.procs[i];
          if (inp.y >= p.y && inp.y < p.y + s.rh) {
            s.picked = i;
            if (i === s.hog) {
              api.sfx("zap");
              api.fx.burst(s.x0 + s.pw / 2, p.y + s.rh / 2, C.green, 20);
              api.win();
            } else {
              api.sfx("buzz");
              api.fx.shake(0.6);
              api.lose();
            }
            return;
          }
        }
      }
      s.reorder -= dt;
      if (s.reorder <= 0) {
        s.reorder += 0.6;
        roll();
        api.sfx("slide");
      }
      for (const p of s.procs) p.y = approach(p.y, s.top + p.slot * s.rh, 18, dt);
    },
    draw(g: Gfx) {
      g.clear(BG.blue);
      for (let i = 0; i < 12; i++) g.rect((i * 293) % w, (i * 157) % h, 60, 60, "#5a8eff", { stroke: null, r: 10 });
      const head = 170;
      const portrait = s.pw < 1000;
      const bottom = s.top + s.procs.length * s.rh + 20;
      card(g, s.x0, s.top - head, s.pw, bottom - (s.top - head), C.paper, 22, 8);
      g.rect(s.x0, s.top - head, s.pw, 80, C.ink2, { r: 22 });
      g.rect(s.x0 + 4, s.top - head + 50, s.pw - 8, 30, C.ink2, { stroke: null });
      const hot = !api.result || api.result === "lose";
      fitText(g, api.t({ en: "TASK MANAGER", pt: "GERENCIADOR DE TAREFAS" }) + (hot ? " — CPU 100%" : " — CPU 3%"), s.x0 + 30, s.top - head + 42, s.pw - 140, {
        size: 40,
        font: "mono",
        align: "left",
        color: hot ? C.yellow : C.green,
      });
      // ventoinha
      const fx = s.x0 + s.pw - 50;
      const fy = s.top - head + 40;
      g.circle(fx, fy, 26, C.gray, { lw: 4 });
      const spin = hot ? g.time * 40 : s.endT * 6;
      for (let b = 0; b < 3; b++) g.line(fx, fy, fx + Math.cos(spin + b * 2.1) * 20, fy + Math.sin(spin + b * 2.1) * 20, C.ink, 7);
      // cabeçalho das colunas
      const cpuX = s.x0 + s.pw - (portrait ? 150 : 300);
      const memX = s.x0 + s.pw - 40;
      const hy = s.top - 50;
      g.text(api.t({ en: "PROCESS", pt: "PROCESSO" }), s.x0 + 34, hy, { size: 36, font: "mono", weight: 800, align: "left", color: C.gray2 });
      g.text("CPU", cpuX, hy, { size: 36, font: "mono", weight: 800, align: "right", color: C.gray2 });
      if (!portrait) g.text("MEM ▼", memX, hy, { size: 36, font: "mono", weight: 800, align: "right", color: C.blue });
      g.line(s.x0 + 20, s.top - 14, s.x0 + s.pw - 20, s.top - 14, C.gray, 4);

      g.push();
      g.clip(s.x0, s.top - 10, s.pw, bottom - s.top + 6, 0);
      for (let i = 0; i < s.procs.length; i++) {
        const p = s.procs[i];
        const isHog = i === s.hog;
        const killed = api.result && s.picked === i;
        const rowBg = killed ? (isHog ? C.green2 : "#ffb3b3") : p.slot % 2 ? "#e4e0d6" : C.white;
        g.rect(s.x0 + 16, p.y + 6, s.pw - 32, s.rh - 12, rowBg, { r: 14, lw: 4 });
        const cy = p.y + s.rh / 2;
        // barra de CPU atrás do número
        const barW = portrait ? 110 : 240;
        g.rect(cpuX - barW, cy - 22, (barW * p.cpu) / 100, 44, p.cpu >= 90 ? "#ffb3b3" : "#c7e9d5", { r: 8, stroke: null });
        const nameSize = portrait ? 50 : 48;
        fitText(g, p.name, s.x0 + 40, cy + 2, cpuX - barW - s.x0 - 60, { size: nameSize, font: "mono", align: "left", color: C.ink });
        const cpuCol = p.cpu === 99 ? "#d01818" : p.cpu >= 89 ? "#b4561a" : C.ink;
        g.text(`${p.cpu}%`, cpuX, cy + 2, { size: 52, font: "mono", weight: 800, align: "right", color: cpuCol });
        if (!portrait) g.text(`${p.mem}MB`, memX, cy + 2, { size: 40, font: "mono", align: "right", color: C.gray2 });
        if (killed) {
          g.line(s.x0 + 30, cy, s.x0 + s.pw - 30, cy, isHog ? "#1d8a4c" : C.red, 8);
        }
      }
      g.pop();
      if (api.result === "lose" && s.picked >= 0) {
        const msg = api.t({ en: `OOPS: CLOSED ${s.procs[s.picked].name}`, pt: `XI: FECHOU ${s.procs[s.picked].name}` });
        fitText(g, msg, w / 2, Math.min(h - 50, bottom + 70), w - 120, { size: 56, color: C.white, stroke: C.ink, lw: 12 });
      } else if (api.result === "win") {
        fitText(g, api.t({ en: "TASK ENDED. PHEW.", pt: "TAREFA FINALIZADA. UFA." }), w / 2, Math.min(h - 50, bottom + 70), w - 120, { size: 60, color: C.yellow, stroke: C.ink, lw: 12 });
      }
    },
  };
}

export const killProcess: Entry<S> = {
  def: {
    id: "kill-process",
    num: 89,
    name: { en: "End Task", pt: "Finaliza a Tarefa" },
    verb: { en: "END TASK!", pt: "FINALIZA!" },
    hint: { pointer: "tap" },
    category: "tech",
    family: "tap",
    goal: "complete",
    difficulty: 2,
    mechanic:
      "A task manager with 5 or 6 silly processes. Every 0.6 s the list re-sorts and the numbers change. Tap the one at 99% CPU, wherever it is now. Later, decoys sit at 96-98%.",
    winText: "End the process at 99% CPU.",
    loseText: "End any other process (like your unsaved editor), or time runs out.",
    timeScale: 1.1,
    minTime: 3,
    bg: BG.blue,
    setup,
  },
  bots: BOTS
    ? {
        win(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const p = s.procs[s.hog];
          // espera a linha assentar (como um jogador faria)
          if (Math.abs(p.y - (s.top + p.slot * s.rh)) > 12 || s.reorder < 0.08) return;
          io.tap(s.x0 + s.pw / 2, p.y + s.rh / 2);
        },
        lose(s, api, io) {
          if (api.result || api.time < 0.3 || io.isDown) return;
          const p = s.procs[(s.hog + 1) % s.procs.length];
          if (Math.abs(p.y - (s.top + p.slot * s.rh)) > 12 || s.reorder < 0.08) return;
          io.tap(s.x0 + s.pw / 2, p.y + s.rh / 2);
        },
      }
    : null,
};
