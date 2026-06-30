import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "connections", label: "חיבורים" },
  { id: "agents",      label: "סוכני AI" },
  { id: "retrieval",   label: "שליפה ו-RAG" },
  { id: "content",     label: "Content DB" },
  { id: "tools",       label: "כלים n8n" },
  { id: "performance", label: "ביצועים ו-Cache" },
  { id: "presets",     label: "פריסטים" },
  { id: "general",     label: "כללי" },
];

const AGENTS = [
  { key: "classifier",       label: "Classifier",       desc: "ניתוב וסיווג השאלה",       promptRows: 9  },
  { key: "knowledgePlanner", label: "Knowledge Planner", desc: "תכנון חיפוש ידע מקומי",    promptRows: 9  },
  { key: "main",             label: "Main",              desc: "תשובת הצ׳אט הראשית",        promptRows: 12, wide: true },
  { key: "lite",             label: "Lite",              desc: "משימות קצרות ועזר",          promptRows: 7  },
  { key: "reranker",         label: "Reranker",          desc: "דירוג מקורות לפני תשובה",   promptRows: 9  },
  { key: "qa",               label: "QA Report",         desc: "ניתוח איכות ריצה",           promptRows: 9  },
];

// Field-level explanations — shown when the round "i" button is clicked.
// Mirrors the original parameterExplanation() map from the legacy app.js.
const EXPLANATIONS = {
  // Agent model params
  temperature: "קובע כמה התשובה תהיה יצירתית או צפויה. ערך נמוך נותן תשובות יציבות ומדויקות יותר; ערך גבוה נותן ניסוח מגוון יותר.",
  maxTokens:   "מגביל את אורך התשובה שהמודל יכול לייצר. ערך גבוה מאפשר תשובה מפורטת יותר, אבל יכול לעלות יותר ולקחת יותר זמן.",
  timeoutMs:   "כמה זמן המערכת תחכה לתשובת המודל לפני שהיא מחשיבה את הקריאה כתקועה. נמדד במילישניות.",

  // Embedding & hybrid search
  embeddingModel:   "המודל שיוצר את הווקטורים (embeddings) של הטקסט לצורך חיפוש סמנטי. חייב להתאים למודל שבו נוצר האינדקס ב-Supabase.",
  hybridRpcName:    "שם פונקציית ה-RPC ב-Supabase שמריצה את החיפוש ההיברידי (וקטורי + מילולי). חייב להתאים לפונקציה שקיימת במסד.",
  hybridCandidates: "כמה שורות כל חיפוש היברידי ראשי יבקש מ-Supabase. ערך גבוה מגדיל כיסוי, אך מוסיף זמן, עומס ועלות דירוג.",
  plannerCandidates:"כמה שורות תוחזרנה מכל שאילתת חיפוש נוספת שה-Knowledge Planner יוצר. הכמות הכוללת יכולה להיות מספר השאילתות כפול ערך זה.",
  alertCandidates:  "כמה התראות סוכן Alerts יבקש מפונקציית החיפוש לפני סינון תאריכים וסיכום התוצאה.",
  rerankTopK:       "כמה מהשורות שנמצאו יישארו לאחר דירוג הרלוונטיות. רק התוצאות המדורגות ביותר ממשיכות לשלבים הבאים.",
  vectorWeight:     "משקל החיפוש הסמנטי (וקטורי) בציון ההיברידי. ביחד עם משקל המילים הוא קובע איזה סוג התאמה חשוב יותר. בדרך כלל מסתכם ל-1 עם משקל המילים.",
  keywordWeight:    "משקל החיפוש המילולי (מילות מפתח) בציון ההיברידי. ערך גבוה מחזק התאמות טקסטואליות מדויקות על פני התאמה משמעותית.",

  // RAG context
  ragContextRecordsLimit:   "כמה מקורות אחרי החיפוש והדירוג ייכנסו בפועל לסוכן הראשי. יותר מקורות נותנים כיסוי רחב יותר אבל עלולים להעמיס.",
  ragChunkTextLimit:        "כמה תווים מכל מקור ייכנסו לפרומפט. ערך גבוה נותן יותר הקשר מכל מקור, אבל מגדיל עלות וזמן.",
  ragPlannerExtraQueriesLimit:"כמה שאילתות נוספות Knowledge Planner רשאי להריץ מעבר לשאלה המקורית.",

  // Graph context
  graphLimit:    "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט. ערך 0 מכבה את שילוב הגרף.",
  graphDaysBack: "כמה ימים אחורה לחפש קשרים בגרף הפרויקט סביב תוצאות ה-RAG.",

  // Timeline
  timelineLimit:    "מספר השורות המקסימלי שיימשכו עבור ציר הזמן. ערך גבוה מציג היסטוריה מלאה יותר אבל כבד יותר לטעינה.",
  timelineDaysBack: "כמה ימים אחורה לכלול באירועי ציר הזמן. מגביל את חלון הזמן הנשלף מהמסד.",

  // Graph (correct backend keys)
  graphSearchLimit:  "כמה קשרים/צמתים לחפש בגרף סביב תוצאות ה-RAG.",
  graphContextLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט.",
  graphEnabled:      "כאשר פעיל, הצ׳אט משתמש בגרף הפרויקט כדי לזהות קשרים בין אירועים, ספקים, נושאים וסיכונים.",
  graphExpandedForListQuestions: "בשאלות כמו 'מי', 'מה עוד', או 'רשימה', מאפשר להכניס יותר קשרי גרף כדי לא לפספס מועמדים.",

  // Knowledge Base (advanced)
  knowledgeAgentLimit: "כמה סוכני Knowledge Base מקומיים אפשר לבחור לשאלה אחת.",
  knowledgeTopK:       "כמה קטעי ידע מקומי יוחזרו מכל סוכן ידע שנבחר.",
  knowledgeChunkSize:  "האורך המקסימלי של כל קטע ידע מקומי שנכנס לתכנון החיפוש.",

  // Tools runtime
  toolsParallelLimit:        "כמה כלי N8N אפשר להריץ במקביל באותה שאלה.",
  toolsEnabled:              "כאשר כבוי, הצ׳אט לא יקרא לכלי N8N חיצוניים, אבל RAG ו-Graph עדיין יכולים לעבוד.",
  toolsAlertAgentEnabled:    "כאשר פעיל, סוכן ההתראות יכול למשוך ולסכם נתונים מטבלת alerts.",
  toolsSafetyPrecheckEnabled:"כאשר פעיל, שאלות דחופות או בטיחותיות מפעילות בדיקה מוקדמת לפני שאר הכלים.",

  // Alert agent model params
  alertTemperature: "קובע כמה התשובה של סוכן ההתראות תהיה יציבה. ערך נמוך נותן ניתוח עקבי יותר.",
  alertMaxTokens:   "מגביל את אורך התשובה של סוכן ההתראות.",
  alertTimeoutMs:   "כמה זמן לחכות לתשובת סוכן ההתראות לפני שמחשיבים את הקריאה כתקועה. נמדד במילישניות.",

  // Cache
  cacheEnabled:         "כאשר פעיל, תשובות ותוצאות חיפוש נשמרות זמנית כדי להאיץ שאלות חוזרות ולהפחית עלות.",
  cacheProvider:        "היכן לשמור את ה-cache: Memory לפיתוח (נמחק בכל הפעלה), Redis ל-Production, או ללא cache.",
  cacheRedisUrl:        "כתובת חיבור ל-Redis כאשר נבחר provider מסוג Redis. נשמר כסוד — השאר ריק כדי לשמור את הערך הקיים.",
  cacheMemoryMaxEntries:"מספר הרשומות המקסימלי שיישמרו ב-cache מסוג Memory לפני שהישנות נמחקות.",
};

