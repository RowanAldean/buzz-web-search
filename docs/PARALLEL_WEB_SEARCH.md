# Parallel-powered web search demo

This fork adds two opt-in tools to `buzz-dev-mcp`:

- `web_search` searches the live web and returns ranked URLs with LLM-ready excerpts.
- `web_fetch` extracts focused excerpts or full Markdown from up to 20 public URLs.

Both tools use the [Parallel Rust SDK](https://github.com/RowanAldean/parallel-sdk-rust) and are available to any ACP agent harness Buzz launches. Existing shell and file tools are unchanged. If `PARALLEL_API_KEY` is not configured, only the two web tools fail; the rest of `buzz-dev-mcp` continues to work.

## Prerequisites

- Docker Desktop
- Node.js 22.7.5 or newer for the optional MCP Inspector
- A [Parallel API key](https://platform.parallel.ai)
- Credentials for whichever inference provider you select in Buzz

Never commit either credential. Keep them in the launching process environment or Buzz's local agent configuration.

## Build and run the automated checks

From the repository root:

```bash
. ./bin/activate-hermit
export CARGO_NET_GIT_FETCH_WITH_CLI=true
cargo build -p buzz-dev-mcp -p buzz-acp -p buzz-agent -p buzz-cli
cargo test -p buzz-dev-mcp
cargo test -p buzz-acp build_mcp_servers_tests
```

The `CARGO_NET_GIT_FETCH_WITH_CLI` override lets Cargo use the normal Git credential helper. It can be omitted once the SDK repository is publicly readable.

## Test the MCP server directly

This is the fastest way to separate a Parallel or MCP problem from the rest of Buzz.

```bash
export PARALLEL_API_KEY="your-key"
npx -y @modelcontextprotocol/inspector \
  -e PARALLEL_API_KEY="$PARALLEL_API_KEY" \
  -- ./target/debug/buzz-dev-mcp
```

Open the URL printed by the Inspector, connect using the stdio transport, and select **Tools**.

First confirm that both `web_search` and `web_fetch` appear. Then call `web_search` with:

```json
{
  "objective": "Find the current public architecture of the Block Buzz agent system, prioritizing official sources.",
  "search_queries": ["Block Buzz ACP MCP agent architecture"],
  "mode": "basic",
  "max_results": 5,
  "max_chars_total": 10000
}
```

Expected result:

- structured JSON containing `search_id`, `session_id`, and ranked `results`
- every result has a URL and an `excerpts` array
- no raw API key appears in the response or server logs

Copy one or two returned URLs and the `session_id`, then call `web_fetch`:

```json
{
  "urls": ["https://github.com/block/buzz"],
  "objective": "Extract the sections that explain agents, ACP, and MCP.",
  "search_queries": ["agent ACP MCP"],
  "max_chars_total": 12000,
  "full_content": false,
  "session_id": "paste-the-search-session-id"
}
```

Expected result:

- structured JSON containing `extract_id`, `session_id`, `results`, and per-URL `errors`
- the successful result contains focused Markdown excerpts
- the returned session ID matches the continued research session

Also test the configuration failure once: stop the Inspector, unset the key, restart it, and call `web_search`. It should return `PARALLEL_API_KEY is not set` without crashing the MCP server; a subsequent `read_file` or `shell` call should still succeed.

## Test through the Buzz desktop product

### 1. Start the local product

In the first terminal:

```bash
. ./bin/activate-hermit
export CARGO_NET_GIT_FETCH_WITH_CLI=true
just setup
just dev
```

Run `just setup` only on the first launch. The Git-fetch override can be omitted once the SDK repository is publicly readable. `just dev` builds the local `buzz-acp`, `buzz-agent`, and `buzz-dev-mcp` sidecars, starts the relay, and opens the desktop app. A Parallel API key is not needed to build or start Buzz.

### 2. Create or edit an agent

In Buzz:

1. Open the agent setup flow.
2. Select any supported ACP harness and configure its normal inference credentials.
3. Expand **Advanced**, then find **Parallel API key**.
4. Paste the real Parallel API key into the masked field.
5. Save the agent. If it was already running, restart it so the new environment reaches `buzz-acp` and `buzz-dev-mcp`.
6. Ensure the agent uses the locally built `buzz-dev-mcp` sidecar. The standard local-development agent setup does this automatically.
7. Start the agent and add it to a test channel if it is not already present.

The desktop layers per-agent environment variables into the spawned `buzz-acp` process. The harness then forwards `PARALLEL_API_KEY` only to a configured executable named `buzz-dev-mcp`. This makes the UI-configured key available to `web_search` and `web_fetch` without requiring a terminal export.

The field is optional and independent of the chosen inference provider. Its value uses the existing environment-variable inheritance and process-spawn pipeline, but the generic editor hides `PARALLEL_API_KEY` so the credential cannot be configured twice.

For the most controlled test, select **Buzz Agent** and one of its documented providers. For example, its OpenAI-compatible configuration requires `BUZZ_AGENT_PROVIDER=openai`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL`, and `OPENAI_COMPAT_BASE_URL`. Claude, Codex, Goose, and other ACP harnesses should receive the same MCP tools.

### 3. Exercise the complete workflow

Mention the agent in a channel with:

> Use `web_search` to find the latest public information about Block Buzz's agent architecture. Then use `web_fetch` on the two best official sources. Reply with a five-bullet summary and linked sources. Do not use shell, curl, or a provider-native search tool.

While the turn runs, verify that the activity view shows calls whose names end in `web_search` and `web_fetch`. The final channel reply should cite the URLs returned by Parallel.

Repeat the same prompt after switching the agent to a second ACP harness. Equivalent sourced output demonstrates that web access is attached to the Buzz tool layer rather than a particular inference provider.

## Troubleshooting

- **SDK revision cannot be fetched:** set `CARGO_NET_GIT_FETCH_WITH_CLI=true`. If anonymous users will build the fork, make the SDK repository public first.
- **`PARALLEL_API_KEY is not set` only in Buzz:** confirm the agent has a non-empty value under **Advanced → Parallel API key**, save it, then restart that agent. Already-running agent processes cannot see later configuration changes.
- **Tools do not appear:** confirm the active agent has a non-empty MCP command pointing to the newly built `target/debug/buzz-dev-mcp`, then restart the agent session.
- **Search works but the agent uses another search mechanism:** explicitly require `web_search` and `web_fetch` in the prompt and inspect the tool-call activity.
- **No agent reply appears:** check the agent identity, channel membership, mention, owner gate, and inference-provider credentials using the existing `buzz-acp` runbook.

## Demo success criteria

The demo is complete when:

1. the Inspector lists and successfully calls both tools;
2. missing Parallel credentials fail only the web call, not the MCP process;
3. a Buzz channel prompt produces visible `web_search` and `web_fetch` calls and a sourced reply; and
4. the same workflow works after changing the ACP inference harness.
