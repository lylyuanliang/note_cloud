import type { PortalData } from "../../shared/types";
import { FilePreview } from "./FilePreview";
import { SearchBox } from "./SearchBox";

type PortalHomeProps = {
  data?: PortalData;
  loading: boolean;
  error?: string;
  onOpenPath: (path: string) => void;
};

export function PortalHome({ data, loading, error, onOpenPath }: PortalHomeProps) {
  const mapRepoReadmePath = (path: string) => path.replace(/^笔记\//, "");

  return (
    <section className="portal">
      <div className="portal__hero">
        <div>
          <p className="portal__eyebrow">首页门户</p>
          <h1>知识库工作台</h1>
          <p className="portal__intro">
            从常用入口、目录树和全文检索进入笔记，保持和仓库目录一致。
          </p>
        </div>
        <SearchBox onOpenPath={onOpenPath} />
      </div>

      {error ? <div className="state-banner state-banner--error">{error}</div> : null}
      {loading ? <div className="state-banner">正在加载首页数据...</div> : null}

      <div className="portal__section">
        <div className="portal__section-title">
          <h2>常用入口</h2>
          <p>直接进入高频目录和专题。</p>
        </div>
        <div className="portal__grid">
          {data?.entryCards.map((entry) => (
            <button
              key={entry.path}
              className="portal-card"
              type="button"
              onClick={() => onOpenPath(entry.path)}
            >
              <span className={`portal-card__tag portal-card__tag--${entry.kind}`}>
                {entry.kind === "top-level" ? "顶层目录" : "专题入口"}
              </span>
              <strong>{entry.title}</strong>
              <span className="portal-card__path">{entry.path}</span>
              <span className="portal-card__description">
                {entry.description || "打开对应目录或说明文件"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {data?.repoReadme ? (
        <div className="portal__section">
          <div className="portal__section-title">
            <h2>仓库简介</h2>
            <p>显示仓库顶层说明文档，便于快速理解内容范围。</p>
          </div>
          <FilePreview
            file={data.repoReadme}
            onNavigate={onOpenPath}
            mapLocalPath={mapRepoReadmePath}
          />
        </div>
      ) : null}
    </section>
  );
}
