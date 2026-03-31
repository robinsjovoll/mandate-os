import type { ToolId } from './mandates.js';

export const mandateOsGenericEvaluateToolName = 'mandateos_evaluate_actions';
export const mandateOsGenericEnforcedExecuteToolName =
  'mandateos_execute_enforced_action';

export type EnforcementIntegration = 'mcp' | 'openclaw';

// Central registry for enforced capabilities. Add new routes here so policy
// redirects, generic execute flows, and host tool discovery stay aligned.
export const enforcementRouteDefinitions = [
  {
    route: 'enforced.github.issue.label',
    integration: 'mcp',
    recommendedTool: mandateOsGenericEnforcedExecuteToolName,
    kind: 'github.issue.label',
    actionTool: 'issue.label',
    legacyToolName: 'mandateos_execute_github_issue_label',
    executePath: '/api/v1/integrations/github/issue-label/execute',
  },
  {
    route: 'enforced.github.pull_request.draft',
    integration: 'mcp',
    recommendedTool: mandateOsGenericEnforcedExecuteToolName,
    kind: 'github.pull_request.draft',
    actionTool: 'pr.draft',
    legacyToolName: 'mandateos_execute_github_pull_request_draft',
    executePath: '/api/v1/integrations/github/pull-request/draft/execute',
  },
  {
    route: 'enforced.openclaw.exec',
    integration: 'openclaw',
    recommendedTool: 'mandateos_openclaw_exec',
  },
  {
    route: 'enforced.openclaw.browser.mutate',
    integration: 'openclaw',
    recommendedTool: 'mandateos_openclaw_browser_mutate',
  },
  {
    route: 'enforced.openclaw.agent.spawn',
    integration: 'openclaw',
    recommendedTool: 'mandateos_openclaw_spawn_agent',
  },
] as const;

export type EnforcedRouteDefinition =
  (typeof enforcementRouteDefinitions)[number];
export type EnforcedRouteId = EnforcedRouteDefinition['route'];
export type PolicyGatewayRoute = 'generic' | EnforcedRouteId;
export type EnforcedExecutionCapability = Extract<
  EnforcedRouteDefinition,
  {
    kind: string;
    actionTool: ToolId;
    executePath: string;
  }
>;
export type EnforcedExecutionKind = EnforcedExecutionCapability['kind'];

export function isPolicyGatewayRoute(
  value: string,
): value is PolicyGatewayRoute {
  return (
    value === 'generic' ||
    enforcementRouteDefinitions.some((definition) => definition.route === value)
  );
}

export function isEnforcedExecutionKind(
  value: string,
): value is EnforcedExecutionKind {
  return enforcementRouteDefinitions.some(
    (definition) => 'kind' in definition && definition.kind === value,
  );
}

export function getEnforcedRouteDefinition(route: EnforcedRouteId) {
  const definition = enforcementRouteDefinitions.find(
    (entry) => entry.route === route,
  );

  if (!definition) {
    throw new Error(`Unknown MandateOS enforced route: ${route}`);
  }

  return definition;
}

export function getEnforcedExecutionCapability(kind: EnforcedExecutionKind) {
  const definition = enforcementRouteDefinitions.find(
    (entry) => 'kind' in entry && entry.kind === kind,
  );

  if (
    !definition ||
    !('actionTool' in definition) ||
    !('executePath' in definition)
  ) {
    throw new Error(`Unknown MandateOS enforced execution kind: ${kind}`);
  }

  return definition as EnforcedExecutionCapability;
}

export function recommendedToolForRoute(route: PolicyGatewayRoute) {
  if (route === 'generic') {
    return mandateOsGenericEvaluateToolName;
  }

  return getEnforcedRouteDefinition(route).recommendedTool;
}

export function listMandateOsEnforcedToolNames(
  integration?: EnforcementIntegration,
  options: {
    includeLegacyToolNames?: boolean;
  } = {},
) {
  const toolNames = new Set<string>();

  for (const definition of enforcementRouteDefinitions) {
    if (integration && definition.integration !== integration) {
      continue;
    }

    toolNames.add(definition.recommendedTool);

    if (options.includeLegacyToolNames && 'legacyToolName' in definition) {
      toolNames.add(definition.legacyToolName);
    }
  }

  return [...toolNames];
}

export function getLegacyToolNameForExecutionKind(kind: EnforcedExecutionKind) {
  const definition = getEnforcedExecutionCapability(kind);

  return 'legacyToolName' in definition ? definition.legacyToolName : undefined;
}

export function getExpectedActionToolForExecutionKind(
  kind: EnforcedExecutionKind,
) {
  return getEnforcedExecutionCapability(kind).actionTool;
}
