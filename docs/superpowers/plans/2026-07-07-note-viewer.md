# 笔记可视化预览服务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Docker 化的笔记可视化预览服务，通过真实目录结构浏览 `笔记/`，支持 Markdown/文本预览、图片资源、搜索、文件变化刷新和 Nginx 子路径代理。

**Architecture:** 在 `note-viewer/` 下新增独立 Node + React 应用。生产模式由 Express 提供 API 和前端静态资源，宿主仓库根目录通过 Docker 只读挂载到 `/workspace`，主内容从 `/workspace/笔记` 扫描。前端通过只读 API 获取目录树、门户数据、文件内容、图片资源、搜索结果和 SSE 变更事件。

**Tech Stack:** Node 20、TypeScript、Express、Vite、React、react-markdown、remark-gfm、chokidar、Vitest、tsup、Docker、Nginx。

## Global Constraints

- 面向用户阅读的文档必须使用中文；代码标识符、命令、API 路径和技术名词可以保留英文。
- 主内容根目录由 `CONTENT_ROOT` 配置，默认 `/workspace/笔记`；仓库根目录由 `REPO_ROOT` 配置，默认 `/workspace`。
- Docker 运行时必须将仓库根目录只读挂载到容器。
- 主导航以真实目录结构为准，不以 `readme.md` 链接为准。
- `readme.md`、`README.md`、`Readme.md` 都是目录说明文件，优先级依次为 `readme.md`、`README.md`、`Readme.md`。
- 所有 API 都是只读 API，第一版不实现写入能力。
- 浏览器传入的路径必须先 decode、规范化、realpath 校验，并禁止逃逸出 `CONTENT_ROOT`。
- 客户端和 API 返回路径统一使用 POSIX `/` 分隔。
- 前端 API 和资源 URL 必须支持 `PUBLIC_BASE_PATH`，不能硬编码绝对 `/api/...`。
- `PUBLIC_BASE_PATH` 必须运行期生效；前端通过 `/runtime-config.js` 读取 `window.__NOTE_VIEWER_CONFIG__`，Vite 静态资源使用相对 base，避免 Docker 镜像因为 Nginx 子路径变化而必须重建。
- Markdown 原始 HTML 必须禁用或清洗；SVG 视为潜在不安全资源，第一版不作为图片预览资源提供。
- 支持直接访问 `http://localhost:8088`，也支持通过 Nginx `/notes/` 子路径反向代理。

---

## File Structure

新增和修改文件按以下职责划分：

- `note-viewer/package.json`：脚本、运行依赖和开发依赖。
- `note-viewer/tsconfig.json`、`note-viewer/vite.config.ts`、`note-viewer/vitest.config.ts`：TypeScript、Vite、测试配置。
- `note-viewer/index.html`：前端入口 HTML。
- `note-viewer/src/shared/types.ts`：前后端共享类型。
- `note-viewer/src/server/config.ts`：环境变量读取和运行配置。
- `note-viewer/src/server/security/safePath.ts`：路径安全校验。
- `note-viewer/src/server/services/readContent.ts`：文本文件、README、图片 MIME 类型读取。
- `note-viewer/src/server/services/scanRepository.ts`：目录树扫描、目录说明文件识别、门户入口生成。
- `note-viewer/src/server/services/searchIndex.ts`：轻量搜索索引。
- `note-viewer/src/server/services/watchRepository.ts`：文件监听和 SSE 事件广播。
- `note-viewer/src/server/routes/*.ts`：API 路由。
- `note-viewer/src/server/index.ts`：Express 应用入口。
- `note-viewer/src/client/*`：React 前端应用、门户、工作台、目录树、文件预览、搜索。
- `note-viewer/Dockerfile`、`note-viewer/docker-compose.yml`、`note-viewer/.dockerignore`：容器构建和运行。
- `note-viewer/README.md`、`note-viewer/docs/handoff.md`：中文运行说明和交接说明。

## Task 1: 初始化 note-viewer 工程骨架

**Files:**
- Create: `note-viewer/package.json`
- Create: `note-viewer/tsconfig.json`
- Create: `note-viewer/tsconfig.node.json`
- Create: `note-viewer/vite.config.ts`
- Create: `note-viewer/vitest.config.ts`
- Create: `note-viewer/index.html`
- Create: `note-viewer/src/shared/types.ts`
- Create: `note-viewer/src/client/main.tsx`
- Create: `note-viewer/src/client/App.tsx`
- Create: `note-viewer/src/client/styles/base.css`
- Create: `note-viewer/src/server/index.ts`

**Interfaces:**
- Produces: `TreeNode`、`FileContent`、`PortalData`、`SearchResult`、`ViewerConfig` 类型。
- Produces: `npm run dev`、`npm run build`、`npm run typecheck`、`npm test` 脚本。

- [ ] **Step 1: 创建 package.json**

Create `note-viewer/package.json`:

```json
{
  "name": "note-viewer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite --host 0.0.0.0",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsup src/server/index.ts --format esm --platform node --target node20 --out-dir dist/server --clean",
    "start": "node dist/server/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "chokidar": "^4.0.3",
    "express": "^4.21.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.3",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "concurrently": "^9.1.0",
    "tsx": "^4.19.2",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 创建 TypeScript 配置**

Create `note-viewer/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: 创建 Node 构建类型配置**

Create `note-viewer/tsconfig.node.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist-types"
  },
  "include": ["src/server/**/*.ts", "src/shared/**/*.ts"]
}
```

