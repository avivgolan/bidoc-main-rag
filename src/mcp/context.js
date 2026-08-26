import { QA_ROLES, normalizeContext } from "../qa/contracts.js";

export function createLocalMcpContext(env = process.env) {
  const currentProjectId = clean(env.BIDOC_MCP_PROJECT_ID);
  const configuredProjects = csv(env.BIDOC_MCP_ALLOWED_PROJECT_IDS);
  return normalizeContext({
    actorId: clean(env.BIDOC_MCP_ACTOR_ID) || "local-mcp",
    organizationId: clean(env.BIDOC_MCP_ORGANIZATION_ID) || "default",
    currentProjectId,
    allowedProjectIds: configuredProjects.length ? configuredProjects : currentProjectId ? [currentProjectId] : [],
    roles: csv(env.BIDOC_MCP_ROLES).length
      ? csv(env.BIDOC_MCP_ROLES)
      : [QA_ROLES.VIEWER, QA_ROLES.OPERATOR],
    environment: clean(env.BIDOC_MCP_ENVIRONMENT) || "qa"
  });
}

export function createHttpQaContext(req, { session = null, env = process.env } = {}) {
  const projectId = firstHeader(req, "x-project-id");
  return normalizeContext({
    actorId: session?.sub || firstHeader(req, "x-actor-id") || "bidoc-api",
    organizationId: firstHeader(req, "x-organization-id") || clean(env.BIDOC_MCP_ORGANIZATION_ID) || "default",
    currentProjectId: projectId || clean(env.BIDOC_MCP_PROJECT_ID),
    allowedProjectIds: session?.sub ? ["*"] : projectId ? [projectId] : csv(env.BIDOC_MCP_ALLOWED_PROJECT_IDS),
    roles: [QA_ROLES.VIEWER, QA_ROLES.OPERATOR],
    environment: "qa"
  });
}

function firstHeader(req, name) {
  const value = req?.headers?.[name];
  return clean(Array.isArray(value) ? value[0] : value);
}

function csv(value) {
  return String(value || "").split(",").map(clean).filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}
