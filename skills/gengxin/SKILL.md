---
name: gengxin
description: Use when the user invokes /gengxin or asks to update an existing Autody Douyin baseline with new works or refreshed metrics.
---

# Gengxin

Use this command-like skill for `/gengxin` / `更新`.

`/gengxin` is the incremental update workflow. It starts from an existing Autody run folder, finds new published works, refreshes stale visible metrics, and preserves good existing records.

This is a Chrome Extension-first workflow. Use the user's logged-in Chrome session through the Codex Chrome Extension / Chrome plugin for creator-center work. Do not inspect cookies, localStorage, passwords, session stores, or Chrome profile files.

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
6. Preserved existing good transcripts, comments, and deep metrics unless newer visible data is collected.
7. Persisted progress after every changed item.
8. Reran audit and merge scripts.
9. Reported new item count, refreshed item count, output paths, and remaining `dataGap` items.

Do not rebuild the whole account unless the user asks for `/kaishi`. Do not render HTML; use `/html` after update.
