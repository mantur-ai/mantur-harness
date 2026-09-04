---
description: "漫途桌面客户端专属的侧栏导航、技能广场与配方广场界面。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-navigation`

[English](README.md) | 中文

## 概述

这个纯浏览器插件为漫途侧栏增加“技能广场”和“配方广场”入口，并提供两个独立主页面。技能页面读取 Host 投影的 ManturHub 目录、打开详情、通过设备登录门禁安装，并展示安装与本地冲突状态。配方表示可替换用户内容并复刻效果的优秀验证案例，不是通用工作流模板。这个包还把分组工作区标题替换为本地化的产品术语“项目”。官方 Web 组合不加载这个包，继续显示“工作区”。

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

只通过 [`dsh-mantur-app`](../../bundle/mantur-app/README.zh.md) 组合这个包。所有者声明完成后，该包填充 `sidebar.navigation`、`sidebar.workspaces.heading` 和 `main.page`，再挂载浏览器安全的广场 Remote。打开技能页面会加载公开目录与本地安装标记；选择卡片会加载详情；登录后的安装请求通过 Host 写入文件，且只有 Host 确认后才更新可见卡片。未登录时，安装入口会启动现有 ManturHub 设备登录流程。页面选择存放在布局的临时 store 中，因此每次刷新都回到当前对话，不会把广场页面写入磁盘。

配方页面通过服务端文本与分类筛选加载公开 ManturHub 目录，展示效果样片与分页，并在页面内打开包含可替换输入、提示词模板、模型、算子和权威复刻说明的详情。配方本身免费，算子执行采用实时报价，并在开始前由用户确认。“交给 Agent 复刻”会在当前项目中新建会话，并把 Hub 返回的 `agent_payload` 连同配方 slug 与 ManturHub 标识作为首条用户消息提交。仅当 ManturHub 发布来源 URL 时，这条消息才包含该地址。环境切换后，账号设置页会刷新浏览器，返回对话页并丢弃两个广场 store，然后才请求已选 origin。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现细节——点击展开</summary>

浏览器插件安装一个本地化导航 occupant、一个“项目”标题 occupant、一个根页面 occupant 和一个根作用域广场 controller。controller 分别管理技能与配方的目录和详情快照，生成的 Remote 让凭据与文件系统访问始终留在 Host。启动配方时，它通过现有 controller 找到当前工作区、新建并打开会话，再通过作用域化 Conversation 服务发送复刻请求。导航把选中的品牌化页面标识写入布局 store；根页面 occupant 渲染对应页面，并通过所有者操作关闭它。插件卸载或替换导致活跃根页面 occupant 卸载时，它也会清除自己的页面标识，让对话重新可见。卸载插件会让进行中的状态变更失效、清除登录轮询，并移除三个 occupant 与本地化字典。

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

无隐藏的模型上下文；选中的配方会作为普通的首条持久用户消息提交。追溯文案使用当前界面语言，并包含标题、slug、ManturHub 标识以及 ManturHub 发布的可选来源 URL；其后的 `agent_payload` 保持发布原文。

#### KV Cache 影响

配方消息会一次性贡献普通用户提示词 token。导航、目录卡片、详情元数据和其他界面文案不会进入模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 配方发现与交接已可用。算子执行、报价确认和支付继续由 Agent 与 ManturHub 能力负责，不进入这个展示包。
- 技能页面支持安装，但刻意不提供强制覆盖或卸载。安装后被修改的受跟踪目录以及任何预先存在的未跟踪目录都需要人工处理。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

**运行时不变量：** 不发布 companion。组件和 store 测试覆盖目录加载、空与失败响应、详情选择、登录后安装、设备登录、冲突与轮询清理；Host 集成测试负责文件系统与凭据安全。
