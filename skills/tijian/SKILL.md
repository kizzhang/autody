---
name: tijian
description: Use when the user invokes /tijian or asks to audit an existing Autody Douyin dataset without collecting browser data.
---

# Tijian

Use this command-like skill for `/tijian` / `体检`.

`/tijian` is an audit-only workflow. It runs deterministic local checks and summarizes data quality. It must not collect browser data, backfill metrics, generate transcripts, or render HTML.

## Required Context

Read `../douyin-analysis/references/douyin-workflow.md` for expected file names and schema.

## Completion Boundary

`/tijian` is complete only after it has:

1. Located the target run folder.
2. Found `douyin_works_final.json` or `douyin_deep_works_final.json`.
3. Found `deep_metrics_progress.json` when present.
4. Run `audit_content_gaps.cjs`.
5. Written `content_gap_audit.json` or a user-named audit output.
6. Summarized native Douyin tab completeness, missing transcripts, URLs, comments, deep metrics, stale metrics, metric conflicts, warnings, and duplicate IDs when available.

## Command

```bash
node ~/.codex/skills/douyin-analysis/scripts/audit_content_gaps.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json
```

If `/tijian` finds gaps, suggest `/buchong`. If the user wants HTML after audit, suggest `/html`.
