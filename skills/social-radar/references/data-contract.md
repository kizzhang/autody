# Local record contract and commands

Node.js 18+; no runtime dependencies. Commands below use a checkout-relative script path; after installation resolve it with `autody skill-path social-radar`. Keep the store outside the installed skill/package and out of git.

```text
outputs/social-radar/
  events/                 immutable, ordered JSON events
  materials/<work-key>/   caption.md, capture inputs, originals and text sources
  drafts/<work-key>/<rev>/ brief.md, script.md, evidence.md
  reports/<run>/          report.html, tracking.csv, snapshot.json
```

Every event has a stable `id` (letters/digits/dot/underscore/hyphen, max 120), `type` and timezone-qualified `recordedAt` (actual save time). New save times cannot precede the preceding committed event; a later-saved backfill retains its older `capturedAt`/`sampledAt`. Dates must exist in the Gregorian calendar, with hours 00–23 and minutes/seconds 00–59; impossible dates are rejected rather than normalized. Repeating the same ID and content is a no-op; changing it is rejected. The ledger embeds hashes for registered files. New reads/corrections use new event IDs and asset paths. Only the collector writes; offline readers submit payloads to it. `events/` is authoritative; reports are regenerable views. `.writer.lock` and `events/` (including normalized or resolved symlink aliases) are reserved and cannot be registered as assets or drafts. Do not edit journal files, old assets or registered drafts.

```bash
node skills/social-radar/scripts/radar.cjs append --store outputs/social-radar --input capture.json
node skills/social-radar/scripts/radar.cjs status --store outputs/social-radar
node skills/social-radar/scripts/radar.cjs render --store outputs/social-radar --out outputs/social-radar/reports/latest
```

`status` and `render` optionally accept `--now <ISO-time>` for reproducible inspection. The CSV opens in Excel and protects formula-leading text; it is an export, not an editable database or XLSX workbook. Dashboard buttons prepare instructions using only a validated work ID and the store path; public titles/authors are not interpolated into commands. They provide clipboard/manual-copy fallback and do not mutate records or claim to have run a task. Use a new report directory to retain past reports. Before writing any report file, the renderer rejects symbolic-link output targets (including dangling links), target aliases and paths or file identities that overlap registered assets, drafts or journal files. Material previews, review evidence links and CSV file links use first-owner assets; excluded legacy review links carry a warning and raw legacy records remain in the snapshot history.

Appending verifies directly referenced registered files and expands event-ID references, including review capture IDs, revisit baselines and draft review revisions, into their backing files. Completed rounds verify their eligible captures, and completed revisits require an intact due-time observation. Unrelated historical files may be missing or empty without blocking replacement captures under new paths or other intact evidence; `status` and `render` still perform the full integrity pass and report those losses.

## Events

Below are schema examples, **not real observations**. Replace all sample identifiers, times and material paths with actual captured values. Asset files must exist and be nonempty before `append`.

### Round and attempts

```json
{
  "id": "round-20261021-am", "type": "round_started", "recordedAt": "2026-10-21T09:00:00+08:00",
  "roundId": "20261021-am", "timezone": "Asia/Taipei",
  "profile": "AI、科学、数学；希望有具体例子、独立观点及可复现方法",
  "config": {"targets": {"douyin": 25, "xiaohongshu": 25}}
}
```

Default config: `minNew:35`, `minRecommended:15` per active platform, `practicalSlots:10`, `minIntervalMinutes:20`, `shortWindowHours:6`, `lowFollowerCeiling:5000`, `lowLikeCeiling:1000`, `minNewLikes:10`, `minRelativeGrowth:0.5`, `fastLikesPerHour:100`, `accelerationRatio:2`. These are configurable working heuristics, not predictions. For a focused run also lower `minNew`, `minRecommended` and `practicalSlots` explicitly; they do not silently scale with targets.

