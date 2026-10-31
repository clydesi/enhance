// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";
import { compact } from "../lib/artifacts/compact.ts";

const STYLE = [
  "@layer properties{@supports (((-webkit-hyphens:none))){*,:before,:after,::backdrop{--tw-shadow:0 0 #0000}}}",
  "@layer utilities{.hidden{display:none}.flex{display:flex}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)}",
  ".hover\\:bg-mist-950\\/10:hover{background-color:#090b0c1a}@supports (color:color-mix(in lab, red, red)){.hover\\:bg-mist-950\\/10:hover{background-color:color-mix(in oklab, var(--color-mist-950) 10%, transparent)}}",
  ".placeholder\\:text-x::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){.placeholder\\:text-x::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}",
  ".fill-none{fill:none}.px-\\(--gutter\\){padding-inline:var(--gutter)}.shadow{box-shadow:var(--tw-shadow)}}",
  "@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}",
].join("");

test("compacting renames class lists in the style, the markup, and the script alike", () => {
  const out = compact(STYLE, '<div class="flex mt-1.5"></div>', 'el("div",{class:"flex mt-1.5 hover:bg-mist-950/10"});el("p",{class:`shadow ${x} flex`});');
  const names = /class:"(\w+) (\w+) (\w+)"/.exec(out.script)!;
  assert.ok(names, out.script);
  const [, flex, mt, hover] = names;
  assert.ok(out.style.includes(`.${flex}{display:flex}`) && out.style.includes(`.${mt}{margin-top:`) && out.style.includes(`.${hover}:hover{`), out.style);
  assert.ok(out.markup.includes(`class="${flex} ${mt}"`), out.markup);
  assert.match(out.script, new RegExp(`class:\`\\w+ \\$\\{x\\} ${flex}\``));
});

test("a class the script also names as a lone word, or inside markup it writes, keeps its name", () => {
  const out = compact(STYLE, "", 'e.setAttribute("hidden","");e.innerHTML=\'<svg class="block fill-none">\';el("p",{class:"hidden flex"});');
  assert.ok(out.style.includes(".hidden{display:none}") && out.style.includes(".fill-none{fill:none}"), out.style);
  assert.match(out.script, /class:"hidden \w+"/);
  assert.ok(out.script.includes('class="block fill-none"'));
});

test("compacting drops a theme color's color-mix and @property, and keeps a currentcolor mix", () => {
  const out = compact(STYLE, "", "");
  assert.ok(!out.style.includes("var(--color-mist-950) 10%"), out.style);
  assert.ok(out.style.includes("currentcolor 50%"), out.style);
  assert.ok(!out.style.includes("@property") && !out.style.includes("@supports (((-webkit"), out.style);
  assert.match(out.style, /@layer properties\{\*,:before,:after,::backdrop\{--\w+:0 0 #0000\}\}/);
});

test("custom properties get short names unless the script names them", () => {
  const out = compact(STYLE, "", 'el.style.setProperty("--gutter","1px");');
  assert.ok(out.style.includes("var(--gutter)") && !out.style.includes("--spacing") && !out.style.includes("--tw-shadow"), out.style);
});

test("a regular expression in the script is never read as a class list", () => {
  const out = compact(STYLE, "", 'const r=/"flex"/g;el("p",{class:"flex"});');
  assert.ok(out.script.startsWith('const r=/"flex"/g;'), out.script);
});

test("a comment is kept whole, and nothing in it is read as a class", () => {
  const out = compact(`/*! tool v4.3.3 | https://example.com */${STYLE}`, "", 'el("td",{colspan:"3"});el("p",{class:"flex mt-1.5"});');
  assert.ok(out.style.startsWith("/*! tool v4.3.3 | https://example.com */"), out.style.slice(0, 60));
  assert.ok(out.script.includes('colspan:"3"'), out.script);
});

test("declarations before a nested rule are values, not a selector", () => {
  const out = compact(".flex{display:flex}.mt-1\\.5{margin:.5rem;&:hover{margin:0}}", "", 'el("p",{class:"flex mt-1.5"});');
  assert.ok(out.style.includes("margin:.5rem"), out.style);
});

test("a word touching a template's substitution is never renamed", () => {
  const out = compact(STYLE, "", "el(`mt-1.5${x} flex`);el(`flex ${x}`);");
  assert.match(out.script, /`mt-1\.5\$\{x\} \w+`/);
  assert.ok(out.style.includes(".mt-1\\.5{"), out.style);
});

test("a class attribute in single quotes is renamed as one in double quotes", () => {
  const out = compact(STYLE, "<div class='flex mt-1.5'></div>", 'el("p",{class:"flex mt-1.5"});');
  assert.match(out.markup, /^<div class="\w+ \w+"><\/div>$/);
});

test("a script that selects by a renamed class stops the build", () => {
  assert.throws(() => compact(STYLE, "", 'el("p",{class:"flex mt-1.5"});document.querySelector(".flex");'), /selects by the class \.flex/);
});
