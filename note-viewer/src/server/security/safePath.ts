import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ViewerConfig } from "../../shared/types";

const ignoredSegments = new Set([
  ".git",
  ".github",
  ".vscode",
  "node_modules",
  "dist",
  "note-viewer"
]);

export function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function isIgnoredPath(relativePath: string): boolean {
  return toPosixPath(relativePath)
    .split("/")
    .filter(Boolean)
    .some((segment) => ignoredSegments.has(segment));
}

function decodeClientPath(raw: string): string {
  if (raw.includes("\u0000")) {
    throw new Error("非法字符：路径包含 NUL 字符");
  }
  if (path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
    throw new Error("非法路径：不允许绝对路径");
  }

  const normalized = path.posix.normalize(toPosixPath(raw || "."));
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("非法路径：路径越界");
  }
  if (isIgnoredPath(normalized)) {
    throw new Error("非法路径：路径被忽略");
  }

  return normalized === "." ? "" : normalized;
}

export async function resolveContentPath(relativePath: string, config: ViewerConfig): Promise<string> {
  const safeRelative = decodeClientPath(relativePath);
  const contentRootReal = await realpath(config.contentRoot);
  const candidate = path.resolve(contentRootReal, safeRelative);

  let candidateReal: string;
  try {
    candidateReal = await realpath(candidate);
  } catch {
    const parentReal = await realpath(path.dirname(candidate));
    candidateReal = path.join(parentReal, path.basename(candidate));
  }

  const relativeToRoot = path.relative(contentRootReal, candidateReal);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("非法路径：路径越界");
  }

  await stat(candidateReal);
  return candidateReal;
}
