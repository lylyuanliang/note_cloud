# 笔记可视化预览服务设计

日期：2026-07-07

## 目标

为当前仓库开发一个可视化笔记预览服务。用户可以通过浏览器浏览笔记仓库，目录结构以真实文件系统为准。

预览服务需要同时支持两种访问方式：

- 直接通过 Docker 容器端口访问。
- 通过 Nginx 反向代理访问。

仓库根目录以只读卷挂载到容器中。宿主机上的 Markdown 和文本文件变化后，服务应能感知变化并刷新预览数据，不需要重新构建镜像。

## 非目标

- 不替换现有 `readme.md` 导航文件。
- 不要求用户手工维护额外的导航清单。
- 第一版不向挂载的笔记仓库写入内容。
- 主导航不展示 `.git`、`.vscode`、`.github` 等内部工程目录。
- 第一版不做完整 CMS、在线编辑器、认证系统或多用户权限系统。

## 现有仓库背景

当前仓库是一个中文个人云笔记仓库：

- `README.md` 是 GitHub/Gitee 场景下的顶层入口。
- `笔记/学习记录` 存放技术学习沉淀。
- `笔记/教程` 存放操作型教程。
- 主要内容是 Markdown，另外有图片和少量文本/配置文件，例如 YAML、SQL、CONF、JS、HTML、TXT。
- `笔记/学习记录/docker/1.docker-compose文件样例` 包含可运行的 Docker Compose 样例。

仓库根目录目前没有 `.codegraph/`，也不是传统意义上的统一构建型应用。

## 文档语言约定

面向用户阅读的文档默认使用中文，包括设计文档、实现计划、README、交接说明和运行说明。

以下内容可以保留英文：

- 代码标识符、API 路径、配置项、命令和文件名。
- 技术名词，例如 Docker、Nginx、React、TypeScript、Server-Sent Events。
- 第三方库名称和标准协议名称。

## 推荐架构

新增一个独立应用目录 `note-viewer/`。

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

`note-viewer/` 与 `笔记/` 分离，避免预览器代码和笔记内容互相污染。后续升级预览器时，也不需要改动原始笔记目录。

## 运行模型

使用容器化 Node 服务，前端采用 React。

- 宿主机把整个仓库根目录只读挂载进容器。
- 后端从挂载目录读取文件。
- 前端通过后端 API 获取目录树、文件内容、图片资源、搜索结果和文件变化事件。
- Nginx 只负责反向代理，不负责扫描文件。

`docker-compose.yml` 放在 `note-viewer/` 目录下。示例：

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

从 `note-viewer/` 目录运行时：

- `build: .` 构建当前预览器应用。
- `..:/workspace:ro` 将仓库根目录只读挂载到容器 `/workspace`。
- `CONTENT_ROOT=/workspace/笔记` 表示主导航从 `笔记` 目录开始。

Nginx 反向代理示例：

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

当服务挂在 `/notes/` 子路径下时，容器应配置：

```text
PUBLIC_BASE_PATH=/notes/
```

前端构造 API 和资源 URL 时必须使用这个 base path，不能硬编码绝对路径 `/api/...`。也可以使用能在当前 base path 下解析的相对路径，例如 `api/tree`。

## 数据源规则

真实目录结构是可视化导航的数据源。

- 主内容根目录：`CONTENT_ROOT`，默认 `/workspace/笔记`。
- 仓库根目录：`REPO_ROOT`，默认 `/workspace`。
- 顶层 `README.md` 可以显示在首页门户中，但不作为主导航数据源。
- 目录节点来自真实目录。
- 文件节点来自支持预览的文本文件。
- `readme.md`、`README.md`、`Readme.md` 都视为目录说明文件。
- 如果同一目录下同时存在多个说明文件，优先级为：`readme.md`、`README.md`、`Readme.md`。
- 打开目录时，如果存在目录说明文件，默认展示该说明文件。
- 图片文件作为 Markdown 引用资源提供，默认不作为主导航中的一级文件节点展示。

默认忽略路径按 path segment 匹配，并应用到目录树、文件读取、图片资源、搜索和监听逻辑：

- `.git`
- `.github`
- `.vscode`
- `node_modules`
- `dist`
- `note-viewer`
- `note-viewer/node_modules`
- `note-viewer/dist`

第一版支持的预览文件类型：

- Markdown：`.md`
- 文本/配置/代码：`.txt`、`.yml`、`.yaml`、`.json`、`.conf`、`.sql`、`.js`、`.ts`、`.html`、`.css`、`.sh`、`.bat`、`.reg`
- Markdown 图片资源：`.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg`

## API 设计

所有 API 都是只读 API。

### `GET /api/tree`

返回以 `CONTENT_ROOT` 为根的当前笔记目录树。

响应结构：

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

返回首页门户数据。

响应结构：

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

`repoReadme` 只能读取 `REPO_ROOT/README.md`，不能接受客户端传入任意路径。

### `GET /api/file?path=<relative-path>`

读取相对 `CONTENT_ROOT` 的受支持文本文件。

路径参数使用 `URLSearchParams` 做 UTF-8 编码。API 返回的 `path` 统一使用 POSIX 风格相对路径，即使用 `/` 分隔，即使宿主机是 Windows。

