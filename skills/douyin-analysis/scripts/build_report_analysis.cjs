#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { normalizeDouyinTabs } = require("./normalize_douyin_tabs.cjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function readJson(file) {
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray(data, keys) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function present(value) {
  if (Array.isArray(value)) return value.some((item) => present(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => present(item));
  if (value === 0 || value === false) return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasNativeTabEvidence(value) {
  if (Array.isArray(value)) return value.some((item) => hasNativeTabEvidence(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasNativeTabEvidence(item));
  if (value === 0 || value === false) return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function numeric(value) {
  if (!present(value)) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value).replace(/,/g, "").replace("%", "").trim());
  return Number.isFinite(number) ? number : 0;
}

function rate(part, whole) {
  return whole > 0 ? Number((part / whole).toFixed(6)) : 0;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "";
}

function displayCount(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "";
}

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function workKeyCandidates(work) {
  return [
    work.workKey,
    work.mid && `mid:${work.mid}`,
    work.publicUrl && `url:${work.publicUrl}`,
    work.index !== undefined && `index:${work.index}`,
    work.mid,
    work.publicUrl,
  ].filter(Boolean);
}

function indexByKeys(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const key of workKeyCandidates(row)) map.set(key, row);
    if (row.workKey) map.set(row.workKey, row);
  }
  return map;
}

function findByWork(map, work) {
  for (const key of workKeyCandidates(work)) {
    if (map.has(key)) return map.get(key);
  }
  if (work.mid && map.has(`mid:${work.mid}`)) return map.get(`mid:${work.mid}`);
  if (work.publicUrl && map.has(work.publicUrl)) return map.get(work.publicUrl);
  return null;
}

function titleFor(work) {
  return String(firstPresent(work.title, work.caption, work.desc, work.description, "")).trim();
}

