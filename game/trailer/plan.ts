// Roteiro do trailer: a partida que é jogada (uma partida inteira, do #1 ao Game Over) e a edição.
// A partida é real: placar, vidas, acelerações, radar e frase vêm do jogo. O roteiro só escolhe QUAIS microgames
// saem (em vez do sorteio), quem joga (bot que vence ou que perde), o tempo de reação e qual gravação do SPEED UP toca.
import type { RunPlan } from "./harness.ts";

type Bot = "win" | "lose" | "idle";
const g = (id: string, bot: Bot = "win", delay = 0) => ({ id, bot, delay });

// Tempo de reação dos microgames que aparecem no trailer: o bot espera um pouco antes de agir, como uma pessoa.
// Os que não aparecem jogam sem espera (só encurtam a gravação).
const R1 = 0.55;
const R2 = 0.42;
const R3 = 0.32;
const R4 = 0.24;

export const RUN: RunPlan = {
  seed: 20261127,
  fps: 60,
  maxSeconds: 420,
  tail: 6,
  quipSeed: 3,
  voices: { "2": "speedup-2", "3": "faster-1", "4": "mayhem-1", "5": "nobrakes-1" },
  capture: [],
  games: [
    // ---- ×1 (#1–#10): o escritório, controles simples ----
    g("swat-fly", "win", R1), //            #1  toque
    g("pour-coffee", "win", 0.3), //        #2  segurar
    g("shy-button", "win", R1), //          #3  o botão foge do cursor
    g("pancake-flip", "lose", R1), //       #4  falha
    g("wake-coworker", "win", 0.35), //     #5  toques rápidos
    g("goal-dive", "win", R1), //           #6  deslizar
    g("pinata", "win", R1), //              #7
    g("toast-grab", "lose", R1), //         #8  o cachorro leva a torrada
    g("paper-toss", "win", R1), //          #9
    g("ufo-beam", "win", R1), //            #10 → SPEED UP
    // ---- ×2 (#11–#20) ----
    g("fruit-slash", "win", R2), //         #11
    g("claw-drop", "win", R2), //           #12
    g("nail-it", "win", R2), //             #13
    g("hold-sneeze", "lose", R2), //        #14 espirra na reunião
    g("air-hockey", "win", R2), //          #15 (com esse tempo de reação o bot perde: vida a menos, Game Over no #44)
    g("save-the-world", "win", R2), //      #16 WTF
    g("chop-chop", "win"), //               #17
    g("frog-tongue", "win", R2), //         #18
    g("coffee-zombies", "win", R2), //      #19
    g("cut-wire", "win", R2), //            #20 → FASTER
    // ---- ×3 (#21–#30) ----
    g("milk-printer", "win", R3), //        #21 WTF
    g("hole-in-wall", "win", R3), //        #22
    g("evolve-chair", "win", R3), //        #23 WTF
    g("rock-climb", "win", R3), //          #24
    g("captcha", "win", R3), //             #25
    g("laser-cat", "win"), //               #26
    g("photobomb", "win", R3), //           #27 WTF
    g("close-popups", "win", R3), //        #28
    g("boss-flashlight", "win"), //         #29
    g("keepy-uppy", "win"), //              #30 → MAYHEM
    // ---- ×4 (#31–#40) ----
    g("world-upside-down", "win", R4), //   #31 WTF insano
    g("download-ram", "win", R4), //        #32 WTF
    g("eat-meetings", "win", R4), //        #33 WTF
    g("turn-off-sun", "win", R4), //        #34 WTF insano
    g("be-the-wind", "win", R4), //         #35 WTF
    g("touch-grass", "lose", R4), //        #36
    g("break-the-ice", "win", R4), //       #37 WTF
    g("juggle", "win"), //                  #38
    g("skip-stone", "win", R4), //          #39
    g("fall-to-cup", "win", R4), //         #40 → NO BRAKES
    // ---- ×5 (#41…): o caos, as vidas acabam ----
    g("black-hole-boss", "win", R4), //     #41 WTF insano
    g("kaleidoscope", "lose", R4), //       #42 WTF insano
    g("frog-tongue", "lose", R4), //        #43
    g("flip-gravity", "lose", R4), //       #44 WTF insano
    g("floor-is-lava", "lose", R4), //      #45 WTF insano → Game Over
    g("swat-fly", "lose"), //               reserva (se sobrar vida)
    g("pop-wrap", "lose"),
    g("darts", "lose"),
  ],
};
