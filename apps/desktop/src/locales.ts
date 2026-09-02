/** Native desktop copy selected from the operating-system locale. */

const zh = {
  startupFailedTitle: '漫途Agent 启动失败',
  startupFailedMessage: '无法启动本地 Agent 服务。',
} as const

type DesktopCopy = Record<keyof typeof zh, string>

const en = {
  startupFailedTitle: 'Mantur Agent failed to start',
  startupFailedMessage: 'The local agent service could not start.',
} satisfies DesktopCopy

/** Resolve native-window copy for one operating-system locale. */
export function desktopCopy(locale: string): DesktopCopy {
  return locale.toLowerCase().startsWith('zh') ? zh : en
}
