---
description: "漫途桌面 profile 使用的 ManturHub 设备授权提供方与浏览器安全账号 Remote。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-authorization-manturhub`

[English](README.md) | 中文

## 概述

这个 Host 包持有当前 ManturHub 线上或测试部署，为每个已配置 origin 注册一个 `ctx.authorization` 设备码 flow，并把所有 `manturAccount.request()` 统一路由到已选部署。每个 origin 使用独立的 Host 凭据记录。生成的 `manturAccount` Remote 返回部署状态、设备登录说明、账号邮箱、进度、本机退出和持久环境切换能力，绝不返回 API Key。

## 目录

- [配置](#configuration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发记录](#dev-note)

-----

<a id="configuration"></a>

## 配置

`environment` 默认为 `production`。`baseUrl` 默认为 `https://hub.mantur.ai`，用于命名线上 origin；`testBaseUrl` 用于命名可选测试 origin，选择 `test` 前必须先配置。两个值都必须是不含凭据、路径、查询或片段的 HTTP(S) origin，且测试 origin 必须与线上不同。可写的 `manturhub` 设置分区会实时应用变更。切换环境会取消正在进行的设备 flow；桌面浏览器随后刷新，清空内存中的账号与广场状态。

公共线上 origin 保留原凭据 key，因此现有线上登录仍然有效。其他线上或测试 origin 都使用由环境与 origin 共同区分的凭据 key。更换测试 URL 后会从未登录状态开始，不会把旧测试授权发送给新服务器。环境设置只保存名称与 URL；授权仍留在凭据提供方中。

来自其他 origin 的验证地址会被拒绝。会话缺少 `interval` 或 `expires_in` 时使用 5 秒与 600 秒。`slow_down` 会给当前轮询间隔增加 5 秒；拒绝与过期会在不写入凭据的情况下结束本次尝试。

<a id="model-experience"></a>
## 模型体验

### 账号授权

#### 模型看到什么

`manturAccount` 授权状态保留在所有模型请求之外；账号信息、设备码与凭据都不会进入模型请求。

#### Token 影响

授权 flow 不会向模型请求贡献 token。

#### KV Cache 影响

授权不会改变模型请求前缀或缓存复用。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 登录尝试只存在于当前进程中，Host 停止时会被取消。
- 退出登录只删除本机授权；服务端撤销不在本 MVP 范围内。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文—点击展开</summary>

设备接口与账号接口从同一个配置 origin 解析。本包拥有的有界 JSON 读取函数与 ManturHub Host consumer 共享，使响应缓冲只保留一套实现。测试会指定本机假服务。

</details>

未发布运行时不变式 companion，因为授权服务既提交凭据又报告成功，不存在会独立变化的观测结果。
