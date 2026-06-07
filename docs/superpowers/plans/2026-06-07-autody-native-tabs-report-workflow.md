# Autody Native Tabs Report Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Autody so `/kaishi` and `/gengxin` collect the complete visible/exportable Douyin creator work-detail tab data, `/tijian` audits it, `/buchong` backfills only audited gaps, `/baogao` builds a fresh atomic report analysis, and `/html` renders Lumina from that current analysis.

**Architecture:** Store Douyin work-detail data raw-first under `rawDouyinTabs`, with one namespace per visible tab: `overview`, `trafficAnalysis`, `audienceAnalysis`, and `commentHotWords`. Add a pure normalizer that turns those raw sections into stable report signals, then reuse that normalizer from merge, audit, report-payload, and Lumina rendering. Keep browser collection in Chrome Extension skills only; report and HTML commands are local read-only workflows.

**Tech Stack:** Node.js 18 CommonJS, `node:test`, existing Autody CLI validation, Codex skills Markdown, Chrome Extension workflow docs, Lumina HTML renderer.

---

## Current Worktree Note

Before implementation, run:

```bash
git status --short --branch
```

Expected current dirty files may include:

```text
 M skills/douyin-analysis/SKILL.md
 M skills/douyin-analysis/scripts/audit_content_gaps.cjs
 M skills/douyin-analysis/scripts/merge_content_outputs.cjs
```

Read those files before editing and preserve the user's existing changes. Do not stage unrelated user changes. Each commit below stages only the files named in its task.

## File Structure

- Create `skills/douyin-analysis/references/douyin-native-tabs.md`: canonical field contract for the four Douyin creator detail tabs and the raw-vs-normalized data rule.
- Create `skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs`: pure normalizer for raw Douyin tab data; exports `normalizeDouyinTabs`, `nativeTabCompleteness`, `parseChineseCount`, and `normalizeRate`.
- Create `skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs`: unit tests for tab completeness and signal normalization.
- Create `skills/douyin-analysis/scripts/build_report_analysis.cjs`: local read-only report payload builder for `/baogao`; emits `douyin_incremental_analysis_YYYY-MM-DD.json` and `.md`.
- Create `skills/douyin-analysis/scripts/build_report_analysis.test.cjs`: unit tests for report data gate, blind-score blocking, blind prediction carry-through, and atomic claim shape.
- Create `skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs`: CLI test proving merge preserves `rawDouyinTabs` and writes normalized signals.
- Create `skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs`: CLI test proving audit flags missing native tab sections.
- Modify `skills/douyin-analysis/scripts/merge_content_outputs.cjs`: preserve `rawDouyinTabs`, attach normalized signal groups, include raw tabs in JSON and CSV output.
- Modify `skills/douyin-analysis/scripts/audit_content_gaps.cjs`: audit native tab completeness in addition to the existing transcript, metric, and comment checks.
- Modify `skills/douyin-analysis/scripts/render_lumina_report.cjs`: merge fresh analysis fields from `douyin_incremental_analysis_YYYY-MM-DD.json` into `report_lumina_payload.json`.
- Modify `skills/douyin-analysis/SKILL.md`: update the base workflow so "拉数据" means all visible/exportable native tabs, not only minimal metrics.
- Modify `skills/douyin-analysis/references/chrome-extension-workflow.md`: require official export first, visible DOM fallback second, and `dataGap` for chart values that cannot be read.
- Modify `skills/douyin-analysis/references/douyin-workflow.md`: document `rawDouyinTabs` and normalized report signal fields.
- Modify `skills/douyin-analysis/references/report-agent.md`: point `/baogao` to the new atomic report payload builder and blind-prediction file contract.
- Modify `skills/douyin-analysis/references/report-design.md`: make Lumina consume the fresh analysis payload rather than old report conclusions.
- Modify `skills/douyin-analysis/references/lumina-html-workflow.md`: pass `--analysis` to the renderer and carry blind-score status into HTML.
- Modify `skills/kaishi/SKILL.md`: state that first baseline captures every visible/exportable detail tab for every work.
- Modify `skills/gengxin/SKILL.md`: state that updates refresh new and stale raw tabs, not only top-line metrics.
- Modify `skills/tijian/SKILL.md`: state that audit includes raw Douyin tab completeness and suggests `/buchong` only when gaps exist.
- Modify `skills/buchong/SKILL.md`: state that backfill is derived from `/tijian`/audit output and fixes only listed tab gaps.
- Modify `skills/baogao/SKILL.md`: call `build_report_analysis.cjs`, require current data, and preserve `blind_score_blocked`.
- Modify `skills/html/SKILL.md`: require fresh analysis input and never create retrospective blind scores.
- Modify `scripts/validate_chrome_extension_policy.cjs`: enforce new docs, scripts, and command boundaries.
- Modify `package.json`: add syntax checks and `node --test` commands for the new scripts.

## Data Contract

Every work may keep top-level convenience metrics, but the source of truth for creator-detail page data is:

```json
{
  "rawDouyinTabs": {
    "overview": {
      "capturedAt": "2026-06-07T08:00:00.000Z",
      "source": "creator.douyin.com work-detail visible tab",
      "coreMetrics": {
        "completionRate": "37.2%",
        "avgWatchTimeText": "1分12秒",
        "twoSecondBounceRate": "18.4%",
        "fiveSecondCompletionRate": "64.0%",
        "avgPlayRatio": "44.1%"
      },
      "watchTrend": [],
      "retentionAnalysis": [],
      "bounceAnalysis": [],
      "interactionMetrics": {
        "likeRate": "4.3%",
        "commentRate": "0.6%",
        "shareRate": "0.8%",
        "favoriteRate": "1.5%",
        "danmakuCount": "12",
        "notInterestedRate": "0.03%"
      },
      "danmakuAnalysis": []
    },
    "trafficAnalysis": {
      "capturedAt": "2026-06-07T08:00:00.000Z",
      "douyinAppSourceShare": [
        { "source": "推荐页", "share": "72.5%", "compare7d": "+8.1%" }
      ],
      "otherAppSourceShare": [],
      "extraTraffic": "320",
      "platformBoostTraffic": "0",
      "searchTermsBefore": [
        { "rank": 1, "term": "自媒体复盘", "share": "18.2%" }
      ],
      "searchTermsAfter": [
        { "rank": 1, "term": "怎么做内容", "share": "11.4%" }
      ]
    },
    "audienceAnalysis": {
      "capturedAt": "2026-06-07T08:00:00.000Z",
      "followMetrics": {
        "newFollowers": "26",
        "followRate": "0.42%",
        "lostFollowers": "2",
        "lostFollowerRate": "0.03%",
        "notInterestedCount": "3",
        "notInterestedRate": "0.05%"
      },
      "followTrend": [],
      "genderDistribution": [],
      "ageDistribution": [],
      "regionDistribution": [],
      "interestDistribution": [],
      "followHotWords": []
    },
    "commentHotWords": {
      "capturedAt": "2026-06-07T08:00:00.000Z",
      "words": [
        { "rank": 1, "word": "干货", "hotness": "99" }
      ]
    }
  }
}
```

Normalized report fields are derived from raw tabs during merge:

```json
{
  "retentionSignals": {},
  "interactionSignals": {},
  "trafficSources": [],
  "searchIntent": {},
  "audienceAsset": {},
  "commentIntent": {},
  "negativeSignals": {},
  "trendOrPlatformBoost": {}
}
```

## Task 1: Document The Native Douyin Tab Contract

**Files:**
- Create: `skills/douyin-analysis/references/douyin-native-tabs.md`
- Modify: `scripts/validate_chrome_extension_policy.cjs`

- [ ] **Step 1: Add a failing validator assertion**

Edit `scripts/validate_chrome_extension_policy.cjs` and add these assertions after the existing `douyin-workflow.md` assertion:

```js
assertIncludes("skills/douyin-analysis/references/douyin-native-tabs.md", "rawDouyinTabs");
assertIncludes("skills/douyin-analysis/references/douyin-native-tabs.md", "overview");
assertIncludes("skills/douyin-analysis/references/douyin-native-tabs.md", "trafficAnalysis");
assertIncludes("skills/douyin-analysis/references/douyin-native-tabs.md", "audienceAnalysis");
assertIncludes("skills/douyin-analysis/references/douyin-native-tabs.md", "commentHotWords");
```

Add the new file to `checkedFiles`:

```js
  "skills/douyin-analysis/references/douyin-native-tabs.md",
```

- [ ] **Step 2: Run validation and confirm the red state**

Run:

```bash
npm test
```

Expected: FAIL with `ENOENT` or an include assertion for `skills/douyin-analysis/references/douyin-native-tabs.md`.

- [ ] **Step 3: Create the native tabs reference**

