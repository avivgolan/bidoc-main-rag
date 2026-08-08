# Data Query Agent Phase 4H - consultant reports

Status: Phase 4H complete locally through the authenticated 4H.3 UI matrix.

## 4H.1 read-only audit

- `public.consultants_reports`: 1 row, 1 project, stable positive bigint `id=6`.
- Canonical business date: `report_date` (`2024-11-07T00:00:00Z`). `created_at` remains ingestion-only.
- Approved exact fields: `report_date` and stored `item_status` (`בטיפול`).
- Approved exact operations: count, date-scoped count, undated count, item-status group, day/month series, latest, earliest, and bounded last-N.
- Excluded exact dimensions: consultant identity, specialization, report topic, recommendations, proposed actions, implementation status, filenames, source identifiers, narrative fields, and embeddings. Company names may appear in same-report semantic narrative, but they are not approved exact grouping dimensions.
- `implementation_status` is blank; `item_status` does not prove approval, completion, or implementation.
- `public.consultants_reports_documents`: 18 chunks with matching source, project, attachment, document, and canonical date identity.

No Content data, schema, RPC, migration, role, grant, RLS, Auth/Supabase setting, production configuration, or deployment was changed.

## 4H.2 implementation

- Added the fixed typed `consultants_reports` managed-read policy.
- Added centralized Hebrew aliases, negative grammar, and the consultant-people ambiguity guard.
- Added deterministic bilingual exact routing and answers.
- Added same-report semantic evidence retrieval, attested by report, project, and attachment identity.
- Client/workflow projections redact internal identities and raw evidence.
- Unsupported identity/category/implementation/ingestion requests fail closed.

Verification:

- Phase 4H focused: 1/1 test group passed.
- Protected Data Query suite: 123/123 passed.
- Full suite: no new failure; the existing 11 unrelated Settings/Workflow/Timeline UI failures remain.

## 4H.3 authenticated UI matrix

Completed on 2026-08-01 against the local backend at `http://localhost:4000/` with the backend running outside the sandbox. Observed results:

1. `כמה דוחות יועצים יש?` / `How many consultant reports are there?` -> exactly 1.
2. `מהו דוח היועץ האחרון?` / `Show the latest consultant report.` -> report date 07.11.2024 and stored status `בטיפול`.
3. latest/earliest/last-five in both languages -> canonical `report_date` ordering only.
4. `הצג את דוח היועץ האחרון וסכם את ההמלצות שלו` and the English equivalent -> exact metadata plus recommendations from that same report only.
5. Stored-status grouping, undated counts, and monthly trend returned `בטיפול: 1`, 0 undated rows, and `2024-11: 1` plus an undated zero bucket.
6. `כמה יועצים יש?` / `How many consultants are there?` fail closed without semantic retrieval or names.
7. Grouping by consultant or specialization, implementation/completion, and `created_at`/ingestion-time requests fail closed in Hebrew and English with the approved explanation.

The live matrix exposed and closed four response-quality gaps: singular English count grammar, Hebrew status-group phrasing, consultant-people semantic fallthrough, Hebrew implementation morphology, and report-first ingestion-time word order. Same-report summaries are forced into the user's language; report/document numbers, version numbers, emails, URLs, and internal identifiers are redacted. Company names remain allowed in semantic narrative.

Do not start Phase 4I without separate approval.
