# 漫途Agent 桌面端

[English](README.md) | 中文

桌面应用让内部用户通过普通 macOS 或 Windows 安装包使用既有 Harness Web 界面。Electron 只负责原生窗口和一个子进程；子进程在随机 loopback 端口启动随附的 `dsh --profile web` 应用。桌面包不会实现另一套 agent 运行时。

## 构建内部安装包

调用原生打包器之前，先安装不可变依赖图，再使用漫途标题构建全部 host 与 client 产物：

```sh
pnpm install --frozen-lockfile
pnpm run build:mantur
pnpm run desktop:dist:mac:arm64
pnpm run desktop:smoke
```

macOS x64 命令必须在 Intel Mac 上运行，Windows 命令必须在 x64 Windows 上运行。手动触发的 `Desktop package` GitHub Actions 工作流会在三个原生 runner 上检出同一个 commit、运行打包 smoke，并将以下文件保留七天：

| Runner | 命令 | 产物 |
|---|---|---|
| macOS arm64 | `pnpm run desktop:dist:mac:arm64` | `漫途Agent-macOS-arm64.dmg` |
| macOS x64 | `pnpm run desktop:dist:mac:x64` | `漫途Agent-macOS-x64.dmg` |
| Windows x64 | `pnpm run desktop:dist:win:x64` | `漫途Agent-Windows-x64.exe` |

smoke 会从解包应用自己的依赖目录启动 `dsh`，把打印出的进程 token 换成会话 cookie，并要求带品牌标题的 Web 页面返回 HTTP 200。它使用空的临时 Harness home，避免开发者数据影响包检查结果。

## 运行时设计

主进程通过 `ELECTRON_RUN_AS_NODE=1` 复用 Electron 作为 Node 可执行文件，并以 `--profile web --host 127.0.0.1 --port 0 --no-open` 启动已构建的 `@deepseek-ai/dsh` 入口。就绪解析器只接受带 token 的 `127.0.0.1` URL。renderer 禁用 Node integration、启用 context isolation 与 sandbox，并把离开本地 origin 的导航交给操作系统浏览器。

安装包携带既有运行时依赖闭包和已构建 Web 前端。Loader profile、插件 manifest、原生模块与 subprocess helper 都需要普通文件，因此 `asar` 保持禁用。关闭应用会终止子进程；用户配置与会话仍由正常的 DSH home 持有。

## 已知限制

- 这些是未签名的内部安装包。在提供发布签名与 notarization 身份之前，macOS Gatekeeper 和 Windows SmartScreen 可能显示警告。
- 默认 Electron 图标和 builder 派生的应用标识都是临时值。这里不定义正式图标或永久应用 ID。
- 包中没有自动更新器或发布步骤。工作流只上传私有构建产物，绝不创建 release。
- 每个目标只在其原生 runner 同时完成打包和 smoke 后有效。一个架构上的构建不能作为另一目标的证据。
