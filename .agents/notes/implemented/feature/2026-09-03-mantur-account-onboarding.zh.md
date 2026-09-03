# Agent Note：漫途账号引导

状态：已实现

[English](2026-09-03-mantur-account-onboarding.md) | 中文

## 问题

漫途Agent 需要在模型配置之前提供可选的 ManturHub 账号登录，但浏览器绝不能收到账号 API Key。共享 Web profile 已经拥有 DeepSeek 凭据引导和设置外壳，credentials 与 authorization 包也已经拥有机密持久化和交互式授权生命周期。

## 决策

漫途 profile 添加 `dsh-authorization`、`dsh-authorization-manturhub` 和 `dsh-client-ui-mantur-account`。Host 提供方注册一个设备码授权 flow，使用 ManturHub CLI 会话与轮询协议，验证登录页面仍位于所配置的 origin，只保留账号邮箱，并把 API Key 提交为提供方拥有的 `CredentialRecord`。会话缺少时间字段时使用 CLI 默认值；`slow_down` 增加当前间隔，拒绝与过期则让尝试失败。其生成的 Remote 只暴露账号状态、设备登录说明、进程内进度、取消和本机退出登录。

客户端在自己的插件中挂载生成的漫途账号 Remote 贡献，并提供顺序为 `-100` 的引导项。用户可以启动设备 flow 并在系统浏览器中打开验证地址，也可以暂时跳过。完成后，引导权交给顺序为 `0` 的现有 DeepSeek 凭据步骤。`ui-settings-models` 中的漫途构建条件只隐藏官方预览公告，不再隐藏 DeepSeek 配置。独立的设置分区复用同一个 root-scoped 账号控制器，提供状态、登录和退出登录。

本 MVP 不提供算子调用、Skill 安装、上传、付费、token 刷新或服务端撤销。这些功能需要独立的能力接缝与产品决策。

## 验证

本地假 HTTP 服务覆盖会话默认值、增加轮询间隔、拒绝、过期、畸形或超限响应、取消与销毁、账号查询、仅 Host 保存凭据、经过筛选的状态和退出登录，不访问生产环境，也不使用真实密钥。客户端 apply、状态控制器与组件测试覆盖 locale 所有权、注册、顺序、卸载、全部账号状态和用户控件。两个新包的聚焦覆盖率达到仓库逐文件 100% 要求。Bundle 组装测试要求授权提供方和 UI 条目存在，现有 Models apply 测试则要求漫途构建 profile 中保留 DeepSeek 引导且没有预览公告。不需密钥的已构建 Web 漫途记录会话场景会用中文验证真实引导顺序，并用两个随附 locale 验证账号跳过路径。

## 考虑过的替代方案

**把 ManturHub Key 返回给浏览器代码。**拒绝，因为渲染器受到攻击时会暴露可复用的账号机密，还会在 Host 之外重复实现凭据持久化。

**替换共享引导外壳。**拒绝，因为有序 slot 贡献已经能表达先账号、后模型的顺序。

**持久化暂时跳过。**拒绝，因为本 MVP 中的“暂时跳过”是一次会话选择，不是永久拒绝账号功能。

## 结果

- ManturHub API Key 保留在 Host 凭据文件中，生成的 Remote 输出无法携带它。
- 设备登录尝试不会跨 Host 重启；中断后用户需要重新开始。
- “暂时跳过”有意只临时生效，之后的新引导序列可能再次显示。
- 唯一共享产品代码例外仍是 `ui-settings-models` 中的漫途构建条件；其聚焦测试是底座升级检查。
