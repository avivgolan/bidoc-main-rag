# Financial transaction-type vocabulary and routing checkpoint

Date: 2026-07-28

## Scope and safety boundary

This checkpoint promotes the stored `financial_transactions.transaction_type` vocabulary into controlled application code. It does not alter the database, table schema, rows, RLS, roles, grants, or permissions. The database was inspected read-only to inventory the values.

Specific factual questions about one transaction type use the exact Data Query route. Questions asking for document meaning, explanation, evidence, supplier-specific interpretation, cross-type insight, analysis, or an overview remain on semantic retrieval (or a deliberately combined route where one exists).

## Read-only live inventory

The audited project currently contains 108 financial-document rows, 19 raw stored values, and 18 canonical business concepts. The difference is the stored typo `חשבבון חלקי`, which is intentionally included under the canonical `חשבון חלקי` concept without changing the source row.

| Canonical concept | Raw stored value(s) | Current rows | Reviewed query forms (examples) | Routing qualification |
| --- | --- | ---: | --- | --- |
| Partial account | `חשבון חלקי`, `חשבבון חלקי` | 38 (37 + 1) | חשבון חלקי, חשבונות חלקיים, חשבבון חלקי, חשבבונות חלקיים, חשבון ביניים, partial/interim/progress account | Direct |
| Invoice | `חשבונית` | 24 | חשבונית, חשבוניות, חשבונית מס, חשבנית, invoice, tax invoice, supplier invoice | Direct |
| Price quote | `הצעת מחיר` | 19 | הצעת מחיר, הצעות מחיר, הצאות מחיר, price quote, quotation, cost estimate | Direct |
| Receipt | `קבלה` | 7 | קבלה, קבלות, receipt, payment receipt | Direct |
| Purchase request | `דרישת רכש` | 4 | דרישת/בקשת רכש, purchase/procurement request, purchase requisition | Direct |
| Purchase order | `הזמנת רכש` | 3 | הזמנת רכש, הזמנת קניה, purchase/procurement order | Direct |
| Execution account | `חשבון ביצוע` | 2 | חשבון ביצוע, חשבון עבודות, execution/work account | Direct |
| Purchase | `Purchase` | 1 | רכישה, רכישות, purchase, purchases | Direct |
| Bank-guarantee extension request | `בקשה להארכת ערבות בנקאית` | 1 | הארכת ערבות בנקאית, bank guarantee extension/request | Direct |
| Profit-and-loss report | `דו"ח רווח והפסד` | 1 | דוח/דו"ח רווח והפסד, P&L/PNL report, profit and loss report | Direct |
| Training transaction | `הדרכה` | 1 | הדרכה, training transaction | Explicit financial type required |
| Order | `הזמנה` | 1 | הזמנה, order | Explicit financial type required; distinct from purchase order |
| Transfer | `העברה` | 1 | העברה בנקאית, transfer, bank transfer | Explicit financial type required |
| Unknown stored type | `הש` | 1 | סוג עסקה הש, סוג מסמך הש, transaction type hs | Exact-only; never guessed |
| Rental | `השכרה` | 1 | השכרה, דמי שכירות, rental transaction | Explicit financial type required |
| Contract balance | `יתרת הסכם` | 1 | יתרת הסכם/חוזה, contract/agreement balance | Direct |
| Additional work | `עבודות נוספות` | 1 | עבודה/עבודות נוספות, additional/extra work | Explicit financial type required because exceptions use similar language |
| Additional costs | `עלויות נוספות` | 1 | עלות/עלויות נוספות, additional/extra cost | Explicit financial type required because exceptions use similar language |

The full alias arrays are the executable source of truth in `src/subagents/dataQueryFinancialLexicon.js`. Matching is controlled and explicit; arbitrary fuzzy edit distance is not used because it could merge adjacent types such as `הזמנה`, `הזמנת רכש`, and `דרישת רכש`.

## Exact behavior

