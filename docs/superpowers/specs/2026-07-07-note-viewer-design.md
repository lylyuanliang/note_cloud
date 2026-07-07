# Note Viewer Design

Date: 2026-07-07

## Goal

Build a visual note preview service for this repository. The service should let the user browse the note repository through a browser, using the real filesystem structure as the source of truth.

The viewer must support both direct Docker access and Nginx reverse proxy access. The repository should be mounted into the container as a read-only volume, so Markdown and text file changes on the host are reflected without rebuilding the image.

## Non-Goals

- Do not replace the existing `readme.md` navigation files.
- Do not require the user to manually maintain a separate navigation manifest.
- Do not write back to the mounted note repository in the first version.
- Do not expose `.git`, `.vscode`, `.github`, or other internal project directories in the main note navigation.
- Do not build a full CMS, editor, authentication system, or multi-user permission system in the first version.

## Existing Repository Context

The repository is a personal Chinese note cloud:

- `README.md` is the top-level GitHub/Gitee entry.
- `笔记/学习记录` contains technical learning notes.
- `笔记/教程` contains operational tutorials.
- Most content is Markdown, with images and a smaller number of text/config files such as YAML, SQL, CONF, JS, HTML, and TXT.
- `笔记/学习记录/docker/1.docker-compose文件样例` contains runnable Docker Compose examples.

The current repository has no `.codegraph/` directory. It is not a traditional buildable application at the root.

## Recommended Architecture

Create a new independent application under `note-viewer/`.

```text
note_cloud/
├─ README.md
├─ .github/
├─ .vscode/
├─ 笔记/
│  ├─ 学习记录/
│  └─ 教程/
└─ note-viewer/
   ├─ README.md
   ├─ package.json
   ├─ Dockerfile
   ├─ docker-compose.yml
   ├─ .dockerignore
   ├─ vite.config.ts
   ├─ tsconfig.json
   ├─ src/
   │  ├─ client/
   │  │  ├─ App.tsx
   │  │  ├─ main.tsx
   │  │  ├─ components/
   │  │  │  ├─ PortalHome.tsx
   │  │  │  ├─ Workspace.tsx
   │  │  │  ├─ DirectoryTree.tsx
   │  │  │  ├─ Breadcrumbs.tsx
   │  │  │  ├─ FilePreview.tsx
   │  │  │  └─ SearchBox.tsx
   │  │  ├─ lib/
   │  │  │  ├─ api.ts
   │  │  │  └─ path.ts
   │  │  └─ styles/
   │  ├─ server/
   │  │  ├─ index.ts
   │  │  ├─ config.ts
   │  │  ├─ routes/
   │  │  │  ├─ tree.ts
   │  │  │  ├─ file.ts
   │  │  │  ├─ asset.ts
   │  │  │  └─ search.ts
   │  │  ├─ services/
   │  │  │  ├─ scanRepository.ts
   │  │  │  ├─ readContent.ts
   │  │  │  ├─ watchRepository.ts
   │  │  │  └─ searchIndex.ts
   │  │  └─ security/
   │  │     └─ safePath.ts
   │  └─ shared/
   │     └─ types.ts
   └─ docs/
      └─ handoff.md
```

The viewer is separate from `笔记/` so note content and viewer code can evolve independently.

## Runtime Model

Use a containerized Node service with a React frontend.

- The host mounts the entire repository into the container as read-only.
- The backend reads files from the mounted repository.
- The frontend calls backend APIs for the tree, file content, assets, search, and file change events.
- Nginx can reverse proxy to the container, but Nginx is not responsible for scanning files.

Example direct container usage:

```yaml
services:
  note-viewer:
    build: .
    ports:
      - "8088:8080"
    volumes:
      - ..:/workspace:ro
    environment:
      - REPO_ROOT=/workspace
      - CONTENT_ROOT=/workspace/笔记
      - PORT=8080
      - PUBLIC_BASE_PATH=/
```

This compose file lives in `note-viewer/`. From that directory, `build: .` builds the viewer and `..:/workspace:ro` mounts the repository root.

Example Nginx reverse proxy:

```nginx
location /notes/ {
    proxy_pass http://note-viewer:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 1h;
}
```

When served under `/notes/`, the container should be configured with `PUBLIC_BASE_PATH=/notes/`. The frontend must build API and asset URLs from that base path, not from hard-coded absolute `/api/...` paths. Relative URLs such as `api/tree` are acceptable when they resolve under the current base path.

## Data Source Rules

The real directory structure is the source of truth.

- Main content root: `CONTENT_ROOT`, defaulting to `/workspace/笔记`.
- Repository root: `REPO_ROOT`, defaulting to `/workspace`.
- The top-level `README.md` can be displayed on the portal, but it is not the primary navigation source.
- Directory nodes are generated from real directories.
- File nodes are generated from supported text files.
- `readme.md`, `README.md`, and `Readme.md` are treated as directory overview files.
- If more than one overview file exists in the same directory, use this priority: `readme.md`, then `README.md`, then `Readme.md`.
- A directory opens its local overview file by default when one exists.
- Image files are available as assets for Markdown rendering, but they are not first-class navigation entries by default.

Default ignored paths are matched by path segment across tree, file, asset, search, and watch operations:

- `.git`
- `.github`
- `.vscode`
- `node_modules`
- `dist`
- `note-viewer`
- `note-viewer/node_modules`
- `note-viewer/dist`

Supported preview file types for the first version:

- Markdown: `.md`
- Text/config/code: `.txt`, `.yml`, `.yaml`, `.json`, `.conf`, `.sql`, `.js`, `.ts`, `.html`, `.css`, `.sh`, `.bat`, `.reg`
- Images as Markdown assets: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

