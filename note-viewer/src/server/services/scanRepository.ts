import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { PortalData, TreeNode, ViewerConfig } from "../../shared/types";
import { isIgnoredPath, toPosixPath } from "../security/safePath";
import { getFileKindByName, readRepoReadme } from "./readContent";

const overviewNames = ["readme.md", "README.md", "Readme.md"];

async function isInsideContentRoot(absolutePath: string, contentRootReal: string): Promise<boolean> {
  const candidateReal = await realpath(absolutePath);
  const relative = path.relative(contentRootReal, candidateReal);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function selectOverviewName(entries: string[]): string | undefined {
  const names = new Set(entries);
  return overviewNames.find((name) => names.has(name));
}

async function findOverview(absoluteDir: string, relativeDir: string): Promise<string | undefined> {
  const overviewName = selectOverviewName(await readdir(absoluteDir));
  if (!overviewName) {
    return undefined;
  }
  return toPosixPath(path.posix.join(relativeDir, overviewName));
}

async function scanNode(
  absolutePath: string,
  relativePath: string,
  contentRootReal: string
): Promise<TreeNode | undefined> {
  if (relativePath && isIgnoredPath(relativePath)) {
    return undefined;
  }

  const info = await lstat(absolutePath);
  if (info.isSymbolicLink()) {
    return undefined;
  }
  if (!(await isInsideContentRoot(absolutePath, contentRootReal))) {
    return undefined;
  }

  const safeRelativePath = toPosixPath(relativePath);
  const name = relativePath ? path.basename(relativePath) : "笔记";

  if (info.isDirectory()) {
    const entries = await readdir(absolutePath);
    const children: TreeNode[] = [];

    for (const entry of entries.sort((a, b) => a.localeCompare(b, "zh-CN"))) {
      const childRelative = toPosixPath(path.posix.join(safeRelativePath, entry));
      const child = await scanNode(path.join(absolutePath, entry), childRelative, contentRootReal);
      if (child) {
        children.push(child);
      }
    }

    return {
      name,
      path: safeRelativePath,
      type: "directory",
      overviewPath: await findOverview(absolutePath, safeRelativePath),
      updatedAt: info.mtime.toISOString(),
      children
    };
  }

  const fileKind = getFileKindByName(relativePath);
  if (fileKind === "unsupported" || fileKind === "image") {
    return undefined;
  }

  return {
    name,
    path: safeRelativePath,
    type: "file",
    fileKind,
    updatedAt: info.mtime.toISOString()
  };
}

export async function scanTree(config: ViewerConfig): Promise<TreeNode> {
  const contentRootReal = await realpath(config.contentRoot);
  const root = await scanNode(contentRootReal, "", contentRootReal);
  if (!root) {
    throw new Error("无法扫描内容目录");
  }
  return root;
}

export async function buildPortalData(config: ViewerConfig): Promise<PortalData> {
  const tree = await scanTree(config);
  const known = new Map<string, string>([
    ["学习记录", "学习记录"],
    ["教程", "教程"],
    ["Docker Compose 样例", "学习记录/docker/1.docker-compose文件样例"],
    ["设计模式", "学习记录/设计模式"],
    ["Spring", "学习记录/spring"],
    ["Git", "学习记录/git"],
    ["IDE", "教程/ide"],
    ["Windows", "教程/windows"],
    ["WSL", "教程/wsl"]
  ]);

  const paths = new Set<string>();
  function walk(node: TreeNode): void {
    paths.add(node.path);
    node.children?.forEach(walk);
  }
  walk(tree);

  return {
    repoReadme: await readRepoReadme(config),
    entryCards: [...known.entries()]
      .filter(([, target]) => paths.has(target))
      .map(([title, target]) => ({
        title,
        path: target,
        kind: target.includes("/") ? "highlight" : "top-level"
      }))
  };
}
