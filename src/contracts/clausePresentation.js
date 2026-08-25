export const CONTRACTS_CLAUSE_PRESENTATION_VERSION = "contracts-clause-presentation.r3.3.v1";
export const CONTRACTS_RELATIONSHIPS_INPUT_BOUNDARY_VERSION = "contracts-relationships-input-boundary.r3.3.v1";

export const CONTRACTS_CLAUSE_TYPE_LABELS_HE = Object.freeze({
  document_context: "הקשר מסמך",
  clause: "סעיף ראשי",
  subclause: "תת־סעיף",
  appendix_item: "פריט נספח"
});

export const CONTRACTS_STRUCTURAL_ROLE_LABELS_HE = Object.freeze({
  heading: "כותרת מבנית",
  operative: "הוראה חוזית",
  definition: "הגדרה חוזית",
  context: "הקשר מסמך"
});

export const CONTRACTS_TAG_LABELS_HE = Object.freeze({
  appendix: "נספח",
  approval: "אישור",
  authorization: "הסמכה",
  bond: "ערבות",
  change: "שינוי",
  commercial: "מסחרי",
  communication: "תקשורת",
  compliance: "עמידה בדרישות",
  completion: "השלמה",
  confidentiality: "סודיות",
  coordination: "תיאום",
  definitions: "הגדרות",
  delay: "עיכוב",
  dispute: "מחלוקת",
  document_context: "הקשר מסמך",
  documents: "מסמכים",
  execution: "ביצוע",
  extension: "הארכת מועד",
  insurance: "ביטוח",
  liability: "אחריות משפטית",
  milestone: "אבן דרך",
  notice: "הודעה",
  other: "אחר",
  ownership: "בעלות",
  parties: "צדדים להסכם",
  payment: "תשלום",
  quality: "איכות",
  responsibility: "אחריות",
  safety: "בטיחות",
  schedule: "לוח זמנים",
  scope: "תחולת העבודה",
  storage: "אחסון",
  termination: "סיום ההסכם",
  warranty: "אחריות בדק"
});

const APPENDIX_LABELS_HE = Object.freeze({
  a: "א׳",
  b: "ב׳",
  c: "ג׳",
  d: "ד׳",
  e: "ה׳",
  f: "ו׳",
  g: "ז׳",
  h: "ח׳",
  i: "ט׳",
  j: "י׳",
  k: "כ׳",
  l: "ל׳",
  m: "מ׳",
  n: "נ׳",
  o: "ס׳",
  p: "ע׳",
  q: "פ׳",
  r: "צ׳",
  s: "ק׳",
  t: "ר׳",
  u: "ש׳",
  v: "ת׳"
});

export function contractsClauseTypeLabelHe(value) {
  return CONTRACTS_CLAUSE_TYPE_LABELS_HE[value] || "רשומת חוזה";
}

export function contractsStructuralRoleLabelHe(value) {
  return CONTRACTS_STRUCTURAL_ROLE_LABELS_HE[value] || "רשומת חוזה";
}

export function contractsTagLabelHe(value) {
  const tag = String(value || "").trim();
  if (CONTRACTS_TAG_LABELS_HE[tag]) return CONTRACTS_TAG_LABELS_HE[tag];
  // R6 persists the canonical shared Hebrew vocabulary. Show that value directly
  // instead of replacing a valid tag with the generic legacy-key fallback.
  if (/[\u0590-\u05ff]/u.test(tag)) return tag;
  return "תגית חוזית";
}

export function contractsClauseDisplayLabelHe(clauseKey, clauseTitle = null) {
  const key = String(clauseKey || "").trim();
  const appendix = key.match(/^appendix_([a-v])(?:\.(heading|.+))?$/u);
  if (appendix) {
    const appendixLabel = APPENDIX_LABELS_HE[appendix[1]] || appendix[1].toUpperCase();
    if (!appendix[2] || appendix[2] === "heading") return `כותרת נספח ${appendixLabel}`;
    return `נספח ${appendixLabel}, סעיף ${appendix[2]}`;
  }
  if (/^\d+(?:\.\d+)*$/u.test(key)) return `סעיף ${key}`;
  if (key.includes(".context.")) return clauseTitle || "הקשר המסמך";
  return clauseTitle || "רשומת חוזה";
}

export function contractsReferenceTargetLabelHe(targetClauseKey) {
  return contractsClauseDisplayLabelHe(targetClauseKey);
}

