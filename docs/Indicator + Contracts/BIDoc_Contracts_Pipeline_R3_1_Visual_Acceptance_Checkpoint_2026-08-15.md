# BIDoc Contracts Pipeline R3.1 — Visual Acceptance Checkpoint

- Date: 2026-08-15
- Branch: `feature/contracts-indicator-schedule-intelligence`
- Starting HEAD: `b62ad04983e0`
- Approval: separately approved by the user after R3 completion
- Status: implementation and automated verification complete; superseded by the separately approved R3.2 durable-save follow-up before authenticated manual visual acceptance
- Stop gate: R4 Contracts Relationships Agent work is not approved and has not started

## 1. Outcome

R3.1 adds a visual, no-write view of the completed Contracts Agent output to the existing Contracts tab. A user selects a PDF and clicks **הצג את כל תוצאת סוכן החוזים**. The server runs the accepted R2 parser and R3 enrichment pipeline and returns every logical record to the browser without persisting the PDF or result.

Each expandable clause card exposes:

- stable clause key, type, parent, and page span;
- exact original source text and its SHA-256;
- grounded Hebrew summary and controlled tags;
- explicit clause/appendix reference observations with resolved or unresolved state;
- generated shared-search content and its SHA-256;
- parser/enrichment processing state and generation identifiers.

The page also shows source-line coverage, numbered-unit and clause-type counts, cross-page count, reference count, and error count. Search, type, tag, and references-only filters operate over the complete returned clause set.

## 2. Classic Contracts Agent comparison

The previous extraction flow remains available through **הרץ גם את החילוץ הקלאסי להשוואה**. Its candidate review is labeled **תוצאת הסוכן הקלאסי: סקירת מועמדים** and stays visible alongside the new clause view.

The UI compares immutable document-version IDs and explicitly reports whether both outputs belong to the same PDF. Changing the selected file clears the prior R3.1 preview so results cannot be accidentally compared across documents.

## 3. Safety boundary

The route is exact-path, authenticated, JSON-size bounded, deadline bounded, and rejects client database-connection overrides. The clause parser and enrichment modules are loaded lazily only for the preview request.

The response declares `mode: dry_run` and `persisted: false`. The route contains no Supabase, Storage, workspace-save, Schedule, promotion, decision, relationship, or n8n write call. The UI does not call a relationships endpoint. `semanticDecisions` and `canonicalRelationships` remain empty.

The R3.1 preview route remains ephemeral and is cleared by a reload or file change. The user subsequently approved R3.2, which adds a separate durable server-owned save/reopen route while preserving this no-write diagnostic route. See the [R3.2 persistence checkpoint](./BIDoc_Contracts_Pipeline_R3_2_Clause_Persistence_Checkpoint_2026-08-15.md).

## 4. Verification evidence

Automated verification passed:

| Check | Result |
| --- | ---: |
| Focused R3 tests, including R3.1 | 9/9 passed |
| Full Contracts test suite | 110/110 passed |
| Schedule regression suite | 47/47 passed |
| React production build | passed |
| Node syntax checks | passed |
| Git whitespace check | passed |

Static route tests verify authentication, bounded request parsing, lazy loading, database-override rejection, and absence of persistence calls. Projection tests verify complete source/enrichment evidence while excluding internal raw parser data, decisions, and canonical relationships. UI contract tests verify the full clause view, coverage values, explicit references, classic comparison, and responsive styles.

The automated browser reached the real BIDoc superadmin login wall in both available local browser contexts. It did not bypass authentication or read credentials. Therefore the authenticated visual interaction is intentionally left for the user to complete with their normal BIDoc login.

## 5. Manual acceptance

1. Start BIDoc locally and sign in with the normal BIDoc superadmin account.
2. Open the existing **חוזים** tab.
3. Select the approved Herzliya PDF.
4. Click **הצג את כל תוצאת סוכן החוזים** and wait for all clause cards to appear.
5. Confirm that the coverage panel reports no errors and that original text, summaries, tags, references, and filters are useful.
6. Click **הרץ גם את החילוץ הקלאסי להשוואה** and confirm that the same-document comparison notice appears.
7. Report any missed or incorrectly split clauses before approving R4.

R4 begins only after this manual acceptance and a separate explicit approval.
