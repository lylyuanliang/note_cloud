import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { getAssetInfo, readRepoReadme, readTextFile } from "./readContent";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

describe("readContent", () => {
  it("reads markdown as markdown content", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "readme.md"), "# 标题");
    const file = await readTextFile("readme.md", config);
    expect(file.kind).toBe("markdown");
    expect(file.content).toContain("# 标题");
  });

  it("detects yaml language", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "docker-compose.yml"), "services: {}");
    const file = await readTextFile("docker-compose.yml", config);
    expect(file.kind).toBe("text");
    expect(file.language).toBe("yaml");
  });

  it("reads only REPO_ROOT README for portal", async () => {
    const config = await fixture();
    await writeFile(join(config.repoRoot, "README.md"), "# 仓库");
    const readme = await readRepoReadme(config);
    expect(readme?.path).toBe("README.md");
    expect(readme?.content).toContain("# 仓库");
  });

  it("rejects unsupported extension", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "a.bin"), "x");
    await expect(readTextFile("a.bin", config)).rejects.toThrow("不支持");
  });

  it("returns png asset info and rejects svg asset", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "a.png"), "png");
    expect((await getAssetInfo("a.png", config)).mimeType).toBe("image/png");
    await writeFile(join(config.contentRoot, "a.svg"), "<svg />");
    await expect(getAssetInfo("a.svg", config)).rejects.toThrow("SVG");
  });
});
