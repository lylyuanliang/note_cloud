import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreeNode, ViewerConfig } from "../../shared/types";

const scanTree = vi.fn();
const readRepoReadme = vi.fn();
const buildSearchIndex = vi.fn();

vi.mock("./scanRepository", () => ({
  scanTree
}));

vi.mock("./readContent", () => ({
  readRepoReadme
}));

vi.mock("./searchIndex", () => ({
  buildSearchIndex,
  searchIndex: vi.fn((query: string, index: Array<{ title: string; path: string; type: "file" | "directory" }>) =>
    query.trim() ? index.map(({ title, path, type }) => ({ title, path, type })) : []
  )
}));

const config: ViewerConfig = {
  repoRoot: "D:/repo",
  contentRoot: "D:/repo/notes",
  port: 8080,
  publicBasePath: "/"
};

function tree(name = "notes", children: TreeNode[] = []): TreeNode {
  return {
    name,
    path: "",
    type: "directory",
    children
  };
}

describe("repositoryStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRepoReadme.mockResolvedValue(undefined);
    buildSearchIndex.mockResolvedValue([]);
  });

  it("caches the tree after the first read", async () => {
    const cachedTree = tree();
    scanTree.mockResolvedValue(cachedTree);
    const { createRepositoryStore } = await import("./repositoryStore");
    const store = createRepositoryStore(config);

    await expect(store.getTree()).resolves.toBe(cachedTree);
    await expect(store.getTree()).resolves.toBe(cachedTree);

    expect(scanTree).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh between concurrent first reads", async () => {
    const cachedTree = tree();
    scanTree.mockResolvedValue(cachedTree);
    const { createRepositoryStore } = await import("./repositoryStore");
    const store = createRepositoryStore(config);

    await expect(Promise.all([store.getTree(), store.search("notes")])).resolves.toHaveLength(2);

    expect(scanTree).toHaveBeenCalledTimes(1);
    expect(buildSearchIndex).toHaveBeenCalledTimes(1);
  });

  it("refreshes tree and search index on demand", async () => {
    const firstTree = tree("first");
    const secondTree = tree("second", [{ name: "new.md", path: "new.md", type: "file", fileKind: "markdown" }]);
    scanTree.mockResolvedValueOnce(firstTree).mockResolvedValueOnce(secondTree);
    buildSearchIndex.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { title: "new.md", path: "new.md", type: "file", haystack: "new.md" }
    ]);
    const { createRepositoryStore } = await import("./repositoryStore");
    const store = createRepositoryStore(config);

    await expect(store.getTree()).resolves.toBe(firstTree);
    await store.refresh();

    await expect(store.getTree()).resolves.toBe(secondTree);
    await expect(store.search("new")).resolves.toEqual([{ title: "new.md", path: "new.md", type: "file" }]);
    expect(scanTree).toHaveBeenCalledTimes(2);
  });

  it("builds portal data from the cached tree", async () => {
    scanTree.mockResolvedValue(
      tree("notes", [{ name: "学习记录", path: "学习记录", type: "directory", children: [] }])
    );
    readRepoReadme.mockResolvedValue({ path: "README.md", name: "README.md", kind: "markdown", content: "# Home" });
    const { createRepositoryStore } = await import("./repositoryStore");
    const store = createRepositoryStore(config);

    await expect(store.getPortalData()).resolves.toMatchObject({
      repoReadme: { path: "README.md" },
      entryCards: [{ title: "学习记录", path: "学习记录", kind: "top-level" }]
    });
    await store.getTree();

    expect(scanTree).toHaveBeenCalledTimes(1);
  });
});
