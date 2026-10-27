# Own-account orchestration

For an end-to-end account review, the command skills are stages owned by the agent, not steps to give back to the user. Their narrow boundaries still apply inside each stage.

1. Locate the existing account baseline. For the authorized Douyin account, use `kaishi` if none exists, otherwise `gengxin`.
2. Run `tijian`; use `buchong` for actionable missing/stale fields, then rerun the audit. Limit repeated attempts on the same inaccessible field; preserve its gap.
3. When analysis is requested, run `baogao` against the current baseline; then `html` when a visual report is requested or appropriate to the requested end-to-end report. No additional user command is needed between stages. Preserve blind-score-blocked and provisional-data states.
4. Persist each stage's progress and deliver paths, findings and unresolved gaps together.

A request strictly for a named command retains that command's scope. A broad request to update and report authorizes chaining all needed stages. Topic research uses the public radar ledger and topic renderer; never feed Xiaohongshu/public radar records into Douyin-only analytics scripts.

Xiaohongshu currently supports visible public-note research and extraction. Own-account backend analytics are not implemented: report that limitation precisely instead of claiming parity with Douyin. This coordinator does not invent unavailable retention, plays or reach.
