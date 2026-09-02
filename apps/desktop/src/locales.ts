/** Native desktop copy selected from the operating-system locale. */

const zh = {
  startupFailedTitle: '漫途Agent 启动失败',
  startupFailedMessage: '无法启动本地 Agent 服务。',
  resetCacheButton: '重置缓存并重试',
  showLogButton: '查看日志',
  quitButton: '退出',
  updateAvailableTitle: '发现新版本',
  updateAvailableMessage: (version: string) => `漫途Agent ${version} 已发布，是否下载？`,
  downloadButton: '下载',
  laterButton: '稍后',
  updateReadyTitle: '更新已下载',
  updateReadyMessage: (version: string) => `漫途Agent ${version} 已准备好，是否立即重启安装？`,
  restartButton: '重启安装',
} as const

type DesktopCopy = {
  [Key in keyof typeof zh]: typeof zh[Key] extends (...args: infer Args) => string
    ? (...args: Args) => string
    : string
}

const en = {
  startupFailedTitle: 'Mantur Agent failed to start',
  startupFailedMessage: 'The local agent service could not start.',
  resetCacheButton: 'Reset cache and retry',
  showLogButton: 'Show log',
  quitButton: 'Quit',
  updateAvailableTitle: 'Update available',
  updateAvailableMessage: (version: string) => `Mantur Agent ${version} is available. Download it now?`,
  downloadButton: 'Download',
  laterButton: 'Later',
  updateReadyTitle: 'Update downloaded',
  updateReadyMessage: (version: string) => `Mantur Agent ${version} is ready. Restart and install it now?`,
  restartButton: 'Restart and install',
} satisfies DesktopCopy

/** Resolve native-window copy for one operating-system locale. */
export function desktopCopy(locale: string): DesktopCopy {
  return locale.toLowerCase().startsWith('zh') ? zh : en
}
