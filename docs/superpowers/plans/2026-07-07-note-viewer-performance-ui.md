# Note Viewer Performance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `note-viewer` fast for search and file preview, add collapsible navigation, theme switching, and a more restrained tool-style UI.

**Architecture:** Add a server-side in-memory repository store that owns the cached tree and search index. Update client navigation to reuse the already-loaded tree and add local UI state for directory expansion, sidebar visibility, and theme mode.

**Tech Stack:** Node.js, Express, React 18, Vite, Vitest, TypeScript, CSS variables, Docker Compose.

## Global Constraints

- Preserve Docker deployment and read-only repository mount.
- Keep the visualized content rooted at `CONTENT_ROOT`; do not weaken `safePath` protections.
- Search only file names, directory names, Markdown first headings, and README first headings; do not implement full-text search in this iteration.
- Do not add a database or external search engine dependency.
- UI copy shown to the user should remain Chinese where it is natural; code identifiers and technical strings may remain English.
- Follow TDD: write or update failing tests before production code changes.
- Keep generated dependencies and build outputs ignored by git.
- After sub agent results are integrated, close agents that are no longer needed.

---

## File Structure

- Create `note-viewer/src/server/services/repositoryStore.ts`: cache tree, path lookup, search index, refresh lifecycle.
- Modify `note-viewer/src/server/services/searchIndex.ts`: pure search-index builder and in-memory search helpers.
- Modify `note-viewer/src/server/routes/tree.ts`: serve cached tree from store.
- Modify `note-viewer/src/server/routes/search.ts`: serve cached search results from store.
- Modify `note-viewer/src/server/routes/portal.ts`: reuse cached tree from store.
- Modify `note-viewer/src/server/services/watchRepository.ts`: refresh store before broadcasting changes.
- Modify `note-viewer/src/server/app.ts` and `note-viewer/src/server/index.ts`: create and pass `RepositoryStore`.
- Modify `note-viewer/src/server/**/*.test.ts`: cover cache, search, and route behavior.
- Modify `note-viewer/src/client/App.tsx`: avoid reloading tree on every path change; manage theme state.
- Modify `note-viewer/src/client/components/Workspace.tsx`: add sidebar collapse and theme control props.
- Modify `note-viewer/src/client/components/DirectoryTree.tsx`: add node expand/collapse behavior.
- Modify `note-viewer/src/client/components/SearchBox.tsx`: prevent stale search responses.
- Modify `note-viewer/src/client/styles/base.css`: add theme variables and restrained tool-style UI.
- Modify or add client tests for navigation, directory tree, search request ordering, and theme application.
- Update `note-viewer/README.md` and `note-viewer/docs/handoff.md` if behavior or usage changes.

---

### Task 1: Server Repository Store and Cached Search

**Files:**
- Create: `note-viewer/src/server/services/repositoryStore.ts`
- Modify: `note-viewer/src/server/services/searchIndex.ts`
- Modify: `note-viewer/src/server/routes/tree.ts`
- Modify: `note-viewer/src/server/routes/search.ts`
- Modify: `note-viewer/src/server/routes/portal.ts`
- Modify: `note-viewer/src/server/app.ts`
- Modify: `note-viewer/src/server/index.ts`
- Test: `note-viewer/src/server/services/repositoryStore.test.ts`
- Test: `note-viewer/src/server/services/searchIndex.test.ts`
- Test: `note-viewer/src/server/app.test.ts`

**Interfaces:**
- Produces: `createRepositoryStore(config: ViewerConfig): RepositoryStore`
- Produces: `RepositoryStore.getTree(): Promise<TreeNode>`
- Produces: `RepositoryStore.search(query: string): Promise<SearchResult[]>`
- Produces: `RepositoryStore.refresh(): Promise<void>`
- Produces: `RepositoryStore.getPortalData(): Promise<PortalData>`
- Consumes: existing `scanTree(config)`, `readTextFile(path, config)`, and `readRepoReadme(config)`.

- [ ] **Step 1: Write failing repository store cache tests**

Add `note-viewer/src/server/services/repositoryStore.test.ts` with tests that create a temporary content root, build a store, call `getTree()` twice, and assert the second call returns cached data without a second scan. Mock `scanRepository` with `vi.mock("./scanRepository", ...)` and count calls.

Run:

```powershell
cd note-viewer
npm test -- src/server/services/repositoryStore.test.ts
```

