// D1 de mentira sobre o SQLite embutido no Node (node:sqlite): roda o esquema real (migrations/) nos testes
// e no servidor local, sem instalar nada e sem falar com a Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { D1Database, D1PreparedStatement, D1Result } from "../shared/d1.ts";

const migrations = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

type Value = string | number | null;

class Stmt implements D1PreparedStatement {
  private readonly db: DatabaseSync;
  readonly sql: string;
  readonly params: Value[];
  constructor(db: DatabaseSync, sql: string, params: Value[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...values: unknown[]): D1PreparedStatement {
    return new Stmt(
      this.db,
      this.sql,
      values.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : (v as Value))),
    );
  }
  async run(): Promise<D1Result> {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
  async all<T>(): Promise<D1Result<T>> {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[], success: true };
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
  }
}

export class SqliteD1 implements D1Database {
  readonly raw: DatabaseSync;
  constructor(file = ":memory:") {
    this.raw = new DatabaseSync(file);
    for (const f of readdirSync(migrations).filter((x) => x.endsWith(".sql")).sort()) this.raw.exec(readFileSync(join(migrations, f), "utf8"));
  }
  prepare(sql: string): D1PreparedStatement {
    return new Stmt(this.raw, sql);
  }
  /** Como no D1: tudo numa transação; se um comando falhar, nada fica. */
  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const out: D1Result[] = [];
    this.raw.exec("BEGIN");
    try {
      for (const s of statements) out.push(await s.run());
      this.raw.exec("COMMIT");
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
    return out;
  }
}
