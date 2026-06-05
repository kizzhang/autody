# Agent Guide

Use this repository only for the user's own Douyin creator account or explicitly authorized creator data.

Start with `skills/douyin-analysis/SKILL.md`. This is Chrome Extension-first: use the Codex Chrome Extension / Chrome plugin to claim or open the user's existing Chrome creator-center tab, read visible Douyin creator data, and save progress after every item. Read `skills/douyin-analysis/references/chrome-extension-workflow.md` before collecting account data.

Run an audit first, backfill only missing fields, persist after every item, and close every Doubao/transcript page immediately after saving the result. When generating an HTML report, also read `skills/douyin-analysis/references/report-design.md`.

For installs, prefer `node bin/autody.js install --force` from a GitHub checkout, or `npx autody@latest install --force` only when the npm package is available. The CLI only copies the packaged skill into `$CODEX_HOME/skills` or `~/.codex/skills`; it must not inspect browser storage or account data.

Recommended prompt:

```text
Use $douyin-analysis with the Chrome Extension-first workflow to analyze my own Douyin works. Save progress after each item, backfill missing deep metrics and Top comments, extract transcripts one by one, and export JSON, CSV, Markdown, and an HTML report.
```

Never inspect, export, or commit cookies, passwords, browser storage, `.cheat-cache/`, or raw private account dumps.
