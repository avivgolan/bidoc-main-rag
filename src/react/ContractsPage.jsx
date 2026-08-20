import React, { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } from "../contracts/reviewMode.js";
import {
  contractsClauseTypeLabelHe,
  contractsStructuralRoleLabelHe,
  contractsTagLabelHe,
  decorateContractsClausePreview
} from "../contracts/clausePresentation.js";
import {
  buildContractsExplicitReferencePreview,
  contractsRelationshipOriginLabelHe,
  contractsRelationshipReviewLabelHe,
  contractsRelationshipTypeLabelHe
} from "../contracts/relationshipProposals.js";
import {
  contractActionLabel,
  contractDirectionLabel,
  contractGateLabel,
  contractRoleLabel,
  contractUnitLabel,
  contractsDecisionCategoryLabelHe,
  contractsDecisionReviewLabelHe,
  contractsIndicatorHandoffReasonLabelHe,
  contractsIndicatorHandoffStatusLabelHe,
  contractsScheduleImpactLabelHe,
  contractsTemporalKindLabelHe,
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
const CONTRACTS_DECISION_CATEGORY_OPTIONS = [
  "scope_and_execution",
  "commencement_and_completion",
  "stage_acceptance_and_handover",
  "payment_and_commercial",
  "notice_and_communication",
  "change_and_approval",
  "bond_and_security",
  "warranty_and_defects",
  "recurring_compliance",
  "delay_extension_and_consequence",
  "termination_and_remedy",
  "document_and_information_obligation",
  "other"
];

const CONTRACTS_WORKSPACE_TABS = Object.freeze([
  { id: "clauses", label: "תוכן החוזה", description: "סעיפים וחילוץ" },
  { id: "relationships", label: "קשרים בין סעיפים", description: "הפניות וקשרים סמנטיים" },
  { id: "decisions", label: "החלטות חוזיות", description: "נרמול וסקירה" },
  { id: "indicator", label: "מסירה ל־Indicator", description: "ערכת החלטות מאושרת" }
]);

function ContractsWorkspaceTabs({ activeTab, onChange }) {
  function moveFocus(event, currentIndex) {
    let nextIndex = null;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex + 1) % CONTRACTS_WORKSPACE_TABS.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex - 1 + CONTRACTS_WORKSPACE_TABS.length) % CONTRACTS_WORKSPACE_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = CONTRACTS_WORKSPACE_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = CONTRACTS_WORKSPACE_TABS[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`contracts-workspace-tab-${nextTab.id}`)?.focus());
  }

  return (
    <nav className="contractsWorkspaceTabs" role="tablist" aria-label="שלבי העבודה בחוזה הפתוח">
      {CONTRACTS_WORKSPACE_TABS.map((tab, index) => (
        <button
          id={`contracts-workspace-tab-${tab.id}`}
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`contracts-workspace-panel-${tab.id}`}
          className={activeTab === tab.id ? "is-active" : ""}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => moveFocus(event, index)}
        >
          <strong>{tab.label}</strong>
          <small>{tab.description}</small>
        </button>
      ))}
    </nav>
  );
}

function ContractsWorkspaceTabPanel({ id, activeTab, children }) {
  const active = activeTab === id;
  return (
    <div
      id={`contracts-workspace-panel-${id}`}
      className="contractsWorkspaceTabPanel"
      role="tabpanel"
      aria-labelledby={`contracts-workspace-tab-${id}`}
      tabIndex={active ? 0 : -1}
      hidden={!active}
    >
      {children}
    </div>
  );
}

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

