# Autody Command Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the six Autody command-like Codex skills: `/kaishi`, `/gengxin`, `/buchong`, `/tijian`, `/baogao`, and `/html`.

**Status:** Implemented on `codex/chrome-extension-only-collector` with local install QA, tarball install QA, and Lumina renderer smoke tests.

**Architecture:** Keep `douyin-analysis` as the shared base skill with safety rules, Chrome Extension workflow references, deterministic scripts, and Lumina references. Add thin command skills that fix user intent: first baseline, incremental update, gap backfill, audit-only check, fresh report analysis, and Lumina HTML rendering. For `/html`, follow the Guizang pattern: preserve the visual system, but rebuild the report model and conclusions from the latest input data every run. Update packaging so `autody install` installs all command skills plus `douyin-analysis`; add validator checks so the package cannot drift back to old browser collectors, report generation in `/kaishi`, stale analysis reuse in report commands, or multi-template HTML selection.

**Tech Stack:** Node.js 18+, Codex skills, YAML skill metadata, Markdown docs, existing `npm test` validation pipeline.

---

## Current Worktree Note

Before implementation, run:

```bash
git status --short --branch
```

Expected current unrelated dirty files may include:

```text
 M skills/douyin-analysis/SKILL.md
 M skills/douyin-analysis/scripts/audit_content_gaps.cjs
 M skills/douyin-analysis/scripts/merge_content_outputs.cjs
```

Do not stage or revert those files unless the user explicitly asks. Each commit below must stage only the files listed in that task.

## File Structure

- Create `skills/kaishi/SKILL.md`: command-like skill instructions for `/kaishi`.
- Create `skills/kaishi/agents/openai.yaml`: Codex app display metadata for the command-like skill.
- Create `skills/kaishi/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/gengxin/SKILL.md`: command-like skill instructions for incremental updates.
- Create `skills/gengxin/agents/openai.yaml`: Codex app display metadata for `/gengxin`.
- Create `skills/gengxin/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/buchong/SKILL.md`: command-like skill instructions for audit-driven backfill.
- Create `skills/buchong/agents/openai.yaml`: Codex app display metadata for `/buchong`.
- Create `skills/buchong/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/tijian/SKILL.md`: command-like skill instructions for local audit-only checks.
- Create `skills/tijian/agents/openai.yaml`: Codex app display metadata for `/tijian`.
- Create `skills/tijian/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/baogao/SKILL.md`: command-like skill instructions for fresh report analysis.
- Create `skills/baogao/agents/openai.yaml`: Codex app display metadata for `/baogao`.
- Create `skills/baogao/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/html/SKILL.md`: command-like skill instructions for `/html`.
- Create `skills/html/agents/openai.yaml`: Codex app display metadata for the Lumina HTML command.
- Create `skills/html/assets/icon.svg`: local icon used by the skill metadata.
- Create `skills/douyin-analysis/references/lumina-html-workflow.md`: Lumina-only rendering workflow and source provenance.
- Create `skills/douyin-analysis/references/lumina-template.html`: packaged Lumina HTML template copied from the existing finished template.
- Create `skills/douyin-analysis/scripts/render_lumina_report.cjs`: deterministic renderer that rebuilds a fresh Lumina payload from current input data before writing HTML.
- Modify `scripts/validate_chrome_extension_policy.cjs`: require the new skill files and scan them for forbidden old collector/browser-state references.
- Modify `bin/autody.js`: install multiple packaged skills and expose `skill-path [skill]`.
- Modify `README.md`: make `/kaishi` the recommended Codex entry.
- Modify `AGENTS.md`: make `/kaishi` the recommended agent prompt.
- Modify `skills/douyin-analysis/agents/openai.yaml`: keep the base skill metadata, but point first-time users toward `/kaishi`.
- Modify `RELEASE_NOTES.md`: document the new command-like skill entry.
- Modify `package.json`: syntax-check the Lumina renderer in `npm test`.

## Task 1: Add Command Skills, Lumina References, And Policy Guard

**Files:**
- Create: `skills/kaishi/SKILL.md`
- Create: `skills/kaishi/agents/openai.yaml`
- Create: `skills/kaishi/assets/icon.svg`
- Create: `skills/gengxin/SKILL.md`
- Create: `skills/gengxin/agents/openai.yaml`
- Create: `skills/gengxin/assets/icon.svg`
- Create: `skills/buchong/SKILL.md`
- Create: `skills/buchong/agents/openai.yaml`
- Create: `skills/buchong/assets/icon.svg`
- Create: `skills/tijian/SKILL.md`
- Create: `skills/tijian/agents/openai.yaml`
- Create: `skills/tijian/assets/icon.svg`
- Create: `skills/baogao/SKILL.md`
- Create: `skills/baogao/agents/openai.yaml`
- Create: `skills/baogao/assets/icon.svg`
- Create: `skills/html/SKILL.md`
- Create: `skills/html/agents/openai.yaml`
- Create: `skills/html/assets/icon.svg`
- Create: `skills/douyin-analysis/references/lumina-html-workflow.md`
- Create: `skills/douyin-analysis/references/lumina-template.html`
- Create: `skills/douyin-analysis/scripts/render_lumina_report.cjs`
- Modify: `scripts/validate_chrome_extension_policy.cjs`
- Modify: `package.json`

