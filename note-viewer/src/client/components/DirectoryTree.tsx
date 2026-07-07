import type { TreeNode } from "../../shared/types";

type DirectoryTreeProps = {
  tree: TreeNode;
  selectedPath: string;
  onSelect: (node: TreeNode) => void;
};

function TreeBranch({
  node,
  selectedPath,
  onSelect,
  depth
}: {
  node: TreeNode;
  selectedPath: string;
  onSelect: (node: TreeNode) => void;
  depth: number;
}) {
  const isSelected =
    node.path === selectedPath || (node.type === "directory" && selectedPath.startsWith(`${node.path}/`));

  return (
    <li className="tree__item">
      <button
        className={`tree__button ${isSelected ? "is-active" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        type="button"
        onClick={() => onSelect(node)}
      >
        <span className="tree__icon" aria-hidden="true">
          {node.type === "directory" ? "▾" : "•"}
        </span>
        <span className="tree__label">{node.name}</span>
      </button>
      {node.type === "directory" && node.children && node.children.length > 0 ? (
        <ul className="tree__list">
          {node.children.map((child) => (
            <TreeBranch
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function DirectoryTree({ tree, selectedPath, onSelect }: DirectoryTreeProps) {
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
          />
        ))}
      </ul>
    </div>
  );
}
