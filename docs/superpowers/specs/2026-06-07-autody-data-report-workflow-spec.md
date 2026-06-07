# Autody Data And Report Workflow Spec

Date: 2026-06-07
Status: Draft

## Core Answer

Autody does not use Playwright.

Autody uses the Codex Chrome Extension / Chrome plugin to work inside the user's already logged-in Chrome session. It reads only Douyin creator-center data that is visible on the page or available through official in-page export controls.

Autody must not inspect cookies, localStorage, sessionStorage, passwords, Chrome profile files, session stores, or private browser dumps.

## Product Goal

Autody should be a repeatable creator workflow:

1. Build a complete data ledger for the user's own authorized Douyin account.
2. Keep the ledger fresh with normal updates.
3. Audit the ledger locally before analysis.
4. Backfill only audited gaps.
5. Generate reports from the latest data, not from old conclusions.
6. Render Lumina HTML from the fresh report payload.

The user should not have to manually decide every missing field. `/tijian` tells Autody what is missing; `/buchong` fixes those named gaps.

## Command Model

### `/kaishi`

First baseline.

Use when the account has not been fully archived by Autody yet.

Responsibilities:

- Create or reuse `outputs/douyin_analysis_YYYY-MM-DD/`.
- Collect the full work list.
- Collect all visible/exportable native Douyin work-detail tabs for every work.
- Extract transcripts or image-text body.
- Collect visible comments and comment hot words.
- Save progress after every item.
- Run audit.
- Run merge.
- Produce the baseline JSON/CSV/Markdown files.

Out of scope:

- Strategy report.
- HTML report.
- New-video prediction.

### `/gengxin`

Normal update.

Use when a baseline already exists and the user wants latest works or refreshed metrics.

Responsibilities:

- Find new works since the selected baseline.
- Refresh stale metrics for recent or user-selected works.
- Refresh stale or missing native tab sections.
- Preserve good existing transcripts and raw tab data unless newer data is collected.
- Run audit and merge again.

`/gengxin` is for normal ongoing data freshness. It is not the same as `/buchong`.

### `/tijian`

Local audit.

Use before report generation or when the user asks "现在数据缺什么".

Responsibilities:

- Read the latest run folder.
- Check required bottom-ledger fields.
- Check transcript status.
- Check metric conflicts and stale deep metrics.
- Check raw native tab completeness.
- Write `content_gap_audit.json`.
- Summarize exactly what is missing.

Out of scope:

- No Chrome.
- No Doubao.
- No data collection.
- No report conclusions.

### `/buchong`

Audit-driven backfill.

Use only when `/tijian` or an audit file names missing or stale fields.

Responsibilities:

- Read `content_gap_audit.json`.
- Open Chrome only for the listed gaps.
- Fill missing native tab sections, comments, metrics, or transcripts.
- Preserve existing good data.
- Run audit and merge again.

`/buchong` should not be something the user manually repeats every time. If `/tijian` finds gaps, `/buchong` follows the audit.

### `/baogao`

Fresh report analysis.

Use when the user wants diagnosis, factor analysis, sample review, or next-batch suggestions.

Responsibilities:

- Read latest `douyin_deep_works_final.json`.
- Read latest `content_gap_audit.json`.
- Recompute all conclusions from current data.
- Data-gate every work before judging it.
- Blind-score new videos before using their observed data, when isolated scoring is available.
- Write fresh report JSON and Markdown.
- End with adversarial audit.

Out of scope:

- No Chrome.
- No Doubao.
- No backfill.
- No HTML rendering.

### `/html`

Lumina rendering.

Use when the user wants the report as HTML.

Responsibilities:

- Read latest works data.
- Read latest report analysis payload when present.
- Build fresh `report_lumina_payload.json`.
- Render `report_lumina.html` using Lumina visual system.
- Preserve blind-score status and data caveats.

Out of scope:

- No browser collection.
- No new strategic conclusion copied from old HTML.
- No three-template picker.

## Data Acquisition Spec

### Browser Path

Autody uses this path:

1. Claim an existing Chrome tab on `creator.douyin.com` when available.
2. Otherwise open creator center in the user's normal Chrome.
3. If login, QR scan, CAPTCHA, or permission appears, stop and ask the user to complete it.
4. Read page-visible creator-center data through Chrome Extension.
5. Prefer official in-page export/download controls when available.
6. If export is unavailable, read visible DOM text, table rows, ranked lists, labels, and chart values that are visible.
7. If a chart exists but numeric values are not readable, record `dataGap` instead of guessing.

