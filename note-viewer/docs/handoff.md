# 笔记预览服务交接说明

## 先读文件

先读仓库根目录下的这些文件：

1. `docs/superpowers/specs/2026-07-07-note-viewer-design.md`
2. `docs/superpowers/plans/2026-07-07-note-viewer.md`
3. `docs/superpowers/specs/2026-07-07-note-viewer-performance-ui-design.md`
4. `docs/superpowers/plans/2026-07-07-note-viewer-performance-ui.md`
5. `note-viewer/README.md`
6. `note-viewer/docker-compose.yml`
7. `note-viewer/Dockerfile`

## Docker 运行说明

在仓库根目录下进入 `note-viewer/` 后执行：

```bash
docker compose up --build
```

服务默认监听容器内 `8080`，对外通常映射到宿主机 `8088`。构建镜像和启动容器都依赖 `note-viewer/Dockerfile`、`note-viewer/docker-compose.yml` 的当前内容。

## 只读挂载说明

`note-viewer/docker-compose.yml` 会把仓库根目录只读挂载到容器内 `/workspace`：

```yaml
volumes:
  - ..:/workspace:ro
```

容器内的主内容目录是 `/workspace/笔记`，因此所有浏览和扫描都必须以这个目录为准。不要在容器内假设仓库可写。

## Nginx `/notes/` 代理说明

如果前置 Nginx 把站点挂到 `/notes/`，需要把 `PUBLIC_BASE_PATH` 设为：

```yaml
environment:
  - PUBLIC_BASE_PATH=/notes/
```

对应的示例配置在仓库根目录下的 `note-viewer/docs/nginx-notes-location.conf`。代理层应把 `/notes/` 转发到容器根路径，避免前端静态资源和路由前缀错位。

## 环境变量

- `PUBLIC_BASE_PATH`：前端资源和路由的基础路径，默认用于根路径部署，挂到子路径时必须同步修改。
- `WATCH_USE_POLLING`：文件监听是否使用轮询。Docker Desktop 或文件事件不稳定时可临时设为 `true`，平时保持 `false`。

## 性能架构

后端通过 `note-viewer/src/server/services/repositoryStore.ts` 维护内存缓存：

- `getTree()` 返回缓存目录树。
- `search(query)` 在缓存搜索索引中检索。
- `refresh()` 重新扫描内容目录并重建搜索索引。
- `getPortalData()` 复用缓存目录树生成首页入口。

搜索索引由 `note-viewer/src/server/services/searchIndex.ts` 构建。当前只索引文件名、目录名、Markdown 一级标题和目录 README 一级标题，不做全文搜索。

`watchRepository.ts` 在文件变化后 debounce 调用 `store.refresh()`，刷新成功后再通过 SSE 广播 `tree-changed` 和 `file-changed`。

## 前端交互

- `App.tsx` 会缓存已加载的目录树，切换文件时不会重复调用 `/api/tree`。
- `DirectoryTree.tsx` 支持目录节点展开/折叠，并自动展开当前路径的祖先目录。
- `Workspace.tsx` 支持整体收起左侧目录。
- `SearchBox.tsx` 会忽略过期搜索响应，避免旧结果覆盖新查询。
- 主题模式保存在 `localStorage` 的 `note-viewer-theme-mode`，支持 `system`、`light`、`dark`。

## 补充边界

- 仓库根目录只读挂载到 `/workspace`。
- 主导航只扫描 `/workspace/笔记`。
- 所有浏览器传入路径都必须走 `safePath`。
- 前端 URL 必须支持 `PUBLIC_BASE_PATH`。
- 第一版没有写 API。
- 缓存刷新失败时应保留上一份可用缓存，不应把空状态推给用户。

## 验证命令

```bash
npm run typecheck
npm test
npm run build
docker compose up --build
```

当前 Windows/Docker Desktop 环境可能因为 Docker Hub token 获取超时导致 `docker compose up --build` 无法拉取 `node:20-alpine`。遇到这种情况不要宣称 Docker 构建通过，应记录具体网络错误。

## 关键边界

- 所有路径说明都以仓库根目录为参照，不要把 `docs/superpowers/...` 误读成别的目录。
- `note-viewer` 只负责读取内容和展示，不应假设容器内有额外写权限。
- 代理到 `/notes/` 时，`PUBLIC_BASE_PATH`、Nginx 路径和前端构建结果必须一致。
