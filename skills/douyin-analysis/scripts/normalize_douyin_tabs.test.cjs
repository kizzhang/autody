const test = require("node:test");
const assert = require("node:assert/strict");

const {
  nativeTabCompleteness,
  normalizeDouyinTabs,
  normalizeRate,
  parseChineseCount,
} = require("./normalize_douyin_tabs.cjs");

const sampleRawTabs = {
  overview: {
    capturedAt: "2026-06-07T08:00:00.000Z",
    coreMetrics: {
      completionRate: "37.2%",
      avgWatchTimeText: "1分12秒",
      twoSecondBounceRate: "18.4%",
      fiveSecondCompletionRate: "64%",
      avgPlayRatio: "44.1%",
    },
    watchTrend: [{ label: "第1小时", plays: "1.2万" }],
    retentionAnalysis: [{ second: 5, retention: "64%" }],
    bounceAnalysis: [{ second: 2, bounceRate: "18.4%" }],
    interactionMetrics: {
      likeRate: "4.3%",
      commentRate: "0.6%",
      shareRate: "0.8%",
      favoriteRate: "1.5%",
      danmakuCount: "12",
      notInterestedRate: "0.03%",
    },
    danmakuAnalysis: [{ text: "确实", likes: "8" }],
  },
  trafficAnalysis: {
    capturedAt: "2026-06-07T08:00:00.000Z",
    douyinAppSourceShare: [
      { source: "推荐页", share: "72.5%", compare7d: "+8.1%" },
      { source: "搜索", share: "13.1%", compare7d: "-1.0%" },
    ],
    otherAppSourceShare: [{ source: "精选App", share: "2.2%" }],
    extraTraffic: "320",
    platformBoostTraffic: "0",
    searchTermsBefore: [{ rank: 1, term: "自媒体复盘", share: "18.2%" }],
    searchTermsAfter: [{ rank: 1, term: "怎么做内容", share: "11.4%" }],
  },
  audienceAnalysis: {
    capturedAt: "2026-06-07T08:00:00.000Z",
    followMetrics: {
      newFollowers: "26",
      followRate: "0.42%",
      lostFollowers: "2",
      lostFollowerRate: "0.03%",
      notInterestedCount: "3",
      notInterestedRate: "0.05%",
    },
    followTrend: [{ label: "新增", value: "26" }],
    genderDistribution: [{ label: "女", share: "62%" }],
    ageDistribution: [{ label: "24-30", share: "41%" }],
    regionDistribution: [{ region: "上海", share: "18%" }],
    interestDistribution: [{ interest: "科技", share: "22%" }],
    followHotWords: [{ word: "AI", hotness: "88" }],
  },
  commentHotWords: {
    capturedAt: "2026-06-07T08:00:00.000Z",
    words: [
      { rank: 1, word: "干货", hotness: "99" },
      { rank: 2, word: "关注", hotness: "76" },
    ],
  },
};

test("normalizes Chinese counts and rates", () => {
  assert.equal(parseChineseCount("1.2万"), 12000);
  assert.equal(parseChineseCount("3,204"), 3204);
  assert.equal(parseChineseCount("2.5亿"), 250000000);
  assert.equal(normalizeRate("37.2%"), 0.372);
  assert.equal(normalizeRate("0.42%"), 0.0042);
  assert.equal(normalizeRate(0.8), 0.8);
});

test("reports complete native tab data", () => {
  const completeness = nativeTabCompleteness(sampleRawTabs);
  assert.deepEqual(completeness.missingFields, []);
  assert.equal(completeness.status, "complete");
});

test("flags missing required native tab sections", () => {
  const completeness = nativeTabCompleteness({ overview: { coreMetrics: {} } });
  assert.equal(completeness.status, "incomplete");
  assert.ok(completeness.missingFields.includes("rawDouyinTabs.overview.interactionMetrics"));
  assert.ok(completeness.missingFields.includes("rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"));
  assert.ok(completeness.missingFields.includes("rawDouyinTabs.audienceAnalysis.followMetrics"));
  assert.ok(completeness.missingFields.includes("rawDouyinTabs.commentHotWords.words"));
});

test("normalizes native tab signals for report reuse", () => {
  const normalized = normalizeDouyinTabs({ rawDouyinTabs: sampleRawTabs });
  assert.equal(normalized.nativeTabCompleteness.status, "complete");
  assert.equal(normalized.retentionSignals.completionRate, 0.372);
  assert.equal(normalized.retentionSignals.fiveSecondCompletionRate, 0.64);
  assert.equal(normalized.interactionSignals.favoriteRate, 0.015);
  assert.equal(normalized.interactionSignals.danmakuCount, 12);
  assert.equal(normalized.trafficSources[0].source, "推荐页");
  assert.equal(normalized.trafficSources[0].share, 0.725);
  assert.equal(normalized.searchIntent.before[0].term, "自媒体复盘");
  assert.equal(normalized.audienceAsset.newFollowers, 26);
  assert.equal(normalized.audienceAsset.followRate, 0.0042);
  assert.equal(normalized.commentIntent.words[0].word, "干货");
  assert.equal(normalized.negativeSignals.notInterestedRate, 0.0005);
  assert.equal(normalized.trendOrPlatformBoost.extraTraffic, 320);
});
