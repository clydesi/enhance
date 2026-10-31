// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { Cell } from "../types";

const OPEN = '<svg viewBox="0 0 10 24" aria-hidden="true" class="block aspect-10/24 h-[1em] w-auto overflow-visible fill-none" stroke-linecap="round" stroke-linejoin="round">';

const BUSINESS = "stroke-teal-700 dark:stroke-teal dark:opacity-60";
const TEXT = "stroke-current";
const SPLIT = "stroke-orange-500 dark:stroke-orange-600 dark:opacity-80";
const BAR = "stroke-[3.4]";
const HEAD = "stroke-[2.4]";

const arrows = (up: string): string =>
  `<g class="${up}"><path class="${BAR}" d="M5 3v6.5"/><path class="${HEAD}" d="M2 5 5 2l3 3"/></g>` +
  `<g class="${SPLIT}"><path class="${BAR}" d="M5 14.5V21"/><path class="${HEAD}" d="m2 19 3 3 3-3"/></g>`;

const MARK_BUSINESS = `${OPEN}<path class="${BUSINESS} stroke-3 [vector-effect:non-scaling-stroke]" d="M5 2.2v7.3M5 14.5v7.3"/></svg>`;

const MARK_SPLIT = `${OPEN}${arrows(TEXT)}</svg>`;

const MARK_SPLIT_BUSINESS = `${OPEN}${arrows(BUSINESS)}</svg>`;

const MARKS: Readonly<Record<NonNullable<Cell["mark"]>, string>> = { business: MARK_BUSINESS, split: MARK_SPLIT, split_business: MARK_SPLIT_BUSINESS };

export const markSvg = (name: string): string | undefined => (Object.hasOwn(MARKS, name) ? MARKS[name as keyof typeof MARKS] : undefined);
