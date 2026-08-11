import React, { useEffect, useMemo, useState } from "react";
import { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } from "../contracts/reviewMode.js";

const SOURCE_PROJECT_ID = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
const SCHEDULE_PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";

async function api(path, { method = "GET", body = null, timeoutMs = 120_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.code = data.code || null;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function initialDecision(candidate) {
  return {
    action: "reject",
    reason: "",
    gatesReviewed: false,
    milestoneKey: candidate.metadata?.milestoneKey || "",
    approvedBy: "",
    calendarSemantics: "",
    conflictReason: ""
  };
}

function factSummary(candidate) {
  if (candidate.fixedDate) return `מועד קבוע: ${candidate.fixedDate}`;
  if (candidate.offset) return `${candidate.offset.value} ${candidate.offset.unit} ${candidate.offset.direction}`;
  if (candidate.metadata?.extensionAmount) return `הארכה: ${candidate.metadata.extensionAmount} ${candidate.metadata.extensionUnit}`;
  return "ללא ערך זמן סופי";
}

function evidenceLabel(item) {
  const location = [item.pdfPage ? `עמוד ${item.pdfPage}` : null, item.clause ? `סעיף ${item.clause}` : null]
    .filter(Boolean)
    .join(" · ");
  return location || "מיקום מקור לא צוין";
}

function buildReviewPayload({ extraction, decisions, reviewReason, batchId, reviewedAt, sourceProjectId, scheduleProjectId }) {
  return {
    extraction,
    reviewBatch: {
      batchId,
      reviewedAt,
      reason: reviewReason.trim(),
      documentAuthority: "authoritative",
      extractorVersion: extraction.extractorVersion || "contracts-agent.phase1.v1",
      decisions: extraction.candidates.map((candidate) => {
        const decision = decisions[candidate.candidateKey] || initialDecision(candidate);
        const approved = decision.action === "approve";
        return {
          candidateKey: candidate.candidateKey,
          action: decision.action,
          confidence: approved ? 1 : 0,
          resolvedGates: approved && decision.gatesReviewed ? [...(candidate.gates || [])] : [],
          reason: decision.reason.trim(),
          ...(decision.milestoneKey.trim() ? { milestoneKey: decision.milestoneKey.trim() } : {}),
          ...(decision.approvedBy.trim() ? { approvedBy: decision.approvedBy.trim() } : {}),
          ...(decision.calendarSemantics ? { calendarSemantics: decision.calendarSemantics } : {}),
          ...(approved && candidate.conflictGroupId ? {
            conflictResolution: {
              selectedCandidateKey: candidate.candidateKey,
              reason: decision.conflictReason.trim()
            }
          } : {})
        };
      })
    },
    projectMapping: {
      sourceProjectId: sourceProjectId.trim(),
      scheduleProjectId: scheduleProjectId.trim()
    }
  };
}

function DecisionCard({ candidate, decision, onChange }) {
  const approved = decision.action === "approve";
  const target = candidate.storageDisposition?.replace("candidate_for_", "") || "לא נתמך בשלב זה";
  const needsMilestone = candidate.storageDisposition === "candidate_for_schedule_contract_extensions";
  const ambiguousDay = candidate.offset?.unit === "day";
  return (
    <article className={`contractsCandidate ${approved ? "is-approved" : "is-rejected"}`}>
      <header>
        <div>
          <span className="contractsCandidateRole">{candidate.role}</span>
          <h3>{candidate.action}</h3>
          <p>{factSummary(candidate)}</p>
        </div>
        <span className="contractsTarget">{target}</span>
      </header>

      <div className="contractsEvidenceList">
        {(candidate.sourceEvidence || []).map((item, index) => (
          <blockquote key={`${candidate.candidateKey}-evidence-${index}`}>
            <span>{evidenceLabel(item)}</span>
            <p>{item.sourceText}</p>
          </blockquote>
        ))}
      </div>

      {(candidate.gates || []).length > 0 && (
        <div className="contractsGateList" aria-label="חסמי קידום">
          {(candidate.gates || []).map((gate) => <span key={gate}>{gate}</span>)}
        </div>
      )}

      <div className="contractsDecisionRow" role="group" aria-label="החלטת סוקר">
        <button type="button" className={approved ? "is-selected" : ""} onClick={() => onChange({ action: "approve" })}>
          אשר לקידום
        </button>
        <button type="button" className={!approved ? "is-selected danger" : ""} onClick={() => onChange({ action: "reject" })}>
          דחה
        </button>
      </div>

      {approved && (
        <label className="contractsCheck">
          <input type="checkbox" checked={decision.gatesReviewed} onChange={(event) => onChange({ gatesReviewed: event.target.checked })} />
          בדקתי את הראיות ופתרתי במפורש את כל החסמים המוצגים
        </label>
      )}

      {approved && candidate.storageDisposition === "candidate_for_schedule_contract_milestones" && (
        <label>
          מפתח אבן דרך
          <input value={decision.milestoneKey} onChange={(event) => onChange({ milestoneKey: event.target.value })} placeholder={candidate.candidateKey} />
        </label>
      )}

      {approved && needsMilestone && (
        <div className="contractsFieldGrid">
          <label>
            מפתח אבן הדרך שמקבלת את ההארכה
            <input value={decision.milestoneKey} onChange={(event) => onChange({ milestoneKey: event.target.value })} />
          </label>
          <label>
            מאשר ההארכה
            <input value={decision.approvedBy} onChange={(event) => onChange({ approvedBy: event.target.value })} />
          </label>
        </div>
      )}

      {approved && ambiguousDay && (
        <label>
          משמעות "יום" שאושרה
          <select value={decision.calendarSemantics} onChange={(event) => onChange({ calendarSemantics: event.target.value })}>
            <option value="">לא נבחר</option>
            <option value="calendar_days">ימים קלנדריים</option>
          </select>
        </label>
      )}

      {approved && candidate.conflictGroupId && (
        <label>
          נימוק לבחירת מועמד זה מתוך הסתירה
          <textarea value={decision.conflictReason} onChange={(event) => onChange({ conflictReason: event.target.value })} rows="2" />
        </label>
      )}

      <label>
        נימוק החלטה
        <textarea value={decision.reason} onChange={(event) => onChange({ reason: event.target.value })} rows="2" />
      </label>
    </article>
  );
}

export function ContractsPage() {
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [sourceProjectId, setSourceProjectId] = useState(SOURCE_PROJECT_ID);
  const [scheduleProjectId, setScheduleProjectId] = useState(SCHEDULE_PROJECT_ID);
  const [projectSite, setProjectSite] = useState("Herzliya showroom");
  const [extraction, setExtraction] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [reviewReason, setReviewReason] = useState("");
  const [batchId, setBatchId] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const [prepared, setPrepared] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/contracts/review/status").then(setStatus).catch((nextError) => setError(nextError.message));
  }, []);

  const candidateCount = extraction?.candidates?.length || 0;
  const approvedCount = useMemo(() => Object.values(decisions).filter((item) => item.action === "approve").length, [decisions]);
  const rejectedCount = candidateCount - approvedCount;
  const preparedMode = contractReviewSubmissionMode(prepared?.plan);

  function updateDecision(candidateKey, patch) {
    setDecisions((current) => ({
      ...current,
      [candidateKey]: { ...current[candidateKey], ...patch }
    }));
    setPrepared(null);
    setResult(null);
  }

  function validateReview() {
    if (!extraction) return "יש להריץ חילוץ לפני סקירה.";
    if (reviewReason.trim().length < 10) return "נדרש נימוק סקירה כללי של לפחות 10 תווים.";
    for (const candidate of extraction.candidates || []) {
      const decision = decisions[candidate.candidateKey];
      if (!decision?.reason?.trim()) return "נדרש נימוק לכל החלטה.";
      if (decision.action === "approve" && !decision.gatesReviewed) return "יש לאשר במפורש שהחסמים נבדקו לכל מועמד שמקודם.";
      if (decision.action === "approve" && candidate.conflictGroupId && !decision.conflictReason.trim()) return "נדרש נימוק מפורש לפתרון סתירה.";
    }
    return "";
  }

  async function extractContract() {
    if (!file) return setError("יש לבחור קובץ PDF.");
    setBusy("extract");
    setError("");
    setPrepared(null);
    setResult(null);
    try {
      const pdfBase64 = await fileToBase64(file);
      const nextExtraction = await api("/api/contracts/extract", {
        method: "POST",
        timeoutMs: 300_000,
        body: {
          filename: file.name,
          mediaType: "application/pdf",
          pdfBase64,
          mode: "dry_run",
          projectSelection: {
            projectId: sourceProjectId.trim(),
            projectSite: projectSite.trim(),
            selectedByUser: true
          }
        }
      });
      const nextDecisions = Object.fromEntries((nextExtraction.candidates || []).map((candidate) => [candidate.candidateKey, initialDecision(candidate)]));
      setExtraction(nextExtraction);
      setDecisions(nextDecisions);
      setBatchId(`contracts-review-${crypto.randomUUID()}`);
      setReviewedAt(new Date().toISOString());
      setReviewReason("");
    } catch (nextError) {
      setError(nextError.name === "AbortError" ? "החילוץ חרג ממגבלת הזמן." : nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function prepareReview() {
    const validationError = validateReview();
    if (validationError) return setError(validationError);
    setBusy("plan");
    setError("");
    try {
      const payload = buildReviewPayload({ extraction, decisions, reviewReason, batchId, reviewedAt, sourceProjectId, scheduleProjectId });
      const nextPrepared = await api("/api/contracts/review/plan", { method: "POST", body: payload });
      setPrepared(nextPrepared);
      setResult(null);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function submitPreparedReview(mode) {
    if (!prepared) return setError("יש להכין ולאמת את תוכנית הסקירה לפני השמירה או הקידום.");
    if (mode !== preparedMode || mode === CONTRACT_REVIEW_SUBMISSION_MODE.blocked) {
      return setError("תוכנית הסקירה אינה מוכנה לפעולה בטוחה.");
    }
    const reviewOnly = mode === CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly;
    setBusy(reviewOnly ? "save-review" : "commit");
    setError("");
    try {
      const payload = buildReviewPayload({ extraction, decisions, reviewReason, batchId, reviewedAt, sourceProjectId, scheduleProjectId });
      const nextResult = await api(reviewOnly ? "/api/contracts/review/save" : "/api/contracts/review/commit", {
        method: "POST",
        body: reviewOnly ? { ...payload, persistReview: true } : { ...payload, commit: true }
      });
      setResult(nextResult);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="contractsPage">
      <header className="contractsHero">
        <div>
          <p className="contractsEyebrow">Contracts Agent · Phase 2</p>
          <h1>חילוץ, סקירה וקידום עובדות חוזיות</h1>
          <p>העובדות אינן משפיעות על מנוע הלו״ז עד לאחר סקירה אנושית וקידום אטומי לטבלאות הקיימות.</p>
        </div>
        <div className={`contractsMode ${status?.applyApproved ? "is-ready" : "is-paused"}`}>
          <strong>{status?.applyApproved ? "שמירה וקידום פעילים" : "סקירה בלבד · שמירה מושבתת"}</strong>
          <span>Expected schema {status?.migrationVersion || "—"}</span>
        </div>
      </header>

      <section className="contractsPanel">
        <h2>1. חוזה וקישור פרויקט</h2>
        <div className="contractsFieldGrid">
          <label>
            קובץ PDF
            <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <label>
            אתר / תיאור פרויקט
            <input value={projectSite} onChange={(event) => setProjectSite(event.target.value)} />
          </label>
          <label>
            MAIN project UUID
            <input dir="ltr" value={sourceProjectId} onChange={(event) => setSourceProjectId(event.target.value)} />
          </label>
          <label>
            KAPAIM Schedule project UUID
            <input dir="ltr" value={scheduleProjectId} onChange={(event) => setScheduleProjectId(event.target.value)} />
          </label>
        </div>
        <button type="button" className="contractsPrimary" disabled={Boolean(busy)} onClick={extractContract}>
          {busy === "extract" ? "מחלץ ומאמת…" : "הרץ חילוץ יבש"}
        </button>
      </section>

      {extraction && (
        <section className="contractsPanel">
          <div className="contractsSectionHeader">
            <div>
              <h2>2. סקירת מועמדים</h2>
              <p>{candidateCount} מועמדים · {approvedCount} לאישור · {rejectedCount} לדחייה</p>
            </div>
            <span className="contractsDryBadge">dry_run · ללא כתיבה</span>
          </div>

          <div className="contractsCandidateList">
            {(extraction.candidates || []).map((candidate) => (
              <DecisionCard
                key={candidate.candidateKey}
                candidate={candidate}
                decision={decisions[candidate.candidateKey]}
                onChange={(patch) => updateDecision(candidate.candidateKey, patch)}
              />
            ))}
          </div>

          <label className="contractsReviewReason">
            נימוק סקירה כללי
            <textarea rows="3" value={reviewReason} onChange={(event) => { setReviewReason(event.target.value); setPrepared(null); }} />
          </label>
          <button type="button" className="contractsPrimary" disabled={Boolean(busy)} onClick={prepareReview}>
            {busy === "plan" ? "בודק תוכנית…" : "הכן ובדוק תוכנית קידום"}
          </button>
        </section>
      )}

      {prepared && (
        <section className="contractsPanel contractsPlanPanel">
          <div className="contractsSectionHeader">
            <div>
              <h2>3. תוכנית טרנזקציה</h2>
              <p>
                סטטוס: {prepared.plan?.status} · פעולה בטוחה: {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.promotion
                  ? "קידום עובדות מאושרות"
                  : preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly
                    ? "שמירת סקירה בלבד"
                    : "אין"}
              </p>
            </div>
            <span className={preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.blocked ? "contractsPlanBlocked" : "contractsPlanReady"}>
              {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.promotion
                ? "מוכן לקידום"
                : preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly
                  ? "מוכן לשמירת סקירה"
                  : "חסום"}
            </span>
          </div>

          {(prepared.plan?.globalBlockers || []).length > 0 && (
            <ul className="contractsBlockers">
              {prepared.plan.globalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          )}

          <div className="contractsPlanCounts">
            <span>אבני דרך <strong>{prepared.plan?.rowsByTable?.schedule_contract_milestones?.length || 0}</strong></span>
            <span>הארכות <strong>{prepared.plan?.rowsByTable?.schedule_contract_extensions?.length || 0}</strong></span>
            <span>תנאים <strong>{prepared.plan?.rowsByTable?.schedule_contract_conditions?.length || 0}</strong></span>
          </div>

          {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly && (
            <div className="contractsActionBlock">
              <p>כל המועמדים נדחו. הפעולה תשמור ביקורת בלתי־ניתנת לשינוי בלבד ותיצור אפס רשומות לו״ז.</p>
              {!status?.applyApproved && <p className="contractsActivationNotice">שמירת ביקורות מושבתת בצד השרת. ה־migration אינו נבדק או מופעל מכפתור זה.</p>}
              <button
                type="button"
                className="contractsCommit contractsReviewOnlyAction"
                disabled={Boolean(busy) || !status?.applyApproved}
                onClick={() => submitPreparedReview(CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly)}
              >
                {busy === "save-review" ? "שומר סקירה ללא קידום…" : "שמור סקירה ללא קידום"}
              </button>
            </div>
          )}

          {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.promotion && (
            <div className="contractsActionBlock">
              <p>רק העובדות שאושרו ועמדו בכל החסמים ייכתבו אטומית לטבלאות הלו״ז הקיימות.</p>
              {!status?.applyApproved && <p className="contractsActivationNotice">קידום עובדות מושבת בצד השרת. נדרש אישור הפעלה נפרד.</p>}
              <button
                type="button"
                className="contractsCommit"
                disabled={Boolean(busy) || !status?.applyApproved}
                onClick={() => submitPreparedReview(CONTRACT_REVIEW_SUBMISSION_MODE.promotion)}
              >
                {busy === "commit" ? "מבצע קידום אטומי…" : "קדם עובדות מאושרות"}
              </button>
            </div>
          )}

          {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.blocked && (
            <div className="contractsActionBlock">
              <p className="contractsActivationNotice">התוכנית כוללת החלטה חסרה או מועמד שאושר אך עדיין אינו בטוח לקידום. יש לחזור לסקירה ולפתור את החסמים.</p>
              <button type="button" className="contractsCommit" disabled>נדרשת השלמת חסמים</button>
            </div>
          )}
        </section>
      )}

      {error && <div className="contractsMessage is-error" role="alert">{error}</div>}
      {result && (
        <div className="contractsMessage is-success">
          {result.status === "reviewed_no_promotion"
            ? "הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז."
            : `הקידום הושלם. קודמו ${result.promotedCount} רשומות.`}
        </div>
      )}
    </div>
  );
}
