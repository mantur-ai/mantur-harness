# Agent Note：Windows coverage 图片素材与重写预算

Status: implemented

[English](2026-09-04-windows-coverage-image-and-rewrite-budgets.md) | 中文

## Problem

Windows coverage 阻断 lane 中有两个行为测试依赖 runner 速度。抗锯齿文字归一化用例会栅格化一张 1024×512 SVG、缩小图片、编码 JPEG，再读取图片统计值。一次成功的托管 Windows 运行仅这个用例就耗时 13.3 秒，后续运行则用尽 lane 的单测试 90 秒预算。归档投影 fixture 也只等待异步 checkpoint 重写 5 秒；在同一轮争抢运行中，它在标题写入落盘前读到了当前文档。

两个测试都不负责性能要求。图片用例验证两倍缩小和 JPEG 归一化仍保留深浅值；投影用例验证最终存储的版本、lineage 与标题。

## Decision

将生成图片素材与目标的宽高都减半，同时保留 2:1 宽高比、两倍缩小、抗锯齿文字、JPEG 输出和对比度断言。源像素数降为四分之一，而测试行为不变。

异步投影重写在 Windows 上等待 30 秒，其他平台保留原有 5 秒。断言仍针对可观察的存储字段；永远不落盘的写入仍会在 Windows coverage lane 的单测试 90 秒预算内失败。产品图片归一化与投影持久化代码均不改变。

## Verification

- `pnpm exec vitest run packages/attachment/attachment-local/tests/normalization.spec.ts packages/session/session-projection-cache/tests/fixtures.spec.ts scripts/benchmark-npm-resolution.spec.ts`
- `pnpm run doc-sync`
- 拉取请求中具有阻断作用的 `windows node 24 / coverage` 任务会执行 Windows 专属重写预算与原生 Sharp 路径。

## Alternatives considered

**提高 lane 级的单测试 90 秒时限。**拒绝，因为图片素材可以用更少像素提供相同证据，只有异步重写需要更大的局部时限。

**在 Windows 上跳过任一用例。**拒绝，因为 Sharp 归一化与持久投影重写都需要原生 Windows 证据。

## Consequences

图片行为测试执行的原生工作量更少，投影测试能容忍较慢的 checkpoint，同时不削弱存储数据断言。其他平台保持原有重写时限，生产行为不变。
