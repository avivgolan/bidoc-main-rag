export const MAIN_CITATION_CONTRACT = "inline_source_links.v1";

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/giu;
const CITATION_MARKER_RE = /\[(?:(מקור|source|ישיבה)\s*:\s*)?([^\]]+)\](?!\()|\((מקור|source|ישיבה)\s*:\s*([^)]+)\)/giu;
const SOURCE_ID_RE = /S\d+/giu;

export function resolveMainAnswerCitations(text, {
  sourceMap = null,
  sources = [],
  enforceCanonicalUrls = sourceMap && typeof sourceMap === "object"
} = {}) {
  const original = String(text || "");
  const hebrew = /[א-ת]/u.test(original);
  const registry = buildCitationRegistry({ sourceMap, sources });
  const allowedUrls = new Set(registry.entries.filter((entry) => entry.url).map((entry) => entry.urlKey));
  const state = {
    markersFound: 0,
    resolved: 0,
    unresolved: 0,
    unavailable: 0,
    invalidLinksRemoved: 0,
    resolvedSourceIds: new Set(),
    resolvedById: 0,
    resolvedByTitle: 0,
    hebrew
  };

  let answer = original;
  const markdownLinksBefore = collectMarkdownLinks(answer);
  if (enforceCanonicalUrls) {
    answer = answer.replace(MARKDOWN_LINK_RE, (full, label, rawUrl) => {
      const urlKey = normalizeHttpUrl(rawUrl);
      if (urlKey && allowedUrls.has(urlKey)) return full;
      state.invalidLinksRemoved += 1;
      return label;
    });
  }

  // Resolve in one pass so newly rendered no-link labels are not counted twice.
  answer = answer.replace(CITATION_MARKER_RE, (full, bracketLabel, bracketInner, parenLabel, parenInner) => {
    const label = bracketLabel || parenLabel;
    const inner = String(bracketInner ?? parenInner ?? "").trim();
    if (/^(?:S\d+\s*[,;]\s*)*S\d+$/iu.test(inner)) {
      state.markersFound += 1;
      return resolveSourceIdList(inner, registry, state, full, label);
    }
    if (!label) return full;
    // A natural phrase such as "source: Ukraine" is not necessarily a citation.
    // Only recognize legacy parenthetical titles/categories known to this registry.
    if (parenLabel && !inner.split(/\s*;\s*/u).some((part) => isKnownCitationTitle(part, registry.entries))) return full;
    state.markersFound += 1;
    return resolveSourceTitleList({ full, label, inner, registry, state });
  });

  const markdownLinksAfter = collectMarkdownLinks(answer);
  const bulletAudit = auditBulletCitationCoverage(answer, allowedUrls);
  const sourceLinksAvailable = registry.entries.filter((entry) => entry.url).length;
  const status = state.unresolved > 0 || state.invalidLinksRemoved > 0
    ? "warning"
    : registry.entries.length === 0
    ? "not_applicable"
    : sourceLinksAvailable === 0
      ? "unavailable"
    : state.unresolved === 0 && state.invalidLinksRemoved === 0 && markdownLinksAfter.length > 0 && bulletAudit.uncited === 0
      ? "passed"
      : "warning";

  return {
    answer,
    metrics: {
      contract: MAIN_CITATION_CONTRACT,
      status,
      validation_scope: "reference_resolution_and_bullet_link_coverage",
      semantic_entailment_checked: false,
      canonical_url_enforcement: Boolean(enforceCanonicalUrls),
      source_registry_records: registry.entries.length,
      source_links_available: sourceLinksAvailable,
      citation_markers_found: state.markersFound,
      resolved_citations: state.resolved,
      identified_citations: state.resolved + state.unavailable,
      unresolved_citations: state.unresolved,
      unavailable_citations: state.unavailable,
      invalid_links_removed: state.invalidLinksRemoved,
      resolved_by_source_id: state.resolvedById,
      resolved_by_title: state.resolvedByTitle,
      resolved_source_ids: [...state.resolvedSourceIds],
      markdown_links_before: markdownLinksBefore.length,
      markdown_links_after: markdownLinksAfter.length,
      bullet_lines: bulletAudit.total,
      cited_bullet_lines: bulletAudit.cited,
      uncited_bullet_lines: bulletAudit.uncited
    }
  };
}

function buildCitationRegistry({ sourceMap, sources }) {
  const entries = [];
  if (sourceMap && typeof sourceMap === "object" && !Array.isArray(sourceMap)) {
    for (const [sourceId, source] of Object.entries(sourceMap)) {
      if (!/^S\d+$/iu.test(sourceId) || !source || typeof source !== "object") continue;
      entries.push(citationEntry({
        sourceId: sourceId.toUpperCase(),
        title: source.title || source.label || source.source_table || sourceId,
        sourceTable: source.source_table || source.sourceTable || "",
        url: source.url
      }));
    }
  }
  const fallbackSources = sourceMap && typeof sourceMap === "object" ? [] : sources;
  for (const [index, source] of (Array.isArray(fallbackSources) ? fallbackSources : []).entries()) {
    if (!source || typeof source !== "object") continue;
    const entry = citationEntry({
      sourceId: source.source_id || source.sourceId || null,
      title: source.title || source.label || source.name || `Source ${index + 1}`,
      sourceTable: source.source_table || source.sourceTable || source.toolName || source.source || "",
      url: source.url || source.source_url
    });
    const duplicate = entries.some((existing) =>
      (entry.sourceId && existing.sourceId === entry.sourceId) ||
      (entry.urlKey && existing.urlKey === entry.urlKey)
    );
    if (!duplicate) entries.push(entry);
  }
  return {
    entries: entries.filter(Boolean),
    byId: new Map(entries.filter((entry) => entry?.sourceId).map((entry) => [entry.sourceId, entry]))
  };
}

