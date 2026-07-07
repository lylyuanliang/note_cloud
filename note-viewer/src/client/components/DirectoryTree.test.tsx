/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TreeNode } from "../../shared/types";
import { DirectoryTree } from "./DirectoryTree";

const tree: TreeNode = {
  name: "笔记",
  path: "",
  type: "directory",
  children: [
    {
      name: "学习记录",
      path: "学习记录",
      type: "directory",
      children: [
        {
          name: "docker",
          path: "学习记录/docker",
          type: "directory",
          children: [
            {
              name: "README.md",
              path: "学习记录/docker/README.md",
              type: "file",
              fileKind: "markdown"
            }
          ]
        }
      ]
    }
  ]
};

describe("DirectoryTree", () => {
  afterEach(cleanup);

  test("collapses and expands directory children", async () => {
    const user = userEvent.setup();
    render(<DirectoryTree tree={tree} selectedPath="" onSelect={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: "README.md" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "折叠 学习记录" }));

    expect(screen.queryByRole("button", { name: "README.md" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "展开 学习记录" }));

    expect(screen.getAllByRole("button", { name: "README.md" })).toHaveLength(1);
  });

  test("keeps ancestors of the selected path expanded", () => {
    render(
      <DirectoryTree
        tree={tree}
        selectedPath="学习记录/docker/README.md"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getAllByRole("button", { name: "README.md" })).toHaveLength(1);
  });

  test("keeps collapsed directories collapsed when the tree object refreshes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DirectoryTree tree={tree} selectedPath="" onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "折叠 学习记录" }));
    expect(screen.queryByRole("button", { name: "README.md" })).toBeNull();

    rerender(<DirectoryTree tree={{ ...tree }} selectedPath="" onSelect={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "README.md" })).toBeNull();
  });
});
