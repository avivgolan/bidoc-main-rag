import React, { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } from "../contracts/reviewMode.js";
import {
  contractActionLabel,
  contractDirectionLabel,
  contractGateLabel,
  contractRoleLabel,
  contractUnitLabel,
  contractsUiError,
  formatHebrewDateTime,
  mappingActionLabel,
  mappingBlockerLabel,
  mappingEvidenceKindLabel,
  mappingStateLabel,
  promotionBlockerLabel,
  reviewPlanStatusLabel,
  storageDispositionLabel
} from "./contractsHebrew.js";

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
      error.code = data.code || (/^[a-z0-9_]+$/u.test(String(data.error || "")) ? data.error : null);
      error.status = response.status;
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
  if (candidate.offset) return `${candidate.offset.value} ${contractUnitLabel(candidate.offset.unit)} ${contractDirectionLabel(candidate.offset.direction)}`;
  if (candidate.metadata?.extensionAmount) return `הארכה: ${candidate.metadata.extensionAmount} ${contractUnitLabel(candidate.metadata.extensionUnit)}`;
  return "ללא ערך זמן סופי";
}

function evidenceLabel(item) {
  const location = [item.pdfPage ? `עמוד ${item.pdfPage}` : null, item.clause ? `סעיף ${item.clause}` : null]
    .filter(Boolean)
    .join(" · ");
  return location || "מיקום מקור לא צוין";
}

function initialMappingDraft(candidate) {
  return {
    mappingRequirement: "required",
    conditionStatus: candidate.type === "relative_condition" ? "pending" : "not_applicable",
    triggerEvidenceReviewed: candidate.type !== "relative_condition",
    preferMilestone: candidate.storageDisposition === "candidate_for_schedule_contract_milestones",
    activityTerms: [candidate.action, candidate.role].filter(Boolean).join("\n"),
    action: "confirm",
    selectedActivityKey: "",
    reason: "",
    conflictResolved: false,
    supersedesEventId: "",
    reviewRequestId: crypto.randomUUID()
  };
}

function restoreReviewDraft(extraction, draft = null) {
  const decisions = Object.fromEntries((extraction.candidates || []).map((candidate) => [
    candidate.candidateKey,
    { ...initialDecision(candidate), ...(draft?.decisions?.[candidate.candidateKey] || {}) }
  ]));
  return {
    decisions,
    reviewReason: draft?.reviewReason || "",
    batchId: draft?.batchId || `contracts-review-${crypto.randomUUID()}`,
    reviewedAt: draft?.reviewedAt || new Date().toISOString(),
    mappingDraft: draft?.mappingDraft || null
  };
}

function workspaceDraftPayload({ decisions, reviewReason, batchId, reviewedAt, mappingDraft }) {
  return { decisions, reviewReason, batchId, reviewedAt, mappingDraft };
}

function workspaceDraftSnapshot(payload) {
  return JSON.stringify(payload);
}

