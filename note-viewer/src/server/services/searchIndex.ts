import type { SearchResult, TreeNode, ViewerConfig } from "../../shared/types";
import { readTextFile } from "./readContent";

export type SearchIndexEntry = {
  title: string;
  path: string;
  type: "file" | "directory";
  snippet?: string;
  haystack: string;
};

function firstHeading(content: string): string | undefined {
  return content
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "");
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function buildSearchIndex(tree: TreeNode, config: ViewerConfig): Promise<SearchIndexEntry[]> {
  const entries: SearchIndexEntry[] = [];

  async function walk(node: TreeNode): Promise<void> {
    entries.push({
      title: node.name,
      path: node.path,
      type: node.type,
      haystack: normalize(node.name)
    });

    if (node.type === "directory" && node.overviewPath) {
      try {
        const file = await readTextFile(node.overviewPath, config);
        const heading = firstHeading(file.content);
        if (heading) {
          entries.push({
            title: heading,
            path: node.path,
            type: "directory",
            snippet: node.overviewPath,
            haystack: normalize(heading)
          });
        }
      } catch {
        // Ignore unreadable overview content and continue indexing.
      }
    }

    if (node.type === "file" && node.fileKind === "markdown") {
      try {
        const file = await readTextFile(node.path, config);
        const heading = firstHeading(file.content);
        if (heading) {
          entries.push({
            title: heading,
            path: node.path,
            type: "file",
            snippet: node.name,
            haystack: normalize(heading)
          });
        }
      } catch {
        // Ignore unreadable markdown content and continue indexing.
      }
    }

    for (const child of node.children || []) {
      await walk(child);
    }
  }

  await walk(tree);
  return entries;
}

export function searchIndex(query: string, index: SearchIndexEntry[]): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return index
    .filter((entry) => entry.haystack.includes(normalized))
    .slice(0, 50)
    .map(({ title, path, type, snippet }) => ({ title, path, type, snippet }));
}
