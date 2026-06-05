---
name: baogao
description: Use when the user invokes /baogao or asks to create fresh Autody report analysis from existing Douyin baseline data.
---

# Baogao

Use this command-like skill for `/baogao` / `报告`.

`/baogao` creates fresh report analysis from existing Autody data. It does not collect browser data and does not render HTML directly. Use `/html` after `/baogao` when the user wants a Lumina page.

Regenerate report analysis from the latest data every run. Do not reuse stale conclusions from older Markdown, JSON, or HTML reports unless the same conclusion is supported by the current source data.

## Required Context

Before analyzing, read:

1. `../douyin-analysis/SKILL.md`
2. `../douyin-analysis/references/report-design.md`
3. `../douyin-analysis/references/douyin-workflow.md`

## Completion Boundary

`/baogao` is complete only after it has:

1. Located the target run folder and latest baseline files.
2. Read audit status and marked conclusions provisional when gaps or conflicts remain.
3. Recomputed summary statistics, observed versus hidden/limited groups, strongest samples, weakest samples, factor diagnosis, and next-batch suggestions from current data.
4. Written fresh report analysis JSON and Markdown in the run folder.
5. Reported source files, output paths, and data caveats.

Do not render HTML in `/baogao`; call `/html` next for Lumina rendering.
