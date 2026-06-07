---
name: buchong
description: Use when the user invokes /buchong or asks to backfill missing Autody Douyin fields from an audit result.
---

# Buchong

Use this command-like skill for `/buchong` / `补充`.

`/buchong` is audit-driven backfill. It reads the latest or user-specified `content_gap_audit*.json`, fixes only listed gaps, then reruns audit and merge.

Start from the latest /tijian or audit output. The audit names missing native tab sections, stale metrics, transcript gaps, comment gaps, and metric conflicts so `/buchong` can collect only what is missing.

Use Chrome Extension-first browser work for creator-center metrics and visible comments. Use one fresh Doubao page/chat per transcript item, save the result, then close that page. Do not inspect cookies, localStorage, passwords, session stores, or Chrome profile files.

## Required Context

Before backfilling, read:

1. `../douyin-analysis/SKILL.md`
2. `../douyin-analysis/references/chrome-extension-workflow.md`
3. `../douyin-analysis/references/douyin-workflow.md`

## Completion Boundary

`/buchong` is complete only after it has:

1. Located the target run folder and audit file.
2. Listed gaps by item and field before collecting.
3. Backfilled only the requested missing or stale fields.
4. Preserved existing good fields.
5. Persisted progress after every item.
6. Reran audit and merge scripts.
7. Reported resolved gaps and remaining unresolved `dataGap` items.

Do not discover new videos; use `/gengxin` for updates. Do not render HTML; use `/html`.
