import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { getAssetInfo, readRepoReadme, readTextFile } from "./readContent";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/" };
}

describe("readContent", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("node:fs/promises");
  });

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

  it("returns canonical posix response path for text files", async () => {
    const config = await fixture();
    await writeFile(join(config.contentRoot, "readme.md"), "# 标题");
    const file = await readTextFile("a/../readme.md", config);
    expect(file.path).toBe("readme.md");
    expect(file.name).toBe("readme.md");
    expect(file.kind).toBe("markdown");
  });

  it("reads only REPO_ROOT README for portal", async () => {
    const config = await fixture();
    await writeFile(join(config.repoRoot, "README.md"), "# 仓库");
    const readme = await readRepoReadme(config);
    expect(readme?.path).toBe("README.md");
    expect(readme?.content).toContain("# 仓库");
  });

  it("does not read repo README symlink that escapes repo root", async () => {
    const config = await fixture();
    const repoReadme = join(config.repoRoot, "README.md");
    const readFile = vi.fn();
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      return {
        ...actual,
        lstat: vi.fn(async (target: string) => {
          if (target === repoReadme) {
            return {
              isSymbolicLink: (): boolean => true,
              isFile: (): boolean => false
            };
          }
          return actual.lstat(target);
        }),
        readFile
      };
    });

    const { readRepoReadme: readRepoReadmeWithMock } = await import("./readContent");
    await expect(readRepoReadmeWithMock(config)).resolves.toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
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
