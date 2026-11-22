// Telemetria de gameplay (opcional). Só existe no bundle quando telemetry/client.config.json tem um endpoint;
// com o endpoint vazio (padrão), o build remove este módulo inteiro e o jogo não usa rede nenhuma.
//
// Regras (ver telemetry/README.md):
// - cada partida tem um UUID aleatório criado em memória; nada identifica a pessoa nem o aparelho;
// - nada é guardado no navegador (sem cookies, localStorage, sessionStorage, IndexedDB); a fila vive só na memória
//   e eventos que não puderem ser enviados são descartados;
// - nada aqui pode travar ou quebrar o jogo: todo envio é "dispare e esqueça", com try/catch, e nunca é aguardado;
// - respeita "Do Not Track" e Global Privacy Control: com eles ligados, nada é enviado.

export type TelemetryEventType = "game_start" | "microgame_result" | "life_changed" | "game_over" | "game_abandon";
export type Device = "mobile" | "tablet" | "desktop";
export type AbandonReason = "quit" | "pagehide";

/** Evento como vai no fio (ver o contrato em telemetry/README.md). */
export interface WireEvent {
  id: string;
  run: string;
  seq: number;
  type: TelemetryEventType;
  /** ms desde o início da partida. */
  t: number;
  ver: string;
  [k: string]: unknown;
}

/** Como os eventos saem. Injetável nos testes. */
export interface Transport {
  /** Envia um lote. `unloading`: a página está saindo (usar sendBeacon). Nunca deve lançar exceção. */
  send(url: string, body: string, unloading: boolean): void;
}

export interface TelemetryOpts {
  endpoint: string;
  version: string;
  transport?: Transport;
  /** Relógio em ms (performance.now no navegador). */
  now?: () => number;
  /** UUID v4 aleatório. */
  uuid?: () => string;
  /** Agenda uma descarga do lote (setTimeout no navegador). */
  schedule?: (fn: () => void, ms: number) => unknown;
  /** Está online? Sem rede, o evento é descartado. */
  online?: () => boolean;
  /** Pessoa pediu para não ser rastreada (DNT/GPC)? */
  optedOut?: () => boolean;
}

/** Tamanho máximo de um lote (o servidor aceita até 30). */
export const MAX_BATCH = 25;
/** Eventos comuns esperam até este tempo (ms) ou até juntar este tanto para sair num lote só. */
export const FLUSH_MS = 4000;
export const FLUSH_AT = 10;
/** Depois de tantas falhas seguidas, desiste nesta aba (sem insistir, sem acumular). */
export const MAX_FAILURES = 3;
/** Limite da fila em memória: o excedente é descartado. */
export const MAX_QUEUE = 100;

export class Telemetry {
  readonly url: string;
  private readonly o: Required<Omit<TelemetryOpts, "endpoint">>;
  private queue: WireEvent[] = [];
  private run: string | null = null;
  private seq = 0;
  private t0 = 0;
  private scheduled = false;
  private failures = 0;
  /** Desligada por falhas de rede nesta aba. */
  private broken = false;
  /** O navegador pede para não rastrear (Do Not Track / Global Privacy Control): nunca envia. */
  readonly browserOptOut: boolean;
  /** A pessoa desligou as métricas na tela inicial (vale até fechar a página: nada pode ser guardado). */
  private userOptOut = false;

  constructor(o: TelemetryOpts) {
    this.url = o.endpoint.replace(/\/+$/, "") + "/v1/events";
    this.o = {
      version: o.version,
      transport: o.transport ?? browserTransport(() => this.fail(), () => (this.failures = 0)),
      now: o.now ?? (() => performance.now()),
      uuid: o.uuid ?? randomUUID,
      schedule: o.schedule ?? ((fn, ms) => setTimeout(fn, ms)),
      online: o.online ?? (() => typeof navigator === "undefined" || navigator.onLine !== false),
      optedOut: o.optedOut ?? browserOptOut,
    };
    this.browserOptOut = safe(() => this.o.optedOut(), true);
  }

  /** Nada é enviado: o navegador pediu, a pessoa desligou ou o serviço falhou demais. */
  get disabled(): boolean {
    return this.browserOptOut || this.userOptOut || this.broken;
  }

  /** As métricas estão ligadas pela escolha da pessoa (o interruptor da tela inicial). */
  get userEnabled(): boolean {
    return !this.userOptOut;
  }

  /** Interruptor da tela inicial. Desligar descarta a fila e encerra o envio na hora. */
  setUserEnabled(on: boolean): void {
    this.userOptOut = !on;
    if (!on) {
      this.queue = [];
      this.run = null;
    }
  }

