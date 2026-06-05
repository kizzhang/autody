# Autody Command Skills Design

Date: 2026-06-06
Status: Proposed for user review

## Goal

Autody should feel like a creator workflow inside Codex, not a prompt that the user has to remember. The package will expose short command-like skill entries for the main work modes:

- `/kaishi`: first-time full Douyin account baseline.
- `/gengxin`: later incremental update.
- `/buchong`: targeted backfill for known gaps.
- `/tijian`: data quality audit.
- `/baogao`: report generation from an existing baseline.
- `/html`: Lumina HTML rendering from existing baseline/report data.

Version 1 implements `/kaishi` and `/html`. The other four names are reserved in docs and package structure so the workflow can grow without renaming the product later.

## Product Decision

Use Codex skills as the command surface. Codex app exposes enabled skills in the slash command list, and skills are the supported reusable-workflow format. Deprecated custom prompts are not the long-term path. The skill names should be short, pinyin, and creator-friendly; the UI display names and descriptions should be Chinese.

The existing `douyin-analysis` skill remains the shared base layer. It owns safety rules, Chrome Extension collection details, output schemas, references, and deterministic scripts. The new command-like skills are thin intent wrappers that choose the right workflow without asking the user to remember a long prompt.

HTML output should not expose a three-template picker. Use the existing Lumina visual system only. The historical Lumina source files found during design are:

- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/superdesign_lumina_dashboard_2026-05-31.html`
- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_superdesign_hero_variants_2026-05-31.cjs`
- `/Users/kaneki/Projects/fun/content/outputs/competitor_ai_research_2026-06-05/build_autody_lumina_competitor_report_2026-06-05.cjs`

Guizang report variants are the reuse model for `/html`: keep the visual grammar stable, but rebuild the view model from current data every run. The useful source is `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_taste_guizang_variants_2026-05-31.cjs`. It separates `loadModel()` from `renderPage()`, which is the right shape for Autody reuse.

## Scope

V1 is Douyin-only. It analyzes only the user's own account or explicitly authorized creator data.

`/kaishi` creates a baseline dataset. It does not generate strategy reports, content advice, or retrospective analysis. Reports belong to `/baogao`.

`/html` renders an existing baseline or report payload into Lumina HTML. It does not collect browser data and does not choose between multiple visual templates. Every `/html` run must rebuild its analysis/view payload from the latest input data; it must not reuse stale conclusions from an older report just because the visual template is reused.

`/kaishi` uses the Codex Chrome Extension / Chrome plugin for all Douyin creator-center browser work. It must not use Playwright, a second browser profile, cookie inspection, localStorage inspection, password/session-store inspection, or raw private browser dumps.

## Command Catalog

### `/kaishi`

Display name: `开始建档`

Purpose: first full baseline for the user's Douyin creator account.

Required outcome:

- Create or reuse `outputs/douyin_analysis_YYYY-MM-DD/`.
- Collect the full published works list from creator center.
- Persist works with `index`, `mid`, `publicUrl`, `publishedAt`, `caption`, `itemType`, `plays`, `likes`, `comments`, `shares`, and `favorites`.
- Open each creator-center analytics page and collect visible deep metrics.
- Open one Doubao page/chat per item to extract transcript or image-text body, then close that page.
- Collect Top comments where visible.
- Save progress after every item.
- Run audit.
- Run merge.
- Produce JSON, CSV, and Markdown baseline outputs.
- Record unavailable fields as `dataGap`.

Out of scope:

- HTML dashboard generation.
- Strategic content recommendations.
- Non-Douyin platforms.
- Automated login, CAPTCHA, permission, or account-side actions.

### `/gengxin`

Display name: `更新`

Purpose: later incremental update. It should find new works and refresh stale public metrics without rebuilding already complete records.

Reserved for v2.

### `/buchong`

Display name: `补充`

Purpose: targeted gap backfill from a `content_gap_audit*.json` file. It should focus on missing transcripts, comments, or deep metrics.

Reserved for v2.

### `/tijian`

Display name: `体检`

Purpose: local-only data quality check. It should run deterministic audit scripts and summarize duplicate IDs, empty transcripts, missing comments, missing URLs, and missing deep metrics.

Reserved for v2.

### `/baogao`

Display name: `报告`

Purpose: turn an existing complete or near-complete baseline into analysis outputs such as HTML reports, sample reviews, factor maps, and next-batch suggestions.

Reserved for v2.

### `/html`

Display name: `HTML`

Purpose: render an existing Autody baseline or report payload into the Lumina HTML template.

Required outcome:

- Locate the target run folder, normally `outputs/douyin_analysis_YYYY-MM-DD/`.
- Prefer `douyin_deep_works_final.json` as the data input.
- Rebuild a fresh `report_lumina_payload.json` from current input data before writing HTML.
- Use the packaged Lumina visual system/workflow reference, derived from the existing Lumina and Guizang build scripts.
- Write `report_lumina.html` or another explicit Lumina HTML file into the run folder.
- Keep the source JSON next to the HTML.
- Report the output path and any data quality caveats.