- Count, group, latest, earliest, date-scoped, and complete-list questions for a recognized type create one deterministic filter on `transaction_type`.
- A canonical type with one stored value uses `eq`. Partial accounts use `in` with both `חשבון חלקי` and `חשבבון חלקי`.
- “Show/list/give me all” variants use `lookup_last_n`, stable descending `transaction_date, id` ordering, and a dedicated maximum of 200 rows.
- The current table and every current type fit below that bound. If a future type exceeds 200 rows, the answer must state the exact matching cardinality and clearly label the displayed list as incomplete.
- Exact list enrichment reads the same returned IDs in bounded batches and can resolve document links through the existing attachment lookup.
- The response layer displays the typo row as canonical `חשבון חלקי`. An overall breakdown also combines 37 + 1 into one 38-row canonical category.
- Any unknown `transaction_type` value is rejected by the managed read validation until it is audited and intentionally added to the vocabulary.
- Routing, tool selection, classifier date scope, and execution reuse one request-scoped Data Query settings snapshot. They must not independently recalculate table availability during one chat run.
- If an exact financial Data Query fails, the response fails closed and explicitly refuses to substitute semantic-search fragments for an exact count or complete list.

## Semantic and ambiguity behavior

| Request | Route |
| --- | --- |
| “How many partial accounts are there?” | Exact Data Query |
| “List all price quotes” | Exact Data Query |
| “What is the latest receipt?” | Exact Data Query |
| “What is written in the latest partial account?” | Semantic retrieval; asks about content, not stored metadata |
| “Why was this invoice rejected?” | Semantic retrieval/evidence |
| “Give me insights across all financial documents” | Semantic retrieval, optionally combined with exact metadata elsewhere |
| “Show all additional work” | Fail closed and request a financial-type qualifier |
| “Show all financial transactions of type additional work” | Exact Data Query |

## Manual UI regression matrix

Run each question in a fresh chat so prior conversation memory cannot influence routing.

| Question | Expected result |
| --- | --- |
| `כמה חשבונות חלקיים יש בפרויקט?` | Exact Data Query; **38** partial accounts. |
| `תמנה לי את כל החשבונות החלקיים שיש בפרויקט` | Exact Data Query; **38** detailed rows, newest first; the stored typo is included and displayed canonically. |
| `תן לי את כל החשבונות החלקיים` | Same complete 38-row result. |
| `Give me the partial accounts` | Same complete 38-row result in English. |
| `כמה הצעות מחיר יש?` | Exact count: **19**. |
| `List all price quotes` | Exact list: **19**; must not be mistaken for a citation request. |
| `כמה דרישות רכש יש?` | Exact count: **4**. |
| `כמה הזמנות רכש יש?` | Exact count: **3**; must not include the generic `הזמנה` row. |
| `כמה חשבונות ביצוע יש?` | Exact count: **2**, even though both source dates are null. |
| `כמה מסמכים פיננסיים יש לפי סוג?` | Exact total: **108**; partial account appears once with **38**, and `חשבבון חלקי` is not a separate label. |
| `תמנה לי את כל העבודות הנוספות` | Fail closed and ask to clarify that the request means the financial transaction type. |
| `תמנה לי את כל העסקאות מסוג עבודות נוספות` | Exact list: **1** financial row. |
| `מהו החשבון החלקי האחרון?` | Exact latest-type lookup with detailed fields and a document link when available. |
| `מה כתוב בחשבון החלקי האחרון?` | Semantic route because the request asks about document content. |
| `תן לי תובנות על כל החשבונות החלקיים` | Semantic route; exact-only retrieval must not replace the requested analysis. |

For exact questions, the workflow should run only `data_query` and skip generic hybrid search/reranking and `financial_transactions`. The deterministic route must not call the Data Query LLM planner. For semantic questions, hybrid/semantic retrieval is expected. A classifier label of `RAG` alone does not prove the final route; inspect the downstream Data Query and retrieval events.

## Automated verification

The protected Data Query suite covers:

- all 19 raw stored values and all 18 canonical concepts;
- every alias in the executable dictionary;
- exact count and complete-list routing for every canonical concept;
- the combined partial-account `in` filter;
- the price-quote/citation collision;
- 38-row complete-list execution and deterministic formatting;
- batched exact enrichment above the ordinary 25-row list bound;
- canonicalized type breakdowns;
- semantic precedence and cross-domain fail-closed behavior;
- request-scoped routing/execution consistency and exact-financial failure isolation from semantic results;
- all pre-existing Data Query phases and contracts.
