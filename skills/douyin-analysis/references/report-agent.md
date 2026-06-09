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

Use `references/blind-subagent-prompt.md` as the reusable prompt. The blind
subagent predicts script-only metric shapes; it must not output single-point
actual values, numeric ranges, or any estimated plays/rates/follows.

### Trigger

Run blind prediction for:

- videos published since the previous report
- videos the user specifically calls "new"
- videos explicitly selected for prediction calibration before their observed data is analyzed

Historical videos do not require blind scoring by default. Use normal evidence-based diagnosis for historical samples unless the user asks for retro-calibration.

Run production blind scoring only when the item has a full transcript, full
script, or complete image-text body. Do not use caption-only text, chapter
summaries, fallback summaries, or obviously truncated transcripts as production
blind inputs. Mark those items `blind_score_transcript_incomplete`; they may be
used only in a calibration experiment where transcript provenance is reported.

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

Never ask the blind subagent for:

- predicted plays, views, likes, comments, shares, favorites, or follows
- predicted like/comment/share/favorite/follow rates
- predicted completion, watch-time, retention, or bounce values
- numeric ranges, `absolute_predictions`, `numeric_predictions`,
  `predicted_plays`, or `estimated_plays`

If no isolated subagent capability is available, do not fake blind scoring in the main context. Mark the item `blind_score_blocked` and ask for an isolated subagent path before using blind predictions.

### Blind Output Contract

The blind subagent must output strict JSON. It must predict the metric shape that the
report later compares against observed data:

```json
{
  "blind_id": "...",
  "relative_predictions": {
    "distribution_bucket": "low|mid|high|breakout",
    "two_second_bounce_shape": "strong_low_bounce|mid|weak_high_bounce",
    "five_second_retention_shape": "low|mid|high|breakout",
    "completion_shape": "low|mid|high|breakout",
    "avg_watch_shape": "low|mid|high|breakout",
    "like_rate_shape": "low|mid|high|breakout",
    "comment_rate_shape": "low|mid|high|breakout",
    "share_rate_shape": "low|mid|high|breakout",
    "favorite_rate_shape": "low|mid|high|breakout",
    "follow_asset_shape": "low|mid|high|breakout"
  },
  "scores_0_5": {
    "hook_strength": 0,
    "first_5s_clarity": 0,
    "middle_delivery": 0,
    "completion_risk": 0,
    "save_intent": 0,
    "share_intent": 0,
    "comment_intent": 0,
    "follow_reason": 0,
    "account_asset": 0
  },
  "why": "...",
  "risk_flags": ["..."],
  "confidence": "low|medium|high"
}
```

The main report agent must not edit the blind score after seeing data. It may only compare prediction to observed results.

Optional qualitative fields such as `content_type`, `account_asset`,
`nana_generalized_class`, `expected_winning_metrics`, `predicted_bucket`,
`one_line_reason`, `main_risks`, and `revision_advice` may be accepted for
calibration experiments, but they are not a substitute for the required
production schema above.

### Blind Schema Gate

Before any observed data is opened, validate the blind subagent output.

A production blind score is valid only when all of these are true:

- It is parseable JSON.
- It contains `blind_id`, `relative_predictions`, `scores_0_5`, `why`,
  `risk_flags`, and `confidence`.
- `relative_predictions` contains exactly the metric-shape fields listed in
  the contract above.
- Every bucket value is from the allowed enum. Do not accept invented values
  such as `medium`, `medium_high`, `mid_low`, `low_medium`, `high-ish`, or
  `overall_bucket`.
- The output does not include or imply observed data.
- The output does not include fake numeric estimates or actual-value fields,
  including `plays`, `likes`, `comments`, `shares`, `favorites`,
  `completion_rate`, `avg_watch_time`, `like_rate`, `comment_rate`,
  `share_rate`, `favorite_rate`, `follow_rate`, `absolute_predictions`,
  `numeric_predictions`, `predicted_plays`, `estimated_plays`,
  `predicted_likes`, `predicted_favorite_rate`, `estimated_follows`, or any
  `predicted_`, `estimated_`, `expected_`, `actual_`, or `observed_`
  count/rate/range field.

If the first output fails this gate, reprompt the same isolated subagent once
with only the schema error and the original title/script. If the second output
still fails, save the raw output as calibration evidence, mark the item
`blind_score_schema_failed`, and do not use it as a production blind score.
Normalization is allowed only in a calibration report, never as the report's
official blind prediction.

### Account-Calibrated Numeric Output

