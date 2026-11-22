// Interfaces mínimas do Cloudflare D1 (o suficiente para o código e os testes; evita depender de pacotes de tipos).
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success?: boolean;
  meta?: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
