// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { comments, ROOT, textProblems } from "../lib/check.ts";

const HEADER = "// Copyright 2026 Clyde Intelligence, LLC\n// SPDX-License-Identifier: Apache-2.0\n\n";
const HEADER_LINES = HEADER.trim().split("\n");
const CODE = /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx|css)$/;

function filesNamed(named: (name: string) => boolean): string[] {
  return readdirSync(ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && named(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split("/").some((part) => part === "node_modules" || part === ".git" || part === ".worktrees" || part === ".claude"))
    .sort();
}

const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");
const typescriptFiles = (): string[] => filesNamed((name) => name.endsWith(".ts"));

test("every TypeScript file starts with the copyright and license header", () => {
  const files = typescriptFiles();
  assert.ok(files.includes("lib/format/format.ts") && files.includes("test/files.test.ts"), files.join("\n"));
  assert.deepEqual(
    files.filter((file) => !read(file).startsWith(HEADER)),
    [],
  );
});

test("lib/format/ imports only its own files, since Clyde copies that folder alone", () => {
  const format = typescriptFiles().filter((file) => file.startsWith("lib/format/"));
  assert.deepEqual(format, ["lib/format/format.ts", "lib/format/pattern.ts", "lib/format/schema.ts"]);
  const outside = format.flatMap((file) =>
    [...read(file).matchAll(/^import\b[^;]*?from\s+"([^"]+)"/gm)]
      .map((match) => match[1]!)
      .filter((path) => !/^\.\/[a-z-]+\.ts$/.test(path))
      .map((path) => `${file} imports ${path}`),
  );
  assert.deepEqual(outside, []);
});

test("every text file is plain ASCII and ends with a newline", () => {
  const files = filesNamed((name) => !name.endsWith(".png"));
  assert.ok(files.includes("README.md") && files.includes(".github/workflows/ci.yml") && files.includes("src/brand/logo.svg"), files.join("\n"));
  assert.deepEqual(
    files.flatMap((file) => textProblems(read(file)).map((problem) => `${file}: ${problem}`)),
    [],
  );
});

test("code has no comments but its license header", () => {
  const files = filesNamed((name) => CODE.test(name));
  assert.ok(files.includes("src/artifacts/index.css") && files.includes("test/files.test.ts"), files.join("\n"));
  const found = files.flatMap((file) =>
    comments(read(file), file.endsWith(".css"))
      .filter((comment) => !HEADER_LINES.includes(comment))
      .map((comment) => `${file}: ${comment.slice(0, 80)}`),
  );
  assert.deepEqual(found, []);
});

const PINNED_RELEASE = / uses: \S+@[0-9a-f]{40} # v\d+(\.\d+)*$/;
const yamlComment = (line: string): boolean => !PINNED_RELEASE.test(line) && /(^|\s)#/.test(line.replace(/"(\\.|[^"\\])*"|'[^']*'/g, '""'));

test("config has no comments but a pinned action's release, and markup only an artifact shell's opening one", () => {
  const configs = filesNamed((name) => /^tsconfig.*\.json$/.test(name) || /\.ya?ml$/.test(name) || name === "CODEOWNERS" || name === ".gitignore");
  assert.ok(configs.includes(".github/workflows/ci.yml") && configs.includes(".github/CODEOWNERS") && configs.includes("tsconfig.json"), configs.join("\n"));
  const found = configs.flatMap((file) =>
    file.endsWith(".json")
      ? comments(read(file)).map((comment) => `${file}: ${comment}`)
      : read(file)
          .split("\n")
          .filter(yamlComment)
          .map((line) => `${file}: ${line.trim()}`),
  );
  assert.deepEqual(found, []);
  const markup = filesNamed((name) => name.endsWith(".svg") || name.endsWith(".html")).filter((file) => !file.startsWith("artifacts/"));
  assert.ok(markup.includes("src/artifacts/dashboard.html") && markup.includes("src/brand/logo.svg"), markup.join("\n"));
  for (const file of markup) {
    const opened = read(file).split("<!--").length - 1;
    const shell = file.startsWith("src/artifacts/") && file.endsWith(".html");
    assert.ok(shell ? opened === 1 && read(file).startsWith("<!--") : opened === 0, file);
  }
});

test("comments are found in code, not in its strings, regular expressions, or templates", () => {
  const code = 'const u = "http://x/*y*/"; const r = /\\/\\/[/]/g; const t = `a ${b /* c */} // d ${`e ${f}`}`; x = y / 2; // g\n';
  assert.deepEqual(comments(code), ["/* c */", "// g"]);
  assert.deepEqual(comments('const a = i++ / 2; const u = "a/b"; const w = "http://x"; // h\n'), ["// h"]);
  assert.deepEqual(comments('const a = total! / 2; const u = "http://x"; // i\nconst b = !/x/.test(u); // j\n'), ["// i", "// j"]);
  assert.deepEqual(comments('a { content: "/* no */"; } /* yes */\n', true), ["/* yes */"]);
  assert.deepEqual(comments("a { background: url(it's.png) } /* y */ b { content: 'q' } /* z */\n", true), ["/* y */", "/* z */"]);
  assert.deepEqual(comments('a { content: "open\n} /* w */\n', true), ["/* w */"]);
  assert.equal(yamlComment('      run: gh pr comment --body "see #12"'), false);
  assert.equal(yamlComment("      - run: npm test # quick"), true);
  assert.equal(yamlComment("      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1"), false);
});