const TIMEZONES = [
  "UTC-12","UTC-11","UTC-10","UTC-9","UTC-8","UTC-7","UTC-6","UTC-5",
  "UTC-4","UTC-3","UTC-2","UTC-1","UTC+0 (Greenwich)",
  "UTC+1","UTC+2","Asia/Jerusalem","UTC+3","UTC+4","UTC+5",
  "UTC+5:30 (הודו)","UTC+6","UTC+7","UTC+8","UTC+9","UTC+10","UTC+11","UTC+12",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function deepSet(obj, path, value) {
  const keys = path.split(".");
  const result = { ...obj };
  let cur = result;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...cur[keys[i]] };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return result;
}

function settingsToForm(s) {
  if (!s) return {};
  return {
    models:        { ...s.models },
    prompts:       { ...s.prompts },
    ai:            s.ai ? JSON.parse(JSON.stringify(s.ai)) : {},
    retrieval:     { ...s.retrieval },
    rag:           { ...s.rag },
    graph:         { ...s.graph },
    cache:         { ...s.cache, redisUrl: "" },
    knowledge:     { ...s.knowledge, triggerKeywords: (s.knowledge?.triggerKeywords || []).join("\n") },
    toolsRuntime:  { ...s.toolsRuntime },
    secrets:       { openRouterApiKey: "", supabaseUrl: s.secrets?.supabaseUrl || "", supabaseServiceRoleKey: "" },
    contentSource: { ...s.contentSource },
    n8nBaseUrl:    s.n8nBaseUrl || "",
    tools:         s.tools ? Object.fromEntries(Object.entries(s.tools).map(([k, v]) => [k, v?.url || ""])) : {},
    timezone:      s.timezone || "Asia/Jerusalem",
    presets:       s.presets || [],
  };
}

function formToPayload(form) {
  return {
    models:    form.models,
    prompts:   form.prompts,
    ai:        form.ai,
    retrieval: form.retrieval,
    rag:       form.rag,
    graph:     form.graph,
    cache:     form.cache,
    knowledge: { ...form.knowledge, triggerKeywords: (form.knowledge?.triggerKeywords || "").split("\n").map(s => s.trim()).filter(Boolean) },
    toolsRuntime: form.toolsRuntime,
    secrets:   form.secrets,
    contentSource: form.contentSource,
    n8nBaseUrl: form.n8nBaseUrl,
    tools:     Object.fromEntries(Object.entries(form.tools || {}).map(([k, v]) => [k, { url: v }])),
    timezone:  form.timezone,
  };
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icon = ({ path, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={path} />
  </svg>
);

const icons = {
  info:        "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-11v5m0-8h.01",
  connections: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  agents:      "M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM3.5 22a8.5 8.5 0 0 1 17 0",
  retrieval:   "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  content:     "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm0 5h16M8 3v4M16 3v4",
  tools:       "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4L19 3.3a1 1 0 0 0-1.4 0zM5 17l-1 4 4-1L20 8l-3-3zM16 5l3 3",
  presets:     "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  performance: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.5-1.5L18 8M5 19a9 9 0 1 1 14 0",
  general:     "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-14v4l3 3",
  save:        "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  reload:      "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.5L23 10M1 14l4.7 4.5A9 9 0 0 0 20.5 15",
  upload:      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  eye:         "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff:      "M17.9 17.4A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22",
  check:       "M20 6L9 17l-5-5",
  warning:     "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  chevronDown: "M6 9l6 6 6-6",
  plus:        "M12 5v14M5 12h14",
};

// ─── Reusable Form Components ─────────────────────────────────────────────────

const s = {
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" },
  input: {
    padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-strong)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 13,
    fontFamily: "var(--font-display)", width: "100%", boxSizing: "border-box",
    transition: "border-color .15s",
    outline: "none",
  },
  hint: { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 },
  card: {
    background: "var(--surface)", border: "1px solid var(--line)",
    borderRadius: "var(--r-xl)", padding: "18px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,.04)",
  },
  section: { display: "flex", flexDirection: "column", gap: 20 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "var(--text-muted)", letterSpacing: .6, textTransform: "uppercase", margin: "4px 0 10px" },
};

function Field({ label, hint, info, children, wide }) {
  return (
    <div style={{ ...(wide ? { gridColumn: "1 / -1" } : {}), ...s.label }}>
      {label && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          {info && <InfoButton text={info} label={label} />}
        </span>
      )}
      {children}
      {hint && <p style={s.hint}>{hint}</p>}
    </div>
  );
}