- [ ] **Step 4: 创建 Vite 配置**

Create `note-viewer/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/runtime-config.js": "http://localhost:8080"
    }
  }
});
```

- [ ] **Step 5: 创建 Vitest 配置**

Create `note-viewer/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true
  }
});
```

- [ ] **Step 6: 创建共享类型**

Create `note-viewer/src/shared/types.ts`:

```ts
export type FileKind = "markdown" | "text" | "image" | "unsupported";

export type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: TreeNode[];
  overviewPath?: string;
  updatedAt?: string;
  fileKind?: FileKind;
};

export type FileContent = {
  path: string;
  name: string;
  kind: "markdown" | "text";
  language?: string;
  content: string;
  updatedAt?: string;
};

export type PortalData = {
  repoReadme?: FileContent;
  entryCards: Array<{
    title: string;
    path: string;
    description?: string;
    kind: "top-level" | "highlight";
  }>;
};

export type SearchResult = {
  title: string;
  path: string;
  type: "directory" | "file";
  snippet?: string;
};

export type ViewerConfig = {
  repoRoot: string;
  contentRoot: string;
  port: number;
  publicBasePath: string;
};

declare global {
  interface Window {
    __NOTE_VIEWER_CONFIG__?: {
      publicBasePath: string;
    };
  }
}
```

- [ ] **Step 7: 创建最小前端入口**

Create `note-viewer/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>笔记预览</title>
    <script src="./runtime-config.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

Create `note-viewer/src/client/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `note-viewer/src/client/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>笔记预览</h1>
      <p>应用骨架已启动。</p>
    </main>
  );
}
```

Create `note-viewer/src/client/styles/base.css`:

```css
:root {
  color: #17202a;
  background: #f6f7f9;
  font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
}

body {
  margin: 0;
}

.app-shell {
  padding: 32px;
}
```

- [ ] **Step 8: 创建最小服务端入口**

Create `note-viewer/src/server/index.ts`:

```ts
import express from "express";

const port = Number(process.env.PORT || 8080);
const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`note-viewer listening on ${port}`);
});
```

- [ ] **Step 9: 安装依赖并验证骨架**

Run:

```bash
cd note-viewer
npm install
npm run typecheck
npm test
npm run build
```

Expected:

```text
typecheck exits 0
vitest exits 0
build exits 0
```

- [ ] **Step 10: 提交骨架**

```bash
git add note-viewer
git commit -m "feat: scaffold note viewer app"
```

## Task 2: 实现配置读取和路径安全

**Files:**
- Create: `note-viewer/src/server/config.ts`
- Create: `note-viewer/src/server/security/safePath.ts`
- Create: `note-viewer/src/server/security/safePath.test.ts`
- Modify: `note-viewer/src/server/index.ts`

**Interfaces:**
- Produces: `getConfig(): ViewerConfig`
- Produces: `toPosixPath(value: string): string`
- Produces: `resolveContentPath(relativePath: string, config: ViewerConfig): Promise<string>`
- Produces: `isIgnoredPath(relativePath: string): boolean`

- [ ] **Step 1: 写路径安全测试**

Create `note-viewer/src/server/security/safePath.test.ts`:

```ts
import { mkdtemp, mkdir, realpath, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { isIgnoredPath, resolveContentPath, toPosixPath } from "./safePath";

async function fixture(): Promise<ViewerConfig> {
  const root = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const content = join(root, "笔记");
  await mkdir(content, { recursive: true });
  return {
    repoRoot: root,
    contentRoot: content,
    port: 8080,
    publicBasePath: "/"
  };
}

describe("safePath", () => {
  it("normalizes Windows separators to POSIX for internal output", () => {
    expect(toPosixPath("学习记录\\docker\\readme.md")).toBe("学习记录/docker/readme.md");
  });

  it("resolves a valid relative path inside CONTENT_ROOT", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, "学习记录"), { recursive: true });
    await writeFile(join(config.contentRoot, "学习记录", "readme.md"), "# hi");
    const resolved = await resolveContentPath("学习记录/readme.md", config);
    expect(resolved).toBe(await realpath(join(config.contentRoot, "学习记录", "readme.md")));
  });

  it("rejects absolute paths", async () => {
    const config = await fixture();
    await expect(resolveContentPath("/etc/passwd", config)).rejects.toThrow("绝对路径");
  });

  it("rejects parent directory escape", async () => {
    const config = await fixture();
    await expect(resolveContentPath("../README.md", config)).rejects.toThrow("越界");
  });

  it("rejects NUL characters", async () => {
    const config = await fixture();
    await expect(resolveContentPath("a\u0000.md", config)).rejects.toThrow("非法字符");
  });

  it("rejects symlink escape", async () => {
    const config = await fixture();
    const outside = join(config.repoRoot, "outside.md");
    await writeFile(outside, "# outside");
    await symlink(outside, join(config.contentRoot, "link.md"));
    await expect(resolveContentPath("link.md", config)).rejects.toThrow("越界");
  });

  it("matches ignored path segments", () => {
    expect(isIgnoredPath(".git/config")).toBe(true);
    expect(isIgnoredPath("note-viewer/src/App.tsx")).toBe(true);
    expect(isIgnoredPath("学习记录/docker/readme.md")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd note-viewer
npm test -- src/server/security/safePath.test.ts
```

Expected:

```text
FAIL because safePath.ts does not exist
```

- [ ] **Step 3: 实现配置读取**

Create `note-viewer/src/server/config.ts`:

