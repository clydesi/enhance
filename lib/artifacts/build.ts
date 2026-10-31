// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { ROOT } from "../check.ts";
import { compact } from "./compact.ts";

const TOOLS = /^Connector tools: (.+)$/m;
const ascii = (text: string): string => text.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const cssAscii = (text: string): string => text.replace(/[^\x00-\x7f]/gu, (c) => `\\${c.codePointAt(0)!.toString(16)} `);

function brand(root: string, name: "logo" | "icon"): string {
  const svg = readFileSync(join(root, "src", "brand", `${name}.svg`), "utf8").trim();
  const named = name === "logo" ? 'role="img" aria-label="Clyde"' : 'aria-hidden="true"';
  return svg.replace(/<style>.*?<\/style>/s, "").replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", `<svg ${named} `);
}

export async function buildArtifact(root: string, name: string): Promise<string> {
  const src = join(root, "src", "artifacts");
  const shell = readFileSync(join(src, `${name}.html`), "utf8");
  const tools = (TOOLS.exec(shell)?.[1] ?? "").split(",").map((tool) => tool.trim()).filter((tool) => tool !== "");
  if (tools.length === 0) throw new Error(`src/artifacts/${name}.html: its comment needs a Connector tools: line`);
  const bundled = await esbuild.build({
    entryPoints: [join(src, "views", `${name}.ts`)],
    bundle: true,
    format: "iife",
    target: "es2022",
    minify: true,
    write: false,
    legalComments: "none",
    logLevel: "silent",
    define: { TOOLS: JSON.stringify(tools) },
  });
  const script = bundled.outputFiles[0]!.text.trim();

  const work = join(root, "node_modules", ".cache", "artifacts", name);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "script.js"), script);
  writeFileSync(join(work, "shell.html"), shell);
  writeFileSync(join(work, "index.css"), readFileSync(join(src, "index.css"), "utf8"));
  const style = execFileSync(join(root, "node_modules", ".bin", "tailwindcss"), ["-i", join(work, "index.css"), "--minify"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  rmSync(work, { recursive: true, force: true });

  const end = shell.indexOf("-->\n") + "-->\n".length;
  const titleEnd = shell.indexOf("\n", shell.indexOf("</title>")) + 1;
  const all = JSON.parse(readFileSync(join(src, "words.json"), "utf8")) as Record<string, string>;
  const words = JSON.stringify(Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith("column") || script.includes(`"${key}"`))));
  const compacted = compact(
    style,
    shell
      .slice(titleEnd)
      .replace("__LOGO__", () => brand(root, "logo"))
      .replace("__ICON__", () => brand(root, "icon"))
      .replace(/\n+$/, ""),
    script,
  );
  await esbuild.transform(compacted.script, { loader: "js", logLevel: "silent" });
  const { markup } = compacted;
  return [
    shell.slice(0, end).replace(/\n$/, ""),
    shell.slice(end, titleEnd).replace(/\n$/, ""),
    `<style>${cssAscii(compacted.style)}</style>`,
    markup,
    `<script type="application/json" id="words">${ascii(words).replace(/</g, "\\u003c")}</script>`,
    `<script>${ascii(compacted.script).replace(/<\/script/gi, "<\\/script")}</script>`,
    "",
  ].join("\n");
}

export const viewNames = (root: string): string[] =>
  readdirSync(join(root, "src", "artifacts"))
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();

export async function buildAll(root: string): Promise<Map<string, string>> {
  const built = new Map<string, string>();
  for (const name of viewNames(root)) built.set(`${name}.html`, await buildArtifact(root, name));
  return built;
}

export function staleArtifacts(root: string, built: ReadonlyMap<string, string>): string[] {
  const dir = join(root, "artifacts");
  const present = new Set(readdirSync(dir).filter((file) => file.endsWith(".html")));
  return [
    ...[...built].filter(([file, text]) => !present.has(file) || readFileSync(join(dir, file), "utf8") !== text).map(([file]) => `artifacts/${file}: differs from what src/artifacts/ builds; run npm run build`),
    ...[...present].filter((file) => !built.has(file)).map((file) => `artifacts/${file}: has no source in src/artifacts/`),
  ];
}

if (import.meta.main) {
  const built = await buildAll(ROOT);
  if (process.argv.includes("--check")) {
    const stale = staleArtifacts(ROOT, built);
    for (const problem of stale) console.error(`artifacts: ${problem}`);
    if (stale.length > 0) process.exit(1);
    console.log(`artifacts: built files match their source, ${built.size} entries`);
  } else {
    for (const [file, text] of built) writeFileSync(join(ROOT, "artifacts", file), text);
    console.log(`artifacts: built ${built.size}`);
  }
}
