---
description: "漫途桌面客户端组装使用的漫途账号首次启动与设置界面。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-account`

[English](README.md) | 中文

## 概述

这个浏览器包添加漫途的首个引导步骤和“漫途账号”设置页。用户可以通过系统浏览器设备 flow 登录，也可以选择“暂时跳过”；两条路径都会把引导交给现有 DeepSeek API Key 步骤。设置页显示经过筛选的账号状态、支持本机退出登录，并能在线上环境和用户填写的测试 origin 之间切换所有漫途在线功能。

浏览器只会收到环境名与 origin、尝试 ID、验证地址、用户码、过期时间、进度和账号邮箱，绝不会收到 ManturHub API Key。环境变更成功后会刷新客户端，确保账号、Skill 广场与配方广场 controller 不会保留上一个部署的结果。

## 目录

- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发记录](#dev-note)

-----

<a id="model-experience"></a>
## 模型体验

### 账号界面

#### 模型看到什么

`settings.onboarding` 账号界面只属于浏览器呈现；其文案与状态不会进入模型请求。

#### Token 影响

账号界面不会向模型请求贡献 token。

#### KV Cache 影响

账号界面不会改变模型请求前缀或缓存复用。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- “暂时跳过”只对当前空会话引导序列生效，之后的新引导序列会再次提供登录选择。
- 环境选择会隔离线上数据与凭据。已经安装到本机实时目录的 Skill 在切换后仍可使用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文—点击展开</summary>

引导与设置占位者共享一个 root-scoped 控制器和浏览器安全 Remote 状态。

</details>

**运行时不变式：**账号引导 slot 的顺序为 `-100`，排在现有顺序为 `0` 的 DeepSeek 步骤之前。不发布运行时不变式 companion。这个浏览器包不持有持久事件流或跨插件可变状态；本包测试会直接观察注册顺序与 effect 清理。
