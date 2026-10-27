# Topic workflow pilot — 2026-10-27

## What actually ran

- Host: Windows, existing signed-in Chrome session through the host Chrome integration.
- Topic: **AI 编程如何改变产品经理**. Search phrase: **AI 编程 产品经理** on both platforms.
- Explicit pilot target: 3 substantive works per platform. Product default remains 6 per platform.
- Started one stable topic task, saved both search snapshots, opened works from search, captured original material, assessed topic relevance, wrote six evidence-backed reviews, then generated the cross-platform synthesis and evidence report.
- Final helper state: `completed`; Douyin 3/3, Xiaohongshu 3/3, six valid reviews, zero active blockers, zero ledger integrity gaps, no remaining actions.
- Outputs: research HTML/Markdown/JSON and evidence HTML/JSON/CSV. All raw captures remain in the operator's local project; they are not included in the repository or sharing ZIP.

## Sources and actual coverage

| Platform / work | What was read | Limits |
| --- | --- | --- |
| [小红书：产品经理用AI写代码之后，每天都在做QA](https://www.xiaohongshu.com/explore/69e4e9c2000000001d01a3fc) | All three image pages, caption, visible critical comments and author's reply | Personal account of a debugging failure; project not independently verified |
| [小红书：产品经理VibeCoding标准流程](https://www.xiaohongshu.com/explore/6a4b4d940000000016024988) | Full long caption, cover, comment view | No comments shown; small laptop-screen text not claimed as read; speed claims unverified |
| [小红书：一个人上线一个产品，写代码只用了三天](https://www.xiaohongshu.com/explore/6adccb45000000002a01d8dd) | All three image pages and caption | Existing company environment and eight years of product experience are material conditions; no comments shown |
| [抖音：大厂AI 产品经理工作方法和经验分享](https://www.douyin.com/video/7691291003726105902) | Expanded full caption, selected visible comments and author's checkpoint reply | 19:29 video not fully transcribed; AI sidebar returned an empty pane |
| [抖音：产品经理如何做「定向岗位」作品集](https://www.douyin.com/video/7673681509173251362) | Expanded full caption and visible tool-access discussion | 2:07 video not fully transcribed; promoted tool and job-search benefit not independently tested |
| [抖音：AI 将如何赋能产品经理](https://www.douyin.com/video/7651921103333444918) | Full caption and substantive comments with contrasting views | 1:46 video not fully transcribed; comment sample is not all 668 comments |

Public links above omit local access parameters. Platforms may require a fresh signed-in browser visit. Month/day or relative dates remain literal when the year was not verified.

## Interruptions and fixes

Xiaohongshu first redirected to a regional site and required login after a device limit. A later search triggered SMS verification. The human completed those steps; the agent verified normal search access and resumed the existing round. The user supplied no work links.

The newer homepage's multiline search field treated Enter as a newline, and its plus button opened attachments. The visible magnifier/header search provided the working route. The workflow now explicitly checks for real search results rather than treating text entry as a completed search.

Douyin search opens work details under a search URL with `modal_id`; the captured native ID was stored as the canonical video URL for ledger registration, while the actual observed URL remained in the local evidence pack. The AI sidebar was blank during the targeted attempt. No AI output or unseen video was substituted for original caption evidence.

## Verification and scope

`npm test` passed **240 tests**: 37 existing Douyin analysis tests, 186 radar tests, 10 topic orchestration tests and 7 installer/CLI tests. The new tests exercise real temporary files and the ledger, including resume/refresh, irrelevant and title-only samples, missing reviews, dual-platform citations, partial delivery, changed search/report files, damaged old captures and pending backfills.

The new skill passed the skill-creator frontmatter validator. README illustrations and the generated report were inspected in Chrome; the report was also checked in a narrow frame.

This is a bounded original-content research pilot. It does not establish full transcript accuracy, 50-item discovery reliability, automatic posting, Xiaohongshu private analytics, growth trends or continuous unattended scheduling. Captions and comments are source claims; the synthesis separates them from the agent's proposed content angles.
