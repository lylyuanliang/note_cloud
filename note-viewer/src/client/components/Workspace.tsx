import type { FileContent, TreeNode } from "../../shared/types";
import { Breadcrumbs } from "./Breadcrumbs";
import { DirectoryTree } from "./DirectoryTree";
import { FilePreview } from "./FilePreview";
import { SearchBox } from "./SearchBox";

type WorkspaceProps = {
  initialPath: string;
  currentFile?: FileContent;
  tree?: TreeNode;
  loading: boolean;
  error?: string;
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark" | "system";
  onBackHome: () => void;
  onOpenPath: (path: string) => void;
  onSelectNode: (node: TreeNode) => void;
  onToggleSidebar: () => void;
  onThemeModeChange: (mode: "light" | "dark" | "system") => void;
};

export function Workspace({
  initialPath,
  currentFile,
  tree,
  loading,
  error,
  sidebarCollapsed,
  themeMode,
  onBackHome,
  onOpenPath,
  onSelectNode,
  onToggleSidebar,
  onThemeModeChange
}: WorkspaceProps) {
  return (
    <section className="workspace">
      <header className="workspace__toolbar">
        <div className="workspace__toolbar-main">
          <div className="workspace__actions">
            <button className="workspace__back" type="button" onClick={onBackHome}>
              返回首页
            </button>
            <button className="workspace__back" type="button" onClick={onToggleSidebar}>
              {sidebarCollapsed ? "显示目录" : "收起目录"}
            </button>
          </div>
          <Breadcrumbs path={initialPath} onNavigate={onOpenPath} />
        </div>
        <div className="workspace__tools">
          <label className="theme-switcher">
            <span>主题</span>
            <select
              value={themeMode}
              onChange={(event) => onThemeModeChange(event.target.value as "light" | "dark" | "system")}
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">暗色</option>
            </select>
          </label>
          <SearchBox onOpenPath={onOpenPath} />
        </div>
      </header>

      <div className={`workspace__body ${sidebarCollapsed ? "workspace__body--sidebar-collapsed" : ""}`}>
        <aside className="workspace__sidebar" aria-hidden={sidebarCollapsed}>
          {tree ? (
            <DirectoryTree tree={tree} selectedPath={initialPath} onSelect={onSelectNode} />
          ) : (
            <div className="state-banner">正在加载目录树...</div>
          )}
        </aside>

        <div className="workspace__content">
          {error ? <div className="state-banner state-banner--error">{error}</div> : null}
          {loading ? <div className="state-banner">正在加载内容...</div> : null}
          {!loading ? <FilePreview file={currentFile} onNavigate={onOpenPath} /> : null}
        </div>
      </div>
    </section>
  );
}