An `attempt` adds `roundId`, `attemptId`, `status` (`running`, `paused`, `partial`, `completed`), `reason` and optional affected `platform`. A continuation reuses `roundId` with a new `attemptId`. `completed` is rejected until count and configured coverage are met. Counts remain derived from evidence, even if an attempt is marked paused/partial. Store each interruption and completion as its own event; do not modify the start event.

### Capture

```json
{
  "id": "capture-example-01", "type": "capture", "recordedAt": "2026-10-21T09:05:10+08:00", "roundId": "20261021-am",
  "work": {"id": "xiaohongshu:example", "platform": "xiaohongshu", "url": "https://www.xiaohongshu.com/explore/example", "title": "示例标题", "author": "示例作者", "dateKind": "unknown", "dateLabel": "昨天", "publishedAt": null},
  "route": "recommendation", "practicalMethod": true,
  "readKinds": ["caption_body", "image_text"], "coverage": "原页正文和第1页已读；总共3页", "gaps": ["第2–3页待补"],
  "assets": [
    {"kind": "caption", "path": "materials/xhs-example/caption.md", "sourceUrl": "https://www.xiaohongshu.com/explore/example", "capturedAt": "2026-10-21T09:04:51+08:00", "coverage": "作者标题与正文"},
    {"kind": "page_screenshot", "path": "materials/xhs-example/page-01.png", "sourceUrl": "https://www.xiaohongshu.com/explore/example", "capturedAt": "2026-10-21T09:04:52+08:00", "coverage": "实际作品页，作者、内容及互动栏", "metrics": {"likes": {"value": 17, "raw": "17", "precision": "exact"}, "favorites": {"value": null, "raw": "1.1万", "precision": "rounded"}}}
  ]
}
```

`work.id` is platform plus native ID; preserve it across all rounds. `work.url` must be a canonical URL on the matching platform and contain that same native ID: Douyin `/video/<id>` or `/note/<id>`, Xiaohongshu `/explore/<id>` or `/discovery/item/<id>` (with or without `www`). Resolve short/share links to that canonical URL before saving; tracking query parameters are allowed. `dateKind` is `published`, `edited` or `unknown`; only a confirmed original publication date sets `publishedAt`. Capture routes: `recommendation`, `related`, `search`, `direct`. `readKinds`: `caption_body` (substantive body, not title), `image_text`, `video_fragment`, `original_subtitles`, `verified_transcript`; an empty array is a saved lead, not a counted read. Eligible captures require a substantive read, caption asset and real page screenshot/video/clip. Counts use unique works; repeated reads and newness are shown separately. A lead discovered earlier only becomes previously read after eligible evidence is saved.

Asset kinds: `caption`, `page_screenshot`, `original_image`, `video`, `clip`, `frame`, `original_subtitles`, `transcript_candidate`, `platform_summary`, `image_text`, `comments`, `source_comments`, `source_page`, `source_image`, `research_note`, `metric_snapshot`. Every asset has a store-relative `path`, `sourceUrl`, `capturedAt`, `coverage`; the helper adds/verifies `sha256`. A registered file belongs to its first work and cannot be reused for another work, including normalized path aliases, symlinks and hard links across captures. Save a separate file for each work. Registered files retain both their original bytes and metadata, including capture time and metric readings. Reusing a file for the same work cannot change that metadata. Legacy reuse remains in history but cannot supply a different work or relabelled observation evidence; `status` and `render` resolve file identities when checking it.

A capture cannot list one file more than once, even through dot-segment aliases, symlinks or hard links. Round counts and new substantive reviews use resolved, first-owner assets with their original metadata. Duplicate or unowned legacy registrations cannot supply the required caption and page/video roles; keep that history and save a new valid capture.

Work-bound asset `sourceUrl` values must identify the same platform/native work as `work.id`; a new copy of another work's screenshot cannot qualify it. Explicit `source_page`, `source_image`, `source_comments` and `research_note` assets may cite external public sources. Use `source_comments` for discussion of an X original or another source, keeping `comments` for the tracked work's own comments; a review comment's platform must match its saved comment source. For homepage follower samples, save the verified creator profile as optional `work.authorUrl` (`/user/<id>` on Douyin, `/user/profile/<id>` on Xiaohongshu). A screenshot or metric snapshot containing only `followers` may use that exact profile URL; other work-bound assets still need the work URL. The collector verifies that the profile belongs to the work's author.

