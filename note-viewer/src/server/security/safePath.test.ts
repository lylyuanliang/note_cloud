import { mkdtemp, mkdir, realpath, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { isIgnoredPath, resolveContentPath, toPosixPath } from "./safePath";

async function fixture(): Promise<ViewerConfig> {
  const root = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const content = join(root, "笔记");
  await mkdir(content, { recursive: true });
  return {
    repoRoot: root,
    contentRoot: content,
    port: 8080,
    publicBasePath: "/"
  };
}

describe("safePath", () => {
  it("normalizes Windows separators to POSIX for internal output", () => {
    expect(toPosixPath("学习记录\\docker\\readme.md")).toBe("学习记录/docker/readme.md");
  });

  it("resolves a valid relative path inside CONTENT_ROOT", async () => {
    const config = await fixture();
    await mkdir(join(config.contentRoot, "学习记录"), { recursive: true });
    await writeFile(join(config.contentRoot, "学习记录", "readme.md"), "# hi");
    const resolved = await resolveContentPath("学习记录/readme.md", config);
    expect(resolved).toBe(await realpath(join(config.contentRoot, "学习记录", "readme.md")));
  });

  it("rejects client paths containing backslashes", async () => {
    const config = await fixture();
    await expect(resolveContentPath("学习记录\\readme.md", config)).rejects.toThrow(/POSIX|反斜杠/);
  });

  it("rejects absolute paths", async () => {
    const config = await fixture();
    await expect(resolveContentPath("/etc/passwd", config)).rejects.toThrow("绝对路径");
  });

  it("rejects parent directory escape", async () => {
    const config = await fixture();
    await expect(resolveContentPath("../README.md", config)).rejects.toThrow("越界");
  });

  it("rejects NUL characters", async () => {
    const config = await fixture();
    await expect(resolveContentPath("a\u0000.md", config)).rejects.toThrow("非法字符");
  });

  it("rejects symlink escape", async () => {
    const config = await fixture();
    const outsideDir = join(config.repoRoot, "outside");
    await mkdir(outsideDir, { recursive: true });
    await writeFile(join(outsideDir, "escape.md"), "# outside");
    await symlink(outsideDir, join(config.contentRoot, "link"), "junction");
    await expect(resolveContentPath("link/escape.md", config)).rejects.toThrow("越界");
  });

  it("matches ignored path segments", () => {
    expect(isIgnoredPath(".git/config")).toBe(true);
    expect(isIgnoredPath("note-viewer/src/App.tsx")).toBe(true);
    expect(isIgnoredPath("学习记录/docker/readme.md")).toBe(false);
  });
});
