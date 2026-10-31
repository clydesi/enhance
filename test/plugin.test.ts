// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkConnectors,
  checkFiles,
  checkManifests,
  checkMarketplaces,
  checkPackage,
  checkPlugin,
  checkReadme,
  checkSkills,
  frontmatter,
  loadPlugin,
  MARKETPLACES,
  PACKAGE,
  type Plugin,
  type Skill,
  wordingProblems,
} from "../lib/plugin/validate.ts";
import { ROOT, textProblems } from "../lib/check.ts";

const plugin = loadPlugin(ROOT);
const NEXT_YEAR = 2027;
const copy = (): Plugin => structuredClone(plugin);
const skill = (folder: string, description: string): Skill => ({ folder, files: ["SKILL.md"], text: `---\nname: ${folder}\ndescription: ${description}\n---\n\nShow them with \`show_rules\`.\n` });
const withSkill = (changed: Skill): Skill[] => plugin.skills.map((s) => (s.folder === changed.folder ? changed : s));

test("the repo's plugin passes", () => {
  assert.deepEqual(checkPlugin(plugin, NEXT_YEAR), []);
});

test("the portable manifest is checked against its schema; icon alone is let through", () => {
  const p = copy();
  p.portable.name = "Clyde";
  p.portable.extra = "x";
  delete p.portable.$schema;
  const problems = checkManifests(p.portable, p.adapter, p.schema);
  assert.ok(problems.includes("plugin.json: $schema is missing"), problems.join("\n"));
  assert.ok(problems.some((problem) => problem.startsWith("plugin.json: name must match ")), problems.join("\n"));
  assert.ok(problems.includes("plugin.json: extra is not a known field"), problems.join("\n"));
  assert.ok(!problems.some((problem) => problem.includes("icon is not a known field")), problems.join("\n"));
  p.portable.icon = "logo.png";
  assert.match(checkManifests(p.portable, p.adapter, p.schema).join("\n"), /icon must be the icon's path/);
});

test("a manifest schema with a keyword the checker doesn't know is refused", () => {
  const p = copy();
  p.schema = { ...p.schema, oneOf: [] };
  assert.ok(checkManifests(p.portable, p.adapter, p.schema).includes("plugin.json: the schema uses oneOf at the top, which this checker doesn't know"));
});

test("the adapter manifest's shared fields equal the portable one's, and it has its own four", () => {
  const p = copy();
  p.adapter.version = "9.9.9";
  delete p.adapter.documentationUrl;
  p.adapter.supportUrl = "https://example.com";
  const problems = checkManifests(p.portable, p.adapter, p.schema).join("\n");
  assert.match(problems, /version differs/);
  assert.match(problems, /needs documentationUrl/);
  assert.match(problems, /supportUrl is not in plugin\.json/);
  const q = copy();
  q.adapter.author = Object.fromEntries(Object.entries(q.adapter.author as object).reverse());
  assert.deepEqual(checkManifests(q.portable, q.adapter, q.schema), []);
});

test("both connector files name the same server and URL, each in its own shape", () => {
  const p = copy();
  assert.deepEqual(checkConnectors(p.mcp, p.adapterMcp), []);
  const [name] = Object.keys(p.mcp.mcpServers as object) as [string];
  (p.adapterMcp.mcpServers as Record<string, { url: string }>)[name]!.url = "https://example.com/mcp";
  assert.match(checkConnectors(p.mcp, p.adapterMcp).join("\n"), /another server or URL/);
  (p.mcp.mcpServers as Record<string, { type: string; url: string }>)[name] = { type: "http", url: "https://example.com/api" };
  const problems = checkConnectors(p.mcp, p.adapterMcp).join("\n");
  assert.match(problems, /type must be streamable-http/);
  assert.match(problems, /origin \+ \/mcp/);
});

test("every manifest path is a file inside the plugin; no system files", () => {
  assert.deepEqual(checkFiles(["logo.png"], { m: { icon: "./logo.png" } }), []);
  assert.match(checkFiles([], { m: { icon: "./logo.png" } }).join("\n"), /doesn't exist/);
  assert.match(checkFiles(["logo.png"], { m: { icon: "../logo.png" } }).join("\n"), /outside the plugin/);
  assert.match(checkFiles(["skills/ask/.DS_Store"], {}).join("\n"), /system file/);
  assert.match(checkFiles(["__MACOSX/logo.png"], {}).join("\n"), /system file/);
});

test("skills: exactly the 14, each folder holding only SKILL.md named for it", () => {
  const missing = plugin.skills.filter((s) => s.folder !== "ask");
  assert.match(checkSkills(missing, "clyde", NEXT_YEAR).join("\n"), /ask is missing/);
  assert.match(checkSkills([...plugin.skills, skill("budgets", "Show Clyde budgets.")], "clyde", NEXT_YEAR).join("\n"), /not one of the 14/);
  const renamed = { ...skill("rules", "Show Clyde rules."), text: skill("rule", "Show Clyde rules.").text };
  assert.match(checkSkills(withSkill(renamed), "clyde", NEXT_YEAR).join("\n"), /name must be rules/);
  const crowded = { ...skill("rules", "Show Clyde rules."), files: ["SKILL.md", "notes.md"] };
  assert.match(checkSkills(withSkill(crowded), "clyde", NEXT_YEAR).join("\n"), /must hold only SKILL\.md/);
});

test("skills: frontmatter parses as plain YAML, with only name and description", () => {
  assert.match(frontmatter("name: x\n").problems.join("\n"), /no frontmatter/);
  assert.match(frontmatter("---\nname: x\ndescription: Do this: that.\n---\n").problems.join("\n"), /not plain text/);
  assert.match(frontmatter('---\nname: x\ndescription: "Quoted."\n---\n').problems.join("\n"), /not plain text/);
  assert.deepEqual(frontmatter('---\nname: x\ndescription: Fitness > Gym, "quoted" inside.\n---\nBody.\n'), {
    fields: { name: "x", description: 'Fitness > Gym, "quoted" inside.' },
    body: "Body.\n",
    problems: [],
  });
  const tagged = { ...skill("rules", "Show Clyde rules."), text: "---\nname: rules\ndescription: Show Clyde rules.\nlicense: MIT\n---\n\nBody.\n" };
  assert.match(checkSkills(withSkill(tagged), "clyde", NEXT_YEAR).join("\n"), /frontmatter has license/);
});

test("skills: a description up to 300 characters that names the product", () => {
  assert.deepEqual(checkSkills(withSkill(skill("rules", "Show Clyde rules.")), "clyde", NEXT_YEAR), []);
  const long = `Show Clyde rules${" and more".repeat(40)}.`;
  assert.match(checkSkills(withSkill(skill("rules", long)), "clyde", NEXT_YEAR).join("\n"), /over 300/);
  assert.match(checkSkills(withSkill(skill("rules", "Show the user's rules.")), "clyde", NEXT_YEAR).join("\n"), /must name clyde/);
});

test("skills: the banned words", () => {
  for (const word of ["bank", "sign-in", "Claude", "ChatGPT", "VS Code", "sync", "syncing", "table", "bold", "columns", "formatted", "never", "Always", "must", "catalog", "Catalogue", "catalogs", "logins", "sign-ins", "tables", "charts", "graphs", "headings", "bullets", "fonts", "emojis", "layouts", "italics", "colours", "styling"]) {
    assert.notDeepEqual(wordingProblems(`Show the ${word} here.`, NEXT_YEAR), [], word);
  }
  assert.deepEqual(wordingProblems("Show the sign in email, and what may need a look.", NEXT_YEAR), []);
});

test("skills: no month after March, and a year only as next year", () => {
  assert.deepEqual(wordingProblems("The charge on Jan 1, and February to March.", NEXT_YEAR), []);
  for (const date of ["Apr 1", "September", "Sept 1", "Dec 3", "May 2", "december", "OCTOBER"]) {
    assert.match(wordingProblems(`The charge on ${date}.`, NEXT_YEAR).join("\n"), /after March/, date);
  }
  assert.deepEqual(wordingProblems("You may see it on Jan 1.", NEXT_YEAR), []);
  assert.deepEqual(wordingProblems(`Taxes for ${NEXT_YEAR}.`, NEXT_YEAR), []);
  assert.match(wordingProblems(`Taxes for ${NEXT_YEAR - 1}.`, NEXT_YEAR).join("\n"), /only next year/);
  assert.deepEqual(wordingProblems("Split the $2000 charge, or the 1,999.50 one, ending 2345.", NEXT_YEAR), []);
});

test("text files are plain ASCII and end with a newline", () => {
  assert.deepEqual(textProblems("Plain 'text' - here...\n"), []);
  assert.match(textProblems(`Curly ${String.fromCharCode(0x2019)}quote\n`).join("\n"), /U\+2019/);
  assert.match(textProblems(`A dash ${String.fromCharCode(0x2014)} here\n`).join("\n"), /U\+2014/);
  assert.match(textProblems("No newline").join("\n"), /newline/);
});

test("the plugin README is over 40 words and names every skill", () => {
  assert.deepEqual(checkReadme(plugin.readme), []);
  assert.match(checkReadme("# Clyde\n\nToo short.\n").join("\n"), /under 40/);
  assert.match(checkReadme(plugin.readme.replace("`schedule-e`", "schedule E")).join("\n"), /needs schedule-e/);
});

test("every marketplace file lists the one plugin at ./plugin", () => {
  const p = copy();
  assert.deepEqual(checkMarketplaces(p.marketplaces, "clyde"), []);
  const [first, second, third] = Object.keys(MARKETPLACES) as [string, string, string];
  (p.marketplaces[first]!.plugins as Array<{ source: string }>)[0]!.source = "./other";
  (p.marketplaces[second]!.plugins as Array<{ source: { path: string } }>)[0]!.source.path = "./other";
  (p.marketplaces[third]!.plugins as Array<{ name: string }>)[0]!.name = "other";
  const problems = checkMarketplaces(p.marketplaces, "clyde");
  assert.deepEqual(problems, [`${first}: the plugin's source must be ./plugin`, `${second}: the plugin's source must be ./plugin, as a local source`, `${third}: the plugin's name must be clyde`]);
  delete p.marketplaces[third];
  assert.match(checkMarketplaces(p.marketplaces, "clyde").join("\n"), /cursor-plugin\/marketplace\.json: missing/);
});

test("each marketplace file names the source in its own host's form", () => {
  const p = copy();
  const [first, second] = Object.keys(MARKETPLACES) as [string, string];
  (p.marketplaces[first]!.plugins as Array<{ source: unknown }>)[0]!.source = { source: "local", path: "./plugin" };
  (p.marketplaces[second]!.plugins as Array<{ source: unknown }>)[0]!.source = "./plugin";
  assert.deepEqual(checkMarketplaces(p.marketplaces, "clyde"), [`${first}: the plugin's source must be ./plugin`, `${second}: the plugin's source must be ./plugin, as a local source`]);
});

test("the package version is the plugin's, on Node 26", () => {
  const p = copy();
  assert.deepEqual(checkPackage(p.pkg, p.portable, p.nodeVersion), []);
  p.pkg.version = "9.9.9";
  assert.deepEqual(checkPackage(p.pkg, p.portable, "24\n"), ["package.json: version 9.9.9 differs from the plugin's 0.1.0", ".node-version must be 26"]);
});

test("the package's brand and naming stay exactly as fixed, field by field", () => {
  for (const [key, value] of Object.entries(PACKAGE)) {
    const changed = (to: unknown) => {
      const p = copy();
      p.pkg[key] = to as never;
      return checkPackage(p.pkg, p.portable, p.nodeVersion);
    };
    const fixed = `package.json: ${key} must be ${JSON.stringify(value)}; a change to it is made here and in PACKAGE in lib/plugin/validate.ts`;
    const variants: unknown[] = typeof value === "string" ? [`${value} `, value.toUpperCase() === value ? value.toLowerCase() : value.toUpperCase()] : [];
    if (Array.isArray(value)) variants.push([...value, "extra"], value.slice(1), [...value].reverse());
    if (value !== null && typeof value === "object" && !Array.isArray(value)) variants.push({ ...value, extra: "x" }, Object.fromEntries(Object.entries(value).slice(1)));
    if (typeof value === "boolean") variants.push(!value);
    for (const variant of variants) assert.ok(changed(variant).includes(fixed), `${key}: ${JSON.stringify(variant)}`);
  }
});

test("the package has exactly its fields and the scripts CI runs", () => {
  const p = copy();
  p.pkg.extra = "x";
  delete p.pkg.devDependencies;
  p.pkg.scripts = { test: "node --test test/" };
  const problems = checkPackage(p.pkg, p.portable, p.nodeVersion);
  assert.ok(problems.includes("package.json: extra is not a field it has"), problems.join("\n"));
  assert.ok(problems.includes("package.json: needs devDependencies"), problems.join("\n"));
  assert.ok(problems.includes("package.json: needs the typecheck script"), problems.join("\n"));
  assert.ok(problems.includes("package.json: needs the validate script"), problems.join("\n"));
});

test("the package and the plugin manifest share homepage, license, repository, and author email", () => {
  const p = copy();
  p.portable.homepage = "https://example.com";
  p.portable.license = "MIT";
  p.portable.repository = "https://github.com/example/other";
  p.portable.author = { ...(p.portable.author as object), email: "other@example.com" };
  assert.deepEqual(checkPackage(p.pkg, p.portable, p.nodeVersion), [
    'package.json: homepage differs from the plugin\'s ("https://example.com")',
    'package.json: license differs from the plugin\'s ("MIT")',
    'package.json: repository differs from the plugin\'s ("https://github.com/example/other")',
    'package.json: author.email differs from the plugin\'s ("other@example.com")',
  ]);
});

test("connector files: the portable one's $schema, one server each, and no other fields", () => {
  const p = copy();
  const [name] = Object.keys(p.mcp.mcpServers as object) as [string];
  const server = (p.mcp.mcpServers as Record<string, unknown>)[name];
  p.mcp.$schema = "https://example.com/mcp.schema.json";
  p.mcp.extra = 1;
  p.adapterMcp.mcpServers = { [name]: { type: "http", url: "https://app.example.com/mcp", headers: {} }, other: server as never };
  const problems = checkConnectors(p.mcp, p.adapterMcp);
  assert.ok(problems.includes("mcp.json: $schema must be https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"), problems.join("\n"));
  assert.ok(problems.includes("mcp.json: unknown field extra"), problems.join("\n"));
  assert.ok(problems.includes(".mcp.json: names one server, not 2"), problems.join("\n"));
  const q = copy();
  (q.adapterMcp.mcpServers as Record<string, Record<string, unknown>>)[name]!.headers = {};
  assert.deepEqual(checkConnectors(q.mcp, q.adapterMcp), [`.mcp.json: ${name} has unknown field headers`]);
});

test("skills: frontmatter lines are key: value once each, with a description and a body", () => {
  assert.deepEqual(frontmatter("---\nname: x\nnot a field\n---\nBody.\n").problems, ['frontmatter line "not a field" is not key: value']);
  assert.deepEqual(frontmatter("---\nname: x\nname: y\n---\nBody.\n").problems, ["frontmatter name appears twice"]);
  const bare = { ...skill("rules", "Show Clyde rules."), text: "---\nname: rules\n---\n\nBody.\n" };
  assert.match(checkSkills(withSkill(bare), "clyde", NEXT_YEAR).join("\n"), /skills\/rules: needs a description/);
  const empty = { ...skill("rules", "Show Clyde rules."), text: "---\nname: rules\ndescription: Show Clyde rules.\n---\n\n" };
  assert.deepEqual(checkSkills(withSkill(empty), "clyde", NEXT_YEAR), ["skills/rules: needs a body"]);
});

test("a marketplace file lists exactly one plugin, as an object", () => {
  const p = copy();
  const [first, second] = Object.keys(MARKETPLACES) as [string, string];
  p.marketplaces[first]!.plugins = [];
  p.marketplaces[second]!.plugins = ["clyde"];
  assert.deepEqual(checkMarketplaces(p.marketplaces, "clyde"), [`${first}: lists one plugin, not 0`, `${second}: the plugin must be an object`]);
});