Forbidden collection paths:

- Playwright.
- A second browser profile.
- Cookie inspection.
- localStorage/sessionStorage inspection.
- Password/session-store inspection.
- Raw private browser dumps.
- Hidden network payload scraping that is not exposed through normal visible page controls.

### Progress Rule

Every item-level collection step must persist progress immediately.

Minimum progress files:

- `douyin_works_progress.json`
- `deep_metrics_progress.json`
- `transcript_progress.json`

Final merged files:

- `douyin_deep_works_final.json`
- `douyin_deep_works_final.csv`
- `douyin_deep_transcripts_final.md`
- `content_gap_audit.json`

## Required Work Ledger Fields

Every work should have:

- `index`
- `mid`
- `publicUrl`
- `publishedAt`
- `status`
- `itemType`
- `durationSeconds`
- `caption`
- `coverTitle`
- `hashtags`
- `plays`
- `likes`
- `comments`
- `shares`
- `favorites`
- `finalTranscript`
- `finalTranscriptStatus`
- `finalTranscriptSource`
- `dataSource`
- `fetchedAt`

If a field is not visible/exportable, store a `dataGap` entry with where Autody looked and why it could not read the value.

## Native Douyin Tabs To Capture

Autody must collect all visible/exportable data from these work-detail tabs:

- `总览`
- `流量分析`
- `观众分析`
- `评论热词`

Raw tab data is stored under:

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

### `总览`

Capture visible/exportable fields including:

- 完播率
- 平均播放时长
- 2s 跳出率
- 5s 完播率
- 平均播放占比
- 观看趋势
- 留存分析
- 跳出分析
- 点赞率
- 评论率
- 分享率
- 收藏率
- 弹幕量
- 不感兴趣率
- 弹幕分析

### `流量分析`

Capture visible/exportable fields including:

- 抖音 App 来源占比
- 推荐页来源占比
- 个人主页来源占比
- 搜索来源占比
- 消息页来源占比
- 其他来源占比
- 对比 7 日
- 其他 App 来源占比
- 额外流量
- 平台扶持流量
- 用户通过哪些词看到作品
- 用户看完作品后常搜的词

### `观众分析`

Capture visible/exportable fields including:

- 涨粉量
- 涨粉率
- 脱粉量
- 脱粉率
- 不感兴趣量
- 不感兴趣率
- 涨粉量趋势
- 性别分布
- 年龄分布
- 地域分布
- 受众兴趣分布
- 受众关注热词

### `评论热词`

Capture visible/exportable fields including:

- 所有可见排名热词
- 左右两列都要拿
- 排名
- 热词
- 热度或占比，如果页面显示

## Transcript Spec

Transcript extraction is separate from Douyin creator-center metrics.

Preferred path:

1. Open one fresh Doubao page/chat per work.
2. Send the public URL or relevant visible text.
3. Ask for verbatim transcript or image-text body extraction.
4. Save the result with source/status.
5. Close that Doubao page/chat before the next item.

Do not keep one long Doubao chat open across many works.

Transcript statuses:

- `ok`
- `missing`
- `fallback_page_text`
- `fallback_summary`
- `failed_private_or_deleted`
- `failed_no_asr`

Report analysis may deeply judge scripts only when transcript status is usable.

## Normalized Signals

Merge keeps raw data and derives report-friendly signals.

Derived fields:

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

Rules:

- Raw tab data is evidence.
- Normalized signals are convenience fields.
- Reports should cite raw evidence when making important claims.
- Missing raw sections make report conclusions provisional.

## Report Workflow Spec

`/baogao` does not collect data. It reads the latest run folder and recomputes.

### Step 1: Source Lock

Pick one run folder and one data timestamp.

Preferred inputs:

- `douyin_deep_works_final.json`
- `content_gap_audit.json`
- `blind_predictions.json`, when new-video blind scoring exists

Do not mix old report conclusions into the current report.

### Step 2: Data Gate

Each work gets a data status before judgment:

- `observed`
- `distribution_unknown`
- `metric_conflict`
- `transcript_incomplete`
- `stale_deep_metrics`
- `native_tab_incomplete`

