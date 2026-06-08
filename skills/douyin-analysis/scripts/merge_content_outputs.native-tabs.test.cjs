const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const scriptPath = path.join(__dirname, "merge_content_outputs.cjs");

const rawDouyinTabs = {
  overview: {
    coreMetrics: { completionRate: "37.2%", fiveSecondCompletionRate: "64%" },
    watchTrend: [{ label: "第1小时", plays: "1000" }],
    retentionAnalysis: [{ second: 5, retention: "64%" }],
    bounceAnalysis: [{ second: 2, bounceRate: "18.4%" }],
    interactionMetrics: { favoriteRate: "1.5%", shareRate: "0.8%", notInterestedRate: "0.03%" },
    danmakuAnalysis: [{ text: "确实", likes: "8" }],
  },
  trafficAnalysis: {
    douyinAppSourceShare: [{ source: "推荐页", share: "72.5%" }],
    otherAppSourceShare: [{ source: "精选App", share: "2.2%" }],
    extraTraffic: "320",
    platformBoostTraffic: "0",
    searchTermsBefore: [{ rank: 1, term: "自媒体复盘", share: "18.2%" }],
    searchTermsAfter: [{ rank: 1, term: "怎么做内容", share: "11.4%" }],
  },
  audienceAnalysis: {
    followMetrics: { newFollowers: "26", followRate: "0.42%", notInterestedCount: "3", notInterestedRate: "0.05%" },
    followTrend: [{ label: "新增", value: "26" }],
    genderDistribution: [{ label: "女", share: "62%" }],
    ageDistribution: [{ label: "24-30", share: "41%" }],
    regionDistribution: [{ region: "上海", share: "18%" }],
    interestDistribution: [{ interest: "科技", share: "22%" }],
    followHotWords: [{ word: "AI", hotness: "88" }],
  },
  commentHotWords: {
    words: [{ rank: 1, word: "干货", hotness: "99" }],
  },
};

function runMerge({ workOverrides = {}, deepOverrides = {} } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autody-merge-native-tabs-"));
  const worksPath = path.join(tmpDir, "works.json");
  const deepPath = path.join(tmpDir, "deep.json");
  const outDir = path.join(tmpDir, "out");

  fs.writeFileSync(
    worksPath,
    JSON.stringify({
      publishedWorks: [
        {
          index: 1,
          publishedAt: "2026-06-07",
          status: "published",
          itemType: "video",
          caption: "测试 native tabs merge",
          mid: "abc123",
          publicUrl: "https://www.douyin.com/video/abc123",
          plays: 1000,
          likes: 42,
          comments: 7,
          shares: 3,
          favorites: 11,
          ...workOverrides,
        },
      ],
    }),
  );

  fs.writeFileSync(
    deepPath,
    JSON.stringify({
      items: [
        {
          index: 1,
          mid: "abc123",
          fetchedAt: "2026-06-07T09:00:00.000Z",
          metrics: { plays: 1000, likes: 42, comments: 7, shares: 3, favorites: 11 },
          rawDouyinTabs,
          ...deepOverrides,
        },
      ],
    }),
  );

  execFileSync(process.execPath, [
    scriptPath,
    "--works",
    worksPath,
    "--deep",
    deepPath,
    "--out",
    outDir,
    "--stem",
    "douyin_deep",
  ]);

  return {
    csv: fs.readFileSync(path.join(outDir, "douyin_deep_works_final.csv"), "utf8"),
    merged: JSON.parse(fs.readFileSync(path.join(outDir, "douyin_deep_works_final.json"), "utf8")),
  };
}

test("merge preserves raw Douyin tabs and normalized native report signals", () => {
  const { merged } = runMerge();
  const work = merged.publishedWorks[0];

  assert.equal(work.rawDouyinTabs.trafficAnalysis.searchTermsBefore[0].term, "自媒体复盘");
  assert.equal(work.nativeTabCompleteness.status, "complete");
  assert.equal(work.retentionSignals.completionRate, 0.372);
  assert.equal(work.interactionSignals.favoriteRate, 0.015);
  assert.equal(work.trafficSources[0].source, "推荐页");
  assert.equal(work.searchIntent.before[0].term, "自媒体复盘");
  assert.equal(work.audienceAsset.newFollowers, 26);
  assert.equal(work.commentIntent.words[0].word, "干货");
});

test("merge writes structured native signal arrays as JSON in CSV", () => {
  const { csv } = runMerge();

  assert.doesNotMatch(csv, /\[object Object\]/);
  assert.match(csv, /推荐页/);
  assert.match(csv, /\[\{""source"":""推荐页""/);
});

test("merge uses work-level raw tabs when deep raw tabs are placeholder namespaces", () => {
  const { merged } = runMerge({
    workOverrides: { rawDouyinTabs },
    deepOverrides: {
      rawDouyinTabs: {
        overview: {},
        trafficAnalysis: {},
        audienceAnalysis: {},
        commentHotWords: {},
      },
    },
  });
  const work = merged.publishedWorks[0];

  assert.equal(work.rawDouyinTabs.trafficAnalysis.searchTermsBefore[0].term, "自媒体复盘");
  assert.equal(work.nativeTabCompleteness.status, "complete");
  assert.equal(work.trafficSources[0].source, "推荐页");
});

test("merge uses visible creator status as the private distribution source of truth", () => {
  const { merged } = runMerge({
    workOverrides: {
      status: "私密",
      visibility: "私密",
      plays: 0,
      finalTranscriptStatus: "missing",
    },
    deepOverrides: {
      metrics: { plays: 0, likes: 26, comments: 3, shares: 0, favorites: 6 },
    },
  });
  const work = merged.publishedWorks[0];

  assert.equal(work.distributionStatus, "private_or_hidden");
  assert.equal(work.performanceBucket, "分发未知/私密");
  assert.ok(work.dataQualityWarnings.includes("private_or_hidden_work"));
  assert.ok(work.dataQualityWarnings.includes("zero_plays_with_positive_deep_activity"));
});

test("merge treats alias deep metrics as positive activity for zero-play rows", () => {
  const { merged } = runMerge({
    workOverrides: {
      plays: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      favorites: 0,
    },
    deepOverrides: {
      metrics: {
        plays: 0,
        likeCount: 5,
        commentCount: 1,
        shareCount: 0,
        favoriteCount: 2,
      },
    },
  });
  const work = merged.publishedWorks[0];

  assert.equal(work.distributionStatus, "distribution_unknown_needs_review");
  assert.equal(work.likes, 5);
  assert.equal(work.comments, 1);
  assert.equal(work.favorites, 2);
  assert.ok(work.dataQualityWarnings.includes("zero_plays_with_positive_deep_activity"));
});

test("merge treats percent retention strings as positive activity for zero-play rows", () => {
  const { merged } = runMerge({
    workOverrides: {
      plays: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      favorites: 0,
    },
    deepOverrides: {
      metrics: {
        plays: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        favorites: 0,
        completionRate: "2.58%",
        fiveSecondRetention: "37.25%",
      },
    },
  });
  const work = merged.publishedWorks[0];

  assert.equal(work.distributionStatus, "distribution_unknown_needs_review");
  assert.ok(work.dataQualityWarnings.includes("zero_plays_with_positive_deep_activity"));
});
