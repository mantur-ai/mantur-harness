# Mantur Agent desktop

English | [中文](README.zh.md)

The desktop application is 漫途Agent, built by Mantur to create and produce comic dramas locally. Electron owns the native window and one child process; the child starts the shipped `dsh --profile mantur` application on a random loopback port. Both native package targets use the approved blue infinity-loop logo, and the desktop package does not implement another agent runtime.

## Develop without packaging

After `pnpm install`, build the repository artifacts once on a clean checkout:

```sh
pnpm run build:mantur
```

Use one command for ordinary desktop work after that initial build:

```sh
pnpm run desktop:dev
```

The command watches desktop TypeScript, resources, and build configuration. Each change runs an incremental desktop TypeScript build, bundles the Electron main process, stops the previous Electron and dsh processes, and starts the development application again. dsh stdout and stderr remain in the persistent Harness log and also appear directly in the terminal.

Development uses the `mantur-agent-dev` user-data directory, while installed builds use `mantur-agent`; settings, sessions, credentials, and caches cannot cross between those modes. Electron's `app.isPackaged` check also keeps automatic update checks disabled in development. Run `pnpm run build:mantur` again when a change outside `apps/desktop` affects built Harness or Web artifacts.

`desktop:dev` does not create a DMG, ZIP, or NSIS installer, sign or notarize an application, install anything into the operating system's application directory, or check for releases. Use native packaging only to validate installation, signing, notarization, release updates, or a release candidate.

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

The main process reuses Electron as the Node executable with `ELECTRON_RUN_AS_NODE=1` and launches the built `@deepseek-ai/dsh` entry with `--profile mantur --host 127.0.0.1 --port 0 --no-open`. The readiness parser accepts only a tokenized `127.0.0.1` URL. The renderer keeps Node integration disabled, enables context isolation and sandboxing, and sends navigation outside the local origin to the operating-system browser.

The installer carries the existing runtime dependency closure and built Web frontend. `asar` remains disabled because Loader profiles, plugin manifests, native modules, and subprocess helpers require ordinary files. Closing or restarting the application waits for the child process to terminate before Electron exits.

The permanent application identifier is `ai.mantur.agent`. Before Electron becomes ready, the carrier sets a stable `mantur-agent` user-data directory below the operating system's application-data root. Its `harness` child directory is the only `DSH_HOME` used by the installed application, so ambient CLI or development data under `~/.dsh` cannot affect desktop startup. The child starts in an application-owned neutral directory and appends stdout, stderr, recovery, and updater diagnostics to `logs/harness.log` below the same user-data root.

If startup identifies only a stale `session_projcache` schema, the carrier closes the failed child process and its log before the localized native dialog can remove that disposable projection cache and retry after the user explicitly approves the action. It never deletes session logs, settings, credentials, profiles, or workspaces. Other startup failures offer the log and quit instead of guessing a repair.

Packaged applications check the `mantur-ai/mantur-harness` GitHub Releases feed after startup and every six hours. A new version is downloaded only after the user confirms, and a downloaded version is installed only after a second confirmation to stop Harness and restart. Closing the updater while either prompt is pending suppresses the pending download or installation. macOS release updates require a signed and notarized application plus the generated ZIP and update metadata; the DMG remains the human installation artifact. Windows releases likewise require code signing and the generated NSIS update assets.

## Known limitations

- These are unsigned internal installers. macOS Gatekeeper and Windows SmartScreen can warn, and automatic installation is not a supported release path until signing and macOS notarization identities are supplied.
- The approved icon source is a 1024 px transparent PNG. macOS and Windows packages derive their platform icon formats during the native build; a vector source remains unavailable.
- The package contains the updater, but the manual workflow uploads private build artifacts only and never creates a GitHub release. A separate signed release process must publish the installer, update archive, blockmap, and generated update metadata together.
- Each target is valid only after its native runner completes both packaging and the smoke. A build on one architecture is not evidence for another target.
