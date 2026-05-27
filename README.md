# Autody: 抖音分析

给自己的 coding agent 一个可复用的 Codex skill，让它在 Mac + Codex + Chrome 环境里分析你自己的抖音创作者数据，并导出 JSON、CSV、Markdown 报告。

![Autody quickstart](assets/quickstart.svg)

## 适用范围

Autody 只面向你本人拥有或被授权管理的抖音账号与视频数据。请勿用本项目分析、抓取或规避访问任何他人的非授权数据；若使用者将本项目用于分析他人视频、账号或未授权内容，由使用者自行承担全部法律、合规与平台责任。

## 最优上手方式

目前最稳的组合是 Mac + Codex Desktop + Chrome：让 Codex 读取 `$douyin-analysis`，使用你自己的登录态进入创作者中心，逐条保存进度，结束后自动关闭临时页面。

![Agent pipeline](assets/pipeline.svg)

安装 skill：

```bash
git clone https://github.com/kizzhang/autody.git
mkdir -p ~/.codex/skills
cp -R autody/skills/douyin-analysis ~/.codex/skills/
```

给 Codex 的一句话：

```text
Use $douyin-analysis to analyze my own Douyin creator account, backfill missing deep metrics, extract transcripts, and export JSON/CSV/Markdown reports.
```

## 会输出什么

报告会保留作品基础数据、完播率、5 秒留存、平均播放时长、涨粉/脱粉、主页访问、Top 评论和 transcript 来源，方便后续用表格或 agent 继续分析。

![Outputs](assets/outputs.svg)

## Agent 入口

- Agent 先读 [skills/douyin-analysis/SKILL.md](skills/douyin-analysis/SKILL.md)。
- 人类快速提示看 [AGENTS.md](AGENTS.md)。
- 抖音接口经常变化；如果抓取失败，先看 `.cheat-cache/douyin-session-debug/` 里的 URL 与页面文本，再更新脚本。

## 安全与合规

本项目不会要求导出或读取浏览器 cookie 文件、密码、localStorage 或会话数据库。Playwright 登录态只应保存在你本机项目目录的 `.auth/`，并且 `.auth/` 永远不要提交到 GitHub。

## License

MIT License. See [LICENSE](LICENSE).
