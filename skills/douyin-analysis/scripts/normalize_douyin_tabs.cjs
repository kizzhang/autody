#!/usr/bin/env node

const fs = require("node:fs");

function present(value) {
  if (Array.isArray(value)) return value.some((item) => present(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => present(item));
  if (typeof value === "string") return value.trim() !== "";
  return value !== null && value !== undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => present(item));
  if (value && typeof value === "object" && present(value)) return [value];
  return [];
}

function presentObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && present(value);
}

function presentArrayLike(value) {
  return asArray(value).length > 0;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function parseChineseCount(value) {
  if (typeof value === "number") return finiteOrNull(value);
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(/,/g, "").replace(/\s+/g, "");
  const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)(万|亿|[kK])?$/);
  if (!match) {
    const numeric = Number(normalized);
    return finiteOrNull(numeric);
  }

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = match[2];
  const multiplier = suffix === "万" ? 10000 : suffix === "亿" ? 100000000 : suffix && suffix.toLowerCase() === "k" ? 1000 : 1;
  return Math.round(base * multiplier);
}

function normalizeRate(value) {
  const stableRatio = (number) => Number(number.toFixed(12));

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return stableRatio(value > 1 ? value / 100 : value);
  }

  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasPercent = raw.includes("%");
  const numeric = Number(raw.replace("%", "").replace(/,/g, "").trim());
  if (!Number.isFinite(numeric)) return null;
  return stableRatio(hasPercent || numeric > 1 ? numeric / 100 : numeric);
}

function normalizeRateField(item, key) {
  return {
    ...item,
    [key]: normalizeRate(item[key]),
  };
}

function normalizeCountField(item, key) {
  return {
    ...item,
    [key]: parseChineseCount(item[key]),
  };
}

