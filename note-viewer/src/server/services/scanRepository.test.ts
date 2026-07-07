import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { buildPortalData, scanTree, selectOverviewName } from "./scanRepository";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

describe("scanRepository", () => {
  it("uses overview priority readme.md before README.md and Readme.md", () => {
    expect(selectOverviewName(["README.md", "Readme.md", "readme.md"])).toBe("readme.md");
  });

  it("ignores hidden project directories and unsupported files", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, ".git"), { recursive: true });
    await writeFile(join(config.contentRoot, ".git", "config"), "x");
    await writeFile(join(config.contentRoot, "a.bin"), "x");
    await writeFile(join(config.contentRoot, "a.md"), "# a");
    const tree = await scanTree(config);
    expect(tree.children?.map((child) => child.name)).toEqual(["a.md"]);
  });

  it("skips symlink entries", async () => {
    const config = await fixture();
    const outside = join(config.repoRoot, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "secret.md"), "# secret");
    await symlink(outside, join(config.contentRoot, "link-out"), "junction");
    const tree = await scanTree(config);
    expect(tree.children?.some((child) => child.name === "link-out")).toBe(false);
  });

  it("builds portal cards for known existing paths", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, "学习记录", "docker", "1.docker-compose文件样例"), { recursive: true });
    await mkdir(join(config.contentRoot, "教程"), { recursive: true });
    await writeFile(join(config.repoRoot, "README.md"), "# 仓库");
    const portal = await buildPortalData(config);
    expect(portal.repoReadme?.content).toContain("# 仓库");
    expect(portal.entryCards.map((card) => card.title)).toContain("学习记录");
    expect(portal.entryCards.map((card) => card.title)).toContain("教程");
    expect(portal.entryCards.map((card) => card.title)).toContain("Docker Compose 样例");
  });
});
