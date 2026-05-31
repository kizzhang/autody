# Agent Guide

Use this repository only for the user's own Douyin creator account or explicitly authorized creator data.

Start with `skills/douyin-analysis/SKILL.md`. Run an audit first, backfill only missing fields, persist after every item, and close every Doubao/transcript page immediately after saving the result. When generating an HTML report, also read `skills/douyin-analysis/references/report-design.md`.

For npm installs, ask the user to run `npx autody install` or run `autody install` if the package is already installed. The CLI only copies the packaged skill into `$CODEX_HOME/skills` or `~/.codex/skills`; it must not inspect browser storage or account data.

Recommended prompt:

```text
Use $douyin-analysis to analyze my own Douyin works. Save progress after each item, backfill missing deep metrics and Top comments, extract transcripts one by one, and export JSON, CSV, Markdown, and an HTML report.
```

Never inspect, export, or commit cookies, passwords, browser storage, `.auth/`, `.cheat-cache/`, or raw private account dumps.
