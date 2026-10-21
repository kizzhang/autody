# Reading, topic cards and spoken drafts

## Independent reading request

For each saved group, provide the original assets, caption, comment threads, source links and the user's content preferences. Ask readers to return:

1. What the author actually argues, including conditions, examples and counterarguments already addressed.
2. Which pages/intervals were read; which text came from OCR, subtitles, platform AI or original audio.
3. Actual comment disagreements with evidence, keeping resource requests, jokes, supportive replies and platform AI separate. No human comments is a valid result.
4. The strongest creative opportunity: explanation, application, experiment, comparison or grounded critique. A disagreement is not mandatory.
5. Exact X/source lineage or the remaining search clue; whether a numerical claim is independently verified or only self-reported.
6. Evidence-backed claims, unsupported claims and specific missing assets to request.

Readers should not see another reader's conclusion before forming their own. They do not control Chrome or mutate the shared store. The owner reconciles differences against originals and records a new review revision when correcting an earlier interpretation.

## Review / topic card

Use `summary`, `opportunity`, `angle`, `recommendation`, `evidencePaths`, `captureIds`, `comments`, `sourceRefs`, `claims` and `gaps` as documented in the data contract. Explain fit in words rather than inventing a single virality probability. `recommendation` is `shortlist`, `watch` or `archive`.

- Growth is computed from observations, never from a reader's impression.
- Creative value can come from a practical method, a real unresolved question, a transferable example or a fresh way of explaining an established fact.
- Label a meme as a meme. Check whether apparent AI/science traction actually belongs to a math puzzle, familiar speaker or joke format.
- Preserve source definitions: visitors are not page views; revenue is not profit; percentage points are not relative percentages. Do not infer causation from popularity.
- First-publication, edited and capture times remain different. A current translation of an older X post is a current adaptation with an older origin.
- A source chain can end with an unresolved clue. Do not pretend an account match proves the exact original.

## After the user chooses a topic

Only a real user selection creates `decision: selected`; a model's shortlist is not selection. Preserve the user's request in `userRequest`. Read the selected review and its evidence before drafting. If material new evidence changes the angle, show the change rather than silently using an old selection for a different topic.

Create three files under `drafts/<work-key>/<revision>/`:

- `brief.md`: audience/problem, central viewpoint, what the creator adds, hook options, structure, sources, known gaps and any proposed experiment.
- `script.md`: an original, speakable first draft with an opening, a concrete example or explanation, a supported conclusion, and natural transitions. Choose a length appropriate to the user's channel; record a provisional target if none is supplied. It is a draft, not a published work or approved scientific conclusion.
- `evidence.md`: claim-to-source table plus suggested shots/materials. Each factual claim points to original material or an external primary source checked for this task. Mark author self-report, inference, unresolved claim and planned experiment explicitly.

Do not turn translations into unattributed copying. Quote only what is necessary and attribute the source. Add the creator's reasoning or proposed test. A proposed test stays a proposal until performed. Do not write invented first-person earnings, experiences, experiments or opinions as though the user confirmed them; offer uncertain positions as draft framing.

Before registering the draft, check numbers, attribution, scope, originality, scientific claims and whether the supposed counterargument was already addressed by the source. Save `status: draft`, the `reviewId` and `selectionEventId`. An explicit rejection/watch decision blocks new drafts until a later selection. Existing drafts remain history.

After the user publishes through a separately authorized workflow, they may associate the resulting own-account work with the source topic for later Autody analytics. Never infer published status or results from a generated script.
