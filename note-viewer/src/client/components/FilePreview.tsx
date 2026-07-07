import { Children, createElement, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { FileContent } from "../../shared/types";
import { api } from "../lib/api";
import { buildHeadingId, isInternalMarkdownLink } from "../lib/markdown";
import { resolveRelativePath } from "../lib/path";

type FilePreviewProps = {
  file?: FileContent;
  onNavigate: (path: string) => void;
  mapLocalPath?: (path: string) => string;
};

function isExternalResource(path: string) {
  return /^(https?:)?\/\//.test(path) || path.startsWith("mailto:");
}

function extractText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return extractText(child.props.children);
      }
      return "";
    })
    .join("");
}

export function FilePreview({ file, onNavigate, mapLocalPath }: FilePreviewProps) {
  if (!file) {
    return (
      <section className="preview preview--empty">
        <h2>暂无可预览内容</h2>
        <p>这个目录还没有说明文件，换一个目录或直接打开具体文件。</p>
      </section>
    );
  }

  const headingIds = new Map<string, number>();
  const createHeading = (tagName: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
    function Heading({ children, ...props }: { children?: ReactNode }) {
      const id = buildHeadingId(extractText(children), headingIds);
      return createElement(tagName, { ...props, id }, children);
    };

  const markdownComponents: Components = {
    a({ href, children, ...props }) {
      const target = mapLocalPath
        ? mapLocalPath(resolveRelativePath(file.path, href || ""))
        : resolveRelativePath(file.path, href || "");
      if (isInternalMarkdownLink(target)) {
        return (
          <button
            className="preview__link-button"
            type="button"
            onClick={() => onNavigate(target)}
          >
            {children}
          </button>
        );
      }
      return (
        <a
          {...props}
          href={target}
          target={isExternalResource(target) ? "_blank" : undefined}
          rel={isExternalResource(target) ? "noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
      const target = mapLocalPath
        ? mapLocalPath(resolveRelativePath(file.path, src || ""))
        : resolveRelativePath(file.path, src || "");
      const imageSrc = isExternalResource(target) ? target : api.assetUrl(target);
      return <img {...props} src={imageSrc} alt={alt || ""} loading="lazy" />;
    },
    h1: createHeading("h1"),
    h2: createHeading("h2"),
    h3: createHeading("h3"),
    h4: createHeading("h4"),
    h5: createHeading("h5"),
    h6: createHeading("h6")
  };

  return (
    <section className="preview">
      <header className="preview__header">
        <div>
          <p className="preview__eyebrow">{file.kind === "markdown" ? "笔记文档" : "文本文件"}</p>
          <h1>{file.name}</h1>
        </div>
        {file.updatedAt ? <time>{new Date(file.updatedAt).toLocaleString("zh-CN")}</time> : null}
      </header>

      {file.kind === "markdown" ? (
        <article className="preview__markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {file.content}
          </ReactMarkdown>
        </article>
      ) : (
        <pre className="preview__code">
          <code>{file.content}</code>
        </pre>
      )}
    </section>
  );
}
