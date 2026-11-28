// Montagem do trailer com FFmpeg, a partir do que record.ts gravou em game/.dev/trailer/.
//   node game/trailer/edit.ts            → game/.dev/trailer/microgame-mayhem-trailer.mp4
//
// 1. cada trecho da edição vira um intermediário sem perda (vídeo RGB + áudio PCM), cortado no quadro exato;
//    o áudio sai do mesmo instante da partida (800 amostras por quadro: 48 kHz / 60 fps), com 6 ms de fade nos cortes;
// 2. os trechos são emendados;
// 3. os textos promocionais (PNG com transparência) entram por cima, nos instantes de edit-plan.ts;
// 4. saída final: H.264 1920×1080 60 fps + AAC, loudness normalizada para redes sociais (−14 LUFS, pico −1 dBTP).
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cardTimes, PRELAP, segments, type Timeline } from "./edit-plan.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "game", ".dev", "trailer");
const TMP = join(OUT, "parts");
const FINAL = join(OUT, "microgame-mayhem-trailer.mp4");
const SR = 48000;
/** A música da tela inicial é ~8 dB mais baixa que a da partida: sobe 6 dB (com limitador) no encerramento. */
const TITLE_GAIN = "volume=6dB,alimiter=limit=0.84:level=disabled";

const tl = JSON.parse(readFileSync(join(OUT, "timeline.json"), "utf8")) as Timeline;
const fps = tl.fps;
const segs = segments(tl);
const cards = cardTimes(segs);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const LOUD = "loudnorm=I=-14:TP=-1.2:LRA=11";

/** Primeira passada do loudnorm: mede a loudness do áudio emendado (o ffmpeg escreve o JSON na saída de erro). */
function measureLoudness(file: string): Record<string, string> {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `${LOUD}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(r.stderr ?? "");
  if (!json) throw new Error("loudnorm não devolveu a medição");
  return JSON.parse(json[0]) as Record<string, string>;
}

function ff(args: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

const list: string[] = [];
let total = 0;
segs.forEach((s, k) => {
  const a = Math.round(s.from * fps);
  const n = Math.round(s.to * fps) - a;
  const dir = s.kind === "run" ? "frames" : "closing";
  const wav = s.kind === "run" ? "run.wav" : "closing.wav";
  const part = join(TMP, `p${String(k).padStart(2, "0")}.mkv`);
  const secs = n / fps;
  // o encerramento continua a música que já entrou no Game Over
  const s0 = s.kind === "closing" ? PRELAP * SR : (a / fps) * SR;
  const s1 = s0 + n * (SR / fps);
  // encerramento: a música sai em fade nos últimos 0,9 s e a imagem escurece nos últimos 0,35 s
  const endFade = s.kind === "closing" ? `,afade=t=out:st=${(secs - 0.9).toFixed(3)}:d=0.9` : `,afade=t=out:st=${(secs - 0.006).toFixed(4)}:d=0.006`;
  const vFade = s.kind === "closing" ? `,fade=t=out:st=${(secs - 0.35).toFixed(3)}:d=0.35` : "";
  // Game Over: aproximação lenta (só enquadramento), para o radar e a frase lerem bem no celular
  const zoom = s.label === "Game Over" ? `,scale=3840:2160:flags=lanczos,zoompan=z='1+0.09*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=${fps}` : "";
  ff([
    "-framerate", String(fps), "-start_number", String(a), "-i", join(OUT, dir, "f%06d.png"),
    "-i", join(OUT, wav),
    "-i", join(OUT, "closing.wav"),
    "-filter_complex",
    `[0:v]trim=end_frame=${n},setpts=PTS-STARTPTS${zoom},format=rgb24${vFade}[v];` +
      `[1:a]atrim=start_sample=${s0}:end_sample=${s1},asetpts=PTS-STARTPTS${s.kind === "closing" ? "," + TITLE_GAIN : ""},afade=t=in:d=0.006${endFade}` +
      (s.label === "Game Over"
        ? `[g];[2:a]atrim=start_sample=0:end_sample=${PRELAP * SR},asetpts=PTS-STARTPTS,${TITLE_GAIN},afade=t=in:d=0.35,adelay=${Math.round((secs - PRELAP) * 1000)}:all=1[m];[g][m]amix=inputs=2:normalize=0:duration=first[a]`
        : "[a]"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264rgb", "-crf", "0", "-preset", "ultrafast", "-r", String(fps),
    "-c:a", "pcm_s16le", "-ar", String(SR),
    part,
  ]);
  list.push(`file '${part.replace(/\\/g, "/")}'`);
  console.log(`${total.toFixed(2).padStart(6)} s  ${secs.toFixed(2)} s  ${s.label}`);
  total += secs;
});
console.log(`duração: ${total.toFixed(2)} s`);

const listFile = join(TMP, "list.txt");
writeFileSync(listFile, list.join("\n"));
const joined = join(TMP, "joined.mkv");
ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined]);

// textos por cima + codificação final
const inputs: string[] = ["-i", joined];
let graph = "[0:v]format=rgba[b0];";
cards.forEach((c, i) => {
  inputs.push("-framerate", String(fps), "-i", join(OUT, "cards", c.id, "f%06d.png"));
  graph += `[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${c.at}/TB[c${i}];[b${i}][c${i}]overlay=eof_action=pass:enable='between(t,${c.at},${c.at + c.seconds})'[b${i + 1}];`;
});
// loudness em duas passadas (medição + correção linear): o mix do jogo não é comprimido de novo
const m = measureLoudness(joined);
const norm = `${LOUD}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
console.log(`loudness medida: ${m.input_i} LUFS, pico ${m.input_tp} dBTP`);
graph += `[b${cards.length}]format=yuv420p[v];[0:a]${norm},aresample=${SR}[a]`;
ff([
  ...inputs,
  "-filter_complex", graph,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-profile:v", "high", "-level", "4.2", "-r", String(fps), "-g", String(fps), "-bf", "2",
  "-c:a", "aac", "-b:a", "256k", "-ar", String(SR),
  "-movflags", "+faststart",
  FINAL,
]);
console.log(`pronto: ${FINAL}`);
