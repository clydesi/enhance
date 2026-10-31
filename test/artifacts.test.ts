// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildAll, staleArtifacts } from "../lib/artifacts/build.ts";
import { ROOT, textProblems } from "../lib/check.ts";
import { type Artifact, checkArtifact, checkArtifacts, checkVersions, loadArtifacts } from "../lib/artifacts/validate.ts";

const { artifacts, others } = loadArtifacts(ROOT);

const page = (script: string, tools = "show_accounts", version = "0.1.0"): Artifact => ({
  file: "example.html",
  text: `<!--\nClyde artifact: Example. Copyright 2026 Clyde Intelligence, LLC. SPDX-License-Identifier: Apache-2.0\nVersion: ${version}\nConnector tools: ${tools}\n-->\n<title>Example</title>\n<script>\nconst read=(t,i)=>mcp.callTool(server,t,i);\n${script}\n</script>\n`,
});

test("the repo's artifacts pass", () => {
  assert.ok(artifacts.length >= 1, artifacts.map((a) => a.file).join(", "));
  assert.deepEqual(checkArtifacts(artifacts, others), []);
});

test("every built artifact is what its source builds to", async () => {
  assert.deepEqual(staleArtifacts(ROOT, await buildAll(ROOT)), []);
});

test("every source file is plain ASCII and ends with a newline", () => {
  const src = join(ROOT, "src", "artifacts");
  const files = readdirSync(src, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  assert.ok(files.length > 0);
  assert.deepEqual(
    files.flatMap((entry) => textProblems(readFileSync(join(entry.parentPath, entry.name), "utf8")).map((problem) => `${entry.name}: ${problem}`)),
    [],
  );
});

test("a small artifact passes", () => {
  assert.deepEqual(checkArtifact(page('read("show_accounts",{});')), []);
});

test("an artifact loads nothing from outside the file", () => {
  const remote = page('read("show_accounts",{});');
  remote.text = remote.text.replace("<title>", '<script src="https://cdn.example.com/lib.js"></script>\n<title>');
  assert.match(checkArtifact(remote).join("\n"), /a remote source/);
  assert.match(checkArtifact(page('read("show_accounts",{});fetch("/x");')).join("\n"), /a network request/);
  const font = page('read("show_accounts",{});');
  font.text = font.text.replace("<title>", '<style>@import url("//fonts.example.com/a.css");</style>\n<title>');
  assert.match(checkArtifact(font).join("\n"), /a CSS import/);
  assert.match(checkArtifact(page('read("show_accounts",{});el("img",{src:"https://example.com/x.png"});')).join("\n"), /a remote source/);
  const refresh = page('read("show_accounts",{});');
  refresh.text = refresh.text.replace("<title>", '<meta http-equiv="refresh" content="0;url=https://example.com">\n<title>');
  assert.match(checkArtifact(refresh).join("\n"), /a meta refresh/);
  assert.match(checkArtifact(page('read("show_accounts",{});window.open("https://example.com");')).join("\n"), /a new window or worker/);
});

test("a link to another page and a comment that says import are let through", () => {
  const linked = page('read("show_accounts",{});\n// import a file through the chat');
  linked.text = linked.text.replace("<title>", '<a href="https://example.com/help">Help</a>\n<title>');
  assert.deepEqual(checkArtifact(linked), []);
});

test("an artifact names only the read views and edit its comment names", () => {
  assert.match(checkArtifact(page('read("show_accounts",{});read("show_spending",{});')).join("\n"), /calls show_spending, which its comment doesn't name/);
  assert.match(checkArtifact(page('read("import",{});', "import")).join("\n"), /calls only Clyde's show_ views and edit, not import/);
  assert.match(checkArtifact(page("", "show_accounts")).join("\n"), /names show_accounts but never calls it/);
  assert.match(checkArtifact(page('read("show_accounts",{});read(\'edit\',{});')).join("\n"), /calls edit, which its comment doesn't name/);
  assert.deepEqual(checkArtifact(page('read("show_accounts",{});write("edit",{});', "show_accounts, edit")), []);
  assert.match(checkArtifact(page('read("show_accounts",{});read(\'manage_accounts\',{});')).join("\n"), /names manage_accounts, one of Clyde's tools that change the ledger/);
  assert.match(checkArtifact(page('read("show_accounts",{});mcp.callTool(server,"x",{});')).join("\n"), /calls the connector once/);
});

test("an artifact opens with its comment and is plain ASCII", () => {
  const bare = page('read("show_accounts",{});');
  bare.text = bare.text.replace("Clyde artifact: Example.", "Example.");
  assert.match(checkArtifact(bare).join("\n"), /must open with the comment/);
  assert.match(checkArtifact(page('read("show_accounts",{});const dash="\u2014";')).join("\n"), /outside plain ASCII: U\+2014/);
  assert.match(checkArtifact({ ...page('read("show_accounts",{});'), file: "My Page.html" }).join("\n"), /lowercase words/);
});

test("an artifact's comment carries its version, major.minor.patch", () => {
  const bare = page('read("show_accounts",{});');
  bare.text = bare.text.replace("Version: 0.1.0\n", "");
  assert.match(checkArtifact(bare).join("\n"), /needs a line with its version/);
  for (const version of ["1", "0.1", "01.0.0", "1.0.0-beta", "v1.0.0", "1.2.3.4", ""]) assert.match(checkArtifact(page('read("show_accounts",{});', "show_accounts", version)).join("\n"), /its version is three whole numbers/, version);
  assert.deepEqual(checkArtifact(page('read("show_accounts",{});', "show_accounts", "12.0.3")), []);
});

test("an artifact that changed since the base branch has a higher version", () => {
  const at = (version: string, script = 'read("show_accounts",{});'): Artifact => page(script, "show_accounts", version);
  const was = at("0.1.9");
  assert.deepEqual(checkVersions([was], [was]), []);
  assert.deepEqual(checkVersions([at("0.1.9", 'read("show_accounts",{x:1});')], [was]), ["example.html: changed since the base branch, so its version goes above 0.1.9"]);
  assert.equal(checkVersions([at("0.1.8", 'read("show_accounts",{x:1});')], [was]).length, 1);
  for (const now of ["0.1.10", "0.2.0", "1.0.0"]) assert.deepEqual(checkVersions([at(now)], [was]), [], now);
  const unversioned = { ...was, text: was.text.replace("Version: 0.1.9\n", "") };
  assert.deepEqual(checkVersions([at("0.1.0")], [unversioned]), []);
  assert.deepEqual(checkVersions([at("0.1.0")], []), []);
});

test("artifacts/ holds only artifacts and its README", () => {
  assert.deepEqual(checkArtifacts([], ["notes.txt"]), ["notes.txt: artifacts/ holds only .html artifacts and README.md"]);
});
