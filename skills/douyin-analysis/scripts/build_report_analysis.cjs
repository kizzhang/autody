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
    favoriteRateText: pct(favoriteRate),
    completionRate: nativeSignals.retentionSignals.completionRate,
    fiveSecondCompletionRate: nativeSignals.retentionSignals.fiveSecondCompletionRate,
    newFollowers: nativeSignals.audienceAsset.newFollowers,
    followRate: nativeSignals.audienceAsset.followRate,
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

  const items = works.map((work, idx) => {
    const row = { index: work.index || idx + 1, ...work };
    const rawDouyinTabs = hasNativeTabEvidence(row.rawDouyinTabs) ? row.rawDouyinTabs : {};
    const nativeSignals = normalizeDouyinTabs({ rawDouyinTabs });
    const auditRow = findByWork(auditByKey, row);
    const caveats = rowCaveats(row, auditRow);
    const dataStatus = classifyDataStatus(row, auditRow, nativeSignals.nativeTabCompleteness);
    const contentType = inferContentType(row);
    const accountAsset = inferAccountAsset(row, nativeSignals);
    const userBait = inferUserBait(row, nativeSignals);
    const signal = observedSignal(row, nativeSignals);
    const blind = blindState(row, findByWork(blindByKey, row), options.newAfter);
    const bucket = predictedBucket(blind.blindPrediction);
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
    lines.push(
      "",
      `### ${item.index}. ${item.title || item.mid}`,
      "",
      `- Status: ${item.dataStatus}; blind: ${item.blindScoreStatus}`,
      `- URL: ${item.publicUrl}`,
      `- Type: ${item.contentType}; class: ${item.nanaGeneralizedClass}`,
      `- Expected metrics: ${item.expectedWinningMetrics.join(", ")}`,
      `- Observed: plays ${item.actualSignal.plays}, favorite rate ${item.actualSignal.favoriteRateText}`,
      `- Calibration: predicted ${item.calibration.predictedBucket || "n/a"}, observed ${item.calibration.observedBucket}`,
    );
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
