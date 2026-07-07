import chokidar from "chokidar";
import path from "node:path";
import type { Response } from "express";
import type { ViewerConfig } from "../../shared/types";
import { isIgnoredPath, toPosixPath } from "../security/safePath";

const clients = new Set<Response>();
let debounceTimer: NodeJS.Timeout | undefined;

function emit(event: string) {
  for (const client of clients) {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }
}

export function addEventsClient(res: Response) {
  clients.add(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: connected\ndata: {}\n\n");
  res.on("close", () => clients.delete(res));
}

export function startRepositoryWatcher(config: ViewerConfig) {
  const watcher = chokidar.watch(config.contentRoot, {
    followSymlinks: false,
    ignoreInitial: true,
    usePolling: process.env.WATCH_USE_POLLING === "true",
    interval: 1000,
    ignored: (watchedPath) => {
      const relative = path.relative(config.contentRoot, watchedPath);
      return (
        relative.startsWith("..") ||
        path.isAbsolute(relative) ||
        isIgnoredPath(toPosixPath(relative))
      );
    }
  });

  watcher.on("all", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      emit("tree-changed");
      emit("file-changed");
    }, 300);
  });

  return watcher;
}