Blind subagents do not output actual values. Numeric report output is produced
only by the main report builder after the blind score has passed schema gate and
the observed data is allowed to be opened.

For each blind-scored row, the report builder must include:

```json
{
  "calibration": {
    "calibratedPrior": {
      "basisItemCount": 0,
      "basis": "current_account_observed_items_excluding_this_work",
      "metrics": {
        "plays": {
          "predictionField": "distribution_bucket",
          "shape": "high",
          "quantileRange": "P70-P90",
          "valueRange": [880, 1360],
          "valueRangeText": "880-1,360"
        },
        "favoriteRate": {
          "predictionField": "favorite_rate_shape",
          "shape": "high",
          "quantileRange": "P70-P90",
          "valueRange": [0.022, 0.034],
          "valueRangeText": "2.20%-3.40%"
        }
      }
    },
    "observedActual": {
      "plays": 900,
      "favoriteRate": 0.03,
      "favoriteRateText": "3.00%"
    },
    "deltas": {
      "plays": {
        "predictedShape": "high",
        "observedShape": "high",
        "result": "hit"
      }
    }
  }
}
```

This preserves isolation: the blind prediction stays qualitative, while the
report still shows actual observed values and whether the blind shape was
over-predicted, under-predicted, or hit.

### Blind Prediction Calibration Rules

Use these rules inside the isolated blind prompt. They are deliberately about script
features only; do not leak account baselines, historical winners, or observed metrics
to the blind subagent.

- Real project, real tool, real workflow, or real life experience does not automatically mean high distribution. Distribution can be `high` or `breakout` only when the first 5 seconds contain a broad pain, identity threat, strong result, strong contrast, or clear failure cost.
- If the opening tells viewers the video is long, dense, or can be summarized elsewhere, penalize `two_second_bounce_shape`, `five_second_retention_shape`, and `completion_shape`.
- Personal project showcases, feature lists, abstract methodology, and dense technical terms cap distribution at `low` or `mid` unless the script has a clear story arc: problem, cost, conflict, solution, result.
- Separate watch time from completion. Long口播 can have `avg_watch_shape: high` while `completion_shape` stays `low` or `mid`.
- Separate content quality from account asset. A useful one-off answer can earn likes or favorites without creating a future follow reason.
- Route-map content can earn high favorites even when it lacks a downloadable checklist. Signals include unemployment/career paths, profitable project paths, real users, real customers, "from beginner to result", and concrete next moves. Do not downgrade favorites only because the advice is narrative.
- Share requires social transmission evidence: identity threat, controversy, strong empathy, a sentence viewers would send to a friend, or a broadly legible external cost. Niche technical usefulness alone is not high share.
- Comment requires a reason to respond: disagreement, question bait, resource request, personal story invitation, or a claim that viewers can challenge.
- Follow asset requires the creator to become scarce: proof that only this creator can keep showing the process, provide the next workflow, interpret the trend, or reduce future risk.
- AI anxiety plus a clear route map can break out even without a loud opening.
  Signals include named resources, named steps, creator transformation proof,
  and a credible "from zero to keeping up" path. Raise favorite, share, follow,
  and sometimes distribution expectations for this pattern.
- Copyable short workflow content should not inherit long口播 penalties. If the
  script is concise and gives a prompt, template, checklist, or directly usable
  workflow, raise completion, favorite, and share expectations.
- Do not predict high likes or comments from emotion alone. A "破防" or
  vulnerable niche story still needs a low-friction reply path, universal pain,
  resource ask, disagreement hook, or broadly legible conflict.
- Technical trend explainers can split distribution from depth. When a dense
  first-principles explanation is tied to a current trend, it may have weak
  distribution or weak first-stop metrics but high average watch, comments, and
  shares among retained target viewers.
- Macro empowerment narratives can produce high like and comment rates even
  with mid distribution when they give viewers an aspirational identity and ask
  an easy personal question.
- Identity threat often drives share and follow more reliably than comments.
  Predict high comments only when the script gives viewers something easy to
  answer, challenge, request, or confess.

### Calibration Output

For blind-scored videos, include:

| Field | Meaning |
| --- | --- |
| `blind_prediction` | Subagent prediction before data |
| `calibrated_prior` | Account-calibrated numeric range derived from the blind shape |
| `observed_actual` | Actual observed metrics after data gate allows analysis |
| `blind_delta` | Hit, over-predicted, under-predicted, or unknown |
| `observed_result` | Actual metrics after the data gate |
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
