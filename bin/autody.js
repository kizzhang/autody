#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const skillNames = ["douyin-analysis", "kaishi", "gengxin", "buchong", "tijian", "baogao", "html"];

function skillSource(skillName) {
  return path.join(packageRoot, "skills", skillName);
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
}

function usage() {
  const version = readPackage().version;
  return `autody ${version}

Usage:
  autody install [--force] [--codex-home <path>]
  autody doctor [--package-only]
  autody skill-path [skill]
  autody --version

Commands:
  install     Install the Autody Codex skills into ~/.codex/skills.
  doctor      Check package files and local runtime hints.
  skill-path  Print a packaged skill path.

Safety:
  Autody is for first-party or explicitly authorized Douyin creator data only.
  Collection is Chrome Extension-first. Use /kaishi, /gengxin, /buchong, /tijian, /baogao, or /html in Codex after install.
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

function assertPackageShape() {
  const required = [
    "AGENTS.md",
    "LICENSE",
    "RELEASE_NOTES.md",
    "README.md",
    "NOTICE.md",
    "skills/douyin-analysis/agents/openai.yaml",
    "skills/douyin-analysis/SKILL.md",
    "skills/douyin-analysis/assets/icon.svg",
    "skills/douyin-analysis/references/chrome-extension-workflow.md",
    "skills/douyin-analysis/references/report-design.md",
    "skills/douyin-analysis/references/douyin-workflow.md",
    "skills/douyin-analysis/references/lumina-html-workflow.md",
    "skills/douyin-analysis/references/lumina-template.html",
    "skills/douyin-analysis/scripts/audit_content_gaps.cjs",
    "skills/douyin-analysis/scripts/merge_content_outputs.cjs",
    "skills/douyin-analysis/scripts/render_lumina_report.cjs",
  ];
  for (const skillName of skillNames.filter((name) => name !== "douyin-analysis")) {
    required.push(`skills/${skillName}/SKILL.md`);
    required.push(`skills/${skillName}/agents/openai.yaml`);
    required.push(`skills/${skillName}/assets/icon.svg`);
  }
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
    .map((skillName) => path.join(skillsDir, skillName))
    .filter((dest) => fs.existsSync(dest));
  if (existing.length && !opts.force) {
    throw new Error(`${existing.join("\n")} already exists. Re-run with --force to replace it.`);
  }
  for (const skillName of skillNames) {
    const dest = path.join(skillsDir, skillName);
    if (opts.force) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(skillSource(skillName), dest, { recursive: true });
    console.log(`Installed ${skillName} to ${dest}`);
  }
  console.log("Ask Codex: run /kaishi for first baseline, /gengxin to update, /buchong to backfill, /tijian to audit, /baogao to analyze, or /html for Lumina HTML.");
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
      const requestedSkill = opts._[0] || "douyin-analysis";
      if (!skillNames.includes(requestedSkill)) {
        throw new Error(`Unknown skill: ${requestedSkill}. Known skills: ${skillNames.join(", ")}`);
      }
      console.log(skillSource(requestedSkill));
    } else {
      throw new Error(`Unknown command: ${command}\n\n${usage()}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
