# Autody Report Agent Guide

Use this guide when generating Autody Douyin report analysis, report JSON, Markdown diagnosis, or Lumina payloads from an existing run folder. It defines the analysis contract. It does not authorize browser collection, transcript extraction, or private data access.

## Prime Directive

Every report must be recomputed from the latest selected run folder. Older Markdown, JSON, HTML, screenshots, or chat conclusions are references for visual style only. Do not reuse strategic conclusions unless the current source data supports them again.

Separate three questions before making any claim:

1. What does the content itself promise?
2. What does the available data actually prove?
3. What is still unknown because of missing, stale, conflicting, hidden, or limited data?

## Required Inputs

Prefer these files from one run folder:

- `douyin_deep_works_final.json` or `douyin_works_final.json`
- `deep_metrics_progress.json` when present
- `content_gap_audit.json` when present
- transcript fields or `douyin_deep_transcripts_final.md`
- Top comments or comment keywords when present

If files come from different dates or sources, mark the report provisional and do not write confident strategic conclusions until conflicts are resolved.

## Local Report Builder

Use the local builder to create fresh analysis before writing report prose or rendering Lumina:

```bash
node ~/.codex/skills/douyin-analysis/scripts/build_report_analysis.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_deep_works_final.json \
  --audit outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json \
  --blind outputs/douyin_analysis_YYYY-MM-DD/blind_predictions.json \
  --new-after YYYY-MM-DD \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --date YYYY-MM-DD
```

The script creates the fresh analysis payload. The report writer must not replace `blindPrediction`, `blindScoreStatus`, observed metrics, data gate, or adversarial audit with stale conclusions from older reports.

## Data Gate

Classify each work before judging performance:

| Status | Meaning | Report rule |
| --- | --- | --- |
| `observed` | Public metrics and deep metrics are usable enough | May use for performance attribution |
| `distribution_unknown` | Hidden, private, zero-play with positive deep activity, inaccessible, or missing key exposure data | Diagnose script only; do not call it a failed content idea |
| `metric_conflict` | Work-list metrics and deep metrics disagree materially | Show conflict and avoid precise rate-based conclusions |
| `transcript_incomplete` | Transcript is missing, fallback-only, or summary-like | Avoid detailed script diagnosis |
| `stale_deep_metrics` | Deep metrics are older than the report freshness requirement | Mark provisional and prefer backfill |

Do not average hidden/unknown works into observed-performance charts. They can appear in audit tables with warnings.

## Three-Lens Analysis

### 1. Xuehui Lens: Content Asset and Metric Fit

Use this lens to decide what a video was trying to build and which metric should evaluate it.

Light-tag every work:

- `content_type`: viewpoint, process, knowledge, story, commerce, image-text, mixed
- `account_asset`: professional authority, reliability, real process, audience resonance, personality preference, conversion reason, social talk value
- `user_bait`: useful, interesting, resonant
- `expected_winning_metrics`: the metrics this content type should win on
- `confidence`: high, medium, low

Do not write a long diagnosis for every work. Use deep diagnosis only for:

- top performers
- new works or historical works explicitly selected for review
- metric anomalies
- representative samples for a content type
- videos tied to the next-batch strategy

Metric fit:

| Content type | Primary metric questions |
| --- | --- |
| viewpoint | Did it create agreement, disagreement, comments, shares, or follows? |
| process | Did the first 5 seconds and average watch time hold because the process had expectation? Did it create leads or trust? |
| knowledge | Did it earn favorites/saves, follows, and enough watch time to prove useful density? |
| story | Did it create trust, comments, profile visits, follows, or conversion intent? |
| commerce | Did it create product clicks, private messages, orders, leads, or ROI instead of vanity plays? |
| image-text | Did it earn manual slide/read completion, saves, and expands when available? |

For each key sample, say what structure to reshoot. Do not recommend copying only the title.

### 2. Nana-Generalized Lens: Consumption Reason vs Follow Reason

Do not import Nana as a personality-specific rule. Generalize the lesson into a report question:

> Is this video merely good to consume once, or does it create a reason to follow this creator's future output?

Classify key samples:

| Class | Meaning | Evidence to check |
| --- | --- | --- |
| `one_time_watch` | Good hook, emotion, conflict, meme, or spectacle, but weak future reason | High play/share with weak follow or weak profile intent |
| `useful_but_detached` | Useful information, but the creator is replaceable | High save/favorite with weak follow, weak comments about creator/process |
| `follow_asset` | The user now expects more from this creator | Follows, profile visits, repeatable workflow, comments asking for next steps |
| `compound_asset` | Useful, emotionally resonant, scarce, and tied to creator authority | Saves/shares/follows all strong, comments show trust or intent |

Assess density with these factors:

- scarcity: Is the information, angle, or proof uncommon?
- usefulness: Does it lower cost, risk, time, or confusion?
- emotional value: Does the viewer feel understood, challenged, relieved, or represented?
- expression density: Are there concrete claims, numbers, steps, contrasts, and proof instead of filler?
- open loop: Does the viewer have a reason to watch the next related video?

This lens prevents the report from mistaking high likes or high shares for account value.

