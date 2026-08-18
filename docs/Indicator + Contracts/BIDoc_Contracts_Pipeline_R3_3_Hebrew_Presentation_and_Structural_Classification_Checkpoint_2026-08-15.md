# BIDoc Contracts Pipeline R3.3 — Hebrew presentation and structural classification checkpoint

Date: 2026-08-15

Status: implemented, locally verified, and visually accepted by the user; the R4 gate is open.

## Outcome

The saved R3.2 Contracts Agent generation can now be reopened in the existing Contracts tab and reviewed through a Hebrew display layer without uploading the PDF or invoking the model again. Canonical machine tags and stored source records remain unchanged.

The presentation layer deterministically separates:

- structural headings;
- operative contractual clauses;
- contractual definitions;
- document-context records.

Numbered parent sections with child records render as section dividers instead of decision-like cards. If a parent section contains a lead-in after its title, that lead-in remains visible beneath the heading. Appendix headings use Hebrew display labels. Raw machine identifiers and hashes are collapsed under technical details.

## Saved-contract verification

Read-only verification used saved workspace `82345c75-c6f4-468d-b899-1f8407d9a9c1` for MAIN project `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7`.

| Measure | Verified value |
| --- | ---: |
| Source lines covered | 743/743 |
| Stored records | 189 |
| Structural headings | 25 |
| Operative clauses | 152 |
| Contractual definitions | 2 |
| Document-context records | 10 |
| Explicit references found | 15 |
| Coverage errors | 0 |

All 19 numbered top-level sections are structural headings. Sections 3, 4, and 11 retain their source lead-ins in the heading presentation. The role counts total exactly 189.

## Hebrew display contract

- The 34 canonical tag keys remain stable for storage and later integrations.
- Every canonical tag has a locked Hebrew label for display.
- Record roles, record types, filters, metrics, reference targets, processing state, and clause details are displayed in Hebrew.
- Search covers both canonical values and their Hebrew display labels.

## R4 boundary

R3.3 publishes a deterministic relationship-input boundary. Structural headings, definitions, and context records are explicitly separated from the 152 operative clause records. It does not create a relationship, group clauses into decisions, resolve conflicts, calculate dates, or write Schedule state.

The user visually accepted the saved Contracts Agent result on 2026-08-15 and explicitly approved proceeding to the Contracts Relationships Agent. R4.0 subsequently started as a separately bounded explicit-reference foundation; it does not retroactively broaden R3.3.

## Verification

- `npm.cmd run test:contracts` — 118/118 passed.
- `npm.cmd run react:build` — passed; 20 modules transformed.
- `node --check src/contracts/clausePresentation.js` — passed.
- Read-only KAPAIM projection — 189 records, exact 25/152/2/10 role partition, 743/743 coverage.
- Authenticated Chrome check — saved generation reopened without extraction; Hebrew filters and tags rendered; heading/all/default counts were 25/189/152; clause expansion passed; no browser warnings or errors.
- Design QA — passed with no P0, P1, or P2 findings; see `design-qa.md`.

No database migration, remote row change, PDF upload, OpenRouter call, Schedule write, n8n change, deployment, commit, or push was performed in this slice.

## User acceptance closeout

The user reviewed the saved Contracts Agent presentation, including the Hebrew labels, the operative-clause view, expanded source/summary evidence, and structural headings, stated that they liked the result, and approved progression to the Contracts Relationships Agent. The R4.0 checkpoint records the newly authorized work and its own separate remote-apply gate.
