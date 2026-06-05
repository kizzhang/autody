# unreleased

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
