function snapshotText(value) {
  return String(value ?? "").trim();
}

function reviewSnapshotItem(review = {}) {
  const event = review.event && typeof review.event === "object" ? review.event : {};
  const sourceId = snapshotText(review.sourceId || event.id);
  const alertType = snapshotText(event.alertType) || "החלטת צוות";
  return {
    id: sourceId,
    sourceEventId: `alert_${sourceId}`,
    sourceTable: "alerts",
    sourceKind: "timeline_alert_review_snapshot",
    kind: /עדכון|update/iu.test(alertType) ? "update" : "alert",
    alertType,
    title: snapshotText(event.title) || "התראה שנשמרה לבדיקת צוות",
    date: snapshotText(event.date) || null,
    severity: event.severity == null ? null : Number(event.severity),
    status: snapshotText(event.status) || null,
    href: null,
    activityKey: null,
    reviewSnapshot: true
  };
}

export function mergeScheduleActivityUpdatesWithSharedReviews(items = [], reviews = []) {
  const currentItems = Array.isArray(items) ? items : [];
  const currentById = new Map(currentItems.map((item) => [snapshotText(item?.id), item]));
  const activeReviews = new Map();
  const detachedItems = [];

  for (const review of Array.isArray(reviews) ? reviews : []) {
    const sourceId = snapshotText(review?.sourceId);
    if (!sourceId || activeReviews.has(sourceId)) continue;
    const currentItem = currentById.get(sourceId);
    if (currentItem?.activityKey) continue;
    const detachedFromCurrentFeed = !currentItem;
    activeReviews.set(sourceId, detachedFromCurrentFeed
      ? { ...review, detachedFromCurrentFeed: true }
      : review);
    if (detachedFromCurrentFeed) detachedItems.push(reviewSnapshotItem(review));
  }

  const reviewIds = new Set(activeReviews.keys());
  const currentReviewItems = currentItems.filter((item) => reviewIds.has(snapshotText(item?.id)));
  const remainingItems = currentItems.filter((item) => !reviewIds.has(snapshotText(item?.id)));
  return {
    items: [...detachedItems, ...currentReviewItems, ...remainingItems],
    agentResults: Object.fromEntries(activeReviews),
    detachedCount: detachedItems.length
  };
}