  /** Há uma partida em andamento (para decidir se fechar a página é abandono). */
  get active(): boolean {
    return this.run !== null;
  }

  get runId(): string | null {
    return this.run;
  }

  // ---------------- eventos ----------------

  startRun(ctx: { lang: string; device: Device }): void {
    if (this.disabled) return;
    this.run = safe(() => this.o.uuid(), null);
    this.seq = 0;
    this.t0 = this.o.now();
    this.push("game_start", { lang: ctx.lang, device: ctx.device }, true);
  }

  result(d: { n: number; mg: string; result: "win" | "lose"; level: number; tier: number; dur: number; used: number; lives: number; input: string }): void {
    this.push("microgame_result", {
      n: d.n,
      mg: d.mg,
      result: d.result,
      level: round(d.level, 2),
      tier: d.tier,
      dur: round(d.dur, 2),
      used: round(Math.max(0, Math.min(d.used, d.dur)), 2),
      lives: d.lives,
      input: d.input,
    });
  }

  lifeChanged(d: { n: number; from: number; to: number; reason: "lose" | "milestone" }): void {
    this.push("life_changed", d);
  }

  gameOver(d: { n: number; score: number; wins: number }): void {
    this.push("game_over", d, true);
    this.run = null;
  }

  /** Abandono detectado: saiu para o título, ou fechou/trocou de página no meio da partida. n = microgames jogados. */
  abandon(reason: AbandonReason, n: number, unloading = false): void {
    if (!this.run) return;
    this.push("game_abandon", { n, reason }, true, unloading);
    this.run = null;
  }

  /** Página ficando oculta: manda o que estiver na fila (com sendBeacon), sem encerrar a partida. */
  flushNow(unloading = false): void {
    this.flush(unloading);
  }

  // ---------------- fila e envio ----------------

  private push(type: TelemetryEventType, data: Record<string, unknown>, critical = false, unloading = false): void {
    if (this.disabled || !this.run) return;
    try {
      const ev: WireEvent = {
        id: this.o.uuid(),
        run: this.run,
        seq: this.seq++,
        type,
        t: Math.max(0, Math.round(this.o.now() - this.t0)),
        ver: this.o.version,
        ...data,
      };
      if (this.queue.length >= MAX_QUEUE) this.queue.shift();
      this.queue.push(ev);
      if (critical || this.queue.length >= FLUSH_AT) this.flush(unloading);
      else if (!this.scheduled) {
        this.scheduled = true;
        this.o.schedule(() => {
          this.scheduled = false;
          this.flush(false);
        }, FLUSH_MS);
      }
    } catch {
      /* telemetria nunca quebra o jogo */
    }
  }

  private flush(unloading: boolean): void {
    if (this.disabled || this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    if (!safe(() => this.o.online(), true)) return; // offline: descarta
    for (let i = 0; i < batch.length; i += MAX_BATCH) {
      const body = safe(() => JSON.stringify({ v: 1, events: batch.slice(i, i + MAX_BATCH) }), "");
      if (!body) continue;
      try {
        this.o.transport.send(this.url, body, unloading);
      } catch {
        this.fail();
      }
    }
  }

  /** Uma falha de envio. Depois de algumas seguidas, para de tentar nesta aba. */
  fail(): void {
    this.failures++;
    if (this.failures >= MAX_FAILURES) {
      this.broken = true;
      this.queue = [];
    }
  }
}

// ---------------- navegador ----------------

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function round(x: number, d: number): number {
  const k = 10 ** d;
  return Math.round((Number.isFinite(x) ? x : 0) * k) / k;
}

export function randomUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function browserOptOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
}

/** Corpo como text/plain: requisição "simples" (sem preflight de CORS) e aceita pelo sendBeacon. */
function browserTransport(onFail: () => void, onOk: () => void): Transport {
  return {
    send(url, body, unloading) {
      const blob = () => new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (unloading && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        if (navigator.sendBeacon(url, blob())) return;
      }
      if (typeof fetch !== "function") return;
      fetch(url, {
        method: "POST",
        body,
        headers: { "content-type": "text/plain;charset=UTF-8" },
        keepalive: true,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }).then(
        (r) => (r.ok ? onOk() : onFail()),
        () => onFail(),
      );
    },
  };
}

/** Classificação grosseira do aparelho (não é impressão digital: só 3 valores). */
export function deviceClass(): Device {
  try {
    const coarse = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
    if (!coarse) return "desktop";
    return Math.min(screen.width, screen.height) < 600 ? "mobile" : "tablet";
  } catch {
    return "desktop";
  }
}
