// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { patternProblems } from "./pattern.ts";
import { isObject, type Schema, schemaKeywordProblems, schemaProblems } from "./schema.ts";

export interface Format {
  problems: string[];
  inFormat: boolean[];
}

export const entryLabel = (i: number, entry: unknown): string => `entry ${i} (${isObject(entry) && typeof entry.id === "string" ? entry.id : "no id"})`;

function entriesFormat(data: unknown, schema: Schema, more: (entry: Record<string, unknown>) => string[] = () => []): Format {
  const refused = schemaKeywordProblems(schema);
  if (!isObject(schema.items)) refused.push("the schema needs items: the schema of one entry");
  if (refused.length > 0) return { problems: refused, inFormat: [] };
  const { items, ...file } = schema;
  const problems = schemaProblems(data, file, "file");
  if (!Array.isArray(data)) return { problems, inFormat: [] };
  const inFormat = data.map((entry, i) => {
    const found = schemaProblems(entry, items as Schema);
    if (found.length === 0) found.push(...more(entry as Record<string, unknown>));
    for (const problem of found) problems.push(`${entryLabel(i, entry)}: ${problem}`);
    return found.length === 0;
  });
  return { problems, inFormat };
}

export function categoriesFormat(categories: unknown, schema: Schema): Format {
  return entriesFormat(categories, schema);
}

export function rulesFormat(rules: unknown, schema: Schema): Format {
  return entriesFormat(rules, schema, (rule) => {
    const match = (rule.match ?? {}) as { description?: string; account?: string; direction?: string; account_types?: string[] };
    const set = (rule.set ?? {}) as { category_id?: string; business_category_id?: string };
    const problems = (["description", "account"] as const).flatMap((field) => {
      const pattern = match[field];
      return pattern === undefined ? [] : patternProblems(pattern).map((problem) => `match.${field} ${JSON.stringify(pattern)} ${problem}`);
    });
    if (match.description === undefined && match.account === undefined && (match.direction !== undefined || match.account_types !== undefined)) problems.push("match needs a description or account pattern; a direction or account types only narrow one");
    if (match.account_types !== undefined && new Set(match.account_types).size !== match.account_types.length) problems.push("match.account_types lists a group twice");
    if (set.business_category_id !== undefined && set.category_id?.startsWith("business.")) problems.push("set.category_id must be outside the business root when set.business_category_id is given");
    return problems;
  });
}
