<p align="center">
  <img src="assets/logo.png" alt="Autody logo" width="220">
</p>

# Autody: 抖音分析

Autody 是一组给 Codex 用的抖音创作者分析 skills。它让 agent 通过 Codex Chrome Extension 使用你已经登录的 Chrome 会话分析你自己的抖音作品，补齐逐字稿、深度指标、Top 评论，并生成 JSON、CSV、Markdown 和 Lumina HTML 报告。

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
cp -R skills/{douyin-analysis,kaishi,gengxin,buchong,tijian,baogao,html} ~/.codex/skills/
```

如果 npm 包已经发布到你的环境，也可以使用：

```bash
npx autody@latest install --force
```

![Autody quickstart](assets/quickstart.svg)

## Codex 命令入口

```text
/kaishi
/gengxin
/buchong
/tijian
/baogao
/html
```

Autody 会要求 agent：

- 优先用 Codex Chrome Extension 接管你已经登录的 `creator.douyin.com` Chrome tab。
- `/kaishi` 做第一次全量建档，只产底账和审计，不顺手生成报告。
- `/gengxin` 找新作品并刷新过期指标。
- `/buchong` 按 `content_gap_audit*.json` 只补缺口。
- `/tijian` 只做本地数据体检，不打开浏览器。
- `/baogao` 每次基于最新数据重新分析，输出新报告结论。
- `/html` 只用 Lumina 视觉系统，把最新数据/报告渲染成 HTML；旧 HTML 只当视觉参考，不复用旧结论。
- 先审计缺口，再只补缺失或过期字段。
- 每条作品完成后立刻写入 progress，断了可以继续。
- 发给豆包提取 transcript 时按人类节奏逐条处理：复用一个正常豆包窗口，不并发、不秒发，等结果完成并保存后再下一条；上下文污染或失败时才新开会话。
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
report_lumina_payload.json
report_lumina.html
```

![Outputs](assets/outputs.svg)

## Agent 入口

- `/kaishi` 开始建档：[skills/kaishi/SKILL.md](skills/kaishi/SKILL.md)
- `/gengxin` 更新：[skills/gengxin/SKILL.md](skills/gengxin/SKILL.md)
- `/buchong` 补充：[skills/buchong/SKILL.md](skills/buchong/SKILL.md)
- `/tijian` 体检：[skills/tijian/SKILL.md](skills/tijian/SKILL.md)
- `/baogao` 报告：[skills/baogao/SKILL.md](skills/baogao/SKILL.md)
- `/html` Lumina HTML：[skills/html/SKILL.md](skills/html/SKILL.md)
- 共享底层 skill：[skills/douyin-analysis/SKILL.md](skills/douyin-analysis/SKILL.md)
- Chrome Extension 工作流：[skills/douyin-analysis/references/chrome-extension-workflow.md](skills/douyin-analysis/references/chrome-extension-workflow.md)
- 报告设计规则：[skills/douyin-analysis/references/report-design.md](skills/douyin-analysis/references/report-design.md)
- Lumina HTML 工作流：[skills/douyin-analysis/references/lumina-html-workflow.md](skills/douyin-analysis/references/lumina-html-workflow.md)
- 数据流程参考：[skills/douyin-analysis/references/douyin-workflow.md](skills/douyin-analysis/references/douyin-workflow.md)
- 人类快速提示：[AGENTS.md](AGENTS.md)

CLI 只负责安装和检查 skill：

```bash
autody install --force
autody doctor
autody skill-path [skill]
```

## 安全与合规

本项目不会要求导出或读取浏览器 cookie 文件、密码、localStorage 或会话数据库。`.cheat-cache/`、cookies、raw private dumps 永远不要提交到 GitHub。

Chrome Extension-first 路径只操作正常 Chrome 标签页和页面可见数据；如果 Chrome 页面没有暴露某个字段，就在输出中明确记录缺口。

## License

MIT License. See [LICENSE](LICENSE).
