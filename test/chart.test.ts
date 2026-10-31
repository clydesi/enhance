// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";
import { chartGeometry } from "../src/artifacts/ui/chart.ts";

const months = (...cents: number[]) => cents.map((spent_cents, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, spent_cents }));

test("bars rise from the zero line, which sits at the bottom when no month is below zero", () => {
  const { ticks, bars } = chartGeometry(months(10000, 25000, 0), 400, 200);
  const zero = ticks.find((t) => t.value === 0)!.y;
  assert.equal(ticks[0]!.value, 0);
  assert.ok(bars.every((bar) => Math.abs(bar.y + bar.h - zero) < 1e-9));
  assert.ok(bars[1]!.h > bars[0]!.h && bars[2]!.h === 0);
});

test("a bar's height is its amount on the ticks' scale", () => {
  const { ticks, bars } = chartGeometry(months(20000, 10000), 400, 200);
  const perDollar = (ticks[0]!.y - ticks[1]!.y) / (ticks[1]!.value - ticks[0]!.value);
  assert.ok(Math.abs(bars[0]!.h - 200 * perDollar) < 1e-9 && Math.abs(bars[1]!.h - 100 * perDollar) < 1e-9);
});

test("all months at zero, or none, still give a zero line and one tick above it", () => {
  for (const input of [months(0, 0), months()]) {
    const { ticks, bars } = chartGeometry(input, 400, 200);
    assert.deepEqual(ticks.map((t) => t.label), ["$0", "$1"]);
    assert.ok(bars.every((bar) => bar.h === 0));
  }
});

test("when every month is below zero, the zero line is the top tick", () => {
  const { ticks, bars } = chartGeometry(months(-1500, -50000), 400, 200);
  assert.equal(ticks.at(-1)!.value, 0);
  assert.ok(ticks[0]!.label.startsWith("-$"));
  assert.ok(bars.every((bar) => Math.abs(bar.y - ticks.at(-1)!.y) < 1e-9 && bar.h > 0));
});

test("a month whose refunds outweigh its spending hangs below the zero line, with ticks below zero", () => {
  const { ticks, bars } = chartGeometry(months(30000, -12000), 400, 200);
  const zero = ticks.find((t) => t.value === 0)!.y;
  assert.ok(ticks[0]!.value < 0 && ticks[0]!.label.startsWith("-$"), JSON.stringify(ticks));
  assert.ok(Math.abs(bars[0]!.y + bars[0]!.h - zero) < 1e-9);
  assert.ok(Math.abs(bars[1]!.y - zero) < 1e-9 && bars[1]!.h > 0);
  assert.ok(ticks.every((t, i) => i === 0 || t.y < ticks[i - 1]!.y));
});
