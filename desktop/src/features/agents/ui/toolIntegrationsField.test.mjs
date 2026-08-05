import assert from "node:assert/strict";
import test from "node:test";

import { withParallelWebAccess } from "./ToolIntegrationsField.tsx";

test("enables Parallel without replacing custom MCP servers", () => {
  const custom = JSON.stringify([
    { type: "http", name: "docs", url: "https://example.com/mcp" },
  ]);
  const next = JSON.parse(withParallelWebAccess(custom, true));

  assert.deepEqual(next, [
    { type: "http", name: "docs", url: "https://example.com/mcp" },
    {
      type: "http",
      name: "parallel-web",
      url: "https://search.parallel.ai/mcp",
      headers: [],
    },
  ]);
});

test("disabling Parallel preserves other integrations", () => {
  const raw = JSON.stringify([
    { type: "http", name: "parallel-web", url: "https://old.example/mcp" },
    { type: "stdio", name: "local", command: "local-mcp" },
  ]);
  const next = JSON.parse(withParallelWebAccess(raw, false));

  assert.deepEqual(next, [
    { type: "stdio", name: "local", command: "local-mcp" },
  ]);
});

test("refuses to overwrite malformed custom configuration", () => {
  assert.equal(withParallelWebAccess("not json", true), null);
});
