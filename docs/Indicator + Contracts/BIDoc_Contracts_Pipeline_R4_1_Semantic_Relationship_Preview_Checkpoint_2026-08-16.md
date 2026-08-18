# BIDoc Contracts Pipeline R4.1 — semantic relationship preview checkpoint

Date: 2026-08-16

Status: compact-schema v3 plus fail-closed batch resilience implemented, verified, and visually accepted by the user. The separately approved R4.2A persistence/review successor is recorded in `BIDoc_Contracts_Pipeline_R4_2A_Relationship_Review_and_Persistence_Checkpoint_2026-08-17.md`.

## Outcome

The Contracts Relationships Agent can now run one bounded, manual semantic preview over the already-saved R3.2 clause generation. It ranks same-generation operative clause pairs, asks the configured server-side model to classify only the locked relationship ontology, and displays the accepted proposals in Hebrew with both source excerpts.

This slice is intentionally a preview:

- model proposals are not persisted;
- no contractual decision is created;
- no conflict winner is selected;
- no Schedule data is read or written;
- headings, definitions, and document-context records are excluded from candidate retrieval;
- the browser cannot supply clauses, model settings, database routing, or review decisions.

No Supabase migration or new table belongs to R4.1 because the approved slice does not persist model proposals. R4.0 explicit-reference relationships remain the only saved relationship records.

## Locked R4.1 behavior

- Agent version: `contracts-relationships-agent.r4.1.v3`.
- Policy version: `contracts-relationships-semantic.r4.1.v2`.
- Prompt version: `contracts-relationships-semantic-prompt.r4.1.v3`.
- Classifier schema: `contracts-relationships-semantic-model.r4.1.v3`.
- Skeptical verifier schema: `contracts-relationships-semantic-verifier.r4.1.v2`.
- Allowed semantic relationship types: `supports_same_decision`, `depends_on`, `condition_of`, `exception_to`, `amends`, `duplicates`, and `conflicts_with`.
- `cross_reference` remains deterministic R4.0 evidence and is not reclassified by R4.1.
- Candidate retrieval is deterministic and bounded to 48 pairs. Classification and independent verification use at most four pairs per batch. The classifier now returns no free-text rationale and is capped at 600 tokens per call. Verifier rejections use controlled reason codes with an empty rationale; only accepted proposals receive a Hebrew rationale of at most 240 characters. The verifier is capped at 700 tokens per call, leaving a 17,500-token worst case under the locked 20,000-token ceiling. The combined path remains capped at two concurrent calls, one provider retry, one classifier repair batch, one verifier repair batch, and a 180-second total deadline.
- A 90% confidence gate is applied to every proposed semantic relationship.
- Topic similarity, shared tags, adjacency, and similar legal wording are explicitly insufficient by themselves.
- A source-grounded actor safeguard rejects a claimed conflict when the clauses' primary operative rights belong to different parties. This prevents asymmetric rights from being mislabeled as contradictions.
- `amends` is rejected before verification unless the proposed source contains explicit amendment, override, replacement, priority, or carve-out language. Extra detail or a narrower context does not count as amendment.
- Every proposal surviving deterministic gates is sent to a separate skeptical verifier. The verifier can only accept or reject the fixed type and direction; it cannot relabel a weak proposal into another relationship.
- A verifier batch that still fails after the bounded retry/repair is rejected fail-closed instead of terminating the whole preview. Its pairs are omitted from the proposal list, counted as unverified, and disclosed by a Hebrew partial-result warning.
- A malformed classifier batch that still fails after its bounded repair is also rejected fail-closed. Those pairs are counted as unclassified rather than as `none`, are omitted from downstream verification, and produce the same explicit partial-result warning. Initial provider/auth/transport failure remains fatal and typed; the browser never presents an unavailable first-stage provider as a completed analysis.
- The final score is the lower of classifier and verifier confidence. The UI displays a qualitative classification-confidence level and explicitly states that it is not legal certainty.
- Every visible result remains `model` / `proposed` and requires human review.

## Retained-contract live quality check

The final read-only run loaded workspace `82345c75-c6f4-468d-b899-1f8407d9a9c1` and parser generation `parser-generation:sha256:a816ba2df825d7ad4c15ad7b406c4eb05c4a9c2f012d5453369f30c91208b533` from KAPAIM, then used `openai/gpt-4o` through the server-owned OpenRouter key.