```ts
import { resolve } from "node:path";
import type { ViewerConfig } from "../shared/types";

function normalizeBasePath(value: string | undefined): string {
  const raw = value || "/";
  const withStart = raw.startsWith("/") ? raw : `/${raw}`;
  return withStart.endsWith("/") ? withStart : `${withStart}/`;
}

export function getConfig(): ViewerConfig {
  return {
    repoRoot: resolve(process.env.REPO_ROOT || "/workspace"),
    contentRoot: resolve(process.env.CONTENT_ROOT || "/workspace/笔记"),
    port: Number(process.env.PORT || 8080),
    publicBasePath: normalizeBasePath(process.env.PUBLIC_BASE_PATH)
  };
}
```

- [ ] **Step 4: 实现路径安全**

Create `note-viewer/src/server/security/safePath.ts`:

```ts
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ViewerConfig } from "../../shared/types";

const ignoredSegments = new Set([
  ".git",
  ".github",
  ".vscode",
  "node_modules",
  "dist",
  "note-viewer"
]);

export function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function isIgnoredPath(relativePath: string): boolean {
  return toPosixPath(relativePath)
    .split("/")
    .filter(Boolean)
    .some((segment) => ignoredSegments.has(segment));
}

export function decodeClientPath(raw: string): string {
  if (raw.includes("\u0000")) {
    throw new Error("非法字符：路径包含 NUL 字符");
  }
  if (raw.includes("\\")) {
    throw new Error("非法路径：请使用 POSIX / 分隔符");
  }
  if (path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
    throw new Error("非法路径：不允许绝对路径");
  }
  const normalized = path.posix.normalize(raw || ".");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("非法路径：路径越界");
  }
  if (isIgnoredPath(normalized)) {
    throw new Error("非法路径：路径被忽略");
  }
  return normalized === "." ? "" : normalized;
}

export async function resolveContentPath(relativePath: string, config: ViewerConfig): Promise<string> {
  const safeRelative = decodeClientPath(relativePath);
  const contentRootReal = await realpath(config.contentRoot);
  const candidate = path.resolve(contentRootReal, safeRelative);
  let candidateReal: string;
  try {
    candidateReal = await realpath(candidate);
  } catch {
    const parentReal = await realpath(path.dirname(candidate));
    candidateReal = path.join(parentReal, path.basename(candidate));
  }
  const relativeToRoot = path.relative(contentRootReal, candidateReal);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("非法路径：路径越界");
  }
  await stat(candidateReal);
  return candidateReal;
}
```

- [ ] **Step 5: 让服务端使用配置**

Modify `note-viewer/src/server/index.ts`:

```ts
import express from "express";
import { getConfig } from "./config";

const config = getConfig();
const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, basePath: config.publicBasePath });
});

app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({ publicBasePath: config.publicBasePath })};`);
});

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
```

- [ ] **Step 6: 运行测试和类型检查**

Run:

```bash
cd note-viewer
npm test -- src/server/security/safePath.test.ts
npm run typecheck
```

Expected:

```text
safePath tests PASS
typecheck exits 0
```

- [ ] **Step 7: 提交**

```bash
git add note-viewer/src/server note-viewer/src/shared
git commit -m "feat: add viewer path safety"
```

## Task 3: 实现目录扫描、文件读取和搜索服务

**Files:**
- Create: `note-viewer/src/server/services/readContent.ts`
- Create: `note-viewer/src/server/services/readContent.test.ts`
- Create: `note-viewer/src/server/services/scanRepository.ts`
- Create: `note-viewer/src/server/services/scanRepository.test.ts`
- Create: `note-viewer/src/server/services/searchIndex.ts`
- Create: `note-viewer/src/server/services/searchIndex.test.ts`

**Interfaces:**
- Consumes: `ViewerConfig`、`resolveContentPath()`、`isIgnoredPath()`
- Produces: `readTextFile(relativePath, config): Promise<FileContent>`
- Produces: `readRepoReadme(config): Promise<FileContent | undefined>`
- Produces: `getAssetInfo(relativePath, config): Promise<{ absolutePath: string; mimeType: string }>`
- Produces: `scanTree(config): Promise<TreeNode>`
- Produces: `buildPortalData(config): Promise<PortalData>`
- Produces: `searchNotes(query, tree, config): Promise<SearchResult[]>`

- [ ] **Step 1: 写文件读取测试**

Create `note-viewer/src/server/services/readContent.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { getAssetInfo, readRepoReadme, readTextFile } from "./readContent";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

describe("readContent", () => {
  it("reads markdown as markdown content", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "readme.md"), "# 标题");
    const file = await readTextFile("readme.md", config);
    expect(file.kind).toBe("markdown");
    expect(file.content).toContain("# 标题");
  });

  it("detects yaml language", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "docker-compose.yml"), "services: {}");
    const file = await readTextFile("docker-compose.yml", config);
    expect(file.kind).toBe("text");
    expect(file.language).toBe("yaml");
  });

  it("reads only REPO_ROOT README for portal", async () => {
    const config = await fixture();
    await writeFile(join(config.repoRoot, "README.md"), "# 仓库");
    const readme = await readRepoReadme(config);
    expect(readme?.path).toBe("README.md");
    expect(readme?.content).toContain("# 仓库");
  });

  it("rejects unsupported extension", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "a.bin"), "x");
    await expect(readTextFile("a.bin", config)).rejects.toThrow("不支持");
  });

  it("returns png asset info and rejects svg asset", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "a.png"), "png");
    expect((await getAssetInfo("a.png", config)).mimeType).toBe("image/png");
    await writeFile(join(config.contentRoot, "a.svg"), "<svg />");
    await expect(getAssetInfo("a.svg", config)).rejects.toThrow("SVG");
  });
});
```

- [ ] **Step 2: 实现 readContent**

Create `note-viewer/src/server/services/readContent.ts`:

```ts
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { FileContent, ViewerConfig } from "../../shared/types";
import { resolveContentPath, toPosixPath } from "../security/safePath";

