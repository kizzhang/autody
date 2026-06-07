const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const scriptPath = path.join(__dirname, "audit_content_gaps.cjs");

const completeRawDouyinTabs = {
  overview: {
    coreMetrics: { completionRate: "31%" },
    watchTrend: [{ label: "第1小时", plays: "100" }],
    retentionAnalysis: [{ second: 5, retention: "66%" }],
    bounceAnalysis: [{ second: 2, bounceRate: "18%" }],
    interactionMetrics: { favoriteRate: "2%" },
    danmakuAnalysis: [{ text: "有用", likes: "2" }],
  },
  trafficAnalysis: {
    douyinAppSourceShare: [{ source: "推荐页", share: "70%" }],
    otherAppSourceShare: [{ source: "精选App", share: "1%" }],
    extraTraffic: "0",
    platformBoostTraffic: "0",
    searchTermsBefore: [{ rank: 1, term: "内容复盘", share: "10%" }],
    searchTermsAfter: [{ rank: 1, term: "怎么复盘", share: "8%" }],
  },
  audienceAnalysis: {
    followMetrics: { newFollowers: "3", followRate: "0.3%" },
    followTrend: [{ label: "新增", value: "3" }],
    genderDistribution: [{ label: "女", share: "60%" }],
    ageDistribution: [{ label: "24-30", share: "40%" }],
    regionDistribution: [{ region: "上海", share: "20%" }],
    interestDistribution: [{ interest: "科技", share: "30%" }],
    followHotWords: [{ word: "AI", hotness: "80" }],
  },
  commentHotWords: {
    words: [{ rank: 1, word: "有用", hotness: "90" }],
  },
};

function baseWork(overrides = {}) {
  return {
    index: 1,
    mid: "abc123",
    publicUrl: "https://www.douyin.com/video/abc123",
    publishedAt: "2026-06-07",
    caption: "测试 native tabs audit",
    itemType: "video",
    plays: 100,
    likes: 10,
    comments: 2,
    shares: 1,
    favorites: 3,
    finalTranscript: "这是一条完整逐字稿。",
    finalTranscriptStatus: "ok",
    durationSeconds: 42,
    avgPlayTimeText: "12秒",
    topComments: [{ text: "有用", likes: 2 }],
    ...overrides,
  };
}

function baseDeep(overrides = {}) {
  return {
    index: 1,
    mid: "abc123",
    publicUrl: "https://www.douyin.com/video/abc123",
    fetchedAt: "2026-06-07T09:00:00.000Z",
    metrics: {
      plays: 100,
      likes: 10,
      comments: 2,
      shares: 1,
      favorites: 3,
      completionRate: "31%",
      threeSecondRetention: "66%",
      followRate: "0.3%",
    },
    topComments: [{ text: "有用", likes: 2 }],
    ...overrides,
  };
}

function runAudit({ workOverrides = {}, deepOverrides = {} } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autody-audit-native-tabs-"));
  const worksPath = path.join(tmpDir, "works.json");
  const deepPath = path.join(tmpDir, "deep.json");
  const outPath = path.join(tmpDir, "audit.json");

  fs.writeFileSync(
    worksPath,
    JSON.stringify({
      publishedWorks: [baseWork(workOverrides)],
    }),
  );
  fs.writeFileSync(
    deepPath,
    JSON.stringify({
      items: [baseDeep(deepOverrides)],
    }),
  );

  execFileSync(process.execPath, [
    scriptPath,
    "--works",
    worksPath,
    "--deep",
    deepPath,
    "--out",
    outPath,
  ]);

  return JSON.parse(fs.readFileSync(outPath, "utf8"));
}

test("audit lists missing raw Douyin native tab sections", () => {
  const result = runAudit({
    deepOverrides: {
      rawDouyinTabs: {
        overview: {
          coreMetrics: { completionRate: "31%" },
        },
      },
    },
  });

  assert.equal(result.summary.withGaps, 1);
  assert.ok(result.items[0].missing.includes("rawDouyinTabs.overview.interactionMetrics"));
  assert.ok(result.items[0].missing.includes("rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"));
  assert.ok(result.items[0].missing.includes("rawDouyinTabs.audienceAnalysis.followMetrics"));
  assert.ok(result.items[0].missing.includes("rawDouyinTabs.commentHotWords.words"));
});

test("audit accepts complete raw Douyin native tab sections", () => {
  const result = runAudit({
    deepOverrides: {
      rawDouyinTabs: completeRawDouyinTabs,
    },
  });

  assert.equal(result.summary.missingCounts["rawDouyinTabs.overview.interactionMetrics"], undefined);
  assert.equal(result.summary.missingCounts["rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"], undefined);
});

test("audit falls back from empty deep native tab placeholders to work-level tabs", () => {
  const result = runAudit({
    workOverrides: {
      rawDouyinTabs: completeRawDouyinTabs,
    },
    deepOverrides: {
      rawDouyinTabs: {
        overview: {},
        trafficAnalysis: {},
        audienceAnalysis: {},
        commentHotWords: {},
      },
    },
  });

  assert.equal(result.summary.missingCounts["rawDouyinTabs.overview.interactionMetrics"], undefined);
  assert.equal(result.summary.missingCounts["rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"], undefined);
});
