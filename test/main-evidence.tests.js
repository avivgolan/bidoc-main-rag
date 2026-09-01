import assert from "node:assert/strict";
import { getConfig } from "../src/config.js";
import { buildQaRunSummary } from "../src/qaSummary.js";
import {
  buildCanonicalEvidenceRecords,
  buildCompactMainPayload,
  compactToolResultsForMain,
  MAIN_EVIDENCE_CONTRACT,
  measureMainRequest
} from "../src/mainEvidence.js";

export function registerMainEvidenceTests(test) {
  test("chat payload builds stable canonical evidence IDs, ordering, and source mappings", () => {
    const input = {
      retrievalResults: [
        {
          id: "email-1",
          source_table: "emails",
          title: "Supplier delay notice",
          primary_date: "2026-03-11T08:00:00Z",
          index_text: "The supplier reported that delivery would be delayed by seven days because materials were unavailable.",
          source_url: "https://example.test/email-1",
          rerank_score: 0.94
        },
        {
          id: "meeting-1",
          source_table: "meetings",
          title: "Coordination meeting",
          primary_date: "2026-03-12",
          content: "The meeting recorded the same supplier delivery risk and requested a revised delivery date.",
          source_url: "https://example.test/meeting-1",
          rerank_score: 0.88
        }
      ],
      sources: [
        { title: "Supplier delay notice", url: "https://example.test/email-1" },
        { title: "Coordination meeting", url: "https://example.test/meeting-1" }
      ],
      recordLimit: 12,
      excerptLimit: 600
    };
    const first = buildCanonicalEvidenceRecords(input);
    const second = buildCanonicalEvidenceRecords(input);
    assert.deepEqual(second, first);
    assert.deepEqual(first.records.map((record) => record.source_id), ["S1", "S2"]);
    assert.match(first.records[0].evidence_id, /^EV_[a-f0-9]{14}$/);
    for (const record of first.records) {
      assert.ok(first.sourceMap[record.source_id]);
    }
  });

  test("chat payload collapses URL, typed-record, and repeated-text duplicates", () => {
    const repeatedText = "Repeated indexed evidence about the delayed material delivery and its impact on the project schedule.";
    const result = buildCanonicalEvidenceRecords({
      retrievalResults: [
        { id: "1", source_table: "emails", title: "A", index_text: repeatedText, source_url: "https://example.test/a" },
        { id: "2", source_table: "emails", title: "A duplicate URL", index_text: `${repeatedText} Additional chunk text.`, source_url: "https://example.test/a" },
        { id: "3", source_table: "meetings", source_id: "meeting-3", title: "B", content: "Meeting record with a distinct supported project fact that is long enough for fingerprinting." },
        { id: "4", source_table: "meetings", source_id: "meeting-3", title: "B second chunk", content: "A second chunk from the same typed meeting record with more supported detail." },
        { id: "5", source_table: "alerts", title: "C", content: repeatedText }
      ],
      sources: [{ title: "A", url: "https://example.test/a" }]
    });
    assert.equal(result.stats.inputRecords, 5);
    assert.equal(result.stats.deduplicatedRecords, 2);
    assert.equal(result.stats.duplicatesRemoved, 4);
    assert.equal(result.records.length, 2);
    assert.ok(result.records.some((record) => record.duplicate_chunks_collapsed >= 2));
  });

  test("chat payload retains separate conflicting sources with the same title and date", () => {
    const result = buildCanonicalEvidenceRecords({
      retrievalResults: [
        {
          id: "status-a",
          source_table: "reports",
          title: "Execution status",
          primary_date: "2026-04-01",
          content: "The official report states that execution was completed and accepted by the project manager.",
          source_url: "https://example.test/status-a"
        },
        {
          id: "status-b",
          source_table: "emails",
          title: "Execution status",
          primary_date: "2026-04-01",
          content: "The email states that execution was not completed and still requires corrective work.",
          source_url: "https://example.test/status-b"
        }
      ]
    });
    assert.equal(result.records.length, 2);
    assert.notEqual(result.records[0].evidence_id, result.records[1].evidence_id);
  });

  test("chat payload preserves exact typed facts while removing retrieval and internal fields", () => {
    const compacted = compactToolResultsForMain([
      { toolName: "hybrid_search", ok: true, data: { content: "duplicate retrieval" } },
      {
        toolName: "data_query",
        ok: true,
        data: {
          status: "ok",
          routing: { domain: "content_structured_lookup", intent: "latest" },
          machineResult: {
            metricsByRequestId: { latest_invoice: { amount_numeric: 4150, currency: "ILS" } },
            recordsByRequestId: { latest_invoice: [{ invoice_number: 4816, status: "paid" }] },
            planStatusByRequestId: { latest_invoice: { status: "ok", truncated: false } },
            source_url: "https://secret.example/raw"
          },
          metadata: { private: "metadata-canary" },
          embedding: [0.1, 0.2]
        }
      }
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0].tool_name, "data_query");
    assert.equal(compacted[0].machine_result.metricsByRequestId.latest_invoice.amount_numeric, 4150);
    assert.equal(compacted[0].machine_result.recordsByRequestId.latest_invoice[0].invoice_number, 4816);
    const serialized = JSON.stringify(compacted);
    assert.doesNotMatch(serialized, /duplicate retrieval|metadata-canary|embedding|secret\.example|source_url/);
  });

  test("chat payload retry removes bulky tool details while retaining tool status and source references", () => {
    const hugeToolData = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [
      `finding_${index}`,
      `${"Detailed verified tool finding. ".repeat(80)}${index}`
    ]));
    const result = buildCompactMainPayload({
      userMessage: "Prepare a broad retry report",
      answerMode: "ranked_entity_list",
      retrievalResults: [{
        id: "evidence-1",
        source_table: "emails",
        title: "Supplier delay",
        content: "The supplier confirmed a delivery delay and a revised delivery date.",
        source_url: "https://example.test/evidence-1"
      }],
      toolResults: [{
        toolName: "safety_report",
        ok: true,
        data: hugeToolData,
        sources: [{ title: "Supplier delay", url: "https://example.test/evidence-1" }]
      }],
      systemPrompt: "Grounded report prompt",
      options: { broad: true, budgetTokens: 12000, toolDetail: "minimal" }
    });
    assert.equal(result.payload.tool_results.length, 1);
    assert.equal(result.payload.tool_results[0].tool_name, "safety_report");
    assert.equal(result.payload.tool_results[0].status, "ok");
    assert.equal(result.payload.tool_results[0].verified_facts, undefined);
    assert.equal(result.metrics.evidence.tool_detail, "minimal");
    assert.equal(result.metrics.within_budget, true);
    assert.ok(result.metrics.sections.tools.estimated_tokens < 100);
  });

  test("chat payload sends one bounded evidence representation and no raw duplicate structures", () => {
    const result = buildCompactMainPayload({
      userMessage: "What delayed the supplier?",
      answerMode: "standard_grounded_answer",
      retrievalResults: [{
        id: "delay-1",
        source_table: "emails",
        title: "Delay record",
        primary_date: "2026-03-15",
        index_text: `${"bounded evidence ".repeat(100)}tail-canary`,
        source_url: "https://example.test/delay-1",
        metadata: { internal_canary: "must-not-enter", embedding: [1, 2, 3] }
      }],
      graphContext: [{ source: "Supplier", target: "Delivery", relation: "delayed", evidence: "The supplier confirmed a late delivery." }],
      sources: [{ title: "Delay record", url: "https://example.test/delay-1" }],
      options: { excerptLimit: 360 }
    });
    assert.equal(result.payload.retrieval_context.format, MAIN_EVIDENCE_CONTRACT);
    assert.equal(result.payload.retrieval_results, undefined);
    assert.equal(result.payload.project_graph_findings, undefined);
    assert.equal(result.payload.sources, undefined);
    assert.equal(result.payload.retrieval_context.records.length, 1);
    assert.ok(result.payload.retrieval_context.records[0].evidence_excerpt.length <= 360);
    assert.ok(result.payload.source_map[result.payload.retrieval_context.records[0].source_id]);
    assert.doesNotMatch(JSON.stringify(result.payload), /internal_canary|must-not-enter|embedding|tail-canary/);
  });

  test("chat payload enforces the input budget deterministically while preserving source diversity", () => {
    const tables = ["emails", "meetings", "reports", "alerts", "whatsapp"];
    const retrievalResults = Array.from({ length: 30 }, (_, index) => ({
      id: `record-${index}`,
      source_table: tables[index % tables.length],
      title: `Evidence ${index}`,
      primary_date: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
      content: `Unique evidence ${index}. ${"Substantive project evidence about schedule impact, responsibility, and required action. ".repeat(45)}`,
      source_url: `https://example.test/evidence-${index}`,
      rerank_score: 1 - index / 100
    }));
    const args = {
      userMessage: "Prepare a broad report",
      answerMode: "ranked_entity_list",
      retrievalResults,
      systemPrompt: "Grounded synthesis",
      memory: [{ role: "user", content: "short context" }],
      options: {
        broadRecordLimit: 18,
        excerptLimit: 1200,
        budgetTokens: 4000,
        broad: true
      }
    };
    const first = buildCompactMainPayload(args);
    const second = buildCompactMainPayload(args);
    assert.deepEqual(second, first);
    assert.equal(first.metrics.within_budget, true);
    assert.ok(first.metrics.total.estimated_tokens <= 4000);
    assert.equal(first.metrics.trimmed, true);
    const selectedTables = new Set(first.payload.retrieval_context.records.map((record) => record.source_table));
    assert.ok(selectedTables.size >= 4);
  });

  test("chat payload telemetry shows material reduction and the rollback flag defaults off", () => {
    const retrievalResults = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      source_table: "emails",
      title: `Record ${index + 1}`,
      index_text: `Relevant fact ${index + 1}. ${"Large raw record content. ".repeat(120)}`,
      source_url: `https://example.test/raw-${index + 1}`,
      embedding: Array(1000).fill(index / 10),
      metadata: { raw_payload: "metadata".repeat(500) }
    }));
    const legacyPayload = {
      user_message: "Question",
      answer_mode: "standard_grounded_answer",
      retrieval_context: JSON.stringify(retrievalResults),
      retrieval_results: retrievalResults,
      graph_context: [],
      tool_results: [],
      sources: retrievalResults.map((row) => ({ title: row.title, url: row.source_url }))
    };
    const legacy = measureMainRequest({ systemPrompt: "Prompt", payload: legacyPayload, mode: "legacy" });
    const compact = buildCompactMainPayload({
      userMessage: "Question",
      retrievalResults,
      systemPrompt: "Prompt"
    });
    assert.ok(compact.metrics.total.estimated_tokens < legacy.total.estimated_tokens * 0.25);

    const previous = process.env.MAIN_COMPACT_EVIDENCE_ENABLED;
    delete process.env.MAIN_COMPACT_EVIDENCE_ENABLED;
    try {
      assert.equal(getConfig({ rag: {} }).rag.mainCompactEvidence, false);
      assert.equal(getConfig({ rag: { mainCompactEvidence: true } }).rag.mainCompactEvidence, true);
      process.env.MAIN_COMPACT_EVIDENCE_ENABLED = "";
      assert.equal(getConfig({ rag: { mainCompactEvidence: true } }).rag.mainCompactEvidence, false);
      process.env.MAIN_COMPACT_EVIDENCE_ENABLED = "true";
      assert.equal(getConfig({ rag: {} }).rag.mainCompactEvidence, true);
    } finally {
      if (previous === undefined) delete process.env.MAIN_COMPACT_EVIDENCE_ENABLED;
      else process.env.MAIN_COMPACT_EVIDENCE_ENABLED = previous;
    }
  });

  test("chat payload telemetry is visible to QA without exposing evidence content", () => {
    const payload = {
      contract: MAIN_EVIDENCE_CONTRACT,
      mode: "compact",
      within_budget: true,
      total: { bytes: 24000, estimated_tokens: 6000 },
      evidence: { selected_records: 8, duplicates_removed: 14 }
    };
    const summary = buildQaRunSummary({
      userMessage: "question",
      aiResponse: "answer",
      workflowLog: {
        nodes: [{
          id: "main_agent",
          label: "Main RAG Agent",
          kind: "ai",
          status: "done",
          input: {
            answer_mode: "standard_grounded_answer",
            retrieval_records: 40,
            evidence_records: 8,
            payload_mode: "compact",
            payload_contract: MAIN_EVIDENCE_CONTRACT,
            estimated_input_tokens: 6000,
            input_budget_ok: true,
            duplicate_records_removed: 14,
            retry_estimated_input_tokens: 4200,
            retry_input_budget_ok: true
          },
          output: {
            completion: null,
            sources: []
          }
        }]
      }
    });
    assert.equal(summary.grounding_inputs.payload_contract, MAIN_EVIDENCE_CONTRACT);
    assert.equal(summary.grounding_inputs.evidence_records, 8);
    assert.equal(summary.grounding_inputs.duplicates_removed, 14);
    assert.equal(summary.grounding_inputs.input_budget_ok, true);
    assert.equal(summary.grounding_inputs.retry_estimated_input_tokens, 4200);
    assert.equal(summary.grounding_inputs.retry_input_budget_ok, true);
    assert.doesNotMatch(JSON.stringify(summary.grounding_inputs), /project evidence|evidence_excerpt/);
  });
}