function textFor(work) {
  return [work.title, work.caption, work.finalTranscript, work.transcript, (work.hashtags || []).join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferContentType(work) {
  const text = textFor(work);
  if (/知识|方法|复盘|教程|工具|步骤|拆解|干货|怎么|why|how|ai|coding|科研|学术|prompt|agent/i.test(text)) return "knowledge";
  if (/日常|vlog|生活|随拍|开箱|体验/.test(text)) return "lifestyle";
  if (/观点|吐槽|评论|回应|判断/.test(text)) return "opinion";
  return "unknown";
}

function inferAccountAsset(work, nativeSignals) {
  const assets = [];
  const text = textFor(work);
  if (/专业|博士|科研|作者|工程|方法|复盘|教程|工具|ai|coding|agent/i.test(text)) assets.push("professional_authority");
  if ((nativeSignals.audienceAsset.newFollowers || 0) > 0 || nativeSignals.audienceAsset.followRate) assets.push("follower_conversion");
  if ((work.favorites || 0) > 0 || nativeSignals.interactionSignals.favoriteRate) assets.push("saveable_utility");
  if (assets.length === 0) assets.push("undetermined");
  return Array.from(new Set(assets));
}

function inferUserBait(work, nativeSignals) {
  const bait = [];
  const text = textFor(work);
  if (/收藏|保存|照着做|清单|步骤|模板|方法|干货/.test(text)) bait.push("save_for_later");
  if (/怎么|为什么|如何|复盘|拆解/.test(text)) bait.push("problem_solution");
  if (nativeSignals.searchIntent.before.length || nativeSignals.searchIntent.after.length) bait.push("search_intent");
  if (bait.length === 0) bait.push("general_interest");
  return bait;
}

function inferNanaClass(work) {
  const text = textFor(work);
  if (/复盘|拆解|方法|步骤|教程|清单|模板/.test(text)) return "atomic_knowledge_method";
  if (/观点|判断|反思|为什么/.test(text)) return "opinion_with_reasoning";
  if (/故事|经历|毕业|失业|转型/.test(text)) return "personal_story";
  return "unclassified";
}

function expectedMetrics(contentType, accountAsset, userBait) {
  const metrics = ["completion_rate"];
  if (contentType === "knowledge" || accountAsset.includes("saveable_utility") || userBait.includes("save_for_later")) {
    metrics.push("favorite_rate");
  }
  if (userBait.includes("problem_solution")) metrics.push("comment_rate");
  if (accountAsset.includes("follower_conversion")) metrics.push("follow_rate");
  return Array.from(new Set(metrics));
}

function observedSignal(work, nativeSignals) {
  const plays = numeric(work.plays);
  const likes = numeric(work.likes);
  const comments = numeric(work.comments);
  const shares = numeric(work.shares);
  const favorites = numeric(work.favorites);
  const favoriteRate = firstPresent(nativeSignals.interactionSignals.favoriteRate, rate(favorites, plays));
  const shareRate = firstPresent(nativeSignals.interactionSignals.shareRate, rate(shares, plays));
  const commentRate = rate(comments, plays);
  const likeRate = rate(likes, plays);
  return {
    plays,
    likes,
    comments,
    shares,
    favorites,
    likeRate,
    commentRate,
    shareRate,
    favoriteRate,
    likeRateText: pct(likeRate),
    commentRateText: pct(commentRate),
    shareRateText: pct(shareRate),
    favoriteRateText: pct(favoriteRate),
    completionRate: nativeSignals.retentionSignals.completionRate,
    completionRateText: pct(nativeSignals.retentionSignals.completionRate),
    avgWatchTimeText: nativeSignals.retentionSignals.avgWatchTimeText || "",
    avgPlayRatio: nativeSignals.retentionSignals.avgPlayRatio,
    avgPlayRatioText: pct(nativeSignals.retentionSignals.avgPlayRatio),
    twoSecondBounceRate: nativeSignals.retentionSignals.twoSecondBounceRate,
    twoSecondBounceRateText: pct(nativeSignals.retentionSignals.twoSecondBounceRate),
    fiveSecondCompletionRate: nativeSignals.retentionSignals.fiveSecondCompletionRate,
    fiveSecondCompletionRateText: pct(nativeSignals.retentionSignals.fiveSecondCompletionRate),
    newFollowers: nativeSignals.audienceAsset.newFollowers,
    followRate: nativeSignals.audienceAsset.followRate,
    followRateText: pct(nativeSignals.audienceAsset.followRate),
  };
}

function auditIssueLabel(issue) {
  if (!issue) return "";
  if (typeof issue === "string") return issue;
  if (typeof issue !== "object") return String(issue);
  const field = String(issue.field || issue.metric || issue.section || issue.name || "").trim();
  if (issue.workValue !== undefined || issue.deepValue !== undefined || issue.delta !== undefined) {
    return `metric_conflict:${field || "unknown"}`;
  }
  const type = String(issue.type || issue.kind || issue.category || "").trim();
  if (type && field) return `${type}:${field}`;
  if (field) return field;
  if (issue.reason) return String(issue.reason);
  if (issue.message) return String(issue.message);
  return JSON.stringify(issue);
}

function auditGaps(auditRow) {
  if (!auditRow) return [];
  return [
    ...asArray(auditRow.missing, ["items"]),
    ...asArray(auditRow.gaps, ["items"]),
    ...asArray(auditRow.dataGaps, ["items"]),
    ...asArray(auditRow.caveats, ["items"]),
    ...asArray(auditRow.warnings, ["items"]),
    ...asArray(auditRow.conflicts, ["items"]),
  ].map(auditIssueLabel).filter(Boolean);
}

function transcriptCaveats(work) {
  const transcriptStatus = `${work.finalTranscriptStatus || work.transcriptStatus || ""} ${work.finalTranscriptNote || ""}`;
  const transcriptText = firstPresent(work.finalTranscript, work.transcript, "");
  if (/private|inaccessible|missing|failed|非公开|删除/i.test(transcriptStatus) || !present(transcriptText)) {
    return ["transcript_incomplete"];
  }
  return [];
}

function rowCaveats(work, auditRow) {
  return Array.from(new Set([...auditGaps(auditRow), ...transcriptCaveats(work)]));
}

function classifyDataStatus(work, auditRow, nativeCompleteness) {
  const gaps = rowCaveats(work, auditRow);
  const hasAuditGaps = gaps.length > 0;
  if (nativeCompleteness.status === "complete" && !hasAuditGaps) return "observed";
  if (hasAuditGaps || nativeCompleteness.status !== "complete") return "provisional";
  return "observed";
}

function isNewWork(work, newAfter) {
  return Boolean(newAfter && work.publishedAt && String(work.publishedAt).slice(0, 10) >= newAfter);
}

function usefulPrediction(prediction) {
  return Boolean(prediction && typeof prediction === "object" && !Array.isArray(prediction) && present(prediction));
}

const BLIND_RELATIVE_ENUMS = {
  distribution_bucket: ["low", "mid", "high", "breakout"],
  two_second_bounce_shape: ["strong_low_bounce", "mid", "weak_high_bounce"],
  five_second_retention_shape: ["low", "mid", "high", "breakout"],
  completion_shape: ["low", "mid", "high", "breakout"],
  avg_watch_shape: ["low", "mid", "high", "breakout"],
  like_rate_shape: ["low", "mid", "high", "breakout"],
  comment_rate_shape: ["low", "mid", "high", "breakout"],
  share_rate_shape: ["low", "mid", "high", "breakout"],
  favorite_rate_shape: ["low", "mid", "high", "breakout"],
  follow_asset_shape: ["low", "mid", "high", "breakout"],
};

const BLIND_SCORE_FIELDS = [
  "hook_strength",
  "first_5s_clarity",
  "middle_delivery",
  "completion_risk",
  "save_intent",
  "share_intent",
  "comment_intent",
  "follow_reason",
  "account_asset",
];

const FORBIDDEN_BLIND_ACTUAL_KEYS = new Set([
  "plays",
  "views",
  "play_count",
  "like_count",
  "likes",
  "comment_count",
  "comments",
  "share_count",
  "shares",
  "favorite_count",
  "favorites",
  "new_followers",
  "follow_count",
  "completion_rate",
  "avg_watch_time",
  "average_watch_time",
  "like_rate",
  "comment_rate",
  "share_rate",
  "favorite_rate",
  "follow_rate",
  "predicted_plays",
  "estimated_plays",
  "expected_plays",
  "absolute_predictions",
  "numeric_predictions",
  "actual_predictions",
  "actual_values",
  "observed_actual",
  "calibrated_prior",
]);

function findForbiddenBlindActualKeys(value, pathParts = []) {
  const found = [];
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();
    const path = [...pathParts, key];
    if (FORBIDDEN_BLIND_ACTUAL_KEYS.has(normalizedKey)) found.push(path.join("."));
    if (child && typeof child === "object") found.push(...findForbiddenBlindActualKeys(child, path));
  }
  return found;
}

function validateBlindPrediction(blindRow) {
  const prediction = blindRow && blindRow.prediction;
  const errors = [];
  if (!usefulPrediction(prediction)) return { ok: false, errors: ["prediction_missing"] };
  if (!present(prediction.blind_id || blindRow.blind_id)) errors.push("blind_id_missing");
  if (!prediction.relative_predictions || typeof prediction.relative_predictions !== "object" || Array.isArray(prediction.relative_predictions)) {
    errors.push("relative_predictions_missing");
  } else {
    for (const [field, allowed] of Object.entries(BLIND_RELATIVE_ENUMS)) {
      const value = prediction.relative_predictions[field];
      if (!allowed.includes(value)) errors.push(`relative_predictions.${field}_invalid:${value === undefined ? "missing" : value}`);
    }
  }
  if (!prediction.scores_0_5 || typeof prediction.scores_0_5 !== "object" || Array.isArray(prediction.scores_0_5)) {
    errors.push("scores_0_5_missing");
  } else {
    for (const field of BLIND_SCORE_FIELDS) {
      const score = prediction.scores_0_5[field];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 5) {
        errors.push(`scores_0_5.${field}_invalid:${score === undefined ? "missing" : score}`);
      }
    }
  }
  if (!present(prediction.why)) errors.push("why_missing");
  if (!Array.isArray(prediction.risk_flags)) errors.push("risk_flags_missing");
  if (!["low", "medium", "high"].includes(prediction.confidence)) errors.push(`confidence_invalid:${prediction.confidence}`);
  for (const path of findForbiddenBlindActualKeys(prediction)) {
    errors.push(`forbidden_actual_value:${path}`);
  }
  return { ok: errors.length === 0, errors };
}

