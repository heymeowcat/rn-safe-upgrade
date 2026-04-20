# RN Safe Upgrade - local agent bridge

A tiny HTTP server that runs **inside your React Native project** and lets the
web app perform the upgrade for you.

Nothing is uploaded anywhere. The bridge only listens on `127.0.0.1`, requires
a session token, and only accepts requests from the app itself.

```
┌──────────────┐   HTTP / SSE    ┌──────────────────┐   files   ┌──────────────┐
│  Web app     │ ───────────────▶ │  bridge (this)   │ ────────▶ │ your project │
│  (browser)   │ ◀─────────────── │  127.0.0.1:4317  │           │              │
└──────────────┘   live log      └──────────────────┘           └──────────────┘
                                           │
                                           └──▶ claude / codex / gemini / opencode / aider
```

## Usage

```bash
# from the root of your React Native project
npx --yes github:heymeowcat/rn-safe-upgrade
```

The CLI prints a link. Open it and the web app connects to the bridge
automatically.

### Options

| Flag | Description |
| --- | --- |
| `--port <number>` | Port to listen on (default `4317`) |
| `--token <string>` | Use a fixed session token instead of a random one |
| `--agent <id>` | Force an agent: `claude`, `codex`, `gemini`, `opencode`, `aider` |
| `--install` | Run `npm install` after the plan is applied |
| `--pods` | Run `pod install` after the plan is applied |
| `--verbose` | Print every log line to the terminal |
| `--help` | Show the help |

Environment variable `RN_SAFE_UPGRADE_WEB_APP` overrides the web app URL that
the CLI links to (useful when you run the app locally).

## What it does when a plan arrives

1. **Creates a git branch** - `chore/rn-upgrade-<from>-to-<to>`. Your current
   branch and your uncommitted work are left alone.
2. **Writes the updated `package.json`** - the dependency versions from the
   plan, plus the tooling packages the new template needs.
3. **Syncs the template files** - the official React Native template for the
   target version is copied over the matching files in your project, with your
   app name and Android package id substituted.
4. **Optionally hands the source code to an agent** - the plan (dependencies,
   breaking changes, files) is turned into a prompt and piped to the agent CLI
   that is installed on your machine.
5. **Reports the result** - the git diff stat is streamed back to the browser.

## Security

- The server binds to `127.0.0.1` only.
- Every request needs the session token (printed on startup).
- The `Origin` header has to match the web app, so a random website in your
  browser cannot talk to the bridge.
- Paths are resolved and checked before anything is written; the bridge never
  writes outside the project directory.

## Requirements

Node.js 18 or newer. No dependencies - the bridge only uses the Node standard
library.