const textLanguages = new Map<string, string>([
  [".txt", "text"],
  [".yml", "yaml"],
  [".yaml", "yaml"],
  [".json", "json"],
  [".conf", "nginx"],
  [".sql", "sql"],
  [".js", "javascript"],
  [".ts", "typescript"],
  [".html", "html"],
  [".css", "css"],
  [".sh", "bash"],
  [".bat", "bat"],
  [".reg", "reg"]
]);

const imageMime = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"]
]);

export function getFileKindByName(name: string): "markdown" | "text" | "image" | "unsupported" {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".md") return "markdown";
  if (textLanguages.has(ext)) return "text";
  if (imageMime.has(ext)) return "image";
  return "unsupported";
}

export function getLanguageByName(name: string): string | undefined {
  const ext = path.extname(name).toLowerCase();
  return textLanguages.get(ext);
}

export async function readTextFile(relativePath: string, config: ViewerConfig): Promise<FileContent> {
  const kind = getFileKindByName(relativePath);
  if (kind !== "markdown" && kind !== "text") {
    throw new Error("不支持的文件类型");
  }
  const absolutePath = await resolveContentPath(relativePath, config);
  const content = await readFile(absolutePath, "utf8");
  const info = await stat(absolutePath);
  return {
    path: toPosixPath(relativePath),
    name: path.basename(relativePath),
    kind,
    language: kind === "text" ? getLanguageByName(relativePath) : undefined,
    content,
    updatedAt: info.mtime.toISOString()
  };
}

export async function readRepoReadme(config: ViewerConfig): Promise<FileContent | undefined> {
  const absolutePath = path.join(config.repoRoot, "README.md");
  try {
    await access(absolutePath);
  } catch {
    return undefined;
  }
  const content = await readFile(absolutePath, "utf8");
  const info = await stat(absolutePath);
  return {
    path: "README.md",
    name: "README.md",
    kind: "markdown",
    content,
    updatedAt: info.mtime.toISOString()
  };
}

export async function getAssetInfo(relativePath: string, config: ViewerConfig): Promise<{ absolutePath: string; mimeType: string }> {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === ".svg") {
    throw new Error("SVG 资源第一版不提供预览");
  }
  const mimeType = imageMime.get(ext);
  if (!mimeType) {
    throw new Error("不支持的图片类型");
  }
  return {
    absolutePath: await resolveContentPath(relativePath, config),
    mimeType
  };
}
```

- [ ] **Step 3: 写目录扫描测试**

Create `note-viewer/src/server/services/scanRepository.test.ts`:

```ts
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { buildPortalData, scanTree } from "./scanRepository";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

describe("scanRepository", () => {
  it("uses overview priority readme.md before README.md and Readme.md", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, "学习记录"), { recursive: true });
    await writeFile(join(config.contentRoot, "学习记录", "README.md"), "# upper");
    await writeFile(join(config.contentRoot, "学习记录", "readme.md"), "# lower");
    const tree = await scanTree(config);
    const node = tree.children?.find((child) => child.name === "学习记录");
    expect(node?.overviewPath).toBe("学习记录/readme.md");
  });

  it("ignores hidden project directories and unsupported files", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, ".git"), { recursive: true });
    await writeFile(join(config.contentRoot, ".git", "config"), "x");
    await writeFile(join(config.contentRoot, "a.bin"), "x");
    await writeFile(join(config.contentRoot, "a.md"), "# a");
    const tree = await scanTree(config);
    expect(tree.children?.map((child) => child.name)).toEqual(["a.md"]);
  });

  it("skips symlink entries", async () => {
    const config = await fixture();
    const outside = join(config.repoRoot, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "secret.md"), "# secret");
    await symlink(outside, join(config.contentRoot, "link-out"));
    const tree = await scanTree(config);
    expect(tree.children?.some((child) => child.name === "link-out")).toBe(false);
  });

  it("builds portal cards for known existing paths", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, "学习记录", "docker", "1.docker-compose文件样例"), { recursive: true });
    await mkdir(join(config.contentRoot, "教程"), { recursive: true });
    await writeFile(join(config.repoRoot, "README.md"), "# 仓库");
    const portal = await buildPortalData(config);
    expect(portal.repoReadme?.content).toContain("# 仓库");
    expect(portal.entryCards.map((card) => card.title)).toContain("学习记录");
    expect(portal.entryCards.map((card) => card.title)).toContain("教程");
    expect(portal.entryCards.map((card) => card.title)).toContain("Docker Compose 样例");
  });
});
```

- [ ] **Step 4: 实现 scanRepository**

Create `note-viewer/src/server/services/scanRepository.ts` with:

```ts
import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { PortalData, TreeNode, ViewerConfig } from "../../shared/types";
import { isIgnoredPath, toPosixPath } from "../security/safePath";
import { getFileKindByName, readRepoReadme } from "./readContent";

const overviewNames = ["readme.md", "README.md", "Readme.md"];

