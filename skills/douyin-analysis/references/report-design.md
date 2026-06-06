# Report Design Reference

Use this when the user asks for an HTML report, dashboard, factor map, sample review, or next-batch creator roadmap.

## Report Contract

The report should help the creator answer four questions quickly:

1. Which videos were observed versus hidden or limited?
2. Which mechanisms actually earned distribution?
3. What did each important sample prove?
4. What should the creator make next?

Do not collapse everything into prose. Use structured sections, charts, cards, and tables so the user can scan first and read details second.

## Required Sections

- **Hero diagnosis**: one concrete headline, one short explanation, and the top evidence samples.
- **Distribution boundary**: observed count, hidden or limited count, and a clear warning that hidden/limited works are excluded from exposure attribution.
- **Bubble map**: x axis is save/favorite rate, y axis is share rate, radius is plays. Bubbles must show video index and reveal caption, metrics, bucket, diagnosis, and next action on hover or click.
- **Factor map**: define factor abbreviations in the page. Useful defaults are EMO, IR, REC, RV, PA, ACT, WF, CL, and DIR.
- **Sample review**: short title, original caption excerpt, 2x2 metrics, judgment, and next step for every key video.
- **Full table**: every video keeps its original index, URL, caption, bucket, metrics, transcript status, and data gap notes.
- **Next-batch plan**: specific formats to shoot next, not generic content advice.

## Analysis Rules

- Treat hidden/limited or private samples as distribution-unknown. Diagnose the script, but do not use their low plays as content-quality evidence.
- Separate "useful and direct" from deeper mechanisms such as identity contrast, emotional tension, proof strength, AI re-pricing, audience pain, workflow reproducibility, and trend borrowing.
- Mark trend borrowing explicitly. If a video won because of a hot format or public meme, say that instead of pretending the topic alone caused the result.
- Keep each per-video judgment tied to visible data: plays, saves, shares, comments, new followers, transcript, and comments.

## Visual Rules

- Write short card titles. Put the full caption in a smaller secondary line or a tooltip.
- Align repeated labels such as `判断` and `下一步` in a fixed label column.
- Use color and weight to separate hierarchy: title, caption, metrics, judgment, action.
- Avoid one long wall of text. If a paragraph has more than one job, split it into evidence, judgment, and next action.
- Important direct evidence can use sharper rectangles. Secondary explanatory panels can use softer corners. Do not put cards inside cards.
- Avoid generic AI-looking borders: repeated 1px outlines, excessive glass cards, dark monotone backgrounds, and undifferentiated card grids.
- Verify responsive behavior. On narrow screens, sample cards should become one column and text must not turn into vertical stacks.

## Output Hygiene

- Save HTML in the run folder, for example `outputs/douyin_analysis_YYYY-MM-DD/report.html`.
- Keep the source JSON next to the report so future runs can regenerate it.
- If you create screenshots for documentation, store them under a public `assets/` or report-local media folder, never inside `.cheat-cache/`.