function nativeTabCompleteness(rawTabs) {
  const tabs = rawTabs || {};
  const overview = tabs.overview || {};
  const traffic = tabs.trafficAnalysis || {};
  const audience = tabs.audienceAnalysis || {};
  const commentHotWords = tabs.commentHotWords || {};
  const missingFields = [];
  const requiredFields = [
    ["rawDouyinTabs.overview.coreMetrics", overview.coreMetrics, presentObject],
    ["rawDouyinTabs.overview.watchTrend", overview.watchTrend, presentArrayLike],
    ["rawDouyinTabs.overview.retentionAnalysis", overview.retentionAnalysis, presentArrayLike],
    ["rawDouyinTabs.overview.bounceAnalysis", overview.bounceAnalysis, presentArrayLike],
    ["rawDouyinTabs.overview.interactionMetrics", overview.interactionMetrics, presentObject],
    ["rawDouyinTabs.overview.danmakuAnalysis", overview.danmakuAnalysis, presentArrayLike],
    ["rawDouyinTabs.trafficAnalysis.douyinAppSourceShare", traffic.douyinAppSourceShare, presentArrayLike],
    ["rawDouyinTabs.trafficAnalysis.otherAppSourceShare", traffic.otherAppSourceShare, presentArrayLike],
    ["rawDouyinTabs.trafficAnalysis.extraTraffic", traffic.extraTraffic, present],
    ["rawDouyinTabs.trafficAnalysis.platformBoostTraffic", traffic.platformBoostTraffic, present],
    ["rawDouyinTabs.trafficAnalysis.searchTermsBefore", traffic.searchTermsBefore, presentArrayLike],
    ["rawDouyinTabs.trafficAnalysis.searchTermsAfter", traffic.searchTermsAfter, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.followMetrics", audience.followMetrics, presentObject],
    ["rawDouyinTabs.audienceAnalysis.followTrend", audience.followTrend, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.genderDistribution", audience.genderDistribution, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.ageDistribution", audience.ageDistribution, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.regionDistribution", audience.regionDistribution, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.interestDistribution", audience.interestDistribution, presentArrayLike],
    ["rawDouyinTabs.audienceAnalysis.followHotWords", audience.followHotWords, presentArrayLike],
    ["rawDouyinTabs.commentHotWords.words", commentHotWords.words, presentArrayLike],
  ];

  for (const [path, value, hasEvidence] of requiredFields) {
    if (!hasEvidence(value)) missingFields.push(path);
  }

  return {
    status: missingFields.length === 0 ? "complete" : "incomplete",
    missingFields,
  };
}

function normalizeTrafficSource(source) {
  return {
    ...source,
    share: normalizeRate(source.share),
    compare7d: normalizeRate(source.compare7d),
  };
}

function normalizeSearchTerm(term) {
  return {
    ...term,
    rank: parseChineseCount(term.rank),
    share: normalizeRate(term.share),
  };
}

function normalizeDistribution(item) {
  return {
    ...item,
    share: normalizeRate(item.share),
  };
}

function normalizeHotWord(word) {
  return {
    ...word,
    rank: parseChineseCount(word.rank),
    hotness: parseChineseCount(word.hotness),
  };
}

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function normalizeDouyinTabs(row) {
  const rawTabs = (row && row.rawDouyinTabs) || row || {};
  const overview = rawTabs.overview || {};
  const coreMetrics = overview.coreMetrics || {};
  const interactionMetrics = overview.interactionMetrics || {};
  const traffic = rawTabs.trafficAnalysis || {};
  const audience = rawTabs.audienceAnalysis || {};
  const followMetrics = audience.followMetrics || {};
  const commentHotWords = rawTabs.commentHotWords || {};

  return {
    nativeTabCompleteness: nativeTabCompleteness(rawTabs),
    retentionSignals: {
      capturedAt: overview.capturedAt || "",
      completionRate: normalizeRate(coreMetrics.completionRate),
      avgWatchTimeText: coreMetrics.avgWatchTimeText || "",
      twoSecondBounceRate: normalizeRate(coreMetrics.twoSecondBounceRate),
      fiveSecondCompletionRate: normalizeRate(coreMetrics.fiveSecondCompletionRate),
      avgPlayRatio: normalizeRate(coreMetrics.avgPlayRatio),
      watchTrend: asArray(overview.watchTrend).map((point) => normalizeCountField(point, "plays")),
      retentionAnalysis: asArray(overview.retentionAnalysis).map((point) => normalizeRateField(point, "retention")),
      bounceAnalysis: asArray(overview.bounceAnalysis).map((point) => normalizeRateField(point, "bounceRate")),
    },
    interactionSignals: {
      capturedAt: overview.capturedAt || "",
      likeRate: normalizeRate(interactionMetrics.likeRate),
      commentRate: normalizeRate(interactionMetrics.commentRate),
      shareRate: normalizeRate(interactionMetrics.shareRate),
      favoriteRate: normalizeRate(interactionMetrics.favoriteRate),
      danmakuCount: parseChineseCount(interactionMetrics.danmakuCount),
      danmakuAnalysis: asArray(overview.danmakuAnalysis).map((item) => normalizeCountField(item, "likes")),
    },
    trafficSources: [
      ...asArray(traffic.douyinAppSourceShare).map(normalizeTrafficSource),
      ...asArray(traffic.otherAppSourceShare).map(normalizeTrafficSource),
    ],
    searchIntent: {
      before: asArray(traffic.searchTermsBefore || traffic.searchTerms).map(normalizeSearchTerm),
      after: asArray(traffic.searchTermsAfter).map(normalizeSearchTerm),
    },
    audienceAsset: {
      capturedAt: audience.capturedAt || "",
      newFollowers: parseChineseCount(followMetrics.newFollowers),
      followRate: normalizeRate(followMetrics.followRate),
      lostFollowers: parseChineseCount(followMetrics.lostFollowers),
      lostFollowerRate: normalizeRate(followMetrics.lostFollowerRate),
      followTrend: asArray(audience.followTrend).map((point) => normalizeCountField(point, "value")),
      genderDistribution: asArray(audience.genderDistribution).map(normalizeDistribution),
      ageDistribution: asArray(audience.ageDistribution).map(normalizeDistribution),
      regionDistribution: asArray(audience.regionDistribution).map(normalizeDistribution),
      interestDistribution: asArray(audience.interestDistribution).map(normalizeDistribution),
      followHotWords: asArray(audience.followHotWords).map(normalizeHotWord),
    },
    commentIntent: {
      capturedAt: commentHotWords.capturedAt || "",
      words: asArray(commentHotWords.words).map(normalizeHotWord),
    },
    negativeSignals: {
      twoSecondBounceRate: normalizeRate(coreMetrics.twoSecondBounceRate),
      notInterestedCount: parseChineseCount(followMetrics.notInterestedCount),
      notInterestedRate: normalizeRate(firstPresent(followMetrics.notInterestedRate, interactionMetrics.notInterestedRate)),
      interactionNotInterestedRate: normalizeRate(interactionMetrics.notInterestedRate),
      lostFollowers: parseChineseCount(followMetrics.lostFollowers),
      lostFollowerRate: normalizeRate(followMetrics.lostFollowerRate),
    },
    trendOrPlatformBoost: {
      capturedAt: traffic.capturedAt || "",
      extraTraffic: parseChineseCount(traffic.extraTraffic),
      platformBoostTraffic: parseChineseCount(traffic.platformBoostTraffic),
      watchTrend: asArray(overview.watchTrend).map((point) => normalizeCountField(point, "plays")),
    },
  };
}

function main(argv) {
  const inputPath = argv[2];
  if (!inputPath) {
    console.error("Usage: node normalize_douyin_tabs.cjs raw-tabs-row.json");
    process.exit(1);
  }

  const row = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  process.stdout.write(`${JSON.stringify(normalizeDouyinTabs(row), null, 2)}\n`);
}

if (require.main === module) main(process.argv);

module.exports = {
  nativeTabCompleteness,
  normalizeDouyinTabs,
  normalizeRate,
  parseChineseCount,
};