function citationEntry({ sourceId, title, sourceTable, url }) {
  const safeUrl = normalizeHttpUrl(url);
  const cleanTitle = String(title || sourceTable || sourceId || "Source").replace(/[\[\]\r\n]+/gu, " ").trim();
  return {
    sourceId: /^S\d+$/iu.test(String(sourceId || "")) ? String(sourceId).toUpperCase() : null,
    title: cleanTitle,
    normalizedTitle: normalizeCitationText(cleanTitle),
    normalizedSourceTable: normalizeCitationText(sourceTable),
    url: safeUrl,
    urlKey: safeUrl
  };
}

function resolveSourceIdList(rawIds, registry, state, fallback, label = "מקור") {
  const ids = String(rawIds || "").match(SOURCE_ID_RE)?.map((value) => value.toUpperCase()) || [];
  if (!ids.length) {
    state.unresolved += 1;
    return fallback;
  }
  const rendered = [];
  for (const id of ids) {
    const entry = registry.byId.get(id);
    if (!entry) {
      state.unresolved += 1;
      rendered.push(state.hebrew ? "(מקור לא זמין)" : "(Source unavailable)");
      continue;
    }
    if (!entry.url) {
      state.unavailable += 1;
      rendered.push(renderUnavailableCitation(entry, state.hebrew));
      continue;
    }
    state.resolved += 1;
    state.resolvedById += 1;
    state.resolvedSourceIds.add(id);
    rendered.push(renderCitationLink(entry, state.hebrew ? "מקור" : label || "Source"));
  }
  return rendered.join(" ");
}

function resolveSourceTitleList({ full, label, inner, registry, state }) {
  const parts = String(inner || "").split(/\s*;\s*/u).filter(Boolean);
  const rendered = [];
  for (const part of parts) {
    const entry = matchCitationTitle(part, registry.entries);
    if (!entry) {
      state.unresolved += 1;
      rendered.push(state.hebrew ? "(מקור לא זמין)" : "(Source unavailable)");
      continue;
    }
    if (!entry.url) {
      state.unavailable += 1;
      rendered.push(renderUnavailableCitation(entry, state.hebrew));
      continue;
    }
    state.resolved += 1;
    state.resolvedByTitle += 1;
    if (entry.sourceId) state.resolvedSourceIds.add(entry.sourceId);
    rendered.push(renderCitationLink(entry, label));
  }
  return rendered.length ? rendered.join(" ") : full;
}

function matchCitationTitle(value, entries) {
  const normalized = normalizeCitationText(value);
  if (!normalized) return null;
  const exactTitle = entries.filter((entry) => entry.normalizedTitle === normalized);
  if (exactTitle.length === 1) return exactTitle[0];
  const includedTitle = entries.filter((entry) =>
    entry.normalizedTitle.length >= 4 && containsBoundedText(normalized, entry.normalizedTitle)
  );
  if (includedTitle.length === 1) return includedTitle[0];
  const exactTable = entries.filter((entry) => entry.normalizedSourceTable && entry.normalizedSourceTable === normalized);
  return exactTable.length === 1 ? exactTable[0] : null;
}

function isKnownCitationTitle(value, entries) {
  const normalized = normalizeCitationText(value);
  return Boolean(normalized) && entries.some((entry) =>
    entry.normalizedTitle === normalized ||
    entry.normalizedSourceTable === normalized ||
    (entry.normalizedTitle.length >= 4 && containsBoundedText(normalized, entry.normalizedTitle))
  );
}

function renderCitationLink(entry, label = "מקור") {
  return `[${label}: ${entry.title}](${entry.url})`;
}

function renderUnavailableCitation(entry, hebrew) {
  return hebrew
    ? `(מקור: ${entry.title}, ללא קישור ישיר)`
    : `(Source: ${entry.title}, no direct link)`;
}

function auditBulletCitationCoverage(answer, allowedUrls) {
  let total = 0;
  let cited = 0;
  for (const rawLine of String(answer || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!/^(?:[-*+]\s+|\d+[.)]\s+)/u.test(line)) continue;
    const content = line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/u, "").replace(/[*_`#]/gu, "").trim();
    if (content.length < 12) continue;
    total += 1;
    const links = collectMarkdownLinks(line);
    if (links.some((url) => !allowedUrls.size || allowedUrls.has(normalizeHttpUrl(url)))) cited += 1;
  }
  return { total, cited, uncited: Math.max(0, total - cited) };
}

function collectMarkdownLinks(value) {
  return [...String(value || "").matchAll(MARKDOWN_LINK_RE)]
    .map((match) => match[2])
    .filter((url) => normalizeHttpUrl(url));
}

function normalizeCitationText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\[\](){}*_`"']/gu, " ")
    .replace(/[,:|]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsBoundedText(haystack, needle) {
  if (haystack === needle) return true;
  const index = haystack.indexOf(needle);
  if (index < 0) return false;
  const before = index === 0 ? " " : haystack[index - 1];
  const afterIndex = index + needle.length;
  const after = afterIndex >= haystack.length ? " " : haystack[afterIndex];
  return /\s/u.test(before) && /\s/u.test(after);
}

function normalizeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href.replace(/\(/gu, "%28").replace(/\)/gu, "%29");
  } catch {
    return null;
  }
}
