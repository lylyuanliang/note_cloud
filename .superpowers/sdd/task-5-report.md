STATUS: DONE_WITH_CONCERNS

Task: Task 5 - 实现 React 首页门户和工作台
Branch: feature/note-viewer
Commit: 7ac286d99b990b291ee522ac7f0d5805164faef7

修改文件:
- note-viewer/src/client/App.tsx
- note-viewer/src/client/styles/base.css
- note-viewer/src/client/lib/api.ts
- note-viewer/src/client/lib/path.ts
- note-viewer/src/client/components/PortalHome.tsx
- note-viewer/src/client/components/Workspace.tsx
- note-viewer/src/client/components/DirectoryTree.tsx
- note-viewer/src/client/components/Breadcrumbs.tsx
- note-viewer/src/client/components/FilePreview.tsx
- note-viewer/src/client/components/SearchBox.tsx

实现摘要:
- 新增运行期 base-path 感知的前端 API client，统一走 `window.__NOTE_VIEWER_CONFIG__`。
- 新增路径解析工具，支持 Markdown 相对路径解析。
- 实现首页门户、全局搜索、工作台、目录树、面包屑和文件预览组件。
- `App.tsx` 接入 portal/tree/file/search/events API，支持首页到工作台跳转、目录默认说明文件、Markdown 内部跳转和 SSE 刷新。
- `FilePreview.tsx` 使用 `react-markdown` + `remark-gfm`，未启用 raw HTML；Markdown 图片走 asset API。
- `PortalHome.tsx` 对仓库根 README 中的 `./笔记/...` 链接做映射，避免进入工作台时多出一层 `笔记/`。
- `base.css` 更新为首页门户 + 两栏工作台布局，包含移动端堆叠、独立树滚动区、代码横向滚动和预览宽度控制。

命令结果:
1. `cd note-viewer && npm run typecheck`
   - 结果: exit 0
   - 关键信息: `tsc -p tsconfig.json --noEmit` 成功，无类型错误。

2. `cd note-viewer && npm run build`
   - 结果: exit 0
   - 关键信息:
     - `vite build` 成功，产出 `dist/client`
     - `tsup src/server/index.ts ...` 成功，产出 `dist/server/index.js`
     - 构建输出包含一条非阻断提示: `script src="./runtime-config.js" in "/index.html" can't be bundled without type="module" attribute`

3. `git commit -m "feat: add note viewer interface"`
   - 结果: 已提交，后续 amend 后最终 commit 为 `7ac286d99b990b291ee522ac7f0d5805164faef7`

self-review:
- API URL 没有硬编码 `/api` 根路径，统一由运行期 base path 拼接。
- 首页门户、工作台、目录树、搜索、文件预览、SSE 刷新都已接入。
- 目录节点点击时会优先加载 `overviewPath`；无说明文件时展示空态。
- Markdown 未启用 `rehype-raw`，满足 raw HTML 禁用要求。
- 图片资源通过 `api.assetUrl(...)` 重写；Markdown 内部 `.md` 链接走应用内跳转。
- README 首页预览的 repo-relative 链接已做 `笔记/` 前缀映射，避免和 `CONTENT_ROOT` 语义冲突。

concerns:
- 构建虽然成功，但 Vite 仍对 `index.html` 里的 `./runtime-config.js` 输出一条非阻断提示。这次未修改 `index.html`/`vite.config.ts`，因此保留为已知项。
- 本次按任务要求完成了 `typecheck/build`，但没有启动浏览器做人工交互验证，所以 SSE 实时刷新和移动端最终视觉效果只经过代码与构建层面确认，未做现场点检。

---

## Task 5 Review Fix

STATUS: FIXED

修复范围:
- `note-viewer/src/client/App.tsx`
- `note-viewer/src/client/components/FilePreview.tsx`
- `note-viewer/src/client/lib/markdown.ts`
- `note-viewer/src/client/lib/markdown.test.ts`

修复内容:
- 为 Markdown 标题生成稳定 id，并对重复标题追加序号，恢复同页 `#...` 锚点跳转。
- 将跨文档 `xxx.md#section` 和 `.md?query#hash` 识别为应用内 Markdown 链接；导航时拆分出真实文件路径与 anchor，避免把 hash/query 带入文件加载。
- 保持同页锚点链接为普通 `<a href="#...">`，不再误当外链打开新窗口。
- 将可见文案中的 `Note Viewer` 改为 `笔记预览器`，将 Markdown 文件 badge 改为 `笔记文档`。
- 新增纯函数回归测试，覆盖内部 Markdown 链接识别、导航目标拆分和标题 id 生成规则。

验证结果:
1. `cd note-viewer && npm test -- src/client/lib/markdown.test.ts`
   - 结果: exit 0
   - 关键信息: 3 个新增回归测试全部通过。
2. `cd note-viewer && npm run typecheck`
   - 结果: exit 0
3. `cd note-viewer && npm run build`
   - 结果: exit 0
   - 关键信息: client/server 构建成功；仍保留既有非阻断提示 `runtime-config.js` 无 `type="module"`。

fix concerns:
- 本次没有启动浏览器做手工点击验证，因此跨文档锚点滚动行为依赖代码路径和回归测试确认，未做页面级现场点检。
