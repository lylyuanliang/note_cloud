import type { PortalData, SearchResult, TreeNode, ViewerConfig } from "../../shared/types";
import { readRepoReadme } from "./readContent";
import { scanTree } from "./scanRepository";
import { buildSearchIndex, searchIndex, type SearchIndexEntry } from "./searchIndex";

export type RepositoryStore = {
  getTree(): Promise<TreeNode>;
  search(query: string): Promise<SearchResult[]>;
  refresh(): Promise<void>;
  getPortalData(): Promise<PortalData>;
};

type RepositorySnapshot = {
  tree: TreeNode;
  index: SearchIndexEntry[];
};

const knownPortalEntries = new Map<string, string>([
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

function collectPaths(tree: TreeNode): Set<string> {
  const paths = new Set<string>();

  function walk(node: TreeNode): void {
    paths.add(node.path);
    node.children?.forEach(walk);
  }

  walk(tree);
  return paths;
}

export function createRepositoryStore(config: ViewerConfig): RepositoryStore {
  let snapshot: RepositorySnapshot | undefined;
  let refreshPromise: Promise<void> | undefined;

  async function refreshSnapshot(): Promise<void> {
    const tree = await scanTree(config);
    const index = await buildSearchIndex(tree, config);
    snapshot = { tree, index };
  }

  async function ensureReady(): Promise<RepositorySnapshot> {
    if (snapshot) {
      return snapshot;
    }

    if (!refreshPromise) {
      refreshPromise = refreshSnapshot().finally(() => {
        refreshPromise = undefined;
      });
    }

    await refreshPromise;
    if (!snapshot) {
      throw new Error("仓库缓存初始化失败");
    }
    return snapshot;
  }

  return {
    async getTree() {
      return (await ensureReady()).tree;
    },
    async search(query: string) {
      return searchIndex(query, (await ensureReady()).index);
    },
    async refresh() {
      if (!refreshPromise) {
        refreshPromise = refreshSnapshot().finally(() => {
          refreshPromise = undefined;
        });
      }
      await refreshPromise;
    },
    async getPortalData() {
      const tree = (await ensureReady()).tree;
      const paths = collectPaths(tree);

      return {
        repoReadme: await readRepoReadme(config),
        entryCards: [...knownPortalEntries.entries()]
          .filter(([, target]) => paths.has(target))
          .map(([title, target]) => ({
            title,
            path: target,
            kind: target.includes("/") ? ("highlight" as const) : ("top-level" as const)
          }))
      };
    }
  };
}
