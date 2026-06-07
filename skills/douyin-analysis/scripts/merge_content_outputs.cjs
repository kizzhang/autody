#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
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

function csvCell(value) {
  if (Array.isArray(value)) {
    value = value.some((item) => item && typeof item === "object") ? JSON.stringify(value) : value.join(" ");
  } else if (value && typeof value === "object") {
    value = JSON.stringify(value);
  }
  if (value == null) value = "";
  value = String(value);
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "";
}

function numericRate(part, whole) {
  return whole > 0 ? part / whole : 0;
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

function firstPresent(obj, names) {
  for (const name of names) {
    if (present(obj[name])) return obj[name];
  }
  return "";
}

function stripPreamble(text) {
  return String(text || "")
    .replace(/^好[，,]?\s*我直接给你[^\n]*\n?/u, "")
    .replace(/^以下是[^\n]*\n?/u, "")
    .replace(/要不要我把[\s\S]*$/u, "")
    .replace(/需要我把[\s\S]*$/u, "")
    .trim();
}

function inferTopic(work) {
  const text = `${work.caption || ""} ${(work.hashtags || []).join(" ")}`.toLowerCase();
  if (/团播|博士毕业|毕业|失业|长衫/.test(text)) return "个人经历/转型";
  if (/vibe|coding|cursor|claude|编程|app|agent|openclaw|skills/.test(text)) return "AI 工具/Vibe Coding";
  if (/科研|物理|数学|读研|读博|agi|paper|science/.test(text)) return "AI 科研/学术";
  if (/健身|token|主播|声音/.test(text)) return "轻内容/生活";
  return "其他";
}

function engagementBucket(work) {
  const plays = work.plays || 0;
  const likeRate = work.likeRate || 0;
  const favoriteRate = work.favoriteRate || 0;
  const commentRate = work.commentRate || 0;
  if (plays >= 1000 && (likeRate >= 0.03 || favoriteRate >= 0.01 || commentRate >= 0.006)) return "高表现";
  if (plays >= 500 || likeRate >= 0.025 || favoriteRate >= 0.008) return "中等表现";
  return "低样本/待观察";
}

function buildFinalTranscript(work, transcriptByIndex) {
  const direct = transcriptByIndex.get(work.index) || transcriptByIndex.get(String(work.index)) || transcriptByIndex.get(work.publicUrl);
  if (work.doubaoTranscript && work.transcriptStatus === "ok") {
    return { source: "doubao", status: "ok", text: stripPreamble(work.doubaoTranscript), note: "Doubao transcript" };
  }
  if (direct) {
    const text = direct.transcript || direct.text || direct.finalTranscript || "";
    const source = direct.source || direct.finalTranscriptSource || direct.status || "transcript_file";
    const status = direct.status && String(direct.status).includes("ok") ? "ok" : direct.status || "ok";
    return { source, status, text: String(text).trim(), note: direct.note || direct.finalTranscriptNote || "" };
  }
  if (work.doubaoTranscript) {
    return { source: "doubao", status: work.transcriptStatus || "unknown", text: stripPreamble(work.doubaoTranscript), note: "Doubao returned non-ok status" };
  }
  if (work.finalTranscript) {
    return {
      source: work.finalTranscriptSource || "existing_final",
      status: work.finalTranscriptStatus || "ok",
      text: String(work.finalTranscript).trim(),
      note: work.finalTranscriptNote || "Existing final transcript",
    };
  }
  return { source: "missing", status: "missing", text: "", note: "No transcript found" };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.works || !args.out) {
    console.error("Usage: merge_content_outputs.cjs --works works_progress.json --out output_dir [--transcripts transcripts.json] [--deep deep_metrics.json]");
    process.exit(2);
  }

  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const worksData = readJson(args.works);
  const transcriptData = readJson(args.transcripts);
  const deepData = readJson(args.deep);
  const works = asArray(worksData, ["publishedWorks", "works", "items"]);
  const transcriptRows = asArray(transcriptData, ["results", "transcripts", "items", "publishedWorks"]);
  const deepRows = asArray(deepData, ["items", "deepMetrics", "results", "publishedWorks"]);
  const transcriptByIndex = new Map();
  for (const row of transcriptRows) {
    if (row.index != null) transcriptByIndex.set(row.index, row);
    if (row.publicUrl) transcriptByIndex.set(row.publicUrl, row);
  }
  const deepByIndex = new Map();
  for (const row of deepRows) {
    if (row.index != null) deepByIndex.set(row.index, row);
    if (row.mid) deepByIndex.set(row.mid, row);
    if (row.publicUrl) deepByIndex.set(row.publicUrl, row);
  }

  const finalWorks = works.map((work, idx) => {
    const normalized = { index: work.index || idx + 1, ...work };
    const deep = deepByIndex.get(normalized.index) || deepByIndex.get(normalized.mid) || deepByIndex.get(normalized.publicUrl) || {};
    const deepMetrics = deep.metrics || deep.deepMetrics || {};
    const rawDouyinTabs = hasNativeTabEvidence(deep.rawDouyinTabs) ? deep.rawDouyinTabs : normalized.rawDouyinTabs || {};
    const nativeSignals = normalizeDouyinTabs({ rawDouyinTabs });
    const fillCount = (field, names) => {
      if (!present(work[field]) && !present(work[`${field}Text`])) {
        const value = firstPresent(deepMetrics, names);
        if (present(value)) normalized[field] = Number(value);
      }
    };
    fillCount("plays", ["plays", "playCount", "viewCount", "view_count"]);
    fillCount("likes", ["likes", "likeCount", "like_count"]);
    fillCount("comments", ["comments", "commentCount", "comment_count"]);
    fillCount("shares", ["shares", "shareCount", "share_count"]);
    fillCount("favorites", ["favorites", "favoriteCount", "favorite_count"]);
    if (!present(normalized.avgPlayTimeText) && present(deepMetrics.avgWatchTimeText)) normalized.avgPlayTimeText = deepMetrics.avgWatchTimeText;
    if (!present(normalized.avgPlayTimeText) && present(deepMetrics.avgWatchTimeSeconds)) normalized.avgPlayTimeText = `${deepMetrics.avgWatchTimeSeconds}秒`;
    normalized.plays = Number(normalized.plays || 0);
    normalized.likes = Number(normalized.likes || 0);
    normalized.comments = Number(normalized.comments || 0);
    normalized.shares = Number(normalized.shares || 0);
    normalized.favorites = Number(normalized.favorites || 0);
    normalized.likeRate = Number.isFinite(normalized.likeRate) ? normalized.likeRate : numericRate(normalized.likes, normalized.plays);
    normalized.commentRate = Number.isFinite(normalized.commentRate) ? normalized.commentRate : numericRate(normalized.comments, normalized.plays);
    normalized.shareRate = Number.isFinite(normalized.shareRate) ? normalized.shareRate : numericRate(normalized.shares, normalized.plays);
    normalized.favoriteRate = Number.isFinite(normalized.favoriteRate) ? normalized.favoriteRate : numericRate(normalized.favorites, normalized.plays);
    const transcript = buildFinalTranscript(normalized, transcriptByIndex);
    const topComments = deep.topComments || deep.comments || normalized.topComments || [];
    return {
      ...normalized,
      deepMetrics,
      rawDouyinTabs,
      nativeTabCompleteness: nativeSignals.nativeTabCompleteness,
      retentionSignals: nativeSignals.retentionSignals,
      interactionSignals: nativeSignals.interactionSignals,
      trafficSources: nativeSignals.trafficSources,
      searchIntent: nativeSignals.searchIntent,
      audienceAsset: nativeSignals.audienceAsset,
      commentIntent: nativeSignals.commentIntent,
      negativeSignals: nativeSignals.negativeSignals,
      trendOrPlatformBoost: nativeSignals.trendOrPlatformBoost,
      topComments,
      commentKeywords: deep.commentKeywords || normalized.commentKeywords || [],
      topic: normalized.topic || inferTopic(normalized),
      performanceBucket: normalized.performanceBucket || engagementBucket(normalized),
      likeRateText: pct(normalized.likeRate),
      commentRateText: pct(normalized.commentRate),
      shareRateText: pct(normalized.shareRate),
      favoriteRateText: pct(normalized.favoriteRate),
      finalTranscriptSource: transcript.source,
      finalTranscriptStatus: transcript.status,
      finalTranscriptNote: transcript.note,
      finalTranscript: transcript.text,
      finalTranscriptChars: transcript.text.length,
    };
  });

  const summary = {
    total: finalWorks.length,
    missingPublicUrls: finalWorks.filter((work) => !work.publicUrl).map((work) => work.index),
    duplicateIds: finalWorks.map((work) => work.mid).filter((id, idx, ids) => id && ids.indexOf(id) !== idx),
    emptyTranscripts: finalWorks.filter((work) => !work.finalTranscript).map((work) => work.index),
    missingTopComments: finalWorks.filter((work) => !Array.isArray(work.topComments) || work.topComments.length === 0).map((work) => work.index),
    missingCompletionRate: finalWorks.filter((work) => work.itemType === "video" && !["completionRate", "completionRateText", "finishRate", "finishRateText"].some((key) => present(work.deepMetrics[key]))).map((work) => work.index),
    sourceCounts: finalWorks.reduce((acc, work) => {
      acc[work.finalTranscriptSource] = (acc[work.finalTranscriptSource] || 0) + 1;
      return acc;
    }, {}),
    statusCounts: finalWorks.reduce((acc, work) => {
      acc[work.finalTranscriptStatus] = (acc[work.finalTranscriptStatus] || 0) + 1;
      return acc;
    }, {}),
  };

  const stem = args.stem || "content";
  fs.writeFileSync(path.join(outDir, `${stem}_works_final.json`), JSON.stringify({ exportedAt: new Date().toISOString(), summary, publishedWorks: finalWorks }, null, 2));

  const cols = [
    "index", "publishedAt", "status", "itemType", "durationOrType", "durationSeconds", "topic", "performanceBucket",
    "caption", "hashtags", "mid", "publicUrl", "plays", "likes", "comments", "shares", "favorites",
    "likeRateText", "commentRateText", "shareRateText", "favoriteRateText",
    "finalTranscriptStatus", "finalTranscriptSource", "finalTranscriptNote", "finalTranscriptChars", "finalTranscript",
    "deepMetrics", "topComments", "commentKeywords",
    "rawDouyinTabs", "nativeTabCompleteness", "retentionSignals", "interactionSignals",
    "trafficSources", "searchIntent", "audienceAsset", "commentIntent",
    "negativeSignals", "trendOrPlatformBoost",
  ];
  fs.writeFileSync(path.join(outDir, `${stem}_works_final.csv`), [cols.join(",")].concat(finalWorks.map((work) => cols.map((col) => csvCell(work[col])).join(","))).join("\n"));

  let md = `# Content Works Final\n\nExported: ${new Date().toISOString()}\n\n`;
  md += `Summary: ${JSON.stringify(summary)}\n\n`;
  for (const work of finalWorks) {
    md += `## ${work.index}. ${work.publishedAt || ""} · ${work.topic || ""}\n\n`;
    md += `URL: ${work.publicUrl || ""}\n\n`;
    md += `Metrics: plays ${work.plays || 0}, likes ${work.likes || 0}, comments ${work.comments || 0}, shares ${work.shares || 0}, favorites ${work.favorites || 0}\n\n`;
    md += `Caption: ${work.caption || ""}\n\n`;
    md += `Transcript source: ${work.finalTranscriptSource}; status: ${work.finalTranscriptStatus}\n\n`;
    md += `${work.finalTranscript || "No transcript"}\n\n`;
  }
  fs.writeFileSync(path.join(outDir, `${stem}_transcripts_final.md`), md);
  console.log(JSON.stringify({ outDir, summary }, null, 2));
}

main();
