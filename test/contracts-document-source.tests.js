import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  RESOLVED_CONTRACT_BYTES,
  resolveContractDocumentSource,
  validateContractPdfUrl
} from "../src/contracts/documentSource.js";
import { parseContractExtractionRequest } from "../src/contracts/request.js";
import {
  CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";
import { buildContractsClauseGeneration } from "../src/contracts/clauseParser.js";

const SIGNED = "https://zptgoppfhipnlvanodnc.supabase.co/storage/v1/object/sign/project-files/p1/email-attachments/abc.pdf?token=signed.jwt.value";
const PDF = Buffer.from("%PDF-1.7\n" + "x".repeat(64), "utf8");
const FIXTURE_SHA = "a".repeat(64);

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    }
  });
}

function storage({ status = 200, chunks = [PDF], headers = {}, fail = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (fail) throw fail;
    return new Response(status === 200 ? streamOf(chunks) : "nope", { status, headers });
  };
  return { fetchImpl, calls };
}

const baseBody = (extra = {}) => ({
  filename: "חוזה.pdf",
  mediaType: "application/pdf",
  mode: "dry_run",
  sourceId: "attachment-1",
  ...extra
});

export function registerContractsDocumentSourceTests(test) {
  test("contracts pdfUrl accepts only Supabase Storage signed object URLs", () => {
    assert.equal(validateContractPdfUrl(SIGNED, { env: {} }).hostname, "zptgoppfhipnlvanodnc.supabase.co");
    const rejected = [
      SIGNED.replace("https:", "http:"),
      SIGNED.replace("zptgoppfhipnlvanodnc.supabase.co", "evil.example.com"),
      SIGNED.replace("zptgoppfhipnlvanodnc.supabase.co", "supabase.co.evil.example.com"),
      SIGNED.replace("zptgoppfhipnlvanodnc.supabase.co", "169.254.169.254"),
      SIGNED.replace("https://", "https://user:pass@"),
      SIGNED.replace(".supabase.co/", ".supabase.co:8443/"),
      SIGNED.replace("/object/sign/", "/object/public/"),
      SIGNED.replace("/object/sign/", "/object/authenticated/"),
      SIGNED.split("?")[0],
      "/storage/v1/object/sign/project-files/a.pdf?token=x",
      42
    ];
    for (const value of rejected) {
      assert.throws(
        () => validateContractPdfUrl(value, { env: {} }),
        (error) => error.code === "contracts_pdf_url_invalid" && error.status === 400,
        String(value)
      );
    }
    const custom = "https://files.bidoc.example/storage/v1/object/sign/project-files/a.pdf?token=t";
    assert.throws(() => validateContractPdfUrl(custom, { env: {} }), (error) => error.code === "contracts_pdf_url_invalid");
    assert.equal(
      validateContractPdfUrl(custom, { env: { CONTRACTS_PDF_URL_ALLOWED_HOSTS: "files.bidoc.example" } }).hostname,
      "files.bidoc.example"
    );
  });

  test("contracts pdfUrl is fetched without redirects and parsed like posted base64", async () => {
    const { fetchImpl, calls } = storage({ chunks: [PDF.subarray(0, 10), PDF.subarray(10)] });
    const sha = crypto.createHash("sha256").update(PDF).digest("hex");
    const resolved = await resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED, pdfSha256: sha }), { fetchImpl, env: {} });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, SIGNED);
    assert.equal(calls[0].init.redirect, "error");
    assert.equal("pdfUrl" in resolved, false);
    assert.equal("pdfSha256" in resolved, false);
    assert.deepEqual(resolved[RESOLVED_CONTRACT_BYTES], PDF);
    assert.equal(JSON.stringify(resolved).includes("token"), false);

    const parsed = parseContractExtractionRequest(resolved);
    assert.deepEqual(parsed.pdfBytes, PDF);
    assert.equal(parsed.mediaType, "application/pdf");
    assert.equal(parsed.sourceId, "attachment-1");
    // R3.2 persistence re-spreads the body with mode=dry_run; the resolved bytes survive the spread.
    assert.deepEqual(parseContractExtractionRequest({ ...resolved, mode: "dry_run" }).pdfBytes, PDF);
  });

  test("contracts pdfBase64 bodies are unchanged and pdfUrl cannot reach the parser unresolved", async () => {
    const legacy = baseBody({ pdfBase64: PDF.toString("base64") });
    const { fetchImpl, calls } = storage();
    assert.equal(await resolveContractDocumentSource(legacy, { fetchImpl, env: {} }), legacy);
    assert.equal(calls.length, 0);
    assert.deepEqual(parseContractExtractionRequest(legacy).pdfBytes, PDF);

    assert.throws(
      () => parseContractExtractionRequest(baseBody({ pdfUrl: SIGNED })),
      (error) => error.code === "contracts_pdf_url_unresolved" && error.status === 400
    );
    // A JSON field cannot forge resolved bytes.
    assert.throws(
      () => parseContractExtractionRequest(baseBody({ pdfBytes: [37, 80, 68, 70, 45] })),
      (error) => error.code === "contracts_request_unknown_field"
    );
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED, pdfBase64: PDF.toString("base64") }), { fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_source_ambiguous" && error.status === 400
    );
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfBase64: "AAAA", pdfSha256: FIXTURE_SHA }), { fetchImpl, env: {} }),
      (error) => error.code === "contracts_request_unknown_field"
    );
    assert.equal(calls.length, 0);
  });

  test("contracts pdfUrl fetch is size-capped and maps storage failures to retryable or permanent statuses", async () => {
    const declared = storage({ headers: { "content-length": "999" } });
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED }), { fetchImpl: declared.fetchImpl, env: {}, maxBytes: 100 }),
      (error) => error.code === "contracts_pdf_too_large" && error.status === 413
    );
    const streamed = storage({ chunks: [Buffer.alloc(60, 1), Buffer.alloc(60, 1)] });
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED }), { fetchImpl: streamed.fetchImpl, env: {}, maxBytes: 100 }),
      (error) => error.code === "contracts_pdf_too_large" && error.status === 413
    );
    const expired = storage({ status: 400 });
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED }), { fetchImpl: expired.fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_url_rejected" && error.status === 422 && !error.message.includes("token")
    );
    const down = storage({ status: 503 });
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED }), { fetchImpl: down.fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_url_fetch_failed" && error.status === 502
    );
    const offline = storage({ fail: new TypeError("fetch failed") });
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED }), { fetchImpl: offline.fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_url_fetch_failed" && error.status === 502
    );
    const swapped = storage();
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: SIGNED, pdfSha256: FIXTURE_SHA }), { fetchImpl: swapped.fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_sha256_mismatch" && error.status === 422
    );
    const invalid = storage();
    await assert.rejects(
      resolveContractDocumentSource(baseBody({ pdfUrl: "https://example.com/a.pdf" }), { fetchImpl: invalid.fetchImpl, env: {} }),
      (error) => error.code === "contracts_pdf_url_invalid"
    );
    assert.equal(invalid.calls.length, 0);
  });

  test("contracts machine ingest routes resolve pdfUrl before parsing", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    for (const route of ["/api/contracts/extract", "/api/contracts/clauses/preview", "/api/contracts/clauses/workspaces/extract"]) {
      const start = server.indexOf(`req.method === "POST" && url.pathname === "${route}"`);
      assert.ok(start > 0, route);
      const block = server.slice(start, start + 900);
      assert.match(block, /resolveContractDocumentSource\(await readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)\)/u, route);
    }
    assert.match(server, /resolveContractDocumentSource\(rawBody\.extractionRequest\)/u);
  });

  test("contracts R3 replaces an invalid model summary from source after repair instead of failing the contract", async () => {
    const generation = buildContractsClauseGeneration({
      pages: [{ pdfPage: 1, text: "1. הוראות כלליות\n1.1. הקבלן יבצע את העבודה לפי ההסכם." }],
      documentVersionId: `sha256:${FIXTURE_SHA}`,
      documentSha256: FIXTURE_SHA
    });
    let calls = 0;
    const enriched = await runContractsClauseEnrichment({
      generation,
      config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
      chatComplete: async ({ messages }) => {
        calls += 1;
        const input = JSON.parse(messages[1].content);
        return JSON.stringify({
          schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
          items: input.clauses.map((clause, index) => ({
            clauseKey: clause.clauseKey,
            // First clause: an English summary (no Hebrew) on the call and on its repair.
            summaryHe: index === 0 ? "General provisions of the agreement." : "הסעיף מחייב את הקבלן לבצע את העבודה לפי ההסכם.",
            tags: ["scope"]
          }))
        });
      }
    });
    assert.equal(calls, 2);
    assert.equal(enriched.qualityLedger.accepted, true);
    assert.equal(enriched.qualityLedger.modelRepairCount, 1);
    assert.equal(enriched.qualityLedger.deterministicFallbackClauseCount, 1);
    assert.match(enriched.clauses[0].summaryHe, /הוראות כלליות/u);
    assert.match(enriched.clauses[1].summaryHe, /הקבלן/u);
  });

  test("contracts R3 falls back when numeric sanitization leaves a summary too short", async () => {
    const generation = buildContractsClauseGeneration({
      pages: [{ pdfPage: 1, text: "1. הוראות כלליות לביצוע העבודה." }],
      documentVersionId: `sha256:${FIXTURE_SHA}`,
      documentSha256: FIXTURE_SHA
    });
    const enriched = await runContractsClauseEnrichment({
      generation,
      config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
      // "סעיף 99": 99 is not in the source, so sanitization leaves "סעיף" (4 characters).
      chatComplete: async ({ messages }) => JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: JSON.parse(messages[1].content).clauses.map((clause) => ({ clauseKey: clause.clauseKey, summaryHe: "סעיף 99", tags: ["scope"] }))
      })
    });
    assert.equal(enriched.qualityLedger.deterministicFallbackClauseCount, 1);
    assert.match(enriched.clauses[0].summaryHe, /הוראות כלליות/u);
  });
}
