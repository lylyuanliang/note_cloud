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
