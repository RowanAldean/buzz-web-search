import type { EnvVarsValue } from "./EnvVarsEditor";
import { PersonaProviderApiKeyField } from "./PersonaProviderApiKeyField";

export const PARALLEL_API_KEY_ENV_VAR = "PARALLEL_API_KEY";

export function updateParallelApiKey(
  envVars: EnvVarsValue,
  value: string,
): EnvVarsValue {
  const next = { ...envVars };
  if (value === "") {
    delete next[PARALLEL_API_KEY_ENV_VAR];
  } else {
    next[PARALLEL_API_KEY_ENV_VAR] = value;
  }
  return next;
}

export function hasInheritedParallelApiKey(
  envVars: EnvVarsValue,
  inheritedEnvVars: EnvVarsValue,
): boolean {
  return (
    !(PARALLEL_API_KEY_ENV_VAR in envVars) &&
    (inheritedEnvVars[PARALLEL_API_KEY_ENV_VAR] ?? "").trim().length > 0
  );
}

/**
 * First-class credential control for the Parallel web tools. The value stays
 * in env_vars so the existing configuration, inheritance, and spawn pipeline
 * remains authoritative; this component only provides a masked UI over it.
 */
export function ParallelWebSearchField({
  disabled,
  envVars,
  inheritedEnvVars = {},
  inheritedLabel,
  onEnvVarsChange,
}: {
  disabled: boolean;
  envVars: EnvVarsValue;
  inheritedEnvVars?: EnvVarsValue;
  inheritedLabel: string;
  onEnvVarsChange: (value: EnvVarsValue) => void;
}) {
  return (
    <div className="space-y-1.5">
      <PersonaProviderApiKeyField
        disabled={disabled}
        envVarName={PARALLEL_API_KEY_ENV_VAR}
        inheritedLabel={inheritedLabel}
        isInherited={hasInheritedParallelApiKey(envVars, inheritedEnvVars)}
        isRequired={false}
        label="Parallel API key"
        onValueChange={(value) =>
          onEnvVarsChange(updateParallelApiKey(envVars, value))
        }
        testId="parallel-api-key"
        value={envVars[PARALLEL_API_KEY_ENV_VAR] ?? ""}
      />
      <p className="text-xs text-muted-foreground">
        Optional. Enables Parallel-powered web search and page extraction for
        this agent, independent of its inference provider.
      </p>
    </div>
  );
}
