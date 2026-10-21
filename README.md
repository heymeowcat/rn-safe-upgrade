# RN Safe Upgrade

An upgrade assistant for React Native that stays current on its own, and a
local agent bridge that performs the upgrade inside your project.

Live app: **https://heymeowcat.is-a.dev/rn-safe-upgrade/**

```bash
npx --yes github:heymeowcat/rn-safe-upgrade   # the local agent bridge
```

---

## Why this exists

The official [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
shows the diff between two React Native template versions. That is useful, but:

- its "useful content" is **written by hand for 14 versions** and was last
  updated for 0.77 - the interesting part goes stale;
- it does not look at **your** dependencies;
- it cannot **do** anything, you still copy every file by hand.

RN Safe Upgrade fixes all three:

| | Upgrade Helper | RN Safe Upgrade |
| --- | --- | --- |
| Version context | none | release date, official announcement, required React and Node versions |
| Breaking changes | hand written, 14 versions | extracted from the published release notes of **every** version |
| Your dependencies | not checked | resolved against the npm registry and the target release |
| Applying the upgrade | manual | a local agent bridge that edits your project |

## Features

- **Auto-generated upgrade brief** - the release headline, the required React
  version, the Node range, the breaking changes, the deprecations and the
  removals of the target release, all read from the sources React Native
  publishes.
- **Dependency compatibility** - every dependency in your `package.json` is
  checked against the peer dependency ranges that the target React Native
  release requires, including the React version itself.
- **Template diff** - the full diff between the two template versions, with
  per-file review state, patch export and an accurate risk assessment.
- **Local agent bridge** - run one command in your project and the app applies
  the upgrade: it creates a branch, updates `package.json`, syncs the template
  files and can hand the remaining source changes to your agent CLI.
- **Command palette** - `⌘K` / `Ctrl+K` for everything.
- **Shareable URLs** - the version pair, app name and package are part of the
  URL.

## Nothing to maintain by hand

Every piece of content is fetched at runtime from public sources:

| Content | Source |
| --- | --- |
| Version list | [rn-diff-purge `RELEASES`](https://github.com/react-native-community/rn-diff-purge) |
| Release channels | npm `dist-tags` |
| Release dates | GitHub releases API |
| Release notes, breaking changes | GitHub releases API |
| Official announcement and headline | reactnative.dev |
| Required React / Node versions | npm manifest of the release |
| Template diff | rn-diff-purge |
| Dependency compatibility | npm registry peer dependencies |

A snapshot of the catalog is committed to the repository and refreshed by a
scheduled GitHub Action, so the first paint is instant and the app keeps
working offline.

## The agent bridge

```bash
# in your React Native project
npx --yes github:heymeowcat/rn-safe-upgrade
```

The CLI starts a small local server, prints a link, and the web app connects
to it. From there you can:

- apply the dependency updates and sync the template files,
- or let an installed agent CLI (`claude`, `codex`, `gemini`, `opencode`,
  `aider`) do the source code changes, with the upgrade brief as its prompt.

Everything happens on your machine. See [`agent/README.md`](./agent/README.md)
for the details.

## Development

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # static export into ./out
npm run check          # typecheck + lint
npm run refresh-data   # regenerate the committed catalog snapshot
```

The app is a static export (`output: "export"`), deployed to GitHub Pages.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, and a
zero-dependency Node CLI for the bridge.

## Search and discovery

- The app is indexed with a canonical url, an open graph preview, structured
  data and a sitemap: `public/sitemap.xml`, `public/robots.txt`.
- Every exported plan ends with a link to the app, and the version pair is
  part of the url, so a shared plan is a shared link.

## License

MIT
