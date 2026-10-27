# unreleased

README visual refresh:

- Restores the burgundy visual identity and recognizable platform icons. The new hero shows one topic branching into Xiaohongshu and Douyin, then converging on a cited research report.
- Shortens the README around the first prompt, research outputs and follow-up requests. Installation details, resuming and Skill orchestration now have linked guides in `docs/`.
- Updates installation to use `main` after the topic workflow merged in PR #10. Documentation policy checks follow the new guide locations.

Topic orchestration preview `0.0.5-topic.1` (GitHub only; no npm publication):

- Adds `autody` as the one-topic entry point: search both platforms, read and assess relevant sources, review/backfill, synthesize a cited report. The agent executes Chrome actions; the CLI prepares/resumes local tasks.
- Installs ten skills and connects the existing account stages for end-to-end requests while preserving explicitly requested command boundaries and separate platform metrics.
- Adds stable topic stores, explicit new rounds, per-platform blockers, partial delivery, and HTML/Markdown/JSON plus evidence CSV. Completion requires intact searches, relevant current-round reads, supported reviews, closed due tasks and citations from both platforms.
- Adds orchestration and installer regression tests for resumed tasks, coverage, relevance, review gates, file loss, report integrity and safe HTML rendering.
- On 2026-10-27, ran a Windows Chrome topic pilot with three Xiaohongshu works and three Douyin works. Human login/SMS verification was required on Xiaohongshu. Original captions/images/comments were read; this is not validation of full video transcription, 50-item collection or unattended scheduling. See `docs/validation/2026-10-27-topic-research.md`.
- Rewrites the README and workflow illustrations around topic input and automatic stage continuation.

Earlier public topic radar implementation (included in this preview):

- Adds `social-radar` for public Douyin/Xiaohongshu discovery, preserved originals/comments, X provenance, timed revisits and user-selected spoken-script drafts.
- Includes a local append-only event ledger, file hashes, resumable rounds, due/backfill tasks, growth checks and a searchable HTML/JSON/Excel-readable CSV report. Reports prepare agent instructions; they do not mutate the ledger in-browser.
- Originally extended the installer to nine skills; the topic coordinator brings the total to ten. Own-account analytics remain separate from public research. Scheduling remains host-managed and requires a user request.
- Local synthetic tests cover recording/replay, interrupted rounds, exact/rounded counts, timing boundaries, source integrity, selection-gated drafts and rendering. The new topic pilot covers a small live dual-platform sample; full transcript accuracy and a 50-item discovery run remain unverified.
- Review hardening binds each observation to fresh metric-bearing evidence and immutable capture metadata, excludes unsupported legacy readings from derived growth, rejects impossible calendar dates, keeps public titles out of copied commands, honors watch/reject decisions, and requires new drafts to use the latest review revision. Captures of one work keep a consistent author profile and publication chronology, earlier-round backfills count as previous reads, and a lead keeps its discovery route for round coverage. Missing or edited registered files are reported and excluded instead of disabling status/render, a compact `summary` command supports resuming, mistaken metric readings can be corrected by a linked observation, future save times are rejected, profile screenshots cannot stand in for work pages, and captured page content is treated as data rather than instructions.

Xiaohongshu prerelease `0.0.4-xhs.1`:

- Adds `xiaohongshu-analysis` for note links submitted to the homepage Diandian AI in the existing Chrome session.
- Separates source-page metadata and visible metrics from unverified AI transcript candidates; exports a Xiaohongshu ledger without invoking Douyin metric/report scripts.
- Includes the new skill in CLI install and package checks. One 6:30 video note and two assistant turns were tested; full transcript accuracy, image OCR, bulk runs and private analytics remain unverified.
- Adds installation and package-completeness regression tests. Publishing the npm prerelease or advancing its `latest` tag is a separate release step.

Chrome Extension-only collector guidance.

- Changes `douyin-analysis` to prefer the Codex Chrome Extension / Chrome plugin for creator-center collection.
- Adds `references/chrome-extension-workflow.md` with tab claiming, works list, video analytics, Top comments, safety, provenance, and fallback boundaries.
- Removes the separate Python browser collector from the packaged skill.
- Updates README and AGENTS prompts so agents use the user's existing Chrome session only.
- Adds command-like Codex skill entries: `/kaishi`, `/gengxin`, `/buchong`, `/tijian`, `/baogao`, and `/html`.
- Keeps `douyin-analysis` as the shared base layer for safety rules, schemas, Chrome Extension workflow, and deterministic scripts.
- Adds Lumina-only HTML rendering with a fresh `report_lumina_payload.json` generated from current source data every run.
- Updates the CLI installer so one install copies all Autody skills.

# release0.0.3

Report-readiness release.

- Adds `references/report-design.md` so agents can turn collected Douyin data into readable HTML dashboards, factor maps, sample reviews, and next-batch roadmaps.
- Updates the `douyin-analysis` skill to include HTML report outputs and explicit chart/card presentation requirements.
- Updates README with a clearer quickstart, first-party-only policy, output list, and visual report preview.
- Adds `assets/report-preview.svg` for human and agent-friendly repo guidance.
- Extends `autody doctor --package-only` coverage to verify the report design reference is packaged.

# release0.0.2

NPM package release.

- Adds `package.json` for the public `autody` npm package.
- Adds the `autody` CLI with `install`, `doctor`, and `skill-path` commands.
- Supports `npx autody install` to copy the `douyin-analysis` Codex skill into `~/.codex/skills`.
- Keeps installation explicit; there is no automatic environment mutation in `postinstall`.

# release0.0.1

Initial open release of Autody / 抖音分析.

- Adds the `douyin-analysis` Codex skill.
- Adds incremental gap audit and merge scripts.
- Adds browser-based Douyin creator-center deep metrics backfill.
- Documents first-party-only acceptable use and browser-session safety.
- Provides simple visual guidance for humans and agent-readable workflow docs.
