# Douyin Workflow Reference

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

## Doubao Prompts

First send only the public URL. Then send one of:

```text
不要总结。请基于刚才这个抖音视频，输出完整口播逐字稿/transcript，尽量逐句还原原话；只输出 transcript 正文。
```

```text
不要总结。请基于刚才这个抖音图文，提取图文里所有可见文字和文案正文；只输出正文。
```

Close that Doubao page/chat after each saved item.

## Safety

Do not analyze unauthorized accounts or private data. Do not inspect, export, or commit `.auth/`, `.cheat-cache/`, cookies, browser storage, or private raw dumps.
