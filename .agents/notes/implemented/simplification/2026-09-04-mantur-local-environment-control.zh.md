# Agent Note: 仅在本机控制漫途环境

Status: implemented

[English](2026-09-04-mantur-local-environment-control.md) | 中文

## 问题

线上与测试部署选择属于运维事项，但“漫途账号”页面向所有桌面用户公开了该能力。用户可以把登录、广场、详情与下载请求指向任意 HTTP(S) origin，并替换整个应用使用的环境。浏览器还会收到账号呈现并不需要的部署名称与 URL。

[环境隔离决策](../architecture/2026-09-03-mantur-environment-isolation.zh.md)仍要求所有漫途在线请求共用一个选择，并为每个 origin 保存独立凭据记录。

## 决策

本机漫途 profile patch 中的 `mantur-account` 条目是唯一环境控制入口。它的 `environment`、`baseUrl` 与 `testBaseUrl` 字段在 Host 插件激活时选择部署。账号 Remote 无法读取或更改这些字段，账号页只包含登录状态、设备授权和退出控件。

已安装的 macOS 应用读取 `~/Library/Application Support/mantur-agent/harness/profiles/mantur/cordis.patch.yml`；开发运行使用并列的 `mantur-agent-dev` 目录。维护者在按 id 定位的 patch 中保留完整的三字段 config，把 `environment` 在 `production` 与 `test` 之间切换，然后重启桌面应用，使浏览器账号或广场状态无法跨环境留存。

Host 会拒绝缺少独立 HTTP(S) `testBaseUrl` 的 `test` 配置。凭据 key 仍按环境和完整 origin 隔离，具体规则由环境隔离决策定义。之前写入的 `manturhub` 设置分区不再生效，且其中不包含授权。

## 考虑过的替代方案

**用开发标志隐藏选择器。** 这会在生产构建中保留浏览器修改代码及其 Remote API，而运行时标志错误仍可能向用户公开该控制。

**只通过环境变量选择部署。** 已安装的应用没有方便、持久的启动 shell，而 profile patch 已经提供由应用持有的本机配置文件。

**发布独立的测试应用。** 独立应用数据可提供更强隔离，但会为只有维护者使用的选择重复打包与更新通道。现有按 origin 隔离的凭据已在单一安装中提供所需的在线隔离。

## 后果

桌面用户无法看到已配置端点或切换部署。维护者编辑一个本机配置字段并重启应用。任何能编辑应用 Harness home 的人仍可以选择其他服务器，这与本机配置所有权一致。

浏览器 Remote 与生成的 Cordis API 不包含环境状态和修改方法。配置校验在 Host 激活时失败，而不是显示浏览器错误。登录、Skill 广场、配方广场、详情与下载继续共用一个当前部署，而已安装的本机 Skill 仍然共享。

## 测试

漫途账号组件与 Web ARIA 快照不包含环境控件。Host 集成测试通过插件配置选择测试环境，验证请求路由与凭据隔离，并拒绝无效的本机端点组合。生成的 API 与配置目录锁定缩减后的 Remote 以及保留的 Host 配置字段。