// Self-contained "i" affordance: the explanation floats in an overlay popover
// anchored to the button instead of pushing inline text into the layout.
function InfoButton({ text, label }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapRef = useRef(null);
  const active = open || hover;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={`מידע על ${typeof label === "string" ? label : "השדה"}`}
        aria-expanded={open}
        style={{
          width: 16, height: 16, minHeight: 16, minWidth: 16, flex: "0 0 auto",
          display: "inline-grid", placeItems: "center", padding: 0, margin: 0, lineHeight: 0,
          borderRadius: "999px", border: "none", background: "none",
          color: active ? "var(--brand-500)" : "var(--text-muted)",
          cursor: "pointer", transition: "color .15s, transform .15s",
          transform: active ? "scale(1.08)" : "scale(1)",
        }}
      >
        <Icon path={icons.info} size={15} strokeWidth={1.9} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 9px)", insetInlineEnd: -4,
            zIndex: 50, width: 264, maxWidth: 300,
            background: "var(--surface)", color: "var(--text-secondary)",
            border: "1px solid var(--line-strong)", borderRadius: "var(--r-lg, 12px)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, .18)",
            padding: "11px 13px", fontSize: 12.5, fontWeight: 500,
            lineHeight: 1.6, textAlign: "right", fontStyle: "normal",
            whiteSpace: "normal", cursor: "default",
            animation: "bidocFade .12s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{
            position: "absolute", top: -6, insetInlineEnd: 8, width: 11, height: 11,
            background: "var(--surface)", borderTop: "1px solid var(--line-strong)",
            borderInlineStart: "1px solid var(--line-strong)", transform: "rotate(45deg)",
          }} />
          {text}
        </span>
      )}
    </span>
  );
}

function InfoHint({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 7,
      color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.55,
      background: "var(--surface-2)", border: "1px solid var(--line)",
      borderRadius: "var(--r)", padding: "8px 12px", marginTop: 2,
    }}>
      <Icon path={icons.info} size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--brand-500)" }} />
      <span>{children}</span>
    </div>
  );
}

const focusRing = "0 0 0 3px rgba(63, 141, 104, .16)";

function Input({ value, onChange, type = "text", placeholder, min, max, step, style }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value ?? ""} placeholder={placeholder}
      min={min} max={max} step={step}
      onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...s.input,
        borderColor: focused ? "var(--brand-500)" : undefined,
        boxShadow: focused ? focusRing : "none", ...style }}
    />
  );
}

function Select({ value, onChange, children, style }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value ?? ""} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...s.input, cursor: "pointer",
        borderColor: focused ? "var(--brand-500)" : undefined,
        boxShadow: focused ? focusRing : "none", ...style }}
    >
      {children}
    </select>
  );
}

function Toggle({ label, checked, onChange, info }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
      fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
    }}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative", width: 36, height: 20, minHeight: 20, minWidth: 36, flexShrink: 0,
          borderRadius: 999, border: "none", cursor: "pointer", padding: 0, margin: 0,
          background: checked ? "var(--brand-500)" : "var(--line-strong)",
          transition: "background .18s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left .18s cubic-bezier(.4,0,.2,1)", boxShadow: "0 1px 2px rgba(0,0,0,.28)",
        }} />
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        {info && <InfoButton text={info} label={label} />}
      </span>
    </label>
  );
}

function Textarea({ value, onChange, rows = 6, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value ?? ""} rows={rows} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      spellCheck={false}
      style={{ ...s.input, resize: "vertical", lineHeight: 1.5,
        borderColor: focused ? "var(--brand-500)" : undefined,
        boxShadow: focused ? focusRing : "none" }}
    />
  );
}

function PasswordField({ label, value, onChange, placeholder, hint, info }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} info={info}>
      <div style={{ position: "relative" }}>
        <Input type={show ? "text" : "password"} value={value} onChange={onChange}
          placeholder={placeholder} style={{ paddingLeft: 36 }} />
        <button onClick={() => setShow(v => !v)}
          style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
          title={show ? "הסתר" : "הצג"}>
          <Icon path={show ? icons.eyeOff : icons.eye} size={15} />
        </button>
      </div>
    </Field>
  );
}

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 4 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "8px 0", background: "none", border: "none",
        cursor: "pointer", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 500,
        fontFamily: "var(--font-display)",
      }}>
        {title}
        <Icon path={icons.chevronDown} size={14}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  );
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: ok ? "var(--brand-500)" : "var(--text-muted)",
      boxShadow: ok ? "0 0 0 3px rgba(63,141,104,.15)" : "none",
    }} title={ok ? "מוגדר" : "לא מוגדר"} />
  );
}

function ModelSelect({ value, onChange, models, includeEmbedding = false }) {
  return (
    <Select value={value} onChange={onChange}>
      <option value="">— ברירת מחדל —</option>
      {models.map(m => (
        <option key={m.id} value={m.id}>
          {m.name || m.id}{m.contextLength ? ` · ${Number(m.contextLength).toLocaleString()}` : ""}
        </option>
      ))}
    </Select>
  );
}

// ─── Section: Connections ─────────────────────────────────────────────────────

function ConnectionsSection({ form, update, configStatus }) {
  return (
    <div style={s.section}>
      <div>
        <p style={s.sectionTitle}>OpenRouter</p>
        <div style={s.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <StatusDot ok={configStatus?.openRouter} />
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              {configStatus?.openRouter ? "OpenRouter מוגדר" : "OpenRouter לא מוגדר"}
            </span>
          </div>
          <PasswordField
            label="OpenRouter API Key"
            value={form.secrets?.openRouterApiKey}
            onChange={v => update("secrets.openRouterApiKey", v)}
            placeholder="sk-or-..."
            hint="השאר ריק כדי לשמור את הערך הקיים"
          />
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>App Supabase</p>
        <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot ok={configStatus?.supabase} />
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              {configStatus?.supabase ? "App Supabase מוגדר" : "App Supabase לא מוגדר"}
            </span>
          </div>
          <Field label="Supabase URL">
            <Input value={form.secrets?.supabaseUrl} onChange={v => update("secrets.supabaseUrl", v)}
              placeholder="https://xxxx.supabase.co" />
          </Field>
          <PasswordField
            label="Service Role Key"
            value={form.secrets?.supabaseServiceRoleKey}
            onChange={v => update("secrets.supabaseServiceRoleKey", v)}
            placeholder="eyJ..."
            hint="השאר ריק כדי לשמור את הערך הקיים"
          />
        </div>
      </div>

      <InfoHint>המפתחות נשמרים בטבלת <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5, border: "1px solid var(--line)" }}>agent_settings</code> ב-Supabase. השאר שדות ריקים כדי לשמור את הערכים הקיימים.</InfoHint>
    </div>
  );
}

