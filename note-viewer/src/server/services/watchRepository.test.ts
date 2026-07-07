import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { ViewerConfig } from "../../shared/types";

const handlers = new Map<string, () => void>();
const watcher = {
  on: vi.fn((event: string, handler: () => void) => {
    handlers.set(event, handler);
    return watcher;
  })
};
const watch = vi.fn(() => watcher);

vi.mock("chokidar", () => ({
  default: { watch }
}));

const config: ViewerConfig = {
  repoRoot: "D:/repo",
  contentRoot: "D:/repo/notes",
  port: 8080,
  publicBasePath: "/"
};

describe("watchRepository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    handlers.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes the repository cache before broadcasting changes", async () => {
    const order: string[] = [];
    const response = {
      writeHead: vi.fn(),
      write: vi.fn((chunk: string) => {
        if (chunk.includes("tree-changed")) order.push("tree-changed");
        if (chunk.includes("file-changed")) order.push("file-changed");
      }),
      on: vi.fn()
    };
    const onRepositoryChanged = vi.fn(async () => {
      order.push("refresh");
    });
    const { addEventsClient, startRepositoryWatcher } = await import("./watchRepository");

    addEventsClient(response as unknown as Response);
    startRepositoryWatcher(config, onRepositoryChanged);
    handlers.get("all")?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(order).toEqual(["refresh", "tree-changed", "file-changed"]);
  });
});
