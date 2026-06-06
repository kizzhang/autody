---
name: html
description: Use when the user invokes /html or asks to render an existing Autody Douyin baseline or report as Lumina HTML.
---

# HTML

Use this command-like skill for `/html` / `Lumina HTML`.

`/html` turns an existing Autody run folder into a Lumina HTML page. It is a rendering workflow, not a collection workflow. Regenerate the report analysis from the latest data every run.

Do not use Chrome, Doubao, creator center, or public Douyin pages from this command. If data is missing, ask the user to run `/kaishi`, `/gengxin`, `/buchong`, or `/tijian` first.

## Required Context

Before rendering, read:

1. `../douyin-analysis/references/report-design.md`
2. `../douyin-analysis/references/lumina-html-workflow.md`

Use Lumina only. Do not offer a three-template picker and do not mention unused template families.

Use the Guizang reuse pattern: keep visual elements stable, but rebuild the view model and conclusions from current data. Old Lumina or Guizang HTML files are visual references only; never copy their old conclusions into a new report.

## Inputs

Use the target run folder, normally:

```text
outputs/douyin_analysis_YYYY-MM-DD/
```

Prefer:

```text
douyin_deep_works_final.json
douyin_incremental_analysis_YYYY-MM-DD.json
content_gap_audit.json
```

## Output

Write a fresh payload and Lumina HTML file into the run folder:

```text
report_lumina_payload.json
report_lumina.html
```

Use:

```bash
node ~/.codex/skills/douyin-analysis/scripts/render_lumina_report.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_deep_works_final.json \
  --out outputs/douyin_analysis_YYYY-MM-DD
```

The payload must include `generatedAt`, `sourceFiles`, `summary`, and `items`. Report the HTML path and any data quality caveats.

## Boundaries

- Do not collect or backfill browser data.
- Do not generate transcripts.
- Do not inspect cookies, localStorage, passwords, session stores, or browser profile files.
- Do not offer a three-template picker.
- Do not invent strategic conclusions when the input data does not support them.
- Do not reuse stale report conclusions. Reanalyze against the current source files before rendering.
