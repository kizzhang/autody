# Lumina HTML Workflow

Use this reference when `/html` renders an Autody run folder into HTML.

Lumina only: do not offer a three-template picker. Preserve visual elements, but regenerate the analysis every run.

The Guizang variants show the correct reuse pattern: separate `loadModel()` from `renderPage()`. Autody should keep that pattern. Historical HTML is a visual source, not a source of current conclusions.

Historical sources used to package this workflow:

- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/superdesign_lumina_dashboard_2026-05-31.html`
- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_superdesign_hero_variants_2026-05-31.cjs`
- `/Users/kaneki/Projects/fun/content/outputs/competitor_ai_research_2026-06-05/build_autody_lumina_competitor_report_2026-06-05.cjs`
- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_taste_guizang_variants_2026-05-31.cjs`

## Inputs

Default run folder:

```text
outputs/douyin_analysis_YYYY-MM-DD/
```

Preferred data files:

```text
douyin_deep_works_final.json
douyin_incremental_analysis_YYYY-MM-DD.json
content_gap_audit.json
```

Use `douyin_deep_works_final.json` as the source of truth for item-level metrics, transcripts, comments, and provenance. Use analysis JSON only for conclusions that are explicitly present.

## Fresh Analysis Rule

Every `/html` run must create a fresh report payload from the current source files:

```text
report_lumina_payload.json
```

The payload must include:

```json
{
  "generatedAt": "ISO timestamp",
  "sourceFiles": {
    "works": "douyin_deep_works_final.json",
    "analysis": "optional analysis json",
    "audit": "optional audit json"
  },
  "summary": {},
  "items": []
}
```

If old HTML exists, use it only as a visual reference. Do not copy old hero claims, sample rankings, diagnoses, next actions, or strategic conclusions unless the same conclusion is regenerated from the current source files.

## Rendering Contract

- Use `lumina-template.html` as the visual source.
- Preserve the Lumina visual system: yellow hero, dark proof strip, explicit content bands, data plaque, bubble map, case cards, factor map, searchable table, and responsive mobile layout.
- Recompute summary statistics, buckets, selected examples, caveats, and table rows from the current payload.
- Write `report_lumina.html` into the run folder unless the user names another output file.
- Keep all source JSON next to the HTML.
- Include data quality caveats when audit gaps exist.

## Boundaries

`/html` does not collect browser data, backfill metrics, create transcripts, choose among multiple templates, or reuse stale conclusions. If the data is incomplete, render only supported sections and report the missing inputs.
