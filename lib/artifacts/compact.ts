// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

interface Piece {
  kind: "prelude" | "body";
  text: string;
}

function pieces(css: string): Piece[] {
  const out: Piece[] = [];
  let start = 0;
  let quote = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (quote !== "") {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "\\") i++;
    else if (ch === "}") {
      out.push({ kind: "body", text: css.slice(start, i) }, { kind: "body", text: ch });
      start = i + 1;
    } else if (ch === "{") {
      const text = css.slice(start, i);
      const cut = text.lastIndexOf(";") + 1;
      if (cut > 0) out.push({ kind: "body", text: text.slice(0, cut) });
      out.push({ kind: "prelude", text: text.slice(cut) }, { kind: "body", text: ch });
      start = i + 1;
    }
  }
  out.push({ kind: "body", text: css.slice(start) });
  return out;
}

function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "\\") i++;
    else if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i + 1;
  }
  throw new Error("compact: unbalanced braces in the style");
}

function dropBlocks(css: string, prelude: string, keep: (block: string) => boolean): string {
  let out = css;
  for (let at = out.indexOf(`${prelude}{`); at !== -1; at = out.indexOf(`${prelude}{`, at)) {
    const end = blockEnd(out, at + prelude.length);
    if (keep(out.slice(at, end))) at = end;
    else out = out.slice(0, at) + out.slice(end);
  }
  return out;
}

const resetProperties = (css: string): Set<string> => new Set([...css.matchAll(/:where\(\.dark,\s*\.dark \*\)\s*\{([^{}]*)\}/g)].flatMap(([, body]) => [...body!.matchAll(/(--[\w-]+):/g)].map(([, name]) => name!)));

function plainProperties(css: string): string {
  let out = css.replace(/@property --[\w-]+\{[^}]*\}/g, "");
  const layer = "@layer properties{";
  const at = out.indexOf(layer);
  if (at === -1) return out;
  const end = blockEnd(out, at + layer.length - 1);
  const inner = out.slice(at + layer.length, end - 1);
  const supports = /^@supports [^{]+\{([\s\S]*)\}$/.exec(inner);
  if (supports !== null) out = `${out.slice(0, at)}${layer}${supports[1]}}${out.slice(end)}`;
  return out;
}

const escapeClass = (name: string): string => name.replace(/[^\w-]/g, (ch) => `\\${ch}`);
const CLASS_IN_SELECTOR = /\.((?:\\.|[\w-])+)/g;
const unescape = (text: string): string => text.replace(/\\(.)/g, "$1");

function* shortNames(taken: ReadonlySet<string>): Generator<string> {
  for (let n = 0; ; n++) {
    let name = "";
    for (let k = n; ; k = Math.floor(k / 26) - 1) {
      name = String.fromCharCode(97 + (k % 26)) + name;
      if (k < 26) break;
    }
    if (!taken.has(name)) yield name;
  }
}