Create `skills/douyin-analysis/references/douyin-native-tabs.md` with this content:

```markdown
# Douyin Native Work-Detail Tabs

This reference defines what Autody should collect from Douyin creator-center work detail pages when the user owns or is authorized to manage the account.

## Collection Principle

Collect every visible or officially exportable field from these tabs:

1. `总览`
2. `流量分析`
3. `观众分析`
4. `评论热词`

Use official in-page export/download controls when Douyin provides them. If export is not available, capture visible DOM text, visible table rows, and visible chart labels. If a chart has no readable numeric values, record a `dataGap` object with the section name, capture time, and reason.

Do not inspect cookies, localStorage, passwords, session stores, Chrome profile files, or network payloads that are not exposed through normal visible page controls.

## Raw Storage

Store native detail data under `rawDouyinTabs` on the matching work or deep-metric row:

```json
{
  "rawDouyinTabs": {
    "overview": {},
    "trafficAnalysis": {},
    "audienceAnalysis": {},
    "commentHotWords": {}
  }
}
```

Every tab object should include `capturedAt` and `source` when possible.

## Required Raw Sections

`overview` should keep:

- `coreMetrics`: completion, average watch time, bounce, short retention, average play ratio.
- `watchTrend`: readable trend table or chart labels.
- `retentionAnalysis`: readable retention curve labels or exported rows.
- `bounceAnalysis`: readable bounce analysis rows or labels.
- `interactionMetrics`: like, comment, share, favorite, danmaku, not-interested rates.
- `danmakuAnalysis`: visible danmaku and like analysis rows when present.

`trafficAnalysis` should keep:

- `douyinAppSourceShare`: rows for recommendation page, profile page, search, message page, and other visible sources.
- `otherAppSourceShare`: rows for other Douyin-family apps when present.
- `extraTraffic`: extra traffic value or label.
- `platformBoostTraffic`: platform support traffic value or label.
- `searchTermsBefore`: ranked terms that brought viewers to the work.
- `searchTermsAfter`: ranked terms viewers searched after watching.

`audienceAnalysis` should keep:

- `followMetrics`: new followers, follow rate, lost followers, lost follower rate, not-interested count, not-interested rate.
- `followTrend`: cumulative and new follow trend labels.
- `genderDistribution`: visible gender rows.
- `ageDistribution`: visible age rows.
- `regionDistribution`: visible region rows.
- `interestDistribution`: visible audience-interest rows.
- `followHotWords`: visible audience follow-hotword rows.

`commentHotWords` should keep:

- `words`: every visible ranked hot word from both visible table columns.

## Normalized Signals

The merge script derives these fields from `rawDouyinTabs`:

- `retentionSignals`
- `interactionSignals`
- `trafficSources`
- `searchIntent`
- `audienceAsset`
- `commentIntent`
- `negativeSignals`
- `trendOrPlatformBoost`

Reports may use normalized signals for comparison, but raw tabs remain the evidence layer.

## Command Boundaries

`/kaishi` captures all visible/exportable native tabs for all works in the first baseline.

`/gengxin` captures native tabs for new works and refreshes stale native tabs for recent or requested works.

`/tijian` audits local files only. It does not open Chrome.

`/buchong` starts from an audit result and backfills only listed gaps.

`/baogao` reads existing files and generates fresh analysis. It does not collect data.

`/html` renders Lumina from the fresh analysis payload. It does not create new conclusions from old HTML.
```

- [ ] **Step 4: Run validation and confirm the document passes**

Run:

```bash
npm test
```

Expected: PASS for the new document assertions. Existing unrelated dirty-file behavior should not change.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate_chrome_extension_policy.cjs skills/douyin-analysis/references/douyin-native-tabs.md
git commit -m "docs: define douyin native tab data contract"
```

## Task 2: Add The Pure Native Tab Normalizer

**Files:**
- Create: `skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs`
- Create: `skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add the failing normalizer test**

Create `skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs` with this content:

```js
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
```

- [ ] **Step 2: Run the test and confirm the red state**

Run:

```bash
node --test skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs
```

Expected: FAIL with `Cannot find module './normalize_douyin_tabs.cjs'`.

- [ ] **Step 3: Create the normalizer implementation**

Create `skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs` with this content:

```js
#!/usr/bin/env node
const fs = require("node:fs");

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === 0 || value === false) return true;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function parseChineseCount(value) {
  if (!present(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).replace(/,/g, "").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const base = Number(match[0]);
  if (!Number.isFinite(base)) return null;
  if (/亿/.test(text)) return Math.round(base * 100000000);
  if (/万/.test(text)) return Math.round(base * 10000);
  if (/\bk\b/i.test(text)) return Math.round(base * 1000);
  return base;
}

function normalizeRate(value) {
  if (!present(value)) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const ratio = value > 1 ? value / 100 : value;
    return ratio >= -1 && ratio <= 1 ? Number(ratio.toFixed(6)) : null;
  }
  const text = String(value).replace(/,/g, "").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  if (!Number.isFinite(number)) return null;
  const ratio = text.includes("%") || Math.abs(number) > 1 ? number / 100 : number;
  return ratio >= -1 && ratio <= 1 ? Number(ratio.toFixed(6)) : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstPresent(obj, names) {
  if (!obj || typeof obj !== "object") return null;
  for (const name of names) {
    if (present(obj[name])) return obj[name];
  }
  return null;
}

function normalizeShareRow(row) {
  return {
    source: row.source || row.name || row.label || "",
    share: normalizeRate(firstPresent(row, ["share", "sourceShare", "ratio", "占比"])),
    shareText: firstPresent(row, ["share", "sourceShare", "ratio", "占比"]) || "",
    compare7d: firstPresent(row, ["compare7d", "comparison7d", "对比7日"]) || "",
  };
}

function normalizeTermRow(row) {
  return {
    rank: parseChineseCount(firstPresent(row, ["rank", "index", "排名"])) || null,
    term: row.term || row.word || row.keyword || row.hotWord || "",
    share: normalizeRate(firstPresent(row, ["share", "ratio", "占比"])),
    shareText: firstPresent(row, ["share", "ratio", "占比"]) || "",
  };
}

function normalizeWordRow(row) {
  return {
    rank: parseChineseCount(firstPresent(row, ["rank", "index", "排名"])) || null,
    word: row.word || row.term || row.keyword || row.hotWord || "",
    hotness: parseChineseCount(firstPresent(row, ["hotness", "heat", "热度"])) || null,
    hotnessText: firstPresent(row, ["hotness", "heat", "热度"]) || "",
  };
}

function hasObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function nativeTabCompleteness(rawTabs) {
  const tabs = rawTabs && typeof rawTabs === "object" ? rawTabs : {};
  const overview = tabs.overview || {};
  const traffic = tabs.trafficAnalysis || {};
  const audience = tabs.audienceAnalysis || {};
  const hotWords = tabs.commentHotWords || {};
  const missingFields = [];

  if (!hasObject(overview.coreMetrics)) missingFields.push("rawDouyinTabs.overview.coreMetrics");
  if (!hasObject(overview.interactionMetrics)) missingFields.push("rawDouyinTabs.overview.interactionMetrics");
  if (!present(overview.retentionAnalysis) && !present(overview.watchTrend)) {
    missingFields.push("rawDouyinTabs.overview.retentionAnalysis");
  }
  if (!present(traffic.douyinAppSourceShare)) {
    missingFields.push("rawDouyinTabs.trafficAnalysis.douyinAppSourceShare");
  }
  if (!present(traffic.searchTermsBefore) && !present(traffic.searchTermsAfter)) {
    missingFields.push("rawDouyinTabs.trafficAnalysis.searchTerms");
  }
  if (!hasObject(audience.followMetrics)) {
    missingFields.push("rawDouyinTabs.audienceAnalysis.followMetrics");
  }
  if (!present(audience.genderDistribution) && !present(audience.ageDistribution) && !present(audience.regionDistribution)) {
    missingFields.push("rawDouyinTabs.audienceAnalysis.demographics");
  }
  if (!present(hotWords.words)) missingFields.push("rawDouyinTabs.commentHotWords.words");

  return {
    status: missingFields.length ? "incomplete" : "complete",
    missingFields,
  };
}

function normalizeDouyinTabs(row) {
  const rawTabs = row && row.rawDouyinTabs ? row.rawDouyinTabs : {};
  const overview = rawTabs.overview || {};
  const traffic = rawTabs.trafficAnalysis || {};
  const audience = rawTabs.audienceAnalysis || {};
  const hotWords = rawTabs.commentHotWords || {};
  const core = overview.coreMetrics || {};
  const interaction = overview.interactionMetrics || {};
  const follow = audience.followMetrics || {};

  const trafficSources = asArray(traffic.douyinAppSourceShare).map(normalizeShareRow)
    .concat(asArray(traffic.otherAppSourceShare).map(normalizeShareRow))
    .filter((item) => item.source || item.share !== null);

  const beforeTerms = asArray(traffic.searchTermsBefore).map(normalizeTermRow).filter((item) => item.term);
  const afterTerms = asArray(traffic.searchTermsAfter).map(normalizeTermRow).filter((item) => item.term);

  return {
    nativeTabCompleteness: nativeTabCompleteness(rawTabs),
    retentionSignals: {
      completionRate: normalizeRate(firstPresent(core, ["completionRate", "finishRate", "完播率"])),
      avgWatchTimeText: firstPresent(core, ["avgWatchTimeText", "averageWatchTime", "平均播放时长"]) || "",
      twoSecondBounceRate: normalizeRate(firstPresent(core, ["twoSecondBounceRate", "2s跳出率"])),
      fiveSecondCompletionRate: normalizeRate(firstPresent(core, ["fiveSecondCompletionRate", "5s完播率"])),
      avgPlayRatio: normalizeRate(firstPresent(core, ["avgPlayRatio", "averagePlayRatio", "平均播放占比"])),
    },
    interactionSignals: {
      likeRate: normalizeRate(firstPresent(interaction, ["likeRate", "点赞率"])),
      commentRate: normalizeRate(firstPresent(interaction, ["commentRate", "评论率"])),
      shareRate: normalizeRate(firstPresent(interaction, ["shareRate", "分享率"])),
      favoriteRate: normalizeRate(firstPresent(interaction, ["favoriteRate", "收藏率"])),
      danmakuCount: parseChineseCount(firstPresent(interaction, ["danmakuCount", "弹幕量"])),
      notInterestedRate: normalizeRate(firstPresent(interaction, ["notInterestedRate", "不感兴趣率"])),
    },
    trafficSources,
    searchIntent: {
      before: beforeTerms,
      after: afterTerms,
    },
    audienceAsset: {
      newFollowers: parseChineseCount(firstPresent(follow, ["newFollowers", "newFollowerCount", "涨粉量"])),
      followRate: normalizeRate(firstPresent(follow, ["followRate", "涨粉率"])),
      lostFollowers: parseChineseCount(firstPresent(follow, ["lostFollowers", "unfollowCount", "脱粉量"])),
      lostFollowerRate: normalizeRate(firstPresent(follow, ["lostFollowerRate", "unfollowRate", "脱粉率"])),
      genderDistribution: asArray(audience.genderDistribution),
      ageDistribution: asArray(audience.ageDistribution),
      regionDistribution: asArray(audience.regionDistribution),
      interestDistribution: asArray(audience.interestDistribution),
      followHotWords: asArray(audience.followHotWords).map(normalizeWordRow),
    },
    commentIntent: {
      words: asArray(hotWords.words).map(normalizeWordRow).filter((item) => item.word),
    },
    negativeSignals: {
      notInterestedCount: parseChineseCount(firstPresent(follow, ["notInterestedCount", "不感兴趣量"])),
      notInterestedRate: normalizeRate(firstPresent(follow, ["notInterestedRate", "不感兴趣率"]))
        ?? normalizeRate(firstPresent(interaction, ["notInterestedRate", "不感兴趣率"])),
    },
    trendOrPlatformBoost: {
      extraTraffic: parseChineseCount(traffic.extraTraffic),
      platformBoostTraffic: parseChineseCount(traffic.platformBoostTraffic),
      recommendationShare: normalizeRate(firstPresent(
        trafficSources.find((item) => /推荐/.test(item.source)) || {},
        ["share"],
      )),
      searchShare: normalizeRate(firstPresent(
        trafficSources.find((item) => /搜索/.test(item.source)) || {},
        ["share"],
      )),
    },
  };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: normalize_douyin_tabs.cjs raw-tabs-row.json");
    process.exit(2);
  }
  const row = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(JSON.stringify(normalizeDouyinTabs(row), null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  nativeTabCompleteness,
  normalizeDouyinTabs,
  normalizeRate,
  parseChineseCount,
};
```

