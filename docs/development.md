# 开发与检查

在仓库根目录运行：

```bash
npm test
npm run pack:dry
node bin/autody.js doctor --package-only
```

测试覆盖采集记录、审读与补采、断点恢复、引用与文件完整性，以及 Skills 安装。2026-10-27 的功能验收通过 240 项测试，见 [实测记录](validation/2026-10-27-topic-research.md)。

## 本地任务接口

```bash
node bin/autody.js research --topic "你的主题" --root "项目输出目录"
```

命令准备或恢复任务，返回下一步动作；当前 agent 接着执行浏览器步骤。这个 CLI 是工作流辅助工具，需要与 Codex 会话配合使用。

- [主题任务与状态](../skills/autody/references/topic-workflow.md)
- [账号阶段编排](../skills/autody/references/account-orchestration.md)
- [事件数据契约](../skills/social-radar/references/data-contract.md)

## 文档与配图

README 使用 `assets/hero.png` 作为主图，`assets/outputs.svg` 展示交付成果。`hero.svg` 是简化的矢量替代版；`quickstart.svg` 和 `pipeline.svg` 用于详细指南。配图展示产品流程，实际研究覆盖以报告与实测记录为准。

视觉沿用 Autody 的酒红、象牙白和平台图标；文案使用简短的动作与成果描述。设计方法参考 [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)，文案参考 [Corey Haines copywriting](https://github.com/coreyhaines31/marketingskills/blob/main/skills/copywriting/SKILL.md)。主图通过内置 imagegen 重新生成，[提示词](../assets/hero.prompt.txt)随图保留；矢量图为项目内绘制。

研究用的原图、视频、评论和会话页面保存在本地项目。仓库提交工具与文档；凭证、浏览器存储和私有账号数据留在仓库之外。

[返回 README](../README.md)
