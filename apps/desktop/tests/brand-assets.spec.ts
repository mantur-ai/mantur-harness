import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../..', import.meta.url))

describe('Mantur desktop brand assets', () => {
  it('uses the approved Web logo for both native package targets', async () => {
    const manifest = JSON.parse(await readFile(`${root}/apps/desktop/package.json`, 'utf8')) as {
      build: {
        mac: { artifactName: string; icon: string; identity?: unknown; notarize: boolean }
        win: { artifactName: string; icon: string }
      }
    }
    expect(manifest.build.mac.icon).toBe('resources/mantur-logo.png')
    expect(manifest.build.win.icon).toBe('resources/mantur-logo.png')
    expect(manifest.build.mac.identity).toBeUndefined()
    expect(manifest.build.mac.notarize).toBe(true)
    expect(manifest.build.mac.artifactName).toBe('Mantur-Agent-macOS-${arch}.${ext}')
    expect(manifest.build.win.artifactName).toBe('Mantur-Agent-Windows-${arch}.${ext}')

    const [desktopLogo, webLogo] = await Promise.all([
      readFile(`${root}/apps/desktop/resources/mantur-logo.png`),
      readFile(`${root}/apps/web/public/mantur-logo.png`),
    ])
    expect(desktopLogo).toEqual(webLogo)
    expect(desktopLogo.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(desktopLogo[25]).toBe(2)
  })
})
