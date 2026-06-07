const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const scriptPath = path.join(__dirname, "build_report_analysis.cjs");

const completeRawDouyinTabs = {
  overview: {
    coreMetrics: { completionRate: "38%", fiveSecondCompletionRate: "70%" },
    watchTrend: [{ label: "第1小时", plays: "1000" }],
    retentionAnalysis: [{ second: 5, retention: "70%" }],
    bounceAnalysis: [{ second: 2, bounceRate: "18%" }],
    interactionMetrics: { favoriteRate: "3.5%", shareRate: "0.8%" },
    danmakuAnalysis: [{ text: "干货", likes: "3" }],
  },
  trafficAnalysis: {
    douyinAppSourceShare: [{ source: "推荐页", share: "80%" }],
    otherAppSourceShare: [{ source: "精选App", share: "1%" }],
    extraTraffic: "0",
    platformBoostTraffic: "0",
    searchTermsBefore: [{ rank: 1, term: "内容复盘", share: "18%" }],
    searchTermsAfter: [{ rank: 1, term: "怎么复盘", share: "12%" }],
  },
  audienceAnalysis: {
    followMetrics: { newFollowers: "12", followRate: "1.2%" },
    followTrend: [{ label: "新增", value: "12" }],
    genderDistribution: [{ label: "女", share: "60%" }],
    ageDistribution: [{ label: "24-30", share: "40%" }],
    regionDistribution: [{ region: "上海", share: "20%" }],
    interestDistribution: [{ interest: "科技", share: "30%" }],
    followHotWords: [{ word: "AI", hotness: "80" }],
  },
  commentHotWords: {
    words: [{ rank: 1, word: "干货", hotness: "90" }],
  },
};

function baseWork(overrides = {}) {
  return {
    index: 1,
    mid: "m1",
    publicUrl: "https://www.douyin.com/video/m1",
    publishedAt: "2026-06-01",
    title: "AI 内容复盘方法",
    caption: "用 AI 做内容复盘，三步找到下一条的发力点。",
    itemType: "video",
    plays: 1000,
    likes: 80,
    comments: 22,
    shares: 9,
    favorites: 35,
    finalTranscript: "我是专业作者，今天拆一个内容复盘方法，收藏后照着做。",
    finalTranscriptStatus: "ok",
    rawDouyinTabs: completeRawDouyinTabs,
    topComments: [{ text: "干货，收藏了", likes: 8 }],
    ...overrides,
  };
}

function runReport({ works, audit, blind, args = [] }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autody-report-analysis-"));
  const worksPath = path.join(tmpDir, "works.json");
  const auditPath = path.join(tmpDir, "audit.json");
  const blindPath = path.join(tmpDir, "blind.json");
  const outDir = path.join(tmpDir, "out");

  fs.writeFileSync(worksPath, JSON.stringify(works));
  const cliArgs = [scriptPath, "--works", worksPath, "--out", outDir, "--date", "2026-06-07", ...args];
  if (audit) {
    fs.writeFileSync(auditPath, JSON.stringify(audit));
    cliArgs.push("--audit", auditPath);
  }
  if (blind) {
    fs.writeFileSync(blindPath, JSON.stringify(blind));
    cliArgs.push("--blind", blindPath);
  }

  execFileSync(process.execPath, cliArgs);
  return JSON.parse(fs.readFileSync(path.join(outDir, "douyin_incremental_analysis_2026-06-07.json"), "utf8"));
}

function runReportProcess({ works, args = [] }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autody-report-analysis-"));
  const worksPath = path.join(tmpDir, "works.json");
  const outDir = path.join(tmpDir, "out");
  fs.writeFileSync(worksPath, JSON.stringify(works));
  return {
    result: require("node:child_process").spawnSync(process.execPath, [
      scriptPath,
      "--works",
      worksPath,
      "--out",
      outDir,
      ...args,
    ], { encoding: "utf8" }),
    outDir,
  };
}

test("builds atomic report rows from current works and audit caveats", () => {
  const report = runReport({
    works: { publishedWorks: [baseWork()] },
    audit: { summary: { withGaps: 0 }, items: [{ mid: "m1", missing: [], caveats: [] }] },
  });

  assert.equal(report.summary.total, 1);
  assert.equal(report.items[0].dataStatus, "observed");
  assert.equal(report.items[0].contentType, "knowledge");
  assert.ok(report.items[0].accountAsset.includes("professional_authority"));
  assert.ok(report.items[0].expectedWinningMetrics.includes("favorite_rate"));
  assert.ok(report.items[0].claims.every((claim) => claim.evidence.length > 0));
  assert.ok(report.adversarialAudit);
});

test("uses audit caveats keyed by workKey to mark provisional rows", () => {
  const report = runReport({
    works: { publishedWorks: [baseWork({ mid: "m3" })] },
    audit: { items: [{ workKey: "mid:m3", missing: ["topComments"] }] },
  });

  assert.equal(report.items[0].dataStatus, "provisional");
  assert.deepEqual(report.items[0].observedResult.caveats, ["topComments"]);
});

test("marks complete native tab rows with missing transcript status as provisional", () => {
  const report = runReport({
    works: { items: [baseWork({ finalTranscriptStatus: "missing", finalTranscript: "" })] },
    audit: { items: [] },
  });

  assert.equal(report.items[0].dataStatus, "provisional");
  assert.ok(report.items[0].observedResult.caveats.includes("transcript_incomplete"));
  assert.ok(report.items[0].claims.some((claim) => claim.evidence.includes("transcript:missing")));
});

test("marks new videos blind_score_blocked when no blind prediction exists", () => {
  const report = runReport({
    works: { items: [baseWork({ mid: "m2", publicUrl: "https://www.douyin.com/video/m2", publishedAt: "2026-06-07" })] },
    audit: { items: [] },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_score_blocked");
  assert.equal(report.items[0].blindPrediction, null);
});

test("keeps new videos with null blind prediction blocked", () => {
  const report = runReport({
    works: { items: [baseWork({ mid: "m4", publicUrl: "https://www.douyin.com/video/m4", publishedAt: "2026-06-07" })] },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:m4", prediction: null }] },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_score_blocked");
  assert.equal(report.items[0].blindPrediction, null);
});

test("sets top-level data gate to provisional_data for non-observed rows without blind block", () => {
  const report = runReport({
    works: { items: [baseWork({ rawDouyinTabs: { overview: {} } })] },
    audit: { items: [] },
  });

  assert.equal(report.items[0].dataStatus, "provisional");
  assert.equal(report.dataGate.status, "provisional_data");
});

test("carries blind prediction exactly unchanged when present and produces calibration with predicted bucket", () => {
  const prediction = {
    predicted_bucket: "high_save_low_share",
    dimensions: { utility: { score: 5, confidence: "high", reason: "clear utility" } },
    notes: ["keep this exact object"],
  };
  const report = runReport({
    works: { items: [baseWork({ mid: "m2", publicUrl: "https://www.douyin.com/video/m2", publishedAt: "2026-06-07" })] },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:m2", blind_id: "blind-abc", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_scored");
  assert.deepEqual(report.items[0].blindPrediction, prediction);
  assert.equal(report.items[0].calibration.predictedBucket, "high_save_low_share");
});

test("invalid --date exits nonzero with targeted error", () => {
  const { result } = runReportProcess({
    works: { items: [baseWork()] },
    args: ["--date", "../bad"],
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid --date/);
  assert.match(result.stderr, /YYYY-MM-DD/);
});