- [ ] **Step 1: Extend validator before the files exist**

Edit `scripts/validate_chrome_extension_policy.cjs` to add the new `assertIncludes` checks:

```js
assertIncludes("skills/kaishi/SKILL.md", "Chrome Extension-first");
assertIncludes("skills/kaishi/SKILL.md", "Do not create HTML dashboards");
assertIncludes("skills/kaishi/agents/openai.yaml", "开始建档");
assertIncludes("skills/gengxin/SKILL.md", "incremental update");
assertIncludes("skills/buchong/SKILL.md", "audit-driven backfill");
assertIncludes("skills/tijian/SKILL.md", "audit-only");
assertIncludes("skills/baogao/SKILL.md", "Regenerate report analysis from the latest data every run.");
assertIncludes("skills/html/SKILL.md", "Lumina");
assertIncludes("skills/html/SKILL.md", "Do not offer a three-template picker");
assertIncludes("skills/html/SKILL.md", "Regenerate the report analysis from the latest data every run.");
assertIncludes("skills/html/agents/openai.yaml", "Lumina HTML");
assertIncludes("skills/douyin-analysis/references/lumina-html-workflow.md", "Lumina only");
assertIncludes("skills/douyin-analysis/references/lumina-html-workflow.md", "fresh report payload");
assertIncludes("skills/douyin-analysis/references/lumina-template.html", "sdv-lumina");
assertIncludes("skills/douyin-analysis/scripts/render_lumina_report.cjs", "report_lumina_payload.json");
```

Add the new checked files to `checkedFiles`:

```js
  "skills/kaishi/SKILL.md",
  "skills/kaishi/agents/openai.yaml",
  "skills/gengxin/SKILL.md",
  "skills/gengxin/agents/openai.yaml",
  "skills/buchong/SKILL.md",
  "skills/buchong/agents/openai.yaml",
  "skills/tijian/SKILL.md",
  "skills/tijian/agents/openai.yaml",
  "skills/baogao/SKILL.md",
  "skills/baogao/agents/openai.yaml",
  "skills/html/SKILL.md",
  "skills/html/agents/openai.yaml",
  "skills/douyin-analysis/references/lumina-html-workflow.md",
  "skills/douyin-analysis/scripts/render_lumina_report.cjs",
```

- [ ] **Step 2: Run validation and confirm the red state**

Run:

```bash
npm test
```

Expected: FAIL because the command skill files do not exist yet.

- [ ] **Step 3: Create `skills/kaishi/SKILL.md`**

Create `skills/kaishi/SKILL.md` with this exact content:

```markdown
---
name: kaishi
description: Use when the user invokes /kaishi or asks to start first-time Douyin account baselining; creates a full baseline for the user's own authorized Douyin creator account through Chrome Extension-first collection, Doubao transcripts, audit, and merge outputs without generating reports.
---

# Kaishi

Use this command-like skill for `/kaishi` / `开始建档`.

`/kaishi` is the first-run baseline workflow for the user's own Douyin creator account or creator data they are explicitly authorized to manage. It should create a clean data foundation, not a strategy report.

This workflow is Chrome Extension-first. Use the Codex Chrome Extension / Chrome plugin to work inside the user's already logged-in Chrome session. Do not start another browser collector or inspect browser cookies, localStorage, passwords, session stores, or Chrome profile files.

## Required Context

Before collecting data, read:

1. `../douyin-analysis/SKILL.md`
2. `../douyin-analysis/references/chrome-extension-workflow.md`
3. `../douyin-analysis/references/douyin-workflow.md`

Follow those shared safety, provenance, schema, and resume rules. If a field is not visible or exportable through Chrome, record `dataGap` instead of guessing.

## Completion Boundary

`/kaishi` is complete only after it has:

1. Confirmed the account is first-party or explicitly authorized.
2. Created or reused `outputs/douyin_analysis_YYYY-MM-DD/`.
3. Collected the full published works list from Douyin creator center.
4. Saved `douyin_works_final.json` with `index`, `mid`, `publicUrl`, `publishedAt`, `caption`, `itemType`, `plays`, `likes`, `comments`, `shares`, and `favorites` when visible.
5. Opened each creator-center video analytics page through Chrome and saved visible deep metrics to `deep_metrics_progress.json`.
6. Opened one fresh Doubao page/chat per item, requested transcript or image-text extraction, saved the result, then closed that page.
7. Saved transcript progress to `transcript_progress.json` and mirrored final transcript fields into the work records.
8. Collected Top comments where visible through creator center or the public video page.
9. Persisted progress after every item so the run can resume.
10. Ran the audit script and wrote `content_gap_audit.json`.
11. Ran the merge script and wrote JSON, CSV, and Markdown baseline outputs.
12. Reported item counts, output paths, and remaining `dataGap` items.

Do not create HTML dashboards, strategy reports, topic roadmaps, or next-batch recommendations in `/kaishi`. Use `/baogao` for report work after a baseline exists.

## Commands

Audit:

```bash
node ~/.codex/skills/douyin-analysis/scripts/audit_content_gaps.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD/content_gap_audit.json
```

Merge:

```bash
node ~/.codex/skills/douyin-analysis/scripts/merge_content_outputs.cjs \
  --works outputs/douyin_analysis_YYYY-MM-DD/douyin_works_final.json \
  --transcripts outputs/douyin_analysis_YYYY-MM-DD/transcript_progress.json \
  --deep outputs/douyin_analysis_YYYY-MM-DD/deep_metrics_progress.json \
  --out outputs/douyin_analysis_YYYY-MM-DD \
  --stem douyin_deep
```

## Stop Conditions

Stop and ask the user to act in Chrome when Douyin requires login, QR scan, CAPTCHA, permission confirmation, or another account-side step.

Stop and ask the user to reconnect Chrome Extension if the Chrome plugin cannot claim or open Chrome tabs.

If Doubao cannot extract a transcript for one item, record transcript status and continue to the next item.
```

- [ ] **Step 4: Create `skills/kaishi/agents/openai.yaml`**

Create `skills/kaishi/agents/openai.yaml` with this exact content:

```yaml
interface:
  display_name: "开始建档"
  short_description: "第一次全量整理本人抖音作品数据、逐字稿和指标底账"
  icon_small: "./assets/icon.svg"
  icon_large: "./assets/icon.svg"
  brand_color: "#c83417"
  default_prompt: "Run /kaishi to create my first full Douyin creator baseline with Chrome Extension-first collection, Doubao transcripts, audit, and merge outputs."
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 5: Create `skills/kaishi/assets/icon.svg`**

Copy the existing Autody icon from `skills/douyin-analysis/assets/icon.svg` into `skills/kaishi/assets/icon.svg`.

Run:

```bash
mkdir -p skills/kaishi/assets
cp skills/douyin-analysis/assets/icon.svg skills/kaishi/assets/icon.svg
```

- [ ] **Step 6: Create `skills/html/SKILL.md`**

Create `skills/html/SKILL.md` with this exact content:

```markdown
---
name: html
description: Use when the user invokes /html or asks to render an existing Autody Douyin baseline/report as HTML; uses the Lumina template only and does not collect browser data, backfill metrics, or offer multiple visual templates.
---

# HTML

Use this command-like skill for `/html` / `Lumina HTML`.

`/html` turns an existing Autody run folder into a Lumina HTML page. It is a rendering workflow, not a collection workflow. Regenerate the report analysis from the latest data every run.

Do not use Chrome, Doubao, creator center, or public Douyin pages from this command. If data is missing, ask the user to run `/kaishi`, `/gengxin`, `/buchong`, or `/tijian` first.

## Required Context

Before rendering, read:

1. `../douyin-analysis/references/report-design.md`
2. `../douyin-analysis/references/lumina-html-workflow.md`

Use Lumina only. Do not offer a three-template picker and do not mention unused template families.

Use the Guizang reuse pattern: keep visual elements stable, but rebuild the view model and conclusions from current data. Old Lumina or Guizang HTML files are visual references only; never copy their old conclusions into a new report.

## Inputs

Use the target run folder, normally:

```text
outputs/douyin_analysis_YYYY-MM-DD/
```

Prefer these files:

```text
douyin_deep_works_final.json
douyin_incremental_analysis_YYYY-MM-DD.json
content_gap_audit.json
```

If the analysis JSON is absent, render a data-first Lumina dashboard from `douyin_deep_works_final.json` and clearly label any missing analysis sections as data gaps rather than inventing conclusions.

## Output

Write a fresh payload and Lumina HTML file into the run folder:

```text
report_lumina_payload.json
report_lumina.html
```

