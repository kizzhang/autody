#!/usr/bin/env node
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assertIncludes(file, needle) {
  const text = read(file);
  if (!text.includes(needle)) {
    throw new Error(`${file} must include: ${needle}`);
  }
}

assertIncludes("skills/douyin-analysis/SKILL.md", "Chrome Extension-first");
assertIncludes("skills/douyin-analysis/SKILL.md", "Do not inspect browser cookies, localStorage, passwords, or session stores.");
assertIncludes("skills/douyin-analysis/references/douyin-workflow.md", "Chrome Extension collection path");
assertIncludes("skills/douyin-analysis/agents/openai.yaml", "Chrome Extension-first");
assertIncludes("README.md", "Chrome Extension-first");
assertIncludes("AGENTS.md", "Chrome Extension-first");
assertIncludes("bin/autody.js", "Chrome Extension-first");
assertIncludes("bin/autody.js", "/kaishi");
assertIncludes("bin/autody.js", "/html");
assertIncludes("README.md", "/kaishi");
assertIncludes("README.md", "/html");
assertIncludes("AGENTS.md", "/kaishi");
assertIncludes("AGENTS.md", "/html");
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

const deletedCollectorDir = ["douyin", "session"].join("-");
const deletedCollectorName = "Play" + "wright";
const deletedAuthDir = [".auth", "/"].join("");
const py = ".py";
const txt = ".txt";

const forbidden = [
  deletedCollectorName,
  deletedCollectorName.toLowerCase(),
  deletedCollectorDir,
  ["uv", "run"].join(" "),
  ["crawler", py].join(""),
  ["backfill", py].join(""),
  ["requirements", txt].join(""),
  `${deletedCollectorName.toLowerCase()}-fallback`,
  deletedAuthDir,
];

const checkedFiles = [
  "AGENTS.md",
  "README.md",
  "RELEASE_NOTES.md",
  "bin/autody.js",
  "package.json",
  "skills/douyin-analysis/SKILL.md",
  "skills/douyin-analysis/agents/openai.yaml",
  "skills/douyin-analysis/references/chrome-extension-workflow.md",
  "skills/douyin-analysis/references/douyin-workflow.md",
  "skills/douyin-analysis/references/report-design.md",
  "skills/douyin-analysis/references/lumina-html-workflow.md",
  "skills/douyin-analysis/references/lumina-template.html",
  "skills/douyin-analysis/scripts/render_lumina_report.cjs",
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
];

for (const file of checkedFiles) {
  const text = read(file);
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(`${file} must not include deleted collector reference: ${needle}`);
    }
  }
}

const deletedPaths = [
  ["backfill", py].join(""),
  ["crawler", py].join(""),
  ["paths", py].join(""),
  ["requirements", txt].join(""),
].map((name) => `skills/douyin-analysis/scripts/${deletedCollectorDir}/${name}`);

for (const file of deletedPaths) {
  if (fs.existsSync(file)) {
    throw new Error(`${file} should be deleted`);
  }
}

console.log("Chrome Extension-only policy: ok");