function ContractsClausePreviewPanel({ preview, classicDocumentVersionId = "" }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("operative");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [referencesOnly, setReferencesOnly] = useState(false);
  const presentedPreview = useMemo(() => decorateContractsClausePreview(preview), [preview]);
  const clauses = presentedPreview.clauses || [];
  const types = useMemo(() => [...new Set(clauses.map((clause) => clause.clauseType))].sort(), [clauses]);
  const tags = useMemo(() => [...new Set(clauses.flatMap((clause) => clause.hashtags || []))].sort(), [clauses]);
  const clausesByKey = useMemo(() => new Map(clauses.map((clause) => [clause.clauseKey, clause])), [clauses]);
  const normalizedQuery = query.trim().toLocaleLowerCase("he");
  const filteredClauses = useMemo(() => clauses.filter((clause) => {
    if (roleFilter !== "all" && clause.structuralRole !== roleFilter) return false;
    if (typeFilter !== "all" && clause.clauseType !== typeFilter) return false;
    if (tagFilter !== "all" && !(clause.hashtags || []).includes(tagFilter)) return false;
    if (referencesOnly && !(clause.crossReferences || []).length) return false;
    if (!normalizedQuery) return true;
    return [
      clause.clauseKey,
      clause.parentClauseKey,
      clause.clauseTitle,
      clause.summaryHe,
      clause.rawText,
      clause.displayLabelHe,
      clause.structuralRoleLabelHe,
      ...(clause.hashtags || []),
      ...(clause.tagLabelsHe || [])
    ].filter(Boolean).join(" ").toLocaleLowerCase("he").includes(normalizedQuery);
  }), [clauses, normalizedQuery, referencesOnly, roleFilter, tagFilter, typeFilter]);
  const displayRows = useMemo(() => {
    const rows = [];
    const renderedHeadings = new Set();
    for (const clause of filteredClauses) {
      const parent = clausesByKey.get(clause.parentClauseKey);
      const heading = clause.structuralRole === "heading"
        ? clause
        : parent?.structuralRole === "heading" ? parent : null;
      if (heading && !renderedHeadings.has(heading.clauseKey)) {
        rows.push({ kind: "heading", clause: heading });
        renderedHeadings.add(heading.clauseKey);
      }
      if (clause.structuralRole !== "heading") rows.push({ kind: "record", clause });
    }
    return rows;
  }, [clausesByKey, filteredClauses]);
  const comparisonState = !classicDocumentVersionId
    ? "classic-missing"
    : classicDocumentVersionId === presentedPreview.document.documentVersionId
      ? "same-document"
      : "different-document";

  return (
    <section className="contractsPanel contractsClausePreviewPanel" aria-labelledby="contracts-clause-preview-title">
      <div className="contractsSectionHeader">
        <div>
          <p className="contractsEyebrow">סוכן החוזים · {presentedPreview.persisted ? "חילוץ שמור R3.2" : "תצוגת אימות R3.1"}</p>
          <h2 id="contracts-clause-preview-title">2. תוכן החוזה שחולץ</h2>
          <p>{presentedPreview.document.filename} · {presentedPreview.document.pageCount} עמודים · {clauses.length} רשומות מסמך · {presentedPreview.coverage.operativeCount} הוראות חוזיות</p>
        </div>
        <div className="contractsWorkspaceSaveState">
          <span className="contractsPlanReady">כיסוי מקור מלא</span>
          <span className="contractsDryBadge">
            {presentedPreview.persisted ? "נשמר ב־KAPAIM · פתיחה ללא חילוץ חוזר" : "תצוגה מקומית · לא נשמר"}
          </span>
        </div>
      </div>

      <div className={`contractsComparisonNotice is-${comparisonState}`} role="status">
        {comparisonState === "same-document"
          ? "תוצאת החילוץ הקלאסי שייכת לאותה גרסת PDF — אפשר להשוות בין שתי התוצאות במסך זה."
          : comparisonState === "different-document"
            ? "תוצאת החילוץ הקלאסי הפתוחה שייכת לגרסת PDF אחרת. יש להריץ אותה מחדש על הקובץ הנבחר לפני ההשוואה."
            : "כדי להשוות, אפשר להריץ גם את החילוץ הקלאסי באמצעות הכפתור שבאזור העלאת הקובץ."}
      </div>

      <div className="contractsClauseMetrics" aria-label="מדדי שלמות החילוץ">
        <span><small>שורות מקור</small><strong>{presentedPreview.coverage.accountedSourceLineCount}/{presentedPreview.coverage.sourceLineCount}</strong></span>
        <span><small>יחידות ממוספרות</small><strong>{presentedPreview.coverage.numberedSourceCount}</strong></span>
        <span><small>הוראות חוזיות</small><strong>{presentedPreview.coverage.operativeCount}</strong></span>
        <span><small>כותרות מבניות</small><strong>{presentedPreview.coverage.headingCount}</strong></span>
        <span><small>הגדרות חוזיות</small><strong>{presentedPreview.coverage.definitionCount}</strong></span>
        <span><small>רשומות הקשר</small><strong>{presentedPreview.coverage.contextCount}</strong></span>
        <span><small>הפניות שזוהו</small><strong>{presentedPreview.quality.referenceCount}</strong></span>
        <span><small>שגיאות כיסוי</small><strong>{presentedPreview.coverage.errorCount}</strong></span>
      </div>

      <div className="contractsClauseFilters">
        <label>
          חיפוש בכל הסעיפים
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="מספר סעיף, מילה, תקציר או תגית"
          />
        </label>
        <label>
          תצוגה
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="operative">הוראות חוזיות בלבד</option>
            <option value="all">כל רשומות המסמך</option>
            <option value="heading">כותרות ומבנה</option>
            <option value="definition">הגדרות חוזיות</option>
            <option value="context">הקשר מסמך</option>
          </select>
        </label>
        <label>
          סוג רשומה
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">כל הסוגים</option>
            {types.map((type) => <option key={type} value={type}>{contractsClauseTypeLabelHe(type)}</option>)}
          </select>
        </label>
        <label>
          תגית
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">כל התגיות</option>
            {tags.map((tag) => <option key={tag} value={tag}>{contractsTagLabelHe(tag)}</option>)}
          </select>
        </label>
        <label className="contractsCheck contractsClauseReferenceFilter">
          <input type="checkbox" checked={referencesOnly} onChange={(event) => setReferencesOnly(event.target.checked)} />
          רק סעיפים עם הפניות
        </label>
      </div>

      <div className="contractsClauseResultBar">
        <strong>{filteredClauses.length}</strong> מתוך {clauses.length} רשומות מוצגות
        {(query || roleFilter !== "operative" || typeFilter !== "all" || tagFilter !== "all" || referencesOnly) && (
          <button type="button" onClick={() => { setQuery(""); setRoleFilter("operative"); setTypeFilter("all"); setTagFilter("all"); setReferencesOnly(false); }}>
            נקה סינון
          </button>
        )}
      </div>

      <div className="contractsClauseList">
        {displayRows.map((row) => row.kind === "heading" ? (
          <section className="contractsClauseHeading" key={`heading-${row.clause.clauseKey}`} aria-label={row.clause.displayLabelHe}>
            <div>
              <bdi dir="ltr">{row.clause.clauseKey.replace(/\.heading$/u, "")}</bdi>
              <span className="contractsClauseHeadingText">
                <h3>{row.clause.clauseTitle || row.clause.displayLabelHe}</h3>
                {row.clause.structuralLeadHe && <p>פתיח הסעיף: {row.clause.structuralLeadHe}</p>}
              </span>
            </div>
            <span>{row.clause.childCount} רשומות תחת כותרת זו</span>
          </section>
        ) : (
          <details className={`contractsClauseCard is-${row.clause.structuralRole}`} key={row.clause.clauseKey}>
            <summary>
              <span className="contractsClauseIdentity">
                <bdi dir="ltr">{row.clause.clauseKey}</bdi>
                <small>{row.clause.structuralRoleLabelHe} · {row.clause.pageStart === row.clause.pageEnd ? `עמוד ${row.clause.pageStart}` : `עמודים ${row.clause.pageStart}–${row.clause.pageEnd}`}</small>
              </span>
              <span className="contractsClauseSummary">{row.clause.summaryHe}</span>
              <span className="contractsClauseTags">
                {(row.clause.hashtags || []).map((tag) => <i key={tag}>{contractsTagLabelHe(tag)}</i>)}
              </span>
            </summary>
            <div className="contractsClauseBody">
              <div className="contractsClauseSource">
                <strong>הטקסט המקורי</strong>
                <p>{row.clause.rawText}</p>
              </div>
              <div className="contractsClauseEnrichment">
                <strong>תוצאת סוכן החוזים</strong>
                <p>{row.clause.summaryHe}</p>
                <small>סיווג: {contractsStructuralRoleLabelHe(row.clause.structuralRole)}</small>
              </div>
              {(row.clause.crossReferences || []).length > 0 && (
                <div className="contractsClauseReferences">
                  <strong>הפניות מפורשות שנמצאו</strong>
                  <ul>
                    {row.clause.crossReferences.map((reference, index) => (
                      <li key={`${reference.referenceText}-${reference.targetClauseKey}-${index}`}>
                        “{reference.referenceText}” ← {reference.targetLabelHe}
                        <span className={reference.resolution === "resolved" ? "is-resolved" : "is-unresolved"}>
                          {reference.resolution === "resolved" ? "נמצא יעד" : "היעד חסר במסמך"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="contractsClauseTechnical contractsClauseRecordTechnical">
                <summary>פרטים טכניים של הרשומה</summary>
                <div className="contractsClauseSearchContent">
                  <strong>תוכן החיפוש בעברית</strong>
                  <p>{row.clause.displayContentHe}</p>
                </div>
                <small>סטטוס עיבוד: {row.clause.processingStatus === "processed" ? "עובד ואומת" : row.clause.processingStatus}</small>
                {row.clause.parentClauseKey && <small>מזהה רשומת אב: <bdi dir="ltr">{row.clause.parentClauseKey}</bdi></small>}
                {(row.clause.crossReferences || []).map((reference, index) => (
                  <small key={`technical-reference-${index}`}>מזהה יעד: <bdi dir="ltr">{reference.targetClauseKey}</bdi></small>
                ))}
                <footer>
                  <code dir="ltr">מקור {row.clause.rawTextSha256}</code>
                  <code dir="ltr">תוכן {row.clause.contentSha256}</code>
                </footer>
              </details>
            </div>
          </details>
        ))}
      </div>

      <details className="contractsClauseTechnical">
        <summary>פרטי גרסאות טכניים</summary>
        <code dir="ltr">{presentedPreview.presentationVersion}</code>
        <code dir="ltr">{presentedPreview.generations.parserGenerationId}</code>
        <code dir="ltr">{presentedPreview.generations.enrichmentGenerationId}</code>
        <code dir="ltr">{presentedPreview.generations.modelVersion}</code>
      </details>
    </section>
  );
}

function contractsModelConfidenceLabelHe(value) {
  const confidence = Number(value || 0);
  if (confidence >= 0.97) return "גבוה מאוד";
  if (confidence >= 0.9) return "גבוה";
  return "בינוני";
}

const SEMANTIC_RELATIONSHIP_TYPE_OPTIONS = Object.freeze([
  "supports_same_decision",
  "depends_on",
  "condition_of",
  "exception_to",
  "amends",
  "duplicates",
  "conflicts_with"
]);

function SemanticRelationshipReviewCard({ item, busy = false, onReview }) {
  const [reasonHe, setReasonHe] = useState("");
  const [relationshipType, setRelationshipType] = useState(item.relationshipType);
  const [reverseDirection, setReverseDirection] = useState(false);
  const reviewable = item.reviewStatus === "proposed";
  const reasonReady = reasonHe.trim().length >= 10 && /[\u0590-\u05ff]/u.test(reasonHe);
  const symmetric = ["duplicates", "conflicts_with"].includes(relationshipType);
  const correctionChanged = relationshipType !== item.relationshipType || (!symmetric && reverseDirection);
  const sourceClauseKey = reverseDirection && !symmetric ? item.targetClauseKey : item.sourceClauseKey;
  const targetClauseKey = reverseDirection && !symmetric ? item.sourceClauseKey : item.targetClauseKey;
  const excerpts = Array.isArray(item.evidence?.excerpts) ? item.evidence.excerpts : [];

  function submit(action) {
    const body = { reasonHe: reasonHe.trim() };
    if (action === "correct") {
      body.correction = { relationshipType, sourceClauseKey, targetClauseKey };
    }
    onReview(item, action, body);
  }

  return (
    <article className={`contractsRelationshipCard is-semantic is-review-${item.reviewStatus}`}>
      <div className="contractsRelationshipRoute">
        <span>
          <small>סעיף מקור · עמודים {item.sourcePageStart === item.sourcePageEnd ? item.sourcePageStart : `${item.sourcePageStart}–${item.sourcePageEnd}`}</small>
          <strong><bdi dir="ltr">{item.sourceClauseKey}</bdi></strong>
          <p>{item.sourceSummaryHe}</p>
        </span>
        <b className="contractsRelationshipArrow" aria-label="קשור אל">←</b>
        <span>
          <small>סעיף יעד · עמודים {item.targetPageStart === item.targetPageEnd ? item.targetPageStart : `${item.targetPageStart}–${item.targetPageEnd}`}</small>
          <strong><bdi dir="ltr">{item.targetClauseKey}</bdi></strong>
          <p>{item.targetSummaryHe}</p>
        </span>
      </div>
      <div className="contractsRelationshipMeta">
        <i>{contractsRelationshipTypeLabelHe(item.relationshipType)}</i>
        <i>{contractsRelationshipOriginLabelHe(item.origin)}</i>
        <i>{contractsRelationshipReviewLabelHe(item.reviewStatus)}</i>
        {item.confidence !== null && item.confidence !== undefined && (
          <i title="ביטחון הסיווג של המודל; אינו ודאות משפטית">
            ביטחון סיווג: {contractsModelConfidenceLabelHe(item.confidence)}
          </i>
        )}
        <span>גרסה {item.revision}</span>
      </div>
      <p className="contractsRelationshipRationale">{item.evidence?.rationaleHe}</p>
      <details className="contractsRelationshipEvidence">
        <summary>הצג את שתי הראיות המקוריות</summary>
        <div>{excerpts.map((evidence, index) => <blockquote key={evidence.clauseId || index}>{evidence.excerpt}</blockquote>)}</div>
      </details>

      {reviewable ? (
        <div className="contractsRelationshipReviewForm">
          <label>
            <span>נימוק סקירה בעברית — לפחות 10 תווים</span>
            <textarea
              rows="2"
              value={reasonHe}
              onChange={(event) => setReasonHe(event.target.value)}
              placeholder="לדוגמה: שתי הראיות מתארות את אותו קנס יומי בסכומים סותרים."
              disabled={busy}
            />
          </label>
          <div className="contractsRelationshipReviewActions">
            <button type="button" className="contractsPrimary" disabled={!reasonReady || busy} onClick={() => submit("approve")}>
              אשר קשר
            </button>
            <button type="button" disabled={!reasonReady || busy} onClick={() => submit("reject")}>
              דחה קשר
            </button>
          </div>
          <details className="contractsRelationshipCorrection">
            <summary>תקן סוג קשר או כיוון</summary>
            <div>
              <label>
                <span>סוג הקשר המתוקן</span>
                <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} disabled={busy}>
                  {SEMANTIC_RELATIONSHIP_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{contractsRelationshipTypeLabelHe(type)}</option>
                  ))}
                </select>
              </label>
              <label className="contractsRelationshipDirectionToggle">
                <input
                  type="checkbox"
                  checked={reverseDirection && !symmetric}
                  onChange={(event) => setReverseDirection(event.target.checked)}
                  disabled={busy || symmetric}
                />
                <span>הפוך כיוון: <bdi dir="ltr">{item.targetClauseKey}</bdi> ← <bdi dir="ltr">{item.sourceClauseKey}</bdi></span>
              </label>
              {symmetric && <small>בקשר סימטרי אין משמעות לכיוון; נקודות הקצה נשמרות בסדר קבוע.</small>}
              <button
                type="button"
                className="contractsPrimary"
                disabled={!reasonReady || !correctionChanged || busy}
                onClick={() => submit("correct")}
              >
                שמור תיקון ואשר
              </button>
            </div>
          </details>
        </div>
      ) : (
        <div className="contractsRelationshipReviewedState" role="status">
          <strong>{contractsRelationshipReviewLabelHe(item.reviewStatus)}</strong>
          {item.reviewReason && <p>{item.reviewReason}</p>}
          {item.reviewedAt && <time dateTime={item.reviewedAt}>{formatHebrewDateTime(item.reviewedAt)}</time>}
        </div>
      )}
    </article>
  );
}

function ContractsRelationshipsPreviewPanel({
  preview,
  workspaceId = "",
  persistenceStatus = null,
  persistenceResult = null,
  persistenceError = "",
  persistenceBusy = false,
  onPersist,
  semanticStatus = null,
  semanticResult = null,
  semanticError = "",
  semanticBusy = false,
  onRunSemantic,
  reviewStatus = null,
  reviewResult = null,
  reviewError = "",
  reviewBusyId = "",
  onReview
}) {
  const relationshipPreview = useMemo(() => buildContractsExplicitReferencePreview(preview), [preview]);
  const persistedCount = Number(persistenceResult?.metrics?.explicitRelationshipCount || 0);
  const savedSemanticCount = Number(reviewResult?.metrics?.currentRelationshipCount || 0);
  const pendingSemanticReviewCount = Number(reviewResult?.metrics?.proposedCount || 0);
  const canPersist = Boolean(persistenceStatus?.ready && workspaceId && !persistenceBusy && !semanticBusy);
  const canRunSemantic = Boolean(semanticStatus?.ready && workspaceId && !semanticBusy && !persistenceBusy);
  const fullyPersisted = persistedCount === relationshipPreview.metrics.explicitRelationshipCount
    && relationshipPreview.metrics.explicitRelationshipCount > 0;
  const semanticClassificationFailedPairCount = Number(semanticResult?.metrics?.classificationFailedPairCount || 0);
  const semanticVerificationFailedPairCount = Number(semanticResult?.metrics?.verificationFailedPairCount || 0);
  const semanticAnalysisComplete = semanticResult?.metrics?.classificationComplete !== false
    && semanticResult?.metrics?.verificationComplete !== false;

  return (
    <section className="contractsPanel contractsRelationshipsPanel" aria-labelledby="contracts-relationships-title">
      <div className="contractsSectionHeader">
        <div>
          <p className="contractsEyebrow">סוכן הקשרים בחוזים · R4.0 + R4.1 + R4.2A</p>
          <h2 id="contracts-relationships-title">3. קשרים בין סעיפי החוזה</h2>
          <p>הפניות מפורשות נשמרות בנפרד; קשרים סמנטיים נשמרים כהצעות וממתינים להחלטת סוקר.</p>
        </div>
        <div className="contractsWorkspaceSaveState" role="status">
          <span className={fullyPersisted ? "contractsPlanReady" : "contractsDryBadge"}>
            {fullyPersisted ? `נשמרו ${persistedCount} הצעות קשר ב־KAPAIM` : "תצוגה דטרמיניסטית לפני שמירה"}
          </span>
          <span className="contractsDryBadge">ללא החלטות חוזיות · ללא כתיבה ללוח הזמנים</span>
        </div>
      </div>

      <div className="contractsRelationshipBoundary" role="note">
        הפניה מפורשת מוכיחה שסעיף אחד מפנה לסעיף אחר. היא אינה מוכיחה לבדה ששני הסעיפים שייכים לאותה החלטה, תלויים זה בזה או סותרים זה את זה.
      </div>

      <div className="contractsClauseMetrics" aria-label="מדדי סוכן הקשרים">
        <span><small>הפניות מפורשות שנמצאו</small><strong>{relationshipPreview.metrics.explicitReferenceCount}</strong></span>
        <span><small>הצעות קשר ישירות</small><strong>{relationshipPreview.metrics.explicitRelationshipCount}</strong></span>
        <span><small>הפניות ללא יעד</small><strong>{relationshipPreview.metrics.unresolvedReferenceCount}</strong></span>
        <span><small>קשרים שהוצעו בידי מודל</small><strong>{relationshipPreview.metrics.modelRelationshipCount}</strong></span>
        <span><small>החלטות חוזיות שנוצרו</small><strong>{relationshipPreview.metrics.decisionCount}</strong></span>
        <span><small>כתיבות ללוח הזמנים</small><strong>{relationshipPreview.metrics.scheduleWriteCount}</strong></span>
      </div>

      <div className="contractsRelationshipActions">
        <button type="button" className="contractsPrimary" disabled={!canPersist} onClick={onPersist}>
          {persistenceBusy ? "שומר הצעות קשר מפורשות…" : fullyPersisted ? "בדוק ושמור שוב ללא כפילויות" : "שמור את הצעות הקשר המפורשות"}
        </button>
        <p>
          {!workspaceId
            ? "שמירת קשרים זמינה רק לאחר פתיחת חילוץ סעיפים שמור."
            : !persistenceStatus?.ready
              ? "מיגרציית R4.0 והפעלת השרת עדיין נדרשות לפני שמירה; התצוגה המקומית כבר זמינה לבדיקה."
              : "השמירה אטומית וחוזרת משתמשת באותן רשומות במקום ליצור כפילויות."}
        </p>
      </div>
      {persistenceStatus?.ready && persistenceError && (
        <div className="contractsMessage is-error" role="alert">{persistenceError}</div>
      )}

      <div className="contractsRelationshipList">
        {relationshipPreview.proposals.map((proposal) => (
          <article className="contractsRelationshipCard" key={proposal.proposalKey}>
            <div className="contractsRelationshipRoute">
              <span>
                <small>סעיף מפנה</small>
                <strong><bdi dir="ltr">{proposal.sourceClauseKey}</bdi> · {proposal.sourceLabelHe}</strong>
                <p>{proposal.sourceSummaryHe}</p>
              </span>
              <b className="contractsRelationshipArrow" aria-label="מפנה אל">←</b>
              <span>
                <small>סעיף יעד</small>
                <strong><bdi dir="ltr">{proposal.targetClauseKey}</bdi> · {proposal.targetLabelHe}</strong>
                <p>{proposal.targetSummaryHe}</p>
              </span>
            </div>
            <div className="contractsRelationshipMeta">
              <i>{contractsRelationshipTypeLabelHe(proposal.relationshipType)}</i>
              <i>{contractsRelationshipOriginLabelHe(proposal.origin)}</i>
              <i>{contractsRelationshipReviewLabelHe(proposal.reviewStatus)}</i>
              <span>הטקסט המפנה: {proposal.referenceTexts.map((item) => `“${item}”`).join(" · ")}</span>
            </div>
            <p className="contractsRelationshipRationale">{proposal.rationaleHe}</p>
          </article>
        ))}
      </div>

      {relationshipPreview.unresolvedReferences.length > 0 && (
        <details className="contractsRelationshipUnresolved">
          <summary>{relationshipPreview.unresolvedReferences.length} הפניות נשמרו לבדיקה משום שלא נמצא להן יעד</summary>
          <ul>
            {relationshipPreview.unresolvedReferences.map((reference, index) => (
              <li key={`${reference.sourceClauseKey}-${reference.targetClauseKey}-${index}`}>
                <bdi dir="ltr">{reference.sourceClauseKey}</bdi> · “{reference.referenceText}” → {reference.targetLabelHe}. {reference.reasonHe}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="contractsSemanticRelationships" aria-labelledby="contracts-semantic-relationships-title">
        <div className="contractsSectionHeader">
          <div>
            <p className="contractsEyebrow">R4.1 · גילוי קשרים סמנטיים</p>
            <h3 id="contracts-semantic-relationships-title">הצעות קשר שאינן כתובות כהפניה ישירה</h3>
            <p>הסוכן מדרג זוגות מתוך אותה גרסת חוזה ומציע קשר רק כאשר שתי הראיות תומכות בסוג הקשר ובכיוונו.</p>
          </div>
          <div className="contractsWorkspaceSaveState" role="status">
            <span className={reviewStatus?.ready ? "contractsPlanReady" : "contractsDryBadge"}>
              {reviewStatus?.ready
                ? savedSemanticCount > 0
                  ? `${savedSemanticCount} קשרים שמורים · ${pendingSemanticReviewCount} ממתינים לסקירה`
                  : "תוצאות מלאות יישמרו ב־KAPAIM לסקירה"
                : "תצוגת איכות זמנית · אינה נשמרת"}
            </span>
            <span className="contractsDryBadge">ללא יצירת החלטות · ללא הכרעה בסתירות</span>
          </div>
        </div>

        <div className="contractsRelationshipBoundary is-semantic" role="note">
          דמיון בנושא בלבד אינו מספיק. כל הצעה עוברת כלל מקור קשיח ובדיקה ספקנית נפרדת של המודל. ביטחון הסיווג אינו ודאות משפטית, ורק החלטת סוקר מפורשת מאשרת, מתקנת או דוחה את הקשר.
        </div>

        <div className="contractsRelationshipActions">
          <button type="button" className="contractsPrimary" disabled={!canRunSemantic} onClick={onRunSemantic}>
            {semanticBusy
              ? "מאתר, בודק ושומר קשרים סמנטיים…"
              : reviewStatus?.ready
                ? semanticResult ? "הרץ שוב ושמור ללא כפילויות" : "הרץ, אמת ושמור הצעות לסקירה"
                : semanticResult ? "הרץ שוב תצוגת קשרים סמנטיים" : "הרץ תצוגת קשרים סמנטיים"}
          </button>
          <p>
            {!workspaceId
              ? "הניתוח זמין לאחר פתיחת חילוץ סעיפים שמור."
              : !semanticStatus?.applyApproved
                ? "הפעלת R4.1 המקומית עדיין לא אושרה בשרת."
                : !semanticStatus?.modelConfigured
                  ? "מפתח המודל אינו מוגדר בשרת."
                  : reviewStatus?.ready
                    ? "רק ניתוח מלא שעבר את הבדיקה הספקנית יישמר; הרצה חוזרת משתמשת ברשומות קיימות ואינה מוחקת החלטות סקירה."
                    : "הניתוח משתמש רק בסעיפים השמורים ובמפתח המודל שבשרת; הדפדפן אינו שולח סעיפים או הגדרות מודל."}
          </p>
        </div>

        {semanticError && <div className="contractsMessage is-error" role="alert">{semanticError}</div>}
        {reviewError && <div className="contractsMessage is-error" role="alert">{reviewError}</div>}

        {semanticResult && (
          <>
            {!semanticAnalysisComplete && (
              <div className="contractsMessage is-warning" role="status">
                הניתוח הושלם חלקית ובאופן בטוח. {[
                  semanticClassificationFailedPairCount > 0
                    ? `${semanticClassificationFailedPairCount} זוגות לא סווגו משום שתשובת המסווג לא הייתה תקינה.`
                    : "",
                  semanticVerificationFailedPairCount > 0
                    ? `${semanticVerificationFailedPairCount} זוגות לא הוצגו משום שהבדיקה הספקנית שלהם לא הושלמה.`
                    : ""
                ].filter(Boolean).join(" ")} אפשר להריץ שוב כדי לנסות להשלים אותם.
              </div>
            )}
            <div className="contractsClauseMetrics" aria-label="מדדי גילוי קשרים סמנטיים">
              <span><small>זוגות מועמדים שנבחרו</small><strong>{semanticResult.metrics?.candidatePairCount || 0}</strong></span>
              <span><small>זוגות שנבדקו בידי המודל</small><strong>{semanticResult.metrics?.modelAssessedPairCount || 0}</strong></span>
              <span><small>זוגות שלא סווגו עקב תשובה לא תקינה</small><strong>{semanticClassificationFailedPairCount}</strong></span>
              <span><small>קשרים שהציע המסווג</small><strong>{semanticResult.metrics?.classifierRelationshipCount || 0}</strong></span>
              <span><small>הצעות שנשלחו לבדיקה ספקנית</small><strong>{semanticResult.metrics?.relationshipVerificationAssessedCount || 0}</strong></span>
              <span><small>הצעות שנדחו בכלל מקור קשיח</small><strong>{semanticResult.metrics?.deterministicTypeGateRejectedCount || 0}</strong></span>
              <span><small>הצעות שנדחו בבדיקה הספקנית</small><strong>{semanticResult.metrics?.relationshipVerificationRejectedCount || 0}</strong></span>
              <span><small>זוגות שלא הוצגו עקב כשל בבדיקה</small><strong>{semanticVerificationFailedPairCount}</strong></span>
              <span><small>הצעות סופיות לסקירה</small><strong>{semanticResult.metrics?.modelRelationshipCount || 0}</strong></span>
              <span><small>זוגות שסווגו ללא קשר</small><strong>{semanticResult.metrics?.noRelationshipCount || 0}</strong></span>
              <span><small>הצעות מתחת לסף הביטחון</small><strong>{semanticResult.metrics?.belowThresholdCount || 0}</strong></span>
              <span><small>מתוכן: סתירות בין צדדים שונים שנדחו</small><strong>{semanticResult.metrics?.asymmetricConflictRejectedCount || 0}</strong></span>
              <span><small>החלטות חוזיות שנוצרו</small><strong>{semanticResult.metrics?.decisionCount || 0}</strong></span>
              <span><small>קשרים שמורים לסקירה</small><strong>{savedSemanticCount}</strong></span>
              <span><small>כתיבות ללוח הזמנים</small><strong>{semanticResult.metrics?.scheduleWriteCount || 0}</strong></span>
            </div>

            <div className="contractsRelationshipList">
              {(semanticResult.proposals || []).map((proposal) => (
                <article className="contractsRelationshipCard is-semantic" key={proposal.proposalKey}>
                  <div className="contractsRelationshipRoute">
                    <span>
                      <small>סעיף מקור · עמודים {proposal.sourcePageStart === proposal.sourcePageEnd ? proposal.sourcePageStart : `${proposal.sourcePageStart}–${proposal.sourcePageEnd}`}</small>
                      <strong><bdi dir="ltr">{proposal.sourceClauseKey}</bdi></strong>
                      <p>{proposal.sourceSummaryHe}</p>
                    </span>
                    <b className="contractsRelationshipArrow" aria-label="קשור אל">←</b>
                    <span>
                      <small>סעיף יעד · עמודים {proposal.targetPageStart === proposal.targetPageEnd ? proposal.targetPageStart : `${proposal.targetPageStart}–${proposal.targetPageEnd}`}</small>
                      <strong><bdi dir="ltr">{proposal.targetClauseKey}</bdi></strong>
                      <p>{proposal.targetSummaryHe}</p>
                    </span>
                  </div>
                  <div className="contractsRelationshipMeta">
                    <i>{contractsRelationshipTypeLabelHe(proposal.relationshipType)}</i>
                    <i>{contractsRelationshipOriginLabelHe(proposal.origin)}</i>
                    <i>{contractsRelationshipReviewLabelHe(proposal.reviewStatus)}</i>
                    <i title="ביטחון סיווג של המודל לאחר בדיקה ספקנית; אינו ודאות משפטית">
                      ביטחון סיווג: {contractsModelConfidenceLabelHe(proposal.confidence)}
                    </i>
                  </div>
                  <p className="contractsRelationshipRationale">{proposal.rationaleHe}</p>
                  <details className="contractsRelationshipEvidence">
                    <summary>הצג את שתי הראיות המקוריות</summary>
                    <div>
                      <blockquote>{proposal.sourceExcerpt}</blockquote>
                      <blockquote>{proposal.targetExcerpt}</blockquote>
                    </div>
                  </details>
                </article>
              ))}
            </div>

            {(semanticResult.proposals || []).length === 0 && semanticAnalysisComplete && (
              <div className="contractsMessage" role="status">לא נמצאה הצעת קשר שעברה את סף הביטחון. לא נוצרה תוצאה מלאכותית.</div>
            )}
            {(semanticResult.proposals || []).length === 0 && !semanticAnalysisComplete && (
              <div className="contractsMessage" role="status">לא מוצגות הצעות שלא עברו סיווג ובדיקה ספקנית מלאים. אפשר להריץ שוב כדי להשלים את הניתוח.</div>
            )}
          </>
        )}

        {reviewResult && (
          <section className="contractsRelationshipReviewQueue" aria-labelledby="contracts-relationship-review-title">
            <div className="contractsSectionHeader">
              <div>
                <p className="contractsEyebrow">R4.2A · סקירה אנושית שמורה</p>
                <h4 id="contracts-relationship-review-title">הצעות קשר שנשמרו ב־KAPAIM</h4>
                <p>כל פעולה יוצרת גרסה חדשה ביומן; שום הצעה קיימת אינה נדרסת או נמחקת.</p>
              </div>
              <span className="contractsPlanReady">{pendingSemanticReviewCount} ממתינים להחלטה</span>
            </div>
            <div className="contractsClauseMetrics" aria-label="מדדי סקירת קשרים שמורים">
              <span><small>קשרים נוכחיים</small><strong>{reviewResult.metrics?.currentRelationshipCount || 0}</strong></span>
              <span><small>ממתינים לסקירה</small><strong>{pendingSemanticReviewCount}</strong></span>
              <span><small>אושרו</small><strong>{reviewResult.metrics?.approvedCount || 0}</strong></span>
              <span><small>תוקנו ואושרו</small><strong>{reviewResult.metrics?.correctedCount || 0}</strong></span>
              <span><small>נדחו</small><strong>{reviewResult.metrics?.rejectedCount || 0}</strong></span>
              <span><small>הוחלפו בתיקון</small><strong>{reviewResult.metrics?.supersededCount || 0}</strong></span>
              <span><small>החלטות חוזיות שנוצרו</small><strong>{reviewResult.metrics?.decisionCount || 0}</strong></span>
              <span><small>כתיבות ללוח הזמנים</small><strong>{reviewResult.metrics?.scheduleWriteCount || 0}</strong></span>
            </div>
            <div className="contractsRelationshipList">
              {(reviewResult.items || []).map((item) => (
                <SemanticRelationshipReviewCard
                  key={item.relationshipId}
                  item={item}
                  busy={reviewBusyId === item.relationshipId}
                  onReview={onReview}
                />
              ))}
            </div>
            {(reviewResult.items || []).length === 0 && (
              <div className="contractsMessage" role="status">עדיין לא נשמרו הצעות קשר סמנטיות עבור חילוץ זה.</div>
            )}
          </section>
        )}
      </section>
    </section>
  );
}

function decisionLineageOutput(item, {
  sourceClauseIds = null,
  primaryClauseId = null,
  titleHe = null,
  summaryHe = null,
  decisionTextHe = null,
  decisionCategory = null,
  scheduleImpact = null,
  responsibleParty = undefined,
  beneficiary = undefined
} = {}) {
  const evidenceIds = (sourceClauseIds || item.sourceEvidence?.map((source) => source.clauseId) || []).filter(Boolean);
  const tags = [...new Set((Array.isArray(item.tags) ? item.tags : [])
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .map((tag) => /[\u0590-\u05ff]/u.test(tag) ? tag : contractsTagLabelHe(tag)))].slice(0, 12);
  return {
    primaryClauseId: primaryClauseId || evidenceIds[0],
    sourceClauseIds: evidenceIds,
    titleHe: (titleHe ?? item.titleHe ?? "").trim(),
    summaryHe: (summaryHe ?? item.summaryHe ?? "").trim(),
    decisionTextHe: (decisionTextHe ?? item.decisionTextHe ?? "").trim(),
    tags,
    responsibleParty: responsibleParty === undefined ? item.responsibleParty || null : responsibleParty || null,
    beneficiary: beneficiary === undefined ? item.beneficiary || null : beneficiary || null,
    decisionCategory: decisionCategory || item.decisionCategory || "other",
    conflictStatus: item.conflictStatus || "none",
    scheduleImpact: scheduleImpact || item.scheduleImpact || "unknown",
    temporalKind: item.temporalKind || "none",
    contractDate: item.contractDate || null,
    triggerKind: item.triggerKind || null,
    triggerDescriptionHe: item.triggerDescriptionHe || null,
    offsetValue: item.offsetValue ?? null,
    offsetUnit: item.offsetUnit || null,
    calendarSemantics: item.calendarSemantics || "unknown",
    recurring: Boolean(item.recurring)
  };
}

function splitPartFromItem(item, index) {
  const evidenceIds = (item.sourceEvidence || []).map((source) => source.clauseId).filter(Boolean);
  return {
    id: `${item.decisionId}:split:${index}:${Date.now()}`,
    titleHe: `חלק ${index + 1}: ${item.titleHe || "החלטה חוזית"}`,
    summaryHe: item.summaryHe || "",
    decisionTextHe: item.decisionTextHe || "",
    decisionCategory: item.decisionCategory || "other",
    scheduleImpact: item.scheduleImpact || "unknown",
    sourceClauseIds: evidenceIds,
    primaryClauseId: evidenceIds[0] || ""
  };
}

function ContractsDecisionSplitForm({ item, busy = false, onCancel, onSplit }) {
  const [reasonHe, setReasonHe] = useState("");
  const [parts, setParts] = useState(() => [splitPartFromItem(item, 0), splitPartFromItem(item, 1)]);
  const evidence = Array.isArray(item.sourceEvidence) ? item.sourceEvidence : [];
  const sourceIds = evidence.map((source) => source.clauseId).filter(Boolean);

  function patchPart(index, patch) {
    setParts((current) => current.map((part, partIndex) => partIndex === index ? { ...part, ...patch } : part));
  }

  function toggleEvidence(index, clauseId) {
    const part = parts[index];
    const selected = part.sourceClauseIds.includes(clauseId)
      ? part.sourceClauseIds.filter((value) => value !== clauseId)
      : [...part.sourceClauseIds, clauseId];
    patchPart(index, {
      sourceClauseIds: selected,
      primaryClauseId: selected.includes(part.primaryClauseId) ? part.primaryClauseId : selected[0] || ""
    });
  }

  const reasonReady = reasonHe.trim().length >= 10 && /[א-ת]/u.test(reasonHe);
  const outputsReady = parts.length >= 2
    && parts.every((part) => part.sourceClauseIds.length > 0
      && part.sourceClauseIds.includes(part.primaryClauseId)
      && part.titleHe.trim().length >= 5 && /[א-ת]/u.test(part.titleHe)
      && part.summaryHe.trim().length >= 10 && /[א-ת]/u.test(part.summaryHe)
      && part.decisionTextHe.trim().length >= 10 && /[א-ת]/u.test(part.decisionTextHe))
    && sourceIds.every((clauseId) => parts.some((part) => part.sourceClauseIds.includes(clauseId)));

  function submit() {
    onSplit(item, {
      expectedRevision: item.revision,
      reasonHe: reasonHe.trim(),
      outputs: parts.map((part) => decisionLineageOutput(item, part))
    });
  }

  return (
    <div className="contractsDecisionLineageEditor is-split">
      <div className="contractsSectionHeader">
        <div>
          <strong>פיצול החלטה עם יוחסין מלאים</strong>
          <p>כל חלק נשמר כהחלטה חדשה. אפשר להשתמש באותה ראיית מקור בכמה חלקים, אך יחד הם חייבים לכסות את כל הראיות המקוריות.</p>
        </div>
        <button type="button" onClick={onCancel} disabled={busy}>בטל פיצול</button>
      </div>
      <div className="contractsDecisionSplitParts">
        {parts.map((part, index) => (
          <fieldset key={part.id} className="contractsDecisionSplitPart">
            <legend>החלטה חדשה {index + 1}</legend>
            <label>
              <span>כותרת</span>
              <input value={part.titleHe} onChange={(event) => patchPart(index, { titleHe: event.target.value })} disabled={busy} />
            </label>
            <label>
              <span>תקציר</span>
              <textarea rows="3" value={part.summaryHe} onChange={(event) => patchPart(index, { summaryHe: event.target.value })} disabled={busy} />
            </label>
            <label>
              <span>משמעות חוזית מנורמלת</span>
              <textarea rows="4" value={part.decisionTextHe} onChange={(event) => patchPart(index, { decisionTextHe: event.target.value })} disabled={busy} />
            </label>
            <div className="contractsDecisionLineageFields">
              <label>
                <span>קטגוריה</span>
                <select value={part.decisionCategory} onChange={(event) => patchPart(index, { decisionCategory: event.target.value })} disabled={busy}>
                  {CONTRACTS_DECISION_CATEGORY_OPTIONS.map((value) => <option value={value} key={value}>{contractsDecisionCategoryLabelHe(value)}</option>)}
                </select>
              </label>
              <label>
                <span>השפעה אפשרית על לוח הזמנים</span>
                <select value={part.scheduleImpact} onChange={(event) => patchPart(index, { scheduleImpact: event.target.value })} disabled={busy}>
                  <option value="yes">כן</option>
                  <option value="no">לא</option>
                  <option value="unknown">טרם הוכרע</option>
                </select>
              </label>
            </div>
            <div className="contractsDecisionEvidencePicker">
              <strong>ראיות מקור להחלטה זו</strong>
              {evidence.map((source, evidenceIndex) => (
                <label key={source.clauseId || evidenceIndex}>
                  <input
                    type="checkbox"
                    checked={part.sourceClauseIds.includes(source.clauseId)}
                    onChange={() => toggleEvidence(index, source.clauseId)}
                    disabled={busy}
                  />
                  <span>עמודים {source.pageStart === source.pageEnd ? source.pageStart : `${source.pageStart}–${source.pageEnd}`} · {String(source.excerpt || "").slice(0, 180)}</span>
                </label>
              ))}
            </div>
            {parts.length > 2 && (
              <button type="button" onClick={() => setParts((current) => current.filter((_, partIndex) => partIndex !== index))} disabled={busy}>הסר חלק</button>
            )}
          </fieldset>
        ))}
      </div>
      {parts.length < 10 && (
        <button type="button" onClick={() => setParts((current) => [...current, splitPartFromItem(item, current.length)])} disabled={busy}>הוסף החלטה לפיצול</button>
      )}
      <label>
        <span>נימוק הפיצול בעברית — לפחות 10 תווים</span>
        <textarea rows="3" value={reasonHe} onChange={(event) => setReasonHe(event.target.value)} disabled={busy} />
      </label>
      {!outputsReady && <p className="contractsLineageValidation">יש להשלים לפחות שתי החלטות ולוודא שכל ראיות המקור נכללות לפחות באחת מהן.</p>}
      <button type="button" className="contractsPrimary" disabled={!reasonReady || !outputsReady || busy} onClick={submit}>
        שמור פיצול אטומי
      </button>
    </div>
  );
}

function ContractsDecisionMergeEditor({ items, busy = false, onCancel, onMerge }) {
  const [baseDecisionId, setBaseDecisionId] = useState(items[0]?.decisionId || "");
  const base = items.find((item) => item.decisionId === baseDecisionId) || items[0];
  const [reasonHe, setReasonHe] = useState("");
  const [titleHe, setTitleHe] = useState(base?.titleHe || "");
  const [summaryHe, setSummaryHe] = useState(base?.summaryHe || "");
  const [decisionTextHe, setDecisionTextHe] = useState(base?.decisionTextHe || "");
  const [decisionCategory, setDecisionCategory] = useState(base?.decisionCategory || "other");
  const [scheduleImpact, setScheduleImpact] = useState(base?.scheduleImpact || "unknown");
  const evidenceById = new Map();
  for (const item of items) {
    for (const source of item.sourceEvidence || []) evidenceById.set(source.clauseId, source);
  }
  const evidence = [...evidenceById.values()];
  const combinedTags = [...new Set(items.flatMap((item) => Array.isArray(item.tags) ? item.tags : []))].slice(0, 12);
  const unresolved = items.some((item) => item.conflictStatus === "unresolved");
  const ready = items.length >= 2
    && reasonHe.trim().length >= 10 && /[א-ת]/u.test(reasonHe)
    && titleHe.trim().length >= 5 && /[א-ת]/u.test(titleHe)
    && summaryHe.trim().length >= 10 && /[א-ת]/u.test(summaryHe)
    && decisionTextHe.trim().length >= 10 && /[א-ת]/u.test(decisionTextHe)
    && evidence.length > 0;

  function chooseBase(nextId) {
    const next = items.find((item) => item.decisionId === nextId);
    setBaseDecisionId(nextId);
    setTitleHe(next?.titleHe || "");
    setSummaryHe(next?.summaryHe || "");
    setDecisionTextHe(next?.decisionTextHe || "");
    setDecisionCategory(next?.decisionCategory || "other");
    setScheduleImpact(next?.scheduleImpact || "unknown");
  }

  function submit() {
    const output = decisionLineageOutput({ ...base, tags: combinedTags, conflictStatus: unresolved ? "unresolved" : base.conflictStatus }, {
      sourceClauseIds: evidence.map((source) => source.clauseId),
      primaryClauseId: evidence.some((source) => source.clauseId === base.primaryClauseId) ? base.primaryClauseId : evidence[0]?.clauseId,
      titleHe,
      summaryHe,
      decisionTextHe,
      decisionCategory,
      scheduleImpact
    });
    onMerge({
      sources: items.map((item) => ({ decisionId: item.decisionId, expectedRevision: item.revision })),
      reasonHe: reasonHe.trim(),
      output
    });
  }

  return (
    <div className="contractsDecisionLineageEditor is-merge">
      <div className="contractsSectionHeader">
        <div>
          <strong>מיזוג {items.length} החלטות</strong>
          <p>ההחלטות המקוריות יסומנו כממוזגות, תיווצר החלטה חדשה וכל קישורי היוחסין והראיות יישמרו אטומית.</p>
        </div>
        <button type="button" onClick={onCancel} disabled={busy}>בטל בחירה</button>
      </div>
      <label>
        <span>החלטת בסיס לשדות הזמנים והגורמים</span>
        <select value={baseDecisionId} onChange={(event) => chooseBase(event.target.value)} disabled={busy}>
          {items.map((item) => <option key={item.decisionId} value={item.decisionId}>{item.titleHe}</option>)}
        </select>
      </label>
      <div className="contractsDecisionLineageFields">
        <label><span>כותרת ההחלטה הממוזגת</span><input value={titleHe} onChange={(event) => setTitleHe(event.target.value)} disabled={busy} /></label>
        <label>
          <span>קטגוריה</span>
          <select value={decisionCategory} onChange={(event) => setDecisionCategory(event.target.value)} disabled={busy}>
            {CONTRACTS_DECISION_CATEGORY_OPTIONS.map((value) => <option value={value} key={value}>{contractsDecisionCategoryLabelHe(value)}</option>)}
          </select>
        </label>
        <label>
          <span>השפעה אפשרית על לוח הזמנים</span>
          <select value={scheduleImpact} onChange={(event) => setScheduleImpact(event.target.value)} disabled={busy}>
            <option value="yes">כן</option><option value="no">לא</option><option value="unknown">טרם הוכרע</option>
          </select>
        </label>
      </div>
      <label><span>תקציר מאוחד</span><textarea rows="3" value={summaryHe} onChange={(event) => setSummaryHe(event.target.value)} disabled={busy} /></label>
      <label><span>משמעות חוזית מאוחדת</span><textarea rows="5" value={decisionTextHe} onChange={(event) => setDecisionTextHe(event.target.value)} disabled={busy} /></label>
      <div className="contractsDecisionMergeSources">
        {items.map((item) => <span key={item.decisionId}>{item.titleHe} · גרסה {item.revision}</span>)}
      </div>
      <p>המיזוג ישמור {evidence.length} ראיות מקור מאוחדות. {unresolved ? "הסתירה תישאר לא פתורה; לא תיבחר הוראה גוברת." : "לא מתבצעת הכרעה משפטית אוטומטית."}</p>
      <label><span>נימוק המיזוג בעברית — לפחות 10 תווים</span><textarea rows="3" value={reasonHe} onChange={(event) => setReasonHe(event.target.value)} disabled={busy} /></label>
      <button type="button" className="contractsPrimary" disabled={!ready || busy} onClick={submit}>שמור מיזוג אטומי</button>
    </div>
  );
}

function ContractsDecisionReviewCard({
  item,
  busy = false,
  lineageEnabled = false,
  selectedForMerge = false,
  onToggleMerge,
  onSplit,
  onReview
}) {
  const [reasonHe, setReasonHe] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [fields, setFields] = useState(() => ({
    titleHe: item.titleHe || "",
    summaryHe: item.summaryHe || "",
    decisionTextHe: item.decisionTextHe || "",
    responsibleParty: item.responsibleParty || "",
    beneficiary: item.beneficiary || "",
    decisionCategory: item.decisionCategory || "other",
    scheduleImpact: item.scheduleImpact || "unknown"
  }));
  const reviewable = item.reviewStatus === "proposed";
  const lineageEligible = lineageEnabled
    && ["proposed", "approved", "corrected", "unresolved"].includes(item.reviewStatus)
    && item.projectionStatus !== "projected";
  const reasonReady = reasonHe.trim().length >= 10 && /[א-ת]/u.test(reasonHe);
  const correctedTextReady = /[א-ת]/u.test(fields.titleHe)
    && fields.titleHe.trim().length >= 5
    && /[א-ת]/u.test(fields.summaryHe)
    && fields.summaryHe.trim().length >= 10
    && /[א-ת]/u.test(fields.decisionTextHe)
    && fields.decisionTextHe.trim().length >= 10;
  const evidence = Array.isArray(item.sourceEvidence) ? item.sourceEvidence : [];

  function submit(action) {
    onReview(item, action, {
      reasonHe: reasonHe.trim(),
      ...(action === "correct" ? {
        correction: {
          titleHe: fields.titleHe.trim(),
          summaryHe: fields.summaryHe.trim(),
          decisionTextHe: fields.decisionTextHe.trim(),
          responsibleParty: fields.responsibleParty.trim() || null,
          beneficiary: fields.beneficiary.trim() || null,
          decisionCategory: fields.decisionCategory,
          conflictStatus: item.conflictStatus || "none",
          scheduleImpact: fields.scheduleImpact,
          temporalKind: item.temporalKind || "none",
          contractDate: item.contractDate || null,
          triggerKind: item.triggerKind || null,
          triggerDescriptionHe: item.triggerDescriptionHe || null,
          offsetValue: item.offsetValue ?? null,
          offsetUnit: item.offsetUnit || null,
          calendarSemantics: item.calendarSemantics || "unknown",
          recurring: Boolean(item.recurring)
        }
      } : {})
    });
  }

  return (
    <article className={`contractsDecisionCard is-${item.reviewStatus}`}>
      <div className="contractsDecisionCardHeader">
        <div>
          <small>{contractsDecisionCategoryLabelHe(item.decisionCategory)} · גרסה {item.revision}</small>
          <h4>{item.titleHe}</h4>
        </div>
        <span className="contractsPlanReady">{contractsDecisionReviewLabelHe(item.reviewStatus)}</span>
      </div>
      <p className="contractsDecisionSummary">{item.summaryHe}</p>
      <div className="contractsDecisionMeaning">
        <strong>המשמעות החוזית המנורמלת</strong>
        <p>{item.decisionTextHe}</p>
      </div>
      <div className="contractsRelationshipMeta">
        <i>{contractsScheduleImpactLabelHe(item.scheduleImpact)}</i>
        <i>{contractsTemporalKindLabelHe(item.temporalKind)}</i>
        {item.responsibleParty && <i>אחראי: {item.responsibleParty}</i>}
        {item.beneficiary && <i>זכאי: {item.beneficiary}</i>}
        {item.conflictStatus === "unresolved" && <i>סתירה לא פתורה · לא נבחרה חלופה</i>}
      </div>
      {(item.contractDate || item.triggerDescriptionHe || (item.offsetValue !== null && item.offsetValue !== undefined)) && (
        <div className="contractsDecisionTemporal">
          {item.contractDate && <span>מועד חוזי מפורש: <bdi dir="ltr">{item.contractDate}</bdi></span>}
          {item.triggerDescriptionHe && <span>אירוע מפעיל: {item.triggerDescriptionHe}</span>}
          {item.offsetValue !== null && item.offsetValue !== undefined && (
            <span>מרווח מקור: {item.offsetValue} {contractUnitLabel(item.offsetUnit)}</span>
          )}
        </div>
      )}
      <details className="contractsRelationshipEvidence">
        <summary>הצג {evidence.length} ראיות מקור מדויקות</summary>
        <div>{evidence.map((source, index) => (
          <blockquote key={source.clauseId || index}>
            <small>עמודים {source.pageStart === source.pageEnd ? source.pageStart : `${source.pageStart}–${source.pageEnd}`}</small>
            {source.excerpt}
          </blockquote>
        ))}</div>
      </details>

      {lineageEligible && (
        <div className="contractsDecisionLineageActions" role="group" aria-label="פעולות פיצול ומיזוג">
          <button type="button" disabled={busy} onClick={() => setSplitOpen((current) => !current)}>{splitOpen ? "סגור פיצול" : "פצל החלטה"}</button>
          <label>
            <input type="checkbox" checked={selectedForMerge} onChange={() => onToggleMerge(item)} disabled={busy} />
            בחר למיזוג
          </label>
        </div>
      )}

      {splitOpen && lineageEligible && (
        <ContractsDecisionSplitForm
          item={item}
          busy={busy}
          onCancel={() => setSplitOpen(false)}
          onSplit={onSplit}
        />
      )}

      {reviewable ? (
        <div className="contractsDecisionReviewForm">
          <label>
            <span>נימוק סקירה בעברית — לפחות 10 תווים</span>
            <textarea
              rows="2"
              value={reasonHe}
              onChange={(event) => setReasonHe(event.target.value)}
              placeholder="לדוגמה: ההחלטה משקפת במדויק את הסעיפים המצוטטים ואת הגורם האחראי."
              disabled={busy}
            />
          </label>
          <div className="contractsRelationshipReviewActions">
            <button type="button" className="contractsPrimary" disabled={!reasonReady || busy} onClick={() => submit("approve")}>אשר החלטה</button>
            <button type="button" disabled={!reasonReady || busy} onClick={() => submit("reject")}>דחה החלטה</button>
            <button type="button" disabled={!reasonReady || busy} onClick={() => submit("unresolved")}>סמן כלא פתורה</button>
            <button type="button" disabled={busy} onClick={() => setCorrectionOpen((current) => !current)}>תקן לפני אישור</button>
          </div>
          {correctionOpen && (
            <div className="contractsDecisionCorrection">
              <label>
                <span>כותרת ההחלטה</span>
                <input value={fields.titleHe} onChange={(event) => setFields((current) => ({ ...current, titleHe: event.target.value }))} disabled={busy} />
              </label>
              <label>
                <span>תקציר</span>
                <textarea rows="3" value={fields.summaryHe} onChange={(event) => setFields((current) => ({ ...current, summaryHe: event.target.value }))} disabled={busy} />
              </label>
              <label className="contractsDecisionCorrectionWide">
                <span>משמעות חוזית מנורמלת</span>
                <textarea rows="5" value={fields.decisionTextHe} onChange={(event) => setFields((current) => ({ ...current, decisionTextHe: event.target.value }))} disabled={busy} />
              </label>
              <label>
                <span>קטגוריה</span>
                <select value={fields.decisionCategory} onChange={(event) => setFields((current) => ({ ...current, decisionCategory: event.target.value }))} disabled={busy}>
                  {CONTRACTS_DECISION_CATEGORY_OPTIONS.map((value) => <option value={value} key={value}>{contractsDecisionCategoryLabelHe(value)}</option>)}
                </select>
              </label>
              <label>
                <span>השפעה חוזית אפשרית על לוח הזמנים</span>
                <select value={fields.scheduleImpact} onChange={(event) => setFields((current) => ({ ...current, scheduleImpact: event.target.value }))} disabled={busy}>
                  <option value="yes">כן</option>
                  <option value="no">לא</option>
                  <option value="unknown">טרם הוכרע</option>
                </select>
              </label>
              <label>
                <span>גורם אחראי</span>
                <input value={fields.responsibleParty} onChange={(event) => setFields((current) => ({ ...current, responsibleParty: event.target.value }))} disabled={busy} />
              </label>
              <label>
                <span>גורם זכאי</span>
                <input value={fields.beneficiary} onChange={(event) => setFields((current) => ({ ...current, beneficiary: event.target.value }))} disabled={busy} />
              </label>
              <button type="button" className="contractsPrimary" disabled={!reasonReady || !correctedTextReady || busy} onClick={() => submit("correct")}>
                שמור תיקון ואשר
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="contractsRelationshipReviewedState" role="status">
          <strong>{contractsDecisionReviewLabelHe(item.reviewStatus)}</strong>
          {item.reviewReason && <p>{item.reviewReason}</p>}
          {item.reviewedAt && <time dateTime={item.reviewedAt}>{formatHebrewDateTime(item.reviewedAt)}</time>}
        </div>
      )}
    </article>
  );
}

function ContractsDecisionReviewPanel({
  status,
  lineageStatus,
  result,
  relationshipPendingCount = 0,
  error = "",
  generationBusy = false,
  reviewBusyId = "",
  onGenerate,
  onSplit,
  onMerge,
  onReview
}) {
  const [mergeSelectedIds, setMergeSelectedIds] = useState([]);
  const pendingRelationships = Number(result?.metrics?.pendingRelationshipCount ?? relationshipPendingCount ?? 0);
  const currentDecisionCount = Number(result?.metrics?.currentDecisionCount || 0);
  const activeDecisionCount = Number(result?.lineage?.metrics?.activeDecisionCount ?? currentDecisionCount);
  const pendingDecisionCount = Number(result?.metrics?.proposedCount || 0);
  const lineageReady = Boolean(lineageStatus?.ready && result?.lineage?.gates?.splitEnabled && result?.lineage?.gates?.mergeEnabled);
  const itemById = new Map((result?.items || []).map((item) => [item.decisionId, item]));
  const mergeItems = mergeSelectedIds.map((id) => itemById.get(id)).filter(Boolean);
  const canGenerate = Boolean(
    status?.ready
    && result?.workspace?.workspaceId
    && pendingRelationships === 0
    && currentDecisionCount === 0
    && !generationBusy
  );

  function toggleMerge(item) {
    setMergeSelectedIds((current) => current.includes(item.decisionId)
      ? current.filter((id) => id !== item.decisionId)
      : current.length < 10 ? [...current, item.decisionId] : current);
  }

  function submitMerge(body) {
    onMerge(body);
  }

  return (
    <section className="contractsPanel contractsDecisionsPanel" aria-labelledby="contracts-decisions-title">
      <div className="contractsSectionHeader">
        <div>
          <p className="contractsEyebrow">סוכן ההחלטות בחוזים · R4.2B + R4.2C</p>
          <h2 id="contracts-decisions-title">4. החלטות חוזיות מנורמלות</h2>
          <p>הסוכן מאחד סעיפים קשורים להצעה אחת; הסוקר יכול לאשר, לתקן, לפצל או למזג, וכל פעולה נשמרת עם ראיות ויוחסין בלתי־ניתנים לדריסה.</p>
        </div>
        <div className="contractsWorkspaceSaveState" role="status">
          <span className={currentDecisionCount > 0 ? "contractsPlanReady" : "contractsDryBadge"}>
            {currentDecisionCount > 0 ? `${currentDecisionCount} החלטות שמורות ב־KAPAIM` : "טרם נוצרו הצעות החלטה"}
          </span>
          <span className="contractsDryBadge">ללא הכרעת סתירות · ללא כתיבה ללוח הזמנים</span>
        </div>
      </div>

      <div className="contractsRelationshipBoundary is-semantic" role="note">
        R4.2B משתמש רק בסעיפים ובקשרים השמורים. R4.2C אינו קורא שוב למודל: פיצול ומיזוג הם פעולות סוקר אטומיות בלבד. אף אחד מהשלבים אינו בוחר הוראה גוברת, מחשב מועד ביצוע או כותב ללוח הזמנים.
      </div>

      <div className={lineageReady ? "contractsMessage is-success" : "contractsMessage is-warning"} role="status">
        {lineageReady
          ? "R4.2C פעיל: אפשר לפצל החלטה או לבחור 2–10 החלטות למיזוג. כל קישור יוחסין נשמר ב־KAPAIM."
          : "פעולות הפיצול והמיזוג יופיעו לאחר הפעלת מיגרציית R4.2C בצד השרת."}
      </div>

      {pendingRelationships > 0 ? (
        <div className="contractsMessage is-warning" role="status">
          לפני יצירת החלטות יש לעבור על {pendingRelationships} הצעות הקשר שנותרו למעלה. לאחר ההחלטה האחרונה הכפתור ייפתח אוטומטית.
        </div>
      ) : (
        <div className="contractsMessage is-success" role="status">
          סקירת הקשרים הושלמה. אפשר ליצור ולשמור את הצעות ההחלטה המנורמלות.
        </div>
      )}

      <div className="contractsRelationshipActions">
        <button type="button" className="contractsPrimary" disabled={!canGenerate} onClick={onGenerate}>
          {generationBusy ? "מנרמל ושומר את כל הצעות ההחלטה…" : currentDecisionCount > 0 ? "הצעות ההחלטה כבר שמורות" : "צור ושמור הצעות החלטה"}
        </button>
        <p>
          {!status?.applyApproved
            ? "הפעלת R4.2B המקומית או המיגרציה עדיין אינן זמינות."
            : !status?.modelConfigured
              ? "מפתח המודל אינו מוגדר בצד השרת."
              : pendingRelationships > 0
                ? "היצירה נעולה עד שכל קשר נשמר כאישור, תיקון או דחייה."
                : currentDecisionCount > 0
                  ? "הרצה חוזרת אינה קוראת שוב למודל ואינה מחליפה החלטות שכבר נשמרו."
                  : "היצירה אטומית: אם הצעה אחת אינה תקינה, לא תישמר תוצאה חלקית."}
        </p>
      </div>
      {error && <div className="contractsMessage is-error" role="alert">{error}</div>}

      {result && currentDecisionCount > 0 && (
        <>
          <div className="contractsClauseMetrics" aria-label="מדדי החלטות חוזיות שמורות">
            <span><small>החלטות פעילות</small><strong>{activeDecisionCount}</strong></span>
            <span><small>ממתינות לסקירה</small><strong>{pendingDecisionCount}</strong></span>
            <span><small>אושרו</small><strong>{result.metrics?.approvedCount || 0}</strong></span>
            <span><small>תוקנו ואושרו</small><strong>{result.metrics?.correctedCount || 0}</strong></span>
            <span><small>נדחו</small><strong>{result.metrics?.rejectedCount || 0}</strong></span>
            <span><small>סומנו כלא פתורות</small><strong>{result.metrics?.unresolvedCount || 0}</strong></span>
            <span><small>מקורות שפוצלו</small><strong>{result.lineage?.metrics?.splitParentCount || 0}</strong></span>
            <span><small>מקורות שמוזגו</small><strong>{result.lineage?.metrics?.mergedSourceCount || 0}</strong></span>
            <span><small>קישורי יוחסין שמורים</small><strong>{result.lineage?.metrics?.lineageLinkCount || 0}</strong></span>
            <span><small>כתיבות ללוח הזמנים</small><strong>{result.metrics?.scheduleWriteCount || 0}</strong></span>
          </div>
          {lineageReady && mergeItems.length > 0 && mergeItems.length < 2 && (
            <div className="contractsMessage is-warning" role="status">נבחרה החלטה אחת למיזוג. יש לבחור לפחות החלטה נוספת.</div>
          )}
          {lineageReady && mergeItems.length >= 2 && (
            <ContractsDecisionMergeEditor
              key={mergeItems.map((item) => item.decisionId).join(":")}
              items={mergeItems}
              busy={reviewBusyId === "lineage:merge"}
              onCancel={() => setMergeSelectedIds([])}
              onMerge={submitMerge}
            />
          )}
          <div className="contractsDecisionList">
            {(result.items || []).map((item) => (
              <ContractsDecisionReviewCard
                key={item.decisionId}
                item={item}
                busy={reviewBusyId === item.decisionId || reviewBusyId === `lineage:${item.decisionId}` || reviewBusyId === "lineage:merge"}
                lineageEnabled={lineageReady}
                selectedForMerge={mergeSelectedIds.includes(item.decisionId)}
                onToggleMerge={toggleMerge}
                onSplit={onSplit}
                onReview={onReview}
              />
            ))}
          </div>
          {(result.lineage?.links || []).length > 0 && (
            <section className="contractsDecisionLineageHistory" aria-labelledby="contracts-lineage-history-title">
              <div className="contractsSectionHeader">
                <div>
                  <p className="contractsEyebrow">R4.2C · יומן יוחסין שמור</p>
                  <h3 id="contracts-lineage-history-title">פיצולים ומיזוגים</h3>
                  <p>כל חץ הוא רשומת קשר עצמאית בגרף החוזי, עם סוקר, זמן ונימוק.</p>
                </div>
              </div>
              <div className="contractsDecisionLineageLinks">
                {(result.lineage.links || []).map((link) => {
                  const source = itemById.get(link.sourceDecisionId);
                  const target = itemById.get(link.targetDecisionId);
                  return (
                    <article key={link.relationshipId}>
                      <strong>{contractsRelationshipTypeLabelHe(link.relationshipType)}</strong>
                      <p>{source?.titleHe || link.sourceDecisionId} ← {target?.titleHe || link.targetDecisionId}</p>
                      <small>{link.reviewReason} · {formatHebrewDateTime(link.reviewedAt)}</small>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function ContractsIndicatorHandoffCard({ item }) {
  return (
    <article className={`contractsScheduleProjectionCard is-${item.handoffStatus}`}>
      <header>
        <div>
          <small>{contractsIndicatorHandoffStatusLabelHe(item.handoffStatus)}</small>
          <h3>{item.titleHe}</h3>
        </div>
        <span>{contractsDecisionReviewLabelHe(item.reviewStatus)}</span>
      </header>
      <p>{item.summaryHe}</p>
      <div className="contractsRelationshipMeta">
        <i>{contractsDecisionCategoryLabelHe(item.decisionCategory)}</i>
        <i>{contractsScheduleImpactLabelHe(item.scheduleImpact)}</i>
        <i>{contractsTemporalKindLabelHe(item.temporalKind)}</i>
      </div>
      <ul className="contractsScheduleProjectionBlockers">
        {(item.reasonCodes || []).map((code) => <li key={code}>{contractsIndicatorHandoffReasonLabelHe(code)}</li>)}
      </ul>
      {item.sourceEvidence?.length > 0 && (
        <details className="contractsRelationshipEvidence">
          <summary>הצג ראיות מקור מדויקות</summary>
          <div className="contractsScheduleAuditEvidence">
            {item.sourceEvidence.map((evidence, index) => (
              <blockquote key={`${evidence.clauseId || item.decisionId}:${index}`}>
                <small>סעיף {evidence.clauseKey || "ללא מספר"} · עמודים {evidence.pageStart || "?"}{evidence.pageEnd && evidence.pageEnd !== evidence.pageStart ? `–${evidence.pageEnd}` : ""}</small>
                <p>{evidence.excerpt}</p>
              </blockquote>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function ContractsIndicatorHandoffPanel({ status, result, error = "", busy = false, disabled = false, onRun }) {
  const metrics = result?.metrics || {};
  const suitableItems = (result?.items || []).filter((item) => item.handoffStatus === "suitable");
  const reviewItems = (result?.items || []).filter((item) => item.handoffStatus === "requires_review");
  const notSuitableItems = (result?.items || []).filter((item) => item.handoffStatus === "not_suitable");
  const handoffReady = Boolean(status?.ready && status?.mode === "indicator_handoff_read_only");
  return (
    <section className="contractsPanel contractsScheduleProjectionPanel" aria-labelledby="contracts-indicator-handoff-title">
      <div className="contractsSectionHeader">
        <div>
          <p className="contractsEyebrow">מסירת החלטות לסוכן Indicator · R5</p>
          <h2 id="contracts-indicator-handoff-title">5. ערכת החלטות ל־Indicator</h2>
          <p>סוכן החוזים קובע רק אילו החלטות חוזיות מתאימות להמשך טיפול. סוכן Indicator יקבע בהמשך פרויקט, יעד, פעילות, חישובי תאריך וכל כתיבה ללוח הזמנים.</p>
        </div>
        <div className="contractsWorkspaceSaveState" role="status">
          <span className="contractsPlanReady">ערכת מסירה לקריאה בלבד</span>
          <span className="contractsDryBadge">אפס כתיבות · ללא שיבוץ בלוח הזמנים</span>
        </div>
      </div>

      <div className="contractsRelationshipBoundary is-semantic" role="note">
        הסיווג נגזר מן ההחלטה השמורה שכבר עברה סקירה: מתאימה ל־Indicator, אינה מתאימה, או דורשת השלמת סקירה. אין טבלת אמת נוספת ואין שכפול של ההחלטה החוזית.
      </div>

      <div className="contractsRelationshipActions">
        <button type="button" className="contractsPrimary" disabled={!handoffReady || disabled} onClick={onRun}>
          {busy ? "טוען ערכת מסירה…" : "טען את ערכת המסירה ל־Indicator"}
        </button>
        <p>הערכה משתמשת רק באמת החוזית השמורה. היא אינה קוראת פעילויות, אינה דורשת מיפוי פרויקט ואינה מפעילה את מנוע Schedule.</p>
      </div>

      {!handoffReady && (
        <div className="contractsMessage is-warning" role="status">
          ערכת המסירה של R5 טרם הופעלה בתהליך השרת הנוכחי. יש להפעיל מחדש את השרת לאחר עדכון הקוד.
        </div>
      )}
      {error && <div className="contractsMessage is-error" role="alert">{error}</div>}

      {result && (
        <>
          <div className="contractsClauseMetrics contractsScheduleProjectionMetrics">
            <span><small>כל ההחלטות הנוכחיות</small><strong>{metrics.currentDecisionCount || 0}</strong></span>
            <span><small>מתאימות ל־Indicator</small><strong>{metrics.suitableCount || 0}</strong></span>
            <span><small>אינן מתאימות</small><strong>{metrics.notSuitableCount || 0}</strong></span>
            <span><small>דורשות סקירה</small><strong>{metrics.requiresReviewCount || 0}</strong></span>
            <span><small>קריאות למודל</small><strong>{metrics.modelCallCount || 0}</strong></span>
            <span><small>כתיבות אמת חוזית</small><strong>{metrics.contractTruthWriteCount || 0}</strong></span>
            <span><small>כתיבות ללוח הזמנים</small><strong>{metrics.scheduleWriteCount || 0}</strong></span>
          </div>

          <div className="contractsMessage is-success" role="status">
            ערכת המסירה הושלמה מתוך ההחלטות השמורות. סוכן החוזים לא בחר פרויקט, יעד או פעילות ולא כתב שורת Schedule.
          </div>

          <section className="contractsScheduleAuditSection" aria-labelledby="contracts-indicator-suitable-title">
            <div className="contractsSectionHeader">
              <div>
                <h3 id="contracts-indicator-suitable-title">החלטות מתאימות למסירה ל־Indicator</h3>
                <p>אלו החלטות שנבדקו, סומנו כבעלות השפעה רלוונטית ואין בהן סתירה פתוחה. ה־Indicator יחליט לבדו אם וכיצד לשבץ אותן.</p>
              </div>
              <span className="contractsPlanReady">{suitableItems.length} החלטות</span>
            </div>
            <div className="contractsScheduleProjectionList">
              {suitableItems.map((item) => <ContractsIndicatorHandoffCard key={item.decisionId} item={item} />)}
            </div>
          </section>

          <section className="contractsScheduleAuditSection" aria-labelledby="contracts-indicator-review-title">
            <div className="contractsSectionHeader">
              <div>
                <h3 id="contracts-indicator-review-title">החלטות הדורשות השלמת סקירה חוזית</h3>
                <p>רק כאן נדרשת פעולה נוספת בסוכן החוזים. אין צורך במיפוי או בשיבוץ ללוח הזמנים.</p>
              </div>
              <span className="contractsDryBadge">{reviewItems.length} החלטות</span>
            </div>
            {reviewItems.length ? (
              <div className="contractsScheduleProjectionList">
                {reviewItems.map((item) => <ContractsIndicatorHandoffCard key={item.decisionId} item={item} />)}
              </div>
            ) : (
              <div className="contractsMessage is-success" role="status">אין החלטות שממתינות להכרעת התאמה ל־Indicator.</div>
            )}
          </section>

          <details className="contractsRelationshipEvidence">
            <summary>הצג {notSuitableItems.length} החלטות שאינן מתאימות למסירה</summary>
            <div className="contractsScheduleProjectionList">
              {notSuitableItems.map((item) => <ContractsIndicatorHandoffCard key={item.decisionId} item={item} />)}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

export function ContractsPage() {
  const [status, setStatus] = useState(null);
  const [mappingStatus, setMappingStatus] = useState(null);
  const [mappingStatusError, setMappingStatusError] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [savedContracts, setSavedContracts] = useState([]);
  const [clausePersistenceStatus, setClausePersistenceStatus] = useState(null);
  const [clausePersistenceError, setClausePersistenceError] = useState("");
  const [savedClauseContracts, setSavedClauseContracts] = useState([]);
  const [relationshipsStatus, setRelationshipsStatus] = useState(null);
  const [relationshipsError, setRelationshipsError] = useState("");
  const [relationshipsResult, setRelationshipsResult] = useState(null);
  const [semanticRelationshipsStatus, setSemanticRelationshipsStatus] = useState(null);
  const [semanticRelationshipsError, setSemanticRelationshipsError] = useState("");
  const [semanticRelationshipsResult, setSemanticRelationshipsResult] = useState(null);
  const [relationshipReviewStatus, setRelationshipReviewStatus] = useState(null);
  const [relationshipReviewResult, setRelationshipReviewResult] = useState(null);
  const [relationshipReviewError, setRelationshipReviewError] = useState("");
  const [decisionReviewStatus, setDecisionReviewStatus] = useState(null);
  const [decisionLineageStatus, setDecisionLineageStatus] = useState(null);
  const [decisionReviewResult, setDecisionReviewResult] = useState(null);
  const [decisionReviewError, setDecisionReviewError] = useState("");
  const [indicatorHandoffStatus, setIndicatorHandoffStatus] = useState(null);
  const [indicatorHandoffResult, setIndicatorHandoffResult] = useState(null);
  const [indicatorHandoffError, setIndicatorHandoffError] = useState("");
  const [currentClauseWorkspaceId, setCurrentClauseWorkspaceId] = useState("");
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
  const [clausePreview, setClausePreview] = useState(null);
  const [activeClauseWorkspaceTab, setActiveClauseWorkspaceTab] = useState("clauses");
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
    api("/api/contracts/clauses/status")
      .then((nextStatus) => {
        setClausePersistenceStatus(nextStatus);
        if (nextStatus.ready) loadSavedClauseContracts(nextStatus);
      })
      .catch((nextError) => setClausePersistenceError(contractsUiError(nextError)));
    api("/api/contracts/relationships/status")
      .then(setRelationshipsStatus)
      .catch((nextError) => setRelationshipsError(contractsUiError(nextError)));
    api("/api/contracts/relationships/semantic/status")
      .then(setSemanticRelationshipsStatus)
      .catch((nextError) => setSemanticRelationshipsError(contractsUiError(nextError)));
    api("/api/contracts/relationships/review/status")
      .then(setRelationshipReviewStatus)
      .catch((nextError) => setRelationshipReviewError(contractsUiError(nextError)));
    api("/api/contracts/decisions/status")
      .then(setDecisionReviewStatus)
      .catch((nextError) => setDecisionReviewError(contractsUiError(nextError)));
    api("/api/contracts/decisions/lineage/status")
      .then(setDecisionLineageStatus)
      .catch((nextError) => setDecisionReviewError(contractsUiError(nextError)));
    api("/api/contracts/decisions/indicator-handoff/status")
      .then(setIndicatorHandoffStatus)
      .catch((nextError) => setIndicatorHandoffError(contractsUiError(nextError)));
  }, []);

  useEffect(() => {
    if (!workspaceStatus?.ready || !/^[0-9a-f-]{36}$/iu.test(sourceProjectId.trim())) return;
    const timer = setTimeout(() => loadSavedContracts(), 350);
    return () => clearTimeout(timer);
  }, [sourceProjectId, workspaceStatus?.ready]);

  useEffect(() => {
    if (!clausePersistenceStatus?.ready || !/^[0-9a-f-]{36}$/iu.test(sourceProjectId.trim())) return;
    const timer = setTimeout(() => loadSavedClauseContracts(), 350);
    return () => clearTimeout(timer);
  }, [sourceProjectId, clausePersistenceStatus?.ready]);

  useEffect(() => {
    if (!relationshipReviewStatus?.ready || !currentClauseWorkspaceId) return;
    loadRelationshipReview(currentClauseWorkspaceId);
  }, [currentClauseWorkspaceId, relationshipReviewStatus?.ready]);

  useEffect(() => {
    if (!decisionReviewStatus?.applyApproved || !currentClauseWorkspaceId) return;
    loadDecisionReview(currentClauseWorkspaceId);
  }, [currentClauseWorkspaceId, decisionReviewStatus?.applyApproved, decisionLineageStatus?.ready]);

  useEffect(() => {
    setIndicatorHandoffResult(null);
    setIndicatorHandoffError("");
  }, [currentClauseWorkspaceId]);

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
  const classicDocumentVersionId = extraction?.document?.documentVersionId || "";
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

  async function loadSavedClauseContracts(statusOverride = clausePersistenceStatus) {
    if (!statusOverride?.ready || !/^[0-9a-f-]{36}$/iu.test(sourceProjectId.trim())) return;
    try {
      const query = new URLSearchParams({ sourceProjectId: sourceProjectId.trim(), limit: "50" });
      const response = await api(`/api/contracts/clauses/workspaces?${query}`);
      setSavedClauseContracts(response.items || []);
      setClausePersistenceError("");
    } catch (nextError) {
      setSavedClauseContracts([]);
      setClausePersistenceError(contractsUiError(nextError));
    }
  }

  async function openSavedClauseContract(workspaceId) {
    setBusy("open-clause-workspace");
    setClausePersistenceError("");
    try {
      const response = await api(`/api/contracts/clauses/workspaces/${workspaceId}`, { timeoutMs: 60_000 });
      setClausePreview(response.preview);
      setActiveClauseWorkspaceTab("clauses");
      setCurrentClauseWorkspaceId(response.workspace?.workspaceId || workspaceId);
      setRelationshipsResult(null);
      setSemanticRelationshipsResult(null);
      setSemanticRelationshipsError("");
      setRelationshipReviewResult(null);
      setRelationshipReviewError("");
      setDecisionReviewResult(null);
      setDecisionReviewError("");
      setIndicatorHandoffResult(null);
      setIndicatorHandoffError("");
      setFile(null);
      setProjectSite(response.workspace?.projectSite || "");
      setWorkspaceMessage("תוצאת סוכן החוזים נטענה מהשמירה ללא קריאה חוזרת למודל וללא המתנה לחילוץ.");
      setError("");
      if (relationshipsStatus?.ready) await loadRelationships(response.workspace?.workspaceId || workspaceId);
    } catch (nextError) {
      setClausePersistenceError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  async function loadRelationships(workspaceId) {
    if (!relationshipsStatus?.ready || !workspaceId) return;
    try {
      const response = await api(`/api/contracts/relationships/workspaces/${workspaceId}`, { timeoutMs: 60_000 });
      setRelationshipsResult(response);
      setRelationshipsError("");
    } catch (nextError) {
      setRelationshipsResult(null);
      setRelationshipsError(contractsUiError(nextError));
    }
  }

  async function persistExplicitRelationships() {
    if (!currentClauseWorkspaceId) return setRelationshipsError("יש לפתוח תחילה חילוץ סעיפים שמור.");
    if (!relationshipsStatus?.ready) return setRelationshipsError("שמירת קשרי R4.0 עדיין אינה מופעלת בשרת.");
    setBusy("relationships-persist");
    setRelationshipsError("");
    try {
      const response = await api(`/api/contracts/relationships/workspaces/${currentClauseWorkspaceId}/explicit`, {
        method: "POST",
        timeoutMs: 60_000
      });
      setRelationshipsResult(response);
    } catch (nextError) {
      setRelationshipsError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  async function loadRelationshipReview(workspaceId) {
    if (!relationshipReviewStatus?.ready || !workspaceId) return;
    try {
      const response = await api(
        `/api/contracts/relationships/workspaces/${workspaceId}/semantic-review`,
        { timeoutMs: 60_000 }
      );
      setRelationshipReviewResult(response);
      setRelationshipReviewError("");
    } catch (nextError) {
      setRelationshipReviewResult(null);
      setRelationshipReviewError(contractsUiError(nextError));
    }
  }

  async function loadDecisionReview(workspaceId) {
    if (!decisionReviewStatus?.applyApproved || !workspaceId) return;
    try {
      const response = await api(
        decisionLineageStatus?.ready
          ? `/api/contracts/decisions/workspaces/${workspaceId}/lineage`
          : `/api/contracts/decisions/workspaces/${workspaceId}`,
        { timeoutMs: 60_000 }
      );
      setDecisionReviewResult(response);
      setDecisionReviewError("");
      setIndicatorHandoffResult(null);
    } catch (nextError) {
      setDecisionReviewResult(null);
      setDecisionReviewError(contractsUiError(nextError));
    }
  }

  async function loadIndicatorHandoff() {
    if (!currentClauseWorkspaceId) {
      return setIndicatorHandoffError("יש לפתוח תחילה חילוץ סעיפים שמור.");
    }
    if (!indicatorHandoffStatus?.ready) {
      return setIndicatorHandoffError("ערכת המסירה ל־Indicator עדיין אינה מופעלת בתהליך השרת הנוכחי.");
    }
    setBusy("indicator-handoff");
    setIndicatorHandoffError("");
    setIndicatorHandoffResult(null);
    try {
      const response = await api(
        `/api/contracts/decisions/workspaces/${currentClauseWorkspaceId}/indicator-handoff`,
        { timeoutMs: 90_000 }
      );
      setIndicatorHandoffResult(response);
    } catch (nextError) {
      setIndicatorHandoffError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  async function runSemanticRelationships() {
    if (!currentClauseWorkspaceId) {
      return setSemanticRelationshipsError("יש לפתוח תחילה חילוץ סעיפים שמור.");
    }
    if (!semanticRelationshipsStatus?.ready) {
      return setSemanticRelationshipsError("תצוגת קשרי R4.1 עדיין אינה מופעלת או שמפתח המודל אינו מוגדר בשרת.");
    }
    setBusy("semantic-relationships");
    setSemanticRelationshipsError("");
    setSemanticRelationshipsResult(null);
    try {
      const endpoint = relationshipReviewStatus?.ready
        ? `/api/contracts/relationships/workspaces/${currentClauseWorkspaceId}/semantic-proposals`
        : `/api/contracts/relationships/workspaces/${currentClauseWorkspaceId}/semantic-preview`;
      const response = await api(
        endpoint,
        {
          method: "POST",
          body: {},
          timeoutMs: 210_000
        }
      );
      if (response.analysis && response.review) {
        setSemanticRelationshipsResult(response.analysis);
        setRelationshipReviewResult(response.review);
        setRelationshipReviewError("");
        if (decisionReviewStatus?.applyApproved) await loadDecisionReview(currentClauseWorkspaceId);
      } else {
        setSemanticRelationshipsResult(response);
      }
    } catch (nextError) {
      setSemanticRelationshipsError(contractsUiError(nextError));
    } finally {
      setBusy("");
    }
  }

  async function reviewSemanticRelationship(item, action, decision) {
    if (!currentClauseWorkspaceId || !item?.relationshipId) {
      return setRelationshipReviewError("הצעת הקשר השמורה אינה זמינה לסקירה.");
    }
    setBusy(`relationship-review:${item.relationshipId}`);
    setRelationshipReviewError("");
    try {
      const response = await api(
        `/api/contracts/relationships/workspaces/${currentClauseWorkspaceId}/semantic-review/${item.relationshipId}`,
        {
          method: "POST",
          body: {
            expectedRevision: item.revision,
            action,
            reasonHe: decision.reasonHe,
            ...(decision.correction ? { correction: decision.correction } : {})
          },
          timeoutMs: 60_000
        }
      );
      setRelationshipReviewResult(response);
      if (decisionReviewStatus?.applyApproved) await loadDecisionReview(currentClauseWorkspaceId);
    } catch (nextError) {
      setRelationshipReviewError(contractsUiError(nextError));
      if (nextError?.status === 409) await loadRelationshipReview(currentClauseWorkspaceId);
    } finally {
      setBusy("");
    }
  }

  async function runDecisionProposals() {
    if (!currentClauseWorkspaceId) {
      return setDecisionReviewError("יש לפתוח תחילה חילוץ סעיפים שמור.");
    }
    if (!decisionReviewStatus?.ready) {
      return setDecisionReviewError("R4.2B עדיין אינו מופעל או שמפתח המודל אינו מוגדר בשרת.");
    }
    if (Number(decisionReviewResult?.metrics?.pendingRelationshipCount || 0) > 0) {
      return setDecisionReviewError("יש לסיים תחילה את סקירת כל הקשרים השמורים.");
    }
    setBusy("decision-proposals");
    setDecisionReviewError("");
    try {
      const response = await api(
        `/api/contracts/decisions/workspaces/${currentClauseWorkspaceId}/proposals`,
        { method: "POST", body: {}, timeoutMs: 270_000 }
      );
      setDecisionReviewResult(response.review);
      setIndicatorHandoffResult(null);
    } catch (nextError) {
      setDecisionReviewError(contractsUiError(nextError));
      if (nextError?.status === 409) await loadDecisionReview(currentClauseWorkspaceId);
    } finally {
      setBusy("");
    }
  }

  async function reviewDecision(item, action, decision) {
    if (!currentClauseWorkspaceId || !item?.decisionId) {
      return setDecisionReviewError("הצעת ההחלטה השמורה אינה זמינה לסקירה.");
    }
    setBusy(`decision-review:${item.decisionId}`);
    setDecisionReviewError("");
    try {
      const response = await api(
        `/api/contracts/decisions/workspaces/${currentClauseWorkspaceId}/review/${item.decisionId}`,
        {
          method: "POST",
          body: {
            expectedRevision: item.revision,
            action,
            reasonHe: decision.reasonHe,
            ...(decision.correction ? { correction: decision.correction } : {})
          },
          timeoutMs: 60_000
        }
      );
      setDecisionReviewResult(response);
      setIndicatorHandoffResult(null);
    } catch (nextError) {
      setDecisionReviewError(contractsUiError(nextError));
      if (nextError?.status === 409) await loadDecisionReview(currentClauseWorkspaceId);
    } finally {
      setBusy("");
    }
  }

  async function splitDecision(item, body) {
    if (!currentClauseWorkspaceId || !item?.decisionId || !decisionLineageStatus?.ready) {
      return setDecisionReviewError("פעולת הפיצול של R4.2C אינה זמינה כעת.");
    }
    setBusy(`decision-lineage:${item.decisionId}`);
    setDecisionReviewError("");
    try {
      const response = await api(
        `/api/contracts/decisions/workspaces/${currentClauseWorkspaceId}/lineage/split/${item.decisionId}`,
        { method: "POST", body, timeoutMs: 60_000 }
      );
      setDecisionReviewResult(response);
      setIndicatorHandoffResult(null);
    } catch (nextError) {
      setDecisionReviewError(contractsUiError(nextError));
      if (nextError?.status === 409) await loadDecisionReview(currentClauseWorkspaceId);
    } finally {
      setBusy("");
    }
  }

  async function mergeDecisions(body) {
    if (!currentClauseWorkspaceId || !decisionLineageStatus?.ready) {
      return setDecisionReviewError("פעולת המיזוג של R4.2C אינה זמינה כעת.");
    }
    setBusy("decision-lineage:merge");
    setDecisionReviewError("");
    try {
      const response = await api(
        `/api/contracts/decisions/workspaces/${currentClauseWorkspaceId}/lineage/merge`,
        { method: "POST", body, timeoutMs: 60_000 }
      );
      setDecisionReviewResult(response);
      setIndicatorHandoffResult(null);
    } catch (nextError) {
      setDecisionReviewError(contractsUiError(nextError));
      if (nextError?.status === 409) await loadDecisionReview(currentClauseWorkspaceId);
    } finally {
      setBusy("");
    }
  }

  function applyWorkspace(workspace, message = "", {
    autosaveConflictMessage = "",
    preserveClausePreview = false,
    preserveFile = false
  } = {}) {
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
    if (!preserveClausePreview) setClausePreview(null);
    if (!preserveFile) setFile(null);
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
        }, nextMessage, { preserveClausePreview: true, preserveFile: true });
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

  async function persistContractClauses() {
    if (!file) return setError("יש לבחור קובץ PDF.");
    if (!clausePersistenceStatus?.ready) {
      return setError("שמירת תוצאת סוכן החוזים עדיין אינה מופעלת בשרת.");
    }
    setBusy("clause-persist");
    setError("");
    setWorkspaceMessage("");
    try {
      const pdfBase64 = await fileToBase64(file);
      const response = await api("/api/contracts/clauses/workspaces/extract", {
        method: "POST",
        timeoutMs: 300_000,
        body: {
          filename: file.name,
          mediaType: "application/pdf",
          pdfBase64,
          mode: "persist",
          projectSelection: {
            projectId: sourceProjectId.trim(),
            projectSite: projectSite.trim(),
            selectedByUser: true
          }
        }
      });
      setClausePreview(response);
      setActiveClauseWorkspaceTab("clauses");
      setCurrentClauseWorkspaceId(response.workspace?.workspaceId || "");
      setRelationshipsResult(null);
      setRelationshipsError("");
      setSemanticRelationshipsResult(null);
      setSemanticRelationshipsError("");
      setRelationshipReviewResult(null);
      setRelationshipReviewError("");
      setWorkspaceMessage(response.modelAvoided
        ? "החילוץ הזה כבר היה שמור ונטען מיד, ללא קריאה חוזרת למודל."
        : "ה־PDF וכל תוצאת סוכן החוזים נשמרו. מעכשיו אפשר לפתוח אותם מחדש ללא חילוץ חוזר.");
      loadSavedClauseContracts();
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
          <p className="contractsEyebrow">סוכן חוזים · R3.2 + שלב 2 + שלב 3F + שלב 3F.1</p>
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
          <div className={`contractsMode ${clausePersistenceStatus?.ready ? "is-ready" : "is-paused"}`}>
            <strong>{clausePersistenceStatus?.ready ? "שמירת כל סעיפי החוזה פעילה" : "שמירת כל הסעיפים ממתינה להפעלה"}</strong>
            <span>R3.2 · גרסת תשתית {clausePersistenceStatus?.migrationVersion || "—"}</span>
          </div>
        </div>
      </header>

      <section className="contractsPanel contractsWorkspacePanel contractsClauseWorkspacePanel">
        <div className="contractsSectionHeader">
          <div>
            <h2>חילוצי סוכן החוזים שנשמרו</h2>
            <p>פתיחה מכאן טוענת את כל הסעיפים, התקצירים, התגיות וההפניות ללא העלאת PDF וללא קריאה נוספת למודל.</p>
          </div>
          <span className={clausePersistenceStatus?.ready ? "contractsPlanReady" : "contractsPlanBlocked"}>
            {clausePersistenceStatus?.ready ? "שמירת R3.2 פעילה" : "שמירת R3.2 מושבתת"}
          </span>
        </div>
        {!clausePersistenceStatus?.ready && (
          <p className="contractsActivationNotice">
            {clausePersistenceError || "מיגרציית R3.2 והפעלת השרת עדיין נדרשות לפני שמירת חילוצי הסעיפים."}
          </p>
        )}
        {clausePersistenceStatus?.ready && savedClauseContracts.length === 0 && (
          <p className="contractsMappingEmpty">אין עדיין חילוצי סעיפים שמורים לפרויקט MAIN הנבחר.</p>
        )}
        {clausePersistenceStatus?.ready && savedClauseContracts.length > 0 && (
          <div className="contractsSavedList" aria-label="חילוצי סעיפים שמורים">
            {savedClauseContracts.map((workspace) => (
              <article key={workspace.workspaceId}>
                <div>
                  <strong>{workspace.projectSite || workspace.filename}</strong>
                  <span>{workspace.filename} · {workspace.clauseCount} רשומות · {workspace.pageCount} עמודים</span>
                  <small>נשמר {formatHebrewDateTime(workspace.createdAt)}</small>
                  <small dir="ltr">{workspace.documentVersionId}</small>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => openSavedClauseContract(workspace.workspaceId)}
                >
                  {busy === "open-clause-workspace" ? "פותח…" : "פתח ללא חילוץ חוזר"}
                </button>
              </article>
            ))}
          </div>
        )}
        {clausePersistenceStatus?.ready && clausePersistenceError && (
          <div className="contractsMessage is-error" role="alert">{clausePersistenceError}</div>
        )}
      </section>

      <section className="contractsPanel contractsWorkspacePanel">
        <div className="contractsSectionHeader">
          <div>
            <h2>חוזים שמורים — חילוץ קלאסי והמשך עבודה</h2>
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
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setClausePreview(null);
                setActiveClauseWorkspaceTab("clauses");
                setCurrentClauseWorkspaceId("");
                setRelationshipsResult(null);
                setRelationshipsError("");
                setSemanticRelationshipsResult(null);
                setSemanticRelationshipsError("");
                setRelationshipReviewResult(null);
                setRelationshipReviewError("");
                setDecisionReviewResult(null);
                setDecisionReviewError("");
                setIndicatorHandoffResult(null);
                setIndicatorHandoffError("");
              }}
            />
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
        <div className="contractsUploadActions">
          <button type="button" className="contractsPrimary" disabled={Boolean(busy) || !clausePersistenceStatus?.ready} onClick={persistContractClauses}>
            {busy === "clause-persist" ? "מפרק, מעשיר ושומר את כל סעיפי החוזה…" : "חלץ ושמור את כל תוצאת סוכן החוזים"}
          </button>
          <button type="button" className="contractsSecondary" disabled={Boolean(busy)} onClick={extractContract}>
            {busy === "extract"
              ? "בודק אם החוזה שמור, ומחלץ רק אם נדרש…"
              : workspaceStatus?.ready
                ? "הרץ גם את החילוץ הקלאסי ושמור"
                : "הרץ גם את החילוץ הקלאסי"}
          </button>
        </div>
        <p className="contractsFieldHint">תוצאת הסעיפים נשמרת ב־KAPAIM ובאחסון הפרטי וניתנת לפתיחה מחדש ללא חילוץ חוזר. לאחר הפתיחה סוכן הקשרים מציג את ההפניות המפורשות בנפרד. הכפתור השני משאיר את מסלול החילוץ הקלאסי זמין להשוואה.</p>
        {workspaceMessage && <div className="contractsMessage is-success" role="status">{workspaceMessage}</div>}
      </section>

      {clausePreview && (
        <section className="contractsWorkspaceTabsShell" aria-labelledby="contracts-open-workspace-title">
          <div className="contractsWorkspaceTabsHeader">
            <div>
              <p className="contractsEyebrow">חוזה פתוח · סביבת עבודה שמורה</p>
              <h2 id="contracts-open-workspace-title">{projectSite || clausePreview.document?.filename || "חוזה שמור"}</h2>
              <p>{clausePreview.document?.filename || ""} · בחרו שלב כדי להציג רק את המידע הרלוונטי.</p>
            </div>
            <span className="contractsPlanReady">החילוץ השמור נשאר טעון בעת מעבר בין הכרטיסיות</span>
          </div>

          <ContractsWorkspaceTabs activeTab={activeClauseWorkspaceTab} onChange={setActiveClauseWorkspaceTab} />

          <ContractsWorkspaceTabPanel id="clauses" activeTab={activeClauseWorkspaceTab}>
            <ContractsClausePreviewPanel
              preview={clausePreview}
              classicDocumentVersionId={classicDocumentVersionId}
            />
          </ContractsWorkspaceTabPanel>

          <ContractsWorkspaceTabPanel id="relationships" activeTab={activeClauseWorkspaceTab}>
            <ContractsRelationshipsPreviewPanel
              preview={clausePreview}
              workspaceId={currentClauseWorkspaceId}
              persistenceStatus={relationshipsStatus}
              persistenceResult={relationshipsResult}
              persistenceError={relationshipsError}
              persistenceBusy={busy === "relationships-persist"}
              onPersist={persistExplicitRelationships}
              semanticStatus={semanticRelationshipsStatus}
              semanticResult={semanticRelationshipsResult}
              semanticError={semanticRelationshipsError}
              semanticBusy={busy === "semantic-relationships"}
              onRunSemantic={runSemanticRelationships}
              reviewStatus={relationshipReviewStatus}
              reviewResult={relationshipReviewResult}
              reviewError={relationshipReviewError}
              reviewBusyId={busy.startsWith("relationship-review:") ? busy.slice("relationship-review:".length) : ""}
              onReview={reviewSemanticRelationship}
            />
          </ContractsWorkspaceTabPanel>

          <ContractsWorkspaceTabPanel id="decisions" activeTab={activeClauseWorkspaceTab}>
            <ContractsDecisionReviewPanel
              status={decisionReviewStatus}
              lineageStatus={decisionLineageStatus}
              result={decisionReviewResult}
              relationshipPendingCount={relationshipReviewResult?.metrics?.proposedCount || 0}
              error={decisionReviewError}
              generationBusy={busy === "decision-proposals"}
              reviewBusyId={busy.startsWith("decision-review:")
                ? busy.slice("decision-review:".length)
                : busy === "decision-lineage:merge"
                  ? "lineage:merge"
                  : busy.startsWith("decision-lineage:")
                    ? `lineage:${busy.slice("decision-lineage:".length)}`
                    : ""}
              onGenerate={runDecisionProposals}
              onSplit={splitDecision}
              onMerge={mergeDecisions}
              onReview={reviewDecision}
            />
          </ContractsWorkspaceTabPanel>

          <ContractsWorkspaceTabPanel id="indicator" activeTab={activeClauseWorkspaceTab}>
            <ContractsIndicatorHandoffPanel
              status={indicatorHandoffStatus}
              result={indicatorHandoffResult}
              error={indicatorHandoffError}
              busy={busy === "indicator-handoff"}
              disabled={Boolean(busy)}
              onRun={loadIndicatorHandoff}
            />
          </ContractsWorkspaceTabPanel>
        </section>
      )}

      {extraction && (
        <section className="contractsPanel">
          <div className="contractsSectionHeader">
            <div>
              <p className="contractsEyebrow">חילוץ קלאסי · תצוגת השוואה</p>
              <h2>תוצאת הסוכן הקלאסי: סקירת מועמדים</h2>
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
