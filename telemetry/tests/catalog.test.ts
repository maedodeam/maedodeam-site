// O catálogo do servidor (shared/catalog.gen.ts) precisa estar igual ao registro do jogo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG as SERVER } from "../shared/catalog.gen.ts";
import { CATALOG as GAME } from "../../game/src/games/index.ts";

test("catálogo da telemetria em dia com os microgames do jogo (rode telemetry/scripts/gen-catalog.ts)", () => {
  assert.equal(Object.keys(SERVER).length, GAME.length);
  for (const d of GAME) {
    const s = SERVER[d.id];
    assert.ok(s, `${d.id} falta no catálogo da telemetria`);
    assert.deepEqual([s[0], s[1], s[2]], [d.num, d.difficulty, d.wtf ?? ""], d.id);
  }
});
