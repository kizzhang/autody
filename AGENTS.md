# Agent Guide

Creator analytics and the existing Douyin/Xiaohongshu analysis skills remain limited to the user's own account or explicitly authorized creator data. Public topic research uses the separate `skills/social-radar/SKILL.md` workflow: visible public works, comments and X source provenance only, without private analytics or account interactions.

For public discovery, watchlists, timed engagement changes, evidence packs or selected-topic spoken drafts, use `social-radar`. Save sources before reading in parallel when delegation is available and permitted; one collector controls Chrome and writes the ledger. Reuse its persistent store and logical round after interruption. The local helper validates records and renders HTML/CSV; collection and drafting run through the agent. Draft only after the user selects a topic, keep status `draft`, and do not publish. Installing the skill does not create a recurring schedule.

For Xiaohongshu note links, use `skills/xiaohongshu-analysis/SKILL.md`. Open the homepage's 点点 AI in the existing logged-in Chrome session, submit one note link at a time, and keep source-page metadata separate from AI-extracted transcript candidates. The following command workflows and metric scripts are Douyin-specific; do not run them against Xiaohongshu data.

Start with a command skill when the user names one:

- `/kaishi`: `skills/kaishi/SKILL.md` for first full baselining.
- `/gengxin`: `skills/gengxin/SKILL.md` for incremental updates.
- `/buchong`: `skills/buchong/SKILL.md` for audit-driven backfill.
- `/tijian`: `skills/tijian/SKILL.md` for local audit-only checks.
- `/baogao`: `skills/baogao/SKILL.md` for fresh report analysis.
- `/html`: `skills/html/SKILL.md` for Lumina HTML rendering.

For Douyin commands, use `skills/douyin-analysis/SKILL.md` as the shared base layer. Collection is Chrome Extension-first: use the Codex Chrome Extension / Chrome plugin to claim or open the user's existing Chrome creator-center tab, read visible Douyin creator data, and save progress after every item. Read `skills/douyin-analysis/references/chrome-extension-workflow.md` before collecting Douyin account data.

Run an audit first, backfill only missing fields, persist after every item, and handle Douyin/Doubao pages at human pace: one active item, wait for visible stability, save, then continue. `/kaishi` must stop at baseline outputs and should not create strategy reports or HTML. `/baogao` must recompute analysis from the latest data every run. `/html` must use Lumina only, rebuild a fresh payload from current source files, and treat older HTML as visual reference only.

For installs, prefer `node bin/autody.js install --force` from a GitHub checkout, or `npx autody@latest install --force` only when the npm package is available. The CLI only copies the packaged skill into `$CODEX_HOME/skills` or `~/.codex/skills`; it must not inspect browser storage or account data.

Recommended prompt:

```text
Run /kaishi for my own Douyin creator account. Use Chrome Extension-first collection, save progress after each item, extract transcripts one by one, audit gaps, and merge JSON, CSV, and Markdown baseline outputs.
```

Never inspect, export, or commit cookies, passwords, browser storage, `.cheat-cache/`, or raw private account dumps.