function blindState(work, blindRow, newAfter) {
  if (isNewWork(work, newAfter) && transcriptCaveats(work).includes("transcript_incomplete")) {
    return {
      blindScoreStatus: "blind_score_transcript_incomplete",
      blindPrediction: null,
      blindSchemaErrors: [],
    };
  }
  if (blindRow && usefulPrediction(blindRow.prediction)) {
    const validation = validateBlindPrediction(blindRow);
    if (!validation.ok) {
      return {
        blindScoreStatus: "blind_score_schema_failed",
        blindPrediction: null,
        blindSchemaErrors: validation.errors,
      };
    }
    return { blindScoreStatus: "blind_scored", blindPrediction: blindRow.prediction };
  }
  if (isNewWork(work, newAfter)) {
    return { blindScoreStatus: "blind_score_blocked", blindPrediction: null };
  }
  return { blindScoreStatus: "not_required", blindPrediction: null };
}

function predictedBucket(prediction) {
  if (!prediction || typeof prediction !== "object") return null;
  return prediction.predicted_bucket || prediction.predictedBucket || prediction.bucket || prediction.performance_bucket || null;
}

const STANDARD_BUCKET_ORDER = ["low", "mid", "high", "breakout"];
const BOUNCE_BUCKET_ORDER = ["strong_low_bounce", "mid", "weak_high_bounce"];
const BOUNCE_QUALITY_ORDER = ["weak_high_bounce", "mid", "strong_low_bounce"];
const STANDARD_BUCKET_RANGES = {
  low: { label: "P0-P25", low: 0, high: 0.25 },
  mid: { label: "P25-P70", low: 0.25, high: 0.7 },
  high: { label: "P70-P90", low: 0.7, high: 0.9 },
  breakout: { label: "P90-P100", low: 0.9, high: 1 },
};
const BOUNCE_BUCKET_RANGES = {
  strong_low_bounce: { label: "P0-P25", low: 0, high: 0.25 },
  mid: { label: "P25-P75", low: 0.25, high: 0.75 },
  weak_high_bounce: { label: "P75-P100", low: 0.75, high: 1 },
};
const CALIBRATION_METRICS = [
  { key: "plays", predictionField: "distribution_bucket", signalField: "plays", kind: "count", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "twoSecondBounceRate", predictionField: "two_second_bounce_shape", signalField: "twoSecondBounceRate", kind: "rate", ranges: BOUNCE_BUCKET_RANGES, order: BOUNCE_QUALITY_ORDER },
  { key: "fiveSecondCompletionRate", predictionField: "five_second_retention_shape", signalField: "fiveSecondCompletionRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "completionRate", predictionField: "completion_shape", signalField: "completionRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "avgPlayRatio", predictionField: "avg_watch_shape", signalField: "avgPlayRatio", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "likeRate", predictionField: "like_rate_shape", signalField: "likeRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "commentRate", predictionField: "comment_rate_shape", signalField: "commentRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "shareRate", predictionField: "share_rate_shape", signalField: "shareRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "favoriteRate", predictionField: "favorite_rate_shape", signalField: "favoriteRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
  { key: "followRate", predictionField: "follow_asset_shape", signalField: "followRate", kind: "rate", ranges: STANDARD_BUCKET_RANGES, order: STANDARD_BUCKET_ORDER },
];

function metricValue(signal, field) {
  const value = signal && signal[field];
  return Number.isFinite(value) ? value : null;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * p;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function roundMetricValue(value, kind) {
  if (!Number.isFinite(value)) return null;
  if (kind === "count") return Math.round(value);
  return Number(value.toFixed(6));
}

function valueRangeText(range, kind) {
  if (!Array.isArray(range) || range.length !== 2) return "";
  if (kind === "rate") return `${pct(range[0])}-${pct(range[1])}`;
  return `${displayCount(range[0])}-${displayCount(range[1])}`;
}

function actualShapeForValue(value, sortedValues, metric) {
  if (!Number.isFinite(value) || sortedValues.length === 0) return null;
  const entries = Object.entries(metric.ranges);
  for (const [shape, range] of entries) {
    const upper = percentile(sortedValues, range.high);
    if (upper === null) continue;
    if (value <= upper || range.high === 1) return shape;
  }
  return entries[entries.length - 1][0];
}

function deltaResult(predictedShape, actualShape, order) {
  if (!predictedShape || !actualShape) return "unknown";
  const predictedIndex = order.indexOf(predictedShape);
  const actualIndex = order.indexOf(actualShape);
  if (predictedIndex < 0 || actualIndex < 0) return "unknown";
  if (predictedIndex === actualIndex) return "hit";
  return predictedIndex > actualIndex ? "over_predicted" : "under_predicted";
}

function observedActual(signal) {
  return {
    plays: signal.plays,
    likes: signal.likes,
    comments: signal.comments,
    shares: signal.shares,
    favorites: signal.favorites,
    likeRate: signal.likeRate,
    likeRateText: signal.likeRateText,
    commentRate: signal.commentRate,
    commentRateText: signal.commentRateText,
    shareRate: signal.shareRate,
    shareRateText: signal.shareRateText,
    favoriteRate: signal.favoriteRate,
    favoriteRateText: signal.favoriteRateText,
    completionRate: signal.completionRate,
    completionRateText: signal.completionRateText,
    twoSecondBounceRate: signal.twoSecondBounceRate,
    twoSecondBounceRateText: signal.twoSecondBounceRateText,
    fiveSecondCompletionRate: signal.fiveSecondCompletionRate,
    fiveSecondCompletionRateText: signal.fiveSecondCompletionRateText,
    avgWatchTimeText: signal.avgWatchTimeText,
    avgPlayRatio: signal.avgPlayRatio,
    avgPlayRatioText: signal.avgPlayRatioText,
    newFollowers: signal.newFollowers,
    followRate: signal.followRate,
    followRateText: signal.followRateText,
  };
}

function buildCalibratedPrior(prediction, accountSignals) {
  if (!prediction || !prediction.relative_predictions) return null;
  const metrics = {};
  let basisItemCount = 0;
  for (const metric of CALIBRATION_METRICS) {
    const shape = prediction.relative_predictions[metric.predictionField];
    const rangeSpec = metric.ranges[shape];
    if (!rangeSpec) continue;
    const values = accountSignals
      .map((signal) => metricValue(signal, metric.signalField))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!values.length) continue;
    if (metric.key === "plays") basisItemCount = values.length;
    const low = roundMetricValue(percentile(values, rangeSpec.low), metric.kind);
    const high = roundMetricValue(percentile(values, rangeSpec.high), metric.kind);
    metrics[metric.key] = {
      predictionField: metric.predictionField,
      shape,
      quantileRange: rangeSpec.label,
      valueRange: [low, high],
      valueRangeText: valueRangeText([low, high], metric.kind),
      basisItemCount: values.length,
    };
  }
  return {
    basisItemCount,
    basis: "current_account_observed_items_excluding_this_work",
    note: "Blind subagents predict shapes only; numeric ranges are account-calibrated by the main report builder.",
    metrics,
  };
}

function buildDeltas(prediction, actual, accountSignals) {
  if (!prediction || !prediction.relative_predictions) return {};
  const deltas = {};
  for (const metric of CALIBRATION_METRICS) {
    const predictedShape = prediction.relative_predictions[metric.predictionField];
    const actualValue = actual[metric.key];
    const values = accountSignals
      .map((signal) => metricValue(signal, metric.signalField))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const actualShape = actualShapeForValue(actualValue, values, metric);
    deltas[metric.key] = {
      predictionField: metric.predictionField,
      predictedShape,
      observedShape: actualShape,
      observedValue: actualValue,
      observedValueText: metric.kind === "rate" ? pct(actualValue) : displayCount(actualValue),
      result: deltaResult(predictedShape, actualShape, metric.order),
      basisItemCount: values.length,
    };
  }
  return deltas;
}

function observedBucket(signal) {
  if (signal.plays >= 1000 && (signal.favoriteRate >= 0.02 || signal.commentRate >= 0.01)) return "strong_observed";
  if (signal.plays >= 300) return "mid_observed";
  return "low_sample";
}

function buildClaims(work, nativeSignals, signal, dataStatus) {
  const claims = [];
  claims.push({
    claim: "Report row is built from local works data.",
    evidence: [`mid:${work.mid || ""}`, `publishedAt:${work.publishedAt || ""}`].filter((item) => !item.endsWith(":")),
  });
  claims.push({
    claim: "Native tab completeness controls observed versus provisional status.",
    evidence: [
      `nativeTabCompleteness:${nativeSignals.nativeTabCompleteness.status}`,
      `dataStatus:${dataStatus}`,
    ],
  });
  if (signal.favoriteRate || signal.favorites) {
    claims.push({
      claim: "The work has measurable save utility.",
      evidence: [`favorites:${signal.favorites}`, `favoriteRate:${signal.favoriteRateText}`],
    });
  }
  if (nativeSignals.commentIntent.words.length) {
    claims.push({
      claim: "Comment hot words provide qualitative audience evidence.",
      evidence: nativeSignals.commentIntent.words.slice(0, 3).map((word) => word.word || JSON.stringify(word)),
    });
  }
  for (const caveat of transcriptCaveats(work)) {
    claims.push({
      claim: "Transcript evidence is incomplete, so the row cannot be treated as fully observed.",
      evidence: [`transcript:${work.finalTranscriptStatus || work.transcriptStatus || "missing"}`, caveat],
    });
  }
  return claims.filter((claim) => claim.evidence.length > 0);
}

function validateReportDate(date) {
  if (!date) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid --date: expected YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid --date: expected a real calendar date in YYYY-MM-DD format.");
  }
  return date;
}

