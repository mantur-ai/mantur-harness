# Agent Note：Web 悬停操作同步

Status: implemented

[English](2026-09-04-web-hover-action-stability.md) | 中文

## Problem

阻塞合并的 Web 快照任务会偶发在 DOM 中找到工作区操作按钮，但在整个 Playwright 超时期间一直判定它处于隐藏状态。该按钮只会在所在行匹配 `:hover` 时显示。投影更新可能在第一次悬停后替换该行，此时指针还留在旧几何位置上，而新解析到的按钮仍保持隐藏。

该场景验证用户能够显示并触发真实的悬停操作。强制点击或直接选择隐藏按钮会绕过这一行为。

## Decision

轮询完整的显示前置条件：悬停 Playwright 当前解析到的行，再检查该行当前的操作按钮是否可见。观察到可见后，正常点击按钮。每次轮询都会重新解析 locator，因此投影替换行后，测试不会在未恢复悬停状态的情况下继续等待隐藏的新按钮。

产品行为、超时设置和浏览器并发度均不变。

## Verification

- `DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts`
- 阻塞合并的 `node 24 / snapshots and artifacts` PR 任务会以仓库 Web 快照并发度运行该场景。

## Alternatives considered

**强制点击按钮。** 不采用，因为它会触发用户无法看到的控件。

**增加 Playwright 超时时间。** 不采用，因为失败状态不会随等待变成可见；当前行必须重新获得悬停。

## Consequences

该场景现在会等待用户触发前同样必需的可见状态，并在投影替换行时继续有效。产品代码不变。
