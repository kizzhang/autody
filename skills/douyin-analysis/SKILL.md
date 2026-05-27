---
name: douyin-analysis
description: Use when analyzing the user's own Douyin creator account or authorized Douyin videos, collecting creator-center metrics, Top comments, transcripts, retention/follow data, or incrementally backfilling missing fields into JSON/CSV/Markdown reports.
---

# Douyin Analysis

Use this skill only for the user's own Douyin creator account, their own videos, or creator data they are explicitly authorized to manage. If the task involves another person's account, private dashboard, or unauthorized data, do not proceed.

## Workflow

1. Define scope and output folder.
   - Confirm this is first-party or authorized data.
   - Create or reuse `outputs/douyin_analysis_YYYY-MM-DD/`.
   - Persist progress after every item.

2. Collect or load works data.
   - Required fields: `index`, `mid`, `publicUrl`, `publishedAt`, `caption`, `itemType`, `plays`, `likes`, `comments`, `shares`, `favorites`, `finalTranscript`.
   - Deep fields: average watch time, completion rate, 3s/5s retention, new followers, lost followers, follow rate, profile visits, cover click rate, Top comments.

3. Extract transcripts one item at a time.
   - For Doubao, open one fresh page/chat per item, send the public URL, request transcript/text extraction, save, then close that page.
   - Do not keep a long Doubao chat open across many works.
   - Use local ASR or public page text only as fallback, and label provenance.

4. Audit before rerun.
   - Run `scripts/audit_content_gaps.cjs` against existing works/deep JSON.
   - First run for an account should collect all published works.
   - Later runs should fetch only missing or stale fields.

5. Backfill deep metrics.
   - Use `scripts/douyin-session/backfill.py` for creator-center detail metrics and Top comments.
   - Use the user's own login in a local Playwright profile under the project `.auth/`.
   - Never inspect, export, or commit cookies, passwords, localStorage, or browser session stores.

6. Export and validate.
   - Merge to JSON, CSV, and Markdown with `scripts/merge_content_outputs.cjs`.
   - Validate item count, duplicate IDs, missing URLs, empty transcripts, missing deep metrics, and missing Top comments.
   - Keep `.auth/`, `.cheat-cache/`, cookies, and raw private dumps out of git.

## Commands

Audit gaps:

```bash
node ~/.codex/skills/douyin-analysis/scripts/audit_content_gaps.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json
```

Login or refresh creator-center auth:

```bash
CHEAT_PROJECT_ROOT="$PWD" \
uv run --python 3.11 --with playwright \
python ~/.codex/skills/douyin-analysis/scripts/douyin-session/crawler.py
```

Backfill missing deep metrics and comments:

```bash
CHEAT_PROJECT_ROOT="$PWD" \
uv run --python 3.11 --with playwright \
python ~/.codex/skills/douyin-analysis/scripts/douyin-session/backfill.py \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --comment-limit 20
```

Backfill selected indexes:

```bash
CHEAT_PROJECT_ROOT="$PWD" \
uv run --python 3.11 --with playwright \
python ~/.codex/skills/douyin-analysis/scripts/douyin-session/backfill.py \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --indexes 4,29,31
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