async function isInsideContentRoot(absolutePath: string, contentRootReal: string): Promise<boolean> {
  const candidateReal = await realpath(absolutePath);
  const relative = path.relative(contentRootReal, candidateReal);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function findOverview(absoluteDir: string, relativeDir: string): Promise<string | undefined> {
  const names = new Set((await readdir(absoluteDir)).map((entry) => entry));
  for (const name of overviewNames) {
    if (names.has(name)) {
      return toPosixPath(path.posix.join(relativeDir, name));
    }
  }
  return undefined;
}

async function scanNode(absolutePath: string, relativePath: string, contentRootReal: string): Promise<TreeNode | undefined> {
  if (relativePath && isIgnoredPath(relativePath)) return undefined;
  const info = await lstat(absolutePath);
  if (info.isSymbolicLink()) return undefined;
  if (!(await isInsideContentRoot(absolutePath, contentRootReal))) return undefined;
  const name = relativePath ? path.basename(relativePath) : "笔记";
  if (info.isDirectory()) {
    const entries = await readdir(absolutePath);
    const children: TreeNode[] = [];
    for (const entry of entries.sort((a, b) => a.localeCompare(b, "zh-CN"))) {
      const childRelative = toPosixPath(path.posix.join(relativePath, entry));
      const child = await scanNode(path.join(absolutePath, entry), childRelative, contentRootReal);
      if (child) children.push(child);
    }
    return {
      name,
      path: toPosixPath(relativePath),
      type: "directory",
      overviewPath: await findOverview(absolutePath, toPosixPath(relativePath)),
      updatedAt: info.mtime.toISOString(),
      children
    };
  }
  const fileKind = getFileKindByName(relativePath);
  if (fileKind === "unsupported" || fileKind === "image") return undefined;
  return {
    name,
    path: toPosixPath(relativePath),
    type: "file",
    fileKind,
    updatedAt: info.mtime.toISOString()
  };
}

export async function scanTree(config: ViewerConfig): Promise<TreeNode> {
  const contentRootReal = await realpath(config.contentRoot);
  const root = await scanNode(contentRootReal, "", contentRootReal);
  if (!root) throw new Error("无法扫描内容目录");
  return root;
}

export async function buildPortalData(config: ViewerConfig): Promise<PortalData> {
  const tree = await scanTree(config);
  const known = new Map<string, string>([
    ["学习记录", "学习记录"],
    ["教程", "教程"],
    ["Docker Compose 样例", "学习记录/docker/1.docker-compose文件样例"],
    ["设计模式", "学习记录/设计模式"],
    ["Spring", "学习记录/spring"],
    ["Git", "学习记录/git"],
    ["IDE", "教程/ide"],
    ["Windows", "教程/windows"],
    ["WSL", "教程/wsl"]
  ]);
  const paths = new Set<string>();
  function walk(node: TreeNode) {
    paths.add(node.path);
    node.children?.forEach(walk);
  }
  walk(tree);
  return {
    repoReadme: await readRepoReadme(config),
    entryCards: [...known.entries()]
      .filter(([, target]) => paths.has(target))
      .map(([title, target]) => ({
        title,
        path: target,
        kind: target.includes("/") ? "highlight" : "top-level"
      }))
  };
}
```

- [ ] **Step 5: 写搜索测试并实现 searchIndex**

Create `note-viewer/src/server/services/searchIndex.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { TreeNode, ViewerConfig } from "../../shared/types";
import { searchNotes } from "./searchIndex";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(join(contentRoot, "学习记录"), { recursive: true });
  await writeFile(join(contentRoot, "学习记录", "spring.md"), "# Spring 扩展\n正文");
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

function tree(): TreeNode {
  return {
    name: "笔记",
    path: "",
    type: "directory",
    children: [
      {
        name: "学习记录",
        path: "学习记录",
        type: "directory",
        children: [
          {
            name: "spring.md",
            path: "学习记录/spring.md",
            type: "file",
            fileKind: "markdown"
          }
        ]
      }
    ]
  };
}

describe("searchIndex", () => {
  it("finds directory and file names", async () => {
    const config = await fixture();
    const results = await searchNotes("spring", tree(), config);
    expect(results.some((item) => item.path === "学习记录/spring.md")).toBe(true);
  });

  it("finds markdown first heading", async () => {
    const config = await fixture();
    const results = await searchNotes("扩展", tree(), config);
    expect(results.some((item) => item.title === "Spring 扩展")).toBe(true);
  });

  it("returns empty results for blank query", async () => {
    const config = await fixture();
    await expect(searchNotes("   ", tree(), config)).resolves.toEqual([]);
  });
});
```

Create `note-viewer/src/server/services/searchIndex.ts`:

```ts
import type { SearchResult, TreeNode, ViewerConfig } from "../../shared/types";
import { readTextFile } from "./readContent";

function firstHeading(content: string): string | undefined {
  return content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s+/, "");
}

