import assert from "node:assert/strict";
import { MAIN_CITATION_CONTRACT, resolveMainAnswerCitations } from "../src/mainCitations.js";
import { renderChatMarkdown } from "../public/chatMarkdown.js";
import { hydrateRetrievedSourceLinks, indexedSourceLinkReadPath } from "../src/sourceLinks.js";
import { hybridSearch } from "../src/supabase.js";

export function registerMainCitationTests(test) {
  test("chat citations restore omitted index URLs only for the exact returned source identity", async () => {
    const original = { id: 10, source_table: "emails", source_id: "opaque-mail-id", content: "Evidence stays unchanged" };
    const alreadyLinked = { id: 20, source_table: "emails", source_id: "mail-20", source_url: "https://example.test/existing" };
    const result = await hydrateRetrievedSourceLinks({
      results: [original, alreadyLinked], projectId: "project-a",
      readIndexRows: async (ids) => {
        assert.deepEqual(ids, ["10"]);
        return [{ id: 10, source_table: "emails", source_id: "opaque-mail-id", project_id: "project-a", source_url: "https://example.test/email" }];
      }
    });
    assert.equal(result[0].source_url, "https://example.test/email");
    assert.equal(result[0].content, original.content);
    assert.equal(original.source_url, undefined);
    assert.equal(result[1], alreadyLinked);
  });

  test("chat citations reject index URL identity and project mismatches", async () => {
    const rows = [
      { id: 10, source_table: "emails", source_id: "mail-10" },
      { id: 11, source_table: "emails", source_id: "mail-11" },
      { id: 12, source_table: "emails", source_id: "mail-12" }
    ];
    const result = await hydrateRetrievedSourceLinks({
      results: rows, projectId: "project-a",
      readIndexRows: async () => [
        { id: 10, source_table: "emails", source_id: "other-mail", project_id: "project-a", source_url: "https://example.test/wrong-source" },
        { id: 11, source_table: "emails", source_id: "mail-11", project_id: "project-b", source_url: "https://example.test/wrong-project" },
        { id: 12, source_table: "emails", source_id: "mail-12", project_id: "project-a", source_url: "https://user:secret@example.test/unsafe" }
      ]
    });
    assert.deepEqual(result, rows);
  });

  test("chat citations keep source-link reads bounded, read-only, and non-fatal", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, source_table: "emails", source_id: `mail-${i}` }));
    const batchSizes = [];
    const result = await hydrateRetrievedSourceLinks({
      results: rows,
      readIndexRows: async (ids) => { batchSizes.push(ids.length); throw new Error("metadata read unavailable"); }
    });
    assert.deepEqual(batchSizes, [50, 50, 20]);
    assert.deepEqual(result, rows);
    const path = indexedSourceLinkReadPath({ table: "data_index", ids: ["1", "2"], projectId: "project-a" });
    assert.equal(path, "/rest/v1/data_index?select=id,source_table,source_id,project_id,source_url&id=in.(1,2)&project_id=eq.project-a&limit=2");
    assert.throws(() => indexedSourceLinkReadPath({ table: "data_index?select=*", ids: ["1"] }), /Invalid/);
    assert.throws(() => indexedSourceLinkReadPath({ table: "data_index", ids: ["1),id.gt.0"] }), /exact index IDs/);
  });

  test("chat citations hydrate live retrieval shapes only when compact mode is enabled", async () => {
    const oldFetch = globalThis.fetch;
    let linkReads = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes("/embeddings")) return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 });
      if (String(url).includes("/rpc/test_hybrid")) return new Response(JSON.stringify([{ id: 10, source_table: "emails", source_id: "mail-10", content: "Retrieved evidence" }]), { status: 200 });
      assert.match(String(url), /\/rest\/v1\/data_index\?select=id,source_table,source_id,project_id,source_url/);
      assert.equal(options.method, undefined);
      linkReads += 1;
      return new Response(JSON.stringify([{ id: 10, source_table: "emails", source_id: "mail-10", project_id: "project-a", source_url: "https://example.test/email" }]), { status: 200 });
    };
    const config = {
      openRouterApiKey: "test-key", projectId: "project-a",
      models: { embedding: "openai/text-embedding-3-large" },
      retrieval: { candidates: 5, vectorWeight: 0.65, keywordWeight: 0.35 },
      contentSource: { supabaseUrl: "https://content.test", supabaseServiceRoleKey: "test-key", hybridRpcName: "test_hybrid", indexTable: "data_index" },
      rag: { mainCompactEvidence: false }
    };
    try {
      const legacy = await hybridSearch({ config, query: "test" });
      assert.equal(legacy[0].source_url, undefined);
      assert.equal(linkReads, 0);
      const compact = await hybridSearch({ config: { ...config, rag: { mainCompactEvidence: true } }, query: "test" });
      assert.equal(compact[0].source_url, "https://example.test/email");
      assert.equal(linkReads, 1);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  test("chat citations resolve canonical source IDs into verified inline links", () => {
    const result = resolveMainAnswerCitations([
      "- הספק הודיע על עיכוב של שבוע. [Source: S1]",
      "- ההחלטה אושרה בישיבה. [מקור: S2]"
    ].join("\n"), {
      sourceMap: {
        S1: { title: "הודעת הספק", source_table: "emails", url: "https://example.test/email-1" },
        S2: { title: "ישיבת תיאום", source_table: "meetings", url: "https://example.test/meeting-1" }
      }
    });

    assert.match(result.answer, /\[מקור: הודעת הספק\]\(https:\/\/example\.test\/email-1\)/u);
    assert.match(result.answer, /\[מקור: ישיבת תיאום\]\(https:\/\/example\.test\/meeting-1\)/u);
    assert.equal(result.metrics.contract, MAIN_CITATION_CONTRACT);
    assert.equal(result.metrics.status, "passed");
    assert.equal(result.metrics.resolved_by_source_id, 2);
    assert.equal(result.metrics.markdown_links_after, 2);
    assert.equal(result.metrics.uncited_bullet_lines, 0);
  });

  test("chat citations resolve exact legacy title markers including parentheses", () => {
    const result = resolveMainAnswerCitations(
      "- נמצאה דרישה לעדכון לוח הזמנים. (מקור: מייל עדכון ספק, 12.05.2026)",
      {
        sources: [{ title: "מייל עדכון ספק", url: "https://example.test/supplier-update" }]
      }
    );

    assert.match(result.answer, /\[מקור: מייל עדכון ספק\]\(https:\/\/example\.test\/supplier-update\)/u);
    assert.equal(result.metrics.resolved_by_title, 1);
    assert.equal(result.metrics.status, "passed");
  });

  test("chat citations never guess a record from an ambiguous source category", () => {
    const result = resolveMainAnswerCitations("- נמצאה בקשה חדשה. (מקור: emails)", {
      sourceMap: {
        S1: { title: "מייל ראשון", source_table: "emails", url: "https://example.test/email-1" },
        S2: { title: "מייל שני", source_table: "emails", url: "https://example.test/email-2" }
      }
    });

    assert.equal(result.answer, "- נמצאה בקשה חדשה. (מקור לא זמין)");
    assert.equal(result.metrics.resolved_citations, 0);
    assert.equal(result.metrics.unresolved_citations, 1);
    assert.equal(result.metrics.status, "warning");
  });

  test("chat citations remove non-canonical model links in compact mode", () => {
    const result = resolveMainAnswerCitations(
      "- טענה עם [קישור מומצא](https://untrusted.example/fake). [Source: S1]",
      {
        sourceMap: {
          S1: { title: "מסמך מאומת", source_table: "documents", url: "https://example.test/verified" }
        }
      }
    );

    assert.doesNotMatch(result.answer, /untrusted\.example/u);
    assert.match(result.answer, /\[מקור: מסמך מאומת\]\(https:\/\/example\.test\/verified\)/u);
    assert.equal(result.metrics.invalid_links_removed, 1);
    assert.equal(result.metrics.status, "warning");
  });

  test("chat citations preserve verified existing links and flag uncited bullets", () => {
    const result = resolveMainAnswerCitations([
      "- טענה נתמכת. [למסמך](https://example.test/verified)",
      "- טענה נוספת ללא ציטוט."
    ].join("\n"), {
      sourceMap: {
        S1: { title: "מסמך מאומת", source_table: "documents", url: "https://example.test/verified" }
      }
    });

    assert.match(result.answer, /\[למסמך\]\(https:\/\/example\.test\/verified\)/u);
    assert.equal(result.metrics.markdown_links_before, 1);
    assert.equal(result.metrics.markdown_links_after, 1);
    assert.equal(result.metrics.uncited_bullet_lines, 1);
    assert.equal(result.metrics.status, "warning");
  });

  test("chat citations do not fabricate a link when a mapped source has no URL", () => {
    const result = resolveMainAnswerCitations("- תיעוד ישיבה ללא קישור. [Source: S1]", {
      sourceMap: {
        S1: { title: "ישיבת שטח", source_table: "meetings", url: null }
      }
    });

    assert.equal(result.answer, "- תיעוד ישיבה ללא קישור. (מקור: ישיבת שטח, ללא קישור ישיר)");
    assert.equal(result.metrics.unavailable_citations, 1);
    assert.equal(result.metrics.identified_citations, 1);
    assert.equal(result.metrics.markdown_links_after, 0);
    assert.equal(result.metrics.status, "unavailable");
  });

  test("chat citations keep canonical URL validation scoped to the active source map", () => {
    const result = resolveMainAnswerCitations("- A supported fact. [Source: S1] [Other](https://example.test/outside-map)", {
      sourceMap: { S1: { title: "Verified", url: "https://example.test/verified" } },
      sources: [{ title: "Outside map", url: "https://example.test/outside-map" }]
    });
    assert.doesNotMatch(result.answer, /outside-map/u);
    assert.match(result.answer, /\[Source: Verified\]\(https:\/\/example\.test\/verified\)/u);
    assert.equal(result.metrics.invalid_links_removed, 1);
  });

  test("chat citations reject unsafe URLs and never expose unknown internal source IDs", () => {
    const result = resolveMainAnswerCitations("- A factual finding. [Source: S99] [Unsafe](javascript:alert) [Credential](https://user:secret@example.test/a)", {
      sourceMap: { S1: { title: "Unsafe source", url: "javascript:alert" } }
    });
    assert.doesNotMatch(result.answer, /S99|javascript:|secret@/u);
    assert.equal(result.metrics.unresolved_citations, 1);
    assert.equal(result.metrics.invalid_links_removed, 2);
  });

  test("chat citations do not treat a natural parenthetical origin as a source marker", () => {
    const result = resolveMainAnswerCitations("**ספק תקרות (מקור: אוקראינה)**\n- דווח על עיכוב באספקה. [Source: S1]", {
      sourceMap: { S1: { title: "הודעת עיכוב", url: "https://example.test/notice" } }
    });
    assert.match(result.answer, /\(מקור: אוקראינה\)/u);
    assert.equal(result.metrics.citation_markers_found, 1);
    assert.equal(result.metrics.unresolved_citations, 0);
  });

  test("chat citations render multi-source markers as clickable anchors in the existing chat renderer", () => {
    const result = resolveMainAnswerCitations("- Two records support this finding. [Source: S1, S2]", {
      sourceMap: {
        S1: { title: "Report one", url: "https://example.test/report(1)" },
        S2: { title: "Report two", url: "https://example.test/report-2" }
      }
    });
    const html = renderChatMarkdown(result.answer);
    assert.equal(result.metrics.resolved_citations, 2);
    assert.equal(result.metrics.markdown_links_after, 2);
    assert.match(html, /href="https:\/\/example\.test\/report%281%29"/u);
    assert.match(html, /href="https:\/\/example\.test\/report-2"/u);
    assert.equal(result.metrics.status, "passed");
  });
}
