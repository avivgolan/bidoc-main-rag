import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACTS_MACHINE_REVIEWER_FALLBACK_ID,
  isContractsMachineIngestPath,
  resolveContractsReviewerId
} from "../src/apiSecurity.js";

test("file-classify machine ingest paths include extract persist and automatic steps", () => {
  assert.equal(isContractsMachineIngestPath("POST", "/api/contracts/clauses/workspaces/extract"), true);
  assert.equal(
    isContractsMachineIngestPath("POST", "/api/contracts/automatic/workspaces/11111111-1111-4111-8111-111111111111/steps/explicit"),
    true
  );
  assert.equal(isContractsMachineIngestPath("GET", "/api/contracts/clauses/workspaces"), false);
  assert.equal(isContractsMachineIngestPath("POST", "/api/contracts/decisions/workspaces/x/auto-review"), false);
});

test("machine ingest uses the dedicated reviewer unless a session is present", () => {
  assert.equal(
    resolveContractsReviewerId(
      { headers: { "x-contracts-ingestion-secret": "expected" } },
      null,
      { CONTRACTS_INGESTION_SECRET: "expected", BIDOC_API_SECRET: "" }
    ),
    CONTRACTS_MACHINE_REVIEWER_FALLBACK_ID
  );
  assert.equal(
    resolveContractsReviewerId(
      { headers: { "x-contracts-ingestion-secret": "expected" } },
      { sub: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
      { CONTRACTS_INGESTION_SECRET: "expected" }
    ),
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  );
});
