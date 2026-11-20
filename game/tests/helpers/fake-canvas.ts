// Contexto 2D falso para rodar os desenhos dos microgames no Node e pegar erros de execução (variáveis indefinidas,
// números inválidos). Registra chamadas com argumentos não finitos, que no navegador viram desenhos sumidos.
import { Gfx } from "../../src/gfx/draw.ts";

export interface FakeStats {
  calls: number;
  nonFinite: string[];
  saveDepth: number;
  maxSaveDepth: number;
}

export function fakeContext(): { ctx: CanvasRenderingContext2D; stats: FakeStats } {
  const stats: FakeStats = { calls: 0, nonFinite: [], saveDepth: 0, maxSaveDepth: 0 };
  const props: Record<string | symbol, unknown> = { globalAlpha: 1, lineWidth: 1, font: "10px sans-serif" };
  const gradient = { addColorStop() {} };
  const handler: ProxyHandler<object> = {
    get(_t, key) {
      if (key in props) return props[key];
      if (key === "measureText") return (s: string) => ({ width: String(s).length * 30 });
      if (key === "createLinearGradient" || key === "createRadialGradient" || key === "createPattern") return () => gradient;
      if (key === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === "save")
        return () => {
          stats.saveDepth++;
          stats.maxSaveDepth = Math.max(stats.maxSaveDepth, stats.saveDepth);
        };
      if (key === "restore")
        return () => {
          stats.saveDepth--;
        };
      return (...args: unknown[]) => {
        stats.calls++;
        for (const a of args) {
          if (typeof a === "number" && !Number.isFinite(a) && stats.nonFinite.length < 5) stats.nonFinite.push(`${String(key)}(${args.join(",")})`);
        }
      };
    },
    set(_t, key, value) {
      props[key] = value;
      return true;
    },
    has(_t, key) {
      return key === "fontStretch" || key in props;
    },
  };
  return { ctx: new Proxy({}, handler) as CanvasRenderingContext2D, stats };
}

export function fakeGfx(w: number, h: number): { g: Gfx; stats: FakeStats } {
  const { ctx, stats } = fakeContext();
  return { g: new Gfx(ctx, w, h), stats };
}
