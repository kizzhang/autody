# Topic research execution

The user supplies a topic, not URLs or a command sequence. The agent owns search, collection, analysis and delivery. This file describes the local helper interface; the active host's documented Chrome integration performs UI work.

## Start and search plan

Use absolute script/output paths on Windows. Keep evidence in the user's project output category, outside the checkout and installed skills. In the examples, `<helper>` is the absolute `autody/scripts/research.cjs` path and `<store>` is the exact returned store.

```text
node <helper> start --topic "AI 编程如何改变产品经理" --root <project-output-root>
node <helper> plan --store <store> --input <plan.json>
node <helper> next --store <store>
```

`start` defaults to six works per platform; `--per-platform 3` creates a smaller explicit pilot. It uses zero recommendation and practical-method quotas. `--profile` optionally records the creator brief and `--timezone` overrides the host timezone. Repeating a topic resumes it, without discarding progress or silently changing its target. `--refresh` starts a new round while retaining old evidence and reports; do not use it just because the previous attempt was interrupted. New rounds reuse the same topic store, so no monthly reset is required for this bounded topic workflow.

Before browsing, use the topic's concepts and audience to derive a small search plan. Start with one focused phrase per platform; add an alternative or counterpoint query when it addresses an evidence gap. Do not run a grid of guessed URLs. For example:

```json
{"brief":"产品经理实际交付能力和边界，兼顾不同观点","queries":[{"platform":"douyin","query":"AI 编程 产品经理"},{"platform":"xiaohongshu","query":"AI 编程 产品经理"}]}
```

`plan` replaces unexecuted queries and preserves completed searches. `next` supplies stable query IDs. Use the visible search box; confirm that a result page actually appears. The Xiaohongshu homepage may have a multiline field where Enter inserts a newline and the unlabeled `+` opens attachments: inspect the visible magnifying-glass control instead. A header search field may submit with Enter. On regional redirects or verification, use normal visible login and resume after the human step; do not change network/security settings.

Save the actual result snapshot, with sampling time and search URL, under `searches/`. Register the search:

```json
{"queryId":"<from-next>","url":"<actual-search-page-url>","capturedAt":"<actual-ISO-time>","evidencePath":"searches/douyin-01.txt","resultUrls":["<observed-work-url>"],"notes":"Which results fit, which were irrelevant, and whether the search was exhausted."}
```

```text
node <helper> search --store <store> --input <search.json>
```

Never store login redirect parameters or credentials. Short links must resolve through the normal browser to a canonical work URL. Retain required public access parameters only locally. A search may legitimately have zero results; record it, refine once if useful, and deliver partial if scope cannot be met. Search text is not evidence that a work was read.

## Read, assess, review and backfill

Use the sibling radar's [record contract](../../social-radar/references/data-contract.md). `start` already creates its round; all captures for this attempt use the returned `roundId`.

```text
node <radar-script> append --store <store> --input <capture.json>
node <helper> assess --store <store> --input <assessment.json>
```

```json
{"workId":"<platform:native-id>","captureId":"<saved-read-capture-id>","relevant":true,"reason":"How the actual content addresses this topic, not just the matching title."}
```

Save original captions and page screenshots before the next item. A substantive caption can be read as caption content, but never label it a complete video transcript. Image pages and video intervals get explicit coverage and gaps. For needed transcript extraction, read `../../xiaohongshu-analysis/references/diandian-workflow.md` or the Doubao prompt section in `../../douyin-analysis/references/douyin-workflow.md`; only the public extraction substep applies, not those skills' private creator-data workflows. Preserve AI candidates separately from author text. A content-only screenshot is not a fresh metric observation.

Write a radar `review` for each relevant eligible work, citing captures from the current round. Use [reading-and-drafting.md](../../social-radar/references/reading-and-drafting.md). Capture actual comment discussions where useful; a failed/unavailable comment view is a recorded gap. Backfill materially important omissions with one targeted attempt, then record the result and close the backfill task with its remaining limitation. Do not loop indefinitely to obtain a perfect transcript. Without enough original content, choose another relevant work and retain the lead as incomplete.

`next` reads real evidence and reviews; do not edit `task.json` to advance stages. If access is blocked, use `block` with `{"platform":"xiaohongshu","reason":"Exact visible verification and current page"}`. Continue the other platform. After the user resolves it and normal access is visible, pass the resolution to `unblock`. This preserves the same round and successful sources. A deferred growth revisit is not mandatory for an ordinary topical report; do not manufacture short-term growth from a single sample.

## Synthesis and deliverable

Compare the platforms' sampled angles, audience questions, examples and limitations. Identify duplicates and promotional claims. Treat popularity as one observation, not proof of truth or audience-wide consensus. Prefer primary-source checking for technical claims that the report adopts as fact.

```json
{
  "summary":"Evidence-backed overall conclusion; distinguish observation from inference.",
  "findings":[{"title":"A supported finding","explanation":"What the sources establish and what remains uncertain.","sourceIds":["<reviewed-work-id>"]}],
  "angles":[{"title":"An original content proposal","explanation":"Audience, useful question, what the creator adds and a proposed format.","sourceIds":["<reviewed-work-id>"]}],
  "gaps":["Sampling and source limitations"],
  "partial":false
}
```

```text
node <helper> finish --store <store> --input <synthesis.json>
```

`finish` requires saved searches, sufficient relevant reads and valid current-round reviews on both platforms, plus source citations from both. Collection counts alone never complete the task. With a blocker, set `partial:true` and explain the missing scope; partial delivery retains the remaining actions. Each delivery gets its own directory, leaving prior reports intact. Changed evidence/reviews or missing report files invalidate completion and require regeneration.

Open the returned `research.html`, inspect desktop/narrow layouts when tools permit, and give the user its path with the main findings. It links the detailed radar evidence report and CSV. It is a report, not a fake execution console; the agent has already performed the workflow without asking the user to copy action prompts.