export function decorateContractsClauseRecords(clauses = []) {
  const records = Array.isArray(clauses) ? clauses : [];
  const childCountByKey = new Map();
  for (const clause of records) {
    const parent = String(clause?.parentClauseKey || "").trim();
    if (parent) childCountByKey.set(parent, (childCountByKey.get(parent) || 0) + 1);
  }

  return records.map((clause) => {
    const hashtags = Array.isArray(clause?.hashtags) ? clause.hashtags : [];
    const childCount = childCountByKey.get(String(clause?.clauseKey || "")) || 0;
    const structuralRole = classifyStructuralRole(clause, { childCount, hashtags });
    const structuralLeadHe = structuralRole === "heading" ? headingLeadHe(clause) : null;
    const tagLabelsHe = hashtags.map(contractsTagLabelHe);
    const crossReferences = (Array.isArray(clause?.crossReferences) ? clause.crossReferences : []).map((reference) => ({
      ...reference,
      targetLabelHe: contractsReferenceTargetLabelHe(reference?.targetClauseKey)
    }));
    const decorated = {
      ...clause,
      childCount,
      structuralRole,
      structuralRoleLabelHe: contractsStructuralRoleLabelHe(structuralRole),
      structuralLeadHe,
      relationshipEligible: structuralRole === "operative",
      clauseTypeLabelHe: contractsClauseTypeLabelHe(clause?.clauseType),
      displayLabelHe: contractsClauseDisplayLabelHe(clause?.clauseKey, clause?.clauseTitle),
      tagLabelsHe,
      crossReferences
    };
    return {
      ...decorated,
      displayContentHe: buildContractsClauseDisplayContentHe(decorated)
    };
  });
}

export function decorateContractsClausePreview(preview = {}) {
  const clauses = decorateContractsClauseRecords(preview?.clauses);
  const roleCounts = clauses.reduce((counts, clause) => {
    counts[clause.structuralRole] = (counts[clause.structuralRole] || 0) + 1;
    return counts;
  }, { heading: 0, operative: 0, definition: 0, context: 0 });
  const excludedClauseKeysByRole = Object.fromEntries(
    ["heading", "definition", "context"].map((role) => [
      role,
      clauses.filter((clause) => clause.structuralRole === role).map((clause) => clause.clauseKey)
    ])
  );
  return {
    ...preview,
    presentationVersion: CONTRACTS_CLAUSE_PRESENTATION_VERSION,
    clauses,
    coverage: {
      ...(preview?.coverage || {}),
      operativeCount: roleCounts.operative,
      headingCount: roleCounts.heading,
      definitionCount: roleCounts.definition,
      contextCount: roleCounts.context
    },
    quality: {
      ...(preview?.quality || {}),
      roleCounts
    },
    relationshipsInputBoundary: {
      version: CONTRACTS_RELATIONSHIPS_INPUT_BOUNDARY_VERSION,
      eligibleClauseKeys: clauses.filter((clause) => clause.relationshipEligible).map((clause) => clause.clauseKey),
      excludedClauseKeysByRole
    }
  };
}

export function selectContractsRelationshipEligibleClauses(clauses = []) {
  return decorateContractsClauseRecords(clauses).filter((clause) => clause.relationshipEligible);
}

export function buildContractsClauseDisplayContentHe(clause = {}) {
  const pages = clause.pageStart === clause.pageEnd
    ? `עמוד ${clause.pageStart}`
    : `עמודים ${clause.pageStart}–${clause.pageEnd}`;
  return [
    "מקור: מסמכי החוזה",
    clause.displayLabelHe || contractsClauseDisplayLabelHe(clause.clauseKey, clause.clauseTitle),
    `סוג רשומה: ${clause.clauseTypeLabelHe || contractsClauseTypeLabelHe(clause.clauseType)}`,
    `תפקיד במסמך: ${clause.structuralRoleLabelHe || contractsStructuralRoleLabelHe(clause.structuralRole)}`,
    pages,
    clause.clauseTitle ? `כותרת: ${clause.clauseTitle}` : null,
    clause.summaryHe ? `תקציר: ${clause.summaryHe}` : null,
    clause.tagLabelsHe?.length ? `תגיות: ${clause.tagLabelsHe.join(" · ")}` : null,
    clause.crossReferences?.length
      ? `הפניות מפורשות: ${clause.crossReferences.map((reference) => reference.referenceText).join(" | ")}`
      : null,
    clause.rawText ? `טקסט מקורי:\n${clause.rawText}` : null
  ].filter(Boolean).join("\n");
}

function classifyStructuralRole(clause, { childCount, hashtags }) {
  const clauseType = String(clause?.clauseType || "");
  const clauseKey = String(clause?.clauseKey || "");
  if (clauseKey.endsWith(".heading")) return "heading";
  if (clauseType === "document_context") return "context";
  if (isTitleOnlyParentClause(clause, childCount)) return "heading";
  if (hashtags.includes("definitions")) return "definition";
  return "operative";
}

function isTitleOnlyParentClause(clause, childCount) {
  return clause?.clauseType === "clause"
    && childCount > 0
    && Boolean(String(clause?.clauseTitle || "").trim());
}

function headingLeadHe(clause) {
  const sourceLines = String(clause?.rawText || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return sourceLines.length > 1 ? sourceLines.slice(1).join(" ") : null;
}
