# Mantur Agent desktop

English | [中文](README.zh.md)

The desktop application gives internal users a normal macOS or Windows installer for the existing Harness Web interface. Electron owns the native window and one child process; the child starts the shipped `dsh --profile web` application on a random loopback port. The desktop package does not implement another agent runtime.

## Build an internal installer

Install the immutable dependency graph and build every host and client artifact with the Mantur title before invoking the native packager:

```sh
pnpm install --frozen-lockfile
pnpm run build:mantur
pnpm run desktop:dist:mac:arm64
pnpm run desktop:smoke
```

Run the x64 macOS command on an Intel Mac and the Windows command on x64 Windows. The manual `Desktop package` GitHub Actions workflow checks out one commit on three native runners, runs the packaged smoke, and retains these files for seven days:

| Runner | Command | Artifact |
|---|---|---|
| macOS arm64 | `pnpm run desktop:dist:mac:arm64` | `漫途Agent-macOS-arm64.dmg` |
| macOS x64 | `pnpm run desktop:dist:mac:x64` | `漫途Agent-macOS-x64.dmg` |
| Windows x64 | `pnpm run desktop:dist:win:x64` | `漫途Agent-Windows-x64.exe` |

The smoke starts `dsh` from the unpacked application's own dependency directory, exchanges the printed process token for a session cookie, and requires the branded Web page to return HTTP 200. It uses an empty temporary Harness home so developer data cannot make the package check pass or fail.

## Runtime design

The main process reuses Electron as the Node executable with `ELECTRON_RUN_AS_NODE=1` and launches the built `@deepseek-ai/dsh` entry with `--profile web --host 127.0.0.1 --port 0 --no-open`. The readiness parser accepts only a tokenized `127.0.0.1` URL. The renderer keeps Node integration disabled, enables context isolation and sandboxing, and sends navigation outside the local origin to the operating-system browser.

The installer carries the existing runtime dependency closure and built Web frontend. `asar` remains disabled because Loader profiles, plugin manifests, native modules, and subprocess helpers require ordinary files. Closing the application terminates the child process; the normal DSH home continues to own user configuration and sessions.

## Known limitations

- These are unsigned internal installers. macOS Gatekeeper and Windows SmartScreen can warn until release signing and notarization identities are supplied.
- The default Electron icon and builder-derived application identifier are temporary. No formal icon or permanent application ID is defined here.
- The package has no auto-updater or publication step. The workflow uploads private build artifacts only and never creates a release.
- Each target is valid only after its native runner completes both packaging and the smoke. A build on one architecture is not evidence for another target.
