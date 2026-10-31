// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { comparable, duplicates, type Problems, readBase, readJson, report, unretired } from "../lib/check.ts";
import { categoriesFormat } from "../lib/format/format.ts";
import { isObject, type Schema } from "../lib/format/schema.ts";

export interface Category {
  id: string;
  root: "personal" | "business" | "transfers";
  parent_id: string | null;
  name: string;
  type: "expense" | "income" | "transfer";
  schedule_c_line: string | null;
  schedule_e_line: string | null;
  protected?: true;
}

export const CATEGORY_SCHEMA = readJson<Schema>(join(import.meta.dirname, "schema.json"));
const FROZEN = ["root", "parent_id", "name", "type"] as const;

function segment(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function checkCategories(categories: Category[], retired: string[], base: Category[] | undefined, baseRetired?: string[]): Problems {
  const { problems, inFormat } = categoriesFormat(categories, CATEGORY_SCHEMA);
  if (!Array.isArray(categories) || inFormat.length !== categories.length) return problems;
  const good = categories.filter((_, i) => inFormat[i]);
  const broken = new Set(categories.filter((c, i) => !inFormat[i] && isObject(c) && typeof c.id === "string").map((c) => c.id));
  const seen = new Map<string, Category>();
  for (const [i, c] of categories.entries()) {
    if (!inFormat[i]) continue;
    const at = `entry ${i} (${c.id})`;
    if ((c.type === "transfer") !== (c.root === "transfers")) problems.push(`${at}: the transfers root, and only it, has the transfer type`);
    if (c.root !== "business" && (c.schedule_c_line !== null || c.schedule_e_line !== null)) problems.push(`${at}: only business categories have tax lines`);
    const parent = c.parent_id === null ? undefined : seen.get(c.parent_id);
    if (c.parent_id !== null && parent === undefined && !broken.has(c.parent_id)) problems.push(`${at}: parent ${c.parent_id} is not an earlier entry`);
    if (parent !== undefined && parent.root !== c.root) problems.push(`${at}: parent is in another root`);
    const expected = `${c.parent_id ?? c.root}.${segment(c.name)}`;
    if (c.id !== expected) problems.push(`${at}: id must be its name's path, ${expected}`);
    seen.set(c.id, c);
  }
  for (const id of duplicates(good.map((c) => c.id), retired)) problems.push(`id ${id} appears twice (ids are never reused, retired ones included)`);
  if (base !== undefined) {
    const now = new Map(good.map((c) => [c.id, c]));
    for (const before of comparable<Category>(base)) {
      const after = now.get(before.id);
      if (after === undefined) {
        if (broken.has(before.id)) continue;
        if (!retired.includes(before.id)) problems.push(`${before.id} left the data without moving to retired.json`);
        if (before.protected) problems.push(`${before.id} is protected and can't leave`);
        continue;
      }
      for (const field of FROZEN) if (after[field] !== before[field]) problems.push(`${before.id}: ${field} is frozen once published; ship a new id instead`);
      if (before.protected && !isDeepStrictEqual(after, before)) problems.push(`${before.id} is protected and can't change`);
    }
  }
  for (const id of unretired(retired, baseRetired)) problems.push(`${id} left retired.json; a retired id stays retired, so it is never reused`);
  return problems;
}

if (import.meta.main) {
  const categories = readJson<Category[]>(join(import.meta.dirname, "categories.json"));
  const retired = readJson<string[]>(join(import.meta.dirname, "retired.json"));
  report("categories", categories.length, checkCategories(categories, retired, readBase<Category[]>(process.argv), readBase<string[]>(process.argv, "--base-retired")));
}
