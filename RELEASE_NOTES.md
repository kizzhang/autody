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
- Adds Playwright-based Douyin creator-center deep metrics backfill.
- Documents first-party-only acceptable use and browser-session safety.
- Provides simple visual guidance for humans and agent-readable workflow docs.
