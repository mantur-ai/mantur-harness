# Agent Note: Share bounded ManturHub JSON reading

Status: implemented

[English](2026-09-03-share-manturhub-json-reader.md) | 中文

## Problem

ManturHub 授权 provider 与 marketplace Host 都会在字节上限内读取不可信 JSON 响应流。两套读取函数重复实现了累积、取消、拼接、解码与解析逻辑。即使 authorization package 已持有公共的 ManturHub 请求 origin 与凭据策略，响应缓冲或取消逻辑的修复仍可能只进入其中一个 ManturHub consumer。

## Decision

`@deepseek-ai/dsh-authorization-manturhub` 导出 `readManturHubJson`，作为共享的有界响应读取函数。授权 flow 传入固定的 64 KiB 上限和 `response` 诊断主题；marketplace 传入已配置的元数据上限和 `metadata` 诊断主题。每个 consumer 继续持有 HTTP 状态处理与 schema 校验，因为这些规则随接口而异。

## Alternatives considered

- **保留两个本地读取函数，并从重复检查中排除。** 拒绝，因为两份代码实现相同且涉及安全的字节上限与取消行为；忽略检查会保留两者发生偏差的风险。
- **把所有 ManturHub 请求移入 marketplace package。** 拒绝，因为 API origin 与凭据附加属于 authorization provider，目录投影与 Skill 安装属于 marketplace。
- **增加一个完成请求和解析的 service method。** 拒绝，因为各接口刻意采用不同的 HTTP 状态判断顺序与 schema；宽泛方法要么用 options 重复这些策略，要么让策略脱离各自 owner。

## Consequences

ManturHub Host consumer 共享一套有界 JSON 响应流读取实现，同时保留各自已有的上限、诊断、HTTP 状态判断顺序与 schema 校验。Authorization package 增加一个小型公共工具导出，其聚焦测试固定解析、超限诊断与无响应体拒绝行为。
