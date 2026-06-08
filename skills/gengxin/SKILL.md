---
name: gengxin
description: Use when the user invokes /gengxin or asks to update an existing Autody Douyin baseline with new works or refreshed metrics.
---

# Gengxin

Use this command-like skill for `/gengxin` / `更新`.

`/gengxin` is the incremental update workflow. It starts from an existing Autody run folder, finds new published works, refreshes stale visible metrics, and preserves good existing records.

This is a Chrome Extension-first workflow. Use the user's logged-in Chrome session through the Codex Chrome Extension / Chrome plugin for creator-center work. Do not inspect cookies, localStorage, passwords, session stores, or Chrome profile files.

## Agent Ownership

Once the user asks for `/gengxin` / `更新`, the agent owns the whole update. Do not answer with a checklist for the user, do not stop after only identifying new works, and do not tell the user to collect, export, copy, paste, or run another Autody command when the agent can do it from the current workspace or authorized Chrome session.

The agent must perform every automatable step itself: locate the baseline, inspect creator center, identify new works, get visible IDs/URLs/status, collect exact transcripts/text for new public works through the approved Doubao path, refresh required visible/deep/native-tab metrics, persist progress, audit, merge, and report results.

Only pause for a true human-only blocker: Chrome Extension disconnected after reconnect attempts, QR scan, CAPTCHA, account password, OTP, account switch, payment, consent that changes account state, or a platform verification the agent cannot complete through the normal visible UI. When pausing, state the exact blocker and the exact screen; resume the workflow after the blocker is cleared. Do not use the blocker as a substitute for the rest of the update.

## Required Context

Before collecting data, read:

1. `../douyin-analysis/SKILL.md`
2. `../douyin-analysis/references/chrome-extension-workflow.md`
3. `../douyin-analysis/references/douyin-workflow.md`

## Completion Boundary

`/gengxin` is complete only after it has:

1. Located the target run folder and existing baseline files.
2. Run or read the latest audit so it knows existing gaps.
3. Claimed or opened creator center through Chrome Extension.
4. Checked for newly published works since the baseline.
5. Added new works and refreshed stale visible metrics for requested or recent works.
6. Refreshed new and stale native Douyin tab data when the audit or freshness window requires it.
7. Collected exact Doubao transcript/text for every new public work, or recorded a precise `dataGap` after bounded retries. Do not fetch media files or run local ASR in `/gengxin`; media/ASR belongs only in a future-improvement path after a separate safety review.
8. Preserved existing good transcripts, comments, and deep metrics unless newer visible data is collected.
9. Persisted progress after every changed item.
10. Reran audit and merge scripts.
11. Reported new item count, refreshed item count, output paths, and remaining `dataGap` items.

Do not rebuild the whole account unless the user asks for `/kaishi`. Do not render HTML; use `/html` after update.
