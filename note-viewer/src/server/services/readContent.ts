import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { FileContent, FileKind, ViewerConfig } from "../../shared/types";
import { resolveContentPath, toPosixPath } from "../security/safePath";

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
  const kind = getFileKindByName(relativePath);
  if (kind !== "markdown" && kind !== "text") {
    throw new Error("不支持的文件类型");
  }

  const absolutePath = await resolveContentPath(relativePath, config);
  const [content, info] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);

  return {
    path: toPosixPath(relativePath),
    name: path.basename(relativePath),
    kind,
    language: kind === "text" ? getLanguageByName(relativePath) : undefined,
    content,
    updatedAt: info.mtime.toISOString()
  };
}

export async function readRepoReadme(config: ViewerConfig): Promise<FileContent | undefined> {
  const absolutePath = path.join(config.repoRoot, "README.md");
  try {
    await access(absolutePath);
  } catch {
    return undefined;
  }

  const [content, info] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
  return {
    path: "README.md",
    name: "README.md",
    kind: "markdown",
    content,
    updatedAt: info.mtime.toISOString()
  };
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
