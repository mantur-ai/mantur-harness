# Agent Note：Web 工作区创建完成信号

Status: implemented

[English](2026-09-04-web-hover-action-stability.md) | 中文

## Problem

阻塞合并的 Web 快照任务会偶发在打开前一个测试创建的工作区操作菜单时失败。创建 helper 在目录完成注册并显示标题后就会返回，但产品此时仍在创建和挂载该工作区的空白 Session 与 Agent。后续投影更新可能在悬停操作按钮显示后、Playwright 点击前替换该行。

反复悬停直到按钮可见也无法关闭这个生命周期竞态：下一轮 CI 已经观察到按钮可见，但普通点击完成前 locator 又被替换。

## Decision

每个新工作区注册后，创建 helper 还要等待 Agent 数量增加。这是该场景在采用会创建空白 Session 的已有目录时，已经使用的同一个 Host 完成信号。因此，下一个测试会在工作区注册和初始 Session 挂载都完成后才开始。

操作交互保持不变：悬停所在行，悬停已显示的按钮，再正常点击。产品行为、超时设置和浏览器并发度均不变。

## Verification

- `DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts`
- `DSH_SNAPSHOT=replay DSH_WEB_SNAPSHOT_WORKERS=2 pnpm run test:web:ci`
- 阻塞合并的 `node 24 / snapshots and artifacts` PR 任务会以仓库 Web 快照并发度运行该场景。

## Alternatives considered

**重试操作点击。** 不采用，因为观察者看到点击完成之前，点击已可能产生效果；重试有副作用的操作不是安全的同步方式。

**强制点击按钮或增加超时时间。** 不采用，因为两者都没有等待会替换行的工作区创建生命周期完成。

## Consequences

创建测试现在会等待自己启动的空白 Session 完成，后续重命名测试会与稳定的工作区行交互。产品代码不变。
