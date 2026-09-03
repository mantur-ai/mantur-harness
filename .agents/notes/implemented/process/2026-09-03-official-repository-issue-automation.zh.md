# Agent Note: 官方仓库专属 Issue 自动化

Status: implemented

[English](2026-09-03-official-repository-issue-automation.md) | 中文

## 问题

GitHub 会把 Issue 策略和 Issue 生命周期工作流复制到每个 fork。它们的配置和凭据归 `deepseek-harness/deepseek-harness` 所有：拉取请求策略查询使用官方仓库的 Issue 和拉取请求编号，生命周期变更则依赖官方组织的 App。fork 因此无法正确执行任一工作流；如果把目标替换成 fork 仓库，还会在无提示的情况下改变接收策略和 Project 变更的对象。

## 决策

两个工作流作业继续订阅原有事件，不设置作业级条件。当 `github.repository` 不是 `deepseek-harness/deepseek-harness` 时，每个作业执行一个有明确名称的 no-op 步骤并成功结束。checkout 和策略执行步骤仅在官方仓库运行。生命周期的 App token 和处理步骤还会保留评审事件条件，因此批准和评论评审不会生成具备写权限的 token。

Issue 管理配置继续指向官方组织和仓库。fork 不会动态替换仓库，也不会使用凭据 fallback。

## 验证

[工作流测试](../../../../scripts/ci-workflow.spec.ts)解析两个 YAML 文件，并要求存在显式的 fork no-op、checkout 和执行步骤上的官方仓库条件，以及生命周期 token 创建和变更步骤上的仓库与事件组合条件。

## 曾考虑的替代方案

**为每个 fork 重写 Issue 管理配置。** 只有仓库名称并不能提供相匹配的 Project、标签、App 安装和策略归属，因此这种做法会产生一个看似可用但并不完整的自动化目标。

**动态选择 `github.repository`。** 这会消除眼前的 404，却会在无提示的情况下把官方治理工作流变成 fork 自有策略，并可能向从未为该 fork 配置的 Project 发送变更。

**在 fork 中跳过整个作业或删除工作流。** 作业级跳过会产生灰色检查，删除上游文件则会扩大合并偏差。显式的成功步骤既保留继承工作流的可见性，也说明它为什么没有执行操作。

## 后果

fork 拉取请求会保留成功的 Issue 策略和 Issue 生命周期作业，同时不会 checkout 受信策略代码、读取官方 App 凭据、调用官方拉取请求端点或修改官方 Project。官方仓库保留现有验证和生命周期行为。需要自有 Issue 自动化的 fork 必须明确配置并验证其归属，而不能继承 fallback。