### 3. CoC Lens: Prediction, Evidence, Rebuttal, Calibration

Use this lens to keep the report from explaining outcomes backward.

Every key claim must include:

- `judgment`: the concise claim
- `evidence`: metrics, transcript features, comments, or audit facts
- `rebuttal`: the strongest reason the claim might be wrong
- `confidence`: high, medium, or low
- `next_validation`: what the next video or data backfill should test

Always separate:

- content quality: script, hook, density, proof, structure
- distribution boundary: hidden/limited/stale/conflicting/missing data
- trend borrowing: hot topic, public meme, platform format, tool hype, event timing
- account asset: professional trust, follow reason, conversion reason, audience memory

If a video appears to win because of a hot format or external trend, mark `trend_borrowing` explicitly. Do not attribute all success to the creator's content system until the structure repeats without the same trend variable.

## Blind Prediction For New Videos

New videos must be scored by an isolated subagent before the main report agent reads or uses their observed data.

### Trigger

Run blind prediction for:

- videos published since the previous report
- videos the user specifically calls "new"
- videos explicitly selected for prediction calibration before their observed data is analyzed

Historical videos do not require blind scoring by default. Use normal evidence-based diagnosis for historical samples unless the user asks for retro-calibration.

### Hard Isolation Rule

The blind subagent may receive only:

```json
{
  "blind_id": "opaque_random_or_hash_id",
  "title": "title, cover title, or concise caption title",
  "script": "full transcript or script text"
}
```

Never provide:

- plays, likes, comments, shares, favorites, follows, retention, watch time, profile visits, or clicks
- publish time, URL, public index, original filename, ranking, bucket, or "new/bomb/weak" labels
- account historical performance, old report conclusions, peer comparisons, or comments
- any hint that implies whether the video performed well or badly

If no isolated subagent capability is available, do not fake blind scoring in the main context. Mark the item `blind_score_blocked` and ask for an isolated subagent path before using blind predictions.

### Blind Output Contract

The blind subagent must output strict JSON:

```json
{
  "blind_id": "...",
  "content_type": "viewpoint|process|knowledge|story|commerce|image_text|mixed",
  "account_asset": ["professional_authority"],
  "nana_generalized_class": "one_time_watch|useful_but_detached|follow_asset|compound_asset",
  "expected_winning_metrics": ["favorite_rate", "share_rate", "follow_rate"],
  "scores": {
    "hook": 0,
    "density": 0,
    "scarcity": 0,
    "usefulness": 0,
    "emotional_value": 0,
    "proof_strength": 0,
    "follow_reason": 0,
    "conversion_asset": 0
  },
  "predicted_bucket": "weak|ordinary|testable|strong|priority_reshoot",
  "one_line_reason": "...",
  "main_risks": ["..."],
  "revision_advice": "..."
}
```

The main report agent must not edit the blind score after seeing data. It may only compare prediction to observed results.

### Calibration Output

For blind-scored videos, include:

| Field | Meaning |
| --- | --- |
| `blind_prediction` | Subagent prediction before data |
| `observed_result` | Actual metrics after the data gate |
| `delta` | Where prediction and reality diverged |
| `calibration` | What the rubric should learn |
| `next_test` | The next structure or variant to shoot |

Examples:

- Blind strong, actual high save but low follow: useful information worked, but follow reason is weak.
- Blind ordinary, actual high share/play: likely trend borrowing or social talk value; reshoot without the trend variable to test repeatability.
- Blind weak, actual strong follow: the rubric may undervalue personality, story, or trust proof.

## Per-Video Diagnosis Contract

All works get a light row. Key works get a deep card.

Light row fields:

```json
{
  "index": 1,
  "data_status": "observed",
  "content_type": "knowledge",
  "account_asset": ["professional_authority"],
  "user_bait": ["useful"],
  "expected_winning_metrics": ["favorites", "follows"],
  "actual_signal": "high favorite rate, medium follow rate",
  "confidence": "medium"
}
```

Deep card fields:

```json
{
  "title": "...",
  "script_structure": "hook -> promise -> proof -> steps -> next action",
  "explosive_elements": ["cost", "contrast", "crowd"],
  "judgment": "...",
  "evidence": ["..."],
  "rebuttal": "...",
  "next_action": "reshoot the structure with a new variable",
  "validation_metric": "favorite_rate and follow_rate"
}
```

## Account Diagnosis Contract

Account-level conclusions must be recomputed from current works:

- content mix by type and asset
- strongest repeatable structures
- one-time attention samples versus follow assets
- missing trust/conversion proof
- trend-borrowing dependence
- weak openings, weak density, weak proof, or weak follow reason
- observed data versus distribution-unknown boundary

Avoid generic advice. The next-batch plan must specify format, hypothesis, target metric, failure threshold, and what to do if it wins or loses.

## Adversarial Audit

End every strategic report with a short adversarial audit:

- Which conclusions have low or medium confidence?
- Which videos are excluded from performance attribution because of data quality?
- Which wins may be trend borrowing?
- Which high-performing videos may not create account assets?
- Which recommendations would change if missing transcripts, Top comments, or deep metrics were backfilled?
- What must be tested in the next batch before scaling?
