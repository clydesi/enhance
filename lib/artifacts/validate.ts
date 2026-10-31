// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { argPath, type Problems, report, ROOT, textProblems } from "../check.ts";

export interface Artifact {
  file: string;
  text: string;
}

const COMMENT = /^<!--\n([\s\S]*?)-->/;
const FIRST_LINE = /^Clyde artifact: [A-Z][A-Za-z ]*\. Copyright 2026 Clyde Intelligence, LLC\. SPDX-License-Identifier: Apache-2\.0\n/;
const TOOLS_LINE = /^Connector tools: (.+)$/m;
const VERSION_LINE = /^Version: (.*)$/m;
const VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const ALLOWED = /^(?:show_[a-z_]+|edit)$/;
const TOOL_NAMED = /["'`](show_[a-z_]+|edit)["'`]/g;
const WRITE_TOOLS = /["'`](import|manage_access|manage_accounts|manage_sources|update_profile)["'`]/g;
const CALL_TOOL = /\bcallTool\b/g;
const OUTSIDE: readonly [RegExp, string][] = [
  [/\b(?:src|action|poster|srcset|formaction)["']?\s*[:=]\s*[`"']?\s*(?:https?:)?\/\//i, "a remote source"],
  [/@import\b/i, "a CSS import"],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, "a remote CSS url()"],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\s*\(/, "a network request"],
  [/\bimport\s*\(|^\s*import\s+(?:[\w{*][^\n]*\sfrom\s|["'])/m, "a module import"],
  [/<(?:iframe|object|embed|link|base|frame)\b/i, "an embed or link element"],
  [/http-equiv/i, "a meta refresh"],
  [/\bwindow\.open\s*\(|\b(?:Shared)?Worker\s*\(/, "a new window or worker"],
  [/\b(?:eval|Function)\s*\(/, "code built from text"],
];

export function checkArtifact({ file, text }: Artifact): Problems {
  const problems: Problems = [];
  const say = (problem: string) => problems.push(`${file}: ${problem}`);
  for (const problem of textProblems(text)) say(problem);
  if (!/^[a-z][a-z0-9-]*\.html$/.test(file)) say("name must be lowercase words joined by - with .html");
  const comment = COMMENT.exec(text)?.[1] ?? "";
  if (!FIRST_LINE.test(comment)) say("must open with the comment naming it: <!--, then Clyde artifact: Name. and the copyright and license line");
  if (!/<title>[^<]+<\/title>/.test(text.slice(0, 8192))) say("needs a <title> near its top");
  if (/<(?:html|head|body)\b/i.test(text)) say("holds the page's content alone, without html, head, or body tags");
  for (const [pattern, what] of OUTSIDE) if (pattern.test(text)) say(`loads nothing from outside the file, but has ${what}`);

  const version = VERSION_LINE.exec(comment)?.[1];
  if (version === undefined) say("its comment needs a line with its version: Version: 0.1.0");
  else if (!VERSION.test(version)) say(`its version is three whole numbers, major.minor.patch, not ${version}`);
  const named = TOOLS_LINE.exec(comment)?.[1]?.split(",").map((tool) => tool.trim()) ?? [];
  if (named.length === 0) say("its comment needs a line naming the tools it calls: Connector tools: show_...");
  for (const tool of named) if (!ALLOWED.test(tool)) say(`calls only Clyde's show_ views and edit, not ${tool}`);
  const script = text.slice(COMMENT.exec(text)?.[0].length ?? 0);
  const written = new Set([...script.matchAll(TOOL_NAMED)].map((match) => match[1]!));
  for (const tool of written) if (!named.includes(tool)) say(`calls ${tool}, which its comment doesn't name`);
  for (const tool of named) if (!written.has(tool)) say(`names ${tool} but never calls it`);
  for (const [, tool] of script.matchAll(WRITE_TOOLS)) say(`names ${tool}, one of Clyde's tools that change the ledger`);
  if ([...script.matchAll(CALL_TOOL)].length !== 1) say("calls the connector once, in the call every view goes through");
  return problems;
}

export function checkArtifacts(artifacts: readonly Artifact[], others: readonly string[]): Problems {
  return [...others.map((file) => `${file}: artifacts/ holds only .html artifacts and README.md`), ...artifacts.flatMap(checkArtifact)];
}

const versionOf = (text: string): string | undefined => {
  const version = VERSION_LINE.exec(COMMENT.exec(text)?.[1] ?? "")?.[1];
  return version !== undefined && VERSION.test(version) ? version : undefined;
};

const above = (now: string, was: string): boolean => {
  const [a, b] = [now.split(".").map(Number), was.split(".").map(Number)];
  const at = a.findIndex((n, i) => n !== b[i]);
  return at >= 0 && a[at]! > b[at]!;
};

export function checkVersions(artifacts: readonly Artifact[], base: readonly Artifact[]): Problems {
  return artifacts.flatMap(({ file, text }) => {
    const before = base.find((artifact) => artifact.file === file);
    if (before === undefined || before.text === text) return [];
    const [was, now] = [versionOf(before.text), versionOf(text)];
    return was === undefined || now === undefined || above(now, was) ? [] : [`${file}: changed since the base branch, so its version goes above ${was}`];
  });
}

export function loadArtifacts(root: string): { artifacts: Artifact[]; others: string[] } {
  const dir = join(root, "artifacts");
  const files = readdirSync(dir).sort();
  return {
    artifacts: files.filter((file) => file.endsWith(".html")).map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") })),
    others: files.filter((file) => !file.endsWith(".html") && file !== "README.md"),
  };
}

if (import.meta.main) {
  const { artifacts, others } = loadArtifacts(ROOT);
  const baseRoot = argPath(process.argv);
  if (baseRoot !== undefined && !existsSync(join(baseRoot, "artifacts"))) throw new Error(`--base needs a folder holding the base branch's artifacts/, not ${baseRoot}`);
  const base = baseRoot === undefined ? [] : loadArtifacts(baseRoot).artifacts;
  report("artifacts", artifacts.length, [...checkArtifacts(artifacts, others), ...checkVersions(artifacts, base)]);
}