export async function searchNotes(query: string, tree: TreeNode, config: ViewerConfig): Promise<SearchResult[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const results: SearchResult[] = [];
  async function walk(node: TreeNode) {
    const haystack = `${node.name} ${node.path}`.toLowerCase();
    if (haystack.includes(normalized)) {
      results.push({ title: node.name, path: node.path, type: node.type });
    }
    if (node.type === "file" && node.fileKind === "markdown") {
      try {
        const file = await readTextFile(node.path, config);
        const heading = firstHeading(file.content);
        if (heading?.toLowerCase().includes(normalized)) {
          results.push({ title: heading, path: node.path, type: "file", snippet: node.name });
        }
      } catch {
        return;
      }
    }
    for (const child of node.children || []) {
      await walk(child);
    }
  }
  await walk(tree);
  return results.slice(0, 50);
}
```

- [ ] **Step 6: 运行服务层测试**

Run:

```bash
cd note-viewer
npm test -- src/server/services
npm run typecheck
```

Expected:

```text
service tests PASS
typecheck exits 0
```

- [ ] **Step 7: 提交**

```bash
git add note-viewer/src/server/services
git commit -m "feat: scan and read note content"
```

## Task 4: 实现 API 路由、静态资源服务和 SSE

**Files:**
- Create: `note-viewer/src/server/routes/tree.ts`
- Create: `note-viewer/src/server/routes/portal.ts`
- Create: `note-viewer/src/server/routes/file.ts`
- Create: `note-viewer/src/server/routes/asset.ts`
- Create: `note-viewer/src/server/routes/search.ts`
- Create: `note-viewer/src/server/routes/events.ts`
- Create: `note-viewer/src/server/services/watchRepository.ts`
- Modify: `note-viewer/src/server/index.ts`

**Interfaces:**
- Consumes: Task 2 and Task 3 services.
- Produces: API endpoints from the spec.

- [ ] **Step 1: 实现 watchRepository**

Create `note-viewer/src/server/services/watchRepository.ts`:

```ts
import chokidar from "chokidar";
import type { Response } from "express";
import path from "node:path";
import type { ViewerConfig } from "../../shared/types";
import { isIgnoredPath, toPosixPath } from "../security/safePath";

const clients = new Set<Response>();
let debounceTimer: NodeJS.Timeout | undefined;

function emit(event: string) {
  for (const client of clients) {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }
}

export function addEventsClient(res: Response) {
  clients.add(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: connected\ndata: {}\n\n");
  res.on("close", () => clients.delete(res));
}

export function startRepositoryWatcher(config: ViewerConfig) {
  const watcher = chokidar.watch(config.contentRoot, {
    followSymlinks: false,
    ignoreInitial: true,
    usePolling: process.env.WATCH_USE_POLLING === "true",
    interval: 1000,
    ignored: (watchedPath) => {
      const relative = path.relative(config.contentRoot, watchedPath);
      return relative.startsWith("..") || path.isAbsolute(relative) || isIgnoredPath(toPosixPath(relative));
    }
  });
  watcher.on("all", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emit("tree-changed");
      emit("file-changed");
    }, 300);
  });
  return watcher;
}
```

- [ ] **Step 2: 实现 API routes**

Create `note-viewer/src/server/routes/tree.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { scanTree } from "../services/scanRepository";

