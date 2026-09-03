# Agent Note：漫途品牌身份

状态：已实现

[English](2026-09-02-mantur-brand-identity.md) | 中文

## 问题

桌面安装包是面向漫剧生产人员的漫途产品，但共享 Web 组装会显示 DeepSeek Harness 标记、预览版文案、编码 Agent 身份、Agent Preset 选择与 Plan 控件。替换整个 Web 客户端会复制已可用的应用，修改共享默认值则会改变其他所有部署的品牌。已选 Agent Preset 还会遮蔽部署 persona，因此仅修改全局系统提示词配置，无法确立模型实际收到的产品身份。

## 决定

随附的 `mantur` profile 依次叠加 `dsh-base`、`dsh-web-app` 与 `dsh-mantur-app`。桌面载体启动该 profile；普通 `web` profile 保持不变。

`dsh-client-ui-brand-mantur` 占用通用侧边栏与空会话 Hero slot。它显示已确认的对称蓝色无限环 Logo 和文字名称“漫途Agent”，把 Hero 标题替换为“故事起于一念，余下交给漫途”或其英文等价文案，移除预览版徽标，并隐藏官方鱼形标记。收起轨道先显示漫途 Logo，悬停时再显示既有面板导航图形。通用 Conversation shell 为标题与徽标声明 slot，并以既有文案作为 fallback；侧边栏 mark owner 则收到展开态或轨道态位置。

漫途构建会发出产品自有的浏览器安装元数据：文档标题、manifest 名称与 manifest 短名称均为“漫途Agent”；favicon 与 manifest 图标使用已确认的 1024 px 透明 PNG。官方构建和本地开发构建保留既有元数据，并且不把未使用的漫途文件放入输出。

漫途层只禁用官方品牌、预览版公告、Agent Preset 客户端表面和 Plan 客户端表面。它保留这些宿主包与 Agent 组装能力、Models 设置、DeepSeek 凭据引导以及模型和权限控件。该层还省略通用 Harness 与 Web 表面提示词段。其宿主身份项在协作式提示词转换后替换有效的非 complete Preset persona，因此默认 Standard Preset 不会把模型改回通用编码 Agent。最终 persona 明确漫途归属、本地执行，以及从故事到制作交付的漫剧工作。

引导 slot 没有撤回操作，因此后挂载的产品插件无法移除 `ui-settings-models` 已注册的项。这个例外只改动一个上游所属产品文件：`packages/client/ui-settings-models/src/client/index.ts`。它保留 Models 分区与 DeepSeek 凭据引导，只在既有客户端构建 profile 为 `mantur` 时跳过预览版公告。对应的聚焦 apply 测试是该门控的底座升级检查。

Web 公开目录与桌面资源目录保存已确认 PNG 的字节完全相同副本。桌面打包器将该文件用于 macOS 和 Windows 目标，聚焦资产测试则防止任一副本或目标配置独立漂移。当前没有矢量源文件。

## 验证

客户端单元测试覆盖 slot 注册与卸载、本地化文案、Logo 位置、徽标不显示，以及仅在 Mantur 构建中省略预览公告。组合包测试按生产顺序应用 Base、Web 与 Mantur patch，并断言结果配置项与模型 persona。不需密钥的已构建 Web 记录会话场景以中文和英文启动真实组装，拒绝预览公告以及通用标题、鱼形标记、预览版、Agent Preset 与 Plan UI，确认两个漫途 Logo 位置，并保留模型和权限控件。缺少凭据的场景会验证漫途账号选择排在保留的 DeepSeek 凭据步骤之前。同一场景会重放已提交的模型轮次，并固定完整漫途系统提示词。PWA 测试验证漫途 manifest、PNG 签名以及官方 favicon 不存在。

原生安装包验证仍由桌面载体的三运行器矩阵负责：macOS arm64、macOS x64 与 Windows x64。平台图标渲染、签名、notarization 与外部 release 发布仍是本身份层之外的原生运行器前置条件。

## 考虑过的替代方案

**Fork Web 应用。** 拒绝，因为身份、文案与可见性属于组装选择；fork 会复制对话、设置、持久化与传输行为。

**修改共享 Web 默认值。** 拒绝，因为普通 `web` profile 必须保留既有官方身份与控件。

**只覆盖 CSS 或生成的 class 名。** 拒绝，因为哈希 selector 不是 package 约定，也无法移除模型可见身份。

**只修改全局部署 persona。** 拒绝，因为 Agent 作用域的 Preset persona 会在组装前遮蔽它。

**派生字母组合或临时标记。** 拒绝，因为已确认的对称蓝色无限环是 Web 和原生包唯一的产品标记。

## 后果

- 桌面用户会看到单一漫途身份与面向生产的首页承诺，同时保留模型与权限选择。
- 底层 Agent Preset 与 Plan 能力仍供组装和诊断使用，但它们的普通客户端控件不出现在 Mantur profile 中。
- 漫途部署 persona 优先于非 complete Preset persona，Preset 工具与 skill 保持不变。
- 其他 Web 部署保留现有品牌、首页标题、预览版徽标与控件。
- 替换已确认的位图素材时必须同步 Web 与桌面资源副本，桌面运行时与 profile 结构保持不变。
