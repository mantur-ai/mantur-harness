# Agent Note：漫途品牌身份

状态：已实现

[English](2026-09-02-mantur-brand-identity.md) | 中文

## 问题

桌面安装包是面向漫剧生产人员的漫途产品，但共享 Web 组装会显示 DeepSeek Harness 标记、预览版文案、编码 Agent 身份、Agent Preset 选择与 Plan 控件。替换整个 Web 客户端会复制已可用的应用，修改共享默认值则会改变其他所有部署的品牌。已选 Agent Preset 还会遮蔽部署 persona，因此仅修改全局系统提示词配置，无法确立模型实际收到的产品身份。

## 决定

随附的 `mantur` profile 依次叠加 `dsh-base`、`dsh-web-app` 与 `dsh-mantur-app`。桌面载体启动该 profile；普通 `web` profile 保持不变。

`dsh-client-ui-brand-mantur` 占用通用侧边栏与空会话 Hero slot。它在侧边栏显示已确认的文字名称“漫途Agent”，让 Hero 前缀保持为空，把 Hero 标题替换为“故事起于一念，余下交给漫途”或其英文等价文案，移除预览版徽标，并隐藏官方鱼形标记。收起轨道保留既有面板导航图形，它是操作指示而非品牌标记。通用 Conversation shell 现在为标题与徽标声明 slot，并以既有文案作为 fallback；侧边栏 mark owner 则收到展开态或轨道态位置。

漫途层只禁用官方品牌、Agent Preset 客户端表面和 Plan 客户端表面。它保留这些宿主包与 Agent 组装能力，也保留模型和权限控件。该层还省略通用 Harness 与 Web 表面提示词段。其宿主身份项在协作式提示词转换后替换有效的非 complete Preset persona，因此默认 Standard Preset 不会把模型改回通用编码 Agent。最终 persona 明确漫途归属、本地执行，以及从故事到制作交付的漫剧工作。

本次不引入 Logo 或原生应用图标。在漫途提供已审批素材前，文字是唯一产品身份，桌面构建保留打包占位图标。

## 验证

客户端单元测试覆盖 slot 注册与卸载、本地化文案、展开态标记与徽标不显示，以及轨道操作指示保留。组合包测试按生产顺序应用 Base、Web 与 Mantur patch，并断言结果配置项与模型 persona。不需密钥的已构建 Web Playwright 场景启动真实组装，验证中文品牌与标题，拒绝通用标题、鱼形标记、预览版、Agent Preset 与 Plan UI，在连接 Workspace 后确认模型与权限控件，并通过默认 Preset 组装 Agent 提示词。

原生安装包验证仍由桌面载体的三运行器矩阵负责：macOS arm64、macOS x64 与 Windows x64。正式视觉素材、签名、notarization 与外部 release 发布仍是本身份层之外的前置条件。

## 考虑过的替代方案

**Fork Web 应用。** 拒绝，因为身份、文案与可见性属于组装选择；fork 会复制对话、设置、持久化与传输行为。

**修改共享 Web 默认值。** 拒绝，因为普通 `web` profile 必须保留既有官方身份与控件。

**只覆盖 CSS 或生成的 class 名。** 拒绝，因为哈希 selector 不是 package 约定，也无法移除模型可见身份。

**只修改全局部署 persona。** 拒绝，因为 Agent 作用域的 Preset persona 会在组装前遮蔽它。

**创造临时漫途 Logo。** 拒绝，因为当前没有已审批视觉标记；任意的字母组合会变成无支持的产品素材。

## 后果

- 桌面用户会看到单一漫途身份与面向生产的首页承诺，同时保留模型与权限选择。
- 底层 Agent Preset 与 Plan 能力仍供组装和诊断使用，但它们的普通客户端控件不出现在 Mantur profile 中。
- 漫途部署 persona 优先于非 complete Preset persona，Preset 工具与 skill 保持不变。
- 其他 Web 部署保留现有品牌、首页标题、预览版徽标与控件。
- 已审批 Logo 与原生图标素材可以稍后替换纯文字占位者，无需改变桌面运行时或 profile 结构。
