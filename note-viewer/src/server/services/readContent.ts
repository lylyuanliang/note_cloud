import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { FileContent, FileKind, ViewerConfig } from "../../shared/types";
import { normalizeClientRelativePath, resolveContentPath } from "../security/safePath";

const textLanguages = new Map<string, string>([
  [".txt", "text"],
  [".yml", "yaml"],
  [".yaml", "yaml"],
  [".json", "json"],
  [".conf", "nginx"],
  [".sql", "sql"],
  [".js", "javascript"],
  [".ts", "typescript"],
  [".html", "html"],
  [".css", "css"],
  [".sh", "bash"],
  [".bat", "bat"],
  [".reg", "reg"]
]);

const imageMime = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"]
]);

export function getFileKindByName(name: string): FileKind {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".md") {
    return "markdown";
  }
  if (textLanguages.has(ext)) {
    return "text";
  }
  if (imageMime.has(ext)) {
    return "image";
  }
  return "unsupported";
}

export function getLanguageByName(name: string): string | undefined {
  return textLanguages.get(path.extname(name).toLowerCase());
}

export async function readTextFile(relativePath: string, config: ViewerConfig): Promise<FileContent> {
  const safeRelativePath = normalizeClientRelativePath(relativePath);
  const kind = getFileKindByName(safeRelativePath);
  if (kind !== "markdown" && kind !== "text") {
    throw new Error("不支持的文件类型");
  }

  const absolutePath = await resolveContentPath(safeRelativePath, config);
  const [content, info] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);

  return {
    path: safeRelativePath,
    name: path.posix.basename(safeRelativePath),
    kind,
    language: kind === "text" ? getLanguageByName(safeRelativePath) : undefined,
    content,
    updatedAt: info.mtime.toISOString()
  };
}

export async function readRepoReadme(config: ViewerConfig): Promise<FileContent | undefined> {
  const repoRootReal = await realpath(config.repoRoot);
  const absolutePath = path.join(repoRootReal, "README.md");

  try {
    const readmeLinkInfo = await lstat(absolutePath);
    if (readmeLinkInfo.isSymbolicLink() || !readmeLinkInfo.isFile()) {
      return undefined;
    }

    const readmeReal = await realpath(absolutePath);
    const relativeToRoot = path.relative(repoRootReal, readmeReal);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      return undefined;
    }

    const [content, info] = await Promise.all([readFile(readmeReal, "utf8"), stat(readmeReal)]);
    if (!info.isFile()) {
      return undefined;
    }

    return {
      path: "README.md",
      name: "README.md",
      kind: "markdown",
      content,
      updatedAt: info.mtime.toISOString()
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return undefined;
    }
    return undefined;
  }
}

export async function getAssetInfo(
  relativePath: string,
  config: ViewerConfig
): Promise<{ absolutePath: string; mimeType: string }> {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === ".svg") {
    throw new Error("SVG 资源第一版不提供预览");
  }

  const mimeType = imageMime.get(ext);
  if (!mimeType) {
    throw new Error("不支持的图片类型");
  }

  return {
    absolutePath: await resolveContentPath(relativePath, config),
    mimeType
  };
}
