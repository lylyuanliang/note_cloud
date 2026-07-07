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
  onBackHome: () => void;
  onOpenPath: (path: string) => void;
  onSelectNode: (node: TreeNode) => void;
};

export function Workspace({
  initialPath,
  currentFile,
  tree,
  loading,
  error,
  onBackHome,
  onOpenPath,
  onSelectNode
}: WorkspaceProps) {
  return (
    <section className="workspace">
      <header className="workspace__toolbar">
        <div className="workspace__toolbar-main">
          <button className="workspace__back" type="button" onClick={onBackHome}>
            返回首页
          </button>
          <Breadcrumbs path={initialPath} onNavigate={onOpenPath} />
        </div>
        <SearchBox onOpenPath={onOpenPath} />
      </header>

      <div className="workspace__body">
        <aside className="workspace__sidebar">
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
