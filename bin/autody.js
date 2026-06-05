#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const skillName = "douyin-analysis";
const skillSource = path.join(packageRoot, "skills", skillName);

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
}

function usage() {
  const version = readPackage().version;
  return `autody ${version}

Usage:
  autody install [--force] [--codex-home <path>]
  autody doctor [--package-only]
  autody skill-path
  autody --version

Commands:
  install     Install the douyin-analysis Codex skill into ~/.codex/skills.
  doctor      Check package files and local runtime hints.
  skill-path  Print the packaged skill path.

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

function assertPackageShape() {
  const required = [
    "README.md",
    "NOTICE.md",
    "skills/douyin-analysis/SKILL.md",
    "skills/douyin-analysis/references/chrome-extension-workflow.md",
    "skills/douyin-analysis/references/report-design.md",
    "skills/douyin-analysis/references/douyin-workflow.md",
    "skills/douyin-analysis/scripts/audit_content_gaps.cjs",
    "skills/douyin-analysis/scripts/merge_content_outputs.cjs",
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
  const dest = path.join(skillsDir, skillName);
  fs.mkdirSync(skillsDir, { recursive: true });
  if (fs.existsSync(dest)) {
    if (!opts.force) {
      throw new Error(`${dest} already exists. Re-run with --force to replace it.`);
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(skillSource, dest, { recursive: true });
  console.log(`Installed ${skillName} to ${dest}`);
  console.log("Ask Codex: Use $douyin-analysis with the Chrome Extension-first workflow to analyze my own Douyin creator account.");
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
      console.log(skillSource);
    } else {
      throw new Error(`Unknown command: ${command}\n\n${usage()}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
