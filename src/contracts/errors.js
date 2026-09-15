export class ContractsAgentError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "ContractsAgentError";
    this.code = code;
    this.status = status;
    this.issueCodes = Array.isArray(options.issueCodes) ? options.issueCodes : [];
    this.details = options.details && typeof options.details === "object" && !Array.isArray(options.details)
      ? options.details
      : null;
  }
}

export function contractsErrorResponse(error) {
  if (error instanceof ContractsAgentError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
        ...(error.issueCodes.length ? { issueCodes: error.issueCodes } : {}),
        ...(error.details ? { details: error.details } : {})
      }
    };
  }
  return {
    status: 500,
    body: {
      error: "contracts_internal_error",
      message: "Contract extraction failed."
    }
  };
}
