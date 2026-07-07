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