Only `page_screenshot` and `metric_snapshot` assets can supply observation metrics. A `metric_snapshot` is the saved visible-page/DOM reading, including the displayed labels, values and page identity, not a reconstructed researcher summary. Each metric-bearing asset has a `metrics` object with the exact same value/raw/precision schema as observations. Metric snapshots require it; screenshots used only for content do not. Readings must actually be visible in that asset. `capturedAt` is the actual screenshot/snapshot instant; do not backdate it or relabel an old capture to match a desired sample time.

A `clip` also needs actual `startSeconds`/`endSeconds`. A `transcript_candidate` needs `status: ai_extracted_unverified|partial|verified`; `verified_transcript` reading requires a verified transcript asset. `verified` is an agent attestation backed by comparison to original audio/subtitles, not a helper-generated guarantee. Detailed page/interval annotations belong in the pack's capture JSON and `coverage` text.

### Observation

```json
{
  "id": "obs-example-01", "type": "observation", "recordedAt": "2026-10-21T09:06:00+08:00", "roundId": "20261021-am", "workId": "xiaohongshu:example",
  "sampledAt": "2026-10-21T09:04:52+08:00", "evidencePaths": ["materials/xhs-example/page-01.png"],
  "metrics": {"likes": {"value": 17, "raw": "17", "precision": "exact"}, "favorites": {"value": null, "raw": "1.1万", "precision": "rounded"}}
}
```

Supported public metrics: `likes`, `favorites`, `comments`, `shares`, `followers`. Each uses `value`, literal `raw` count and `precision: exact|rounded|unavailable`. Unknown/rounded numeric values are null. Rounded readings require a nonempty visible display; use `unavailable` when nothing was shown. Exact displays accept integers and comma grouping; keep labels separately in evidence. A homepage follower reading at another time gets its own observation. The latest available reading is tracked separately per metric; an unavailable later reading does not erase earlier data or refresh its timestamp. If the later value is rounded, show it as rounded rather than reusing an older exact number.

Every `evidencePaths` entry must be a saved metric-bearing screenshot/snapshot for this work, captured at the same instant as `sampledAt` (equivalent timezone offsets are accepted). Each observation metric must match at least one referenced asset's reading; multiple referenced readings for that metric must agree. A caption, screenshot without metrics, stale capture or mismatched count is rejected. For a fresh revisit, save fresh evidence before appending the observation. Do not include unrelated content assets in observation evidence.

Legacy observations lacking this binding are preserved in the ledger but excluded from latest metrics and growth. `snapshot.json` exposes per-work `evidenceGaps`, also shown in HTML and CSV. Such observations cannot serve as revisit baselines or satisfy revisit completion. Replaying an unchanged legacy observation is a no-op, not a new endorsement; collect a new sample instead of changing old timestamps/values to repair it.

Growth uses adjacent available like observations by **sampling** time. Both must be exact, at least `minIntervalMinutes` apart and at most `shortWindowHours` apart to flag short-term growth. Shorter windows retain delta but no hourly rate; longer ones display a cross-round average without short-term flags. Decreases are flagged, never converted to growth. Rounded intermediate samples break exact comparison. Zero-to-positive changes have null relative percentage, not infinity. Acceleration needs three eligible consecutive points and a positive earlier speed; a zero earlier speed is not an infinite acceleration claim. The chart always preserves the original points and times.

Growth thresholds come from the round of the latest valid, available like sample; the low-follower threshold separately comes from the round of the latest available follower sample. Content-only captures, old-round backfills and unavailable readings do not select a new metric configuration.

### Review