function scriptStrings(script: string): { start: number; end: number; after: boolean; before: boolean }[] {
  const found: { start: number; end: number; after: boolean; before: boolean }[] = [];
  const templates: number[] = [];
  for (let i = 0; i < script.length; i++) {
    const ch = script[i]!;
    if (ch === '"' || ch === "'" || (ch === "`" && templates.at(-1) !== -1)) {
      const start = i + 1;
      for (i = start; i < script.length && script[i] !== ch; i++) {
        if (script[i] === "\\") i++;
        else if (ch === "`" && script[i] === "$" && script[i + 1] === "{") break;
      }
      found.push({ start, end: i, after: false, before: ch === "`" && script[i] === "$" });
      if (ch === "`" && script[i] === "$") {
        templates.push(0);
        i++;
      }
    } else if (ch === "/" && /[(,=:[!&|?{};]\s*$/.test(script.slice(Math.max(0, i - 8), i)) && script[i + 1] !== "/" && script[i + 1] !== "*") {
      let inSet = false;
      for (i++; i < script.length; i++) {
        if (script[i] === "\\") i++;
        else if (script[i] === "[") inSet = true;
        else if (script[i] === "]") inSet = false;
        else if (script[i] === "/" && !inSet) break;
      }
    } else if (templates.length > 0 && ch === "{") templates[templates.length - 1]!++;
    else if (templates.length > 0 && ch === "}") {
      if (templates.at(-1)! > 0) templates[templates.length - 1]!--;
      else {
        templates.pop();
        const start = i + 1;
        for (i = start; i < script.length && script[i] !== "`"; i++) {
          if (script[i] === "\\") i++;
          else if (script[i] === "$" && script[i + 1] === "{") break;
        }
        found.push({ start, end: i, after: true, before: script[i] === "$" });
        if (script[i] === "$") {
          templates.push(0);
          i++;
        }
      }
    }
  }
  return found;
}

const PLAIN_WORD = /^[a-z]+$/;

const COMMENT_MARK = /\u0001(\d+)\u0001/g;

export function compact(style: string, markup: string, script: string): { style: string; markup: string; script: string } {
  const comments: string[] = [];
  const bare = style.replace(/\/\*[\s\S]*?\*\//g, (comment) => `\u0001${comments.push(comment) - 1}\u0001`);
  const reset = resetProperties(bare);
  const varies = (block: string): boolean => /currentcolor/i.test(block) || [...reset].some((name) => block.includes(`var(${name})`));
  let css = plainProperties(dropBlocks(bare, "@supports (color:color-mix(in lab, red, red))", varies));

  const parts = pieces(css);
  const classes = new Set<string>();
  for (const part of parts) if (part.kind === "prelude" && !part.text.trimStart().startsWith("@")) for (const [, name] of part.text.matchAll(CLASS_IN_SELECTOR)) classes.add(unescape(name!));

  const strings = scriptStrings(script).map(({ start, end, after, before }) => ({ start, end, after, before, words: script.slice(start, end).split(/(\s+)/) }));
  const kept = new Set<string>();
  const lists = strings.filter(({ words, after, before }) => {
    const named = words.filter((word, i) => i % 2 === 0 && word !== "");
    const edged = (after && words[0] !== "") || (before && words.at(-1) !== "");
    const isList = !edged && named.length > 0 && named.every((word) => classes.has(word)) && !(named.length === 1 && PLAIN_WORD.test(named[0]!) && words.length === 1);
    if (!isList) for (const word of [...named, ...words.join(" ").split(/[\s"'`=<>]+/)]) if (classes.has(word)) kept.add(word);
    return isList;
  });
  const taken = new Set([...kept, ...classes]);
  const names = shortNames(taken);
  const renamed = new Map([...classes].filter((name) => !kept.has(name)).map((name) => [name, names.next().value!]));
  const rename = (word: string): string => renamed.get(word) ?? word;

  css = parts
    .map((part) => (part.kind === "prelude" && !part.text.trimStart().startsWith("@") ? part.text.replace(CLASS_IN_SELECTOR, (all, name: string) => (renamed.has(unescape(name)) ? `.${escapeClass(renamed.get(unescape(name))!)}` : all)) : part.text))
    .join("");
  let out = "";
  let at = 0;
  for (const { start, end, words } of lists) {
    out += script.slice(at, start) + words.map((word, i) => (i % 2 === 0 ? rename(word) : " ")).join("");
    at = end;
  }
  const shipped = out + script.slice(at);
  for (const { start, end } of strings)
    for (const [, name] of script.slice(start, end).matchAll(/(?:^|[\s,>+~(])\.([A-Za-z][\w-]*)/g))
      if (renamed.has(name!)) throw new Error(`compact: the script selects by the class .${name}; select by a data attribute instead`);
  const page = markup.replace(/(\sclass=)(?:"([^"]*)"|'([^']*)')/g, (_all, at: string, double?: string, single?: string) => `${at}"${(double ?? single ?? "").trim().split(/\s+/).map(rename).join(" ")}"`);

  const properties = new Set([...css.matchAll(/--[\w-]+/g)].map(([name]) => name));
  const named = new Set([...shipped.matchAll(/--[\w-]+/g), ...page.matchAll(/--[\w-]+/g)].map(([name]) => name));
  const short = shortNames(new Set([...named].map((name) => name.slice(2))));
  const renamedProperties = new Map([...properties].filter((name) => !named.has(name)).map((name) => [name, `--${short.next().value!}`]));
  css = css.replace(/--[\w-]+/g, (name) => renamedProperties.get(name) ?? name).replace(COMMENT_MARK, (_all, at: string) => comments[Number(at)]!);

  return { style: css, markup: page, script: shipped };
}
