---
description: "由 Host 持有的 ManturHub 技能与配方目录投影，以及安全本地技能安装器。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-manturhub-marketplace`

[English](README.md) | 中文

## 概述

这个 Host 插件提供浏览器安全的 ManturHub 技能与配方目录和详情 Remote，并负责技能安装。公开元数据通过校验后才投影到浏览器。配方媒体与非空来源路径基于已配置 Hub 的响应来源解析；空来源字段不会进入浏览器结果。安装时 API Key 只进入带认证的第一跳；批准的重定向下载不携带凭据；压缩包限制与根元数据通过校验后，技能目录及安装状态才会原子提交。

## 目录

- [使用本包](#use-this-package)
- [了解安装安全](#understand-installation-safety)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

通过 [`dsh-mantur-app`](../../bundle/mantur-app/README.zh.md) 组合本包。它依赖 `manturAccount`，读取公开技能与配方目录和详情接口，并把技能安装到 `<DSH_HOME>/skills/<slug>`。配方列表固定使用 Hub 支持的每页 15 条，并接受页码、分类、标签与文本筛选。配置分别限制元数据字节数、压缩字节数、压缩包条目数、解压字节数以及两个请求阶段的超时。默认值与 ManturHub 官方 CLI 策略一致。

目录接口接受线上使用的 `{ skills }` 封装和 CLI 兼容的原始数组；详情接受直接 Skill 或 `{ skill }`。`kind: suite` 条目会被排除，缺少 `kind` 时按 `skill` 处理。

-----

<a id="understand-installation-safety"></a>
## 了解安装安全

第一跳下载通过 `manturAccount` 发起认证请求，并手动处理重定向。重定向必须包含 `Location`；第二跳只允许 HTTPS，集成测试可使用回环 HTTP，而且永远不接收认证头。安装器以流式方式写入私有临时文件，并在解压前拒绝超过压缩大小上限的响应。

ZIP 读取器会在写入每个条目前先校验中央目录元数据。它会拒绝不安全或无法精确表示的大小、绝对路径、目录穿越、控制字符、Windows 保留名称与字符、末尾点号或空格、忽略大小写后重复的路径、链接、特殊节点、过多条目和过大的声明解压体积。普通文件会直接流式解压到私有暂存文件，同时按实际累计写入字节执行上限。解压后的第二次文件系统遍历会再次检查链接、特殊节点与实际体积。根 `SKILL.md` 必须声明请求的 slug 与目录版本。

安装状态存放在可发现 Skill 根目录之外，记录内容与压缩包的 SHA-256。只有目标目录受安装器跟踪且当前内容哈希仍匹配时才允许更新；未跟踪或被本地修改的目标会明确失败。目录和状态替换使用同一文件系统上的重命名。替换前，旧目录会移入 `skillsRoot` 同级的唯一恢复目录，绝不会放进可发现的 Skill 目录树。状态写入失败时会恢复旧目录；如果回滚本身失败，错误会报告保留下来的准确恢复路径，便于手动还原。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [authorization-manturhub](../../credentials/authorization-manturhub/README.zh.md) — 持有 API 地址、凭据与设备登录。
- [ui-mantur-navigation](../../client/ui-mantur-navigation/README.zh.md) — 展示目录与安装状态。
- [skill-filesystem](../skill-filesystem/README.zh.md) — 监听实时本地 Skill 目录。

-----

<a id="model-experience"></a>
## 模型体验

间接影响：安装完成的 Skill 会通过现有文件系统 provider 被发现，并进入后续目录工具输出。

#### KV Cache 影响

安装提交新的 Skill 目录之前保持稳定；提交后，后续目录工具输出可以包含这个 Skill。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 不提供强制覆盖、卸载或本地冲突合并操作。
- Skill 包必须使用 ZIP；解压在进程内完成，不依赖平台归档命令。
- 配方交接、算子执行、报价确认和支付不属于这个 Host 包；它会把已发布的 `agent_payload` 原样返回给浏览器消费者。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

Host 测试使用真实回环 HTTP 服务与临时 `DSH_HOME`。元数据缓冲使用 [`authorization-manturhub`](../../credentials/authorization-manturhub/README.zh.md) 持有的有界 JSON 读取函数。这些测试验证线上响应封装、凭据隔离、压缩包策略、本地冲突拒绝、失败回滚与实时文件系统 watcher 刷新。

</details>

**运行时不变量：** 不发布 companion。API 校验、压缩包检查、解压后检查、元数据校验、内容哈希与原子回滚会分别拒绝每种可独立观察到的无效安装状态。