export function createTreeRouter(config: ViewerConfig) {
  const router = Router();
  router.get("/", async (_req, res, next) => {
    try {
      res.json(await scanTree(config));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
```

Create `note-viewer/src/server/routes/portal.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { buildPortalData } from "../services/scanRepository";

export function createPortalRouter(config: ViewerConfig) {
  const router = Router();
  router.get("/", async (_req, res, next) => {
    try {
      res.json(await buildPortalData(config));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
```

Create `note-viewer/src/server/routes/file.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { readTextFile } from "../services/readContent";

export function createFileRouter(config: ViewerConfig) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const requestedPath = String(req.query.path || "");
      res.json(await readTextFile(requestedPath, config));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
```

Create `note-viewer/src/server/routes/asset.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { getAssetInfo } from "../services/readContent";

export function createAssetRouter(config: ViewerConfig) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const requestedPath = String(req.query.path || "");
      const { absolutePath, mimeType } = await getAssetInfo(requestedPath, config);
      res.type(mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(absolutePath);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
```

Create `note-viewer/src/server/routes/search.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { scanTree } from "../services/scanRepository";
import { searchNotes } from "../services/searchIndex";

export function createSearchRouter(config: ViewerConfig) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const query = String(req.query.q || "");
      const tree = await scanTree(config);
      res.json(await searchNotes(query, tree, config));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
```

Create `note-viewer/src/server/routes/events.ts`:

```ts
import { Router } from "express";
import { addEventsClient } from "../services/watchRepository";

export function createEventsRouter() {
  const router = Router();
  router.get("/", (_req, res) => {
    addEventsClient(res);
  });
  return router;
}
```

Express 已经对 `req.query` 做 URL decode。客户端必须用 `URLSearchParams` 编码路径；`safePath` 接收的是已解码字符串，并继续负责绝对路径、反斜杠、NUL、越界和忽略目录校验。

- [ ] **Step 3: 组装 Express 应用**

Modify `note-viewer/src/server/index.ts`:

```ts
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config";
import { createAssetRouter } from "./routes/asset";
import { createEventsRouter } from "./routes/events";
import { createFileRouter } from "./routes/file";
import { createPortalRouter } from "./routes/portal";
import { createSearchRouter } from "./routes/search";
import { createTreeRouter } from "./routes/tree";
import { startRepositoryWatcher } from "./services/watchRepository";

const config = getConfig();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../client");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, basePath: config.publicBasePath });
});
app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({ publicBasePath: config.publicBasePath })};`);
});
app.use("/api/tree", createTreeRouter(config));
app.use("/api/portal", createPortalRouter(config));
app.use("/api/file", createFileRouter(config));
app.use("/api/asset", createAssetRouter(config));
app.use("/api/search", createSearchRouter(config));
app.use("/api/events", createEventsRouter());

app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: error.message });
});

startRepositoryWatcher(config);

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
```

- [ ] **Step 4: 运行 API 验证**

Run:

```bash
cd note-viewer
npm run typecheck
npm run build
```

Expected:

```text
typecheck exits 0
build exits 0
```

- [ ] **Step 5: 提交**

```bash
git add note-viewer/src/server
git commit -m "feat: expose note viewer api"
```

## Task 5: 实现 React 首页门户和工作台

**Files:**
- Create: `note-viewer/src/client/lib/api.ts`
- Create: `note-viewer/src/client/lib/path.ts`
- Create: `note-viewer/src/client/components/PortalHome.tsx`
- Create: `note-viewer/src/client/components/Workspace.tsx`
- Create: `note-viewer/src/client/components/DirectoryTree.tsx`
- Create: `note-viewer/src/client/components/Breadcrumbs.tsx`
- Create: `note-viewer/src/client/components/FilePreview.tsx`
- Create: `note-viewer/src/client/components/SearchBox.tsx`
- Modify: `note-viewer/src/client/App.tsx`
- Modify: `note-viewer/src/client/styles/base.css`

**Interfaces:**
- Consumes: API endpoints from Task 4.
- Produces: Browser UI for portal, tree navigation, preview, search, and SSE refresh.

- [ ] **Step 1: 实现 API 客户端**

Create `note-viewer/src/client/lib/api.ts`:

```ts
import type { FileContent, PortalData, SearchResult, TreeNode } from "../../shared/types";

function runtimeBasePath(): string {
  const configured = window.__NOTE_VIEWER_CONFIG__?.publicBasePath || "/";
  const withStart = configured.startsWith("/") ? configured : `/${configured}`;
  return withStart.endsWith("/") ? withStart : `${withStart}/`;
}

function apiUrl(path: string, params?: Record<string, string>) {
  const basePath = runtimeBasePath();
  const url = new URL(`${basePath.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, window.location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const response = await fetch(apiUrl(path, params));
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  portal: () => getJson<PortalData>("api/portal"),
  tree: () => getJson<TreeNode>("api/tree"),
  file: (path: string) => getJson<FileContent>("api/file", { path }),
  search: (q: string) => getJson<SearchResult[]>("api/search", { q }),
  assetUrl: (path: string) => apiUrl("api/asset", { path }),
  eventsUrl: () => apiUrl("api/events")
};
```

- [ ] **Step 2: 实现 Markdown 链接工具**

Create `note-viewer/src/client/lib/path.ts`:

```ts
export function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function resolveRelativePath(fromFile: string, target: string): string {
  if (/^https?:\/\//.test(target) || target.startsWith("#")) return target;
  const base = dirname(fromFile);
  const stack = [...base.split("/").filter(Boolean)];
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}
```

- [ ] **Step 3: 实现门户、工作台和组件**

Implement components with these props:

```ts
type PortalHomeProps = {
  onOpenPath: (path: string) => void;
};

type WorkspaceProps = {
  initialPath: string;
  onBackHome: () => void;
};

type DirectoryTreeProps = {
  tree: TreeNode;
  selectedPath: string;
  onSelect: (node: TreeNode) => void;
};

type FilePreviewProps = {
  file?: FileContent;
  onNavigate: (path: string) => void;
};
```

`FilePreview` must use `react-markdown` and `remark-gfm`. Disable raw HTML by not adding `rehype-raw`. Rewrite images through `api.assetUrl(resolveRelativePath(file.path, src))`. Markdown links to `.md` files should call `onNavigate`.

- [ ] **Step 4: 实现 App 状态和 SSE 刷新**

Modify `App.tsx` so it:

- Loads portal data on home.
- Opens workspace when a portal card, search result, tree item, or Markdown link is selected.
- Loads tree and selected file in workspace.
- If a directory has `overviewPath`, loads that file.
- Connects to `api.eventsUrl()` with `EventSource`.
- On `tree-changed`, reloads tree.
- On `file-changed`, reloads current file if one is open.

- [ ] **Step 5: 实现样式**

Update `base.css` with a practical knowledge-base layout:

- Header height fixed.
- Portal cards in responsive grid.
- Workspace uses two columns: `280px minmax(0, 1fr)`.
- Directory tree scrolls independently.
- Preview content max width around `980px`.
- Code blocks use horizontal scroll.
- Mobile layout stacks sidebar above content.

- [ ] **Step 6: 运行前端构建验证**

Run:

```bash
cd note-viewer
npm run typecheck
npm run build
```

Expected:

```text
typecheck exits 0
client and server build exits 0
```

- [ ] **Step 7: 提交**

```bash
git add note-viewer/src/client note-viewer/index.html note-viewer/vite.config.ts
git commit -m "feat: add note viewer interface"
```

## Task 6: Docker、README、交接文档和 Nginx 示例

**Files:**
- Create: `note-viewer/Dockerfile`
- Create: `note-viewer/docker-compose.yml`
- Create: `note-viewer/.dockerignore`
- Create: `note-viewer/README.md`
- Create: `note-viewer/docs/handoff.md`
- Create: `note-viewer/docs/nginx-notes-location.conf`

**Interfaces:**
- Produces: `docker compose up --build` from `note-viewer/`.
- Produces: Chinese usage docs for user and future agents.

- [ ] **Step 1: 创建 Dockerfile**

Create `note-viewer/Dockerfile`:

```Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV REPO_ROOT=/workspace
ENV CONTENT_ROOT=/workspace/笔记
ENV WATCH_USE_POLLING=false
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["npm", "run", "start"]
```

- [ ] **Step 2: 创建 compose 和 dockerignore**

Create `note-viewer/docker-compose.yml`:

```yaml
services:
  note-viewer:
    build: .
    container_name: note-viewer
    ports:
      - "8088:8080"
    volumes:
      - ..:/workspace:ro
    environment:
      - REPO_ROOT=/workspace
      - CONTENT_ROOT=/workspace/笔记
      - PORT=8080
      - PUBLIC_BASE_PATH=/
      - WATCH_USE_POLLING=false
    restart: unless-stopped
```

Create `note-viewer/.dockerignore`:

```text
node_modules
dist
.git
*.log
```

- [ ] **Step 3: 创建中文 README**

Create `note-viewer/README.md` with these sections:

```md
# 笔记可视化预览服务

这是当前仓库的可视化笔记预览服务。它以真实目录结构为准，从 `笔记/` 目录读取 Markdown 和文本文件，并通过浏览器提供门户首页、目录树、文件预览和搜索。

## Docker 启动

```bash
cd note-viewer
docker compose up --build
```

访问：

```text
http://localhost:8088
```

## 挂载说明

`docker-compose.yml` 会把仓库根目录只读挂载到容器 `/workspace`：

```yaml
volumes:
  - ..:/workspace:ro
```

主内容目录由 `CONTENT_ROOT=/workspace/笔记` 指定。

如果 Docker Desktop 下文件变化事件不稳定，可以启用轮询：

```yaml
environment:
  - WATCH_USE_POLLING=true
```

## Nginx 子路径代理

如果挂到 `/notes/`，需要设置：

```yaml
environment:
  - PUBLIC_BASE_PATH=/notes/
```

参考 `docs/nginx-notes-location.conf`。

## 本地开发

```bash
npm install
npm run dev
```

## 验证命令

```bash
npm run typecheck
npm test
npm run build
docker compose up --build
```
```

- [ ] **Step 4: 创建 Nginx 示例**

Create `note-viewer/docs/nginx-notes-location.conf`:

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

- [ ] **Step 5: 创建交接文档**

Create `note-viewer/docs/handoff.md`:

```md
# 笔记预览服务交接说明

## 先读文件

1. `docs/superpowers/specs/2026-07-07-note-viewer-design.md`
2. `docs/superpowers/plans/2026-07-07-note-viewer.md`
3. `note-viewer/README.md`

## 关键边界

- 仓库根目录只读挂载到 `/workspace`。
- 主导航只扫描 `/workspace/笔记`。
- 所有浏览器传入路径都必须走 `safePath`。
- 前端 URL 必须支持 `PUBLIC_BASE_PATH`。
- 第一版没有写 API。

## 常用命令

```bash
npm run typecheck
npm test
npm run build
docker compose up --build
```
```

- [ ] **Step 6: 验证 Docker 构建**

Run:

```bash
cd note-viewer
docker compose build
```

Expected:

```text
note-viewer image builds successfully
```

- [ ] **Step 7: 提交**

```bash
git add note-viewer/Dockerfile note-viewer/docker-compose.yml note-viewer/.dockerignore note-viewer/README.md note-viewer/docs
git commit -m "docs: add note viewer docker usage"
```

## Task 7: 端到端验证和收尾

**Files:**
- Modify only if verification exposes issues.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified working viewer.

- [ ] **Step 1: 运行完整本地验证**

Run:

```bash
cd note-viewer
npm run typecheck
npm test
npm run build
```

Expected:

```text
typecheck exits 0
all tests PASS
build exits 0
```

- [ ] **Step 2: 运行 Docker 服务**

Run:

```bash
cd note-viewer
docker compose up --build
```

Expected:

```text
note-viewer listening on 8080
browser can access http://localhost:8088
```

- [ ] **Step 3: 浏览器验证**

Open:

```text
http://localhost:8088
```

Verify:

- 首页门户显示 `学习记录` 和 `教程`。
- 能进入工作台。
- 左侧目录树显示真实目录结构。
- 点击目录默认展示 `readme.md`、`README.md` 或 `Readme.md`。
- Markdown 文件正常渲染标题、列表、表格、代码块。
- YAML 或 CONF 文件以代码样式展示。
- Markdown 图片可以正常显示。
- 搜索文件名可以返回结果。

- [ ] **Step 4: 文件变化验证**

Modify a non-critical Markdown file temporarily, for example append and then remove a blank line in a test note. Do not leave content changes behind.

Expected:

```text
viewer receives change event and reloads tree/current file
git diff does not retain accidental note edits
```

- [ ] **Step 5: 检查工作区**

Run:

```bash
git status --short --branch
```

Expected:

```text
Only intentional note-viewer changes remain, or clean after commits.
Existing unrelated user changes under compose/nginx are not reverted.
```

- [ ] **Step 6: 最终提交**

If verification required fixes:

```bash
git add note-viewer
git commit -m "fix: verify note viewer runtime"
```

If no fixes were needed, do not create an empty commit.

## 自查结果

- Spec 覆盖：计划覆盖了工程骨架、Docker 只读挂载、真实目录扫描、目录说明文件优先级、只读 API、路径安全、Markdown 渲染、图片资源、搜索、SSE、Nginx 子路径代理、中文 README 和交接文档。
- 完整性扫描：计划没有未完成标记或待补内容。
- 类型一致性：共享类型集中在 `src/shared/types.ts`；后端服务和前端 API 均引用这些类型。
