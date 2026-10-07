---
name: xiaohongshu-analysis
description: Extract the user's own or authorized Xiaohongshu note content through the homepage Diandian AI, reconcile it with visible note metadata, and export a source-labelled content ledger. Use for Xiaohongshu or xhslink note links and video transcript requests, not Douyin creator analytics.
---

# Xiaohongshu / 小红书点点提取

Use Chrome Extension-first in the existing logged-in browser. Open the homepage sidebar's **点点 ai** (`https://www.xiaohongshu.com/ai_chat`) and submit one authorized note link at a time. Work from supplied links, or the signed-in account's own visible notes when a demonstration is requested. A signed-in session is not permission to read unrelated accounts' private dashboards. Do not inspect cookies, browser storage, hidden responses, or credentials.

## Collect and verify

1. Open the note normally. Save its visible title, author, caption, note ID, type, duration, date label, canonical public URL and visible metric labels. A date labelled “编辑于” is an edited date, not a publication date. Preserve abbreviated counts such as `1万` as text; do not present them as exact counts. Unavailable metrics are `null`, not zero.
2. Use the current Diandian/点点 conversation or open its visible homepage link. Send only the public note link and extraction instructions. Do not send private dashboards or raw account exports. Use the prompt in [references/diandian-workflow.md](references/diandian-workflow.md).
3. Wait until the reply finishes; save it before another request. The unlabeled button beside the input may be the **+ attachment menu**, not Send. Use the focused input's Enter key or the visible send arrow after checking the current UI. Verify a submitted user-message bubble and a response, not merely text in the editor.
4. Compare returned title, author and caption with the source page. Keep AI text separately; source-page values win for metadata. Do not trust the assistant's own “ASR” or “完整” claim as proof of exact transcription. If it omits sections or joins unrelated sentences, make one focused follow-up naming the gap, preserve both replies, and retain an unverified or partial status if still unresolved.
5. Save `xiaohongshu_works.json`, a UTF-8 `xiaohongshu_works.csv` summary, readable text under `transcripts/`, and screenshots/raw replies under `evidence/`. Default to `outputs/xiaohongshu_analysis_YYYY-MM-DD/` under the user's working directory, honoring any workspace archival conventions or requested destination. Keep personal evidence outside the distributable skill/source package. Record the source and retrieval time, both extraction attempts and remaining gaps. Continue from saved progress instead of resubmitting successful notes.

Use the schema and status rules in [references/diandian-workflow.md](references/diandian-workflow.md). For a video, default to `ai_extracted_unverified` after a plausible reply; use `partial` when definite gaps remain, `unavailable` when no transcript is returned, and `verified` only after comparison against the complete original audio/subtitles. For image notes, separate caption from image text, mark untested/unread pages, and never call a caption a video transcript.

## Scope and limits

- Ask for human action only for an actual verification/login blocker; save the progress and exact blocker first. Do not repeatedly submit after CAPTCHA or rate limiting.
- This route extracts content and publicly visible note metrics. It does not establish access to plays, retention, completion, reach or private creator analytics. Collect those only through a separately authorized, visible official interface and label their source.
- Xiaohongshu outputs use `platform: "xiaohongshu"` and `noteId`. Do not feed them to the Douyin-specific `/kaishi`, audit, merge, scoring or Lumina report scripts: their metric assumptions have not been adapted.
- The 2026-10-07 validation covered one 6:30 video note in Windows Chrome and two Diandian turns. Link submission and transcript-candidate retrieval worked. First-turn caption/transcript omissions were observed; the second reply remained unverified. Image OCR, multiple-item runs, private analytics and full verbatim accuracy were not validated.
