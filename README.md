<p align="center">
  <img src="assets/logo.png" alt="Autody logo" width="220">
</p>

# Autody: 创作者复盘与选题雷达

Autody 是一组给 Codex 使用的创作者分析与选题研究 skills，通过 Codex Chrome Extension 操作你已经登录的 Chrome 会话。

| 平台 | 入口 | 当前支持 |
| --- | --- | --- |
| 抖音 | `/kaishi`、`/gengxin`、`/buchong`、`/tijian`、`/baogao`、`/html` | 创作者后台底账、逐字稿、深度指标、评论和 Lumina HTML 报告 |
| 小红书（预发布） | `$xiaohongshu-analysis` | 将笔记链接交给首页点点，提取视频口播候选稿，核对原页正文与可见互动数，导出 JSON、CSV 和文本 |
| 公开选题研究（预发布） | `$social-radar` | 浏览抖音、小红书，保存素材与评论、追踪短时增长、核对 X 来源，选定题目后生成口播初稿 |

小红书有独立的 Skill 和数据口径。现有六个短命令与指标、评分、报告脚本仍用于抖音。

![Autody：抖音深度复盘与小红书点点提取，两条独立处理流程](assets/hero.png)

## 账号复盘与公开内容研究

现有账号分析 Skill 面向你本人拥有或被授权管理的抖音、小红书账号。新增 `social-radar` 用于正常页面可见的公开内容研究，独立保存原文、评论、来源和互动观测；公开赞数不能推导后台播放、留存或曝光。研究材料留在本地，遇到验证暂停对应平台，不绕过访问限制。

## 30 秒上手

安装工具需要 Node.js 18 或以上；浏览器流程需要 Codex Desktop、Chrome 与 Codex Chrome Extension。抖音推荐 Mac 环境；小红书点点流程已在 Windows Chrome 登录会话中完成单条视频实测。

从 GitHub 安装：

```bash
git clone https://github.com/kizzhang/autody.git
cd autody
node bin/autody.js install
```

安装器会复制全部 9 个 Skill。已有旧版时，先备份自己修改过的 Skill，再在仓库目录运行 `git pull --ff-only` 和 `node bin/autody.js install --force`；`--force` 会替换已有同名 Skill 目录。

也可以手动复制 skill：

```bash
mkdir -p ~/.codex/skills
cp -R skills/{douyin-analysis,kaishi,gengxin,buchong,tijian,baogao,html,xiaohongshu-analysis,social-radar} ~/.codex/skills/
```

需要小红书扩展或选题雷达时，优先使用包含对应 Skill 的 GitHub 版本。npm 的 `latest` 不一定包含预发布扩展；仅在确认所需版本已发布后使用：

```bash
npx autody@latest install --force
```

![Autody 快速上手：统一安装，按平台选择 Skill 入口](assets/quickstart.svg)

## 选题雷达：发现、保存、复看，再写初稿

```text
使用 $social-radar，研究适合我的 AI、科学、数学和观点选题。
用 Chrome 推荐流与相关推荐发现内容，默认每轮抖音25条、小红书25条；
关注低粉、低总赞但短时增长的候选，以及从 X 原帖改编来的实用方法。
先保存原图、文案、链接、视频文本和评论，再并行读已保存材料；
复看重点候选，展示选题卡、观察池、素材和运行进度。
我选择题目后，生成口播初稿、创作简报和证据/镜头表。
```

新模块保留每次准确采样时间、原始显示、素材覆盖与缺口。标题卡片或平台摘要不计作完整阅读；一个快照不能说明短时上涨。浏览器由一个执行器控制，允许的阅读代理只读已保存材料。遇到验证保存断点，恢复后继续同一轮；重复作品不补完成数。

本地工具提供只追加的事件记录、到期复看队列、真实增量计算，以及可筛选 HTML、JSON 和 Excel 可读 CSV。报告按钮生成发给 agent 的操作指令；选题后的初稿由 agent 根据原始材料撰写，脚本检查用户选择和来源关联。选题价值、传播证据、评论争论与自己的创作观点分别展示。初稿登记后会记录文件哈希：直接修改原文件，看板会保留链接并标注"已修改"；要保留修改，请另存为新文件，让 agent 登记新修订；登记后顶部提醒消失，旧版本仍在素材区标注。

