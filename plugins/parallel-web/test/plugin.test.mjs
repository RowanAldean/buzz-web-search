import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The host HTTPS call is external. All plugin validation and output handling run here.
async function harness(request = async () => ({ status: 200, body: '{"results":[]}' })) {
  const source = await readFile(new URL("../plugin.js", import.meta.url), "utf8");
  const plugin = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const tools = new Map();
  const instructions = [];
  const cleanup = [];
  const state = [];
  let cursor = 0;
  let card;
  const ctx = {
    agents: {
      addTool: (tool) => tools.set(tool.name, tool),
      addInstructions: (value) => instructions.push(value),
    },
    settingsCards: { register: (value) => { card = value; } },
    host: { request },
    effect: (start) => cleanup.push(start()),
    react: {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: (initial) => {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (v) => { state[i] = typeof v === "function" ? v(state[i]) : v; }];
      },
    },
  };
  plugin.apply(ctx);
  const render = () => { cursor = 0; return card.component({ active: () => true }); };
  const all = (node) => node && typeof node === "object" ? [node, ...node.children.flat(Infinity).flatMap(all)] : [];
  const configure = (key = "test-secret-never-output") => {
    let tree = render();
    all(tree).find((n) => n.type === "input").props.onChange({ target: { value: key } });
    tree = render();
    all(tree).find((n) => n.type === "form").props.onSubmit({ preventDefault() {} });
  };
  const clear = () => all(render()).find((n) => n.type === "button" && n.children.includes("Clear key")).props.onClick();
  const controller = new AbortController();
  const call = (name, args, signal = controller.signal) => tools.get(name).call({ signal }, {}, args);
  return { tools, instructions, configure, clear, call, controller, close: () => cleanup.forEach((f) => f?.()) };
}

const search = { objective: "Find current Buzz features", search_queries: ["Buzz plugins release"] };

test("search returns citation data and sends a v1 fast request with the configured key", async () => {
  let sent;
  const h = await harness(async (req) => {
    sent = req;
    return { status: 200, body: JSON.stringify({ results: [{ url: "https://buzz.xyz/", title: "Buzz", excerpts: ["A workspace."], publish_date: "2026-11-10" }] }) };
  });
  h.configure();
  const answer = JSON.parse(await h.call("parallel_search", search));
  assert.equal(sent.url, "https://api.parallel.ai/v1/search");
  assert.equal(sent.headers["x-api-key"], "test-secret-never-output");
  assert.deepEqual(JSON.parse(sent.body), { ...search, mode: "fast" });
  assert.equal(answer.results[0].url, "https://buzz.xyz/");
  assert.equal(answer.results[0].publish_date, "2026-11-10");
  assert.deepEqual(answer.results[0].excerpts, ["A workspace."]);
  assert.ok(!JSON.stringify(answer).includes("test-secret"));
});

test("fetch sends known URLs to Extract and keeps partial URL failures visible", async () => {
  let sent;
  const h = await harness(async (req) => {
    sent = req;
    return { status: 200, body: JSON.stringify({ results: [{ url: "https://buzz.xyz/", excerpts: ["content"] }], errors: [{ url: "https://bad.test/", error_type: "fetch_failed" }] }) };
  });
  h.configure();
  const urls = ["https://buzz.xyz/", "https://bad.test/"];
  const answer = JSON.parse(await h.call("parallel_fetch", { urls, objective: "Find features" }));
  assert.equal(sent.url, "https://api.parallel.ai/v1/extract");
  assert.deepEqual(JSON.parse(sent.body), { urls, objective: "Find features" });
  assert.equal(answer.errors[0].url, "https://bad.test/");
});

test("invalid tool inputs and missing credentials never reach the network", async () => {
  let count = 0;
  const h = await harness(async () => { count++; throw Error("should not send"); });
  await assert.rejects(h.call("parallel_search", search), /Settings/);
  h.configure();
  for (const args of [{}, { ...search, search_queries: [] }, { ...search, search_queries: [" "] }, { ...search, mode: "unsafe" }]) {
    await assert.rejects(h.call("parallel_search", args));
  }
  for (const urls of [[], ["file:///etc/passwd"], ["https://user:secret@host.test/"], Array(21).fill("https://buzz.xyz/")]) {
    await assert.rejects(h.call("parallel_fetch", { urls }));
  }
  assert.equal(count, 0);
});

test("API failures and malformed replies expose useful errors without raw secrets", async () => {
  for (const status of [401, 403, 429, 500]) {
    const h = await harness(async () => ({ status, body: "test-secret-never-output" }));
    h.configure();
    await assert.rejects(h.call("parallel_search", search), (e) => !e.message.includes("test-secret") && /Parallel/.test(e.message));
  }
  for (const body of ["not JSON", "null", '{"results":{}}', '{"foo":"bar"}', '{"results":[null]}']) {
    const h = await harness(async () => ({ status: 200, body }));
    h.configure();
    await assert.rejects(h.call("parallel_search", search), /response/);
  }
});

test("Stop before dispatch sends no request; Stop during dispatch discards the reply", async () => {
  let count = 0;
  const h = await harness(async () => { count++; h.controller.abort(); return { status: 200, body: '{"results":[]}' }; });
  h.configure();
  await assert.rejects(h.call("parallel_search", search), /cancel/i);
  await assert.rejects(h.call("parallel_search", search), /cancel/i);
  assert.equal(count, 1);
  await assert.rejects(h.call("parallel_search", search, null), /cancellation/);
});

test("key clear and plugin unload invalidate in-flight replies and disable use instructions", async () => {
  for (const action of ["clear", "close"]) {
    let release;
    const h = await harness(() => new Promise((resolve) => { release = resolve; }));
    assert.equal(h.instructions[0].when({}), false);
    h.configure();
    assert.equal(h.instructions[0].when({}), true);
    const pending = h.call("parallel_search", search);
    h[action]();
    release({ status: 200, body: '{"results":[]}' });
    await assert.rejects(pending, /changed|disabled/);
    assert.equal(h.instructions[0].when({}), false);
  }
});

test("large excerpts are bounded and the agent can see truncation", async () => {
  const h = await harness(async () => ({ status: 200, body: JSON.stringify({ results: Array.from({ length: 30 }, (_, i) => ({ url: `https://source.test/${i}`, excerpts: ["a".repeat(10000)] })) }) }));
  h.configure();
  const text = await h.call("parallel_search", search);
  const result = JSON.parse(text);
  assert.ok(text.length <= 32000);
  assert.equal(result.truncated, true);
  assert.ok(result.results.length > 0);
});

test("large error lists and metadata stay within the output budget", async () => {
  const h = await harness(async () => ({ status: 200, body: JSON.stringify({ results: [], errors: Array.from({ length: 20 }, () => ({ url: `https://source.test/${"a".repeat(3000)}`, error_type: "fetch_failed" })) }) }));
  h.configure();
  const answer = await h.call("parallel_fetch", { urls: ["https://source.test/"] });
  assert.ok(answer.length <= 32000);
  assert.equal(JSON.parse(answer).truncated, true);
});

test("citation URLs stay exact, including long URLs", async () => {
  const url = `https://source.test/${"a".repeat(2500)}`;
  const h = await harness(async () => ({ status: 200, body: JSON.stringify({ results: [{ url, excerpts: ["Evidence"] }], errors: [{ url, error_type: "fetch_failed" }] }) }));
  h.configure();
  const answer = JSON.parse(await h.call("parallel_search", search));
  assert.equal(answer.results[0].url, url);
  assert.equal(answer.errors[0].url, url);
});
