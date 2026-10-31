// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { createServer } from "node:http";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { ROOT } from "../check.ts";
import { buildArtifact, viewNames } from "./build.ts";

const PORT = Number(process.env.PORT ?? 4173);
const RESET = ":root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}";
const FAILS = ["needs_reauth", "server_not_connected", "approval_required", "server_unavailable", "tool_error"];

const pages = (): string[] => viewNames(ROOT);

async function connector(): Promise<string> {
  const bundled = await esbuild.build({ entryPoints: [join(ROOT, "src", "artifacts", "preview", "connector.ts")], bundle: true, format: "iife", target: "es2022", write: false, logLevel: "silent" });
  return bundled.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");
}

function index(): string {
  const links = (name: string): string =>
    [["dark", "theme=dark"], ["light", "theme=light"], ["system", "theme=system"], ["slow", "slow"], ["conflict", "conflict"], ...FAILS.map((code) => [code, `fail=${code}`])]
      .map(([label, query]) => `<a href="/${name}.html?${query}">${label}</a>`)
      .join(", ");
  const items = pages()
    .map((name) => `<li><a href="/${name}.html">${name}</a> <small>(${links(name)})</small></li>`)
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>Artifact previews</title><style>body{font:16px/1.8 system-ui,sans-serif;margin:2rem}small{color:#666}</style><h1>Artifact previews</h1><p>Built from src/artifacts/ on each load, with the preview's own ledger: a household with a side business and a rental house, every name generic. A theme chosen here stays as you follow the views' links. A Save is kept until the page reloads.</p><ul>${items}</ul>`;
}

const THEME = `<script>(() => { const asked = new URLSearchParams(location.search).get("theme"); try { if (asked !== null) sessionStorage.setItem("preview-theme", asked); } catch {} let theme = asked; try { theme ??= sessionStorage.getItem("preview-theme"); } catch {} if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme); })();</script>`;

async function page(name: string, query: URLSearchParams): Promise<string> {
  const options = JSON.stringify({ fail: query.get("fail"), delay: query.has("slow") ? 1500 : 150, conflict: query.has("conflict"), failMonth: query.get("failMonth") }).replace(/</g, "\\u003c");
  const [body, script] = await Promise.all([buildArtifact(ROOT, name), connector()]);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${RESET}</style>${THEME}<script>window.__clydePreview = ${options};</script><script>${script}</script></head><body>${body}</body></html>`;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname.slice(1);
  const send = (status: number, html: string): void => void response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
  if (path === "") return send(200, index());
  if (pages().includes(path)) return void response.writeHead(302, { location: `/${path}.html${url.search}` }).end();
  const name = path.replace(/\.html$/, "");
  if (!path.endsWith(".html") || !pages().includes(name)) return send(404, "No such artifact.");
  page(name, url.searchParams).then(
    (html) => send(200, html),
    (err: unknown) => send(500, `<pre>${String(err).replace(/</g, "&lt;")}</pre>`),
  );
}).listen(PORT, "127.0.0.1", () => console.log(`Artifact previews: http://localhost:${PORT}`));