Keep source JSON files next to the HTML. The payload must include `generatedAt`, `sourceFiles`, `summary`, and `items`. Report the output path and any data quality caveats.

## Boundaries

- Do not collect or backfill browser data.
- Do not generate transcripts.
- Do not inspect cookies, localStorage, passwords, session stores, or browser profile files.
- Do not offer a three-template picker.
- Do not invent strategic conclusions when the input data does not support them.
- Do not reuse stale report conclusions. Reanalyze against the current source files before rendering.
```

- [ ] **Step 7: Create `skills/html/agents/openai.yaml`**

Create `skills/html/agents/openai.yaml` with this exact content:

```yaml
interface:
  display_name: "Lumina HTML"
  short_description: "把已有 Autody 数据渲染成 Lumina HTML 页面"
  icon_small: "./assets/icon.svg"
  icon_large: "./assets/icon.svg"
  brand_color: "#f8cf3f"
  default_prompt: "Run /html to render the current Autody Douyin baseline as a Lumina HTML report. Use Lumina only and do not collect browser data."
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 8: Create `skills/html/assets/icon.svg`**

Copy the existing Autody icon from `skills/douyin-analysis/assets/icon.svg` into `skills/html/assets/icon.svg`.

Run:

```bash
mkdir -p skills/html/assets
cp skills/douyin-analysis/assets/icon.svg skills/html/assets/icon.svg
```

- [ ] **Step 9: Add Lumina workflow reference**

Create `skills/douyin-analysis/references/lumina-html-workflow.md` with this exact content:

```markdown
# Lumina HTML Workflow

Use this reference when `/html` renders an Autody run folder into HTML.

Lumina only: do not offer a three-template picker. Preserve visual elements, but regenerate the analysis every run.

The Guizang variants show the correct reuse pattern: separate `loadModel()` from `renderPage()`. Autody should keep that pattern. Historical HTML is a visual source, not a source of current conclusions.

Historical sources used to package this workflow:

- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/superdesign_lumina_dashboard_2026-05-31.html`
- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_superdesign_hero_variants_2026-05-31.cjs`
- `/Users/kaneki/Projects/fun/content/outputs/competitor_ai_research_2026-06-05/build_autody_lumina_competitor_report_2026-06-05.cjs`
- `/Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/build_taste_guizang_variants_2026-05-31.cjs`

## Inputs

Default run folder:

```text
outputs/douyin_analysis_YYYY-MM-DD/
```

Preferred data files:

```text
douyin_deep_works_final.json
douyin_incremental_analysis_YYYY-MM-DD.json
content_gap_audit.json
```

Use `douyin_deep_works_final.json` as the source of truth for item-level metrics, transcripts, comments, and provenance. Use analysis JSON only for conclusions that are explicitly present.

## Fresh Analysis Rule

Every `/html` run must create a fresh report payload from the current source files:

```text
report_lumina_payload.json
```

The payload must include:

```json
{
  "generatedAt": "ISO timestamp",
  "sourceFiles": {
    "works": "douyin_deep_works_final.json",
    "analysis": "optional analysis json",
    "audit": "optional audit json"
  },
  "summary": {},
  "items": []
}
```

If old HTML exists, use it only as a visual reference. Do not copy old hero claims, sample rankings, diagnoses, next actions, or strategic conclusions unless the same conclusion is regenerated from the current source files.

## Rendering Contract

- Use `lumina-template.html` as the visual source.
- Preserve the Lumina visual system: yellow hero, dark proof strip, explicit content bands, data plaque, bubble map, case cards, factor map, searchable table, and responsive mobile layout.
- Recompute summary statistics, buckets, selected examples, caveats, and table rows from the current payload.
- Write `report_lumina.html` into the run folder unless the user names another output file.
- Keep all source JSON next to the HTML.
- Include data quality caveats when audit gaps exist.

## Boundaries

`/html` does not collect browser data, backfill metrics, create transcripts, choose among multiple templates, or reuse stale conclusions. If the data is incomplete, render only supported sections and report the missing inputs.
```

- [ ] **Step 10: Package the existing Lumina template**

Copy the existing finished Lumina HTML template into the skill references:

```bash
cp /Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-05-30/superdesign_lumina_dashboard_2026-05-31.html \
  skills/douyin-analysis/references/lumina-template.html
```

- [ ] **Step 11: Create the fresh-data Lumina renderer**

Create `skills/douyin-analysis/scripts/render_lumina_report.cjs`.

Required behavior:

