import { useEffect, useState } from "react";
import type { TreeNode } from "../../shared/types";

type DirectoryTreeProps = {
  tree: TreeNode;
  selectedPath: string;
  onSelect: (node: TreeNode) => void;
};

function collectDirectoryPaths(node: TreeNode, paths = new Set<string>()): Set<string> {
  if (node.type === "directory" && node.path) {
    paths.add(node.path);
  }
  for (const child of node.children || []) {
    collectDirectoryPaths(child, paths);
  }
  return paths;
}

function selectedAncestorPaths(selectedPath: string): string[] {
  const segments = selectedPath.split("/").filter(Boolean);
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
}

function TreeBranch({
  node,
  selectedPath,
  onSelect,
  depth,
  expandedPaths,
  onToggle
}: {
  node: TreeNode;
  selectedPath: string;
  onSelect: (node: TreeNode) => void;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (node: TreeNode) => void;
}) {
  const isSelected =
    node.path === selectedPath || (node.type === "directory" && selectedPath.startsWith(`${node.path}/`));
  const hasChildren = node.type === "directory" && Boolean(node.children?.length);
  const isExpanded = !node.path || expandedPaths.has(node.path);

  return (
    <li className="tree__item">
      <div className={`tree__row ${isSelected ? "is-active" : ""}`} style={{ paddingLeft: `${depth * 14 + 8}px` }}>
        {hasChildren ? (
          <button
            className="tree__toggle"
            type="button"
            aria-label={`${isExpanded ? "折叠" : "展开"} ${node.name}`}
            aria-expanded={isExpanded}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node);
            }}
          >
            <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
          </button>
        ) : (
          <span className="tree__toggle tree__toggle--placeholder" aria-hidden="true">
            •
          </span>
        )}
        <button
          className="tree__button"
          type="button"
          onClick={() => onSelect(node)}
        >
          <span className="tree__label">{node.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ul className="tree__list">
          {(node.children ?? []).map((child) => (
            <TreeBranch
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function DirectoryTree({ tree, selectedPath, onSelect }: DirectoryTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => collectDirectoryPaths(tree));

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      for (const path of selectedAncestorPaths(selectedPath)) {
        next.add(path);
      }
      return next;
    });
  }, [selectedPath]);

  const handleToggle = (node: TreeNode) => {
    if (!node.path) {
      return;
    }
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }
      return next;
    });
  };

  return (
    <div className="tree">
      <div className="tree__header">
        <h2>目录</h2>
        <p>按真实目录结构浏览</p>
      </div>
      <ul className="tree__list">
        {tree.children?.map((child) => (
          <TreeBranch
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
          />
        ))}
      </ul>
    </div>
  );
}
