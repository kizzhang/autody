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
