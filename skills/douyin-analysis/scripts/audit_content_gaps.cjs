#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

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

  const rows = [];
  for (const work of works) {
    const missing = [];
    const deep = getDeep(work, deepMap);
    for (const field of ["mid", "publicUrl", "publishedAt", "caption", "itemType", "plays", "likes", "comments", "shares", "favorites", "finalTranscript"]) {
      const deepFallback = {
        shares: ["shares", "shareCount", "share_count"],
        favorites: ["favorites", "favoriteCount", "favorite_count"],
      }[field];
      if (!present(work[field]) && !(deepFallback && hasDeepMetric(deep, deepFallback))) missing.push(field);
    }
    if (work.itemType === "video") {
      if (!present(work.durationSeconds) && !present(work.durationOrType)) missing.push("duration");
      if (!present(work.avgPlayTimeText) && !hasDeepMetric(deep, ["avgWatchTimeText", "avgWatchTimeSeconds", "avgPlayTimeText"])) missing.push("avgWatchTime");
      if (!hasRateMetric(deep, ["completionRateText", "finishRateText"], ["completionRate", "finishRate"])) missing.push("completionRate");
      if (!hasRateMetric(deep, ["threeSecondRetentionText", "threeSecRetentionText", "fiveSecondRetentionText"], ["threeSecondRetention", "threeSecRetention", "fiveSecondRetention"])) missing.push("shortRetentionMetric");
      if (!hasRateMetric(deep, ["followRateText"], ["followRate"]) && !hasDeepMetric(deep, ["newFollowers", "newFollowerCount", "lostFollowers", "unsubscribeCount", "unsubscribe_count"])) missing.push("followMetric");
    } else {
      if (!present(work.avgImageViews) && !hasDeepMetric(deep, ["avgImageViews", "avgImageViewsText"])) missing.push("avgImageViews");
      if (!present(work.copyExpandRate) && !hasDeepMetric(deep, ["copyExpandRate", "copyExpandRateText"])) missing.push("copyExpandRate");
    }
    const comments = (deep && (deep.topComments || deep.comments)) || work.topComments || [];
    if (!Array.isArray(comments) || comments.length === 0) missing.push("topComments");
    if (missing.length) {
      rows.push({
        index: work.index,
        mid: work.mid || "",
        publicUrl: work.publicUrl || "",
        itemType: work.itemType || "",
        missing,
        action: "backfill",
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
  };
  const result = { generatedAt: new Date().toISOString(), summary, items: rows };
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(result, null, 2), "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
