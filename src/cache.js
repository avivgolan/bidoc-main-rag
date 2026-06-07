import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

export const CACHE_TTL = {
  embedding: 30 * 24 * 60 * 60,
  hybridSearch: 6 * 60 * 60,
  graphSearch: 12 * 60 * 60,
  reranker: 12 * 60 * 60,
  finalAnswer: 60 * 60
};

export class CacheProvider {
  async get(_key) { throw new Error("CacheProvider.get is not implemented"); }
  async set(_key, _value, _ttlSeconds) { throw new Error("CacheProvider.set is not implemented"); }
  async delete(_key) { throw new Error("CacheProvider.delete is not implemented"); }
  async exists(_key) { throw new Error("CacheProvider.exists is not implemented"); }
}

export class MemoryCacheProvider extends CacheProvider {
  constructor({ maxEntries = 10_000 } = {}) {
    super();
    this.maxEntries = Math.max(100, Number(maxEntries || 10_000));
    this.store = new Map();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return cloneValue(entry.value);
  }

  async set(key, value, ttlSeconds) {
    this.store.delete(key);
    this.store.set(key, {
      value: cloneValue(value),
      expiresAt: Date.now() + Math.max(1, Number(ttlSeconds || 1)) * 1000
    });
    while (this.store.size > this.maxEntries) {
      this.store.delete(this.store.keys().next().value);
    }
    return true;
  }

  async delete(key) {
    return this.store.delete(key);
  }

  async exists(key) {
    return (await this.get(key)) !== null;
  }
}

export class RedisCacheProvider extends CacheProvider {
  constructor({ url, prefix = "bidoc:cache:", timeoutMs = 5_000 } = {}) {
    super();
    if (!url) throw new Error("Redis URL is required");
    this.url = new URL(url);
    this.prefix = prefix;
    this.timeoutMs = timeoutMs;
  }

  async get(key) {
    const reply = await this.command(["GET", this.prefix + key]);
    return reply === null ? null : JSON.parse(reply);
  }

  async set(key, value, ttlSeconds) {
    await this.command(["SET", this.prefix + key, JSON.stringify(value), "EX", String(Math.max(1, Number(ttlSeconds || 1)))]);
    return true;
  }

  async delete(key) {
    return Number(await this.command(["DEL", this.prefix + key])) > 0;
  }

  async exists(key) {
    return Number(await this.command(["EXISTS", this.prefix + key])) > 0;
  }

