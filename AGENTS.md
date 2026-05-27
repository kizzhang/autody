# Agent Guide

Use this repository only for the user's own Douyin creator account or explicitly authorized creator data.

Start with `skills/douyin-analysis/SKILL.md`. Run an audit first, backfill only missing fields, persist after every item, and close every Doubao/transcript page immediately after saving the result.

Recommended prompt:

```text
Use $douyin-analysis to analyze my own Douyin works. Save progress after each item, backfill missing deep metrics and Top comments, extract transcripts one by one, and export JSON, CSV, and Markdown.
```

Never inspect, export, or commit cookies, passwords, browser storage, `.auth/`, `.cheat-cache/`, or raw private account dumps.
