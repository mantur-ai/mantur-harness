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
| macOS arm64 | `pnpm run desktop:dist:mac:arm64` | `漫途Agent-macOS-arm64.dmg`, `漫途Agent-macOS-arm64.zip` |
| macOS x64 | `pnpm run desktop:dist:mac:x64` | `漫途Agent-macOS-x64.dmg`, `漫途Agent-macOS-x64.zip` |
| Windows x64 | `pnpm run desktop:dist:win:x64` | `漫途Agent-Windows-x64.exe` |

The smoke starts `dsh` from the unpacked application's own dependency directory, exchanges the printed process token for a session cookie, and requires the branded Web page to return HTTP 200. It also requires the packaged updater dependency and GitHub release configuration. It uses an empty temporary Harness home so developer data cannot make the package check pass or fail.

## Runtime design

The main process reuses Electron as the Node executable with `ELECTRON_RUN_AS_NODE=1` and launches the built `@deepseek-ai/dsh` entry with `--profile web --host 127.0.0.1 --port 0 --no-open`. The readiness parser accepts only a tokenized `127.0.0.1` URL. The renderer keeps Node integration disabled, enables context isolation and sandboxing, and sends navigation outside the local origin to the operating-system browser.

The installer carries the existing runtime dependency closure and built Web frontend. `asar` remains disabled because Loader profiles, plugin manifests, native modules, and subprocess helpers require ordinary files. Closing the application terminates the child process.

The permanent application identifier is `ai.mantur.agent`. Before Electron becomes ready, the carrier sets a stable `mantur-agent` user-data directory below the operating system's application-data root. Its `harness` child directory is the only `DSH_HOME` used by the installed application, so ambient CLI or development data under `~/.dsh` cannot affect desktop startup. The child starts in an application-owned neutral directory and appends stdout, stderr, recovery, and updater diagnostics to `logs/harness.log` below the same user-data root.

If startup identifies only a stale `session_projcache` schema, the localized native dialog can remove that disposable projection cache and retry after the user explicitly approves the action. It never deletes session logs, settings, credentials, profiles, or workspaces. Other startup failures offer the log and quit instead of guessing a repair.

Packaged applications check the `mantur-ai/mantur-harness` GitHub Releases feed after startup and every six hours. A new version is downloaded only after the user confirms, and a downloaded version is installed only after a second confirmation to stop Harness and restart. macOS release updates require a signed and notarized application plus the generated ZIP and update metadata; the DMG remains the human installation artifact. Windows releases likewise require code signing and the generated NSIS update assets.

## Known limitations

- These are unsigned internal installers. macOS Gatekeeper and Windows SmartScreen can warn, and automatic installation is not a supported release path until signing and macOS notarization identities are supplied.
- The default Electron icon is temporary. The application identifier and data directory are stable.
- The package contains the updater, but the manual workflow uploads private build artifacts only and never creates a GitHub release. A separate signed release process must publish the installer, update archive, blockmap, and generated update metadata together.
- Each target is valid only after its native runner completes both packaging and the smoke. A build on one architecture is not evidence for another target.
