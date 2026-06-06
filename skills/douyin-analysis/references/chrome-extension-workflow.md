# Chrome Extension Workflow Reference

Use this reference before collecting Douyin creator data. The default path is Chrome Extension collection path, using the user's already logged-in Chrome session through the Codex Chrome Extension / Chrome plugin.

## When To Use

Use Chrome Extension collection for all browser work. It works in the user's real Chrome profile and avoids creating a second browser session. If Chrome Extension is unavailable or disconnected, stop and ask the user to reconnect it.

## Safety Rules

- Work only on the user's own Douyin creator account or explicitly authorized creator data.
- Do not inspect browser cookies, localStorage, passwords, session stores, or Chrome profile files.
- Do not export raw private browser state.
- Save only creator works, public URLs, transcripts, metrics, Top comments, provenance notes, and report artifacts.
- If Chrome asks for login, CAPTCHA, QR scan, permission, or another account-side action, hand off to the user.

## Chrome Tab Flow

1. List open Chrome tabs and claim an existing tab whose URL starts with `https://creator.douyin.com/` when available.
2. If no creator tab is open, open `https://creator.douyin.com/creator-micro/content/manage` in Chrome.
3. Confirm the visible page is logged in. If it is not, ask the user to finish login in Chrome and continue after the page reaches creator center.
4. Create or reuse `outputs/douyin_analysis_YYYY-MM-DD/`.
5. Keep one progress file per stage and write after every item so the run can resume.

## Works List Collection

Collect the works list from creator center before deep metrics:

- Preferred source: official creator-center table/card data visible in Chrome or an official in-page export/download if Douyin exposes one.
- Required fields per work: `index`, `mid`, `publicUrl`, `publishedAt`, `caption`, `itemType`, `plays`, `likes`, `comments`, `shares`, `favorites`.
- If a field is not visible, leave it blank and record a `dataGap` note instead of guessing.
- The `mid` / `aweme_id` may come from visible links, copied public URLs, or the video analytics URL.

Recommended progress file:

```text
outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json
```

## Video Analytics Collection

For each target work, open the creator-center video analytics page in Chrome:

```text
https://creator.douyin.com/creator-micro/data/stats/video/<aweme_id>
```

Read visible page sections and official exports when available. Capture these fields when Douyin exposes them:

- average watch time
- completion rate
- 3-second or 5-second retention
- new followers
- lost followers
- follow rate
- profile visits
- cover click rate
- updated plays, likes, comments, shares, favorites

Normalize rates as ratios from `0` to `1` in JSON when possible, while preserving the original text in `*Text` fields when useful.

Recommended progress file:

```text
outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json
```

## Comment Collection

Collect Top comments through Chrome in this order:

1. Creator-center comment management page if it can be filtered to the target video.
2. Public video page `https://www.douyin.com/video/<aweme_id>` if creator-center comments are insufficient.

Keep per comment:

- `text`
- `diggCount`
- `replyCount`
- `userName` when visible
- `ipLabel` when visible

Sort Top comments by like count when that signal is visible. If comments are unavailable, record `commentWarning` and keep going.

## Visibility Boundary

The Chrome Extension API can control tabs and read visible DOM. It may not expose network response bodies in every Codex environment. Do not pretend invisible XHR fields were collected through Chrome.

When Chrome cannot expose a required field, record a `dataGap` entry with the page where you looked and the reason it was unavailable. Do not guess values and do not launch a second browser collector.

## Resume Discipline

Before any rerun:

1. Run `scripts/audit_content_gaps.cjs`.
2. Backfill only missing or stale fields.
3. Preserve existing records unless the user explicitly asks for `--force`.
4. Keep source provenance per field or per item when mixing Chrome Extension and fallback data.
