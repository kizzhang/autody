# 点点工作流与数据口径

## 首轮提示词

```text
请读取这条小红书笔记：<公开笔记链接>
分别列出标题、作者、笔记正文。如果是视频，只提取从开场到结尾的口播原文，保留重复、转折与具体例子，不要总结、缩写或补写。读不到的片段标注[缺失]；无法确认完整时写“未验证完整”。如果是图文，逐页提取可读文字并标注页码。不要把评论或其他笔记拼进原文。
```

在实际页面确认链接属于目标作品。链接失效时返回原笔记使用官方分享控件取得链接；不要自行制造访问参数。日常文件保存规范化公开 URL；若正常访问需要分享参数，将带参链接仅保留在本地进度中，不写入通用示例。

## 针对缺段的追问

```text
请重新读取同一链接的视频，只输出完整口播原文。上一条在“<缺段前的原句>”与“<缺段后的原句>”之间出现断句，请补全实际听到的内容；读不到标注[缺失]，不要推测，不能确认完整就写“未验证完整”。
```

首轮在正文和口播之间混入说明、标题缺失或段落被压缩，不等于原笔记没有这些内容。原页面仍为标题、作者、正文和互动数的来源。第二轮不得覆盖第一轮证据；分别保存。

## 建议 JSON

```json
{
  "platform": "xiaohongshu",
  "noteId": "<note-id>",
  "publicUrl": "<visible-public-url>",
  "fetchedAt": "<ISO-8601-with-timezone>",
  "title": "<source-page-title>",
  "author": "<source-page-author>",
  "caption": "<source-page-caption>",
  "itemType": "video",
  "durationSeconds": null,
  "publishedAt": null,
  "dateLabel": "<unaltered-visible-date-label>",
  "metrics": {
    "likes": null,
    "likesText": null,
    "favorites": null,
    "favoritesText": null,
    "comments": null,
    "commentsText": null,
    "plays": null,
    "playsText": null,
    "shares": null,
    "sharesText": null
  },
  "transcript": {
    "text": "<AI-extracted-candidate>",
    "status": "ai_extracted_unverified",
    "provider": "xiaohongshu_diandian",
    "conversationUrl": "<local-evidence-only>",
    "attemptFiles": [],
    "verification": "Not compared with the complete original audio/subtitles."
  },
  "provenance": {
    "metadata": "visible_note_page",
    "metrics": "visible_note_page",
    "transcript": "diandian_visible_response"
  },
  "dataGaps": []
}
```

CSV contains identifiers, URL, title, type, visible counts and transcript status; the full transcript lives in JSON and text. Use UTF-8 with BOM if Excel compatibility is needed. JSON uses ordinary UTF-8. On an incomplete extraction, populate `dataGaps` and leave missing fields null. Never derive play counts or engagement rates from unrelated public counts.

Keep each original count label in its `*Text` field. Set the corresponding numeric field only when the visible value is exact; `1万` is an abbreviated label, not evidence of exactly 10000. For image-only notes, use a null transcript with `status: "not_applicable"`; keep any attempted image text in a separate `imageText` array with page number, source and verification status. Image OCR is not part of the validated video path.

Report success at the level actually observed: “链接已提交，点点返回口播候选稿，已保存并核对页面元数据”。Do not claim full text accuracy, successful bulk collection, or creator-backend access based on this single-note workflow.
