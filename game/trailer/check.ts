// Conferência do MP4 final: formato, duração, loudness, trechos pretos ou mudos, e uma folha de quadros (1 por segundo)
// e a forma de onda para revisão visual.   node game/trailer/check.ts
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "game", ".dev", "trailer");
const MP4 = join(OUT, "microgame-mayhem-trailer.mp4");

const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", MP4], { encoding: "utf8" }));
for (const s of probe.streams) {
  if (s.codec_type === "video") console.log(`vídeo: ${s.codec_name} ${s.profile} ${s.width}×${s.height} ${s.r_frame_rate} fps ${s.pix_fmt}, ${s.nb_frames} quadros`);
  else console.log(`áudio: ${s.codec_name} ${s.sample_rate} Hz ${s.channels} canais ${Math.round(s.bit_rate / 1000)} kbps`);
}
console.log(`duração: ${Number(probe.format.duration).toFixed(2)} s, ${(Number(probe.format.size) / 1048576).toFixed(1)} MB`);

const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", MP4, "-af", "ebur128=peak=true,silencedetect=n=-45dB:d=0.4", "-vf", "blackdetect=d=0.25:pix_th=0.05", "-f", "null", "-"], { encoding: "utf8" });
const err = r.stderr ?? "";
const sum = err.slice(err.lastIndexOf("Summary:"));
const I = /I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1];
const LRA = /LRA:\s+([\d.]+) LU/.exec(sum)?.[1];
const peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1];
console.log(`loudness: ${I} LUFS integrada, LRA ${LRA} LU, pico real ${peak} dBTP`);
const blacks = [...err.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${m[1]}–${m[2]}`);
const silences = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => m[1]);
console.log(`trechos pretos: ${blacks.length ? blacks.join(", ") : "nenhum"}`);
console.log(`silêncios (> 0,4 s abaixo de −45 dB): ${silences.length ? silences.join(", ") : "nenhum"}`);

execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", MP4, "-vf", "fps=1,scale=384:-1,tile=6x8:padding=4", "-frames:v", "1", join(OUT, "check-sheet.png")]);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", MP4, "-filter_complex", "showwavespic=s=1800x300:split_channels=0:colors=0xff5a1f", "-frames:v", "1", join(OUT, "check-wave.png")]);
console.log("folha: check-sheet.png · forma de onda: check-wave.png");