A `review` adds `workId`, `captureIds` (saved captures actually read), `summary`, `opportunity`, `angle`, `recommendation: shortlist|watch|archive`, `evidencePaths` and arrays:

- `gaps`: remaining missing material/verification.
- `sourceRefs`: `{url, status: exact|account_clue|unverified, note}`. An `exact` reference requires a registered `source_page`, `source_image` or `research_note` with the same `sourceUrl`, cited in the review's `evidencePaths`. Store original text/translation in assets, and explain source clusters in `note`.
- `claims`: `{text, status: verified|author_report|inference|unresolved, evidencePaths}`. Evidence paths refer to captured assets, including primary-source checks saved as research notes.
- `comments`: `{platform: douyin|xiaohongshu|x, kind: disagreement|request|meme|support|ai|other, sampledCount, summary, evidencePaths}`. Empty means no verified discussion, not zero total comments. The detailed reply structure lives in the comments asset.

All referenced evidence must already be registered for that work. At least one referenced `captureIds` entry must be an eligible substantive read with both a caption and page screenshot/video/clip; unreferenced reads do not qualify a title-only lead. Each comment summary must reference at least one asset of kind `comments` or `source_comments` on its stated platform; additional screenshots or caption context are allowed but cannot replace the saved comments. Reader payloads are proposed reviews; the collector reconciles them and appends them. The latest valid review drives the report; all older reviews remain.

Historical reviews are checked against the same ownership, provenance and substantive-read rules before becoming current. The latest valid review drives recommendations and drafts; unsupported revisions remain in `reviews` history with `reviewGaps` shown in HTML/CSV, and cannot place a work in today's shortlist.

### Tasks, selection and drafts

A `task` adds `roundId`, `workId`, stable `taskId`, `kind: revisit|backfill`, `status: pending|done|cancelled`, `reason`, and `dueAt` (nullable for backfill). Revisit tasks also reference `baselineObservationId`; due time must be at least the configured interval after that saved like observation. Both the baseline and the due-time like reading must be available (exact or rounded); an unavailable reading keeps the revisit pending. The revisit baseline and deadline remain immutable across revisions (equivalent timezone offsets are accepted); create a new task ID to reschedule. Marking a revisit done requires a later saved like observation at/after its original due time. Updating a task appends a new event with the same `taskId`. Status exposes due tasks; it does not run a scheduler.

A `decision` adds `workId`, `decision: selected|watch|rejected`, `reason` and `userRequest` preserving the real user instruction. Never fabricate a selection from a model's shortlist. `watch` removes the work from the priority shortlist; `rejected` removes it from both shortlist and watchlist while retaining its materials and task history.

A `draft` adds `workId`, `selectionEventId`, `reviewId`, `status: draft`, `briefPath`, `scriptPath`, `evidencePath`. All three files must already exist. The helper rejects registration unless the latest user decision selects that work and `reviewId` names the latest review for it at registration time. After a correction, reread the latest review and update the new draft; do not use a superseded review. Historical drafts retain their original review IDs and can be replayed unchanged. Hashes protect saved draft revisions. The helper records drafts generated by the agent; it does not generate text or mark it published. A later rejection preserves historical drafts while preventing new ones.

The optional `hashes` field must be a JSON object when supplied, including when empty; arrays, null and primitives are rejected before saving. Omit it to let the helper calculate all three hashes, or supply existing hashes to verify them.

Brief, script and evidence paths must resolve to three different files, separate from every registered capture asset; aliases and hard links do not create separate documents or turn raw sources into drafts. Historical draft hash protection also compares resolved file identities, so an alternative spelling cannot overwrite an earlier registered document. Missing unrelated old drafts do not block new draft files; their original paths remain reserved and full integrity checks continue reporting their loss.

## Limits

The helper validates structure, identity, file presence/hashes, reference integrity and arithmetic. It cannot determine whether a screenshot really contains a work, an image was actually read, a source claim is true, a userRequest is authentic or a transcript is complete. The browser collector and reviewer must verify those facts. Synthetic tests do not establish live platform capability.
