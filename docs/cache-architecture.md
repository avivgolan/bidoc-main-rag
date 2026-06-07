# BIDoc Multi-Layer Cache Architecture

## Architecture

`src/cache.js` is the cache boundary for the chat pipeline. Business modules call
`cachedOperation` and do not depend on a specific storage vendor.

```mermaid
flowchart LR
  Pipeline["Chat Pipeline"] --> CacheService["Cache Service"]
  CacheService --> Memory["Memory Provider"]
  CacheService --> Redis["Redis Provider"]
  CacheService -. future .-> Upstash["Upstash Adapter"]
  CacheService -. future .-> SupabaseKV["Supabase KV Adapter"]
  CacheService --> Embedding["Embedding Cache - 30 days"]
  CacheService --> Hybrid["Hybrid Search - 6 hours"]
  CacheService --> Graph["Graph Search - 12 hours"]
  CacheService --> Reranker["Reranker - 12 hours"]
  CacheService --> Answer["Final Answer - 1 hour"]
```

Each chat run owns a cache context and metrics object. Workflow events are written
as `CACHE_HIT`, `CACHE_MISS`, or `CACHE_ERROR`. Concurrent misses for the same key
are coalesced to reduce cache stampedes.

## Key And Storage Schema

All keys use:

```text
<namespace><cache_type>:<sha256(stable_json_input)>
```

Redis values are JSON strings with native expiration:

```text
SET bidoc:cache:embedding:<hash> <json-vector> EX 2592000
SET bidoc:cache:hybridSearch:<hash> <json-results> EX 21600
SET bidoc:cache:graphSearch:<hash> <json-results> EX 43200
SET bidoc:cache:reranker:<hash> <json-results> EX 43200
SET bidoc:cache:finalAnswer:<hash> <json-answer> EX 3600
```

Key inputs include model, prompt hash, filters, date range, source IDs, graph
limit, and retrieval context where relevant. Credentials are never included.

## Provider Contract

```js
class CacheProvider {
  get(key)
  set(key, value, ttl)
  delete(key)
  exists(key)
}
```

Example integration:

```js
const results = await cachedOperation({
  context: cacheContext,
  type: "hybridSearch",
  keyParts: { query, filters, date_range },
  ttl: CACHE_TTL.hybridSearch,
  savedCall: "search",
  operation: () => runHybridRpc()
});
```

Upstash can use the Redis provider through its Redis endpoint. A future Supabase
KV adapter only needs to implement the same four methods.

## Configuration

Settings and environment variables are both supported:

```text
CACHE_ENABLED=true
CACHE_PROVIDER=memory|redis|none
REDIS_URL=rediss://default:password@host:6379
CACHE_NAMESPACE=bidoc:cache:
CACHE_MEMORY_MAX_ENTRIES=10000
CACHE_TIMEOUT_MS=5000
```

Development defaults to bounded in-memory storage. Production should use Redis
with TLS and an eviction policy such as `allkeys-lru`.

## Pipeline Integration

- Embeddings: normalized text and embedding model.
- Hybrid Search: query, filters, dates, RPC, weights, and result limit.
- Graph Search: sorted source node IDs, query, and expansion limit.
- Reranker: query, ordered source IDs, model, Top K, and prompt hash.
- Final answer: question, retrieval/tool/graph context hash, conversation
  summary, model, and Main prompt hash.

The final-answer key includes conversation context so an identical follow-up in
another conversation cannot receive an unrelated cached answer.

## Migration Plan

1. Deploy with `CACHE_PROVIDER=memory` and monitor Workflow metrics.
2. Verify answer equivalence and cache-key isolation in staging.
3. Provision private Redis with TLS, authentication, memory limits, and eviction.
4. Set `CACHE_PROVIDER=redis` and `REDIS_URL`; no code change is required.
5. Roll out gradually and monitor hit rate, errors, latency, and memory usage.
6. Disable instantly with `CACHE_ENABLED=false` or `CACHE_PROVIDER=none`.

No database migration is required. Cache contents are disposable and can be
flushed without affecting application state.

## Production Notes

- Use a dedicated Redis deployment or namespace per environment.
- Keep Redis private, authenticated, and encrypted with `rediss://`.
- Cache failures are fail-open and do not stop chat responses.
- Version the namespace, for example `bidoc:v2:cache:`, when contracts change.
- Estimated savings in Workflow are operational estimates, not billing records.
