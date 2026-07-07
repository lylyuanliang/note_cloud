import { resolve } from "node:path";
import type { ViewerConfig } from "../shared/types";

function normalizeBasePath(value: string | undefined): string {
  const raw = value || "/";
  const withStart = raw.startsWith("/") ? raw : `/${raw}`;
  return withStart.endsWith("/") ? withStart : `${withStart}/`;
}

export function getConfig(): ViewerConfig {
  return {
    repoRoot: resolve(process.env.REPO_ROOT || "/workspace"),
    contentRoot: resolve(process.env.CONTENT_ROOT || "/workspace/笔记"),
    port: Number(process.env.PORT || 8080),
    publicBasePath: normalizeBasePath(process.env.PUBLIC_BASE_PATH)
  };
}
