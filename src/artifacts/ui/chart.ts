// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

const BOTTOM = 24;
const TOP = 8;
const RIGHT = 4;
const CHAR_PX = 7;
const TICK_GAP = 10;
const LABEL_PX = 44;

interface ChartGeometry {
  ticks: { value: number; y: number; label: string }[];
  bars: { month: string; x: number; y: number; w: number; h: number }[];
  labelEvery: number;
}

function tickLabel(dollars: number): string {
  const size = Math.abs(dollars);
  const [unit, suffix] = size >= 1e9 ? [1e9, "B"] : size >= 1e6 ? [1e6, "M"] : size >= 1e3 ? [1e3, "k"] : [1, ""];
  return `${dollars < 0 ? "-" : ""}$${Number((size / unit).toFixed(2))}${suffix}`;
}

function tickStep(top: number): number {
  const raw = top / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return Math.max(1, factor * power);
}

export function chartGeometry(months: { month: string; spent_cents: number }[], width: number, height: number): ChartGeometry {
  const most = Math.max(0, ...months.map((m) => m.spent_cents)) / 100;
  const least = Math.min(0, ...months.map((m) => m.spent_cents)) / 100;
  const flat = most === least;
  const step = tickStep(flat ? 1 : most - least);
  const top = flat ? step : Math.ceil(most / step) * step;
  const bottom = Math.floor(least / step) * step;
  const base = height - BOTTOM;
  const y = (dollars: number): number => base - ((dollars - bottom) / (top - bottom)) * (base - TOP);
  const zero = y(0);
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step).map((value) => ({ value, y: y(value), label: tickLabel(value) }));
  const left = Math.ceil(Math.max(...ticks.map((t) => t.label.length)) * CHAR_PX) + TICK_GAP;
  const band = Math.max(0, width - RIGHT - left) / (months.length + 0.25);
  const bars = months.map((m, i) => {
    const at = y(m.spent_cents / 100);
    return { month: m.month, x: left + band * (i + 0.25), y: Math.min(at, zero), w: band * 0.75, h: Math.abs(zero - at) };
  });
  return { ticks, bars, labelEvery: band > 0 ? Math.ceil(LABEL_PX / band) : months.length };
}
