import type { SearchResult, TreeNode, ViewerConfig } from "../../shared/types";
import { readTextFile } from "./readContent";

function firstHeading(content: string): string | undefined {
  return content
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "");
}

export async function searchNotes(
  query: string,
  tree: TreeNode,
  config: ViewerConfig
): Promise<SearchResult[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const results: SearchResult[] = [];

  async function walk(node: TreeNode): Promise<void> {
    if (node.name.toLowerCase().includes(normalized)) {
      results.push({ title: node.name, path: node.path, type: node.type });
    }

    if (node.type === "directory" && node.overviewPath) {
      try {
        const file = await readTextFile(node.overviewPath, config);
        const heading = firstHeading(file.content);
        if (heading?.toLowerCase().includes(normalized)) {
          results.push({
            title: heading,
            path: node.path,
            type: "directory",
            snippet: node.overviewPath
          });
        }
      } catch {
        // Ignore unreadable overview content and continue traversal.
      }
    }

    if (node.type === "file" && node.fileKind === "markdown") {
      try {
        const file = await readTextFile(node.path, config);
        const heading = firstHeading(file.content);
        if (heading?.toLowerCase().includes(normalized)) {
          results.push({
            title: heading,
            path: node.path,
            type: "file",
            snippet: node.name
          });
        }
      } catch {
        // Ignore unreadable markdown content and continue traversal.
      }
    }

    for (const child of node.children || []) {
      await walk(child);
    }
  }

  await walk(tree);
  return results.slice(0, 50);
}