Only `observed` works can be used for confident performance attribution.

Unknown or incomplete works can be used for script diagnosis only when transcript is usable.

### Step 3: Light Row For Every Work

Every work gets a light row:

```json
{
  "index": 1,
  "dataStatus": "observed",
  "contentType": "knowledge",
  "accountAsset": ["professional_authority"],
  "userBait": ["useful"],
  "expectedWinningMetrics": ["favorite_rate", "follow_rate"],
  "actualSignal": "high favorite rate, weak follow rate",
  "confidence": "medium"
}
```

This is a classification row, not a long essay.

### Step 4: Deep Card For Key Works

Deep diagnosis is only for:

- top performers
- new works
- anomalies
- weak samples that explain a failure mode
- representative samples of a content type
- videos tied to next-batch strategy

Deep card:

```json
{
  "index": 1,
  "scriptStructure": "hook -> promise -> proof -> steps -> next action",
  "accountAssetServed": ["professional_authority"],
  "explosiveElements": ["cost", "contrast", "specific audience"],
  "judgment": "...",
  "evidence": ["..."],
  "rebuttal": "...",
  "nextAction": "reshoot the structure with a new variable",
  "validationMetric": "favorite_rate and follow_rate"
}
```

### Step 5: Three-Lens Analysis

Use three lenses.

Xuehui lens:

- This video serves what account asset?
- Which transaction or trust reason does it build?
- Is it viewpoint, process, knowledge, story, commerce, image-text, or mixed?
- Which metric should judge it?
- What structure should be reshot?

Nana-generalized lens:

- Is this only good to watch once?
- Is it useful but creator-replaceable?
- Does it create a future reason to follow?
- Is it a compound asset: useful, scarce, emotionally resonant, and tied to creator authority?

CoC lens:

- What would we have predicted from script alone?
- What does observed data prove?
- What is the strongest rebuttal?
- What should the next validation test?

### Step 6: Blind Scoring For New Videos

New videos must be blind-scored before observed metrics are used, when isolated scoring is available.

Blind scorer receives only:

```json
{
  "blind_id": "opaque-id",
  "title": "title or cover title",
  "script": "full transcript or script text"
}
```

Blind scorer must not receive:

- plays
- likes
- comments
- shares
- favorites
- follows
- retention
- watch time
- publish time
- URL
- index
- comments
- account history
- old report conclusions

If isolated blind scoring is unavailable, mark:

```json
{
  "blindScoreStatus": "blind_score_blocked"
}
```

Do not create retrospective blind scores after seeing data.

### Step 7: Account Diagnosis

Recompute account-level conclusions from current data:

- content mix
- account assets being built
- strongest repeatable structures
- one-time attention samples
- follow assets
- useful-but-detached samples
- trend-borrowing samples
- missing proof or trust
- missing conversion reason
- weak openings
- weak density
- weak follow reason

### Step 8: Next Batch

Each recommendation must include:

- format
- hypothesis
- target metric
- failure threshold
- what to repeat if it wins
- what to change if it loses

Do not recommend copying only a title. Recommend reshooting a structure.

### Step 9: Adversarial Audit

Every report ends with:

- Which conclusions are low confidence?
- Which videos are excluded from performance attribution?
- Which wins may be trend borrowing?
- Which high-performing works may not create account assets?
- Which missing fields would most change the conclusion?

## Output Files

Baseline outputs:

- `douyin_deep_works_final.json`
- `douyin_deep_works_final.csv`
- `douyin_deep_transcripts_final.md`
- `content_gap_audit.json`

Report outputs:

- `douyin_incremental_analysis_YYYY-MM-DD.json`
- `douyin_incremental_analysis_YYYY-MM-DD.md`

HTML outputs:

- `report_lumina_payload.json`
- `report_lumina.html`

## Acceptance Criteria

Autody is acceptable when:

- No Playwright workflow remains.
- `/kaishi` and `/gengxin` collect all visible/exportable native tab data.
- `/tijian` can say exactly which raw tab sections are missing.
- `/buchong` uses audit results instead of asking the user to manually repeat every gap.
- `/baogao` recomputes from the latest run folder.
- New videos are blind-scored before metrics, or explicitly marked `blind_score_blocked`.
- `/html` renders Lumina from a fresh payload and does not reuse old conclusions.

