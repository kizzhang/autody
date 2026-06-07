#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

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

function byIndex(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row && row.index != null) map.set(Number(row.index), row);
  }
  return map;
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === 0 || value === false) return true;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function number(value) {
  if (!present(value)) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).replace(/,/g, "").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  return Number(match[0]) || 0;
}

function rate(value, numerator, denominator) {
  if (Number.isFinite(value)) return value;
  const top = number(numerator);
  const bottom = number(denominator);
  return bottom > 0 ? top / bottom : 0;
}

function pct(value) {
  return `${(number(value) * 100).toFixed(2)}%`;
}

function compact(value) {
  const n = number(value);
  if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[ch]);
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function short(value, max = 72) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function quantile(values, q) {
  const nums = values.map(number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const pos = (nums.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return nums[lo];
  return nums[lo] + (nums[hi] - nums[lo]) * (pos - lo);
}

function roleFor(item, boundaries) {
  if ((item.plays || 0) <= 0 && ((item.likes || 0) + (item.comments || 0) + (item.favorites || 0) + (item.shares || 0)) > 0) return "limited";
  if ((item.plays || 0) >= boundaries.p85 || item.newFollowers >= 50) return "mainline";
  if (item.shareRate >= 0.006 || /热点|老己|团播|minimax|kimi|cursor/i.test(`${item.caption} ${item.topic}`)) return "trend";
  if (item.favoriteRate >= 0.01 || /流程|工作流|教程|codex|agent|工具/i.test(`${item.caption} ${item.topic}`)) return "route";
  return "baseline";
}

function roleLabel(role) {
  return {
    mainline: "主线资产",
    trend: "借势传播",
    route: "路线资产",
    baseline: "基础样本",
    limited: "隔离样本",
  }[role] || role;
}

function roleColor(role) {
  return {
    mainline: "#f8cf3f",
    trend: "#e85f3f",
    route: "#2399a5",
    baseline: "#9fa9b7",
    limited: "#efece1",
  }[role] || "#9fa9b7";
}

function normalizeWork(work, index) {
  const plays = number(work.plays);
  const likes = number(work.likes);
  const comments = number(work.comments);
  const shares = number(work.shares);
  const favorites = number(work.favorites);
  const deep = work.deepMetrics || {};
  const completionRate = number(deep.completionRate || deep.finishRate || 0);
  const avgWatchTimeSeconds = number(deep.avgWatchTimeSeconds || 0);
  const newFollowers = number(deep.newFollowers || work.newFollowers || 0);
  return {
    index: number(work.index) || index + 1,
    mid: work.mid || "",
    url: work.publicUrl || work.url || "",
    caption: work.caption || "",
    publishedAt: work.publishedAt || "",
    itemType: work.itemType || "",
    topic: work.topic || inferTopic(work),
    plays,
    likes,
    comments,
    shares,
    favorites,
    newFollowers,
    likeRate: rate(work.likeRate, likes, plays),
    commentRate: rate(work.commentRate, comments, plays),
    shareRate: rate(work.shareRate, shares, plays),
    favoriteRate: rate(work.favoriteRate, favorites, plays),
    completionRate,
    avgWatchTimeSeconds,
    transcriptStatus: work.finalTranscriptStatus || work.transcriptStatus || "",
    transcriptSource: work.finalTranscriptSource || work.transcriptSource || "",
    transcriptChars: number(work.finalTranscriptChars || String(work.finalTranscript || "").length),
    topComments: Array.isArray(work.topComments) ? work.topComments : [],
  };
}

function inferTopic(work) {
  const text = `${work.caption || ""} ${(work.hashtags || []).join(" ")}`.toLowerCase();
  if (/科研|研究生|博士|专业|高考|论文|物理/.test(text)) return "AI+科研/教育重定价";
  if (/codex|agent|cursor|vibe|coding|app|工具|工作流/.test(text)) return "AI工具/工作流";
  if (/团播|老己|主播|声音/.test(text)) return "热点/身份反差";
  return "其他";
}

function buildPayload({ worksFile, analysisFile, auditFile }) {
  const worksData = readJson(worksFile);
  const analysisData = readJson(analysisFile);
  const auditData = readJson(auditFile);
  const rawWorks = asArray(worksData, ["publishedWorks", "works", "items"]);
  const normalized = rawWorks.map(normalizeWork);
  const analysisRows = byIndex(asArray(analysisData, ["items", "works"]));
  const boundaries = {
    p30: quantile(normalized.map((item) => item.plays), 0.3),
    p60: quantile(normalized.map((item) => item.plays), 0.6),
    p85: quantile(normalized.map((item) => item.plays), 0.85),
    p95: quantile(normalized.map((item) => item.plays), 0.95),
  };
  const items = normalized.map((item) => {
    const analysis = analysisRows.get(item.index) || null;
    return {
      ...item,
      role: roleFor(item, boundaries),
      analysis,
      dataStatus: (analysis && analysis.dataStatus) || item.distributionStatus || "observed",
      contentType: (analysis && analysis.contentType) || item.topic || "",
      nanaGeneralizedClass: (analysis && analysis.nanaGeneralizedClass) || "",
      blindScoreStatus: (analysis && analysis.blindScoreStatus) || "not_required",
      blindPrediction: (analysis && analysis.blindPrediction) || null,
      expectedWinningMetrics: (analysis && analysis.expectedWinningMetrics) || [],
      actualSignal: (analysis && analysis.actualSignal) || "",
      observedResult: (analysis && analysis.observedResult) || null,
      calibration: (analysis && analysis.calibration) || null,
    };
  });
  const roleCounts = items.reduce((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {});
  const topByPlays = [...items].sort((a, b) => b.plays - a.plays).slice(0, 6);
  const topBySave = [...items].sort((a, b) => b.favoriteRate - a.favoriteRate).slice(0, 6);
  const topByFollow = [...items].sort((a, b) => b.newFollowers - a.newFollowers).slice(0, 6);
  const caveats = [];
  if (auditData && auditData.summary && number(auditData.summary.withGaps) > 0) {
    caveats.push(`${auditData.summary.withGaps} 条作品仍有 audit gaps`);
  }
  if (items.some((item) => !item.url)) caveats.push("部分作品缺少公开视频链接");
  if (items.some((item) => item.itemType === "video" && !item.transcriptChars)) caveats.push("部分视频缺少逐字稿");
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      works: path.resolve(worksFile),
      analysis: analysisFile ? path.resolve(analysisFile) : "",
      audit: auditFile ? path.resolve(auditFile) : "",
    },
    sourceSummary: {
      analysisGeneratedAt: analysisData && (analysisData.generatedAt || analysisData.exportedAt || ""),
      auditGeneratedAt: auditData && auditData.generatedAt || "",
    },
    summary: {
      total: items.length,
      plays: items.reduce((sum, item) => sum + item.plays, 0),
      likes: items.reduce((sum, item) => sum + item.likes, 0),
      favorites: items.reduce((sum, item) => sum + item.favorites, 0),
      shares: items.reduce((sum, item) => sum + item.shares, 0),
      comments: items.reduce((sum, item) => sum + item.comments, 0),
      newFollowers: items.reduce((sum, item) => sum + item.newFollowers, 0),
      boundaries,
      roleCounts,
      caveats,
    },
    highlights: {
      topByPlays,
      topBySave,
      topByFollow,
    },
    items,
  };
}

function chartPoint(item, max) {
  const left = 70;
  const right = 710;
  const top = 64;
  const bottom = 386;
  if (item.role === "limited") {
    return { x: 100 + ((item.index - 1) % 8) * 78, y: 456, r: 9 };
  }
  const x = left + Math.min(item.favoriteRate / Math.max(max.favoriteRate, 0.001), 1) * (right - left);
  const y = bottom - Math.min(item.shareRate / Math.max(max.shareRate, 0.001), 1) * (bottom - top);
  const r = 8 + Math.sqrt(item.plays / Math.max(max.plays, 1)) * 30;
  return { x, y, r };
}

function renderBubbleMap(payload) {
  const max = {
    plays: Math.max(...payload.items.map((item) => item.plays), 1),
    favoriteRate: Math.max(...payload.items.map((item) => item.favoriteRate), 0.001),
    shareRate: Math.max(...payload.items.map((item) => item.shareRate), 0.001),
  };
  const important = new Set(payload.highlights.topByPlays.concat(payload.highlights.topBySave).slice(0, 10).map((item) => item.index));
  const dots = payload.items.map((item) => {
    const p = chartPoint(item, max);
    const label = important.has(item.index) ? `<text class="pt-label" x="${(p.x + p.r + 8).toFixed(1)}" y="${(p.y + 4).toFixed(1)}">#${item.index}</text>` : "";
    return `<g><circle class="dot ${esc(item.role)}" data-index="${item.index}" tabindex="0" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${roleColor(item.role)}"></circle>${label}</g>`;
  }).join("");
  return `<svg class="bubble-svg" viewBox="0 0 780 520" role="img" aria-label="收藏率转发率气泡图">
    <rect class="limited-lane" x="62" y="426" width="642" height="58" rx="29"></rect>
    ${[70, 230, 390, 550, 710].map((x) => `<line class="grid-line" x1="${x}" y1="64" x2="${x}" y2="386"></line>`).join("")}
    ${[90, 188, 286, 386].map((y) => `<line class="grid-line" x1="70" y1="${y}" x2="710" y2="${y}"></line>`).join("")}
    <line class="axis-line" x1="70" y1="386" x2="710" y2="386"></line>
    <line class="axis-line" x1="70" y1="64" x2="70" y2="386"></line>
    ${dots}
    <text class="axis-label" x="390" y="506" text-anchor="middle">x = 收藏率 / save rate</text>
    <text class="axis-label" transform="translate(24 230) rotate(-90)" text-anchor="middle">y = 转发率 / share rate</text>
    <text class="chart-note" x="88" y="461">limited lane · data caveat</text>
    <text class="chart-note" x="710" y="38" text-anchor="end">radius = plays</text>
  </svg>`;
}

function renderKpis(payload) {
  const rows = [
    ["作品数", payload.summary.total, "current source"],
    ["总播放", compact(payload.summary.plays), "visible plays"],
    ["总收藏", compact(payload.summary.favorites), "save signal"],
    ["总涨粉", compact(payload.summary.newFollowers), "creator-center visible"],
  ];
  return rows.map(([label, value, note]) => `<article class="kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
}

function renderRoleCards(payload) {
  return Object.entries(payload.summary.roleCounts).map(([role, count]) => {
    const roleItems = payload.items.filter((item) => item.role === role);
    const plays = roleItems.reduce((sum, item) => sum + item.plays, 0);
    return `<article class="topic" style="--c:${roleColor(role)}"><span>${esc(roleLabel(role))}</span><strong>${count}</strong><p>${compact(plays)} 播放 · 均藏 ${pct(roleItems.reduce((s, i) => s + i.favoriteRate, 0) / Math.max(roleItems.length, 1))}</p></article>`;
  }).join("");
}

function renderCases(payload) {
  const picked = [];
  for (const item of payload.highlights.topByPlays.concat(payload.highlights.topBySave, payload.highlights.topByFollow)) {
    if (!picked.some((row) => row.index === item.index)) picked.push(item);
    if (picked.length >= 8) break;
  }
  return picked.map((item) => `<article class="case-card">
    <span class="pill" style="--c:${roleColor(item.role)}">#${item.index} ${esc(roleLabel(item.role))}</span>
    <h3>${esc(short(item.caption, 52))}</h3>
    <p>${esc(item.topic)} · 播放 ${compact(item.plays)} · 收藏 ${pct(item.favoriteRate)} · 转发 ${pct(item.shareRate)} · 涨粉 ${compact(item.newFollowers)}</p>
    <p class="muted">Transcript: ${esc(item.transcriptStatus || "unknown")} / ${esc(item.transcriptSource || "unknown")}</p>
  </article>`).join("");
}

function renderRows(payload) {
  return payload.items.map((item) => `<tr data-role="${esc(item.role)}" data-search="${esc(`${item.caption} ${item.topic} ${item.publishedAt}`.toLowerCase())}">
    <td><b>#${item.index}</b><small>${esc(item.publishedAt)}</small></td>
    <td>${esc(item.caption)}<small>${esc(item.url)}</small></td>
    <td>播 ${compact(item.plays)}<small>赞 ${compact(item.likes)} · 评 ${compact(item.comments)} · 转 ${compact(item.shares)} · 藏 ${compact(item.favorites)}</small></td>
    <td>${esc(roleLabel(item.role))}<small>${esc(item.topic)}</small></td>
    <td>${pct(item.favoriteRate)}<small>转发 ${pct(item.shareRate)} · 完播 ${pct(item.completionRate)}</small></td>
    <td>${esc(item.transcriptStatus || "unknown")}<small>${esc(item.transcriptChars)} chars</small></td>
  </tr>`).join("");
}

function renderHtml(payload) {
  const data = Object.fromEntries(payload.items.map((item) => [item.index, item]));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AutoDY Lumina | 抖音创作者报告</title>
  <style>
:root{--ink:#171e19;--paper:#fff0a9;--surface:#fffdf2;--line:rgba(23,30,25,.18);--gold:#f8cf3f;--cyan:#2399a5;--coral:#e85f3f;--muted:rgba(23,30,25,.68);--mono:"SF Mono","JetBrains Mono",Menlo,ui-monospace,monospace;--sans:"Avenir Next","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body.sdv-lumina{margin:0;background:linear-gradient(155deg,#ffe17c 0%,#fff2b8 48%,#f4f7ee 100%);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}body.sdv-lumina:before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(circle,#171e1917 1.2px,transparent 1.4px) 0 0/30px 30px;pointer-events:none}.wrap{max-width:1440px;margin:0 auto;padding:0 28px}.topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 28px;background:rgba(255,225,124,.86);backdrop-filter:blur(14px);border-bottom:1.5px solid var(--ink)}.brand{display:flex;gap:12px;align-items:center}.sigil{display:grid;place-items:center;width:38px;height:38px;background:var(--ink);color:var(--paper);font:900 13px/1 var(--mono)}.brand b{display:block}.brand small{display:block;color:var(--muted);font-size:12px}.topbar nav{display:flex;gap:8px;flex-wrap:wrap}.topbar a{color:var(--ink);text-decoration:none;border:1.5px solid var(--ink);border-radius:999px;padding:7px 10px;font:800 11px/1 var(--mono);background:#fffdf2}.hero{padding:64px 0 28px}.hero-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(330px,.75fr);gap:22px;align-items:end}.kicker{font:900 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}.hero-title{font-size:clamp(56px,7.4vw,112px);line-height:.88;letter-spacing:0;margin:18px 0 18px;font-weight:900}.hero-title em{font-style:normal;color:var(--cyan)}.hero-lead{font-size:18px;max-width:780px;color:rgba(23,30,25,.76)}.data-plaque{min-height:520px;background:#fffdf2;border:2px solid var(--ink);box-shadow:12px 12px 0 rgba(23,30,25,.18);position:relative;overflow:hidden}.bubble-svg{width:100%;height:100%;min-height:500px}.grid-line{stroke:rgba(23,30,25,.13)}.axis-line{stroke:rgba(23,30,25,.45)}.axis-label,.chart-note{font:800 11px/1 var(--mono);fill:rgba(23,30,25,.7)}.dot{stroke:#171e19;stroke-width:2;cursor:pointer}.dot:hover,.dot:focus{stroke:#fff;outline:none}.pt-label{font:900 13px/1 var(--mono);fill:var(--ink);paint-order:stroke;stroke:#fffdf2;stroke-width:5px}.limited-lane{fill:rgba(23,30,25,.06);stroke:rgba(23,30,25,.2)}.verdict,.kpi,.topic,.case-card{background:#fffdf2;border:1.5px solid var(--ink);box-shadow:8px 8px 0 rgba(23,30,25,.12)}.verdict{padding:22px}.verdict h2{font-size:30px;line-height:1.1;margin:12px 0}.kpi-strip,.topic-grid,.case-grid{display:grid;gap:14px}.kpi-strip{grid-template-columns:repeat(4,1fr);margin-top:18px}.kpi{padding:16px}.kpi span,.kpi small{display:block;color:var(--muted);font:800 11px/1.3 var(--mono)}.kpi strong{display:block;margin:10px 0;font:900 34px/1 var(--mono)}.hero-bridge{background:#171e19;color:#fffdf2;margin-top:20px;padding:20px 0}.bridge-inner{display:flex;justify-content:space-between;gap:16px;align-items:center}.section{padding:42px 0}.section.dark{background:#171e19;color:#fffdf2}.section-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:18px}.section h2{font-size:34px;line-height:1;margin:0}.section p{color:var(--muted)}.section.dark p{color:rgba(255,253,242,.72)}.topic-grid{grid-template-columns:repeat(5,1fr)}.topic{border-color:var(--c);padding:16px}.topic span{font:900 12px/1 var(--mono);color:var(--c)}.topic strong{display:block;font:900 36px/1 var(--mono);margin-top:10px}.case-grid{grid-template-columns:repeat(4,1fr)}.case-card{padding:16px}.case-card h3{font-size:18px;line-height:1.25}.pill{display:inline-flex;border:1.5px solid var(--c);color:var(--c);border-radius:999px;padding:5px 8px;font:900 11px/1 var(--mono)}.muted{color:var(--muted)}.table-tools{display:grid;grid-template-columns:1fr 180px;gap:10px;margin-bottom:12px}.table-tools input,.table-tools select{height:42px;border:1.5px solid var(--ink);background:#fffdf2;padding:0 12px;font:inherit}.table-wrap{overflow:auto;background:#fffdf2;border:1.5px solid var(--ink)}table{width:100%;min-width:1100px;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid rgba(23,30,25,.14);padding:12px;font-size:13px}th{position:sticky;top:0;background:#171e19;color:#fffdf2;font:900 11px/1 var(--mono)}td small{display:block;color:var(--muted);margin-top:5px}.caveats{display:flex;flex-wrap:wrap;gap:8px}.caveats span{background:#fffdf2;border:1.5px solid var(--coral);color:var(--coral);padding:7px 10px;border-radius:999px;font:900 12px/1 var(--mono)}.tooltip{position:fixed;z-index:50;width:min(380px,calc(100vw - 24px));pointer-events:none;opacity:0;transform:translate(-50%,-110%);background:#fffdf2;border:1.5px solid var(--ink);box-shadow:10px 10px 0 rgba(23,30,25,.16);padding:14px}.tooltip.show{opacity:1}.tooltip h4{margin:0 0 8px}.tooltip p{margin:6px 0;color:var(--muted);font-size:13px}@media(max-width:980px){.hero-grid,.kpi-strip,.topic-grid,.case-grid{grid-template-columns:1fr 1fr}.bridge-inner,.section-head{display:block}.data-plaque{min-height:420px}}@media(max-width:680px){.wrap{padding:0 16px}.topbar{position:static;display:block}.topbar nav{margin-top:10px}.hero-title{font-size:48px}.hero-grid,.kpi-strip,.topic-grid,.case-grid{grid-template-columns:1fr}.data-plaque{min-height:360px}.bubble-svg{min-height:360px}.section{padding:30px 0}}
  </style>
</head>
<body class="sdv-lumina" data-generated-at="${esc(payload.generatedAt)}">
  <header class="topbar">
    <div class="brand"><span class="sigil">AD</span><div><b>AutoDY Lumina</b><small>${esc(payload.summary.total)} works / fresh payload / current data</small></div></div>
    <nav><a href="#map">Map</a><a href="#roles">分层</a><a href="#cases">样本</a><a href="#table">逐条</a></nav>
  </header>
  <main>
    <section class="hero" id="map"><div class="wrap hero-grid">
      <div>
        <div class="kicker">fresh autody report / lumina visual system</div>
        <h1 class="hero-title">最新底账，<br><em>重新分析。</em></h1>
        <p class="hero-lead">这份 HTML 保留 Lumina 视觉元素，但所有汇总、排序、分层和表格都来自本次输入数据重新计算。旧报告只作为视觉参考，不作为结论来源。</p>
        <div class="data-plaque">${renderBubbleMap(payload)}</div>
      </div>
      <aside class="verdict">
        <div class="kicker">core read</div>
        <h2>${esc(payload.summary.total)} 条作品，${compact(payload.summary.plays)} 总播放。</h2>
        <p>优先看主线资产、路线资产和隔离样本之间的差异。数据缺口会在下方明确标注。</p>
        <div class="caveats">${payload.summary.caveats.length ? payload.summary.caveats.map((c) => `<span>${esc(c)}</span>`).join("") : "<span>no audit caveat loaded</span>"}</div>
      </aside>
    </div><div class="wrap"><div class="kpi-strip">${renderKpis(payload)}</div></div></section>
    <aside class="hero-bridge"><div class="wrap bridge-inner"><b>Fresh analysis rule</b><span>Generated ${esc(payload.generatedAt)}</span><small>source: ${esc(path.basename(payload.sourceFiles.works))}</small></div></aside>
    <section class="section" id="roles"><div class="wrap">
      <div class="section-head"><h2>分层总览</h2><p>按当前数据重新分层，不复用旧样本判断。</p></div>
      <div class="topic-grid">${renderRoleCards(payload)}</div>
    </div></section>
    <section class="section dark" id="cases"><div class="wrap">
      <div class="section-head"><h2>关键样本</h2><p>从播放、收藏和涨粉信号重新挑样本。</p></div>
      <div class="case-grid">${renderCases(payload)}</div>
    </div></section>
    <section class="section" id="table"><div class="wrap">
      <div class="section-head"><h2>逐条数据表</h2><p>保留原始序号、链接、指标、分层和 transcript 状态。</p></div>
      <div class="table-tools"><input id="q" type="search" placeholder="搜索标题 / 主题 / 时间" aria-label="搜索表格"><select id="role"><option value="">全部分层</option>${Object.keys(payload.summary.roleCounts).map((role) => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join("")}</select></div>
      <div class="table-wrap"><table id="worksTable"><thead><tr><th>#</th><th>标题/链接</th><th>指标</th><th>分层</th><th>转化率</th><th>Transcript</th></tr></thead><tbody>${renderRows(payload)}</tbody></table></div>
    </div></section>
  </main>
  <div class="tooltip" id="tip" role="status" aria-live="polite"></div>
  <script>
const DATA = ${safeJson(data)};
const tip = document.getElementById("tip");
function htmlEsc(value){return String(value == null ? "" : value).replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[ch]));}
function show(evt,item){if(!item||!tip)return;tip.innerHTML='<h4>#'+item.index+' · '+htmlEsc(item.topic)+'</h4><p>'+htmlEsc(item.caption)+'</p><p>播放 '+item.plays+' · 收藏率 '+(item.favoriteRate*100).toFixed(2)+'% · 转发率 '+(item.shareRate*100).toFixed(2)+'%</p>';tip.classList.add('show');tip.style.left=Math.min(evt.clientX,window.innerWidth-20)+'px';tip.style.top=Math.max(evt.clientY,120)+'px';}
function hide(){if(tip)tip.classList.remove('show');}
document.querySelectorAll('.dot').forEach((dot)=>{dot.addEventListener('mousemove',(evt)=>show(evt,DATA[dot.dataset.index]));dot.addEventListener('focus',(evt)=>show(evt,DATA[dot.dataset.index]));dot.addEventListener('mouseleave',hide);dot.addEventListener('blur',hide);});
const q=document.getElementById('q');const role=document.getElementById('role');const rows=Array.from(document.querySelectorAll('#worksTable tbody tr'));
function filter(){const text=(q.value||'').toLowerCase();const r=role.value;rows.forEach((row)=>{const okText=!text||row.dataset.search.includes(text);const okRole=!r||row.dataset.role===r;row.hidden=!(okText&&okRole);});}
q.addEventListener('input',filter);role.addEventListener('change',filter);
  </script>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.works || !args.out) {
    console.error("Usage: render_lumina_report.cjs --works works.json --out output_dir [--analysis analysis.json] [--audit audit.json] [--html report_lumina.html]");
    process.exit(2);
  }
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const payload = buildPayload({ worksFile: args.works, analysisFile: args.analysis, auditFile: args.audit });
  const payloadPath = path.join(outDir, "report_lumina_payload.json");
  const htmlPath = path.join(outDir, args.html || "report_lumina.html");
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(htmlPath, renderHtml(payload), "utf8");
  console.log(JSON.stringify({ payload: payloadPath, html: htmlPath, items: payload.items.length }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { buildPayload, renderHtml };
