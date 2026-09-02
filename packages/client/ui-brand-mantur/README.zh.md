---
description: "漫途Agent 在侧边栏与空会话首页中的文字品牌占位者，供组装漫途桌面客户端的维护者使用。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-brand-mantur`

[English](README.md) | 中文

## 概述

本包使用本地化的 `漫途Agent` 产品名称与产品承诺占用通用侧边栏与空会话品牌 slot。它移除官方鱼形后备标记，保留收起侧边栏的普通面板按钮，并以空内容占用 hero badge slot，使漫途组装不显示 Web 预览版徽标。它不改变布局、对话、模型、权限或 Agent 能力。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发记录](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

只通过 [`dsh-mantur-app`](../../bundle/mantur-app/README.zh.md) 组装本条目。浏览器端在所有者声明后注册 `sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark`、`conversation.hero.headline` 与 `conversation.hero.badge`。中英文 locale 都显示已确认的产品名称 `漫途Agent`；中文首页标题为“故事起于一念，余下交给漫途”，英文使用等价的产品承诺。本包不自行创造简称、字母组合、Logo 或应用图标。

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现，漫途的模型身份归 profile bundle 所有。

#### KV Cache 影响

无；本包中的文本不会进入 provider 请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- **正式视觉资产待定**—在漫途提供已批准的源文件前，不使用未确认的 Logo 或原生应用图标替换现有资产。
- **当前刻意使用文字名称**—现阶段的品牌表面在两种 locale 中都使用完整产品名，不把临时字形当作品牌标记。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文—点击展开</summary>

收起轨道获得的是现有面板图形，它是导航操作指示，不是品牌图形。展开行只显示产品名，不显示标记。

</details>

**运行时不变式：**不发布 companion。一个浏览器 effect 会成组安装和移除全部五个 slot 占位者。
