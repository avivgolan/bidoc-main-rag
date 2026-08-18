import { CONTRACTS_MAX_RESPONSE_BYTES } from "./constants.js";
import { ContractsAgentError } from "./errors.js";

export function serializeContractsResponse(value, { maxBytes = CONTRACTS_MAX_RESPONSE_BYTES } = {}) {
  const body = Buffer.from(JSON.stringify(value, null, 2), "utf8");
  if (body.byteLength > maxBytes) {
    throw new ContractsAgentError(
      "contracts_response_too_large",
      "The canonical Contracts response exceeded the Phase 1 output limit.",
      502,
      { issueCodes: ["canonical_output.response_too_large"] }
    );
  }
  return body;
}

export function sendContractsJson(res, status, value, options) {
  const body = serializeContractsResponse(value, options);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
