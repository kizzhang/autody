# Agent Guide

Use this repository only for the user's own Douyin creator account or explicitly authorized creator data.

Start with a command skill when the user names one:

- `/kaishi`: `skills/kaishi/SKILL.md` for first full baselining.
- `/gengxin`: `skills/gengxin/SKILL.md` for incremental updates.
- `/buchong`: `skills/buchong/SKILL.md` for audit-driven backfill.
- `/tijian`: `skills/tijian/SKILL.md` for local audit-only checks.
- `/baogao`: `skills/baogao/SKILL.md` for fresh report analysis.
- `/html`: `skills/html/SKILL.md` for Lumina HTML rendering.

Use `skills/douyin-analysis/SKILL.md` as the shared base layer. Collection is Chrome Extension-first: use the Codex Chrome Extension / Chrome plugin to claim or open the user's existing Chrome creator-center tab, read visible Douyin creator data, and save progress after every item. Read `skills/douyin-analysis/references/chrome-extension-workflow.md` before collecting account data.

Run an audit first, backfill only missing fields, persist after every item, and close every Doubao/transcript page immediately after saving the result. `/kaishi` must stop at baseline outputs and should not create strategy reports or HTML. `/baogao` must recompute analysis from the latest data every run. `/html` must use Lumina only, rebuild a fresh payload from current source files, and treat older HTML as visual reference only.

For installs, prefer `node bin/autody.js install --force` from a GitHub checkout, or `npx autody@latest install --force` only when the npm package is available. The CLI only copies the packaged skill into `$CODEX_HOME/skills` or `~/.codex/skills`; it must not inspect browser storage or account data.

Recommended prompt:

```text
Run /kaishi for my own Douyin creator account. Use Chrome Extension-first collection, save progress after each item, extract transcripts one by one, audit gaps, and merge JSON, CSV, and Markdown baseline outputs.
```

Never inspect, export, or commit cookies, passwords, browser storage, `.cheat-cache/`, or raw private account dumps.
