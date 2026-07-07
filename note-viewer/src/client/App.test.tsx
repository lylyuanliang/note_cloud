/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FileContent, PortalData, TreeNode } from "../shared/types";
import { App } from "./App";
import { api } from "./lib/api";

vi.mock("./lib/api", () => ({
  api: {
    portal: vi.fn(),
    tree: vi.fn(),
    file: vi.fn(),
    search: vi.fn(),
    assetUrl: vi.fn((path: string) => `/api/asset?path=${path}`),
    eventsUrl: vi.fn(() => "/api/events")
  }
}));

class MockEventSource {
  addEventListener = vi.fn();
  close = vi.fn();
}

const tree: TreeNode = {
  name: "笔记",
  path: "",
  type: "directory",
  children: [
    {
      name: "学习记录",
      path: "学习记录",
      type: "directory",
      overviewPath: "学习记录/README.md",
      children: [
        {
          name: "README.md",
          path: "学习记录/README.md",
          type: "file",
          fileKind: "markdown"
        },
        {
          name: "docker.md",
          path: "学习记录/docker.md",
          type: "file",
          fileKind: "markdown"
        }
      ]
    }
  ]
};

const portal: PortalData = {
  entryCards: [{ title: "学习记录", path: "学习记录", kind: "top-level" }]
};

function file(path: string): FileContent {
  return {
    path,
    name: path.split("/").pop() || path,
    kind: "markdown",
    content: `# ${path}`
  };
}

const mockedApi = vi.mocked(api);

describe("App workspace navigation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource);
    mockedApi.portal.mockResolvedValue(portal);
    mockedApi.tree.mockResolvedValue(tree);
    mockedApi.file.mockImplementation(async (path) => file(path));
    mockedApi.search.mockResolvedValue([]);
  });

  test("reuses the loaded tree when switching files", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /学习记录/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "README.md" })).not.toBeNull());
    expect(mockedApi.tree).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "docker.md" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "docker.md" })).not.toBeNull());

    expect(mockedApi.tree).toHaveBeenCalledTimes(1);
  });
});