公开研究仍须遵守平台条款与著作权。原视频、原图和评论只保存在本地供研究引用，不要再分发；评论者昵称等个人信息只保留必要部分，并按你自己的保存期限清理。

自动浏览可能触发平台风控，首次使用建议调低每轮数量。资料库建议每月新建一个并列目录：换库后新发现计数、增长基线和拒绝记录都要重新建立，旧库只读保留。安装不会创建定时任务。需要早晚自动运行时，在支持调度的持久聊天里明确设置时间、时区和资料库路径；建议09:00／21:00，未变化时安静更新。本地脚本不自带浏览器、模型服务或后台调度器。

第一版已测试本地记录、增速边界、续跑、安装和报告导出；新模块尚未完成真实平台50条端到端验收，媒体可获取性和点点／豆包文本完整性需现场核对。详见 [Skill](skills/social-radar/SKILL.md)、[数据与命令](skills/social-radar/references/data-contract.md) 和 [精读与初稿](skills/social-radar/references/reading-and-drafting.md)。

## 小红书：链接交给首页点点

安装后，把你本人或获授权管理的笔记链接交给 Codex：

```text
使用 $xiaohongshu-analysis 处理这些小红书笔记链接：<链接>
通过首页点点提取口播，核对原页标题、作者、正文与可见互动数，导出 JSON、CSV 和文本；未逐句核对的口播保留未验证标记。
```

Agent 会打开原笔记和首页侧栏的「点点 ai」，一次发送一条链接，等回复完成后保存；发现缺句时针对缺段追问。标题、作者、正文、互动数以原页面为准，点点返回的口播单独保存。

默认输出到工作目录下的 `outputs/xiaohongshu_analysis_YYYY-MM-DD/`（工作区另有归档规则时遵循工作区规则）：

```text
xiaohongshu_works.json
xiaohongshu_works.csv
transcripts/
evidence/
```

每条记录保留 `platform`、`noteId`、来源、提取时间、口播状态和 `dataGaps`。例如点赞仅显示 `1万` 时保存原始文字，精确值留空；原页不展示的播放、曝光、完播率等指标也留空。

验证范围：2026-10-07 已实测一条 6 分 30 秒视频及两轮点点回复，完成口播候选稿和 JSON/CSV/TXT 保存。首轮有缺句，第二轮补充后仍未逐句校验，因此状态保留 `ai_extracted_unverified`。批量采集、图文 OCR、小红书创作者后台和口播逐字准确性尚未验证。

详见 [小红书 Skill](skills/xiaohongshu-analysis/SKILL.md) 与 [点点提示词及数据口径](skills/xiaohongshu-analysis/references/diandian-workflow.md)。

## 账号分析的两条处理路径

![Autody 流程：抖音经豆包和分析生成报告，小红书经点点和原页核对导出文本](assets/pipeline.svg)

## 抖音：Codex 命令入口

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

## 抖音会抓哪些数据

基础数据：

- 作品编号、发布时间、标题文案、类型、公开视频链接。
- 播放、点赞、评论、转发、收藏。
- transcript 或图文文字，含来源和状态。

深度数据：

- 平均播放时长、完播率、5 秒留存。
- 涨粉、脱粉、主页访问、封面点击率。
- Top 评论、评论点赞数、回复数。

## 抖音会输出什么

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

## 输出对照

![Autody 输出：抖音底账与报告、小红书候选口播与证据分开保存](assets/outputs.svg)

## Agent 入口

- 公开内容选题雷达：[skills/social-radar/SKILL.md](skills/social-radar/SKILL.md)
- 小红书点点提取：[skills/xiaohongshu-analysis/SKILL.md](skills/xiaohongshu-analysis/SKILL.md)
- `/kaishi` 开始建档：[skills/kaishi/SKILL.md](skills/kaishi/SKILL.md)
- `/gengxin` 更新：[skills/gengxin/SKILL.md](skills/gengxin/SKILL.md)
- `/buchong` 补充：[skills/buchong/SKILL.md](skills/buchong/SKILL.md)
- `/tijian` 体检：[skills/tijian/SKILL.md](skills/tijian/SKILL.md)
- `/baogao` 报告：[skills/baogao/SKILL.md](skills/baogao/SKILL.md)
- `/html` Lumina HTML：[skills/html/SKILL.md](skills/html/SKILL.md)
- 抖音共享底层 skill：[skills/douyin-analysis/SKILL.md](skills/douyin-analysis/SKILL.md)
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