Out of scope:

- Browser collection.
- Transcript or metric backfill.
- Three-template selection.
- Reusing old strategic conclusions without rechecking them against the current input data.
- Strategic conclusions that are not supported by the current input data.

## Architecture

The package should contain:

- `skills/douyin-analysis/`: shared base skill and references.
- `skills/kaishi/`: command-like skill for first-time baseline.
- `skills/html/`: command-like skill for Lumina HTML rendering.
- Future `skills/gengxin/`, `skills/buchong/`, `skills/tijian/`, and `skills/baogao/`.
- `bin/autody.js`: installation, doctor checks, and package utilities.
- `scripts/validate_chrome_extension_policy.cjs`: policy guard against removed browser collectors and forbidden browser-state access.
- Existing deterministic scripts under `skills/douyin-analysis/scripts/`.
- `skills/douyin-analysis/scripts/render_lumina_report.cjs`: deterministic Lumina renderer. It should read current run data, render the stable Lumina visual system, and embed a freshly generated payload. Any higher-level narrative supplied by the agent must be regenerated for the same source data before render.

`skills/kaishi/SKILL.md` should be small. It should:

- State when `/kaishi` is used.
- Require reading `../douyin-analysis/SKILL.md`.
- Require reading `../douyin-analysis/references/chrome-extension-workflow.md`.
- Define the first-run completion checklist.
- Point to audit and merge scripts.
- Stop at baseline outputs.

`skills/kaishi/agents/openai.yaml` should provide a Chinese display name, short description, icon, brand color, and default prompt.

`skills/html/SKILL.md` should be small. It should:

- State when `/html` is used.
- Require reading `../douyin-analysis/references/report-design.md`.
- Require reading the Lumina template/workflow reference.
- Use only the Lumina visual system.
- Regenerate report analysis from the latest data every run.
- Stop if no usable baseline/report data exists.
- Avoid browser collection and backfill.

## Data Flow

1. User invokes `/kaishi` in Codex.
2. Codex loads the `kaishi` skill.
3. `kaishi` delegates shared rules to `douyin-analysis`.
4. Chrome Extension claims or opens the user's logged-in `creator.douyin.com` tab.
5. Works list is collected into `douyin_works_final.json`.
6. Per-item analytics and Top comments are written to `deep_metrics_progress.json`.
7. Per-item transcript extraction is written to `transcript_progress.json` and mirrored into final work records.
8. Audit writes `content_gap_audit.json`.
9. Merge writes `douyin_deep_works_final.json`, `douyin_deep_works_final.csv`, and `douyin_deep_transcripts_final.md`.
10. The agent reports counts, output paths, and remaining `dataGap` items.

## Error Handling

If Chrome Extension is unavailable or disconnected, `/kaishi` stops and asks the user to reconnect it.

If creator center requires login, QR scan, CAPTCHA, permission, or account-side confirmation, `/kaishi` asks the user to complete that action in Chrome.

If a field is not visible or exportable in Chrome, `/kaishi` records a `dataGap` entry with the page checked and reason.

If Doubao cannot extract a transcript for an item, `/kaishi` records transcript status and continues to the next item.

If a run is interrupted, `/kaishi` resumes from progress files and preserves existing records unless the user explicitly asks for a force rerun.

## Testing And QA

The implementation should verify:

- `npm test` passes.
- `npm run pack:dry` includes the new skill files and excludes deleted browser collectors.
- `autody doctor --package-only` passes.
- A tarball install copies `douyin-analysis`, `kaishi`, and `html` into a temporary Codex home.
- The installed skill scan contains no Playwright, `douyin-session`, cookie, localStorage, `.auth/`, or deleted Python collector references.
- `/kaishi` docs do not promise report generation.
- `/html` docs promise Lumina only and do not mention a three-template picker.
- `validate_chrome_extension_policy.cjs` checks every new command skill that can touch Douyin data.

Manual QA for the browser workflow should run on the user's own Douyin account and confirm that a resumed `/kaishi` run does not duplicate records or overwrite existing good transcripts.

## Migration

The current PR branch already removed the old Playwright collector and installed a Chrome Extension-first `douyin-analysis` skill. The next implementation should add `kaishi` without undoing that work.

README and AGENTS should move the recommended user entry from a long prompt to `/kaishi`, while still documenting `$douyin-analysis` as the underlying shared skill.

The CLI install output should mention `/kaishi` for first baseline and `/html` for Lumina HTML rendering after install.

## Open Questions

No unresolved product questions remain for v1. The command names are fixed as `/kaishi`, `/gengxin`, `/buchong`, `/tijian`, `/baogao`, and `/html`; v1 implements `/kaishi` and `/html`. `/html` uses Lumina only.
