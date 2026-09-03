# Agent Note: 隔离 Fork 的 Issue 自动化

Status: implemented

[English](2026-09-03-fork-isolated-issue-automation.md) | 中文

## 问题

GitHub 会把 Issue 策略和 Issue 生命周期工作流复制到每个 fork。fork 中的拉取请求和 Issue 编号并不对应其上游仓库中的同一对象，生命周期工作流还依赖仓库自有的 App 凭据和 Project 配置。因此，在 fork 中运行继承的自动化可能失败，也可能把操作指向不归该 fork 所有的治理状态。

## 决策

两个工作流作业继续订阅原有事件，不设置作业级条件。当 `github.event.repository.fork` 为 `true` 时，每个作业执行一个有明确名称的 no-op 步骤并成功结束。当该值为 `false` 时，checkout 和策略执行步骤保留原有行为。生命周期的 App token 和处理步骤还会保留评审事件条件，因此批准和评论评审不会生成具备写权限的 token。

该条件使用 GitHub 提供的仓库 `fork` 事实，而不是仓库 slug，因此非 fork 仓库在转移或改名后仍保留原执行路径。Issue 管理配置保持不变；其中的组织、仓库、App 安装和 Project 归属仍是独立的非 fork 问题，而不是这些工作流提供的 fallback。

## 验证

[工作流测试](../../../../scripts/ci-workflow.spec.ts)解析两个 YAML 文件，并要求存在显式的 fork no-op、checkout 和策略执行步骤上的非 fork 条件，以及生命周期 token 创建和变更步骤上的非 fork 与事件组合条件。

## 曾考虑的替代方案

**把 `github.repository` 与一个 canonical slug 比较。** 仓库转移或改名后，字面仓库名会过时，并可能禁用预期的非 fork 执行路径。事件已经直接携带仓库的 fork 分类。

**动态选择 fork 仓库。** 这会消除一个端点不匹配，却会在没有相应 Project、标签、App 安装或策略归属的情况下，把继承的治理逻辑变成 fork 自有策略。

**在 fork 中跳过整个作业或删除工作流。** 作业级跳过会产生灰色检查，删除上游文件则会扩大合并偏差。显式的成功步骤既保留继承工作流的可见性，也说明它为什么没有执行操作。

## 后果

fork 拉取请求会保留成功的 Issue 策略和 Issue 生命周期作业，同时不会 checkout 策略代码、读取 App 凭据、调用策略端点或修改 Project。非 fork 仓库保留原有行为和配置，其中也包括任何独立存在的归属配置错误。需要自有 Issue 自动化的 fork 必须明确配置并验证其归属。
