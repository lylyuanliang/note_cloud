# 笔记可视化预览服务

这是当前仓库的可视化笔记预览服务。它以真实目录结构为准，从 `笔记/` 目录读取 Markdown 和文本文件，并通过浏览器提供门户首页、目录树、文件预览和搜索。

服务端会在内存中缓存目录树和搜索索引。文件变化后，监听器会自动刷新缓存并通知浏览器更新，不需要手动重新扫描。

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

## 使用说明

### 搜索范围

当前搜索只覆盖：

- 文件名
- 目录名
- Markdown 一级标题
- 目录 README 的一级标题

这一版不做全文搜索，目的是保持搜索响应足够快。

### 目录和预览

- 左侧目录按真实文件系统结构展示。
- 目录节点可以展开或折叠。
- 当前打开文件的祖先目录会自动展开。
- 工作区可以整体收起左侧目录，状态会保存在浏览器本地。
- 点击文件或 Markdown 内部链接时，会复用已加载的目录树，不会每次重新扫描整个仓库。

### 主题

工作区支持三种主题模式：

- 跟随系统
- 浅色
- 暗色

主题设置会保存在浏览器本地。

## 本地开发

```bash
npm install
npm run dev
```

如果只想验证生产构建：

```bash
npm run build
npm start
```

## 验证命令

```bash
npm run typecheck
npm test
npm run build
docker compose up --build
```