| Measure | Final value |
| --- | ---: |
| Candidate pairs | 48 |
| Explicit-reference seeds among candidates | 3 |
| Model-assessed pairs | 48 |
| Relationships proposed by classifier | 34 |
| Rejected by deterministic source rules | 1 |
| Below classifier confidence gate | 1 |
| Sent to skeptical verification | 32 |
| Rejected by skeptical verification | 24 |
| Final review proposals | 8 |
| Classified as no relationship | 14 |
| Asymmetric false conflicts rejected | 1 |
| Contractual decisions created | 0 |
| Relationship persistence writes | 0 |
| Schedule writes | 0 |
| Model calls | 16 (8 classifier + 8 verifier) |
| Provider retries / classifier repairs / verifier repairs | 0 / 0 / 0 |

The final output preserved the genuine conflict between clause `6.7` and `appendix_b.3`: the same daily-delay penalty is stated as 2,000 ILS in the body and 3,250 ILS in the appendix. The actor safeguard rejected the model's proposed `19.6` versus `19.7` conflict because those clauses grant or restrict offset rights for different parties and can coexist.

The earlier user-visible single-pass run showed 43 of 48 pairs, including a questionable `12.3 -> 11.8` amendment. The hardened run reduced the output to eight proposals: one conflict, three dependencies, two conditions, and two exceptions. No `amends`, `duplicates`, or broad `supports_same_decision` proposal survived. The remaining eight are deliberately presented for the user's relationship-by-relationship quality review and are not approved contractual truth.

## Verification

- `npm.cmd run test:contracts` — 129/129 passed, including unsupported-amendment, separate-termination-ground rejection, forced verifier-provider fail-closed, and twice-malformed classifier JSON cases.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `node --check` for the R4.1 modules and server — passed.
- Final retained-contract live check — passed in 37.5 seconds with 48/48 pairs classified, 32 proposals independently verified, 24 verifier rejections, eight final proposals, no provider retry or repair, the genuine delay-penalty conflict retained, and the asymmetric false conflict rejected.
- Post-incident retained-contract live check on 2026-08-17 — passed in 29.6 seconds with `verificationComplete: true`, 48/48 candidate pairs classified, 30/30 preliminary proposals verified, six final proposals, zero failed verifier batches, the genuine `6.7` versus `appendix_b.3` conflict retained, and zero decision, persistence, or Schedule writes.
- Post-classifier-truncation live check on 2026-08-17 — passed in 34.2 seconds with four-pair classifier batches, `classificationComplete: true`, `verificationComplete: true`, 48/48 candidates classified, 29/29 preliminary proposals verified, nine final review proposals, zero failed batches, zero retry/repair calls, a 19,850-token configured maximum, the genuine `6.7` versus `appendix_b.3` conflict retained, and zero decision, persistence, or Schedule writes.
- Compact-schema v3 reliability check on 2026-08-17 — three consecutive real-model runs passed in 22.1, 19.5, and 22.3 seconds. Every run classified 48/48 candidates, verified every preliminary proposal (23/23, 24/24, and 21/21), reported zero failed classifier/verifier batches, used zero retry/repair calls, retained the genuine `6.7` versus `appendix_b.3` conflict, stayed within a 17,500-token configured maximum, and produced zero decision, persistence, or Schedule writes.
- `git diff --check` — passed (line-ending conversion warnings only; no whitespace errors).
- `bedrock sync --project .` — could not run because the Bedrock CLI is not installed or available on this workstation; the required project memory entry was updated directly.

## Deliberately deferred

- persisting model-proposed relationships;
- approve, reject, correct, or review-history writes;
- normalized contractual decision creation;
- conflict adjudication or authority ordering;
- relationship-to-decision grouping;
- any Schedule mapping, date arithmetic, alert, or write;
- deployment, commit, or push.

## Completed manual acceptance gate

Restart the user-owned local BIDoc server so it reloads `CONTRACTS_RELATIONSHIPS_R4_1_APPROVED=TRUE`. In the Contracts tab, open the retained saved extraction and click **הרץ תצוגת קשרים סמנטיים**. Review the Hebrew relationship type, direction, rationale, confidence, and both original excerpts for each proposal.

The user completed this visual and semantic-quality review and explicitly approved the bounded R4.2A persistence/review slice. R4.2B decision normalization and every Schedule integration still require separate explicit approval.
