# Douyin Workflow Reference

Default browser path: Chrome Extension collection path. Use the user's existing Chrome session through the Codex Chrome Extension / Chrome plugin for creator-center pages. If a field is not visible or exportable through Chrome, record a `dataGap` note instead of using a second browser collector.

## Output Files

Use one output folder per run:

```text
outputs/douyin_analysis_YYYY-MM-DD/
```

Recommended files:

```text
douyin_works_final.json
transcript_progress.json
deep_metrics_progress.json
content_gap_audit.json
douyin_deep_works_final.json
douyin_deep_works_final.csv
douyin_deep_transcripts_final.md
```

## Work Record

```json
{
  "index": 1,
  "publishedAt": "2026年05月25日 07:21",
  "status": "已发布",
  "itemType": "video",
  "durationSeconds": 254,
  "caption": "...",
  "mid": "7000000000000000001",
  "publicUrl": "https://www.douyin.com/video/7000000000000000001",
  "plays": 1325,
  "likes": 34,
  "comments": 10,
  "shares": 1,
  "favorites": 10,
  "finalTranscriptSource": "doubao",
  "finalTranscriptStatus": "ok",
  "finalTranscript": "..."
}
```

## Deep Metrics Record

```json
{
  "index": 1,
  "mid": "7000000000000000001",
  "status": "ok",
  "metrics": {
    "avgWatchTimeSeconds": 21.7,
    "completionRate": 0.041,
    "fiveSecondRetention": 0.427,
    "newFollowers": "7",
    "lostFollowers": "0",
    "profileVisits": "56",
    "coverClickRate": 0.552,
    "favorites": "15",
    "shares": "2",
    "likes": "53",
    "comments": "13"
  },
  "topComments": [
    {
      "text": "评论正文",
      "diggCount": 12,
      "replyCount": 1,
      "userName": "nickname",
      "ipLabel": "广东"
    }
  ],
  "raw": {
    "detailUrls": []
  }
}
```

## Native Tab Schema

Persist raw tab evidence and normalized report signals on each work when Douyin exposes them:

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

## Completion Rules

A published work is complete when it has:

```text
mid, publicUrl, publishedAt, caption, itemType
plays, likes, comments, shares, favorites
finalTranscript and source/status
topComments
deep metrics: avgWatchTime, completionRate, short retention metric, and follow/lost-follow metric when exposed by Douyin
```

For Douyin creator center, current detail pages often expose 5-second retention as `completion_rate_5s` rather than a literal 3-second retention field.

## Browser Collection Order

1. Chrome Extension: claim or open `https://creator.douyin.com/creator-micro/content/manage`.
2. Chrome Extension: collect visible works list fields or official creator-center exports.
3. Chrome Extension: open each `https://creator.douyin.com/creator-micro/data/stats/video/<aweme_id>` analytics page and read visible deep metrics.
4. Chrome Extension: collect Top comments from creator-center comment management or the public video page.
5. Audit gaps.
6. Keep unavailable fields in `dataGap` with source notes so later runs can retry through Chrome.

When mixing sources, preserve provenance with values such as `chrome-extension`, `doubao`, `public_page_text`, or `local_asr`.

## Human-Paced Browser Rule

Treat Douyin creator center and Doubao like normal manual work. Process one work at a time, wait for the visible page or model response to settle, save progress, then continue. Do not open many work-detail pages at once, rapidly submit many Doubao prompts, or repeat mechanical coordinate clicks.

During an authorized run, complete visible login, QR, CAPTCHA, or permission checks through the normal page UI and record `manualVerificationStatus`. Do not bypass platform checks, inspect cookies, or read hidden session state.

## Doubao Prompts

Reuse one normal Doubao conversation when it is clean. Send one public URL or visible text payload, wait, then send one of:

```text
不要总结。请基于刚才这个抖音视频，输出完整口播逐字稿/transcript，尽量逐句还原原话；只输出 transcript 正文。
```

```text
不要总结。请基于刚才这个抖音图文，提取图文里所有可见文字和文案正文；只输出正文。
```

Save the transcript to `transcript_progress.json` before sending the next item. Open a new Doubao chat only when the current conversation is polluted, stuck, or explicitly fails.

## Safety

Do not analyze unauthorized accounts or private data. Do not inspect, export, or commit `.cheat-cache/`, cookies, browser storage, or private raw dumps.
