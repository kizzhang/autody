const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const scriptPath = path.join(__dirname, "build_report_analysis.cjs");
const luminaScriptPath = path.join(__dirname, "render_lumina_report.cjs");

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

function rawTabsWithMetrics({ favoriteRate = "3.5%", shareRate = "0.8%", completionRate = "38%", fiveSecondCompletionRate = "70%", twoSecondBounceRate = "18%", followRate = "1.2%" } = {}) {
  const tabs = JSON.parse(JSON.stringify(completeRawDouyinTabs));
  tabs.overview.coreMetrics = {
    ...tabs.overview.coreMetrics,
    completionRate,
    fiveSecondCompletionRate,
    twoSecondBounceRate,
  };
  tabs.overview.interactionMetrics = {
    ...tabs.overview.interactionMetrics,
    favoriteRate,
    shareRate,
  };
  tabs.audienceAnalysis.followMetrics = {
    ...tabs.audienceAnalysis.followMetrics,
    followRate,
  };
  return tabs;
}

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

function validBlindPrediction(overrides = {}) {
  const relativePredictions = {
    distribution_bucket: "mid",
    two_second_bounce_shape: "mid",
    five_second_retention_shape: "mid",
    completion_shape: "low",
    avg_watch_shape: "mid",
    like_rate_shape: "mid",
    comment_rate_shape: "mid",
    share_rate_shape: "low",
    favorite_rate_shape: "high",
    follow_asset_shape: "mid",
    ...(overrides.relative_predictions || {}),
  };
  const scores = {
    hook_strength: 3,
    first_5s_clarity: 3,
    middle_delivery: 3,
    completion_risk: 4,
    save_intent: 4,
    share_intent: 2,
    comment_intent: 2,
    follow_reason: 3,
    account_asset: 3,
    ...(overrides.scores_0_5 || {}),
  };
  return {
    blind_id: "blind-abc",
    relative_predictions: relativePredictions,
    scores_0_5: scores,
    predicted_bucket: "high_save_low_share",
    why: "clear utility",
    risk_flags: ["long口播"],
    confidence: "high",
    ...overrides,
    relative_predictions: relativePredictions,
    scores_0_5: scores,
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

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
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

test("treats metric conflicts from audit as provisional caveats", () => {
  const report = runReport({
    works: { publishedWorks: [baseWork()] },
    audit: { items: [{ mid: "m1", conflicts: [{ field: "plays", workValue: 1000, deepValue: 2000 }] }] },
  });

  assert.equal(report.items[0].dataStatus, "provisional");
  assert.ok(report.items[0].observedResult.caveats.includes("metric_conflict:plays"));
  assert.equal(report.dataGate.status, "provisional_data");
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
  const prediction = validBlindPrediction();
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

test("maps blind buckets to account-calibrated numeric ranges and compares observed actual values", () => {
  const prediction = validBlindPrediction({
    relative_predictions: {
      distribution_bucket: "high",
      favorite_rate_shape: "high",
    },
  });
  const report = runReport({
    works: {
      items: [
        baseWork({ mid: "old-low", publicUrl: "https://www.douyin.com/video/old-low", plays: 100, likes: 5, comments: 1, shares: 0, favorites: 1, rawDouyinTabs: rawTabsWithMetrics({ favoriteRate: "0.5%" }) }),
        baseWork({ mid: "old-mid", publicUrl: "https://www.douyin.com/video/old-mid", plays: 400, likes: 30, comments: 3, shares: 2, favorites: 4, rawDouyinTabs: rawTabsWithMetrics({ favoriteRate: "1.0%" }) }),
        baseWork({ mid: "target", publicUrl: "https://www.douyin.com/video/target", publishedAt: "2026-06-07", plays: 900, likes: 90, comments: 9, shares: 4, favorites: 27, rawDouyinTabs: rawTabsWithMetrics({ favoriteRate: "3.0%" }) }),
        baseWork({ mid: "old-high", publicUrl: "https://www.douyin.com/video/old-high", plays: 1600, likes: 120, comments: 16, shares: 12, favorites: 64, rawDouyinTabs: rawTabsWithMetrics({ favoriteRate: "4.0%" }) }),
      ],
    },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:target", blind_id: "blind-abc", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  const item = report.items.find((row) => row.mid === "target");
  assert.equal(item.blindScoreStatus, "blind_scored");
  assert.equal(item.calibration.calibratedPrior.basisItemCount, 3);
  assert.equal(item.calibration.calibratedPrior.metrics.plays.shape, "high");
  assert.equal(item.calibration.calibratedPrior.metrics.plays.quantileRange, "P70-P90");
  assert.deepEqual(item.calibration.calibratedPrior.metrics.plays.valueRange, [880, 1360]);
  assert.equal(item.calibration.calibratedPrior.metrics.favoriteRate.valueRangeText, "2.20%-3.40%");
  assert.equal(item.calibration.observedActual.plays, 900);
  assert.equal(item.calibration.observedActual.favoriteRateText, "3.00%");
  assert.equal(item.calibration.deltas.plays.result, "hit");
  assert.equal(item.calibration.deltas.favoriteRate.result, "hit");
});

test("excludes provisional rows from account-calibrated numeric ranges", () => {
  const prediction = validBlindPrediction({
    relative_predictions: {
      distribution_bucket: "high",
    },
  });
  const report = runReport({
    works: {
      items: [
        baseWork({ mid: "observed-low", publicUrl: "https://www.douyin.com/video/observed-low", plays: 100 }),
        baseWork({ mid: "provisional-outlier", publicUrl: "https://www.douyin.com/video/provisional-outlier", plays: 100000, rawDouyinTabs: { overview: {} } }),
        baseWork({ mid: "target2", publicUrl: "https://www.douyin.com/video/target2", publishedAt: "2026-06-07", plays: 500 }),
        baseWork({ mid: "observed-high", publicUrl: "https://www.douyin.com/video/observed-high", plays: 1000 }),
      ],
    },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:target2", blind_id: "blind-abc", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  const item = report.items.find((row) => row.mid === "target2");
  assert.equal(item.calibration.calibratedPrior.basisItemCount, 2);
  assert.deepEqual(item.calibration.calibratedPrior.metrics.plays.valueRange, [730, 910]);
});

test("treats low two-second bounce as the better blind prediction direction", () => {
  const prediction = validBlindPrediction({
    relative_predictions: {
      two_second_bounce_shape: "strong_low_bounce",
    },
  });
  const report = runReport({
    works: {
      items: [
        baseWork({ mid: "bounce-low", publicUrl: "https://www.douyin.com/video/bounce-low", rawDouyinTabs: rawTabsWithMetrics({ twoSecondBounceRate: "10%" }) }),
        baseWork({ mid: "bounce-mid", publicUrl: "https://www.douyin.com/video/bounce-mid", rawDouyinTabs: rawTabsWithMetrics({ twoSecondBounceRate: "20%" }) }),
        baseWork({ mid: "target-bounce", publicUrl: "https://www.douyin.com/video/target-bounce", publishedAt: "2026-06-07", rawDouyinTabs: rawTabsWithMetrics({ twoSecondBounceRate: "40%" }) }),
        baseWork({ mid: "bounce-high", publicUrl: "https://www.douyin.com/video/bounce-high", rawDouyinTabs: rawTabsWithMetrics({ twoSecondBounceRate: "30%" }) }),
      ],
    },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:target-bounce", blind_id: "blind-abc", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  const item = report.items.find((row) => row.mid === "target-bounce");
  assert.equal(item.calibration.deltas.twoSecondBounceRate.observedShape, "weak_high_bounce");
  assert.equal(item.calibration.deltas.twoSecondBounceRate.result, "over_predicted");
});

test("rejects blind predictions that fail the metric-shape schema", () => {
  const report = runReport({
    works: { items: [baseWork({ mid: "m5", publicUrl: "https://www.douyin.com/video/m5", publishedAt: "2026-06-07" })] },
    audit: { items: [] },
    blind: {
      items: [{
        workKey: "mid:m5",
        blind_id: "blind-bad",
        prediction: {
          overall_bucket: "medium_high",
          predictions: { play: "medium", save: "high" },
        },
      }],
    },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_score_schema_failed");
  assert.equal(report.items[0].blindPrediction, null);
  assert.ok(report.items[0].blindSchemaErrors.some((error) => error.includes("relative_predictions")));
  assert.equal(report.summary.blindScoreSchemaFailed, 1);
  assert.equal(report.dataGate.status, "blocked_for_blind_schema");
});

test("rejects blind predictions that include fake numeric actual values", () => {
  const prediction = validBlindPrediction({
    predicted_plays: 12000,
    absolute_predictions: {
      favorite_rate: "3%",
    },
  });
  const report = runReport({
    works: { items: [baseWork({ mid: "m7", publicUrl: "https://www.douyin.com/video/m7", publishedAt: "2026-06-07" })] },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:m7", blind_id: "blind-fake-actuals", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_score_schema_failed");
  assert.ok(report.items[0].blindSchemaErrors.some((error) => error.includes("forbidden_actual_value")));
});

test("blocks production blind scoring when the new video transcript is incomplete", () => {
  const prediction = {
    blind_id: "blind-transcript",
    relative_predictions: {
      distribution_bucket: "mid",
      two_second_bounce_shape: "mid",
      five_second_retention_shape: "mid",
      completion_shape: "low",
      avg_watch_shape: "mid",
      like_rate_shape: "mid",
      comment_rate_shape: "mid",
      share_rate_shape: "low",
      favorite_rate_shape: "mid",
      follow_asset_shape: "mid",
    },
    scores_0_5: {
      hook_strength: 3,
      first_5s_clarity: 3,
      middle_delivery: 3,
      completion_risk: 4,
      save_intent: 2,
      share_intent: 2,
      comment_intent: 2,
      follow_reason: 2,
      account_asset: 2,
    },
    why: "valid shape, but transcript is missing",
    risk_flags: [],
    confidence: "medium",
  };
  const report = runReport({
    works: {
      items: [baseWork({
        mid: "m6",
        publicUrl: "https://www.douyin.com/video/m6",
        publishedAt: "2026-06-07",
        finalTranscriptStatus: "missing",
        finalTranscript: "",
      })],
    },
    audit: { items: [] },
    blind: { items: [{ workKey: "mid:m6", blind_id: "blind-transcript", prediction }] },
    args: ["--new-after", "2026-06-01"],
  });

  assert.equal(report.items[0].blindScoreStatus, "blind_score_transcript_incomplete");
  assert.equal(report.items[0].blindPrediction, null);
  assert.equal(report.summary.blindScoreTranscriptIncomplete, 1);
  assert.equal(report.dataGate.status, "blocked_for_blind_transcripts");
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

test("lumina payload can carry report analysis fields by work index", () => {
  const { buildPayload } = require("./render_lumina_report.cjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-lumina-analysis-"));
  const worksFile = path.join(tmp, "works.json");
  const analysisFile = path.join(tmp, "analysis.json");
  writeJson(worksFile, {
    publishedWorks: [
      baseWork({ index: 1, mid: "m1" }),
      baseWork({ index: 2, mid: "m2", publicUrl: "https://www.douyin.com/video/m2" }),
    ],
  });
  writeJson(analysisFile, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    items: [{
      index: 2,
      dataStatus: "observed",
      contentType: "knowledge",
      nanaGeneralizedClass: "follow_asset",
      blindScoreStatus: "not_required",
      expectedWinningMetrics: ["favorite_rate", "follow_rate"],
      actualSignal: "high favorite rate, follow signal",
      observedResult: { bucket: "strong_observed" },
      calibration: { status: "ready_for_retro" },
    }, {
      index: 1,
      dataStatus: "provisional",
      contentType: "trend",
      nanaGeneralizedClass: "awareness_asset",
      blindScoreStatus: "blind_score_blocked",
      expectedWinningMetrics: ["share_rate"],
      actualSignal: "distractor row",
      observedResult: { bucket: "weak_observed" },
      calibration: { status: "blocked" },
    }],
  });
  const payload = buildPayload({ worksFile, analysisFile, auditFile: "" });
  const matched = payload.items.find((item) => item.index === 2);
  assert.equal(matched.analysis.contentType, "knowledge");
  assert.equal(matched.analysis.nanaGeneralizedClass, "follow_asset");
  assert.equal(matched.contentType, "knowledge");
  assert.equal(matched.nanaGeneralizedClass, "follow_asset");
  assert.equal(matched.blindScoreStatus, "not_required");
  assert.equal(matched.dataStatus, "observed");
  assert.deepEqual(matched.expectedWinningMetrics, ["favorite_rate", "follow_rate"]);
  assert.equal(matched.observedResult.bucket, "strong_observed");
  assert.equal(matched.calibration.status, "ready_for_retro");
  assert.equal(payload.sourceSummary.analysisGeneratedAt, "2026-06-07T00:00:00.000Z");
});

test("lumina renderer requires a fresh analysis payload", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-lumina-analysis-"));
  const worksFile = path.join(tmp, "works.json");
  const outDir = path.join(tmp, "out");
  writeJson(worksFile, { publishedWorks: [baseWork()] });

  const result = require("node:child_process").spawnSync(process.execPath, [
    luminaScriptPath,
    "--works",
    worksFile,
    "--out",
    outDir,
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--analysis/);
});