- Accept `--works <path>` and `--out <dir>`.
- Optionally accept `--analysis <path>`, `--audit <path>`, and `--html <filename>`.
- Read the current works JSON every run.
- Build `report_lumina_payload.json` with `generatedAt`, `sourceFiles`, `summary`, and `items`.
- Recompute summary statistics and item ordering from the current works JSON.
- Write `report_lumina.html` using Lumina visual classes including `sdv-lumina`.
- Never read old HTML as a source of conclusions.

Minimum smoke command:

```bash
node skills/douyin-analysis/scripts/render_lumina_report.cjs \
  --works outputs/douyin_analysis_2026-06-05/douyin_deep_works_final.json \
  --out /tmp/autody-lumina-smoke
test -f /tmp/autody-lumina-smoke/report_lumina_payload.json
test -f /tmp/autody-lumina-smoke/report_lumina.html
rg -q 'sdv-lumina' /tmp/autody-lumina-smoke/report_lumina.html
rg -q 'sourceFiles' /tmp/autody-lumina-smoke/report_lumina_payload.json
```

Expected: PASS.

- [ ] **Step 12: Add Lumina renderer syntax check to `package.json`**

Update the `validate` script in `package.json` so it also runs:

```bash
node --check skills/douyin-analysis/scripts/render_lumina_report.cjs
```

The final `validate` script should still run `doctor --package-only`, both existing script syntax checks, and `scripts/validate_chrome_extension_policy.cjs`.

- [ ] **Step 13: Run validation and confirm green state for Task 1**

Run:

```bash
npm test
```

Expected: PASS with:

```text
Package files: ok
Chrome Extension-only policy: ok
```

- [ ] **Step 7: Commit Task 1**
- [ ] **Step 14: Commit Task 1**

Run:

```bash
git add package.json scripts/validate_chrome_extension_policy.cjs skills/kaishi/SKILL.md skills/kaishi/agents/openai.yaml skills/kaishi/assets/icon.svg skills/html/SKILL.md skills/html/agents/openai.yaml skills/html/assets/icon.svg skills/douyin-analysis/references/lumina-html-workflow.md skills/douyin-analysis/references/lumina-template.html skills/douyin-analysis/scripts/render_lumina_report.cjs
git commit -m "Add kaishi and html command skills"
```

## Task 2: Install All Autody Skills

**Files:**
- Modify: `bin/autody.js`

- [ ] **Step 1: Prove the current install command misses command skills**

Run:

```bash
tmp="$(mktemp -d)"
node bin/autody.js install --force --codex-home "$tmp/codex" >/tmp/autody-install.log
test -d "$tmp/codex/skills/douyin-analysis"
test -d "$tmp/codex/skills/kaishi"
test -d "$tmp/codex/skills/html"
```

Expected: FAIL on `test -d "$tmp/codex/skills/kaishi"` or `test -d "$tmp/codex/skills/html"` because the current installer only copies `douyin-analysis`.

- [ ] **Step 2: Replace `bin/autody.js` with multi-skill install support**

Replace `bin/autody.js` with this exact content:

```js
#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const skillNames = ["douyin-analysis", "kaishi", "html"];

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
}

function usage() {
  const version = readPackage().version;
  return `autody ${version}

Usage:
  autody install [--force] [--codex-home <path>]
  autody doctor [--package-only]
  autody skill-path [douyin-analysis|kaishi|html]
  autody --version

Commands:
  install     Install the Autody Codex skills into ~/.codex/skills.
  doctor      Check package files and local runtime hints.
  skill-path  Print a packaged skill path.

Safety:
  Autody is for first-party or explicitly authorized Douyin creator data only.
`;
}

function parseOptions(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--package-only") {
      opts.packageOnly = true;
    } else if (arg === "--codex-home") {
      opts.codexHome = argv[i + 1];
      i += 1;
    } else {
      opts._.push(arg);
    }
  }
  return opts;
}

function getCodexHome(opts) {
  return path.resolve(opts.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

function getSkillSource(name) {
  return path.join(packageRoot, "skills", name);
}

function assertKnownSkill(name) {
  if (!skillNames.includes(name)) {
    throw new Error(`Unknown skill: ${name}. Expected one of: ${skillNames.join(", ")}`);
  }
}

function assertPackageShape() {
  const required = [
    "README.md",
    "NOTICE.md",
    "AGENTS.md",
    "skills/douyin-analysis/SKILL.md",
    "skills/douyin-analysis/agents/openai.yaml",
    "skills/douyin-analysis/references/chrome-extension-workflow.md",
    "skills/douyin-analysis/references/report-design.md",
    "skills/douyin-analysis/references/douyin-workflow.md",
    "skills/douyin-analysis/references/lumina-html-workflow.md",
    "skills/douyin-analysis/references/lumina-template.html",
    "skills/douyin-analysis/scripts/audit_content_gaps.cjs",
    "skills/douyin-analysis/scripts/merge_content_outputs.cjs",
    "skills/douyin-analysis/scripts/render_lumina_report.cjs",
    "skills/kaishi/SKILL.md",
    "skills/kaishi/agents/openai.yaml",
    "skills/kaishi/assets/icon.svg",
    "skills/html/SKILL.md",
    "skills/html/agents/openai.yaml",
    "skills/html/assets/icon.svg",
  ];
  const missing = required.filter((file) => !fs.existsSync(path.join(packageRoot, file)));
  if (missing.length) {
    throw new Error(`Package is missing required files:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  }
}

