const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const packageRoot = path.resolve(__dirname, "..");
const legacySkills = ["douyin-analysis", "kaishi", "gengxin", "buchong", "tijian", "baogao", "html"];
const allSkills = [...legacySkills, "xiaohongshu-analysis"];

function temporaryDirectory(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "autody-install-test-"));
  t.after(() => {
    // Delete only the exact directory created by this test, under the temp parent.
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith("autody-install-test-"));
    fs.rmSync(resolved, { recursive: true });
  });
  return root;
}

function cli(args, root = packageRoot) {
  const result = spawnSync(process.execPath, [path.join(root, "bin", "autody.js"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function assertTreeMatches(source, destination) {
  const sourceNames = fs.readdirSync(source).sort();
  assert.deepEqual(fs.readdirSync(destination).sort(), sourceNames);
  for (const name of sourceNames) {
    const src = path.join(source, name);
    const dest = path.join(destination, name);
    if (fs.statSync(src).isDirectory()) assertTreeMatches(src, dest);
    else assert.deepEqual(fs.readFileSync(dest), fs.readFileSync(src), dest);
  }
}

test("install includes the complete Xiaohongshu skill alongside all Douyin skills", (t) => {
  const home = path.join(temporaryDirectory(t), "codex-home");
  const result = cli(["install", "--codex-home", home]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(path.join(home, "skills")).sort(), allSkills.slice().sort());
  for (const skill of allSkills) {
    assertTreeMatches(path.join(packageRoot, "skills", skill), path.join(home, "skills", skill));
  }
  const location = cli(["skill-path", "xiaohongshu-analysis"]);
  assert.equal(location.status, 0, location.stderr);
  assert.equal(location.stdout.trim(), path.join(packageRoot, "skills", "xiaohongshu-analysis"));
  const defaultLocation = cli(["skill-path"]);
  assert.equal(defaultLocation.status, 0, defaultLocation.stderr);
  assert.equal(defaultLocation.stdout.trim(), path.join(packageRoot, "skills", "douyin-analysis"));
});

test("upgrading a seven-skill installation requires force and preserves unrelated skills", (t) => {
  const root = temporaryDirectory(t);
  const home = path.join(root, "codex-home");
  const skills = path.join(home, "skills");
  for (const skill of legacySkills) {
    const dest = path.join(skills, skill);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "SKILL.md"), "user-edited old skill");
  }
  const unrelated = path.join(skills, "unrelated-personal-skill");
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, "SKILL.md"), "keep this");

  const refused = cli(["install", "--codex-home", home]);
  assert.equal(refused.status, 1);
  assert.equal(fs.readFileSync(path.join(skills, "kaishi", "SKILL.md"), "utf8"), "user-edited old skill");
  assert.equal(fs.existsSync(path.join(skills, "xiaohongshu-analysis")), false);

  // The forced installer can replace only these verified, test-created destinations.
  for (const skill of legacySkills) {
    assert.equal(fs.realpathSync(path.join(skills, skill)), path.join(fs.realpathSync(root), "codex-home", "skills", skill));
  }
  const upgraded = cli(["install", "--codex-home", home, "--force"]);
  assert.equal(upgraded.status, 0, upgraded.stderr);
  for (const skill of allSkills) {
    assertTreeMatches(path.join(packageRoot, "skills", skill), path.join(skills, skill));
  }
  assert.equal(fs.readFileSync(path.join(unrelated, "SKILL.md"), "utf8"), "keep this");
});

test("doctor and install reject a package missing the Diandian workflow reference", (t) => {
  const root = temporaryDirectory(t);
  const fixture = path.join(root, "incomplete-package");
  fs.mkdirSync(fixture);
  for (const entry of ["bin", "skills", "package.json", "AGENTS.md", "LICENSE", "NOTICE.md", "README.md", "RELEASE_NOTES.md"]) {
    fs.cpSync(path.join(packageRoot, entry), path.join(fixture, entry), { recursive: true });
  }
  const reference = "skills/xiaohongshu-analysis/references/diandian-workflow.md";
  fs.unlinkSync(path.join(fixture, reference));
  const home = path.join(root, "must-not-be-created");
  for (const args of [["doctor", "--package-only"], ["install", "--codex-home", home]]) {
    const result = cli(args, fixture);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(reference), result.stderr);
  }
  assert.equal(fs.existsSync(home), false);
});