  command(parts) {
    const secure = this.url.protocol === "rediss:";
    const port = Number(this.url.port || (secure ? 6380 : 6379));
    const auth = this.url.password
      ? [["AUTH", this.url.username ? decodeURIComponent(this.url.username) : "default", decodeURIComponent(this.url.password)]]
      : [];
    const commands = [...auth, parts];
    return new Promise((resolve, reject) => {
      const socket = secure
        ? tls.connect({ host: this.url.hostname, port, servername: this.url.hostname })
        : net.createConnection({ host: this.url.hostname, port });
      const timer = setTimeout(() => socket.destroy(new Error("Redis cache timeout")), this.timeoutMs);
      const parser = createRedisParser();
      const replies = [];
      socket.on(secure ? "secureConnect" : "connect", () => {
        socket.write(commands.map(encodeRedisCommand).join(""));
      });
      socket.on("data", (chunk) => {
        try {
          replies.push(...parser.push(chunk));
          if (replies.length >= commands.length) {
            clearTimeout(timer);
            socket.end();
            const reply = replies.at(-1);
            if (reply instanceof Error) reject(reply);
            else resolve(reply);
          }
        } catch (error) {
          clearTimeout(timer);
          socket.destroy();
          reject(error);
        }
      });
      socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}

const providers = new Map();
const inFlight = new Map();

export function getCacheProvider(config = {}) {
  const cacheConfig = config.cache || {};
  if (cacheConfig.enabled === false || cacheConfig.provider === "none") return null;
  const type = cacheConfig.provider || "memory";
  const identity = type === "redis"
    ? `redis:${cacheConfig.redisUrl || ""}:${cacheConfig.namespace || "bidoc:cache:"}`
    : `memory:${cacheConfig.memoryMaxEntries || 10_000}`;
  if (providers.has(identity)) return providers.get(identity);
  const provider = type === "redis"
    ? new RedisCacheProvider({
        url: cacheConfig.redisUrl,
        prefix: cacheConfig.namespace || "bidoc:cache:",
        timeoutMs: cacheConfig.timeoutMs || 5_000
      })
    : new MemoryCacheProvider({ maxEntries: cacheConfig.memoryMaxEntries || 10_000 });
  providers.set(identity, provider);
  return provider;
}

export function createCacheContext({ config = {}, runId = "", emit = null } = {}) {
  return {
    config,
    runId,
    emit,
    metrics: {
      cache_hits: 0,
      cache_misses: 0,
      cache_hit_rate: 0,
      saved_model_calls: 0,
      saved_embedding_calls: 0,
      saved_search_calls: 0,
      estimated_cost_saved: 0,
      by_type: {}
    }
  };
}

export async function cachedOperation({
  context,
  type,
  keyParts,
  ttl = CACHE_TTL[type],
  operation,
  savedCall = "",
  estimatedCost = 0
}) {
  let provider = null;
  try {
    provider = context ? getCacheProvider(context.config) : null;
  } catch (error) {
    emitCache(context, "CACHE_ERROR", type, "", { error: error.message });
    return operation();
  }
  if (!provider) return operation();
  const key = cacheKey(type, keyParts);
  try {
    const cached = await provider.get(key);
    if (cached !== null) {
      recordCache(context, type, true, savedCall, estimatedCost);
      return cached;
    }
    recordCache(context, type, false);
  } catch (error) {
    emitCache(context, "CACHE_ERROR", type, key, { error: error.message });
    return operation();
  }

  if (inFlight.has(key)) {
    const value = await inFlight.get(key);
    recordCache(context, type, true, savedCall, estimatedCost, "coalesced");
    return cloneValue(value);
  }

  const pending = Promise.resolve().then(operation);
  inFlight.set(key, pending);
  try {
    const value = await pending;
    await provider.set(key, value, ttl).catch((error) => {
      emitCache(context, "CACHE_ERROR", type, key, { error: error.message });
    });
    return value;
  } finally {
    inFlight.delete(key);
  }
}

export function cacheKey(type, value) {
  return `${type}:${sha256(stableStringify(value))}`;
}

export function hashValue(value) {
  return sha256(stableStringify(value));
}

export function finalizeCacheMetrics(context) {
  const metrics = context?.metrics || createCacheContext().metrics;
  const total = metrics.cache_hits + metrics.cache_misses;
  return {
    ...metrics,
    cache_hit_rate: total ? Number(((metrics.cache_hits / total) * 100).toFixed(2)) : 0,
    estimated_cost_saved: Number(metrics.estimated_cost_saved.toFixed(6))
  };
}

function recordCache(context, type, hit, savedCall = "", estimatedCost = 0, mode = "provider") {
  if (!context?.metrics) return;
  if (hit) context.metrics.cache_hits += 1;
  else context.metrics.cache_misses += 1;
  const typeMetrics = context.metrics.by_type[type] || { hits: 0, misses: 0 };
  if (hit) typeMetrics.hits += 1;
  else typeMetrics.misses += 1;
  context.metrics.by_type[type] = typeMetrics;
  if (hit && savedCall === "model") context.metrics.saved_model_calls += 1;
  if (hit && savedCall === "embedding") context.metrics.saved_embedding_calls += 1;
  if (hit && savedCall === "search") context.metrics.saved_search_calls += 1;
  if (hit) context.metrics.estimated_cost_saved += Number(estimatedCost || 0);
  emitCache(context, hit ? "CACHE_HIT" : "CACHE_MISS", type, "", { mode });
}

function emitCache(context, message, type, key, extra = {}) {
  context?.emit?.(context.runId, "cache", message, {
    cache_type: type,
    key_prefix: key ? key.slice(0, 24) : undefined,
    ...extra
  });
}

function stableStringify(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function encodeRedisCommand(parts) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join("")}`;
}

function createRedisParser() {
  let buffer = Buffer.alloc(0);
  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const replies = [];
      while (buffer.length) {
        const parsed = parseRedisValue(buffer, 0);
        if (!parsed) break;
        buffer = buffer.subarray(parsed.offset);
        replies.push(parsed.value);
      }
      return replies;
    }
  };
}

function parseRedisValue(buffer, start) {
  const end = buffer.indexOf("\r\n", start);
  if (end < 0) return null;
  const prefix = String.fromCharCode(buffer[start]);
  const line = buffer.toString("utf8", start + 1, end);
  if (prefix === "+" || prefix === ":") return { value: prefix === ":" ? Number(line) : line, offset: end + 2 };
  if (prefix === "-") return { value: new Error(line), offset: end + 2 };
  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: end + 2 };
    const valueStart = end + 2;
    const valueEnd = valueStart + length;
    if (buffer.length < valueEnd + 2) return null;
    return { value: buffer.toString("utf8", valueStart, valueEnd), offset: valueEnd + 2 };
  }
  throw new Error(`Unsupported Redis reply: ${prefix}`);
}
