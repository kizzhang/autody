---
name: kaishi
description: Use when the user invokes /kaishi or asks to start first-time Douyin account baselining for their own authorized creator account.
---

# Kaishi

Use this command-like skill for `/kaishi` / `开始建档`.

`/kaishi` is the first-run baseline workflow for the user's own Douyin creator account or creator data they are explicitly authorized to manage. It creates the data foundation; it does not create strategy reports or HTML dashboards.

This workflow is Chrome Extension-first. Use the Codex Chrome Extension / Chrome plugin to work inside the user's already logged-in Chrome session. Do not start another browser collector or inspect cookies, localStorage, passwords, session stores, or Chrome profile files.

Handle Douyin creator center and Doubao at human pace: one active item, wait for visible stability, save progress, then continue. During an authorized run, complete visible login, QR, CAPTCHA, and permission checks through the normal page UI instead of abandoning the workflow.

## Required Context

Before collecting data, read:

1. `../douyin-analysis/SKILL.md`
2. `../douyin-analysis/references/chrome-extension-workflow.md`
3. `../douyin-analysis/references/douyin-workflow.md`

Follow those shared safety, provenance, schema, and resume rules. If a field is not visible or exportable through Chrome, record `dataGap` instead of guessing.

## Completion Boundary

`/kaishi` is complete only after it has:

1. Confirmed the account is first-party or explicitly authorized.
2. Created or reused `outputs/douyin_analysis_YYYY-MM-DD/`.
3. Collected the full published works list from Douyin creator center.
4. Saved `douyin_works_final.json` with visible works fields.
5. Opened each creator-center analytics page through Chrome and saved visible deep metrics.
6. Collected all visible/exportable native Douyin tabs for every work: overview, trafficAnalysis, audienceAnalysis, commentHotWords.
7. Used one normal Doubao window at human pace for transcript or image-text extraction, saved each result, and opened a new chat only when the current conversation was polluted, stuck, or failed.
8. Collected Top comments where visible.
9. Persisted progress after every item so the run can resume.
10. Ran audit and merge scripts.
11. Reported item counts, output paths, and remaining `dataGap` items.

Do not create HTML dashboards, strategy reports, topic roadmaps, or next-batch recommendations in `/kaishi`. Use `/baogao` for report analysis and `/html` for Lumina HTML rendering after a baseline exists.

## Commands

Audit:

```bash
node ~/.codex/skills/douyin-analysis/scripts/audit_content_gaps.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json
```

Merge:

```bash
node ~/.codex/skills/douyin-analysis/scripts/merge_content_outputs.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --transcripts outputs/douyin_analysis_YYYY-MM-DD/transcript_progress.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --stem douyin_deep
```

## Stop Conditions

Complete visible login, QR scan, CAPTCHA, permission confirmation, or another account-side step through the normal Chrome UI when the current run is authorized. Record `manualVerificationStatus` on the affected item or run note.

Stop and ask the user to reconnect Chrome Extension if the Chrome plugin cannot claim or open Chrome tabs.

If Doubao cannot extract a transcript for one item, record transcript status and continue to the next item.
