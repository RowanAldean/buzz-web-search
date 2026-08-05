const MCP_SERVERS_ENV_KEY = "BUZZ_ACP_MCP_SERVERS";
const PARALLEL_SERVER_NAME = "parallel-web";

const PARALLEL_SERVER = {
  type: "http",
  name: PARALLEL_SERVER_NAME,
  url: "https://search.parallel.ai/mcp",
  headers: [],
} as const;

type McpServerConfig = {
  name?: unknown;
  [key: string]: unknown;
};

function parseServers(raw: string | undefined): McpServerConfig[] | null {
  if (!raw?.trim()) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    if (!value.every((entry) => entry !== null && typeof entry === "object")) {
      return null;
    }
    return value as McpServerConfig[];
  } catch {
    return null;
  }
}

export function withParallelWebAccess(
  raw: string | undefined,
  enabled: boolean,
): string | null {
  const servers = parseServers(raw);
  if (servers === null) return null;
  const withoutParallel = servers.filter(
    (server) => server.name !== PARALLEL_SERVER_NAME,
  );
  const next = enabled
    ? [...withoutParallel, PARALLEL_SERVER]
    : withoutParallel;
  return next.length > 0 ? JSON.stringify(next) : "";
}

export function ToolIntegrationsField({
  envVars,
  onChange,
}: {
  envVars: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const raw = envVars[MCP_SERVERS_ENV_KEY];
  const servers = parseServers(raw);
  const configurationValid = servers !== null;
  const parallelEnabled =
    servers?.some((server) => server.name === PARALLEL_SERVER_NAME) ?? false;

  function setParallelEnabled(enabled: boolean) {
    const serialized = withParallelWebAccess(raw, enabled);
    if (serialized === null) return;
    const next = { ...envVars };
    if (serialized) next[MCP_SERVERS_ENV_KEY] = serialized;
    else delete next[MCP_SERVERS_ENV_KEY];
    onChange(next);
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-border/70 p-3">
      <legend className="px-1 text-sm font-medium text-foreground">
        Tool integrations
      </legend>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          checked={parallelEnabled}
          className="mt-1 h-4 w-4 rounded border-input"
          disabled={!configurationValid}
          onChange={(event) => setParallelEnabled(event.target.checked)}
          type="checkbox"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-foreground">
            Web access with Parallel
          </span>
          <span className="block text-xs leading-relaxed text-muted-foreground">
            Anonymous search and page retrieval. Search terms and fetched URLs
            go directly to Parallel, outside your self-hosted Buzz relay.
          </span>
        </span>
      </label>
      {!configurationValid ? (
        <p className="text-xs text-destructive" role="alert">
          The custom MCP configuration is invalid. Fix BUZZ_ACP_MCP_SERVERS
          before changing this preset.
        </p>
      ) : null}
    </fieldset>
  );
}

export { MCP_SERVERS_ENV_KEY };
