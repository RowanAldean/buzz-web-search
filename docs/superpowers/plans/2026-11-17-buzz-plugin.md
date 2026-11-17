# Buzz 1.0 Parallel Plugin Implementation Plan

**Goal:** Add an installable Search and Extract plugin to the existing Buzz fork.

**Architecture:** A self-contained JavaScript module uses Buzz's addTool and addInstructions contracts. It calls api.parallel.ai through host.request. A Settings card holds an API key in memory for the current plugin activation only. The old app code stays as historical work.

**Tech stack:** Plain ESM JavaScript, React supplied by Buzz, Node's test runner. No new dependencies.

**Spec:** The approved Buzz 1.0 proposal in Notion, reviewed 2026-11-17. Contract: block/buzz-app v1.0.3-preview.2 docs/plugin-architecture.md.

## Decisions

Direct APIs give one tool surface independent of harness HTTP MCP support. Manual MCP configuration remains an alternative, but does not deliver one Buzz-managed setup. A plugin folder inside this fork avoids creating a new repository. API keys remain session-only until a durable credential-storage design is agreed. This choice requires re-entry after app/plugin reload.

## Constraints

- Installable folder: plugins/parallel-web, manifest.json and plugin.js, no runtime imports.
- Register parallel_search and parallel_fetch, plus brief use instructions.
- Declare only https://api.parallel.ai as a network origin. No shell or file grants.
- Validate inputs; preserve citation URLs; bound tool output; do not expose API responses in error messages.
- Require a live call cancellation signal, refuse work after unload/key change, never retry billable calls automatically.
- Desktop agents only: hosted, Mesh, browser and four-harness live compatibility remain unverified.

## Review focus

Missing credentials, malformed API output, credential changes during calls, canceled calls, and plugin reload must not leak secrets or return stale results.

## Tasks

- [x] Write behavioral tests with a host-request boundary double. Initial run failed because the plugin module did not exist.
- [x] Implement plugin registration, session key settings, API input/output handling and bounded results. Full plugin suite: 9 passing tests.
- [x] Document installation from Git/folder, API-key lifetime, privacy and the four-harness live checklist.
- [x] Review the complete diff; verify plugin syntax, no runtime imports, manifest access and tests. Independent review confirmed the release contract and found URL clipping. Regression failed before the fix and passed after it. Branch prepared for push.

## Verification record

Output-bound regression: large failure lists exceeded 32,000 characters; fixed by budgeting errors and whole source records. Citation regression: long URLs were shortened; fixed by retaining exact URLs and omitting whole records when necessary. No deferred code-review blockers. Live installation and four-harness checks remain open. No billable API requests were sent.

Validation does not run the legacy Rust application suite because this package has no imports or changes in that application. A real Buzz desktop session is a separate acceptance gate.
