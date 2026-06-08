#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { nativeTabCompleteness } = require("./normalize_douyin_tabs.cjs");

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
  if (!file || !fs.existsSync(file)) return null;
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
  if (Array.isArray(value)) return value.length > 0;
  if (value === 0 || value === false) return true;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasNativeTabEvidence(value) {
  if (Array.isArray(value)) return value.some((item) => hasNativeTabEvidence(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasNativeTabEvidence(item));
  if (value === 0 || value === false) return true;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function asNumber(value) {
  if (!present(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function firstPresentValue(obj, names) {
  for (const name of names) {
    if (present(obj[name])) return obj[name];
  }
  return null;
}

function firstDeepNumber(deep, names) {
  if (!deep) return null;
  const roots = [deep, deep.metrics || {}, deep.deepMetrics || {}];
  for (const root of roots) {
    const value = firstPresentValue(root, names);
    const number = asNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function hasPositiveDeepActivity(deep) {
  if (!deep) return false;
  return [
    ["likes", "likeCount", "like_count"],
    ["comments", "commentCount", "comment_count"],
    ["shares", "shareCount", "share_count"],
    ["favorites", "favoriteCount", "favorite_count"],
    ["newFollowers", "newFollowerCount"],
    ["profileVisits"],
    ["avgWatchTimeSeconds"],
    ["completionRate", "finishRate"],
    ["fiveSecondRetention", "threeSecondRetention", "threeSecRetention"],
  ].some((names) => (firstDeepNumber(deep, names) || 0) > 0);
}

function visibleStatusText(work) {
  return [
    work.status,
    work.visibility,
    work.statusText,
    work.visibilityText,
    work.publishStatus,
    work.reviewStatus,
    ...(Array.isArray(work.dataCaveats) ? work.dataCaveats : []),
  ].filter(present).join(" ");
}

function isPrivateOrHiddenFromVisibleStatus(work) {
  return /私密|仅自己可见|隐藏|hidden|private|非公开|已删除|deleted|下架|不可见|limited/i.test(visibleStatusText(work));
}

function needsVerbatimTranscript(work) {
  const text = `${work.finalTranscriptSource || ""} ${work.finalTranscriptStatus || ""} ${work.finalTranscriptNote || ""}`;
  // Existing local ASR provenance is tolerated only for already-supplied artifacts.
  // Current collection must not fetch media or initiate ASR; keep that as a future improvement.
  if (/^local_asr\s+ok\b/i.test(text)) return false;
  if (/\bok\b/i.test(text) && !/fallback|missing|failed|page_text|chapter_summary|no_asr/i.test(text)) return false;
  return /fallback|missing|failed|page_text|chapter_summary|no_asr|private|inaccessible|非公开|已删除/i.test(text);
}

function isBeforeDate(value, dateText) {
  if (!value || !dateText) return false;
  const left = new Date(value).getTime();
  const right = new Date(dateText).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && left < right;
}

function deepById(deepRows) {
  const map = new Map();
  for (const row of deepRows) {
    if (row.index != null) map.set(`index:${row.index}`, row);
    if (row.mid) map.set(`mid:${row.mid}`, row);
    if (row.publicUrl) map.set(`url:${row.publicUrl}`, row);
  }
  return map;
}

function getDeep(work, map) {
  return map.get(`index:${work.index}`) || map.get(`mid:${work.mid}`) || map.get(`url:${work.publicUrl}`) || null;
}

function hasDeepMetric(deep, names) {
  if (!deep) return false;
  const roots = [deep, deep.metrics || {}, deep.deepMetrics || {}];
  return roots.some((root) => names.some((name) => present(root[name])));
}

function parseRate(value) {
  if (!present(value)) return null;
  if (typeof value === "number") {
    const ratio = value > 1 ? value / 100 : value;
    return ratio >= 0 && ratio <= 1 ? ratio : null;
  }
  const text = String(value);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  const ratio = text.includes("%") || num > 1 ? num / 100 : num;
  return ratio >= 0 && ratio <= 1 ? ratio : null;
}

function hasRateMetric(deep, textNames, numericNames) {
  if (!deep) return false;
  const roots = [deep, deep.metrics || {}, deep.deepMetrics || {}];
  return roots.some((root) => (
    numericNames.some((name) => parseRate(root[name]) !== null)
    || textNames.some((name) => parseRate(root[name]) !== null)
  ));
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.works) {
    console.error("Usage: audit_content_gaps.cjs --works works.json [--deep deep_metrics.json] [--out gaps.json]");
    process.exit(2);
  }
  const worksData = readJson(args.works);
  const deepData = readJson(args.deep);
  const works = asArray(worksData, ["publishedWorks", "works", "items"]);
  const deepRows = asArray(deepData, ["items", "deepMetrics", "results", "publishedWorks"]);
  const deepMap = deepById(deepRows);
  const freshAfter = args["fresh-after"] || "";

  const rows = [];
  for (const work of works) {
    const missing = [];
    const conflicts = [];
    const warnings = [];
    const deep = getDeep(work, deepMap);
    const visiblePrivateOrHidden = isPrivateOrHiddenFromVisibleStatus(work);
    for (const field of ["mid", "publicUrl", "publishedAt", "caption", "itemType", "plays", "likes", "comments", "shares", "favorites", "finalTranscript"]) {
      const deepFallback = {
        plays: ["plays", "playCount", "viewCount", "view_count"],
        likes: ["likes", "likeCount", "like_count"],
        comments: ["comments", "commentCount", "comment_count"],
        shares: ["shares", "shareCount", "share_count"],
        favorites: ["favorites", "favoriteCount", "favorite_count"],
      }[field];
      if (!present(work[field]) && !(deepFallback && hasDeepMetric(deep, deepFallback))) missing.push(field);
    }
    const metricFields = {
      plays: ["plays", "playCount", "viewCount", "view_count"],
      likes: ["likes", "likeCount", "like_count"],
      comments: ["comments", "commentCount", "comment_count"],
      shares: ["shares", "shareCount", "share_count"],
      favorites: ["favorites", "favoriteCount", "favorite_count"],
    };
    for (const [field, names] of Object.entries(metricFields)) {
      const workValue = asNumber(work[field]);
      const deepValue = firstDeepNumber(deep, names);
      if (workValue !== null && deepValue !== null && workValue !== deepValue) {
        conflicts.push({ field, workValue, deepValue, delta: deepValue - workValue, deepFetchedAt: deep && deep.fetchedAt || "" });
      }
    }
    if (needsVerbatimTranscript(work)) missing.push("verbatimTranscript");
    if (freshAfter && deep && isBeforeDate(deep.fetchedAt, freshAfter)) missing.push("staleDeepMetrics");
    if (visiblePrivateOrHidden) warnings.push("private_or_hidden_work");
    if (asNumber(work.plays) === 0 && hasPositiveDeepActivity(deep)) warnings.push("zero_plays_with_positive_deep_activity");
    if (work.itemType === "video") {
      if (!present(work.durationSeconds) && !present(work.durationOrType)) missing.push("duration");
      if (!present(work.avgPlayTimeText) && !hasDeepMetric(deep, ["avgWatchTimeText", "avgWatchTimeSeconds", "avgPlayTimeText"])) missing.push("avgWatchTime");
      if (!hasRateMetric(deep, ["completionRateText", "finishRateText"], ["completionRate", "finishRate"])) missing.push("completionRate");
      if (!hasRateMetric(deep, ["threeSecondRetentionText", "threeSecRetentionText", "fiveSecondRetentionText"], ["threeSecondRetention", "threeSecRetention", "fiveSecondRetention"])) missing.push("shortRetentionMetric");
      if (!hasRateMetric(deep, ["followRateText"], ["followRate"]) && !hasDeepMetric(deep, ["newFollowers", "newFollowerCount", "lostFollowers", "unsubscribeCount", "unsubscribe_count"])) missing.push("followMetric");
      const rawDouyinTabs = hasNativeTabEvidence(deep && deep.rawDouyinTabs) ? deep.rawDouyinTabs : work.rawDouyinTabs || {};
      const nativeTabs = nativeTabCompleteness(rawDouyinTabs);
      for (const field of nativeTabs.missingFields) missing.push(field);
    } else {
      if (!present(work.avgImageViews) && !hasDeepMetric(deep, ["avgImageViews", "avgImageViewsText"])) missing.push("avgImageViews");
      if (!present(work.copyExpandRate) && !hasDeepMetric(deep, ["copyExpandRate", "copyExpandRateText"])) missing.push("copyExpandRate");
    }
    const comments = (deep && (deep.topComments || deep.comments)) || work.topComments || [];
    if (!Array.isArray(comments) || comments.length === 0) missing.push("topComments");
    if (missing.length || conflicts.length || warnings.length) {
      rows.push({
        index: work.index,
        mid: work.mid || "",
        publicUrl: work.publicUrl || "",
        itemType: work.itemType || "",
        missing: Array.from(new Set(missing)),
        conflicts,
        warnings,
        action: visiblePrivateOrHidden ? "use_creator_visible_text_or_local_script" : "backfill",
      });
    }
  }

  const summary = {
    total: works.length,
    withGaps: rows.length,
    missingCounts: rows.reduce((acc, row) => {
      for (const field of row.missing) acc[field] = (acc[field] || 0) + 1;
      return acc;
    }, {}),
    withConflicts: rows.filter((row) => row.conflicts.length).length,
    conflictCounts: rows.reduce((acc, row) => {
      for (const conflict of row.conflicts) acc[conflict.field] = (acc[conflict.field] || 0) + 1;
      return acc;
    }, {}),
    warningCounts: rows.reduce((acc, row) => {
      for (const warning of row.warnings) acc[warning] = (acc[warning] || 0) + 1;
      return acc;
    }, {}),
  };
  const result = { generatedAt: new Date().toISOString(), summary, items: rows };
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(result, null, 2), "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
