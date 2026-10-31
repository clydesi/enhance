// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Category } from "../categories/validate.ts";
import { comparable, duplicates, type Problems, readBase, readJson, report, unretired } from "../lib/check.ts";
import { rulesFormat } from "../lib/format/format.ts";
import { matches, PatternError } from "../lib/format/pattern.ts";
import { isObject, type Schema } from "../lib/format/schema.ts";

export interface Rule {
  id: string;
  match?: { description?: string; account?: string; direction?: Direction; account_types?: AccountType[] };
  set?: { payee?: string; category_id?: string; business_category_id?: string };
  samples?: string[];
  protected?: true;
}

export const DIRECTIONS = ["in", "out"] as const;
export const ACCOUNT_TYPES = ["bank", "credit", "investments", "assets", "liability", "business_payments"] as const;
type Direction = (typeof DIRECTIONS)[number];
type AccountType = (typeof ACCOUNT_TYPES)[number];
const OWNERS = ["personal", "business"] as const;
type Owner = (typeof OWNERS)[number];
type Case = [Direction, AccountType | null, Owner];

export const RULE_SCHEMA = readJson<Schema>(join(import.meta.dirname, "schema.json"));

const effect = (rule: Rule): string => JSON.stringify([rule.set?.payee ?? null, rule.set?.category_id ?? null, rule.set?.business_category_id ?? null]);

export function checkRules(rules: Rule[], retired: string[], categories: readonly Pick<Category, "id" | "protected">[], base: Rule[] | undefined, baseRetired?: string[]): Problems {
  const { problems, inFormat } = rulesFormat(rules, RULE_SCHEMA);
  if (!Array.isArray(rules) || inFormat.length !== rules.length) return problems;
  const good = rules.filter((_, i) => inFormat[i]);
  const broken = new Set(rules.filter((r, i) => !inFormat[i] && isObject(r) && typeof r.id === "string").map((r) => r.id));
  const known = new Map(categories.map((c) => [c.id, c.protected === true]));
  const effects = new Map<string, string>();
  for (const [i, rule] of rules.entries()) {
    if (!inFormat[i]) continue;
    const at = `entry ${i} (${rule.id})`;
    if (rule.match === undefined && rule.set === undefined) {
      if (!rule.protected) problems.push(`${at}: a rule with no match and no set must be protected`);
      if (rule.samples !== undefined) problems.push(`${at}: a rule with no match has no samples`);
      continue;
    }
    if (rule.match === undefined) problems.push(`${at}: needs a description or account pattern`);
    if (rule.set === undefined) problems.push(`${at}: needs a payee, a category, or a business category`);
    const set = rule.set ?? {};
    for (const id of [set.category_id, set.business_category_id]) {
      if (id === undefined) continue;
      if (!known.has(id)) problems.push(`${at}: category ${id} is not in categories.json`);
      else if (known.get(id)) problems.push(`${at}: category ${id} is protected, so no rule sets it`);
    }
    const key = effect(rule);
    const twin = effects.get(key);
    if (twin !== undefined) problems.push(`${at}: sets exactly what ${twin} sets (no two rules share an effect)`);
    effects.set(key, rule.id);
    if (rule.samples === undefined) {
      problems.push(`${at}: needs at least one sample statement text`);
      continue;
    }
    const above = rules.slice(0, i).filter((other, j) => inFormat[j] && other.match?.description !== undefined);
    for (const sample of rule.samples) {
      if (!hits(rule, sample)) {
        problems.push(`${at}: doesn't match its own sample "${sample}"`);
        continue;
      }
      for (const field of FIELDS) {
        if (!sets(rule, field)) continue;
        const own = cases(rule, field);
        const takers = above.filter((other) => sets(other, field) && hits(other, sample) && own.some((c) => covers(other, c, field)));
        if (!own.every((c) => takers.some((other) => covers(other, c, field)))) continue;
        problems.push(`${at}: sample "${sample}" is taken for ${fieldName(rule, field)} by ${LIST.format(takers.map((t) => t.id))}, above it`);
      }
    }
  }
  for (const id of duplicates(good.map((r) => r.id), retired)) problems.push(`id ${id} appears twice (ids are never reused, retired ones included)`);
  if (base !== undefined) {
    const now = new Map(good.map((r) => [r.id, r]));
    for (const before of comparable<Rule>(base)) {
      const after = now.get(before.id);
      if (after === undefined) {
        if (broken.has(before.id)) continue;
        if (!retired.includes(before.id)) problems.push(`${before.id} left the data without moving to retired.json`);
        if (before.protected) problems.push(`${before.id} is protected and can't leave`);
        continue;
      }
      if (after.set?.category_id !== before.set?.category_id || after.set?.business_category_id !== before.set?.business_category_id) problems.push(`${before.id}: a rule's category is fixed once published; ship a new id instead`);
      if (before.protected && !isDeepStrictEqual(after, before)) problems.push(`${before.id} is protected and can't change`);
    }
  }
  for (const id of unretired(retired, baseRetired)) problems.push(`${id} left retired.json; a retired id stays retired, so it is never reused`);
  return problems;
}

const LIST = new Intl.ListFormat("en", { type: "conjunction" });

const FIELDS = ["payee", "category"] as const;
type Field = (typeof FIELDS)[number];

const fieldName = (rule: Rule, field: Field): string => (field === "payee" ? "payee" : rule.set?.category_id === undefined ? "business_category_id" : "category_id");

const sets = (rule: Rule, field: Field): boolean => (field === "payee" ? rule.set?.payee !== undefined : rule.set?.category_id !== undefined || rule.set?.business_category_id !== undefined);

function owners(rule: Rule, field: Field): readonly Owner[] {
  const { category_id, business_category_id } = rule.set ?? {};
  if (category_id === undefined) return business_category_id === undefined ? OWNERS : ["business"];
  return field === "category" && business_category_id === undefined && category_id.startsWith("personal.") ? ["personal"] : OWNERS;
}

function cases(rule: Rule, field: Field): Case[] {
  const directions = rule.match?.direction === undefined ? DIRECTIONS : [rule.match.direction];
  const groups = rule.match?.account_types ?? [...ACCOUNT_TYPES, null];
  return directions.flatMap((direction) => groups.flatMap((group) => owners(rule, field).map((owner): Case => [direction, group, owner])));
}

function covers(rule: Rule, [direction, group, owner]: Case, field: Field): boolean {
  const { direction: only, account_types: groups } = rule.match ?? {};
  return (only === undefined || only === direction) && (groups === undefined || (group !== null && groups.includes(group))) && owners(rule, field).includes(owner);
}

function hits(rule: Rule, text: string): boolean {
  try {
    return matches(rule.match?.description, text);
  } catch (err) {
    if (err instanceof PatternError) return false;
    throw err;
  }
}

if (import.meta.main) {
  const rules = readJson<Rule[]>(join(import.meta.dirname, "rules.json"));
  const retired = readJson<string[]>(join(import.meta.dirname, "retired.json"));
  const categories = readJson<Category[]>(join(import.meta.dirname, "..", "categories", "categories.json"));
  report("rules", rules.length, checkRules(rules, retired, categories, readBase<Rule[]>(process.argv), readBase<string[]>(process.argv, "--base-retired")));
}