## API Design

All API paths are read-only.

### `GET /api/tree`

Returns the current note tree rooted at `CONTENT_ROOT`.

Response shape:

```ts
type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: TreeNode[];
  overviewPath?: string;
  updatedAt?: string;
  fileKind?: "markdown" | "text" | "image" | "unsupported";
};
```

### `GET /api/portal`

Returns data for the portal home.

Response shape:

```ts
type PortalData = {
  repoReadme?: FileContent;
  entryCards: Array<{
    title: string;
    path: string;
    description?: string;
    kind: "top-level" | "highlight";
  }>;
};
```

`repoReadme` may only read `REPO_ROOT/README.md`. It must not accept an arbitrary client-provided path.

### `GET /api/file?path=<relative-path>`

Returns a supported text file by path relative to `CONTENT_ROOT`.

Path parameters use UTF-8 URL encoding through `URLSearchParams`. The canonical path format in API responses is POSIX-style relative paths using `/`, even when the host is Windows.

Response shape:

```ts
type FileContent = {
  path: string;
  name: string;
  kind: "markdown" | "text";
  language?: string;
  content: string;
  updatedAt?: string;
};
```

### `GET /api/asset?path=<relative-path>`

Returns image assets by path relative to `CONTENT_ROOT`. This endpoint is used by Markdown rendering.

### `GET /api/search?q=<query>`

First version search scope:

- File names
- Directory names
- Markdown first heading
- Directory overview file titles

Full-text search can be added later.

### `GET /api/events`

Uses Server-Sent Events to notify the frontend that the repository changed.

Event examples:

- `tree-changed`
- `file-changed`

The frontend should refresh the tree and, if the current file changed, reload the current preview.

File watching should use a recursive watcher on `CONTENT_ROOT`, debounce bursts of changes, and emit coarse events rather than one event per filesystem notification. The implementation should tolerate Docker Desktop and Windows/macOS/Linux event differences by falling back to periodic rescan if native events are unreliable. SSE clients should reconnect automatically.

## Frontend Design

The first version has two main screens.

### Portal Home

The portal gives a visual entry into the note library.

It should show:

- Top-level entry cards for `学习记录` and `教程`.
- Highlight cards for useful deep paths such as Docker Compose examples, design patterns, Spring, Git, IDE, Windows, and WSL when those paths exist.
- Top-level repository `README.md` content as optional introduction.
- A global search input.

The portal should be useful even when the user does not remember the folder layout.

### Workspace

The workspace is the main browsing view.

It should show:

- Left side: real directory tree.
- Top area: breadcrumbs, search, and a return-to-home action.
- Main area: current directory overview or selected file preview.
- Directory default behavior: open `readme.md` or `Readme.md` when present.
- Markdown preview for `.md`.
- Code-style preview for YAML, SQL, CONF, JS, HTML, TXT, and similar files.

The UI should feel like a practical knowledge base, not a marketing page.

## Markdown Rendering

Markdown rendering should support:

- Headings
- Tables
- Lists
- Fenced code blocks
- Inline code
- Relative image links
- Relative Markdown links

Relative Markdown links should route inside the viewer when they point to files under `CONTENT_ROOT`.

Relative image links should be rewritten through the configured base path, for example `api/asset?path=...` or `${PUBLIC_BASE_PATH}api/asset?path=...`.

## Security Boundaries

The service must treat all file paths from the browser as untrusted.

Required protections:

- Decode URL input before validation.
- Normalize and resolve requested paths.
- Reject absolute paths from client input.
- Reject NUL characters.
- Reject Windows backslash path separators in client path input; clients should use POSIX `/`.
- Reject paths that escape `CONTENT_ROOT`.
- Use realpath checks to prevent symlink escapes.
- Do not expose ignored directories.
- Apply the same path safety checks to tree, file, asset, search, Markdown link handling, and watch logic.
- Disable or sanitize raw HTML in Markdown rendering.
- Treat SVG as potentially unsafe; either serve it with restrictive headers or exclude SVG from image previews in the first implementation.
- Run the Docker mount as read-only.
- Do not implement write APIs in the first version.

The service is intended for local or trusted network use. If it is exposed outside a trusted network, authentication and stricter access controls must be added first.

## Development and Deployment Commands

Expected local development commands:

```bash
cd note-viewer
npm install
npm run dev
```

Expected container usage:

```bash
cd note-viewer
docker compose up --build
```

Expected access URL:

```text
http://localhost:8088
```

Expected production-like build verification:

```bash
cd note-viewer
npm run build
npm run typecheck
```

## Testing and Verification

Minimum verification for the first implementation:

- TypeScript typecheck passes.
- Production build passes.
- Docker image builds.
- Docker compose starts the viewer.
- Browser can open the portal home.
- Browser can open `学习记录` and `教程`.
- Browser can preview a Markdown file.
- Browser can preview a YAML or CONF file.
- Browser can render a Markdown image through the asset endpoint.
- Editing a mounted Markdown file causes the viewer to refresh after file change notification.

## Handoff Notes

Future agents should start by reading:

1. This design document.
2. `note-viewer/README.md` after implementation starts.
3. `note-viewer/docs/handoff.md` after implementation starts.

Implementation should keep write scopes isolated:

- Backend filesystem/API work under `note-viewer/src/server`.
- Frontend UI work under `note-viewer/src/client`.
- Shared types under `note-viewer/src/shared`.
- Docker and runtime docs under `note-viewer/`.

Subagents can safely work in parallel when their write scopes are disjoint.