响应结构：

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

读取相对 `CONTENT_ROOT` 的图片资源，主要供 Markdown 渲染使用。

### `GET /api/search?q=<query>`

第一版搜索范围：

- 文件名
- 目录名
- Markdown 一级标题
- 目录说明文件标题

全文搜索可以作为后续增强，不放进第一版强制范围。

### `GET /api/events`

使用 Server-Sent Events 通知前端仓库内容发生变化。

事件示例：

- `tree-changed`
- `file-changed`

前端收到事件后刷新目录树。如果当前打开的文件发生变化，也应重新加载当前预览。

文件监听策略：

- 对 `CONTENT_ROOT` 做递归监听。
- 对短时间内的连续变化做 debounce，避免一次保存触发大量刷新。
- 推送粗粒度事件，不需要每个底层文件事件都发给前端。
- Docker Desktop、Windows、macOS、Linux 的文件事件行为不完全一致；如果原生事件不可靠，允许降级为周期性重新扫描。
- SSE 客户端需要自动重连。

## 前端设计

第一版包含两个主界面。

### 首页门户

首页门户提供更直观的知识库入口。

应展示：

- `学习记录`、`教程` 两个顶层入口卡片。
- 当路径存在时，展示常用深层入口，例如 Docker Compose 样例、设计模式、Spring、Git、IDE、Windows、WSL。
- 可选展示仓库顶层 `README.md` 作为简介。
- 全局搜索入口。

首页门户的目标是：即使用户不记得具体文件夹结构，也能快速进入常用内容。

### 工作台

工作台是主要浏览界面。

应展示：

- 左侧：真实目录树。
- 顶部：面包屑、搜索、返回首页操作。
- 主区域：当前目录说明或选中文件预览。
- 打开目录时，默认展示本目录的 `readme.md`、`README.md` 或 `Readme.md`。
- `.md` 使用 Markdown 文章预览。
- YAML、SQL、CONF、JS、HTML、TXT 等使用代码样式预览。

界面风格应偏实用知识库，不做营销式首页。

## Markdown 渲染

Markdown 预览至少支持：

- 标题
- 表格
- 列表
- fenced code block
- inline code
- 相对图片链接
- 相对 Markdown 链接

相对 Markdown 链接如果指向 `CONTENT_ROOT` 下的文件，应在当前预览器内部跳转。

相对图片链接应按 `PUBLIC_BASE_PATH` 重写，例如 `api/asset?path=...` 或 `${PUBLIC_BASE_PATH}api/asset?path=...`。

## 安全边界

浏览器传给服务端的所有路径都必须视为不可信输入。

必须实现的保护：

- URL 输入先 decode，再校验。
- 标准化并 resolve 请求路径。
- 拒绝客户端传入绝对路径。
- 拒绝 NUL 字符。
- 客户端路径只接受 POSIX `/` 分隔，拒绝 Windows 反斜杠路径分隔符。
- 拒绝逃逸出 `CONTENT_ROOT` 的路径。
- 使用 realpath 校验，防止 symlink 逃逸。
- 不暴露忽略目录。
- tree、file、asset、search、Markdown 链接处理、watch 逻辑都必须使用同一套路径安全检查。
- Markdown 原始 HTML 默认禁用或 sanitize。
- SVG 视为潜在不安全资源；第一版可以用严格响应头提供，或者直接排除 SVG 预览。
- Docker 挂载必须只读。
- 第一版不实现写 API。

该服务面向本机或可信局域网使用。如果要暴露到公网，需要先增加认证和更严格的访问控制。

## 开发与部署命令

本地开发命令：

```bash
cd note-viewer
npm install
npm run dev
```

容器运行命令：

```bash
cd note-viewer
docker compose up --build
```

默认访问地址：

```text
http://localhost:8088
```

生产构建验证命令：

```bash
cd note-viewer
npm run build
npm run typecheck
```

## 测试与验收

第一版最少需要验证：

- TypeScript typecheck 通过。
- 生产构建通过。
- Docker 镜像可以构建。
- Docker Compose 可以启动预览服务。
- 浏览器可以打开首页门户。
- 浏览器可以进入 `学习记录` 和 `教程`。
- 浏览器可以预览 Markdown 文件。
- 浏览器可以预览 YAML 或 CONF 文件。
- Markdown 中的图片可以通过 asset API 正常渲染。
- 修改挂载目录中的 Markdown 文件后，预览器能收到变化并刷新。

## 交接说明

后续 agent 接手时，应优先阅读：

1. 本设计文档。
2. 实现开始后的 `note-viewer/README.md`。
3. 实现开始后的 `note-viewer/docs/handoff.md`。

实现时应保持写入范围清晰：

- 后端文件系统/API 逻辑放在 `note-viewer/src/server`。
- 前端 UI 放在 `note-viewer/src/client`。
- 共享类型放在 `note-viewer/src/shared`。
- Docker 和运行说明放在 `note-viewer/`。

当写入范围互不重叠时，可以安全地并行使用 subagent：

- 后端扫描/API 可由一个 worker 负责。
- 前端门户/工作台可由一个 worker 负责。
- Docker/README/交接文档可由一个 worker 负责。

合并前需要由主会话统一检查接口契约、路径安全和运行命令。
