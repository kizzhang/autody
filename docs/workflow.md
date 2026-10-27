# Skills 如何协作

`autody` 接收目标并推进各个阶段。输入 topic 后，搜索、阅读、核对、补采和报告在同一份任务中接续完成。

![Autody 将双平台检索、精读、审读补采与报告串联，点点和豆包在需要文本时参与](../assets/pipeline.svg)

## 主题调研

| 阶段 | 谁来做 | 交付给下一步 |
| --- | --- | --- |
| 接收主题、安排进度 | [autody](../skills/autody/SKILL.md) | 搜索计划、双平台样本目标、可恢复的任务 |
| 搜索、阅读、记录 | [social-radar](../skills/social-radar/SKILL.md) | 原文、图文、可用视频文本、评论及来源 |
| 提取所需视频文本 | [xiaohongshu-analysis](../skills/xiaohongshu-analysis/SKILL.md)、[douyin-analysis](../skills/douyin-analysis/SKILL.md) | 点点／豆包候选稿及与原内容的核对结果 |
| 审读、按缺口补采 | social-radar，由 autody 推进 | 相关性、不同观点、阅读范围和补采记录 |
| 汇总、交付 | autody | 带引用的 HTML、Markdown、JSON 和证据表格 |

结果卡片用于发现线索，原始作品用于支持结论。完成判定检查检索证据、相关样本、有效审读、待补采任务和引用；文件缺失或变动会触发重新处理。AI 提取候选稿保留自己的状态，核对后才能作为已验证文本使用。

## 抖音账号复盘

```text
首次 /kaishi 或日常 /gengxin
              ↓
       /tijian → /buchong
              ↓
       /baogao → /html
```

| Skill | 负责的事 |
| --- | --- |
| [douyin-analysis](../skills/douyin-analysis/SKILL.md) | 后台采集、指标口径、文本提取和共用脚本 |
| [/kaishi](../skills/kaishi/SKILL.md)、[/gengxin](../skills/gengxin/SKILL.md) | 首次建档、增量更新 |
| [/tijian](../skills/tijian/SKILL.md)、[/buchong](../skills/buchong/SKILL.md) | 本地审计、补齐缺口 |
| [/baogao](../skills/baogao/SKILL.md)、[/html](../skills/html/SKILL.md) | 根据最新数据分析、生成 Lumina 账号报告 |

请求完整账号报告时，autody 连续推进这些阶段。单独调用短命令时，执行该命令的职责，例如 `/kaishi` 完成建档。

## 数据与运行方式

公开主题研究采用独立的报告和证据库；后台播放、留存、完播率进入账号分析。主题任务按相关性采样，开放发现模式另有推荐流与样本配额。短时增长结论使用相隔足够时间的真实观测。

当前 Codex 会话负责操作 Chrome，CLI 负责准备、恢复和检查本地任务。具体接口见 [主题工作流](../skills/autody/references/topic-workflow.md)、[账号编排](../skills/autody/references/account-orchestration.md) 和 [数据契约](../skills/social-radar/references/data-contract.md)。

[返回 README](../README.md) · [使用指南](usage.md)
