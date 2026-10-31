// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { type Problems, readJson, report, ROOT, textProblems, unknownKeys } from "../check.ts";
import { schemaKeywordProblems, schemaProblems } from "../format/schema.ts";

export const SKILLS = [
  "ask",
  "transactions",
  "accounts",
  "run-bookkeeping",
  "transaction-audit",
  "spending-report",
  "subscriptions",
  "schedule-c",
  "schedule-e",
  "rules",
  "categories",
  "businesses",
  "import-file",
  "settings",
];

export const MARKETPLACES: Record<string, "path" | "local"> = {
  ".claude-plugin/marketplace.json": "path",
  ".agents/plugins/marketplace.json": "local",
  ".cursor-plugin/marketplace.json": "path",
};

const ADAPTER_ONLY = ["displayName", "documentationUrl", "privacyPolicyUrl", "termsOfServiceUrl"];
const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const MAX_DESCRIPTION = 300;
const MIN_README_WORDS = 40;
const SYSTEM_FILE = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*|.*~|\.#.*|.*\.sw[op]|__MACOSX)$/i;

const BANNED = [
  /\bcatalog(ue)?s?\b/i,
  /\bbanks?(ing)?\b/i,
  /\b(signins?|sign-ins?|sign-ons?|log-?ins?)\b/i,
  /\b(anthropic|claude|openai|chatgpt|gpt|codex|cursor|gemini|google|copilot|microsoft|vs ?code|perplexity|mistral|grok|deepseek|windsurf|siri|alexa|slack)\b/i,
  /\bsync\w*/i,
  /\b(tables?|charts?|graphs?|bold|italics?|headings?|bullets?|columns?|markdown|emojis?|fonts?|colou?rs?|layouts?|render\w*|styl\w*|format\w*|visual\w*|display\w*)\b/i,
  /\b(never|always|must)\b/i,
];
const LATE_MONTH = [/\b(April|June|July|August|September|October|November|December|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/i, /\bMay\b/];
const YEAR = /(?<![$\d.,])\b(19|20)[0-9]{2}\b(?![.,]\d)/g;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export interface Skill {
  folder: string;
  files: string[];
  text: string;
}

export interface Plugin {
  portable: JsonObject;
  adapter: JsonObject;
  schema: JsonObject;
  mcp: JsonObject;
  adapterMcp: JsonObject;
  files: string[];
  texts: Record<string, string>;
  skills: Skill[];
  readme: string;
  marketplaces: Record<string, JsonObject>;
  pkg: JsonObject;
  nodeVersion: string;
}

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

export function checkManifests(portable: JsonObject, adapter: JsonObject, schema: JsonObject): Problems {
  const { icon, ...rest } = portable;
  const problems = [...schemaKeywordProblems(schema), ...schemaProblems(rest, schema)].map((problem) => `plugin.json: ${problem}`);
  if (typeof icon !== "string" || !icon.startsWith("./")) problems.push("plugin.json: icon must be the icon's path, starting ./");
  for (const key of ADAPTER_ONLY) if (typeof adapter[key] !== "string") problems.push(`.claude-plugin/plugin.json: needs ${key}`);
  const shared = Object.keys(portable).filter((key) => key !== "$schema");
  for (const key of shared) if (!isDeepStrictEqual(adapter[key], portable[key])) problems.push(`.claude-plugin/plugin.json: ${key} differs from plugin.json's`);
  for (const key of unknownKeys(adapter, [...shared, ...ADAPTER_ONLY])) problems.push(`.claude-plugin/plugin.json: ${key} is not in plugin.json`);
  return problems;
}

function server(file: JsonObject, at: string, type: string, problems: Problems): string | undefined {
  const servers = isObject(file.mcpServers) ? Object.entries(file.mcpServers) : [];
  if (servers.length !== 1) {
    problems.push(`${at}: names one server, not ${servers.length}`);
    return undefined;
  }
  const [name, entry] = servers[0]!;
  if (!isObject(entry)) {
    problems.push(`${at}: ${name} must be an object`);
    return undefined;
  }
  for (const key of unknownKeys(entry, ["type", "url"])) problems.push(`${at}: ${name} has unknown field ${key}`);
  if (entry.type !== type) problems.push(`${at}: ${name}'s type must be ${type}`);
  if (typeof entry.url !== "string" || !/^https:\/\/[^/]+\/mcp$/.test(entry.url)) problems.push(`${at}: ${name}'s url must be an https origin + /mcp`);
  return `${name} ${String(entry.url)}`;
}

export function checkConnectors(mcp: JsonObject, adapterMcp: JsonObject): Problems {
  const problems: Problems = [];
  if (mcp.$schema !== MCP_SCHEMA) problems.push(`mcp.json: $schema must be ${MCP_SCHEMA}`);
  for (const key of unknownKeys(mcp, ["$schema", "mcpServers"])) problems.push(`mcp.json: unknown field ${key}`);
  for (const key of unknownKeys(adapterMcp, ["mcpServers"])) problems.push(`.mcp.json: unknown field ${key}`);
  const portable = server(mcp, "mcp.json", "streamable-http", problems);
  const adapter = server(adapterMcp, ".mcp.json", "http", problems);
  if (portable !== undefined && adapter !== undefined && portable !== adapter) problems.push(".mcp.json: names another server or URL than mcp.json");
  return problems;
}

function paths(value: Json): string[] {
  if (typeof value === "string") return value.startsWith("./") || value.startsWith("../") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(paths);
  if (isObject(value)) return Object.values(value).flatMap(paths);
  return [];
}

export function checkFiles(files: readonly string[], manifests: Record<string, JsonObject>): Problems {
  const problems: Problems = [];
  for (const file of files) if (file.split("/").some((part) => SYSTEM_FILE.test(part))) problems.push(`${file}: a system file`);
  for (const [at, manifest] of Object.entries(manifests)) {
    for (const path of paths(manifest)) {
      const inside = posix.normalize(path);
      if (inside === ".." || inside.startsWith("../")) problems.push(`${at}: ${path} is outside the plugin`);
      else if (!files.includes(inside)) problems.push(`${at}: ${path} doesn't exist`);
    }
  }
  return problems;
}

export function frontmatter(text: string): { fields: Record<string, string>; body: string; problems: Problems } {
  const problems: Problems = [];
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) return { fields: {}, body: text, problems: ["no frontmatter between --- lines at the top"] };
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const field = /^([a-z][a-z-]*): (.+)$/.exec(line);
    if (field === null) {
      problems.push(`frontmatter line "${line}" is not key: value`);
      continue;
    }
    const key = field[1]!;
    const value = field[2]!;
    if (/^[-?:,[\]{}#&*!|>'"%@`\s]/.test(value) || / #|: |[:\s]$/.test(value)) problems.push(`frontmatter ${key} is not plain text YAML reads as written`);
    if (key in fields) problems.push(`frontmatter ${key} appears twice`);
    fields[key] = value;
  }
  return { fields, body: match[2]!, problems };
}

export function wordingProblems(text: string, nextYear: number): Problems {
  const problems: Problems = [];
  for (const banned of BANNED) {
    const found = banned.exec(text);
    if (found !== null) problems.push(`uses "${found[0]}"`);
  }
  for (const late of LATE_MONTH) {
    const month = late.exec(text);
    if (month !== null) problems.push(`names ${month[0]}, a month after March`);
  }
  for (const [year] of text.matchAll(YEAR)) if (Number(year) !== nextYear) problems.push(`names the year ${year}; only next year, ${nextYear}`);
  return problems;
}

export function checkSkills(skills: readonly Skill[], product: string, nextYear: number): Problems {
  const problems: Problems = [];
  const folders = skills.map((skill) => skill.folder);
  for (const name of SKILLS) if (!folders.includes(name)) problems.push(`skills: ${name} is missing`);
  for (const skill of skills) {
    const at = `skills/${skill.folder}`;
    if (!SKILLS.includes(skill.folder)) problems.push(`${at}: not one of the ${SKILLS.length} skills`);
    if (skill.files.length !== 1 || skill.files[0] !== "SKILL.md") problems.push(`${at}: must hold only SKILL.md`);
    const { fields, body, problems: parsed } = frontmatter(skill.text);
    for (const problem of parsed) problems.push(`${at}: ${problem}`);
    for (const key of unknownKeys(fields, ["name", "description"])) problems.push(`${at}: frontmatter has ${key}; only name and description`);
    if (fields.name !== skill.folder) problems.push(`${at}: name must be ${skill.folder}`);
    const description = fields.description ?? "";
    if (description === "") problems.push(`${at}: needs a description`);
    if (description.length > MAX_DESCRIPTION) problems.push(`${at}: description is ${description.length} characters, over ${MAX_DESCRIPTION}`);
    if (!new RegExp(`\\b${product.replaceAll(".", "\\.")}\\b`, "i").test(description)) problems.push(`${at}: description must name ${product}`);
    if (body.trim() === "") problems.push(`${at}: needs a body`);
    for (const problem of wordingProblems(`${description}\n${body}`, nextYear)) problems.push(`${at}: ${problem}`);
  }
  return problems;
}

function source(entry: JsonObject, form: "path" | "local"): Json | undefined {
  const value = entry.source;
  if (form === "path") return value;
  return isObject(value) && value.source === "local" ? value.path : undefined;
}

export function checkMarketplaces(marketplaces: Record<string, JsonObject>, name: string): Problems {
  const problems: Problems = [];
  for (const [at, form] of Object.entries(MARKETPLACES)) {
    const marketplace = marketplaces[at];
    if (marketplace === undefined) {
      problems.push(`${at}: missing`);
      continue;
    }
    const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
    if (plugins.length !== 1) {
      problems.push(`${at}: lists one plugin, not ${plugins.length}`);
      continue;
    }
    if (!isObject(plugins[0])) {
      problems.push(`${at}: the plugin must be an object`);
      continue;
    }
    if (plugins[0].name !== name) problems.push(`${at}: the plugin's name must be ${name}`);
    if (source(plugins[0], form) !== "./plugin") problems.push(`${at}: the plugin's source must be ./plugin${form === "local" ? ", as a local source" : ""}`);
  }
  return problems;
}

export const PACKAGE: JsonObject = {
  name: "@clydesi/enhance",
  description: "Enhance Clyde with ready-made rules, categories, artifacts, and plugins.",
  keywords: ["personal-finance", "bookkeeping", "mcp", "agent-skills", "agent-plugins"],
  homepage: "https://www.clyde.si",
  bugs: { url: "https://github.com/clydesi/enhance/issues", email: "dev@clyde.si" },
  repository: { type: "git", url: "git+https://github.com/clydesi/enhance.git" },
  license: "Apache-2.0",
  author: { name: "Clyde Intelligence, LLC", email: "info@clyde.si", url: "https://www.clyde.si" },
  private: true,
  type: "module",
  engines: { node: ">=26" },
};
const PACKAGE_FIELDS = ["name", "version", "description", "keywords", "homepage", "bugs", "repository", "license", "author", "private", "type", "engines", "scripts", "devDependencies"];
const SCRIPTS = ["typecheck", "validate", "test"];

const repositoryUrl = (url: unknown): unknown => (typeof url === "string" ? url.replace(/^git\+/, "").replace(/\.git$/, "") : url);

export function checkPackage(pkg: JsonObject, portable: JsonObject, nodeVersion: string): Problems {
  const problems: Problems = [];
  for (const key of PACKAGE_FIELDS) if (!Object.hasOwn(pkg, key)) problems.push(`package.json: needs ${key}`);
  for (const key of unknownKeys(pkg, PACKAGE_FIELDS)) problems.push(`package.json: ${key} is not a field it has`);
  for (const [key, value] of Object.entries(PACKAGE)) {
    if (!isDeepStrictEqual(pkg[key], value)) problems.push(`package.json: ${key} must be ${JSON.stringify(value)}; a change to it is made here and in PACKAGE in lib/plugin/validate.ts`);
  }
  if (pkg.version !== portable.version) problems.push(`package.json: version ${pkg.version} differs from the plugin's ${portable.version}`);
  const scripts = isObject(pkg.scripts) ? pkg.scripts : {};
  for (const script of SCRIPTS) if (typeof scripts[script] !== "string") problems.push(`package.json: needs the ${script} script`);
  const author = isObject(portable.author) ? portable.author : {};
  const pkgAuthor = isObject(pkg.author) ? pkg.author : {};
  const pkgRepository = isObject(pkg.repository) ? pkg.repository.url : undefined;
  const shared: Array<[string, unknown, unknown]> = [
    ["homepage", pkg.homepage, portable.homepage],
    ["license", pkg.license, portable.license],
    ["repository", repositoryUrl(pkgRepository), portable.repository],
    ["author.email", pkgAuthor.email, author.email],
  ];
  for (const [field, mine, plugin] of shared) if (mine !== plugin) problems.push(`package.json: ${field} differs from the plugin's (${JSON.stringify(plugin)})`);
  if (nodeVersion.trim() !== "26") problems.push(".node-version must be 26");
  return problems;
}

export function checkReadme(readme: string): Problems {
  const problems: Problems = [];
  const words = readme.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
  if (words < MIN_README_WORDS) problems.push(`README.md: ${words} words, under ${MIN_README_WORDS}`);
  for (const name of SKILLS) if (!readme.includes(`\`${name}\``)) problems.push(`README.md: needs ${name}`);
  return problems;
}

export function checkPlugin(plugin: Plugin, nextYear: number): Problems {
  const product = String(plugin.portable.name);
  return [
    ...checkManifests(plugin.portable, plugin.adapter, plugin.schema),
    ...checkConnectors(plugin.mcp, plugin.adapterMcp),
    ...checkFiles(plugin.files, { "plugin.json": plugin.portable, ".claude-plugin/plugin.json": plugin.adapter }),
    ...Object.entries(plugin.texts).flatMap(([path, text]) => textProblems(text).map((problem) => `${path}: ${problem}`)),
    ...checkSkills(plugin.skills, product, nextYear),
    ...checkReadme(plugin.readme),
    ...checkMarketplaces(plugin.marketplaces, product),
    ...checkPackage(plugin.pkg, plugin.portable, plugin.nodeVersion),
  ];
}

export function loadPlugin(root: string): Plugin {
  const at = (...parts: string[]) => join(root, "plugin", ...parts);
  const files = readdirSync(at(), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(at(), join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
  const texts = Object.fromEntries(files.filter((file) => /\.(md|json|ts)$/.test(file)).map((file) => [file, readFileSync(at(file), "utf8")]));
  const folders = [...new Set(files.filter((file) => file.startsWith("skills/")).map((file) => file.split("/")[1]!))];
  const skills = folders.map((folder) => ({
    folder,
    files: files.filter((file) => file.startsWith(`skills/${folder}/`)).map((file) => file.slice(`skills/${folder}/`.length)),
    text: texts[`skills/${folder}/SKILL.md`] ?? "",
  }));
  const marketplaces = Object.fromEntries(
    Object.keys(MARKETPLACES)
      .filter((file) => existsSync(join(root, file)))
      .map((file) => [file, readJson<JsonObject>(join(root, file))]),
  );
  return {
    portable: readJson(at("plugin.json")),
    adapter: readJson(at(".claude-plugin", "plugin.json")),
    schema: readJson(join(root, "lib", "plugin", "plugin.schema.json")),
    mcp: readJson(at("mcp.json")),
    adapterMcp: readJson(at(".mcp.json")),
    files,
    texts,
    skills,
    readme: readFileSync(at("README.md"), "utf8"),
    marketplaces,
    pkg: readJson(join(root, "package.json")),
    nodeVersion: readFileSync(join(root, ".node-version"), "utf8"),
  };
}

if (import.meta.main) {
  const plugin = loadPlugin(ROOT);
  report("plugin", plugin.skills.length, checkPlugin(plugin, new Date().getFullYear() + 1));
}
