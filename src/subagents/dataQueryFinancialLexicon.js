const HEBREW_DIACRITICS = /[\u0591-\u05C7]/gu;
const HEBREW_PREFIXES = new Set(["ב", "כ", "ל", "מ", "ש", "ו", "ה"]);

export const DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT = 200;

function freezeEntry(entry) {
  return Object.freeze({
    ...entry,
    storedValues: Object.freeze([...entry.storedValues]),
    aliases: Object.freeze([...entry.aliases])
  });
}

// This vocabulary is deliberately explicit rather than fuzzy. Every stored value
// was observed in public.financial_transactions on 2026-07-28. Aliases cover
// reviewed spelling, number, and business-language variants; arbitrary edit-
// distance matching is intentionally excluded because adjacent financial types
// (for example order, purchase order, and purchase request) must fail closed.
export const DATA_QUERY_FINANCIAL_TYPE_LEXICON = Object.freeze([
  freezeEntry({
    key: "partial_account",
    storedValues: ["חשבון חלקי", "חשבבון חלקי"],
    hebrewSingular: "חשבון חלקי",
    hebrewPlural: "חשבונות חלקיים",
    englishSingular: "partial account",
    englishPlural: "partial accounts",
    aliases: [
      "חשבון חלקי", "החשבון החלקי", "חשבונות חלקיים", "החשבונות החלקיים",
      "חשבון חלקיים", "חשבונות חלקי", "חשבבון חלקי", "חשבבונות חלקיים",
      "חשבון ביניים", "חשבונות ביניים", "partial account", "partial accounts",
      "interim account", "interim accounts", "progress account", "progress accounts",
      "progress payment account", "progress payment accounts"
    ]
  }),
  freezeEntry({
    key: "invoice",
    storedValues: ["חשבונית"],
    hebrewSingular: "חשבונית",
    hebrewPlural: "חשבוניות",
    englishSingular: "invoice",
    englishPlural: "invoices",
    aliases: [
      "חשבונית", "חשבוניות", "חשבונית מס", "חשבוניות מס", "חשבונית ספק",
      "חשבוניות ספק", "חשבנית", "חשבניות", "invoice", "invoices", "tax invoice",
      "tax invoices", "supplier invoice", "supplier invoices"
    ]
  }),
  freezeEntry({
    key: "price_quote",
    storedValues: ["הצעת מחיר"],
    hebrewSingular: "הצעת מחיר",
    hebrewPlural: "הצעות מחיר",
    englishSingular: "price quote",
    englishPlural: "price quotes",
    aliases: [
      "הצעת מחיר", "הצעות מחיר", "הצאות מחיר", "price quote", "price quotes",
      "quotation", "quotations", "cost estimate", "cost estimates"
    ]
  }),
  freezeEntry({
    key: "receipt",
    storedValues: ["קבלה"],
    hebrewSingular: "קבלה",
    hebrewPlural: "קבלות",
    englishSingular: "receipt",
    englishPlural: "receipts",
    aliases: ["קבלה", "קבלות", "receipt", "receipts", "payment receipt", "payment receipts"]
  }),
  freezeEntry({
    key: "purchase_request",
    storedValues: ["דרישת רכש"],
    hebrewSingular: "דרישת רכש",
    hebrewPlural: "דרישות רכש",
    englishSingular: "purchase request",
    englishPlural: "purchase requests",
    aliases: [
      "דרישת רכש", "דרישות רכש", "בקשת רכש", "בקשות רכש", "purchase request",
      "purchase requests", "purchase requisition", "purchase requisitions",
      "procurement request", "procurement requests"
    ]
  }),
  freezeEntry({
    key: "purchase_order",
    storedValues: ["הזמנת רכש"],
    hebrewSingular: "הזמנת רכש",
    hebrewPlural: "הזמנות רכש",
    englishSingular: "purchase order",
    englishPlural: "purchase orders",
    aliases: [
      "הזמנת רכש", "הזמנות רכש", "הזמנת קניה", "הזמנות קניה", "purchase order",
      "purchase orders", "procurement order", "procurement orders"
    ]
  }),
  freezeEntry({
    key: "execution_account",
    storedValues: ["חשבון ביצוע"],
    hebrewSingular: "חשבון ביצוע",
    hebrewPlural: "חשבונות ביצוע",
    englishSingular: "execution account",
    englishPlural: "execution accounts",
    aliases: [
      "חשבון ביצוע", "חשבונות ביצוע", "חשבון עבודות", "חשבונות עבודות",
      "execution account", "execution accounts", "work account", "work accounts"
    ]
  }),
  freezeEntry({
    key: "purchase",
    storedValues: ["Purchase"],
    hebrewSingular: "רכישה",
    hebrewPlural: "רכישות",
    englishSingular: "purchase",
    englishPlural: "purchases",
    aliases: ["רכישה", "רכישות", "purchase", "purchases"]
  }),
  freezeEntry({
    key: "bank_guarantee_extension_request",
    storedValues: ["בקשה להארכת ערבות בנקאית"],
    hebrewSingular: "בקשה להארכת ערבות בנקאית",
    hebrewPlural: "בקשות להארכת ערבות בנקאית",
    englishSingular: "bank guarantee extension request",
    englishPlural: "bank guarantee extension requests",
    aliases: [
      "בקשה להארכת ערבות בנקאית", "בקשות להארכת ערבות בנקאית",
      "הארכת ערבות בנקאית", "הארכות ערבות בנקאית", "bank guarantee extension request",
      "bank guarantee extension requests", "bank guarantee extension", "bank guarantee extensions"
    ]
  }),
  freezeEntry({
    key: "profit_and_loss_report",
    storedValues: ["דו\"ח רווח והפסד"],
    hebrewSingular: "דו\"ח רווח והפסד",
    hebrewPlural: "דוחות רווח והפסד",
    englishSingular: "profit and loss report",
    englishPlural: "profit and loss reports",
    aliases: [
      "דוח רווח והפסד", "דוחות רווח והפסד", "דו\"ח רווח והפסד", "דו״ח רווח והפסד",
      "רווח והפסד", "profit and loss report", "profit and loss reports", "profit loss report",
      "profit loss reports", "p and l report", "p and l reports", "pnl report", "pnl reports"
    ]
  }),
  freezeEntry({
    key: "training",
    storedValues: ["הדרכה"],
    hebrewSingular: "הדרכה",
    hebrewPlural: "הדרכות",
    englishSingular: "training transaction",
    englishPlural: "training transactions",
    aliases: ["הדרכה", "הדרכות", "training", "trainings", "training transaction", "training transactions"],
    requiresFinancialQualifier: true
  }),
  freezeEntry({
    key: "order",
    storedValues: ["הזמנה"],
    hebrewSingular: "הזמנה",
    hebrewPlural: "הזמנות",
    englishSingular: "order",
    englishPlural: "orders",
    aliases: ["הזמנה", "הזמנות", "order", "orders"],
    requiresFinancialQualifier: true
  }),
  freezeEntry({
    key: "transfer",
    storedValues: ["העברה"],
    hebrewSingular: "העברה",
    hebrewPlural: "העברות",
    englishSingular: "transfer",
    englishPlural: "transfers",
    aliases: ["העברה", "העברות", "העברה בנקאית", "העברות בנקאיות", "transfer", "transfers", "bank transfer", "bank transfers"],
    requiresFinancialQualifier: true
  }),
  freezeEntry({
    key: "unknown_hs",
    storedValues: ["הש"],
    hebrewSingular: "הש",
    hebrewPlural: "הש",
    englishSingular: "stored type הש",
    englishPlural: "stored type הש",
    aliases: ["סוג עסקה הש", "סוג מסמך הש", "transaction type hs"],
    requiresFinancialQualifier: true,
    exactOnly: true
  }),
  freezeEntry({
    key: "rental",
    storedValues: ["השכרה"],
    hebrewSingular: "השכרה",
    hebrewPlural: "השכרות",
    englishSingular: "rental",
    englishPlural: "rentals",
    aliases: ["השכרה", "השכרות", "דמי שכירות", "rental", "rentals", "rental transaction", "rental transactions"],
    requiresFinancialQualifier: true
  }),
  freezeEntry({
    key: "contract_balance",
    storedValues: ["יתרת הסכם"],
    hebrewSingular: "יתרת הסכם",
    hebrewPlural: "יתרות הסכם",
    englishSingular: "contract balance",
    englishPlural: "contract balances",
    aliases: ["יתרת הסכם", "יתרות הסכם", "יתרת חוזה", "יתרות חוזה", "contract balance", "contract balances", "agreement balance", "agreement balances"]
  }),
  freezeEntry({
    key: "additional_work",
    storedValues: ["עבודות נוספות"],
    hebrewSingular: "עבודה נוספת",
    hebrewPlural: "עבודות נוספות",
    englishSingular: "additional-work transaction",
    englishPlural: "additional-work transactions",
    aliases: ["עבודה נוספת", "עבודות נוספות", "additional work", "additional works", "extra work", "extra works"],
    requiresFinancialQualifier: true,
    crossDomainAmbiguous: true
  }),
  freezeEntry({
    key: "additional_costs",
    storedValues: ["עלויות נוספות"],
    hebrewSingular: "עלות נוספת",
    hebrewPlural: "עלויות נוספות",
    englishSingular: "additional-cost transaction",
    englishPlural: "additional-cost transactions",
    aliases: ["עלות נוספת", "עלויות נוספות", "additional cost", "additional costs", "extra cost", "extra costs"],
    requiresFinancialQualifier: true,
    crossDomainAmbiguous: true
  })
]);

