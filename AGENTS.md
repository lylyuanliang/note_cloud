# Agent Project Overview

This repository is a personal cloud notes workspace plus a small web viewer for browsing the notes.

## Purpose

- Store long-lived Markdown notes under `笔记/`.
- Keep operation tutorials, tool setup guides, troubleshooting notes, and learning records in a navigable folder tree.
- Serve the notes through `note-viewer/`, a React + Express app that reads the real filesystem and previews Markdown in a browser.

## Top-Level Layout

- `README.md`: human-facing repository index. Update it when adding a major note category or important entry point.
- `笔记/`: primary knowledge content. This is the main data source for the viewer.
- `笔记/教程/`: procedural tutorials such as environment setup, IDE usage, Windows, WSL, GitHub, Docker, browser tools, and AI agent tools.
- `笔记/学习记录/`: study notes for backend technologies, Docker, Git, Spring, design patterns, databases, and similar topics.
- `note-viewer/`: TypeScript web app for browsing and searching `笔记/`.
- `docs/superpowers/`: historical specs and implementation plans for the viewer and related design work.

## Documentation Conventions

- Most content is Markdown.
- Category landing pages are usually named `readme.md` or `Readme.md`.
- Topic pages are often numbered, for example `1.xxx.md`, to preserve reading order.
- Images for a note usually live beside the note under an `image/` or `img/` subdirectory.
- Prefer relative Markdown links so the notes work both in Git hosting and in `note-viewer`.
- When adding a new topic under `笔记/教程/` or `笔记/学习记录/`, update the nearest category `readme.md`; update root `README.md` only for important top-level navigation.

## Note Viewer Summary

`note-viewer/` is a private TypeScript project using:

- React 18 and Vite for the client.
- Express for the server.
- Vitest and Testing Library for tests.
- `tsx` for local server development and `tsup` for the production server bundle.

The viewer reads the content root from configuration. In Docker, `docker-compose.yml` mounts the repository root as read-only at `/workspace` and points the app at `/workspace/笔记`.

Important runtime behavior:

- The server keeps an in-memory directory tree and search index.
- Search indexes file names, directory names, Markdown H1 headings, and directory README H1 headings; it is not full-text search.
- File watching refreshes the store and broadcasts updates through SSE.
- Browser-provided paths must go through `safePath`.
- The app must support `PUBLIC_BASE_PATH`, especially when deployed behind a `/notes/` reverse proxy.

Useful viewer files:

- `note-viewer/README.md`: runbook and feature summary.
- `note-viewer/docs/handoff.md`: detailed handoff notes.
- `note-viewer/src/server/app.ts`: Express routes and static serving.
- `note-viewer/src/server/services/repositoryStore.ts`: cached tree/search store.
- `note-viewer/src/server/services/searchIndex.ts`: search index construction.
- `note-viewer/src/server/services/watchRepository.ts`: filesystem watcher and refresh flow.
- `note-viewer/src/server/security/safePath.ts`: path boundary enforcement.
- `note-viewer/src/client/App.tsx`: top-level client state, routing, SSE refresh, theme handling.
- `note-viewer/src/client/components/Workspace.tsx`: main reader workspace.

## Common Commands

Run from `note-viewer/`:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
docker compose up --build
```

Docker normally exposes the app at:

```text
http://localhost:8088
```

If Docker Hub or network access fails while pulling `node:20-alpine`, record the exact error instead of claiming Docker verification passed.

## Editing Guidance For Agents

- There is no `.codegraph/` index in this repository at the time this overview was written. Use normal file inspection unless an index is later added.
- Do not reorganize the notes tree unless the user asks; many links depend on current paths.
- Avoid touching binary assets and archived installers unless the task is explicitly about them.
- Keep documentation changes close to the relevant category index.
- For code changes in `note-viewer/`, run at least `npm run typecheck` and relevant tests; run `npm run build` when touching build, routing, or app startup.
- Treat the repository as potentially containing user-authored notes. Do not rewrite unrelated prose while making a targeted change.
