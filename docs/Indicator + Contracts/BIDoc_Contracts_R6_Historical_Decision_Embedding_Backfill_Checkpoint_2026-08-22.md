# BIDoc Contracts R6 - Historical Decision Embedding Backfill Checkpoint

Date: 2026-08-22
Status: completed and verified on KAPAIM

## Approved Scope

Backfill only the missing embeddings of current historical contract decisions.
Do not generate historical clause embeddings, change contract content or review
history, alter relationships, write to Indicator or Schedule, deploy, or commit.

## Dry-Run Evidence

The latest-revision query found:

- Missing current decision embeddings: 137.
- Affected workspaces: 1.
- Workspace: `82345c75-c6f4-468d-b899-1f8407d9a9c1`.
- Missing workspace IDs: 0.
- Empty canonical embedding inputs: 0.
- Maximum canonical input length: 1,245 characters.

The guarded live runner then confirmed:

- Planned decision items: 137.
- Historical document items skipped: 189.
- Model: `openai/text-embedding-3-large`.
- Required dimensions: 3072.
- Dry-run writes: 0.

## Applied Operation

The operation used a temporary decision-only live runner. It was intentionally
removed after verification because the legacy work RPC returns all latest
decisions even when their vectors are already current; retaining the runner could
cause unnecessary model calls on an accidental rerun.

The write required both an explicit apply flag and an exact expected count of 137.
It used the existing service-role-only Contracts R6 RPCs:

- `public.bidoc_contracts_r6_embedding_work_v1(uuid)`
- `public.bidoc_contracts_r6_apply_embeddings_v1(uuid,jsonb)`

The apply RPC re-computed each canonical input hash under row lock before writing.
It can update only `embedding` and `embedding_input_sha256` on append-only decision
rows.

Apply result:

- Generated: 137.
- Written: 137.
- Reused: 0.
- Historical document embeddings generated: 0.

## Post-Write Verification

The exact Phase 4A acceptance SQL passed after the backfill:

- Product clause rows: 313.
- Product latest-decision rows: 235.
- Current decisions with embeddings: 235.
- Current decisions missing embeddings: 0.
- Historical trigger values retained only in metadata: 15.

The historical workspace-specific verification also passed:

- Current decisions: 137.
- Decision vectors with 3072 dimensions: 137.
- Decision vectors with the canonical input hash: 137.
- Historical clause rows: 189.
- Historical clause rows with embeddings: 0.
- Global clause row count remained 313.
- Global decision revision count remained 421.

## Stop Gate

The historical current-decision embedding debt is closed. No UI reader switch,
Indicator integration, application deployment, or Git commit was performed in
this phase. Those remain separately approved steps.
