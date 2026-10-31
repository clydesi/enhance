// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { preview, Refused } from "./build-data.ts";
import { NOW } from "./ledger.ts";

declare global {
  interface Window {
    __clydePreview: { fail: string | null; delay: number; conflict: boolean; failMonth: string | null };
    __clydeCalls: { tool: string; input: Record<string, unknown> }[];
    __clydeChange: (id: string, payee: string) => void;
  }
}

const { fail, delay, conflict, failMonth } = window.__clydePreview;
const clyde = preview();

const RealDate = Date;
const shift = NOW - RealDate.now();
class PreviewDate extends RealDate {
  constructor(...args: unknown[]) {
    super(...((args.length === 0 ? [RealDate.now() + shift] : args) as [number]));
  }
  static override now(): number {
    return RealDate.now() + shift;
  }
}
window.Date = PreviewDate as DateConstructor;

const TOOLS = ["show_transactions", "show_accounts", "show_spending", "edit"];
const refusal = (text: string) => ({ code: "tool_error", message: text, result: { content: [{ type: "text", text }], isError: true } });

let conflictOnce = conflict;

function answer(tool: string, input: Record<string, unknown>): unknown {
  if (tool === "show_spending" && failMonth !== null && input.month === failMonth) throw refusal(JSON.stringify({ error: "preview", message: `Clyde refused ${failMonth} (preview).` }));
  try {
    if (tool === "edit" && conflictOnce) {
      conflictOnce = false;
      const [op] = (input.ops ?? []) as { id?: string }[];
      if (op?.id !== undefined) clyde.change(op.id, (clyde.call("show_transactions", { transaction: op.id }) as { row: { payee: string } }).row.payee);
    }
    return clyde.call(tool, input);
  } catch (err) {
    if (err instanceof Refused) throw refusal(JSON.stringify(err.refusal));
    throw err;
  }
}

window.__clydeCalls = [];
window.__clydeChange = (id, payee) => clyde.change(id, payee);

const mcp = Object.freeze({
  listTools: async () => ({ servers: [{ server: "Clyde", authStatus: "connected", tools: TOOLS.map((name) => ({ name, description: "" })) }] }),
  callTool: (server: string, tool: string, input: Record<string, unknown> = {}) =>
    new Promise((resolve, reject) => {
      window.__clydeCalls.push({ tool, input });
      setTimeout(() => {
        if (fail !== null) return reject({ code: fail, message: `Preview failure: ${fail}`, ...(fail === "server_unavailable" ? { retryable: true, retryAfterMs: 300 } : {}), ...(fail === "tool_error" ? refusal("Clyde refused this read (preview).") : {}) });
        if (server !== "Clyde" || !TOOLS.includes(tool)) return reject({ code: "not_in_manifest", message: `${server} ${tool}` });
        try {
          const payload = structuredClone(answer(tool, input));
          resolve({ content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload, payload });
        } catch (err) {
          reject(err);
        }
      }, delay);
    }),
});
(window as { claude?: unknown }).claude = { use: async (name: string) => (name === "mcp" ? mcp : null) };
