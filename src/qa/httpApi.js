import { errorEnvelope, normalizeQaError, resultEnvelope } from "./contracts.js";

export async function handleQaHttpRequest({ req, url, service, context, readJson }) {
  if (!url.pathname.startsWith("/api/qa/")) return { matched: false };
  try {
    if (req.method === "POST" && url.pathname === "/api/qa/test-suites") {
      const data = await service.createTestSuite(context, await readJson(req));
      return response(201, data);
    }

    if (req.method === "POST" && url.pathname === "/api/qa/query") {
      const data = await service.runQuery(context, await readJson(req));
      return response(200, data);
    }

    const casesMatch = url.pathname.match(/^\/api\/qa\/test-suites\/([^/]+)\/cases$/);
    if (req.method === "POST" && casesMatch) {
      const body = await readJson(req);
      const data = await service.addTestCases(context, { ...body, suite_id: decodeURIComponent(casesMatch[1]) });
      return response(200, data);
    }

    const suiteRunsMatch = url.pathname.match(/^\/api\/qa\/test-suites\/([^/]+)\/runs$/);
    if (req.method === "POST" && suiteRunsMatch) {
      const body = await readJson(req);
      const data = await service.runTestSuite(context, { ...body, suite_id: decodeURIComponent(suiteRunsMatch[1]) });
      return response(202, data, "accepted");
    }

    const suiteMatch = url.pathname.match(/^\/api\/qa\/test-suites\/([^/]+)$/);
    if (req.method === "GET" && suiteMatch) {
      const data = await service.getTestSuite(context, {
        suite_id: decodeURIComponent(suiteMatch[1]),
        include_cases: url.searchParams.get("include_cases") === "true",
        cursor: url.searchParams.get("cursor"),
        limit: numberParam(url, "limit")
      });
      return response(200, data);
    }

    const analyzeMatch = url.pathname.match(/^\/api\/qa\/runs\/([^/]+)\/analyze$/);
    if (req.method === "POST" && analyzeMatch) {
      const body = await readJson(req);
      const data = await service.analyzeRun(context, { ...body, run_id: decodeURIComponent(analyzeMatch[1]) });
      return response(200, data);
    }

    const runMatch = url.pathname.match(/^\/api\/qa\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const data = await service.getRun(context, {
        run_id: decodeURIComponent(runMatch[1]),
        detail: url.searchParams.get("detail") || "summary",
        status: url.searchParams.get("status") || undefined,
        failure_code: url.searchParams.get("failure_code") || undefined,
        severity: url.searchParams.get("severity") || undefined,
        cursor: url.searchParams.get("cursor"),
        limit: numberParam(url, "limit")
      });
      return response(200, data);
    }

    return {
      matched: true,
      status: 404,
      body: errorEnvelope(new Error("QA API route not found"))
    };
  } catch (error) {
    const normalized = normalizeQaError(error);
    return { matched: true, status: normalized.status || 500, body: errorEnvelope(normalized) };
  }
}

function response(status, data, envelopeStatus = "succeeded") {
  return { matched: true, status, body: resultEnvelope(data, { status: envelopeStatus }) };
}

function numberParam(url, name) {
  const value = url.searchParams.get(name);
  return value == null || value === "" ? undefined : Number(value);
}
