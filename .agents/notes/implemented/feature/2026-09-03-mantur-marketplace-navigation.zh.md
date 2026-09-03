# Agent Note: 漫途广场导航

Status: implemented

[English](2026-09-03-mantur-marketplace-navigation.md) | 中文

## Problem

漫途Agent 需要在项目浏览器上方提供只属于产品的技能广场与配方广场入口。官方 Web 客户端必须保留“工作区”术语和对话优先的启动状态，同时广场 MVP 需要独立的中央页面，不能把可穿透的浮层伪装成主页面。

## Decision

`ui-layout` 在根 entry store 中保存临时的品牌化 `MainPageId | undefined`，并声明根作用域单 occupant 的 `main.page` slot。页面激活时隐藏但不卸载对话表面，在不修改详情栏首选宽度的情况下把详情栏渲染为零宽，并向页面提供恢复当前对话的关闭操作。store 不做持久化，因此刷新后始终从对话开始。

`ui-sidebar` 在 `sidebar.workspaces` 之前声明 `sidebar.navigation`，并向 occupant 传递当前页面以及打开、关闭操作。新建会话前先关闭页面。工作区浏览器接收同一个返回操作，并在打开或新建 Session 前调用它。

`ui-workspace` 声明嵌套的 `sidebar.workspaces.heading` slot，并以现有本地化“工作区”文案作为 fallback。只由漫途组合加载的 `ui-mantur-navigation` 同时填充三个扩展点：语义上的“功能”导航分组、本地化“项目”标题，以及独立的技能与配方空页面。配方文案把配方定义为带有效果样片、提示词模板、可复现算子参数、模型与算子信息和预计复刻成本的优秀验证案例，而不是通用工作流模板。文案说明配方本身免费，算子执行开始前必须确认实时报价。可视导航遵循已确认布局，不额外显示“功能”标题；无障碍导航名称仍保留分组身份。官方 profile 不组合这个包。

## Alternatives considered

**在 `ui-sidebar` 中硬编码漫途术语和链接。** 这样会把部署文案泄漏到官方 shell，并让共享包承担所有产品专属目的地，因此改由产品包拥有 occupant。

**在 `shell.overlay` 中渲染广场页面。** 该 slot 是可穿透的浮动层，底下的对话仍可被访问。把它当作主导航会造成错误的无障碍与布局行为。

**持久化选中的广场路由。** 需求明确要求每次刷新默认回到当前对话。把选择保留在现有临时布局 store 中即可满足，不需要第二套路由 store。

## Consequences

共享客户端增加两个通用扩展点和一个临时页面选择器，漫途文案与页面结构仍隔离在单个产品包中。同一组合只能安装一个根页面 occupant。本 MVP 只展示配方定义与计费规则，明确不提供目录请求、技能安装、算子执行、报价确认、支付或路由持久化。
