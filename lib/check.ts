// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isObject } from "./format/schema.ts";

export type Problems = string[];

export const ROOT = join(import.meta.dirname, "..");

export function comparable<T extends { id: string }>(base: unknown): T[] {
  return Array.isArray(base) ? base.filter((entry): entry is T => isObject(entry) && typeof entry.id === "string") : [];
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function argPath(argv: readonly string[], flag: "--base" | "--base-retired" = "--base"): string | undefined {
  const at = argv.indexOf(flag);
  if (at < 0) return undefined;
  const path = argv[at + 1];
  if (path === undefined) throw new Error(`${flag} needs a path`);
  return path;
}

export function readBase<T>(argv: readonly string[], flag: "--base" | "--base-retired" = "--base"): T | undefined {
  const path = argPath(argv, flag);
  if (path === undefined) return undefined;
  const text = readFileSync(path, "utf8").trim();
  return text === "" ? undefined : (JSON.parse(text) as T);
}

export function unretired(retired: readonly string[], baseRetired: unknown): string[] {
  return Array.isArray(baseRetired) ? baseRetired.filter((id): id is string => typeof id === "string" && !retired.includes(id)) : [];
}

export function report(kind: string, count: number, problems: Problems): void {
  if (problems.length > 0) {
    for (const problem of problems) console.error(`${kind}: ${problem}`);
    process.exit(1);
  }
  console.log(`${kind}: ok, ${count} entries`);
}

export function duplicates(...lists: readonly string[][]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of lists.flat()) (seen.has(id) ? twice : seen).add(id);
  return [...twice];
}

export function textProblems(text: string): Problems {
  const problems: Problems = [];
  const odd = [...new Set([...text].filter((c) => c !== "\n" && (c < " " || c > "~")))];
  if (odd.length > 0) problems.push(`has characters outside plain ASCII: ${odd.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(", ")}`);
  if (!text.endsWith("\n")) problems.push("doesn't end with a newline");
  return problems;
}

const REGEX_AFTER = new Set([..."(,=:[!&|?{};+-*%<>~^}", "return", "typeof", "case", "do", "else", "in", "of", "void", "delete", "throw", "new", "instanceof", "yield", "await"]);

export function comments(text: string, css = false): string[] {
  const found: string[] = [];
  const depths: number[] = [];
  let depth = 0;
  let last = "";
  let i = 0;
  const quoted = (quote: string): void => {
    for (i++; i < text.length && text[i] !== quote && !(css && text[i] === "\n"); i++) if (text[i] === "\\") i++;
    i++;
  };
  const template = (): void => {
    while (i < text.length) {
      if (text[i] === "\\") i += 2;
      else if (text[i] === "`") {
        i++;
        return;
      } else if (text[i] === "$" && text[i + 1] === "{") {
        i += 2;
        depths.push(depth);
        depth = 0;
        last = "{";
        return;
      } else i++;
    }
  };
  while (i < text.length) {
    const c = text[i]!;
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      found.push(text.slice(i, stop));
      i = stop;
    } else if (css) {
      if (c === '"' || c === "'") quoted(c);
      else if (/^url\(\s*[^\s"')]/i.test(text.slice(i, i + 6)) && !/[\w-]/.test(text[i - 1] ?? "")) {
        const end = text.indexOf(")", i);
        i = end < 0 ? text.length : end + 1;
      } else i++;
    } else if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end < 0 ? text.length : end;
      found.push(text.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'") {
      quoted(c);
      last = "text";
    } else if (c === "`") {
      i++;
      template();
      last = "text";
    } else if (c === "/" && (last === "" || REGEX_AFTER.has(last))) {
      let inClass = false;
      for (i++; i < text.length && (inClass || text[i] !== "/") && text[i] !== "\n"; i++) {
        if (text[i] === "\\") i++;
        else if (text[i] === "[") inClass = true;
        else if (text[i] === "]") inClass = false;
      }
      for (i++; /[a-z]/i.test(text[i] ?? ""); i++);
      last = "regex";
    } else if (/\s/.test(c)) i++;
    else if (/[\w$]/.test(c)) {
      const start = i;
      while (i < text.length && /[\w$]/.test(text[i]!)) i++;
      last = text.slice(start, i);
    } else if ((c === "+" || c === "-") && text[i + 1] === c) {
      i += 2;
      last = "operand";
    } else if (c === "!" && /[\w$)\]]/.test(text[i - 1] ?? "")) {
      i++;
      last = "operand";
    } else if (c === "}" && depth === 0 && depths.length > 0) {
      depth = depths.pop()!;
      i++;
      template();
      last = "text";
    } else {
      if (c === "{") depth++;
      if (c === "}") depth--;
      last = c;
      i++;
    }
  }
  return found;
}

export function unknownKeys(entry: object, allowed: readonly string[]): string[] {
  return Object.keys(entry).filter((key) => !allowed.includes(key));
}
