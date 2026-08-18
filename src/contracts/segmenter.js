export const CONTRACTS_SEGMENTER_VERSION = "contracts-segmenter.v1";
export const CONTRACTS_MAX_SEGMENT_CHARACTERS = 3_500;

const HEBREW_APPENDIX_KEYS = {
  "א": "a", "ב": "b", "ג": "c", "ד": "d", "ה": "e", "ו": "f", "ז": "g", "ח": "h",
  "ט": "i", "י": "j", "כ": "k", "ל": "l", "מ": "m", "נ": "n", "ס": "o", "ע": "p",
  "פ": "q", "צ": "r", "ק": "s", "ר": "t", "ש": "u", "ת": "v"
};

export function segmentContractPages(pages = [], maxSegmentCharacters = CONTRACTS_MAX_SEGMENT_CHARACTERS) {
  const segments = [];
  const occurrences = new Map();
  let appendixKey = null;
  let currentClause = null;

  for (const page of pages) {
    const pdfPage = Number(page?.pdfPage);
    if (!Number.isInteger(pdfPage) || pdfPage < 1) continue;
    const lines = String(page?.text || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    let buffered = [];
    let bufferedClause = currentClause || pageContext(pdfPage, appendixKey);

    const flush = () => {
      if (!buffered.length) return;
      const text = buffered.join("\n").trim();
      if (text) {
        for (const piece of splitLongSegment(text, maxSegmentCharacters)) {
          const occurrenceKey = `${pdfPage}:${bufferedClause.clauseKey}`;
          const occurrence = (occurrences.get(occurrenceKey) || 0) + 1;
          occurrences.set(occurrenceKey, occurrence);
          segments.push({
            segmentId: `p${String(pdfPage).padStart(3, "0")}:${bufferedClause.clauseKey}:${String(occurrence).padStart(4, "0")}`,
            pdfPage,
            clauseLabel: bufferedClause.clauseLabel,
            clauseKey: bufferedClause.clauseKey,
            text: piece
          });
        }
      }
      buffered = [];
    };

    for (const line of lines) {
      const appendix = parseAppendixHeading(line);
      if (appendix) {
        flush();
        appendixKey = appendix;
        currentClause = {
          clauseKey: `appendix_${appendix}.heading`,
          clauseLabel: `Appendix ${appendix.toUpperCase()} heading`
        };
        bufferedClause = currentClause;
        buffered.push(line);
        continue;
      }

      const clauseNumber = parseClauseNumber(line);
      if (clauseNumber) {
        flush();
        currentClause = appendixKey
          ? {
              clauseKey: `appendix_${appendixKey}.${clauseNumber}`,
              clauseLabel: `Appendix ${appendixKey.toUpperCase()}, item ${clauseNumber}`
            }
          : { clauseKey: clauseNumber, clauseLabel: clauseNumber };
        bufferedClause = currentClause;
      } else if (!buffered.length) {
        bufferedClause = currentClause || pageContext(pdfPage, appendixKey);
      }

      if (buffered.length && buffered.join("\n").length + line.length + 1 > maxSegmentCharacters) flush();
      buffered.push(line);
    }
    flush();
  }

  return segments;
}

export function normalizeClauseKey(value) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[׳’']/gu, "")
    .replace(/[^a-z0-9._-]+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^[_\.]+|[_\.]+$/gu, "");
  return normalized || "unknown";
}

function parseAppendixHeading(line) {
  const text = String(line || "").trim();
  if (/^\d/u.test(text)) return null;
  const leading = text.match(/^נספח\s+([א-תA-Za-z])(?:\s*[׳'"])?/u);
  const rtlHeading = text.length <= 120 ? text.match(/(?:^|[-–—]\s*)([א-תA-Za-z])(?:\s*[׳'"])?\s+נספח(?:\s|$)/u) : null;
  const value = leading?.[1] || rtlHeading?.[1];
  if (!value) return null;
  return HEBREW_APPENDIX_KEYS[value] || value.toLowerCase();
}

function parseClauseNumber(line) {
  const match = String(line || "").match(/^\s*(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/u);
  if (match && /^(?:(?:לעיל|להלן)(?:\s|[,.;:])|(?:above|below)\b)/iu.test(match[2])) return null;
  return match ? normalizeClauseKey(match[1]) : null;
}

function pageContext(pdfPage, appendixKey) {
  return appendixKey
    ? { clauseKey: `appendix_${appendixKey}.context`, clauseLabel: `Appendix ${appendixKey.toUpperCase()} context` }
    : { clauseKey: `page_${pdfPage}.context`, clauseLabel: `Page ${pdfPage} context` };
}

function splitLongSegment(text, maxCharacters) {
  if (text.length <= maxCharacters) return [text];
  const pieces = [];
  let remaining = text;
  while (remaining.length > maxCharacters) {
    const slice = remaining.slice(0, maxCharacters + 1);
    const boundary = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf("; "));
    const index = boundary > maxCharacters * 0.6 ? boundary + 1 : maxCharacters;
    pieces.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}