export const DATA_QUERY_FINANCIAL_TRANSACTION_TYPE_VALUES = Object.freeze([
  ...new Set(DATA_QUERY_FINANCIAL_TYPE_LEXICON.flatMap((entry) => entry.storedValues))
]);

export function dataQueryFinancialTypeForStoredValue(value) {
  const storedValue = String(value ?? "");
  return DATA_QUERY_FINANCIAL_TYPE_LEXICON.find((entry) => entry.storedValues.includes(storedValue)) || null;
}

const FINANCIAL_QUALIFIER = /\b(?:financial|finance|transaction|transactions|transaction\s+type|document\s+type)\b|סוג\s+(?:ה)?עסק(?:ה|אות)|עסק(?:ה|אות)\s+מסוג|סוג\s+(?:ה)?מסמ(?:ך|כים)|מסמ(?:ך|כים)\s+פיננס(?:י|יים|ים)|נתונים\s+פיננסיים/iu;
const EXCEPTION_QUALIFIER = /\b(?:exception|exceptions|change\s+order|change\s+orders|variation|variations)\b|חריג(?:ה|ים|ות)|דוח(?:ות)?\s+חריגים|פקוד(?:ת|ות)\s+שינוי|הורא(?:ת|ות)\s+שינוי/iu;

export function normalizeDataQueryFinancialTypeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(HEBREW_DIACRITICS, "")
    .replace(/[״“”„'׳`]/gu, " ")
    .replace(/&/gu, " and ")
    .replace(/[־–—_\-/\\]/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function firstTokenMatches(value, alias) {
  if (value === alias) return true;
  if (alias.length < 3) return false;
  let candidate = value;
  for (let index = 0; index < 2 && candidate.length > alias.length; index += 1) {
    if (!HEBREW_PREFIXES.has(candidate[0])) break;
    candidate = candidate.slice(1);
    if (candidate === alias) return true;
  }
  return false;
}

function phraseMatch(normalizedText, normalizedAlias) {
  const textTokens = normalizedText.split(" ").filter(Boolean);
  const aliasTokens = normalizedAlias.split(" ").filter(Boolean);
  if (!aliasTokens.length || aliasTokens.length > textTokens.length) return null;
  for (let start = 0; start <= textTokens.length - aliasTokens.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < aliasTokens.length; offset += 1) {
      const tokenMatches = offset === 0
        ? firstTokenMatches(textTokens[start + offset], aliasTokens[offset])
        : textTokens[start + offset] === aliasTokens[offset] ||
          (textTokens[start + offset].startsWith("ה") && textTokens[start + offset].slice(1) === aliasTokens[offset]);
      if (!tokenMatches) {
        matches = false;
        break;
      }
    }
    if (matches) return { start, length: aliasTokens.length };
  }
  return null;
}

export function analyzeDataQueryFinancialTransactionType(value) {
  const normalizedText = normalizeDataQueryFinancialTypeText(value);
  if (!normalizedText) return { match: null, ambiguous: false, reason: null, normalizedText };
  const financialQualified = FINANCIAL_QUALIFIER.test(String(value || ""));
  const exceptionQualified = EXCEPTION_QUALIFIER.test(String(value || ""));
  const matches = [];
  for (const entry of DATA_QUERY_FINANCIAL_TYPE_LEXICON) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeDataQueryFinancialTypeText(alias);
      const location = phraseMatch(normalizedText, normalizedAlias);
      if (!location) continue;
      if (entry.requiresFinancialQualifier && !financialQualified) {
        if (entry.crossDomainAmbiguous && !exceptionQualified) {
          matches.push({ entry, alias, normalizedAlias, location, blocked: true });
        }
        continue;
      }
      matches.push({ entry, alias, normalizedAlias, location, blocked: false });
    }
  }
  const allowed = matches.filter((item) => !item.blocked)
    .sort((left, right) =>
      right.location.length - left.location.length ||
      right.normalizedAlias.length - left.normalizedAlias.length
    );
  if (!allowed.length) {
    const blocked = matches.some((item) => item.blocked);
    return {
      match: null,
      ambiguous: blocked,
      reason: blocked ? "financial_type_requires_explicit_financial_qualifier" : null,
      normalizedText
    };
  }
  const winner = allowed[0];
  const competing = allowed.find((item) =>
    item.entry.key !== winner.entry.key &&
    !winner.normalizedAlias.includes(item.normalizedAlias)
  );
  if (competing) {
    return {
      match: null,
      ambiguous: true,
      reason: "multiple_financial_transaction_types",
      normalizedText
    };
  }
  return {
    match: {
      key: winner.entry.key,
      storedValues: [...winner.entry.storedValues],
      hebrewSingular: winner.entry.hebrewSingular,
      hebrewPlural: winner.entry.hebrewPlural,
      englishSingular: winner.entry.englishSingular,
      englishPlural: winner.entry.englishPlural,
      matchedAlias: winner.alias,
      exactOnly: winner.entry.exactOnly === true
    },
    ambiguous: false,
    reason: null,
    normalizedText
  };
}

