---
description: "漫途桌面客户端专属的侧栏导航与广场空页面。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-navigation`

[English](README.md) | 中文

## 概述

这个纯浏览器插件为漫途侧栏增加“功能”分组、“技能广场”和“配方广场”入口，并提供两个独立的空主页面。配方表示可替换用户内容并复刻效果的优秀验证案例，不是通用工作流模板。这个包还把分组工作区标题替换为本地化的产品术语“项目”。官方 Web 组合不加载这个包，继续显示“工作区”。

## 目录

- [使用方式](#use-this-package)
- [了解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用方式

只通过 [`dsh-mantur-app`](../../bundle/mantur-app/README.zh.md) 组合这个包。所有者声明完成后，该包填充 `sidebar.navigation`、`sidebar.workspaces.heading` 和 `main.page`。配方页面把每条配方定义为带有效果样片、提示词模板、可复现算子参数、模型与算子信息和预计复刻成本的案例。页面说明配方本身免费，算子执行采用实时报价，并在开始前由用户确认。页面选择存放在布局的临时 store 中，因此每次刷新都回到当前对话，不会把广场页面写入磁盘。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现细节——点击展开</summary>

浏览器插件安装一个本地化导航 occupant、一个“项目”标题 occupant 和一个根页面 occupant。导航把选中的品牌化页面标识写入布局 store；根页面 occupant 渲染对应的空页面，并通过所有者操作关闭它。卸载插件会移除三个 occupant 及其本地化字典。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

以下页面分别负责共享扩展点和漫途组合。

- [ui-layout](../ui-layout/README.zh.md) — 临时根页面状态和 `main.page` seat。
- [ui-sidebar](../ui-sidebar/README.zh.md) — 导航与工作区 seat。
- [mantur-app](../../bundle/mantur-app/README.zh.md) — 加载这个包的产品组合。

-----

<a id="model-experience"></a>
## 模型体验

无，因为这个包只提供浏览器展示，不注册任何模型可见内容。

#### KV Cache 影响

无；导航和空页面文案不会进入模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 页面刻意不包含 ManturHub 请求、技能安装、配方执行、支付或目录数据。
- 广场内容和操作由后续产品工作接入；这个包只负责导航和页面入口。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

**运行时不变量：** 不发布 companion。卸载浏览器插件会同时移除三个漫途 occupant 与其字典。