function buildReport(options) {
  const worksData = options.worksData || readJson(options.works);
  const auditData = options.auditData || readJson(options.audit);
  const blindData = options.blindData || readJson(options.blind);
  const reportDate = validateReportDate(options.date);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const works = asArray(worksData, ["publishedWorks", "works", "items"]);
  const auditRows = asArray(auditData, ["items", "publishedWorks", "works"]);
  const blindRows = asArray(blindData, ["items", "predictions", "results"]);
  const auditByKey = indexByKeys(auditRows);
  const blindByKey = indexByKeys(blindRows);

  const preparedRows = works.map((work, idx) => {
    const row = { index: work.index || idx + 1, ...work };
    const rawDouyinTabs = hasNativeTabEvidence(row.rawDouyinTabs) ? row.rawDouyinTabs : {};
    const nativeSignals = normalizeDouyinTabs({ rawDouyinTabs });
    const signal = observedSignal(row, nativeSignals);
    const auditRow = findByWork(auditByKey, row);
    const caveats = rowCaveats(row, auditRow);
    const dataStatus = classifyDataStatus(row, auditRow, nativeSignals.nativeTabCompleteness);
    return { row, nativeSignals, signal, auditRow, caveats, dataStatus };
  });

  const items = preparedRows.map(({ row, nativeSignals, signal, caveats, dataStatus }, idx) => {
    const contentType = inferContentType(row);
    const accountAsset = inferAccountAsset(row, nativeSignals);
    const userBait = inferUserBait(row, nativeSignals);
    const blind = blindState(row, findByWork(blindByKey, row), options.newAfter);
    const bucket = predictedBucket(blind.blindPrediction);
    const accountSignals = preparedRows
      .filter((entry, entryIndex) => entryIndex !== idx && entry.dataStatus === "observed" && entry.signal.plays > 0)
      .map((entry) => entry.signal);
    const actual = observedActual(signal);
    return {
      index: row.index,
      mid: row.mid || "",
      publicUrl: row.publicUrl || "",
      publishedAt: row.publishedAt || "",
      title: titleFor(row),
      dataStatus,
      contentType,
      accountAsset,
      userBait,
      nanaGeneralizedClass: inferNanaClass(row),
      expectedWinningMetrics: expectedMetrics(contentType, accountAsset, userBait),
      actualSignal: signal,
      nativeTabCompleteness: nativeSignals.nativeTabCompleteness,
      blindScoreStatus: blind.blindScoreStatus,
      blindPrediction: blind.blindPrediction,
      blindSchemaErrors: blind.blindSchemaErrors || [],
      observedResult: {
        bucket: observedBucket(signal),
        dataStatus,
        caveats,
      },
      calibration: {
        predictedBucket: bucket,
        observedBucket: observedBucket(signal),
        calibratedPrior: buildCalibratedPrior(blind.blindPrediction, accountSignals),
        observedActual: actual,
        deltas: buildDeltas(blind.blindPrediction, actual, accountSignals),
        status: bucket
          ? "ready_for_retro"
          : blind.blindScoreStatus === "blind_score_blocked"
            ? "blocked_missing_blind_score"
            : blind.blindScoreStatus === "blind_score_schema_failed"
              ? "blocked_blind_schema_failed"
              : "no_blind_prediction",
      },
      claims: buildClaims(row, nativeSignals, signal, dataStatus),
    };
  });

  const summary = {
    total: items.length,
    observed: items.filter((item) => item.dataStatus === "observed").length,
    provisional: items.filter((item) => item.dataStatus === "provisional").length,
    blindScoreBlocked: items.filter((item) => item.blindScoreStatus === "blind_score_blocked").length,
    blindScoreTranscriptIncomplete: items.filter((item) => item.blindScoreStatus === "blind_score_transcript_incomplete").length,
    blindScoreSchemaFailed: items.filter((item) => item.blindScoreStatus === "blind_score_schema_failed").length,
    blindScored: items.filter((item) => item.blindScoreStatus === "blind_scored").length,
    contentTypeCounts: items.reduce((acc, item) => {
      acc[item.contentType] = (acc[item.contentType] || 0) + 1;
      return acc;
    }, {}),
  };

  return {
    generatedAt,
    reportDate,
    sourceFiles: {
      works: options.works || "",
      audit: options.audit || "",
      blind: options.blind || "",
    },
    dataGate: {
      mode: "local_read_only",
      browserCollection: false,
      fakeBlindScoring: false,
      newAfter: options.newAfter || "",
      status: summary.blindScoreSchemaFailed > 0
        ? "blocked_for_blind_schema"
        : summary.blindScoreTranscriptIncomplete > 0
          ? "blocked_for_blind_transcripts"
        : summary.blindScoreBlocked > 0
          ? "blocked_for_new_blind_scores"
          : summary.provisional > 0
            ? "provisional_data"
            : "ready",
    },
    summary,
    items,
    adversarialAudit: {
      checks: [
        "Uses current local works/audit/blind inputs only.",
        "Does not collect browser data.",
        "Does not synthesize missing blind predictions.",
        "Marks incomplete native tabs or audit gaps as provisional.",
      ],
      blockedItems: items.filter((item) => item.blindScoreStatus === "blind_score_blocked").map((item) => item.index),
      transcriptIncompleteItems: items.filter((item) => item.blindScoreStatus === "blind_score_transcript_incomplete").map((item) => item.index),
      schemaFailedItems: items.filter((item) => item.blindScoreStatus === "blind_score_schema_failed").map((item) => item.index),
      provisionalItems: items.filter((item) => item.dataStatus === "provisional").map((item) => item.index),
    },
  };
}

