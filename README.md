<p align="center">
  <img src="assets/logo.png" alt="Autody logo" width="220">
</p>

# Autody: 抖音分析

Autody 是一个给 Codex 用的抖音创作者分析 skill。它让 agent 通过 Codex Chrome Extension 使用你已经登录的 Chrome 会话分析你自己的抖音作品，补齐逐字稿、深度指标、Top 评论，并生成 JSON、CSV、Markdown 和 HTML 报告。

![Autody 顶图](assets/hero.png)

## 只分析自己的账号

Autody 只面向你本人拥有或被授权管理的抖音账号与视频数据。请勿用本项目分析、抓取或规避访问任何他人的非授权数据。若使用者将本项目用于分析他人视频、账号或未授权内容，由使用者自行承担全部法律、合规与平台责任。

## 30 秒上手

推荐环境：Mac + Codex Desktop + Chrome + Codex Chrome Extension。Chrome 负责你的登录态，Codex 通过 Chrome Extension 接管 creator-center tab 并按 skill 执行流程。

从 GitHub 安装：

```bash
git clone https://github.com/kizzhang/autody.git
cd autody
node bin/autody.js install --force
```

也可以手动复制 skill：

```bash
mkdir -p ~/.codex/skills
cp -R autody/skills/douyin-analysis ~/.codex/skills/
```

如果 npm 包已经发布到你的环境，也可以使用：

```bash
npx autody@latest install --force
```

![Autody quickstart](assets/quickstart.svg)

## 给 Codex 的一句话

```text
Use $douyin-analysis with the Chrome Extension-first workflow to analyze my own Douyin creator account, backfill missing metrics, extract transcripts one by one, and export JSON/CSV/Markdown/HTML reports.
```

Autody 会要求 agent：

- 优先用 Codex Chrome Extension 接管你已经登录的 `creator.douyin.com` Chrome tab。
- 先审计缺口，再只补缺失或过期字段。
- 每条作品完成后立刻写入 progress，断了可以继续。
- 发给豆包提取 transcript 时一条视频开一个页面，用完就关，避免页面越来越卡。
- Chrome 页面拿不到的字段标记为 `dataGap`，不再启动第二套浏览器采集器。
- 低播放但被隐藏/限流的样本只做文案诊断，不参与曝光归因。
- HTML 报告必须有可读结构：气泡图、因子地图、关键样本复盘、逐条表格和下一批建议。

![Agent pipeline](assets/pipeline.svg)

## 会抓哪些数据

基础数据：

- 作品编号、发布时间、标题文案、类型、公开视频链接。
- 播放、点赞、评论、转发、收藏。
- transcript 或图文文字，含来源和状态。

深度数据：

- 平均播放时长、完播率、5 秒留存。
- 涨粉、脱粉、主页访问、封面点击率。
- Top 评论、评论点赞数、回复数。

## 会输出什么

默认输出到 `outputs/douyin_analysis_YYYY-MM-DD/`：

```text
douyin_works_final.json
transcript_progress.json
deep_metrics_progress.json
content_gap_audit.json
douyin_deep_works_final.json
douyin_deep_works_final.csv
douyin_deep_transcripts_final.md
report.html
```

![Outputs](assets/outputs.svg)

## Agent 入口

- Agent 主入口：[skills/douyin-analysis/SKILL.md](skills/douyin-analysis/SKILL.md)
- Chrome Extension 工作流：[skills/douyin-analysis/references/chrome-extension-workflow.md](skills/douyin-analysis/references/chrome-extension-workflow.md)
- 报告设计规则：[skills/douyin-analysis/references/report-design.md](skills/douyin-analysis/references/report-design.md)
- 数据流程参考：[skills/douyin-analysis/references/douyin-workflow.md](skills/douyin-analysis/references/douyin-workflow.md)
- 人类快速提示：[AGENTS.md](AGENTS.md)

CLI 只负责安装和检查 skill：

```bash
autody install --force
autody doctor
autody skill-path
```

## 安全与合规

本项目不会要求导出或读取浏览器 cookie 文件、密码、localStorage 或会话数据库。`.cheat-cache/`、cookies、raw private dumps 永远不要提交到 GitHub。

Chrome Extension-first 路径只操作正常 Chrome 标签页和页面可见数据；如果 Chrome 页面没有暴露某个字段，就在输出中明确记录缺口。

## License

MIT License. See [LICENSE](LICENSE).