// ─── Section: Agents ─────────────────────────────────────────────────────────

function AgentCard({ agent, models, form, update }) {
  const modelVal = form.models?.[agent.key] || "";
  const promptVal = form.prompts?.[agent.key] || "";
  const aiCfg = form.ai?.[agent.key] || {};

  return (
    <article style={{
      ...s.card,
      display: "flex", flexDirection: "column", gap: 10,
      ...(agent.wide ? { gridColumn: "1 / -1" } : {}),
    }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{agent.label}</strong>
          <p style={{ ...s.hint, marginTop: 2 }}>{agent.desc}</p>
        </div>
      </header>

      <Field label="מודל">
        <ModelSelect value={modelVal} onChange={v => update(`models.${agent.key}`, v)} models={models} />
      </Field>

      <Accordion title="פרומפט">
        <Textarea value={promptVal} rows={agent.promptRows}
          onChange={v => update(`prompts.${agent.key}`, v)}
          placeholder="פרומפט ברירת מחדל — השאר ריק כדי להשתמש בקבוע מ-prompts.js" />
      </Accordion>

      <Accordion title="הגדרות מודל" defaultOpen>
        <div style={{ ...s.grid3, marginTop: 8 }}>
          <Field label="Temperature" info={EXPLANATIONS.temperature}>
            <Input type="number" value={aiCfg.temperature ?? 0} min={0} max={2} step={0.05}
              onChange={v => update(`ai.${agent.key}.temperature`, v)} />
          </Field>
          <Field label="Max Tokens" info={EXPLANATIONS.maxTokens}>
            <Input type="number" value={aiCfg.maxTokens ?? 4096} min={16} max={32000} step={50}
              onChange={v => update(`ai.${agent.key}.maxTokens`, v)} />
          </Field>
          <Field label="Timeout (ms)" info={EXPLANATIONS.timeoutMs}>
            <Input type="number" value={aiCfg.timeoutMs ?? 90000} min={5000} max={180000} step={1000}
              onChange={v => update(`ai.${agent.key}.timeoutMs`, v)} />
          </Field>
        </div>
      </Accordion>
    </article>
  );
}

function AgentsSection({ models, form, update, onRefreshModels, modelStatus }) {
  return (
    <div style={s.section}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <InfoHint>כל מה שמשפיע על תשובות הצ׳אט: מודלים, פרומפטים, הגדרות temperature ו-maxTokens לכל סוכן. השאר שדה ריק כדי להשתמש בפרומפט ברירת המחדל מ-prompts.js.</InfoHint>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {modelStatus && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{modelStatus}</span>}
          <Btn onClick={onRefreshModels} title="רענן רשימת מודלים מ-OpenRouter">
            <Icon path={icons.reload} size={14} /> רענן מודלים
          </Btn>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {AGENTS.map(agent => (
          <AgentCard key={agent.key} agent={agent} models={models} form={form} update={update} />
        ))}
      </div>
    </div>
  );
}

// ─── Section: Retrieval & RAG ─────────────────────────────────────────────────

function RetrievalSection({ models, form, update }) {
  const embModels = models.filter(m => m.id?.includes("embed") || m.id?.includes("text-embed"));

  return (
    <div style={s.section}>
      <div>
        <p style={s.sectionTitle}>Embedding & Hybrid Search</p>
        <div style={s.card}>
          <div style={{ ...s.grid2, gap: 12 }}>
            <Field label="Embedding Model" wide info={EXPLANATIONS.embeddingModel}>
              <ModelSelect value={form.models?.embedding} onChange={v => update("models.embedding", v)} models={models} />
            </Field>
            <Field label="Hybrid RPC Name" wide info={EXPLANATIONS.hybridRpcName}>
              <Input value={form.retrieval?.rpcName} onChange={v => update("retrieval.rpcName", v)}
                placeholder="hybrid_match_data_index_..." />
            </Field>
            <Field label="Hybrid Candidates" info={EXPLANATIONS.hybridCandidates}>
              <Input type="number" value={form.retrieval?.candidates ?? 40} min={1} max={200}
                onChange={v => update("retrieval.candidates", v)} />
            </Field>
            <Field label="Planner Candidates" info={EXPLANATIONS.plannerCandidates}>
              <Input type="number" value={form.retrieval?.plannerCandidates ?? 20} min={1} max={100}
                onChange={v => update("retrieval.plannerCandidates", v)} />
            </Field>
            <Field label="Alert Candidates" info={EXPLANATIONS.alertCandidates}>
              <Input type="number" value={form.retrieval?.alertCandidates ?? 20} min={1} max={100}
                onChange={v => update("retrieval.alertCandidates", v)} />
            </Field>
            <Field label="Reranker Top-K" info={EXPLANATIONS.rerankTopK}>
              <Input type="number" value={form.retrieval?.rerankTopK ?? 10} min={1} max={100}
                onChange={v => update("retrieval.rerankTopK", v)} />
            </Field>
            <Field label="Vector Weight" info={EXPLANATIONS.vectorWeight}>
              <Input type="number" value={form.retrieval?.vectorWeight ?? 0.65} min={0} max={1} step={0.05}
                onChange={v => update("retrieval.vectorWeight", v)} />
            </Field>
            <Field label="Keyword Weight" info={EXPLANATIONS.keywordWeight}>
              <Input type="number" value={form.retrieval?.keywordWeight ?? 0.35} min={0} max={1} step={0.05}
                onChange={v => update("retrieval.keywordWeight", v)} />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>RAG Context</p>
        <InfoHint>קובע כמה מקורות וכמה טקסט מכל מקור נכנסים בפועל לתשובת ה-AI. השורות מצטמצמות לאורך המשפך: אחזור ראשוני → דירוג מחדש → context שנכנס לסוכן הראשי.</InfoHint>
        <div style={{ ...s.card, marginTop: 10 }}>
          <div style={s.grid3}>
            <Field label="Context Records" info={EXPLANATIONS.ragContextRecordsLimit}>
              <Input type="number" value={form.rag?.contextRecordsLimit ?? 12} min={1} max={50}
                onChange={v => update("rag.contextRecordsLimit", v)} />
            </Field>
            <Field label="Chunk Text Limit" info={EXPLANATIONS.ragChunkTextLimit}>
              <Input type="number" value={form.rag?.chunkTextLimit ?? 1800} min={100} max={10000}
                onChange={v => update("rag.chunkTextLimit", v)} />
            </Field>
            <Field label="Planner Extra Queries" info={EXPLANATIONS.ragPlannerExtraQueriesLimit}>
              <Input type="number" value={form.rag?.plannerExtraQueriesLimit ?? 0} min={0} max={10}
                onChange={v => update("rag.plannerExtraQueriesLimit", v)} />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>Graph Context</p>
        <InfoHint>קובע האם וכמה קשרים מגרף הפרויקט ייכנסו לשאלות RAG — קישורי לוח זמנים, קשרי ישויות ואיתותים.</InfoHint>
        <div style={{ ...s.card, marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={s.grid2}>
            <Field label="Graph Search Limit" info={EXPLANATIONS.graphSearchLimit}>
              <Input type="number" value={form.graph?.searchLimit ?? 30} min={1} max={100}
                onChange={v => update("graph.searchLimit", v)} />
            </Field>
            <Field label="Graph Context Limit" info={EXPLANATIONS.graphContextLimit}>
              <Input type="number" value={form.graph?.contextLimit ?? 12} min={1} max={50}
                onChange={v => update("graph.contextLimit", v)} />
            </Field>
          </div>
          <Toggle
            label="להשתמש בגרף בתשובות צ׳אט"
            checked={form.graph?.enabled !== false}
            onChange={v => update("graph.enabled", v)}
            info={EXPLANATIONS.graphEnabled}
          />
          <Toggle
            label="להרחיב גרף בשאלות רשימה/חקירה"
            checked={form.graph?.expandedForListQuestions !== false}
            onChange={v => update("graph.expandedForListQuestions", v)}
            info={EXPLANATIONS.graphExpandedForListQuestions}
          />
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>Timeline</p>
        <div style={s.card}>
          <div style={s.grid2}>
            <Field label="Timeline Limit (rows)" info={EXPLANATIONS.timelineLimit}>
              <Input type="number" value={form.retrieval?.timelineLimit ?? 1000} min={10} max={10000}
                onChange={v => update("retrieval.timelineLimit", v)} />
            </Field>
            <Field label="Days Back" info={EXPLANATIONS.timelineDaysBack}>
              <Input type="number" value={form.retrieval?.timelineDaysBack ?? 1825} min={1} max={36500}
                onChange={v => update("retrieval.timelineDaysBack", v)} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Content DB ──────────────────────────────────────────────────────

function ContentDbSection({ form, update, configStatus }) {
  return (
    <div style={s.section}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusDot ok={configStatus?.contentSupabase} />
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          {configStatus?.contentSupabase ? "Content DB מוגדר" : "Content DB לא מוגדר — המערכת תשתמש ב-App Supabase"}
        </span>
      </div>

      <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Content Supabase URL">
          <Input value={form.contentSource?.url} onChange={v => update("contentSource.url", v)}
            placeholder="https://content-project.supabase.co" />
        </Field>
        <PasswordField
          label="Service Role Key"
          value={form.contentSource?.serviceRoleKey}
          onChange={v => update("contentSource.serviceRoleKey", v)}
          placeholder="sb_secret_..."
        />
        <div style={s.grid2}>
          <Field label="Hybrid RPC Name">
            <Input value={form.contentSource?.hybridRpcName} onChange={v => update("contentSource.hybridRpcName", v)}
              placeholder="hybrid_match_data_index..." />
          </Field>
          <Field label="Index Table">
            <Input value={form.contentSource?.indexTable} onChange={v => update("contentSource.indexTable", v)}
              placeholder="data_index_embeddings_gf" />
          </Field>
          <Field label="Alerts Table">
            <Input value={form.contentSource?.alertsTable} onChange={v => update("contentSource.alertsTable", v)}
              placeholder="alerts_embeddings_gf" />
          </Field>
          <Field label="Alerts RPC Name">
            <Input value={form.contentSource?.alertsRpcName} onChange={v => update("contentSource.alertsRpcName", v)}
              placeholder="match_alerts_embeddings_gf" />
          </Field>
        </div>
      </div>

      <InfoHint>Content Supabase משמש רק לשליפת תוכן: RAG, timeline ו-alerts. אם URL או Key ריקים, המערכת תשתמש ב-App Supabase הקיים.</InfoHint>
    </div>
  );
}

// ─── Section: Tools (n8n) ─────────────────────────────────────────────────────

function ToolsSection({ form, update }) {
  const toolKeys = Object.keys(form.tools || {});

  return (
    <div style={s.section}>
      <InfoHint>כתובת ה-n8n Base URL משמשת בסיס לכל ה-webhooks. כתובות ספציפיות לכלי עוקפות את ה-Base URL עבור אותו כלי בלבד. אם אין שימוש ב-n8n ניתן להשאיר ריק.</InfoHint>
      <div style={s.card}>
        <Field label="n8n Base URL" hint="כתובת ה-n8n instance שממנה נקראים ה-webhooks">
          <Input value={form.n8nBaseUrl} onChange={v => update("n8nBaseUrl", v)}
            placeholder="https://your-n8n.cloud/webhook" />
        </Field>
      </div>

      {toolKeys.length > 0 && (
        <div>
          <p style={s.sectionTitle}>כתובות כלים</p>
          <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 10 }}>
            {toolKeys.map(key => (
              <Field key={key} label={key}>
                <Input value={form.tools[key]} onChange={v => update(`tools.${key}`, v)}
                  placeholder={`Override URL for ${key}`} />
              </Field>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Section: Performance & Cache ─────────────────────────────────────────────

function PerformanceSection({ form, update }) {
  const rt = form.toolsRuntime || {};
  const alert = form.ai?.alert || {};
  const cache = form.cache || {};
  const provider = cache.provider || "memory";

  return (
    <div style={s.section}>
      <InfoHint>שולט בהפעלת כלים חיצוניים, סוכן ההתראות וה-Cache — בלי לשנות את כתובות ה-webhooks.</InfoHint>

      <div>
        <p style={s.sectionTitle}>כלי N8N — ריצה</p>
        <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 14 }}>
          <Toggle label="להפעיל כלי N8N" checked={rt.enabled !== false}
            onChange={v => update("toolsRuntime.enabled", v)} info={EXPLANATIONS.toolsEnabled} />
          <Toggle label="להפעיל Alert Agent" checked={rt.alertAgentEnabled !== false}
            onChange={v => update("toolsRuntime.alertAgentEnabled", v)} info={EXPLANATIONS.toolsAlertAgentEnabled} />
          <Toggle label="להפעיל בדיקת בטיחות מוקדמת" checked={rt.safetyPrecheckEnabled !== false}
            onChange={v => update("toolsRuntime.safetyPrecheckEnabled", v)} info={EXPLANATIONS.toolsSafetyPrecheckEnabled} />
          <Field label="Parallel Tool Calls Limit" info={EXPLANATIONS.toolsParallelLimit}>
            <Input type="number" value={rt.parallelLimit ?? 6} min={1} max={20}
              onChange={v => update("toolsRuntime.parallelLimit", v)} />
          </Field>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>סוכן Alert — הגדרות מודל</p>
        <div style={{ ...s.card }}>
          <div style={s.grid3}>
            <Field label="Temperature" info={EXPLANATIONS.alertTemperature}>
              <Input type="number" value={alert.temperature ?? 0} min={0} max={2} step={0.05}
                onChange={v => update("ai.alert.temperature", v)} />
            </Field>
            <Field label="Max Tokens" info={EXPLANATIONS.alertMaxTokens}>
              <Input type="number" value={alert.maxTokens ?? 4096} min={16} max={32000} step={50}
                onChange={v => update("ai.alert.maxTokens", v)} />
            </Field>
            <Field label="Timeout (ms)" info={EXPLANATIONS.alertTimeoutMs}>
              <Input type="number" value={alert.timeoutMs ?? 90000} min={5000} max={180000} step={1000}
                onChange={v => update("ai.alert.timeoutMs", v)} />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>Cache</p>
        <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 14 }}>
          <Toggle label="להפעיל Cache" checked={cache.enabled !== false}
            onChange={v => update("cache.enabled", v)} info={EXPLANATIONS.cacheEnabled} />
          <div style={s.grid2}>
            <Field label="Cache Provider" info={EXPLANATIONS.cacheProvider}>
              <Select value={provider} onChange={v => update("cache.provider", v)}>
                <option value="memory">Memory — פיתוח</option>
                <option value="redis">Redis — Production</option>
                <option value="none">ללא Cache</option>
              </Select>
            </Field>
            <Field label="Memory Max Entries" info={EXPLANATIONS.cacheMemoryMaxEntries}>
              <Input type="number" value={cache.memoryMaxEntries ?? 10000} min={100} max={1000000} step={100}
                onChange={v => update("cache.memoryMaxEntries", v)} />
            </Field>
          </div>
          <PasswordField
            label="Redis URL"
            value={cache.redisUrl}
            onChange={v => update("cache.redisUrl", v)}
            placeholder="redis://default:password@host:6379"
            hint="השאר ריק כדי לשמור את הערך הקיים"
            info={EXPLANATIONS.cacheRedisUrl}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Section: Presets ─────────────────────────────────────────────────────────

function PresetsSection({ form, onApplyPreset, onSavePreset }) {
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const presets = form.presets || [];
  const selectedPreset = presets.find(p => p.name === selected);

  return (
    <div style={s.section}>
      <InfoHint>בחירה מהירה של תצורות מוכנות. טעינת פריסט מעדכנת את הטופס בלבד — לחץ "שמור" כדי לכתוב ל-Supabase.</InfoHint>
      <div style={s.card}>
        <p style={s.sectionTitle}>בחר פריסט</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Select value={selected} onChange={setSelected}>
            <option value="">— בחר פריסט —</option>
            {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </Select>
          {selectedPreset && (
            <p style={{ ...s.hint, background: "var(--surface-3)", padding: "8px 12px", borderRadius: "var(--r)", border: "1px solid var(--line)" }}>
              {selectedPreset.description || "אין תיאור לפריסט זה."}
            </p>
          )}
          <Btn onClick={() => selected && onApplyPreset(selected)} disabled={!selected}>
            טען פריסט
          </Btn>
        </div>
      </div>

      <div style={s.card}>
        <p style={s.sectionTitle}>שמור פריסט חדש</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={newName} onChange={setNewName} placeholder="שם לפריסט חדש..." />
          <Btn variant="primary" disabled={!newName.trim()} style={{ whiteSpace: "nowrap" }}
            onClick={() => { if (newName.trim()) { onSavePreset(newName.trim()); setNewName(""); } }}>
            שמור
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section: General ─────────────────────────────────────────────────────────

function GeneralSection({ form, update }) {
  return (
    <div style={s.section}>
      <div>
        <p style={s.sectionTitle}>אזור זמן</p>
        <div style={s.card}>
          <Field label="אזור זמן" hint="אזור הזמן משפיע על כל שאלות הזמן שנשאלות בסוכן">
            <Select value={form.timezone} onChange={v => update("timezone", v)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>Knowledge Base Vocabulary</p>
        <div style={s.card}>
          <Field
            label="מילות מפתח שמפעילות את Knowledge Base Agent"
            hint="כאשר אחת מהמילים מופיעה בשאלת המשתמש, המערכת תפעיל את Professional Knowledge Agent"
          >
            <Textarea value={form.knowledge?.triggerKeywords} rows={6}
              onChange={v => update("knowledge.triggerKeywords", v)}
              placeholder={"חסמים\nסיכונים\nתלויות"} />
          </Field>
        </div>
      </div>

      <div>
        <p style={s.sectionTitle}>Knowledge Base — הגדרות מתקדמות</p>
        <InfoHint>שולט בכמה ידע מקומי נכנס לתכנון החיפוש המקצועי.</InfoHint>
        <div style={{ ...s.card, marginTop: 10 }}>
          <div style={s.grid3}>
            <Field label="Knowledge Agent Limit" info={EXPLANATIONS.knowledgeAgentLimit}>
              <Input type="number" value={form.knowledge?.agentLimit ?? 2} min={1} max={5}
                onChange={v => update("knowledge.agentLimit", v)} />
            </Field>
            <Field label="Knowledge Top K" info={EXPLANATIONS.knowledgeTopK}>
              <Input type="number" value={form.knowledge?.topK ?? 4} min={1} max={20}
                onChange={v => update("knowledge.topK", v)} />
            </Field>
            <Field label="Knowledge Chunk Size" info={EXPLANATIONS.knowledgeChunkSize}>
              <Input type="number" value={form.knowledge?.chunkSize ?? 1800} min={300} max={6000} step={100}
                onChange={v => update("knowledge.chunkSize", v)} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Button Styles ─────────────────────────────────────────────────────────────

function btnStyle(variant = "secondary", disabled = false) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: "var(--r)", border: "none",
    cursor: disabled ? "default" : "pointer", fontFamily: "var(--font-display)",
    fontSize: 13, fontWeight: 500, transition: "all .15s",
    opacity: disabled ? .5 : 1,
  };
  if (variant === "primary") return { ...base, background: "var(--brand-500)", color: "#fff", boxShadow: "0 1px 2px rgba(63,141,104,.25)" };
  if (variant === "danger")  return { ...base, background: "var(--danger)", color: "#fff" };
  return { ...base, background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--line-strong)" };
}

function Btn({ variant = "secondary", disabled = false, onClick, children, title, style }) {
  const [hover, setHover] = useState(false);
  const base = btnStyle(variant, disabled);
  const hoverStyle = !disabled && hover
    ? variant === "primary"
      ? { background: "var(--brand-600, #2f7355)", boxShadow: "0 3px 10px rgba(63,141,104,.34)", transform: "translateY(-1px)" }
      : variant === "danger"
        ? { filter: "brightness(.92)", transform: "translateY(-1px)" }
        : { background: "var(--surface-2)", borderColor: "var(--brand-500)", color: "var(--brand-600, var(--brand-500))" }
    : {};
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...hoverStyle, ...style }}
    >
      {children}
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SidebarItem({ sec, isActive, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onSelect(sec.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: "var(--r)", border: "none",
        background: isActive ? "var(--brand-50)" : hover ? "var(--surface-2)" : "transparent",
        color: isActive ? "var(--brand-600, var(--brand-500))" : "var(--text-secondary)",
        fontWeight: isActive ? 700 : 500,
        fontSize: 13.5, cursor: "pointer", textAlign: "right",
        fontFamily: "var(--font-display)", transition: "all .15s",
        width: "100%",
      }}
    >
      {isActive && (
        <span style={{
          position: "absolute", insetInlineEnd: 0, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 18, borderRadius: 3, background: "var(--brand-500)",
        }} />
      )}
      <Icon path={icons[sec.id] || icons.general} size={16}
        style={{ color: isActive ? "var(--brand-500)" : "var(--text-muted)", flexShrink: 0 }} />
      {sec.label}
    </button>
  );
}

function Sidebar({ active, onSelect }) {
  return (
    <nav style={{
      width: 188, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 3,
      position: "sticky", top: 0, alignSelf: "flex-start",
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: "var(--r-xl)", padding: 8,
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
      {SECTIONS.map(sec => (
        <SidebarItem key={sec.id} sec={sec} isActive={sec.id === active} onSelect={onSelect} />
      ))}
    </nav>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ saveState, onSave, onReload, onExport, onImport, fileRef }) {
  const isSaving = saveState === "saving";
  const isSaved  = saveState === "saved";
  const isError  = saveState === "error";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingBottom: 16, borderBottom: "1px solid var(--line)",
      marginBottom: 20, gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>הגדרות</h2>
        {isSaved && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
            color: "var(--success-text)", background: "var(--success-bg)",
            padding: "3px 9px", borderRadius: 20, border: "1px solid var(--success-border)" }}>
            <Icon path={icons.check} size={11} /> נשמר
          </span>
        )}
        {isError && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
            color: "var(--error-text)", background: "var(--error-bg)",
            padding: "3px 9px", borderRadius: 20, border: "1px solid var(--error-border)" }}>
            <Icon path={icons.warning} size={11} /> שגיאה בשמירה
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn onClick={onReload} title="רענן מ-Supabase">
          <Icon path={icons.reload} size={14} /> רענן
        </Btn>
        <Btn onClick={onExport} title="הורד קובץ הגדרות">
          <Icon path={icons.download} size={14} /> ייצוא
        </Btn>
        <label style={{ ...btnStyle("secondary"), cursor: "pointer" }} title="טען קובץ הגדרות">
          <Icon path={icons.upload} size={14} /> ייבוא
          <input ref={fileRef} type="file" accept=".json" hidden onChange={onImport} />
        </label>
        <Btn variant="primary" onClick={onSave} disabled={isSaving}>
          <Icon path={icons.save} size={14} />
          {isSaving ? "שומר..." : "שמור"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

function StatusItem({ label, ok, detail }) {
  const dot = ok === true ? "#22c55e" : ok === false ? "#ef4444" : "#94a3b8";
  const text = ok === true ? "מוגדר" : ok === false ? "לא מוגדר" : detail;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{label}:</span>
      <span style={{ color: ok === false ? "#ef4444" : "var(--text-secondary, var(--text-muted))" }}>{text}</span>
      {detail && ok !== undefined && (
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({detail})</span>
      )}
    </span>
  );
}

function StatusBar({ configStatus, form, saveState }) {
  const cs = form.contentSource || {};
  const urlShort = cs.url ? cs.url.replace(/^https?:\/\//, "").split(".")[0] : null;
  const isSaved = saveState === "saved";
  const isError = saveState === "error";
  const isSaving = saveState === "saving";

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 0",
      padding: "9px 14px",
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: "var(--r)",
      marginBottom: 18,
      fontSize: 12,
      fontFamily: "var(--font-display)",
      lineHeight: 1.4,
    }}>
      <StatusItem label="OpenRouter" ok={configStatus.openRouter} />
      <Sep />
      <StatusItem label="App DB" ok={configStatus.supabase} />
      <Sep />
      <StatusItem label="Content DB" ok={configStatus.contentSupabase} detail={urlShort} />
      {cs.hybridRpcName && <><Sep /><StatusItem label="Content RPC" detail={cs.hybridRpcName} /></>}
      {(cs.indexTable || cs.alertsTable) && (
        <><Sep /><StatusItem label="Tables" detail={[cs.indexTable, cs.alertsTable].filter(Boolean).join(", ")} /></>
      )}
      <span style={{ marginRight: "auto", paddingRight: 4 }} />
      {isSaving && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>שומר...</span>}
      {isSaved && <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>✓ נשמר בהצלחה</span>}
      {isError && <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 600 }}>✗ שגיאה בשמירה</span>}
      {!isSaving && !isSaved && !isError && (
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>ההגדרות נטענו מ-Supabase</span>
      )}
    </div>
  );
}

function Sep() {
  return <span style={{ color: "var(--line-strong, #cbd5e1)", margin: "0 8px" }}>|</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const [form, setForm] = useState({});
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("connections");
  const [saveState, setSaveState] = useState("idle");
  const [configStatus, setConfigStatus] = useState({});
  const [modelStatus, setModelStatus] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/settings").catch(() => null),
      apiFetch("/api/openrouter/models").catch(() => ({ models: [] })),
    ]).then(([settingsRes, modelsRes]) => {
      const s = settingsRes?.settings ?? settingsRes;
      if (s) {
        setForm(settingsToForm(s));
        setConfigStatus({
          openRouter: s.openRouterConfigured,
          supabase: s.supabaseConfigured,
          contentSupabase: s.contentSupabaseConfigured,
        });
      }
      setModels(modelsRes?.models || []);
      setLoading(false);
    });
  }, []);

  const update = useCallback((path, value) => {
    setForm(prev => deepSet(prev, path, value));
    setSaveState("idle");
  }, []);

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const result = await apiFetch("/api/settings", { method: "PUT", body: formToPayload(form) });
      if (result?.settings) {
        setConfigStatus({
          openRouter: result.settings.openRouterConfigured,
          supabase: result.settings.supabaseConfigured,
          contentSupabase: result.settings.contentSupabaseConfigured,
        });
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  };

  const handleReload = async () => {
    try {
      const result = await apiFetch("/api/settings/reload", { method: "POST", body: {} });
      if (result?.settings) {
        setForm(settingsToForm(result.settings));
        setConfigStatus({
          openRouter: result.settings.openRouterConfigured,
          supabase: result.settings.supabaseConfigured,
          contentSupabase: result.settings.contentSupabaseConfigured,
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch {}
  };

  const handleExport = async () => {
    try {
      const data = await apiFetch("/api/settings/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bidoc-settings.json";
      a.click();
    } catch {}
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const result = await apiFetch("/api/settings/import", { method: "POST", body: data });
      if (result?.settings) setForm(settingsToForm(result.settings));
    } catch {}
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleApplyPreset = async (name) => {
    try {
      const result = await apiFetch("/api/settings/preset/apply", { method: "POST", body: { name } });
      if (result?.settings) setForm(settingsToForm(result.settings));
    } catch {}
  };

  const handleSavePreset = async (name) => {
    try {
      await apiFetch("/api/settings/preset", { method: "POST", body: { name, settings: formToPayload(form) } });
    } catch {}
  };

  const handleRefreshModels = async () => {
    setModelStatus("טוען רשימת מודלים מ-OpenRouter...");
    try {
      const res = await apiFetch("/api/openrouter/models");
      setModels(res?.models || []);
      setModelStatus(`נטענו ${res?.models?.length || 0} מודלים`);
      setTimeout(() => setModelStatus(""), 3000);
    } catch {
      setModelStatus("שגיאה בטעינת מודלים");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
        טוען הגדרות...
      </div>
    );
  }

  const sectionProps = { form, update, models, configStatus };

  return (
    <div dir="rtl" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
      <style>{`
        @keyframes bidocFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          [data-react-island="settings"] * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
        }
        @media (max-width: 720px) {
          [data-bidoc-settings-layout] { flex-direction: column !important; }
          [data-bidoc-settings-layout] > nav { width: 100% !important; flex-direction: row !important; overflow-x: auto; }
        }
      `}</style>
      <Header
        saveState={saveState} onSave={handleSave}
        onReload={handleReload} onExport={handleExport}
        onImport={handleImport} fileRef={fileRef}
      />
      <StatusBar configStatus={configStatus} form={form} saveState={saveState} />
      <div data-bidoc-settings-layout style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <Sidebar active={activeSection} onSelect={setActiveSection} />
        <div key={activeSection} style={{ flex: 1, minWidth: 0, animation: "bidocFade .18s ease-out" }}>
          {activeSection === "connections" && <ConnectionsSection {...sectionProps} />}
          {activeSection === "agents"      && <AgentsSection {...sectionProps} onRefreshModels={handleRefreshModels} modelStatus={modelStatus} />}
          {activeSection === "retrieval"   && <RetrievalSection {...sectionProps} />}
          {activeSection === "content"     && <ContentDbSection {...sectionProps} />}
          {activeSection === "tools"       && <ToolsSection {...sectionProps} />}
          {activeSection === "performance" && <PerformanceSection {...sectionProps} />}
          {activeSection === "presets"     && (
            <PresetsSection {...sectionProps}
              onApplyPreset={handleApplyPreset} onSavePreset={handleSavePreset} />
          )}
          {activeSection === "general"     && <GeneralSection {...sectionProps} />}
        </div>
      </div>
    </div>
  );
}
