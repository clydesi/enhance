// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export const MAX_PATTERN = 200;

interface Alternative {
  pieces: string[];
  start: boolean;
  end: boolean;
}

export class PatternError extends Error {}

export function compilePattern(pattern: string): Alternative[] {
  if (pattern.trim() === "" || pattern.length > MAX_PATTERN) throw new PatternError(`pattern refused: ${pattern}`);
  return splitAlternatives(pattern).map((source) => parseAlternative(pattern, source));
}

export const MAX_LIKE_PATTERN = 50;

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export function likePatterns(pattern: string): string[] {
  return compilePattern(pattern).map(({ pieces, start, end }) => `${start ? "" : "%"}${pieces.map(escapeLike).join("%")}${end ? "" : "%"}`);
}

export function patternProblems(pattern: string): string[] {
  try {
    return likePatterns(pattern)
      .filter((like) => like.length > MAX_LIKE_PATTERN)
      .map((like) => `has an alternative over ${MAX_LIKE_PATTERN} bytes as Clyde matches it in its database (${like})`);
  } catch (err) {
    if (err instanceof PatternError) return ["is not a pattern the rules take (CONTRIBUTING.md, Patterns)"];
    throw err;
  }
}

export function matches(pattern: string | undefined, text: string): boolean {
  if (pattern === undefined) return true;
  const upper = text.toUpperCase();
  return compilePattern(pattern).some((alternative) => matchesAlternative(alternative, upper));
}

function splitAlternatives(pattern: string): string[] {
  const sources: string[] = [];
  let current = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "|") {
      sources.push(current);
      current = "";
    } else if (c === "\\" && i + 1 < pattern.length) current += c + pattern[++i];
    else current += c;
  }
  sources.push(current);
  if (sources.some((source) => source.trim() === "")) throw new PatternError(`pattern refused: ${pattern}`);
  return sources;
}

function parseAlternative(pattern: string, source: string): Alternative {
  const refused = () => new PatternError(`pattern refused: ${pattern}`);
  const pieces: string[] = [];
  let piece = "";
  let start = false;
  let end = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") {
      const next = source[++i];
      if (next === undefined || !"*|^$\\".includes(next)) throw refused();
      piece += next;
    } else if (c === "*") {
      pieces.push(piece.toUpperCase());
      piece = "";
    } else if (c === "^") {
      if (i !== 0) throw refused();
      start = true;
    } else if (c === "$") {
      if (i !== source.length - 1) throw refused();
      end = true;
    } else piece += c;
  }
  pieces.push(piece.toUpperCase());
  if (pieces.every((p) => p === "")) throw refused();
  return { pieces, start, end };
}

function matchesAlternative({ pieces, start, end }: Alternative, text: string): boolean {
  const last = pieces.length - 1;
  let at = 0;
  for (let i = 0; i <= last; i++) {
    const piece = pieces[i]!;
    if (i === last && end) {
      if (i === 0 && start) return text === piece;
      return text.length - piece.length >= at && text.endsWith(piece);
    }
    if (i === 0 && start) {
      if (!text.startsWith(piece)) return false;
      at = piece.length;
    } else {
      const found = text.indexOf(piece, at);
      if (found < 0) return false;
      at = found + piece.length;
    }
  }
  return true;
}
