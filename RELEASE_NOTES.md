# release0.0.2

NPM package release.

- Adds `package.json` for the public `autody` npm package.
- Adds the `autody` CLI with `install`, `doctor`, and `skill-path` commands.
- Supports `npx autody install` to copy the `douyin-analysis` Codex skill into `~/.codex/skills`.
- Keeps installation explicit; there is no automatic environment mutation in `postinstall`.

# release0.0.1

Initial open release of Autody / 抖音分析.

- Adds the `douyin-analysis` Codex skill.
- Adds incremental gap audit and merge scripts.
- Adds Playwright-based Douyin creator-center deep metrics backfill.
- Documents first-party-only acceptable use and browser-session safety.
- Provides simple visual guidance for humans and agent-readable workflow docs.