function workspaceDraftRevision(draft) {
  const revision = Number(draft?.revision ?? 0);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function mappingObligation(extraction, candidate, draft) {
  return {
    documentVersionId: extraction.document.documentVersionId,
    candidateKey: candidate.candidateKey,
    milestoneKey: candidate.metadata?.milestoneKey || null,
    label: candidate.action || candidate.role,
    mappingRequirement: draft.mappingRequirement,
    conditionStatus: draft.conditionStatus,
    triggerEvidenceReviewed: draft.triggerEvidenceReviewed,
    preferMilestone: draft.preferMilestone,
    preferredTaskUid: null,
    preferredActivityKey: null,
    preferredOutlineLevel: null,
    activityTerms: draft.activityTerms
      .split(/[\n,]/u)
      .map((term) => term.trim())
      .filter(Boolean),
    sourceEvidence: (candidate.sourceEvidence || []).map((item, index) => ({
      evidenceId: `${candidate.candidateKey}:source:${index + 1}`,
      sourceText: item.sourceText,
      pdfPage: item.pdfPage ?? null,
      clause: item.clause ?? null
    }))
  };
}

function ActivityMappingReviewWorkspace({ extraction, sourceProjectId, status, statusError, savedState = null, savedStateKey = "", onDraftStateChange = null }) {
  const [candidateKey, setCandidateKey] = useState("");
  const [draft, setDraft] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const outcomeRef = useRef(null);

  const selectedCandidate = (extraction.candidates || []).find((candidate) => candidate.candidateKey === candidateKey) || null;
  const correctionEvents = history.filter((event) => event.selectedCanonicalKey);

  useEffect(() => {
    const savedCandidate = (extraction.candidates || []).find((candidate) => candidate.candidateKey === savedState?.candidateKey) || null;
    const restoredDraft = savedCandidate && savedState?.draft
      ? { ...initialMappingDraft(savedCandidate), ...savedState.draft }
      : null;
    setCandidateKey(savedCandidate?.candidateKey || "");
    setDraft(restoredDraft);
    setBundle(null);
    setHistory([]);
    setHistoryError("");
    setError("");
    setResult(null);
  }, [extraction.document?.documentVersionId, sourceProjectId, savedStateKey]);

  function patchDraft(patch) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onDraftStateChange?.({ candidateKey, draft: next });
      return next;
    });
    setResult(null);
  }

  function patchSearchDraft(patch) {
    patchDraft(patch);
    setBundle(null);
  }

  function showCandidateOutcome() {
    setTimeout(() => outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function loadHistory(candidate) {
    setHistoryError("");
    try {
      const query = new URLSearchParams({
        sourceProjectId,
        documentVersionId: extraction.document.documentVersionId,
        candidateKey: candidate.candidateKey,
        limit: "100"
      });
      const response = await api(`/api/contracts/activity-mapping/history?${query}`);
      setHistory(response.events || []);
    } catch (nextError) {
      setHistory([]);
      setHistoryError(contractsUiError(nextError));
    }
  }

  async function openCandidate(candidate) {
    const nextDraft = initialMappingDraft(candidate);
    setCandidateKey(candidate.candidateKey);
    setDraft(nextDraft);
    onDraftStateChange?.({ candidateKey: candidate.candidateKey, draft: nextDraft });
    setBundle(null);
    setHistory([]);
    setError("");
    setResult(null);
    setBusy("candidates");
    loadHistory(candidate);
    try {
      const response = await api("/api/contracts/activity-mapping/candidates", {
        method: "POST",
        body: {
          sourceProjectId,
          obligation: mappingObligation(extraction, candidate, nextDraft)
        }
      });
      const nextBundle = response.candidateBundle;
      const firstActivityKey = nextBundle?.candidates?.[0]?.activityKey || "";
      setBundle(nextBundle);
      setDraft((current) => ({
        ...current,
        action: firstActivityKey ? "confirm" : "unmapped",
        selectedActivityKey: firstActivityKey
      }));
      onDraftStateChange?.({
        candidateKey: candidate.candidateKey,
        draft: { ...nextDraft, action: firstActivityKey ? "confirm" : "unmapped", selectedActivityKey: firstActivityKey }
      });
      showCandidateOutcome();
    } catch (nextError) {
      setError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  async function refreshCandidates() {
    if (!selectedCandidate || !draft) return;
    setBusy("candidates");
    setError("");
    setResult(null);
    try {
      const response = await api("/api/contracts/activity-mapping/candidates", {
        method: "POST",
        body: {
          sourceProjectId,
          obligation: mappingObligation(extraction, selectedCandidate, draft)
        }
      });
      const nextBundle = response.candidateBundle;
      const currentStillExists = nextBundle.candidates.some((candidate) => candidate.activityKey === draft.selectedActivityKey);
      const selectedActivityKey = currentStillExists ? draft.selectedActivityKey : nextBundle.candidates[0]?.activityKey || "";
      setBundle(nextBundle);
      setDraft((current) => ({
        ...current,
        selectedActivityKey,
        action: selectedActivityKey ? current.action : "unmapped"
      }));
      onDraftStateChange?.({
        candidateKey,
        draft: {
          ...draft,
          selectedActivityKey,
          action: selectedActivityKey ? draft.action : "unmapped"
        }
      });
      showCandidateOutcome();
    } catch (nextError) {
      setError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  const triggerEvidenceBlocked = Boolean(bundle?.blockers?.includes("trigger_evidence_unreviewed"));

  function chooseAction(action) {
    patchDraft({
      action,
      selectedActivityKey: ["confirm", "correct"].includes(action)
        ? draft.selectedActivityKey || bundle?.candidates?.[0]?.activityKey || ""
        : "",
      supersedesEventId: action === "correct" ? draft.supersedesEventId : ""
    });
  }

  function reviewValidation() {
    if (!bundle || !draft) return "יש לטעון חלופות עדכניות לפני שמירת החלטה.";
    if (draft.reason.trim().length < 10) return "נדרש נימוק החלטת מיפוי של לפחות 10 תווים.";
    if (["confirm", "correct"].includes(draft.action) && !draft.selectedActivityKey) return "יש לבחור פעילות מדויקת.";
    if (draft.action === "correct" && !draft.supersedesEventId) return "יש לבחור אירוע קודם שהתיקון מחליף.";
    if (bundle.conflict && !draft.conflictResolved && ["confirm", "correct"].includes(draft.action)) return "יש לפתור את הסתירה במפורש.";
    if (draft.action === "reject" && bundle.candidates.length === 0) return "כאשר אין חלופות יש לבחור ללא מיפוי, ולא דחייה.";
    return "";
  }

  async function submitMappingReview() {
    const validationError = reviewValidation();
    if (validationError) return setError(validationError);
    setBusy("review");
    setError("");
    setResult(null);
    try {
      const response = await api("/api/contracts/activity-mapping/review", {
        method: "POST",
        body: {
          sourceProjectId,
          obligation: mappingObligation(extraction, selectedCandidate, draft),
          action: draft.action,
          selectedActivityKey: ["confirm", "correct"].includes(draft.action) ? draft.selectedActivityKey : null,
          reason: draft.reason.trim(),
          reviewRequestId: draft.reviewRequestId,
          conflictResolved: draft.conflictResolved,
          supersedesEventId: draft.action === "correct" ? draft.supersedesEventId : null
        }
      });
      setResult(response);
      setDraft((current) => {
        const next = { ...current, reviewRequestId: crypto.randomUUID() };
        onDraftStateChange?.({ candidateKey, draft: next });
        return next;
      });
      await loadHistory(selectedCandidate);
    } catch (nextError) {
      setError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="contractsPanel contractsMappingPanel">
      <div className="contractsSectionHeader">
        <div>
          <h2>4. סקירת קישור לפעילות בלוח</h2>
          <p>המערכת מציגה עד חמש חלופות עדכניות. רק סוקר אנושי יכול לאשר, לדחות, לתקן או להשאיר ללא מיפוי.</p>
        </div>
        <span className={status?.reviewApplyApproved ? "contractsPlanReady" : "contractsPlanBlocked"}>
          {status?.reviewApplyApproved ? "כתיבת ביקורת מאושרת" : "כתיבה מושבתת"}
        </span>
      </div>

      {(statusError || !status?.reviewApplyApproved) && (
        <p className="contractsActivationNotice">
          {statusError ? "לא ניתן לטעון את מצב שמירת החלטות המיפוי." : "שער שלב 3F סגור בצד השרת. אפשר לבדוק חלופות והיסטוריה, אך אי אפשר לשמור החלטה."}
        </p>
      )}

      <div className="contractsMappingCandidates" aria-label="עובדות חוזיות לקישור">
        {(extraction.candidates || []).map((candidate) => (
          <button
            type="button"
            key={candidate.candidateKey}
            className={candidateKey === candidate.candidateKey ? "is-selected" : ""}
            onClick={() => openCandidate(candidate)}
            disabled={Boolean(busy)}
          >
            <span>{contractRoleLabel(candidate.role)}</span>
            <strong>{contractActionLabel(candidate)}</strong>
            <small>{candidateKey === candidate.candidateKey && busy === "candidates" ? "טוען חלופות…" : "בדוק התאמה ללוח"}</small>
          </button>
        ))}
      </div>

      {selectedCandidate && draft && (
        <div className="contractsMappingWorkspace">
          <div className="contractsFieldGrid">
            <label>
              האם נדרש קישור לפעילות
              <select value={draft.mappingRequirement} onChange={(event) => patchSearchDraft({ mappingRequirement: event.target.value })}>
                <option value="required">נדרש</option>
                <option value="not_required">לא נדרש</option>
              </select>
            </label>
            <label>
              מצב תנאי חוזי
              <select value={draft.conditionStatus} onChange={(event) => patchSearchDraft({ conditionStatus: event.target.value })}>
                <option value="not_applicable">לא חל</option>
                <option value="pending">אירוע מפעיל ממתין לאימות</option>
                <option value="resolved">נפתר ונבדק</option>
              </select>
            </label>
            <label className="contractsCheck">
              <input type="checkbox" checked={draft.triggerEvidenceReviewed} onChange={(event) => patchSearchDraft({ triggerEvidenceReviewed: event.target.checked })} />
              ראיות האירוע המפעיל נבדקו
              {!draft.triggerEvidenceReviewed && draft.conditionStatus === "pending" && (
                <small>כל עוד תיבה זו אינה מסומנת, המערכת עוצרת לפני חיפוש חלופות ומציגה “טרם בוצע חיפוש”.</small>
              )}
            </label>
            <label className="contractsCheck">
              <input type="checkbox" checked={draft.preferMilestone} onChange={(event) => patchSearchDraft({ preferMilestone: event.target.checked })} />
              העדף אבן דרך
            </label>
          </div>
          <label>
            מונחי מקור להתאמה ללוח, שורה לכל מונח
            <textarea rows="3" value={draft.activityTerms} onChange={(event) => patchSearchDraft({ activityTerms: event.target.value })} />
            <small className="contractsFieldHint">המונחים נשמרים בשפת המקור כדי לא לפגוע בדיוק ההתאמה.</small>
          </label>
          <button type="button" className="contractsPrimary" disabled={Boolean(busy)} onClick={refreshCandidates}>
            {busy === "candidates" ? "טוען מהמקורות המאושרים…" : "רענן חלופות מהלוח הנוכחי"}
          </button>

          {bundle && (
            <>
              <div
                ref={outcomeRef}
                className={`contractsMappingOutcome ${triggerEvidenceBlocked ? "is-blocked" : bundle.candidates.length ? "is-found" : "is-empty"}`}
                role="status"
                tabIndex="-1"
              >
                {triggerEvidenceBlocked
                  ? "החיפוש טרם בוצע: יש לסמן שראיות האירוע המפעיל נבדקו, ואז ללחוץ שוב על רענון החלופות."
                  : bundle.candidates.length
                    ? `החיפוש הושלם ונמצאו ${bundle.candidates.length} חלופות פעילות לבדיקה.`
                    : "החיפוש הושלם, אך לא נמצאה פעילות מתאימה בלוח הנוכחי. ניתן לתעד החלטה ללא מיפוי."}
              </div>
              <div className="contractsMappingSummary">
                <span>מצב <strong>{mappingStateLabel(bundle.decisionState)}</strong></span>
                <span>גרסת לוח <strong dir="ltr">{bundle.scheduleVersion.fileId}</strong></span>
                <span>חלופות <strong>{triggerEvidenceBlocked ? "טרם בוצע חיפוש" : bundle.candidates.length}</strong></span>
                <span>סתירת גרסה <strong>{bundle.scheduleVersion.versionConflict ? "כן" : "לא"}</strong></span>
              </div>

              {(bundle.blockers || []).length > 0 && (
                <div className="contractsGateList" aria-label="חסמי מיפוי">
                  {bundle.blockers.map((blocker) => <span key={blocker}>{mappingBlockerLabel(blocker)}</span>)}
                </div>
              )}

              <div className="contractsMappingEvidence">
                <strong>ראיה חוזית מדויקת — הציטוט נשמר בשפת המקור</strong>
                {(bundle.obligation.sourceEvidence || []).map((item) => (
                  <blockquote key={item.evidenceId}>
                    <span>{evidenceLabel(item)}</span>
                    <p>{item.sourceText}</p>
                  </blockquote>
                ))}
              </div>

              <div className="contractsAlternativeList" aria-label="חלופות פעילות">
                {bundle.candidates.map((candidate) => (
                  <label key={candidate.activityKey} className={draft.selectedActivityKey === candidate.activityKey ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name="mapping-activity"
                      value={candidate.activityKey}
                      checked={draft.selectedActivityKey === candidate.activityKey}
                      onChange={() => patchDraft({ selectedActivityKey: candidate.activityKey })}
                    />
                    <span className="contractsAlternativeRank">#{candidate.rank}</span>
                    <span>
                      <strong><span className="contractsSourceLabel">שם הפעילות המקורי בלוח:</span> {candidate.taskName}</strong>
                      <small>{candidate.plannedStart || "—"}–{candidate.plannedFinish || "—"} · מזהה משימה {candidate.taskUid} · רמה {candidate.outlineLevel}</small>
                      <small dir="ltr">{candidate.activityKey}</small>
                    </span>
                    <b>{Math.round(candidate.confidence * 100)}%</b>
                    <details>
                      <summary>ראיות וחסמים</summary>
                      {(candidate.evidence || []).map((item, index) => <p key={`${candidate.activityKey}-${index}`}><strong>{mappingEvidenceKindLabel(item.kind)}:</strong> <span dir="auto">{item.detail}</span></p>)}
                      {(candidate.blockers || []).map((blocker) => <p key={blocker} className="is-blocker">{mappingBlockerLabel(blocker)}</p>)}
                    </details>
                  </label>
                ))}
                {bundle.candidates.length === 0 && <p className="contractsMappingEmpty">לא נמצאו חלופות פעילות. ניתן לתעד החלטה "ללא מיפוי" בלבד.</p>}
              </div>

              {bundle.conflict && (
                <div className="contractsConflictBox">
                  <strong>נמצאה סתירה: {mappingBlockerLabel(bundle.conflict.type)}</strong>
                  <p>אישור אינו אומר שהסעיף תקין; הוא רק בוחר במפורש את הפעילות המתאימה מתוך החלופות הנוכחיות.</p>
                  <label className="contractsCheck">
                    <input type="checkbox" checked={draft.conflictResolved} onChange={(event) => patchDraft({ conflictResolved: event.target.checked })} />
                    בדקתי את האירוע המפעיל, הלוח, קישור הפרויקט והסתירה ובחרתי חלופה במפורש
                  </label>
                </div>
              )}

              <div className="contractsDecisionRow contractsMappingActions" role="group" aria-label="החלטת מיפוי">
                {bundle.candidates.length > 0 && <button type="button" className={draft.action === "confirm" ? "is-selected" : ""} onClick={() => chooseAction("confirm")}>אשר מיפוי</button>}
                {bundle.candidates.length > 0 && <button type="button" className={draft.action === "reject" ? "is-selected danger" : ""} onClick={() => chooseAction("reject")}>דחה חלופות</button>}
                <button type="button" className={draft.action === "unmapped" ? "is-selected danger" : ""} onClick={() => chooseAction("unmapped")}>השאר ללא מיפוי</button>
                {correctionEvents.length > 0 && <button type="button" className={draft.action === "correct" ? "is-selected" : ""} onClick={() => chooseAction("correct")}>תקן החלטה קודמת</button>}
              </div>

              {draft.action === "correct" && (
                <label>
                  אירוע קודם שהתיקון מחליף
                  <select value={draft.supersedesEventId} onChange={(event) => patchDraft({ supersedesEventId: event.target.value })}>
                    <option value="">בחר אירוע בלתי־ניתן לשינוי</option>
                    {correctionEvents.map((event) => (
                      <option key={event.eventId} value={event.eventId}>{mappingActionLabel(event.action)} · {formatHebrewDateTime(event.reviewedAt)} · {event.selectedActivityKey || event.selectedCanonicalKey}</option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                נימוק החלטת מיפוי
                <textarea rows="3" value={draft.reason} onChange={(event) => patchDraft({ reason: event.target.value })} />
              </label>
              <button
                type="button"
                className="contractsCommit"
                disabled={Boolean(busy) || !status?.reviewApplyApproved}
                onClick={submitMappingReview}
              >
                {busy === "review" ? "שומר אירוע ביקורת אטומי…" : `שמור ${mappingActionLabel(draft.action)}`}
              </button>
            </>
          )}

          {error && <div className="contractsMessage is-error" role="alert">{error}</div>}
          {result && <div className="contractsMessage is-success">החלטת המיפוי נרשמה כאירוע ביקורת בלתי־ניתן לשינוי.</div>}

          <div className="contractsHistory">
            <div className="contractsSectionHeader">
              <div>
                <h3>היסטוריית החלטות</h3>
                <p>תיקון מוסיף אירוע חדש ומפנה לאירוע הקודם; הוא אינו מוחק היסטוריה.</p>
              </div>
              <button type="button" onClick={() => loadHistory(selectedCandidate)} disabled={Boolean(busy)}>רענן היסטוריה</button>
            </div>
            {historyError && <p className="contractsActivationNotice">{historyError}</p>}
            {!historyError && history.length === 0 && <p className="contractsMappingEmpty">אין עדיין החלטות שמורות לעובדה זו.</p>}
            {history.map((event) => (
              <article key={event.eventId}>
                <header>
                  <strong>{mappingActionLabel(event.action)}</strong>
                  <time dateTime={event.reviewedAt}>{formatHebrewDateTime(event.reviewedAt)}</time>
                </header>
                <p>{event.reason}</p>
                <small>סוקר: <span dir="ltr">{event.reviewerId}</span></small>
                {event.selectedActivityKey && <small>פעילות: <span dir="ltr">{event.selectedActivityKey}</span></small>}
                {event.supersedesEventId && <small>מחליף אירוע: <span dir="ltr">{event.supersedesEventId}</span></small>}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
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
  const target = storageDispositionLabel(candidate.storageDisposition);
  const needsMilestone = candidate.storageDisposition === "candidate_for_schedule_contract_extensions";
  const ambiguousDay = candidate.offset?.unit === "day";
  return (
    <article className={`contractsCandidate ${approved ? "is-approved" : "is-rejected"}`}>
      <header>
        <div>
          <span className="contractsCandidateRole">{contractRoleLabel(candidate.role)}</span>
          <h3>{contractActionLabel(candidate)}</h3>
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
          {(candidate.gates || []).map((gate) => <span key={gate}>{contractGateLabel(gate)}</span>)}
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
  const [mappingStatus, setMappingStatus] = useState(null);
  const [mappingStatusError, setMappingStatusError] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [savedContracts, setSavedContracts] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [autosaveState, setAutosaveState] = useState("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const [mappingDraft, setMappingDraft] = useState(null);
  const [file, setFile] = useState(null);
  const [sourceProjectId, setSourceProjectId] = useState(SOURCE_PROJECT_ID);
  const [scheduleProjectId, setScheduleProjectId] = useState(SCHEDULE_PROJECT_ID);
  const [projectSite, setProjectSite] = useState("אולם תצוגה הרצליה");
  const [extraction, setExtraction] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [reviewReason, setReviewReason] = useState("");
  const [batchId, setBatchId] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const [prepared, setPrepared] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const autosaveEpoch = useRef(0);
  const autosaveTimer = useRef(null);
  const autosaveInFlightRequest = useRef(null);
  const pendingAutosaveRequest = useRef(null);
  const currentWorkspaceId = useRef("");
  const currentWorkspaceRevision = useRef(0);
  const lastSavedDraftSnapshot = useRef("");
  const autosaveBlocked = useRef(false);

  function isCurrentAutosaveRequest(request) {
    return Boolean(
      request
      && request.epoch === autosaveEpoch.current
      && request.workspaceId === currentWorkspaceId.current
    );
  }

  function clearAutosaveTimer() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
  }

  function scheduleAutosaveFlush(request) {
    if (!isCurrentAutosaveRequest(request) || autosaveBlocked.current) return;
    clearAutosaveTimer();
    const delay = Math.max(0, request.readyAt - Date.now());
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      flushAutosaveQueue();
    }, delay);
  }

  async function flushAutosaveQueue() {
    if (autosaveInFlightRequest.current || autosaveBlocked.current) return;
    const request = pendingAutosaveRequest.current;
    if (!isCurrentAutosaveRequest(request)) {
      pendingAutosaveRequest.current = null;
      return;
    }
    pendingAutosaveRequest.current = null;
    if (request.snapshot === lastSavedDraftSnapshot.current) {
      setAutosaveState("saved");
      setAutosaveMessage("");
      return;
    }

    const expectedRevision = currentWorkspaceRevision.current;
    autosaveInFlightRequest.current = request;
    setAutosaveState("saving");
    setAutosaveMessage("");
    try {
      const response = await api(`/api/contracts/workspaces/${request.workspaceId}/draft`, {
        method: "PUT",
        body: { ...request.payload, expectedRevision }
      });
      const savedRevision = Number(response.saved?.revision);
      if (!Number.isSafeInteger(savedRevision) || savedRevision <= expectedRevision) {
        const invalidResponse = new Error("The saved draft revision is invalid.");
        invalidResponse.code = "contracts_workspace_response_invalid";
        throw invalidResponse;
      }
      if (isCurrentAutosaveRequest(request)) {
        currentWorkspaceRevision.current = savedRevision;
        lastSavedDraftSnapshot.current = request.snapshot;
        setCurrentWorkspace((current) => current?.workspaceId === request.workspaceId
          ? {
              ...current,
              draft: {
                ...(current.draft || {}),
                ...request.payload,
                revision: savedRevision,
                updatedAt: response.saved?.updatedAt || new Date().toISOString(),
                reviewedCount: response.saved?.reviewedCount,
                approvedCount: response.saved?.approvedCount,
                rejectedCount: response.saved?.rejectedCount
              }
            }
          : current);
        const queued = pendingAutosaveRequest.current;
        if (isCurrentAutosaveRequest(queued) && queued.snapshot !== request.snapshot) {
          setAutosaveState("pending");
        } else {
          setAutosaveState("saved");
        }
        loadSavedContracts();
      }
    } catch (nextError) {
      if (isCurrentAutosaveRequest(request) && (nextError?.status === 409 || nextError?.code === "contracts_workspace_draft_stale")) {
        autosaveBlocked.current = true;
        autosaveEpoch.current += 1;
        pendingAutosaveRequest.current = null;
        clearAutosaveTimer();
        try {
          const response = await api(`/api/contracts/workspaces/${request.workspaceId}`);
          applyWorkspace(response.workspace, "", {
            autosaveConflictMessage: "הטיוטה השתנתה בחלון אחר. נטענה הגרסה העדכנית מהשרת; השינויים המקומיים שלא נשמרו לא הוחלו ולא דרסו החלטות חדשות יותר."
          });
        } catch {
          setAutosaveState("conflict");
          setAutosaveMessage("זוהתה טיוטה חדשה יותר ולא בוצעה דריסה. לא ניתן היה לטעון אותה כעת; יש לפתוח מחדש את החוזה השמור לפני עריכה נוספת.");
        }
      } else if (isCurrentAutosaveRequest(request)) {
        setAutosaveState("error");
        setAutosaveMessage(contractsUiError(nextError));
      }
    } finally {
      if (autosaveInFlightRequest.current === request) autosaveInFlightRequest.current = null;
      const queued = pendingAutosaveRequest.current;
      if (isCurrentAutosaveRequest(queued) && !autosaveBlocked.current) scheduleAutosaveFlush(queued);
    }
  }

  useEffect(() => {
    api("/api/contracts/review/status").then(setStatus).catch((nextError) => setError(contractsUiError(nextError)));
    api("/api/contracts/activity-mapping/status")
      .then(setMappingStatus)
      .catch((nextError) => setMappingStatusError(contractsUiError(nextError)));
    api("/api/contracts/workspaces/status")
      .then((nextStatus) => {
        setWorkspaceStatus(nextStatus);
        if (nextStatus.ready) loadSavedContracts(nextStatus);
      })
      .catch((nextError) => setWorkspaceError(contractsUiError(nextError)));
  }, []);

  useEffect(() => {
    if (!workspaceStatus?.ready || !/^[0-9a-f-]{36}$/iu.test(sourceProjectId.trim())) return;
    const timer = setTimeout(() => loadSavedContracts(), 350);
    return () => clearTimeout(timer);
  }, [sourceProjectId, workspaceStatus?.ready]);

  useEffect(() => {
    if (
      !workspaceStatus?.ready
      || !currentWorkspace?.workspaceId
      || !extraction
      || !batchId
      || !reviewedAt
      || autosaveBlocked.current
    ) return;
    const payload = workspaceDraftPayload({ decisions, reviewReason, batchId, reviewedAt, mappingDraft });
    const snapshot = workspaceDraftSnapshot(payload);
    const activeSave = autosaveInFlightRequest.current;
    if (snapshot === lastSavedDraftSnapshot.current && !isCurrentAutosaveRequest(activeSave)) {
      pendingAutosaveRequest.current = null;
      clearAutosaveTimer();
      setAutosaveState(currentWorkspace.draft ? "saved" : "idle");
      setAutosaveMessage("");
      return;
    }
    const request = {
      epoch: autosaveEpoch.current,
      workspaceId: currentWorkspace.workspaceId,
      payload,
      snapshot,
      readyAt: Date.now() + 700
    };
    pendingAutosaveRequest.current = request;
    setAutosaveState("pending");
    setAutosaveMessage("");
    scheduleAutosaveFlush(request);
    return clearAutosaveTimer;
  }, [
    decisions,
    reviewReason,
    batchId,
    reviewedAt,
    mappingDraft,
    extraction?.document?.documentVersionId,
    currentWorkspace?.workspaceId,
    workspaceStatus?.ready
  ]);

  useEffect(() => () => {
    autosaveEpoch.current += 1;
    pendingAutosaveRequest.current = null;
    clearAutosaveTimer();
  }, []);

  const candidateCount = extraction?.candidates?.length || 0;
  const approvedCount = useMemo(() => Object.values(decisions).filter((item) => item.action === "approve").length, [decisions]);
  const rejectedCount = candidateCount - approvedCount;
  const preparedMode = contractReviewSubmissionMode(prepared?.plan);

  async function loadSavedContracts(statusOverride = workspaceStatus) {
    if (!statusOverride?.ready || !/^[0-9a-f-]{36}$/iu.test(sourceProjectId.trim())) return;
    try {
      const query = new URLSearchParams({ sourceProjectId: sourceProjectId.trim(), limit: "50" });
      const response = await api(`/api/contracts/workspaces?${query}`);
      setSavedContracts(response.items || []);
      setWorkspaceError("");
    } catch (nextError) {
      setSavedContracts([]);
      setWorkspaceError(contractsUiError(nextError));
    }
  }

  function applyWorkspace(workspace, message = "", { autosaveConflictMessage = "" } = {}) {
    const nextExtraction = workspace.extraction;
    const restored = restoreReviewDraft(nextExtraction, workspace.draft);
    const restoredPayload = workspaceDraftPayload(restored);
    clearAutosaveTimer();
    autosaveEpoch.current += 1;
    pendingAutosaveRequest.current = null;
    autosaveBlocked.current = Boolean(autosaveConflictMessage);
    currentWorkspaceId.current = workspace.workspaceId;
    currentWorkspaceRevision.current = workspaceDraftRevision(workspace.draft);
    lastSavedDraftSnapshot.current = workspaceDraftSnapshot(restoredPayload);
    setAutosaveState(autosaveConflictMessage ? "conflict" : workspace.draft ? "saved" : "idle");
    setAutosaveMessage(autosaveConflictMessage);
    setExtraction(nextExtraction);
    setDecisions(restored.decisions);
    setReviewReason(restored.reviewReason);
    setBatchId(restored.batchId);
    setReviewedAt(restored.reviewedAt);
    setMappingDraft(restored.mappingDraft);
    setSourceProjectId(workspace.sourceProjectId || nextExtraction.projectBinding?.projectId || SOURCE_PROJECT_ID);
    setScheduleProjectId(workspace.scheduleProjectId || SCHEDULE_PROJECT_ID);
    setProjectSite(workspace.projectSite || nextExtraction.projectBinding?.projectSite || "");
    setCurrentWorkspace(workspace);
    setWorkspaceMessage(message);
    setPrepared(null);
    setResult(null);
    setError("");
    setFile(null);
  }

  async function openSavedContract(workspaceId) {
    setBusy("open-workspace");
    setWorkspaceError("");
    try {
      const response = await api(`/api/contracts/workspaces/${workspaceId}`);
      applyWorkspace(response.workspace, "החוזה והחלטות הטיוטה נטענו ללא קריאה חדשה למודל.");
    } catch (nextError) {
      setWorkspaceError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

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
    setWorkspaceError("");
    setWorkspaceMessage("");
    setPrepared(null);
    setResult(null);
    try {
      const pdfBase64 = await fileToBase64(file);
      const extractionRequest = {
        filename: file.name,
        mediaType: "application/pdf",
        pdfBase64,
        mode: "dry_run",
        projectSelection: {
          projectId: sourceProjectId.trim(),
          projectSite: projectSite.trim(),
          selectedByUser: true
        }
      };
      const response = workspaceStatus?.ready
        ? await api("/api/contracts/workspaces/extract", {
          method: "POST",
          timeoutMs: 300_000,
          body: { extractionRequest, scheduleProjectId: scheduleProjectId.trim() }
        })
        : await api("/api/contracts/extract", {
          method: "POST",
          timeoutMs: 300_000,
          body: extractionRequest
        });
      const nextExtraction = response.extraction || response;
      const restored = restoreReviewDraft(nextExtraction, response.draft);
      if (workspaceStatus?.ready) {
        const nextMessage = response.reused
          ? "החוזה כבר היה שמור: החילוץ והטיוטה נטענו ללא קריאת מודל וללא עלות טוקנים נוספת."
          : "החוזה, ה-PDF ותוצאת החילוץ נשמרו. השינויים בהחלטות יישמרו אוטומטית.";
        applyWorkspace({
          ...response.workspace,
          extraction: nextExtraction,
          draft: response.draft || null
        }, nextMessage);
        loadSavedContracts();
      } else {
        currentWorkspaceId.current = "";
        currentWorkspaceRevision.current = 0;
        lastSavedDraftSnapshot.current = "";
        setCurrentWorkspace(null);
        setExtraction(nextExtraction);
        setDecisions(restored.decisions);
        setBatchId(restored.batchId);
        setReviewedAt(restored.reviewedAt);
        setReviewReason(restored.reviewReason);
        setMappingDraft(restored.mappingDraft);
        setWorkspaceMessage("השמירה הקבועה עדיין אינה מופעלת בשרת; החילוץ נשמר רק במסך הנוכחי.");
      }
    } catch (nextError) {
      setError(contractsUiError(nextError));
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
      setError(contractsUiError(nextError));
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
      setError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="contractsPage">
      <header className="contractsHero">
        <div>
          <p className="contractsEyebrow">סוכן חוזים · שלב 2 + שלב 3F + שלב 3F.1</p>
          <h1>חילוץ, סקירה וקישור עובדות חוזיות ללוח</h1>
          <p>עובדות ומיפויי פעילות אינם משפיעים על מנוע הלו״ז לפני סקירה אנושית, פתרון חסמים וכתיבה אטומית מאושרת.</p>
        </div>
        <div className="contractsModeStack">
          <div className={`contractsMode ${status?.applyApproved ? "is-ready" : "is-paused"}`}>
            <strong>{status?.applyApproved ? "קידום עובדות פעיל" : "קידום עובדות מושבת"}</strong>
            <span>שלב 2 · גרסת תשתית {status?.migrationVersion || "—"}</span>
          </div>
          <div className={`contractsMode ${mappingStatus?.reviewApplyApproved ? "is-ready" : "is-paused"}`}>
            <strong>{mappingStatus?.reviewApplyApproved ? "ביקורת מיפוי פעילה" : "ביקורת מיפוי לקריאה בלבד"}</strong>
            <span>שלב 3F · גרסת תשתית {mappingStatus?.historyMigrationVersion || "—"}</span>
          </div>
          <div className={`contractsMode ${workspaceStatus?.ready ? "is-ready" : "is-paused"}`}>
            <strong>{workspaceStatus?.ready ? "שמירת חוזים פעילה" : "שמירת חוזים ממתינה להפעלה"}</strong>
            <span>שלב 3F.1 · גרסת תשתית {workspaceStatus?.migrationVersion || "—"}</span>
          </div>
        </div>
      </header>

      <section className="contractsPanel contractsWorkspacePanel">
        <div className="contractsSectionHeader">
          <div>
            <h2>חוזים שמורים והמשך עבודה</h2>
            <p>פתיחה מחדש אינה שולחת את ה-PDF למודל. כל גרסת מסמך נשמרת בנפרד והחלטות אינן מועתקות אוטומטית לגרסה חדשה.</p>
          </div>
          <span className={workspaceStatus?.ready ? "contractsPlanReady" : "contractsPlanBlocked"}>
            {workspaceStatus?.ready ? "שמירה אוטומטית פעילה" : "שמירה קבועה מושבתת"}
          </span>
        </div>
        {!workspaceStatus?.ready && (
          <p className="contractsActivationNotice">
            {workspaceError || "המיגרציה ודלי האחסון הפרטי עדיין לא הופעלו בשרת. אפשר להמשיך בחילוץ יבש, אך רענון הדף יאבד את הטיוטה."}
          </p>
        )}
        {workspaceStatus?.ready && savedContracts.length === 0 && (
          <p className="contractsMappingEmpty">אין עדיין חוזים שמורים לפרויקט MAIN הנבחר.</p>
        )}
        {workspaceStatus?.ready && savedContracts.length > 0 && (
          <div className="contractsSavedList" aria-label="חוזים שמורים">
            {savedContracts.map((workspace) => (
              <article key={workspace.workspaceId}>
                <div>
                  <strong>{workspace.projectSite || workspace.filename}</strong>
                  <span>{workspace.filename} · {workspace.candidateCount} מועמדים</span>
                  <small>
                    {workspace.draft
                      ? `${workspace.draft.reviewedCount}/${workspace.candidateCount} החלטות עם נימוק · נשמר ${formatHebrewDateTime(workspace.draft.updatedAt)}`
                      : `טרם נשמרה טיוטת החלטות · נוצר ${formatHebrewDateTime(workspace.createdAt)}`}
                  </small>
                  <small>מזהה פרויקט לוח זמנים: <bdi dir="ltr">{workspace.scheduleProjectId || "לא שויך"}</bdi></small>
                  <small dir="ltr">{workspace.documentVersionId}</small>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => openSavedContract(workspace.workspaceId)}
                >
                  {busy === "open-workspace" ? "פותח…" : "פתח והמשך"}
                </button>
              </article>
            ))}
          </div>
        )}
        {workspaceStatus?.ready && workspaceError && <div className="contractsMessage is-error" role="alert">{workspaceError}</div>}
      </section>

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
            מזהה פרויקט מקור ב־MAIN
            <input dir="ltr" value={sourceProjectId} onChange={(event) => setSourceProjectId(event.target.value)} />
          </label>
          <label>
            מזהה פרויקט לוח זמנים ב־KAPAIM
            <input dir="ltr" value={scheduleProjectId} onChange={(event) => setScheduleProjectId(event.target.value)} />
          </label>
        </div>
        <button type="button" className="contractsPrimary" disabled={Boolean(busy)} onClick={extractContract}>
          {busy === "extract"
            ? "בודק אם החוזה שמור, ומחלץ רק אם נדרש…"
            : workspaceStatus?.ready
              ? "טען, חלץ ושמור חוזה"
              : "הרץ חילוץ יבש"}
        </button>
        {workspaceMessage && <div className="contractsMessage is-success" role="status">{workspaceMessage}</div>}
      </section>

      {extraction && (
        <section className="contractsPanel">
          <div className="contractsSectionHeader">
            <div>
              <h2>2. סקירת מועמדים</h2>
              <p>{candidateCount} מועמדים · {approvedCount} לאישור · {rejectedCount} לדחייה</p>
            </div>
            <div className="contractsWorkspaceSaveState" role="status">
              <span className="contractsDryBadge">חילוץ יבש · ללא כתיבה ללוח</span>
              {currentWorkspace?.workspaceId && (
                <span className={`contractsAutosave is-${autosaveState}`}>
                  {autosaveState === "saving" || autosaveState === "pending"
                    ? "שומר טיוטה…"
                    : autosaveState === "conflict"
                      ? "זוהתה טיוטה חדשה יותר"
                      : autosaveState === "idle"
                        ? "טרם בוצעו שינויים בטיוטה"
                        : autosaveState === "error"
                          ? "השמירה האוטומטית נכשלה"
                          : "כל שינויי הטיוטה נשמרו"}
                </span>
              )}
            </div>
          </div>
          {autosaveMessage && <div className="contractsMessage is-error" role="alert">{autosaveMessage}</div>}

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
                מצב: {reviewPlanStatusLabel(prepared.plan?.status)} · פעולה בטוחה: {preparedMode === CONTRACT_REVIEW_SUBMISSION_MODE.promotion
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
              {prepared.plan.globalBlockers.map((blocker) => <li key={blocker}>{promotionBlockerLabel(blocker)}</li>)}
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
              {!status?.applyApproved && <p className="contractsActivationNotice">שמירת ביקורות מושבתת בצד השרת. שינוי תשתית הנתונים אינו נבדק או מופעל מכפתור זה.</p>}
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

      {extraction && (
        <ActivityMappingReviewWorkspace
          extraction={extraction}
          sourceProjectId={sourceProjectId.trim()}
          status={mappingStatus}
          statusError={mappingStatusError}
          savedState={mappingDraft}
          savedStateKey={currentWorkspace?.workspaceId || ""}
          onDraftStateChange={setMappingDraft}
        />
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