- [ ] **Step 4: Run the normalizer test**

Run:

```bash
node --test skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs
node --check skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs
```

Expected: PASS.

- [ ] **Step 5: Add the normalizer to package validation**

Modify `package.json` so `scripts.validate` includes:

```json
"validate": "node bin/autody.js doctor --package-only && node --check skills/douyin-analysis/scripts/audit_content_gaps.cjs && node --check skills/douyin-analysis/scripts/merge_content_outputs.cjs && node --check skills/douyin-analysis/scripts/render_lumina_report.cjs && node --check skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs && node --test skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs && node scripts/validate_chrome_extension_policy.cjs"
```

- [ ] **Step 6: Run full validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs skills/douyin-analysis/scripts/normalize_douyin_tabs.test.cjs
git commit -m "feat: normalize douyin native tab signals"
```

## Task 3: Preserve Raw Tabs And Normalized Signals During Merge

**Files:**
- Create: `skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs`
- Modify: `skills/douyin-analysis/scripts/merge_content_outputs.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add a failing merge CLI test**

Create `skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs` with this content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

test("merge preserves rawDouyinTabs and writes normalized native signals", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-merge-tabs-"));
  const worksFile = path.join(tmp, "works.json");
  const deepFile = path.join(tmp, "deep.json");
  const outDir = path.join(tmp, "out");
  writeJson(worksFile, {
    publishedWorks: [{
      index: 1,
      mid: "m1",
      publicUrl: "https://www.douyin.com/video/m1",
      publishedAt: "2026-06-07",
      itemType: "video",
      caption: "AI 内容复盘",
      plays: 1000,
      likes: 40,
      comments: 6,
      shares: 8,
      favorites: 15,
      finalTranscript: "开头讲问题，中间给方法，最后引导关注。",
      finalTranscriptStatus: "ok",
    }],
  });
  writeJson(deepFile, {
    items: [{
      index: 1,
      mid: "m1",
      fetchedAt: "2026-06-07T08:00:00.000Z",
      metrics: {
        completionRate: 0.37,
        newFollowers: 26,
      },
      rawDouyinTabs: {
        overview: {
          coreMetrics: { completionRate: "37.2%", fiveSecondCompletionRate: "64%" },
          watchTrend: [{ label: "第1小时", plays: "1000" }],
          interactionMetrics: { favoriteRate: "1.5%", shareRate: "0.8%", notInterestedRate: "0.03%" },
        },
        trafficAnalysis: {
          douyinAppSourceShare: [{ source: "推荐页", share: "72.5%" }],
          searchTermsBefore: [{ rank: 1, term: "自媒体复盘", share: "18.2%" }],
        },
        audienceAnalysis: {
          followMetrics: { newFollowers: "26", followRate: "0.42%", notInterestedCount: "3", notInterestedRate: "0.05%" },
          genderDistribution: [{ label: "女", share: "62%" }],
        },
        commentHotWords: {
          words: [{ rank: 1, word: "干货", hotness: "99" }],
        },
      },
    }],
  });

  execFileSync(process.execPath, [
    path.resolve("skills/douyin-analysis/scripts/merge_content_outputs.cjs"),
    "--works", worksFile,
    "--deep", deepFile,
    "--out", outDir,
    "--stem", "douyin_deep",
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const finalJson = JSON.parse(fs.readFileSync(path.join(outDir, "douyin_deep_works_final.json"), "utf8"));
  const work = finalJson.publishedWorks[0];
  assert.equal(work.rawDouyinTabs.trafficAnalysis.searchTermsBefore[0].term, "自媒体复盘");
  assert.equal(work.nativeTabCompleteness.status, "complete");
  assert.equal(work.retentionSignals.completionRate, 0.372);
  assert.equal(work.interactionSignals.favoriteRate, 0.015);
  assert.equal(work.trafficSources[0].source, "推荐页");
  assert.equal(work.searchIntent.before[0].term, "自媒体复盘");
  assert.equal(work.audienceAsset.newFollowers, 26);
  assert.equal(work.commentIntent.words[0].word, "干货");
});
```

- [ ] **Step 2: Run the merge test and confirm the red state**

Run:

```bash
node --test skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs
```

Expected: FAIL because `rawDouyinTabs` or normalized signal fields are missing from `douyin_deep_works_final.json`.

- [ ] **Step 3: Import the normalizer in merge**

Add this line near the top of `skills/douyin-analysis/scripts/merge_content_outputs.cjs` after the `require("path")` line:

```js
const { normalizeDouyinTabs } = require("./normalize_douyin_tabs.cjs");
```

- [ ] **Step 4: Attach raw tabs and normalized signals inside `finalWorks`**

Inside the `works.map` callback, after `const deepMetrics = deep.metrics || deep.deepMetrics || {};`, add:

```js
    const rawDouyinTabs = deep.rawDouyinTabs || normalized.rawDouyinTabs || {};
    const nativeSignals = normalizeDouyinTabs({ rawDouyinTabs });
```

In the returned object, after `deepMetricsFetchedAt`, add:

```js
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
```

- [ ] **Step 5: Include native tab columns in the final CSV**

In the `cols` array of `merge_content_outputs.cjs`, append these fields after `"commentKeywords"`:

```js
    "rawDouyinTabs", "nativeTabCompleteness", "retentionSignals", "interactionSignals",
    "trafficSources", "searchIntent", "audienceAsset", "commentIntent",
    "negativeSignals", "trendOrPlatformBoost",
```

- [ ] **Step 6: Run the merge test**

Run:

```bash
node --test skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs
```

Expected: PASS.

- [ ] **Step 7: Add the merge native-tabs test to package validation**

Modify `package.json` so `scripts.validate` includes:

```bash
node --test skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs
```

Keep it after the normalizer test.

- [ ] **Step 8: Run full validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json skills/douyin-analysis/scripts/merge_content_outputs.cjs skills/douyin-analysis/scripts/merge_content_outputs.native-tabs.test.cjs
git commit -m "feat: preserve douyin native tabs in merged outputs"
```

## Task 4: Audit Missing Native Tab Sections

**Files:**
- Create: `skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs`
- Modify: `skills/douyin-analysis/scripts/audit_content_gaps.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add a failing audit test**

Create `skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs` with this content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function runAudit(tmp, works, deep) {
  const worksFile = path.join(tmp, "works.json");
  const deepFile = path.join(tmp, "deep.json");
  const outFile = path.join(tmp, "audit.json");
  writeJson(worksFile, { publishedWorks: works });
  writeJson(deepFile, { items: deep });
  execFileSync(process.execPath, [
    path.resolve("skills/douyin-analysis/scripts/audit_content_gaps.cjs"),
    "--works", worksFile,
    "--deep", deepFile,
    "--out", outFile,
  ], { cwd: path.resolve("."), stdio: "pipe" });
  return JSON.parse(fs.readFileSync(outFile, "utf8"));
}

test("audit flags missing rawDouyinTabs sections for video works", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-audit-tabs-"));
  const result = runAudit(tmp, [{
    index: 1,
    mid: "m1",
    publicUrl: "https://www.douyin.com/video/m1",
    publishedAt: "2026-06-07",
    itemType: "video",
    durationSeconds: 90,
    caption: "内容复盘",
    plays: 100,
    likes: 4,
    comments: 1,
    shares: 1,
    favorites: 2,
    finalTranscript: "完整逐字稿",
    finalTranscriptStatus: "ok",
  }], [{
    index: 1,
    mid: "m1",
    fetchedAt: "2026-06-07T08:00:00.000Z",
    metrics: {
      avgWatchTimeSeconds: 22,
      completionRate: 0.31,
      fiveSecondRetention: 0.66,
      newFollowers: 3,
    },
    topComments: [{ text: "有用" }],
    rawDouyinTabs: {
      overview: { coreMetrics: { completionRate: "31%" } },
    },
  }]);

  assert.equal(result.summary.withGaps, 1);
  const missing = result.items[0].missing;
  assert.ok(missing.includes("rawDouyinTabs.overview.interactionMetrics"));
  assert.ok(missing.includes("rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"));
  assert.ok(missing.includes("rawDouyinTabs.audienceAnalysis.followMetrics"));
  assert.ok(missing.includes("rawDouyinTabs.commentHotWords.words"));
});

test("audit accepts complete rawDouyinTabs sections", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-audit-tabs-complete-"));
  const result = runAudit(tmp, [{
    index: 1,
    mid: "m1",
    publicUrl: "https://www.douyin.com/video/m1",
    publishedAt: "2026-06-07",
    itemType: "video",
    durationSeconds: 90,
    caption: "内容复盘",
    plays: 100,
    likes: 4,
    comments: 1,
    shares: 1,
    favorites: 2,
    finalTranscript: "完整逐字稿",
    finalTranscriptStatus: "ok",
  }], [{
    index: 1,
    mid: "m1",
    fetchedAt: "2026-06-07T08:00:00.000Z",
    metrics: {
      avgWatchTimeSeconds: 22,
      completionRate: 0.31,
      fiveSecondRetention: 0.66,
      newFollowers: 3,
    },
    topComments: [{ text: "有用" }],
    rawDouyinTabs: {
      overview: {
        coreMetrics: { completionRate: "31%" },
        interactionMetrics: { favoriteRate: "2%" },
        watchTrend: [{ label: "第1小时", plays: "100" }],
      },
      trafficAnalysis: {
        douyinAppSourceShare: [{ source: "推荐页", share: "70%" }],
        searchTermsBefore: [{ rank: 1, term: "内容复盘", share: "10%" }],
      },
      audienceAnalysis: {
        followMetrics: { newFollowers: "3", followRate: "0.3%" },
        genderDistribution: [{ label: "女", share: "60%" }],
      },
      commentHotWords: {
        words: [{ rank: 1, word: "有用", hotness: "90" }],
      },
    },
  }]);

  assert.equal(result.summary.missingCounts["rawDouyinTabs.overview.interactionMetrics"], undefined);
  assert.equal(result.summary.missingCounts["rawDouyinTabs.trafficAnalysis.douyinAppSourceShare"], undefined);
});
```

- [ ] **Step 2: Run the audit test and confirm the red state**

Run:

```bash
node --test skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs
```

Expected: FAIL because native tab gaps are not listed.

- [ ] **Step 3: Import native tab completeness in audit**

Add this line near the top of `skills/douyin-analysis/scripts/audit_content_gaps.cjs` after the `require("path")` line:

```js
const { nativeTabCompleteness } = require("./normalize_douyin_tabs.cjs");
```

- [ ] **Step 4: Audit native tab gaps for video works**

Inside the `if (work.itemType === "video")` block, after the existing `followMetric` check, add:

```js
      const rawDouyinTabs = (deep && deep.rawDouyinTabs) || work.rawDouyinTabs || {};
      const nativeTabs = nativeTabCompleteness(rawDouyinTabs);
      for (const field of nativeTabs.missingFields) missing.push(field);
```

- [ ] **Step 5: Run the audit test**

Run:

```bash
node --test skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Add the audit native-tabs test to package validation**

Modify `package.json` so `scripts.validate` includes:

```bash
node --test skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs
```

Keep it after the merge native-tabs test.

- [ ] **Step 7: Run full validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json skills/douyin-analysis/scripts/audit_content_gaps.cjs skills/douyin-analysis/scripts/audit_content_gaps.native-tabs.test.cjs
git commit -m "feat: audit douyin native tab completeness"
```

## Task 5: Build Fresh Atomic Report Analysis For `/baogao`

**Files:**
- Create: `skills/douyin-analysis/scripts/build_report_analysis.cjs`
- Create: `skills/douyin-analysis/scripts/build_report_analysis.test.cjs`
- Modify: `package.json`
- Modify: `scripts/validate_chrome_extension_policy.cjs`

- [ ] **Step 1: Add failing report analysis tests**

Create `skills/douyin-analysis/scripts/build_report_analysis.test.cjs` with this content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function runReport({ works, audit, blind, newAfter }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-report-"));
  const worksFile = path.join(tmp, "works.json");
  const auditFile = path.join(tmp, "audit.json");
  const blindFile = path.join(tmp, "blind.json");
  const outDir = path.join(tmp, "out");
  writeJson(worksFile, { publishedWorks: works });
  if (audit) writeJson(auditFile, audit);
  if (blind) writeJson(blindFile, blind);
  const args = [
    path.resolve("skills/douyin-analysis/scripts/build_report_analysis.cjs"),
    "--works", worksFile,
    "--out", outDir,
    "--date", "2026-06-07",
  ];
  if (audit) args.push("--audit", auditFile);
  if (blind) args.push("--blind", blindFile);
  if (newAfter) args.push("--new-after", newAfter);
  execFileSync(process.execPath, args, { cwd: path.resolve("."), stdio: "pipe" });
  return JSON.parse(fs.readFileSync(path.join(outDir, "douyin_incremental_analysis_2026-06-07.json"), "utf8"));
}

const baseWork = {
  index: 1,
  mid: "m1",
  publicUrl: "https://www.douyin.com/video/m1",
  publishedAt: "2026-06-01",
  itemType: "video",
  caption: "三个步骤复盘内容账号",
  plays: 1000,
  likes: 40,
  comments: 10,
  shares: 8,
  favorites: 35,
  finalTranscriptStatus: "ok",
  finalTranscript: "先问账号卖什么能力，再拆内容脚本，最后用数据复盘下一条。",
  rawDouyinTabs: {
    overview: {
      coreMetrics: { completionRate: "38%", fiveSecondCompletionRate: "70%" },
      interactionMetrics: { favoriteRate: "3.5%", shareRate: "0.8%" },
      watchTrend: [{ label: "第1小时", plays: "1000" }],
    },
    trafficAnalysis: {
      douyinAppSourceShare: [{ source: "推荐页", share: "80%" }],
      searchTermsBefore: [{ rank: 1, term: "内容复盘", share: "18%" }],
    },
    audienceAnalysis: {
      followMetrics: { newFollowers: "12", followRate: "1.2%" },
      ageDistribution: [{ label: "24-30", share: "40%" }],
    },
    commentHotWords: {
      words: [{ rank: 1, word: "干货", hotness: "90" }],
    },
  },
};

test("builds atomic report rows from current works and audit caveats", () => {
  const result = runReport({
    works: [baseWork],
    audit: {
      generatedAt: "2026-06-07T00:00:00.000Z",
      summary: { withGaps: 0, missingCounts: {}, withConflicts: 0 },
      items: [],
    },
  });
  assert.equal(result.summary.total, 1);
  assert.equal(result.items[0].dataStatus, "observed");
  assert.equal(result.items[0].contentType, "knowledge");
  assert.ok(result.items[0].accountAsset.includes("professional_authority"));
  assert.ok(result.items[0].expectedWinningMetrics.includes("favorite_rate"));
  assert.equal(result.items[0].claims[0].evidence.length > 0, true);
  assert.equal(result.adversarialAudit.length > 0, true);
});

test("marks new videos blind_score_blocked when no blind prediction exists", () => {
  const result = runReport({
    works: [{ ...baseWork, index: 2, mid: "m2", publishedAt: "2026-06-07" }],
    newAfter: "2026-06-06",
  });
  assert.equal(result.items[0].blindScoreStatus, "blind_score_blocked");
  assert.equal(result.items[0].blindPrediction, null);
});

test("carries blind prediction without editing it after metrics are visible", () => {
  const prediction = {
    blind_id: "blind-abc",
    content_type: "knowledge",
    account_asset: ["professional_authority"],
    nana_generalized_class: "follow_asset",
    expected_winning_metrics: ["favorite_rate", "follow_rate"],
    scores: {
      hook: 4,
      density: 5,
      scarcity: 3,
      usefulness: 5,
      emotional_value: 3,
      proof_strength: 4,
      follow_reason: 4,
      conversion_asset: 3,
    },
    predicted_bucket: "strong",
    one_line_reason: "结构清楚且有账号资产。",
    main_risks: ["表达太满"],
    revision_advice: "保留结构，降低术语密度。",
  };
  const result = runReport({
    works: [{ ...baseWork, index: 2, mid: "m2", publishedAt: "2026-06-07" }],
    blind: { items: [{ workKey: "mid:m2", blind_id: "blind-abc", prediction }] },
    newAfter: "2026-06-06",
  });
  assert.equal(result.items[0].blindScoreStatus, "blind_scored");
  assert.deepEqual(result.items[0].blindPrediction, prediction);
  assert.equal(result.items[0].calibration.predictedBucket, "strong");
});
```

- [ ] **Step 2: Run the report tests and confirm the red state**

Run:

```bash
node --test skills/douyin-analysis/scripts/build_report_analysis.test.cjs
```

Expected: FAIL with `Cannot find module` or missing script.

- [ ] **Step 3: Create the report analysis builder**

Create `skills/douyin-analysis/scripts/build_report_analysis.cjs` with this content:

```js
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

function number(value) {
  if (!present(value)) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function ratio(part, whole) {
  const bottom = number(whole);
  return bottom > 0 ? number(part) / bottom : 0;
}

function keyFor(work) {
  if (work.mid) return `mid:${work.mid}`;
  if (work.publicUrl) return `url:${work.publicUrl}`;
  return `index:${work.index}`;
}

function auditMap(auditData) {
  const map = new Map();
  for (const item of asArray(auditData, ["items"])) {
    if (item.index != null) map.set(`index:${item.index}`, item);
    if (item.mid) map.set(`mid:${item.mid}`, item);
    if (item.publicUrl) map.set(`url:${item.publicUrl}`, item);
  }
  return map;
}

function blindMap(blindData) {
  const map = new Map();
  for (const item of asArray(blindData, ["items", "predictions"])) {
    if (item.workKey) map.set(item.workKey, item);
  }
  return map;
}

function isOnOrAfter(dateText, boundary) {
  if (!dateText || !boundary) return false;
  const left = new Date(dateText).getTime();
  const right = new Date(boundary).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && left >= right;
}

function textFor(work) {
  return `${work.caption || ""}\n${work.finalTranscript || ""}\n${(work.hashtags || []).join(" ")}`;
}

function classifyContentType(work) {
  const text = textFor(work);
  if (work.itemType === "image" || work.itemType === "image_text") return "image_text";
  if (/故事|经历|我曾经|那天|后来|第一次|崩溃|转型/.test(text)) return "story";
  if (/过程|实操|复盘|拆解|怎么做|步骤|方法|教程|工作流/.test(text)) return "knowledge";
  if (/观点|为什么|本质|反常识|不要|必须|判断/.test(text)) return "viewpoint";
  if (/成交|客户|咨询|产品|购买|报价|转化|商业/.test(text)) return "commerce";
  return "mixed";
}

function inferAccountAsset(work, nativeSignals) {
  const text = textFor(work);
  const assets = [];
  if (/方法|步骤|教程|复盘|拆解|体系|数据|工具|工作流/.test(text)) assets.push("professional_authority");
  if (/真实|过程|我做了|案例|后台|结果|实验/.test(text)) assets.push("real_process");
  if (/你是不是|很多人|普通人|焦虑|痛点|不知道/.test(text)) assets.push("audience_resonance");
  if (/成交|客户|咨询|交付|产品|商业/.test(text)) assets.push("conversion_reason");
  if ((nativeSignals.audienceAsset.followRate || 0) > 0.005 || (nativeSignals.audienceAsset.newFollowers || 0) >= 10) {
    assets.push("follow_reason");
  }
  return Array.from(new Set(assets.length ? assets : ["social_talk_value"]));
}

function expectedMetrics(contentType, accountAsset) {
  const metrics = new Set();
  if (contentType === "knowledge") {
    metrics.add("favorite_rate");
    metrics.add("completion_rate");
  }
  if (contentType === "viewpoint") {
    metrics.add("comment_rate");
    metrics.add("share_rate");
  }
  if (contentType === "story") {
    metrics.add("follow_rate");
    metrics.add("comment_rate");
  }
  if (contentType === "commerce") {
    metrics.add("profile_visit_or_lead");
    metrics.add("follow_rate");
  }
  if (contentType === "image_text") {
    metrics.add("read_completion");
    metrics.add("favorite_rate");
  }
  if (accountAsset.includes("follow_reason")) metrics.add("follow_rate");
  return Array.from(metrics.size ? metrics : ["play_rate", "like_rate"]);
}

function nanaClass(work, nativeSignals) {
  const plays = number(work.plays);
  const favoriteRate = work.favoriteRate ?? ratio(work.favorites, plays);
  const shareRate = work.shareRate ?? ratio(work.shares, plays);
  const followRate = nativeSignals.audienceAsset.followRate || ratio(nativeSignals.audienceAsset.newFollowers, plays);
  if (favoriteRate >= 0.02 && shareRate >= 0.006 && followRate >= 0.005) return "compound_asset";
  if (followRate >= 0.005) return "follow_asset";
  if (favoriteRate >= 0.015) return "useful_but_detached";
  return "one_time_watch";
}

function dataStatus(work, auditItem, nativeSignals) {
  const missing = auditItem && Array.isArray(auditItem.missing) ? auditItem.missing : [];
  const warnings = auditItem && Array.isArray(auditItem.warnings) ? auditItem.warnings : [];
  if (work.distributionStatus && work.distributionStatus !== "observed") return "distribution_unknown";
  if ((work.metricConflicts || []).length || (auditItem && (auditItem.conflicts || []).length)) return "metric_conflict";
  if (missing.includes("verbatimTranscript") || /missing|fallback|failed|summary/i.test(`${work.finalTranscriptStatus || ""} ${work.finalTranscriptNote || ""}`)) {
    return "transcript_incomplete";
  }
  if (missing.includes("staleDeepMetrics")) return "stale_deep_metrics";
  if (warnings.includes("zero_plays_with_positive_deep_activity")) return "distribution_unknown";
  if (nativeSignals.nativeTabCompleteness.status === "incomplete") return "observed_with_native_tab_gaps";
  return "observed";
}

function actualSignal(work, nativeSignals) {
  const plays = number(work.plays);
  const favoriteRate = work.favoriteRate ?? ratio(work.favorites, plays);
  const shareRate = work.shareRate ?? ratio(work.shares, plays);
  const commentRate = work.commentRate ?? ratio(work.comments, plays);
  const followRate = nativeSignals.audienceAsset.followRate || ratio(nativeSignals.audienceAsset.newFollowers, plays);
  const signals = [];
  if (favoriteRate >= 0.02) signals.push("high favorite rate");
  if (shareRate >= 0.006) signals.push("share signal");
  if (commentRate >= 0.006) signals.push("comment signal");
  if (followRate >= 0.005) signals.push("follow signal");
  if (nativeSignals.trendOrPlatformBoost.recommendationShare >= 0.7) signals.push("recommendation-heavy distribution");
  return signals.length ? signals.join(", ") : "no strong rate signal yet";
}

function claimFor(work, contentType, accountAsset, status, nativeSignals) {
  const evidence = [
    `plays=${number(work.plays)}`,
    `favorites=${number(work.favorites)}`,
    `shares=${number(work.shares)}`,
    `newFollowers=${nativeSignals.audienceAsset.newFollowers || 0}`,
  ];
  const hotWords = nativeSignals.commentIntent.words.slice(0, 3).map((item) => item.word).filter(Boolean);
  if (hotWords.length) evidence.push(`comment_hot_words=${hotWords.join("/")}`);
  return {
    judgment: status === "observed"
      ? `${contentType} content is mainly serving ${accountAsset.join(", ")}`
      : `diagnosis is provisional because data status is ${status}`,
    evidence,
    rebuttal: "The claim may be wrong if traffic came from a short-lived trend, hidden distribution, stale metrics, or missing native tab fields.",
    confidence: status === "observed" ? "medium" : "low",
    nextValidation: "Reshoot the structure with one changed variable and compare favorite_rate, follow_rate, completion_rate, and comment intent.",
  };
}

function calibrationFor(blindPrediction, work, nativeSignals) {
  if (!blindPrediction) return null;
  return {
    predictedBucket: blindPrediction.predicted_bucket || "",
    observedSignal: actualSignal(work, nativeSignals),
    learning: "Compare the isolated script prediction with observed metrics; update future judgment only after this comparison is written.",
  };
}

function buildReport({ worksData, auditData, blindData, worksFile, auditFile, blindFile, date, newAfter }) {
  const works = asArray(worksData, ["publishedWorks", "works", "items"]);
  const audits = auditMap(auditData);
  const blinds = blindMap(blindData);
  const items = works.map((work, idx) => {
    const normalizedWork = { index: work.index || idx + 1, ...work };
    const nativeSignals = normalizeDouyinTabs(normalizedWork);
    const auditItem = audits.get(keyFor(normalizedWork)) || audits.get(`index:${normalizedWork.index}`) || null;
    const status = dataStatus(normalizedWork, auditItem, nativeSignals);
    const contentType = classifyContentType(normalizedWork);
    const accountAsset = inferAccountAsset(normalizedWork, nativeSignals);
    const blindRow = blinds.get(keyFor(normalizedWork)) || null;
    const needsBlind = isOnOrAfter(normalizedWork.publishedAt, newAfter);
    const blindPrediction = blindRow && blindRow.prediction ? blindRow.prediction : null;
    const blindScoreStatus = blindPrediction ? "blind_scored" : needsBlind ? "blind_score_blocked" : "not_required";
    return {
      index: normalizedWork.index,
      mid: normalizedWork.mid || "",
      publicUrl: normalizedWork.publicUrl || "",
      publishedAt: normalizedWork.publishedAt || "",
      title: normalizedWork.title || normalizedWork.coverTitle || normalizedWork.caption || "",
      dataStatus: status,
      contentType,
      accountAsset,
      userBait: contentType === "knowledge" ? ["useful"] : contentType === "viewpoint" ? ["interesting", "resonant"] : ["resonant"],
      nanaGeneralizedClass: nanaClass(normalizedWork, nativeSignals),
      expectedWinningMetrics: expectedMetrics(contentType, accountAsset),
      actualSignal: actualSignal(normalizedWork, nativeSignals),
      nativeTabCompleteness: nativeSignals.nativeTabCompleteness,
      blindScoreStatus,
      blindPrediction,
      observedResult: {
        plays: number(normalizedWork.plays),
        likes: number(normalizedWork.likes),
        comments: number(normalizedWork.comments),
        shares: number(normalizedWork.shares),
        favorites: number(normalizedWork.favorites),
        completionRate: nativeSignals.retentionSignals.completionRate,
        favoriteRate: normalizedWork.favoriteRate ?? ratio(normalizedWork.favorites, normalizedWork.plays),
        shareRate: normalizedWork.shareRate ?? ratio(normalizedWork.shares, normalizedWork.plays),
        followRate: nativeSignals.audienceAsset.followRate || ratio(nativeSignals.audienceAsset.newFollowers, normalizedWork.plays),
      },
      calibration: calibrationFor(blindPrediction, normalizedWork, nativeSignals),
      claims: [claimFor(normalizedWork, contentType, accountAsset, status, nativeSignals)],
    };
  });
  const dataCaveats = [];
  if (auditData && auditData.summary && number(auditData.summary.withGaps) > 0) {
    dataCaveats.push(`${auditData.summary.withGaps} works have audit gaps`);
  }
  if (items.some((item) => item.blindScoreStatus === "blind_score_blocked")) {
    dataCaveats.push("new works need isolated blind scoring before calibration");
  }
  if (items.some((item) => item.nativeTabCompleteness.status === "incomplete")) {
    dataCaveats.push("some works are missing native Douyin tab sections");
  }
  return {
    generatedAt: new Date().toISOString(),
    reportDate: date,
    sourceFiles: {
      works: worksFile ? path.resolve(worksFile) : "",
      audit: auditFile ? path.resolve(auditFile) : "",
      blind: blindFile ? path.resolve(blindFile) : "",
    },
    dataGate: {
      total: items.length,
      observed: items.filter((item) => item.dataStatus === "observed").length,
      provisional: items.filter((item) => item.dataStatus !== "observed").length,
      caveats: dataCaveats,
    },
    summary: {
      total: items.length,
      contentTypeCounts: countBy(items, "contentType"),
      nanaClassCounts: countBy(items, "nanaGeneralizedClass"),
      blindScoreCounts: countBy(items, "blindScoreStatus"),
    },
    items,
    adversarialAudit: [
      "Claims are low confidence for works with missing native tabs, stale metrics, metric conflicts, or incomplete transcripts.",
      "High play or share can be trend borrowing; repeat the same structure without the trend variable before calling it an account asset.",
      "High save without follow may be useful but detached; report recommendations should build future-output expectation.",
      "New works without isolated blind predictions are marked blind_score_blocked rather than retrospectively scored.",
    ],
  };
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function renderMarkdown(report) {
  const lines = [
    "# Douyin Incremental Analysis",
    "",
    `Generated: ${report.generatedAt}`,
    `Report date: ${report.reportDate}`,
    "",
    "## Data Gate",
    "",
    `Total: ${report.dataGate.total}`,
    `Observed: ${report.dataGate.observed}`,
    `Provisional: ${report.dataGate.provisional}`,
    "",
    "## Caveats",
    "",
    ...(report.dataGate.caveats.length ? report.dataGate.caveats.map((item) => `- ${item}`) : ["- no caveats recorded"]),
    "",
    "## Light Rows",
    "",
  ];
  for (const item of report.items) {
    lines.push(`### #${item.index} ${item.title}`);
    lines.push("");
    lines.push(`- data_status: ${item.dataStatus}`);
    lines.push(`- content_type: ${item.contentType}`);
    lines.push(`- account_asset: ${item.accountAsset.join(", ")}`);
    lines.push(`- nana_generalized_class: ${item.nanaGeneralizedClass}`);
    lines.push(`- expected_winning_metrics: ${item.expectedWinningMetrics.join(", ")}`);
    lines.push(`- actual_signal: ${item.actualSignal}`);
    lines.push(`- blind_score_status: ${item.blindScoreStatus}`);
    lines.push(`- judgment: ${item.claims[0].judgment}`);
    lines.push(`- rebuttal: ${item.claims[0].rebuttal}`);
    lines.push("");
  }
  lines.push("## Adversarial Audit");
  lines.push("");
  for (const item of report.adversarialAudit) lines.push(`- ${item}`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.works || !args.out) {
    console.error("Usage: build_report_analysis.cjs --works works.json --out output_dir [--audit audit.json] [--blind blind_predictions.json] [--new-after YYYY-MM-DD] [--date YYYY-MM-DD]");
    process.exit(2);
  }
  const date = args.date || new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const report = buildReport({
    worksData: readJson(args.works),
    auditData: readJson(args.audit),
    blindData: readJson(args.blind),
    worksFile: args.works,
    auditFile: args.audit,
    blindFile: args.blind,
    date,
    newAfter: args["new-after"] || "",
  });
  const jsonPath = path.join(outDir, `douyin_incremental_analysis_${date}.json`);
  const mdPath = path.join(outDir, `douyin_incremental_analysis_${date}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ json: jsonPath, markdown: mdPath, items: report.items.length }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { buildReport, renderMarkdown };
```

- [ ] **Step 4: Run report tests**

Run:

```bash
node --test skills/douyin-analysis/scripts/build_report_analysis.test.cjs
node --check skills/douyin-analysis/scripts/build_report_analysis.cjs
```

Expected: PASS.

- [ ] **Step 5: Add validator checks for report builder strings**

Edit `scripts/validate_chrome_extension_policy.cjs` and add:

```js
assertIncludes("skills/douyin-analysis/scripts/build_report_analysis.cjs", "blind_score_blocked");
assertIncludes("skills/douyin-analysis/scripts/build_report_analysis.cjs", "adversarialAudit");
assertIncludes("skills/douyin-analysis/scripts/build_report_analysis.cjs", "douyin_incremental_analysis_");
```

Add the script and test to `checkedFiles`:

```js
  "skills/douyin-analysis/scripts/build_report_analysis.cjs",
  "skills/douyin-analysis/scripts/build_report_analysis.test.cjs",
```

- [ ] **Step 6: Add report tests to package validation**

Modify `package.json` so `scripts.validate` includes:

```bash
node --check skills/douyin-analysis/scripts/build_report_analysis.cjs
node --test skills/douyin-analysis/scripts/build_report_analysis.test.cjs
```

Keep these before `node scripts/validate_chrome_extension_policy.cjs`.

- [ ] **Step 7: Run full validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/validate_chrome_extension_policy.cjs skills/douyin-analysis/scripts/build_report_analysis.cjs skills/douyin-analysis/scripts/build_report_analysis.test.cjs
git commit -m "feat: build fresh atomic douyin report analysis"
```

## Task 6: Carry Fresh Analysis Into Lumina HTML

**Files:**
- Modify: `skills/douyin-analysis/scripts/render_lumina_report.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add a focused Lumina analysis carry-through test**

Append this test to `skills/douyin-analysis/scripts/build_report_analysis.test.cjs`:

```js
test("lumina payload can carry report analysis fields by work index", () => {
  const { buildPayload } = require("./render_lumina_report.cjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autody-lumina-analysis-"));
  const worksFile = path.join(tmp, "works.json");
  const analysisFile = path.join(tmp, "analysis.json");
  writeJson(worksFile, { publishedWorks: [baseWork] });
  writeJson(analysisFile, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    items: [{
      index: 1,
      dataStatus: "observed",
      contentType: "knowledge",
      nanaGeneralizedClass: "follow_asset",
      blindScoreStatus: "not_required",
      expectedWinningMetrics: ["favorite_rate", "follow_rate"],
      actualSignal: "high favorite rate, follow signal",
    }],
  });
  const payload = buildPayload({ worksFile, analysisFile, auditFile: "" });
  assert.equal(payload.items[0].analysis.contentType, "knowledge");
  assert.equal(payload.items[0].analysis.nanaGeneralizedClass, "follow_asset");
  assert.equal(payload.items[0].blindScoreStatus, "not_required");
  assert.equal(payload.sourceSummary.analysisGeneratedAt, "2026-06-07T00:00:00.000Z");
});
```

- [ ] **Step 2: Run the test and confirm the red state**

Run:

```bash
node --test skills/douyin-analysis/scripts/build_report_analysis.test.cjs
```

Expected: FAIL because `render_lumina_report.cjs` reads `analysisFile` but does not merge analysis rows into payload items.

- [ ] **Step 3: Merge analysis rows in `buildPayload`**

In `skills/douyin-analysis/scripts/render_lumina_report.cjs`, add this helper before `buildPayload`:

```js
function byIndex(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row && row.index != null) map.set(Number(row.index), row);
  }
  return map;
}
```

In `buildPayload`, after `const normalized = rawWorks.map(normalizeWork);`, add:

```js
  const analysisRows = byIndex(asArray(analysisData, ["items", "works"]));
```

Replace the `items` assignment with:

```js
  const items = normalized.map((item) => {
    const analysis = analysisRows.get(item.index) || null;
    return {
      ...item,
      role: roleFor(item, boundaries),
      analysis,
      dataStatus: analysis && analysis.dataStatus || item.distributionStatus || "observed",
      contentType: analysis && analysis.contentType || item.topic || "",
      nanaGeneralizedClass: analysis && analysis.nanaGeneralizedClass || "",
      blindScoreStatus: analysis && analysis.blindScoreStatus || "not_required",
      expectedWinningMetrics: analysis && analysis.expectedWinningMetrics || [],
      actualSignal: analysis && analysis.actualSignal || "",
    };
  });
```

- [ ] **Step 4: Run the analysis carry-through test**

Run:

```bash
node --test skills/douyin-analysis/scripts/build_report_analysis.test.cjs
node --check skills/douyin-analysis/scripts/render_lumina_report.cjs
```

Expected: PASS.

- [ ] **Step 5: Run full validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skills/douyin-analysis/scripts/render_lumina_report.cjs skills/douyin-analysis/scripts/build_report_analysis.test.cjs
git commit -m "feat: carry fresh analysis into lumina payload"
```

## Task 7: Update Skill Workflows For `/kaishi`, `/gengxin`, `/tijian`, `/buchong`, `/baogao`, And `/html`

**Files:**
- Modify: `skills/douyin-analysis/SKILL.md`
- Modify: `skills/douyin-analysis/references/chrome-extension-workflow.md`
- Modify: `skills/douyin-analysis/references/douyin-workflow.md`
- Modify: `skills/douyin-analysis/references/report-agent.md`
- Modify: `skills/douyin-analysis/references/report-design.md`
- Modify: `skills/douyin-analysis/references/lumina-html-workflow.md`
- Modify: `skills/kaishi/SKILL.md`
- Modify: `skills/gengxin/SKILL.md`
- Modify: `skills/tijian/SKILL.md`
- Modify: `skills/buchong/SKILL.md`
- Modify: `skills/baogao/SKILL.md`
- Modify: `skills/html/SKILL.md`
- Modify: `scripts/validate_chrome_extension_policy.cjs`

- [ ] **Step 1: Add validator assertions for the workflow wording**

Edit `scripts/validate_chrome_extension_policy.cjs` and add:

```js
assertIncludes("skills/douyin-analysis/SKILL.md", "rawDouyinTabs");
assertIncludes("skills/douyin-analysis/references/chrome-extension-workflow.md", "official in-page export first");
assertIncludes("skills/douyin-analysis/references/douyin-workflow.md", "rawDouyinTabs");
assertIncludes("skills/douyin-analysis/references/report-agent.md", "build_report_analysis.cjs");
assertIncludes("skills/douyin-analysis/references/report-design.md", "fresh analysis payload");
assertIncludes("skills/douyin-analysis/references/lumina-html-workflow.md", "--analysis");
assertIncludes("skills/kaishi/SKILL.md", "all visible/exportable native Douyin tabs");
assertIncludes("skills/gengxin/SKILL.md", "new and stale native Douyin tab data");
assertIncludes("skills/tijian/SKILL.md", "native Douyin tab completeness");
assertIncludes("skills/buchong/SKILL.md", "Start from the latest /tijian or audit output");
assertIncludes("skills/baogao/SKILL.md", "build_report_analysis.cjs");
assertIncludes("skills/html/SKILL.md", "blindScoreStatus");
```

- [ ] **Step 2: Run validation and confirm the red state**

Run:

```bash
npm test
```

Expected: FAIL on the first missing new workflow phrase.

- [ ] **Step 3: Update the base skill collection requirements**

In `skills/douyin-analysis/SKILL.md`, replace the existing required/deep fields paragraph in workflow step 2 with:

```markdown
   - Required bottom-ledger fields for every work: `index`, `mid`, `publicUrl`, `publishedAt`, `status`, `itemType`, `durationSeconds`, `caption`, cover/title text when visible, `plays`, `likes`, `comments`, `shares`, `favorites`, `finalTranscript`, `finalTranscriptStatus`, `dataSource`, and `fetchedAt`.
   - Native creator-detail tabs must be saved raw-first under `rawDouyinTabs`: `overview`, `trafficAnalysis`, `audienceAnalysis`, and `commentHotWords`.
   - For each tab, collect all visible/exportable metrics, tables, ranked words, search terms, traffic-source rows, audience distributions, retention labels, follow metrics, and comparison labels. If Douyin does not expose the value through export or visible DOM, record `dataGap` with the section name.
```

Add `references/douyin-native-tabs.md` to the References section:

```markdown
Read `references/douyin-native-tabs.md` before collecting, auditing, merging, or explaining native Douyin creator-detail tab data.
```

- [ ] **Step 4: Update Chrome Extension workflow wording**

In `skills/douyin-analysis/references/chrome-extension-workflow.md`, add a section titled `## Native Detail Tabs` with:

```markdown
## Native Detail Tabs

Use official in-page export first when Douyin provides export/download controls. If export is not available, capture visible DOM text, visible table rows, chart labels, ranked words, and section labels from the normal creator-center page.

For each work-detail page, inspect and persist:

- `总览` as `rawDouyinTabs.overview`
- `流量分析` as `rawDouyinTabs.trafficAnalysis`
- `观众分析` as `rawDouyinTabs.audienceAnalysis`
- `评论热词` as `rawDouyinTabs.commentHotWords`

Do not stop at the top-line work list metrics. If a tab exists but a chart does not expose numeric values, save the visible labels and a `dataGap` entry instead of guessing.
```

- [ ] **Step 5: Update Douyin workflow schema**

In `skills/douyin-analysis/references/douyin-workflow.md`, add:

```markdown
## Native Tab Schema

Autody final work rows may include:

```json
{
  "rawDouyinTabs": {
    "overview": {},
    "trafficAnalysis": {},
    "audienceAnalysis": {},
    "commentHotWords": {}
  },
  "nativeTabCompleteness": {},
  "retentionSignals": {},
  "interactionSignals": {},
  "trafficSources": [],
  "searchIntent": {},
  "audienceAsset": {},
  "commentIntent": {},
  "negativeSignals": {},
  "trendOrPlatformBoost": {}
}
```

`rawDouyinTabs` is evidence. The normalized fields are derived signals for audit, report, and HTML.
```

- [ ] **Step 6: Update report-agent workflow**

In `skills/douyin-analysis/references/report-agent.md`, add this subsection under Required Inputs:

```markdown
## Local Report Builder

When `/baogao` needs a structured output, run:

```bash
node ~/.codex/skills/douyin-analysis/scripts/build_report_analysis.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_deep_works_final.json \
  --audit outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json \
  --blind outputs/douyin_analysis_YYYY-MM-DD/blind_predictions.json \
  --new-after YYYY-MM-DD \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --date YYYY-MM-DD
```

The script creates the fresh analysis payload. The report writer may expand the prose, but it must not replace `blindPrediction`, `blindScoreStatus`, observed metrics, data gate, or adversarial audit with stale conclusions.
```

- [ ] **Step 7: Update report design and Lumina workflow**

In `skills/douyin-analysis/references/report-design.md`, add:

```markdown
Lumina should consume the fresh analysis payload from `douyin_incremental_analysis_YYYY-MM-DD.json` when present. Visual elements may stay stable, but conclusions, sample labels, caveats, blind-score status, and next-batch recommendations come from the current payload.
```

In `skills/douyin-analysis/references/lumina-html-workflow.md`, update the render command to:

```bash
node ~/.codex/skills/douyin-analysis/scripts/render_lumina_report.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_deep_works_final.json \
  --analysis outputs/douyin_analysis_YYYY-MM-DD/douyin_incremental_analysis_YYYY-MM-DD.json \
  --audit outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json \
  --out outputs/douyin_analysis_YYYY-MM-DD
```

Add:

```markdown
Carry `blindScoreStatus`, `blindPrediction`, `observedResult`, `calibration`, `dataStatus`, and native tab caveats through to `report_lumina_payload.json`. Rendering must not create retrospective blind scores.
```

- [ ] **Step 8: Update command skill boundaries**

In `skills/kaishi/SKILL.md`, add to Completion Boundary:

```markdown
Collected all visible/exportable native Douyin tabs for every work: `overview`, `trafficAnalysis`, `audienceAnalysis`, and `commentHotWords`.
```

In `skills/gengxin/SKILL.md`, add to Completion Boundary:

```markdown
Refreshed new and stale native Douyin tab data for works selected by recency, audit gaps, or user scope.
```

In `skills/tijian/SKILL.md`, add to Completion Boundary:

```markdown
Summarized native Douyin tab completeness and listed missing `rawDouyinTabs.*` sections by item.
```

In `skills/buchong/SKILL.md`, add after the opening description:

```markdown
Start from the latest /tijian or audit output. Do not make the user manually decide every backfill field when the audit already names the missing native tab sections.
```

In `skills/baogao/SKILL.md`, add to Commands:

```bash
node ~/.codex/skills/douyin-analysis/scripts/build_report_analysis.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_deep_works_final.json \
  --audit outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json \
  --blind outputs/douyin_analysis_YYYY-MM-DD/blind_predictions.json \
  --new-after YYYY-MM-DD \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --date YYYY-MM-DD
```

In `skills/html/SKILL.md`, update the render command to pass `--analysis` and add:

```markdown
The HTML payload must preserve `blindScoreStatus`. If it is `blind_score_blocked`, show that state rather than inventing a blind prediction.
```

- [ ] **Step 9: Run validation**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/validate_chrome_extension_policy.cjs skills/douyin-analysis/SKILL.md skills/douyin-analysis/references/chrome-extension-workflow.md skills/douyin-analysis/references/douyin-workflow.md skills/douyin-analysis/references/report-agent.md skills/douyin-analysis/references/report-design.md skills/douyin-analysis/references/lumina-html-workflow.md skills/kaishi/SKILL.md skills/gengxin/SKILL.md skills/tijian/SKILL.md skills/buchong/SKILL.md skills/baogao/SKILL.md skills/html/SKILL.md
git commit -m "docs: align autody commands with native tab report workflow"
```

## Task 8: End-To-End QA, Package Check, And GitHub Update

**Files:**
- Modify only files changed by Tasks 1-7.

- [ ] **Step 1: Inspect dirty files before final QA**

Run:

```bash
git status --short
```

Expected: no unstaged changes from completed tasks. If unrelated user changes remain, leave them unstaged and mention them in the final status.

- [ ] **Step 2: Run full validation**

Run:

```bash
npm test
```

Expected:

```text
Chrome Extension-only policy: ok
```

and all `node --test` suites pass.

- [ ] **Step 3: Run package dry run**

Run:

```bash
npm run pack:dry
```

Expected: dry-run package listing includes:

```text
skills/douyin-analysis/references/douyin-native-tabs.md
skills/douyin-analysis/scripts/normalize_douyin_tabs.cjs
skills/douyin-analysis/scripts/build_report_analysis.cjs
```

- [ ] **Step 4: Run adversarial local review**

Run:

```bash
rg -n "Playwright|playwright|douyin-session|\\.auth|crawler\\.py|backfill\\.py|requirements\\.txt" .
rg -n "blind_score_blocked|rawDouyinTabs|build_report_analysis|official in-page export first" skills scripts package.json
```

Expected:

- First command has no forbidden old collector references outside generated package metadata, if any.
- Second command finds the new workflow and report strings in the intended docs and scripts.

- [ ] **Step 5: Commit any remaining intended edits**

If Tasks 1-7 left intended changes unstaged, stage only those files:

```bash
git add package.json scripts/validate_chrome_extension_policy.cjs skills/douyin-analysis skills/kaishi skills/gengxin skills/tijian skills/buchong skills/baogao skills/html
git commit -m "chore: validate native tab report workflow"
```

If there are no remaining intended edits, skip this commit.

- [ ] **Step 6: Push the branch**

Run:

```bash
git branch --show-current
git push origin HEAD
```

Expected: branch `codex/chrome-extension-only-collector` pushes successfully to `kizzhang/autody`.

- [ ] **Step 7: Final implementation report**

Report these items to the user:

```text
已完成：
- native tabs 原始底账：rawDouyinTabs.overview / trafficAnalysis / audienceAnalysis / commentHotWords
- merge normalized signals：retentionSignals / interactionSignals / trafficSources / searchIntent / audienceAsset / commentIntent
- tijian audit：缺哪个 rawDouyinTabs section 直接列出来
- baogao payload：重新从最新数据生成 douyin_incremental_analysis_YYYY-MM-DD.json/md
- 新视频 blind scoring：有盲评就 carry，没有就 blind_score_blocked
- html：Lumina 读取 fresh analysis payload，不复用旧结论

验证：
- npm test
- npm run pack:dry
- adversarial rg scan

GitHub：
- pushed branch codex/chrome-extension-only-collector
```

