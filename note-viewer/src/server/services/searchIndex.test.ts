import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { TreeNode, ViewerConfig } from "../../shared/types";
import { searchNotes } from "./searchIndex";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(join(contentRoot, "学习记录"), { recursive: true });
  await writeFile(join(contentRoot, "学习记录", "spring.md"), "# Spring 扩展\n正文");
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

function tree(): TreeNode {
  return {
    name: "笔记",
    path: "",
    type: "directory",
    children: [
      {
        name: "学习记录",
        path: "学习记录",
        type: "directory",
        overviewPath: "学习记录/readme.md",
        children: [
          {
            name: "spring.md",
            path: "学习记录/spring.md",
            type: "file",
            fileKind: "markdown"
          }
        ]
      }
    ]
  };
}

describe("searchIndex", () => {
  it("finds directory and file names", async () => {
    const config = await fixture();
    const results = await searchNotes("spring", tree(), config);
    expect(results.some((item) => item.path === "学习记录/spring.md")).toBe(true);
  });

  it("finds markdown first heading", async () => {
    const config = await fixture();
    const results = await searchNotes("扩展", tree(), config);
    expect(results.some((item) => item.title === "Spring 扩展")).toBe(true);
  });

  it("does not match a file from its parent directory name", async () => {
    const config = await fixture();
    const results = await searchNotes("学习记录", tree(), config);
    expect(results).toEqual([{ title: "学习记录", path: "学习记录", type: "directory" }]);
  });

  it("finds directory by overview first heading and points to directory path", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "学习记录", "readme.md"), "# 学习总览\n内容");
    const results = await searchNotes("总览", tree(), config);
    expect(results).toContainEqual({
      title: "学习总览",
      path: "学习记录",
      type: "directory",
      snippet: "学习记录/readme.md"
    });
  });

  it("returns empty results for blank query", async () => {
    const config = await fixture();
    await expect(searchNotes("   ", tree(), config)).resolves.toEqual([]);
  });
});