export function dataQueryFinancialTransactionTypeFilter(match) {
  const values = Array.isArray(match?.storedValues) ? [...new Set(match.storedValues)] : [];
  if (!values.length) return null;
  return values.length === 1
    ? { field: "transaction_type", op: "eq", value: values[0] }
    : { field: "transaction_type", op: "in", value: values };
}

export function isDataQueryFinancialAllListIntent(value) {
  const normalized = normalizeDataQueryFinancialTypeText(value);
  if (/\b(?:latest|newest|most\s+recent|last|earliest|oldest|first)\b|(?:ה)?אחרו(?:ן|נה|נים|נות)|(?:ה)?ראשו(?:ן|נה|נים|נות)|הכי\s+(?:חדש|חדשה|חדשים|חדשות|מוקדם|מוקדמת)|היש(?:ן|נה)\s+ביותר/iu.test(normalized)) {
    return false;
  }
  return /^(?:(?:תמנה|מנה|הצג|תציג|הראה|תראה|תן|תני|תביא|הבא|רשום|פרט)(?:\s+לי)?(?:\s+את)?(?:\s+כל)?|(?:show|list|display|enumerate|give)(?:\s+me)?(?:\s+(?:all|the))?|(?:what|which)\s+(?:are\s+)?all(?:\s+the)?|(?:מהם|מהן)\s+כל)(?=\s|$)/iu.test(normalized);
}
