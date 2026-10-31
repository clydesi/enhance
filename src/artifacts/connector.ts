// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { word } from "./ui/dom";
import { PageError } from "./ui/reads";

declare const TOOLS: readonly string[];

interface Mcp {
  listTools(): Promise<{ servers: { server: string; kind?: string; tools: { name: string }[] }[] }>;
  callTool(server: string, tool: string, input: unknown): Promise<{ payload?: unknown; structuredContent?: unknown }>;
}
interface McpError {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  result?: { content?: { type?: string; text?: string }[] };
}
declare global {
  interface Window {
    claude?: { use(name: "mcp"): Promise<Mcp | null> };
  }
}

export const RETRACT = new Set(["no_mcp", "not_granted", "capability_disabled", "capability_removed", "server_not_connected", "server_not_found", "selection_required", "needs_reauth", "not_in_manifest", "approval_required", "consent_required", "blocked_by_policy", "user_changed"]);

let connection: Promise<{ mcp: Mcp; server: string }> | null = null;

function connect(): Promise<{ mcp: Mcp; server: string }> {
  connection ??= (async () => {
    const mcp = typeof window.claude?.use === "function" ? await window.claude.use("mcp") : null;
    if (mcp === null) throw { code: "no_mcp" };
    const { servers } = await mcp.listTools();
    const lists = (s: { tools: { name: string }[] }): boolean => TOOLS.every((tool) => s.tools.some((t) => t.name === tool));
    const unlisted = servers.filter((s) => s.kind !== "artifact" && s.tools.length === 0);
    const found = servers.find(lists) ?? (unlisted.length === 1 ? unlisted[0] : undefined);
    if (found === undefined) throw { code: "server_not_connected" };
    return { mcp, server: found.server };
  })().catch((err: unknown) => {
    connection = null;
    throw err;
  });
  return connection;
}

const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function refusalOf(err: McpError): { error?: string; message?: string; details?: unknown } {
  const said = err.result?.content?.find((block) => block.type === "text")?.text;
  if (typeof said !== "string" || said.trim() === "") return {};
  try {
    const shown = JSON.parse(said) as { error?: unknown; message?: unknown; details?: unknown };
    return {
      ...(typeof shown.error === "string" ? { error: shown.error } : {}),
      ...(typeof shown.message === "string" && shown.message !== "" ? { message: shown.message } : {}),
      details: shown.details,
    };
  } catch {
    return { message: said };
  }
}

function problem(err: McpError): string {
  switch (err.code) {
    case "no_mcp":
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return word("failNoConnector");
    case "server_not_connected":
    case "server_not_found":
      return word("failAddConnector");
    case "selection_required":
      return word("failChooseConnector");
    case "needs_reauth":
      return word("failSignIn");
    case "not_in_manifest":
    case "approval_required":
    case "consent_required":
      return word("failPermission");
    case "blocked_by_policy":
      return word("failBlocked");
    case "user_changed":
      return word("failUserChanged");
    case "tool_error":
      return refusalOf(err).message ?? word("failRefused");
    default:
      return word("failNoAnswer");
  }
}

async function call<T>(tool: string, input: Record<string, unknown>, retry: boolean): Promise<T> {
  try {
    const { mcp, server } = await connect();
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await mcp.callTool(server, tool, input);
        return (result.payload ?? result.structuredContent) as T;
      } catch (err) {
        const failed = err as McpError;
        if (!retry || attempt > 0 || failed.retryable !== true) throw err;
        await wait((failed.retryAfterMs ?? 600) + Math.random() * 600);
      }
    }
  } catch (err) {
    const failed = (typeof err === "object" && err !== null ? err : {}) as McpError;
    if (failed.code === "user_changed") document.dispatchEvent(new Event("clyde:user-changed"));
    const refusal = refusalOf(failed);
    throw new PageError(problem(failed), refusal.error ?? failed.code, refusal.details);
  }
}

export const read = <T>(tool: string, input: Record<string, unknown>): Promise<T> => call<T>(tool, input, true);

export const write = <T>(tool: string, input: Record<string, unknown>): Promise<T> => call<T>(tool, input, false);
