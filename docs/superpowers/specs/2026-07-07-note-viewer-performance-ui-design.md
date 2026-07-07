# Note Viewer 性能与界面优化设计

## 背景

`note-viewer` 已经可以通过 Docker/Nginx 访问真实目录结构下的 Markdown 和文本笔记。当前实际使用中暴露出 5 个问题：

- 搜索慢。
- 点击文件继续预览慢。
- 缺少浅色/暗色/跟随系统主题切换。
- UI 有模板感，需要更像本地知识库/文档阅读器工具。
- 左侧目录不能按节点收缩，也不能整体收起。

当前实测中，`/api/tree` 约 2.7 秒，`/api/search?q=docker` 约 4.2 秒；单独 `/api/file` 约 0.22 秒。主要瓶颈不是单文件读取，而是请求路径上重复全量扫描目录树和逐文件读取 Markdown 标题。

## 目标

本次优化要让 `note-viewer` 更适合日常长时间使用：

- 搜索响应从秒级降到内存检索级别。
- 点击文件时不再重复全量扫描目录树。
- 文件变化后仍能自动同步目录树、搜索索引和当前预览。
- 左侧目录支持节点展开/折叠，当前路径自动展开祖先。
- 左侧 sidebar 支持整体收起/展开。
- 支持浅色、暗色、跟随系统三种主题模式。
- UI 改成克制、紧凑、工具型的知识库阅读体验。

## 非目标

- 本次不做全文搜索，只搜索文件名、目录名、Markdown 一级标题和 README 一级标题。
- 本次不引入数据库、Elasticsearch、Lunr、Fuse 等额外搜索引擎。
- 本次不做多用户权限、编辑、在线保存或同步。
- 本次不改变 Docker 挂载方式，仍由外部仓库目录只读挂载到容器。

## 后端设计

新增一个服务端内存 `RepositoryStore`，集中管理仓库视图：

- 启动或首次访问时扫描 `CONTENT_ROOT`，生成目录树缓存。
- 同步生成搜索索引，索引项包括 `path`、`type`、`title`、`name`、`snippet` 和预归一化的小写字段。
- `/api/tree` 返回缓存目录树，不再每次扫描文件系统。
- `/api/search` 在内存索引中搜索，不再每次读 Markdown 文件。
- `/api/portal` 复用缓存目录树和已有 `README.md` 读取逻辑。
- watcher 收到文件变化后 debounce 重建缓存，并广播变化事件。

第一版采用 debounce 后全量重建缓存，而不是复杂增量更新。理由是当前文件规模不大，全量重建从请求路径移到后台后，用户交互不会被每次请求阻塞，实现也更可靠。

## 前端设计

前端改造重点是减少无效请求和增强目录交互：

- workspace 首次进入时加载一次目录树。
- 点击目录树节点、搜索结果或 Markdown 内部链接时，优先复用已有目录树。
- 只有目录树不存在、路径找不到或收到 `tree-changed` 事件后，才刷新目录树。
- 搜索输入使用 request id 或 `AbortController` 防止旧请求覆盖新结果。
- `DirectoryTree` 管理展开状态；当前选中路径的祖先目录自动展开。
- `Workspace` 管理 sidebar 收起状态，并写入 `localStorage`。
- 主题模式保存在 `localStorage`，支持 `light`、`dark`、`system`。

## UI 设计方向

界面风格定位为本地知识库、文件管理器和文档阅读器的组合：

- 避免营销式 hero、大面积渐变、装饰图形和过大的卡片。
- 保持信息密度，目录、搜索、预览是主角。
- 色彩克制，浅色主题使用中性背景和清晰边界；暗色主题保证代码块、表格、链接和 active 状态可读。
- 顶部工具栏提供返回、路径、搜索、主题切换和 sidebar 收起控制。
- 移动端保持单列布局，sidebar 收起按钮仍可用。

## 数据流

启动或首次访问：

```text
RepositoryStore.ensureReady()
-> scanTree(config)
-> buildSearchIndex(tree, config)
-> cache tree + index + generatedAt
```

搜索：

```text
SearchBox
-> GET /api/search?q=...
-> RepositoryStore.search(query)
-> filter cached index
-> return first 50 results
```

打开文件：

```text
User selects path
-> App reuses cached client tree
-> resolve file/overview path
-> GET /api/file?path=...
-> render preview
```

文件变化：

```text
chokidar event
-> debounce
-> RepositoryStore.refresh()
-> SSE tree-changed/file-changed
-> client refreshes tree/file only when needed
```

## 测试要求

后端：

- `/api/tree` 多次调用应复用缓存，避免重复扫描。
- `/api/search` 应使用缓存索引并返回文件名、目录名、标题匹配。
- watcher refresh 后搜索结果和树应更新。

前端：

- 切换文件时已有 tree 不应重复调用 `api.tree()`。
- 搜索旧请求不能覆盖新请求。
- 目录节点可以展开/折叠，当前路径祖先自动展开。
- 主题模式能保存并应用到 document root。

验证命令：

```powershell
cd note-viewer
npm run typecheck
npm test
npm run build
```

Docker 验证在 Docker Hub 访问可用时执行：

```powershell
cd note-viewer
docker compose up --build
```

## 交接要求

实现期间如果任务中断，应留下以下信息：

- 当前分支和 worktree 路径。
- 已完成任务和对应 commit。
- 未完成任务。
- 关键文件。
- 已运行验证命令和结果。
- 已知风险。
