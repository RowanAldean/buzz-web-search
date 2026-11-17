# Parallel Web Search for Buzz 1.0

Add public-web search and page reading to supported agents with one Buzz plugin.

This folder is a new **Buzz 1.0 plugin**, inside the repository that held the August Buzz 0.X fork. It does not require building that fork or changing agent transport code. The old `parallel-tool-integrations-demo` branch remains a separate historical demo.

## Install

Use the Buzz desktop app with the plugin contract documented in `block/buzz-app` at `v1.0.3-preview.2` or a compatible later build. The plugin API is a preview.

1. Open **Settings → Plugins → Manage plugins → Add**.
2. Add from Git: repository `https://github.com/RowanAldean/buzz-web-search`, ref `buzz-1-plugin`, folder `plugins/parallel-web`.
3. Review the access request for **https://api.parallel.ai**, then install and enable the plugin.
4. Open **Settings → Parallel Web Search**. Paste a key from [Parallel Platform](https://platform.parallel.ai), then choose **Use key for this session**.
5. Start a new agent turn. The same plugin registers tools for supported local agents. No per-harness MCP setup is required.

Alternatively, clone this branch and use **Add → Browse** to select this folder. There is no build step or dependency install. Select `plugins/parallel-web`, not the repository root. Git installation imports the selected plugin folder; it does not build the legacy Buzz application.

The key stays in the plugin's memory. Re-enter it after Buzz closes, the plugin reloads, or the plugin is disabled. The plugin does not save it in browser storage, agent instructions, configuration files or tool results. This is a demo credential flow, not an organization credential service.

## Tools

| Tool | Input | Backend |
| --- | --- | --- |
| `parallel_search` | Goal-style `objective`; 1–3 short `search_queries` | `POST https://api.parallel.ai/v1/search`, fast mode |
| `parallel_fetch` | 1–20 public `urls`; optional `objective` | `POST https://api.parallel.ai/v1/extract` |

Results include source URLs, titles, dates and excerpts when available. Failed URLs remain visible. Tool output is bounded to 32,000 JavaScript characters; `truncated: true` means the agent should narrow its request. The plugin adds instructions to use these tools for public-web research while respecting the owner's explicit tool choice. It does not claim exclusive or guaranteed default routing.

Queries, objectives and page URLs go directly to Parallel, outside the Buzz relay. Usage is billed to the supplied Parallel account. This version uses authenticated direct APIs; it does not use the anonymous MCP endpoint. No shell or filesystem grants are requested. Like other Buzz plugins, it runs as trusted app code.

## Try it

> Use parallel_search to compare three public supplier product pages. Use parallel_fetch to check the pages, then post a short cited recommendation here. Name the tools you used.

For a smaller smoke test:

> Use parallel_search to find the latest official Buzz announcement. Cite the source URL.

## Verification

Automated tests use the real self-contained plugin module with a fake Buzz host HTTPS boundary:

```sh
cd plugins/parallel-web
npm test
```

No test sends a paid API request. Tests verify the v1 payloads, citation data, partial failures, input validation, credentials, response size, Stop and plugin unload behavior. They do not prove a working installed Buzz session.

Live acceptance checklist, to run in **each** of Claude, Codex, Goose and Pi:

- [ ] Install and enable the plugin; save a session API key.
- [ ] Discover and call both Parallel tools, then publish the cited answer in Buzz.
- [ ] Clear the key; the next call gives a setup error without a network request.
- [ ] Stop a pending call; its result must not reach the agent.
- [ ] Disable/reload the plugin; tools retire and the key must be entered again.
- [ ] Try an invalid key and a failed URL; confirm useful errors and partial results.

Compatibility remains unverified until these checks run. The plugin requires a live `client.signal`; a harness that does not supply one receives a clear error. The documented native Claude, Codex and Goose paths supply one; Pi must be tested. Hosted agents, Mesh agents and browser-only use are not certified.

Buzz's `host.request` has no AbortSignal argument. Stop is checked before dispatch and after completion. A request already sent may finish and be billed, but its result is discarded. Requests have a 60-second timeout, at most four in flight, and no automatic retries.

## Next steps

Task research, Monitor/Attention, persistent credentials, and Builderlab hosted access are separate follow-ups. Agree on credentials, billing, attribution and data controls before an organization deployment. Marketplace/default placement is not confirmed.

## References

- [Buzz release plugin contract](https://github.com/block/buzz-app/blob/v1.0.3-preview.2/docs/plugin-architecture.md)
- [Buzz plugin authoring](https://github.com/block/buzz-app/blob/main/docs/plugin-authoring-guide.md)
- [Search API](https://docs.parallel.ai/search/search-quickstart)
- [Extract API](https://docs.parallel.ai/extract/extract-quickstart)