Expected: FAIL because `repositoryStore.ts` does not exist.

- [ ] **Step 2: Implement minimal `RepositoryStore`**

Create `repositoryStore.ts` with:

```ts
export type RepositoryStore = {
  getTree(): Promise<TreeNode>;
  search(query: string): Promise<SearchResult[]>;
  refresh(): Promise<void>;
  getPortalData(): Promise<PortalData>;
};
```

Use private cached state and a shared `refreshPromise` so concurrent calls do not run duplicate refreshes.

- [ ] **Step 3: Write failing cached search tests**

Update `searchIndex.test.ts` to test a pure in-memory search helper:

- directory name match
- file name match
- heading match
- empty query returns `[]`
- result limit remains 50

Run:

```powershell
npm test -- src/server/services/searchIndex.test.ts
```

Expected: FAIL until `searchIndex.ts` exposes pure builder/search functions.

- [ ] **Step 4: Refactor `searchIndex.ts`**

Replace request-time tree walking with pure functions:

```ts
export type SearchIndexEntry = {
  title: string;
  path: string;
  type: "file" | "directory";
  snippet?: string;
  haystack: string;
};

export async function buildSearchIndex(tree: TreeNode, config: ViewerConfig): Promise<SearchIndexEntry[]>;
export function searchIndex(query: string, index: SearchIndexEntry[]): SearchResult[];
```

`buildSearchIndex` may read Markdown/overview headings once during refresh. `searchIndex` must not read files.

- [ ] **Step 5: Update routes and app wiring**

Change route factories to accept `RepositoryStore`:

```ts
createTreeRouter(store)
createSearchRouter(store)
createPortalRouter(store)
```

Update `createApp(config, store = createRepositoryStore(config))` so tests can pass a store.

- [ ] **Step 6: Update server startup and watcher integration**

In `index.ts`, create one store and pass it to `createApp`. Pass the store refresh callback to watcher.

Change watcher to debounce:

```ts
await onRepositoryChanged();
emit("tree-changed");
emit("file-changed");
```

If refresh fails, emit an error log and keep the previous cache.

- [ ] **Step 7: Run server tests**

Run:

```powershell
npm test -- src/server/services/repositoryStore.test.ts src/server/services/searchIndex.test.ts src/server/app.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add note-viewer/src/server
git commit -m "perf: cache note viewer repository data"
```

---

### Task 2: Client Navigation, Search Ordering, and Collapsible Tree

**Files:**
- Modify: `note-viewer/src/client/App.tsx`
- Modify: `note-viewer/src/client/components/SearchBox.tsx`
- Modify: `note-viewer/src/client/components/DirectoryTree.tsx`
- Modify: `note-viewer/src/client/components/Workspace.tsx`
- Test: add or update client component tests under `note-viewer/src/client/components/*.test.tsx`

**Interfaces:**
- Consumes: existing `api.tree()`, `api.file()`, `api.search()`.
- Produces: `DirectoryTree` props include `selectedPath`, `onSelect`, and internal expand/collapse state.
- Produces: `Workspace` props include `sidebarCollapsed`, `onToggleSidebar`, `themeMode`, and `onThemeModeChange`.

- [ ] **Step 1: Add test dependencies if missing**

Check whether React component tests already run. If no DOM test utilities exist, add `@testing-library/react`, `@testing-library/user-event`, and `jsdom` as dev dependencies, then commit them only with the task.

- [ ] **Step 2: Write failing App navigation test**

Test that after the first workspace load, selecting another path reuses the existing tree and does not call `api.tree()` again.

Run:

```powershell
npm test -- src/client
```

Expected: FAIL because current `refreshWorkspace()` always calls `loadTree()`.

- [ ] **Step 3: Update `App.tsx` navigation flow**

Use existing `tree` state when available:

```ts
const nextTree = existingTree || treeRef.current || (await loadTree());
```

Maintain `treeRef` similarly to `viewRef`. On `tree-changed`, refresh tree once and reuse the returned tree to refresh the current workspace.

- [ ] **Step 4: Write failing SearchBox stale-response test**

Mock two `api.search` calls where the first resolves after the second. Assert results shown belong to the latest query.

Expected: FAIL because old responses can overwrite new results.

- [ ] **Step 5: Fix SearchBox stale responses**

Use an incrementing request id or `AbortController`. Only apply results if the response belongs to the latest request and the component is still mounted.

- [ ] **Step 6: Write failing DirectoryTree collapse tests**