function renderMarkdown(report) {
  const lines = [
    `# Douyin Incremental Analysis ${report.reportDate}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Summary: total ${report.summary.total}, observed ${report.summary.observed}, provisional ${report.summary.provisional}, blind blocked ${report.summary.blindScoreBlocked}, blind transcript incomplete ${report.summary.blindScoreTranscriptIncomplete}, blind schema failed ${report.summary.blindScoreSchemaFailed}.`,
    "",
    "## Data Gate",
    "",
    `- Mode: ${report.dataGate.mode}`,
    `- Status: ${report.dataGate.status}`,
    `- Browser collection: ${report.dataGate.browserCollection}`,
    `- Fake blind scoring: ${report.dataGate.fakeBlindScoring}`,
    "",
    "## Items",
  ];
  for (const item of report.items) {
    const priorMetrics = (item.calibration.calibratedPrior && item.calibration.calibratedPrior.metrics) || {};
    const playsPrior = priorMetrics.plays;
    const favoritePrior = priorMetrics.favoriteRate;
    const deltas = item.calibration.deltas || {};
    lines.push(
      "",
      `### ${item.index}. ${item.title || item.mid}`,
      "",
      `- Status: ${item.dataStatus}; blind: ${item.blindScoreStatus}`,
      `- URL: ${item.publicUrl}`,
      `- Type: ${item.contentType}; class: ${item.nanaGeneralizedClass}`,
      `- Expected metrics: ${item.expectedWinningMetrics.join(", ")}`,
      `- Observed actual: plays ${item.calibration.observedActual.plays}, likes ${item.calibration.observedActual.likes}, comments ${item.calibration.observedActual.comments}, shares ${item.calibration.observedActual.shares}, favorites ${item.calibration.observedActual.favorites}, favorite rate ${item.calibration.observedActual.favoriteRateText}`,
      `- Calibration: predicted ${item.calibration.predictedBucket || "n/a"}, observed ${item.calibration.observedBucket}`,
    );
    if (playsPrior || favoritePrior) {
      lines.push(`- Account-calibrated prior: plays ${playsPrior ? `${playsPrior.shape} ${playsPrior.quantileRange} ${playsPrior.valueRangeText}` : "n/a"}; favorite rate ${favoritePrior ? `${favoritePrior.shape} ${favoritePrior.quantileRange} ${favoritePrior.valueRangeText}` : "n/a"}`);
    }
    if (deltas.plays || deltas.favoriteRate) {
      lines.push(`- Blind delta: plays ${deltas.plays ? deltas.plays.result : "n/a"}; favorite rate ${deltas.favoriteRate ? deltas.favoriteRate.result : "n/a"}`);
    }
    if (item.blindSchemaErrors.length) {
      lines.push(`- Blind schema errors: ${item.blindSchemaErrors.join("; ")}`);
    }
  }
  lines.push("", "## Adversarial Audit", "");
  for (const check of report.adversarialAudit.checks) lines.push(`- ${check}`);
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.works || !args.out) {
    console.error("Usage: build_report_analysis.cjs --works works.json --out output_dir [--audit audit.json] [--blind blind_predictions.json] [--new-after YYYY-MM-DD] [--date YYYY-MM-DD]");
    process.exit(2);
  }
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  try {
    const report = buildReport({
      works: args.works,
      audit: args.audit,
      blind: args.blind,
      newAfter: args["new-after"],
      date: args.date,
    });
    const stem = `douyin_incremental_analysis_${report.reportDate}`;
    fs.writeFileSync(path.join(outDir, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, `${stem}.md`), renderMarkdown(report));
  } catch (error) {
    if (/^Invalid --date:/.test(error.message)) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
}

if (require.main === module) main(process.argv);

module.exports = {
  buildReport,
  renderMarkdown,
};
