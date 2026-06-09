---
name: douyin-analysis
description: Use when analyzing the user's own Douyin creator account or authorized Douyin videos, collecting creator-center metrics, Top comments, transcripts, retention/follow data, generating creator report dashboards, or incrementally backfilling missing fields into JSON/CSV/Markdown/HTML outputs.
---

# Douyin Analysis

Use this skill only for the user's own Douyin creator account, their own videos, or creator data they are explicitly authorized to manage. If the task involves another person's account, private dashboard, or unauthorized data, do not proceed.

This skill is Chrome Extension-first. Use the Codex Chrome Extension / Chrome plugin to work inside the user's already logged-in Chrome session. Do not start a separate browser profile or use a second browser collector. If Chrome pages do not expose a required field, record a `dataGap` note instead of guessing.

Do not inspect browser cookies, localStorage, passwords, or session stores. The Chrome Extension path should claim or open normal Chrome tabs, read visible creator-center pages, use official in-page exports when available, and save only creator metrics/transcripts/comments that the user is authorized to analyze.

Operate like a human assistant in the user's Chrome session. Work one active Douyin or Doubao item at a time, wait for visible page stability before reading or sending, avoid parallel tab bursts, avoid rapid repeated submissions, and persist the item result before moving to the next item. During an authorized run, complete only non-sensitive visible confirmations that do not require a human verification action. If the page shows QR scan, CAPTCHA, password, OTP, account switch, payment, or sensitive consent, persist progress, name the exact screen, pause for the human action, then resume the workflow after it clears. Do not bypass platform checks, scrape hidden payloads, or inspect credentials.

Do not pass automatable collection work back to the user. The agent must click, read, export, copy public URLs, send approved Doubao prompts, save files, audit, and merge when those actions are possible through the authorized Chrome session or local workspace. Pause only for true human-only blockers such as Chrome Extension disconnection after reconnect attempts, QR scan, CAPTCHA, password/OTP entry, account switch, payment, consent that changes account state, or a platform verification the agent cannot complete through the normal visible UI.

## Workflow

1. Define scope and output folder.
   - Confirm this is first-party or authorized data.
   - Create or reuse `outputs/douyin_analysis_YYYY-MM-DD/`.
   - Persist progress after every item.

2. Collect or load works data.
   - Preferred: use Chrome Extension collection path from `references/chrome-extension-workflow.md`.
   - Claim an existing Chrome tab on `creator.douyin.com` when present; otherwise open creator center in Chrome, complete non-sensitive visible confirmations when authorized, and pause for QR scan, CAPTCHA, password, OTP, account switch, payment, or sensitive consent before resuming.
   - Read visible creator-center tables/cards or use official page exports/downloads when available.
   - Required bottom-ledger fields for every work: `index`, `mid`, `publicUrl`, `publishedAt`, `status`, `itemType`, `durationSeconds`, `caption`, cover/title text when visible, `plays`, `likes`, `comments`, `shares`, `favorites`, `finalTranscript`, `finalTranscriptStatus`, `dataSource`, and `fetchedAt`.
   - Treat the visible `status` / `visibility` shown in the creator-center work list as the source of truth for private, hidden, limited, or deleted works. Mark those before transcript extraction; do not infer privacy from Doubao failures, zero plays, or missing public-page access.
   - Native creator-detail tabs must be saved raw-first under `rawDouyinTabs`: `overview`, `trafficAnalysis`, `audienceAnalysis`, and `commentHotWords`.
   - For each tab, collect all visible/exportable metrics, tables, ranked words, search terms, traffic-source rows, audience distributions, retention labels, follow metrics, and comparison labels. If Douyin does not expose the value through export or visible DOM, record `dataGap` with the section name.
   - Deep fields: average watch time, completion rate, 3s/5s retention, new followers, lost followers, follow rate, profile visits, cover click rate, Top comments.

3. Extract transcripts one item at a time.
   - For Doubao, reuse one normal Doubao window at human pace: send one public URL or visible text payload, pause, request transcript/text extraction, wait for the answer to finish, save, then continue to the next item.
   - Skip Doubao/public-link extraction for works whose visible creator-center `status` / `visibility` is private, hidden, limited, or deleted. Use creator-center visible original text, already supplied local scripts, or user-provided text only, and label that provenance.
   - Do not parallelize Doubao chats, rapidly submit many URLs, or repeat mechanical coordinate clicks. Open a new chat only when the current conversation is polluted, stuck, or explicitly fails.
   - If Doubao shows QR scan, CAPTCHA, password, OTP, account switch, payment, or sensitive consent, record the verification status, pause for the human action, then resume after it clears. Complete only non-sensitive visible confirmations that do not require human verification.
   - Do not fetch media files or run local ASR in the current transcript workflow. Media/ASR can be listed only as a future improvement comment after explicit safety review and user approval.

4. Audit before rerun.
   - Run `scripts/audit_content_gaps.cjs` against existing works/deep JSON.
   - First run for an account should collect all published works.
   - Later runs should fetch only missing or stale fields.
   - Treat metric conflicts, stale deep metrics, fallback transcripts, and zero-play items with positive deep activity as gaps. Do not present a report from mixed-date or conflict-heavy data.

5. Backfill deep metrics.
   - Preferred: use Chrome Extension to open each creator-center video analytics page in the user's Chrome session, read visible metrics, and persist each item.
   - Use the public video page in Chrome for Top comments when creator-center comment pages do not expose enough comments.
   - If a required deep metric is not visible in Chrome, add it to `dataGap` and keep going.

6. Export and validate.
   - Merge to JSON, CSV, and Markdown with `scripts/merge_content_outputs.cjs`.
   - Validate item count, duplicate IDs, missing URLs, empty transcripts, missing deep metrics, and missing Top comments.
   - Check `summary.metricConflictCount`, `summary.distributionUnknown`, and `summary.dataQualityWarningCounts`; if any are non-empty, mark the data as provisional and backfill before strategic conclusions.
   - Keep `.cheat-cache/`, cookies, browser storage, and raw private dumps out of git.

7. Present the report when asked for analysis.
   - Read `references/report-design.md` before creating HTML dashboards or strategy reports.
   - Separate hidden/limited works from observed works before explaining why something did or did not get exposure.
   - Preserve per-video evidence: caption, transcript summary, metrics, factor diagnosis, and next action.
   - Make charts inspectable: bubbles need hover/click labels with video index, caption, plays, save/share/follow signals, and the reason for the bucket.

## Commands

Chrome Extension-first collection:

```text
Use the Chrome plugin / Codex Chrome Extension to claim or open creator.douyin.com, collect my own Douyin works and video-analysis pages, save progress after each item, and mark fields Chrome cannot expose as dataGap.
```

Audit gaps:

```bash
node ~/.codex/skills/douyin-analysis/scripts/audit_content_gaps.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --fresh-after YYYY-MM-DD \
  --out outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json
```

Merge final outputs:

```bash
node ~/.codex/skills/douyin-analysis/scripts/merge_content_outputs.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --stem douyin_deep
```

## References

Read `references/douyin-workflow.md` when planning a full run, debugging field gaps, or explaining the expected JSON schema.

Read `references/chrome-extension-workflow.md` before collecting creator-center data. It is the primary browser path.

Read `references/douyin-native-tabs.md` before collecting, auditing, merging, or explaining native Douyin creator-detail tab data.

Read `references/report-design.md` when turning collected data into an HTML report, factor map, sample review, or next-batch content roadmap.

Read `references/blind-subagent-prompt.md` before blind-scoring new videos or explaining the blind subagent prompt.
