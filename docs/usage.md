# 使用指南

Autody 在当前 Codex 会话中完成浏览器操作和研究判断，本地脚本保存进度、校验材料并生成报告。

## 安装与更新

需要 Node.js 18+、支持 Chrome 操作的 Codex，以及 Codex Chrome Extension。浏览器采用 Chrome Extension-first，复用 Chrome 中已有的登录会话。

![安装 Skills，在 Codex 输入主题，打开报告](../assets/quickstart.svg)

首次安装：

```bash
git clone https://github.com/kizzhang/autody.git
cd autody
node bin/autody.js install
```

分享包用户解压后进入 `01_Autody主题调研/autody`，执行 `node bin/autody.js install`。一次安装全部 10 个 Skills。

更新 GitHub 安装：先保存自己修改过的同名 Skill，再运行：

```bash
git pull --ff-only
node bin/autody.js install --force
node bin/autody.js doctor
```

当前版本为 `0.0.5-topic.1`，已通过 [PR #10](https://github.com/kizzhang/autody/pull/10) 合入 [main](https://github.com/kizzhang/autody)。上面的命令取得当前 GitHub 版本；npm 发布另行更新。

## 发出主题任务

```text
使用 $autody 调研「你的 topic」，比较小红书和抖音上的不同观点、
受众问题和内容机会，给我带来源的报告。
```

默认每个平台精读 6 篇相关作品。想先看小样本，在请求里加上“先各读 3 篇”。Autody 自动推导搜索词，打开结果中的作品，阅读原文与评论，审读和补采后交付报告。

需要写稿时可以一并说“调研后选两个适合我的角度并写口播初稿”。选题和写稿会接着执行，初稿供你审阅。

## 恢复进度

- “继续这个主题”：沿用同一任务、同一轮和已读材料。
- “为这个主题开新一轮”：重新检索，保留前一轮记录供比较。
- 登录、短信或验证码出现时，Autody 保存进度并继续另一平台。你在 Chrome 完成验证后，告诉 Codex“已完成”，它会恢复原任务。

报告会标明样本覆盖、阅读范围与待补内容。某个平台暂时无法访问时，先交付已有材料的部分报告，再从断点补齐。

## 找到输出文件

结果保存在你的项目输出目录，遵循工作区归档规则。研究资料与工具源码分别保存。

```text
topic-主题-稳定编号/
  task.json                 # 阶段与任务状态
  events/                   # 采集、审读和补采历史
  searches/                 # 搜索结果证据
  materials/                # 原文、截图、评论、提取候选稿
  deliveries/交付编号/
    research.html           # 浏览器中阅读的调研报告
    research.md             # 可编辑的报告
    research.json           # 结构化报告
    evidence/report.html    # 可筛选的证据视图
    evidence/tracking.csv   # 表格素材索引
```

每次交付都有独立目录；报告引用对应来源材料。原始素材留在你的本地研究资料库，工具分享包包含源码、说明和示意配图。

## 选择其他任务

| 任务 | 入口 | 输出 |
| --- | --- | --- |
| 围绕一个主题研究 | `$autody 调研……` | 双平台调研报告、证据和选题 |
| 从推荐流发现方向 | `$social-radar 帮我找选题` | 素材库、观察池、选题与初稿 |
| 复盘自己的抖音账号 | `$autody 复盘我的抖音账号并给报告` | 后台指标分析、Lumina 报告、内容建议 |
| 处理一条小红书笔记 | `$xiaohongshu-analysis` 加笔记链接 | 笔记内容、点点提取候选稿与核对结果 |

账号复盘适用于本人或已获授权的抖音后台。小红书支持公开主题调研和笔记分析，创作者后台分析留待后续版本。

需要定时运行时，在请求中给出时间、时区和资料库，由宿主调度器设置。安装只配置 Skills，调研在你发出请求后启动。

[返回 README](../README.md) · [Skills 流程](workflow.md) · [实测记录](validation/2026-10-27-topic-research.md)
