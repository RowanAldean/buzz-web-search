import assert from "node:assert/strict";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  hasInheritedParallelApiKey,
  PARALLEL_API_KEY_ENV_VAR,
  ParallelWebSearchField,
  updateParallelApiKey,
} from "./ParallelWebSearchField.tsx";

test("updateParallelApiKey sets the key without changing other env vars", () => {
  assert.deepEqual(updateParallelApiKey({ EXISTING: "value" }, "secret"), {
    EXISTING: "value",
    [PARALLEL_API_KEY_ENV_VAR]: "secret",
  });
});

test("updateParallelApiKey removes an empty local key so inheritance resumes", () => {
  assert.deepEqual(
    updateParallelApiKey(
      { EXISTING: "value", [PARALLEL_API_KEY_ENV_VAR]: "secret" },
      "",
    ),
    { EXISTING: "value" },
  );
});

test("hasInheritedParallelApiKey requires a non-empty inherited key and no local override", () => {
  assert.equal(
    hasInheritedParallelApiKey({}, { [PARALLEL_API_KEY_ENV_VAR]: "secret" }),
    true,
  );
  assert.equal(
    hasInheritedParallelApiKey(
      { [PARALLEL_API_KEY_ENV_VAR]: "local" },
      { [PARALLEL_API_KEY_ENV_VAR]: "inherited" },
    ),
    false,
  );
  assert.equal(
    hasInheritedParallelApiKey({}, { [PARALLEL_API_KEY_ENV_VAR]: "  " }),
    false,
  );
});

test("ParallelWebSearchField renders a masked, optional, provider-independent credential", () => {
  const html = renderToStaticMarkup(
    React.createElement(ParallelWebSearchField, {
      disabled: false,
      envVars: {},
      inheritedEnvVars: { [PARALLEL_API_KEY_ENV_VAR]: "inherited" },
      inheritedLabel: "Inherited from global defaults",
      onEnvVarsChange: () => {},
    }),
  );

  assert.ok(html.includes("Parallel API key"));
  assert.ok(html.includes(PARALLEL_API_KEY_ENV_VAR));
  assert.ok(html.includes('data-testid="parallel-api-key"'));
  assert.ok(html.includes('type="password"'));
  assert.ok(html.includes('placeholder="Inherited from global defaults"'));
  assert.ok(html.includes("independent of its inference provider"));
});