Test:

- a directory can collapse and hide children;
- clicking a file still calls `onSelect(fileNode)`;
- selected path ancestors are expanded automatically.

Expected: FAIL because the tree is currently always expanded.

- [ ] **Step 7: Implement DirectoryTree node expansion**

Add `expandedPaths` state. Directory row click should select the directory; a separate small disclosure button toggles expansion. Current path ancestors should be added to `expandedPaths` in an effect.

- [ ] **Step 8: Add sidebar collapse state**

In `App.tsx`, add `sidebarCollapsed` persisted to `localStorage`. Pass it to `Workspace`. In `Workspace`, add a toolbar icon/text button labeled `目录` or `收起目录` and apply `workspace__body--sidebar-collapsed`.

- [ ] **Step 9: Run client tests**

Run:

```powershell
npm test -- src/client
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add note-viewer/package.json note-viewer/package-lock.json note-viewer/src/client
git commit -m "feat: improve note viewer navigation"
```

---

### Task 3: Theme Switching and Tool-Style UI

**Files:**
- Modify: `note-viewer/src/client/App.tsx`
- Modify: `note-viewer/src/client/components/Workspace.tsx`
- Modify: `note-viewer/src/client/styles/base.css`
- Test: client theme tests if component test setup exists

**Interfaces:**
- Produces: theme modes `"light" | "dark" | "system"`.
- Produces: document root attribute `data-theme="light"` or `data-theme="dark"`.
- Persists selected mode under `note-viewer-theme-mode`.

- [ ] **Step 1: Write failing theme persistence test**

Test that choosing dark mode stores `note-viewer-theme-mode=dark` and applies `document.documentElement.dataset.theme = "dark"`.

Run:

```powershell
npm test -- src/client
```

Expected: FAIL because theme control does not exist.

- [ ] **Step 2: Implement theme state and control**

Add theme state in `App.tsx`:

```ts
type ThemeMode = "light" | "dark" | "system";
```

Resolve system mode with `window.matchMedia("(prefers-color-scheme: dark)")`. Add a compact select or segmented control in the workspace toolbar.

- [ ] **Step 3: Rewrite CSS variables for light/dark**

Use CSS variables for:

- page background
- panels
- borders
- text
- muted text
- accent
- active row
- code block
- danger

Keep radii at 8px or less.

- [ ] **Step 4: Reduce template feel**

Adjust layout:

- make header more compact;
- reduce large card feel;
- make workspace dominant;
- keep portal simple and functional;
- improve tree row density and active states;
- ensure markdown tables/code/blockquote are readable in both themes.

- [ ] **Step 5: Run visual and build checks**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add note-viewer/src/client
git commit -m "feat: add note viewer themes"
```

---

### Task 4: Documentation, Runtime Verification, and Docker Check

**Files:**
- Modify: `note-viewer/README.md`
- Modify: `note-viewer/docs/handoff.md`
- Optional Modify: `note-viewer/docs/nginx-notes-location.conf` only if runtime behavior changes.

**Interfaces:**
- Documents search scope, theme modes, sidebar behavior, and cache refresh behavior.

- [ ] **Step 1: Update Chinese user docs**

Update README with:

- Docker command
- local dev command
- search scope
- theme behavior
- sidebar collapse behavior
- note that file changes rebuild in-memory cache automatically

- [ ] **Step 2: Update handoff doc**

Record:

- new store architecture
- modified files
- test commands
- known Docker Hub/network caveat if still present

- [ ] **Step 3: Run full verification**

Run:

```powershell
cd note-viewer
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 4: Docker verification**

If Docker Hub access works:

```powershell
docker compose up --build
```

Verify:

- open `http://localhost:8088`
- search returns quickly
- clicking files no longer pauses on tree reload
- theme switch works
- sidebar and tree collapse work

If Docker Hub access fails at `node:20-alpine` token fetch, record the exact network error and do not claim Docker build passes.

- [ ] **Step 5: Commit**

```powershell
git add note-viewer/README.md note-viewer/docs
git commit -m "docs: update note viewer usage"
```

---

## Final Verification

Run from `note-viewer`:

```powershell
npm run typecheck
npm test
npm run build
```

Run from repo root:

```powershell
git status --short --branch
```

If implementation used a worktree, merge back to `main`, rerun the verification commands on `main`, remove the worktree, delete the feature branch, and close completed sub agents.
