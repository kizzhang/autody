# Autody

**输入一个 topic，自动调研小红书和抖音。**

![Autody：输入主题，自动搜索小红书和抖音，精读核对，交付带来源的调研报告](assets/hero.png)

Autody 是一组在 Codex 中协作的自媒体 Skills。给它一个主题，它会搜索双平台、阅读作品和评论、补齐关键材料，整理出受众关心的问题和你可以做的内容。

## 开始第一次调研

准备 Node.js 18+、支持 Chrome 操作的 Codex 和 Codex Chrome Extension，在 Chrome 登录小红书与抖音。

```bash
git clone https://github.com/kizzhang/autody.git
cd autody
node bin/autody.js install
```

然后在 Codex 中说：

```text
使用 $autody 调研「AI 编程如何改变产品经理」，
比较小红书和抖音上的不同观点、受众问题和内容机会，给我带来源的报告。
```

Autody 会接着完成搜索、精读、补采和报告。默认每个平台精读 6 篇，也可以说“先各读 3 篇”。

从分享 ZIP 使用时，解压后进入 `autody` 文件夹，运行同一条安装命令。当前 GitHub 版已包含[主题调研](https://github.com/kizzhang/autody/pull/10)；[更新已有安装](docs/usage.md#安装与更新)。

## 拿到报告，也拿到下一步选题

![三类成果：调研报告呈现观点和问题，素材库保存原文与来源，内容选题给出可展开的角度](assets/outputs.svg)

报告汇总两个平台的关键发现、不同观点和受众问题，每条引用都能回到来源。素材按主题留存在本地，选题可以接着展开成稿。

| 你想继续做什么 | 直接这样说 |
| --- | --- |
| 选角度、写初稿 | 从调研中选两个适合我的角度，写成口播初稿。 |
| 接着上次的进度 | 继续这个主题。 |
| 看一轮新变化 | 为这个主题开新一轮调研。 |
| 还没想好 topic | 使用 $social-radar 帮我发现值得做的选题。 |
| 复盘自己的抖音账号 | 使用 $autody 复盘我的抖音账号，给我分析报告和下一批内容建议。 |

**已跑通的例子：**“AI 编程如何改变产品经理”，小红书与抖音各 3 篇，完成 6 份审读并生成引用报告。[查看这次实测的来源与阅读范围](docs/validation/2026-10-27-topic-research.md)。

## 继续了解

- [使用指南](docs/usage.md)：安装更新、进度恢复、输出文件和登录验证。
- [Skills 如何协作](docs/workflow.md)：主题调研与账号复盘的完整流程。
- [开发与检查](docs/development.md)：本地校验、CLI 和数据接口。
- [版本记录](RELEASE_NOTES.md) · [使用说明](NOTICE.md) · [MIT License](LICENSE)