function install(opts) {
  assertPackageShape();
  const codexHome = getCodexHome(opts);
  const skillsDir = path.join(codexHome, "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  const existing = skillNames
    .map((name) => path.join(skillsDir, name))
    .filter((dest) => fs.existsSync(dest));
  if (existing.length && !opts.force) {
    throw new Error(`${existing.join(", ")} already exists. Re-run with --force to replace them.`);
  }

  for (const name of skillNames) {
    const dest = path.join(skillsDir, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(getSkillSource(name), dest, { recursive: true });
  }

  console.log(`Installed ${skillNames.join(", ")} to ${skillsDir}`);
  console.log("Ask Codex: run /kaishi for the first full Douyin creator baseline, then /html to render Lumina HTML.");
}

function doctor(opts) {
  assertPackageShape();
  const checks = [
    ["node", true],
  ];
  console.log("Package files: ok");
  if (opts.packageOnly) return;
  for (const [name, ok] of checks) {
    console.log(`${name}: ${ok ? "ok" : "missing"}`);
  }
}

function printSkillPath(opts) {
  const name = opts._[0] || "douyin-analysis";
  assertKnownSkill(name);
  console.log(getSkillSource(name));
}

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const opts = parseOptions(argv.slice(1));
  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      process.stdout.write(usage());
    } else if (command === "--version" || command === "-v" || command === "version") {
      console.log(readPackage().version);
    } else if (command === "install") {
      install(opts);
    } else if (command === "doctor") {
      doctor(opts);
    } else if (command === "skill-path") {
      printSkillPath(opts);
    } else {
      throw new Error(`Unknown command: ${command}\n\n${usage()}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
```

- [ ] **Step 3: Verify install now copies command skills**

Run:

```bash
tmp="$(mktemp -d)"
node bin/autody.js install --force --codex-home "$tmp/codex" >/tmp/autody-install.log
test -d "$tmp/codex/skills/douyin-analysis"
test -d "$tmp/codex/skills/kaishi"
test -d "$tmp/codex/skills/html"
node bin/autody.js skill-path kaishi | rg 'skills/kaishi$'
node bin/autody.js skill-path html | rg 'skills/html$'
```

Expected: PASS, with `skill-path kaishi` ending in `skills/kaishi` and `skill-path html` ending in `skills/html`.

- [ ] **Step 4: Run package validation**

Run:

```bash
npm test
```

Expected: PASS with:

```text
Package files: ok
Chrome Extension-only policy: ok
```

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add bin/autody.js
git commit -m "Install Autody command skills"
```

## Task 3: Make `/kaishi` And `/html` The Recommended Human Entries

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `skills/douyin-analysis/agents/openai.yaml`
- Modify: `RELEASE_NOTES.md`

- [ ] **Step 1: Confirm docs are not yet consistently pointing at `/kaishi` and `/html`**

Run:

```bash
for file in README.md AGENTS.md skills/douyin-analysis/agents/openai.yaml RELEASE_NOTES.md; do
  rg -q '/kaishi' "$file" || echo "missing /kaishi: $file"
  rg -q '/html' "$file" || echo "missing /html: $file"
done
```

Expected before this task: at least one missing line.

- [ ] **Step 2: Update `README.md` quick prompt section**

In `README.md`, replace the "给 Codex 的一句话" section with:

````markdown
## Codex 入口

第一次给账号建档，直接在 Codex 里运行：

```text
/kaishi
```

`/kaishi` 会要求 agent：

- 优先用 Codex Chrome Extension 接管你已经登录的 `creator.douyin.com` Chrome tab。
- 全量建立本人抖音作品 baseline：作品列表、指标、Top 评论和逐字稿。
- 先审计缺口，再只补缺失或过期字段。
- 每条作品完成后立刻写入 progress，断了可以继续。
- 发给豆包提取 transcript 时一条视频开一个页面，用完就关，避免页面越来越卡。
- Chrome 页面拿不到的字段标记为 `dataGap`，不再启动第二套浏览器采集器。

生成 Lumina HTML：

```text
/html
```

`/html` 只使用 Lumina 模板，不提供三模板选择，也不采集浏览器数据。

后续入口预留：

```text
/gengxin   更新新作品和过期指标
/buchong   按 audit 缺口补数据
/tijian    只做数据体检
/baogao    基于 baseline 做报告分析
```
````

Keep the existing `![Agent pipeline](assets/pipeline.svg)` image immediately after this section.

- [ ] **Step 3: Update `AGENTS.md` recommended prompt**

Replace the recommended prompt block in `AGENTS.md` with:

````markdown
Recommended prompt:

```text
/kaishi
```

Use `/kaishi` for the first full Douyin baseline. It should load the `kaishi` skill, then use `douyin-analysis` as the shared Chrome Extension-first base workflow.

Use `/html` when the user wants the existing Autody data rendered as Lumina HTML. It should load the `html` skill and use Lumina only, with no three-template picker.
````

- [ ] **Step 4: Update base skill app metadata**

Replace `skills/douyin-analysis/agents/openai.yaml` with:

```yaml
interface:
  display_name: "抖音分析"
  short_description: "分析自己的抖音作品数据、逐字稿和报告"
  icon_small: "./assets/icon.svg"
  icon_large: "./assets/icon.svg"
  brand_color: "#111827"
  default_prompt: "For first-time Douyin baselining, run /kaishi. For Lumina HTML rendering from an existing baseline, run /html. Use $douyin-analysis as the shared Chrome Extension-first workflow for authorized Douyin creator data, backfills, audits, and reports."
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 5: Update release notes**

Under `# unreleased` in `RELEASE_NOTES.md`, add these bullets after the first paragraph:

```markdown
- Adds `/kaishi` as a command-like Codex skill for first-time Douyin baseline creation.
- Adds `/html` as a command-like Codex skill for Lumina-only HTML rendering.
- Updates the installer to copy `douyin-analysis`, `kaishi`, and `html` into Codex skills.
- Moves the recommended human entry from a long prompt to `/kaishi`.
```

- [ ] **Step 6: Verify docs and package validation**

Run:

```bash
for file in README.md AGENTS.md skills/douyin-analysis/agents/openai.yaml RELEASE_NOTES.md bin/autody.js; do
  rg -q '/kaishi' "$file"
  rg -q '/html' "$file"
done
npm test
```

Expected: PASS with:

```text
Package files: ok
Chrome Extension-only policy: ok
```

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add README.md AGENTS.md skills/douyin-analysis/agents/openai.yaml RELEASE_NOTES.md
git commit -m "Recommend kaishi and html entrypoints"
```

## Task 4: Package QA And Local Install QA

**Files:**
- No source edits expected.

- [ ] **Step 1: Run standard validation**

Run:

```bash
npm test
```

Expected: PASS with:

```text
Package files: ok
Chrome Extension-only policy: ok
```

- [ ] **Step 2: Run dry pack**

Run:

```bash
npm run pack:dry
```

Expected: PASS. Tarball file list must include:

```text
package/skills/kaishi/SKILL.md
package/skills/kaishi/agents/openai.yaml
package/skills/kaishi/assets/icon.svg
package/skills/html/SKILL.md
package/skills/html/agents/openai.yaml
package/skills/html/assets/icon.svg
package/skills/douyin-analysis/references/lumina-html-workflow.md
package/skills/douyin-analysis/references/lumina-template.html
package/skills/douyin-analysis/scripts/render_lumina_report.cjs
```

Expected tarball file list must not include:

```text
douyin-session
crawler.py
backfill.py
requirements.txt
```

- [ ] **Step 3: Run tarball install QA**

Run:

```bash
tmp="$(mktemp -d)"
npm pack --pack-destination "$tmp"
npm install --prefix "$tmp/prefix" "$tmp"/autody-*.tgz
"$tmp/prefix/node_modules/.bin/autody" doctor --package-only
"$tmp/prefix/node_modules/.bin/autody" install --force --codex-home "$tmp/codex"
test -f "$tmp/codex/skills/douyin-analysis/SKILL.md"
test -f "$tmp/codex/skills/kaishi/SKILL.md"
test -f "$tmp/codex/skills/html/SKILL.md"
test -f "$tmp/codex/skills/douyin-analysis/references/lumina-template.html"
test -f "$tmp/codex/skills/douyin-analysis/scripts/render_lumina_report.cjs"
node "$tmp/codex/skills/douyin-analysis/scripts/render_lumina_report.cjs" \
  --works /Users/kaneki/Projects/fun/content/outputs/douyin_analysis_2026-06-05/douyin_deep_works_final.json \
  --out "$tmp/lumina-smoke"
test -f "$tmp/lumina-smoke/report_lumina_payload.json"
test -f "$tmp/lumina-smoke/report_lumina.html"
rg -n 'douyin-session|crawler\.py|backfill\.py|requirements\.txt|uv run|\.auth/' "$tmp/codex/skills" && exit 1 || true
```

Expected: PASS, with `Package files: ok` and all three installed skill directories present.

- [ ] **Step 4: Install to the user's Codex home**

Run:

```bash
node bin/autody.js install --force
test -f "$HOME/.codex/skills/douyin-analysis/SKILL.md"
test -f "$HOME/.codex/skills/kaishi/SKILL.md"
test -f "$HOME/.codex/skills/html/SKILL.md"
test -f "$HOME/.codex/skills/douyin-analysis/references/lumina-template.html"
test -f "$HOME/.codex/skills/douyin-analysis/scripts/render_lumina_report.cjs"
rg -n 'douyin-session|crawler\.py|backfill\.py|requirements\.txt|uv run|\.auth/' "$HOME/.codex/skills/douyin-analysis" "$HOME/.codex/skills/kaishi" "$HOME/.codex/skills/html" && exit 1 || true
```

Expected: PASS. The install output should tell the user to run `/kaishi` and `/html`.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short --branch
```

Expected: Only unrelated pre-existing dirty files may remain. The files changed by Tasks 1-3 should be committed.

## Task 5: Push The Updated PR Branch

**Files:**
- No source edits expected.

- [ ] **Step 1: Verify branch and commits**

Run:

```bash
git log --oneline -5
git status --short --branch
```

Expected: latest commits include:

```text
Recommend kaishi and html entrypoints
Install Autody command skills
Add kaishi and html command skills
Document Autody command skill design
```

Expected status: branch may still show unrelated dirty files from the current worktree note. Do not stage them.

- [ ] **Step 2: Push**

Run:

```bash
git push origin codex/chrome-extension-only-collector
```

Expected: push succeeds and updates the existing PR branch.

- [ ] **Step 3: Update PR body**

Run:

```bash
gh pr edit 1 --body-file /tmp/autody-pr-body.md
```

Use this PR body content:

```markdown
## Summary

- Remove the old second-browser Douyin collector path and keep Douyin collection Chrome Extension-first.
- Add `/kaishi` as the first command-like Autody skill for first-time Douyin baseline creation.
- Add `/html` as the Lumina-only command-like skill for HTML rendering.
- Update the CLI installer so it installs `douyin-analysis`, `kaishi`, and `html`.
- Update docs, app metadata, and policy validation around the new entrypoint.

## QA

- `npm test`
- `npm run pack:dry`
- tarball install into a temporary Codex home
- local install into `~/.codex/skills`
- installed skill scan for deleted collector/browser-state references
- Lumina template packaged under `skills/douyin-analysis/references/lumina-template.html`
```

- [ ] **Step 4: Verify PR head**

Run:

```bash
gh pr view 1 --json url,state,isDraft,headRefOid,headRefName,baseRefName,title
```

Expected: PR remains open, draft status is preserved, and `headRefName` is `codex/chrome-extension-only-collector`.

## Self-Review

Spec coverage:

- `/kaishi` command-like skill: Task 1.
- `/html` command-like skill and Lumina-only reference: Task 1.
- Fresh `/html` report payload from current data: Task 1 renderer and Task 4 smoke QA.
- Guizang-style separation of data model and visual renderer: Task 1 workflow reference and renderer.
- `douyin-analysis` as shared base: Task 1 skill instructions.
- Chrome Extension-only browser path: Task 1 validator and skill text.
- No report generation in `/kaishi`: Task 1 validator and skill text.
- No three-template picker in `/html`: Task 1 validator and skill text.
- Multi-skill install: Task 2.
- README, AGENTS, metadata, release notes: Task 3.
- Package QA and installed-skill scan: Task 4.
- GitHub repo update: Task 5.

Placeholder scan:

- The plan contains no placeholder markers or open implementation blanks.
- Each code-changing task includes exact file content or exact snippets and commands.

Type and name consistency:

- Skill directory is `skills/kaishi`.
- Skill name is `kaishi`.
- User-facing command is `/kaishi`.
- HTML skill directory is `skills/html`.
- HTML skill name is `html`.
- User-facing HTML command is `/html`.
- Lumina renderer is `skills/douyin-analysis/scripts/render_lumina_report.cjs`.
- Fresh payload output is `report_lumina_payload.json`.
- Shared base skill remains `douyin-analysis`.
- Installed skill names are `douyin-analysis`, `kaishi`, and `html`.
